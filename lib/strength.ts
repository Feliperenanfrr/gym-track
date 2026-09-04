import { EXERCISES_BY_ID } from "./plan"
import { ExerciseLog, WorkoutLog } from "./types"
import { fromDateKey, topSet } from "./utils"

/**
 * Progressão de força medida pela CARGA da série mais pesada.
 *
 * A 1RM estimada por Epley extrapola de 1 rep até a falha; num exercício de
 * 12–15 repetições em máquina o erro da extrapolação fica maior que o efeito
 * que se quer enxergar — a mesma cadeira extensora oscilava de 154 a 63 kg
 * estimados em dez semanas sem que nada disso tivesse acontecido.
 *
 * A carga do top set é dado bruto: não estima nada, e é exatamente o número
 * que decide a próxima sessão. A 1RM continua disponível, mas só onde vale:
 * séries de até 8 repetições efetivas (reps + RIR).
 */

/** Teto de reps efetivas em que a extrapolação de Epley ainda é defensável. */
export const E1RM_MAX_EFFECTIVE_REPS = 8

/** Janela padrão para eleger os exercícios do seletor. */
export const FREQUENT_WINDOW_DAYS = 90

const DAY_MS = 86_400_000

export interface TopSetPoint {
  /** yyyy-MM-dd */
  date: string
  /** dd/MM */
  label: string
  /** carga da série mais pesada da sessão (kg) */
  carga: number
  reps: number
  rir?: number
  /** 1RM estimada — null quando as reps efetivas passam do teto confiável */
  e1rm: number | null
  /** primeira sessão a superar a maior carga anterior */
  isLoadPr: boolean
}

export interface ExerciseStrength {
  exerciseId: string
  name: string
  points: TopSetPoint[]
  first: TopSetPoint | null
  last: TopSetPoint | null
  /** carga da última sessão menos a da primeira (kg) */
  deltaKg: number | null
  /** maior carga do período */
  bestWeight: number
  /**
   * Sessões desde o último aumento de carga. 0 = subiu na última sessão;
   * null = a carga nunca subiu no período (só há a sessão-base).
   */
  sessionsSinceIncrease: number | null
  /** pontos com 1RM confiável — abaixo de 2 o gráfico de 1RM não abre */
  reliableE1rmPoints: number
}

function effectiveReps(reps: number, rir?: number): number {
  return reps + (rir ?? 0)
}

