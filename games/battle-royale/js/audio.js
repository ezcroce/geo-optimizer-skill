// Suoni sintetizzati con la Web Audio API (nessun file esterno)
let ctx = null;
let master = null;
let noiseBuf = null;
let stormNode = null;
let stormGain = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volK;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

let volK = 0.5, ambK = 1;
export function setVolume(v) { volK = v; if (master) master.gain.value = v; }
/** volume dei suoni d'ambiente (vento, tempesta), 0–1 */
export function setAmbience(v) { ambK = v; }

function noise(dur, freq, q, vol, type = 'lowpass', when = 0, decay = dur) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(freq, dur, vol, type = 'sine', when = 0, endFreq = null) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

const GUN = {
  pistol: () => { noise(0.18, 2400, 0.8, 0.55); tone(180, 0.08, 0.3, 'square', 0, 60); },
  smg: () => { noise(0.1, 3000, 0.7, 0.4); tone(220, 0.05, 0.18, 'square', 0, 80); },
  ar: () => { noise(0.22, 1800, 0.8, 0.55); tone(140, 0.1, 0.3, 'sawtooth', 0, 50); },
  shotgun: () => { noise(0.45, 900, 0.6, 0.85, 'lowpass', 0, 0.4); tone(90, 0.2, 0.45, 'square', 0, 40); },
  sniper: () => { noise(0.7, 1400, 0.6, 0.9, 'lowpass', 0, 0.7); tone(110, 0.3, 0.5, 'sawtooth', 0, 35); },
  rocket: () => { noise(0.6, 600, 0.5, 0.6, 'bandpass', 0, 0.6); tone(300, 0.5, 0.2, 'sawtooth', 0, 90); },
  revolver: () => { noise(0.35, 1500, 0.7, 0.75, 'lowpass', 0, 0.38); tone(120, 0.14, 0.4, 'square', 0, 45); noise(0.05, 5000, 2, 0.2, 'bandpass', 0.16); },
  compact: () => { noise(0.07, 3600, 0.8, 0.32); tone(260, 0.04, 0.14, 'square', 0, 110); },
  heavyar: () => { noise(0.28, 1400, 0.7, 0.65, 'lowpass', 0, 0.3); tone(105, 0.12, 0.36, 'sawtooth', 0, 40); },
  dmr: () => { noise(0.4, 1100, 0.6, 0.6, 'lowpass', 0, 0.42); tone(150, 0.16, 0.25, 'sawtooth', 0, 45); noise(0.04, 4200, 2, 0.15, 'bandpass', 0.05); },
  tactical: () => { noise(0.36, 1000, 0.6, 0.75, 'lowpass', 0, 0.32); tone(100, 0.15, 0.4, 'square', 0, 45); },
  hunting: () => { noise(0.8, 1200, 0.5, 0.9, 'lowpass', 0, 0.8); tone(95, 0.35, 0.5, 'sawtooth', 0, 30); noise(0.06, 3000, 3, 0.25, 'bandpass', 0.55); tone(700, 0.04, 0.08, 'square', 0.6, 400); },
  burst: () => { noise(0.16, 2000, 0.8, 0.5); tone(150, 0.08, 0.28, 'sawtooth', 0, 55); },
  drum: () => { noise(0.3, 950, 0.6, 0.7, 'lowpass', 0, 0.28); tone(95, 0.12, 0.36, 'square', 0, 45); },
  minigun: () => { noise(0.06, 2600, 0.8, 0.34); tone(170, 0.05, 0.16, 'sawtooth', 0, 90); },
  spin: () => { tone(90, 0.5, 0.12, 'sawtooth', 0, 420); noise(0.5, 1800, 4, 0.08, 'bandpass', 0, 0.5); },
  melee: () => { noise(0.12, 4000, 1.5, 0.25, 'bandpass'); },
};

