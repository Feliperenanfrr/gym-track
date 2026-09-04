import { describe, expect, it } from "vitest"
import {
  consistencyInRange,
  consistencySummary,
  consistencyWeeks,
  trainingCalendar,
  trainingDayKinds,
  weeklySessionTarget,
} from "../lib/consistency"
import { SessionId, WorkoutLog } from "../lib/types"

/** Quinta-feira, 20/08/2026 — a segunda dessa semana é 17/08. */
const TODAY = new Date(2026, 7, 20)

function workout(
  date: string,
  opts: Partial<WorkoutLog> = {}
): WorkoutLog {
  return {
    id: `w-${date}-${opts.sessionId ?? "upperA"}`,
    date,
    sessionId: "upperA",
    entries: [],
    ...opts,
  }
}

/** Sessão de sala com série registrada. */
function lift(date: string, sessionId: SessionId = "upperA"): WorkoutLog {
  return workout(date, {
    sessionId,
    entries: [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8, rir: 2 }] }],
  })
}

/** Sessão só de cardio. */
function cardio(date: string): WorkoutLog {
  return workout(date, {
    sessionId: "cardioZ2",
    cardios: [{ minutes: 30, mode: "Bike ergométrica", purpose: "zone2" }],
  })
}

describe("weeklySessionTarget", () => {
  it("hipertrofia usa a régua fixa de 5 sessões", () => {
    expect(weeklySessionTarget("hypertrophy", new Date(2026, 7, 17))).toBe(5)
  })

  it("ciclo de motor lê o alvo do bloco em que a semana cai", () => {
    const target = weeklySessionTarget("engine", new Date(2026, 8, 7))
    expect(target).toBeGreaterThanOrEqual(5)
    expect(Number.isInteger(target)).toBe(true)
  })

  it("faixa '5–6' é lida pelo piso — o mínimo é o que define semana cumprida", () => {
    // qualquer semana do ciclo devolve inteiro, nunca NaN vindo do traço
    for (const week of [0, 4, 8, 11]) {
      const monday = new Date(2026, 7, 31 + week * 7)
      expect(Number.isNaN(weeklySessionTarget("engine", monday))).toBe(false)
    }
  })
})

describe("trainingCalendar", () => {
  it("devolve semanas de 7 dias terminando na semana corrente", () => {
    const weeks = trainingCalendar([], TODAY, 4)
    expect(weeks).toHaveLength(4)
    expect(weeks.every((w) => w.days.length === 7)).toBe(true)
    expect(weeks[3].start).toBe("2026-08-17")
    expect(weeks[0].start).toBe("2026-07-27")
  })

  it("classifica o dia por sala, cardio ou os dois", () => {
    const weeks = trainingCalendar(
      [lift("2026-08-17"), cardio("2026-08-18"), lift("2026-08-19"), cardio("2026-08-19")],
      TODAY,
      1
    )
    const [seg, ter, qua] = weeks[0].days
    expect(seg.kind).toBe("lift")
    expect(ter.kind).toBe("cardio")
    expect(qua.kind).toBe("both")
  })

  it("marca hoje e separa o futuro de 'sem registro'", () => {
    const weeks = trainingCalendar([], TODAY, 1)
    const days = weeks[0].days
    // seg 17 … dom 23; hoje é quinta (índice 3)
    expect(days[3].isToday).toBe(true)
    expect(days[3].isFuture).toBe(false)
    expect(days[2].isFuture).toBe(false)
    expect(days[4].isFuture).toBe(true)
    expect(days[6].isFuture).toBe(true)
  })

  it("descanso não pinta o dia", () => {
    const weeks = trainingCalendar([workout("2026-08-17", { sessionId: "rest" })], TODAY, 1)
    expect(weeks[0].days[0].kind).toBe("none")
  })

  it("rotula o mês só na primeira semana de cada mês", () => {
    const labels = trainingCalendar([], TODAY, 8).map((w) => w.monthLabel)
    expect(labels.filter(Boolean).length).toBeGreaterThanOrEqual(2)
    expect(labels.filter((l) => l === "ago")).toHaveLength(1)
  })
})

