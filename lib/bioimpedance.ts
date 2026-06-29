import { BodyLog } from "./types"

/**
 * Parser determinístico do export da balança de bioimpedância.
 *
 * O export é um CSV vertical de chave-valor (uma métrica por linha):
 *
 *   Metrica,Valor,Unidade,Classificacao
 *   Data,28/06/2026,,
 *   Peso,93.95,kg,Obeso
 *   Gordura corporal,30.2,%,Obeso
 *   ...
 *
 * Como o schema é fixo e já rotulado, não precisa de LLM: mapeamos o rótulo
 * (coluna "Metrica", normalizado sem acento) para o campo do BodyLog. Tolerante
 * a vírgula OU ponto-e-vírgula como separador e a vírgula OU ponto decimal.
 */

export interface ParsedBioimpedance {
  /** yyyy-MM-dd (do campo "Data", se presente) */
  date?: string
  weightKg?: number
  bmi?: number
  bodyFatPct?: number
  fatMassKg?: number
  skeletalMuscleKg?: number
  muscleMassKg?: number
  waterPct?: number
  visceralFat?: number
  bmrKcal?: number
}

export interface RecognizedMetric {
  /** rótulo amigável p/ exibir no preview */
  label: string
  field: keyof ParsedBioimpedance
  value: number | string
  unit?: string
}

export interface BioimpedanceParseResult {
  values: ParsedBioimpedance
  /** métricas reconhecidas e guardadas (p/ o preview de conferência) */
  recognized: RecognizedMetric[]
  /** rótulos lidos mas não guardados (sexo, idade, %s redundantes, etc.) */
  ignored: string[]
  /** problemas que impedem ou comprometem o salvamento */
  errors: string[]
}

/** Rótulo → campo guardado. Chave normalizada (sem acento, minúscula). */
const FIELD_BY_LABEL: Record<
  string,
  { field: keyof ParsedBioimpedance; unit: string }
> = {
  peso: { field: "weightKg", unit: "kg" },
  imc: { field: "bmi", unit: "" },
  "gordura corporal": { field: "bodyFatPct", unit: "%" },
  "peso da gordura": { field: "fatMassKg", unit: "kg" },
  "peso da massa muscular esqueletica": { field: "skeletalMuscleKg", unit: "kg" },
  "peso da massa muscular": { field: "muscleMassKg", unit: "kg" },
  agua: { field: "waterPct", unit: "%" },
  "gordura visceral": { field: "visceralFat", unit: "" },
  metabolismo: { field: "bmrKcal", unit: "kcal" },
}

/** Rótulos conhecidos que de propósito não guardamos (perfil ou redundante). */
const KNOWN_IGNORED = new Set([
  "data",
  "hora",
  "sexo",
  "idade",
  "altura",
  "percentual da massa muscular esqueletica",
  "registro de massa muscular",
  "peso da agua",
])

function normalizeLabel(s: string): string {
  return s
    .replace(/^"|"$/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Converte o texto do valor em número, tolerando formato BR e US:
 * "30.2"→30.2 · "30,2"→30.2 · "1.941,0"→1941 · "1,941.0"→1941 · "93.95 kg"→93.95
 */
export function parseNumber(raw: string): number | null {
  const s = (raw ?? "").replace(/[^\d.,-]/g, "").trim()
  if (!s) return null
  let cleaned = s
  const hasComma = s.includes(",")
  const hasDot = s.includes(".")
  if (hasComma && hasDot) {
    // o separador decimal é o que aparece por último
    cleaned =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "")
  } else if (hasComma) {
    cleaned = s.replace(",", ".")
  }
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** "28/06/2026" ou "2026-06-28" → "2026-06-28". */
export function parseBrDate(raw: string): string | null {
  const v = (raw ?? "").replace(/^"|"$/g, "").trim()
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) {
    const [, d, m, y] = br
    const mm = m.padStart(2, "0")
    const dd = d.padStart(2, "0")
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${y}-${mm}-${dd}`
    }
  }
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return iso ? v : null
}

function splitCells(line: string): string[] {
  const delimiter = line.includes(";") ? ";" : ","
  return line.split(delimiter).map((c) => c.trim())
}

export function parseBioimpedanceCsv(input: string): BioimpedanceParseResult {
  const values: ParsedBioimpedance = {}
  const recognized: RecognizedMetric[] = []
  const ignored: string[] = []
  const errors: string[] = []

  const lines = (input ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    const cells = splitCells(line)
    const rawLabel = cells[0] ?? ""
    const label = normalizeLabel(rawLabel)
    const rawValue = cells[1] ?? ""
    if (!label) continue

    // cabeçalho ("Metrica,Valor,...") — ignora silenciosamente
    if (label === "metrica" || label === "metric") continue

    if (label === "data") {
      const d = parseBrDate(rawValue)
      if (d) {
        values.date = d
        recognized.push({ label: "Data", field: "date", value: d })
      } else if (rawValue) {
        errors.push(`Data "${rawValue}" não reconhecida (esperado dd/mm/aaaa).`)
      }
      continue
    }

    const map = FIELD_BY_LABEL[label]
    if (!map) {
      if (!KNOWN_IGNORED.has(label)) ignored.push(rawLabel.replace(/^"|"$/g, ""))
      continue
    }

    const n = parseNumber(rawValue)
    if (n === null) {
      errors.push(`"${rawLabel}" sem valor numérico legível ("${rawValue}").`)
      continue
    }
    values[map.field] = n as never
    recognized.push({
      label: rawLabel.replace(/^"|"$/g, ""),
      field: map.field,
      value: n,
      unit: map.unit,
    })
  }

  if (values.weightKg === undefined) {
    errors.push("Peso não encontrado — é o único campo obrigatório para salvar.")
  }

  return { values, recognized, ignored, errors }
}

/**
 * Converte o resultado do parser num BodyLog pronto p/ addBodyLog.
 * `fallbackDate` (yyyy-MM-dd) é usado quando o export não traz "Data".
 * Retorna null se não houver peso (body_logs.weight_kg é NOT NULL).
 */
export function toBodyLog(
  parsed: ParsedBioimpedance,
  fallbackDate: string
): BodyLog | null {
  if (parsed.weightKg === undefined) return null
  return {
    date: parsed.date ?? fallbackDate,
    weightKg: parsed.weightKg,
    bodyFatPct: parsed.bodyFatPct,
    fatMassKg: parsed.fatMassKg,
    skeletalMuscleKg: parsed.skeletalMuscleKg,
    muscleMassKg: parsed.muscleMassKg,
    waterPct: parsed.waterPct,
    visceralFat: parsed.visceralFat,
    bmrKcal: parsed.bmrKcal,
    bmi: parsed.bmi,
  }
}
