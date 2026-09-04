"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/** Cabeçalho de página com marca e faixa industrial */
export function PageHeader({
  kicker,
  title,
  left,
  right,
}: {
  kicker: string
  title: string
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <header className="rise mb-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          {left}
          <div>
            <p
              className="mb-1 text-[11px] font-semibold tracking-[0.35em] text-ember"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {kicker}
            </p>
            <h1 className="stencil text-4xl text-bone md:text-5xl">{title}</h1>
          </div>
        </div>
        {right}
      </div>
      <div className="hazard mt-3 h-1 w-24" />
    </header>
  )
}

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-seam bg-iron p-4 shadow-[0_2px_18px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  accent = "ember",
}: {
  children: React.ReactNode
  accent?: "ember" | "zone" | "steel"
}) {
  const color =
    accent === "zone" ? "text-zone" : accent === "steel" ? "text-steel" : "text-ember"
  return (
    <h2
      className={cn(
        "mb-3 mt-7 text-xs font-semibold uppercase tracking-[0.3em]",
        color
      )}
      style={{ fontFamily: "var(--font-condensed)" }}
    >
      {children}
    </h2>
  )
}

/**
 * Seção recolhível para encurtar telas longas: o cabeçalho substitui o
 * SectionTitle e o conteúdo só monta quando aberto (menos peso no scroll).
 * Estado local por visita — sem persistência de propósito.
 */
export function CollapsibleSection({
  title,
  accent = "ember",
  badge,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode
  accent?: "ember" | "zone" | "steel" | "gold"
  /** contador/etiqueta à direita do título (ex.: "3/16") */
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const color =
    accent === "zone"
      ? "text-zone"
      : accent === "gold"
        ? "text-gold"
        : accent === "steel"
          ? "text-steel"
          : "text-ember"
  return (
    <section className="mt-7">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.3em] transition-colors hover:text-bone"
        style={{ fontFamily: "var(--font-condensed)" }}
      >
        <span className={color}>{title}</span>
        {badge != null && (
          <span className="rounded border border-seam bg-iron px-1.5 py-0.5 font-mono text-[10px] tracking-normal text-steel">
            {badge}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            "ml-auto shrink-0 text-steel-dim transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && children}
    </section>
  )
}

/**
 * Etiqueta de bloco de controle — o rótulo de 10px em versalete que já
 * aparecia escrito à mão em três lugares da página de relatórios.
 */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel"
      style={{ fontFamily: "var(--font-condensed)" }}
    >
      {children}
    </p>
  )
}

/**
 * Chip de seleção. Ativo é ember em todo o app — bottom-nav, chips do
 * histórico, botões primários; gold significa atenção (prontidão amarela,
 * avisos, a série "peso"). A página de relatórios usava gold para "escolhido"
 * e dizia outra coisa sem querer.
 */
export function Chip({
  active,
  onClick,
  children,
  className,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
        active
          ? "border-ember bg-ember/10 text-ember"
          : "border-seam text-steel hover:border-steel-dim hover:text-bone",
        className
      )}
      style={{ fontFamily: "var(--font-condensed)" }}
    >
      {children}
    </button>
  )
}

export function StatCard({
  label,
  value,
  detail,
  accent = "ember",
  className,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  accent?: "ember" | "zone" | "steel" | "gold"
  className?: string
}) {
  const valueColor =
    accent === "zone"
      ? "text-zone"
      : accent === "gold"
        ? "text-gold"
        : accent === "steel"
          ? "text-bone"
          : "text-ember-hot"
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.25em] text-steel"
        style={{ fontFamily: "var(--font-condensed)" }}
      >
        {label}
      </span>
      <span className={cn("score text-3xl", valueColor)}>{value}</span>
      {detail ? <span className="text-xs text-steel">{detail}</span> : null}
    </Card>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-iron-2/50", className)} />
  )
}
