"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import { isCompetitionSession } from "@/lib/competition-plan"
import { EXERCISES_BY_ID, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { CardioPurpose, WorkoutLog } from "@/lib/types"
import { cn, formatKg, fromDateKey, toDateKey, workoutVolume } from "@/lib/utils"

const PURPOSE_OPTIONS: { id: CardioPurpose; label: string; hint: string }[] = [
  { id: "zone2", label: "Zona 2", hint: "conta para a meta semanal de Zona 2" },
  { id: "intense", label: "Intenso", hint: "fica de fora da meta de Z2 — condicionamento à parte" },
  { id: "sport", label: "Esporte", hint: "jogo/luta — não conta como Zona 2" },
]

export default function Historico() {
  const { data, error, deleteWorkout, addWorkout } = useGymData()
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /** editor de cardio do registro aberto (null = fechado) */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHasCardio, setEditHasCardio] = useState(false)
  const [editMinutes, setEditMinutes] = useState("")
  const [editMode, setEditMode] = useState("")
  const [editPurpose, setEditPurpose] = useState<CardioPurpose>("zone2")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  /** data escolhida para registrar um treino esquecido */
  const [backfillDate, setBackfillDate] = useState("")

  const workouts = useMemo(() => {
    if (!data) return []
    return [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))
  }, [data])

  const openEditor = (w: WorkoutLog) => {
    if (editingId === w.id) {
      setEditingId(null)
      return
    }
    setEditingId(w.id)
    setEditError(null)
    setEditHasCardio(Boolean(w.cardio))
    setEditMinutes(w.cardio ? String(w.cardio.minutes) : "")
    setEditMode(w.cardio?.mode ?? "Bike ergométrica")
    setEditPurpose(w.cardio?.purpose ?? (w.sessionId === "sport" ? "sport" : "zone2"))
  }

  const saveEdit = async (w: WorkoutLog) => {
    const minutes = parseInt(editMinutes) || 0
    if (editHasCardio && minutes <= 0) {
      setEditError("Informe os minutos de cardio.")
      return
    }
    if (editHasCardio && !editMode.trim()) {
      setEditError("Informe a modalidade do cardio.")
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      await addWorkout({
        ...w,
        ...(editHasCardio
          ? {
              cardio: {
                minutes,
                avgBpm: w.cardio?.avgBpm,
                mode: editMode.trim(),
                purpose: editPurpose,
              },
            }
          : { cardio: undefined }),
      })
      setEditingId(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erro ao salvar alteração")
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (id: string, date: string, sessionId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este treino? Essa ação não pode ser desfeita.")) {
      return
    }
    setDeletingId(id)
    try {
      await deleteWorkout(id, date, sessionId)
    } finally {
      setDeletingId(null)
    }
  }

  if (error) {
    return (
      <main>
        <PageHeader kicker="HISTÓRICO" title="Treinos" />
        <Card className="border-l-4 border-l-ember text-sm text-steel">
          Erro ao carregar do banco: {error}
        </Card>
      </main>
    )
  }

  if (!data) {
    return (
      <main>
        <PageHeader kicker="HISTÓRICO" title="Treinos" />
        <Card className="mb-4"><Skeleton className="h-24 w-full" /></Card>
        <Card className="mb-4"><Skeleton className="h-24 w-full" /></Card>
        <Card className="mb-4"><Skeleton className="h-24 w-full" /></Card>
      </main>
    )
  }

  return (
    <main className="pb-10">
      <PageHeader
        kicker="REGISTROS"
        title="Histórico"
        left={
          <Link href="/" className="mb-1 text-steel transition-colors hover:text-bone">
            <ArrowLeft size={20} />
          </Link>
        }
      />

      {/* treino esquecido — abre o registro apontando para o dia escolhido */}
      <Card className="rise mb-4 border-dashed">
        <p className="text-sm font-semibold text-bone">Esqueceu de registrar um treino?</p>
        <p className="mt-0.5 text-xs text-steel-dim">
          Jogo, musculação ou cardio de outro dia: escolha a data e preencha como hoje.
        </p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Dia do treino</span>
            <input
              type="date"
              max={toDateKey(new Date())}
              value={backfillDate}
              onChange={(e) => setBackfillDate(e.target.value)}
              className="w-full rounded-md border border-seam bg-coal px-3 py-2 text-sm text-bone outline-none focus:border-ember"
            />
          </label>
          <button
            onClick={() => router.push(`/treino?data=${backfillDate}`)}
            disabled={!backfillDate}
            className="shrink-0 rounded-md bg-ember px-4 py-2 text-sm font-bold uppercase tracking-wide text-coal transition-colors hover:bg-ember-hot disabled:opacity-40"
          >
            Abrir registro
          </button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {workouts.length === 0 ? (
          <p className="text-center text-sm text-steel-dim py-10">Nenhum treino registrado ainda.</p>
        ) : (
          workouts.map((w, i) => {
            const date = fromDateKey(w.date)
            const session = PLAN_BY_ID[w.sessionId]
            const volume = workoutVolume(w)
            const editing = editingId === w.id
            const cardioLabel =
              w.cardio?.purpose === "intense"
                ? "intenso"
                : w.cardio?.purpose === "sport" || w.sessionId === "sport"
                  ? "esporte"
                  : "Zona 2"

            return (
              <Card key={w.id} className={cn("rise", `rise-${Math.min(6, i + 1)}`, "relative overflow-hidden")}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-steel" style={{ fontFamily: "var(--font-condensed)" }}>
                      {date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                    </p>
                    <h3 className="stencil mt-1 text-xl text-bone">
                      {session?.title || "Sessão Desconhecida"}
                    </h3>
                    {isCompetitionSession(w.sessionId) && (
                      <span className="mt-1 inline-flex rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gold">
                        competição
                      </span>
                    )}
                    <p className="mt-1 font-mono text-xs text-steel-dim">
                      {w.entries.length} exercícios {volume > 0 && `· ${formatKg(volume)} total`} {w.cardio && `· ${w.cardio.minutes} min ${w.cardio.mode} (${cardioLabel})`}
                    </p>
                    {w.entries.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-seam pt-3">
                        {w.entries.map((entry) => (
                          <li key={entry.exerciseId} className="flex justify-between gap-3 text-xs">
                            <span className="text-steel">
                              {entry.exerciseName ?? EXERCISES_BY_ID[entry.exerciseId]?.name ?? entry.exerciseId}
                            </span>
                            <span className="shrink-0 font-mono text-steel-dim">
                              {entry.sets.length} séries
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEditor(w)}
                      className={cn(
                        "p-2 transition-colors",
                        editing ? "text-ember" : "text-steel-dim hover:text-bone"
                      )}
                      aria-label="Editar cardio deste treino"
                      title="Editar cardio"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(w.id, w.date, w.sessionId)}
                      disabled={deletingId === w.id}
                      className="p-2 text-steel-dim hover:text-ember transition-colors disabled:opacity-50"
                      aria-label="Excluir treino"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* editor inline do cardio — corrige o Z2 fantasma sem refazer o treino */}
                {editing && (
                  <div className="mt-3 space-y-2.5 rounded-lg border border-seam bg-coal/60 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                      Cardio desta sessão
                    </p>
                    <label className="flex items-center gap-2 text-sm font-semibold text-bone">
                      <input
                        type="checkbox"
                        checked={editHasCardio}
                        onChange={(e) => setEditHasCardio(e.target.checked)}
                        className="h-4 w-4 accent-zone"
                      />
                      Houve cardio neste treino
                    </label>
                    {editHasCardio && (
                      <>
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex w-20 flex-col gap-1">
                            <span className="font-mono text-[10px] uppercase text-steel-dim">Min</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={editMinutes}
                              onChange={(e) => setEditMinutes(e.target.value)}
                              className="w-full rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="font-mono text-[10px] uppercase text-steel-dim">Tipo</span>
                            <select
                              value={editPurpose}
                              onChange={(e) => setEditPurpose(e.target.value as CardioPurpose)}
                              className="rounded border border-seam bg-coal px-2 py-1.5 text-sm text-bone outline-none focus:border-gold"
                            >
                              {PURPOSE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="font-mono text-[10px] uppercase text-steel-dim">Modalidade</span>
                            <input
                              type="text"
                              value={editMode}
                              onChange={(e) => setEditMode(e.target.value)}
                              placeholder="Bike, corrida…"
                              className="min-w-0 w-full rounded border border-seam bg-coal px-2 py-1.5 text-sm text-bone outline-none focus:border-gold"
                            />
                          </label>
                        </div>
                        <p className="text-[11px] text-steel-dim">
                          {PURPOSE_OPTIONS.find((o) => o.id === editPurpose)?.hint}
                        </p>
                      </>
                    )}
                    {!editHasCardio && (
                      <p className="text-[11px] text-gold">
                        O cardio será removido deste registro ao salvar.
                      </p>
                    )}
                    {editError && (
                      <p className="rounded border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-xs text-red-400">
                        {editError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(w)}
                        disabled={editSaving}
                        className="flex items-center gap-1.5 rounded bg-zone px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-coal transition-colors hover:bg-zone/85 disabled:opacity-60"
                      >
                        <Check size={14} /> {editSaving ? "Salvando…" : "Salvar alterações"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded border border-seam px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-steel transition-colors hover:text-bone"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </main>
  )
}
