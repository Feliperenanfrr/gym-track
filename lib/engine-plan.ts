import { SessionId, SessionPlan, WorkoutLog } from "./types"
import { fromDateKey, toDateKey } from "./utils"

/** Primeiro dia do ciclo de motor aeróbico e déficit. */
export const ENGINE_START_DATE = "2026-08-31"

/** Duração planejada do ciclo, em semanas (3 blocos de 4). */
export const ENGINE_CYCLE_WEEKS = 12

/**
 * Versão da prescrição. Trocar esta string descarta templates materializados
 * do plano anterior (cache e Supabase) em favor do default novo.
 */
export const ENGINE_PLAN_VERSION = "motor-v1"

/**
 * Motor aeróbico e déficit — ciclo de 12 semanas.
 *
 * Substitui o bloco de jiu-jitsu como objetivo principal: capacidade
 * cardiorrespiratória (VO₂máx) e perda de gordura. A hierarquia inverte —
 * o cardio deixa de ser suporte e vira o programa; a musculação cai para
 * duas sessões de corpo inteiro cuja função é impedir que o déficit coma
 * massa magra e derrube o metabolismo de repouso.
 *
 * Tudo roda em academia comum (esteira, bike, elíptico, remo, polia e
 * máquinas), com uma sessão de casa para o dia em que a academia não
 * acontece.
 */
