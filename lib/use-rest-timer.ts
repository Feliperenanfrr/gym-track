"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface RestTimerApi {
  active: boolean
  running: boolean
  total: number
  remaining: number
  label: string
  start: (seconds: number, label: string) => void
  toggle: () => void
  addTime: (delta: number) => void
  dismiss: () => void
}

/** Vibração + bipe curto ao terminar o descanso (ambos com fallback silencioso) */
function notifyDone() {
  try {
    navigator.vibrate?.([120, 60, 120])
  } catch {
    /* ignore */
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
    osc.onended = () => ctx.close()
  } catch {
    /* ignore */
  }
}

/**
 * Timer de descanso baseado em timestamp (preciso mesmo se a aba for
 * suspensa pelo navegador). Um único timer por vez; iniciar de novo reinicia.
 */
export function useRestTimer(): RestTimerApi {
  const [active, setActive] = useState(false)
  const [running, setRunning] = useState(false)
  const [total, setTotal] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [label, setLabel] = useState("")

  const endsAtRef = useRef(0)
  const pausedRef = useRef(0)
  const firedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const tick = useCallback(() => {
    const secs = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
    setRemaining(secs)
    if (secs <= 0 && !firedRef.current) {
      firedRef.current = true
      setRunning(false)
      stopInterval()
      notifyDone()
      autoDismissRef.current = setTimeout(() => setActive(false), 6000)
    }
  }, [])

  const start = useCallback(
    (seconds: number, lbl: string) => {
      stopInterval()
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      firedRef.current = false
      setTotal(seconds)
      setRemaining(seconds)
      setLabel(lbl)
      endsAtRef.current = Date.now() + seconds * 1000
      setActive(true)
      setRunning(true)
      intervalRef.current = setInterval(tick, 250)
    },
    [tick]
  )

  const toggle = useCallback(() => {
    setRunning((isRunning) => {
      if (isRunning) {
        pausedRef.current = Math.max(
          0,
          Math.ceil((endsAtRef.current - Date.now()) / 1000)
        )
        stopInterval()
        return false
      }
      if (pausedRef.current <= 0) return false
      endsAtRef.current = Date.now() + pausedRef.current * 1000
      firedRef.current = false
      intervalRef.current = setInterval(tick, 250)
      return true
    })
  }, [tick])

  const addTime = useCallback(
    (delta: number) => {
      firedRef.current = false
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      if (running) {
        endsAtRef.current = Math.max(Date.now(), endsAtRef.current + delta * 1000)
        const secs = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
        setRemaining(secs)
        setTotal((t) => Math.max(t, secs))
      } else {
        // pausado ou concluído: estende e retoma
        pausedRef.current = Math.max(0, pausedRef.current + delta)
        if (pausedRef.current > 0) {
          endsAtRef.current = Date.now() + pausedRef.current * 1000
          setRemaining(pausedRef.current)
          setTotal((t) => Math.max(t, pausedRef.current))
          setRunning(true)
          stopInterval()
          intervalRef.current = setInterval(tick, 250)
        }
      }
    },
    [running, tick]
  )

  const dismiss = useCallback(() => {
    stopInterval()
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    setActive(false)
    setRunning(false)
  }, [])

  useEffect(() => {
    return () => {
      stopInterval()
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [])

  return { active, running, total, remaining, label, start, toggle, addTime, dismiss }
}
