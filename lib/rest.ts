/**
 * Converte a string de descanso prescrita ("2–3 min", "90 s", "60–90 s") em
 * segundos. Usa o limite inferior da faixa como padrão para manter o treino
 * em ritmo — o usuário pode estender com +15 s no timer.
 */
export function parseRestSeconds(rest: string): number {
  const nums = rest.match(/\d+/g)?.map(Number) ?? []
  if (nums.length === 0) return 90
  const base = nums[0]
  return /min/i.test(rest) ? base * 60 : base
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, "0")}`
}
