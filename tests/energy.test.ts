import { describe, expect, it } from "vitest"
import {
  bmrFrom,
  energyBalanceSeries,
  energyBudget,
  energyReport,
  katchMcArdleBmr,
  massTrend,
  slopePerDay,
  trainingKcalByDay,
} from "../lib/energy"
import { BodyLog, GymData, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 7, 20)

function dayKey(offsetDays: number, base = TODAY): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

function workout(opts: Partial<WorkoutLog> & { date: string }): WorkoutLog {
  return {
    id: `w-${opts.date}-${opts.sessionId ?? "cardioZ2"}`,
    sessionId: "cardioZ2",
    entries: [],
    ...opts,
  }
}

/** Sessão de 60′ de bike em Zona 2 — MET 6,5, sem velocidade para refinar. */
const bike60 = (date: string) =>
  workout({ date, cardios: [{ minutes: 60, mode: "Bike", purpose: "zone2" }] })

const emptyData: GymData = { workouts: [], body: [], hydration: [], sleep: [] }

/**
 * Quatro pesagens semanais em queda linear, com composição:
 * peso −0,25 kg/sem · gordura −0,15 kg/sem · magra −0,10 kg/sem.
 */
const decliningBody: BodyLog[] = [
  { date: dayKey(-21), weightKg: 90, fatMassKg: 27, bmrKcal: 1800 },
  { date: dayKey(-14), weightKg: 89.75, fatMassKg: 26.85, bmrKcal: 1800 },
  { date: dayKey(-7), weightKg: 89.5, fatMassKg: 26.7, bmrKcal: 1800 },
  { date: dayKey(0), weightKg: 89.25, fatMassKg: 26.55, bmrKcal: 1800 },
]

/* ---------------------------------------------------------------- */
/* Regressão                                                          */
/* ---------------------------------------------------------------- */

describe("slopePerDay", () => {
  it("recupera a inclinação de uma série perfeitamente linear", () => {
    const samples = [0, 7, 14, 21].map((t) => ({ t, v: 90 - t * 0.05 }))
    expect(slopePerDay(samples)).toBeCloseTo(-0.05, 10)
  })

  it("um ponto só, ou todos no mesmo dia, não define tendência", () => {
    expect(slopePerDay([{ t: 0, v: 90 }])).toBeNull()
    expect(slopePerDay([{ t: 3, v: 90 }, { t: 3, v: 91 }])).toBeNull()
  })

  it("resiste a uma pesagem fora da curva (não inverte o sinal)", () => {
    // sal do fim de semana: +1,2 kg num único dia sobre uma queda real
    const noisy = [
      { t: 0, v: 90 },
      { t: 7, v: 89.6 },
      { t: 14, v: 90.4 },
      { t: 21, v: 88.8 },
    ]
    expect(slopePerDay(noisy)!).toBeLessThan(0)
  })
})

/* ---------------------------------------------------------------- */
/* Tendência de massa                                                 */
/* ---------------------------------------------------------------- */

describe("massTrend", () => {
  it("separa gordura de magra e usa a densidade de cada tecido", () => {
    const trend = massTrend(decliningBody, dayKey(-27), dayKey(0))
    expect(trend.basis).toBe("composition")
    expect(trend.weightKgPerWeek).toBeCloseTo(-0.25, 6)
    expect(trend.fatKgPerWeek).toBeCloseTo(-0.15, 6)
    expect(trend.leanKgPerWeek).toBeCloseTo(-0.1, 6)
    // (−0,15/7)×9440 + (−0,10/7)×1816 por dia
    expect(trend.storedKcalPerDay).toBe(-228)
    expect(trend.points).toBe(4)
    expect(trend.spanDays).toBe(21)
    expect(trend.avgWeightKg).toBeCloseTo(89.625, 6)
  })

  it("sem bioimpedância cai para 7.700 kcal/kg de peso", () => {
    const onlyWeight = decliningBody.map(({ date, weightKg }) => ({ date, weightKg }))
    const trend = massTrend(onlyWeight, dayKey(-27), dayKey(0))
    expect(trend.basis).toBe("weight")
    expect(trend.fatKgPerWeek).toBeNull()
    // a mesma perda vale 40% mais energia sem saber que parte dela foi magra
    expect(trend.storedKcalPerDay).toBe(Math.round((-0.25 / 7) * 7700))
  })

  it("janela curta demais não vira tendência", () => {
    const trend = massTrend(
      [
        { date: dayKey(-3), weightKg: 90 },
        { date: dayKey(0), weightKg: 89 },
      ],
      dayKey(-27),
      dayKey(0)
    )
    expect(trend.storedKcalPerDay).toBeNull()
    expect(trend.spanDays).toBe(3)
    // o peso médio continua disponível para as metas
    expect(trend.avgWeightKg).toBeCloseTo(89.5, 6)
  })

  it("uma pesagem só não tem tendência", () => {
    expect(massTrend([{ date: dayKey(0), weightKg: 90 }], dayKey(-27), dayKey(0)))
      .toMatchObject({ storedKcalPerDay: null, basis: null, points: 1 })
  })

  it("deriva a massa de gordura do percentual quando falta o kg", () => {
    const byPct: BodyLog[] = [
      { date: dayKey(-14), weightKg: 90, bodyFatPct: 30 },
      { date: dayKey(0), weightKg: 89, bodyFatPct: 29 },
    ]
    const trend = massTrend(byPct, dayKey(-27), dayKey(0))
    expect(trend.basis).toBe("composition")
    // 27 → 25,81 kg de gordura em 14 dias
    expect(trend.fatKgPerWeek).toBeCloseTo((25.81 - 27) / 2, 6)
  })
})

