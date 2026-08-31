"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"
import { BlockReportSheet } from "@/components/report/block-report"
import { NutritionReportSheet } from "@/components/report/nutrition-report"
import { SheetPreview } from "@/components/report/report-ui"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import {
  blockReport,
  nutritionReport,
  reportPeriods,
  type ReportPeriod,
} from "@/lib/reports"
import { useGymData } from "@/lib/store"
import { useOperationalDay } from "@/lib/use-operational-day"
import { useTrainingProgram } from "@/lib/use-training-program"
import { cn } from "@/lib/utils"
import "./report.css"

type ReportKind = "bloco" | "nutricao"

const KINDS: { id: ReportKind; label: string; hint: string }[] = [
  {
    id: "bloco",
    label: "Fechamento de bloco",
    hint: "Antes × depois do mesociclo: força, composição, volume e energia.",
  },
  {
    id: "nutricao",
    label: "Nutricionista",
    hint: "Perfil, balanço energético, variação de massa e metodologia.",
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

  const periods = useMemo(() => (today ? reportPeriods(today) : []), [today])

  const period: ReportPeriod | null = useMemo(() => {
    if (customFrom && customTo && customFrom <= customTo) {
      return { id: "custom", label: "Período personalizado", from: customFrom, to: customTo }
    }
    if (periods.length === 0) return null
    return periods.find((p) => p.id === periodId) ?? periods[0]
  }, [customFrom, customTo, periodId, periods])

  const report = useMemo(() => {
    if (!data || !period || !program) return null
    return kind === "bloco"
      ? { kind: "bloco" as const, value: blockReport(data, period, program) }
      : { kind: "nutricao" as const, value: nutritionReport(data, period, program) }
  }, [data, kind, period, program])

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
          <p
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            Relatório
          </p>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((option) => (
              <button
                key={option.id}
                onClick={() => setKind(option.id)}
                aria-pressed={kind === option.id}
                className={cn(
                  "rounded border p-2.5 text-left transition-colors",
                  kind === option.id
                    ? "border-gold bg-gold/10"
                    : "border-seam hover:border-steel-dim"
                )}
              >
                <span
                  className={cn(
                    "block text-xs font-semibold uppercase tracking-wider",
                    kind === option.id ? "text-gold" : "text-bone"
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

          <p
            className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            Período
          </p>
          <div className="flex flex-wrap gap-1.5">
            {periods.map((option) => {
              const active = !customFrom && !customTo && period?.id === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setPeriodId(option.id)
                    setCustomFrom("")
                    setCustomTo("")
                  }}
                  aria-pressed={active}
                  className={cn(
                    "rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                    active
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-seam text-steel hover:text-bone"
                  )}
                  style={{ fontFamily: "var(--font-condensed)" }}
                >
                  {option.label}
                </button>
              )
            })}
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
                className="mt-1 w-full rounded border border-seam bg-iron-2 px-2 py-1.5 font-mono text-xs text-bone"
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
                className="mt-1 w-full rounded border border-seam bg-iron-2 px-2 py-1.5 font-mono text-xs text-bone"
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

          <button
            onClick={() => window.print()}
            disabled={!report}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-ember px-4 py-3 text-sm font-semibold uppercase tracking-wider text-coal transition-opacity disabled:opacity-40"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Printer size={16} />
            Salvar como PDF
          </button>
          <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-steel-dim">
            Abre a janela de impressão do navegador. Escolha &ldquo;Salvar como PDF&rdquo;
            no destino — no celular, a opção fica no menu de compartilhamento.
          </p>
        </Card>

        <p
          className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          Pré-visualização
        </p>
      </div>

      {!report ? (
        <Card className="no-print h-64">
          <Skeleton className="h-full w-full" />
        </Card>
      ) : (
        <SheetPreview>
          {report.kind === "bloco" ? (
            <BlockReportSheet report={report.value} />
          ) : (
            <NutritionReportSheet report={report.value} />
          )}
        </SheetPreview>
      )}
    </main>
  )
}
