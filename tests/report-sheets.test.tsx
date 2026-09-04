import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BlockReportSheet } from "@/components/report/block-report"
import { CoachReportSheet } from "@/components/report/coach-report"
import { ComebackReportSheet } from "@/components/report/comeback-report"
import { ComparisonReportSheet } from "@/components/report/comparison-report"
import { HealthReportSheet } from "@/components/report/health-report"
import { NutritionReportSheet } from "@/components/report/nutrition-report"
import {
  blockReport,
  coachReport,
  comebackReport,
  comparisonReport,
  healthReport,
  nutritionReport,
  previousPeriod,
  type ReportPeriod,
} from "@/lib/reports"
import type { BodyLog, GymData, WorkoutLog } from "@/lib/types"

/**
 * As folhas renderizam de verdade, com dado cheio e com dado vazio.
 *
 * Documento que sai para outra pessoa não pode imprimir "NaN", "undefined" ou
 * "Infinity" — e todos os três aparecem sozinhos assim que uma divisão
 * encontra um período sem pesagem, sem série ou sem sessão. É barato garantir
 * aqui o que custaria caro descobrir no PDF do nutricionista.
 */

const TODAY = new Date(2026, 9, 15)

function dayKey(offsetDays: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

const period: ReportPeriod = {
  id: "test",
  label: "Bloco de teste",
  from: dayKey(-41),
  to: dayKey(0),
}

const empty: GymData = { workouts: [], body: [], hydration: [], sleep: [] }

function full(): GymData {
  const workouts: WorkoutLog[] = []
  for (let day = 41; day >= 0; day -= 3) {
    workouts.push({
      id: `w-${day}`,
      date: dayKey(-day),
      sessionId: day % 6 === 0 ? "lowerA" : "upperA",
      durationMin: 55,
      srpe: 7,
      entries: [
        {
          exerciseId: "bench",
          sets: [{ weight: 60 + (41 - day) * 0.5, reps: 8, rir: 2 }],
        },
        { exerciseId: "squat", sets: [{ weight: 90, reps: 5, rir: 1 }] },
      ],
      cardios: day % 9 === 0 ? [{ minutes: 40, mode: "Bike", purpose: "zone2" }] : undefined,
    })
  }
  const body: BodyLog[] = [-41, -28, -14, 0].map((offset, index) => ({
    date: dayKey(offset),
    weightKg: 92 - index * 0.7,
    waistCm: 99 - index * 0.5,
    fatMassKg: 27 - index * 0.7,
    bodyFatPct: 29.3 - index * 0.5,
    skeletalMuscleKg: 33 + index * 0.1,
    visceralFat: 12 - index * 0.2,
    waterPct: 52,
    bmrKcal: 1800,
    bmi: 28.4 - index * 0.2,
  }))
  return {
    workouts,
    body,
    hydration: [
      { date: dayKey(-2), ml: 3000 },
      { date: dayKey(-1), ml: 3400 },
    ],
    sleep: [
      { date: dayKey(-2), sleptAt: "23:30", wokeAt: "07:00", durationMin: 450 },
      { date: dayKey(-1), sleptAt: "00:10", wokeAt: "06:20", durationMin: 370 },
    ],
  }
}

function sheets(data: GymData) {
  const program = "hypertrophy" as const
  return {
    bloco: <BlockReportSheet report={blockReport(data, period, program)} />,
    preparador: <CoachReportSheet report={coachReport(data, period, program)} />,
    nutricao: <NutritionReportSheet report={nutritionReport(data, period, program)} />,
    saude: <HealthReportSheet report={healthReport(data, period, program)} />,
    comparativo: (
      <ComparisonReportSheet
        report={comparisonReport(data, period, previousPeriod(period), program)}
      />
    ),
    retomada: <ComebackReportSheet report={comebackReport(data, TODAY)} />,
  }
}

describe("folhas de relatório", () => {
  for (const [name, element] of Object.entries(sheets(full()))) {
    it(`${name} renderiza com dado cheio, sem número quebrado`, () => {
      const html = renderToStaticMarkup(element)
      expect(html).toContain("GYM//TRACK")
      expect(html).not.toContain("NaN")
      expect(html).not.toContain("undefined")
      expect(html).not.toContain("Infinity")
      expect(html.length).toBeGreaterThan(2000)
    })
  }

  for (const [name, element] of Object.entries(sheets(empty))) {
    it(`${name} renderiza um período vazio sem inventar número`, () => {
      const html = renderToStaticMarkup(element)
      expect(html).not.toContain("NaN")
      expect(html).not.toContain("undefined")
      expect(html).not.toContain("Infinity")
    })
  }

  it("o fechamento traz a constância antes do volume", () => {
    const html = renderToStaticMarkup(sheets(full()).bloco)
    expect(html.indexOf("Constância")).toBeGreaterThan(-1)
    expect(html.indexOf("Constância")).toBeLessThan(html.indexOf("Semana a semana"))
    expect(html).toContain("carga do top set")
  })

  it("o resumo de saúde nomeia a faixa de referência e a fonte", () => {
    const html = renderToStaticMarkup(sheets(full()).saude)
    expect(html).toContain("OMS")
    expect(html).toContain("Não é")
    expect(html).toContain("Circunferência de cintura")
  })
})
