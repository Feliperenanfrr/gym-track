import { engineBlockWindows } from "./engine-plan"
import {
  cardioBlocks,
  cardioPurposeOf,
  intenseMinutes,
  sportMinutes,
  totalCardioMinutes,
  zone2Minutes,
} from "./cardio"
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
import { countsTowardProgramTarget, EXERCISES_BY_ID, PLAN_BY_ID } from "./plan"
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
 * O ciclo de motor tem blocos nomeados com janelas próprias (derivadas da
 * data de início do plano), então eles entram como preset — é literalmente
 * "fechar o bloco". A hipertrofia roda em ciclo rotativo, sem bloco: ali só
 * fazem sentido as janelas móveis. Blocos que ainda não começaram ficam de fora.
 */
export function reportPeriods(today: Date): ReportPeriod[] {
  const todayKey = toDateKey(today)
  const periods: ReportPeriod[] = []

  for (const window of engineBlockWindows()) {
    if (window.start > todayKey) continue
    const end = window.end === null || window.end > todayKey ? todayKey : window.end
    periods.push({
      id: `engine-${window.id}`,
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

/* ------------------------------------------------------------------ */
/* Relatório para o preparador físico                                  */
/* ------------------------------------------------------------------ */

export type DataConfidence = "alta" | "moderada" | "baixa"

export interface CoachQualityItem {
  domain: string
  value: string
  detail: string
  confidence: DataConfidence
}

export interface CoachWeek {
  key: string
  label: string
  sessions: number
  strengthSessions: number
  durationMin: number
  load: number
  z2Minutes: number
  intenseMinutes: number
  sportMinutes: number
}

export interface CoachLift {
  exerciseId: string
  name: string
  muscleGroup: MuscleGroup | null
  sessions: number
  sets: number
  rirCoveragePct: number
  baseE1rm: number
  recentE1rm: number
  bestE1rm: number
  deltaPct: number | null
  firstDate: string
  lastDate: string
  confidence: DataConfidence
  variantChanged: boolean
}

export interface CoachReport {
  period: ReportPeriod
  days: number
  weeks: number
  program: TrainingProgram
  purpose: string
  periodStatus: "concluido" | "parcial" | "janela-movel"
  quality: CoachQualityItem[]
  training: {
    sessions: number
    activeDays: number
    sessionsPerWeek: number
    strengthSessions: number
    conditioningSessions: number
    totalDurationMin: number
    durationCoveragePct: number
    srpeCoveragePct: number
    avgSrpe: number | null
    totalLoad: number
    loadPerWeek: number
    sessionTypes: {
      id: string
      label: string
      sessions: number
      durationMin: number
      load: number
    }[]
  }
  weekly: CoachWeek[]
  lifts: CoachLift[]
  muscles: MuscleVolume[]
  body: {
    latest: BodyLog | null
    trend: MassTrend
    comparison: BodyProgress[]
    mass: MassPoint[]
    weightPoints: number
    compositionPoints: number
    waistPoints: number
    waistStartCm: number | null
    waistEndCm: number | null
    waistDeltaCm: number | null
  }
  conditioning: {
    blocks: number
    inferredPurposeBlocks: number
    totalMinutes: number
    minutesPerWeek: number
    z2Minutes: number
    intenseMinutes: number
    sportMinutes: number
    bpmBlocks: number
    bpmCoveragePct: number
    avgBpm: number | null
    distanceKm: number
  }
  recovery: {
    hydration: {
      days: number
      coveragePct: number
      avgMl: number | null
      medianMl: number | null
      goalMl: number
      daysAtGoal: number
      latestDate: string | null
    }
    sleep: {
      nights: number
      coveragePct: number
      avgMinutes: number | null
      medianMinutes: number | null
      nightsUnder7h: number
      midpointDriftMin: number | null
      latestDate: string | null
    }
  }
  questions: string[]
}

function percentage(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function standardDeviation(values: number[]): number | null {
  const mean = average(values)
  if (mean === null || values.length < 2) return null
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function periodConfidence(points: number, spanDays: number): DataConfidence {
  if (points >= 6 && spanDays >= 21) return "alta"
  if (points >= 3 && spanDays >= 14) return "moderada"
  return "baixa"
}

function coverageConfidence(coveragePct: number): DataConfidence {
  if (coveragePct >= 70) return "alta"
  if (coveragePct >= 40) return "moderada"
  return "baixa"
}

function coachPeriodStatus(period: ReportPeriod): CoachReport["periodStatus"] {
  if (!period.id.startsWith("engine-")) return "janela-movel"
  const id = period.id.slice("engine-".length)
  const block = engineBlockWindows().find((window) => window.id === id)
  return block?.end && period.to >= block.end ? "concluido" : "parcial"
}

function coachWeeks(workouts: WorkoutLog[], from: string, to: string): CoachWeek[] {
  const weeks: CoachWeek[] = []
  const total = daysInPeriod(from, to)
  for (let index = 0; index * 7 < total; index++) {
    const start = shiftKey(from, index * 7)
    const end = [shiftKey(start, 6), to].sort()[0]
    const rows = workouts.filter(
      (workout) => workout.date >= start && workout.date <= end && workout.sessionId !== "rest"
    )
    weeks.push({
      key: start,
      label: formatDayMonth(start),
      sessions: rows.length,
      strengthSessions: rows.filter((workout) => workout.entries.length > 0).length,
      durationMin: Math.round(
        rows.reduce(
          (sum, workout) => sum + (workout.durationMin ?? totalCardioMinutes(workout)),
          0
        )
      ),
      load: Math.round(rows.reduce((sum, workout) => sum + internalLoad(workout), 0)),
      z2Minutes: rows.reduce((sum, workout) => sum + zone2Minutes(workout), 0),
      intenseMinutes: rows.reduce((sum, workout) => sum + intenseMinutes(workout), 0),
      sportMinutes: rows.reduce((sum, workout) => sum + sportMinutes(workout), 0),
    })
  }
  return weeks
}

function coachLifts(workouts: WorkoutLog[], latestWeightKg: number | null): CoachLift[] {
  type SessionPoint = {
    date: string
    e1rm: number
    sets: number
    rirSets: number
    explicitName?: string
    muscleGroup?: MuscleGroup
  }
  const byExercise = new Map<string, SessionPoint[]>()

  for (const workout of workouts) {
    for (const entry of workout.entries) {
      const comparableSets = entry.sets.filter(
        (set) => set.weight > 0 && set.reps > 0 && set.reps <= 12
      )
      if (comparableSets.length === 0) continue
      const e1rm = bestE1RMAdjusted({ ...entry, sets: comparableSets })
      if (e1rm <= 0) continue
      const points = byExercise.get(entry.exerciseId) ?? []
      points.push({
        date: workout.date,
        e1rm,
        sets: comparableSets.length,
        rirSets: comparableSets.filter((set) => set.rir !== undefined).length,
        explicitName: entry.exerciseName,
        muscleGroup: entry.muscleGroup,
      })
      byExercise.set(entry.exerciseId, points)
    }
  }

  const rows: CoachLift[] = []
  for (const [exerciseId, rawPoints] of byExercise) {
    const points = [...rawPoints].sort((a, b) => a.date.localeCompare(b.date))
    if (points.length < 2) continue
    const explicitNames = new Set(
      points.map((point) => point.explicitName?.trim()).filter((name): name is string => Boolean(name))
    )
    const variantChanged = explicitNames.size > 1
    const edge = points.length >= 4 ? 2 : 1
    const baseE1rm = average(points.slice(0, edge).map((point) => point.e1rm))!
    const recentE1rm = average(points.slice(-edge).map((point) => point.e1rm))!
    const spanDays = Math.round(
      (fromDateKey(points[points.length - 1].date).getTime() - fromDateKey(points[0].date).getTime()) /
        DAY_MS
    )
    const sets = points.reduce((sum, point) => sum + point.sets, 0)
    const rirSets = points.reduce((sum, point) => sum + point.rirSets, 0)
    const catalog = EXERCISES_BY_ID[exerciseId]
    const explicitName = [...explicitNames][explicitNames.size - 1]
    rows.push({
      exerciseId,
      name: explicitName ?? catalog?.name ?? exerciseId,
      muscleGroup: points.findLast((point) => point.muscleGroup)?.muscleGroup ?? catalog?.muscleGroup ?? null,
      sessions: points.length,
      sets,
      rirCoveragePct: percentage(rirSets, sets),
      baseE1rm: Math.round(baseE1rm * 10) / 10,
      recentE1rm: Math.round(recentE1rm * 10) / 10,
      bestE1rm: Math.round(Math.max(...points.map((point) => point.e1rm)) * 10) / 10,
      deltaPct:
        variantChanged || baseE1rm <= 0
          ? null
          : Math.round(((recentE1rm - baseE1rm) / baseE1rm) * 1000) / 10,
      firstDate: points[0].date,
      lastDate: points[points.length - 1].date,
      confidence: variantChanged ? "baixa" : periodConfidence(points.length, spanDays),
      variantChanged,
    })
  }

  return rows
    .sort((a, b) => b.sessions - a.sessions || b.sets - a.sets || b.bestE1rm - a.bestE1rm)
    .slice(0, latestWeightKg ? 8 : 7)
}

function sleepMidpointMinutes(log: GymData["sleep"][number]): number | null {
  const parse = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number)
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null
  }
  const start = parse(log.sleptAt)
  if (start === null) return null
  const adjustedStart = start < 12 * 60 ? start + 24 * 60 : start
  return adjustedStart + log.durationMin / 2
}

/**
 * Documento de passagem para um preparador físico.
 *
 * Prioriza exposição, carga, desempenho e confiabilidade dos registros. Não
 * prescreve o próximo ciclo e não transforma estimativas calóricas em achado.
 */
export function coachReport(
  data: GymData,
  period: ReportPeriod,
  program: TrainingProgram
): CoachReport {
  const { from, to } = period
  const days = daysInPeriod(from, to)
  const weeks = weeksInPeriod(from, to)
  const workouts = data.workouts.filter(
    (workout) => workout.date >= from && workout.date <= to && workout.sessionId !== "rest"
  )
  const bodyLogs = data.body
    .filter((log) => log.date >= from && log.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
  const weightLogs = bodyLogs.filter((log) => (log.weightKg ?? 0) > 0)
  const compositionLogs = bodyLogs.filter((log) => fatMassOf(log) !== undefined)
  const waistLogs = bodyLogs.filter((log) => (log.waistCm ?? 0) > 0)
  const latestBody = bodyLogs[bodyLogs.length - 1] ?? null
  const latestWeightKg = [...weightLogs].reverse()[0]?.weightKg ?? null
  const durationLogs = workouts.filter((workout) => (workout.durationMin ?? 0) > 0)
  const srpeLogs = workouts.filter((workout) => (workout.srpe ?? 0) > 0)
  const totalDurationMin = Math.round(
    workouts.reduce(
      (sum, workout) => sum + (workout.durationMin ?? totalCardioMinutes(workout)),
      0
    )
  )
  const totalLoad = Math.round(workouts.reduce((sum, workout) => sum + internalLoad(workout), 0))
  const activeDays = new Set(workouts.map((workout) => workout.date)).size

  const sessionMap = new Map<
    string,
    { id: string; label: string; sessions: number; durationMin: number; load: number }
  >()
  for (const workout of workouts) {
    const current = sessionMap.get(workout.sessionId) ?? {
      id: workout.sessionId,
      label: PLAN_BY_ID[workout.sessionId]?.title ?? workout.sessionId,
      sessions: 0,
      durationMin: 0,
      load: 0,
    }
    current.sessions += 1
    current.durationMin += workout.durationMin ?? totalCardioMinutes(workout)
    current.load += internalLoad(workout)
    sessionMap.set(workout.sessionId, current)
  }

  const groups = hardSetsByGroup(workouts)
  const muscles: MuscleVolume[] = MUSCLE_GROUPS.map(({ id }) => ({
    group: id,
    hardSets: groups[id],
    perWeek: Math.round((groups[id] / weeks) * 10) / 10,
  }))
    .filter((row) => row.hardSets > 0)
    .sort((a, b) => b.hardSets - a.hardSets)

  const blocks = workouts.flatMap((workout) =>
    cardioBlocks(workout).map((block) => ({
      block,
      purpose: cardioPurposeOf(block, workout.sessionId),
      minutes:
        block.durationSeconds !== undefined && block.durationSeconds > 0
          ? block.durationSeconds / 60
          : block.minutes,
    }))
  )
  const totalCardio = blocks.reduce((sum, item) => sum + item.minutes, 0)
  const bpmBlocks = blocks.filter((item) => (item.block.avgBpm ?? 0) > 0)
  const bpmMinutes = bpmBlocks.reduce((sum, item) => sum + item.minutes, 0)
  const weightedBpm = bpmBlocks.reduce(
    (sum, item) => sum + item.block.avgBpm! * item.minutes,
    0
  )

  const hydrationLogs = data.hydration.filter(
    (log) => log.date >= from && log.date <= to && log.ml > 0
  )
  const hydrationGoal = waterGoalMl(data.body)
  const sleepLogs = data.sleep.filter(
    (log) => log.date >= from && log.date <= to && log.durationMin > 0
  )
  const sleepMidpoints = sleepLogs
    .map(sleepMidpointMinutes)
    .filter((value): value is number => value !== null)

  const windows = compareWindows(from, to)
  const trend = massTrend(data.body, from, to)
  const weightSpan =
    weightLogs.length >= 2
      ? Math.round(
          (fromDateKey(weightLogs[weightLogs.length - 1].date).getTime() -
            fromDateKey(weightLogs[0].date).getTime()) /
            DAY_MS
        )
      : 0
  const durationCoveragePct = percentage(durationLogs.length, workouts.length)
  const srpeCoveragePct = percentage(srpeLogs.length, workouts.length)
  const hydrationCoveragePct = percentage(hydrationLogs.length, days)
  const sleepCoveragePct = percentage(sleepLogs.length, days)
  const liftRows = coachLifts(workouts, latestWeightKg)

  const quality: CoachQualityItem[] = [
    {
      domain: "Treino",
      value: `${workouts.length} sessões`,
      detail: `${durationCoveragePct}% com duração · ${srpeCoveragePct}% com sRPE`,
      confidence:
        workouts.length >= 6 && durationCoveragePct >= 75 && srpeCoveragePct >= 70
          ? "alta"
          : workouts.length >= 3
            ? "moderada"
            : "baixa",
    },
    {
      domain: "Corpo",
      value: `${weightLogs.length} pesagens`,
      detail: `${compositionLogs.length} com composição · ${waistLogs.length} cinturas`,
      confidence: periodConfidence(weightLogs.length, weightSpan),
    },
    {
      domain: "Sono",
      value: `${sleepLogs.length}/${days} noites`,
      detail: `${sleepCoveragePct}% do periodo`,
      confidence: coverageConfidence(sleepCoveragePct),
    },
    {
      domain: "Hidratação",
      value: `${hydrationLogs.length}/${days} dias`,
      detail: `${hydrationCoveragePct}% do periodo`,
      confidence: coverageConfidence(hydrationCoveragePct),
    },
  ]

  const waistStart = average(waistLogs.slice(0, Math.min(2, waistLogs.length)).map((log) => log.waistCm!))
  const waistEnd = average(waistLogs.slice(-Math.min(2, waistLogs.length)).map((log) => log.waistCm!))
  const periodStatus = coachPeriodStatus(period)
  const conditioningMinutes = {
    zone2: blocks.filter((item) => item.purpose === "zone2").reduce((sum, item) => sum + item.minutes, 0),
    intense: blocks.filter((item) => item.purpose === "intense").reduce((sum, item) => sum + item.minutes, 0),
    sport: blocks.filter((item) => item.purpose === "sport").reduce((sum, item) => sum + item.minutes, 0),
  }

  const questions = [
    "Definir o objetivo primário e o critério de sucesso do próximo ciclo.",
    "Escolher 3 a 5 testes estáveis de força e condicionamento para reavaliação.",
    "Revisar a distribuição semanal entre sala, cardio e prática esportiva.",
  ]
  if (periodStatus === "parcial") {
    questions.push("Tratar este recorte como parcial; o bloco atual ainda não terminou.")
  }
  if (program === "engine") {
    questions.push(
      "Confirmar as zonas de FC com teste ergométrico; as faixas em uso são estimadas a partir do próprio registro."
    )
  }
  if (sleepCoveragePct < 40 || hydrationCoveragePct < 40) {
    questions.push("Confirmar recuperação na anamnese; sono ou hidratação tem baixa cobertura.")
  }
  if (liftRows.some((lift) => lift.variantChanged)) {
    questions.push("Padronizar aparelho/variante antes de usar 1RM estimada como teste.")
  }

  return {
    period,
    days,
    weeks: Math.round(weeks * 10) / 10,
    program,
    purpose:
      program === "engine"
        ? "Revisão do ciclo de capacidade cardiorrespiratória e perda de gordura."
        : "Revisão de hipertrofia, força e composição corporal para reconstrução do plano.",
    periodStatus,
    quality,
    training: {
      sessions: workouts.length,
      activeDays,
      sessionsPerWeek: Math.round((workouts.length / weeks) * 10) / 10,
      strengthSessions: workouts.filter((workout) => workout.entries.length > 0).length,
      conditioningSessions: workouts.filter((workout) => cardioBlocks(workout).length > 0).length,
      totalDurationMin,
      durationCoveragePct,
      srpeCoveragePct,
      avgSrpe: srpeLogs.length > 0 ? average(srpeLogs.map((workout) => workout.srpe!)) : null,
      totalLoad,
      loadPerWeek: Math.round(totalLoad / weeks),
      sessionTypes: [...sessionMap.values()]
        .map((row) => ({ ...row, durationMin: Math.round(row.durationMin), load: Math.round(row.load) }))
        .sort((a, b) => b.sessions - a.sessions || b.durationMin - a.durationMin),
    },
    weekly: coachWeeks(workouts, from, to),
    lifts: liftRows,
    muscles,
    body: {
      latest: latestBody,
      trend,
      comparison: bodyProgress(data.body, windows),
      mass: massSeries(data.body, from, to),
      weightPoints: weightLogs.length,
      compositionPoints: compositionLogs.length,
      waistPoints: waistLogs.length,
      waistStartCm: waistStart !== null ? Math.round(waistStart * 10) / 10 : null,
      waistEndCm: waistEnd !== null ? Math.round(waistEnd * 10) / 10 : null,
      waistDeltaCm:
        waistStart !== null && waistEnd !== null
          ? Math.round((waistEnd - waistStart) * 10) / 10
          : null,
    },
    conditioning: {
      blocks: blocks.length,
      inferredPurposeBlocks: blocks.filter((item) => item.block.purpose === undefined).length,
      totalMinutes: Math.round(totalCardio),
      minutesPerWeek: Math.round(totalCardio / weeks),
      z2Minutes: Math.round(conditioningMinutes.zone2),
      intenseMinutes: Math.round(conditioningMinutes.intense),
      sportMinutes: Math.round(conditioningMinutes.sport),
      bpmBlocks: bpmBlocks.length,
      bpmCoveragePct: percentage(bpmBlocks.length, blocks.length),
      avgBpm: bpmMinutes > 0 ? Math.round(weightedBpm / bpmMinutes) : null,
      distanceKm:
        Math.round(
          blocks.reduce((sum, item) => sum + (item.block.distanceKm ?? 0), 0) * 10
        ) / 10,
    },
    recovery: {
      hydration: {
        days: hydrationLogs.length,
        coveragePct: hydrationCoveragePct,
        avgMl: hydrationLogs.length > 0 ? Math.round(average(hydrationLogs.map((log) => log.ml))!) : null,
        medianMl:
          hydrationLogs.length > 0 ? Math.round(median(hydrationLogs.map((log) => log.ml))!) : null,
        goalMl: hydrationGoal,
        daysAtGoal: hydrationLogs.filter((log) => log.ml >= hydrationGoal).length,
        latestDate: [...hydrationLogs].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date ?? null,
      },
      sleep: {
        nights: sleepLogs.length,
        coveragePct: sleepCoveragePct,
        avgMinutes: sleepLogs.length > 0 ? Math.round(average(sleepLogs.map((log) => log.durationMin))!) : null,
        medianMinutes:
          sleepLogs.length > 0 ? Math.round(median(sleepLogs.map((log) => log.durationMin))!) : null,
        nightsUnder7h: sleepLogs.filter((log) => log.durationMin < 7 * 60).length,
        midpointDriftMin:
          sleepMidpoints.length >= 2 ? Math.round(standardDeviation(sleepMidpoints)!) : null,
        latestDate: [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date ?? null,
      },
    },
    questions: questions.slice(0, 6),
  }
}
