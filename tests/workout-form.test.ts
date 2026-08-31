import { describe, expect, it } from "vitest"
import { PLAN_BY_ID } from "../lib/plan"
import { loggedLiftMinutes, openLogForEditing } from "../lib/workout-form"
import { WorkoutLog } from "../lib/types"

const UPPER_A = PLAN_BY_ID.upperA
const FREE = PLAN_BY_ID.free

const saved: WorkoutLog = {
  id: "log-1",
  date: "2026-08-31",
  sessionId: "upperA",
  durationMin: 70,
  startedAt: "2026-08-31T10:00:00.000Z",
  srpe: 7,
  notes: "ombro reclamando",
  entries: [
    {
      exerciseId: "pulldown",
      exerciseName: "Puxada alta ou barra fixa",
      sets: [
        { weight: 50, reps: 12, rir: 1 },
        { weight: 50, reps: 10 },
      ],
    },
  ],
  cardios: [{ minutes: 15, mode: "Bike ergométrica", purpose: "zone2", avgBpm: 130 }],
}

describe("openLogForEditing", () => {
  it("devolve as séries salvas já marcadas como feitas", () => {
    const opened = openLogForEditing(saved, UPPER_A)
    expect(opened.rows.pulldown).toEqual([
      { weight: "50", reps: "12", done: true, rir: "1" },
      { weight: "50", reps: "10", done: true, rir: "" },
    ])
  })

  it("o registro manda no número de séries, não a prescrição", () => {
    const opened = openLogForEditing(saved, UPPER_A)
    expect(UPPER_A.exercises.find((ex) => ex.id === "pulldown")?.sets).toBe(3)
    expect(opened.exercises[0].sets).toBe(2)
    expect(opened.exercises[0].name).toBe("Puxada alta ou barra fixa")
  })

  it("traz cardio e notas de volta", () => {
    const opened = openLogForEditing(saved, UPPER_A)
    expect(opened.cardioRows).toEqual([
      { minutes: "15", bpm: "130", mode: "Bike ergométrica", purpose: "zone2" },
    ])
    expect(opened.notes).toBe("ombro reclamando")
  })

  it("exercício fora do plano sobrevive pelo nome gravado no avulso", () => {
    const avulso: WorkoutLog = {
      id: "log-2",
      date: "2026-08-31",
      sessionId: "free",
      entries: [
        {
          exerciseId: "custom-complexo",
          exerciseName: "Complexo com halteres",
          muscleGroup: "Ombro",
          sets: [{ weight: 0, reps: 15 }],
        },
      ],
    }
    const opened = openLogForEditing(avulso, FREE)
    expect(opened.exercises[0]).toMatchObject({
      id: "custom-complexo",
      name: "Complexo com halteres",
      muscleGroup: "Ombro",
      sets: 1,
    })
    expect(opened.rows["custom-complexo"][0].weight).toBe("")
  })
})

describe("loggedLiftMinutes", () => {
  it("desconta os blocos de cardio da duração total", () => {
    expect(loggedLiftMinutes(saved)).toBe(55)
  })

  it("registro retroativo sem duração não inventa minutos", () => {
    expect(loggedLiftMinutes({ ...saved, durationMin: undefined })).toBe(0)
  })
})
