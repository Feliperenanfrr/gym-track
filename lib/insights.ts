import { countsTowardProgramTarget, EXERCISES_BY_ID, PLAN_BY_ID } from "./plan"
import {
  cardioBlocks,
  cardioPurposeOf,
  totalCardioMinutes,
  zone2Minutes,
} from "./cardio"
import { CardioLog, GymData, SessionId, TrainingProgram, WorkoutLog } from "./types"
import { bestE1RM, fromDateKey, toDateKey, workoutVolume } from "./utils"

/* ------------------------------------------------------------------ */
/* Hidratação                                                           */
/* ------------------------------------------------------------------ */

const WATER_ML_PER_KG = 37 // meio da faixa do plano (35–40 ml/kg)
const WATER_FALLBACK_ML = 3300

/** Meta diária de água (ml) pelo peso corporal mais recente */
export function waterGoalMl(body: { weightKg?: number }[]): number {
  const kg = [...body].reverse().find((b) => (b.weightKg ?? 0) > 0)?.weightKg
  if (!kg) return WATER_FALLBACK_ML
  return Math.round((kg * WATER_ML_PER_KG) / 50) * 50
}

/* ------------------------------------------------------------------ */
/* PRs                                                                  */
/* ------------------------------------------------------------------ */

export interface PrEvent {
  /** yyyy-MM-dd */
  date: string
  exerciseId: string
  exerciseName?: string
}

/**
 * Eventos de PR em ordem cronológica: a 1RM estimada (Epley) do exercício
 * supera todo o histórico anterior. O primeiro registro de um exercício
 * estabelece a base e não conta como PR.
 */
export function prEvents(workouts: WorkoutLog[]): PrEvent[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const best: Record<string, number> = {}
  const events: PrEvent[] = []
  for (const w of sorted) {
    for (const e of w.entries) {
      const e1rm = bestE1RM(e)
      if (e1rm <= 0) continue
      const prev = best[e.exerciseId] ?? 0
      if (prev > 0 && e1rm > prev) {
        events.push({ date: w.date, exerciseId: e.exerciseId, exerciseName: e.exerciseName })
      }
      if (e1rm > prev) best[e.exerciseId] = e1rm
    }
  }
  return events
}

/* ------------------------------------------------------------------ */
/* Carga interna                                                        */
/* ------------------------------------------------------------------ */

/** AU por minuto de cada finalidade de cardio, para registros sem sRPE. */
const CARDIO_AU_PER_MIN = { zone2: 4, intense: 8, sport: 7 } as const

/** Soma a carga dos blocos de cardio pela finalidade de cada um. */
function cardioLoad(w: WorkoutLog): number {
  return cardioBlocks(w).reduce(
    (sum, block) =>
      sum + block.minutes * CARDIO_AU_PER_MIN[cardioPurposeOf(block, w.sessionId)],
    0
  )
}

/**
 * Carga interna da sessão em unidades arbitrárias (AU).
 * Com sRPE registrado: sRPE × minutos (método de Foster) — inclui
 * musculação, cardio E esporte na mesma moeda.
 * Fallbacks p/ registros antigos sem sRPE (documentados):
 *  - musculação: tonelagem × 0,05 (≈ RPE 7 × 60′ para ~8 t) + cardio pela finalidade
 *  - esporte: minutos × 7 (RPE assumido de jogo recreativo)
 *  - Zona 2: minutos × 4 (conversa confortável) · intenso: × 8
 */
export function internalLoad(w: WorkoutLog): number {
  const kind = PLAN_BY_ID[w.sessionId]?.kind
  if (w.srpe && w.srpe > 0) {
    const minutes =
      w.durationMin ??
      (kind === "lift" || (kind === "mixed" && w.entries.length > 0)
        ? 60
        : totalCardioMinutes(w))
    if (minutes > 0) return w.srpe * minutes
  }
  if (kind === "lift" || kind === "mixed") {
    return Math.round(workoutVolume(w) * 0.05 + cardioLoad(w))
  }
  return Math.round(cardioLoad(w))
}

/* ------------------------------------------------------------------ */
/* Readiness / fadiga                                                   */
/* ------------------------------------------------------------------ */

export type ReadinessLevel = "building" | "green" | "yellow" | "red"

export interface Readiness {
  level: ReadinessLevel
  /** carga aguda ÷ base crônica (null sem histórico suficiente) */
  ratio: number | null
  /** carga interna dos últimos 7 dias (AU) */
  acute: number
  /** média semanal dos 21 dias anteriores à janela aguda (AU) */
  chronic: number
}

