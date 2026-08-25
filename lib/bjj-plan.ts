import { SessionId, SessionPlan, WorkoutLog } from "./types"
import { fromDateKey, toDateKey } from "./utils"

/** Primeiro dia do bloco de preparação física para o jiu-jitsu. */
export const BJJ_START_DATE = "2026-08-25"

/**
 * Versão da prescrição v2: exercícios adaptados para academia comum
 * (máquina de puxada, barra, halteres e polia — sem toalha, medicine ball
 * ou isometrias improvisadas). Descarta templates antigos materializados.
 */
export const BJJ_PLAN_VERSION = "academia-v2"

/**
 * Preparação física para o jiu-jitsu — bloco aberto, sem data de encerramento.
 * O tatame é o treino principal; a academia constrói as valências que decidem
 * a rola e blinda o que quebra em quem começa: pegada, pescoço, quadril e
 * ombro. Nada aqui compete com o volume técnico da semana — e tudo roda em
 * academia comum: máquina de puxada, barra, halteres e polia.
 */
export const BJJ_PLAN: SessionPlan[] = [
  {
    id: "bjjPull",
    planVersion: BJJ_PLAN_VERSION,
    title: "A · Tração & Pegada",
    subtitle: "A academia que aparece na rola",
    weekday: 0,
    duration: "~55–60 min",
    kind: "lift",
    accent: "gold",
    description:
      "Tudo que segura o kimono: dorsal, antebraço e trapézio, com o que toda academia tem — máquina de puxada, barra e halteres. Faça no dia sem tatame ou depois do treino técnico — nunca antes.",
    exercises: [
      {
        id: "pulldown",
        name: "Puxada alta na máquina",
        nameEn: "Lat Pulldown",
        muscleGroup: "Costas",
        sets: 4,
        repsMin: 6,
        repsMax: 10,
        unit: "reps",
        rest: "2 min",
        note:
          "Pegada pronada um pouco mais aberta que os ombros, barra até o peito alto. É o puxar vertical que mais transfere para controlar gola e manga — progrida a carga quando fechar as 4 séries na faixa.",
      },
      {
        id: "row",
        name: "Remada curvada com barra",
        nameEn: "Barbell Row",
        muscleGroup: "Costas",
        sets: 4,
        repsMin: 6,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · 45–55 kg. Puxar é o padrão nº 1 do gi: controle de gola e de manga sai daqui.",
      },
      {
        id: "db-ohp",
        name: "Desenvolvimento com halteres",
        nameEn: "Dumbbell Shoulder Press",
        muscleGroup: "Ombro",
        sets: 3,
        repsMin: 6,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · 14–16 kg. Ombro forte é o que aguenta stack, americana e chave de braço — seu elo fraco de força, então é prioridade.",
      },
      {
        id: "shrug",
        name: "Encolhimento com barra ou halteres",
        nameEn: "Shrug",
        muscleGroup: "Pescoço",
        sets: 3,
        repsMin: 10,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "Ombros sobem até as orelhas com pausa de 1 s no topo, sem rodar. Trapézio forte é a blindagem cervical contra stack e estrangulamento — e ainda carrega a pegada.",
      },
      {
        id: "hammer",
        name: "Rosca martelo",
        nameEn: "Hammer Curl",
        muscleGroup: "Braço",
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 1 · braquial e antebraço são a blindagem do cotovelo contra armlock e kimura.",
      },
      {
        id: "wrist-curl",
        name: "Rosca de punho com barra",
        nameEn: "Barbell Wrist Curl",
        muscleGroup: "Braço",
        sets: 3,
        repsMin: 15,
        repsMax: 20,
        unit: "reps",
        rest: "60 s",
        note:
          "Antebraços apoiados no banco, punhos livres além da borda, amplitude completa. Os flexores de punho são o motor da pegada de gola — aqui é volume e controle, não carga máxima.",
      },
      {
        id: "pallof",
        name: "Pallof press na polia",
        nameEn: "Pallof Press",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "60 s",
        note:
          "Polia à altura do peito, 10 por lado · anti-rotação é o que impede sua guarda de ser aberta e o que segura a passagem.",
      },
    ],
  },
  {
    id: "bjjBase",
    planVersion: BJJ_PLAN_VERSION,
    title: "B · Quadril & Base",
    subtitle: "Upa, raspagem e base de pé",
    weekday: 0,
    duration: "~55–65 min",
    kind: "lift",
    accent: "gold",
    description:
      "A força de quadril que você já tem do powerlifting, convertida em ponte, raspagem e base difícil de derrubar. Peça 24 h de folga de rola dura.",
    exercises: [
      {
        id: "squat",
        name: "Agachamento livre",
        nameEn: "Back Squat",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 4,
        repsMax: 6,
        unit: "reps",
        rest: "2–3 min",
        note:
          "RIR 2–3 · 85–95 kg. Manutenção de força: sem grind e sem PR. Sua base de pé nasce aqui.",
      },
      {
        id: "rdl",
        name: "Terra romeno (RDL)",
        nameEn: "Romanian Deadlift",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 6,
        repsMax: 8,
        unit: "reps",
        rest: "2 min",
        note:
          "RIR 2 · 55–70 kg, excêntrico controlado. Cadeia posterior é puxar o oponente para a guarda e levantar de baixo.",
      },
      {
        id: "hipthrust",
        name: "Elevação pélvica (hip thrust)",
        nameEn: "Barbell Hip Thrust",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        unit: "reps",
        rest: "90 s",
        note: "60–90 kg · é o upa com carga. Pausa de 1 s no topo com o quadril travado.",
      },
      {
        id: "bulgarian",
        name: "Agachamento búlgaro / afundo",
        nameEn: "Bulgarian Split Squat / Lunge",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 6,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note:
          "Por perna · base unilateral para passar a guarda e não perder o pé quando puxam sua perna.",
      },
      {
        id: "copenhagen",
        name: "Prancha Copenhagen",
        nameEn: "Copenhagen Plank",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 20,
        repsMax: 30,
        unit: "seconds",
        rest: "60 s",
        note:
          "Por lado, no banco · adutor é a lesão clássica de quem fecha a guarda. Comece com o joelho apoiado e só depois estenda a perna.",
      },
      {
        id: "back-extension",
        name: "Hiperextensão lombar",
        nameEn: "Back Extension",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 2 · lombar resistente é postura na guarda e resistência ao stack. Suba até a linha neutra, sem hiperestender.",
      },
      {
        id: "hip-90-90",
        name: "Mobilidade de quadril 90/90",
        nameEn: "90/90 Hip Switch",
        muscleGroup: "Posterior/Glúteo",
        sets: 2,
        repsMin: 8,
        repsMax: 10,
        unit: "reps",
        rest: "30 s",
        note:
          "Por lado, lento e sem impulso · rotação de quadril é o que permite recompor a guarda, inverter e passar de joelho sem cobrar do joelho.",
      },
    ],
  },
  {
    id: "bjjEngine",
    planVersion: BJJ_PLAN_VERSION,
    title: "C · Potência na Barra",
    subtitle: "Opcional · explosão com barra e máquina",
    weekday: 0,
    duration: "~40–50 min",
    kind: "lift",
    accent: "gold",
    description:
      "Potência repetida sem equipamento exótico: clean, push press e perna explosiva na máquina. É a primeira sessão a sair de uma semana pesada de tatame — se a rola já foi dura, pule sem culpa.",
    exercises: [
      {
        id: "power-clean",
        name: "Power clean",
        nameEn: "Power Clean",
        muscleGroup: "Posterior/Glúteo",
        sets: 4,
        repsMin: 3,
        repsMax: 5,
        unit: "reps",
        rest: "2–3 min",
        note:
          "O motor do upa e da raspagem: salto que termina com a barra no ombro. Técnica antes de carga — encerre a série assim que a velocidade cair.",
      },
      {
        id: "push-press",
        name: "Push press",
        nameEn: "Push Press",
        muscleGroup: "Ombro",
        sets: 3,
        repsMin: 5,
        repsMax: 5,
        unit: "reps",
        rest: "2 min",
        note:
          "Mergulho curto de joelho e drive para passar a barra. Tríplice extensão coordenada vira pressão de cima e quadro difícil de derrubar.",
      },
      {
        id: "legpress",
        name: "Leg press 45° explosivo",
        nameEn: "Explosive Leg Press",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 8,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note:
          "Subida rápida e intencional, descida em 2–3 s, sem travar o joelho no topo. Potência de perna com a segurança da máquina.",
      },
      {
        id: "cablecrunch",
        name: "Abdominal na polia alta",
        nameEn: "Cable Crunch",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "Joelhos no chão, quadril fixo, enrole o tronco puxando a corda. Core sob carga com o que toda academia tem.",
      },
    ],
  },
  {
    id: "bjjZ2",
    planVersion: BJJ_PLAN_VERSION,
    title: "Zona 2 · Jiu-Jitsu",
    subtitle: "Fôlego entre os rounds",
    weekday: 0,
    duration: "25–35 min",
    kind: "cardio",
    accent: "zone",
    cardioTarget: {
      min: 25,
      max: 40,
      defaultMinutes: 30,
      bpmMin: 125,
      bpmMax: 140,
    },
    description:
      "Bike ou esteira inclinada em ritmo de conversa, FC 125–140. Meta semanal: 60–120 min. É a base aeróbica que devolve o fôlego entre um round e o próximo — e o remédio da tontura.",
    exercises: [],
  },
]

