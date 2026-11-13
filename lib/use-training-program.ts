"use client"

import { useCallback, useEffect, useState } from "react"
import { PERFORMANCE_START_DATE } from "./performance-plan"
import { RUNNING_START_DATE } from "./running-plan"
import { TrainingProgram } from "./types"
import { toDateKey } from "./utils"

const PROGRAMS: TrainingProgram[] = ["running", "performance", "engine", "hypertrophy"]

function isProgram(value: unknown): value is TrainingProgram {
  return typeof value === "string" && PROGRAMS.includes(value as TrainingProgram)
}

/**
 * v5: incorpora o plano de corrida 5 km como padrão a partir de 07/11/2026,
 * mantendo as versões anteriores isoladas por objetivo.
 */
const PROGRAM_KEY = "gym-track:training-program:v5"
const PROGRAM_EVENT = "gym-track:training-program-change"

/**
 * A preparação de corrida 5 km assume o padrão a partir de 07/11/2026; entre
 * 21/09 e 06/11 vale a pré-temporada de grappling e, antes disso, o ciclo de
 * motor — assim histórico antigo não muda de prescrição com um deploy.
 */
function defaultProgramFor(date: Date): TrainingProgram {
  const key = toDateKey(date)
  if (key >= RUNNING_START_DATE) return "running"
  return key >= PERFORMANCE_START_DATE ? "performance" : "engine"
}

export function getTrainingProgram(date = new Date()): TrainingProgram {
  try {
    const stored = localStorage.getItem(PROGRAM_KEY)
    if (isProgram(stored)) return stored
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
