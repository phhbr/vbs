begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dee@example.com');

-- Token 'secret-token' with its real sha256, so claim_admin can be exercised.
insert into sessions (id, code, admin_token_hash)
values (
  '50000000-0000-0000-0000-000000000001',
  'ABCDEFGHJKLM',
  encode(extensions.digest('secret-token', 'sha256'), 'hex')
);

-- A second session whose token is already past its expiry, for the
-- expiry check — kept separate from the main narrative above so that test
-- doesn't have to fight over the first session's state.
insert into sessions (id, code, admin_token_hash, admin_token_expires_at)
values (
  '50000000-0000-0000-0000-000000000002',
  'NPQRSTUVWXYZ',
  encode(extensions.digest('expired-token', 'sha256'), 'hex'),
  now() - interval '1 minute'
);

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player');

-- ------------------------------------------------------------ transfer_admin
set local role authenticated;

-- A player must not be able to hand the role around.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select transfer_admin('70000000-0000-0000-0000-000000000002') $$,
  'VB006',
  null,
  'a player calling transfer_admin is rejected as not_admin'
);

-- Someone outside the session entirely must not either.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok(
  $$ select transfer_admin('70000000-0000-0000-0000-000000000002') $$,
  'VB008',
  null,
  'a stranger calling transfer_admin is rejected as not_a_participant'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select transfer_admin('70000000-0000-0000-0000-000000000009') $$,
  'VB009',
  null,
  'transferring to an unknown participant is rejected as participant_not_found'
);

-- The admin hands over to Bob.
select is(
  transfer_admin('70000000-0000-0000-0000-000000000002') ->> 'participant_id',
  '70000000-0000-0000-0000-000000000002',
  'transfer_admin returns the new admin participant'
);

reset role;
select is(
  (select role from participants where id = '70000000-0000-0000-0000-000000000002'),
  'admin',
  'the target is now the admin'
);

select is(
  (select role from participants where id = '70000000-0000-0000-0000-000000000001'),
  'player',
  'the previous admin dropped to player'
);

select is(
  (select count(*) from participants
    where session_id = '50000000-0000-0000-0000-000000000001' and role = 'admin'),
  1::bigint,
  'the session still has exactly one admin'
);

-- Hand it back so the recovery cases start from a known state.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select transfer_admin('70000000-0000-0000-0000-000000000001') $$,
  'the new admin can hand the role back'
);

-- --------------------------------------------------------------- claim_admin
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select throws_ok(
  $$ select claim_admin('ABCDEFGHJKLM', 'wrong-token') $$,
  'VB007',
  null,
  'a wrong recovery token is rejected as invalid_token'
);

select throws_ok(
  $$ select claim_admin('ABCDEFGHJKLM', null) $$,
  'VB007',
  null,
  'a missing recovery token is rejected as invalid_token'
);

-- Dee is a stranger to this session: the admin row is taken over.
select is(
  claim_admin('ABCDEFGHJKLM', 'secret-token') ->> 'adopted',
  'true',
  'a stranger with the token adopts the existing admin row'
);

reset role;
select is(
  (select user_id from participants where id = '70000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000004'::uuid,
  'the admin row now belongs to the recovering user'
);

select is(
  (select name from participants where id = '70000000-0000-0000-0000-000000000001'),
  'Ada',
  'adoption keeps the original nickname'
);

select is(
  (select count(*) from participants where session_id = '50000000-0000-0000-0000-000000000001'),
  2::bigint,
  'adoption leaves no ghost participant behind'
);

-- ------------------------------------------------------- single-use token
-- design revision security fix: the token Dee just claimed with must not
-- work a second time, for anyone.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select claim_admin('ABCDEFGHJKLM', 'secret-token') $$,
  'VB007',
  null,
  'a token already used successfully is rejected the same as a wrong one'
);

-- ------------------------------------------------------ regenerate_admin_token
-- Bob (a player) may not mint a new recovery link.
select throws_ok(
  $$ select regenerate_admin_token('ABCDEFGHJKLM') $$,
  'VB006',
  null,
  'a player calling regenerate_admin_token is rejected as not_admin'
);

-- Cy, a stranger to the session, may not either.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select regenerate_admin_token('ABCDEFGHJKLM') $$,
  'VB008',
  null,
  'a stranger calling regenerate_admin_token is rejected as not_a_participant'
);

-- Dee, the current admin (via adoption above), mints a fresh link.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
create temporary table t_regen as
  select regenerate_admin_token('ABCDEFGHJKLM') as result;

select ok(
  (select result ->> 'admin_token' from t_regen) is not null,
  'regenerate_admin_token returns a fresh token for the current admin'
);

-- Bob, already a participant, claims with the new token and is promoted
-- rather than adopting a row — the same "existing participant" path
-- claim_admin has always had, now exercised against a regenerated token.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  claim_admin('ABCDEFGHJKLM', (select result ->> 'admin_token' from t_regen)) ->> 'adopted',
  'false',
  'a claimant who already joined is promoted using the regenerated token'
);

reset role;
select is(
  (select role from participants where id = '70000000-0000-0000-0000-000000000002'),
  'admin',
  'the existing participant became the admin'
);

select is(
  (select count(*) from participants
    where session_id = '50000000-0000-0000-0000-000000000001' and role = 'admin'),
  1::bigint,
  'there is still exactly one admin after the claim'
);

-- ------------------------------------------------------------- expiry
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select claim_admin('NPQRSTUVWXYZ', 'expired-token') $$,
  'VB007',
  null,
  'a token past its own expiry is rejected as invalid_token even with the right value'
);

select * from finish();
rollback;