const DAY_MS = 86_400_000

/**
 * Sinal de fadiga via razão carga aguda:crônica (ACWR): carga interna dos
 * últimos 7 dias contra a média semanal das 3 semanas anteriores.
 * ≤1.1 verde · ≤1.4 amarelo · >1.4 vermelho.
 */
export function computeReadiness(workouts: WorkoutLog[], today: Date): Readiness {
  const todayKey = toDateKey(today)
  const acuteStart = toDateKey(new Date(today.getTime() - 6 * DAY_MS))
  const chronicStart = toDateKey(new Date(today.getTime() - 27 * DAY_MS))
  const chronicEnd = toDateKey(new Date(today.getTime() - 7 * DAY_MS))

  let acute = 0
  let chronicTotal = 0
  for (const w of workouts) {
    if (w.date >= acuteStart && w.date <= todayKey) acute += internalLoad(w)
    else if (w.date >= chronicStart && w.date <= chronicEnd) chronicTotal += internalLoad(w)
  }
  const chronic = chronicTotal / 3

  if (chronic <= 0) return { level: "building", ratio: null, acute, chronic: 0 }

  const ratio = acute / chronic
  const level: ReadinessLevel = ratio <= 1.1 ? "green" : ratio <= 1.4 ? "yellow" : "red"
  return { level, ratio, acute, chronic }
}

/* ------------------------------------------------------------------ */
/* Tendência de peso (médias móveis de 7 dias)                          */
/* ------------------------------------------------------------------ */

export interface WeightTrend {
  /** média das pesagens dos últimos 7 dias (kg) */
  currentAvg: number | null
  /** média da janela comparável anterior (kg) */
  previousAvg: number | null
  /** currentAvg − previousAvg; null sem base comparável */
  delta: number | null
}

/**
 * Comparação de peso por média móvel: janela atual (hoje−6 … hoje) contra a
 * anterior (hoje−13 … hoje−7). Pesagem oscila com água/sal/intestino, então
 * média de janela > comparação de pontos isolados (ou "desde o início", que
 * vira ruído com o tempo).
 * Janela anterior vazia (peso esporádico)? Usa as até 4 pesagens mais
 * recentes anteriores a ela (limite de 60 dias) como referência. Nada
 * comparável → delta null e a UI mostra "—" em vez de inventar número.
 */
export function weightTrend7d(
  body: { date: string; weightKg?: number }[],
  today: Date
): WeightTrend {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const points = body
    .filter((b) => (b.weightKg ?? 0) > 0)
    .map((b) => ({ time: fromDateKey(b.date).getTime(), kg: b.weightKg! }))
    .filter((p) => !Number.isNaN(p.time) && p.time <= t0)
    .sort((a, b) => a.time - b.time)

  const winStart = t0 - 6 * DAY_MS
  const prevEnd = winStart - DAY_MS
  const prevStart = t0 - 13 * DAY_MS
  const current = points.filter((p) => p.time >= winStart)
  let previous = points.filter((p) => p.time >= prevStart && p.time <= prevEnd)
  if (previous.length === 0 && current.length > 0) {
    previous = points
      .filter((p) => p.time < winStart && p.time >= t0 - 60 * DAY_MS)
      .slice(-4)
  }

  const avg = (xs: { kg: number }[]) =>
    xs.length > 0 ? xs.reduce((s, p) => s + p.kg, 0) / xs.length : null

  const currentAvg = avg(current)
  const previousAvg = avg(previous)
  return {
    currentAvg,
    previousAvg,
    delta: currentAvg !== null && previousAvg !== null ? currentAvg - previousAvg : null,
  }
}

/* ------------------------------------------------------------------ */
/* Resumo semanal                                                       */
/* ------------------------------------------------------------------ */

export interface WeeklySummary {
  /** sessões registradas (sem descanso) */
  sessions: number
  /** nomes dos exercícios com PR na semana */
  prs: string[]
  /** volume de carga da semana (kg) */
  volume: number
  /** minutos de Zona 2 (cardio + finisher, esporte fora) */
  z2Minutes: number
  /**
   * gasto calórico estimado por METs, somando o mid de cada sessão
   * (arredondado a dezenas). null sem peso registrado — inventar 85 kg
   * produzia número com precisão que não existe; melhor "—" do que
   * caloria falsa.
   */
  kcal: number | null
  /** extremos da faixa somada (~−20% / +25% do mid) */
  kcalLow: number | null
  kcalHigh: number | null
}

