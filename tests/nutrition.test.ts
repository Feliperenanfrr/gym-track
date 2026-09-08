import { describe, expect, it } from "vitest"
import {
  dayTotals,
  formatMacro,
  formatQty,
  loggingCoverage,
  macroCoverageNote,
  mealCalendar,
  MAX_BATCH_MEALS,
  mealTotals,
  normalizeSlot,
  normalizeSource,
  normalizeUnit,
  parseMealsJson,
  proteinPerKg,
  proteinSeries,
  proteinTarget,
  scaleItem,
  slotDistribution,
  slotFromTime,
  slugify,
  sourceLabel,
  snapshotItems,
  templateToMeal,
  validEntries,
} from "../lib/nutrition"
import { BodyLog, MealItem, MealLog, MealTemplate } from "../lib/types"

/**
 * Atalho de leitura para os casos de uma refeição só: achata o lote na
 * primeira linha, com os erros do envelope quando nem chegou a haver linha.
 */
function first(input: string) {
  const result = parseMealsJson(input)
  const entry = result.entries[0]
  return {
    meal: entry?.meal ?? null,
    warnings: entry?.warnings ?? [],
    errors: entry ? entry.errors : result.errors,
  }
}

const ARROZ: MealItem = {
  nome: "Arroz branco cozido",
  qtd: 2,
  unidade: "concha",
  gramas: 200,
  kcal: 257,
  proteinaG: 5,
  carboG: 56.2,
  gorduraG: 0.4,
}

const FRANGO: MealItem = {
  nome: "Filé de frango grelhado",
  qtd: 1,
  unidade: "filé",
  gramas: 120,
  kcal: 198,
  proteinaG: 37,
}

/** o almoço de casa: arroz, frango — o caso que o app registra todo dia */
const ALMOCO_JSON = JSON.stringify({
  nome: "Almoço de casa",
  refeicao: "almoco",
  data: "07/09/2026",
  hora: "12:40",
  itens: [ARROZ, FRANGO],
  premissas: ["Concha de arroz estimada em 100 g"],
})

