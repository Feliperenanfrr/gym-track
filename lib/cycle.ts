import { SessionId, TrainingProgram, WorkoutLog } from "./types"
import { intenseMinutes, zone2Minutes } from "./cardio"
import { countsTowardProgramTarget, PLAN_BY_ID } from "./plan"
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
  /** fator de carga sugerido ao voltar de pausa (regression = 0.9) */
  loadFactor: number
  /** dias desde o último treino DA FILA (Upper/Lower) — posição do ciclo */
  daysSinceLastLift: number | null
  /**
   * Dias desde a última musculação registrada, venha ela do avulso, do bloco
   * de jiu-jitsu ou da fila. É esta a conta que decide "voltando de pausa":
   * quem treinou avulso ontem não está voltando de nada.
   */
  daysSinceStrength: number | null
}

export interface CycleTodayView {
  /** sugestão bruta do ciclo, usada para saber o próximo lift */
  suggestion: CycleSuggestion
  /** sessão que o card principal deve mostrar */
  sessionId: SessionId
  /** sessão concluída hoje que justifica o estado "feito" */
  completedSessionId: SessionId | null
  /** lift concluído hoje, quando houver */
  completedLiftSessionId: SessionId | null
  /** o card principal representa algo realmente feito hoje */
  done: boolean
  /**
   * Sessão que o ciclo ainda cobra hoje mesmo já tendo treino registrado
   * (avulso, esporte ou Z2 no lugar do lift). null = nada pendente.
   */
  pendingSessionId: SessionId | null
}

const DAY_MS = 86_400_000

function dateKeyDaysAgo(today: Date, days: number): string {
  return toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)
  )
}

/**
 * Uma sessão com séries registradas É musculação, venha ela da fila
 * Upper/Lower, do avulso ou do bloco de jiu-jitsu. Sessões de sala prescritas
 * contam pela própria natureza, mesmo sem séries digitadas. Cardio, esporte e
 * importações do Strava ficam de fora: fadiga de sala é outra coisa.
 */
export function isStrengthLog(workout: WorkoutLog): boolean {
  if (PLAN_BY_ID[workout.sessionId]?.kind === "lift") return true
  return workout.entries.some((entry) => entry.sets.length > 0)
}

function daysBetween(today: Date, dateKey: string): number {
  const from = new Date(dateKey + "T00:00:00")
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.round((todayMid.getTime() - from.getTime()) / DAY_MS))
}

/**
 * Próximo treino da fila com regras de proteção:
 * 1. sucessor do último lift registrado;
 * 2. musculação ontem E anteontem (sem musculação hoje) → recuperar antes do
 *    3º dia seguido: sugere Z2/descanso;
 * 3. ≥ 7 dias sem NENHUMA musculação → repetir o último lift, sugerindo ~90%;
 * 4. sem histórico → começo do ciclo (Upper A).
 *
 * A posição na fila vem só dos lifts prescritos (avulso não avança
 * Upper/Lower), mas a conta de pausa olha qualquer musculação — senão uma
 * semana de treinos avulsos aparecia como uma semana parado.
 */
