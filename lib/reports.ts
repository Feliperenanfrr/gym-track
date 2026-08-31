import { bjjBlockWindows } from "./bjj-plan"
import { intenseMinutes, totalCardioMinutes, zone2Minutes } from "./cardio"
import {
  energyBalanceSeries,
  EnergyBalancePoint,
  energyReport,
  EnergyReport,
  fatMassOf,
  massTrend,
  MassTrend,
} from "./energy"
import {
  computeReadiness,
  internalLoad,
  prEvents,
  PrEvent,
  sessionKcal,
  waterGoalMl,
  weightKgOn,
} from "./insights"
import { hardSetsByGroup, MUSCLE_GROUPS } from "./muscles"
import { countsTowardProgramTarget, EXERCISES_BY_ID } from "./plan"
import { BodyLog, GymData, MuscleGroup, TrainingProgram, WorkoutLog } from "./types"
import { bestE1RMAdjusted, fromDateKey, toDateKey, workoutVolume } from "./utils"

const DAY_MS = 86_400_000

/** Levantamentos acompanhados no comparativo de força do fechamento. */
export const REPORT_LIFTS: { id: string; label: string }[] = [
  { id: "bench", label: "Supino" },
  { id: "squat", label: "Agachamento" },
  { id: "deadlift", label: "Levantamento terra" },
  { id: "ohp", label: "Desenvolvimento" },
  { id: "row", label: "Remada" },
]

/* ------------------------------------------------------------------ */
/* Período                                                              */
/* ------------------------------------------------------------------ */

export interface ReportPeriod {
  id: string
  label: string
  /** yyyy-MM-dd */
  from: string
  to: string
}

export function daysInPeriod(from: string, to: string): number {
  return (
    Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / DAY_MS) + 1
  )
}

export function weeksInPeriod(from: string, to: string): number {
  return Math.max(1, daysInPeriod(from, to) / 7)
}

