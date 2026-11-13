import { cardioBlocks } from "./cardio"
import { CardioLog, ExercisePrescription, SessionId, SessionPlan, WorkoutLog } from "./types"
import { fromDateKey, toDateKey } from "./utils"

/** Início efetivo do ciclo de 5 km (primeiro treino em 06/11 + base registrada). */
export const RUNNING_START_DATE = "2026-11-06"

/** Dia da prova alvo (Corrida Beneficente 5 km · sábado). */
export const RUNNING_RACE_DATE = "2026-11-28"

export const RUNNING_PLAN_VERSION = "running-v1"

export const RUNNING_SHOE_NAME = "Olympikus Corre Max 2"
export const RUNNING_ALT_SHOE_NAME = "Fila Lite Progress"
export const RUNNING_SHOE_OPTIONS = [
  RUNNING_SHOE_NAME,
  RUNNING_ALT_SHOE_NAME,
] as const
export const RUNNING_SHOE_START_DATE = "2026-11-09"
export const RUNNING_SHOE_DETAIL = "neutro · amortecimento máximo (40/32 mm, drop 8 mm)"

/** Dor acima de 3/10 na sola ou canela trava a progressão de estágio. */
export const RUNNING_PAIN_THRESHOLD = 3

/** Segmento fixo no Strava usado para comparar evolução sem comparar semanas cruas. */
export const RUNNING_STRAVA_SEGMENT = {
  name: "Trajeto Prescrito Real",
  distanceKm: 1.64,
  baseTimeSec: 16 * 60 + 28,
} as const

export const RUNNING_BASE_BENCHMARK = {
  date: "2026-11-07",
  label: "Base",
  distanceKm: 4.59,
  durationSec: 43 * 60 + 6,
  paceLabel: "9:24/km",
  segmentTimeSec: RUNNING_STRAVA_SEGMENT.baseTimeSec,
  avgBpm: 143,
} as const

export type RunLadderStageId =
  | "1-2x8"
  | "2-2x6"
  | "2-1x8"
  | "3-1x7"
  | "3-1x8"
  | "4-1x6"
  | "ensaio-5k"
  | "2-1x5-leve"
  | "prova-5k"

export type RunStageId = RunLadderStageId | "walk-sub" | "extra"

export interface RunStage {
  id: RunStageId
  label: string
  shortLabel: string
  runMinutes: number
  walkMinutes: number
  repeats: number
  targetMinutes: number
  ceilingMinutes: number
  transitions: number
  inLadder: boolean
  weekLabel: string
  note: string
}

