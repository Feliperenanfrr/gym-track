import { SessionId, SessionPlan } from "./types"

/**
 * Plano de Treino — Felipe (Junho/2026)
 * Transcrito do PDF do preparador físico: divisão Upper/Lower A-B,
 * cardio Zona 2 como pilar e esporte no sábado.
 */
export const PLAN: SessionPlan[] = [
  {
    id: "upperA",
    title: "Upper A",
    subtitle: "Superiores — básicos pesados",
    weekday: 1,
    duration: "60–75 min",
    kind: "lift",
    accent: "ember",
    description: "Força e massa: peito, costas, ombro",
    exercises: [
      { id: "bench", name: "Supino reto com barra", nameEn: "Barbell Bench Press", sets: 4, repsMin: 5, repsMax: 8, unit: "reps", rest: "2–3 min", note: "Seu básico de sempre, agora em faixa de hipertrofia" },
      { id: "row", name: "Remada curvada", nameEn: "Barbell Row", sets: 4, repsMin: 6, repsMax: 10, unit: "reps", rest: "2–3 min", note: "Tronco firme, puxe para o abdômen" },
      { id: "ohp", name: "Desenvolvimento militar", nameEn: "Overhead Press", sets: 3, repsMin: 6, repsMax: 10, unit: "reps", rest: "2 min", note: "Em pé, core travado" },
      { id: "pulldown", name: "Barra fixa ou Puxada alta", nameEn: "Pull-up / Lat Pulldown", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Se fizer 12 na barra fixa, adicione carga" },
      { id: "curl", name: "Rosca direta", nameEn: "Barbell Curl", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "60–90 s", note: "Sem balanço de tronco" },
      { id: "skull", name: "Tríceps testa", nameEn: "Lying Triceps Extension", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "60–90 s", note: "Cotovelos apontados para cima" },
    ],
  },
  {
    id: "cardioZ2",
    title: "Cardio Zona 2",
    subtitle: "Base aeróbica + core",
    weekday: 2,
    duration: "40–50 min",
    kind: "cardio",
    accent: "zone",
    description:
      "Ritmo de conversa (~120–140 bpm até o teste ergométrico confirmar). Esteira inclinada, bike ou corrida leve. É ela que mata a tontura no futsal — inegociável.",
    exercises: [],
  },
  {
    id: "lowerA",
    title: "Lower A",
    subtitle: "Inferiores — básicos pesados",
    weekday: 3,
    duration: "60 min",
    kind: "lift",
    accent: "ember",
    description: "Agachamento, posterior, panturrilha",
    exercises: [
      { id: "squat", name: "Agachamento livre", nameEn: "Back Squat", sets: 4, repsMin: 5, repsMax: 8, unit: "reps", rest: "2–3 min", note: "~70–80% do que você usava no powerlifting" },
      { id: "rdl", name: "Terra romeno (Stiff)", nameEn: "Romanian Deadlift", sets: 3, repsMin: 8, repsMax: 10, unit: "reps", rest: "2 min", note: "Alongamento do posterior, quadril para trás" },
      { id: "legpress", name: "Leg press 45°", nameEn: "Leg Press", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "90 s", note: "Amplitude completa sem tirar a lombar do banco" },
      { id: "legcurl", name: "Mesa flexora", nameEn: "Lying Leg Curl", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "60–90 s", note: "Controle a fase excêntrica (descida)" },
      { id: "calf", name: "Panturrilha em pé", nameEn: "Standing Calf Raise", sets: 4, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "Pausa de 1 s no alongamento embaixo" },
      { id: "plank", name: "Prancha", nameEn: "Plank", sets: 3, repsMin: 30, repsMax: 60, unit: "seconds", rest: "60 s", note: "Core funcional para esporte e jiu-jitsu" },
    ],
  },
  {
    id: "upperB",
    title: "Upper B",
    subtitle: "Superiores — volume e estética",
    weekday: 4,
    duration: "60 min",
    kind: "lift",
    accent: "ember",
    description: "Ombros largos, braços, costas em largura",
    exercises: [
      { id: "incline", name: "Supino inclinado com halteres", nameEn: "Incline Dumbbell Press", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "2 min", note: "Peitoral superior — muda o visual do peito" },
      { id: "chestrow", name: "Remada cavalinho ou Serrote", nameEn: "Chest-Supported / One-Arm Row", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Costas em espessura" },
      { id: "lateral", name: "Elevação lateral", nameEn: "Lateral Raise", sets: 4, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "PRIORIDADE: ombro largo transforma a silhueta" },
      { id: "facepull", name: "Face pull ou Crucifixo inverso", nameEn: "Face Pull / Reverse Fly", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Posterior de ombro + saúde articular" },
      { id: "hammer", name: "Rosca martelo", nameEn: "Hammer Curl", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "Braço + antebraço (útil para jiu-jitsu)" },
      { id: "pushdown", name: "Tríceps corda", nameEn: "Triceps Rope Pushdown", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "Abra a corda no final do movimento" },
    ],
  },
  {
    id: "lowerB",
    title: "Lower B",
    subtitle: "Inferiores — volume + Zona 2 curta",
    weekday: 5,
    duration: "70 min",
    kind: "lift",
    accent: "ember",
    description: "Volume de pernas + 20 min de Zona 2 ao final",
    cardioAfter: { minutes: 20, label: "Bike ou esteira em Zona 2" },
    exercises: [
      { id: "hack", name: "Hack ou Agachamento búlgaro", nameEn: "Hack Squat / Bulgarian Split Squat", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "2 min", note: "Búlgaro também treina equilíbrio (esporte)" },
      { id: "deadlift", name: "Levantamento terra", nameEn: "Conventional Deadlift", sets: 3, repsMin: 5, repsMax: 5, unit: "reps", rest: "3 min", note: "Mantém seu PR vivo — use ~75–80% (120–130 kg)" },
      { id: "legext", name: "Cadeira extensora", nameEn: "Leg Extension", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Aperte o quadríceps no topo" },
      { id: "seatedcurl", name: "Cadeira flexora", nameEn: "Seated Leg Curl", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Complementa a mesa flexora" },
      { id: "seatedcalf", name: "Panturrilha sentada", nameEn: "Seated Calf Raise", sets: 4, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Sóleo — importante para corrida" },
      { id: "cablecrunch", name: "Abdominal na polia", nameEn: "Cable Crunch", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "+ 20 min de bike/esteira em Zona 2 ao final" },
    ],
  },
  {
    id: "sport",
    title: "Esporte",
    subtitle: "Futsal / Flag / Jiu-jitsu",
    weekday: 6,
    duration: "Livre",
    kind: "sport",
    accent: "zone",
    description: "Diversão — seu intervalado “natural”. Esporte é lazer, não treino.",
    exercises: [],
  },
  {
    id: "rest",
    title: "Descanso",
    subtitle: "Descanso total ou caminhada leve",
    weekday: 7,
    duration: "—",
    kind: "rest",
    accent: "steel",
    description: "Recuperação. Recomposição corporal acontece dormindo: 7–9 h.",
    exercises: [],
  },
]

export const PLAN_BY_ID = Object.fromEntries(PLAN.map((s) => [s.id, s])) as Record<
  SessionId,
  SessionPlan
>

export const EXERCISES_BY_ID = Object.fromEntries(
  PLAN.flatMap((s) => s.exercises.map((e) => [e.id, e]))
)

/** Sessões em que cada exercício aparece (para achar histórico) */
export function sessionOfExercise(exerciseId: string): SessionPlan | undefined {
  return PLAN.find((s) => s.exercises.some((e) => e.id === exerciseId))
}

/** Sessão planejada para um dia ISO (1=Seg..7=Dom) */
export function sessionForWeekday(isoWeekday: number): SessionPlan {
  return PLAN.find((s) => s.weekday === isoWeekday) ?? PLAN_BY_ID.rest
}

export const GOLDEN_RULES = [
  {
    title: "Proximidade da falha",
    body: "Toda série de trabalho termina a 1–3 repetições da falha. Se você termina sabendo que faria mais 5, a série não contou.",
  },
  {
    title: "Sobrecarga progressiva",
    body: "Anote tudo. A cada semana, aumente carga OU repetições em pelo menos um exercício. Topo da faixa em todas as séries? Suba 2,5–5 kg.",
  },
  {
    title: "Técnica antes de carga",
    body: "Você vem do powerlifting, sabe disso melhor que ninguém. Amplitude completa sempre.",
  },
  {
    title: "Não pule o cardio",
    body: "Para o SEU objetivo, a Zona 2 de terça é tão inegociável quanto o treino de segunda. É ela que mata a tontura no futsal.",
  },
  {
    title: "Esporte é lazer, não treino",
    body: "Futsal, flag e jiu-jitsu são a recompensa. Eles melhoram porque a base melhora — não force performance neles nas primeiras 6 semanas.",
  },
  {
    title: "Durma 7–9 horas",
    body: "Recomposição corporal acontece dormindo. Sono ruim = músculo a menos e fome a mais.",
  },
]

export const NUTRITION_GUIDELINES = [
  { item: "Déficit calórico", target: "300–500 kcal abaixo da manutenção", why: "Perda de ~0,4–0,7 kg/semana — preserva músculo" },
  { item: "Proteína", target: "170–190 g/dia (1,8–2,2 g/kg)", why: "Protege a massa muscular durante o déficit" },
  { item: "Carboidrato", target: "Não corte — concentre em torno dos treinos", why: "Energia para treinar pesado e jogar sem apagar" },
  { item: "Água", target: "~3,3–3,7 L/dia (35–40 ml/kg)", why: "Desidratação piora fôlego e causa tontura" },
  { item: "Álcool e ultraprocessados", target: "Minimize", why: "Maiores inimigos da gordura visceral" },
]

export const TIMELINE = [
  { period: "Semanas 1–4", expect: "Cardio humilhante para o ego de quem levanta 160 kg. Normal. Foque em constância, não intensidade." },
  { period: "Semanas 4–6", expect: "Introduza o intervalado (1x/semana no lugar de uma Zona 2): 8 tiros de 1 min forte / 2 min leve na bike." },
  { period: "Semanas 6–10", expect: "Futsal e flag ficam confortáveis. Tontura deve ter sumido (se persistir, volte ao médico)." },
  { period: "Meses 3–6", expect: "Recomposição visível: menos cintura, mais ombro. Força estabiliza após queda inicial leve." },
  { period: "Mês 6+", expect: "Reavalie: bioimpedância, ajuste de calorias, possível troca de divisão. Aqui você já corre 5 km e joga 1 h de futsal sem sofrer." },
]
