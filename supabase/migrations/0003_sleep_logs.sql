-- Registro diário de sono
-- A data representa o dia em que acordou. Os horários são locais e a duração
-- fica materializada para permitir ajuste manual quando o relógio não refletir
-- cochilos, despertares ou tempo real dormindo.

create table if not exists public.sleep_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  slept_at time not null,
  woke_at time not null,
  duration_min integer not null check (duration_min between 1 and 1080),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.sleep_logs enable row level security;

create policy "sleep_select_own" on public.sleep_logs
  for select using (auth.uid() = user_id);

create policy "sleep_insert_own" on public.sleep_logs
  for insert with check (auth.uid() = user_id);

create policy "sleep_update_own" on public.sleep_logs
  for update using (auth.uid() = user_id);

create policy "sleep_delete_own" on public.sleep_logs
  for delete using (auth.uid() = user_id);
