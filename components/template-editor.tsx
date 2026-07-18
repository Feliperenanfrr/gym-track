"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react"
import {
  CatalogExercise,
  groupOfExercise,
  makeCustomExercise,
  MUSCLE_GROUP_OPTIONS,
} from "@/lib/exercise-catalog"
import { ExercisePrescription, MuscleGroup, SessionPlan } from "@/lib/types"
import { cn } from "@/lib/utils"

function cloneSession(session: SessionPlan): SessionPlan {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({ ...exercise })),
    cardioAfter: session.cardioAfter ? { ...session.cardioAfter } : undefined,
    cardioTarget: session.cardioTarget ? { ...session.cardioTarget } : undefined,
  }
}

export function TemplateEditor({
  session,
  catalog,
  onClose,
  onSave,
}: {
  session: SessionPlan | null
  catalog: CatalogExercise[]
  onClose: () => void
  onSave: (template: SessionPlan) => Promise<void>
}) {
  const [draft, setDraft] = useState<SessionPlan | null>(null)
  const [pickerGroup, setPickerGroup] = useState<MuscleGroup>("Posterior/Glúteo")
  const [search, setSearch] = useState("")
  const [customName, setCustomName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(session ? cloneSession(session) : null)
    setSearch("")
    setCustomName("")
    setError(null)
  }, [session])

  const options = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR")
    return catalog.filter(
      (exercise) =>
        exercise.muscleGroup === pickerGroup &&
        (!query ||
          exercise.name.toLocaleLowerCase("pt-BR").includes(query) ||
          exercise.nameEn.toLocaleLowerCase("en").includes(query))
    )
  }, [catalog, pickerGroup, search])

  if (!session || !draft) return null

  const updateExercise = (id: string, patch: Partial<ExercisePrescription>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((exercise) =>
              exercise.id === id ? { ...exercise, ...patch } : exercise
            ),
          }
        : current
    )
  }

  const addExercise = (exercise: ExercisePrescription) => {
    if (draft.exercises.some((candidate) => candidate.id === exercise.id)) {
      setError("Este exercício já está no template.")
      return
    }
    setDraft({ ...draft, exercises: [...draft.exercises, { ...exercise }] })
    setError(null)
  }

  const removeExercise = (id: string) => {
    setDraft({
      ...draft,
      exercises: draft.exercises.filter((exercise) => exercise.id !== id),
    })
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= draft.exercises.length) return
    const exercises = [...draft.exercises]
    ;[exercises[index], exercises[target]] = [exercises[target], exercises[index]]
    setDraft({ ...draft, exercises })
  }

  const addCustom = () => {
    if (!customName.trim()) return
    addExercise(makeCustomExercise(customName, pickerGroup))
    setCustomName("")
  }

  const handleSave = async () => {
    const invalid = draft.exercises.find(
      (exercise) =>
        !exercise.name.trim() ||
        exercise.sets < 1 ||
        exercise.repsMin < 1 ||
        exercise.repsMax < exercise.repsMin ||
        !exercise.rest.trim()
    )
    if (invalid) {
      setError(`Revise a prescrição de ${invalid.name || "um exercício"}.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const normalized = cloneSession(draft)
      normalized.exercises = normalized.exercises.map((exercise) => ({
        ...exercise,
        muscleGroup: groupOfExercise(exercise),
      }))
      await onSave(normalized)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-editor-title"
    >
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-seam bg-coal shadow-2xl sm:rounded-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-seam bg-coal/95 px-4 py-4 backdrop-blur">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-gold">
              Próximos treinos
            </p>
            <h2 id="template-editor-title" className="stencil mt-1 text-2xl text-bone">
              Editar {session.title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-steel-dim">
              Isto altera o template no banco. Remover algo durante o registro do dia não
              chega até aqui.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-seam text-steel transition-colors hover:text-bone disabled:opacity-40"
            aria-label="Fechar editor"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {draft.exercises.length === 0 && (
            <div className="rounded-lg border border-dashed border-seam px-4 py-6 text-center text-sm text-steel-dim">
              O template está vazio. Adicione um exercício abaixo.
            </div>
          )}

          {draft.exercises.map((exercise, index) => (
            <div key={exercise.id} className="rounded-lg border border-seam bg-iron p-3">
              <div className="flex items-start gap-2">
                <span className="score mt-1 w-6 shrink-0 text-center text-lg text-gold">
                  {index + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <label className="text-[10px] uppercase tracking-wide text-steel-dim">
                    Nome
                    <input
                      value={exercise.name}
                      onChange={(event) => updateExercise(exercise.id, { name: event.target.value })}
                      className="mt-1 w-full rounded border border-seam bg-coal px-2.5 py-2 text-sm normal-case tracking-normal text-bone outline-none focus:border-gold"
                    />
                  </label>
                  <label className="text-[10px] uppercase tracking-wide text-steel-dim">
                    Nome em inglês
                    <input
                      value={exercise.nameEn}
                      onChange={(event) => updateExercise(exercise.id, { nameEn: event.target.value })}
                      className="mt-1 w-full rounded border border-seam bg-coal px-2.5 py-2 text-sm normal-case tracking-normal text-bone outline-none focus:border-gold"
                    />
                  </label>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => moveExercise(index, -1)}
                    disabled={index === 0}
                    className="flex h-8 w-8 items-center justify-center rounded border border-seam text-steel hover:text-bone disabled:opacity-25"
                    aria-label={`Subir ${exercise.name}`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveExercise(index, 1)}
                    disabled={index === draft.exercises.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded border border-seam text-steel hover:text-bone disabled:opacity-25"
                    aria-label={`Descer ${exercise.name}`}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.id)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-red-500/20 text-steel-dim hover:text-red-400"
                    aria-label={`Remover ${exercise.name} do template`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="text-[9px] uppercase text-steel-dim">
                  Séries
                  <input
                    type="number"
                    min={1}
                    value={exercise.sets}
                    onChange={(event) =>
                      updateExercise(exercise.id, { sets: Number(event.target.value) })
                    }
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                  />
                </label>
                <label className="text-[9px] uppercase text-steel-dim">
                  Reps mín.
                  <input
                    type="number"
                    min={1}
                    value={exercise.repsMin}
                    onChange={(event) =>
                      updateExercise(exercise.id, { repsMin: Number(event.target.value) })
                    }
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                  />
                </label>
                <label className="text-[9px] uppercase text-steel-dim">
                  Reps máx.
                  <input
                    type="number"
                    min={1}
                    value={exercise.repsMax}
                    onChange={(event) =>
                      updateExercise(exercise.id, { repsMax: Number(event.target.value) })
                    }
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                  />
                </label>
                <label className="text-[9px] uppercase text-steel-dim">
                  Unidade
                  <select
                    value={exercise.unit}
                    onChange={(event) =>
                      updateExercise(exercise.id, {
                        unit: event.target.value as ExercisePrescription["unit"],
                      })
                    }
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 text-xs text-bone outline-none focus:border-gold"
                  >
                    <option value="reps">reps</option>
                    <option value="seconds">segundos</option>
                  </select>
                </label>
                <label className="col-span-2 text-[9px] uppercase text-steel-dim">
                  Descanso
                  <input
                    value={exercise.rest}
                    onChange={(event) => updateExercise(exercise.id, { rest: event.target.value })}
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 font-mono text-xs normal-case text-bone outline-none focus:border-gold"
                  />
                </label>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <label className="text-[9px] uppercase text-steel-dim">
                  Grupo
                  <select
                    value={groupOfExercise(exercise)}
                    onChange={(event) =>
                      updateExercise(exercise.id, {
                        muscleGroup: event.target.value as MuscleGroup,
                      })
                    }
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 text-xs normal-case text-bone outline-none focus:border-gold"
                  >
                    {MUSCLE_GROUP_OPTIONS.map((group) => (
                      <option key={group}>{group}</option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2 text-[9px] uppercase text-steel-dim">
                  Orientação
                  <input
                    value={exercise.note}
                    onChange={(event) => updateExercise(exercise.id, { note: event.target.value })}
                    className="mt-1 w-full rounded border border-seam bg-coal px-2 py-2 text-xs normal-case text-bone outline-none focus:border-gold"
                  />
                </label>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-gold/25 bg-gold/5 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[10px] uppercase tracking-wide text-steel-dim">
                Grupo para adicionar
                <select
                  value={pickerGroup}
                  onChange={(event) => setPickerGroup(event.target.value as MuscleGroup)}
                  className="mt-1 w-full rounded border border-seam bg-coal px-3 py-2.5 text-sm normal-case text-bone outline-none focus:border-gold"
                >
                  {MUSCLE_GROUP_OPTIONS.map((group) => (
                    <option key={group}>{group}</option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-steel-dim">
                Buscar exercício
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ex.: Power Clean"
                  className="mt-1 w-full rounded border border-seam bg-coal px-3 py-2.5 text-sm normal-case text-bone outline-none focus:border-gold"
                />
              </label>
            </div>
            <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {options.map((exercise) => {
                const added = draft.exercises.some((candidate) => candidate.id === exercise.id)
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => addExercise(exercise)}
                    disabled={added}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded border px-3 py-2 text-left transition-colors",
                      added
                        ? "border-seam bg-iron text-steel-dim opacity-45"
                        : "border-seam bg-coal text-bone hover:border-gold/60"
                    )}
                  >
                    <span className="text-sm font-semibold">{exercise.name}</span>
                    <Plus size={14} className="shrink-0" />
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex gap-2 border-t border-gold/15 pt-3">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addCustom()
                  }
                }}
                placeholder="Ou crie um exercício personalizado"
                className="min-w-0 flex-1 rounded border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customName.trim()}
                className="rounded bg-gold px-3 py-2 text-xs font-bold uppercase tracking-wide text-coal disabled:opacity-40"
              >
                Criar
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-seam bg-coal/95 p-4 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-md border border-seam px-4 py-3 text-sm font-semibold text-steel hover:text-bone disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex flex-[2] items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-bold uppercase tracking-wider text-coal hover:bg-amber-300 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Salvando…" : "Salvar template"}
          </button>
        </div>
      </div>
    </div>
  )
}
