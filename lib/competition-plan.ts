import { SessionId, SessionPlan, WorkoutLog } from "./types"
import { toDateKey } from "./utils"

export const COMPETITION_START_DATE = "2026-07-18"
export const COMPETITION_GAME_DATE = "2026-08-15"
export const HYPERTROPHY_RETURN_DATE = "2026-08-16"
export const LAST_HEAVY_GYM_DATE = "2026-08-09"

/**
 * Protocolo temporário de academia para a preparação como cornerback.
 * O trabalho de campo continua sob responsabilidade do coach; estas sessões
 * preservam força e transformam parte dela em potência com baixo volume.
 */
export const COMPETITION_PLAN: SessionPlan[] = [
  {
    id: "competitionLower",
    title: "A · Inferior + Potência",
    subtitle: "Sessão-chave · longe do campo pesado",
    weekday: 0,
    duration: "~55–65 min",
    kind: "lift",
    accent: "gold",
    description:
      "Faça com as pernas frescas e, idealmente, a 48 h de sprint, cortes ou coletivo forte. Explosivos sempre vêm primeiro.",
    exercises: [
      {
        id: "box-jump",
        name: "Salto na caixa",
        nameEn: "Box Jump",
        muscleGroup: "Quadríceps",
        sets: 4,
        repsMin: 3,
        repsMax: 3,
        unit: "reps",
        rest: "2 min",
        note:
          "Escolha 1 explosivo: salto na caixa, salto horizontal ou swing 4×6. Aterrisse leve; descanso total e intenção máxima.",
      },
      {
        id: "squat",
        name: "Agachamento livre",
        nameEn: "Back Squat",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 4,
        repsMax: 5,
        unit: "reps",
        rest: "2–3 min",
        note: "3–4 séries @ 85–90 kg · RIR 2–3 · manutenção de força, sem grind e sem PR.",
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
        note: "55–70 kg · RIR 2 · excêntrico controlado para proteger os isquios no sprint.",
      },
      {
        id: "bulgarian",
        name: "Agachamento búlgaro / afundo",
        nameEn: "Bulgarian Split Squat / Lunge",
        muscleGroup: "Quadríceps",
        sets: 2,
        repsMin: 6,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note: "2–3 séries por perna · estabilidade unilateral para cortar e desacelerar.",
      },
      {
        id: "calf",
        name: "Panturrilha em pé",
        nameEn: "Standing Calf Raise",
        muscleGroup: "Panturrilha",
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        unit: "reps",
        rest: "60–90 s",
        note: "Pausa de 1 s embaixo · resiliência de Aquiles para sprint e corte.",
      },
      {
        id: "nordic",
        name: "Nórdico de isquios",
        nameEn: "Nordic Hamstring Curl",
        muscleGroup: "Posterior/Glúteo",
        sets: 2,
        repsMin: 3,
        repsMax: 5,
        unit: "reps",
        rest: "2 min",
        note: "Progrida devagar. Alternativa: mesa flexora 2×8–10. Pare antes de perder o controle.",
      },
    ],
  },
  {
    id: "competitionUpper",
    title: "B · Superiores + Core",
    subtitle: "Baixo custo para as pernas · flexível",
    weekday: 0,
    duration: "~50–60 min",
    kind: "lift",
    accent: "gold",
    description:
      "Pode entrar perto de um dia de campo porque gera pouco cansaço nas pernas. Todos os compostos ficam longe da falha.",
    exercises: [
      {
        id: "bench",
        name: "Supino reto com barra",
        nameEn: "Barbell Bench Press",
        muscleGroup: "Peito",
        sets: 3,
        repsMin: 4,
        repsMax: 6,
        unit: "reps",
        rest: "2–3 min",
        note: "3–4 séries @ 55–60 kg · RIR 2 · manutenção de força, sem buscar PR.",
      },
      {
        id: "row",
        name: "Remada",
        nameEn: "Row",
        muscleGroup: "Costas",
        sets: 3,
        repsMin: 6,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note: "Tronco firme, sem roubo.",
      },
      {
        id: "ohp",
        name: "Desenvolvimento com barra ou halteres",
        nameEn: "Overhead Press",
        muscleGroup: "Ombro",
        sets: 3,
        repsMin: 5,
        repsMax: 8,
        unit: "reps",
        rest: "2 min",
        note: "Manter a força do ombro é prioridade; deixe 2–3 repetições na reserva.",
      },
      {
        id: "pulldown",
        name: "Puxada alta / barra fixa",
        nameEn: "Lat Pulldown / Pull-up",
        muscleGroup: "Costas",
        sets: 2,
        repsMin: 8,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note: "2–3 séries, técnica limpa.",
      },
      {
        id: "facepull",
        name: "Face pull",
        nameEn: "Face Pull",
        muscleGroup: "Ombro",
        sets: 3,
        repsMin: 15,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note: "Saúde de ombro e deltoide posterior.",
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
        note: "10 repetições por lado · anti-rotação para sprint e mudança de direção.",
      },
      {
        id: "dead-bug",
        name: "Dead bug / prancha",
        nameEn: "Dead Bug / Plank",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        unit: "reps",
        rest: "60 s",
        note: "Escolha um. No dead bug, conte por lado; na prancha, troque para 30–45 s.",
      },
    ],
  },
  {
    id: "competitionPower",
    title: "C · Potência Full-Body",
    subtitle: "Opcional · somente se estiver fresco",
    weekday: 0,
    duration: "~35–45 min",
    kind: "lift",
    accent: "gold",
    description:
      "É a primeira sessão a sair de uma semana puxada. Se estiver cansado do campo, faça mobilidade + 25 min de Zona 2 ou descanse.",
    exercises: [
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
        note: "Intenção máxima; encerre a série se a velocidade cair.",
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
        note: "5 por lado · potência de tronco para mudança de direção.",
      },
      {
        id: "kettlebell-swing",
        name: "Kettlebell swing / trenó",
        nameEn: "Kettlebell Swing / Sled Push",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 8,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note: "Alternativa: 3–4 empurrões de trenó. Potência de quadril com baixo impacto.",
      },
      {
        id: "farmer-carry",
        name: "Farmer carry",
        nameEn: "Farmer Carry",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 30,
        repsMax: 40,
        unit: "seconds",
        rest: "90 s",
        note: "3–4 passadas · postura alta, core e pegada firmes.",
      },
      {
        id: "copenhagen",
        name: "Prancha Copenhagen",
        nameEn: "Copenhagen Plank",
        muscleGroup: "Core",
        sets: 2,
        repsMin: 20,
        repsMax: 30,
        unit: "seconds",
        rest: "60 s",
        note: "Por lado · prehab de adutor. Sem dor na virilha.",
      },
      {
        id: "ankle-mobility",
        name: "Mobilidade de tornozelo",
        nameEn: "Ankle Mobility",
        muscleGroup: "Panturrilha",
        sets: 2,
        repsMin: 10,
        repsMax: 12,
        unit: "reps",
        rest: "30 s",
        note: "Movimento controlado, sem tirar o calcanhar do chão.",
      },
    ],
  },
  {
    id: "competitionZ2",
    title: "Zona 2 · Competição",
    subtitle: "Recuperação ativa e base aeróbica",
    weekday: 0,
    duration: "20–30 min",
    kind: "cardio",
    accent: "zone",
    cardioTarget: {
      min: 20,
      max: 30,
      defaultMinutes: 25,
      bpmMin: 125,
      bpmMax: 140,
    },
    description:
      "Bike ou esteira inclinada em ritmo de conversa, FC 125–140. Meta semanal: 60–90 min; zero HIIT na academia. Se o campo já foi pesado, pode pular.",
    exercises: [],
  },
]

