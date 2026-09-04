"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { CalendarDay, CalendarWeek } from "@/lib/consistency"
import { PLAN_BY_ID } from "@/lib/plan"
import { SessionId } from "@/lib/types"
import { cn, fromDateKey, WEEKDAY_SHORT } from "@/lib/utils"

/**
 * Mapa de calendário dos treinos.
 *
 * Fita rolável de semanas (colunas) por dia da semana (linhas), ancorada na
 * semana corrente. É a leitura que faltava no painel: volume e Zona 2 eram
 * medidos com precisão enquanto os buracos de duas e três semanas não
 * apareciam em lugar nenhum.
 *
 * Decisões de celular, que é onde o app roda:
 * - a fita nasce rolada até o fim (a semana de hoje), não no começo;
 * - `overscroll-behavior-x: contain` impede que o fim da rolagem horizontal
 *   vire gesto de "voltar" do iOS e derrube a tela;
 * - não existe hover num iPhone, então o dia é lido por TOQUE num leitor fixo
 *   acima da fita — mesmo padrão do painel de calorias.
 */

const KIND_CLASS: Record<CalendarDay["kind"], string> = {
  none: "bg-iron-2 border border-seam",
  lift: "bg-ember",
  cardio: "bg-zone",
  both: "bg-gold",
}

const KIND_LABEL: Record<Exclude<CalendarDay["kind"], "none">, string> = {
  lift: "Sala",
  cardio: "Cardio",
  both: "Sala + cardio",
}

function describeDay(day: CalendarDay): string {
  const d = fromDateKey(day.key)
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
  if (day.kind === "none") {
    return day.isFuture ? `${date} · ainda não chegou` : `${date} · sem registro`
  }
  const titles = [
    ...new Set(
      day.sessionIds.map(
        (id: SessionId) => PLAN_BY_ID[id]?.title ?? id
      )
    ),
  ]
  return `${date} · ${titles.join(" + ")}`
}

export function TrainingCalendar({ weeks }: { weeks: CalendarWeek[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<CalendarDay | null>(null)

  // abre já no presente: a fita cresce para a esquerda, o que interessa é a direita
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [weeks.length])

  const lastTrained = useMemo(
    () =>
      weeks
        .flatMap((w) => w.days)
        .filter((d) => d.kind !== "none")
        .pop() ?? null,
    [weeks]
  )
  const reading = selected ?? lastTrained

  return (
    <div>
      {/* leitor por toque — no celular não existe hover */}
      <p className="mb-2 min-h-[18px] font-mono text-[11px] text-steel">
        {reading ? (
          <>
            <span className="text-bone">{describeDay(reading)}</span>
            {!selected && (
              <span className="text-steel-dim"> · toque num dia</span>
            )}
          </>
        ) : (
          <span className="text-steel-dim">Toque num dia para ler o registro</span>
        )}
      </p>

      <div className="flex gap-1.5">
        {/* trilha fixa dos dias da semana */}
        <div className="flex shrink-0 flex-col gap-[3px] pt-[14px]">
          {WEEKDAY_SHORT.map((label, i) => (
            <span
              key={label}
              className="h-[14px] font-mono text-[8px] leading-[14px] text-steel-dim"
              // seg/qua/sex bastam para orientar sem poluir a coluna
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
                      onClick={() => setSelected(day)}
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
        {(["lift", "cardio", "both"] as const).map((kind) => (
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
