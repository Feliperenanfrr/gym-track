"use client"

import { Dumbbell, HeartPulse, Swords } from "lucide-react"
import { TrainingProgram } from "@/lib/types"
import { cn } from "@/lib/utils"

const PROGRAMS: {
  id: TrainingProgram
  label: string
  detail: string
  icon: typeof Dumbbell
  /** cor do estado ativo — uma por objetivo */
  accent: "gold" | "zone" | "ember"
}[] = [
  {
    id: "performance",
    label: "Performance",
    detail: "pré-temporada",
    icon: Swords,
    accent: "gold",
  },
  {
    id: "engine",
    label: "Motor",
    detail: "VO₂máx e déficit",
    icon: HeartPulse,
    accent: "zone",
  },
  {
    id: "hypertrophy",
    label: "Hipertrofia",
    detail: "base e shape",
    icon: Dumbbell,
    accent: "ember",
  },
]

const ACTIVE_STYLE: Record<"gold" | "zone" | "ember", string> = {
  gold: "border-gold/40 bg-gold/10 text-gold",
  zone: "border-zone/40 bg-zone/10 text-zone",
  ember: "border-ember/30 bg-ember/10 text-ember",
}

export function ProgramTabs({
  value,
  onChange,
  compact = false,
  className,
}: {
  value: TrainingProgram
  onChange: (program: TrainingProgram) => void
  compact?: boolean
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Programa de treino"
      className={cn(
        "grid grid-cols-3 rounded-lg border border-seam bg-iron p-1",
        className
      )}
    >
      {PROGRAMS.map(({ id, label, detail, icon: Icon, accent }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              // Três abas num iPhone de 375 px: o ícone encolhe antes do texto
              // e o texto trunca antes de a aba estourar a linha.
              "flex min-w-0 items-center justify-center rounded-md border border-transparent font-semibold transition-colors",
              compact
                ? "gap-1 px-1.5 py-2 text-[11px] sm:gap-1.5 sm:px-2 sm:text-xs"
                : "gap-1.5 px-1.5 py-2.5 text-xs sm:gap-2 sm:px-3 sm:text-sm",
              active ? ACTIVE_STYLE[accent] : "text-steel-dim hover:text-bone"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Icon size={compact ? 14 : 16} className="shrink-0" />
            <span className="truncate uppercase tracking-wide">{label}</span>
            {!compact && (
              <span className="hidden font-mono text-[10px] font-normal lowercase tracking-normal opacity-70 lg:inline">
                {detail}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
