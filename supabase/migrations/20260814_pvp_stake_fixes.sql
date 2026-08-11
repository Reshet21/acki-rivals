-- 20260814_pvp_stake_fixes.sql
-- Фикс reserve_stake: раньше debit_balance выполнялся ДО
-- INSERT ... ON CONFLICT DO NOTHING. При гонке двух join'ов на одну комнату
-- второй вызов списывал деньги, но запись pvp_stakes не создавал —
-- ставка терялась (возврат невозможен: refund_stake ищет запись).
--
-- Теперь порядок обратный: сначала INSERT (conflict -> return null, деньги
-- не тронуты), затем debit; если денег не хватило — запись удаляется
-- (в пределах одной транзакции вызова).
-- Выполнить в Supabase SQL Editor.

create or replace function reserve_stake(p_game_id text, p_player text, p_amount_nano text)
returns text language plpgsql as $$
declare v_g text;
        v_new text;
begin
  insert into pvp_stakes (game_id, player, stake_nano)
  values (p_game_id, p_player, p_amount_nano)
  on conflict (game_id, player) do nothing
  returning game_id into v_g;
  if v_g is null then
    return null; -- уже зарезервировано: деньги НЕ списываем повторно
  end if;
  v_new := debit_balance(p_player, p_amount_nano);
  if v_new is null then
    delete from pvp_stakes where game_id = p_game_id and player = p_player;
    return null;
  end if;
  return v_new;
end $$;
