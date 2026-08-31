import { CardioLog, CardioPurpose, CardioRow, SessionId, WorkoutLog } from "./types"
import { formatActivityDuration } from "./strava"

/** Fonte de cardio de um treino: a lista nova ou o bloco único antigo. */
type CardioSource = Pick<WorkoutLog, "cardio" | "cardios">

/**
 * Blocos de cardio da sessão, na ordem em que foram feitos.
 * Registros anteriores à lista guardam um bloco só em `cardio`; os dois
 * formatos chegam aqui como a mesma lista, então nenhum cálculo precisa
 * saber qual versão gravou o treino.
 */
export function cardioBlocks(workout: CardioSource): CardioLog[] {
  if (workout.cardios && workout.cardios.length > 0) return workout.cardios
  return workout.cardio ? [workout.cardio] : []
}

/**
 * Finalidade efetiva de um bloco. Registros anteriores à classificação não
 * têm `purpose` e são interpretados pelo tipo da sessão.
 */
export function cardioPurposeOf(block: CardioLog, sessionId: SessionId): CardioPurpose {
  return block.purpose ?? (sessionId === "sport" ? "sport" : "zone2")
}

function minutesWithPurpose(workout: WorkoutLog, purpose: CardioPurpose): number {
  return cardioBlocks(workout)
    .filter((block) => cardioPurposeOf(block, workout.sessionId) === purpose)
    .reduce((sum, block) => sum + block.minutes, 0)
}

/** Minutos que realmente devem entrar na meta de base aeróbica (Zona 2). */
export function zone2Minutes(workout: WorkoutLog): number {
  return minutesWithPurpose(workout, "zone2")
}

/**
 * Minutos de cardio intenso (HIIT/tiros) — condicionamento que aparece à parte,
 * fora da meta de Z2. Não há dupla contagem com zone2Minutes: cada bloco cai
 * numa categoria só (blocos antigos sem `purpose` entram como Z2, ou como
 * esporte quando a sessão é esporte).
 */
export function intenseMinutes(workout: WorkoutLog): number {
  return minutesWithPurpose(workout, "intense")
}

/** Minutos de jogo/luta — ficam fora das metas de cardio. */
export function sportMinutes(workout: WorkoutLog): number {
  return minutesWithPurpose(workout, "sport")
}

/** Minutos de cardio da sessão somando todos os blocos. */
export function totalCardioMinutes(workout: CardioSource): number {
  return cardioBlocks(workout).reduce((sum, block) => sum + block.minutes, 0)
}

export const CARDIO_PURPOSE_LABEL: Record<CardioPurpose, string> = {
  zone2: "Zona 2",
  intense: "intenso",
  sport: "esporte",
}

/** Resumo em uma linha: "15 min Bike (Zona 2) · 20 min Corrida (intenso)" */
export function describeCardio(workout: WorkoutLog): string {
  return cardioBlocks(workout)
    .map((block) => {
      const purpose = CARDIO_PURPOSE_LABEL[cardioPurposeOf(block, workout.sessionId)]
      if (block.source !== "strava") return `${block.minutes} min ${block.mode} (${purpose})`
      const details = [
        block.durationSeconds !== undefined
          ? formatActivityDuration(block.durationSeconds)
          : `${block.minutes} min`,
        block.distanceKm !== undefined
          ? `${block.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`
          : "",
        block.steps !== undefined ? `${block.steps.toLocaleString("pt-BR")} passos` : "",
        block.elevationGainM !== undefined
          ? `+${Math.round(block.elevationGainM).toLocaleString("pt-BR")} m`
          : "",
      ].filter(Boolean)
      return `${block.title ?? block.mode} · ${details.join(" · ")} (${purpose})`
    })
    .join(" · ")
}

/**
 * Converte os blocos em edição nos blocos que vão para o banco. Linhas sem
 * minutos são descartadas — bloco em branco não vira registro —, esporte não
 * guarda BPM e `forceZone2` atende a sessão de Zona 2 do jiu-jitsu, onde a
 * finalidade é fixa.
 */
export function cardioRowsToBlocks(
  rows: CardioRow[],
  options: { forceZone2?: boolean } = {}
): CardioLog[] {
  return rows
    .map((row) => ({
      minutes: parseInt(row.minutes) || 0,
      avgBpm: row.purpose === "sport" ? undefined : parseInt(row.bpm) || undefined,
      mode: row.mode.trim() || "Cardio",
      purpose: options.forceZone2 ? ("zone2" as CardioPurpose) : row.purpose,
    }))
    .filter((block) => block.minutes > 0)
}

function isCardioLog(value: unknown): value is CardioLog {
  if (!value || typeof value !== "object") return false
  const block = value as Partial<CardioLog>
  return typeof block.minutes === "number" && typeof block.mode === "string"
}

/**
 * Normaliza as colunas do banco em um par consistente. O banco pode ser
 * editado direto e a coluna `cardios` só existe depois da migration 0007,
 * então aceitamos: lista nova, bloco único antigo e até uma lista gravada
 * na coluna antiga. `cardio` continua espelhando o primeiro bloco.
 */
export function normalizeCardioColumns(
  cardio: unknown,
  cardios: unknown
): Pick<WorkoutLog, "cardio" | "cardios"> {
  const source = Array.isArray(cardios) && cardios.length > 0 ? cardios : cardio
  const blocks = (Array.isArray(source) ? source : [source]).filter(isCardioLog)
  if (blocks.length === 0) return { cardio: undefined, cardios: undefined }
  return { cardio: blocks[0], cardios: blocks }
}
