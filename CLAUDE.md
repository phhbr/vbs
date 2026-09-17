# Vorgangsbewertungsstelle (VBS)

Planning poker for agile teams, styled like an early-2000s gaming portal.
Public at `https://vbs.bruchner.dev`.

Language: everything in this repo — code, file names, comments, commits, docs,
and our conversation — is English. The **application UI is bilingual** (German
and English) from v1 via i18n; German is the source locale, English is a full
translation, neither is a stub.

## Stack

- `apps/web` — React 19 + Vite + TypeScript, React Router (`/`, `/s/:code`), TanStack Query
- `supabase/migrations` — schema, RLS policies, functions, pg_cron jobs, as SQL
- `supabase/tests` — pgTAP
- `packages/core` — generated DB types, deck definitions, pure display helpers
- `packages/ui` — components and design tokens
- Backend: Supabase (Postgres, anonymous auth, Realtime, pg_cron), Frankfurt region
- No Next.js, no Node server of our own. The VPS only serves static files via Caddy.

## Environment

MacBook with Apple Silicon (M4), zsh, pnpm, Docker through **Colima** (not Docker
Desktop). Colima must be running before the local Supabase stack, and the
Supabase CLI needs to find Colima's socket:

```bash
colima start                                          # or: colima start --cpu 4 --memory 8
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"   # put this in ~/.zshrc
docker context use colima                             # alternative to DOCKER_HOST
```

If `supabase start` cannot reach Docker, that socket is almost always the reason.
All images used must have arm64 builds; document any that do not.

## Commands

```bash
pnpm install
pnpm dev                 # Vite dev server
supabase start           # local Supabase (Colima must be up)
supabase db reset        # replay migrations + seeds
supabase test db         # pgTAP
pnpm test                # Vitest
pnpm test:e2e            # Playwright against local Supabase
pnpm lint && pnpm typecheck
pnpm gen:types           # supabase gen types typescript > packages/core/src/database.types.ts
```

## Architecture rules

1. **The database is the authority.** Every state change goes through a Postgres
   function (`security definer`) that checks role, phase, and expiry. The frontend
   has no write access to tables.
2. **Vote values stay secret until reveal.** RLS on `votes` exposes other people's
   values only when `rounds.status = 'revealed'`. Broadcast messages never carry
   values, just a change signal plus `sessions.version`. Any change to `votes` or
   its policies needs a pgTAP test covering this.
3. **Never enforce permissions in the UI alone.** Hiding admin buttons is fine as
   a convenience; the check belongs in the function.
4. **Schema changes only via migrations.** Nothing through the Supabase dashboard.
   Migrations are forward-compatible: deploy the database before the app.
5. **No secrets in the frontend.** Only `SUPABASE_URL` and the anon key (both
   public). The service-role key lives in Supabase secrets and CI only.
6. **Expiry:** every action sets `last_activity_at` and `expires_at = now() + 24h`.
   Presence heartbeats do not count as activity. Policies also check
   `expires_at > now()`.

## Session codes

12 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no `I`/`1`, no `O`/`0`,
so a code survives being read aloud or retyped from a screenshot. Generated
server-side by `generate_session_code()` from pgcrypto random bytes; clients
never supply a code. Stored canonically upper case and unique, with a check
constraint on the format. Lookups go through `normalize_session_code()`, which
strips anything outside the alphabet and upper-cases, so pasted codes with
dashes or spaces still resolve. The UI displays them grouped as `XXXX-XXXX-XXXX`
while URLs carry the bare 12 characters.

## Exactly one admin per session

Two mechanisms, because the two failure directions need different tools:

- **At most one** — a partial unique index over `participants (session_id)`
  restricted to admin rows. This is the one that holds under concurrency:
  simultaneous promotions serialise on the index, which a count-based check
  cannot do because it cannot see another transaction's uncommitted row. Unique
  indexes cannot be deferred, so every role swap **demotes before it promotes**.
- **At least one** — a `deferrable initially deferred` constraint trigger
  (`assert_session_has_admin`) that raises `VB010` unless the session has either
  zero participants or exactly one admin. Deferring to commit time is what lets
  a demote/promote pair pass on its end state. It also catches the case that has
  no function behind it: `participants.user_id` cascades from `auth.users`, so a
  deleted auth user would otherwise silently orphan a session.

In pgTAP, assert the passing cases with `lives_ok('set constraints all
immediate')` and the failing ones with the trigger switched to immediate first —
`throws_ok` cannot catch a failing `SET CONSTRAINTS`.

## RLS shape

Writes are blocked by **grants**, reads are governed by **RLS**. `insert`,
`update` and `delete` are revoked from `anon` and `authenticated` on every
table, so "the frontend has no write access" holds even if someone later adds a
careless policy. `select` grants are left in place so that every read decision
lives in exactly one place — a policy.

