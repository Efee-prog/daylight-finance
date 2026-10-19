-- Daylight initial schema.
--
-- Conventions used throughout, and the reasoning behind them:
--
--  * Money is stored as BIGINT in the currency's smallest unit (kuruş, cent)
--    together with a CHAR(3) currency code, never as a float and never as a
--    bare number without its currency. The application mirrors this exactly
--    (src/lib/finance/money.ts), so no value is ever converted through a
--    binary floating-point type on its way in or out of the database.
--  * Quantities and unit prices are NUMERIC(28,8): eight decimal places cover
--    satoshi-level crypto and fractional share lots.
--  * Dates a user entered are DATE (a calendar day in their own timezone, not
--    an instant). Audit timestamps are TIMESTAMPTZ.
--  * Every user-owned row carries user_id with ON DELETE CASCADE, and every
--    such table has RLS enabled with policies keyed on auth.uid(). The user id
--    is never accepted from the client; see 20261019090100_rls_policies.sql.

create extension if not exists "pgcrypto";
-- Trigram index support for description search on transactions.
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------

-- Transfers are directional and first-class so that moving money into a
-- savings goal or a brokerage account is never counted as income or expense.
create type transaction_kind as enum (
  'income',
  'expense',
  'transfer_in',
  'transfer_out'
);

create type category_kind as enum ('income', 'expense');

create type budget_period as enum ('monthly');

create type goal_entry_direction as enum ('deposit', 'withdrawal');

create type asset_class as enum (
  'stock',
  'etf',
  'fund',
  'crypto',
  'gold',
  'other'
);

create type investment_side as enum ('buy', 'sell');

create type import_status as enum (
  'pending',
  'completed',
  'failed',
  'cancelled'
);

-- Currencies Daylight can store. Kept as a table rather than an enum so a new
-- currency is a data row, not a schema migration, and so the exponent lives
-- next to the code it belongs to.
create table currencies (
  code char(3) primary key,
  exponent smallint not null check (exponent between 0 and 8),
  name text not null
);

insert into currencies (code, exponent, name) values
  ('TRY', 2, 'Turkish lira'),
  ('USD', 2, 'US dollar'),
  ('EUR', 2, 'Euro'),
  ('GBP', 2, 'Pound sterling'),
  ('JPY', 0, 'Japanese yen'),
  ('XAU', 4, 'Gold (troy ounce)');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  default_currency char(3) not null default 'TRY' references currencies (code),
  -- IANA timezone. Drives what "today" and "this month" mean for this user.
  time_zone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column profiles.default_currency is
  'Display default only. It never rewrites the currency of existing records.';

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  kind category_kind not null,
  -- Seeded starter categories are marked so the UI can treat them gently
  -- (for example, warn before deleting one that is in use).
  is_system boolean not null default false,
  -- Stable identifier for a seeded category, e.g. 'groceries'. The UI shows a
  -- translated label for these; `name` is the fallback and is what a user sees
  -- after they rename one. User-created categories have no key and are shown
  -- verbatim in whichever language the user typed them.
  system_key text check (
    system_key is null or system_key ~ '^[a-z][a-z0-9_]{1,39}$'
  ),
  created_at timestamptz not null default now(),
  constraint categories_system_key_requires_system
    check (system_key is null or is_system),
  unique (user_id, system_key)
);

-- A user cannot have two categories with the same name on the same side of the
-- ledger, but "Transport" may legitimately exist for both income and expense.
-- Compared case-insensitively and trimmed so "Food" and " food " do not both
-- end up in the list.
create unique index categories_user_kind_name_key
  on categories (user_id, kind, lower(trim(name)));

create index categories_user_kind_idx on categories (user_id, kind);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind transaction_kind not null,
  -- Always positive. Direction comes from `kind`, never from the sign, so a
  -- negative income row cannot exist to be double-counted.
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null references currencies (code),
  occurred_on date not null,
  description text not null default '' check (char_length(description) <= 240),
  category_id uuid references categories (id) on delete set null,
  -- Provenance links. Set when this cash row is the counterpart of a savings
  -- goal movement or an investment trade, so the two views reconcile without
  -- the same money being summed twice.
  goal_id uuid,
  asset_id uuid,
  import_batch_id uuid,
  -- Duplicate-import guard; see 20261019090200_import_support.sql.
  import_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The listing and every period aggregate read by (user, date desc).
create index transactions_user_date_idx
  on transactions (user_id, occurred_on desc, id desc);
create index transactions_user_kind_date_idx
  on transactions (user_id, kind, occurred_on);
-- Budget lookups filter by category inside a month.
create index transactions_user_category_date_idx
  on transactions (user_id, category_id, occurred_on)
  where category_id is not null;
-- Description search.
create index transactions_description_trgm_idx
  on transactions using gin (description gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  limit_minor bigint not null check (limit_minor > 0),
  currency char(3) not null references currencies (code),
  period budget_period not null default 'monthly',
  -- Always the first day of the month the budget applies to. Enforced rather
  -- than assumed, so period arithmetic cannot drift.
  period_start date not null check (extract(day from period_start) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One budget per category per month.
  unique (user_id, category_id, period_start)
);

create index budgets_user_period_idx on budgets (user_id, period_start desc);

-- ---------------------------------------------------------------------------
-- savings goals
-- ---------------------------------------------------------------------------

create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  target_minor bigint not null check (target_minor > 0),
  currency char(3) not null references currencies (code),
  created_on date not null default current_date,
  target_date date,
  description text not null default '' check (char_length(description) <= 500),
  -- Archived goals stay readable for history instead of being deleted.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goals_target_after_start
    check (target_date is null or target_date >= created_on)
);

