-- 20260810: покупка карт маркетплейса за игровой баланс.
-- Атомарно (одна функция, один транзакционный блок):
--   1. блокирует листинг (FOR UPDATE)
--   2. списывает цену с покупателя (только если хватает)
--   3. зачисляет цену продавцу (INSERT ON CONFLICT — если записи нет)
--   4. пишет в balance_ledger
--   5. удаляет листинг и возвращает карту
-- Возврат: jsonb { success, card, balanceNano, error }

create or replace function marketplace_purchase(p_listing_id uuid, p_buyer text)
returns jsonb language plpgsql as $$
declare
  v_listing record;
  v_price text;
  v_buyer_balance text;
  v_card jsonb;
begin
  select id, card, seller_id, seller_name, price_nackl
    into v_listing
    from marketplace_listings
   where id = p_listing_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Листинг не найден');
  end if;

  if v_listing.seller_id = p_buyer then
    return jsonb_build_object('success', false, 'error', 'Нельзя купить свою карту');
  end if;

  v_price := (v_listing.price_nackl * 1e9)::numeric::text;

  -- Списываем с покупателя (атомарно, только если средств хватает)
  update player_balances
     set balance_nano = (balance_nano::numeric - v_price::numeric)::text,
         updated_at = now()
   where player = p_buyer
     and balance_nano::numeric >= v_price::numeric
   returning balance_nano into v_buyer_balance;

  if v_buyer_balance is null then
    return jsonb_build_object('success', false, 'error', 'Недостаточно средств на игровом балансе');
  end if;

  -- Зачисляем продавцу (создаём запись, если её нет)
  perform credit_balance(v_listing.seller_id, v_price);

  -- Леджер: трата покупателя и получение продавца (анти-повтор по msg_hash)
  insert into balance_ledger (player, type, amount_nano, pack_id)
  values (p_buyer, 'spend', v_price, p_listing_id::text);
  insert into balance_ledger (player, type, amount_nano, msg_hash)
  values (v_listing.seller_id, 'deposit', v_price, p_listing_id::text || ':' || p_buyer);

  -- Забираем листинг
  delete from marketplace_listings where id = p_listing_id returning card into v_card;

  return jsonb_build_object('success', true, 'card', v_card, 'balanceNano', v_buyer_balance);
end $$;
