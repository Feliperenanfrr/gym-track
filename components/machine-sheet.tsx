"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Archive, Check, ChevronDown, Cog, History, Pencil, X } from "lucide-react"
import { BackfillCandidate } from "@/lib/machines"
import { ExerciseMachine, ExerciseLog } from "@/lib/types"
import { LoadUnit } from "@/lib/units"
import { cn } from "@/lib/utils"

interface MachineSheetProps {
  exerciseName: string
  /** máquinas ativas do exercício */
  machines: ExerciseMachine[]
  selectedId: string | null
  /** unidade sugerida para a máquina nova: a que o exercício já usa */
  defaultUnit: LoadUnit
  /** "03/10 · 160 lb × 12·12" por id de máquina; "" para sem máquina */
  lastUse: Record<string, string | undefined>
  /** treinos antigos sem máquina (só com uma máquina escolhida) */
  candidates: BackfillCandidate[]
  /** resumo de um treino antigo na unidade da máquina escolhida */
  describe: (entry: ExerciseLog) => string
  onSelect: (machineId: string | null) => void
  onCreate: (name: string, unit: LoadUnit) => void
  onRename: (machine: ExerciseMachine, name: string) => void
  onArchive: (machine: ExerciseMachine) => void
  /** marca os treinos; devolve quantos foram regravados */
  onTag: (keys: string[]) => Promise<number>
  onClose: () => void
}

const NAME_MAX = 40

/**
 * Botão da máquina no card do exercício. Escolhida = chip dourado com o nome;
 * há máquinas mas nenhuma escolhida = pergunta; nenhuma cadastrada = convite
 * discreto (tracejado), para não pesar nos exercícios que não precisam.
 */
export function MachineChip({
  label,
  hasMachines,
  onOpen,
}: {
  /** nome da máquina do dia; null = sem máquina */
  label: string | null
  hasMachines: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        "inline-flex h-9 max-w-[62%] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.98]",
        label
          ? "border-gold/50 bg-gold/10 text-gold"
          : hasMachines
            ? "border-seam bg-iron-2/40 text-steel hover:text-bone"
            : "border-dashed border-seam text-steel-dim hover:text-bone"
      )}
    >
      <Cog size={13} className="shrink-0" aria-hidden />
      <span className="truncate">{label ?? (hasMachines ? "Qual máquina?" : "Máquina")}</span>
      <ChevronDown size={13} className="shrink-0" aria-hidden />
    </button>
  )
}

function shortDate(key: string): string {
  const [, m, d] = key.split("-")
  return `${d}/${m}`
}

/**
 * Seletor de máquina — sobe de baixo, na zona do polegar. Escolher fecha;
 * criar mantém aberto, porque é o momento de marcar os treinos antigos que
 * foram nela (com palpite: pilha em lb puxa as sessões com cara de lb).
 */
