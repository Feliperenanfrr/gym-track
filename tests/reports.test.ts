import { describe, expect, it } from "vitest"
import {
  blockReport,
  bodyProgress,
  coachReport,
  compareWindows,
  daysInPeriod,
  liftProgress,
  massSeries,
  nutritionReport,
  reportPeriods,
  reportWeeks,
  type ReportPeriod,
} from "../lib/reports"
import { BodyLog, GymData, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 9, 15) // 15/10/2026 — dentro do Bloco 2 do ciclo de motor

function dayKey(offsetDays: number, base = TODAY): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

function lift(
  date: string,
  exerciseId: string,
  weight: number,
  reps = 8,
  extra: Partial<WorkoutLog> = {}
): WorkoutLog {
  return {
    id: `w-${date}-${exerciseId}`,
    date,
    sessionId: "upperA",
    durationMin: 60,
    entries: [{ exerciseId, sets: [{ weight, reps }] }],
    ...extra,
  }
}

const emptyData: GymData = { workouts: [], body: [], hydration: [], sleep: [] }

/* ---------------------------------------------------------------- */
/* Período                                                            */
/* ---------------------------------------------------------------- */

describe("reportPeriods", () => {
  it("oferece os blocos do ciclo de motor já iniciados e as janelas móveis", () => {
    const periods = reportPeriods(TODAY)
    const ids = periods.map((p) => p.id)
    expect(ids).toContain("engine-fundacao")
    expect(ids).toContain("last-4w")
    expect(ids).toContain("last-12w")
    // o bloco 1 começa em 31/08/2026 e dura 4 semanas
    const fundacao = periods.find((p) => p.id === "engine-fundacao")!
    expect(fundacao.from).toBe("2026-08-31")
    expect(fundacao.to).toBe("2026-09-27")
    // o bloco 3 só começa em 26/10 — ainda não deve aparecer em 15/10
    expect(ids).not.toContain("engine-consolidacao")
  })

  it("não oferece bloco que ainda não começou", () => {
    // um dia depois do início: só o primeiro bloco existe
    const periods = reportPeriods(new Date(2026, 8, 1))
    const engine = periods.filter((p) => p.id.startsWith("engine-"))
    expect(engine).toHaveLength(1)
    expect(engine[0].id).toBe("engine-fundacao")
    // bloco em curso é truncado em hoje, não na data futura de fim
    expect(engine[0].to).toBe("2026-09-01")
  })

  it("janela móvel de 4 semanas cobre exatamente 28 dias", () => {
    const last4 = reportPeriods(TODAY).find((p) => p.id === "last-4w")!
    expect(daysInPeriod(last4.from, last4.to)).toBe(28)
  })
})

describe("compareWindows", () => {
  it("usa um terço em cada ponta, sem sobreposição", () => {
    const w = compareWindows(dayKey(-41), dayKey(0)) // 42 dias
    expect(w.windowDays).toBe(14)
    expect(w.startFrom).toBe(dayKey(-41))
    expect(w.startTo).toBe(dayKey(-28))
    expect(w.endFrom).toBe(dayKey(-13))
    expect(w.endTo).toBe(dayKey(0))
    expect(w.startTo < w.endFrom).toBe(true)
  })

  it("bloco curto tem piso de 7 dias, e as pontas nunca se cruzam", () => {
    const w = compareWindows(dayKey(-20), dayKey(0)) // 21 dias
    expect(w.windowDays).toBe(7)
    expect(w.startTo < w.endFrom).toBe(true)
  })

  it("período de 10 dias reparte pela metade em vez de estourar", () => {
    const w = compareWindows(dayKey(-9), dayKey(0))
    expect(w.windowDays).toBe(5)
    expect(w.startTo < w.endFrom).toBe(true)
  })
})

/* ---------------------------------------------------------------- */
/* Força                                                              */
/* ---------------------------------------------------------------- */

