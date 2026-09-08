"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MealCalendarDay, MealCalendarWeek, SlotShare } from "@/lib/nutrition"
import { cn, fromDateKey, WEEKDAY_SHORT } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Calendário alimentar                                                 */
/* ------------------------------------------------------------------ */

const KIND_CLASS: Record<MealCalendarDay["kind"], string> = {
  none: "bg-iron-2 border border-seam",
  partial: "bg-gold",
  complete: "bg-zone",
}

const KIND_LABEL: Record<Exclude<MealCalendarDay["kind"], "none">, string> = {
  partial: "parcial",
  complete: "completo",
}

function describeDay(day: MealCalendarDay): string {
  const d = fromDateKey(day.key)
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
  if (day.kind === "none") {
    return day.isFuture ? `${date} · ainda não chegou` : `${date} · sem registro`
  }
  return `${date} · ${day.refeicoes} refeição(ões) · ${day.kcal.toLocaleString("pt-BR")} kcal · ${day.proteinaG} g prot · ${KIND_LABEL[day.kind]}`
}

/**
 * Fita de cobertura do diário — mesma linguagem do calendário de treino.
 *
 * O valor aqui é mais comportamental que analítico: ver os buracos é o que
 * faz marcar o dia como completo. Sem dia completo, a reconciliação entre
 * ingestão registrada e derivada não tem o que comparar.
 *
 * Como no calendário de treino: a fita nasce rolada até hoje, e o dia é lido
 * por TOQUE num leitor fixo, porque num celular não existe hover.
 */
export function MealCalendar({
  weeks,
  onPickDay,
}: {
  weeks: MealCalendarWeek[]
  onPickDay?: (key: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<MealCalendarDay | null>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [weeks.length])

  const lastLogged = useMemo(
    () =>
      weeks
        .flatMap((w) => w.days)
        .filter((d) => d.kind !== "none")
        .pop() ?? null,
    [weeks]
  )
  const reading = selected ?? lastLogged

  return (
    <div>
      <p className="mb-2 min-h-[18px] font-mono text-[11px] text-steel">
        {reading ? (
          <>
            <span className="text-bone">{describeDay(reading)}</span>
            {!selected && <span className="text-steel-dim"> · toque num dia</span>}
          </>
        ) : (
          <span className="text-steel-dim">Toque num dia para ler o registro</span>
        )}
      </p>

      <div className="flex gap-1.5">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[14px]">
          {WEEKDAY_SHORT.map((label, i) => (
            <span
              key={label}
              className="h-[14px] font-mono text-[8px] leading-[14px] text-steel-dim"
              style={{ visibility: i % 2 === 0 ? "visible" : "hidden" }}
            >
              {label.slice(0, 1)}
            </span>
          ))}
        </div>

        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-x-auto pb-1"
          style={{ overscrollBehaviorX: "contain" }}
        >
          <div className="flex gap-[3px]">
            {weeks.map((week) => (
              <div key={week.start} className="flex flex-col gap-[3px]">
                <span className="h-[11px] font-mono text-[8px] leading-[11px] text-steel-dim">
                  {week.monthLabel ?? ""}
                </span>
                {week.days.map((day) => {
                  const isSelected = selected?.key === day.key
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setSelected(day)
                        if (day.kind !== "none" && !day.isFuture) onPickDay?.(day.key)
                      }}
                      aria-label={describeDay(day)}
                      aria-pressed={isSelected}
                      className={cn(
                        "h-[14px] w-[14px] rounded-[2px] transition-transform",
                        day.isFuture
                          ? "border border-dashed border-seam bg-transparent"
                          : KIND_CLASS[day.kind],
                        day.kind !== "none" && "opacity-90",
                        day.isToday && "ring-1 ring-bone ring-offset-1 ring-offset-iron",
                        isSelected && "scale-125 ring-1 ring-bone"
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-steel-dim">
        {(["complete", "partial"] as const).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <i className={cn("inline-block h-2.5 w-2.5 rounded-[2px]", KIND_CLASS[kind])} />
            {KIND_LABEL[kind]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[2px] border border-seam bg-iron-2" />
          sem registro
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Distribuição por refeição                                            */
/* ------------------------------------------------------------------ */

/**
 * Onde a alimentação se concentra no dia. Duas barras por refeição, cada uma
 * na sua unidade: participação nas calorias e na proteína.
 *
 * As duas juntas expõem o slot desperdiçado — a refeição que pesa nas
 * calorias sem entregar proteína aparece com a barra de cima longa e a de
 * baixo curta, e nenhuma das duas sozinha mostraria isso.
 */
export function SlotDistribution({ shares }: { shares: SlotShare[] }) {
  if (shares.length === 0) {
    return <p className="py-2 text-xs text-steel-dim">Nada registrado neste dia.</p>
  }

  const pct = (value: number) => `${Math.round(value * 100)}%`

  return (
    <div className="space-y-3">
      {shares.map((share) => (
        <div key={share.slot}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-semibold text-bone">
              {share.label}
              {share.refeicoes > 1 && (
                <span className="ml-1 font-mono text-[10px] font-normal text-steel-dim">
                  ×{share.refeicoes}
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-steel">
              <span className="text-gold">{share.kcal.toLocaleString("pt-BR")} kcal</span>
              {" · "}
              <span className="text-zone">{share.proteinaG} g prot</span>
            </span>
          </div>

          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-coal">
                <div
                  className="h-full rounded-full bg-gold/70"
                  style={{ width: pct(share.kcalShare) }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[9px] text-steel-dim">
                {pct(share.kcalShare)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-coal">
                <div
                  className="h-full rounded-full bg-zone/70"
                  style={{ width: pct(share.proteinaShare) }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[9px] text-steel-dim">
                {pct(share.proteinaShare)}
              </span>
            </div>
          </div>
        </div>
      ))}

      <p className="pt-1 font-mono text-[10px] text-steel-dim">
        <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-gold/70" />
        calorias
        <i className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-zone/70" />
        proteína
      </p>
    </div>
  )
}
