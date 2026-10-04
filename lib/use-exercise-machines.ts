"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { normalizeMachine } from "./machines"
import { isNetworkError, isOffline } from "./store"
import { getSupabaseBrowserClient } from "./supabase/client"
import { runWithFreshSession } from "./supabase/session"
import { enqueue, pendingPayloads } from "./sync-queue"
import { ExerciseMachine } from "./types"

/**
 * Máquinas cadastradas (tabela `exercise_machines`, migration 0013).
 *
 * Na academia o sinal falha justo quando você cadastra a máquina nova: a
 * gravação é otimista e, sem rede, entra na MESMA fila dos treinos (que o
 * `useGymData` reenvia quando a conexão volta). O id nasce no aparelho, então
 * o treino salvo offline já aponta para a máquina certa.
 *
 * Cache em localStorage por usuário para o seletor abrir preenchido offline.
 */

const CACHE_KEY = "gym-track:exercise-machines:v1"
const TABLE = "exercise_machines"
const ON_CONFLICT = "user_id,id"

function toRow(machine: ExerciseMachine): Record<string, unknown> {
  return {
    id: machine.id,
    exercise_id: machine.exerciseId,
    name: machine.name,
    load_unit: machine.loadUnit,
    load_step: machine.loadStep ?? null,
    archived: machine.archived ?? false,
  }
}

function normalizeAll(values: unknown[]): ExerciseMachine[] {
  return values.map(normalizeMachine).filter((m): m is ExerciseMachine => m !== null)
}

function readCache(key: string): ExerciseMachine[] | null {
  if (typeof window === "undefined") return null
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null")
    return Array.isArray(parsed) ? normalizeAll(parsed) : null
  } catch {
    return null
  }
}

function writeCache(key: string, machines: ExerciseMachine[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(machines))
  } catch {
    // cache é complementar; o Supabase continua sendo a fonte de verdade
  }
}

/** Upsert por id, mantendo a ordem de chegada. */
function upsertById(list: ExerciseMachine[], machine: ExerciseMachine): ExerciseMachine[] {
  const index = list.findIndex((m) => m.id === machine.id)
  if (index < 0) return [...list, machine]
  const next = [...list]
  next[index] = machine
  return next
}

export function useExerciseMachines() {
  const [machines, setMachines] = useState<ExerciseMachine[] | null>(null)
  const machinesRef = useRef<ExerciseMachine[] | null>(null)
  const cacheKeyRef = useRef(CACHE_KEY)

  useEffect(() => {
    machinesRef.current = machines
  }, [machines])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = getSupabaseBrowserClient()
      const { data: authData } = await supabase.auth.getSession()
      cacheKeyRef.current = authData.session?.user.id
        ? `${CACHE_KEY}:${authData.session.user.id}`
        : CACHE_KEY

      const { data, error } = await supabase
        .from(TABLE)
        .select("id,exercise_id,name,load_unit,load_step,archived")

      if (cancelled) return
      if (error) {
        // offline ou migration ainda não rodou: abre com o cache, não quebra
        console.warn("exercise_machines indisponível:", error.message)
        setMachines(readCache(cacheKeyRef.current) ?? [])
        return
      }
      // o que foi criado offline e ainda está na fila continua na tela
      let resolved = normalizeAll(data ?? [])
      for (const pending of normalizeAll(pendingPayloads(TABLE))) {
        resolved = upsertById(resolved, pending)
      }
      setMachines(resolved)
      writeCache(cacheKeyRef.current, resolved)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  /** Cria ou atualiza (renomear, trocar unidade/passo, arquivar). */
  const saveMachine = useCallback(async (machine: ExerciseMachine) => {
    const previous = machinesRef.current
    setMachines((current) => {
      const next = upsertById(current ?? [], machine)
      writeCache(cacheKeyRef.current, next)
      return next
    })

    const payload = toRow(machine)
    const enqueueIt = () =>
      enqueue({ table: TABLE, onConflict: ON_CONFLICT, logicalKey: machine.id, payload })

    if (isOffline()) {
      enqueueIt()
      return
    }
    try {
      const supabase = getSupabaseBrowserClient()
      await runWithFreshSession(supabase, async () => {
        const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: ON_CONFLICT })
        if (error) throw new Error(error.message)
      })
    } catch (e) {
      if (isNetworkError(e)) {
        enqueueIt() // sem rede → fila, mantém otimista
        return
      }
      if (previous) {
        setMachines(previous)
        writeCache(cacheKeyRef.current, previous)
      }
      throw e
    }
  }, [])

  return { machines, saveMachine }
}
