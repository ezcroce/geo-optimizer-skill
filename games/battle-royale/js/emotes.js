// ─────────────────────────────────────────────────────────────
//  v39: balletti (emote) a fotogrammi chiave
//   · ogni balletto è una coreografia: pose chiave su TUTTE le articolazioni (anche, ginocchia,
//     caviglie, bacino, busto, testa, spalle, gomiti, polsi) scandite a tempo di musica (battiti)
//   · fra una posa e l'altra interpolazione di Hermite (Catmull-Rom a passo variabile): movimenti
//     continui, senza scatti; il «robot» invece usa scatti netti e pause, come si deve
//   · i piedi restano appoggiati (il bacino scende quando le ginocchia si piegano, le gambe si
//     inclinano quando il bacino ondeggia), salti veri nell'esultanza
//   · azione sovrapposta: mani e testa seguono il corpo con un piccolo ritardo
// ─────────────────────────────────────────────────────────────
import { footContact } from './anim.js?v=45';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

/** elenco dei balletti (id, nome, icona, durata in secondi) */
export const EMOTES = [
  { id: 'ballo', name: 'Ballo disco', icon: '🕺', dur: 6.2 },
  { id: 'saluto', name: 'Saluto', icon: '👋', dur: 2.8 },
  { id: 'floss', name: 'Floss', icon: '💃', dur: 4.6 },
  { id: 'tifo', name: 'Esultanza', icon: '🙌', dur: 3.0 },
  { id: 'robot', name: 'Robot', icon: '🤖', dur: 5.2 },
  { id: 'running', name: 'Running man', icon: '🏃', dur: 4.8 },
];

// ───────────── canali di una posa ─────────────
//  corpo: by (salto, m) bx (bacino di lato, m) ry (giro) rz (rollio) rx (beccheggio)
//  busto: tx (avanti +) ty (torsione) tz (piega di lato) · testa: hx (giù +) hy hz
//  per lato (R = destro, L = sinistro):
//   gamba: lh (anca, avanti −) ls (apertura, fuori +) lk (ginocchio, piegato +) lf (punta del piede, giù +)
//   braccio: ax (spalla, avanti/su −) az (apertura, fuori +) ay (rotazione) ae (gomito, piegato +)
//            wx (polso, su/giù) wz (polso di lato)
const SIDE = ['lh', 'ls', 'lk', 'lf', 'ax', 'az', 'ay', 'ae', 'wx', 'wz'];
const CH = ['by', 'bx', 'ry', 'rz', 'rx', 'tx', 'ty', 'tz', 'hx', 'hy', 'hz', ...SIDE.map(s => s + 'R'), ...SIDE.map(s => s + 'L')];
const NC = CH.length, IX = Object.fromEntries(CH.map((c, i) => [c, i]));
const LAG = new Set(['wxR', 'wzR', 'wxL', 'wzL', 'hx', 'hy', 'hz'].map(c => IX[c]));
const NEUTRAL = (() => {
  const v = new Float32Array(NC);
  const set = (o) => { for (const k in o) v[IX[k]] = o[k]; };
  set({ axR: 0.05, axL: 0.05, azR: 0.1, azL: 0.1, aeR: 0.18, aeL: 0.18, lkR: 0.04, lkL: 0.04, lsR: 0.03, lsL: 0.03 });
  return v;
})();

/**
 * coreografia: elenco di [battito, {canali}] (ogni posa eredita dalla precedente quello che non cambia;
 * i nomi «R»/«L» si possono abbreviare con «2» = stesso valore sui due lati)
 */
function choreo(list, { loop = 0, snap = false } = {}) {
  const keys = []; let prev = NEUTRAL;
  for (const [b, o] of list) {
    const v = Float32Array.from(prev);
    for (const k in o) {
      if (k.endsWith('2')) { const base = k.slice(0, -1); v[IX[base + 'R']] = o[k]; v[IX[base + 'L']] = o[k]; }
      else if (IX[k] !== undefined) v[IX[k]] = o[k];
      else throw new Error('canale sconosciuto ' + k);
    }
    keys.push({ b, v }); prev = v;
  }
  if (loop) keys.push({ b: keys[0].b + loop, v: keys[0].v });
  return { keys, loop, snap };
}

