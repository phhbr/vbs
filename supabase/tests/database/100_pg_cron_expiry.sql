begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'expiring-admin@example.com'),
  ('a0000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'expiring-player@example.com');

-- A session past its expiry, with a full round/vote history, to exercise the
-- cascade end to end.
insert into sessions (id, code, admin_token_hash, expires_at)
values ('50000000-0000-0000-0000-0000000000e1', 'CDEFGHJKLMNP', 'hash', now() - interval '1 minute');
insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-0000000000e1', 'ExpAdmin', 'admin'),
  ('70000000-0000-0000-0000-0000000000e2', '50000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-0000000000e2', 'ExpPlayer', 'player');
insert into rounds (id, session_id, round_number, story, status)
values ('60000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-0000000000e1', 1, 'Doomed story', 'revealed');
insert into votes (round_id, participant_id, value)
values ('60000000-0000-0000-0000-0000000000e1', '70000000-0000-0000-0000-0000000000e1', '5');

-- A session that is not yet expired, to prove the sweep leaves it alone.
insert into sessions (id, code, admin_token_hash, expires_at)
values ('50000000-0000-0000-0000-0000000000e2', 'DEFGHJKLMNPQ', 'hash', now() + interval '1 hour');

-- --------------------------------------------------------------- the sweep
select is(
  expire_stale_sessions(),
  1,
  'the sweep reports exactly one expired session'
);

select is(
  (select count(*) from sessions where id = '50000000-0000-0000-0000-0000000000e1'),
  0::bigint,
  'the expired session itself is gone'
);

select is(
  (select count(*) from participants where session_id = '50000000-0000-0000-0000-0000000000e1'),
  0::bigint,
  'its participants cascade away'
);

select is(
  (select count(*) from rounds where session_id = '50000000-0000-0000-0000-0000000000e1'),
  0::bigint,
  'its rounds cascade away'
);

select is(
  (select count(*) from votes where round_id = '60000000-0000-0000-0000-0000000000e1'),
  0::bigint,
  'its votes cascade away'
);

select is(
  (select count(*) from sessions where id = '50000000-0000-0000-0000-0000000000e2'),
  1::bigint,
  'a session not yet expired survives the sweep'
);

select is(
  expire_stale_sessions(),
  0,
  'running the sweep again finds nothing left to expire'
);

-- ------------------------------------------------- abandoned anonymous users
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at) values
  ('a0000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '8 days'),
  ('a0000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now() - interval '8 days');

-- An old anonymous user who still belongs to the live session must survive.
insert into participants (session_id, user_id, name, role)
values ('50000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-0000000000e3', 'StillHere', 'player');

select is(
  cleanup_abandoned_anonymous_users(),
  1,
  'the cleanup reports exactly one abandoned anonymous user'
);

select is(
  (select count(*) from auth.users where id = 'a0000000-0000-0000-0000-0000000000e3'),
  1::bigint,
  'an old anonymous user still belonging to a session is kept'
);

select is(
  (select count(*) from auth.users where id = 'a0000000-0000-0000-0000-0000000000e4'),
  1::bigint,
  'an anonymous user under 7 days old is kept even with no session'
);

select is(
  (select count(*) from auth.users where id = 'a0000000-0000-0000-0000-0000000000e5'),
  0::bigint,
  'an old anonymous user with no session at all is deleted'
);

select * from finish();
rollback;
