"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Check, Printer, Share2 } from "lucide-react"
import { BlockReportSheet } from "@/components/report/block-report"
import { CoachReportSheet } from "@/components/report/coach-report"
import { ComebackReportSheet } from "@/components/report/comeback-report"
import { ComparisonReportSheet } from "@/components/report/comparison-report"
import { HealthReportSheet } from "@/components/report/health-report"
import { NutritionReportSheet } from "@/components/report/nutrition-report"
import { SheetPreview } from "@/components/report/report-ui"
import { Card, Chip, FieldLabel, PageHeader, Skeleton } from "@/components/ui"
import {
  blockReport,
  coachReport,
  comebackReport,
  comparisonReport,
  formatFullDate,
  healthReport,
  nutritionReport,
  previousPeriod,
  reportCoverage,
  reportPeriods,
  reportSummaryText,
  type ReportPeriod,
} from "@/lib/reports"
import { useGymData } from "@/lib/store"
import { useOperationalDay } from "@/lib/use-operational-day"
import { useTrainingProgram } from "@/lib/use-training-program"
import { cn } from "@/lib/utils"
import "./report.css"

type ReportKind = "bloco" | "preparador" | "nutricao" | "saude" | "comparativo" | "retomada"

const KINDS: { id: ReportKind; label: string; hint: string; needsPeriod: boolean }[] = [
  {
    id: "bloco",
    label: "Fechamento de bloco",
    hint: "Constância, força por carga, composição, volume e energia.",
    needsPeriod: true,
  },
  {
    id: "preparador",
    label: "Preparador físico",
    hint: "Exposição, desempenho, estado de carga, recuperação e qualidade dos dados.",
    needsPeriod: true,
  },
  {
    id: "nutricao",
    label: "Nutricionista",
    hint: "Perfil, balanço energético, variação de massa e metodologia.",
    needsPeriod: true,
  },
  {
    id: "saude",
    label: "Resumo de saúde",
    hint: "Cintura, IMC, gordura e atividade contra as faixas de referência.",
    needsPeriod: true,
  },
  {
    id: "comparativo",
    label: "Comparativo",
    hint: "Este período contra o anterior, do mesmo tamanho.",
    needsPeriod: true,
  },
  {
    id: "retomada",
    label: "Onde eu parei",
    hint: "Com que carga voltar em cada exercício depois da pausa.",
    needsPeriod: false,
  },
]

