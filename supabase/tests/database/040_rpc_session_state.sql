begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com');

insert into sessions (id, code, admin_token_hash, deck) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash', 'tshirt'),
  ('50000000-0000-0000-0000-000000000009', 'ZZZZZZZZZZZZ', 'hash', 'fibonacci');

update sessions set expires_at = now() - interval '1 minute'
 where code = 'ZZZZZZZZZZZZ';

insert into participants (session_id, user_id, name, role) values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player'),
  ('50000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003', 'Cy', 'admin');

-- ------------------------------------------------------------ member's view
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  session_state('ABCDEFGHJKLM') -> 'session' ->> 'code',
  'ABCDEFGHJKLM',
  'a member gets the session code back'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'session' ->> 'deck',
  'tshirt',
  'a member gets the deck'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'session' ->> 'participant_count',
  '2',
  'a member gets the participant count'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'session' ->> 'is_full',
  'false',
  'a session below the limit is not reported as full'
);

select is(
  session_state('ABCDEFGHJKLM') ->> 'is_member',
  'true',
  'a member is told they are a member'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'viewer' ->> 'role',
  'admin',
  'the viewer block carries the caller own role'
);

select is(
  jsonb_array_length(session_state('ABCDEFGHJKLM') -> 'participants'),
  2,
  'a member sees every participant'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'participants' -> 0 ->> 'name',
  'Ada',
  'participants come back in join order'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'participants' -> 0 ->> 'is_you',
  'true',
  'the caller is flagged in the participant list'
);

-- -------------------------------------------------------- non-member's view
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select is(
  session_state('ABCDEFGHJKLM') ->> 'is_member',
  'false',
  'a non-member is told they are not a member'
);

select is(
  session_state('ABCDEFGHJKLM') -> 'session' ->> 'participant_count',
  '2',
  'a non-member still learns how full the session is, to render the join screen'
);

select ok(
  session_state('ABCDEFGHJKLM') -> 'participants' = 'null'::jsonb,
  'a non-member never receives the participant list'
);

-- ------------------------------------------------------------------- gates
select throws_ok(
  $$ select session_state('ZZZZZZZZZZZZ') $$,
  'VB002',
  null,
  'an expired session is reported as session_expired'
);

reset role;
select * from finish();
rollback;