export const ENGINE_PLAN: SessionPlan[] = [
  {
    id: "engineForceA",
    planVersion: ENGINE_PLAN_VERSION,
    title: "Força A · Corpo inteiro",
    subtitle: "Empurrar e quadríceps",
    weekday: 0,
    duration: "~45 min + 15 min Z2",
    kind: "lift",
    accent: "ember",
    cardioAfter: { minutes: 15, label: "Zona 2 na bike — FC 122–138" },
    description:
      "Não é hipertrofia, é seguro. Duas sessões por semana bastam para preservar massa magra e força durante o déficit — a meta de cada exercício é repetir a carga da semana passada, não bater recorde. RIR 1–2 sempre, 45 minutos cronometrados.",
    exercises: [
      {
        id: "legpress",
        name: "Leg press 45°",
        nameEn: "Leg Press",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 1–2 · iniciar 100–120 kg. Amplitude completa sem tirar a lombar do encosto. Máquina primeiro porque é o jeito mais seguro de carregar perna com fadiga de cardio acumulada.",
      },
      {
        id: "bench",
        name: "Supino reto com barra",
        nameEn: "Barbell Bench Press",
        muscleGroup: "Peito",
        sets: 3,
        repsMin: 6,
        repsMax: 8,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 1–2 · iniciar 60–65 kg (fez 60 × 8 com RIR 1 em 23/08). Escápulas retraídas, barra no meio do peito, sem quicar. Chest press na máquina serve igual.",
      },
      {
        id: "pulldown",
        name: "Puxada alta na máquina",
        nameEn: "Lat Pulldown",
        muscleGroup: "Costas",
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        unit: "reps",
        rest: "75 s",
        note:
          "RIR 1–2 · iniciar 50–55 kg. Pegada pronada pouco mais aberta que os ombros, barra até o peito alto, sem jogar o tronco para trás.",
      },
      {
        id: "machine-shoulder-press",
        name: "Desenvolvimento na máquina",
        nameEn: "Machine Shoulder Press",
        muscleGroup: "Ombro",
        sets: 2,
        repsMin: 10,
        repsMax: 12,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 2 · iniciar 25–30 kg. Ombro é seu elo fraco histórico; duas séries bastam para não deixar cair. Halteres servem igual.",
      },
      {
        id: "legcurl",
        name: "Mesa flexora",
        nameEn: "Lying Leg Curl",
        muscleGroup: "Posterior/Glúteo",
        sets: 2,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 1 · iniciar 32–36 kg, pausa de 1 s no pico. Posterior de coxa protege o joelho, que vai receber muito volume de esteira inclinada.",
      },
      {
        id: "machine-crunch",
        name: "Abdominal na máquina ou polia",
        nameEn: "Machine / Cable Crunch",
        muscleGroup: "Core",
        sets: 2,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "45 s",
        note: "RIR 1 · iniciar 36–41 kg. Enrole o tronco com o quadril fixo. Fecha a sessão.",
      },
    ],
  },
  {
    id: "engineForceB",
    planVersion: ENGINE_PLAN_VERSION,
    title: "Força B · Corpo inteiro",
    subtitle: "Puxar e cadeia posterior",
    weekday: 0,
    duration: "~45 min + 15 min Z2",
    kind: "lift",
    accent: "ember",
    cardioAfter: { minutes: 15, label: "Zona 2 na bike — FC 122–138" },
    description:
      "A sessão que recupera o que caiu por ausência: agachamento −25,6% e extensora −41,7% no último ciclo, sem nenhum déficit envolvido. Progrida só quando fechar o topo da faixa em todas as séries com RIR 2 — em déficit isso é lento, e é o esperado.",
    exercises: [
      {
        id: "rdl",
        name: "Terra romeno (RDL)",
        nameEn: "Romanian Deadlift",
        muscleGroup: "Posterior/Glúteo",
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 2 · iniciar 50–60 kg. Quadril para trás, joelho pouco flexionado, barra rente à perna, excêntrico em 3 s. Pare quando a lombar começar a arredondar.",
      },
      {
        id: "chestrow",
        name: "Remada cavalinho ou serrote",
        nameEn: "Chest-Supported / One-Arm Row",
        muscleGroup: "Costas",
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        unit: "reps",
        rest: "90 s",
        note:
          "RIR 1–2 · iniciar 36–42 kg. Tronco firme, sem roubo. Costas foi o grupo mais consistente do último ciclo — só manter.",
      },
      {
        id: "squat",
        name: "Agachamento livre",
        nameEn: "Back Squat",
        muscleGroup: "Quadríceps",
        sets: 3,
        repsMin: 6,
        repsMax: 8,
        unit: "reps",
        rest: "2 min",
        note:
          "RIR 2 firme · iniciar 60–70 kg. Você vem do powerlifting: técnica não é o problema, dose é. Perna pesada do cardio? Troque pelo hack sem culpa.",
      },
      {
        id: "crossover",
        name: "Crossover ou crucifixo máquina",
        nameEn: "Cable Crossover / Pec Deck",
        muscleGroup: "Peito",
        sets: 2,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 1 · iniciar 50–60 kg. Alonga bem o peitoral — é o exercício que mais progrediu no seu histórico (+5,4%).",
      },
      {
        id: "legext",
        name: "Cadeira extensora",
        nameEn: "Leg Extension",
        muscleGroup: "Quadríceps",
        sets: 2,
        repsMin: 12,
        repsMax: 15,
        unit: "reps",
        rest: "60 s",
        note:
          "RIR 1 · iniciar 45–55 kg, segure 1 s no topo. Foi o que mais caiu no último ciclo (−41,7%); recuperar isso é meta declarada.",
      },
      {
        id: "facepull",
        name: "Face pull ou crucifixo inverso",
        nameEn: "Face Pull / Reverse Fly",
        muscleGroup: "Ombro",
        sets: 2,
        repsMin: 15,
        repsMax: 20,
        unit: "reps",
        rest: "45 s",
        note:
          "RIR 1 · iniciar 40–50 kg. Saúde de ombro e deltoide posterior — barato, e evita que a postura piore com o volume de esteira.",
      },
    ],
  },
  {
    id: "engineMotor",
    planVersion: ENGINE_PLAN_VERSION,
    title: "Motor 4×4",
    subtitle: "A sessão que sobe o VO₂máx",
    weekday: 0,
    duration: "~43 min",
    kind: "cardio",
    accent: "ember",
    cardioTarget: {
      min: 30,
      max: 50,
      defaultMinutes: 43,
      bpmMin: 153,
      bpmMax: 166,
    },
    description:
      "10 min de aquecimento em Z2 · 4 blocos de 4 min em Z4 (153–166 bpm, RPE 8–9) separados por 3 min leves · 5 min de volta à calma. Esteira 5,5–6,0 km/h com 8–10% de inclinação, ou bike com carga alta a 70–80 rpm. O bloco 1 parece fácil, o 4 é o limite do que dá para terminar — se o 4 foi confortável, faltou intensidade. Ajuste sempre pela inclinação ou pela carga, nunca correndo.",
    exercises: [],
  },
  {
    id: "engineIntervals",
    planVersion: ENGINE_PLAN_VERSION,
    title: "Intervalado 30/30",
    subtitle: "O HIIT que cabe em dia ruim",
    weekday: 0,
    duration: "~30 min",
    kind: "cardio",
    accent: "ember",
    cardioTarget: {
      min: 25,
      max: 40,
      defaultMinutes: 30,
      bpmMin: 140,
      bpmMax: 155,
    },
    description:
      "8 min de aquecimento · 2 séries de 10 a 12 repetições de 30 s forte (RPE 8) / 30 s leve, com 3 min entre as séries · 5 min de volta à calma. Nos 30 s a FC não estabiliza: aqui o RPE manda, não o relógio. O alvo dos 30 s é forte mas repetível 24 vezes, não máximo.",
    exercises: [],
  },
  {
    id: "engineZ2",
    planVersion: ENGINE_PLAN_VERSION,
    title: "Zona 2 longa",
    subtitle: "O volume que decide o emagrecimento",
    weekday: 0,
    duration: "35–60 min",
    kind: "cardio",
    accent: "zone",
    cardioTarget: {
      min: 30,
      max: 60,
      defaultMinutes: 45,
      bpmMin: 122,
      bpmMax: 138,
    },
    description:
      "122–138 bpm, RPE 4–5, frases completas e respiração pelo nariz possível. Vai parecer fácil demais — é o ponto: Z2 rápido demais vira Z3, cansa o dobro e entrega metade. Esteira a 5,0–5,5 km/h com 4–5% na maioria das sessões; bike ou elíptico nos dias que cercam a musculação.",
    exercises: [],
  },
  {
    id: "engineHome",
    planVersion: ENGINE_PLAN_VERSION,
    title: "Sessão Casa",
    subtitle: "Para o dia em que a academia não acontece",
    weekday: 0,
    duration: "25–30 min",
    kind: "mixed",
    accent: "gold",
    cardioTarget: {
      min: 20,
      max: 40,
      defaultMinutes: 28,
      bpmMin: 135,
      bpmMax: 150,
    },
    description:
      "Circuito de 8 estações, 30 s de trabalho / 30 s andando no lugar, 3 voltas com 2 min entre elas. Substitui qualquer sessão da semana. Meta de FC média: 135–150. Alternativa: 10-20-30 — 5 × (30 s leve, 20 s moderado, 10 s máximo) em blocos de 5 min.",
    exercises: [],
  },
]

