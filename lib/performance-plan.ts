import { SessionId, SessionPlan, WorkoutLog } from "./types"
import { toDateKey } from "./utils"

/** Primeiro dia da pré-temporada de grappling. Segunda-feira, por definição. */
export const PERFORMANCE_START_DATE = "2026-09-21"

/**
 * Versão da prescrição — e, aqui, também a FASE.
 *
 * As três fases do plano (Fundação, Força & Potência, Conversão) não viram
 * três conjuntos de sessões: viram três conteúdos para as mesmas cinco. Trocar
 * de fase é trocar esta string junto com os exercícios, e o
 * `normalizeTemplate()` já descarta o template materializado da fase anterior
 * em favor do default novo. Nenhuma tela nova, nenhum contador de semana.
 */
export const PERFORMANCE_PLAN_VERSION = "performance-f1"

/**
 * Rótulo da fase corrente. É texto fixo, casado com PERFORMANCE_PLAN_VERSION —
 * de propósito. Derivar a fase de uma data traria de volta exatamente o que
 * este programa evita: o app perguntando "em que semana você está?".
 */
export const PERFORMANCE_PHASE = {
  label: "Fase 1 · Fundação",
  detail: "semanas 1–12 · 94 → 88 kg",
} as const

/** Meta semanal de Zona 2 na fase corrente, em minutos. */
export const PERFORMANCE_Z2_TARGET = { min: 180, max: 240 }

/**
 * Pré-temporada de grappling — Performance.
 *
 * Objetivo: transferir uma base de powerlifting para o tatame. Forte em
 * relação ao peso, explosivo, com pegada, pescoço e um motor que aguenta dois
 * períodos. Substitui o ciclo de motor como objetivo principal e absorve o que
 * ele construiu: a Zona 2 continua sendo o piso da semana, o intervalado
 * continua e cresce, e a musculação deixa de ser seguro contra o déficit para
 * voltar a ser o programa.
 *
 * Três decisões de desenho, todas a favor de menos atrito na academia:
 *
 * 1. CINCO sessões fixas nas 40 semanas. O que muda entre as fases é o
 *    conteúdo delas, nunca a quantidade nem a navegação.
 * 2. Fila rotativa (PERF_CYCLE), não calendário. Chegou na academia, o card já
 *    diz qual é a vez. Faltou três dias, a fila espera. Nunca é preciso saber
 *    em que semana do plano você está.
 * 3. Carga de partida e regra de progressão moram na `note` do exercício; a
 *    tabela semana a semana fica no PDF. Quem sugere o próximo passo é o
 *    `suggestLoad()`, que já respeita o incremento real do aparelho.
 */
