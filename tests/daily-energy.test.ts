import { describe, expect, it } from "vitest"
import { dayEnergy, weekBalance } from "../lib/daily-energy"
import { BodyLog, GymData, Meal, MealItem, MealLog, WorkoutLog } from "../lib/types"

const ARROZ: MealItem = {
  nome: "Arroz branco cozido",
  qtd: 2,
  unidade: "concha",
  gramas: 200,
  kcal: 500,
  proteinaG: 10,
  carboG: 100,
  gorduraG: 2,
}

function meal(id: string, itens: MealItem[]): Meal {
  return { id, nome: "Refeição", slot: "almoco", itens }
}

function mealDay(date: string, kcalItems: number, completo: boolean): MealLog {
  return {
    date,
    completo,
    refeicoes: Array.from({ length: kcalItems }, (_, i) => meal(`m${i}`, [ARROZ])),
  }
}

/** Basal medido na balança: 2.000 → rotina 500 (PAL_BASE 1,25). */
const BODY: BodyLog[] = [
  { date: "2026-09-01", weightKg: 95, fatMassKg: 29, bmrKcal: 2000 },
]

function data(partial: Partial<GymData> = {}): GymData {
  return { workouts: [], body: BODY, hydration: [], sleep: [], meals: [], ...partial }
}

describe("dayEnergy", () => {
  it("compoe o gasto do dia sem diluir o treino na semana", () => {
    const day = dayEnergy(data(), "2026-09-07")
    expect(day?.bmr).toBe(2000)
    expect(day?.routine).toBe(500)
    expect(day?.training).toBe(0)
    expect(day?.expenditure).toBe(2500)
  })

  it("soma o treino do proprio dia", () => {
    const workouts: WorkoutLog[] = [
      {
        id: "w1",
        date: "2026-09-07",
        sessionId: "free",
        durationMin: 60,
        srpe: 8,
        entries: [{ exerciseId: "supino", sets: [{ weight: 60, reps: 8 }] }],
      },
    ]
    const day = dayEnergy(data({ workouts }), "2026-09-07")!
    expect(day.training).toBeGreaterThan(0)
    expect(day.expenditure).toBe(2500 + day.training)
    // o dia seguinte, sem treino, volta para o basal + rotina
    expect(dayEnergy(data({ workouts }), "2026-09-08")!.expenditure).toBe(2500)
  })

  it("traz o saldo quando ha registro alimentar", () => {
    const day = dayEnergy(data({ meals: [mealDay("2026-09-07", 6, true)] }), "2026-09-07")!
    expect(day.logged).toBe(true)
    expect(day.complete).toBe(true)
    expect(day.intake).toBe(3000)
    expect(day.balance).toBe(500)
  })

  it("deixa o saldo nulo sem registro, em vez de fingir deficit", () => {
    const day = dayEnergy(data(), "2026-09-07")!
    expect(day.logged).toBe(false)
    expect(day.intake).toBeNull()
    expect(day.balance).toBeNull()
  })

  it("devolve null sem basal na base", () => {
    expect(dayEnergy({ ...data(), body: [] }, "2026-09-07")).toBeNull()
  })
})

describe("weekBalance", () => {
  /**
   * O erro que este teste existe para impedir: somar a ingestao de dois dias
   * contra o gasto de sete produziria um deficit inventado de milhares de kcal.
   */
  it("soma apenas os dias com registro", () => {
    const meals = [mealDay("2026-09-07", 6, true), mealDay("2026-09-06", 4, true)]
    const week = weekBalance(data({ meals }), "2026-09-07")!
    expect(week.days).toBe(7)
    expect(week.loggedDays).toBe(2)
    expect(week.expenditure).toBe(5000) // 2 dias × 2.500, não 7
    expect(week.intake).toBe(5000) // 3.000 + 2.000
    expect(week.balance).toBe(0)
  })

  it("marca o acumulado como parcial quando algum dia nao esta completo", () => {
    const meals = [mealDay("2026-09-07", 6, false), mealDay("2026-09-06", 4, true)]
    const week = weekBalance(data({ meals }), "2026-09-07")!
    expect(week.completeDays).toBe(1)
    expect(week.partial).toBe(true)
  })

  it("nao e parcial quando todos os dias registrados estao completos", () => {
    const week = weekBalance(data({ meals: [mealDay("2026-09-07", 6, true)] }), "2026-09-07")!
    expect(week.partial).toBe(false)
  })

  it("ignora dias fora da janela", () => {
    const meals = [mealDay("2026-09-07", 6, true), mealDay("2026-08-01", 6, true)]
    const week = weekBalance(data({ meals }), "2026-09-07")!
    expect(week.loggedDays).toBe(1)
    expect(week.from).toBe("2026-09-01")
  })

  it("devolve null sem basal", () => {
    expect(weekBalance({ ...data(), body: [] }, "2026-09-07")).toBeNull()
  })
})
