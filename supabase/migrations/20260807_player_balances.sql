-- 20260807: игровой баланс (депозиты NACKL на казначейство)
-- Игрок переводит NACKL на казначейство -> deposit зачисляет на баланс.
-- Покупки паков и будущие ставки PvP списываются с баланса.
-- Баланс хранится в нано (1e9 нано = 1 NACKL) строкой (JS BigInt-safe).

create table if not exists player_balances (
  player text primary key,          -- игровой адрес "0:hex64"
  balance_nano text not null default '0',
  updated_at timestamptz not null default now()
);

create table if not exists balance_ledger (
  id bigserial primary key,
  player text not null,
  type text not null check (type in ('deposit', 'spend')),
  amount_nano text not null,
  msg_hash text,                    -- deposit: уникальный хеш блокчейн-платежа (анти-повтор)
  pack_id text,                     -- spend: купленный пак
  created_at timestamptz not null default now()
);

-- анти-повтор: один и тот же блокчейн-платёж нельзя зачислить дважды
create unique index if not exists balance_ledger_msg_hash_uniq
  on balance_ledger (msg_hash) where msg_hash is not null;

create index if not exists balance_ledger_player_idx on balance_ledger (player);

-- Атомарное пополнение: INSERT ... ON CONFLICT + прибавка в одном стетменте
create or replace function credit_balance(p_player text, p_amount_nano text)
returns text language plpgsql as $$
declare v_new text;
begin
  insert into player_balances (player, balance_nano)
  values (p_player, p_amount_nano)
  on conflict (player)
  do update set balance_nano = (player_balances.balance_nano::numeric + p_amount_nano::numeric)::text,
                updated_at = now()
  returning balance_nano into v_new;
  return v_new;
end $$;

-- Атомарное списание: только если хватает; null = недостаточно средств
create or replace function debit_balance(p_player text, p_amount_nano text)
returns text language plpgsql as $$
declare v_new text;
begin
  update player_balances
     set balance_nano = (balance_nano::numeric - p_amount_nano::numeric)::text,
         updated_at = now()
   where player = p_player
     and balance_nano::numeric >= p_amount_nano::numeric
   returning balance_nano into v_new;
  return v_new;
end $$;