const _o = new Float32Array(NC);
/** campiona una coreografia al battito b (Hermite a passo variabile, oppure scatti per il robot) */
function sample(C, b, out = _o) {
  const K = C.keys, n = K.length;
  if (C.loop) { const b0 = K[0].b; b = b0 + (((b - b0) % C.loop) + C.loop) % C.loop; }
  if (b <= K[0].b) { out.set(K[0].v); return out; }
  if (b >= K[n - 1].b) { out.set(K[n - 1].v); return out; }
  let i = 0; while (i < n - 2 && K[i + 1].b <= b) i++;
  const k1 = K[i], k2 = K[i + 1];
  const k0 = i > 0 ? K[i - 1] : C.loop ? { b: K[n - 2].b - C.loop, v: K[n - 2].v } : k1;
  const k3 = i + 2 < n ? K[i + 2] : C.loop ? { b: K[1].b + C.loop, v: K[1].v } : k2;
  const dt = k2.b - k1.b, u = (b - k1.b) / dt;
  if (C.snap) {   // scatto rapido (primo 35% del tempo) e poi fermo, con un minimo rimbalzo meccanico
    const s = smooth(u / 0.35), o = u < 0.5 ? Math.sin(clamp((u - 0.35) / 0.15, 0, 1) * Math.PI) * 0.04 : 0;
    for (let c = 0; c < NC; c++) out[c] = k1.v[c] + (k2.v[c] - k1.v[c]) * (s + o);
    return out;
  }
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d0 = Math.max(1e-3, k2.b - k0.b), d1 = Math.max(1e-3, k3.b - k1.b);
  for (let c = 0; c < NC; c++) {
    const m1 = (k2.v[c] - k0.v[c]) / d0 * dt * 0.9, m2 = (k3.v[c] - k1.v[c]) / d1 * dt * 0.9;
    out[c] = h00 * k1.v[c] + h10 * m1 + h01 * k2.v[c] + h11 * m2;
  }
  return out;
}

// ═════════════════════════ COREOGRAFIE ═════════════════════════
// mano sul fianco (destra; la sinistra è speculare)
const HIP_R = { axR: 0.35, azR: 0.75, ayR: -1.25, aeR: 1.75, wxR: 0.2 };
const HIP_L = { axL: 0.35, azL: 0.75, ayL: -1.25, aeL: 1.75, wxL: 0.2 };

/** Ballo disco (Saturday Night Fever): indice in alto a destra / in basso a sinistra, poi il rullo
 *  delle braccia, il passo laterale con il bacino e la posa finale */
const BALLO = {
  bpm: 112,
  C: choreo([
    [0, { ...HIP_L, azR: 2.35, axR: -0.35, ayR: 0.2, aeR: 0.06, wxR: -0.2, tz: -0.1, ty: -0.15, bx: -0.05, hy: -0.45, hx: -0.3, lkR: 0.35, lfR: 0.35, lhR: -0.12, lsR: 0.1 }],
    [1, { azR: -0.5, axR: -0.55, ayR: -0.3, aeR: 0.12, wxR: 0.15, tz: 0.12, ty: 0.32, bx: 0.06, hy: 0.4, hx: 0.32, lkR: 0.05, lfR: 0, lhR: 0, lkL: 0.35, lfL: 0.35, lhL: -0.12 }],
    [2, { azR: 2.35, axR: -0.35, ayR: 0.2, aeR: 0.06, wxR: -0.2, tz: -0.1, ty: -0.15, bx: -0.05, hy: -0.45, hx: -0.3, lkR: 0.35, lfR: 0.35, lhR: -0.12, lkL: 0.05, lfL: 0, lhL: 0 }],
    [3, { azR: -0.5, axR: -0.55, ayR: -0.3, aeR: 0.12, wxR: 0.15, tz: 0.12, ty: 0.32, bx: 0.06, hy: 0.4, hx: 0.32, lkR: 0.05, lfR: 0, lhR: 0, lkL: 0.35, lfL: 0.35, lhL: -0.12 }],
    // rullo: avambracci che girano uno sull'altro davanti al petto, bacino che ondeggia
    [4, { axR: -1.05, azR: 0.15, ayR: 0.5, aeR: 1.75, wxR: 0, axL: -1.05, azL: 0.15, ayL: 0.5, aeL: 1.75, wxL: 0, tz: 0, ty: 0, bx: 0, hy: 0, hx: 0.05, lkR: 0.2, lkL: 0.2, lfR: 0, lfL: 0, lhL: 0, tx: 0.08 }],
    [6, { tx: 0.08 }],
    // passo di lato con le braccia aperte a «V» e il bacino che va fuori
    [6.5, { axR: -0.6, azR: 1.9, ayR: 0, aeR: 0.25, axL: -0.6, azL: 1.9, ayL: 0, aeL: 0.25, wxR: -0.3, wxL: -0.3, bx: 0.08, rz: 0.06, lsL: 0.2, lsR: 0.12, hy: 0.25, hx: -0.15, tx: -0.05 }],
    [7.25, { ...HIP_R, ...HIP_L, bx: -0.04, rz: -0.03, lsL: 0.08, lsR: 0.08, hy: -0.3, hx: -0.05, tx: 0, lkR: 0.3, lfR: 0.3 }],
  ], { loop: 8 }),
  over(b, P, w) {
    const bt = b % 8, beat = (1 - Math.cos(TAU * b)) / 2;   // rimbalzo sulle ginocchia a ogni battito
    P[IX.lkR] += beat * 0.16; P[IX.lkL] += beat * 0.16;
    P[IX.hx] += Math.sin(TAU * b) * 0.05;
    if (bt > 4 && bt < 6.4) {   // il rullo vero e proprio
      const g = smooth((bt - 4) / 0.4) * smooth((6.4 - bt) / 0.4), r = TAU * b;
      P[IX.axR] += Math.sin(r) * 0.32 * g; P[IX.aeR] += Math.cos(r) * 0.35 * g;
      P[IX.axL] += Math.sin(r + Math.PI) * 0.32 * g; P[IX.aeL] += Math.cos(r + Math.PI) * 0.35 * g;
      P[IX.bx] += Math.sin(Math.PI * b) * 0.06 * g; P[IX.rz] += Math.sin(Math.PI * b) * 0.05 * g;
      P[IX.ty] += Math.sin(Math.PI * b) * 0.15 * g;
    }
  },
};

