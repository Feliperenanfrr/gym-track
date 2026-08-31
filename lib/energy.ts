import { sessionKcal, weightKgOn } from "./insights"
import { BodyLog, GymData } from "./types"
import { fromDateKey, toDateKey } from "./utils"

const DAY_MS = 86_400_000

/* ------------------------------------------------------------------ */
/* Constantes do modelo                                                 */
/* ------------------------------------------------------------------ */

/**
 * Densidade energética dos tecidos (Hall, 2008): perder 1 kg de gordura
 * libera ~9.440 kcal, enquanto 1 kg de massa magra (majoritariamente água e
 * proteína) vale ~1.816 kcal. É por isso que a bioimpedância importa aqui —
 * a mesma variação de 1 kg na balança significa energias MUITO diferentes
 * conforme venha de gordura ou de magra.
 */
export const KCAL_PER_KG_FAT = 9440
export const KCAL_PER_KG_LEAN = 1816
/** Tecido adiposo "de livro", usado quando não há composição para separar. */
export const KCAL_PER_KG_WEIGHT = 7700

/**
 * Fator sobre o basal para o que NÃO é treino registrado: digestão (TEF, ~10%
 * da ingestão) mais a rotina do dia (deslocamento, casa, trabalho em pé).
 * Fica baixo de propósito — caminhadas importadas do Strava já entram como
 * treino, então contá-las de novo aqui seria dupla contagem.
 * A faixa baixa/alta vira a incerteza exibida na estimativa de ingestão.
 */
export const PAL_BASE = 1.25
export const PAL_BASE_LOW = 1.15
export const PAL_BASE_HIGH = 1.4

/** Katch-McArdle: basal a partir da massa magra (precisa de bioimpedância). */
export function katchMcArdleBmr(leanKg: number): number {
  return 370 + 21.6 * leanKg
}

/* ------------------------------------------------------------------ */
/* Tendência de massa por regressão linear                              */
/* ------------------------------------------------------------------ */

interface Sample {
  /** dias desde a época (eixo x da regressão) */
  t: number
  v: number
}

/**
 * Inclinação (unidade/dia) por mínimos quadrados. Regressão em vez de
 * "último menos primeiro" porque a balança oscila com água, sal e intestino:
 * dois pontos isolados podem inverter o sinal da tendência real.
 */
export function slopePerDay(samples: Sample[]): number | null {
  if (samples.length < 2) return null
  const n = samples.length
  const meanT = samples.reduce((s, p) => s + p.t, 0) / n
  const meanV = samples.reduce((s, p) => s + p.v, 0) / n
  let num = 0
  let den = 0
  for (const p of samples) {
    num += (p.t - meanT) * (p.v - meanV)
    den += (p.t - meanT) ** 2
  }
  if (den <= 0) return null
  return num / den
}

export type MassBasis = "composition" | "weight"

export interface MassTrend {
  /** kg/semana de peso total (positivo = subindo) */
  weightKgPerWeek: number | null
  /** kg/semana de massa de gordura; null sem bioimpedância na janela */
  fatKgPerWeek: number | null
  /** kg/semana de massa magra (peso − gordura) */
  leanKgPerWeek: number | null
  /**
   * Energia armazenada (+) ou liberada (−) por dia, em kcal. É a ponte entre
   * a balança e a comida: se o corpo guardou 300 kcal/dia, a ingestão esteve
   * 300 kcal/dia acima do gasto.
   */
  storedKcalPerDay: number | null
  /** "composition" quando a gordura entrou na conta; "weight" no fallback */
  basis: MassBasis | null
  /** pesagens usadas */
  points: number
  /** dias entre a primeira e a última pesagem da janela */
  spanDays: number
  /** média de peso da janela (kg) — base para as metas em %/semana */
  avgWeightKg: number | null
}

const EMPTY_TREND: MassTrend = {
  weightKgPerWeek: null,
  fatKgPerWeek: null,
  leanKgPerWeek: null,
  storedKcalPerDay: null,
  basis: null,
  points: 0,
  spanDays: 0,
  avgWeightKg: null,
}

/** Massa de gordura do registro: direta, ou derivada do % quando só há ele. */
export function fatMassOf(log: BodyLog): number | undefined {
  if (log.fatMassKg !== undefined && log.fatMassKg > 0) return log.fatMassKg
  if (log.bodyFatPct !== undefined && log.bodyFatPct > 0 && (log.weightKg ?? 0) > 0) {
    return (log.weightKg! * log.bodyFatPct) / 100
  }
  return undefined
}

