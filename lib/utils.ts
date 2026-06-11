import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ExerciseLog, SetLog, WorkoutLog } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Volume de uma série (kg movimentado) */
export function setVolume(set: SetLog): number {
  return set.weight * set.reps
}

/** Volume total de um treino de musculação (ignora isometrias sem carga) */
export function workoutVolume(w: WorkoutLog): number {
  return w.entries.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + setVolume(set), 0),
    0
  )
}

/** 1RM estimada (fórmula de Epley) da melhor série do exercício */
export function bestE1RM(entry: ExerciseLog): number {
  return entry.sets.reduce((best, s) => {
    if (s.weight <= 0) return best
    const e1rm = s.weight * (1 + s.reps / 30)
    return Math.max(best, e1rm)
  }, 0)
}

/** Melhor série (maior carga; desempate por reps) */
export function topSet(entry: ExerciseLog): SetLog | undefined {
  return [...entry.sets].sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0]
}

/** yyyy-MM-dd local (sem fuso) */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** ISO weekday: 1=Seg ... 7=Dom */
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

/** Segunda-feira da semana da data */
export function mondayOf(d: Date): Date {
  const out = new Date(d)
  out.setDate(d.getDate() - (isoWeekday(d) - 1))
  out.setHours(0, 0, 0, 0)
  return out
}

export function formatKg(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(".", ",")} t`
  return `${n.toLocaleString("pt-BR")} kg`
}

export const WEEKDAY_SHORT = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]

export function daysSince(d: Date, now = new Date()): number {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}
