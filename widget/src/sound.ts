// Tiny inline beep (WebAudio API). Avoids embedding a base64 audio file
// (saves a few KB) and works in all modern browsers. Silent fallback if
// WebAudio is unavailable.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Klass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Klass) return null;
    ctx = new Klass();
    return ctx;
  } catch {
    return null;
  }
}

export function playBeep(): void {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.24);
  } catch {
    /* no-op */
  }
}
