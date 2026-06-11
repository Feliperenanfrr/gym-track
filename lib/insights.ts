import { EXERCISES_BY_ID, PLAN_BY_ID } from "./plan"
import { GymData, WorkoutLog } from "./types"
import { bestE1RM, toDateKey, workoutVolume } from "./utils"

/* ------------------------------------------------------------------ */
/* Hidratação                                                           */
/* ------------------------------------------------------------------ */

const WATER_ML_PER_KG = 37 // meio da faixa do plano (35–40 ml/kg)
const WATER_FALLBACK_ML = 3300

/** Meta diária de água (ml) pelo peso corporal mais recente */
export function waterGoalMl(body: { weightKg: number }[]): number {
  const kg = [...body].reverse().find((b) => b.weightKg > 0)?.weightKg
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
        events.push({ date: w.date, exerciseId: e.exerciseId })
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
      w.durationMin ?? (kind === "lift" ? 60 : w.cardio?.minutes ?? 0)
    if (minutes > 0) return w.srpe * minutes
  }
  if (kind === "lift") {
    return Math.round(workoutVolume(w) * 0.05 + (w.cardio?.minutes ?? 0) * 4)
  }
  if (kind === "sport") return (w.cardio?.minutes ?? 0) * 7
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
  /** volume dos últimos 7 dias (kg) */
  acute: number
  /** média semanal dos 21 dias anteriores à janela aguda (kg) */
  chronic: number
}

const DAY_MS = 86_400_000

/**
 * Sinal de fadiga via razão carga aguda:crônica (ACWR): volume de carga
 * dos últimos 7 dias contra a média semanal das 3 semanas anteriores.
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
    if (w.date >= acuteStart && w.date <= todayKey) acute += workoutVolume(w)
    else if (w.date >= chronicStart && w.date <= chronicEnd) chronicTotal += workoutVolume(w)
  }
  const chronic = chronicTotal / 3

  if (chronic <= 0) return { level: "building", ratio: null, acute, chronic: 0 }

  const ratio = acute / chronic
  const level: ReadinessLevel = ratio <= 1.1 ? "green" : ratio <= 1.4 ? "yellow" : "red"
  return { level, ratio, acute, chronic }
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
  /** gasto calórico estimado por METs (arredondado a dezenas) */
  kcal: number
}

// METs aproximados (Compendium of Physical Activities)
const MET_LIFT = 5 // musculação vigorosa
const MET_Z2 = 6.5 // bike/esteira em ritmo moderado
const MET_SPORT = 8 // futsal/flag/jiu-jitsu recreativo
const LIFT_SESSION_MIN = 60 // duração típica do treino de força
const FALLBACK_WEIGHT_KG = 85

/** Resumo da semana que começa em `monday` (PRs, frequência, volume, kcal) */
export function weeklySummary(data: GymData, monday: Date): WeeklySummary {
  const start = toDateKey(monday)
  const end = toDateKey(
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  )
  const ws = data.workouts.filter((w) => w.date >= start && w.date <= end)

  const sessions = ws.filter((w) => w.sessionId !== "rest").length
  const volume = ws.reduce((s, w) => s + workoutVolume(w), 0)
  const z2Minutes = ws.reduce(
    (s, w) => s + (w.sessionId !== "sport" ? w.cardio?.minutes ?? 0 : 0),
    0
  )

  const weightKg =
    [...data.body].reverse().find((b) => b.weightKg > 0)?.weightKg ??
    FALLBACK_WEIGHT_KG
  const kcalPerMin = (met: number) => (met * 3.5 * weightKg) / 200
  let kcal = 0
  for (const w of ws) {
    if (w.sessionId === "sport") {
      kcal += (w.cardio?.minutes ?? 0) * kcalPerMin(MET_SPORT)
    } else {
      if (PLAN_BY_ID[w.sessionId]?.kind === "lift") {
        kcal += LIFT_SESSION_MIN * kcalPerMin(MET_LIFT)
      }
      kcal += (w.cardio?.minutes ?? 0) * kcalPerMin(MET_Z2)
    }
  }

  const prNames = prEvents(data.workouts)
    .filter((p) => p.date >= start && p.date <= end)
    .map((p) => EXERCISES_BY_ID[p.exerciseId]?.name ?? p.exerciseId)

  return {
    sessions,
    prs: [...new Set(prNames)],
    volume,
    z2Minutes,
    kcal: Math.round(kcal / 10) * 10,
  }
}
