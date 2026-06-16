import { SleepLog } from "./types"
import { toDateKey } from "./utils"

export const SLEEP_TARGET_MIN = 8 * 60

export type SleepConsistency = {
  label: "Estável" | "Ok" | "Irregular" | "—"
  detail: string
  driftMin: number | null
}

export interface SleepMetrics {
  latest?: SleepLog
  last7: SleepLog[]
  avg7Min: number | null
  debt7Min: number | null
  registered7: number
  avgBedtime: string | null
  avgWake: string | null
  consistency: SleepConsistency
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function sleepDurationMinutes(sleptAt: string, wokeAt: string): number | null {
  const start = timeToMinutes(sleptAt)
  const end = timeToMinutes(wokeAt)
  if (start === null || end === null) return null
  return end <= start ? end + 24 * 60 - start : end - start
}

export function formatSleepDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes < 0) return "—"
  if (minutes === 0) return "0h"
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`
}

export function minutesToSleepInput(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(".", ",")
}

export function parseSleepHours(value: string): number | null {
  const hours = Number(value.replace(",", "."))
  if (!Number.isFinite(hours) || hours <= 0 || hours > 18) return null
  return Math.round(hours * 60)
}

function dateRangeStart(today: Date, days: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  return toDateKey(d)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function standardDeviation(values: number[]): number | null {
  const avg = average(values)
  if (avg === null || values.length < 2) return null
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function formatTimeFromMinutes(minutes: number | null): string | null {
  if (minutes === null) return null
  const normalized = ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function adjustedBedtimeMinutes(value: string): number | null {
  const minutes = timeToMinutes(value)
  if (minutes === null) return null
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes
}

function sleepMidpoint(log: SleepLog): number | null {
  const start = adjustedBedtimeMinutes(log.sleptAt)
  if (start === null) return null
  return start + log.durationMin / 2
}

export function computeSleepMetrics(logs: SleepLog[], today: Date): SleepMetrics {
  const todayKey = toDateKey(today)
  const since7 = dateRangeStart(today, 7)
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const latest = [...sorted].reverse().find((s) => s.date <= todayKey)
  const last7 = sorted.filter((s) => s.date >= since7 && s.date <= todayKey)
  const durations = last7.map((s) => s.durationMin).filter((v) => v > 0)
  const avg7Min = average(durations)
  const debt7Min =
    durations.length > 0
      ? Math.max(0, SLEEP_TARGET_MIN * durations.length - durations.reduce((a, b) => a + b, 0))
      : null

  const avgBedtime = formatTimeFromMinutes(average(last7.flatMap((s) => {
    const value = adjustedBedtimeMinutes(s.sleptAt)
    return value === null ? [] : [value]
  })))
  const avgWake = formatTimeFromMinutes(average(last7.flatMap((s) => {
    const value = timeToMinutes(s.wokeAt)
    return value === null ? [] : [value]
  })))

  const midpointDrift = standardDeviation(last7.flatMap((s) => {
    const value = sleepMidpoint(s)
    return value === null ? [] : [value]
  }))
  const consistency: SleepConsistency =
    midpointDrift === null
      ? { label: "—", detail: "precisa de 2 noites", driftMin: null }
      : midpointDrift <= 30
        ? { label: "Estável", detail: `desvio ~${formatSleepDuration(midpointDrift)}`, driftMin: midpointDrift }
        : midpointDrift <= 60
          ? { label: "Ok", detail: `desvio ~${formatSleepDuration(midpointDrift)}`, driftMin: midpointDrift }
          : { label: "Irregular", detail: `desvio ~${formatSleepDuration(midpointDrift)}`, driftMin: midpointDrift }

  return {
    latest,
    last7,
    avg7Min,
    debt7Min,
    registered7: last7.length,
    avgBedtime,
    avgWake,
    consistency,
  }
}
