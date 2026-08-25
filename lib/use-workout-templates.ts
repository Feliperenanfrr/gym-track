"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { catalogWithTemplates, CatalogExercise } from "./exercise-catalog"
import { ALL_PLAN_SESSIONS } from "./plan"
import { getSupabaseBrowserClient } from "./supabase/client"
import { ExercisePrescription, SessionId, SessionPlan } from "./types"

interface WorkoutTemplateRow {
  session_id: string
  template: unknown
}

const TEMPLATE_CACHE_KEY = "gym-track:workout-templates:v1"

function cloneTemplate(template: SessionPlan): SessionPlan {
  return {
    ...template,
    exercises: template.exercises.map((exercise) => ({ ...exercise })),
    cardioAfter: template.cardioAfter ? { ...template.cardioAfter } : undefined,
    cardioTarget: template.cardioTarget ? { ...template.cardioTarget } : undefined,
  }
}

function isExercise(value: unknown): value is ExercisePrescription {
  if (!value || typeof value !== "object") return false
  const exercise = value as Partial<ExercisePrescription>
  return (
    typeof exercise.id === "string" &&
    typeof exercise.name === "string" &&
    typeof exercise.nameEn === "string" &&
    typeof exercise.sets === "number" &&
    typeof exercise.repsMin === "number" &&
    typeof exercise.repsMax === "number" &&
    (exercise.unit === "reps" || exercise.unit === "seconds") &&
    typeof exercise.rest === "string" &&
    typeof exercise.note === "string"
  )
}

/** Versão gravada num template persistido ("": sem versão = prescrição antiga) */
export function planVersionOf(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const v = (value as { planVersion?: unknown }).planVersion
  return typeof v === "string" ? v : ""
}

/**
 * O banco pode ser editado diretamente, então fazemos uma validação defensiva
 * antes de colocar o JSON na UI. Metadados ausentes ou uma prescrição de
 * versão anterior do plano caem no default versionado.
 */
export function normalizeTemplate(
  value: unknown,
  fallback: SessionPlan
): SessionPlan {
  if (!value || typeof value !== "object") return cloneTemplate(fallback)
  const stored = value as Partial<SessionPlan>
  if (stored.id !== fallback.id || !Array.isArray(stored.exercises)) {
    return cloneTemplate(fallback)
  }
  // Template materializado numa versão antiga do plano: o default novo vence
  if ((stored.planVersion ?? "") !== (fallback.planVersion ?? "")) {
    return cloneTemplate(fallback)
  }

  const exercises = stored.exercises.filter(isExercise).map((exercise) => ({ ...exercise }))
  const hasCardioAfter = Object.prototype.hasOwnProperty.call(stored, "cardioAfter")
  const hasCardioTarget = Object.prototype.hasOwnProperty.call(stored, "cardioTarget")
  return {
    ...fallback,
    ...stored,
    id: fallback.id,
    exercises,
    cardioAfter: hasCardioAfter
      ? stored.cardioAfter
        ? { ...stored.cardioAfter }
        : undefined
      : fallback.cardioAfter
        ? { ...fallback.cardioAfter }
        : undefined,
    cardioTarget: hasCardioTarget
      ? stored.cardioTarget
        ? { ...stored.cardioTarget }
        : undefined
      : fallback.cardioTarget
        ? { ...fallback.cardioTarget }
        : undefined,
  }
}

function defaultTemplates(): SessionPlan[] {
  return ALL_PLAN_SESSIONS.map(cloneTemplate)
}

function readCachedTemplates(cacheKey: string): SessionPlan[] | null {
  if (typeof window === "undefined") return null
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey) ?? "null")
    if (!Array.isArray(parsed)) return null
    const byId = new Map(
      parsed
        .filter((value): value is { id: string } => Boolean(value && typeof value.id === "string"))
        .map((value) => [value.id, value])
    )
    return ALL_PLAN_SESSIONS.map((fallback) =>
      normalizeTemplate(byId.get(fallback.id), fallback)
    )
  } catch {
    return null
  }
}

