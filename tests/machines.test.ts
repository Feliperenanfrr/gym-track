import { describe, expect, it } from "vitest"
import { prEvents } from "../lib/insights"
import {
  backfillCandidates,
  backfillKey,
  liftKey,
  liftName,
  looksLikeLbStack,
  machinesFor,
  normalizeMachine,
  parseLiftKey,
  tagEntries,
} from "../lib/machines"
import { PLAN_BY_ID } from "../lib/plan"
import { loggedWeights } from "../lib/progression"
import { reportLifts } from "../lib/reports"
import { exerciseStrength, frequentExercises, relativeLoadBoard } from "../lib/strength"
import { ExerciseLog, ExerciseMachine, WorkoutLog } from "../lib/types"
import { openLogForEditing } from "../lib/workout-form"

const LB: ExerciseMachine = { id: "m-lb", exerciseId: "legext", name: "Extensora do fundo", loadUnit: "lb" }
const KG: ExerciseMachine = { id: "m-kg", exerciseId: "legext", name: "Extensora da janela", loadUnit: "kg" }

function legext(weights: number[], reps = 12, machine?: ExerciseMachine): ExerciseLog {
  return {
    exerciseId: "legext",
    exerciseName: "Cadeira extensora",
    ...(machine ? { machineId: machine.id, machineName: machine.name } : {}),
    sets: weights.map((weight) => ({ weight, reps, rir: 1 })),
  }
}

function workout(date: string, entries: ExerciseLog[]): WorkoutLog {
  return { id: `w-${date}`, date, sessionId: "free", entries }
}

/** As sessões reais da extensora: duas pilhas misturadas no mesmo exercício. */
const REAL_LB = [
  [36, 45, 45],
  [36, 45, 55, 64],
  [36, 45, 60, 72],
]
const REAL_KG = [
  [60, 75, 110],
  [50, 60, 75, 75],
  [50, 50, 60],
  [55, 60, 55],
  [75, 100, 110],
  [80, 70, 70],
  [60, 70, 70, 70],
]

describe("chave de comparação", () => {
  it("sem máquina é o próprio exercício; com máquina, exercício#máquina", () => {
    expect(liftKey(legext([60]))).toBe("legext")
    const key = liftKey(legext([60], 12, LB))
    expect(key).toBe("legext#m-lb")
    expect(parseLiftKey(key)).toEqual({ exerciseId: "legext", machineId: "m-lb" })
    expect(parseLiftKey("legext")).toEqual({ exerciseId: "legext" })
  })

  it("o nome mostra a máquina", () => {
    expect(liftName(legext([60], 12, LB))).toBe("Cadeira extensora · Extensora do fundo")
    expect(liftName(legext([60]))).toBe("Cadeira extensora")
  })
})

describe("cadastro", () => {
  it("normaliza a linha do banco e descarta lixo", () => {
    expect(
      normalizeMachine({ id: "a", exercise_id: "legext", name: " Fundo ", load_unit: "lb", load_step: "10" })
    ).toEqual({ id: "a", exerciseId: "legext", name: "Fundo", loadUnit: "lb", loadStep: 10 })
    expect(normalizeMachine({ id: "a", exercise_id: "legext", name: "", load_unit: "lb" })).toBeNull()
    expect(normalizeMachine({ id: "b", exercise_id: "x", name: "Y", load_unit: "??" })?.loadUnit).toBe("kg")
  })

  it("lista só as ativas do exercício, em ordem alfabética", () => {
    const all = [LB, KG, { ...KG, id: "old", name: "Antiga", archived: true }]
    expect(machinesFor(all, "legext").map((m) => m.name)).toEqual([
      "Extensora da janela",
      "Extensora do fundo",
    ])
  })
})

describe("palpite kg × lb no histórico real da extensora", () => {
  it("as sessões da pilha em lb têm cara de lb convertido de cabeça", () => {
    for (const weights of REAL_LB) expect(looksLikeLbStack(legext(weights))).toBe(true)
  })

  it("as da pilha em kg não — mesmo quando 50 ou 75 kg caem perto de uma placa em lb", () => {
    for (const weights of REAL_KG) expect(looksLikeLbStack(legext(weights))).toBe(false)
  })

  it("registro já digitado em lb é lb", () => {
    expect(looksLikeLbStack({ ...legext([45.359]), loadUnit: "lb" })).toBe(true)
  })
})