describe("liftProgress", () => {
  const workouts = [
    lift(dayKey(-41), "bench", 80),
    lift(dayKey(-30), "bench", 82),
    lift(dayKey(-5), "bench", 90),
    lift(dayKey(-2), "bench", 88),
    lift(dayKey(-20), "squat", 100),
  ]
  const windows = compareWindows(dayKey(-41), dayKey(0))

  it("compara a melhor série de cada ponta e devolve o delta percentual", () => {
    const bench = liftProgress(workouts, windows).find((l) => l.id === "bench")!
    // a ponta inicial pega a MELHOR das duas sessões que caem nela (82×8),
    // não a primeira — Epley: 82×8 = 103,9 ; 90×8 = 114
    expect(bench.start).toBeCloseTo(103.9, 1)
    expect(bench.end).toBeCloseTo(114, 1)
    expect(bench.deltaPct).toBeCloseTo(9.7, 1)
    expect(bench.best).toEqual({ weight: 90, reps: 8 })
    expect(bench.sessions).toBe(4)
  })

  it("exercício só no meio do bloco fica sem pontas para comparar", () => {
    const squat = liftProgress(workouts, windows).find((l) => l.id === "squat")!
    expect(squat.start).toBeNull()
    expect(squat.end).toBeNull()
    expect(squat.deltaPct).toBeNull()
    expect(squat.sessions).toBe(1)
  })

  it("exercício ausente do bloco não inventa progresso", () => {
    const deadlift = liftProgress(workouts, windows).find((l) => l.id === "deadlift")!
    expect(deadlift).toMatchObject({ start: null, end: null, deltaPct: null, sessions: 0 })
  })
})

/* ---------------------------------------------------------------- */
/* Composição                                                         */
/* ---------------------------------------------------------------- */

describe("bodyProgress", () => {
  const body: BodyLog[] = [
    { date: dayKey(-41), weightKg: 92, fatMassKg: 27, bodyFatPct: 29.3, waistCm: 96 },
    { date: dayKey(-35), weightKg: 91.6, fatMassKg: 26.7, bodyFatPct: 29.1, waistCm: 95.5 },
    { date: dayKey(-6), weightKg: 90, fatMassKg: 25, bodyFatPct: 27.8, waistCm: 93 },
    { date: dayKey(-1), weightKg: 89.8, fatMassKg: 24.8, bodyFatPct: 27.6, waistCm: 92.8 },
  ]
  const windows = compareWindows(dayKey(-41), dayKey(0))

  it("usa a média de cada ponta, não a medição isolada", () => {
    const rows = bodyProgress(body, windows)
    const weight = rows.find((r) => r.key === "weight")!
    expect(weight.start).toBeCloseTo(91.8, 2) // média de 92 e 91,6
    expect(weight.end).toBeCloseTo(89.9, 2) // média de 90 e 89,8
    expect(weight.delta).toBeCloseTo(-1.9, 2)
  })

  it("massa magra sai de peso menos gordura", () => {
    const lean = bodyProgress(body, windows).find((r) => r.key === "lean")!
    // (92 − 27) e (91,6 − 26,7) → média 64,95
    expect(lean.start).toBeCloseTo(64.95, 2)
    expect(lean.end).toBeCloseTo(65.0, 2)
  })

  it("omite métricas sem nenhum dado nas pontas", () => {
    const rows = bodyProgress(body, windows)
    expect(rows.map((r) => r.key)).not.toContain("visceral")
  })
})

/* ---------------------------------------------------------------- */
/* Semanas                                                            */
/* ---------------------------------------------------------------- */

describe("reportWeeks", () => {
  it("fatia o período em blocos de 7 dias a partir do início", () => {
    const data: GymData = {
      ...emptyData,
      body: [{ date: dayKey(-40), weightKg: 90 }],
      workouts: [lift(dayKey(-20), "bench", 80), lift(dayKey(-19), "bench", 80)],
    }
    const weeks = reportWeeks(data, dayKey(-20), dayKey(0), "hypertrophy")
    expect(weeks).toHaveLength(3)
    expect(weeks[0].sessions).toBe(2)
    expect(weeks[0].volumeKg).toBe(2 * 80 * 8)
    expect(weeks[1].sessions).toBe(0)
    expect(weeks[0].kcal).toBeGreaterThan(0)
  })
})