function shortLabel(dateKey: string): string {
  const d = fromDateKey(dateKey)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Nome preferindo o que foi gravado no log (preserva substituições e avulsos). */
function nameOf(exerciseId: string, entry?: ExerciseLog): string {
  return (
    entry?.exerciseName ?? EXERCISES_BY_ID[exerciseId]?.name ?? exerciseId
  )
}

export interface FrequentExercise {
  id: string
  name: string
  /** séries registradas na janela */
  sets: number
  /** sessões em que apareceu na janela */
  sessions: number
}

/**
 * Exercícios que você de fato treina, ordenados por séries na janela.
 *
 * O seletor antigo era uma lista fixa (supino, agacho, terra, desenvolvimento,
 * remada): oferecia exercícios sem nenhum registro e escondia os três mais
 * treinados. Aqui a lista sai do histórico.
 */
export function frequentExercises(
  workouts: WorkoutLog[],
  today: Date,
  { days = FREQUENT_WINDOW_DAYS, limit = 6 }: { days?: number; limit?: number } = {}
): FrequentExercise[] {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const since = new Date(midnight.getTime() - (days - 1) * DAY_MS)
  const sinceKey = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(
    since.getDate()
  ).padStart(2, "0")}`

  const stats = new Map<string, { name: string; sets: number; sessions: number }>()
  for (const w of workouts) {
    if (w.date < sinceKey) continue
    const seen = new Set<string>()
    for (const entry of w.entries) {
      // isometria e séries sem carga não dizem nada sobre progressão de carga
      const withLoad = entry.sets.filter((s) => s.weight > 0 && s.reps > 0)
      if (withLoad.length === 0) continue
      const current = stats.get(entry.exerciseId) ?? {
        name: nameOf(entry.exerciseId, entry),
        sets: 0,
        sessions: 0,
      }
      current.sets += withLoad.length
      if (!seen.has(entry.exerciseId)) {
        current.sessions += 1
        seen.add(entry.exerciseId)
      }
      stats.set(entry.exerciseId, current)
    }
  }

  return [...stats.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.sets - a.sets || b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Série histórica de carga do top set de um exercício. */
export function exerciseStrength(
  workouts: WorkoutLog[],
  exerciseId: string
): ExerciseStrength {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const points: TopSetPoint[] = []
  let name = EXERCISES_BY_ID[exerciseId]?.name ?? exerciseId
  let runningBest = 0
  let bestWeight = 0
  let sessionsSinceIncrease: number | null = null

  for (const w of sorted) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    const loaded = entry.sets.filter((s) => s.weight > 0 && s.reps > 0)
    if (loaded.length === 0) continue
    const top = topSet({ ...entry, sets: loaded })
    if (!top) continue

    name = nameOf(exerciseId, entry)
    const eff = effectiveReps(top.reps, top.rir)
    const isLoadPr = runningBest > 0 && top.weight > runningBest
    if (top.weight > runningBest) {
      runningBest = top.weight
      // a sessão-base não conta como aumento; a partir dela, zera o contador
      sessionsSinceIncrease = points.length === 0 ? null : 0
    } else if (sessionsSinceIncrease !== null) {
      sessionsSinceIncrease += 1
    }
    bestWeight = Math.max(bestWeight, top.weight)

    points.push({
      date: w.date,
      label: shortLabel(w.date),
      carga: top.weight,
      reps: top.reps,
      rir: top.rir,
      e1rm:
        eff <= E1RM_MAX_EFFECTIVE_REPS
          ? Math.round(top.weight * (1 + eff / 30) * 10) / 10
          : null,
      isLoadPr,
    })
  }

  const first = points[0] ?? null
  const last = points[points.length - 1] ?? null
  return {
    exerciseId,
    name,
    points,
    first,
    last,
    deltaKg:
      first && last && points.length > 1
        ? Math.round((last.carga - first.carga) * 10) / 10
        : null,
    bestWeight,
    sessionsSinceIncrease,
    reliableE1rmPoints: points.filter((p) => p.e1rm !== null).length,
  }
}

/* ------------------------------------------------------------------ */
/* Estagnação                                                          */
/* ------------------------------------------------------------------ */

export interface StagnationRow {
  exerciseId: string
  name: string
  /** sessões com carga registrada na janela */
  sessions: number
  /**
   * Sessões desde o último aumento de carga. `null` = a carga NUNCA subiu
   * acima da primeira sessão do período — estado diferente de zero, que
   * significa "subiu agora".
   */
  sessionsSinceIncrease: number | null
  lastWeight: number
  bestWeight: number
}

/** Sessões sem subir carga a partir das quais o exercício pede atenção. */
export const STAGNATION_ALERT_SESSIONS = 4

/**
 * Quadro de estagnação: quanto tempo cada exercício está sem subir carga.
 *
 * O número por exercício já existia em `exerciseStrength`, mas só aparecia
 * depois de trocar de chip no seletor — descobrir o que travou custava seis
 * toques. Aqui todos saem de uma vez, ordenados por gravidade: primeiro os
 * que nunca subiram, depois os parados há mais tempo.
 */
export function stagnationBoard(
  workouts: WorkoutLog[],
  today: Date,
  {
    days = 180,
    minSessions = 2,
    limit = 12,
  }: { days?: number; minSessions?: number; limit?: number } = {}
): StagnationRow[] {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const since = new Date(midnight.getTime() - (days - 1) * DAY_MS)
  const sinceKey = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(
    since.getDate()
  ).padStart(2, "0")}`
  const todayKey = `${midnight.getFullYear()}-${String(midnight.getMonth() + 1).padStart(2, "0")}-${String(
    midnight.getDate()
  ).padStart(2, "0")}`

  const inWindow = workouts.filter((w) => w.date >= sinceKey && w.date <= todayKey)
  const ids = new Set<string>()
  for (const w of inWindow) {
    for (const entry of w.entries) {
      if (entry.sets.some((s) => s.weight > 0 && s.reps > 0)) ids.add(entry.exerciseId)
    }
  }

  const rows: StagnationRow[] = []
  for (const id of ids) {
    const strength = exerciseStrength(inWindow, id)
    if (strength.points.length < minSessions) continue
    rows.push({
      exerciseId: id,
      name: strength.name,
      sessions: strength.points.length,
      sessionsSinceIncrease: strength.sessionsSinceIncrease,
      lastWeight: strength.last?.carga ?? 0,
      bestWeight: strength.bestWeight,
    })
  }

  // gravidade: nunca subiu é o pior caso, depois quem está parado há mais tempo
  return rows
    .sort((a, b) => {
      const sa = a.sessionsSinceIncrease
      const sb = b.sessionsSinceIncrease
      if (sa === null && sb !== null) return -1
      if (sb === null && sa !== null) return 1
      if (sa === null && sb === null) return b.sessions - a.sessions
      return (sb as number) - (sa as number) || b.sessions - a.sessions
    })
    .slice(0, limit)
}
