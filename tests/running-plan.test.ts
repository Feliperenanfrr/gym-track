import { describe, expect, it } from "vitest"
import { weeklySessionTarget } from "../lib/consistency"
import { isStrengthLog } from "../lib/cycle"
import { EXERCISE_GROUP } from "../lib/muscles"
import {
  PLAN_BY_ID,
  countsTowardProgramTarget,
  countsTowardTrainingTarget,
  planForProgram,
} from "../lib/plan"
import {
  RUNNING_ALT_SHOE_NAME,
  RUNNING_BASE_BENCHMARK,
  RUNNING_RACE_DATE,
  RUNNING_SHOE_NAME,
  RUNNING_SHOE_OPTIONS,
  RUN_EXERCISES_A,
  RUN_EXERCISES_B,
  RUN_EXERCISES_C1,
  RUN_EXERCISES_C2,
  formatPace,
  isOverVolumeCeiling,
  isRunningActivityLog,
  runExplicitShoe,
  runningChartData,
  runningShoeCount,
  runningTodayView,
  strengthBPhaseFor,
  strengthCPhaseFor,
} from "../lib/running-plan"
import { CardioLog, SessionId, WorkoutLog } from "../lib/types"
import { fromDateKey } from "../lib/utils"

function makeWorkout(
  date: string,
  sessionId: SessionId,
  cardioOverrides?: Partial<CardioLog>,
  idSuffix = "1"
): WorkoutLog {
  const cardio: CardioLog | undefined =
    cardioOverrides !== undefined
      ? {
          minutes: cardioOverrides.minutes ?? 35,
          mode: cardioOverrides.mode ?? "Corrida",
          purpose: cardioOverrides.purpose ?? "zone2",
          ...cardioOverrides,
        }
      : undefined

  return {
    id: `${date}-${sessionId}-${idSuffix}`,
    date,
    sessionId,
    durationMin: cardio?.minutes,
    entries: [],
    ...(cardio ? { cardios: [cardio], cardio } : {}),
  }
}

