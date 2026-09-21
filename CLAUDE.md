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

## Expiry

Two `pg_cron` jobs, both calling a single-purpose SQL function rather than
embedding logic in the cron body, so pgTAP can call the same function
directly instead of waiting on the scheduler:

- **`expire-stale-sessions`**, every 15 minutes, calls
  `expire_stale_sessions()`. For every session past `expires_at`, it
  broadcasts `session_expired` on that session's realtime channel (payload
  carries no session data, same discipline as `session_changed`) and only
  then deletes the row, so `participants`/`rounds`/`votes` cascade away in
  one transaction per session. The broadcast happens first because the
  delete removes the only place a version bump could have been recorded —
  without an explicit event, a client with the tab open would have nothing
  to react to.
- **`cleanup-abandoned-anonymous-users`**, daily, calls
  `cleanup_abandoned_anonymous_users()`. Deletes anonymous `auth.users` rows
  created more than 7 days ago with no remaining `participants` row. There
  is no surviving timestamp for "when did this user last belong to a
  session" — that row is gone by the time a session's cascade runs — so
  "anonymous, unreferenced, and old enough" is the closest available proxy.

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
`new_story`, `set_deck`, `remove_participant`, `leave_session`, `transfer_admin`,
`claim_admin`, `regenerate_admin_token`, `set_can_vote`, `record_join_failure`,
`round_status` (read-only; before reveal it returns only who has voted, never
values).

Every mutating function goes through `lock_live_session()`, which takes a row
lock on the session and raises on unknown or expired codes. The lock is what
serialises concurrent joins so the 50-participant limit cannot be overshot.
Afterwards they call `touch_session()`, which pushes `expires_at` out by 24
hours and bumps `sessions.version`.

Round-scoped functions (`vote`, `reveal`, `re_estimate`) lock the round instead,
through `lock_active_round()`. That row lock is what stops a vote from landing
after reveal: both functions take it before checking `rounds.status`, so
whichever call reaches it first commits its status change (or its insert), and
the other blocks, re-reads the now-committed status, and finds it no longer
`voting`. A vote arriving that way fails with `VB014`, not silently.

## Rounds

`rounds.round_number` is a session-wide sequence — every round ever started in
a session gets the next number, which is what the footer's "Round: N" shows.
`rounds.attempt` is scoped to one story: it starts at 1 with `start_story` and
increments with `re_estimate`, so re-estimating the same story produces a new
`rounds` row with a new `round_number` but `attempt + 1`, while the previous
round and its `result` stay in place as history. `sessions.current_round_id`
points at the live round; null means idle.

## Realtime

One private channel per session, topic `session:<session id>`. A trigger on
`sessions` fires whenever `version` changes — which every mutating function
causes, through `touch_session()` — and broadcasts `session_changed` with the
new version as its only payload. No vote value, no participant name, nothing
but the counter: clients refetch through `session_state`/`round_status` on
receiving it rather than trusting the payload for anything.

Authorization lives on `realtime.messages`, the same shape as the table
policies: one predicate, `is_session_channel_member()`, reusing
`is_active_session_member()` so the two can never drift apart.

Broadcasts need no insert policy — only the trigger publishes them, running
as the function owner rather than through a grant. Presence is different:
`channel.track()` runs as the client, so it inserts through the client's own
role and needs its own policy, scoped to `extension = 'presence'` so it
can't be used to send an arbitrary broadcast. Missing this in the first cut
meant every `track()` call failed silently (a `phx_reply` error visible only
in the websocket frames) and presence never worked at all.

## Error codes

Functions raise custom SQLSTATEs, which PostgREST passes through as
`error.code`, so the frontend maps a code to an i18n key without matching on
message text.

| Code    | Meaning                        |
| ------- | ------------------------------ |
| `VB001` | session_not_found              |
| `VB002` | session_expired                |
| `VB003` | session_full                   |
| `VB004` | nickname_taken                 |
| `VB005` | nickname_invalid               |
| `VB006` | not_admin                      |
| `VB007` | invalid_token                  |
| `VB008` | not_a_participant              |
| `VB009` | participant_not_found          |
| `VB010` | admin_invariant (trigger only) |
| `VB011` | not_authenticated              |
| `VB012` | round_in_progress              |
| `VB013` | round_not_found                |
| `VB014` | round_not_voting               |
| `VB015` | not_a_voter                    |
| `VB016` | invalid_vote_value             |
| `VB017` | round_not_revealed             |
| `VB018` | invalid_story                  |
| `VB019` | participant_removed            |
| `VB020` | session_create_rate_limited    |
| `VB021` | join_rate_limited              |
| `VB022` | vote_rate_limited              |
| `VB023` | cannot_remove_admin            |

## Roles

- **admin** — exactly one per session, the creator. Creates stories, reveals cards,
  triggers re-estimate, picks the deck, removes participants. Votes as well, which
  can be switched off via `can_vote`.
- **player** — votes, nothing else.
- **spectator** — watches; not counted in "x of y voted".

Admin recovery: `/s/<code>#admin=<token>`. The token travels only in the URL
fragment — never the path or query, so it stays out of server logs and
`Referer` headers — and the database stores only its SHA-256 hash. It is
returned exactly once, by `create_session`, expires 24 hours after minting
(`sessions.admin_token_expires_at`), and is single-use: `claim_admin` rotates
`admin_token_hash` to a fresh, never-returned value the instant it accepts a
token, so a second attempt with the same one — a genuine reuse or a link that
leaked further — fails exactly like a wrong token, `VB007`. A found-in-a-
screenshot recovery link is the design revision's motivating case for this.
`regenerate_admin_token` is how the current admin gets a working link again;
there is no "show it again" path even in principle, since the database never
held anything but the hash.

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

## Removing and leaving

