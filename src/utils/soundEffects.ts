/**
 * Sound effects for Acki Rivals battles.
 * Uses Web Audio API — no external files needed.
 * All sounds are synthesized procedurally with layered oscillators,
 * FM synthesis, noise, distortion, and reverb for game-quality audio.
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

function gain(ctx: AudioContext, vol: number, dur: number, start: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  g.connect(ctx.destination);
  return g;
}

/** Create a distortion curve for waveshaper */
function distortCurve(amount: number) {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve as unknown as Float32Array<ArrayBuffer>;
}

/** Simple reverb via delay */
function addReverb(ctx: AudioContext, input: AudioNode, delay = 0.03, feedback = 0.3, mix = 0.2) {
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - mix;
  const wetGain = ctx.createGain();
  wetGain.gain.value = mix;
  const delayNode = ctx.createDelay(1);
  delayNode.delayTime.value = delay;
  const fbGain = ctx.createGain();
  fbGain.gain.value = feedback;
  input.connect(dryGain);
  input.connect(delayNode);
  delayNode.connect(fbGain);
  fbGain.connect(delayNode);
  delayNode.connect(wetGain);
  dryGain.connect(ctx.destination);
  wetGain.connect(ctx.destination);
}

/**
 * Card swoosh — cinematic whoosh with air texture
 * Think: card flying through air with a sharp snap at the end
 */
export function playCardSwoosh(vol = 0.18) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Layer 1: Rising whoosh (filtered noise sweep)
    const g1 = gain(ctx, vol * 0.6, 0.35, now);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(100, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 0.35);
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(300, now);
    filter1.frequency.exponentialRampToValueAtTime(3000, now + 0.12);
    filter1.Q.value = 2;
    osc1.connect(filter1);
    filter1.connect(g1);
    osc1.start(now);
    osc1.stop(now + 0.35);
    // Layer 2: Noise whoosh
    const ng = gain(ctx, vol * 0.4, 0.25, now);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(500, now);
    nFilter.frequency.exponentialRampToValueAtTime(4000, now + 0.1);
    nFilter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    nFilter.Q.value = 1.5;
    const nBuf = Math.floor(ctx.sampleRate * 0.25);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nFilter);
    nFilter.connect(ng);
    nSrc.start(now);
    nSrc.stop(now + 0.25);
    // Layer 3: Snap/click at the end
    const snap = gain(ctx, vol * 0.3, 0.04, now + 0.1);
    const snapOsc = ctx.createOscillator();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(2000, now + 0.1);
    snapOsc.frequency.exponentialRampToValueAtTime(200, now + 0.14);
    snapOsc.connect(snap);
    snapOsc.start(now + 0.1);
    snapOsc.stop(now + 0.14);
  } catch { /* audio not available */ }
}

/**
 * Punch/impact — heavy cinematic hit
 * Bass thump + mid crunch + high crack + noise burst
 */
export function playHit(vol = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Layer 1: Sub bass thump
    const g1 = gain(ctx, vol, 0.2, now);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(60, now);
    osc1.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    osc1.connect(g1);
    osc1.start(now);
    osc1.stop(now + 0.2);
    // Layer 2: Mid crunch (distorted square)
    const g2 = gain(ctx, vol * 0.5, 0.12, now);
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(180, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.12);
    const dist = ctx.createWaveShaper();
    dist.curve = distortCurve(80);
    osc2.connect(dist);
    dist.connect(g2);
    osc2.start(now);
    osc2.stop(now + 0.12);
    // Layer 3: High crack
    const g3 = gain(ctx, vol * 0.4, 0.06, now);
    const osc3 = ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(1500, now);
    osc3.frequency.exponentialRampToValueAtTime(200, now + 0.06);
    osc3.connect(g3);
    osc3.start(now);
    osc3.stop(now + 0.06);
    // Layer 4: Noise burst (impact debris)
    const ng = gain(ctx, vol * 0.35, 0.1, now);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 2000;
    const nBuf = Math.floor(ctx.sampleRate * 0.1);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nf);
    nf.connect(ng);
    nSrc.start(now);
    nSrc.stop(now + 0.1);
    // Reverb tail
    addReverb(ctx, g1, 0.04, 0.2, 0.15);
  } catch { /* audio not available */ }
}

