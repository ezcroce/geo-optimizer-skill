// Pose e animazioni dei personaggi articolati (anche, ginocchia, caviglie, spalle, gomiti).
// Condivise tra il gioco (main.js) e il sito (site.js), così le animazioni sono identiche.
import * as THREE from 'three';
import { RIG } from './character.js?v=43';

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
  m._grip = null; m._headLock = false;
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
 * v29: ciclo del passo più naturale — tallone che tocca per primo, ginocchio che assorbe l'appoggio,
 * spinta di punta allo stacco, in corsa il tallone sale verso il gluteo; il bacino ondeggia sulla
 * gamba d'appoggio.
 */
// v31: piega del ginocchio che porta la caviglia esattamente a `drop` metri sotto la posizione in piedi
const TH = RIG.thigh, SH = RIG.shin;
function kneeFor(h, drop) { return Math.max(0, Math.acos(clamp((TH + SH - drop - TH * Math.cos(h)) / SH, -1, 1)) - h); }
/** punto più basso dei piedi (tallone o punta) rispetto al suolo, con il corpo a y = 0 */
export function footContact(m) {
  let lo = Infinity;
  for (let i = 0; i < 2; i++) {
    const h = m.legs[i].rotation.x, k = m.knees[i].rotation.x, f = m.feet[i].rotation.x, sd = Math.cos(m.legs[i].rotation.z);
    const ank = RIG.hip - (TH * Math.cos(h) + SH * Math.cos(h + k)) * sd;
    const a = h + k + f, ca = Math.cos(a), sa = Math.sin(a);
    const heelY = -0.06 * ca + 0.05 * sa, toeY = -0.05 * ca - 0.16 * sa;
    lo = Math.min(lo, ank + Math.min(heelY, toeY));
  }
  return lo;
}
const _cvk = [0, 0, 0];
/** posa accovacciata di una gamba: da ferma mezzo inginocchiata (destra avanti, sinistra indietro sulle punte), in movimento passi bassi */
function crouchLeg(i, phase, mv) {
  const ph = phase + i * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
  const D = 0.43 - 0.1 * smooth(mv * 1.5);                       // quanto si abbassa il bacino
  // camminata accovacciata: anca flessa, il piede in volo si alza appena, appoggio a piede piatto
  const hW = -0.95 - s * 0.48 * mv;
  let lift = 0, toe = 0;
  if (c > 0) { const t = (Math.atan2(s, c) + Math.PI / 2) / Math.PI; lift = Math.sin(Math.PI * t) * 0.085 * mv; toe = Math.sin(Math.PI * t) * 0.3 * mv; }
  const kW = kneeFor(hW, D + lift), fW = -(hW + kW) + toe;
  // ferma: gamba destra (0) avanti col piede piatto, sinistra (1) indietro col ginocchio quasi a terra e il tallone alzato
  const hI = i ? -0.42 : -1.3, upI = i ? 0.035 : 0;
  const kI = kneeFor(hI, D + upI), fI = -(hI + kI) + (i ? 0.75 : 0.02);
  const w = 1 - smooth(mv * 2.2);
  _cvk[0] = lerp(hW, hI, w); _cvk[1] = lerp(kW, kI, w); _cvk[2] = lerp(fW, fI, w);
  return _cvk;
}
// ───────────── v32: andatura con appoggio e volo veri ─────────────
//  Ogni gamba ha una fase d'appoggio (frazione D del ciclo) e una di volo. In appoggio la coscia passa da
//  avanti a dietro a velocità costante (il piede resta piantato), in volo torna avanti piegando il ginocchio.
//  Camminando D ≈ 0.6 (doppio appoggio), correndo D ≈ 0.36 (fase di volo con entrambi i piedi staccati).
//  La frequenza dei passi è calcolata dalla lunghezza dell'appoggio: i piedi non pattinano sul terreno.
const bump01 = (x) => Math.sin(Math.PI * clamp(x, 0, 1));
/** parametri dell'andatura: run 0 cammino → 1 corsa, spr 0..1 scatto */
export function gaitParams(run, spr = 0) { return { A: lerp(0.5, 0.47, run) + 0.1 * spr, D: lerp(0.6, 0.36, run) - 0.06 * spr, run, spr }; }
const _gp = [0, 0, 0];
/** posa di una gamba alla frazione u del suo ciclo (0 = appoggio del tallone): [anca, ginocchio, inclinazione del piede] */
function legPose(u, G, out = _gp) {
  const { A, D, run, spr } = G, sA = Math.sin(A);
  const kc = lerp(0.04, 0.3, run);                                   // ginocchio all'appoggio
  const heel = lerp(0.26, 0.04, run), toe = lerp(0.5, 0.8, run);     // tallone che tocca per primo, spinta di punta
  let hip, knee, fa;
  if (u < D) {
    // appoggio: il piede scorre all'indietro a velocità costante sotto il bacino
    const t = u / D;
    hip = Math.asin(lerp(-sA, sA, t));
    const kw = 0.04 + 0.15 * bump01(t / 0.45) + 0.38 * smooth((t - 0.55) / 0.45);                               // assorbe e poi "rompe" prima dello stacco
    const kr = lerp(0.3, 0.62, bump01(t * 0.85)) * (1 - smooth((t - 0.7) / 0.3)) + 0.28 * smooth((t - 0.7) / 0.3); // compressione a metà appoggio
    knee = lerp(kw, kr, run);
    fa = -heel * (1 - smooth(t / lerp(0.2, 0.3, run))) + toe * smooth((t - lerp(0.55, 0.5, run)) / lerp(0.45, 0.5, run));
  } else {
    // volo: la coscia torna avanti (in corsa va oltre e poi "artiglia" indietro), il tallone sale verso il gluteo
    const t = (u - D) / (1 - D);
    const over = 0.3 * run + 0.3 * spr;
    hip = lerp(A, -A - over, smooth(t / 0.8)) + over * smooth((t - 0.78) / 0.22);
    const kp = lerp(1.05, 1.75, run) + 0.45 * spr;
    knee = lerp(lerp(0.42, 0.28, run), kc, smooth(t)) + (kp - 0.3) * Math.pow(bump01(Math.pow(t, lerp(0.8, 0.85, run))), 1.3);
    fa = toe * (1 - smooth(t / 0.35)) - 0.12 * bump01(t) - heel * smooth((t - 0.7) / 0.3);
  }
  out[0] = hip; out[1] = knee; out[2] = fa;
  return out;
}
/** altezza del punto più basso del piede con quella posa (corpo a y = 0) */
function legContact(h, k, fa) {
  const ank = RIG.hip - (TH * Math.cos(h) + SH * Math.cos(h + k));
  const ca = Math.cos(fa), sa = Math.sin(fa);
  return ank + Math.min(-0.06 * ca + 0.05 * sa, -0.05 * ca - 0.16 * sa);
}
/**
 * Velocità della fase del passo (rad/s) perché il piede d'appoggio non scivoli: in un ciclo il piede resta
 * a terra per D·T e in quel tempo il corpo avanza della lunghezza dell'appoggio (più il rotolamento del piede).
 */
