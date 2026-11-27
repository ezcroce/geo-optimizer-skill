// Il resume viene invocato nel gesto utente; niente audio o promise rifiutate
// se il browser non supporta Web Audio o mantiene il contesto sospeso.
export function createAudioFeedback(
  createContext = () => {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  },
) {
  let context;
  let pendingResume;
  async function unlock() {
    try {
      if (!context || context.state === "closed") context = createContext();
      if (!context) return null;
      const current = context;
      if (current.state === "suspended") {
        if (!pendingResume) {
          pendingResume = Promise.resolve(current.resume()).finally(() => {
            pendingResume = null;
          });
        }
        await pendingResume;
      }
      return current.state === "running" ? current : null;
    } catch {
      return null;
    }
  }
  async function beep(frequency = 660) {
    const ctx = await unlock();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.17);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Una sospensione del sistema operativo non deve interrompere il gioco.
    }
  }
  return { unlock, beep };
}
