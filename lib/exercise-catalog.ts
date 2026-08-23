import { EXERCISES_BY_ID } from "./plan"
import { EXERCISE_GROUP, MUSCLE_GROUPS } from "./muscles"
import { ExercisePrescription, MuscleGroup, SessionPlan } from "./types"

export interface CatalogExercise extends ExercisePrescription {
  muscleGroup: MuscleGroup
  equipment: "academia" | "halteres" | "peso corporal"
}

const extra: CatalogExercise[] = [
  { id: "power-clean", name: "Power Clean", nameEn: "Power Clean", muscleGroup: "Posterior/Glúteo", equipment: "academia", sets: 4, repsMin: 3, repsMax: 3, unit: "reps", rest: "2–3 min", note: "Explosão de quadril e recepção firme; encerre quando a velocidade cair" },
  { id: "db-bench", name: "Supino reto com halteres", nameEn: "Dumbbell Bench Press", muscleGroup: "Peito", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Alternativa em casa ou na academia" },
  { id: "db-floor-press", name: "Supino no chão com halteres", nameEn: "Dumbbell Floor Press", muscleGroup: "Peito", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Boa opção quando não há banco" },
  { id: "pushup", name: "Flexão de braço", nameEn: "Push-up", muscleGroup: "Peito", equipment: "peso corporal", sets: 4, repsMin: 8, repsMax: 20, unit: "reps", rest: "60–90 s", note: "Eleve os pés ou use carga para progredir" },
  { id: "db-row", name: "Remada unilateral com halter", nameEn: "One-arm Dumbbell Row", muscleGroup: "Costas", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Apoie uma mão e mantenha o tronco firme" },
  { id: "db-pullover", name: "Pullover com halter", nameEn: "Dumbbell Pullover", muscleGroup: "Costas", equipment: "halteres", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60–90 s", note: "Alternativa para dorsais sem polia" },
  { id: "inverted-row", name: "Remada invertida", nameEn: "Inverted Row", muscleGroup: "Costas", equipment: "peso corporal", sets: 4, repsMin: 6, repsMax: 15, unit: "reps", rest: "90 s", note: "Use um apoio realmente estável" },
  { id: "db-lateral", name: "Elevação lateral com halteres", nameEn: "Dumbbell Lateral Raise", muscleGroup: "Ombro", equipment: "halteres", sets: 4, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Controle a descida" },
  { id: "deadlift", name: "Levantamento terra", nameEn: "Conventional Deadlift", muscleGroup: "Posterior/Glúteo", equipment: "academia", sets: 3, repsMin: 3, repsMax: 5, unit: "reps", rest: "3 min", note: "Fora do plano novo — registre se quiser manter o padrão de terra" },
  { id: "db-reverse-fly", name: "Crucifixo inverso com halteres", nameEn: "Dumbbell Reverse Fly", muscleGroup: "Ombro", equipment: "halteres", sets: 3, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Posterior de ombro sem polia" },
  { id: "db-curl", name: "Rosca com halteres", nameEn: "Dumbbell Curl", muscleGroup: "Braço", equipment: "halteres", sets: 3, repsMin: 8, repsMax: 15, unit: "reps", rest: "60 s", note: "Pode alternar os braços" },
  { id: "db-triceps", name: "Tríceps francês com halter", nameEn: "Dumbbell Overhead Triceps Extension", muscleGroup: "Braço", equipment: "halteres", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "Um ou dois halteres" },
  { id: "goblet-squat", name: "Agachamento goblet", nameEn: "Goblet Squat", muscleGroup: "Quadríceps", equipment: "halteres", sets: 4, repsMin: 10, repsMax: 20, unit: "reps", rest: "90 s", note: "Segure um halter junto ao peito" },
  { id: "db-bulgarian", name: "Agachamento búlgaro com halteres", nameEn: "Dumbbell Bulgarian Split Squat", muscleGroup: "Quadríceps", equipment: "halteres", sets: 3, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Repetições por perna" },
  { id: "db-stepup", name: "Subida no banco com halteres", nameEn: "Dumbbell Step-up", muscleGroup: "Quadríceps", equipment: "halteres", sets: 3, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Use uma superfície firme" },
  { id: "db-rdl", name: "Terra romeno com halteres", nameEn: "Dumbbell Romanian Deadlift", muscleGroup: "Posterior/Glúteo", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Quadril para trás e coluna neutra" },
  { id: "db-hip-thrust", name: "Elevação pélvica com halter", nameEn: "Dumbbell Hip Thrust", muscleGroup: "Posterior/Glúteo", equipment: "halteres", sets: 4, repsMin: 10, repsMax: 20, unit: "reps", rest: "90 s", note: "Apoie o halter sobre o quadril" },
  { id: "single-leg-rdl", name: "Stiff unilateral com halter", nameEn: "Single-leg Dumbbell RDL", muscleGroup: "Posterior/Glúteo", equipment: "halteres", sets: 3, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Repetições por perna" },
  { id: "db-calf", name: "Panturrilha em pé com halteres", nameEn: "Dumbbell Calf Raise", muscleGroup: "Panturrilha", equipment: "halteres", sets: 4, repsMin: 12, repsMax: 25, unit: "reps", rest: "60 s", note: "Use um degrau para ampliar o movimento" },
  { id: "dead-bug", name: "Dead bug", nameEn: "Dead Bug", muscleGroup: "Core", equipment: "peso corporal", sets: 3, repsMin: 8, repsMax: 15, unit: "reps", rest: "60 s", note: "Repetições por lado" },
  { id: "russian-twist", name: "Rotação russa com halter", nameEn: "Dumbbell Russian Twist", muscleGroup: "Core", equipment: "halteres", sets: 3, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Repetições por lado" },
  { id: "machine-shoulder-press", name: "Desenvolvimento na máquina", nameEn: "Machine Shoulder Press", muscleGroup: "Ombro", equipment: "academia", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Mesmo padrão do militar, sem exigir estabilidade da barra" },
  { id: "machine-chest-press", name: "Supino na máquina (chest press)", nameEn: "Machine Chest Press", muscleGroup: "Peito", equipment: "academia", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Ajuste o assento para o pegador sair na linha do peito" },
  { id: "pec-deck", name: "Crucifixo na máquina (pec deck)", nameEn: "Pec Deck Fly", muscleGroup: "Peito", equipment: "academia", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Alongue na abertura e junte sem bater as alavancas" },
  { id: "seated-row", name: "Remada sentada na polia", nameEn: "Seated Cable Row", muscleGroup: "Costas", equipment: "academia", sets: 3, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Peito alto, puxando em direção ao abdômen" },
  { id: "shrug", name: "Encolhimento de ombros", nameEn: "Barbell Shrug", muscleGroup: "Costas", equipment: "academia", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "Ombros para trás, sem rodar" },
  { id: "front-raise", name: "Elevação frontal", nameEn: "Front Raise", muscleGroup: "Ombro", equipment: "halteres", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Suba na linha do ombro sem balançar o tronco" },
  { id: "scott-curl", name: "Rosca scott", nameEn: "Preacher Curl", muscleGroup: "Braço", equipment: "academia", sets: 3, repsMin: 10, repsMax: 12, unit: "reps", rest: "60 s", note: "Braço apoiado no banco; desça controlado" },
  { id: "cable-kickback", name: "Coice na polia (glúteo)", nameEn: "Cable Glute Kickback", muscleGroup: "Posterior/Glúteo", equipment: "academia", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Quadril estável; repetições por perna" },
  { id: "abductor", name: "Cadeira abdutora (abdutores)", nameEn: "Hip Abduction Machine", muscleGroup: "Posterior/Glúteo", equipment: "academia", sets: 3, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Tronco levemente inclinado à frente foca mais glúteo" },
  { id: "adductor", name: "Cadeira adutora (adutores)", nameEn: "Hip Adduction Machine", muscleGroup: "Posterior/Glúteo", equipment: "academia", sets: 3, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Amplitude completa sem quicar as pernas" },
  { id: "back-extension", name: "Hiperextensão (mesa extensora)", nameEn: "Back Extension", muscleGroup: "Posterior/Glúteo", equipment: "academia", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Suba até a linha neutra do corpo, sem hiperestender" },
  { id: "machine-crunch", name: "Abdominal crunch na máquina", nameEn: "Machine Abdominal Crunch", muscleGroup: "Core", equipment: "academia", sets: 3, repsMin: 12, repsMax: 15, unit: "reps", rest: "60 s", note: "Enrole o tronco; pausa de 1 s no topo" },
  { id: "crunch", name: "Abdominal supra no chão", nameEn: "Floor Crunch", muscleGroup: "Core", equipment: "peso corporal", sets: 3, repsMin: 15, repsMax: 20, unit: "reps", rest: "60 s", note: "Lombar colada no chão, mãos leves na cabeça" },
  { id: "leg-raise", name: "Elevação de pernas", nameEn: "Leg Raise", muscleGroup: "Core", equipment: "peso corporal", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60 s", note: "No banco ou suspenso, lombar sempre apoiada" },
]

const planned: CatalogExercise[] = Object.values(EXERCISES_BY_ID).map((exercise) => ({
  ...exercise,
  muscleGroup: exercise.muscleGroup ?? EXERCISE_GROUP[exercise.id] ?? "Core",
  equipment: "academia",
}))

const plannedIds = new Set(planned.map((exercise) => exercise.id))

export const EXERCISE_CATALOG = [
  ...planned,
  ...extra.filter((exercise) => !plannedIds.has(exercise.id)),
].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

/** Inclui no seletor exercícios personalizados que já vivem em algum template. */
export function catalogWithTemplates(templates: SessionPlan[]): CatalogExercise[] {
  const byId = new Map(EXERCISE_CATALOG.map((exercise) => [exercise.id, exercise]))
  for (const exercise of templates.flatMap((template) => template.exercises)) {
    if (byId.has(exercise.id)) continue
    byId.set(exercise.id, {
      ...exercise,
      muscleGroup: exercise.muscleGroup ?? EXERCISE_GROUP[exercise.id] ?? "Core",
      equipment: "academia",
    })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

export const MUSCLE_GROUP_OPTIONS = MUSCLE_GROUPS.map((group) => group.id)

export function groupOfExercise(
  exercise: Pick<ExercisePrescription, "id" | "muscleGroup">
): MuscleGroup {
  return exercise.muscleGroup ?? EXERCISE_CATALOG.find((item) => item.id === exercise.id)?.muscleGroup ?? "Core"
}

export function makeCustomExercise(name: string, muscleGroup: MuscleGroup): CatalogExercise {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  return {
    id: `custom-${slug || Date.now()}`,
    name: name.trim(),
    nameEn: "Exercício personalizado",
    muscleGroup,
    equipment: "halteres",
    sets: 3,
    repsMin: 8,
    repsMax: 12,
    unit: "reps",
    rest: "90 s",
    note: "Adicionado por você",
  }
}
