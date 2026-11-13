"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  RUNNING_PAIN_THRESHOLD,
  RunningLatestSplits,
  RunningSessionPoint,
  RunningWeeklyVolumeDatum,
  formatDurationClock,
} from "@/lib/running-plan"

const EMBER = "#ff5a1f"
const EMBER_HOT = "#ff7a45"
const ZONE = "#2dd4bf"
const GOLD = "#fbbf24"
const WALK = "#64748b"
const SEGMENT = "#a78bfa"
const GRID = "rgba(255,255,255,0.06)"
const TICK = {
  fill: "#97919e",
  fontSize: 10,
  fontFamily: "'JetBrains Mono Variable', monospace",
}

function paceShort(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/* ------------------------------------------------------------------ */
/* 1. Volume semanal de corrida (km / semana + minutos)                */
/* ------------------------------------------------------------------ */

function WeeklyRunTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: RunningWeeklyVolumeDatum }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">
        Sem. {d.label} {d.current ? "(atual)" : ""}
      </p>
      <p className="font-semibold text-zone">
        {d.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
      </p>
      <p className="text-steel-dim">
        {d.minutes} min · {d.runs} {d.runs === 1 ? "sessão" : "sessões"}
      </p>
    </div>
  )
}

export function RunWeeklyVolumeChart({ data }: { data: RunningWeeklyVolumeDatum[] }) {
  const activeWeeks = data.filter((d) => !d.current && d.distanceKm > 0)
  const avgKm =
    activeWeeks.length > 0
      ? Number(
          (
            activeWeeks.reduce((sum, d) => sum + d.distanceKm, 0) / activeWeeks.length
          ).toFixed(2)
        )
      : null

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v} km`}
        />
        <Tooltip content={<WeeklyRunTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        {avgKm !== null && (
          <ReferenceLine y={avgKm} stroke={GOLD} strokeDasharray="3 3" />
        )}
        <Bar dataKey="distanceKm" radius={[3, 3, 0, 0]} minPointSize={2}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={ZONE}
              fillOpacity={d.current ? 0.55 : d.distanceKm > 0 ? 0.9 : 0.15}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* 2. Evolução de pace médio × melhor 1 km / 5 km (GPX)               */
/* ------------------------------------------------------------------ */

function PaceTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: RunningSessionPoint }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">
        {d.label} · {d.title}
      </p>
      {d.avgPaceSecPerKm !== null && (
        <p className="text-bone">
          Pace médio: <span className="font-semibold">{paceShort(d.avgPaceSecPerKm)}/km</span>
        </p>
      )}
      {d.best1kSecPerKm !== null && (
        <p className="text-zone">
          Melhor 1 km: <span className="font-semibold">{paceShort(d.best1kSecPerKm)}/km</span>
        </p>
      )}
      {d.best5kPaceSecPerKm !== null && d.best5kSec !== null && (
        <p className="text-ember-hot">
          Melhor 5 km:{" "}
          <span className="font-semibold">
            {formatDurationClock(d.best5kSec)} ({paceShort(d.best5kPaceSecPerKm)}/km)
          </span>
        </p>
      )}
      {d.segmentPaceSecPerKm !== null && (
        <p className="text-[#a78bfa]">
          Segmento 1,64 km: {paceShort(d.segmentPaceSecPerKm)}/km
        </p>
      )}
      <p className="mt-0.5 text-steel-dim">
        {d.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km · {d.minutes} min
      </p>
    </div>
  )
}

export function RunPaceEvolutionChart({ data }: { data: RunningSessionPoint[] }) {
  const paceData = data.filter((d) => d.avgPaceSecPerKm !== null || d.best1kSecPerKm !== null)
  if (paceData.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-steel-dim">
        Importe ou registre uma corrida com distância para acompanhar o pace.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={paceData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          reversed
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 20", "dataMax + 20"]}
          tickFormatter={(v: number) => paceShort(v)}
        />
        <Tooltip content={<PaceTip />} cursor={{ stroke: "rgba(255,255,255,0.12)" }} />
        <Line
          type="monotone"
          dataKey="avgPaceSecPerKm"
          stroke={GOLD}
          strokeWidth={2}
          dot={{ r: 3.5, fill: GOLD, stroke: "#141216", strokeWidth: 1.5 }}
          activeDot={{ r: 5, fill: GOLD, stroke: "#141216", strokeWidth: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="best1kSecPerKm"
          stroke={ZONE}
          strokeWidth={2.5}
          dot={{ r: 4, fill: ZONE, stroke: "#141216", strokeWidth: 1.5 }}
          activeDot={{ r: 5.5, fill: ZONE, stroke: "#141216", strokeWidth: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="best5kPaceSecPerKm"
          stroke={EMBER_HOT}
          strokeWidth={2}
          dot={{ r: 4.5, fill: EMBER_HOT, stroke: "#141216", strokeWidth: 1.5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="segmentPaceSecPerKm"
          stroke={SEGMENT}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          dot={{ r: 3.5, fill: SEGMENT, stroke: "#141216", strokeWidth: 1.5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Proporção Trote × Caminhada × Trote rápido (< 7:30/km)          */
/* ------------------------------------------------------------------ */

function MixTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: RunningSessionPoint }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">
        {d.label} · {d.title}
      </p>
      <p className="text-zone">Trote controlado (7:30–8:30): {d.controlledTroteMinutes} min</p>
      <p className="text-gold">Trote rápido (&lt; 7:30/km): {d.fastTroteMinutes} min</p>
      <p className="text-steel">Caminhada: {d.walkMinutes} min</p>
    </div>
  )
}

export function RunWalkMixChart({ data }: { data: RunningSessionPoint[] }) {
  const gpxSessions = data.filter((d) => d.hasGpx)
  if (gpxSessions.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-steel-dim">
        Importe arquivos .GPX do Strava para ver os minutos em trote vs. caminhada.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={195}>
      <BarChart data={gpxSessions} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}′`}
        />
        <Tooltip content={<MixTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="walkMinutes" stackId="mix" fill={WALK} fillOpacity={0.75} />
        <Bar dataKey="controlledTroteMinutes" stackId="mix" fill={ZONE} />
        <Bar
          dataKey="fastTroteMinutes"
          stackId="mix"
          fill={GOLD}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Dor pós-treino (0–10) × Duração & Tênis                          */
/* ------------------------------------------------------------------ */

function PainLoadTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: RunningSessionPoint }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">
        {d.label} · {d.stageLabel}
      </p>
      <p className={d.painScore !== null && d.painScore > RUNNING_PAIN_THRESHOLD ? "font-semibold text-gold" : "font-semibold text-zone"}>
        Dor pós-treino: {d.painScore !== null ? `${d.painScore}/10` : "sem registro"}
      </p>
      <p className="text-bone">
        Duração: {d.minutes} min ({d.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km)
        {d.overCeiling ? " · acima do teto" : ""}
      </p>
      <p className="text-steel-dim">Tênis: {d.shoe ?? "não informado"}</p>
    </div>
  )
}

