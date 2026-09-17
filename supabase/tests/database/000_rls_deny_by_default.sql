begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- RLS is enabled on every M1 table, with no policies yet.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.sessions'::regclass),
  'sessions has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.participants'::regclass),
  'participants has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rounds'::regclass),
  'rounds has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.votes'::regclass),
  'votes has row level security enabled'
);

-- Concrete deny-by-default check on `sessions` (no FK dependencies, so the
-- simplest to seed): insert as the test's superuser session, which bypasses
-- RLS, then switch to `anon` and confirm every command is denied.
insert into sessions (code, admin_token_hash)
values ('TEST-0001', 'irrelevant-hash');

set local role anon;

select is_empty(
  $$ select * from sessions $$,
  'anon cannot read any row from sessions without a policy'
);

select throws_ok(
  $$ insert into sessions (code, admin_token_hash) values ('TEST-0002', 'x') $$,
  '42501',
  null,
  'anon cannot insert into sessions without a policy'
);

select * from finish();
rollback;
