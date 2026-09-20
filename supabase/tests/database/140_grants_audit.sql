begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ------------------------------------------------ internal helpers, closed
-- Postgres grants EXECUTE on a new function to PUBLIC unless revoked, so
-- these assert the revoke actually happened rather than trusting the
-- migration ran — the same class of gap this file exists to catch early.
select ok(
  not has_function_privilege('anon', 'normalize_session_code(text)', 'EXECUTE'),
  'anon cannot call normalize_session_code directly'
);

select ok(
  not has_function_privilege('authenticated', 'normalize_session_code(text)', 'EXECUTE'),
  'authenticated cannot call normalize_session_code directly'
);

select ok(
  not has_function_privilege('anon', 'assert_session_has_admin()', 'EXECUTE'),
  'anon cannot call the admin-invariant trigger function directly'
);

select ok(
  not has_function_privilege('anon', 'broadcast_session_version()', 'EXECUTE'),
  'anon cannot call the broadcast trigger function directly'
);

select ok(
  not has_function_privilege('anon', 'active_participant(uuid,uuid)', 'EXECUTE'),
  'anon cannot call active_participant directly'
);

select ok(
  not has_function_privilege('anon', 'assert_rate_limit(uuid,text,interval,integer,text)', 'EXECUTE'),
  'anon cannot call assert_rate_limit directly'
);

-- --------------------------------------------- policy-evaluated, must stay
-- These three are referenced directly in a `using (...)` RLS/realtime
-- policy expression, which Postgres evaluates in the *querying* role's own
-- privileges — revoking these breaks every read, not just direct RPC
-- calls. Confirmed the hard way while writing this migration.
select ok(
  has_function_privilege('authenticated', 'is_active_session_member(uuid)', 'EXECUTE'),
  'authenticated keeps execute on is_active_session_member — every read policy calls it'
);

select ok(
  has_function_privilege('authenticated', 'can_read_vote(uuid,uuid)', 'EXECUTE'),
  'authenticated keeps execute on can_read_vote — the votes read policy calls it'
);

select ok(
  has_function_privilege('authenticated', 'is_session_channel_member(text)', 'EXECUTE'),
  'authenticated keeps execute on is_session_channel_member — the realtime policy calls it'
);

-- ------------------------------------------------------- table read grants
-- The counterpart to the policy checks above: a read policy is only worth
-- something if the role can select from the table at all. These grants were
-- inherited from the local stack's default privileges until
-- 20260920090000_explicit_select_grants.sql stated them, and a hosted
-- project created after that default changed hands out no select at all —
-- which is how the round history tab shipped reading `permission denied`
-- as "no rounds played yet".
--
-- Run locally these pass either way, inherited or granted, so they do not
-- by themselves catch that drift; the migration is what fixes it. What they
-- lock down is the requirement, so removing the grant is a failing test
-- rather than a silent regression, and they are the check to point at a
-- deployed database when a read comes back empty.
select ok(
  has_table_privilege('authenticated', 'public.sessions', 'SELECT'),
  'authenticated can select from sessions — its read policy decides the rest'
);

select ok(
  has_table_privilege('authenticated', 'public.participants', 'SELECT'),
  'authenticated can select from participants — its read policy decides the rest'
);

select ok(
  has_table_privilege('authenticated', 'public.rounds', 'SELECT'),
  'authenticated can select from rounds — fetchRoundHistory reads it directly'
);

select ok(
  has_table_privilege('authenticated', 'public.votes', 'SELECT'),
  'authenticated can select from votes — can_read_vote decides the rest'
);

-- rate_limit_events is the deliberate exception: its select was revoked
-- outright, so it must stay unreadable by both roles.
select ok(
  not has_table_privilege('anon', 'public.rate_limit_events', 'SELECT'),
  'anon cannot select from rate_limit_events'
);

select ok(
  not has_table_privilege('authenticated', 'public.rate_limit_events', 'SELECT'),
  'authenticated cannot select from rate_limit_events'
);

select * from finish();
rollback;