/* ------------------------------------------------------------------ */
/* Calorias por sessão                                                  */
/* ------------------------------------------------------------------ */

// METs aproximados (Compendium of Physical Activities)
const MET_Z2 = 6.5 // fallback quando a modalidade não traz velocidade/distância
const MET_INTENSE = 8.5 // corda, tiros ou natação vigorosa
const MET_SPORT = 8 // jiu-jitsu (aula: drill + rola), futsal e flag recreativos
const LIFT_SESSION_MIN = 60 // fallback p/ treinos sem duração medida

/** faixa exibida junto ao mid: margem honesta de estimativa sem FC */
const KCAL_LOW_FACTOR = 0.8
const KCAL_HIGH_FACTOR = 1.25

/**
 * MET da musculação ancorado no esforço percebido (sRPE) em vez de fixar
 * "vigoroso": sRPE baixo ≈ sessão leve/moderada, alto ≈ quase falha.
 * Compendium 2024: sessão típica com vários exercícios e 8–15 reps = 3,5;
 * agachamento/terra lento ou explosivo = 5; musculação vigorosa = 6.
 * Sem sRPE, usa o padrão mais representativo de hipertrofia (3,5), em vez
 * de presumir que a sessão inteira foi vigorosa — inclusive nos descansos.
 */
export function liftMetForSrpe(srpe?: number): number {
  if (!srpe || srpe <= 0) return 3.5
  if (srpe <= 3) return 3
  if (srpe <= 5) return 3.5
  if (srpe <= 7) return 5
  return 6
}

/** peso corporal válido mais próximo DE ANTES do dia (fallback: 1ª pesagem) */
export function weightKgOn(
  body: { date: string; weightKg?: number }[],
  dateKey: string
): number | undefined {
  const sorted = [...body].sort((a, b) => a.date.localeCompare(b.date))
  let before: number | undefined
  for (const b of sorted) {
    if ((b.weightKg ?? 0) > 0 && b.date <= dateKey) before = b.weightKg!
  }
  if (before !== undefined) return before
  return sorted.find((b) => (b.weightKg ?? 0) > 0)?.weightKg
}

export interface SessionKcal {
  /** ponto central da estimativa (kcal) */
  mid: number
  /** parcela do ponto central atribuída à musculação */
  lift: number
  /** parcela do ponto central atribuída a todos os blocos de cardio */
  cardio: number
  /** extremos da faixa honesta (~−20% / +25%) */
  low: number
  high: number
  /** MET efetivo usado na parte de musculação (diagnóstico/tooltip) */
  met: number
  /** minutos contabilizados */
  minutes: number
}

const MET_BY_PURPOSE = {
  zone2: MET_Z2,
  intense: MET_INTENSE,
  sport: MET_SPORT,
} as const

function cardioDurationMinutes(block: CardioLog): number {
  return block.durationSeconds !== undefined && block.durationSeconds > 0
    ? block.durationSeconds / 60
    : block.minutes
}

function levelWalkingMet(speedKmh: number): number {
  if (speedKmh < 3.2) return 2.3
  if (speedKmh < 4) return 2.8
  if (speedKmh < 4.8) return 3.5
  if (speedKmh < 5.6) return 3.8
  if (speedKmh < 6.4) return 4.8
  if (speedKmh < 7.2) return 5.5
  if (speedKmh < 8) return 7
  return 8.5
}

function levelRunningMet(speedKmh: number): number {
  if (speedKmh < 6.4) return 6
  if (speedKmh < 6.9) return 6.5
  if (speedKmh < 8) return 7.8
  if (speedKmh < 8.8) return 8.5
  if (speedKmh < 9.6) return 9
  if (speedKmh < 10.7) return 9.3
  if (speedKmh < 11.3) return 10.5
  if (speedKmh < 12) return 11
  if (speedKmh < 12.9) return 11.8
  if (speedKmh < 13.8) return 12
  if (speedKmh < 14.5) return 12.5
  if (speedKmh < 15.3) return 13
  return 14.8
}

/**
 * MET de um bloco de cardio.
 *
 * Para caminhada/corrida importada, usa os dados que o Strava realmente
 * fornece em vez de classificar toda caminhada como 6,5 MET:
 * - caminhada com passos: equação de cadência de Moore et al. (2021), mais
 *   o componente vertical da equação ACSM quando há ganho de elevação;
 * - sem passos: faixa de velocidade do Compendium 2024;
 * - corrida: faixa de velocidade do Compendium 2024;
 * - elevação: componente vertical ACSM usando ganho/distância como inclinação
 *   média positiva aproximada (limitada a 15%, pois não temos o traçado bruto).
 */
