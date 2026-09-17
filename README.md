# Vorgangsbewertungsstelle (VBS)

Planning Poker für agile Teams im Stil eines Gaming-Portals der frühen 2000er.
Details zu Architektur, Rollen und Ablauf stehen in [CLAUDE.md](./CLAUDE.md).

## Setup (macOS, Colima)

Voraussetzungen: [Homebrew](https://brew.sh), Node 22, pnpm, Colima.

```bash
brew install pnpm colima docker supabase/tap/supabase

# Colima starten (einmalig, danach läuft es im Hintergrund)
colima start

# Docker-CLI auf Colimas Socket zeigen lassen (falls nicht automatisch gesetzt)
docker context use colima

# Abhängigkeiten installieren
pnpm install

# Frontend-Konfiguration: die lokalen Supabase-Keys sind auf jedem Rechner
# dieselben festen Demo-Werte, die Beispieldatei ist also direkt lauffähig.
cp apps/web/.env.example apps/web/.env.local
```

### Frontend

```bash
pnpm dev                 # Vite Dev-Server unter http://localhost:5173
pnpm build                # Produktions-Build von apps/web
pnpm lint && pnpm typecheck
pnpm test                 # Vitest über alle Packages
pnpm test:e2e             # Playwright gegen den lokalen Dev-Server
```

### Backend (lokales Supabase)

Docker (über Colima) muss laufen.

```bash
supabase start            # startet Postgres, Auth, Realtime, Studio lokal
supabase db reset         # spielt Migrationen (+ Seeds) neu ein
supabase test db --local  # pgTAP-Tests gegen die lokale Datenbank
pnpm gen:types             # generiert packages/core/src/database.types.ts
supabase stop              # stoppt den lokalen Stack wieder
```

`supabase start` gibt lokale URLs und Keys aus (u. a. die Studio-URL und den
anon Key für `apps/web`'s `.env.local`, siehe `.env.example`, sobald vorhanden).

**Colima-Falle:** Mit `mountType: sshfs` (Colima-Default) kann der erste
`supabase start` mit `chown ... permission denied` für
`supabase/snippets` fehlschlagen, weil Docker das Bind-Mount-Verzeichnis
selbst anlegen und chownen will und sshfs das nicht erlaubt. Das Verzeichnis
liegt bereits im Repo (`supabase/snippets/.gitkeep`), das reicht als Fix.

## Monorepo-Struktur

- `apps/web` — React 19 + Vite + TypeScript, die eigentliche Anwendung
- `packages/core` — generierte DB-Typen, Deck-Definitionen, reine Anzeige-Helfer
- `packages/ui` — Komponenten und Design-Tokens (`tokens.css`)
- `supabase/` — Schema-Migrationen, RLS-Policies, pgTAP-Tests
- `docs/prototype/` — verbindlicher visueller Prototyp (siehe `STYLE.md`)
