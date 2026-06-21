import { EXERCISES_BY_ID } from "./plan"
import { EXERCISE_GROUP, MUSCLE_GROUPS } from "./muscles"
import { ExercisePrescription, MuscleGroup } from "./types"

export interface CatalogExercise extends ExercisePrescription {
  muscleGroup: MuscleGroup
  equipment: "academia" | "halteres" | "peso corporal"
}

const extra: CatalogExercise[] = [
  { id: "db-bench", name: "Supino reto com halteres", nameEn: "Dumbbell Bench Press", muscleGroup: "Peito", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 12, unit: "reps", rest: "90 s", note: "Alternativa em casa ou na academia" },
  { id: "db-floor-press", name: "Supino no chão com halteres", nameEn: "Dumbbell Floor Press", muscleGroup: "Peito", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Boa opção quando não há banco" },
  { id: "pushup", name: "Flexão de braço", nameEn: "Push-up", muscleGroup: "Peito", equipment: "peso corporal", sets: 4, repsMin: 8, repsMax: 20, unit: "reps", rest: "60–90 s", note: "Eleve os pés ou use carga para progredir" },
  { id: "db-row", name: "Remada unilateral com halter", nameEn: "One-arm Dumbbell Row", muscleGroup: "Costas", equipment: "halteres", sets: 4, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Apoie uma mão e mantenha o tronco firme" },
  { id: "db-pullover", name: "Pullover com halter", nameEn: "Dumbbell Pullover", muscleGroup: "Costas", equipment: "halteres", sets: 3, repsMin: 10, repsMax: 15, unit: "reps", rest: "60–90 s", note: "Alternativa para dorsais sem polia" },
  { id: "inverted-row", name: "Remada invertida", nameEn: "Inverted Row", muscleGroup: "Costas", equipment: "peso corporal", sets: 4, repsMin: 6, repsMax: 15, unit: "reps", rest: "90 s", note: "Use um apoio realmente estável" },
  { id: "db-ohp", name: "Desenvolvimento com halteres", nameEn: "Dumbbell Shoulder Press", muscleGroup: "Ombro", equipment: "halteres", sets: 3, repsMin: 8, repsMax: 15, unit: "reps", rest: "90 s", note: "Em pé ou sentado" },
  { id: "db-lateral", name: "Elevação lateral com halteres", nameEn: "Dumbbell Lateral Raise", muscleGroup: "Ombro", equipment: "halteres", sets: 4, repsMin: 12, repsMax: 20, unit: "reps", rest: "60 s", note: "Controle a descida" },
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
]

const planned: CatalogExercise[] = Object.values(EXERCISES_BY_ID).map((exercise) => ({
  ...exercise,
  muscleGroup: EXERCISE_GROUP[exercise.id] ?? "Core",
  equipment: "academia",
}))

export const EXERCISE_CATALOG = [...planned, ...extra].sort((a, b) =>
  a.name.localeCompare(b.name, "pt-BR")
)

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