`participants.removed_at` is a soft delete, shared by `remove_participant`
(admin only, cannot target the admin) and `leave_session` (voluntary) — a
hard delete would cascade and take the participant's past votes with it,
and those must stay in round history. Every membership check, the
50-participant cap, and the per-session nickname uniqueness index all
filter on `removed_at is null`, so a removed or left participant is
immediately excluded everywhere and their nickname is free for someone
else to take. `join_session` distinguishes a removed row from an ordinary
"already joined" one and refuses with `VB019` rather than silently
reviving membership — a removed participant gets a "you were removed"
screen on their next visit, not a rejoin.

When the admin leaves via `leave_session`, the chair passes to the
remaining active participant with the earliest `joined_at` — the
longest-present one, not an arbitrary or most-recent one. If nobody is
left, the session ends outright (the row is deleted, cascading like
expiry does) rather than sitting around adminless. Like
`claim_admin`/`transfer_admin`, the hand-off demotes the outgoing admin
before promoting the successor.

## Rate limits

One table, `rate_limit_events (user_id, kind, created_at)`, backs all three
limits — a shared `assert_rate_limit()` helper counts a user's recent rows
of one `kind` and raises if at or over the max, otherwise records this
attempt. Current numbers, all easy to retune: session creation 10/user/hour
(`VB020`), voting 10/participant/round per 10 seconds (`VB022`). Pruned by
the `expire-stale-sessions` cron job's schedule, via its own
`prune-rate-limit-events` job (rows older than 2 days).

The join cooldown (5 bad codes per 5 minutes, `VB021`) works differently,
for a reason worth knowing before changing it: a Postgres function that
raises an error cannot also persist a record of that failure, because
PostgREST (and pgTAP's `throws_ok`) run each call in one transaction and
roll the _whole thing_ back when it raises — any insert made on the way
out is undone along with everything else. `join_session` only ever
performs the (read-only) cooldown _check_; the client calls the separate,
always-succeeding `record_join_failure()` after catching
`session_not_found`/`session_expired` from it
(`useJoinSession`'s `onError` in `apps/web`). A client that skips that
call simply never trips the cooldown — this is a best-effort layer, not
the primary defense; see `docs/security.md` for what still closes the gap
(the 12-character code space, Supabase's own per-IP anonymous sign-in
rate limit, Turnstile).

## Captcha

Cloudflare Turnstile gates anonymous sign-in, but only when
`VITE_TURNSTILE_SITE_KEY` is set — `AuthGate` renders the widget first and
signs in with its token only once it succeeds; unset, it signs in exactly
as before, no widget at all. Left unset locally and in CI (`.env.example`
documents it commented out) so both stay hermetic by omission, matching
how the pg_cron jobs and every rate limit above are also disabled or
inert until deliberately exercised — no `if (import.meta.env.DEV)`-style
branch anywhere.

The server side has no local equivalent to test against: Supabase's
bot-protection toggle (Dashboard → Authentication → Attack Protection →
Enable CAPTCHA protection, provider "Turnstile", plus the Turnstile
**secret** key, not the site key) is configured per hosted project, for
staging and production only. The secret key lives in that dashboard, never
in this repo. `supabase/config.toml`'s `[auth.captcha]` block stays
commented out — it only affects `supabase start`'s local stack, which must
stay open for the Playwright suite to run unattended.

## Support link

VBS is free and carries no ads; `docs/support-link.md` has the full
reasoning, kept here in short. A "buy me a coffee" affordance had to fit
what the app already promises: the `Caddyfile` CSP pins `script-src`,
`img-src`, `font-src` and `frame-src` to `'self'` plus Cloudflare, and the
privacy notice states the site embeds no advertising or social-media
services. The official Buy Me a Coffee widget needs a third-party script;
the official button image needs a foreign image host and a webfont. Either
would punch a hole in the CSP and make an existing privacy claim false, in
exchange for a donation link — so instead it is a plain outbound link to
`https://buymeacoffee.com/bruchner.dev`, no widget, no embedded button, no
CSP change.

Gated behind `VITE_SUPPORT_URL`, the same hermetic-by-omission pattern as
Turnstile and Sentry above: unset locally and in CI, so both render no
support link at all; production sets it. `SupportLink` (in
`apps/web/src/features/support/`) renders nothing when the variable is
unset — its `supportUrl()` helper reads `import.meta.env` at call time,
not at module scope, so tests can exercise both states with `vi.stubEnv`.

Two placements, deliberately not a third: the app-level footer (every
route, including a live session) and a separate panel in the session's
Rules tab (read at leisure, not mid-round). Never on the reveal or result
panel — that is the team's working moment, and a nudge there would read
as a nag once per round.

## i18n

- Two locales, `de` and `en`, both complete. German copy from the prototype is the
  source; see `docs/prototype/STYLE.md` for the original strings.
- Keys live with the feature, not in one giant file. No concatenated sentences;
  use interpolation so word order can differ per language.
- `<html lang>` follows the active locale. Locale choice persists per browser.
- Dates and numbers via `Intl`, never hand-formatted.

## Design and accessibility

- The look comes from `docs/prototype/Main.dc.html`. `packages/ui/src/tokens.css`
  is binding, `docs/prototype/STYLE.md` explains the patterns.
- Target is WCAG AAA: 7:1 for text, 44 × 44 px hit areas, visible focus, status
  always conveyed as text and not by color alone.
- A unit test checks every token pair for 7:1. New colors without a test are not allowed.
- A 14px/20px type grid and a 10/20/40px spacing scale, enforced by a unit test
  that scans every `.module.css` file for gap/padding/margin — a stray value
  fails it, the same way a color misses AAA. `--vbs-space-action-x` (14px,
  button padding) is the one named exception, not a value the scale itself
  permits.
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
