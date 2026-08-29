export type SessionId =
  | "upperA"
  | "cardioZ2"
  | "lowerA"
  | "upperB"
  | "lowerB"
  | "bjjPull"
  | "bjjBase"
  | "bjjEngine"
  | "bjjZ2"
  /* aposentados: protocolo do flag football, mantidos só para o histórico */
  | "competitionLower"
  | "competitionUpper"
  | "competitionPower"
  | "competitionZ2"
  | "free"
  | "sport"
  | "rest"

export type TrainingProgram = "bjj" | "hypertrophy"

export type SessionKind = "lift" | "cardio" | "sport" | "rest" | "mixed"

export type MuscleGroup =
  | "Quadríceps"
  | "Posterior/Glúteo"
  | "Panturrilha"
  | "Costas"
  | "Peito"
  | "Ombro"
  | "Braço"
  | "Core"
  | "Pescoço"

export type CardioPurpose = "zone2" | "intense" | "sport"

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
  /** Necessário em exercícios fora do plano para manter as métricas por grupo. */
  muscleGroup?: MuscleGroup
}

export interface SessionPlan {
  id: SessionId
  title: string
  subtitle: string
  /** 1 = segunda ... 7 = domingo (ISO) */
  weekday: number
  duration: string
  kind: SessionKind
  accent: "ember" | "zone" | "steel" | "gold"
  exercises: ExercisePrescription[]
  cardioAfter?: { minutes: number; label: string }
  cardioTarget?: {
    min: number
    max: number
    defaultMinutes: number
    bpmMin?: number
    bpmMax?: number
  }
  description?: string
  /**
   * Versão da prescrição. Quando o plano muda de exercícios, o versionamento
   * descarta templates antigos (cache e Supabase) em favor do novo default —
   * sem isso, a linha já materializada no banco continuaria vencendo.
   */
  planVersion?: string
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
  /** Preserva exercícios personalizados e substituições no histórico. */
  exerciseName?: string
  muscleGroup?: MuscleGroup
  sets: SetLog[]
}

export interface CardioLog {
  minutes: number
  avgBpm?: number
  mode: string
  /** Ausente em registros antigos, que são interpretados pelo tipo da sessão. */
  purpose?: CardioPurpose
}

/** Linha de cardio na UI de registro (strings cruas dos inputs) */
export interface CardioRow {
  minutes: string
  bpm: string
  mode: string
  purpose: CardioPurpose
}

export interface WorkoutLog {
  id: string
  /** yyyy-MM-dd */
  date: string
  sessionId: SessionId
  /**
   * Duração TOTAL da sessão em minutos: musculação medida (1ª série → salvar)
   * mais todos os blocos de cardio. Registros retroativos não têm.
   */
  durationMin?: number
  entries: ExerciseLog[]
  /**
   * Blocos de cardio da sessão. 15 min de bike, 15 min de corrida e a
   * caminhada de volta são três blocos — cada um com sua modalidade e
   * finalidade. Use `cardioBlocks()` para ler; registros antigos guardam
   * um único bloco em `cardio`.
   */
  cardios?: CardioLog[]
  /** Primeiro bloco, espelhado para leitura de registros anteriores a `cardios`. */
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
  /** Opcional: dá pra registrar só a cintura num dia (peso vem da balança). */
  weightKg?: number
  waistCm?: number
  /**
   * Bioimpedância — todos opcionais. Registros antigos e entradas manuais só
   * de peso não têm. Guardamos o subconjunto com sinal real para recomposição;
   * os %s de músculo são redundantes com os kg + peso e ficam de fora.
   */
  /** Gordura corporal (%) */
  bodyFatPct?: number
  /** Peso da gordura (kg) */
  fatMassKg?: number
  /** Peso da massa muscular esquelética (kg) — métrica mais limpa p/ músculo */
  skeletalMuscleKg?: number
  /** Peso da massa muscular total (kg) — inclui água, mais ruidosa */
  muscleMassKg?: number
  /** Água corporal (%) */
  waterPct?: number
  /** Gordura visceral (índice da balança) */
  visceralFat?: number
  /** Metabolismo basal (kcal/dia) */
  bmrKcal?: number
  /** IMC */
  bmi?: number
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
