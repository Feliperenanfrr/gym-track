import { prEvents } from "./insights"
import { zone2Minutes } from "./cardio"
import { GymData } from "./types"
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

  // sessões de treino (sem esporte) por semana + semanas com qualquer registro
  const sessionsPerWeek = new Map<string, number>()
  const weeksWithWorkout = new Set<string>()
  for (const w of workouts) {
    const key = toDateKey(mondayOf(fromDateKey(w.date)))
    weeksWithWorkout.add(key)
    if (w.sessionId !== "sport" && w.sessionId !== "rest") {
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
    { id: "bronze", emoji: "🥉", name: "Atleta Bronze", desc: "10 treinos registrados", target: 10, current: totalWorkouts },
    { id: "silver", emoji: "🥈", name: "Atleta Prata", desc: "50 treinos registrados", target: 50, current: totalWorkouts },
    { id: "gold", emoji: "🥇", name: "Atleta Ouro", desc: "100 treinos registrados", target: 100, current: totalWorkouts },
  ]

  return defs.map((d) => ({ ...d, unlocked: d.current >= d.target }))
}
