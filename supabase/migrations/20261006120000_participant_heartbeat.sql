-- Presence for clients without a socket. Realtime presence rides the
-- WebSocket, so a participant behind a proxy that blocks WebSockets never
-- shows up in anyone's presence state and reads as "offline" to everyone
-- else, even while their votes keep landing. Such a client already polls
-- session_state (apps/web realtime.ts); on each tick it now also calls
-- heartbeat(), and session_state reports who has been seen recently.
--
-- A heartbeat is not activity (architecture rule 6): it touches neither
-- expires_at nor version. No version bump also means no broadcast, so
-- connected clients learn about it by refetching session_state on their
-- own while someone is missing from socket presence.
alter table participants add column last_seen_at timestamptz;

create function heartbeat(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
begin
  update public.participants p
     set last_seen_at = now()
   where p.session_id = p_session_id
     and p.user_id = v_user_id
     and p.removed_at is null
     and exists (
       select 1 from public.sessions s
        where s.id = p_session_id and s.expires_at > now()
     );

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;
end;
$$;

revoke execute on function heartbeat(uuid) from public, anon;
grant execute on function heartbeat(uuid) to authenticated;

-- Unchanged from 20260918080000_removal_and_leaving.sql except for
-- `seen_recently`. The 15-second window spans almost four heartbeats at the
-- client's 4-second poll interval, so one or two slow ticks do not flicker
-- anyone offline. It is judged against the database clock, so a skewed
-- client clock cannot matter.
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
            'is_you', p.user_id = v_user_id,
            'seen_recently', coalesce(p.last_seen_at > now() - interval '15 seconds', false)
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
