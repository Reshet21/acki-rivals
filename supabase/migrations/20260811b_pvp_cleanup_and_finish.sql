-- ═══════════════════════════════════════════════════════
-- 20260811b: ДОЗАПУСК миграции 20260811 (исправлен порядок).
-- Безопасно запускать повторно: всё с IF NOT EXISTS / OR REPLACE.
-- ВАЖНО: alter card_uid идёт ПЕРВЫМ (дедуп зависит от колонки).
-- Выполнить в Supabase SQL Editor целиком.
-- ═══════════════════════════════════════════════════════

-- 1. moves: колонка card_uid (сначала!)
alter table moves add column if not exists card_uid text;

-- 2. Чистим дубликаты ходов (старая клиентская логика позволяла повторные)
delete from moves
 where id not in (
   select distinct on (game_id, round, player_id) id
     from moves
    order by game_id, round, player_id, created_at
 );

delete from moves
 where card_uid is not null
   and id not in (
     select distinct on (game_id, card_uid) id
       from moves
      where card_uid is not null
      order by game_id, card_uid, created_at
   );

-- 3. moves: индексы уникальности (анти-двойная-отправка, анти-повтор карт)
create index if not exists idx_moves_game_card_uid on moves (game_id, card_uid);
create unique index if not exists moves_game_round_player_uniq on moves (game_id, round, player_id);
create unique index if not exists moves_game_card_uid_uniq on moves (game_id, card_uid) where card_uid is not null;

-- 4. sessions (авторизация серверных эндпоинтов)
create table if not exists player_sessions (
  id bigserial primary key,
  player text not null,
  token_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists player_sessions_player_token_uniq on player_sessions (player, token_hash);
create index if not exists player_sessions_player_idx on player_sessions (player);

-- 5. магазин: буст маны
alter table player_balances add column if not exists pillz_boost integer not null default 0;

-- 6. лидерборд: серия побед
alter table players add column if not exists streak integer not null default 0;
create index if not exists idx_players_rating on players (rating desc);

-- 7. обновлённая статистика (со streak)
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
