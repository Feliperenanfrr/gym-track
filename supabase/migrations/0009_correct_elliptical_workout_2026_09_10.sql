-- Correção pontual do cardio registrado em 10/09/2026.
--
-- O app calcula calorias em leitura (não existe coluna de kcal em workouts).
-- Com o peso de 94,4 kg daquele dia, 10 min de elíptico a 5,0 METs resultam em
-- 82,6 kcal, exibidas como 80 kcal. A mesma entrada como Esteira inclinada
-- usava o fallback de Zona 2 (6,5 METs = 107,4 kcal, exibidas como 110 kcal).
--
-- As travas de ID, data, sessão e conteúdo anterior fazem o script falhar em
-- vez de alcançar outro registro caso o banco tenha sido alterado antes dele.
do $$
declare
  affected_rows integer;
begin
  update public.workouts
  set
    cardio = jsonb_set(cardio, '{mode}', '"Elíptico"'::jsonb),
    cardios = (
      select jsonb_agg(
        case
          when block ->> 'mode' = 'Esteira inclinada'
            then jsonb_set(block, '{mode}', '"Elíptico"'::jsonb)
          else block
        end
      )
      from jsonb_array_elements(cardios) as blocks(block)
    )
  where id = '75a45884-dc44-4beb-af33-c37099cfc53f'::uuid
    and date = date '2026-09-10'
    and session_id = 'engineZ2'
    and cardio ->> 'mode' = 'Esteira inclinada'
    and jsonb_array_length(cardios) = 1
    and cardios -> 0 ->> 'mode' = 'Esteira inclinada';

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected to correct exactly one 2026-09-10 inclined-treadmill workout; updated % rows.', affected_rows;
  end if;
end $$;
