-- M2: creating and joining a session.
--
-- Error codes (SQLSTATE, surfaced by PostgREST as error.code):
--   VB001 session_not_found      VB007 invalid_token
--   VB002 session_expired        VB008 not_a_participant
--   VB003 session_full           VB009 participant_not_found
--   VB004 nickname_taken         VB010 admin_invariant (trigger only)
--   VB005 nickname_invalid       VB011 not_authenticated
--   VB006 not_admin

create function current_user_id() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'VB011';
  end if;
  return v_user_id;
end;
$$;

-- Architecture rule 6: every action pushes expiry out by 24 hours. The version
-- bump has no reader until M3's broadcast, but a change counter that never
-- moves is a bug waiting for that milestone.
create function touch_session(p_session_id uuid) returns void
language sql volatile set search_path = '' as $$
  update public.sessions
     set last_activity_at = now(),
         expires_at = now() + interval '24 hours',
         version = version + 1
   where id = p_session_id;
$$;

-- Loads a session by code for mutation, taking a row lock so concurrent joins
-- to the same session serialise. Raises if it is unknown or expired.
create function lock_live_session(p_code text) returns sessions
language plpgsql volatile set search_path = '' as $$
declare
  v_session public.sessions;
begin
  select * into v_session
    from public.sessions
   where code = public.normalize_session_code(p_code)
   for update;

  if not found then
    raise exception 'session_not_found' using errcode = 'VB001';
  end if;

  if v_session.expires_at <= now() then
    raise exception 'session_expired' using errcode = 'VB002';
  end if;

  return v_session;
end;
$$;

create function validate_nickname(p_nickname text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_nickname, ''));
begin
  if char_length(v_name) < 1 or char_length(v_name) > 24 then
    raise exception 'nickname_invalid' using errcode = 'VB005';
  end if;
  return v_name;
end;
$$;

create function create_session(
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
  if p_deck not in ('fibonacci', 'tshirt') then
    raise exception 'unknown deck %', p_deck using errcode = '22023';
  end if;

  -- 60 bits of entropy makes a collision vanishingly unlikely, but the unique
  -- constraint is the authority, so retry rather than assume.
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

  -- The token is returned exactly once. Only its hash is stored.
  return jsonb_build_object(
    'code', v_code,
    'admin_token', v_token,
    'locale', p_locale
  );
end;
$$;

create function join_session(p_code text, p_nickname text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_name text := public.validate_nickname(p_nickname);
  v_session public.sessions := public.lock_live_session(p_code);
  v_existing public.participants;
  v_participant_id uuid;
begin
  -- Idempotent: a user who already joined gets their row back untouched, so a
  -- refresh or a second tab never creates a duplicate or renames anyone.
  select * into v_existing
    from public.participants
   where session_id = v_session.id and user_id = v_user_id;

  if found then
    perform public.touch_session(v_session.id);
    return jsonb_build_object(
      'code', v_session.code,
      'participant_id', v_existing.id,
      'role', v_existing.role,
      'already_joined', true
    );
  end if;

  if (select count(*) from public.participants where session_id = v_session.id) >= 50 then
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

-- Only signed-in callers (anonymous auth still yields the `authenticated` role)
-- may call these. The internal helpers are not part of the API surface.
revoke execute on function current_user_id() from public, anon, authenticated;
revoke execute on function touch_session(uuid) from public, anon, authenticated;
revoke execute on function lock_live_session(text) from public, anon, authenticated;
revoke execute on function validate_nickname(text) from public, anon, authenticated;
revoke execute on function generate_session_code() from public, anon, authenticated;

revoke execute on function create_session(text, text, text) from public, anon;
revoke execute on function join_session(text, text) from public, anon;
grant execute on function create_session(text, text, text) to authenticated;
grant execute on function join_session(text, text) to authenticated;