describe("parseMealsJson — refeição única", () => {
  it("lê o JSON limpo da gem", () => {
    const result = first(ALMOCO_JSON)
    expect(result.errors).toEqual([])
    expect(result.meal?.nome).toBe("Almoço de casa")
    expect(result.meal?.slot).toBe("almoco")
    expect(result.meal?.date).toBe("2026-09-07")
    expect(result.meal?.hora).toBe("12:40")
    expect(result.meal?.itens).toHaveLength(2)
    expect(result.meal?.premissas).toEqual(["Concha de arroz estimada em 100 g"])
  })

  it("tolera cercas de código e texto solto em volta", () => {
    const sujo = "Claro! Aqui está:\n```json\n" + ALMOCO_JSON + "\n```\nQualquer dúvida, avise."
    const result = first(sujo)
    expect(result.errors).toEqual([])
    expect(result.meal?.itens).toHaveLength(2)
  })

  it("aceita número em formato BR dentro de string", () => {
    const result = first(
      '{"nome":"Suco","refeicao":"almoco","itens":[{"nome":"Suco de laranja","qtd":"1","unidade":"copo","kcal":"180","proteinaG":"2,4"}]}'
    )
    expect(result.errors).toEqual([])
    expect(result.meal?.itens[0].proteinaG).toBe(2.4)
    expect(result.meal?.itens[0].kcal).toBe(180)
  })

  it("deduz a refeição pela hora quando o campo falta", () => {
    const result = first(
      '{"nome":"Cuscuz com ovo","hora":"07:10","itens":[{"nome":"Cuscuz","qtd":1,"unidade":"unidade","kcal":180,"proteinaG":4}]}'
    )
    expect(result.meal?.slot).toBe("cafe")
    expect(result.warnings.join(" ")).toContain("deduzida")
  })

  it("bloqueia item sem campo obrigatório", () => {
    const result = first(
      '{"nome":"X","refeicao":"jantar","itens":[{"nome":"Pão","qtd":1,"unidade":"fatia"}]}'
    )
    expect(result.meal).toBeNull()
    expect(result.errors.join(" ")).toContain("kcal")
  })

  it("recusa JSON inválido sem explodir", () => {
    const result = first("{isso não é json")
    expect(result.meal).toBeNull()
    expect(result.errors).toHaveLength(1)
  })

  /* O erro mais provável da gem: devolver macros por 100 g em vez da porção. */
  it("avisa quando a densidade é impossível", () => {
    const result = first(
      '{"nome":"X","refeicao":"almoco","itens":[{"nome":"Feijão","qtd":1,"unidade":"concha","gramas":90,"kcal":900,"proteinaG":5}]}'
    )
    expect(result.meal).not.toBeNull()
    expect(result.warnings.join(" ")).toContain("óleo puro")
  })

  it("avisa quando as kcal não fecham com 4/4/9", () => {
    const result = first(
      '{"nome":"X","refeicao":"almoco","itens":[{"nome":"Macarrão","qtd":1,"unidade":"concha","kcal":100,"proteinaG":10,"carboG":50,"gorduraG":5}]}'
    )
    expect(result.meal).not.toBeNull()
    expect(result.warnings.join(" ")).toContain("4/4/9")
  })

  it("avisa quando falta carboidrato ou gordura no item", () => {
    const result = first(
      '{"nome":"X","refeicao":"almoco","itens":[{"nome":"Cuscuz","qtd":1,"unidade":"unidade","kcal":170,"proteinaG":3.5}]}'
    )
    expect(result.meal).not.toBeNull()
    expect(result.warnings.join(" ")).toContain("sem carboidrato ou gordura")
    expect(result.warnings.join(" ")).toContain("Cuscuz")
  })

  it("não avisa quando todo item traz os quatro macros", () => {
    const result = first(
      JSON.stringify({
        nome: "Almoço",
        refeicao: "almoco",
        itens: [ARROZ, { ...FRANGO, carboG: 0, gorduraG: 4.3 }],
      })
    )
    expect(result.warnings.join(" ")).not.toContain("sem carboidrato")
  })

  /** Sem `gramas` a checagem de densidade fica desligada em silêncio. */
  it("avisa quando falta a massa em gramas", () => {
    const result = first(
      '{"nome":"X","refeicao":"almoco","itens":[{"nome":"Arroz","qtd":1,"unidade":"concha","kcal":128,"proteinaG":2.5,"carboG":28,"gorduraG":0.2}]}'
    )
    expect(result.meal).not.toBeNull()
    expect(result.warnings.join(" ")).toContain("sem massa em gramas")
    expect(result.warnings.join(" ")).toContain("densidade")
  })

  it("avisa proteína maior que a massa do alimento", () => {
    const result = first(
      '{"nome":"X","refeicao":"almoco","itens":[{"nome":"Whey","qtd":1,"unidade":"scoop","gramas":30,"kcal":120,"proteinaG":300}]}'
    )
    expect(result.warnings.join(" ")).toContain("impossível")
  })
})

