"use client"

import { Minus, Pause, Play, Plus, X } from "lucide-react"
import { formatClock } from "@/lib/rest"
import { RestTimerApi } from "@/lib/use-rest-timer"
import { cn } from "@/lib/utils"

export function RestTimer({ timer }: { timer: RestTimerApi }) {
  if (!timer.active) return null

  const done = timer.remaining <= 0
  const pct = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0

  return (
    <div
      className="fixed inset-x-0 z-40 px-4"
      style={{ bottom: "calc(128px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md md:max-w-2xl">
        <div
          className={cn(
            "overflow-hidden rounded-xl border bg-iron-2/95 shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur",
            done ? "border-zone" : "border-ember/40"
          )}
        >
          {/* barra de progresso no topo */}
          <div className="h-1 w-full bg-coal">
            <div
              className={cn(
                "h-full transition-[width] duration-300 ease-linear",
                done ? "bg-zone" : "bg-ember"
              )}
              style={{ width: `${done ? 100 : pct}%` }}
            />
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-steel-dim"
                style={{ fontFamily: "var(--font-condensed)" }}
              >
                {done ? "Descanso concluído" : `Descanso · ${timer.label}`}
              </p>
              <p
                className={cn(
                  "score text-2xl leading-none",
                  done ? "text-zone" : "text-bone"
                )}
              >
                {formatClock(timer.remaining)}
              </p>
            </div>

            {!done && (
              <>
                <button
                  onClick={() => timer.addTime(-15)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-seam text-steel transition-colors hover:text-bone active:scale-95"
                  aria-label="Tirar 15 segundos"
                >
                  <Minus size={16} />
                </button>
                <button
                  onClick={timer.toggle}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-ember text-coal transition-colors hover:bg-ember-hot active:scale-95"
                  aria-label={timer.running ? "Pausar" : "Retomar"}
                >
                  {timer.running ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={() => timer.addTime(15)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-seam text-steel transition-colors hover:text-bone active:scale-95"
                  aria-label="Adicionar 15 segundos"
                >
                  <Plus size={16} />
                </button>
              </>
            )}

            <button
              onClick={timer.dismiss}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border border-seam transition-colors active:scale-95",
                done ? "text-zone hover:text-bone" : "text-steel-dim hover:text-steel"
              )}
              aria-label="Fechar timer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