export function gaitRate(spd, mv, run, spr, ck) {
  const G = gaitParams(run, spr);
  legPose(0, G); const z0 = -(TH * Math.sin(_gp[0]) + SH * Math.sin(_gp[0] + _gp[1]));
  legPose(G.D, G); const z1 = -(TH * Math.sin(_gp[0]) + SH * Math.sin(_gp[0] + _gp[1]));
  const travel = Math.max(0.12, ((z0 - z1) + 0.15) * Math.max(0.15, mv));
  let w = 2 * Math.PI * G.D * spd / travel;
  w = clamp(w, 4.2, Math.PI * (lerp(2.95, 3.3, run) + 0.35 * spr));            // cadenza credibile (passi al secondo)
  const wc = clamp(Math.PI * spd / 0.7, 4, 11);                                 // accovacciato: passi corti
  return lerp(w, wc, ck);
}
export function legsLocomotion(m, phase, mv, run, ck, spr = 0) {
  const G = gaitParams(run, spr);
  const TAU = Math.PI * 2;
  const gait = m._gait || (m._gait = { h: [0, 0], stance: [0, 0] });
  let stance = false;
  for (let i = 0; i < 2; i++) {
    // gamba 0 (destra) tocca terra a fase π/2, la sinistra mezzo ciclo dopo
    const u = (((phase - Math.PI / 2 + i * Math.PI) / TAU) % 1 + 1) % 1;
    legPose(u, G);
    const hipW = _gp[0] * mv, kW = lerp(0.03, _gp[1], mv), footW = -(hipW + kW) + _gp[2] * mv;
    gait.h[i] = hipW; gait.stance[i] = u < G.D ? 1 : 0;
    if (u < G.D) stance = true;
    // accovacciato (v31): ginocchia calcolate perché i piedi restino a terra, mezza ginocchiata da fermi
    if (ck > 0.001) {
      const C = crouchLeg(i, phase, mv);
      setLeg(m, i, lerp(hipW, C[0], ck), lerp(kW, C[1], ck), lerp(footW, C[2], ck), (i ? 1 : -1) * (0.015 + 0.05 * ck));
    } else setLeg(m, i, hipW, kW, footW, (i ? 1 : -1) * 0.015 * (1 - mv));
  }
  // bacino che si sposta sulla gamba d'appoggio (gamba 0 = x negativa), meno quando si corre
  m.body.position.x = -Math.cos(phase - Math.PI / 2 - Math.PI * G.D) * 0.026 * mv * (1 - 0.65 * run) * (1 - ck * 0.5);
  // altezza: il piede più basso tocca terra (niente piedi che affondano o galleggiano);
  // in corsa, nella fase di volo il bacino segue un piccolo arco fra lo stacco e l'appoggio successivo
  let y = -footContact(m);
  if (!stance && mv > 0.2 && ck < 0.5) {
    const ua = ((((phase - Math.PI / 2) / TAU) % 0.5) + 0.5) % 0.5;
    const sF = clamp((ua - G.D) / Math.max(0.02, 0.5 - G.D), 0, 1);
    legPose(G.D, G); const h0 = legContact(_gp[0] * mv, lerp(0.03, _gp[1], mv), _gp[2] * mv);
    legPose(0, G); const h1 = legContact(_gp[0] * mv, lerp(0.03, _gp[1], mv), _gp[2] * mv);
    y = Math.max(y, -lerp(h0, h1, sF) + 4 * (0.03 * run + 0.025 * spr) * mv * sF * (1 - sF));
  }
  gait.run = run; gait.mv = mv;
  return y;
}

/** v31: fonde la posa in volo con quella attuale delle gambe (k 0..1): salti e atterraggi senza scatti */
const _lg = new Float32Array(8);
export function legsAirBlend(m, up, k, o) {
  if (k <= 0.001) return;
  for (let i = 0; i < 2; i++) { _lg[i * 4] = m.legs[i].rotation.x; _lg[i * 4 + 1] = m.legs[i].rotation.z; _lg[i * 4 + 2] = m.knees[i].rotation.x; _lg[i * 4 + 3] = m.feet[i].rotation.x; }
  legsAir(m, up, o);
  for (let i = 0; i < 2; i++) {
    m.legs[i].rotation.x = lerp(_lg[i * 4], m.legs[i].rotation.x, k);
    m.legs[i].rotation.z = lerp(_lg[i * 4 + 1], m.legs[i].rotation.z, k);
    m.knees[i].rotation.x = lerp(_lg[i * 4 + 2], m.knees[i].rotation.x, k);
    m.feet[i].rotation.x = lerp(_lg[i * 4 + 3], m.feet[i].rotation.x, k);
  }
}

/**
 * gambe in volo (v41: salto vivo, non più una posa fissa)
 *  up: velocità verticale normalizzata (+1 sale forte, −1 scende) · o.run: 0..1 rincorsa · o.lead: gamba che stacca
 *  o.t: tempo in aria · o.push: 0..1 spinta dello stacco (gambe distese, punte tese)
 *  · da fermi: in salita le ginocchia si raccolgono (una un po' più dell'altra), in discesa le gambe si allungano verso terra
 *  · in corsa: falcata aperta, la gamba avanti piegata, quella dietro distesa; in discesa si richiudono per atterrare
 *  · cadute lunghe: le gambe "pedalano" piano e i piedi cercano il suolo
 */
export function legsAir(m, up, o = {}) {
  const u = clamp(up, -1.3, 1), k = Math.max(0, u), dn = Math.min(1, Math.max(0, -u));
  const run = clamp(o.run || 0, 0, 1), lead = o.lead ? 1 : 0, t = o.t || 0, push = clamp(o.push || 0, 0, 1);
  const fall = clamp((t - 0.55) / 0.45, 0, 1) * dn;
  const ped = t * 6.5;
  for (let i = 0; i < 2; i++) {
    const L = i === lead ? 1 : 0;   // 1 = gamba che va avanti
    // salto da fermo
    let hip = lerp(lerp(-0.3, -1.15, k), lerp(-0.2, -0.85, k), L ? 0 : 1) * (1 - dn) + lerp(-0.12, 0.06, L) * dn;
    let knee = lerp(lerp(0.45, 1.65, k), lerp(0.35, 1.25, k), L ? 0 : 1) * (1 - dn) + lerp(0.22, 0.32, L) * dn;
    // rincorsa: falcata
    const sh = L ? -1.0 - 0.2 * k + 0.55 * dn : 0.55 - 0.25 * k - 0.4 * dn;
    const sk = L ? 0.85 + 0.45 * k - 0.35 * dn : 0.55 + 0.6 * k - 0.15 * dn;
    hip = lerp(hip, sh, run); knee = lerp(knee, sk, run);
    // caduta lunga: pedalata
    if (fall > 0) { const ph = ped + i * Math.PI; hip += Math.sin(ph) * 0.38 * fall; knee += (0.35 + Math.cos(ph) * 0.3) * fall; }
    // stacco: la gamba di spinta si distende (punta tesa)
    if (push > 0) { const e = L ? 0.4 : 1; hip = lerp(hip, L ? -0.55 : 0.18, push * e); knee = lerp(knee, L ? 0.8 : 0.06, push * e); }
    const foot = -(hip + Math.max(0, knee)) * (1 - 0.6 * dn) + 0.38 * dn + (push > 0 && !L ? 0.5 * push : 0);
    setLeg(m, i, hip, knee, foot, (i ? 1 : -1) * (0.05 + 0.06 * dn + 0.04 * fall));
  }
}

/** braccia libere che oscillano opposte alle gambe (v32: seguono l'anca della gamba opposta; in corsa gomiti a 90° che pompano) */
export function armsSwing(m, phase, mv, run, ck, only = -1) {
  const g = m._gait;
  for (let i = 0; i < 2; i++) {
    if (only >= 0 && i !== only) continue;
    const side = i ? 1 : -1;
    // il braccio destro va avanti con la gamba sinistra (e viceversa), con un attimo di ritardo
    const hOpp = g ? g.h[1 - i] : -Math.sin(phase + i * Math.PI) * 0.46 * mv;
    const x = hOpp * lerp(0.85, 1.3, run) - 0.12 * run * mv;
    const fwd = Math.max(0, -x);
    const el = -(0.22 + 1.2 * run) * (0.3 + 0.7 * mv) - fwd * lerp(0.45, 0.6, run) - ck * 0.7;
    setArm(m, i, x - ck * 0.5, side * (0.09 + run * 0.06 + fwd * 0.05), el, side * (0.06 + 0.12 * run) * mv);
    if (m.hands) m.hands[i].rotation.set(-0.1 - 0.15 * run, 0, side * 0.1);
  }
}

