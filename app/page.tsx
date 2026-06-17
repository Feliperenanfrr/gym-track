"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, CloudOff, Droplets, History, LogOut, Moon, RotateCcw } from "lucide-react"
import { MuscleVolumeChart, StrengthChart, WeeklyVolumeChart, ZoneChart } from "@/components/charts"
import { Card, PageHeader, SectionTitle, Skeleton, StatCard } from "@/components/ui"
import { computeAchievements } from "@/lib/achievements"
import {
  getScheduleMode,
  last7Days,
  nextInCycle,
  rolling7,
  ScheduleMode,
  setScheduleMode,
} from "@/lib/cycle"
import { computeReadiness, ReadinessLevel, waterGoalMl, weeklySummary } from "@/lib/insights"
import { hardSetsByGroup, MUSCLE_GROUPS } from "@/lib/muscles"
import { PLAN_BY_ID, sessionForWeekday } from "@/lib/plan"
import { computeSleepMetrics, formatSleepDuration } from "@/lib/sleep"
import { useGymData } from "@/lib/store"
import { GymData, SessionId, WorkoutLog } from "@/lib/types"
import { useOperationalDay } from "@/lib/use-operational-day"
import {
  bestE1RMAdjusted,
  cn,
  daysSince,
  formatKg,
  fromDateKey,
  isoWeekday,
  mondayOf,
  toDateKey,
  WEEKDAY_SHORT,
  workoutVolume,
} from "@/lib/utils"

const KEY_LIFTS: { id: string; label: string }[] = [
  { id: "bench", label: "Supino" },
  { id: "squat", label: "Agacho" },
  { id: "deadlift", label: "Terra" },
  { id: "ohp", label: "Desenv." },
  { id: "row", label: "Remada" },
]

const Z2_TARGET = 60 // ter 40–50 min + sex 20 min

const READINESS_UI: Record<
  ReadinessLevel,
  { emoji: string; title: string; desc: string; border: string }
> = {
  building: {
    emoji: "⚪",
    title: "Construindo base",
    desc: "Registre 2+ semanas de treino para calibrar o sinal de fadiga.",
    border: "border-l-steel-dim",
  },
  green: {
    emoji: "🟢",
    title: "Pronto pra carga",
    desc: "Carga interna dentro da sua base recente — pode progredir.",
    border: "border-l-zone",
  },
  yellow: {
    emoji: "🟡",
    title: "Carga subindo rápido",
    desc: "Esforço acima da média das últimas 3 semanas. Capricha em sono e proteína.",
    border: "border-l-gold",
  },
  red: {
    emoji: "🔴",
    title: "Alerta de fadiga",
    desc: "Bem acima da base recente — considere uma semana mais leve.",
    border: "border-l-ember",
  },
}

function dayMonth(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  if (monday.getMonth() === sunday.getMonth()) {
    return `${String(monday.getDate()).padStart(2, "0")}-${dayMonth(sunday)}`
  }
  return `${dayMonth(monday)}-${dayMonth(sunday)}`
}

/** Z2 = sessão de cardio + finisher do Lower B (esporte não conta como base) */
function z2Minutes(w: WorkoutLog): number {
  if (w.sessionId === "sport") return 0
  return w.cardio?.minutes ?? 0
}

function buildWeeks(data: GymData, today: Date) {
  const currentMonday = mondayOf(today)
  const weeks: {
    monday: Date
    label: string
    volume: number
    z2: number
    sessions: number
    groups: ReturnType<typeof hardSetsByGroup>
  }[] = []
  for (let i = 5; i >= 0; i--) {
    const monday = new Date(currentMonday)
    monday.setDate(monday.getDate() - i * 7)
    const start = toDateKey(monday)
    const end = toDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))
    const ws = data.workouts.filter((w) => w.date >= start && w.date <= end)
    weeks.push({
      monday,
      label: weekLabel(monday),
      volume: ws.reduce((s, w) => s + workoutVolume(w), 0),
      z2: ws.reduce((s, w) => s + z2Minutes(w), 0),
      sessions: ws.filter((w) => w.sessionId !== "sport" && w.sessionId !== "rest").length,
      groups: hardSetsByGroup(ws),
    })
  }
  return weeks
}

