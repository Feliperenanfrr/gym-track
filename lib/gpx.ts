import type {
  CardioLog,
  GpxRunWalkAnalysis,
  GpxSplit,
  GpxTelemetry,
} from "./types"

export interface ParsedGpxActivity {
  date: string
  startTime?: string
  type: "walk" | "run"
  title: string
  distanceKm: number
  durationSeconds: number
  movingSeconds: number
  elapsedSeconds: number
  elevationGainM: number
  avgBpm?: number
  sourceId: string
  telemetry: GpxTelemetry
}

interface TrackPoint {
  lat: number
  lon: number
  ele?: number
  tSec: number
  iso: string
}

interface SegmentSample {
  distM: number
  dtSec: number
  speedMs: number
  moving: boolean
}

const EARTH_RADIUS_M = 6_371_000
const MOVING_MIN_SPEED_MS = 0.45
const MAX_GAP_SEC = 30
/** < 8:30/km (1000 / 510 ≈ 1.96 m/s) caracteriza trote; abaixo disso é caminhada. */
const TROTE_MIN_SPEED_MS = 1000 / 510
/** < 7:30/km (1000 / 450 ≈ 2.22 m/s) indica trote acima do ritmo de conversa prescrito. */
const FAST_TROTE_SPEED_MS = 1000 / 450

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function formatDateAndTime(iso: string, tzOffsetMinutes?: number): { date: string; time: string } {
  const raw = new Date(iso)
  if (tzOffsetMinutes !== undefined) {
    const shifted = new Date(raw.getTime() + tzOffsetMinutes * 60_000)
    const y = shifted.getUTCFullYear()
    const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
    const d = String(shifted.getUTCDate()).padStart(2, "0")
    const hh = String(shifted.getUTCHours()).padStart(2, "0")
    const mm = String(shifted.getUTCMinutes()).padStart(2, "0")
    return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` }
  }
  const y = raw.getFullYear()
  const m = String(raw.getMonth() + 1).padStart(2, "0")
  const d = String(raw.getDate()).padStart(2, "0")
  const hh = String(raw.getHours()).padStart(2, "0")
  const mm = String(raw.getMinutes()).padStart(2, "0")
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` }
}

function bestSlidingWindowSeconds(samples: SegmentSample[], targetMeters: number): number | undefined {
  const totalDist = samples.reduce((sum, s) => sum + s.distM, 0)
  if (totalDist < targetMeters) return undefined

  let bestSec = Infinity
  let left = 0
  let accDist = 0
  let accElapsed = 0

  for (let right = 0; right < samples.length; right++) {
    accDist += samples[right].distM
    accElapsed += samples[right].dtSec
    while (accDist - samples[left].distM >= targetMeters && left < right) {
      accDist -= samples[left].distM
      accElapsed -= samples[left].dtSec
      left++
    }
    if (accDist >= targetMeters) {
      const scaled = accElapsed * (targetMeters / accDist)
      if (scaled > 0 && scaled < bestSec) bestSec = scaled
    }
  }

  return Number.isFinite(bestSec) ? Math.round(bestSec) : undefined
}

function analyzeRunWalk(samples: SegmentSample[], movingSeconds: number): GpxRunWalkAnalysis {
  let troteSec = 0
  let walkSec = 0
  let fastTroteSec = 0
  let winDist = 0
  let winDt = 0
  let left = 0
  let inTrote = false
  let currentBoutSec = 0
  const bouts: number[] = []

  for (let i = 0; i < samples.length; i++) {
    winDist += samples[i].distM
    winDt += samples[i].dtSec
    while (winDt > 10 && left < i) {
      winDist -= samples[left].distM
      winDt -= samples[left].dtSec
      left++
    }
    const speed = winDt > 0 ? winDist / winDt : 0
    if (samples[i].moving && speed >= TROTE_MIN_SPEED_MS) {
      troteSec += samples[i].dtSec
      if (speed > FAST_TROTE_SPEED_MS) {
        fastTroteSec += samples[i].dtSec
      }
      if (!inTrote) {
        inTrote = true
        currentBoutSec = samples[i].dtSec
      } else {
        currentBoutSec += samples[i].dtSec
      }
    } else {
      if (samples[i].moving) walkSec += samples[i].dtSec
      if (inTrote) {
        if (currentBoutSec >= 20) bouts.push(currentBoutSec)
        inTrote = false
        currentBoutSec = 0
      }
    }
  }
  if (inTrote && currentBoutSec >= 20) {
    bouts.push(currentBoutSec)
  }

  const avgTroteSec =
    bouts.length > 0 ? Math.round(bouts.reduce((a, b) => a + b, 0) / bouts.length) : 0
  const longestTroteSec = bouts.length > 0 ? Math.round(Math.max(...bouts)) : 0

  return {
    troteMinutes: Math.round(troteSec / 60),
    walkMinutes: Math.round(walkSec / 60),
    fastTroteMinutes: Math.round(fastTroteSec / 60),
    troteBouts: bouts.length,
    avgTroteSec,
    longestTroteSec,
    trotePct: movingSeconds > 0 ? Math.round((troteSec / movingSeconds) * 100) : 0,
  }
}

