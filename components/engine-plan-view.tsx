import {
  AlertTriangle,
  CalendarDays,
  Flame,
  Gauge,
  HeartPulse,
  Home,
  Pencil,
  Timer,
  TrendingDown,
} from "lucide-react"
import {
  ENGINE_FLOOR,
  ENGINE_HARD_RULES,
  ENGINE_HOME_CIRCUIT,
  ENGINE_PILLARS,
  ENGINE_PLAN,
  ENGINE_PROGRESSION,
  ENGINE_RUN_LADDER,
  ENGINE_TARGETS,
  ENGINE_TESTS,
  ENGINE_TROUBLESHOOTING,
  ENGINE_WEEKLY_VOLUME,
  ENGINE_ZONES,
  enginePhaseFor,
  engineWeeklyTargetFor,
} from "@/lib/engine-plan"
import { ExercisePrescription, SessionPlan } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Card, CollapsibleSection, SectionTitle } from "./ui"

function prescription(exercise: ExercisePrescription) {
  const reps =
    exercise.repsMin === exercise.repsMax
      ? String(exercise.repsMin)
      : `${exercise.repsMin}–${exercise.repsMax}`
  return `${exercise.sets} × ${reps}${exercise.unit === "seconds" ? "s" : ""}`
}

const ZONE_STYLE: Record<string, { bar: string; text: string }> = {
  steel: { bar: "bg-steel-dim", text: "text-steel-dim" },
  zone: { bar: "bg-zone", text: "text-zone" },
  gold: { bar: "bg-gold", text: "text-gold" },
  ember: { bar: "bg-ember", text: "text-ember" },
  bone: { bar: "bg-bone", text: "text-bone" },
}

/** Cabeçalho colorido por tipo de sessão: força é ember, cardio é zona. */
function sessionAccent(session: SessionPlan) {
  if (session.id === "engineMotor" || session.id === "engineIntervals") {
    return { border: "border-l-ember", head: "border-ember/20 bg-ember/5", text: "text-ember" }
  }
  if (session.kind === "lift") {
    return { border: "border-l-ember", head: "border-ember/20 bg-ember/5", text: "text-ember-hot" }
  }
  if (session.id === "engineHome") {
    return { border: "border-l-gold", head: "border-gold/20 bg-gold/5", text: "text-gold" }
  }
  return { border: "border-l-zone", head: "border-zone/20 bg-zone/5", text: "text-zone" }
}

