import { describe, expect, it } from "vitest"
import {
  computeReadiness,
  cardioMet,
  internalLoad,
  liftMetForSrpe,
  prEvents,
  sessionKcal,
  waterGoalMl,
  weeklySummary,
  weightKgOn,
  weightTrend7d,
} from "../lib/insights"
import { GymData, WorkoutLog } from "../lib/types"

function dayKey(offsetDays: number, base = new Date(2026, 7, 20)): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

const TODAY = new Date(2026, 7, 20)

function workout(opts: Partial<WorkoutLog> & { date: string }): WorkoutLog {
  return {
    id: `w-${opts.date}-${opts.sessionId ?? "upperA"}`,
    sessionId: "upperA",
    entries: [],
    ...opts,
  }
}

const emptyData: GymData = { workouts: [], body: [], hydration: [], sleep: [] }

/* ---------------------------------------------------------------- */
/* Hidratação                                                         */
/* ---------------------------------------------------------------- */

describe("waterGoalMl", () => {
  it("usa o peso mais recente e arredonda a dezenas de ml", () => {
    const body: { date: string; weightKg?: number }[] = [
      { date: dayKey(-10), weightKg: 90 },
      { date: dayKey(-1), weightKg: 92.4 },
    ]
    expect(waterGoalMl(body)).toBe(Math.round((92.4 * 37) / 50) * 50)
  })

  it("sem peso → fallback fixo de 3300 ml", () => {
    expect(waterGoalMl([])).toBe(3300)
    const noWeight: { date: string; weightKg?: number }[] = [{ date: dayKey(0) }]
    expect(waterGoalMl(noWeight)).toBe(3300) // peso zero/ausente não conta
  })
})

/* ---------------------------------------------------------------- */
/* PRs                                                                */
/* ---------------------------------------------------------------- */

describe("prEvents", () => {
  it("primeiro registro estabelece base (não é PR); superação posterior é PR", () => {
    const w1 = workout({
      date: dayKey(-10),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    }) // e1RM = 112.5
    const w2 = workout({
      date: dayKey(-5),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 6 }] }],
    }) // e1RM = 115
    const w3 = workout({
      date: dayKey(-2),
      entries: [{ exerciseId: "bench", sets: [{ weight: 95, reps: 5 }] }],
    }) // abaixo da base
    const events = prEvents([w1, w3, w2])
    expect(events).toHaveLength(1)
    expect(events[0].date).toBe(dayKey(-5))
  })

  it("exercícios independentes têm bases independentes", () => {
    const a = workout({ date: dayKey(-3), entries: [{ exerciseId: "squat", sets: [{ weight: 140, reps: 5 }] }] })
    const b = workout({ date: dayKey(-2), entries: [{ exerciseId: "row", sets: [{ weight: 70, reps: 8 }] }] })
    expect(prEvents([a, b])).toHaveLength(0)
  })
})

/* ---------------------------------------------------------------- */
/* Carga interna                                                      */
/* ---------------------------------------------------------------- */

describe("internalLoad", () => {
  it("com sRPE + duração → Foster (sRPE × minutos)", () => {
    const w = workout({
      date: dayKey(-1),
      srpe: 7,
      durationMin: 55,
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 8 }] }],
    })
    expect(internalLoad(w)).toBe(385)
  })

  it("fallback musculação sem sRPE: tonelagem × 0.05", () => {
    const w = workout({
      date: dayKey(-1),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 10 }, { weight: 100, reps: 10 }] }],
    })
    expect(internalLoad(w)).toBe(Math.round(2000 * 0.05))
  })

  it("Zona 2 × 4 · intenso × 8 · esporte × 7", () => {
    const z2 = workout({
      date: dayKey(-1),
      sessionId: "cardioZ2",
      cardio: { minutes: 30, mode: "Bike", purpose: "zone2" },
    })
    const hard = workout({
      date: dayKey(-1),
      sessionId: "cardioZ2",
      cardio: { minutes: 15, mode: "Corda", purpose: "intense" },
    })
    const sport = workout({
      date: dayKey(-1),
      sessionId: "sport",
      cardio: { minutes: 60, mode: "Futsal", purpose: "sport" },
    })
    expect(internalLoad(z2)).toBe(120)
    expect(internalLoad(hard)).toBe(120)
    expect(internalLoad(sport)).toBe(420)
  })
})

/* ---------------------------------------------------------------- */
/* Readiness (ACWR)                                                   */
/* ---------------------------------------------------------------- */

