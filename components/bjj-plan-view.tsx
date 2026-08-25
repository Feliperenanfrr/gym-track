import { AlertTriangle, CalendarDays, Pencil, ShieldCheck, Swords } from "lucide-react"
import {
  BJJ_MAT_RULES,
  BJJ_PLAN,
  BJJ_PROGRESSION,
  BJJ_VALENCES,
  bjjPhaseFor,
} from "@/lib/bjj-plan"
import { ExercisePrescription, SessionPlan } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Card, SectionTitle } from "./ui"

function prescription(exercise: ExercisePrescription) {
  const reps =
    exercise.repsMin === exercise.repsMax
      ? String(exercise.repsMin)
      : `${exercise.repsMin}–${exercise.repsMax}`
  return `${exercise.sets} × ${reps}${exercise.unit === "seconds" ? "s" : ""}`
}

export function BjjPlanView({
  today,
  sessions = BJJ_PLAN,
  onEditTemplate,
}: {
  today: Date
  sessions?: SessionPlan[]
  onEditTemplate?: (session: SessionPlan) => void
}) {
  const phase = bjjPhaseFor(today)
  const liftSessions = sessions.filter((session) => session.kind === "lift")
  const zone2 = sessions.find((session) => session.id === "bjjZ2")!

  return (
    <>
      <Card className="rise rise-1 mt-3 overflow-hidden border-l-4 border-l-gold">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
              <Swords size={12} /> Objetivo ativo
            </p>
            <h2 className="stencil mt-1.5 text-2xl text-bone">Performance no tatame</h2>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 font-mono text-[10px] text-gold">
            bloco aberto
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-steel">
          A academia agora serve ao jiu-jitsu:{" "}
          <span className="font-semibold text-bone">
            pegada que não solta, quadril que levanta e pescoço que aguenta
          </span>
          . Sua força de powerlifting já está construída — o trabalho é convertê-la em
          rola e blindar o que quebra em quem começa.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded border border-seam bg-iron-2 p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
              Academia
            </p>
            <p className="mt-0.5 text-xs font-semibold text-bone">2–3 sessões · suporte</p>
          </div>
          <div className="rounded border border-seam bg-iron-2 p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
              Tatame
            </p>
            <p className="mt-0.5 text-xs font-semibold text-bone">Técnica e rola · principal</p>
          </div>
        </div>
      </Card>

      <Card className="rise rise-2 mt-3 border border-gold/30 bg-gold/5">
        <div className="flex items-start gap-2.5">
          <CalendarDays size={17} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-gold">{phase.label}</p>
              <span className="font-mono text-[10px] text-steel-dim">{phase.dates}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-steel">{phase.guidance}</p>
          </div>
        </div>
      </Card>

      <SectionTitle>Valências que a sala precisa entregar</SectionTitle>
      <Card className="rise p-0">
        {BJJ_VALENCES.map((valence, index) => (
          <div
            key={valence.name}
            className={cn(
              "px-4 py-3",
              index < BJJ_VALENCES.length - 1 && "border-b border-seam"
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-bone">{valence.name}</p>
              <span className="score shrink-0 text-lg text-gold">{index + 1}</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-steel">{valence.why}</p>
            <p className="mt-1 font-mono text-[10px] text-steel-dim">{valence.how}</p>
          </div>
        ))}
      </Card>

      <SectionTitle accent="steel">Coordenação com o tatame</SectionTitle>
      <div className="space-y-2">
        {BJJ_MAT_RULES.map((rule, index) => (
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
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[10px] text-gold">{session.duration}</span>
                  {onEditTemplate && (
                    <button
                      type="button"
                      onClick={() => onEditTemplate(session)}
                      className="inline-flex items-center gap-1 rounded border border-gold/30 px-2 py-1 font-mono text-[10px] uppercase text-gold transition-colors hover:bg-gold/10"
                    >
                      <Pencil size={11} /> Editar
                    </button>
                  )}
                </div>
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
                  <p className="font-mono text-[10px] text-steel-dim">{exercise.nameEn}</p>
                  <span className="shrink-0 font-mono text-[10px] text-steel-dim">
                    descanso {exercise.rest}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-steel">{exercise.note}</p>
              </div>
            ))}
          </Card>
        </div>
      ))}

      <SectionTitle accent="zone">Zona 2 · fôlego entre rounds</SectionTitle>
      <Card className="rise border-l-4 border-l-zone">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-bone">{zone2.title}</p>
            <p className="text-xs text-zone">60–120 min por semana</p>
          </div>
          <span className="score text-2xl text-zone">125–140</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-steel">{zone2.description}</p>
        <p className="mt-2 rounded border border-zone/20 bg-zone/5 px-2.5 py-2 text-xs text-zone">
          O intervalado você já faz de graça no tatame — na sala, mantenha o ritmo de
          conversa. É a base aeróbica que decide se o terceiro round é seu.
        </p>
      </Card>

      <SectionTitle accent="steel">Progressão dos blocos</SectionTitle>
      <div className="space-y-2">
        {BJJ_PROGRESSION.map((block) => {
          const active = block.block === phase.label
          return (
            <Card
              key={block.block}
              className={cn("rise", active && "border-gold/40 bg-gold/5")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-sm font-semibold", active ? "text-gold" : "text-bone")}>
                  {block.block}
                </p>
                <span className="font-mono text-[10px] text-steel-dim">{block.period}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[10px]">
                <div><span className="text-steel-dim">Sala:</span> <span className="text-steel">{block.sessions}</span></div>
                <div><span className="text-steel-dim">Força:</span> <span className="text-steel">{block.strength}</span></div>
                <div><span className="text-steel-dim">Pegada:</span> <span className="text-steel">{block.grip}</span></div>
                <div><span className="text-steel-dim">Motor (C):</span> <span className="text-steel">{block.engine}</span></div>
                <div className="col-span-2"><span className="text-steel-dim">Zona 2:</span> <span className="text-zone">{block.zone2}</span></div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="rise mt-3 border-l-4 border-l-gold">
        <div className="flex gap-2.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-steel">
            <span className="font-semibold text-bone">Pescoço é prevenção, não vaidade.</span>{" "}
            Aqui a blindagem cervical é o encolhimento: subida até as orelhas com pausa
            no topo e descida controlada, sem rodar os ombros. Carga sobe devagar — e se
            aparecer dor articular, formigamento ou tontura, pare na hora.
          </p>
        </div>
      </Card>

      <SectionTitle accent="steel">Semáforo antes da sessão</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Verde", "Sono bom, sem rola dura em 24 h e mãos descansadas: faça como planejado.", "border-zone/30 bg-zone/5 text-zone"],
          ["Amarelo", "Antebraço cansado ou pouco sono: mantenha A cortando a rosca de punho, ou faça B com metade dos acessórios.", "border-gold/30 bg-gold/5 text-gold"],
          ["Vermelho", "Dor articular, pescoço travado ou 2 noites ruins: mobilidade + Z2 leve ou descanso.", "border-red-500/30 bg-red-500/5 text-red-400"],
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
          Dor aguda, articular ou cervical: pare e avalie com fisioterapeuta ou médico do
          esporte. A academia complementa o professor de jiu-jitsu; não substitui a
          avaliação presencial.
        </p>
      </div>
    </>
  )
}
