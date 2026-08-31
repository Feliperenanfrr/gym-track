import { describe, expect, it } from "vitest"
import { engineTodayView } from "../lib/engine-plan"
import { rolling7 } from "../lib/cycle"
import { countsTowardProgramTarget, countsTowardTrainingTarget } from "../lib/plan"
import { SessionId, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 8, 15)

function log(sessionId: SessionId, offsetDays = 0): WorkoutLog {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offsetDays)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
  return { id: `${sessionId}-${offsetDays}`, date: key, sessionId, entries: [] }
}

describe("engineTodayView", () => {
  it("sem registro hoje → próxima sessão de sala, nada concluído", () => {
    const view = engineTodayView([log("engineForceA", -2)], TODAY)
    expect(view.done).toBe(false)
    expect(view.sessionId).toBe("engineForceB")
    expect(view.pendingSessionId).toBe("engineForceB")
  })

  it("sessão de sala feita hoje → concluído, nada pendente", () => {
    const view = engineTodayView([log("engineForceA", -2), log("engineForceB")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("engineForceB")
    expect(view.pendingSessionId).toBeNull()
  })

  it("esporte conta como treino feito, mas a sala continua pendente", () => {
    const view = engineTodayView([log("engineForceA", -2), log("sport")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("sport")
    expect(view.pendingSessionId).toBe("engineForceB")
  })

  it("avulso hoje também marca o dia como treinado", () => {
    const view = engineTodayView([log("free")], TODAY)
    expect(view.done).toBe(true)
    expect(view.sessionId).toBe("free")
    expect(view.pendingSessionId).toBe("engineForceA")
  })

  it("cardio conta o dia, mas não substitui a sessão de sala", () => {
    const z2 = engineTodayView([log("engineZ2")], TODAY)
    expect(z2.done).toBe(true)
    expect(z2.pendingSessionId).toBe("engineForceA")

    const motor = engineTodayView([log("engineMotor")], TODAY)
    expect(motor.done).toBe(true)
    expect(motor.pendingSessionId).toBe("engineForceA")
  })
})

describe("meta de sessões", () => {
  it("avulso entra na meta dos dois programas", () => {
    expect(countsTowardProgramTarget("free", "hypertrophy")).toBe(true)
    expect(countsTowardProgramTarget("free", "engine")).toBe(true)
    expect(countsTowardTrainingTarget("free")).toBe(true)
  })

  it("esporte segue fora: jogo e tatame são medidos em minutos", () => {
    expect(countsTowardProgramTarget("sport", "hypertrophy")).toBe(false)
    expect(countsTowardProgramTarget("sport", "engine")).toBe(false)
  })

  it("cada programa conta as suas sessões prescritas", () => {
    expect(countsTowardProgramTarget("upperA", "hypertrophy")).toBe(true)
    expect(countsTowardProgramTarget("upperA", "engine")).toBe(false)
    expect(countsTowardProgramTarget("engineForceA", "engine")).toBe(true)
  })

  it("no motor o cardio também conta: a meta semanal é a semana inteira", () => {
    // diferente do bloco de jiu-jitsu, onde só a sala contava — aqui o
    // programa é o cardio, então Z2 e intervalado entram no contador.
    expect(countsTowardProgramTarget("engineZ2", "engine")).toBe(true)
    expect(countsTowardProgramTarget("engineMotor", "engine")).toBe(true)
    expect(countsTowardProgramTarget("engineHome", "engine")).toBe(true)
  })

  it("um avulso na semana já sai de 0/5 no painel", () => {
    expect(rolling7([log("free", -1)], TODAY, "hypertrophy").sessions).toBe(1)
  })
})
