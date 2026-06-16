export type SessionId =
  | "upperA"
  | "cardioZ2"
  | "lowerA"
  | "upperB"
  | "lowerB"
  | "sport"
  | "rest"

export type SessionKind = "lift" | "cardio" | "sport" | "rest"

export interface ExercisePrescription {
  id: string
  name: string
  nameEn: string
  sets: number
  repsMin: number
  repsMax: number
  /** "reps" para séries normais, "seconds" para isometria (prancha) */
  unit: "reps" | "seconds"
  rest: string
  note: string
}

export interface SessionPlan {
  id: SessionId
  title: string
  subtitle: string
  /** 1 = segunda ... 7 = domingo (ISO) */
  weekday: number
  duration: string
  kind: SessionKind
  accent: "ember" | "zone" | "steel"
  exercises: ExercisePrescription[]
  cardioAfter?: { minutes: number; label: string }
  description?: string
}

export interface SetLog {
  weight: number
  reps: number
  /** reps em reserva ao fim da série (0–4); opcional, registros antigos não têm */
  rir?: number
}

/** Linha de série na UI de registro (strings cruas dos inputs) */
export interface SetRow {
  weight: string
  reps: string
  done: boolean
  /** "" = não informado; "0".."4" */
  rir?: string
}

export interface ExerciseLog {
  exerciseId: string
  sets: SetLog[]
}

export interface CardioLog {
  minutes: number
  avgBpm?: number
  mode: string
}

export interface WorkoutLog {
  id: string
  /** yyyy-MM-dd */
  date: string
  sessionId: SessionId
  durationMin?: number
  entries: ExerciseLog[]
  cardio?: CardioLog
  notes?: string
  /** esforço da sessão, escala de Foster 1–10 (1 tap pós-treino) */
  srpe?: number
  /** ISO timestamp da primeira série marcada */
  startedAt?: string
}

export interface BodyLog {
  /** yyyy-MM-dd */
  date: string
  weightKg: number
  waistCm?: number
}

export interface HydrationLog {
  /** yyyy-MM-dd */
  date: string
  /** total acumulado do dia em ml */
  ml: number
}

export interface SleepLog {
  /** yyyy-MM-dd do dia em que acordou */
  date: string
  /** HH:mm */
  sleptAt: string
  /** HH:mm */
  wokeAt: string
  durationMin: number
}

export interface GymData {
  workouts: WorkoutLog[]
  body: BodyLog[]
  hydration: HydrationLog[]
  sleep: SleepLog[]
}
