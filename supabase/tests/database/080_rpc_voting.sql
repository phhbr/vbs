begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dee@example.com'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frank@example.com'),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gina@example.com'),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hank@example.com'),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ivy@example.com'),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'judy@example.com');

-- Session 1: fibonacci. Ada admin, Bob player, Cy spectator, Dee player who
-- has been switched off (can_vote = false). Frank is a stranger to it.
insert into sessions (id, code, admin_token_hash) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash');

insert into participants (id, session_id, user_id, name, role, can_vote) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin', true),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player', true),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Cy', 'spectator', true),
  ('70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Dee', 'player', false);

insert into rounds (id, session_id, round_number, story, attempt, status) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'Login redesign', 1, 'voting');

update sessions set current_round_id = '60000000-0000-0000-0000-000000000001'
 where id = '50000000-0000-0000-0000-000000000001';

-- Session 2: t-shirt. Gina admin, Hank and Ivy players.
insert into sessions (id, code, admin_token_hash, deck) values
  ('50000000-0000-0000-0000-000000000002', 'NPQRSTUVWXYZ', 'hash', 'tshirt');

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', 'Gina', 'admin'),
  ('70000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', 'Hank', 'player'),
  ('70000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000008', 'Ivy', 'player');

-- Session 3: expired, so its round can never be voted on.
insert into sessions (id, code, admin_token_hash, expires_at) values
  ('50000000-0000-0000-0000-000000000003', 'BCDEFGHJKLMN', 'hash', now() - interval '1 minute');

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000009', 'Judy', 'admin');

insert into rounds (id, session_id, round_number, story, attempt, status) values
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 1, 'Doomed story', 1, 'voting');

-- --------------------------------------------------------- eligibility & validation
set local role authenticated;

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select vote('60000000-0000-0000-0000-000000000001', '5') $$,
  'a player with can_vote can cast a vote'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select vote('60000000-0000-0000-0000-000000000001', '5') $$,
  'VB015',
  null,
  'a spectator voting is rejected as not_a_voter'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok(
  $$ select vote('60000000-0000-0000-0000-000000000001', '5') $$,
  'VB015',
  null,
  'a player with can_vote = false is rejected as not_a_voter'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select vote('60000000-0000-0000-0000-000000000001', 'XL') $$,
  'VB016',
  null,
  'a value outside the session deck is rejected as invalid_vote_value'
);

select throws_ok(
  $$ select reveal('60000000-0000-0000-0000-000000000001') $$,
  'VB006',
  null,
  'a player calling reveal is rejected as not_admin'
);

select throws_ok(
  $$ select vote('60000000-0000-0000-0000-000000000099', '5') $$,
  'VB013',
  null,
  'voting on an unknown round is rejected as round_not_found'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ select round_status('60000000-0000-0000-0000-000000000001') $$,
  'VB008',
  null,
  'round_status for a stranger is rejected as not_a_participant'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select vote('60000000-0000-0000-0000-000000000003', '5') $$,
  'VB002',
  null,
  'voting on a round in an expired session is rejected as session_expired'
);

-- ------------------------------------------------------- status before reveal
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (
    select jsonb_path_query_first(
      round_status('60000000-0000-0000-0000-000000000001') -> 'participants',
      '$[*] ? (@.participant_id == "70000000-0000-0000-0000-000000000002")'
    ) ->> 'value'
  ),
  '5',
  'round_status shows the caller their own value before reveal'
);

select is(
  (
    select jsonb_path_query_first(
      round_status('60000000-0000-0000-0000-000000000001') -> 'participants',
      '$[*] ? (@.participant_id == "70000000-0000-0000-0000-000000000001")'
    ) ->> 'voted'
  ),
  'false',
  'round_status reports voted = false for Ada, who has not voted yet'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select vote('60000000-0000-0000-0000-000000000001', '8') $$,
  'the admin can vote too'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (
    select jsonb_path_query_first(
      round_status('60000000-0000-0000-0000-000000000001') -> 'participants',
      '$[*] ? (@.participant_id == "70000000-0000-0000-0000-000000000001")'
    ) ->> 'value'
  ),
  null,
  $q$before reveal, Bob cannot see Ada's value even though she has voted$q$
);

