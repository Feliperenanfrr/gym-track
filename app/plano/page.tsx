import { AlertTriangle } from "lucide-react"
import { Card, PageHeader, SectionTitle } from "@/components/ui"
import { GOLDEN_RULES, NUTRITION_GUIDELINES, PLAN, TIMELINE } from "@/lib/plan"
import { cn } from "@/lib/utils"

const WEEKDAY_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

// Avulso (weekday 0) é sob demanda — fora da grade fixa da semana.
const WEEK_STRUCTURE = PLAN.filter((s) => s.weekday >= 1)

export default function PlanoPage() {
  return (
    <main>
      <PageHeader kicker="PREPARADOR FÍSICO · JUN/2026" title="O Plano" />

      <Card className="rise rise-1 border-l-4 border-l-ember">
        <p className="text-sm leading-relaxed text-steel">
          <span className="font-semibold text-bone">Objetivo:</span> recomposição corporal
          — perder gordura mantendo músculo, shape estético, fôlego para esportes e força
          funcional. Cardio vira metade do programa; musculação migra para volume de
          hipertrofia.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["1º", "Base aeróbica", "Zona 2"],
            ["2º", "Hipertrofia", "2x/músculo·sem"],
            ["3º", "Déficit + proteína", "shape na cozinha"],
          ].map(([n, t, s]) => (
            <div key={t} className="rounded border border-seam bg-iron-2 p-2">
              <p className="score text-lg text-ember">{n}</p>
              <p className="text-xs font-semibold text-bone">{t}</p>
              <p className="font-mono text-[9px] text-steel-dim">{s}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="rise rise-2 mt-3 border border-gold/30 bg-gold/5">
        <div className="flex gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-steel">
            <span className="font-semibold text-gold">Antes de intensificar:</span> pela
            tontura relatada em esforço, agende cardiologista e faça um teste ergométrico
            — ele também fornece suas zonas reais de FC. Aproveite o check-up metabólico
            (glicemia, lipidograma, circunferência abdominal).
          </p>
        </div>
      </Card>

      <SectionTitle>Estrutura da semana</SectionTitle>
      <Card className="rise rise-3 p-0">
        {WEEK_STRUCTURE.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5",
              i < WEEK_STRUCTURE.length - 1 && "border-b border-seam"
            )}
          >
            <span className="w-16 shrink-0 font-mono text-[10px] uppercase text-steel-dim">
              {WEEKDAY_FULL[s.weekday - 1]}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  s.kind === "cardio"
                    ? "text-zone"
                    : s.kind === "rest"
                      ? "text-steel-dim"
                      : s.kind === "sport"
                        ? "text-steel"
                        : "text-bone"
                )}
              >
                {s.title}
                <span className="ml-2 font-normal text-steel-dim">{s.subtitle}</span>
              </p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-steel-dim">{s.duration}</span>
          </div>
        ))}
      </Card>

      {PLAN.filter((s) => s.kind === "lift").map((s) => (
        <div key={s.id}>
          <SectionTitle>
            {s.title} — {s.subtitle}
          </SectionTitle>
          <Card className="rise p-0">
            {s.exercises.map((ex, i) => (
              <div
                key={ex.id}
                className={cn(
                  "px-4 py-3",
                  i < s.exercises.length - 1 && "border-b border-seam"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-bone">{ex.name}</p>
                  <span className="shrink-0 font-mono text-[11px] text-ember-hot">
                    {ex.sets} × {ex.repsMin}–{ex.repsMax}
                    {ex.unit === "seconds" ? "s" : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <p className="font-mono text-[10px] text-steel-dim">{ex.nameEn}</p>
                  <span className="shrink-0 font-mono text-[10px] text-steel-dim">
                    descanso {ex.rest}
                  </span>
                </div>
                <p className="mt-1 text-xs text-steel">{ex.note}</p>
              </div>
            ))}
            {s.cardioAfter && (
              <div className="border-t border-seam bg-zone/5 px-4 py-2.5">
                <p className="font-mono text-xs text-zone">
                  + {s.cardioAfter.minutes} min — {s.cardioAfter.label}
                </p>
              </div>
            )}
          </Card>
        </div>
      ))}

      <SectionTitle accent="zone">Cardio Zona 2 — o pilar nº 1</SectionTitle>
      <Card className="rise border-l-4 border-l-zone">
        <p className="text-sm leading-relaxed text-steel">
          Ritmo em que você <span className="text-bone">conversa com frases completas,
          mas não canta</span> (~60–70% da FC máx; ≈120–140 bpm até o teste confirmar).
          Vai parecer fácil demais — é exatamente esse estímulo que constrói a base.
        </p>
        <p className="mt-2 text-xs text-steel-dim">
          Após 4–6 semanas: troque uma sessão por intervalado na bike — 8 tiros de 1 min
          forte / 2 min leve. Em 8–12 semanas a diferença no fôlego é gritante.
        </p>
      </Card>

      <SectionTitle>Regras de ouro</SectionTitle>
      <div className="space-y-2">
        {GOLDEN_RULES.map((r, i) => (
          <Card key={r.title} className="rise flex gap-3">
            <span className="score mt-0.5 text-xl text-ember">{i + 1}</span>
            <div>
              <p className="text-sm font-semibold text-bone">{r.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-steel">{r.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle accent="steel">Nutrição — onde o shape é decidido</SectionTitle>
      <Card className="rise p-0">
        {NUTRITION_GUIDELINES.map((n, i) => (
          <div
            key={n.item}
            className={cn(
              "px-4 py-3",
              i < NUTRITION_GUIDELINES.length - 1 && "border-b border-seam"
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-bone">{n.item}</p>
              <p className="shrink-0 text-right font-mono text-[11px] text-gold">{n.target}</p>
            </div>
            <p className="mt-0.5 text-xs text-steel-dim">{n.why}</p>
          </div>
        ))}
      </Card>

      <SectionTitle accent="steel">Linha do tempo esperada</SectionTitle>
      <div className="space-y-2">
        {TIMELINE.map((t) => (
          <Card key={t.period} className="rise">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ember">
              {t.period}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-steel">{t.expect}</p>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-[9px] leading-relaxed text-steel-dim">
        Plano educativo — não substitui avaliação médica, educador físico presencial ou
        nutricionista. Dor, tontura ou desconforto anormal: pare e procure um profissional.
      </p>
    </main>
  )
}
