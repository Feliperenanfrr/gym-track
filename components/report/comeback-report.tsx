"use client"

import { PRINT, ReportHBars } from "@/components/report/report-charts"
import { fixed, Kpis, ReportHead, Section, Sheet } from "@/components/report/report-ui"
import type { ComebackAdvice, ComebackReport } from "@/lib/reports"
import { formatFullDate } from "@/lib/reports"
import { RELATIVE_LOAD_ALERT_PCT } from "@/lib/strength"

const one = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

const ADVICE_LABEL: Record<ComebackAdvice, string> = {
  reentrar: "reentrar",
  retomar: "retomar",
  seguir: "seguir",
}

const ADVICE_CLASS: Record<ComebackAdvice, string> = {
  reentrar: "report-confidence-baixa",
  retomar: "report-confidence-moderada",
  seguir: "report-confidence-alta",
}

/**
 * Onde eu parei.
 *
 * Os outros documentos olham para trás e explicam o bloco. Este olha para a
 * próxima sessão: com que carga voltar em cada exercício depois de uma pausa.
 * Num histórico cujo padrão real são lacunas de duas semanas, é o documento
 * que se usa mais vezes — e o único que serve dentro da academia, no celular,
 * sem virar PDF.
 *
 * A regra de reentrada é a mesma da tela de registro (90% da última carga,
 * arredondado ao passo do aparelho, depois de 14 dias sem o exercício), para o
 * papel não contradizer o app.
 */
export function ComebackReportSheet({ report }: { report: ComebackReport }) {
  const detrained = report.lifts.filter(
    (lift) => lift.relativePct < RELATIVE_LOAD_ALERT_PCT
  )

  return (
    <Sheet>
      <ReportHead
        title="Onde eu parei"
        period={`registros de ${formatFullDate(report.from)} a ${formatFullDate(report.today)}`}
        extra={`${report.lifts.length} exercícios com carga registrada`}
      />

      <Section title="Situação">
        <Kpis
          items={[
            {
              label: "Sem treino há",
              value: report.daysSinceAny !== null ? String(report.daysSinceAny) : "—",
              unit: "dias",
            },
            {
              label: "Sem musculação há",
              value: report.daysSinceLift !== null ? String(report.daysSinceLift) : "—",
              unit: "dias",
            },
            {
              label: `Abaixo de ${RELATIVE_LOAD_ALERT_PCT}%`,
              value: `${detrained.length}/${report.lifts.length}`,
              unit: "do próprio recorde",
            },
            {
              label: "Para reentrar",
              value: String(report.lifts.filter((lift) => lift.advice === "reentrar").length),
              unit: "exercícios",
            },
          ]}
        />
        {report.notes.length > 0 && (
          <ul style={{ margin: "8px 0 0", paddingLeft: 14, fontSize: 10, lineHeight: 1.5 }}>
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </Section>

      {report.lifts.length > 0 ? (
        <>
          <Section title="Carga da volta" aside="pior caso primeiro">
            <table className="report-table report-lifts-table">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Última vez</th>
                  <th>Fez</th>
                  <th>Recorde</th>
                  <th>% dele</th>
                  <th>Comece com</th>
                  <th>O quê</th>
                </tr>
              </thead>
              <tbody>
                {report.lifts.map((lift) => (
                  <tr key={lift.exerciseId}>
                    <td>
                      {lift.name}
                      <small>{lift.reason}</small>
                    </td>
                    <td>
                      {lift.daysSince} d
                      <br />
                      {formatFullDate(lift.lastDate)}
                    </td>
                    <td>
                      {one(lift.lastWeight)} × {lift.lastReps}
                      {lift.lastSets > 0 ? ` (${lift.lastSets} séries)` : ""}
                    </td>
                    <td>{one(lift.bestWeight)} kg</td>
                    <td
                      className={
                        lift.relativePct < RELATIVE_LOAD_ALERT_PCT ? "down" : "flat"
                      }
                    >
                      {lift.relativePct}%
                    </td>
                    <td>
                      <b>{one(lift.suggestedWeight)} kg</b>
                      <br />
                      passo {one(lift.step)} kg
                    </td>
                    <td>
                      <span className={`report-confidence ${ADVICE_CLASS[lift.advice]}`}>
                        {ADVICE_LABEL[lift.advice]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="report-note">
              <b>Reentrar</b>: 14 dias ou mais sem o exercício — volte a ~90% da última
              carga e recupere na sessão seguinte. <b>Retomar</b>: a carga está abaixo de{" "}
              {RELATIVE_LOAD_ALERT_PCT}% do próprio recorde; suba pelo passo do aparelho
              até reencostar. <b>Seguir</b>: nada aconteceu que justifique recuar. O
              passo é inferido do próprio histórico — o maior incremento que divide todas
              as cargas já registradas naquele aparelho.
            </p>
          </Section>

          <Section title="Distância do recorde" aside="carga da última sessão">
            <ReportHBars
              rows={report.lifts.map((lift) => ({
                label: lift.name,
                value: lift.relativePct,
              }))}
              color={(row) => (row.value < RELATIVE_LOAD_ALERT_PCT ? PRINT.fat : PRINT.lift)}
              labelWidth={168}
              max={100}
              reference={RELATIVE_LOAD_ALERT_PCT}
              referenceLabel={`${RELATIVE_LOAD_ALERT_PCT}%`}
              format={(v) => `${Math.round(v)}%`}
            />
          </Section>
        </>
      ) : (
        <Section title="Carga da volta">
          <p className="report-note">
            Nenhum exercício com carga registrada na janela. Registre uma sessão para o
            documento ter o que comparar.
          </p>
        </Section>
      )}

      {report.missingGroups.length > 0 && (
        <Section title="Grupos sem série na janela">
          <p style={{ margin: 0, fontSize: 10 }}>{report.missingGroups.join(" · ")}</p>
          <p className="report-note">
            Grupo sem nenhuma série registrada nos últimos meses. Pode ser escolha do
            plano — o registro não guarda a intenção, só o que aconteceu.
          </p>
        </Section>
      )}

      <p className="report-foot">
        A carga sugerida é ponto de partida, não prescrição: quem decide é a série de
        aquecimento do dia. Recorde é a maior carga registrada na janela do documento, e
        não o recorde de uma vida — o histórico começa quando o app começou. Documento
        gerado pelo GYM//TRACK a partir dos registros de treino.
      </p>
    </Sheet>
  )
}
