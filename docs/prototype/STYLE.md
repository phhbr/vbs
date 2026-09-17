# The look, taken 1:1 from the prototype

`prototype.dc.html` in this folder is the source of truth. It is not plain HTML
but the design-canvas format: custom tags (`<x-dc>`, `<helmet>`, `<sc-if>`,
`<sc-for>`), `{{double-brace}}` placeholders, and a logic class at the end. The
code is not portable; the appearance is.

Kept 1:1: colors, typeface, spacing, the ASCII logo, the dashed rules, the pipe
navigation, the bracket actions, the copy. Changed on purpose: text colors are
raised to 7:1 (see `tokens.css`), the layout becomes responsive, and controls get
real semantics.

## Building blocks

**Header.** Centered, three lines: a letter-spaced small line in the accent color
(`» VORGANGSBEWERTUNGSSTELLE «`, `letter-spacing: 3px`, 11 px), then the ASCII
logo as a `<pre>` in `--vbs-fg-strong` with `line-height: 1.05`, then a subtitle
in `--vbs-fg-dim-2` (11 px). The logo is decoration: `aria-hidden="true"`, with
the name as real text beside it or as an `aria-label`.

The prototype's logo is rasterized type (`#` characters, 16 lines). For "VBS",
regenerate it the same way: render bold monospace type, downsample to a coarse
grid, print filled cells as `#`. The constant `LOGO_LINES` in
`prototype.dc.html` shows the exact texture to match.

**Bars.** Navigation and status lines are rows with dashed rules above and below
(`1px dashed var(--vbs-divider)`), padding `6px 12px`. Items are separated by
literal pipe characters, which themselves use `--vbs-divider`:

```
| Main | History | Rules |
| Session: K7QP-M2XR | Round: 3 | Deck: Fibonacci | Team: 5 players |
```

Labels in `--vbs-fg`, the value after them in `--vbs-accent`. Active tab: accent
color plus `font-weight: 700`.

**Bracket actions.** Every action looks like a link in square brackets:
`[Start round]`, `[Reveal cards]`, `[Re-estimate]`, `[New story]`,
`[Example story]`, `[Leave session]`. Technically a `<button>` with no border or
background, `font: inherit`, color `--vbs-accent`. Inactive: `--vbs-fg-dim` plus
`disabled`. The brackets are part of the label, not a border.

**Boxes.** Panels and form blocks get a dashed border all around and `12px 14px`
padding. No radii, no shadows, no accent-colored fills except the two noted below.

**Cards.** A row of square fields, `min-width: 46px`, `min-height: 44px`,
`1px solid var(--vbs-divider)`, page-colored background, the number in the accent
color. Selected: accent fill, black or white label, plus a distinct border as a
second cue. Fibonacci deck: `0 1 2 3 5 8 13 20 40 100 ? PAUSE`. T-shirt deck:
`XS S M L XL XXL ?`. `PAUSE` instead of a coffee cup, because the look has no
emoji. Implement as a `radiogroup`, one radio per card.

**Participant list.** A `•` list, format `• Name — status`. "waiting …" in
`--vbs-danger`, "has voted" in `--vbs-accent`, after reveal the value itself in
`--vbs-accent`. Always text, never color alone. Wrap in `aria-live="polite"`.

**Result.** `Ø Average: 5.5` or `Majority: M`, the number in the accent color.
On agreement, a badge `CONSENSUS REACHED`: accent fill, inverted text,
`padding: 2px 8px`, bold. Otherwise
`Spread: 3 – 13 — discussion recommended.` in `--vbs-danger`.

**Footer.** Dashed rule on top, 11 px, `--vbs-divider`, centered:
`VBS · Prototype · Round 3` next to `[Leave session]`.

## Copy and tone

Dry and matter-of-fact, with a light touch of bureaucratic humor and no silliness.
The prototype holds the German source strings for the join screen, rules, empty
states, and hints. Use them as the `de` locale and translate them for `en`,
changing meaning only where the real app behaves differently (bots disappear,
real teammates arrive).

German source strings worth keeping:

| Context | German (source) | English |
| --- | --- | --- |
| Empty state, admin | „Keine aktive Runde — trag oben eine Story ein und starte." | "No active round — enter a story above and start." |
| Empty state, player | „Warte auf den Admin, der eine Story startet." | "Waiting for the admin to start a story." |
| Voting | „Abstimmung läuft — 3 von 5 abgegeben." | "Voting in progress — 3 of 5 submitted." |
| History empty | „Noch keine Runden gespielt." | "No rounds played yet." |
| Waiting / voted | „wartet ..." / „hat abgestimmt" | "waiting …" / "has voted" |
| Consensus | „KONSENS ERREICHT" | "CONSENSUS REACHED" |
| Spread | „Streuung: 3 – 13 — Diskussion empfohlen." | "Spread: 3 – 13 — discussion recommended." |

The app name stays German in both locales: Vorgangsbewertungsstelle, short VBS.

## Deliberate departures from the prototype

- No `min-width: 1040px`. Two columns from roughly 900 px, one below that, cards wrap.
- The runtime contrast correction is gone. Tokens are fixed and verified by a test.
- The decorative pixel pattern becomes a real QR code of the session link
  (`qrcode` package), at least 160 px, with the code below it as text.
- Roles decide what is shown; what is allowed is decided in the database.
