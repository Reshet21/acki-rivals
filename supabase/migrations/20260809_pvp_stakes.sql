-- PvP ставки: резерв с игрового баланса при создании/вступлении в комнату,
-- банк победителю при расчёте, возврат при отмене.
-- Выполнить в Supabase SQL Editor: supabase/migrations/20260809_pvp_stakes.sql

create table if not exists pvp_stakes (
  game_id text not null,
  player text not null,
  stake_nano text not null,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (game_id, player)
);

create index if not exists pvp_stakes_player_idx on pvp_stakes (player);

-- Резерв ставки: списывает с баланса (null = не хватает средств)
create or replace function reserve_stake(p_game_id text, p_player text, p_amount_nano text)
returns text language plpgsql as $$
declare v_new text;
begin
  v_new := debit_balance(p_player, p_amount_nano);
  if v_new is null then
    return null;
  end if;
  insert into pvp_stakes (game_id, player, stake_nano)
  values (p_game_id, p_player, p_amount_nano)
  on conflict (game_id, player) do nothing;
  return v_new;
end $$;

-- Возврат ставки (отмена комнаты / ничья / дезертирство)
create or replace function refund_stake(p_game_id text, p_player text)
returns text language plpgsql as $$
declare v_stake text;
begin
  select stake_nano into v_stake from pvp_stakes
   where game_id = p_game_id and player = p_player and not settled;
  if v_stake is null then
    return null;
  end if;
  update pvp_stakes set settled = true
   where game_id = p_game_id and player = p_player and not settled;
  return credit_balance(p_player, v_stake);
end $$;

-- Расчёт: победитель забирает банк (обе ставки). null = нечего расчитывать
create or replace function settle_stake(p_game_id text, p_winner text)
returns text language plpgsql as $$
declare v_pot numeric := 0; v_winner_stake text; v_result text;
begin
  select sum(stake_nano::numeric) into v_pot from pvp_stakes
   where game_id = p_game_id and not settled;
  if v_pot is null or v_pot <= 0 then
    return null;
  end if;
  select stake_nano into v_winner_stake from pvp_stakes
   where game_id = p_game_id and player = p_winner and not settled;
  if v_winner_stake is null then
    return null;
  end if;
  update pvp_stakes set settled = true where game_id = p_game_id and not settled;
  v_result := credit_balance(p_winner, v_pot::text);
  return v_result;
end $$;
