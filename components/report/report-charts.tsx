/**
 * Kit de gráficos dos relatórios impressos.
 *
 * SVG escrito à mão, e não recharts, por três motivos: em impressão o
 * ResponsiveContainer mede o container antes do navegador refazer o layout da
 * página e sai com largura errada; tooltip e animação não têm o que fazer num
 * PDF; e o texto precisa de tamanho nativo, sem escala herdada de viewBox.
 *
 * Paleta validada contra papel branco (banda de luminosidade, piso de croma,
 * separação CVD em todos os pares e contraste ≥ 3:1).
 */

export const PRINT = {
  lift: "#c2410c",
  cardio: "#0e7fa0",
  fat: "#7c3aed",
  lean: "#65a30d",
  ink: "#1c1917",
  muted: "#57534e",
  label: "#78716c",
  rule: "#d6d3d1",
  grid: "#ececea",
} as const

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace"

/**
 * Escala com passo redondo.
 *
 * Arredondar só o TOPO deixava as barras ocupando 40% da altura (um pico de
 * 21 t num eixo até 50 t) e produzia rótulos como "17t" e "33t", que são o
 * topo dividido por três. Escolher primeiro o passo — 1, 2, 2,5, 5 ou 10 vezes
 * a potência de dez — dá marcas legíveis e um topo justo ao dado.
 */
function niceScale(dataMax: number, targetTicks = 3): { max: number; ticks: number[] } {
  if (dataMax <= 0) return { max: 1, ticks: [0, 1] }
  const raw = dataMax / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) *
    magnitude
  const max = Math.ceil(dataMax / step) * step
  return {
    max,
    ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step),
  }
}

export interface ColumnDatum {
  label: string
  a: number
  b?: number
}

/**
 * Colunas empilhadas (até duas séries). A altura é o total e os segmentos são
 * a composição — mesma leitura do painel, em tinta.
 */
export function ReportColumns({
  data,
  series,
  width = 688,
  height = 150,
  format = (v: number) => String(Math.round(v)),
}: {
  data: ColumnDatum[]
  series: { label: string; color: string }[]
  width?: number
  height?: number
  format?: (value: number) => string
}) {
  const padLeft = 42
  const padRight = 6
  const padTop = 10
  const padBottom = 18
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const { max, ticks: yTicks } = niceScale(
    Math.max(1, ...data.map((d) => d.a + (d.b ?? 0)))
  )
  const band = plotW / Math.max(1, data.length)
  const barW = Math.min(34, band * 0.62)
  const y = (value: number) => padTop + plotH - (value / max) * plotH
  // rótulos do eixo X só quando cabem: 34px por rótulo de 5 caracteres
  const labelStep = Math.max(1, Math.ceil((data.length * 34) / plotW))

  return (
    <svg width={width} height={height} role="img" aria-hidden>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={y(tick)}
            y2={y(tick)}
            stroke={PRINT.grid}
            strokeWidth={1}
          />
          <text
            x={padLeft - 6}
            y={y(tick) + 3}
            textAnchor="end"
            fontFamily={MONO}
            fontSize={8}
            fill={PRINT.label}
          >
            {format(tick)}
          </text>
        </g>
      ))}
      {data.map((datum, index) => {
        const cx = padLeft + band * index + band / 2
        const x = cx - barW / 2
        const aH = (datum.a / max) * plotH
        const bH = ((datum.b ?? 0) / max) * plotH
        return (
          <g key={datum.label + index}>
            {aH > 0 && (
              <rect
                x={x}
                y={y(datum.a)}
                width={barW}
                height={aH}
                fill={series[0].color}
              />
            )}
            {bH > 0 && (
              /* respiro de 2px entre os segmentos, no lugar de contorno */
              <rect
                x={x}
                y={y(datum.a + (datum.b ?? 0))}
                width={barW}
                height={Math.max(0, bH - 2)}
                fill={series[1]?.color ?? series[0].color}
              />
            )}
            {index % labelStep === 0 && (
              <text
                x={cx}
                y={height - 5}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={8}
                fill={PRINT.label}
              >
                {datum.label}
              </text>
            )}
          </g>
        )
      })}
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={padTop + plotH}
        y2={padTop + plotH}
        stroke={PRINT.rule}
        strokeWidth={1}
      />
    </svg>
  )
}

export interface SparkPoint {
  label: string
  value: number
}

/**
 * Painel pequeno de uma métrica no tempo, com escala PRÓPRIA e ampliada.
 *
 * Peso (~90 kg), gordura (~27) e magra (~63) num eixo só esconderiam a
 * variação de 1–2 kg que é justamente o assunto. Três painéis lado a lado —
 * small multiples — mantêm cada mudança legível; o eixo truncado vem dito com
 * todas as letras nos extremos rotulados.
 */
