"use client"

import { cn } from "@/lib/utils"

/**
 * Carga atual contra o próprio recorde, por exercício.
 *
 * A versão anterior era um bar chart em SVG e falhava no essencial: o rótulo
 * mais importante da linha — o nome do exercício — vinha truncado em 13
 * caracteres, e "Tríceps na po…" ao lado de "Cadeira exten…" obriga a decorar
 * a ordem para saber do que a barra fala. Escala, cor e dois números
 * competiam pela atenção sem que nenhum respondesse "e daí?".
 *
 * Aqui é HTML, não gráfico: nome inteiro, quebrando quando precisa. As linhas
 * são agrupadas em três faixas com cabeçalho e contagem, porque a pergunta
 * real ("onde estou longe do que já levantei?") é de classificação, não de
 * comparação fina entre 46% e 55% — e agrupar poupa o olho de varrer doze
 * linhas atrás do limite.
 *
 * Cada linha traz a distância em QUILOS além da porcentagem. Você levanta kg,
 * não razão: "faltam 35 kg" decide a próxima sessão, "46%" não. E a idade do
 * recorde separa o destreino recente do antigo, dado que já era calculado e
 * não aparecia em lugar nenhum.
 */

export interface RelativeLoadDatum {
  name: string
  lastWeight: number
  bestWeight: number
  relativePct: number
  daysSinceBest: number
}

const EMBER = "#ff5a1f"
const GOLD = "#fbbf24"
const ZONE = "#2dd4bf"

interface Band {
  id: string
  label: string
  hint: string
  color: string
  text: string
  /** piso da faixa, em % do recorde */
  min: number
}

const BANDS: Band[] = [
  {
    id: "far",
    label: "Longe do recorde",
    hint: "abaixo de 80% — voltar progressivamente, não trocar de exercício",
    color: EMBER,
    text: "text-ember",
    min: 0,
  },
  {
    id: "near",
    label: "Perto do recorde",
    hint: "80% a 94% — a carga antiga está ao alcance",
    color: GOLD,
    text: "text-gold",
    min: 80,
  },
  {
    id: "at",
    label: "No recorde",
    hint: "95% ou mais — território de PR",
    color: ZONE,
    text: "text-zone",
    min: 95,
  },
]

function bandOf(pct: number): Band {
  if (pct >= 95) return BANDS[2]
  if (pct >= 80) return BANDS[1]
  return BANDS[0]
}

function recency(days: number): string {
  if (days <= 0) return "recorde é de hoje"
  if (days === 1) return "recorde de ontem"
  if (days < 30) return `recorde há ${days} dias`
  const months = Math.round(days / 30)
  return `recorde há ${months} ${months === 1 ? "mês" : "meses"}`
}

function Row({ item, alertPct }: { item: RelativeLoadDatum; alertPct: number }) {
  const band = bandOf(item.relativePct)
  const gap = Math.round((item.bestWeight - item.lastWeight) * 10) / 10
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        {/* nome inteiro: é o rótulo que a versão anterior truncava */}
        <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-bone">
          {item.name}
        </span>
        <span className={cn("score shrink-0 text-lg leading-none", band.text)}>
          {item.relativePct}%
        </span>
      </div>

      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-coal">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, item.relativePct)}%`, background: band.color }}
        />
        {/* marca dos 80%: o limite fica no desenho, não só na legenda */}
        <div
          className="absolute inset-y-0 w-px bg-bone/25"
          style={{ left: `${alertPct}%` }}
          aria-hidden
        />
      </div>

      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-steel-dim">
        <span className="text-steel">
          {fmt(item.lastWeight)} de {fmt(item.bestWeight)} kg
        </span>
        {gap > 0 ? (
          <>
            {" · "}
            <span className={band.text}>faltam {fmt(gap)} kg</span>
          </>
        ) : (
          <>
            {" · "}
            <span className="text-zone">no seu melhor</span>
          </>
        )}
        {" · "}
        {recency(item.daysSinceBest)}
      </p>
    </div>
  )
}

export function RelativeLoadBoard({
  data,
  alertPct = 80,
}: {
  data: RelativeLoadDatum[]
  alertPct?: number
}) {
  const groups = BANDS.map((band) => ({
    band,
    items: data.filter((item) => bandOf(item.relativePct).id === band.id),
  })).filter((group) => group.items.length > 0)

  const far = data.filter((item) => item.relativePct < alertPct).length

  return (
    <div>
      {/* a manchete vira frase, não um selo de 3 palavras no cabeçalho */}
      <p className="mb-3 text-xs leading-relaxed text-steel">
        {far === 0 ? (
          <>
            Nenhum exercício abaixo de {alertPct}% do próprio recorde — todas as cargas
            estão perto do seu melhor.
          </>
        ) : (
          <>
            <span className="font-semibold text-ember">
              {far} de {data.length}
            </span>{" "}
            {far === 1 ? "exercício está" : "exercícios estão"} abaixo de {alertPct}% da
            melhor carga dos últimos 6 meses.
          </>
        )}
      </p>

      <div className="space-y-4">
        {groups.map(({ band, items }) => (
          <section key={band.id}>
            <div className="flex items-baseline gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ background: band.color }}
                aria-hidden
              />
              <h3
                className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", band.text)}
                style={{ fontFamily: "var(--font-condensed)" }}
              >
                {band.label}
              </h3>
              <span className="font-mono text-[10px] text-steel-dim">{items.length}</span>
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-steel-dim">{band.hint}</p>

            <div className="mt-1 divide-y divide-seam">
              {items.map((item) => (
                <Row key={item.name} item={item} alertPct={alertPct} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
