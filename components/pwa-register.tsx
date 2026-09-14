"use client"

import { useEffect } from "react"

/**
 * Registra o service worker (somente em produção e onde houver suporte).
 *
 * Duas defesas contra "o app abriu com uma versão antiga", que no iOS é o modo
 * de falha mais comum: instalado na tela de início, o PWA fica suspenso por
 * dias e volta do snapshot sem nunca reconsultar o service worker.
 *
 *  - `update()` a cada volta para o primeiro plano força essa reconsulta;
 *  - `controllerchange` recarrega a página uma única vez quando um worker novo
 *    assume, para que a casca em tela case com o worker que está servindo.
 *
 * Sem o recarregamento, um worker novo passa a servir chunks novos para uma
 * página cujo JS é do build anterior — e o resultado aparece como interface
 * meio viva: nós duplicados, botões que não respondem ao toque.
 */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return

    let registration: ServiceWorkerRegistration | null = null
    // um worker novo assumindo só justifica UM recarregamento
    let reloading = false
    /**
     * Na PRIMEIRA instalação não há controlador anterior: o claim() do worker
     * dispara `controllerchange` sem que nada tenha ficado velho. Recarregar
     * ali seria um refresh gratuito na primeira visita de todo mundo.
     */
    const hadController = Boolean(navigator.serviceWorker.controller)

    const onControllerChange = () => {
      if (!hadController || reloading) return
      reloading = true
      window.location.reload()
    }

    const checkForUpdate = () => {
      if (document.visibilityState !== "visible") return
      registration?.update().catch(() => {})
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg
          document.addEventListener("visibilitychange", checkForUpdate)
        })
        .catch(() => {})
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => {
      window.removeEventListener("load", register)
      document.removeEventListener("visibilitychange", checkForUpdate)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])
  return null
}
