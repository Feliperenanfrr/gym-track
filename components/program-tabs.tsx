"use client"

import { Dumbbell, HeartPulse } from "lucide-react"
import { TrainingProgram } from "@/lib/types"
import { cn } from "@/lib/utils"

const PROGRAMS: {
  id: TrainingProgram
  label: string
  detail: string
  icon: typeof Dumbbell
}[] = [
  {
    id: "engine",
    label: "Motor",
    detail: "VO₂máx e déficit",
    icon: HeartPulse,
  },
  {
    id: "hypertrophy",
    label: "Hipertrofia",
    detail: "base e shape",
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
        const engine = id === "engine"
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
              active && engine && "border-zone/40 bg-zone/10 text-zone",
              active && !engine && "border-ember/30 bg-ember/10 text-ember",
              !active && "text-steel-dim hover:text-bone"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Icon size={compact ? 14 : 16} />
            <span className="uppercase tracking-wider">{label}</span>
            {!compact && (
              <span className="hidden font-mono text-[10px] font-normal lowercase tracking-normal opacity-70 sm:inline">
                {detail}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
