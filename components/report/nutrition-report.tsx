"use client"

import {
  PRINT,
  ReportColumns,
  ReportDivergingColumns,
  ReportLegend,
  ReportSpark,
} from "@/components/report/report-charts"
import { fixed, Kpis, ReportHead, Section, Sheet } from "@/components/report/report-ui"
import { PAL_BASE } from "@/lib/energy"
import type { NutritionReport } from "@/lib/reports"
import { formatFullDate } from "@/lib/reports"

const int = (n: number) => Math.round(n).toLocaleString("pt-BR")
const one = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
const signed = (n: number, decimals = 0) =>
  decimals === 0
    ? `${n > 0 ? "+" : n < 0 ? "−" : ""}${int(Math.abs(n))}`
    : `${n > 0 ? "+" : n < 0 ? "−" : ""}${fixed(Math.abs(n), decimals)}`

function hours(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(Math.round(minutes % 60)).padStart(2, "0")}`
}

/**
 * Relatório para acompanhamento nutricional.
 *
 * O destinatário é outra pessoa, que não conhece o app nem o método. Por isso
 * o documento carrega a seção de metodologia junto: sem registro alimentar, a
 * ingestão aqui é DERIVADA da variação de massa somada ao gasto modelado — é
 * uma estimativa defensável, e apresentá-la sem essa ressalva seria vendê-la
 * como medição.
 */
export function NutritionReportSheet({ report }: { report: NutritionReport }) {
  const { profile, energy, training, hydration, sleep } = report
  const withComposition = report.mass.filter((p) => p.fatKg !== null && p.leanKg !== null)

  return (
    <Sheet>
      <ReportHead
        title="Acompanhamento nutricional"
        period={`${formatFullDate(report.period.from)} – ${formatFullDate(report.period.to)}`}
        extra={`${report.days} dias · ${report.weeks.toLocaleString("pt-BR")} semanas`}
      />

      <p className="report-lead">
        Dados de treino, composição corporal e balanço energético do período, extraídos
        de registros diários de treino e de bioimpedância. <b>Não há registro
        alimentar</b>: a ingestão apresentada é estimada a partir da variação de massa
        corporal somada ao gasto modelado — a metodologia está detalhada no fim.
      </p>

      {profile ? (
        <Section title="Perfil atual" aside={`medido em ${formatFullDate(profile.measuredAt)}`}>
          <table className="report-table">
            <tbody>
              <tr>
                <td>Peso</td>
                <td>{fixed(profile.weightKg, 1)} kg</td>
                <td>Altura (derivada do IMC)</td>
                <td>{profile.heightM !== null ? `${fixed(profile.heightM, 2)} m` : "—"}</td>
              </tr>
              <tr>
                <td>IMC</td>
                <td>{profile.bmi !== null ? fixed(profile.bmi) : "—"}</td>
                <td>Gordura corporal</td>
                <td>{profile.bodyFatPct !== null ? `${fixed(profile.bodyFatPct)} %` : "—"}</td>
              </tr>
              <tr>
                <td>Massa de gordura</td>
                <td>{profile.fatMassKg !== null ? `${fixed(profile.fatMassKg)} kg` : "—"}</td>
                <td>Massa magra</td>
                <td>{profile.leanMassKg !== null ? `${fixed(profile.leanMassKg)} kg` : "—"}</td>
              </tr>
              <tr>
                <td>Músculo esquelético</td>
                <td>
                  {profile.skeletalMuscleKg !== null ? `${fixed(profile.skeletalMuscleKg)} kg` : "—"}
                </td>
                <td>Água corporal</td>
                <td>{profile.waterPct !== null ? `${fixed(profile.waterPct)} %` : "—"}</td>
              </tr>
              <tr>
                <td>Gordura visceral</td>
                <td>{profile.visceralFat !== null ? fixed(profile.visceralFat) : "—"}</td>
                <td>Metabolismo basal (balança)</td>
                <td>{profile.bmrKcal !== null ? `${int(profile.bmrKcal)} kcal` : "—"}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      ) : (
        <Section title="Perfil atual">
          <p className="report-note">Sem pesagem registrada no período.</p>
        </Section>
      )}

      <Section title="Balanço energético" aside={`janela de ${energy.days} dias`}>
        {energy.budget && energy.intake !== null ? (
          <>
            <Kpis
              items={[
                { label: "Ingestão estimada", value: int(energy.intake), unit: "kcal/dia" },
                { label: "Manutenção", value: int(energy.budget.tdee), unit: "kcal/dia" },
                {
                  label: "Saldo",
                  value: signed(energy.intake - energy.budget.tdee),
                  unit: "kcal/dia",
                },
                {
                  label: "Ritmo",
                  value:
                    energy.weeklyRatePct !== null
                      ? `${signed(energy.weeklyRatePct, 2)}%`
                      : "—",
                  unit: "por semana",
                },
              ]}
            />
            <table className="report-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Componente do gasto</th>
                  <th>kcal/dia</th>
                  <th>% do total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Metabolismo basal</td>
                  <td>{int(energy.budget.bmr)}</td>
                  <td>{Math.round((energy.budget.bmr / energy.budget.tdee) * 100)}%</td>
                </tr>
                <tr>
                  <td>Rotina e digestão</td>
                  <td>{int(energy.budget.routine)}</td>
                  <td>{Math.round((energy.budget.routine / energy.budget.tdee) * 100)}%</td>
                </tr>
                <tr>
                  <td>Treino (média diária)</td>
                  <td>{int(energy.budget.training)}</td>
                  <td>{Math.round((energy.budget.training / energy.budget.tdee) * 100)}%</td>
                </tr>
              </tbody>
            </table>
            <p className="report-note">
              Faixa da ingestão estimada: {int(energy.intakeLow!)} – {int(energy.intakeHigh!)}{" "}
              kcal/dia. A amplitude vem da incerteza da rotina fora do treino, única
              premissa não medida da conta.
            </p>

            {energy.targets && (
              <div className="report-targets">
                <div>
                  <dt>Cortar</dt>
                  <dd>
                    {int(energy.targets.cut)}
                    <small>−0,5% do peso por semana</small>
                  </dd>
                </div>
                <div>
                  <dt>Manter</dt>
                  <dd>
                    {int(energy.targets.maintain)}
                    <small>peso estável</small>
                  </dd>
                </div>
                <div>
                  <dt>Ganhar</dt>
                  <dd>
                    {int(energy.targets.bulk)}
                    <small>+0,25% do peso por semana</small>
                  </dd>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="report-note">
            Sem metabolismo basal ou sem pesagens suficientes no período para estimar a
            ingestão.
          </p>
        )}
      </Section>

      {report.mass.length >= 2 && (
        <Section title="Variação de massa" aside={`${report.mass.length} pesagens`}>
          <div className="report-sparks">
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
                title="Massa de gordura"
                unit="kg"
              />
            </div>
            <div>
              <ReportSpark
                points={withComposition.map((p) => ({ label: p.label, value: p.leanKg! }))}
                color={PRINT.lean}
                title="Massa magra"
                unit="kg"
              />
            </div>
          </div>
          <table className="report-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Tendência no período</th>
                <th>kg por semana</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Peso corporal</td>
                <td>
                  {energy.trend.weightKgPerWeek !== null
                    ? signed(energy.trend.weightKgPerWeek, 2)
                    : "—"}
                </td>
              </tr>
              {energy.trend.fatKgPerWeek !== null && (
                <tr>
                  <td>Massa de gordura</td>
                  <td>{signed(energy.trend.fatKgPerWeek, 2)}</td>
                </tr>
              )}
              {energy.trend.leanKgPerWeek !== null && (
                <tr>
                  <td>Massa magra</td>
                  <td>{signed(energy.trend.leanKgPerWeek, 2)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="report-note">
            Cada painel tem escala própria e ampliada — a variação relevante é de 1 a 2 kg,
            que num eixo começando em zero seria invisível. Tendências por regressão
            linear sobre todas as pesagens da janela, não pela diferença entre a primeira
            e a última.
          </p>
        </Section>
      )}

      <Section title="Gasto com treino" breakBefore>
        <Kpis
          items={[
            { label: "Sessões", value: int(training.sessions), unit: `· ${one(training.sessionsPerWeek)}/sem` },
            { label: "Gasto médio", value: int(training.kcalPerWeek), unit: "kcal/sem" },
            { label: "Musculação", value: int(training.liftKcal), unit: "kcal" },
            { label: "Cardio", value: int(training.cardioKcal), unit: "kcal" },
          ]}
        />
        <div style={{ marginTop: 10 }}>
          <ReportColumns
            data={report.weekly.map((week) => ({ label: week.label, a: week.kcal }))}
            series={[{ label: "Gasto", color: PRINT.cardio }]}
            height={130}
            format={(v) => (v >= 1000 ? `${one(v / 1000)}k` : String(Math.round(v)))}
          />
          <ReportLegend
            items={[
              {
                label: "Gasto estimado com treino por semana (kcal)",
                color: PRINT.cardio,
              },
            ]}
          />
        </div>
        <p className="report-note">
          {int(training.cardioMinutes)} minutos de atividade aeróbica no período. Cardio
          inclui Zona 2, treino intenso, esporte e caminhadas importadas do Strava.
        </p>
      </Section>

      {report.balance.some((point) => point.balance !== null) && (
        <Section title="Saldo semana a semana">
          <ReportDivergingColumns
            data={report.balance.map((point) => ({
              label: point.label,
              value: point.balance,
            }))}
          />
          <ReportLegend
            items={[
              { label: "acima do zero: energia armazenada", color: PRINT.lift },
              { label: "abaixo: energia liberada", color: PRINT.cardio },
            ]}
          />
          <p className="report-note">
            Zero é manutenção. Cada barra usa a tendência de massa dos 21 dias que
            terminam naquela semana — janela maior que o passo semanal de propósito,
            porque uma pesagem isolada oscila cerca de 1 kg com sal e água, o que valeria
            ±1.000 kcal/dia de ruído. Semanas sem pesagens suficientes ficam sem barra.
          </p>
        </Section>
      )}

      <Section title="Hidratação e sono">
        <table className="report-table">
          <tbody>
            <tr>
              <td>Ingestão de água (média dos dias registrados)</td>
              <td>
                {hydration.avgMl !== null
                  ? `${(hydration.avgMl / 1000).toFixed(1).replace(".", ",")} L`
                  : "—"}
              </td>
            </tr>
            <tr>
              <td>Meta pelo peso corporal</td>
              <td>{(hydration.goalMl / 1000).toFixed(1).replace(".", ",")} L</td>
            </tr>
            <tr>
              <td>Aderência</td>
              <td>
                {hydration.adherencePct !== null ? `${hydration.adherencePct}%` : "—"}
                {` · ${hydration.daysLogged} de ${report.days} dias registrados`}
              </td>
            </tr>
            <tr>
              <td>Sono (média das noites registradas)</td>
              <td>
                {sleep.avgMinutes !== null ? hours(sleep.avgMinutes) : "—"}
                {` · ${sleep.nights} noites`}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Metodologia e limitações">
        <ul style={{ margin: 0, paddingLeft: 14, fontSize: 9.5, lineHeight: 1.55 }}>
          <li>
            <b>Não há registro alimentar.</b> A ingestão é derivada: variação de massa
            corporal convertida em energia, somada ao gasto diário modelado.
          </li>
          <li>
            <b>Conversão de massa em energia:</b> quando há bioimpedância, gordura a
            9.440 kcal/kg e massa magra a 1.816 kcal/kg (Hall, 2008), o que separa o
            que a balança sozinha confunde. Sem composição, 7.700 kcal/kg de peso.
          </li>
          <li>
            <b>Gasto:</b> metabolismo basal medido pela balança de bioimpedância (ou
            Katch-McArdle sobre a massa magra quando ausente), mais{" "}
            {Math.round((PAL_BASE - 1) * 100)}% do basal para rotina e efeito térmico
            dos alimentos, mais as calorias de treino diluídas por dia.
          </li>
          <li>
            <b>Calorias de treino</b> estimadas por METs (Compendium of Physical
            Activities) a partir do peso da época, duração real da sessão e esforço
            percebido; caminhadas e corridas usam ritmo, cadência e elevação quando
            disponíveis. É estimativa, não calorimetria indireta.
          </li>
          <li>
            <b>Bioimpedância</b> tem erro próprio e é sensível a hidratação, horário e
            última refeição. As tendências usam regressão sobre todas as medições da
            janela justamente para diluir esse ruído.
          </li>
          <li>
            <b>Composição corporal por bioimpedância doméstica</b> não substitui DEXA
            nem avaliação clínica.
          </li>
        </ul>
      </Section>

      <p className="report-foot">
        Documento gerado pelo GYM//TRACK a partir dos registros de treino, bioimpedância,
        hidratação e sono do período. Os números são estimativas de acompanhamento e não
        substituem avaliação profissional.
      </p>
    </Sheet>
  )
}
