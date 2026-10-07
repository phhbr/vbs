-- Two functions written before the soft delete (removed_at) existed, and
-- never taught about it.
--
-- transfer_admin accepted any participants row as its target, removed or
-- not, so an admin could hand the chair to someone already removed — the
-- admin invariant counts rows, not active ones, so it let that through, and
-- the active team was left without anyone able to reveal. The caller check
-- had the same gap. It is about to get a button in the UI, so it now goes
-- through the same active-only helpers as everything after 20260918080000:
-- assert_is_admin for the caller, and a target that is active and in the
-- caller's session, re-read under the session lock so a concurrent
-- remove_participant cannot slip in between.
--
-- round_status let a removed participant keep reading rounds (including
-- revealed values) by id. It now requires an active membership, like every
-- other read. It also returns each participant's name: the result panel
-- groups voters by card, and someone who voted and was removed afterwards
-- is in this list but no longer in session_state's.
create or replace function transfer_admin(p_participant_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_target public.participants;
  v_session public.sessions;
  v_caller public.participants;
begin
  select * into v_target
    from public.participants where id = p_participant_id;

  if not found then
    raise exception 'participant_not_found' using errcode = 'VB009';
  end if;

  v_session := public.lock_live_session(
    (select code from public.sessions where id = v_target.session_id)
  );

  -- Rule 3: the check belongs here, not only in the UI.
  v_caller := public.assert_is_admin(v_session.id, v_user_id);

  select * into v_target
    from public.participants
   where id = p_participant_id
     and session_id = v_session.id
     and removed_at is null;

  if not found then
    raise exception 'participant_not_found' using errcode = 'VB009';
  end if;

  if v_target.id <> v_caller.id then
    -- Demote before promoting: the partial unique index on admin rows
    -- cannot be deferred.
    update public.participants set role = 'player' where id = v_caller.id;
    update public.participants set role = 'admin' where id = v_target.id;
  end if;

  perform public.touch_session(v_session.id);

  return jsonb_build_object(
    'code', v_session.code,
    'participant_id', v_target.id,
    'adopted', false
  );
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

  select * into v_participant
    from public.participants
   where session_id = v_round.session_id
     and user_id = v_user_id
     and removed_at is null;

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
            'name', p.name,
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