export const PERFORMANCE_PLAN: SessionPlan[] = [
  {
    id: "perfPower",
    planVersion: PERFORMANCE_PLAN_VERSION,
    title: "Força A · Inferior",
    subtitle: "Agachamento, cadeia posterior e pegada",
    weekday: 0,
    duration: "~60 min + 10 min Z2",
    kind: "lift",
    accent: "gold",
    cardioAfter: { minutes: 10, label: "Zona 2 de encerramento — FC 125–138" },
    description:
      "O agachamento volta a ser o centro da semana: caiu 26% entre junho e setembro sem nenhum déficit envolvido. Termina com pegada porque pegada cansada é pegada treinada — e antebraço fatigado não atrapalha nada que venha depois.",
    exercises: [
      {
        id: "squat",
        name: "Agachamento livre",
        nameEn: "Back Squat",
        muscleGroup: "Quadríceps",
        sets: 5,
        repsMin: 5,
        repsMax: 5,
        unit: "reps",
        rest: "3 min",
        note:
          "RIR 2–3 · iniciar 75 kg. +2,5 kg por semana enquanto fechar as cinco séries. Profundidade abaixo do paralelo — é a posição de base do wrestling, não é preciosismo.",
      },
      {
        id: "rdl",
        name: "Terra romeno (Stiff)",
        nameEn: "Romanian Deadlift",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 8,
        repsMax: 8,
        unit: "reps",
        rest: "2 min",
        note:
          "RIR 2 · iniciar 60 kg. Seu único registro foi 45 kg × 8 em junho — está leve demais para quem agacha 100. Quadril para trás, barra raspando a coxa.",
      },
      {
        id: "walking-lunge",
        name: "Afundo caminhando",
        nameEn: "Walking Lunge",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · repetições POR PERNA · iniciar com par de 12 kg. Unilateral é o que falta no seu histórico: um búlgaro em três meses. Joelho de trás quase tocando o chão, tronco ereto.",
      },
      {
        id: "hipthrust",
        name: "Elevação pélvica",
        nameEn: "Barbell Hip Thrust",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 1–2 · iniciar 60 kg. Extensão de quadril é o motor de toda queda. Pausa de 1 s no topo, queixo para o peito.",
      },
      {
        id: "legcurl",
        name: "Mesa flexora",
        nameEn: "Lying Leg Curl",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 12,
        repsMax: 12,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 1 · iniciar 40 kg, pausa de 1 s no pico. Seu posterior está em 0,67× o quadríceps — desequilíbrio que vira lesão de isquiotibial na primeira sprawl.",
      },
      {
        id: "farmer-carry",
        name: "Farmer walk",
        nameEn: "Farmer's Carry",
        // mesma classificação que o protocolo de competição já usava para este
        // id — carregamento é core sob carga, com a pegada de brinde
        muscleGroup: "Core",
        sets: 4,
        repsMin: 40,
        repsMax: 40,
        unit: "reps",
        rest: "90 s",
        note:
          "NOVO · as repetições são METROS e a carga é por mão — iniciar 2 × 24 kg, +2 kg por semana. Ombros para trás, costelas para baixo, passo curto. Sem espaço? Segure parado por 45 s.",
      },
      {
        id: "dead-hang",
        name: "Suspensão na barra",
        nameEn: "Dead Hang",
        muscleGroup: "Costas",
        sets: 3,
        repsMin: 20,
        repsMax: 60,
        unit: "seconds",
        rest: "60 s",
        note:
          "NOVO · até onde aguentar, peso corporal. Pegada pronada e ombros ATIVOS, não pendurado no ligamento. Anote os segundos: este é o seu teste de pegada. Meta da fase: 45 s.",
      },
    ],
  },
  {
    id: "perfPull",
    planVersion: PERFORMANCE_PLAN_VERSION,
    title: "Força B · Superior",
    subtitle: "Puxada vertical, empurrar e pescoço",
    weekday: 0,
    duration: "~60 min + 10 min Z2",
    kind: "lift",
    accent: "gold",
    cardioAfter: { minutes: 10, label: "Zona 2 de encerramento — FC 125–138" },
    description:
      "Abre com barra fixa porque é a lacuna mais cara do seu histórico — zero registros em 91 dias — e lacuna se resolve com prioridade, não com boa vontade no fim da sessão. Fecha com pescoço, que é inegociável desde o dia 1.",
    exercises: [
      {
        id: "pullup",
        name: "Barra fixa",
        nameEn: "Pull-up",
        muscleGroup: "Costas",
        sets: 5,
        repsMin: 3,
        repsMax: 5,
        unit: "reps",
        rest: "2 min",
        note:
          "NOVO — a prioridade da fase. Puxar o próprio corpo é o gesto de sair de baixo e subir nas costas: o exercício mais transferível que existe para grappling. Comece com elástico ou máquina assistida (registre a carga de assistência como negativa não; use o campo para o peso adicional quando ele existir). Retire a ajuda quando fechar 5×5 estritas.",
      },
      {
        id: "bench",
        name: "Supino reto com barra",
        nameEn: "Barbell Bench Press",
        muscleGroup: "Peito",
        sets: 4,
        repsMin: 6,
        repsMax: 6,
        unit: "reps",
        rest: "2 min",
        note:
          "RIR 2 · iniciar 55 kg, +2,5 kg por semana. Você fez 60 × 8 com RIR 2 em agosto — comece abaixo disso de propósito. Escápulas retraídas, sem quicar.",
      },
      {
        id: "row",
        name: "Remada curvada",
        nameEn: "Barbell Row",
        muscleGroup: "Costas",
        sets: 4,
        repsMin: 8,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · iniciar 45 kg. Abandonada desde 13/06 — é ela que segura a postura de pegada. Tronco a 45°, sem roubo: se o tronco sobe, a carga baixa.",
      },
      {
        id: "ohp",
        name: "Desenvolvimento militar",
        nameEn: "Overhead Press",
        muscleGroup: "Ombro",
        sets: 3,
        repsMin: 6,
        repsMax: 6,
        unit: "reps",
        rest: "2 min",
        note:
          "RIR 2 · iniciar 30 kg, +1,25 kg por semana — ombro progride devagar. Seu elo fraco confirmado: 0,40× do peso corporal. Em pé, glúteo apertado, sem arco de lombar.",
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
        note:
          "RIR 1 · iniciar 40 kg. Saúde de ombro e deltoide posterior com muito volume de agarre pela frente. Cotovelos altos, puxe até a linha dos olhos.",
      },
      {
        id: "hammer",
        name: "Rosca martelo",
        nameEn: "Hammer Curl",
        muscleGroup: "Braço",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 1 · par de 14 kg. Pegada neutra fortalece o braquiorradial — o músculo do agarre de manga e de nuca.",
      },
      {
        id: "neck-iso",
        name: "Pescoço · isometria",
        nameEn: "Neck Isometrics",
        muscleGroup: "Pescoço",
        sets: 3,
        repsMin: 20,
        repsMax: 20,
        unit: "seconds",
        rest: "30 s",
        note:
          "NOVO E OBRIGATÓRIO · 20 s em CADA uma das quatro direções: frente, trás, esquerda, direita. Resistência com a própria mão, pressão constante, cabeça imóvel. Wrestling carrega o pescoço em posições que nada mais reproduz — isto existe por segurança, não por desempenho. NADA de ponte de pescoço nesta fase.",
      },
    ],
  },
  {
    id: "perfFull",
    planVersion: PERFORMANCE_PLAN_VERSION,
    title: "Força C · Corpo inteiro",
    subtitle: "Potência, terra e core anti-rotação",
    weekday: 0,
    duration: "~55 min",
    kind: "lift",
    accent: "gold",
    description:
      "O dia em que a potência entra e o terra convencional aparece pela primeira vez nos seus registros. Cargas leves, velocidade alta, técnica acima de tudo: esta sessão constrói o gesto, não a tonelagem. Explosivo SEMPRE primeiro — power clean cansado não treina potência, treina técnica ruim sob fadiga.",
    exercises: [
      {
        id: "power-clean",
        name: "Power Clean",
        nameEn: "Power Clean",
        muscleGroup: "Posterior/Glúteo",
        sets: 5,
        repsMin: 3,
        repsMax: 3,
        unit: "reps",
        rest: "2 min",
        note:
          "Velocidade acima de carga · iniciar 45 kg. Você fez 50 × 6 em julho e nunca mais repetiu. Encerre a série no instante em que a barra desacelerar. Se a técnica não estiver pronta, faça puxada alta (high pull).",
      },
      {
        id: "deadlift",
        name: "Levantamento terra",
        nameEn: "Conventional Deadlift",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 5,
        repsMax: 5,
        unit: "reps",
        rest: "3 min",
        note:
          "NOVO — sem um único registro no seu histórico. Iniciar 80 kg, bem abaixo do que você acha que levanta, +5 kg por semana enquanto a coluna ficar neutra. Sem cinto nas primeiras seis semanas. Filme as primeiras sessões.",
      },
      {
        id: "goblet-squat",
        name: "Agachamento goblet",
        nameEn: "Goblet Squat",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · iniciar 24 kg. Profundidade máxima com pausa de 2 s embaixo: trabalha mobilidade de quadril e tornozelo junto com a força.",
      },
      {
        id: "db-row",
        name: "Remada unilateral com halter",
        nameEn: "One-arm Dumbbell Row",
        muscleGroup: "Costas",
        sets: 3,
        repsMin: 10,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · repetições por lado · iniciar 28 kg. Assimetria é a regra na luta; treine um lado por vez.",
      },
      {
        id: "pushup",
        name: "Flexão de braço",
        nameEn: "Push-up",
        muscleGroup: "Peito",
        sets: 3,
        repsMin: 10,
        repsMax: 30,
        unit: "reps",
        rest: "60 s",
        note:
          "Até onde aguentar, corpo em prancha rígida. Anote as repetições — é o seu teste de resistência de empurrar.",
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
        rest: "45 s",
        note:
          "RIR 1 · repetições por lado · iniciar 15–20 kg. Anti-rotação é o core do grappling: resistir a ser girado vale mais que abdominal. Quadril fixo, braços estendem e voltam devagar.",
      },
      {
        id: "plank",
        name: "Prancha com deslocamento",
        nameEn: "Plank with Reach",
        muscleGroup: "Core",
        sets: 3,
        repsMin: 40,
        repsMax: 40,
        unit: "seconds",
        rest: "45 s",
        note: "Estenda um braço à frente por vez, sem deixar o quadril rodar.",
      },
    ],
  },
  {
    id: "perfZ2",
    planVersion: PERFORMANCE_PLAN_VERSION,
    title: "Motor · Zona 2",
    subtitle: "Base aeróbica",
    weekday: 0,
    duration: "45–75 min",
    kind: "cardio",
    accent: "zone",
    cardioTarget: {
      min: 40,
      max: 75,
      defaultMinutes: 45,
      bpmMin: 125,
      bpmMax: 138,
    },
    description:
      "A parte do seu treino que já funciona: 600 minutos em 13 semanas, sempre a 130 bpm. Não mude nada além de variar a modalidade — bike, esteira inclinada, elíptico, remo, corda e as caminhadas do Strava contam igual. Ritmo de conversa: se não dá para falar frases inteiras, está rápido demais. Meta semanal somando tudo, inclusive os encerramentos das sessões de força: 180 a 240 min.",
    exercises: [],
  },
  {
    id: "perfIntervals",
    planVersion: PERFORMANCE_PLAN_VERSION,
    title: "Intervalado",
    subtitle: "VO₂ e recuperação entre esforços",
    weekday: 0,
    duration: "~25 min + aquecimento",
    kind: "cardio",
    accent: "gold",
    cardioTarget: {
      min: 20,
      max: 40,
      defaultMinutes: 25,
      bpmMin: 155,
      bpmMax: 175,
    },
    description:
      "Seu ponto mais fraco: 9 min por semana de alta intensidade não constroem motor nenhum, e o teto registrado é 160 bpm por 8 min. Um período de wrestling são 3 min a 170–185. A progressão leva você de 1 min forte até blocos de 2 min em doze semanas. SEMANAS 1–4: 8 tiros de 1 min a 155–165 bpm, 2 min leve entre eles. SEMANAS 5–8: 10 tiros de 1 min a 160–170, com 90 s leve — o intervalo encurta antes de o tiro aumentar. SEMANAS 9–12: 6 tiros de 2 min a 165–175, 2 min leve. Bike, corda, elíptico ou remo; sem corrida nas primeiras semanas, porque 94 kg em impacto repetido é articulação cobrando depois. Aquecimento e volta à calma de 5 min são obrigatórios.",
    exercises: [],
  },
]

