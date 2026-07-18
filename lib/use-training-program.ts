"use client"

import { useCallback, useEffect, useState } from "react"
import {
  COMPETITION_GAME_DATE,
  COMPETITION_START_DATE,
} from "./competition-plan"
import { TrainingProgram } from "./types"
import { toDateKey } from "./utils"

const PROGRAM_KEY = "gym-track:training-program"
const PROGRAM_EVENT = "gym-track:training-program-change"

function defaultProgramFor(date: Date): TrainingProgram {
  const key = toDateKey(date)
  return key >= COMPETITION_START_DATE && key <= COMPETITION_GAME_DATE
    ? "competition"
    : "hypertrophy"
}

export function getTrainingProgram(date = new Date()): TrainingProgram {
  try {
    const stored = localStorage.getItem(PROGRAM_KEY)
    if (stored === "hypertrophy") return "hypertrophy"
    if (stored === "competition") {
      if (toDateKey(date) <= COMPETITION_GAME_DATE) return "competition"
      localStorage.removeItem(PROGRAM_KEY)
      return "hypertrophy"
    }
  } catch {
    // O padrão por data também funciona quando o storage não está disponível.
  }
  return defaultProgramFor(date)
}

export function setTrainingProgram(program: TrainingProgram) {
  try {
    localStorage.setItem(PROGRAM_KEY, program)
    window.dispatchEvent(new CustomEvent(PROGRAM_EVENT, { detail: program }))
  } catch {
    // A seleção ainda funciona durante a visita, mesmo sem persistência.
  }
}

export function useTrainingProgram() {
  const [program, setProgramState] = useState<TrainingProgram | null>(null)

  useEffect(() => {
    setProgramState(getTrainingProgram())

    const syncFromStorage = () => setProgramState(getTrainingProgram())
    const syncFromApp = (event: Event) => {
      const selected = (event as CustomEvent<TrainingProgram>).detail
      setProgramState(selected ?? getTrainingProgram())
    }
    window.addEventListener("storage", syncFromStorage)
    window.addEventListener(PROGRAM_EVENT, syncFromApp)
    return () => {
      window.removeEventListener("storage", syncFromStorage)
      window.removeEventListener(PROGRAM_EVENT, syncFromApp)
    }
  }, [])

  const selectProgram = useCallback((selected: TrainingProgram) => {
    setTrainingProgram(selected)
    setProgramState(selected)
  }, [])

  return { program, selectProgram }
}

