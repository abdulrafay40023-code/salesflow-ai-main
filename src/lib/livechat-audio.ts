// Single crisp synthesized beep: strictly 1 tone, never replays on tab switch or focus
let audioCtx: AudioContext | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let lastPlayedTone = '';
let lastPlayedAt = 0;

function canPlay(tone: string, minIntervalMs = 2500): boolean {
  const now = Date.now();
  if (tone === lastPlayedTone && now - lastPlayedAt < minIntervalMs) {
    return false;
  }
  lastPlayedTone = tone;
  lastPlayedAt = now;
  return true;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function ensureKeepAlive(ctx: AudioContext) {
  if (keepAliveOsc) return;
  try {
    const gain = ctx.createGain();
    gain.gain.value = 0.00005;
    gain.connect(ctx.destination);
    keepAliveOsc = ctx.createOscillator();
    keepAliveOsc.type = 'sine';
    keepAliveOsc.frequency.setValueAtTime(15, ctx.currentTime);
    keepAliveOsc.connect(gain);
    keepAliveOsc.start();
  } catch {}
}

export async function ensureAudioRunning(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'running') {
    ensureKeepAlive(ctx);
    return true;
  }
  try {
    await ctx.resume();
    if (ctx.state === 'running') {
      ensureKeepAlive(ctx);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Generates a rich, luxury bell chime WAV data URI (strictly 1 single crisp, loud chime)
function createSingleBeepWav(freq: number, durationMs = 700, volume = 0.95): string {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.003); // 3ms instant crisp attack

    const bodyDecay = Math.exp(-t * 4.2); // Warm 600ms sustain
    const sparkleDecay = Math.exp(-t * 9.0); // 300ms sparkle decay
    const chimeDecay = Math.exp(-t * 12.0); // 200ms glass strike decay

    // Layer 1: Fundamental (Warm bell strike with triangle warmth)
    const f0 = Math.sin(2 * Math.PI * freq * t);
    const f0_tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
    const layer1 = (f0 * 0.45 + f0_tri * 0.25) * bodyDecay;

    // Layer 2: Sub-octave warmth (speaker resonance)
    const f_sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.20 * bodyDecay;

    // Layer 3: Octave sparkle (crisp presence)
    const f_oct = Math.sin(2 * Math.PI * (freq * 2.0) * t) * 0.25 * sparkleDecay;

    // Layer 4: Crystal bell harmonic (2.756x chime resonance)
    const f_chime = Math.sin(2 * Math.PI * (freq * 2.756) * t) * 0.15 * chimeDecay;

    const sample = (layer1 + f_sub + f_oct + f_chime) * volume * attack;
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Pre-synthesized single luxury chimes for HTML5 Audio fallback
let ARRIVAL_BEEP_URI = '';
let MESSAGE_BEEP_URI = '';
let APPROVAL_BEEP_URI = '';

if (typeof window !== 'undefined') {
  try {
    ARRIVAL_BEEP_URI = createSingleBeepWav(1046.50, 700, 0.95); // High C luxury bell chime
    MESSAGE_BEEP_URI = createSingleBeepWav(1174.66, 650, 0.95); // High D message chime
    APPROVAL_BEEP_URI = createSingleBeepWav(880.00, 750, 0.95); // Concert A attention chime
  } catch {}
}

function doPlaySingleTone(ctx: AudioContext, freq: number, duration: number, volume: number) {
  try {
    const start = ctx.currentTime + 0.015;

    // Layer 1: Fundamental Warm Chime (Triangle wave for rich acoustic bell resonance)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, start);

    // Layer 2: Shimmering Sparkle Harmonic (2x - crisp high punch)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, start);

    // Layer 3: Crystal Glass Overtones (2.756x - natural physical bell strike overtone)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 2.756, start);

    // Layer 4: Warm Acoustic Sub-Body (0.5x - speaker resonance)
    const osc4 = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 0.5, start);

    // Dynamic Limiter/Master Gain to prevent clipping while staying loud
    const master = ctx.createGain();
    master.gain.setValueAtTime(volume * 1.0, start);
    master.connect(ctx.destination);

    // Envelopes: 3ms ultra-crisp attack, natural rich bell decay
    gain1.gain.setValueAtTime(0.001, start);
    gain1.gain.linearRampToValueAtTime(0.70, start + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    gain2.gain.setValueAtTime(0.001, start);
    gain2.gain.linearRampToValueAtTime(0.30, start + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.65);

    gain3.gain.setValueAtTime(0.001, start);
    gain3.gain.linearRampToValueAtTime(0.18, start + 0.003);
    gain3.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.45);

    gain4.gain.setValueAtTime(0.001, start);
    gain4.gain.linearRampToValueAtTime(0.22, start + 0.003);
    gain4.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc1.connect(gain1);
    gain1.connect(master);

    osc2.connect(gain2);
    gain2.connect(master);

    osc3.connect(gain3);
    gain3.connect(master);

    osc4.connect(gain4);
    gain4.connect(master);

    osc1.start(start);
    osc1.stop(start + duration + 0.02);

    osc2.start(start);
    osc2.stop(start + duration + 0.02);

    osc3.start(start);
    osc3.stop(start + duration + 0.02);

    osc4.start(start);
    osc4.stop(start + duration + 0.02);
  } catch {}
}

function playSingleBeep(type: 'arrival' | 'message' | 'approval') {
  // 1046.5Hz = Bright High C (Crisp Luxury Slack/iPhone bell tone)
  const freq = type === 'arrival' ? 1046.50 : type === 'message' ? 1174.66 : 880.00;
  const duration = 0.70;
  const volume = 1.0;

  let played = false;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'running') {
    try {
      doPlaySingleTone(ctx, freq, duration, volume);
      played = true;
    } catch {}
  }

  // HTML5 audio fallback: runs instantly in background tabs
  // Crucially: never queues a delayed callback on ctx.resume, so it NEVER plays on tab switch!
  if (!played && typeof window !== 'undefined') {
    try {
      if (ctx && ctx.state !== 'running') {
        ctx.resume().catch(() => {});
      }
      const uri = type === 'arrival' ? ARRIVAL_BEEP_URI : type === 'message' ? MESSAGE_BEEP_URI : APPROVAL_BEEP_URI;
      if (uri) {
        const audio = new Audio(uri);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch {}
  }
}

// 🟢 GREEN: Visitor arrival (Single crisp chime, strictly once)
export function playArrivalChime() {
  if (!canPlay('arrival', 3000)) return;
  playSingleBeep('arrival');
}

// 🔴 RED: New visitor chat message (Single crisp chime, strictly once)
export function playMessageChime() {
  if (!canPlay('message', 2000)) return;
  playSingleBeep('message');
}

// 🟡 YELLOW: Agent handoff / approval (Single crisp chime, strictly once)
export function playApprovalChime() {
  if (!canPlay('approval', 3000)) return;
  playSingleBeep('approval');
}

// Auto-unlock audio on user interaction once (never on visibilitychange or focus)
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'keydown', 'pointerdown'];
  const handleUnlock = () => {
    ensureAudioRunning().catch(() => {});
  };
  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, handleUnlock, { once: true, passive: true });
  });
}