/* ---------------------------------------------------------------- */
/* Basal e orçamento                                                  */
/* ---------------------------------------------------------------- */

describe("bmrFrom", () => {
  it("prefere o basal medido na balança", () => {
    expect(bmrFrom(decliningBody, dayKey(0))).toEqual({ bmr: 1800, source: "scale" })
  })

  it("sem basal medido, calcula por Katch-McArdle sobre a massa magra", () => {
    const noBmr = decliningBody.map(({ date, weightKg, fatMassKg }) => ({
      date,
      weightKg,
      fatMassKg,
    }))
    expect(bmrFrom(noBmr, dayKey(0))).toEqual({
      bmr: Math.round(katchMcArdleBmr(89.25 - 26.55)),
      source: "katch",
    })
  })

  it("sem composição nem basal, não inventa metabolismo", () => {
    expect(bmrFrom([{ date: dayKey(0), weightKg: 90 }], dayKey(0))).toBeNull()
    expect(bmrFrom([], dayKey(0))).toBeNull()
  })

  it("ignora registros posteriores à data pedida", () => {
    const body: BodyLog[] = [
      { date: dayKey(-10), weightKg: 90, bmrKcal: 1700 },
      { date: dayKey(+5), weightKg: 88, bmrKcal: 1650 },
    ]
    expect(bmrFrom(body, dayKey(0))?.bmr).toBe(1700)
  })
})

describe("energyBudget", () => {
  it("dilui as calorias de treino nos dias do período", () => {
    const data: GymData = { ...emptyData, body: decliningBody, workouts: [bike60(dayKey(-10))] }
    const budget = energyBudget(data, dayKey(-27), dayKey(0))!
    expect(budget.bmr).toBe(1800)
    expect(budget.routine).toBe(450) // 25% do basal: rotina + digestão
    expect(budget.training).toBe(22) // 610 kcal espalhadas em 28 dias
    expect(budget.tdee).toBe(2272)
  })

  it("sem basal não há orçamento", () => {
    const data: GymData = {
      ...emptyData,
      body: [{ date: dayKey(-10), weightKg: 90 }],
      workouts: [bike60(dayKey(-10))],
    }
    expect(energyBudget(data, dayKey(-27), dayKey(0))).toBeNull()
  })
})

describe("trainingKcalByDay", () => {
  it("soma as sessões do mesmo dia e respeita a janela", () => {
    const data: GymData = {
      ...emptyData,
      body: decliningBody,
      workouts: [bike60(dayKey(-10)), bike60(dayKey(-10)), bike60(dayKey(-40))],
    }
    const byDay = trainingKcalByDay(data, dayKey(-27), dayKey(0))
    expect(byDay.get(dayKey(-10))).toBe(1220)
    expect(byDay.has(dayKey(-40))).toBe(false)
  })
})

/* ---------------------------------------------------------------- */
/* Relatório                                                          */
/* ---------------------------------------------------------------- */