export const BJJ_CORE_SESSION_IDS: SessionId[] = ["bjjPull", "bjjBase"]

export const BJJ_GYM_SESSION_IDS: SessionId[] = [...BJJ_CORE_SESSION_IDS, "bjjEngine"]

export const BJJ_SESSION_IDS: SessionId[] = [...BJJ_GYM_SESSION_IDS, "bjjZ2"]

/** Valências que a sala precisa entregar para o tatame — e por quê. */
export const BJJ_VALENCES = [
  {
    name: "Pegada e antebraço",
    why: "Primeiro limitador de quem começa: quem solta a gola perde a posição.",
    how: "Puxada alta, rosca de punho e rosca martelo",
  },
  {
    name: "Tração",
    why: "Controlar gola e manga é puxar — o padrão mais usado no gi.",
    how: "Puxada alta na máquina, remada curvada",
  },
  {
    name: "Quadril e ponte",
    why: "Upa, raspagem e fuga de quadril saem do glúteo e da cadeia posterior.",
    how: "Power clean, RDL e hip thrust",
  },
  {
    name: "Core anti-rotação",
    why: "Guarda que não abre e passagem que não vira as costas.",
    how: "Pallof press e abdominal na polia alta",
  },
  {
    name: "Pescoço e trapézio",
    why: "Blindagem contra estrangulamento, stack e chave de pescoço. É prevenção antes de performance.",
    how: "Encolhimento com pausa no topo — sem ponte, sem isometria improvisada",
  },
  {
    name: "Mobilidade de quadril",
    why: "Recompor guarda, inverter e passar de joelho sem cobrar do joelho.",
    how: "90/90, Copenhagen e búlgaro",
  },
  {
    name: "Base aeróbica",
    why: "Recuperar entre rounds e não apagar no terceiro.",
    how: "Zona 2 de 25–35 min, 2–3× por semana",
  },
]

