begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com');

insert into sessions (id, code, admin_token_hash) values
  ('50000000-0000-0000-0000-000000000001', 'ABCDEFGHJKLM', 'hash');

insert into participants (id, session_id, user_id, name, role) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ada', 'admin'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bob', 'player');

insert into rounds (id, session_id, round_number, story) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'Login redesign');

insert into votes (round_id, participant_id, value) values
  ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '5'),
  ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '8');

-- --------------------------------------------------------- during voting
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*) from votes),
  1::bigint,
  'a participant sees exactly one vote row while the round is voting: their own'
);

select is(
  (select value from votes where participant_id = '70000000-0000-0000-0000-000000000002'),
  '8',
  'that one row is their own value'
);

select is_empty(
  $$ select * from votes where participant_id = '70000000-0000-0000-0000-000000000001' $$,
  'another participant''s vote row does not appear at all before reveal'
);

-- -------------------------------------------------------------- after reveal
reset role;
update rounds set status = 'revealed', revealed_at = now() where id = '60000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*) from votes),
  2::bigint,
  'once revealed, a participant sees both vote rows'
);

select is(
  (select value from votes where participant_id = '70000000-0000-0000-0000-000000000001'),
  '5',
  'the other participant''s value is now visible'
);

-- ------------------------------------------------------------------ write bans
select throws_ok(
  $$ insert into votes (round_id, participant_id, value)
     values ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '13') $$,
  '42501',
  null,
  'a participant cannot insert a vote directly'
);

reset role;

-- ---------------------------------------------------------- new round columns
select is(
  (select attempt from rounds where id = '60000000-0000-0000-0000-000000000001'),
  1,
  'attempt defaults to 1'
);

select throws_ok(
  $$ update rounds set attempt = 0 where id = '60000000-0000-0000-0000-000000000001' $$,
  '23514',
  null,
  'attempt must be at least 1'
);

select is(
  (select result from rounds where id = '60000000-0000-0000-0000-000000000001'),
  null,
  'result stays null until reveal writes it'
);

select * from finish();
rollback;
