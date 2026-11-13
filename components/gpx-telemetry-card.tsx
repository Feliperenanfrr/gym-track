import { AlertTriangle, Award, Flame, Footprints, Timer } from "lucide-react"
import { GpxTelemetry } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatSecClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
  return `${m}:${String(r).padStart(2, "0")}`
}

function formatPaceSec(secPerKm: number): string {
  const s = Math.max(0, Math.round(secPerKm))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function GpxTelemetryCard({
  gpx,
  compact = false,
  className,
}: {
  gpx: GpxTelemetry
  compact?: boolean
  className?: string
}) {
  const pausedSeconds = Math.max(0, gpx.elapsedSeconds - gpx.movingSeconds)
  const maxPace = gpx.splits.reduce((m, s) => Math.max(m, s.secPerKm), 1)
  const minPace = gpx.splits.reduce((m, s) => Math.min(m, s.secPerKm), maxPace)
  const fastAlert = (gpx.runWalk?.fastTroteMinutes ?? 0) >= 3

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-md border border-zone/25 bg-coal/70 p-2.5 text-xs",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
        <span className="inline-flex items-center gap-1 text-zone">
          <Timer size={11} />
          Mov. {formatSecClock(gpx.movingSeconds)} · Decorrido{" "}
          {formatSecClock(gpx.elapsedSeconds)}
          {pausedSeconds >= 10 ? ` (${formatSecClock(pausedSeconds)} parado)` : ""}
        </span>
        {gpx.splitTrend && (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 uppercase",
              gpx.splitTrend === "negative"
                ? "border-zone/40 bg-zone/10 text-zone"
                : gpx.splitTrend === "positive"
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-seam text-steel-dim"
            )}
          >
            {gpx.splitTrend === "negative"
              ? "split negativo"
              : gpx.splitTrend === "positive"
                ? "desacelerou no fim"
                : "ritmo constante"}
          </span>
        )}
      </div>

      {gpx.runWalk && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-[10px] text-steel">
            <span className="inline-flex items-center gap-1">
              <Footprints size={11} className="text-zone" />
              Trote {gpx.runWalk.troteMinutes}′ ({gpx.runWalk.trotePct}%) · Caminhada{" "}
              {gpx.runWalk.walkMinutes}′
            </span>
            <span>
              {gpx.runWalk.troteBouts} bloco{gpx.runWalk.troteBouts === 1 ? "" : "s"}
              {gpx.runWalk.longestTroteSec > 0
                ? ` · máx ${formatSecClock(gpx.runWalk.longestTroteSec)}`
                : ""}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-iron-2">
            <div
              className="bg-zone transition-all"
              style={{ width: `${Math.min(100, Math.max(0, gpx.runWalk.trotePct))}%` }}
            />
          </div>
          {fastAlert && (
            <p className="flex items-start gap-1.5 rounded border border-gold/30 bg-gold/5 px-2 py-1.5 text-[11px] leading-snug text-gold">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                {gpx.runWalk.fastTroteMinutes} min de trote mais rápido que 7:30/km — segure
                para 7:30–8:30/km para poupar sola e canela.
              </span>
            </p>
          )}
        </div>
      )}

      {gpx.bestWindowsSec && (
        <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
          {gpx.bestWindowsSec.km1 !== undefined && (
            <span className="inline-flex items-center gap-1 rounded border border-seam bg-iron px-2 py-0.5 text-steel">
              <Flame size={10} className="text-ember" /> 1 km: {formatSecClock(gpx.bestWindowsSec.km1)}
            </span>
          )}
          {gpx.bestWindowsSec.mi1 !== undefined && (
            <span className="inline-flex items-center gap-1 rounded border border-seam bg-iron px-2 py-0.5 text-steel">
              1 mi: {formatSecClock(gpx.bestWindowsSec.mi1)}
            </span>
          )}
          {gpx.bestWindowsSec.km5 !== undefined && (
            <span className="inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/10 px-2 py-0.5 font-semibold text-gold">
              <Award size={10} /> Melhor 5 km: {formatSecClock(gpx.bestWindowsSec.km5)} (
              {formatPaceSec(gpx.bestWindowsSec.km5 / 5)}/km)
            </span>
          )}
        </div>
      )}

      {!compact && gpx.splits.length > 0 && (
        <div className="space-y-1 border-t border-seam pt-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
            Parciais por km (pace · elev)
          </p>
          <div className="space-y-1">
            {gpx.splits.map((split) => {
              // Barra maior = km mais rápido (como no Strava)
              const span = Math.max(30, maxPace - minPace)
              const widthPct = Math.round(
                35 + ((maxPace - split.secPerKm) / span) * 65
              )
              return (
                <div
                  key={`${split.km}-${split.label}`}
                  className="flex items-center gap-2 font-mono text-[10px]"
                >
                  <span className="w-8 shrink-0 text-steel-dim">{split.label}</span>
                  <span className="w-10 shrink-0 text-bone">
                    {formatPaceSec(split.secPerKm)}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded bg-iron-2">
                    <div
                      className="h-full rounded bg-zone/80"
                      style={{ width: `${Math.min(100, Math.max(20, widthPct))}%` }}
                    />
                  </div>
                  {split.elevationDeltaM !== undefined && (
                    <span className="w-7 shrink-0 text-right text-steel-dim">
                      {split.elevationDeltaM >= 0
                        ? `+${split.elevationDeltaM}`
                        : split.elevationDeltaM}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