describe("parseMealsJson — lote", () => {
  const BANANA =
    '{"nome":"Banana","refeicao":"lanche","hora":"15:10","itens":[{"nome":"Banana prata","qtd":1,"unidade":"unidade","gramas":86,"kcal":80,"proteinaG":1.1}]}'
  const CUSCUZ =
    '{"nome":"Café","refeicao":"cafe","hora":"07:00","itens":[{"nome":"Cuscuz de milho","qtd":1,"unidade":"unidade","gramas":150,"kcal":170,"proteinaG":3.5}]}'

  it("lê uma lista direta", () => {
    const result = parseMealsJson(`[${CUSCUZ},${ALMOCO_JSON},${BANANA}]`)
    expect(result.errors).toEqual([])
    expect(result.entries).toHaveLength(3)
    expect(validEntries(result)).toHaveLength(3)
    expect(result.entries.map((e) => e.meal?.slot)).toEqual(["cafe", "almoco", "lanche"])
  })

  it("aceita o envelope com data comum ao lote", () => {
    const result = parseMealsJson(`{"data":"06/09/2026","refeicoes":[${CUSCUZ},${BANANA}]}`)
    expect(result.errors).toEqual([])
    expect(result.entries.map((e) => e.meal?.date)).toEqual(["2026-09-06", "2026-09-06"])
  })

  it("a data da refeição vence a data do envelope", () => {
    const result = parseMealsJson(
      `{"data":"06/09/2026","refeicoes":[${CUSCUZ},${ALMOCO_JSON}]}`
    )
    expect(result.entries[0].meal?.date).toBe("2026-09-06")
    expect(result.entries[1].meal?.date).toBe("2026-09-07")
  })

  /** Mandar o fim de semana inteiro de uma vez é o caso normal. */
  it("cobre vários dias no mesmo lote", () => {
    const result = parseMealsJson(`[${CUSCUZ},${ALMOCO_JSON}]`)
    expect(result.entries[0].meal?.date).toBeUndefined()
    expect(result.entries[1].meal?.date).toBe("2026-09-07")
  })

  it("uma refeição ilegível não derruba as outras", () => {
    const quebrada = '{"nome":"Ruim","refeicao":"jantar","itens":[{"nome":"X","qtd":1}]}'
    const result = parseMealsJson(`[${CUSCUZ},${quebrada},${BANANA}]`)
    expect(result.errors).toEqual([])
    expect(result.entries).toHaveLength(3)
    expect(result.entries[1].meal).toBeNull()
    expect(result.entries[1].errors.length).toBeGreaterThan(0)
    expect(validEntries(result).map((e) => e.index)).toEqual([0, 2])
  })

  it("recusa lote acima do limite", () => {
    const grande = `[${Array.from({ length: MAX_BATCH_MEALS + 1 }, () => BANANA).join(",")}]`
    const result = parseMealsJson(grande)
    expect(result.entries).toEqual([])
    expect(result.errors[0]).toContain(String(MAX_BATCH_MEALS))
  })

  it("recusa lista vazia", () => {
    expect(parseMealsJson("[]").errors[0]).toContain("vazia")
    expect(parseMealsJson('{"refeicoes":[]}').errors[0]).toContain("vazia")
  })

  it("validEntries devolve vazio sem resultado", () => {
    expect(validEntries(null)).toEqual([])
  })
})

describe("aritmética das refeições", () => {
  it("soma os itens e arredonda", () => {
    expect(mealTotals([ARROZ, FRANGO])).toEqual({
      kcal: 455,
      proteinaG: 42,
      carboG: 56.2,
      gorduraG: 0.4,
      alcoolG: 0,
      itens: 2,
      // FRANGO não traz carbo nem gordura: os dois totais são piso
      itensSemCarbo: 1,
      itensSemGordura: 1,
    })
  })

  /**
   * Sem contar quem faltou, "carbo 56,2 g" pareceria exato quando na verdade
   * ignora o frango inteiro. kcal e proteína não têm o risco: são obrigatórios.
   */
  it("conta os itens sem cada macro em vez de somar zero calado", () => {
    const completo = mealTotals([ARROZ, { ...FRANGO, carboG: 0, gorduraG: 4.3 }])
    expect(completo.itensSemCarbo).toBe(0)
    expect(completo.itensSemGordura).toBe(0)
    expect(completo.gorduraG).toBe(4.7)
    expect(macroCoverageNote(completo)).toBeNull()

    const parcial = mealTotals([ARROZ, FRANGO])
    expect(macroCoverageNote(parcial)).toContain("1 de 2")
    expect(macroCoverageNote(parcial)).toContain("piso")
  })

  it("marca o total como piso na formatação", () => {
    expect(formatMacro(56.2, 0)).toBe("56,2 g")
    expect(formatMacro(56.2, 1)).toBe("≥56,2 g")
  })

  it("propaga a cobertura para o dia inteiro", () => {
    const log: MealLog = {
      date: "2026-09-07",
      completo: true,
      refeicoes: [
        { id: "m1", nome: "Almoço", slot: "almoco", itens: [ARROZ] },
        { id: "m2", nome: "Jantar", slot: "jantar", itens: [FRANGO] },
      ],
    }
    const totals = dayTotals(log)
    expect(totals.itens).toBe(2)
    expect(totals.itensSemCarbo).toBe(1)
    expect(macroCoverageNote(totals)).not.toBeNull()
  })

  it("soma o dia inteiro", () => {
    const log: MealLog = {
      date: "2026-09-07",
      completo: true,
      refeicoes: [
        { id: "m1", nome: "Almoço", slot: "almoco", itens: [ARROZ] },
        { id: "m2", nome: "Jantar", slot: "jantar", itens: [FRANGO] },
      ],
    }
    expect(dayTotals(log).kcal).toBe(455)
    expect(dayTotals(undefined).kcal).toBe(0)
  })

  it("reescala proporcionalmente e não inventa campos ausentes", () => {
    const tresConchas = scaleItem(ARROZ, 3)
    expect(tresConchas.qtd).toBe(3)
    expect(tresConchas.kcal).toBe(386)
    expect(tresConchas.proteinaG).toBe(7.5)
    expect(tresConchas.gramas).toBe(300)

    const doisFiles = scaleItem(FRANGO, 2)
    expect(doisFiles.kcal).toBe(396)
    expect("carboG" in doisFiles).toBe(false)
  })

  it("formata a quantidade em português", () => {
    expect(formatQty(ARROZ)).toBe("2 conchas")
    expect(formatQty(FRANGO)).toBe("1 filé")
    expect(formatQty({ ...ARROZ, qtd: 150, unidade: "g" })).toBe("150 g")
  })
})

