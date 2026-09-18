-- M5 point 13: a full pass over every function's grants (docs/security.md
-- has the write-up) turned up internal helpers that were never explicitly
-- revoked and were therefore still executable by anon and authenticated by
-- default — Postgres grants EXECUTE on a new function to PUBLIC unless
-- revoked, the same reason every other helper in this schema already
-- carries a revoke statement.
--
-- normalize_session_code is a pure string transform called only from other
-- functions' bodies (lock_live_session, session_state, join_session), never
-- from a policy, so it can be closed off like every other internal helper.
revoke execute on function normalize_session_code(text) from public, anon, authenticated;

-- is_active_session_member, can_read_vote and is_session_channel_member
-- looked like the same case, but are NOT: all three are referenced directly
-- in a `using (...)` policy expression (on sessions/participants/rounds,
-- votes, and realtime.messages respectively), and a policy expression is
-- evaluated in the *querying* role's own privileges, not the function
-- owner's — unlike a call from inside another SECURITY DEFINER function's
-- body, which runs as that function's owner regardless of who invoked it.
-- Revoking these actually broke every read (confirmed via pgTAP before this
-- migration was finalised: "permission denied for function
-- is_active_session_member" from inside the RLS policy itself). They stay
-- executable by anon/authenticated; being directly callable as a bare RPC
-- too is an accepted, low-risk trade-off — each just returns a boolean
-- about the caller's own membership, never another participant's data.
--
-- Trigger functions can only ever be invoked by their trigger (Postgres
-- rejects a direct call with "trigger functions can only be called as
-- triggers"), so revoking these closes API-surface hygiene — PostgREST no
-- longer lists them as callable-looking RPCs — rather than a real gap.
revoke execute on function assert_session_has_admin() from public, anon, authenticated;
revoke execute on function broadcast_session_version() from public, anon, authenticated;