/** Saluto: peso su una gamba, braccio che sale con un piccolo slancio e mano che saluta dal gomito */
const SALUTO = {
  bpm: 100,
  C: choreo([
    [0, {}],
    [0.55, { azR: 1.2, axR: -0.9, aeR: 1.6, ayR: 0.3, bx: 0.03, tz: 0.05, hz: 0.06 }],
    [1.0, { azR: 2.05, axR: -0.45, aeR: 1.25, ayR: -0.1, wxR: -0.25, bx: 0.06, tz: -0.08, ty: -0.12, hz: 0.16, hy: -0.18, hx: -0.08, lkR: 0.28, lfR: 0.22, lhR: -0.08, lsL: 0.1, aeL: 0.3, azL: 0.15 }],
    [3.6, { azR: 2.0, axR: -0.45, aeR: 1.3 }],
    [4.4, { azR: 0.4, axR: -0.2, aeR: 0.5, ayR: 0, wxR: 0, bx: 0.01, tz: 0, ty: 0, hz: 0.04, hy: 0, hx: 0, lkR: 0.06, lfR: 0, lhR: 0, lsL: 0.03 }],
  ]),
  over(b, P) {
    const g = smooth((b - 0.9) / 0.3) * smooth((3.7 - b) / 0.4), s = Math.sin(TAU * 1.45 * (b - 0.9));
    P[IX.ayR] += s * 0.55 * g;                 // l'avambraccio oscilla (rotazione dell'omero)
    P[IX.wzR] += Math.sin(TAU * 1.45 * (b - 0.9) - 0.9) * 0.35 * g;
    P[IX.aeR] += Math.abs(s) * 0.12 * g;
    P[IX.hz] += s * 0.05 * g; P[IX.tz] += s * 0.025 * g;
  },
};

/** Floss: braccia tese che vanno da un lato all'altro alternando davanti/dietro, fianchi opposti */
const FLOSS = {
  bpm: 132,
  C: choreo([[0, { aeR: 0.06, aeL: 0.06, lkR: 0.18, lkL: 0.18, tx: 0.04 }]], {}),
  over(b, P, w) {
    const ph = Math.PI * b, s = Math.sin(ph), c = Math.cos(ph);
    const f = clamp(c * 2.2, -1, 1);                 // davanti/dietro: si scambiano agli estremi
    const th = 0.95 * s;                             // braccia verso sinistra (+) o destra (−)
    P[IX.azL] = 0.12 + th; P[IX.azR] = 0.12 - th;
    P[IX.axR] = -0.62 * f; P[IX.axL] = 0.62 * f;
    P[IX.ayR] = -0.25 * f; P[IX.ayL] = 0.25 * f;
    P[IX.wzR] = -s * 0.3; P[IX.wzL] = s * 0.3;
    P[IX.bx] = -0.11 * Math.sin(ph - 0.25);         // fianchi dalla parte opposta, un filo in ritardo
    P[IX.rz] = 0.09 * Math.sin(ph - 0.25);
    P[IX.tz] = -0.1 * s; P[IX.ty] = 0.12 * f;
    const kb = (1 - Math.cos(TAU * b)) / 2;
    P[IX.lkR] = 0.12 + kb * 0.16 + Math.max(0, -s) * 0.1; P[IX.lkL] = 0.12 + kb * 0.16 + Math.max(0, s) * 0.1;
    P[IX.lfR] = Math.max(0, -s) * 0.12; P[IX.lfL] = Math.max(0, s) * 0.12;
    P[IX.hz] = s * 0.12; P[IX.hy] = -s * 0.15; P[IX.hx] = 0.05 + kb * 0.05;
  },
};