describe("computeReadiness", () => {
  function mk(offset: number, dur: number, srpe = 8) {
    return workout({ date: dayKey(offset), srpe, durationMin: dur })
  }

  it("sem base crônica → building com ratio null", () => {
    const r = computeReadiness([], TODAY)
    expect(r.level).toBe("building")
    expect(r.ratio).toBeNull()
  })

  it("carga aguda ≈ crônica → verde (ratio ~1.0)", () => {
    // base crônica: uma sessão de 800 AU em cada uma das 3 semanas (-20/-15/-10)
    const chronic = [mk(-20, 100), mk(-15, 100), mk(-10, 100)]
    const r = computeReadiness([...chronic, mk(-3, 100)], TODAY)
    expect(r.level).toBe("green")
    expect(r.ratio).toBeCloseTo(1, 5)
  })

  it("agudo moderadamente acima → amarelo; muito acima → vermelho", () => {
    const chronic = [mk(-20, 100), mk(-15, 100), mk(-10, 100)] // 800 AU/semana
    const yellow = computeReadiness([...chronic, mk(-2, 130)], TODAY) // 1040/800 ≈ 1.3
    expect(yellow.level).toBe("yellow")
    const red = computeReadiness([...chronic, mk(-2, 200), mk(-4, 200)], TODAY) // 3200/800 = 4
    expect(red.level).toBe("red")
  })

  it("limites exatos do ACWR: ≤1.1 verde · ≤1.4 amarelo · >1.4 vermelho", () => {
    // base: sessão semanal de 700 AU (srpe 10 × 70 min) em -26/-19/-12
    const chronic = [mk(-26, 70, 10), mk(-19, 70, 10), mk(-12, 70, 10)]
    expect(computeReadiness([...chronic, mk(-3, 77, 10)], TODAY).level).toBe("green") // 1.1
    expect(computeReadiness([...chronic, mk(-3, 98, 10)], TODAY).level).toBe("yellow") // 1.4
    expect(computeReadiness([...chronic, mk(-3, 99, 10)], TODAY).level).toBe("red") // ~1.41
  })
})

/* ---------------------------------------------------------------- */
/* Tendência de peso                                                  */
/* ---------------------------------------------------------------- */

describe("weightTrend7d", () => {
  it("compara médias das duas janelas de 7 dias", () => {
    const body = [
      { date: dayKey(-12), weightKg: 92 },
      { date: dayKey(-10), weightKg: 94 },
      { date: dayKey(-4), weightKg: 91 },
      { date: dayKey(-2), weightKg: 93 },
    ]
    const t = weightTrend7d(body, TODAY)
    expect(t.previousAvg).toBeCloseTo(93, 5)
    expect(t.currentAvg).toBeCloseTo(92, 5)
    expect(t.delta).toBeCloseTo(-1, 5)
  })

  it("janela anterior vazia → usa as até 4 pesagens anteriores (≤60d)", () => {
    const body = [
      { date: dayKey(-40), weightKg: 96 },
      { date: dayKey(-35), weightKg: 95 },
      { date: dayKey(-3), weightKg: 93 },
      { date: dayKey(-1), weightKg: 95 },
    ]
    const t = weightTrend7d(body, TODAY)
    expect(t.currentAvg).toBeCloseTo(94, 5)
    expect(t.previousAvg).toBeCloseTo(95.5, 5) // duas pesagens mais recentes fora da janela atual
    expect(t.delta).toBeCloseTo(-1.5, 5)
  })

  it("ignora registros futuros e pesos inválidos", () => {
    const body = [
      { date: dayKey(+1), weightKg: 999 }, // futuro
      { date: dayKey(-2), weightKg: 0 }, // zerado
      { date: dayKey(-3), weightKg: 90 },
    ]
    const t = weightTrend7d(body, TODAY)
    expect(t.currentAvg).toBeCloseTo(90, 5)
    expect(t.delta).toBeNull() // nada comparável
  })

  it("sem dados → tudo null", () => {
    expect(weightTrend7d([], TODAY)).toEqual({
      currentAvg: null,
      previousAvg: null,
      delta: null,
    })
  })
})

/* ---------------------------------------------------------------- */
/* Calorias por sessão                                               */
/* ---------------------------------------------------------------- */

