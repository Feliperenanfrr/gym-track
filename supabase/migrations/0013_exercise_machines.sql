-- Fase 3 — Máquinas
--
-- A cadeira extensora de uma máquina vai a 100 kg e a da outra a 40 com o
-- mesmo esforço. Sem dizer qual máquina foi usada, trocar de máquina parecia
-- regressão: setas para baixo, sugestão de reduzir carga, PR impossível.
--
-- Cada linha é UMA máquina de UM exercício. O treino grava no próprio
-- registro (workouts.entries[].machineId + machineName, JSONB — sem coluna
-- nova) qual máquina foi usada; carga, PR e sugestão se comparam dentro dela.
--
-- O id é gerado no aparelho (mesma escolha de meal_templates): na academia
-- sem sinal, a máquina nasce offline e o treino já a referencia antes de a
-- fila sincronizar. Máquina não é apagada, é arquivada — o histórico aponta
-- para ela.

create table if not exists public.exercise_machines (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  exercise_id text not null,
  name text not null,
  load_unit text not null default 'kg',
  -- passo da carga na unidade da máquina; null = inferido do histórico
  load_step numeric,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint exercise_machines_nome check (char_length(btrim(name)) between 1 and 40),
  constraint exercise_machines_unidade check (load_unit in ('kg', 'lb')),
  constraint exercise_machines_passo check (load_step is null or load_step > 0)
);

create index if not exists exercise_machines_por_exercicio
  on public.exercise_machines (user_id, exercise_id);

alter table public.exercise_machines enable row level security;

drop policy if exists "exercise_machines_select_own" on public.exercise_machines;
create policy "exercise_machines_select_own" on public.exercise_machines
  for select using (auth.uid() = user_id);

drop policy if exists "exercise_machines_insert_own" on public.exercise_machines;
create policy "exercise_machines_insert_own" on public.exercise_machines
  for insert with check (auth.uid() = user_id);

drop policy if exists "exercise_machines_update_own" on public.exercise_machines;
create policy "exercise_machines_update_own" on public.exercise_machines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.exercise_machines from anon;
grant select, insert, update on public.exercise_machines to authenticated;

create or replace function public.touch_exercise_machines_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exercise_machines_touch_updated_at on public.exercise_machines;
create trigger exercise_machines_touch_updated_at
before update on public.exercise_machines
for each row execute function public.touch_exercise_machines_updated_at();