/** Todas as sessões da pré-temporada. */
export const PERFORMANCE_SESSION_IDS: SessionId[] = PERFORMANCE_PLAN.map(
  (session) => session.id
)

/**
 * A FILA. Três sessões de sala que rodam em ordem, e só.
 *
 * É o mesmo mecanismo do LIFT_CYCLE da hipertrofia, e deliberadamente NÃO é o
 * do ciclo de motor, que amarra a prescrição à semana do calendário. Aqui a
 * pergunta que o app responde é "qual é a vez?", nunca "em que semana estou?".
 * Faltou uma semana inteira? A fila espera na mesma posição.
 */
export const PERF_CYCLE: SessionId[] = ["perfPower", "perfPull", "perfFull"]

/** Próxima sessão de sala da fila. */
export function nextPerformanceSession(workouts: WorkoutLog[], today: Date): SessionId {
  const todayKey = toDateKey(today)
  const done = workouts
    .filter(
      (workout) => workout.date <= todayKey && PERF_CYCLE.includes(workout.sessionId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const last = done[done.length - 1]
  if (!last) return PERF_CYCLE[0]
  return PERF_CYCLE[(PERF_CYCLE.indexOf(last.sessionId) + 1) % PERF_CYCLE.length]
}

export interface PerformanceTodayView {
  sessionId: SessionId
  nextSessionId: SessionId
  completedSessionId: SessionId | null
  done: boolean
  /** sessão de sala que a fila ainda cobra hoje; null = nada pendente */
  pendingSessionId: SessionId | null
}

/**
 * Estado do card principal na pré-temporada.
 *
 * Sem nada registrado, o card oferece a sessão de sala da vez — é a única que
 * alterna e precisa de ordem. Qualquer treino registrado conta o dia como
 * feito (Zona 2, intervalado, avulso ou esporte), mas a sala continua pendente
 * até que uma das três da fila seja salva.
 */
export function performanceTodayView(
  workouts: WorkoutLog[],
  today: Date
): PerformanceTodayView {
  const todayKey = toDateKey(today)
  const nextSessionId = nextPerformanceSession(workouts, today)
  const todayLogs = [...workouts].reverse().filter((workout) => workout.date === todayKey)
  const prescribed = todayLogs.find((workout) =>
    PERFORMANCE_SESSION_IDS.includes(workout.sessionId)
  )
  const other = todayLogs.find(
    (workout) => workout.sessionId === "free" || workout.sessionId === "sport"
  )
  const completed = prescribed ?? other
  const liftDone = todayLogs.some((workout) => PERF_CYCLE.includes(workout.sessionId))

  return {
    sessionId: completed?.sessionId ?? nextSessionId,
    nextSessionId,
    completedSessionId: completed?.sessionId ?? null,
    done: Boolean(completed),
    pendingSessionId: liftDone ? null : nextSessionId,
  }
}

export function isPerformanceSession(sessionId: SessionId): boolean {
  return PERFORMANCE_SESSION_IDS.includes(sessionId)
}
