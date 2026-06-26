"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSupabaseBrowserClient } from "./supabase/client"
import { enqueue, flushQueue, queueCount } from "./sync-queue"
import { toOperationalDateKey } from "./utils"
import {
  BodyLog,
  CardioLog,
  ExerciseLog,
  GymData,
  HydrationLog,
  SessionId,
  SleepLog,
  WorkoutLog,
} from "./types"

interface WorkoutRow {
  id: string
  date: string
  session_id: string
  duration_min: number | null
  entries: ExerciseLog[]
  cardio: CardioLog | null
  notes: string | null
  srpe?: number | null
  started_at?: string | null
}

interface BodyRow {
  date: string
  weight_kg: number
  waist_cm: number | null
}

interface HydrationRow {
  date: string
  ml: number
}

interface SleepRow {
  date: string
  slept_at: string
  woke_at: string
  duration_min: number
}

function rowToWorkout(r: WorkoutRow): WorkoutLog {
  return {
    id: r.id,
    date: r.date,
    sessionId: r.session_id as SessionId,
    durationMin: r.duration_min ?? undefined,
    entries: r.entries ?? [],
    cardio: r.cardio ?? undefined,
    notes: r.notes ?? undefined,
    srpe: r.srpe ?? undefined,
    startedAt: r.started_at ?? undefined,
  }
}

function sameWorkoutSlot(
  a: Pick<WorkoutLog, "date" | "sessionId">,
  b: Pick<WorkoutLog, "date" | "sessionId">
) {
  return a.date === b.date && a.sessionId === b.sessionId
}

function sortWorkouts(workouts: WorkoutLog[]) {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date))
}

function rowToBody(r: BodyRow): BodyLog {
  return {
    date: r.date,
    weightKg: Number(r.weight_kg),
    waistCm: r.waist_cm !== null ? Number(r.waist_cm) : undefined,
  }
}

function trimTime(value: string): string {
  return value.slice(0, 5)
}

