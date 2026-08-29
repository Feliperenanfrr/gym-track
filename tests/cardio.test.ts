import { describe, expect, it } from "vitest"
import {
  cardioBlocks,
  cardioPurposeOf,
  cardioRowsToBlocks,
  describeCardio,
  intenseMinutes,
  normalizeCardioColumns,
  sportMinutes,
  totalCardioMinutes,
  zone2Minutes,
} from "../lib/cardio"
import { CardioRow, SessionId, WorkoutLog } from "../lib/types"

function workout(partial: Partial<WorkoutLog> & { sessionId?: SessionId }): WorkoutLog {
  return {
    id: "w1",
    date: "2026-08-29",
    sessionId: "free",
    entries: [],
    ...partial,
  }
}

/** o dia do usuário: bike, corrida e a caminhada de volta para casa */
const TRES_BLOCOS = workout({
  cardios: [
    { minutes: 15, mode: "Bike ergométrica", purpose: "zone2" },
    { minutes: 15, mode: "Corrida", purpose: "intense" },
    { minutes: 25, mode: "Caminhada", purpose: "zone2" },
  ],
})

describe("cardioBlocks", () => {
  it("lê a lista quando ela existe", () => {
    expect(cardioBlocks(TRES_BLOCOS)).toHaveLength(3)
  })

  it("registro antigo de bloco único vira lista de um", () => {
    const antigo = workout({ cardio: { minutes: 40, mode: "Bike", purpose: "zone2" } })
    expect(cardioBlocks(antigo)).toEqual([{ minutes: 40, mode: "Bike", purpose: "zone2" }])
  })

  it("sem cardio nenhum, lista vazia", () => {
    expect(cardioBlocks(workout({}))).toEqual([])
  })

  it("lista vazia não mascara o bloco antigo", () => {
    const w = workout({ cardios: [], cardio: { minutes: 30, mode: "Bike" } })
    expect(cardioBlocks(w)).toHaveLength(1)
  })
})

describe("minutos por finalidade", () => {
  it("soma cada bloco na sua categoria, sem dupla contagem", () => {
    expect(zone2Minutes(TRES_BLOCOS)).toBe(40)
    expect(intenseMinutes(TRES_BLOCOS)).toBe(15)
    expect(sportMinutes(TRES_BLOCOS)).toBe(0)
    expect(totalCardioMinutes(TRES_BLOCOS)).toBe(55)
  })

  it("bloco sem finalidade herda o tipo da sessão (registros antigos)", () => {
    const jogo = workout({ sessionId: "sport", cardio: { minutes: 60, mode: "Futsal" } })
    expect(sportMinutes(jogo)).toBe(60)
    expect(zone2Minutes(jogo)).toBe(0)

    const bike = workout({ sessionId: "cardioZ2", cardio: { minutes: 40, mode: "Bike" } })
    expect(zone2Minutes(bike)).toBe(40)
  })

  it("cardioPurposeOf respeita a finalidade explícita", () => {
    expect(cardioPurposeOf({ minutes: 10, mode: "Corda", purpose: "intense" }, "sport")).toBe(
      "intense"
    )
  })
})

describe("describeCardio", () => {
  it("descreve cada bloco com modalidade e finalidade", () => {
    expect(describeCardio(TRES_BLOCOS)).toBe(
      "15 min Bike ergométrica (Zona 2) · 15 min Corrida (intenso) · 25 min Caminhada (Zona 2)"
    )
  })

  it("sem cardio, string vazia", () => {
    expect(describeCardio(workout({}))).toBe("")
  })
})

describe("cardioRowsToBlocks", () => {
  const row = (partial: Partial<CardioRow>): CardioRow => ({
    minutes: "",
    bpm: "",
    mode: "Bike ergométrica",
    purpose: "zone2",
    ...partial,
  })

  it("o dia inteiro em blocos separados, na ordem em que foi feito", () => {
    const blocks = cardioRowsToBlocks([
      row({ minutes: "15", bpm: "130", mode: "Bike ergométrica" }),
      row({ minutes: "15", bpm: "155", mode: "Corrida", purpose: "intense" }),
      row({ minutes: "25", bpm: "110", mode: "Caminhada" }),
    ])
    expect(blocks).toEqual([
      { minutes: 15, avgBpm: 130, mode: "Bike ergométrica", purpose: "zone2" },
      { minutes: 15, avgBpm: 155, mode: "Corrida", purpose: "intense" },
      { minutes: 25, avgBpm: 110, mode: "Caminhada", purpose: "zone2" },
    ])
  })

  it("bloco sem minutos é descartado — linha em branco não vira registro", () => {
    expect(cardioRowsToBlocks([row({ minutes: "" }), row({ minutes: "0" })])).toEqual([])
  })

  it("esporte não guarda BPM e modalidade vazia tem rótulo padrão", () => {
    expect(
      cardioRowsToBlocks([row({ minutes: "60", bpm: "150", mode: "  ", purpose: "sport" })])
    ).toEqual([{ minutes: 60, avgBpm: undefined, mode: "Cardio", purpose: "sport" }])
  })

  it("forceZone2 fixa a finalidade da Zona 2 do jiu-jitsu", () => {
    const blocks = cardioRowsToBlocks([row({ minutes: "30", purpose: "intense" })], {
      forceZone2: true,
    })
    expect(blocks[0].purpose).toBe("zone2")
  })
})

describe("normalizeCardioColumns", () => {
  it("coluna nova vence e `cardio` espelha o primeiro bloco", () => {
    const blocks = [
      { minutes: 15, mode: "Bike", purpose: "zone2" as const },
      { minutes: 20, mode: "Corrida", purpose: "intense" as const },
    ]
    expect(normalizeCardioColumns({ minutes: 99, mode: "Antigo" }, blocks)).toEqual({
      cardio: blocks[0],
      cardios: blocks,
    })
  })

  it("linha antiga (só objeto) continua legível", () => {
    const single = { minutes: 40, mode: "Bike", purpose: "zone2" as const }
    expect(normalizeCardioColumns(single, null)).toEqual({
      cardio: single,
      cardios: [single],
    })
  })

  it("nulo dos dois lados → sem cardio", () => {
    expect(normalizeCardioColumns(null, null)).toEqual({
      cardio: undefined,
      cardios: undefined,
    })
  })

  it("descarta lixo do banco em vez de quebrar a tela", () => {
    expect(normalizeCardioColumns({ mode: "sem minutos" }, ["texto solto"])).toEqual({
      cardio: undefined,
      cardios: undefined,
    })
  })
})
