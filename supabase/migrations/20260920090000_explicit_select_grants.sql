-- The select grants this schema has always assumed, made explicit.
--
-- 20260917194252_rls_read_policies.sql revoked insert/update/delete and
-- deliberately left select alone, so that every read decision would live in
-- exactly one place — a policy. That only ever worked because the table
-- grants were *inherited*: the local stack's `alter default privileges in
-- schema public ... to anon, authenticated` hands select to both roles on
-- every new table, so `supabase db reset` produced readable tables and the
-- whole pgTAP suite passed.
--
-- Hosted projects created recently no longer carry that default — their
-- public-schema default ACL for anon/authenticated is `Dxtm` (truncate,
-- references, trigger, maintain) with no `r`. So in production the read
-- policies were attached to tables nobody could select from, and the one
-- place the frontend reads a table directly rather than through an RPC —
-- fetchRoundHistory's `from("rounds")` — came back as "permission denied
-- for table rounds", which supabase-js surfaces as an error the history
-- tab renders as its empty state. Every other screen kept working because
-- it goes through a security definer RPC, which runs as owner.
--
-- Granting explicitly is what makes local and production agree, and turns
-- an inherited default into a stated decision. Both roles get it, as the
-- original revoke assumed: the policies all key off auth.uid(), so anon
-- sees zero rows regardless, and keeping the grants uniform preserves the
-- property that a read is denied by a *missing policy*, never by a missing
-- grant. `votes` stays readable-but-policied for exactly that reason, and
-- `rate_limit_events`, whose select was revoked on purpose, stays out.
grant select on sessions to anon, authenticated;
grant select on participants to anon, authenticated;
grant select on rounds to anon, authenticated;
grant select on votes to anon, authenticated;