create index savings_goals_user_idx
  on savings_goals (user_id, archived_at nulls first, created_on desc);

create table savings_goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references savings_goals (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null references currencies (code),
  direction goal_entry_direction not null,
  occurred_on date not null default current_date,
  note text not null default '' check (char_length(note) <= 240),
  -- Optional link to the cash transaction that accompanied this movement.
  transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index savings_goal_entries_goal_idx
  on savings_goal_entries (goal_id, occurred_on desc);
create index savings_goal_entries_user_idx on savings_goal_entries (user_id);

-- A goal's entries must share the goal's currency: partial funding in another
-- currency has no defined progress without an exchange rate.
create or replace function enforce_goal_entry_currency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  goal_currency char(3);
  goal_owner uuid;
begin
  select currency, user_id into goal_currency, goal_owner
  from savings_goals where id = new.goal_id;

  if goal_currency is null then
    raise exception 'Savings goal % does not exist', new.goal_id;
  end if;
  if goal_owner <> new.user_id then
    raise exception 'Savings goal % belongs to another user', new.goal_id;
  end if;
  if new.currency <> goal_currency then
    raise exception
      'Goal entry currency % does not match goal currency %',
      new.currency, goal_currency;
  end if;
  return new;
end;
$$;

create trigger savings_goal_entries_currency_guard
  before insert or update on savings_goal_entries
  for each row execute function enforce_goal_entry_currency();

-- ---------------------------------------------------------------------------
-- investment portfolio
-- ---------------------------------------------------------------------------

create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  symbol text not null check (char_length(trim(symbol)) between 1 and 24),
  asset_class asset_class not null,
  -- The currency the asset trades and is valued in. Trades and prices must
  -- match it; the application refuses to value a position with a price quoted
  -- in a different currency.
  currency char(3) not null references currencies (code),
  description text not null default '' check (char_length(description) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol, currency)
);

create index assets_user_idx on assets (user_id, archived_at nulls first, name);

create table investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  side investment_side not null,
  quantity numeric(28, 8) not null check (quantity > 0),
  unit_price numeric(28, 8) not null check (unit_price >= 0),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  currency char(3) not null references currencies (code),
  occurred_on date not null,
  note text not null default '' check (char_length(note) <= 240),
  -- Optional link to the cash side of the trade.
  transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cost-basis replay reads an asset's trades in date order; the id tiebreak
-- keeps same-day trades deterministic.
create index investment_transactions_asset_date_idx
  on investment_transactions (asset_id, occurred_on, id);
create index investment_transactions_user_idx
  on investment_transactions (user_id, occurred_on desc);

create table asset_price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid not null references assets (id) on delete cascade,
  price numeric(28, 8) not null check (price >= 0),
  currency char(3) not null references currencies (code),
  -- When the price was observed. Surfaced in the UI so a three-week-old
  -- valuation is never presented as today's price.
  as_of timestamptz not null default now(),
  -- 'manual' today; a future rate provider becomes another source value
  -- without a schema change.
  source text not null default 'manual' check (char_length(source) <= 40),
  created_at timestamptz not null default now(),
  unique (asset_id, as_of, source)
);

create index asset_price_history_asset_asof_idx
  on asset_price_history (asset_id, as_of desc);
create index asset_price_history_user_idx on asset_price_history (user_id);

-- Trades, fees and prices are denominated in the asset's own currency.
create or replace function enforce_asset_currency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  asset_currency char(3);
  asset_owner uuid;
begin
  select currency, user_id into asset_currency, asset_owner
  from assets where id = new.asset_id;

  if asset_currency is null then
    raise exception 'Asset % does not exist', new.asset_id;
  end if;
  if asset_owner <> new.user_id then
    raise exception 'Asset % belongs to another user', new.asset_id;
  end if;
  if new.currency <> asset_currency then
    raise exception
      'Currency % does not match asset currency %', new.currency, asset_currency;
  end if;
  return new;
end;
$$;

create trigger investment_transactions_currency_guard
  before insert or update on investment_transactions
  for each row execute function enforce_asset_currency();

create trigger asset_price_history_currency_guard
  before insert or update on asset_price_history
  for each row execute function enforce_asset_currency();

-- ---------------------------------------------------------------------------
-- CSV import batches
-- ---------------------------------------------------------------------------

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) <= 255),
  byte_size integer not null check (byte_size >= 0),
  row_count integer not null default 0 check (row_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  status import_status not null default 'pending',
  -- Per-row rejection reasons, so a partial import can explain itself.
  error_report jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index import_batches_user_idx on import_batches (user_id, created_at desc);

alter table transactions
  add constraint transactions_import_batch_fkey
  foreign key (import_batch_id) references import_batches (id) on delete set null;

alter table transactions
  add constraint transactions_goal_fkey
  foreign key (goal_id) references savings_goals (id) on delete set null;

alter table transactions
  add constraint transactions_asset_fkey
  foreign key (asset_id) references assets (id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger transactions_updated_at before update on transactions
  for each row execute function set_updated_at();
create trigger budgets_updated_at before update on budgets
  for each row execute function set_updated_at();
create trigger savings_goals_updated_at before update on savings_goals
  for each row execute function set_updated_at();
create trigger assets_updated_at before update on assets
  for each row execute function set_updated_at();
create trigger investment_transactions_updated_at
  before update on investment_transactions
  for each row execute function set_updated_at();
