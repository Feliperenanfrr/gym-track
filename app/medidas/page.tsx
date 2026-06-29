"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, Check, Moon, Plus } from "lucide-react"
import {
  BodyFatChart,
  CompositionChart,
  HydrationChart,
  SleepChart,
  WeightChart,
  WaistChart,
} from "@/components/charts"
import { Card, PageHeader, SectionTitle, Skeleton, StatCard } from "@/components/ui"
import { parseBioimpedanceCsv, toBodyLog } from "@/lib/bioimpedance"
import { waterGoalMl } from "@/lib/insights"
import {
  computeSleepMetrics,
  formatSleepDuration,
  minutesToSleepInput,
  parseSleepHours,
  sleepDurationMinutes,
} from "@/lib/sleep"
import { useGymData } from "@/lib/store"
import { useOperationalDay } from "@/lib/use-operational-day"
import { cn, fromDateKey, toDateKey, toOperationalDateKey } from "@/lib/utils"

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function MedidasPage() {
  const { data, addBodyLog, addSleepLog } = useGymData()
  const today = useOperationalDay()
  const [weight, setWeight] = useState("")
  const [waist, setWaist] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sleepStart, setSleepStart] = useState("")
  const [sleepEnd, setSleepEnd] = useState("")
  const [sleepHours, setSleepHours] = useState("")
  const [sleepLoadedDate, setSleepLoadedDate] = useState<string | null>(null)
  const [sleepSaved, setSleepSaved] = useState(false)
  const [sleepSaving, setSleepSaving] = useState(false)
  const [sleepError, setSleepError] = useState<string | null>(null)
  const [bioText, setBioText] = useState("")
  const [bioSaving, setBioSaving] = useState(false)
  const [bioSaved, setBioSaved] = useState(false)
  const [bioError, setBioError] = useState<string | null>(null)

  const bioParse = useMemo(
    () => (bioText.trim() ? parseBioimpedanceCsv(bioText) : null),
    [bioText]
  )

  const view = useMemo(() => {
    if (!data || !today) return null
    const body = data.body
    const current = body[body.length - 1]
    const first = body[0]
    const weightDelta = current && first ? current.weightKg - first.weightKg : null
    const waists = body.filter((b) => b.waistCm !== undefined)
    const currentWaist = waists[waists.length - 1]?.waistCm
    const firstWaist = waists[0]?.waistCm
    const waistDelta =
      currentWaist !== undefined && firstWaist !== undefined
        ? currentWaist - firstWaist
        : null
    const chart = body.map((b) => ({ label: shortDate(b.date), peso: b.weightKg }))
    const waistChart = waists.map((b) => ({ label: shortDate(b.date), cintura: b.waistCm! }))
    // bioimpedância: primeiro vs. último registro que tem cada métrica
    const bioDelta = (key: "bodyFatPct" | "fatMassKg" | "skeletalMuscleKg" | "visceralFat") => {
      const series = body.filter((b) => b[key] !== undefined)
      if (series.length < 2) return null
      return (series[series.length - 1][key] as number) - (series[0][key] as number)
    }
    const withBio = body.filter((b) => b.bodyFatPct !== undefined || b.fatMassKg !== undefined)
    const latestBio = withBio.length ? withBio[withBio.length - 1] : undefined
    const compositionChart = body
      .filter((b) => b.fatMassKg !== undefined && b.skeletalMuscleKg !== undefined)
      .map((b) => ({
        label: shortDate(b.date),
        gordura: b.fatMassKg!,
        musculo: b.skeletalMuscleKg!,
      }))
    const bodyFatChart = body
      .filter((b) => b.bodyFatPct !== undefined)
      .map((b) => ({ label: shortDate(b.date), gordura: b.bodyFatPct! }))
    // metas do plano calculadas pelo peso atual (1,8–2,2 g/kg; 35–40 ml/kg)
    const kg = current?.weightKg ?? 93
    // água dos últimos 7 dias (dias sem registro = 0, sinceridade > vaidade)
    const now = today
    const hydration7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
      const key = toDateKey(d)
      return {
        label: shortDate(key),
        ml: data.hydration.find((h) => h.date === key)?.ml ?? 0,
      }
    })
    const sleepMetrics = computeSleepMetrics(data.sleep, now)
    const sleep7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
      const key = toDateKey(d)
      const log = data.sleep.find((s) => s.date === key)
      return {
        label: shortDate(key),
        hours: log ? Math.round((log.durationMin / 60) * 10) / 10 : null,
      }
    })
    return {
      hydration7,
      sleep7,
      sleepMetrics,
      waterGoal: waterGoalMl(body),
      current,
      weightDelta,
      currentWaist,
      waistDelta,
      chart,
      waistChart,
      latestBio,
      compositionChart,
      bodyFatChart,
      bodyFatDelta: bioDelta("bodyFatPct"),
      fatMassDelta: bioDelta("fatMassKg"),
      muscleDelta: bioDelta("skeletalMuscleKg"),
      visceralDelta: bioDelta("visceralFat"),
      protein: [Math.round(kg * 1.8), Math.round(kg * 2.2)],
      water: [(kg * 0.035).toFixed(1), (kg * 0.04).toFixed(1)],
      recent: [...body].reverse().slice(0, 8),
      recentSleep: [...data.sleep].reverse().slice(0, 8),
    }
  }, [data, today])

  useEffect(() => {
    if (!data || !today) return
    const todayKey = toDateKey(today)
    if (sleepLoadedDate === todayKey) return
    const todaySleep = data.sleep.find((s) => s.date === todayKey)
    if (todaySleep) {
      setSleepStart(todaySleep.sleptAt)
      setSleepEnd(todaySleep.wokeAt)
      setSleepHours(minutesToSleepInput(todaySleep.durationMin))
    } else {
      setSleepStart("23:30")
      setSleepEnd("07:30")
      setSleepHours("8,0")
    }
    setSleepLoadedDate(todayKey)
  }, [data, sleepLoadedDate, today])

  if (!view) {
    return (
      <main>
        <PageHeader kicker="RECOMPOSIÇÃO CORPORAL" title="Medidas" />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="h-24"><Skeleton className="h-full w-full" /></Card>
          <Card className="h-24"><Skeleton className="h-full w-full" /></Card>
        </div>
        <Card className="h-40"><Skeleton className="h-full w-full" /></Card>
      </main>
    )
  }

  const handleSave = async () => {
    const w = parseFloat(weight.replace(",", "."))
    if (isNaN(w) || w <= 0) return
    const wa = parseFloat(waist.replace(",", "."))
    setSaving(true)
    setSaveError(null)
    try {
      await addBodyLog({
        date: toOperationalDateKey(new Date()),
        weightKg: Math.round(w * 10) / 10,
        waistCm: !isNaN(wa) && wa > 0 ? Math.round(wa * 10) / 10 : undefined,
      })
      setWeight("")
      setWaist("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar no banco")
    } finally {
      setSaving(false)
    }
  }

  const handleBioSave = async () => {
    if (!bioParse) return
    const log = toBodyLog(bioParse.values, toOperationalDateKey(new Date()))
    if (!log) {
      setBioError("Peso não encontrado no texto — é obrigatório para salvar.")
      return
    }
    setBioSaving(true)
    setBioError(null)
    try {
      await addBodyLog(log)
      setBioText("")
      setBioSaved(true)
      setTimeout(() => setBioSaved(false), 2500)
    } catch (e) {
      setBioError(e instanceof Error ? e.message : "Erro ao salvar no banco")
    } finally {
      setBioSaving(false)
    }
  }

  const syncSleepHours = (start: string, end: string) => {
    const duration = sleepDurationMinutes(start, end)
    if (duration !== null) setSleepHours(minutesToSleepInput(duration))
  }

  const handleSleepStartChange = (value: string) => {
    setSleepStart(value)
    if (value && sleepEnd) syncSleepHours(value, sleepEnd)
  }

  const handleSleepEndChange = (value: string) => {
    setSleepEnd(value)
    if (sleepStart && value) syncSleepHours(sleepStart, value)
  }

  const handleSleepSave = async () => {
    if (!sleepStart || !sleepEnd) {
      setSleepError("Informe a hora que dormiu e a hora que acordou.")
      return
    }
    const durationFromHours = sleepHours.trim() ? parseSleepHours(sleepHours) : null
    if (sleepHours.trim() && durationFromHours === null) {
      setSleepError("Horas dormidas precisa ficar entre 0 e 18 h.")
      return
    }
    const durationFromTimes = sleepDurationMinutes(sleepStart, sleepEnd)
    const durationMin = durationFromHours ?? durationFromTimes
    if (durationMin === null || durationMin <= 0 || durationMin > 18 * 60) {
      setSleepError("Revise os horários ou a duração do sono.")
      return
    }

    setSleepSaving(true)
    setSleepError(null)
    try {
      await addSleepLog({
        date: toOperationalDateKey(new Date()),
        sleptAt: sleepStart,
        wokeAt: sleepEnd,
        durationMin,
      })
      setSleepSaved(true)
      setTimeout(() => setSleepSaved(false), 2500)
    } catch (e) {
      setSleepError(e instanceof Error ? e.message : "Erro ao salvar sono no banco")
    } finally {
      setSleepSaving(false)
    }
  }

  const fmtDelta = (d: number | null, unit: string) =>
    d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")} ${unit} desde o início`

  const fmt1 = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <main>
      <PageHeader kicker="RECOMPOSIÇÃO CORPORAL" title="Medidas" />

      <div className="rise rise-1 grid grid-cols-2 gap-3">
        <StatCard
          label="Peso"
          value={
            view.current
              ? view.current.weightKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })
              : "—"
          }
          detail={fmtDelta(view.weightDelta, "kg")}
          accent="gold"
        />
        <StatCard
          label="Cintura"
          value={
            view.currentWaist !== undefined
              ? `${view.currentWaist.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}`
              : "—"
          }
          detail={fmtDelta(view.waistDelta, "cm")}
          accent="steel"
        />
      </div>

      <SectionTitle accent="steel">Tendência de peso</SectionTitle>
      <Card className="rise rise-2 mb-6">
        <WeightChart data={view.chart} />
        <p className="mt-2 font-mono text-[10px] text-steel-dim">
          alvo do plano: −0,4 a −0,7 kg/semana · lento e sustentável preserva músculo
        </p>
      </Card>

      {view.waistChart.length > 0 && (
        <>
          <SectionTitle accent="steel">Evolução de cintura</SectionTitle>
          <Card className="rise rise-2 mb-6 border-l-4 border-l-[#818cf8]">
            <WaistChart data={view.waistChart} />
            <p className="mt-2 font-mono text-[10px] text-steel-dim">
              redução na cintura é um forte indicativo de perda de gordura
            </p>
          </Card>
        </>
      )}

      {view.latestBio && (
        <>
          <SectionTitle accent="ember">Composição corporal</SectionTitle>
          <div className="rise rise-2 grid grid-cols-2 gap-3">
            <StatCard
              label="Gordura"
              value={
                <>
                  {fmt1(view.latestBio.bodyFatPct)}
                  <span className="text-base text-steel-dim"> %</span>
                </>
              }
              detail={fmtDelta(view.bodyFatDelta, "%")}
              accent="ember"
            />
            <StatCard
              label="Gordura"
              value={
                <>
                  {fmt1(view.latestBio.fatMassKg)}
                  <span className="text-base text-steel-dim"> kg</span>
                </>
              }
              detail={fmtDelta(view.fatMassDelta, "kg")}
              accent="ember"
            />
            <StatCard
              label="Músculo esq."
              value={
                <>
                  {fmt1(view.latestBio.skeletalMuscleKg)}
                  <span className="text-base text-steel-dim"> kg</span>
                </>
              }
              detail={fmtDelta(view.muscleDelta, "kg")}
              accent="zone"
            />
            <StatCard
              label="Visceral"
              value={fmt1(view.latestBio.visceralFat)}
              detail={
                view.visceralDelta === null
                  ? "índice da balança (alvo < 10)"
                  : fmtDelta(view.visceralDelta, "pts")
              }
              accent="gold"
            />
          </div>

          {view.compositionChart.length > 0 && (
            <Card className="rise rise-3 mt-3 border-l-4 border-l-[#2dd4bf]">
              <CompositionChart data={view.compositionChart} />
              <p className="mt-2 font-mono text-[10px] text-steel-dim">
                <span style={{ color: "#fb7185" }}>gordura</span> ↓ +{" "}
                <span style={{ color: "#2dd4bf" }}>músculo</span> estável/↑ = recomposição
                funcionando
              </p>
            </Card>
          )}

          {view.bodyFatChart.length > 1 && (
            <Card className="rise rise-3 mb-6 mt-3 border-l-4 border-l-[#fb7185]">
              <BodyFatChart data={view.bodyFatChart} />
              <p className="mt-2 font-mono text-[10px] text-steel-dim">
                leia a tendência, não o ponto — bioimpedância oscila com hidratação
              </p>
            </Card>
          )}
        </>
      )}

      <SectionTitle accent="steel">Sono e recuperação</SectionTitle>
      <div className="rise rise-3 grid grid-cols-2 gap-3">
        <StatCard
          label="Última noite"
          value={formatSleepDuration(view.sleepMetrics.latest?.durationMin)}
          detail={
            view.sleepMetrics.latest
              ? `${view.sleepMetrics.latest.sleptAt} → ${view.sleepMetrics.latest.wokeAt}`
              : "registre abaixo"
          }
          accent="steel"
        />
        <StatCard
          label="Média 7d"
          value={formatSleepDuration(view.sleepMetrics.avg7Min)}
          detail={`${view.sleepMetrics.registered7}/7 noites registradas`}
          accent="gold"
        />
        <StatCard
          label="Dívida 7d"
          value={formatSleepDuration(view.sleepMetrics.debt7Min)}
          detail="contra meta de 8h/noite registrada"
          accent="ember"
        />
        <StatCard
          label="Regularidade"
          value={view.sleepMetrics.consistency.label}
          detail={view.sleepMetrics.consistency.detail}
          accent={
            view.sleepMetrics.consistency.label === "Estável"
              ? "zone"
              : view.sleepMetrics.consistency.label === "Ok"
                ? "gold"
                : "steel"
          }
        />
      </div>

      <Card className="rise rise-3 mt-3 border-l-4 border-l-[#a78bfa]">
        <SleepChart data={view.sleep7} />
        <p className="mt-2 font-mono text-[10px] text-steel-dim">
          média: {formatSleepDuration(view.sleepMetrics.avg7Min)}
          {view.sleepMetrics.avgBedtime &&
            view.sleepMetrics.avgWake &&
            ` · janela média ${view.sleepMetrics.avgBedtime} → ${view.sleepMetrics.avgWake}`}
        </p>
      </Card>

      <SectionTitle accent="steel">Registrar sono</SectionTitle>
      <Card className="rise rise-3 border-l-4 border-l-[#a78bfa]">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Dormi às</span>
            <input
              type="time"
              value={sleepStart}
              onChange={(e) => handleSleepStartChange(e.target.value)}
              className="w-28 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-[#a78bfa]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Acordei às</span>
            <input
              type="time"
              value={sleepEnd}
              onChange={(e) => handleSleepEndChange(e.target.value)}
              className="w-28 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-[#a78bfa]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Horas</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="7,5"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              className="w-24 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-[#a78bfa]"
            />
          </label>
          <button
            onClick={handleSleepSave}
            disabled={sleepSaving}
            className={cn(
              "flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-60",
              sleepSaved ? "bg-zone text-coal" : "bg-[#a78bfa] text-coal hover:bg-[#c4b5fd]"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {sleepSaved ? <Check size={15} /> : <Moon size={15} />}
            {sleepSaving ? "Salvando…" : sleepSaved ? "Salvo" : "Salvar"}
          </button>
        </div>
        {sleepError && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {sleepError}
          </p>
        )}
        <p className="mt-2.5 text-[11px] text-steel-dim">
          O registro fica no dia em que você acordou.
        </p>
      </Card>

      <SectionTitle>Registrar hoje</SectionTitle>
      <Card className="rise rise-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">Peso (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="91,2"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-28 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">
              Cintura (cm) — opcional
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="98,0"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              className="w-28 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-gold"
            />
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-60",
              saved ? "bg-zone text-coal" : "bg-gold text-coal hover:bg-gold/85"
            )}
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {saved ? <Check size={15} /> : <Plus size={15} />}
            {saving ? "Salvando…" : saved ? "Salvo" : "Salvar"}
          </button>
        </div>
        {saveError && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {saveError}
          </p>
        )}
        <p className="mt-2.5 text-[11px] text-steel-dim">
          Pese-se sempre na mesma condição: de manhã, em jejum, depois do banheiro.
        </p>
      </Card>

      <SectionTitle accent="ember">Registrar bioimpedância</SectionTitle>
      <Card className="rise rise-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase text-steel-dim">
            Cole o resultado exportado da balança (CSV)
          </span>
          <textarea
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            rows={6}
            placeholder={"Peso,93.95,kg\nGordura corporal,30.2,%\nPeso da gordura,28.4,kg\n…"}
            className="w-full resize-y rounded border border-seam bg-coal px-2.5 py-2 font-mono text-xs text-bone outline-none focus:border-ember"
          />
        </label>

        {bioParse && (
          <div className="mt-3">
            {bioParse.recognized.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bioParse.recognized.map((r) => (
                  <span
                    key={r.field}
                    className="rounded border border-seam bg-coal px-2 py-1 font-mono text-[10px] text-steel"
                  >
                    <span className="text-steel-dim">{r.label}:</span>{" "}
                    <span className="text-bone">
                      {typeof r.value === "number"
                        ? r.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                        : r.value}
                      {r.unit ? ` ${r.unit}` : ""}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-steel-dim">
              Será salvo na data{" "}
              <span className="text-bone">{bioParse.values.date ?? "de hoje"}</span>
              {bioParse.ignored.length > 0 &&
                ` · ${bioParse.ignored.length} campo(s) ignorado(s)`}
            </p>
            {bioParse.errors.length > 0 && (
              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                {bioParse.errors.map((er, i) => (
                  <p key={i}>{er}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleBioSave}
          disabled={bioSaving || !bioParse || bioParse.values.weightKg === undefined}
          className={cn(
            "mt-3 flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
            bioSaved ? "bg-zone text-coal" : "bg-ember text-coal hover:bg-ember/85"
          )}
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          {bioSaved ? <Check size={15} /> : <Activity size={15} />}
          {bioSaving ? "Salvando…" : bioSaved ? "Salvo" : "Salvar bioimpedância"}
        </button>
        {bioError && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {bioError}
          </p>
        )}
        <p className="mt-2.5 text-[11px] text-steel-dim">
          Guarda peso, % gordura, gordura (kg), músculo, água, visceral e metabolismo de
          uma pesagem só. Confira o preview antes de salvar.
        </p>
      </Card>

      <SectionTitle accent="steel">Metas diárias (pelo peso atual)</SectionTitle>
      <div className="rise rise-4 grid grid-cols-2 gap-3">
        <StatCard
          label="Proteína"
          value={
            <>
              {view.protein[0]}–{view.protein[1]}
              <span className="text-base text-steel-dim"> g</span>
            </>
          }
          detail="1,8–2,2 g/kg — protege músculo no déficit"
        />
        <StatCard
          label="Água"
          value={
            <>
              {String(view.water[0]).replace(".", ",")}–{String(view.water[1]).replace(".", ",")}
              <span className="text-base text-steel-dim"> L</span>
            </>
          }
          detail="35–40 ml/kg — desidratação piora fôlego"
          accent="zone"
        />
      </div>

      <SectionTitle accent="zone">Água — últimos 7 dias</SectionTitle>
      <Card className="rise rise-4 mb-6 border-l-4 border-l-[#38bdf8]">
        <HydrationChart data={view.hydration7} target={view.waterGoal} />
        <p className="mt-2 font-mono text-[10px] text-steel-dim">
          registre no painel com os botões rápidos · meta ~37 ml/kg
        </p>
      </Card>

      <SectionTitle accent="steel">Últimos registros</SectionTitle>
      <Card className="rise rise-5 p-0">
        {view.recent.map((b, i) => (
          <div
            key={b.date}
            className={cn(
              "flex items-center justify-between px-4 py-2.5",
              i < view.recent.length - 1 && "border-b border-seam"
            )}
          >
            <span className="font-mono text-xs text-steel-dim">{shortDate(b.date)}</span>
            <span className="font-mono text-sm text-bone">
              {b.weightKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg
            </span>
            <span className="w-20 text-right font-mono text-xs text-steel">
              {b.waistCm !== undefined
                ? `${b.waistCm.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} cm`
                : "—"}
            </span>
          </div>
        ))}
      </Card>
    </main>
  )
}
