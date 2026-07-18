import { AlertTriangle, CalendarDays, ShieldCheck, Trophy } from "lucide-react"
import {
  COMPETITION_COORDINATION_RULES,
  COMPETITION_GAME_DATE,
  COMPETITION_PLAN,
  COMPETITION_PROGRESSION,
  competitionPhaseFor,
  LAST_HEAVY_GYM_DATE,
} from "@/lib/competition-plan"
import { cn } from "@/lib/utils"
import { Card, SectionTitle } from "./ui"

function prescription(exercise: (typeof COMPETITION_PLAN)[number]["exercises"][number]) {
  const reps =
    exercise.repsMin === exercise.repsMax
      ? String(exercise.repsMin)
      : `${exercise.repsMin}–${exercise.repsMax}`
  return `${exercise.sets} × ${reps}${exercise.unit === "seconds" ? "s" : ""}`
}

export function CompetitionPlanView({ today }: { today: Date }) {
  const phase = competitionPhaseFor(today)
  const liftSessions = COMPETITION_PLAN.filter((session) => session.kind === "lift")
  const zone2 = COMPETITION_PLAN.find((session) => session.id === "competitionZ2")!

  return (
    <>
      <Card className="rise rise-1 mt-3 overflow-hidden border-l-4 border-l-gold">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
              <Trophy size={12} /> Protocolo ativo
            </p>
            <h2 className="stencil mt-1.5 text-2xl text-bone">Cornerback · 15/08</h2>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 font-mono text-[9px] text-gold">
            temporário
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-steel">
          A academia agora serve ao campo: <span className="font-semibold text-bone">manter
          força, transformar em explosão e preservar o frescor das pernas</span>. Nada de
          PR, falha ou volume para emagrecer até o campeonato.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded border border-seam bg-iron-2 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">
              Academia
            </p>
            <p className="mt-0.5 text-xs font-semibold text-bone">2–3 sessões · baixo volume</p>
          </div>
          <div className="rounded border border-seam bg-iron-2 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-steel-dim">
              Campo
            </p>
            <p className="mt-0.5 text-xs font-semibold text-bone">Sprint, cortes e coletivo</p>
          </div>
        </div>
      </Card>

      <Card className="rise rise-2 mt-3 border border-gold/30 bg-gold/5">
        <div className="flex items-start gap-2.5">
          <CalendarDays size={17} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-gold">{phase.label}</p>
              <span className="font-mono text-[9px] text-steel-dim">{phase.dates}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-steel">{phase.guidance}</p>
          </div>
        </div>
      </Card>

      <SectionTitle accent="steel">Coordenação com o campo</SectionTitle>
      <div className="space-y-2">
        {COMPETITION_COORDINATION_RULES.map((rule, index) => (
          <Card key={rule} className="rise flex gap-3 py-3">
            <span className="score mt-0.5 text-xl text-gold">{index + 1}</span>
            <p className="text-xs leading-relaxed text-steel">{rule}</p>
          </Card>
        ))}
      </div>

      <SectionTitle>Sessões de academia</SectionTitle>
      {liftSessions.map((session) => (
        <div key={session.id} className="mb-5">
          <Card className="rise overflow-hidden p-0">
            <div className="border-b border-gold/20 bg-gold/5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="stencil text-xl text-bone">{session.title}</h3>
                <span className="shrink-0 font-mono text-[9px] text-gold">
                  {session.duration}
                </span>
              </div>
              <p className="mt-1 text-xs text-gold">{session.subtitle}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-steel">
                {session.description}
              </p>
            </div>
            {session.exercises.map((exercise, index) => (
              <div
                key={exercise.id}
                className={cn(
                  "px-4 py-3",
                  index < session.exercises.length - 1 && "border-b border-seam"
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-bone">{exercise.name}</p>
                  <span className="shrink-0 font-mono text-[11px] text-gold">
                    {prescription(exercise)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-[9px] text-steel-dim">{exercise.nameEn}</p>
                  <span className="shrink-0 font-mono text-[9px] text-steel-dim">
                    descanso {exercise.rest}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-steel">{exercise.note}</p>
              </div>
            ))}
          </Card>
        </div>
      ))}

      <SectionTitle accent="zone">Zona 2 · sem HIIT na academia</SectionTitle>
      <Card className="rise border-l-4 border-l-zone">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-bone">{zone2.title}</p>
            <p className="text-xs text-zone">60–90 min por semana</p>
          </div>
          <span className="score text-2xl text-zone">125–140</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-steel">{zone2.description}</p>
        <p className="mt-2 rounded border border-zone/20 bg-zone/5 px-2.5 py-2 text-xs text-zone">
          Sugestão: 2–3 × 20–30 min. Na semana do jogo, 1 × 20 min fácil ou zero.
        </p>
      </Card>

      <SectionTitle accent="steel">Progressão até o jogo</SectionTitle>
      <div className="space-y-2">
        {COMPETITION_PROGRESSION.map((week) => {
          const active = phase.label.startsWith(week.week.split(" · ")[0])
          return (
            <Card
              key={week.week}
              className={cn("rise", active && "border-gold/40 bg-gold/5")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-sm font-semibold", active ? "text-gold" : "text-bone")}>
                  {week.week}
                </p>
                <span className="font-mono text-[9px] text-steel-dim">{week.period}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[10px]">
                <div><span className="text-steel-dim">Sala:</span> <span className="text-steel">{week.sessions}</span></div>
                <div><span className="text-steel-dim">Força:</span> <span className="text-steel">{week.strength}</span></div>
                <div><span className="text-steel-dim">Explosivo:</span> <span className="text-steel">{week.explosive}</span></div>
                <div><span className="text-steel-dim">Acessórios:</span> <span className="text-steel">{week.accessories}</span></div>
                <div className="col-span-2"><span className="text-steel-dim">Zona 2:</span> <span className="text-zone">{week.zone2}</span></div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="rise mt-3 border-l-4 border-l-gold">
        <div className="flex gap-2.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-steel">
            A última sessão pesada deve ser até <span className="font-semibold text-bone">
            {LAST_HEAVY_GYM_DATE.split("-").reverse().slice(0, 2).join("/")}</span>. Na semana do
            campeonato, use apenas carga leve e movimentos rápidos; em {COMPETITION_GAME_DATE.split("-").reverse().slice(0, 2).join("/")}, sem academia.
          </p>
        </div>
      </Card>

      <SectionTitle accent="steel">Semáforo antes da sessão</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Verde", "Pernas leves, sono bom e campo tranquilo em 48 h: faça como planejado.", "border-zone/30 bg-zone/5 text-zone"],
          ["Amarelo", "Pernas pesadas ou pouco sono: mantenha B; corte agacho e acessórios.", "border-gold/30 bg-gold/5 text-gold"],
          ["Vermelho", "Dor, campo pesado ou 2 noites ruins: mobilidade + Z2 leve ou descanso.", "border-red-500/30 bg-red-500/5 text-red-400"],
        ].map(([label, body, style]) => (
          <Card key={label} className={cn("rise", style)}>
            <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-steel">{body}</p>
          </Card>
        ))}
      </div>

      <div className="rise mt-5 flex gap-2.5 rounded border border-red-500/20 bg-red-500/5 px-3 py-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
        <p className="text-[11px] leading-relaxed text-steel">
          Dor aguda ou articular: pare e avalie com fisioterapeuta ou médico do esporte.
          A academia complementa o coach; não substitui a avaliação presencial.
        </p>
      </div>
    </>
  )
}
