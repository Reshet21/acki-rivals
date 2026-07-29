-- Acki Rivals PvP database schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Games table
create table games (
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

-- Moves table
create table moves (
  id uuid default uuid_generate_v4() primary key,
  game_id uuid references games(id) on delete cascade,
  player_id text not null,
  round integer not null,
  card_id integer not null,
  pillz integer not null default 0,
  created_at timestamp with time zone default now()
);

-- Indexes
create index idx_games_status on games(status);
create index idx_games_host_id on games(host_id);
create index idx_games_guest_id on games(guest_id);
create index idx_moves_game_id on moves(game_id);
create index idx_moves_game_round on moves(game_id, round);

-- ═══ Включаем Realtime для PvP и маркетплейса (ОБЯЗАТЕЛЬНО для postgres_changes) ═══
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table moves;
alter publication supabase_realtime add table marketplace_listings;

-- ═══ Маркетплейс ═══
create table if not exists marketplace_listings (
  id uuid default uuid_generate_v4() primary key,
  card jsonb not null,
  price_nackl numeric not null check (price_nackl > 0),
  seller_id text not null,
  seller_name text not null default 'Игрок',
  created_at timestamp with time zone default now()
);

create index idx_marketplace_seller on marketplace_listings(seller_id);
create index idx_marketplace_created on marketplace_listings(created_at desc);

-- Row Level Security
alter table games enable row level security;
alter table moves enable row level security;
alter table marketplace_listings enable row level security;

-- Allow all operations (we'll handle auth in the app)
create policy "Allow all on games" on games for all using (true);
create policy "Allow all on moves" on moves for all using (true);
create policy "Allow all on marketplace" on marketplace_listings for all using (true);

-- Function to update game status
create or replace function update_game_status()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger games_updated_at
  before update on games
  for each row
  execute function update_game_status();