/** Sessões de sala que alternam A → B → A. */
export const ENGINE_CORE_SESSION_IDS: SessionId[] = ["engineForceA", "engineForceB"]

/** Sessões de alta intensidade — liberadas a partir do Bloco 2. */
export const ENGINE_INTENSE_SESSION_IDS: SessionId[] = ["engineMotor", "engineIntervals"]

/** Tudo que o programa prescreve. */
export const ENGINE_SESSION_IDS: SessionId[] = ENGINE_PLAN.map((session) => session.id)

/* ------------------------------------------------------------------ */
/* Zonas de intensidade                                                 */
/* ------------------------------------------------------------------ */

/**
 * Zonas provisórias, derivadas dos registros do próprio usuário: 130 bpm
 * aparece como esforço confortável e sustentável, e 160 bpm foi registrado em
 * 8 min de corrida declarados intensos em 30/08 — um esforço de 8 min
 * tolerado acontece perto de 90% da FCmáx, o que projeta FCmáx ≈ 175. As
 * faixas usam reserva de frequência cardíaca (Karvonen) com FCrep ≈ 70.
 *
 * Substituir pelos números do teste ergométrico assim que houver.
 */
export const ENGINE_MAX_HR_ESTIMATE = 175
export const ENGINE_REST_HR_ESTIMATE = 70

export interface EngineZone {
  id: "z1" | "z2" | "z3" | "z4" | "z5"
  label: string
  bpm: string
  rpe: string
  talk: string
  use: string
  accent: "steel" | "zone" | "gold" | "ember" | "bone"
}

