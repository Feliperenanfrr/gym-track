import { describe, expect, it } from "vitest"
import {
  blockReport,
  bodyProgress,
  coachReport,
  comebackReport,
  comparisonReport,
  compareWindows,
  daysInPeriod,
  healthReport,
  massSeries,
  nutritionReport,
  periodCalendar,
  periodConsistency,
  previousPeriod,
  reportCoverage,
  reportLifts,
  reportPeriods,
  reportSummaryText,
  reportWeeks,
  sessionTotals,
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

describe("reportLifts", () => {
  const workouts = [
    lift(dayKey(-41), "bench", 80),
    lift(dayKey(-30), "bench", 82),
    lift(dayKey(-5), "bench", 90),
    lift(dayKey(-2), "bench", 88),
    lift(dayKey(-20), "squat", 100),
  ]

  it("mede a carga do top set da primeira e da última sessão", () => {
    const bench = reportLifts(workouts, dayKey(-41), dayKey(0)).find(
      (l) => l.exerciseId === "bench"
    )!
    expect(bench.firstWeight).toBe(80)
    expect(bench.lastWeight).toBe(88)
    expect(bench.deltaKg).toBe(8)
    expect(bench.deltaPct).toBeCloseTo(10, 1)
    expect(bench.bestWeight).toBe(90)
    // a última sessão está abaixo do recorde do período
    expect(bench.relativePct).toBe(98)
    expect(bench.sessions).toBe(4)
  })

  it("não extrapola 1RM fora da faixa confiável", () => {
    const highReps = [
      lift(dayKey(-30), "legext", 60, 15),
      lift(dayKey(-10), "legext", 70, 15),
    ]
    const row = reportLifts(highReps, dayKey(-41), dayKey(0))[0]
    expect(row.deltaKg).toBe(10)
    expect(row.e1rmFirst).toBeNull()
    expect(row.e1rmLast).toBeNull()
    expect(row.e1rmPoints).toBe(0)
  })

  it("abre a 1RM estimada quando as séries são curtas", () => {
    const lowReps = [
      lift(dayKey(-30), "squat", 100, 5),
      lift(dayKey(-10), "squat", 110, 5),
    ]
    const row = reportLifts(lowReps, dayKey(-41), dayKey(0))[0]
    expect(row.e1rmPoints).toBe(2)
    expect(row.e1rmFirst).toBeCloseTo(116.7, 1)
    expect(row.e1rmLast).toBeCloseTo(128.3, 1)
  })

  it("exercício de uma sessão só não vira linha de comparação", () => {
    const rows = reportLifts(workouts, dayKey(-41), dayKey(0))
    expect(rows.some((row) => row.exerciseId === "squat")).toBe(false)
  })

  it("a lista sai do histórico, não de uma lista fixa", () => {
    const rows = reportLifts(workouts, dayKey(-41), dayKey(0))
    // o levantamento terra não tem registro nenhum e não deve aparecer
    expect(rows.some((row) => row.exerciseId === "deadlift")).toBe(false)
  })

  it("troca de nome do exercício derruba o delta e a confiança", () => {
    const renamed = [
      {
        ...lift(dayKey(-30), "pulldown", 40),
        entries: [
          { exerciseId: "pulldown", exerciseName: "Barra fixa", sets: [{ weight: 40, reps: 8 }] },
        ],
      },
      {
        ...lift(dayKey(-10), "pulldown", 50),
        entries: [
          {
            exerciseId: "pulldown",
            exerciseName: "Puxada na máquina",
            sets: [{ weight: 50, reps: 8 }],
          },
        ],
      },
    ]
    const row = reportLifts(renamed, dayKey(-41), dayKey(0))[0]
    expect(row.variantChanged).toBe(true)
    expect(row.confidence).toBe("baixa")
  })
})

/* ---------------------------------------------------------------- */
/* Exposição e constância                                             */
/* ---------------------------------------------------------------- */

describe("sessionTotals", () => {
  const workouts: WorkoutLog[] = [
    lift(dayKey(-10), "bench", 80, 8, { sessionId: "upperA", srpe: 7 }),
    lift(dayKey(-8), "bench", 80, 8, { sessionId: "free" }),
    {
      id: "z2",
      date: dayKey(-6),
      sessionId: "cardioZ2",
      entries: [],
      cardios: [{ minutes: 40, mode: "Bike", purpose: "zone2" }],
    },
    {
      id: "strava",
      date: dayKey(-4),
      sessionId: "strava",
      entries: [],
      cardios: [{ minutes: 30, mode: "Caminhada", purpose: "zone2", source: "strava" }],
    },
    { id: "rest", date: dayKey(-5), sessionId: "rest", entries: [] },
  ]

  it("conta TODAS as sessões registradas, com o alvo do programa à parte", () => {
    const totals = sessionTotals(workouts, dayKey(-13), dayKey(0), "hypertrophy")
    // o descanso não conta; avulso, cardio e caminhada importada contam
    expect(totals.sessions).toBe(4)
    // a caminhada do Strava não faz parte da prescrição do programa
    expect(totals.plannedSessions).toBe(3)
    expect(totals.activeDays).toBe(4)
    expect(totals.strengthSessions).toBe(2)
    expect(totals.conditioningSessions).toBe(2)
  })

  it("cobertura de sRPE é declarada em vez de virar média silenciosa", () => {
    const totals = sessionTotals(workouts, dayKey(-13), dayKey(0), "hypertrophy")
    expect(totals.srpeCoveragePct).toBe(25)
    expect(totals.avgSrpe).toBe(7)
  })
})

describe("periodConsistency", () => {
  const workouts = [lift(dayKey(-27), "bench", 80), lift(dayKey(-1), "bench", 80)]

  it("mede dias treinados, aderência e a maior lacuna do recorte", () => {
    const weekly = reportWeeks(
      { ...emptyData, workouts },
      dayKey(-27),
      dayKey(0),
      "hypertrophy"
    )
    const consistency = periodConsistency(workouts, dayKey(-27), dayKey(0), weekly)
    expect(consistency.daysTrained).toBe(2)
    expect(consistency.daysInPeriod).toBe(28)
    expect(consistency.adherencePct).toBe(7)
    // 26 dias vazios entre o primeiro e o último treino
    expect(consistency.longestGapDays).toBe(25)
    expect(consistency.gaps.length).toBeGreaterThan(0)
    expect(consistency.weeks).toBe(4)
    expect(consistency.weeksOnTarget).toBe(0)
  })
})

describe("periodCalendar", () => {
  it("cobre o período em colunas de semana e marca o que ficou fora", () => {
    const weeks = periodCalendar([lift(dayKey(-3), "bench", 80)], dayKey(-13), dayKey(0))
    expect(weeks.length).toBeGreaterThanOrEqual(2)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    const trained = weeks.flat().filter((day) => day.kind !== "none")
    expect(trained).toHaveLength(1)
    expect(trained[0].key).toBe(dayKey(-3))
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

  it("aponta progresso de carga e recomposição nos destaques", () => {
    expect(report.highlights.some((h) => h.includes("carga do top set subiu"))).toBe(true)
    expect(report.highlights.some((h) => h.includes("Recomposição"))).toBe(true)
  })

  it("põe constância na manchete: aderência, lacuna e semanas no alvo", () => {
    expect(report.consistency.daysTrained).toBeGreaterThan(0)
    expect(report.consistency.daysInPeriod).toBe(42)
    expect(report.consistency.weeks).toBe(6)
    expect(report.calendar.length).toBeGreaterThanOrEqual(6)
  })

  it("conta sessões do mesmo jeito no documento inteiro", () => {
    // a soma das semanas bate com o total: era aqui que 9 e 37 divergiam
    const fromWeeks = report.weekly.reduce((sum, week) => sum + week.sessions, 0)
    expect(fromWeeks).toBe(report.totals.sessions)
    expect(report.totals.sessionsPerWeek).toBeCloseTo(
      Math.round((report.totals.sessions / report.weeks) * 10) / 10,
      1
    )
  })

  it("acusa grupos musculares abaixo do piso de séries duras", () => {
    expect(report.gaps.some((g) => g.includes("séries duras por semana"))).toBe(true)
  })

  it("acusa carga longe do próprio recorde em vez de exercício ausente", () => {
    const detrained = blockReport(
      {
        ...emptyData,
        workouts: [
          lift(dayKey(-40), "bench", 100),
          lift(dayKey(-20), "bench", 60),
          lift(dayKey(-2), "bench", 60),
        ],
      },
      period,
      "hypertrophy"
    )
    expect(detrained.relativeLoad[0].relativePct).toBe(60)
    expect(detrained.gaps.some((g) => g.includes("do próprio recorde"))).toBe(true)
  })

  it("nomeia a lacuna quando o bloco tem uma semana inteira vazia", () => {
    const withGap = blockReport(
      {
        ...emptyData,
        workouts: [lift(dayKey(-41), "bench", 80), lift(dayKey(-1), "bench", 80)],
      },
      period,
      "hypertrophy"
    )
    expect(withGap.gaps.some((g) => g.includes("dias sem treino"))).toBe(true)
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
    expect(empty.lifts).toHaveLength(0)
    expect(empty.relativeLoad).toHaveLength(0)
    expect(empty.consistency.daysTrained).toBe(0)
    expect(empty.consistency.longestGapDays).toBe(42)
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
    expect(report.hydration.coveragePct).toBeLessThan(10)
    expect(report.hydration.loggedRatioPct).toBeGreaterThan(0)
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
    expect(report.training.durationMin).toBeGreaterThan(0)
    expect(report.training.load).toBeGreaterThan(0)
    expect(report.quality.map((item) => item.domain)).toEqual([
      "Treino",
      "Corpo",
      "Sono",
      "Hidratação",
    ])
    expect("energy" in report).toBe(false)
  })

  it("mede a força pela carga do top set, igual ao fechamento", () => {
    const bench = report.lifts.find((lift) => lift.exerciseId === "bench")!
    expect(bench.sessions).toBeGreaterThan(4)
    expect(bench.lastWeight).toBeGreaterThan(bench.firstWeight)
    expect(bench.deltaKg).toBeGreaterThan(0)
    expect(bench.relativePct).toBeLessThanOrEqual(100)
  })

  it("carrega a mesma tabela de semanas do fechamento", () => {
    const block = blockReport(fullData(), period, "hypertrophy")
    expect(report.weekly.map((week) => week.sessions)).toEqual(
      block.weekly.map((week) => week.sessions)
    )
    expect(report.training.sessions).toBe(block.totals.sessions)
  })

  it("traz o estado de carga e a constância para a prescrição", () => {
    expect(report.relativeLoad.length).toBeGreaterThan(0)
    expect(report.consistency.daysTrained).toBeGreaterThan(0)
    expect(report.calendar.length).toBeGreaterThan(0)
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

/* ---------------------------------------------------------------- */
/* Cobertura do período                                               */
/* ---------------------------------------------------------------- */

describe("reportCoverage", () => {
  it("conta o que existe e avisa o que vai faltar no documento", () => {
    const coverage = reportCoverage(fullData(), period)
    expect(coverage.sessions).toBeGreaterThan(0)
    expect(coverage.weighIns).toBe(4)
    expect(coverage.comparableLifts).toBeGreaterThan(0)
    expect(coverage.empty).toBe(false)
    // sono e água têm 1 e 2 dias num período de 42
    expect(coverage.warnings.some((w) => w.includes("Sono registrado"))).toBe(true)
    expect(coverage.warnings.some((w) => w.includes("Água registrada"))).toBe(true)
    expect(coverage.warnings.some((w) => w.includes("cintura"))).toBe(true)
  })

  it("período vazio é declarado vazio em vez de virar folha de trações", () => {
    const coverage = reportCoverage(emptyData, period)
    expect(coverage.empty).toBe(true)
    expect(coverage.warnings[0]).toContain("Nenhuma sessão")
  })

  it("recorte curto avisa que as pontas do comparativo ficam minúsculas", () => {
    const short: ReportPeriod = {
      id: "curto",
      label: "Bloco curto",
      from: dayKey(-3),
      to: dayKey(0),
    }
    const coverage = reportCoverage(fullData(), short)
    expect(coverage.days).toBe(4)
    expect(coverage.warnings.some((w) => w.includes("comparativo"))).toBe(true)
  })
})

/* ---------------------------------------------------------------- */
/* Resumo de saúde                                                    */
/* ---------------------------------------------------------------- */

describe("healthReport", () => {
  function healthData(): GymData {
    const data = fullData()
    return {
      ...data,
      body: [
        { date: dayKey(-41), weightKg: 95, waistCm: 104, bmi: 31, bodyFatPct: 31, visceralFat: 16, fatMassKg: 29 },
        { date: dayKey(-20), weightKg: 94, waistCm: 102, bmi: 30.5, bodyFatPct: 30.5, visceralFat: 16, fatMassKg: 28.5 },
        { date: dayKey(0), weightKg: 93, waistCm: 100, bmi: 30, bodyFatPct: 30, visceralFat: 15, fatMassKg: 28 },
      ],
    }
  }

  const report = healthReport(healthData(), period, "hypertrophy")

  it("classifica cada marcador contra a faixa de referência", () => {
    const waist = report.markers.find((marker) => marker.key === "waist")!
    expect(waist.value).toBe(100)
    // 100 cm fica entre 94 (aumentado) e 102 (muito aumentado)
    expect(waist.status).toBe("atencao")
    expect(waist.reference).toContain("94")

    const visceral = report.markers.find((marker) => marker.key === "visceral")!
    expect(visceral.value).toBe(15)
    expect(visceral.status).toBe("alerta")

    const bmi = report.markers.find((marker) => marker.key === "bmi")!
    expect(bmi.status).toBe("alerta")
  })

  it("dá direção ao marcador comparando com a ponta inicial do período", () => {
    const waist = report.markers.find((marker) => marker.key === "waist")!
    expect(waist.previous).toBe(104)
    expect(waist.delta).toBe(-4)
  })

  it("mede atividade contra a recomendação para adultos", () => {
    expect(report.activity.meetsAerobic).toBe(false)
    expect(report.alerts.some((alert) => alert.includes("150 min"))).toBe(true)
  })

  it("leva o que está fora da faixa para a lista da consulta", () => {
    expect(report.alerts.some((alert) => alert.includes("Gordura visceral"))).toBe(true)
    expect(report.alerts.some((alert) => alert.includes("IMC"))).toBe(true)
  })

  it("sem medida não inventa faixa", () => {
    const bare = healthReport(emptyData, period, "hypertrophy")
    expect(bare.markers.every((marker) => marker.value === null)).toBe(true)
    expect(bare.markers.every((marker) => marker.status === "desconhecido")).toBe(true)
  })
})

/* ---------------------------------------------------------------- */
/* Comparativo                                                        */
/* ---------------------------------------------------------------- */

describe("previousPeriod", () => {
  it("é o recorte imediatamente anterior, do mesmo tamanho", () => {
    const before = previousPeriod(period)
    expect(daysInPeriod(before.from, before.to)).toBe(daysInPeriod(period.from, period.to))
    expect(before.to).toBe(dayKey(-42))
  })
})

describe("comparisonReport", () => {
  function twoBlocks(): GymData {
    const workouts: WorkoutLog[] = []
    // período anterior: 3 sessões, carga 70
    for (const day of [80, 70, 60]) workouts.push(lift(dayKey(-day), "bench", 70))
    // período recente: 6 sessões, carga subindo até 90
    for (const day of [40, 34, 28, 20, 12, 4]) {
      workouts.push(lift(dayKey(-day), "bench", 70 + (40 - day) / 2))
    }
    return { ...emptyData, workouts }
  }

  const report = comparisonReport(twoBlocks(), period, previousPeriod(period), "hypertrophy")

  it("compara os dois recortes na mesma régua", () => {
    expect(report.days).toBe(42)
    expect(daysInPeriod(report.b.from, report.b.to)).toBe(42)
    const sessions = report.exposure.find((row) => row.key === "sessions")!
    expect(sessions.a).toBeGreaterThan(sessions.b!)
    expect(sessions.delta).toBeGreaterThan(0)
  })

  it("compara a carga por exercício sem 1RM estimada", () => {
    const bench = report.lifts.find((row) => row.exerciseId === "bench")!
    expect(bench.bWeight).toBe(70)
    expect(bench.aWeight).toBe(88)
    expect(bench.deltaKg).toBe(18)
  })

  it("escreve a leitura em vez de deixar o leitor subtrair colunas", () => {
    expect(report.verdict.some((line) => line.includes("Apareceu mais"))).toBe(true)
    expect(report.verdict.some((line) => line.includes("Carga acima"))).toBe(true)
  })

  it("período anterior vazio é dito, não celebrado como melhora", () => {
    const onlyRecent = comparisonReport(
      { ...emptyData, workouts: [lift(dayKey(-10), "squat", 100)] },
      period,
      previousPeriod(period),
      "hypertrophy"
    )
    expect(onlyRecent.previousEmpty).toBe(true)
    expect(onlyRecent.verdict).toHaveLength(1)
    expect(onlyRecent.verdict[0]).toContain("não tem registro nenhum")
    expect(onlyRecent.verdict.some((line) => line.includes("Apareceu mais"))).toBe(false)
  })

  it("exercício ausente do período anterior fica sem delta, não com zero", () => {
    const onlyRecent = comparisonReport(
      { ...emptyData, workouts: [lift(dayKey(-10), "squat", 100), lift(dayKey(-4), "squat", 105)] },
      period,
      previousPeriod(period),
      "hypertrophy"
    )
    const squat = onlyRecent.lifts.find((row) => row.exerciseId === "squat")!
    expect(squat.bWeight).toBeNull()
    expect(squat.deltaKg).toBeNull()
  })
})

/* ---------------------------------------------------------------- */
/* Onde eu parei                                                      */
/* ---------------------------------------------------------------- */

describe("comebackReport", () => {
  function stalled(): GymData {
    return {
      ...emptyData,
      workouts: [
        lift(dayKey(-60), "squat", 100),
        lift(dayKey(-30), "squat", 80),
        lift(dayKey(-3), "bench", 60),
        lift(dayKey(-10), "bench", 60),
      ],
    }
  }

  const report = comebackReport(stalled(), TODAY)

  it("manda reentrar abaixo depois de duas semanas sem o exercício", () => {
    const squat = report.lifts.find((row) => row.exerciseId === "squat")!
    expect(squat.daysSince).toBe(30)
    expect(squat.advice).toBe("reentrar")
    // 90% de 80 kg, arredondado ao passo inferido do histórico (20 kg → 72)
    expect(squat.suggestedWeight).toBeLessThan(squat.lastWeight)
    expect(squat.relativePct).toBe(80)
  })

  it("exercício recente e no próprio recorde não pede recuo", () => {
    const bench = report.lifts.find((row) => row.exerciseId === "bench")!
    expect(bench.daysSince).toBe(3)
    expect(bench.relativePct).toBe(100)
    expect(bench.advice).toBe("seguir")
    expect(bench.suggestedWeight).toBe(60)
  })

  it("ordena pelo pior caso e conta os dias de parada", () => {
    expect(report.lifts[0].relativePct).toBeLessThanOrEqual(report.lifts[1].relativePct)
    expect(report.daysSinceAny).toBe(3)
    expect(report.daysSinceLift).toBe(3)
  })

  it("sem registro nenhum não quebra", () => {
    const bare = comebackReport(emptyData, TODAY)
    expect(bare.lifts).toHaveLength(0)
    expect(bare.daysSinceAny).toBeNull()
    expect(bare.missingGroups.length).toBeGreaterThan(0)
  })
})

/* ---------------------------------------------------------------- */
/* Resumo em texto                                                    */
/* ---------------------------------------------------------------- */

describe("reportSummaryText", () => {
  it("cabe numa mensagem e leva os números que decidem", () => {
    const text = reportSummaryText(fullData(), period, "hypertrophy")
    expect(text).toContain("GYM//TRACK")
    expect(text).toContain("Sessões:")
    expect(text).toContain("Aderência:")
    expect(text.split("\n").length).toBeLessThan(25)
  })

  it("período vazio produz texto sem número inventado", () => {
    const text = reportSummaryText(emptyData, period, "hypertrophy")
    expect(text).toContain("Sessões: 0")
    expect(text).not.toContain("NaN")
    expect(text).not.toContain("undefined")
  })
})