export const BJJ_MAT_RULES = [
  "O tatame é o treino principal; a sala é suporte. Nenhuma sessão de academia pode custar qualidade técnica no dia seguinte.",
  "Academia depois do tatame, nunca antes: chegue para a técnica com pegada, pescoço e cabeça inteiros.",
  "A sessão B pede 24 h de folga de rola dura — perna pesada vira base ruim e joelho exposto.",
  "Pegada e pescoço não repetem em dias seguidos. Antebraço e cervical são os primeiros a estourar em quem começa.",
  "No máximo 2 dias de alto estresse por semana somando rolas duras e academia. Semana com 3+ rolas fortes? Corte a sessão C.",
]

export type BjjPhaseId = "adaptacao" | "construcao" | "potencia" | "manutencao"

interface BjjBlock {
  id: BjjPhaseId
  label: string
  /** duração em semanas; null = bloco aberto, sempre o último da lista */
  weeks: number | null
  guidance: string
  sessions: string
  strength: string
  grip: string
  engine: string
  zone2: string
}

const BJJ_BLOCKS: BjjBlock[] = [
  {
    id: "adaptacao",
    label: "Bloco 1 · Adaptação",
    weeks: 3,
    guidance:
      "Corpo aprendendo o tatame. Pegada entra em dose mínima, a força fica em RIR 3 e você sai da sala sentindo que havia sobra. Dor muscular tardia é normal; dor articular não.",
    sessions: "2 · A + B",
    strength: "RIR 3 · manter",
    grip: "Mínimo · punho leve",
    engine: "Fora — o tatame já basta",
    zone2: "2–3 × 25–30 min",
  },
  {
    id: "construcao",
    label: "Bloco 2 · Construção",
    weeks: 4,
    guidance:
      "Carga sobe para RIR 2, pegada e trapézio ganham volume. É aqui que a rola começa a parecer mais curta do que parecia no primeiro mês.",
    sessions: "2–3 · A + B (+ C)",
    strength: "RIR 2 · progredir",
    grip: "Volume cheio · punho + martelo",
    engine: "Opcional, se o tatame permitir",
    zone2: "3 × 30 min",
  },
  {
    id: "potencia",
    label: "Bloco 3 · Potência",
    weeks: 4,
    guidance:
      "A sessão C entra fixa: power clean, push press e perna explosiva na máquina. A força que você já tinha vira raspagem rápida e pressão de cima.",
    sessions: "3 · A + B + C",
    strength: "RIR 2 · 1 top set por padrão",
    grip: "Manter · pegada já virou hábito",
    engine: "Fixa · velocidade manda",
    zone2: "2–3 × 30–35 min",
  },
  {
    id: "manutencao",
    label: "Bloco 4 · Manutenção",
    weeks: null,
    guidance:
      "Bloco aberto: 2 sessões fixas e a C conforme o tatame permitir. Reavalie carga, pegada e pescoço a cada 4 semanas — e ajuste para baixo em semana de muita rola.",
    sessions: "2–3 · ajuste ao tatame",
    strength: "RIR 2 · ondular por semana",
    grip: "Manter",
    engine: "Conforme a sobra de energia",
    zone2: "2–3 × 30 min",
  },
]