-- ------------------------------------------------------------------- reveal
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  reveal('60000000-0000-0000-0000-000000000001') -> 'result',
  '{"type": "average", "value": "6.5", "consensus": false, "spread": {"min": 5, "max": 8}, "vote_count": 2}'::jsonb,
  'reveal computes the average, spread and consensus flag for a fibonacci round'
);

reset role;
select is(
  (select status from rounds where id = '60000000-0000-0000-0000-000000000001'),
  'revealed',
  'the round is marked revealed'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (
    select jsonb_path_query_first(
      round_status('60000000-0000-0000-0000-000000000001') -> 'participants',
      '$[*] ? (@.participant_id == "70000000-0000-0000-0000-000000000001")'
    ) ->> 'value'
  ),
  '8',
  $q$after reveal, Bob can see Ada's value too$q$
);

select throws_ok(
  $$ select vote('60000000-0000-0000-0000-000000000001', '5') $$,
  'VB014',
  null,
  'voting after reveal is rejected as round_not_voting'
);

select throws_ok(
  $$ select re_estimate('60000000-0000-0000-0000-000000000001') $$,
  'VB006',
  null,
  'a player calling re_estimate is rejected as not_admin'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (re_estimate('60000000-0000-0000-0000-000000000001') ->> 'attempt')::int,
  2,
  're_estimate starts the same story at attempt 2'
);

reset role;
select is(
  (select result from rounds where id = '60000000-0000-0000-0000-000000000001') is not null,
  true,
  'the earlier round keeps its result as history'
);

select is(
  (select count(*) from votes
    where round_id = (select current_round_id from sessions where id = '50000000-0000-0000-0000-000000000001')),
  0::bigint,
  'the new attempt starts with no votes'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select re_estimate(
       (select current_round_id from sessions where id = '50000000-0000-0000-0000-000000000001')
     ) $$,
  'VB017',
  null,
  're_estimate on a round that is still voting is rejected as round_not_revealed'
);

-- ------------------------------------------------------ consensus excludes PAUSE
reset role;
insert into rounds (id, session_id, round_number, story, attempt, status) values
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 3, 'Pause test', 1, 'voting');
insert into votes (round_id, participant_id, value) values
  ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '5'),
  ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', '5'),
  ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004', 'PAUSE');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  reveal('60000000-0000-0000-0000-000000000002') -> 'result',
  '{"type": "average", "value": "5.0", "consensus": true, "spread": null, "vote_count": 3}'::jsonb,
  'a PAUSE vote does not break consensus and is excluded from the average'
);

-- --------------------------------------------------------------- t-shirt deck
reset role;
insert into rounds (id, session_id, round_number, story, attempt, status) values
  ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000002', 1, 'Search page', 1, 'voting'),
  ('60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000002', 2, 'Search page', 2, 'voting');
insert into votes (round_id, participant_id, value) values
  ('60000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000006', 'M'),
  ('60000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000007', 'M'),
  ('60000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000008', 'S'),
  ('60000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000006', 'L'),
  ('60000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000007', 'L'),
  ('60000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000008', 'L');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';

select is(
  reveal('60000000-0000-0000-0000-000000000006') -> 'result',
  '{"type": "majority", "value": "M", "consensus": false, "spread": null, "vote_count": 3}'::jsonb,
  'reveal computes the majority size for a t-shirt round with no consensus'
);

select is(
  reveal('60000000-0000-0000-0000-000000000007') -> 'result',
  '{"type": "majority", "value": "L", "consensus": true, "spread": null, "vote_count": 3}'::jsonb,
  'a unanimous t-shirt round reports consensus with no spread'
);

reset role;
select * from finish();
rollback;