export const RUN_STAGES: RunStage[] = [
  {
    id: "1-2x8",
    label: "1 / 2 × 8",
    shortLabel: "1/2 × 8",
    runMinutes: 1,
    walkMinutes: 2,
    repeats: 8,
    targetMinutes: 34,
    ceilingMinutes: 45,
    transitions: 8,
    inLadder: true,
    weekLabel: "Semana 1 · Adaptação",
    note: "5 min caminhada antes + 5 min depois já no total; trote leve em ritmo de conversa (~7:30–8:30/km).",
  },
  {
    id: "2-2x6",
    label: "2 / 2 × 6",
    shortLabel: "2/2 × 6",
    runMinutes: 2,
    walkMinutes: 2,
    repeats: 6,
    targetMinutes: 34,
    ceilingMinutes: 45,
    transitions: 6,
    inLadder: true,
    weekLabel: "Semana 1–2 · Base",
    note: "Começa a alongar o bloco de trote para 2 min sem encurtar a recuperação.",
  },
  {
    id: "2-1x8",
    label: "2 / 1 × 8",
    shortLabel: "2/1 × 8",
    runMinutes: 2,
    walkMinutes: 1,
    repeats: 8,
    targetMinutes: 34,
    ceilingMinutes: 45,
    transitions: 8,
    inLadder: true,
    weekLabel: "Semana 2 · Continuidade",
    note: "Reduz a pausa para 1 min; desacelere nos últimos 10–15 s do trote para não frear seco.",
  },
  {
    id: "3-1x7",
    label: "3 / 1 × 7",
    shortLabel: "3/1 × 7",
    runMinutes: 3,
    walkMinutes: 1,
    repeats: 7,
    targetMinutes: 38,
    ceilingMinutes: 45,
    transitions: 7,
    inLadder: true,
    weekLabel: "Semana 2 · Volume",
    note: "Passada curta e perto do corpo; nos primeiros 30 s caminhando dê passos curtos e rápidos.",
  },
  {
    id: "3-1x8",
    label: "3 / 1 × 8",
    shortLabel: "3/1 × 8",
    runMinutes: 3,
    walkMinutes: 1,
    repeats: 8,
    targetMinutes: 42,
    ceilingMinutes: 45,
    transitions: 8,
    inLadder: true,
    weekLabel: "Semana 3 · Consolidação",
    note: "Teto ~45 min com aquecimento e volta à calma; finalize sentindo que faria mais um bloco.",
  },
  {
    id: "4-1x6",
    label: "4 / 1 × 6",
    shortLabel: "4/1 × 6",
    runMinutes: 4,
    walkMinutes: 1,
    repeats: 6,
    targetMinutes: 40,
    ceilingMinutes: 45,
    transitions: 6,
    inLadder: true,
    weekLabel: "Semana 3 · Ritmo de prova",
    note: "Teste do padrão 4/1 que será levado para o ensaio de 5 km.",
  },
  {
    id: "ensaio-5k",
    label: "Ensaio 5 km (4 / 1)",
    shortLabel: "Ensaio 5 km",
    runMinutes: 4,
    walkMinutes: 1,
    repeats: 8,
    targetMinutes: 50,
    ceilingMinutes: 60,
    transitions: 8,
    inLadder: true,
    weekLabel: "Semana 3 · Simulado",
    note: "Completar os 5 km no Açude Velho (~45–55 min) sem forçar sprint e anotar o tempo do segmento.",
  },
  {
    id: "2-1x5-leve",
    label: "2 / 1 × 5 (leve)",
    shortLabel: "2/1 × 5 leve",
    runMinutes: 2,
    walkMinutes: 1,
    repeats: 5,
    targetMinutes: 25,
    ceilingMinutes: 32,
    transitions: 5,
    inLadder: true,
    weekLabel: "Reta final · Polimento",
    note: "Único trote da semana da prova: solto, curto (~25 min) para chegar leve e sem dor.",
  },
  {
    id: "prova-5k",
    label: "Prova 5 km",
    shortLabel: "Prova 5 km",
    runMinutes: 4,
    walkMinutes: 1,
    repeats: 9,
    targetMinutes: 48,
    ceilingMinutes: 70,
    transitions: 9,
    inLadder: true,
    weekLabel: "Sábado 28/11 · Prova",
    note: "Usar exatamente o ritmo e o tênis validados no ensaio; largar controlado nos primeiros 500 m.",
  },
  {
    id: "walk-sub",
    label: "Caminhada proteção (30 min)",
    shortLabel: "Caminhada 30m",
    runMinutes: 0,
    walkMinutes: 30,
    repeats: 1,
    targetMinutes: 30,
    ceilingMinutes: 40,
    transitions: 0,
    inLadder: false,
    weekLabel: "Proteção articular",
    note: "Use quando sola ou canela doer > 3/10 ao caminhar; preserva rotina sem agredir o tecido.",
  },
  {
    id: "extra",
    label: "Corrida livre / fora da escada",
    shortLabel: "Livre",
    runMinutes: 0,
    walkMinutes: 0,
    repeats: 0,
    targetMinutes: 35,
    ceilingMinutes: 45,
    transitions: 0,
    inLadder: false,
    weekLabel: "Sessão fora da escada",
    note: "Registro avulso ou treino encurtado/diferente da prescrição sem avançar degrau sozinho.",
  },
]

export const RUN_LADDER: RunStage[] = RUN_STAGES.filter((stage) => stage.inLadder)

export const RUN_STAGE_BY_ID: Record<RunStageId, RunStage> = Object.fromEntries(
  RUN_STAGES.map((stage) => [stage.id, stage])
) as Record<RunStageId, RunStage>

export const RUNNING_RACE_PROJECTIONS = [
  { scenario: "Otimista", detail: "4 / 1 com trote ~7:45/km", pace: "~8:15/km", estimate: "~41 min" },
  { scenario: "Mais provável", detail: "4 / 1 com trote 8:00–8:30/km", pace: "~8:30–8:55/km", estimate: "42–45 min" },
  { scenario: "Conservador", detail: "1 / 2 completo", pace: "~9:20/km", estimate: "~47 min" },
  { scenario: "Se a sola apertar", detail: "Mais caminhada e passo curto", pace: "~10:30–11:00/km", estimate: "52–55 min" },
] as const

export const RUNNING_TRANSITION_TIPS = [
  "5 min caminhada antes + 5 min depois já incluídos no total",
  "Ritmo de conversa no trote (~7:30–8:30/km), passada curta e perto do corpo",
  "Desacelerar nos últimos 10–15 s antes de voltar a caminhar (sem frear seco)",
  "Primeiros 30–60 s da caminhada com passos curtos e rápidos",
  "Não ultrapassar ~45 min por sessão antes do ensaio (evitar repetições de 80 min)",
] as const

export const RUNNING_PREVENTION_RULES = [
  "Sola ou canela com dor > 3/10 no dia seguinte trava avanço: repetir o estágio confortável",
  "Dor > 3/10 mesmo caminhando → trocar corrida por caminhada leve de 30 min",
  "Sem corridas em dias seguidos (evitar back-to-back); usar dias sem corrida para Rotina B",
  "Rotina A diária (~8 min descalço) até a véspera da prova; na semana final cortar Rotina B",
] as const

