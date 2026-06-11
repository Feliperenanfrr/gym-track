import { createBrowserClient } from "@supabase/ssr"
import { supabaseEnv } from "./env"

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (client) return client

  const { url, anonKey } = supabaseEnv()
  client = createBrowserClient(url, anonKey)

  return client
}
