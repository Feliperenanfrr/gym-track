import { cardioBlocks } from "./cardio"
import { isStrengthLog } from "./cycle"
import { enginePhaseFor } from "./engine-plan"
import { countsTowardProgramTarget } from "./plan"
import { SessionId, TrainingProgram, WorkoutLog } from "./types"
import { fromDateKey, mondayOf, toDateKey } from "./utils"

/**
 * Consistência: com que frequência você aparece.
 *
 * O painel media volume, carga e Zona 2 com precisão e não tinha uma única
 * leitura da variável que explica o resultado do bloco — quantos dias de
 * treino existiram e onde ficaram os buracos. Tudo aqui sai de `workouts`,
 * sem campo novo.
 *
 * A semana é seg–dom (calendário), não janela móvel: mapa de calor e barras
 * de aderência só fazem sentido ancorados no calendário real.
 */

const DAY_MS = 86_400_000

/** Alvo de sessões/semana na hipertrofia — mesma régua do card do painel. */
const HYPERTROPHY_WEEKLY_TARGET = 5

/**
 * Alvo semanal do programa ativo. No ciclo de motor o alvo vem do bloco em
 * que a semana cai ("5", "6" ou "5–6"): a faixa é lida pelo piso, porque o
 * mínimo é o que define se a semana foi cumprida.
 */
