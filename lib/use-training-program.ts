"use client"

import { useCallback, useEffect, useState } from "react"
import { BJJ_START_DATE } from "./bjj-plan"
import { TrainingProgram } from "./types"
import { toDateKey } from "./utils"

/**
 * v2: a chave antiga guardava a escolha feita durante o protocolo do flag
 * football. Versionar faz o padrão do bloco novo valer uma vez, sem carregar
 * uma preferência que era de outro objetivo.
 */
const PROGRAM_KEY = "gym-track:training-program:v2"
const PROGRAM_EVENT = "gym-track:training-program-change"

/** O bloco de jiu-jitsu é aberto: uma vez começado, é o objetivo padrão. */
function defaultProgramFor(date: Date): TrainingProgram {
  return toDateKey(date) >= BJJ_START_DATE ? "bjj" : "hypertrophy"
}

export function getTrainingProgram(date = new Date()): TrainingProgram {
  try {
    const stored = localStorage.getItem(PROGRAM_KEY)
    if (stored === "hypertrophy" || stored === "bjj") return stored
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
