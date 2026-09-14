// Service worker do GYM//TRACK — cache do app shell + assets estáticos.
// Versão no nome do cache: ao mudar, o activate limpa os antigos.
const VERSION = "gym-track-v2"
/**
 * Dois caches, com tempos de vida diferentes.
 *
 * STATIC guarda o que tem hash no nome (`/_next/static`, ícones, fontes): a URL
 * muda a cada build, então guardar para sempre é seguro e é o que deixa o app
 * abrir instantâneo.
 *
 * SHELL guarda HTML de navegação, que NÃO tem hash — `/treino` de hoje e de um
 * build de duas semanas atrás moram na mesma chave. Por isso ele é esvaziado a
 * cada activate: um worker novo nunca herda a casca do worker anterior.
 */
const STATIC = `${VERSION}-static`
const SHELL = `${VERSION}-shell`

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      await cache.addAll(["/offline"]).catch(() => {})
      self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok) cache.put(request, res.clone())
  return res
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const hit = await cache.match(request)
    if (hit) return hit
    const offline = await cache.match("/offline")
    if (offline) return offline
    return new Response("Offline", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // nunca intercepta outras origens (Supabase, fontes externas)
  if (url.origin !== self.location.origin) return

  // assets imutáveis e ícones → cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // navegação de páginas → network-first com fallback ao cache / offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request))
  }
})
