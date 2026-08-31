"use client"

import { useEffect, useState } from "react"
import { CalorieChart, EnergyBalanceChart } from "@/components/charts"
import { PAL_BASE } from "@/lib/energy"
import type { EnergyBalanceSeries, EnergyReport, SignalTone } from "@/lib/energy"
import type { CalorieTrend, CalorieTrendRange } from "@/lib/insights"
import { cn } from "@/lib/utils"

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR")
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`

/** Kicker padrão dos blocos internos: pequeno, condensado, recessivo. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
      {children}
    </p>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-sm"
      style={{ background: color }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Calorias dos treinos                                                 */
/* ------------------------------------------------------------------ */

const LIFT_FILL = "#e05a20"
const CARDIO_FILL = "#22a894"

const RANGE_LABEL: Record<CalorieTrendRange, string> = {
  "12w": "12 sem",
  all: "histórico",
}

/**
 * Painel de gasto dos treinos.
 *
 * O gráfico do PR anterior somava tudo num acumulado ("18.400 kcal no total"),
 * que só cresce e por isso não responde a nenhuma pergunta. O número-herói
 * aqui é uma TAXA — kcal por semana — contra a mesma taxa do período anterior:
 * assim o painel diz se o gasto está subindo ou caindo, que é o que dá para
 * agir em cima.
 */
export function CaloriePanel({
  trend,
  range,
  onRangeChange,
}: {
  trend: CalorieTrend
  range: CalorieTrendRange
  onRangeChange: (range: CalorieTrendRange) => void
}) {
  /**
   * -1 = nada tocado ainda: o leitor mostra o intervalo mais recente e o
   * gráfico fica com todas as barras cheias. Destacar uma barra já na carga
   * apagaria as outras onze e faria o painel parecer só sobre a última semana.
   */
  const [focus, setFocus] = useState(-1)
  useEffect(() => {
    setFocus(-1)
  }, [range, trend.points.length])

  if (trend.points.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-steel-dim">
        Registre ao menos um treino e uma pesagem para calcular o gasto calórico.
      </p>
    )
  }

  const active = focus < 0 ? trend.points.length - 1 : Math.min(focus, trend.points.length - 1)
  const point = trend.points[active]
  const cardioShare = trend.total > 0 ? Math.round((trend.cardio / trend.total) * 100) : 0
  const liftShare = trend.total > 0 ? 100 - cardioShare : 0
  const delta =
    trend.previousPerWeek && trend.previousPerWeek > 0
      ? Math.round(((trend.perWeek - trend.previousPerWeek) / trend.previousPerWeek) * 100)
      : null
  const periodLabel =
    trend.granularity === "week" ? `semana até ${point.label}` : point.label

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Kicker>Gasto médio · {RANGE_LABEL[range]}</Kicker>
          <p className="mt-0.5 font-mono text-3xl font-semibold leading-none text-gold">
            {fmt(trend.perWeek)}
            <span className="ml-1.5 text-xs font-normal text-steel-dim">kcal/sem</span>
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-2 font-mono text-[11px] text-steel">
            {delta !== null && (
              <span className="whitespace-nowrap">
                <span className={delta >= 0 ? "text-zone" : "text-ember"}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
                </span>
                <span className="text-steel-dim"> vs. anterior</span>
              </span>
            )}
            <span className="whitespace-nowrap">{fmt(trend.perSession)} kcal/treino</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Período do gráfico">
          {(["12w", "all"] as const).map((option) => (
            <button
              key={option}
              onClick={() => onRangeChange(option)}
              aria-pressed={range === option}
              className={cn(
                "rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                range === option
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-seam text-steel hover:text-bone"
              )}
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {RANGE_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      {/* Composição do período: a barra é a legenda, e a legenda traz os valores. */}
      <div className="mt-4">
        <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-sm">
          <div style={{ width: `${liftShare}%`, background: LIFT_FILL }} />
          <div style={{ width: `${cardioShare}%`, background: CARDIO_FILL }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 text-steel">
            <Swatch color={LIFT_FILL} />
            Musculação
            <span className="text-bone">{fmt(trend.lift)}</span>
            <span className="text-steel-dim">{liftShare}%</span>
          </span>
          <span className="flex items-center gap-1.5 text-steel">
            <Swatch color={CARDIO_FILL} />
            Cardio
            <span className="text-bone">{fmt(trend.cardio)}</span>
            <span className="text-steel-dim">{cardioShare}%</span>
          </span>
        </div>
      </div>

      {/* Leitor fixo: o valor da barra sem depender de hover (não existe no celular). */}
      <div className="mt-3 border-t border-seam pt-2.5">
        <Kicker>
          {periodLabel}
          {point.current && " · em curso"}
        </Kicker>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 font-mono text-sm">
          <span className="font-semibold text-bone">{fmt(point.total)} kcal</span>
          <span className="flex items-center gap-1 text-[11px] text-steel">
            <Swatch color={LIFT_FILL} />
            {fmt(point.lift)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-steel">
            <Swatch color={CARDIO_FILL} />
            {fmt(point.cardio)}
          </span>
        </p>
      </div>

      <div className="mt-1">
        <CalorieChart
          data={trend.points}
          average={trend.perPoint}
          focusIndex={focus}
          onFocus={setFocus}
        />
      </div>
      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-steel-dim">
        Toque numa barra para ler o intervalo. Hachurado = ainda em curso; tracejado =
        sua média por {trend.granularity === "week" ? "semana" : "mês"}. Cardio inclui
        Zona 2, intenso, esporte e Strava.
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Balanço energético                                                   */
/* ------------------------------------------------------------------ */

/** Rampa ordinal de uma cor só: do gasto fixo (escuro) ao controlável (claro). */
const BUDGET_STEPS = [
  { id: "bmr", label: "Basal", color: "#7a3f22" },
  { id: "routine", label: "Rotina", color: "#b3521f" },
  { id: "training", label: "Treino", color: "#e8721f" },
] as const

const TONE_CLASS: Record<SignalTone, string> = {
  good: "text-zone",
  warn: "text-gold",
  bad: "text-ember",
  neutral: "text-steel",
}

/**
 * Painel de balanço energético: o que a variação de massa revela sobre a
 * comida. Três blocos, do geral ao específico — quanto você deve estar
 * comendo, de onde vem o seu gasto, e como o saldo se moveu semana a semana.
 */
export function EnergyPanel({
  report,
  series,
}: {
  report: EnergyReport
  series: EnergyBalanceSeries
}) {
  const [focus, setFocus] = useState(-1)
  useEffect(() => {
    setFocus(-1)
  }, [series.points.length])

  const { budget, trend, intake, targets } = report

  const scaleMax = budget ? Math.max(budget.tdee, intake ?? budget.tdee) * 1.04 : 1
  const width = (value: number) => `${(value / scaleMax) * 100}%`
  const active =
    focus < 0 ? series.points.length - 1 : Math.min(focus, series.points.length - 1)
  const point = series.points[active]

  return (
    <>
      <div className="min-w-0">
        <Kicker>
          {budget ? "Ingestão estimada" : "Saldo estimado"} · {report.days} dias
        </Kicker>
        {!budget ? (
          /* Sem basal não há gasto total nem ingestão — mas a balança sozinha
             já diz se sobrou ou faltou energia, e isso vale mostrar. */
          <>
            <p className="mt-0.5 font-mono text-3xl font-semibold leading-none text-gold">
              {trend.storedKcalPerDay !== null ? signed(trend.storedKcalPerDay) : "—"}
              <span className="ml-1.5 text-xs font-normal text-steel-dim">kcal/dia</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-steel-dim">
              Para virar isso em quanto comer, falta o metabolismo basal: importe uma
              bioimpedância em <b>Medidas</b>.
            </p>
          </>
        ) : intake !== null ? (
          <>
            <p className="mt-0.5 font-mono text-3xl font-semibold leading-none text-gold">
              {fmt(intake)}
              <span className="ml-1.5 text-xs font-normal text-steel-dim">kcal/dia</span>
            </p>
            <p className="mt-1.5 flex flex-wrap gap-x-2 font-mono text-[11px] text-steel">
              <span className="whitespace-nowrap">
                manutenção ≈ {fmt(budget.tdee)}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap",
                  intake - budget.tdee >= 0 ? "text-ember" : "text-zone"
                )}
              >
                saldo {signed(intake - budget.tdee)}/dia
              </span>
              <span className="whitespace-nowrap text-steel-dim">
                faixa {fmt(report.intakeLow!)}–{fmt(report.intakeHigh!)}
              </span>
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-steel-dim">
            Precisa de pelo menos duas pesagens separadas por uma semana para estimar a
            ingestão. Seu gasto atual está em {fmt(budget.tdee)} kcal/dia.
          </p>
        )}
      </div>

      {/* Orçamento do dia em escala absoluta: a marca da ingestão contra o gasto. */}
      {budget && (
      <div className="mt-4">
        <div className="relative">
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-sm bg-iron-2">
            {BUDGET_STEPS.map((step) => (
              <div
                key={step.id}
                style={{ width: width(budget[step.id]), background: step.color }}
              />
            ))}
          </div>
          {intake !== null && (
            <div
              className="absolute -top-1 bottom-[-4px] w-[2px] bg-bone"
              style={{ left: width(intake) }}
              aria-hidden
            />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
          {BUDGET_STEPS.map((step) => (
            <span key={step.id} className="flex items-center gap-1.5 text-steel">
              <Swatch color={step.color} />
              {step.label}
              <span className="text-bone">{fmt(budget[step.id])}</span>
              <span className="text-steel-dim">
                {Math.round((budget[step.id] / budget.tdee) * 100)}%
              </span>
            </span>
          ))}
          {intake !== null && (
            <span className="flex items-center gap-1.5 text-steel">
              <span className="inline-block h-2.5 w-[2px] shrink-0 bg-bone" />
              Ingestão
              <span className="text-bone">{fmt(intake)}</span>
            </span>
          )}
        </div>
      </div>
      )}

      {series.measured >= 2 ? (
        <>
          <div className="mt-4 border-t border-seam pt-2.5">
            <Kicker>
              semana até {point.label}
              {point.current && " · em curso"}
            </Kicker>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 font-mono text-sm">
              {point.balance !== null ? (
                <>
                  <span
                    className={cn(
                      "font-semibold",
                      point.balance >= 0 ? "text-ember" : "text-zone"
                    )}
                  >
                    {signed(point.balance)} kcal/dia
                  </span>
                  <span className="text-[11px] text-steel">
                    {point.kgPerWeek !== null &&
                      `${point.kgPerWeek > 0 ? "+" : "−"}${Math.abs(point.kgPerWeek)
                        .toFixed(2)
                        .replace(".", ",")} kg/sem`}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-steel-dim">sem pesagens na janela</span>
              )}
              <span className="text-[11px] text-steel">
                treino {fmt(point.training)} kcal/dia · {point.sessions} sessões
              </span>
            </p>
          </div>
          <div className="mt-1">
            <EnergyBalanceChart
              data={series.points}
              trainingReference={series.avgTraining}
              focusIndex={focus}
              onFocus={setFocus}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-steel">
            <span className="flex items-center gap-1.5">
              <Swatch color={LIFT_FILL} />
              acima do zero: guardou energia
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch color={CARDIO_FILL} />
              abaixo: gastou
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-steel-dim">
            Cada barra usa a tendência de {series.trendWindowDays} dias que termina
            naquela semana. O tracejado é o seu gasto médio com treino: se as barras
            oscilam mais do que ele, o ponteiro está no prato, não na academia.
          </p>
        </>
      ) : (
        <p className="mt-4 border-t border-seam pt-3 font-mono text-[10px] leading-relaxed text-steel-dim">
          O saldo semana a semana precisa de pesagens mais frequentes: pese-se ao menos
          duas vezes por semana e o gráfico aparece aqui.
        </p>
      )}

      {/* Sinais: o diagnóstico que separa "comendo demais" de "treinando de menos". */}
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-seam pt-3">
        {report.signals.map((signal) => (
          <div key={signal.id} className="min-w-0">
            <Kicker>{signal.label}</Kicker>
            <p className={cn("font-mono text-sm font-semibold", TONE_CLASS[signal.tone])}>
              {signal.value}
            </p>
            {(signal.tone === "warn" || signal.tone === "bad") && (
              <p className="mt-0.5 text-[10px] leading-snug text-steel-dim">
                {signal.hint}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-seam pt-3">
        <p className="text-xs leading-relaxed text-bone">{report.verdict}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-steel">{report.advice}</p>
        {targets && (
          <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
            {[
              { label: "Cortar", value: targets.cut, hint: "−0,5%/sem" },
              { label: "Manter", value: targets.maintain, hint: "peso estável" },
              { label: "Ganhar", value: targets.bulk, hint: "+0,25%/sem" },
            ].map((target) => (
              <div key={target.label} className="rounded border border-seam bg-iron-2 p-2">
                <p className="text-[10px] uppercase tracking-wider text-steel-dim">
                  {target.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-bone">
                  {fmt(target.value)}
                </p>
                <p className="text-[10px] text-steel-dim">{target.hint}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2.5 font-mono text-[10px] leading-relaxed text-steel-dim">
          {budget && (
            <>
          Basal{" "}
          {budget.bmrSource === "scale"
            ? "medido na bioimpedância"
            : "por Katch-McArdle (massa magra)"}
          ; rotina e digestão em {Math.round((PAL_BASE - 1) * 100)}% do basal;
            </>
          )}
          {trend.basis === "composition"
            ? " variação de massa separada em gordura e magra pela bioimpedância"
            : " variação de peso a 7.700 kcal/kg (sem composição na janela)"}
          . Estimativa, não calorimetria.
        </p>
      </div>
    </>
  )
}
