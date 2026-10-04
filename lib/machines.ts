import { EXERCISES_BY_ID } from "./plan"
import { ExerciseLog, ExerciseMachine, WorkoutLog } from "./types"
import { isLegacyLbPlate } from "./units"

/**
 * Máquinas: carga só se compara dentro da mesma máquina.
 *
 * Regra de negócio: o EXERCÍCIO é o movimento (conta séries por grupo
 * muscular, aparece no plano); a MÁQUINA é o contexto da carga. Última vez,
 * setas, sugestão, passo, PR e gráficos de carga usam a chave exercício +
 * máquina. Exercício sem máquina cadastrada segue exatamente como antes.
 */

/** Separador da chave de comparação — não aparece em ids de exercício. */
const SEP = "#"

/** "legext" sem máquina; "legext#<id>" na máquina. */
export function liftKey(entry: Pick<ExerciseLog, "exerciseId" | "machineId">): string {
  return entry.machineId ? `${entry.exerciseId}${SEP}${entry.machineId}` : entry.exerciseId
}

export function parseLiftKey(key: string): { exerciseId: string; machineId?: string } {
  const at = key.indexOf(SEP)
  if (at < 0) return { exerciseId: key }
  return { exerciseId: key.slice(0, at), machineId: key.slice(at + 1) }
}

/** "Cadeira extensora · Extensora do fundo" — o nome que os gráficos mostram. */
export function liftName(
  entry: Pick<ExerciseLog, "exerciseId" | "exerciseName" | "machineName">
): string {
  const base = entry.exerciseName ?? EXERCISES_BY_ID[entry.exerciseId]?.name ?? entry.exerciseId
  return entry.machineName ? `${base} · ${entry.machineName}` : base
}

/** Id gerado no aparelho: o treino referencia a máquina mesmo sem rede. */
export function newMachineId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  } catch {
    /* contexto sem crypto seguro */
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Validação defensiva: o banco pode ser editado direto pelo dashboard. */
export function normalizeMachine(value: unknown): ExerciseMachine | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const id = typeof raw.id === "string" ? raw.id.trim() : ""
  const exerciseId =
    typeof raw.exerciseId === "string"
      ? raw.exerciseId
      : typeof raw.exercise_id === "string"
        ? raw.exercise_id
        : ""
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  if (!id || !exerciseId || !name) return null
  const unitRaw = raw.loadUnit ?? raw.load_unit
  const stepRaw = Number(raw.loadStep ?? raw.load_step)
  return {
    id,
    exerciseId,
    name,
    loadUnit: unitRaw === "lb" ? "lb" : "kg",
    ...(Number.isFinite(stepRaw) && stepRaw > 0 ? { loadStep: stepRaw } : {}),
    ...(raw.archived === true ? { archived: true } : {}),
  }
}

/** Máquinas ativas de um exercício, em ordem alfabética. */
export function machinesFor(machines: ExerciseMachine[], exerciseId: string): ExerciseMachine[] {
  return machines
    .filter((machine) => machine.exerciseId === exerciseId && !machine.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}

/**
 * A sessão parece feita numa pilha em lb convertida de cabeça? Maioria das
 * cargas cai em placa de 5 lb E nem todas são múltiplas de 5 kg — 50/60/75
 * kg também "caem" em lb às vezes, mas são a pilha em kg. Registro já
 * digitado em lb é lb, claro.
 */
export function looksLikeLbStack(entry: ExerciseLog): boolean {
  if (entry.loadUnit === "lb") return true
  const loads = entry.sets.map((set) => set.weight).filter((kg) => kg > 0)
  if (loads.length === 0) return false
  const lbLike = loads.filter(isLegacyLbPlate).length
  const allKgPlates = loads.every((kg) => Math.abs(kg / 5 - Math.round(kg / 5)) < 1e-6)
  return lbLike * 2 >= loads.length && !allKgPlates
}

export interface BackfillCandidate {
  /** `${log.id}|${exerciseId}` — um exercício aparece uma vez por treino */
  key: string
  date: string
  entry: ExerciseLog
  /** palpite pela unidade da máquina; você confirma marcando */
  suggested: boolean
}

export function backfillKey(log: Pick<WorkoutLog, "id">, exerciseId: string): string {
  return `${log.id}|${exerciseId}`
}

/**
 * Treinos antigos do exercício ainda sem máquina, mais recentes primeiro,
 * com o palpite de quais pertencem à máquina escolhida: pilha em lb puxa as
 * sessões com cara de lb convertido; pilha em kg puxa o resto.
 */
export function backfillCandidates(
  workouts: WorkoutLog[],
  exerciseId: string,
  machine: Pick<ExerciseMachine, "loadUnit">,
  beforeDate: string
): BackfillCandidate[] {
  const out: BackfillCandidate[] = []
  for (const log of workouts) {
    if (log.date >= beforeDate) continue
    const entry = log.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry || entry.machineId || !entry.sets.some((set) => set.weight > 0)) continue
    const lb = looksLikeLbStack(entry)
    out.push({
      key: backfillKey(log, exerciseId),
      date: log.date,
      entry,
      suggested: machine.loadUnit === "lb" ? lb : !lb,
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Treinos com as entradas marcadas na máquina (só os que mudaram). */
export function tagEntries(
  workouts: WorkoutLog[],
  keys: Set<string>,
  exerciseId: string,
  machine: Pick<ExerciseMachine, "id" | "name">
): WorkoutLog[] {
  const changed: WorkoutLog[] = []
  for (const log of workouts) {
    if (!keys.has(backfillKey(log, exerciseId))) continue
    changed.push({
      ...log,
      entries: log.entries.map((entry) =>
        entry.exerciseId === exerciseId
          ? { ...entry, machineId: machine.id, machineName: machine.name }
          : entry
      ),
    })
  }
  return changed
}
