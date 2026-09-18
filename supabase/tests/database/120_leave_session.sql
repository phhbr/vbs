begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-l@example.com'),
  ('a0000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'earliest-l@example.com'),
  ('a0000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'latest-l@example.com'),
  ('a0000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lonely-admin-l@example.com');

-- A session with an admin and two players, joined in a known order, to prove
-- the hand-off picks the earliest joiner rather than an arbitrary one.
insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-0000000000b1', 'CDEFGHJKLMNR', 'hash');
insert into participants (id, session_id, user_id, name, role, joined_at) values
  ('70000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b1', 'LAdmin', 'admin', now()),
  ('70000000-0000-0000-0000-0000000000b2', '50000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b2', 'LEarliest', 'player', now() + interval '1 minute'),
  ('70000000-0000-0000-0000-0000000000b3', '50000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b3', 'LLatest', 'player', now() + interval '2 minutes');

-- A lone-admin session to prove leaving with nobody left ends it outright.
insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-0000000000b2', 'CDEFGHJKLMNS', 'hash');
insert into participants (id, session_id, user_id, name, role)
values ('70000000-0000-0000-0000-0000000000b4', '50000000-0000-0000-0000-0000000000b2', 'a0000000-0000-0000-0000-0000000000b4', 'LonelyAdmin', 'admin');

-- --------------------------------------------------------------- non-admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000b3","role":"authenticated"}';

select is(
  leave_session('CDEFGHJKLMNR') ->> 'session_ended',
  'false',
  'a non-admin leaving does not end the session'
);

reset role;
select isnt(
  (select removed_at from participants where id = '70000000-0000-0000-0000-0000000000b3'),
  null,
  'the leaving non-admin is soft-removed'
);

select is(
  (select role from participants where id = '70000000-0000-0000-0000-0000000000b1'),
  'admin',
  'the admin is unaffected by a player leaving'
);

-- ------------------------------------------------------- admin with successor
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select is(
  leave_session('CDEFGHJKLMNR') ->> 'new_admin_id',
  '70000000-0000-0000-0000-0000000000b2',
  'the admin leaving hands off to the earliest-joined remaining participant'
);

reset role;
select is(
  (select role from participants where id = '70000000-0000-0000-0000-0000000000b2'),
  'admin',
  'the successor is promoted to admin'
);

select is(
  (select role from participants where id = '70000000-0000-0000-0000-0000000000b1'),
  'player',
  'the outgoing admin is demoted to player'
);

select isnt(
  (select removed_at from participants where id = '70000000-0000-0000-0000-0000000000b1'),
  null,
  'the outgoing admin is soft-removed like any other leaver'
);

select is(
  (select count(*) from participants where session_id = '50000000-0000-0000-0000-0000000000b1' and role = 'admin'),
  1::bigint,
  'exactly one admin remains after the hand-off'
);

select lives_ok(
  $$ set constraints all immediate $$,
  'the admin invariant holds immediately after the demote-then-promote pair'
);

-- ----------------------------------------------------- admin with nobody left
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000b4","role":"authenticated"}';

select is(
  leave_session('CDEFGHJKLMNS') ->> 'session_ended',
  'true',
  'the last participant leaving ends the session'
);

reset role;
select is(
  (select count(*) from sessions where id = '50000000-0000-0000-0000-0000000000b2'),
  0::bigint,
  'the session row itself is gone'
);

select * from finish();
rollback;
