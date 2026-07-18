-- Templates editáveis ficam separados dos registros de treino. Alterar um
-- template afeta apenas os próximos treinos; cada workout continua guardando
-- o snapshot efetivamente executado em entries.
create table if not exists public.workout_templates (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id text not null,
  template jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id),
  constraint workout_templates_template_object check (jsonb_typeof(template) = 'object'),
  constraint workout_templates_matching_id check (template ->> 'id' = session_id)
);

alter table public.workout_templates enable row level security;

drop policy if exists "Users can read own workout templates" on public.workout_templates;
create policy "Users can read own workout templates"
  on public.workout_templates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout templates" on public.workout_templates;
create policy "Users can insert own workout templates"
  on public.workout_templates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout templates" on public.workout_templates;
create policy "Users can update own workout templates"
  on public.workout_templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout templates" on public.workout_templates;
create policy "Users can delete own workout templates"
  on public.workout_templates for delete
  using (auth.uid() = user_id);

revoke all on public.workout_templates from anon;
grant select, insert, update, delete on public.workout_templates to authenticated;

create or replace function public.touch_workout_template_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workout_templates_touch_updated_at on public.workout_templates;
create trigger workout_templates_touch_updated_at
before update on public.workout_templates
for each row execute function public.touch_workout_template_updated_at();

-- Correção do registro de 18/07/2026: o primeiro explosivo executado foi
-- Power Clean, não salto na caixa. Séries/carga/repetições são preservadas.
update public.workouts as workout
set entries = (
  select jsonb_agg(
    case
      when entry.item ->> 'exerciseId' in ('box-jump', 'power-clean') then
        entry.item || jsonb_build_object(
          'exerciseId', 'power-clean',
          'exerciseName', 'Power Clean',
          -- Expressão ASCII-safe também ao aplicar pela Management API no Windows.
          'muscleGroup', convert_from(
            decode('506f73746572696f722f476cc3ba74656f', 'hex'),
            'utf8'
          )
        )
      else entry.item
    end
    order by entry.position
  ) as entries
  from jsonb_array_elements(workout.entries) with ordinality as entry(item, position)
)
where workout.date = date '2026-07-18'
  and workout.session_id = 'competitionLower'
  and exists (
    select 1
    from jsonb_array_elements(workout.entries) as entry(item)
    where entry.item ->> 'exerciseId' in ('box-jump', 'power-clean')
  );
