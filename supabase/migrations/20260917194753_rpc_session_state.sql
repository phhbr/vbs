-- M2: everything the join screen and the lobby need, in one round trip.
--
-- This is security definer rather than a plain function relying on RLS, because
-- a caller who has not joined yet must still learn that the code exists, is
-- full, or has expired — otherwise the join screen cannot render and the error
-- states have nothing to go on. RLS would hand them nothing at all.
--
-- What keeps that honest is that the membership branch calls the *same*
-- predicate the policies use, `is_active_session_member`. The disclosure rule
-- cannot drift away from the RLS rule, because it is the RLS rule.
--
-- A non-member sees only the code, the deck and how full the session is. The
-- participant list, and with it everybody's nickname, stays behind membership.
create function session_state(p_code text) returns jsonb
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
          -- Name, not id, as the tiebreaker: participants created in the same
          -- transaction share joined_at to the microsecond, and a random uuid
          -- would order the list differently on every call.
          order by p.joined_at, p.name
        ),
        '[]'::jsonb
      )
      from public.participants p
      where p.session_id = v_session.id
    ) end
  );
end;
$$;

revoke execute on function session_state(text) from public, anon;
grant execute on function session_state(text) to authenticated;
