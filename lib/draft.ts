import { SetRow } from "./types"

/**
 * Rascunho do treino em andamento (localStorage), por data + sessão.
 * Sobrevive a recarga da aba, troca de app e bloqueio de tela — a pior
 * frustração possível seria perder as séries já digitadas no meio do treino.
 */
export interface WorkoutDraft {
  rows: Record<string, SetRow[]>
  cardioMin: string
  cardioBpm: string
  cardioMode: string
  finisherMin: string
  savedAt: number
  /** epoch ms da primeira série marcada (p/ duração real da sessão) */
  startedAt?: number
}

const key = (date: string, sessionId: string) =>
  `gym-track:draft:${date}:${sessionId}`

export function loadDraft(date: string, sessionId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(key(date, sessionId))
    return raw ? (JSON.parse(raw) as WorkoutDraft) : null
  } catch {
    return null
  }
}

export function saveDraft(date: string, sessionId: string, draft: WorkoutDraft) {
  try {
    localStorage.setItem(key(date, sessionId), JSON.stringify(draft))
  } catch {
    /* cota cheia / modo privado — ignora */
  }
}

export function clearDraft(date: string, sessionId: string) {
  try {
    localStorage.removeItem(key(date, sessionId))
  } catch {
    /* ignore */
  }
}

/** Há algo digitado que valha restaurar? (carga, reps ou série marcada) */
export function draftHasContent(draft: WorkoutDraft): boolean {
  const rowsFilled = Object.values(draft.rows ?? {}).some((sets) =>
    sets.some((s) => s.weight.trim() !== "" || s.reps.trim() !== "" || s.done)
  )
  return rowsFilled
}
