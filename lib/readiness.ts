import {
  computeReadiness,
  internalLoad,
  MIN_CHRONIC_DAYS,
  Readiness,
  ReadinessLevel,
  waterGoalMl,
} from "./insights"
import { computeSleepMetrics, formatSleepDuration, SLEEP_TARGET_MIN } from "./sleep"
import { GymData, WorkoutLog } from "./types"
import { mondayOf, toDateKey } from "./utils"

/**
 * Prontidão composta: carga + sono + hidratação.
 *
 * O sinal antigo era só ACWR — carga aguda sobre a base crônica. Isso mede
 * bem a carga EXTERNA e não mede recuperação, que é justamente o que sono e
 * água dizem. As duas séries já estavam no banco (44 noites, 45 dias de
 * hidratação) sem entrar em nenhuma decisão.
 *
 * O nível final é o PIOR dos componentes com dado suficiente, e o componente
 * que puxou para baixo é devolvido em `limiter` para a UI poder nomeá-lo.
 * Componente sem dado fica "building" e não contamina o resultado — a
 * ausência de registro não é sinal de fadiga.
 */

export type RecoveryDriverId = "load" | "sleep" | "water"

export interface RecoveryDriver {
  id: RecoveryDriverId
  label: string
  level: ReadinessLevel
  /** número curto para o card (já formatado) */
  value: string
  /** uma linha explicando de onde saiu o número */
  detail: string
}

export interface RecoverySignal {
  level: ReadinessLevel
  /** sinal de carga interna, preservado inteiro para quem já o usava */
  load: Readiness
  drivers: RecoveryDriver[]
  /** driver que define o nível; null quando ninguém tem dado ainda */
  limiter: RecoveryDriver | null
}

const SEVERITY: Record<ReadinessLevel, number> = {
  building: -1,
  green: 0,
  yellow: 1,
  red: 2,
}

/** Mínimo de dias registrados em 7 para um componente valer como sinal. */
const MIN_DAYS_FOR_SIGNAL = 3

/* ------------------------------------------------------------------ */
/* Sono                                                                */
/* ------------------------------------------------------------------ */

/**
 * Média de 7 dias contra a meta de 8 h, com a dívida acumulada como
 * desempate: dormir 7 h todo dia é diferente de dormir 4 h e 10 h.
 */
function sleepDriver(data: GymData, today: Date): RecoveryDriver {
  const metrics = computeSleepMetrics(data.sleep, today)
  if (metrics.registered7 < MIN_DAYS_FOR_SIGNAL || metrics.avg7Min === null) {
    return {
      id: "sleep",
      label: "Sono",
      level: "building",
      value: metrics.avg7Min !== null ? formatSleepDuration(metrics.avg7Min) : "—",
      detail: `${metrics.registered7}/7 noites registradas — precisa de ${MIN_DAYS_FOR_SIGNAL}`,
    }
  }

  const avg = metrics.avg7Min
  const debtHours = (metrics.debt7Min ?? 0) / 60
  const level: ReadinessLevel =
    avg >= 7 * 60 && debtHours <= 5 ? "green" : avg >= 6 * 60 ? "yellow" : "red"

  return {
    id: "sleep",
    label: "Sono",
    level,
    value: formatSleepDuration(avg),
    detail:
      level === "green"
        ? `média 7d acima de 7h · dívida ${formatSleepDuration(metrics.debt7Min)}`
        : level === "yellow"
          ? `média 7d entre 6h e 7h · dívida ${formatSleepDuration(metrics.debt7Min)} sobre a meta de ${SLEEP_TARGET_MIN / 60}h`
          : `média 7d abaixo de 6h · dívida ${formatSleepDuration(metrics.debt7Min)}`,
  }
}

/* ------------------------------------------------------------------ */
/* Hidratação                                                          */
/* ------------------------------------------------------------------ */

/**
 * Média dos DIAS REGISTRADOS nos últimos 7, contra a meta por peso. Contar
 * dia sem registro como zero puniria o esquecimento como se fosse desidratação.
 */
