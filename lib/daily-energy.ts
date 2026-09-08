import { bmrFrom, PAL_BASE, trainingKcalByDay } from "./energy"
import { dayTotals } from "./nutrition"
import { GymData } from "./types"
import { fromDateKey, toDateKey } from "./utils"

/**
 * Energia do DIA, não da janela.
 *
 * O painel de balanço energético trabalha em médias de 28 dias e o de calorias
 * em taxa semanal — nenhum dos dois responde "quanto gastei hoje". A diferença
 * é grande: um dia com dois treinos passa de 2.900 kcal enquanto um dia de
 * descanso fica em 2.400. Meia refeição de oscilação que a média esconde.
 *
 * Direção de import: daily-energy → nutrition → energy → insights.
 */

export interface DayEnergy {
  /** yyyy-MM-dd */
  date: string
  bmr: number
  /** rotina + digestão: basal × (PAL_BASE − 1) */
  routine: number
  /** kcal dos treinos DESTE dia, sem diluir na semana */
  training: number
  expenditure: number
  /** kcal registradas; null quando o dia não tem refeição */
  intake: number | null
  /** ingestão − gasto; null sem registro */
  balance: number | null
  logged: boolean
  complete: boolean
}

/** null quando não há basal (sem bioimpedância nem peso+gordura na base). */
export function dayEnergy(data: GymData, date: string): DayEnergy | null {
  const base = bmrFrom(data.body, date)
  if (!base) return null

  const routine = Math.round(base.bmr * (PAL_BASE - 1))
  const training = Math.round(trainingKcalByDay(data, date, date).get(date) ?? 0)
  const expenditure = base.bmr + routine + training

  const log = data.meals.find((day) => day.date === date)
  const logged = (log?.refeicoes.length ?? 0) > 0
  const intake = logged ? dayTotals(log).kcal : null

  return {
    date,
    bmr: base.bmr,
    routine,
    training,
    expenditure,
    intake,
    balance: intake === null ? null : intake - expenditure,
    logged,
    complete: log?.completo === true,
  }
}

export interface WeekBalance {
  from: string
  to: string
  /** dias na janela */
  days: number
  /** dias com alguma refeição registrada — a base da conta */
  loggedDays: number
  completeDays: number
  /** gasto somado APENAS dos dias com registro */
  expenditure: number
  intake: number
  balance: number
  /** algum dia entrou sem estar marcado como completo */
  partial: boolean
}

/**
 * Saldo acumulado da janela. É o número que move a balança: um dia isolado
 * oscila mais de 300 kcal só por água e digestão, sete dias já preveem.
 *
 * Soma só os dias COM registro. Comparar a ingestão de três dias contra o
 * gasto de sete produziria um déficit inventado de 5.000 kcal — por isso
 * `loggedDays` sai junto, para a tela dizer sobre quantos dias está falando.
 */
export function weekBalance(data: GymData, to: string, days = 7): WeekBalance | null {
  const end = fromDateKey(to)
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))

  let expenditure = 0
  let intake = 0
  let loggedDays = 0
  let completeDays = 0
  let hasBase = false

  for (let i = 0; i < days; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const day = dayEnergy(data, toDateKey(date))
    if (!day) continue
    hasBase = true
    if (!day.logged) continue
    loggedDays++
    if (day.complete) completeDays++
    expenditure += day.expenditure
    intake += day.intake!
  }

  if (!hasBase) return null
  return {
    from: toDateKey(start),
    to,
    days,
    loggedDays,
    completeDays,
    expenditure,
    intake,
    balance: intake - expenditure,
    partial: completeDays < loggedDays,
  }
}
