"use client"

import { useEffect } from "react"

/** Registra o service worker (somente em produção e onde houver suporte). */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
    return () => window.removeEventListener("load", register)
  }, [])
  return null
}
