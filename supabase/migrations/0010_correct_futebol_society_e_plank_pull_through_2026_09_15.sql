-- Correções pontuais de dois registros de 2026-09-14 e 2026-09-11.
--
-- 1) O jogo de 14/09 foi registrado como "Futsal" mas foi Futebol Society.
--    Ambos usam purpose "sport" e o mesmo MET_SPORT (insights.ts), então a
--    troca de nome não muda calorias/leitura de carga, só o rótulo exibido.
--
-- 2) O abdominal de 11/09 foi registrado como "russian-twist" (Rotação russa
--    com halter) mas o exercício executado foi Plank Dumbbell Pull-Through.
--    Séries/carga/reps/RIR são preservadas; só exerciseId, exerciseName e
--    muscleGroup mudam.
--
-- As travas de ID, data, sessão e conteúdo anterior fazem o script falhar em
-- vez de alcançar outro registro caso o banco tenha sido alterado antes dele.

do $$
declare
  affected_rows integer;
begin
  update public.workouts
  set
    cardio = jsonb_set(cardio, '{mode}', '"Futebol Society"'::jsonb),
    cardios = jsonb_set(cardios, '{0,mode}', '"Futebol Society"'::jsonb)
  where id = '8808c7a7-c1db-44df-b3c6-e6187134f76a'::uuid
    and date = date '2026-09-14'
    and session_id = 'sport'
    and cardio ->> 'mode' = 'Futsal'
    and jsonb_array_length(cardios) = 1
    and cardios -> 0 ->> 'mode' = 'Futsal';

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to correct exactly one 2026-09-14 Futsal workout; updated % rows.', affected_rows;
  end if;
end $$;

do $$
declare
  affected_rows integer;
begin
  update public.workouts as workout
  set entries = (
    select jsonb_agg(
      case
        when entry.item ->> 'exerciseId' = 'russian-twist' then
          entry.item || jsonb_build_object(
            'exerciseId', 'db-plank-pull-through',
            'exerciseName', 'Prancha com halter (pull-through)',
            'muscleGroup', 'Core'
          )
        else entry.item
      end
      order by entry.position
    )
    from jsonb_array_elements(workout.entries) with ordinality as entry(item, position)
  )
  where workout.id = 'e8768d50-2ffe-480d-aed4-88868088ff7c'::uuid
    and workout.date = date '2026-09-11'
    and workout.session_id = 'free'
    and exists (
      select 1
      from jsonb_array_elements(workout.entries) as entry(item)
      where entry.item ->> 'exerciseId' = 'russian-twist'
    );

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to correct exactly one 2026-09-11 russian-twist entry; updated % rows.', affected_rows;
  end if;
end $$;
