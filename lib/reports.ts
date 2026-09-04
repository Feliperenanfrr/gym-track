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
import {
  consistencyInRange,
  RangeConsistency,
  TrainingDayKind,
  trainingDayKinds,
  weeklySessionTarget,
} from "./consistency"
import { isStrengthLog } from "./cycle"
import { EXERCISE_GROUP, hardSetsByGroup, MUSCLE_GROUPS } from "./muscles"
import { countsTowardProgramTarget, EXERCISES_BY_ID, PLAN_BY_ID } from "./plan"
import {
  DEFAULT_STEP,
  inferLoadStep,
  LAYOFF_DELOAD_DAYS,
  roundToStep,
} from "./progression"
import {
  exerciseStrength,
  frequentExercises,
  relativeLoadBoard,
  RelativeLoadRow,
  RELATIVE_LOAD_ALERT_PCT,
} from "./strength"
import { BodyLog, GymData, MuscleGroup, TrainingProgram, WorkoutLog } from "./types"
import { fromDateKey, mondayOf, toDateKey, workoutVolume } from "./utils"

const DAY_MS = 86_400_000

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

/** kg em pt-BR, sem zero decorativo ("52,5" / "50") */
function formatKgBr(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
}

function formatPct(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
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

/* ------------------------------------------------------------------ */
/* Confiança dos dados                                                  */
/* ------------------------------------------------------------------ */

export type DataConfidence = "alta" | "moderada" | "baixa"

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

/* ------------------------------------------------------------------ */
/* Força                                                                */
/* ------------------------------------------------------------------ */

/** Exercícios detalhados na tabela de força de um documento. */
export const MAX_LIFT_LINES = 8
/** Variação de carga que já não é troca de aparelho nem arredondamento. */
export const LIFT_SIGNIFICANT_PCT = 5

export interface LiftLine {
  exerciseId: string
  name: string
  muscleGroup: MuscleGroup | null
  sessions: number
  sets: number
  firstDate: string
  lastDate: string
  /** carga do top set na primeira e na última sessão do período (kg) */
  firstWeight: number
  lastWeight: number
  firstReps: number
  lastReps: number
  deltaKg: number | null
  deltaPct: number | null
  /** maior carga do período */
  bestWeight: number
  /** lastWeight ÷ bestWeight × 100 — onde está em relação ao próprio teto */
  relativePct: number
  /** 1RM estimada só onde vale: séries de até 8 repetições efetivas */
  e1rmFirst: number | null
  e1rmLast: number | null
  e1rmPoints: number
  /** o nome gravado no log mudou dentro do período (trocou de aparelho) */
  variantChanged: boolean
  confidence: DataConfidence
}

/**
 * Tabela de força a partir do que foi de fato treinado, medida pela CARGA do
 * top set.
 *
 * Duas correções de uma vez, ambas já feitas no painel e ausentes aqui:
 *
 * A lista de exercícios sai do histórico do período, não de uma lista fixa.
 * A fixa oferecia levantamento terra — zero séries em todo o registro, linha
 * inteira em "—" — e escondia os quatro mais treinados.
 *
 * A métrica é a carga movida, não a 1RM extrapolada. Em séries de 12 a 15
 * repetições o erro de Epley fica maior que o efeito: a mesma cadeira
 * extensora produzia 154, 90, 133 e 66 kg estimados em dez semanas sem que
 * nada disso tivesse acontecido. A 1RM continua na tabela, mas só quando há
 * dois pontos com reps efetivas dentro do teto confiável.
 */
export function reportLifts(
  workouts: WorkoutLog[],
  from: string,
  to: string,
  limit = MAX_LIFT_LINES
): LiftLine[] {
  const ws = workouts.filter((w) => w.date >= from && w.date <= to)
  const frequent = frequentExercises(ws, fromDateKey(to), {
    days: daysInPeriod(from, to),
    limit,
  })

  const lines: LiftLine[] = []
  for (const { id, sets } of frequent) {
    const strength = exerciseStrength(ws, id)
    const first = strength.first
    const last = strength.last
    if (!first || !last || strength.points.length < 2) continue

    const names = new Set<string>()
    let muscleGroup: MuscleGroup | null = null
    for (const w of ws) {
      for (const entry of w.entries) {
        if (entry.exerciseId !== id) continue
        if (entry.exerciseName?.trim()) names.add(entry.exerciseName.trim())
        if (entry.muscleGroup) muscleGroup = entry.muscleGroup
      }
    }
    const variantChanged = names.size > 1
    const spanDays = Math.round(
      (fromDateKey(last.date).getTime() - fromDateKey(first.date).getTime()) / DAY_MS
    )
    const reliable = strength.points.filter((point) => point.e1rm !== null)

    lines.push({
      exerciseId: id,
      name: strength.name,
      muscleGroup:
        muscleGroup ?? EXERCISES_BY_ID[id]?.muscleGroup ?? EXERCISE_GROUP[id] ?? null,
      sessions: strength.points.length,
      sets,
      firstDate: first.date,
      lastDate: last.date,
      firstWeight: first.carga,
      lastWeight: last.carga,
      firstReps: first.reps,
      lastReps: last.reps,
      deltaKg: Math.round((last.carga - first.carga) * 10) / 10,
      deltaPct:
        first.carga > 0
          ? Math.round(((last.carga - first.carga) / first.carga) * 1000) / 10
          : null,
      bestWeight: strength.bestWeight,
      relativePct:
        strength.bestWeight > 0
          ? Math.round((last.carga / strength.bestWeight) * 100)
          : 0,
      e1rmFirst: reliable.length >= 2 ? reliable[0].e1rm : null,
      e1rmLast: reliable.length >= 2 ? reliable[reliable.length - 1].e1rm : null,
      e1rmPoints: reliable.length,
      variantChanged,
      confidence: variantChanged
        ? "baixa"
        : periodConfidence(strength.points.length, spanDays),
    })
  }

  return lines.sort(
    (a, b) => b.sessions - a.sessions || b.sets - a.sets || a.name.localeCompare(b.name)
  )
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
  /** todas as sessões registradas na semana (descanso não conta) */
  sessions: number
  /** as que contam para o alvo do programa ativo */
  plannedSessions: number
  /** dias distintos com algum registro */
  days: number
  /** sessões com pelo menos uma série de musculação */
  strengthSessions: number
  durationMin: number
  volumeKg: number
  hardSets: number
  z2Minutes: number
  intenseMinutes: number
  sportMinutes: number
  kcal: number
  /** carga interna (AU) */
  load: number
  /** alvo de sessões do programa na semana */
  target: number
  onTarget: boolean
}

/**
 * Semanas do período em blocos de 7 dias a partir do início.
 *
 * Uma implementação só para os três documentos. Antes havia duas — a do
 * fechamento contava apenas sessões do programa ativo, a do dossiê contava
 * todas — e a mesma semana saía com 0 e com 5 sessões em dois PDFs do mesmo
 * dia. Agora as duas contagens convivem na mesma linha, cada uma com nome.
 */
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
    const ws = data.workouts.filter(
      (w) => w.date >= start && w.date <= end && w.sessionId !== "rest"
    )
    let kcal = 0
    for (const w of ws) {
      const estimate = sessionKcal(w, weightKgOn(data.body, w.date))
      if (estimate) kcal += estimate.mid
    }
    const groups = hardSetsByGroup(ws)
    const plannedSessions = ws.filter((w) =>
      countsTowardProgramTarget(w.sessionId, program)
    ).length
    const target = weeklySessionTarget(program, fromDateKey(start))
    weeks.push({
      key: start,
      label: formatDayMonth(start),
      sessions: ws.length,
      plannedSessions,
      days: new Set(ws.map((w) => w.date)).size,
      strengthSessions: ws.filter((w) => w.entries.length > 0).length,
      durationMin: Math.round(
        ws.reduce((sum, w) => sum + (w.durationMin ?? totalCardioMinutes(w)), 0)
      ),
      volumeKg: ws.reduce((s, w) => s + workoutVolume(w), 0),
      hardSets: Object.values(groups).reduce((s, v) => s + v, 0),
      z2Minutes: ws.reduce((s, w) => s + zone2Minutes(w), 0),
      intenseMinutes: ws.reduce((s, w) => s + intenseMinutes(w), 0),
      sportMinutes: ws.reduce((s, w) => s + sportMinutes(w), 0),
      kcal,
      load: Math.round(ws.reduce((s, w) => s + internalLoad(w), 0)),
      target,
      onTarget: plannedSessions >= target,
    })
  }
  return weeks
}

