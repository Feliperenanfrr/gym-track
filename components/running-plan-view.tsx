import {
  Activity,
  Award,
  Check,
  Footprints,
  Pencil,
  ShieldAlert,
  Timer,
} from "lucide-react"
import { formatPrescription } from "@/lib/measure"
import {
  RUN_LADDER,
  RUN_STAGE_BY_ID,
  RUNNING_BASE_BENCHMARK,
  RUNNING_PLAN,
  RUNNING_PREVENTION_RULES,
  RUNNING_RACE_DAY_CHECKLIST,
  RUNNING_RACE_PROJECTIONS,
  RUNNING_SHOE_DETAIL,
  RUNNING_SHOE_NAME,
  RUNNING_STRAVA_SEGMENT,
  RUNNING_TRANSITION_TIPS,
  formatDurationClock,
  runningTodayView,
} from "@/lib/running-plan"
import { SessionPlan, WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Card, SectionTitle } from "./ui"

export function RunningPlanView({
  sessions = RUNNING_PLAN,
  workouts = [],
  today = new Date(),
  onEditTemplate,
}: {
  sessions?: SessionPlan[]
  workouts?: WorkoutLog[]
  today?: Date
  onEditTemplate?: (session: SessionPlan) => void
}) {
  const view = runningTodayView(workouts, today)
  const completedSet = new Set(view.completedStageIds)
  const routineSessions = sessions.filter(
    (s) => s.id === "runFootA" || s.id === "runStrengthB"
  )

  return (
    <>
      {/* ---------- objetivo ativo ---------- */}
      <Card className="rise rise-1 mt-3 overflow-hidden border-l-4 border-l-zone">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-zone">
              <Footprints size={12} /> Plano 5 km · Sáb 28/11
            </p>
            <h2 className="stencil mt-1.5 text-2xl text-bone">
              Corrida Beneficente 5 km
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-zone/30 bg-zone/10 px-2.5 py-1 font-mono text-[10px] text-zone">
            {view.daysUntilRace === 0
              ? "Hoje"
              : view.daysUntilRace > 0
                ? `${view.daysUntilRace}d p/ prova`
                : "Pós-prova"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-steel">
          Meta única:{" "}
          <span className="font-semibold text-bone">
            completar os 5 km sem se machucar — tempo é bônus
          </span>
          . O app adapta o próximo degrau pelo que você de fato rodou e pela sua dor no
          dia seguinte, sem quebrar se um treino sair mais curto, longo ou fora de dia.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["1º", "Progressão", "dor ≤ 3/10 avança"],
            ["2º", "Teto ~45′", "poupa sola/canela"],
            ["3º", `${view.totalDistanceKm.toLocaleString("pt-BR")} km`, `${view.totalRuns} corridas no ciclo`],
          ].map(([n, t, sub]) => (
            <div key={t} className="rounded border border-seam bg-iron-2 p-2">
              <p className="score text-lg text-zone">{n}</p>
              <p className="text-xs font-semibold text-bone">{t}</p>
              <p className="font-mono text-[10px] leading-tight text-steel-dim">{sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- escada adaptativa ---------- */}
      <SectionTitle accent="zone">Escada de progressão</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-zone p-0">
        {RUN_LADDER.map((stage, index) => {
          const done = completedSet.has(stage.id)
          const isNext = view.nextStage.id === stage.id
          return (
            <div
              key={stage.id}
              className={cn(
                "px-4 py-3",
                index < RUN_LADDER.length - 1 && "border-b border-seam",
                isNext && "bg-zone/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                        done
                          ? "bg-zone text-coal"
                          : isNext
                            ? "border border-zone text-zone"
                            : "bg-iron-2 text-steel-dim"
                      )}
                    >
                      {done ? <Check size={11} strokeWidth={3} /> : index + 1}
                    </span>
                    <span className="font-semibold text-bone">{stage.label}</span>
                    {isNext && (
                      <span className="rounded-full border border-zone/40 bg-zone/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zone">
                        Próximo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-steel-dim">
                    {stage.weekLabel}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-steel">{stage.note}</p>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px]">
                  <p className="text-bone">~{stage.targetMinutes} min</p>
                  <p className="text-[10px] text-steel-dim">teto {stage.ceilingMinutes}′</p>
                </div>
              </div>
            </div>
          )
        })}
        <div className="border-t border-seam bg-coal/50 px-4 py-2.5 text-xs text-steel">
          <span className="font-semibold text-gold">Substituição segura:</span> se sola ou
          canela doer &gt; 3/10 ao andar, use{" "}
          <span className="text-bone">{RUN_STAGE_BY_ID["walk-sub"].label}</span> sem culpa e
          sem avançar degrau.
        </div>
      </Card>

      {/* ---------- marcos & projeções ---------- */}
      <SectionTitle accent="gold">Marcos & projeção 5 km</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-gold">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
          <Award size={12} /> Segmento Strava · {RUNNING_STRAVA_SEGMENT.name} ({RUNNING_STRAVA_SEGMENT.distanceKm} km)
        </p>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded border border-seam bg-coal/60 p-2.5">
            <p className="font-mono text-[10px] text-steel-dim">Base · 07/11</p>
            <p className="mt-0.5 text-sm font-semibold text-bone">
              {RUNNING_BASE_BENCHMARK.distanceKm.toLocaleString("pt-BR")} km ·{" "}
              {formatDurationClock(RUNNING_BASE_BENCHMARK.durationSec)}
            </p>
            <p className="font-mono text-[11px] text-zone">
              pace {RUNNING_BASE_BENCHMARK.paceLabel} · Seg 16:28 · FC {RUNNING_BASE_BENCHMARK.avgBpm}
            </p>
          </div>
          <div className="rounded border border-seam bg-coal/60 p-2.5">
            <p className="font-mono text-[10px] text-steel-dim">Ensaio 5 km (Açude Velho)</p>
            <p className="mt-0.5 text-sm font-semibold text-bone">
              {view.benchmarks.rehearsal
                ? `${view.benchmarks.rehearsal.distanceKm.toLocaleString("pt-BR")} km · ${formatDurationClock(view.benchmarks.rehearsal.durationSec)}`
                : "A registrar (Sem. 3)"}
            </p>
            <p className="font-mono text-[11px] text-steel">
              {view.benchmarks.rehearsal?.paceLabel ?? "Comparar mesmo segmento 1,64 km"}
            </p>
          </div>
          <div className="rounded border border-seam bg-coal/60 p-2.5">
            <p className="font-mono text-[10px] text-steel-dim">Prova · 28/11</p>
            <p className="mt-0.5 text-sm font-semibold text-bone">
              {view.benchmarks.race
                ? `${view.benchmarks.race.distanceKm.toLocaleString("pt-BR")} km · ${formatDurationClock(view.benchmarks.race.durationSec)}`
                : "Dia 28/11/2026"}
            </p>
            <p className="font-mono text-[11px] text-steel">
              {view.benchmarks.race?.paceLabel ?? "Completar 5 km sem lesão"}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-seam pt-3">
          {view.benchmarks.best5kFromGpx && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded border border-zone/30 bg-zone/5 px-3 py-2 text-xs">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-zone">
                  Melhor trecho contínuo de 5 km (GPX)
                </p>
                <p className="mt-0.5 text-steel-dim">
                  Extraído em{" "}
                  {new Date(`${view.benchmarks.best5kFromGpx.date}T12:00:00`).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="text-right font-mono">
                <p className="font-semibold text-bone">
                  {formatDurationClock(view.benchmarks.best5kFromGpx.durationSec)}
                </p>
                <p className="text-[10px] text-zone">
                  {view.benchmarks.best5kFromGpx.paceLabel ?? ""}
                </p>
              </div>
            </div>
          )}
          <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
            Cenários de ritmo na prova
          </p>
          <div className="mt-2 space-y-1.5">
            {RUNNING_RACE_PROJECTIONS.map((row) => (
              <div
                key={row.scenario}
                className="flex items-center justify-between gap-3 rounded border border-seam bg-iron-2/60 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-bone">{row.scenario}</span>
                  <span className="ml-2 text-steel-dim">{row.detail}</span>
                </div>
                <div className="shrink-0 text-right font-mono">
                  <span className="text-gold">{row.estimate}</span>
                  <span className="ml-2 text-[10px] text-steel-dim">{row.pace}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ---------- tênis & regras ---------- */}
      <SectionTitle accent="zone">Tênis, transição & prevenção</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-zone space-y-3">
        <div className="flex items-center justify-between gap-3 rounded border border-seam bg-coal/60 p-2.5">
          <div>
            <p className="text-xs font-semibold text-bone">{RUNNING_SHOE_NAME}</p>
            <p className="font-mono text-[10px] text-steel-dim">{RUNNING_SHOE_DETAIL}</p>
            <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
              Alternativo (ex.: 06/11): Fila Lite Progress · contabilizado separado
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-zone/30 bg-zone/10 px-2.5 py-1 font-mono text-xs font-semibold text-zone">
            {view.shoeSessions} sessões
          </span>
        </div>

        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zone">
            <Timer size={12} /> Execução de cada corrida
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-steel">
            {RUNNING_TRANSITION_TIPS.map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </div>

        <div className="border-t border-seam pt-2.5">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gold">
            <ShieldAlert size={12} /> Trava de dor e descanso
          </p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-steel">
            {RUNNING_PREVENTION_RULES.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </div>
      </Card>

      {/* ---------- rotinas A e B ---------- */}
      <SectionTitle accent="ember">Rotinas complementares (Pé & Força)</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-steel">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-steel">
          <Activity size={12} /> Fase atual da Rotina B · {view.strengthBGuidance.label}
        </p>
        <p className="mt-1 text-xs text-steel-dim">{view.strengthBGuidance.note}</p>
      </Card>

      {routineSessions.map((session) => (
        <div key={session.id} className="mb-4">
          <Card className="rise overflow-hidden border-l-4 border-l-ember p-0">
            <div className="border-b border-seam bg-iron-2/40 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="stencil text-lg text-bone">{session.title}</h3>
                  <p className="text-xs text-steel-dim">{session.subtitle}</p>
                </div>
                {onEditTemplate && (
                  <button
                    type="button"
                    onClick={() => onEditTemplate(session)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-seam px-2.5 py-1.5 text-xs font-semibold text-steel transition-colors hover:border-ember/40 hover:text-bone"
                  >
                    <Pencil size={12} /> Editar template
                  </button>
                )}
              </div>
              {session.description && (
                <p className="mt-1.5 text-xs leading-relaxed text-steel">
                  {session.description}
                </p>
              )}
            </div>
            <div>
              {session.exercises.map((exercise, idx) => (
                <div
                  key={exercise.id}
                  className={cn(
                    "px-4 py-2.5",
                    idx < session.exercises.length - 1 && "border-b border-seam"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-bone">{exercise.name}</span>
                    <span className="shrink-0 font-mono text-xs text-ember-hot">
                      {formatPrescription(exercise)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-steel-dim">{exercise.note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}

      {/* ---------- checklist da prova ---------- */}
      <SectionTitle accent="gold">Checklist · Sábado 28/11</SectionTitle>
      <Card className="rise mb-6 border-l-4 border-l-gold">
        <ul className="space-y-1.5 text-xs leading-relaxed text-steel">
          {RUNNING_RACE_DAY_CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-gold" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
