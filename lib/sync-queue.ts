import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Fila de gravações pendentes (localStorage). Academia tem sinal ruim: ao
 * salvar offline, a mutação entra aqui e é reenviada quando a rede volta.
 * Cada item tem uma chave lógica (igual ao conflito do upsert) para que
 * múltiplas edições da mesma sessão/dia colapsem na última.
 */
export interface PendingMutation {
  action?: "upsert" | "delete"
  table: "workouts" | "body_logs" | "hydration_logs" | "sleep_logs"
  onConflict: string
  /** chave lógica para deduplicar (date+session ou date) */
  logicalKey: string
  payload: Record<string, unknown>
  queuedAt?: number
}

const KEY = "gym-track:sync-queue:v1"

function read(): PendingMutation[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingMutation[]) : []
  } catch {
    return []
  }
}

function write(items: PendingMutation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function queueCount(): number {
  return read().length
}

/** Adiciona (ou substitui a anterior de mesma tabela + chave lógica) */
export function enqueue(mutation: Omit<PendingMutation, "queuedAt">) {
  const items = read().filter(
    (m) => !(m.table === mutation.table && m.logicalKey === mutation.logicalKey)
  )
  items.push({ ...mutation, queuedAt: Date.now() })
  write(items)
}

/**
 * Tenta reenviar tudo. Para no primeiro erro de rede (mantém o resto na fila).
 * Erros de API/RLS removem o item (não adianta reenviar payload inválido).
 * Retorna quantos itens permaneceram pendentes.
 */
export async function flushQueue(supabase: SupabaseClient): Promise<number> {
  let items = read()
  if (items.length === 0) return 0

  for (const item of [...items]) {
    try {
      if (item.action === "delete") {
        const { error } = await supabase.from(item.table).delete().eq("id", item.payload.id)
        if (error) {
          items = items.filter((m) => m !== item)
          write(items)
          continue
        }
      } else {
        const { error } = await supabase
          .from(item.table)
          .upsert(item.payload, { onConflict: item.onConflict })
        if (error) {
          items = items.filter((m) => m !== item)
          write(items)
          continue
        }
      }
      items = items.filter((m) => m !== item)
      write(items)
    } catch {
      // erro de rede: interrompe e tenta de novo depois
      break
    }
  }
  return read().length
}