export function ReportSpark({
  points,
  color,
  title,
  unit,
  width = 210,
  height = 96,
  decimals = 1,
}: {
  points: SparkPoint[]
  color: string
  title: string
  unit: string
  width?: number
  height?: number
  decimals?: number
}) {
  const padTop = 16
  const padBottom = 16
  const padLeft = 4
  const padRight = 4
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  if (points.length === 0) {
    return (
      <svg width={width} height={height} role="img" aria-hidden>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontFamily={MONO} fontSize={9} fill={PRINT.label}>
          sem dados
        </text>
      </svg>
    )
  }

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const lo = min - span * 0.25
  const hi = max + span * 0.25
  const x = (index: number) =>
    padLeft + (points.length === 1 ? plotW / 2 : (plotW * index) / (points.length - 1))
  const y = (value: number) => padTop + plotH - ((value - lo) / (hi - lo)) * plotH
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ")
  const first = points[0]
  const last = points[points.length - 1]
  const fmt = (v: number) => v.toFixed(decimals).replace(".", ",")

  return (
    <svg width={width} height={height} role="img" aria-hidden>
      <text x={0} y={8} fontFamily={MONO} fontSize={8} fill={PRINT.label}>
        {title.toUpperCase()}
      </text>
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.label + i} cx={x(i)} cy={y(p.value)} r={1.6} fill={color} />
      ))}
      <text x={0} y={height - 4} fontFamily={MONO} fontSize={8.5} fill={PRINT.muted}>
        {fmt(first.value)}
      </text>
      <text
        x={width}
        y={height - 4}
        textAnchor="end"
        fontFamily={MONO}
        fontSize={8.5}
        fill={PRINT.ink}
        fontWeight={600}
      >
        {fmt(last.value)} {unit}
      </text>
    </svg>
  )
}

/**
 * Barras horizontais para categorias de nome longo (grupos musculares), com
 * linha de referência opcional. Uma cor só: a ordem já está no comprimento, e
 * pintar cada barra de um tom seria gastar o único canal livre com informação
 * que a barra já dá.
 */
