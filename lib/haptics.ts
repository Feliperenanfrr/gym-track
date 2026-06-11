/**
 * Feedback tátil cross-platform.
 *
 * Android/Chrome: usa navigator.vibrate() (barato e perceptível).
 * iOS/Safari: vibrate() não existe — toca um "tick" ultracurto via
 * AudioContext (frequência alta, 30 ms, volume baixo). Funciona como
 * micro-feedback sonoro que imita a sensação de clique.
 */
export function tapFeedback() {
  // Tenta vibrar (funciona em Android)
  try {
    if (navigator.vibrate?.(15)) return
  } catch {
    /* ignore */
  }

  // Fallback sonoro para iOS: tick curtíssimo
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.value = 1800
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03)
    osc.start()
    osc.stop(ctx.currentTime + 0.03)
    osc.onended = () => ctx.close()
  } catch {
    /* ignore */
  }
}
