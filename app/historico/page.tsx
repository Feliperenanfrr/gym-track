"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Minus, Pencil, Plus, Trash2 } from "lucide-react"
import { ConfirmDialog, UndoToast } from "@/components/dialogs"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import { isCompetitionSession } from "@/lib/competition-plan"
import { sessionKcal, weightKgOn } from "@/lib/insights"
import { EXERCISES_BY_ID, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { CardioPurpose, ExerciseLog, MuscleGroup, WorkoutLog } from "@/lib/types"
import { cn, formatKg, fromDateKey, toDateKey, workoutVolume } from "@/lib/utils"

const PURPOSE_OPTIONS: { id: CardioPurpose; label: string; hint: string }[] = [
  { id: "zone2", label: "Zona 2", hint: "conta para a meta semanal de Zona 2" },
  { id: "intense", label: "Intenso", hint: "fica de fora da meta de Z2 — condicionamento à parte" },
  { id: "sport", label: "Esporte", hint: "jogo/luta — não conta como Zona 2" },
]

/** série editável no histórico (strings cruas dos inputs; rir "" = não informado) */
interface EditableSet {
  weight: string
  reps: string
  rir: string
}

interface EditableEntry {
  exerciseId: string
  exerciseName?: string
  muscleGroup?: MuscleGroup
  sets: EditableSet[]
}

function editableEntriesFrom(log: WorkoutLog): EditableEntry[] {
  return log.entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    ...(entry.exerciseName !== undefined ? { exerciseName: entry.exerciseName } : {}),
    ...(entry.muscleGroup !== undefined ? { muscleGroup: entry.muscleGroup } : {}),
    sets: entry.sets.map((s) => ({
      weight: String(s.weight),
      reps: String(s.reps),
      rir: s.rir !== undefined ? String(s.rir) : "",
    })),
  }))
}

/* ---------------------------------------------------------------- */
/* Filtros por tipo de sessão                                        */
/* ---------------------------------------------------------------- */

const KIND_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "lift", label: "Musculação" },
  { id: "cardio", label: "Cardio" },
  { id: "sport", label: "Esporte" },
] as const

type KindFilter = (typeof KIND_FILTERS)[number]["id"]

/** família do registro para os chips de filtro (lift/mixed → musculação) */
function sessionKind(w: WorkoutLog): Exclude<KindFilter, "all"> {
  const kind = PLAN_BY_ID[w.sessionId]?.kind
  if (kind === "sport") return "sport"
  if (w.entries.length > 0) return "lift"
  if (w.cardio?.purpose === "sport") return "sport"
  if (kind === "mixed" || kind === "cardio") return "cardio"
  return "lift"
}