All read policies call one predicate, `is_active_session_member(session_id)`,
which answers membership and expiry together. It must be `security definer`: the
obvious policy on `participants` has to query `participants` to decide, and
Postgres rejects that with _infinite recursion detected in policy for relation
participants_. A security definer function is not subject to the caller's RLS,
which breaks the recursion at one controlled point. Inside it, `auth.uid()` is
wrapped in a sub-select so the planner evaluates it once per query rather than
once per row.

`votes` has no policy at all and is therefore unreadable; M3 opens it up by
adding a policy, not by changing grants.

## RPC functions

`create_session`, `join_session`, `vote`, `start_story`, `reveal`, `re_estimate`,
`new_story`, `set_deck`, `remove_participant`, `transfer_admin`, `claim_admin`,
`set_can_vote`, `round_status` (read-only; before reveal it returns only who has
voted, never values).

Every mutating function goes through `lock_live_session()`, which takes a row
lock on the session and raises on unknown or expired codes. The lock is what
serialises concurrent joins so the 50-participant limit cannot be overshot.
Afterwards they call `touch_session()`, which pushes `expires_at` out by 24
hours and bumps `sessions.version`.

## Error codes

Functions raise custom SQLSTATEs, which PostgREST passes through as
`error.code`, so the frontend maps a code to an i18n key without matching on
message text.

| Code    | Meaning           | Code    | Meaning                        |
| ------- | ----------------- | ------- | ------------------------------ |
| `VB001` | session_not_found | `VB007` | invalid_token                  |
| `VB002` | session_expired   | `VB008` | not_a_participant              |
| `VB003` | session_full      | `VB009` | participant_not_found          |
| `VB004` | nickname_taken    | `VB010` | admin_invariant (trigger only) |
| `VB005` | nickname_invalid  | `VB011` | not_authenticated              |
| `VB006` | not_admin         |         |                                |

## Roles

- **admin** — exactly one per session, the creator. Creates stories, reveals cards,
  triggers re-estimate, picks the deck, removes participants. Votes as well, which
  can be switched off via `can_vote`.
- **player** — votes, nothing else.
- **spectator** — watches; not counted in "x of y voted".

Admin recovery: `/s/<code>#admin=<token>`. The token travels only in the URL
fragment — never the path or query, so it stays out of server logs and
`Referer` headers — and the database stores only its SHA-256 hash. It is
returned exactly once, by `create_session`.

`claim_admin` has two paths, because the realistic case is a browser that lost
its anonymous session and is therefore a stranger to the session:

- **caller is not a participant** → the existing admin row is taken over,
  keeping its nickname. No ghost participant is left behind, no extra seat is
  used, and recovery still works on a full session.
- **caller is already a participant** → the old admin drops to player and the
  caller is promoted, the plain hand-over case.

Both `claim_admin` and `transfer_admin` **demote before they promote**: the
partial unique index on admin rows cannot be deferred, so the reverse order
would collide with the outgoing admin.

## i18n

- Two locales, `de` and `en`, both complete. German copy from the prototype is the
  source; see `docs/prototype/STYLE.md` for the original strings.
- Keys live with the feature, not in one giant file. No concatenated sentences;
  use interpolation so word order can differ per language.
- `<html lang>` follows the active locale. Locale choice persists per browser.
- Dates and numbers via `Intl`, never hand-formatted.

## Design and accessibility

- The look comes from `docs/prototype/`. `tokens.css` is binding, `STYLE.md`
  explains the patterns.
- Target is WCAG AAA: 7:1 for text, 44 × 44 px hit areas, visible focus, status
  always conveyed as text and not by color alone.
- A unit test checks every token pair for 7:1. New colors without a test are not allowed.
- Responsive from 360 px up. The prototype's fixed `min-width: 1040px` is not carried over.
- Real elements: `<button>`, `<a href>`, `<input>` with `<label>`, the card row as a
  `radiogroup`. No `onClick` on a `div` or `span`.
- No emoji as UI glyphs.

## Tests

New database functions and policies ship with pgTAP tests. Changes to the flow
(phases, reveal, re-estimate) ship with a Playwright test across multiple browser
contexts. CI runs lint, typecheck, Vitest, pgTAP, Playwright.

## The full plan

The implementation plan — reasoning, decision table, data model, diagrams,
milestones — lives in a Claude doc outside this repo. Export it as Markdown to
`docs/PLAN.md` to have it here too. Decisions from the plan that affect code but
are invisible in it belong in this file.

## Milestones

- **M1** Foundation: monorepo, CI, Vite app, local Supabase, base schema with RLS
- **M2** Sessions: anonymous auth, create and join by link, admin recovery
- **M3** Live voting: functions, broadcast triggers, presence, reconnect
- **M4** UI: retro look, responsive, light/dark, German and English, AAA checks
- **M5** Robustness: pg_cron expiry with warning, captcha, limits, remove participant
- **M6** Operations: staging and production, Caddy on the VPS, monitoring, E2E and load
