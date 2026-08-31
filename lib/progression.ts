import { ExerciseLog, ExercisePrescription, SetLog, WorkoutLog } from "./types"

/**
 * Progressão de carga: o app SUGERE, o usuário decide.
 *
 * A regra antiga escrevia +2,5 kg direto no campo assim que a última sessão
 * batia o topo da faixa. Em máquina de pino isso vira carga inexistente
 * (52,5 kg num stack que anda de 5 em 5) e obriga a corrigir na mão, série
 * por série. Aqui o pré-preenchimento repete o que foi feito da última vez e
 * a sugestão vive ao lado, com um toque para aplicar — no passo que o
 * equipamento realmente tem.
 */

/** Incrementos que existem de verdade numa sala de musculação. */
export const STEP_OPTIONS = [1, 2, 2.5, 5, 10, 20]
/**
 * Ordem da inferência. Para em 5 de propósito: passos maiores existem (leg
 * press com anilha de 20), mas adivinhá-los a partir de duas cargas distantes
 * erraria para cima. Acima de 5, o passo é escolhido à mão.
 */
const INFERENCE_STEPS = [5, 2.5, 2, 1]
export const DEFAULT_STEP = 2.5
/** Sem fazer o exercício por tanto tempo, reentre abaixo em vez de subir. */
export const LAYOFF_DELOAD_DAYS = 14

const STEP_KEY = "gym-track:load-steps:v1"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function roundToStep(weight: number, step: number): number {
  if (step <= 0) return round2(weight)
  return round2(Math.round(weight / step) * step)
}

function isMultipleOf(value: number, step: number): boolean {
  const ratio = value / step
  return Math.abs(ratio - Math.round(ratio)) < 1e-6
}

/** kg no formato brasileiro, sem casa decimal inútil ("52,5" / "50") */
export function formatWeight(n: number): string {
  return round2(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

/**
 * Maior passo "de academia" que divide TODAS as cargas já registradas no
 * exercício. Numa máquina cujo pino anda de 5 em 5, todo registro é múltiplo
 * de 5 — e a sugestão deixa de pedir os 2,5 kg que a placa não tem.
 * null = sem histórico para inferir.
 */
export function inferLoadStep(weights: number[]): number | null {
  const distinct = [...new Set(weights.filter((w) => w > 0).map(round2))]
  if (distinct.length === 0) return null
  return INFERENCE_STEPS.find((step) => distinct.every((w) => isMultipleOf(w, step))) ?? null
}

/** Cargas já registradas no exercício, das sessões mais recentes para trás. */
export function loggedWeights(
  workouts: WorkoutLog[],
  exerciseId: string,
  sessionLimit = 12
): number[] {
  const weights: number[] = []
  let sessions = 0
  for (let i = workouts.length - 1; i >= 0 && sessions < sessionLimit; i--) {
    const entry = workouts[i].entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    sessions++
    for (const set of entry.sets) if (set.weight > 0) weights.push(set.weight)
  }
  return weights
}

/** Passo escolhido à mão por exercício (localStorage, sobrevive à recarga). */
export function loadStepOverrides(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STEP_KEY) ?? "null")
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, number> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && value > 0) out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

export function saveStepOverride(
  exerciseId: string,
  step: number | null
): Record<string, number> {
  const next = loadStepOverrides()
  if (step === null) delete next[exerciseId]
  else next[exerciseId] = step
  try {
    localStorage.setItem(STEP_KEY, JSON.stringify(next))
  } catch {
    /* cota cheia / modo privado — a inferência segue valendo */
  }
  return next
}

/** Passo válido para o exercício: escolha manual > histórico > padrão. */
export function resolveLoadStep(
  exerciseId: string,
  history: number[],
  overrides: Record<string, number> = {}
): number {
  return overrides[exerciseId] ?? inferLoadStep(history) ?? DEFAULT_STEP
}

export type LoadAdvice = "progress" | "hold" | "deload"

export interface SuggestedSet {
  weight: number
  reps: number
}

export interface LoadSuggestion {
  advice: LoadAdvice
  step: number
  /** variação sobre a carga da última vez (0 = manter) */
  delta: number
  /** alvo por série, no mesmo mapeamento do pré-preenchimento */
  sets: SuggestedSet[]
  /** carga única quando todas as séries batem (o caso comum); null se variam */
  weight: number | null
  /** frase do chip */
  summary: string
  /** por que a sugestão é essa */
  detail: string
}

