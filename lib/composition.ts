import { BodyLog } from "./types"
import { fromDateKey } from "./utils"

/**
 * Trajetória cintura × peso.
 *
 * Peso e cintura viviam em dois gráficos de linha separados, e é justamente na
 * relação entre os dois que a recomposição aparece: perder 3 cm de cintura sem
 * mexer o peso é o resultado que o bloco procura, e em duas linhas paralelas
 * isso passa despercebido. Ligados em ordem cronológica, os pontos desenham um
 * caminho — e o caminho tem direção.
 *
 * Leitura: descer na diagonal (esquerda e para baixo) é perder peso e medida
 * juntos; andar para a ESQUERDA sem descer é perder peso sem perder medida
 * (provavelmente massa magra); descer sem andar para a esquerda é a
 * recomposição de fato.
 */

export interface WaistWeightPoint {
  /** yyyy-MM-dd */
  date: string
  /** dd/MM */
  label: string
  weightKg: number
  waistCm: number
}

/**
 * Só pares completos: um dia com peso e sem cintura não tem lugar num plano de
 * duas dimensões, e inventar a medida que falta com o valor anterior criaria
 * um movimento horizontal que nunca aconteceu.
 */
export function waistWeightTrail(
  body: BodyLog[],
  { limit = 12 }: { limit?: number } = {}
): WaistWeightPoint[] {
  return body
    .filter((b) => (b.weightKg ?? 0) > 0 && (b.waistCm ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((b) => {
      const d = fromDateKey(b.date)
      return {
        date: b.date,
        label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        weightKg: b.weightKg!,
        waistCm: b.waistCm!,
      }
    })
}
