begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-h@example.com'),
  ('a0000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'polling-h@example.com'),
  ('a0000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'removed-h@example.com'),
  ('a0000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger-h@example.com');

insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-0000000000c1', 'CDEFGHJKLMNT', 'hash');
insert into participants (id, session_id, user_id, name, role, removed_at) values
  ('70000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c1', 'HAdmin', 'admin', null),
  ('70000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c2', 'HPolling', 'player', null),
  ('70000000-0000-0000-0000-0000000000c3', '50000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c3', 'HRemoved', 'player', now());

create temp table before_heartbeat as
  select version, expires_at, last_activity_at
    from sessions where id = '50000000-0000-0000-0000-0000000000c1';
grant select on before_heartbeat to authenticated;

-- ------------------------------------------------------------- the polling
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select lives_ok(
  $$ select heartbeat('50000000-0000-0000-0000-0000000000c1') $$,
  'a participant can send a heartbeat'
);

reset role;
select isnt(
  (select last_seen_at from participants where id = '70000000-0000-0000-0000-0000000000c2'),
  null,
  'the heartbeat records when the participant was last seen'
);

-- Architecture rule 6: a heartbeat is not activity, and without a version
-- bump it also cannot set off a session_changed broadcast to everyone.
select results_eq(
  $$ select version, expires_at, last_activity_at
       from sessions where id = '50000000-0000-0000-0000-0000000000c1' $$,
  $$ select * from before_heartbeat $$,
  'a heartbeat touches neither version, expiry nor last activity'
);

-- --------------------------------------------------------- session_state
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select is(
  (select (p ->> 'seen_recently')::boolean
     from jsonb_array_elements(session_state('CDEFGHJKLMNT') -> 'participants') p
    where p ->> 'id' = '70000000-0000-0000-0000-0000000000c2'),
  true,
  'session_state reports a participant who just sent a heartbeat as seen recently'
);

select is(
  (select (p ->> 'seen_recently')::boolean
     from jsonb_array_elements(session_state('CDEFGHJKLMNT') -> 'participants') p
    where p ->> 'id' = '70000000-0000-0000-0000-0000000000c1'),
  false,
  'a participant who never sent a heartbeat is not seen recently'
);

reset role;
update participants set last_seen_at = now() - interval '16 seconds'
 where id = '70000000-0000-0000-0000-0000000000c2';

set local role authenticated;
select is(
  (select (p ->> 'seen_recently')::boolean
     from jsonb_array_elements(session_state('CDEFGHJKLMNT') -> 'participants') p
    where p ->> 'id' = '70000000-0000-0000-0000-0000000000c2'),
  false,
  'a heartbeat older than 15 seconds no longer counts'
);

-- ------------------------------------------------------------- refusals
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c3","role":"authenticated"}';

select throws_ok(
  $$ select heartbeat('50000000-0000-0000-0000-0000000000c1') $$,
  'VB008',
  'not_a_participant',
  'a removed participant cannot send a heartbeat'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c4","role":"authenticated"}';

select throws_ok(
  $$ select heartbeat('50000000-0000-0000-0000-0000000000c1') $$,
  'VB008',
  'not_a_participant',
  'a stranger cannot send a heartbeat for someone else''s session'
);

reset role;
select ok(
  not has_function_privilege('anon', 'heartbeat(uuid)', 'EXECUTE'),
  'anon cannot call heartbeat'
);

select * from finish();
rollback;