function waterDriver(data: GymData, today: Date): RecoveryDriver {
  const goal = waterGoalMl(data.body)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
  const startKey = toDateKey(start)
  const todayKey = toDateKey(today)
  const logs = data.hydration.filter(
    (h) => h.date >= startKey && h.date <= todayKey && h.ml > 0
  )

  if (logs.length < MIN_DAYS_FOR_SIGNAL) {
    return {
      id: "water",
      label: "Água",
      level: "building",
      value: "—",
      detail: `${logs.length}/7 dias registrados — precisa de ${MIN_DAYS_FOR_SIGNAL}`,
    }
  }

  const avg = logs.reduce((sum, h) => sum + h.ml, 0) / logs.length
  const share = avg / goal
  const level: ReadinessLevel = share >= 0.9 ? "green" : share >= 0.7 ? "yellow" : "red"

  return {
    id: "water",
    label: "Água",
    level,
    value: `${(avg / 1000).toFixed(1).replace(".", ",")} L`,
    detail: `${Math.round(share * 100)}% da meta de ${(goal / 1000).toFixed(1).replace(".", ",")} L · ${logs.length}/7 dias`,
  }
}

/* ------------------------------------------------------------------ */
/* Carga                                                               */
/* ------------------------------------------------------------------ */

function loadDriver(load: Readiness): RecoveryDriver {
  return {
    id: "load",
    label: "Carga",
    level: load.level,
    value: load.ratio !== null ? `${Math.round(load.ratio * 100)}%` : "—",
    detail:
      load.ratio === null
        ? "sem base crônica ainda — registre 2+ semanas"
        : `dos ${Math.round(load.chronic).toLocaleString("pt-BR")} AU/sem da base recente`,
  }
}

/* ------------------------------------------------------------------ */

export function computeRecovery(data: GymData, today: Date): RecoverySignal {
  const load = computeReadiness(data.workouts, today)
  const drivers: RecoveryDriver[] = [
    loadDriver(load),
    sleepDriver(data, today),
    waterDriver(data, today),
  ]

  const withSignal = drivers.filter((d) => d.level !== "building")
  if (withSignal.length === 0) {
    return { level: "building", load, drivers, limiter: null }
  }

  const limiter = withSignal.reduce((worst, d) =>
    SEVERITY[d.level] > SEVERITY[worst.level] ? d : worst
  )
  return { level: limiter.level, load, drivers, limiter }
}

/* ------------------------------------------------------------------ */
/* Carga interna por semana                                            */
/* ------------------------------------------------------------------ */

export interface WeeklyLoadPoint {
  /** yyyy-MM-dd da segunda */
  start: string
  /** dd/MM */
  label: string
  /** carga interna somada da semana (AU) */
  load: number
  /** sessões registradas na semana */
  sessions: number
  /** média das 4 semanas terminando nesta; null antes de haver 4 */
  avg4: number | null
  /** semana ainda em curso */
  current: boolean
}

/**
 * Carga interna semana a semana, com média móvel de 4 semanas.
 *
 * Substitui a série de ACWR, que foi construída e descartada: metade dos 90
 * dias não era leitura de fadiga (33 dias sem base suficiente, 13 exatamente
 * em zero), e buraco e zero pareciam a mesma coisa na tela significando o
 * oposto. O ACWR pressupõe treino quase diário; com 2 sessões por semana e
 * lacunas de duas semanas, o denominador é instável por construção — o
 * serrilhado descrevia a métrica, não o treino.
 *
 * Aqui não há denominador. A barra é o que você fez na semana e a linha é a
 * sua própria média recente, então a leitura é direta: acima da linha a carga
 * está subindo, abaixo está caindo. Mesmo dado, sem a divisão que explodia.
 *
 * O sinal de "como estou hoje" continua no card de prontidão composta.
 */
export function weeklyLoadSeries(
  workouts: WorkoutLog[],
  today: Date,
  weeks = 12
): WeeklyLoadPoint[] {
  const lastMonday = mondayOf(today)
  const points: WeeklyLoadPoint[] = []

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
    points.push({
      start: startKey,
      label: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`,
      load: Math.round(ws.reduce((sum, w) => sum + internalLoad(w), 0)),
      sessions: ws.length,
      avg4: null,
      current: i === 0,
    })
  }

  // média móvel só a partir da 4ª semana: com menos que isso a "média" seria
  // uma linha puxada por uma semana só
  for (let i = 3; i < points.length; i++) {
    const window = points.slice(i - 3, i + 1)
    points[i].avg4 = Math.round(window.reduce((sum, p) => sum + p.load, 0) / 4)
  }

  return points
}

/** Piso de dias de treino na base, reexportado para a UI explicar o "—". */
export { MIN_CHRONIC_DAYS }
