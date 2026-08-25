import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { supabaseEnv } from "@/lib/supabase/env"

/**
 * Portão de autenticação das rotas.
 *
 * Por que getClaims() e não getUser() direto: o getUser() conversa com o
 * servidor de auth em TODA navegação e, perto do vencimento do access token,
 * dispara renovação ali no servidor — que corre contra a renovação feita pelo
 * cliente no browser. Com refresh tokens de uso único, quem perde essa corrida
 * invalida a sessão inteira ("Invalid Refresh Token") e o usuário só volta a
 * entrar limpando cookies/cache. O getClaims() valida o JWT localmente (chave
 * assimétrica + JWKS em cache), sem tocar no servidor de auth nem renovar
 * token. O getUser() fica só como fallback para projetos com chave simétrica
 * (HS256) ou token já vencido que precisa renovar antes de decidir o redirect.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url: supabaseUrl, anonKey } = supabaseEnv()
  const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl
  // rotas públicas: login + arquivos do PWA (manifest/sw/offline)
  const PUBLIC = ["/login", "/offline", "/manifest.webmanifest", "/sw.js"]
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))
  const isLogin = pathname.startsWith("/login")

  let authenticated = false
  try {
    const { data } = await supabase.auth.getClaims()
    if (data) {
      authenticated = true
    } else {
      // sem claims válidos: chave simétrica ou token vencido. O getUser()
      // renova a sessão quando dá — e escreve os cookies novos via setAll.
      const {
        data: { user },
      } = await supabase.auth.getUser()
      authenticated = Boolean(user)
    }
  } catch {
    // Servidor de auth inacessível: falha de infraestrutura não pode derrubar
    // o site (500) nem deslogar quem tem sessão. Segue a requisição; as
    // chamadas de dados no cliente tratam o erro normalmente.
  }

  if (!authenticated && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (authenticated && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
}
