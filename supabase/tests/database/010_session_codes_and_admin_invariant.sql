begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com');

insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash');

insert into participants (session_id, user_id, name, role) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player');

-- ------------------------------------------------------------- code format
select throws_ok(
  $$ insert into sessions (code, admin_token_hash) values ('SHORT', 'h') $$,
  '23514',
  null,
  'a code shorter than 12 characters is rejected'
);

select throws_ok(
  $$ insert into sessions (code, admin_token_hash) values ('ABCDEFGHIJKL', 'h') $$,
  '23514',
  null,
  'a code containing the ambiguous letter I is rejected'
);

select throws_ok(
  $$ insert into sessions (code, admin_token_hash) values ('abcdefghjklm', 'h') $$,
  '23514',
  null,
  'a lower case code is rejected — storage is canonical upper case'
);

-- --------------------------------------------------------- code generation
select matches(
  generate_session_code(),
  '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$',
  'generate_session_code produces a code in the stored format'
);

select is(
  (select count(distinct generate_session_code()) from generate_series(1, 50)),
  50::bigint,
  '50 generated codes are all distinct'
);

select is(
  normalize_session_code('abcd-efgh jklm'),
  'ABCDEFGHJKLM',
  'normalize_session_code strips separators and upper cases'
);

-- ---------------------------------------------------------------- nickname
select throws_ok(
  $$ insert into participants (session_id, user_id, name, role)
     values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'ada', 'player') $$,
  '23505',
  null,
  'a nickname differing only in case is rejected within one session'
);

select throws_ok(
  $$ insert into participants (session_id, user_id, name, role)
     values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', '', 'player') $$,
  '23514',
  null,
  'an empty nickname is rejected'
);

select throws_ok(
  $$ insert into participants (session_id, user_id, name, role)
     values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', repeat('x', 25), 'player') $$,
  '23514',
  null,
  'a nickname longer than 24 characters is rejected'
);

-- --------------------------------------------------------- one admin: index
select throws_ok(
  $$ update participants set role = 'admin' where name = 'Bob' $$,
  '23505',
  null,
  'a second admin in the same session is rejected by the partial unique index'
);

-- ------------------------------------------------------- one admin: trigger
-- The cases that must PASS stay in deferred mode and force the check at the
-- end, which is what a real commit does.
savepoint before_swap;
update participants set role = 'player' where name = 'Ada';
update participants set role = 'admin' where name = 'Bob';
select lives_ok(
  'set constraints all immediate',
  'demote then promote inside one transaction is accepted'
);
rollback to savepoint before_swap;

savepoint before_empty;
delete from participants where session_id = '50000000-0000-0000-0000-000000000001';
select lives_ok(
  'set constraints all immediate',
  'a session with no participants at all is accepted'
);
rollback to savepoint before_empty;

-- The cases that must FAIL switch the trigger to immediate so the offending
-- statement raises where throws_ok can catch it. A failing SET CONSTRAINTS
-- cannot be caught by throws_ok, so it is never used that way here.
set constraints all immediate;

select throws_ok(
  $$ delete from participants where name = 'Ada' $$,
  'VB010',
  null,
  'deleting the only admin while a participant remains is rejected'
);

select throws_ok(
  $$ update participants set role = 'player' where name = 'Ada' $$,
  'VB010',
  null,
  'demoting the only admin without promoting anyone is rejected'
);

select * from finish();
rollback;
