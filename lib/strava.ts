import type { CardioLog, CardioPurpose } from "./types"
import { parseNumber } from "./bioimpedance"

export type StravaActivityType = "walk" | "run"

export interface ParsedStravaActivity {
  date: string
  startTime?: string
  type: StravaActivityType
  title: string
  durationSeconds: number
  distanceKm: number
  steps?: number
  elevationGainM?: number
  location?: string
  avgBpm?: number
  /** Identificador determinístico para uma reimportação não duplicar o bloco. */
  sourceId: string
}

export interface StravaParseResult {
  activities: ParsedStravaActivity[]
  errors: string[]
  warnings: string[]
}

type ActivityField =
  | "date"
  | "time"
  | "type"
  | "title"
  | "duration"
  | "distance"
  | "steps"
  | "elevation"
  | "location"
  | "avgBpm"

interface RawValue {
  value: string
  header: string
  unit?: string
}

type RawActivity = Partial<Record<ActivityField, RawValue>>

const PT_MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

function normalize(value: string): string {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^"|"$/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_()[\]]/g, " ")
    .replace(/[^a-z0-9%+.:/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function fieldForHeader(raw: string): ActivityField | null {
  const header = normalize(raw)
  if (!header || header === "metrica" || header === "metric" || header === "valor") {
    return null
  }
  if (/^(data|activity date|data da atividade|date)$/.test(header)) return "date"
  if (/^(hora|horario|start time|hora de inicio)$/.test(header)) return "time"
  if (/^(tipo|activity type|sport type|tipo de atividade|modalidade)$/.test(header)) return "type"
  if (/^(titulo|activity name|nome da atividade|nome|title)$/.test(header)) return "title"
  if (/^(tempo|duracao|duration|elapsed time|moving time|tempo decorrido|tempo em movimento)/.test(header)) {
    return "duration"
  }
  if (/^(distancia|distance)/.test(header)) return "distance"
  if (/^(passos|steps|step count)/.test(header)) return "steps"
  if (/^(ganho de elevacao|elevation gain|total elevation gain|elevacao positiva)/.test(header)) {
    return "elevation"
  }
  if (/^(local|location|localizacao|cidade)/.test(header)) return "location"
  if (/^(fc media|bpm medio|frequencia cardiaca media|average heart rate|avg heart rate)/.test(header)) {
    return "avgBpm"
  }
  return null
}

function delimiterOf(line: string): string {
  let commas = 0
  let semicolons = 0
  let tabs = 0
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') quoted = !quoted
    if (quoted) continue
    if (char === ",") commas++
    else if (char === ";") semicolons++
    else if (char === "\t") tabs++
  }
  if (tabs > semicolons && tabs > commas) return "\t"
  return semicolons > commas ? ";" : ","
}

/** CSV real: respeita aspas e vírgulas dentro de título/local. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim())
      cell = ""
    } else {
      cell += char
    }
  }
  cells.push(cell.trim())
  return cells
}

function validDateKey(year: number, month: number, day: number): string | null {
  const test = new Date(Date.UTC(year, month - 1, day))
  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() !== month - 1 ||
    test.getUTCDate() !== day
  ) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function parseClock(raw: string): string | null {
  const value = (raw ?? "").trim()
  const match = value.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?(?:$|\s)/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  const period = match[3]?.toLowerCase()
  if (period === "pm" && hour < 12) hour += 12
  if (period === "am" && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function parseDateAndTime(raw: string): { date: string; time?: string } | null {
  const value = (raw ?? "").replace(/^"|"$/g, "").trim()
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (iso) {
    const date = validDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    return date ? { date, ...(parseClock(value) ? { time: parseClock(value)! } : {}) } : null
  }
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/)
  if (br) {
    const date = validDateKey(Number(br[3]), Number(br[2]), Number(br[1]))
    return date ? { date, ...(parseClock(value) ? { time: parseClock(value)! } : {}) } : null
  }
  const pt = normalize(value).match(
    /^(\d{1,2}) de ([a-z]+) de (\d{4})(?: as (\d{1,2}):(\d{2}))?/
  )
  if (pt && PT_MONTHS[pt[2]]) {
    const date = validDateKey(Number(pt[3]), PT_MONTHS[pt[2]], Number(pt[1]))
    const time = pt[4] ? parseClock(`${pt[4]}:${pt[5]}`) : null
    return date ? { date, ...(time ? { time } : {}) } : null
  }

  // O activities.csv oficial pode trazer mês em inglês e horário AM/PM.
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    const date = validDateKey(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
    return date ? { date, ...(parseClock(value) ? { time: parseClock(value)! } : {}) } : null
  }
  return null
}

export function parseActivityDuration(raw: string, header = ""): number | null {
  const value = normalize(raw)
  if (!value) return null
  const clock = value.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/)
  if (clock) {
    if (clock[3] !== undefined) {
      return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
    }
    return Number(clock[1]) * 60 + Number(clock[2])
  }

  const hours = Number(value.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hora|horas)/)?.[1]?.replace(",", ".") ?? 0)
  const minutes = Number(value.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minuto|minutos)/)?.[1]?.replace(",", ".") ?? 0)
  const seconds = Number(value.match(/(\d+(?:[.,]\d+)?)\s*(?:s|seg|segundo|segundos)/)?.[1]?.replace(",", ".") ?? 0)
  if (hours || minutes || seconds) return Math.round(hours * 3600 + minutes * 60 + seconds)

  const numeric = parseNumber(value)
  if (numeric === null || numeric <= 0) return null
  const unit = normalize(header)
  if (/\b(min|minutos?)\b/.test(unit)) return Math.round(numeric * 60)
  if (/\b(h|horas?)\b/.test(unit)) return Math.round(numeric * 3600)
  // activities.csv do Strava exporta Elapsed/Moving Time em segundos.
  return Math.round(numeric)
}

function parseDistanceKm(raw: RawValue | undefined): number | null {
  if (!raw) return null
  const value = parseNumber(raw.value)
  if (value === null || value <= 0) return null
  const unit = normalize(`${raw.value} ${raw.unit ?? ""} ${raw.header}`)
  if (/\b(mi|mile|miles|milha|milhas)\b/.test(unit)) return value * 1.609344
  if (/\b(m|metro|metros)\b/.test(unit) && !/\bkm\b/.test(unit)) return value / 1000
  return value
}

function parseElevationM(raw: RawValue | undefined): number | undefined {
  if (!raw) return undefined
  const value = parseNumber(raw.value)
  if (value === null || value < 0) return undefined
  const unit = normalize(`${raw.value} ${raw.unit ?? ""} ${raw.header}`)
  return /\b(ft|feet|pes)\b/.test(unit) ? value * 0.3048 : value
}

function parseWholeNumber(raw: RawValue | undefined): number | undefined {
  if (!raw) return undefined
  const digits = raw.value.replace(/[^\d-]/g, "")
  const value = Number(digits)
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
}

function activityType(raw: string): StravaActivityType | null {
  const value = normalize(raw)
  if (/\b(run|running|jog|jogging|corrida)\b/.test(value)) return "run"
  if (/\b(walk|walking|hike|hiking|caminhada|trilha)\b/.test(value)) return "walk"
  return null
}

function sourceIdOf(activity: Omit<ParsedStravaActivity, "sourceId">): string {
  return [
    "strava",
    activity.date,
    activity.startTime ?? "sem-hora",
    activity.type,
    activity.durationSeconds,
    activity.distanceKm.toFixed(3),
    normalize(activity.title),
  ].join(":")
}

function parseRawActivity(raw: RawActivity, rowLabel: string): {
  activity?: ParsedStravaActivity
  errors: string[]
} {
  const errors: string[] = []
  const parsedDate = parseDateAndTime(raw.date?.value ?? "")
  if (!parsedDate) errors.push(`${rowLabel}: data ausente ou inválida.`)

  const titleRaw = raw.title?.value.trim() ?? ""
  const type = activityType(`${raw.type?.value ?? ""} ${titleRaw}`)
  if (!type) errors.push(`${rowLabel}: tipo deve ser Caminhada/Walk ou Corrida/Run.`)

  const durationSeconds = parseActivityDuration(
    raw.duration?.value ?? "",
    `${raw.duration?.header ?? ""} ${raw.duration?.unit ?? ""}`
  )
  if (!durationSeconds) errors.push(`${rowLabel}: duração ausente ou inválida.`)

  const distanceKm = parseDistanceKm(raw.distance)
  if (!distanceKm) errors.push(`${rowLabel}: distância ausente ou inválida.`)

  if (!parsedDate || !type || !durationSeconds || !distanceKm) return { errors }

  const time = parseClock(raw.time?.value ?? "") ?? parsedDate.time
  const steps = parseWholeNumber(raw.steps)
  const elevationGainM = parseElevationM(raw.elevation)
  const parsedBpm = raw.avgBpm ? parseNumber(raw.avgBpm.value) : null
  const avgBpm = parsedBpm !== null && parsedBpm > 0 ? Math.round(parsedBpm) : undefined
  const title = titleRaw || (type === "walk" ? "Caminhada" : "Corrida")
  const base = {
    date: parsedDate.date,
    ...(time ? { startTime: time } : {}),
    type,
    title,
    durationSeconds,
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    ...(steps !== undefined ? { steps } : {}),
    ...(elevationGainM !== undefined
      ? { elevationGainM: Math.round(elevationGainM * 10) / 10 }
      : {}),
    ...(raw.location?.value.trim() ? { location: raw.location.value.trim() } : {}),
    ...(avgBpm !== undefined ? { avgBpm } : {}),
  }
  return { activity: { ...base, sourceId: sourceIdOf(base) }, errors }
}

function rowsFromCsv(input: string): string[][] {
  const lines = (input ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []
  const delimiter = delimiterOf(lines[0])
  return lines.map((line) => splitCsvLine(line, delimiter))
}

/**
 * Aceita tanto tabela (uma atividade por linha) quanto CSV vertical de
 * chave-valor, no mesmo estilo do importador da bioimpedância.
 */
export function parseStravaCsv(input: string): StravaParseResult {
  const rows = rowsFromCsv(input)
  if (rows.length === 0) return { activities: [], errors: [], warnings: [] }

  const activities: ParsedStravaActivity[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const headerFields = rows[0].map(fieldForHeader)
  const horizontal = headerFields.filter(Boolean).length >= 2

  if (horizontal) {
    rows.slice(1).forEach((cells, index) => {
      const raw: RawActivity = {}
      headerFields.forEach((field, column) => {
        if (!field || !cells[column]?.trim()) return
        raw[field] = { value: cells[column], header: rows[0][column] }
      })
      if (Object.keys(raw).length === 0) return
      const parsed = parseRawActivity(raw, `Linha ${index + 2}`)
      errors.push(...parsed.errors)
      if (parsed.activity) activities.push(parsed.activity)
    })
  } else {
    const records: RawActivity[] = []
    let current: RawActivity = {}
    for (const cells of rows) {
      const field = fieldForHeader(cells[0] ?? "")
      if (!field || !cells[1]?.trim()) continue
      // Uma nova Data inicia outra atividade no formato vertical.
      if (field === "date" && current.date) {
        records.push(current)
        current = {}
      }
      const value = field === "location" ? cells.slice(1).join(", ") : cells[1]
      current[field] = { value, header: cells[0], unit: cells[2] }
    }
    if (Object.keys(current).length > 0) records.push(current)
    records.forEach((raw, index) => {
      const parsed = parseRawActivity(raw, `Atividade ${index + 1}`)
      errors.push(...parsed.errors)
      if (parsed.activity) activities.push(parsed.activity)
    })
  }

  const unique = new Map(activities.map((activity) => [activity.sourceId, activity]))
  if (unique.size < activities.length) {
    warnings.push(`${activities.length - unique.size} atividade(s) repetida(s) no CSV foram ignoradas.`)
  }
  if (unique.size === 0 && errors.length === 0) {
    errors.push("Nenhuma caminhada ou corrida reconhecida no CSV.")
  }
  return { activities: [...unique.values()], errors, warnings }
}

export function stravaPurpose(type: StravaActivityType): CardioPurpose {
  return type === "walk" ? "zone2" : "intense"
}

export function toStravaCardioLog(activity: ParsedStravaActivity): CardioLog {
  return {
    minutes: Math.max(1, Math.round(activity.durationSeconds / 60)),
    durationSeconds: activity.durationSeconds,
    mode: activity.type === "walk" ? "Caminhada" : "Corrida",
    purpose: stravaPurpose(activity.type),
    source: "strava",
    sourceId: activity.sourceId,
    title: activity.title,
    distanceKm: activity.distanceKm,
    ...(activity.steps !== undefined ? { steps: activity.steps } : {}),
    ...(activity.elevationGainM !== undefined
      ? { elevationGainM: activity.elevationGainM }
      : {}),
    ...(activity.startTime ? { startTime: activity.startTime } : {}),
    ...(activity.location ? { location: activity.location } : {}),
    ...(activity.avgBpm !== undefined ? { avgBpm: activity.avgBpm } : {}),
  }
}

export function formatActivityDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return [
    hours > 0 ? `${hours}h` : "",
    minutes > 0 ? `${minutes}min` : "",
    secs > 0 ? `${secs}s` : "",
  ].filter(Boolean).join(" ") || "0s"
}
