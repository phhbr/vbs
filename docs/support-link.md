# Buy Me a Coffee support link

## Context

VBS is free to use and carries no ads. There is currently no way for anyone
who finds it useful to support it. The goal is a "buy me a coffee"
affordance that fits the app instead of being bolted onto it.

The decisive constraint is what the app already promises. The `Caddyfile`
CSP pins `script-src`, `img-src`, `font-src` and `frame-src` to `'self'`
plus Cloudflare, and the privacy notice states in writing that the site
embeds no advertising or social-media services and sets no tracking
cookies. The official Buy Me a Coffee widget needs a third-party script;
the official button image needs a foreign image host and the Cookie
webfont. Either one punches a hole in the CSP and makes an existing
privacy claim false, in exchange for a donation link.

So: **a plain outbound link to `https://buymeacoffee.com/bruchner.dev`, no
widget, no embedded button, no CSP change.** The link is gated behind an
environment variable, following the same hermetic-by-omission pattern as
Turnstile and Sentry, so local dev and CI stay unchanged and the deployed
site opts in.

Two placements, chosen for where a person is actually receptive:

1. The site footer, present on every route including a live session.
2. A small panel in the session's Rules tab, the one screen someone reads
   at leisure mid-session.

Deliberately **not** on the reveal or result panel. That is the team's
working moment, and a nudge there reads as a nag once per round.

## Implementation

- `apps/web/src/features/support/SupportLink.tsx` exports `supportUrl()`
  (reads `import.meta.env["VITE_SUPPORT_URL"]` at call time, so tests can
  exercise both states with `vi.stubEnv`) and the `SupportLink` component,
  which renders `null` when the variable is unset, otherwise an `<a>` with
  `target="_blank"`, `rel="noopener noreferrer"`, the label, and a
  visually hidden span announcing the new tab (WCAG G201). A new tab keeps
  a live session's realtime connection intact instead of navigating away.
- `apps/web/src/i18n/index.ts` merges in the feature's `locales/de.json`
  and `locales/en.json`, same as every other feature.
- `apps/web/src/App.tsx` appends the link to the footer's `segments`
  array conditionally, in the array construction — not by letting
  `SupportLink` return `null` into `Footer`, which prints a `·` before
  every segment past the first and would leave a dangling separator for a
  null child.
- `apps/web/src/features/session/RulesTab.tsx` adds a second, separate
  `Panel` below the existing rules panel, gated on `supportUrl()` so the
  whole panel — heading included — disappears when unset.
- `apps/web/src/styles/global.css` gained one `.visually-hidden` utility
  class (no padding or margin, so it never has to answer to the 10/20/40
  spacing scale check).
- The privacy notice's "Cookies und lokale Speicherung" section gained one
  paragraph, in both locales: the site links out to Buy Me a Coffee and
  loads nothing from them, so no data reaches them unless you click.
- `.env.example` documents `VITE_SUPPORT_URL`, commented out. CI and the
  production deploy workflow pass
  `VITE_SUPPORT_URL: ${{ vars.VITE_SUPPORT_URL }}` into the build step.

**No `Caddyfile` change.** That is the whole point of the approach.

## Tests

- `apps/web/src/features/support/SupportLink.test.tsx`: renders the anchor
  with the stubbed URL and the correct `rel`; renders nothing when unset.
- `apps/web/src/App.test.tsx`: asserts the footer's support link `href`
  when stubbed, its absence when unset, and that the footer carries the
  right number of `·` separators in both cases.
- No new Playwright spec: the variable stays commented out in
  `.env.example`, and `playwright.config.ts` runs `pnpm dev`, so the
  accessibility sweep is untouched.