/** Span mínimo entre a 1ª e a última pesagem para a tendência valer algo. */
const MIN_SPAN_DAYS = 7

/**
 * Tendência de massa na janela [from, to] (yyyy-MM-dd, inclusive).
 *
 * Com pelo menos duas pesagens que também tragam gordura, separa gordura de
 * magra e converte cada uma pela sua densidade energética. Sem isso, cai para
 * a regra clássica de 7.700 kcal/kg — que superestima o desequilíbrio quando
 * boa parte da variação é água ou músculo.
 */
export function massTrend(body: BodyLog[], from: string, to: string): MassTrend {
  const inWindow = body
    .filter((b) => b.date >= from && b.date <= to && (b.weightKg ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (inWindow.length < 2) return { ...EMPTY_TREND, points: inWindow.length }

  const dayIndex = (key: string) => Math.round(fromDateKey(key).getTime() / DAY_MS)
  const weightSamples = inWindow.map((b) => ({ t: dayIndex(b.date), v: b.weightKg! }))
  const spanDays =
    weightSamples[weightSamples.length - 1].t - weightSamples[0].t
  const avgWeightKg =
    weightSamples.reduce((s, p) => s + p.v, 0) / weightSamples.length
  if (spanDays < MIN_SPAN_DAYS) {
    return { ...EMPTY_TREND, points: inWindow.length, spanDays, avgWeightKg }
  }

  const weightPerDay = slopePerDay(weightSamples)
  if (weightPerDay === null) {
    return { ...EMPTY_TREND, points: inWindow.length, spanDays, avgWeightKg }
  }

  const fatLogs = inWindow.filter((b) => fatMassOf(b) !== undefined)
  const fatSamples = fatLogs.map((b) => ({ t: dayIndex(b.date), v: fatMassOf(b)! }))
  const leanSamples = fatLogs.map((b) => ({
    t: dayIndex(b.date),
    v: b.weightKg! - fatMassOf(b)!,
  }))
  const fatSpan = fatSamples.length
    ? fatSamples[fatSamples.length - 1].t - fatSamples[0].t
    : 0
  const fatPerDay = fatSpan >= MIN_SPAN_DAYS ? slopePerDay(fatSamples) : null
  const leanPerDay = fatSpan >= MIN_SPAN_DAYS ? slopePerDay(leanSamples) : null

  const useComposition = fatPerDay !== null && leanPerDay !== null
  const storedKcalPerDay = useComposition
    ? fatPerDay * KCAL_PER_KG_FAT + leanPerDay * KCAL_PER_KG_LEAN
    : weightPerDay * KCAL_PER_KG_WEIGHT

  return {
    weightKgPerWeek: weightPerDay * 7,
    fatKgPerWeek: fatPerDay !== null ? fatPerDay * 7 : null,
    leanKgPerWeek: leanPerDay !== null ? leanPerDay * 7 : null,
    storedKcalPerDay: Math.round(storedKcalPerDay),
    basis: useComposition ? "composition" : "weight",
    points: inWindow.length,
    spanDays,
    avgWeightKg,
  }
}

/* ------------------------------------------------------------------ */
/* Orçamento diário de energia                                          */
/* ------------------------------------------------------------------ */

export type BmrSource = "scale" | "katch"

export interface EnergyBudget {
  /** metabolismo basal (kcal/dia) */
  bmr: number
  bmrSource: BmrSource
  /** rotina fora do treino + digestão (kcal/dia) */
  routine: number
  /** média diária das calorias de treino na janela (kcal/dia) */
  training: number
  /** gasto total estimado (kcal/dia) */
  tdee: number
}

/** Basal mais recente até `to`: valor da balança, senão Katch-McArdle. */
export function bmrFrom(
  body: BodyLog[],
  to: string
): { bmr: number; source: BmrSource } | null {
  const candidates = body
    .filter((b) => b.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
  for (let i = candidates.length - 1; i >= 0; i--) {
    const log = candidates[i]
    if (log.bmrKcal !== undefined && log.bmrKcal > 0) {
      return { bmr: Math.round(log.bmrKcal), source: "scale" }
    }
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    const log = candidates[i]
    const fat = fatMassOf(log)
    if (fat !== undefined && (log.weightKg ?? 0) > 0) {
      return { bmr: Math.round(katchMcArdleBmr(log.weightKg! - fat)), source: "katch" }
    }
  }
  return null
}

/** Soma das kcal de treino por dia (yyyy-MM-dd → kcal) no período. */
export function trainingKcalByDay(
  data: GymData,
  from: string,
  to: string
): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const workout of data.workouts) {
    if (workout.date < from || workout.date > to) continue
    const estimate = sessionKcal(workout, weightKgOn(data.body, workout.date))
    if (!estimate) continue
    byDay.set(workout.date, (byDay.get(workout.date) ?? 0) + estimate.mid)
  }
  return byDay
}

export function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (fromDateKey(to).getTime() - fromDateKey(from).getTime()) / DAY_MS
    ) + 1
  )
}

