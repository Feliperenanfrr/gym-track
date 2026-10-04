import { describe, expect, it } from "vitest"
import { formatSetsSummary, setsInUnit } from "../lib/measure"
import { PLAN_BY_ID } from "../lib/plan"
import {
  inferLoadStep,
  loggedWeights,
  resolveLoadStep,
  stepKey,
  suggestLoad,
} from "../lib/progression"
import { ExerciseLog, WorkoutLog } from "../lib/types"
import { formatKgApprox, inputToKg, LB_TO_KG, loadForInput } from "../lib/units"
import { openLogForEditing } from "../lib/workout-form"

const CRUNCH = { sets: 3, repsMin: 12, repsMax: 15, unit: "reps" as const }

function workout(date: string, entries: ExerciseLog[]): WorkoutLog {
  return { id: `w-${date}`, date, sessionId: "free", entries }
}

describe("conversão lb ⇄ kg", () => {
  it("grava em kg com 3 casas e volta exata", () => {
    expect(inputToKg(100, "lb")).toBe(45.359)
    expect(loadForInput(45.359, "lb", "lb")).toBe(100)
    expect(loadForInput(inputToKg(101.3, "lb"), "lb", "lb")).toBe(101.3)
    expect(loadForInput(inputToKg(22.5, "lb"), "lb", "lb")).toBe(22.5)
  })

  it("kg digitado é gravado como está; campo vazio ou inválido é zero", () => {
    expect(inputToKg(52.5, "kg")).toBe(52.5)
    expect(inputToKg(Number.NaN, "lb")).toBe(0)
    expect(inputToKg(0, "lb")).toBe(0)
  })

  it("carga antiga convertida de cabeça cai na placa de lb certa", () => {
    // o histórico real: abdominal, puxada e a extensora da pilha em libra
    const legacy: [number, number][] = [
      [23, 50], [27, 60], [32, 70], [36, 80], [41, 90],
      [45, 100], [52, 115], [55, 120], [59, 130], [64, 140], [72, 160],
    ]
    for (const [kg, lb] of legacy) expect(loadForInput(kg, "lb", "kg")).toBe(lb)
  })

  it("kg que não é placa de lb vira meia libra, sem inventar placa", () => {
    expect(loadForInput(60, "lb", "kg")).toBe(132.5)
  })

  it("máquina em lb lida de volta em kg fica no meio quilo", () => {
    expect(loadForInput(45.359, "kg", "lb")).toBe(45.5)
    expect(loadForInput(52.5, "kg", "kg")).toBe(52.5)
  })

  it("≈ kg com uma casa", () => {
    expect(formatKgApprox(100 * LB_TO_KG)).toBe("45,4")
  })
})

describe("passo de carga em lb", () => {
  it("pilha de 10 em 10 lb é reconhecida (em kg pararia em 5)", () => {
    expect(inferLoadStep([50, 60, 70, 80, 90], "lb")).toBe(10)
    expect(inferLoadStep([100, 115, 130], "lb")).toBe(5)
  })

  it("histórico gravado em kg é lido no número da placa", () => {
    const workouts = [
      workout("2026-09-29", [{ exerciseId: "machine-crunch", sets: [{ weight: 23, reps: 12 }, { weight: 27, reps: 12 }] }]),
      workout("2026-10-01", [{ exerciseId: "machine-crunch", sets: [{ weight: 32, reps: 12 }, { weight: 41, reps: 12 }] }]),
    ]
    const lb = loggedWeights(workouts, "machine-crunch", 12, "lb")
    expect(lb.sort((a, b) => a - b)).toEqual([50, 60, 70, 90])
    expect(resolveLoadStep("machine-crunch", lb, {}, "lb")).toBe(10)
  })

  it("passo manual em lb não herda o de kg", () => {
    const overrides = { "machine-crunch": 5, [stepKey("machine-crunch", "lb")]: 15 }
    expect(resolveLoadStep("machine-crunch", [], overrides, "kg")).toBe(5)
    expect(resolveLoadStep("machine-crunch", [], overrides, "lb")).toBe(15)
    expect(resolveLoadStep("outro", [], {}, "lb")).toBe(5)
  })
})

describe("sugestão na unidade da placa", () => {
  it("topo da faixa numa pilha em lb sobe 10 lb, em lb", () => {
    const last: ExerciseLog = {
      exerciseId: "machine-crunch",
      loadUnit: "lb",
      sets: [1, 2, 3].map(() => ({ weight: inputToKg(90, "lb"), reps: 15 })),
    }
    const sug = suggestLoad({ prescription: CRUNCH, lastEntry: last, step: 10, loadUnit: "lb" })
    expect(sug?.advice).toBe("progress")
    expect(sug?.weight).toBe(100)
    expect(sug?.summary).toBe("Subir para 100 lb × 12")
    expect(sug?.detail).toContain("passo de 10 lb")
  })

  it("registro antigo em kg vira o número da placa na sugestão", () => {
    const last: ExerciseLog = {
      exerciseId: "machine-crunch",
      sets: [1, 2, 3].map(() => ({ weight: 41, reps: 12 })),
    }
    const sug = suggestLoad({ prescription: CRUNCH, lastEntry: last, step: 10, loadUnit: "lb" })
    expect(sug?.summary).toBe("Manter 90 lb e buscar 13 reps")
  })

  it("em kg nada muda", () => {
    const last: ExerciseLog = {
      exerciseId: "legext",
      sets: [1, 2, 3].map(() => ({ weight: 70, reps: 15 })),
    }
    const sug = suggestLoad({ prescription: CRUNCH, lastEntry: last, step: 5 })
    expect(sug?.summary).toBe("Subir para 75 kg × 12")
  })
})

describe("última vez e reabertura", () => {
  it("a referência sai no número da placa", () => {
    const entry: ExerciseLog = {
      exerciseId: "machine-crunch",
      loadUnit: "lb",
      sets: [{ weight: inputToKg(80, "lb"), reps: 12 }, { weight: inputToKg(80, "lb"), reps: 10 }],
    }
    expect(formatSetsSummary(setsInUnit(entry, "lb"), "reps", "lb")).toBe("80 lb × 12·10")
    expect(formatSetsSummary(setsInUnit({ ...entry, loadUnit: undefined, sets: [{ weight: 36, reps: 12 }] }, "lb"), "reps", "lb")).toBe(
      "80 lb × 12"
    )
  })

  it("registro de hoje feito em lb reabre em lb", () => {
    const log = workout("2026-10-04", [
      { exerciseId: "machine-crunch", loadUnit: "lb", sets: [{ weight: inputToKg(90, "lb"), reps: 12 }] },
    ])
    const opened = openLogForEditing(log, PLAN_BY_ID.free)
    expect(opened.exercises[0].loadUnit).toBe("lb")
    expect(opened.rows["machine-crunch"][0].weight).toBe("90")
  })
})
