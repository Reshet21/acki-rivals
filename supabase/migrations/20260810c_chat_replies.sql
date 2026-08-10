-- 20260810c: ответы на сообщения в чате (reply).
--
-- Ссылка на оригинал (reply_to) + снапшот (имя/текст), чтобы не делать
-- join при листинге сообщений. При удалении оригинала ссылка обнуляется
-- (on delete set null), снапшот-цитата остаётся.

alter table chat_messages add column if not exists reply_to bigint
  references chat_messages(id) on delete set null;
alter table chat_messages add column if not exists reply_player_name text;
alter table chat_messages add column if not exists reply_text text;
