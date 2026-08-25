import { describe, expect, it } from "vitest"
import { BJJ_PLAN } from "../lib/bjj-plan"
import { normalizeTemplate, planVersionOf } from "../lib/use-workout-templates"

const fallback = BJJ_PLAN.find((session) => session.id === "bjjEngine")!

function storedFrom(fallbackSession: typeof fallback, overrides: Record<string, unknown>) {
  return { ...fallbackSession, exercises: [...fallbackSession.exercises], ...overrides }
}

describe("planVersionOf", () => {
  it("lê a versão de um template persistido", () => {
    expect(planVersionOf({ planVersion: "academia-v2" })).toBe("academia-v2")
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
      title: "C · Motor de Rolagem",
    })
    delete (stale as Record<string, unknown>).planVersion
    const normalized = normalizeTemplate(stale, fallback)
    expect(normalized.title).toBe(fallback.title)
    expect(normalized.exercises.map((e) => e.id)).toEqual(
      fallback.exercises.map((e) => e.id)
    )
  })

  it("template de versão anterior cai no default novo", () => {
    const stored = storedFrom(fallback, { planVersion: "v1-tatame" })
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
