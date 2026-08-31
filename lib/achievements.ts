import { prEvents } from "./insights"
import { intenseMinutes, totalCardioMinutes, zone2Minutes } from "./cardio"
import {
  ENGINE_CYCLE_WEEKS,
  ENGINE_START_DATE,
  ENGINE_WEEKLY_VOLUME,
  engineCycleWeek,
  enginePhaseFor,
} from "./engine-plan"
import { GymData } from "./types"
import { countsTowardProgramTarget, countsTowardTrainingTarget } from "./plan"
import { fromDateKey, mondayOf, toDateKey, workoutVolume } from "./utils"

/**
 * Conquistas Xbox-style: marcos calculados do histórico completo.
 * Tudo derivado — nada precisa ser persistido.
 */
export interface Achievement {
  id: string
  emoji: string
  name: string
  desc: string
  target: number
  current: number
  unlocked: boolean
  /** formatação do progresso (padrão: inteiro) */
  unit?: "kg" | "min"
}

interface EngineWeekProgress {
  week: number
  z2: number
  intense: number
  cardio: number
  sessions: number
  strengthSessions: number
  hasForceA: boolean
  hasForceB: boolean
  hasHomeSession: boolean
  hasMotorSession: boolean
  hasIntervalsSession: boolean
  intenseSessions: number
}

function startOfEngineWeek(week: number): Date {
  const date = fromDateKey(ENGINE_START_DATE)
  date.setDate(date.getDate() + (week - 1) * 7)
  return date
}

function visibleEngineWeeks(today: Date): number {
  if (toDateKey(today) < ENGINE_START_DATE) return 0
  return engineCycleWeek(today) ?? ENGINE_CYCLE_WEEKS
}

function minimumEngineSessionTarget(week: number): number {
  return Number.parseInt(enginePhaseFor(startOfEngineWeek(week)).weeklySessions, 10)
}

function minimumEngineZone2Target(week: number): number {
  return enginePhaseFor(startOfEngineWeek(week)).z2Target.min
}