/**
 * Dramatic VS impact — cinematic trailer hit
 * Deep bass drop + rising tension + explosion
 */
export function playVS(vol = 0.35) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Layer 1: Sub bass drop
    const g1 = gain(ctx, vol, 0.8, now);
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, now);
    osc1.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    osc1.connect(g1);
    osc1.start(now);
    osc1.stop(now + 0.8);
    // Layer 2: Rising tension saw
    const g2 = gain(ctx, vol * 0.3, 0.4, now);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(600, now + 0.3);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.setValueAtTime(200, now);
    f2.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
    f2.Q.value = 4;
    osc2.connect(f2);
    f2.connect(g2);
    osc2.start(now);
    osc2.stop(now + 0.4);
    // Layer 3: Explosion crack at peak
    const g3 = gain(ctx, vol * 0.6, 0.15, now + 0.25);
    const osc3 = ctx.createOscillator();
    osc3.type = 'square';
    osc3.frequency.setValueAtTime(300, now + 0.25);
    osc3.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    const dist3 = ctx.createWaveShaper();
    dist3.curve = distortCurve(120);
    osc3.connect(dist3);
    dist3.connect(g3);
    osc3.start(now + 0.25);
    osc3.stop(now + 0.4);
    // Layer 4: Noise explosion
    const ng = gain(ctx, vol * 0.4, 0.4, now + 0.2);
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.setValueAtTime(8000, now + 0.2);
    nf.frequency.exponentialRampToValueAtTime(200, now + 0.6);
    const nBuf = Math.floor(ctx.sampleRate * 0.4);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nf);
    nf.connect(ng);
    nSrc.start(now + 0.2);
    nSrc.stop(now + 0.6);
    // Layer 5: Chord stab for drama
    [220, 277, 330].forEach((freq) => {
      const g = gain(ctx, vol * 0.15, 0.6, now + 0.25);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, now + 0.25);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1500;
      f.Q.value = 2;
      o.connect(f);
      f.connect(g);
      o.start(now + 0.25);
      o.stop(now + 0.85);
    });
    addReverb(ctx, g1, 0.05, 0.3, 0.2);
  } catch { /* audio not available */ }
}

/**
 * Triumphant victory fanfare — brass-like chord progression
 */
export function playVictory(vol = 0.22) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Fanfare: C5 → E5 → G5 → C6 (major chord arpeggio)
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = now + i * 0.12;
      // Oscillator 1: bright saw
      const g1 = gain(ctx, vol * (1 - i * 0.1), 0.5, t);
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(freq, t);
      o1.connect(g1);
      o1.start(t);
      o1.stop(t + 0.5);
      // Oscillator 2: warm triangle (unison)
      const g2 = gain(ctx, vol * 0.4, 0.5, t);
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(freq * 1.005, t); // slight detune for richness
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + 0.5);
    });
    // Bass pad underneath
    const bg = gain(ctx, vol * 0.6, 0.8, now);
    const bOsc = ctx.createOscillator();
    bOsc.type = 'sine';
    bOsc.frequency.setValueAtTime(262, now);
    bOsc.connect(bg);
    bOsc.start(now);
    bOsc.stop(now + 0.8);
    // Shimmer noise
    const ng = gain(ctx, vol * 0.15, 0.6, now);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 6000;
    const nBuf = Math.floor(ctx.sampleRate * 0.6);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nf);
    nf.connect(ng);
    nSrc.start(now);
    nSrc.stop(now + 0.6);
    addReverb(ctx, bg, 0.06, 0.4, 0.25);
  } catch { /* audio not available */ }
}

/**
 * Sad defeat — descending minor chord with reverb
 */
