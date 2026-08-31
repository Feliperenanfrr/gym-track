import { BJJ_GYM_SESSION_IDS, BJJ_PLAN } from "./bjj-plan"
import { LEGACY_SESSIONS } from "./legacy-plan"
import { SessionId, SessionPlan, TrainingProgram } from "./types"

export { BJJ_PLAN } from "./bjj-plan"

/**
 * Plano de Treino — Felipe (Junho/2026)
 * Transcrito do PDF do preparador físico: divisão Upper/Lower A-B,
 * cardio Zona 2 como pilar e esporte no sábado.
 */
export const PLAN: SessionPlan[] = [
  {
    id: "upperA",
    title: "Upper A",
    subtitle: "Força + peito/costas",
    weekday: 1,
    duration: "~55 min",
    kind: "lift",
    accent: "ember",
    description: "Slot pesado de supino + volume de costas, ombro e braço",
    exercises: [
      { id: "bench", name: "Supino reto com barra", nameEn: "Barbell Bench Press", sets: 4, repsMin: 5, repsMax: 8, unit: "reps", rest: "2–3 min", note: "RIR 2 · slot de força: top set 55–60 kg ×5, depois 3×8 com 47,5–50 kg" },
      { id: "row", name: "Remada curvada", nameEn: "Barbell Row", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "RIR 1–2 · iniciar 40–45 kg, tronco firme sem roubo" },
      { id: "db-ohp", name: "Desenvolvimento com halteres", nameEn: "Dumbbell Shoulder Press", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "RIR 1–2 · 12–14 kg, meta chegar aos 16 kg no bloco" },
      { id: "pulldown", name: "Puxada alta ou barra fixa", nameEn: "Lat Pulldown / Pull-up", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "RIR 1–2 · 40–50 kg na puxada; barra fixa se houver energia" },
      { id: "lateral", name: "Elevação lateral", nameEn: "Lateral Raise", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 0–1 · 10–12 kg, falha só na última série" },
      { id: "curl", name: "Rosca direta", nameEn: "Barbell Curl", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "60 s", note: "RIR 1 · superset com o tríceps · 20 kg na barra" },
      { id: "pushdown", name: "Tríceps na polia (corda)", nameEn: "Triceps Rope Pushdown", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "60 s", note: "RIR 1 · superset com a rosca · cotovelos colados, abra a corda embaixo" },
    ],
  },
  {
    id: "cardioZ2",
    title: "Cardio Zona 2",
    subtitle: "Base aeróbica",
    weekday: 3,
    duration: "30–40 min",
    kind: "cardio",
    accent: "zone",
    cardioTarget: {
      min: 30,
      max: 40,
      defaultMinutes: 40,
      bpmMin: 125,
      bpmMax: 140,
    },
    description:
      "Ritmo de conversa a 125–140 bpm (os ~130 bpm que você já registra na bike estão perfeitos). Bike, esteira inclinada ou corrida leve — consistência > modalidade. É o remédio da gordura visceral.",
    exercises: [],
  },
  {
    id: "lowerA",
    title: "Lower A",
    subtitle: "Força + cadeia posterior",
    weekday: 2,
    duration: "~60 min",
    kind: "lift",
    accent: "ember",
    description: "Slot pesado de agachamento + cadeia posterior, fechando com 15 min de Zona 2",
    cardioAfter: { minutes: 15, label: "Zona 2 na bike — FC 125–140" },
    exercises: [
      { id: "squat", name: "Agachamento livre", nameEn: "Back Squat", sets: 4, repsMin: 5, repsMax: 8, unit: "reps", rest: "2–3 min", note: "RIR 2 · slot de força: top set 90–100 kg ×5, depois 3×8 com 75–80 kg" },
      { id: "rdl", name: "Terra romeno (Stiff)", nameEn: "Romanian Deadlift", sets: 3, repsMin: 8, repsMax: 10, unit: "reps", rest: "2 min", note: "RIR 2 · iniciar 50–60 kg e progredir — está leve para seu histórico" },
      { id: "legpress", name: "Leg press 45°", nameEn: "Leg Press", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "90 s", note: "RIR 1–2 · 80–100 kg, amplitude completa > carga" },
      { id: "legcurl", name: "Mesa flexora", nameEn: "Lying Leg Curl", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 0–1 · 40–50 kg, segure 1 s no pico" },
      { id: "calf", name: "Panturrilha em pé", nameEn: "Standing Calf Raise", sets: 4, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 0–1 · 90–110 kg, pausa de 1 s embaixo (alongado)" },
      { id: "plank", name: "Prancha", nameEn: "Plank", sets: 3, repsMin: 45, repsMax: 60, unit: "seconds", rest: "60 s", note: "Progressão: prancha com peso nas costas" },
    ],
  },
  {
    id: "upperB",
    title: "Upper B",
    subtitle: "Hipertrofia + ombros",
    weekday: 4,
    duration: "~55 min",
    kind: "lift",
    accent: "ember",
    description: "Volume de superiores com foco em ombro e braço",
    exercises: [
      { id: "incline", name: "Supino inclinado com halteres", nameEn: "Incline Dumbbell Press", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "RIR 1–2 · 30–32 kg (já domina), meta 34–36 kg no bloco" },
      { id: "chestrow", name: "Remada cavalinho ou Serrote", nameEn: "Chest-Supported / One-Arm Row", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "RIR 1–2 · continue a progressão atual (36–45 kg)" },
      { id: "ohp", name: "Desenvolvimento militar", nameEn: "Overhead Press", sets: 3, repsMin: 6, repsMax: 10, unit: "reps", rest: "2 min", note: "RIR 2 · na barra, iniciar 25–30 kg — ombro é seu elo fraco de força, prioridade" },
      { id: "crossover", name: "Crossover ou crucifixo máquina", nameEn: "Cable Crossover / Pec Deck", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 0–1 · alonga bem o peitoral e fecha o volume de peito" },
      { id: "facepull", name: "Face pull ou Crucifixo inverso", nameEn: "Face Pull / Reverse Fly", sets: 3, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "RIR 1 · 25–40 kg, saúde de ombro + deltoide posterior" },
      { id: "hammer", name: "Rosca martelo", nameEn: "Hammer Curl", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "60 s", note: "RIR 1 · superset com o tríceps · par de 22–24 kg" },
      { id: "skull", name: "Tríceps francês ou testa", nameEn: "Lying / Overhead Triceps Extension", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "60 s", note: "RIR 1 · superset com a rosca · 30–40 kg na barra W" },
    ],
  },
  {
    id: "lowerB",
    title: "Lower B",
    subtitle: "Quadríceps máquina + glúteo + core",
    weekday: 5,
    duration: "~55 min",
    kind: "lift",
    accent: "ember",
    description: "Quadríceps de máquina, glúteo e core, fechando com 15 min de Zona 2",
    cardioAfter: { minutes: 15, label: "Zona 2 na bike — FC 125–140" },
    exercises: [
      { id: "hack", name: "Hack ou Agachamento búlgaro", nameEn: "Hack Squat / Bulgarian Split Squat", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "2 min", note: "RIR 1–2 · retome a progressão com carga controlada, sem falhar" },
      { id: "hipthrust", name: "Elevação pélvica (hip thrust)", nameEn: "Barbell Hip Thrust", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Novo — glúteo estava ausente · iniciar 60–80 kg" },
      { id: "legext", name: "Cadeira extensora", nameEn: "Leg Extension", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 0–1 · 60–75 kg, segure 1 s no topo" },
      { id: "seatedcurl", name: "Cadeira flexora", nameEn: "Seated Leg Curl", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 0–1 · 30–40 kg" },
      { id: "seatedcalf", name: "Panturrilha sentada", nameEn: "Seated Calf Raise", sets: 4, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "RIR 0–1 · pausa embaixo, reps lentas" },
      { id: "cablecrunch", name: "Abdominal na polia", nameEn: "Cable Crunch", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "RIR 1 · 23–32 kg, como já vem fazendo" },
    ],
  },
  {
    id: "free",
    title: "Avulso",
    subtitle: "Cardio + exercícios soltos",
    weekday: 0,
    duration: "Livre",
    kind: "mixed",
    accent: "zone",
    description:
      "Registro livre para cardio e estímulos pontuais. Conta volume muscular e cardio, mas não avança Upper/Lower.",
    exercises: [],
  },
  {
    id: "sport",
    title: "Esporte",
    subtitle: "Jiu-jitsu / Futsal / Flag",
    weekday: 6,
    duration: "Livre",
    kind: "sport",
    accent: "zone",
    description:
      "Tatame e jogos. Registre aqui a rola — é o treino principal do bloco de jiu-jitsu e o seu intervalado “natural”.",
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

/** Sessões vivas: alimentam seleção, templates persistidos e catálogo. */
export const ALL_PLAN_SESSIONS = [...PLAN, ...BJJ_PLAN]

/**
 * Sessão apenas de histórico. Um registro por dia contém todos os blocos
 * importados do Strava daquele dia; não aparece no seletor e não avança o
 * ciclo de musculação.
 */
const STRAVA_SESSION: SessionPlan = {
  id: "strava",
  title: "Strava",
  subtitle: "Caminhada / corrida importada",
  weekday: 0,
  duration: "Importada",
  kind: "cardio",
  accent: "zone",
  exercises: [],
}

/**
 * Sessões vivas + aposentadas. Só para resolver nome/prescrição de registros
 * antigos (Histórico); as ativas vêm por último para vencer no caso de ids
 * de exercício repetidos entre protocolos.
 */
const LOOKUP_SESSIONS = [...LEGACY_SESSIONS, STRAVA_SESSION, ...ALL_PLAN_SESSIONS]

/**
 * Sessões disponíveis no registro para cada objetivo. Avulso e esporte são
 * compartilhados; o bloco de jiu-jitsu permanece separado do Upper/Lower.
 */
const HYPERTROPHY_PLAN_IDS: SessionId[] = PLAN.map((session) => session.id)
const BJJ_PLAN_IDS: SessionId[] = [
  ...BJJ_PLAN.map((session) => session.id),
  "free",
  "sport",
]

export function planForProgram(
  program: TrainingProgram,
  templates: SessionPlan[] = ALL_PLAN_SESSIONS
): SessionPlan[] {
  const byId = new Map(templates.map((session) => [session.id, session]))
  const ids = program === "hypertrophy" ? HYPERTROPHY_PLAN_IDS : BJJ_PLAN_IDS
  return ids.map((id) => byId.get(id) ?? PLAN_BY_ID[id])
}

export const PLAN_BY_ID = Object.fromEntries(LOOKUP_SESSIONS.map((s) => [s.id, s])) as Record<
  SessionId,
  SessionPlan
>

export const EXERCISES_BY_ID = Object.fromEntries(
  LOOKUP_SESSIONS.flatMap((s) => s.exercises.map((e) => [e.id, e]))
)

/** Sessões em que cada exercício aparece (para achar histórico) */
export function sessionOfExercise(exerciseId: string): SessionPlan | undefined {
  return ALL_PLAN_SESSIONS.find((s) => s.exercises.some((e) => e.id === exerciseId))
}

/** Sessão planejada para um dia ISO (1=Seg..7=Dom) */
export function sessionForWeekday(
  isoWeekday: number,
  templates: SessionPlan[] = PLAN
): SessionPlan {
  return templates.find((s) => s.weekday === isoWeekday) ??
    templates.find((s) => s.id === "rest") ??
    PLAN_BY_ID.rest
}

const TRAINING_TARGET_SESSION_IDS = new Set<SessionId>([
  "upperA",
  "cardioZ2",
  "lowerA",
  "upperB",
  "lowerB",
  "bjjPull",
  "bjjBase",
  "bjjEngine",
  "bjjZ2",
  // avulso é treino: não avança o ciclo, mas o dia em que você foi treinar
  // não pode aparecer como dia parado
  "free",
  // protocolo aposentado: continua contando no histórico já registrado
  "competitionLower",
  "competitionUpper",
  "competitionPower",
  "competitionZ2",
])

export function countsTowardTrainingTarget(sessionId: SessionId): boolean {
  return TRAINING_TARGET_SESSION_IDS.has(sessionId)
}

const HYPERTROPHY_TARGET_SESSION_IDS = new Set<SessionId>([
  "upperA",
  "cardioZ2",
  "lowerA",
  "upperB",
  "lowerB",
  "free",
])

const BJJ_TARGET_SESSION_IDS = new Set<SessionId>([...BJJ_GYM_SESSION_IDS, "free"])

/**
 * Frequência exibida no painel: 5 sessões na hipertrofia ou 2–3 de sala no
 * jiu-jitsu. Avulso conta nos dois — é academia registrada fora da prescrição.
 * Esporte fica fora: o tatame e o jogo são medidos em minutos, não em sessões
 * de sala.
 */
export function countsTowardProgramTarget(
  sessionId: SessionId,
  program: TrainingProgram
): boolean {
  return program === "bjj"
    ? BJJ_TARGET_SESSION_IDS.has(sessionId)
    : HYPERTROPHY_TARGET_SESSION_IDS.has(sessionId)
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
    body: "Para o SEU objetivo, a Zona 2 de terça é tão inegociável quanto o treino de segunda. É ela que mata a tontura e devolve o fôlego entre rounds.",
  },
  {
    title: "O tatame manda na semana",
    body: "Desde agosto/2026 o jiu-jitsu é o objetivo, não o lazer. A academia serve ao tatame: se a sala custar qualidade técnica no dia seguinte, a sala é que cede.",
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
  { period: "Semanas 6–10", expect: "Rola e futsal ficam confortáveis. Tontura deve ter sumido (se persistir, volte ao médico)." },
  { period: "Meses 3–6", expect: "Recomposição visível: menos cintura, mais ombro. Força estabiliza após queda inicial leve." },
  { period: "Mês 6+", expect: "Reavalie: bioimpedância, ajuste de calorias, possível troca de divisão. Aqui você já corre 5 km e aguenta a aula inteira de jiu-jitsu sem apagar." },
]
