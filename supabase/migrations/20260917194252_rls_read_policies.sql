-- M2: read access for participants of a live session. Still no write access to
-- any table from the client, and `votes` stays unreachable until M3.

-- One predicate defines visibility for the whole schema.
--
-- It has to be security definer: the obvious policy on `participants` ("you may
-- read participants of sessions you are in") must query `participants` to
-- answer that, and that subquery is subject to the same policy. Postgres bails
-- out with "infinite recursion detected in policy for relation participants".
-- A security definer function is not subject to the caller's RLS, so the
-- recursion is broken at exactly one place.
--
-- Folding the expiry check in here rather than repeating it per policy is what
-- makes architecture rule 6 hold everywhere by construction.
create function is_active_session_member(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.participants p
    join public.sessions s on s.id = p.session_id
    where p.session_id = p_session_id
      -- Wrapped in a sub-select so the planner evaluates it once per query as
      -- an InitPlan instead of once per row.
      and p.user_id = (select auth.uid())
      and s.expires_at > now()
  );
$$;

create policy sessions_read_for_members on sessions
  for select using (is_active_session_member(id));

create policy participants_read_for_members on participants
  for select using (is_active_session_member(session_id));

create policy rounds_read_for_members on rounds
  for select using (is_active_session_member(session_id));

-- `votes` deliberately gets no policy at all. RLS with zero policies denies
-- everything, which is the correct state until M3 introduces a policy that
-- exposes other people's values only after a reveal.

-- The split is: writes are blocked by grants, reads are governed by RLS.
--
-- No insert/update/delete policy exists anywhere, and config.toml's
-- auto_expose_new_tables hands out table grants automatically, so revoking them
-- makes "the frontend has no write access" a grant-level fact rather than a
-- policy-level one — it survives someone later adding a careless policy. The
-- RPCs are unaffected: they are security definer and run as owner.
--
-- SELECT grants are deliberately left alone so that every read decision lives
-- in one place. `votes` is unreadable because it has no policy, not because the
-- grant is missing, which is what lets M3 open it up by adding a policy alone.
revoke insert, update, delete on sessions from anon, authenticated;
revoke insert, update, delete on participants from anon, authenticated;
revoke insert, update, delete on rounds from anon, authenticated;
revoke insert, update, delete on votes from anon, authenticated;
