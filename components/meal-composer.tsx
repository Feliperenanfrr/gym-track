"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Minus, Plus, Save, Trash2, X } from "lucide-react"
import {
  formatMacro,
  formatQty,
  macroCoverageNote,
  MEAL_SLOTS,
  mealTotals,
  newId,
  scaleItem,
  snapshotItems,
} from "@/lib/nutrition"
import { Meal, MealItem, MealSlot, MealSource } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * O que abre o compositor. `origem` só muda os rótulos do rodapé — o caminho
 * de escrita é um só, venha de uma refeição fixa, do JSON da gem ou da edição
 * de um registro já salvo.
 */
export interface MealSeed {
  /** presente ao EDITAR um registro já salvo; ausente ao criar um novo */
  mealId?: string
  nome: string
  slot: MealSlot
  itens: MealItem[]
  premissas?: string[]
  /** rastreio da refeição fixa de origem — nunca usado para recalcular nada */
  templateId?: string
  hora?: string
  /** dia de destino quando o JSON traz data própria; senão, o dia selecionado */
  targetDate?: string
  /** posição no lote importado, para a linha sair da lista ao registrar */
  batchIndex?: number
  /** origem da estimativa, preservada no registro */
  fonte?: MealSource
  origem: "fixa" | "json" | "registro"
}

interface Row {
  key: string
  /** item como veio do molde: a base da regra de três da quantidade */
  base: MealItem
  qtd: number
  incluido: boolean
}

function stepFor(unidade: string): number {
  if (unidade === "g") return 10
  if (unidade === "ml") return 50
  return 0.5
}

function seedRows(itens: MealItem[]): Row[] {
  return itens.map((item, index) => ({
    key: `${index}-${item.nome}`,
    base: item,
    qtd: item.qtd,
    incluido: true,
  }))
}

