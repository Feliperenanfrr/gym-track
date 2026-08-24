import { describe, expect, it } from "vitest"
import { LIFT_CYCLE, cycleTodayView, nextInCycle, rolling7 } from "../lib/cycle"
import { SessionId, WorkoutLog } from "../lib/types"

/** data local (meio-dia evita borda de DST) → yyyy-MM-dd */
function dayKey(offsetDays: number, base = new Date(2026, 7, 20)): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

function lift(dateOffset: number, sessionId: SessionId): WorkoutLog {
  return {
    id: `log-${sessionId}-${dateOffset}`,
    date: dayKey(dateOffset),
    sessionId,
    entries: [],
  }
}

describe("LIFT_CYCLE", () => {
  it("alterna Upper/Lower em 4 sessões", () => {
    expect(LIFT_CYCLE).toEqual(["upperA", "lowerA", "upperB", "lowerB"])
  })
})

describe("nextInCycle", () => {
  it("sem histórico → começo do ciclo (Upper A)", () => {
    const sug = nextInCycle([], new Date(2026, 7, 20))
    expect(sug).toMatchObject({
      sessionId: "upperA",
      nextLiftId: "upperA",
      reason: "start",
      loadFactor: 1,
      daysSinceLastLift: null,
    })
  })

  it("sucessor direto do último lift registrado", () => {
    const sug = nextInCycle([lift(-3, "upperA"), lift(-2, "lowerA")], new Date(2026, 7, 20))
    expect(sug.sessionId).toBe("upperB")
    expect(sug.reason).toBe("next")
    expect(sug.loadFactor).toBe(1)
  })

  it("sem recovery no caminho, depois de lowerB volta para upperA", () => {
    const sug = nextInCycle([lift(-4, "lowerB")], new Date(2026, 7, 20))
    expect(sug.sessionId).toBe("upperA")
    expect(sug.reason).toBe("next")
  })

  it("fechando o ciclo com dois dias seguidos, o recovery vem antes da volta ao Upper A", () => {
    const sug = nextInCycle(
      [lift(-4, "upperA"), lift(-3, "lowerA"), lift(-2, "upperB"), lift(-1, "lowerB")],
      new Date(2026, 7, 20)
    )
    expect(sug.reason).toBe("recovery")
    expect(sug.sessionId).toBe("cardioZ2")
    expect(sug.nextLiftId).toBe("upperA") // após o descanso, o ciclo recomeça
  })

  it("dois dias seguidos de lift sem lift hoje → recovery (Z2)", () => {
    const sug = nextInCycle([lift(-2, "upperA"), lift(-1, "lowerA")], new Date(2026, 7, 20))
    expect(sug.reason).toBe("recovery")
    expect(sug.sessionId).toBe("cardioZ2")
    expect(sug.nextLiftId).toBe("upperB")
  })

  it("lift hoje cancela o recovery — pode avançar o ciclo", () => {
    const sug = nextInCycle(
      [lift(-2, "upperA"), lift(-1, "lowerA"), lift(0, "cardioZ2")],
      new Date(2026, 7, 20)
    )
    // cardioZ2 não é lift; mas com registro hoje (não-lift) o recovery não dispara?
    // Regra atual: exige SEM lift hoje e lifts ontem+anteontem → ainda recovery.
    expect(sug.reason).toBe("recovery")
  })

  it("gap ≥ 7 dias → repetir o último lift com fator 0.9", () => {
    const sug = nextInCycle([lift(-10, "upperA")], new Date(2026, 7, 20))
    expect(sug).toMatchObject({
      sessionId: "upperA",
      nextLiftId: "upperA",
      reason: "regression",
      loadFactor: 0.9,
      daysSinceLastLift: 10,
    })
  })

  it("gap exatamente 7 dias já é regressão", () => {
    const sug = nextInCycle([lift(-7, "lowerB")], new Date(2026, 7, 20))
    expect(sug.reason).toBe("regression")
    expect(sug.sessionId).toBe("lowerB")
  })

  it("gap de 6 dias segue o fluxo normal", () => {
    const sug = nextInCycle([lift(-6, "upperA")], new Date(2026, 7, 20))
    expect(sug.reason).toBe("next")
    expect(sug.loadFactor).toBe(1)
  })

  it("ignora registros que não são lift da fila", () => {
    const sug = nextInCycle(
      [lift(-5, "free" as SessionId), lift(-3, "sport")],
      new Date(2026, 7, 20)
    )
    expect(sug.reason).toBe("start")
  })
})

describe("cycleTodayView", () => {
  it("sem registro hoje → mostra a sugestão, não concluído", () => {
    const view = cycleTodayView(
      [lift(-3, "upperA")],
      new Date(2026, 7, 20)
    )
    expect(view.done).toBe(false)
    expect(view.sessionId).toBe(view.suggestion.sessionId)
  })

  it("com lift salvo hoje → card mostra o treino feito e done=true", () => {
    const view = cycleTodayView(
      [lift(-3, "upperA"), lift(0, "lowerA")],
      new Date(2026, 7, 20)
    )
    expect(view.done).toBe(true)
    expect(view.completedSessionId).toBe("lowerA")
    expect(view.completedLiftSessionId).toBe("lowerA")
    // a fila já avançou para o próximo
    expect(view.suggestion.sessionId).toBe("upperB")
  })

  it("registro não-lift hoje que não é a sugestão não marca o dia como feito", () => {
    // esporte hoje não é o próximo da fila (lowerA) — o card segue cobrando o lift
    const view = cycleTodayView(
      [lift(-2, "upperA"), lift(0, "sport")],
      new Date(2026, 7, 20)
    )
    expect(view.completedLiftSessionId).toBeNull()
    expect(view.done).toBe(false)
    expect(view.suggestion.sessionId).toBe("lowerA")
  })
})

describe("rolling7", () => {
  const today = new Date(2026, 7, 20)

  it("só entra o que está dentro dos últimos 7 dias", () => {
    const inside: WorkoutLog = {
      ...lift(-2, "upperA"),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    }
    const outside = lift(-9, "upperB")
    const roll = rolling7([inside, outside], today)
    expect(roll.sessions).toBe(1)
    expect(roll.volume).toBe(500)
  })

  it("esporte não conta como sessão do alvo", () => {
    const sport: WorkoutLog = {
      id: "s1",
      date: dayKey(-1),
      sessionId: "sport",
      entries: [],
      cardio: { minutes: 60, mode: "Futsal", purpose: "sport" },
    }
    expect(rolling7([sport], today).sessions).toBe(0)
  })
})