describe("liftMetForSrpe", () => {
  it("sem sRPE usa a sessão típica de hipertrofia do Compendium (3,5 METs)", () => {
    expect(liftMetForSrpe(undefined)).toBe(3.5)
    expect(liftMetForSrpe(0)).toBe(3.5)
  })
  it("mapeia faixas de esforço para METs da tabela Compendium", () => {
    expect(liftMetForSrpe(1)).toBe(3)
    expect(liftMetForSrpe(3)).toBe(3)
    expect(liftMetForSrpe(4)).toBe(3.5)
    expect(liftMetForSrpe(5)).toBe(3.5)
    expect(liftMetForSrpe(6)).toBe(5)
    expect(liftMetForSrpe(7)).toBe(5)
    expect(liftMetForSrpe(8)).toBe(6)
    expect(liftMetForSrpe(10)).toBe(6)
  })
})

describe("weightKgOn", () => {
  const body = [
    { date: dayKey(-30), weightKg: 95 },
    { date: dayKey(-10), weightKg: 93 },
    { date: dayKey(-2), weightKg: 91 },
  ]
  it("usa a pesagem mais recente anterior ao treino", () => {
    expect(weightKgOn(body, dayKey(-8))).toBe(93)
    expect(weightKgOn(body, dayKey(-1))).toBe(91)
  })
  it("sem pesagem anterior, cai para a primeira disponível", () => {
    expect(weightKgOn(body, dayKey(-40))).toBe(95)
  })
  it("ignora pesos zerados e retorna undefined sem nada válido", () => {
    expect(weightKgOn([{ date: dayKey(-3), weightKg: 0 }], dayKey(-1))).toBeUndefined()
  })
})

describe("sessionKcal", () => {
  // 80 kg → kcalPerMin(met) = met * 3.5 * 80 / 200 = met * 1.4
  it("musculação usa duração real e MET pelo sRPE", () => {
    const w = workout({
      date: dayKey(-1),
      durationMin: 50,
      srpe: 9,
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    })
    const est = sessionKcal(w, 80)!
    // 50 min × MET 6 × 1.4 = 420 kcal
    expect(est.mid).toBe(420)
    expect(est.met).toBe(6)
    expect(est.minutes).toBe(50)
    expect(est.low).toBe(Math.round((420 * 0.8) / 10) * 10)
    expect(est.high).toBe(Math.round((420 * 1.25) / 10) * 10)
  })

  it("sem duração medida (registro antigo), cai no padrão de 60 min", () => {
    const w = workout({
      date: dayKey(-1),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    })
    const est = sessionKcal(w, 80)!
    expect(est.minutes).toBe(60)
    expect(est.mid).toBe(Math.round((60 * 3.5 * 1.4) / 10) * 10)
  })

  it("treino leve (sRPE baixo) usa MET moderado, não o flat de 5", () => {
    const easy = workout({
      date: dayKey(-1),
      durationMin: 45,
      srpe: 3,
      entries: [{ exerciseId: "bench", sets: [{ weight: 20, reps: 12 }] }],
    })
    const est = sessionKcal(easy, 80)!
    expect(est.met).toBe(3)
    expect(est.mid).toBe(Math.round((45 * 3 * 1.4) / 10) * 10)
  })

  it("sessão mista não conta o cardio duas vezes (durationMin é a sessão toda)", () => {
    const w = workout({
      date: dayKey(-1),
      sessionId: "free",
      durationMin: 40,
      srpe: 7,
      entries: [{ exerciseId: "bench", sets: [{ weight: 60, reps: 10 }] }],
      cardio: { minutes: 20, mode: "Bike", purpose: "zone2" },
    })
    const est = sessionKcal(w, 80)!
    // 40 min de sessão dos quais 20 foram de bike → sala 20 min
    // sala: 20 × 5 × 1.4 = 140 · Z2: 20 × 6.5 × 1.4 = 182 → 322 → 320
    expect(est.minutes).toBe(40)
    expect(est.mid).toBe(320)
  })

  it("cada bloco de cardio entra com o MET da sua finalidade", () => {
    const w = workout({
      date: dayKey(-1),
      sessionId: "free",
      durationMin: 45,
      cardios: [
        { minutes: 15, mode: "Bike ergométrica", purpose: "zone2" },
        { minutes: 15, mode: "Corrida", purpose: "intense" },
        { minutes: 15, mode: "Caminhada", purpose: "zone2" },
      ],
    })
    const est = sessionKcal(w, 80)!
    // Bike Z2 6,5 + corrida intensa 8,5 + caminhada genérica 3,8 MET.
    // Caminhada não herda 6,5 só porque foi marcada como Zona 2.
    expect(est.minutes).toBe(45)
    expect(est.mid).toBe(390)
    // sem musculação, o MET exibido é o do bloco mais longo (empate → o 1º)
    expect(est.met).toBe(6.5)
  })

  it("caminhada do Strava usa cadência e segundos, não o fallback de 6,5 MET", () => {
    const block = {
      minutes: 63,
      durationSeconds: 3780,
      mode: "Caminhada",
      purpose: "zone2" as const,
      distanceKm: 5.62,
      steps: 6870,
      source: "strava" as const,
    }
    expect(cardioMet(block, "strava")).toBe(3.7)
    const est = sessionKcal(
      workout({ date: dayKey(-1), sessionId: "strava", cardios: [block] }),
      80
    )!
    expect(est.minutes).toBe(63)
    expect(est.met).toBe(3.7)
    expect(est.mid).toBe(330)
  })

  it("ganho de elevação corrige a caminhada e corrida usa o ritmo", () => {
    const uphillWalk = {
      minutes: 18,
      durationSeconds: 1092,
      mode: "Caminhada",
      purpose: "zone2" as const,
      distanceKm: 1.61,
      elevationGainM: 45,
    }
    expect(cardioMet(uphillWalk, "strava")).toBe(5.1)
    expect(cardioMet({ minutes: 60, mode: "Corrida", distanceKm: 10 }, "strava")).toBe(9.3)
  })

  it("esporte usa minutos × 8 METs; sem cardio não há estimativa", () => {
    const jogo = workout({
      date: dayKey(-1),
      sessionId: "sport",
      cardio: { minutes: 60, mode: "Futsal", purpose: "sport" },
    })
    expect(sessionKcal(jogo, 80)!.mid).toBe(Math.round((60 * 8 * 1.4) / 10) * 10)
    const vazio = workout({ date: dayKey(-1), sessionId: "sport" })
    expect(sessionKcal(vazio, 80)).toBeNull()
  })

  it("sem peso → null (sem caloria inventada)", () => {
    const w = workout({
      date: dayKey(-1),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    })
    expect(sessionKcal(w, undefined)).toBeNull()
    expect(sessionKcal(w, 0)).toBeNull()
  })
})