export const ENGINE_ZONES: EngineZone[] = [
  {
    id: "z1",
    label: "Z1 · Solta",
    bpm: "< 120",
    rpe: "2–3",
    talk: "Consegue cantar",
    use: "Aquecimento, pausas do intervalado e caminhada de domingo",
    accent: "steel",
  },
  {
    id: "z2",
    label: "Z2 · Base",
    bpm: "122–138",
    rpe: "4–5",
    talk: "Frases completas",
    use: "O volume do plano: gasto calórico, mitocôndria e gordura visceral",
    accent: "zone",
  },
  {
    id: "z3",
    label: "Z3 · Limiar",
    bpm: "139–152",
    rpe: "6–7",
    talk: "Frases curtas",
    use: "Zona de passagem — só nas acelerações do Bloco 1 e nos aquecimentos",
    accent: "gold",
  },
  {
    id: "z4",
    label: "Z4 · VO₂máx",
    bpm: "153–166",
    rpe: "8–9",
    talk: "Palavras soltas",
    use: "Onde o VO₂máx sobe. É o alvo dos 4 min do protocolo 4×4",
    accent: "ember",
  },
  {
    id: "z5",
    label: "Z5 · Máxima",
    bpm: "> 166",
    rpe: "10",
    talk: "Não fala",
    use: "Só em tiros de até 30 s. Nunca sustentada",
    accent: "bone",
  },
]

/* ------------------------------------------------------------------ */
/* Pilares e regras                                                     */
/* ------------------------------------------------------------------ */

/** A hierarquia do ciclo, em ordem de prioridade. */
export const ENGINE_PILLARS = [
  {
    name: "Motor aeróbico",
    why: "VO₂máx é o desfecho nº 1 e o marcador com associação mais forte a longevidade — sem limite superior de benefício (Mandsager 2018).",
    how: "4×4 em Z4, 1× por semana a partir da semana 5",
  },
  {
    name: "Volume de Zona 2",
    why: "É o que decide o gasto calórico da semana e reduz gordura visceral mesmo sem mudança na balança (Vissers 2013).",
    how: "3 a 4 sessões de 35–60 min, 122–138 bpm",
  },
  {
    name: "Déficit e proteína",
    why: "70% da composição corporal é decidida na cozinha. Proteína alta protege a massa magra durante a perda.",
    how: "2.100–2.200 kcal/dia · 170–190 g de proteína",
  },
  {
    name: "Força de manutenção",
    why: "Sua massa magra sustenta um basal de ~1.900 kcal. Perdê-la torna cada quilo seguinte mais difícil — é assim que se constrói um platô.",
    how: "2 sessões de corpo inteiro, RIR 1–2, sem buscar recorde",
  },
  {
    name: "Sono e hidratação",
    why: "Mesmo déficit com 5,5 h de sono rendeu 55% menos gordura e 60% mais massa magra perdida (Nedeltcheva 2010). Sua mediana é 7 h, deitando entre 00:15 e 05:00.",
    how: "Deitar antes de 00:00 em 5 das 7 noites · 3,4–3,8 L de água",
  },
]

/** Restrições de encaixe que valem em qualquer semana. */
export const ENGINE_HARD_RULES = [
  "Nunca dois dias seguidos de alta intensidade. 4×4 e 30/30 pedem 48 h de intervalo.",
  "Alta intensidade não vai no dia anterior à Força A — perna cansada estraga as duas sessões.",
  "Cardio intenso e força no mesmo dia: a força vem primeiro, ou separe por 6 h.",
  "Um dia por semana sem treino nenhum. Sem exceção — a adaptação acontece na recuperação.",
  "A corrida entra só na trilha progressiva, na esteira e a 1% de inclinação. Aos 96 kg, cada passada é 2,5 a 3× o peso corporal.",
]

/**
 * O piso mínimo existe por causa do histórico: 2,8 sessões por semana na
 * média, mas com quatro semanas de zero em doze. Na semana ruim não se
 * abandona o plano — desce-se até o piso.
 */
export const ENGINE_FLOOR = [
  {
    rank: 1,
    sessionId: "engineMotor" as SessionId,
    label: "Motor 4×4",
    body: "É o que sobe o VO₂máx. Se só couber uma sessão na semana inteira, é esta.",
  },
  {
    rank: 2,
    sessionId: "engineZ2" as SessionId,
    label: "Zona 2 longa",
    body: "A sessão mais longa que couber no dia. 30 min já valem.",
  },
  {
    rank: 3,
    sessionId: "engineForceA" as SessionId,
    label: "Força A ou B",
    body: "A que estiver na vez. 25 min bastam se cortar para os 4 primeiros exercícios.",
  },
]