export default function Dashboard() {
  const { data, error, pendingCount, addWater, signOut } = useGymData()
  const today = useOperationalDay()
  const [lift, setLift] = useState("bench")
  const [volumeView, setVolumeView] = useState<"grupos" | "total">("grupos")
  const [lastWaterAdd, setLastWaterAdd] = useState<number | null>(null)
  const [mode, setMode] = useState<ScheduleMode>("ciclo")

  useEffect(() => {
    setMode(getScheduleMode())
  }, [])

  const toggleMode = () => {
    const next: ScheduleMode = mode === "ciclo" ? "calendario" : "ciclo"
    setScheduleMode(next)
    setMode(next)
  }

  const view = useMemo(() => {
    if (!data || !today) return null
    const todayKey = toDateKey(today)
    const todaySession = sessionForWeekday(isoWeekday(today))
    const todayDone = data.workouts.some(
      (w) => w.date === todayKey && w.sessionId === todaySession.id
    )

    const weeks = buildWeeks(data, today)
    const thisWeek = weeks[weeks.length - 1]
    const lastWeek = weeks[weeks.length - 2]
    const volumeDelta =
      lastWeek && lastWeek.volume > 0
        ? Math.round(((thisWeek.volume - lastWeek.volume) / lastWeek.volume) * 100)
        : null

    // fita da semana: status de cada dia
    const monday = mondayOf(today)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      const key = toDateKey(d)
      const planned = sessionForWeekday(i + 1)
      const done = data.workouts.some((w) => w.date === key && w.sessionId === planned.id)
      return {
        label: WEEKDAY_SHORT[i],
        session: planned,
        done,
        isToday: key === todayKey,
        isPast: key < todayKey,
      }
    })

    // peso
    const weights = data.body.filter((b) => b.weightKg > 0)
    const currentWeight = weights[weights.length - 1]?.weightKg
    const firstWeight = weights[0]?.weightKg
    const weightDelta =
      currentWeight !== undefined && firstWeight !== undefined
        ? currentWeight - firstWeight
        : null

    // progressão de força do exercício selecionado
    const strength = data.workouts
      .filter((w) => w.entries.some((e) => e.exerciseId === lift))
      .map((w) => {
        const entry = w.entries.find((e) => e.exerciseId === lift)!
        const d = fromDateKey(w.date)
        return {
          label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
          e1rm: Math.round(bestE1RMAdjusted(entry) * 10) / 10,
        }
      })

    // streak e dias ativos
    const firstWorkout = data.workouts.length > 0 ? fromDateKey(data.workouts[0].date) : null
    const daysActive = firstWorkout ? daysSince(firstWorkout, today) + 1 : 0

    let streak = 0
    if (data.workouts.length > 0) {
      const startMonday = mondayOf(firstWorkout!)
      let m = new Date(monday) // current monday
      let counted = 0
      while (m >= startMonday) {
        const start = toDateKey(m)
        const end = toDateKey(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 6))
        const hasWorkout = data.workouts.some((w) => w.date >= start && w.date <= end)
        if (hasWorkout) {
          counted++
        } else if (m.getTime() !== monday.getTime()) {
          break
        }
        m.setDate(m.getDate() - 7)
      }
      streak = counted
    }

    // distribuição de séries duras por grupo muscular — últimas 4 semanas
    const since28 = toDateKey(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27)
    )
    const byGroup = hardSetsByGroup(
      data.workouts.filter((w) => w.date >= since28 && w.date <= todayKey)
    )
    const groupTotal = Object.values(byGroup).reduce((a, b) => a + b, 0)
    const groupShare = MUSCLE_GROUPS.map((g) => ({
      ...g,
      sets: byGroup[g.id],
      pct: groupTotal > 0 ? Math.round((byGroup[g.id] / groupTotal) * 100) : 0,
    })).sort((a, b) => b.sets - a.sets)

    const readiness = computeReadiness(data.workouts, today)
    // fechamento de domingo: resumo da semana corrente
    const weekSummary = isoWeekday(today) === 7 ? weeklySummary(data, monday) : null
    const achievements = computeAchievements(data, today)

    // hidratação de hoje
    const waterToday = data.hydration.find((h) => h.date === todayKey)?.ml ?? 0
    const waterGoal = waterGoalMl(data.body)
    const sleepMetrics = computeSleepMetrics(data.sleep, today)

    // modo ciclo: próximo da fila + janela móvel de 7 dias
    const cycle = nextInCycle(data.workouts, today)
    const roll = rolling7(data.workouts, today)
    const strip = last7Days(data.workouts, today)
    const anyToday = data.workouts.some(
      (w) => w.date === todayKey && w.sessionId !== "rest"
    )

    // card principal unificado entre os dois modos
    const headSession =
      mode === "ciclo" ? PLAN_BY_ID[cycle.sessionId] : todaySession
    const headDone = mode === "ciclo" ? anyToday : todayDone
    const headKicker =
      mode === "ciclo"
        ? anyToday
          ? "Hoje concluído · próximo do ciclo"
          : "Próximo do ciclo"
        : "Treino de hoje"
    const headNote =
      mode !== "ciclo"
        ? null
        : cycle.reason === "recovery"
          ? `2 dias seguidos de musculação — hoje recupera: Z2 leve ou descanso. Depois vem ${PLAN_BY_ID[cycle.nextLiftId].title}.`
          : cycle.reason === "regression"
            ? `${cycle.daysSinceLastLift} dias sem musculação — repita ${PLAN_BY_ID[cycle.sessionId].title} com ~90% da carga.`
            : cycle.reason === "start"
              ? "Começo do ciclo: Upper A → Lower A → Upper B → Lower B."
              : null

    return {
      todaySession,
      todayDone,
      weeks,
      thisWeek,
      volumeDelta,
      days,
      currentWeight,
      weightDelta,
      strength,
      daysActive,
      streak,
      groupShare,
      readiness,
      weekSummary,
      achievements,
      waterToday,
      waterGoal,
      sleepMetrics,
      roll,
      strip,
      headSession,
      headDone,
      headKicker,
      headNote,
    }
  }, [data, today, lift, mode])

  if (error) {
    return (
      <main>
        <PageHeader kicker="GYM//TRACK" title="Painel" />
        <Card className="border-l-4 border-l-ember text-sm text-steel">
          Erro ao carregar do banco: {error}. Recarregue a página ou faça login de novo.
        </Card>
      </main>
    )
  }

  if (!view || !today) {
    return (
      <main>
        <PageHeader kicker="GYM//TRACK" title="Painel" />
        <Card className="mb-4">
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="h-10 w-40" />
        </Card>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="h-24"><Skeleton className="h-full w-full" /></Card>
          <Card className="h-24"><Skeleton className="h-full w-full" /></Card>
        </div>
      </main>
    )
  }

  const dateFmt = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  })

  return (
    <main>
      <PageHeader
        kicker={`GYM//TRACK · ${dateFmt}`}
        title="Painel"
        right={
          <div className="mb-1 flex items-center gap-2">
            {pendingCount > 0 && (
              <span
                className="flex items-center gap-1 rounded border border-gold/30 bg-gold/5 px-2 py-1 font-mono text-[10px] text-gold"
                title={`${pendingCount} registro(s) aguardando sincronização`}
              >
                <CloudOff size={11} /> {pendingCount}
              </span>
            )}
            <Link
              href="/historico"
              className="flex items-center gap-1.5 rounded border border-seam px-2.5 py-1.5 font-mono text-[10px] text-steel-dim transition-colors hover:border-steel hover:text-bone"
              title="Histórico de Treinos"
            >
              <History size={12} /> histórico
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded border border-seam px-2.5 py-1.5 font-mono text-[10px] text-steel-dim transition-colors hover:border-steel hover:text-bone"
              title="Sair"
            >
              <LogOut size={12} /> sair
            </button>
          </div>
        }
      />

      {/* Treino de hoje / próximo do ciclo */}
      <Card className="rise rise-1 relative overflow-hidden border-l-4 border-l-ember">
        <div className="flex justify-between items-center">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {view.headKicker}
          </p>
          {view.daysActive > 0 && (
            <span className="font-mono text-[9px] text-steel-dim" title="Dias desde o primeiro treino">
              Dia {view.daysActive}
            </span>
          )}
        </div>
        <h2 className="stencil mt-1 text-3xl text-bone">{view.headSession.title}</h2>
        <p className="mt-0.5 text-sm text-steel">{view.headSession.subtitle}</p>
        <p className="mt-2 font-mono text-xs text-steel-dim">
          {view.headSession.duration}
          {view.headSession.exercises.length > 0 &&
            ` · ${view.headSession.exercises.length} exercícios`}
          {view.headSession.cardioAfter && ` · +${view.headSession.cardioAfter.minutes} min Z2`}
        </p>
        {view.headNote && (
          <p className="mt-2 rounded border border-gold/30 bg-gold/5 px-2.5 py-1.5 text-xs text-gold">
            {view.headNote}
          </p>
        )}
        {view.headDone ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded bg-zone/10 px-3 py-2 text-sm font-semibold text-zone">
            <Check size={16} /> Concluído — bom trabalho
          </div>
        ) : view.headSession.kind === "rest" ? (
          <p className="mt-4 text-sm text-steel">
            Descanso total ou caminhada leve. Durma 7–9 h.
          </p>
        ) : (
          <Link
            href="/treino"
            className="mt-4 inline-flex items-center gap-2 rounded bg-ember px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-coal transition-colors hover:bg-ember-hot"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            Registrar treino <ArrowRight size={16} />
          </Link>
        )}
      </Card>

      {/* Resumo semanal — gerado no fechamento de domingo */}
      {view.weekSummary && (
        <Card className="rise rise-2 mt-4 border-l-4 border-l-gold">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            📋 Fechamento de domingo — resumo da semana
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">Sessões</p>
              <p className="score text-2xl text-bone">
                {view.weekSummary.sessions}
                <span className="text-base text-steel-dim">/5</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">PRs batidos</p>
              <p className="score text-2xl text-ember-hot">{view.weekSummary.prs.length}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">Volume</p>
              <p className="score text-2xl text-bone">{formatKg(view.weekSummary.volume)}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">Calorias (est.)</p>
              <p className="score text-2xl text-gold">~{view.weekSummary.kcal.toLocaleString("pt-BR")}</p>
            </div>
          </div>
          {view.weekSummary.prs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {view.weekSummary.prs.map((pr) => (
                <span
                  key={pr}
                  className="inline-flex items-center gap-1 rounded bg-ember px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-coal"
                >
                  🔥 PR! {pr}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 font-mono text-[9px] text-steel-dim">
            kcal estimadas por METs (musculação ~60 min/sessão + cardio e esporte por minutos)
            {view.weekSummary.z2Minutes > 0 && ` · ${view.weekSummary.z2Minutes}′ de Zona 2`}
          </p>
        </Card>
      )}

      {/* Fita: últimos 7 dias (ciclo) ou semana planejada (calendário) */}
      <div className="rise rise-2 mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {mode === "ciclo" ? "Últimos 7 dias" : "Sua semana"}
          </p>
          <div className="flex items-center gap-3 font-mono text-[9px] text-steel-dim">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-ember" /> feito
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm border border-ember" /> hoje
            </span>
            <button
              onClick={toggleMode}
              className="underline decoration-dotted underline-offset-2 transition-colors hover:text-bone"
              title="Alternar entre ciclo rotativo e semana fixa por dia"
            >
              {mode === "ciclo" ? "ver semana fixa" : "ver ciclo"}
            </button>
          </div>
        </div>
        {mode === "ciclo" ? (
          <div className="grid grid-cols-7 gap-1.5">
            {view.strip.map((d) => {
              const allEasy =
                d.done.length > 0 &&
                d.done.every((s) => s === "cardioZ2" || s === "sport")
              return (
                <div key={d.key} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "font-mono text-[9px]",
                      d.isToday ? "font-bold text-ember" : "text-steel-dim"
                    )}
                  >
                    {d.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-10 w-full items-center justify-center rounded border text-[10px] font-semibold",
                      d.done.length > 0
                        ? allEasy
                          ? "border-zone/0 bg-zone text-coal"
                          : "border-ember/0 bg-ember text-coal"
                        : d.isToday
                          ? "today-pulse border-ember text-ember"
                          : "border-seam bg-iron text-steel-dim"
                    )}
                    style={{ fontFamily: "var(--font-condensed)" }}
                    title={
                      d.done.length > 0
                        ? d.done.map((s) => PLAN_BY_ID[s].title).join(" + ")
                        : "Sem registro"
                    }
                  >
                    {d.done.length > 0
                      ? d.done
                          .map((s) =>
                            PLAN_BY_ID[s].title
                              .replace("Upper ", "U")
                              .replace("Lower ", "L")
                              .replace("Cardio Zona 2", "Z2")
                              .replace("Esporte", "ESP")
                          )
                          .join("·")
                      : "—"}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {view.days.map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono text-[9px]",
                    d.isToday ? "font-bold text-ember" : "text-steel-dim"
                  )}
                >
                  {d.label}
                </span>
                <div
                  className={cn(
                    "flex h-10 w-full items-center justify-center rounded border text-[10px] font-semibold",
                    d.done
                      ? "border-ember/0 bg-ember text-coal"
                      : d.isToday
                        ? "today-pulse border-ember text-ember"
                        : d.session.kind === "rest"
                          ? "border-seam text-steel-dim"
                          : d.isPast
                            ? "border-seam bg-iron text-steel-dim line-through"
                            : "border-seam bg-iron text-steel"
                  )}
                  style={{ fontFamily: "var(--font-condensed)" }}
                  title={d.session.title}
                >
                  {d.done ? (
                    <Check size={14} strokeWidth={3} />
                  ) : d.session.kind === "rest" ? (
                    "—"
                  ) : d.session.kind === "cardio" ? (
                    "Z2"
                  ) : d.session.kind === "sport" ? (
                    "ESP"
                  ) : (
                    d.session.title.replace("Upper ", "U").replace("Lower ", "L")
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.workouts.length === 0 && (
        <p className="mt-4 rounded border border-seam bg-iron px-3 py-2.5 text-xs text-steel">
          Banco zerado e pronto: registre seu primeiro treino na aba{" "}
          <Link href="/treino" className="font-semibold text-ember">
            Treino
          </Link>{" "}
          e os gráficos ganham vida.
        </p>
      )}

      {/* Readiness / fadiga — razão carga aguda : base crônica */}
      <Card
        className={cn(
          "rise rise-3 mt-4 border-l-4",
          READINESS_UI[view.readiness.level].border
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              Prontidão · Carga interna
            </p>
            <p className="mt-1 text-base font-semibold text-bone">
              {READINESS_UI[view.readiness.level].emoji}{" "}
              {READINESS_UI[view.readiness.level].title}
            </p>
            <p className="mt-0.5 text-xs text-steel">
              {READINESS_UI[view.readiness.level].desc}
            </p>
          </div>
          {view.readiness.ratio !== null && (
            <div className="shrink-0 text-right">
              <p className="score text-2xl text-bone">
                {Math.round(view.readiness.ratio * 100)}%
              </p>
              <p className="font-mono text-[9px] text-steel-dim">
                da base de {Math.round(view.readiness.chronic).toLocaleString("pt-BR")} AU/sem
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Sono — recuperação diária */}
      <Card className="rise rise-3 mt-4 border-l-4 border-l-[#a78bfa]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              <Moon size={12} className="text-[#a78bfa]" /> Sono
            </p>
            <p className="mt-1 text-base font-semibold text-bone">
              {view.sleepMetrics.latest
                ? formatSleepDuration(view.sleepMetrics.latest.durationMin)
                : "Sem registro"}
            </p>
            <p className="mt-0.5 text-xs text-steel">
              {view.sleepMetrics.latest
                ? `${view.sleepMetrics.latest.sleptAt} → ${view.sleepMetrics.latest.wokeAt}`
                : "Registre a última noite na aba Medidas."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="score text-2xl text-bone">
              {formatSleepDuration(view.sleepMetrics.avg7Min)}
            </p>
            <p className="font-mono text-[9px] text-steel-dim">
              média 7d · {view.sleepMetrics.registered7}/7
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-seam pt-3 font-mono text-[10px]">
          <div>
            <p className="uppercase tracking-wider text-steel-dim">Dívida</p>
            <p className="mt-0.5 text-bone">
              {formatSleepDuration(view.sleepMetrics.debt7Min)}
            </p>
          </div>
          <div>
            <p className="uppercase tracking-wider text-steel-dim">Regularidade</p>
            <p className="mt-0.5 text-bone">{view.sleepMetrics.consistency.label}</p>
          </div>
        </div>
        <Link
          href="/medidas"
          className="mt-3 inline-flex text-xs font-semibold text-[#a78bfa] underline decoration-dotted underline-offset-4"
        >
          registrar sono
        </Link>
      </Card>

      {/* Stats da semana */}
      <div className="rise rise-3 mt-4 grid grid-cols-2 gap-3">
        <StatCard
          label={mode === "ciclo" ? "Sessões · 7 dias" : "Sessões na semana"}
          value={
            <>
              {mode === "ciclo" ? view.roll.sessions : view.thisWeek.sessions}
              <span className="text-lg text-steel-dim">/5</span>
            </>
          }
          detail={`meta: 4 musc + 1 cardio${view.streak > 1 ? ` · ${view.streak} sem. seguidas 🔥` : ""}`}
        />
        <StatCard
          label="Volume da semana"
          value={formatKg(view.thisWeek.volume)}
          detail={
            view.volumeDelta !== null
              ? `${view.volumeDelta >= 0 ? "+" : ""}${view.volumeDelta}% vs semana passada`
              : "—"
          }
        />
        <StatCard
          label={mode === "ciclo" ? "Zona 2 · 7 dias" : "Zona 2 na semana"}
          value={`${mode === "ciclo" ? view.roll.z2 : view.thisWeek.z2}′`}
          detail={`meta ${Z2_TARGET}–70 min · inegociável`}
          accent="zone"
        />
        <StatCard
          label="Peso atual"
          value={
            view.currentWeight !== undefined
              ? `${view.currentWeight.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}`
              : "—"
          }
          detail={
            view.weightDelta !== null
              ? `${view.weightDelta > 0 ? "+" : ""}${view.weightDelta.toFixed(1).replace(".", ",")} kg desde o início`
              : "registre na aba Medidas"
          }
          accent="gold"
        />
      </div>

      {/* Hidratação de hoje — registro com 1 tap */}
      <Card className="rise rise-4 mt-4 border-l-4 border-l-[#38bdf8]">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            <Droplets size={12} className="text-[#38bdf8]" /> Hidratação
          </p>
          <p className="font-mono text-xs">
            <span className="font-semibold text-bone">
              {(view.waterToday / 1000).toFixed(2).replace(".", ",")} L
            </span>
            <span className="text-steel-dim">
              {" "}/ {(view.waterGoal / 1000).toFixed(1).replace(".", ",")} L
            </span>
          </p>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-iron-2">
          <div
            className="h-full rounded-full bg-[#38bdf8] transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.round((view.waterToday / view.waterGoal) * 100))}%`,
            }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {[250, 500, 750].map((ml) => (
            <button
              key={ml}
              onClick={() => {
                addWater(ml)
                setLastWaterAdd(ml)
              }}
              className="flex-1 rounded border border-seam py-2 font-mono text-xs font-semibold text-steel transition-colors hover:border-[#38bdf8]/50 hover:text-bone active:scale-95"
            >
              +{ml} ml
            </button>
          ))}
          {lastWaterAdd !== null && (
            <button
              onClick={() => {
                addWater(-lastWaterAdd)
                setLastWaterAdd(null)
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-seam text-steel-dim transition-colors hover:text-bone active:scale-95"
              aria-label="Desfazer último registro de água"
              title={`Desfazer +${lastWaterAdd} ml`}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
        <p className="mt-2 font-mono text-[9px] text-steel-dim">
          meta ~37 ml/kg pelo último peso · desidratação piora fôlego e causa tontura
        </p>
      </Card>

      {/* Treino semanal — tonelagem total ou séries duras por grupo muscular */}
      <SectionTitle>Treino — 6 semanas</SectionTitle>
      <Card className="rise rise-4">
        <div className="mb-3 flex gap-1.5">
          {(["grupos", "total"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVolumeView(v)}
              className={cn(
                "rounded border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors",
                volumeView === v
                  ? "border-ember bg-ember/10 text-ember"
                  : "border-seam text-steel hover:text-bone"
              )}
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {v === "grupos" ? "Séries duras" : "Tonelagem"}
            </button>
          ))}
        </div>
        {volumeView === "total" ? (
          <>
            <WeeklyVolumeChart
              data={view.weeks.map((w) => ({ label: w.label, volume: w.volume }))}
            />
            <p className="mt-2 font-mono text-[10px] text-steel-dim">
              cada barra representa uma semana calendário (seg-dom)
            </p>
          </>
        ) : (
          <>
            <MuscleVolumeChart
              data={view.weeks.map((w) => ({ label: w.label, ...w.groups }))}
              groups={MUSCLE_GROUPS}
              valueSuffix=" séries"
              yTickFormatter={(v) => String(Math.round(v))}
              tooltipValueFormatter={(v) => String(Math.round(v))}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {view.groupShare.map((g) => (
                <div key={g.id} className="flex items-center gap-2 font-mono text-[10px]">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: g.color }}
                  />
                  <span className="text-steel">{g.id}</span>
                  <span className="ml-auto text-bone">
                    {g.pct > 0 ? `${g.pct}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-steel-dim">
              barras por semana calendário (seg-dom) · % das séries duras nas últimas 4 semanas · RIR 4+ não conta como série dura
            </p>
          </>
        )}
      </Card>

      {/* Progressão de força */}
      <SectionTitle>Força — 1RM estimada</SectionTitle>
      <Card className="rise rise-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {KEY_LIFTS.map((k) => (
            <button
              key={k.id}
              onClick={() => setLift(k.id)}
              className={cn(
                "rounded border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors",
                lift === k.id
                  ? "border-ember bg-ember/10 text-ember"
                  : "border-seam text-steel hover:text-bone"
              )}
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {k.label}
            </button>
          ))}
        </div>
        {view.strength.length > 0 ? (
          <StrengthChart data={view.strength} />
        ) : (
          <p className="py-10 text-center text-xs text-steel-dim">
            Sem registros deste exercício ainda — salve um treino na aba Treino.
          </p>
        )}
        <p className="mt-2 font-mono text-[10px] text-steel-dim">
          Epley com reps ajustadas por RIR quando informado · PRs continuam pela fórmula clássica
        </p>
      </Card>

      {/* Zona 2 */}
      <SectionTitle accent="zone">Base aeróbica — min/semana</SectionTitle>
      <Card className="rise rise-6 border-l-4 border-l-zone">
        <ZoneChart
          data={view.weeks.map((w) => ({ label: w.label, minutes: w.z2 }))}
          target={Z2_TARGET}
        />
        <p className="mt-2 text-xs text-steel">
          É a Zona 2 que mata a tontura no futsal — terça + 20′ após o Lower B.
        </p>
      </Card>

      {/* Conquistas Xbox-style */}
      <SectionTitle accent="steel">
        Conquistas — {view.achievements.filter((a) => a.unlocked).length}/
        {view.achievements.length}
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {view.achievements.map((a) => (
          <div
            key={a.id}
            className={cn(
              "rounded-lg border p-3",
              a.unlocked ? "border-gold/40 bg-gold/5" : "border-seam bg-iron"
            )}
            title={a.desc}
          >
            <div className="flex items-center gap-2">
              <span className={cn("text-xl", !a.unlocked && "opacity-40 grayscale")}>
                {a.emoji}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-xs font-semibold",
                    a.unlocked ? "text-gold" : "text-bone"
                  )}
                >
                  {a.name}
                </p>
                <p className="truncate text-[10px] text-steel-dim">{a.desc}</p>
              </div>
            </div>
            {a.unlocked ? (
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-gold">
                ✓ Desbloqueada
              </p>
            ) : (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-iron-2">
                  <div
                    className="h-full rounded-full bg-steel-dim"
                    style={{
                      width: `${Math.min(100, Math.round((a.current / a.target) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-1 font-mono text-[9px] text-steel-dim">
                  {a.unit === "kg"
                    ? `${formatKg(Math.round(a.current))} / ${formatKg(a.target)}`
                    : a.unit === "min"
                      ? `${a.current}′ / ${a.target}′`
                      : `${a.current} / ${a.target}`}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

    </main>
  )
}
