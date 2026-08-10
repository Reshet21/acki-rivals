-- 20260812: закрыть RLS-дыру marketplace_listings (найдена при аудите 09.08)
--
-- ⚠️ ГЛАВНЫЙ ВИНОВНИК: в 20260802_full_schema.sql была создана политика
--    "Allow all on marketplace" for all using (true) — она РАЗРЕШАЛА всё
--    (INSERT/DELETE/UPDATE/SELECT) для любой роли. PostgreSQL OR'ит политики:
--    пока существует хоть одна разрешающая — операция проходит. Поэтому
--    новые запрещающие политики без её удаления НЕ работали (проверено на
--    живом листинге: аноним мог выставить листинг от чужого имени и удалить
--    чужой — 201/204).
--
-- Теперь:
--   SELECT  — публичное чтение (магазин открыт всем)
--   INSERT / UPDATE / DELETE — запрещены для anon (проверка RLS даёт false).
-- Запись идёт ТОЛЬКО через серверные эндпоинты /api/marketplace/{list,buy,cancel}
-- (service role key bypasses RLS + requireAuth по токену сессии).
--
-- ⚠️ ВЫПОЛНИТЬ В SUPABASE SQL EDITOR (как прошлые миграции).

alter table marketplace_listings enable row level security;

-- УДАЛИТЬ старую открывашку (без этого остальные политики бесполезны)
drop policy if exists "Allow all on marketplace" on marketplace_listings;

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
