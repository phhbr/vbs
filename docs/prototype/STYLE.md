# Der Look, 1:1 aus dem Prototyp

`prototype.dc.html` in diesem Ordner ist die Quelle. Es ist kein normales HTML,
sondern das Format des Design-Canvas: eigene Tags (`<x-dc>`, `<helmet>`,
`<sc-if>`, `<sc-for>`), Platzhalter in `{{doppelten Klammern}}` und eine
Logikklasse am Ende. Der Code wird nicht übernommen, das Aussehen schon.

Was 1:1 bleibt: Farben, Schrift, Abstände, das ASCII-Logo, die gestrichelten
Trennlinien, die Pipe-Navigation, die Klammer-Aktionen, die Textbausteine.
Was sich ändert: die Farbwerte für Text sind auf 7:1 angehoben (siehe
`tokens.css`), das Layout wird responsiv, und Bedienelemente bekommen echte
Semantik.

## Bausteine

**Kopf.** Zentriert, drei Zeilen: eine gesperrte Kleinzeile in Akzentfarbe
(`» VORGANGSBEWERTUNGSSTELLE «`, `letter-spacing: 3px`, 11 px), darunter das
ASCII-Logo als `<pre>` in `--vbs-fg-strong` mit `line-height: 1.05`, darunter
eine Unterzeile in `--vbs-fg-dim-2` (11 px). Das Logo ist Dekoration:
`aria-hidden="true"`, der Name steht als echter Text daneben oder als
`aria-label`.

Das Logo des Prototyps ist aus Rasterschrift gebaut (Zeichen `#`, 16 Zeilen).
Für „VBS" wird es neu erzeugt, gleiche Machart: fette Monospace-Schrift auf ein
grobes Raster rechnen und gefüllte Zellen als `#` ausgeben. Ein kurzes Skript
dafür steht in der Historie der Prototyp-Sitzung; einfacher ist, das Muster in
`prototype.dc.html` (Konstante `LOGO_LINES`) als Vorlage zu nehmen.

**Leisten.** Nav und Statuszeilen sind Zeilen mit gestrichelten Linien oben und
unten (`1px dashed var(--vbs-divider)`), Innenabstand `6px 12px`. Die Elemente
sind durch echte Pipe-Zeichen getrennt, die selbst in `--vbs-divider` stehen:

```
| Main | Verlauf | Regeln |
| Session: K7QP-M2XR | Runde: 3 | Deck: Fibonacci | Team: 5 Spieler |
```

Label in `--vbs-fg`, der Wert dahinter in `--vbs-accent`. Aktiver Tab: Akzentfarbe
und `font-weight: 700`.

**Klammer-Aktionen.** Alle Aktionen sehen aus wie Links in eckigen Klammern:
`[Runde starten]`, `[Karten aufdecken]`, `[Neu schätzen]`, `[Neue Story]`,
`[Beispiel-Story]`, `[Session verlassen]`. Technisch `<button>` ohne Rahmen und
Hintergrund, `font: inherit`, Farbe `--vbs-accent`. Inaktiv: `--vbs-fg-dim`
plus `disabled`. Die Klammern gehören zum Text, nicht zu einem Rahmen.

**Kästen.** Panels und Formularblöcke haben einen rundum gestrichelten Rahmen
und `12px 14px` Innenabstand. Keine Radien, keine Schatten, keine Flächen in
Akzentfarbe außer den zwei unten genannten.

**Karten.** Reihe aus quadratischen Feldern, `min-width: 46px`,
`min-height: 44px`, `1px solid var(--vbs-divider)`, Hintergrund wie die Seite,
Zahl in Akzentfarbe. Gewählt: Fläche in Akzentfarbe, Text in Schwarz oder Weiß,
zusätzlich ein deutlicher Rahmen als zweites Merkmal. Deck Fibonacci:
`0 1 2 3 5 8 13 20 40 100 ? PAUSE`. Deck T-Shirt: `XS S M L XL XXL ?`.
`PAUSE` statt Kaffeetasse, weil der Look keine Emoji kennt.
Als `radiogroup` umsetzen, jede Karte ein Radio.

**Teilnehmerliste.** Aufzählung mit `•`, Format `• Name — Status`. Status
„wartet ..." in `--vbs-danger`, „hat abgestimmt" in `--vbs-accent`, nach dem
Aufdecken der Wert selbst in `--vbs-accent`. Immer Text, nie nur Farbe.
Container mit `aria-live="polite"`.

**Ergebnis.** `Ø Durchschnitt: 5.5` bzw. `Mehrheit: M`, Zahl in Akzentfarbe.
Bei Einigkeit ein Abzeichen `KONSENS ERREICHT`: Fläche in Akzentfarbe,
Text invertiert, `padding: 2px 8px`, fett. Sonst
`Streuung: 3 – 13 — Diskussion empfohlen.` in `--vbs-danger`.

**Fuß.** Gestrichelte Linie oben, 11 px, in `--vbs-divider`, zentriert:
`VBS · Prototyp · Runde 3` und daneben `[Session verlassen]`.

## Texte und Tonfall

Deutsch, sachlich, kleine Behördenironie ohne Albernheit. Der Prototyp enthält
die Formulierungen für Join-Screen, Regeln, Leerzustände und Hinweise; sie
sollten übernommen und nur dort geändert werden, wo die echte App etwas anderes
tut (Bots verschwinden, echte Mitspieler kommen dazu).

Beispiele aus dem Prototyp, die bleiben: „Keine aktive Runde — trag oben eine
Story ein und starte.", „Warte auf den Admin, der eine Story startet.",
„Abstimmung läuft — 3 von 5 abgegeben.", „Noch keine Runden gespielt."

## Was bewusst anders wird

- Kein `min-width: 1040px`. Zwei Spalten ab etwa 900 px, darunter eine Spalte,
  Karten umbrechen.
- Die Laufzeit-Kontrastkorrektur des Prototyps entfällt. Die Tokens sind fest
  und werden im Test geprüft.
- Statt eines dekorativen Pixelmusters steht ein echter QR-Code des Session-Links
  (Paket `qrcode`), Größe mindestens 160 px, mit dem Code darunter als Text.
- Rollen entscheiden nur, was angezeigt wird; erlaubt wird in der Datenbank.