/**
 * Gasto diário estimado na janela: basal + rotina + a média DIÁRIA do treino
 * (as calorias da semana diluídas em sete dias, que é como a comida funciona).
 */
export function energyBudget(
  data: GymData,
  from: string,
  to: string
): EnergyBudget | null {
  const base = bmrFrom(data.body, to)
  if (!base) return null
  const days = Math.max(1, daysBetween(from, to))
  let trainingTotal = 0
  for (const kcal of trainingKcalByDay(data, from, to).values()) trainingTotal += kcal
  const routine = Math.round(base.bmr * (PAL_BASE - 1))
  const training = Math.round(trainingTotal / days)
  return {
    bmr: base.bmr,
    bmrSource: base.source,
    routine,
    training,
    tdee: base.bmr + routine + training,
  }
}

/* ------------------------------------------------------------------ */
/* Diagnóstico                                                          */
/* ------------------------------------------------------------------ */

export type SignalTone = "good" | "warn" | "bad" | "neutral"

export interface EnergySignal {
  id: "training-share" | "frequency" | "intensity" | "rate"
  label: string
  value: string
  tone: SignalTone
  hint: string
}

export interface EnergyReport {
  from: string
  to: string
  days: number
  trend: MassTrend
  budget: EnergyBudget | null
  /** ingestão implícita (kcal/dia): gasto + o que o corpo armazenou */
  intake: number | null
  /** faixa da ingestão pela incerteza da rotina (PAL 1,15–1,4) */
  intakeLow: number | null
  intakeHigh: number | null
  /** alvos de ingestão (kcal/dia) para manter, cortar e ganhar */
  targets: { maintain: number; cut: number; bulk: number } | null
  /** variação semanal em % do peso corporal */
  weeklyRatePct: number | null
  sessionsPerWeek: number
  /** fração do gasto que vem do treino registrado */
  trainingShare: number | null
  signals: EnergySignal[]
  /** leitura em uma frase */
  verdict: string
  /** o que fazer a seguir, em uma frase */
  advice: string
}

/** Alvos padrão: −0,5%/semana no corte, +0,25%/semana no ganho. */
const CUT_RATE_PCT = 0.5
const BULK_RATE_PCT = 0.25

function targetsFor(tdee: number, weightKg: number) {
  const kcalPerPct = (pct: number) => (weightKg * (pct / 100) * KCAL_PER_KG_WEIGHT) / 7
  return {
    maintain: Math.round(tdee / 10) * 10,
    cut: Math.round((tdee - kcalPerPct(CUT_RATE_PCT)) / 10) * 10,
    bulk: Math.round((tdee + kcalPerPct(BULK_RATE_PCT)) / 10) * 10,
  }
}

/**
 * Diagnóstico em uma frase. A composição manda no veredito quando existe:
 * subir de peso ganhando magra e perdendo gordura é recomposição, não excesso,
 * e o número da balança sozinho diria o contrário.
 */
function readTrend(trend: MassTrend, ratePct: number | null): string {
  const { fatKgPerWeek, leanKgPerWeek } = trend
  if (fatKgPerWeek !== null && leanKgPerWeek !== null) {
    if (fatKgPerWeek <= -0.05 && leanKgPerWeek >= -0.05) {
      return "Recomposição em curso: gordura caindo com massa magra preservada — o balanço está no ponto."
    }
    if (fatKgPerWeek >= 0.05 && leanKgPerWeek <= 0.05) {
      return "A gordura está subindo e a magra não acompanha: o excedente está vindo da comida, não do treino."
    }
  }
  if (ratePct === null) return "Sem variação suficiente para um veredito — siga registrando peso."
  if (ratePct <= -1) return "Perda rápida demais: nesse ritmo boa parte do que sai é massa magra."
  if (ratePct <= -0.25) return "Déficit produtivo: perda no ritmo que preserva músculo."
  if (ratePct < 0.25) return "Peso estável: você está comendo praticamente a manutenção."
  if (ratePct < 0.6) return "Ganho controlado: superávit leve, compatível com ganho de massa."
  return "Ganho rápido: o superávit está grande demais para ser só músculo."
}

