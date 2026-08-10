-- 20260810b: каналы чата — global / trade / clan.
--
-- Торговые позиции (листинги) живут в канале 'trade', чтобы не спамить
-- глобальный чат. Сервер сам определяет канал при post:
--   listingId -> 'trade' (в 'global' карточки отправить нельзя)
--   listingId + clanId -> 'clan' (внутриклановый обмен)
--   text + clanId -> 'clan'
--   text -> 'global'

alter table chat_messages add column if not exists channel text not null default 'global'
  check (channel in ('global', 'trade', 'clan'));

-- Перенос существующих сообщений в правильные каналы
update chat_messages set channel = 'trade' where channel = 'global' and listing_id is not null;
update chat_messages set channel = 'clan' where clan_id is not null;

-- Старый индекс (clan_id is null) заменён на канальный
drop index if exists idx_chat_global;
create index if not exists idx_chat_channel on chat_messages(channel, id desc);
