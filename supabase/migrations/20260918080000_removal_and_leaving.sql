-- M5: removing a participant and leaving voluntarily.
--
-- New error codes (SQLSTATE, surfaced by PostgREST as error.code):
--   VB019 participant_removed   VB023 cannot_remove_admin
--
-- Soft delete throughout: a hard delete would cascade and take the
-- participant's past votes with it, and CLAUDE.md is explicit that removed/
-- left participants' votes stay in round history. removed_at is the one
-- column that means "no longer active," used by both remove_participant and
-- leave_session rather than having two mechanisms for the same thing.

alter table participants add column removed_at timestamptz;

-- The predicate behind every read policy and the realtime channel policy
-- (is_session_channel_member reuses this) now also excludes removed rows,
-- so removal cuts off table reads and the realtime channel in the one place
-- both already funnel through — no separate policy change needed.
create or replace function is_active_session_member(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.participants p
    join public.sessions s on s.id = p.session_id
    where p.session_id = p_session_id
      and p.user_id = (select auth.uid())
      and p.removed_at is null
      and s.expires_at > now()
  );
$$;

-- A freed nickname (the previous holder removed or gone) can be reused.
drop index participants_unique_name_per_session;
create unique index participants_unique_name_per_session
  on participants (session_id, lower(name))
  where removed_at is null;

-- The one place "is this user currently an active participant here" is
-- decided for write-side checks, replacing the ad hoc inline lookups that
-- used to skip the removed_at filter entirely — a removed participant could
-- otherwise still vote or read round_status until this.
create function active_participant(p_session_id uuid, p_user_id uuid) returns participants
language plpgsql stable set search_path = '' as $$
declare
  v_participant public.participants;
begin
  select * into v_participant
    from public.participants
   where session_id = p_session_id
     and user_id = p_user_id
     and removed_at is null;

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;

  return v_participant;
end;
$$;

create or replace function assert_is_admin(p_session_id uuid, p_user_id uuid) returns participants
language plpgsql volatile set search_path = '' as $$
declare
  v_caller public.participants;
begin
  v_caller := public.active_participant(p_session_id, p_user_id);

  if v_caller.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'VB006';
  end if;

  return v_caller;
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

  insert into public.votes (round_id, participant_id, value)
  values (p_round_id, v_participant.id, p_value)
  on conflict (round_id, participant_id)
  do update set value = excluded.value, created_at = now();

  perform public.touch_session(v_round.session_id);

  return jsonb_build_object('round_id', p_round_id, 'value', p_value);
end;
$$;

create or replace function round_status(p_round_id uuid) returns jsonb
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

  v_participant := public.active_participant(v_round.session_id, v_user_id);

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