export const RUNNING_RACE_DAY_CHECKLIST = [
  "Tênis amaciado (Olympikus Corre Max 2)",
  "5 min caminhada de aquecimento antes da largada",
  "Largar no bloco 4/1 ou no combinado pós-ensaio sem sprint inicial",
  "Parar e caminhar se dor aguda > 4/10 aparecer na sola ou canela",
] as const

export const RUN_EXERCISES_A: ExercisePrescription[] = [
  {
    id: "foot-short",
    name: "Pé curto (arco plantar)",
    nameEn: "Short Foot",
    sets: 3,
    repsMin: 10,
    repsMax: 10,
    unit: "reps",
    rest: "30 s",
    note: "Descalço, tente encurtar o pé erguendo o arco sem dobrar os dedos; segure 5 s cada rep.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "foot-toe-yoga",
    name: "Ioga dos dedos",
    nameEn: "Toe Yoga",
    sets: 3,
    repsMin: 10,
    repsMax: 10,
    unit: "reps",
    rest: "20 s",
    note: "Eleve apenas o dedão com os outros 4 dedos no chão; depois inverta.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "foot-towel-curl",
    name: "Puxar a toalha",
    nameEn: "Towel Curls",
    sets: 3,
    repsMin: 1,
    repsMax: 1,
    unit: "reps",
    rest: "30 s",
    note: "Sentado descalço, puxe uma toalha estendida até você usando só os dedos (1 toalha por série).",
    muscleGroup: "Panturrilha",
  },
  {
    id: "foot-single-balance",
    name: "Equilíbrio num pé só",
    nameEn: "Single-Leg Balance",
    sets: 3,
    repsMin: 30,
    repsMax: 30,
    unit: "seconds",
    rest: "30 s",
    note: "30 s por pé descalço mantendo o arco firme; dificulte fechando os olhos.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "foot-plantar-stretch",
    name: "Alongamento da sola",
    nameEn: "Plantar Fascia Stretch",
    sets: 10,
    repsMin: 10,
    repsMax: 10,
    unit: "seconds",
    rest: "10 s",
    note: "Sentado com pé sobre a coxa oposta, puxe os dedos para trás e segure 10 s.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "foot-calf-stretch",
    name: "Alongamento de panturrilha na parede",
    nameEn: "Wall Calf Stretch",
    sets: 3,
    repsMin: 30,
    repsMax: 30,
    unit: "seconds",
    rest: "20 s",
    note: "30 s com joelho estendido + 30 s com joelho dobrado, calcanhar sempre colado.",
    muscleGroup: "Panturrilha",
  },
]

export const RUN_EXERCISES_B: ExercisePrescription[] = [
  {
    id: "run-calf-towel",
    name: "Panturrilha com toalha sob os dedos",
    nameEn: "Towel-Toe Calf Raise",
    sets: 3,
    repsMin: 12,
    repsMax: 12,
    unit: "reps",
    rest: "60 s",
    note: "Toalha enrolada sob os dedos (ativa arco); suba controlado e desça devagar (3 s).",
    muscleGroup: "Panturrilha",
  },
  {
    id: "run-calf-ball",
    name: "Panturrilha com bola entre os calcanhares",
    nameEn: "Ball-Squeeze Calf Raise",
    sets: 3,
    repsMin: 15,
    repsMax: 15,
    unit: "reps",
    rest: "60 s",
    note: "Aperte uma bola ou meia enrolada entre os calcanhares o tempo todo.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "run-calf-bent",
    name: "Panturrilha com joelho dobrado",
    nameEn: "Bent-Knee Soleus Raise",
    sets: 3,
    repsMin: 15,
    repsMax: 15,
    unit: "reps",
    rest: "60 s",
    note: "Joelhos dobrados ~30° focando o sóleo; protege canela e tendão de Aquiles.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "run-tibial-wall",
    name: "Tibial na parede",
    nameEn: "Wall Tibialis Raise",
    sets: 3,
    repsMin: 20,
    repsMax: 20,
    unit: "reps",
    rest: "45 s",
    note: "Costas na parede, pés um passo à frente; puxe a ponta dos pés para cima devagar.",
    muscleGroup: "Panturrilha",
  },
  {
    id: "wall-sit-iso",
    name: "Agachamento isométrico",
    nameEn: "Wall Sit Hold",
    sets: 4,
    repsMin: 45,
    repsMax: 45,
    unit: "seconds",
    rest: "60 s",
    note: "Costas na parede a ~90°; resistência de quadríceps sem impacto articular.",
    muscleGroup: "Quadríceps",
  },
  {
    id: "side-hip-abduction",
    name: "Abdução de quadril",
    nameEn: "Side-Lying Hip Abduction",
    sets: 3,
    repsMin: 15,
    repsMax: 15,
    unit: "reps",
    rest: "45 s",
    note: "Deitado de lado, calcanhar alinhado ao tronco e ponta do pé neutra.",
    muscleGroup: "Posterior/Glúteo",
  },
  {
    id: "band-foot-inversion",
    name: "Inversão com elástico (opcional)",
    nameEn: "Banded Foot Inversion",
    sets: 3,
    repsMin: 15,
    repsMax: 15,
    unit: "reps",
    rest: "45 s",
    note: "Resistência lateral com faixa elástica; gire a ponta do pé para dentro com controle.",
    muscleGroup: "Panturrilha",
  },
]

