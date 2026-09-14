import { Gauge, ListOrdered, Pencil, Swords, Target } from "lucide-react"
import {
  PERFORMANCE_PHASE,
  PERFORMANCE_PLAN,
  PERFORMANCE_Z2_TARGET,
  PERF_CYCLE,
} from "@/lib/performance-plan"
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

/** Alvos corporais da fase — os mesmos campos que a aba Medidas registra. */
const BODY_TARGETS = [
  { label: "Peso", now: "94,1 kg", goal: "79–81 kg" },
  { label: "Cintura", now: "94 cm", goal: "78–80 cm" },
  { label: "Gordura", now: "30,3 %", goal: "11–13 %" },
  { label: "Visceral", now: "16,5", goal: "≤ 8" },
  { label: "Massa magra", now: "65,6 kg", goal: "69,5–70,5 kg" },
  { label: "Água", now: "50,7 %", goal: "62–64 %" },
]

export function PerformancePlanView({
  sessions = PERFORMANCE_PLAN,
  onEditTemplate,
}: {
  sessions?: SessionPlan[]
  onEditTemplate?: (session: SessionPlan) => void
}) {
  const liftSessions = PERF_CYCLE.map((id) =>
    sessions.find((session) => session.id === id)
  ).filter(Boolean) as SessionPlan[]
  const cardioSessions = sessions.filter((session) => session.kind === "cardio")

  return (
    <>
      {/* ---------- objetivo ativo ---------- */}
      <Card className="rise rise-1 mt-3 overflow-hidden border-l-4 border-l-gold">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
              <Swords size={12} /> Objetivo ativo
            </p>
            <h2 className="stencil mt-1.5 text-2xl text-bone">
              Pré-temporada de grappling
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-1 font-mono text-[10px] text-gold">
            {PERFORMANCE_PHASE.label}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-steel">
          Transferir uma base de powerlifting para o tatame:{" "}
          <span className="font-semibold text-bone">
            forte em relação ao peso, explosivo, com pegada, pescoço e um motor que
            aguenta dois períodos
          </span>
          . O ciclo de motor não foi abandonado — foi promovido: a Zona 2 segue sendo o
          piso da semana e o intervalado continua crescendo.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["1º", "Potência", "explosivo primeiro"],
            ["2º", "Força", "compostos de volta"],
            ["3º", "Déficit", "0,4–0,6 kg/sem"],
          ].map(([n, t, sub]) => (
            <div key={t} className="rounded border border-seam bg-iron-2 p-2">
              <p className="score text-lg text-gold">{n}</p>
              <p className="text-xs font-semibold text-bone">{t}</p>
              <p className="font-mono text-[10px] leading-tight text-steel-dim">{sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- como a semana funciona ---------- */}
      <SectionTitle accent="gold">Como a semana funciona</SectionTitle>
      <Card className="rise mb-3 border-l-4 border-l-gold">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
          <ListOrdered size={12} /> Fila, não calendário
        </p>
        <p className="mt-2 text-xs leading-relaxed text-steel">
          As três sessões de sala rodam em ordem:{" "}
          {liftSessions.map((session, index) => (
            <span key={session.id}>
              <span className="font-semibold text-bone">{session.title}</span>
              {index < liftSessions.length - 1 ? " → " : ""}
            </span>
          ))}{" "}
          → recomeça. Chegou na academia, o registro já abre na que está na vez.{" "}
          <span className="font-semibold text-bone">
            Faltou três dias, a fila espera na mesma posição
          </span>{" "}
          — nunca é preciso saber em que semana do plano você está.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-steel">
          Zona 2 e intervalado ficam fora da fila: você escolhe quando abre. Meta semanal
          de cinco sessões, sendo{" "}
          <span className="font-semibold text-bone">três inegociáveis</span> — duas de
          sala e um intervalado. Se a semana desabar por causa da faculdade, faça essas
          três e considere a semana cumprida.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-steel">
          <span className="font-semibold text-bone">Descarga sem contar semana:</span>{" "}
          duas sessões seguidas sem fechar o topo da faixa num exercício → a próxima sai
          com 60 % da carga e metade das séries.
        </p>
      </Card>

      {/* ---------- sessões de sala ---------- */}
      <SectionTitle accent="gold">Sessões de sala — a fila</SectionTitle>
      {liftSessions.map((session, position) => (
        <div key={session.id} className="mb-5">
          <Card className="rise overflow-hidden border-l-4 border-l-gold p-0">
            <div className="border-b border-gold/20 bg-gold/5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="stencil min-w-0 text-xl text-bone">
                  <span className="score mr-1.5 text-gold">{position + 1}</span>
                  {session.title}
                </h3>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[10px] text-gold">
                    {session.duration}
                  </span>
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
                  <p className="min-w-0 text-sm font-semibold text-bone">
                    {exercise.name}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-gold">
                    {prescription(exercise)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <p className="min-w-0 font-mono text-[10px] text-steel-dim">
                    {exercise.nameEn}
                  </p>
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

      {/* ---------- motor ---------- */}
      <SectionTitle accent="zone">Motor — fora da fila</SectionTitle>
      {cardioSessions.map((session) => {
        const target = session.cardioTarget
        const gold = session.accent === "gold"
        return (
          <Card
            key={session.id}
            className={cn(
              "rise mb-3 border-l-4 p-0",
              gold ? "border-l-gold" : "border-l-zone"
            )}
          >
            <div
              className={cn(
                "border-b px-4 py-3",
                gold ? "border-gold/20 bg-gold/5" : "border-zone/20 bg-zone/5"
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="stencil min-w-0 text-xl text-bone">{session.title}</h3>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px]",
                    gold ? "text-gold" : "text-zone"
                  )}
                >
                  {session.duration}
                </span>
              </div>
              <p className={cn("mt-1 text-xs", gold ? "text-gold" : "text-zone")}>
                {session.subtitle}
              </p>
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
      <p className="mb-3 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
        Meta semanal de Zona 2: {PERFORMANCE_Z2_TARGET.min}–{PERFORMANCE_Z2_TARGET.max}{" "}
        min somando tudo — as sessões próprias, os 10 min que fecham cada treino de sala
        e as caminhadas importadas do Strava. Zonas sobre FCmáx estimada de 194 bpm
        (Tanaka, 20 anos).
      </p>

      {/* ---------- alvos corporais ---------- */}
      <SectionTitle accent="gold">Onde isso tem que chegar</SectionTitle>
      <Card className="rise mb-3 p-0">
        <div className="flex items-baseline justify-between gap-3 border-b border-seam px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">
            <Target size={12} /> Alvo de tatame
          </p>
          <span className="shrink-0 font-mono text-[10px] text-steel-dim">
            79 kg UWW · −81 judô
          </span>
        </div>
        {BODY_TARGETS.map((row, index) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-3 px-4 py-2.5",
              index < BODY_TARGETS.length - 1 && "border-b border-seam"
            )}
          >
            <p className="min-w-0 text-sm font-semibold text-bone">{row.label}</p>
            <p className="shrink-0 font-mono text-[11px] text-steel-dim">
              {row.now} <span className="text-steel">→</span>{" "}
              <span className="text-gold">{row.goal}</span>
            </p>
          </div>
        ))}
      </Card>
      <p className="mb-3 px-1 font-mono text-[10px] leading-relaxed text-steel-dim">
        O IMC vai continuar dizendo &quot;sobrepeso&quot; no fim —{" "}
        <span className="text-bone">ignore</span>, lutador tem IMC alto por massa magra.
        A massa magra precisa <span className="text-bone">subir</span> enquanto o peso
        cai: se ela cair em duas medições seguidas, o déficit está grande demais.
      </p>
    </>
  )
}