// ───────────── cinematica inversa delle braccia ─────────────
const UPA = RIG.upper, FOA = RIG.fore, REACH = (RIG.upper + RIG.fore) * 0.97;
const _d = new THREE.Vector3(), _h0 = new THREE.Vector3(), _e = new THREE.Vector3(), _pl = new THREE.Vector3(), _c = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
/**
 * Porta il polso del braccio i sul punto target (spazio del busto), col gomito verso pole.
 * Imposta il quaternione della spalla e la piega del gomito.
 */
export function armIK(m, i, target, pole) {
  const S = m.arms[i].position;
  _d.copy(target).sub(S);
  const d = clamp(_d.length(), 0.12, REACH);
  _d.normalize();
  const cosI = (UPA * UPA + FOA * FOA - d * d) / (2 * UPA * FOA);
  const e = -(Math.PI - Math.acos(clamp(cosI, -1, 1)));        // piega del gomito (negativa)
  _h0.set(0, -UPA - FOA * Math.cos(e), -FOA * Math.sin(e)).normalize();
  _q1.setFromUnitVectors(_h0, _d);
  // rotazione attorno all'asse spalla→polso perché il gomito punti verso pole
  _e.set(0, -1, 0).applyQuaternion(_q1); _e.addScaledVector(_d, -_e.dot(_d));
  _pl.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_e.lengthSq() > 1e-6 && _pl.lengthSq() > 1e-6) {
    const ang = Math.atan2(_c.crossVectors(_e, _pl).dot(_d), _e.dot(_pl));
    _q1.premultiply(_q2.setFromAxisAngle(_d, ang));
  }
  m.arms[i].quaternion.copy(_q1);
  m.elbows[i].rotation.set(e, 0, 0);
}

// ───────────── arma in mano ─────────────
/** scala delle armi impugnate: i modelli sono un po' "eroici", in mano li riduciamo alle proporzioni del corpo */
export const HELD_SCALE = 0.8;   // v37: un po' più piccole (con 0.86 i fucili erano più lunghi delle braccia)
const DEF_HOLD = { kind: 'rifle', cls: 'medium', main: [-0.1, -0.05], fore: [-0.05, 0.4], zmin: -0.45, zmax: 0.9, xmin: -0.06, xmax: 0.06, ymin: -0.25, ymax: 0.15 };
export function holdOf(m) { const g = m.gunPivot.children[0]; return (g && g.userData.hold) || DEF_HOLD; }
const _qa = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _pa = new THREE.Vector3(), _ps = new THREE.Vector3();
const _eu = new THREE.Euler(), _ey = new THREE.Euler(0, 0, 0, 'YXZ'), _m4 = new THREE.Matrix4(), _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3();
const _t = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _pole = new THREE.Vector3(), ZERO = new THREE.Vector3();
const _P = new THREE.Vector3(), _Q = new THREE.Quaternion();
// punti del busto: tasca della spalla (calcio), spalla (appoggio del tubo), spalla dell'arma e spalla libera
const POCKET = new THREE.Vector3(0.155, 0.45, 0.07);
const SHOULDER_TOP = new THREE.Vector3(0.3, 0.6, 0.03);
const SH_MAIN = new THREE.Vector3(RIG.shoulderX, RIG.shoulderY, 0), SH_SUP = new THREE.Vector3(-RIG.shoulderX, RIG.shoulderY, 0);

// v32: armi, piccone e oggetti nella mano DESTRA (braccio 0, x negativa). Le pose sono scritte "allo specchio"
// (lato dell'arma = +x, mano dell'arma = braccio 1 come nelle versioni precedenti) e poi riflesse sul piano x = 0:
// la posizione cambia segno in x, il quaternione (x, y, z, w) diventa (x, −y, −z, w).
const MAIN = 0, SUP = 1;
function mirrorPQ(p, q) { p.x = -p.x; if (q) { q.y = -q.y; q.z = -q.z; } }
const _mt = new THREE.Vector3(), _mp = new THREE.Vector3();
/** IK allo specchio: role 1 = mano dell'arma (destra), role 0 = mano d'appoggio (sinistra) */
function ikM(m, role, target, pole) {
  _mt.copy(target); _mt.x = -_mt.x; _mp.copy(pole); _mp.x = -_mp.x;
  armIK(m, role ? MAIN : SUP, _mt, _mp);
}
const _fq = new THREE.Quaternion(), _fe = [0, 0];
/** come ikM ma fuso (w 0..1) con la posa già impostata del braccio (oscillazione libera) */
function ikMBlend(m, role, target, pole, w) {
  if (w <= 0.001) return;
  const i = role ? MAIN : SUP;
  if (w >= 0.999) { ikM(m, role, target, pole); return; }
  _fq.copy(m.arms[i].quaternion); const e0 = m.elbows[i].rotation.x;
  ikM(m, role, target, pole);
  m.arms[i].quaternion.slerpQuaternions(_fq, m.arms[i].quaternion, w);
  m.elbows[i].rotation.x = lerp(e0, m.elbows[i].rotation.x, w);
}
/** pivot dell'oggetto in mano, da coordinate allo specchio */
function setPivotM(m, p, q) { m.gunPivot.position.copy(p); m.gunPivot.quaternion.copy(q); mirrorPQ(m.gunPivot.position, m.gunPivot.quaternion); }
/** dita: [destra, sinistra] 0 = rilassata, 1 = stretta */
function grip(m, r, l) { m._grip = m._grip || [0, 0]; m._grip[0] = r; m._grip[1] = l; }

/** trasforma il punto locale dell'arma (già in scala) in spazio del busto con posizione p e rotazione q */
function gunPoint(out, p, q, x, y, z, s) { return out.set(x * s, y * s, z * s).applyQuaternion(q).add(p); }
/** offset (locale, non in scala) del polso rispetto al pivot dell'arma: un po' dietro e sotto il palmo */
function wristLocal(h, pis) { return [0.012, h.main[0] - (pis ? 0.005 : 0.045), h.main[1] - (pis ? 0.095 : 0.075)]; }
/** pivot dell'arma perché il polso della mano destra finisca in w (rotazione q) */
function pivotForWrist(out, w, q, h, s, pis) { const o = wristLocal(h, pis); return out.copy(w).sub(gunPoint(_t3, ZERO, q, o[0], o[1], o[2], s)); }

/**
 * Posa con l'arma: mira (sk = 0) oppure arma in sicurezza mentre corri (sk = 1).
 * lean: inclinazione in avanti di busto+corpo, compensata perché l'arma resti sulla linea di mira.
 * v29: l'arma è posizionata in base al suo ingombro e le mani vanno sull'impugnatura con la cinematica inversa.
 * v32: impugnatura nella mano destra e tenute diverse per peso (h.cls):
 *   leggere (pistole, mitragliette): pistola a una mano col busto di profilo; mitraglietta compatta e alta,
 *     in corsa canna in su davanti alla spalla;
 *   medie (fucili d'assalto, pompe, DMR): calcio alla spalla, in corsa "port arms" di traverso sul petto;
 *   pesanti (mitragliatrice, fucile pesante, cecchino, lanciagranate): spalla sinistra avanti, arma più bassa,
 *     in corsa portata bassa in diagonale all'altezza della vita; lanciarazzi sulla spalla, minigun all'anca.
 */
