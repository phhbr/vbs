-- M3: one private channel per session, `session:<session id>`. Every mutating
-- function already bumps sessions.version through touch_session(), so a
-- single trigger on that column change is enough to notify every client of
-- every state change — starting a story, a vote landing, a reveal, all of it.
--
-- The payload is deliberately just the version. Clients refetch through their
-- normal queries on receiving it; no vote value is ever broadcast.
create function broadcast_session_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('version', new.version),
    'session_changed',
    'session:' || new.id::text,
    true
  );
  return null;
end;
$$;

create trigger sessions_broadcast_version
  after update on sessions
  for each row
  when (old.version is distinct from new.version)
  execute function broadcast_session_version();

-- Authorization for that channel. Realtime checks policies on
-- realtime.messages against the topic of the channel being subscribed to;
-- this is the private-channel equivalent of is_active_session_member, reused
-- rather than duplicated so the two can never drift apart. Malformed or
-- unrelated topics fail closed rather than erroring the cast.
create function is_session_channel_member(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_session_id uuid;
begin
  if p_topic !~ '^session:[0-9a-f-]{36}$' then
    return false;
  end if;
  v_session_id := split_part(p_topic, ':', 2)::uuid;
  return public.is_active_session_member(v_session_id);
exception when others then
  return false;
end;
$$;

-- No insert policy: clients never publish to this channel, only the
-- broadcast trigger does, running as the function owner rather than through
-- this grant.
create policy session_channel_select on realtime.messages
  for select using (is_session_channel_member(realtime.topic()));

-- session_state gains the session's id, so the client can build the channel
-- topic, and the current round's metadata (never its votes or result — that
-- stays behind round_status), gated by membership like viewer/participants.
create or replace function session_state(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions;
  v_count integer;
  v_is_member boolean;
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
    from public.participants where session_id = v_session.id;

  v_is_member := public.is_active_session_member(v_session.id);

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
      where p.session_id = v_session.id
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
