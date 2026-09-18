begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cy@example.com');

insert into sessions (id, code, admin_token_hash) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash'),
  ('50000000-0000-0000-0000-000000000002', 'NPQRSTUVWXYZ', 'hash');

update sessions set expires_at = now() - interval '1 minute'
 where id = '50000000-0000-0000-0000-000000000002';

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player');

-- -------------------------------------------------------------- authorization
set local role authenticated;

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select start_story('ABCDEFGHJKLM', 'Login redesign') $$,
  'VB006',
  null,
  'a player calling start_story is rejected as not_admin'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select start_story('ABCDEFGHJKLM', 'Login redesign') $$,
  'VB008',
  null,
  'a stranger calling start_story is rejected as not_a_participant'
);

select throws_ok(
  $$ select start_story('NPQRSTUVWXYZ', 'Story') $$,
  'VB002',
  null,
  'starting a story on an expired session is rejected as session_expired'
);

-- ---------------------------------------------------------------- happy path
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (start_story('ABCDEFGHJKLM', '  Login redesign  ') ->> 'round_number')::int,
  1,
  'the first round of a session is numbered 1'
);

reset role;
select is(
  (select story from rounds where session_id = '50000000-0000-0000-0000-000000000001'),
  'Login redesign',
  'the title is trimmed before storing'
);

select is(
  (select attempt from rounds where session_id = '50000000-0000-0000-0000-000000000001'),
  1,
  'a fresh story starts at attempt 1'
);

select is(
  (select status from rounds where session_id = '50000000-0000-0000-0000-000000000001'),
  'voting',
  'the new round is voting'
);

select is(
  (select current_round_id from sessions where id = '50000000-0000-0000-0000-000000000001'),
  (select id from rounds where session_id = '50000000-0000-0000-0000-000000000001'),
  'the session points at the new round'
);

-- ------------------------------------------------------------- while voting
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select start_story('ABCDEFGHJKLM', 'Second story') $$,
  'VB012',
  null,
  'starting a second story while one is voting is rejected as round_in_progress'
);

select throws_ok(
  $$ select set_deck('ABCDEFGHJKLM', 'tshirt') $$,
  'VB012',
  null,
  'changing the deck while a round is voting is rejected as round_in_progress'
);

select throws_ok(
  $$ select new_story('ABCDEFGHJKLM') $$,
  'VB012',
  null,
  'clearing the story while a round is voting is rejected as round_in_progress'
);

select throws_ok(
  $$ select start_story('ABCDEFGHJKLM', '   ') $$,
  'VB018',
  null,
  'a blank title is rejected as invalid_story'
);

select throws_ok(
  $$ select start_story('ABCDEFGHJKLM', repeat('x', 201)) $$,
  'VB018',
  null,
  'a title over 200 characters is rejected as invalid_story'
);

select throws_ok(
  $$ select set_deck('ABCDEFGHJKLM', 'planning') $$,
  '22023',
  null,
  'an unknown deck name is rejected'
);

-- -------------------------------------------------------------- once revealed
-- reveal() lands in the next migration; simulate its end state directly.
reset role;
update rounds set status = 'revealed', revealed_at = now()
 where session_id = '50000000-0000-0000-0000-000000000001' and round_number = 1;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select set_deck('ABCDEFGHJKLM', 'tshirt') $$,
  'the deck can change once the round is revealed'
);

reset role;
select is(
  (select deck from sessions where id = '50000000-0000-0000-0000-000000000001'),
  'tshirt',
  'set_deck persisted the new deck'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (start_story('ABCDEFGHJKLM', 'Second story') ->> 'round_number')::int,
  2,
  'a brand new story still gets the next round_number, not attempt 2'
);

reset role;
select is(
  (select count(*) from rounds where session_id = '50000000-0000-0000-0000-000000000001'),
  2::bigint,
  'the earlier, revealed round stays in the table as history'
);

update rounds set status = 'revealed', revealed_at = now()
 where session_id = '50000000-0000-0000-0000-000000000001' and round_number = 2;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select new_story('ABCDEFGHJKLM') $$,
  'new_story succeeds once the round is revealed'
);

reset role;
select is(
  (select current_round_id from sessions where id = '50000000-0000-0000-0000-000000000001'),
  null,
  'new_story clears the current round pointer, leaving the session idle'
);

select * from finish();
rollback;
