"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, ChevronDown, ChevronUp, CloudOff, Dumbbell, History, Minus, Pencil, Plus, RefreshCw, RotateCcw, Save, SlidersHorizontal, TrendingUp, Trash2, X } from "lucide-react"
import { ProgramTabs } from "@/components/program-tabs"
import { Card, PageHeader, SectionTitle, Skeleton } from "@/components/ui"
import { RestTimer } from "@/components/rest-timer"
import { bjjPlanForDate, bjjPhaseFor, nextBjjSession } from "@/lib/bjj-plan"
import { cardioBlocks, cardioRowsToBlocks } from "@/lib/cardio"
import { PLAN_BY_ID, planForProgram } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { CardioPurpose, CardioRow, ExercisePrescription, ExerciseLog, MuscleGroup, SessionId, SessionKind, SessionPlan, SetRow, TrainingProgram, WorkoutLog } from "@/lib/types"
import {
  CatalogExercise,
  groupOfExercise,
  makeCustomExercise,
  MUSCLE_GROUP_OPTIONS,
} from "@/lib/exercise-catalog"
import {
  bestE1RM,
  cn,
  daysSince,
  formatKg,
  fromDateKey,
  isoWeekday,
  operationalDay,
  toDateKey,
  toOperationalDateKey,
} from "@/lib/utils"
import { parseRestSeconds } from "@/lib/rest"
import { useRestTimer } from "@/lib/use-rest-timer"
import { sessionKcal, weightKgOn } from "@/lib/insights"
import { CycleSuggestion, getScheduleMode, nextInCycle } from "@/lib/cycle"
import {
  formatWeight,
  loadStepOverrides,
  loggedWeights,
  LoadSuggestion,
  resolveLoadStep,
  saveStepOverride,
  STEP_OPTIONS,
  suggestLoad,
} from "@/lib/progression"
import {
  clearDraft,
  draftCardioRows,
  draftHasContent,
  loadDraft,
  saveDraft,
} from "@/lib/draft"
import { tapFeedback } from "@/lib/haptics"
import { useTrainingProgram } from "@/lib/use-training-program"
import { useWorkoutTemplates } from "@/lib/use-workout-templates"
import { loggedLiftMinutes, openLogForEditing } from "@/lib/workout-form"

const CARDIO_MODES = ["Bike ergométrica", "Esteira inclinada", "Corrida", "Caminhada", "Pular corda", "Natação", "Remo"]
const SPORT_MODES = ["Jiu-jitsu", "Futsal", "Flag football", "Natação", "Outro esporte"]
/** modalidade do finisher prescrito (mantida igual nos registros antigos) */
const FINISHER_MODE = "Cardio após musculação"

const CARDIO_PURPOSES: { id: CardioPurpose; label: string; hint: string }[] = [
  { id: "zone2", label: "Zona 2", hint: "ritmo contínuo e confortável" },
  { id: "intense", label: "Intenso", hint: "tiros, corda ou natação forte" },
  { id: "sport", label: "Esporte", hint: "jogo, luta ou treino técnico" },
]

function isStrengthKind(kind: SessionKind): boolean {
  return kind === "lift" || kind === "mixed"
}

/** Sessão cujo cardio é o treino em si (não um complemento opcional). */
function cardioIsTheSession(kind: SessionKind): boolean {
  return kind === "cardio" || kind === "sport"
}

function hasCardioForm(kind: SessionKind): boolean {
  return kind === "cardio" || kind === "sport" || kind === "mixed"
}

/** minúsculas sem acento, para busca tolerante no seletor */
function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Botão secundário "fantasma" — ação leve, padrão do sistema */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-md border border-seam bg-iron-2/40 px-3 py-2 text-xs font-semibold text-steel transition-colors"
/** Botão de ícone compacto (trocar/remover série ou exercício) */
const ICON_BTN =
  "flex h-8 w-8 items-center justify-center rounded-md border border-seam text-steel-dim transition-colors"