describe("álcool", () => {
  /** Cerveja: 146 kcal quase todas de etanol, que não cabe em 4/4/9. */
  const CERVEJA =
    '{"nome":"Cerveja","refeicao":"jantar","itens":[{"nome":"Cerveja pilsen","qtd":1,"unidade":"unidade","gramas":350,"kcal":146,"proteinaG":1.1,"carboG":11.7,"gorduraG":0.0,"alcoolG":13.0}]}'

  it("lê alcoolG e o soma no total", () => {
    const result = first(CERVEJA)
    expect(result.errors).toEqual([])
    expect(result.meal?.itens[0].alcoolG).toBe(13)
    expect(mealTotals(result.meal!.itens).alcoolG).toBe(13)
  })

  it("não acusa incoerência numa bebida alcoólica correta", () => {
    // 4×1.1 + 4×11.7 + 9×0 + 7×13 = 142 kcal contra 146 declaradas
    expect(first(CERVEJA).warnings.join(" ")).not.toContain("4/4/9")
  })

  it("continua acusando quando o álcool não explica o desvio", () => {
    const result = first(
      '{"nome":"X","refeicao":"jantar","itens":[{"nome":"Cerveja","qtd":1,"unidade":"unidade","gramas":350,"kcal":600,"proteinaG":1.1,"carboG":11.7,"gorduraG":0.0,"alcoolG":13.0}]}'
    )
    expect(result.warnings.join(" ")).toContain("4/4/9")
  })

  it("reescala o álcool junto do resto", () => {
    const item: MealItem = {
      nome: "Cerveja",
      qtd: 1,
      unidade: "unidade",
      kcal: 146,
      proteinaG: 1.1,
      alcoolG: 13,
    }
    expect(scaleItem(item, 2).alcoolG).toBe(26)
  })
})

describe("fonte da estimativa", () => {
  it("lê e normaliza a origem", () => {
    expect(
      first(
        '{"nome":"X","refeicao":"almoco","fonte":"Imagem","itens":[{"nome":"Arroz","qtd":1,"unidade":"concha","gramas":100,"kcal":128,"proteinaG":2.5,"carboG":28,"gorduraG":0.2}]}'
      ).meal?.fonte
    ).toBe("foto")
    expect(normalizeSource("rótulo")).toBe("rotulo")
    expect(normalizeSource("chute")).toBeNull()
    expect(sourceLabel("rotulo")).toBe("rótulo")
  })

  it("avisa quando a fonte veio fora da lista", () => {
    const result = first(
      '{"nome":"X","refeicao":"almoco","fonte":"chute","itens":[{"nome":"Arroz","qtd":1,"unidade":"concha","gramas":100,"kcal":128,"proteinaG":2.5,"carboG":28,"gorduraG":0.2}]}'
    )
    expect(result.meal?.fonte).toBeUndefined()
    expect(result.warnings.join(" ")).toContain("não reconhecida")
  })
})

