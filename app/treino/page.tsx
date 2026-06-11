"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, ChevronUp, Save } from "lucide-react"
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const handleSave = async () => {
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

    setSaving(true)
    setSaveError(null)
    try {
      await addWorkout(log)
      setSaved(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar no banco")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main>
      <PageHeader kicker={`REGISTRO · ${shortDate(toDateKey(today))}`} title="Treino" />

      {/* seletor de sessão */}
      <div className="rise mb-4 flex flex-wrap gap-1.5">
        {PLAN.filter((s) => s.kind !== "rest").map((s) => (
          <button
            key={s.id}
            onClick={() => setSessionId(s.id)}
            className={cn(
              "rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              sessionId === s.id
                ? s.accent === "zone"
                  ? "border-zone bg-zone/10 text-zone"
                  : "border-ember bg-ember/10 text-ember"
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
          <div className="flex items-center gap-2 font-semibold text-zone">
            <Check size={18} /> Treino salvo!
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

      <Card className="rise rise-1 mb-4 border-l-4 border-l-ember">
        <h2 className="stencil text-2xl text-bone">{session.title}</h2>
        <p className="text-sm text-steel">{session.subtitle}</p>
        {session.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-steel-dim">{session.description}</p>
        )}
        {session.kind === "lift" && (
          <p className="mt-2 font-mono text-xs text-steel">
            {totals.setsDone}/{totals.setsTotal} séries ·{" "}
            <span className="text-ember-hot">{formatKg(totals.volume)}</span> previstos
          </p>
        )}
      </Card>

      {/* musculação */}
      {session.exercises.map((ex, exIdx) => {
        const lastEntry = lastLog?.entries.find((e) => e.exerciseId === ex.id)
        const hitTop =
          lastEntry &&
          ex.unit === "reps" &&
          lastEntry.sets.length >= ex.sets &&
          lastEntry.sets.every((s) => s.reps >= ex.repsMax)
        return (
          <Card key={ex.id} className={cn("rise mb-3", `rise-${Math.min(exIdx + 2, 6)}`)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-bone">{ex.name}</h3>
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

            {lastEntry && (
              <p className="mt-2 font-mono text-[11px] text-steel">
                Último ({shortDate(lastLog!.date)}):{" "}
                <span className="text-bone">
                  {lastEntry.sets[0]?.weight ?? 0} kg ×{" "}
                  {lastEntry.sets.map((s) => s.reps).join("·")}
                </span>
              </p>
            )}
            {hitTop && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-ember/10 px-2 py-1 font-mono text-[11px] font-semibold text-ember">
                <ChevronUp size={12} strokeWidth={3} /> Topo da faixa em todas — suba 2,5–5 kg
              </p>
            )}

            <div className="mt-3 space-y-1.5">
              {(rows[ex.id] ?? []).map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 font-mono text-[10px] text-steel-dim">S{i + 1}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    placeholder="kg"
                    value={row.weight}
                    onChange={(e) => updateRow(ex.id, i, { weight: e.target.value })}
                    className="w-20 rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-ember"
                    disabled={ex.unit === "seconds"}
                  />
                  <span className="text-steel-dim">×</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={ex.unit === "seconds" ? "seg" : "reps"}
                    value={row.reps}
                    onChange={(e) => updateRow(ex.id, i, { reps: e.target.value })}
                    className="w-16 rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-ember"
                  />
                  {ex.unit === "seconds" && (
                    <span className="font-mono text-[10px] text-steel-dim">seg</span>
                  )}
                  <button
                    onClick={() => updateRow(ex.id, i, { done: !row.done })}
                    className={cn(
                      "ml-auto flex h-8 w-8 items-center justify-center rounded border transition-all",
                      row.done
                        ? "border-ember bg-ember text-coal"
                        : "border-seam text-steel-dim hover:border-steel"
                    )}
                    aria-label={`Série ${i + 1} concluída`}
                  >
                    <Check size={15} strokeWidth={3} />
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(session.kind === "cardio" ? CARDIO_MODES : SPORT_MODES).map((m) => (
              <button
                key={m}
                onClick={() => setCardioMode(m)}
                className={cn(
                  "rounded border px-2.5 py-1 text-xs transition-colors",
                  cardioMode === m
                    ? "border-zone bg-zone/10 text-zone"
                    : "border-seam text-steel hover:text-bone"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Minutos</span>
              <input
                type="number"
                inputMode="numeric"
                value={cardioMin}
                onChange={(e) => setCardioMin(e.target.value)}
                className="w-24 rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-zone"
              />
            </label>
            {session.kind === "cardio" && (
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase text-steel-dim">BPM médio</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cardioBpm}
                  onChange={(e) => setCardioBpm(e.target.value)}
                  className="w-24 rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-zone"
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
              className="w-20 rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-zone"
            />
            <span className="font-mono text-xs text-steel">min em Zona 2</span>
          </label>
        </Card>
      )}

      {saveError && (
        <p className="mb-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {saveError}
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-ember py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-coal transition-colors hover:bg-ember-hot disabled:opacity-60"
        style={{ fontFamily: "var(--font-condensed)" }}
      >
        <Save size={16} /> {saving ? "Salvando…" : "Salvar treino"}
      </button>
      <p className="mt-3 text-center font-mono text-[10px] text-steel-dim">
        Toda série a 1–3 reps da falha. Anote tudo — sobrecarga progressiva.
      </p>
    </main>
  )
}
