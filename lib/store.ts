"use client"

import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "./supabase/client"
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

/**
 * Dados no Supabase (tabelas `workouts` e `body_logs`, RLS por usuário).
 * Carrega no client após o login; gravações fazem upsert por dia/sessão.
 */
export function useGymData() {
  const [data, setData] = useState<GymData | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [])

  const addWorkout = useCallback(async (log: WorkoutLog) => {
    const supabase = getSupabaseBrowserClient()
    const { data: rows, error } = await supabase
      .from("workouts")
      .upsert(
        {
          date: log.date,
          session_id: log.sessionId,
          duration_min: log.durationMin ?? null,
          entries: log.entries,
          cardio: log.cardio ?? null,
          notes: log.notes ?? null,
        },
        { onConflict: "user_id,date,session_id" }
      )
      .select()
    if (error) throw new Error(error.message)
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
  }, [])

  const addBodyLog = useCallback(async (log: BodyLog) => {
    const supabase = getSupabaseBrowserClient()
    const { data: rows, error } = await supabase
      .from("body_logs")
      .upsert(
        {
          date: log.date,
          weight_kg: log.weightKg,
          waist_cm: log.waistCm ?? null,
        },
        { onConflict: "user_id,date" }
      )
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
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }, [])

  return { data, error, addWorkout, addBodyLog, signOut }
}
