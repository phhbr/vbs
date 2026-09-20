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

- **`--vbs-fg-strong`** — values, headings, panel titles, logo/wordmark. The
  thing being displayed, not the label describing it.
- **`--vbs-fg-dim`** — meta labels and hint text. Never a value.
- **`--vbs-accent`** — interactive things only: buttons, cards, active tabs
  and toggles, the consensus badge. Nothing else gets it. An earlier version
  of this system used accent for section headings, status-bar values, and
  link-styled text too, which is exactly the "does five things" problem this
  pass exists to fix.
- **`--vbs-danger`** — warnings and the "waiting" status. Text only, never a
  fill.
- **`--vbs-divider`** — decorative rules and (in four of the six themes)
  panel borders. Never a control's own edge — see "A control's edge is not a
  rule" below for why that split exists.

`--vbs-on-accent` is a sixth, narrower role: text printed *on* an accent
fill (a selected card, an "on" button, the consensus badge), not on the page
background, which is why it has its own line in the contrast test rather than
sharing one with `--vbs-fg-strong`.

A seventh role was added for the two modern themes and reused by
Fachanwendung: **`--vbs-control-border`**, the edge of a Card, the Input, or
the Darstellung select — never a decorative rule, and never assumed to share
`--vbs-divider`'s color. See "Themes" below for why the two needed to split.

## Themes

Six, in two families. `data-theme` on `<html>` selects one; `theme-
bootstrap.js` reads the stored value and sets it synchronously before first
paint, so a returning visitor never sees a flash of the wrong theme.

**Modern** — today's ordinary product surface, system font, soft corners,
one flat accent fill, no bracket glyphs, no ASCII logo:

- **Hell** (`modernLight`) — the default when nothing is stored. Bare
  `:root` carries its values directly in `tokens.css`, the same way the old
  dark theme's selector alone used to be the unconditional default before
  this theme existed.
- **Dunkel** (`modernDark`) — reached automatically via
  `prefers-color-scheme: dark` when nothing is stored, and explicitly via
  the Darstellung select otherwise.

**Nostalgie** — four explicit-only choices, never a `prefers-color-scheme`
default: picking one is always a deliberate act in the Darstellung select,
never inferred from the OS.

- **Terminal hell** (`light`, formerly labelled "Hell") and **Terminal
  dunkel** (`dark`, formerly labelled "Dunkel") — the app's original two
  looks, palette and every structural token unchanged by this pass; only
  their menu labels grew a "Terminal" qualifier once the modern pair took
  the plain "Hell"/"Dunkel" names.
- **Behörde** (`amt`) — a 1980s German administrative terminal: deep blue
  screen, yellow highlights, a double-ruled edge instead of dashed, inverted
  section titles, sunken input fields.
- **Fachanwendung** (`vb6`) — a 1990s Windows line-of-business mask: silver
  face, Tahoma, real Win9x bevels (engraved/embossed insets, not a drawn
  border) instead of any edge color, navy title bars, sunken fields. The
  structurally furthest of the six from the dashed/solid system — see its
  own paragraph below.

Both Behörde and Fachanwendung are proper names, never translated, in both
`de` and `en`, each with an English-only `title` attribute on its `<option>`
for a reader who doesn't already know what it refers to.

### The token table

Every color role above, plus every structural token below, is defined per
theme in `tokens.css` and nowhere else. A theme block is fully
self-contained — it redeclares every one of these rather than relying on a
cross-theme fallback, the same convention Behörde already used before this
pass (its edge-width/style and title-bar tokens were always spelled out in
full, never inherited).

