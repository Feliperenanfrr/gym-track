import { describe, expect, it } from "vitest"
import { gpxToCardioLog, isGpxContent, parseGpxXml } from "@/lib/gpx"
import { runningTodayView } from "@/lib/running-plan"
import { WorkoutLog } from "@/lib/types"

/** Gera pontos <trkpt> em sequência linear para norte a ~111.195 km/grau de latitude. */
function makeTrackSegment(params: {
  startIso: string
  startLat: number
  lon: number
  stepSec: number
  speedMs: number
  steps: number
  startEle?: number
  elePerStep?: number
  hr?: number
}): { xml: string; endLat: number; endIso: string } {
  const metersPerDegLat = 111_195
  let lat = params.startLat
  let ele = params.startEle ?? 550
  const startMs = new Date(params.startIso).getTime()
  const lines: string[] = ["<trkseg>"]

  for (let i = 0; i <= params.steps; i++) {
    const tMs = startMs + i * params.stepSec * 1000
    const iso = new Date(tMs).toISOString().replace(".000Z", "Z")
    const hrBlock =
      params.hr !== undefined
        ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${params.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`
        : ""
    lines.push(
      `  <trkpt lat="${lat.toFixed(6)}" lon="${params.lon.toFixed(6)}"><ele>${ele.toFixed(1)}</ele><time>${iso}</time>${hrBlock}</trkpt>`
    )
    if (i < params.steps) {
      lat += (params.speedMs * params.stepSec) / metersPerDegLat
      ele += params.elePerStep ?? 0
    }
  }

  lines.push("</trkseg>")
  const endMs = startMs + params.steps * params.stepSec * 1000
  return {
    xml: lines.join("\n"),
    endLat: lat,
    endIso: new Date(endMs).toISOString().replace(".000Z", "Z"),
  }
}

function wrapGpx(title: string, type: string, segmentsXml: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="StravaGPX">
  <trk>
    <name>${title}</name>
    <type>${type}</type>
    ${segmentsXml.join("\n")}
  </trk>
</gpx>`
}

describe("parseGpxXml & running GPX integration", () => {
  it("detects GPX content and rejects CSV", () => {
    const sample = wrapGpx("Teste", "running", [
      `<trkseg><trkpt lat="-7.2" lon="-35.8"><time>2026-11-09T21:00:00Z</time></trkpt><trkpt lat="-7.199" lon="-35.8"><time>2026-11-09T21:01:00Z</time></trkpt></trkseg>`,
    ])
    expect(isGpxContent(sample)).toBe(true)
    expect(isGpxContent("Data;Hora;Tipo\n07/11/2026;06:15;Corrida")).toBe(false)
    expect(isGpxContent("<gpx><trk></trk></gpx>")).toBe(false)
  })

  it("converts UTC start timestamp with tzOffsetMinutes (-03:00) and splits stopped pauses across trkseg", () => {
    // 2026-11-06T21:49:50Z in -03:00 is 2026-11-06 18:49
    const seg1 = makeTrackSegment({
      startIso: "2026-11-06T21:49:50Z",
      startLat: -7.22,
      lon: -35.88,
      stepSec: 5,
      speedMs: 2.0, // 8:20/km (trote leve)
      steps: 100, // 500s, 1000m
      startEle: 550,
      elePerStep: 0.1, // +10m
      hr: 148,
    })
    // Pausa de 120s entre segmentos (<trkseg>) + volta acelerando (negative split)
    const resumeIso = new Date(new Date(seg1.endIso).getTime() + 120_000)
      .toISOString()
      .replace(".000Z", "Z")
    const seg2 = makeTrackSegment({
      startIso: resumeIso,
      startLat: seg1.endLat,
      lon: -35.88,
      stepSec: 5,
      speedMs: 2.3, // ~7:15/km (trote rápido < 7:30/km)
      steps: 90, // 450s, ~1035m
      startEle: 560,
      hr: 158,
    })

    const gpx = wrapGpx("Trote &amp; Caminhada", "running", [seg1.xml, seg2.xml])
    const parsed = parseGpxXml(gpx, { tzOffsetMinutes: -180 })

    expect(parsed.date).toBe("2026-11-06")
    expect(parsed.startTime).toBe("18:49")
    expect(parsed.title).toBe("Trote & Caminhada")
    expect(parsed.type).toBe("run")
    expect(parsed.avgBpm).toBe(153)
    expect(parsed.elevationGainM).toBeGreaterThanOrEqual(9)
    expect(parsed.elapsedSeconds).toBe(500 + 120 + 450)
    expect(parsed.movingSeconds).toBe(950)
    expect(parsed.telemetry.splits.length).toBeGreaterThanOrEqual(2)
    expect(parsed.telemetry.splitTrend).toBe("negative")
    expect(parsed.telemetry.runWalk?.fastTroteMinutes).toBeGreaterThan(0)
    expect(parsed.telemetry.bestWindowsSec?.km1).toBeLessThanOrEqual(445)
  })

  it("extracts run/walk bouts, 5 km best sliding window, and populates runningTodayView.benchmarks.best5kFromGpx", () => {
    // Bloco A: caminhada de 5 min (1.4 m/s -> 11:54/km)
    const walk1 = makeTrackSegment({
      startIso: "2026-11-09T21:00:00Z",
      startLat: -7.22,
      lon: -35.88,
      stepSec: 5,
      speedMs: 1.4,
      steps: 60, // 300s = 420m
    })
    // Bloco B: corrida contínua de 5.2 km a 2.15 m/s (~7:45/km => 5 km em ~38m45s = 2326s)
    const runMain = makeTrackSegment({
      startIso: walk1.endIso,
      startLat: walk1.endLat,
      lon: -35.88,
      stepSec: 5,
      speedMs: 2.15,
      steps: 490, // 2450s -> 5267.5m
    })

    const gpx = wrapGpx("Corrida ao entardecer", "running", [walk1.xml, runMain.xml])
    const parsed = parseGpxXml(gpx, { tzOffsetMinutes: -180 })
    const cardioLog = gpxToCardioLog(parsed)

    expect(parsed.date).toBe("2026-11-09")
    expect(parsed.distanceKm).toBeGreaterThanOrEqual(5.5)
    expect(parsed.telemetry.runWalk?.troteBouts).toBeGreaterThanOrEqual(1)
    expect(parsed.telemetry.runWalk?.walkMinutes).toBeGreaterThanOrEqual(4)
    expect(parsed.telemetry.bestWindowsSec?.km5).toBeGreaterThan(2250)
    expect(parsed.telemetry.bestWindowsSec?.km5).toBeLessThan(2400)
    expect(cardioLog.gpx).toEqual(parsed.telemetry)

    const workout: WorkoutLog = {
      id: "strava-2026-11-09",
      date: "2026-11-09",
      sessionId: "strava",
      durationMin: cardioLog.minutes,
      entries: [],
      cardio: cardioLog,
      cardios: [cardioLog],
    }

    const view = runningTodayView([workout], new Date("2026-11-10T12:00:00"))
    expect(view.benchmarks.best5kFromGpx).not.toBeNull()
    expect(view.benchmarks.best5kFromGpx?.date).toBe("2026-11-09")
    expect(view.benchmarks.best5kFromGpx?.durationSec).toBe(parsed.telemetry.bestWindowsSec?.km5)
  })
})
