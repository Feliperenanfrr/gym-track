import { describe, expect, it } from "vitest"
import { EXERCISE_CATALOG, makeCustomExercise } from "../lib/exercise-catalog"
import { prEvents } from "../lib/insights"
import { LEGACY_SESSIONS } from "../lib/legacy-plan"
import {
  bestE1RMAdjusted,
  formatPrescription,
  formatSetsSummary,
  looksLikeTimeInReps,
  measureOf,
  workoutVolume,
} from "../lib/measure"
import { volumeByGroup } from "../lib/muscles"
import { ALL_PLAN_SESSIONS, PLAN_BY_ID } from "../lib/plan"
import { frequentExercises } from "../lib/strength"
import { ExerciseLog, ExerciseUnit, WorkoutLog } from "../lib/types"
import { openLogForEditing } from "../lib/workout-form"

function workout(date: string, entries: ExerciseLog[]): WorkoutLog {
  return { id: `w-${date}`, date, sessionId: "free", entries }
}

const FARMER: ExerciseLog = {
  exerciseId: "farmer-carry",
  sets: [
    { weight: 24, reps: 40 },
    { weight: 24, reps: 40 },
  ],
}

describe("um exercício, um tipo de medida", () => {
  it("nenhum id muda de unidade entre protocolos ou no catálogo", () => {
    // "plank" e "farmer-carry" já mudaram de medida entre planos: o catálogo
    // escolhe UMA prescrição por id, e o histórico seria lido errado
    const units = new Map<string, Set<ExerciseUnit>>()
    const all = [
      ...[...LEGACY_SESSIONS, ...ALL_PLAN_SESSIONS].flatMap((session) => session.exercises),
      ...EXERCISE_CATALOG,
    ]
    for (const exercise of all) {
      const set = units.get(exercise.id) ?? new Set<ExerciseUnit>()
      set.add(exercise.unit)
      units.set(exercise.id, set)
    }
    const mixed = [...units].filter(([, set]) => set.size > 1).map(([id]) => id)
    expect(mixed).toEqual([])
  })

  it("buscar prancha no seletor acha a prancha simples, em segundos", () => {
    // a causa da prancha de 03/10 registrada como 60 reps de dead bug
    const plank = EXERCISE_CATALOG.find((exercise) => exercise.name === "Prancha")
    expect(plank?.unit).toBe("seconds")
    expect(EXERCISE_CATALOG.some((exercise) => exercise.name.includes("/ prancha"))).toBe(false)
  })
})

describe("measureOf", () => {
  it("o snapshot do registro vence o plano", () => {
    expect(measureOf({ exerciseId: "custom-x", unit: "seconds" })).toBe("seconds")
  })

  it("registros antigos resolvem pelo plano; desconhecido é repetição", () => {
    expect(measureOf({ exerciseId: "plank" })).toBe("seconds")
    expect(measureOf({ exerciseId: "farmer-carry" })).toBe("meters")
    expect(measureOf({ exerciseId: "dead-bug" })).toBe("reps")
    expect(measureOf({ exerciseId: "custom-qualquer" })).toBe("reps")
  })
})

describe("formatação", () => {
  it("a prescrição carrega a unidade", () => {
    expect(formatPrescription({ sets: 3, repsMin: 45, repsMax: 60, unit: "seconds" })).toBe(
      "3 × 45–60 s"
    )
    expect(formatPrescription({ sets: 4, repsMin: 40, repsMax: 40, unit: "meters" })).toBe("4 × 40 m")
    expect(formatPrescription({ sets: 4, repsMin: 8, repsMax: 12, unit: "reps" })).toBe("4 × 8–12")
  })

  it("a última vez fala a língua do exercício", () => {
    const plank = [
      { weight: 0, reps: 60 },
      { weight: 0, reps: 60 },
    ]
    expect(formatSetsSummary(plank, "seconds")).toBe("60·60 s")
    expect(formatSetsSummary([{ weight: 10, reps: 45 }], "seconds")).toBe("+10 kg × 45 s")
    expect(formatSetsSummary(FARMER.sets, "meters")).toBe("24 kg × 40·40 m")
    expect(formatSetsSummary([{ weight: 52.5, reps: 8 }], "reps")).toBe("52,5 kg × 8")
    expect(formatSetsSummary([{ weight: 0, reps: 12 }], "reps")).toBe("12 reps")
  })
})

describe("1RM, PR e tonelagem só em carga × repetições", () => {
  it("farmer walk não gera 1RM nem PR a cada +2 kg", () => {
    expect(bestE1RMAdjusted(FARMER)).toBe(0)
    const heavier: ExerciseLog = {
      ...FARMER,
      sets: FARMER.sets.map((set) => ({ ...set, weight: 26 })),
    }
    expect(prEvents([workout("2026-09-22", [FARMER]), workout("2026-09-29", [heavier])])).toEqual(
      []
    )
  })

  it("prancha com carga não entra na tonelagem nem no seletor de carga", () => {
    const weightedPlank: ExerciseLog = {
      exerciseId: "plank",
      unit: "seconds",
      muscleGroup: "Core",
      sets: [{ weight: 10, reps: 60 }],
    }
    const bench: ExerciseLog = { exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }
    const w = workout("2026-10-01", [weightedPlank, bench, FARMER])
    expect(workoutVolume(w)).toBe(480)
    expect(volumeByGroup([w]).Core).toBe(0)
    expect(
      frequentExercises([w], new Date(2026, 9, 3)).map((exercise) => exercise.id)
    ).toEqual(["bench"])
  })

  it("carga × repetições segue igual", () => {
    expect(bestE1RMAdjusted({ exerciseId: "bench", sets: [{ weight: 60, reps: 8, rir: 2 }] })).toBe(
      80
    )
  })
})

describe("looksLikeTimeInReps", () => {
  const deadBug = { unit: "reps" as const, repsMax: 12 }

  it("60 reps sem carga num exercício de 8–12 parece tempo", () => {
    expect(looksLikeTimeInReps(deadBug, 0, 60)).toBe(true)
  })

  it("não acusa série com carga, flexão de 40 nem exercício de tempo", () => {
    expect(looksLikeTimeInReps(deadBug, 10, 60)).toBe(false)
    expect(looksLikeTimeInReps({ unit: "reps", repsMax: 20 }, 0, 35)).toBe(false)
    expect(looksLikeTimeInReps({ unit: "seconds", repsMax: 60 }, 0, 60)).toBe(false)
    expect(looksLikeTimeInReps(deadBug, 0, Number.NaN)).toBe(false)
  })
})

describe("cadastro e reabertura", () => {
  it("exercício novo de tempo nasce com faixa em segundos", () => {
    const custom = makeCustomExercise("Prancha lateral", "Core", "seconds")
    expect(custom.unit).toBe("seconds")
    expect(custom.repsMin).toBeGreaterThanOrEqual(20)
    expect(makeCustomExercise("Rosca 21", "Braço").unit).toBe("reps")
  })

  it("reabrir o registro respeita a unidade gravada", () => {
    const log = workout("2026-10-03", [
      { exerciseId: "custom-prancha-lateral", unit: "seconds", sets: [{ weight: 0, reps: 45 }] },
    ])
    const opened = openLogForEditing(log, PLAN_BY_ID.free)
    expect(opened.exercises[0].unit).toBe("seconds")
    expect(opened.rows["custom-prancha-lateral"][0].reps).toBe("45")
  })
})
