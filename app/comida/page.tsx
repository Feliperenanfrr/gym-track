"use client"

import { useMemo, useState } from "react"
import {
  Check,
  ChevronRight,
  FileUp,
  History,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react"
import { ProteinChart } from "@/components/charts"
import { MealCalendar, SlotDistribution } from "@/components/meal-panels"
import { MealComposer, MealSeed } from "@/components/meal-composer"
import { MealHistory } from "@/components/meal-history"
import { ConfirmDialog, UndoToast } from "@/components/dialogs"
import {
  Card,
  CollapsibleSection,
  PageHeader,
  SectionTitle,
  Skeleton,
  StatCard,
} from "@/components/ui"
import {
  dayTotals,
  formatMacro,
  loggingCoverage,
  macroCoverageNote,
  mealCalendar,
  MEAL_SLOTS,
  mealTotals,
  newId,
  sourceLabel,
  ParsedMeal,
  ParsedMealEntry,
  parseMealsJson,
  proteinPerKg,
  proteinSeries,
  proteinTarget,
  slotDistribution,
  slotLabel,
  slotOrder,
  slugify,
  snapshotItems,
  validEntries,
} from "@/lib/nutrition"
import { useGymData } from "@/lib/store"
import { useMealTemplates } from "@/lib/use-meal-templates"
import { useOperationalDay } from "@/lib/use-operational-day"
import { Meal, MealItem, MealLog, MealSlot, MealTemplate } from "@/lib/types"
import { cn, fromDateKey, toDateKey, toOperationalDateKey } from "@/lib/utils"

const JSON_PLACEHOLDER = `[
{"nome":"Banana","refeicao":"lanche","hora":"15:10","itens":[
  {"nome":"Banana prata","qtd":1,"unidade":"unidade","gramas":86,"kcal":80,"proteinaG":1.1}]},
{"nome":"Jantar","refeicao":"jantar","hora":"20:00","itens":[
  {"nome":"Contrafilé grelhado","qtd":1,"unidade":"filé","gramas":150,"kcal":289,"proteinaG":47.3}]}
]`

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "hoje"
  const yesterday = new Date(fromDateKey(todayKey))
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === toDateKey(yesterday)) return "ontem"
  const d = fromDateKey(key)
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
  return `${weekday} ${shortDate(key)}`
}

/** Refeição do lote → registro, com id novo e snapshot dos itens. */
function toMeal(parsed: ParsedMeal): Meal {
  return {
    id: newId("meal"),
    nome: parsed.nome,
    slot: parsed.slot,
    itens: snapshotItems(parsed.itens),
    hora: parsed.hora,
    premissas: parsed.premissas,
    fonte: parsed.fonte,
  }
}

function sortMeals(meals: Meal[]): Meal[] {
  return [...meals].sort(
    (a, b) => slotOrder(a.slot) - slotOrder(b.slot) || (a.hora ?? "").localeCompare(b.hora ?? "")
  )
}

/** Slug livre: "almoco-de-casa", "almoco-de-casa-2"… */
function uniqueTemplateId(nome: string, taken: Set<string>): string {
  const base = slugify(nome)
  if (!taken.has(base)) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}

