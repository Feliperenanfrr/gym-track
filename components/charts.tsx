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
import type { EnergyBalancePoint } from "@/lib/energy"
import type { CalorieTrendPoint } from "@/lib/insights"

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

/**
 * Tick do eixo em kcal. A casa decimal fica mesmo em valores de cinco dígitos:
 * arredondar 10.500 para "11k" põe um número errado no eixo. O que se ajusta é
 * a calha do eixo (`width`), larga o bastante para "10,5k".
 */
function kcalAxisTick(value: number): string {
  if (Math.abs(value) < 1000) return String(Math.round(value))
  return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
}

/**
 * Cor do fundo do card. As barras recebem tons um passo mais escuros que os
 * tokens de marca: `#ff5a1f`/`#2dd4bf` são vivos demais como área grande sobre
 * fundo escuro (ficam fora da banda de luminosidade validada). O token vivo
 * volta no realce do intervalo em foco e nos marcadores da legenda, então a
 * identidade "brasa = musculação / turquesa = cardio" se mantém.
 */
const SURFACE = "#141216"
const LIFT_FILL = "#e05a20"
const CARDIO_FILL = "#22a894"

interface ChartClickState {
  activeTooltipIndex?: number | null
}

function focusHandler(onFocus?: (index: number) => void) {
  if (!onFocus) return undefined
  return (state: ChartClickState) => {
    const index = state?.activeTooltipIndex
    if (typeof index === "number" && index >= 0) onFocus(index)
  }
}

/**
 * Gasto por intervalo, empilhado: a altura da barra é o total e os dois
 * segmentos são a composição — as três leituras que o painel precisa, num
 * gráfico só.
 *
 * Decisões que valem a pena registrar:
 * - a linha tracejada é a média dos intervalos FECHADOS, o que transforma cada
 *   barra numa comparação ("essa semana rendeu acima do meu normal") em vez de
 *   um número solto;
 * - o intervalo em curso vem hachurado, não esmaecido: opacidade baixa lê-se
 *   como "pouco", quando o que acontece é "incompleto";
 * - o valor de cada barra é lido por toque no leitor fixo acima do gráfico, e
 *   não só por tooltip flutuante — no celular não existe hover, e um balão sob
 *   o dedo tapa justamente a barra que se quer ver.
 */
