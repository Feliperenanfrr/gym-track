"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, Check, Moon, Pencil, Plus, Trash2 } from "lucide-react"
import { ConfirmDialog, UndoToast } from "@/components/dialogs"
import {
  BodyFatChart,
  CompositionChart,
  HydrationChart,
  IndexedBodyChart,
  LeanFatStackChart,
  SleepChart,
  SleepScheduleChart,
  VisceralChart,
  WeightChart,
  WaistChart,
} from "@/components/charts"
import { Card, PageHeader, SectionTitle, Skeleton, StatCard } from "@/components/ui"
import { parseBioimpedanceCsv, toBodyLog } from "@/lib/bioimpedance"
import { indexedBodyTrend } from "@/lib/composition"
import { waterGoalMl, weightTrend7d } from "@/lib/insights"
import { BodyLog } from "@/lib/types"
import {
  bedtimeClockMinutes,
  computeSleepMetrics,
  formatSleepDuration,
  minutesToSleepInput,
  parseSleepHours,
  sleepDurationMinutes,
} from "@/lib/sleep"
import { useGymData } from "@/lib/store"
import { useOperationalDay } from "@/lib/use-operational-day"
import {
  cn,
  fromDateKey,
  isoWeekday,
  toDateKey,
  toOperationalDateKey,
  WEEKDAY_SHORT,
} from "@/lib/utils"