| Token | Terminal hell/dunkel, Behörde | Fachanwendung | Modern (Hell/Dunkel) |
| --- | --- | --- | --- |
| `--vbs-radius` | `0` | `0` | `10px` |
| `--vbs-title-transform` | `uppercase` | `uppercase` | `none` |
| `--vbs-title-tracking` | `0.1em` | `0.1em` | `-0.01em` |
| `--vbs-label-transform` | `uppercase` | `uppercase` | `none` |
| `--vbs-label-tracking` | `0.08em` | `0.08em` | `0` |
| `--vbs-on-underline` | `none` | `none` | `none` |
| `--vbs-logo-display` / `--vbs-wordmark-display` | logo shown | logo shown | wordmark shown |
| `--vbs-font-family` | `var(--vbs-font-mono)` | Tahoma stack | system sans stack |
| `--vbs-panel-bg` | `transparent` | `var(--vbs-bg)` (no-op) | a real elevated card color |
| `--vbs-panel-shadow` | `none` | etched bevel | a soft drop shadow |
| `--vbs-control-bg` | `transparent` | `var(--vbs-bg)` (button face) | `transparent` |
| `--vbs-control-shadow` / `-active` / `-on` | `none` | bevel-up / bevel-down / bevel-down | `none` |
| `--vbs-bracket-display` | `inline` | `none` | `none` |
| `--vbs-input-edge-width` / `-style` | mirrors `--vbs-edge-*` | `0px solid` | mirrors `--vbs-edge-*` (`1px solid`) |
| `--vbs-control-border` | `var(--vbs-divider)` | `transparent` | a dedicated color, ≥3:1 |
| `--vbs-focus-ring` | `2px solid` fg-strong | `1px dotted` fg-strong | `2px solid` fg-strong |
| `--vbs-focus-offset` | `2px` | `-6px` (inset) | `2px` |
| `--vbs-disabled-shadow` | `none` | an embossed highlight | `none` |
| `--vbs-rule-width` / `-style` / `-shadow` | mirrors `--vbs-edge-*`, shadow `none` | `1px solid` + engraved highlight | mirrors `--vbs-edge-*` (`1px solid`), shadow `none` |

`--vbs-edge-width` / `--vbs-edge-style` (composing into `--vbs-border-style`
for Panel/Dialog) and `--vbs-title-bg` / `--vbs-title-fg` / `--vbs-title-pad`
and `--vbs-input-shadow` predate this pass — Behörde already exercised all
of them; Fachanwendung reuses the same mechanism (title bar filled, its own
`--vbs-input-shadow`) rather than needing new ones.

### A control's edge is not a rule

Finding 2 of this pass: a Card, the Input, and the Darstellung select need a
boundary that survives *on its own*, unlike a decorative rule between
sections. The four original themes never had to distinguish the two —
`--vbs-divider` happened to clear 3:1 in all of them, so it did double duty
as both a rule color and a control's border color. The two modern themes
break that coincidence on purpose: their divider is a genuinely faint
hairline (~1.4:1 against the background — fine for a rule between sections,
useless as the only line marking a clickable box), so a control's edge now
reads `--vbs-control-border` instead, a color chosen to clear 3:1
independently. `packages/ui/src/tokens.contrast.test.ts` checks the two
tokens separately for exactly this reason — checking only `--vbs-divider` at
3:1 for every theme would have let a modern theme ship with an invisible
Card border.

Fachanwendung goes one step further: its controls have no border color at
all (`--vbs-control-border: transparent`) because they have no drawn edge —
the Win9x bevel shadow *is* the edge. Reusing `--vbs-divider` there the way
the four older themes do would draw a line that competes with the bevel
instead of one that replaces it.

### Fachanwendung's bevels

The furthest of the six themes from the dashed/solid system in "Borders"
below: Panel, Dialog, and Input all set `--vbs-edge-width` /
`--vbs-input-edge-width: 0` — no drawn border anywhere. What reads as an
edge instead is a real Win9x double-tone inset shadow, composed once from
six literal grays (outer white/black, inner light/dark gray) and reused as:

- `--vbs-control-shadow` — the idle "up" bevel on every button/card face.
- `--vbs-control-shadow-active` and `--vbs-control-shadow-on` — the pressed
  and selected "down" bevel, the same shadow used for both since Win9x
  doesn't distinguish a held click from a toggled-on state.
- `--vbs-panel-shadow` — a lighter, two-tone "etched" variant for Panel and
  Dialog boxes.
- `--vbs-input-shadow` — the "down" bevel again, giving Input its classic
  sunken-field look (the same mechanism Behörde already used for its own
  sunken fields, just a different shadow recipe).

Its focus ring is the other structural outlier: `1px dotted`, inset with a
negative `-6px` offset so the marching-ants rectangle sits inside the
control rather than outside it — every other theme's ring sits outside, at a
positive offset.

## Borders

- **Dashed 1px** (`--vbs-border-style`, `3px double` in Behörde, `1px solid`
  in the two modern themes) is a Panel/Dialog and nothing else. Fachanwendung
  is the one theme where this composes to a literal `0px` — no drawn edge;
  see "Fachanwendung's bevels" above for what stands in for it.