export function poseHold(m, pitch, sk = 0, sw = 0, lean = 0) {
  const g = m.gunPivot.children[0];
  const h = holdOf(m), s = HELD_SCALE;
  if (g && g.userData.hold) g.scale.setScalar(s);
  const p = pitch + lean;
  const k = h.kind, cls = h.cls || 'medium', one = k === 'pistol' && h.one;
  const e = smooth(sk);
  // torsione del busto (positiva = spalla destra avanti): pistola a una mano di profilo, armi pesanti con la spalla sinistra avanti
  // v37: busto di tre quarti come un tiratore vero (spalla sinistra avanti): la mano d'appoggio arriva al paramano col gomito piegato
  // v38: da fermi il braccio d'appoggio attraversava il petto (spalla → paramano in diagonale dentro il pettorale):
  //  busto più di tre quarti (posizione "a lama"), così il paramano finisce davanti alla spalla sinistra
  const tw0 = one ? 0.3 : k === 'rifle' ? (cls === 'heavy' ? -0.5 : cls === 'light' ? -0.36 : -0.44) : 0;
  const tw = tw0 * (1 - e);
  m.torso.rotation.y += tw;
  // ── mira ── la rotazione compensa la torsione: la canna resta sulla linea di mira
  _qa.setFromEuler(_ey.set(-(k === 'hip' ? p * 0.55 : p), tw, 0));
  if (one) {
    // pistola a una mano: braccio destro quasi teso davanti alla spalla
    _t.set(0, 0, 0.49).applyQuaternion(_qa).add(_t2.set(0.25, 0.46, 0.03));
    pivotForWrist(_pa, _t, _qa, h, s, true);
  } else if (k === 'pistol') {
    // due mani, braccia tese: ruota attorno al centro delle spalle
    _pa.set(0, 0.04, 0.47).applyQuaternion(_qa).add(_t.set(0.07, 0.42, 0.0));
  } else if (k === 'shoulder') {
    // il tubo poggia sulla spalla: ruota attorno al punto d'appoggio
    _pa.copy(SHOULDER_TOP).sub(gunPoint(_t, ZERO, _qa, 0, h.rest[0], h.rest[1], s));
  } else if (k === 'hip') {
    _pa.set(0.22, 0.2 + lean * 0.2, 0.38 + lean * 0.14);   // accovacciato: le canne restano sopra le cosce
  } else {
    // calcio nella tasca della spalla; se l'arma è lunga la mano d'appoggio scivola indietro (vedi handsToGun).
    // Le armi corte (calcio ripiegato) stanno più avanti, a braccia tese.
    _pa.copy(POCKET).sub(gunPoint(_t, ZERO, _qa, 0, -0.02, h.zmin + 0.03, s));   // v37: calcio davvero nella spalla (prima i calci lunghi finivano 15 cm avanti)
    if (cls === 'light') { _pa.y += 0.02; _pa.z += 0.045 + Math.max(0, p) * 0.08; }  // compatta, più alta e più avanti: calcio corto, guancia sul calcio
    else if (cls === 'heavy') _pa.y -= 0.015;            // pesante: un po' più bassa, appoggiata
    // mirando in basso caricatore e impugnatura ruotano verso il ventre: se serve l'arma va più avanti
    const mz = gunPoint(_t, _pa, _qa, 0, h.ymin, h.main[1] + 0.12, s).z;
    const mzMin = cls === 'light' ? 0.24 : 0.15;   // v37: prima 0.33/0.25 spingevano il calcio fuori dalla spalla e tendevano le braccia
    if (mz < mzMin) _pa.z += mzMin - mz;
  }
  // ── corsa ──
  const bob = sw * 0.035;
  if (one) {
    // pistola a una mano lungo il fianco, canna in basso, che dondola col braccio
    _qs.setFromEuler(_eu.set(1.2 + sw * 0.3, 0.06, 0, 'XYZ'));
    _t.set(0.31, -0.02 + Math.abs(sw) * 0.03, 0.08 + sw * 0.17);
    pivotForWrist(_ps, _t, _qs, h, s, true);
  } else if (k === 'pistol') {
    // pistola pesante: bassa in due mani davanti al ventre
    _qs.setFromEuler(_eu.set(0.95 - sw * 0.25, 0.12, 0, 'XYZ'));
    _ps.set(0.29, 0.08 + Math.abs(sw) * 0.03, 0.17 + sw * 0.1);
  } else if (k === 'shoulder') {
    _qs.setFromEuler(_eu.set(-0.3 + bob, 0, -0.05, 'XYZ'));
    _ps.copy(SHOULDER_TOP).sub(gunPoint(_t, ZERO, _qs, 0, h.rest[0], h.rest[1], s));
  } else if (k === 'hip') {
    _qs.setFromEuler(_eu.set(0.32 + bob, 0.12, 0, 'XYZ'));
    _ps.set(0.23, 0.16 + bob * 0.5, 0.36);
  } else if (h.sprint === 'low') {
    // "low ready": calcio alla spalla, bocca verso terra davanti ai piedi (armi larghe come la balestra)
    _qs.setFromEuler(_eu.set(0.72 + bob, 0.1, 0, 'XYZ'));
    _ps.copy(POCKET).sub(gunPoint(_t, ZERO, _qs, 0, -0.02, h.zmin + 0.04, s));
    _ps.z += 0.07;                                                     // un po' più avanti: lontana da gambe e cappotti
  } else {
    // v37: tutte le armi lunghe a due mani in corsa: calcio appoggiato alla spalla destra, bocca verso il basso a
    // sinistra, di traverso davanti al corpo ("low port"). Prima la canna puntava in alto a sinistra.
    const len = (h.zmax - h.zmin) * s;
    const dn = cls === 'heavy' ? 0.78 : cls === 'light' ? 0.62 : 0.7;      // quanto punta in basso
    _bz.set(-0.9, -dn * 0.8 + bob * 0.6, 0.42 + sw * 0.04).normalize();           // asse della canna: in basso, a sinistra, un po' avanti
    _by.set(0.55, 0.45, 0.7); _by.addScaledVector(_bz, -_by.dot(_bz)).normalize();   // il dorso dell'arma guarda in fuori e in avanti
    _bx.crossVectors(_by, _bz);
    _qs.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz));
    // calcio nella tasca della spalla destra, un po' avanti (per non entrare nel petto)
    const front = Math.max(0.06, -h.xmin * s) + 0.05;
    _t.set(0.17, 0.47 + bob * 0.4, front);
    _ps.copy(_t).sub(gunPoint(_t2, ZERO, _qs, 0, h.ymax * 0.3, h.zmin + 0.03, s));
    // le armi molto lunghe scendono un po' di meno (la bocca non deve toccare le ginocchia)
    if (len > 1.05) _ps.y += (len - 1.05) * 0.25;
    // niente pezzi dentro il busto: se un punto dell'arma rientra, si sposta in avanti
    for (const zz of [h.main[1], (h.zmin + h.zmax) * 0.5]) {
      const pt = gunPoint(_t2, _ps, _qs, 0, h.ymin * 0.6, zz, s);
      const minZ = 0.17 + Math.max(0, 0.1 - Math.abs(pt.x)) * 0.5;
      if (pt.z < minZ) _ps.z += minZ - pt.z;
    }
  }
  // fusione mira ↔ corsa, poi riflessione sul lato destro
  _P.lerpVectors(_pa, _ps, e);
  _Q.slerpQuaternions(_qa, _qs, e);
  setPivotM(m, _P, _Q);
  m._hold = { h, sk: e, sw };
  handsToGun(m);
}

/**
 * Mani sull'arma (cinematica inversa), dalla posa attuale di gunPivot.
 * reload: 0..1 fase della ricarica (la mano d'appoggio va al caricatore e alla tasca), -1 = no.
 */
