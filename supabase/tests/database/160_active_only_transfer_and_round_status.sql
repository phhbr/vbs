begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-t@example.com'),
  ('a0000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'player-t@example.com'),
  ('a0000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'removed-t@example.com'),
  ('a0000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'elsewhere-t@example.com');

insert into sessions (id, code, admin_token_hash) values
  ('50000000-0000-0000-0000-0000000000d1', 'CDEFGHJKLMNU', 'hash'),
  ('50000000-0000-0000-0000-0000000000d2', 'CDEFGHJKLMNV', 'hash');
insert into participants (id, session_id, user_id, name, role, removed_at) values
  ('70000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-0000000000d1', 'TAdmin', 'admin', null),
  ('70000000-0000-0000-0000-0000000000d2', '50000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-0000000000d2', 'TPlayer', 'player', null),
  ('70000000-0000-0000-0000-0000000000d3', '50000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-0000000000d3', 'TRemoved', 'player', now()),
  ('70000000-0000-0000-0000-0000000000d4', '50000000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-0000000000d4', 'TElsewhere', 'admin', null);

-- A revealed round the removed participant voted in before being removed.
insert into rounds (id, session_id, round_number, story, attempt, status) values
  ('60000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-0000000000d1', 1, 'Removed voter', 1, 'revealed');
insert into votes (round_id, participant_id, value) values
  ('60000000-0000-0000-0000-0000000000d1', '70000000-0000-0000-0000-0000000000d3', '8');

-- ------------------------------------------------------------ transfer_admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select throws_ok(
  $$ select transfer_admin('70000000-0000-0000-0000-0000000000d3') $$,
  'VB009',
  'participant_not_found',
  'the chair cannot be handed to a removed participant'
);

select throws_ok(
  $$ select transfer_admin('70000000-0000-0000-0000-0000000000d4') $$,
  'VB008',
  'not_a_participant',
  'an admin of one session cannot promote someone in another — there, they are a stranger'
);

select is(
  transfer_admin('70000000-0000-0000-0000-0000000000d2') ->> 'participant_id',
  '70000000-0000-0000-0000-0000000000d2',
  'the admin can hand the chair to an active player'
);

reset role;
select results_eq(
  $$ select role from participants
      where id in ('70000000-0000-0000-0000-0000000000d1',
                   '70000000-0000-0000-0000-0000000000d2')
      order by name $$,
  $$ values ('player'), ('admin') $$,
  'the former admin (TAdmin) is a player, the promoted one (TPlayer) is admin'
);

select lives_ok(
  'set constraints all immediate',
  'the session still has exactly one admin'
);

-- -------------------------------------------------------------- round_status
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000d3","role":"authenticated"}';

select throws_ok(
  $$ select round_status('60000000-0000-0000-0000-0000000000d1') $$,
  'VB008',
  'not_a_participant',
  'a removed participant can no longer read round status'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

select is(
  (select p ->> 'name'
     from jsonb_array_elements(
       round_status('60000000-0000-0000-0000-0000000000d1') -> 'participants'
     ) p
    where p ->> 'participant_id' = '70000000-0000-0000-0000-0000000000d3'),
  'TRemoved',
  'round_status names every participant, including one removed after voting'
);

select is(
  (select p ->> 'value'
     from jsonb_array_elements(
       round_status('60000000-0000-0000-0000-0000000000d1') -> 'participants'
     ) p
    where p ->> 'participant_id' = '70000000-0000-0000-0000-0000000000d3'),
  '8',
  'a removed participant''s vote stays in the revealed round'
);

select * from finish();
rollback;
