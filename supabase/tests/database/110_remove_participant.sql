begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-r@example.com'),
  ('a0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'player-r@example.com'),
  ('a0000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bystander-r@example.com');

insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-0000000000a1', 'CDEFGHJKLMNQ', 'hash');

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a1', 'RAdmin', 'admin'),
  ('70000000-0000-0000-0000-0000000000a2', '50000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a2', 'RPlayer', 'player'),
  ('70000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a3', 'RBystander', 'player');

insert into rounds (id, session_id, round_number, story, status)
values ('60000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-0000000000a1', 1, 'Removal story', 'revealed');
insert into votes (round_id, participant_id, value)
values ('60000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-0000000000a2', '5');

-- --------------------------------------------------------- a player cannot
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select throws_ok(
  $$ select remove_participant('70000000-0000-0000-0000-0000000000a2') $$,
  'VB006',
  null,
  'a non-admin caller is refused as not_admin'
);

-- --------------------------------------------------------------- admin only
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select throws_ok(
  $$ select remove_participant('70000000-0000-0000-0000-0000000000a1') $$,
  'VB023',
  null,
  'the admin cannot remove themselves'
);

select is(
  remove_participant('70000000-0000-0000-0000-0000000000a2') ->> 'participant_id',
  '70000000-0000-0000-0000-0000000000a2',
  'the admin removes a player'
);

reset role;
select isnt(
  (select removed_at from participants where id = '70000000-0000-0000-0000-0000000000a2'),
  null,
  'removed_at is set on the target row'
);

select is(
  (select count(*) from participants where session_id = '50000000-0000-0000-0000-0000000000a1'),
  3::bigint,
  'the row itself is kept, not hard-deleted'
);

select is(
  (select count(*) from votes where round_id = '60000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'the removed player''s vote survives in round history'
);

-- ------------------------------------------------------------- idempotency
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select throws_ok(
  $$ select remove_participant('70000000-0000-0000-0000-0000000000a2') $$,
  'VB009',
  null,
  'removing an already-removed participant is refused as participant_not_found'
);

select throws_ok(
  $$ select remove_participant('90000000-0000-0000-0000-000000000000') $$,
  'VB009',
  null,
  'removing an unknown participant id is refused as participant_not_found'
);

-- --------------------------------------------------- removed loses access
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is(
  is_active_session_member('50000000-0000-0000-0000-0000000000a1'),
  false,
  'a removed participant is no longer an active session member'
);

select throws_ok(
  $$ select round_status('60000000-0000-0000-0000-0000000000a1') $$,
  'VB008',
  null,
  'round_status refuses a removed participant as not_a_participant'
);

-- ----------------------------------------------------------- rejoin blocked
select throws_ok(
  $$ select join_session('CDEFGHJKLMNQ', 'RPlayer') $$,
  'VB019',
  null,
  'rejoining after removal is refused as participant_removed, not a silent rejoin'
);

-- ---------------------------------------------- nickname freed for reuse
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
-- RBystander leaves so the vacated "RPlayer" nickname can be claimed by
-- someone new, proving the unique index no longer blocks removed rows.
select is(
  leave_session('CDEFGHJKLMNQ') ->> 'session_ended',
  'false',
  'a non-admin bystander leaving hands nothing off'
);

reset role;
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'newcomer-r@example.com');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000a4","role":"authenticated"}';

select is(
  join_session('CDEFGHJKLMNQ', 'RPlayer') ->> 'role',
  'player',
  'a freed nickname can be claimed by a new joiner'
);

reset role;
select is(
  (select count(*) from participants where session_id = '50000000-0000-0000-0000-0000000000a1' and removed_at is null),
  2::bigint,
  'exactly the admin and the new joiner are active afterwards'
);

select * from finish();
rollback;
