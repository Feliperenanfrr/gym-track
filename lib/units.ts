/**
 * Carga em libras — só como forma de DIGITAR e LER o que a máquina mostra.
 *
 * Regra: o sistema mede em kg. Toda carga é gravada em kg; painel,
 * relatórios, conquistas e 1RM continuam em kg. A libra existe no registro
 * porque metade das máquinas da academia tem pilha em lb, e converter de
 * cabeça no meio da série custava atenção e precisão: o histórico tinha
 * 23, 27, 32, 36 e 41 kg no abdominal — 50 a 90 lb arredondados para kg
 * inteiro, com erro de até meio quilo.
 */

export type LoadUnit = "kg" | "lb"

/** Libra internacional (avoirdupois), exata por definição. */
export const LB_TO_KG = 0.45359237

/**
 * Casas de kg gravadas a partir de lb. Com 3 casas, 100 lb → 45,359 kg volta
 * como 100,0 lb; com 2 (45,36) voltaria 100,002 — e o campo mostraria lixo.
 */
const KG_DECIMALS = 3

/**
 * Tolerância para reconhecer uma carga antiga em kg que era, na verdade, uma
 * placa em lb convertida de cabeça: dividida por 2,2 e arredondada para kg
 * inteiro. O histórico real cabe nela — 120 lb virou 55 kg (121,3 lb de
 * volta), 160 lb virou 72 kg (158,7 lb) — e uma placa real de 5 em 5 lb
 * nunca fica mais longe que 2,5 lb, então 1,5 não confunde vizinhas.
 */
const LEGACY_SNAP_LB = 1.5

function roundTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 1000) / 1000
}

/** Número digitado na unidade do equipamento → kg para gravar. */
export function inputToKg(value: number, unit: LoadUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (unit === "kg") return value
  const factor = 10 ** KG_DECIMALS
  return Math.round(value * LB_TO_KG * factor) / factor
}

/**
 * Carga gravada (kg) → número para o campo, na unidade do equipamento.
 * `recordedIn` é a unidade em que a carga foi DIGITADA quando registrada:
 * - lb → lb: volta exata (0,1 lb), do jeito que foi digitada;
 * - kg → lb: registro antigo, de antes da libra existir no app. Cai na
 *   placa de 5 lb mais próxima quando a diferença é só o arredondamento de
 *   quem converteu de cabeça (36 kg → 80 lb, não 79,4); senão, meia libra;
 * - lb → kg: a máquina "virou" kg — meio quilo basta;
 * - kg → kg: o valor como foi gravado.
 */
export function loadForInput(
  kg: number,
  unit: LoadUnit,
  recordedIn: LoadUnit = "kg"
): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0
  if (unit === "kg") return recordedIn === "lb" ? roundTo(kg, 0.5) : kg
  const lb = kg / LB_TO_KG
  if (recordedIn === "lb") return roundTo(lb, 0.1)
  const plate = Math.round(lb / 5) * 5
  return Math.abs(lb - plate) <= LEGACY_SNAP_LB ? plate : roundTo(lb, 0.5)
}

/**
 * A carga gravada em kg parece uma placa em lb convertida de cabeça? (36 kg →
 * 80 lb sim; 60 kg → 132,3 lb não). Base do palpite que separa, no
 * histórico, a extensora da pilha em lb da extensora em kg.
 */
export function isLegacyLbPlate(kg: number): boolean {
  if (!Number.isFinite(kg) || kg <= 0) return false
  const lb = kg / LB_TO_KG
  return Math.abs(lb - Math.round(lb / 5) * 5) <= LEGACY_SNAP_LB
}

/** Quilos com uma casa, no formato brasileiro ("45,4") — para o "≈ X kg". */
export function formatKgApprox(kg: number): string {
  return (Math.round(kg * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })
}
