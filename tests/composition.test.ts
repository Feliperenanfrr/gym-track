import { describe, expect, it } from "vitest"
import { waistWeightTrail } from "../lib/composition"
import { BodyLog } from "../lib/types"

const body: BodyLog[] = [
  { date: "2026-06-23", weightKg: 95.5, waistCm: 102 },
  { date: "2026-06-24", weightKg: 93.8 }, // sem cintura
  { date: "2026-07-02", weightKg: 92.9, waistCm: 97 },
  { date: "2026-07-10", waistCm: 99 }, // sem peso
  { date: "2026-08-05", weightKg: 95.4, waistCm: 103 },
]

describe("waistWeightTrail", () => {
  it("usa só os dias com peso E cintura", () => {
    const trail = waistWeightTrail(body)
    expect(trail.map((p) => p.date)).toEqual([
      "2026-06-23",
      "2026-07-02",
      "2026-08-05",
    ])
  })

  it("devolve em ordem cronológica mesmo com entrada embaralhada", () => {
    const trail = waistWeightTrail([...body].reverse())
    expect(trail.map((p) => p.date)).toEqual([
      "2026-06-23",
      "2026-07-02",
      "2026-08-05",
    ])
  })

  it("mantém peso e cintura do mesmo dia no mesmo ponto", () => {
    const [first] = waistWeightTrail(body)
    expect(first).toMatchObject({ weightKg: 95.5, waistCm: 102, label: "23/06" })
  })

  it("limit corta pelas medidas MAIS RECENTES", () => {
    const trail = waistWeightTrail(body, { limit: 2 })
    expect(trail.map((p) => p.date)).toEqual(["2026-07-02", "2026-08-05"])
  })

  it("sem par completo devolve lista vazia em vez de inventar a medida que falta", () => {
    expect(
      waistWeightTrail([
        { date: "2026-06-01", weightKg: 90 },
        { date: "2026-06-02", waistCm: 100 },
      ])
    ).toHaveLength(0)
  })

  it("ignora zero como se fosse ausência", () => {
    expect(
      waistWeightTrail([{ date: "2026-06-01", weightKg: 0, waistCm: 100 }])
    ).toHaveLength(0)
  })
})