export function playDefeat(vol = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Minor descending: C5 → Bb4 → Ab4 → G4
    const notes = [523, 466, 415, 392];
    notes.forEach((freq, i) => {
      const t = now + i * 0.18;
      // Layer 1: triangle (mellow)
      const g1 = gain(ctx, vol * (1 - i * 0.1), 0.6, t);
      const o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(freq, t);
      o1.connect(g1);
      o1.start(t);
      o1.stop(t + 0.6);
      // Layer 2: sine sub
      const g2 = gain(ctx, vol * 0.3, 0.5, t);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(freq * 0.5, t);
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + 0.5);
    });
    // Low rumble
    const rg = gain(ctx, vol * 0.4, 0.8, now);
    const rOsc = ctx.createOscillator();
    rOsc.type = 'sine';
    rOsc.frequency.setValueAtTime(40, now);
    rOsc.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    rOsc.connect(rg);
    rOsc.start(now);
    rOsc.stop(now + 0.8);
    addReverb(ctx, rg, 0.08, 0.5, 0.3);
  } catch { /* audio not available */ }
}

/**
 * Draw — clashing swords, neutral energy
 */
export function playDraw(vol = 0.18) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Metallic clash
    const g1 = gain(ctx, vol, 0.3, now);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(440, now);
    o1.frequency.setValueAtTime(880, now + 0.05);
    o1.frequency.setValueAtTime(440, now + 0.1);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 1500;
    f1.Q.value = 8;
    o1.connect(f1);
    f1.connect(g1);
    o1.start(now);
    o1.stop(now + 0.3);
    // Noise burst
    const ng = gain(ctx, vol * 0.5, 0.15, now);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 3000;
    const nBuf = Math.floor(ctx.sampleRate * 0.15);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nf);
    nf.connect(ng);
    nSrc.start(now);
    nSrc.stop(now + 0.15);
    // Resonant tail
    const g2 = gain(ctx, vol * 0.3, 0.4, now + 0.1);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(660, now + 0.1);
    o2.frequency.exponentialRampToValueAtTime(330, now + 0.5);
    o2.connect(g2);
    o2.start(now + 0.1);
    o2.stop(now + 0.5);
  } catch { /* audio not available */ }
}

/**
 * Heal — magical sparkle chime with reverb
 */
export function playHeal(vol = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Ascending sparkle: C5 → E5 → G5 → C6 with harmonics
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = now + i * 0.08;
      // Sine (pure tone)
      const g1 = gain(ctx, vol * 0.7, 0.4, t);
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(freq, t);
      o1.connect(g1);
      o1.start(t);
      o1.stop(t + 0.4);
      // Triangle (warmth)
      const g2 = gain(ctx, vol * 0.3, 0.3, t);
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(freq * 2, t); // octave up
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + 0.3);
    });
    // Sparkle noise
    const ng = gain(ctx, vol * 0.2, 0.4, now);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 8000;
    nf.Q.value = 5;
    const nBuf = Math.floor(ctx.sampleRate * 0.4);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nf);
    nf.connect(ng);
    nSrc.start(now);
    nSrc.stop(now + 0.4);
    addReverb(ctx, gain(ctx, vol * 0.3, 0.5, now), 0.05, 0.35, 0.3);
  } catch { /* audio not available */ }
}

/**
 * Poison — bubbling sinister sound
 */
export function playPoison(vol = 0.18) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Bubbling: rapid frequency-modulated sine
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.08;
      const freq = 150 + Math.random() * 400;
      const g1 = gain(ctx, vol * 0.5, 0.12, t);
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(freq, t);
      o1.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.12);
      o1.connect(g1);
      o1.start(t);
      o1.stop(t + 0.12);
      // FM modulation for bubbling texture
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(freq * 3, t);
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 0.3;
      o2.connect(modGain);
      modGain.connect(o1.frequency);
      o2.start(t);
      o2.stop(t + 0.1);
    }
    // Low ominous drone
    const dg = gain(ctx, vol * 0.4, 0.5, now);
    const dOsc = ctx.createOscillator();
    dOsc.type = 'sawtooth';
    dOsc.frequency.setValueAtTime(55, now);
    dOsc.frequency.setValueAtTime(50, now + 0.3);
    const df = ctx.createBiquadFilter();
    df.type = 'lowpass';
    df.frequency.value = 200;
    dOsc.connect(df);
    df.connect(dg);
    dOsc.start(now);
    dOsc.stop(now + 0.5);
  } catch { /* audio not available */ }
}

