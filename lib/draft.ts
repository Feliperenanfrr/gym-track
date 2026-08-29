import { CardioPurpose, CardioRow, ExercisePrescription, SetRow } from "./types"

/**
 * Rascunho do treino em andamento (localStorage), por data + sessão.
 * Sobrevive a recarga da aba, troca de app e bloqueio de tela — a pior
 * frustração possível seria perder as séries já digitadas no meio do treino.
 */
export interface WorkoutDraft {
  rows: Record<string, SetRow[]>
  /** Exercícios efetivamente escolhidos, incluindo trocas e adições. */
  exercises?: ExercisePrescription[]
  /** Blocos de cardio da sessão (bike, corrida, caminhada de volta…) */
  cardioRows?: CardioRow[]
  /* Campos de cardio único, anteriores aos blocos. Rascunhos são do dia:
     ficam aqui só para não descartar o que já estava digitado. */
  cardioMin?: string
  cardioBpm?: string
  cardioMode?: string
  cardioPurpose?: CardioPurpose
  finisherMin?: string
  /** false = pular o finisher de Zona 2 (nada de cardio é salvo) */
  finisherDone?: boolean
  /** observações livres da sessão (salvas junto no log) */
  notes?: string
  savedAt: number
  /** epoch ms da primeira série marcada (p/ duração real da sessão) */
  startedAt?: number
}

/**
 * Blocos de cardio de um rascunho, convertendo o formato antigo de bloco
 * único (cardio da sessão + finisher) na lista atual.
 */
export function draftCardioRows(
  draft: WorkoutDraft,
  fallbackPurpose: CardioPurpose,
  finisherMode: string
): CardioRow[] {
  if (draft.cardioRows) return draft.cardioRows
  const rows: CardioRow[] = []
  if (draft.cardioMin?.trim()) {
    rows.push({
      minutes: draft.cardioMin,
      bpm: draft.cardioBpm ?? "",
      mode: draft.cardioMode ?? "",
      purpose: draft.cardioPurpose ?? fallbackPurpose,
    })
  }
  if (draft.finisherDone !== false && draft.finisherMin?.trim()) {
    rows.push({
      minutes: draft.finisherMin,
      bpm: draft.cardioBpm ?? "",
      mode: finisherMode,
      purpose: "zone2",
    })
  }
  return rows
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

/** Há algo digitado que valha restaurar? (carga, reps, série marcada ou notas) */
export function draftHasContent(draft: WorkoutDraft): boolean {
  const rowsFilled = Object.values(draft.rows ?? {}).some((sets) =>
    sets.some((s) => s.weight.trim() !== "" || s.reps.trim() !== "" || s.done)
  )
  return (
    rowsFilled ||
    (draft.cardioRows?.some((row) => row.minutes.trim() !== "") ?? false) ||
    Boolean(draft.cardioMin?.trim()) ||
    draft.exercises !== undefined ||
    Boolean(draft.notes?.trim())
  )
}
