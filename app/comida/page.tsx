"use client"

import { useMemo, useState } from "react"
import {
  Check,
  ChevronRight,
  FileUp,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react"
import { MealComposer, MealSeed } from "@/components/meal-composer"
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
  MEAL_SLOTS,
  mealTotals,
  parseMealJson,
  proteinPerKg,
  proteinTarget,
  slotLabel,
  slotOrder,
  slugify,
} from "@/lib/nutrition"
import { useGymData } from "@/lib/store"
import { useMealTemplates } from "@/lib/use-meal-templates"
import { useOperationalDay } from "@/lib/use-operational-day"
import { Meal, MealItem, MealLog, MealSlot, MealTemplate } from "@/lib/types"
import { cn, fromDateKey, toDateKey, toOperationalDateKey } from "@/lib/utils"

const JSON_PLACEHOLDER = `{"nome":"Almoço no restaurante","refeicao":"almoco","itens":[
{"nome":"Arroz branco cozido","qtd":2,"unidade":"concha","gramas":200,"kcal":257,"proteinaG":5.0,"carboG":56.2,"gorduraG":0.4},
{"nome":"Contrafilé grelhado","qtd":1,"unidade":"filé","gramas":150,"kcal":289,"proteinaG":47.3,"carboG":0,"gorduraG":10.4}]}`

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

  const [seed, setSeed] = useState<MealSeed | null>(null)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const [jsonText, setJsonText] = useState("")
  const [fileError, setFileError] = useState<string | null>(null)

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
  const proteinPct = target && target.mid > 0 ? Math.min(1, totals.proteinaG / target.mid) : 0

  const parse = useMemo(() => (jsonText.trim() ? parseMealJson(jsonText) : null), [jsonText])

  const templatesBySlot = useMemo(() => {
    const map = new Map<MealSlot, MealTemplate[]>()
    for (const template of templates ?? []) {
      const list = map.get(template.slot) ?? []
      list.push(template)
      map.set(template.slot, list)
    }
    return map
  }, [templates])

  const recentDays = useMemo(
    () =>
      [...(data?.meals ?? [])]
        .filter((day) => day.refeicoes.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14),
    [data]
  )

  const showFlash = (message: string) => {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 3000)
  }

  const loadJsonFile = async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    try {
      setJsonText(await file.text())
    } catch {
      setFileError("Não foi possível ler o arquivo.")
    }
  }

  const openTemplate = (template: MealTemplate) => {
    setPageError(null)
    setSeed({
      nome: template.nome,
      slot: template.slot,
      itens: template.itens,
      templateId: template.id,
      origem: "fixa",
    })
  }

  const openParsedJson = () => {
    if (!parse?.meal) return
    setPageError(null)
    if (parse.meal.date) setSelectedDate(parse.meal.date)
    setSeed({
      nome: parse.meal.nome,
      slot: parse.meal.slot,
      itens: parse.meal.itens,
      premissas: parse.meal.premissas,
      hora: parse.meal.hora,
      origem: "json",
    })
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
      origem: "registro",
    })
  }

  const handleRegister = async (meal: Meal) => {
    const editing = seed?.origem === "registro"
    const fromJson = seed?.origem === "json"
    setSaving(true)
    try {
      if (editing) await replaceMeal(meal, dateKey)
      else await addMeal(meal, dateKey)
      setSeed(null)
      if (fromJson) setJsonText("")
      showFlash(editing ? "Refeição atualizada." : `${meal.nome} registrada.`)
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
    setPageError(null)
    try {
      await removeMeal(meal.id, dateKey)
      setUndoMeal({ meal, date: dateKey })
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao remover a refeição")
    }
  }

  const handleToggleComplete = async () => {
    setPageError(null)
    try {
      await setMealDayComplete(dateKey, !(dayLog?.completo ?? false))
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao marcar o dia")
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
        right={
          <input
            type="date"
            value={dateKey}
            max={todayKey}
            onChange={(event) => setSelectedDate(event.target.value || null)}
            className="rounded border border-seam bg-coal px-2 py-1.5 font-mono text-[11px] text-steel outline-none focus:border-ember"
            aria-label="Dia do registro"
          />
        }
      />

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
          detail={`carbo ${totals.carboG} g · gordura ${totals.gorduraG} g`}
        />
      </div>

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
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-steel-dim">
                      {meal.itens.map((item) => item.nome).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => openRegistered(meal)}
                    className="shrink-0 rounded p-1.5 text-steel-dim transition-colors hover:text-bone"
                    aria-label={`Editar ${meal.nome}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleRemoveMeal(meal)}
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
          onClick={handleToggleComplete}
          aria-pressed={dayLog?.completo ?? false}
          className="mt-3 flex w-full items-center gap-2.5 rounded border border-seam bg-coal/60 px-3 py-2.5 text-left transition-colors hover:border-steel-dim"
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
              Registrei tudo neste dia
            </span>
            <span className="block text-[11px] leading-relaxed text-steel-dim">
              Só dias marcados entram na média de ingestão — um jantar esquecido não pode
              virar &ldquo;comeu pouco&rdquo;.
            </span>
          </span>
        </button>
      </Card>

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
            onChange={(event) => {
              setJsonText(event.target.value)
              setFileError(null)
            }}
            rows={7}
            placeholder={JSON_PLACEHOLDER}
            className="w-full resize-y rounded border border-seam bg-coal px-2.5 py-2 font-mono text-xs text-bone outline-none focus:border-zone"
          />
        </label>

        {parse && (
          <div className="mt-3 space-y-2">
            {parse.meal && (
              <div className="rounded border border-seam bg-coal/70 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-bone">{parse.meal.nome}</p>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-steel-dim">
                    {slotLabel(parse.meal.slot)}
                    {parse.meal.date ? ` · ${shortDate(parse.meal.date)}` : ""}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-steel">
                  <span className="text-zone">{mealTotals(parse.meal.itens).proteinaG} g prot</span>
                  {" · "}
                  <span className="text-gold">{mealTotals(parse.meal.itens).kcal} kcal</span>
                  {" · "}
                  {parse.meal.itens.length} item(ns)
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-steel-dim">
                  {parse.meal.itens.map((item) => item.nome).join(", ")}
                </p>
              </div>
            )}

            {parse.warnings.map((warning, index) => (
              <p key={index} className="text-xs leading-relaxed text-gold">
                {warning}
              </p>
            ))}

            {parse.errors.length > 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-400">
                {parse.errors.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={openParsedJson}
          disabled={!parse?.meal}
          className="mt-3 flex items-center gap-1.5 rounded bg-ember px-4 py-2 text-sm font-bold uppercase tracking-wider text-coal transition-colors hover:bg-ember-hot disabled:opacity-40"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          <Plus size={15} />
          Conferir e registrar
        </button>

        {fileError && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {fileError}
          </p>
        )}

        <p className="mt-2.5 text-[11px] leading-relaxed text-steel-dim">
          Os macros vêm da gem e valem para a porção informada, nunca por 100 g. O app confere
          o que é fisicamente impossível (densidade acima de óleo puro, proteína maior que a
          massa do alimento, kcal que não fecha com 4/4/9) e avisa antes de você salvar.
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

      <CollapsibleSection title="Últimos dias" accent="steel" badge={recentDays.length}>
        {recentDays.length === 0 ? (
          <Card className="text-xs text-steel-dim">Nenhum dia registrado ainda.</Card>
        ) : (
          <Card>
            <div className="-my-1">
              {recentDays.map((day, index) => {
                const sum = dayTotals(day)
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-2.5 text-left transition-colors hover:text-bone",
                      index < recentDays.length - 1 && "border-b border-seam"
                    )}
                  >
                    <span className="w-16 shrink-0 font-mono text-[11px] text-steel">
                      {dayLabel(day.date, todayKey)}
                    </span>
                    <span className="min-w-0 flex-1 font-mono text-[11px] text-steel-dim">
                      <span className="text-zone">{sum.proteinaG} g</span>
                      {" · "}
                      <span className="text-gold">{sum.kcal} kcal</span>
                      {" · "}
                      {day.refeicoes.length} refeição(ões)
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase",
                        day.completo
                          ? "border-zone/30 bg-zone/5 text-zone"
                          : "border-seam text-steel-dim"
                      )}
                    >
                      {day.completo ? "completo" : "parcial"}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>
        )}
      </CollapsibleSection>

      {pageError && (
        <p className="mt-4 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {pageError}
        </p>
      )}

      <MealComposer
        seed={seed}
        saving={saving}
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