export default function ComidaPage() {
  const { data, addMeal, replaceMeal, removeMeal, setMealDayComplete } = useGymData()
  const { templates, error: templatesError, saveTemplate, deleteTemplate } = useMealTemplates()
  const operationalDay = useOperationalDay()

  const todayKey = operationalDay ? toDateKey(operationalDay) : toOperationalDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const dateKey = selectedDate ?? todayKey
  const [historyOpen, setHistoryOpen] = useState(false)
  const [completingDate, setCompletingDate] = useState<string | null>(null)

  const [seed, setSeed] = useState<MealSeed | null>(null)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const [jsonText, setJsonText] = useState("")
  const [fileError, setFileError] = useState<string | null>(null)
  /** linhas do lote desmarcadas à mão e as que já foram registradas */
  const [excludedIdx, setExcludedIdx] = useState<Set<number>>(new Set())
  const [registeredIdx, setRegisteredIdx] = useState<Set<number>>(new Set())

  const [undoMeal, setUndoMeal] = useState<{ meal: Meal; date: string } | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<MealTemplate | null>(null)

  const dayLog: MealLog | undefined = useMemo(
    () => data?.meals.find((day) => day.date === dateKey),
    [data, dateKey]
  )
  const meals = useMemo(() => sortMeals(dayLog?.refeicoes ?? []), [dayLog])
  const totals = useMemo(() => dayTotals(dayLog), [dayLog])
  const target = useMemo(
    () => (data ? proteinTarget(data.body, dateKey) : null),
    [data, dateKey]
  )
  const perKg = proteinPerKg(totals.proteinaG, target)
  const coverageNote = macroCoverageNote(totals)
  const logCoverage = useMemo(
    () => loggingCoverage(data?.meals ?? [], dateKey),
    [data, dateKey]
  )
  const distribution = useMemo(() => slotDistribution(dayLog), [dayLog])
  const proteinDays = useMemo(
    () => proteinSeries(data?.meals ?? [], dateKey, 14),
    [data, dateKey]
  )
  const calendar = useMemo(
    () => mealCalendar(data?.meals ?? [], operationalDay ?? new Date(), 12),
    [data, operationalDay]
  )
  const proteinPct = target && target.mid > 0 ? Math.min(1, totals.proteinaG / target.mid) : 0

  const parse = useMemo(() => (jsonText.trim() ? parseMealsJson(jsonText) : null), [jsonText])
  const parsedMeals = useMemo(() => validEntries(parse), [parse])
  const failedCount = (parse?.entries.length ?? 0) - parsedMeals.length
  /** o que o botão de lote vai gravar: válidas, marcadas e ainda não gravadas */
  const pendingBatch = useMemo(
    () =>
      parsedMeals.filter(
        (entry) => !excludedIdx.has(entry.index) && !registeredIdx.has(entry.index)
      ),
    [parsedMeals, excludedIdx, registeredIdx]
  )

  const templatesBySlot = useMemo(() => {
    const map = new Map<MealSlot, MealTemplate[]>()
    for (const template of templates ?? []) {
      const list = map.get(template.slot) ?? []
      list.push(template)
      map.set(template.slot, list)
    }
    return map
  }, [templates])

  const showFlash = (message: string) => {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 3000)
  }

  const openDay = (date: string) => {
    setSelectedDate(date === todayKey ? null : date)
    setHistoryOpen(false)
    setPageError(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  /** Texto novo = lote novo: marcações e registros anteriores não valem mais. */
  const replaceJsonText = (text: string) => {
    setJsonText(text)
    setFileError(null)
    setExcludedIdx(new Set())
    setRegisteredIdx(new Set())
  }

  const loadJsonFile = async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      replaceJsonText(await file.text())
    } catch {
      setFileError("Não foi possível ler o arquivo.")
    }
  }

  const toggleBatchRow = (index: number) => {
    setExcludedIdx((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const openTemplate = (template: MealTemplate) => {
    setPageError(null)
    setSeed({
      nome: template.nome,
      slot: template.slot,
      itens: template.itens,
      templateId: template.id,
      targetDate: dateKey,
      origem: "fixa",
    })
  }

  /** Abre uma linha do lote no compositor para conferir antes de gravar. */
  const openBatchEntry = (entry: ParsedMealEntry) => {
    if (!entry.meal) return
    setPageError(null)
    setSeed({
      nome: entry.meal.nome,
      slot: entry.meal.slot,
      itens: entry.meal.itens,
      premissas: entry.meal.premissas,
      hora: entry.meal.hora,
      fonte: entry.meal.fonte,
      targetDate: entry.meal.date ?? dateKey,
      batchIndex: entry.index,
      origem: "json",
    })
  }

  /**
   * Grava o lote inteiro. Sequencial de propósito: refeições do mesmo dia
   * gravam a mesma linha de `meal_logs`, e em paralelo o servidor veria duas
   * escritas competindo pelo mesmo upsert.
   */
  const handleRegisterBatch = async () => {
    if (pendingBatch.length === 0) return
    setPageError(null)
    setSaving(true)
    const gravadas: string[] = []
    try {
      for (const entry of pendingBatch) {
        if (!entry.meal) continue
        await addMeal(toMeal(entry.meal), entry.meal.date ?? dateKey)
        setRegisteredIdx((current) => new Set(current).add(entry.index))
        gravadas.push(entry.meal.date ?? dateKey)
      }
      setJsonText("")
      setExcludedIdx(new Set())
      setRegisteredIdx(new Set())
      const dias = new Set(gravadas)
      showFlash(
        dias.size > 1
          ? `${gravadas.length} refeições registradas em ${dias.size} dias.`
          : `${gravadas.length} refeição(ões) registrada(s) em ${dayLabel(gravadas[0], todayKey)}.`
      )
    } catch (e) {
      // o texto continua na tela e as já gravadas ficam marcadas: reenviar
      // o lote não duplica nada
      setPageError(
        `${gravadas.length} de ${pendingBatch.length} registradas. ${
          e instanceof Error ? e.message : "Erro ao registrar o lote"
        }`
      )
    } finally {
      setSaving(false)
    }
  }

  const openRegistered = (meal: Meal) => {
    setPageError(null)
    setSeed({
      mealId: meal.id,
      nome: meal.nome,
      slot: meal.slot,
      itens: meal.itens,
      premissas: meal.premissas,
      templateId: meal.templateId,
      hora: meal.hora,
      fonte: meal.fonte,
      targetDate: dateKey,
      origem: "registro",
    })
  }

  const handleRegister = async (meal: Meal) => {
    const editing = seed?.origem === "registro"
    const batchIndex = seed?.batchIndex
    const targetDate = seed?.targetDate ?? dateKey
    setSaving(true)
    try {
      if (editing) await replaceMeal(meal, targetDate)
      else await addMeal(meal, targetDate)
      // linha do lote sai da fila em vez de limpar o textarea inteiro
      if (batchIndex !== undefined) {
        setRegisteredIdx((current) => new Set(current).add(batchIndex))
      }
      setSeed(null)
      showFlash(
        editing
          ? "Refeição atualizada."
          : `${meal.nome} registrada em ${dayLabel(targetDate, todayKey)}.`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTemplate = async (input: {
    nome: string
    slot: MealSlot
    itens: MealItem[]
    templateId?: string
  }): Promise<string> => {
    setSaving(true)
    try {
      const existing = input.templateId
        ? (templates ?? []).find((t) => t.id === input.templateId)
        : undefined
      const taken = new Set((templates ?? []).map((t) => t.id))
      const id = existing?.id ?? uniqueTemplateId(input.nome, taken)
      const ordem =
        existing?.ordem ?? (templates ?? []).filter((t) => t.slot === input.slot).length
      await saveTemplate({ id, nome: input.nome, slot: input.slot, itens: input.itens, ordem })
      showFlash(
        existing
          ? `"${input.nome}" atualizada — dias já registrados não mudaram.`
          : `"${input.nome}" salva nas refeições fixas.`
      )
      return id
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMeal = async (meal: Meal) => {
    if (saving || completingDate !== null) return
    setPageError(null)
    setSaving(true)
    try {
      await removeMeal(meal.id, dateKey)
      setUndoMeal({ meal, date: dateKey })
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao remover a refeição")
    } finally {
      setSaving(false)
    }
  }

  const handleSetComplete = async (date: string, complete: boolean) => {
    if (saving || completingDate !== null) return
    setPageError(null)
    setCompletingDate(date)
    try {
      await setMealDayComplete(date, complete)
      showFlash(
        `${shortDate(date)}: ${complete ? "dia marcado como completo." : "dia marcado como parcial."}`
      )
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao marcar o dia")
    } finally {
      setCompletingDate(null)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return
    const template = templateToDelete
    setTemplateToDelete(null)
    try {
      await deleteTemplate(template.id)
      showFlash(`"${template.nome}" removida das fixas.`)
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao excluir a refeição fixa")
    }
  }

  if (!data || !templates) {
    return (
      <main>
        <PageHeader kicker="INGESTÃO" title="Comida" />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="h-24">
            <Skeleton className="h-full w-full" />
          </Card>
          <Card className="h-24">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
        <Card className="h-40">
          <Skeleton className="h-full w-full" />
        </Card>
      </main>
    )
  }

  return (
    <main>
      <PageHeader
        kicker="INGESTÃO"
        title="Comida"
        right={!historyOpen && (
          <input
            type="date"
            value={dateKey}
            max={todayKey}
            onChange={(event) => {
              const date = event.target.value
              if (date && date <= todayKey) openDay(date)
            }}
            disabled={saving || completingDate !== null}
            className="rounded border border-seam bg-coal px-2 py-1.5 font-mono text-[11px] text-steel outline-none focus:border-ember"
            aria-label="Dia do registro"
          />
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Visualização da alimentação">
        {[
          { history: false, label: "Dia", icon: UtensilsCrossed },
          { history: true, label: "Histórico", icon: History },
        ].map((view) => (
          <button
            key={view.label}
            type="button"
            onClick={() => setHistoryOpen(view.history)}
            aria-pressed={historyOpen === view.history}
            disabled={saving || completingDate !== null}
            className={cn(
              "flex items-center justify-center gap-2 rounded border px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40",
              historyOpen === view.history
                ? "border-ember bg-ember/10 text-ember"
                : "border-seam text-steel hover:text-bone"
            )}
          >
            <view.icon size={15} /> {view.label}
          </button>
        ))}
      </div>

      {pageError && (
        <p role="alert" className="mb-4 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {pageError}
        </p>
      )}

      {historyOpen ? (
        <MealHistory
          days={data.meals}
          todayKey={todayKey}
          saving={saving || completingDate !== null}
          completingDate={completingDate}
          onOpenDay={openDay}
          onSetComplete={handleSetComplete}
        />
      ) : (
        <>
      {dateKey !== todayKey && (
        <Card className="mb-4 border-l-4 border-l-gold">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-bone">
                Alimentação de {fromDateKey(dateKey).toLocaleDateString("pt-BR")}
              </p>
              <p className="mt-1 text-xs text-steel-dim">
                As alterações e a marca de dia completo serão salvas nesta data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openDay(todayKey)}
              disabled={saving || completingDate !== null}
              className="shrink-0 rounded border border-seam px-3 py-2 text-xs text-bone hover:border-ember disabled:opacity-40"
            >
              Hoje
            </button>
          </div>
        </Card>
      )}

      {templatesError && (
        <Card className="mb-4 border-l-4 border-l-gold text-xs text-steel">
          Refeições fixas indisponíveis: {templatesError}. Rode a migration{" "}
          <span className="font-mono text-bone">0008_meal_logs_and_templates.sql</span> no
          Supabase.
        </Card>
      )}

      {/* proteína é a manchete: caloria a balança já estima, proteína não */}
      <div className="rise rise-1 grid grid-cols-2 gap-3">
        <StatCard
          label="Proteína"
          value={totals.proteinaG.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          accent="zone"
          detail={
            target
              ? `${perKg ?? 0} g/kg ${target.basis === "lean" ? "magra" : "peso"} · alvo ${target.mid} g`
              : "registre uma pesagem para ter alvo"
          }
        />
        <StatCard
          label="Calorias"
          value={totals.kcal.toLocaleString("pt-BR")}
          accent="gold"
          detail={`carbo ${formatMacro(totals.carboG, totals.itensSemCarbo)} · gordura ${formatMacro(
            totals.gorduraG,
            totals.itensSemGordura
          )}${totals.alcoolG > 0 ? ` · álcool ${totals.alcoolG} g` : ""}`}
        />
      </div>

      {/* a soma de carbo/gordura só é exata se todo item trouxe os dois */}
      {coverageNote && (
        <p className="rise rise-1 mt-2 text-[11px] leading-relaxed text-gold">{coverageNote}</p>
      )}

      {target && (
        <Card className="rise rise-1 mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] uppercase text-steel-dim">
              Proteína do dia
            </span>
            <span className="font-mono text-[10px] text-steel">
              faixa {target.min}–{target.max} g
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-coal">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                totals.proteinaG >= target.min ? "bg-zone" : "bg-gold"
              )}
              style={{ width: `${Math.round(proteinPct * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-steel-dim">
            {target.basis === "lean"
              ? `Calculado sobre ${target.referenceKg} kg de massa magra da bioimpedância — sobre o peso total o número inflaria.`
              : `Sem composição na base: calculado sobre ${target.referenceKg} kg de peso corporal.`}
          </p>
        </Card>
      )}

      {/* refeições do dia */}
      <SectionTitle accent="ember">Refeições de {dayLabel(dateKey, todayKey)}</SectionTitle>
      <Card className="rise rise-2">
        {meals.length === 0 ? (
          <p className="py-2 text-xs text-steel-dim">
            Nada registrado neste dia. Escolha uma refeição fixa abaixo ou cole o JSON de uma
            refeição diferente.
          </p>
        ) : (
          <div className="-my-1">
            {meals.map((meal, index) => {
              const mealSum = mealTotals(meal.itens)
              return (
                <div
                  key={meal.id}
                  className={cn(
                    "flex items-start gap-2.5 py-2.5",
                    index < meals.length - 1 && "border-b border-seam"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-bone">
                        {meal.nome}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase text-steel-dim">
                        {slotLabel(meal.slot)}
                        {meal.hora ? ` · ${meal.hora}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-steel">
                      <span className="text-zone">{mealSum.proteinaG} g prot</span>
                      {" · "}
                      <span className="text-gold">{mealSum.kcal} kcal</span>
                      {" · "}
                      {meal.itens.length} item(ns)
                      {mealSum.alcoolG > 0 ? ` · ${mealSum.alcoolG} g álcool` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-steel-dim">
                      {meal.itens.map((item) => item.nome).join(", ")}
                    </p>
                    {/* procedência: onde mora a incerteza de uma estimativa */}
                    {(meal.fonte || meal.premissas?.length) && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        {meal.fonte && (
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase",
                              meal.fonte === "foto"
                                ? "border-gold/30 bg-gold/5 text-gold"
                                : "border-seam text-steel-dim"
                            )}
                          >
                            {sourceLabel(meal.fonte)}
                          </span>
                        )}
                        {meal.premissas && meal.premissas.length > 0 && (
                          <span
                            className="rounded-full border border-seam px-1.5 py-0.5 font-mono text-[9px] uppercase text-steel-dim"
                            title={meal.premissas.join(" · ")}
                          >
                            {meal.premissas.length} suposição(ões)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => openRegistered(meal)}
                    disabled={saving || completingDate !== null}
                    className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-bone"
                    aria-label={`Editar ${meal.nome}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleRemoveMeal(meal)}
                    disabled={saving || completingDate !== null}
                    className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-red-400"
                    aria-label={`Remover ${meal.nome}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={() => handleSetComplete(dateKey, !(dayLog?.completo ?? false))}
          disabled={saving || completingDate !== null}
          aria-pressed={dayLog?.completo ?? false}
          className="mt-3 flex w-full items-center gap-2.5 rounded border border-seam bg-coal/60 px-3 py-2.5 text-left transition-colors hover:border-steel-dim disabled:opacity-40"
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
              dayLog?.completo
                ? "border-zone bg-zone text-coal"
                : "border-steel-dim text-transparent"
            )}
          >
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-bone">
              {completingDate === dateKey ? "Salvando…" : "Registrei tudo neste dia"}
            </span>
            <span className="block text-[11px] leading-relaxed text-steel-dim">
              Só dias marcados entram na média de ingestão — um jantar esquecido não pode
              virar &ldquo;comeu pouco&rdquo;.
            </span>
          </span>
        </button>

        {/* Indicador antecedente: sem dias completos, não há o que reconciliar
            contra a ingestão derivada da balança. */}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-coal">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                logCoverage.completos >= logCoverage.windowDays / 2 ? "bg-zone" : "bg-gold"
              )}
              style={{
                width: `${Math.round((logCoverage.completos / logCoverage.windowDays) * 100)}%`,
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-steel-dim">
            <span className="text-bone">{logCoverage.completos}</span> de{" "}
            {logCoverage.windowDays} dias completos
            {logCoverage.comRegistro > logCoverage.completos
              ? ` · ${logCoverage.comRegistro} com registro`
              : ""}
          </span>
        </div>
      </Card>

      {/* onde a alimentação se concentra — funciona já com um dia só */}
      {distribution.length > 0 && (
        <>
          <SectionTitle accent="zone">Distribuição do dia</SectionTitle>
          <Card className="rise rise-2">
            <SlotDistribution shares={distribution} />
            <p className="mt-3 text-[11px] leading-relaxed text-steel-dim">
              As duas barras juntas mostram o que nenhuma delas mostra sozinha: a refeição
              que pesa nas calorias sem entregar proteína aparece com a barra dourada longa
              e a verde curta.
            </p>
          </Card>
        </>
      )}

      {/* a métrica que o app elegeu, no tempo */}
      <SectionTitle accent="zone">Proteína por dia</SectionTitle>
      <Card className="rise rise-3">
        {target ? (
          <>
            <ProteinChart data={proteinDays} min={target.min} max={target.max} />
            <p className="mt-2 text-[11px] leading-relaxed text-steel-dim">
              14 dias contra a faixa de {target.min}–{target.max} g. Barra dourada é dia
              registrado mas não marcado como completo — pode estar curta por jantar
              esquecido, não por ter comido pouco. Toque numa barra para ler o dia.
            </p>
          </>
        ) : (
          <p className="py-2 text-xs text-steel-dim">
            Registre uma pesagem em <b className="text-steel">Medidas</b> para o alvo de
            proteína aparecer aqui.
          </p>
        )}
      </Card>

      {/* cobertura do diário: os buracos são a informação */}
      <CollapsibleSection title="Calendário alimentar" accent="zone" defaultOpen>
        <Card className="rise rise-3">
          <MealCalendar weeks={calendar} onPickDay={saving || completingDate !== null ? undefined : openDay} />
          <p className="mt-3 text-[11px] leading-relaxed text-steel-dim">
            Toque num dia registrado para abri-lo acima. Verde é dia completo — só esses
            entram na média de ingestão quando a reconciliação com a balança existir.
          </p>
        </Card>
      </CollapsibleSection>

      {/* refeições fixas: o caminho de dois toques */}
      <SectionTitle accent="ember">Refeições fixas</SectionTitle>
      {templates.length === 0 ? (
        <Card className="rise rise-3 text-xs text-steel-dim">
          Nenhuma refeição fixa ainda. Cole o JSON de uma refeição abaixo e use{" "}
          <span className="text-zone">Salvar como fixa</span> — ela passa a aparecer aqui
          para registrar em dois toques.
        </Card>
      ) : (
        <div className="rise rise-3 space-y-3">
          {MEAL_SLOTS.filter((slot) => (templatesBySlot.get(slot.id) ?? []).length > 0).map(
            (slot) => (
              <Card key={slot.id}>
                <p
                  className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel"
                  style={{ fontFamily: "var(--font-condensed)" }}
                >
                  {slot.label}
                </p>
                <div className="space-y-1.5">
                  {(templatesBySlot.get(slot.id) ?? []).map((template) => {
                    const sum = mealTotals(template.itens)
                    return (
                      <button
                        key={template.id}
                        onClick={() => openTemplate(template)}
                        className="flex w-full items-center gap-2.5 rounded border border-seam bg-coal/60 px-3 py-2.5 text-left transition-colors hover:border-ember"
                      >
                        <UtensilsCrossed size={15} className="shrink-0 text-ember" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-bone">
                            {template.nome}
                          </span>
                          <span className="block font-mono text-[10px] text-steel-dim">
                            <span className="text-zone">{sum.proteinaG} g prot</span>
                            {" · "}
                            <span className="text-gold">{sum.kcal} kcal</span>
                            {" · "}
                            {template.itens.length} item(ns)
                          </span>
                        </span>
                        <ChevronRight size={15} className="shrink-0 text-steel-dim" />
                      </button>
                    )
                  })}
                </div>
              </Card>
            )
          )}
        </div>
      )}

      {/* refeição diferente: JSON determinístico, no espírito do CSV da balança */}
      <SectionTitle accent="zone">Refeição diferente</SectionTitle>
      <Card className="rise rise-4 border-l-4 border-l-zone">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-steel-dim">
            Gere o JSON na sua gem e cole aqui. Confira no compositor antes de registrar —
            e, se for repetir, salve como refeição fixa.
          </p>
          <FileUp size={19} className="mt-0.5 shrink-0 text-zone" />
        </div>

        <label className="mt-3 flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-steel-dim">Arquivo JSON</span>
          <input
            type="file"
            accept=".json,application/json,text/plain"
            onChange={(event) => loadJsonFile(event.target.files?.[0])}
            className="w-full rounded border border-seam bg-coal px-2 py-2 text-xs text-steel file:mr-3 file:rounded file:border-0 file:bg-zone file:px-3 file:py-1.5 file:font-semibold file:text-coal"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-steel-dim">Ou cole o JSON</span>
          <textarea
            value={jsonText}
            onChange={(event) => replaceJsonText(event.target.value)}
            rows={7}
            placeholder={JSON_PLACEHOLDER}
            className="w-full resize-y rounded border border-seam bg-coal px-2.5 py-2 font-mono text-xs text-bone outline-none focus:border-zone"
          />
        </label>

        {parse && parse.errors.length > 0 && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-400">
            {parse.errors.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
          </div>
        )}

        {parse && parse.entries.length > 0 && (
          <div className="mt-3 space-y-2">
            {parse.entries.map((entry) => {
              const registrada = registeredIdx.has(entry.index)
              const marcada = !excludedIdx.has(entry.index) && !registrada
              const sum = entry.meal ? mealTotals(entry.meal.itens) : null
              return (
                <div
                  key={entry.index}
                  className={cn(
                    "rounded border px-3 py-2.5 transition-colors",
                    !entry.meal
                      ? "border-amber-500/30 bg-amber-500/5"
                      : registrada
                        ? "border-zone/30 bg-zone/5"
                        : marcada
                          ? "border-seam bg-coal/70"
                          : "border-seam/50 bg-coal/30 opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {entry.meal && (
                      <button
                        type="button"
                        onClick={() => !registrada && toggleBatchRow(entry.index)}
                        disabled={registrada}
                        aria-pressed={marcada}
                        aria-label={`${marcada ? "Desmarcar" : "Marcar"} ${entry.meal.nome}`}
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          registrada
                            ? "border-zone bg-zone text-coal"
                            : marcada
                              ? "border-ember bg-ember text-coal"
                              : "border-steel-dim text-transparent"
                        )}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-bone">
                          {entry.meal?.nome ?? `Refeição ${entry.index + 1}`}
                        </p>
                        <span className="shrink-0 font-mono text-[10px] uppercase text-steel-dim">
                          {entry.meal ? slotLabel(entry.meal.slot) : "ilegível"}
                          {entry.meal?.hora ? ` · ${entry.meal.hora}` : ""}
                          {entry.meal?.fonte ? (
                            <span className={entry.meal.fonte === "foto" ? "text-gold" : undefined}>
                              {" · "}
                              {sourceLabel(entry.meal.fonte)}
                            </span>
                          ) : null}
                        </span>
                      </div>

                      {entry.meal && sum && (
                        <>
                          <p className="mt-1 font-mono text-[11px] text-steel">
                            <span className="text-zone">{sum.proteinaG} g prot</span>
                            {" · "}
                            <span className="text-gold">{sum.kcal} kcal</span>
                            {" · "}
                            {entry.meal.itens.length} item(ns)
                            {" · "}
                            <span className={entry.meal.date ? "text-bone" : undefined}>
                              {dayLabel(entry.meal.date ?? dateKey, todayKey)}
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-steel-dim">
                            {entry.meal.itens.map((item) => item.nome).join(", ")}
                          </p>
                        </>
                      )}

                      {entry.errors.map((message, index) => (
                        <p key={index} className="mt-1 text-[11px] leading-relaxed text-amber-400">
                          {message}
                        </p>
                      ))}
                      {entry.warnings.map((warning, index) => (
                        <p key={index} className="mt-1 text-[11px] leading-relaxed text-gold">
                          {warning}
                        </p>
                      ))}
                    </div>

                    {entry.meal && !registrada && (
                      <button
                        onClick={() => openBatchEntry(entry)}
                        className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-bone"
                        aria-label={`Conferir ${entry.meal.nome}`}
                        title="Conferir e ajustar antes de registrar"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {failedCount > 0 && (
              <p className="text-[11px] leading-relaxed text-amber-400">
                {failedCount} de {parse.entries.length} não puderam ser lidas e ficam de fora
                do lote.
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleRegisterBatch}
          disabled={saving || completingDate !== null || pendingBatch.length === 0}
          className="mt-3 flex items-center gap-1.5 rounded bg-ember px-4 py-2 text-sm font-bold uppercase tracking-wider text-coal transition-colors hover:bg-ember-hot disabled:opacity-40"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          <Plus size={15} />
          {saving
            ? "Registrando…"
            : pendingBatch.length <= 1
              ? "Registrar refeição"
              : `Registrar ${pendingBatch.length} refeições`}
        </button>

        {fileError && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {fileError}
          </p>
        )}

        <p className="mt-2.5 text-[11px] leading-relaxed text-steel-dim">
          Um lote pode cobrir vários dias: cada refeição vai para a própria data quando o JSON
          traz uma, e para o dia selecionado quando não traz. O lápis abre a refeição para
          conferir antes de gravar. Os macros vêm da gem e valem para a porção informada, nunca
          por 100 g — o app confere o que é fisicamente impossível (densidade acima de óleo
          puro, proteína maior que a massa do alimento, kcal que não fecha com 4/4/9) e avisa
          antes de você salvar.
        </p>
      </Card>

      <CollapsibleSection
        title="Gerenciar refeições fixas"
        accent="steel"
        badge={templates.length}
      >
        {templates.length === 0 ? (
          <Card className="text-xs text-steel-dim">Nenhuma refeição fixa salva.</Card>
        ) : (
          <Card>
            <div className="-my-1">
              {templates.map((template, index) => {
                const sum = mealTotals(template.itens)
                return (
                  <div
                    key={template.id}
                    className={cn(
                      "flex items-center gap-2.5 py-2.5",
                      index < templates.length - 1 && "border-b border-seam"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-bone">{template.nome}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
                        {slotLabel(template.slot)} · {sum.kcal} kcal · {sum.proteinaG} g prot
                      </p>
                    </div>
                    <button
                      onClick={() => openTemplate(template)}
                      className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-bone"
                      aria-label={`Editar ${template.nome}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setTemplateToDelete(template)}
                      className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-red-400"
                      aria-label={`Excluir ${template.nome}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-steel-dim">
              Editar abre o compositor: ajuste e use <span className="text-zone">Atualizar
              refeição fixa</span>. O molde vale para os próximos dias — nenhum registro
              anterior é reescrito.
            </p>
          </Card>
        )}
      </CollapsibleSection>

        </>
      )}

      <MealComposer
        seed={seed}
        saving={saving || completingDate !== null}
        onClose={() => setSeed(null)}
        onRegister={handleRegister}
        onSaveTemplate={handleSaveTemplate}
      />

      <ConfirmDialog
        open={templateToDelete !== null}
        title="Excluir refeição fixa"
        message={`"${templateToDelete?.nome ?? ""}" some da lista de fixas. Os dias já registrados com ela continuam intactos.`}
        onConfirm={handleDeleteTemplate}
        onCancel={() => setTemplateToDelete(null)}
      />

      {undoMeal && (
        <UndoToast
          message={`${undoMeal.meal.nome} removida de ${dayLabel(undoMeal.date, todayKey)}`}
          onUndo={() => {
            const restore = undoMeal
            setUndoMeal(null)
            addMeal(restore.meal, restore.date).catch((e) =>
              setPageError(e instanceof Error ? e.message : "Erro ao restaurar a refeição")
            )
          }}
          onDismiss={() => setUndoMeal(null)}
        />
      )}

      {flash && (
        <div
          className="fixed inset-x-0 z-[60] flex justify-center px-4"
          style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
          role="status"
        >
          <div className="w-full max-w-md rounded-lg border border-zone/30 bg-iron/95 px-3 py-2.5 text-xs text-zone shadow-[0_6px_24px_rgba(0,0,0,0.5)] backdrop-blur md:max-w-xl">
            {flash}
          </div>
        </div>
      )}
    </main>
  )
}
