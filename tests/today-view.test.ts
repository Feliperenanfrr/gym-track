import { describe, expect, it } from "vitest"
import { bjjTodayView } from "../lib/bjj-plan"
import { rolling7 } from "../lib/cycle"
import { countsTowardProgramTarget, countsTowardTrainingTarget } from "../lib/plan"
import { SessionId, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 7, 29)

function log(sessionId: SessionId, offsetDays = 0): WorkoutLog {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offsetDays)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
  return { id: `${sessionId}-${offsetDays}`, date: key, sessionId, entries: [] }
}

describe("bjjTodayView", () => {
  it("sem registro hoje → próxima sessão de sala, nada concluído", () => {
    const view = bjjTodayView([log("bjjPull", -2)], TODAY)
    expect(view.done).toBe(false)
    expect(view.sessionId).toBe("bjjBase")
    expect(view.pendingSessionId).toBe("bjjBase")
  })

  it("sessão de sala feita hoje → concluído, nada pendente", () => {
    const view = bjjTodayView([log("bjjPull", -2), log("bjjBase")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("bjjBase")
    expect(view.pendingSessionId).toBeNull()
  })

  it("tatame conta como treino feito, mas a sala continua pendente", () => {
    const view = bjjTodayView([log("bjjPull", -2), log("sport")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("sport")
    expect(view.pendingSessionId).toBe("bjjBase")
  })

  it("avulso hoje também marca o dia como treinado", () => {
    const view = bjjTodayView([log("free")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("free")
    expect(view.pendingSessionId).toBe("bjjPull")
  })

  it("só Zona 2 não substitui a sessão de sala do dia", () => {
    const view = bjjTodayView([log("bjjZ2")], TODAY)
    expect(view.done).toBe(true)
    expect(view.pendingSessionId).toBe("bjjPull")
  })
})

describe("meta de sessões", () => {
  it("avulso entra na meta dos dois programas", () => {
    expect(countsTowardProgramTarget("free", "hypertrophy")).toBe(true)
    expect(countsTowardProgramTarget("free", "bjj")).toBe(true)
    expect(countsTowardTrainingTarget("free")).toBe(true)
  })

  it("esporte segue fora: tatame e jogo são medidos em minutos", () => {
    expect(countsTowardProgramTarget("sport", "hypertrophy")).toBe(false)
    expect(countsTowardProgramTarget("sport", "bjj")).toBe(false)
  })

  it("cada programa conta as suas sessões prescritas", () => {
    expect(countsTowardProgramTarget("upperA", "hypertrophy")).toBe(true)
    expect(countsTowardProgramTarget("upperA", "bjj")).toBe(false)
    expect(countsTowardProgramTarget("bjjPull", "bjj")).toBe(true)
    expect(countsTowardProgramTarget("bjjZ2", "bjj")).toBe(false)
  })

  it("um avulso na semana já sai de 0/5 no painel", () => {
    expect(rolling7([log("free", -1)], TODAY, "hypertrophy").sessions).toBe(1)
  })
})
