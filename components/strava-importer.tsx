"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, FileUp } from "lucide-react"
import { Card } from "@/components/ui"
import { cardioBlocks } from "@/lib/cardio"
import { sessionKcal, weightKgOn } from "@/lib/insights"
import {
  RUNNING_PAIN_THRESHOLD,
  RUNNING_SHOE_NAME,
  RUNNING_START_DATE,
  RUN_STAGES,
  RunStageId,
  isOverVolumeCeiling,
} from "@/lib/running-plan"
import { formatActivityDuration, parseStravaCsv, toStravaCardioLog } from "@/lib/strava"
import { BodyLog, CardioLog, WorkoutLog } from "@/lib/types"
import { cn, fromDateKey } from "@/lib/utils"

export interface StravaRunningOptions {
  /** Estágio sugerido para o dia atual quando a atividade for >= 07/11. */
  defaultStageId: RunStageId
  defaultShoe?: string
}

interface StravaImporterProps {
  workouts: WorkoutLog[]
  body: BodyLog[]
  addWorkout: (workout: WorkoutLog) => Promise<void>
  runningOptions?: StravaRunningOptions
  compact?: boolean
  title?: string
  subtitle?: string
  className?: string
  onSaved?: (insertedCount: number) => void
}

function parseClockToSeconds(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return undefined
  const mins = parseInt(match[1], 10)
  const secs = parseInt(match[2], 10)
  if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) return undefined
  const total = mins * 60 + secs
  return total > 0 ? total : undefined
}

