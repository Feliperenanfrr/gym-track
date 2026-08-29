-- Vários blocos de cardio por treino
-- Um treino pode ter mais de um cardio: 15 min de bike, 15 min de corrida e a
-- caminhada de volta para casa são estímulos diferentes, com modalidade e
-- finalidade próprias. A coluna `cardio` guardava um objeto só, então o
-- segundo bloco do dia era impossível de registrar (a chave do upsert é
-- user_id + date + session_id).
--
-- `cardios` passa a ser a lista ordenada de blocos. A coluna antiga continua
-- preenchida com o PRIMEIRO bloco: registros anteriores seguem legíveis sem
-- backfill e nada quebra se uma versão antiga do app ler a linha.

alter table public.workouts
  add column if not exists cardios jsonb;

alter table public.workouts
  drop constraint if exists workouts_cardios_is_array;

alter table public.workouts
  add constraint workouts_cardios_is_array
  check (cardios is null or jsonb_typeof(cardios) = 'array');
