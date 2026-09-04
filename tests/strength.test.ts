import { describe, expect, it } from "vitest"
import {
  exerciseStrength,
  frequentExercises,
  stagnationBoard,
} from "../lib/strength"
import { ExerciseLog, WorkoutLog } from "../lib/types"

const TODAY = new Date(2026, 7, 20)

function workout(date: string, entries: ExerciseLog[]): WorkoutLog {
  return { id: `w-${date}`, date, sessionId: "upperA", entries }
}

describe("frequentExercises", () => {
  it("ordena pelos exercícios com mais séries na janela", () => {
    const workouts = [
      workout("2026-08-10", [
        { exerciseId: "crossover", sets: [{ weight: 50, reps: 12 }, { weight: 50, reps: 12 }] },
        { exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] },
      ]),
      workout("2026-08-17", [
        { exerciseId: "crossover", sets: [{ weight: 55, reps: 12 }] },
      ]),
    ]
    const list = frequentExercises(workouts, TODAY)
    expect(list[0].id).toBe("crossover")
    expect(list[0].sets).toBe(3)
    expect(list[0].sessions).toBe(2)
    expect(list[1].id).toBe("bench")
  })

  it("ignora séries sem carga — isometria não fala de progressão de carga", () => {
    const workouts = [
      workout("2026-08-17", [
        { exerciseId: "plank", sets: [{ weight: 0, reps: 60 }] },
        { exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] },
      ]),
    ]
    const list = frequentExercises(workouts, TODAY)
    expect(list.map((e) => e.id)).toEqual(["bench"])
  })

  it("respeita a janela e o limite", () => {
    const workouts = [
      workout("2026-01-05", [{ exerciseId: "squat", sets: [{ weight: 100, reps: 5 }] }]),
      workout("2026-08-17", [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }]),
    ]
    expect(frequentExercises(workouts, TODAY).map((e) => e.id)).toEqual(["bench"])
    expect(frequentExercises(workouts, TODAY, { days: 365, limit: 1 })).toHaveLength(1)
  })

  it("preserva o nome gravado no log (substituições e avulsos)", () => {
    const workouts = [
      workout("2026-08-17", [
        {
          exerciseId: "custom-1",
          exerciseName: "Máquina peitoral do canto",
          sets: [{ weight: 40, reps: 12 }],
        },
      ]),
    ]
    expect(frequentExercises(workouts, TODAY)[0].name).toBe("Máquina peitoral do canto")
  })
})

describe("exerciseStrength", () => {
  const workouts = [
    workout("2026-06-10", [
      { exerciseId: "bench", sets: [{ weight: 60, reps: 5 }, { weight: 55, reps: 8 }] },
    ]),
    workout("2026-07-01", [
      { exerciseId: "bench", sets: [{ weight: 65, reps: 5, rir: 1 }] },
    ]),
    workout("2026-08-01", [
      { exerciseId: "bench", sets: [{ weight: 65, reps: 12, rir: 2 }] },
    ]),
  ]

  it("usa a carga da série mais pesada, não a estimativa", () => {
    const s = exerciseStrength(workouts, "bench")
    expect(s.points.map((p) => p.carga)).toEqual([60, 65, 65])
    expect(s.points[0].reps).toBe(5)
    expect(s.bestWeight).toBe(65)
    expect(s.deltaKg).toBe(5)
  })

  it("só calcula 1RM onde Epley se sustenta: até 8 reps efetivas", () => {
    const s = exerciseStrength(workouts, "bench")
    // 60×5 (eff 5) e 65×5 @RIR1 (eff 6) entram; 65×12 @RIR2 (eff 14) não
    expect(s.points[0].e1rm).toBe(70)
    expect(s.points[1].e1rm).toBe(78)
    expect(s.points[2].e1rm).toBeNull()
    expect(s.reliableE1rmPoints).toBe(2)
  })

  it("marca a sessão que superou a maior carga anterior", () => {
    const s = exerciseStrength(workouts, "bench")
    expect(s.points.map((p) => p.isLoadPr)).toEqual([false, true, false])
  })

  it("conta sessões desde o último aumento de carga", () => {
    const s = exerciseStrength(workouts, "bench")
    expect(s.sessionsSinceIncrease).toBe(1)
  })

  it("carga que nunca subiu devolve null, não zero", () => {
    const flat = [
      workout("2026-07-01", [{ exerciseId: "pulldown", sets: [{ weight: 50, reps: 8 }] }]),
      workout("2026-08-01", [{ exerciseId: "pulldown", sets: [{ weight: 50, reps: 8 }] }]),
    ]
    expect(exerciseStrength(flat, "pulldown").sessionsSinceIncrease).toBeNull()
  })

  it("exercício sem registro devolve série vazia sem quebrar", () => {
    const s = exerciseStrength(workouts, "deadlift")
    expect(s.points).toHaveLength(0)
    expect(s.first).toBeNull()
    expect(s.last).toBeNull()
    expect(s.deltaKg).toBeNull()
    expect(s.bestWeight).toBe(0)
  })

  it("ordena por data mesmo com registros fora de ordem", () => {
    const s = exerciseStrength([...workouts].reverse(), "bench")
    expect(s.points.map((p) => p.date)).toEqual([
      "2026-06-10",
      "2026-07-01",
      "2026-08-01",
    ])
  })

  it("desempata o top set pelas repetições quando a carga é igual", () => {
    const s = exerciseStrength(
      [workout("2026-08-17", [
        { exerciseId: "row", sets: [{ weight: 50, reps: 6 }, { weight: 50, reps: 10 }] },
      ])],
      "row"
    )
    expect(s.points[0].reps).toBe(10)
  })
})