/**
 * Life steal — draining vampiric whoosh
 */
export function playLifeSteal(vol = 0.2) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Descending sweep (draining)
    const g1 = gain(ctx, vol, 0.3, now);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(1200, now);
    o1.frequency.exponentialRampToValueAtTime(150, now + 0.3);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f1.frequency.setValueAtTime(3000, now);
    f1.frequency.exponentialRampToValueAtTime(300, now + 0.3);
    o1.connect(f1);
    f1.connect(g1);
    o1.start(now);
    o1.stop(now + 0.3);
    // Sucking noise
    const ng = gain(ctx, vol * 0.4, 0.25, now + 0.05);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(2000, now + 0.05);
    nf.frequency.exponentialRampToValueAtTime(500, now + 0.3);
    nf.Q.value = 3;
    const nBuf = Math.floor(ctx.sampleRate * 0.25);
    const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
    const nd = nBuffer.getChannelData(0);
    for (let i = 0; i < nBuf; i++) nd[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuffer;
    nSrc.connect(nf);
    nf.connect(ng);
    nSrc.start(now + 0.05);
    nSrc.stop(now + 0.3);
    // Final thud (absorbed)
    const g2 = gain(ctx, vol * 0.3, 0.15, now + 0.25);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(120, now + 0.25);
    o2.frequency.exponentialRampToValueAtTime(60, now + 0.4);
    o2.connect(g2);
    o2.start(now + 0.25);
    o2.stop(now + 0.4);
  } catch { /* audio not available */ }
}

/**
 * Ability activation — power-up sparkle with FM synthesis
 */
export function playAbility(vol = 0.18) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    // Rapid ascending arpeggio with harmonics
    const notes = [400, 500, 632, 800, 1000];
    notes.forEach((freq, i) => {
      const t = now + i * 0.05;
      // Main tone
      const g1 = gain(ctx, vol * 0.6, 0.2, t);
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(freq, t);
      o1.connect(g1);
      o1.start(t);
      o1.stop(t + 0.2);
      // FM harmonic
      const g2 = gain(ctx, vol * 0.25, 0.15, t);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(freq * 2.5, t);
      const modG = ctx.createGain();
      modG.gain.value = freq * 0.2;
      o2.connect(modG);
      modG.connect(o1.frequency);
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + 0.15);
      // Sparkle noise burst
      const ng = gain(ctx, vol * 0.2, 0.08, t);
      const nBuf = Math.floor(ctx.sampleRate * 0.08);
      const nBuffer = ctx.createBuffer(1, nBuf, ctx.sampleRate);
      const nd = nBuffer.getChannelData(0);
      for (let j = 0; j < nBuf; j++) nd[j] = Math.random() * 2 - 1;
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = nBuffer;
      nSrc.connect(ng);
      nSrc.start(t);
      nSrc.stop(t + 0.08);
    });
    // Sustained shimmer pad
    const sg = gain(ctx, vol * 0.3, 0.4, now + 0.2);
    const sOsc = ctx.createOscillator();
    sOsc.type = 'triangle';
    sOsc.frequency.setValueAtTime(1000, now + 0.2);
    sOsc.frequency.exponentialRampToValueAtTime(1500, now + 0.5);
    sOsc.connect(sg);
    sOsc.start(now + 0.2);
    sOsc.stop(now + 0.6);
    addReverb(ctx, sg, 0.04, 0.3, 0.25);
  } catch { /* audio not available */ }
}