export default function TreinoPage() {
  const { data, addWorkout, pendingCount } = useGymData()
  const router = useRouter()
  const { program, selectProgram } = useTrainingProgram()
  const { templates, templateById, exerciseCatalog } = useWorkoutTemplates()
  const restTimer = useRestTimer()
  const [today, setToday] = useState<Date | null>(null)
  const [sessionId, setSessionId] = useState<SessionId | null>(null)
  const [activeExercises, setActiveExercises] = useState<ExercisePrescription[]>([])
  const [rows, setRows] = useState<Record<string, SetRow[]>>({})
  /** blocos de cardio da sessão: 15′ de bike, 15′ de corrida, caminhada… */
  const [cardioRows, setCardioRows] = useState<CardioRow[]>([])
  /** observações livres da sessão — vão no log e no rascunho */
  const [notes, setNotes] = useState("")
  const [pickerFor, setPickerFor] = useState<string | "new" | null>(null)
  const [pickerGroup, setPickerGroup] = useState<MuscleGroup>("Peito")
  const [pickerSearch, setPickerSearch] = useState("")
  const [customName, setCustomName] = useState("")
  const [saved, setSaved] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [prCelebrations, setPrCelebrations] = useState<string[]>([])
  const [savedLog, setSavedLog] = useState<WorkoutLog | null>(null)
  const [cycleSug, setCycleSug] = useState<CycleSuggestion | null>(null)
  /** o ciclo detectou dias sem musculação: sugestões entram ~10% abaixo */
  const [layoffNotice, setLayoffNotice] = useState(false)
  /** registro desta sessão já salvo hoje que está aberto para edição */
  const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null)
  /** passo de carga escolhido à mão por exercício (máquina de pino, anilha…) */
  const [stepOverrides, setStepOverrides] = useState<Record<string, number>>({})
  /** exercício com o seletor de passo aberto */
  const [stepEditorFor, setStepEditorFor] = useState<string | null>(null)
  const dirtyRef = useRef(false)
  const popRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  /** epoch ms da primeira série marcada (duração real da sessão) */
  const startedAtRef = useRef<number | null>(null)
  const sessionPickedRef = useRef(false)
  const cycleInitRef = useRef(false)
  /** data|sessão do último pré-preenchimento, p/ não remontar o form salvo */
  const prefillKeyRef = useRef("")
  const initializedProgramRef = useRef<TrainingProgram | null>(null)

  const availableSessions = useMemo(
    () => {
      if (!program || !templates) return []
      const base = planForProgram(program, templates)
      if (program !== "bjj" || !today) return base
      const shared = base.filter(
        (candidate) => candidate.id === "free" || candidate.id === "sport"
      )
      const bjj = base.filter((candidate) => candidate.id.startsWith("bjj"))
      return [...bjjPlanForDate(today, bjj), ...shared]
    },
    [program, templates, today]
  )

  const setPopRef = useCallback((key: string) => (el: HTMLButtonElement | null) => {
    if (el) popRefs.current.set(key, el)
    else popRefs.current.delete(key)
  }, [])

  useEffect(() => {
    // ?data=yyyy-mm-dd → registro retroativo (treino esquecido, jogo não
    // anotado). Datas no futuro caem para o dia operacional de hoje.
    let day = operationalDay(new Date())
    const raw = new URLSearchParams(window.location.search).get("data")
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = fromDateKey(raw)
      if (!Number.isNaN(parsed.getTime()) && toDateKey(parsed) <= toDateKey(day)) {
        day = parsed
      }
    }
    setToday(day)
  }, [])

  useEffect(() => {
    setStepOverrides(loadStepOverrides())
  }, [])

  // Ao trocar de programa, muda apenas o catálogo exibido; os registros e o
  // rascunho de cada sessão continuam isolados pelo sessionId.
  useEffect(() => {
    if (!program || !templates || !today || initializedProgramRef.current === program) return
    initializedProgramRef.current = program
    sessionPickedRef.current = false
    cycleInitRef.current = false
    setCycleSug(null)
    if (program === "bjj") {
      setSessionId("bjjPull")
      return
    }
    const planned = planForProgram("hypertrophy", templates).find(
      (candidate) => candidate.weekday === isoWeekday(today)
    )
    setSessionId(planned && planned.kind !== "rest" ? planned.id : "upperA")
  }, [program, templates, today])

  // Quando os dados chegam, escolhe a próxima sessão uma vez por visita. A
  // escolha manual no seletor sempre tem prioridade.
  useEffect(() => {
    if (!data || !today || !program || cycleInitRef.current || sessionPickedRef.current) return
    cycleInitRef.current = true
    if (program === "bjj") {
      setSessionId(nextBjjSession(data.workouts, today))
      return
    }
    if (getScheduleMode() !== "ciclo") return
    const sug = nextInCycle(data.workouts, today)
    setCycleSug(sug)
    setSessionId(sug.sessionId)
  }, [data, today, program])

  const session = sessionId
    ? availableSessions.find((candidate) => candidate.id === sessionId) ??
      templateById[sessionId] ??
      PLAN_BY_ID[sessionId]
    : null

  /** último registro desta sessão (para prefill e comparação) */
  const lastLog = useMemo(() => {
    if (!data || !session || !today) return null
    const todayKey = toDateKey(today)
    const prev = data.workouts.filter(
      (w) => w.sessionId === session.id && w.date < todayKey
    )
    return prev[prev.length - 1] ?? null
  }, [data, session, today])

  /** registro desta sessão salvo hoje — reabri-lo evita sobrescrever sem querer */
  const todayLog = useMemo(() => {
    if (!data || !session || !today) return null
    return (
      data.workouts.find(
        (w) => w.date === toDateKey(today) && w.sessionId === session.id
      ) ?? null
    )
  }, [data, session, today])

  /**
   * Última execução de cada exercício, em QUALQUER sessão. Puxada alta feita
   * num avulso é a mesma puxada alta: ignorá-la fazia o Upper A comparar com
   * um treino de duas semanas atrás e sugerir carga errada.
   */
  const exerciseHistory = useMemo(() => {
    const history: Record<string, { log: WorkoutLog; entry: ExerciseLog }> = {}
    if (!data || !today) return history
    const todayKey = toDateKey(today)
    for (const log of [...data.workouts].sort((a, b) => a.date.localeCompare(b.date))) {
      if (log.date >= todayKey) continue
      for (const entry of log.entries) {
        if (entry.sets.length > 0) history[entry.exerciseId] = { log, entry }
      }
    }
    return history
  }, [data, today])

  /** BPM padrão do bloco: o do último registro, senão o meio da faixa alvo */
  const defaultBpm = (s: SessionPlan, ll: WorkoutLog | null): string => {
    const previous = ll ? cardioBlocks(ll)[0] : undefined
    if (previous?.avgBpm) return String(previous.avgBpm)
    return String(
      s.cardioTarget?.bpmMin && s.cardioTarget?.bpmMax
        ? Math.round((s.cardioTarget.bpmMin + s.cardioTarget.bpmMax) / 2)
        : 130
    )
  }

  /**
   * Blocos de cardio pré-preenchidos: repete os do último registro desta
   * sessão (é o padrão real de quem faz sempre bike + corrida) e, na sessão
   * de cardio puro com um bloco só, aplica a progressão de +2 min.
   */
  const buildCardioRows = (s: SessionPlan, ll: WorkoutLog | null): CardioRow[] => {
    const bpm = defaultBpm(s, ll)
    const previous = ll ? cardioBlocks(ll) : []
    if (previous.length > 0) {
      return previous.map((block) => ({
        minutes: String(
          s.kind === "cardio" && previous.length === 1
            ? Math.min(s.cardioTarget?.max ?? 50, block.minutes + 2)
            : block.minutes
        ),
        bpm: block.avgBpm ? String(block.avgBpm) : bpm,
        mode: block.mode,
        purpose:
          s.id === "bjjZ2"
            ? "zone2"
            : block.purpose ?? (s.kind === "sport" ? "sport" : "zone2"),
      }))
    }
    // finisher prescrito do Lower A/B: some quando não foi feito (basta remover)
    if (s.cardioAfter) {
      return [
        {
          minutes: String(s.cardioAfter.minutes),
          bpm,
          mode: CARDIO_MODES[0],
          purpose: "zone2",
        },
      ]
    }
    // musculação pura começa sem cardio; o botão de adicionar cobre o extra
    if (!hasCardioForm(s.kind)) return []
    return [
      {
        minutes: s.kind === "cardio" ? String(s.cardioTarget?.defaultMinutes ?? 45) : "60",
        bpm,
        mode: s.kind === "sport" ? SPORT_MODES[0] : CARDIO_MODES[0],
        purpose: s.kind === "sport" ? "sport" : "zone2",
      },
    ]
  }

  /**
   * Pré-preenchimento: repete exatamente o que foi feito da última vez.
   *
   * O app não mexe mais na carga sozinho. Progressão, manutenção e volta de
   * pausa aparecem como SUGESTÃO no card do exercício, com um toque para
   * aplicar — quem decide o que a máquina aceita é quem está na máquina.
   */
  const buildPrefill = (
    s: typeof session,
    ll: typeof lastLog,
    exercises: ExercisePrescription[] = s!.exercises
  ) => {
    const rows: Record<string, SetRow[]> = {}
    const adapting =
      program === "bjj" && today !== null && bjjPhaseFor(today).id === "adaptacao"
    for (const ex of exercises) {
      const lastEntry = exerciseHistory[ex.id]?.entry
      rows[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
        const lastSet = lastEntry?.sets[i] ?? lastEntry?.sets[lastEntry.sets.length - 1]
        return {
          weight: lastSet ? String(lastSet.weight) : "",
          // na adaptação do bloco de jiu-jitsu, mesma carga e menos volume
          reps: lastSet ? String(adapting ? ex.repsMin : lastSet.reps) : "",
          done: false,
          rir: "",
        }
      })
    }
    return { rows, cardioRows: buildCardioRows(s!, ll ?? null) }
  }

  const applyPrefill = (p: ReturnType<typeof buildPrefill>) => {
    setRows(p.rows)
    setCardioRows(p.cardioRows)
  }

  /** o ciclo cobra volta de pausa nesta sessão? (0 musculação por 7+ dias) */
  const returningFromLayoff = () =>
    Boolean(
      cycleSug && cycleSug.reason === "regression" && cycleSug.sessionId === session?.id
    )

  // ao trocar de sessão: restaura rascunho do dia, reabre o registro de hoje
  // ou pré-preenche com a última execução de cada exercício
  useEffect(() => {
    if (!session || !today) return
    const dateKey = toDateKey(today)
    const prefillKey = `${dateKey}|${session.id}`
    const switchingSession = prefillKeyRef.current !== prefillKey
    prefillKeyRef.current = prefillKey
    if (switchingSession) {
      setSaved(false)
      setSavedLog(null)
      setPrCelebrations([])
      setStepEditorFor(null)
    } else if (saved || saving) {
      // acabou de salvar: o registro virou o log de hoje, mas a tela de
      // confirmação não pode ser desmontada por baixo do usuário
      setEditingLog(todayLog)
      return
    }
    dirtyRef.current = false
    const draft = loadDraft(dateKey, session.id)
    if (draft && draftHasContent(draft)) {
      setActiveExercises(draft.exercises ?? session.exercises)
      setRows(draft.rows)
      setCardioRows(
        draftCardioRows(
          draft,
          session.id !== "bjjZ2" && session.kind === "sport" ? "sport" : "zone2",
          FINISHER_MODE
        )
      )
      setNotes(draft.notes ?? "")
      startedAtRef.current = draft.startedAt ?? null
      setDraftRestored(true)
      setEditingLog(todayLog)
      setLayoffNotice(false)
      return
    }
    if (todayLog) {
      // já existe registro desta sessão hoje: abre o que foi salvo em vez de
      // partir do zero — salvar de novo faz upsert e apagaria o anterior
      const opened = openLogForEditing(todayLog, session, exerciseCatalog)
      setActiveExercises(opened.exercises)
      setRows(opened.rows)
      setCardioRows(opened.cardioRows)
      setNotes(opened.notes)
      startedAtRef.current = null
      setDraftRestored(false)
      setEditingLog(todayLog)
      setLayoffNotice(false)
      return
    }
    setActiveExercises(session.exercises)
    applyPrefill(buildPrefill(session, lastLog))
    setNotes("")
    startedAtRef.current = null
    setDraftRestored(false)
    setEditingLog(null)
    setLayoffNotice(returningFromLayoff())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, lastLog, todayLog, today, cycleSug])

  // autosave do rascunho a cada edição do usuário
  useEffect(() => {
    if (!session || !today || !dirtyRef.current) return
    saveDraft(toDateKey(today), session.id, {
      rows,
      exercises: activeExercises,
      cardioRows,
      notes,
      savedAt: Date.now(),
      startedAt: startedAtRef.current ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeExercises, cardioRows, notes])

  const totals = useMemo(() => {
    let volume = 0
    let setsDone = 0
    let setsTotal = 0
    for (const ex of activeExercises) {
      for (const r of rows[ex.id] ?? []) {
        setsTotal++
        if (r.done) setsDone++
        const w = parseFloat(r.weight.replace(",", "."))
        const reps = parseInt(r.reps)
        if (!isNaN(w) && !isNaN(reps)) volume += w * reps
      }
    }
    return { volume, setsDone, setsTotal }
  }, [rows, activeExercises])

  /**
   * Sugestão de carga por exercício — o que o app acha que você deve fazer
   * hoje, ao lado do que você fez da última vez. Nunca escreve sozinho.
   *
   * O passo sai do histórico do próprio exercício: se toda carga registrada na
   * puxada alta é múltipla de 5, a máquina anda de 5 em 5 e a sugestão respeita
   * isso. Dá para fixar o passo à mão quando o histórico ainda é curto.
   */
  const suggestions = useMemo(() => {
    const out: Record<
      string,
      { suggestion: LoadSuggestion; step: number; manualStep: boolean }
    > = {}
    if (!data || !today) return out
    for (const ex of activeExercises) {
      const previous = exerciseHistory[ex.id]
      const step = resolveLoadStep(
        ex.id,
        loggedWeights(data.workouts, ex.id),
        stepOverrides
      )
      const suggestion = suggestLoad({
        prescription: ex,
        lastEntry: previous?.entry,
        step,
        layoffDays: previous ? daysSince(fromDateKey(previous.log.date), today) : null,
        returningFromLayoff: layoffNotice,
      })
      if (suggestion) {
        out[ex.id] = { suggestion, step, manualStep: stepOverrides[ex.id] !== undefined }
      }
    }
    return out
  }, [activeExercises, data, exerciseHistory, layoffNotice, stepOverrides, today])

  /**
   * kcal estimadas do treino salvo — duração real + MET ajustado pelo sRPE.
   * Recalcula na hora em que o usuário toca um nível de esforço.
   * Precisa vir ANTES do early return do skeleton: hooks não podem ser
   * condicionais (quebrava a página com "Rendered more hooks").
   */
  const savedKcal = useMemo(
    () =>
      savedLog
        ? sessionKcal(savedLog, weightKgOn(data?.body ?? [], savedLog.date))
        : null,
    [savedLog, data]
  )

  if (!data || !templates || !session || !today || !program) {
    return (
      <main>
        <PageHeader kicker="REGISTRO" title="Treino" />
        <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1 -mx-4">
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        </div>
        <Card className="mb-4">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-4 h-4 w-64" />
          <Skeleton className="h-2 w-full rounded-full" />
        </Card>
        <Card className="mb-3">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-2 h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      </main>
    )
  }

  const updateRow = (exId: string, idx: number, patch: Partial<SetRow>) => {
    dirtyRef.current = true
    setRows((prev) => ({
      ...prev,
      [exId]: prev[exId].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }

  const openExercisePicker = (target: string | "new") => {
    const current = target === "new" ? null : activeExercises.find((ex) => ex.id === target)
    setPickerFor(target)
    setPickerGroup(current ? groupOfExercise(current) : "Peito")
    setPickerSearch("")
    setCustomName("")
  }

  const applyExerciseChoice = (choice: CatalogExercise) => {
    if (!pickerFor) return
    const replacingId = pickerFor === "new" ? null : pickerFor
    if (activeExercises.some((exercise) => exercise.id === choice.id && exercise.id !== replacingId)) {
      setSaveError("Este exercício já está no treino.")
      return
    }

    dirtyRef.current = true
    const prescription: ExercisePrescription = { ...choice }
    setActiveExercises((current) =>
      replacingId
        ? current.map((exercise) => (exercise.id === replacingId ? prescription : exercise))
        : [...current, prescription]
    )
    setRows((current) => {
      const next = { ...current }
      if (replacingId) delete next[replacingId]
      next[choice.id] = buildPrefill(session, lastLog, [prescription]).rows[choice.id]
      return next
    })
    setPickerFor(null)
    setSaveError(null)
  }

  const addCustomExercise = () => {
    if (!customName.trim()) return
    applyExerciseChoice(makeCustomExercise(customName, pickerGroup))
  }

  const removeExercise = (exerciseId: string) => {
    dirtyRef.current = true
    setActiveExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
    setRows((current) => {
      const next = { ...current }
      delete next[exerciseId]
      return next
    })
    if (pickerFor === exerciseId) setPickerFor(null)
  }

  const addSet = (exerciseId: string) => {
    dirtyRef.current = true
    setRows((current) => {
      const previous = current[exerciseId] ?? []
      const last = previous[previous.length - 1]
      return {
        ...current,
        [exerciseId]: [
          ...previous,
          { weight: last?.weight ?? "", reps: last?.reps ?? "", done: false, rir: "" },
        ],
      }
    })
    setActiveExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, sets: exercise.sets + 1 } : exercise
      )
    )
  }

  const removeSet = (exerciseId: string) => {
    if ((rows[exerciseId]?.length ?? 0) <= 1) return
    dirtyRef.current = true
    setRows((current) => ({ ...current, [exerciseId]: current[exerciseId].slice(0, -1) }))
    setActiveExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, sets: Math.max(1, exercise.sets - 1) } : exercise
      )
    )
  }

  const useDumbbellVersion = () => {
    const usedIds = new Set<string>()
    const exercises = activeExercises.map((current) => {
      const group = groupOfExercise(current)
      const options = exerciseCatalog.filter(
        (exercise) => exercise.muscleGroup === group && exercise.equipment === "halteres"
      )
      const selected = options.find((exercise) => !usedIds.has(exercise.id)) ?? current
      usedIds.add(selected.id)
      return { ...selected }
    })
    const prefill = buildPrefill(session, lastLog, exercises)
    dirtyRef.current = true
    setActiveExercises(exercises)
    setRows(prefill.rows)
    setPickerFor(null)
  }

  // marca/desmarca a série e, ao concluir, dispara o timer de descanso
  const toggleSet = (ex: ExercisePrescription, idx: number, currentlyDone: boolean) => {
    const nowDone = !currentlyDone
    updateRow(ex.id, idx, { done: nowDone })

    // micro-animação pop no botão
    const btn = popRefs.current.get(`${ex.id}-${idx}`)
    if (btn) {
      btn.classList.remove("check-pop")
      // force reflow para reiniciar a animação caso já esteja ativa
      void btn.offsetWidth
      btn.classList.add("check-pop")
    }

    if (nowDone) {
      // primeira série marcada = início real da sessão
      if (!startedAtRef.current) startedAtRef.current = Date.now()
      tapFeedback()
      restTimer.start(parseRestSeconds(ex.rest), ex.name)
    }
  }

  const updateCardioRow = (index: number, patch: Partial<CardioRow>) => {
    dirtyRef.current = true
    setCardioRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const addCardioRow = () => {
    dirtyRef.current = true
    setCardioRows((current) => [
      ...current,
      { minutes: "", bpm: defaultBpm(session, lastLog), mode: CARDIO_MODES[0], purpose: "zone2" },
    ])
  }

  const removeCardioRow = (index: number) => {
    dirtyRef.current = true
    setCardioRows((current) => current.filter((_, i) => i !== index))
  }

  const discardDraft = () => {
    if (!session || !today) return
    clearDraft(toDateKey(today), session.id)
    dirtyRef.current = false
    startedAtRef.current = null
    setActiveExercises(session.exercises)
    applyPrefill(buildPrefill(session, lastLog))
    setNotes("")
    setDraftRestored(false)
    setEditingLog(null)
    setLayoffNotice(returningFromLayoff())
  }

  /** troca o passo de carga do exercício (máquina de 5 em 5, anilha de 20…) */
  const chooseStep = (exerciseId: string, step: number | null) => {
    setStepOverrides(saveStepOverride(exerciseId, step))
    setStepEditorFor(null)
  }

  /** aplica a sugestão nas séries que ainda não foram marcadas como feitas */
  const applySuggestion = (exerciseId: string, suggestion: LoadSuggestion) => {
    dirtyRef.current = true
    tapFeedback()
    setRows((current) => ({
      ...current,
      [exerciseId]: (current[exerciseId] ?? []).map((row, i) => {
        const target = suggestion.sets[i] ?? suggestion.sets[suggestion.sets.length - 1]
        if (!target || row.done) return row
        return {
          ...row,
          weight: target.weight > 0 ? String(target.weight) : row.weight,
          reps: String(target.reps),
        }
      }),
    }))
  }

  const handleSave = async () => {
    const entries: ExerciseLog[] = activeExercises
      .map((ex) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        muscleGroup: groupOfExercise(ex),
        sets: (rows[ex.id] ?? [])
          .map((r) => ({
            weight: parseFloat(r.weight.replace(",", ".")) || 0,
            reps: parseInt(r.reps) || 0,
            ...(r.rir !== undefined && r.rir !== "" ? { rir: parseInt(r.rir) } : {}),
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0)

    const cardios = cardioRowsToBlocks(cardioRows, { forceZone2: session.id === "bjjZ2" })
    const cardioMinutes = cardios.reduce((sum, block) => sum + block.minutes, 0)

    if (session.kind === "mixed" && entries.length === 0 && cardios.length === 0) {
      setSaveError("Adicione cardio ou pelo menos um exercício no avulso.")
      return
    }
    if (cardioIsTheSession(session.kind) && cardios.length === 0) {
      setSaveError("Informe os minutos de cardio para salvar esta sessão.")
      return
    }

    const workoutDay =
      isStrengthKind(session.kind) && startedAtRef.current
        ? new Date(startedAtRef.current)
        : new Date()

    const log: WorkoutLog = {
      id: editingLog?.id ?? `log-${Date.now()}`,
      date: editingLog
        ? editingLog.date
        : backdated
          ? toDateKey(today)
          : toOperationalDateKey(workoutDay),
      sessionId: session.id,
      entries,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      // reabrir a sessão para completar não pode apagar o esforço já avaliado
      ...(editingLog?.srpe !== undefined ? { srpe: editingLog.srpe } : {}),
    }

    if (cardios.length > 0) {
      log.cardios = cardios
      log.cardio = cardios[0]
    }

    // duração real da musculação: 1ª série marcada → salvar. Ao completar um
    // registro de hoje, a sala já medida antes continua valendo.
    const previousLiftMinutes = editingLog ? loggedLiftMinutes(editingLog) : 0
    const timedMinutes =
      isStrengthKind(session.kind) && startedAtRef.current
        ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000))
        : 0
    const liftMinutes = Math.max(previousLiftMinutes, timedMinutes)
    const startedAtIso = startedAtRef.current
      ? new Date(startedAtRef.current).toISOString()
      : editingLog?.startedAt
    if (liftMinutes > 0 && startedAtIso) log.startedAt = startedAtIso
    // durationMin é a sessão inteira (sala medida + todos os blocos de cardio)
    const totalMinutes = liftMinutes + cardioMinutes
    if (totalMinutes > 0) log.durationMin = Math.min(480, totalMinutes)

    const newPRs: string[] = []
    if (data) {
      for (const entry of entries) {
        const e1rm = bestE1RM(entry)
        if (e1rm <= 0) continue

        let historicalMax = 0
        for (const w of data.workouts) {
          if (w.date >= log.date) continue
          const prevEntry = w.entries.find((e) => e.exerciseId === entry.exerciseId)
          if (prevEntry) {
            historicalMax = Math.max(historicalMax, bestE1RM(prevEntry))
          }
        }

        if (historicalMax > 0 && e1rm > historicalMax) {
          const exDef = activeExercises.find((e) => e.id === entry.exerciseId)
          if (exDef) newPRs.push(exDef.name)
        }
      }
    }
    setPrCelebrations(newPRs)

    setSaving(true)
    setSaveError(null)
    const offline = typeof navigator !== "undefined" && navigator.onLine === false
    try {
      await addWorkout(log)
      clearDraft(log.date, session.id)
      dirtyRef.current = false
      setDraftRestored(false)
      setSavedOffline(offline)
      setSavedLog(log)
      setSaved(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar no banco")
    } finally {
      setSaving(false)
    }
  }

  /** sRPE pós-treino: 1 tap regrava o mesmo log (upsert por data+sessão) */
  const rateSrpe = (n: number) => {
    if (!savedLog) return
    const updated = { ...savedLog, srpe: n }
    setSavedLog(updated)
    tapFeedback()
    addWorkout(updated).catch(() => {
      /* upsert de retentativa acontece pela fila offline */
    })
  }

  const progressPct =
    totals.setsTotal > 0 ? Math.round((totals.setsDone / totals.setsTotal) * 100) : 0
  const isLift = isStrengthKind(session.kind)
  const totalCardioMin = cardioRows.reduce((sum, row) => sum + (parseInt(row.minutes) || 0), 0)
  const cardioSectionTitle = session.cardioAfter
    ? `Finisher — ${session.cardioAfter.label}`
    : session.kind === "sport"
      ? "Esporte"
      : session.kind === "mixed"
        ? "Cardio avulso"
        : "Cardio"
  const bjjPhase = program === "bjj" ? bjjPhaseFor(today) : null
  /** sessão que o programa pede hoje — marcada no seletor mesmo se você mudar */
  const suggestedSessionId =
    program === "bjj" ? nextBjjSession(data.workouts, today) : cycleSug?.sessionId ?? null
  /** registro retroativo (?data=): salva na data escolhida, não em hoje */
  const backdated = toDateKey(today) !== toDateKey(operationalDay(new Date()))

  const backToToday = () => {
    router.replace("/treino")
    setToday(operationalDay(new Date()))
  }
  /** busca no seletor: com texto, procura em todos os grupos; sem, filtra pelo grupo */
  const pickerQuery = normalizeName(pickerSearch.trim())
  const pickerList = exerciseCatalog.filter((exercise) =>
    pickerQuery
      ? normalizeName(exercise.name).includes(pickerQuery) ||
        normalizeName(exercise.nameEn).includes(pickerQuery)
      : exercise.muscleGroup === pickerGroup
  )

  return (
    <main className="pb-24">
      <PageHeader
        kicker={`${program === "bjj" ? "JIU-JITSU" : "REGISTRO"} · ${shortDate(toDateKey(today))}`}
        title="Treino"
      />

      <ProgramTabs
        value={program}
        onChange={selectProgram}
        compact
        className="rise mb-3"
      />

      {backdated && (
        <div className="rise mb-3 flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-gold">
            Registro retroativo — salvando como{" "}
            <span className="font-semibold">
              {fromDateKey(toDateKey(today)).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </p>
          <button
            onClick={backToToday}
            className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold underline underline-offset-4 transition-colors hover:text-bone"
          >
            hoje
          </button>
        </div>
      )}

      {bjjPhase && !saved && (
        <div className="rise mb-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold">
              {bjjPhase.label}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-steel-dim">
              {bjjPhase.dates}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-steel">{bjjPhase.guidance}</p>
        </div>
      )}

      {/* seletor de sessão — rolagem horizontal, compacto */}
      <div className="rise -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {availableSessions.filter((s) => s.kind !== "rest").map((s) => (
          <button
            key={s.id}
            onClick={() => {
              sessionPickedRef.current = true
              setSessionId(s.id)
            }}
            className={cn(
              "relative shrink-0 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors",
              sessionId === s.id
                ? s.accent === "zone"
                  ? "border-zone bg-zone/15 text-zone"
                  : s.accent === "gold"
                    ? "border-gold bg-gold/15 text-gold"
                  : "border-ember bg-ember/15 text-ember"
                : s.id === suggestedSessionId
                  ? "border-steel/50 bg-iron-2/40 text-bone"
                  : "border-seam bg-iron-2/40 text-steel hover:border-steel/40 hover:text-bone"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
            title={s.id === suggestedSessionId ? "Próxima do programa" : undefined}
          >
            {s.title}
            {s.id === suggestedSessionId && sessionId !== s.id && (
              <span
                aria-label="próxima do programa"
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ember"
              />
            )}
          </button>
        ))}
      </div>

      {saved && (
        <Card className="rise mb-4 border-l-4 border-l-zone">
          <div className="flex items-center gap-2 text-lg font-semibold text-zone">
            <Check size={20} /> Treino salvo!
          </div>
          {savedOffline ? (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-gold">
              <CloudOff size={13} /> Salvo no aparelho — sincroniza quando a rede voltar.
            </p>
          ) : (
            totals.volume > 0 && (
              <p className="mt-1 font-mono text-xs text-steel">
                {formatKg(totals.volume)} movimentados hoje. {program === "bjj"
                  ? "Qualidade registrada — guarde energia para o tatame."
                  : "Sobrecarga anotada — é assim que o shape vem."}
              </p>
            )
          )}
          {/* estimativa calórica: duração real + MET pelo sRPE (refina ao avaliar) */}
          {savedKcal && (
            <p
              className="mt-1 font-mono text-xs text-gold"
              title={`Estimativa por METs (${savedKcal.met}) com a duração real da sessão · margem ~±20%`}
            >
              ≈ {savedKcal.mid.toLocaleString("pt-BR")} kcal
              <span className="text-steel-dim">
                {" "}({savedKcal.low.toLocaleString("pt-BR")}–{savedKcal.high.toLocaleString("pt-BR")})
                {" "}· {savedKcal.minutes} min
              </span>
              {!savedLog?.srpe && (
                <span className="text-steel-dim"> · toque no esforço abaixo p/ refinar</span>
              )}
            </p>
          )}
          {prCelebrations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {prCelebrations.map((pr, i) => (
                <span
                  key={pr}
                  className="pr-pop inline-flex items-center gap-1 rounded bg-ember px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-coal"
                  style={{ animationDelay: `${0.25 + i * 0.15}s` }}
                >
                  🔥 PR! {pr}
                </span>
              ))}
            </div>
          )}
          {savedLog && (
            <div className="mt-4 border-t border-seam pt-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                Como foi o treino? (sRPE)
                {savedLog.durationMin !== undefined &&
                  savedLog.startedAt !== undefined &&
                  ` · ${savedLog.durationMin} min de sessão`}
              </p>
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => rateSrpe(n)}
                    className={cn(
                      "h-9 flex-1 rounded border font-mono text-xs transition-colors",
                      savedLog.srpe === n
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
                1 = muito leve · 10 = esforço máximo — calibra a fadiga e refina a estimativa de kcal
              </p>
            </div>
          )}
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-bone hover:text-ember"
          >
            <ArrowLeft size={14} /> Voltar ao painel
          </Link>
        </Card>
      )}

      {layoffNotice && !saved && !draftRestored && (
        <div className="rise mb-4 flex items-start gap-2 rounded border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
          <RotateCcw size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">
            {cycleSug?.daysSinceStrength ?? cycleSug?.daysSinceLastLift} dias sem
            musculação (avulso e jiu-jitsu contam) — os campos mantêm a carga da última
            vez e a sugestão entra ~10% abaixo. Sem heroísmo hoje.
          </span>
          <button
            onClick={() => setLayoffNotice(false)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider underline underline-offset-4 transition-colors hover:text-bone"
          >
            estou bem
          </button>
        </div>
      )}

      {draftRestored && !saved && (
        <div className="rise mb-4 flex items-center gap-2 rounded border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-ember">
          <History size={14} className="shrink-0" />
          <span className="flex-1">Rascunho de hoje restaurado.</span>
          <button
            onClick={discardDraft}
            className="flex items-center gap-1 font-semibold text-steel transition-colors hover:text-bone"
          >
            <RotateCcw size={12} /> Recomeçar
          </button>
        </div>
      )}

      {pendingCount > 0 && !saved && (
        <p className="rise mb-4 flex items-center gap-1.5 rounded border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
          <CloudOff size={13} /> {pendingCount}{" "}
          {pendingCount === 1 ? "registro pendente" : "registros pendentes"} de sincronização.
        </p>
      )}

      {editingLog && !saved && !draftRestored && (
        <div className="rise mb-4 flex items-start gap-2 rounded border border-zone/30 bg-zone/5 px-3 py-2 text-xs text-zone">
          <Pencil size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1 leading-relaxed">
            Editando o registro de hoje — o que já estava salvo veio junto. Adicione o
            que faltou e salve por cima.
          </span>
          <button
            onClick={() => {
              setEditingLog(null)
              setActiveExercises(session.exercises)
              applyPrefill(buildPrefill(session, lastLog))
              setNotes("")
              startedAtRef.current = null
              dirtyRef.current = true
            }}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider underline underline-offset-4 transition-colors hover:text-bone"
          >
            do zero
          </button>
        </div>
      )}

      {session.id === "bjjEngine" && !saved && (
        <p className="rise mb-4 rounded border border-gold/30 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-gold">
          Sessão opcional: só com corpo leve e boa recuperação. Rolou pesado esta semana?
          Troque por mobilidade + 30 min de Zona 2 ou encerre o dia.
        </p>
      )}

      {/* cabeçalho da sessão + progresso */}
      <Card
        className={cn(
          "rise rise-1 mb-4 border-l-4",
          program === "bjj" ? "border-l-gold" : "border-l-ember"
        )}
      >
        <h2 className="stencil text-2xl text-bone">{session.title}</h2>
        <p className="text-sm text-steel">{session.subtitle}</p>
        {session.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-steel-dim">{session.description}</p>
        )}
        {isLift && totals.setsTotal > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span className="text-steel">
                {totals.setsDone}/{totals.setsTotal} séries
              </span>
              <span className={program === "bjj" ? "text-gold" : "text-ember-hot"}>
                {formatKg(totals.volume)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-iron-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  program === "bjj" ? "bg-gold" : "bg-ember"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {pickerFor && (
        <Card className="rise mb-4 border-l-4 border-l-gold">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-bone">
                {pickerFor === "new" ? "Adicionar exercício" : "Trocar exercício"}
              </h3>
              <p className="mt-0.5 text-xs text-steel-dim">
                Escolha um equivalente ou registre qualquer movimento.
              </p>
            </div>
            <button
              onClick={() => setPickerFor(null)}
              className={cn(ICON_BTN, "shrink-0 hover:border-ember/50 hover:text-bone")}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Buscar</span>
            <input
              type="text"
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="Ex.: shoulder, abdutora, crunch..."
              className="mt-1 w-full rounded-md border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
            />
          </label>

          {!pickerQuery && (
            <label className="mt-3 block">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Grupo muscular</span>
              <select
                value={pickerGroup}
                onChange={(event) => setPickerGroup(event.target.value as MuscleGroup)}
                className="mt-1 w-full rounded-md border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
              >
                {MUSCLE_GROUP_OPTIONS.map((group) => <option key={group}>{group}</option>)}
              </select>
            </label>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {pickerList.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => applyExerciseChoice(exercise)}
                className="rounded border border-seam bg-coal px-3 py-2 text-left transition-colors hover:border-gold/60"
              >
                <span className="block text-sm font-semibold text-bone">{exercise.name}</span>
                <span className="font-mono text-[10px] uppercase text-steel-dim">
                  {exercise.muscleGroup} · {exercise.equipment} · {exercise.sets} × {exercise.repsMin}–{exercise.repsMax}
                </span>
              </button>
            ))}
          </div>
          {pickerList.length === 0 && (
            <p className="mt-3 rounded border border-seam bg-coal px-3 py-2.5 text-xs text-steel-dim">
              Nada encontrado em <span className="text-bone">{pickerSearch}</span> — cadastre
              manualmente em “Outro exercício” abaixo.
            </p>
          )}

          <div className="mt-4 border-t border-seam pt-3">
            <p className="font-mono text-[10px] uppercase text-steel-dim">Outro exercício</p>
            <div className="mt-1.5 flex gap-2">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addCustomExercise()
                  }
                }}
                placeholder="Ex.: complexo com halteres"
                className="min-w-0 flex-1 rounded-md border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
              />
              <button
                onClick={addCustomExercise}
                disabled={!customName.trim()}
                className="shrink-0 rounded-md bg-gold px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-coal transition-colors hover:bg-gold/85 disabled:opacity-40"
              >
                Incluir
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* musculação */}
      {isLift && (
        <div className="rise mb-3 mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-xs font-semibold uppercase tracking-[0.3em] text-ember"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              Exercícios
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => openExercisePicker("new")}
                className={cn(GHOST_BTN, "hover:border-ember/50 hover:text-bone")}
              >
                <Plus size={14} /> Adicionar
              </button>
              {activeExercises.length > 0 && (
                <button
                  onClick={useDumbbellVersion}
                  className={cn(GHOST_BTN, "hover:border-gold/50 hover:text-bone")}
                >
                  <Dumbbell size={14} /> Halteres
                </button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-steel-dim">
            Mudanças aqui valem só para este treino. Para os próximos, use{" "}
            <Link href="/plano" className="font-semibold text-steel hover:text-ember">
              Editar template em Plano
            </Link>
            .
          </p>
        </div>
      )}

      {isLift && activeExercises.length === 0 && (
        <Card className="rise mb-3 border-dashed">
          <p className="text-center text-sm text-steel-dim">
            Nenhum exercício ainda. Toque em{" "}
            <span className="font-semibold text-bone">Adicionar</span> para montar o treino.
          </p>
        </Card>
      )}

      {activeExercises.map((ex, exIdx) => {
        const previous = exerciseHistory[ex.id]
        const lastEntry = previous?.entry
        const doneCount = (rows[ex.id] ?? []).filter((r) => r.done).length
        const exComplete = doneCount > 0 && doneCount === (rows[ex.id]?.length ?? 0)
        const advice = suggestions[ex.id]
        const suggestion = advice?.suggestion
        // só oferece "aplicar" quando a carga muda; manter carga é orientação,
        // não algo para escrever no campo antes de a série acontecer. O botão
        // some depois de aplicado — nada de convidar para o mesmo toque duas vezes
        const canApply =
          Boolean(suggestion && suggestion.delta !== 0) &&
          (rows[ex.id] ?? []).some((row, i) => {
            if (row.done) return false
            const target = suggestion!.sets[i] ?? suggestion!.sets[suggestion!.sets.length - 1]
            return target && parseFloat(row.weight.replace(",", ".")) !== target.weight
          })
        const fromOtherSession =
          previous && previous.log.sessionId !== session.id
            ? PLAN_BY_ID[previous.log.sessionId]?.title
            : null
        return (
          <Card
            key={ex.id}
            className={cn(
              "rise mb-3 transition-colors",
              `rise-${Math.min(exIdx + 2, 6)}`,
              exComplete && "border-ember/30"
            )}
          >
            {/* título + meta */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-base font-semibold text-bone">
                  {exComplete && (
                    <Check size={16} strokeWidth={3} className="shrink-0 text-ember" />
                  )}
                  <span className="min-w-0 truncate">{ex.name}</span>
                </h3>
                <p className="font-mono text-[10px] text-steel-dim">{ex.nameEn}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => openExercisePicker(ex.id)}
                  className={cn(ICON_BTN, "hover:border-ember/50 hover:text-bone")}
                  aria-label={`Trocar ${ex.name}`}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => removeExercise(ex.id)}
                  className={cn(ICON_BTN, "hover:border-red-500/40 hover:text-red-400")}
                  aria-label={`Remover ${ex.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] text-ember-hot">
                {ex.sets} × {ex.repsMin}–{ex.repsMax}
                {ex.unit === "seconds" ? "s" : ""}
              </span>
              <span className="font-mono text-[10px] text-steel-dim">descanso {ex.rest}</span>
            </div>
            <p className="mt-1 text-xs text-steel-dim">{ex.note}</p>

            {/* referência da última vez — destacada */}
            {lastEntry && (
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded bg-iron-2 px-2.5 py-1.5 font-mono text-[11px] text-steel">
                <History size={12} className="shrink-0 text-steel-dim" />
                <span className="text-steel-dim">{shortDate(previous!.log.date)}:</span>
                <span className="text-bone">
                  {formatWeight(lastEntry.sets[0]?.weight ?? 0)} kg ×{" "}
                  {lastEntry.sets.map((s) => s.reps).join("·")}
                </span>
                {fromOtherSession && (
                  <span className="text-steel-dim">· {fromOtherSession}</span>
                )}
              </div>
            )}

            {/* sugestão de progressão — o campo continua com a carga da última
                vez; subir, manter ou reentrar é decisão de um toque */}
            {suggestion && (
              <div
                className={cn(
                  "mt-2 rounded-lg border px-2.5 py-2",
                  suggestion.advice === "progress"
                    ? "border-ember/40 bg-ember/5"
                    : suggestion.advice === "deload"
                      ? "border-gold/40 bg-gold/5"
                      : "border-seam bg-iron-2/40"
                )}
              >
                <div className="flex items-center gap-2">
                  {suggestion.advice === "progress" ? (
                    <TrendingUp size={13} className="shrink-0 text-ember" />
                  ) : suggestion.advice === "deload" ? (
                    <RotateCcw size={13} className="shrink-0 text-gold" />
                  ) : (
                    <Minus size={13} strokeWidth={3} className="shrink-0 text-steel-dim" />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[12px] font-semibold",
                      suggestion.advice === "progress"
                        ? "text-ember"
                        : suggestion.advice === "deload"
                          ? "text-gold"
                          : "text-steel"
                    )}
                  >
                    {suggestion.summary}
                  </span>
                  {canApply && (
                    <button
                      onClick={() => applySuggestion(ex.id, suggestion)}
                      className={cn(
                        "shrink-0 rounded-md px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-coal transition-colors",
                        suggestion.advice === "deload"
                          ? "bg-gold hover:bg-amber-300"
                          : "bg-ember hover:bg-ember-hot"
                      )}
                    >
                      Aplicar
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-steel-dim">
                  {suggestion.detail}
                </p>
                <button
                  onClick={() =>
                    setStepEditorFor(stepEditorFor === ex.id ? null : ex.id)
                  }
                  className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-steel-dim transition-colors hover:text-bone"
                  aria-expanded={stepEditorFor === ex.id}
                >
                  <SlidersHorizontal size={11} />
                  passo {formatWeight(advice.step)} kg ·{" "}
                  {advice.manualStep ? "fixado" : "do histórico"}
                </button>
                {stepEditorFor === ex.id && (
                  <div className="mt-1.5 border-t border-seam pt-2">
                    <p className="text-[11px] leading-relaxed text-steel-dim">
                      Quanto a menor carga deste aparelho sobe de uma vez? Máquina de
                      pino costuma andar de 5 em 5 — aí 52,5 kg não existe.
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {STEP_OPTIONS.map((option) => (
                        <button
                          key={option}
                          onClick={() => chooseStep(ex.id, option)}
                          className={cn(
                            "h-7 min-w-11 rounded border px-2 font-mono text-[11px] font-semibold transition-colors",
                            advice.step === option
                              ? "border-ember bg-ember/15 text-ember"
                              : "border-seam text-steel hover:text-bone"
                          )}
                          aria-pressed={advice.step === option}
                        >
                          {formatWeight(option)}
                        </button>
                      ))}
                      {advice.manualStep && (
                        <button
                          onClick={() => chooseStep(ex.id, null)}
                          className="h-7 rounded border border-seam px-2 font-mono text-[10px] uppercase tracking-wider text-steel-dim transition-colors hover:text-bone"
                        >
                          automático
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* séries — alvos de toque grandes */}
            <div className="mt-3 space-y-2">
              {(rows[ex.id] ?? []).map((row, i) => {
                const lastEntry = exerciseHistory[ex.id]?.entry
                const lastSet = lastEntry?.sets[i] ?? lastEntry?.sets[lastEntry.sets.length - 1]
                // tendência da série vs. a mesma série da última vez (carga;
                // em empate, reps) — feedback ao vivo de sobrecarga progressiva
                let trend: "up" | "down" | "same" | null = null
                if (lastSet && row.weight) {
                  const currentW = parseFloat(row.weight)
                  if (!isNaN(currentW)) {
                    if (currentW > lastSet.weight) trend = "up"
                    else if (currentW < lastSet.weight) trend = "down"
                    else {
                      const currentR = parseInt(row.reps)
                      if (!isNaN(currentR)) {
                        if (currentR > lastSet.reps) trend = "up"
                        else if (currentR < lastSet.reps) trend = "down"
                        else trend = "same"
                      }
                    }
                  }
                }

                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border p-2 transition-colors",
                      row.done ? "border-ember/40 bg-ember/5" : "border-seam bg-iron-2/50"
                    )}
                  >
                  <div className="flex items-center gap-2.5">
                    <div className="flex flex-col items-center gap-1 w-7 shrink-0">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold",
                          row.done ? "bg-ember text-coal" : "bg-iron-2 text-steel"
                        )}
                      >
                        {i + 1}
                      </span>
                      {trend && (
                        <span
                          title={
                            trend === "up"
                              ? "Mais que da última vez"
                              : trend === "down"
                                ? "Menos que da última vez"
                                : "Igual à última vez"
                          }
                          className={cn(
                            "flex items-center justify-center",
                            trend === "up" ? "text-ember" : "text-steel-dim"
                          )}
                        >
                          {trend === "up" ? (
                            <ChevronUp size={14} strokeWidth={3} />
                          ) : trend === "down" ? (
                            <ChevronDown size={14} strokeWidth={3} />
                          ) : (
                            <Minus size={12} strokeWidth={3} />
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 items-end gap-2">
                      <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <input
                          id={`weight-${ex.id}-${i}`}
                          type="number"
                          inputMode="decimal"
                          enterKeyHint="next"
                          step="0.5"
                          placeholder="–"
                          value={row.weight}
                          onChange={(e) => updateRow(ex.id, i, { weight: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            document.getElementById(`reps-${ex.id}-${i}`)?.focus()
                          }
                        }}
                        className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-ember disabled:opacity-40"
                        disabled={ex.unit === "seconds"}
                      />
                      <span className="text-center font-mono text-[10px] uppercase tracking-wide text-steel-dim">
                        kg
                      </span>
                    </label>
                    <span className="pb-5 text-steel-dim">×</span>
                    <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <input
                        id={`reps-${ex.id}-${i}`}
                        type="number"
                        inputMode="numeric"
                        enterKeyHint={i + 1 < (rows[ex.id]?.length ?? 0) ? "next" : "done"}
                        placeholder="–"
                        value={row.reps}
                        onChange={(e) => updateRow(ex.id, i, { reps: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            const nextInput = document.getElementById(`weight-${ex.id}-${i + 1}`)
                            if (nextInput) nextInput.focus()
                            else e.currentTarget.blur()
                          }
                        }}
                        className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-ember"
                      />
                      <span className="text-center font-mono text-[10px] uppercase tracking-wide text-steel-dim">
                        {ex.unit === "seconds" ? "seg" : "reps"}
                      </span>
                    </label>
                  </div>

                  <button
                    ref={setPopRef(`${ex.id}-${i}`)}
                    onClick={() => toggleSet(ex, i, row.done)}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition-all",
                      row.done
                        ? "border-ember bg-ember text-coal"
                        : "border-seam text-steel-dim hover:border-steel"
                    )}
                    aria-label={`Marcar série ${i + 1} como concluída`}
                    aria-pressed={row.done}
                  >
                    <Check size={22} strokeWidth={3} />
                  </button>
                  </div>

                  {/* RIR — reps em reserva, 1 tap depois de concluir a série */}
                  {row.done && ex.unit === "reps" && (
                    <div className="mt-2 flex items-center gap-1.5 border-t border-seam pt-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                        RIR
                      </span>
                      {["0", "1", "2", "3", "4"].map((v) => (
                        <button
                          key={v}
                          onClick={() => updateRow(ex.id, i, { rir: row.rir === v ? "" : v })}
                          className={cn(
                            "h-6 min-w-8 rounded border px-1.5 font-mono text-[10px] font-semibold transition-colors",
                            row.rir === v
                              ? "border-ember bg-ember/15 text-ember"
                              : "border-seam text-steel-dim hover:text-bone"
                          )}
                          aria-pressed={row.rir === v}
                          aria-label={`${v} repetições em reserva`}
                        >
                          {v === "4" ? "4+" : v}
                        </button>
                      ))}
                      <span className="ml-auto font-mono text-[10px] text-steel-dim">
                        quantas sobraram?
                      </span>
                    </div>
                  )}
                </div>
              )})}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => removeSet(ex.id)}
                disabled={(rows[ex.id]?.length ?? 0) <= 1}
                className="inline-flex items-center gap-1 rounded-md border border-seam px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-steel-dim transition-colors hover:text-bone disabled:opacity-30"
              >
                <Minus size={12} /> Série
              </button>
              <button
                onClick={() => addSet(ex.id)}
                className="inline-flex items-center gap-1 rounded-md border border-seam px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-steel transition-colors hover:border-ember/50 hover:text-bone"
              >
                <Plus size={12} /> Série
              </button>
            </div>
          </Card>
        )
      })}

      {/* cardio — um bloco por estímulo: bike, corrida, caminhada de volta… */}
      <SectionTitle accent="zone">{cardioSectionTitle}</SectionTitle>
      <Card className="rise rise-2 mb-3 border-l-4 border-l-zone">
        {session.id === "bjjZ2" && (
          <p className="mb-3 rounded border border-zone/20 bg-zone/5 px-2.5 py-2 text-xs text-zone">
            Ritmo de conversa — o intervalado você já faz de graça no tatame.
          </p>
        )}
        {cardioRows.length === 0 ? (
          <p className="text-xs text-steel-dim">
            Nenhum cardio neste treino. Toque em{" "}
            <span className="font-semibold text-bone">Adicionar cardio</span> se fez bike,
            corrida, caminhada ou qualquer outro estímulo.
          </p>
        ) : (
          <div className="space-y-3">
            {cardioRows.map((row, index) => (
              <div
                key={index}
                className="rounded-lg border border-seam bg-iron-2/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                    Bloco {index + 1}
                  </p>
                  <button
                    onClick={() => removeCardioRow(index)}
                    className={cn(ICON_BTN, "h-7 w-7 hover:border-red-500/40 hover:text-red-400")}
                    aria-label={`Remover bloco de cardio ${index + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {session.id !== "bjjZ2" && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {CARDIO_PURPOSES.map((purpose) => (
                      <button
                        key={purpose.id}
                        onClick={() => updateCardioRow(index, { purpose: purpose.id })}
                        className={cn(
                          "rounded border px-2 py-2 text-xs font-semibold transition-colors",
                          row.purpose === purpose.id
                            ? "border-zone bg-zone/15 text-zone"
                            : "border-seam text-steel hover:text-bone"
                        )}
                        title={purpose.hint}
                        aria-pressed={row.purpose === purpose.id}
                      >
                        {purpose.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(row.purpose === "sport" ? SPORT_MODES : CARDIO_MODES).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateCardioRow(index, { mode: m })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        row.mode === m
                          ? "border-zone bg-zone/15 text-zone"
                          : "border-seam text-steel hover:text-bone"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <label className="mt-2.5 block">
                  <span className="font-mono text-[10px] uppercase text-steel-dim">
                    Modalidade livre
                  </span>
                  <input
                    type="text"
                    value={row.mode}
                    onChange={(event) => updateCardioRow(index, { mode: event.target.value })}
                    placeholder="Ex.: natação intensa, corda, trilha..."
                    className="mt-1 w-full rounded-md border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-zone"
                  />
                </label>

                <div className="mt-3 flex gap-3">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase text-steel-dim">Minutos</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={row.minutes}
                      onChange={(event) =>
                        updateCardioRow(index, { minutes: event.target.value })
                      }
                      className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-zone"
                    />
                  </label>
                  {row.purpose !== "sport" && (
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase text-steel-dim">
                        BPM médio
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={row.bpm}
                        onChange={(event) => updateCardioRow(index, { bpm: event.target.value })}
                        className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-zone"
                      />
                    </label>
                  )}
                </div>

                {row.purpose === "zone2" && (
                  <p className="mt-2 text-[11px] text-steel-dim">
                    Ritmo de conversa: fala frases completas, não canta
                    {session.cardioTarget?.bpmMin && session.cardioTarget?.bpmMax
                      ? ` (${session.cardioTarget.bpmMin}–${session.cardioTarget.bpmMax} bpm).`
                      : " (~120–140 bpm)."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            onClick={addCardioRow}
            className={cn(GHOST_BTN, "hover:border-zone/50 hover:text-bone")}
          >
            <Plus size={14} /> Adicionar cardio
          </button>
          {totalCardioMin > 0 && (
            <span className="font-mono text-xs text-zone">
              {totalCardioMin}′ no total
            </span>
          )}
        </div>
      </Card>

      {isLift && (
        <p className="mt-3 text-center font-mono text-[10px] text-steel-dim">
          {program === "bjj"
            ? "Sem falha e sem grind: RIR 2–3. Pare o explosivo quando a velocidade cair."
            : "Toda série a 1–3 reps da falha. Anote tudo — sobrecarga progressiva."}
        </p>
      )}

      {/* notas da sessão — vão junto no log (e aparecem no Histórico) */}
      {!saved && (
        <Card className="rise mt-3">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
              Notas da sessão
            </span>
            <textarea
              value={notes}
              onChange={(e) => {
                dirtyRef.current = true
                setNotes(e.target.value)
              }}
              rows={2}
              placeholder="Sensações, substituições, dor, condição do equipamento… (opcional)"
              className="mt-1 w-full resize-y rounded-md border border-seam bg-coal px-3 py-2 text-sm text-bone outline-none focus:border-ember"
            />
          </label>
        </Card>
      )}

      {/* barra de salvar fixa — sempre ao alcance do polegar */}
      <div
        className="fixed inset-x-0 z-40 px-4"
        style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md md:max-w-2xl">
          {saveError && (
            <p className="mb-2 rounded border border-red-500/30 bg-coal/95 px-3 py-2 text-xs text-red-400 backdrop-blur">
              {saveError}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-coal shadow-[0_6px_24px_rgba(0,0,0,0.5)] transition-colors active:scale-[0.99] disabled:opacity-60",
              program === "bjj"
                ? "bg-gold hover:bg-amber-300"
                : "bg-ember hover:bg-ember-hot"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Save size={16} />
            {saving
              ? "Salvando…"
              : editingLog && !saved
                ? isLift
                  ? `Atualizar treino · ${totals.setsDone}/${totals.setsTotal}`
                  : "Atualizar treino"
                : session.kind === "mixed"
                  ? totals.setsTotal > 0
                    ? `Salvar avulso · ${totals.setsDone}/${totals.setsTotal}`
                    : "Salvar avulso"
                  : isLift
                    ? `Salvar treino · ${totals.setsDone}/${totals.setsTotal}`
                    : "Salvar treino"}
          </button>
        </div>
      </div>

      <RestTimer timer={restTimer} />
    </main>
  )
}
