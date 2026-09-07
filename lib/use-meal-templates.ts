"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { normalizeSlot, normalizeUnit, slotOrder } from "./nutrition"
import { getSupabaseBrowserClient } from "./supabase/client"
import { MealItem, MealTemplate } from "./types"

/**
 * Refeições fixas do Supabase, independentes dos snapshots gravados em
 * `meal_logs.refeicoes`. Mesma arquitetura de `useWorkoutTemplates`: editar
 * um molde aqui NÃO alcança nenhum dia já registrado — só os próximos.
 *
 * Cache em localStorage por usuário para a tela abrir preenchida offline; o
 * Supabase continua sendo a fonte de verdade.
 */

interface MealTemplateRow {
  id: string
  nome: string
  slot: string
  itens: unknown
  ordem: number | null
}

const CACHE_KEY = "gym-track:meal-templates:v1"

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * O banco pode ser editado direto pelo dashboard, então tudo que entra na UI
 * passa por validação defensiva. Item inválido é descartado em silêncio, não
 * derruba a refeição inteira.
 */
function normalizeItem(value: unknown): MealItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const nome = typeof raw.nome === "string" ? raw.nome.trim() : ""
  const qtd = toNumber(raw.qtd)
  const kcal = toNumber(raw.kcal)
  const proteinaG = toNumber(raw.proteinaG)
  const unidadeRaw = typeof raw.unidade === "string" ? raw.unidade.trim() : ""
  if (!nome || !unidadeRaw || qtd === null || qtd <= 0) return null
  if (kcal === null || kcal < 0 || proteinaG === null || proteinaG < 0) return null

  const item: MealItem = {
    nome,
    qtd,
    unidade: normalizeUnit(unidadeRaw) ?? unidadeRaw,
    kcal,
    proteinaG,
  }
  const gramas = toNumber(raw.gramas)
  if (gramas !== null && gramas > 0) item.gramas = gramas
  const carboG = toNumber(raw.carboG)
  if (carboG !== null && carboG >= 0) item.carboG = carboG
  const gorduraG = toNumber(raw.gorduraG)
  if (gorduraG !== null && gorduraG >= 0) item.gorduraG = gorduraG
  return item
}

function normalizeTemplate(value: unknown): MealTemplate | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<MealTemplateRow>
  const id = typeof raw.id === "string" ? raw.id.trim() : ""
  const nome = typeof raw.nome === "string" ? raw.nome.trim() : ""
  const slot = normalizeSlot(raw.slot)
  if (!id || !nome || !slot) return null
  const itens = Array.isArray(raw.itens)
    ? raw.itens.map(normalizeItem).filter((item): item is MealItem => item !== null)
    : []
  return { id, nome, slot, itens, ordem: toNumber(raw.ordem) ?? 0 }
}

function sortTemplates(templates: MealTemplate[]): MealTemplate[] {
  return [...templates].sort(
    (a, b) =>
      slotOrder(a.slot) - slotOrder(b.slot) ||
      a.ordem - b.ordem ||
      a.nome.localeCompare(b.nome, "pt-BR")
  )
}

function readCache(cacheKey: string): MealTemplate[] | null {
  if (typeof window === "undefined") return null
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey) ?? "null")
    if (!Array.isArray(parsed)) return null
    return sortTemplates(
      parsed.map(normalizeTemplate).filter((t): t is MealTemplate => t !== null)
    )
  } catch {
    return null
  }
}

function writeCache(cacheKey: string, templates: MealTemplate[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(cacheKey, JSON.stringify(templates))
  } catch {
    // Cache é complementar; o Supabase continua sendo a fonte de verdade.
  }
}

export function useMealTemplates() {
  const [templates, setTemplates] = useState<MealTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const templatesRef = useRef<MealTemplate[] | null>(null)
  const cacheKeyRef = useRef(CACHE_KEY)

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = getSupabaseBrowserClient()
      const { data: authData } = await supabase.auth.getSession()
      cacheKeyRef.current = authData.session?.user.id
        ? `${CACHE_KEY}:${authData.session.user.id}`
        : CACHE_KEY

      const { data, error: loadError } = await supabase
        .from("meal_templates")
        .select("id,nome,slot,itens,ordem")

      if (cancelled) return
      if (loadError) {
        // Mantém a tela utilizável durante o rollout: sem a migration 0008 o
        // app abre com o cache (ou vazio) em vez de quebrar.
        console.warn("meal_templates indisponível:", loadError.message)
        setTemplates(readCache(cacheKeyRef.current) ?? [])
        setError(loadError.message)
        return
      }

      const rows = (data ?? []) as MealTemplateRow[]
      const resolved = sortTemplates(
        rows.map(normalizeTemplate).filter((t): t is MealTemplate => t !== null)
      )
      setTemplates(resolved)
      writeCache(cacheKeyRef.current, resolved)
      setError(null)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveTemplate = useCallback(async (template: MealTemplate) => {
    const normalized = normalizeTemplate(template)
    if (!normalized) throw new Error("Refeição fixa incompleta.")
    const previous = templatesRef.current

    setTemplates((current) => {
      const rest = (current ?? []).filter((t) => t.id !== normalized.id)
      const next = sortTemplates([...rest, normalized])
      writeCache(cacheKeyRef.current, next)
      return next
    })

    const supabase = getSupabaseBrowserClient()
    const { error: saveError } = await supabase.from("meal_templates").upsert(
      {
        id: normalized.id,
        nome: normalized.nome,
        slot: normalized.slot,
        itens: normalized.itens,
        ordem: normalized.ordem,
      },
      { onConflict: "user_id,id" }
    )

    if (saveError) {
      if (previous) {
        setTemplates(previous)
        writeCache(cacheKeyRef.current, previous)
      }
      setError(saveError.message)
      throw new Error(saveError.message)
    }
    setError(null)
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    const previous = templatesRef.current

    setTemplates((current) => {
      const next = (current ?? []).filter((t) => t.id !== id)
      writeCache(cacheKeyRef.current, next)
      return next
    })

    const supabase = getSupabaseBrowserClient()
    const { error: deleteError } = await supabase.from("meal_templates").delete().eq("id", id)

    if (deleteError) {
      if (previous) {
        setTemplates(previous)
        writeCache(cacheKeyRef.current, previous)
      }
      setError(deleteError.message)
      throw new Error(deleteError.message)
    }
    setError(null)
  }, [])

  return { templates, error, saveTemplate, deleteTemplate }
}
