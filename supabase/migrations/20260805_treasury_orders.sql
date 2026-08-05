-- Treasury orders: анти-повтор выдачи ACKR за NACKL-платёж.
-- msg_hash уникален — повторный buy для того же платежа вернёт 409.
create table if not exists public.treasury_orders (
  id bigserial primary key,
  msg_hash text not null unique,
  player text not null,
  nackl_amount text not null,
  ackr_amount numeric not null,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

create index if not exists treasury_orders_player_idx on public.treasury_orders (player);
create index if not exists treasury_orders_created_idx on public.treasury_orders (created_at desc);