export function handsToGun(m, reload = -1) {
  const H = m._hold; if (!H) return;
  const h = H.h, s = (m.gunPivot.children[0] && m.gunPivot.children[0].scale.x) || 1;
  // pivot riportato allo specchio (lato dell'arma = +x)
  const P = _P.copy(m.gunPivot.position), Q = _Q.copy(m.gunPivot.quaternion);
  mirrorPQ(P, Q);
  const k = h.kind, sk = H.sk, cls = h.cls || 'medium';
  const pis = k === 'pistol', one = pis && h.one;
  // mano dell'impugnatura (destra): polso un po' dietro e sotto il palmo
  const wl = wristLocal(h, pis);
  gunPoint(_t, P, Q, wl[0], wl[1], wl[2], s);
  _pole.set(0.8, -1, k === 'shoulder' ? 0.3 : -0.35);
  ikM(m, 1, _t, _pole);
  // mano d'appoggio (sinistra): sul paramano, ma solo fin dove arriva il braccio
  const S0 = SH_SUP;
  let fz = h.fore[1];
  if (k === 'rifle') {
    // v37: punto del paramano più avanti che la mano raggiunge col gomito ancora piegato (prima: braccio teso al
    // limite e passi di 3 cm, così la mano saltellava lungo l'arma a ogni passo). Ricerca continua + smorzamento.
    const zMin = h.main[1] + 0.12, lim = REACH * 0.84;   // v38: gomito più piegato (può uscire di lato invece di restare in linea col petto)
    const dAt = (z) => gunPoint(_t, P, Q, -0.04, h.fore[0] - 0.045, z - 0.06, s).distanceTo(S0);
    if (dAt(fz) > lim) {
      let lo = zMin, hi = fz;
      if (dAt(lo) > lim) fz = lo;
      else { for (let n = 0; n < 12; n++) { const mid = (lo + hi) * 0.5; if (dAt(mid) > lim) hi = mid; else lo = mid; } fz = lo; }
    }
    if (m._fz != null && Math.abs(fz - m._fz) < 0.3) fz = m._fz + (fz - m._fz) * 0.3;
    m._fz = fz;
  }
  if (pis) gunPoint(_t, P, Q, -0.045, h.fore[0] - 0.02, fz - 0.07, s);
  else gunPoint(_t, P, Q, -0.04, h.fore[0] - 0.045, fz - 0.06, s);
  // pistola a una mano (sempre) o pistola pesante in corsa: la mano libera oscilla opposta al passo
  const free = one ? 1 : pis ? sk : 0;
  if (free > 0) {
    _t2.set(-0.32, (one ? 0.0 : 0.1) + Math.max(0, -H.sw) * 0.1, (one ? 0.03 : 0.07) - H.sw * 0.2);
    _t.lerp(_t2, free);
  }
  if (reload >= 0) {
    // 0–0.3 al caricatore, 0.3–0.55 alla tasca sul fianco, 0.55–0.85 di nuovo al caricatore, poi al paramano
    gunPoint(_t2, P, Q, -0.03, h.ymin * 0.7 - 0.04, k === 'shoulder' ? h.zmin + 0.05 : Math.max(h.main[1] + 0.12, 0.08), s);
    const pouch = _t3.set(-0.17, 0.08, 0.12);
    const toMag = smooth(reload / 0.3) * (1 - smooth((reload - 0.85) / 0.15));
    const toPouch = smooth((reload - 0.3) / 0.12) * (1 - smooth((reload - 0.5) / 0.12));
    _t.lerp(_t2, toMag).lerp(pouch, toPouch);
  }
  _pole.set(-0.95, -1, k === 'hip' ? 0.2 : cls === 'heavy' ? -0.25 : -0.1);   // v38: gomito d'appoggio più in fuori
  ikM(m, 0, _t, _pole);
  // polsi: leggera rotazione verso l'impugnatura
  m.hands[MAIN].rotation.set(0.25, 0, 0);
  m.hands[SUP].rotation.set(free > 0.5 && reload < 0 ? -0.1 : 0.15, 0, 0);
  grip(m, 1, free > 0.5 && reload < 0 ? 0.1 : 1);
}

// ───────────── v32: piccone nella mano destra ─────────────
//  Pronto: impugnatura in fondo al manico, testa in alto davanti; camminando il braccio oscilla col passo,
//  in corsa il piccone va giù e avanti. Colpo (k 0..1): carica sopra la spalla, colpo in diagonale verso il
//  centro (l'impatto arriva a k ≈ 0.36, quando il gioco applica il danno), accompagnamento e ritorno.
//  Durante il colpo anche la mano sinistra afferra il manico, se ci arriva. Il busto si carica e poi ruota.
const PK = [
  [0.0, [0.29, 0.06, 0.2], [0.06, 0.62, 0.78]],
  [0.2, [0.3, 0.64, 0.0], [0.04, 0.72, -0.69]],
  [0.36, [0.07, 0.3, 0.46], [-0.1, -0.2, 0.97]],
  [0.56, [0.05, 0.08, 0.4], [-0.12, -0.68, 0.72]],
  [1.0, [0.29, 0.06, 0.2], [0.06, 0.62, 0.78]],
];
const PK_EASE = [(t) => smooth(t), (t) => t * t * (1.6 - 0.6 * t), (t) => 1 - (1 - t) * (1 - t), (t) => smooth(t)];
const _pf = new THREE.Vector3(), _pd = new THREE.Vector3(), _pa2 = new THREE.Vector3(), _pb2 = new THREE.Vector3();
function pickKey(k, outP, outD) {
  let i = 0; while (i < PK.length - 2 && k > PK[i + 1][0]) i++;
  const A = PK[i], B = PK[i + 1], t = PK_EASE[i](clamp((k - A[0]) / (B[0] - A[0]), 0, 1));
  outP.lerpVectors(_pa2.fromArray(A[1]), _pb2.fromArray(B[1]), t);
  outD.lerpVectors(_pa2.fromArray(A[2]), _pb2.fromArray(B[2]), t).normalize();
  return i;
}
/** orientamento del piccone: manico lungo z verso dir, lama nel piano verticale del colpo */
function pickQuat(out, dir) {
  _bz.copy(dir).normalize();
  _bx.set(1, 0, 0).addScaledVector(_bz, -_bz.x).normalize();
  _by.crossVectors(_bz, _bx);
  return out.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz));
}
/** polso a 8 cm dal centro del pugno, perpendicolare al manico, verso la spalla */
function wristFromFist(out, fist, axis, shoulder, d = 0.08) {
  out.copy(shoulder).sub(fist); out.addScaledVector(axis, -out.dot(axis));
  if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
  return out.normalize().multiplyScalar(d).add(fist);
}
/**
 * o: { mv, run, sk (corsa), swing 0..1 o −1, ck }
 */
export function posePickaxe(m, o) {
  const g = m._gait, hOpp = g ? g.h[1] : 0;                 // il braccio destro va avanti con la gamba sinistra
  const sk = smooth(o.sk || 0);
  // posa di base: pronto ↔ corsa, con l'oscillazione del passo
  _pf.set(0.29, 0.06, 0.2).lerp(_t.set(0.31, 0.0, 0.08), sk);
  _pf.z += -hOpp * lerp(0.22, 0.42, sk); _pf.y += Math.abs(hOpp) * 0.05;
  _pd.set(0.06, 0.62, 0.78).lerp(_t.set(0.05, 0.28, 0.96), sk).normalize();
  _pd.applyAxisAngle(_t.set(1, 0, 0), hOpp * lerp(0.35, 0.6, sk));
  let join = 0;
  if (o.swing >= 0) {
    const k = o.swing;
    // fuori dal colpo si torna alla posa di base (anche camminando)
    const i = pickKey(k, _pa, _ps);
    const inW = smooth(k / 0.12) * (1 - smooth((k - 0.8) / 0.2));
    _pf.lerp(_pa, inW); _pd.lerp(_ps, inW).normalize();
    // busto: si carica (spalla destra indietro), poi ruota nel colpo; si inclina in avanti all'impatto
    const coil = -0.34 * bump01(k / 0.36) * (k < 0.2 ? 1 : 1 - smooth((k - 0.2) / 0.16));
    const turn = 0.3 * smooth((k - 0.2) / 0.16) * (1 - smooth((k - 0.45) / 0.5));
    m.torso.rotation.y += coil + turn;
    m.torso.rotation.x += -0.08 * bump01(k / 0.24) + 0.22 * bump01((k - 0.24) / 0.5);
    m.head.rotation.x += 0.12 * bump01((k - 0.24) / 0.5);
    join = smooth((k - 0.14) / 0.1) * (1 - smooth((k - 0.62) / 0.2));
    void i;
  }
  pickQuat(_Q, _pd);
  setPivotM(m, _pf, _Q);
  // mano destra sul fondo del manico
  wristFromFist(_t, _pf, _pd, SH_MAIN);
  ikM(m, 1, _t, _pole.set(0.9, -0.7, -0.3));
  m.hands[MAIN].rotation.set(0.1, 0, 0);
  // mano sinistra: oscilla libera, nel colpo afferra il manico 16 cm sopra la destra (se ci arriva)
  if (join > 0.001) {
    _t2.copy(_pf).addScaledVector(_pd, 0.16);
    wristFromFist(_t, _t2, _pd, SH_SUP);
    const reach = clamp((REACH * 1.02 - _t.distanceTo(SH_SUP)) / 0.06, 0, 1);
    ikMBlend(m, 0, _t, _pole.set(-0.9, -0.8, -0.2), join * reach);
    join *= reach;
  }
  grip(m, 1, join > 0.5 ? 1 : 0);
}

