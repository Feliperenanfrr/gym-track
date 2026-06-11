import { PLAN_BY_ID } from "./plan"
import { BodyLog, ExerciseLog, GymData, SessionId, WorkoutLog } from "./types"
import { mondayOf, toDateKey } from "./utils"

/**
 * Histórico mockado: 5 semanas completas antes da semana atual + a semana
 * atual até ontem. Determinístico (sem Math.random) para evitar divergência
 * entre renders e manter os números estáveis.
 */

interface Progression {
  /** carga inicial (kg) na semana mais antiga */
  base: number
  /** incremento de carga por semana */
  perWeek: number
  /** arredondamento da carga (2.5 = barra/máquina, 1 = halter) */
  step: number
}

const PROGRESSIONS: Record<string, Progression> = {
  // Upper A
  bench: { base: 57.5, perWeek: 1.6, step: 2.5 },
  row: { base: 60, perWeek: 2, step: 2.5 },
  ohp: { base: 35, perWeek: 1.4, step: 2.5 },
  pulldown: { base: 65, perWeek: 2.4, step: 2.5 },
  curl: { base: 30, perWeek: 1, step: 2.5 },
  skull: { base: 25, perWeek: 1, step: 2.5 },
  // Lower A
  squat: { base: 95, perWeek: 2.6, step: 2.5 },
  rdl: { base: 80, perWeek: 2, step: 2.5 },
  legpress: { base: 180, perWeek: 8, step: 5 },
  legcurl: { base: 45, perWeek: 2, step: 2.5 },
  calf: { base: 80, perWeek: 2, step: 2.5 },
  plank: { base: 0, perWeek: 0, step: 1 }, // isometria: progresso em segundos
  // Upper B
  incline: { base: 22, perWeek: 0.9, step: 1 },
  chestrow: { base: 30, perWeek: 1.4, step: 1 },
  lateral: { base: 9, perWeek: 0.55, step: 1 },
  facepull: { base: 25, perWeek: 1, step: 2.5 },
  hammer: { base: 12, perWeek: 0.9, step: 1 },
  pushdown: { base: 25, perWeek: 1.5, step: 2.5 },
  // Lower B
  hack: { base: 100, perWeek: 4, step: 5 },
  deadlift: { base: 120, perWeek: 1.6, step: 2.5 },
  legext: { base: 50, perWeek: 2, step: 2.5 },
  seatedcurl: { base: 40, perWeek: 2, step: 2.5 },
  seatedcalf: { base: 50, perWeek: 2, step: 2.5 },
  cablecrunch: { base: 35, perWeek: 2, step: 2.5 },
}

/** hash determinístico simples → [0, 1) */
function pseudo(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 8) / 0xffffff
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

const MOCK_WEEKS = 5

function liftEntries(sessionId: SessionId, week: number): ExerciseLog[] {
  const session = PLAN_BY_ID[sessionId]
  return session.exercises.map((ex) => {
    const prog = PROGRESSIONS[ex.id]
    const sets = []
    for (let i = 0; i < ex.sets; i++) {
      if (ex.unit === "seconds") {
        // prancha: segundos sobem com as semanas
        const secs = Math.min(ex.repsMax, ex.repsMin + week * 5 + Math.floor(pseudo(`${ex.id}${week}${i}`) * 6) - i * 2)
        sets.push({ weight: 0, reps: Math.max(ex.repsMin, secs) })
        continue
      }
      const weight = roundTo(prog.base + week * prog.perWeek, prog.step)
      const spread = ex.repsMax - ex.repsMin
      const jitter = Math.floor(pseudo(`${ex.id}${week}${i}`) * (spread + 1))
      const fatigue = i >= 2 ? 1 : 0
      const reps = Math.max(ex.repsMin, Math.min(ex.repsMax, ex.repsMax - jitter - fatigue))
      sets.push({ weight, reps })
    }
    return { exerciseId: ex.id, sets }
  })
}

export function generateMockData(today: Date): GymData {
  const workouts: WorkoutLog[] = []
  const body: BodyLog[] = []
  const currentMonday = mondayOf(today)

  for (let week = 0; week <= MOCK_WEEKS; week++) {
    const monday = new Date(currentMonday)
    monday.setDate(monday.getDate() - (MOCK_WEEKS - week) * 7)

    const day = (offset: number) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + offset)
      return d
    }

    const pushIfPast = (d: Date, log: Omit<WorkoutLog, "id" | "date">) => {
      if (toDateKey(d) >= toDateKey(today)) return // só até ontem
      workouts.push({ id: `mock-${toDateKey(d)}-${log.sessionId}`, date: toDateKey(d), ...log })
    }

    // Segunda — Upper A
    pushIfPast(day(0), {
      sessionId: "upperA",
      durationMin: 68 + Math.floor(pseudo(`durA${week}`) * 8),
      entries: liftEntries("upperA", week),
    })

    // Terça — Cardio Zona 2 (fôlego melhorando: mais minutos, bpm médio menor)
    pushIfPast(day(1), {
      sessionId: "cardioZ2",
      durationMin: 40 + week * 2,
      entries: [],
      cardio: {
        minutes: 40 + week * 2,
        avgBpm: 137 - week,
        mode: week % 2 === 0 ? "Bike ergométrica" : "Esteira inclinada",
      },
    })

    // Quarta — Lower A
    pushIfPast(day(2), {
      sessionId: "lowerA",
      durationMin: 60 + Math.floor(pseudo(`durLA${week}`) * 8),
      entries: liftEntries("lowerA", week),
    })

    // Quinta — Upper B
    pushIfPast(day(3), {
      sessionId: "upperB",
      durationMin: 58 + Math.floor(pseudo(`durUB${week}`) * 8),
      entries: liftEntries("upperB", week),
    })

    // Sexta — Lower B + 20 min Z2
    pushIfPast(day(4), {
      sessionId: "lowerB",
      durationMin: 72 + Math.floor(pseudo(`durLB${week}`) * 6),
      entries: liftEntries("lowerB", week),
      cardio: { minutes: 20, avgBpm: 132 - week, mode: "Bike ergométrica" },
    })

    // Sábado — esporte (pulou uma semana, vida real)
    if (week !== 2) {
      pushIfPast(day(5), {
        sessionId: "sport",
        durationMin: 60 + Math.floor(pseudo(`sport${week}`) * 30),
        entries: [],
        cardio: {
          minutes: 60 + Math.floor(pseudo(`sport${week}`) * 30),
          mode: week % 2 === 0 ? "Futsal" : "Flag football",
        },
      })
    }

    // Peso: segunda e quinta de manhã — 93,0 kg caindo ~0,35 kg/semana
    const weightMon = 93.0 - week * 0.35 + (pseudo(`wM${week}`) - 0.5) * 0.3
    const weightThu = 93.0 - (week + 0.45) * 0.35 + (pseudo(`wT${week}`) - 0.5) * 0.3
    const waist = 100.5 - week * 0.45
    if (toDateKey(day(0)) < toDateKey(today)) {
      body.push({ date: toDateKey(day(0)), weightKg: Math.round(weightMon * 10) / 10, waistCm: Math.round(waist * 10) / 10 })
    }
    if (toDateKey(day(3)) < toDateKey(today)) {
      body.push({ date: toDateKey(day(3)), weightKg: Math.round(weightThu * 10) / 10 })
    }
  }

  workouts.sort((a, b) => a.date.localeCompare(b.date))
  body.sort((a, b) => a.date.localeCompare(b.date))
  return { workouts, body }
}