export interface SessionTotals {
  /** sessões registradas no período (descanso fora) */
  sessions: number
  /** as que contam para o alvo do programa ativo */
  plannedSessions: number
  /** dias distintos com treino */
  activeDays: number
  sessionsPerWeek: number
  strengthSessions: number
  conditioningSessions: number
  durationMin: number
  durationCoveragePct: number
  srpeCoveragePct: number
  avgSrpe: number | null
  load: number
  loadPerWeek: number
}

/**
 * Exposição do período — a contagem única de sessões dos três documentos.
 *
 * A manchete é `sessions`: tudo que foi registrado. O alvo do programa vira
 * uma segunda linha, nomeada. Contar só o que casa com o programa ativo fazia
 * o fechamento imprimir "9 sessões · 0,8 por semana" num período com 37
 * treinos e 121 toneladas — e o veredito automático reclamava da frequência
 * enquanto o bloco de energia do mesmo PDF calculava 3,1 sessões por semana.
 */
export function sessionTotals(
  workouts: WorkoutLog[],
  from: string,
  to: string,
  program: TrainingProgram
): SessionTotals {
  const ws = workouts.filter(
    (w) => w.date >= from && w.date <= to && w.sessionId !== "rest"
  )
  const weeks = weeksInPeriod(from, to)
  const withDuration = ws.filter((w) => (w.durationMin ?? 0) > 0)
  const withSrpe = ws.filter((w) => (w.srpe ?? 0) > 0)
  const load = Math.round(ws.reduce((sum, w) => sum + internalLoad(w), 0))
  return {
    sessions: ws.length,
    plannedSessions: ws.filter((w) => countsTowardProgramTarget(w.sessionId, program))
      .length,
    activeDays: new Set(ws.map((w) => w.date)).size,
    sessionsPerWeek: Math.round((ws.length / weeks) * 10) / 10,
    strengthSessions: ws.filter((w) => w.entries.length > 0).length,
    conditioningSessions: ws.filter((w) => cardioBlocks(w).length > 0).length,
    durationMin: Math.round(
      ws.reduce((sum, w) => sum + (w.durationMin ?? totalCardioMinutes(w)), 0)
    ),
    durationCoveragePct: percentage(withDuration.length, ws.length),
    srpeCoveragePct: percentage(withSrpe.length, ws.length),
    avgSrpe:
      withSrpe.length > 0
        ? withSrpe.reduce((sum, w) => sum + w.srpe!, 0) / withSrpe.length
        : null,
    load,
    loadPerWeek: Math.round(load / weeks),
  }
}

/* ------------------------------------------------------------------ */
/* Constância e estado de carga                                         */
/* ------------------------------------------------------------------ */

export interface PeriodConsistency extends RangeConsistency {
  /** semanas que bateram o alvo do programa, de quantas */
  weeksOnTarget: number
  weeks: number
}

export function periodConsistency(
  workouts: WorkoutLog[],
  from: string,
  to: string,
  weekly: ReportWeek[]
): PeriodConsistency {
  const range = consistencyInRange(workouts, from, to)
  return {
    ...range,
    weeksOnTarget: weekly.filter((week) => week.onTarget).length,
    weeks: weekly.length,
  }
}