export const COMPETITION_CORE_SESSION_IDS: SessionId[] = [
  "competitionLower",
  "competitionUpper",
]

export const COMPETITION_GYM_SESSION_IDS: SessionId[] = [
  ...COMPETITION_CORE_SESSION_IDS,
  "competitionPower",
]

export const COMPETITION_SESSION_IDS: SessionId[] = [
  ...COMPETITION_GYM_SESSION_IDS,
  "competitionZ2",
]

export const COMPETITION_COORDINATION_RULES = [
  "A sessão A nunca entra no mesmo dia nem na véspera de campo forte; busque 48 h de distância.",
  "A sessão B é flexível e pode ficar perto do campo porque poupa as pernas.",
  "Depois de um campo muito puxado, faça B leve, Zona 2/mobilidade ou descanso — nunca A.",
  "No máximo 2 dias de alto estresse neural por semana, somando campo e academia.",
]

export const COMPETITION_PROGRESSION = [
  {
    period: "18–24 jul",
    week: "Semana 1",
    sessions: "2–3",
    strength: "RIR 3 · manter",
    explosive: "Baixo · aprender padrão",
    accessories: "Moderado",
    zone2: "2–3 × 20–30 min",
  },
  {
    period: "25–31 jul",
    week: "Semana 2",
    sessions: "2–3",
    strength: "RIR 2–3 · manter",
    explosive: "+ intenção · máxima qualidade",
    accessories: "Moderado",
    zone2: "2–3 × 25–30 min",
  },
  {
    period: "01–07 ago",
    week: "Semana 3",
    sessions: "2",
    strength: "1 top set pesado-ish",
    explosive: "Pico de qualidade",
    accessories: "Reduzido",
    zone2: "1–2 × 20–25 min",
  },
  {
    period: "08–14 ago",
    week: "Semana 4 · taper",
    sessions: "1–2 leves",
    strength: "Leve · feel-good",
    explosive: "Mínimo · só afiar",
    accessories: "Mínimo",
    zone2: "1 × 20 min ou zero",
  },
]