-- remove_participant: admin only, cannot target the admin (themselves — a
-- session has exactly one), refuses a target that is already removed or
-- unknown. Looks the target's session up by id rather than trusting a code
-- from the caller, so it locks the *target's* session even if the caller
-- somehow supplied a participant id from elsewhere — active_participant then
-- fails closed with VB008 if the caller turns out not to belong to it.
create function remove_participant(p_participant_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_target public.participants;
  v_code text;
  v_session public.sessions;
  v_caller public.participants;
begin
  select * into v_target from public.participants where id = p_participant_id;

  if not found then
    raise exception 'participant_not_found' using errcode = 'VB009';
  end if;

  select code into v_code from public.sessions where id = v_target.session_id;
  v_session := public.lock_live_session(v_code);

  v_caller := public.active_participant(v_session.id, v_user_id);

  if v_caller.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'VB006';
  end if;

  if v_target.role = 'admin' then
    raise exception 'cannot_remove_admin' using errcode = 'VB023';
  end if;

  if v_target.removed_at is not null then
    raise exception 'participant_not_found' using errcode = 'VB009';
  end if;

  update public.participants set removed_at = now() where id = v_target.id;

  perform public.touch_session(v_session.id);

  return jsonb_build_object('participant_id', v_target.id);
end;
$$;

-- leave_session: a non-admin just leaves. The admin leaving hands off to the
-- longest-present remaining active participant (earliest joined_at), or ends
-- the session outright if nobody else is left — CLAUDE.md's Roles section
-- has the decision. Demote-before-promote for the same reason as
-- transfer_admin/claim_admin: the partial unique index on admin rows is not
-- deferrable.
create function leave_session(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions := public.lock_live_session(p_code);
  v_caller public.participants := public.active_participant(v_session.id, v_user_id);
  v_next public.participants;
begin
  if v_caller.role <> 'admin' then
    update public.participants set removed_at = now() where id = v_caller.id;
    perform public.touch_session(v_session.id);
    return jsonb_build_object('session_ended', false);
  end if;

  select * into v_next
    from public.participants
   where session_id = v_session.id
     and removed_at is null
     and id <> v_caller.id
   order by joined_at asc
   limit 1;

  if found then
    update public.participants
       set role = 'player', removed_at = now()
     where id = v_caller.id;
    update public.participants set role = 'admin' where id = v_next.id;

    perform public.touch_session(v_session.id);
    return jsonb_build_object('session_ended', false, 'new_admin_id', v_next.id);
  end if;

  delete from public.sessions where id = v_session.id;
  return jsonb_build_object('session_ended', true);
end;
$$;

-- join_session: a removed participant's row is still the unique (session_id,
-- user_id) slot, so the existing-row branch now distinguishes it from the
-- ordinary "already joined" case instead of silently handing back a state
-- that says they're a member again. The 50-participant cap only counts
-- active rows.
create or replace function join_session(p_code text, p_nickname text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_name text := public.validate_nickname(p_nickname);
  v_session public.sessions := public.lock_live_session(p_code);
  v_existing public.participants;
  v_participant_id uuid;
begin
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

-- session_state: participant_count/is_full and the roster now count only
-- active rows, and a top-level `removed` flag distinguishes "was removed"
-- from "never joined" for the caller — both look like is_member = false
-- otherwise, but the frontend needs to tell them apart to show a "you were
-- removed" screen instead of the join form.
create or replace function session_state(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions;
  v_count integer;
  v_is_member boolean;
  v_removed boolean;
begin
  select * into v_session
    from public.sessions
   where code = public.normalize_session_code(p_code);

  if not found then
    raise exception 'session_not_found' using errcode = 'VB001';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'session_expired' using errcode = 'VB002';
  end if;

  select count(*) into v_count
    from public.participants
   where session_id = v_session.id and removed_at is null;

  v_is_member := public.is_active_session_member(v_session.id);

  v_removed := exists (
    select 1 from public.participants
     where session_id = v_session.id
       and user_id = v_user_id
       and removed_at is not null
  );

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'code', v_session.code,
      'deck', v_session.deck,
      'version', v_session.version,
      'expires_at', v_session.expires_at,
      'participant_count', v_count,
      'is_full', v_count >= 50
    ),
    'is_member', v_is_member,
    'removed', v_removed,
    'viewer', case when v_is_member then (
      select jsonb_build_object(
        'participant_id', p.id,
        'name', p.name,
        'role', p.role,
        'can_vote', p.can_vote
      )
      from public.participants p
      where p.session_id = v_session.id and p.user_id = v_user_id
    ) end,
    'participants', case when v_is_member then (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'role', p.role,
            'can_vote', p.can_vote,
            'is_you', p.user_id = v_user_id
          )
          order by p.joined_at, p.name
        ),
        '[]'::jsonb
      )
      from public.participants p
      where p.session_id = v_session.id and p.removed_at is null
    ) end,
    'current_round', case when v_is_member then (
      select jsonb_build_object(
        'id', r.id,
        'round_number', r.round_number,
        'story', r.story,
        'attempt', r.attempt,
        'status', r.status,
        'started_at', r.started_at,
        'revealed_at', r.revealed_at
      )
      from public.rounds r
      where r.id = v_session.current_round_id
    ) end
  );
end;
$$;

revoke execute on function active_participant(uuid, uuid) from public, anon, authenticated;

revoke execute on function remove_participant(uuid) from public, anon;
revoke execute on function leave_session(text) from public, anon;
grant execute on function remove_participant(uuid) to authenticated;
grant execute on function leave_session(text) to authenticated;
