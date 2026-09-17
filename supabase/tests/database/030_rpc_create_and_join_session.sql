begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com');

-- An already expired session to test the expiry gate.
insert into sessions (id, code, admin_token_hash, expires_at)
values ('50000000-0000-0000-0000-000000000009', 'ZZZZZZZZZZZZ', 'hash', now() - interval '1 minute');
insert into participants (session_id, user_id, name, role)
values ('50000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'Cy', 'admin');

-- A session with 50 participants to test the limit.
insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-000000000008', 'YYYYYYYYYYYY', 'hash');
insert into participants (session_id, user_id, name, role)
values ('50000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'Cy', 'admin');
insert into auth.users (id, instance_id, aud, role, email)
select ('b0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'filler' || i || '@example.com'
  from generate_series(1, 49) i;
insert into participants (session_id, user_id, name, role)
select '50000000-0000-0000-0000-000000000008',
       ('b0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       'Filler' || i, 'player'
  from generate_series(1, 49) i;

-- ------------------------------------------------------------ create_session
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table created as
select create_session('Ada', 'tshirt', 'en') as payload;

select matches(
  (select payload ->> 'code' from created),
  '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$',
  'create_session returns a code in the canonical format'
);

select matches(
  (select payload ->> 'admin_token' from created),
  '^[0-9a-f]{64}$',
  'create_session returns a 64 hex character recovery token'
);

select is(
  (select payload ->> 'locale' from created),
  'en',
  'create_session echoes the locale back'
);

reset role;

select is(
  (select count(*) from sessions s where s.code = (select payload ->> 'code' from created)),
  1::bigint,
  'the session row exists'
);

select is(
  (select s.deck from sessions s where s.code = (select payload ->> 'code' from created)),
  'tshirt',
  'the requested deck is stored'
);

select is(
  (select p.role from participants p
     join sessions s on s.id = p.session_id
    where s.code = (select payload ->> 'code' from created)),
  'admin',
  'the creator is stored as the admin'
);

select is(
  (select s.admin_token_hash from sessions s
    where s.code = (select payload ->> 'code' from created)),
  encode(extensions.digest((select payload ->> 'admin_token' from created), 'sha256'), 'hex'),
  'only the sha256 hash of the token is stored'
);

select isnt(
  (select s.admin_token_hash from sessions s
    where s.code = (select payload ->> 'code' from created)),
  (select payload ->> 'admin_token' from created),
  'the plaintext token is never stored'
);

-- ------------------------------------------------------- create_session, bad
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select create_session('   ') $$,
  'VB005',
  null,
  'a blank nickname is rejected as nickname_invalid'
);

select throws_ok(
  $$ select create_session(repeat('x', 25)) $$,
  'VB005',
  null,
  'a nickname over 24 characters is rejected as nickname_invalid'
);

-- ------------------------------------------------------------- unauthenticated
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select create_session('Nobody') $$,
  'VB011',
  null,
  'a caller without a user id is rejected as not_authenticated'
);

-- -------------------------------------------------------------- join_session
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  join_session((select payload ->> 'code' from created), 'Bob') ->> 'role',
  'player',
  'a joiner becomes a player'
);

select is(
  join_session((select payload ->> 'code' from created), 'Bob') ->> 'already_joined',
  'true',
  'joining twice returns the existing participant instead of duplicating'
);

reset role;
select is(
  (select count(*) from participants p
     join sessions s on s.id = p.session_id
    where s.code = (select payload ->> 'code' from created)),
  2::bigint,
  'joining twice leaves exactly two participants'
);

-- Codes are matched case-insensitively and separators are ignored.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  join_session(
    lower(substr((select payload ->> 'code' from created), 1, 4) || '-' ||
          substr((select payload ->> 'code' from created), 5, 4) || '-' ||
          substr((select payload ->> 'code' from created), 9, 4)),
    'Cy'
  ) ->> 'role',
  'player',
  'a lower case, dash separated code still resolves'
);

-- A nickname that differs only in case is taken.
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select join_session((select payload ->> 'code' from created), 'ada') $$,
  'VB004',
  null,
  'a nickname differing only in case is reported as nickname_taken'
);

-- ------------------------------------------------------------- session gates
select throws_ok(
  $$ select join_session('ZZZZZZZZZZZZ', 'Late') $$,
  'VB002',
  null,
  'joining an expired session is reported as session_expired'
);

select throws_ok(
  $$ select join_session('MMMMMMMMMMMM', 'Lost') $$,
  'VB001',
  null,
  'joining an unknown code is reported as session_not_found'
);

-- Bob is not in the 50-strong session, so this is a genuine 51st join rather
-- than the idempotent "already joined" path.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select join_session('YYYYYYYYYYYY', 'FiftyFirst') $$,
  'VB003',
  null,
  'the 51st participant is reported as session_full'
);

reset role;
select * from finish();
rollback;
