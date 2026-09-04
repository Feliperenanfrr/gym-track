import { describe, expect, it } from "vitest"
import { computeRecovery, weeklyLoadSeries } from "../lib/readiness"
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

describe("weeklyLoadSeries", () => {
  /** sessão de 800 AU (srpe 8 × 100 min) no dia `offset`. */
  function mk(offset: number): WorkoutLog {
    return {
      id: `s-${offset}`,
      date: dayKey(offset),
      sessionId: "upperA",
      entries: [],
      srpe: 8,
      durationMin: 100,
    }
  }

  it("devolve uma semana por ponto, terminando na semana corrente", () => {
    const points = weeklyLoadSeries([], TODAY, 6)
    expect(points).toHaveLength(6)
    // TODAY é quinta 20/08/2026; a segunda dessa semana é 17/08
    expect(points[5].start).toBe("2026-08-17")
    expect(points[5].current).toBe(true)
    expect(points[0].start).toBe("2026-07-13")
  })

  it("soma a carga interna das sessões da semana", () => {
    const points = weeklyLoadSeries([mk(0), mk(-1)], TODAY, 2)
    expect(points[1].load).toBe(1600)
    expect(points[1].sessions).toBe(2)
    expect(points[0].load).toBe(0)
  })

  it("semana sem treino é zero, não buraco — zero aqui é informação", () => {
    const points = weeklyLoadSeries([mk(0)], TODAY, 3)
    expect(points.map((p) => p.load)).toEqual([0, 0, 800])
  })

  it("a média de 4 semanas só começa na quarta", () => {
    const points = weeklyLoadSeries([], TODAY, 6)
    expect(points.slice(0, 3).every((p) => p.avg4 === null)).toBe(true)
    expect(points[3].avg4).toBe(0)
  })

  it("a média é das 4 semanas terminando no ponto, incluindo ele", () => {
    // 800 AU só na semana corrente; a média das 4 últimas é 200
    const points = weeklyLoadSeries([mk(0)], TODAY, 4)
    expect(points[3].load).toBe(800)
    expect(points[3].avg4).toBe(200)
  })

  it("não usa razão: nenhum ponto pode explodir por base pequena", () => {
    // uma sessão isolada depois de 5 semanas paradas — o ACWR ia a milhares
    const points = weeklyLoadSeries([mk(-40), mk(0)], TODAY, 8)
    expect(points.every((p) => Number.isFinite(p.load))).toBe(true)
    expect(Math.max(...points.map((p) => p.load))).toBe(800)
  })
})