/** Circuito da Sessão Casa, na ordem de execução. */
export const ENGINE_HOME_CIRCUIT = [
  { name: "Polichinelo", hint: "ritmo constante" },
  { name: "Corrida estacionária, joelho alto", hint: "RPE 7" },
  { name: "Step no degrau ou banco", hint: "alterne a perna" },
  { name: "Pular corda", hint: "respeite o limite do bloco" },
  { name: "Agachamento no ar", hint: "amplitude total" },
  { name: "Escalador (mountain climber)", hint: "ritmo controlado" },
  { name: "Afundo alternado", hint: "sem pressa" },
  { name: "Soco no ar / shadow boxing", hint: "braço alto" },
]

/** Trilha de corrida na esteira, a 1% de inclinação. */
export const ENGINE_RUN_LADDER = [
  { weeks: "5 e 6", protocol: "8 × (1 min corrida / 2 min caminhada)", total: "24 min", pace: "6,5–7,0 km/h" },
  { weeks: "7 e 8", protocol: "6 × (2 min corrida / 2 min caminhada)", total: "24 min", pace: "6,5–7,0 km/h" },
  { weeks: "9 e 10", protocol: "5 × (3 min corrida / 2 min caminhada)", total: "25 min", pace: "7,0 km/h" },
  { weeks: "11", protocol: "4 × (5 min corrida / 2 min caminhada)", total: "28 min", pace: "7,0–7,5 km/h" },
  { weeks: "12", protocol: "2 × (10 min corrida / 3 min caminhada)", total: "26 min", pace: "7,0–7,5 km/h" },
]

/** Ajustes quando a realidade sai do plano — evita abandonar o ciclo. */
export const ENGINE_TROUBLESHOOTING = [
  {
    symptom: "A balança não se move há 3 semanas",
    fix: "Tire 150 kcal/dia, mas confira antes o registro de água e de sono. Não aumente o cardio ainda — o volume já sobe sozinho a cada bloco.",
  },
  {
    symptom: "Perdeu mais de 1 kg/semana por duas semanas seguidas",
    fix: "Adicione 150–200 kcal/dia. Perda rápida demais vem de massa magra e derruba o basal (Garthe 2011).",
  },
  {
    symptom: "Dor em canela, joelho ou planta do pé",
    fix: "Troque toda corrida por esteira inclinada por 1 a 2 semanas. O estímulo aeróbico fica igual e o impacto vai a zero.",
  },
  {
    symptom: "A FC não passa de 150 nos blocos do 4×4",
    fix: "Suba a inclinação ou a carga, nunca a velocidade a ponto de correr. Se ainda assim não subir, provavelmente foi sono ruim ou desidratação: refaça em outro dia.",
  },
  {
    symptom: "A FC dispara na Zona 2, acima de 145 sem esforço",
    fix: "Reduza o ritmo e siga. Calor, sono curto, cafeína e desidratação deslocam a FC em 5–10 bpm. Confie no teste da fala.",
  },
  {
    symptom: "Semana caótica, só deu duas sessões",
    fix: "Aplique o piso mínimo e siga em frente. Não tente compensar na semana seguinte — foi assim que o último ciclo virou um mês parado.",
  },
  {
    symptom: "A força continua caindo mesmo treinando",
    fix: "Confira proteína (170–190 g) e sono antes de mexer no treino. Em déficit, a força cai quando um desses dois falha — quase nunca por falta de série.",
  },
]

/** Testes de reavaliação: T0 agora, T1 no fim da semana 6, T2 na semana 12. */
export const ENGINE_TESTS = [
  {
    name: "Carga fixa de 6 min",
    tag: "principal",
    how: "Esteira · 5,0 km/h · 4% de inclinação · 6 minutos exatos",
    record: "FC no minuto 6",
    read: "Mesma carga, FC menor = motor melhor. Queda de 10–15 bpm em 6 semanas é ganho aeróbico grande e inequívoco. É o teste mais sensível e mais seguro para o seu caso.",
  },
  {
    name: "Recuperação em 1 min (HRR60)",
    tag: "mortalidade",
    how: "Logo após o teste acima: pare, fique em pé parado e conte 60 s",
    record: "FC ao parar menos FC em 60 s",
    read: "Queda abaixo de 12 bpm é ruim; acima de 20 bpm é bom (Cole 1999). Costuma ser o primeiro número a se mexer.",
  },
  {
    name: "Rockport 1,6 km",
    tag: "VO₂máx",
    how: "Esteira a 0% · caminhe 1,6 km o mais rápido possível, sem correr",
    record: "Tempo total e FC ao terminar",
    read: "VO₂máx = 132,853 − 0,0769×peso(lb) − 0,3877×idade + 6,315 − 3,2649×tempo(min) − 0,1565×FC final. Com 96 kg, use 211,6 lb (Kline 1987).",
  },
  {
    name: "Composição",
    tag: "cintura manda",
    how: "Bioimpedância em jejum + fita métrica na altura do umbigo",
    record: "Peso · cintura · % gordura · visceral",
    read: "A cintura reflete gordura visceral melhor que o percentual da balança. Meta: sair de 102 cm para menos de 94 cm.",
  },
  {
    name: "Cooper 12 min",
    tag: "só no T2",
    how: "Esteira a 1% · maior distância possível em 12 min",
    record: "Distância percorrida",
    read: "Faça apenas se na semana 11 você já correr 10 min contínuos. VO₂máx ≈ (metros − 504,9) ÷ 44,73.",
  },
]

