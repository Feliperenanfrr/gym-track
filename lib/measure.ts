import { EXERCISES_BY_ID } from "./plan"
import { formatWeight } from "./progression"
import { ExerciseLog, ExercisePrescription, ExerciseUnit, SetLog, WorkoutLog } from "./types"
import { LoadUnit, loadForInput } from "./units"

/**
 * Tipo de medida de cada exercício: repetições, tempo ou distância.
 *
 * Regra de negócio: um exercício tem UM tipo de medida, e só carga ×
 * repetições alimenta 1RM, PR e tonelagem. Sem isso, 24 kg × 40 m de farmer
 * walk viravam 1RM de 56 kg (e um "PR!" a cada +2 kg da progressão), e uma
 * prancha com carga entraria na tonelagem como se fosse série de supino.
 */

export interface MeasureInfo {
  id: ExerciseUnit
  /** nome no seletor de tipo ("Tempo") */
  label: string
  /** rótulo curto sob o campo da série ("seg") */
  field: string
  /** sufixo depois do número ("60 s"); vazio para repetições */
  suffix: string
}

/** Na ordem em que aparecem no cadastro de exercício. */
export const MEASURES: MeasureInfo[] = [
  { id: "reps", label: "Reps", field: "reps", suffix: "" },
  { id: "seconds", label: "Tempo", field: "seg", suffix: "s" },
  { id: "meters", label: "Distância", field: "metros", suffix: "m" },
]

const BY_ID = Object.fromEntries(MEASURES.map((measure) => [measure.id, measure])) as Record<
  ExerciseUnit,
  MeasureInfo
>

export function measureInfo(unit: ExerciseUnit): MeasureInfo {
  return BY_ID[unit] ?? BY_ID.reps
}

/**
 * Tipo de medida de um registro: o snapshot gravado nele; para registros
 * anteriores ao snapshot, o do plano; na falta dos dois, repetições.
 */
export function measureOf(entry: Pick<ExerciseLog, "exerciseId" | "unit">): ExerciseUnit {
  return entry.unit ?? EXERCISES_BY_ID[entry.exerciseId]?.unit ?? "reps"
}

/** Só carga × repetições entra em 1RM, PR, tonelagem e gráficos de carga. */
export function isRepsMeasure(entry: Pick<ExerciseLog, "exerciseId" | "unit">): boolean {
  return measureOf(entry) === "reps"
}

/** "4 × 8–12", "3 × 45–60 s", "4 × 40 m" */
export function formatPrescription(
  exercise: Pick<ExercisePrescription, "sets" | "repsMin" | "repsMax" | "unit">
): string {
  const range =
    exercise.repsMin === exercise.repsMax
      ? `${exercise.repsMax}`
      : `${exercise.repsMin}–${exercise.repsMax}`
  const { suffix } = measureInfo(exercise.unit)
  return `${exercise.sets} × ${range}${suffix ? ` ${suffix}` : ""}`
}

/**
 * Séries de um registro com a carga na unidade em que a máquina é lida hoje
 * (gravada em kg; lb quando a pilha é em libra). Para "última vez" e setas.
 */
export function setsInUnit(entry: ExerciseLog, loadUnit: LoadUnit): SetLog[] {
  const recordedIn = entry.loadUnit ?? "kg"
  if (loadUnit === "kg" && recordedIn === "kg") return entry.sets
  return entry.sets.map((set) => ({
    ...set,
    weight: loadForInput(set.weight, loadUnit, recordedIn),
  }))
}

/**
 * Resumo das séries para a referência "última vez". `sets` já na unidade da
 * máquina (ver `setsInUnit`); `loadUnit` só muda o rótulo.
 * reps: "50 kg × 8·5·5", "100 lb × 12·12" ou "12·12·12 reps" (peso corporal)
 * tempo: "60·60·60 s" ou "+10 kg × 60·45 s"
 * distância: "24 kg × 40·40 m"
 */
export function formatSetsSummary(
  sets: SetLog[],
  unit: ExerciseUnit,
  loadUnit: LoadUnit = "kg"
): string {
  const values = sets.map((set) => set.reps).join("·")
  const load = sets[0]?.weight ?? 0
  if (unit === "reps") {
    return load > 0 ? `${formatWeight(load)} ${loadUnit} × ${values}` : `${values} reps`
  }
  const amount = `${values} ${measureInfo(unit).suffix}`
  if (load <= 0) return amount
  return unit === "seconds"
    ? `+${formatWeight(load)} ${loadUnit} × ${amount}`
    : `${formatWeight(load)} ${loadUnit} × ${amount}`
}

/** kg movimentados no exercício — zero para tempo e distância. */
export function entryVolume(entry: ExerciseLog): number {
  if (!isRepsMeasure(entry)) return 0
  return entry.sets.reduce((sum, set) => sum + set.weight * set.reps, 0)
}

/** Tonelagem de um treino de musculação (só séries de carga × repetições). */
export function workoutVolume(w: WorkoutLog): number {
  return w.entries.reduce((sum, entry) => sum + entryVolume(entry), 0)
}

/**
 * 1RM estimada ajustada por RIR: reps efetivas = reps feitas + reps em
 * reserva (75 kg × 8 @RIR2 vale como 10 reps até a falha). Séries sem
 * RIR se comportam como na fórmula clássica. Zero fora de carga × reps.
 */
export function bestE1RMAdjusted(entry: ExerciseLog): number {
  if (!isRepsMeasure(entry)) return 0
  return entry.sets.reduce((best, set) => {
    if (set.weight <= 0) return best
    const effReps = set.reps + (set.rir ?? 0)
    return Math.max(best, set.weight * (1 + effReps / 30))
  }, 0)
}

/**
 * Valor que parece tempo anotado como repetições: 60 "reps" sem carga num
 * exercício de 8–12. É exatamente o erro da prancha registrada como dead bug.
 * O teto acompanha a prescrição para não acusar flexão de 40 reps.
 */
export function looksLikeTimeInReps(
  exercise: Pick<ExercisePrescription, "unit" | "repsMax">,
  weight: number,
  reps: number
): boolean {
  if (exercise.unit !== "reps" || weight > 0 || !Number.isFinite(reps)) return false
  return reps >= Math.max(30, exercise.repsMax * 2)
}