describe("cobertura do registro", () => {
  const day = (date: string, refeicoes: number, completo: boolean): MealLog => ({
    date,
    completo,
    refeicoes: Array.from({ length: refeicoes }, (_, i) => ({
      id: `m${i}`,
      nome: "Refeição",
      slot: "almoco" as const,
      itens: [ARROZ],
    })),
  })

  it("conta dias com registro e dias completos na janela", () => {
    const meals = [
      day("2026-09-07", 2, true),
      day("2026-09-06", 1, false),
      day("2026-09-05", 3, true),
      day("2026-09-04", 0, true), // marcado mas sem refeição: não conta
    ]
    const coverage = loggingCoverage(meals, "2026-09-07")
    expect(coverage.windowDays).toBe(28)
    expect(coverage.comRegistro).toBe(3)
    expect(coverage.completos).toBe(2)
  })

  it("ignora dias fora da janela", () => {
    const coverage = loggingCoverage(
      [day("2026-09-07", 1, true), day("2026-07-01", 1, true)],
      "2026-09-07"
    )
    expect(coverage.comRegistro).toBe(1)
  })

  it("devolve zeros sem nenhum registro", () => {
    expect(loggingCoverage([], "2026-09-07")).toEqual({
      windowDays: 28,
      comRegistro: 0,
      completos: 0,
    })
  })
})

describe("séries dos gráficos", () => {
  const day = (date: string, refeicoes: number, completo: boolean): MealLog => ({
    date,
    completo,
    refeicoes: Array.from({ length: refeicoes }, (_, i) => ({
      id: `m${i}`,
      nome: "Refeição",
      slot: i === 0 ? "almoco" : "jantar",
      itens: [ARROZ],
    })),
  })

  describe("proteinSeries", () => {
    it("preenche a janela inteira, com zero nos dias sem registro", () => {
      const series = proteinSeries([day("2026-09-07", 1, true)], "2026-09-07", 7)
      expect(series).toHaveLength(7)
      expect(series[0].date).toBe("2026-09-01")
      expect(series[0].logged).toBe(false)
      expect(series[0].proteinaG).toBe(0)
      expect(series[6].logged).toBe(true)
      expect(series[6].proteinaG).toBe(5)
      expect(series[6].label).toBe("07/09")
    })

    /** Barra curta por jantar esquecido não é barra curta por ter comido pouco. */
    it("separa dia parcial de dia completo", () => {
      const series = proteinSeries(
        [day("2026-09-07", 1, false), day("2026-09-06", 1, true)],
        "2026-09-07",
        2
      )
      expect(series[0].partial).toBe(false)
      expect(series[1].partial).toBe(true)
    })
  })

  describe("mealCalendar", () => {
    it("classifica os dias em completo, parcial e sem registro", () => {
      const weeks = mealCalendar(
        [day("2026-09-07", 2, true), day("2026-09-06", 1, false)],
        new Date(2026, 8, 7),
        2
      )
      const days = weeks.flatMap((w) => w.days)
      expect(days.find((d) => d.key === "2026-09-07")?.kind).toBe("complete")
      expect(days.find((d) => d.key === "2026-09-06")?.kind).toBe("partial")
      expect(days.find((d) => d.key === "2026-09-05")?.kind).toBe("none")
    })

    it("marca hoje e nao trata dia futuro como falha", () => {
      const weeks = mealCalendar([], new Date(2026, 8, 9), 1)
      const days = weeks[0].days
      expect(days.find((d) => d.key === "2026-09-09")?.isToday).toBe(true)
      expect(days.find((d) => d.key === "2026-09-10")?.isFuture).toBe(true)
      expect(days.find((d) => d.key === "2026-09-08")?.isFuture).toBe(false)
    })
  })

  describe("slotDistribution", () => {
    it("agrupa por refeição e devolve a participação de cada uma", () => {
      const shares = slotDistribution(day("2026-09-07", 3, true))
      expect(shares.map((s) => s.slot)).toEqual(["almoco", "jantar"])
      expect(shares[1].refeicoes).toBe(2)
      expect(Math.round(shares[0].kcalShare * 100)).toBe(33)
      expect(Math.round(shares[1].proteinaShare * 100)).toBe(67)
    })

    it("devolve vazio sem registro", () => {
      expect(slotDistribution(undefined)).toEqual([])
      expect(slotDistribution({ date: "2026-09-07", completo: false, refeicoes: [] })).toEqual([])
    })
  })
})