// volume in base alla distanza dall'ascoltatore
let gunWin = 0, gunCount = 0;
export function playGun(kind, dist = 0) {
  if (!ctx) return;
  const att = Math.max(0, 1 - dist / 160);
  if (att <= 0.02) return;
  // con 100 giocatori: al massimo 4 spari altrui ogni 60 ms (evita la saturazione)
  if (dist > 0) {
    if (ctx.currentTime - gunWin > 0.06) { gunWin = ctx.currentTime; gunCount = 0; }
    if (++gunCount > 4) return;
  }
  const saved = master.gain.value;
  const g = ctx.createGain();
  g.gain.value = att * att;
  // rerouting temporaneo
  const oldMaster = master;
  master = g; g.connect(oldMaster);
  (GUN[kind] || GUN.pistol)();
  master = oldMaster;
  void saved;
}

export function playExplosion(dist = 0) {
  if (!ctx) return;
  const att = Math.max(0, 1 - dist / 220);
  if (att <= 0.02) return;
  noise(1.4, 400, 0.5, 1.0 * att, 'lowpass', 0, 1.3);
  tone(60, 0.8, 0.6 * att, 'sine', 0, 25);
}

export function playHit(head = false) {
  tone(head ? 1800 : 1200, 0.07, 0.25, 'triangle');
  if (head) tone(2600, 0.09, 0.15, 'sine', 0.03);
}
export function playShieldHit() { tone(900, 0.08, 0.2, 'triangle', 0, 1400); }
export function playHurt() { noise(0.15, 500, 1, 0.4, 'lowpass'); tone(160, 0.15, 0.25, 'sine', 0, 90); }
export function playPickup() { tone(660, 0.08, 0.2, 'triangle'); tone(990, 0.12, 0.2, 'triangle', 0.07); }
export function playReload() { noise(0.05, 3500, 3, 0.3, 'bandpass'); noise(0.05, 2500, 3, 0.3, 'bandpass', 0.25); }
export function playEmpty() { tone(1500, 0.03, 0.15, 'square'); }
export function playKill() { tone(520, 0.1, 0.25, 'triangle'); tone(780, 0.1, 0.25, 'triangle', 0.08); tone(1040, 0.2, 0.25, 'triangle', 0.16); }
export function playBuild() { noise(0.12, 1200, 1.2, 0.4, 'bandpass'); tone(200, 0.1, 0.2, 'square', 0, 120); }
export function playHeal() { tone(500, 0.3, 0.15, 'sine', 0, 900); }
export function playChest() { for (let i = 0; i < 4; i++) tone(700 + i * 220, 0.18, 0.15, 'triangle', i * 0.07); }
export function playStep() { noise(0.05, 300, 1, 0.08, 'lowpass'); }
export function playUI() { tone(880, 0.05, 0.12, 'triangle'); }
export function playVictory() {
  const n = [523, 659, 784, 1046, 784, 1046];
  n.forEach((f, i) => tone(f, 0.35, 0.22, 'triangle', i * 0.16));
}
export function playDefeat() { [392, 330, 262].forEach((f, i) => tone(f, 0.45, 0.22, 'sawtooth', i * 0.25)); }
export function playWind(intensity) {
  if (!ctx) return;
  if (ambK <= 0) return;
  noise(0.3, 500 + intensity * 600, 0.4, 0.06 * intensity * ambK, 'bandpass');
}

export function setStormSound(level) {
  if (!ctx) return;
  if (!stormNode) {
    stormNode = ctx.createBufferSource();
    stormNode.buffer = noiseBuf; stormNode.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
    stormGain = ctx.createGain(); stormGain.gain.value = 0;
    stormNode.connect(f); f.connect(stormGain); stormGain.connect(master);
    stormNode.start();
  }
  stormGain.gain.setTargetAtTime(level * 0.5 * ambK, ctx.currentTime, 0.3);
}

/** sibilo di un proiettile che passa vicino (rumore filtrato con frequenza che scende) */
let lastWhiz = 0;
export function playWhiz() {
  if (!ctx || ctx.currentTime - lastWhiz < 0.08) return;
  lastWhiz = ctx.currentTime;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 6;
  const f0 = 2600 + Math.random() * 1400;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; src.connect(f); f.connect(g); g.connect(pan); pan.connect(master); }
  else { src.connect(f); f.connect(g); g.connect(master); }
  src.start(t, Math.random() * 0.5, 0.25);
}