describe("massSeries", () => {
  it("deriva gordura e magra e ignora pesagens fora da janela", () => {
    const body: BodyLog[] = [
      { date: dayKey(-40), weightKg: 92, fatMassKg: 27 },
      { date: dayKey(-10), weightKg: 90, fatMassKg: 25 },
      { date: dayKey(-3), weightKg: 89.5 },
    ]
    const series = massSeries(body, dayKey(-20), dayKey(0))
    expect(series).toHaveLength(2)
    expect(series[0]).toMatchObject({ weightKg: 90, fatKg: 25, leanKg: 65 })
    expect(series[1].fatKg).toBeNull()
  })
})

/* ---------------------------------------------------------------- */
/* Relatórios completos                                               */
/* ---------------------------------------------------------------- */

const period: ReportPeriod = {
  id: "test",
  label: "Bloco de teste",
  from: dayKey(-41),
  to: dayKey(0),
}

function fullData(): GymData {
  const workouts: WorkoutLog[] = []
  for (let day = 41; day >= 0; day -= 3) {
    workouts.push(lift(dayKey(-day), "bench", 80 + (41 - day) * 0.3, 8, { srpe: 7 }))
  }
  workouts.push({
    id: "z2",
    date: dayKey(-7),
    sessionId: "cardioZ2",
    entries: [],
    cardios: [{ minutes: 60, mode: "Bike", purpose: "zone2" }],
  })
  const body: BodyLog[] = [
    { date: dayKey(-41), weightKg: 92, fatMassKg: 27, bodyFatPct: 29.3, bmrKcal: 1800, bmi: 28.4 },
    { date: dayKey(-28), weightKg: 91.3, fatMassKg: 26.3, bodyFatPct: 28.8, bmrKcal: 1800, bmi: 28.2 },
    { date: dayKey(-14), weightKg: 90.6, fatMassKg: 25.6, bodyFatPct: 28.3, bmrKcal: 1800, bmi: 28.0 },
    { date: dayKey(0), weightKg: 89.9, fatMassKg: 24.9, bodyFatPct: 27.7, bmrKcal: 1800, bmi: 27.8 },
  ]
  return {
    workouts,
    body,
    hydration: [
      { date: dayKey(-2), ml: 3000 },
      { date: dayKey(-1), ml: 3400 },
    ],
    sleep: [{ date: dayKey(-1), sleptAt: "23:30", wokeAt: "07:00", durationMin: 450 }],
  }
}

describe("blockReport", () => {
  const report = blockReport(fullData(), period, "hypertrophy")

  it("agrupa PRs por exercício com nome do catálogo, não o id cru", () => {
    expect(report.totals.prCount).toBeGreaterThan(report.totals.prs.length)
    const bench = report.totals.prs.find((p) => p.exerciseId === "bench")!
    expect(bench.name).not.toBe("bench")
    expect(bench.count).toBeGreaterThan(1)
    expect(bench.lastDate <= period.to).toBe(true)
  })

  it("resume o bloco com totais e janelas coerentes", () => {
    expect(report.days).toBe(42)
    expect(report.weeks).toBe(6)
    expect(report.totals.sessions).toBeGreaterThan(0)
    expect(report.totals.volumeKg).toBeGreaterThan(0)
    expect(report.totals.z2Minutes).toBe(60)
    expect(report.windows.windowDays).toBe(14)
  })

  it("aponta progresso de força e recomposição nos destaques", () => {
    expect(report.highlights.some((h) => h.includes("1RM estimada subiu"))).toBe(true)
    expect(report.highlights.some((h) => h.includes("Recomposição"))).toBe(true)
  })

  it("acusa grupos musculares abaixo do piso de séries duras", () => {
    expect(report.gaps.some((g) => g.includes("séries duras por semana"))).toBe(true)
  })

  it("acusa exercícios-chave sem nenhuma série no bloco", () => {
    expect(report.gaps.some((g) => g.includes("nenhuma série registrada"))).toBe(true)
  })

  it("uma semana por bloco de 7 dias, cobrindo o período", () => {
    expect(report.weekly).toHaveLength(6)
    expect(report.weekly[0].key).toBe(period.from)
  })

  it("período sem dado nenhum não quebra nem inventa número", () => {
    const empty = blockReport(emptyData, period, "hypertrophy")
    expect(empty.totals.sessions).toBe(0)
    expect(empty.totals.kcal).toBe(0)
    expect(empty.muscles).toHaveLength(0)
    expect(empty.body).toHaveLength(0)
    expect(empty.lifts.every((l) => l.start === null && l.end === null)).toBe(true)
  })
})