export function nextInCycle(workouts: WorkoutLog[], today: Date): CycleSuggestion {
  const lifts = workouts
    .filter((w) => LIFT_CYCLE.includes(w.sessionId))
    .sort((a, b) => a.date.localeCompare(b.date))

  const strengthDays = new Set(workouts.filter(isStrengthLog).map((w) => w.date))
  const lastStrengthKey = [...strengthDays].sort().pop()
  const daysSinceStrength = lastStrengthKey ? daysBetween(today, lastStrengthKey) : null

  if (lifts.length === 0) {
    return {
      sessionId: "upperA",
      nextLiftId: "upperA",
      reason: "start",
      loadFactor: 1,
      daysSinceLastLift: null,
      daysSinceStrength,
    }
  }

  const last = lifts[lifts.length - 1]
  const next = LIFT_CYCLE[(LIFT_CYCLE.indexOf(last.sessionId) + 1) % LIFT_CYCLE.length]
  const todayKey = toDateKey(today)
  const daysSince = daysBetween(today, last.date)

  if (daysSince >= 7 && (daysSinceStrength === null || daysSinceStrength >= 7)) {
    return {
      sessionId: last.sessionId,
      nextLiftId: last.sessionId,
      reason: "regression",
      loadFactor: 0.9,
      daysSinceLastLift: daysSince,
      daysSinceStrength,
    }
  }

  const strengthOn = (key: string) => strengthDays.has(key)
  if (
    !strengthOn(todayKey) &&
    strengthOn(dateKeyDaysAgo(today, 1)) &&
    strengthOn(dateKeyDaysAgo(today, 2))
  ) {
    return {
      sessionId: "cardioZ2",
      nextLiftId: next,
      reason: "recovery",
      loadFactor: 1,
      daysSinceLastLift: daysSince,
      daysSinceStrength,
    }
  }

  return {
    sessionId: next,
    nextLiftId: next,
    reason: "next",
    loadFactor: 1,
    daysSinceLastLift: daysSince,
    daysSinceStrength,
  }
}

/**
 * Estado do card principal no modo ciclo.
 *
 * O ciclo pode avançar para o próximo lift assim que um lift é salvo hoje. Nesse
 * caso, o painel não deve marcar o próximo lift como concluído; ele mostra o lift
 * que acabou de ser registrado e mantém a próxima sugestão em `suggestion`.
 *
 * Qualquer treino registrado hoje conta como treino feito — um avulso ou uma
 * rola não são o lift da fila, mas o painel também não pode fingir que o dia
 * está parado. Quando o lift continua pendente, ele volta em `pendingSessionId`
 * para o card seguir oferecendo o registro.
 */
export function cycleTodayView(workouts: WorkoutLog[], today: Date): CycleTodayView {
  const suggestion = nextInCycle(workouts, today)
  const todayKey = toDateKey(today)
  const todayLogs = workouts.filter((w) => w.date === todayKey && w.sessionId !== "rest")
  const suggestedLog = todayLogs.find((w) => w.sessionId === suggestion.sessionId) ?? null
  const completedLift =
    [...todayLogs].reverse().find((w) => LIFT_CYCLE.includes(w.sessionId)) ?? null
  const lastLogToday = todayLogs[todayLogs.length - 1] ?? null
  const completedLog = suggestedLog ?? completedLift ?? lastLogToday
  // o ciclo está satisfeito quando o que ele pediu foi feito — ou quando
  // qualquer lift da fila entrou no lugar (a fila já avançou sozinha)
  const cycleSatisfied = Boolean(suggestedLog ?? completedLift)

  return {
    suggestion,
    sessionId: completedLog?.sessionId ?? suggestion.sessionId,
    completedSessionId: completedLog?.sessionId ?? null,
    completedLiftSessionId: completedLift?.sessionId ?? null,
    done: Boolean(completedLog),
    pendingSessionId: cycleSatisfied ? null : suggestion.sessionId,
  }
}

export interface Rolling7 {
  /** sessões de treino (sem esporte/descanso) */
  sessions: number
  /** volume de carga (kg) */
  volume: number
  /** minutos de Zona 2 (esporte fora) */
  z2: number
  /** minutos de cardio intenso (fora da meta de Z2) */
  intense: number
}

/** Métricas da janela móvel dos últimos 7 dias (hoje incluso) */
export function rolling7(
  workouts: WorkoutLog[],
  today: Date,
  program: TrainingProgram = "hypertrophy"
): Rolling7 {
  const start = dateKeyDaysAgo(today, 6)
  const end = toDateKey(today)
  const ws = workouts.filter((w) => w.date >= start && w.date <= end)
  return {
    sessions: ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length,
    volume: ws.reduce((s, w) => s + workoutVolume(w), 0),
    z2: ws.reduce((sum, workout) => sum + zone2Minutes(workout), 0),
    intense: ws.reduce((sum, workout) => sum + intenseMinutes(workout), 0),
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