- **A control's own edge** (Card, Input, the Darstellung select) reads
  `--vbs-control-border`, never `--vbs-divider` — see "A control's edge is
  not a rule" above.
- **Rows and lists get no border at all.**

There is no dashed-vs-solid-vs-bevel judgment call anywhere else in the app.
A new component reaching for a border picks one of exactly these, or none.

## Buttons

One component, `BracketButton`, behind every action in the app — plain
buttons, toggle options, nav tabs, the deck/role pickers. `min-height: 44px`,
padding `10px 14px`, `border-radius: var(--vbs-radius)` (a no-op everywhere
but the two modern themes). The brackets are the component's own
`aria-hidden` spans around the label, never characters baked into the label
string, and are hidden entirely (`display: var(--vbs-bracket-display)`) in
the two modern themes and Fachanwendung — a locale string that still had
brackets baked in would double up now that the component adds its own, and a
theme that hides them relies on the fill/inversion and real ARIA state alone
to signal every button state.

- **Hover / focus-visible**: invert — `background: var(--vbs-accent)`,
  `color: var(--vbs-on-accent)`.
- **`active` prop** (the "on" state — active tab, active toggle option,
  selected deck): the same inversion, held rather than transient, plus an
  accent border, `--vbs-control-shadow-on`, and (via `--vbs-on-underline`) an
  underline in every theme except the two modern ones — a third, independent
  signal on top of the fill and the real ARIA state
  (`aria-pressed`/`aria-selected`/`aria-checked`), the kind that survives
  Windows' forced-colors mode where fills and shadows are replaced but text
  decoration isn't.