describe("nutritionReport", () => {
  const report = nutritionReport(fullData(), period, "hypertrophy")

  it("monta o perfil a partir da bioimpedância mais recente", () => {
    expect(report.profile).not.toBeNull()
    expect(report.profile!.weightKg).toBe(89.9)
    expect(report.profile!.leanMassKg).toBe(65)
    // altura derivada do IMC: √(89,9 / 27,8) ≈ 1,80 m
    expect(report.profile!.heightM).toBeCloseTo(1.8, 2)
  })

  it("separa gasto de musculação e cardio e converte em taxa semanal", () => {
    expect(report.training.liftKcal).toBeGreaterThan(0)
    expect(report.training.cardioKcal).toBeGreaterThan(0)
    expect(report.training.kcalPerWeek).toBeGreaterThan(0)
    expect(report.training.cardioMinutes).toBe(60)
  })

  it("estima ingestão e alvos com a bioimpedância disponível", () => {
    expect(report.energy.budget).not.toBeNull()
    expect(report.energy.intake).not.toBeNull()
    expect(report.energy.targets!.cut).toBeLessThan(report.energy.targets!.maintain)
    expect(report.energy.targets!.bulk).toBeGreaterThan(report.energy.targets!.maintain)
  })

  it("hidratação usa só os dias registrados e diz quantos são", () => {
    expect(report.hydration.daysLogged).toBe(2)
    expect(report.hydration.avgMl).toBe(3200)
    expect(report.hydration.adherencePct).toBeGreaterThan(0)
  })

  it("sono traz a média das noites registradas", () => {
    expect(report.sleep.nights).toBe(1)
    expect(report.sleep.avgMinutes).toBe(450)
  })

  it("sem bioimpedância o perfil some e nada é inventado", () => {
    const noBody: GymData = { ...fullData(), body: [] }
    const bare = nutritionReport(noBody, period, "hypertrophy")
    expect(bare.profile).toBeNull()
    expect(bare.energy.budget).toBeNull()
    expect(bare.energy.intake).toBeNull()
    expect(bare.hydration.avgMl).toBe(3200)
  })
})

describe("coachReport", () => {
  const report = coachReport(fullData(), period, "hypertrophy")

  it("separa exposição, carga e qualidade sem promover calorias a desfecho", () => {
    expect(report.training.sessions).toBeGreaterThan(0)
    expect(report.training.totalDurationMin).toBeGreaterThan(0)
    expect(report.training.totalLoad).toBeGreaterThan(0)
    expect(report.quality.map((item) => item.domain)).toEqual([
      "Treino",
      "Corpo",
      "Sono",
      "Hidratação",
    ])
    expect("energy" in report).toBe(false)
  })

  it("seleciona exercícios repetidos e compara médias das pontas", () => {
    const bench = report.lifts.find((lift) => lift.exerciseId === "bench")!
    expect(bench.sessions).toBeGreaterThan(4)
    expect(bench.recentE1rm).toBeGreaterThan(bench.baseE1rm)
    expect(bench.deltaPct).toBeGreaterThan(0)
    expect(bench.rirCoveragePct).toBe(0)
  })

  it("mostra cobertura de recuperação em vez de tratar ausência como zero", () => {
    expect(report.recovery.hydration.days).toBe(2)
    expect(report.recovery.hydration.coveragePct).toBeLessThan(10)
    expect(report.recovery.sleep.nights).toBe(1)
    expect(report.recovery.sleep.coveragePct).toBeLessThan(10)
  })

  it("marca bloco do ciclo de motor ainda em curso como parcial", () => {
    const partial = coachReport(
      emptyData,
      {
        id: "engine-fundacao",
        label: "Bloco 1 · Fundação",
        from: "2026-08-31",
        to: "2026-09-01",
      },
      "engine"
    )
    expect(partial.periodStatus).toBe("parcial")
    expect(partial.questions.some((question) => question.includes("parcial"))).toBe(true)
  })
})