describe("stagnationBoard", () => {
  const workouts = [
    // supino: 60 → 60 → 60, nunca subiu
    workout("2026-06-10", [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }]),
    workout("2026-07-01", [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }]),
    workout("2026-08-01", [{ exerciseId: "bench", sets: [{ weight: 60, reps: 8 }] }]),
    // remada: 40 → 45 → 45 → 45, parada há 2 sessões
    workout("2026-06-11", [{ exerciseId: "row", sets: [{ weight: 40, reps: 8 }] }]),
    workout("2026-06-20", [{ exerciseId: "row", sets: [{ weight: 45, reps: 8 }] }]),
    workout("2026-07-05", [{ exerciseId: "row", sets: [{ weight: 45, reps: 8 }] }]),
    workout("2026-08-05", [{ exerciseId: "row", sets: [{ weight: 45, reps: 8 }] }]),
    // rosca: 20 → 25, subiu na última
    workout("2026-07-02", [{ exerciseId: "curl", sets: [{ weight: 20, reps: 10 }] }]),
    workout("2026-08-10", [{ exerciseId: "curl", sets: [{ weight: 25, reps: 10 }] }]),
    // agachamento: uma sessão só — abaixo do mínimo
    workout("2026-08-11", [{ exerciseId: "squat", sets: [{ weight: 100, reps: 5 }] }]),
  ]

  it("ordena por gravidade: quem nunca subiu vem primeiro", () => {
    const board = stagnationBoard(workouts, TODAY)
    expect(board[0].exerciseId).toBe("bench")
    expect(board[0].sessionsSinceIncrease).toBeNull()
  })

  it("depois dos 'nunca', ordena por sessões paradas em ordem decrescente", () => {
    const board = stagnationBoard(workouts, TODAY)
    const semNunca = board.filter((r) => r.sessionsSinceIncrease !== null)
    expect(semNunca.map((r) => r.exerciseId)).toEqual(["row", "curl"])
    expect(semNunca[0].sessionsSinceIncrease).toBe(2)
    expect(semNunca[1].sessionsSinceIncrease).toBe(0)
  })

  it("null e zero são estados diferentes, não o mesmo ponto", () => {
    const board = stagnationBoard(workouts, TODAY)
    const bench = board.find((r) => r.exerciseId === "bench")
    const curl = board.find((r) => r.exerciseId === "curl")
    expect(bench?.sessionsSinceIncrease).toBeNull()
    expect(curl?.sessionsSinceIncrease).toBe(0)
  })

  it("exercício abaixo de minSessions fica de fora", () => {
    const board = stagnationBoard(workouts, TODAY)
    expect(board.map((r) => r.exerciseId)).not.toContain("squat")
    expect(stagnationBoard(workouts, TODAY, { minSessions: 1 }).length).toBe(4)
  })

  it("respeita a janela e o limite", () => {
    expect(stagnationBoard(workouts, TODAY, { limit: 2 })).toHaveLength(2)
    // janela de 12 dias (09/08 a 20/08) deixa fora supino (01/08) e remada (05/08)
    const curto = stagnationBoard(workouts, TODAY, { days: 12, minSessions: 1 })
    expect(curto.map((r) => r.exerciseId).sort()).toEqual(["curl", "squat"])
    // dentro dessa janela a rosca tem uma sessão só: vira base, não aumento
    expect(curto.find((r) => r.exerciseId === "curl")?.sessionsSinceIncrease).toBeNull()
  })

  it("carrega carga da última sessão e a melhor do período", () => {
    const row = stagnationBoard(workouts, TODAY).find((r) => r.exerciseId === "row")
    expect(row).toMatchObject({ lastWeight: 45, bestWeight: 45, sessions: 4 })
  })

  it("sem histórico devolve lista vazia", () => {
    expect(stagnationBoard([], TODAY)).toHaveLength(0)
  })
})
