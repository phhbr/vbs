-- M5: rate limiting for session creation, join code-guessing, and voting.
--
-- New error codes (SQLSTATE, surfaced by PostgREST as error.code):
--   VB020 session_create_rate_limited   VB021 join_rate_limited
--   VB022 vote_rate_limited
--
-- One generic events table rather than three bespoke counters, so the same
-- assert_rate_limit() helper and the same pruning job serve all of them.

create table rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('session_create', 'join_failed', 'vote')),
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup
  on rate_limit_events (user_id, kind, created_at desc);

-- No policy at all: these counters are an implementation detail of the rate
-- limit checks below, never something a client reads or writes directly.
alter table rate_limit_events enable row level security;
revoke insert, update, delete, select on rate_limit_events from anon, authenticated;

-- Counts this user's recent events of one kind; raises p_errcode at or above
-- the limit, otherwise records this attempt and lets the caller proceed.
create function assert_rate_limit(
  p_user_id uuid,
  p_kind text,
  p_window interval,
  p_max integer,
  p_errcode text
) returns void
language plpgsql volatile set search_path = '' as $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.rate_limit_events
   where user_id = p_user_id
     and kind = p_kind
     and created_at > now() - p_window;

  if v_count >= p_max then
    raise exception 'rate_limit_exceeded' using errcode = p_errcode;
  end if;

  insert into public.rate_limit_events (user_id, kind) values (p_user_id, p_kind);
end;
$$;

create or replace function create_session(
  p_nickname text,
  p_deck text default 'fibonacci',
  p_locale text default 'de'
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_name text := public.validate_nickname(p_nickname);
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_session_id uuid;
  v_code text;
begin
  perform public.assert_rate_limit(
    v_user_id, 'session_create', interval '1 hour', 10, 'VB020'
  );

  if p_deck not in ('fibonacci', 'tshirt') then
    raise exception 'unknown deck %', p_deck using errcode = '22023';
  end if;

  for attempt in 1 .. 5 loop
    begin
      v_code := public.generate_session_code();
      insert into public.sessions (code, admin_token_hash, deck)
      values (
        v_code,
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        p_deck
      )
      returning id into v_session_id;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.participants (session_id, user_id, name, role)
  values (v_session_id, v_user_id, v_name, 'admin');

  return jsonb_build_object(
    'code', v_code,
    'admin_token', v_token,
    'locale', p_locale
  );
end;
$$;

-- The cooldown check is read-only. It cannot also record *this* call's
-- failure itself: PostgREST (and pgTAP's throws_ok) run each RPC call in one
-- transaction and roll the whole thing back when it raises, which would
-- undo an insert made on the way out along with everything else. Recording
-- is therefore record_join_failure()'s job below — its own separate,
-- always-succeeding call — not something join_session can do for itself.
-- nickname_taken (VB004) deliberately never counts either way — that is an
-- ordinary retry, not code-guessing.
create or replace function join_session(p_code text, p_nickname text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_name text := public.validate_nickname(p_nickname);
  v_recent_failures integer;
  v_session public.sessions;
  v_existing public.participants;
  v_participant_id uuid;
begin
  select count(*) into v_recent_failures
    from public.rate_limit_events
   where user_id = v_user_id
     and kind = 'join_failed'
     and created_at > now() - interval '5 minutes';

  if v_recent_failures >= 5 then
    raise exception 'join_rate_limited' using errcode = 'VB021';
  end if;

  v_session := public.lock_live_session(p_code);

  select * into v_existing
    from public.participants
   where session_id = v_session.id and user_id = v_user_id;

  if found then
    if v_existing.removed_at is not null then
      raise exception 'participant_removed' using errcode = 'VB019';
    end if;

    perform public.touch_session(v_session.id);
    return jsonb_build_object(
      'code', v_session.code,
      'participant_id', v_existing.id,
      'role', v_existing.role,
      'already_joined', true
    );
  end if;

  if (
    select count(*) from public.participants
     where session_id = v_session.id and removed_at is null
  ) >= 50 then
    raise exception 'session_full' using errcode = 'VB003';
  end if;

  begin
    insert into public.participants (session_id, user_id, name, role)
    values (v_session.id, v_user_id, v_name, 'player')
    returning id into v_participant_id;
  exception when unique_violation then
    raise exception 'nickname_taken' using errcode = 'VB004';
  end;

  perform public.touch_session(v_session.id);

  return jsonb_build_object(
    'code', v_session.code,
    'participant_id', v_participant_id,
    'role', 'player',
    'already_joined', false
  );
end;
$$;

create or replace function vote(p_round_id uuid, p_value text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_round public.rounds := public.lock_active_round(p_round_id);
  v_participant public.participants;
  v_deck text;
begin
  v_participant := public.active_participant(v_round.session_id, v_user_id);

  if v_participant.role = 'spectator' or not v_participant.can_vote then
    raise exception 'not_a_voter' using errcode = 'VB015';
  end if;

  if v_round.status <> 'voting' then
    raise exception 'round_not_voting' using errcode = 'VB014';
  end if;

  select deck into v_deck from public.sessions where id = v_round.session_id;

  if not (p_value = any(public.deck_card_values(v_deck))) then
    raise exception 'invalid_vote_value' using errcode = 'VB016';
  end if;

  perform public.assert_rate_limit(
    v_user_id, 'vote', interval '10 seconds', 10, 'VB022'
  );

  insert into public.votes (round_id, participant_id, value)
  values (p_round_id, v_participant.id, p_value)
  on conflict (round_id, participant_id)
  do update set value = excluded.value, created_at = now();

  perform public.touch_session(v_round.session_id);

  return jsonb_build_object('round_id', p_round_id, 'value', p_value);
end;
$$;

-- The client calls this after catching VB001/VB002 from join_session — see
-- the comment on join_session for why the recording cannot happen there. A
-- client that skips calling it simply never trips the cooldown; that
-- trade-off (and the layers that still apply regardless — the 5-minute
-- window is short, and 32^12 codes make guessing infeasible either way) is
-- written up in docs/security.md.
create function record_join_failure() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.rate_limit_events (user_id, kind)
  values (public.current_user_id(), 'join_failed');
end;
$$;

revoke execute on function assert_rate_limit(uuid, text, interval, integer, text)
  from public, anon, authenticated;
revoke execute on function record_join_failure() from public, anon;
grant execute on function record_join_failure() to authenticated;

-- Prunes alongside the expiry sweep's cadence rather than adding a third
-- purpose to expire_stale_sessions() itself.
select cron.schedule(
  'prune-rate-limit-events',
  '*/15 * * * *',
  $$delete from public.rate_limit_events where created_at < now() - interval '2 days';$$
);
