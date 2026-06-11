"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, CloudOff, LogOut, History } from "lucide-react"
import { StrengthChart, WeeklyVolumeChart, ZoneChart } from "@/components/charts"
import { Card, PageHeader, SectionTitle, Skeleton, StatCard } from "@/components/ui"
import { PLAN_BY_ID, sessionForWeekday } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { GymData, SessionId, WorkoutLog } from "@/lib/types"
import {
  bestE1RM,
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

function weekLabel(monday: Date): string {
  return `${String(monday.getDate()).padStart(2, "0")}/${String(monday.getMonth() + 1).padStart(2, "0")}`
}

/** Z2 = sessão de cardio + finisher do Lower B (esporte não conta como base) */
function z2Minutes(w: WorkoutLog): number {
  if (w.sessionId === "sport") return 0
  return w.cardio?.minutes ?? 0
}

function buildWeeks(data: GymData, today: Date) {
  const currentMonday = mondayOf(today)
  const weeks: { monday: Date; label: string; volume: number; z2: number; sessions: number }[] = []
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
    })
  }
  return weeks
}

export default function Dashboard() {
  const { data, error, pendingCount, signOut } = useGymData()
  const [today, setToday] = useState<Date | null>(null)
  const [lift, setLift] = useState("bench")

  useEffect(() => {
    setToday(new Date())
  }, [])

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
          e1rm: Math.round(bestE1RM(entry) * 10) / 10,
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
    }
  }, [data, today, lift])

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

      {/* Treino de hoje */}
      <Card className="rise rise-1 relative overflow-hidden border-l-4 border-l-ember">
        <div className="flex justify-between items-center">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            Treino de hoje
          </p>
          {view.daysActive > 0 && (
            <span className="font-mono text-[9px] text-steel-dim" title="Dias desde o primeiro treino">
              Dia {view.daysActive}
            </span>
          )}
        </div>
        <h2 className="stencil mt-1 text-3xl text-bone">{view.todaySession.title}</h2>
        <p className="mt-0.5 text-sm text-steel">{view.todaySession.subtitle}</p>
        <p className="mt-2 font-mono text-xs text-steel-dim">
          {view.todaySession.duration}
          {view.todaySession.exercises.length > 0 &&
            ` · ${view.todaySession.exercises.length} exercícios`}
          {view.todaySession.cardioAfter && ` · +${view.todaySession.cardioAfter.minutes} min Z2`}
        </p>
        {view.todayDone ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded bg-zone/10 px-3 py-2 text-sm font-semibold text-zone">
            <Check size={16} /> Concluído — bom trabalho
          </div>
        ) : view.todaySession.kind === "rest" ? (
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

      {/* Fita da semana */}
      <div className="rise rise-2 mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.3em] text-steel"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            Sua semana
          </p>
          <div className="flex items-center gap-3 font-mono text-[9px] text-steel-dim">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-ember" /> feito
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm border border-ember" /> hoje
            </span>
          </div>
        </div>
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

      {/* Stats da semana */}
      <div className="rise rise-3 mt-4 grid grid-cols-2 gap-3">
        <StatCard
          label="Sessões na semana"
          value={
            <>
              {view.thisWeek.sessions}
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
          label="Zona 2 na semana"
          value={`${view.thisWeek.z2}′`}
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

      {/* Volume semanal */}
      <SectionTitle>Volume de treino — 6 semanas</SectionTitle>
      <Card className="rise rise-4">
        <WeeklyVolumeChart
          data={view.weeks.map((w) => ({ label: w.label, volume: w.volume }))}
        />
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
          Epley: carga × (1 + reps/30) da melhor série · queda leve no déficit é esperada
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

    </main>
  )
}
