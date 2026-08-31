import { describe, expect, it } from "vitest"
import {
  DEFAULT_STEP,
  inferLoadStep,
  loggedWeights,
  resolveLoadStep,
  roundToStep,
  suggestLoad,
} from "../lib/progression"
import { ExerciseLog, ExercisePrescription, WorkoutLog } from "../lib/types"

const PULLDOWN: Pick<ExercisePrescription, "sets" | "repsMin" | "repsMax" | "unit"> = {
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  unit: "reps",
}

function entry(sets: { weight: number; reps: number; rir?: number }[]): ExerciseLog {
  return { exerciseId: "pulldown", sets }
}

function workout(date: string, sets: { weight: number; reps: number }[]): WorkoutLog {
  return { id: date, date, sessionId: "upperA", entries: [entry(sets)] }
}

describe("inferLoadStep", () => {
  it("máquina de pino: tudo múltiplo de 5 → passo de 5", () => {
    expect(inferLoadStep([40, 45, 50])).toBe(5)
  })

  it("uma carga meio-passo já revela a barra de 2,5", () => {
    expect(inferLoadStep([47.5, 50, 52.5])).toBe(2.5)
  })

  it("par de halteres de 2 em 2", () => {
    expect(inferLoadStep([12, 14, 16])).toBe(2)
  })

  it("carga única também informa: 50 kg é múltiplo de 5", () => {
    expect(inferLoadStep([50])).toBe(5)
  })

  it("sem histórico não inventa passo", () => {
    expect(inferLoadStep([])).toBeNull()
    expect(inferLoadStep([0])).toBeNull()
  })

  it("cargas quebradas caem no passo de 1 kg", () => {
    expect(inferLoadStep([23, 27])).toBe(1)
  })
})

describe("resolveLoadStep", () => {
  it("escolha manual vence o histórico", () => {
    expect(resolveLoadStep("pulldown", [40, 45], { pulldown: 10 })).toBe(10)
  })

  it("sem histórico e sem escolha → padrão", () => {
    expect(resolveLoadStep("pulldown", [])).toBe(DEFAULT_STEP)
  })
})

describe("roundToStep", () => {
  it("arredonda para o passo do aparelho", () => {
    expect(roundToStep(45.9, 5)).toBe(45)
    expect(roundToStep(46.5, 2.5)).toBe(47.5)
  })
})

describe("loggedWeights", () => {
  it("junta as cargas do exercício, da sessão mais recente para trás", () => {
    const weights = loggedWeights(
      [
        workout("2026-08-10", [{ weight: 45, reps: 10 }]),
        { id: "x", date: "2026-08-12", sessionId: "sport", entries: [] },
        workout("2026-08-14", [{ weight: 50, reps: 12 }]),
      ],
      "pulldown"
    )
    expect(weights).toEqual([50, 45])
  })
})

describe("suggestLoad", () => {
  it("topo da faixa em todas as séries → sobe UM passo do aparelho", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
      ]),
      step: 5,
    })
    expect(sug?.advice).toBe("progress")
    // a queixa original: numa máquina de 5 em 5 a sugestão não pode ser 52,5
    expect(sug?.weight).toBe(55)
    expect(sug?.sets.every((set) => set.reps === PULLDOWN.repsMin)).toBe(true)
  })

  it("o passo manda: na barra de 2,5 a mesma série sugere 52,5", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
      ]),
      step: 2.5,
    })
    expect(sug?.weight).toBe(52.5)
  })

  it("faltou fechar o topo em uma série → mantém a carga e persegue reps", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
        { weight: 50, reps: 9 },
      ]),
      step: 5,
    })
    expect(sug?.advice).toBe("hold")
    expect(sug?.delta).toBe(0)
    expect(sug?.weight).toBe(50)
  })

  it("menos séries que a prescrição não conta como topo da faixa", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([{ weight: 50, reps: 12 }]),
      step: 5,
    })
    expect(sug?.advice).toBe("hold")
  })

  it("volta de pausa reentra ~10% abaixo, arredondado ao passo", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
        { weight: 50, reps: 12 },
      ]),
      step: 5,
      returningFromLayoff: true,
    })
    expect(sug?.advice).toBe("deload")
    expect(sug?.weight).toBe(45)
  })

  it("exercício parado há duas semanas também reentra abaixo", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([{ weight: 50, reps: 8 }]),
      step: 5,
      layoffDays: 21,
    })
    expect(sug?.advice).toBe("deload")
    expect(sug?.weight).toBe(45)
    expect(sug?.detail).toContain("21 dias")
  })

  it("carga baixa não trava a reentrada em cima da mesma carga", () => {
    const sug = suggestLoad({
      prescription: PULLDOWN,
      lastEntry: entry([{ weight: 10, reps: 8 }]),
      step: 5,
      returningFromLayoff: true,
    })
    expect(sug?.weight).toBe(5)
  })

  it("top set + back-off: a sugestão respeita a carga de cada série", () => {
    const sug = suggestLoad({
      prescription: { sets: 3, repsMin: 5, repsMax: 8, unit: "reps" },
      lastEntry: entry([
        { weight: 60, reps: 8 },
        { weight: 50, reps: 8 },
        { weight: 50, reps: 8 },
      ]),
      step: 2.5,
    })
    expect(sug?.advice).toBe("progress")
    expect(sug?.weight).toBeNull()
    expect(sug?.sets.map((set) => set.weight)).toEqual([62.5, 52.5, 52.5])
  })

  it("prancha: sem carga, a progressão é em segundos", () => {
    const sug = suggestLoad({
      prescription: { sets: 3, repsMin: 45, repsMax: 60, unit: "seconds" },
      lastEntry: {
        exerciseId: "plank",
        sets: [
          { weight: 0, reps: 60 },
          { weight: 0, reps: 60 },
          { weight: 0, reps: 60 },
        ],
      },
      step: 2.5,
      returningFromLayoff: true,
    })
    expect(sug?.advice).toBe("progress")
    expect(sug?.delta).toBe(0)
    expect(sug?.sets[0].reps).toBe(65)
  })

  it("exercício estreando não tem o que sugerir", () => {
    expect(suggestLoad({ prescription: PULLDOWN, lastEntry: null, step: 5 })).toBeNull()
  })
})