/** Metas do ciclo, com o ponto de partida medido em 31/08/2026. */
export const ENGINE_TARGETS = [
  { label: "Peso", from: "96,0 kg", to: "89 kg", detail: "−7 kg · 0,5–0,7 kg/semana" },
  { label: "Cintura", from: "102 cm", to: "93 cm", detail: "sai da faixa de risco alto" },
  { label: "VO₂máx", from: "≈27", to: "32–34", detail: "ml/kg/min · +20 a +25%" },
  { label: "Cardio/semana", from: "38 min", to: "260 min", detail: "faixa ACSM de perda de peso" },
  { label: "Corrida contínua", from: "~300 m", to: "10 min", detail: "≈1,5 km sem parar" },
]

/* ------------------------------------------------------------------ */
/* Blocos                                                               */
/* ------------------------------------------------------------------ */

export type EnginePhaseId = "fundacao" | "motor" | "consolidacao" | "manutencao"

interface EngineBlock {
  id: EnginePhaseId
  label: string
  /** duração em semanas; null = bloco aberto, sempre o último da lista */
  weeks: number | null
  guidance: string
  cardio: string
  intense: string
  strength: string
  focus: string
  /** meta semanal de Zona 2 pura (o intenso é contado à parte) */
  z2Target: { min: number; max: number }
  /** sessões-alvo por semana, para o contador do painel */
  weeklySessions: string
}

const ENGINE_BLOCKS: EngineBlock[] = [
  {
    id: "fundacao",
    label: "Bloco 1 · Fundação",
    weeks: 4,
    guidance:
      "Construir tolerância e hábito com volume de Zona 2 sem impacto. Nada de tiros: seu tecido conjuntivo e sua adesão precisam de quatro semanas de base antes do trabalho duro. Agende o cardiologista nesta janela — o Bloco 2 pede liberação.",
    cardio: "110 → 180 min/sem",
    intense: "Nenhuma",
    strength: "2× · RIR 1–2",
    focus: "Frequência antes de intensidade",
    z2Target: { min: 110, max: 180 },
    weeklySessions: "5",
  },
  {
    id: "motor",
    label: "Bloco 2 · Motor",
    weeks: 4,
    guidance:
      "Entra o intervalado: 4×4 na terça e 30/30 na sexta. É aqui que o VO₂máx sobe de verdade, e é aqui que a trilha de corrida começa. Não inicie este bloco sem a liberação médica — a tontura em esforço que você relatou continua no registro.",
    cardio: "190 → 230 min/sem",
    intense: "2× · 4×4 + 30/30",
    strength: "2× · RIR 1–2",
    focus: "VO₂máx e trilha de corrida",
    z2Target: { min: 120, max: 165 },
    weeklySessions: "6",
  },
  {
    id: "consolidacao",
    label: "Bloco 3 · Consolidação",
    weeks: 4,
    guidance:
      "Volume no topo da faixa que o ACSM associa a perda de peso clinicamente significativa (225–420 min/sem). A semana 12 alivia e reavalia tudo: carga fixa de 6 min, HRR60, Rockport, composição e — se estiver correndo 10 min contínuos — Cooper.",
    cardio: "240 → 280 min/sem",
    intense: "2× · 4×4 ou 5×3",
    strength: "2× · RIR 1–2",
    focus: "Volume máximo e reteste",
    z2Target: { min: 165, max: 210 },
    weeklySessions: "6",
  },
  {
    id: "manutencao",
    label: "Bloco 4 · Manutenção",
    weeks: null,
    guidance:
      "Bloco aberto, depois do reteste. Mantenha 2 sessões de força, 1 a 2 de alta intensidade e o volume de Zona 2 que a rotina sustentar. Reavalie carga, peso e cintura a cada 4 semanas e ajuste as calorias pelo que a balança disser, não pela conta.",
    cardio: "200 → 260 min/sem",
    intense: "1–2× · conforme a rotina",
    strength: "2× · progredir devagar",
    focus: "Sustentar o que foi construído",
    z2Target: { min: 150, max: 200 },
    weeklySessions: "5–6",
  },
]

