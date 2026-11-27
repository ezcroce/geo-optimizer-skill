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
  lmg: () => { noise(0.26, 1500, 0.75, 0.6, 'lowpass', 0, 0.28); tone(115, 0.11, 0.32, 'sawtooth', 0, 45); },
  doublebarrel: () => { noise(0.55, 800, 0.6, 0.95, 'lowpass', 0, 0.5); tone(80, 0.24, 0.5, 'square', 0, 35); noise(0.05, 4000, 2, 0.15, 'bandpass', 0.3); },
  handcannon: () => { noise(0.42, 1300, 0.7, 0.85, 'lowpass', 0, 0.42); tone(100, 0.16, 0.45, 'square', 0, 40); },
  crossbow: () => { tone(230, 0.1, 0.25, 'triangle', 0, 95); noise(0.07, 3200, 2, 0.16, 'bandpass'); tone(140, 0.06, 0.12, 'square', 0.03, 60); },
  grenade: () => { noise(0.3, 500, 0.6, 0.5, 'lowpass', 0, 0.3); tone(160, 0.12, 0.42, 'sine', 0, 55); },
  silenced: () => { noise(0.06, 2200, 1.2, 0.16, 'bandpass'); tone(300, 0.03, 0.07, 'square', 0, 150); },
  minigun: () => { noise(0.06, 2600, 0.8, 0.34); tone(170, 0.05, 0.16, 'sawtooth', 0, 90); },
  spin: () => { tone(90, 0.5, 0.12, 'sawtooth', 0, 420); noise(0.5, 1800, 4, 0.08, 'bandpass', 0, 0.5); },
  melee: () => { noise(0.12, 4000, 1.5, 0.25, 'bandpass'); },
  // v38: Gargoyle e Artigli
  claw: () => { noise(0.2, 3200, 1.1, 0.42, 'bandpass', 0, 0.2); noise(0.14, 6500, 2, 0.16, 'bandpass', 0.05, 0.12); tone(420, 0.12, 0.06, 'sawtooth', 0, 180); },
  clawHeavy: () => { noise(0.32, 2200, 0.9, 0.55, 'bandpass', 0, 0.3); tone(160, 0.22, 0.18, 'sawtooth', 0, 70); },
  slam: () => { noise(0.9, 320, 0.6, 0.9, 'lowpass', 0, 0.85); tone(55, 0.6, 0.6, 'sine', 0, 28); noise(0.25, 1600, 0.8, 0.3, 'bandpass', 0.02, 0.2); },
  roar: () => {
    noise(1.9, 520, 1.6, 0.55, 'bandpass', 0, 1.8); noise(1.6, 1300, 2.2, 0.25, 'bandpass', 0.1, 1.5);
    tone(150, 1.7, 0.32, 'sawtooth', 0, 70); tone(112, 1.8, 0.28, 'sawtooth', 0.05, 52); tone(225, 1.2, 0.12, 'square', 0.08, 120);
  },
  growl: () => { tone(92, 0.7, 0.2, 'sawtooth', 0, 70); noise(0.7, 380, 2, 0.22, 'bandpass', 0, 0.7); },
  flap: () => { noise(0.22, 260, 0.8, 0.5, 'lowpass', 0, 0.2); },
  bossHurt: () => { tone(260, 0.25, 0.2, 'sawtooth', 0, 140); noise(0.25, 900, 1.5, 0.25, 'bandpass', 0, 0.22); },
  bossDie: () => { tone(180, 2.4, 0.35, 'sawtooth', 0, 40); tone(130, 2.6, 0.3, 'sawtooth', 0.1, 32); noise(2.5, 600, 1.4, 0.45, 'bandpass', 0, 2.4); },
};

