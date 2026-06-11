import { cn } from "@/lib/utils"

/** Cabeçalho de página com marca e faixa industrial */
export function PageHeader({
  kicker,
  title,
  right,
}: {
  kicker: string
  title: string
  right?: React.ReactNode
}) {
  return (
    <header className="rise mb-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className="mb-1 text-[11px] font-semibold tracking-[0.35em] text-ember"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {kicker}
          </p>
          <h1 className="stencil text-4xl text-bone md:text-5xl">{title}</h1>
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
