-- Role só de leitura para a gym-track-api (serviço no Railway)
--
-- A API roda no servidor, sem sessão de usuário: pelas policies atuais
-- (auth.uid() = user_id) ela não enxergaria nada. As alternativas eram a
-- service_role (ignora RLS e ESCREVE em tudo) ou guardar a senha do login no
-- Railway. Um role próprio limita o estrago de um vazamento da DATABASE_URL:
-- só SELECT, e só em workouts e body_logs — sono, hidratação, refeições e
-- templates ficam fora do alcance.
--
-- O role nasce NOLOGIN. A senha não vai para o git: é definida à parte com
--   alter role api_reader with login password '...';
-- e a conexão usa o pooler do Supabase com o usuário api_reader.<project-ref>.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'api_reader') then
    create role api_reader nologin noinherit;
  end if;
end
$$;

-- Consulta travada não segura conexão do pooler.
alter role api_reader set statement_timeout = '5s';

grant usage on schema public to api_reader;
grant select on public.workouts, public.body_logs to api_reader;

-- Policies permissivas somam (OR): estas só valem para api_reader e não
-- alteram o que o usuário logado no app enxerga.
drop policy if exists "api_reader_select_workouts" on public.workouts;
create policy "api_reader_select_workouts" on public.workouts
  for select to api_reader using (true);

drop policy if exists "api_reader_select_body_logs" on public.body_logs;
create policy "api_reader_select_body_logs" on public.body_logs
  for select to api_reader using (true);
