import { SessionId, WorkoutLog } from "./types"
import { isoWeekday, toDateKey, WEEKDAY_SHORT, workoutVolume } from "./utils"

/**
 * Ciclo rotativo de treinos: em vez de prescrever por dia da semana, o
 * sistema prescreve o PRÓXIMO treino da fila. Faltou 2 dias? O ciclo
 * espera — a alternância Upper/Lower (que garante a recuperação por
 * grupo) se mantém sozinha.
 */
export const LIFT_CYCLE: SessionId[] = ["upperA", "lowerA", "upperB", "lowerB"]

export type ScheduleMode = "ciclo" | "calendario"

const MODE_KEY = "gym-track:schedule-mode"

export function getScheduleMode(): ScheduleMode {
  try {
    return localStorage.getItem(MODE_KEY) === "calendario" ? "calendario" : "ciclo"
  } catch {
    return "ciclo"
  }
}

export function setScheduleMode(mode: ScheduleMode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export type CycleReason = "start" | "next" | "recovery" | "regression"

export interface CycleSuggestion {
  /** o que fazer hoje */
  sessionId: SessionId
  /** próximo lift da fila (= sessionId, exceto em recovery) */
  nextLiftId: SessionId
  reason: CycleReason
  /** fator de carga para o prefill (regression = 0.9) */
  loadFactor: number
  daysSinceLastLift: number | null
}

const DAY_MS = 86_400_000

function dateKeyDaysAgo(today: Date, days: number): string {
  return toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)
  )
}

/**
 * Próximo treino da fila com regras de proteção:
 * 1. sucessor do último lift registrado;
 * 2. lifts ontem E anteontem (sem lift hoje) → recuperar antes do 3º dia
 *    seguido: sugere Z2/descanso;
 * 3. gap ≥ 7 dias → repetir o último lift com ~90% da carga;
 * 4. sem histórico → começo do ciclo (Upper A).
 */
export function nextInCycle(workouts: WorkoutLog[], today: Date): CycleSuggestion {
  const lifts = workouts
    .filter((w) => LIFT_CYCLE.includes(w.sessionId))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (lifts.length === 0) {
    return {
      sessionId: "upperA",
      nextLiftId: "upperA",
      reason: "start",
      loadFactor: 1,
      daysSinceLastLift: null,
    }
  }

  const last = lifts[lifts.length - 1]
  const next = LIFT_CYCLE[(LIFT_CYCLE.indexOf(last.sessionId) + 1) % LIFT_CYCLE.length]
  const todayKey = toDateKey(today)
  const lastDate = new Date(last.date + "T00:00:00")
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysSince = Math.max(0, Math.round((todayMid.getTime() - lastDate.getTime()) / DAY_MS))

  if (daysSince >= 7) {
    return {
      sessionId: last.sessionId,
      nextLiftId: last.sessionId,
      reason: "regression",
      loadFactor: 0.9,
      daysSinceLastLift: daysSince,
    }
  }

  const liftOn = (key: string) => lifts.some((w) => w.date === key)
  if (
    !liftOn(todayKey) &&
    liftOn(dateKeyDaysAgo(today, 1)) &&
    liftOn(dateKeyDaysAgo(today, 2))
  ) {
    return {
      sessionId: "cardioZ2",
      nextLiftId: next,
      reason: "recovery",
      loadFactor: 1,
      daysSinceLastLift: daysSince,
    }
  }

  return {
    sessionId: next,
    nextLiftId: next,
    reason: "next",
    loadFactor: 1,
    daysSinceLastLift: daysSince,
  }
}

export interface Rolling7 {
  /** sessões de treino (sem esporte/descanso) */
  sessions: number
  /** volume de carga (kg) */
  volume: number
  /** minutos de Zona 2 (esporte fora) */
  z2: number
}

/** Métricas da janela móvel dos últimos 7 dias (hoje incluso) */
export function rolling7(workouts: WorkoutLog[], today: Date): Rolling7 {
  const start = dateKeyDaysAgo(today, 6)
  const end = toDateKey(today)
  const ws = workouts.filter((w) => w.date >= start && w.date <= end)
  return {
    sessions: ws.filter((w) => w.sessionId !== "sport" && w.sessionId !== "rest").length,
    volume: ws.reduce((s, w) => s + workoutVolume(w), 0),
    z2: ws.reduce(
      (s, w) => s + (w.sessionId !== "sport" ? w.cardio?.minutes ?? 0 : 0),
      0
    ),
  }
}

export interface DayStrip {
  /** yyyy-MM-dd */
  key: string
  /** SEG..DOM */
  label: string
  /** sessões registradas no dia */
  done: SessionId[]
  isToday: boolean
}

/** Fita dos últimos 7 dias (o que foi feito em cada um), p/ o modo ciclo */
export function last7Days(workouts: WorkoutLog[], today: Date): DayStrip[] {
  const todayKey = toDateKey(today)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i))
    const key = toDateKey(d)
    return {
      key,
      label: WEEKDAY_SHORT[isoWeekday(d) - 1],
      done: workouts.filter((w) => w.date === key).map((w) => w.sessionId),
      isToday: key === todayKey,
    }
  })
}