describe("consistencyWeeks", () => {
  it("conta sessões da semana seg–dom contra o alvo", () => {
    const workouts = [
      lift("2026-08-17"),
      lift("2026-08-18", "lowerA"),
      cardio("2026-08-19"),
      // fora da semana corrente
      lift("2026-08-10", "upperB"),
    ]
    const weeks = consistencyWeeks(workouts, TODAY, "hypertrophy", 2)
    expect(weeks).toHaveLength(2)
    expect(weeks[0].sessions).toBe(1)
    expect(weeks[1].sessions).toBe(3)
    expect(weeks[1].current).toBe(true)
    expect(weeks[1].onTarget).toBe(false)
  })

  it("marca a semana como cumprida ao bater o alvo", () => {
    const ids: SessionId[] = ["upperA", "lowerA", "upperB", "lowerB", "cardioZ2"]
    const workouts = ids.map((id, i) => lift(`2026-08-${17 + i}`, id))
    const weeks = consistencyWeeks(workouts, TODAY, "hypertrophy", 1)
    expect(weeks[0].sessions).toBe(5)
    expect(weeks[0].onTarget).toBe(true)
  })

  it("dias conta datas distintas, sessões conta registros", () => {
    const workouts = [lift("2026-08-17"), lift("2026-08-17", "lowerA")]
    const weeks = consistencyWeeks(workouts, TODAY, "hypertrophy", 1)
    expect(weeks[0].sessions).toBe(2)
    expect(weeks[0].days).toBe(1)
  })
})

describe("consistencySummary", () => {
  it("sem nenhum treino, a lacuna é o período inteiro", () => {
    const s = consistencySummary([], TODAY, "hypertrophy", 12)
    expect(s.daysTrained).toBe(0)
    expect(s.adherencePct).toBe(0)
    expect(s.longestGapDays).toBe(s.daysInPeriod)
    expect(s.daysSinceLift).toBeNull()
    expect(s.weeksOnTarget).toBe(0)
  })

  it("mede a lacuna em dias VAZIOS, não em distância entre sessões", () => {
    // janela de 2 semanas começa em 10/08. Treinou 10, 15 e 20:
    // entre 10 e 15 vão 5 dias de distância, mas só 4 dias vazios (11–14).
    const s = consistencySummary(
      [lift("2026-08-10"), lift("2026-08-15"), lift("2026-08-20")],
      TODAY,
      "hypertrophy",
      2
    )
    expect(s.daysTrained).toBe(3)
    expect(s.longestGapDays).toBe(4)
    expect(s.longestGapFrom).toBe("2026-08-11")
    expect(s.longestGapTo).toBe("2026-08-14")
  })

  it("conta a lacuna ainda aberta até hoje", () => {
    // último treino em 10/08; de 11/08 a 20/08 são 10 dias parado
    const s = consistencySummary([lift("2026-08-10")], TODAY, "hypertrophy", 2)
    expect(s.longestGapDays).toBeGreaterThanOrEqual(10)
    expect(s.daysSinceLift).toBe(10)
    expect(s.daysSinceAny).toBe(10)
  })

  it("dias desde a última sala ignora cardio", () => {
    const s = consistencySummary(
      [lift("2026-08-13"), cardio("2026-08-19")],
      TODAY,
      "hypertrophy",
      2
    )
    expect(s.daysSinceLift).toBe(7)
    expect(s.daysSinceAny).toBe(1)
  })

  it("semanas no alvo conta de trás para frente e para na primeira falha", () => {
    const full = (monday: number, offsetDays: number[]) =>
      offsetDays.map((d, i) =>
        lift(
          `2026-08-${String(monday + d).padStart(2, "0")}`,
          (["upperA", "lowerA", "upperB", "lowerB", "cardioZ2"] as SessionId[])[i]
        )
      )
    const workouts = [
      ...full(3, [0, 1, 2, 3, 4]), // 03–07/08: cumpriu
      ...full(10, [0, 1, 2, 3, 4]), // 10–14/08: cumpriu
      ...full(17, [0, 1, 2, 3, 4]), // 17–21/08: cumpriu (semana corrente)
    ]
    expect(consistencySummary(workouts, TODAY, "hypertrophy", 6).weeksOnTarget).toBe(3)
  })

  it("semana corrente incompleta não zera a série nem infla o número", () => {
    const ids: SessionId[] = ["upperA", "lowerA", "upperB", "lowerB", "cardioZ2"]
    const workouts = [
      ...ids.map((id, i) => lift(`2026-08-${String(10 + i).padStart(2, "0")}`, id)),
      lift("2026-08-17"), // só 1 sessão na semana corrente
    ]
    const s = consistencySummary(workouts, TODAY, "hypertrophy", 4)
    expect(s.weeksOnTarget).toBe(1)
  })

  it("aderência é dias treinados sobre dias corridos do período", () => {
    const s = consistencySummary(
      [lift("2026-08-17"), lift("2026-08-18"), lift("2026-08-19")],
      TODAY,
      "hypertrophy",
      2
    )
    // período: 10/08 a 20/08 = 11 dias
    expect(s.daysInPeriod).toBe(11)
    expect(s.daysTrained).toBe(3)
    expect(s.adherencePct).toBe(27)
  })
})

