// Pose e animazioni dei personaggi articolati (anche, ginocchia, caviglie, spalle, gomiti).
// Condivise tra il gioco (main.js) e il sito (site.js), così le animazioni sono identiche.
import { RIG } from './character.js?v=25';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/** riporta tutte le articolazioni a riposo (la rotazione x del corpo resta: serve alle transizioni) */
export function resetPose(m) {
  m.body.position.set(0, 0, 0);
  m.body.rotation.set(m.body.rotation.x, 0, 0);
  m.torso.rotation.set(0, 0, 0);
  m.torso.position.set(0, RIG.hip, 0);
  m.head.rotation.set(0, 0, 0);
  for (const l of m.legs) l.rotation.set(0, 0, 0);
  for (const a of m.arms) a.rotation.set(0, 0, 0);
  if (m.knees) for (const k of m.knees) k.rotation.set(0, 0, 0);
  if (m.feet) for (const f of m.feet) f.rotation.set(0, 0, 0);
  if (m.elbows) for (const e of m.elbows) e.rotation.set(0, 0, 0);
  if (m.hands) for (const h of m.hands) h.rotation.set(0, 0, 0);
}

/** imposta una gamba: anca (negativo = in avanti), ginocchio (positivo = piegato), piede piatto se foot è null */
export function setLeg(m, i, hip, knee, foot = null, side = 0) {
  m.legs[i].rotation.x = hip;
  m.legs[i].rotation.z = side;
  m.knees[i].rotation.x = Math.max(0, knee);
  m.feet[i].rotation.x = foot === null ? -(hip + Math.max(0, knee)) : foot;
}
/** imposta un braccio: spalla (negativo = in avanti/in alto), apertura laterale, gomito (negativo = piegato) */
export function setArm(m, i, x, z, elbow, twist = 0) {
  m.arms[i].rotation.set(x, twist, z);
  m.elbows[i].rotation.x = Math.min(0, elbow);
}

/**
 * Camminata / corsa / accovacciata.
 * phase: fase del passo · mv: 0..1 quanto si muove · run: 0..1 corsa · ck: 0..1 accovacciato
 * Restituisce l'altezza del corpo (dondolio) da sommare a body.position.y.
 */
export function legsLocomotion(m, phase, mv, run, ck) {
  for (let i = 0; i < 2; i++) {
    const ph = phase + i * Math.PI;
    const s = Math.sin(ph), c = Math.cos(ph);
    const swing = Math.max(0, c);                       // gamba che avanza (fase di volo)
    // in piedi: falcata più lunga e ginocchio più piegato in corsa
    const hipW = -s * (0.48 + 0.34 * run) * mv - run * 0.12 * mv;
    const kneeW = 0.06 + (swing * (0.7 + 0.85 * run) + Math.max(0, -s) * 0.12 * run) * mv;
    const footW = -(hipW + kneeW) + swing * 0.25 * mv - Math.max(0, -c) * Math.max(0, s) * 0.2 * mv;
    // accovacciato: anche flesse, ginocchia molto piegate, passi corti e bassi
    const hipC = -1.12 - s * 0.38 * mv - (i ? 0.05 : -0.05) * (1 - mv);
    const kneeC = 2.02 - (i ? 0.08 : -0.08) * (1 - mv) + swing * 0.3 * mv;
    const footC = -(hipC + kneeC) + swing * 0.12 * mv;
    setLeg(m, i, lerp(hipW, hipC, ck), lerp(kneeW, kneeC, ck), lerp(footW, footC, ck), (i ? 1 : -1) * 0.03 * ck);
  }
  // dondolio: più basso quando le gambe sono aperte, più alto al passaggio
  const bob = (Math.abs(Math.cos(phase)) - 0.6) * (0.035 + run * 0.05) * mv * (1 - ck * 0.6);
  return bob - 0.4 * ck;
}

/** gambe in volo: raccolte in salita, distese in discesa */
export function legsAir(m, up) {
  const u = clamp(up, -1, 1), k = Math.max(0, u);
  setLeg(m, 0, lerp(-0.35, -1.0, k), lerp(0.45, 1.5, k), null);
  setLeg(m, 1, lerp(0.25, -0.25, k), lerp(0.35, 1.1, k), 0.2);
}

/** braccia libere che oscillano opposte alle gambe */
export function armsSwing(m, phase, mv, run, ck) {
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const s = Math.sin(phase + i * Math.PI);
    setArm(m, i, s * (0.42 + 0.5 * run) * mv - ck * 0.5, side * (0.09 + run * 0.05), -(0.18 + 1.25 * run) * (0.3 + 0.7 * mv) - ck * 0.7);
  }
}

/**
 * Posa con l'arma: mira (aim) oppure arma bassa in corsa (sk = 0..1).
 * lean: inclinazione in avanti di busto+corpo, compensata perché l'arma resti sulla linea di mira.
 */
export function poseHold(m, pitch, sk = 0, sw = 0, lean = 0) {
  const p = pitch + lean;
  // mira: mano destra sull'impugnatura (gomito piegato), sinistra avanti sul paramano
  // corsa: arma di traverso sul petto, canna in alto ("port arms")
  setArm(m, 1, lerp(-0.95 - p, -0.55 + sw * 0.12, sk), lerp(-0.14, -0.05, sk), lerp(-0.85, -1.75, sk));
  setArm(m, 0, lerp(-1.22 - p, -0.95 - sw * 0.1, sk), lerp(0.62, 0.78, sk), lerp(-0.28, -1.45, sk));
  m.gunPivot.rotation.set(lerp(-p, -0.85, sk), lerp(0, -0.75, sk), lerp(0, 0.25, sk));
  m.gunPivot.position.set(lerp(0.12, 0.08, sk), lerp(0.43 - p * 0.05, 0.36, sk), lerp(0.3, 0.24, sk));
}

