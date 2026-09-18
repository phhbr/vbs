begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

insert into sessions (id, code, admin_token_hash) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash');

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin');

-- ---------------------------------------------------------------- presence
-- A member tracking their own presence is exactly what channel.track()
-- does client-side — the bug this migration fixes.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('session:50000000-0000-0000-0000-000000000001', 'presence', 'track', '{}'::jsonb, true) $$,
  'a member can publish presence on their own session channel'
);

-- A stranger to the session cannot, even for a real session id.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('session:50000000-0000-0000-0000-000000000001', 'presence', 'track', '{}'::jsonb, true) $$,
  '42501',
  null,
  'a stranger cannot publish presence on a session they are not in'
);

-- The policy is scoped to extension = 'presence' only — broadcast stays the
-- trigger's job exclusively, not something a client can do directly.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('session:50000000-0000-0000-0000-000000000001', 'broadcast', 'session_changed', '{"version":1}'::jsonb, true) $$,
  '42501',
  null,
  'a member cannot send a broadcast directly, only presence'
);

select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('not-a-channel-topic', 'presence', 'track', '{}'::jsonb, true) $$,
  '42501',
  null,
  'a malformed topic is rejected the same way a stranger would be'
);

reset role;
select * from finish();
rollback;
