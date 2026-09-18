begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'creator-c@example.com'),
  ('a0000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'joiner-c@example.com'),
  ('a0000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'voter-c@example.com'),
  ('a0000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retry-c@example.com');

-- ---------------------------------------------------- session creation cap
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select lives_ok(
  $$ select create_session('Rep' || i) from generate_series(1, 10) i $$,
  'the 10th session in an hour for one user is allowed'
);

select throws_ok(
  $$ select create_session('Eleventh') $$,
  'VB020',
  null,
  'the 11th session in the same hour is refused as session_create_rate_limited'
);

-- ------------------------------------------------------------ join cooldown
reset role;
insert into sessions (id, code, admin_token_hash)
values ('50000000-0000-0000-0000-0000000000c1', 'CDEFGHJKLMNT', 'hash');
insert into participants (session_id, user_id, name, role)
values ('50000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c1', 'Creator', 'admin');

-- Four prior failures seeded directly, so the boundary (5th real attempt
-- still refused as session_not_found, 6th tripping the cooldown) is what
-- join_session itself is left to prove, rather than five near-identical
-- assertions. record_join_failure() is exercised directly below — it is
-- what a real client calls after catching VB001/VB002, since join_session
-- cannot record its own failure (see the migration's comment: the whole
-- call's transaction rolls back with it).
insert into rate_limit_events (user_id, kind)
select 'a0000000-0000-0000-0000-0000000000c2', 'join_failed'
  from generate_series(1, 4);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select throws_ok(
  $$ select join_session('MMMMMMMMMMMM', 'X') $$,
  'VB001',
  null,
  'the 5th bad-code attempt still reports session_not_found, not the cooldown'
);

select lives_ok(
  $$ select record_join_failure() $$,
  'the client records that 5th failure as its own, separate, successful call'
);

reset role;
select is(
  (select count(*) from rate_limit_events
    where user_id = 'a0000000-0000-0000-0000-0000000000c2' and kind = 'join_failed'),
  5::bigint,
  'five join_failed events are now on record for that user'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c2","role":"authenticated"}';

select throws_ok(
  $$ select join_session('MMMMMMMMMMMM', 'X') $$,
  'VB021',
  null,
  'the 6th bad-code attempt within 5 minutes is refused as join_rate_limited'
);

-- A nickname retry (VB004) never counts toward the cooldown, and does not
-- itself get blocked by it.
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c4","role":"authenticated"}';

select throws_ok(
  $$ select join_session('CDEFGHJKLMNT', 'Creator') $$,
  'VB004',
  null,
  'a taken nickname is refused as nickname_taken, not counted as a cooldown failure'
);

select is(
  join_session('CDEFGHJKLMNT', 'Retry') ->> 'role',
  'player',
  'the same user can still join immediately after a nickname_taken retry'
);

-- ------------------------------------------------------------- vote cap
reset role;
insert into participants (session_id, user_id, name, role)
values ('50000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c3', 'Voter', 'player');
insert into rounds (id, session_id, round_number, story, status)
values ('60000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-0000000000c1', 1, 'Rate limit story', 'voting');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-0000000000c3","role":"authenticated"}';

select lives_ok(
  $$ select vote('60000000-0000-0000-0000-0000000000c1', '5') from generate_series(1, 10) $$,
  'the 10th vote in 10 seconds for one participant is allowed'
);

select throws_ok(
  $$ select vote('60000000-0000-0000-0000-0000000000c1', '8') $$,
  'VB022',
  null,
  'the 11th vote within the window is refused as vote_rate_limited'
);

reset role;
select is(
  (select value from votes
    where round_id = '60000000-0000-0000-0000-0000000000c1'
      and participant_id = (
        select id from participants
         where session_id = '50000000-0000-0000-0000-0000000000c1'
           and user_id = 'a0000000-0000-0000-0000-0000000000c3'
      )),
  '5',
  'the vote value itself still reflects the last accepted change'
);

select * from finish();
rollback;
