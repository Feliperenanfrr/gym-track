import { countsTowardProgramTarget, EXERCISES_BY_ID, PLAN_BY_ID } from "./plan"
import { zone2Minutes } from "./cardio"
import { GymData, TrainingProgram, WorkoutLog } from "./types"
import { bestE1RM, fromDateKey, toDateKey, workoutVolume } from "./utils"

/* ------------------------------------------------------------------ */
/* Hidratação                                                           */
/* ------------------------------------------------------------------ */

const WATER_ML_PER_KG = 37 // meio da faixa do plano (35–40 ml/kg)
const WATER_FALLBACK_ML = 3300

/** Meta diária de água (ml) pelo peso corporal mais recente */
export function waterGoalMl(body: { weightKg?: number }[]): number {
  const kg = [...body].reverse().find((b) => (b.weightKg ?? 0) > 0)?.weightKg
  if (!kg) return WATER_FALLBACK_ML
  return Math.round((kg * WATER_ML_PER_KG) / 50) * 50
}

/* ------------------------------------------------------------------ */
/* PRs                                                                  */
/* ------------------------------------------------------------------ */

export interface PrEvent {
  /** yyyy-MM-dd */
  date: string
  exerciseId: string
  exerciseName?: string
}

/**
 * Eventos de PR em ordem cronológica: a 1RM estimada (Epley) do exercício
 * supera todo o histórico anterior. O primeiro registro de um exercício
 * estabelece a base e não conta como PR.
 */
export function prEvents(workouts: WorkoutLog[]): PrEvent[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const best: Record<string, number> = {}
  const events: PrEvent[] = []
  for (const w of sorted) {
    for (const e of w.entries) {
      const e1rm = bestE1RM(e)
      if (e1rm <= 0) continue
      const prev = best[e.exerciseId] ?? 0
      if (prev > 0 && e1rm > prev) {
        events.push({ date: w.date, exerciseId: e.exerciseId, exerciseName: e.exerciseName })
      }
      if (e1rm > prev) best[e.exerciseId] = e1rm
    }
  }
  return events
}

/* ------------------------------------------------------------------ */
/* Carga interna                                                        */
/* ------------------------------------------------------------------ */

/**
 * Carga interna da sessão em unidades arbitrárias (AU).
 * Com sRPE registrado: sRPE × minutos (método de Foster) — inclui
 * musculação, cardio E esporte na mesma moeda.
 * Fallbacks p/ registros antigos sem sRPE (documentados):
 *  - musculação: tonelagem × 0,05 (≈ RPE 7 × 60′ para ~8 t) + finisher × 4
 *  - esporte: minutos × 7 (RPE assumido de jogo recreativo)
 *  - Zona 2: minutos × 4 (conversa confortável)
 */
export function internalLoad(w: WorkoutLog): number {
  const kind = PLAN_BY_ID[w.sessionId]?.kind
  if (w.srpe && w.srpe > 0) {
    const minutes =
      w.durationMin ??
      (kind === "lift" || (kind === "mixed" && w.entries.length > 0)
        ? 60
        : w.cardio?.minutes ?? 0)
    if (minutes > 0) return w.srpe * minutes
  }
  if (kind === "lift" || kind === "mixed") {
    return Math.round(workoutVolume(w) * 0.05 + (w.cardio?.minutes ?? 0) * 4)
  }
  if (w.cardio?.purpose === "intense") return (w.cardio?.minutes ?? 0) * 8
  if (w.cardio?.purpose === "zone2") return (w.cardio?.minutes ?? 0) * 4
  if (kind === "sport" || w.cardio?.purpose === "sport") {
    return (w.cardio?.minutes ?? 0) * 7
  }
  return (w.cardio?.minutes ?? 0) * 4
}

/* ------------------------------------------------------------------ */
/* Readiness / fadiga                                                   */
/* ------------------------------------------------------------------ */

export type ReadinessLevel = "building" | "green" | "yellow" | "red"

export interface Readiness {
  level: ReadinessLevel
  /** carga aguda ÷ base crônica (null sem histórico suficiente) */
  ratio: number | null
  /** carga interna dos últimos 7 dias (AU) */
  acute: number
  /** média semanal dos 21 dias anteriores à janela aguda (AU) */
  chronic: number
}

const DAY_MS = 86_400_000

/**
 * Sinal de fadiga via razão carga aguda:crônica (ACWR): carga interna dos
 * últimos 7 dias contra a média semanal das 3 semanas anteriores.
 * ≤1.1 verde · ≤1.4 amarelo · >1.4 vermelho.
 */
