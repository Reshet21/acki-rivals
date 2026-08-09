-- PvP ставки: ставка комнаты (задаёт host), гость платит ту же.
-- Выполнить в Supabase SQL Editor: supabase/migrations/20260809b_pvp_stake_nano.sql

alter table games add column if not exists stake_nano text default '0';
