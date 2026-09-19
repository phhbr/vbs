-- Design revision security fix: a recovery link leaked in a screenshot
-- (AdminRecoveryNotice was rendering the full URL, token included, as
-- visible text) exposed that admin_token_hash never expired and stayed
-- valid indefinitely once minted, however many times it was used. Two
-- changes: an expiry window matching the session's own 24h touch/expiry
-- convention, and single-use — invalidated on the first successful claim
-- rather than staying valid forever. An admin who wants to hand off again
-- mints a fresh link with the new regenerate_admin_token, rather than ever
-- being able to redisplay the original — the database never could either;
-- only its hash is stored.

alter table sessions
  add column admin_token_expires_at timestamptz not null default now() + interval '24 hours';

-- Unchanged from the rate-limited version in 20260918101500_rate_limits.sql
-- except for minting the expiry alongside the token itself — replacing a
-- function replaces its whole body, so this has to carry every change made
-- to create_session since its original definition, not just the original.
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

  -- 60 bits of entropy makes a collision vanishingly unlikely, but the unique
  -- constraint is the authority, so retry rather than assume.
  for attempt in 1 .. 5 loop
    begin
      v_code := public.generate_session_code();
      insert into public.sessions
        (code, admin_token_hash, admin_token_expires_at, deck)
      values (
        v_code,
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        now() + interval '24 hours',
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

-- Same two paths as before (adopt a stranger, promote an existing
-- participant), plus: the token is checked for expiry alongside its hash,
-- and rotated to an unguessable, never-returned value immediately once
-- it's accepted — a second claim with the same token, whether that's a
-- genuine reuse or the link having leaked further, fails the same way a
-- wrong token always did.
create or replace function claim_admin(p_code text, p_token text) returns jsonb
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
     encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     or v_session.admin_token_expires_at < now() then
    raise exception 'invalid_token' using errcode = 'VB007';
  end if;

  update public.sessions
     set admin_token_hash = encode(
           extensions.digest(encode(extensions.gen_random_bytes(32), 'hex'), 'sha256'),
           'hex'
         )
   where id = v_session.id;

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

-- Lets the current admin mint a fresh recovery link on demand, e.g. after
-- their previous one was already claimed or simply to renew it — there is
-- no "redisplay the existing link" option even in principle, since the
-- database only ever held its hash.
create function regenerate_admin_token(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user_id uuid := public.current_user_id();
  v_session public.sessions := public.lock_live_session(p_code);
  v_caller public.participants;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into v_caller
    from public.participants
   where session_id = v_session.id and user_id = v_user_id;

  if not found then
    raise exception 'not_a_participant' using errcode = 'VB008';
  end if;

  if v_caller.role <> 'admin' then
    raise exception 'not_admin' using errcode = 'VB006';
  end if;

  update public.sessions
     set admin_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         admin_token_expires_at = now() + interval '24 hours'
   where id = v_session.id;

  perform public.touch_session(v_session.id);

  return jsonb_build_object(
    'code', v_session.code,
    'admin_token', v_token
  );
end;
$$;

revoke execute on function regenerate_admin_token(text) from public, anon;
grant execute on function regenerate_admin_token(text) to authenticated;
