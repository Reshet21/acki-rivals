-- ═══════════════════════════════════════════════════════════════
-- Acki Rivals — Supabase Schema
-- ═══════════════════════════════════════════════════════════════
-- Запусти этот SQL в SQL Editor Supabase (https://supabase.com)

-- Таблица игр
CREATE TABLE IF NOT EXISTS public.games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id TEXT NOT NULL,
  guest_id TEXT,
  host_deck JSONB NOT NULL DEFAULT '[]',
  guest_deck JSONB,
  state JSONB NOT NULL DEFAULT '{"phase":"waiting","round":0,"hostHP":100,"guestHP":100,"hostPillz":0,"guestPillz":0}'::jsonb,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Таблица ходов
CREATE TABLE IF NOT EXISTS public.moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  pillz INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_host ON public.games(host_id);
CREATE INDEX IF NOT EXISTS idx_games_guest ON public.games(guest_id);
CREATE INDEX IF NOT EXISTS idx_moves_game_round ON public.moves(game_id, round);

-- Включаем Realtime для PvP
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;

-- Row Level Security (отключаем для простоты — доверяем anon ключу)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Разрешаем всё для анонимных пользователей (упрощённая модель)
DROP POLICY IF EXISTS "Allow all on games" ON public.games;
CREATE POLICY "Allow all on games" ON public.games
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on moves" ON public.moves;
CREATE POLICY "Allow all on moves" ON public.moves
  FOR ALL USING (true) WITH CHECK (true);