export function cardioMet(block: CardioLog, sessionId: SessionId): number {
  const purpose = cardioPurposeOf(block, sessionId)
  const mode = block.mode
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  const walk = /caminh|walk|hike|trilha/.test(mode)
  const run = /corrida|running|run|jog/.test(mode)
  const duration = cardioDurationMinutes(block)
  const distance = block.distanceKm
  const speedKmh = distance && duration > 0 ? distance / (duration / 60) : 0
  const speedMMin = speedKmh * (1000 / 60)
  const grade =
    distance && distance > 0 && block.elevationGainM && block.elevationGainM > 0
      ? Math.min(0.15, block.elevationGainM / (distance * 1000))
      : 0

  if (walk) {
    let baseMet = speedKmh > 0 ? levelWalkingMet(speedKmh) : 3.8
    const cadence = block.steps && duration > 0 ? block.steps / duration : 0
    if (cadence >= 40 && cadence <= 200) {
      const vo2 = 1.811 + 0.02014 * cadence + 0.0007427 * cadence ** 2
      baseMet = vo2 / 3.5
    }
    // ACSM walking: componente vertical = 1,8 × velocidade(m/min) × grade.
    const verticalMet = speedMMin > 0 ? (1.8 * speedMMin * grade) / 3.5 : 0
    return Math.round(Math.min(12, Math.max(2, baseMet + verticalMet)) * 10) / 10
  }

  if (run) {
    const baseMet = speedKmh > 0 ? levelRunningMet(speedKmh) : purpose === "zone2" ? 7.5 : 8.5
    // ACSM running: componente vertical = 0,9 × velocidade(m/min) × grade.
    const verticalMet = speedMMin > 0 ? (0.9 * speedMMin * grade) / 3.5 : 0
    return Math.round(Math.min(20, Math.max(4, baseMet + verticalMet)) * 10) / 10
  }

  return MET_BY_PURPOSE[purpose]
}

/**
 * Estimativa calórica de UM treino por METs:
 * - musculação usa a duração REAL da parte de sala (duração total da sessão
 *   menos os minutos de cardio) e o MET adaptado pelo sRPE; sem duração
 *   medida (registro antigo/retroativo), cai para 60 min;
 * - caminhada/corrida com dados do Strava usa velocidade, cadência e elevação;
 *   os demais blocos usam o MET de sua finalidade.
 * null sem peso — a equação do MET depende da massa corporal real.
 */
export function sessionKcal(w: WorkoutLog, weightKg?: number): SessionKcal | null {
  if (!weightKg || weightKg <= 0) return null
  const kcalPerMin = (met: number) => (met * 3.5 * weightKg!) / 200
  const kind = PLAN_BY_ID[w.sessionId]?.kind
  const blocks = cardioBlocks(w)
  const cardioMin = totalCardioMinutes(w)
  const isLiftPart =
    (kind === "lift" || kind === "mixed") && w.entries.length > 0

  let liftTotal = 0
  let cardioTotal = 0
  let metUsed = 0
  let minutes = 0

  if (isLiftPart) {
    metUsed = liftMetForSrpe(w.srpe)
    // durationMin é a sessão inteira: o cardio é somado à parte, com o MET dele.
    const liftMin =
      w.durationMin && w.durationMin > 0
        ? Math.max(1, w.durationMin - cardioMin)
        : LIFT_SESSION_MIN
    liftTotal += liftMin * kcalPerMin(metUsed)
    minutes += liftMin
  }
  let longestBlockMin = 0
  for (const block of blocks) {
    const blockMet = cardioMet(block, w.sessionId)
    const blockMinutes = cardioDurationMinutes(block)
    cardioTotal += blockMinutes * kcalPerMin(blockMet)
    minutes += blockMinutes
    // sem musculação, o MET exibido no tooltip é o do bloco mais longo
    if (!isLiftPart && blockMinutes > longestBlockMin) {
      longestBlockMin = blockMinutes
      metUsed = blockMet
    }
  }
  const total = liftTotal + cardioTotal
  if (total <= 0) return null

  const mid = Math.round(total / 10) * 10
  // Arredonda uma vez e fecha a segunda parcela pelo total para que o gráfico
  // empilhado nunca apresente soma diferente do valor geral exibido.
  const lift = Math.round(liftTotal / 10) * 10
  return {
    mid,
    lift,
    cardio: mid - lift,
    low: Math.max(10, Math.round((mid * KCAL_LOW_FACTOR) / 10) * 10),
    high: Math.round((mid * KCAL_HIGH_FACTOR) / 10) * 10,
    met: Math.round(metUsed * 10) / 10,
    minutes: Math.round(minutes * 10) / 10,
  }
}

