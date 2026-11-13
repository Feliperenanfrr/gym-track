"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Minus, Pencil, Plus, Trash2 } from "lucide-react"
import { ConfirmDialog, UndoToast } from "@/components/dialogs"
import { StravaImporter } from "@/components/strava-importer"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import { isEngineSession } from "@/lib/engine-plan"
import {
  cardioBlocks,
  cardioPurposeOf,
  describeCardio,
  totalCardioMinutes,
} from "@/lib/cardio"
import { legacyProgramOf } from "@/lib/legacy-plan"
import { sessionKcal, weightKgOn } from "@/lib/insights"
import {
  RUNNING_PAIN_THRESHOLD,
  RUNNING_SHOE_NAME,
  RUN_STAGES,
  RUN_STAGE_BY_ID,
  RunStageId,
  formatPace,
  isOverVolumeCeiling,
  isRunningActivityLog,
  runDistanceKm,
  runDurationMinutes,
  runDurationSeconds,
  runExplicitStageId,
  runPainScore,
} from "@/lib/running-plan"
import { EXERCISES_BY_ID, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { CardioLog, CardioPurpose, ExerciseLog, ExerciseUnit, MuscleGroup, WorkoutLog } from "@/lib/types"
import { measureInfo, measureOf, workoutVolume } from "@/lib/measure"
import { inputToKg, LoadUnit, loadForInput } from "@/lib/units"
import { liftName, machinesFor } from "@/lib/machines"
import { useExerciseMachines } from "@/lib/use-exercise-machines"
import { cn, formatKg, fromDateKey, toDateKey } from "@/lib/utils"

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
  /** tipo de medida resolvido na abertura — o editor mostra "s"/"m" e some com o RIR */
  unit: ExerciseUnit
  /** pilha em lb: o editor mostra e recebe lb; grava kg */
  loadUnit: LoadUnit
  /** máquina do registro; trocar aqui marca treinos antigos na máquina certa */
  machineId?: string
  machineName?: string
  sets: EditableSet[]
}

/** bloco de cardio editável (bike, corrida, caminhada de volta…) */
interface EditableCardio {
  minutes: string
  bpm: string
  mode: string
  purpose: CardioPurpose
  runStageId?: RunStageId
  /** Preserva distância/passos/elevação do Strava ao editar campos básicos. */
  original?: CardioLog
}

function editableCardioFrom(log: WorkoutLog): EditableCardio[] {
  return cardioBlocks(log).map((block) => ({
    minutes: String(block.minutes),
    bpm: block.avgBpm !== undefined ? String(block.avgBpm) : "",
    mode: block.mode,
    purpose: cardioPurposeOf(block, log.sessionId),
    ...(block.runStageId && block.runStageId in RUN_STAGE_BY_ID
      ? { runStageId: block.runStageId as RunStageId }
      : {}),
    original: block,
  }))
}

