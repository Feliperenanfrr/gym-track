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
  fixed,
  formatDelta,
  Kpis,
  ReportHead,
  Section,
  Sheet,
} from "@/components/report/report-ui"
import type { CoachReport, DataConfidence } from "@/lib/reports"
import { formatFullDate } from "@/lib/reports"

const int = (value: number) => Math.round(value).toLocaleString("pt-BR")
const one = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

function hours(minutes: number): string {
  const rounded = Math.round(minutes)
  return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, "0")}`
}

const CONFIDENCE_LABEL: Record<DataConfidence, string> = {
  alta: "alta",
  moderada: "moderada",
  baixa: "baixa",
}

const STATUS_LABEL: Record<CoachReport["periodStatus"], string> = {
  concluido: "bloco concluído",
  parcial: "recorte parcial",
  "janela-movel": "janela móvel",
}

function Confidence({ value }: { value: DataConfidence }) {
  return (
    <span className={`report-confidence report-confidence-${value}`}>
      {CONFIDENCE_LABEL[value]}
    </span>
  )
}

function Continuation({ label }: { label: string }) {
  return (
    <div className="report-continuation">
      <b>GYM//TRACK</b>
      <span>Dossiê para o preparador físico · {label}</span>
    </div>
  )
}

function valueOrDash(value: number | null, suffix = "", decimals = 1) {
  return value === null ? "—" : `${fixed(value, decimals)}${suffix}`
}

/**
 * Dossiê de passagem para o profissional que vai reavaliar e reconstruir o
 * plano. Os dados são organizados para decisão, sem produzir uma prescrição
 * automática nem promover estimativas de calorias a achados físicos.
 */
export function CoachReportSheet({ report }: { report: CoachReport }) {
  const { training, body, conditioning, recovery } = report
  const composition = body.mass.filter((point) => point.fatKg !== null && point.leanKg !== null)

  return (
    <Sheet>
      <ReportHead
        title="Dossiê para o preparador físico"
        period={`${formatFullDate(report.period.from)} - ${formatFullDate(report.period.to)}`}
        extra={`${report.days} dias · ${STATUS_LABEL[report.periodStatus]}`}
      />

      <div className="report-brief">
        <div>
          <b>Finalidade</b>
          <p>{report.purpose}</p>
        </div>
        <div>
          <b>Pedido ao profissional</b>
          <p>Avaliar o histórico, definir testes e refazer a estrutura do próximo ciclo.</p>
        </div>
        <div>
          <b>Programa selecionado</b>
          <p>{report.program === "bjj" ? "Preparação para jiu-jitsu" : "Hipertrofia"}</p>
        </div>
      </div>
      <p className="report-note">
        Objetivo detalhado, disponibilidade semanal, histórico de lesões e restrições não
        estão cadastrados. Devem ser confirmados na anamnese antes da prescrição.
      </p>

      <Section title="Qualidade dos registros" aside="confiança para interpretar">
        <div className="report-quality-grid">
          {report.quality.map((item) => (
            <div key={item.domain}>
              <span>{item.domain}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
              <Confidence value={item.confidence} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Exposição de treino">
        <Kpis
          items={[
            { label: "Sessões", value: int(training.sessions), unit: `· ${one(training.sessionsPerWeek)}/sem` },
            { label: "Dias ativos", value: int(training.activeDays), unit: `de ${report.days}` },
            { label: "Tempo registrado", value: hours(training.totalDurationMin) },
            { label: "Musculação", value: int(training.strengthSessions), unit: "sessões" },
            { label: "Com cardio", value: int(training.conditioningSessions), unit: "sessões" },
            {
              label: "sRPE médio",
              value: training.avgSrpe !== null ? fixed(training.avgSrpe) : "—",
              unit: `${training.srpeCoveragePct}% coberto`,
            },
            { label: "Carga interna", value: int(training.totalLoad), unit: "AU" },
            { label: "Carga média", value: int(training.loadPerWeek), unit: "AU/sem" },
          ]}
        />

        <table className="report-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Tipo de sessão</th>
              <th>Sessões</th>
              <th>Tempo</th>
              <th>Carga interna</th>
            </tr>
          </thead>
          <tbody>
            {training.sessionTypes.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td>{row.sessions}</td>
                <td>{hours(row.durationMin)}</td>
                <td>{int(row.load)} AU</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Carga semana a semana" aside="sRPE × duração; fallback documentado">
        <ReportColumns
          data={report.weekly.map((week) => ({ label: week.label, a: week.load }))}
          series={[{ label: "Carga interna", color: PRINT.lift }]}
          height={138}
          format={(value) => int(value)}
        />
        <ReportLegend
          items={[{ label: "carga interna semanal (AU)", color: PRINT.lift }]}
        />
        <p className="report-note">
          Quando há sRPE, carga = esforço da sessão × duração. Registros sem sRPE usam
          aproximação por tonelagem ou finalidade do cardio; por isso a série descreve
          exposição, não prontidão nem risco de lesão.
        </p>
      </Section>

      <div className="report-page-break">
      <Continuation label="desempenho" />
      <Section title="Desempenho de força" aside="exercícios mais repetidos">
        {report.lifts.length > 0 ? (
          <>
            <table className="report-table report-lifts-table">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Sessões</th>
                  <th>Base</th>
                  <th>Recente</th>
                  <th>Δ</th>
                  <th>Melhor</th>
                  <th>Conf.</th>
                </tr>
              </thead>
              <tbody>
                {report.lifts.map((lift) => (
                  <tr key={lift.exerciseId}>
                    <td>
                      {lift.name}
                      <small>
                        {formatFullDate(lift.firstDate)} - {formatFullDate(lift.lastDate)}
                        {lift.variantChanged ? " · variante mudou" : ""}
                      </small>
                    </td>
                    <td>{lift.sessions}</td>
                    <td>{fixed(lift.baseE1rm)} kg</td>
                    <td>{fixed(lift.recentE1rm)} kg</td>
                    <td className={deltaClass(lift.deltaPct, "up")}>
                      {lift.deltaPct !== null ? `${formatDelta(lift.deltaPct)}%` : "—"}
                    </td>
                    <td>{fixed(lift.bestE1rm)} kg</td>
                    <td><Confidence value={lift.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-note">
              1RM estimada por Epley com RIR, apenas em séries de 1 a 12 repetições.
              Base e recente usam a média das duas primeiras e duas últimas exposições
              quando há quatro ou mais sessões. Mudança de variante invalida o delta.
            </p>
          </>
        ) : (
          <p className="report-note">Sem exercício repetido o suficiente para comparação.</p>
        )}
      </Section>

      {report.muscles.length > 0 && (
        <Section title="Distribuição do treino de força" aside="séries diretas por semana">
          <ReportHBars
            rows={report.muscles.map((muscle) => ({
              label: muscle.group,
              value: muscle.perWeek,
            }))}
            color={PRINT.lift}
            format={(value) => one(value)}
          />
          <p className="report-note">
            Série direta = RIR 0 a 3, ou série antiga sem RIR. Cada exercício é atribuído
            ao grupo principal; compostos não são duplicados em músculos auxiliares. Não
            há linha de “mínimo universal”: o volume deve ser julgado contra o objetivo,
            a fase e a prática esportiva.
          </p>
        </Section>
      )}

      <Section title="Resumo semanal para leitura do preparador">
        <table className="report-table">
          <thead>
            <tr>
              <th>Semana</th>
              <th>Sessões</th>
              <th>Força</th>
              <th>Tempo</th>
              <th>Carga</th>
              <th>Z2</th>
              <th>Intenso</th>
              <th>Esporte</th>
            </tr>
          </thead>
          <tbody>
            {report.weekly.map((week) => (
              <tr key={week.key}>
                <td>{week.label}</td>
                <td>{week.sessions}</td>
                <td>{week.strengthSessions}</td>
                <td>{week.durationMin} min</td>
                <td>{int(week.load)}</td>
                <td>{week.z2Minutes} min</td>
                <td>{week.intenseMinutes} min</td>
                <td>{week.sportMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      </div>

      <div className="report-page-break">
      <Continuation label="corpo e recuperação" />
      <Section title="Composição corporal" aside={`${body.weightPoints} pesagens`}>
        {body.mass.length > 0 ? (
          <>
            <div className="report-sparks">
              <div>
                <ReportSpark
                  points={body.mass.map((point) => ({ label: point.label, value: point.weightKg }))}
                  color={PRINT.ink}
                  title="Peso"
                  unit="kg"
                />
              </div>
              <div>
                <ReportSpark
                  points={composition.map((point) => ({ label: point.label, value: point.fatKg! }))}
                  color={PRINT.fat}
                  title="Massa de gordura"
                  unit="kg"
                />
              </div>
              <div>
                <ReportSpark
                  points={composition.map((point) => ({ label: point.label, value: point.leanKg! }))}
                  color={PRINT.lean}
                  title="Massa livre de gordura"
                  unit="kg"
                />
              </div>
            </div>
            <div className="report-cols-2" style={{ marginTop: 10 }}>
              <table className="report-table">
                <tbody>
                  <tr>
                    <td>Tendência de peso</td>
                    <td>{valueOrDash(body.trend.weightKgPerWeek, " kg/sem", 2)}</td>
                  </tr>
                  <tr>
                    <td>Tendência de gordura</td>
                    <td>{valueOrDash(body.trend.fatKgPerWeek, " kg/sem", 2)}</td>
                  </tr>
                  <tr>
                    <td>Tendência de massa livre</td>
                    <td>{valueOrDash(body.trend.leanKgPerWeek, " kg/sem", 2)}</td>
                  </tr>
                  <tr>
                    <td>Cintura, primeira ponta</td>
                    <td>{valueOrDash(body.waistStartCm, " cm")}</td>
                  </tr>
                  <tr>
                    <td>Cintura, ponta recente</td>
                    <td>{valueOrDash(body.waistEndCm, " cm")}</td>
                  </tr>
                </tbody>
              </table>
              <table className="report-table">
                <tbody>
                  <tr>
                    <td>Bioimpedâncias</td>
                    <td>{body.compositionPoints}</td>
                  </tr>
                  <tr>
                    <td>Medidas de cintura</td>
                    <td>{body.waistPoints}</td>
                  </tr>
                  <tr>
                    <td>Variação de cintura</td>
                    <td>{valueOrDash(body.waistDeltaCm, " cm")}</td>
                  </tr>
                  <tr>
                    <td>Último peso</td>
                    <td>{body.latest?.weightKg ? `${fixed(body.latest.weightKg)} kg` : "—"}</td>
                  </tr>
                  <tr>
                    <td>Última gordura corporal</td>
                    <td>{body.latest?.bodyFatPct ? `${fixed(body.latest.bodyFatPct)}%` : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="report-note">
              Tendências por regressão sobre o período. Bioimpedância doméstica é
              sensível a hidratação, horário, alimentação e exercício; interpretar como
              direção, não como medição clínica de pequenas diferenças.
            </p>
          </>
        ) : (
          <p className="report-note">Sem pesagem no período.</p>
        )}
      </Section>

      <div className="report-cols-2">
        <Section title="Condicionamento" aside={`${conditioning.blocks} blocos`}>
          <table className="report-table">
            <tbody>
              <tr><td>Cardio total</td><td>{conditioning.totalMinutes} min</td></tr>
              <tr><td>Média semanal</td><td>{conditioning.minutesPerWeek} min/sem</td></tr>
              <tr><td>Zona 2 registrada</td><td>{conditioning.z2Minutes} min</td></tr>
              <tr><td>Intenso declarado</td><td>{conditioning.intenseMinutes} min</td></tr>
              <tr><td>Esporte/tatame</td><td>{conditioning.sportMinutes} min</td></tr>
              <tr>
                <td>Frequência cardíaca</td>
                <td>
                  {conditioning.avgBpm !== null ? `${conditioning.avgBpm} bpm` : "—"}
                  {` · ${conditioning.bpmCoveragePct}% coberto`}
                </td>
              </tr>
              <tr><td>Distância registrada</td><td>{fixed(conditioning.distanceKm)} km</td></tr>
              <tr><td>Finalidade inferida</td><td>{conditioning.inferredPurposeBlocks} blocos</td></tr>
            </tbody>
          </table>
          <p className="report-note">
            “Zona 2” segue a finalidade registrada. Em blocos antigos sem finalidade, o
            sistema infere pelo tipo da sessão; não há FC máxima ou limiar individual
            cadastrado para validar a zona fisiológica.
          </p>
        </Section>

        <Section title="Recuperação" aside="cobertura antes da média">
          <table className="report-table">
            <tbody>
              <tr>
                <td>Sono registrado</td>
                <td>{recovery.sleep.nights}/{report.days} noites · {recovery.sleep.coveragePct}%</td>
              </tr>
              <tr><td>Sono médio</td><td>{recovery.sleep.avgMinutes !== null ? hours(recovery.sleep.avgMinutes) : "—"}</td></tr>
              <tr><td>Sono mediano</td><td>{recovery.sleep.medianMinutes !== null ? hours(recovery.sleep.medianMinutes) : "—"}</td></tr>
              <tr><td>Noites abaixo de 7h</td><td>{recovery.sleep.nightsUnder7h}</td></tr>
              <tr><td>Desvio do ponto médio</td><td>{recovery.sleep.midpointDriftMin !== null ? `${recovery.sleep.midpointDriftMin} min` : "—"}</td></tr>
              <tr>
                <td>Hidratação registrada</td>
                <td>{recovery.hydration.days}/{report.days} dias · {recovery.hydration.coveragePct}%</td>
              </tr>
              <tr><td>Água mediana</td><td>{recovery.hydration.medianMl !== null ? `${fixed(recovery.hydration.medianMl / 1000)} L` : "—"}</td></tr>
              <tr><td>Dias na referência</td><td>{recovery.hydration.daysAtGoal}/{recovery.hydration.days}</td></tr>
            </tbody>
          </table>
          <p className="report-note">
            Ausência de registro é tratada como dado desconhecido, nunca como zero. A
            referência de água é basal e não substitui avaliação da taxa de suor.
          </p>
        </Section>
      </div>

      <Section title="Pontos para discutir na anamnese">
        <ol className="report-questions">
          {report.questions.map((question) => <li key={question}>{question}</li>)}
        </ol>
      </Section>

      <p className="report-foot">
        Escopo: histórico de treino, carga interna, desempenho, composição corporal,
        condicionamento e recuperação. Tonelagem e gasto calórico não são usados como
        desfechos principais. O documento organiza evidência para avaliação profissional;
        não contém prescrição automática e não substitui anamnese, exame físico ou
        avaliação clínica.
      </p>
      </div>
    </Sheet>
  )
}
