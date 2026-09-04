import { describe, expect, it } from "vitest"
import { indexedBodyTrend } from "../lib/composition"
import { BodyLog } from "../lib/types"

const body: BodyLog[] = [
  { date: "2026-06-23", weightKg: 100, waistCm: 100 }, // base
  { date: "2026-06-24", weightKg: 98, waistCm: 100 }, // peso caiu, medida não
  { date: "2026-07-02", weightKg: 98, waistCm: 95 }, // cintura saiu na frente
  { date: "2026-08-06", weightKg: 99, waistCm: 99 },
]

describe("indexedBodyTrend", () => {
  it("indexa as duas séries à primeira medida", () => {
    const { points } = indexedBodyTrend(body)
    expect(points[0]).toMatchObject({ weightIndex: 100, waistIndex: 100 })
    expect(points[1]).toMatchObject({ weightIndex: 98, waistIndex: 100 })
    expect(points[2]).toMatchObject({ weightIndex: 98, waistIndex: 95 })
  })

  it("o eixo X é tempo real, não posição na fila", () => {
    // 1 dia entre a 1ª e a 2ª, 34 entre a 3ª e a 4ª: um eixo de categorias
    // desenharia os dois intervalos do mesmo tamanho
    const { points, days } = indexedBodyTrend(body)
    expect(points.map((p) => p.day)).toEqual([0, 1, 9, 44])
    expect(days).toBe(44)
  })

  it("divergência negativa = cintura saindo mais rápido que o peso", () => {
    const { points } = indexedBodyTrend(body)
    expect(points[1].divergence).toBe(2) // peso à frente
    expect(points[2].divergence).toBe(-3) // cintura à frente
  })

  it("o melhor momento ignora a base, que é zero por definição", () => {
    const { bestDivergence } = indexedBodyTrend(body)
    expect(bestDivergence?.date).toBe("2026-07-02")
    expect(bestDivergence?.divergence).toBe(-3)
  })

  it("sem nenhuma vantagem da cintura, não inventa um 'melhor momento'", () => {
    const semGanho = indexedBodyTrend([
      { date: "2026-06-01", weightKg: 100, waistCm: 100 },
      { date: "2026-06-08", weightKg: 98, waistCm: 100 },
    ])
    expect(semGanho.bestDivergence).toBeNull()
  })

  it("usa só os dias com peso E cintura", () => {
    const { points } = indexedBodyTrend([
      ...body,
      { date: "2026-08-10", weightKg: 97 }, // sem cintura
      { date: "2026-08-11", waistCm: 96 }, // sem peso
    ])
    expect(points.map((p) => p.date)).toEqual([
      "2026-06-23",
      "2026-06-24",
      "2026-07-02",
      "2026-08-06",
    ])
  })

  it("ordena por data mesmo com entrada embaralhada", () => {
    const { points } = indexedBodyTrend([...body].reverse())
    expect(points[0].date).toBe("2026-06-23")
    expect(points[0].weightIndex).toBe(100)
  })

  it("limit corta pelas medidas mais recentes e reindexa na nova base", () => {
    const { points } = indexedBodyTrend(body, { limit: 2 })
    expect(points.map((p) => p.date)).toEqual(["2026-07-02", "2026-08-06"])
    // a base passa a ser 02/07: 98 kg e 95 cm viram 100
    expect(points[0]).toMatchObject({ weightIndex: 100, waistIndex: 100, day: 0 })
  })

  it("sem par completo devolve série vazia em vez de inventar a medida que falta", () => {
    const vazio = indexedBodyTrend([
      { date: "2026-06-01", weightKg: 90 },
      { date: "2026-06-02", waistCm: 100 },
    ])
    expect(vazio.points).toHaveLength(0)
    expect(vazio.latest).toBeNull()
    expect(vazio.days).toBe(0)
  })

  it("uma medida só devolve a base sem 'melhor momento'", () => {
    const uma = indexedBodyTrend([{ date: "2026-06-01", weightKg: 90, waistCm: 100 }])
    expect(uma.points).toHaveLength(1)
    expect(uma.latest?.divergence).toBe(0)
    expect(uma.bestDivergence).toBeNull()
  })
})
