"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, ChevronUp, CloudOff, History, RotateCcw, Save } from "lucide-react"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import { RestTimer } from "@/components/rest-timer"
import { PLAN, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { ExercisePrescription, ExerciseLog, SessionId, SetRow, WorkoutLog } from "@/lib/types"
import { bestE1RM, cn, formatKg, fromDateKey, isoWeekday, toDateKey } from "@/lib/utils"
import { parseRestSeconds } from "@/lib/rest"
import { useRestTimer } from "@/lib/use-rest-timer"
import { CycleSuggestion, getScheduleMode, nextInCycle } from "@/lib/cycle"
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "@/lib/draft"
import { tapFeedback } from "@/lib/haptics"

const CARDIO_MODES = ["Bike ergométrica", "Esteira inclinada", "Corrida leve", "Remo"]
const SPORT_MODES = ["Futsal", "Flag football", "Jiu-jitsu"]

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function TreinoPage() {
  const { data, addWorkout, pendingCount } = useGymData()
  const restTimer = useRestTimer()
  const [today, setToday] = useState<Date | null>(null)
  const [sessionId, setSessionId] = useState<SessionId | null>(null)
  const [rows, setRows] = useState<Record<string, SetRow[]>>({})
  const [cardioMin, setCardioMin] = useState("")
  const [cardioBpm, setCardioBpm] = useState("")
  const [cardioMode, setCardioMode] = useState(CARDIO_MODES[0])
  const [finisherMin, setFinisherMin] = useState("20")
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
    const now = new Date()
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

  /**
   * Pré-preenchimento a partir do último treino desta sessão.
   * factor < 1 = volta de pausa (regressão do ciclo): cargas reduzidas e
   * arredondadas a 2,5 kg, sem auto-progressão.
   */
  const buildPrefill = (s: typeof session, ll: typeof lastLog, factor = 1) => {
    const rows: Record<string, SetRow[]> = {}
    for (const ex of s!.exercises) {
      const lastEntry = ll?.entries.find((e) => e.exerciseId === ex.id)
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
            : "",
      cardioBpm: ll?.cardio?.avgBpm ? String(ll.cardio.avgBpm) : "130",
      cardioMode:
        s!.kind === "sport" ? SPORT_MODES[0] : ll?.cardio?.mode ?? CARDIO_MODES[0],
      finisherMin: s!.cardioAfter ? String(s!.cardioAfter.minutes) : "20",
    }
  }

  const applyPrefill = (p: ReturnType<typeof buildPrefill>) => {
    setRows(p.rows)
    setCardioMin(p.cardioMin)
    setCardioBpm(p.cardioBpm)
    setCardioMode(p.cardioMode)
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
      setRows(draft.rows)
      setCardioMin(draft.cardioMin)
      setCardioBpm(draft.cardioBpm)
      setCardioMode(draft.cardioMode)
      setFinisherMin(draft.finisherMin)
      startedAtRef.current = draft.startedAt ?? null
      setDraftRestored(true)
      setRegressionApplied(false)
    } else {
      const factor = currentFactor()
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
      cardioMin,
      cardioBpm,
      cardioMode,
      finisherMin,
      savedAt: Date.now(),
      startedAt: startedAtRef.current ?? undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cardioMin, cardioBpm, cardioMode, finisherMin])

  const totals = useMemo(() => {
    let volume = 0
    let setsDone = 0
    let setsTotal = 0
    for (const ex of session?.exercises ?? []) {
      for (const r of rows[ex.id] ?? []) {
        setsTotal++
        if (r.done) setsDone++
        const w = parseFloat(r.weight.replace(",", "."))
        const reps = parseInt(r.reps)
        if (!isNaN(w) && !isNaN(reps)) volume += w * reps
      }
    }
    return { volume, setsDone, setsTotal }
  }, [rows, session])

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
    applyPrefill(buildPrefill(session, lastLog, factor))
    setDraftRestored(false)
    setRegressionApplied(factor < 1)
  }

  const handleSave = async () => {
    const entries: ExerciseLog[] = session.exercises
      .map((ex) => ({
        exerciseId: ex.id,
        sets: (rows[ex.id] ?? [])
          .map((r) => ({
            weight: parseFloat(r.weight.replace(",", ".")) || 0,
            reps: parseInt(r.reps) || 0,
            ...(r.rir !== undefined && r.rir !== "" ? { rir: parseInt(r.rir) } : {}),
          }))
          .filter((s) => s.reps > 0),
      }))
      .filter((e) => e.sets.length > 0)

    const log: WorkoutLog = {
      id: `log-${Date.now()}`,
      date: toDateKey(today),
      sessionId: session.id,
      entries,
    }

    // duração real da musculação: 1ª série marcada → salvar
    if (session.kind === "lift" && startedAtRef.current) {
      log.startedAt = new Date(startedAtRef.current).toISOString()
      log.durationMin = Math.min(
        480,
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000))
      )
    }

    if (session.kind === "cardio" || session.kind === "sport") {
      const minutes = parseInt(cardioMin) || 0
      log.cardio = {
        minutes,
        avgBpm: session.kind === "cardio" ? parseInt(cardioBpm) || undefined : undefined,
        mode: cardioMode,
      }
      log.durationMin = minutes
    } else if (session.cardioAfter) {
      const minutes = parseInt(finisherMin) || 0
      if (minutes > 0) {
        log.cardio = { minutes, mode: "Bike ou esteira — Z2" }
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
          const exDef = session.exercises.find((e) => e.id === entry.exerciseId)
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
  const isLift = session.kind === "lift"

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
          </div>
        )}
      </Card>

      {/* musculação */}
      {session.exercises.map((ex, exIdx) => {
        const lastEntry = lastLog?.entries.find((e) => e.exerciseId === ex.id)
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
              <span
                className="shrink-0 rounded bg-iron-2 px-2 py-1 font-mono text-[11px] text-steel"
                title={`Descanso ${ex.rest}`}
              >
                {ex.sets} × {ex.repsMin}–{ex.repsMax}
                {ex.unit === "seconds" ? "s" : ""} · {ex.rest}
              </span>
            </div>
            <p className="mt-1 text-xs text-steel-dim">{ex.note}</p>

            {/* referência da última vez — destacada */}
            {lastEntry && (
              <div className="mt-2 flex items-center gap-1.5 rounded bg-iron-2 px-2.5 py-1.5 font-mono text-[11px] text-steel">
                <History size={12} className="shrink-0 text-steel-dim" />
                <span className="text-steel-dim">{shortDate(lastLog!.date)}:</span>
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
                const lastEntry = lastLog?.entries.find((e) => e.exerciseId === ex.id)
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
          </Card>
        )
      })}

      {/* cardio / esporte */}
      {(session.kind === "cardio" || session.kind === "sport") && (
        <Card className="rise rise-2 mb-3 border-l-4 border-l-zone">
          <h3 className="text-base font-semibold text-bone">
            {session.kind === "cardio" ? "Sessão Zona 2" : "Sessão de esporte"}
          </h3>
          {session.kind === "cardio" && (
            <p className="mt-1 text-xs text-steel-dim">
              Ritmo de conversa: fala frases completas, não canta (~120–140 bpm).
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(session.kind === "cardio" ? CARDIO_MODES : SPORT_MODES).map((m) => (
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
            {session.kind === "cardio" && (
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
