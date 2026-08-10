-- clan invites (from chat / clan screen)
create table if not exists clan_invites (
  id uuid default uuid_generate_v4() primary key,
  clan_id uuid not null references clans(id) on delete cascade,
  inviter text not null,
  invitee text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists clan_invites_pending_uniq on clan_invites (clan_id, invitee) where status = 'pending';
create index if not exists clan_invites_invitee_idx on clan_invites (invitee, status);
create index if not exists clan_invites_clan_idx on clan_invites (clan_id, status);

alter table clan_invites enable row level security;

-- private messages (direct chat)
create table if not exists private_messages (
  id bigserial primary key,
  sender text not null,
  recipient text not null,
  text text not null check (char_length(text) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists private_messages_pair_idx on private_messages (sender, recipient, id);
create index if not exists private_messages_pair2_idx on private_messages (recipient, sender, id);
create index if not exists private_messages_unread_idx on private_messages (recipient) where read_at is null;

alter table private_messages enable row level security;
