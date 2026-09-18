begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dee@example.com'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frank@example.com');

insert into sessions (id, code, admin_token_hash) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash'),
  ('50000000-0000-0000-0000-000000000002', 'NPQRSTUVWXYZ', 'hash');

insert into sessions (id, code, admin_token_hash, expires_at) values
  ('50000000-0000-0000-0000-000000000003', 'BCDEFGHJKLMN', 'hash', now() - interval '1 minute');

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player'),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'Cy', 'admin'),
  ('70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'Dee', 'admin');

insert into rounds (id, session_id, round_number, story, attempt, status) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'Login redesign', 1, 'voting');

update sessions set current_round_id = '60000000-0000-0000-0000-000000000001'
 where id = '50000000-0000-0000-0000-000000000001';

-- ------------------------------------------------------- channel authorization
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(
  is_session_channel_member('session:50000000-0000-0000-0000-000000000001'),
  'a member of the session may read its channel'
);

select ok(
  not is_session_channel_member('session:50000000-0000-0000-0000-000000000002'),
  'a member of another session may not read this one''s channel'
);

select ok(
  not is_session_channel_member('session:50000000-0000-0000-0000-000000000003'),
  'a member of an expired session may not read its channel'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select ok(
  not is_session_channel_member('session:50000000-0000-0000-0000-000000000001'),
  'a stranger who guesses a valid session id gets nothing'
);

select ok(
  not is_session_channel_member('not-a-channel-topic'),
  'a topic that is not shaped like session:<uuid> is rejected'
);

select ok(
  not is_session_channel_member('session:not-a-real-uuid-but-36-characters-long'),
  'a topic with an unparseable id fails closed rather than erroring'
);

-- ---------------------------------------------------------------- session_state
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (session_state('ABCDEFGHJKLM') -> 'session' ->> 'id'),
  '50000000-0000-0000-0000-000000000001',
  'session_state reports the session id, for building the realtime topic'
);

select is(
  (session_state('ABCDEFGHJKLM') -> 'current_round' ->> 'story'),
  'Login redesign',
  'session_state includes the current round while one is voting'
);

select is(
  (session_state('ABCDEFGHJKLM') -> 'current_round' -> 'result'),
  null,
  'session_state.current_round carries no result of its own'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (session_state('NPQRSTUVWXYZ') -> 'current_round'),
  'null'::jsonb,
  'an idle session reports no current round'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is(
  (session_state('ABCDEFGHJKLM') -> 'current_round'),
  'null'::jsonb,
  'a non-member sees no current round even while one is voting'
);

reset role;
select * from finish();
rollback;