export function MachineSheet({
  exerciseName,
  machines,
  selectedId,
  defaultUnit,
  lastUse,
  candidates,
  describe,
  onSelect,
  onCreate,
  onRename,
  onArchive,
  onTag,
  onClose,
}: MachineSheetProps) {
  const titleId = useId()
  const [newName, setNewName] = useState("")
  const [newUnit, setNewUnit] = useState<LoadUnit>(defaultUnit)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [tagging, setTagging] = useState(false)
  const [tagResult, setTagResult] = useState<string | null>(null)

  const selected = machines.find((machine) => machine.id === selectedId) ?? null
  const candidateKeys = useMemo(() => candidates.map((c) => c.key).join(","), [candidates])

  // o palpite vem marcado; trocar de máquina refaz o palpite
  useEffect(() => {
    setChecked(new Set(candidates.filter((c) => c.suggested).map((c) => c.key)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKeys, selectedId])

  // Esc fecha, como qualquer folha
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const create = () => {
    const name = newName.trim().slice(0, NAME_MAX)
    if (!name) return
    onCreate(name, newUnit)
    setNewName("")
    setTagResult(null)
    setBackfillOpen(false)
  }

  const saveRename = (machine: ExerciseMachine) => {
    const name = editName.trim().slice(0, NAME_MAX)
    if (name && name !== machine.name) onRename(machine, name)
    setEditingId(null)
  }

  const toggle = (key: string) =>
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const tag = async () => {
    if (checked.size === 0) return
    setTagging(true)
    try {
      const count = await onTag([...checked])
      setTagResult(
        count === 1
          ? "1 treino marcado — já entra na comparação."
          : `${count} treinos marcados — já entram na comparação.`
      )
      setBackfillOpen(false)
    } catch (e) {
      setTagResult(e instanceof Error ? e.message : "Não deu para marcar agora.")
    } finally {
      setTagging(false)
    }
  }

  return (
    // mesma camada dos diálogos do app: acima da barra de navegação (z-50)
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-coal/70 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rise relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-b-0 border-seam bg-iron px-4 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.55)] md:max-w-2xl"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-seam" aria-hidden />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              Máquina
            </p>
            <h2 id={titleId} className="truncate text-base font-semibold text-bone">
              {exerciseName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-steel-dim transition-colors hover:text-bone"
            aria-label="Fechar seletor de máquina"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-steel-dim">
          Carga, setas e PR só se comparam dentro da mesma máquina — trocar de
          máquina não parece mais regressão.
        </p>

        {/* opções — linhas de 56 px, toque em qualquer lugar escolhe */}
        <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Máquina usada">
          {machines.map((machine) =>
            editingId === machine.id ? (
              <div key={machine.id} className="rounded-lg border border-gold/50 bg-coal p-2.5">
                <input
                  autoFocus
                  value={editName}
                  maxLength={NAME_MAX}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveRename(machine)
                  }}
                  aria-label="Nome da máquina"
                  className="w-full rounded-md border border-seam bg-iron px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onArchive(machine)
                      setEditingId(null)
                    }}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-seam text-xs font-semibold text-steel transition-colors hover:border-red-500/40 hover:text-red-400"
                  >
                    <Archive size={14} /> Arquivar
                  </button>
                  <button
                    onClick={() => saveRename(machine)}
                    className="h-10 rounded-md bg-gold text-xs font-bold uppercase tracking-wide text-coal transition-colors hover:bg-gold/85"
                  >
                    Salvar
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-steel-dim">
                  Arquivar tira da lista; os treinos feitos nela continuam no histórico.
                </p>
              </div>
            ) : (
              <div
                key={machine.id}
                className={cn(
                  "flex items-center rounded-lg border transition-colors",
                  machine.id === selectedId ? "border-gold bg-gold/10" : "border-seam bg-coal"
                )}
              >
                <button
                  role="radio"
                  aria-checked={machine.id === selectedId}
                  onClick={() => onSelect(machine.id)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      machine.id === selectedId ? "border-gold bg-gold text-coal" : "border-seam"
                    )}
                  >
                    {machine.id === selectedId && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-bone">{machine.name}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase",
                          machine.loadUnit === "lb" ? "bg-gold/15 text-gold" : "bg-iron-2 text-steel"
                        )}
                      >
                        {machine.loadUnit}
                      </span>
                    </span>
                    <span className="block truncate font-mono text-[10px] text-steel-dim">
                      {lastUse[machine.id] ?? "sem registros ainda — a 1ª vez vira a base"}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setEditingId(machine.id)
                    setEditName(machine.name)
                  }}
                  className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-steel-dim transition-colors hover:text-bone"
                  aria-label={`Renomear ou arquivar ${machine.name}`}
                >
                  <Pencil size={15} />
                </button>
              </div>
            )
          )}

          <button
            role="radio"
            aria-checked={selectedId === null}
            onClick={() => onSelect(null)}
            className={cn(
              "flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
              selectedId === null ? "border-gold bg-gold/10" : "border-seam bg-coal"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selectedId === null ? "border-gold bg-gold text-coal" : "border-seam"
              )}
            >
              {selectedId === null && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-steel">Sem máquina</span>
              <span className="block truncate font-mono text-[10px] text-steel-dim">
                {lastUse[""] ?? "registros sem máquina definida"}
              </span>
            </span>
          </button>
        </div>

        {/* treinos antigos: o momento de separar o histórico é ao criar */}
        {selected && candidates.length > 0 && (
          <div className="mt-3 rounded-lg border border-zone/30 bg-zone/5 p-2.5">
            {!backfillOpen ? (
              <button
                onClick={() => {
                  setBackfillOpen(true)
                  setTagResult(null)
                }}
                className="flex min-h-11 w-full items-center gap-2 text-left"
              >
                <History size={15} className="shrink-0 text-zone" />
                <span className="min-w-0 flex-1 text-xs leading-snug text-zone">
                  <span className="font-semibold">
                    {candidates.length} {candidates.length === 1 ? "treino antigo" : "treinos antigos"} sem
                    máquina
                  </span>{" "}
                  — marcar os que foram na {selected.name}
                </span>
              </button>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-zone">
                  Marcado = feito na <span className="font-semibold">{selected.name}</span>. O app já
                  marcou os que{" "}
                  {selected.loadUnit === "lb"
                    ? "parecem pilha em lb convertida de cabeça"
                    : "não parecem pilha em lb"}
                  ; confira e ajuste.
                </p>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {candidates.map((candidate) => (
                    <li key={candidate.key}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-seam bg-coal px-2.5 py-1.5">
                        <input
                          type="checkbox"
                          checked={checked.has(candidate.key)}
                          onChange={() => toggle(candidate.key)}
                          className="h-5 w-5 shrink-0 accent-zone"
                        />
                        <span className="w-11 shrink-0 font-mono text-[11px] text-steel-dim">
                          {shortDate(candidate.date)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-bone">
                          {describe(candidate.entry)}
                        </span>
                        {candidate.suggested && (
                          <span className="shrink-0 rounded bg-zone/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zone">
                            palpite
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                  <button
                    onClick={() => setBackfillOpen(false)}
                    className="h-11 rounded-md border border-seam px-4 text-xs font-semibold text-steel transition-colors hover:text-bone"
                  >
                    Agora não
                  </button>
                  <button
                    onClick={tag}
                    disabled={checked.size === 0 || tagging}
                    className="h-11 rounded-md bg-zone text-xs font-bold uppercase tracking-wide text-coal transition-colors hover:bg-teal-300 disabled:opacity-40"
                  >
                    {tagging
                      ? "Marcando…"
                      : `Marcar ${checked.size} ${checked.size === 1 ? "treino" : "treinos"}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {tagResult && <p className="mt-2 text-xs text-zone">{tagResult}</p>}

        {/* máquina nova: nome + unidade da pilha, um toque para criar e usar */}
        <div className="mt-4 border-t border-seam pt-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">Nova máquina</p>
          <input
            value={newName}
            maxLength={NAME_MAX}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create()
            }}
            placeholder="Ex.: Extensora do fundo"
            aria-label="Nome da máquina nova"
            className="mt-1.5 w-full rounded-md border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 font-mono text-[10px] uppercase text-steel-dim">Pilha em</span>
            <div className="grid flex-1 grid-cols-2 gap-1.5" role="radiogroup" aria-label="Unidade da pilha">
              {(["kg", "lb"] as const).map((unit) => (
                <button
                  key={unit}
                  role="radio"
                  aria-checked={newUnit === unit}
                  onClick={() => setNewUnit(unit)}
                  className={cn(
                    "h-10 rounded-md border font-mono text-xs font-semibold uppercase transition-colors",
                    newUnit === unit
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-seam text-steel hover:text-bone"
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={create}
            disabled={!newName.trim()}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold text-sm font-bold uppercase tracking-wide text-coal transition-colors hover:bg-gold/85 disabled:opacity-40"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Cog size={15} /> Criar e usar
          </button>
        </div>
      </div>
    </div>
  )
}