/** arrampicata: arti alternati (mano sinistra con piede destro), il corpo sale a strattoni */
export function poseClimb(m, ph) {
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const reach = 0.5 + 0.5 * Math.sin(ph + i * Math.PI);          // 1 = mano in alto
    setArm(m, i, -2.25 - 0.55 * reach, side * (0.2 + 0.12 * (1 - reach)), -(0.25 + 1.25 * (1 - reach)));
    m.hands[i].rotation.x = -0.6;
    const lift = 0.5 + 0.5 * Math.sin(ph + (1 - i) * Math.PI);     // gamba opposta al braccio
    setLeg(m, i, -0.2 - 0.95 * lift, 0.35 + 1.45 * lift, -0.25 * lift, side * 0.12);
  }
  const pull = Math.abs(Math.sin(ph));
  m.body.position.y = -0.02 + (pull - 0.5) * 0.06;
  m.body.position.z = 0.04;
  m.torso.rotation.x = 0.05 + pull * 0.05;
  m.torso.rotation.y = Math.sin(ph) * 0.12;
  m.head.rotation.x = -0.45;
}

/** scavalcamento del bordo: tirarsi su con le braccia, spinta e gamba appoggiata sopra */
export function poseMantle(m, k) {
  const a = smooth(k / 0.45), b = smooth((k - 0.45) / 0.55);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    // braccia: da sopra la testa al petto (tirata), poi giù lungo i fianchi (spinta)
    const x = lerp(lerp(-2.7, -1.0, a), -0.15, b);
    const el = lerp(lerp(-0.3, -1.9, a), -0.1, b);
    setArm(m, i, x, side * lerp(0.25, 0.32, a), el);
    m.hands[i].rotation.x = lerp(-0.6, 0.6, a);
  }
  // gamba sinistra sale sul bordo, la destra segue
  setLeg(m, 0, lerp(lerp(-0.3, -1.55, a), -0.1, b), lerp(lerp(0.5, 2.1, a), 0.1, b), null);
  setLeg(m, 1, lerp(lerp(0.0, 0.35, a), -0.2, b), lerp(lerp(0.3, 0.7, a), 0.3, smooth((k - 0.7) / 0.3)), null);
  m.torso.rotation.x = lerp(lerp(0.05, 0.55, a), 0.0, b);
  m.body.position.z = lerp(0.04, 0.12, a) * (1 - b);
  m.head.rotation.x = lerp(-0.45, 0.1, a) * (1 - b);
}

/** caduta libera dal bus: a pancia in giù, braccia e gambe aperte */
export function poseSkydive(m, t) {
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    setArm(m, i, -0.45 + Math.sin(t * 9 + i) * 0.1, side * (1.2 + Math.sin(t * 7 + i) * 0.1), -0.55);
    setLeg(m, i, 0.25 + Math.sin(t * 8 + i * 2) * 0.15, 0.55 + Math.sin(t * 6 + i) * 0.15, 0.4, side * 0.25);
  }
  m.head.rotation.x = -0.7;
}

/** appeso al deltaplano */
export function poseGlide(m, t) {
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    setArm(m, i, -Math.PI + 0.18, side * 0.32, -0.25);
    setLeg(m, i, Math.sin(t * 2 + i * 3) * 0.22 - 0.1, 0.3 + Math.sin(t * 2 + i * 3 + 1) * 0.15, 0.3);
  }
}

/** nuoto a stile libero */
/** nuoto: k = 0 → si tiene a galla (braccia che remano ai lati, gambe a bicicletta), k = 1 → stile libero */
export function poseSwim(m, t, k = 1) {
  const L = (a, b) => a + (b - a) * k;
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, ph = t + i * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
    const tread = Math.sin(t * 0.9 + i * Math.PI);
    setArm(m, i, L(-0.55 + tread * 0.18, -Math.PI / 2 + s * 1.35), L(side * (0.95 + Math.sin(t * 0.9) * 0.35), side * 0.25), L(-0.35 - Math.max(0, tread) * 0.25, -0.2 - Math.max(0, c) * 1.1));
    const kick = Math.sin(t * 2 + i * Math.PI), cyc = Math.sin(t * 0.7 + i * Math.PI);
    setLeg(m, i, L(-0.35 + cyc * 0.45, kick * 0.32), L(0.55 + Math.max(0, cyc) * 0.6, 0.25 + Math.max(0, kick) * 0.4), 0.6);
  }
  m.head.rotation.x = L(-0.08, -0.55 + Math.sin(t) * 0.12);
  m.head.rotation.y = k > 0.5 ? Math.max(0, Math.sin(t)) * 0.5 * k : 0;   // respira girando la testa
}

/** morte: caduta all'indietro (k = 0..1) */
export function poseDeath(m, k) {
  setArm(m, 0, -2.4 * k, 0.6 * k, -0.5 * k);
  setArm(m, 1, -2.4 * k, -0.6 * k, -0.3 * k);
  setLeg(m, 0, -0.3 * k, 0.5 * k, 0.3 * k);
  setLeg(m, 1, 0.15 * k, 0.2 * k, 0.3 * k);
  m.head.rotation.set(0.2 * k, 0.3 * k, 0);
}
