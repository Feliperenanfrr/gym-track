import { describe, expect, it } from "vitest"
import {
  PERFORMANCE_PLAN,
  PERFORMANCE_PLAN_VERSION,
  PERF_CYCLE,
  nextPerformanceSession,
  performanceTodayView,
} from "../lib/performance-plan"
import { countsTowardProgramTarget, planForProgram, PLAN_BY_ID } from "../lib/plan"
import { weeklySessionTarget } from "../lib/consistency"
import { SessionId, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 8, 28)

function log(sessionId: SessionId, offsetDays = 0): WorkoutLog {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offsetDays)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
  return { id: `${sessionId}-${offsetDays}`, date: key, sessionId, entries: [] }
}

describe("fila da pré-temporada", () => {
  it("sem histórico começa na primeira da fila", () => {
    expect(nextPerformanceSession([], TODAY)).toBe("perfPower")
  })

  it("roda em ordem e volta ao começo", () => {
    expect(nextPerformanceSession([log("perfPower", -3)], TODAY)).toBe("perfPull")
    expect(
      nextPerformanceSession([log("perfPower", -3), log("perfPull", -2)], TODAY)
    ).toBe("perfFull")
    expect(
      nextPerformanceSession(
        [log("perfPower", -3), log("perfPull", -2), log("perfFull", -1)],
        TODAY
      )
    ).toBe("perfPower")
  })

  it("a fila ESPERA: uma semana parado não avança a posição", () => {
    // é a diferença central para o ciclo de motor, que anda com o calendário
    const parado = nextPerformanceSession([log("perfPull", -9)], TODAY)
    expect(parado).toBe("perfFull")
  })

  it("cardio e esporte não movem a fila", () => {
    const workouts = [
      log("perfPower", -5),
      log("perfZ2", -4),
      log("perfIntervals", -3),
      log("sport", -2),
      log("free", -1),
    ]
    expect(nextPerformanceSession(workouts, TODAY)).toBe("perfPull")
  })

  it("registro futuro não conta para a posição de hoje", () => {
    expect(nextPerformanceSession([log("perfPower", 3)], TODAY)).toBe("perfPower")
  })
})

describe("performanceTodayView", () => {
  it("sem registro hoje → a da vez, nada concluído", () => {
    const view = performanceTodayView([log("perfPower", -2)], TODAY)
    expect(view.done).toBe(false)
    expect(view.sessionId).toBe("perfPull")
    expect(view.pendingSessionId).toBe("perfPull")
  })

  it("sessão de sala feita hoje → concluído, nada pendente", () => {
    const view = performanceTodayView([log("perfPower", -2), log("perfPull")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("perfPull")
    expect(view.pendingSessionId).toBeNull()
  })

  it("Zona 2 conta o dia, mas a sala continua pendente", () => {
    const view = performanceTodayView([log("perfZ2")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("perfZ2")
    expect(view.pendingSessionId).toBe("perfPower")
  })

  it("esporte conta o dia sem satisfazer a fila", () => {
    const view = performanceTodayView([log("perfPower", -1), log("sport")], TODAY)
    expect(view.done).toBe(true)
    expect(view.pendingSessionId).toBe("perfPull")
  })
})

describe("prescrição da pré-temporada", () => {
  it("são cinco sessões, e só", () => {
    // o desenho depende disso: as fases trocam o CONTEÚDO, nunca a quantidade
    expect(PERFORMANCE_PLAN).toHaveLength(5)
    expect(PERF_CYCLE).toHaveLength(3)
  })

  it("toda sessão carrega a versão da fase", () => {
    for (const session of PERFORMANCE_PLAN) {
      expect(session.planVersion).toBe(PERFORMANCE_PLAN_VERSION)
    }
  })

  it("nenhuma sessão é presa a dia da semana", () => {
    // weekday 0 = sob demanda. Qualquer outro valor traria o calendário de volta
    for (const session of PERFORMANCE_PLAN) {
      expect(session.weekday).toBe(0)
    }
  })

  it("as três lacunas do histórico entraram: barra fixa, pegada e pescoço", () => {
    const ids = PERFORMANCE_PLAN.flatMap((session) =>
      session.exercises.map((exercise) => exercise.id)
    )
    expect(ids).toContain("pullup")
    expect(ids).toContain("farmer-carry")
    expect(ids).toContain("dead-hang")
    expect(ids).toContain("neck-iso")
  })

  it("o farmer walk registra carga: metros em reps, kg por mão no peso", () => {
    // o campo de peso fica desabilitado quando a unidade é "seconds", e é a
    // carga por mão que progride neste exercício
    const farmer = PERFORMANCE_PLAN.flatMap((s) => s.exercises).find(
      (exercise) => exercise.id === "farmer-carry"
    )
    expect(farmer?.unit).toBe("reps")
  })

  it("o explosivo abre a sessão que tem explosivo", () => {
    const full = PERFORMANCE_PLAN.find((session) => session.id === "perfFull")
    expect(full?.exercises[0].id).toBe("power-clean")
  })

  it("toda sessão resolve pelo PLAN_BY_ID, para o histórico saber o nome", () => {
    for (const session of PERFORMANCE_PLAN) {
      expect(PLAN_BY_ID[session.id]?.title).toBe(session.title)
    }
  })
})

describe("o programa novo convive com os antigos", () => {
  it("planForProgram devolve as cinco + avulso e esporte", () => {
    const ids = planForProgram("performance").map((session) => session.id)
    expect(ids).toEqual([
      "perfPower",
      "perfPull",
      "perfFull",
      "perfZ2",
      "perfIntervals",
      "free",
      "sport",
    ])
  })

  it("cada programa segue contando só as suas sessões", () => {
    expect(countsTowardProgramTarget("perfPower", "performance")).toBe(true)
    expect(countsTowardProgramTarget("perfPower", "engine")).toBe(false)
    expect(countsTowardProgramTarget("engineForceA", "performance")).toBe(false)
    expect(countsTowardProgramTarget("upperA", "performance")).toBe(false)
  })

  it("na pré-temporada o cardio também conta: a meta é a semana inteira", () => {
    expect(countsTowardProgramTarget("perfZ2", "performance")).toBe(true)
    expect(countsTowardProgramTarget("perfIntervals", "performance")).toBe(true)
    expect(countsTowardProgramTarget("free", "performance")).toBe(true)
  })

  it("esporte segue fora — tatame é medido em minutos", () => {
    expect(countsTowardProgramTarget("sport", "performance")).toBe(false)
  })

  it("meta semanal é 5 e não depende da data", () => {
    expect(weeklySessionTarget("performance", new Date(2026, 8, 21))).toBe(5)
    expect(weeklySessionTarget("performance", new Date(2027, 2, 1))).toBe(5)
  })
})