describe("energyReport", () => {
  const data: GymData = {
    ...emptyData,
    body: decliningBody,
    workouts: [bike60(dayKey(-10))],
  }

  it("fecha a conta: ingestão = gasto + o que o corpo guardou", () => {
    const report = energyReport(data, TODAY)
    expect(report.budget!.tdee).toBe(2272)
    expect(report.trend.storedKcalPerDay).toBe(-228)
    expect(report.intake).toBe(2044)
    // a faixa vem da incerteza da rotina (PAL 1,15–1,4), não do chute
    expect(report.intakeLow).toBeLessThan(report.intake!)
    expect(report.intakeHigh).toBeGreaterThan(report.intake!)
  })

  it("alvos saem do gasto e do peso, em %/semana", () => {
    const { targets } = energyReport(data, TODAY)
    expect(targets).toEqual({ maintain: 2270, cut: 1780, bulk: 2520 })
  })

  it("acusa treino irrelevante no gasto e baixa frequência", () => {
    const report = energyReport(data, TODAY)
    const byId = Object.fromEntries(report.signals.map((s) => [s.id, s]))
    expect(byId["training-share"].tone).toBe("warn")
    expect(byId["frequency"].value).toBe("0,3/sem")
    expect(byId["frequency"].tone).toBe("warn")
    expect(report.weeklyRatePct).toBeCloseTo(-0.2789, 3)
  })

  it("lê recomposição pela composição, não pelo número da balança", () => {
    const recomposing: BodyLog[] = [
      { date: dayKey(-21), weightKg: 89, fatMassKg: 27, bmrKcal: 1800 },
      { date: dayKey(-14), weightKg: 89.2, fatMassKg: 26.7, bmrKcal: 1800 },
      { date: dayKey(-7), weightKg: 89.4, fatMassKg: 26.4, bmrKcal: 1800 },
      { date: dayKey(0), weightKg: 89.6, fatMassKg: 26.1, bmrKcal: 1800 },
    ]
    const report = energyReport({ ...data, body: recomposing }, TODAY)
    // peso subindo, mas gordura caindo e magra subindo
    expect(report.trend.weightKgPerWeek).toBeGreaterThan(0)
    expect(report.verdict).toMatch(/Recomposição/)
  })

  it("gordura subindo com magra parada é excesso de comida, não de treino", () => {
    const gaining: BodyLog[] = [
      { date: dayKey(-21), weightKg: 89, fatMassKg: 26, bmrKcal: 1800 },
      { date: dayKey(-14), weightKg: 89.3, fatMassKg: 26.3, bmrKcal: 1800 },
      { date: dayKey(-7), weightKg: 89.6, fatMassKg: 26.6, bmrKcal: 1800 },
      { date: dayKey(0), weightKg: 89.9, fatMassKg: 26.9, bmrKcal: 1800 },
    ]
    const report = energyReport({ ...data, body: gaining }, TODAY)
    expect(report.verdict).toMatch(/gordura está subindo/)
    expect(report.intake).toBeGreaterThan(report.budget!.tdee)
    expect(report.advice).toMatch(/a menos do que você vem comendo/)
  })

  it("sem bioimpedância devolve orçamento nulo e nenhum número inventado", () => {
    const report = energyReport(
      { ...emptyData, body: [{ date: dayKey(-10), weightKg: 90 }] },
      TODAY
    )
    expect(report.budget).toBeNull()
    expect(report.intake).toBeNull()
    expect(report.targets).toBeNull()
  })
})

/* ---------------------------------------------------------------- */
/* Série semanal                                                      */
/* ---------------------------------------------------------------- */

describe("energyBalanceSeries", () => {
  it("devolve uma barra por semana, a última em curso", () => {
    const series = energyBalanceSeries(
      { ...emptyData, body: decliningBody, workouts: [bike60(dayKey(-3))] },
      TODAY,
      6
    )
    expect(series.points).toHaveLength(6)
    expect(series.points[5].current).toBe(true)
    expect(series.points[5].label).toBe("20/08")
    expect(series.points[5].sessions).toBe(1)
    expect(series.points[5].training).toBe(Math.round(610 / 7))
    expect(series.trendWindowDays).toBe(21)
  })

  it("semana sem pesagens suficientes fica sem barra, em vez de virar zero", () => {
    const series = energyBalanceSeries(
      { ...emptyData, body: decliningBody, workouts: [] },
      TODAY,
      8
    )
    // as pesagens começam há 21 dias: as semanas mais antigas não têm janela
    expect(series.points[0].balance).toBeNull()
    expect(series.points[7].balance).not.toBeNull()
    expect(series.measured).toBeGreaterThan(0)
    expect(series.measured).toBeLessThan(8)
  })

  it("média de treino do período vira a régua do gráfico", () => {
    const series = energyBalanceSeries(
      {
        ...emptyData,
        body: decliningBody,
        workouts: [bike60(dayKey(-3)), bike60(dayKey(-10))],
      },
      TODAY,
      4
    )
    // 1.220 kcal em 28 dias de janela
    expect(series.avgTraining).toBe(Math.round(1220 / 28))
  })
})