export function computeReadiness(workouts: WorkoutLog[], today: Date): Readiness {
  const todayKey = toDateKey(today)
  const acuteStart = toDateKey(new Date(today.getTime() - 6 * DAY_MS))
  const chronicStart = toDateKey(new Date(today.getTime() - 27 * DAY_MS))
  const chronicEnd = toDateKey(new Date(today.getTime() - 7 * DAY_MS))

  let acute = 0
  let chronicTotal = 0
  for (const w of workouts) {
    if (w.date >= acuteStart && w.date <= todayKey) acute += internalLoad(w)
    else if (w.date >= chronicStart && w.date <= chronicEnd) chronicTotal += internalLoad(w)
  }
  const chronic = chronicTotal / 3

  if (chronic <= 0) return { level: "building", ratio: null, acute, chronic: 0 }

  const ratio = acute / chronic
  const level: ReadinessLevel = ratio <= 1.1 ? "green" : ratio <= 1.4 ? "yellow" : "red"
  return { level, ratio, acute, chronic }
}

/* ------------------------------------------------------------------ */
/* Tendência de peso (médias móveis de 7 dias)                          */
/* ------------------------------------------------------------------ */

export interface WeightTrend {
  /** média das pesagens dos últimos 7 dias (kg) */
  currentAvg: number | null
  /** média da janela comparável anterior (kg) */
  previousAvg: number | null
  /** currentAvg − previousAvg; null sem base comparável */
  delta: number | null
}

/**
 * Comparação de peso por média móvel: janela atual (hoje−6 … hoje) contra a
 * anterior (hoje−13 … hoje−7). Pesagem oscila com água/sal/intestino, então
 * média de janela > comparação de pontos isolados (ou "desde o início", que
 * vira ruído com o tempo).
 * Janela anterior vazia (peso esporádico)? Usa as até 4 pesagens mais
 * recentes anteriores a ela (limite de 60 dias) como referência. Nada
 * comparável → delta null e a UI mostra "—" em vez de inventar número.
 */
export function weightTrend7d(
  body: { date: string; weightKg?: number }[],
  today: Date
): WeightTrend {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const points = body
    .filter((b) => (b.weightKg ?? 0) > 0)
    .map((b) => ({ time: fromDateKey(b.date).getTime(), kg: b.weightKg! }))
    .filter((p) => !Number.isNaN(p.time) && p.time <= t0)
    .sort((a, b) => a.time - b.time)

  const winStart = t0 - 6 * DAY_MS
  const prevEnd = winStart - DAY_MS
  const prevStart = t0 - 13 * DAY_MS
  const current = points.filter((p) => p.time >= winStart)
  let previous = points.filter((p) => p.time >= prevStart && p.time <= prevEnd)
  if (previous.length === 0 && current.length > 0) {
    previous = points
      .filter((p) => p.time < winStart && p.time >= t0 - 60 * DAY_MS)
      .slice(-4)
  }

  const avg = (xs: { kg: number }[]) =>
    xs.length > 0 ? xs.reduce((s, p) => s + p.kg, 0) / xs.length : null

  const currentAvg = avg(current)
  const previousAvg = avg(previous)
  return {
    currentAvg,
    previousAvg,
    delta: currentAvg !== null && previousAvg !== null ? currentAvg - previousAvg : null,
  }
}

/* ------------------------------------------------------------------ */
/* Resumo semanal                                                       */
/* ------------------------------------------------------------------ */

export interface WeeklySummary {
  /** sessões registradas (sem descanso) */
  sessions: number
  /** nomes dos exercícios com PR na semana */
  prs: string[]
  /** volume de carga da semana (kg) */
  volume: number
  /** minutos de Zona 2 (cardio + finisher, esporte fora) */
  z2Minutes: number
  /**
   * gasto calórico estimado por METs, somando o mid de cada sessão
   * (arredondado a dezenas). null sem peso registrado — inventar 85 kg
   * produzia número com precisão que não existe; melhor "—" do que
   * caloria falsa.
   */
  kcal: number | null
  /** extremos da faixa somada (~−20% / +25% do mid) */
  kcalLow: number | null
  kcalHigh: number | null
}

/* ------------------------------------------------------------------ */
/* Calorias por sessão                                                  */
/* ------------------------------------------------------------------ */

// METs aproximados (Compendium of Physical Activities)
const MET_Z2 = 6.5 // bike/esteira em ritmo moderado
const MET_INTENSE = 8.5 // corda, tiros ou natação vigorosa
const MET_SPORT = 8 // futsal/flag/jiu-jitsu recreativo
const LIFT_SESSION_MIN = 60 // fallback p/ treinos sem duração medida

/** faixa exibida junto ao mid: margem honesta de estimativa sem FC */
const KCAL_LOW_FACTOR = 0.8
const KCAL_HIGH_FACTOR = 1.25

/**
 * MET da musculação ancorado no esforço percebido (sRPE) em vez de fixar
 * "vigoroso": sRPE baixo ≈ sessão leve/moderada, alto ≈ quase falha.
 * Tabela Compendium: leve ~3 · moderado ~4 · forte ~5 · vigoroso ~6.
 * Sem sRPE (registros antigos), mantém os 5 METs de sempre.
 */
export function liftMetForSrpe(srpe?: number): number {
  if (!srpe || srpe <= 0) return 5
  if (srpe <= 3) return 3
  if (srpe <= 5) return 4
  if (srpe <= 7) return 5
  return 6
}

