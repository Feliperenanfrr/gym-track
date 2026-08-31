import { describe, expect, it } from "vitest"
import { isLegacySession, legacyProgramOf } from "../lib/legacy-plan"

describe("sessões legadas", () => {
  it("preserva o protocolo de origem no histórico", () => {
    expect(legacyProgramOf("bjjPull")).toBe("jiu-jitsu")
    expect(legacyProgramOf("competitionLower")).toBe("flag-football")
    expect(legacyProgramOf("upperA")).toBeNull()
  })

  it("continua distinguindo sessões aposentadas das sessões ativas", () => {
    expect(isLegacySession("bjjZ2")).toBe(true)
    expect(isLegacySession("engineZ2")).toBe(false)
  })
})