function shiftKey(key: string, days: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

export function formatDayMonth(key: string): string {
  const [, month, day] = key.split("-")
  return `${day}/${month}`
}

export function formatFullDate(key: string): string {
  const [year, month, day] = key.split("-")
  return `${day}/${month}/${year}`
}

/**
 * Períodos oferecidos no seletor.
 *
 * O jiu-jitsu tem blocos nomeados com janelas próprias (derivadas da data de
 * início do plano), então eles entram como preset — é literalmente "fechar o
 * bloco". A hipertrofia roda em ciclo rotativo, sem bloco: ali só fazem
 * sentido as janelas móveis. Blocos que ainda não começaram ficam de fora.
 */
export function reportPeriods(today: Date): ReportPeriod[] {
  const todayKey = toDateKey(today)
  const periods: ReportPeriod[] = []

  for (const window of bjjBlockWindows()) {
    if (window.start > todayKey) continue
    const end = window.end === null || window.end > todayKey ? todayKey : window.end
    periods.push({
      id: `bjj-${window.id}`,
      label: window.label,
      from: window.start,
      to: end,
    })
  }

  for (const weeks of [4, 8, 12]) {
    periods.push({
      id: `last-${weeks}w`,
      label: `Últimas ${weeks} semanas`,
      from: shiftKey(todayKey, -(weeks * 7 - 1)),
      to: todayKey,
    })
  }
  return periods
}

/* ------------------------------------------------------------------ */
/* Comparativo início × fim                                             */
/* ------------------------------------------------------------------ */

export interface CompareWindows {
  startFrom: string
  startTo: string
  endFrom: string
  endTo: string
  /** dias de cada ponta */
  windowDays: number
}

/**
 * Pontas do período para o "antes × depois".
 *
 * Um terço do bloco em cada ponta, com sete dias de piso: comparar o melhor
 * dia contra o melhor dia premiaria o dia sortudo, e num bloco de três semanas
 * um terço já é a semana inteira. As pontas nunca se sobrepõem — em períodos
 * curtos elas se encostam, no máximo.
 */
export function compareWindows(from: string, to: string): CompareWindows {
  const total = daysInPeriod(from, to)
  const windowDays = Math.max(1, Math.min(Math.max(7, Math.floor(total / 3)), Math.floor(total / 2)))
  return {
    startFrom: from,
    startTo: shiftKey(from, windowDays - 1),
    endFrom: shiftKey(to, -(windowDays - 1)),
    endTo: to,
    windowDays,
  }
}

export interface LiftProgress {
  id: string
  label: string
  /** melhor 1RM estimada na ponta inicial */
  start: number | null
  /** melhor 1RM estimada na ponta final */
  end: number | null
  /** variação percentual entre as pontas */
  deltaPct: number | null
  /** melhor série do período inteiro */
  best: { weight: number; reps: number } | null
  /** sessões do período em que o exercício apareceu */
  sessions: number
}

function bestE1rmIn(workouts: WorkoutLog[], exerciseId: string): number | null {
  let best = 0
  for (const w of workouts) {
    for (const entry of w.entries) {
      if (entry.exerciseId !== exerciseId) continue
      best = Math.max(best, bestE1RMAdjusted(entry))
    }
  }
  return best > 0 ? Math.round(best * 10) / 10 : null
}

export function liftProgress(
  workouts: WorkoutLog[],
  windows: CompareWindows
): LiftProgress[] {
  const inRange = (from: string, to: string) =>
    workouts.filter((w) => w.date >= from && w.date <= to)
  const startWorkouts = inRange(windows.startFrom, windows.startTo)
  const endWorkouts = inRange(windows.endFrom, windows.endTo)

  return REPORT_LIFTS.map(({ id, label }) => {
    const start = bestE1rmIn(startWorkouts, id)
    const end = bestE1rmIn(endWorkouts, id)
    let best: { weight: number; reps: number } | null = null
    let sessions = 0
    for (const w of workouts) {
      const entry = w.entries.find((e) => e.exerciseId === id)
      if (!entry) continue
      sessions += 1
      for (const set of entry.sets) {
        if (set.weight <= 0) continue
        if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
          best = { weight: set.weight, reps: set.reps }
        }
      }
    }
    return {
      id,
      label: EXERCISES_BY_ID[id]?.name ?? label,
      start,
      end,
      deltaPct:
        start !== null && end !== null && start > 0
          ? Math.round(((end - start) / start) * 1000) / 10
          : null,
      best,
      sessions,
    }
  })
}

export interface BodyProgress {
  key: string
  label: string
  unit: string
  start: number | null
  end: number | null
  delta: number | null
  /** direção desejável para a recomposição */
  goal: "down" | "up" | "neutral"
}

/** Média das medições da janela (a balança oscila; um ponto só engana). */
function avgMetric(
  body: BodyLog[],
  from: string,
  to: string,
  pick: (log: BodyLog) => number | undefined
): number | null {
  const values = body
    .filter((b) => b.date >= from && b.date <= to)
    .map(pick)
    .filter((v): v is number => v !== undefined && v > 0)
  if (values.length === 0) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
}

const BODY_METRICS: {
  key: string
  label: string
  unit: string
  goal: BodyProgress["goal"]
  pick: (log: BodyLog) => number | undefined
}[] = [
  { key: "weight", label: "Peso", unit: "kg", goal: "neutral", pick: (b) => b.weightKg },
  { key: "fatPct", label: "Gordura corporal", unit: "%", goal: "down", pick: (b) => b.bodyFatPct },
  { key: "fatMass", label: "Massa de gordura", unit: "kg", goal: "down", pick: fatMassOf },
  {
    key: "lean",
    label: "Massa magra",
    unit: "kg",
    goal: "up",
    pick: (b) => {
      const fat = fatMassOf(b)
      return fat !== undefined && (b.weightKg ?? 0) > 0 ? b.weightKg! - fat : undefined
    },
  },
  {
    key: "skeletal",
    label: "Músculo esquelético",
    unit: "kg",
    goal: "up",
    pick: (b) => b.skeletalMuscleKg,
  },
  { key: "waist", label: "Cintura", unit: "cm", goal: "down", pick: (b) => b.waistCm },
  { key: "visceral", label: "Gordura visceral", unit: "", goal: "down", pick: (b) => b.visceralFat },
]