// ───────────── v32: uso dei consumabili ─────────────
//  Bende: avambraccio sinistro davanti al petto, la destra gira il rotolo attorno al braccio, poi fissa e batte.
//  Medikit: si inginocchia (vedi main.js), apre la valigetta sorretta dalla sinistra, la destra prende e applica
//    tre volte (petto, fianco, spalla) con un piccolo massaggio, poi richiude.
//  Mini scudo: porta la fiaschetta alla bocca, testa all'indietro, due sorsi, giù.
//  Pozione scudo: due mani, svita il tappo, beve a lungo, pausa per respirare, finisce e si pulisce la bocca.
const MOUTH_DEF = new THREE.Vector3(0, 0.83, 0.17), NECK_DEF = new THREE.Vector3(0, RIG.headY, 0);
const _mo = new THREE.Vector3(), _hq = new THREE.Quaternion();
/** bocca nello spazio del busto (allo specchio), con la rotazione attuale della testa */
function mouthM(m, out) {
  const neck = m.neckRest || NECK_DEF, mouth = m.mouthRest || MOUTH_DEF;
  _hq.setFromEuler(m.head.rotation);
  out.copy(mouth).sub(neck).applyQuaternion(_hq).add(neck);
  out.x = -out.x;
  return out;
}
/** orientamento con l'asse y dell'oggetto verso up e la z (fronte/etichetta) verso fwd */
function quatYZ(out, up, fwd) {
  _by.copy(up).normalize();
  _bz.copy(fwd).addScaledVector(_by, -fwd.dot(_by));
  if (_bz.lengthSq() < 1e-6) _bz.set(0, 0, 1).addScaledVector(_by, -_by.z);
  _bz.normalize();
  _bx.crossVectors(_by, _bz);
  return out.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz));
}
const _u1 = new THREE.Vector3(), _u2 = new THREE.Vector3(), _u3 = new THREE.Vector3(), _u4 = new THREE.Vector3();
const _ax = new THREE.Vector3(), _fw = new THREE.Vector3();
/** tappe interpolate: keys = [[t, ...valori]], restituisce i valori fusi con smoothstep */
function track(keys, u, out) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const A = keys[i], B = keys[i + 1], t = smooth((u - A[0]) / Math.max(1e-4, B[0] - A[0]));
  for (let j = 1; j < A.length; j++) out[j - 1] = lerp(A[j], B[j], t);
  return out;
}
const _tr = new Array(8).fill(0);
/**
 * id: bandage | medkit | minishield | shield · u: avanzamento 0..1 (−1 = solo in mano) · o: { sw, mv, run, t }
 * Imposta pivot dell'oggetto, braccia (IK), testa e busto. Restituisce l'intensità della posa d'uso (0..1).
 */
