-- ═══════════════════════════════════════════════════════
-- Acki Rivals — ПОЛНАЯ БАЗА ДАННЫХ (создать с нуля)
-- Безопасно запускать повторно (всё с IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ═══ GAMES ═══
create table if not exists games (
  id uuid default uuid_generate_v4() primary key,
  host_id text not null,
  guest_id text,
  host_name text,
  guest_name text,
  host_deck jsonb not null,
  guest_deck jsonb,
  state jsonb default '{"phase":"waiting","round":0,"hostHP":12,"guestHP":12,"hostPillz":12,"guestPillz":12}'::jsonb,
  status text default 'waiting' check (status in ('waiting', 'full', 'active', 'finished')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_games_status on games(status);
create index if not exists idx_games_host_id on games(host_id);
create index if not exists idx_games_guest_id on games(guest_id);

-- ═══ MOVES ═══
create table if not exists moves (
  id uuid default uuid_generate_v4() primary key,
  game_id uuid references games(id) on delete cascade,
  player_id text not null,
  round integer not null,
  card_id integer not null,
  pillz integer not null default 0,
  created_at timestamp with time zone default now()
);

create index if not exists idx_moves_game_id on moves(game_id);
create index if not exists idx_moves_game_round on moves(game_id, round);

-- ═══ MARKETPLACE ═══
create table if not exists marketplace_listings (
  id uuid default uuid_generate_v4() primary key,
  card jsonb not null,
  price_nackl numeric not null check (price_nackl > 0),
  seller_id text not null,
  seller_name text not null default 'Игрок',
  created_at timestamp with time zone default now()
);

create index if not exists idx_marketplace_seller on marketplace_listings(seller_id);
create index if not exists idx_marketplace_created on marketplace_listings(created_at desc);

-- ═══ PLAYERS (лидерборд) ═══
create table if not exists players (
  id uuid default uuid_generate_v4() primary key,
  player_id text unique not null,
  player_name text not null default 'Игрок',
  wins integer not null default 0,
  losses integer not null default 0,
  rating integer not null default 0,
  last_active timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create index if not exists idx_players_rating on players(rating desc);
create index if not exists idx_players_player_id on players(player_id);

-- ═══ ROW LEVEL SECURITY ═══
alter table games enable row level security;
alter table moves enable row level security;
alter table marketplace_listings enable row level security;
alter table players enable row level security;

DO $$ BEGIN
  create policy "Allow all on games" on games for all using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "Allow all on moves" on moves for all using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "Allow all on marketplace" on marketplace_listings for all using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "Allow all on players" on players for all using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ REALTIME ═══
DO $$ BEGIN
  alter publication supabase_realtime add table games;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  alter publication supabase_realtime add table moves;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  alter publication supabase_realtime add table marketplace_listings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  alter publication supabase_realtime add table players;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ TRIGGER: обновляет updated_at при изменении игры ═══
create or replace function update_game_status()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists games_updated_at on games;
create trigger games_updated_at
  before update on games
  for each row
  execute function update_game_status();

-- ═══ ФУНКЦИЯ: обновление статистики игрока ═══
create or replace function upsert_player_stats(
  p_player_id text,
  p_player_name text,
  p_is_win boolean
)
returns void as $$
begin
  insert into players (player_id, player_name, wins, losses, rating, last_active)
  values (
    p_player_id,
    p_player_name,
    case when p_is_win then 1 else 0 end,
    case when p_is_win then 0 else 1 end,
    case when p_is_win then 100 else -50 end,
    now()
  )
  on conflict (player_id) do update set
    player_name = excluded.player_name,
    wins = players.wins + case when p_is_win then 1 else 0 end,
    losses = players.losses + case when p_is_win then 0 else 1 end,
    rating = players.rating + case when p_is_win then 100 else -50 end,
    last_active = now();
end;
$$ language plpgsql;
