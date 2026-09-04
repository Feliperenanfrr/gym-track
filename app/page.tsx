"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, CloudOff, Droplets, FileText, History, LogOut, Moon, RotateCcw } from "lucide-react"
import {
  ConsistencyChart,
  MuscleVolumeChart,
  AcwrChart,
  StagnationChart,
  TopSetChart,
  WeeklyVolumeChart,
  ZoneChart,
} from "@/components/charts"
import { TrainingCalendar } from "@/components/training-calendar"
import { CaloriePanel, EnergyPanel } from "@/components/energy-panels"
import { ProgramTabs } from "@/components/program-tabs"
import { Card, CollapsibleSection, PageHeader, Skeleton, StatCard } from "@/components/ui"
import { computeAchievements } from "@/lib/achievements"
import {
  consistencySummary,
  consistencyWeeks,
  trainingCalendar,
  weeklySessionTarget,
} from "@/lib/consistency"
import {
  ACWR_SAFE,
  computeRecovery,
  readinessSeries,
  RecoveryDriver,
} from "@/lib/readiness"
import {
  exerciseStrength,
  frequentExercises,
  stagnationBoard,
  STAGNATION_ALERT_SESSIONS,
} from "@/lib/strength"
import { energyBalanceSeries, energyReport } from "@/lib/energy"
import { intenseMinutes, zone2Minutes } from "@/lib/cardio"
import { enginePhaseFor, engineTodayView } from "@/lib/engine-plan"
import {
  cycleTodayView,
  getScheduleMode,
  last7Days,
  ScheduleMode,
  setScheduleMode,
} from "@/lib/cycle"
import {
  calorieTrend,
  type CalorieTrendRange,
  ReadinessLevel,
  waterGoalMl,
  weeklySummary,
  weightTrend7d,
} from "@/lib/insights"
import { hardSetsByGroup, MUSCLE_GROUPS } from "@/lib/muscles"
import { countsTowardProgramTarget, PLAN_BY_ID, planForProgram, sessionForWeekday } from "@/lib/plan"
import { formatWeight } from "@/lib/progression"
import { computeSleepMetrics, formatSleepDuration } from "@/lib/sleep"
import { useGymData } from "@/lib/store"
import { GymData, SessionId, SessionPlan, TrainingProgram } from "@/lib/types"
import { useOperationalDay } from "@/lib/use-operational-day"
import { useTrainingProgram } from "@/lib/use-training-program"
import { useWorkoutTemplates } from "@/lib/use-workout-templates"
import {
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

const HYPERTROPHY_Z2_TARGET = { min: 60, max: 70 }

const READINESS_UI: Record<
  ReadinessLevel,
  { emoji: string; title: string; border: string; dot: string }
> = {
  building: {
    emoji: "⚪",
    title: "Construindo base",
    border: "border-l-steel-dim",
    dot: "bg-steel-dim",
  },
  green: { emoji: "🟢", title: "Pronto pra carga", border: "border-l-zone", dot: "bg-zone" },
  yellow: {
    emoji: "🟡",
    title: "Atenção na recuperação",
    border: "border-l-gold",
    dot: "bg-gold",
  },
  red: { emoji: "🔴", title: "Alerta de fadiga", border: "border-l-ember", dot: "bg-ember" },
}

/**
 * A prontidão deixou de ser só ACWR: agora o nível é o pior entre carga, sono
 * e hidratação, e a frase nomeia QUAL deles puxou para baixo — sem isso o
 * semáforo diz "amarelo" sem dizer o que fazer a respeito.
 */
function recoveryMessage(level: ReadinessLevel, limiter: RecoveryDriver | null): string {
  if (level === "building" || !limiter) {
    return "Registre 2+ semanas de treino, sono e água para calibrar o sinal."
  }
  if (level === "green") return "Carga, sono e água dentro da faixa — pode progredir."
  if (limiter.id === "load") {
    return level === "red"
      ? "Carga bem acima da base recente — considere uma semana mais leve."
      : "Esforço acima da média das últimas 3 semanas. Capricha em sono e proteína."
  }
  if (limiter.id === "sleep") {
    return level === "red"
      ? "Sono é o limitador: média abaixo de 6 h. Corte carga antes que ela te corte."
      : "Sono é o limitador da semana. Antecipe o horário de dormir antes de subir carga."
  }
  return level === "red"
    ? "Hidratação bem abaixo da meta — piora fôlego e recuperação antes de qualquer outra coisa."
    : "Hidratação abaixo da meta. É o ajuste mais barato da semana."
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

function compactSessionTitle(
  sessionId: SessionId,
  templateById: Partial<Record<SessionId, SessionPlan>>
): string {
  if (sessionId === "engineForceA") return "FA"
  if (sessionId === "engineForceB") return "FB"
  if (sessionId === "engineMotor") return "4×4"
  if (sessionId === "engineIntervals") return "30/30"
  if (sessionId === "engineHome") return "CASA"
  if (sessionId === "bjjPull" || sessionId === "competitionLower") return "A"
  if (sessionId === "bjjBase" || sessionId === "competitionUpper") return "B"
  if (sessionId === "bjjEngine" || sessionId === "competitionPower") return "C"
  if (
    sessionId === "engineZ2" ||
    sessionId === "bjjZ2" ||
    sessionId === "competitionZ2" ||
    sessionId === "cardioZ2"
  )
    return "Z2"
  if (sessionId === "free") return "AVL"
  if (sessionId === "sport") return "ESP"
  return (templateById[sessionId] ?? PLAN_BY_ID[sessionId]).title
    .replace("Upper ", "U")
    .replace("Lower ", "L")
}

function buildWeeks(data: GymData, today: Date, program: TrainingProgram, rolling: boolean) {
  const weeks: {
    label: string
    volume: number
    z2: number
    intense: number
    sessions: number
    groups: ReturnType<typeof hardSetsByGroup>
  }[] = []
  for (let i = 5; i >= 0; i--) {
    // mesma régua dos cards: no ciclo/competição cada barra cobre os últimos
    // 7 dias corridos (a mais recente termina hoje); na semana fixa, seg-dom
    let end: Date
    if (rolling) {
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7)
    } else {
      end = mondayOf(today)
      end.setDate(end.getDate() - i * 7 + 6)
    }
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
    const startKey = toDateKey(start)
    const endKey = toDateKey(end)
    const ws = data.workouts.filter((w) => w.date >= startKey && w.date <= endKey)
    weeks.push({
      label: weekLabel(start),
      volume: ws.reduce((s, w) => s + workoutVolume(w), 0),
      z2: ws.reduce((s, w) => s + zone2Minutes(w), 0),
      intense: ws.reduce((s, w) => s + intenseMinutes(w), 0),
      sessions: ws.filter((w) => countsTowardProgramTarget(w.sessionId, program)).length,
      groups: hardSetsByGroup(ws),
    })
  }
  return weeks
}

export default function Dashboard() {
  const { data, error, pendingCount, addWater, signOut } = useGymData()
  const { program, selectProgram } = useTrainingProgram()
  const { templates, templateById } = useWorkoutTemplates()
  const today = useOperationalDay()
  const [lift, setLift] = useState<string | null>(null)
  const [strengthMode, setStrengthMode] = useState<"carga" | "e1rm">("carga")
  const [volumeView, setVolumeView] = useState<"grupos" | "total">("grupos")
  const [calorieRange, setCalorieRange] = useState<CalorieTrendRange>("all")
  const [lastWaterAdd, setLastWaterAdd] = useState<number | null>(null)
  const [mode, setMode] = useState<ScheduleMode>("ciclo")
  /** nudge de calibração (sem peso no banco) dispensado pelo usuário */
  const [nudgeDismissed, setNudgeDismissed] = useState(true)

  useEffect(() => {
    setMode(getScheduleMode())
    try {
      setNudgeDismissed(localStorage.getItem("gym-track:weight-nudge") === "off")
    } catch {
      /* ignore */
    }
  }, [])

  const dismissWeightNudge = () => {
    setNudgeDismissed(true)
    try {
      localStorage.setItem("gym-track:weight-nudge", "off")
    } catch {
      /* ignore */
    }
  }

  const toggleMode = () => {
    const next: ScheduleMode = mode === "ciclo" ? "calendario" : "ciclo"
    setScheduleMode(next)
    setMode(next)
  }

  const view = useMemo(() => {
    if (!data || !templates || !today || !program) return null
    const sessionById = (id: SessionId) => templateById[id] ?? PLAN_BY_ID[id]
    const hypertrophyPlan = planForProgram("hypertrophy", templates)
    const todayKey = toDateKey(today)
    const todaySession = sessionForWeekday(isoWeekday(today), hypertrophyPlan)
    const todayDone = data.workouts.some(
      (w) => w.date === todayKey && w.sessionId === todaySession.id
    )

    // régua única: gráficos e cards usam a mesma janela em todos os modos
    const rolling = program === "engine" || mode === "ciclo"
    const weeks = buildWeeks(data, today, program, rolling)
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
      const planned = sessionForWeekday(i + 1, hypertrophyPlan)
      const logged = data.workouts.filter((w) => w.date === key && w.sessionId !== "rest")
      const done = logged.some((w) => w.sessionId === planned.id)
      return {
        label: WEEKDAY_SHORT[i],
        session: planned,
        done,
        // treinou outra coisa no dia (avulso, esporte): o dia não é vazio
        logged: !done && logged.length > 0,
        loggedTitle: logged.map((w) => sessionById(w.sessionId).title).join(" + "),
        isToday: key === todayKey,
        isPast: key < todayKey,
      }
    })

    // peso: tendência por médias móveis de 7 dias (média atual vs anterior)
    const weights = data.body.filter((b) => (b.weightKg ?? 0) > 0)
    const currentWeight = weights[weights.length - 1]?.weightKg
    const weightTrend = weightTrend7d(data.body, today)

    // Força: o seletor sai da frequência real dos últimos 90 dias, não de uma
    // lista fixa que oferecia terra (zero registros) e escondia os três
    // exercícios mais treinados.
    const liftOptions = frequentExercises(data.workouts, today, { limit: 6 })
    const activeLiftId =
      liftOptions.find((option) => option.id === lift)?.id ?? liftOptions[0]?.id ?? null
    const strength = activeLiftId
      ? exerciseStrength(data.workouts, activeLiftId)
      : null

    // streak e dias ativos
    const firstWorkout = data.workouts.length > 0 ? fromDateKey(data.workouts[0].date) : null
    const daysActive = firstWorkout ? daysSince(firstWorkout, today) + 1 : 0

    // Consistência: a variável que explica o bloco. O "streak" antigo contava
    // semanas com PELO MENOS UM treino — uma sessão solta salvava a semana e a
    // métrica dizia que estava tudo bem. Agora conta semanas cumprindo o alvo.
    const consistency = consistencySummary(data.workouts, today, program)
    const consistencyChart = consistencyWeeks(data.workouts, today, program)
    const calendar = trainingCalendar(data.workouts, today)
    const weeklyTarget = weeklySessionTarget(program, monday)
    const streak = consistency.weeksOnTarget

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

    const readiness = computeRecovery(data, today)
    const readinessTrend = readinessSeries(data.workouts, today, 90)
    const stagnation = stagnationBoard(data.workouts, today)
    // fechamento de domingo: resumo da semana corrente
    const weekSummary =
      isoWeekday(today) === 7 ? weeklySummary(data, monday, program) : null
    const achievements = computeAchievements(data, today)
    const calories = {
      all: calorieTrend(data, today, "all"),
      "12w": calorieTrend(data, today, "12w"),
    }
    const energy = energyReport(data, today)
    const energySeries = energyBalanceSeries(data, today)

    // hidratação de hoje
    const waterToday = data.hydration.find((h) => h.date === todayKey)?.ml ?? 0
    const waterGoal = waterGoalMl(data.body)
    const sleepMetrics = computeSleepMetrics(data.sleep, today)

    // modo ciclo: próximo da fila + fita dos últimos 7 dias
    const cycleView = cycleTodayView(data.workouts, today)
    const cycle = cycleView.suggestion
    const strip = last7Days(data.workouts, today)
    const engineView = engineTodayView(data.workouts, today)
    const enginePhase = enginePhaseFor(today)

    // card principal unificado entre os dois modos
    const headSession =
      program === "engine"
        ? sessionById(engineView.sessionId)
        : mode === "ciclo"
          ? sessionById(cycleView.sessionId)
          : todaySession
    const headDone =
      program === "engine" ? engineView.done : mode === "ciclo" ? cycleView.done : todayDone
    /**
     * Sessão que continua pendente mesmo com treino registrado hoje (avulso,
     * tatame ou Z2 no lugar do lift). No calendário fixo, o pendente é o
     * próprio treino do dia enquanto ele não for salvo.
     */
    const headPending =
      program === "engine"
        ? engineView.pendingSessionId
        : mode === "ciclo"
          ? cycleView.pendingSessionId
          : todayDone
            ? null
            : todaySession.id
    const headPendingSession =
      headPending && headPending !== headSession.id ? sessionById(headPending) : null
    const headKicker =
      program === "engine"
        ? engineView.done
          ? "Treino registrado hoje"
          : "Próximo do ciclo de motor"
        : mode === "ciclo"
          ? cycleView.done
            ? "Hoje concluído"
            : "Próximo do ciclo"
          : "Treino de hoje"
    const headNote =
      program === "engine"
        ? headPendingSession
          ? `Registrado hoje, mas a semana ainda pede ${headPendingSession.title}. Cardio conta o dia; a sala é que segura a massa magra.`
          : engineView.done
            ? `Próxima sessão de sala: ${sessionById(engineView.nextSessionId).title}. O resto da semana é cardio.`
            : enginePhase.guidance
        : mode !== "ciclo"
          ? null
          : headPendingSession
            ? `Treino registrado hoje. O ciclo continua pedindo ${headPendingSession.title}.`
            : cycleView.completedLiftSessionId
              ? `Próximo do ciclo: ${sessionById(cycle.nextLiftId).title}.`
              : cycle.reason === "recovery"
                ? `2 dias seguidos de musculação — hoje recupera: Z2 leve ou descanso. Depois vem ${sessionById(cycle.nextLiftId).title}.`
                : cycle.reason === "regression"
                  ? `${cycle.daysSinceStrength ?? cycle.daysSinceLastLift} dias sem musculação (avulso conta) — repita ${sessionById(cycle.sessionId).title} sugerindo ~90% da carga.`
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
      weightTrend,
      strength,
      liftOptions,
      activeLiftId,
      readinessTrend,
      stagnation,
      daysActive,
      streak,
      consistency,
      consistencyChart,
      calendar,
      weeklyTarget,
      groupShare,
      readiness,
      weekSummary,
      achievements,
      calories,
      energy,
      energySeries,
      waterToday,
      waterGoal,
      sleepMetrics,
      strip,
      headSession,
      headDone,
      headPendingSession,
      headKicker,
      headNote,
      enginePhase,
    }
  }, [data, templates, templateById, today, lift, mode, program])

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

  if (!view || !templates || !today || !program) {
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
  const rollingView = program === "engine" || mode === "ciclo"
  // No ciclo de motor a meta de Zona 2 sobe a cada bloco; o intenso é contado
  // à parte e não entra nesta faixa.
  const z2Target =
    program === "engine" ? view.enginePhase.z2Target : HYPERTROPHY_Z2_TARGET
  const sessionTarget = program === "engine" ? view.enginePhase.weeklySessions : "5"

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
            <Link
              href="/relatorios"
              className="flex items-center gap-1.5 rounded border border-seam px-2.5 py-1.5 font-mono text-[10px] text-steel-dim transition-colors hover:border-steel hover:text-bone"
              title="Relatórios em PDF"
            >
              <FileText size={12} /> relatórios
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

      <ProgramTabs
        value={program}
        onChange={selectProgram}
        compact
        className="rise mb-4"
      />

      {/* Treino de hoje / próximo do ciclo */}
      <Card
        className={cn(
          "rise rise-1 relative overflow-hidden border-l-4",
          program === "engine" ? "border-l-zone" : "border-l-ember"
        )}
      >
        <div className="flex justify-between items-center">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {view.headKicker}
          </p>
          {view.daysActive > 0 && (
            <span className="font-mono text-[10px] text-steel-dim" title="Dias desde o primeiro treino">
              Dia {view.daysActive}
            </span>
          )}
        </div>
        <h2 className="stencil mt-1 text-3xl text-bone">{view.headSession.title}</h2>
        <p className="mt-0.5 text-sm text-steel">{view.headSession.subtitle}</p>
        {program === "engine" && (
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-zone">
            {view.enginePhase.label}
            <span className="ml-2 text-steel-dim">
              {view.enginePhase.cycleWeek !== null
                ? `semana ${view.enginePhase.cycleWeek}/12`
                : view.enginePhase.dates}
            </span>
          </p>
        )}
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
        {view.headDone && (
          <div className="mt-4 flex items-center gap-2 rounded bg-zone/10 px-3 py-2 text-sm font-semibold text-zone">
            <Check size={16} className="shrink-0" />
            {view.headPendingSession
              ? `${view.headSession.title} registrado hoje`
              : "Concluído — bom trabalho"}
          </div>
        )}
        {!view.headDone && view.headSession.kind === "rest" ? (
          <p className="mt-4 text-sm text-steel">
            Descanso total ou caminhada leve. Durma 7–9 h.
          </p>
        ) : (
          // treino já registrado mas com sessão pendente: o botão continua à mão,
          // agora nomeando o que falta em vez de fingir que o dia está vazio
          (!view.headDone || view.headPendingSession) && (
            <Link
              href="/treino"
              className={cn(
                "mt-3 inline-flex items-center gap-2 rounded px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors",
                view.headDone
                  ? "border border-seam text-steel hover:border-steel hover:text-bone"
                  : cn(
                      "text-coal",
                      program === "engine"
                        ? "bg-zone hover:bg-teal-300"
                        : "bg-ember hover:bg-ember-hot"
                    )
              )}
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {view.headPendingSession
                ? `Registrar ${view.headPendingSession.title}`
                : "Registrar treino"}{" "}
              <ArrowRight size={16} />
            </Link>
          )
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
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">Sessões</p>
              <p className="score text-2xl text-bone">
                {view.weekSummary.sessions}
                <span className="text-base text-steel-dim">/{sessionTarget}</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">PRs batidos</p>
              <p className="score text-2xl text-ember-hot">{view.weekSummary.prs.length}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">Volume</p>
              <p className="score text-2xl text-bone">{formatKg(view.weekSummary.volume)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">Calorias (est.)</p>
              {view.weekSummary.kcal !== null ? (
                <>
                  <p className="score text-2xl text-gold">
                    ~{view.weekSummary.kcal.toLocaleString("pt-BR")}
                  </p>
                  <p className="font-mono text-[10px] text-steel-dim">
                    faixa {view.weekSummary.kcalLow?.toLocaleString("pt-BR")}–
                    {view.weekSummary.kcalHigh?.toLocaleString("pt-BR")} kcal
                  </p>
                </>
              ) : (
                <>
                  <p className="score text-2xl text-steel-dim">—</p>
                  <p className="font-mono text-[10px] text-steel-dim">registre seu peso p/ estimar</p>
                </>
              )}
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
          <p className="mt-3 font-mono text-[10px] text-steel-dim">
            {view.weekSummary.kcal !== null
              ? "METs com a duração real e o esforço (sRPE) de cada treino · faixa ~−20%/+25% — estimativa, não medição"
              : "calorias precisam do seu peso no banco (aba Medidas)"}
            {view.weekSummary.z2Minutes > 0 && ` · ${view.weekSummary.z2Minutes}′ de Zona 2`}
          </p>
        </Card>
      )}

      {/* Fita: janela móvel no protocolo/ciclo ou semana planejada no calendário */}
      <div className="rise rise-2 mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {rollingView ? "Últimos 7 dias" : "Sua semana"}
          </p>
          <div className="flex items-center gap-3 font-mono text-[10px] text-steel-dim">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-ember" /> feito
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm border border-ember" /> hoje
            </span>
            {program === "hypertrophy" && (
              <button
                onClick={toggleMode}
                className="underline decoration-dotted underline-offset-2 transition-colors hover:text-bone"
                title="Alternar entre ciclo rotativo e semana fixa por dia"
              >
                {mode === "ciclo" ? "ver semana fixa" : "ver ciclo"}
              </button>
            )}
          </div>
        </div>
        {rollingView ? (
          <div className="grid grid-cols-7 gap-1.5">
            {view.strip.map((d) => {
              const allEasy =
                d.done.length > 0 &&
                d.done.every(
                  (s) =>
                    s === "cardioZ2" ||
                    s === "engineZ2" ||
                    s === "bjjZ2" ||
                    s === "competitionZ2" ||
                    s === "sport"
                )
              return (
                <div key={d.key} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "font-mono text-[10px]",
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
                        ? d.done.map((s) => (templateById[s] ?? PLAN_BY_ID[s]).title).join(" + ")
                        : "Sem registro"
                    }
                  >
                    {d.done.length > 0
                      ? d.done.map((id) => compactSessionTitle(id, templateById)).join("·")
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
                    "font-mono text-[10px]",
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
                      : d.logged
                        ? "border-zone/0 bg-zone text-coal"
                        : d.isToday
                          ? "today-pulse border-ember text-ember"
                          : d.session.kind === "rest"
                            ? "border-seam text-steel-dim"
                            : d.isPast
                              ? "border-seam bg-iron text-steel-dim line-through"
                              : "border-seam bg-iron text-steel"
                  )}
                  style={{ fontFamily: "var(--font-condensed)" }}
                  title={d.logged ? d.loggedTitle : d.session.title}
                >
                  {d.done || d.logged ? (
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

      {/* onboarding-lite: sem peso no banco, metas de kcal/água/proteína ficam cegas */}
      {!nudgeDismissed && !data?.body.some((b) => (b.weightKg ?? 0) > 0) && (
          <Card className="rise mt-4 border-l-4 border-l-gold">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-bone">Calibre suas metas</p>
                <p className="mt-1 text-xs leading-relaxed text-steel">
                  Sem peso registrado, calorias, água e proteína ficam sem referência.
                  Uma pesagem basta — de manhã, em jejum.
                </p>
              </div>
              <button
                onClick={dismissWeightNudge}
                className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-steel-dim transition-colors hover:text-bone"
                aria-label="Dispensar aviso"
              >
                ✕
              </button>
            </div>
            <Link
              href="/medidas#registrar-medidas"
              className="mt-3 inline-flex items-center gap-1.5 rounded bg-gold px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-coal transition-colors hover:bg-gold/85"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              Registrar peso agora
            </Link>
          </Card>
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
              {recoveryMessage(view.readiness.level, view.readiness.limiter)}
            </p>
          </div>
          {view.readiness.load.ratio !== null && (
            <div className="shrink-0 text-right">
              <p className="score text-2xl text-bone">
                {Math.round(view.readiness.load.ratio * 100)}%
              </p>
              <p className="font-mono text-[10px] text-steel-dim">
                da base de{" "}
                {Math.round(view.readiness.load.chronic).toLocaleString("pt-BR")} AU/sem
              </p>
            </div>
          )}
        </div>

        {/* Os três componentes, cada um com seu nível: o semáforo sozinho não
            diz O QUE ajustar. Sono e água entram aqui — antes eram gravados
            todo dia e não saíam em decisão nenhuma. */}
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-seam pt-3">
          {view.readiness.drivers.map((driver) => (
            <div key={driver.id} className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    READINESS_UI[driver.level].dot
                  )}
                />
                {driver.label}
              </p>
              <p className="mt-0.5 font-mono text-sm text-bone">{driver.value}</p>
            </div>
          ))}
        </div>
        {view.readiness.limiter && view.readiness.level !== "green" && (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-steel-dim">
            limitador: {view.readiness.limiter.label.toLowerCase()} &middot;{" "}
            {view.readiness.limiter.detail}
          </p>
        )}
      </Card>

      {/* Prontidão no tempo — o card diz onde está; a linha, para onde vai */}
      <CollapsibleSection
        title="Prontidão — 90 dias"
        badge={`${view.readinessTrend.readable} de ${view.readinessTrend.days} dias com base suficiente`}
      >
        <Card className="rise rise-3">
          {view.readinessTrend.readable > 0 ? (
            <>
              <AcwrChart data={view.readinessTrend.points} safe={ACWR_SAFE} />
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-steel-dim">
                Carga dos últimos 7 dias sobre a base das 3 semanas anteriores. A faixa
                turquesa (80&ndash;130%) é o território sustentável; a linha tracejada é a
                base. <span className="text-bone">Buraco na linha</span> é dia sem leitura
                &mdash; a base tinha menos de 3 dias de treino, e dividir por quase nada
                produz percentual de quatro dígitos que não descreve fadiga nenhuma.
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-xs text-steel-dim">
              Ainda sem base crônica em nenhum dia dos últimos 90. Três dias de treino em
              três semanas já destravam a leitura.
            </p>
          )}
        </Card>
      </CollapsibleSection>

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
            <p className="font-mono text-[10px] text-steel-dim">
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
          href="/medidas#registrar-sono"
          className="mt-3 inline-flex items-center gap-1.5 rounded bg-[#a78bfa] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-coal transition-colors hover:bg-[#c4b5fd]"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          <Moon size={13} /> Registrar sono
        </Link>
      </Card>

      {/* Stats da semana — mesma janela dos gráficos abaixo */}
      <div className="rise rise-3 mt-4 grid grid-cols-2 gap-3">
        <StatCard
          label={rollingView ? "Sessões · 7 dias" : "Sessões na semana"}
          value={
            <>
              {view.thisWeek.sessions}
              <span className="text-lg text-steel-dim">/{sessionTarget}</span>
            </>
          }
          detail={`${program === "engine" ? "meta: 2 força + 1–2 intenso + 3–4 Z2" : "meta: 4 musc + 1 cardio"}${view.streak > 0 ? ` · ${view.streak} sem. no alvo 🔥` : ""}`}
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
          label={rollingView ? "Zona 2 · 7 dias" : "Zona 2 na semana"}
          value={`${view.thisWeek.z2}′`}
          detail={
            view.thisWeek.intense > 0
              ? `meta ${z2Target.min}–${z2Target.max}′ · +${view.thisWeek.intense}′ intenso à parte`
              : program === "engine"
                ? `meta ${z2Target.min}–${z2Target.max} min · ${view.enginePhase.label.replace("Bloco ", "bloco ")}`
                : `meta ${z2Target.min}–${z2Target.max} min · inegociável`
          }
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
            view.weightTrend.delta !== null
              ? `${view.weightTrend.delta > 0 ? "+" : ""}${view.weightTrend.delta.toFixed(1).replace(".", ",")} kg vs média anterior`
              : "média 7d sem base comparável ainda"
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-steel-dim">
            meta ~37 ml/kg pelo último peso · desidratação piora fôlego e causa tontura
          </p>
          <Link
            href="/medidas#hidratacao"
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8] transition-colors hover:text-bone"
          >
            corrigir outro dia
          </Link>
        </div>
      </Card>

      {/* Gasto dos treinos: taxa semanal, composição e tendência num gráfico só. */}
      <CollapsibleSection title="Calorias dos treinos" accent="gold" defaultOpen>
        <Card className="rise rise-4 border-l-4 border-l-gold">
          <CaloriePanel
            trend={view.calories[calorieRange]}
            range={calorieRange}
            onRangeChange={setCalorieRange}
          />
        </Card>
      </CollapsibleSection>

      {/* A ponte entre o gasto e a balança: quanto você deve estar comendo. */}
      <CollapsibleSection title="Balanço energético" accent="gold" defaultOpen>
        <Card className="rise rise-4 border-l-4 border-l-gold">
          <EnergyPanel report={view.energy} series={view.energySeries} />
        </Card>
      </CollapsibleSection>

      {/* Consistência — a variável que explica o resultado do bloco */}
      <CollapsibleSection
        title="Consistência"
        badge={`${String(view.consistency.avgDaysPerWeek).replace(".", ",")}/sem`}
        defaultOpen
      >
        <Card className="rise rise-4">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                Aderência
              </p>
              <p className="score mt-0.5 text-2xl text-bone">
                {view.consistency.adherencePct}
                <span className="text-sm text-steel-dim">%</span>
              </p>
              <p className="font-mono text-[10px] text-steel-dim">{`${view.consistency.daysTrained} de ${view.consistency.daysInPeriod} dias`}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                Maior lacuna
              </p>
              <p
                className={cn(
                  "score mt-0.5 text-2xl",
                  view.consistency.longestGapDays >= 7 ? "text-ember-hot" : "text-bone"
                )}
              >
                {view.consistency.longestGapDays}
                <span className="text-sm text-steel-dim">d</span>
              </p>
              <p className="font-mono text-[10px] text-steel-dim">seguidos sem treino</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                Semanas no alvo
              </p>
              <p
                className={cn(
                  "score mt-0.5 text-2xl",
                  view.consistency.weeksOnTarget > 0 ? "text-zone" : "text-steel-dim"
                )}
              >
                {view.consistency.weeksOnTarget}
              </p>
              <p className="font-mono text-[10px] text-steel-dim">
                seguidas &middot; alvo {view.weeklyTarget}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-seam pt-4">
            <TrainingCalendar weeks={view.calendar} />
          </div>
        </Card>

        <Card className="rise rise-4 mt-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-steel-dim">
            Sessões por semana &middot; 12 semanas
          </p>
          <ConsistencyChart data={view.consistencyChart} target={view.weeklyTarget} />
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-steel-dim">
            Semana seg&ndash;dom fechada contra o alvo do programa: {" "}
            <span className="text-zone">verde</span> cumpriu, {" "}
            <span className="text-ember">brasa</span> ficou abaixo. A semana em curso
            vem mais clara &mdash; ainda dá para virar.
            {view.consistency.daysSinceLift !== null &&
              view.consistency.daysSinceLift >= 7 &&
              ` ${view.consistency.daysSinceLift} dias sem sala.`}
          </p>
        </Card>
      </CollapsibleSection>

      {/* Treino semanal — tonelagem total ou séries duras por grupo muscular */}
      <CollapsibleSection title="Treino — 6 semanas" defaultOpen>
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
              {rollingView
                ? "cada barra cobre 7 dias corridos · a mais recente termina hoje e ainda está em andamento"
                : "cada barra representa uma semana calendário (seg-dom)"}
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
              {rollingView
                ? "barras de 7 dias corridos, a última terminando hoje · "
                : "barras por semana calendário (seg-dom) · "}
              % das séries duras nas últimas 4 semanas · RIR 4+ não conta como série dura
            </p>
          </>
        )}
        </Card>
      </CollapsibleSection>

      {/* Progressão de força — carga do top set, não 1RM extrapolada */}
      <CollapsibleSection title="Força — carga do top set" defaultOpen>
        <Card className="rise rise-5">
        {view.liftOptions.length > 0 ? (
          <>
            <div
              className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1"
              style={{ overscrollBehaviorX: "contain" }}
            >
              {view.liftOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setLift(option.id)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                    view.activeLiftId === option.id
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-seam text-steel hover:text-bone"
                  )}
                  style={{ fontFamily: "var(--font-condensed)" }}
                >
                  {option.name}
                  <span className="ml-1.5 font-mono text-[10px] normal-case tracking-normal text-steel-dim">
                    {option.sets}
                  </span>
                </button>
              ))}
            </div>

            {view.strength && view.strength.last ? (
              <>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="score text-2xl text-ember-hot">
                      {formatWeight(view.strength.last.carga)}
                      <span className="ml-1 text-sm text-steel-dim">
                        kg &times; {view.strength.last.reps}
                        {view.strength.last.rir !== undefined
                          ? ` @RIR ${view.strength.last.rir}`
                          : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
                      última sessão &middot; {view.strength.last.label}
                      {view.strength.deltaKg !== null &&
                        ` · ${view.strength.deltaKg >= 0 ? "+" : ""}${formatWeight(view.strength.deltaKg)} kg no período`}
                    </p>
                  </div>
                  {/* 1RM só onde Epley se sustenta: séries de até 8 reps
                      efetivas. Extrapolar de 15 reps era o que fazia a mesma
                      cadeira extensora "variar" de 154 a 63 kg. */}
                  <div className="flex shrink-0 gap-1">
                    {(["carga", "e1rm"] as const).map((m) => {
                      const disabled =
                        m === "e1rm" && view.strength!.reliableE1rmPoints < 2
                      return (
                        <button
                          key={m}
                          onClick={() => !disabled && setStrengthMode(m)}
                          disabled={disabled}
                          title={
                            disabled
                              ? "Precisa de 2+ séries de até 8 reps efetivas (reps + RIR)"
                              : undefined
                          }
                          className={cn(
                            "rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-35",
                            strengthMode === m && !disabled
                              ? "border-ember text-ember"
                              : "border-seam text-steel-dim"
                          )}
                        >
                          {m === "carga" ? "carga" : "1RM est."}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <TopSetChart
                  data={view.strength.points}
                  mode={
                    strengthMode === "e1rm" && view.strength.reliableE1rmPoints >= 2
                      ? "e1rm"
                      : "carga"
                  }
                />

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-seam pt-3 font-mono text-[10px]">
                  <div>
                    <p className="uppercase tracking-wider text-steel-dim">Melhor carga</p>
                    <p className="mt-0.5 text-bone">
                      {formatWeight(view.strength.bestWeight)} kg
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-steel-dim">Sem subir carga</p>
                    <p
                      className={cn(
                        "mt-0.5",
                        (view.strength.sessionsSinceIncrease ?? 0) >= 4
                          ? "text-gold"
                          : "text-bone"
                      )}
                    >
                      {view.strength.sessionsSinceIncrease === null
                        ? "—"
                        : view.strength.sessionsSinceIncrease === 0
                          ? "subiu agora"
                          : `${view.strength.sessionsSinceIncrease} sessões`}
                    </p>
                  </div>
                </div>

                <p className="mt-2 font-mono text-[10px] leading-relaxed text-steel-dim">
                  {strengthMode === "e1rm" && view.strength.reliableE1rmPoints >= 2
                    ? `1RM estimada só das séries com até 8 reps efetivas (${view.strength.reliableE1rmPoints} de ${view.strength.points.length} sessões) — acima disso a extrapolação erra mais que o efeito.`
                    : "Carga da série mais pesada de cada sessão: dado bruto, sem extrapolação. Ponto dourado = carga recorde."}
                </p>
              </>
            ) : (
              <p className="py-10 text-center text-xs text-steel-dim">
                Sem registros deste exercício ainda — salve um treino na aba Treino.
              </p>
            )}
          </>
        ) : (
          <p className="py-10 text-center text-xs text-steel-dim">
            Registre uma sessão com carga para o painel escolher os exercícios.
          </p>
        )}
        </Card>
      </CollapsibleSection>

      {/* Estagnação — o número por exercício existia, mas custava seis toques */}
      <CollapsibleSection title="Estagnação — sem subir carga" badge={`${view.stagnation.filter((r) => r.sessionsSinceIncrease === null).length} paradas`}>
        <Card className="rise rise-5">
          {view.stagnation.length > 0 ? (
            <>
              <StagnationChart
                data={view.stagnation}
                alertAt={STAGNATION_ALERT_SESSIONS}
              />
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-steel-dim">
                Sessões desde o último aumento de carga, nos últimos 6 meses.
                <span className="text-ember"> Nunca</span> é coluna à parte de propósito:
                não é o mesmo que zero, que significa &ldquo;subiu na última sessão&rdquo;.
                A partir de {STAGNATION_ALERT_SESSIONS} sessões paradas o ponto fica
                <span className="text-gold"> dourado</span> &mdash; é onde muda o estímulo,
                não a força de vontade.
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-xs text-steel-dim">
              Precisa de pelo menos dois registros do mesmo exercício com carga.
            </p>
          )}
        </Card>
      </CollapsibleSection>

      {/* Zona 2 */}
      <CollapsibleSection title="Base aeróbica — min/semana" accent="zone" defaultOpen>
        <Card className="rise rise-6 border-l-4 border-l-zone">
        <ZoneChart
          data={view.weeks.map((w) => ({ label: w.label, z2: w.z2, intense: w.intense }))}
          target={z2Target.min}
        />
        <p className="mt-2 text-xs text-steel">
          {program === "engine"
            ? "3–4 sessões de 35–60′ a 122–138 bpm. É o volume que decide o gasto da semana e a gordura visceral — o intenso entra à parte, 1–2×."
            : "É a Zona 2 que mata a tontura no futsal — terça + 20′ após o Lower B."}
        </p>
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-steel-dim">
          barras usam a mesma janela dos cards acima
          {rollingView ? " (7 dias corridos)" : " (seg–dom)"}; a atual, mais clara,
          ainda está em andamento. <span className="text-ember">Intenso</span> entra
          empilhado, fora da meta de Z2 · esporte não conta.
        </p>
        </Card>
      </CollapsibleSection>

      {/* Conquistas Xbox-style */}
      <CollapsibleSection
        title="Conquistas"
        accent="gold"
        badge={`${view.achievements.filter((a) => a.unlocked).length}/${view.achievements.length}`}
      >
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
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-gold">
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
                 <p className="mt-1 font-mono text-[10px] text-steel-dim">
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
      </CollapsibleSection>

    </main>
  )
}