export default function RelatoriosPage() {
  const { data } = useGymData()
  const today = useOperationalDay()
  const { program } = useTrainingProgram()
  const [kind, setKind] = useState<ReportKind>("bloco")
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [shared, setShared] = useState<"idle" | "copiado" | "erro">("idle")
  const [pages, setPages] = useState<number | null>(null)

  const needsPeriod = KINDS.find((option) => option.id === kind)!.needsPeriod
  const periods = useMemo(() => (today ? reportPeriods(today) : []), [today])

  const period: ReportPeriod | null = useMemo(() => {
    if (customFrom && customTo && customFrom <= customTo) {
      return { id: "custom", label: "Período personalizado", from: customFrom, to: customTo }
    }
    if (periods.length === 0) return null
    return periods.find((p) => p.id === periodId) ?? periods[0]
  }, [customFrom, customTo, periodId, periods])

  const coverage = useMemo(
    () => (data && period ? reportCoverage(data, period) : null),
    [data, period]
  )

  const report = useMemo(() => {
    if (!data || !program) return null
    if (kind === "retomada") {
      return today
        ? { kind: "retomada" as const, value: comebackReport(data, today) }
        : null
    }
    if (!period) return null
    if (kind === "bloco") {
      return { kind: "bloco" as const, value: blockReport(data, period, program) }
    }
    if (kind === "preparador") {
      return { kind: "preparador" as const, value: coachReport(data, period, program) }
    }
    if (kind === "nutricao") {
      return { kind: "nutricao" as const, value: nutritionReport(data, period, program) }
    }
    if (kind === "saude") {
      return { kind: "saude" as const, value: healthReport(data, period, program) }
    }
    return {
      kind: "comparativo" as const,
      value: comparisonReport(data, period, previousPeriod(period), program),
    }
  }, [data, kind, period, program, today])

  /**
   * O caminho real de saída deste app é o aplicativo de mensagens, onde um PDF
   * de três páginas é pior que seis linhas. E, no celular, é o único jeito de
   * LER o que o documento diz: a folha A4 cabe na tela a 52% do tamanho.
   */
  async function share() {
    if (!data || !period || !program) return
    const text = reportSummaryText(data, period, program)
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `GYM//TRACK · ${period.label}`, text })
        setShared("idle")
        return
      }
      await navigator.clipboard.writeText(text)
      setShared("copiado")
    } catch (error) {
      // cancelar o menu de compartilhamento cai aqui e não é erro
      setShared(error instanceof DOMException && error.name === "AbortError" ? "idle" : "erro")
    }
    setTimeout(() => setShared("idle"), 2500)
  }

  const summaryText = useMemo(
    () => (data && period && program ? reportSummaryText(data, period, program) : ""),
    [data, period, program]
  )

  return (
    <main>
      <div className="no-print">
        <PageHeader
          kicker="GYM//TRACK"
          title="Relatórios"
          left={
            <Link
              href="/"
              aria-label="Voltar ao painel"
              className="rounded border border-seam p-2 text-steel transition-colors hover:text-bone"
            >
              <ArrowLeft size={16} />
            </Link>
          }
        />

        <Card className="mb-4">
          <FieldLabel>Relatório</FieldLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {KINDS.map((option) => (
              <button
                key={option.id}
                onClick={() => setKind(option.id)}
                aria-pressed={kind === option.id}
                className={cn(
                  "rounded border p-2.5 text-left transition-colors",
                  kind === option.id
                    ? "border-ember bg-ember/10"
                    : "border-seam hover:border-steel-dim"
                )}
              >
                <span
                  className={cn(
                    "block text-xs font-semibold uppercase tracking-wider",
                    kind === option.id ? "text-ember" : "text-bone"
                  )}
                  style={{ fontFamily: "var(--font-condensed)" }}
                >
                  {option.label}
                </span>
                <span className="mt-1 block text-[10px] leading-snug text-steel-dim">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>

          {needsPeriod ? (
            <>
              <div className="mt-4">
                <FieldLabel>Período</FieldLabel>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {periods.map((option) => (
                  <Chip
                    key={option.id}
                    active={!customFrom && !customTo && period?.id === option.id}
                    onClick={() => {
                      setPeriodId(option.id)
                      setCustomFrom("")
                      setCustomTo("")
                    }}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex-1 basis-32">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                    de
                  </span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="mt-1 w-full rounded border border-seam bg-iron-2 px-2 py-1.5 font-mono text-xs text-bone outline-none focus:border-ember"
                  />
                </label>
                <label className="flex-1 basis-32">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                    até
                  </span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="mt-1 w-full rounded border border-seam bg-iron-2 px-2 py-1.5 font-mono text-xs text-bone outline-none focus:border-ember"
                  />
                </label>
                {(customFrom || customTo) && (
                  <button
                    onClick={() => {
                      setCustomFrom("")
                      setCustomTo("")
                    }}
                    className="rounded border border-seam px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-steel hover:text-bone"
                    style={{ fontFamily: "var(--font-condensed)" }}
                  >
                    limpar
                  </button>
                )}
              </div>
              {/* preencher só um dos campos não muda nada; dizer isso evita
                  o usuário achar que o documento já mudou */}
              {Boolean(customFrom) !== Boolean(customTo) && (
                <p className="mt-2 font-mono text-[10px] text-gold">
                  Preencha as duas datas para usar o período personalizado.
                </p>
              )}
              {customFrom && customTo && customFrom > customTo && (
                <p className="mt-2 font-mono text-[10px] text-gold">
                  A data inicial está depois da final.
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 font-mono text-[10px] leading-relaxed text-steel-dim">
              Este documento não tem período: ele olha os últimos 180 dias de registro
              para dizer com que carga voltar hoje.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.print()}
              disabled={!report}
              className="flex flex-1 items-center justify-center gap-2 rounded bg-ember px-4 py-3 text-sm font-semibold uppercase tracking-wider text-coal transition-opacity disabled:opacity-40"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              <Printer size={16} />
              Salvar como PDF
            </button>
            {needsPeriod && (
              <button
                onClick={share}
                disabled={!summaryText}
                className="flex items-center justify-center gap-2 rounded border border-seam px-4 py-3 text-sm font-semibold uppercase tracking-wider text-steel transition-colors hover:border-steel hover:text-bone disabled:opacity-40"
                style={{ fontFamily: "var(--font-condensed)" }}
                title="Compartilhar o resumo em texto"
              >
                {shared === "copiado" ? <Check size={16} /> : <Share2 size={16} />}
                {shared === "copiado" ? "copiado" : shared === "erro" ? "falhou" : "resumo"}
              </button>
            )}
          </div>
          <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-steel-dim">
            O PDF abre a janela de impressão do navegador — escolha &ldquo;Salvar como
            PDF&rdquo; no destino. O resumo vai em texto, para mandar por mensagem.
          </p>
        </Card>

        {needsPeriod && coverage && period && (
          <Card className="mb-4">
            <FieldLabel>O que este período tem</FieldLabel>
            <p className="mb-3 font-mono text-[10px] text-steel-dim">
              {formatFullDate(period.from)} – {formatFullDate(period.to)} · {coverage.days} dias
              {kind === "comparativo" &&
                ` · comparado com ${formatFullDate(previousPeriod(period).from)} – ${formatFullDate(
                  previousPeriod(period).to
                )}`}
            </p>
            <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                { label: "sessões", value: coverage.sessions },
                { label: "dias ativos", value: coverage.activeDays },
                { label: "pesagens", value: coverage.weighIns },
                { label: "cinturas", value: coverage.waistPoints },
                { label: "noites", value: coverage.sleepNights },
                { label: "dias de água", value: coverage.hydrationDays },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded border border-seam bg-iron-2/40 px-2 py-1.5"
                >
                  <dd className="score text-xl text-bone">{item.value}</dd>
                  <dt className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>
            {coverage.warnings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {coverage.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex items-start gap-1.5 text-[11px] leading-snug text-gold"
                  >
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {needsPeriod && summaryText && (
          <Card className="mb-4">
            <FieldLabel>Resumo em texto</FieldLabel>
            {/* a miniatura da folha cabe na tela a ~52% do tamanho e o corpo de
                10,5px vira 5,5px: no celular, ESTE bloco é o documento legível */}
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-steel">
              {summaryText}
            </pre>
          </Card>
        )}

        <FieldLabel>
          Pré-visualização{pages !== null ? ` · ${pages} página${pages === 1 ? "" : "s"}` : ""}
        </FieldLabel>
        <p className="mb-2 font-mono text-[10px] leading-relaxed text-steel-dim">
          Miniatura da folha A4 — no celular ela reduz para caber, e o texto sai em
          tamanho real no PDF.
        </p>
      </div>

      {!report ? (
        <Card className="no-print h-64">
          <Skeleton className="h-full w-full" />
        </Card>
      ) : (
        <SheetPreview onPages={setPages}>
          {report.kind === "bloco" ? (
            <BlockReportSheet report={report.value} />
          ) : report.kind === "preparador" ? (
            <CoachReportSheet report={report.value} />
          ) : report.kind === "nutricao" ? (
            <NutritionReportSheet report={report.value} />
          ) : report.kind === "saude" ? (
            <HealthReportSheet report={report.value} />
          ) : report.kind === "comparativo" ? (
            <ComparisonReportSheet report={report.value} />
          ) : (
            <ComebackReportSheet report={report.value} />
          )}
        </SheetPreview>
      )}
    </main>
  )
}
