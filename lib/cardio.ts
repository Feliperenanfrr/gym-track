import { WorkoutLog } from "./types"

/** Minutos que realmente devem entrar na meta de base aeróbica. */
export function zone2Minutes(workout: WorkoutLog): number {
  if (!workout.cardio) return 0
  if (workout.cardio.purpose) {
    return workout.cardio.purpose === "zone2" ? workout.cardio.minutes : 0
  }
  // Compatibilidade com registros anteriores à classificação de finalidade.
  return workout.sessionId === "sport" ? 0 : workout.cardio.minutes
}
