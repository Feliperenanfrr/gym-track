import { parseBrDate, parseNumber } from "./bioimpedance"
import { fatMassOf } from "./energy"
import { weightKgOn } from "./insights"
import { BodyLog, Meal, MealItem, MealLog, MealSlot, MealTemplate } from "./types"

/**
 * Alimentação — parser determinístico + aritmética das refeições.
 *
 * A entrada de uma refeição NOVA é um JSON gerado fora do app (gem do Gemini),
 * no mesmo espírito do CSV da balança: o schema é fixo e já rotulado, então o
 * app só valida e soma. Nenhuma interpretação de linguagem natural roda aqui.
 *
 * Direção de import: nutrition → energy → insights, nunca o contrário — a
 * reconciliação entre ingestão registrada e derivada mora deste lado.
 */

/* ------------------------------------------------------------------ */
/* Refeições do dia                                                     */
/* ------------------------------------------------------------------ */

export const MEAL_SLOTS: { id: MealSlot; label: string; short: string }[] = [
  { id: "cafe", label: "Café da manhã", short: "Café" },
  { id: "almoco", label: "Almoço", short: "Almoço" },
  { id: "lanche", label: "Lanche", short: "Lanche" },
  { id: "jantar", label: "Jantar", short: "Jantar" },
  { id: "ceia", label: "Ceia", short: "Ceia" },
]

const SLOT_INDEX: Record<MealSlot, number> = {
  cafe: 0,
  almoco: 1,
  lanche: 2,
  jantar: 3,
  ceia: 4,
}

export function slotOrder(slot: MealSlot): number {
  return SLOT_INDEX[slot] ?? 99
}

export function slotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((s) => s.id === slot)?.label ?? slot
}