/** Esultanza: caricamento, salto con le braccia a «V», atterraggio morbido, pugno che pompa */
const TIFO = {
  bpm: 110,
  C: choreo([
    [0, {}],
    [0.55, { lh2: -0.62, lk2: 1.15, lf2: 0.1, tx: 0.42, hx: -0.3, ax2: 0.55, az2: 0.25, ae2: 0.55, wx2: 0.3 }],
    [0.9, { by: 0.28, lh2: -0.15, lk2: 0.25, lf2: 0.55, tx: -0.12, hx: -0.4, ax2: -0.35, az2: 2.45, ae2: 0.12, ay2: 0.2, wx2: -0.3 }],
    [1.35, { by: 0.52, lh2: -0.75, lk2: 1.25, lf2: 0.2, tx: -0.05, az2: 2.65, ax2: -0.3 }],
    [1.8, { by: 0, lh2: -0.55, lk2: 1.05, lf2: 0, tx: 0.3, hx: 0.1, az2: 1.4, ax2: -0.9, ae2: 1.0 }],
    [2.4, { lh2: -0.2, lk2: 0.35, tx: 0.05, hx: -0.25, azR: 0.5, axR: -2.7, aeR: 1.25, ayR: 0.3, azL: 0.3, axL: -0.3, aeL: 1.6, ayL: -0.6, lhR: -0.15, lkR: 0.25, lhL: 0.1 }],
    [2.85, { azR: 0.45, axR: -1.4, aeR: 2.1, tx: 0.15, hx: 0.0, lk2: 0.45 }],
    [3.3, { azR: 0.5, axR: -2.75, aeR: 1.2, tx: 0.0, hx: -0.3, lk2: 0.25 }],
    [3.75, { azR: 0.45, axR: -1.4, aeR: 2.1, tx: 0.15, hx: 0.0, lk2: 0.45 }],
    [4.2, { azR: 0.5, axR: -2.75, aeR: 1.2, tx: 0.0, hx: -0.3, lk2: 0.25 }],
    [4.6, { azR: 0.5, axR: -2.6, aeR: 1.2 }],
  ]),
  over(b, P) {
    // piccolo balzo a ogni pugno
    if (b > 2.4) { const hop = Math.max(0, Math.sin(TAU * (b - 2.4) / 0.9)); P[IX.by] += hop * 0.1; P[IX.lfL] += hop * 0.3; P[IX.lfR] += hop * 0.3; }
  },
};

/** Robot: scatti netti e pause, braccia ad angolo retto, testa che gira a scatti, piccolo affondo */
const RA = { ax: -1.57, ae: 1.57 };
const ROBOT = {
  bpm: 108,
  C: choreo([
    [0, { axR: -1.57, aeR: 1.57, azR: 0.15, axL: -0.05, aeL: 1.57, azL: 0.15, ayR: 0, ayL: 0, wx2: 0, hy: 0.0, ty: 0, lk2: 0.08 }],
    [1, { axR: -0.05, axL: -1.57, hy: 0.55 }],
    [2, { axR: -1.57, axL: -0.05, hy: -0.55 }],
    [3, { axR: -0.8, aeR: 1.57, axL: -0.8, aeL: 1.57, hy: 0, ty: 0.55, hx: 0.0 }],
    [4, { ty: -0.55 }],
    [5, { ty: 0, az2: 1.57, ax2: 0, ae2: 1.57, ay2: -1.57, lk2: 0.55, lh2: -0.3, hx: 0.15 }],      // braccia ad «U», giù
    [6, { lk2: 0.08, lh2: 0, hx: -0.1, wxR: 0.9, wxL: 0.9 }],
    [6.5, { hz: 0.35, wxR: -0.9, wxL: -0.9 }],
    [7, { hz: -0.35, aeR: 0.2, ayR: 0, azR: 1.57 }],
    [7.5, { hz: 0, aeR: 1.57, ayR: -1.57, hx: 0 }],
  ], { loop: 8, snap: true }),
  over(b, P) {
    // il busto vibra appena quando arriva in posizione (servo che si assesta)
    const u = b % 0.5; P[IX.tx] += Math.exp(-u * 18) * Math.sin(u * 60) * 0.015;
  },
};