export function poseUse(m, id, u, o = {}) {
  const using = u >= 0, mv = o.mv || 0;
  const g = m._gait, hOpp = g ? g.h[1] : 0;
  // braccio sinistro libero (oscilla col passo) finché non serve
  armsSwing(m, 0, mv, o.run || 0, 0, SUP);
  m._headLock = using;
  let w = 0;
  if (id === 'minishield' || id === 'shield') {
    const big = id === 'shield';
    // in mano: davanti al ventre, dritta; la pozione grande sorretta anche dalla sinistra
    _u1.set(big ? 0.12 : 0.2, big ? 0.2 : 0.16, 0.3); _u1.z += -hOpp * 0.06;
    _ax.set(0, 1, 0); _fw.set(-0.4, 0, 1);
    let hx = 0, sup = big ? 1 : 0, cap = 0, wipe = 0;
    if (using) {
      // fasi: [t, alla bocca 0..1, testa indietro, inclinazione extra, sinistra sotto il fondo, sinistra al tappo]
      const K = big ? [[0, 0, 0, 0, 1, 0], [0.1, 0, 0, 0, 0.2, 1], [0.22, 0, 0, 0, 0.2, 1], [0.32, 1, 1, 0, 1, 0], [0.55, 1, 1, 0.35, 1, 0],
        [0.62, 0.55, 0.2, 0.2, 1, 0], [0.7, 1, 1, 0.4, 1, 0], [0.86, 1, 1, 0.75, 1, 0], [0.95, 0, 0, 0, 0.3, 0], [1, 0, 0, 0, 1, 0]]
        : [[0, 0, 0, 0], [0.24, 1, 1, 0], [0.5, 1, 1, 0.3], [0.78, 1, 1, 0.65], [1, 0, 0, 0]];
      track(K, u, _tr);
      w = _tr[0];
      const drink = _tr[0], back = _tr[1], extra = _tr[2];
      if (big) { sup = _tr[3]; cap = _tr[4]; wipe = bump01((u - 0.9) / 0.1); }
      // sorsi: piccoli scatti della testa mentre si beve
      const gulp = Math.max(0, Math.sin(u * (big ? 34 : 26))) * back * 0.05;
      hx = -(0.42 + (big ? 0.05 : 0)) * back - gulp + 0.06 * (1 - back) * drink;
      m.head.rotation.x = hx;
      mouthM(m, _mo);
      // collo della bottiglia verso la bocca, il fondo che sale man mano che si svuota
      const tilt = lerp(1.7, 2.25, extra);                      // angolo dall'alto (rad)
      _u2.set(0, Math.cos(tilt), -Math.sin(tilt));              // direzione del collo (verso la bocca)
      const neckLen = big ? 0.165 : 0.105;
      _u3.copy(_mo).addScaledVector(_u2, -neckLen);             // centro della bottiglia
      _u3.y += 0.01; _u3.z += 0.012;
      _u1.lerp(_u3, drink);
      _ax.lerp(_u2, drink).normalize();
      _fw.lerp(_u4.set(-1, 0, 0.2), drink);
      // svitare il tappo: la bottiglia davanti al petto, un po' più su
      if (cap > 0) { _u1.lerp(_u4.set(0.1, 0.3, 0.3), cap); }
    }
    quatYZ(_Q, _ax, _fw);
    setPivotM(m, _u1, _Q);
    // mano destra sul corpo della bottiglia (dal lato della spalla), polso verso il gomito
    wristFromFist(_t, _u1, _ax, SH_MAIN, big ? 0.1 : 0.075);
    ikM(m, 1, _t, _pole.set(0.9, -1, -0.2));
    m.hands[MAIN].rotation.set(0.15, 0, 0);
    // mano sinistra: sotto il fondo (pozione grande), al tappo per svitarlo, o alla bocca per pulirsi
    if (sup > 0.01 || cap > 0.01 || wipe > 0.01) {
      _t2.copy(_u1).addScaledVector(_ax, -(big ? 0.15 : 0.08));
      _t2.x -= 0.03;
      if (cap > 0.01) {
        const a = u * 70;                                      // svita: piccoli giri attorno al tappo
        _u4.copy(_u1).addScaledVector(_ax, 0.19); _u4.x += Math.cos(a) * 0.02 - 0.02; _u4.z += Math.sin(a) * 0.02;
        _t2.lerp(_u4, cap);
      }
      if (wipe > 0.01) { mouthM(m, _u4); _u4.z += 0.06; _u4.x -= 0.06; _u4.y -= 0.03; _t2.lerp(_u4, wipe); }
      ikMBlend(m, 0, _t2, _pole.set(-0.9, -1, -0.1), Math.max(sup, cap, wipe));
    }
    grip(m, 1, sup > 0.5 || cap > 0.5 ? 0.8 : 0);
    if (!using) m._headLock = false;
    return w;
  }
  if (id === 'bandage') {
    // in mano: rotolo davanti al fianco
    _u1.set(0.22, 0.16, 0.28); _u1.z += -hOpp * 0.06;
    _ax.set(1, 0, 0.2).normalize();
    let wrap = 0, pat = 0, armUp = 0;
    if (using) {
      // [t, braccio sinistro su, avvolgi, batti]
      track([[0, 0, 0, 0], [0.1, 1, 0, 0], [0.16, 1, 1, 0], [0.8, 1, 1, 0], [0.86, 1, 0, 1], [0.95, 1, 0, 1], [1, 0, 0, 0]], u, _tr);
      armUp = _tr[0]; wrap = _tr[1]; pat = _tr[2];
      w = armUp;
    }
    // avambraccio sinistro orizzontale davanti al petto (polso al centro, gomito in fuori)
    const wristL = _u2.set(0.02, 0.27, 0.34);
    const elbowL = _u3.set(-0.2, 0.22, 0.2);
    if (armUp > 0.01) {
      // avvolgimento: il rotolo gira attorno all'avambraccio e risale dal polso verso il gomito
      _ax.copy(wristL).sub(elbowL).normalize();
      const along = lerp(0.85, 0.35, clamp((u - 0.16) / 0.64, 0, 1));
      const c = _u4.copy(elbowL).lerp(wristL, along);
      const a = u * 2.2 * 2 * Math.PI * 2.4;                    // circa 5 giri
      _t.set(0, 1, 0).addScaledVector(_ax, -_ax.y).normalize();  // "su" perpendicolare all'avambraccio
      _t2.crossVectors(_ax, _t);
      const r = 0.085;
      const wp = _pa.copy(c).addScaledVector(_t, Math.cos(a) * r).addScaledVector(_t2, Math.sin(a) * r);
      // fissare e battere: la mano preme due volte sul bendaggio
      const pp = _ps.copy(c).addScaledVector(_t, 0.07 - Math.abs(Math.sin(u * 60)) * 0.025);
      wp.lerp(pp, pat);
      _u1.lerp(wp, armUp * Math.max(wrap, pat));
      ikMBlend(m, 0, wristL, _pole.set(-1, -0.4, -0.3), armUp);
      m.hands[SUP].rotation.set(0.1, 0, 0);
      m.head.rotation.x = 0.35 * armUp;
    }
    // asse del rotolo (x locale) parallelo all'avambraccio mentre si avvolge
    _t.set(0, 1, 0).addScaledVector(_ax, -_ax.y).normalize(); _t2.crossVectors(_ax, _t);
    quatYZ(_Q, _t, _t2);
    setPivotM(m, _u1, _Q);
    wristFromFist(_t, _u1, _ax, SH_MAIN, 0.07);
    ikM(m, 1, _t, _pole.set(0.9, -1, -0.4));
    m.hands[MAIN].rotation.set(0.2, 0, 0);
    grip(m, 1, armUp > 0.5 ? 0.2 : 0);
    m._headLock = false;
    return w;
  }
  if (id === 'medkit') {
    // in mano: valigetta appesa alla maniglia lungo il fianco destro, che dondola col passo
    _u1.set(0.31, -0.1, 0.06 - hOpp * 0.12);
    _Q.setFromEuler(_eu.set(-hOpp * 0.25, Math.PI / 2, 0, 'XYZ'));
    let up = 0, work = 0;
    if (using) {
      track([[0, 0, 0], [0.12, 1, 0], [0.18, 1, 1], [0.88, 1, 1], [0.94, 1, 0], [1, 0, 0]], u, _tr);
      up = _tr[0]; work = _tr[1];
      w = up;
    }
    if (up > 0.01) {
      // aperta davanti al ventre, inclinata verso di sé, sorretta dalla sinistra
      _u2.set(-0.02, 0.06, 0.4);
      _u1.lerp(_u2, up);
      _hq.setFromEuler(_eu.set(0.45, 0, 0, 'XYZ'));
      _Q.slerp(_hq, up);
      setPivotM(m, _u1, _Q);
      _t.copy(_u1); _t.y -= 0.12; _t.x -= 0.05; _t.z -= 0.02;
      ikMBlend(m, 0, _t, _pole.set(-1, -0.6, -0.4), up);
      m.hands[SUP].rotation.set(-0.5 * up, 0, 0);
      // destra: dentro la valigetta → applica al corpo → massaggia, tre volte
      const cyc = clamp((u - 0.18) / 0.7, 0, 1) * 3, n = Math.min(2, Math.floor(cyc)), f = cyc - n;
      const tg = [_u3.set(0.04, 0.42, 0.17), _u4.set(-0.1, 0.18, 0.16), _ps.set(-0.2, 0.46, 0.08)][n];
      const into = _pa.copy(_u1); into.y += 0.06; into.z -= 0.02;
      const toBody = smooth((f - 0.25) / 0.2) * (1 - smooth((f - 0.85) / 0.15));
      const rub = toBody * 0.02;
      const hand = into.lerp(tg, toBody);
      hand.x += Math.cos(u * 50) * rub; hand.y += Math.sin(u * 50) * rub;
      _t.copy(_u1); _t.y += 0.12; _t.x += 0.06;               // destra in attesa sopra la valigetta
      _t.lerp(hand, work);
      ikM(m, 1, _t, _pole.set(0.9, -1, -0.5));
      m.hands[MAIN].rotation.set(0.6 * work, 0, 0);
      m.head.rotation.x = 0.42 * up - 0.12 * toBody * work;
      grip(m, toBody > 0.5 ? 0.3 : 0.6, 0.2);
      return w;
    }
    setPivotM(m, _u1, _Q);
    _t.copy(_u1); _t.y += 0.2;                                 // polso sopra la maniglia
    ikM(m, 1, _t, _pole.set(0.6, -1, -0.6));
    m.hands[MAIN].rotation.set(0, 0, 0);
    grip(m, 1, 0);
    m._headLock = false;
    return 0;
  }
  return 0;
}

/**
 * arrampicata: arti alternati (mano sinistra con piede destro). v29: la mano sale veloce a cercare
 * l'appiglio e poi tira giù lenta mentre il corpo sale; il bacino ondeggia verso la gamba che spinge
 * e la testa segue la mano che sale.
 */
export function poseClimb(m, ph) {
  const TAU = Math.PI * 2;
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const u = (((ph + i * Math.PI) / TAU) % 1 + 1) % 1;
    const reach = u < 0.32 ? smooth(u / 0.32) : 1 - smooth((u - 0.32) / 0.68);    // 1 = mano in alto
    const lifting = u < 0.32 ? Math.sin(Math.PI * u / 0.32) : 0;                     // si stacca dal muro mentre sale
    setArm(m, i, -2.2 - 0.62 * reach + lifting * 0.25, side * (0.2 + 0.14 * (1 - reach) + lifting * 0.08), -(0.22 + 1.35 * (1 - reach)) - lifting * 0.35);
    m.hands[i].rotation.x = -0.65 + lifting * 0.4;
    // gamba opposta: sale veloce sul nuovo appoggio, poi spinge
    const v = (u + 0.5) % 1;
    const lift = v < 0.3 ? smooth(v / 0.3) : 1 - smooth((v - 0.3) / 0.7);
    const step = v < 0.3 ? Math.sin(Math.PI * v / 0.3) : 0;
    setLeg(m, i, -0.18 - 0.95 * lift - step * 0.15, 0.32 + 1.45 * lift + step * 0.3, -0.25 * lift + step * 0.2, side * (0.12 + step * 0.08));
  }
  const s1 = Math.sin(ph);
  m.body.position.y = -0.03 + Math.abs(Math.sin(ph)) * 0.05;
  m.body.position.z = 0.04;
  m.body.position.x = s1 * 0.035;
  m.torso.rotation.x = 0.06 + Math.abs(Math.cos(ph)) * 0.05;
  m.torso.rotation.y = s1 * 0.1;
  m.torso.rotation.z = -s1 * 0.07;
  m.head.rotation.x = -0.5;
  m.head.rotation.y = -s1 * 0.18;
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