/** Mínimo de sessões/semana e de kcal por sessão antes de acusar folga. */
const MIN_SESSIONS_PER_WEEK = 3
const LOW_SESSION_KCAL = 250
/** Abaixo disso, o treino é ruído no gasto do dia. */
const LOW_TRAINING_SHARE = 0.1

/**
 * Relatório de balanço energético da janela que termina em `today`.
 *
 * O que dá para saber sem registrar comida: o corpo é a balança da equação.
 * A variação de massa revela quanta energia sobrou ou faltou por dia; somando
 * isso ao gasto modelado (basal medido + rotina + treino estimado), sai a
 * ingestão que teria produzido exatamente essa variação.
 */
export function energyReport(
  data: GymData,
  today: Date,
  windowDays = 28
): EnergyReport {
  const to = toDateKey(today)
  const from = toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - (windowDays - 1))
  )
  const trend = massTrend(data.body, from, to)
  const budget = energyBudget(data, from, to)
  const days = daysBetween(from, to)

  const sessions = data.workouts.filter(
    (w) => w.date >= from && w.date <= to && w.sessionId !== "rest"
  )
  const sessionsPerWeek = Math.round(((sessions.length / days) * 7) * 10) / 10
  const trainingShare =
    budget && budget.tdee > 0 ? budget.training / budget.tdee : null

  const stored = trend.storedKcalPerDay
  const intake = budget && stored !== null ? Math.round(budget.tdee + stored) : null
  const intakeLow =
    budget && stored !== null
      ? Math.round(budget.bmr * PAL_BASE_LOW + budget.training + stored)
      : null
  const intakeHigh =
    budget && stored !== null
      ? Math.round(budget.bmr * PAL_BASE_HIGH + budget.training + stored)
      : null

  const weightForTargets = trend.avgWeightKg ?? weightKgOn(data.body, to) ?? null
  const targets =
    budget && weightForTargets ? targetsFor(budget.tdee, weightForTargets) : null

  const weeklyRatePct =
    trend.weightKgPerWeek !== null && weightForTargets
      ? (trend.weightKgPerWeek / weightForTargets) * 100
      : null

  const kcalPerSession =
    sessions.length > 0 && budget
      ? Math.round((budget.training * days) / sessions.length)
      : null

  const signals: EnergySignal[] = []
  if (trainingShare !== null) {
    const pct = Math.round(trainingShare * 100)
    signals.push({
      id: "training-share",
      label: "Treino no gasto",
      value: `${pct}%`,
      tone: trainingShare < LOW_TRAINING_SHARE ? "warn" : "good",
      hint:
        trainingShare < LOW_TRAINING_SHARE
          ? "O treino mexe pouco no total: quem decide o saldo é a comida e a rotina fora da academia."
          : "O treino já pesa no gasto do dia — dá para usá-lo como alavanca.",
    })
  }
  signals.push({
    id: "frequency",
    label: "Frequência",
    value: `${sessionsPerWeek.toLocaleString("pt-BR")}/sem`,
    tone: sessionsPerWeek >= MIN_SESSIONS_PER_WEEK ? "good" : "warn",
    hint:
      sessionsPerWeek >= MIN_SESSIONS_PER_WEEK
        ? "Volume de sessões suficiente para sustentar massa magra."
        : "Menos de 3 sessões por semana: pouco estímulo para segurar músculo em déficit.",
  })
  if (kcalPerSession !== null) {
    signals.push({
      id: "intensity",
      label: "Por sessão",
      value: `${kcalPerSession.toLocaleString("pt-BR")} kcal`,
      tone: kcalPerSession < LOW_SESSION_KCAL ? "warn" : "good",
      hint:
        kcalPerSession < LOW_SESSION_KCAL
          ? "Sessões curtas ou leves: mais densidade (menos descanso, mais Zona 2) rende mais gasto."
          : "Sessões com densidade boa para o gasto estimado.",
    })
  }
  if (weeklyRatePct !== null) {
    const tone: SignalTone =
      weeklyRatePct <= -1 || weeklyRatePct >= 0.6
        ? "bad"
        : weeklyRatePct <= -0.25 || weeklyRatePct >= 0.25
          ? "warn"
          : "neutral"
    signals.push({
      id: "rate",
      label: "Ritmo",
      value: `${weeklyRatePct > 0 ? "+" : ""}${weeklyRatePct.toFixed(2).replace(".", ",")}%/sem`,
      tone,
      hint: "Variação semanal em relação ao seu peso — a régua que independe de quanto você pesa.",
    })
  }

  const verdict = readTrend(trend, weeklyRatePct)
  let advice = "Registre peso e bioimpedância com regularidade para fechar a conta."
  if (targets && intake !== null) {
    const gapToCut = intake - targets.cut
    if (weeklyRatePct !== null && weeklyRatePct >= 0.25) {
      advice = `Para virar o jogo, mire ${targets.cut.toLocaleString("pt-BR")} kcal/dia — cerca de ${Math.round(gapToCut).toLocaleString("pt-BR")} kcal/dia a menos do que você vem comendo.`
    } else if (weeklyRatePct !== null && weeklyRatePct <= -1) {
      advice = `Suba para perto de ${targets.cut.toLocaleString("pt-BR")} kcal/dia: o corte atual está agressivo demais para segurar massa magra.`
    } else if (weeklyRatePct !== null && weeklyRatePct > -0.25) {
      advice = `Manutenção fica em ${targets.maintain.toLocaleString("pt-BR")} kcal/dia. Corte para ${targets.cut.toLocaleString("pt-BR")} kcal/dia para perder ~0,5%/semana, ou vá a ${targets.bulk.toLocaleString("pt-BR")} kcal/dia para ganhar devagar.`
    } else {
      advice = `Siga perto de ${intake.toLocaleString("pt-BR")} kcal/dia: o ritmo atual está na faixa que preserva músculo.`
    }
  }

  return {
    from,
    to,
    days,
    trend,
    budget,
    intake,
    intakeLow,
    intakeHigh,
    targets,
    weeklyRatePct,
    sessionsPerWeek,
    trainingShare,
    signals,
    verdict,
    advice,
  }
}

