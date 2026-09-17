-- M1 foundation schema: sessions, participants, rounds, votes.
-- Row Level Security is enabled on every table with no policies yet
-- (deny-by-default). Access-granting policies and RPC functions land in M2+.

create table sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  admin_token_hash text not null,
  deck text not null default 'fibonacci' check (deck in ('fibonacci', 'tshirt')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'player', 'spectator')),
  can_vote boolean not null default true,
  joined_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  round_number integer not null,
  story text not null,
  status text not null default 'voting' check (status in ('voting', 'revealed')),
  started_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique (session_id, round_number)
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  unique (round_id, participant_id)
);

alter table sessions enable row level security;
alter table participants enable row level security;
alter table rounds enable row level security;
alter table votes enable row level security;
