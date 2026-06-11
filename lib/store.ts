"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "./supabase/client"
import { enqueue, flushQueue, queueCount } from "./sync-queue"
import { BodyLog, CardioLog, ExerciseLog, GymData, SessionId, WorkoutLog } from "./types"

interface WorkoutRow {
  id: string
  date: string
  session_id: string
  duration_min: number | null
  entries: ExerciseLog[]
  cardio: CardioLog | null
  notes: string | null
}

interface BodyRow {
  date: string
  weight_kg: number
  waist_cm: number | null
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
  }
}

function rowToBody(r: BodyRow): BodyLog {
  return {
    date: r.date,
    weightKg: Number(r.weight_kg),
    waistCm: r.waist_cm !== null ? Number(r.waist_cm) : undefined,
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
      const [w, b] = await Promise.all([
        supabase.from("workouts").select("*").order("date", { ascending: true }),
        supabase.from("body_logs").select("*").order("date", { ascending: true }),
      ])
      if (cancelled) return
      if (w.error || b.error) {
        setError(w.error?.message ?? b.error?.message ?? "Erro ao carregar dados")
        return
      }
      setData({
        workouts: ((w.data ?? []) as WorkoutRow[]).map(rowToWorkout),
        body: ((b.data ?? []) as BodyRow[]).map(rowToBody),
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
    // 1) atualização otimista na tela
    setData((prev) => {
      const base = prev ?? { workouts: [], body: [] }
      const workouts = [
        ...base.workouts.filter(
          (w) => !(w.date === log.date && w.sessionId === log.sessionId)
        ),
        log,
      ].sort((a, b) => a.date.localeCompare(b.date))
      return { ...base, workouts }
    })

    const payload = {
      date: log.date,
      session_id: log.sessionId,
      duration_min: log.durationMin ?? null,
      entries: log.entries,
      cardio: log.cardio ?? null,
      notes: log.notes ?? null,
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
          ...prev.workouts.filter(
            (w) => !(w.date === saved.date && w.sessionId === saved.sessionId)
          ),
          saved,
        ].sort((a, b) => a.date.localeCompare(b.date))
        return { ...prev, workouts }
      })
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt() // sem rede → fila, mantém otimista
        return
      }
      throw e
    }
  }, [])

  const addBodyLog = useCallback(async (log: BodyLog) => {
    setData((prev) => {
      const base = prev ?? { workouts: [], body: [] }
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

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }, [])

  const deleteWorkout = useCallback(async (id: string, date: string, sessionId: string) => {
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
      throw e
    }
  }, [])

  return { data, error, pendingCount, addWorkout, addBodyLog, deleteWorkout, signOut }
}