export const RUNNING_PLAN: SessionPlan[] = [
  {
    id: "runSession",
    title: "Corrida · Plano 5 km",
    subtitle: "Trote / caminhada adaptativa + importação Strava",
    weekday: 1,
    duration: "30–45 min",
    kind: "cardio",
    accent: "zone",
    exercises: [],
    cardioTarget: { min: 25, max: 45, defaultMinutes: 35, bpmMin: 135, bpmMax: 158 },
    description:
      "Sessão adaptativa do plano de 5 km: escolha ou confirme o estágio da escada, registre a dor pós-treino (0–10) e mantenha o teto até o ensaio.",
    planVersion: RUNNING_PLAN_VERSION,
  },
  {
    id: "runFootA",
    title: "Rotina A · Pé & Arco",
    subtitle: "Todo dia descalço · ~8 min · sola, dedos e panturrilha",
    weekday: 2,
    duration: "~8 min",
    kind: "lift",
    accent: "ember",
    exercises: RUN_EXERCISES_A,
    description:
      "Checklist diário de mobilidade e ativação plantar descalço. Pode ser registrada no mesmo dia da corrida ou da Rotina B.",
    planVersion: RUNNING_PLAN_VERSION,
  },
  {
    id: "runStrengthB",
    title: "Rotina B · Força Pé/Canela",
    subtitle: "Dias sem corrida · ~15 min · panturrilha, tibial e quadril",
    weekday: 4,
    duration: "~15 min",
    kind: "lift",
    accent: "steel",
    exercises: RUN_EXERCISES_B,
    description:
      "Fortalecimento específico para absorção de impacto nos 5 km. Reduza para 2 séries leves na semana da prova e suspenda a partir de 24/11.",
    planVersion: RUNNING_PLAN_VERSION,
  },
]

export const RUNNING_SESSION_IDS: SessionId[] = RUNNING_PLAN.map((session) => session.id)

/**
 * Reconhece logs que contam como corrida/atividade do plano 5 km:
 * - `runSession` sempre;
 * - `strava` a partir de 2026-11-07 (compatibilidade retroativa com as importações
 *   feitas antes da criação do programa dedicado).
 */
export function isRunningActivityLog(workout: WorkoutLog): boolean {
  if (workout.sessionId === "runSession") return true
  return workout.sessionId === "strava" && workout.date >= RUNNING_START_DATE
}

function runningCardioBlocks(workout: WorkoutLog): CardioLog[] {
  return cardioBlocks(workout)
}

export function runDurationMinutes(workout: WorkoutLog): number {
  const fromBlocks = runningCardioBlocks(workout).reduce((sum, block) => {
    if (block.durationSeconds && block.durationSeconds > 0) {
      return sum + block.durationSeconds / 60
    }
    return sum + (block.minutes ?? 0)
  }, 0)
  if (fromBlocks > 0) return Math.round(fromBlocks)
  return workout.durationMin ?? 0
}

export function runDurationSeconds(workout: WorkoutLog): number {
  const fromBlocks = runningCardioBlocks(workout).reduce((sum, block) => {
    if (block.durationSeconds && block.durationSeconds > 0) return sum + block.durationSeconds
    return sum + Math.round((block.minutes ?? 0) * 60)
  }, 0)
  if (fromBlocks > 0) return fromBlocks
  return Math.round((workout.durationMin ?? 0) * 60)
}

export function runDistanceKm(workout: WorkoutLog): number {
  return Number(
    runningCardioBlocks(workout)
      .reduce((sum, block) => sum + (block.distanceKm ?? 0), 0)
      .toFixed(2)
  )
}

export function runPainScore(workout: WorkoutLog): number | undefined {
  let highest: number | undefined
  for (const block of runningCardioBlocks(workout)) {
    if (typeof block.painScore === "number" && Number.isFinite(block.painScore)) {
      highest = highest === undefined ? block.painScore : Math.max(highest, block.painScore)
    }
  }
  return highest
}

export function runExplicitStageId(workout: WorkoutLog): RunStageId | undefined {
  for (const block of runningCardioBlocks(workout)) {
    if (block.runStageId && block.runStageId in RUN_STAGE_BY_ID) {
      return block.runStageId as RunStageId
    }
  }
  return undefined
}

