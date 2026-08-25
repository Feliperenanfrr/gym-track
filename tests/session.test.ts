import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isAuthError,
  recoverSession,
  runWithFreshSession,
} from "../lib/supabase/session"

/** Cliente stub só com os pedaços de auth que os helpers tocam */
function stubClient(options: {
  session?: { expires_at?: number } | null
  refreshResult?: { session: unknown; error: unknown }
  getSessionThrows?: boolean
}) {
  return {
    auth: {
      getSession: vi.fn(async () => {
        if (options.getSessionThrows) throw new Error("network down")
        return { data: { session: options.session ?? null }, error: null }
      }),
      refreshSession: vi.fn(async () =>
        options.refreshResult
          ? { data: { session: options.refreshResult.session }, error: options.refreshResult.error }
          : { data: { session: null }, error: null }
      ),
      signOut: vi.fn(async () => ({ error: null })),
    },
  } as unknown as SupabaseClient & {
    auth: {
      getSession: ReturnType<typeof vi.fn>
      refreshSession: ReturnType<typeof vi.fn>
      signOut: ReturnType<typeof vi.fn>
    }
  }
}

describe("isAuthError", () => {
  it.each([
    ["JWT expired", true],
    ["Invalid JWT", true],
    ["JWS signature verification failed", true],
    ["Token expirado", true],
    ["Sessão expirada — faça login novamente.", true],
    ["Invalid Refresh Token: Already Used", true],
    ["Invalid Refresh Token: Refresh Token Not Found", true],
    ["401 Unauthorized", true],
    ["Audience claim invalid", false],
  ])("%s → %s", (message, expected) => {
    expect(isAuthError(message)).toBe(expected)
  })

  it("não confunde erros de API/RLS/rede com erro de sessão", () => {
    expect(
      isAuthError('duplicate key value violates unique constraint "workouts_key"')
    ).toBe(false)
    expect(isAuthError('new row violates row-level security policy')).toBe(false)
    expect(isAuthError("Failed to fetch")).toBe(false)
    expect(isAuthError("PGRST116: JSON object requested")).toBe(false)
    expect(isAuthError("valor 1401 fora da faixa")).toBe(false)
  })

  it("mensagem vazia ou ausente → false", () => {
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
    expect(isAuthError("")).toBe(false)
  })
})

describe("recoverSession", () => {
  it("sessão com folga válida → true sem renovar", async () => {
    const client = stubClient({ session: { expires_at: Date.now() / 1000 + 3600 } })
    await expect(recoverSession(client)).resolves.toBe(true)
    expect(client.auth.refreshSession).not.toHaveBeenCalled()
  })

  it("sessão perto do vencimento → renova e confirma", async () => {
    const client = stubClient({
      session: { expires_at: Date.now() / 1000 + 10 },
      refreshResult: { session: { expires_at: Date.now() / 1000 + 3600 }, error: null },
    })
    await expect(recoverSession(client)).resolves.toBe(true)
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1)
  })

  it("renovação falhou → false", async () => {
    const client = stubClient({
      session: null,
      refreshResult: { session: null, error: new Error("Invalid Refresh Token") },
    })
    await expect(recoverSession(client)).resolves.toBe(false)
  })

  it("getSession falhou (rede) → false, nunca lança", async () => {
    const client = stubClient({ getSessionThrows: true })
    await expect(recoverSession(client)).resolves.toBe(false)
  })
})

describe("runWithFreshSession", () => {
  it("operação de primeira → executa uma vez", async () => {
    const client = stubClient({})
    const op = vi.fn(async () => "ok")
    await expect(runWithFreshSession(client, op)).resolves.toBe("ok")
    expect(op).toHaveBeenCalledTimes(1)
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })

  it("erro de sessão + token renovado → repete uma vez e retorna", async () => {
    const client = stubClient({
      session: { expires_at: Date.now() / 1000 + 3600 },
    })
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("JWT expired"))
      .mockResolvedValueOnce("salvo")
    await expect(runWithFreshSession(client, op)).resolves.toBe("salvo")
    expect(op).toHaveBeenCalledTimes(2)
  })

  it("erro de sessão duas vezes → encerra limpo e lança mensagem amigável", async () => {
    const client = stubClient({
      session: { expires_at: Date.now() / 1000 + 3600 },
    })
    const op = vi.fn(async () => {
      throw new Error("JWT expired")
    })
    await expect(runWithFreshSession(client, op)).rejects.toThrow(
      "Sessão expirada — faça login novamente."
    )
    expect(op).toHaveBeenCalledTimes(2)
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it("recuperação impossível → vai para o login na primeira falha", async () => {
    const client = stubClient({ session: null }) // refresh devolve null
    const op = vi.fn(async (): Promise<string> => {
      throw new Error("Invalid Refresh Token: Already Used")
    })
    await expect(runWithFreshSession(client, op)).rejects.toThrow(
      "Sessão expirada — faça login novamente."
    )
    expect(op).toHaveBeenCalledTimes(1)
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it("erro que não é de sessão → propaga sem tocar na auth", async () => {
    const client = stubClient({})
    const op = vi.fn(async (): Promise<string> => {
      throw new Error("new row violates row-level security policy")
    })
    await expect(runWithFreshSession(client, op)).rejects.toThrow(
      "row-level security policy"
    )
    expect(op).toHaveBeenCalledTimes(1)
    expect(client.auth.getSession).not.toHaveBeenCalled()
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })
})