/** Minutos-alvo de cardio por semana do ciclo (semanas 1 a 12). */
export const ENGINE_WEEKLY_VOLUME: {
  week: number
  cardio: number
  intense: number
  /** marco da semana, quando houver */
  milestone?: string
  /** semana de alívio */
  easy?: boolean
}[] = [
  { week: 1, cardio: 110, intense: 0, milestone: "Teste T0" },
  { week: 2, cardio: 135, intense: 0 },
  { week: 3, cardio: 160, intense: 0 },
  { week: 4, cardio: 180, intense: 0, milestone: "Liberação médica" },
  { week: 5, cardio: 190, intense: 2, milestone: "Corrida entra" },
  { week: 6, cardio: 210, intense: 2, milestone: "Teste T1" },
  { week: 7, cardio: 230, intense: 2 },
  { week: 8, cardio: 160, intense: 1, easy: true },
  { week: 9, cardio: 240, intense: 2 },
  { week: 10, cardio: 260, intense: 2 },
  { week: 11, cardio: 280, intense: 2 },
  { week: 12, cardio: 180, intense: 1, easy: true, milestone: "Teste T2" },
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

/** Janela de cada bloco, derivada de ENGINE_START_DATE — nada de data chumbada. */
function blockWindows() {
  let cursor = ENGINE_START_DATE
  return ENGINE_BLOCKS.map((block) => {
    const start = cursor
    if (block.weeks === null) {
      return { block, start, end: null, dates: `a partir de ${shortDate(start)}` }
    }
    const end = shiftDateKey(start, block.weeks * 7 - 1)
    cursor = shiftDateKey(end, 1)
    return { block, start, end, dates: `${shortDate(start)} – ${shortDate(end)}` }
  })
}

export interface EnginePhase {
  id: EnginePhaseId
  label: string
  dates: string
  guidance: string
  /** meta semanal de Zona 2 pura do bloco atual */
  z2Target: { min: number; max: number }
  weeklySessions: string
  /** semana do ciclo (1..12); null no bloco aberto */
  cycleWeek: number | null
}

export function enginePhaseFor(date: Date): EnginePhase {
  const key = toDateKey(date)
  const windows = blockWindows()
  const current =
    windows.find((window) => window.end === null || key <= window.end) ?? windows[0]
  return {
    id: current.block.id,
    label: current.block.label,
    dates: current.dates,
    guidance: current.block.guidance,
    z2Target: current.block.z2Target,
    weeklySessions: current.block.weeklySessions,
    cycleWeek: engineCycleWeek(date),
  }
}

/**
 * Semana do ciclo (1 a 12) para uma data. Antes do início e depois da
 * semana 12 devolve null — o bloco de manutenção é aberto e não tem contagem.
 */
export function engineCycleWeek(date: Date): number | null {
  const key = toDateKey(date)
  if (key < ENGINE_START_DATE) return null
  const start = fromDateKey(ENGINE_START_DATE).getTime()
  const days = Math.floor((fromDateKey(key).getTime() - start) / 86_400_000)
  const week = Math.floor(days / 7) + 1
  return week >= 1 && week <= ENGINE_CYCLE_WEEKS ? week : null
}

/** Minutos-alvo da semana atual do ciclo; null fora das 12 semanas. */
export function engineWeeklyTargetFor(date: Date) {
  const week = engineCycleWeek(date)
  if (week === null) return null
  return ENGINE_WEEKLY_VOLUME.find((row) => row.week === week) ?? null
}

export interface EngineBlockWindow {
  id: EnginePhaseId
  label: string
  /** yyyy-MM-dd */
  start: string
  /** yyyy-MM-dd; null no bloco aberto */
  end: string | null
}

/**
 * Janelas dos blocos em datas cruas, para quem precisa recortar o histórico
 * por bloco (o relatório de fechamento). `ENGINE_PROGRESSION` serve à tabela
 * do Plano e traz as datas já formatadas para leitura.
 */
export function engineBlockWindows(): EngineBlockWindow[] {
  return blockWindows().map(({ block, start, end }) => ({
    id: block.id,
    label: block.label,
    start,
    end,
  }))
}

/** Tabela de progressão exibida no Plano, com as janelas já calculadas. */
export const ENGINE_PROGRESSION = blockWindows().map(({ block, dates }) => ({
  period: dates,
  block: block.label,
  cardio: block.cardio,
  intense: block.intense,
  strength: block.strength,
  focus: block.focus,
}))

/**
 * Prescrição exibida no registro. No Bloco 1 as sessões de alta intensidade
 * ainda não estão liberadas: continuam registráveis (o app nunca bloqueia um
 * treino já feito), mas aparecem com o aviso e a dose do bloco de fundação.
 */
export function enginePlanForDate(
  date: Date,
  templates: SessionPlan[] = ENGINE_PLAN
): SessionPlan[] {
  if (enginePhaseFor(date).id !== "fundacao") return templates

  return templates.map((session) => {
    if (!ENGINE_INTENSE_SESSION_IDS.includes(session.id)) return session
    return {
      ...session,
      duration: "aguarda o Bloco 2",
      description: `AINDA NÃO LIBERADO: o intervalado começa na semana 5, depois de quatro semanas de base e com liberação médica — a tontura em esforço que você relatou continua no registro. Se quiser adiantar o estímulo, faça 4 a 6 acelerações de 30 s em Z3 (139–152) no fim de uma Zona 2. ${session.description ?? ""}`.trim(),
    }
  })
}

/** Próxima sessão de sala: A e B alternam. */
export function nextEngineSession(workouts: WorkoutLog[], today: Date): SessionId {
  const todayKey = toDateKey(today)
  const core = workouts
    .filter(
      (workout) =>
        workout.date <= todayKey && ENGINE_CORE_SESSION_IDS.includes(workout.sessionId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const last = core[core.length - 1]
  return last?.sessionId === "engineForceA" ? "engineForceB" : "engineForceA"
}

export interface EngineTodayView {
  sessionId: SessionId
  nextSessionId: SessionId
  completedSessionId: SessionId | null
  done: boolean
  /**
   * Sessão que o ciclo ainda cobra hoje mesmo com treino registrado.
   * null = nada pendente.
   */
  pendingSessionId: SessionId | null
}

/**
 * Estado do card principal no ciclo de motor.
 *
 * A prioridade do dia é sempre cardio: com nenhum treino registrado, o card
 * oferece a sessão de sala que está na vez (é a única que alterna e precisa
 * de ordem). Qualquer treino registrado — Zona 2, avulso, esporte — conta o
 * dia como feito, mas a sala continua pendente até que A ou B seja salva.
 */
export function engineTodayView(workouts: WorkoutLog[], today: Date): EngineTodayView {
  const todayKey = toDateKey(today)
  const nextSessionId = nextEngineSession(workouts, today)
  const todayLogs = [...workouts].reverse().filter((workout) => workout.date === todayKey)
  const prescribed = todayLogs.find((workout) =>
    ENGINE_SESSION_IDS.includes(workout.sessionId)
  )
  const other = todayLogs.find(
    (workout) => workout.sessionId === "free" || workout.sessionId === "sport"
  )
  const completed = prescribed ?? other
  const strengthDone = todayLogs.some((workout) =>
    ENGINE_CORE_SESSION_IDS.includes(workout.sessionId)
  )

  return {
    sessionId: completed?.sessionId ?? nextSessionId,
    nextSessionId,
    completedSessionId: completed?.sessionId ?? null,
    done: Boolean(completed),
    pendingSessionId: strengthDone ? null : nextSessionId,
  }
}

export function isEngineSession(sessionId: SessionId): boolean {
  return ENGINE_SESSION_IDS.includes(sessionId)
}

export function isEngineStrengthSession(sessionId: SessionId): boolean {
  return ENGINE_CORE_SESSION_IDS.includes(sessionId)
}
