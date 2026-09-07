-- Fase 1 — Alimentação
--
-- Duas tabelas, com a MESMA separação de workout_templates: a refeição fixa é
-- o molde, e o que foi comido num dia é um SNAPSHOT completo dentro de
-- meal_logs.refeicoes. Reimportar uma refeição pela gem do Gemini e salvar por
-- cima do molde não toca em nenhum dia já registrado — só nos próximos.
--
-- meal_logs é uma linha por DIA (idioma de hydration_logs/body_logs): a chave
-- lógica da fila de sincronização é só a data, e o payload carrega o dia
-- inteiro, então gravações repetidas do mesmo dia colapsam na última.

create table if not exists public.meal_templates (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  nome text not null,
  slot text not null,
  itens jsonb not null default '[]'::jsonb,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint meal_templates_itens_array check (jsonb_typeof(itens) = 'array'),
  constraint meal_templates_slot_valido
    check (slot in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia'))
);

create table if not exists public.meal_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  refeicoes jsonb not null default '[]'::jsonb,
  -- "registrei tudo": sem isso, um dia com café salvo e jantar esquecido
  -- entraria na média como se você tivesse comido 900 kcal.
  completo boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint meal_logs_refeicoes_array check (jsonb_typeof(refeicoes) = 'array')
);

alter table public.meal_templates enable row level security;
alter table public.meal_logs enable row level security;

drop policy if exists "meal_templates_select_own" on public.meal_templates;
create policy "meal_templates_select_own" on public.meal_templates
  for select using (auth.uid() = user_id);

drop policy if exists "meal_templates_insert_own" on public.meal_templates;
create policy "meal_templates_insert_own" on public.meal_templates
  for insert with check (auth.uid() = user_id);

drop policy if exists "meal_templates_update_own" on public.meal_templates;
create policy "meal_templates_update_own" on public.meal_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_templates_delete_own" on public.meal_templates;
create policy "meal_templates_delete_own" on public.meal_templates
  for delete using (auth.uid() = user_id);

drop policy if exists "meal_logs_select_own" on public.meal_logs;
create policy "meal_logs_select_own" on public.meal_logs
  for select using (auth.uid() = user_id);

drop policy if exists "meal_logs_insert_own" on public.meal_logs;
create policy "meal_logs_insert_own" on public.meal_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "meal_logs_update_own" on public.meal_logs;
create policy "meal_logs_update_own" on public.meal_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meal_logs_delete_own" on public.meal_logs;
create policy "meal_logs_delete_own" on public.meal_logs
  for delete using (auth.uid() = user_id);

revoke all on public.meal_templates from anon;
revoke all on public.meal_logs from anon;
grant select, insert, update, delete on public.meal_templates to authenticated;
grant select, insert, update, delete on public.meal_logs to authenticated;

create or replace function public.touch_meal_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meal_templates_touch_updated_at on public.meal_templates;
create trigger meal_templates_touch_updated_at
before update on public.meal_templates
for each row execute function public.touch_meal_updated_at();

drop trigger if exists meal_logs_touch_updated_at on public.meal_logs;
create trigger meal_logs_touch_updated_at
before update on public.meal_logs
for each row execute function public.touch_meal_updated_at();