export type CalorieTrendRange = "12w" | "all"

export interface CalorieTrendPoint {
  /** chave estável do intervalo (data inicial ou yyyy-MM) */
  key: string
  /** rótulo curto para o eixo X */
  label: string
  lift: number
  cardio: number
  total: number
  /** intervalo ainda não encerrado */
  current: boolean
}

export interface CalorieTrend {
  points: CalorieTrendPoint[]
  total: number
  lift: number
  cardio: number
  estimatedSessions: number
  /** primeira atividade estimada dentro do período */
  from: string | null
  to: string
  granularity: "week" | "month"
  /** dias cobertos pelo período — converte o total em taxa */
  days: number
  /** média de kcal por semana no período (a taxa, não o acumulado) */
  perWeek: number
  /**
   * Mesma taxa na janela imediatamente anterior, para o delta. null no
   * histórico completo, que não tem "anterior" com que se comparar.
   */
  previousPerWeek: number | null
  /** média de kcal por sessão estimada */
  perSession: number
  /**
   * Média por intervalo fechado do gráfico — a linha de referência. O
   * intervalo em curso fica de fora: metade de uma semana rebaixaria a régua
   * contra a qual as semanas cheias são lidas.
   */
  perPoint: number
}

const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const

function shortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
}

function calendarDayIndex(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

/** Sessões do intervalo [from, to] que têm estimativa calórica, em ordem. */
function estimatedSessionsIn(
  data: GymData,
  from: string,
  to: string
): { workout: WorkoutLog; estimate: SessionKcal }[] {
  return data.workouts
    .filter((workout) => workout.date >= from && workout.date <= to)
    .map((workout) => ({
      workout,
      estimate: sessionKcal(workout, weightKgOn(data.body, workout.date)),
    }))
    .filter(
      (item): item is { workout: WorkoutLog; estimate: SessionKcal } =>
        item.estimate !== null
    )
    .sort((a, b) => a.workout.date.localeCompare(b.workout.date))
}

/**
 * Série para o painel de gasto calórico.
 *
 * - `all`: histórico completo agregado por mês, preservando meses zerados;
 * - `12w`: doze blocos consecutivos de sete dias, com o último terminando hoje.
 *
 * A musculação e o cardio de uma sessão mista são separados. "Cardio" inclui
 * qualquer bloco aeróbico: Zona 2, intenso, esporte e atividade do Strava.
 */
export function calorieTrend(
  data: GymData,
  today: Date,
  range: CalorieTrendRange = "all"
): CalorieTrend {
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayKey = toDateKey(normalizedToday)
  const rollingStart = new Date(
    normalizedToday.getFullYear(),
    normalizedToday.getMonth(),
    normalizedToday.getDate() - 83
  )
  const rollingStartKey = toDateKey(rollingStart)

  const sessions = estimatedSessionsIn(
    data,
    range === "all" ? "0000-01-01" : rollingStartKey,
    todayKey
  )

  const empty: CalorieTrend = {
    points: [],
    total: 0,
    lift: 0,
    cardio: 0,
    estimatedSessions: 0,
    from: null,
    to: todayKey,
    granularity: range === "all" ? "month" : "week",
    days: 0,
    perWeek: 0,
    previousPerWeek: null,
    perSession: 0,
    perPoint: 0,
  }
  if (sessions.length === 0) return empty

  const points: CalorieTrendPoint[] = []
  if (range === "all") {
    const first = fromDateKey(sessions[0].workout.date)
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
    const currentMonth = new Date(normalizedToday.getFullYear(), normalizedToday.getMonth(), 1)
    while (cursor <= currentMonth) {
      const year = cursor.getFullYear()
      const month = cursor.getMonth()
      points.push({
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: `${MONTH_SHORT[month]}/${String(year).slice(-2)}`,
        lift: 0,
        cardio: 0,
        total: 0,
        current: year === currentMonth.getFullYear() && month === currentMonth.getMonth(),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    const byKey = new Map(points.map((point) => [point.key, point]))
    for (const { workout, estimate } of sessions) {
      const point = byKey.get(workout.date.slice(0, 7))
      if (!point) continue
      point.lift += estimate.lift
      point.cardio += estimate.cardio
      point.total += estimate.mid
    }
  } else {
    for (let index = 0; index < 12; index++) {
      const start = new Date(
        rollingStart.getFullYear(),
        rollingStart.getMonth(),
        rollingStart.getDate() + index * 7
      )
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
      points.push({
        key: toDateKey(start),
        label: shortDate(end),
        lift: 0,
        cardio: 0,
        total: 0,
        current: index === 11,
      })
    }
    for (const { workout, estimate } of sessions) {
      const elapsedDays = calendarDayIndex(fromDateKey(workout.date)) - calendarDayIndex(rollingStart)
      const point = points[Math.floor(elapsedDays / 7)]
      if (!point) continue
      point.lift += estimate.lift
      point.cardio += estimate.cardio
      point.total += estimate.mid
    }
  }

  const total = points.reduce((sum, point) => sum + point.total, 0)
  // "all" começa na primeira atividade estimada; "12w" tem 84 dias fixos,
  // mesmo que os primeiros estejam vazios — o zero é informação.
  const firstDay =
    range === "all" ? fromDateKey(sessions[0].workout.date) : rollingStart
  const days = Math.max(
    1,
    calendarDayIndex(normalizedToday) - calendarDayIndex(firstDay) + 1
  )
  const closed = points.filter((point) => !point.current)
  const reference = closed.length > 0 ? closed : points

  let previousPerWeek: number | null = null
  if (range === "12w") {
    const previousEnd = new Date(
      rollingStart.getFullYear(),
      rollingStart.getMonth(),
      rollingStart.getDate() - 1
    )
    const previousStart = new Date(
      previousEnd.getFullYear(),
      previousEnd.getMonth(),
      previousEnd.getDate() - 83
    )
    const previous = estimatedSessionsIn(
      data,
      toDateKey(previousStart),
      toDateKey(previousEnd)
    )
    previousPerWeek =
      previous.length > 0
        ? Math.round(
            (previous.reduce((sum, item) => sum + item.estimate.mid, 0) / 84) * 7
          )
        : null
  }

  return {
    points,
    total,
    lift: points.reduce((sum, point) => sum + point.lift, 0),
    cardio: points.reduce((sum, point) => sum + point.cardio, 0),
    estimatedSessions: sessions.length,
    from: sessions[0].workout.date,
    to: todayKey,
    granularity: range === "all" ? "month" : "week",
    days,
    perWeek: Math.round((total / days) * 7),
    previousPerWeek,
    perSession: Math.round(total / sessions.length),
    perPoint: Math.round(
      reference.reduce((sum, point) => sum + point.total, 0) / reference.length
    ),
  }
}

/** Resumo da semana que começa em `monday` (PRs, frequência, volume, kcal) */
export function weeklySummary(
  data: GymData,
  monday: Date,
  program: TrainingProgram = "hypertrophy"
): WeeklySummary {
  const start = toDateKey(monday)
  const end = toDateKey(
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  )
  const ws = data.workouts.filter((w) => w.date >= start && w.date <= end)

  const sessions = ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length
  const volume = ws.reduce((s, w) => s + workoutVolume(w), 0)
  const z2Minutes = ws.reduce((sum, workout) => sum + zone2Minutes(workout), 0)

  // kcal só com peso real: o MET depende da massa corporal.
  // Cada sessão soma sua própria estimativa (duração real + sRPE).
  let midTotal = 0
  let lowTotal = 0
  let highTotal = 0
  for (const w of ws) {
    const est = sessionKcal(w, weightKgOn(data.body, w.date))
    if (!est) continue
    midTotal += est.mid
    lowTotal += est.low
    highTotal += est.high
  }

  const prNames = prEvents(data.workouts)
    .filter((p) => p.date >= start && p.date <= end)
    .map((p) => p.exerciseName ?? EXERCISES_BY_ID[p.exerciseId]?.name ?? p.exerciseId)

  const anyEstimate = ws.some(
    (w) => sessionKcal(w, weightKgOn(data.body, w.date)) !== null
  )
  return {
    sessions,
    prs: [...new Set(prNames)],
    volume,
    z2Minutes,
    kcal: anyEstimate ? Math.round(midTotal / 10) * 10 : null,
    kcalLow: anyEstimate ? Math.round(lowTotal / 10) * 10 : null,
    kcalHigh: anyEstimate ? Math.round(highTotal / 10) * 10 : null,
  }
}
