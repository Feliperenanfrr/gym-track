import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseEnv } from "@/lib/supabase/env"

/**
 * Keep-alive do Supabase, chamado uma vez por dia pelo cron da Vercel
 * (vercel.json).
 *
 * O plano Free pausa o projeto depois de 7 dias sem uso, e o app inteiro para
 * de responder até alguém restaurar no painel. Precisa ser uma consulta de
 * verdade ao banco: a anon key não lê nenhuma tabela (RLS + revoke), então a
 * rota chama a RPC keep_alive() (migration 0014), que só devolve now().
 *
 * Com CRON_SECRET definida na Vercel, só o cron passa (ele manda o Bearer).
 * Sem ela a rota fica aberta, mas não expõe nada além da hora do banco.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const { url, anonKey } = supabaseEnv()
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.rpc("keep_alive")
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  }
  return NextResponse.json({ ok: true, at: data })
}