export function bodyProgress(body: BodyLog[], windows: CompareWindows): BodyProgress[] {
  return BODY_METRICS.map((metric) => {
    const start = avgMetric(body, windows.startFrom, windows.startTo, metric.pick)
    const end = avgMetric(body, windows.endFrom, windows.endTo, metric.pick)
    return {
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      goal: metric.goal,
      start,
      end,
      delta:
        start !== null && end !== null ? Math.round((end - start) * 100) / 100 : null,
    }
  }).filter((row) => row.start !== null || row.end !== null)
}

/* ------------------------------------------------------------------ */
/* Série semanal                                                        */
/* ------------------------------------------------------------------ */

export interface ReportWeek {
  /** yyyy-MM-dd do início da semana */
  key: string
  label: string
  sessions: number
  volumeKg: number
  hardSets: number
  z2Minutes: number
  intenseMinutes: number
  kcal: number
  /** carga interna (AU) */
  load: number
}

/** Semanas do período em blocos de 7 dias a partir do início. */
export function reportWeeks(
  data: GymData,
  from: string,
  to: string,
  program: TrainingProgram
): ReportWeek[] {
  const weeks: ReportWeek[] = []
  const total = daysInPeriod(from, to)
  for (let index = 0; index * 7 < total; index++) {
    const start = shiftKey(from, index * 7)
    const rawEnd = shiftKey(start, 6)
    const end = rawEnd > to ? to : rawEnd
    const ws = data.workouts.filter((w) => w.date >= start && w.date <= end)
    let kcal = 0
    for (const w of ws) {
      const estimate = sessionKcal(w, weightKgOn(data.body, w.date))
      if (estimate) kcal += estimate.mid
    }
    const groups = hardSetsByGroup(ws)
    weeks.push({
      key: start,
      label: formatDayMonth(start),
      sessions: ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length,
      volumeKg: ws.reduce((s, w) => s + workoutVolume(w), 0),
      hardSets: Object.values(groups).reduce((s, v) => s + v, 0),
      z2Minutes: ws.reduce((s, w) => s + zone2Minutes(w), 0),
      intenseMinutes: ws.reduce((s, w) => s + intenseMinutes(w), 0),
      kcal,
      load: ws.reduce((s, w) => s + internalLoad(w), 0),
    })
  }
  return weeks
}

export interface MassPoint {
  date: string
  label: string
  weightKg: number
  fatKg: number | null
  leanKg: number | null
}