describe("consistencyInRange", () => {
  it("mede aderência e lacunas de um intervalo arbitrário, sem depender de hoje", () => {
    const range = consistencyInRange(
      [lift("2026-09-01"), lift("2026-09-02"), lift("2026-09-20")],
      "2026-09-01",
      "2026-09-30"
    )
    expect(range.daysTrained).toBe(3)
    expect(range.daysInPeriod).toBe(30)
    expect(range.adherencePct).toBe(10)
    // 17 dias vazios entre 03/09 e 19/09
    expect(range.longestGapDays).toBe(17)
    expect(range.longestGapFrom).toBe("2026-09-03")
    expect(range.longestGapTo).toBe("2026-09-19")
    // a lacuna aberta até o fim do intervalo também entra
    expect(range.gaps).toHaveLength(2)
    expect(range.gaps[1].days).toBe(10)
  })

  it("borda do intervalo conta como lacuna", () => {
    const range = consistencyInRange([lift("2026-09-30")], "2026-09-01", "2026-09-30")
    expect(range.longestGapDays).toBe(29)
    expect(range.longestGapFrom).toBe("2026-09-01")
  })

  it("intervalo sem treino nenhum é uma lacuna inteira", () => {
    const range = consistencyInRange([], "2026-09-01", "2026-09-07")
    expect(range.daysTrained).toBe(0)
    expect(range.adherencePct).toBe(0)
    expect(range.longestGapDays).toBe(7)
  })
})

describe("trainingDayKinds", () => {
  it("classifica cada dia do intervalo e ignora o que está fora", () => {
    const kinds = trainingDayKinds(
      [lift("2026-09-01"), cardio("2026-09-02"), lift("2026-08-20")],
      "2026-09-01",
      "2026-09-30"
    )
    expect(kinds.get("2026-09-01")).toBe("lift")
    expect(kinds.get("2026-09-02")).toBe("cardio")
    expect(kinds.has("2026-08-20")).toBe(false)
  })

  it("dia com sala e cardio vira os dois", () => {
    const kinds = trainingDayKinds(
      [lift("2026-09-01"), cardio("2026-09-01")],
      "2026-09-01",
      "2026-09-01"
    )
    expect(kinds.get("2026-09-01")).toBe("both")
  })
})
