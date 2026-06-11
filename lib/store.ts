"use client"

import { useCallback, useEffect, useState } from "react"
import { generateMockData } from "./mock-data"
import { BodyLog, GymData, WorkoutLog } from "./types"

const STORAGE_KEY = "gym-track:data:v1"

function loadData(): GymData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as GymData
  } catch {
    // dado corrompido → re-seed
  }
  const seed = generateMockData(new Date())
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  return seed
}

function persist(data: GymData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Estado global simples em localStorage. Carrega no client (evita mismatch
 * de hidratação) e semeia com 5 semanas de histórico mockado na primeira vez.
 */
export function useGymData() {
  const [data, setData] = useState<GymData | null>(null)

  useEffect(() => {
    setData(loadData())
  }, [])

  const addWorkout = useCallback((log: WorkoutLog) => {
    setData((prev) => {
      if (!prev) return prev
      // substitui registro do mesmo dia/sessão (re-salvar treino)
      const workouts = [
        ...prev.workouts.filter((w) => !(w.date === log.date && w.sessionId === log.sessionId)),
        log,
      ].sort((a, b) => a.date.localeCompare(b.date))
      const next = { ...prev, workouts }
      persist(next)
      return next
    })
  }, [])

  const addBodyLog = useCallback((log: BodyLog) => {
    setData((prev) => {
      if (!prev) return prev
      const body = [...prev.body.filter((b) => b.date !== log.date), log].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      const next = { ...prev, body }
      persist(next)
      return next
    })
  }, [])

  const resetData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setData(loadData())
  }, [])

  return { data, addWorkout, addBodyLog, resetData }
}
