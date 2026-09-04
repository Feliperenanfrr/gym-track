"use client"

import {
  PRINT,
  ReportRangeBar,
  ReportSpark,
} from "@/components/report/report-charts"
import {
  fixed,
  formatDelta,
  Kpis,
  ReportHead,
  Section,
  Sheet,
} from "@/components/report/report-ui"
import type { HealthMarker, HealthReport, MarkerStatus } from "@/lib/reports"
import { formatFullDate } from "@/lib/reports"

const int = (n: number) => Math.round(n).toLocaleString("pt-BR")
const one = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

function hours(minutes: number): string {
  const rounded = Math.round(minutes)
  return `${Math.floor(rounded / 60)}h${String(rounded % 60).padStart(2, "0")}`
}

const STATUS_LABEL: Record<MarkerStatus, string> = {
  ideal: "na faixa",
  atencao: "acima da faixa",
  alerta: "muito acima",
  desconhecido: "sem faixa",
}

const STATUS_CLASS: Record<MarkerStatus, string> = {
  ideal: "report-confidence-alta",
  atencao: "report-confidence-moderada",
  alerta: "report-confidence-baixa",
  desconhecido: "report-confidence-neutra",
}

/** Escala de cada barra de faixa — o desenho precisa de um começo e um fim. */
const SCALES: Record<string, { min: number; max: number; elevated: number; high: number }> = {
  waist: { min: 70, max: 120, elevated: 94, high: 102 },
  bmi: { min: 18, max: 40, elevated: 25, high: 30 },
  fatPct: { min: 5, max: 40, elevated: 20, high: 25 },
  visceral: { min: 1, max: 25, elevated: 10, high: 15 },
}

function MarkerRow({ marker }: { marker: HealthMarker }) {
  const scale = SCALES[marker.key]
  return (
    <tr>
      <td>
        {marker.label}
        <small>
          {marker.reference} · {marker.source}
          {marker.measuredAt ? ` · medido em ${formatFullDate(marker.measuredAt)}` : ""}
        </small>
      </td>
      <td>
        {marker.value !== null ? `${one(marker.value)} ${marker.unit}` : "—"}
      </td>
      <td className={marker.delta === null ? "flat" : marker.delta <= 0 ? "up" : "down"}>
        {marker.delta !== null ? formatDelta(marker.delta, 1) : "—"}
      </td>
      <td style={{ width: 160 }}>
        {scale ? (
          <ReportRangeBar
            value={marker.value}
            min={scale.min}
            max={scale.max}
            elevated={scale.elevated}
            high={scale.high}
            format={(v) => one(v)}
          />
        ) : (
          "—"
        )}
      </td>
      <td>
        <span className={`report-confidence ${STATUS_CLASS[marker.status]}`}>
          {STATUS_LABEL[marker.status]}
        </span>
      </td>
    </tr>
  )
}

/**
 * Resumo de saúde: uma página para levar ao consultório.
 *
 * O app media cintura, IMC, percentual de gordura e gordura visceral desde o
 * começo, e nenhum documento os juntava nem dizia a faixa em que caem — a
 * cintura vivia numa linha da tabela de composição do fechamento, a visceral
 * como número solto no perfil da nutrição. Sem o ponto de corte ao lado, "102"
 * e "17" não são informação.
 *
 * Não há diagnóstico aqui, nem escore de risco: há medida, tendência, faixa de
 * referência e a origem da faixa, para a conversa acontecer com quem pode
 * interpretá-la.
 */