function longestTrueRun(values: boolean[]): number {
  let longest = 0
  let current = 0
  for (const value of values) {
    current = value ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

function bestTrueCountInWindow(values: boolean[], windowSize: number): number {
  let best = 0
  for (let end = 0; end < values.length; end++) {
    const start = Math.max(0, end - windowSize + 1)
    const count = values.slice(start, end + 1).filter(Boolean).length
    best = Math.max(best, count)
  }
  return best
}

function engineProgress(data: GymData, today: Date): EngineWeekProgress[] {
  const visibleWeeks = visibleEngineWeeks(today)
  const weeks = ENGINE_WEEKLY_VOLUME.slice(0, visibleWeeks).map((target) => ({
    week: target.week,
    z2: 0,
    intense: 0,
    cardio: 0,
    sessions: 0,
    strengthSessions: 0,
    hasForceA: false,
    hasForceB: false,
    hasHomeSession: false,
    hasMotorSession: false,
    hasIntervalsSession: false,
    intenseSessions: 0,
  }))
  const todayKey = toDateKey(today)

  for (const workout of data.workouts) {
    if (workout.date > todayKey) continue
    const week = engineCycleWeek(fromDateKey(workout.date))
    if (week === null || week > visibleWeeks) continue
    const progress = weeks[week - 1]
    if (!progress) continue

    progress.z2 += zone2Minutes(workout)
    progress.intense += intenseMinutes(workout)
    progress.cardio += totalCardioMinutes(workout)
    if (countsTowardProgramTarget(workout.sessionId, "engine")) progress.sessions++

    if (workout.sessionId === "engineForceA") {
      progress.strengthSessions++
      progress.hasForceA = true
    }
    if (workout.sessionId === "engineForceB") {
      progress.strengthSessions++
      progress.hasForceB = true
    }
    if (workout.sessionId === "engineHome") progress.hasHomeSession = true
    if (workout.sessionId === "engineMotor") {
      progress.hasMotorSession = true
      progress.intenseSessions++
    }
    if (workout.sessionId === "engineIntervals") {
      progress.hasIntervalsSession = true
      progress.intenseSessions++
    }
  }

  return weeks
}

export function computeAchievements(data: GymData, today: Date): Achievement[] {
  const workouts = [...data.workouts].sort((a, b) => a.date.localeCompare(b.date))

  const totalWorkouts = workouts.length
  const totalSets = workouts.reduce(
    (s, w) => s + w.entries.reduce((x, e) => x + e.sets.length, 0),
    0
  )
  const totalVolume = workouts.reduce((s, w) => s + workoutVolume(w), 0)
  const totalZ2 = workouts.reduce((sum, workout) => sum + zone2Minutes(workout), 0)
  const totalPRs = prEvents(workouts).length
  const engineWeeks = engineProgress(data, today)
  const cycleZ2 = engineWeeks.reduce((sum, week) => sum + week.z2, 0)
  const cycleIntense = engineWeeks.reduce((sum, week) => sum + week.intense, 0)
  const foundationWeeks = engineWeeks.slice(0, 4).filter((week) => {
    const target = ENGINE_WEEKLY_VOLUME[week.week - 1]
    return (
      week.z2 >= target.cardio * 0.8 &&
      week.intense === 0 &&
      week.intenseSessions === 0
    )
  }).length
  const weekOnTrack = (week: EngineWeekProgress) =>
    week.z2 >= minimumEngineZone2Target(week.week) &&
    week.sessions >= minimumEngineSessionTarget(week.week)
  const weeksOnTrack = engineWeeks.filter(weekOnTrack)
  const zone2GoalStreak = longestTrueRun(
    engineWeeks.map((week) => week.z2 >= minimumEngineZone2Target(week.week))
  )
  const reliefWeeks = engineWeeks.filter((week) => {
    const target = ENGINE_WEEKLY_VOLUME[week.week - 1]
    if (!target.easy) return false
    return (
      week.cardio >= target.cardio * 0.8 &&
      week.cardio <= target.cardio &&
      week.strengthSessions >= 2 &&
      week.intenseSessions <= target.intense
    )
  }).length
  const strengthWeeks = engineWeeks.map((week) => week.strengthSessions >= 2)
  const hybridWeeks = engineWeeks.map(
    (week) => week.strengthSessions >= 2 && week.z2 >= minimumEngineZone2Target(week.week)
  )
  const bestStrengthWindow = bestTrueCountInWindow(strengthWeeks, 10)
  const bestHybridWindow = bestTrueCountInWindow(hybridWeeks, 10)
  const hasMotorInBlock2 = engineWeeks.some(
    (week) => week.week >= 5 && week.hasMotorSession
  )
  const hasPowerWeek = engineWeeks.some(
    (week) => week.week >= 5 && week.hasMotorSession && week.hasIntervalsSession
  )
  const hasForcePair = engineWeeks.some((week) => week.hasForceA && week.hasForceB)
  const hasHomeSession = engineWeeks.some((week) => week.hasHomeSession)

  // sessões de treino (sem esporte) por semana + semanas com qualquer registro
  const sessionsPerWeek = new Map<string, number>()
  const weeksWithWorkout = new Set<string>()
  for (const w of workouts) {
    const key = toDateKey(mondayOf(fromDateKey(w.date)))
    weeksWithWorkout.add(key)
    if (countsTowardTrainingTarget(w.sessionId)) {
      sessionsPerWeek.set(key, (sessionsPerWeek.get(key) ?? 0) + 1)
    }
  }
  const bestWeek = Math.max(0, ...sessionsPerWeek.values())

  // maior sequência de semanas com treino (a semana atual incompleta não zera)
  let longestStreak = 0
  if (workouts.length > 0) {
    const currentMonday = mondayOf(today)
    let run = 0
    const cursor = mondayOf(fromDateKey(workouts[0].date))
    while (cursor <= currentMonday) {
      if (weeksWithWorkout.has(toDateKey(cursor))) {
        run++
        longestStreak = Math.max(longestStreak, run)
      } else if (cursor.getTime() !== currentMonday.getTime()) {
        run = 0
      }
      cursor.setDate(cursor.getDate() + 7)
    }
  }

  const defs: Omit<Achievement, "unlocked">[] = [
    { id: "first", emoji: "🏁", name: "Primeira marcha", desc: "Registre o primeiro treino", target: 1, current: totalWorkouts },
    { id: "week5", emoji: "📅", name: "Semana fechada", desc: "5 sessões na mesma semana", target: 5, current: bestWeek },
    { id: "streak4", emoji: "🔥", name: "Mês de ferro", desc: "4 semanas seguidas treinando", target: 4, current: longestStreak },
    { id: "streak12", emoji: "🛡️", name: "Trimestre blindado", desc: "12 semanas seguidas treinando", target: 12, current: longestStreak },
    { id: "sets100", emoji: "💯", name: "Centurião", desc: "100 séries registradas", target: 100, current: totalSets },
    { id: "sets500", emoji: "⚙️", name: "Engrenagem", desc: "500 séries registradas", target: 500, current: totalSets },
    { id: "sets1000", emoji: "👑", name: "Mil séries", desc: "1.000 séries registradas", target: 1000, current: totalSets },
    { id: "ton50", emoji: "🏗️", name: "50 toneladas", desc: "50 t de carga acumulada", target: 50_000, current: totalVolume, unit: "kg" },
    { id: "ton250", emoji: "🚛", name: "250 toneladas", desc: "250 t de carga acumulada", target: 250_000, current: totalVolume, unit: "kg" },
    { id: "ton1000", emoji: "🏔️", name: "Mil toneladas", desc: "1.000 t de carga acumulada", target: 1_000_000, current: totalVolume, unit: "kg" },
    { id: "pr1", emoji: "🎯", name: "Recorde pessoal", desc: "Bata seu primeiro PR", target: 1, current: totalPRs },
    { id: "pr10", emoji: "💥", name: "Caçador de PRs", desc: "10 PRs batidos", target: 10, current: totalPRs },
    { id: "z2_500", emoji: "🫀", name: "Motor aeróbico", desc: "500 min de Zona 2", target: 500, current: totalZ2, unit: "min" },
    { id: "engine-foundation", emoji: "🧱", name: "Fundação cumprida", desc: "4 semanas com ≥80% da Zona 2, sem intenso", target: 4, current: foundationWeeks },
    { id: "engine-week-on-track", emoji: "🧭", name: "Semana no trilho", desc: "Meta de Zona 2 e sessões do ciclo na mesma semana", target: 1, current: weeksOnTrack.length > 0 ? 1 : 0 },
    { id: "engine-force-pair", emoji: "🏋️", name: "Dupla de força", desc: "Força A e B na mesma semana", target: 1, current: hasForcePair ? 1 : 0 },
    { id: "engine-home", emoji: "🏠", name: "Plano B executado", desc: "Registre a primeira Sessão Casa", target: 1, current: hasHomeSession ? 1 : 0 },
    { id: "engine-motor-unlocked", emoji: "🔓", name: "Motor desbloqueado", desc: "Primeiro 4×4 a partir da semana 5", target: 1, current: hasMotorInBlock2 ? 1 : 0 },
    { id: "engine-power-week", emoji: "⚡", name: "Semana de potência", desc: "4×4 e 30/30 na mesma semana", target: 1, current: hasPowerWeek ? 1 : 0 },
    { id: "engine-deload", emoji: "🌿", name: "Alívio inteligente", desc: "Cumpra as 2 semanas leves sem compensar volume", target: 2, current: reliefWeeks },
    { id: "engine-z2-streak", emoji: "🫁", name: "Base de ferro", desc: "Meta de Zona 2 por 4 semanas seguidas", target: 4, current: zone2GoalStreak },
    { id: "engine-z2-1500", emoji: "🚂", name: "Motor diesel", desc: "1.500 min de Zona 2 no ciclo", target: 1500, current: cycleZ2, unit: "min" },
    { id: "engine-intense-120", emoji: "🔥", name: "Alto giro", desc: "120 min de cardio intenso no ciclo", target: 120, current: cycleIntense, unit: "min" },
    { id: "engine-strength-8of10", emoji: "🛡️", name: "Força preservada", desc: "2 sessões de força em 8 de 10 semanas", target: 8, current: bestStrengthWindow },
    { id: "engine-hybrid-8of10", emoji: "⚙️", name: "Atleta híbrido", desc: "Força e meta aeróbica em 8 de 10 semanas", target: 8, current: bestHybridWindow },
    { id: "engine-cycle-10of12", emoji: "🏁", name: "Ciclo consistente", desc: "Meta do ciclo em 10 das 12 semanas", target: 10, current: weeksOnTrack.length },
    { id: "bronze", emoji: "🥉", name: "Atleta Bronze", desc: "10 treinos registrados", target: 10, current: totalWorkouts },
    { id: "silver", emoji: "🥈", name: "Atleta Prata", desc: "50 treinos registrados", target: 50, current: totalWorkouts },
    { id: "gold", emoji: "🥇", name: "Atleta Ouro", desc: "100 treinos registrados", target: 100, current: totalWorkouts },
  ]

  return defs.map((d) => ({ ...d, unlocked: d.current >= d.target }))
}
