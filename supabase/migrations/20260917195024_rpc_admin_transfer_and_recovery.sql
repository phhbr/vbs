-- M2: handing the admin role over, and recovering it from the one-time link.
--
-- Both functions demote before they promote. The partial unique index on
-- admin rows cannot be deferred, so the reverse order would collide with the
-- outgoing admin; the deferred invariant trigger then checks the end state.

create function transfer_admin(p_participant_id uuid) returns jsonb
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

  select * into v_caller
    from public.participants
   where session_id = v_session.id and user_id = v_user_id;

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;

  -- Rule 3: the check belongs here, not only in the UI.
  if v_caller.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'VB006';
  end if;

  if v_target.id = v_caller.id then
    perform public.touch_session(v_session.id);
    return jsonb_build_object(
      'code', v_session.code,
      'participant_id', v_target.id,
      'adopted', false
    );
  end if;

  update public.participants set role = 'player' where id = v_caller.id;
  update public.participants set role = 'admin' where id = v_target.id;

  perform public.touch_session(v_session.id);

  return jsonb_build_object(
    'code', v_session.code,
    'participant_id', v_target.id,
    'adopted', false
  );
end;
$$;

-- The recovery link, /s/<code>#admin=<token>, lands here.
--
-- Two paths, because the realistic case is a browser that lost its anonymous
-- session and is therefore a stranger to this session:
--
--   caller is not a participant  -> take over the existing admin row, keeping
--                                   its nickname. No ghost participant is left
--                                   behind and no extra seat is used, so
--                                   recovery still works on a full session.
--   caller is already a participant -> demote the old admin to player and
--                                   promote the caller, which is the plain
--                                   hand-over case.
create function claim_admin(p_code text, p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions := public.lock_live_session(p_code);
  v_admin public.participants;
  v_caller public.participants;
begin
  -- Comparing hashes rather than tokens: a timing signal here would only leak
  -- information about a digest the attacker already holds.
  if v_session.admin_token_hash is distinct from
     encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'invalid_token' using errcode = 'VB007';
  end if;

  select * into v_admin
    from public.participants
   where session_id = v_session.id and role = 'admin';

  if not found then
    raise exception 'participant_not_found' using errcode = 'VB009';
  end if;

  select * into v_caller
    from public.participants
   where session_id = v_session.id and user_id = v_user_id;

  if not found then
    update public.participants
       set user_id = v_user_id, last_activity_at = now()
     where id = v_admin.id;

    perform public.touch_session(v_session.id);

    return jsonb_build_object(
      'code', v_session.code,
      'participant_id', v_admin.id,
      'adopted', true
    );
  end if;

  if v_caller.id <> v_admin.id then
    update public.participants set role = 'player' where id = v_admin.id;
    update public.participants set role = 'admin' where id = v_caller.id;
  end if;

  perform public.touch_session(v_session.id);

  return jsonb_build_object(
    'code', v_session.code,
    'participant_id', v_caller.id,
    'adopted', false
  );
end;
$$;

revoke execute on function transfer_admin(uuid) from public, anon;
revoke execute on function claim_admin(text, text) from public, anon;
grant execute on function transfer_admin(uuid) to authenticated;
grant execute on function claim_admin(text, text) to authenticated;