- **`variant="primary"`**: an accent border on an otherwise-idle button — the
  one emphasized action in a group (a form's submit, "Karten aufdecken").
- **Disabled**: the real `disabled` attribute plus `--vbs-disabled`, plus
  `--vbs-disabled-shadow` (Fachanwendung's embossed-highlight look; a no-op
  everywhere else) — not a different color choice layered on top of an
  enabled-looking control.

Cards (`CardDeck`) are a separate, smaller thing: 56×56, `--vbs-control-
border` (not `--vbs-divider`) at 1px, `--vbs-accent` text, no brackets.
Selected is the same inversion as a button's "on" state, at 3px instead of
2px, signalled by the fill plus `aria-checked` — not by an extra border
weight alone.

## Panels

Every section is a Panel: bordered per "Borders" above, `padding: 20px`,
`gap: 20px` between its own children, `border-radius: var(--vbs-radius)`,
and a background/shadow pair (`--vbs-panel-bg` / `--vbs-panel-shadow`) that's
a no-op everywhere except the two modern themes (a real elevated white/
near-black card) and Fachanwendung (an etched two-tone bevel instead of a
drop shadow). A titled Panel's heading takes its case and tracking from
`--vbs-title-transform` / `--vbs-title-tracking` — uppercase and
letter-spaced in every theme but the two modern ones, which leave heading
case exactly as written — `--vbs-fg-strong`, no decorative prefix.

A Panel's title bar can carry a second element via `headingAction` —
"Rundenverlauf `[ Alle ]`", the deck picker beside "Neue Story" — in a row
that wraps under the title at narrow widths rather than squeezing both onto
one line (caught testing at 360px). There is no other panel shape: two
columns that each build their own boxes, plain `<div>`s standing in for a
Panel, or a heading with no box at all are all the same bug.

## The status grid

`StatusBar` is a CSS grid of label-over-value pairs
(`repeat(auto-fit, minmax(150px, 1fr))`, gap `10px 20px`), one `.item` per
`{ label, value }`, label styled as a meta label (`--vbs-label-transform` /
`--vbs-label-tracking`), value in `--vbs-fg-strong`. No pipe characters, no
inline "Label: value" text run — a test that looks for one, like
`getByText("Story: X")`, is looking for an earlier version.

## The participant row

A real 10×10 dot (`--vbs-danger` while waiting, `--vbs-accent` otherwise),
then the name, then the status *as text* next to it — color is reinforcement,
never the only cue, which is also why the dot is a real element with
`aria-hidden="true"` rather than a `::before` bullet standing in for
meaning. The list sits directly under its Panel's heading, no extra wrapper
in between.

## The input

One styled text input, `Input`. Same border system as a Panel but through
`--vbs-control-border` rather than `--vbs-divider` (see "A control's edge is
not a rule" above), `border-radius: var(--vbs-radius)`, `width: 100%` inside
a `Field` (label above input, `gap: 10px`) or `flex: 1 1 260px` inside an
`InputRow` beside a button — same `min-height: 44px` as that button, so
their centers line up. Its own focus outline is a fixed `2px solid
var(--vbs-accent)` in every theme, deliberately *not* wired to
`--vbs-focus-ring`/`--vbs-focus-offset` the way every other focusable
element is — a border plus a same-color solid ring would blur into one
shape rather than read as two distinct signals, and that holds even for
Fachanwendung's otherwise-inset focus ring elsewhere.

## The Darstellung select

A single native `<select>`, not the three/six-way radiogroup an earlier
version of this system used — six bracket buttons in the header wrapped
twice at 360px, which is what motivated the switch. Two `<optgroup>`s,
"Modern" (Hell, Dunkel) and "Nostalgie" (Terminal hell, Terminal dunkel,
Behörde, Fachanwendung). Native on purpose: the system picker on mobile,
correct keyboard behavior, and correct rendering under `forced-colors` mode
all come from the browser rather than custom code that would have to
reimplement each one. Styled from tokens only — `--vbs-radius`,
`--vbs-input-bg`, `--vbs-control-border` for its edge (not `--vbs-divider`;
the prototype's own `.select` rule still points at `--divider`, which this
app treats as the oversight the control-border split exists to catch, not
something to reproduce).

## The admin recovery dialog

A real `Dialog`: `role="dialog"` plus `aria-modal`, focus moved in and
trapped on open, Esc and the confirm button both close it, focus restored to
whatever triggered it. `border-radius: var(--vbs-radius)` and
`box-shadow: var(--vbs-panel-shadow)` like every other box, otherwise
unchanged by this pass. It shows the session code and a copy button — never
the recovery URL as text. That specific rendering (`<code>{url}</code>`) is
how a real token leaked into a screenshot during an earlier review; the fix
is not just "make it a real modal" but "never put the secret on screen as
text" — see `docs/security.md`. Body copy is capped at 80ch (`.prose`,
defined once in `global.css` and reused everywhere prose appears, not
per-component).

## Layout

Left-aligned along one edge, header included: the wordmark block on the
left, control groups (`Darstellung`, `Sprache`) to its right, each with its
own visible label and no separator character between its options — the
group's own `gap: 10px` is the only separator. An earlier version centered
the header and used a mix of pipes and middots between control groups and
between nav-tab items; there is now exactly one separator convention (a
group's own spacing) and it is used everywhere a separator would otherwise
go, including the footer, which lost a hardcoded em-dash that the
`justify-content: space-between` layout no longer needs.

Two columns from 900px, one below that — unchanged from any previous
version, still no `min-width: 1040px`. A page's outer `.wrap`-equivalent
(`App.module.css`'s `.page`) caps at 1120px, centers, and pads `40px 20px`
(halved to `20px` below 480px via `--vbs-space-page-x`) — this is what makes
the 360px screenshots in `docs/screenshots/` have any margin at all.

## Copy and tone

Unchanged from any previous version: dry and matter-of-fact, with a light
touch of bureaucratic humor and no silliness. German is the source locale.
The app name stays German in both locales: Vorgangsbewertungsstelle, short
VBS.

## Accessibility exceptions

One, precisely scoped: `--vbs-divider` drops below the general 3:1 floor for
non-text in the two modern themes (~1.4:1), because it is used there purely
as a decorative rule between sections, never as a control's own edge —
`packages/ui/src/tokens.contrast.test.ts` checks the two roles separately
(see "A control's edge is not a rule" above) so this exception can never
silently spread to a Card, Input, or select border. Every other pairing —
text against background, text against a real panel color, `--vbs-on-accent`
against `--vbs-accent`, title text against a filled title bar, and
`--vbs-control-border` everywhere it's a real color — reaches AAA/3:1 with
margin across all six themes and needs no exception. If a future accent (or
divider) color choice fails a check it isn't exempt from, the fix is either
a different hue or a documented exception here, in that order; the test
failing is not itself the problem to solve around.