/** peso corporal válido mais próximo DE ANTES do dia (fallback: 1ª pesagem) */
export function weightKgOn(
  body: { date: string; weightKg?: number }[],
  dateKey: string
): number | undefined {
  const sorted = [...body].sort((a, b) => a.date.localeCompare(b.date))
  let before: number | undefined
  for (const b of sorted) {
    if ((b.weightKg ?? 0) > 0 && b.date <= dateKey) before = b.weightKg!
  }
  if (before !== undefined) return before
  return sorted.find((b) => (b.weightKg ?? 0) > 0)?.weightKg
}

export interface SessionKcal {
  /** ponto central da estimativa (kcal) */
  mid: number
  /** extremos da faixa honesta (~−20% / +25%) */
  low: number
  high: number
  /** MET efetivo usado na parte de musculação (diagnóstico/tooltip) */
  met: number
  /** minutos contabilizados */
  minutes: number
}

/**
 * Estimativa calórica de UM treino por METs:
 * - musculação usa a duração REAL (1ª série → salvar) e o MET adaptado pelo
 *   sRPE; sem duração medida (registro antigo/retroativo), cai para 60 min;
 * - cardio/esporte usam os minutos registrados com os METs fixos de sempre.
 * null sem peso — a equação do MET depende da massa corporal real.
 */
export function sessionKcal(w: WorkoutLog, weightKg?: number): SessionKcal | null {
  if (!weightKg || weightKg <= 0) return null
  const kcalPerMin = (met: number) => (met * 3.5 * weightKg!) / 200
  const kind = PLAN_BY_ID[w.sessionId]?.kind
  const purpose = w.cardio?.purpose ?? (w.sessionId === "sport" ? "sport" : "zone2")
  const cardioMin = w.cardio?.minutes ?? 0
  const isLiftPart =
    (kind === "lift" || kind === "mixed") && w.entries.length > 0

  let total = 0
  let metUsed = 0
  let minutes = 0

  if (purpose === "sport") {
    if (cardioMin <= 0) return null
    metUsed = MET_SPORT
    total = cardioMin * kcalPerMin(metUsed)
    minutes = cardioMin
  } else {
    if (isLiftPart) {
      metUsed = liftMetForSrpe(w.srpe)
      const liftMin = w.durationMin && w.durationMin > 0 ? w.durationMin : LIFT_SESSION_MIN
      total += liftMin * kcalPerMin(metUsed)
      minutes += liftMin
    }
    if (cardioMin > 0) {
      const cardioMet = purpose === "intense" ? MET_INTENSE : MET_Z2
      total += cardioMin * kcalPerMin(cardioMet)
      minutes += cardioMin
      if (!isLiftPart) metUsed = cardioMet
    }
    if (total <= 0) return null
  }

  const mid = Math.round(total / 10) * 10
  return {
    mid,
    low: Math.max(10, Math.round((mid * KCAL_LOW_FACTOR) / 10) * 10),
    high: Math.round((mid * KCAL_HIGH_FACTOR) / 10) * 10,
    met: Math.round(metUsed * 10) / 10,
    minutes,
  }
}

/** Resumo da semana que começa em `monday` (PRs, frequência, volume, kcal) */
export function weeklySummary(
  data: GymData,
  monday: Date,
  program: TrainingProgram = "hypertrophy"
): WeeklySummary {
  const start = toDateKey(monday)
  const end = toDateKey(
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  )
  const ws = data.workouts.filter((w) => w.date >= start && w.date <= end)

  const sessions = ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length
  const volume = ws.reduce((s, w) => s + workoutVolume(w), 0)
  const z2Minutes = ws.reduce((sum, workout) => sum + zone2Minutes(workout), 0)

  // kcal só com peso real: o MET depende da massa corporal.
  // Cada sessão soma sua própria estimativa (duração real + sRPE).
  const weightKg = [...data.body].reverse().find((b) => (b.weightKg ?? 0) > 0)?.weightKg
  let midTotal = 0
  let lowTotal = 0
  let highTotal = 0
  for (const w of ws) {
    const est = sessionKcal(w, weightKg)
    if (!est) continue
    midTotal += est.mid
    lowTotal += est.low
    highTotal += est.high
  }

  const prNames = prEvents(data.workouts)
    .filter((p) => p.date >= start && p.date <= end)
    .map((p) => p.exerciseName ?? EXERCISES_BY_ID[p.exerciseId]?.name ?? p.exerciseId)

  const anyEstimate = ws.some((w) => sessionKcal(w, weightKg) !== null)
  return {
    sessions,
    prs: [...new Set(prNames)],
    volume,
    z2Minutes,
    kcal: anyEstimate ? Math.round(midTotal / 10) * 10 : null,
    kcalLow: anyEstimate ? Math.round(lowTotal / 10) * 10 : null,
    kcalHigh: anyEstimate ? Math.round(highTotal / 10) * 10 : null,
  }
}
