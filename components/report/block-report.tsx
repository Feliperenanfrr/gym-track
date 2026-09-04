"use client"

import {
  PRINT,
  ReportCalendarStrip,
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
import { formatDayMonth, formatFullDate } from "@/lib/reports"
import { RELATIVE_LOAD_ALERT_PCT } from "@/lib/strength"

const int = (n: number) => Math.round(n).toLocaleString("pt-BR")
const one = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

/**
 * Fechamento de bloco: o documento que se lê uma vez a cada mesociclo e se
 * guarda. O painel responde "como estou hoje"; empilhar seis destes responde
 * "o bloco de maio rendeu mais que o de agosto?", que nenhuma tela responde.
 *
 * A manchete deixou de ser tonelagem. Num histórico com lacunas de duas
 * semanas, 121 t e 274 séries duras descrevem o que foi feito e escondem o
 * fato maior — dezessete dias parado e a carga de volta a 60% do recorde. A
 * constância abre o documento; o volume vem depois, já lido contra ela.
 */
export function BlockReportSheet({ report }: { report: BlockReport }) {
  const { totals, windows, energy, consistency } = report
  const z2PerWeek = Math.round(totals.z2Minutes / report.weeks)
  const withComposition = report.mass.filter((p) => p.fatKg !== null && p.leanKg !== null)
  const calendar = report.calendar

  return (
    <Sheet>
      <ReportHead
        title={`Fechamento · ${report.period.label}`}
        period={`${formatFullDate(report.period.from)} – ${formatFullDate(report.period.to)}`}
        extra={`${report.weeks.toLocaleString("pt-BR")} semanas · programa ${
          report.program === "engine" ? "motor aeróbico" : "hipertrofia"
        }`}
      />

      <Section title="Resumo do bloco">
        <Kpis
          items={[
            {
              label: "Sessões",
              value: int(totals.sessions),
              unit: `· ${one(totals.sessionsPerWeek)}/sem`,
            },
            {
              label: "Dias treinados",
              value: int(consistency.daysTrained),
              unit: `de ${consistency.daysInPeriod} · ${consistency.adherencePct}%`,
            },
            {
              label: "Maior lacuna",
              value: int(consistency.longestGapDays),
              unit: "dias sem treino",
            },
            {
              label: "Semanas no alvo",
              value: `${consistency.weeksOnTarget}/${consistency.weeks}`,
              unit: "do programa",
            },
            { label: "Tonelagem", value: one(totals.volumeKg / 1000), unit: "t" },
            { label: "Séries duras", value: int(totals.hardSets) },
            { label: "Zona 2", value: int(totals.z2Minutes), unit: "min" },
            { label: "Gasto estimado", value: int(totals.kcal), unit: "kcal" },
          ]}
        />
        <p className="report-note">
          Sessões são todos os registros do período, inclusive avulsos e importados;{" "}
          {totals.plannedSessions} deles casam com o plano do programa ativo. Dias
          treinados conta dias distintos — duas sessões no mesmo dia são um dia. A
          mesma régua vale em todas as tabelas deste documento.
        </p>
      </Section>

      {calendar.length > 0 && (
        <Section title="Constância" aside="cada quadrado é um dia">
          <div className="report-side">
            <ReportCalendarStrip weeks={calendar} />
            <div>
              <ReportLegend
                items={[
                  { label: "musculação", color: PRINT.lift },
                  { label: "cardio", color: PRINT.cardio },
                  { label: "os dois", color: PRINT.ink },
                  { label: "sem treino", color: "#ececea" },
                ]}
              />
              <table className="report-table" style={{ marginTop: 6 }}>
                <tbody>
                  <tr>
                    <td>Dias com treino</td>
                    <td>
                      {consistency.daysTrained} de {consistency.daysInPeriod} ·{" "}
                      {consistency.adherencePct}%
                    </td>
                  </tr>
                  <tr>
                    <td>Média semanal</td>
                    <td>{one(consistency.avgDaysPerWeek)} dias/semana</td>
                  </tr>
                  <tr>
                    <td>Maior lacuna</td>
                    <td>
                      {consistency.longestGapDays > 0 && consistency.longestGapFrom
                        ? `${consistency.longestGapDays} dias · ${formatDayMonth(
                            consistency.longestGapFrom
                          )} a ${formatDayMonth(consistency.longestGapTo!)}`
                        : "sem lacuna"}
                    </td>
                  </tr>
                  <tr>
                    <td>Lacunas de 7 dias ou mais</td>
                    <td>{consistency.gaps.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {report.lifts.length > 0 && (
        <Section title="Força — carga do top set" aside="primeira × última sessão">
          <table className="report-table report-lifts-table">
            <thead>
              <tr>
                <th>Exercício</th>
                <th>Sessões</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Δ</th>
                <th>Recorde</th>
                <th>% dele</th>
              </tr>
            </thead>
            <tbody>
              {report.lifts.map((lift) => (
                <tr key={lift.exerciseId}>
                  <td>
                    {lift.name}
                    <small>
                      {formatDayMonth(lift.firstDate)} – {formatDayMonth(lift.lastDate)}
                      {lift.variantChanged ? " · variante mudou" : ""}
                    </small>
                  </td>
                  <td>{lift.sessions}</td>
                  <td>
                    {one(lift.firstWeight)} × {lift.firstReps}
                  </td>
                  <td>
                    {one(lift.lastWeight)} × {lift.lastReps}
                  </td>
                  <td
                    className={
                      lift.variantChanged ? "flat" : deltaClass(lift.deltaKg, "up")
                    }
                  >
                    {lift.variantChanged ? "—" : `${formatDelta(lift.deltaKg)} kg`}
                  </td>
                  <td>{one(lift.bestWeight)}</td>
                  <td className={lift.relativePct < RELATIVE_LOAD_ALERT_PCT ? "down" : "flat"}>
                    {lift.relativePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="report-note">
            A medida é a carga da série mais pesada de cada sessão, não a 1RM estimada:
            em séries de 12 a 15 repetições o erro da extrapolação de Epley fica maior
            que o efeito que se quer enxergar — a mesma cadeira extensora chega a
            oscilar 50 kg estimados entre duas semanas sem que nada disso tenha
            acontecido. Os exercícios saem do próprio histórico do bloco, por frequência.
            &ldquo;% dele&rdquo; é a última carga sobre o recorde do período.
          </p>
        </Section>
      )}

      {report.relativeLoad.length > 0 && (
        <Section title="Carga contra o próprio recorde" aside="última sessão de cada exercício">
          <ReportHBars
            rows={report.relativeLoad.map((row) => ({
              label: row.name,
              value: row.relativePct,
            }))}
            color={(row) => (row.value < RELATIVE_LOAD_ALERT_PCT ? PRINT.fat : PRINT.lift)}
            labelWidth={168}
            max={100}
            reference={RELATIVE_LOAD_ALERT_PCT}
            referenceLabel={`${RELATIVE_LOAD_ALERT_PCT}%`}
            format={(v) => `${Math.round(v)}%`}
          />
          <p className="report-note">
            Cem por cento é a maior carga já registrada no período. Abaixo de{" "}
            {RELATIVE_LOAD_ALERT_PCT}% não é platô: é distância do que já foi levantado,
            e pede voltar progressivamente em vez de trocar o estímulo.
          </p>
        </Section>
      )}

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
          <p className="report-note">
            Cada ponta é a MÉDIA das medições de {windows.windowDays} dias, não a
            medição isolada: a balança oscila cerca de 1 kg com água e sal.
          </p>
        </Section>
      )}

      {report.muscles.length > 0 && (
        <Section title="Volume por grupo muscular" aside="séries duras por semana" breakBefore>
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

      <Section title="Semana a semana">
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

        <table className="report-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Sessões</th>
              <th>No plano</th>
              <th>Alvo</th>
              <th>Dias</th>
              <th>Tonelagem</th>
              <th>Séries</th>
              <th>Cardio</th>
            </tr>
          </thead>
          <tbody>
            {report.weekly.map((week) => (
              <tr key={week.key}>
                <td>{week.label}</td>
                <td>{week.sessions}</td>
                <td className={week.onTarget ? "up" : "flat"}>{week.plannedSessions}</td>
                <td>{week.target}</td>
                <td>{week.days}</td>
                <td>{one(week.volumeKg / 1000)} t</td>
                <td>{week.hardSets}</td>
                <td>{week.z2Minutes + week.intenseMinutes + week.sportMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            PR = 1RM estimada acima de todo o histórico anterior do exercício, e o
            histórico começa quando o app começou. Um bloco pode ter muitos PRs e
            terminar com a carga longe do recorde — leia esta tabela junto da seção de
            carga contra o próprio recorde, nunca sozinha.
          </p>
        </Section>
      )}

      <Section title="Leitura do bloco">
        <Findings highlights={report.highlights} gaps={report.gaps} />
      </Section>

      <p className="report-foot">
        Calorias estimadas por METs a partir do peso da época, duração real e esforço
        percebido — estimativa, não calorimetria. Tonelagem = carga × repetições. Séries
        duras contam RIR 0–3. Documento gerado pelo GYM//TRACK a partir dos registros do
        período.
      </p>
    </Sheet>
  )
}
