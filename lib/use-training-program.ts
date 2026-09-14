"use client"

import { useCallback, useEffect, useState } from "react"
import { PERFORMANCE_START_DATE } from "./performance-plan"
import { TrainingProgram } from "./types"
import { toDateKey } from "./utils"

const PROGRAMS: TrainingProgram[] = ["performance", "engine", "hypertrophy"]

function isProgram(value: unknown): value is TrainingProgram {
  return typeof value === "string" && PROGRAMS.includes(value as TrainingProgram)
}

/**
 * v4: as chaves anteriores guardavam a escolha feita durante o flag football,
 * a preparação para jiu-jitsu e o ciclo de motor. Versionar faz o padrão do
 * ciclo novo valer uma vez, sem carregar uma preferência que era de outro
 * objetivo.
 */
const PROGRAM_KEY = "gym-track:training-program:v4"
const PROGRAM_EVENT = "gym-track:training-program-change"

/**
 * A pré-temporada de grappling é o objetivo padrão a partir de 21/09/2026: é
 * ela que abre o app enquanto o usuário não escolher outro programa. Antes
 * dessa data o padrão continua sendo o ciclo de motor, que era o objetivo
 * vigente — histórico aberto no app não pode mudar de prescrição por causa de
 * um deploy.
 */
function defaultProgramFor(date: Date): TrainingProgram {
  return toDateKey(date) >= PERFORMANCE_START_DATE ? "performance" : "engine"
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
