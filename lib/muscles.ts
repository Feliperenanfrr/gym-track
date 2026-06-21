import { MuscleGroup, WorkoutLog } from "./types"

/**
 * Classificação dos exercícios do plano por parte do corpo, para o
 * gráfico de volume por grupo muscular (caça desequilíbrios do shape).
 */
/** Ordem de empilhamento no gráfico (maiores embaixo) e cor de cada grupo */
export const MUSCLE_GROUPS: { id: MuscleGroup; color: string }[] = [
  { id: "Quadríceps", color: "#f472b6" },
  { id: "Posterior/Glúteo", color: "#c084fc" },
  { id: "Panturrilha", color: "#38bdf8" },
  { id: "Costas", color: "#2dd4bf" },
  { id: "Peito", color: "#ff5a1f" },
  { id: "Ombro", color: "#fbbf24" },
  { id: "Braço", color: "#818cf8" },
  { id: "Core", color: "#97919e" },
]

export const EXERCISE_GROUP: Record<string, MuscleGroup> = {
  // Upper A
  bench: "Peito",
  row: "Costas",
  ohp: "Ombro",
  pulldown: "Costas",
  curl: "Braço",
  skull: "Braço",
  // Lower A
  squat: "Quadríceps",
  rdl: "Posterior/Glúteo",
  legpress: "Quadríceps",
  legcurl: "Posterior/Glúteo",
  calf: "Panturrilha",
  plank: "Core",
  // Upper B
  incline: "Peito",
  chestrow: "Costas",
  lateral: "Ombro",
  facepull: "Ombro",
  hammer: "Braço",
  pushdown: "Braço",
  // Lower B
  hack: "Quadríceps",
  deadlift: "Posterior/Glúteo",
  legext: "Quadríceps",
  seatedcurl: "Posterior/Glúteo",
  seatedcalf: "Panturrilha",
  cablecrunch: "Core",
}

/** Volume (kg) por grupo muscular de um conjunto de treinos */
export function volumeByGroup(workouts: WorkoutLog[]): Record<MuscleGroup, number> {
  const out = Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [g.id, 0])
  ) as Record<MuscleGroup, number>
  for (const w of workouts) {
    for (const e of w.entries) {
      const group = e.muscleGroup ?? EXERCISE_GROUP[e.exerciseId]
      if (!group) continue
      out[group] += e.sets.reduce((s, set) => s + set.weight * set.reps, 0)
    }
  }
  return out
}

/**
 * Séries duras por grupo muscular.
 * RIR é opcional: série sem RIR conta para manter o histórico antigo válido.
 * Quando informado, RIR 0-3 conta; RIR 4+ é tratado como estímulo leve.
 */
export function hardSetsByGroup(workouts: WorkoutLog[]): Record<MuscleGroup, number> {
  const out = Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [g.id, 0])
  ) as Record<MuscleGroup, number>
  for (const w of workouts) {
    for (const e of w.entries) {
      const group = e.muscleGroup ?? EXERCISE_GROUP[e.exerciseId]
      if (!group) continue
      out[group] += e.sets.filter((set) => set.reps > 0 && (set.rir === undefined || set.rir <= 3)).length
    }
  }
  return out
}