function computeSplitTrend(splits: GpxSplit[]): GpxTelemetry["splitTrend"] {
  const fullSplits = splits.filter((s) => s.distanceKm >= 0.95)
  if (fullSplits.length < 2) return undefined
  const mid = Math.floor(fullSplits.length / 2)
  const firstHalf = fullSplits.slice(0, mid)
  const secondHalf = fullSplits.slice(-mid)
  const avgFirst = firstHalf.reduce((s, x) => s + x.secPerKm, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, x) => s + x.secPerKm, 0) / secondHalf.length
  const delta = avgSecond - avgFirst
  if (delta <= -8) return "negative"
  if (delta >= 8) return "positive"
  return "even"
}

export function isGpxContent(raw: string): boolean {
  const trimmed = raw.trimStart()
  return trimmed.startsWith("<") && /<gpx[\s>]/i.test(trimmed.slice(0, 400)) && /<trkpt\b/i.test(raw)
}

/**
 * Faz o parse completo de um arquivo .gpx exportado do Strava e retorna apenas
 * um resumo compacto de telemetria (splits, trote vs. caminhada, melhores
 * janelas), evitando salvar milhares de pontos GPS crus no banco.
 */
export function parseGpxXml(
  xml: string,
  options: { tzOffsetMinutes?: number } = {}
): ParsedGpxActivity {
  const nameRaw = xml.match(/<trk>[\s\S]*?<name>([^<]+)<\/name>/i)?.[1]
  const typeRaw = xml.match(/<trk>[\s\S]*?<type>([^<]+)<\/type>/i)?.[1]?.toLowerCase().trim()

  const segMatches = [...xml.matchAll(/<trkseg>([\s\S]*?)<\/trkseg>/gi)]
  const segmentsXml = segMatches.length > 0 ? segMatches.map((m) => m[1]) : [xml]

  const segmentPoints: TrackPoint[][] = []
  const hrValues: number[] = []

  for (const segXml of segmentsXml) {
    const pts: TrackPoint[] = []
    for (const m of segXml.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi)) {
      const attrs = m[1]
      const body = m[2]
      const lat = Number(attrs.match(/lat=["']([^"']+)["']/i)?.[1])
      const lon = Number(attrs.match(/lon=["']([^"']+)["']/i)?.[1])
      const timeStr = body.match(/<time>([^<]+)<\/time>/i)?.[1]?.trim()
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !timeStr) continue
      const tMs = new Date(timeStr).getTime()
      if (Number.isNaN(tMs)) continue
      const eleRaw = body.match(/<ele>([^<]+)<\/ele>/i)?.[1]
      const ele = eleRaw !== undefined && Number.isFinite(Number(eleRaw)) ? Number(eleRaw) : undefined
      const hrRaw = body.match(/<(?:gpxtpx:)?hr>(\d+)<\/(?:gpxtpx:)?hr>/i)?.[1]
      if (hrRaw) {
        const hr = Number(hrRaw)
        if (hr >= 40 && hr <= 230) hrValues.push(hr)
      }
      pts.push({ lat, lon, ele, tSec: tMs / 1000, iso: timeStr })
    }
    if (pts.length > 0) segmentPoints.push(pts)
  }

  const allPoints = segmentPoints.flat()
  if (allPoints.length < 2) {
    throw new Error("Arquivo GPX sem pontos suficientes para calcular o treino.")
  }

  let totalDistM = 0
  let movingSec = 0
  let elevGainM = 0
  let prevEle: number | undefined = allPoints[0].ele

  const samples: SegmentSample[] = []
  const splits: GpxSplit[] = []
  let nextKmMarkM = 1000
  let splitStartDistM = 0
  let splitStartMovingSec = 0
  let splitStartEle: number | undefined = allPoints[0].ele

  for (const pts of segmentPoints) {
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]
      const p1 = pts[i]
      const dtSec = Math.max(0, p1.tSec - p0.tSec)
      const distM = haversineMeters(p0.lat, p0.lon, p1.lat, p1.lon)
      const speedMs = dtSec > 0 ? distM / dtSec : 0
      const moving = dtSec > 0 && dtSec <= MAX_GAP_SEC && speedMs >= MOVING_MIN_SPEED_MS

      totalDistM += distM
      if (moving) movingSec += dtSec

      if (p1.ele !== undefined && prevEle !== undefined) {
        const diff = p1.ele - prevEle
        if (diff >= 0.5) {
          elevGainM += diff
          prevEle = p1.ele
        } else if (diff <= -0.5) {
          prevEle = p1.ele
        }
      } else if (p1.ele !== undefined && prevEle === undefined) {
        prevEle = p1.ele
      }

      samples.push({ distM, dtSec, speedMs, moving })

      if (totalDistM >= nextKmMarkM) {
        const segDistKm = (totalDistM - splitStartDistM) / 1000
        const segMoving = movingSec - splitStartMovingSec
        const eleDelta =
          p1.ele !== undefined && splitStartEle !== undefined
            ? Math.round(p1.ele - splitStartEle)
            : undefined
        splits.push({
          km: splits.length + 1,
          label: `${splits.length + 1}`,
          distanceKm: Number(segDistKm.toFixed(2)),
          secPerKm: Math.round(segMoving / Math.max(segDistKm, 0.01)),
          ...(eleDelta !== undefined ? { elevationDeltaM: eleDelta } : {}),
        })
        splitStartDistM = totalDistM
        splitStartMovingSec = movingSec
        splitStartEle = p1.ele
        nextKmMarkM += 1000
      }
    }
  }

  const tailDistM = totalDistM - splitStartDistM
  if (tailDistM >= 50) {
    const segDistKm = tailDistM / 1000
    const segMoving = movingSec - splitStartMovingSec
    const lastEle = allPoints[allPoints.length - 1].ele
    const eleDelta =
      lastEle !== undefined && splitStartEle !== undefined
        ? Math.round(lastEle - splitStartEle)
        : undefined
    splits.push({
      km: splits.length + 1,
      label: segDistKm.toFixed(2).replace(".", ","),
      distanceKm: Number(segDistKm.toFixed(2)),
      secPerKm: Math.round(segMoving / Math.max(segDistKm, 0.01)),
      ...(eleDelta !== undefined ? { elevationDeltaM: eleDelta } : {}),
    })
  }

  const first = allPoints[0]
  const last = allPoints[allPoints.length - 1]
  const elapsedSeconds = Math.max(1, Math.round(last.tSec - first.tSec))
  const movingSeconds = Math.max(1, Math.round(movingSec > 0 ? movingSec : elapsedSeconds))
  const distanceKm = Number((totalDistM / 1000).toFixed(2))
  const runWalk = analyzeRunWalk(samples, movingSeconds)

  const inferredRun =
    typeRaw === "running" ||
    typeRaw === "run" ||
    typeRaw === "trail running" ||
    (runWalk.troteMinutes >= 5 && runWalk.trotePct >= 20)
  const type: "walk" | "run" = inferredRun ? "run" : "walk"

  const best1k = bestSlidingWindowSeconds(samples, 1000)
  const best1mi = bestSlidingWindowSeconds(samples, 1609.34)
  const best5k = bestSlidingWindowSeconds(samples, 5000)
  const bestWindowsSec =
    best1k || best1mi || best5k
      ? {
          ...(best1k ? { km1: best1k } : {}),
          ...(best1mi ? { mi1: best1mi } : {}),
          ...(best5k ? { km5: best5k } : {}),
        }
      : undefined

  const { date, time } = formatDateAndTime(first.iso, options.tzOffsetMinutes)
  const title = nameRaw ? decodeXmlEntities(nameRaw) : type === "run" ? "Corrida (GPX)" : "Caminhada (GPX)"
  const avgBpm =
    hrValues.length > 0
      ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
      : undefined

  const sourceId = `gpx:${date}:${time}:${distanceKm.toFixed(2)}`

  return {
    date,
    startTime: time,
    type,
    title,
    distanceKm,
    durationSeconds: movingSeconds,
    movingSeconds,
    elapsedSeconds,
    elevationGainM: Math.round(elevGainM),
    ...(avgBpm ? { avgBpm } : {}),
    sourceId,
    telemetry: {
      movingSeconds,
      elapsedSeconds,
      splits,
      ...(bestWindowsSec ? { bestWindowsSec } : {}),
      runWalk,
      splitTrend: computeSplitTrend(splits),
    },
  }
}

export function gpxToCardioLog(activity: ParsedGpxActivity): CardioLog {
  const mode = activity.type === "walk" ? "Caminhada" : "Corrida"
  return {
    minutes: Math.max(1, Math.round(activity.movingSeconds / 60)),
    durationSeconds: activity.movingSeconds,
    ...(activity.avgBpm ? { avgBpm: activity.avgBpm } : {}),
    mode,
    purpose: "zone2",
    source: "strava",
    sourceId: activity.sourceId,
    title: activity.title,
    startTime: activity.startTime,
    distanceKm: activity.distanceKm,
    ...(activity.elevationGainM > 0 ? { elevationGainM: activity.elevationGainM } : {}),
    gpx: activity.telemetry,
  }
}