export interface SuggestionInput {
  prescription: Pick<ExercisePrescription, "sets" | "repsMin" | "repsMax" | "unit">
  lastEntry?: ExerciseLog | null
  step: number
  /** dias desde a última vez que ESTE exercício foi feito */
  layoffDays?: number | null
  /** o ciclo detectou volta de pausa (dias sem nenhuma musculação) */
  returningFromLayoff?: boolean
}

/** Séries reais da última vez, na ordem (descarta linhas vazias). */
function workingSets(entry?: ExerciseLog | null): SetLog[] {
  return (entry?.sets ?? []).filter((set) => set.reps > 0)
}

/**
 * Dupla progressão: fechou o topo da faixa em todas as séries → sobe um passo
 * e volta ao piso de reps. Caso contrário, mantém a carga e persegue mais uma
 * repetição. Volta de pausa reentra abaixo, arredondada ao passo do aparelho.
 */
export function suggestLoad({
  prescription,
  lastEntry,
  step,
  layoffDays,
  returningFromLayoff,
}: SuggestionInput): LoadSuggestion | null {
  const sets = workingSets(lastEntry)
  if (sets.length === 0) return null

  const base = Array.from(
    { length: Math.max(1, prescription.sets) },
    (_, i) => sets[i] ?? sets[sets.length - 1]
  )
  const timed = prescription.unit === "seconds"
  const weighted = base.some((set) => set.weight > 0)
  const deload =
    weighted &&
    (Boolean(returningFromLayoff) ||
      (layoffDays != null && layoffDays >= LAYOFF_DELOAD_DAYS))
  const topOfRange =
    sets.length >= prescription.sets &&
    sets.every((set) => set.reps >= prescription.repsMax)
  const unit = timed ? "s" : "reps"

  const finish = (
    advice: LoadAdvice,
    suggested: SuggestedSet[],
    summary: string,
    detail: string
  ): LoadSuggestion => {
    const uniform = suggested.every((set) => set.weight === suggested[0].weight)
    return {
      advice,
      step,
      delta: round2(suggested[0].weight - base[0].weight),
      sets: suggested,
      weight: uniform ? suggested[0].weight : null,
      summary,
      detail,
    }
  }

  if (deload) {
    const back = (weight: number) => {
      const target = roundToStep(weight * 0.9, step)
      return target < weight ? target : Math.max(step, round2(weight - step))
    }
    const suggested = base.map((set) => ({ weight: back(set.weight), reps: set.reps }))
    const uniform = suggested.every((set) => set.weight === suggested[0].weight)
    return finish(
      "deload",
      suggested,
      uniform ? `Reentrar com ${formatWeight(suggested[0].weight)} kg` : "Reentrar ~10% abaixo",
      layoffDays != null && layoffDays >= LAYOFF_DELOAD_DAYS
        ? `${layoffDays} dias sem este exercício — volte a ~90% e recupere a carga na próxima.`
        : "Voltando de pausa — reentre a ~90% e recupere a carga na próxima sessão."
    )
  }

  if (topOfRange && weighted) {
    const suggested = base.map((set) => ({
      weight: round2(set.weight + step),
      reps: prescription.repsMin,
    }))
    const uniform = suggested.every((set) => set.weight === suggested[0].weight)
    return finish(
      "progress",
      suggested,
      uniform
        ? `Subir para ${formatWeight(suggested[0].weight)} kg × ${prescription.repsMin}`
        : `Subir ${formatWeight(step)} kg em todas as séries`,
      `Topo da faixa (${prescription.repsMax} ${unit}) em todas as séries — passo de ${formatWeight(step)} kg.`
    )
  }

  if (topOfRange) {
    const bump = timed ? 5 : 1
    const suggested = base.map((set) => ({ weight: set.weight, reps: set.reps + bump }))
    return finish(
      "progress",
      suggested,
      `Buscar ${suggested[0].reps} ${unit}`,
      `Sem carga externa: a progressão é mais ${bump} ${unit} ou uma variação mais difícil.`
    )
  }

  const suggested = base.map((set) => ({
    weight: set.weight,
    reps: Math.min(prescription.repsMax, set.reps + 1),
  }))
  const target = Math.max(...suggested.map((set) => set.reps))
  return finish(
    "hold",
    suggested,
    weighted
      ? `Manter ${formatWeight(base[0].weight)} kg e buscar ${target} ${unit}`
      : `Buscar ${target} ${unit}`,
    `A carga sobe quando fechar ${prescription.repsMax} ${unit} em todas as ${prescription.sets} séries.`
  )
}