describe("running-plan · progressão adaptativa", () => {
  it("inicia no estágio 1/2 × 8 em 07/11 sem histórico", () => {
    const view = runningTodayView([], fromDateKey("2026-11-07"))
    expect(view.nextStage.id).toBe("1-2x8")
    expect(view.daysUntilRace).toBe(21)
    expect(view.runDoneToday).toBe(false)
    expect(view.footADoneToday).toBe(false)
    expect(view.strengthBDoneToday).toBe(false)
    expect(view.benchmarks.base.paceLabel).toBe(RUNNING_BASE_BENCHMARK.paceLabel)
  })

  it("avança degrau quando estágio é concluído dentro do teto e com dor <= 3", () => {
    const logs = [
      makeWorkout("2026-11-07", "runSession", {
        minutes: 34,
        runStageId: "1-2x8",
        painScore: 2,
      }),
    ]
    const view = runningTodayView(logs, fromDateKey("2026-11-09"))
    expect(view.nextStage.id).toBe("2-2x6")
    expect(view.repeatReason).toBeNull()
    expect(view.pendingPainCheckIn).toBe(false)
  })

  it("trava progressão se dor > 3/10 ou se usar caminhada de proteção", () => {
    const highPainLogs = [
      makeWorkout("2026-11-07", "runSession", { minutes: 34, runStageId: "1-2x8", painScore: 1 }),
      makeWorkout("2026-11-09", "runSession", { minutes: 34, runStageId: "2-2x6", painScore: 4 }),
    ]
    const painView = runningTodayView(highPainLogs, fromDateKey("2026-11-11"))
    expect(painView.repeatReason).toBe("pain")
    expect(painView.nextStage.id).toBe("2-2x6")

    const walkSubLogs = [
      ...highPainLogs.slice(0, 1),
      makeWorkout("2026-11-09", "runSession", { minutes: 30, runStageId: "walk-sub", painScore: 2 }),
    ]
    const walkView = runningTodayView(walkSubLogs, fromDateKey("2026-11-11"))
    expect(walkView.repeatReason).toBe("walk-sub")
    expect(walkView.nextStage.id).toBe("2-2x6")
  })

  it("detecta estouro de teto (ex.: 81 min em 09/11) e segura o degrau sem bloquear", () => {
    expect(isOverVolumeCeiling("1-2x8", 43)).toBe(false)
    expect(isOverVolumeCeiling("2-2x6", 81)).toBe(true)

    const logs = [
      makeWorkout("2026-11-07", "strava", {
        minutes: 43,
        durationSeconds: 43 * 60 + 6,
        distanceKm: 4.59,
      }),
      makeWorkout("2026-11-09", "strava", {
        minutes: 81,
        durationSeconds: 81 * 60,
        distanceKm: 8.82,
      }),
    ]

    const view = runningTodayView(logs, fromDateKey("2026-11-10"))
    expect(view.lastRun?.overCeiling).toBe(true)
    expect(view.repeatReason).toBe("over-ceiling")
    expect(view.nextStage.id).toBe("2-2x6")
    expect(view.restDayRecommended).toBe(true)
    expect(view.pendingPainCheckIn).toBe(true)
  })

  it("lê histórico real do Strava >= 07/11 ignorando registros anteriores e conta sessões do Corre Max 2", () => {
    const logs = [
      makeWorkout("2026-11-05", "strava", { minutes: 25, distanceKm: 2.1 }),
      makeWorkout("2026-11-07", "strava", {
        minutes: 43,
        durationSeconds: 43 * 60 + 6,
        distanceKm: 4.59,
      }),
      makeWorkout("2026-11-09", "strava", {
        minutes: 81,
        durationSeconds: 81 * 60,
        distanceKm: 8.82,
      }),
      makeWorkout("2026-11-11", "strava", {
        minutes: 27,
        durationSeconds: 27 * 60,
        distanceKm: 2.24,
      }),
    ]

    expect(isRunningActivityLog(logs[0])).toBe(false)
    expect(isRunningActivityLog(logs[1])).toBe(true)
    expect(runningShoeCount(logs, "2026-11-13")).toBe(2)

    const withAltShoeOnNov06 = [
      makeWorkout("2026-11-06", "strava", {
        minutes: 42,
        distanceKm: 4.67,
        shoe: RUNNING_ALT_SHOE_NAME,
        runStageId: "1-2x8",
      }),
      ...logs.slice(2),
    ]
    expect(isRunningActivityLog(withAltShoeOnNov06[0])).toBe(true)
    expect(runExplicitShoe(withAltShoeOnNov06[0])).toBe("Fila Lite Progress")
    expect(runningShoeCount(withAltShoeOnNov06, "2026-11-13")).toBe(2)
    expect(RUNNING_SHOE_OPTIONS).toEqual([RUNNING_SHOE_NAME, RUNNING_ALT_SHOE_NAME])

    const view = runningTodayView(logs, fromDateKey("2026-11-13"))
    expect(view.totalRuns).toBe(3)
    expect(view.totalDistanceKm).toBe(15.65)
    expect(view.shoeName).toBe(RUNNING_SHOE_NAME)
    expect(view.shoeSessions).toBe(2)
    expect(view.nextStage.id).toBe("2-1x8")
    expect(view.restDayRecommended).toBe(false)
  })

  it("coexiste corrida + Rotina A + Rotina B no mesmo dia e identifica ensaio/prova", () => {
    const logs = [
      makeWorkout("2026-11-13", "runSession", {
        minutes: 34,
        distanceKm: 3.6,
        runStageId: "2-1x8",
        painScore: 1,
      }),
      makeWorkout("2026-11-13", "runFootA"),
      makeWorkout("2026-11-13", "runStrengthB"),
      makeWorkout("2026-11-21", "runSession", {
        minutes: 47,
        durationSeconds: 47 * 60,
        distanceKm: 5.02,
        runStageId: "ensaio-5k",
        segmentTimeSec: 15 * 60 + 10,
        painScore: 2,
      }),
    ]

    const day13 = runningTodayView(logs, fromDateKey("2026-11-13"))
    expect(day13.runDoneToday).toBe(true)
    expect(day13.footADoneToday).toBe(true)
    expect(day13.strengthBDoneToday).toBe(true)

    const raceDay = runningTodayView(logs, fromDateKey(RUNNING_RACE_DATE))
    expect(raceDay.daysUntilRace).toBe(0)
    expect(raceDay.nextStage.id).toBe("prova-5k")
    expect(raceDay.benchmarks.rehearsal?.distanceKm).toBe(5.02)
    expect(raceDay.benchmarks.rehearsal?.segmentTimeSec).toBe(15 * 60 + 10)
    expect(formatPace(43 * 60 + 6, 4.59)).toBe("9:23/km")
  })

  it("ajusta polimento pré-prova e orientação da Rotina B por semana", () => {
    const taperView = runningTodayView([], fromDateKey("2026-11-26"))
    expect(taperView.taperActive).toBe(true)
    expect(taperView.nextStage.id).toBe("2-1x5-leve")

    expect(strengthBPhaseFor(fromDateKey("2026-11-08")).id).toBe("adapt")
    expect(strengthBPhaseFor(fromDateKey("2026-11-13")).id).toBe("build")
    expect(strengthBPhaseFor(fromDateKey("2026-11-21")).id).toBe("unilateral")
    expect(strengthBPhaseFor(fromDateKey("2026-11-23")).id).toBe("taper-light")
    expect(strengthBPhaseFor(fromDateKey("2026-11-25")).recommended).toBe(false)
  })
})