export function MealComposer({
  seed,
  saving,
  onClose,
  onRegister,
  onSaveTemplate,
}: {
  seed: MealSeed | null
  saving: boolean
  onClose: () => void
  onRegister: (meal: Meal) => Promise<void>
  /** Devolve o id do molde salvo, para um segundo toque atualizar em vez de duplicar. */
  onSaveTemplate: (input: {
    nome: string
    slot: MealSlot
    itens: MealItem[]
    templateId?: string
  }) => Promise<string>
}) {
  const [nome, setNome] = useState("")
  const [slot, setSlot] = useState<MealSlot>("almoco")
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  /**
   * Molde de origem. Vive em estado local (e não no seed) porque salvar como
   * fixa não pode reabrir o compositor: isso descartaria os itens que você
   * acabou de desmarcar.
   */
  const [templateId, setTemplateId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!seed) return
    setNome(seed.nome)
    setSlot(seed.slot)
    setRows(seedRows(seed.itens))
    setTemplateId(seed.templateId)
    setError(null)
  }, [seed])

  const selecionados = useMemo(
    () => rows.filter((row) => row.incluido && row.qtd > 0).map((row) => scaleItem(row.base, row.qtd)),
    [rows]
  )
  const totals = useMemo(() => mealTotals(selecionados), [selecionados])
  const coverageNote = macroCoverageNote(totals)

  if (!seed) return null

  const patchRow = (key: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const bumpRow = (row: Row, direction: 1 | -1) => {
    const step = stepFor(row.base.unidade)
    const next = Math.max(0, Math.round((row.qtd + direction * step) * 100) / 100)
    patchRow(row.key, { qtd: next, incluido: next > 0 })
  }

  const buildMeal = (): Meal => ({
    id: seed.mealId ?? newId("meal"),
    nome: nome.trim() || seed.nome,
    slot,
    // snapshot: nunca compartilha referência com o molde de origem
    itens: snapshotItems(selecionados),
    templateId,
    hora: seed.hora,
    premissas: seed.premissas,
    fonte: seed.fonte,
  })

  const handleRegister = async () => {
    if (selecionados.length === 0) {
      setError("Marque pelo menos um item.")
      return
    }
    setError(null)
    try {
      await onRegister(buildMeal())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar a refeição")
    }
  }

  const handleSaveTemplate = async () => {
    if (selecionados.length === 0) {
      setError("Marque pelo menos um item.")
      return
    }
    setError(null)
    try {
      const savedId = await onSaveTemplate({
        nome: nome.trim() || seed.nome,
        slot,
        itens: snapshotItems(selecionados),
        templateId,
      })
      setTemplateId(savedId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a refeição fixa")
    }
  }

  const editando = seed.origem === "registro"
  const templateLabel = templateId ? "Atualizar refeição fixa" : "Salvar como fixa"

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-coal/80 px-4 backdrop-blur-sm"
      style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="rise flex max-h-[82dvh] w-full max-w-md flex-col rounded-lg border border-seam bg-iron shadow-[0_-6px_32px_rgba(0,0,0,0.6)] md:max-w-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Montar refeição"
      >
        {/* cabeçalho: nome e horário da refeição */}
        <div className="flex items-start gap-2.5 border-b border-seam p-4">
          <div className="min-w-0 flex-1">
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full rounded border border-seam bg-coal px-2.5 py-2 text-sm font-semibold text-bone outline-none focus:border-ember"
              placeholder="Nome da refeição"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MEAL_SLOTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSlot(option.id)}
                  aria-pressed={slot === option.id}
                  className={cn(
                    "rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    slot === option.id
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-seam text-steel hover:text-bone"
                  )}
                  style={{ fontFamily: "var(--font-condensed)" }}
                >
                  {option.short}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-1 text-steel-dim transition-colors hover:text-bone"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* itens: desmarcar o que não comeu, ajustar o que repetiu */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {rows.map((row) => {
              const escalado = scaleItem(row.base, row.qtd)
              return (
                <div
                  key={row.key}
                  className={cn(
                    "rounded border px-3 py-2.5 transition-colors",
                    row.incluido && row.qtd > 0
                      ? "border-seam bg-coal/70"
                      : "border-seam/50 bg-coal/30 opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => patchRow(row.key, { incluido: !row.incluido })}
                      aria-pressed={row.incluido}
                      aria-label={row.incluido ? `Remover ${row.base.nome}` : `Incluir ${row.base.nome}`}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        row.incluido && row.qtd > 0
                          ? "border-ember bg-ember text-coal"
                          : "border-steel-dim text-transparent"
                      )}
                    >
                      <Check size={13} strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-bone">{row.base.nome}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
                        {formatQty(escalado)}
                        {escalado.gramas !== undefined ? ` · ${escalado.gramas} g` : ""}
                        {" · "}
                        <span className="text-gold">{escalado.kcal} kcal</span>
                        {" · "}
                        <span className="text-zone">{escalado.proteinaG} g prot</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                      className="shrink-0 rounded p-1 text-steel-dim transition-colors hover:text-red-400"
                      aria-label={`Excluir ${row.base.nome} desta refeição`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 pl-7">
                    <button
                      type="button"
                      onClick={() => bumpRow(row, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-seam text-steel transition-colors hover:text-bone"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      value={row.qtd}
                      onChange={(event) => {
                        const next = Math.max(0, Number(event.target.value) || 0)
                        patchRow(row.key, { qtd: next, incluido: next > 0 })
                      }}
                      className="w-16 rounded border border-seam bg-coal px-2 py-1 text-center font-mono text-xs text-bone outline-none focus:border-ember"
                    />
                    <button
                      type="button"
                      onClick={() => bumpRow(row, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-seam text-steel transition-colors hover:text-bone"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus size={13} />
                    </button>
                    <span className="font-mono text-[10px] uppercase text-steel-dim">
                      {row.base.unidade}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {seed.premissas && seed.premissas.length > 0 && (
            <div className="mt-3 rounded border border-seam bg-coal/50 px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-steel-dim">
                Premissas da estimativa
              </p>
              <ul className="mt-1 space-y-0.5">
                {seed.premissas.map((premissa, index) => (
                  <li key={index} className="text-[11px] leading-relaxed text-steel">
                    · {premissa}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* totais ao vivo + ações */}
        <div className="border-t border-seam p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="score text-2xl text-zone">
              {totals.proteinaG.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              <span className="ml-1 text-xs font-normal text-steel-dim">g proteína</span>
            </span>
            <span className="font-mono text-xs text-gold">
              {totals.kcal.toLocaleString("pt-BR")} kcal
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-steel-dim">
            {selecionados.length} item(ns) · carbo{" "}
            {formatMacro(totals.carboG, totals.itensSemCarbo)} · gordura{" "}
            {formatMacro(totals.gorduraG, totals.itensSemGordura)}
            {totals.alcoolG > 0 ? ` · álcool ${totals.alcoolG} g` : ""}
          </p>
          {coverageNote && (
            <p className="mt-1 text-[11px] leading-relaxed text-gold">{coverageNote}</p>
          )}

          {error && (
            <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRegister}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded bg-ember px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-coal transition-colors hover:bg-ember-hot disabled:opacity-40"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              <Check size={15} />
              {saving ? "Salvando…" : editando ? "Salvar alteração" : "Registrar refeição"}
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={saving}
              title="Guarda o molde para os próximos dias"
              className="flex items-center gap-1.5 rounded border border-zone/40 bg-zone/5 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zone transition-colors hover:bg-zone/15 disabled:opacity-40"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              <Save size={14} />
              {templateLabel}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-steel-dim">
            A refeição registrada guarda uma cópia dos itens. Mexer na refeição fixa
            depois — reimportando pela gem ou corrigindo um macro — só vale para os
            próximos dias; nada já registrado muda.
          </p>
        </div>
      </div>
    </div>
  )
}