export function EnginePlanView({
  today,
  sessions = ENGINE_PLAN,
  onEditTemplate,
}: {
  today: Date
  sessions?: SessionPlan[]
  onEditTemplate?: (session: SessionPlan) => void
}) {
  const phase = enginePhaseFor(today)
  const weekTarget = engineWeeklyTargetFor(today)
  const byId = (id: string) => sessions.find((session) => session.id === id)
  const forceSessions = sessions.filter((session) => session.kind === "lift")
  const motor = byId("engineMotor")
  const intervals = byId("engineIntervals")
  const zone2 = byId("engineZ2")
  const home = byId("engineHome")
  const cardioSessions = [motor, intervals, zone2].filter(Boolean) as SessionPlan[]

  return (
    <>
      {/* ---------- objetivo ativo ---------- */}
      <Card className="rise rise-1 mt-3 overflow-hidden border-l-4 border-l-zone">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-zone">
              <HeartPulse size={12} /> Objetivo ativo
            </p>
            <h2 className="stencil mt-1.5 text-2xl text-bone">
              Motor aeróbico e déficit
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-zone/30 bg-zone/10 px-2 py-1 font-mono text-[10px] text-zone">
            {phase.cycleWeek !== null ? `semana ${phase.cycleWeek}/12` : "bloco aberto"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-steel">
          O cardio deixou de ser suporte e virou o programa:{" "}
          <span className="font-semibold text-bone">
            capacidade cardiorrespiratória e perda de gordura
          </span>
          . A musculação caiu de 5 para 2 sessões e tem uma função só — impedir que o
          déficit coma sua massa magra e derrube o metabolismo de repouso.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["1º", "Motor", "4×4 em Z4"],
            ["2º", "Zona 2", "3–4×/sem"],
            ["3º", "Déficit", "170–190 g proteína"],
          ].map(([n, t, sub]) => (
            <div key={t} className="rounded border border-seam bg-iron-2 p-2">
              <p className="score text-lg text-zone">{n}</p>
              <p className="text-xs font-semibold text-bone">{t}</p>
              <p className="font-mono text-[10px] text-steel-dim">{sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- liberação médica ---------- */}
      <Card className="rise rise-2 mt-3 border border-gold/30 bg-gold/5">
        <div className="flex gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-steel">
            <span className="font-semibold text-gold">
              O Bloco 1 pode começar hoje; o Bloco 2 não.
            </span>{" "}
            A tontura em esforço que você relatou continua no registro. O Bloco 1 usa a
            mesma intensidade que você já praticava — mas o 4×4 leva você a Zona 4 pela
            primeira vez. Agende cardiologista e teste ergométrico nestas quatro semanas:
            ele devolve a liberação, a sua FCmáx real e uma medida direta de VO₂máx.
          </p>
        </div>
      </Card>

      {/* ---------- bloco atual ---------- */}
      <Card className="rise rise-3 mt-3 border border-zone/30 bg-zone/5">
        <div className="flex items-start gap-2.5">
          <CalendarDays size={17} className="mt-0.5 shrink-0 text-zone" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-zone">{phase.label}</p>
              <span className="font-mono text-[10px] text-steel-dim">{phase.dates}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-steel">{phase.guidance}</p>
            {weekTarget && (
              <p className="mt-2 font-mono text-[10px] text-steel-dim">
                Semana {weekTarget.week}:{" "}
                <span className="text-zone">{weekTarget.cardio} min de cardio</span>
                {weekTarget.intense > 0 && (
                  <>
                    {" · "}
                    <span className="text-ember">
                      {weekTarget.intense} sessão{weekTarget.intense > 1 ? "s" : ""} intensa
                      {weekTarget.intense > 1 ? "s" : ""}
                    </span>
                  </>
                )}
                {weekTarget.easy && " · semana de alívio"}
                {weekTarget.milestone && ` · ${weekTarget.milestone}`}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ---------- metas ---------- */}
      <SectionTitle accent="zone">Metas do ciclo — 12 semanas</SectionTitle>
      <Card className="rise p-0">
        {ENGINE_TARGETS.map((target, index) => (
          <div
            key={target.label}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5",
              index < ENGINE_TARGETS.length - 1 && "border-b border-seam"
            )}
          >
            <p className="w-28 shrink-0 text-sm font-semibold text-bone">{target.label}</p>
            <div className="flex min-w-0 flex-1 items-baseline gap-1.5 font-mono text-xs">
              <span className="text-steel-dim line-through">{target.from}</span>
              <TrendingDown size={11} className="shrink-0 text-zone" />
              <span className="font-semibold text-zone">{target.to}</span>
            </div>
            <p className="hidden shrink-0 text-right font-mono text-[10px] text-steel-dim sm:block">
              {target.detail}
            </p>
          </div>
        ))}
      </Card>
      <p className="mt-2 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
        Composição corporal depende sobretudo da adesão alimentar; aptidão depende
        sobretudo da adesão ao treino. As duas colunas são independentes — falhar numa
        não invalida a outra.
      </p>

      {/* ---------- zonas ---------- */}
      <SectionTitle accent="zone">Zonas de intensidade</SectionTitle>
      <Card className="rise p-0">
        {ENGINE_ZONES.map((zone, index) => {
          const style = ZONE_STYLE[zone.accent] ?? ZONE_STYLE.steel
          return (
            <div
              key={zone.id}
              className={cn(
                "px-4 py-2.5",
                index < ENGINE_ZONES.length - 1 && "border-b border-seam"
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-bone">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", style.bar)} />
                  {zone.label}
                </p>
                <span className={cn("shrink-0 font-mono text-[11px]", style.text)}>
                  {zone.bpm} · RPE {zone.rpe}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-steel">{zone.use}</p>
              <p className="mt-0.5 font-mono text-[10px] text-steel-dim">{zone.talk}</p>
            </div>
          )
        })}
      </Card>
      <p className="mt-2 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
        Faixas provisórias por reserva de FC (FCmáx ≈ 175, FCrep ≈ 70), derivadas dos
        seus registros: 130 bpm confortável e 160 bpm em 8 min de corrida intensa.
        Troque pelos números do teste ergométrico assim que tiver. Até lá,{" "}
        <span className="text-bone">o RPE e o teste da fala mandam mais que o relógio</span>.
      </p>

      {/* ---------- pilares ---------- */}
      <SectionTitle>O que o ciclo precisa entregar</SectionTitle>
      <Card className="rise p-0">
        {ENGINE_PILLARS.map((pillar, index) => (
          <div
            key={pillar.name}
            className={cn(
              "px-4 py-3",
              index < ENGINE_PILLARS.length - 1 && "border-b border-seam"
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-bone">{pillar.name}</p>
              <span className="score shrink-0 text-lg text-zone">{index + 1}</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-steel">{pillar.why}</p>
            <p className="mt-1 font-mono text-[10px] text-steel-dim">{pillar.how}</p>
          </div>
        ))}
      </Card>

      {/* ---------- sessões de cardio ---------- */}
      <SectionTitle accent="zone">Sessões de cardio</SectionTitle>
      {cardioSessions.map((session) => {
        const accent = sessionAccent(session)
        const target = session.cardioTarget
        return (
          <Card key={session.id} className={cn("rise mb-3 border-l-4 p-0", accent.border)}>
            <div className={cn("border-b px-4 py-3", accent.head)}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="stencil text-xl text-bone">{session.title}</h3>
                <span className={cn("shrink-0 font-mono text-[10px]", accent.text)}>
                  {session.duration}
                </span>
              </div>
              <p className={cn("mt-1 text-xs", accent.text)}>{session.subtitle}</p>
              {target?.bpmMin && (
                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-steel-dim">
                  <Gauge size={11} /> alvo {target.bpmMin}–{target.bpmMax} bpm ·{" "}
                  {target.min}–{target.max} min
                </p>
              )}
            </div>
            <p className="px-4 py-3 text-xs leading-relaxed text-steel">
              {session.description}
            </p>
          </Card>
        )
      })}

      {/* ---------- trilha de corrida ---------- */}
      <CollapsibleSection title="Trilha de corrida — de 300 m a 10 min" accent="zone">
        <Card className="rise border-l-4 border-l-zone">
          <p className="text-xs leading-relaxed text-steel">
            Correr a 7,0 km/h custa ~26,8 ml/kg/min. Com o VO₂máx que seu perfil sugere
            hoje, isso é <span className="font-semibold text-bone">90–100% do máximo</span>{" "}
            — por isso 300 m te derrubam. Não é falta de vontade, é aritmética. A corrida
            entra na semana 5 <span className="text-zone">como trabalho intervalado</span>,
            que é o que ela de fato é para você agora.
          </p>
          <div className="mt-3 overflow-hidden rounded border border-seam">
            {ENGINE_RUN_LADDER.map((row, index) => (
              <div
                key={row.weeks}
                className={cn(
                  "flex items-center gap-3 px-3 py-2",
                  index < ENGINE_RUN_LADDER.length - 1 && "border-b border-seam"
                )}
              >
                <span className="w-14 shrink-0 font-mono text-[10px] uppercase text-steel-dim">
                  sem {row.weeks}
                </span>
                <p className="min-w-0 flex-1 text-xs text-bone">{row.protocol}</p>
                <span className="shrink-0 font-mono text-[10px] text-zone">{row.pace}</span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 rounded border border-gold/20 bg-gold/5 px-2.5 py-2 text-xs leading-relaxed text-gold">
            Faça a trilha <span className="font-semibold">no lugar</span> do 30/30 de
            sexta, não além dele. Sempre na esteira, a 1% de inclinação. Dor em canela,
            joelho ou planta do pé: volte para caminhada inclinada por uma semana inteira.
          </p>
        </Card>
      </CollapsibleSection>

      {/* ---------- sessões de força ---------- */}
      <SectionTitle>Força de manutenção — 2×/semana</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-ember">
        <p className="text-xs leading-relaxed text-steel">
          Você aceitou perder músculo, e o plano respeita isso: cinco sessões viraram
          duas e nenhum recorde será perseguido. Mas cortar para zero sairia caro —{" "}
          <span className="font-semibold text-bone">
            seus 66,3 kg de massa magra sustentam um basal de ~1.900 kcal
          </span>
          , e perder isso é como se constrói um platô. A meta de cada exercício é repetir
          a carga da semana passada.
        </p>
      </Card>
      {forceSessions.map((session) => (
        <div key={session.id} className="mb-5">
          <Card className="rise overflow-hidden border-l-4 border-l-ember p-0">
            <div className="border-b border-ember/20 bg-ember/5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="stencil text-xl text-bone">{session.title}</h3>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[10px] text-ember-hot">
                    {session.duration}
                  </span>
                  {onEditTemplate && (
                    <button
                      type="button"
                      onClick={() => onEditTemplate(session)}
                      className="inline-flex items-center gap-1 rounded border border-ember/30 px-2 py-1 font-mono text-[10px] uppercase text-ember transition-colors hover:bg-ember/10"
                    >
                      <Pencil size={11} /> Editar
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-ember-hot">{session.subtitle}</p>
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
                  <span className="shrink-0 font-mono text-[11px] text-ember-hot">
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
            {session.cardioAfter && (
              <div className="border-t border-seam bg-zone/5 px-4 py-2.5">
                <p className="font-mono text-xs text-zone">
                  + {session.cardioAfter.minutes} min — {session.cardioAfter.label}
                </p>
              </div>
            )}
          </Card>
        </div>
      ))}

      {/* ---------- sessão casa ---------- */}
      {home && (
        <>
          <SectionTitle accent="steel">Sem academia? Sessão Casa</SectionTitle>
          <Card className="rise border-l-4 border-l-gold p-0">
            <div className="border-b border-gold/20 bg-gold/5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="stencil flex items-center gap-2 text-xl text-bone">
                  <Home size={16} className="text-gold" /> {home.title}
                </h3>
                <span className="shrink-0 font-mono text-[10px] text-gold">
                  {home.duration}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-steel">{home.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-3">
              {ENGINE_HOME_CIRCUIT.map((station, index) => (
                <div key={station.name} className="flex gap-2">
                  <span className="score shrink-0 text-sm text-gold">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-snug text-bone">
                      {station.name}
                    </p>
                    <p className="font-mono text-[10px] text-steel-dim">{station.hint}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-seam px-4 py-2.5">
              <p className="text-xs leading-relaxed text-steel">
                <span className="font-semibold text-gold">Limite da corda:</span> pular a
                96 kg é excelente para o VO₂máx e péssimo para tornozelo e canela. Bloco 1:
                até 3 min somados, em blocos de 20–30 s. Bloco 2: até 5 min. Bloco 3: até
                8 min. Dor na panturrilha? Troque por polichinelo por duas semanas.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* ---------- piso mínimo ---------- */}
      <SectionTitle>A regra do piso mínimo</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-ember">
        <p className="text-xs leading-relaxed text-steel">
          Seu histórico mostra 2,8 sessões por semana na média, mas com{" "}
          <span className="font-semibold text-bone">quatro semanas de zero em doze</span>.
          O padrão não é falta de intensidade — é intermitência. Na semana ruim você não
          abandona o plano: desce até o piso.
        </p>
      </Card>
      <div className="space-y-2">
        {ENGINE_FLOOR.map((step) => (
          <Card key={step.rank} className="rise flex gap-3 py-3">
            <span className="score mt-0.5 shrink-0 text-xl text-ember">{step.rank}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-bone">{step.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-steel">{step.body}</p>
            </div>
          </Card>
        ))}
      </div>
      <Card className="rise mt-2 border-l-4 border-l-gold">
        <p className="text-xs leading-relaxed text-steel">
          <span className="font-semibold text-gold">Não deu nem isso?</span> 20 min de
          caminhada. O piso do piso é não zerar o dia — uma semana de 3 sessões repetida
          12 vezes vale muito mais que uma de 6 repetida 4 vezes e abandonada.
        </p>
      </Card>

      <SectionTitle accent="steel">Restrições que não se negociam</SectionTitle>
      <div className="space-y-2">
        {ENGINE_HARD_RULES.map((rule, index) => (
          <Card key={rule} className="rise flex gap-3 py-3">
            <span className="score mt-0.5 shrink-0 text-xl text-steel-dim">{index + 1}</span>
            <p className="text-xs leading-relaxed text-steel">{rule}</p>
          </Card>
        ))}
      </div>

      {/* ---------- progressão ---------- */}
      <SectionTitle>Progressão dos blocos</SectionTitle>
      <div className="space-y-2">
        {ENGINE_PROGRESSION.map((block) => {
          const active = block.block === phase.label
          return (
            <Card
              key={block.block}
              className={cn("rise", active && "border-zone/40 bg-zone/5")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-sm font-semibold", active ? "text-zone" : "text-bone")}>
                  {block.block}
                </p>
                <span className="shrink-0 font-mono text-[10px] text-steel-dim">
                  {block.period}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[10px]">
                <div>
                  <span className="text-steel-dim">Cardio:</span>{" "}
                  <span className="text-zone">{block.cardio}</span>
                </div>
                <div>
                  <span className="text-steel-dim">Intenso:</span>{" "}
                  <span className="text-ember">{block.intense}</span>
                </div>
                <div>
                  <span className="text-steel-dim">Força:</span>{" "}
                  <span className="text-steel">{block.strength}</span>
                </div>
                <div>
                  <span className="text-steel-dim">Foco:</span>{" "}
                  <span className="text-steel">{block.focus}</span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* ---------- volume semana a semana ---------- */}
      <CollapsibleSection title="Volume-alvo, semana a semana" accent="zone">
        <Card className="rise p-0">
          {ENGINE_WEEKLY_VOLUME.map((row) => {
            const current = phase.cycleWeek === row.week
            return (
              <div
                key={row.week}
                className={cn(
                  "flex items-center gap-3 border-b border-seam px-4 py-2 last:border-b-0",
                  current && "bg-zone/10"
                )}
              >
                <span
                  className={cn(
                    "w-14 shrink-0 font-mono text-[10px] uppercase",
                    current ? "font-bold text-zone" : "text-steel-dim"
                  )}
                >
                  sem {row.week}
                </span>
                <span className="w-16 shrink-0 font-mono text-xs text-bone">
                  {row.cardio}′
                </span>
                <span className="w-16 shrink-0 font-mono text-[10px] text-ember">
                  {row.intense > 0 ? `${row.intense}× intenso` : "—"}
                </span>
                <span className="min-w-0 flex-1 text-right font-mono text-[10px] text-steel-dim">
                  {row.milestone ?? (row.easy ? "alívio" : "")}
                </span>
              </div>
            )
          })}
        </Card>
        <p className="mt-2 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
          Progressão de ~10–15% por semana, com alívio na quarta semana de cada bloco. A
          adaptação aparece na semana leve, não na pesada. Você sai de 38 min/semana:
          mesmo a semana 1 já é o triplo do que vinha fazendo.
        </p>
      </CollapsibleSection>

      {/* ---------- testes ---------- */}
      <CollapsibleSection title="Testes — T0 agora, T1 na semana 6, T2 na 12" accent="ember">
        <Card className="rise p-0">
          {ENGINE_TESTS.map((test, index) => (
            <div
              key={test.name}
              className={cn(
                "px-4 py-3",
                index < ENGINE_TESTS.length - 1 && "border-b border-seam"
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-bone">
                  <Timer size={13} className="shrink-0 text-ember" />
                  {test.name}
                </p>
                <span className="shrink-0 rounded border border-seam px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-steel-dim">
                  {test.tag}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-zone">{test.how}</p>
              <p className="mt-0.5 font-mono text-[10px] text-steel-dim">
                anotar: {test.record}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-steel">{test.read}</p>
            </div>
          ))}
        </Card>
        <p className="mt-2 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
          Sempre no mesmo horário, com o mesmo tênis e ao menos 3 h após a última
          refeição. Teste que muda de condição não mede progresso, mede ruído.
        </p>
      </CollapsibleSection>

      {/* ---------- troubleshooting ---------- */}
      <CollapsibleSection title="Quando algo sair do previsto" accent="steel">
        <Card className="rise p-0">
          {ENGINE_TROUBLESHOOTING.map((item, index) => (
            <div
              key={item.symptom}
              className={cn(
                "px-4 py-3",
                index < ENGINE_TROUBLESHOOTING.length - 1 && "border-b border-seam"
              )}
            >
              <p className="flex items-start gap-2 text-sm font-semibold text-bone">
                <Flame size={13} className="mt-0.5 shrink-0 text-gold" />
                {item.symptom}
              </p>
              <p className="mt-1 pl-[21px] text-xs leading-relaxed text-steel">{item.fix}</p>
            </div>
          ))}
        </Card>
      </CollapsibleSection>

      {/* ---------- cozinha e sono ---------- */}
      <SectionTitle accent="steel">Cozinha e sono — onde 70% é decidido</SectionTitle>
      <Card className="rise p-0">
        {[
          ["Calorias", "2.100–2.200 kcal/dia", "Déficit de 500–600 → 0,5–0,7 kg/semana. Acima de 1%/sem a perda de músculo acelera."],
          ["Proteína", "170–190 g/dia", "1,8–2,0 g por kg de peso. Maior efeito nutricional na preservação da massa magra."],
          ["Carboidrato", "200–250 g/dia", "Não corte: o 4×4 roda com glicogênio. Sem carboidrato você não alcança Z4."],
          ["Água", "3,4–3,8 L/dia", "Sua mediana é 2,3 L e só 2 de 35 dias bateram a meta. Desidratação sobe a FC em 5–10 bpm."],
          ["Sono", "Deitar antes de 00:00", "Mesmo déficit com sono curto rendeu 55% menos gordura e 60% mais massa magra perdida."],
        ].map(([item, target, why], index, all) => (
          <div
            key={item}
            className={cn("px-4 py-3", index < all.length - 1 && "border-b border-seam")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-bone">{item}</p>
              <span className="shrink-0 text-right font-mono text-[11px] text-gold">
                {target}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-steel-dim">{why}</p>
          </div>
        ))}
      </Card>

      <div className="rise mt-5 flex gap-2.5 rounded border border-red-500/20 bg-red-500/5 px-3 py-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
        <p className="text-[11px] leading-relaxed text-steel">
          Pare a sessão e procure atendimento se: dor ou aperto no peito · tontura que não
          passa ao reduzir o ritmo · falta de ar desproporcional ao esforço · batimento
          irregular · náusea com suor frio · dor irradiando para braço ou mandíbula.
        </p>
      </div>

      <p className="mt-4 text-center font-mono text-[10px] leading-relaxed text-steel-dim">
        Plano educativo montado sobre os seus registros de 09/06 a 31/08/2026. Não
        substitui avaliação médica, teste ergométrico, educador físico presencial ou
        nutricionista.
      </p>
    </>
  )
}