/* ------------------------------------------------------------------ */
/* Série semanal de saldo                                               */
/* ------------------------------------------------------------------ */

export interface EnergyBalancePoint {
  /** yyyy-MM-dd do fim da semana */
  key: string
  /** rótulo curto do eixo X (dd/MM) */
  label: string
  /** saldo estimado em kcal/dia; null sem pesagens suficientes na janela */
  balance: number | null
  /** equivalente em kg/semana da mesma tendência */
  kgPerWeek: number | null
  /** kcal de treino por dia na semana */
  training: number
  /** sessões registradas na semana */
  sessions: number
  /** semana ainda em andamento */
  current: boolean
}

export interface EnergyBalanceSeries {
  points: EnergyBalancePoint[]
  /** semanas com saldo calculável */
  measured: number
  /** média de kcal/dia de treino no período (linha de referência) */
  avgTraining: number
  /** janela móvel usada em cada ponto (dias) */
  trendWindowDays: number
}

/** Janela móvel de cada ponto: 21 dias amortece o ruído da balança. */
const ROLLING_WINDOW_DAYS = 21

/**
 * Saldo energético semana a semana.
 *
 * Cada barra usa a tendência de massa dos 21 dias que terminam naquela semana:
 * pesagem isolada oscila 1 kg com sal e água, o que valeria ±1.000 kcal/dia de
 * ruído numa janela de sete dias. A janela móvel é maior que o passo de uma
 * semana de propósito — o preço é uma série suavizada, o ganho é uma série que
 * não inverte de sinal por causa de um jantar japonês.
 */
export function energyBalanceSeries(
  data: GymData,
  today: Date,
  weeks = 10
): EnergyBalanceSeries {
  const points: EnergyBalancePoint[] = []
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let trainingTotal = 0
  let trainingDays = 0

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i * 7)
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
    const endKey = toDateKey(end)
    const startKey = toDateKey(start)

    const weekKcal = [...trainingKcalByDay(data, startKey, endKey).values()].reduce(
      (sum, kcal) => sum + kcal,
      0
    )
    const sessions = data.workouts.filter(
      (w) => w.date >= startKey && w.date <= endKey && w.sessionId !== "rest"
    ).length
    trainingTotal += weekKcal
    trainingDays += 7

    const trendStart = toDateKey(
      new Date(end.getFullYear(), end.getMonth(), end.getDate() - (ROLLING_WINDOW_DAYS - 1))
    )
    const trend = massTrend(data.body, trendStart, endKey)

    points.push({
      key: endKey,
      label: `${String(end.getDate()).padStart(2, "0")}/${String(end.getMonth() + 1).padStart(2, "0")}`,
      balance: trend.storedKcalPerDay,
      kgPerWeek: trend.weightKgPerWeek,
      training: Math.round(weekKcal / 7),
      sessions,
      current: i === 0,
    })
  }

  return {
    points,
    measured: points.filter((p) => p.balance !== null).length,
    avgTraining: trainingDays > 0 ? Math.round(trainingTotal / trainingDays) : 0,
    trendWindowDays: ROLLING_WINDOW_DAYS,
  }
}