export function ReportHBars({
  rows,
  color,
  reference,
  referenceLabel,
  width = 688,
  rowHeight = 17,
  labelWidth = 118,
  max: fixedMax,
  format = (v: number) => v.toLocaleString("pt-BR"),
}: {
  rows: { label: string; value: number }[]
  /** cor única ou uma cor por linha (faixa de alerta, por exemplo) */
  color: string | ((row: { label: string; value: number }) => string)
  reference?: number
  referenceLabel?: string
  width?: number
  rowHeight?: number
  /** faixa reservada ao nome — nomes longos invadiam a primeira barra */
  labelWidth?: number
  /** teto do eixo quando a escala é conhecida (0–100%, por exemplo) */
  max?: number
  format?: (value: number) => string
}) {
  const labelW = labelWidth
  const valueW = 42
  const padTop = reference !== undefined ? 16 : 2
  // 0,58 em de largura média por caractere no mono: corta antes de encostar
  const maxChars = Math.floor(labelW / (8.5 * 0.58)) - 1
  const trim = (label: string) =>
    label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label
  const plotW = width - labelW - valueW
  // 15% de folga acima do maior valor: sem isso, quando a referência É o topo
  // do dado, o tracejado cai exatamente na borda e some como se fosse moldura
  const { max: scaled } = niceScale(
    Math.max(1, ...rows.map((r) => r.value), reference ?? 0) * 1.15
  )
  const max = fixedMax ?? scaled
  const height = padTop + rows.length * rowHeight + 2
  const refX = reference !== undefined ? labelW + (reference / max) * plotW : null

  return (
    <svg width={width} height={height} role="img" aria-hidden>
      {refX !== null && (
        <>
          <line
            x1={refX}
            x2={refX}
            y1={padTop - 8}
            y2={height - 2}
            stroke={PRINT.label}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={refX + 3} y={padTop - 7} fontFamily={MONO} fontSize={8} fill={PRINT.label}>
            {referenceLabel}
          </text>
        </>
      )}
      {rows.map((row, index) => {
        const y = padTop + index * rowHeight
        const barH = rowHeight - 6
        return (
          <g key={row.label}>
            <text
              x={0}
              y={y + barH - 1}
              fontFamily={MONO}
              fontSize={8.5}
              fill={PRINT.muted}
            >
              {trim(row.label)}
            </text>
            <rect
              x={labelW}
              y={y}
              width={Math.max(1, (Math.min(row.value, max) / max) * plotW)}
              height={barH}
              fill={typeof color === "function" ? color(row) : color}
              rx={1}
            />
            <text
              x={width}
              y={y + barH - 1}
              textAnchor="end"
              fontFamily={MONO}
              fontSize={8.5}
              fill={PRINT.ink}
            >
              {format(row.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Saldo energético semanal em barras divergentes: zero é manutenção, acima o
 * corpo guardou energia, abaixo liberou.
 */
export function ReportDivergingColumns({
  data,
  width = 688,
  height = 140,
}: {
  data: { label: string; value: number | null }[]
  width?: number
  height?: number
}) {
  const padLeft = 42
  const padRight = 6
  const padTop = 10
  const padBottom = 18
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const values = data.map((d) => d.value).filter((v): v is number => v !== null)
  const { max: bound } = niceScale(Math.max(200, ...values.map((v) => Math.abs(v))), 2)
  const band = plotW / Math.max(1, data.length)
  const barW = Math.min(30, band * 0.6)
  const y = (value: number) => padTop + plotH / 2 - (value / bound) * (plotH / 2)
  const labelStep = Math.max(1, Math.ceil((data.length * 34) / plotW))

  return (
    <svg width={width} height={height} role="img" aria-hidden>
      {[bound, 0, -bound].map((tick) => (
        <g key={tick}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? PRINT.rule : PRINT.grid}
            strokeWidth={1}
          />
          <text
            x={padLeft - 6}
            y={y(tick) + 3}
            textAnchor="end"
            fontFamily={MONO}
            fontSize={8}
            fill={PRINT.label}
          >
            {tick > 0 ? `+${tick}` : tick}
          </text>
        </g>
      ))}
      {data.map((datum, index) => {
        const cx = padLeft + band * index + band / 2
        if (datum.value === null) return null
        const top = datum.value >= 0 ? y(datum.value) : y(0)
        const barH = Math.abs(y(datum.value) - y(0))
        return (
          <g key={datum.label + index}>
            <rect
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={Math.max(1, barH)}
              fill={datum.value >= 0 ? PRINT.lift : PRINT.cardio}
              rx={1}
            />
            {index % labelStep === 0 && (
              <text
                x={cx}
                y={height - 5}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={8}
                fill={PRINT.label}
              >
                {datum.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Legenda compartilhada: identidade nunca fica só na cor. */
export function ReportLegend({
  items,
}: {
  items: { label: string; color: string; value?: string }[]
}) {
  return (
    <div className="report-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
          {item.value !== undefined && <b>{item.value}</b>}
        </span>
      ))}
    </div>
  )
}

/**
 * Fita de calendário do período: uma coluna por semana, sete quadrados por
 * coluna.
 *
 * As barras semanais dizem quanto foi feito em cada semana; só a fita diz
 * ONDE ficou o buraco. Duas semanas apagadas no meio de agosto se leem antes
 * de qualquer número da tabela, e é isso que muda a leitura de quem recebe o
 * documento.
 */
export function ReportCalendarStrip({
  weeks,
  cell = 13,
  gap = 3,
}: {
  weeks: { key: string; kind: "none" | "lift" | "cardio" | "both"; outside: boolean }[][]
  cell?: number
  gap?: number
}) {
  const labelW = 16
  const width = labelW + weeks.length * (cell + gap)
  const height = 7 * (cell + gap) + 2
  const fill = (kind: string, outside: boolean) => {
    if (outside) return "#fff"
    if (kind === "both") return PRINT.ink
    if (kind === "lift") return PRINT.lift
    if (kind === "cardio") return PRINT.cardio
    return "#ececea"
  }

  return (
    <svg width={width} height={height} role="img" aria-hidden>
      {["S", "T", "Q", "Q", "S", "S", "D"].map((label, row) => (
        <text
          key={`${label}-${row}`}
          x={0}
          y={row * (cell + gap) + cell - 2}
          fontFamily={MONO}
          fontSize={7}
          fill={PRINT.label}
        >
          {label}
        </text>
      ))}
      {weeks.map((days, column) =>
        days.map((day, row) => (
          <rect
            key={day.key}
            x={labelW + column * (cell + gap)}
            y={row * (cell + gap)}
            width={cell}
            height={cell}
            rx={1.5}
            fill={fill(day.kind, day.outside)}
            stroke={day.outside ? "#f4f3f1" : "none"}
            strokeWidth={day.outside ? 1 : 0}
          />
        ))
      )}
    </svg>
  )
}

/**
 * Barra de uma faixa de referência: onde o valor cai entre "desejável" e
 * "muito acima". Num documento de saúde o número sozinho não informa —
 * "cintura 102 cm" só vira leitura ao lado do corte de 94 e de 102.
 */
export function ReportRangeBar({
  value,
  min,
  max,
  elevated,
  high,
  width = 150,
  height = 26,
  format = (v: number) => v.toLocaleString("pt-BR"),
}: {
  value: number | null
  min: number
  max: number
  elevated: number
  high: number
  width?: number
  height?: number
  format?: (value: number) => string
}) {
  const trackY = 8
  const trackH = 6
  const span = Math.max(1, max - min)
  const x = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * width
  const marker = value === null ? null : x(value)

  return (
    <svg width={width} height={height} role="img" aria-hidden>
      <rect x={0} y={trackY} width={x(elevated)} height={trackH} fill="#dcfce7" />
      <rect
        x={x(elevated)}
        y={trackY}
        width={x(high) - x(elevated)}
        height={trackH}
        fill="#fef3c7"
      />
      <rect x={x(high)} y={trackY} width={width - x(high)} height={trackH} fill="#fee2e2" />
      {marker !== null && (
        <>
          <rect x={Math.max(0, marker - 1)} y={trackY - 4} width={2} height={trackH + 8} fill={PRINT.ink} />
          <text
            x={Math.min(width - 10, Math.max(12, marker))}
            y={height - 2}
            textAnchor="middle"
            fontFamily={MONO}
            fontSize={7.5}
            fill={PRINT.ink}
          >
            {format(value!)}
          </text>
        </>
      )}
    </svg>
  )
}