function shiftDateKey(key: string, days: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function shortDate(key: string): string {
  const [, month, day] = key.split("-")
  return `${day}/${month}`
}

/** Janela de cada bloco, derivada de BJJ_START_DATE — nada de data chumbada. */
function blockWindows() {
  let cursor = BJJ_START_DATE
  return BJJ_BLOCKS.map((block) => {
    const start = cursor
    if (block.weeks === null) {
      return { block, start, end: null, dates: `a partir de ${shortDate(start)}` }
    }
    const end = shiftDateKey(start, block.weeks * 7 - 1)
    cursor = shiftDateKey(end, 1)
    return { block, start, end, dates: `${shortDate(start)} – ${shortDate(end)}` }
  })
}

export interface BjjPhase {
  id: BjjPhaseId
  label: string
  dates: string
  guidance: string
}

export function bjjPhaseFor(date: Date): BjjPhase {
  const key = toDateKey(date)
  const windows = blockWindows()
  const current =
    windows.find((window) => window.end === null || key <= window.end) ??
    windows[windows.length - 1]
  return {
    id: current.block.id,
    label: current.block.label,
    dates: current.dates,
    guidance: current.block.guidance,
  }
}

/** Tabela de progressão exibida no Plano, com as janelas já calculadas. */
export const BJJ_PROGRESSION = blockWindows().map(({ block, dates }) => ({
  period: dates,
  block: block.label,
  sessions: block.sessions,
  strength: block.strength,
  grip: block.grip,
  engine: block.engine,
  zone2: block.zone2,
}))

/**
 * Prescrição exibida no registro. No bloco de adaptação a sala cede espaço
 * para o tatame: uma série a menos em cada exercício e nada perto da falha.
 */
export function bjjPlanForDate(
  date: Date,
  templates: SessionPlan[] = BJJ_PLAN
): SessionPlan[] {
  if (bjjPhaseFor(date).id !== "adaptacao") return templates

  return templates.map((session) => {
    if (session.kind !== "lift") return session
    return {
      ...session,
      duration: session.id === "bjjEngine" ? "~35 min" : "~40–50 min",
      description:
        session.id === "bjjEngine"
          ? "Fora do bloco de adaptação: o tatame já cobre o motor. Só entre se a semana tiver sido leve de rola — e mesmo assim, na versão curta abaixo."
          : "Adaptação: volume reduzido e nenhuma série até a falha. Quem precisa da sua energia agora é o tatame.",
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: Math.max(2, exercise.sets - 1),
        note: `ADAPTAÇÃO: volume reduzido e RIR 3. ${exercise.note}`,
      })),
    }
  })
}

export function nextBjjSession(workouts: WorkoutLog[], today: Date): SessionId {
  const todayKey = toDateKey(today)
  const core = workouts
    .filter(
      (workout) =>
        workout.date <= todayKey && BJJ_CORE_SESSION_IDS.includes(workout.sessionId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const last = core[core.length - 1]
  return last?.sessionId === "bjjPull" ? "bjjBase" : "bjjPull"
}

export interface BjjTodayView {
  sessionId: SessionId
  nextSessionId: SessionId
  completedSessionId: SessionId | null
  done: boolean
}

export function bjjTodayView(workouts: WorkoutLog[], today: Date): BjjTodayView {
  const todayKey = toDateKey(today)
  const nextSessionId = nextBjjSession(workouts, today)
  const completed = [...workouts]
    .reverse()
    .find(
      (workout) => workout.date === todayKey && BJJ_SESSION_IDS.includes(workout.sessionId)
    )

  return {
    sessionId: completed?.sessionId ?? nextSessionId,
    nextSessionId,
    completedSessionId: completed?.sessionId ?? null,
    done: Boolean(completed),
  }
}

export function isBjjGymSession(sessionId: SessionId): boolean {
  return BJJ_GYM_SESSION_IDS.includes(sessionId)
}

export function isBjjSession(sessionId: SessionId): boolean {
  return BJJ_SESSION_IDS.includes(sessionId)
}
