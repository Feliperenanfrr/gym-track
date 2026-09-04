"use client"

import { deltaClass, fixed, formatDelta, ReportHead, Section, Sheet } from "@/components/report/report-ui"
import type { ComparisonReport, ComparisonRow } from "@/lib/reports"
import { formatFullDate } from "@/lib/reports"

const value = (row: ComparisonRow, side: "a" | "b") => {
  const raw = row[side]
  if (raw === null) return "—"
  return `${fixed(raw, row.decimals)}${row.unit ? ` ${row.unit}` : ""}`
}

/**
 * Dois períodos, uma folha.
 *
 * O fechamento de bloco nasceu para ser empilhado — o comentário do próprio
 * componente diz que seis deles respondem "o bloco de maio rendeu mais que o
 * de agosto". Ninguém empilha PDF. A comparação que se faz de verdade é entre
 * este recorte e o imediatamente anterior, do mesmo tamanho, e ela cabe numa
 * página com as duas colunas lado a lado.
 */
export function ComparisonReportSheet({ report }: { report: ComparisonReport }) {
  return (
    <Sheet>
      <ReportHead
        title="Comparativo de períodos"
        period={`${formatFullDate(report.a.from)} – ${formatFullDate(report.a.to)}`}
        extra={`contra ${formatFullDate(report.b.from)} – ${formatFullDate(report.b.to)} · ${report.days} dias cada`}
      />

      <div className="report-brief">
        <div>
          <b>Recente</b>
          <p>
            {report.a.label}
            <br />
            {formatFullDate(report.a.from)} a {formatFullDate(report.a.to)}
          </p>
        </div>
        <div>
          <b>Anterior</b>
          <p>
            {report.b.label}
            <br />
            {formatFullDate(report.b.from)} a {formatFullDate(report.b.to)}
          </p>
        </div>
        <div>
          <b>Régua</b>
          <p>
            Os dois recortes têm {report.days} dias por construção — sem isso, volume e
            minutos não se comparam.
          </p>
        </div>
      </div>

      {report.previousEmpty && (
        <p className="report-note" style={{ marginTop: 10 }}>
          <b>O período anterior não tem registro nenhum.</b> As colunas
          &ldquo;anterior&rdquo; abaixo são zero por ausência de dado, não por
          inatividade medida — o registro começou depois. Leia apenas a coluna recente.
        </p>
      )}

      <Section title="Exposição e constância">
        <table className="report-table">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Recente</th>
              <th>Anterior</th>
              <th>Δ</th>
              <th>Δ %</th>
            </tr>
          </thead>
          <tbody>
            {report.exposure.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{value(row, "a")}</td>
                <td>{value(row, "b")}</td>
                <td className={deltaClass(row.delta, report.previousEmpty ? "neutral" : row.goal)}>
                  {formatDelta(row.delta, row.decimals)}
                </td>
                <td className={deltaClass(row.delta, report.previousEmpty ? "neutral" : row.goal)}>
                  {row.deltaPct !== null ? `${formatDelta(row.deltaPct, 0)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="report-note">
          Sessões contam todo registro do período. A maior lacuna é a maior sequência de
          dias sem nenhum treino dentro do recorte — a métrica em que menos é melhor, e
          por isso a única com a direção invertida na cor.
        </p>
      </Section>

      {report.lifts.length > 0 && (
        <Section title="Carga por exercício" aside="última sessão de cada período">
          <table className="report-table report-lifts-table">
            <thead>
              <tr>
                <th>Exercício</th>
                <th>Recente</th>
                <th>Anterior</th>
                <th>Δ</th>
                <th>Δ %</th>
                <th>Sessões</th>
              </tr>
            </thead>
            <tbody>
              {report.lifts.map((lift) => (
                <tr key={lift.exerciseId}>
                  <td>{lift.name}</td>
                  <td>{lift.aWeight !== null ? `${fixed(lift.aWeight)} kg` : "—"}</td>
                  <td>{lift.bWeight !== null ? `${fixed(lift.bWeight)} kg` : "—"}</td>
                  <td className={deltaClass(lift.deltaKg, "up")}>
                    {lift.deltaKg !== null ? `${formatDelta(lift.deltaKg)} kg` : "—"}
                  </td>
                  <td className={deltaClass(lift.deltaPct, "up")}>
                    {lift.deltaPct !== null ? `${formatDelta(lift.deltaPct)}%` : "—"}
                  </td>
                  <td>
                    {lift.aSessions} × {lift.bSessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="report-note">
            A comparação é entre a carga do top set da última sessão de cada período —
            dado bruto, sem 1RM estimada. Exercício ausente do período anterior fica sem
            delta em vez de contar como zero.
          </p>
        </Section>
      )}

      {report.body.length > 0 && (
        <Section title="Composição ao fim de cada período">
          <table className="report-table">
            <thead>
              <tr>
                <th>Medida</th>
                <th>Recente</th>
                <th>Anterior</th>
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
                  <td>{row.a !== null ? fixed(row.a, row.decimals) : "—"}</td>
                  <td>{row.b !== null ? fixed(row.b, row.decimals) : "—"}</td>
                  <td className={deltaClass(row.delta, row.goal)}>
                    {formatDelta(row.delta, row.decimals)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="report-note">
            Cada coluna é a média das medições da ponta final do respectivo período, não
            a última pesagem: a balança oscila cerca de 1 kg com água e sal.
          </p>
        </Section>
      )}

      <Section title="Leitura">
        {report.verdict.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, lineHeight: 1.5 }}>
            {report.verdict.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="report-note">
            Sem diferença relevante entre os dois períodos nas métricas acompanhadas.
          </p>
        )}
      </Section>

      <p className="report-foot">
        Comparar dois recortes só é honesto com o mesmo número de dias e a mesma régua
        em ambos: as duas colunas passam pelas mesmas funções de cálculo. Um período com
        menos registro parece mais leve mesmo tendo sido mais pesado — leia a linha de
        dias treinados antes de concluir qualquer coisa sobre carga.
      </p>
    </Sheet>
  )
}
