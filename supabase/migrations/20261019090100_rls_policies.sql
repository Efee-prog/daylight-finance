-- Row Level Security for every user-owned table.
--
-- The threat this addresses: a Supabase anon key lives in the browser, so the
-- database must assume every query is attacker-controlled. Authorisation
-- therefore cannot live in the application. These policies make the user id
-- come from the verified JWT (`auth.uid()`) and never from the request body,
-- so a client that sends someone else's user_id gets zero rows, not theirs.
--
-- Two details that matter:
--
--  * WITH CHECK is set on insert and update, not just USING. Without it a user
--    could update their own row and reassign it to another user_id, or insert
--    a row already labelled with a victim's id.
--  * References to parent rows (goal_id, asset_id, category_id) are verified
--    against a parent the *caller* owns. A foreign key alone would happily let
--    a user attach their trade to another user's asset.

-- ---------------------------------------------------------------------------
-- currencies: shared reference data, readable by any signed-in user,
-- writable by nobody through the API.
-- ---------------------------------------------------------------------------

alter table currencies enable row level security;

create policy currencies_select on currencies
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

create policy profiles_select_own on profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Deliberately no delete policy: a profile row disappears only when the
-- auth.users row it references is deleted, which cascades.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

alter table categories enable row level security;

create policy categories_select_own on categories
  for select to authenticated using (user_id = auth.uid());

create policy categories_insert_own on categories
  for insert to authenticated with check (user_id = auth.uid());

create policy categories_update_own on categories
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy categories_delete_own on categories
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

alter table transactions enable row level security;

create policy transactions_select_own on transactions
  for select to authenticated using (user_id = auth.uid());

-- Every referenced parent must also belong to the caller. The FKs guarantee
-- the rows exist; these clauses guarantee they are the caller's own.
create policy transactions_insert_own on transactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
    and (
      goal_id is null
      or exists (
        select 1 from savings_goals g
        where g.id = goal_id and g.user_id = auth.uid()
      )
    )
    and (
      asset_id is null
      or exists (
        select 1 from assets a
        where a.id = asset_id and a.user_id = auth.uid()
      )
    )
  );

create policy transactions_update_own on transactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      category_id is null
      or exists (
        select 1 from categories c
        where c.id = category_id and c.user_id = auth.uid()
      )
    )
    and (
      goal_id is null
      or exists (
        select 1 from savings_goals g
        where g.id = goal_id and g.user_id = auth.uid()
      )
    )
    and (
      asset_id is null
      or exists (
        select 1 from assets a
        where a.id = asset_id and a.user_id = auth.uid()
      )
    )
  );

create policy transactions_delete_own on transactions
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

alter table budgets enable row level security;

create policy budgets_select_own on budgets
  for select to authenticated using (user_id = auth.uid());

create policy budgets_insert_own on budgets
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  );

create policy budgets_update_own on budgets
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  );

create policy budgets_delete_own on budgets
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- savings goals
-- ---------------------------------------------------------------------------

alter table savings_goals enable row level security;

create policy savings_goals_select_own on savings_goals
  for select to authenticated using (user_id = auth.uid());

create policy savings_goals_insert_own on savings_goals
  for insert to authenticated with check (user_id = auth.uid());

create policy savings_goals_update_own on savings_goals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy savings_goals_delete_own on savings_goals
  for delete to authenticated using (user_id = auth.uid());

alter table savings_goal_entries enable row level security;

create policy savings_goal_entries_select_own on savings_goal_entries
  for select to authenticated using (user_id = auth.uid());

create policy savings_goal_entries_insert_own on savings_goal_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from savings_goals g
      where g.id = goal_id and g.user_id = auth.uid()
    )
    and (
      transaction_id is null
      or exists (
        select 1 from transactions t
        where t.id = transaction_id and t.user_id = auth.uid()
      )
    )
  );

create policy savings_goal_entries_update_own on savings_goal_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from savings_goals g
      where g.id = goal_id and g.user_id = auth.uid()
    )
  );

create policy savings_goal_entries_delete_own on savings_goal_entries
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- investment portfolio
-- ---------------------------------------------------------------------------

alter table assets enable row level security;

create policy assets_select_own on assets
  for select to authenticated using (user_id = auth.uid());

create policy assets_insert_own on assets
  for insert to authenticated with check (user_id = auth.uid());

create policy assets_update_own on assets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy assets_delete_own on assets
  for delete to authenticated using (user_id = auth.uid());

alter table investment_transactions enable row level security;

create policy investment_transactions_select_own on investment_transactions
  for select to authenticated using (user_id = auth.uid());

create policy investment_transactions_insert_own on investment_transactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from assets a
      where a.id = asset_id and a.user_id = auth.uid()
    )
  );

create policy investment_transactions_update_own on investment_transactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from assets a
      where a.id = asset_id and a.user_id = auth.uid()
    )
  );

create policy investment_transactions_delete_own on investment_transactions
  for delete to authenticated using (user_id = auth.uid());

alter table asset_price_history enable row level security;

create policy asset_price_history_select_own on asset_price_history
  for select to authenticated using (user_id = auth.uid());

create policy asset_price_history_insert_own on asset_price_history
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from assets a
      where a.id = asset_id and a.user_id = auth.uid()
    )
  );

create policy asset_price_history_delete_own on asset_price_history
  for delete to authenticated using (user_id = auth.uid());

-- No update policy: a recorded observation is corrected by deleting it and
-- recording a new one, which keeps the valuation history honest.

-- ---------------------------------------------------------------------------
-- import batches
-- ---------------------------------------------------------------------------

alter table import_batches enable row level security;

create policy import_batches_select_own on import_batches
  for select to authenticated using (user_id = auth.uid());

create policy import_batches_insert_own on import_batches
  for insert to authenticated with check (user_id = auth.uid());

create policy import_batches_update_own on import_batches
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy import_batches_delete_own on import_batches
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

-- Creates the profile row and a small set of starter categories the moment a
-- user signs up, so the app never has to handle a signed-in user with no
-- profile. SECURITY DEFINER because it runs as the auth trigger, before the
-- new user has a session of their own; search_path is pinned so a mutable
-- search_path cannot be used to hijack the definer's privileges.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  -- `name` here is only the fallback label; the UI renders a translated name
  -- from `system_key` until the user renames the category themselves.
  insert into public.categories (user_id, name, kind, is_system, system_key)
  values
    (new.id, 'Salary', 'income', true, 'salary'),
    (new.id, 'Other income', 'income', true, 'other_income'),
    (new.id, 'Housing', 'expense', true, 'housing'),
    (new.id, 'Groceries', 'expense', true, 'groceries'),
    (new.id, 'Dining out', 'expense', true, 'dining_out'),
    (new.id, 'Transport', 'expense', true, 'transport'),
    (new.id, 'Utilities', 'expense', true, 'utilities'),
    (new.id, 'Health', 'expense', true, 'health'),
    (new.id, 'Other expense', 'expense', true, 'other_expense');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
