# Vorgangsbewertungsstelle (VBS)

Planning Poker für agile Teams im Stil eines Gaming-Portals der frühen 2000er.
Öffentlich unter `https://vbs.bruchner.dev`.

Sprache im Repo: Code, Dateinamen und Commits auf Englisch, UI-Texte auf Deutsch
und Englisch (i18n ab v1), Gespräche mit dem Entwickler auf Deutsch.

## Stack

- `apps/web` — React 19 + Vite + TypeScript, React Router (`/`, `/s/:code`), TanStack Query
- `supabase/migrations` — Schema, RLS-Policies, Funktionen, pg_cron-Jobs als SQL
- `supabase/tests` — pgTAP
- `packages/core` — generierte DB-Typen, Deck-Definitionen, reine Anzeige-Helfer
- `packages/ui` — Komponenten und Design-Tokens
- Backend: Supabase (Postgres, Auth mit anonymer Anmeldung, Realtime, pg_cron), Region Frankfurt
- Kein Next.js, kein eigener Node-Server. Der VPS liefert nur statische Dateien über Caddy.

## Befehle

```bash
pnpm install
pnpm dev                 # Vite Dev-Server
supabase start           # lokales Supabase (Docker muss laufen)
supabase db reset        # Migrationen + Seeds neu einspielen
supabase test db         # pgTAP
pnpm test                # Vitest
pnpm test:e2e            # Playwright gegen lokales Supabase
pnpm lint && pnpm typecheck
pnpm gen:types           # supabase gen types typescript > packages/core/src/database.types.ts
```

Entwicklungsumgebung ist Windows mit Git Bash; Befehle müssen dort laufen.
Docker Desktop mit WSL2-Backend ist Voraussetzung für `supabase start`.

## Architekturregeln

1. **Die Datenbank ist die Autorität.** Jede Zustandsänderung läuft über eine
   Postgres-Funktion (`security definer`), die Rolle, Phase und Ablauf prüft.
   Das Frontend hat keine Schreibrechte auf Tabellen.
2. **Stimmwerte sind geheim, bis aufgedeckt wird.** RLS auf `votes` gibt fremde
   Werte erst frei, wenn `rounds.status = 'revealed'`. Broadcast-Nachrichten
   enthalten nie Werte, nur ein Änderungssignal plus `sessions.version`.
   Jede Änderung an `votes` oder an der Policy braucht einen pgTAP-Test dafür.
3. **Rechte nie nur im UI.** Admin-Knöpfe werden zusätzlich versteckt, aber die
   Prüfung gehört in die Funktion.
4. **Schema nur per Migration.** Keine Änderungen im Supabase-Dashboard.
   Migrationen sind vorwärtskompatibel: erst Datenbank ausrollen, dann App.
5. **Keine Secrets im Frontend.** Nur `SUPABASE_URL` und der Anon-Key (beide
   öffentlich). Service-Role-Key ausschließlich in Supabase-Secrets und CI.
6. **Ablauf:** Jede Aktion setzt `last_activity_at` und `expires_at = now() + 24h`.
   Presence-Herzschläge zählen nicht als Aktivität. Policies prüfen zusätzlich
   `expires_at > now()`.

## Funktionen (RPC)

`create_session`, `join_session`, `vote`, `start_story`, `reveal`, `re_estimate`,
`new_story`, `set_deck`, `remove_participant`, `transfer_admin`, `claim_admin`,
`set_can_vote`, `round_status` (liest, liefert vor dem Aufdecken nur „hat abgestimmt").

## Rollen

- **admin** — genau einer pro Session, der Ersteller. Legt Stories an, deckt auf,
  startet „Neu schätzen", wählt das Deck, entfernt Teilnehmende. Stimmt mit ab,
  abschaltbar über `can_vote`.
- **player** — stimmt ab, sonst nichts.
- **spectator** — sieht zu, zählt nicht in „x von y abgestimmt".

Admin-Wiederherstellung: `/s/<code>#admin=<token>`, Token nur im URL-Fragment,
in der Datenbank nur als Hash.

## Design und Barrierefreiheit

- Look und Regeln kommen aus `docs/prototype/`. Tokens in `docs/prototype/tokens.css`
  sind verbindlich, `docs/prototype/STYLE.md` erklärt die Muster.
- Ziel ist WCAG AAA: 7:1 für Text, 44 × 44 px Klickflächen, sichtbarer Fokus,
  Status immer auch als Text, nicht nur Farbe.
- Ein Unit-Test prüft jedes Token-Paar auf 7:1. Neue Farben ohne Test sind nicht erlaubt.
- Responsiv ab 360 px Breite. Das feste `min-width: 1040px` aus dem Prototyp
  wird nicht übernommen.
- Echte Elemente: `<button>`, `<a href>`, `<input>` mit `<label>`, Kartenreihe als
  `radiogroup`. Kein `onClick` auf `div` oder `span`.
- Keine Emoji als UI-Symbole.

## Tests

Neue Datenbankfunktionen und Policies kommen mit pgTAP-Tests. Änderungen am
Ablauf (Phasen, Aufdecken, Neu schätzen) kommen mit einem Playwright-Test über
mehrere Browser-Kontexte. CI läuft: Lint, Typecheck, Vitest, pgTAP, Playwright.

## Der vollständige Plan

Der Umsetzungsplan mit Begründungen, Entscheidungstabelle, Datenmodell,
Diagrammen und Meilensteinen liegt als Claude-Doc außerhalb des Repos.
Export als Markdown nach `docs/PLAN.md`, dann ist er auch hier verfügbar.
Entscheidungen aus dem Plan, die im Code nicht sichtbar sind, gehören in diese
Datei, sobald sie den Code betreffen.

## Meilensteine

- **M1** Fundament: Monorepo, CI, Vite-App, lokales Supabase, Grundschema mit RLS
- **M2** Sessions: anonyme Anmeldung, Anlegen und Beitreten per Link, Admin-Wiederherstellung
- **M3** Live-Abstimmung: Funktionen, Broadcast-Trigger, Presence, Reconnect
- **M4** Oberfläche: Retro-UI, responsiv, Hell/Dunkel, Deutsch/Englisch, AAA
- **M5** Robustheit: Ablauf per pg_cron mit Warnung, Captcha, Limits, Entfernen
- **M6** Betrieb: Staging und Produktion, Caddy auf dem VPS, Monitoring, E2E und Last