function editableEntriesFrom(log: WorkoutLog): EditableEntry[] {
  return log.entries.map((entry) => ({
    exerciseId: entry.exerciseId,
    ...(entry.exerciseName !== undefined ? { exerciseName: entry.exerciseName } : {}),
    ...(entry.muscleGroup !== undefined ? { muscleGroup: entry.muscleGroup } : {}),
    unit: measureOf(entry),
    loadUnit: entry.loadUnit ?? "kg",
    ...(entry.machineId ? { machineId: entry.machineId } : {}),
    ...(entry.machineName ? { machineName: entry.machineName } : {}),
    sets: entry.sets.map((s) => ({
      weight: String(loadForInput(s.weight, entry.loadUnit ?? "kg", entry.loadUnit ?? "kg")),
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
  if (cardioBlocks(w).some((block) => block.purpose === "sport")) return "sport"
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
  const { machines } = useExerciseMachines()
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
  const [editCardio, setEditCardio] = useState<EditableCardio[]>([])
  const [editNotes, setEditNotes] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [painOpenId, setPainOpenId] = useState<string | null>(null)
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
    setEditCardio(editableCardioFrom(w))
    setEditNotes(w.notes ?? "")
  }

  const closeEditor = () => {
    setEditingId(null)
    setEditEntries(null)
  }

  /** marca (ou desmarca) a máquina de um exercício do treino em edição */
  const setEditableMachine = (ei: number, machineId: string) => {
    const machine = (machines ?? []).find((m) => m.id === machineId)
    setEditEntries((prev) =>
      prev
        ? prev.map((entry, i) => {
            if (i !== ei) return entry
            const { machineId: _id, machineName: _name, ...rest } = entry
            if (!machineId) return rest
            return {
              ...rest,
              machineId,
              machineName: machine?.name ?? entry.machineName,
            }
          })
        : prev
    )
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

  const updateEditableCardio = (index: number, patch: Partial<EditableCardio>) => {
    setEditCardio((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addEditableCardio = () => {
    setEditCardio((prev) => [
      ...prev,
      { minutes: "", bpm: "", mode: "Bike ergométrica", purpose: "zone2" },
    ])
  }

  const removeEditableCardio = (index: number) => {
    setEditCardio((prev) => prev.filter((_, i) => i !== index))
  }

  const saveEdit = async (w: WorkoutLog) => {
    const cardios: CardioLog[] = editCardio.map((row) => {
      const minutes = parseInt(row.minutes) || 0
      return {
        ...(row.original ?? {}),
        minutes,
        ...(row.original?.durationSeconds !== undefined
          ? {
              durationSeconds:
                minutes === row.original.minutes
                  ? row.original.durationSeconds
                  : minutes * 60,
            }
          : {}),
        avgBpm: parseInt(row.bpm) || undefined,
        mode: row.mode.trim(),
        purpose: row.purpose,
        ...(row.runStageId ? { runStageId: row.runStageId } : {}),
      }
    })

    // mesmas regras de sanitização do registro na aba Treino
    const entries: ExerciseLog[] = (editEntries ?? [])
      .map((e) => ({
        exerciseId: e.exerciseId,
        ...(e.exerciseName !== undefined ? { exerciseName: e.exerciseName } : {}),
        ...(e.muscleGroup !== undefined ? { muscleGroup: e.muscleGroup } : {}),
        unit: e.unit,
        ...(e.loadUnit === "lb" ? { loadUnit: e.loadUnit } : {}),
        ...(e.machineId
          ? { machineId: e.machineId, ...(e.machineName ? { machineName: e.machineName } : {}) }
          : {}),
        sets: e.sets
          .map((s) => ({
            weight: inputToKg(parseFloat(s.weight.replace(",", ".")), e.loadUnit),
            reps: parseInt(s.reps) || 0,
            ...(e.unit === "reps" && s.rir !== "" ? { rir: parseInt(s.rir) } : {}),
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0)

    if (entries.length === 0 && cardios.length === 0) {
      setEditError("Sem séries nem cardio para salvar — use Excluir para remover o treino.")
      return
    }
    if (cardios.some((block) => block.minutes <= 0)) {
      setEditError("Informe os minutos de cada bloco de cardio.")
      return
    }
    if (cardios.some((block) => !block.mode)) {
      setEditError("Informe a modalidade de cada bloco de cardio.")
      return
    }

    // durationMin cobre a sessão inteira: ao mexer no cardio, ajusta pelo
    // delta para não distorcer a parte de sala nem a estimativa de kcal.
    const cardioDelta =
      cardios.reduce((sum, block) => sum + block.minutes, 0) - totalCardioMinutes(w)
    const durationMin =
      w.durationMin !== undefined
        ? Math.max(1, Math.min(480, w.durationMin + cardioDelta))
        : undefined

    setEditSaving(true)
    setEditError(null)
    try {
      await addWorkout({
        ...w,
        entries,
        durationMin,
        ...(editNotes.trim() ? { notes: editNotes.trim() } : { notes: undefined }),
        cardio: cardios[0],
        cardios: cardios.length > 0 ? cardios : undefined,
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

  /** Grava/limpa dor 0–10 no último bloco de cardio da corrida sem sair do Histórico. */
  const rateRunPain = async (w: WorkoutLog, score: number | null) => {
    const blocks = cardioBlocks(w)
    const nextBlocks: CardioLog[] =
      blocks.length > 0
        ? blocks.map((block, idx) => {
            if (idx !== blocks.length - 1) return block
            const { painScore: _old, ...rest } = block
            return score !== null ? { ...rest, painScore: score } : rest
          })
        : [
            {
              minutes: w.durationMin ?? 30,
              mode: "Corrida",
              purpose: "zone2",
              ...(score !== null ? { painScore: score } : {}),
            },
          ]
    try {
      await addWorkout({
        ...w,
        cardio: nextBlocks[0],
        cardios: nextBlocks,
      })
      setPainOpenId(null)
    } catch {
      setActionError("Não foi possível salvar a dor — verifique a conexão.")
    }
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

      {/* importação determinística das caminhadas/corridas exportadas do Strava */}
      <StravaImporter
        workouts={data.workouts}
        body={data.body}
        addWorkout={addWorkout}
        className="mb-4"
      />

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
            const cardioSummary = describeCardio(w)
            const kcalEst = sessionKcal(w, weightKgOn(data.body, w.date))
            const legacyProgram = legacyProgramOf(w.sessionId)
            const isRunLog = isRunningActivityLog(w)
            const runStageId = isRunLog ? runExplicitStageId(w) : undefined
            const runPain = isRunLog ? runPainScore(w) : undefined
            const runPace = isRunLog ? formatPace(runDurationSeconds(w), runDistanceKm(w)) : null
            const runDur = isRunLog ? runDurationMinutes(w) : 0
            const runOverCeiling =
              isRunLog &&
              (runStageId
                ? isOverVolumeCeiling(runStageId, runDur)
                : runDur > 45 && w.date < "2026-11-28")
            const hasCorreMax =
              isRunLog && cardioBlocks(w).some((block) => block.shoe === RUNNING_SHOE_NAME)

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
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {isEngineSession(w.sessionId) && (
                        <span className="inline-flex rounded-full border border-zone/30 bg-zone/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zone">
                          motor
                        </span>
                      )}
                      {w.sessionId.startsWith("run") && (
                        <span className="inline-flex rounded-full border border-zone/30 bg-zone/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zone">
                          corrida 5 km
                        </span>
                      )}
                      {runStageId && (
                        <span className="inline-flex rounded-full border border-zone/40 bg-zone/10 px-2 py-0.5 font-mono text-[10px] text-zone">
                          {RUN_STAGE_BY_ID[runStageId].shortLabel}
                        </span>
                      )}
                      {runPace && (
                        <span className="inline-flex rounded-full border border-seam bg-coal px-2 py-0.5 font-mono text-[10px] text-steel">
                          {runPace}
                        </span>
                      )}
                      {runPain !== undefined && (
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px]",
                            runPain > RUNNING_PAIN_THRESHOLD
                              ? "border-gold/40 bg-gold/10 text-gold"
                              : "border-zone/30 bg-zone/5 text-zone"
                          )}
                        >
                          dor {runPain}/10
                        </span>
                      )}
                      {runOverCeiling && (
                        <span className="inline-flex rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-[10px] text-gold">
                          acima do teto
                        </span>
                      )}
                      {hasCorreMax && (
                        <span className="inline-flex rounded-full border border-seam bg-coal px-2 py-0.5 font-mono text-[10px] text-steel-dim">
                          Corre Max 2
                        </span>
                      )}
                      {isRunLog && runPain === undefined && (
                        <button
                          type="button"
                          onClick={() => setPainOpenId(painOpenId === w.id ? null : w.id)}
                          className="inline-flex rounded-full border border-dashed border-zone/40 px-2 py-0.5 font-mono text-[10px] text-zone hover:bg-zone/10"
                        >
                          + dor 0–10
                        </button>
                      )}
                      {legacyProgram && (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                            legacyProgram === "jiu-jitsu"
                              ? "border border-gold/30 bg-gold/5 text-gold"
                              : "border border-seam bg-iron-2 text-steel-dim"
                          )}
                        >
                          {legacyProgram === "jiu-jitsu" ? "jiu-jitsu" : "flag football"}
                        </span>
                      )}
                    </div>
                    {isRunLog && painOpenId === w.id && (
                      <div className="mt-2 rounded border border-zone/30 bg-zone/5 p-2">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-zone">
                          Dor sola/canela pós-corrida (0–10)
                        </p>
                        <div className="mt-1.5 grid grid-cols-6 gap-1 sm:grid-cols-11">
                          {Array.from({ length: 11 }, (_, score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => void rateRunPain(w, score)}
                              className={cn(
                                "rounded border py-1 font-mono text-xs font-semibold transition-colors",
                                score > RUNNING_PAIN_THRESHOLD
                                  ? "border-gold/30 bg-coal text-gold hover:bg-gold/15"
                                  : "border-seam bg-coal text-steel hover:border-zone/50 hover:text-zone"
                              )}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-1 font-mono text-xs text-steel-dim">
                      {w.entries.length} exercícios {volume > 0 && `· ${formatKg(volume)} total`}{" "}
                      {cardioSummary && `· ${cardioSummary}`}
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
                              {liftName(entry)}
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
                            {(() => {
                              const options = machinesFor(machines ?? [], entry.exerciseId)
                              // a do registro aparece mesmo arquivada, para não sumir
                              const current =
                                entry.machineId && !options.some((m) => m.id === entry.machineId)
                                  ? [{ id: entry.machineId, name: entry.machineName ?? "Máquina arquivada" }]
                                  : []
                              if (options.length === 0 && current.length === 0) return null
                              return (
                                <select
                                  value={entry.machineId ?? ""}
                                  onChange={(event) => setEditableMachine(ei, event.target.value)}
                                  aria-label="Máquina usada"
                                  className="mt-1.5 h-9 w-full rounded border border-seam bg-coal px-2 text-xs text-bone outline-none focus:border-gold"
                                >
                                  <option value="">Sem máquina</option>
                                  {[...current, ...options].map((machine) => (
                                    <option key={machine.id} value={machine.id}>
                                      {machine.name}
                                    </option>
                                  ))}
                                </select>
                              )
                            })()}
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
                                    aria-label={`Peso da série ${si + 1} em ${entry.loadUnit === "lb" ? "libras" : "quilos"}`}
                                    className="w-16 rounded border border-seam bg-coal px-1 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                                  />
                                  {entry.loadUnit === "lb" && (
                                    <span className="font-mono text-[10px] uppercase text-gold">lb</span>
                                  )}
                                  <span className="text-xs text-steel-dim">×</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={s.reps}
                                    onChange={(e) =>
                                      updateEditableSet(ei, si, { reps: e.target.value })
                                    }
                                    aria-label={`${entry.unit === "reps" ? "Repetições" : entry.unit === "seconds" ? "Segundos" : "Metros"} da série ${si + 1}`}
                                    className="w-14 rounded border border-seam bg-coal px-1 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                                  />
                                  {entry.unit !== "reps" && (
                                    <span className="font-mono text-xs text-steel-dim">
                                      {measureInfo(entry.unit).suffix}
                                    </span>
                                  )}
                                  {entry.unit === "reps" && (
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
                                  )}
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
                    <p className="mt-0.5 text-[11px] text-steel-dim">
                      Um bloco por estímulo: bike, corrida e a caminhada de volta contam
                      separado.
                    </p>
                    {editCardio.length === 0 && (
                      <p className="mt-2 text-[11px] text-gold">
                        Sem cardio — o que existia neste registro sai ao salvar.
                      </p>
                    )}
                    <div className="mt-2 space-y-2">
                      {editCardio.map((row, ci) => (
                        <div key={ci} className="rounded-lg border border-seam p-2">
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="flex w-16 flex-col gap-1">
                              <span className="font-mono text-[10px] uppercase text-steel-dim">Min</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={row.minutes}
                                onChange={(e) => updateEditableCardio(ci, { minutes: e.target.value })}
                                aria-label={`Minutos do bloco ${ci + 1}`}
                                className="w-full rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                              />
                            </label>
                            <label className="flex w-16 flex-col gap-1">
                              <span className="font-mono text-[10px] uppercase text-steel-dim">BPM</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={row.bpm}
                                onChange={(e) => updateEditableCardio(ci, { bpm: e.target.value })}
                                aria-label={`BPM médio do bloco ${ci + 1}`}
                                className="w-full rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="font-mono text-[10px] uppercase text-steel-dim">Tipo</span>
                              <select
                                value={row.purpose}
                                onChange={(e) =>
                                  updateEditableCardio(ci, {
                                    purpose: e.target.value as CardioPurpose,
                                  })
                                }
                                aria-label={`Finalidade do bloco ${ci + 1}`}
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
                                value={row.mode}
                                onChange={(e) => updateEditableCardio(ci, { mode: e.target.value })}
                                placeholder="Bike, corrida…"
                                aria-label={`Modalidade do bloco ${ci + 1}`}
                                className="min-w-0 w-full rounded border border-seam bg-coal px-2 py-1.5 text-sm text-bone outline-none focus:border-gold"
                              />
                            </label>
                            <button
                              onClick={() => removeEditableCardio(ci)}
                              className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-red-400"
                              aria-label={`Remover bloco de cardio ${ci + 1}`}
                              title="Remover bloco"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-steel-dim">
                            {PURPOSE_OPTIONS.find((o) => o.id === row.purpose)?.hint}
                          </p>
                          {isRunLog && (
                            <label className="mt-2 flex flex-col gap-1">
                              <span className="font-mono text-[10px] uppercase text-steel-dim">
                                Estágio do plano 5 km
                              </span>
                              <select
                                value={row.runStageId ?? ""}
                                onChange={(e) =>
                                  updateEditableCardio(ci, {
                                    runStageId: e.target.value
                                      ? (e.target.value as RunStageId)
                                      : undefined,
                                  })
                                }
                                className="rounded border border-seam bg-coal px-2 py-1.5 text-xs text-bone outline-none focus:border-zone"
                              >
                                <option value="">Sem estágio marcado</option>
                                {RUN_STAGES.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.label} · {stage.weekLabel}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addEditableCardio}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-seam px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-steel transition-colors hover:border-gold/50 hover:text-bone"
                    >
                      <Plus size={11} /> Bloco de cardio
                    </button>
                    </div>

                    {isRunLog && (
                      <div className="border-t border-seam pt-2.5">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                          Dor sola/canela pós-corrida (0–10)
                          {runPain !== undefined ? ` · atual ${runPain}/10` : " · não avaliada"}
                        </p>
                        <div className="mt-2 grid grid-cols-6 gap-1 sm:grid-cols-11">
                          {Array.from({ length: 11 }, (_, score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => void rateRunPain(w, runPain === score ? null : score)}
                              className={cn(
                                "h-8 rounded border font-mono text-xs transition-colors",
                                runPain === score
                                  ? score > RUNNING_PAIN_THRESHOLD
                                    ? "border-gold bg-gold font-bold text-coal"
                                    : "border-zone bg-zone font-bold text-coal"
                                  : "border-seam text-steel hover:text-bone"
                              )}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

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