describe("integração do programa running no domínio existente", () => {
  it("expõe sessões no plano running sem interferir nos demais programas", () => {
    const ids = planForProgram("running").map((s) => s.id)
    expect(ids).toEqual([
      "runSession",
      "runFootA",
      "runStrengthB",
      "runStrengthC1",
      "runStrengthC2",
      "free",
      "sport",
    ])

    expect(PLAN_BY_ID.runSession.kind).toBe("cardio")
    expect(PLAN_BY_ID.runFootA.kind).toBe("lift")
    expect(PLAN_BY_ID.runStrengthB.kind).toBe("lift")
    expect(PLAN_BY_ID.runStrengthC1.kind).toBe("lift")
    expect(PLAN_BY_ID.runStrengthC2.kind).toBe("lift")

    expect(countsTowardProgramTarget("runSession", "running")).toBe(true)
    expect(countsTowardProgramTarget("runStrengthB", "running")).toBe(true)
    expect(countsTowardProgramTarget("runStrengthC1", "running")).toBe(true)
    expect(countsTowardProgramTarget("runStrengthC2", "running")).toBe(true)
    expect(countsTowardProgramTarget("strava", "running")).toBe(true)
    expect(countsTowardProgramTarget("runFootA", "running")).toBe(false)
    expect(countsTowardProgramTarget("upperA", "running")).toBe(false)

    expect(countsTowardProgramTarget("strava", "performance")).toBe(false)
    expect(countsTowardTrainingTarget("runSession")).toBe(true)
    expect(countsTowardTrainingTarget("runFootA")).toBe(false)
    expect(weeklySessionTarget("running", fromDateKey("2026-11-09"))).toBe(5)
  })

  it("Rotina A diária nunca dispara regra de musculação consecutiva em cycle.ts", () => {
    const footWorkout: WorkoutLog = {
      id: "foot-1",
      date: "2026-11-13",
      sessionId: "runFootA",
      entries: [{ exerciseId: "foot-short", sets: [{ weight: 0, reps: 10 }] }],
    }
    expect(isStrengthLog(footWorkout)).toBe(false)
  })

  it("todos os exercícios de Rotina A, B, C1 e C2 possuem grupo muscular mapeado", () => {
    for (const exercise of [
      ...RUN_EXERCISES_A,
      ...RUN_EXERCISES_B,
      ...RUN_EXERCISES_C1,
      ...RUN_EXERCISES_C2,
    ]) {
      expect(EXERCISE_GROUP[exercise.id]).toBeDefined()
    }
  })

  it("aplica plano atualizado em 14/11 (dor 5/10 trava 3/1×7, ativa C1/C2 e alerta ritmo < 7:30/km)", () => {
    const nov14Logs = [
      makeWorkout("2026-11-14", "runSession", {
        minutes: 41,
        durationSeconds: 2475,
        distanceKm: 4.58,
        runStageId: "3-1x7",
        painScore: 5,
        gpx: {
          movingSeconds: 2475,
          elapsedSeconds: 2520,
          splits: [{ km: 1, label: "1", distanceKm: 1, secPerKm: 487 }],
          runWalk: {
            troteMinutes: 19,
            walkMinutes: 22,
            fastTroteMinutes: 10,
            troteBouts: 14,
            avgTroteSec: 80,
            longestTroteSec: 210,
            trotePct: 47,
          },
        },
      }),
    ]

    const view14 = runningTodayView(nov14Logs, fromDateKey("2026-11-14"))
    expect(view14.runDoneToday).toBe(true)
    expect(view14.repeatReason).toBe("pain")
    expect(view14.nextStage.id).toBe("3-1x7")
    expect(view14.nextStrengthC).toBe("runStrengthC1")
    expect(view14.fastTroteAlert).toEqual({ minutes: 10, date: "2026-11-14" })
    expect(view14.strengthBGuidance.setsAdvice).toContain("ex. 1")
    expect(view14.todayPlan?.strengthLabel).toContain("C1")

    expect(strengthBPhaseFor(fromDateKey("2026-11-14")).id).toBe("build")
    expect(strengthCPhaseFor(fromDateKey("2026-11-14")).sessionId).toBe("runStrengthC1")
    expect(strengthCPhaseFor(fromDateKey("2026-11-16")).sessionId).toBe("runStrengthC2")
    expect(strengthCPhaseFor(fromDateKey("2026-11-21")).setsAdvice).toContain("2 séries")
    expect(strengthCPhaseFor(fromDateKey("2026-11-23")).recommended).toBe(false)

    const view22 = runningTodayView(nov14Logs, fromDateKey("2026-11-22"))
    expect(view22.heavyLegCutActive).toBe(true)
    expect(view22.todayPlan?.focus).toBe("rehearsal")
  })

  it("gera séries semanais, pace/janelas, mix trote-caminhada, dor/tênis e splits GPX em runningChartData", () => {
    const logs = [
      makeWorkout("2026-11-06", "strava", {
        minutes: 42,
        durationSeconds: 2543,
        distanceKm: 4.67,
        shoe: RUNNING_ALT_SHOE_NAME,
        runStageId: "1-2x8",
        painScore: 2,
        gpx: {
          movingSeconds: 2543,
          elapsedSeconds: 2586,
          splits: [
            { km: 1, label: "1", distanceKm: 1, secPerKm: 555 },
            { km: 2, label: "2", distanceKm: 1, secPerKm: 518 },
          ],
          bestWindowsSec: { km1: 468 },
          runWalk: {
            troteMinutes: 19,
            walkMinutes: 23,
            fastTroteMinutes: 12,
            troteBouts: 16,
            avgTroteSec: 70,
            longestTroteSec: 212,
            trotePct: 46,
          },
          splitTrend: "positive",
        },
      }),
      makeWorkout("2026-11-09", "strava", {
        minutes: 81,
        durationSeconds: 4882,
        distanceKm: 8.94,
        shoe: RUNNING_SHOE_NAME,
        runStageId: "2-1x8",
        painScore: 4,
        gpx: {
          movingSeconds: 4882,
          elapsedSeconds: 4998,
          splits: [
            { km: 1, label: "1", distanceKm: 1, secPerKm: 520 },
            { km: 2, label: "2", distanceKm: 1, secPerKm: 490 },
          ],
          bestWindowsSec: { km1: 469, km5: 2757 },
          runWalk: {
            troteMinutes: 31,
            walkMinutes: 50,
            fastTroteMinutes: 23,
            troteBouts: 22,
            avgTroteSec: 83,
            longestTroteSec: 231,
            trotePct: 39,
          },
          splitTrend: "negative",
        },
      }),
    ]

    const charts = runningChartData(logs, fromDateKey("2026-11-13"))
    expect(charts.weeklyVolume).toHaveLength(6)
    const nov02Week = charts.weeklyVolume.find((w) => w.weekStart === "2026-11-02")
    const nov09Week = charts.weeklyVolume.find((w) => w.weekStart === "2026-11-09")
    expect(nov02Week?.distanceKm).toBe(4.67)
    expect(nov09Week?.distanceKm).toBe(8.94)
    expect(nov09Week?.current).toBe(true)

    expect(charts.sessions).toHaveLength(2)
    expect(charts.sessions[0]).toMatchObject({
      label: "06/11",
      controlledTroteMinutes: 7,
      fastTroteMinutes: 12,
      walkMinutes: 23,
      painScore: 2,
      shoe: RUNNING_ALT_SHOE_NAME,
      overCeiling: false,
      best1kSecPerKm: 468,
    })
    expect(charts.sessions[1]).toMatchObject({
      label: "09/11",
      best5kSec: 2757,
      best5kPaceSecPerKm: 551,
      painScore: 4,
      shoe: RUNNING_SHOE_NAME,
      overCeiling: true,
    })

    expect(charts.latestGpxSplits?.fastestKm).toBe(2)
    expect(charts.latestGpxSplits?.splitTrend).toBe("negative")
  })
})
