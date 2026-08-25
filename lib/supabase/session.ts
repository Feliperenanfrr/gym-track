import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Sessão morreu? Reconhece as mensagens clássicas de token vencido/revogado
 * que chegam do GoTrue e do PostgREST ("JWT expired", "Invalid Refresh
 * Token: Already Used", 401…). É o gatilho para tentar renovar em vez de
 * deixar a tela travada num erro que só "sumia limpando o cache".
 */
export function isAuthError(message: string | null | undefined): boolean {
  if (!message) return false
  return (
    /\bjwt\b/i.test(message) ||
    /expirad/i.test(message) ||
    /invalid refresh token|refresh token not found|already used/i.test(message) ||
    /unauthorized|\b401\b/i.test(message) ||
    /invalid claim|signature verification/i.test(message)
  )
}

/** Sessão só conta como válida com essa folga antes do vencimento. */
const SAFE_MARGIN_MS = 30_000

/**
 * Tenta trazer a sessão de volta sem interação: se o access token ainda vale,
 * pronto; senão renova via refresh token UMA vez. false = sessão irrecuperável.
 */
export async function recoverSession(supabase: SupabaseClient): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.expires_at && session.expires_at * 1000 - Date.now() > SAFE_MARGIN_MS) {
      return true
    }
    const { data, error } = await supabase.auth.refreshSession()
    return Boolean(data.session) && !error
  } catch {
    return false
  }
}

/**
 * Último recurso: encerra limpo (cookies do Supabase incluídos) e vai para o
 * login. Substitui o ritual manual de limpar cache/dados do navegador.
 */
export async function signOutToLogin(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch {
    // mesmo sem conseguir revogar no servidor, seguir para o login já
    // recoloca o usuário num estado funcional
  }
  if (typeof window !== "undefined") {
    window.location.href = "/login"
  }
}

/**
 * Executa a operação no banco; se falhar por sessão vencida/revogada, tenta
 * renovar o token e repetir UMA vez. Sem recuperação possível, encerra limpo
 * no login em vez de propagar o erro de JWT para a tela.
 */
export async function runWithFreshSession<T>(
  supabase: SupabaseClient,
  op: () => Promise<T>,
  retried = false
): Promise<T> {
  try {
    return await op()
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!isAuthError(message)) throw e
    if (retried || !(await recoverSession(supabase))) {
      await signOutToLogin(supabase)
      throw new Error("Sessão expirada — faça login novamente.")
    }
    return runWithFreshSession(supabase, op, true)
  }
}