function cacheTemplates(cacheKey: string, templates: SessionPlan[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(cacheKey, JSON.stringify(templates))
  } catch {
    // Cache offline é complementar; o Supabase continua sendo a fonte de verdade.
  }
}

/**
 * Templates do Supabase, independentes dos snapshots em workouts.entries.
 * Na primeira carga, defaults ainda ausentes são materializados no banco.
 */
export function useWorkoutTemplates() {
  const [templates, setTemplates] = useState<SessionPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const templatesRef = useRef<SessionPlan[] | null>(null)
  const cacheKeyRef = useRef(TEMPLATE_CACHE_KEY)

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = getSupabaseBrowserClient()
      const { data: authData } = await supabase.auth.getSession()
      cacheKeyRef.current = authData.session?.user.id
        ? `${TEMPLATE_CACHE_KEY}:${authData.session.user.id}`
        : TEMPLATE_CACHE_KEY
      const { data, error: loadError } = await supabase
        .from("workout_templates")
        .select("session_id,template")

      if (cancelled) return
      if (loadError) {
        // Mantém o app utilizável durante rollout, mas deixa edição indisponível
        // até a migration existir/estar acessível.
        console.warn("workout_templates indisponível:", loadError.message)
        setTemplates(readCachedTemplates(cacheKeyRef.current) ?? defaultTemplates())
        setError(loadError.message)
        return
      }

      const rows = (data ?? []) as WorkoutTemplateRow[]
      const rowById = new Map(rows.map((row) => [row.session_id, row.template]))
      const resolved = ALL_PLAN_SESSIONS.map((fallback) =>
        normalizeTemplate(rowById.get(fallback.id), fallback)
      )
      setTemplates(resolved)
      cacheTemplates(cacheKeyRef.current, resolved)
      setError(null)

      // Materializa defaults ausentes ou desatualizados, para que o plano
      // inteiro fique persistido e editável (editor ou direto no banco).
      // Template de versão anterior é sobrescrito pelo default atual.
      const missing = ALL_PLAN_SESSIONS.filter((fallback) => {
        const stored = rowById.get(fallback.id)
        return !stored || planVersionOf(stored) !== (fallback.planVersion ?? "")
      }).map(
        (fallback) => resolved.find((template) => template.id === fallback.id)!
      )
      if (missing.length === 0) return
      const { error: seedError } = await supabase.from("workout_templates").upsert(
        missing.map((template) => ({
          session_id: template.id,
          template,
        })),
        { onConflict: "user_id,session_id" }
      )
      if (!cancelled && seedError) setError(seedError.message)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveTemplate = useCallback(async (template: SessionPlan) => {
    const fallback = ALL_PLAN_SESSIONS.find((candidate) => candidate.id === template.id)
    if (!fallback) throw new Error("Template desconhecido")
    const normalized = normalizeTemplate(template, fallback)
    const previous = templatesRef.current

    setTemplates((current) => {
      const next = current?.map((candidate) =>
        candidate.id === normalized.id ? cloneTemplate(normalized) : candidate
      ) ?? current
      if (next) cacheTemplates(cacheKeyRef.current, next)
      return next
    })

    const supabase = getSupabaseBrowserClient()
    const { error: saveError } = await supabase.from("workout_templates").upsert(
      {
        session_id: normalized.id,
        template: normalized,
      },
      { onConflict: "user_id,session_id" }
    )

    if (saveError) {
      if (previous) {
        setTemplates(previous)
        cacheTemplates(cacheKeyRef.current, previous)
      }
      setError(saveError.message)
      throw new Error(saveError.message)
    }
    setError(null)
  }, [])

  const templateById = useMemo(
    () =>
      Object.fromEntries((templates ?? []).map((template) => [template.id, template])) as Partial<
        Record<SessionId, SessionPlan>
      >,
    [templates]
  )

  const exerciseCatalog: CatalogExercise[] = useMemo(
    () => catalogWithTemplates(templates ?? ALL_PLAN_SESSIONS),
    [templates]
  )

  return {
    templates,
    templateById,
    exerciseCatalog,
    error,
    saveTemplate,
  }
}