export function weeklySessionTarget(program: TrainingProgram, monday: Date): number {
  if (program !== "engine") return HYPERTROPHY_WEEKLY_TARGET
  const parsed = Number.parseInt(enginePhaseFor(monday).weeklySessions, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : HYPERTROPHY_WEEKLY_TARGET
}

/* ------------------------------------------------------------------ */
/* Mapa de calendário                                                   */
/* ------------------------------------------------------------------ */

export type TrainingDayKind = "none" | "lift" | "cardio" | "both"

export interface CalendarDay {
  /** yyyy-MM-dd */
  key: string
  kind: TrainingDayKind
  sessionIds: SessionId[]
  isToday: boolean
  /** dia futuro dentro da semana corrente — desenhado como vazio, não como falha */
  isFuture: boolean
}

export interface CalendarWeek {
  /** yyyy-MM-dd da segunda-feira */
  start: string
  /** dd/MM da segunda */
  label: string
  /** "set" quando a semana abre um mês novo na fita — senão null */
  monthLabel: string | null
  days: CalendarDay[]
}

const MONTH_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const

function shortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Classifica o dia pelo que foi registrado nele. */
function dayKind(dayWorkouts: WorkoutLog[]): TrainingDayKind {
  if (dayWorkouts.length === 0) return "none"
  const lift = dayWorkouts.some(isStrengthLog)
  const cardio = dayWorkouts.some((w) => cardioBlocks(w).length > 0)
  if (lift && cardio) return "both"
  if (lift) return "lift"
  if (cardio) return "cardio"
  // sessão registrada sem série e sem bloco de cardio (esporte, tatame):
  // continua sendo um dia em que você apareceu
  return "cardio"
}

/** Tipo de treino por dia num intervalo — a fita dos relatórios sai daqui. */
export function trainingDayKinds(
  workouts: WorkoutLog[],
  from: string,
  to: string
): Map<string, TrainingDayKind> {
  const byDate = new Map<string, WorkoutLog[]>()
  for (const w of workouts) {
    if (w.sessionId === "rest" || w.date < from || w.date > to) continue
    const list = byDate.get(w.date)
    if (list) list.push(w)
    else byDate.set(w.date, [w])
  }
  const out = new Map<string, TrainingDayKind>()
  for (const [date, list] of byDate) out.set(date, dayKind(list))
  return out
}

/**
 * Fita de calendário terminando na semana corrente. Cada semana é uma coluna
 * de 7 dias (seg → dom), do jeito que um mapa de calor de treino se lê.
 */
export function trainingCalendar(
  workouts: WorkoutLog[],
  today: Date,
  weeks = 26
): CalendarWeek[] {
  const todayKey = toDateKey(today)
  const byDate = new Map<string, WorkoutLog[]>()
  for (const w of workouts) {
    if (w.sessionId === "rest") continue
    const list = byDate.get(w.date)
    if (list) list.push(w)
    else byDate.set(w.date, [w])
  }

  const lastMonday = mondayOf(today)
  const out: CalendarWeek[] = []
  let previousMonth = -1

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(
      lastMonday.getFullYear(),
      lastMonday.getMonth(),
      lastMonday.getDate() - i * 7
    )
    const days: CalendarDay[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d)
      const key = toDateKey(date)
      const dayWorkouts = byDate.get(key) ?? []
      days.push({
        key,
        kind: dayKind(dayWorkouts),
        sessionIds: dayWorkouts.map((w) => w.sessionId),
        isToday: key === todayKey,
        isFuture: key > todayKey,
      })
    }
    // rótulo de mês só na primeira semana de cada mês — a fita fica legível
    // sem carimbar 26 datas num celular
    const month = start.getMonth()
    const monthLabel = month !== previousMonth ? MONTH_SHORT[month] : null
    previousMonth = month
    out.push({ start: toDateKey(start), label: shortDate(start), monthLabel, days })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Aderência semanal                                                    */
/* ------------------------------------------------------------------ */

export interface ConsistencyWeek {
  /** yyyy-MM-dd da segunda */
  start: string
  /** rótulo curto p/ o eixo (dd/MM) */
  label: string
  /** sessões que contam para a meta do programa */
  sessions: number
  /** dias distintos com qualquer registro */
  days: number
  target: number
  onTarget: boolean
  /** semana ainda em curso */
  current: boolean
}

/** Últimas `weeks` semanas seg–dom, a última terminando na semana de hoje. */
export function consistencyWeeks(
  workouts: WorkoutLog[],
  today: Date,
  program: TrainingProgram,
  weeks = 12
): ConsistencyWeek[] {
  const lastMonday = mondayOf(today)
  const out: ConsistencyWeek[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(
      lastMonday.getFullYear(),
      lastMonday.getMonth(),
      lastMonday.getDate() - i * 7
    )
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    const startKey = toDateKey(start)
    const endKey = toDateKey(end)
    const ws = workouts.filter((w) => w.date >= startKey && w.date <= endKey)
    const sessions = ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length
    const target = weeklySessionTarget(program, start)
    out.push({
      start: startKey,
      label: shortDate(start),
      sessions,
      days: new Set(ws.filter((w) => w.sessionId !== "rest").map((w) => w.date)).size,
      target,
      onTarget: sessions >= target,
      current: i === 0,
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Lacunas e aderência num intervalo qualquer                          */
/* ------------------------------------------------------------------ */

export interface TrainingGap {
  /** primeiro dia vazio */
  from: string
  /** último dia vazio */
  to: string
  days: number
}

export interface RangeConsistency {
  from: string
  to: string
  /** dias com treino no intervalo */
  daysTrained: number
  /** dias corridos do intervalo */
  daysInPeriod: number
  /** daysTrained ÷ daysInPeriod, em % */
  adherencePct: number
  /** média de dias treinados por semana */
  avgDaysPerWeek: number
  longestGapDays: number
  longestGapFrom: string | null
  longestGapTo: string | null
  /** todas as lacunas de `minGapDays` ou mais, em ordem cronológica */
  gaps: TrainingGap[]
}

/**
 * Aderência e lacunas de um intervalo arbitrário — a mesma conta do resumo do
 * painel, liberta do "hoje".
 *
 * Os relatórios precisam disso ancorado no período do documento: um
 * fechamento de bloco que não diz onde ficaram os buracos descreve o treino
 * que existiu e some com o que faltou, que costuma ser o fato maior.
 *
 * A lacuna é medida em dias vazios, não em distância entre sessões: treinar
 * dia 18 e voltar dia 5 é "17 dias sem treino". As bordas contam — começar o
 * bloco duas semanas depois do início é lacuna igual.
 */
export function consistencyInRange(
  workouts: WorkoutLog[],
  from: string,
  to: string,
  { minGapDays = 7 }: { minGapDays?: number } = {}
): RangeConsistency {
  const start = fromDateKey(from)
  const end = fromDateKey(to)
  const trained = [
    ...new Set(
      workouts
        .filter((w) => w.sessionId !== "rest" && w.date >= from && w.date <= to)
        .map((w) => w.date)
    ),
  ].sort()

  const daysInPeriod = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1)

  const gaps: TrainingGap[] = []
  let cursor = start
  const pushGap = (gapFrom: Date, toExclusive: Date) => {
    const days = Math.round((toExclusive.getTime() - gapFrom.getTime()) / DAY_MS)
    if (days >= minGapDays) {
      gaps.push({
        from: toDateKey(gapFrom),
        to: toDateKey(new Date(toExclusive.getTime() - DAY_MS)),
        days,
      })
    }
  }
  for (const key of trained) {
    const day = fromDateKey(key)
    pushGap(cursor, day)
    cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  }
  // lacuna aberta até o fim do intervalo
  pushGap(cursor, new Date(end.getTime() + DAY_MS))

  const longest = gaps.reduce<TrainingGap | null>(
    (best, gap) => (best === null || gap.days > best.days ? gap : best),
    null
  )

  return {
    from,
    to,
    daysTrained: trained.length,
    daysInPeriod,
    adherencePct: Math.round((trained.length / daysInPeriod) * 100),
    avgDaysPerWeek: Math.round((trained.length / (daysInPeriod / 7)) * 10) / 10,
    longestGapDays: longest?.days ?? 0,
    longestGapFrom: longest?.from ?? null,
    longestGapTo: longest?.to ?? null,
    gaps,
  }
}

/* ------------------------------------------------------------------ */
/* Resumo                                                              */
/* ------------------------------------------------------------------ */

export interface ConsistencySummary {
  /** dias com treino no período */
  daysTrained: number
  /** dias corridos do período (até hoje) */
  daysInPeriod: number
  /** daysTrained ÷ daysInPeriod, em % */
  adherencePct: number
  /** média de dias treinados por semana no período */
  avgDaysPerWeek: number
  /** maior sequência de dias SEM nenhum treino */
  longestGapDays: number
  /** primeiro dia da maior lacuna (null quando não houve lacuna) */
  longestGapFrom: string | null
  /** último dia da maior lacuna */
  longestGapTo: string | null
  /** dias corridos desde a última musculação (null sem nenhuma) */
  daysSinceLift: number | null
  /** dias corridos desde qualquer treino (null sem nenhum) */
  daysSinceAny: number | null
  /**
   * Semanas consecutivas cumprindo o alvo, contadas de trás para frente. A
   * semana corrente só entra se JÁ cumpriu — meia semana não quebra a série
   * nem a infla.
   */
  weeksOnTarget: number
}

/**
 * A lacuna é medida em dias vazios, não em distância entre sessões: treinar
 * dia 18 e voltar dia 5 é "17 dias sem treino", que é a leitura que interessa.
 * A lacuna aberta (desde o último treino até hoje) entra na conta — parar
 * agora é tão relevante quanto ter parado em julho.
 */
export function consistencySummary(
  workouts: WorkoutLog[],
  today: Date,
  program: TrainingProgram,
  weeks = 12
): ConsistencySummary {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayKey = toDateKey(midnight)
  const lastMonday = mondayOf(today)
  const periodStart = new Date(
    lastMonday.getFullYear(),
    lastMonday.getMonth(),
    lastMonday.getDate() - (weeks - 1) * 7
  )
  const startKey = toDateKey(periodStart)

  // aderência e lacunas saem da mesma conta que os relatórios usam, com o
  // piso de lacuna em 1 dia: aqui a maior folga interessa mesmo curta
  const range = consistencyInRange(workouts, startKey, todayKey, { minGapDays: 1 })

  const lastAny = workouts
    .filter((w) => w.sessionId !== "rest" && w.date >= startKey && w.date <= todayKey)
    .map((w) => w.date)
    .sort()
    .pop()
  const lastLift = workouts
    .filter((w) => isStrengthLog(w) && w.date <= todayKey)
    .map((w) => w.date)
    .sort()
    .pop()
  const daysFrom = (key: string | undefined) =>
    key === undefined
      ? null
      : Math.max(0, Math.round((midnight.getTime() - fromDateKey(key).getTime()) / DAY_MS))

  const weekRows = consistencyWeeks(workouts, today, program, weeks)
  let weeksOnTarget = 0
  for (let i = weekRows.length - 1; i >= 0; i--) {
    const row = weekRows[i]
    if (row.onTarget) {
      weeksOnTarget++
      continue
    }
    // semana corrente ainda incompleta não quebra a série
    if (row.current) continue
    break
  }

  return {
    daysTrained: range.daysTrained,
    daysInPeriod: range.daysInPeriod,
    adherencePct: range.adherencePct,
    avgDaysPerWeek: range.avgDaysPerWeek,
    longestGapDays: range.longestGapDays,
    longestGapFrom: range.longestGapFrom,
    longestGapTo: range.longestGapTo,
    daysSinceLift: daysFrom(lastLift),
    daysSinceAny: daysFrom(lastAny),
    weeksOnTarget,
  }
}
