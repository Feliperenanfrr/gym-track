"use client"

import { Dumbbell, Trophy } from "lucide-react"
import { TrainingProgram } from "@/lib/types"
import { cn } from "@/lib/utils"

const PROGRAMS: {
  id: TrainingProgram
  label: string
  detail: string
  icon: typeof Trophy
}[] = [
  {
    id: "competition",
    label: "Competição",
    detail: "até 15/08",
    icon: Trophy,
  },
  {
    id: "hypertrophy",
    label: "Hipertrofia",
    detail: "plano atual",
    icon: Dumbbell,
  },
]

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
        "grid grid-cols-2 rounded-lg border border-seam bg-iron p-1",
        className
      )}
    >
      {PROGRAMS.map(({ id, label, detail, icon: Icon }) => {
        const active = value === id
        const competition = id === "competition"
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center justify-center rounded-md border border-transparent font-semibold transition-colors",
              compact ? "gap-1.5 px-2 py-2 text-xs" : "gap-2 px-3 py-2.5 text-sm",
              active && competition && "border-gold/30 bg-gold/10 text-gold",
              active && !competition && "border-ember/30 bg-ember/10 text-ember",
              !active && "text-steel-dim hover:text-bone"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Icon size={compact ? 14 : 16} />
            <span className="uppercase tracking-wider">{label}</span>
            {!compact && (
              <span className="hidden font-mono text-[9px] font-normal lowercase tracking-normal opacity-70 sm:inline">
                {detail}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