describe("marcar treinos antigos", () => {
  const workouts = [
    workout("2026-09-17", [legext([36, 45, 55, 64])]),
    workout("2026-09-28", [legext([80, 70, 70])]),
    workout("2026-10-01", [legext([60, 70, 70, 70], 12, KG)]),
    workout("2026-10-03", [legext([36, 45, 60, 72])]),
  ]

  it("lista só os sem máquina, antes de hoje, mais recentes primeiro, com palpite", () => {
    const lb = backfillCandidates(workouts, "legext", LB, "2026-10-03")
    expect(lb.map((c) => c.date)).toEqual(["2026-09-28", "2026-09-17"])
    expect(lb.map((c) => c.suggested)).toEqual([false, true])
    const kg = backfillCandidates(workouts, "legext", KG, "2026-10-04")
    expect(kg.find((c) => c.date === "2026-09-28")?.suggested).toBe(true)
    expect(kg.find((c) => c.date === "2026-10-03")?.suggested).toBe(false)
  })

  it("marca só os escolhidos, com o nome da máquina como snapshot", () => {
    const changed = tagEntries(workouts, new Set([backfillKey(workouts[0], "legext")]), "legext", LB)
    expect(changed).toHaveLength(1)
    expect(changed[0].entries[0]).toMatchObject({ machineId: "m-lb", machineName: "Extensora do fundo" })
  })
})

describe("comparação dentro da mesma máquina", () => {
  const workouts = [
    workout("2026-09-08", [legext([75, 100, 110], 8, KG)]),
    workout("2026-09-17", [legext([36, 45, 55, 64], 12, LB)]),
    workout("2026-10-01", [legext([60, 70, 70, 70], 12, KG)]),
    workout("2026-10-03", [legext([36, 45, 60, 72], 12, LB)]),
  ]

  it("PR só contra a mesma máquina — a 1ª sessão numa máquina é a base", () => {
    const events = prEvents(workouts)
    // 03/10 supera 17/09 na pilha em lb; 110 kg na outra não conta contra ela
    expect(events.map((e) => [e.date, e.exerciseId])).toEqual([["2026-10-03", "legext#m-lb"]])
    expect(events[0].exerciseName).toBe("Cadeira extensora · Extensora do fundo")
  })

  it("cada máquina é uma linha própria no gráfico de força", () => {
    const list = frequentExercises(workouts, new Date(2026, 9, 4))
    expect(list.map((l) => l.id).sort()).toEqual(["legext#m-kg", "legext#m-lb"])
    expect(list.find((l) => l.id === "legext#m-lb")?.name).toBe("Cadeira extensora · Extensora do fundo")
    const lb = exerciseStrength(workouts, "legext#m-lb")
    expect(lb.points.map((p) => p.carga)).toEqual([64, 72])
    // na mistura antiga, 72 depois de 110 parecia 65% do recorde
    expect(relativeLoadBoard(workouts, new Date(2026, 9, 4)).every((row) => row.relativePct >= 60)).toBe(true)
  })

  it("o passo se infere só no histórico da máquina", () => {
    expect(loggedWeights(workouts, "legext", 12, "kg", KG.id).sort((a, b) => a - b)).toEqual([
      60, 70, 70, 70, 75, 100, 110,
    ])
    expect(loggedWeights(workouts, "legext", 12, "kg", null)).toEqual([])
    expect(loggedWeights(workouts, "legext", 12, "kg")).toHaveLength(15)
  })

  it("o relatório separa as máquinas", () => {
    const lines = reportLifts(workouts, "2026-09-01", "2026-10-04")
    expect(lines.map((l) => l.exerciseId).sort()).toEqual(["legext#m-kg", "legext#m-lb"])
    expect(lines.every((l) => l.muscleGroup === "Quadríceps")).toBe(true)
  })
})

describe("reabertura", () => {
  it("registro de hoje reabre na máquina em que foi salvo — ou explicitamente sem", () => {
    const log = workout("2026-10-04", [legext([45.359], 12, LB), { exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }])
    const opened = openLogForEditing(log, PLAN_BY_ID.free)
    expect(opened.exercises.find((e) => e.id === "legext")?.machineId).toBe("m-lb")
    expect(opened.exercises.find((e) => e.id === "bench")?.machineId).toBeNull()
  })
})
