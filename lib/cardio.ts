import { WorkoutLog } from "./types"

/** Minutos que realmente devem entrar na meta de base aeróbica (Zona 2). */
export function zone2Minutes(workout: WorkoutLog): number {
  if (!workout.cardio) return 0
  if (workout.cardio.purpose) {
    return workout.cardio.purpose === "zone2" ? workout.cardio.minutes : 0
  }
  // Compatibilidade com registros anteriores à classificação de finalidade.
  return workout.sessionId === "sport" ? 0 : workout.cardio.minutes
}

/**
 * Minutos de cardio intenso (HIIT/tiros) — condicionamento que aparece à parte,
 * fora da meta de Z2. Não há dupla contagem com zone2Minutes: cada log cai numa
 * categoria só (logs antigos sem `purpose` entram como Z2 por compatibilidade).
 */
export function intenseMinutes(workout: WorkoutLog): number {
  return workout.cardio?.purpose === "intense" ? workout.cardio.minutes : 0
}