export function runExplicitShoe(workout: WorkoutLog): string | undefined {
  for (const block of runningCardioBlocks(workout)) {
    if (block.shoe && block.shoe.trim()) {
      return block.shoe.trim()
    }
  }
  return undefined
}

export function formatPace(durationSec: number, distanceKm: number): string | null {
  if (durationSec <= 0 || distanceKm <= 0) return null
  const secPerKm = Math.round(durationSec / distanceKm)
  const mins = Math.floor(secPerKm / 60)
  const secs = secPerKm % 60
  return `${mins}:${String(secs).padStart(2, "0")}/km`
}

export function formatDurationClock(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00"
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.round(totalSeconds % 60)
  return `${mins}:${String(secs).padStart(2, "0")}`
}

export function isOverVolumeCeiling(stageId: RunStageId, durationMin: number): boolean {
  const stage = RUN_STAGE_BY_ID[stageId]
  return durationMin > stage.ceilingMinutes
}

export interface StrengthBPhaseGuidance {
  id: "adapt" | "build" | "unilateral" | "taper-light" | "rest-only-a"
  label: string
  setsAdvice: string
  recommended: boolean
  note: string
}

/**
 * Orientação de volume da Rotina B por proximidade da prova (28/11/2026),
 * sem bloquear caso o usuário decida treinar fora do dia previsto.
 */
export function strengthBPhaseFor(today = new Date()): StrengthBPhaseGuidance {
  const key = toDateKey(today)
  if (key >= "2026-11-24") {
    return {
      id: "rest-only-a",
      label: "Semana da prova · só Rotina A",
      setsAdvice: "Sem Rotina B (poupar panturrilha/sóleo)",
      recommended: false,
      note: "De 24/11 até a prova, manter apenas a Rotina A diária descalço (~8 min).",
    }
  }
  if (key === "2026-11-23") {
    return {
      id: "taper-light",
      label: "Polimento · 2 séries leves",
      setsAdvice: "2 séries leves, sem carga",
      recommended: true,
      note: "Última Rotina B antes da prova: apenas estimular circulação sem fadigar.",
    }
  }
  if (key >= "2026-11-21") {
    return {
      id: "unilateral",
      label: "Semana 3 · foco unilateral leve",
      setsAdvice: "2–3 séries controladas (isometria 4×45 s)",
      recommended: true,
      note: "Consolidar estabilidade para o ensaio e a prova; parar se panturrilha pesar.",
    }
  }
  if (key >= "2026-11-12") {
    return {
      id: "build",
      label: "Fase principal · 3 séries completas",
      setsAdvice: "3 séries completas · isometria 4×45 s",
      recommended: true,
      note: "Volume completo em dias sem corrida; pare se a panturrilha travar antes da próxima sessão.",
    }
  }
  return {
    id: "adapt",
    label: "Semana 1 · 2 séries",
    setsAdvice: "2 séries · isometria 3×30 s",
    recommended: true,
    note: "Entrada gradual para não sobrecarregar a panturrilha junto com as primeiras corridas.",
  }
}

export function runningShoeCount(workouts: WorkoutLog[], upToDate = toDateKey(new Date())): number {
  return workouts.filter((workout) => {
    if (!isRunningActivityLog(workout)) return false
    if (workout.date > upToDate) return false
    const hasExplicitCorreMax = runningCardioBlocks(workout).some(
      (block) => block.shoe === RUNNING_SHOE_NAME
    )
    if (hasExplicitCorreMax) return true
    const hasDifferentExplicitShoe = runningCardioBlocks(workout).some(
      (block) => Boolean(block.shoe) && block.shoe !== RUNNING_SHOE_NAME
    )
    return !hasDifferentExplicitShoe && workout.date >= RUNNING_SHOE_START_DATE
  }).length
}

export interface RunHistorySnapshot {
  workoutId: string
  date: string
  durationMin: number
  durationSec: number
  distanceKm: number
  stageId: RunStageId
  painScore?: number
  overCeiling: boolean
  segmentTimeSec?: number
  paceLabel: string | null
  best5kSec?: number
}

export interface RunningTodayView {
  todayKey: string
  daysUntilRace: number
  nextStage: RunStage
  completedStageIds: RunStageId[]
  runDoneToday: boolean
  footADoneToday: boolean
  strengthBDoneToday: boolean
  restDayRecommended: boolean
  repeatReason: "pain" | "walk-sub" | "over-ceiling" | null
  taperActive: boolean
  pendingPainCheckIn: boolean
  lastRun: RunHistorySnapshot | null
  shoeName: string
  shoeSessions: number
  strengthBGuidance: StrengthBPhaseGuidance
  totalRuns: number
  totalDistanceKm: number
  benchmarks: {
    base: typeof RUNNING_BASE_BENCHMARK
    rehearsal: RunHistorySnapshot | null
    race: RunHistorySnapshot | null
    best5kFromGpx: {
      date: string
      durationSec: number
      paceLabel: string | null
    } | null
  }
}

