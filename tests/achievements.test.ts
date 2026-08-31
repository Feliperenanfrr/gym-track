import { describe, expect, it } from "vitest"
import { computeAchievements } from "../lib/achievements"
import { ENGINE_WEEKLY_VOLUME } from "../lib/engine-plan"
import { GymData, SessionId, WorkoutLog } from "../lib/types"

const EMPTY_DATA: GymData = { workouts: [], body: [], hydration: [], sleep: [] }
const CYCLE_END = new Date(2026, 10, 22)

function cycleDate(week: number, day: number): string {
  const date = new Date(2026, 7, 31 + (week - 1) * 7 + day)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

function workout(
  week: number,
  day: number,
  sessionId: SessionId,
  zone2 = 0,
  intense = 0
): WorkoutLog {
  const cardios = [
    ...(zone2 > 0 ? [{ minutes: zone2, mode: "Bike", purpose: "zone2" as const }] : []),
    ...(intense > 0 ? [{ minutes: intense, mode: "Bike", purpose: "intense" as const }] : []),
  ]
  return {
    id: `${week}-${day}-${sessionId}`,
    date: cycleDate(week, day),
    sessionId,
    entries: [],
    cardios,
  }
}

function completeCycle(): GymData {
  const workouts: WorkoutLog[] = []
  for (const target of ENGINE_WEEKLY_VOLUME) {
    const week = target.week
    const z2Target = week <= 4 ? target.cardio : week <= 8 ? 120 : 165
    const z2Parts = week <= 4 || target.easy ? 3 : 2
    const z2PerSession = Math.floor(z2Target / z2Parts)
    const z2Remainder = z2Target - z2PerSession * (z2Parts - 1)

    workouts.push(workout(week, 0, "engineForceA"))
    workouts.push(workout(week, 1, "engineForceB"))
    for (let index = 0; index < z2Parts; index++) {
      workouts.push(
        workout(week, index + 2, "engineZ2", index === z2Parts - 1 ? z2Remainder : z2PerSession)
      )
    }

    if (week === 1) workouts.push(workout(week, 6, "engineHome"))
    if (week >= 5) {
      workouts.push(workout(week, 5, "engineMotor", 0, target.easy ? 15 : 20))
      if (!target.easy) workouts.push(workout(week, 6, "engineIntervals", 0, 20))
    }
  }
  return { ...EMPTY_DATA, workouts }
}

function achievement(data: GymData, id: string) {
  return computeAchievements(data, CYCLE_END).find((item) => item.id === id)!
}

describe("conquistas do ciclo de motor", () => {
  it("desbloqueia os marcos de uma execução consistente do ciclo", () => {
    const data = completeCycle()
    const ids = [
      "engine-foundation",
      "engine-week-on-track",
      "engine-force-pair",
      "engine-home",
      "engine-motor-unlocked",
      "engine-power-week",
      "engine-deload",
      "engine-z2-streak",
      "engine-z2-1500",
      "engine-intense-120",
      "engine-strength-8of10",
      "engine-hybrid-8of10",
      "engine-cycle-10of12",
    ]

    for (const id of ids) expect(achievement(data, id).unlocked).toBe(true)
  })

  it("não considera intenso precoce como parte da Fundação nem desbloqueia o 4×4", () => {
    const workouts: WorkoutLog[] = []
    for (let week = 1; week <= 4; week++) {
      const target = ENGINE_WEEKLY_VOLUME[week - 1].cardio
      workouts.push(workout(week, 0, "engineZ2", target))
    }
    workouts.push(workout(1, 1, "engineMotor", 0, 20))
    const data = { ...EMPTY_DATA, workouts }

    expect(achievement(data, "engine-foundation").current).toBe(3)
    expect(achievement(data, "engine-foundation").unlocked).toBe(false)
    expect(achievement(data, "engine-motor-unlocked").unlocked).toBe(false)
  })

  it("exige sessões e Zona 2 para considerar uma semana no trilho", () => {
    const data = {
      ...EMPTY_DATA,
      workouts: [workout(1, 0, "engineZ2", ENGINE_WEEKLY_VOLUME[0].cardio)],
    }

    expect(achievement(data, "engine-week-on-track").unlocked).toBe(false)
  })
})
