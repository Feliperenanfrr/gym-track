"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { alertFeedback, countdownFeedback, goFeedback } from "./haptics"

/**
 * Segundos entre o toque e o início da contagem: tempo de largar o celular
 * no chão e entrar em prancha. Sem isso, os 60 s começavam com você de pé.
 */
export const HOLD_PREP_SECONDS = 3

export interface HoldTarget {
  /** identifica a série dona do cronômetro ("exercicio-indice") */
  key: string
  label: string
  /** alvo em segundos — ao chegar nele a série fecha sozinha */
  seconds: number
}

export interface HoldTimerApi {
  active: HoldTarget | null
  phase: "prep" | "hold" | null
  /** segundos restantes da fase atual (contagem de preparo ou do alvo) */
  remaining: number
  /** segundos já sustentados (0 durante o preparo) */
  held: number
  start: (target: HoldTarget, onDone: (heldSeconds: number) => void) => void
  /** encerra antes do alvo e registra o que foi sustentado */
  stop: () => void
  /** descarta sem registrar nada */
  cancel: () => void
}

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

/**
 * Cronômetro de isometria (prancha, suspensão, pescoço): conta 3-2-1, conta
 * o alvo e fecha a série sozinho, com bipe e vibração. Com o corpo no chão,
 * nenhum toque é necessário depois do primeiro. Parar antes registra os
 * segundos sustentados de verdade.
 *
 * Baseado em timestamp, como o descanso: a aba suspensa não atrasa a conta.
 * Pede wake lock para a tela não apagar no meio da prancha (iPhone apaga em
 * 30 s por padrão).
 */
export function useHoldTimer(): HoldTimerApi {
  const [active, setActive] = useState<HoldTarget | null>(null)
  const [phase, setPhase] = useState<"prep" | "hold" | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [held, setHeld] = useState(0)

  const holdStartsAtRef = useRef(0)
  const holdEndsAtRef = useRef(0)
  const lastPrepSecondRef = useRef<number | null>(null)
  const startedHoldRef = useRef(false)
  const onDoneRef = useRef<((heldSeconds: number) => void) | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const activeRef = useRef<HoldTarget | null>(null)

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> }
      }
      wakeLockRef.current = (await nav.wakeLock?.request("screen")) ?? null
    } catch {
      /* sem suporte ou negado: o timestamp segue certo, só a tela pode apagar */
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    lock?.release().catch(() => {})
  }, [])

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    releaseWakeLock()
    onDoneRef.current = null
    activeRef.current = null
    lastPrepSecondRef.current = null
    startedHoldRef.current = false
    setActive(null)
    setPhase(null)
    setRemaining(0)
    setHeld(0)
  }, [releaseWakeLock])

  const finish = useCallback(
    (heldSeconds: number) => {
      const onDone = onDoneRef.current
      reset()
      alertFeedback()
      onDone?.(heldSeconds)
    },
    [reset]
  )

  const tick = useCallback(() => {
    const now = Date.now()
    if (now < holdStartsAtRef.current) {
      const secs = Math.ceil((holdStartsAtRef.current - now) / 1000)
      if (lastPrepSecondRef.current !== secs) {
        lastPrepSecondRef.current = secs
        countdownFeedback()
      }
      setPhase("prep")
      setRemaining(secs)
      return
    }
    if (!startedHoldRef.current) {
      startedHoldRef.current = true
      goFeedback()
    }
    const target = activeRef.current?.seconds ?? 0
    if (now >= holdEndsAtRef.current) {
      finish(target)
      return
    }
    setPhase("hold")
    setHeld(Math.floor((now - holdStartsAtRef.current) / 1000))
    setRemaining(Math.ceil((holdEndsAtRef.current - now) / 1000))
  }, [finish])

  const start = useCallback(
    (target: HoldTarget, onDone: (heldSeconds: number) => void) => {
      reset()
      const now = Date.now()
      holdStartsAtRef.current = now + HOLD_PREP_SECONDS * 1000
      holdEndsAtRef.current = holdStartsAtRef.current + target.seconds * 1000
      onDoneRef.current = onDone
      activeRef.current = target
      setActive(target)
      setPhase("prep")
      setRemaining(HOLD_PREP_SECONDS)
      void requestWakeLock()
      tick()
      intervalRef.current = setInterval(tick, 200)
    },
    [requestWakeLock, reset, tick]
  )

  const stop = useCallback(() => {
    if (!activeRef.current) return
    const heldSeconds = Math.floor((Date.now() - holdStartsAtRef.current) / 1000)
    // parar no preparo é desistir, não uma série de 0 s
    if (heldSeconds <= 0) {
      reset()
      return
    }
    finish(Math.min(heldSeconds, activeRef.current.seconds))
  }, [finish, reset])

  // a aba volta do segundo plano: recupera a tela acesa e a conta atrasada
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !activeRef.current) return
      void requestWakeLock()
      tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [requestWakeLock, tick])

  useEffect(() => reset, [reset])

  return { active, phase, remaining, held, start, stop, cancel: reset }
}
