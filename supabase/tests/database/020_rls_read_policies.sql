begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------- fixtures
-- Two sessions so we can prove a member of one cannot read the other.
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com');

insert into sessions (id, code, admin_token_hash, expires_at) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash', now() + interval '24 hours'),
  ('50000000-0000-0000-0000-000000000002', 'NPQRSTUVWXYZ', 'hash', now() + interval '24 hours'),
  ('50000000-0000-0000-0000-000000000003', 'BCDEFGHJKLMN', 'hash', now() - interval '1 minute');

insert into participants (session_id, user_id, name, role) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player'),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Cy', 'admin'),
  ('50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin');

insert into rounds (id, session_id, round_number, story) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'Login redesign');

insert into votes (round_id, participant_id, value)
select '60000000-0000-0000-0000-000000000001', id, '5'
  from participants where name = 'Ada' and session_id = '50000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------------ member reads
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from sessions),
  1::bigint,
  'a member sees exactly the one live session they belong to'
);

select is(
  (select count(*) from participants),
  2::bigint,
  'a member sees every participant of their session'
);

select is(
  (select count(*) from rounds),
  1::bigint,
  'a member sees the rounds of their session'
);

select is_empty(
  $$ select * from votes $$,
  'votes stay unreadable in M2, even for a member of the session'
);

-- ------------------------------------------------------ cross-session reads
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  (select count(*) from sessions),
  1::bigint,
  'a member of another session sees only their own'
);

select is(
  (select count(*) from participants where name in ('Ada', 'Bob')),
  0::bigint,
  'a member of another session sees none of our participants'
);

-- --------------------------------------------------------- non-member reads
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000099","role":"authenticated"}';

select is_empty($$ select * from sessions $$, 'a non-member sees no session');
select is_empty($$ select * from participants $$, 'a non-member sees no participant');
select is_empty($$ select * from rounds $$, 'a non-member sees no round');

-- -------------------------------------------------------------- expiry gate
-- Ada is a member of session 3, but it expired a minute ago.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from sessions where code = 'BCDEFGHJKLMN'),
  0::bigint,
  'an expired session is invisible even to its own member'
);

-- -------------------------------------------------------------- write bans
select throws_ok(
  $$ insert into participants (session_id, user_id, name, role)
     values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000099', 'Mallory', 'player') $$,
  '42501',
  null,
  'a member cannot insert a participant directly'
);

select throws_ok(
  $$ update sessions set deck = 'tshirt' where code = 'ABCDEFGHJKLM' $$,
  '42501',
  null,
  'a member cannot update their session directly'
);

reset role;
select * from finish();
rollback;
