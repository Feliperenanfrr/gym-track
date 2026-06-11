-- Fase 1 — Hidratação diária
-- Tabela própria (não coluna em body_logs): água é registrada o dia todo,
-- sem pesagem, e weight_kg lá é NOT NULL.

create table if not exists public.hydration_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  ml integer not null default 0 check (ml >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.hydration_logs enable row level security;

create policy "hydration_select_own" on public.hydration_logs
  for select using (auth.uid() = user_id);

create policy "hydration_insert_own" on public.hydration_logs
  for insert with check (auth.uid() = user_id);

create policy "hydration_update_own" on public.hydration_logs
  for update using (auth.uid() = user_id);

create policy "hydration_delete_own" on public.hydration_logs
  for delete using (auth.uid() = user_id);
