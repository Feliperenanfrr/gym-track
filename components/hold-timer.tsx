"use client"

import { Square, X } from "lucide-react"
import { formatClock } from "@/lib/rest"
import { HoldTimerApi } from "@/lib/use-hold-timer"
import { cn } from "@/lib/utils"

/**
 * Painel do cronômetro de isometria. Mesmo lugar do timer de descanso (os
 * dois nunca aparecem juntos), mas com números grandes: o celular está no
 * chão e você está em prancha, olhando de cima.
 */
export function HoldTimer({ timer }: { timer: HoldTimerApi }) {
  if (!timer.active || !timer.phase) return null

  const prep = timer.phase === "prep"
  const target = timer.active.seconds
  const pct = prep || target <= 0 ? 0 : Math.min(100, (timer.held / target) * 100)

  return (
    <div
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: "calc(128px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md md:max-w-2xl">
        <div
          role="timer"
          aria-label={`Isometria · ${timer.active.label}`}
          className={cn(
            "overflow-hidden rounded-xl border bg-iron-2/95 shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur",
            prep ? "border-gold/60" : "border-ember"
          )}
        >
          <div className="h-1.5 w-full bg-coal">
            <div
              className="h-full bg-ember transition-[width] duration-200 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="px-3 pb-3 pt-2.5">
            <div className="flex items-start justify-between gap-2">
              <p
                className={cn(
                  "min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.2em]",
                  prep ? "text-gold" : "text-steel-dim"
                )}
                style={{ fontFamily: "var(--font-condensed)" }}
              >
                {prep ? "Prepare-se" : "Segure"} · {timer.active.label}
              </p>
              <button
                onClick={timer.cancel}
                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-steel-dim transition-colors hover:text-bone active:scale-95"
                aria-label="Cancelar sem registrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-end justify-between gap-3">
              <p
                className={cn(
                  "score text-6xl leading-none tabular-nums",
                  prep ? "text-gold" : "text-bone"
                )}
              >
                {prep ? timer.remaining : formatClock(timer.remaining)}
              </p>
              <p className="pb-1 text-right font-mono text-[11px] leading-tight text-steel-dim">
                {prep ? (
                  <>começa em {timer.remaining} s</>
                ) : (
                  <>
                    <span className="text-bone">{timer.held} s</span> de {target} s
                    <br />
                    fecha sozinho no fim
                  </>
                )}
              </p>
            </div>

            <button
              onClick={timer.stop}
              className={cn(
                "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-[0.15em] transition-colors active:scale-[0.99]",
                prep
                  ? "border border-seam text-steel hover:text-bone"
                  : "bg-ember text-coal hover:bg-ember-hot"
              )}
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {prep ? (
                "Desistir"
              ) : (
                <>
                  <Square size={14} fill="currentColor" /> Parar · registrar {timer.held} s
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
