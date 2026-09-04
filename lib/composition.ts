import { BodyLog } from "./types"
import { fromDateKey } from "./utils"

/**
 * Peso e cintura na MESMA régua, num eixo de tempo comum.
 *
 * A primeira tentativa foi uma trajetória (cintura no eixo Y, peso no X, pontos
 * ligados em ordem). Falhou nos dados reais por três motivos que só aparecem
 * com o histórico na mão:
 *
 * 1. o caminho invertia de direção em 6 dos 8 segmentos — o peso oscila ~1 kg
 *    por água entre pesagens, então o desenho virava rabisco em vez de rota;
 * 2. a cintura é lida em centímetros inteiros e só tinha 4 valores distintos,
 *    então os pontos desabavam sobre 4 alturas e movimento horizontal puro
 *    parecia sinal quando era resolução de fita;
 * 3. não havia eixo de tempo: 1 dia entre duas medidas e 34 dias entre outras
 *    duas eram desenhados do mesmo tamanho.
 *
 * Indexar as duas séries à primeira medida (= 100) põe as duas na mesma escala
 * sem precisar de eixo duplo, e o tempo volta para o eixo X, que é onde o olho
 * o procura. O sinal passa a ser a DISTÂNCIA entre as linhas: cintura abaixo do
 * peso significa medida saindo mais rápido que massa, que é a recomposição.
 */

export interface IndexedBodyPoint {
  /** yyyy-MM-dd */
  date: string
  /** dd/MM */
  label: string
  /** dias desde a primeira medida — o eixo X é tempo real, não posição na fila */
  day: number
  weightKg: number
  waistCm: number
  /** peso ÷ primeiro peso × 100 */
  weightIndex: number
  /** cintura ÷ primeira cintura × 100 */
  waistIndex: number
  /** waistIndex − weightIndex, em pontos percentuais; negativo = cintura na frente */
  divergence: number
}

export interface IndexedBodyTrend {
  points: IndexedBodyPoint[]
  /** medida mais recente */
  latest: IndexedBodyPoint | null
  /** ponto de maior vantagem da cintura sobre o peso no período */
  bestDivergence: IndexedBodyPoint | null
  /** dias entre a primeira e a última medida */
  days: number
}

const DAY_MS = 86_400_000

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Só dias com peso E cintura: indexar exige uma base comum, e completar a
 * medida que falta com a anterior inventaria um movimento que não aconteceu.
 */
export function indexedBodyTrend(
  body: BodyLog[],
  { limit = 20 }: { limit?: number } = {}
): IndexedBodyTrend {
  const pairs = body
    .filter((b) => (b.weightKg ?? 0) > 0 && (b.waistCm ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)

  if (pairs.length === 0) {
    return { points: [], latest: null, bestDivergence: null, days: 0 }
  }

  const base = pairs[0]
  const baseTime = fromDateKey(base.date).getTime()
  const baseWeight = base.weightKg!
  const baseWaist = base.waistCm!

  const points: IndexedBodyPoint[] = pairs.map((b) => {
    const d = fromDateKey(b.date)
    const weightIndex = round1((b.weightKg! / baseWeight) * 100)
    const waistIndex = round1((b.waistCm! / baseWaist) * 100)
    return {
      date: b.date,
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      day: Math.round((d.getTime() - baseTime) / DAY_MS),
      weightKg: b.weightKg!,
      waistCm: b.waistCm!,
      weightIndex,
      waistIndex,
      divergence: round1(waistIndex - weightIndex),
    }
  })

  // "melhor" é a maior vantagem da cintura, e a base não conta: ela é zero por
  // definição, não por mérito
  const candidates = points.slice(1)
  const bestDivergence =
    candidates.length > 0
      ? candidates.reduce((best, p) => (p.divergence < best.divergence ? p : best))
      : null

  return {
    points,
    latest: points[points.length - 1],
    bestDivergence: bestDivergence && bestDivergence.divergence < 0 ? bestDivergence : null,
    days: points[points.length - 1].day,
  }
}
