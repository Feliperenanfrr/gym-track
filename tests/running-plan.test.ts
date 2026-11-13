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
  RUNNING_BASE_BENCHMARK,
  RUNNING_RACE_DATE,
  RUNNING_SHOE_NAME,
  RUN_EXERCISES_A,
  RUN_EXERCISES_B,
  formatPace,
  isOverVolumeCeiling,
  isRunningActivityLog,
  runningShoeCount,
  runningTodayView,
  strengthBPhaseFor,
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
    expect(ids).toEqual(["runSession", "runFootA", "runStrengthB", "free", "sport"])

    expect(PLAN_BY_ID.runSession.kind).toBe("cardio")
    expect(PLAN_BY_ID.runFootA.kind).toBe("lift")
    expect(PLAN_BY_ID.runStrengthB.kind).toBe("lift")

    expect(countsTowardProgramTarget("runSession", "running")).toBe(true)
    expect(countsTowardProgramTarget("runStrengthB", "running")).toBe(true)
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

  it("todos os exercícios de Rotina A e B possuem grupo muscular mapeado", () => {
    for (const exercise of [...RUN_EXERCISES_A, ...RUN_EXERCISES_B]) {
      expect(EXERCISE_GROUP[exercise.id]).toBeDefined()
    }
  })
})
