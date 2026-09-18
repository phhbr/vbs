begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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

select * from finish();
rollback;