export function HealthReportSheet({ report }: { report: HealthReport }) {
  const { activity, sleep, hydration, trend } = report
  const weight = report.markers.find((marker) => marker.key === "weight")

  return (
    <Sheet>
      <ReportHead
        title="Resumo de saúde"
        period={`${formatFullDate(report.period.from)} – ${formatFullDate(report.period.to)}`}
        extra={`${report.days} dias · ${report.weeks.toLocaleString("pt-BR")} semanas`}
      />

      <p className="report-lead">
        Medidas de composição corporal, atividade física, sono e hidratação registradas
        no período, com as faixas de referência ao lado. <b>Não é avaliação clínica</b>:
        peso, gordura e água vêm de balança de bioimpedância doméstica, a cintura de
        fita métrica, e nada aqui substitui exame, anamnese ou laboratório.
      </p>

      <Section title="Marcadores" aside="valor, direção no período e faixa">
        <table className="report-table report-lifts-table">
          <thead>
            <tr>
              <th>Marcador</th>
              <th>Atual</th>
              <th>Δ no período</th>
              <th>Faixa</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {report.markers.map((marker) => (
              <MarkerRow key={marker.key} marker={marker} />
            ))}
          </tbody>
        </table>
        <p className="report-note">
          O Δ compara o valor atual com a média da primeira ponta do período, não com a
          medição isolada mais antiga. Verde é a faixa desejável, amarelo o risco
          aumentado e vermelho o risco muito aumentado da referência citada em cada
          linha. O peso não tem faixa própria: entra pela tendência.
        </p>
      </Section>

      <Section title="Tendência no período" aside="regressão sobre todas as medições">
        <div className="report-sparks">
          {report.weightSeries.length >= 2 && (
            <div>
              <ReportSpark
                points={report.weightSeries}
                color={PRINT.ink}
                title="Peso"
                unit="kg"
              />
            </div>
          )}
          {report.waistSeries.length >= 2 && (
            <div>
              <ReportSpark
                points={report.waistSeries}
                color={PRINT.fat}
                title="Cintura"
                unit="cm"
              />
            </div>
          )}
        </div>
        <table className="report-table" style={{ marginTop: 8 }}>
          <tbody>
            <tr>
              <td>Peso</td>
              <td>
                {trend.weightKgPerWeek !== null
                  ? `${formatDelta(trend.weightKgPerWeek, 2)} kg/semana`
                  : "—"}
              </td>
              <td>Pesagens no período</td>
              <td>{trend.points}</td>
            </tr>
            <tr>
              <td>Massa de gordura</td>
              <td>
                {trend.fatKgPerWeek !== null
                  ? `${formatDelta(trend.fatKgPerWeek, 2)} kg/semana`
                  : "—"}
              </td>
              <td>Massa magra</td>
              <td>
                {trend.leanKgPerWeek !== null
                  ? `${formatDelta(trend.leanKgPerWeek, 2)} kg/semana`
                  : "—"}
              </td>
            </tr>
            <tr>
              <td>Cintura</td>
              <td>
                {report.waistSeries.length >= 2
                  ? `${one(report.waistSeries[0].value)} → ${one(
                      report.waistSeries[report.waistSeries.length - 1].value
                    )} cm`
                  : "—"}
              </td>
              <td>Peso atual</td>
              <td>{weight?.value !== null && weight ? `${one(weight.value!)} kg` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Atividade física" aside="contra a recomendação para adultos">
        <Kpis
          items={[
            {
              label: "Aeróbico",
              value: int(activity.cardioMinutesPerWeek),
              unit: "min/sem · meta 150",
            },
            {
              label: "Zona 2",
              value: int(activity.z2MinutesPerWeek),
              unit: "min/sem",
            },
            {
              label: "Força",
              value: one(activity.strengthSessionsPerWeek),
              unit: "sessões/sem · meta 2",
            },
            {
              label: "Dias treinados",
              value: `${activity.adherencePct}%`,
              unit: `maior lacuna ${activity.longestGapDays} d`,
            },
          ]}
        />
        <table className="report-table" style={{ marginTop: 8 }}>
          <tbody>
            <tr>
              <td>150 min/semana de atividade aeróbica moderada</td>
              <td className={activity.meetsAerobic ? "up" : "down"}>
                {activity.meetsAerobic ? "atingido" : "não atingido"}
              </td>
            </tr>
            <tr>
              <td>2 sessões/semana de fortalecimento muscular</td>
              <td className={activity.meetsStrength ? "up" : "down"}>
                {activity.meetsStrength ? "atingido" : "não atingido"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="report-note">
          Metas de atividade física para adultos (OMS, 2020). O minuto aeróbico conta
          Zona 2, treino intenso, esporte e caminhadas importadas do relógio; a
          intensidade é a declarada no registro, sem teste de limiar.
        </p>
      </Section>

      <Section title="Sono e hidratação" aside="cobertura antes da média">
        <table className="report-table">
          <tbody>
            <tr>
              <td>Noites registradas</td>
              <td>
                {sleep.nights} de {report.days} · {sleep.coveragePct}%
              </td>
              <td>Sono mediano</td>
              <td>{sleep.medianMinutes !== null ? hours(sleep.medianMinutes) : "—"}</td>
            </tr>
            <tr>
              <td>Noites abaixo de 7 h</td>
              <td>
                {sleep.nightsUnder7h} de {sleep.nights}
              </td>
              <td>Variação do horário de dormir</td>
              <td>
                {sleep.midpointDriftMin !== null ? `${sleep.midpointDriftMin} min` : "—"}
              </td>
            </tr>
            <tr>
              <td>Dias com água registrada</td>
              <td>
                {hydration.days} de {report.days} · {hydration.coveragePct}%
              </td>
              <td>Água mediana</td>
              <td>
                {hydration.medianMl !== null
                  ? `${fixed(hydration.medianMl / 1000)} L de ${fixed(
                      hydration.goalMl / 1000
                    )} L`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="report-note">
          Sono medido pelo horário informado ao acordar, não por polissonografia nem
          actigrafia. A variação do horário de dormir é o desvio padrão do ponto médio
          das noites — irregularidade de horário, não duração.
        </p>
      </Section>

      <Section title="Pontos para levar à consulta">
        {report.alerts.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, lineHeight: 1.5 }}>
            {report.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        ) : (
          <p className="report-note">
            Nenhum marcador do período ficou acima da faixa de referência.
          </p>
        )}
      </Section>

      <p className="report-foot">
        Faixas de referência: circunferência de cintura para homens adultos (OMS/IDF),
        IMC (OMS), atividade física semanal (OMS, 2020), 7 horas de sono para adultos.
        Percentual de gordura e índice de gordura visceral seguem as faixas da própria
        balança de bioimpedância, que tem erro de medição próprio e é sensível a
        hidratação, horário e última refeição. Documento gerado pelo GYM//TRACK a partir
        de registros pessoais; não constitui diagnóstico nem prescrição.
      </p>
    </Sheet>
  )
}
