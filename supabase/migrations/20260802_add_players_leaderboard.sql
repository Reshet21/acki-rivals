-- Players leaderboard table
-- Stores persistent player stats for the global leaderboard

create table if not exists players (
  id uuid default uuid_generate_v4() primary key,
  player_id text unique not null,      -- wallet address or anonymous ID
  player_name text not null default 'Игрок',
  wins integer not null default 0,
  losses integer not null default 0,
  rating integer not null default 0,    -- wins*100 - losses*50
  last_active timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create index idx_players_rating on players(rating desc);
create index idx_players_player_id on players(player_id);

-- Enable RLS
alter table players enable row level security;
create policy "Allow all on players" on players for all using (true);

-- Enable realtime
alter publication supabase_realtime add table players;

-- Upsert function: create or update player stats after a match
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
