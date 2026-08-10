-- 20260810: Чат (глобальный + клановый) и кланы.
--
-- Доступ ТОЛЬКО через серверные API (service_role), поэтому RLS включён
-- без политик: анон-ключ клиента не сможет читать/писать напрямую.
-- Листинги в чате: сообщение ссылается на marketplace_listings.id;
-- покупка — существующий RPC marketplace_purchase.

-- ═══ КЛАНЫ ═══
create table if not exists clans (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  tag text not null unique,
  owner text not null,
  created_at timestamptz default now(),
  check (char_length(name) between 2 and 24),
  check (char_length(tag) between 2 and 5)
);

-- Один игрок = один клан (unique(player)).
-- FK на players НЕТ: запись в players создаётся только после первого PvP-матча,
-- а в клан должен вступать любой игрок (имя/рейтинг берутся из players по наличию).
create table if not exists clan_members (
  clan_id uuid not null references clans(id) on delete cascade,
  player text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now(),
  primary key (clan_id, player),
  unique (player)
);

-- Фикс для уже применённой миграции (FK на players ломал вступление новых игроков)
alter table clan_members drop constraint if exists clan_members_player_fkey;

create index if not exists idx_clan_members_clan on clan_members(clan_id);

-- ═══ ЧАТ ═══
create table if not exists chat_messages (
  id bigserial primary key,
  player text not null,
  player_name text not null default 'Игрок',
  text text,
  clan_id uuid references clans(id) on delete cascade, -- NULL = глобальный чат
  listing_id uuid references marketplace_listings(id) on delete set null,
  card jsonb,
  price_nackl numeric,
  created_at timestamptz default now(),
  check (text is not null or listing_id is not null)
);

create index if not exists idx_chat_global on chat_messages((clan_id is null), id desc);
create index if not exists idx_chat_clan on chat_messages(clan_id, id desc);
create index if not exists idx_chat_player on chat_messages(player, created_at desc);

-- ═══ RLS (без политик — только service_role) ═══
alter table clans enable row level security;
alter table clan_members enable row level security;
alter table chat_messages enable row level security;
