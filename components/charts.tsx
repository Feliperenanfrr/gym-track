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
const SLEEP = "#a78bfa"
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
  suffix = " kg",
  valueFormatter = (v: number) => Math.round(v).toLocaleString("pt-BR"),
}: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
  suffix?: string
  valueFormatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-1 text-steel">
        {label} · {valueFormatter(total)}
        {suffix}
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
            {p.name}: {valueFormatter(p.value)}
            {suffix}
          </p>
        ))}
    </div>
  )
}

/** Volume semanal empilhado por grupo muscular */
export function MuscleVolumeChart({
  data,
  groups,
  valueSuffix = " kg",
  yTickFormatter = (v: number) => `${Math.round(v / 1000)}t`,
  tooltipValueFormatter = (v: number) => Math.round(v).toLocaleString("pt-BR"),
}: {
  data: Record<string, number | string>[]
  groups: { id: string; color: string }[]
  valueSuffix?: string
  yTickFormatter?: (value: number) => string
  tooltipValueFormatter?: (value: number) => string
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
          tickFormatter={yTickFormatter}
        />
        <Tooltip
          content={
            <MuscleTip
              suffix={valueSuffix}
              valueFormatter={tooltipValueFormatter}
            />
          }
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

/** Tooltip aeróbico: separa Zona 2 de intenso e mostra o total */
function AerobicTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; dataKey?: string | number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const z2 = payload.find((p) => p.dataKey === "z2")?.value ?? 0
  const intense = payload.find((p) => p.dataKey === "intense")?.value ?? 0
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-1 text-steel">
        {label} · {z2 + intense} min
      </p>
      <p className="flex items-center gap-1.5 text-bone">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ZONE }} />
        Zona 2: {z2} min
      </p>
      {intense > 0 && (
        <p className="flex items-center gap-1.5 text-bone">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: EMBER }} />
          Intenso: {intense} min
        </p>
      )}
    </div>
  )
}

/**
 * Base aeróbica semanal: Zona 2 (base, contra a meta) + intenso empilhado por
 * cima (visível, mas fora da meta de Z2). A última barra = semana corrente,
 * ainda em andamento, então entra esmaecida para não competir com as fechadas.
 */
export function ZoneChart({
  data,
  target,
}: {
  data: { label: string; z2: number; intense: number }[]
  target: number
}) {
  const lastIdx = data.length - 1
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip content={<AerobicTip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
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
        <Bar dataKey="z2" name="Zona 2" stackId="aer">
          {data.map((_, i) => (
            <Cell key={i} fill={ZONE} fillOpacity={i === lastIdx ? 0.4 : 0.75} />
          ))}
        </Bar>
        <Bar dataKey="intense" name="Intenso" stackId="aer" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={EMBER} fillOpacity={i === lastIdx ? 0.35 : 0.7} />
          ))}
        </Bar>
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

const WATER = "#38bdf8"

/** Água dos últimos dias (ml) contra a meta diária */
export function HydrationChart({
  data,
  target,
}: {
  data: { label: string; ml: number }[]
  target: number
}) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${(v / 1000).toFixed(1).replace(".", ",")}L`}
        />
        <Tooltip
          content={<Tip suffix=" ml" />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <ReferenceLine
          y={target}
          stroke={WATER}
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: `meta ${(target / 1000).toFixed(1).replace(".", ",")}L`,
            position: "insideTopRight",
            fill: WATER,
            fontSize: 10,
            fontFamily: "'JetBrains Mono Variable', monospace",
          }}
        />
        <Bar dataKey="ml" fill={WATER} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SleepChart({
  data,
  targetHours = 8,
}: {
  data: { label: string; hours: number | null }[]
  targetHours?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}h`}
        />
        <Tooltip
          content={<Tip suffix=" h" />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <ReferenceLine
          y={targetHours}
          stroke={SLEEP}
          strokeDasharray="4 4"
          strokeOpacity={0.75}
          label={{
            value: `meta ${targetHours}h`,
            position: "insideTopRight",
            fill: SLEEP,
            fontSize: 10,
            fontFamily: "'JetBrains Mono Variable', monospace",
          }}
        />
        <Bar dataKey="hours" fill={SLEEP} fillOpacity={0.78} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const FAT = "#fb7185"

/** Tooltip multi-série (sem somar) p/ composição corporal */
function SeriesTip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
  suffix: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-1 text-steel">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-bone">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ background: p.color }}
          />
          {p.name}: {p.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          {suffix}
        </p>
      ))}
    </div>
  )
}

/**
 * Composição corporal: gordura (kg) vs músculo esquelético (kg) no tempo.
 * Gráfico-herói da recomposição — gordura caindo e músculo estável/subindo
 * conta a história que o peso sozinho esconde.
 */
export function CompositionChart({
  data,
}: {
  data: { label: string; gordura: number; musculo: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 2", "dataMax + 2"]}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip content={<SeriesTip suffix=" kg" />} cursor={{ stroke: GRID }} />
        <Line
          type="monotone"
          name="Gordura"
          dataKey="gordura"
          stroke={FAT}
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: FAT, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          name="Músculo"
          dataKey="musculo"
          stroke={ZONE}
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: ZONE, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Tendência de % de gordura corporal */
export function BodyFatChart({
  data,
}: {
  data: { label: string; gordura: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="fatFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FAT} stopOpacity={0.3} />
            <stop offset="100%" stopColor={FAT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v: number) => `${v.toFixed(1)}`}
        />
        <Tooltip content={<Tip suffix=" %" />} cursor={{ stroke: GRID }} />
        <Area
          type="monotone"
          dataKey="gordura"
          stroke={FAT}
          strokeWidth={2}
          fill="url(#fatFill)"
          dot={{ r: 2.5, fill: FAT, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * Anatomia do peso: massa magra (peso − gordura) + gordura, empilhadas.
 * Soma exatamente o peso, sem dupla contagem (água/músculo se sobrepõem, então
 * não entram aqui). Mostra do que o seu peso é feito e como isso muda.
 */
export function LeanFatStackChart({
  data,
}: {
  data: { label: string; gordura: number; magra: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip
          content={
            <MuscleTip
              suffix=" kg"
              valueFormatter={(v) =>
                v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
              }
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar
          dataKey="magra"
          name="Massa magra"
          stackId="comp"
          fill={ZONE}
          fillOpacity={0.8}
        />
        <Bar
          dataKey="gordura"
          name="Gordura"
          stackId="comp"
          fill={FAT}
          fillOpacity={0.85}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Gordura visceral com a linha do limite saudável (índice < 10) */
export function VisceralChart({
  data,
}: {
  data: { label: string; visceral: number }[]
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="visceralFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.32} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax) + 2, 12)]}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip content={<Tip suffix="" />} cursor={{ stroke: GRID }} />
        <ReferenceLine
          y={10}
          stroke={ZONE}
          strokeDasharray="4 4"
          strokeOpacity={0.8}
          label={{
            value: "saudável < 10",
            position: "insideTopRight",
            fill: ZONE,
            fontSize: 10,
            fontFamily: "'JetBrains Mono Variable', monospace",
          }}
        />
        <Area
          type="monotone"
          dataKey="visceral"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#visceralFill)"
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