function rowToSleep(r: SleepRow): SleepLog {
  return {
    date: r.date,
    sleptAt: trimTime(r.slept_at),
    wokeAt: trimTime(r.woke_at),
    durationMin: Number(r.duration_min),
  }
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

/** Erro de rede (fetch falhou) vs erro de API (Supabase retornou {error}) */
function isNetworkError(e: unknown) {
  return (
    e instanceof TypeError ||
    (e instanceof Error && /fetch|network|Failed to fetch/i.test(e.message))
  )
}

/**
 * Dados no Supabase (tabelas `workouts` e `body_logs`, RLS por usuário).
 * Gravações são otimistas: atualizam a tela na hora e, se a rede falhar,
 * entram na fila de sincronização e reenviam quando a conexão voltar.
 */
export function useGymData() {
  const [data, setData] = useState<GymData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const dataRef = useRef<GymData | null>(null)
  /** total de água por dia, espelho síncrono do estado (ver addWater) */
  const waterRef = useRef<Record<string, number>>({})

  useEffect(() => {
    dataRef.current = data
    if (!data) return
    const map: Record<string, number> = {}
    for (const h of data.hydration) map[h.date] = h.ml
    waterRef.current = map
  }, [data])

  const refreshPending = useCallback(() => {
    setPendingCount(queueCount())
  }, [])

  const flush = useCallback(async () => {
    if (isOffline()) return
    const supabase = getSupabaseBrowserClient()
    const remaining = await flushQueue(supabase)
    setPendingCount(remaining)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = getSupabaseBrowserClient()
      const [w, b, h, s] = await Promise.all([
        supabase.from("workouts").select("*").order("date", { ascending: true }),
        supabase.from("body_logs").select("*").order("date", { ascending: true }),
        supabase.from("hydration_logs").select("*").order("date", { ascending: true }),
        supabase.from("sleep_logs").select("*").order("date", { ascending: true }),
      ])
      if (cancelled) return
      if (w.error || b.error) {
        setError(w.error?.message ?? b.error?.message ?? "Erro ao carregar dados")
        return
      }
      // hidratação é não-fatal: app continua se a migration ainda não rodou
      if (h.error) console.warn("hydration_logs indisponível:", h.error.message)
      // sono também é não-fatal até a migration 0003 rodar no Supabase
      if (s.error) console.warn("sleep_logs indisponível:", s.error.message)
      setData({
        workouts: ((w.data ?? []) as WorkoutRow[]).map(rowToWorkout),
        body: ((b.data ?? []) as BodyRow[]).map(rowToBody),
        hydration: ((h.data ?? []) as HydrationRow[]).map((r) => ({
          date: r.date,
          ml: Number(r.ml),
        })),
        sleep: ((s.data ?? []) as SleepRow[]).map(rowToSleep),
      })
    }
    load()
    refreshPending()
    flush()

    const onOnline = () => flush()
    window.addEventListener("online", onOnline)
    return () => {
      cancelled = true
      window.removeEventListener("online", onOnline)
    }
  }, [flush, refreshPending])

  const addWorkout = useCallback(async (log: WorkoutLog) => {
    const previousWorkout =
      dataRef.current?.workouts.find((w) => sameWorkoutSlot(w, log)) ?? null

    // 1) atualização otimista na tela
    setData((prev) => {
      const base = prev ?? { workouts: [], body: [], hydration: [], sleep: [] }
      const workouts = [
        ...base.workouts.filter((w) => !sameWorkoutSlot(w, log)),
        log,
      ].sort((a, b) => a.date.localeCompare(b.date))
      return { ...base, workouts }
    })

    const payload: Record<string, unknown> = {
      date: log.date,
      session_id: log.sessionId,
      duration_min: log.durationMin ?? null,
      entries: log.entries,
      cardio: log.cardio ?? null,
      notes: log.notes ?? null,
      // colunas novas só entram quando preenchidas — salvar sem sRPE/início
      // continua funcionando mesmo antes da migration 0002 rodar
      ...(log.srpe !== undefined ? { srpe: log.srpe } : {}),
      ...(log.startedAt !== undefined ? { started_at: log.startedAt } : {}),
    }
    const enqueueIt = () => {
      enqueue({
        table: "workouts",
        onConflict: "user_id,date,session_id",
        logicalKey: `${log.date}:${log.sessionId}`,
        payload,
      })
      setPendingCount(queueCount())
    }

    if (isOffline()) {
      enqueueIt()
      return
    }
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: rows, error } = await supabase
        .from("workouts")
        .upsert(payload, { onConflict: "user_id,date,session_id" })
        .select()
      if (error) throw new Error(error.message) // erro real (RLS/auth) → propaga
      const saved = rowToWorkout(rows![0] as WorkoutRow)
      setData((prev) => {
        if (!prev) return prev
        const workouts = [
          ...prev.workouts.filter((w) => !sameWorkoutSlot(w, saved)),
          saved,
        ].sort((a, b) => a.date.localeCompare(b.date))
        return { ...prev, workouts }
      })
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt() // sem rede → fila, mantém otimista
        return
      }
      setData((prev) => {
        if (!prev) return prev
        const current = prev.workouts.find((w) => sameWorkoutSlot(w, log))
        if (!current || current.id !== log.id) return prev
        const withoutOptimistic = prev.workouts.filter((w) => !sameWorkoutSlot(w, log))
        return {
          ...prev,
          workouts: sortWorkouts(
            previousWorkout ? [...withoutOptimistic, previousWorkout] : withoutOptimistic
          ),
        }
      })
      throw e
    }
  }, [])

  const addBodyLog = useCallback(async (log: BodyLog) => {
    setData((prev) => {
      const base = prev ?? { workouts: [], body: [], hydration: [], sleep: [] }
      const body = [...base.body.filter((b) => b.date !== log.date), log].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      return { ...base, body }
    })

    const payload = {
      date: log.date,
      weight_kg: log.weightKg,
      waist_cm: log.waistCm ?? null,
    }
    const enqueueIt = () => {
      enqueue({
        table: "body_logs",
        onConflict: "user_id,date",
        logicalKey: log.date,
        payload,
      })
      setPendingCount(queueCount())
    }

    if (isOffline()) {
      enqueueIt()
      return
    }
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: rows, error } = await supabase
        .from("body_logs")
        .upsert(payload, { onConflict: "user_id,date" })
        .select()
      if (error) throw new Error(error.message)
      const saved = rowToBody(rows![0] as BodyRow)
      setData((prev) => {
        if (!prev) return prev
        const body = [...prev.body.filter((b) => b.date !== saved.date), saved].sort(
          (a, b) => a.date.localeCompare(b.date)
        )
        return { ...prev, body }
      })
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt()
        return
      }
      throw e
    }
  }, [])

  /**
   * Soma (ou subtrai, p/ desfazer) ml ao total de água do dia.
   * Upsert do TOTAL acumulado — idempotente na fila offline: vários taps
   * do mesmo dia colapsam na última gravação com o total certo.
   * O total corrente vive num ref (waterRef) para que taps em sequência
   * rápida não leiam estado React ainda não re-renderizado.
   */
  const addWater = useCallback(async (deltaMl: number, date?: string) => {
    const day = date ?? toOperationalDateKey(new Date())
    const current = waterRef.current[day] ?? 0
    const total = Math.max(0, current + deltaMl)
    waterRef.current[day] = total
    setData((prev) => {
      const base = prev ?? { workouts: [], body: [], hydration: [], sleep: [] }
      const hydration = [
        ...base.hydration.filter((x) => x.date !== day),
        { date: day, ml: total },
      ].sort((a, b) => a.date.localeCompare(b.date))
      return { ...base, hydration }
    })

    const payload = { date: day, ml: total }
    const enqueueIt = () => {
      enqueue({
        table: "hydration_logs",
        onConflict: "user_id,date",
        logicalKey: day,
        payload,
      })
      setPendingCount(queueCount())
    }

    if (isOffline()) {
      enqueueIt()
      return
    }
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from("hydration_logs")
        .upsert(payload, { onConflict: "user_id,date" })
      if (error) throw new Error(error.message)
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt()
        return
      }
      throw e
    }
  }, [])

  const addSleepLog = useCallback(async (log: SleepLog) => {
    setData((prev) => {
      const base = prev ?? { workouts: [], body: [], hydration: [], sleep: [] }
      const sleep = [...base.sleep.filter((s) => s.date !== log.date), log].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      return { ...base, sleep }
    })

    const payload = {
      date: log.date,
      slept_at: log.sleptAt,
      woke_at: log.wokeAt,
      duration_min: log.durationMin,
    }
    const enqueueIt = () => {
      enqueue({
        table: "sleep_logs",
        onConflict: "user_id,date",
        logicalKey: log.date,
        payload,
      })
      setPendingCount(queueCount())
    }

    if (isOffline()) {
      enqueueIt()
      return
    }
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: rows, error } = await supabase
        .from("sleep_logs")
        .upsert(payload, { onConflict: "user_id,date" })
        .select()
      if (error) throw new Error(error.message)
      const saved = rowToSleep(rows![0] as SleepRow)
      setData((prev) => {
        if (!prev) return prev
        const sleep = [...prev.sleep.filter((s) => s.date !== saved.date), saved].sort(
          (a, b) => a.date.localeCompare(b.date)
        )
        return { ...prev, sleep }
      })
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt()
        return
      }
      throw e
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }, [])

  const deleteWorkout = useCallback(async (id: string, date: string, sessionId: string) => {
    const previousWorkout = dataRef.current?.workouts.find((w) => w.id === id) ?? null

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        workouts: prev.workouts.filter((w) => w.id !== id),
      }
    })

    const enqueueIt = () => {
      enqueue({
        action: "delete",
        table: "workouts",
        onConflict: "user_id,date,session_id",
        logicalKey: `delete-${id}`,
        payload: { id },
      })
      setPendingCount(queueCount())
    }

    if (isOffline()) {
      enqueueIt()
      return
    }
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from("workouts").delete().eq("id", id)
      if (error) throw new Error(error.message)
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt()
        return
      }
      if (previousWorkout) {
        setData((prev) => {
          if (!prev || prev.workouts.some((w) => w.id === id)) return prev
          return { ...prev, workouts: sortWorkouts([...prev.workouts, previousWorkout]) }
        })
      }
      throw e
    }
  }, [])

  return {
    data,
    error,
    pendingCount,
    addWorkout,
    addBodyLog,
    addWater,
    addSleepLog,
    deleteWorkout,
    signOut,
  }
}
