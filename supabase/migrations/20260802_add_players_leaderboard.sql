-- Players leaderboard table (idempotent migration)
-- Safe to re-run: uses IF NOT EXISTS / EXCEPTION guards

-- Таблица
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id TEXT UNIQUE NOT NULL,
  player_name TEXT NOT NULL DEFAULT 'Игрок',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы
DO $$ BEGIN
  CREATE INDEX idx_players_rating ON players(rating DESC);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_players_player_id ON players(player_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow all on players" ON players FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE players;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Upsert function (safe to re-run)
CREATE OR REPLACE FUNCTION upsert_player_stats(
  p_player_id TEXT,
  p_player_name TEXT,
  p_is_win BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO players (player_id, player_name, wins, losses, rating, last_active)
  VALUES (
    p_player_id, p_player_name,
    CASE WHEN p_is_win THEN 1 ELSE 0 END,
    CASE WHEN p_is_win THEN 0 ELSE 1 END,
    CASE WHEN p_is_win THEN 100 ELSE -50 END,
    now()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    player_name = excluded.player_name,
    wins = players.wins + CASE WHEN p_is_win THEN 1 ELSE 0 END,
    losses = players.losses + CASE WHEN p_is_win THEN 0 ELSE 1 END,
    rating = players.rating + CASE WHEN p_is_win THEN 100 ELSE -50 END,
    last_active = now();
END;
$$ LANGUAGE plpgsql;
