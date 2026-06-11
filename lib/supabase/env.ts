/**
 * Lê as envs do Supabase removendo espaços, quebras de linha e aspas que
 * costumam entrar junto no copia-e-cola (terminal quebra linhas longas;
 * header Authorization com \n derruba o fetch no browser).
 */
function clean(value: string | undefined, name: string): string {
  const v = (value ?? "").replace(/[\s"']/g, "")
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`)
  return v
}

export function supabaseEnv() {
  return {
    url: clean(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: clean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ),
  }
}