export function CalorieChart({
  data,
  average,
  focusIndex,
  onFocus,
}: {
  data: CalorieTrendPoint[]
  /** média por intervalo fechado (linha de referência) */
  average: number
  /** intervalo destacado no leitor */
  focusIndex: number
  onFocus?: (index: number) => void
}) {
  const summary = data
    .map((point) => `${point.label}: ${point.total.toLocaleString("pt-BR")} kcal`)
    .join("; ")
  const handleFocus = focusHandler(onFocus)
  return (
    <div
      role="img"
      aria-label={`Gasto calórico estimado por período. ${summary}`}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: 2, bottom: 0 }}
          barCategoryGap="18%"
          onClick={handleFocus}
          onMouseMove={handleFocus}
        >
          {/* Hachura do intervalo em curso — "ainda enchendo", não "menor".
              O <defs> precisa ser elemento nativo aqui: o recharts descarta
              componentes que não reconhece, e a referência url(#...) fica
              pendurada no vazio (barra invisível, não hachurada). */}
          <defs>
            <pattern
              id="kcalHatchLift"
              width={6}
              height={6}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width={6} height={6} fill={LIFT_FILL} fillOpacity={0.3} />
              <line x1={0} y1={0} x2={0} y2={6} stroke={LIFT_FILL} strokeWidth={3} />
            </pattern>
            <pattern
              id="kcalHatchCardio"
              width={6}
              height={6}
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width={6} height={6} fill={CARDIO_FILL} fillOpacity={0.3} />
              <line x1={0} y1={0} x2={0} y2={6} stroke={CARDIO_FILL} strokeWidth={3} />
            </pattern>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={22}
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            width={40}
            tickFormatter={kcalAxisTick}
          />
          <Tooltip content={() => null} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
          {/* sem rótulo: encostava no tick do eixo Y, e a legenda abaixo do
              gráfico já diz o que o tracejado significa */}
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke="#97919e"
              strokeDasharray="3 4"
              strokeOpacity={0.75}
            />
          )}
          {/* stroke da cor do fundo = respiro de 2px entre os segmentos */}
          {/* animação desligada: o gráfico re-renderiza a cada toque para
              mover o foco, e o recharts reinicia a animação de crescimento a
              cada render — as barras piscavam do zero a cada leitura */}
          <Bar
            dataKey="lift"
            name="Musculação"
            stackId="kcal"
            stroke={SURFACE}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((point, index) => (
              <Cell
                key={point.key}
                fill={point.current ? "url(#kcalHatchLift)" : LIFT_FILL}
                fillOpacity={focusIndex === index || focusIndex < 0 ? 1 : 0.55}
              />
            ))}
          </Bar>
          <Bar
            dataKey="cardio"
            name="Cardio"
            stackId="kcal"
            radius={[3, 3, 0, 0]}
            stroke={SURFACE}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((point, index) => (
              <Cell
                key={point.key}
                fill={point.current ? "url(#kcalHatchCardio)" : CARDIO_FILL}
                fillOpacity={focusIndex === index || focusIndex < 0 ? 1 : 0.55}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Extremidade arredondada no lado do dado; base reta na linha do zero. */
function divergingPath(
  x: number,
  y: number,
  w: number,
  h: number,
  up: boolean
): string {
  const r = Math.max(0, Math.min(3, w / 2, h))
  return up
    ? `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
    : `M${x},${y} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w - r},${y + h} Q${x + w},${y + h} ${x + w},${y + h - r} L${x + w},${y} Z`
}

interface BarShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  fillOpacity?: number
  payload?: EnergyBalancePoint
}

function BalanceBar(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, fill, fillOpacity, payload } = props
  if (!height || !width) return <g />
  const up = (payload?.balance ?? 0) >= 0
  return (
    <path d={divergingPath(x, y, width, height, up)} fill={fill} fillOpacity={fillOpacity} />
  )
}

/**
 * Saldo energético semanal: acima da linha o corpo guardou energia (comeu mais
 * do que gastou), abaixo dela liberou. Zero é manutenção.
 *
 * É um gráfico divergente porque a pergunta é de polaridade — "sobrou ou
 * faltou?" — e não de magnitude. Peso e calorias moram no mesmo eixo por
 * conversão, não por dois eixos: kg/semana vira kcal/dia pela densidade dos
 * tecidos, então uma escala só descreve as duas coisas honestamente.
 *
 * A linha tracejada do gasto médio com treino dá a régua que responde à
 * pergunta prática: se o saldo oscila 600 kcal/dia e o treino vale 200, o
 * ponteiro está na cozinha, não na academia.
 */
export function EnergyBalanceChart({
  data,
  trainingReference,
  focusIndex,
  onFocus,
}: {
  data: EnergyBalancePoint[]
  /** kcal/dia médias de treino, desenhadas como referência */
  trainingReference: number
  focusIndex: number
  onFocus?: (index: number) => void
}) {
  const summary = data
    .filter((point) => point.balance !== null)
    .map(
      (point) =>
        `${point.label}: ${point.balance! > 0 ? "+" : ""}${point.balance} kcal por dia`
    )
    .join("; ")
  const handleFocus = focusHandler(onFocus)
  return (
    <div
      role="img"
      aria-label={`Saldo energético estimado por semana. ${summary}`}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: 2, bottom: 0 }}
          barCategoryGap="22%"
          onClick={handleFocus}
          onMouseMove={handleFocus}
        >
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={22}
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            width={40}
            tickFormatter={kcalAxisTick}
          />
          <Tooltip content={() => null} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
          {/* extendDomain: o gasto com treino costuma cair fora da faixa dos
              saldos, e é justamente a comparação que o gráfico existe para fazer */}
          {trainingReference > 0 && (
            <ReferenceLine
              y={trainingReference}
              stroke="#97919e"
              strokeDasharray="3 4"
              strokeOpacity={0.7}
              ifOverflow="extendDomain"
              label={{
                value: `treino ${trainingReference}`,
                position: "insideTopRight",
                fill: "#97919e",
                fontSize: 9,
                fontFamily: "'JetBrains Mono Variable', monospace",
              }}
            />
          )}
          <ReferenceLine y={0} stroke="#5f5a66" strokeWidth={1} />
          <Bar dataKey="balance" name="Saldo" shape={<BalanceBar />} isAnimationActive={false}>
            {data.map((point, index) => (
              <Cell
                key={point.key}
                fill={(point.balance ?? 0) >= 0 ? LIFT_FILL : CARDIO_FILL}
                fillOpacity={focusIndex === index || focusIndex < 0 ? 1 : 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
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

/* ------------------------------------------------------------------ */
/* Consistência                                                        */
/* ------------------------------------------------------------------ */

/**
 * Sessões por semana contra o alvo do programa.
 *
 * A barra é a semana inteira (seg–dom) e a linha tracejada é o alvo: cada
 * barra vira "cumpri ou não cumpri" em vez de um número solto. Semana zerada
 * ainda ocupa espaço no eixo — zero é informação, e some se a barra não tiver
 * altura nenhuma.
 */
export function ConsistencyChart({
  data,
  target,
}: {
  data: { label: string; sessions: number; target: number; current: boolean }[]
  target: number
}) {
  const max = Math.max(target, ...data.map((d) => d.sessions))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={TICK}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          domain={[0, max + 1]}
        />
        <Tooltip
          content={<Tip suffix=" sessões" />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <ReferenceLine
          y={target}
          stroke={ZONE}
          strokeDasharray="4 4"
          strokeOpacity={0.8}
          label={{
            value: `alvo ${target}`,
            position: "insideTopRight",
            fill: ZONE,
            fontSize: 10,
            fontFamily: "'JetBrains Mono Variable', monospace",
          }}
        />
        <Bar dataKey="sessions" radius={[3, 3, 0, 0]} minPointSize={2}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.sessions >= d.target ? ZONE : EMBER}
              // a semana em curso ainda não pode ser julgada: fica mais clara
              fillOpacity={d.current ? 0.4 : 0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Força — carga do top set                                            */
/* ------------------------------------------------------------------ */

interface TopSetDatum {
  label: string
  carga: number
  reps: number
  rir?: number
  e1rm: number | null
  isLoadPr: boolean
}

function TopSetTip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean
  payload?: { payload: TopSetDatum }[]
  label?: string
  mode: "carga" | "e1rm"
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border border-seam bg-iron-2 px-3 py-2 font-mono text-xs shadow-xl">
      <p className="mb-0.5 text-steel">{label}</p>
      <p className="font-semibold text-bone">
        {mode === "e1rm" && d.e1rm !== null
          ? `${d.e1rm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg (1RM est.)`
          : `${d.carga.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg × ${d.reps}`}
      </p>
      <p className="text-steel-dim">
        {mode === "e1rm"
          ? `de ${d.carga.toLocaleString("pt-BR")} kg × ${d.reps}`
          : d.rir !== undefined
            ? `RIR ${d.rir}`
            : "RIR não informado"}
      </p>
      {d.isLoadPr ? <p className="mt-0.5 text-gold">↑ carga recorde</p> : null}
    </div>
  )
}

/**
 * Progressão de carga da série mais pesada.
 *
 * Dado bruto, não estimativa: é o número que decide a próxima sessão. Os
 * pontos em que a carga bateu recorde vêm marcados em dourado; no modo
 * "1RM est." só entram sessões com reps efetivas dentro do teto confiável.
 */
export function TopSetChart({
  data,
  mode = "carga",
}: {
  data: TopSetDatum[]
  mode?: "carga" | "e1rm"
}) {
  const series = mode === "e1rm" ? data.filter((d) => d.e1rm !== null) : data
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={series} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        {/* minTickGap derruba a data que colidiria com a vizinha: com 8+
            sessões num celular de 390 px os rótulos encavalavam */}
        <XAxis
          dataKey="label"
          tick={TICK}
          axisLine={false}
          tickLine={false}
          minTickGap={18}
        />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          domain={["dataMin - 4", "dataMax + 4"]}
          tickFormatter={(v: number) => `${Math.round(v)}`}
        />
        <Tooltip content={<TopSetTip mode={mode} />} cursor={{ stroke: GRID }} />
        <Line
          type="monotone"
          dataKey={mode === "e1rm" ? "e1rm" : "carga"}
          stroke={EMBER}
          strokeWidth={2.5}
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const datum = series[props.index ?? 0]
            const pr = mode === "carga" && Boolean(datum?.isLoadPr)
            return (
              <circle
                key={props.index}
                cx={props.cx}
                cy={props.cy}
                r={pr ? 5 : 3}
                fill={pr ? GOLD : EMBER}
                stroke="#141216"
                strokeWidth={pr ? 2 : 0}
              />
            )
          }}
          activeDot={{ r: 6, fill: EMBER_HOT, stroke: "#141216", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Sono — faixa de horário                                             */
/* ------------------------------------------------------------------ */

export interface SleepBand {
  /** SEG..DOM */
  label: string
  /** minutos na régua de relógio; 22h vira 1320, 1h da manhã vira 1500 */
  startMin: number | null
  durationMin: number | null
  /** dd/MM, usado só como chave estável */
  dateLabel: string
}

/** Régua: 18h de um dia até 14h do seguinte (20 horas de relógio). */
const BAND_START = 18 * 60
const BAND_END = 38 * 60

/**
 * Cada noite como uma faixa de "dormiu" até "acordou".
 *
 * O gráfico de barras mostrava só a duração e jogava fora `sleptAt` e
 * `wokeAt`, que já estavam no banco. A REGULARIDADE do horário — que pesa
 * tanto quanto a duração — só aparece quando as faixas ficam alinhadas numa
 * régua de relógio comum: dormir 7 h sempre à 1h lê-se diferente de dormir
 * 7 h ora às 22h, ora às 4h.
 *
 * SVG escrito à mão porque o recharts não tem barra flutuante (com início
 * livre, não ancorada no zero) — e porque num celular a leitura por linha é
 * mais confortável que por coluna.
 */
export function SleepScheduleChart({ data }: { data: SleepBand[] }) {
  const rowH = 22
  const gap = 4
  const labelW = 38
  const width = 320
  const height = data.length * (rowH + gap) - gap + 26
  const plotW = width - labelW - 6
  const span = BAND_END - BAND_START
  const x = (min: number) => labelW + ((min - BAND_START) / span) * plotW
  const ticks = [18, 21, 24, 27, 30, 33, 36]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Horário de dormir e acordar das últimas noites"
      style={{ display: "block" }}
    >
      {ticks.map((h) => (
        <g key={h}>
          <line
            x1={x(h * 60)}
            y1={14}
            x2={x(h * 60)}
            y2={height - 16}
            stroke={h === 24 ? "rgba(255,255,255,0.16)" : GRID}
            strokeWidth={1}
          />
          <text
            x={x(h * 60)}
            y={height - 4}
            fill="#5f5a66"
            fontSize={9}
            fontFamily="'JetBrains Mono Variable', monospace"
            textAnchor="middle"
          >
            {`${String(h % 24).padStart(2, "0")}h`}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const y = 14 + i * (rowH + gap)
        const has =
          d.startMin !== null && d.durationMin !== null && d.durationMin > 0
        const start = has ? Math.max(BAND_START, d.startMin as number) : 0
        const end = has
          ? Math.min(BAND_END, (d.startMin as number) + (d.durationMin as number))
          : 0
        const barW = has ? Math.max(3, x(end) - x(start)) : 0
        return (
          <g key={`${d.dateLabel}-${i}`}>
            <text
              x={0}
              y={y + rowH / 2 + 3.5}
              fill={has ? "#97919e" : "#5f5a66"}
              fontSize={9.5}
              fontFamily="'JetBrains Mono Variable', monospace"
            >
              {d.label}
            </text>
            <rect
              x={labelW}
              y={y}
              width={plotW}
              height={rowH}
              fill="#1b181d"
              fillOpacity={0.55}
            />
            {has ? (
              <rect
                x={x(start)}
                y={y + 3}
                width={barW}
                height={rowH - 6}
                rx={3}
                fill={SLEEP}
                fillOpacity={0.85}
              />
            ) : (
              <text
                x={labelW + plotW / 2}
                y={y + rowH / 2 + 3.5}
                fill="#5f5a66"
                fontSize={9}
                fontFamily="'JetBrains Mono Variable', monospace"
                textAnchor="middle"
              >
                sem registro
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
