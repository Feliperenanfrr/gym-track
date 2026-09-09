"use client"

import { useMemo, useState } from "react"
import { Check, Pencil } from "lucide-react"
import { Card, SectionTitle } from "@/components/ui"
import { dayTotals } from "@/lib/nutrition"
import type { MealLog } from "@/lib/types"
import { cn, fromDateKey } from "@/lib/utils"

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "partial", label: "Parciais" },
  { id: "complete", label: "Completos" },
] as const

export function MealHistory({
  days,
  todayKey,
  saving,
  completingDate,
  onOpenDay,
  onSetComplete,
}: {
  days: MealLog[]
  todayKey: string
  saving: boolean
  completingDate: string | null
  onOpenDay: (date: string) => void
  onSetComplete: (date: string, complete: boolean) => Promise<void>
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [backfillDate, setBackfillDate] = useState("")
  const recorded = useMemo(
    () => [...days]
      .filter((day) => day.date <= todayKey && (day.refeicoes.length > 0 || day.completo))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [days, todayKey]
  )
  const partialCount = recorded.filter((day) => !day.completo).length
  const counts = { all: recorded.length, partial: partialCount, complete: recorded.length - partialCount }
  const groups = useMemo(() => {
    const months = new Map<string, MealLog[]>()
    for (const day of recorded) {
      if (filter === "partial" && day.completo) continue
      if (filter === "complete" && !day.completo) continue
      const month = day.date.slice(0, 7)
      const entries = months.get(month) ?? []
      entries.push(day)
      months.set(month, entries)
    }
    return [...months.entries()]
  }, [recorded, filter])

  return (
    <section aria-label="Histórico de alimentação">
      <p className="mb-4 text-xs leading-relaxed text-steel">
        Confira as refeições de outros dias, edite o que precisar e marque os dias em que
        registrou tudo.
      </p>

      <Card className="mb-4 border-dashed">
        <p className="text-sm font-semibold text-bone">Abrir outro dia</p>
        <p className="mt-1 text-xs text-steel-dim">
          Escolha uma data para revisar ou incluir refeições esquecidas.
        </p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Dia da alimentação</span>
            <input
              type="date"
              value={backfillDate}
              max={todayKey}
              onChange={(event) => setBackfillDate(event.target.value)}
              className="w-full min-w-0 rounded border border-seam bg-coal px-2 py-2 text-sm text-bone outline-none focus:border-ember"
            />
          </label>
          <button
            type="button"
            disabled={!backfillDate || backfillDate > todayKey || saving}
            onClick={() => onOpenDay(backfillDate)}
            className="shrink-0 rounded bg-ember px-3 py-2 text-sm font-semibold text-coal disabled:opacity-40"
          >
            Abrir dia
          </button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar histórico de alimentação">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              filter === option.id
                ? "border-ember bg-ember/10 text-ember"
                : "border-seam text-steel hover:text-bone"
            )}
          >
            {option.label} <span className="font-mono text-[10px]">{counts[option.id]}</span>
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card className="mt-4 text-xs text-steel-dim">
          {recorded.length === 0
            ? "Nenhum dia registrado ainda. Escolha uma data acima para começar."
            : filter === "partial"
              ? "Nenhum dia parcial. Todos os dias registrados estão marcados como completos."
              : "Nenhum dia marcado como completo ainda."}
        </Card>
      ) : groups.map(([month, entries]) => (
        <div key={month}>
          <SectionTitle accent="steel">
            {fromDateKey(`${month}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </SectionTitle>
          <div className="space-y-3">
            {entries.map((day) => {
              const totals = dayTotals(day)
              const dateLabel = fromDateKey(day.date).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "2-digit", year: "numeric",
              })
              return (
                <article key={day.date} aria-label={`Alimentação de ${dateLabel}`}>
                  <Card>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-bone">
                        <time dateTime={day.date}>{dateLabel}</time>
                        {day.date === todayKey && <span className="ml-2 text-xs text-steel-dim">hoje</span>}
                      </h3>
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase",
                        day.completo ? "border-zone/30 bg-zone/5 text-zone" : "border-gold/30 bg-gold/5 text-gold"
                      )}>
                        {day.completo ? "completo" : "parcial"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-steel">
                      {day.refeicoes.length} refeição(ões){" · "}
                      <span className="text-gold">{totals.kcal.toLocaleString("pt-BR")} kcal</span>{" · "}
                      <span className="text-zone">{totals.proteinaG} g prot</span>
                    </p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-steel-dim">
                      {day.refeicoes.map((meal) => meal.nome).join(" · ") || "Sem refeições registradas."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-seam pt-3">
                      <button
                        type="button"
                        onClick={() => onOpenDay(day.date)}
                        disabled={saving}
                        aria-label={`Editar alimentação de ${dateLabel}`}
                        className="flex items-center gap-1.5 rounded border border-seam px-3 py-2 text-xs font-semibold text-bone transition-colors hover:border-ember disabled:opacity-40"
                      >
                        <Pencil size={13} /> Editar dia
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetComplete(day.date, !day.completo)}
                        disabled={saving}
                        aria-pressed={day.completo}
                        aria-label={`Registrei tudo em ${dateLabel}`}
                        className={cn(
                          "flex items-center gap-2 rounded border px-3 py-2 text-xs transition-colors disabled:opacity-40",
                          day.completo ? "border-zone/30 bg-zone/5 text-zone" : "border-seam text-steel hover:border-zone"
                        )}
                      >
                        <span className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          day.completo ? "border-zone bg-zone text-coal" : "border-steel-dim text-transparent"
                        )}>
                          <Check size={11} strokeWidth={3} />
                        </span>
                        {completingDate === day.date ? "Salvando…" : "Registrei tudo"}
                      </button>
                    </div>
                  </Card>
                </article>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
