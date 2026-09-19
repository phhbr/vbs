# The look, taken from the design revision prototype

`Main.dc.html` in this folder is the source of truth. It is not plain HTML but
the design-canvas format: custom tags (`<x-dc>`, `<sc-if>`, `<sc-for>`),
`{{double-brace}}` placeholders, and a logic class at the end — see this
folder's own `README.md`. The code is not portable; the appearance and the
CSS block at the top are. Where this document and the prototype disagree, the
prototype wins and this file gets corrected in the same commit.

This is the second pass over the look. The first (this file's previous
version, recoverable from git history) kept the prototype's own inconsistencies
— three different ways of writing a bracket action, accent used for five
unrelated things, a dashed-and-solid border system nobody wrote down. This
pass is a set of rules precise enough that a stray value is a bug, not a
judgment call, and two of them are unit-tested.

## The grid

Base text is 14px on a 20px line-height (`--vbs-font-size`,
`--vbs-line-height`). Every gap, padding, and margin anywhere in the app is
10, 20, or 40px — `--vbs-space-10`/`-20`/`-40`. `packages/ui/src/
spacing.scale.test.ts` scans every `.module.css` file for exactly these
properties and fails on any other px value, the same way the contrast test
fails a color that misses AAA.

Two things are dimensions, not spacing, and sit outside the scale on purpose:
the 44px touch target (`--vbs-touch-target`) and the 56px card
(`--vbs-card-min-size`), plus the 1–2px border/outline widths used throughout.
One thing is a named exception rather than a dimension: button padding is
`10px 14px`, not `10px 10px` — `--vbs-space-action-x` holds that 14, and the
spacing test allows it specifically because it's this one documented case,
not a general escape hatch.

## Color roles

Five roles, each doing exactly one job:

- **`--vbs-fg-strong`** — values, headings, panel titles, logo. The thing
  being displayed, not the label describing it.
- **`--vbs-fg-dim`** — meta labels (12px, uppercase, `letter-spacing: 0.08em`)
  and hint text. Never a value.
- **`--vbs-accent`** — interactive things only: buttons, cards, active tabs
  and toggles, the consensus badge. Nothing else gets it. The previous
  version of this system used accent for section headings, status-bar
  values, and link-styled text too, which is exactly the "does five things"
  problem this pass exists to fix.
- **`--vbs-danger`** — warnings and the "waiting" status. Text only, never a
  fill.
- **`--vbs-divider`** — rules and panel borders. Decorative, 3:1 rather than
  the 7:1 text tiers.

`--vbs-on-accent` is a sixth, narrower role: text printed *on* an accent
fill (a selected card, an "on" button, the consensus badge), not on the page
background, which is why it has its own line in the contrast test rather than
sharing one with `--vbs-fg-strong`.

## Borders — one system

- **Dashed 1px** (`--vbs-border-style`) is a Panel and nothing else.
- **Solid 1px** is a Card.
- **Rows, lists, and the status grid get no border at all.**

There is no dashed-vs-solid judgment call anywhere else in the app. A new
component reaching for a border picks one of exactly these two, or none.

## Buttons

One component, `BracketButton`, behind every action in the app — plain
buttons, toggle options, nav tabs, the deck/role pickers. `min-height: 44px`,
padding `10px 14px`, `border: 1px solid transparent`. The brackets are the
component's own `aria-hidden` spans around the label, never characters baked
into the label string — a locale string that still had them would double up
now that the component adds its own. This is what makes "one bracket
dialect" actually enforceable: there is exactly one place brackets come from.

- **Hover / focus-visible**: invert — `background: var(--vbs-accent)`,
  `color: var(--vbs-on-accent)`.
- **`active` prop** (the "on" state — active tab, active toggle option,
  selected deck): the same inversion, held rather than transient, plus an
  accent border. Signalled by the inversion and real state
  (`aria-pressed`/`aria-selected`/`aria-checked`) together, not by a bold
  weight — the previous version used bold for this, which is invisible to
  anyone who can't distinguish it from the surrounding text at a glance.