// volume in base alla distanza dall'ascoltatore
let gunWin = 0, gunCount = 0;
export function playGun(kind, dist = 0) {
  if (!ctx) return;
  const att = Math.max(0, 1 - dist / (kind === 'roar' || kind === 'bossDie' ? 320 : 160));
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
/** v41: esegue `fn` con l'uscita attenuata (vol) e posizionata a destra/sinistra (pan -1..1) */
function routed(vol, pan, fn) {
  const g = ctx.createGain();
  g.gain.value = vol;
  let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(master);
  const old = master; master = g;
  try { fn(); } finally { master = old; }
}
// v41: passi diversi per superficie (erba, pietra/asfalto, legno, metallo, neve, sabbia, acqua),
// attenuati con la distanza e posizionati a destra/sinistra: senti chi si avvicina e da dove
const STEP = {
  grass: () => { noise(0.07, 650, 0.7, 0.1, 'lowpass', 0, 0.06); noise(0.05, 3200, 1.2, 0.025, 'bandpass', 0.01, 0.04); },
  stone: () => { noise(0.035, 2200, 1.6, 0.11, 'bandpass', 0, 0.03); tone(140, 0.04, 0.05, 'sine', 0, 90); noise(0.02, 5200, 2, 0.03, 'highpass', 0.005, 0.02); },
  wood: () => { tone(190 + Math.random() * 30, 0.07, 0.11, 'triangle', 0, 110); noise(0.05, 900, 2, 0.08, 'bandpass', 0, 0.045); },
  metal: () => { tone(620 + Math.random() * 80, 0.12, 0.035, 'square', 0, 540); tone(1240, 0.08, 0.025, 'sine', 0.004); noise(0.04, 2600, 3, 0.07, 'bandpass', 0, 0.035); },
  snow: () => { noise(0.13, 1500, 0.8, 0.07, 'bandpass', 0, 0.12); noise(0.1, 420, 0.8, 0.06, 'lowpass', 0.02, 0.09); },
  sand: () => { noise(0.11, 2400, 0.6, 0.05, 'bandpass', 0, 0.1); noise(0.07, 500, 0.8, 0.05, 'lowpass', 0, 0.06); },
  water: () => { noise(0.16, 900, 0.9, 0.09, 'lowpass', 0, 0.14); noise(0.1, 2600, 1.3, 0.035, 'bandpass', 0.03, 0.08); },
};
let stepWin = 0, stepCount = 0;
export function playStep(surf = 'grass', dist = 0, pan = 0, loud = 1) {
  if (!ctx) return;
  const att = Math.max(0, 1 - dist / 38);
  if (att <= 0.02) return;
  if (dist > 0) {   // al massimo 5 passi altrui ogni 120 ms
    if (ctx.currentTime - stepWin > 0.12) { stepWin = ctx.currentTime; stepCount = 0; }
    if (++stepCount > 5) return;
  }
  // i passi degli altri sono un po' più forti dei tuoi: devono farsi notare
  routed(att * att * loud * (dist > 0 ? 1.6 : 1), pan, STEP[surf] || STEP.grass);
}
const att3 = (d, far) => { const a = Math.max(0, 1 - d / far); return a * a; };
/** v41: lancio di un oggetto (fruscio + scatto della sicura) */
export function playThrow(dist = 0) { if (!ctx) return; const a = att3(dist, 60); if (a < 0.01) return; routed(a, 0, () => { tone(1800, 0.03, 0.08, 'square'); noise(0.2, 1400, 0.8, 0.18, 'bandpass', 0.04, 0.18); }); }
/** rimbalzo metallico della granata */
export function playBounce(dist = 0, k = 1) { if (!ctx) return; const a = att3(dist, 45) * (0.4 + 0.6 * k); if (a < 0.01) return; routed(a, 0, () => { tone(900 + Math.random() * 300, 0.06, 0.12, 'triangle', 0, 600); noise(0.04, 2400, 2, 0.12, 'bandpass'); }); }
/** fumogeno: sibilo che si apre */
export function playSmoke(dist = 0) { if (!ctx) return; const a = att3(dist, 80); if (a < 0.01) return; routed(a, 0, () => { tone(2200, 0.05, 0.06, 'square'); noise(2.2, 3200, 0.5, 0.25, 'highpass', 0.05, 2.1); noise(1.6, 900, 0.6, 0.18, 'lowpass', 0.05, 1.5); }); }
/** granata a impulso: "wub" elettrico con risucchio */
export function playImpulse(dist = 0) { if (!ctx) return; const a = att3(dist, 120); if (a < 0.01) return; routed(a, 0, () => { tone(90, 0.5, 0.5, 'sine', 0, 420); tone(420, 0.35, 0.18, 'sawtooth', 0, 1400); noise(0.5, 1800, 0.9, 0.3, 'bandpass', 0, 0.45); tone(1600, 0.25, 0.08, 'sine', 0.05, 2600); }); }
/** segnalazione dei compagni */
export function playPing(kind = 'go') {
  if (!ctx) return;
  if (kind === 'enemy') { tone(1250, 0.09, 0.17, 'triangle'); tone(1250, 0.09, 0.17, 'triangle', 0.12); }
  else if (kind === 'danger') { tone(700, 0.12, 0.18, 'square', 0, 520); tone(700, 0.12, 0.14, 'square', 0.15, 520); }
  else if (kind === 'loot') { tone(990, 0.08, 0.14, 'triangle'); tone(1480, 0.14, 0.14, 'triangle', 0.08); }
  else { tone(880, 0.07, 0.15, 'sine'); tone(1320, 0.16, 0.13, 'sine', 0.07); }
}
/** bracciata in acqua (sciabordio morbido) */
export function playSwim() { noise(0.28, 700, 0.9, 0.12, 'lowpass', 0, 0.26); noise(0.18, 1800, 1.2, 0.05, 'bandpass', 0.08, 0.16); }
/** tuffo / caduta in acqua */
export function playSplash(k = 1) { noise(0.6, 900, 0.7, 0.35 * k, 'lowpass', 0, 0.55); noise(0.35, 2600, 1, 0.12 * k, 'bandpass', 0.05, 0.3); tone(140, 0.18, 0.12 * k, 'sine', 0, 60); }
/** porta: cigolio + battuta */
export function playDoor(open = true, vol = 1) {
  if (open) { tone(420, 0.32, 0.05 * vol, 'sawtooth', 0, 610); tone(300, 0.25, 0.04 * vol, 'triangle', 0.05, 380); noise(0.06, 900, 1, 0.12 * vol, 'lowpass'); }
  else { noise(0.12, 380, 1, 0.45 * vol, 'lowpass', 0.18); tone(110, 0.12, 0.25 * vol, 'sine', 0.18, 70); tone(380, 0.2, 0.03 * vol, 'sawtooth', 0, 300); }
}
export function playUI() { tone(880, 0.05, 0.12, 'triangle'); }
/** v22: suoni dell'inventario (zaino che si apre/chiude, oggetto spostato, gettato, selezione) */
export function playInv(kind) {
  if (kind === 'open') { noise(0.16, 900, 0.8, 0.14, 'bandpass', 0, 0.14); tone(420, 0.07, 0.07, 'triangle', 0.04, 620); }
  else if (kind === 'close') { noise(0.12, 700, 0.8, 0.12, 'bandpass', 0, 0.1); tone(560, 0.06, 0.06, 'triangle', 0.02, 380); }
  else if (kind === 'move') { noise(0.06, 2400, 2, 0.12, 'bandpass'); tone(760, 0.05, 0.08, 'triangle', 0.03); }
  else if (kind === 'drop') { noise(0.14, 500, 1, 0.2, 'lowpass', 0, 0.12); tone(220, 0.1, 0.1, 'sine', 0, 120); }
  else tone(1100, 0.03, 0.06, 'triangle');
}
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

// ─────────────── v42: movimento, impatti per materiale, trappole e trampolini, rianimazioni ───────────────
/** scivolata: strisciata sul terreno (più ruvida su pietra e legno) */
export function playSlide(surf = 'grass', dist = 0) {
  if (!ctx) return; const a = att3(dist, 40); if (a < 0.01) return;
  const hard = surf === 'stone' || surf === 'wood' || surf === 'metal';
  routed(a, 0, () => { noise(0.62, hard ? 2600 : 1300, 0.7, hard ? 0.24 : 0.3, hard ? 'bandpass' : 'lowpass', 0, 0.6); noise(0.3, 600, 0.8, 0.12, 'lowpass', 0.02, 0.28); });
}
/** scavalcamento: fruscio dei vestiti e mani che battono sul bordo */
export function playVault(dist = 0) {
  if (!ctx) return; const a = att3(dist, 35); if (a < 0.01) return;
  routed(a, 0, () => { noise(0.07, 900, 1.2, 0.3, 'lowpass'); noise(0.25, 2400, 0.7, 0.12, 'bandpass', 0.04, 0.22); noise(0.06, 700, 1.4, 0.22, 'lowpass', 0.22); });
}
/** proiettile che colpisce una superficie: pietra (schiocco secco), metallo (rimbalzo che fischia), legno (tonfo), terra (soffice) */
export function playImpact(mat = 'stone', dist = 0) {
  if (!ctx) return; const a = att3(dist, 30); if (a < 0.02) return;
  routed(a, 0, () => {
    if (mat === 'metal') { tone(1800 + Math.random() * 900, 0.16, 0.12, 'triangle', 0, 900 + Math.random() * 500); noise(0.04, 5200, 2, 0.14, 'bandpass'); if (Math.random() < 0.35) tone(2600 + Math.random() * 1200, 0.32, 0.05, 'sine', 0.02, 1400); }
    else if (mat === 'wood') { noise(0.07, 700, 1.5, 0.26, 'bandpass'); tone(210, 0.06, 0.1, 'triangle', 0, 140); }
    else if (mat === 'stone') { noise(0.05, 3200, 1.4, 0.24, 'bandpass'); noise(0.18, 1200, 0.6, 0.07, 'lowpass', 0.02, 0.16); }
    else if (mat === 'glass') { tone(3200, 0.12, 0.08, 'sine', 0, 2400); noise(0.15, 6000, 1, 0.14, 'highpass'); }
    else noise(0.09, 600, 0.8, 0.2, 'lowpass');
  });
}
/** trampolino di lancio: molla e sibilo verso l'alto */
export function playLaunch(dist = 0) {
  if (!ctx) return; const a = att3(dist, 70); if (a < 0.01) return;
  routed(a, 0, () => { tone(120, 0.25, 0.4, 'sine', 0, 520); tone(320, 0.5, 0.16, 'sawtooth', 0.03, 1800); noise(0.7, 2200, 0.6, 0.2, 'bandpass', 0.05, 0.65); });
}
/** trappola che scatta: lame metalliche */
export function playTrap(dist = 0) {
  if (!ctx) return; const a = att3(dist, 50); if (a < 0.01) return;
  routed(a, 0, () => { noise(0.05, 4200, 1.5, 0.35, 'bandpass'); tone(1400, 0.12, 0.14, 'square', 0, 500); tone(2600, 0.25, 0.06, 'triangle', 0.03, 2000); noise(0.2, 900, 0.8, 0.18, 'lowpass', 0.04, 0.18); });
}
/** oggetto piazzato (trampolino, trappola) */
export function playPlace(dist = 0) { if (!ctx) return; const a = att3(dist, 40); if (a < 0.01) return; routed(a, 0, () => { noise(0.08, 1100, 1.2, 0.3, 'bandpass'); tone(260, 0.08, 0.14, 'square', 0.02, 180); tone(900, 0.06, 0.08, 'triangle', 0.09); }); }
/** battito del cuore quando la salute è bassa */
export function playHeartbeat(k = 1) { if (!ctx) return; tone(58, 0.11, 0.32 * k, 'sine', 0, 44); tone(52, 0.13, 0.24 * k, 'sine', 0.17, 40); }
