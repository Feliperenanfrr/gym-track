-- Keep-alive do plano Free
--
-- O Supabase Free pausa o projeto depois de 7 dias sem uso, e o app inteiro
-- para de responder até alguém restaurar no painel (aconteceu em 22/10/2026).
-- O cron da Vercel (vercel.json → /api/keep-alive) chama esta função uma vez
-- por dia com a anon key. A anon key não lê nenhuma tabela (RLS + revoke de
-- anon em todas), daí uma função própria: não toca em dado nenhum, devolve só
-- a hora do banco.

create or replace function public.keep_alive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;

-- a RPC só aparece na API depois que o PostgREST relê o schema
notify pgrst, 'reload schema';
