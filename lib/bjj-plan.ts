import { SessionId, SessionPlan, WorkoutLog } from "./types"
import { fromDateKey, toDateKey } from "./utils"

/** Primeiro dia do bloco de preparação física para o jiu-jitsu. */
export const BJJ_START_DATE = "2026-08-25"

/**
 * Preparação física para o jiu-jitsu — bloco aberto, sem data de encerramento.
 * O tatame é o treino principal; a academia constrói as valências que decidem
 * a rola e blinda o que quebra em quem começa: pegada, pescoço, quadril e
 * ombro. Nada aqui compete com o volume técnico da semana.
 */
export const BJJ_PLAN: SessionPlan[] = [
  {
    id: "bjjPull",
    title: "A · Tração & Pegada",
    subtitle: "A academia que aparece na rola",
    weekday: 0,
    duration: "~55–60 min",
    kind: "lift",
    accent: "gold",
    description:
      "Tudo que segura o kimono: dorsal, antebraço e pescoço. Faça no dia sem tatame ou depois do treino técnico — nunca antes.",
    exercises: [
      {
        id: "towel-pullup",
        name: "Barra fixa com toalha",
        nameEn: "Towel Pull-up",
        muscleGroup: "Costas",
        sets: 4,
        repsMin: 3,
        repsMax: 6,
        unit: "reps",
        rest: "2 min",
        note:
          "Duas toalhas na barra, pegada neutra. Sem conseguir? Puxada alta com toalha 4×6–8. É o exercício que mais transfere para a pegada de gola.",
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
        id: "grip-hold",
        name: "Isometria de pegada",
        nameEn: "Bar Hang / Grip Hold",
        muscleGroup: "Braço",
        sets: 3,
        repsMin: 30,
        repsMax: 45,
        unit: "seconds",
        rest: "90 s",
        note:
          "Pendurado na barra ou segurando os halteres do farmer. Registre o peso segurado. Solte antes de a mão abrir sozinha — é resistência, não falha.",
      },
      {
        id: "neck-bridge",
        name: "Fortalecimento de pescoço",
        nameEn: "Neck Isometrics",
        muscleGroup: "Pescoço",
        sets: 3,
        repsMin: 20,
        repsMax: 30,
        unit: "seconds",
        rest: "60 s",
        note:
          "Isometria contra a própria mão nas 4 direções, 20–30 s cada. Só evolua para a ponte quando a isometria ficar fácil. Formigamento ou dor: pare na hora.",
      },
      {
        id: "pallof",
        name: "Pallof press",
        nameEn: "Pallof Press",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "60 s",
        note:
          "10 por lado · anti-rotação é o que impede sua guarda de ser aberta e o que segura a passagem.",
      },
    ],
  },
  {
    id: "bjjBase",
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
          "Por lado · adutor é a lesão clássica de quem fecha a guarda. Comece com o joelho apoiado e só depois estenda a perna.",
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
    title: "C · Motor de Rolagem",
    subtitle: "Opcional · potência e resistência específica",
    weekday: 0,
    duration: "~35–45 min",
    kind: "lift",
    accent: "gold",
    description:
      "Simula o custo de um round: potência repetida com pouca pausa. É a primeira sessão a sair de uma semana pesada de tatame — se a rola já foi dura, pule sem culpa.",
    exercises: [
      {
        id: "kettlebell-swing",
        name: "Kettlebell swing",
        nameEn: "Kettlebell Swing",
        muscleGroup: "Posterior/Glúteo",
        sets: 4,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "Quadril explosivo repetido: o motor do upa e da raspagem. Encerre a série assim que a velocidade cair.",
      },
      {
        id: "medball-slam",
        name: "Slam com medicine ball",
        nameEn: "Medicine Ball Slam",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 5,
        repsMax: 5,
        unit: "reps",
        rest: "90 s",
        note: "Intenção máxima em cada arremesso — é a pressão de cima virando força.",
      },
      {
        id: "medball-rotation",
        name: "Arremesso rotacional com medicine ball",
        nameEn: "Rotational Medicine Ball Throw",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 5,
        repsMax: 5,
        unit: "reps",
        rest: "90 s",
        note:
          "5 por lado · potência rotacional é raspagem, virada de quadril e finalização de passagem.",
      },
      {
        id: "turkish-getup",
        name: "Turkish get-up",
        nameEn: "Turkish Get-up",
        muscleGroup: "Ombro",
        sets: 3,
        repsMin: 3,
        repsMax: 3,
        unit: "reps",
        rest: "90 s",
        note:
          "Por lado, carga leve e sem pressa. É levantar do chão com carga em cima — ombro estável é o que sobrevive à americana e ao stack.",
      },
      {
        id: "bear-crawl",
        name: "Deslocamento de urso",
        nameEn: "Bear Crawl",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 30,
        repsMax: 40,
        unit: "seconds",
        rest: "60 s",
        note:
          "Joelho a um palmo do chão, quadril baixo. É a base de quatro apoios que você usa para levantar e para passar.",
      },
      {
        id: "farmer-carry",
        name: "Farmer carry",
        nameEn: "Farmer Carry",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 40,
        repsMax: 40,
        unit: "seconds",
        rest: "90 s",
        note:
          "Postura alta e pegada firme até o fim. Pegada cansada é finalização perdida no quarto round.",
      },
    ],
  },
  {
    id: "bjjZ2",
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
    how: "Barra com toalha, isometria de pegada e carries",
  },
  {
    name: "Tração",
    why: "Controlar gola e manga é puxar — o padrão mais usado no gi.",
    how: "Barra fixa, remada e puxada",
  },
  {
    name: "Quadril e ponte",
    why: "Upa, raspagem e fuga de quadril saem do glúteo e da cadeia posterior.",
    how: "RDL, hip thrust e kettlebell swing",
  },
  {
    name: "Core anti-rotação",
    why: "Guarda que não abre e passagem que não vira as costas.",
    how: "Pallof press, urso e farmer carry",
  },
  {
    name: "Pescoço",
    why: "Blindagem contra estrangulamento, stack e chave de pescoço. É prevenção antes de performance.",
    how: "Isometrias nas 4 direções; ponte só depois",
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
      "Corpo aprendendo o tatame. Pescoço e pegada entram em dose mínima, a força fica em RIR 3 e você sai da sala sentindo que havia sobra. Dor muscular tardia é normal; dor articular não.",
    sessions: "2 · A + B",
    strength: "RIR 3 · manter",
    grip: "Mínimo · aprender a isometria",
    engine: "Fora — o tatame já basta",
    zone2: "2–3 × 25–30 min",
  },
  {
    id: "construcao",
    label: "Bloco 2 · Construção",
    weeks: 4,
    guidance:
      "Carga sobe para RIR 2, pegada e pescoço ganham volume. É aqui que a rola começa a parecer mais curta do que parecia no primeiro mês.",
    sessions: "2–3 · A + B (+ C)",
    strength: "RIR 2 · progredir",
    grip: "Volume cheio · isometria + carries",
    engine: "Opcional, se o tatame permitir",
    zone2: "3 × 30 min",
  },
  {
    id: "potencia",
    label: "Bloco 3 · Potência",
    weeks: 4,
    guidance:
      "A sessão C entra fixa: swing, medicine ball e get-up. A força que você já tinha vira raspagem rápida e pressão de cima.",
    sessions: "3 · A + B + C",
    strength: "RIR 2 · 1 top set por padrão",
    grip: "Manter · pegada já virou hábito",
    engine: "Fixa · qualidade de movimento",
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
      duration: session.id === "bjjEngine" ? "~30 min" : "~40–50 min",
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