function deburr(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

const SLOT_ALIASES: Record<string, MealSlot> = {
  cafe: "cafe",
  "cafe da manha": "cafe",
  manha: "cafe",
  breakfast: "cafe",
  desjejum: "cafe",
  almoco: "almoco",
  lunch: "almoco",
  lanche: "lanche",
  "lanche da tarde": "lanche",
  "lanche da manha": "lanche",
  colacao: "lanche",
  snack: "lanche",
  jantar: "jantar",
  janta: "jantar",
  dinner: "jantar",
  ceia: "ceia",
  supper: "ceia",
}

export function normalizeSlot(raw: unknown): MealSlot | null {
  if (typeof raw !== "string") return null
  return SLOT_ALIASES[deburr(raw)] ?? null
}

/** Fallback quando o JSON não traz `refeicao` mas traz a hora. */
export function slotFromTime(hora: string | undefined): MealSlot | null {
  if (!hora) return null
  const match = hora.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  if (minutes < 10 * 60 + 30) return "cafe"
  if (minutes < 14 * 60 + 30) return "almoco"
  if (minutes < 18 * 60) return "lanche"
  if (minutes < 22 * 60) return "jantar"
  return "ceia"
}

/* ------------------------------------------------------------------ */
/* Unidades                                                             */
/* ------------------------------------------------------------------ */

export const MEAL_UNITS = [
  "g",
  "ml",
  "unidade",
  "fatia",
  "concha",
  "colher",
  "copo",
  "filé",
  "scoop",
  "pote",
  "pão",
] as const

const UNIT_BY_KEY = new Map<string, string>(
  MEAL_UNITS.map((unit) => [deburr(unit), unit])
)

const UNIT_ALIASES: Record<string, string> = {
  gramas: "g",
  grama: "g",
  gr: "g",
  grs: "g",
  mls: "ml",
  mililitro: "ml",
  mililitros: "ml",
  "colher de sopa": "colher",
  "colheres de sopa": "colher",
  "colher de sobremesa": "colher",
  "colher de cha": "colher",
  un: "unidade",
  und: "unidade",
  unid: "unidade",
}

/** Aceita plural e variações comuns; null quando não reconhece. */
export function normalizeUnit(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const key = deburr(raw).replace(/\s+/g, " ")
  if (!key) return null
  return (
    UNIT_BY_KEY.get(key) ??
    UNIT_ALIASES[key] ??
    UNIT_BY_KEY.get(key.replace(/s$/, "")) ??
    UNIT_ALIASES[key.replace(/s$/, "")] ??
    null
  )
}

/* ------------------------------------------------------------------ */
/* Aritmética                                                           */
/* ------------------------------------------------------------------ */

export interface MealTotals {
  kcal: number
  proteinaG: number
  carboG: number
  gorduraG: number
  /** itens somados */
  itens: number
  /**
   * Itens que não trouxeram o macro. Acima de zero, o total correspondente é
   * um PISO, não o valor — sem isso a soma parece exata e engana. kcal e
   * proteína não têm o problema: são obrigatórios no item.
   */
  itensSemCarbo: number
  itensSemGordura: number
}

const EMPTY_TOTALS: MealTotals = {
  kcal: 0,
  proteinaG: 0,
  carboG: 0,
  gorduraG: 0,
  itens: 0,
  itensSemCarbo: 0,
  itensSemGordura: 0,
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function mealTotals(itens: MealItem[]): MealTotals {
  if (!itens || itens.length === 0) return { ...EMPTY_TOTALS }
  let kcal = 0
  let proteinaG = 0
  let carboG = 0
  let gorduraG = 0
  let itensSemCarbo = 0
  let itensSemGordura = 0
  for (const item of itens) {
    kcal += item.kcal
    proteinaG += item.proteinaG
    if (item.carboG === undefined) itensSemCarbo++
    else carboG += item.carboG
    if (item.gorduraG === undefined) itensSemGordura++
    else gorduraG += item.gorduraG
  }
  return {
    kcal: Math.round(kcal),
    proteinaG: round1(proteinaG),
    carboG: round1(carboG),
    gorduraG: round1(gorduraG),
    itens: itens.length,
    itensSemCarbo,
    itensSemGordura,
  }
}

/** "210 g" quando a soma é completa; "≥210 g" quando algum item não trouxe. */
export function formatMacro(grams: number, missing: number): string {
  const value = grams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
  return missing > 0 ? `≥${value} g` : `${value} g`
}

/** Frase única sobre a cobertura dos macros, ou null quando está completa. */
export function macroCoverageNote(totals: MealTotals): string | null {
  const missing = Math.max(totals.itensSemCarbo, totals.itensSemGordura)
  if (missing === 0) return null
  return `${missing} de ${totals.itens} item(ns) sem carboidrato ou gordura — esses dois totais são piso, não valor.`
}

export function dayTotals(log: MealLog | undefined): MealTotals {
  if (!log) return { ...EMPTY_TOTALS }
  return mealTotals(log.refeicoes.flatMap((meal) => meal.itens))
}

/**
 * Reescala um item para outra quantidade — repetir o arroz, comer metade do
 * prato. Proporcional porque o JSON já traz os macros para `qtd × unidade`,
 * nunca por 100 g.
 */
export function scaleItem(item: MealItem, qtd: number): MealItem {
  const target = Math.max(0, qtd)
  if (item.qtd <= 0 || target === item.qtd) return { ...item, qtd: target }
  const factor = target / item.qtd
  const scaled: MealItem = {
    nome: item.nome,
    qtd: round1(target),
    unidade: item.unidade,
    kcal: Math.round(item.kcal * factor),
    proteinaG: round1(item.proteinaG * factor),
  }
  if (item.gramas !== undefined) scaled.gramas = round1(item.gramas * factor)
  if (item.carboG !== undefined) scaled.carboG = round1(item.carboG * factor)
  if (item.gorduraG !== undefined) scaled.gorduraG = round1(item.gorduraG * factor)
  return scaled
}

const PLURAL_IRREGULAR: Record<string, string> = { pão: "pães" }

/** "2 conchas", "1,5 filé", "400 ml" */
export function formatQty(item: MealItem): string {
  const qtd = item.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  if (item.unidade === "g" || item.unidade === "ml") return `${qtd} ${item.unidade}`
  if (item.qtd <= 1 || item.unidade.endsWith("s")) return `${qtd} ${item.unidade}`
  return `${qtd} ${PLURAL_IRREGULAR[item.unidade] ?? `${item.unidade}s`}`
}

/* ------------------------------------------------------------------ */
/* Alvo de proteína                                                     */
/* ------------------------------------------------------------------ */

/**
 * Em déficit o alvo sai da MASSA MAGRA quando há bioimpedância: a 30% de
 * gordura, calcular sobre o peso total infla o número por causa de tecido que
 * não usa proteína. Sem composição na base, cai para g/kg de peso.
 */
export const PROTEIN_G_PER_KG_LEAN_MIN = 2.0
export const PROTEIN_G_PER_KG_LEAN_MAX = 2.4
export const PROTEIN_G_PER_KG_WEIGHT_MIN = 1.6
export const PROTEIN_G_PER_KG_WEIGHT_MAX = 1.8

export interface ProteinTarget {
  min: number
  max: number
  /** meio da faixa — o número exibido como alvo */
  mid: number
  basis: "lean" | "weight"
  /** massa magra (ou peso, no fallback) usada na conta */
  referenceKg: number
}

export function proteinTarget(body: BodyLog[], dateKey: string): ProteinTarget | null {
  const upTo = [...body]
    .filter((log) => log.date <= dateKey)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (let i = upTo.length - 1; i >= 0; i--) {
    const log = upTo[i]
    const fat = fatMassOf(log)
    if (fat !== undefined && (log.weightKg ?? 0) > 0) {
      const lean = log.weightKg! - fat
      const min = Math.round(lean * PROTEIN_G_PER_KG_LEAN_MIN)
      const max = Math.round(lean * PROTEIN_G_PER_KG_LEAN_MAX)
      return {
        min,
        max,
        mid: Math.round((min + max) / 2),
        basis: "lean",
        referenceKg: round1(lean),
      }
    }
  }

  const weight = weightKgOn(body, dateKey)
  if (weight === undefined) return null
  const min = Math.round(weight * PROTEIN_G_PER_KG_WEIGHT_MIN)
  const max = Math.round(weight * PROTEIN_G_PER_KG_WEIGHT_MAX)
  return {
    min,
    max,
    mid: Math.round((min + max) / 2),
    basis: "weight",
    referenceKg: round1(weight),
  }
}

/** g de proteína por kg da base do alvo (magra ou peso). */
export function proteinPerKg(grams: number, target: ProteinTarget | null): number | null {
  if (!target || target.referenceKg <= 0) return null
  return Math.round((grams / target.referenceKg) * 100) / 100
}

/* ------------------------------------------------------------------ */
/* Parser do JSON da gem                                                */
/* ------------------------------------------------------------------ */

export interface ParsedMeal {
  nome: string
  slot: MealSlot
  itens: MealItem[]
  /** yyyy-MM-dd, quando o JSON traz `data` */
  date?: string
  /** HH:mm */
  hora?: string
  premissas?: string[]
}

/** Tolera cercas de código e texto solto antes/depois do objeto. */
function extractJson(raw: string): string | null {
  const text = (raw ?? "").trim()
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.search(/[[{]/)
  if (start === -1) return null
  const close = body[start] === "{" ? "}" : "]"
  const end = body.lastIndexOf(close)
  if (end <= start) return null
  return body.slice(start, end + 1)
}

/** Número vindo como number OU string ("12,5", "128 kcal"). */
function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") return parseNumber(value)
  return null
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Energia teórica dos macros — 4/4/9 kcal por grama (Atwater). */
function atwater(item: MealItem): number | null {
  if (item.carboG === undefined || item.gorduraG === undefined) return null
  return item.proteinaG * 4 + item.carboG * 4 + item.gorduraG * 9
}

/**
 * Checagens físicas do item. Existem por um motivo só: o erro mais provável da
 * gem é devolver os macros por 100 g em vez do total da porção, e isso passa
 * despercebido a olho nu. Nenhuma delas bloqueia — só acende a luz.
 */
function sanityWarnings(item: MealItem): string[] {
  const out: string[] = []
  if (item.gramas !== undefined && item.gramas > 0) {
    if (item.kcal / item.gramas > 9.5) {
      out.push(
        `"${item.nome}": ${item.kcal} kcal em ${item.gramas} g é mais denso que óleo puro — confira se o valor não veio por 100 g.`
      )
    }
    if (item.proteinaG > item.gramas) {
      out.push(
        `"${item.nome}": ${item.proteinaG} g de proteína em ${item.gramas} g de alimento é impossível.`
      )
    }
  }
  const theoretical = atwater(item)
  if (theoretical !== null && item.kcal > 0) {
    const gap = Math.abs(theoretical - item.kcal)
    if (gap > 60 && gap / item.kcal > 0.25) {
      out.push(
        `"${item.nome}": ${item.kcal} kcal não fecha com os macros (${Math.round(theoretical)} kcal por 4/4/9).`
      )
    }
  }
  return out
}

function parseItem(
  raw: unknown,
  index: number,
  errors: string[],
  warnings: string[]
): MealItem | null {
  const position = `item ${index + 1}`
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${position}: esperado um objeto.`)
    return null
  }
  const source = raw as Record<string, unknown>

  const nome = str(source.nome) ?? str(source.alimento) ?? str(source.name)
  if (!nome) {
    errors.push(`${position}: sem "nome".`)
    return null
  }

  const qtd = num(source.qtd ?? source.quantidade)
  if (qtd === null || qtd <= 0) {
    errors.push(`"${nome}": "qtd" ausente ou não positiva.`)
    return null
  }

  const rawUnit = str(source.unidade) ?? str(source.unit)
  if (!rawUnit) {
    errors.push(`"${nome}": sem "unidade".`)
    return null
  }
  const unidade = normalizeUnit(rawUnit)
  if (!unidade) {
    warnings.push(
      `"${nome}": unidade "${rawUnit}" fora da lista conhecida — mantida como veio.`
    )
  }

  const kcal = num(source.kcal ?? source.calorias)
  if (kcal === null || kcal < 0) {
    errors.push(`"${nome}": "kcal" ausente ou inválida.`)
    return null
  }

  const proteinaG = num(source.proteinaG ?? source.proteina ?? source.protein)
  if (proteinaG === null || proteinaG < 0) {
    errors.push(`"${nome}": "proteinaG" ausente ou inválida.`)
    return null
  }

  const item: MealItem = {
    nome,
    qtd: round1(qtd),
    unidade: unidade ?? rawUnit,
    kcal: Math.round(kcal),
    proteinaG: round1(proteinaG),
  }

  const gramas = num(source.gramas ?? source.g)
  if (gramas !== null && gramas > 0) item.gramas = round1(gramas)
  const carboG = num(source.carboG ?? source.carboidrato ?? source.carbs)
  if (carboG !== null && carboG >= 0) item.carboG = round1(carboG)
  const gorduraG = num(source.gorduraG ?? source.gordura ?? source.fat)
  if (gorduraG !== null && gorduraG >= 0) item.gorduraG = round1(gorduraG)

  warnings.push(...sanityWarnings(item))
  return item
}

/** Guarda contra colar o histórico inteiro por engano. */
export const MAX_BATCH_MEALS = 60

/** Uma refeição dentro do lote — inválida não derruba as outras. */
export interface ParsedMealEntry {
  /** posição no lote, usada como chave na tela */
  index: number
  meal: ParsedMeal | null
  warnings: string[]
  errors: string[]
}

export interface MealsParseResult {
  entries: ParsedMealEntry[]
  /** erros que derrubam o lote inteiro (JSON inválido, lista vazia) */
  errors: string[]
}

/** Uma refeição do lote: tudo depois de desembrulhar a lista. */
function parseSingleMeal(
  parsed: unknown,
  fallbackDate: string | undefined
): { meal: ParsedMeal | null; warnings: string[]; errors: string[] } {
  const warnings: string[] = []
  const errors: string[] = []

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { meal: null, warnings, errors: ["Esperado um objeto com nome, refeicao e itens."] }
  }
  const source = parsed as Record<string, unknown>

  const rawItems = source.itens ?? source.items ?? source.alimentos
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      meal: null,
      warnings,
      errors: ['Sem "itens" — a refeição precisa de pelo menos um alimento.'],
    }
  }

  const itens: MealItem[] = []
  for (let i = 0; i < rawItems.length; i++) {
    const item = parseItem(rawItems[i], i, errors, warnings)
    if (item) itens.push(item)
  }

  // Aviso agregado, não um por item: numa refeição de sete itens a lista
  // individual viraria ruído e ninguém leria nenhuma linha.
  const semMacro = itens.filter(
    (item) => item.carboG === undefined || item.gorduraG === undefined
  )
  if (semMacro.length > 0) {
    const nomes = semMacro.slice(0, 3).map((item) => item.nome).join(", ")
    const resto = semMacro.length > 3 ? ` e mais ${semMacro.length - 3}` : ""
    warnings.push(
      `${semMacro.length} item(ns) sem carboidrato ou gordura (${nomes}${resto}) — esses macros vão subestimar no total do dia.`
    )
  }

  const hora = (() => {
    const raw = str(source.hora) ?? str(source.horario)
    if (!raw) return undefined
    const match = raw.match(/^(\d{1,2}):(\d{2})/)
    if (!match) return undefined
    const h = Number(match[1])
    const m = Number(match[2])
    if (h > 23 || m > 59) return undefined
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  })()

  let slot = normalizeSlot(source.refeicao ?? source.slot)
  if (!slot) {
    const guessed = slotFromTime(hora)
    if (guessed) {
      slot = guessed
      warnings.push(
        `"refeicao" ausente — deduzida como ${slotLabel(guessed)} pela hora ${hora}.`
      )
    } else {
      slot = "almoco"
      warnings.push('"refeicao" ausente ou não reconhecida — assumido Almoço. Ajuste antes de salvar.')
    }
  }

  const nomeInformado = str(source.nome) ?? str(source.name)
  const nome = nomeInformado ?? slotLabel(slot)
  if (!nomeInformado) warnings.push(`"nome" ausente — usando "${nome}".`)

  const date = (() => {
    const raw = str(source.data) ?? str(source.date)
    if (!raw) return fallbackDate
    const parsedDate = parseBrDate(raw)
    if (!parsedDate) {
      warnings.push(`Data "${raw}" não reconhecida — vai para o dia selecionado.`)
      return fallbackDate
    }
    return parsedDate
  })()

  const premissas = Array.isArray(source.premissas)
    ? source.premissas.filter(
        (p): p is string => typeof p === "string" && p.trim().length > 0
      )
    : undefined

  if (itens.length === 0 && errors.length === 0) {
    errors.push("Nenhum item pôde ser lido.")
  }

  return {
    meal: errors.length > 0 ? null : { nome, slot, itens, date, hora, premissas },
    warnings,
    errors,
  }
}

/**
 * Lê um LOTE de refeições. Três formatos, todos aceitos:
 *
 *   [{...}, {...}]                          lista direta
 *   { "data": "07/09/2026", refeicoes: [] } lista com data comum ao lote
 *   {...}                                   uma refeição só
 *
 * Cada refeição carrega a própria `data` e `hora`, então um lote pode cobrir
 * vários dias — mandar o fim de semana inteiro de uma vez é o caso normal.
 * Uma refeição ilegível não derruba as outras: o erro fica na linha dela.
 */
export function parseMealsJson(input: string): MealsParseResult {
  const json = extractJson(input)
  if (!json) {
    return { entries: [], errors: ["Nada para ler — cole o JSON das refeições."] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return {
      entries: [],
      errors: [
        "JSON inválido. Cole a saída da gem sem editar (ela sai sem cercas de código).",
      ],
    }
  }

  let list: unknown[]
  let fallbackDate: string | undefined
  const wrapperWarnings: string[] = []

  if (Array.isArray(parsed)) {
    list = parsed
  } else if (parsed && typeof parsed === "object") {
    const source = parsed as Record<string, unknown>
    const nested = source.refeicoes ?? source.meals
    if (Array.isArray(nested)) {
      list = nested
      // data no envelope vale para as refeições que não trouxerem a própria
      const raw = str(source.data) ?? str(source.date)
      if (raw) {
        const parsedDate = parseBrDate(raw)
        if (parsedDate) fallbackDate = parsedDate
        else wrapperWarnings.push(`Data do lote "${raw}" não reconhecida.`)
      }
    } else {
      list = [parsed]
    }
  } else {
    return { entries: [], errors: ["Esperado um objeto ou uma lista de refeições."] }
  }

  if (list.length === 0) {
    return { entries: [], errors: ["A lista veio vazia."] }
  }
  if (list.length > MAX_BATCH_MEALS) {
    return {
      entries: [],
      errors: [
        `O lote tem ${list.length} refeições — o limite é ${MAX_BATCH_MEALS} por vez.`,
      ],
    }
  }

  const entries = list.map((raw, index) => {
    const parsedMeal = parseSingleMeal(raw, fallbackDate)
    return {
      index,
      meal: parsedMeal.meal,
      warnings: index === 0 ? [...wrapperWarnings, ...parsedMeal.warnings] : parsedMeal.warnings,
      errors: parsedMeal.errors,
    }
  })

  return { entries, errors: [] }
}

/** As refeições que passaram na validação, na ordem do lote. */
export function validEntries(result: MealsParseResult | null): ParsedMealEntry[] {
  if (!result) return []
  return result.entries.filter((entry) => entry.meal !== null)
}

/* ------------------------------------------------------------------ */
/* Identidade e snapshot                                                */
/* ------------------------------------------------------------------ */

/** "Café — cuscuz com ovo" → "cafe-cuscuz-com-ovo" */
export function slugify(value: string): string {
  const slug = deburr(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || "refeicao"
}

/** Id único para uma refeição registrada ou um template novo. */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

/**
 * Cópia profunda dos itens. É o coração da regra de snapshot: o que entra num
 * `Meal` nunca compartilha referência com o `MealTemplate` de origem, então
 * reimportar a refeição fixa pela gem não alcança nenhum dia já registrado.
 */
export function snapshotItems(itens: MealItem[]): MealItem[] {
  return itens.map((item) => ({ ...item }))
}

export function templateToMeal(template: MealTemplate, itens: MealItem[], hora?: string): Meal {
  return {
    id: newId("meal"),
    nome: template.nome,
    slot: template.slot,
    itens: snapshotItems(itens),
    templateId: template.id,
    hora,
  }
}
