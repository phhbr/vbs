begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- Bob is already a participant, so his claim demotes instead of adopting.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  claim_admin('ABCDEFGHJKLM', 'secret-token') ->> 'adopted',
  'false',
  'a claimant who already joined is promoted rather than adopting a row'
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

select * from finish();
rollback;
