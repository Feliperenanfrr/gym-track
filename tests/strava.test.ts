import { describe, expect, it } from "vitest"
import {
  formatActivityDuration,
  parseActivityDuration,
  parseStravaCsv,
  toStravaCardioLog,
} from "../lib/strava"

describe("parseActivityDuration", () => {
  it("entende os formatos exibidos pelo Strava e relógio CSV", () => {
    expect(parseActivityDuration("1h 3min")).toBe(3780)
    expect(parseActivityDuration("18min 12s")).toBe(1092)
    expect(parseActivityDuration("00:18:51")).toBe(1131)
    expect(parseActivityDuration("18:51")).toBe(1131)
    expect(parseActivityDuration("63", "Tempo (min)")).toBe(3780)
    expect(parseActivityDuration("1092", "Elapsed Time")).toBe(1092)
  })
})

describe("parseStravaCsv", () => {
  it("importa em tabela as três atividades das imagens", () => {
    const csv = `Data;Hora;Tipo;Título;Distância (km);Tempo;Passos;Ganho de elevação (m);Local
05/08/2026;08:48;Caminhada;Caminhada matinal;5,62;1h 3min;6.870;;Campina Grande, Paraíba
19/08/2026;15:25;Caminhada;Caminhada vespertina;1,61;18min 12s;;45;Campina Grande, Paraíba
23/08/2026;11:39;Caminhada;Caminhada na hora do almoço;1,58;18min 51s;2.028;;Campina Grande, Paraíba`

    const result = parseStravaCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.activities).toHaveLength(3)
    expect(result.activities[0]).toMatchObject({
      date: "2026-08-05",
      startTime: "08:48",
      type: "walk",
      title: "Caminhada matinal",
      distanceKm: 5.62,
      durationSeconds: 3780,
      steps: 6870,
      location: "Campina Grande, Paraíba",
    })
    expect(result.activities[1].elevationGainM).toBe(45)
    expect(result.activities[2].steps).toBe(2028)
  })

  it("aceita formato vertical e infere caminhada pelo título", () => {
    const csv = `Métrica;Valor;Unidade
Data;5 de agosto de 2026 às 08:48;
Título;Caminhada matinal;
Distância;5,62;km
Tempo;1h 3min;
Passos;6.870;`
    const result = parseStravaCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.activities[0]).toMatchObject({
      date: "2026-08-05",
      startTime: "08:48",
      type: "walk",
      durationSeconds: 3780,
      distanceKm: 5.62,
      steps: 6870,
    })
  })

  it("aceita cabeçalhos do activities.csv oficial em inglês", () => {
    const csv = `Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Elevation Gain
"Aug 19, 2026, 3:25:00 PM",Evening Run,Run,1800,5.2,32`
    const result = parseStravaCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.activities[0]).toMatchObject({
      date: "2026-08-19",
      startTime: "15:25",
      type: "run",
      durationSeconds: 1800,
      distanceKm: 5.2,
      elevationGainM: 32,
    })
  })

  it("deduplica linhas idênticas e rejeita modalidades fora do escopo", () => {
    const header = "Data;Tipo;Título;Distância (km);Tempo"
    const row = "23/08/2026;Caminhada;Caminhada;1,58;18min 51s"
    const duplicate = parseStravaCsv(`${header}\n${row}\n${row}`)
    expect(duplicate.activities).toHaveLength(1)
    expect(duplicate.warnings).toHaveLength(1)

    const bike = parseStravaCsv(`${header}\n23/08/2026;Pedalada;Bike;10;30min`)
    expect(bike.activities).toHaveLength(0)
    expect(bike.errors[0]).toContain("Caminhada/Walk ou Corrida/Run")
  })
})

describe("toStravaCardioLog", () => {
  it("preserva os parâmetros brutos para cálculo e reimportação segura", () => {
    const activity = parseStravaCsv(
      "Data;Hora;Tipo;Título;Distância (km);Tempo;Passos\n05/08/2026;08:48;Caminhada;Matinal;5,62;1h 3min;6870"
    ).activities[0]
    const block = toStravaCardioLog(activity)
    expect(block).toMatchObject({
      source: "strava",
      mode: "Caminhada",
      purpose: "zone2",
      minutes: 63,
      durationSeconds: 3780,
      distanceKm: 5.62,
      steps: 6870,
      startTime: "08:48",
    })
    expect(block.sourceId).toMatch(/^strava:2026-08-05:/)
    expect(formatActivityDuration(block.durationSeconds!)).toBe("1h 3min")
  })
})