function shortDate(key: string): string {
  const d = fromDateKey(key)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function dayOptionLabel(key: string): string {
  const d = fromDateKey(key)
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
  return `${weekday} ${shortDate(key)}`
}

type WeightQuality = {
  /** variação de peso (kg) do 1º ao último registro com peso + gordura */
  dWeight: number
  /** variação de massa de gordura (kg) */
  dFat: number
  /** variação de massa magra (kg) */
  dLean: number
  /** fração da variação de peso explicada pela gordura (%) */
  fatShare: number | null
  losing: boolean
}

/** Leitura em uma frase da qualidade da recomposição. */
function qualityVerdict(q: WeightQuality): string {
  if (q.dFat <= -0.1 && q.dLean >= -0.1)
    return "Recomposição acontecendo: gordura caindo e massa magra preservada ou subindo."
  if (q.dFat < 0 && q.dLean < -0.1)
    return "Perdendo gordura, mas também um pouco de magra — comum no déficit; segure a proteína alta."
  if (q.dFat > 0.1)
    return "A gordura subiu no período — vale revisar o déficit calórico."
  return "Variação ainda pequena para conclusão — siga registrando."
}

export default function MedidasPage() {
  const { data, addBodyLog, addSleepLog, addWater, deleteBodyLog, deleteSleepLog } = useGymData()
  const today = useOperationalDay()
  const [weight, setWeight] = useState("")
  const [waist, setWaist] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sleepStart, setSleepStart] = useState("")
  const [sleepEnd, setSleepEnd] = useState("")
  const [sleepHours, setSleepHours] = useState("")
  /** dia do registro de sono (yyyy-MM-dd) — retroativo para noites esquecidas */
  const [sleepDate, setSleepDate] = useState("")
  const [sleepLoadedDate, setSleepLoadedDate] = useState<string | null>(null)
  const [sleepSaved, setSleepSaved] = useState(false)
  const [sleepSaving, setSleepSaving] = useState(false)
  const [sleepError, setSleepError] = useState<string | null>(null)
  const [bioText, setBioText] = useState("")
  const [bioSaving, setBioSaving] = useState(false)
  const [bioSaved, setBioSaved] = useState(false)
  const [bioError, setBioError] = useState<string | null>(null)
  /** seção destacada ao chegar por deep-link (#registrar-sono, #hidratacao) */
  const [sleepView, setSleepView] = useState<"duracao" | "horario">("duracao")
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  /** correção de água em dia passado */
  const [waterDay, setWaterDay] = useState("")
  const [waterMl, setWaterMl] = useState("")
  const [waterSaving, setWaterSaving] = useState(false)
  const [waterOk, setWaterOk] = useState(false)
  const [waterError, setWaterError] = useState<string | null>(null)
  /** destaque do formulário de sono ao chegar por deep-link (#registrar-sono) */
  const [sonoFlash, setSonoFlash] = useState(false)
  const sonoTimerRef = useRef<number | null>(null)
  /** correção de um registro corporal salvo (linha aberta em "Últimos registros") */
  const [editingBodyDate, setEditingBodyDate] = useState<string | null>(null)
  const [editBodyWeight, setEditBodyWeight] = useState("")
  const [editBodyWaist, setEditBodyWaist] = useState("")
  const [editBodySaving, setEditBodySaving] = useState(false)
  const [editBodyError, setEditBodyError] = useState<string | null>(null)
  /** exclusão via diálogo próprio + snackbar de desfazer */
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "body" | "sleep"
    date: string
  } | null>(null)
  const [undoState, setUndoState] = useState<{
    message: string
    restore: () => Promise<void>
  } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const bioParse = useMemo(
    () => (bioText.trim() ? parseBioimpedanceCsv(bioText) : null),
    [bioText]
  )

  const view = useMemo(() => {
    if (!data || !today) return null
    const body = data.body
    // peso agora é opcional: só conta quem registrou peso
    const weighed = body.filter((b) => b.weightKg !== undefined)
    const current = weighed[weighed.length - 1]
    // tendência por médias móveis de 7 dias (não primeiro-vs-último)
    const weightTrend = weightTrend7d(body, today)
    const waists = body.filter((b) => b.waistCm !== undefined)
    const currentWaist = waists[waists.length - 1]?.waistCm
    const firstWaist = waists[0]?.waistCm
    const waistDelta =
      currentWaist !== undefined && firstWaist !== undefined
        ? currentWaist - firstWaist
        : null
    const chart = weighed.map((b) => ({ label: shortDate(b.date), peso: b.weightKg! }))
    const waistChart = waists.map((b) => ({ label: shortDate(b.date), cintura: b.waistCm! }))
    // bioimpedância: primeiro vs. último registro que tem cada métrica
    const bioDelta = (
      key: "bodyFatPct" | "fatMassKg" | "skeletalMuscleKg" | "visceralFat" | "waterPct"
    ) => {
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
    // anatomia do peso: gordura + massa magra (peso − gordura); soma = peso
    const leanFatChart = body
      .filter((b) => b.weightKg !== undefined && b.fatMassKg !== undefined)
      .map((b) => ({
        label: shortDate(b.date),
        gordura: Math.round(b.fatMassKg! * 10) / 10,
        magra: Math.round((b.weightKg! - b.fatMassKg!) * 10) / 10,
      }))
    const visceralChart = body
      .filter((b) => b.visceralFat !== undefined)
      .map((b) => ({ label: shortDate(b.date), visceral: b.visceralFat! }))
    // razão músculo/gordura — índice de recomposição (sobe = recompondo)
    const ratioOf = (b?: BodyLog) =>
      b && b.skeletalMuscleKg !== undefined && b.fatMassKg && b.fatMassKg > 0
        ? b.skeletalMuscleKg / b.fatMassKg
        : undefined
    const ratioSeries = body.filter((b) => ratioOf(b) !== undefined)
    const muscleFatRatio = ratioOf(ratioSeries[ratioSeries.length - 1])
    const ratioDelta =
      ratioSeries.length >= 2
        ? ratioOf(ratioSeries[ratioSeries.length - 1])! - ratioOf(ratioSeries[0])!
        : null
    // qualidade da variação de peso: quanto veio de gordura vs. massa magra
    const compSeries = body.filter(
      (b) => b.weightKg !== undefined && b.fatMassKg !== undefined
    )
    let weightQuality: WeightQuality | null = null
    if (compSeries.length >= 2) {
      const a = compSeries[0]
      const z = compSeries[compSeries.length - 1]
      const dWeight = z.weightKg! - a.weightKg!
      const dFat = z.fatMassKg! - a.fatMassKg!
      const dLean = z.weightKg! - z.fatMassKg! - (a.weightKg! - a.fatMassKg!)
      // fração da variação de peso explicada pela gordura (>100% = ganhou magra)
      const fatShare = Math.abs(dWeight) > 0.05 ? (dFat / dWeight) * 100 : null
      weightQuality = { dWeight, dFat, dLean, fatShare, losing: dWeight < 0 }
    }
    // metas do plano calculadas pelo peso atual (1,8–2,2 g/kg; 35–40 ml/kg).
    // Sem peso: null — "—" honesto em vez de inventar uma balança fantasma.
    const kg = current?.weightKg ?? null
    // água dos últimos 7 dias (dias sem registro = 0, sinceridade > vaidade)
    const now = today
    const hydration7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
      const key = toDateKey(d)
      return {
        key,
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
    // Faixas de horário: sleptAt/wokeAt já estavam no banco e o gráfico de
    // barras só mostrava a duração. A regularidade some quando duas noites de
    // 7 h aparecem idênticas — uma começando às 22h e a outra às 4h.
    const sleepBands7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
      const key = toDateKey(d)
      const log = data.sleep.find((entry) => entry.date === key)
      return {
        label: WEEKDAY_SHORT[isoWeekday(d) - 1],
        dateLabel: shortDate(key),
        startMin: log ? bedtimeClockMinutes(log.sleptAt) : null,
        durationMin: log ? log.durationMin : null,
      }
    })
    const bodyTrend = indexedBodyTrend(body)
    return {
      bodyTrend,
      hydration7,
      sleep7,
      sleepBands7,
      sleepMetrics,
      waterGoal: waterGoalMl(body),
      current,
      weightTrend,
      currentWaist,
      waistDelta,
      chart,
      waistChart,
      latestBio,
      compositionChart,
      bodyFatChart,
      leanFatChart,
      visceralChart,
      muscleFatRatio,
      ratioDelta,
      weightQuality,
      bodyFatDelta: bioDelta("bodyFatPct"),
      fatMassDelta: bioDelta("fatMassKg"),
      muscleDelta: bioDelta("skeletalMuscleKg"),
      visceralDelta: bioDelta("visceralFat"),
      waterDelta: bioDelta("waterPct"),
      protein: kg ? [Math.round(kg * 1.8), Math.round(kg * 2.2)] : null,
      water: kg ? [(kg * 0.035).toFixed(1), (kg * 0.04).toFixed(1)] : null,
      recent: [...body].reverse().slice(0, 8),
      recentSleep: [...data.sleep].reverse().slice(0, 8),
    }
  }, [data, today])

  /** carrega nos campos o sono já registrado do dia (ou os valores padrão) */
  const loadSleepFields = (key: string) => {
    const log = data?.sleep.find((s) => s.date === key)
    if (log) {
      setSleepStart(log.sleptAt)
      setSleepEnd(log.wokeAt)
      setSleepHours(minutesToSleepInput(log.durationMin))
    } else {
      setSleepStart("23:30")
      setSleepEnd("07:30")
      setSleepHours("8,0")
    }
  }

  useEffect(() => {
    if (!data || !today) return
    const todayKey = toDateKey(today)
    if (sleepLoadedDate === todayKey) return
    if (!sleepDate) loadSleepFields(todayKey)
    setSleepDate((current) => current || todayKey)
    setSleepLoadedDate(todayKey)
  }, [data, sleepLoadedDate, today])

  // sugere para correção de água o dia mais recente sem registro (hoje fica
  // com os botões rápidos do painel; correção é coisa de dias passados)
  useEffect(() => {
    if (!view || waterDay) return
    const reversed = [...view.hydration7].reverse()
    const missing = reversed.find((d, idx) => idx > 0 && d.ml === 0)
    const fallback = view.hydration7[Math.max(0, view.hydration7.length - 2)]
    setWaterDay(missing?.key ?? fallback.key)
  }, [view, waterDay])

  // deep-links do painel ("Registrar sono", "corrigir outro dia"): rolam até a
  // seção, focam o primeiro campo e piscam o cartão — nada de caçar na página
  const DEEP_LINK_IDS = ["registrar-sono", "hidratacao"]
  useEffect(() => {
    if (!view) return
    const goToHash = () => {
      const id = window.location.hash.replace("#", "")
      if (!DEEP_LINK_IDS.includes(id)) return
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      if (id === "registrar-sono") {
        document.getElementById("sleep-start")?.focus({ preventScroll: true })
      }
      setFlashId(null)
      requestAnimationFrame(() => setFlashId(id))
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlashId(null), 2400)
    }
    goToHash()
    window.addEventListener("hashchange", goToHash)
    return () => {
      window.removeEventListener("hashchange", goToHash)
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

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
    const wa = parseFloat(waist.replace(",", "."))
    const hasWeight = !isNaN(w) && w > 0
    const hasWaist = !isNaN(wa) && wa > 0
    if (!hasWeight && !hasWaist) {
      setSaveError("Informe o peso, a cintura, ou os dois.")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      // só os campos informados vão no log — o store faz merge por dia, então
      // salvar só a cintura preserva o peso/bioimpedância já gravados (e vice-versa)
      await addBodyLog({
        date: toOperationalDateKey(new Date()),
        ...(hasWeight ? { weightKg: Math.round(w * 10) / 10 } : {}),
        ...(hasWaist ? { waistCm: Math.round(wa * 10) / 10 } : {}),
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

  /** troca o dia do sono: recarrega o registro daquele dia (ou os padrões) */
  const changeSleepDate = (value: string) => {
    setSleepDate(value)
    setSleepSaved(false)
    setSleepError(null)
    if (value) loadSleepFields(value)
  }

  /** abre a linha de medidas para correção inline */
  const openBodyEdit = (b: BodyLog) => {
    if (editingBodyDate === b.date) {
      setEditingBodyDate(null)
      return
    }
    setEditingBodyDate(b.date)
    setEditBodyWeight(b.weightKg !== undefined ? String(b.weightKg).replace(".", ",") : "")
    setEditBodyWaist(b.waistCm !== undefined ? String(b.waistCm).replace(".", ",") : "")
    setEditBodyError(null)
  }

  const saveBodyEdit = async () => {
    if (!editingBodyDate) return
    const w = parseFloat(editBodyWeight.replace(",", "."))
    const wa = parseFloat(editBodyWaist.replace(",", "."))
    const hasWeight = !isNaN(w) && w > 0
    const hasWaist = !isNaN(wa) && wa > 0
    if (!hasWeight && !hasWaist) {
      setEditBodyError("Informe peso, cintura, ou os dois.")
      return
    }
    setEditBodySaving(true)
    setEditBodyError(null)
    try {
      // merge por dia preserva bioimpedância e demais campos já gravados
      await addBodyLog({
        date: editingBodyDate,
        ...(hasWeight ? { weightKg: Math.round(w * 10) / 10 } : {}),
        ...(hasWaist ? { waistCm: Math.round(wa * 10) / 10 } : {}),
      })
      setEditingBodyDate(null)
    } catch (e) {
      setEditBodyError(e instanceof Error ? e.message : "Erro ao salvar no banco")
    } finally {
      setEditBodySaving(false)
    }
  }

  /** diálogo confirmou: exclui e arma o desfazer com o log capturado */
  const runDelete = async () => {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    setDeleteError(null)
    try {
      if (target.kind === "body") {
        const log = data?.body.find((b) => b.date === target.date)
        await deleteBodyLog(target.date)
        setUndoState({
          message: `Registro de ${shortDate(target.date)} excluído.`,
          restore: async () => {
            if (log) await addBodyLog(log)
          },
        })
      } else {
        const log = data?.sleep.find((s) => s.date === target.date)
        await deleteSleepLog(target.date)
        setUndoState({
          message: `Sono de ${shortDate(target.date)} excluído.`,
          restore: async () => {
            if (log) await addSleepLog(log)
          },
        })
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erro ao excluir registro")
    }
  }

  /** carrega uma noite antiga no formulário principal para correção */
  const editSleepDay = (date: string) => {
    changeSleepDate(date)
    document.getElementById("registrar-sono")?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => {
      document.getElementById("sleep-start")?.focus({ preventScroll: true })
    }, 400)
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
        date: sleepDate || toOperationalDateKey(new Date()),
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

  /** grava o total de água de um dia passado (substitui o total registrado) */
  const handleWaterSave = async () => {
    if (!waterDay) {
      setWaterError("Escolha o dia.")
      return
    }
    const ml = Math.round(parseFloat(waterMl.replace(",", ".")) || 0)
    if (ml < 0 || ml > 15000) {
      setWaterError("Total inválido — use entre 0 e 15.000 ml.")
      return
    }
    setWaterSaving(true)
    setWaterError(null)
    try {
      const current = data?.hydration.find((h) => h.date === waterDay)?.ml ?? 0
      await addWater(ml - current, waterDay)
      setWaterMl("")
      setWaterOk(true)
      setTimeout(() => setWaterOk(false), 2500)
    } catch (e) {
      setWaterError(e instanceof Error ? e.message : "Erro ao salvar hidratação")
    } finally {
      setWaterSaving(false)
    }
  }

  const fmtDelta = (d: number | null, unit: string) =>
    d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1).replace(".", ",")} ${unit} desde o início`

  const fmt1 = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const fmtSigned = (n: number, unit: string) =>
    `${n > 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")} ${unit}`

  return (
    <main>
      <PageHeader kicker="RECOMPOSIÇÃO CORPORAL" title="Medidas" />

      <div className="rise rise-1 grid grid-cols-2 gap-3">
        <StatCard
          label="Peso"
          value={fmt1(view.current?.weightKg)}
          detail={
            view.weightTrend.delta !== null
              ? `${view.weightTrend.delta > 0 ? "+" : ""}${view.weightTrend.delta.toFixed(1).replace(".", ",")} kg vs média anterior`
              : "média 7d sem base comparável ainda"
          }
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

      {view.chart.length > 0 && (
        <>
          <SectionTitle accent="steel">Tendência de peso</SectionTitle>
          <Card className="rise rise-2 mb-6">
            <WeightChart data={view.chart} />
            <p className="mt-2 font-mono text-[10px] text-steel-dim">
              tendência do card compara médias de 7 dias · alvo do plano: −0,4 a −0,7 kg/semana
            </p>
          </Card>
        </>
      )}

      {view.waistChart.length > 0 && (
        <>
          <SectionTitle accent="steel">Evolução de cintura</SectionTitle>
          <Card className="rise rise-2 border-l-4 border-l-[#818cf8]">
            <WaistChart data={view.waistChart} />
            <p className="mt-2 font-mono text-[10px] text-steel-dim">
              redução na cintura é um forte indicativo de perda de gordura
            </p>
          </Card>
        </>
      )}

      {/* Peso e cintura na mesma régua: o que interessa é a DISTÂNCIA entre as
          duas linhas, e ela some quando cada uma tem seu próprio gráfico. */}
      {view.bodyTrend.points.length >= 2 ? (
        <Card className="rise rise-2 mb-6 mt-3 border-l-4 border-l-gold">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
              Peso × cintura
            </p>
            <p className="font-mono text-[10px] text-steel-dim">
              base {view.bodyTrend.points[0].label} · {view.bodyTrend.points.length} medidas
            </p>
          </div>

          <IndexedBodyChart data={view.bodyTrend.points} />

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-steel">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-gold" /> peso
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: "#818cf8" }}
              />
              cintura
            </span>
            <span className="text-steel-dim">tracejado = primeira medida</span>
          </div>

          {view.bodyTrend.latest && (
            <p className="mt-3 border-t border-seam pt-3 text-xs leading-relaxed text-steel">
              {view.bodyTrend.latest.divergence < -0.4 ? (
                <>
                  Hoje a <span className="text-[#818cf8]">cintura</span> está{" "}
                  <strong className="text-bone">
                    {Math.abs(view.bodyTrend.latest.divergence).toFixed(1).replace(".", ",")} pp
                  </strong>{" "}
                  à frente do peso — medida saindo mais rápido que massa. É isso que
                  recomposição parece num gráfico.
                </>
              ) : view.bodyTrend.latest.divergence > 0.4 ? (
                <>
                  Hoje o <span className="text-gold">peso</span> está{" "}
                  <strong className="text-bone">
                    {view.bodyTrend.latest.divergence.toFixed(1).replace(".", ",")} pp
                  </strong>{" "}
                  à frente da cintura — o que saiu da balança não saiu da medida.
                </>
              ) : (
                <>As duas linhas estão andando juntas desde a base.</>
              )}
              {view.bodyTrend.bestDivergence && (
                <>
                  {" "}Melhor momento do período:{" "}
                  <span className="text-bone">{view.bodyTrend.bestDivergence.label}</span>,
                  com a cintura {Math.abs(view.bodyTrend.bestDivergence.divergence).toFixed(1).replace(".", ",")} pp à frente.
                </>
              )}
            </p>
          )}
        </Card>
      ) : view.waistChart.length > 0 ? (
        <Card className="rise rise-2 mb-6 mt-3 border-l-4 border-l-gold">
          <p className="font-mono text-[10px] leading-relaxed text-steel-dim">
            Comparar peso e cintura precisa de 2 pesagens com as DUAS medidas no mesmo
            dia. Você tem {view.bodyTrend.points.length}.
          </p>
        </Card>
      ) : null}

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
            <StatCard
              label="Músculo ÷ gordura"
              value={
                view.muscleFatRatio !== undefined
                  ? view.muscleFatRatio.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—"
              }
              detail={
                view.ratioDelta === null
                  ? "índice de recomposição · sobe = recompõe"
                  : `${view.ratioDelta > 0 ? "+" : ""}${view.ratioDelta
                      .toFixed(2)
                      .replace(".", ",")} desde o início`
              }
              accent="zone"
            />
            <StatCard
              label="Água"
              value={
                <>
                  {fmt1(view.latestBio.waterPct)}
                  <span className="text-base text-steel-dim"> %</span>
                </>
              }
              detail={
                view.waterDelta === null
                  ? "água corporal · afeta as leituras"
                  : fmtDelta(view.waterDelta, "%")
              }
              accent="steel"
            />
          </div>

          <p className="rise rise-2 mt-3 font-mono text-[11px] text-steel-dim">
            IMC {fmt1(view.latestBio.bmi)} · metabolismo basal{" "}
            {view.latestBio.bmrKcal !== undefined
              ? Math.round(view.latestBio.bmrKcal).toLocaleString("pt-BR")
              : "—"}{" "}
            kcal/dia
          </p>

          {view.weightQuality && (
            <Card className="rise rise-3 mt-3 border-l-4 border-l-gold">
              <p
                className="mb-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-gold"
                style={{ fontFamily: "var(--font-condensed)" }}
              >
                Qualidade da variação de peso
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                <span className="text-steel">
                  peso{" "}
                  <span className="text-bone">
                    {fmtSigned(view.weightQuality.dWeight, "kg")}
                  </span>
                </span>
                <span className="text-steel">
                  gordura{" "}
                  <span style={{ color: "#fb7185" }}>
                    {fmtSigned(view.weightQuality.dFat, "kg")}
                  </span>
                </span>
                <span className="text-steel">
                  massa magra{" "}
                  <span style={{ color: "#2dd4bf" }}>
                    {fmtSigned(view.weightQuality.dLean, "kg")}
                  </span>
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-steel">
                {qualityVerdict(view.weightQuality)}
              </p>
            </Card>
          )}

          {view.leanFatChart.length > 0 && (
            <>
              <SectionTitle accent="ember">Anatomia do peso</SectionTitle>
              <Card className="rise rise-3 border-l-4 border-l-[#fb7185]">
                <LeanFatStackChart data={view.leanFatChart} />
                <p className="mt-2 font-mono text-[10px] text-steel-dim">
                  <span style={{ color: "#2dd4bf" }}>massa magra</span> +{" "}
                  <span style={{ color: "#fb7185" }}>gordura</span> = seu peso · meta é
                  encolher a fatia vermelha
                </p>
              </Card>
            </>
          )}

          {view.compositionChart.length > 1 && (
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
            <Card className="rise rise-3 mt-3 border-l-4 border-l-[#fb7185]">
              <BodyFatChart data={view.bodyFatChart} />
              <p className="mt-2 font-mono text-[10px] text-steel-dim">
                leia a tendência, não o ponto — bioimpedância oscila com hidratação
              </p>
            </Card>
          )}

          {view.visceralChart.length > 1 && (
            <Card className="rise rise-3 mb-6 mt-3 border-l-4 border-l-gold">
              <VisceralChart data={view.visceralChart} />
              <p className="mt-2 font-mono text-[10px] text-steel-dim">
                gordura visceral é a do abdômen profundo — a que mais pesa na saúde
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
        <div className="mb-3 flex gap-1">
          {([
            ["duracao", "duração"],
            ["horario", "horário"],
          ] as const).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setSleepView(id)}
              className={cn(
                "rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                sleepView === id
                  ? "border-[#a78bfa] text-[#a78bfa]"
                  : "border-seam text-steel-dim"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {sleepView === "duracao" ? (
          <SleepChart data={view.sleep7} />
        ) : (
          <SleepScheduleChart data={view.sleepBands7} />
        )}
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-steel-dim">
          média: {formatSleepDuration(view.sleepMetrics.avg7Min)}
          {view.sleepMetrics.avgBedtime &&
            view.sleepMetrics.avgWake &&
            ` · janela média ${view.sleepMetrics.avgBedtime} → ${view.sleepMetrics.avgWake}`}
          {sleepView === "horario" && (
            <>
              <br />
              cada faixa vai de deitar a acordar &mdash; faixas desalinhadas são
              irregularidade, e ela pesa tanto quanto a duração.
            </>
          )}
        </p>
      </Card>

      <div id="registrar-sono" className="scroll-mt-4">
        <SectionTitle accent="steel">Registrar sono</SectionTitle>
        <Card
          className={cn(
            "rise rise-3 border-l-4 border-l-[#a78bfa]",
            flashId === "registrar-sono" && "arrive-flash"
          )}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">
                Dia (que acordou)
              </span>
              <input
                type="date"
                value={sleepDate}
                max={today ? toDateKey(today) : undefined}
                onChange={(e) => changeSleepDate(e.target.value)}
                className="w-40 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-[#a78bfa]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Dormi às</span>
              <input
                id="sleep-start"
                type="time"
                value={sleepStart}
                onChange={(e) => handleSleepStartChange(e.target.value)}
                className="w-28 rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-[#a78bfa]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Acordei às</span>
              <input
                id="sleep-end"
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
      </div>

      <div id="registrar-medidas" className="scroll-mt-4">
        <SectionTitle>Registrar medidas</SectionTitle>
      <Card className="rise rise-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-steel-dim">
              Peso (kg) — opcional
            </span>
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
            disabled={saving || (!weight.trim() && !waist.trim())}
            className={cn(
              "flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
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
          Registre peso, cintura, ou os dois — o que faltar entra do mesmo dia da
          balança. Cintura: meça no umbigo, relaxado. Peso: de manhã, em jejum.
        </p>
      </Card>
      </div>

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
            view.protein ? (
              <>
                {view.protein[0]}–{view.protein[1]}
                <span className="text-base text-steel-dim"> g</span>
              </>
            ) : (
              "—"
            )
          }
          detail={
            view.protein
              ? "1,8–2,2 g/kg — protege músculo no déficit"
              : "registre seu peso para calibrar"
          }
        />
        <StatCard
          label="Água"
          value={
            view.water ? (
              <>
                {String(view.water[0]).replace(".", ",")}–{String(view.water[1]).replace(".", ",")}
                <span className="text-base text-steel-dim"> L</span>
              </>
            ) : (
              "—"
            )
          }
          detail={view.water ? "35–40 ml/kg — desidratação piora fôlego" : "registre seu peso para calibrar"}
          accent="zone"
        />
      </div>

      <div id="hidratacao" className="scroll-mt-4">
        <SectionTitle accent="zone">Água — últimos 7 dias</SectionTitle>
        <Card className="rise rise-4 border-l-4 border-l-[#38bdf8]">
          <HydrationChart data={view.hydration7} target={view.waterGoal} />
          <p className="mt-2 font-mono text-[10px] text-steel-dim">
            registre no painel com os botões rápidos · meta ~37 ml/kg
          </p>
        </Card>

        {/* correção retroativa: total exato de um dia esquecido ou errado */}
        <Card
          className={cn(
            "rise rise-4 mt-3 border-l-4 border-l-[#38bdf8]",
            flashId === "hidratacao" && "arrive-flash"
          )}
        >
          <p className="text-sm font-semibold text-bone">Corrigir outro dia</p>
          <p className="mt-0.5 text-xs text-steel-dim">
            Esqueceu de anotar? Salve o total daquele dia — substitui o que estiver registrado.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Dia</span>
              <select
                value={waterDay}
                onChange={(e) => {
                  setWaterDay(e.target.value)
                  setWaterOk(false)
                  setWaterError(null)
                }}
                className="rounded border border-seam bg-coal px-2.5 py-2 text-sm text-bone outline-none focus:border-zone"
              >
                {[...view.hydration7].reverse().map((d) => (
                  <option key={d.key} value={d.key}>
                    {dayOptionLabel(d.key)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-28 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-steel-dim">Total (ml)</span>
              <input
                type="number"
                inputMode="numeric"
                step={50}
                placeholder={String(view.hydration7.find((d) => d.key === waterDay)?.ml ?? 0)}
                value={waterMl}
                onChange={(e) => setWaterMl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleWaterSave()
                }}
                className="w-full rounded border border-seam bg-coal px-2 py-2 text-center font-mono text-sm text-bone outline-none focus:border-zone"
              />
            </label>
            <button
              onClick={handleWaterSave}
              disabled={waterSaving || !waterDay}
              className={cn(
                "flex items-center gap-1.5 rounded px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-60",
                waterOk ? "bg-zone text-coal" : "bg-[#38bdf8] text-coal hover:bg-sky-300"
              )}
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {waterOk ? <Check size={15} /> : <Plus size={15} />}
              {waterSaving ? "Salvando…" : waterOk ? "Salvo" : "Salvar"}
            </button>
          </div>
          {waterError && (
            <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {waterError}
            </p>
          )}
        </Card>
      </div>

      <SectionTitle accent="steel">Últimos registros</SectionTitle>
      <Card className="rise rise-5 p-0">
        {view.recent.map((b, i) => {
          const editing = editingBodyDate === b.date
          return (
            <div key={b.date} className={cn(i < view.recent.length - 1 && "border-b border-seam")}>
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="font-mono text-xs text-steel-dim">{shortDate(b.date)}</span>
                {editing ? (
                  <span className="font-mono text-xs text-gold">editando…</span>
                ) : (
                  <>
                    <span className="font-mono text-sm text-bone">
                      {b.weightKg !== undefined
                        ? `${b.weightKg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kg`
                        : "—"}
                    </span>
                    <span className="w-24 text-right font-mono text-xs text-steel">
                      {b.bodyFatPct !== undefined && (
                        <span className="mr-2" style={{ color: "#fb7185" }}>
                          {b.bodyFatPct.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                        </span>
                      )}
                      {b.waistCm !== undefined
                        ? `${b.waistCm.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} cm`
                        : "—"}
                    </span>
                  </>
                )}
                {!editing && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openBodyEdit(b)}
                      className="p-1.5 text-steel-dim transition-colors hover:text-bone"
                      aria-label={`Corrigir registro de ${shortDate(b.date)}`}
                      title="Corrigir peso/cintura"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setPendingDelete({ kind: "body", date: b.date })}
                      className="p-1.5 text-steel-dim transition-colors hover:text-red-400"
                      aria-label={`Excluir registro de ${shortDate(b.date)}`}
                      title="Excluir registro do dia"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* correção inline — merge preserva bioimpedância do dia */}
              {editing && (
                <div className="border-t border-seam bg-coal/60 px-4 py-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex w-24 flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase text-steel-dim">Peso</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={editBodyWeight}
                        onChange={(e) => setEditBodyWeight(e.target.value)}
                        className="w-full rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                      />
                    </label>
                    <label className="flex w-24 flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase text-steel-dim">Cintura</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={editBodyWaist}
                        onChange={(e) => setEditBodyWaist(e.target.value)}
                        className="w-full rounded border border-seam bg-coal px-2 py-1.5 text-center font-mono text-sm text-bone outline-none focus:border-gold"
                      />
                    </label>
                    <button
                      onClick={saveBodyEdit}
                      disabled={editBodySaving}
                      className="flex items-center gap-1.5 rounded bg-zone px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-coal transition-colors hover:bg-zone/85 disabled:opacity-60"
                    >
                      <Check size={13} /> {editBodySaving ? "Salvando…" : "Salvar"}
                    </button>
                    <button
                      onClick={() => setEditingBodyDate(null)}
                      className="rounded border border-seam px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-steel transition-colors hover:text-bone"
                    >
                      Cancelar
                    </button>
                  </div>
                  {editBodyError && (
                    <p className="mt-2 rounded border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-xs text-red-400">
                      {editBodyError}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-steel-dim">
                    Bioimpedância do dia permanece intacta — ajuste pelo campo CSV acima.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {deleteError && (
        <p className="rise mt-3 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {deleteError}
        </p>
      )}

      <SectionTitle accent="steel">Últimas noites</SectionTitle>
      <Card className="rise rise-5 p-0">
        {view.recentSleep.length === 0 ? (
          <p className="px-4 py-3 text-center text-xs text-steel-dim">
            Nenhuma noite registrada ainda.
          </p>
        ) : (
          view.recentSleep.map((s, i) => {
            return (
              <div
                key={s.date}
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-2.5",
                  i < view.recentSleep.length - 1 && "border-b border-seam"
                )}
              >
                <span className="font-mono text-xs text-steel-dim">{shortDate(s.date)}</span>
                <span className="font-mono text-xs text-steel">
                  {s.sleptAt} → {s.wokeAt}
                </span>
                <span className="w-14 text-right font-mono text-sm text-bone">
                  {formatSleepDuration(s.durationMin)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => editSleepDay(s.date)}
                    className="p-1.5 text-steel-dim transition-colors hover:text-bone"
                    aria-label={`Corrigir sono de ${shortDate(s.date)}`}
                    title="Corrigir no formulário acima"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setPendingDelete({ kind: "sleep", date: s.date })}
                    className="rounded p-1.5 text-steel-dim transition-colors hover:text-red-400"
                    aria-label={`Excluir sono de ${shortDate(s.date)}`}
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </Card>

      {/* confirmação própria + desfazer */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === "sleep" ? "Excluir este registro de sono?" : "Excluir este registro?"
        }
        message={
          pendingDelete
            ? `O registro de ${shortDate(pendingDelete.date)} sai do banco e dos cálculos (médias, gráficos, metas). Você pode desfazer logo após excluir.`
            : ""
        }
        onConfirm={runDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={() => {
            const restore = undoState.restore
            setUndoState(null)
            restore().catch(() => {
              setDeleteError("Não foi possível desfazer — verifique a conexão.")
            })
          }}
          onDismiss={() => setUndoState(null)}
        />
      )}
    </main>
  )
}
