"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const EMBER = "#ff5a1f"
const EMBER_HOT = "#ff7a45"
const ZONE = "#2dd4bf"
const GOLD = "#fbbf24"
const GRID = "rgba(255,255,255,0.06)"
const TICK = {
  fill: "#97919e",
  fontSize: 10,
  fontFamily: "'JetBrains Mono Variable', monospace",
}

function Tip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean
  payload?: { value: number | string; name?: string }[]
  label?: string
  suffix: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-bone">
          {typeof p.value === "number"
            ? p.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
            : p.value}
          {suffix}
        </p>
      ))}
    </div>
  )
}

export function WeeklyVolumeChart({
  data,
}: {
  data: { label: string; volume: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}t`}
        />
        <Tooltip
          content={<Tip suffix=" kg" />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            // última barra (semana atual) em destaque
            <Cell key={i} fill={i === data.length - 1 ? EMBER_HOT : EMBER} fillOpacity={i === data.length - 1 ? 1 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function MuscleTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-1 text-steel">
        {label} · {Math.round(total).toLocaleString("pt-BR")} kg
      </p>
      {[...payload]
        .reverse()
        .filter((p) => p.value > 0)
        .map((p) => (
          <p key={p.name} className="flex items-center gap-1.5 text-bone">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: p.color }}
            />
            {p.name}: {Math.round(p.value).toLocaleString("pt-BR")} kg
          </p>
        ))}
    </div>
  )
}

/** Volume semanal empilhado por grupo muscular */
export function MuscleVolumeChart({
  data,
  groups,
}: {
  data: Record<string, number | string>[]
  groups: { id: string; color: string }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}t`}
        />
        <Tooltip
          content={<MuscleTip />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        {groups.map((g, gi) => (
          <Bar
            key={g.id}
            dataKey={g.id}
            stackId="vol"
            fill={g.color}
            fillOpacity={0.8}
            radius={gi === groups.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StrengthChart({
  data,
}: {
  data: { label: string; e1rm: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 4", "dataMax + 4"]}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip content={<Tip suffix=" kg (1RM est.)" />} cursor={{ stroke: GRID }} />
        <Line
          type="monotone"
          dataKey="e1rm"
          stroke={EMBER}
          strokeWidth={2.5}
          dot={{ r: 3, fill: EMBER, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: EMBER_HOT }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ZoneChart({
  data,
  target,
}: {
  data: { label: string; minutes: number }[]
  target: number
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip
          content={<Tip suffix=" min" />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <ReferenceLine
          y={target}
          stroke={ZONE}
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: `meta ${target}`,
            position: "insideTopRight",
            fill: ZONE,
            fontSize: 10,
            fontFamily: "'JetBrains Mono Variable', monospace",
          }}
        />
        <Bar dataKey="minutes" fill={ZONE} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function WeightChart({
  data,
}: {
  data: { label: string; peso: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 0.5", "dataMax + 0.5"]}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <Tooltip content={<Tip suffix=" kg" />} cursor={{ stroke: GRID }} />
        <Area
          type="monotone"
          dataKey="peso"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#weightFill)"
          dot={{ r: 2.5, fill: GOLD, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function WaistChart({
  data,
}: {
  data: { label: string; cintura: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="waistFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 2", "dataMax + 2"]}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <Tooltip content={<Tip suffix=" cm" />} cursor={{ stroke: GRID }} />
        <Area
          type="monotone"
          dataKey="cintura"
          stroke="#818cf8"
          strokeWidth={2}
          fill="url(#waistFill)"
          dot={{ r: 2.5, fill: "#818cf8", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