export function RunPainLoadChart({ data }: { data: RunningSessionPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-steel-dim">
        Sem treinos de corrida ainda para cruzar duração, tênis e dor.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={205}>
      <ComposedChart data={data} margin={{ top: 10, right: -8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          yAxisId="min"
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}′`}
        />
        <YAxis
          yAxisId="pain"
          orientation="right"
          domain={[0, 10]}
          ticks={[0, 3, 6, 10]}
          tick={TICK}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<PainLoadTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <ReferenceLine
          yAxisId="pain"
          y={RUNNING_PAIN_THRESHOLD}
          stroke={GOLD}
          strokeDasharray="3 3"
        />
        <Bar yAxisId="min" dataKey="minutes" radius={[3, 3, 0, 0]} maxBarSize={34}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.overCeiling ? GOLD : WALK}
              fillOpacity={d.overCeiling ? 0.45 : 0.35}
            />
          ))}
        </Bar>
        <Line
          yAxisId="pain"
          type="monotone"
          dataKey="painScore"
          stroke={ZONE}
          strokeWidth={2.5}
          dot={(props) => {
            const { cx, cy, payload, index } = props
            if (cx === undefined || cy === undefined || payload?.painScore === null) {
              return <g key={`empty-${index}`} />
            }
            const high = payload.painScore > RUNNING_PAIN_THRESHOLD
            return (
              <circle
                key={`pain-${index}`}
                cx={cx}
                cy={cy}
                r={4.5}
                fill={high ? EMBER : ZONE}
                stroke="#141216"
                strokeWidth={1.5}
              />
            )
          }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* 5. Curva de ritmo por km do último GPX (splits)                     */
/* ------------------------------------------------------------------ */

function SplitTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: RunningLatestSplits["splits"][number] }[]
}) {
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">
        {s.label} ({s.distanceKm.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km)
      </p>
      <p className={s.isFastest ? "font-semibold text-zone" : "font-semibold text-bone"}>
        Pace: {paceShort(s.secPerKm)}/km {s.isFastest ? "· mais rápido" : ""}
      </p>
      {s.elevationDeltaM !== undefined && (
        <p className="text-steel-dim">
          Elevação: {s.elevationDeltaM >= 0 ? `+${s.elevationDeltaM}` : s.elevationDeltaM} m
        </p>
      )}
    </div>
  )
}

export function RunSplitsChart({ latest }: { latest: RunningLatestSplits }) {
  return (
    <ResponsiveContainer width="100%" height={195}>
      <LineChart data={latest.splits} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          reversed
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 15", "dataMax + 15"]}
          tickFormatter={(v: number) => paceShort(v)}
        />
        <Tooltip content={<SplitTip />} cursor={{ stroke: "rgba(255,255,255,0.12)" }} />
        <ReferenceLine y={latest.avgSecPerKm} stroke={GOLD} strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="secPerKm"
          stroke={EMBER_HOT}
          strokeWidth={2.5}
          dot={(props) => {
            const { cx, cy, payload, index } = props
            if (cx === undefined || cy === undefined) return <g key={`empty-${index}`} />
            return (
              <circle
                key={`split-${index}`}
                cx={cx}
                cy={cy}
                r={payload?.isFastest ? 5.5 : 4}
                fill={payload?.isFastest ? ZONE : EMBER_HOT}
                stroke="#141216"
                strokeWidth={1.5}
              />
            )
          }}
          activeDot={{ r: 6, fill: ZONE, stroke: "#141216", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