export function StravaImporter({
  workouts,
  body,
  addWorkout,
  runningOptions,
  compact = false,
  title = "Importar atividades do Strava",
  subtitle = "Envie o CSV ou cole o conteúdo. Aceita caminhada/corrida em tabela ou no formato vertical da balança.",
  className,
  onSaved,
}: StravaImporterProps) {
  const [stravaText, setStravaText] = useState("")
  const [stravaSaving, setStravaSaving] = useState(false)
  const [stravaError, setStravaError] = useState<string | null>(null)
  const [stravaSavedCount, setStravaSavedCount] = useState(0)

  // Metadados rápidos do plano de 5 km quando usado no contexto de corrida
  const [stageId, setStageId] = useState<RunStageId>(
    runningOptions?.defaultStageId ?? "1-2x8"
  )
  const [painScore, setPainScore] = useState<number | null>(null)
  const [useCorreMax, setUseCorreMax] = useState(true)
  const [segmentClock, setSegmentClock] = useState("")

  useEffect(() => {
    if (runningOptions?.defaultStageId) {
      setStageId(runningOptions.defaultStageId)
    }
  }, [runningOptions?.defaultStageId])

  const stravaParse = useMemo(
    () => (stravaText.trim() ? parseStravaCsv(stravaText) : null),
    [stravaText]
  )

  const loadStravaFile = async (file: File | undefined) => {
    if (!file) return
    setStravaError(null)
    try {
      setStravaText(await file.text())
    } catch {
      setStravaError("Não foi possível ler o arquivo CSV.")
    }
  }

  const saveStravaActivities = async () => {
    if (!stravaParse || stravaParse.activities.length === 0 || stravaParse.errors.length > 0) {
      setStravaError("Revise os campos do CSV antes de salvar.")
      return
    }

    const segmentTimeSec = parseClockToSeconds(segmentClock)
    if (segmentClock.trim() && segmentTimeSec === undefined) {
      setStravaError("Tempo do segmento inválido. Use mm:ss (ex.: 16:28).")
      return
    }

    const incomingByDate = new Map<string, CardioLog[]>()
    for (const activity of stravaParse.activities) {
      const blocks = incomingByDate.get(activity.date) ?? []
      const baseBlock = toStravaCardioLog(activity)
      const enriched: CardioLog =
        runningOptions && activity.date >= RUNNING_START_DATE
          ? {
              ...baseBlock,
              runStageId: stageId,
              ...(painScore !== null ? { painScore } : {}),
              ...(useCorreMax
                ? { shoe: runningOptions.defaultShoe ?? RUNNING_SHOE_NAME }
                : {}),
              ...(segmentTimeSec !== undefined ? { segmentTimeSec } : {}),
            }
          : baseBlock
      blocks.push(enriched)
      incomingByDate.set(activity.date, blocks)
    }

    const pending: WorkoutLog[] = []
    let inserted = 0
    for (const [date, incoming] of incomingByDate) {
      const existing = workouts.find(
        (workout) => workout.date === date && workout.sessionId === "strava"
      )
      const previousBlocks = existing ? cardioBlocks(existing) : []
      const knownIds = new Set(previousBlocks.map((block) => block.sourceId).filter(Boolean))
      const fresh = incoming.filter((block) => !block.sourceId || !knownIds.has(block.sourceId))
      if (fresh.length === 0) continue

      const blocks = [...previousBlocks, ...fresh].sort((a, b) =>
        (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")
      )
      const durationMin = Math.max(
        1,
        Math.round(
          blocks.reduce(
            (sum, block) =>
              sum +
              (block.durationSeconds !== undefined
                ? block.durationSeconds / 60
                : block.minutes),
            0
          )
        )
      )
      pending.push({
        ...(existing ?? {
          id: `strava-${date}-${Date.now()}`,
          date,
          sessionId: "strava" as const,
          entries: [],
        }),
        durationMin,
        cardio: blocks[0],
        cardios: blocks,
      })
      inserted += fresh.length
    }

    if (inserted === 0) {
      setStravaError("Todas essas atividades já foram importadas.")
      return
    }

    setStravaSaving(true)
    setStravaError(null)
    try {
      await Promise.all(pending.map((workout) => addWorkout(workout)))
      setStravaText("")
      setPainScore(null)
      setSegmentClock("")
      setStravaSavedCount(inserted)
      onSaved?.(inserted)
      window.setTimeout(() => setStravaSavedCount(0), 3500)
    } catch (e) {
      setStravaError(e instanceof Error ? e.message : "Erro ao salvar atividades do Strava")
    } finally {
      setStravaSaving(false)
    }
  }

  return (
    <Card className={cn("rise border-l-4 border-l-zone", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-bone">{title}</p>
          <p className="mt-0.5 text-xs text-steel-dim">{subtitle}</p>
        </div>
        <FileUp size={19} className="mt-0.5 shrink-0 text-zone" />
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase text-steel-dim">Arquivo CSV</span>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(event) => loadStravaFile(event.target.files?.[0])}
          className="w-full rounded border border-seam bg-coal px-2 py-2 text-xs text-steel file:mr-3 file:rounded file:border-0 file:bg-zone file:px-3 file:py-1.5 file:font-semibold file:text-coal"
        />
      </label>

      <label className="mt-3 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase text-steel-dim">
          Ou cole o CSV
        </span>
        <textarea
          value={stravaText}
          onChange={(event) => {
            setStravaText(event.target.value)
            setStravaError(null)
          }}
          rows={compact ? 4 : 7}
          placeholder={
            "Data;Hora;Tipo;Título;Distância (km);Tempo;Passos;Ganho de elevação (m);Local\n" +
            "07/11/2026;06:15;Corrida;Trote 1/2 x 8;4,59;43min 6s;5310;;Campina Grande, Paraíba"
          }
          className="w-full resize-y rounded border border-seam bg-coal px-2.5 py-2 font-mono text-xs text-bone outline-none focus:border-zone"
        />
      </label>

      {runningOptions && stravaParse && stravaParse.activities.length > 0 && (
        <div className="mt-3 space-y-2.5 rounded-lg border border-zone/25 bg-zone/5 p-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zone">
              Etapa do plano aplicada nesta importação
            </span>
            <select
              value={stageId}
              onChange={(event) => setStageId(event.target.value as RunStageId)}
              className="w-full rounded-md border border-seam bg-coal px-2.5 py-2 text-xs font-semibold text-bone outline-none focus:border-zone"
            >
              {RUN_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label} · {stage.weekLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-steel">
                Dor na sola/canela pós-treino (0–10)
              </span>
              {painScore !== null && (
                <button
                  type="button"
                  onClick={() => setPainScore(null)}
                  className="font-mono text-[10px] text-steel-dim hover:text-bone"
                >
                  limpar
                </button>
              )}
            </div>
            <div className="mt-1.5 grid grid-cols-6 gap-1 sm:grid-cols-11">
              {Array.from({ length: 11 }, (_, score) => {
                const selected = painScore === score
                const highPain = score > RUNNING_PAIN_THRESHOLD
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setPainScore(selected ? null : score)}
                    className={cn(
                      "rounded border py-1.5 font-mono text-xs font-semibold transition-colors",
                      selected
                        ? highPain
                          ? "border-gold bg-gold/20 text-gold"
                          : "border-zone bg-zone/20 text-zone"
                        : "border-seam bg-coal text-steel hover:text-bone"
                    )}
                    aria-pressed={selected}
                  >
                    {score}
                  </button>
                )
              })}
            </div>
            {painScore !== null && painScore > RUNNING_PAIN_THRESHOLD && (
              <p className="mt-1 text-[11px] text-gold">
                Dor &gt; 3/10 trava o avanço de degrau e recomenda repetir o estágio.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded border border-seam bg-coal px-2.5 py-2 text-xs text-bone">
              <input
                type="checkbox"
                checked={useCorreMax}
                onChange={(event) => setUseCorreMax(event.target.checked)}
                className="accent-zone"
              />
              <span className="truncate">{runningOptions.defaultShoe ?? RUNNING_SHOE_NAME}</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={segmentClock}
              onChange={(event) => setSegmentClock(event.target.value)}
              placeholder="Segmento 1,64 km (ex.: 16:28)"
              className="rounded border border-seam bg-coal px-2.5 py-2 font-mono text-xs text-bone outline-none placeholder:text-steel-dim focus:border-zone"
            />
          </div>
        </div>
      )}

      {stravaParse && (
        <div className="mt-3 space-y-2">
          {stravaParse.activities.map((activity) => {
            const block = toStravaCardioLog(activity)
            const previewWorkout: WorkoutLog = {
              id: activity.sourceId,
              date: activity.date,
              sessionId: "strava",
              durationMin: block.minutes,
              entries: [],
              cardio: block,
              cardios: [block],
            }
            const kcal = sessionKcal(previewWorkout, weightKgOn(body, activity.date))
            const overCeiling =
              runningOptions &&
              activity.date >= RUNNING_START_DATE &&
              isOverVolumeCeiling(stageId, block.minutes)

            return (
              <div
                key={activity.sourceId}
                className="rounded border border-seam bg-coal/70 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-bone">
                      {activity.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
                      {fromDateKey(activity.date).toLocaleDateString("pt-BR")}
                      {activity.startTime ? ` · ${activity.startTime}` : ""}
                      {activity.location ? ` · ${activity.location}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-zone/30 bg-zone/5 px-2 py-0.5 font-mono text-[10px] uppercase text-zone">
                    {activity.type === "walk" ? "caminhada" : "corrida"}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-steel">
                  {activity.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
                  {" · "}{formatActivityDuration(activity.durationSeconds)}
                  {activity.steps !== undefined
                    ? ` · ${activity.steps.toLocaleString("pt-BR")} passos`
                    : ""}
                  {activity.elevationGainM !== undefined
                    ? ` · +${Math.round(activity.elevationGainM)} m`
                    : ""}
                  {kcal ? (
                    <span className="text-gold">
                      {" · "}≈{kcal.mid.toLocaleString("pt-BR")} kcal
                      <span className="text-steel-dim"> ({kcal.low}–{kcal.high})</span>
                    </span>
                  ) : (
                    <span className="text-gold"> · registre seu peso para calcular kcal</span>
                  )}
                </p>
                {overCeiling && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gold">
                    <AlertTriangle size={12} className="shrink-0" />
                    Acima do teto recomendado para {stageId} — salve e priorize recuperação amanhã.
                  </p>
                )}
              </div>
            )
          })}

          {stravaParse.warnings.map((warning, index) => (
            <p key={index} className="text-xs text-gold">{warning}</p>
          ))}
          {stravaParse.errors.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
              {stravaParse.errors.map((message, index) => <p key={index}>{message}</p>)}
            </div>
          )}
        </div>
      )}

      {stravaError && (
        <p className="mt-2 text-xs text-amber-400">{stravaError}</p>
      )}

      <button
        onClick={saveStravaActivities}
        disabled={
          stravaSaving ||
          !stravaParse ||
          stravaParse.activities.length === 0 ||
          stravaParse.errors.length > 0
        }
        className={cn(
          "mt-3 flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-40",
          stravaSavedCount > 0
            ? "bg-zone text-coal"
            : "bg-ember text-coal hover:bg-ember-hot"
        )}
        style={{ fontFamily: "var(--font-condensed)" }}
      >
        {stravaSavedCount > 0 ? <Check size={15} /> : <FileUp size={15} />}
        {stravaSaving
          ? "Salvando…"
          : stravaSavedCount > 0
            ? `${stravaSavedCount} importada(s)`
            : "Salvar atividades"}
      </button>
    </Card>
  )
}
