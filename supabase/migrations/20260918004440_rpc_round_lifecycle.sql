-- M3: the session-level half of live voting — starting a story, clearing it,
-- and picking a deck. The round-scoped RPCs (vote, reveal, re_estimate,
-- round_status) land in a later migration.
--
-- New error codes (SQLSTATE, surfaced by PostgREST as error.code):
--   VB012 round_in_progress   VB018 invalid_story

-- Shared by every admin-only mutation, session-level or round-scoped alike.
create function assert_is_admin(p_session_id uuid, p_user_id uuid) returns participants
language plpgsql volatile set search_path = '' as $$
declare
  v_caller public.participants;
begin
  select * into v_caller
    from public.participants
   where session_id = p_session_id and user_id = p_user_id;

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;

  if v_caller.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'VB006';
  end if;

  return v_caller;
end;
$$;

-- start_story/new_story/set_deck all refuse while the current round is still
-- voting. A plain read is enough: the caller already holds the session row
-- lock via lock_live_session, so current_round_id itself cannot change under
-- it, and a stale 'voting' read only ever costs a spurious VB012 on a true
-- concurrent race — which, since a session has exactly one admin, means the
-- same admin acting from two tabs at once, not a correctness issue between
-- different users.
create function assert_no_round_in_progress(p_session sessions) returns void
language plpgsql volatile set search_path = '' as $$
declare
  v_status text;
begin
  if p_session.current_round_id is null then
    return;
  end if;

  select status into v_status
    from public.rounds
   where id = p_session.current_round_id;

  if v_status = 'voting' then
    raise exception 'round_in_progress' using errcode = 'VB012';
  end if;
end;
$$;

create function validate_story_title(p_title text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) < 1 or char_length(v_title) > 200 then
    raise exception 'invalid_story' using errcode = 'VB018';
  end if;
  return v_title;
end;
$$;

create function start_story(p_code text, p_title text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions := public.lock_live_session(p_code);
  v_title text := public.validate_story_title(p_title);
  v_round_number integer;
  v_round_id uuid;
begin
  perform public.assert_is_admin(v_session.id, v_user_id);
  perform public.assert_no_round_in_progress(v_session);

  select coalesce(max(round_number), 0) + 1 into v_round_number
    from public.rounds where session_id = v_session.id;

  insert into public.rounds (session_id, round_number, story, attempt, status)
  values (v_session.id, v_round_number, v_title, 1, 'voting')
  returning id into v_round_id;

  update public.sessions set current_round_id = v_round_id where id = v_session.id;

  perform public.touch_session(v_session.id);

  return jsonb_build_object(
    'round_id', v_round_id,
    'round_number', v_round_number,
    'attempt', 1,
    'story', v_title,
    'status', 'voting'
  );
end;
$$;

create function new_story(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions := public.lock_live_session(p_code);
begin
  perform public.assert_is_admin(v_session.id, v_user_id);
  perform public.assert_no_round_in_progress(v_session);

  update public.sessions set current_round_id = null where id = v_session.id;

  perform public.touch_session(v_session.id);

  return jsonb_build_object('code', v_session.code);
end;
$$;

create function set_deck(p_code text, p_deck text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions := public.lock_live_session(p_code);
begin
  perform public.assert_is_admin(v_session.id, v_user_id);

  if p_deck not in ('fibonacci', 'tshirt') then
    raise exception 'unknown deck %', p_deck using errcode = '22023';
  end if;

  perform public.assert_no_round_in_progress(v_session);

  update public.sessions set deck = p_deck where id = v_session.id;

  perform public.touch_session(v_session.id);

  return jsonb_build_object('code', v_session.code, 'deck', p_deck);
end;
$$;

revoke execute on function assert_is_admin(uuid, uuid) from public, anon, authenticated;
revoke execute on function assert_no_round_in_progress(sessions) from public, anon, authenticated;
revoke execute on function validate_story_title(text) from public, anon, authenticated;

revoke execute on function start_story(text, text) from public, anon;
revoke execute on function new_story(text) from public, anon;
revoke execute on function set_deck(text, text) from public, anon;
grant execute on function start_story(text, text) to authenticated;
grant execute on function new_story(text) to authenticated;
grant execute on function set_deck(text, text) to authenticated;
