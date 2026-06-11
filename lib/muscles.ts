import { WorkoutLog } from "./types"

/**
 * Classificação dos exercícios do plano por parte do corpo, para o
 * gráfico de volume por grupo muscular (caça desequilíbrios do shape).
 */
export type MuscleGroup = "Perna" | "Costas" | "Peito" | "Ombro" | "Braço" | "Core"

/** Ordem de empilhamento no gráfico (maiores embaixo) e cor de cada grupo */
export const MUSCLE_GROUPS: { id: MuscleGroup; color: string }[] = [
  { id: "Perna", color: "#f472b6" },
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
  squat: "Perna",
  rdl: "Perna",
  legpress: "Perna",
  legcurl: "Perna",
  calf: "Perna",
  plank: "Core",
  // Upper B
  incline: "Peito",
  chestrow: "Costas",
  lateral: "Ombro",
  facepull: "Ombro",
  hammer: "Braço",
  pushdown: "Braço",
  // Lower B
  hack: "Perna",
  deadlift: "Perna",
  legext: "Perna",
  seatedcurl: "Perna",
  seatedcalf: "Perna",
  cablecrunch: "Core",
}

/** Volume (kg) por grupo muscular de um conjunto de treinos */
export function volumeByGroup(workouts: WorkoutLog[]): Record<MuscleGroup, number> {
  const out = Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [g.id, 0])
  ) as Record<MuscleGroup, number>
  for (const w of workouts) {
    for (const e of w.entries) {
      const group = EXERCISE_GROUP[e.exerciseId]
      if (!group) continue
      out[group] += e.sets.reduce((s, set) => s + set.weight * set.reps, 0)
    }
  }
  return out
}