/** Running man: un ginocchio sale mentre l'altro piede scivola indietro, braccia che pompano */
const RUNNING = {
  bpm: 124,
  C: choreo([
    [0, { lhR: -1.05, lkR: 1.45, lfR: 0.3, lhL: 0.32, lkL: 0.3, lfL: 0.15, axR: 0.45, aeR: 1.5, axL: -0.75, aeL: 1.5, az2: 0.18, wx2: -0.1, tx: 0.16, ty: 0.18, hx: 0.05, by: 0 }],
    [0.5, { lhR: -0.3, lkR: 0.65, lfR: 0, lhL: -0.05, lkL: 0.55, lfL: 0.05, axR: -0.1, axL: -0.1, ty: 0, tx: 0.22, hx: 0.12 }],
    [1, { lhL: -1.05, lkL: 1.45, lfL: 0.3, lhR: 0.32, lkR: 0.3, lfR: 0.15, axL: 0.45, axR: -0.75, ty: -0.18, tx: 0.16, hx: 0.05 }],
    [1.5, { lhL: -0.3, lkL: 0.65, lfL: 0, lhR: -0.05, lkR: 0.55, lfR: 0.05, axR: -0.1, axL: -0.1, ty: 0, tx: 0.22, hx: 0.12 }],
  ], { loop: 2 }),
  over(b, P) {
    P[IX.hy] += Math.sin(Math.PI * b * 0.5) * 0.15;   // si guarda attorno ogni 2 passi
    P[IX.rz] += Math.sin(Math.PI * b) * 0.03;
  },
};

const DANCES = { ballo: BALLO, saluto: SALUTO, floss: FLOSS, tifo: TIFO, robot: ROBOT, running: RUNNING };

// ═════════════════════════ APPLICAZIONE ALLO SCHELETRO ═════════════════════════
const _p = new Float32Array(NC), _lag = new Float32Array(NC);
function danceAt(D, b, out) {
  sample(D.C, b, out);
  if (D.over) D.over(b, out);
  return out;
}

/**
 * posa il personaggio per il balletto `id` al tempo T (s); k = 0..1 dissolvenza da/verso la posa a riposo.
 * Il chiamante ha già azzerato la posa (resetPose).
 */
export function poseEmote(m, id, T, k) {
  const D = DANCES[id] || BALLO, b = T * D.bpm / 60;
  danceAt(D, b, _p);
  danceAt(D, b - 0.14 * D.bpm / 60, _lag);           // mani e testa in leggero ritardo (azione sovrapposta)
  for (const c of LAG) _p[c] = _p[c] * 0.45 + _lag[c] * 0.55;
  for (let c = 0; c < NC; c++) _p[c] = NEUTRAL[c] + (_p[c] - NEUTRAL[c]) * k;
  const g = (n) => _p[IX[n]];
  // busto e testa
  m.torso.rotation.set(g('tx'), g('ty'), g('tz'));
  m.head.rotation.set(g('hx') - g('tx') * 0.5, g('hy') - g('ty') * 0.4, g('hz') - g('tz') * 0.5);
  // gambe (il bacino che va di lato inclina le gambe; il giro del corpo non fa girare i piedi)
  const bx = g('bx'), lean = -Math.asin(clamp(bx / 0.84, -0.5, 0.5)), ry = g('ry');
  for (let i = 0; i < 2; i++) {
    const S = i ? 'L' : 'R', sd = i ? 1 : -1;
    const hip = g('lh' + S), knee = Math.max(0, g('lk' + S));
    m.legs[i].rotation.set(hip, -ry * 0.8, sd * g('ls' + S) + lean);
    m.knees[i].rotation.x = knee;
    m.feet[i].rotation.x = -(hip + knee) + g('lf' + S);
  }
  // braccia
  for (let i = 0; i < 2; i++) {
    const S = i ? 'L' : 'R', sd = i ? 1 : -1;
    m.arms[i].rotation.set(g('ax' + S), sd * g('ay' + S), sd * g('az' + S));
    m.elbows[i].rotation.x = -Math.max(0, g('ae' + S));
    if (m.hands) m.hands[i].rotation.set(g('wx' + S), 0, sd * g('wz' + S));
  }
  // corpo: piedi a terra (più l'eventuale salto), ondeggiamento e rotazioni
  m.body.rotation.set(g('rx'), ry, g('rz'));
  m.body.position.set(bx, 0, 0);
  m.body.position.y = -footContact(m) + Math.max(0, g('by'));
  return b;
}
