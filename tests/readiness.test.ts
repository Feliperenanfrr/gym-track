import { describe, expect, it } from "vitest"
import { computeRecovery } from "../lib/readiness"
import { GymData, HydrationLog, SleepLog, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 7, 20)

function dayKey(offset: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

/** N noites recentes com a mesma duração. */
function nights(count: number, durationMin: number): SleepLog[] {
  return Array.from({ length: count }, (_, i) => ({
    date: dayKey(-i),
    sleptAt: "23:30",
    wokeAt: "07:00",
    durationMin,
  }))
}

/** N dias recentes com o mesmo volume de água. */
function water(count: number, ml: number): HydrationLog[] {
  return Array.from({ length: count }, (_, i) => ({ date: dayKey(-i), ml }))
}

function data(partial: Partial<GymData> = {}): GymData {
  return { workouts: [], body: [], hydration: [], sleep: [], ...partial }
}

const GOAL_ML = 3300 // waterGoalMl sem pesagem registrada

describe("computeRecovery", () => {
  it("sem dado nenhum fica em 'building' e não aponta limitador", () => {
    const r = computeRecovery(data(), TODAY)
    expect(r.level).toBe("building")
    expect(r.limiter).toBeNull()
    expect(r.drivers.map((d) => d.id)).toEqual(["load", "sleep", "water"])
    expect(r.drivers.every((d) => d.level === "building")).toBe(true)
  })

  it("sono e água dentro da faixa devolvem verde", () => {
    const r = computeRecovery(
      data({ sleep: nights(7, 7 * 60 + 30), hydration: water(7, GOAL_ML) }),
      TODAY
    )
    expect(r.level).toBe("green")
  })

  it("sono curto vira o limitador e derruba o nível", () => {
    const r = computeRecovery(
      data({ sleep: nights(7, 5 * 60), hydration: water(7, GOAL_ML) }),
      TODAY
    )
    expect(r.level).toBe("red")
    expect(r.limiter?.id).toBe("sleep")
  })

  it("hidratação abaixo da meta vira o limitador quando o sono está bom", () => {
    const r = computeRecovery(
      data({ sleep: nights(7, 8 * 60), hydration: water(7, 1500) }),
      TODAY
    )
    expect(r.level).toBe("red")
    expect(r.limiter?.id).toBe("water")
  })

  it("nível é o PIOR dos componentes com dado", () => {
    const r = computeRecovery(
      data({
        sleep: nights(7, 6 * 60 + 30), // amarelo
        hydration: water(7, 1000), // vermelho
      }),
      TODAY
    )
    expect(r.level).toBe("red")
    expect(r.limiter?.id).toBe("water")
  })

  it("componente sem registro suficiente não contamina o resultado", () => {
    // 2 noites não bastam para virar sinal; água boa deve mandar sozinha
    const r = computeRecovery(
      data({ sleep: nights(2, 4 * 60), hydration: water(7, GOAL_ML) }),
      TODAY
    )
    expect(r.drivers.find((d) => d.id === "sleep")?.level).toBe("building")
    expect(r.level).toBe("green")
  })

  it("preserva o sinal de carga inteiro para quem já o usava", () => {
    const workouts: WorkoutLog[] = [
      { id: "a", date: dayKey(-1), sessionId: "upperA", entries: [], srpe: 8, durationMin: 60 },
    ]
    const r = computeRecovery(data({ workouts }), TODAY)
    expect(r.load).toMatchObject({ acute: 480 })
    expect(r.drivers[0].id).toBe("load")
  })

  it("dia de água registrado como zero não conta como desidratação", () => {
    const hydration = [...water(4, GOAL_ML), { date: dayKey(-5), ml: 0 }]
    const r = computeRecovery(data({ hydration }), TODAY)
    expect(r.drivers.find((d) => d.id === "water")?.level).toBe("green")
  })
})