function daysBetweenDateKeys(fromKey: string, toKeyValue: string): number {
  const from = fromDateKey(fromKey)
  const to = fromDateKey(toKeyValue)
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function shiftDateKey(key: string, deltaDays: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + deltaDays)
  return toDateKey(d)
}

function advanceIndexForStage(stageId: RunStageId): number | null {
  if (!RUN_STAGE_BY_ID[stageId].inLadder) return null
  const idx = RUN_LADDER.findIndex((s) => s.id === stageId)
  return idx >= 0 ? idx : null
}

export function runningTodayView(
  workouts: WorkoutLog[],
  today = new Date()
): RunningTodayView {
  const todayKey = toDateKey(today)
  const yesterdayKey = shiftDateKey(todayKey, -1)

  const runLogs = workouts
    .filter((workout) => isRunningActivityLog(workout) && workout.date <= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  let ladderIndex = 0
  let repeatReason: "pain" | "walk-sub" | "over-ceiling" | null = null
  const completedSet = new Set<RunStageId>()
  const snapshots: RunHistorySnapshot[] = []

  for (const workout of runLogs) {
    const durationMin = runDurationMinutes(workout)
    const durationSec = runDurationSeconds(workout)
    const distanceKm = runDistanceKm(workout)
    const painScore = runPainScore(workout)
    const explicitStage = runExplicitStageId(workout)
    const blocks = runningCardioBlocks(workout)
    const segmentTimeSec = blocks.find(
      (b) => typeof b.segmentTimeSec === "number" && b.segmentTimeSec > 0
    )?.segmentTimeSec
    const best5kCandidates = blocks
      .map((b) => b.gpx?.bestWindowsSec?.km5)
      .filter((v): v is number => typeof v === "number" && v > 0)
    const best5kSec =
      best5kCandidates.length > 0 ? Math.min(...best5kCandidates) : undefined

    let effectiveStageId: RunStageId
    if (explicitStage) {
      effectiveStageId = explicitStage
    } else if (workout.date === RUNNING_RACE_DATE) {
      effectiveStageId = "prova-5k"
    } else if (durationMin > 0 && durationMin < 20) {
      effectiveStageId = "extra"
    } else {
      effectiveStageId = RUN_LADDER[ladderIndex].id
    }

    const overCeiling = isOverVolumeCeiling(effectiveStageId, durationMin)
    if (RUN_STAGE_BY_ID[effectiveStageId].inLadder) {
      completedSet.add(effectiveStageId)
    }

    snapshots.push({
      workoutId: workout.id,
      date: workout.date,
      durationMin,
      durationSec,
      distanceKm,
      stageId: effectiveStageId,
      painScore,
      overCeiling,
      segmentTimeSec,
      paceLabel: formatPace(durationSec, distanceKm),
      ...(best5kSec ? { best5kSec } : {}),
    })

    if (painScore !== undefined && painScore > RUNNING_PAIN_THRESHOLD) {
      repeatReason = "pain"
      const idx = advanceIndexForStage(effectiveStageId)
      if (idx !== null) ladderIndex = idx
      continue
    }

    if (effectiveStageId === "walk-sub") {
      repeatReason = "walk-sub"
      continue
    }

    if (effectiveStageId === "extra") {
      continue
    }

    if (overCeiling) {
      repeatReason = "over-ceiling"
      const idx = advanceIndexForStage(effectiveStageId)
      if (idx !== null) ladderIndex = idx
      continue
    }

    repeatReason = null
    const idx = advanceIndexForStage(effectiveStageId)
    if (idx !== null) {
      ladderIndex = Math.min(idx + 1, RUN_LADDER.length - 1)
    }
  }

  let nextStage = RUN_LADDER[ladderIndex]
  let taperActive = false

  if (todayKey === RUNNING_RACE_DATE) {
    nextStage = RUN_STAGE_BY_ID["prova-5k"]
    taperActive = true
  } else if (todayKey >= "2026-11-25" && todayKey < RUNNING_RACE_DATE) {
    const leveIdx = RUN_LADDER.findIndex((s) => s.id === "2-1x5-leve")
    if (ladderIndex <= leveIdx) {
      nextStage = RUN_STAGE_BY_ID["2-1x5-leve"]
      taperActive = true
    }
  }

  const todayLogs = workouts.filter((w) => w.date === todayKey)
  const runDoneToday = todayLogs.some((w) => isRunningActivityLog(w))
  const footADoneToday = todayLogs.some((w) => w.sessionId === "runFootA")
  const strengthBDoneToday = todayLogs.some((w) => w.sessionId === "runStrengthB")

  const ranYesterday = runLogs.some((w) => w.date === yesterdayKey)
  const restDayRecommended = ranYesterday && !runDoneToday

  const lastRun = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const pendingPainCheckIn = Boolean(lastRun && lastRun.painScore === undefined)

  const rehearsal =
    snapshots.find((s) => s.stageId === "ensaio-5k") ??
    snapshots.find((s) => s.date >= "2026-11-18" && s.date < RUNNING_RACE_DATE && s.distanceKm >= 4.7) ??
    null

  const race =
    snapshots.find((s) => s.stageId === "prova-5k") ??
    snapshots.find((s) => s.date === RUNNING_RACE_DATE) ??
    null

  const gpx5kRuns = snapshots.filter((s) => s.best5kSec !== undefined)
  const fastestGpx5k =
    gpx5kRuns.length > 0
      ? [...gpx5kRuns].sort((a, b) => (a.best5kSec ?? Infinity) - (b.best5kSec ?? Infinity))[0]
      : null
  const best5kFromGpx =
    fastestGpx5k?.best5kSec !== undefined
      ? {
          date: fastestGpx5k.date,
          durationSec: fastestGpx5k.best5kSec,
          paceLabel: formatPace(fastestGpx5k.best5kSec, 5),
        }
      : null

  const totalDistanceKm = Number(
    snapshots.reduce((sum, s) => sum + s.distanceKm, 0).toFixed(2)
  )

  return {
    todayKey,
    daysUntilRace: daysBetweenDateKeys(todayKey, RUNNING_RACE_DATE),
    nextStage,
    completedStageIds: Array.from(completedSet),
    runDoneToday,
    footADoneToday,
    strengthBDoneToday,
    restDayRecommended,
    repeatReason,
    taperActive,
    pendingPainCheckIn,
    lastRun,
    shoeName: RUNNING_SHOE_NAME,
    shoeSessions: runningShoeCount(workouts, todayKey),
    strengthBGuidance: strengthBPhaseFor(today),
    totalRuns: snapshots.length,
    totalDistanceKm,
    benchmarks: {
      base: RUNNING_BASE_BENCHMARK,
      rehearsal,
      race,
      best5kFromGpx,
    },
  }
}

export interface RunningWeeklyVolumeDatum {
  weekStart: string
  label: string
  distanceKm: number
  minutes: number
  runs: number
  current: boolean
}

export interface RunningSessionPoint {
  workoutId: string
  date: string
  label: string
  title: string
  distanceKm: number
  minutes: number
  durationSec: number
  avgPaceSecPerKm: number | null
  best1kSecPerKm: number | null
  best5kSec: number | null
  best5kPaceSecPerKm: number | null
  segmentPaceSecPerKm: number | null
  walkMinutes: number
  controlledTroteMinutes: number
  fastTroteMinutes: number
  hasGpx: boolean
  painScore: number | null
  shoe: string | null
  overCeiling: boolean
  stageLabel: string
}

export interface RunningLatestSplits {
  date: string
  label: string
  title: string
  distanceKm: number
  avgSecPerKm: number
  fastestKm: number
  splitTrend?: "negative" | "positive" | "even"
  splits: {
    km: number
    label: string
    secPerKm: number
    distanceKm: number
    elevationDeltaM?: number
    isFastest: boolean
  }[]
}

export interface RunningChartsBundle {
  weeklyVolume: RunningWeeklyVolumeDatum[]
  sessions: RunningSessionPoint[]
  latestGpxSplits: RunningLatestSplits | null
}

function mondayOfDateKey(key: string): Date {
  const d = fromDateKey(key)
  const day = (d.getDay() + 6) % 7 // 0 = seg .. 6 = dom
  d.setDate(d.getDate() - day)
  return d
}

function shortDayMonth(key: string): string {
  const [, month, day] = key.split("-")
  return `${day}/${month}`
}

/**
 * Monta as séries analíticas específicas do programa Corrida 5 km a partir
 * dos registros já salvos (distância, duração, dor pós-treino, tênis e GPX).
 */
export function runningChartData(
  workouts: WorkoutLog[],
  today = new Date(),
  weeksCount = 6
): RunningChartsBundle {
  const todayKey = toDateKey(today)
  const runLogs = workouts
    .filter((w) => isRunningActivityLog(w) && w.date <= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Semanas calendário (seg–dom) até a semana de `today`
  const currentMonday = mondayOfDateKey(todayKey)
  const currentMondayKey = toDateKey(currentMonday)
  const weekMap = new Map<string, RunningWeeklyVolumeDatum>()
  const weeklyVolume: RunningWeeklyVolumeDatum[] = []
  for (let i = weeksCount - 1; i >= 0; i--) {
    const start = new Date(currentMonday)
    start.setDate(start.getDate() - i * 7)
    const weekStart = toDateKey(start)
    const datum: RunningWeeklyVolumeDatum = {
      weekStart,
      label: shortDayMonth(weekStart),
      distanceKm: 0,
      minutes: 0,
      runs: 0,
      current: weekStart === currentMondayKey,
    }
    weekMap.set(weekStart, datum)
    weeklyVolume.push(datum)
  }

  const sessions: RunningSessionPoint[] = []
  let latestGpxSplits: RunningLatestSplits | null = null

  for (const workout of runLogs) {
    const blocks = runningCardioBlocks(workout)
    const distanceKm = runDistanceKm(workout)
    const durationSec = runDurationSeconds(workout)
    const minutes = runDurationMinutes(workout)
    const painScore = runPainScore(workout) ?? null
    const explicitStage = runExplicitStageId(workout)
    const stageLabel = explicitStage ? RUN_STAGE_BY_ID[explicitStage].shortLabel : "Corrida"
    const gpxBlock = blocks.find((b) => Boolean(b.gpx))
    const gpx = gpxBlock?.gpx
    const segmentSec = blocks.find(
      (b) => typeof b.segmentTimeSec === "number" && b.segmentTimeSec > 0
    )?.segmentTimeSec

    const weekKey = toDateKey(mondayOfDateKey(workout.date))
    const weekBucket = weekMap.get(weekKey)
    if (weekBucket) {
      weekBucket.distanceKm = Number((weekBucket.distanceKm + distanceKm).toFixed(2))
      weekBucket.minutes += minutes
      weekBucket.runs += 1
    }

    const avgPaceSecPerKm =
      distanceKm > 0 && durationSec > 0 ? Math.round(durationSec / distanceKm) : null
    const best1kSecPerKm = gpx?.bestWindowsSec?.km1 ?? null
    const best5kSec = gpx?.bestWindowsSec?.km5 ?? null
    const best5kPaceSecPerKm = best5kSec ? Math.round(best5kSec / 5) : null
    const segmentPaceSecPerKm = segmentSec
      ? Math.round(segmentSec / RUNNING_STRAVA_SEGMENT.distanceKm)
      : null

    const rw = gpx?.runWalk
    const walkMinutes = rw ? rw.walkMinutes : 0
    const fastTroteMinutes = rw ? rw.fastTroteMinutes : 0
    const controlledTroteMinutes = rw ? Math.max(0, rw.troteMinutes - rw.fastTroteMinutes) : 0

    const shoe =
      runExplicitShoe(workout) ??
      (workout.date >= RUNNING_SHOE_START_DATE ? RUNNING_SHOE_NAME : null)

    const overCeiling = explicitStage
      ? isOverVolumeCeiling(explicitStage, minutes)
      : minutes > 45 && workout.date < RUNNING_RACE_DATE

    const title =
      blocks.find((b) => b.title?.trim())?.title?.trim() ??
      (distanceKm > 0 ? `Corrida ${distanceKm.toLocaleString("pt-BR")} km` : stageLabel)

    sessions.push({
      workoutId: workout.id,
      date: workout.date,
      label: shortDayMonth(workout.date),
      title,
      distanceKm,
      minutes,
      durationSec,
      avgPaceSecPerKm,
      best1kSecPerKm,
      best5kSec,
      best5kPaceSecPerKm,
      segmentPaceSecPerKm,
      walkMinutes,
      controlledTroteMinutes,
      fastTroteMinutes,
      hasGpx: Boolean(gpx),
      painScore,
      shoe,
      overCeiling,
      stageLabel,
    })

    if (gpx && gpx.splits.length > 0) {
      const fullSplits = gpx.splits.filter((s) => s.distanceKm >= 0.85)
      const pacePool = fullSplits.length > 0 ? fullSplits : gpx.splits
      const fastestSec = Math.min(...pacePool.map((s) => s.secPerKm))
      const fastestKm = pacePool.find((s) => s.secPerKm === fastestSec)?.km ?? gpx.splits[0].km
      const avgSecPerKm =
        avgPaceSecPerKm ??
        Math.round(gpx.splits.reduce((sum, s) => sum + s.secPerKm, 0) / gpx.splits.length)

      latestGpxSplits = {
        date: workout.date,
        label: shortDayMonth(workout.date),
        title,
        distanceKm,
        avgSecPerKm,
        fastestKm,
        splitTrend: gpx.splitTrend,
        splits: gpx.splits.map((s) => ({
          km: s.km,
          label: s.distanceKm >= 0.98 ? `km ${s.km}` : `${s.label} km`,
          secPerKm: s.secPerKm,
          distanceKm: s.distanceKm,
          ...(s.elevationDeltaM !== undefined ? { elevationDeltaM: s.elevationDeltaM } : {}),
          isFastest: s.km === fastestKm,
        })),
      }
    }
  }

  return {
    weeklyVolume,
    sessions,
    latestGpxSplits,
  }
}
