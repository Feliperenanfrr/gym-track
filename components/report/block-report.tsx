"use client"

import {
  PRINT,
  ReportColumns,
  ReportHBars,
  ReportLegend,
  ReportSpark,
} from "@/components/report/report-charts"
import {
  deltaClass,
  Findings,
  fixed,
  formatDelta,
  Kpis,
  ReportHead,
  Section,
  Sheet,
} from "@/components/report/report-ui"
import type { BlockReport } from "@/lib/reports"
import { formatFullDate } from "@/lib/reports"

const int = (n: number) => Math.round(n).toLocaleString("pt-BR")
const one = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

const READINESS_LABEL = {
  building: "construindo base",
  green: "dentro da base",
  yellow: "acima da base",
  red: "bem acima da base",
} as const

/**
 * Fechamento de bloco: o documento que se lê uma vez a cada mesociclo e se
 * guarda. O painel responde "como estou hoje"; empilhar seis destes responde
 * "o bloco de maio rendeu mais que o de agosto?", que nenhuma tela responde.
 */
export function BlockReportSheet({ report }: { report: BlockReport }) {
  const { totals, windows, energy } = report
  const z2PerWeek = Math.round(totals.z2Minutes / report.weeks)
  const withComposition = report.mass.filter((p) => p.fatKg !== null && p.leanKg !== null)

  return (
    <Sheet>
      <ReportHead
        title={`Fechamento · ${report.period.label}`}
        period={`${formatFullDate(report.period.from)} – ${formatFullDate(report.period.to)}`}
        extra={`${report.weeks.toLocaleString("pt-BR")} semanas · programa ${
          report.program === "bjj" ? "jiu-jitsu" : "hipertrofia"
        }`}
      />

      <Section title="Resumo do bloco">
        <Kpis
          items={[
            { label: "Sessões", value: int(totals.sessions), unit: `· ${one(totals.sessionsPerWeek)}/sem` },
            { label: "Tonelagem", value: one(totals.volumeKg / 1000), unit: "t" },
            { label: "Séries duras", value: int(totals.hardSets) },
            { label: "PRs", value: int(totals.prCount) },
            { label: "Zona 2", value: int(totals.z2Minutes), unit: "min" },
            { label: "Cardio total", value: int(totals.cardioMinutes), unit: "min" },
            { label: "Gasto estimado", value: int(totals.kcal), unit: "kcal" },
            {
              label: "Prontidão final",
              value:
                report.readiness.ratio !== null
                  ? report.readiness.ratio.toFixed(2).replace(".", ",")
                  : "—",
              unit: READINESS_LABEL[report.readiness.level],
            },
          ]}
        />
      </Section>

      <Section
        title="Força — 1RM estimada"
        aside={`pontas de ${windows.windowDays} dias`}
      >
        <table className="report-table">
          <thead>
            <tr>
              <th>Exercício</th>
              <th>Início</th>
              <th>Fim</th>
              <th>Δ</th>
              <th>Melhor série</th>
              <th>Sessões</th>
            </tr>
          </thead>
          <tbody>
            {report.lifts.map((lift) => (
              <tr key={lift.id}>
                <td>{lift.label}</td>
                <td>{lift.start !== null ? fixed(lift.start) : "—"}</td>
                <td>{lift.end !== null ? fixed(lift.end) : "—"}</td>
                <td className={deltaClass(lift.deltaPct, "up")}>
                  {lift.deltaPct !== null ? `${formatDelta(lift.deltaPct)}%` : "—"}
                </td>
                <td>
                  {lift.best ? `${one(lift.best.weight)} × ${lift.best.reps}` : "—"}
                </td>
                <td>{lift.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="report-note">
          1RM estimada por Epley com ajuste por RIR quando informado. Início e fim são
          a melhor série de cada ponta do bloco ({windows.windowDays} dias), não o
          melhor dia isolado — isso evita premiar um dia sortudo.
        </p>
      </Section>

      {report.body.length > 0 && (
        <Section title="Composição corporal" aside="média de cada ponta">
          {withComposition.length >= 2 && (
            <div className="report-sparks" style={{ marginBottom: 10 }}>
              <div>
                <ReportSpark
                  points={report.mass.map((p) => ({ label: p.label, value: p.weightKg }))}
                  color={PRINT.ink}
                  title="Peso"
                  unit="kg"
                />
              </div>
              <div>
                <ReportSpark
                  points={withComposition.map((p) => ({ label: p.label, value: p.fatKg! }))}
                  color={PRINT.fat}
                  title="Gordura"
                  unit="kg"
                />
              </div>
              <div>
                <ReportSpark
                  points={withComposition.map((p) => ({ label: p.label, value: p.leanKg! }))}
                  color={PRINT.lean}
                  title="Magra"
                  unit="kg"
                />
              </div>
            </div>
          )}
          <table className="report-table">
            <thead>
              <tr>
                <th>Medida</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {report.body.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.label}
                    {row.unit && ` (${row.unit})`}
                  </td>
                  <td>{row.start !== null ? fixed(row.start) : "—"}</td>
                  <td>{row.end !== null ? fixed(row.end) : "—"}</td>
                  <td className={deltaClass(row.delta, row.goal)}>
                    {formatDelta(row.delta, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {report.muscles.length > 0 && (
        <Section title="Volume por grupo muscular" aside="séries duras por semana">
          <ReportHBars
            rows={report.muscles.map((m) => ({ label: m.group, value: m.perWeek }))}
            color={PRINT.lift}
            reference={10}
            referenceLabel="mínimo 10"
            format={(v) => one(v)}
          />
          <p className="report-note">
            Série dura = RIR 0–3 (ou sem RIR registrado). A linha de 10 séries semanais
            é o piso usual para sustentar um grupo; abaixo dela o grupo tende a manter,
            não a crescer.
          </p>
        </Section>
      )}

      <Section title="Semana a semana" breakBefore>
        <ReportColumns
          data={report.weekly.map((week) => ({
            label: week.label,
            a: week.volumeKg,
          }))}
          series={[{ label: "Tonelagem", color: PRINT.lift }]}
          height={130}
          format={(v) => `${Math.round(v / 1000)}t`}
        />
        <ReportLegend
          items={[{ label: "Tonelagem por semana (kg movimentados)", color: PRINT.lift }]}
        />

        <div style={{ marginTop: 12 }}>
          <ReportColumns
            data={report.weekly.map((week) => ({
              label: week.label,
              a: week.z2Minutes,
              b: week.intenseMinutes,
            }))}
            series={[
              { label: "Zona 2", color: PRINT.cardio },
              { label: "Intenso", color: PRINT.lift },
            ]}
            height={120}
            format={(v) => `${Math.round(v)}`}
          />
          <ReportLegend
            items={[
              { label: "Zona 2 (min)", color: PRINT.cardio, value: int(totals.z2Minutes) },
              { label: "Intenso (min)", color: PRINT.lift, value: int(totals.intenseMinutes) },
            ]}
          />
          <p className="report-note">
            Média de {z2PerWeek} min de Zona 2 por semana no bloco.
          </p>
        </div>
      </Section>

      {report.massTrend.storedKcalPerDay !== null && (
        <Section title="Energia do bloco">
          <div className="report-cols-2">
            <div>
              <table className="report-table">
                <tbody>
                  <tr>
                    <td>Variação de peso</td>
                    <td>
                      {report.massTrend.weightKgPerWeek !== null
                        ? `${formatDelta(report.massTrend.weightKgPerWeek, 2)} kg/sem`
                        : "—"}
                    </td>
                  </tr>
                  {report.massTrend.fatKgPerWeek !== null && (
                    <tr>
                      <td>Massa de gordura</td>
                      <td>{formatDelta(report.massTrend.fatKgPerWeek, 2)} kg/sem</td>
                    </tr>
                  )}
                  {report.massTrend.leanKgPerWeek !== null && (
                    <tr>
                      <td>Massa magra</td>
                      <td>{formatDelta(report.massTrend.leanKgPerWeek, 2)} kg/sem</td>
                    </tr>
                  )}
                  <tr>
                    <td>Saldo energético médio</td>
                    <td>{formatDelta(report.massTrend.storedKcalPerDay, 0)} kcal/dia</td>
                  </tr>
                  {energy.budget && (
                    <tr>
                      <td>Manutenção estimada</td>
                      <td>{int(energy.budget.tdee)} kcal/dia</td>
                    </tr>
                  )}
                  {energy.intake !== null && (
                    <tr>
                      <td>Ingestão estimada</td>
                      <td>{int(energy.intake)} kcal/dia</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <ReportColumns
                data={report.weekly.map((week) => ({ label: week.label, a: week.kcal }))}
                series={[{ label: "Gasto com treino", color: PRINT.cardio }]}
                width={330}
                height={130}
                format={(v) => (v >= 1000 ? `${one(v / 1000)}k` : String(Math.round(v)))}
              />
              <ReportLegend
                items={[{ label: "Gasto com treino por semana (kcal)", color: PRINT.cardio }]}
              />
            </div>
          </div>
          <p className="report-note">{energy.verdict}</p>
        </Section>
      )}

      {totals.prs.length > 0 && (
        <Section title="Recordes do bloco" aside={`${totals.prCount} PRs`}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Exercício</th>
                <th>PRs no bloco</th>
                <th>Último</th>
              </tr>
            </thead>
            <tbody>
              {totals.prs.map((pr) => (
                <tr key={pr.exerciseId}>
                  <td>{pr.name}</td>
                  <td>{pr.count}</td>
                  <td>{formatFullDate(pr.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="report-note">
            PR = 1RM estimada acima de todo o histórico anterior do exercício. Num bloco
            com progressão de carga isso acontece quase toda sessão, então a leitura útil
            é a contagem por exercício, não a lista de datas.
          </p>
        </Section>
      )}

      <Section title="Leitura do bloco">
        <Findings highlights={report.highlights} gaps={report.gaps} />
      </Section>

      <p className="report-foot">
        Calorias estimadas por METs a partir do peso da época, duração real e esforço
        percebido — estimativa, não calorimetria. Tonelagem = carga × repetições. A
        prontidão é a razão entre a carga interna dos últimos 7 dias e a média das 3
        semanas anteriores. Documento gerado pelo GYM//TRACK a partir dos registros do
        período.
      </p>
    </Sheet>
  )
}