/** Pesagens do período com gordura e magra derivadas, em ordem cronológica. */
export function massSeries(body: BodyLog[], from: string, to: string): MassPoint[] {
  return body
    .filter((b) => b.date >= from && b.date <= to && (b.weightKg ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => {
      const fat = fatMassOf(b)
      return {
        date: b.date,
        label: formatDayMonth(b.date),
        weightKg: b.weightKg!,
        fatKg: fat !== undefined ? Math.round(fat * 10) / 10 : null,
        leanKg: fat !== undefined ? Math.round((b.weightKg! - fat) * 10) / 10 : null,
      }
    })
}

/* ------------------------------------------------------------------ */
/* Fechamento de bloco                                                  */
/* ------------------------------------------------------------------ */

export interface PrSummary {
  exerciseId: string
  name: string
  count: number
  /** yyyy-MM-dd do PR mais recente do período */
  lastDate: string
}

/**
 * PRs agrupados por exercício.
 *
 * Num bloco com progressão de carga, quase toda sessão bate PR — listar cada
 * evento datado enche duas páginas de ruído e some com o sinal. Agrupado, cada
 * linha responde "quanto esse levantamento avançou e quando foi a última vez".
 */
export function groupPrs(events: PrEvent[]): PrSummary[] {
  const byExercise = new Map<string, PrSummary>()
  for (const event of events) {
    const current = byExercise.get(event.exerciseId)
    const name =
      event.exerciseName ?? EXERCISES_BY_ID[event.exerciseId]?.name ?? event.exerciseId
    if (current) {
      current.count += 1
      if (event.date > current.lastDate) current.lastDate = event.date
    } else {
      byExercise.set(event.exerciseId, {
        exerciseId: event.exerciseId,
        name,
        count: 1,
        lastDate: event.date,
      })
    }
  }
  return [...byExercise.values()].sort(
    (a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate)
  )
}

export interface MuscleVolume {
  group: MuscleGroup
  hardSets: number
  /** séries duras por semana — a régua usual de volume */
  perWeek: number
}

export interface BlockReport {
  period: ReportPeriod
  weeks: number
  days: number
  program: TrainingProgram
  windows: CompareWindows
  totals: {
    sessions: number
    sessionsPerWeek: number
    volumeKg: number
    hardSets: number
    z2Minutes: number
    intenseMinutes: number
    cardioMinutes: number
    kcal: number
    /** total de PRs do período */
    prCount: number
    /** os mesmos PRs agrupados por exercício */
    prs: PrSummary[]
  }
  lifts: LiftProgress[]
  body: BodyProgress[]
  muscles: MuscleVolume[]
  weekly: ReportWeek[]
  /** prontidão ao fim do período (ACWR) */
  readiness: ReturnType<typeof computeReadiness>
  energy: EnergyReport
  massTrend: MassTrend
  mass: MassPoint[]
  highlights: string[]
  gaps: string[]
}

/** Piso usual de séries duras por semana para sustentar um grupo muscular. */
const MIN_HARD_SETS_PER_WEEK = 10
/** Variação de 1RM estimada que já não é ruído de medição. */
const LIFT_SIGNIFICANT_PCT = 2.5

export function blockReport(
  data: GymData,
  period: ReportPeriod,
  program: TrainingProgram
): BlockReport {
  const { from, to } = period
  const days = daysInPeriod(from, to)
  const weeks = weeksInPeriod(from, to)
  const windows = compareWindows(from, to)
  const ws = data.workouts.filter((w) => w.date >= from && w.date <= to)

  let kcal = 0
  for (const w of ws) {
    const estimate = sessionKcal(w, weightKgOn(data.body, w.date))
    if (estimate) kcal += estimate.mid
  }

  const groups = hardSetsByGroup(ws)
  const muscles: MuscleVolume[] = MUSCLE_GROUPS.map(({ id }) => ({
    group: id,
    hardSets: groups[id],
    perWeek: Math.round((groups[id] / weeks) * 10) / 10,
  }))
    .filter((row) => row.hardSets > 0)
    .sort((a, b) => b.hardSets - a.hardSets)

  const sessions = ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length
  const periodPrs = prEvents(data.workouts).filter((p) => p.date >= from && p.date <= to)
  const lifts = liftProgress(ws, windows)
  const body = bodyProgress(data.body, windows)
  const weekly = reportWeeks(data, from, to, program)
  const trend = massTrend(data.body, from, to)
  const energy = energyReport(data, fromDateKey(to), days)

  const highlights: string[] = []
  const gaps: string[] = []

  for (const lift of lifts) {
    if (lift.deltaPct !== null && lift.deltaPct >= LIFT_SIGNIFICANT_PCT) {
      highlights.push(
        `${lift.label}: 1RM estimada subiu ${lift.deltaPct.toFixed(1).replace(".", ",")}% (${lift.start} → ${lift.end} kg).`
      )
    } else if (lift.deltaPct !== null && lift.deltaPct <= -LIFT_SIGNIFICANT_PCT) {
      gaps.push(
        `${lift.label}: 1RM estimada caiu ${Math.abs(lift.deltaPct).toFixed(1).replace(".", ",")}% — confira fadiga acumulada ou execução.`
      )
    } else if (lift.sessions === 0) {
      gaps.push(`${lift.label}: nenhuma série registrada no período.`)
    }
  }

  const under = muscles.filter((m) => m.perWeek < MIN_HARD_SETS_PER_WEEK)
  if (under.length > 0) {
    gaps.push(
      `Abaixo de ${MIN_HARD_SETS_PER_WEEK} séries duras por semana: ${under
        .map((m) => `${m.group} (${m.perWeek.toLocaleString("pt-BR")})`)
        .join(", ")}.`
    )
  }

  const fat = body.find((row) => row.key === "fatMass")
  const lean = body.find((row) => row.key === "lean")
  if (fat?.delta !== null && fat?.delta !== undefined && lean?.delta !== null && lean?.delta !== undefined) {
    if (fat.delta <= -0.2 && lean.delta >= -0.2) {
      highlights.push(
        `Recomposição: ${Math.abs(fat.delta).toFixed(1).replace(".", ",")} kg de gordura a menos com massa magra preservada.`
      )
    } else if (fat.delta >= 0.2) {
      gaps.push(
        `Massa de gordura subiu ${fat.delta.toFixed(1).replace(".", ",")} kg no bloco — o ajuste é de ingestão, não de treino.`
      )
    }
  }

  const z2PerWeek = Math.round(weekly.reduce((s, w) => s + w.z2Minutes, 0) / weeks)
  if (z2PerWeek >= 60) {
    highlights.push(`Base aeróbica sustentada: ${z2PerWeek} min de Zona 2 por semana.`)
  } else if (z2PerWeek > 0) {
    gaps.push(`Zona 2 em ${z2PerWeek} min/semana, abaixo dos 60 min de referência.`)
  }

  const sessionsPerWeek = Math.round((sessions / weeks) * 10) / 10
  if (sessionsPerWeek >= 3) {
    highlights.push(`Frequência de ${sessionsPerWeek.toLocaleString("pt-BR")} sessões por semana.`)
  } else {
    gaps.push(
      `Frequência de ${sessionsPerWeek.toLocaleString("pt-BR")} sessões por semana — abaixo das 3 que sustentam massa magra.`
    )
  }

  if (energy.trend.storedKcalPerDay !== null && energy.budget) {
    highlights.push(energy.verdict)
  }

  return {
    period,
    weeks: Math.round(weeks * 10) / 10,
    days,
    program,
    windows,
    totals: {
      sessions,
      sessionsPerWeek,
      volumeKg: ws.reduce((s, w) => s + workoutVolume(w), 0),
      hardSets: muscles.reduce((s, m) => s + m.hardSets, 0),
      z2Minutes: weekly.reduce((s, w) => s + w.z2Minutes, 0),
      intenseMinutes: weekly.reduce((s, w) => s + w.intenseMinutes, 0),
      cardioMinutes: ws.reduce((s, w) => s + totalCardioMinutes(w), 0),
      kcal,
      prCount: periodPrs.length,
      prs: groupPrs(periodPrs),
    },
    lifts,
    body,
    muscles,
    weekly,
    readiness: computeReadiness(data.workouts, fromDateKey(to)),
    energy,
    massTrend: trend,
    mass: massSeries(data.body, from, to),
    highlights,
    gaps,
  }
}

/* ------------------------------------------------------------------ */
/* Relatório para nutricionista                                         */
/* ------------------------------------------------------------------ */

export interface NutritionProfile {
  measuredAt: string
  weightKg: number
  /** derivada de peso e IMC (a balança não guarda altura) */
  heightM: number | null
  bmi: number | null
  bodyFatPct: number | null
  fatMassKg: number | null
  leanMassKg: number | null
  skeletalMuscleKg: number | null
  waterPct: number | null
  visceralFat: number | null
  bmrKcal: number | null
}

export interface NutritionReport {
  period: ReportPeriod
  days: number
  weeks: number
  profile: NutritionProfile | null
  energy: EnergyReport
  mass: MassPoint[]
  weekly: ReportWeek[]
  /** saldo energético semanal, para a consistência semana a semana */
  balance: EnergyBalancePoint[]
  training: {
    sessions: number
    sessionsPerWeek: number
    kcalPerWeek: number
    liftKcal: number
    cardioKcal: number
    cardioMinutes: number
  }
  hydration: {
    avgMl: number | null
    goalMl: number
    daysLogged: number
    adherencePct: number | null
  }
  sleep: {
    avgMinutes: number | null
    nights: number
  }
}

function latestProfile(body: BodyLog[], to: string): NutritionProfile | null {
  const candidates = body
    .filter((b) => b.date <= to && (b.weightKg ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  const latest = candidates[candidates.length - 1]
  if (!latest) return null
  const withBio = [...candidates].reverse().find((b) => b.bodyFatPct !== undefined) ?? latest
  const fat = fatMassOf(withBio)
  const weightKg = latest.weightKg!
  return {
    measuredAt: withBio.date,
    weightKg,
    // IMC = kg / m² → m = √(kg / IMC). A balança reporta IMC, não altura.
    heightM:
      withBio.bmi && withBio.bmi > 0 && (withBio.weightKg ?? 0) > 0
        ? Math.round(Math.sqrt(withBio.weightKg! / withBio.bmi) * 100) / 100
        : null,
    bmi: withBio.bmi ?? null,
    bodyFatPct: withBio.bodyFatPct ?? null,
    fatMassKg: fat ?? null,
    leanMassKg:
      fat !== undefined && (withBio.weightKg ?? 0) > 0
        ? Math.round((withBio.weightKg! - fat) * 10) / 10
        : null,
    skeletalMuscleKg: withBio.skeletalMuscleKg ?? null,
    waterPct: withBio.waterPct ?? null,
    visceralFat: withBio.visceralFat ?? null,
    bmrKcal: withBio.bmrKcal ?? null,
  }
}

export function nutritionReport(
  data: GymData,
  period: ReportPeriod,
  program: TrainingProgram
): NutritionReport {
  const { from, to } = period
  const days = daysInPeriod(from, to)
  const weeks = weeksInPeriod(from, to)
  const ws = data.workouts.filter((w) => w.date >= from && w.date <= to)

  let liftKcal = 0
  let cardioKcal = 0
  for (const w of ws) {
    const estimate = sessionKcal(w, weightKgOn(data.body, w.date))
    if (!estimate) continue
    liftKcal += estimate.lift
    cardioKcal += estimate.cardio
  }

  const mass = massSeries(data.body, from, to)

  const hydrationLogs = data.hydration.filter((h) => h.date >= from && h.date <= to && h.ml > 0)
  const goalMl = waterGoalMl(data.body)
  const avgMl =
    hydrationLogs.length > 0
      ? Math.round(hydrationLogs.reduce((s, h) => s + h.ml, 0) / hydrationLogs.length)
      : null

  const sleepLogs = data.sleep.filter((s) => s.date >= from && s.date <= to)
  const avgSleep =
    sleepLogs.length > 0
      ? Math.round(sleepLogs.reduce((s, l) => s + l.durationMin, 0) / sleepLogs.length)
      : null

  const sessions = ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length

  return {
    period,
    days,
    weeks: Math.round(weeks * 10) / 10,
    profile: latestProfile(data.body, to),
    energy: energyReport(data, fromDateKey(to), days),
    mass,
    weekly: reportWeeks(data, from, to, program),
    balance: energyBalanceSeries(
      data,
      fromDateKey(to),
      Math.max(2, Math.ceil(days / 7))
    ).points,
    training: {
      sessions,
      sessionsPerWeek: Math.round((sessions / weeks) * 10) / 10,
      kcalPerWeek: Math.round(((liftKcal + cardioKcal) / days) * 7),
      liftKcal,
      cardioKcal,
      cardioMinutes: Math.round(ws.reduce((s, w) => s + totalCardioMinutes(w), 0)),
    },
    hydration: {
      avgMl,
      goalMl,
      daysLogged: hydrationLogs.length,
      adherencePct: avgMl !== null ? Math.round((avgMl / goalMl) * 100) : null,
    },
    sleep: { avgMinutes: avgSleep, nights: sleepLogs.length },
  }
}
