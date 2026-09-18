-- M3: the round-scoped half of live voting — casting a vote, revealing,
-- re-estimating, and reading round status.
--
-- New error codes (SQLSTATE, surfaced by PostgREST as error.code):
--   VB013 round_not_found   VB014 round_not_voting   VB015 not_a_voter
--   VB016 invalid_vote_value   VB017 round_not_revealed

create function deck_card_values(p_deck text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_deck
    when 'fibonacci' then array['0','1','2','3','5','8','13','20','40','100','?','PAUSE']
    when 'tshirt' then array['XS','S','M','L','XL','XXL','?']
  end;
$$;

-- The lock that prevents the reveal race: vote() and reveal() both take it
-- before looking at rounds.status, so whichever gets there first commits its
-- change and the other blocks, then re-reads the now-committed status. A vote
-- that arrives after reveal has committed sees status = 'revealed' and fails
-- with VB014, rather than landing.
create function lock_active_round(p_round_id uuid) returns rounds
language plpgsql volatile set search_path = '' as $$
declare
  v_round public.rounds;
  v_expires_at timestamptz;
begin
  select * into v_round from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'round_not_found' using errcode = 'VB013';
  end if;

  select expires_at into v_expires_at
    from public.sessions where id = v_round.session_id;

  if v_expires_at <= now() then
    raise exception 'session_expired' using errcode = 'VB002';
  end if;

  return v_round;
end;
$$;

-- Numeric average (fibonacci) or majority (t-shirt), both excluding '?' and
-- 'PAUSE' — neither is a real estimate. Consensus uses the same exclusion,
-- so a lone PAUSE vote cannot make an otherwise-unanimous round register as
-- disagreement.
create function compute_round_result(p_round_id uuid, p_deck text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_vote_count integer;
  v_real_count integer;
  v_consensus boolean;
  v_result jsonb;
begin
  select count(*) into v_vote_count from public.votes where round_id = p_round_id;

  select count(*), count(distinct value) = 1
    into v_real_count, v_consensus
    from public.votes
   where round_id = p_round_id and value not in ('?', 'PAUSE');

  v_consensus := coalesce(v_consensus, false) and v_real_count > 0;

  if p_deck = 'tshirt' then
    select jsonb_build_object(
      'type', 'majority',
      'value', (
        select value from public.votes
         where round_id = p_round_id and value <> '?'
         group by value
         order by count(*) desc, value
         limit 1
      ),
      'consensus', v_consensus,
      'spread', null,
      'vote_count', v_vote_count
    ) into v_result;
  else
    select jsonb_build_object(
      'type', 'average',
      'value', (
        select round(avg(value::numeric), 1)::text
          from public.votes
         where round_id = p_round_id and value not in ('?', 'PAUSE')
      ),
      'consensus', v_consensus,
      'spread', case when not v_consensus and v_real_count >= 2 then (
        select jsonb_build_object('min', min(value::numeric), 'max', max(value::numeric))
          from public.votes
         where round_id = p_round_id and value not in ('?', 'PAUSE')
      ) end,
      'vote_count', v_vote_count
    ) into v_result;
  end if;

  return v_result;
end;
$$;

create function vote(p_round_id uuid, p_value text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_round public.rounds := public.lock_active_round(p_round_id);
  v_participant public.participants;
  v_deck text;
begin
  select * into v_participant
    from public.participants
   where session_id = v_round.session_id and user_id = v_user_id;

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;

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

  insert into public.votes (round_id, participant_id, value)
  values (p_round_id, v_participant.id, p_value)
  on conflict (round_id, participant_id)
  do update set value = excluded.value, created_at = now();

  perform public.touch_session(v_round.session_id);

  return jsonb_build_object('round_id', p_round_id, 'value', p_value);
end;
$$;

create function reveal(p_round_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_round public.rounds := public.lock_active_round(p_round_id);
  v_deck text;
  v_result jsonb;
begin
  perform public.assert_is_admin(v_round.session_id, v_user_id);

  if v_round.status <> 'voting' then
    raise exception 'round_not_voting' using errcode = 'VB014';
  end if;

  select deck into v_deck from public.sessions where id = v_round.session_id;
  v_result := public.compute_round_result(p_round_id, v_deck);

  update public.rounds
     set status = 'revealed', revealed_at = now(), result = v_result
   where id = p_round_id;

  perform public.touch_session(v_round.session_id);

  return jsonb_build_object('round_id', p_round_id, 'result', v_result);
end;
$$;

create function re_estimate(p_round_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_round public.rounds := public.lock_active_round(p_round_id);
  v_round_number integer;
  v_new_round_id uuid;
begin
  perform public.assert_is_admin(v_round.session_id, v_user_id);

  if v_round.status <> 'revealed' then
    raise exception 'round_not_revealed' using errcode = 'VB017';
  end if;

  select coalesce(max(round_number), 0) + 1 into v_round_number
    from public.rounds where session_id = v_round.session_id;

  insert into public.rounds (session_id, round_number, story, attempt, status)
  values (v_round.session_id, v_round_number, v_round.story, v_round.attempt + 1, 'voting')
  returning id into v_new_round_id;

  update public.sessions
     set current_round_id = v_new_round_id
   where id = v_round.session_id;

  perform public.touch_session(v_round.session_id);

  return jsonb_build_object(
    'round_id', v_new_round_id,
    'round_number', v_round_number,
    'attempt', v_round.attempt + 1,
    'story', v_round.story,
    'status', 'voting'
  );
end;
$$;

-- Read-only. Before reveal, every participant learns only who has voted, plus
-- their own value; after reveal everyone's value is included. This is why it
-- exists as a function rather than a plain select on votes: RLS decides row
-- visibility, not column visibility, and "has voted" without "with what" is
-- exactly a column-level distinction.
create function round_status(p_round_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_round public.rounds;
  v_session public.sessions;
  v_participant public.participants;
begin
  select * into v_round from public.rounds where id = p_round_id;

  if not found then
    raise exception 'round_not_found' using errcode = 'VB013';
  end if;

  select * into v_session from public.sessions where id = v_round.session_id;

  if v_session.expires_at <= now() then
    raise exception 'session_expired' using errcode = 'VB002';
  end if;

  select * into v_participant
    from public.participants
   where session_id = v_round.session_id and user_id = v_user_id;

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;

  return jsonb_build_object(
    'round', jsonb_build_object(
      'id', v_round.id,
      'round_number', v_round.round_number,
      'story', v_round.story,
      'attempt', v_round.attempt,
      'status', v_round.status,
      'started_at', v_round.started_at,
      'revealed_at', v_round.revealed_at
    ),
    'result', v_round.result,
    'participants', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'participant_id', p.id,
            'voted', vt.participant_id is not null,
            'value', case
              when v_round.status = 'revealed' then vt.value
              when p.id = v_participant.id then vt.value
              else null
            end
          )
          order by p.joined_at, p.name
        ),
        '[]'::jsonb
      )
      from public.participants p
      left join public.votes vt
        on vt.round_id = v_round.id and vt.participant_id = p.id
      where p.session_id = v_round.session_id
    )
  );
end;
$$;

revoke execute on function deck_card_values(text) from public, anon, authenticated;
revoke execute on function lock_active_round(uuid) from public, anon, authenticated;
revoke execute on function compute_round_result(uuid, text) from public, anon, authenticated;

revoke execute on function vote(uuid, text) from public, anon;
revoke execute on function reveal(uuid) from public, anon;
revoke execute on function re_estimate(uuid) from public, anon;
revoke execute on function round_status(uuid) from public, anon;
grant execute on function vote(uuid, text) to authenticated;
grant execute on function reveal(uuid) to authenticated;
grant execute on function re_estimate(uuid) to authenticated;
grant execute on function round_status(uuid) to authenticated;