- **`variant="primary"`**: an accent border on an otherwise-idle button — the
  one emphasized action in a group (a form's submit, "Karten aufdecken").
- **Disabled**: the real `disabled` attribute plus `--vbs-disabled`, not a
  different color choice layered on top of an enabled-looking control.

Cards (`CardDeck`) are a separate, smaller thing: 56×56, solid 1px border,
`--vbs-accent` text, no brackets. Selected is the same inversion as a
button's "on" state, signalled by the fill plus `aria-checked` — not by an
extra border weight the way the previous version did.

## Panels

Every section is a Panel: dashed border, `padding: 20px`, `gap: 20px` between
its own children. A titled Panel's heading is uppercase, `letter-spaced
0.1em`, `--vbs-fg-strong`, no decorative prefix — the previous version's "»
Heading" chevron is gone, along with the floating, boxless headings it used
to sit next to (the voting column's "Abstimmung" label used to have no panel
around it at all, while every other section did; that inconsistency was
finding 9 of the review this document responds to).

A Panel's title bar can carry a second element via `headingAction` —
"Rundenverlauf `[ Alle ]`", the deck picker beside "Neue Story" — in a row
that wraps under the title at narrow widths rather than squeezing both onto
one line (caught testing at 360px). There is no other panel shape: two
columns that each build their own boxes, plain `<div>`s standing in for a
Panel, or a heading with no box at all are all the same bug.

## The status grid

`StatusBar` is a CSS grid of label-over-value pairs
(`repeat(auto-fit, minmax(150px, 1fr))`, gap `10px 20px`), one `.item` per
`{ label, value }`, label styled as a meta label, value in `--vbs-fg-strong`.
No pipe characters, no inline "Label: value" text run — a test that looks for
one, like `getByText("Story: X")`, is looking for the previous version.

## The participant row

A real 10×10 dot (`--vbs-danger` while waiting, `--vbs-accent` otherwise),
then the name, then the status *as text* next to it — color is reinforcement,
never the only cue, which is also why the dot is a real element with
`aria-hidden="true"` rather than a `::before` bullet standing in for
meaning. The list sits directly under its Panel's heading, no extra wrapper
in between.

## The input

One styled text input, `Input` (there was no styled input at all before this
pass — a bare `<input>` picked up whatever the browser or a stray global
rule gave it). Same dashed border as a Panel, no radius, `width: 100%` inside
a `Field` (label above input, `gap: 10px`) or `flex: 1 1 260px` inside an
`InputRow` beside a button — same `min-height: 44px` as that button, so
their centers line up. Its own focus outline in `--vbs-accent`, not the
shared `--vbs-focus-ring` every other focusable element uses — a dashed
border plus a same-color solid ring would blur into one shape rather than
read as two distinct signals.

## The admin recovery dialog

A real `Dialog`: `role="dialog"` plus `aria-modal`, focus moved in and
trapped on open, Esc and the confirm button both close it, focus restored to
whatever triggered it. It shows the session code and a copy button — never
the recovery URL as text. That specific rendering (`<code>{url}</code>`) is
how a real token leaked into a screenshot during this review; the fix is not
just "make it a real modal" but "never put the secret on screen as text" —
see `docs/security.md`. Body copy is capped at 80ch (`.prose`, defined once in
`global.css` and reused everywhere prose appears, not per-component).

## Layout

Left-aligned along one edge, header included: the wordmark block on the
left, control groups (`Darstellung`, `Sprache`) to its right, each with its
own visible label and no separator character between its options — the
group's own `gap: 10px` is the only separator. The previous version centered
the header and used a mix of pipes and middots between control groups and
between nav-tab items; there is now exactly one separator convention (a
group's own spacing) and it is used everywhere a separator would otherwise
go, including the footer, which lost a hardcoded em-dash that the
`justify-content: space-between` layout no longer needs.

Two columns from 900px, one below that — unchanged from the previous
version, still no `min-width: 1040px`. A page's outer `.wrap`-equivalent
(`App.module.css`'s `.page`) caps at 1120px, centers, and pads `40px 20px`
(halved to `20px` below 480px via `--vbs-space-page-x`) — this didn't exist
before the design revision, so content ran edge-to-edge at any width; it's
what makes the 360px screenshots in `docs/screenshots/` have any margin at
all.

## Copy and tone

Unchanged from the previous version: dry and matter-of-fact, with a light
touch of bureaucratic humor and no silliness. German is the source locale.
The app name stays German in both locales: Vorgangsbewertungsstelle, short
VBS.

## Accessibility exceptions

None currently. `--vbs-on-accent` reaches AAA against `--vbs-accent` in both
themes (confirmed by `tokens.contrast.test.ts`), so the fallback this
section would otherwise document — keeping a non-color cue and noting the
hue that couldn't reach 7:1 — isn't needed. If a future accent color choice
fails that test, the fix is either a different hue or a documented exception
here, in that order; the test failing is not itself the problem to solve
around.
