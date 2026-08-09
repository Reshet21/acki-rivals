-- ═══════════════════════════════════════════════════════
-- 20260811: PvP на стороне СЕРВЕРА (анти-чит).
--
-- 1. player_sessions — токены сессий (sha256), auth для всех /api/pvp/*
-- 2. moves — card_uid + уникальность (game+round+player, game+card_uid)
-- 3. player_balances.pillz_boost — магазин предметов
-- 4. players.streak — серия побед на лидерборде
-- 5. upsert_player_stats — обновлён (streak)
-- Безопасно запускать повторно (всё с IF NOT EXISTS / OR REPLACE).
-- ═══════════════════════════════════════════════════════

-- ═══ SESSIONS: авторизация серверных эндпоинтов ═══
create table if not exists player_sessions (
  id bigserial primary key,
  player text not null,
  token_hash text not null,
  created_at timestamptz not null default now()
);

-- один и тот же (player, token) не регистрируется дважды
create unique index if not exists player_sessions_player_token_uniq
  on player_sessions (player, token_hash);

create index if not exists player_sessions_player_idx on player_sessions (player);

-- ═══ MOVES: серверный резолв ═══
alter table moves add column if not exists card_uid text;
create index if not exists idx_moves_game_card_uid on moves (game_id, card_uid);

-- один ход на игрока за раунд (анти-двойная-отправка)
create unique index if not exists moves_game_round_player_uniq
  on moves (game_id, round, player_id);

-- карта не может сходить дважды в одной игре (анти-повтор карт)
create unique index if not exists moves_game_card_uid_uniq
  on moves (game_id, card_uid) where card_uid is not null;

-- ═══ МАГАЗИН: буст маны ═══
alter table player_balances add column if not exists pillz_boost integer not null default 0;

-- ═══ ЛИДЕРБОРД: серия побед ═══
alter table players add column if not exists streak integer not null default 0;

-- лидерборд сортируется по rating
create index if not exists idx_players_rating on players (rating desc);

-- ═══ ОБНОВЛЁННАЯ СТАТИСТИКА (с серией побед) ═══
create or replace function upsert_player_stats(
  p_player_id text,
  p_player_name text,
  p_is_win boolean
)
returns void as $$
begin
  insert into players (player_id, player_name, wins, losses, rating, streak, last_active)
  values (
    p_player_id,
    p_player_name,
    case when p_is_win then 1 else 0 end,
    case when p_is_win then 0 else 1 end,
    case when p_is_win then 100 else -50 end,
    case when p_is_win then 1 else 0 end,
    now()
  )
  on conflict (player_id) do update set
    player_name = excluded.player_name,
    wins = players.wins + case when p_is_win then 1 else 0 end,
    losses = players.losses + case when p_is_win then 0 else 1 end,
    rating = players.rating + case when p_is_win then 100 else -50 end,
    streak = case when p_is_win then players.streak + 1 else 0 end,
    last_active = now();
end;
$$ language plpgsql;