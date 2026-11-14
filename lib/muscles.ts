import { entryVolume } from "./measure"
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
  { id: "Pescoço", color: "#84cc16" },
]

export const EXERCISE_GROUP: Record<string, MuscleGroup> = {
  "power-clean": "Posterior/Glúteo",
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
  // Recomposição (jul/2026) — novos exercícios do plano
  "db-ohp": "Ombro",
  crossover: "Peito",
  hipthrust: "Posterior/Glúteo",
  // Jiu-jitsu (ago/2026, aposentado) — pegada, pescoço e quadril
  shrug: "Pescoço",
  "wrist-curl": "Braço",
  "push-press": "Ombro",
  "hip-90-90": "Posterior/Glúteo",
  "back-extension": "Posterior/Glúteo",
  // Motor aeróbico (ago/2026) — máquinas das duas sessões de corpo inteiro
  "machine-shoulder-press": "Ombro",
  "machine-crunch": "Core",
  // Pré-temporada de grappling (set/2026) — puxada vertical, pegada e pescoço
  pullup: "Costas",
  "dead-hang": "Costas",
  "neck-iso": "Pescoço",
  "walking-lunge": "Quadríceps",
  "farmer-carry": "Core",
  "farmer-hold": "Core",
  pallof: "Core",
  "plank-reach": "Core",
  "goblet-squat": "Quadríceps",
  "db-row": "Costas",
  pushup: "Peito",
  /* corrida 5 km — Rotina A & Rotina B */
  "foot-short": "Panturrilha",
  "foot-toe-yoga": "Panturrilha",
  "foot-towel-curl": "Panturrilha",
  "foot-single-balance": "Panturrilha",
  "foot-plantar-stretch": "Panturrilha",
  "foot-calf-stretch": "Panturrilha",
  "run-calf-towel": "Panturrilha",
  "run-calf-ball": "Panturrilha",
  "run-calf-bent": "Panturrilha",
  "run-tibial-wall": "Panturrilha",
  "wall-sit-iso": "Quadríceps",
  "side-hip-abduction": "Posterior/Glúteo",
  "band-foot-inversion": "Panturrilha",
  /* corrida 5 km — Rotina C1 (halteres) & Rotina C2 (caneleiras) */
  "run-c1-goblet": "Quadríceps",
  "run-c1-rdl-uni": "Posterior/Glúteo",
  "run-c1-rev-lunge": "Quadríceps",
  "run-c1-glute-bridge-uni": "Posterior/Glúteo",
  "run-c1-calf-uni": "Panturrilha",
  "run-c1-soleus-seated": "Panturrilha",
  "run-c1-suitcase-carry": "Core",
  "run-c2-hip-abd": "Posterior/Glúteo",
  "run-c2-march": "Quadríceps",
  "run-c2-kickback": "Posterior/Glúteo",
  "run-c2-leg-curl-stand": "Posterior/Glúteo",
  "run-c2-leg-ext-iso": "Quadríceps",
  "run-c2-tibialis-band": "Panturrilha",
  "run-c2-side-plank-abd": "Core",
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
      // tempo e distância não são tonelagem — séries duras abaixo contam todas
      out[group] += entryVolume(e)
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
