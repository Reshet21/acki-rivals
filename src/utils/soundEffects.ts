/**
 * Sound effects for Acki Rivals battles.
 * Uses Web Audio API — no external files needed.
 * All sounds are synthesized procedurally.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function createGain(ctx: AudioContext, volume: number, duration: number, startTime: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  gain.connect(ctx.destination);
  return gain;
}

function createNoise(ctx: AudioContext, gain: GainNode, startTime: number, duration: number) {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start(startTime);
  source.stop(startTime + duration);
  return source;
}

/** Card swoosh — card played */
export function playCardSwoosh(volume = 0.12) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const g = createGain(ctx, volume, 0.3, now);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.3);
    const ng = createGain(ctx, volume * 0.5, 0.2, now);
    createNoise(ctx, ng, now, 0.2);
  } catch { /* audio not available */ }
}

/** Punch/impact — damage dealt */
export function playHit(volume = 0.25) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const g1 = createGain(ctx, volume, 0.15, now);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, now);
    osc1.connect(g1);
    osc1.start(now);
    osc1.stop(now + 0.15);
    const g2 = createGain(ctx, volume * 0.6, 0.1, now);
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(150, now);
    osc2.connect(g2);
    osc2.start(now);
    osc2.stop(now + 0.1);
    const ng = createGain(ctx, volume * 0.4, 0.08, now);
    createNoise(ctx, ng, now, 0.08);
  } catch { /* audio not available */ }
}

/** Dramatic VS impact */
export function playVS(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const g1 = createGain(ctx, volume, 0.5, now);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(60, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.3);
    osc1.connect(g1);
    osc1.start(now);
    osc1.stop(now + 0.5);
    const g2 = createGain(ctx, volume * 0.5, 0.4, now + 0.1);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(100, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(400, now + 0.5);
    osc2.connect(g2);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);
    const ng = createGain(ctx, volume * 0.3, 0.3, now);
    createNoise(ctx, ng, now, 0.3);
  } catch { /* audio not available */ }
}

/** Triumphant victory jingle */
export function playVictory(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = now + i * 0.15;
      const g = createGain(ctx, volume * (1 - i * 0.15), 0.4, t);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    const bg = createGain(ctx, volume * 0.8, 0.6, now);
    const bosc = ctx.createOscillator();
    bosc.type = 'sine';
    bosc.frequency.setValueAtTime(262, now);
    bosc.connect(bg);
    bosc.start(now);
    bosc.stop(now + 0.6);
  } catch { /* audio not available */ }
}

/** Sad defeat sound */
export function playDefeat(volume = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const notes = [523, 466, 392, 330];
    notes.forEach((freq, i) => {
      const t = now + i * 0.2;
      const g = createGain(ctx, volume * (1 - i * 0.15), 0.5, t);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch { /* audio not available */ }
}

/** Draw — neutral tone */
export function playDraw(volume = 0.15) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const g = createGain(ctx, volume, 0.4, now);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch { /* audio not available */ }
}

/** Heal chime */
export function playHeal(volume = 0.18) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const t = now + i * 0.1;
      const g = createGain(ctx, volume, 0.3, t);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch { /* audio not available */ }
}

/** Poison bubbling */
export function playPoison(volume = 0.15) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.12;
      const g = createGain(ctx, volume * 0.6, 0.1, t);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200 + Math.random() * 300, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  } catch { /* audio not available */ }
}

/** Life steal — whip sound */
export function playLifeSteal(volume = 0.18) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const g = createGain(ctx, volume, 0.25, now);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch { /* audio not available */ }
}

/** Ability activation sparkle */
export function playAbility(volume = 0.15) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    [400, 500, 600, 800, 1000].forEach((freq, i) => {
      const t = now + i * 0.06;
      const g = createGain(ctx, volume, 0.15, t);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch { /* audio not available */ }
}
