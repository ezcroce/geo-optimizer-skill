// Pose e animazioni dei personaggi articolati (anche, ginocchia, caviglie, spalle, gomiti).
// Condivise tra il gioco (main.js) e il sito (site.js), così le animazioni sono identiche.
import * as THREE from 'three';
import { RIG } from './character.js?v=29';

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
 * v29: ciclo del passo più naturale — tallone che tocca per primo, ginocchio che assorbe l'appoggio,
 * spinta di punta allo stacco, in corsa il tallone sale verso il gluteo; il bacino ondeggia sulla
 * gamba d'appoggio.
 */
export function legsLocomotion(m, phase, mv, run, ck) {
  const toeOff = 0.42 + 0.3 * run, heel = 0.26 - 0.12 * run;
  for (let i = 0; i < 2; i++) {
    const ph = phase + i * Math.PI;
    const s = Math.sin(ph), c = Math.cos(ph);
    let a = Math.atan2(s, c);                                   // -π..π
    let kneeW, footAdd;
    if (c > 0) {
      // volo: t = 0 stacco (gamba dietro) → 1 appoggio (gamba avanti)
      const t = (a + Math.PI / 2) / Math.PI;
      const tk = Math.pow(t, 0.85 - 0.3 * run);                  // in corsa la piega arriva prima (calciata)
      kneeW = Math.pow(Math.sin(Math.PI * tk), 1.3) * (1.0 + 0.85 * run);
      footAdd = (1 - smooth(t / 0.45)) * toeOff * 0.7 - smooth((t - 0.62) / 0.38) * heel;
    } else {
      // appoggio: u = 0 tallone a terra → 1 stacco
      if (a < 0) a += 2 * Math.PI;
      const u = (a - Math.PI / 2) / Math.PI;
      kneeW = (0.1 + 0.36 * run) * Math.sin(Math.PI * clamp(u * 1.5, 0, 1)) + 0.12 * run * smooth((u - 0.75) / 0.25);
      footAdd = -heel * (1 - smooth(u / 0.22)) + toeOff * smooth((u - 0.58) / 0.42);
    }
    const hipW = -s * (0.46 + 0.32 * run) * mv - run * 0.1 * mv;
    const kW = 0.05 + kneeW * mv;
    const footW = -(hipW + kW) + footAdd * mv;
    // accovacciato: anche flesse, ginocchia molto piegate, passi corti e bassi
    const hipC = -1.12 - s * 0.38 * mv - (i ? 0.05 : -0.05) * (1 - mv);
    const kneeC = 2.02 - (i ? 0.08 : -0.08) * (1 - mv) + Math.max(0, c) * 0.3 * mv;
    const footC = -(hipC + kneeC) + Math.max(0, c) * 0.12 * mv;
    setLeg(m, i, lerp(hipW, hipC, ck), lerp(kW, kneeC, ck), lerp(footW, footC, ck), (i ? 1 : -1) * 0.03 * ck);
  }
  // bacino che si sposta sulla gamba d'appoggio (gamba 0 = x negativa)
  m.body.position.x = Math.cos(phase) * 0.024 * mv * (1 - 0.6 * run) * (1 - ck * 0.5);
  // dondolio: camminando il punto più alto è a metà appoggio; correndo è nella fase di volo
  const ac = Math.abs(Math.cos(phase));
  const bob = lerp((ac - 0.6) * 0.036, (0.55 - ac) * 0.075, run) * mv * (1 - ck * 0.6);
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
    // il gomito si piega di più quando il braccio va avanti, e in corsa le braccia "pompano"
    const el = -(0.2 + 1.2 * run) * (0.3 + 0.7 * mv) - Math.max(0, -s) * 0.3 * mv - ck * 0.7;
    setArm(m, i, s * (0.42 + 0.5 * run) * mv - ck * 0.5, side * (0.09 + run * 0.05 + Math.max(0, -s) * 0.04 * mv), el, side * 0.1 * run);
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
export const HELD_SCALE = 0.86;
const DEF_HOLD = { kind: 'rifle', main: [-0.1, -0.05], fore: [-0.05, 0.4], zmin: -0.45, zmax: 0.9, xmin: -0.06, xmax: 0.06, ymin: -0.25, ymax: 0.15 };
export function holdOf(m) { const g = m.gunPivot.children[0]; return (g && g.userData.hold) || DEF_HOLD; }
const _qa = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _pa = new THREE.Vector3(), _ps = new THREE.Vector3();
const _eu = new THREE.Euler(), _m4 = new THREE.Matrix4(), _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3();
const _t = new THREE.Vector3(), _t2 = new THREE.Vector3(), _pole = new THREE.Vector3();
// punti del busto: tasca della spalla (calcio), spalla destra (appoggio del tubo)
const POCKET = new THREE.Vector3(0.155, 0.45, 0.07);
const SHOULDER_TOP = new THREE.Vector3(0.3, 0.6, 0.03);

/** trasforma il punto locale dell'arma (già in scala) in spazio del busto con posizione p e rotazione q */
function gunPoint(out, p, q, x, y, z, s) { return out.set(x * s, y * s, z * s).applyQuaternion(q).add(p); }

/**
 * Posa con l'arma: mira (sk = 0) oppure arma in sicurezza mentre corri (sk = 1).
 * lean: inclinazione in avanti di busto+corpo, compensata perché l'arma resti sulla linea di mira.
 * v29: l'arma è posizionata in base al suo ingombro (calcio alla spalla, tubo sulla spalla, minigun
 * all'anca) e le mani vanno sull'impugnatura con la cinematica inversa: niente più armi dentro il corpo.
 */
export function poseHold(m, pitch, sk = 0, sw = 0, lean = 0) {
  const g = m.gunPivot.children[0];
  const h = holdOf(m), s = HELD_SCALE;
  if (g && g.userData.hold) g.scale.setScalar(s);
  const p = pitch + lean;
  const k = h.kind;
  // ── mira ──
  _qa.setFromEuler(_eu.set(-(k === 'hip' ? p * 0.55 : p), 0, 0));
  if (k === 'pistol') {
    // due mani, braccia tese: ruota attorno al centro delle spalle
    _pa.set(0, 0.04, 0.47).applyQuaternion(_qa).add(_t.set(0.07, 0.42, 0.0));
  } else if (k === 'shoulder') {
    // il tubo poggia sulla spalla: ruota attorno al punto d'appoggio
    _pa.copy(SHOULDER_TOP).sub(gunPoint(_t, _t2.set(0, 0, 0), _qa, 0, h.rest[0], h.rest[1], s));
  } else if (k === 'hip') {
    _pa.set(0.22, 0.2, 0.38);
  } else {
    // calcio nella tasca della spalla; se l'arma è lunga la mano d'appoggio scivola indietro (vedi handsToGun).
    // Le armi corte (calcio ripiegato) stanno più avanti, a braccia tese.
    _pa.copy(POCKET).sub(gunPoint(_t, _t2.set(0, 0, 0), _qa, 0, -0.02, h.zmin + 0.04 - Math.max(0, -0.3 - h.zmin), s));
    // mirando in basso caricatore e impugnatura ruotano verso il ventre: se serve l'arma va più avanti
    const mz = gunPoint(_t, _pa, _qa, 0, h.ymin, h.main[1] + 0.12, s).z;
    if (mz < 0.24) _pa.z += 0.24 - mz;
  }
  // ── corsa ──
  const bob = sw * 0.035;
  if (k === 'pistol') {
    // pistola bassa in una mano, che dondola col passo
    _qs.setFromEuler(_eu.set(0.95 - sw * 0.25, 0.12, 0));
    _ps.set(0.29, 0.08 + Math.abs(sw) * 0.03, 0.17 + sw * 0.1);
  } else if (k === 'shoulder') {
    _qs.setFromEuler(_eu.set(-0.3 + bob, 0, -0.05));
    _ps.copy(SHOULDER_TOP).sub(gunPoint(_t, _t2.set(0, 0, 0), _qs, 0, h.rest[0], h.rest[1], s));
  } else if (k === 'hip') {
    _qs.setFromEuler(_eu.set(0.32 + bob, 0.12, 0));
    _ps.set(0.23, 0.16 + bob * 0.5, 0.36);
  } else if (h.sprint === 'low') {
    // "low ready": calcio alla spalla, bocca verso terra davanti ai piedi (armi larghe come la balestra)
    _qs.setFromEuler(_eu.set(0.78 + bob, 0.1, 0));
    _ps.copy(POCKET).sub(gunPoint(_t, _t2.set(0, 0, 0), _qs, 0, -0.02, h.zmin + 0.04, s));
  } else {
    // "port arms": l'arma di traverso davanti al petto, di piatto, canna in alto a sinistra.
    // La posizione dipende dalla lunghezza: il centro dell'arma sta davanti allo sterno.
    const a = 0.68 + sw * 0.05;                                       // inclinazione sull'orizzontale
    _bz.set(-Math.cos(a), Math.sin(a), 0.32).normalize();             // asse della canna (un po' in avanti)
    _by.set(Math.sin(a), Math.cos(a), 0).normalize();                 // "sopra" dell'arma, nel piano del petto
    _by.addScaledVector(_bz, -_by.dot(_bz)).normalize();
    _bx.crossVectors(_by, _bz);
    _qs.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz));
    const zc = (h.zmin + h.zmax) * 0.5;
    const depth = Math.max(0.07, -h.xmin) * s;                        // ingombro verso il petto
    _ps.set(0.06, 0.32 + bob, 0.2 + depth).sub(gunPoint(_t, _t2.set(0, 0, 0), _qs, 0, 0, zc, s));
    // il calcio non deve rientrare nel fianco
    const bz = gunPoint(_t, _ps, _qs, 0, 0, h.zmin, s).z;
    if (bz < 0.17 + depth) _ps.z += 0.17 + depth - bz;
  }
  // fusione mira ↔ corsa
  const e = smooth(sk);
  m.gunPivot.position.lerpVectors(_pa, _ps, e);
  m.gunPivot.quaternion.slerpQuaternions(_qa, _qs, e);
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
  const P = m.gunPivot.position, Q = m.gunPivot.quaternion;
  const k = h.kind, sk = H.sk;
  // mano dell'impugnatura (braccio 1, lato dell'arma): polso un po' dietro e sotto il palmo
  const pis = k === 'pistol';
  // con la pistola le braccia sono tese in avanti: il polso sta dietro l'impugnatura, non sotto
  gunPoint(_t, P, Q, 0.012, h.main[0] - (pis ? 0.005 : 0.045), h.main[1] - (pis ? 0.095 : 0.075), s);
  _pole.set(0.8, -1, k === 'shoulder' ? 0.3 : -0.35);
  armIK(m, 1, _t, _pole);
  // mano d'appoggio (braccio 0): sul paramano, ma solo fin dove arriva il braccio
  const S0 = m.arms[0].position;
  let fz = h.fore[1];
  if (k === 'rifle') {
    const zMin = h.main[1] + 0.12;
    for (let n = 0; n < 24 && fz > zMin; n++) {
      gunPoint(_t, P, Q, -0.04, h.fore[0] - 0.045, fz - 0.06, s);
      if (_t.distanceTo(S0) <= REACH * 0.985) break;
      fz -= 0.03;
    }
  }
  if (pis) gunPoint(_t, P, Q, -0.045, h.fore[0] - 0.02, fz - 0.07, s);
  else gunPoint(_t, P, Q, -0.04, h.fore[0] - 0.045, fz - 0.06, s);
  if (pis && sk > 0) {
    // corsa con la pistola: la mano libera oscilla opposta al passo
    _t2.set(-0.33, 0.12 + Math.max(0, -H.sw) * 0.1, 0.06 - H.sw * 0.2);
    _t.lerp(_t2, sk);
  }
  if (reload >= 0) {
    // 0–0.3 al caricatore, 0.3–0.55 alla tasca sul fianco, 0.55–0.85 di nuovo al caricatore, poi al paramano
    gunPoint(_t2, P, Q, -0.03, h.ymin * 0.7 - 0.04, k === 'shoulder' ? h.zmin + 0.05 : Math.max(h.main[1] + 0.12, 0.08), s);
    const pouch = _c.set(-0.17, 0.08, 0.12);
    const toMag = smooth(reload / 0.3) * (1 - smooth((reload - 0.85) / 0.15));
    const toPouch = smooth((reload - 0.3) / 0.12) * (1 - smooth((reload - 0.5) / 0.12));
    _t.lerp(_t2, toMag).lerp(pouch, toPouch);
  }
  _pole.set(-0.6, -1, k === 'hip' ? 0.2 : -0.1);
  armIK(m, 0, _t, _pole);
  // polsi: leggera rotazione verso l'impugnatura
  m.hands[1].rotation.set(0.25, 0, 0);
  m.hands[0].rotation.set(0.15, 0, 0);
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