// ───────────── v38: Artigli del Gargoyle ─────────────
//  Le stesse mosse del boss (swipeR, swipeL, double, spin, pounce) su un corpo umano: le mani vanno
//  sui bersagli con la IK, il busto si carica e ruota, il bacino segue, le gambe fanno il passo e si
//  piegano negli schianti. Tappe: [u, polso destro xyz, polso sinistro xyz, torsione, inclinazione, abbassamento, passo]
const CR = [-0.2, 0.24, 0.42], CL = [0.23, 0.2, 0.37];           // guardia: avambracci in avanti, artigli puntati al bersaglio
const READY = [...CR, ...CL, 0, 0.06, 0.03, 0];
const CLAW_KEYS = {
  swipeR: [
    [0, ...READY],
    [0.36, -0.52, 0.62, -0.1, 0.22, 0.3, 0.34, -0.7, -0.04, 0.05, 0],
    [0.47, -0.1, 0.4, 0.55, 0.27, 0.22, 0.14, 0.3, 0.26, 0.12, 0.8],
    [0.58, 0.36, 0.2, 0.34, 0.3, 0.2, 0.06, 0.85, 0.36, 0.17, 1],
    [0.74, 0.3, 0.22, 0.34, 0.3, 0.22, 0.12, 0.7, 0.3, 0.14, 0.9],
    [1, ...READY],
  ],
  double: [
    [0, ...READY],
    [0.4, -0.17, 0.98, 0.03, 0.17, 0.98, 0.03, 0, -0.32, -0.03, 0],
    [0.53, -0.13, -0.04, 0.5, 0.13, -0.04, 0.5, 0, 0.78, 0.4, 0.55],
    [0.74, -0.14, -0.02, 0.48, 0.14, -0.02, 0.48, 0, 0.7, 0.36, 0.55],
    [1, ...READY],
  ],
  spin: [
    [0, ...READY],
    [0.2, -0.42, 0.36, -0.12, 0.5, 0.44, 0.26, -0.55, 0.1, 0.1, 0],
    [0.32, -0.78, 0.44, 0.12, 0.78, 0.44, 0.12, 0, 0.16, 0.14, 0],
    [0.76, -0.78, 0.44, 0.12, 0.78, 0.44, 0.12, 0, 0.16, 0.14, 0],
    [1, ...READY],
  ],
  pounce: [
    [0, ...READY],
    [0.22, -0.28, 0.14, 0.12, 0.28, 0.14, 0.12, 0, 0.5, 0.34, 0],
    [0.32, -0.2, 0.62, 0.42, 0.2, 0.62, 0.42, 0, -0.12, 0, 0],
    [0.62, -0.22, 0.5, 0.52, 0.22, 0.5, 0.52, 0, 0.22, 0, 0],
    [0.79, -0.13, -0.04, 0.5, 0.13, -0.04, 0.5, 0, 0.75, 0.38, 0.4],
    [0.9, -0.14, -0.02, 0.48, 0.14, -0.02, 0.48, 0, 0.65, 0.32, 0.4],
    [1, ...READY],
  ],
};
const _clk = new Array(12).fill(0), _cR = new THREE.Vector3(), _cL = new THREE.Vector3();
const _cq = [new THREE.Quaternion(), new THREE.Quaternion()], _ce = [0, 0];
const POLE_R = new THREE.Vector3(-0.55, -1, -0.15), POLE_L = new THREE.Vector3(0.55, -1, -0.15);
/**
 * o: { mv, run, sk (corsa), ck, phase, t, move: id | null, u: 0..1 }
 * Restituisce la rotazione extra del corpo attorno a y (la giravolta), già applicata a m.body.
 */
export function poseClaws(m, o) {
  const mv = o.mv || 0, phase = o.phase || 0, sk = o.move ? 0 : smooth(o.sk || 0);
  const id = o.move, u = clamp(o.u || 0, 0, 1);
  let vals;
  if (id) {
    const mirror = id === 'swipeL';
    vals = track(CLAW_KEYS[mirror ? 'swipeR' : id] || CLAW_KEYS.swipeR, u, _clk);
    if (mirror) {
      // sinistra: si scambiano le braccia e si riflette tutto sul piano x = 0
      const r = vals.slice(0, 3), l = vals.slice(3, 6);
      vals[0] = -l[0]; vals[1] = l[1]; vals[2] = l[2]; vals[3] = -r[0]; vals[4] = r[1]; vals[5] = r[2];
      vals[6] = -vals[6]; vals[9] = -vals[9];
    }
  } else { for (let i = 0; i < READY.length; i++) _clk[i] = READY[i]; vals = _clk; }
  const [rx, ry, rz, lx, ly, lz, tw, lean, drop, step] = vals;
  // in guardia gli artigli ondeggiano col passo e respirano
  const bob = id ? 0 : Math.cos(phase * 2) * 0.018 * mv + Math.sin((o.t || 0) * 2) * 0.008;
  _cR.set(rx, ry + bob + Math.sin(phase) * 0.02 * mv, rz);
  _cL.set(lx, ly + bob - Math.sin(phase) * 0.02 * mv, lz);
  // busto e bacino: la torsione parte dai fianchi, l'inclinazione si compensa con la testa
  m.torso.rotation.y += tw;
  m.body.rotation.y += tw * 0.35;
  m.torso.rotation.x += lean;
  m.head.rotation.x -= lean * 0.55;
  m.head.rotation.y -= tw * 0.6;
  let spinY = 0;
  if (id === 'spin') { spinY = -Math.PI * 2 * smooth((u - 0.22) / 0.56); m.body.rotation.y += spinY; }
  // gambe: affondo e passo in avanti (per l'artigliata destra avanza la sinistra)
  if (drop > 0.001) {
    const L = drop / 0.45;
    for (let i = 0; i < 2; i++) { m.legs[i].rotation.x -= L * 1.5; m.knees[i].rotation.x += L * 3.0; m.feet[i].rotation.x -= L * 1.5; }
    m.body.position.y -= drop;
  }
  if (Math.abs(step) > 0.001) {
    const a = step > 0 ? 1 : 0, b = 1 - a, k = Math.abs(step);   // a = gamba che avanza
    m.legs[a].rotation.x -= 0.5 * k; m.knees[a].rotation.x += 0.35 * k; m.feet[a].rotation.x += 0.15 * k;
    m.legs[b].rotation.x += 0.28 * k; m.knees[b].rotation.x += 0.12 * k; m.feet[b].rotation.x -= 0.4 * k;
    m.body.position.y -= 0.04 * k;
  }
  // braccia: in corsa oscillano come senza armi, altrimenti IK sui bersagli
  if (sk > 0.001) {
    armsSwing(m, phase, mv, o.run || 0, o.ck || 0);
    for (let i = 0; i < 2; i++) { _cq[i].copy(m.arms[i].quaternion); _ce[i] = m.elbows[i].rotation.x; }
  }
  armIK(m, 0, _cR, POLE_R);
  armIK(m, 1, _cL, POLE_L);
  if (sk > 0.001) for (let i = 0; i < 2; i++) {
    m.arms[i].quaternion.slerp(_cq[i], sk);
    m.elbows[i].rotation.x = lerp(m.elbows[i].rotation.x, _ce[i], sk);
  }
  // polsi: artigli puntati in avanti, nel colpo seguono la traiettoria
  const hit = id ? Math.sin(Math.PI * u) : 0;
  m.hands[0].rotation.set(-0.25 - 0.35 * hit, 0, -0.1);
  m.hands[1].rotation.set(-0.25 - 0.35 * hit, 0, 0.1);
  grip(m, 1, 1);
  return spinY;
}
