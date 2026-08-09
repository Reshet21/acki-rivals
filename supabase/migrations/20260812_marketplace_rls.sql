-- 20260812: закрыть RLS-дыру marketplace_listings (найдена при аудите 09.08)
--
-- Раньше RLS на таблице НЕ было включено: любой, зная anon-ключ из
-- клиентского бандла, мог ВЫСТАВИТЬ листинг от чужого имени и УДАЛИТЬ
-- любой чужой листинг (проверено на живом листинге — 201/204).
--
-- Теперь:
--   SELECT  — публичное чтение (магазин открыт всем)
--   INSERT / UPDATE / DELETE — запрещены для anon (проверка RLS даёт false).
-- Запись идёт ТОЛЬКО через серверные эндпоинты /api/marketplace/{list,buy,cancel}
-- (service role key bypasses RLS + requireAuth по токену сессии).
--
-- ⚠️ ВЫПОЛНИТЬ В SUPABASE SQL EDITOR (как прошлые миграции).

alter table marketplace_listings enable row level security;

drop policy if exists marketplace_listings_select on marketplace_listings;
create policy marketplace_listings_select on marketplace_listings
  for select using (true);

drop policy if exists marketplace_listings_insert on marketplace_listings;
create policy marketplace_listings_insert on marketplace_listings
  for insert with check (false);

drop policy if exists marketplace_listings_update on marketplace_listings;
create policy marketplace_listings_update on marketplace_listings
  for update using (false);

drop policy if exists marketplace_listings_delete on marketplace_listings;
create policy marketplace_listings_delete on marketplace_listings
  for delete using (false);
