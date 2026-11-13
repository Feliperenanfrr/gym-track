"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, FileUp, X } from "lucide-react"
import { GpxTelemetryCard } from "@/components/gpx-telemetry-card"
import { Card } from "@/components/ui"
import { cardioBlocks } from "@/lib/cardio"
import { ParsedGpxActivity, gpxToCardioLog, isGpxContent, parseGpxXml } from "@/lib/gpx"
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

function parseClockToMinutes(clock: string | undefined): number | undefined {
  if (!clock) return undefined
  const match = clock.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return undefined
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

function shouldMergeBlock(existing: CardioLog, incoming: CardioLog): boolean {
  if (existing.sourceId && incoming.sourceId && existing.sourceId === incoming.sourceId) {
    return true
  }
  const oneIsGpxEnrichment = Boolean(incoming.gpx && !existing.gpx) || Boolean(existing.gpx && !incoming.gpx)
  if (!oneIsGpxEnrichment) return false
  if (existing.distanceKm !== undefined && incoming.distanceKm !== undefined) {
    if (Math.abs(existing.distanceKm - incoming.distanceKm) <= 0.45) return true
  }
  const mA = parseClockToMinutes(existing.startTime)
  const mB = parseClockToMinutes(incoming.startTime)
  return mA !== undefined && mB !== undefined && Math.abs(mA - mB) <= 30
}

function mergeStravaBlocks(previous: CardioLog[], incoming: CardioLog[]): {
  blocks: CardioLog[]
  changedCount: number
} {
  const next = [...previous]
  let changedCount = 0

  for (const item of incoming) {
    const matchIndex = next.findIndex((existing) => shouldMergeBlock(existing, item))
    if (matchIndex === -1) {
      next.push(item)
      changedCount += 1
      continue
    }

    const current = next[matchIndex]
    const merged: CardioLog = {
      ...current,
      ...item,
      startTime: item.startTime ?? current.startTime,
      steps: item.steps ?? current.steps,
      avgBpm: item.avgBpm ?? current.avgBpm,
      location: item.location ?? current.location,
      gpx: item.gpx ?? current.gpx,
      sourceId: current.gpx ? current.sourceId : item.sourceId ?? current.sourceId,
      runStageId: current.runStageId ?? item.runStageId,
      painScore: item.painScore ?? current.painScore,
      shoe: current.shoe ?? item.shoe,
      segmentTimeSec: item.segmentTimeSec ?? current.segmentTimeSec,
    }

    const gainedGpx = !current.gpx && Boolean(merged.gpx)
    const gainedPain = merged.painScore !== undefined && merged.painScore !== current.painScore
    const gainedStage = merged.runStageId !== undefined && merged.runStageId !== current.runStageId
    const gainedShoe = merged.shoe !== undefined && merged.shoe !== current.shoe
    const gainedSegment =
      merged.segmentTimeSec !== undefined && merged.segmentTimeSec !== current.segmentTimeSec

    if (gainedGpx || gainedPain || gainedStage || gainedShoe || gainedSegment) {
      next[matchIndex] = merged
      changedCount += 1
    }
  }

  next.sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"))
  return { blocks: next, changedCount }
}

export function StravaImporter({
  workouts,
  body,
  addWorkout,
  runningOptions,
  compact = false,
  title = "Importar atividades do Strava",
  subtitle = "Envie arquivos .GPX / .CSV ou cole o conteúdo direto aqui.",
  className,
  onSaved,
}: StravaImporterProps) {
  const [stravaText, setStravaText] = useState("")
  const [uploadedGpx, setUploadedGpx] = useState<ParsedGpxActivity[]>([])
  const [gpxDateOverrides, setGpxDateOverrides] = useState<Record<string, string>>({})
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

  const textParse = useMemo(() => {
    const trimmed = stravaText.trim()
    if (!trimmed) {
      return { csv: null, pastedGpx: null as ParsedGpxActivity | null, gpxError: null as string | null }
    }
    if (isGpxContent(trimmed)) {
      try {
        return { csv: null, pastedGpx: parseGpxXml(trimmed), gpxError: null }
      } catch (e) {
        return {
          csv: null,
          pastedGpx: null,
          gpxError: e instanceof Error ? e.message : "GPX inválido.",
        }
      }
    }
    return { csv: parseStravaCsv(trimmed), pastedGpx: null, gpxError: null }
  }, [stravaText])

  const gpxItems = useMemo(() => {
    const byId = new Map<string, ParsedGpxActivity>()
    for (const item of uploadedGpx) byId.set(item.sourceId, item)
    if (textParse.pastedGpx) byId.set(textParse.pastedGpx.sourceId, textParse.pastedGpx)
    return [...byId.values()].sort((a, b) =>
      `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`)
    )
  }, [uploadedGpx, textParse.pastedGpx])

  const stravaParse = textParse.csv
  const hasAnyParsed =
    (stravaParse?.activities.length ?? 0) > 0 || gpxItems.length > 0
  const hasParseErrors =
    Boolean(textParse.gpxError) || (stravaParse?.errors.length ?? 0) > 0

  const loadStravaFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setStravaError(null)
    const files = Array.from(fileList)
    const parsedGpx: ParsedGpxActivity[] = []
    const gpxErrors: string[] = []
    let latestCsv: string | null = null

    for (const file of files) {
      try {
        const text = await file.text()
        if (file.name.toLowerCase().endsWith(".gpx") || isGpxContent(text)) {
          parsedGpx.push(parseGpxXml(text))
        } else {
          latestCsv = text
        }
      } catch (e) {
        gpxErrors.push(`${file.name}: ${e instanceof Error ? e.message : "erro ao ler"}`)
      }
    }

    if (parsedGpx.length > 0) {
      setUploadedGpx((prev) => {
        const map = new Map(prev.map((item) => [item.sourceId, item]))
        for (const item of parsedGpx) map.set(item.sourceId, item)
        return [...map.values()]
      })
    }
    if (latestCsv !== null) {
      setStravaText(latestCsv)
    }
    if (gpxErrors.length > 0) {
      setStravaError(gpxErrors.join(" · "))
    }
  }

  const removeUploadedGpx = (sourceId: string) => {
    setUploadedGpx((prev) => prev.filter((item) => item.sourceId !== sourceId))
    if (textParse.pastedGpx?.sourceId === sourceId) {
      setStravaText("")
    }
  }

  const saveStravaActivities = async () => {
    if (!hasAnyParsed || hasParseErrors) {
      setStravaError("Revise os arquivos/campos antes de salvar.")
      return
    }

    const segmentTimeSec = parseClockToSeconds(segmentClock)
    if (segmentClock.trim() && segmentTimeSec === undefined) {
      setStravaError("Tempo do segmento inválido. Use mm:ss (ex.: 16:28).")
      return
    }

    const applyRunningMetadata = (baseBlock: CardioLog, targetDate: string): CardioLog => {
      if (!runningOptions || targetDate < RUNNING_START_DATE) return baseBlock
      return {
        ...baseBlock,
        runStageId: stageId,
        ...(painScore !== null ? { painScore } : {}),
        ...(useCorreMax
          ? { shoe: runningOptions.defaultShoe ?? RUNNING_SHOE_NAME }
          : {}),
        ...(segmentTimeSec !== undefined ? { segmentTimeSec } : {}),
      }
    }

    const incomingByDate = new Map<string, CardioLog[]>()
    for (const activity of stravaParse?.activities ?? []) {
      const blocks = incomingByDate.get(activity.date) ?? []
      blocks.push(applyRunningMetadata(toStravaCardioLog(activity), activity.date))
      incomingByDate.set(activity.date, blocks)
    }
    for (const gpx of gpxItems) {
      const targetDate = gpxDateOverrides[gpx.sourceId] || gpx.date
      const blocks = incomingByDate.get(targetDate) ?? []
      blocks.push(applyRunningMetadata(gpxToCardioLog(gpx), targetDate))
      incomingByDate.set(targetDate, blocks)
    }

    const pending: WorkoutLog[] = []
    let inserted = 0
    for (const [date, incoming] of incomingByDate) {
      const existing = workouts.find(
        (workout) => workout.date === date && workout.sessionId === "strava"
      )
      const previousBlocks = existing ? cardioBlocks(existing) : []
      const { blocks, changedCount } = mergeStravaBlocks(previousBlocks, incoming)
      if (changedCount === 0) continue

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
          id: `strava-${date}-${Date.now()}-${pending.length}`,
          date,
          sessionId: "strava" as const,
          entries: [],
        }),
        durationMin,
        cardio: blocks[0],
        cardios: blocks,
      })
      inserted += changedCount
    }

    if (inserted === 0) {
      setStravaError("Todas essas atividades/GPX já foram importadas.")
      return
    }

    setStravaSaving(true)
    setStravaError(null)
    try {
      await Promise.all(pending.map((workout) => addWorkout(workout)))
      setStravaText("")
      setUploadedGpx([])
      setGpxDateOverrides({})
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
        <span className="font-mono text-[10px] uppercase text-steel-dim">
          Arquivos (.GPX ou .CSV — pode selecionar vários)
        </span>
        <input
          type="file"
          multiple
          accept=".gpx,.csv,.xml,application/gpx+xml,text/csv,text/plain"
          onChange={(event) => {
            void loadStravaFiles(event.target.files)
            event.target.value = ""
          }}
          className="w-full rounded border border-seam bg-coal px-2 py-2 text-xs text-steel file:mr-3 file:rounded file:border-0 file:bg-zone file:px-3 file:py-1.5 file:font-semibold file:text-coal"
        />
      </label>

      <label className="mt-3 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase text-steel-dim">
          Ou cole o CSV / XML do GPX
        </span>
        <textarea
          value={stravaText}
          onChange={(event) => {
            setStravaText(event.target.value)
            setStravaError(null)
          }}
          rows={compact ? 3 : 6}
          placeholder={
            "Data;Hora;Tipo;Título;Distância (km);Tempo;Passos;Ganho de elevação (m);Local\n" +
            "07/11/2026;06:15;Corrida;Trote 1/2 x 8;4,59;43min 6s;5310;;Campina Grande, Paraíba"
          }
          className="w-full resize-y rounded border border-seam bg-coal px-2.5 py-2 font-mono text-xs text-bone outline-none focus:border-zone"
        />
      </label>

      {runningOptions && hasAnyParsed && (
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

      {gpxItems.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {gpxItems.map((gpx) => {
            const effectiveDate = gpxDateOverrides[gpx.sourceId] || gpx.date
            const existingOnDate = workouts.find(
              (workout) => workout.date === effectiveDate && workout.sessionId === "strava"
            )
            const block = gpxToCardioLog(gpx)
            const previewWorkout: WorkoutLog = {
              id: gpx.sourceId,
              date: effectiveDate,
              sessionId: "strava",
              durationMin: block.minutes,
              entries: [],
              cardio: block,
              cardios: [block],
            }
            const kcal = sessionKcal(previewWorkout, weightKgOn(body, effectiveDate))
            const overCeiling =
              runningOptions &&
              effectiveDate >= RUNNING_START_DATE &&
              isOverVolumeCeiling(stageId, block.minutes)

            return (
              <div
                key={gpx.sourceId}
                className="rounded border border-zone/35 bg-coal/80 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-bone">
                      {gpx.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
                      {fromDateKey(effectiveDate).toLocaleDateString("pt-BR")}
                      {gpx.startTime ? ` · ${gpx.startTime}` : ""}
                      {" · "}GPX Strava
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border border-zone/30 bg-zone/10 px-2 py-0.5 font-mono text-[10px] uppercase text-zone">
                      {gpx.type === "walk" ? "caminhada" : "corrida"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUploadedGpx(gpx.sourceId)}
                      className="rounded p-1 text-steel-dim hover:bg-iron-2 hover:text-bone"
                      aria-label="Remover GPX da fila"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-steel">
                  <span className="font-mono">
                    {gpx.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
                    {" · "}{formatActivityDuration(gpx.durationSeconds)}
                    {gpx.elevationGainM > 0 ? ` · +${gpx.elevationGainM} m` : ""}
                    {kcal && (
                      <span className="text-gold"> · ≈{kcal.mid.toLocaleString("pt-BR")} kcal</span>
                    )}
                  </span>
                  <label className="flex items-center gap-1.5 font-mono text-[10px] text-steel-dim">
                    Data:
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(event) =>
                        setGpxDateOverrides((prev) => ({
                          ...prev,
                          [gpx.sourceId]: event.target.value,
                        }))
                      }
                      className="rounded border border-seam bg-coal px-1.5 py-0.5 font-mono text-[10px] text-bone outline-none focus:border-zone"
                    />
                  </label>
                </div>

                {existingOnDate && (
                  <p className="mt-1.5 font-mono text-[10px] text-zone">
                    Vai mesclar no registro Strava de {fromDateKey(effectiveDate).toLocaleDateString("pt-BR")} (preserva passos/FC).
                  </p>
                )}

                <GpxTelemetryCard gpx={gpx.telemetry} compact className="mt-2.5" />

                {overCeiling && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gold">
                    <AlertTriangle size={12} className="shrink-0" />
                    Acima do teto recomendado para {stageId} — salve e priorize recuperação amanhã.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {textParse.gpxError && (
        <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          {textParse.gpxError}
        </p>
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
        disabled={stravaSaving || !hasAnyParsed || hasParseErrors}
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
