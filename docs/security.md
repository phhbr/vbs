# Security review — M5

A pass over grants, RLS, and the abuse-cost mechanisms added in M5, done by
reading every migration and verifying claims empirically (querying
`has_function_privilege` directly, and confirming pgTAP fails the way each
finding predicts) rather than by inspection alone. Two things below only
became clear that way — see "Corrected during this review."

## Risk and mitigation

| Area | Risk | Mitigation | Status |
| --- | --- | --- | --- |
| Table writes | A client inserts/updates/deletes a row directly, bypassing every function's role/phase/expiry checks. | `insert`/`update`/`delete` revoked from `anon`/`authenticated` on every table (`sessions`, `participants`, `rounds`, `votes`, `rate_limit_events`); only `security definer` functions, owned by `postgres`, can write. | Closed |
| Table reads | A client reads another session's rows, or another participant's vote before reveal. | RLS, gated by one predicate (`is_active_session_member`) reused by every policy and by the realtime channel policy, so the rule can't drift between places. `votes` additionally requires `can_read_vote` (own row, or round revealed). | Closed |
| Function grants | A function meant only as an internal helper turns out to still be directly callable, because Postgres grants `EXECUTE` on a new function to `PUBLIC` unless revoked. | Every function audited (see below). Six helpers were missing their revoke; three of those turned out to be load-bearing and were *not* revoked (see "Corrected during this review"). A pgTAP file (`140_grants_audit.sql`) now asserts both the closed and the deliberately-open cases, so this can't silently regress. | Closed for the real gaps; the remaining "open" cases are the load-bearing ones, documented as intentional |
| `search_path` | A function resolves an identifier against a schema an attacker controls (schema-search-path injection). | Every function in every migration declares `set search_path = ''`, checked directly against every `create function`/`create or replace function` in the repo — no exceptions. | Closed |
| Session code guessing | A script tries codes until one exists. | 12 characters from a 32-symbol alphabet = 60 bits of entropy (`32^12 ≈ 1.15 × 10^18` codes); combined with the join cooldown below and Supabase's own per-IP rate limit on anonymous sign-ins, brute-forcing a live code is not practical. | Mitigated (mathematically, not just procedurally) |
| Join-code cooldown bypass | `record_join_failure()` is a separate call from `join_session()` (see CLAUDE.md's Rate limits section for why — a function that raises can't also persist a record of its own failure). A client that calls `join_session()` directly, skipping `record_join_failure()`, never trips the 5-per-5-minutes cooldown. | The cooldown is one layer among several (code entropy above, Supabase's per-IP anonymous sign-in limit, Turnstile). Not closable without an autonomous-transaction mechanism (`dblink`/`pg_background`), which was judged not worth the added credential-handling surface for this layer specifically. | **Open — accepted trade-off**, written up in CLAUDE.md |
| Session/vote/creation rate limits | A script hammers `create_session` or `vote`. | `assert_rate_limit()` checks-then-records in the same successful call (unlike the join case, these don't need to survive a failure), enforced inside `create_session`/`vote` themselves — no client cooperation required. | Closed |
| Unlimited anonymous accounts | A script signs up fresh anonymous users to route around any per-user limit above. | Turnstile on anonymous sign-in (staging/production only — see CLAUDE.md's Captcha section) plus Supabase's own `auth.rate_limit` for anonymous sign-ins per IP. | Mitigated, not fully closable from inside this repo — Turnstile's server-side toggle lives in the Supabase Dashboard, outside version control |
| Admin recovery token | The token leaks via logs, `Referer` headers, browser history, or a screenshot of the app itself. | Travels only in the URL fragment (`#admin=...`), never sent to the server on the initial request and never in a `Referer` header; only its SHA-256 hash is stored; returned exactly once by `create_session`. As of the design revision, also expires after 24 hours and is single-use — `claim_admin` rotates the hash to an unreturned value on acceptance, so a leaked link stops working the moment it's used once, and `regenerate_admin_token` is how the admin gets a working one again. The UI-level leak this closes: `AdminRecoveryNotice` previously rendered the full URL as visible `<code>` text, which is exactly how a real link leaked into a screenshot during this review — it now shows only the session code, never the URL. | Closed |
| Expiry as a cleanup boundary | A session or an abandoned anonymous user lingers indefinitely. | `expire_stale_sessions()` every 15 minutes (broadcasts `session_expired` before deleting, so an open tab finds out); `cleanup_abandoned_anonymous_users()` daily for `auth.users` rows over 7 days old with no participant row left. | Closed |

## Corrected during this review

Six functions (`normalize_session_code`, `is_active_session_member`,
`can_read_vote`, `is_session_channel_member`, plus the two trigger functions
`assert_session_has_admin`/`broadcast_session_version`) had no explicit
`revoke execute` statement and were therefore still callable by `anon`/
`authenticated` by default. The first instinct was to revoke all six to
match every other internal helper in this schema.

That would have been wrong for three of them.
`is_active_session_member`, `can_read_vote`, and `is_session_channel_member`
are each referenced directly inside a `using (...)` RLS or realtime policy
expression, and a policy expression is evaluated in the *querying* role's
own privileges — unlike a call from inside another `security definer`
function's body, which runs as that function's owner regardless of who
invoked it. Revoking `EXECUTE` on these three broke every read in the app
(confirmed by running the full pgTAP suite against the draft migration: `42501:
permission denied for function is_active_session_member`, raised from
inside the policy itself, on session/participant/round/vote reads and on
realtime presence). They were left grantable, and `140_grants_audit.sql`
now pins both the three closed cases and the three intentionally-open ones,
so a future change can't get this backwards again without a test failing.

The other three (`normalize_session_code` and the two trigger functions)
are never referenced in a policy — only called from inside other
`security definer` functions' bodies, or (for the triggers) invoked solely
by the trigger mechanism, which Postgres restricts from direct SQL calls
regardless of grants. Revoking those was safe and is now in place.

## Not fully closed

- **Join-code cooldown bypass** (above) — accepted, layered mitigation
  rather than a hard guarantee.
- **Unlimited anonymous accounts routing around per-user limits** (above) —
  mitigated by Turnstile and Supabase's own IP-based limit, neither of
  which this repo can enforce or verify on its own; Turnstile's server-side
  configuration must be checked manually on the live project.
