import { cardioBlocks } from "./cardio"
import {
  CardioRow,
  ExercisePrescription,
  SessionPlan,
  SetRow,
  WorkoutLog,
} from "./types"

/** Prescrição mínima para um exercício que não está no plano nem no catálogo. */
const FALLBACK: Omit<ExercisePrescription, "id" | "name"> = {
  nameEn: "",
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  unit: "reps",
  rest: "90 s",
  note: "",
}

export interface OpenedWorkout {
  exercises: ExercisePrescription[]
  rows: Record<string, SetRow[]>
  cardioRows: CardioRow[]
  notes: string
}

/**
 * Reabre um registro já salvo no formulário de treino.
 *
 * A gravação é upsert por (data, sessão): salvar de novo no mesmo dia
 * SUBSTITUI o registro anterior. Sem isto, quem registrasse um avulso de manhã
 * e outro à noite perdia o primeiro — e quem esquecesse um exercício teria de
 * redigitar a sessão inteira para não perder o resto.
 */
export function openLogForEditing(
  log: WorkoutLog,
  session: SessionPlan,
  catalog: ExercisePrescription[] = []
): OpenedWorkout {
  const exercises: ExercisePrescription[] = []
  const rows: Record<string, SetRow[]> = {}

  for (const entry of log.entries) {
    const known =
      session.exercises.find((ex) => ex.id === entry.exerciseId) ??
      catalog.find((ex) => ex.id === entry.exerciseId)
    exercises.push({
      ...(known ?? { ...FALLBACK, id: entry.exerciseId, name: entry.exerciseName ?? entry.exerciseId }),
      // o registro manda no número de séries: foi o que aconteceu de verdade
      sets: Math.max(1, entry.sets.length),
      muscleGroup: entry.muscleGroup ?? known?.muscleGroup,
    })
    rows[entry.exerciseId] = entry.sets.map((set) => ({
      weight: set.weight > 0 ? String(set.weight) : "",
      reps: String(set.reps),
      done: true,
      rir: set.rir !== undefined ? String(set.rir) : "",
    }))
  }

  return {
    exercises,
    rows,
    cardioRows: cardioBlocks(log).map((block) => ({
      minutes: String(block.minutes),
      bpm: block.avgBpm ? String(block.avgBpm) : "",
      mode: block.mode,
      purpose: block.purpose ?? "zone2",
    })),
    notes: log.notes ?? "",
  }
}

/**
 * Minutos de sala já contabilizados num registro (duração total menos os
 * blocos de cardio). Reabrir a sessão para completar não pode zerar o tempo
 * que já tinha sido medido.
 */
export function loggedLiftMinutes(log: WorkoutLog): number {
  const cardioMinutes = cardioBlocks(log).reduce((sum, block) => sum + block.minutes, 0)
  return Math.max(0, (log.durationMin ?? 0) - cardioMinutes)
}