function monthLabel(dateKey: string): string {
  const d = fromDateKey(dateKey)
  const raw = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export default function Historico() {
  const { data, error, deleteWorkout, addWorkout } = useGymData()
  const router = useRouter()
  /** treino aguardando confirmação no diálogo de exclusão */
  const [pendingDelete, setPendingDelete] = useState<WorkoutLog | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  /** exclusão concluída — snackbar com desfazer */
  const [undoState, setUndoState] = useState<{
    message: string
    restore: () => Promise<void>
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  /** filtro ativo por tipo de sessão */
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")

  /** editor do registro aberto (null = fechado): cardio + séries completas */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEntries, setEditEntries] = useState<EditableEntry[] | null>(null)
  const [editHasCardio, setEditHasCardio] = useState(false)
  const [editMinutes, setEditMinutes] = useState("")
  const [editMode, setEditMode] = useState("")
  const [editPurpose, setEditPurpose] = useState<CardioPurpose>("zone2")
  const [editNotes, setEditNotes] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  /** data escolhida para registrar um treino esquecido */
  const [backfillDate, setBackfillDate] = useState("")

  const workouts = useMemo(() => {
    if (!data) return []
    return [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))
  }, [data])

  const filtered = useMemo(
    () =>
      kindFilter === "all"
        ? workouts
        : workouts.filter((w) => sessionKind(w) === kindFilter),
    [workouts, kindFilter]
  )

  /** lista cortada em blocos por mês (mais recente primeiro) */
  const groups = useMemo(() => {
    const out: { label: string; items: WorkoutLog[] }[] = []
    for (const w of filtered) {
      const label = monthLabel(w.date)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(w)
      else out.push({ label, items: [w] })
    }
    return out
  }, [filtered])

  const openEditor = (w: WorkoutLog) => {
    if (editingId === w.id) {
      setEditingId(null)
      setEditEntries(null)
      return
    }
    setEditingId(w.id)
    setEditError(null)
    setEditEntries(editableEntriesFrom(w))
    setEditHasCardio(Boolean(w.cardio))
    setEditMinutes(w.cardio ? String(w.cardio.minutes) : "")
    setEditMode(w.cardio?.mode ?? "Bike ergométrica")
    setEditPurpose(w.cardio?.purpose ?? (w.sessionId === "sport" ? "sport" : "zone2"))
    setEditNotes(w.notes ?? "")
  }

  const closeEditor = () => {
    setEditingId(null)
    setEditEntries(null)
  }

  const updateEditableSet = (ei: number, si: number, patch: Partial<EditableSet>) => {
    setEditEntries((prev) =>
      prev
        ? prev.map((entry, i) =>
            i !== ei
              ? entry
              : { ...entry, sets: entry.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) }
          )
        : prev
    )
  }

  const addEditableSet = (ei: number) => {
    setEditEntries((prev) =>
      prev
        ? prev.map((entry, i) => {
            if (i !== ei) return entry
            const last = entry.sets[entry.sets.length - 1]
            return {
              ...entry,
              sets: [...entry.sets, { weight: last?.weight ?? "", reps: last?.reps ?? "", rir: "" }],
            }
          })
        : prev
    )
  }

  const removeEditableSet = (ei: number) => {
    setEditEntries((prev) =>
      prev
        ? prev.map((entry, i) =>
            i !== ei || entry.sets.length <= 1
              ? entry
              : { ...entry, sets: entry.sets.slice(0, -1) }
          )
        : prev
    )
  }

  const removeEditableEntry = (ei: number) => {
    setEditEntries((prev) => (prev ? prev.filter((_, i) => i !== ei) : prev))
  }

  const saveEdit = async (w: WorkoutLog) => {
    const minutes = parseInt(editMinutes) || 0
    const hasCardio = editHasCardio && minutes > 0

    // mesmas regras de sanitização do registro na aba Treino
    const entries: ExerciseLog[] = (editEntries ?? [])
      .map((e) => ({
        exerciseId: e.exerciseId,
        ...(e.exerciseName !== undefined ? { exerciseName: e.exerciseName } : {}),
        ...(e.muscleGroup !== undefined ? { muscleGroup: e.muscleGroup } : {}),
        sets: e.sets
          .map((s) => ({
            weight: parseFloat(s.weight.replace(",", ".")) || 0,
            reps: parseInt(s.reps) || 0,
            ...(s.rir !== "" ? { rir: parseInt(s.rir) } : {}),
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0)

    if (entries.length === 0 && !hasCardio) {
      setEditError("Sem séries nem cardio para salvar — use Excluir para remover o treino.")
      return
    }
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
        entries,
        ...(editNotes.trim() ? { notes: editNotes.trim() } : { notes: undefined }),
        ...(hasCardio
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
      closeEditor()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erro ao salvar alteração")
    } finally {
      setEditSaving(false)
    }
  }

  /** sRPE retroativo: 1 tap regrava o log (upsert por data+sessão); tap no mesmo valor limpa */
  const rateSrpe = (w: WorkoutLog, value: number | null) => {
    addWorkout({ ...w, ...(value === null ? { srpe: undefined } : { srpe: value }) }).catch(() => {
      setActionError("Não foi possível salvar o esforço — verifique a conexão.")
    })
  }

  /** diálogo confirmou: exclui e arma o desfazer */
  const confirmDelete = async () => {
    const w = pendingDelete
    if (!w) return
    setPendingDelete(null)
    if (editingId === w.id) closeEditor()
    setDeletingId(w.id)
    try {
      await deleteWorkout(w.id, w.date, w.sessionId)
      setUndoState({
        message: `Treino de ${fromDateKey(w.date).toLocaleDateString("pt-BR")} excluído.`,
        restore: () => addWorkout(w),
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erro ao excluir treino")
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

      {/* filtros por tipo */}
      <div className="rise -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setKindFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              kindFilter === f.id
                ? "border-ember bg-ember/15 text-ember"
                : "border-seam bg-iron-2/40 text-steel hover:border-steel/40 hover:text-bone"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="rise mb-3 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {actionError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-steel-dim">
            {workouts.length === 0
              ? "Nenhum treino registrado ainda."
              : "Nada neste filtro — tente outro tipo."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              {/* cabeçalho do mês */}
              <p
                className="mt-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel-dim first:mt-0"
              >
                {group.label}
                <span className="h-px flex-1 bg-seam" />
                <span className="text-bone">{group.items.length}</span>
              </p>
              {group.items.map((w, i) => {
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
            const kcalEst = sessionKcal(w, weightKgOn(data.body, w.date))

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
                      <span className="mt-1 inline-flex rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                        competição
                      </span>
                    )}
                    <p className="mt-1 font-mono text-xs text-steel-dim">
                      {w.entries.length} exercícios {volume > 0 && `· ${formatKg(volume)} total`}{" "}
                      {w.cardio && `· ${w.cardio.minutes} min ${w.cardio.mode} (${cardioLabel})`}
                      {kcalEst && (
                        <span
                          title={`Estimativa por METs (${kcalEst.met}) · faixa ${kcalEst.low}–${kcalEst.high} kcal`}
                          className="text-gold"
                        >
                          {" "}· ≈{kcalEst.mid.toLocaleString("pt-BR")} kcal
                        </span>
                      )}
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
                    {w.notes && (
                      <p className="mt-2 border-t border-seam pt-2 text-xs leading-relaxed text-steel">
                        {w.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEditor(w)}
                      className={cn(
                        "p-2 transition-colors",
                        editing ? "text-ember" : "text-steel-dim hover:text-bone"
                      )}
                      aria-label="Editar este treino"
                      title="Editar treino"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(w)}
                      disabled={deletingId === w.id}
                      className="p-2 text-steel-dim hover:text-ember transition-colors disabled:opacity-50"
                      aria-label="Excluir treino"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* editor inline — corrige séries e cardio sem apagar o treino */}
                {editing && (
                  <div className="mt-3 space-y-2.5 rounded-lg border border-seam bg-coal/60 p-3">
                    {/* séries */}
                    {editEntries && editEntries.length > 0 ? (
                      <div className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                          Séries
                        </p>
                        {editEntries.map((entry, ei) => (
                          <div
                            key={`${entry.exerciseId}-${ei}`}
                            className="rounded-lg border border-seam p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-xs font-semibold text-bone">
                                {entry.exerciseName ??
                                  EXERCISES_BY_ID[entry.exerciseId]?.name ??
                                  entry.exerciseId}
                              </p>
                              <button
                                onClick={() => removeEditableEntry(ei)}
                                className="shrink-0 rounded p-1 text-steel-dim transition-colors hover:text-red-400"
                                aria-label={`Remover exercício ${
                                  entry.exerciseName ?? entry.exerciseId
                                }`}
                                title="Remover exercício"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="mt-1.5 space-y-1.5">
                              {entry.sets.map((s, si) => (
                                <div key={si} className="flex items-center gap-1.5">
                                  <span className="w-4 shrink-0 text-center font-mono text-[10px] text-steel-dim">
                                    {si + 1}
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    value={s.weight}
                                    onChange={(e) =>
                                      updateEditableSet(ei, si, { weight: e.target.value })
                                    }
                                    aria-label={`Peso da série ${si + 1}`}
                                    className="w-16 rounded border border-seam bg-coal px-1 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                                  />
                                  <span className="text-xs text-steel-dim">×</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={s.reps}
                                    onChange={(e) =>
                                      updateEditableSet(ei, si, { reps: e.target.value })
                                    }
                                    aria-label={`Repetições da série ${si + 1}`}
                                    className="w-14 rounded border border-seam bg-coal px-1 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                                  />
                                  <select
                                    value={s.rir}
                                    onChange={(e) =>
                                      updateEditableSet(ei, si, { rir: e.target.value })
                                    }
                                    aria-label={`RIR da série ${si + 1}`}
                                    title="Reps em reserva"
                                    className="w-16 rounded border border-seam bg-coal px-1 py-1.5 text-center font-mono text-xs text-bone outline-none focus:border-gold"
                                  >
                                    <option value="">RIR —</option>
                                    {["0", "1", "2", "3", "4"].map((v) => (
                                      <option key={v} value={v}>
                                        {v === "4" ? "4+" : v}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                onClick={() => removeEditableSet(ei)}
                                disabled={entry.sets.length <= 1}
                                className="inline-flex items-center gap-1 rounded-md border border-seam px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-steel-dim transition-colors hover:text-bone disabled:opacity-30"
                              >
                                <Minus size={11} /> Série
                              </button>
                              <button
                                onClick={() => addEditableSet(ei)}
                                className="inline-flex items-center gap-1 rounded-md border border-seam px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-steel transition-colors hover:border-gold/50 hover:text-bone"
                              >
                                <Plus size={11} /> Série
                              </button>
                            </div>
                          </div>
                        ))}
                        <p className="font-mono text-[10px] text-steel-dim">
                          Séries sem reps válidas são descartadas ao salvar.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-steel-dim">
                        Este registro não tem exercícios de musculação — só o cardio abaixo.
                      </p>
                    )}

                    {/* cardio */}
                    <div className="border-t border-seam pt-2.5">
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
                    </div>

                    {/* sRPE retroativo — salva na hora, sem passar por "Salvar alterações" */}
                    <div className="border-t border-seam pt-2.5">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                        Esforço da sessão (sRPE)
                        {w.srpe ? ` · atual ${w.srpe}` : " · não avaliado"}
                      </p>
                      <div className="mt-2 flex gap-1">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            onClick={() => rateSrpe(w, w.srpe === n ? null : n)}
                            className={cn(
                              "h-8 flex-1 rounded border font-mono text-xs transition-colors",
                              w.srpe === n
                                ? "border-ember bg-ember font-bold text-coal"
                                : "border-seam text-steel hover:text-bone"
                            )}
                            aria-label={`Esforço ${n} de 10`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] text-steel-dim">
                        1 = muito leve · 10 = máximo · calibra o sinal de fadiga
                      </p>
                    </div>

                    {/* notas */}
                    <div className="border-t border-seam pt-2.5">
                      <label className="block">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                          Notas
                        </span>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={2}
                          placeholder="Como foi a sessão? (opcional)"
                          className="mt-1 w-full resize-y rounded-md border border-seam bg-coal px-3 py-2 text-sm text-bone outline-none focus:border-gold"
                        />
                      </label>
                    </div>

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
                        onClick={closeEditor}
                        className="rounded border border-seam px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-steel transition-colors hover:text-bone"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </Card>
              )
              })}
            </div>
          ))
        )}
      </div>

      {/* confirmação própria — o confirm nativo não existe em PWA iOS standalone */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir este treino?"
        message={
          pendingDelete
            ? `${(PLAN_BY_ID[pendingDelete.sessionId]?.title ?? "Sessão")} de ${fromDateKey(
                pendingDelete.date
              ).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} sai do histórico e de todos os cálculos. Você pode desfazer logo após excluir.`
            : ""
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={() => {
            const restore = undoState.restore
            setUndoState(null)
            restore().catch(() => {
              setActionError("Não foi possível desfazer — verifique a conexão.")
            })
          }}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </main>
  )
}
