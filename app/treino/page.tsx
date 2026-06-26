"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, ChevronUp, CloudOff, Dumbbell, History, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from "lucide-react"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import { RestTimer } from "@/components/rest-timer"
import { PLAN, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { CardioPurpose, ExercisePrescription, ExerciseLog, MuscleGroup, SessionId, SessionKind, SetRow, WorkoutLog } from "@/lib/types"
import {
  CatalogExercise,
  EXERCISE_CATALOG,
  groupOfExercise,
  makeCustomExercise,
  MUSCLE_GROUP_OPTIONS,
} from "@/lib/exercise-catalog"
import {
  bestE1RM,
  cn,
  formatKg,
  fromDateKey,
  isoWeekday,
  operationalDay,
  toDateKey,
  toOperationalDateKey,
} from "@/lib/utils"
import { parseRestSeconds } from "@/lib/rest"
import { useRestTimer } from "@/lib/use-rest-timer"
import { CycleSuggestion, getScheduleMode, nextInCycle } from "@/lib/cycle"
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "@/lib/draft"
import { tapFeedback } from "@/lib/haptics"

const CARDIO_MODES = ["Bike ergométrica", "Esteira inclinada", "Corrida", "Pular corda", "Natação", "Remo"]
const SPORT_MODES = ["Futsal", "Flag football", "Jiu-jitsu", "Natação", "Outro esporte"]

const CARDIO_PURPOSES: { id: CardioPurpose; label: string; hint: string }[] = [
  { id: "zone2", label: "Zona 2", hint: "ritmo contínuo e confortável" },
  { id: "intense", label: "Intenso", hint: "tiros, corda ou natação forte" },
  { id: "sport", label: "Esporte", hint: "jogo, luta ou treino técnico" },
]

function isStrengthKind(kind: SessionKind): boolean {
  return kind === "lift" || kind === "mixed"
}

function hasCardioForm(kind: SessionKind): boolean {
  return kind === "cardio" || kind === "sport" || kind === "mixed"
}

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function TreinoPage() {
  const { data, addWorkout, pendingCount } = useGymData()
  const restTimer = useRestTimer()
  const [today, setToday] = useState<Date | null>(null)
  const [sessionId, setSessionId] = useState<SessionId | null>(null)
  const [activeExercises, setActiveExercises] = useState<ExercisePrescription[]>([])
  const [rows, setRows] = useState<Record<string, SetRow[]>>({})
  const [cardioMin, setCardioMin] = useState("")
  const [cardioBpm, setCardioBpm] = useState("")
  const [cardioMode, setCardioMode] = useState(CARDIO_MODES[0])
  const [cardioPurpose, setCardioPurpose] = useState<CardioPurpose>("zone2")
  const [finisherMin, setFinisherMin] = useState("20")
  const [pickerFor, setPickerFor] = useState<string | "new" | null>(null)
  const [pickerGroup, setPickerGroup] = useState<MuscleGroup>("Peito")
  const [customName, setCustomName] = useState("")
  const [saved, setSaved] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const [prCelebrations, setPrCelebrations] = useState<string[]>([])
  const [savedLog, setSavedLog] = useState<WorkoutLog | null>(null)
  const [cycleSug, setCycleSug] = useState<CycleSuggestion | null>(null)
  const [regressionApplied, setRegressionApplied] = useState(false)
  const dirtyRef = useRef(false)
  const popRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  /** epoch ms da primeira série marcada (duração real da sessão) */
  const startedAtRef = useRef<number | null>(null)
  const sessionPickedRef = useRef(false)
  const cycleInitRef = useRef(false)

  const setPopRef = useCallback((key: string) => (el: HTMLButtonElement | null) => {
    if (el) popRefs.current.set(key, el)
    else popRefs.current.delete(key)
  }, [])

  useEffect(() => {
    const now = operationalDay(new Date())
    setToday(now)
    // sessão padrão = a planejada para hoje (domingo cai em Upper A)
    const planned = PLAN.find((s) => s.weekday === isoWeekday(now))
    setSessionId(planned && planned.kind !== "rest" ? planned.id : "upperA")
  }, [])

  // modo ciclo: quando os dados chegam, o default vira o próximo da fila
  // (uma vez por visita; a escolha manual no seletor tem prioridade)
  useEffect(() => {
    if (!data || !today || cycleInitRef.current || sessionPickedRef.current) return
    if (getScheduleMode() !== "ciclo") return
    cycleInitRef.current = true
    const sug = nextInCycle(data.workouts, today)
    setCycleSug(sug)
    setSessionId(sug.sessionId)
  }, [data, today])

  const session = sessionId ? PLAN_BY_ID[sessionId] : null

  /** último registro desta sessão (para prefill e comparação) */
  const lastLog = useMemo(() => {
    if (!data || !session || !today) return null
    const todayKey = toDateKey(today)
    const prev = data.workouts.filter(
      (w) => w.sessionId === session.id && w.date < todayKey
    )
    return prev[prev.length - 1] ?? null
  }, [data, session, today])

  const alreadyLoggedToday = useMemo(() => {
    if (!data || !session || !today) return false
    return data.workouts.some(
      (w) => w.date === toDateKey(today) && w.sessionId === session.id
    )
  }, [data, session, today])

  /** Última execução por exercício; treinos oficiais não usam Avulso como prefill. */
  const exerciseHistory = useMemo(() => {
    const history: Record<string, { log: WorkoutLog; entry: ExerciseLog }> = {}
    if (!data || !today || !session) return history
    const todayKey = toDateKey(today)
    for (const log of [...data.workouts].sort((a, b) => a.date.localeCompare(b.date))) {
      if (log.date >= todayKey) continue
      if (session.id !== "free" && log.sessionId === "free") continue
      for (const entry of log.entries) history[entry.exerciseId] = { log, entry }
    }
    return history
  }, [data, session, today])

  /**
   * Pré-preenchimento a partir do último treino desta sessão.
   * factor < 1 = volta de pausa (regressão do ciclo): cargas reduzidas e
   * arredondadas a 2,5 kg, sem auto-progressão.
   */
  const buildPrefill = (
    s: typeof session,
    ll: typeof lastLog,
    factor = 1,
    exercises: ExercisePrescription[] = s!.exercises
  ) => {
    const rows: Record<string, SetRow[]> = {}
    const defaultPurpose: CardioPurpose =
      ll?.cardio?.purpose ?? (s!.kind === "sport" ? "sport" : "zone2")
    for (const ex of exercises) {
      const lastEntry = exerciseHistory[ex.id]?.entry
      rows[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
        const lastSet = lastEntry?.sets[i] ?? lastEntry?.sets[lastEntry.sets.length - 1]
        let suggestedWeight = lastSet ? String(lastSet.weight) : ""
        let suggestedReps = lastSet ? String(lastSet.reps) : ""

        if (lastSet && factor < 1) {
          suggestedWeight = String(
            Math.max(0, Math.round((lastSet.weight * factor) / 2.5) * 2.5)
          )
        } else if (lastSet && lastSet.reps >= ex.repsMax) {
          suggestedWeight = String(lastSet.weight + 2.5)
          suggestedReps = String(ex.repsMin)
        }

        return {
          weight: suggestedWeight,
          reps: suggestedReps,
          done: false,
          rir: "",
        }
      })
    }
    return {
      rows,
      cardioMin:
        s!.kind === "cardio"
          ? ll?.cardio
            ? String(Math.min(50, ll.cardio.minutes + 2))
            : "45"
          : s!.kind === "sport"
            ? "60"
            : s!.kind === "mixed"
              ? ll?.cardio
                ? String(ll.cardio.minutes)
                : "60"
              : "",
      cardioBpm: ll?.cardio?.avgBpm ? String(ll.cardio.avgBpm) : "130",
      cardioMode:
        ll?.cardio?.mode ?? (s!.kind === "sport" ? SPORT_MODES[0] : CARDIO_MODES[0]),
      cardioPurpose: defaultPurpose,
      finisherMin: s!.cardioAfter ? String(s!.cardioAfter.minutes) : "20",
    }
  }

  const applyPrefill = (p: ReturnType<typeof buildPrefill>) => {
    setRows(p.rows)
    setCardioMin(p.cardioMin)
    setCardioBpm(p.cardioBpm)
    setCardioMode(p.cardioMode)
    setCardioPurpose(p.cardioPurpose)
    setFinisherMin(p.finisherMin)
  }

  /** fator de carga do ciclo para a sessão atual (0.9 ao voltar de pausa) */
  const currentFactor = () =>
    cycleSug && cycleSug.reason === "regression" && cycleSug.sessionId === session?.id
      ? cycleSug.loadFactor
      : 1

  // ao trocar de sessão: restaura rascunho do dia se houver, senão pré-preenche
  useEffect(() => {
    if (!session || !today) return
    setSaved(false)
    dirtyRef.current = false
    const dateKey = toDateKey(today)
    const draft = loadDraft(dateKey, session.id)
    if (draft && draftHasContent(draft)) {
      setActiveExercises(draft.exercises ?? session.exercises)
      setRows(draft.rows)
      setCardioMin(draft.cardioMin)
      setCardioBpm(draft.cardioBpm)
      setCardioMode(draft.cardioMode)
      setCardioPurpose(draft.cardioPurpose ?? (session.kind === "sport" ? "sport" : "zone2"))
      setFinisherMin(draft.finisherMin)
      startedAtRef.current = draft.startedAt ?? null
      setDraftRestored(true)
      setRegressionApplied(false)
    } else {
      const factor = currentFactor()
      setActiveExercises(session.exercises)
      applyPrefill(buildPrefill(session, lastLog, factor))
      startedAtRef.current = null
      setDraftRestored(false)
      setRegressionApplied(factor < 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, lastLog, today, cycleSug])

  // autosave do rascunho a cada edição do usuário
  useEffect(() => {
    if (!session || !today || !dirtyRef.current) return
    saveDraft(toDateKey(today), session.id, {
      rows,
      exercises: activeExercises,
      cardioMin,
      cardioBpm,
      cardioMode,
      cardioPurpose,
      finisherMin,
      savedAt: Date.now(),
      startedAt: startedAtRef.current ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeExercises, cardioMin, cardioBpm, cardioMode, cardioPurpose, finisherMin])

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

  if (!data || !session || !today) {
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
      next[choice.id] = buildPrefill(session, lastLog, 1, [prescription]).rows[choice.id]
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
      const options = EXERCISE_CATALOG.filter(
        (exercise) => exercise.muscleGroup === group && exercise.equipment === "halteres"
      )
      const selected = options.find((exercise) => !usedIds.has(exercise.id)) ?? current
      usedIds.add(selected.id)
      return { ...selected }
    })
    const prefill = buildPrefill(session, lastLog, 1, exercises)
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

  const setCardio = (setter: (v: string) => void, value: string) => {
    dirtyRef.current = true
    setter(value)
  }

  const discardDraft = () => {
    if (!session || !today) return
    clearDraft(toDateKey(today), session.id)
    dirtyRef.current = false
    startedAtRef.current = null
    const factor = currentFactor()
    setActiveExercises(session.exercises)
    applyPrefill(buildPrefill(session, lastLog, factor))
    setDraftRestored(false)
    setRegressionApplied(factor < 1)
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

    const cardioMinutes = parseInt(cardioMin) || 0
    if (session.kind === "mixed" && entries.length === 0 && cardioMinutes <= 0) {
      setSaveError("Adicione cardio ou pelo menos um exercício no avulso.")
      return
    }

    const workoutDay =
      isStrengthKind(session.kind) && startedAtRef.current
        ? new Date(startedAtRef.current)
        : new Date()

    const log: WorkoutLog = {
      id: `log-${Date.now()}`,
      date: toOperationalDateKey(workoutDay),
      sessionId: session.id,
      entries,
    }

    // duração real da musculação: 1ª série marcada → salvar
    if (isStrengthKind(session.kind) && startedAtRef.current) {
      log.startedAt = new Date(startedAtRef.current).toISOString()
      log.durationMin = Math.min(
        480,
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000))
      )
    }

    if (hasCardioForm(session.kind)) {
      if (session.kind !== "mixed" || cardioMinutes > 0) {
        log.cardio = {
          minutes: cardioMinutes,
          avgBpm: session.kind !== "sport" ? parseInt(cardioBpm) || undefined : undefined,
          mode: cardioMode,
          purpose: cardioPurpose,
        }
      }
      log.durationMin =
        session.kind === "mixed"
          ? Math.min(480, (log.durationMin ?? 0) + cardioMinutes)
          : cardioMinutes
    } else if (session.cardioAfter) {
      const minutes = parseInt(finisherMin) || 0
      if (minutes > 0) {
        log.cardio = { minutes, mode: "Cardio após musculação", purpose: "zone2" }
      }
    }

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

  return (
    <main className="pb-24">
      <PageHeader kicker={`REGISTRO · ${shortDate(toDateKey(today))}`} title="Treino" />

      {/* seletor de sessão — rolagem horizontal, compacto */}
      <div className="rise -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PLAN.filter((s) => s.kind !== "rest").map((s) => (
          <button
            key={s.id}
            onClick={() => {
              sessionPickedRef.current = true
              setSessionId(s.id)
            }}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors",
              sessionId === s.id
                ? s.accent === "zone"
                  ? "border-zone bg-zone/15 text-zone"
                  : "border-ember bg-ember/15 text-ember"
                : "border-seam text-steel hover:text-bone"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {s.title}
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
                {formatKg(totals.volume)} movimentados hoje. Sobrecarga anotada — é assim
                que o shape vem.
              </p>
            )
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
              <p className="mt-1.5 font-mono text-[9px] text-steel-dim">
                1 = muito leve · 10 = esforço máximo — calibra o sinal de fadiga
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

      {regressionApplied && !saved && !draftRestored && (
        <div className="rise mb-4 flex items-center gap-2 rounded border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
          <RotateCcw size={14} className="shrink-0" />
          <span>
            Voltando de pausa ({cycleSug?.daysSinceLastLift} dias) — cargas sugeridas a
            ~90% da última vez. Sem heroísmo hoje.
          </span>
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

      {alreadyLoggedToday && !saved && (
        <p className="rise mb-4 rounded border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
          Já existe registro desta sessão hoje — salvar de novo substitui.
        </p>
      )}

      {/* cabeçalho da sessão + progresso */}
      <Card className="rise rise-1 mb-4 border-l-4 border-l-ember">
        <h2 className="stencil text-2xl text-bone">{session.title}</h2>
        <p className="text-sm text-steel">{session.subtitle}</p>
        {session.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-steel-dim">{session.description}</p>
        )}
        {isLift && (
          <div className="mt-3">
            {totals.setsTotal > 0 && (
              <>
                <div className="flex items-baseline justify-between font-mono text-xs">
                  <span className="text-steel">
                    {totals.setsDone}/{totals.setsTotal} séries
                  </span>
                  <span className="text-ember-hot">{formatKg(totals.volume)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-iron-2">
                  <div
                    className="h-full rounded-full bg-ember transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => openExercisePicker("new")}
                className="inline-flex items-center gap-1.5 rounded border border-seam px-3 py-2 text-xs font-semibold text-steel transition-colors hover:border-ember/50 hover:text-bone"
              >
                <Plus size={14} /> Adicionar exercício
              </button>
              {activeExercises.length > 0 && (
                <button
                  onClick={useDumbbellVersion}
                  className="inline-flex items-center gap-1.5 rounded border border-seam px-3 py-2 text-xs font-semibold text-steel transition-colors hover:border-gold/50 hover:text-bone"
                >
                  <Dumbbell size={14} /> Versão com halteres
                </button>
              )}
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
            <button onClick={() => setPickerFor(null)} className="p-1 text-steel hover:text-bone" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

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

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXERCISE_CATALOG.filter((exercise) => exercise.muscleGroup === pickerGroup).map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => applyExerciseChoice(exercise)}
                className="rounded border border-seam bg-coal px-3 py-2 text-left transition-colors hover:border-gold/60"
              >
                <span className="block text-sm font-semibold text-bone">{exercise.name}</span>
                <span className="font-mono text-[9px] uppercase text-steel-dim">
                  {exercise.equipment} · {exercise.sets} × {exercise.repsMin}–{exercise.repsMax}
                </span>
              </button>
            ))}
          </div>

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
                className="rounded-md bg-gold px-3 text-sm font-bold text-coal disabled:opacity-40"
              >
                Incluir
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* musculação */}
      {activeExercises.map((ex, exIdx) => {
        const previous = exerciseHistory[ex.id]
        const lastEntry = previous?.entry
        const doneCount = (rows[ex.id] ?? []).filter((r) => r.done).length
        const exComplete = doneCount > 0 && doneCount === (rows[ex.id]?.length ?? 0)
        const hitTop =
          lastEntry &&
          ex.unit === "reps" &&
          lastEntry.sets.length >= ex.sets &&
          lastEntry.sets.every((s) => s.reps >= ex.repsMax)
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
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-semibold text-bone">
                  {exComplete && (
                    <Check size={16} strokeWidth={3} className="shrink-0 text-ember" />
                  )}
                  {ex.name}
                </h3>
                <p className="font-mono text-[10px] text-steel-dim">{ex.nameEn}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className="rounded bg-iron-2 px-2 py-1 font-mono text-[11px] text-steel"
                  title={`Descanso ${ex.rest}`}
                >
                  {ex.sets} × {ex.repsMin}–{ex.repsMax}
                  {ex.unit === "seconds" ? "s" : ""} · {ex.rest}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openExercisePicker(ex.id)} className="rounded border border-seam p-1.5 text-steel hover:text-bone" aria-label={`Trocar ${ex.name}`}>
                    <RefreshCw size={12} />
                  </button>
                  <button onClick={() => removeExercise(ex.id)} className="rounded border border-seam p-1.5 text-steel-dim hover:text-ember" aria-label={`Remover ${ex.name}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-1 text-xs text-steel-dim">{ex.note}</p>

            {/* referência da última vez — destacada */}
            {lastEntry && (
              <div className="mt-2 flex items-center gap-1.5 rounded bg-iron-2 px-2.5 py-1.5 font-mono text-[11px] text-steel">
                <History size={12} className="shrink-0 text-steel-dim" />
                <span className="text-steel-dim">{shortDate(previous!.log.date)}:</span>
                <span className="text-bone">
                  {lastEntry.sets[0]?.weight ?? 0} kg × {lastEntry.sets.map((s) => s.reps).join("·")}
                </span>
              </div>
            )}
            {hitTop && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-ember/10 px-2 py-1 font-mono text-[11px] font-semibold text-ember">
                <ChevronUp size={12} strokeWidth={3} /> Topo da faixa em todas — suba 2,5–5 kg
              </p>
            )}

            {/* séries — alvos de toque grandes */}
            <div className="mt-3 space-y-2">
              {(rows[ex.id] ?? []).map((row, i) => {
                const lastEntry = exerciseHistory[ex.id]?.entry
                const lastSet = lastEntry?.sets[i] ?? lastEntry?.sets[lastEntry.sets.length - 1]
                let indicator = null
                if (lastSet && row.weight) {
                  const currentW = parseFloat(row.weight)
                  if (!isNaN(currentW)) {
                    if (currentW > lastSet.weight) indicator = "🔼"
                    else if (currentW < lastSet.weight) indicator = "🔽"
                    else {
                      const currentR = parseInt(row.reps)
                      if (!isNaN(currentR)) {
                        if (currentR > lastSet.reps) indicator = "🔼"
                        else if (currentR < lastSet.reps) indicator = "🔽"
                        else indicator = "▶️"
                      }
                    }
                  }
                }

                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border p-2 transition-colors",
                      row.done ? "border-ember/40 bg-ember/5" : "border-seam bg-coal"
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
                      {indicator && <span className="text-[10px] text-steel-dim">{indicator}</span>}
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
                      <span className="text-center font-mono text-[9px] uppercase tracking-wide text-steel-dim">
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
                      <span className="text-center font-mono text-[9px] uppercase tracking-wide text-steel-dim">
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
                      <span className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">
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
                      <span className="ml-auto font-mono text-[8px] text-steel-dim">
                        quantas sobraram?
                      </span>
                    </div>
                  )}
                </div>
              )})}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => removeSet(ex.id)}
                disabled={(rows[ex.id]?.length ?? 0) <= 1}
                className="rounded border border-seam px-2.5 py-1.5 font-mono text-[10px] text-steel disabled:opacity-30"
              >
                − série
              </button>
              <button onClick={() => addSet(ex.id)} className="rounded border border-seam px-2.5 py-1.5 font-mono text-[10px] text-steel hover:text-bone">
                + série
              </button>
            </div>
          </Card>
        )
      })}

      {/* cardio / esporte */}
      {hasCardioForm(session.kind) && (
        <Card className="rise rise-2 mb-3 border-l-4 border-l-zone">
          <h3 className="text-base font-semibold text-bone">
            {session.kind === "sport"
              ? "Sessão de esporte"
              : session.kind === "mixed"
                ? "Cardio avulso"
                : "Sessão de cardio"}
          </h3>
          {cardioPurpose === "zone2" && (
            <p className="mt-1 text-xs text-steel-dim">
              Ritmo de conversa: fala frases completas, não canta (~120–140 bpm).
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {CARDIO_PURPOSES.map((purpose) => (
              <button
                key={purpose.id}
                onClick={() => {
                  dirtyRef.current = true
                  setCardioPurpose(purpose.id)
                }}
                className={cn(
                  "rounded border px-2 py-2 text-xs font-semibold transition-colors",
                  cardioPurpose === purpose.id
                    ? "border-zone bg-zone/15 text-zone"
                    : "border-seam text-steel hover:text-bone"
                )}
                title={purpose.hint}
              >
                {purpose.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(session.kind === "sport" ? SPORT_MODES : CARDIO_MODES).map((m) => (
              <button
                key={m}
                onClick={() => setCardio(setCardioMode, m)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  cardioMode === m
                    ? "border-zone bg-zone/15 text-zone"
                    : "border-seam text-steel hover:text-bone"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Modalidade livre</span>
            <input
              type="text"
              value={cardioMode}
              onChange={(event) => setCardio(setCardioMode, event.target.value)}
              placeholder="Ex.: natação intensa, corda, trilha..."
              className="mt-1 w-full rounded-md border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-zone"
            />
          </label>
          <div className="mt-4 flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Minutos</span>
              <input
                type="number"
                inputMode="numeric"
                value={cardioMin}
                onChange={(e) => setCardio(setCardioMin, e.target.value)}
                className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-zone"
              />
            </label>
            {session.kind !== "sport" && (
              <label className="flex flex-1 flex-col gap-1">
                <span className="font-mono text-[10px] uppercase text-steel-dim">BPM médio</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cardioBpm}
                  onChange={(e) => setCardio(setCardioBpm, e.target.value)}
                  className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-zone"
                />
              </label>
            )}
          </div>
        </Card>
      )}

      {/* finisher Z2 do Lower B */}
      {session.cardioAfter && (
        <Card className="rise mb-3 border-l-4 border-l-zone">
          <h3 className="text-sm font-semibold text-bone">
            Finisher — {session.cardioAfter.label}
          </h3>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={finisherMin}
              onChange={(e) => setCardio(setFinisherMin, e.target.value)}
              className="w-24 rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-zone"
            />
            <span className="font-mono text-xs text-steel">min em Zona 2</span>
          </label>
        </Card>
      )}

      <p className="mt-3 text-center font-mono text-[10px] text-steel-dim">
        Toda série a 1–3 reps da falha. Anote tudo — sobrecarga progressiva.
      </p>

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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ember py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-coal shadow-[0_6px_24px_rgba(0,0,0,0.5)] transition-colors hover:bg-ember-hot active:scale-[0.99] disabled:opacity-60"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Save size={16} />
            {saving
              ? "Salvando…"
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
