import { describe, expect, it } from "vitest"
import { ENGINE_PLAN } from "../lib/engine-plan"
import { normalizeTemplate, planVersionOf } from "../lib/use-workout-templates"

const fallback = ENGINE_PLAN.find((session) => session.id === "engineForceA")!

function storedFrom(fallbackSession: typeof fallback, overrides: Record<string, unknown>) {
  return { ...fallbackSession, exercises: [...fallbackSession.exercises], ...overrides }
}

describe("planVersionOf", () => {
  it("lê a versão de um template persistido", () => {
    expect(planVersionOf({ planVersion: "motor-v1" })).toBe("motor-v1")
    expect(planVersionOf({})).toBe("")
    expect(planVersionOf(null)).toBe("")
    expect(planVersionOf({ planVersion: 42 })).toBe("")
  })
})

describe("normalizeTemplate", () => {
  it("template da mesma versão vence o default", () => {
    const stored = storedFrom(fallback, {
      duration: "~50 min",
      planVersion: fallback.planVersion,
    })
    const normalized = normalizeTemplate(stored, fallback)
    expect(normalized.duration).toBe("~50 min")
    expect(normalized.planVersion).toBe(fallback.planVersion)
  })

  it("template sem versão (prescrição antiga) cai no default novo", () => {
    const stale = storedFrom(fallback, {
      planVersion: undefined,
      title: "A · Tração & Pegada",
    })
    delete (stale as Record<string, unknown>).planVersion
    const normalized = normalizeTemplate(stale, fallback)
    expect(normalized.title).toBe(fallback.title)
    expect(normalized.exercises.map((e) => e.id)).toEqual(
      fallback.exercises.map((e) => e.id)
    )
  })

  it("template de versão anterior cai no default novo", () => {
    const stored = storedFrom(fallback, { planVersion: "academia-v2" })
    expect(normalizeTemplate(stored, fallback).exercises).toEqual(
      cloneExercises(fallback)
    )
  })

  it("id divergente ou exercícios inválidos caem no default", () => {
    expect(
      normalizeTemplate(storedFrom(fallback, { id: "outra" }), fallback).exercises
    ).toEqual(cloneExercises(fallback))
    expect(
      normalizeTemplate(storedFrom(fallback, { exercises: "oops" }), fallback).exercises
    ).toEqual(cloneExercises(fallback))
  })

  function cloneExercises(session: typeof fallback) {
    return session.exercises.map((exercise) => ({ ...exercise }))
  }
})
