"use client"

import { useEffect, useRef, useState } from "react"

/** Altura útil de uma folha A4 com as margens da @page (297 − 2×14 mm). */
const A4_CONTENT_PX = (269 / 25.4) * 96

/**
 * Preview de documento: a folha tem largura fixa de A4 útil e é REDUZIDA por
 * transform quando a tela é menor, em vez de reflowar. O que aparece no
 * celular é então o próprio PDF em miniatura — nada muda de lugar entre o que
 * se vê e o que sai impresso. Em impressão a escala é desligada pelo CSS.
 *
 * A miniatura tem um custo: a 390 px a folha cabe a ~52%, e o corpo de 10,5 px
 * vira 5,5 px. Por isso o preview informa quantas páginas o PDF terá — é o que
 * dá para saber sem conseguir ler.
 */
export function SheetPreview({
  children,
  onPages,
}: {
  children: React.ReactNode
  /** páginas estimadas da folha — o preview é uma tira só, o PDF não */
  onPages?: (pages: number) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const fit = () => {
      if (!frame.current || !sheet.current) return
      const available = frame.current.clientWidth
      const natural = sheet.current.offsetWidth
      if (!available || !natural) return
      const next = Math.min(1, available / natural)
      setScale(next)
      setHeight(sheet.current.offsetHeight * next)
      onPages?.(Math.max(1, Math.ceil(sheet.current.offsetHeight / A4_CONTENT_PX)))
    }
    fit()
    const observer = new ResizeObserver(fit)
    if (frame.current) observer.observe(frame.current)
    if (sheet.current) observer.observe(sheet.current)
    return () => observer.disconnect()
  }, [children, onPages])

  return (
    <div ref={frame} className="report-preview-frame" style={{ height }}>
      <div
        ref={sheet}
        className="report-preview"
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}

export function Sheet({ children }: { children: React.ReactNode }) {
  return <article className="report-sheet">{children}</article>
}

export function ReportHead({
  title,
  period,
  extra,
}: {
  title: string
  period: string
  extra?: string
}) {
  const generated = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  return (
    <header className="report-head">
      <div>
        <p className="report-wordmark">GYM//TRACK</p>
        <h1>{title}</h1>
      </div>
      <p className="report-meta">
        {period}
        <br />
        {extra && (
          <>
            {extra}
            <br />
          </>
        )}
        emitido em {generated}
      </p>
    </header>
  )
}

export function Section({
  title,
  aside,
  children,
  breakBefore,
}: {
  title: string
  aside?: string
  children: React.ReactNode
  breakBefore?: boolean
}) {
  return (
    <section className={`report-section${breakBefore ? " report-page-break" : ""}`}>
      <h2>
        {title}
        {aside && <span>{aside}</span>}
      </h2>
      {children}
    </section>
  )
}

export function Kpis({
  items,
}: {
  items: { label: string; value: string; unit?: string }[]
}) {
  return (
    <dl className="report-kpis">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.value}
            {item.unit && <small>{item.unit}</small>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Casas decimais FIXAS para números que se leem em coluna. O
 * `toLocaleString` corta o zero à direita e produzia "−0,36 / −0,3 / −0,06"
 * numa mesma coluna — num documento que vai para outra pessoa, isso lê como
 * descuido. Vale para célula de tabela; eixo de gráfico continua enxuto.
 */
export function fixed(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace(".", ",")
}

/** Classe do delta pela direção DESEJADA da métrica, não pelo sinal. */
export function deltaClass(
  delta: number | null,
  goal: "up" | "down" | "neutral"
): string {
  if (delta === null || Math.abs(delta) < 0.001 || goal === "neutral") return "flat"
  const good = goal === "up" ? delta > 0 : delta < 0
  return good ? "up" : "down"
}

export function formatDelta(delta: number | null, decimals = 1): string {
  if (delta === null) return "—"
  if (Math.abs(delta) < 0.001) return "0"
  const value = Math.abs(delta).toFixed(decimals).replace(".", ",")
  return `${delta > 0 ? "+" : "−"}${value}`
}

export function Findings({
  highlights,
  gaps,
}: {
  highlights: string[]
  gaps: string[]
}) {
  return (
    <div className="report-findings">
      <div className="good">
        <h3>O que progrediu</h3>
        {highlights.length > 0 ? (
          <ul>
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="report-note">Nada com variação relevante no período.</p>
        )}
      </div>
      <div className="warn">
        <h3>O que ficou para trás</h3>
        {gaps.length > 0 ? (
          <ul>
            {gaps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="report-note">Nenhum ponto de atenção detectado.</p>
        )}
      </div>
    </div>
  )
}
