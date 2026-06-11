"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, ChevronUp, History, Save } from "lucide-react"
import { Card, PageHeader } from "@/components/ui"
import { PLAN, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { ExerciseLog, SessionId, WorkoutLog } from "@/lib/types"
import { cn, formatKg, fromDateKey, isoWeekday, toDateKey } from "@/lib/utils"

type SetRow = { weight: string; reps: string; done: boolean }

const CARDIO_MODES = ["Bike ergométrica", "Esteira inclinada", "Corrida leve", "Remo"]
const SPORT_MODES = ["Futsal", "Flag football", "Jiu-jitsu"]

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function TreinoPage() {
  const { data, addWorkout } = useGymData()
  const [today, setToday] = useState<Date | null>(null)
  const [sessionId, setSessionId] = useState<SessionId | null>(null)
  const [rows, setRows] = useState<Record<string, SetRow[]>>({})
  const [cardioMin, setCardioMin] = useState("")
  const [cardioBpm, setCardioBpm] = useState("")
  const [cardioMode, setCardioMode] = useState(CARDIO_MODES[0])
  const [finisherMin, setFinisherMin] = useState("20")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const now = new Date()
    setToday(now)
    // sessão padrão = a planejada para hoje (domingo cai em Upper A)
    const planned = PLAN.find((s) => s.weekday === isoWeekday(now))
    setSessionId(planned && planned.kind !== "rest" ? planned.id : "upperA")
  }, [])

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

  // monta linhas de séries quando muda a sessão
  useEffect(() => {
    if (!session) return
    setSaved(false)
    const next: Record<string, SetRow[]> = {}
    for (const ex of session.exercises) {
      const lastEntry = lastLog?.entries.find((e) => e.exerciseId === ex.id)
      next[ex.id] = Array.from({ length: ex.sets }, (_, i) => {
        const lastSet = lastEntry?.sets[i] ?? lastEntry?.sets[lastEntry.sets.length - 1]
        return {
          weight: lastSet ? String(lastSet.weight) : "",
          reps: lastSet ? String(lastSet.reps) : "",
          done: false,
        }
      })
    }
    setRows(next)
    if (session.kind === "cardio") {
      setCardioMin(lastLog?.cardio ? String(Math.min(50, lastLog.cardio.minutes + 2)) : "45")
      setCardioBpm(lastLog?.cardio?.avgBpm ? String(lastLog.cardio.avgBpm) : "130")
      setCardioMode(lastLog?.cardio?.mode ?? CARDIO_MODES[0])
    } else if (session.kind === "sport") {
      setCardioMin("60")
      setCardioMode(SPORT_MODES[0])
    } else if (session.cardioAfter) {
      setFinisherMin(String(session.cardioAfter.minutes))
    }
  }, [session, lastLog])

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
        <Card className="animate-pulse text-sm text-steel">Carregando…</Card>
      </main>
    )
  }

  const updateRow = (exId: string, idx: number, patch: Partial<SetRow>) => {
    setRows((prev) => ({
      ...prev,
      [exId]: prev[exId].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }

  const handleSave = () => {
    const entries: ExerciseLog[] = session.exercises
      .map((ex) => ({
        exerciseId: ex.id,
        sets: (rows[ex.id] ?? [])
          .map((r) => ({
            weight: parseFloat(r.weight.replace(",", ".")) || 0,
            reps: parseInt(r.reps) || 0,
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

    addWorkout(log)
    setSaved(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
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
            onClick={() => setSessionId(s.id)}
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
          {totals.volume > 0 && (
            <p className="mt-1 font-mono text-xs text-steel">
              {formatKg(totals.volume)} movimentados hoje. Sobrecarga anotada — é assim
              que o shape vem.
            </p>
          )}
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-bone hover:text-ember"
          >
            <ArrowLeft size={14} /> Voltar ao painel
          </Link>
        </Card>
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
              {(rows[ex.id] ?? []).map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border p-2 transition-colors",
                    row.done ? "border-ember/40 bg-ember/5" : "border-seam bg-coal"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                      row.done ? "bg-ember text-coal" : "bg-iron-2 text-steel"
                    )}
                  >
                    {i + 1}
                  </span>

                  <div className="flex min-w-0 flex-1 items-end gap-2">
                    <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        placeholder="–"
                        value={row.weight}
                        onChange={(e) => updateRow(ex.id, i, { weight: e.target.value })}
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
                        type="number"
                        inputMode="numeric"
                        placeholder="–"
                        value={row.reps}
                        onChange={(e) => updateRow(ex.id, i, { reps: e.target.value })}
                        className="w-full rounded-md border border-seam bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-ember"
                      />
                      <span className="text-center font-mono text-[9px] uppercase tracking-wide text-steel-dim">
                        {ex.unit === "seconds" ? "seg" : "reps"}
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={() => updateRow(ex.id, i, { done: !row.done })}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition-all",
                      row.done
                        ? "border-ember bg-ember text-coal"
                        : "border-seam text-steel-dim hover:border-steel active:scale-95"
                    )}
                    aria-label={`Marcar série ${i + 1} como concluída`}
                    aria-pressed={row.done}
                  >
                    <Check size={22} strokeWidth={3} />
                  </button>
                </div>
              ))}
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
                onClick={() => setCardioMode(m)}
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
                onChange={(e) => setCardioMin(e.target.value)}
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
                  onChange={(e) => setCardioBpm(e.target.value)}
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
              onChange={(e) => setFinisherMin(e.target.value)}
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
      <div className="fixed inset-x-0 bottom-[68px] z-40 px-4">
        <div className="mx-auto max-w-md md:max-w-2xl">
          <button
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ember py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-coal shadow-[0_6px_24px_rgba(0,0,0,0.5)] transition-colors hover:bg-ember-hot active:scale-[0.99]"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Save size={16} />
            {isLift ? `Salvar treino · ${totals.setsDone}/${totals.setsTotal}` : "Salvar treino"}
          </button>
        </div>
      </div>
    </main>
  )
}