/** Carga atual × recorde de cada exercício, dentro do período. */
export function periodRelativeLoad(
  workouts: WorkoutLog[],
  from: string,
  to: string
): RelativeLoadRow[] {
  return relativeLoadBoard(workouts, fromDateKey(to), {
    days: daysInPeriod(from, to),
    limit: 12,
  })
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
  totals: SessionTotals & {
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
  lifts: LiftLine[]
  body: BodyProgress[]
  muscles: MuscleVolume[]
  weekly: ReportWeek[]
  consistency: PeriodConsistency
  /** dias do período em colunas de semana, para a fita impressa */
  calendar: CalendarCell[][]
  /** onde cada exercício está em relação ao próprio recorde de carga */
  relativeLoad: RelativeLoadRow[]
  energy: EnergyReport
  massTrend: MassTrend
  mass: MassPoint[]
  highlights: string[]
  gaps: string[]
}

/** Piso usual de séries duras por semana para sustentar um grupo muscular. */
const MIN_HARD_SETS_PER_WEEK = 10

export function blockReport(
  data: GymData,
  period: ReportPeriod,
  program: TrainingProgram
): BlockReport {
  const { from, to } = period
  const days = daysInPeriod(from, to)
  const weeks = weeksInPeriod(from, to)
  const windows = compareWindows(from, to)
  const ws = data.workouts.filter(
    (w) => w.date >= from && w.date <= to && w.sessionId !== "rest"
  )

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

  const totals = sessionTotals(data.workouts, from, to, program)
  const periodPrs = prEvents(data.workouts).filter((p) => p.date >= from && p.date <= to)
  const lifts = reportLifts(data.workouts, from, to)
  const body = bodyProgress(data.body, windows)
  const weekly = reportWeeks(data, from, to, program)
  const consistency = periodConsistency(data.workouts, from, to, weekly)
  const relativeLoad = periodRelativeLoad(data.workouts, from, to)
  const trend = massTrend(data.body, from, to)
  const energy = energyReport(data, fromDateKey(to), days)

  const highlights: string[] = []
  const gaps: string[] = []

  for (const lift of lifts) {
    if (lift.variantChanged || lift.deltaPct === null) continue
    if (lift.deltaPct >= LIFT_SIGNIFICANT_PCT) {
      highlights.push(
        `${lift.name}: carga do top set subiu ${formatPct(lift.deltaPct)} (${formatKgBr(
          lift.firstWeight
        )} → ${formatKgBr(lift.lastWeight)} kg).`
      )
    } else if (lift.deltaPct <= -LIFT_SIGNIFICANT_PCT) {
      gaps.push(
        `${lift.name}: carga do top set caiu ${formatPct(Math.abs(lift.deltaPct))} (${formatKgBr(
          lift.firstWeight
        )} → ${formatKgBr(lift.lastWeight)} kg).`
      )
    }
  }

  const detrained = relativeLoad.filter(
    (row) => row.relativePct < RELATIVE_LOAD_ALERT_PCT
  )
  if (detrained.length > 0) {
    gaps.push(
      `Abaixo de ${RELATIVE_LOAD_ALERT_PCT}% do próprio recorde de carga: ${detrained
        .slice(0, 4)
        .map((row) => `${row.name} (${row.relativePct}%)`)
        .join(", ")}${detrained.length > 4 ? ` e mais ${detrained.length - 4}` : ""}.`
    )
  }

  // a lacuna vem antes do volume: num bloco com duas semanas vazias, é ela que
  // explica o resto dos números
  if (consistency.longestGapDays >= 7 && consistency.longestGapFrom) {
    gaps.push(
      `Maior lacuna do bloco: ${consistency.longestGapDays} dias sem treino (${formatDayMonth(
        consistency.longestGapFrom
      )} a ${formatDayMonth(consistency.longestGapTo!)}).`
    )
  }
  if (consistency.weeksOnTarget === consistency.weeks && consistency.weeks > 0) {
    highlights.push(
      `Alvo semanal cumprido nas ${consistency.weeks} semanas do bloco.`
    )
  } else if (consistency.weeksOnTarget > 0) {
    highlights.push(
      `${consistency.weeksOnTarget} de ${consistency.weeks} semanas no alvo do programa.`
    )
  } else if (consistency.weeks > 0) {
    gaps.push(
      `Nenhuma das ${consistency.weeks} semanas bateu o alvo de sessões do programa.`
    )
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

  if (totals.sessionsPerWeek >= 3) {
    highlights.push(
      `Frequência de ${totals.sessionsPerWeek.toLocaleString("pt-BR")} sessões por semana.`
    )
  } else {
    gaps.push(
      `Frequência de ${totals.sessionsPerWeek.toLocaleString("pt-BR")} sessões por semana — abaixo das 3 que sustentam massa magra.`
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
      ...totals,
      volumeKg: ws.reduce((s, w) => s + workoutVolume(w), 0),
      hardSets: muscles.reduce((s, m) => s + m.hardSets, 0),
      z2Minutes: weekly.reduce((s, w) => s + w.z2Minutes, 0),
      intenseMinutes: weekly.reduce((s, w) => s + w.intenseMinutes, 0),
      cardioMinutes: Math.round(ws.reduce((s, w) => s + totalCardioMinutes(w), 0)),
      kcal,
      prCount: periodPrs.length,
      prs: groupPrs(periodPrs),
    },
    lifts,
    body,
    muscles,
    weekly,
    consistency,
    calendar: periodCalendar(data.workouts, from, to),
    relativeLoad,
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
  /** data da pesagem mais recente */
  measuredAt: string
  /** medição mais antiga entre as usadas no perfil */
  oldestAt: string
  weightKg: number
  weighedAt: string
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
  waistCm: number | null
  waistAt: string | null
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
  training: SessionTotals & {
    kcalPerWeek: number
    liftKcal: number
    cardioKcal: number
    cardioMinutes: number
  }
  hydration: {
    avgMl: number | null
    medianMl: number | null
    goalMl: number
    daysLogged: number
    coveragePct: number
    daysAtGoal: number
    loggedRatioPct: number | null
  }
  sleep: {
    avgMinutes: number | null
    medianMinutes: number | null
    nights: number
    coveragePct: number
    nightsUnder7h: number
  }
}

/**
 * Perfil mais recente, campo a campo.
 *
 * Fixar tudo numa única medição parecia mais honesto e produzia um documento
 * furado: a balança nem sempre grava IMC e músculo esquelético junto do
 * percentual de gordura, e a versão antiga imprimia "—" em altura, IMC e
 * músculo tendo os três medidos três dias antes. Cada valor traz a data em
 * que foi medido, que é o que torna a mistura legítima.
 */
function latestProfile(body: BodyLog[], to: string): NutritionProfile | null {
  const candidates = body
    .filter((b) => b.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
  const weighted = candidates.filter((b) => (b.weightKg ?? 0) > 0)
  const latest = weighted[weighted.length - 1]
  if (!latest) return null

  /** valor mais recente do campo, com a data da medição */
  function pick<T>(read: (log: BodyLog) => T | undefined): { value: T; date: string } | null {
    for (let i = candidates.length - 1; i >= 0; i--) {
      const value = read(candidates[i])
      if (value !== undefined && value !== null) return { value, date: candidates[i].date }
    }
    return null
  }

  const bmi = pick((b) => (b.bmi && b.bmi > 0 ? b.bmi : undefined))
  const bodyFat = pick((b) => b.bodyFatPct)
  const fat = pick((b) => fatMassOf(b))
  const waist = pick((b) => (b.waistCm && b.waistCm > 0 ? b.waistCm : undefined))
  const weightAtBmi = bmi
    ? candidates.find((b) => b.date === bmi.date)?.weightKg ?? latest.weightKg!
    : null
  const weightAtFat = fat
    ? candidates.find((b) => b.date === fat.date)?.weightKg
    : undefined

  const dates = [latest.date, bmi?.date, bodyFat?.date, fat?.date, waist?.date].filter(
    (d): d is string => Boolean(d)
  )

  return {
    measuredAt: latest.date,
    /** medição mais antiga entre as usadas — quem lê precisa saber a mistura */
    oldestAt: dates.sort()[0],
    weightKg: latest.weightKg!,
    weighedAt: latest.date,
    // IMC = kg / m² → m = √(kg / IMC). A balança reporta IMC, não altura.
    heightM:
      bmi && weightAtBmi
        ? Math.round(Math.sqrt(weightAtBmi / bmi.value) * 100) / 100
        : null,
    bmi: bmi?.value ?? null,
    bodyFatPct: bodyFat?.value ?? null,
    fatMassKg: fat?.value ?? null,
    leanMassKg:
      fat && weightAtFat ? Math.round((weightAtFat - fat.value) * 10) / 10 : null,
    skeletalMuscleKg: pick((b) => b.skeletalMuscleKg)?.value ?? null,
    waterPct: pick((b) => b.waterPct)?.value ?? null,
    visceralFat: pick((b) => b.visceralFat)?.value ?? null,
    bmrKcal: pick((b) => b.bmrKcal)?.value ?? null,
    waistCm: waist?.value ?? null,
    waistAt: waist?.date ?? null,
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

  const totals = sessionTotals(data.workouts, from, to, program)

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
      ...totals,
      kcalPerWeek: Math.round(((liftKcal + cardioKcal) / days) * 7),
      liftKcal,
      cardioKcal,
      cardioMinutes: Math.round(ws.reduce((s, w) => s + totalCardioMinutes(w), 0)),
    },
    hydration: {
      avgMl,
      medianMl: hydrationLogs.length > 0 ? Math.round(median(hydrationLogs.map((h) => h.ml))!) : null,
      goalMl,
      daysLogged: hydrationLogs.length,
      coveragePct: percentage(hydrationLogs.length, days),
      daysAtGoal: hydrationLogs.filter((h) => h.ml >= goalMl).length,
      /** média dos dias REGISTRADOS sobre a meta — não é aderência do período */
      loggedRatioPct: avgMl !== null ? Math.round((avgMl / goalMl) * 100) : null,
    },
    sleep: {
      avgMinutes: avgSleep,
      medianMinutes:
        sleepLogs.length > 0 ? Math.round(median(sleepLogs.map((l) => l.durationMin))!) : null,
      nights: sleepLogs.length,
      coveragePct: percentage(sleepLogs.length, days),
      nightsUnder7h: sleepLogs.filter((l) => l.durationMin < 7 * 60).length,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Relatório para o preparador físico                                  */
/* ------------------------------------------------------------------ */

export interface CoachQualityItem {
  domain: string
  value: string
  detail: string
  confidence: DataConfidence
}

export interface CoachReport {
  period: ReportPeriod
  days: number
  weeks: number
  program: TrainingProgram
  purpose: string
  periodStatus: "concluido" | "parcial" | "janela-movel"
  quality: CoachQualityItem[]
  training: SessionTotals & {
    sessionTypes: {
      id: string
      label: string
      sessions: number
      durationMin: number
      load: number
    }[]
  }
  weekly: ReportWeek[]
  lifts: LiftLine[]
  muscles: MuscleVolume[]
  consistency: PeriodConsistency
  calendar: CalendarCell[][]
  /** onde cada exercício está em relação ao próprio recorde de carga */
  relativeLoad: RelativeLoadRow[]
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

function coachPeriodStatus(period: ReportPeriod): CoachReport["periodStatus"] {
  if (!period.id.startsWith("engine-")) return "janela-movel"
  const id = period.id.slice("engine-".length)
  const block = engineBlockWindows().find((window) => window.id === id)
  return block?.end && period.to >= block.end ? "concluido" : "parcial"
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
  const totals = sessionTotals(data.workouts, from, to, program)

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
  const hydrationCoveragePct = percentage(hydrationLogs.length, days)
  const sleepCoveragePct = percentage(sleepLogs.length, days)
  const weekly = reportWeeks(data, from, to, program)
  const consistency = periodConsistency(data.workouts, from, to, weekly)
  const relativeLoad = periodRelativeLoad(data.workouts, from, to)
  const liftRows = reportLifts(data.workouts, from, to)

  const quality: CoachQualityItem[] = [
    {
      domain: "Treino",
      value: `${workouts.length} sessões`,
      detail: `${totals.durationCoveragePct}% com duração · ${totals.srpeCoveragePct}% com sRPE`,
      confidence:
        workouts.length >= 6 &&
        totals.durationCoveragePct >= 75 &&
        totals.srpeCoveragePct >= 70
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
  if (consistency.longestGapDays >= 14) {
    questions.push(
      `Planejar a reentrada: houve ${consistency.longestGapDays} dias sem treino no período.`
    )
  }
  const detrained = relativeLoad.filter((row) => row.relativePct < RELATIVE_LOAD_ALERT_PCT)
  if (detrained.length >= 3) {
    questions.push(
      `Definir progressão de carga: ${detrained.length} exercícios estão abaixo de ${RELATIVE_LOAD_ALERT_PCT}% do próprio recorde.`
    )
  }
  if (sleepCoveragePct < 40 || hydrationCoveragePct < 40) {
    questions.push("Confirmar recuperação na anamnese; sono ou hidratação tem baixa cobertura.")
  }
  if (liftRows.some((lift) => lift.variantChanged)) {
    questions.push("Padronizar aparelho e variante: o nome do exercício mudou dentro do período.")
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
      ...totals,
      sessionTypes: [...sessionMap.values()]
        .map((row) => ({ ...row, durationMin: Math.round(row.durationMin), load: Math.round(row.load) }))
        .sort((a, b) => b.sessions - a.sessions || b.durationMin - a.durationMin),
    },
    weekly,
    lifts: liftRows,
    muscles,
    consistency,
    calendar: periodCalendar(data.workouts, from, to),
    relativeLoad,
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
    questions: questions.slice(0, 8),
  }
}

/* ------------------------------------------------------------------ */
/* Cobertura do período — o que o documento vai conseguir dizer         */
/* ------------------------------------------------------------------ */

export interface ReportCoverage {
  days: number
  weeks: number
  sessions: number
  activeDays: number
  weighIns: number
  compositionPoints: number
  waistPoints: number
  sleepNights: number
  hydrationDays: number
  /** exercícios com duas ou mais sessões — os que sustentam comparação */
  comparableLifts: number
  /** não há o que imprimir */
  empty: boolean
  /** avisos a mostrar ANTES de gerar o PDF */
  warnings: string[]
}

/**
 * O que existe no período, dito antes de gerar o documento.
 *
 * A folha sai igual com 4 dias ou com 12 semanas — mesmas seções, mesmas
 * tabelas, metade das células em "—". Quem gera não descobre isso na tela do
 * celular, onde a miniatura é ilegível: descobre depois de mandar o PDF.
 */
export function reportCoverage(data: GymData, period: ReportPeriod): ReportCoverage {
  const { from, to } = period
  const days = daysInPeriod(from, to)
  const weeks = weeksInPeriod(from, to)
  const ws = data.workouts.filter(
    (w) => w.date >= from && w.date <= to && w.sessionId !== "rest"
  )
  const body = data.body.filter((b) => b.date >= from && b.date <= to)
  const weighIns = body.filter((b) => (b.weightKg ?? 0) > 0)
  const composition = body.filter((b) => fatMassOf(b) !== undefined)
  const waist = body.filter((b) => (b.waistCm ?? 0) > 0)
  const sleepNights = data.sleep.filter(
    (l) => l.date >= from && l.date <= to && l.durationMin > 0
  ).length
  const hydrationDays = data.hydration.filter(
    (h) => h.date >= from && h.date <= to && h.ml > 0
  ).length
  const comparableLifts = reportLifts(data.workouts, from, to).length

  const warnings: string[] = []
  if (ws.length === 0) {
    warnings.push("Nenhuma sessão registrada no período.")
  } else if (days < 21) {
    warnings.push(
      `Período de ${days} dias: cada ponta do comparativo antes × depois tem ${
        compareWindows(from, to).windowDays
      } dias.`
    )
  }
  if (ws.length > 0 && comparableLifts === 0) {
    warnings.push(
      "Nenhum exercício repetido em duas sessões — a tabela de força fica sem comparação."
    )
  }
  if (weighIns.length < 2) {
    warnings.push(
      `${weighIns.length} pesagem${
        weighIns.length === 1 ? "" : "s"
      } no período: tendência de peso, balanço energético e ingestão estimada não abrem.`
    )
  }
  if (composition.length < 2) {
    warnings.push("Sem duas bioimpedâncias: gordura e massa magra saem sem tendência.")
  }
  if (waist.length === 0) {
    warnings.push("Sem medida de cintura no período.")
  }
  if (percentage(sleepNights, days) < 40) {
    warnings.push(`Sono registrado em ${sleepNights} de ${days} noites.`)
  }
  if (percentage(hydrationDays, days) < 40) {
    warnings.push(`Água registrada em ${hydrationDays} de ${days} dias.`)
  }

  return {
    days,
    weeks: Math.round(weeks * 10) / 10,
    sessions: ws.length,
    activeDays: new Set(ws.map((w) => w.date)).size,
    weighIns: weighIns.length,
    compositionPoints: composition.length,
    waistPoints: waist.length,
    sleepNights,
    hydrationDays,
    comparableLifts,
    empty: ws.length === 0 && weighIns.length === 0,
    warnings,
  }
}

/* ------------------------------------------------------------------ */
/* Resumo de saúde                                                      */
/* ------------------------------------------------------------------ */

export type MarkerStatus = "ideal" | "atencao" | "alerta" | "desconhecido"

export interface HealthMarker {
  key: string
  label: string
  value: number | null
  unit: string
  /** valor na ponta inicial do período, para dar direção */
  previous: number | null
  delta: number | null
  goal: "down" | "up" | "neutral"
  status: MarkerStatus
  /** faixa de referência, escrita para quem lê o papel */
  reference: string
  /** de onde vem o ponto de corte */
  source: string
  measuredAt: string | null
}

export interface HealthReport {
  period: ReportPeriod
  days: number
  weeks: number
  markers: HealthMarker[]
  trend: MassTrend
  waistSeries: { label: string; value: number }[]
  weightSeries: { label: string; value: number }[]
  activity: {
    sessionsPerWeek: number
    strengthSessionsPerWeek: number
    cardioMinutesPerWeek: number
    z2MinutesPerWeek: number
    /** 150 min/semana de atividade aeróbica moderada */
    meetsAerobic: boolean
    /** 2 sessões de fortalecimento muscular por semana */
    meetsStrength: boolean
    longestGapDays: number
    adherencePct: number
  }
  sleep: {
    nights: number
    coveragePct: number
    avgMinutes: number | null
    medianMinutes: number | null
    nightsUnder7h: number
    midpointDriftMin: number | null
  }
  hydration: {
    days: number
    coveragePct: number
    medianMl: number | null
    goalMl: number
  }
  /** achados que merecem conversa com um profissional de saúde */
  alerts: string[]
}

/** Cintura, homens: 94 cm risco aumentado, 102 cm risco muito aumentado. */
const WAIST_ELEVATED_CM = 94
const WAIST_HIGH_CM = 102
/** Índice de gordura visceral das balanças de bioimpedância: 1 a 9 normal. */
const VISCERAL_ELEVATED = 10
const VISCERAL_HIGH = 15
/** Minutos semanais de atividade aeróbica moderada recomendados a adultos. */
const AEROBIC_WEEKLY_TARGET_MIN = 150

function markerStatus(
  value: number | null,
  elevated: number,
  high: number
): MarkerStatus {
  if (value === null) return "desconhecido"
  if (value >= high) return "alerta"
  if (value >= elevated) return "atencao"
  return "ideal"
}

/**
 * Uma página para levar ao consultório.
 *
 * O app já media tudo isto e não juntava em lugar nenhum: a cintura só existia
 * na tabela de composição do fechamento, a gordura visceral aparecia como
 * número solto no perfil da nutrição, e nenhuma das duas vinha com a faixa de
 * referência que transforma "17" em informação. Não há diagnóstico aqui — há
 * medida, tendência, ponto de corte e a origem do ponto de corte.
 */
export function healthReport(
  data: GymData,
  period: ReportPeriod,
  program: TrainingProgram
): HealthReport {
  const { from, to } = period
  const days = daysInPeriod(from, to)
  const weeks = weeksInPeriod(from, to)
  const profile = latestProfile(data.body, to)
  const windows = compareWindows(from, to)
  const comparison = bodyProgress(data.body, windows)
  const priorOf = (key: string) => comparison.find((row) => row.key === key)?.start ?? null

  const body = data.body
    .filter((b) => b.date >= from && b.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
  const waistLogs = body.filter((b) => (b.waistCm ?? 0) > 0)
  const weightLogs = body.filter((b) => (b.weightKg ?? 0) > 0)

  const marker = (
    key: string,
    label: string,
    value: number | null,
    unit: string,
    goal: HealthMarker["goal"],
    status: MarkerStatus,
    reference: string,
    source: string,
    measuredAt: string | null
  ): HealthMarker => {
    const previous = priorOf(key)
    return {
      key,
      label,
      value,
      unit,
      previous,
      delta:
        value !== null && previous !== null
          ? Math.round((value - previous) * 100) / 100
          : null,
      goal,
      status,
      reference,
      source,
      measuredAt,
    }
  }

  /**
   * IMC recalculado do peso mais recente com a altura derivada, e não copiado
   * da balança: o campo `bmi` costuma vir de uma medição anterior, e a folha
   * imprimia 31,3 ao lado de um peso que dá 30,9. Sem altura, cai no valor
   * gravado.
   */
  const bmi =
    profile?.heightM && profile.heightM > 0 && profile.weightKg > 0
      ? Math.round((profile.weightKg / profile.heightM ** 2) * 10) / 10
      : profile?.bmi ?? null
  const previousWeight = priorOf("weight")
  const previousBmi =
    profile?.heightM && profile.heightM > 0 && previousWeight !== null
      ? Math.round((previousWeight / profile.heightM ** 2) * 10) / 10
      : null

  const markers: HealthMarker[] = [
    marker(
      "waist",
      "Circunferência de cintura",
      profile?.waistCm ?? null,
      "cm",
      "down",
      markerStatus(profile?.waistCm ?? null, WAIST_ELEVATED_CM, WAIST_HIGH_CM),
      `abaixo de ${WAIST_ELEVATED_CM} cm desejável · ${WAIST_HIGH_CM} cm ou mais, risco muito aumentado`,
      "OMS/IDF, homens",
      profile?.waistAt ?? null
    ),
    {
      ...marker(
        "bmi",
        "IMC",
        bmi,
        "kg/m²",
        "down",
        markerStatus(bmi, 25, 30),
        "18,5 a 24,9 eutrofia · 25 a 29,9 sobrepeso · 30 ou mais, obesidade",
        "OMS",
        profile?.weighedAt ?? null
      ),
      previous: previousBmi,
      delta:
        bmi !== null && previousBmi !== null
          ? Math.round((bmi - previousBmi) * 100) / 100
          : null,
    },
    marker(
      "fatPct",
      "Gordura corporal",
      profile?.bodyFatPct ?? null,
      "%",
      "down",
      markerStatus(profile?.bodyFatPct ?? null, 20, 25),
      "10 a 20% adequado para homens adultos",
      "faixa de referência de bioimpedância",
      profile?.measuredAt ?? null
    ),
    marker(
      "visceral",
      "Gordura visceral",
      profile?.visceralFat ?? null,
      "índice",
      "down",
      markerStatus(profile?.visceralFat ?? null, VISCERAL_ELEVATED, VISCERAL_HIGH),
      `1 a 9 normal · ${VISCERAL_ELEVATED} a 14 alto · ${VISCERAL_HIGH} ou mais, muito alto`,
      "escala da balança de bioimpedância",
      profile?.measuredAt ?? null
    ),
    marker(
      "weight",
      "Peso",
      profile?.weightKg ?? null,
      "kg",
      "neutral",
      "desconhecido",
      "acompanhado pela tendência, não por valor isolado",
      "—",
      profile?.weighedAt ?? null
    ),
  ]

  const weekly = reportWeeks(data, from, to, program)
  const totals = sessionTotals(data.workouts, from, to, program)
  const consistency = periodConsistency(data.workouts, from, to, weekly)
  const cardioMinutes = weekly.reduce(
    (sum, week) => sum + week.z2Minutes + week.intenseMinutes + week.sportMinutes,
    0
  )
  const z2Minutes = weekly.reduce((sum, week) => sum + week.z2Minutes, 0)
  const strengthPerWeek =
    Math.round(
      (weekly.reduce((sum, week) => sum + week.strengthSessions, 0) / weeks) * 10
    ) / 10
  const cardioPerWeek = Math.round(cardioMinutes / weeks)

  const sleepLogs = data.sleep.filter(
    (l) => l.date >= from && l.date <= to && l.durationMin > 0
  )
  const midpoints = sleepLogs
    .map(sleepMidpointMinutes)
    .filter((value): value is number => value !== null)
  const nightsUnder7h = sleepLogs.filter((l) => l.durationMin < 7 * 60).length
  const hydrationLogs = data.hydration.filter(
    (h) => h.date >= from && h.date <= to && h.ml > 0
  )
  const goalMl = waterGoalMl(data.body)

  const alerts: string[] = []
  for (const item of markers) {
    if (item.status === "alerta" && item.value !== null) {
      alerts.push(
        `${item.label} em ${formatKgBr(item.value)} ${item.unit}: acima da faixa de referência (${item.reference}).`
      )
    }
  }
  if (cardioPerWeek < AEROBIC_WEEKLY_TARGET_MIN) {
    alerts.push(
      `Atividade aeróbica em ${cardioPerWeek} min/semana, abaixo dos ${AEROBIC_WEEKLY_TARGET_MIN} min recomendados.`
    )
  }
  if (sleepLogs.length > 0 && nightsUnder7h / sleepLogs.length >= 0.4) {
    alerts.push(
      `${nightsUnder7h} das ${sleepLogs.length} noites registradas ficaram abaixo de 7 horas.`
    )
  }
  if (consistency.longestGapDays >= 14) {
    alerts.push(
      `${consistency.longestGapDays} dias seguidos sem atividade registrada dentro do período.`
    )
  }

  return {
    period,
    days,
    weeks: Math.round(weeks * 10) / 10,
    markers,
    trend: massTrend(data.body, from, to),
    waistSeries: waistLogs.map((b) => ({
      label: formatDayMonth(b.date),
      value: b.waistCm!,
    })),
    weightSeries: weightLogs.map((b) => ({
      label: formatDayMonth(b.date),
      value: b.weightKg!,
    })),
    activity: {
      sessionsPerWeek: totals.sessionsPerWeek,
      strengthSessionsPerWeek: strengthPerWeek,
      cardioMinutesPerWeek: cardioPerWeek,
      z2MinutesPerWeek: Math.round(z2Minutes / weeks),
      meetsAerobic: cardioPerWeek >= AEROBIC_WEEKLY_TARGET_MIN,
      meetsStrength: strengthPerWeek >= 2,
      longestGapDays: consistency.longestGapDays,
      adherencePct: consistency.adherencePct,
    },
    sleep: {
      nights: sleepLogs.length,
      coveragePct: percentage(sleepLogs.length, days),
      avgMinutes:
        sleepLogs.length > 0
          ? Math.round(average(sleepLogs.map((l) => l.durationMin))!)
          : null,
      medianMinutes:
        sleepLogs.length > 0
          ? Math.round(median(sleepLogs.map((l) => l.durationMin))!)
          : null,
      nightsUnder7h,
      midpointDriftMin:
        midpoints.length >= 2 ? Math.round(standardDeviation(midpoints)!) : null,
    },
    hydration: {
      days: hydrationLogs.length,
      coveragePct: percentage(hydrationLogs.length, days),
      medianMl:
        hydrationLogs.length > 0
          ? Math.round(median(hydrationLogs.map((h) => h.ml))!)
          : null,
      goalMl,
    },
    alerts,
  }
}

/* ------------------------------------------------------------------ */
/* Comparativo entre dois períodos                                      */
/* ------------------------------------------------------------------ */

/** O período imediatamente anterior, do mesmo tamanho. */
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  const days = daysInPeriod(period.from, period.to)
  const to = shiftKey(period.from, -1)
  const from = shiftKey(to, -(days - 1))
  return { id: `${period.id}-anterior`, label: "Período anterior", from, to }
}

export interface ComparisonRow {
  key: string
  label: string
  unit: string
  /** período recente */
  a: number | null
  /** período anterior */
  b: number | null
  delta: number | null
  deltaPct: number | null
  goal: "up" | "down" | "neutral"
  decimals: number
}

export interface ComparisonLift {
  exerciseId: string
  name: string
  aWeight: number | null
  bWeight: number | null
  deltaKg: number | null
  deltaPct: number | null
  aSessions: number
  bSessions: number
}

export interface ComparisonReport {
  a: ReportPeriod
  b: ReportPeriod
  days: number
  program: TrainingProgram
  exposure: ComparisonRow[]
  body: ComparisonRow[]
  lifts: ComparisonLift[]
  /** o período anterior não tem registro nenhum: não há o que comparar */
  previousEmpty: boolean
  verdict: string[]
}

function comparisonRow(
  key: string,
  label: string,
  unit: string,
  a: number | null,
  b: number | null,
  goal: ComparisonRow["goal"],
  decimals = 1
): ComparisonRow {
  const delta = a !== null && b !== null ? Math.round((a - b) * 100) / 100 : null
  return {
    key,
    label,
    unit,
    a,
    b,
    delta,
    deltaPct:
      a !== null && b !== null && b !== 0
        ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10
        : null,
    goal,
    decimals,
  }
}

/**
 * Dois períodos lado a lado.
 *
 * O fechamento de bloco foi escrito para ser empilhado — "seis destes
 * respondem se o bloco de maio rendeu mais que o de agosto". Ninguém empilha
 * PDF: a comparação que se faz de verdade é entre este bloco e o anterior, e
 * ela cabe numa folha. Os dois recortes têm o mesmo número de dias por
 * construção, senão volume e minutos não se comparam.
 */
export function comparisonReport(
  data: GymData,
  a: ReportPeriod,
  b: ReportPeriod,
  program: TrainingProgram
): ComparisonReport {
  const build = (period: ReportPeriod) => {
    const weeks = weeksInPeriod(period.from, period.to)
    const weekly = reportWeeks(data, period.from, period.to, program)
    const totals = sessionTotals(data.workouts, period.from, period.to, program)
    const consistency = periodConsistency(data.workouts, period.from, period.to, weekly)
    const ws = data.workouts.filter(
      (w) => w.date >= period.from && w.date <= period.to && w.sessionId !== "rest"
    )
    let kcal = 0
    for (const w of ws) {
      const estimate = sessionKcal(w, weightKgOn(data.body, w.date))
      if (estimate) kcal += estimate.mid
    }
    return {
      period,
      weeks,
      weekly,
      totals,
      consistency,
      volumeKg: ws.reduce((sum, w) => sum + workoutVolume(w), 0),
      hardSets: weekly.reduce((sum, week) => sum + week.hardSets, 0),
      z2: weekly.reduce((sum, week) => sum + week.z2Minutes, 0),
      cardio: Math.round(ws.reduce((sum, w) => sum + totalCardioMinutes(w), 0)),
      kcalPerWeek: Math.round(kcal / weeks),
      lifts: reportLifts(data.workouts, period.from, period.to, 12),
      body: bodyProgress(data.body, compareWindows(period.from, period.to)),
      trend: massTrend(data.body, period.from, period.to),
    }
  }

  const recent = build(a)
  const older = build(b)

  const perWeek = (value: number, weeks: number) => Math.round((value / weeks) * 10) / 10

  const exposure: ComparisonRow[] = [
    comparisonRow(
      "sessions",
      "Sessões por semana",
      "",
      recent.totals.sessionsPerWeek,
      older.totals.sessionsPerWeek,
      "up"
    ),
    comparisonRow(
      "adherence",
      "Dias treinados",
      "%",
      recent.consistency.adherencePct,
      older.consistency.adherencePct,
      "up",
      0
    ),
    comparisonRow(
      "gap",
      "Maior lacuna",
      "dias",
      recent.consistency.longestGapDays,
      older.consistency.longestGapDays,
      "down",
      0
    ),
    comparisonRow(
      "volume",
      "Tonelagem",
      "t",
      Math.round((recent.volumeKg / 1000) * 10) / 10,
      Math.round((older.volumeKg / 1000) * 10) / 10,
      "up"
    ),
    comparisonRow(
      "hardSets",
      "Séries duras por semana",
      "",
      perWeek(recent.hardSets, recent.weeks),
      perWeek(older.hardSets, older.weeks),
      "up"
    ),
    comparisonRow(
      "z2",
      "Zona 2 por semana",
      "min",
      Math.round(recent.z2 / recent.weeks),
      Math.round(older.z2 / older.weeks),
      "up",
      0
    ),
    comparisonRow(
      "cardio",
      "Cardio por semana",
      "min",
      Math.round(recent.cardio / recent.weeks),
      Math.round(older.cardio / older.weeks),
      "up",
      0
    ),
    comparisonRow(
      "load",
      "Carga interna por semana",
      "AU",
      recent.totals.loadPerWeek,
      older.totals.loadPerWeek,
      "neutral",
      0
    ),
    comparisonRow(
      "kcal",
      "Gasto com treino",
      "kcal/sem",
      recent.kcalPerWeek,
      older.kcalPerWeek,
      "neutral",
      0
    ),
  ]

  const bodyKeys: { key: string; goal: ComparisonRow["goal"] }[] = [
    { key: "weight", goal: "neutral" },
    { key: "fatMass", goal: "down" },
    { key: "lean", goal: "up" },
    { key: "waist", goal: "down" },
  ]
  const body: ComparisonRow[] = bodyKeys
    .map(({ key, goal }) => {
      const recentRow = recent.body.find((row) => row.key === key)
      const olderRow = older.body.find((row) => row.key === key)
      if (!recentRow && !olderRow) return null
      return comparisonRow(
        key,
        recentRow?.label ?? olderRow!.label,
        recentRow?.unit ?? olderRow!.unit,
        recentRow?.end ?? null,
        olderRow?.end ?? null,
        goal,
        2
      )
    })
    .filter((row): row is ComparisonRow => row !== null)

  const byId = new Map(older.lifts.map((lift) => [lift.exerciseId, lift]))
  const lifts: ComparisonLift[] = recent.lifts.map((lift) => {
    const before = byId.get(lift.exerciseId)
    const aWeight = lift.lastWeight
    const bWeight = before?.lastWeight ?? null
    return {
      exerciseId: lift.exerciseId,
      name: lift.name,
      aWeight,
      bWeight,
      deltaKg: bWeight !== null ? Math.round((aWeight - bWeight) * 10) / 10 : null,
      deltaPct:
        bWeight !== null && bWeight > 0
          ? Math.round(((aWeight - bWeight) / bWeight) * 1000) / 10
          : null,
      aSessions: lift.sessions,
      bSessions: before?.sessions ?? 0,
    }
  })

  /**
   * Período anterior vazio não é "melhorou 100%".
   *
   * O app começou em junho; pedir o comparativo das 12 semanas cai num
   * anterior anterior ao primeiro registro, e a folha saía dizendo "apareceu
   * mais: 3,1 contra 0 sessões por semana" — verdadeiro e inútil. Aqui isso é
   * dito com todas as letras, e os vereditos de variação ficam calados.
   */
  const previousEmpty =
    older.totals.sessions === 0 && older.body.length === 0 && older.lifts.length === 0

  const verdict: string[] = []
  if (previousEmpty) {
    verdict.push(
      `O período anterior (${formatDayMonth(b.from)} a ${formatDayMonth(
        b.to
      )}) não tem registro nenhum — não há comparação, apenas o recorte recente.`
    )
    return { a, b, days: daysInPeriod(a.from, a.to), program, exposure, body, lifts, previousEmpty, verdict }
  }

  const sessions = exposure.find((row) => row.key === "sessions")!
  if (sessions.delta !== null && Math.abs(sessions.delta) >= 0.3) {
    verdict.push(
      sessions.delta > 0
        ? `Apareceu mais: ${formatKgBr(sessions.a!)} contra ${formatKgBr(sessions.b!)} sessões por semana.`
        : `Apareceu menos: ${formatKgBr(sessions.a!)} contra ${formatKgBr(sessions.b!)} sessões por semana.`
    )
  }
  const gap = exposure.find((row) => row.key === "gap")!
  if (gap.delta !== null && gap.delta !== 0) {
    verdict.push(
      gap.delta < 0
        ? `Menos tempo parado: maior lacuna caiu de ${gap.b} para ${gap.a} dias.`
        : `Mais tempo parado: maior lacuna subiu de ${gap.b} para ${gap.a} dias.`
    )
  }
  const climbing = lifts.filter((lift) => (lift.deltaPct ?? 0) >= LIFT_SIGNIFICANT_PCT)
  const falling = lifts.filter((lift) => (lift.deltaPct ?? 0) <= -LIFT_SIGNIFICANT_PCT)
  if (climbing.length > 0) {
    verdict.push(
      `Carga acima do período anterior em ${climbing.length} exercício${
        climbing.length === 1 ? "" : "s"
      }: ${climbing.slice(0, 3).map((lift) => lift.name).join(", ")}.`
    )
  }
  if (falling.length > 0) {
    verdict.push(
      `Carga abaixo do período anterior em ${falling.length} exercício${
        falling.length === 1 ? "" : "s"
      }: ${falling.slice(0, 3).map((lift) => lift.name).join(", ")}.`
    )
  }
  const fat = body.find((row) => row.key === "fatMass")
  if (fat?.delta !== null && fat?.delta !== undefined) {
    verdict.push(
      fat.delta <= 0
        ? `Massa de gordura ${formatKgBr(Math.abs(fat.delta))} kg abaixo do fim do período anterior.`
        : `Massa de gordura ${formatKgBr(fat.delta)} kg acima do fim do período anterior.`
    )
  }

  return {
    a,
    b,
    days: daysInPeriod(a.from, a.to),
    program,
    exposure,
    body,
    lifts,
    previousEmpty,
    verdict,
  }
}

/* ------------------------------------------------------------------ */
/* Onde eu parei                                                        */
/* ------------------------------------------------------------------ */

export type ComebackAdvice = "reentrar" | "retomar" | "seguir"

export interface ComebackLift {
  exerciseId: string
  name: string
  muscleGroup: MuscleGroup | null
  lastDate: string
  daysSince: number
  /** carga e reps do top set da última vez */
  lastWeight: number
  lastReps: number
  lastSets: number
  bestWeight: number
  bestDate: string
  relativePct: number
  /** passo do aparelho inferido do próprio histórico */
  step: number
  /** carga sugerida para a volta */
  suggestedWeight: number
  advice: ComebackAdvice
  reason: string
}

export interface ComebackReport {
  today: string
  from: string
  /** exercícios com carga na janela, antes do corte da tabela */
  totalLifts: number
  /** dias desde qualquer treino / desde a última musculação */
  daysSinceAny: number | null
  daysSinceLift: number | null
  /** lacuna aberta, quando existe */
  openGapDays: number
  lifts: ComebackLift[]
  /** grupos musculares sem nenhuma série na janela */
  missingGroups: MuscleGroup[]
  notes: string[]
}

/**
 * A folha da volta.
 *
 * Nenhum documento respondia à pergunta que este histórico faz toda vez:
 * parei duas semanas, volto com quanto? A carga relativa mostra o tamanho do
 * buraco por exercício e a regra de reentrada é a mesma da tela de registro
 * (90% arredondado ao passo do aparelho, depois de 14 dias sem o exercício),
 * para o papel não contradizer o app.
 */
export function comebackReport(
  data: GymData,
  today: Date,
  { days = 180, limit = 14 }: { days?: number; limit?: number } = {}
): ComebackReport {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayKey = toDateKey(midnight)
  const fromKey = toDateKey(new Date(midnight.getTime() - (days - 1) * DAY_MS))
  const ws = data.workouts.filter(
    (w) => w.date >= fromKey && w.date <= todayKey && w.sessionId !== "rest"
  )
  const daysFrom = (key: string | undefined) =>
    key === undefined
      ? null
      : Math.max(0, Math.round((midnight.getTime() - fromDateKey(key).getTime()) / DAY_MS))

  const lastAny = [...ws].map((w) => w.date).sort().pop()
  const lastLift = ws
    .filter((w) => isStrengthLog(w))
    .map((w) => w.date)
    .sort()
    .pop()

  const ids = new Set<string>()
  for (const w of ws) {
    for (const entry of w.entries) {
      if (entry.sets.some((set) => set.weight > 0 && set.reps > 0)) ids.add(entry.exerciseId)
    }
  }

  const lifts: ComebackLift[] = []
  const covered = new Set<MuscleGroup>()
  for (const id of ids) {
    const strength = exerciseStrength(ws, id)
    const last = strength.last
    if (!last || strength.bestWeight <= 0) continue

    let muscleGroup: MuscleGroup | null = null
    let lastSets = 0
    const weights: number[] = []
    for (const w of ws) {
      for (const entry of w.entries) {
        if (entry.exerciseId !== id) continue
        if (entry.muscleGroup) muscleGroup = entry.muscleGroup
        for (const set of entry.sets) if (set.weight > 0) weights.push(set.weight)
        if (w.date === last.date) {
          lastSets = entry.sets.filter((set) => set.reps > 0).length
        }
      }
    }
    muscleGroup =
      muscleGroup ?? EXERCISES_BY_ID[id]?.muscleGroup ?? EXERCISE_GROUP[id] ?? null
    if (muscleGroup) covered.add(muscleGroup)

    const daysSince = daysFrom(last.date)!
    const step = inferLoadStep(weights) ?? DEFAULT_STEP
    const bestPoint = strength.points.find((point) => point.carga === strength.bestWeight)!
    const relativePct = Math.round((last.carga / strength.bestWeight) * 100)

    let advice: ComebackAdvice = "seguir"
    let suggestedWeight = last.carga
    let reason = `Última sessão em ${formatDayMonth(last.date)}, ${formatKgBr(last.carga)} kg × ${last.reps}.`
    if (daysSince >= LAYOFF_DELOAD_DAYS) {
      advice = "reentrar"
      const back = roundToStep(last.carga * 0.9, step)
      suggestedWeight = back < last.carga ? back : Math.max(step, last.carga - step)
      reason = `${daysSince} dias sem este exercício — reentre a ~90% e recupere a carga na próxima.`
    } else if (relativePct < RELATIVE_LOAD_ALERT_PCT) {
      advice = "retomar"
      reason = `A ${relativePct}% do próprio recorde (${formatKgBr(strength.bestWeight)} kg em ${formatDayMonth(
        bestPoint.date
      )}) — suba de volta pelo passo do aparelho.`
    }

    lifts.push({
      exerciseId: id,
      name: strength.name,
      muscleGroup,
      lastDate: last.date,
      daysSince,
      lastWeight: last.carga,
      lastReps: last.reps,
      lastSets,
      bestWeight: strength.bestWeight,
      bestDate: bestPoint.date,
      relativePct,
      step,
      suggestedWeight,
      advice,
      reason,
    })
  }

  lifts.sort(
    (a, b) =>
      a.relativePct - b.relativePct ||
      b.daysSince - a.daysSince ||
      a.name.localeCompare(b.name)
  )

  // a tabela mostra os piores; o texto conta sobre a MESMA lista, senão
  // "8 de 25" aparece ao lado de catorze linhas
  const listed = lifts.slice(0, limit)
  const notes: string[] = []
  const openGapDays = daysFrom(lastAny) ?? days
  if (openGapDays >= LAYOFF_DELOAD_DAYS) {
    notes.push(
      `${openGapDays} dias desde o último treino: a primeira semana de volta é de reentrada, não de recorde.`
    )
  }
  const detrained = listed.filter((lift) => lift.relativePct < RELATIVE_LOAD_ALERT_PCT)
  if (detrained.length > 0) {
    notes.push(
      `${detrained.length} dos ${listed.length} exercícios listados estão abaixo de ${RELATIVE_LOAD_ALERT_PCT}% do próprio recorde.`
    )
  }
  if (lifts.length > listed.length) {
    notes.push(
      `A tabela lista os ${listed.length} casos mais distantes do recorde, de ${lifts.length} exercícios com carga registrada na janela.`
    )
  }

  return {
    today: todayKey,
    from: fromKey,
    totalLifts: lifts.length,
    daysSinceAny: daysFrom(lastAny),
    daysSinceLift: daysFrom(lastLift),
    openGapDays,
    lifts: listed,
    missingGroups: MUSCLE_GROUPS.map(({ id }) => id).filter((group) => !covered.has(group)),
    notes,
  }
}

/* ------------------------------------------------------------------ */
/* Resumo em texto — o que se manda no WhatsApp                          */
/* ------------------------------------------------------------------ */

/**
 * Versão em texto puro do que o PDF diz.
 *
 * O caminho real de saída do app é o aplicativo de mensagens, e ali um PDF de
 * três páginas é pior que seis linhas. Serve também de acessibilidade da
 * própria página: é o único jeito de ler o conteúdo do documento na tela do
 * celular, onde a miniatura fica a 52% do tamanho.
 */
export function reportSummaryText(
  data: GymData,
  period: ReportPeriod,
  program: TrainingProgram
): string {
  const block = blockReport(data, period, program)
  const health = healthReport(data, period, program)
  const lines: string[] = [
    `GYM//TRACK · ${period.label}`,
    `${formatFullDate(period.from)} a ${formatFullDate(period.to)} · ${block.days} dias`,
    "",
    `Sessões: ${block.totals.sessions} (${formatKgBr(block.totals.sessionsPerWeek)}/semana) em ${block.consistency.daysTrained} dias`,
    `Aderência: ${block.consistency.adherencePct}% dos dias · maior lacuna ${block.consistency.longestGapDays} dias`,
    `Tonelagem: ${formatKgBr(block.totals.volumeKg / 1000)} t · ${block.totals.hardSets} séries duras`,
    `Cardio: ${block.totals.cardioMinutes} min, ${block.totals.z2Minutes} em Zona 2`,
  ]
  if (block.massTrend.weightKgPerWeek !== null && block.massTrend.avgWeightKg !== null) {
    lines.push(
      `Peso: ${formatKgBr(block.massTrend.avgWeightKg)} kg · tendência ${
        block.massTrend.weightKgPerWeek > 0 ? "+" : "−"
      }${formatKgBr(Math.abs(block.massTrend.weightKgPerWeek))} kg/semana`
    )
  }
  const waist = health.markers.find((item) => item.key === "waist")
  if (waist?.value != null) lines.push(`Cintura: ${formatKgBr(waist.value)} cm`)
  if (block.relativeLoad.length > 0) {
    const worst = block.relativeLoad[0]
    lines.push(
      `Carga × recorde: pior caso ${worst.name} em ${worst.relativePct}% de ${formatKgBr(worst.bestWeight)} kg`
    )
  }
  if (block.highlights.length > 0) {
    lines.push("", "Destaques:", ...block.highlights.slice(0, 3).map((line) => `• ${line}`))
  }
  if (block.gaps.length > 0) {
    lines.push("", "Atenção:", ...block.gaps.slice(0, 3).map((line) => `• ${line}`))
  }
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */
/* Fita de calendário do período                                        */
/* ------------------------------------------------------------------ */

export interface CalendarCell {
  key: string
  kind: TrainingDayKind
  /** dia fora do recorte, desenhado como vazio e não como falha */
  outside: boolean
}

/**
 * Dias do período em colunas de semana (seg-dom), para a fita impressa.
 *
 * A tabela semanal já dizia quantas sessões houve por semana; nenhuma das
 * duas dizia ONDE ficaram os buracos. Numa fita de 84 quadrados, duas semanas
 * apagadas no meio de agosto se leem antes de qualquer número.
 */
export function periodCalendar(
  workouts: WorkoutLog[],
  from: string,
  to: string
): CalendarCell[][] {
  const kinds = trainingDayKinds(workouts, from, to)
  const start = mondayOf(fromDateKey(from))
  const end = fromDateKey(to)
  const weeks: CalendarCell[][] = []
  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
  ) {
    const days: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i)
      const key = toDateKey(date)
      days.push({
        key,
        kind: kinds.get(key) ?? "none",
        outside: key < from || key > to,
      })
    }
    weeks.push(days)
  }
  return weeks
}