/* ---------------------------------------------------------------- */
/* Resumo semanal                                                     */
/* ---------------------------------------------------------------- */

describe("weeklySummary", () => {
  it("kcal null sem peso no banco — sem inventar 85 kg", () => {
    const monday = new Date(2026, 7, 17) // segunda
    const data: GymData = {
      ...emptyData,
      workouts: [
        workout({ date: dayKey(-3), entries: [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }] }),
      ],
    }
    const s = weeklySummary(data, monday)
    expect(s.kcal).toBeNull()
    expect(s.sessions).toBe(1)
    expect(s.volume).toBe(480)
  })

  it("com peso, kcal sai do MET × massa real", () => {
    const monday = new Date(2026, 7, 17)
    const data: GymData = {
      ...emptyData,
      body: [{ date: dayKey(-5), weightKg: 80 }],
      workouts: [
        workout({ date: dayKey(-3), entries: [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }] }),
      ],
    }
    const s = weeklySummary(data, monday)
    const expected = Math.round(((3.5 * 3.5 * 80) / 200) * 60 / 10) * 10 // MET_LIFT × 60 min @ 80 kg
    expect(s.kcal).toBe(expected)
  })

  it("soma duração real e sRPE por sessão e expõe a faixa", () => {
    const monday = new Date(2026, 7, 17)
    const data: GymData = {
      ...emptyData,
      body: [{ date: dayKey(-5), weightKg: 80 }],
      workouts: [
        workout({
          date: dayKey(-3),
          durationMin: 50,
          srpe: 9,
          entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
        }),
      ],
    }
    const s = weeklySummary(data, monday)
    expect(s.kcal).toBe(420) // 50 min × MET 6 × 1.4
    expect(s.kcalLow).toBe(Math.round((420 * 0.8) / 10) * 10)
    expect(s.kcalHigh).toBe(Math.round((420 * 1.25) / 10) * 10)
  })

  it("PRs da semana aparecem pelo nome, sem duplicar", () => {
    const monday = new Date(2026, 7, 17)
    const base = workout({
      date: dayKey(-9),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    })
    const pr1 = workout({
      date: dayKey(-2),
      entries: [{ exerciseId: "bench", sets: [{ weight: 100, reps: 6 }], exerciseName: "Supino reto" } as never],
    })
    const pr2 = workout({
      date: dayKey(-1),
      entries: [{ exerciseId: "bench", sets: [{ weight: 102.5, reps: 6 }], exerciseName: "Supino reto" } as never],
    })
    const s = weeklySummary({ ...emptyData, workouts: [base, pr1, pr2] }, monday)
    expect(s.prs).toEqual(["Supino reto"])
  })
})