describe("normalização", () => {
  it("reconhece apelidos de refeição", () => {
    expect(normalizeSlot("Café da manhã")).toBe("cafe")
    expect(normalizeSlot("JANTA")).toBe("jantar")
    expect(normalizeSlot("brunch")).toBeNull()
  })

  it("reconhece unidades no plural e variações", () => {
    expect(normalizeUnit("conchas")).toBe("concha")
    expect(normalizeUnit("colher de sopa")).toBe("colher")
    expect(normalizeUnit("gramas")).toBe("g")
    expect(normalizeUnit("filés")).toBe("filé")
    expect(normalizeUnit("punhado")).toBeNull()
  })

  it("classifica o horário", () => {
    expect(slotFromTime("07:10")).toBe("cafe")
    expect(slotFromTime("12:40")).toBe("almoco")
    expect(slotFromTime("23:10")).toBe("ceia")
    expect(slotFromTime(undefined)).toBeNull()
  })

  it("gera slug estável", () => {
    expect(slugify("Café — cuscuz com ovo")).toBe("cafe-cuscuz-com-ovo")
    expect(slugify("!!!")).toBe("refeicao")
  })
})

describe("alvo de proteína", () => {
  const comBio: BodyLog[] = [
    { date: "2026-09-01", weightKg: 94, fatMassKg: 28.2 },
    { date: "2026-09-05", weightKg: 93.5 },
  ]

  it("usa massa magra quando há bioimpedância", () => {
    const target = proteinTarget(comBio, "2026-09-07")
    expect(target?.basis).toBe("lean")
    expect(target?.referenceKg).toBe(65.8)
    expect(target?.min).toBe(132)
    expect(target?.max).toBe(158)
    expect(proteinPerKg(132, target)).toBe(2.01)
  })

  it("cai para peso corporal sem composição", () => {
    const target = proteinTarget([{ date: "2026-09-01", weightKg: 90 }], "2026-09-07")
    expect(target?.basis).toBe("weight")
    expect(target?.min).toBe(144)
    expect(target?.max).toBe(162)
  })

  it("devolve null sem nenhuma pesagem", () => {
    expect(proteinTarget([], "2026-09-07")).toBeNull()
  })
})

describe("snapshot da refeição registrada", () => {
  const template: MealTemplate = {
    id: "almoco-de-casa",
    nome: "Almoço de casa",
    slot: "almoco",
    ordem: 0,
    itens: [ARROZ, FRANGO],
  }

  it("copia os itens em vez de referenciar o molde", () => {
    const copia = snapshotItems(template.itens)
    copia[0].kcal = 999
    expect(template.itens[0].kcal).toBe(257)
  })

  /**
   * A regra que o usuário pediu: reimportar a refeição fixa pela gem não pode
   * mexer em nada já registrado.
   */
  it("não muda o registro quando o molde muda depois", () => {
    const registrado = templateToMeal(template, template.itens, "12:40")
    template.itens = [{ ...ARROZ, kcal: 1000 }]
    template.nome = "Almoço de casa (corrigido)"

    expect(mealTotals(registrado.itens).kcal).toBe(455)
    expect(registrado.nome).toBe("Almoço de casa")
    expect(registrado.templateId).toBe("almoco-de-casa")
  })
})
