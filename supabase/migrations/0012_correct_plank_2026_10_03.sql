-- Prancha de 2026-10-03 registrada como dead bug.
--
-- No seletor, buscar "prancha" não mostrava nenhuma prancha simples: o id
-- "plank" era dividido entre "Prancha" (Lower A) e "Prancha com deslocamento"
-- (pré-temporada), e a segunda vencia. O item que parecia a prancha era o
-- "Dead bug / prancha" do protocolo aposentado — medido em repetições. As
-- 3 × 60 viraram 60 REPETIÇÕES de dead bug, com RIR 0.
--
-- A correção move a entrada para "plank" (Prancha, segundos), grava a unidade
-- no próprio registro e tira o RIR, que não se aplica a isometria. Carga (0)
-- e os 60 de cada série são preservados.
--
-- As travas de ID, data, sessão e conteúdo anterior fazem o script falhar em
-- vez de alcançar outro registro caso o banco tenha sido alterado antes dele.

do $$
declare
  affected_rows integer;
begin
  update public.workouts as workout
  set entries = (
    select jsonb_agg(
      case
        when entry.item ->> 'exerciseId' = 'dead-bug' then
          entry.item || jsonb_build_object(
            'exerciseId', 'plank',
            'exerciseName', 'Prancha',
            'muscleGroup', 'Core',
            'unit', 'seconds',
            'sets', (
              select jsonb_agg(series.item - 'rir' order by series.position)
              from jsonb_array_elements(entry.item -> 'sets')
                with ordinality as series(item, position)
            )
          )
        else entry.item
      end
      order by entry.position
    )
    from jsonb_array_elements(workout.entries) with ordinality as entry(item, position)
  )
  where workout.id = '99c01468-be51-491f-9556-e713b4584bf5'::uuid
    and workout.date = date '2026-10-03'
    and workout.session_id = 'free'
    and exists (
      select 1
      from jsonb_array_elements(workout.entries) as entry(item)
      where entry.item ->> 'exerciseId' = 'dead-bug'
        and entry.item ->> 'exerciseName' = 'Dead bug / prancha'
    );

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to correct exactly one 2026-10-03 dead-bug entry; updated % rows.', affected_rows;
  end if;
end $$;
