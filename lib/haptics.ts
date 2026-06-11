/**
 * Feedback tátil/sonoro cross-platform.
 *
 * Android/Chrome: navigator.vibrate() (barato e perceptível).
 * iOS/Safari: vibrate() não existe. Dois canais:
 *   1. Háptico real (iOS 17.4+): clicar programaticamente um
 *      <input type="checkbox" switch> escondido, dentro de um gesto do
 *      usuário, dispara o tique háptico do sistema — é o único jeito de
 *      fazer um iPhone vibrar a partir da web.
 *   2. Tick sonoro via AudioContext COMPARTILHADO. No iOS um contexto
 *      novo nasce "suspended" e nunca toca se não for retomado; por isso
 *      um único contexto é criado e resume() é chamado a cada uso.
 *      A sessão de áudio é "ambient" para misturar com a música do
 *      usuário (e respeitar o modo silencioso) em vez de pausá-la.
 */

let hapticLabel: HTMLLabelElement | null = null

/** Dispara o háptico do sistema no iOS 17.4+ (no-op em outros browsers). */
function iosSwitchHaptic(): boolean {
  try {
    if (typeof document === "undefined") return false
    if (!hapticLabel || !hapticLabel.isConnected) {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.setAttribute("switch", "")
      // só o WebKit com switch control expõe a propriedade "switch"
      if (!("switch" in input)) return false
      const label = document.createElement("label")
      label.setAttribute("aria-hidden", "true")
      label.style.display = "none"
      label.appendChild(input)
      document.body.appendChild(label)
      hapticLabel = label
    }
    hapticLabel.click()
    return true
  } catch {
    return false
  }
}

let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) return null
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession
    // mistura com a música em vez de pausá-la; segue o botão de silencioso
    if (session) session.type = "ambient"
  } catch {
    /* ignore */
  }
  audioCtx = new Ctx()
  return audioCtx
}

/** Executa fn com o contexto rodando (resume obrigatório no iOS). */
function withRunningCtx(fn: (ctx: AudioContext) => void) {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    if (ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => fn(ctx))
        .catch(() => {})
    } else {
      fn(ctx)
    }
  } catch {
    /* ignore */
  }
}

function playTone(ctx: AudioContext, freq: number, durationMs: number, peak: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = "sine"
  osc.frequency.value = freq
  const t = ctx.currentTime
  const dur = durationMs / 1000
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.start(t)
  osc.stop(t + dur + 0.01)
}

/** Feedback curto ao marcar uma série. Chamar DENTRO de um gesto do usuário. */
export function tapFeedback() {
  try {
    if (navigator.vibrate?.(15)) return
  } catch {
    /* ignore */
  }
  iosSwitchHaptic()
  withRunningCtx((ctx) => playTone(ctx, 1100, 60, 0.12))
}

/**
 * Alerta de fim de descanso: vibração em padrão + bipe mais longo.
 * O bipe funciona fora de gesto porque o contexto já foi destravado
 * pelo tapFeedback que iniciou o timer.
 */
export function alertFeedback() {
  try {
    navigator.vibrate?.([120, 60, 120])
  } catch {
    /* ignore */
  }
  iosSwitchHaptic()
  withRunningCtx((ctx) => playTone(ctx, 880, 450, 0.25))
}
