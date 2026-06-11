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