export type CompetitionPhaseId = "week1" | "week2" | "week3" | "taper" | "game" | "complete"

export interface CompetitionPhase {
  id: CompetitionPhaseId
  label: string
  dates: string
  guidance: string
}

export function competitionPhaseFor(date: Date): CompetitionPhase {
  const key = toDateKey(date)
  if (key > COMPETITION_GAME_DATE) {
    return {
      id: "complete",
      label: "Protocolo encerrado",
      dates: "após 15 ago",
      guidance: "Volte ao programa de hipertrofia e recomposição.",
    }
  }
  if (key === COMPETITION_GAME_DATE) {
    return {
      id: "game",
      label: "Dia do campeonato",
      dates: "15 ago",
      guidance: "Sem academia. Chegue com as pernas frescas.",
    }
  }
  if (key >= "2026-08-08") {
    return {
      id: "taper",
      label: "Semana 4 · taper",
      dates: "08–14 ago",
      guidance:
        "Só 1–2 sessões leves de priming. Depois de 09/08, nada de perna pesada; frescor vale mais que volume.",
    }
  }
  if (key >= "2026-08-01") {
    return {
      id: "week3",
      label: "Semana 3 · pico",
      dates: "01–07 ago",
      guidance: "Faça 2 sessões, priorize qualidade explosiva e reduza acessórios.",
    }
  }
  if (key >= "2026-07-25") {
    return {
      id: "week2",
      label: "Semana 2 · construção",
      dates: "25–31 jul",
      guidance: "Mantenha a força em RIR 2–3 e aumente a intenção dos explosivos, sem aumentar fadiga.",
    }
  }
  return {
    id: "week1",
    label: "Semana 1 · entrada",
    dates: "18–24 jul",
    guidance: "Use RIR 3, aprenda os padrões explosivos e termine cada sessão sentindo que havia sobra.",
  }
}

/** Prescrição enxuta exibida no registro durante a semana de taper. */
export function competitionPlanForDate(
  date: Date,
  templates: SessionPlan[] = COMPETITION_PLAN
): SessionPlan[] {
  const phase = competitionPhaseFor(date)
  if (phase.id !== "taper" && phase.id !== "game") return templates

  return templates.map((session) => {
    if (session.id === "competitionZ2") {
      return {
        ...session,
        duration: "20 min ou zero",
        cardioTarget: {
          ...session.cardioTarget!,
          min: 20,
          max: 20,
          defaultMinutes: 20,
        },
        description:
          "Taper: no máximo 20 min muito fáceis. Se as pernas pedirem descanso, pule a sessão.",
      }
    }
    return {
      ...session,
      title: `${session.title} · Taper`,
      duration: "~25–35 min",
      description:
        "Priming leve: poucas séries, movimentos rápidos e sensação de sobra. Nada de perna pesada.",
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: Math.min(2, exercise.sets),
        note: `TAPER: carga leve, RIR 4+ e sem perda de velocidade. ${exercise.note}`,
      })),
    }
  })
}

export function nextCompetitionSession(workouts: WorkoutLog[], today: Date): SessionId {
  const todayKey = toDateKey(today)
  const core = workouts
    .filter(
      (workout) =>
        workout.date <= todayKey && COMPETITION_CORE_SESSION_IDS.includes(workout.sessionId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const last = core[core.length - 1]
  return last?.sessionId === "competitionLower" ? "competitionUpper" : "competitionLower"
}

export interface CompetitionTodayView {
  sessionId: SessionId
  nextSessionId: SessionId
  completedSessionId: SessionId | null
  done: boolean
}

export function competitionTodayView(
  workouts: WorkoutLog[],
  today: Date
): CompetitionTodayView {
  const todayKey = toDateKey(today)
  const nextSessionId = nextCompetitionSession(workouts, today)
  const completed = [...workouts]
    .reverse()
    .find(
      (workout) =>
        workout.date === todayKey && COMPETITION_SESSION_IDS.includes(workout.sessionId)
    )

  return {
    sessionId: completed?.sessionId ?? nextSessionId,
    nextSessionId,
    completedSessionId: completed?.sessionId ?? null,
    done: Boolean(completed),
  }
}

export function isCompetitionGymSession(sessionId: SessionId): boolean {
  return COMPETITION_GYM_SESSION_IDS.includes(sessionId)
}

export function isCompetitionSession(sessionId: SessionId): boolean {
  return COMPETITION_SESSION_IDS.includes(sessionId)
}
