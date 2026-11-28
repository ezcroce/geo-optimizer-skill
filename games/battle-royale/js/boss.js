// ─────────────────────────────────────────────────────────────
//  v38: il Gargoyle, boss dell'arena
//   · modello articolato procedurale: gambe digitigrade, busto ingobbito con criniera, testa da
//     pipistrello con orecchie a punta e mascella mobile, braccia lunghe con artigli, ali membranose
//     (la membrana si ricalcola ogni fotogramma dalle ossa delle dita)
//   · animazioni: riposo, sonno, camminata, corsa a quattro zampe, ruggito, artigliate (destra,
//     sinistra), schianto a due mani, balzo, colpito, morte. Le stesse mosse le usano gli Artigli.
//   · gli Artigli (arma): coppia di guanti con tre lame ricurve, per la mano del giocatore
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sculpt, sculptMaterial } from './sculpt.js?v=52';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
/** 0→1 fra a e b (con curva morbida) */
const seg = (t, a, b) => smooth((t - a) / (b - a));
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ───────────── mosse (condivise col giocatore che impugna gli Artigli) ─────────────
//  dur: durata (s) · hit: istante del colpo (0..1) · reach: portata (m) · arc: mezzo angolo del cono
//  dmg: danno del boss · pdmg: danno degli Artigli · lunge: scatto in avanti (m) · aoe: colpo ad area
export const MOVES = {
  swipeR: { dur: 0.72, hit: 0.48, reach: 3.6, arc: 1.2, dmg: 24, pdmg: 34, lunge: 1.6 },
  swipeL: { dur: 0.72, hit: 0.48, reach: 3.6, arc: 1.2, dmg: 24, pdmg: 34, lunge: 1.6 },
  double: { dur: 1.1, hit: 0.52, reach: 3.8, arc: 1.0, dmg: 34, pdmg: 52, lunge: 1.2, aoe: 3.2 },
  pounce: { dur: 1.25, hit: 0.76, reach: 3.4, arc: 3.2, dmg: 32, pdmg: 46, lunge: 9, aoe: 3.4, air: [0.24, 0.74] },
  spin: { dur: 0.9, hit: 0.55, reach: 3.4, arc: 3.2, dmg: 26, pdmg: 40, lunge: 0.8, aoe: 3.4 },
};
export const MOVE_IDS = Object.keys(MOVES);

// ───────────── materiali e texture ─────────────
let MATS = null;
function skinTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', WRF), r = mulberry(66);
  g.fillStyle = '#c4ae92'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(80,60,45,${0.06 + r() * 0.12})` : `rgba(255,240,220,${0.05 + r() * 0.1})`; g.beginPath(); g.arc(r() * S, r() * S, 0.6 + r() * 2.4, 0, 6.283); g.fill(); }
  for (let i = 0; i < 90; i++) {   // pieghe e rughe
    let x = r() * S, y = r() * S, a = r() * 6.28; g.strokeStyle = `rgba(70,50,38,${0.12 + r() * 0.18})`; g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); } g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2); return t;
}
function mats() {
  if (MATS) return MATS;
  const skin = skinTexture();
  MATS = {
    skin: new THREE.MeshStandardMaterial({ map: skin, color: '#d6c2a6', roughness: 0.78, metalness: 0.0 }),
    dark: new THREE.MeshStandardMaterial({ map: skin, color: '#6a5646', roughness: 0.9 }),
    mane: new THREE.MeshStandardMaterial({ color: '#9a8670', roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }),
    horn: new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.35, metalness: 0.1 }),
    claw: new THREE.MeshStandardMaterial({ color: '#241c18', roughness: 0.28, metalness: 0.25 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#5e1712', roughness: 0.6 }),
    eye: new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb300', emissiveIntensity: 2.2, roughness: 0.3 }),
    wing: new THREE.MeshStandardMaterial({ color: '#8a6452', roughness: 0.85, side: THREE.DoubleSide, map: skin }),
    gold: new THREE.MeshStandardMaterial({ color: '#c99a3a', roughness: 0.35, metalness: 0.85 }),
  };
  return MATS;
}

// ───────────── aiuti per la geometria ─────────────
/** artiglio ricurvo lungo −y (punta in basso), piegato verso +z */
function talonGeo(len, r, bend = 0.35) {
  const g = new THREE.ConeGeometry(r, len, 6, 4); g.rotateX(Math.PI); g.translate(0, -len / 2, 0);   // base nell'origine, punta a −len
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i), t = clamp(-y / len, 0, 1); P.setZ(i, P.getZ(i) + bend * len * t * t); }
  g.computeVertexNormals();
  return g;
}
/** segmento d'arto lungo −y, rastremato, con un rigonfiamento muscolare */
function limbGeo(len, r0, r1, bulge = 0.15, seg = 9) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(lerp(r0, r1, t) * (1 + bulge * Math.sin(t * Math.PI)), -t * len)); }
  pts.unshift(new THREE.Vector2(0.001, r0 * 0.4)); pts.push(new THREE.Vector2(0.001, -len - r1 * 0.4));
  return new THREE.LatheGeometry(pts, seg);
}
function bone(parent, x = 0, y = 0, z = 0) { const b = new THREE.Group(); b.position.set(x, y, z); parent.add(b); return b; }
function add(parent, geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; }
const T = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
const M = (list) => mergeGeometries(list.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; }));

// ═════════════════════════ MODELLO ═════════════════════════
//  v39: scolpito. Il corpo è UNA pelle continua (SkinnedMesh) ricavata da un campo di distanza:
//  decine di muscoli (pettorali, deltoidi, bicipiti, quadricipiti, polpacci, costole, addominali…)
//  fusi morbidamente sulle ossa; testa, mascella, mani e piedi sono sculture più fini attaccate al
//  loro osso. Le ossa restano quelle di prima (stesse pose e animazioni).
const PAL = { skin: '#c4a687', light: '#d8c2a0', belly: '#cfb795', dark: '#8f735a', darker: '#6c5442', pink: '#b27c6a', lip: '#6a4236', claw: '#2a221e' };
let DETAIL = null;
function detailTexture() {
  if (DETAIL) return DETAIL;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', WRF), r = mulberry(91);
  g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3200; i++) { const v = r(); g.fillStyle = v < 0.55 ? `rgba(40,30,25,${0.05 + r() * 0.1})` : `rgba(255,250,240,${0.05 + r() * 0.08})`; g.beginPath(); g.arc(r() * S, r() * S, 0.5 + r() * 2, 0, 6.283); g.fill(); }
  for (let i = 0; i < 140; i++) {   // rughe e pieghe della pelle
    let x = r() * S, y = r() * S, a = r() * 6.28; g.strokeStyle = `rgba(50,35,28,${0.1 + r() * 0.16})`; g.lineWidth = 0.5 + r() * 1.1; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 10; k++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 5; y += Math.sin(a) * 5; g.lineTo(x, y); } g.stroke();
  }
  for (let i = 0; i < 40; i++) {   // venature
    let x = r() * S, y = r() * S, a = r() * 6.28; g.strokeStyle = `rgba(90,60,60,${0.08 + r() * 0.08})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); } g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (DETAIL = t);
}
let FLESH = null;
const flesh = () => FLESH || (FLESH = sculptMaterial(detailTexture(), { scale: 1.6, amount: 0.7, roughness: 0.74 }));

/** ciuffo della criniera: cono morbido, ricurvo, a più segmenti */
function tuftGeo(len, r, bend, twist = 0) {
  const g = new THREE.ConeGeometry(r, len, 6, 5, true); g.translate(0, len / 2, 0);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i), t = y / len; P.setZ(i, P.getZ(i) * 0.55 - bend * len * t * t); P.setX(i, P.getX(i) + twist * len * t * t); }
  g.computeVertexNormals();
  return g;
}

let SCULPTED = null, SCULPT_GEN = null;
/** scolpisce le parti (una volta sola: le ossa nella posa di riferimento sono sempre le stesse) */
function sculptParts(R, bones) {
  if (SCULPTED) return SCULPTED;
  if (!SCULPT_GEN) SCULPT_GEN = sculptSteps(R, bones);
  while (!SCULPTED) SCULPT_GEN.next();
  return SCULPTED;
}
/** prepara la scultura a pezzi nei momenti liberi (menu): niente scatto quando il boss compare */
export function warmGargoyle() {
  if (SCULPTED || SCULPT_GEN) return;
  const R = makeRig();
  SCULPT_GEN = sculptSteps(R, rigBones(R));
  const step = () => { if (SCULPTED) return; SCULPT_GEN.next(); if (!SCULPTED) (window.requestIdleCallback || setTimeout)(step, { timeout: 400 }); };
  setTimeout(step, 0);
}
function* sculptSteps(R, bones) {
  const t0 = performance.now();
  const BI = new Map(bones.map((b, i) => [b, i]));
  const W = (b) => b.matrixWorld;
  const S = new Sculpt({ noise: 0.004, noiseF: 11 });
  const at = (b) => S.at(W(b), BI.get(b));
  // ── bacino e coda ──
  at(R.hips);
  S.ell([0, -0.02, -0.02], [0.38, 0.3, 0.33], null, { col: PAL.skin, k: 0.1 });
  for (const s of [-1, 1]) S.ell([s * 0.17, -0.1, -0.19], [0.2, 0.22, 0.17], [0.2, 0, 0], { col: PAL.skin, k: 0.08 });   // glutei
  S.ell([0, 0.12, 0.12], [0.3, 0.24, 0.26], null, { col: PAL.belly, k: 0.12 });
  S.cone([0, -0.06, -0.28], [0, -0.42, -0.72], 0.13, 0.025, { col: PAL.dark, k: 0.08 });                               // coda
  // ── busto (osso «chest», verso +y) ──
  at(R.chest);
  S.ell([0, 0.2, 0.05], [0.38, 0.36, 0.34], null, { col: PAL.belly, k: 0.12 });                                        // ventre
  S.ell([0, 0.66, -0.03], [0.58, 0.45, 0.48], null, { col: PAL.skin, k: 0.12 });                                       // cassa toracica
  for (const s of [-1, 1]) {
    S.ell([s * 0.23, 0.76, 0.3], [0.26, 0.2, 0.13], [0.15, 0, s * 0.3], { col: PAL.light, k: 0.07 });                  // pettorali
    S.ell([s * 0.37, 0.55, -0.16], [0.2, 0.38, 0.22], [0, 0, s * 0.15], { col: PAL.skin, k: 0.1 });                     // dorsali
    S.ell([s * 0.3, 0.98, -0.12], [0.27, 0.16, 0.23], [0, 0, -s * 0.45], { col: PAL.skin, k: 0.1 });                   // trapezi
    S.ell([s * 0.3, 0.86, -0.36], [0.14, 0.12, 0.14], null, { col: PAL.dark, k: 0.08 });                                // radice dell'ala
    for (let k = 0; k < 3; k++) S.ell([s * 0.4, 0.47 - k * 0.11, 0.26 - k * 0.03], [0.1, 0.045, 0.07], [0, 0, s * 0.5], { col: PAL.skin, k: 0.04 });   // costole
    for (let k = 0; k < 3; k++) S.ell([s * 0.085, 0.08 + k * 0.125, 0.355 - k * 0.012], [0.08, 0.055, 0.045], null, { col: PAL.light, k: 0.035 });   // addominali
  }
  S.cone([0, 0.18, -0.44], [0, 0.98, -0.38], 0.06, 0.07, { col: PAL.dark, k: 0.08 });                                  // spina dorsale
  S.ell([0, 1.0, 0.1], [0.22, 0.17, 0.22], null, { col: PAL.skin, k: 0.1 });                                           // base del collo
  // ── collo ──
  at(R.neck);
  S.cone([0, -0.05, 0], [0, 0.42, 0.05], 0.19, 0.15, { col: PAL.skin, k: 0.08 });
  S.ell([0, 0.17, 0.1], [0.11, 0.2, 0.09], null, { col: PAL.light, k: 0.06 });                                         // gola
  for (const s of [-1, 1]) S.cone([s * 0.1, -0.02, 0.12], [s * 0.04, 0.38, 0.05], 0.06, 0.045, { col: PAL.skin, k: 0.05 });
  // ── gambe digitigrade ──
  for (const L of R.legs) {
    const s = L.s;
    at(L.thigh);
    S.cone([0, 0, 0], [0, -0.86, 0], 0.19, 0.095, { col: PAL.skin, k: 0.1 });
    S.ell([0, -0.36, 0.07], [0.16, 0.35, 0.14], null, { col: PAL.skin, k: 0.08 });                                     // quadricipite
    S.ell([0, -0.38, -0.08], [0.14, 0.33, 0.12], null, { col: PAL.skin, k: 0.08 });                                    // femorali
    S.ell([s * 0.08, -0.28, 0], [0.12, 0.3, 0.14], null, { col: PAL.skin, k: 0.08 });
    S.sphere([0, -0.84, 0.035], 0.088, { col: PAL.skin, k: 0.06 });                                                      // ginocchio
    at(L.shin);
    S.cone([0, 0, 0], [0, -0.78, 0], 0.1, 0.07, { col: PAL.skin, k: 0.08 });
    S.ell([0, -0.22, -0.07], [0.11, 0.25, 0.105], null, { col: PAL.skin, k: 0.07 });                                   // polpaccio
    S.cone([0, -0.06, 0.05], [0, -0.62, 0.03], 0.055, 0.035, { col: PAL.dark, k: 0.05 });
    at(L.ankle);
    S.sphere([0, 0, 0], 0.095, { col: PAL.dark, k: 0.06 });                                                             // garretto
    S.cone([0, 0, 0], [0, -0.52, 0], 0.082, 0.066, { col: PAL.darker, k: 0.06 });
    S.cone([0, -0.02, -0.055], [0, -0.44, -0.035], 0.04, 0.03, { col: PAL.darker, k: 0.04 });                           // tendine
  }
  // ── braccia ──
  for (const A of R.arms) {
    const s = A.s;
    at(A.sh);
    S.ell([s * 0.04, -0.06, 0], [0.24, 0.23, 0.23], null, { col: PAL.skin, k: 0.08 });                                // deltoide
    S.cone([0, 0, 0], [0, -0.92, 0], 0.145, 0.105, { col: PAL.skin, k: 0.08 });
    S.ell([0, -0.4, 0.07], [0.125, 0.27, 0.12], null, { col: PAL.skin, k: 0.07 });                                     // bicipite
    S.ell([0, -0.38, -0.07], [0.135, 0.31, 0.12], null, { col: PAL.skin, k: 0.07 });                                   // tricipite
    S.sphere([0, -0.92, -0.03], 0.1, { col: PAL.skin, k: 0.06 });
    at(A.el);
    S.cone([0, 0, 0], [0, -0.9, 0], 0.115, 0.068, { col: PAL.skin, k: 0.07 });
    S.ell([0, -0.24, 0.03], [0.125, 0.27, 0.115], null, { col: PAL.skin, k: 0.07 });                                  // muscoli dell'avambraccio
    S.ell([0, -0.3, -0.04], [0.095, 0.3, 0.095], null, { col: PAL.dark, k: 0.06 });
    S.sphere([0, -0.88, 0], 0.072, { col: PAL.darker, k: 0.05 });
  }
  const tA = performance.now();
  yield;
  const body = S.mesh(0.03, { bones: bones.length, colorSharp: 0.03, weightSoft: 0.045 });
  const tB = performance.now();
  yield;

  // ── testa (nello spazio dell'osso «head») ──
  const H = new Sculpt({ noise: 0.0025, noiseF: 22 });
  H.ell([0, 0.07, -0.03], [0.24, 0.22, 0.27], null, { col: PAL.skin, k: 0.06 });                                       // cranio
  H.ell([0, 0.1, -0.19], [0.19, 0.17, 0.15], null, { col: PAL.skin, k: 0.06 });
  H.ell([0, -0.04, 0.21], [0.145, 0.11, 0.17], null, { col: PAL.skin, k: 0.07 });                                      // muso
  for (const s of [-1, 1]) {
    H.ell([s * 0.08, -0.08, 0.26], [0.075, 0.065, 0.1], null, { col: PAL.dark, k: 0.04 });                              // labbra/guance
    H.ell([s * 0.15, 0.0, 0.11], [0.07, 0.06, 0.11], [0, s * 0.3, 0], { col: PAL.skin, k: 0.05 });                      // zigomi
    H.cone([0, 0.115, 0.25], [s * 0.19, 0.15, 0.15], 0.045, 0.035, { col: PAL.dark, k: 0.04 });                        // arcata sopraccigliare
    H.sphere([s * 0.105, 0.072, 0.262], 0.044, { sub: true, k: 0.025 });                                              // orbite
    // orecchie da pipistrello: lunghe, piatte, all'indietro e in fuori, con la conca scavata davanti
    H.cone([s * 0.16, 0.15, -0.03], [s * 0.5, 0.6, -0.3], 0.12, 0.008, { flat: [1, 0.28], ref: [0, 0, 1], col: PAL.skin, k: 0.05 });
    H.cone([s * 0.19, 0.2, 0.0], [s * 0.47, 0.57, -0.24], 0.085, 0.004, { flat: [1, 0.22], ref: [0, 0, 1], sub: true, k: 0.02 });
    H.cone([s * 0.18, 0.18, -0.02], [s * 0.46, 0.56, -0.27], 0.07, 0.006, { flat: [1, 0.1], ref: [0, 0, 1], col: PAL.pink, k: 0.0, w: 0.4 });
  }
  H.ell([0, 0.02, 0.375], [0.075, 0.055, 0.05], null, { col: PAL.darker, k: 0.04 });                                   // naso a grugno
  for (const s of [-1, 1]) H.sphere([s * 0.03, 0.005, 0.418], 0.019, { sub: true, k: 0.012 });                         // narici
  H.cone([0, 0.2, 0.1], [0, 0.06, 0.32], 0.03, 0.02, { col: PAL.dark, k: 0.04 });                                      // cresta sul naso
  const head = H.mesh(0.0135, { colorSharp: 0.02, aoStep: 0.02 });
  const tC = performance.now();
  yield;
  // mascella (osso «jaw»)
  const J = new Sculpt({ noise: 0.002, noiseF: 22 });
  J.ell([0, -0.045, 0.13], [0.125, 0.05, 0.17], null, { col: PAL.dark, k: 0.05 });
  J.ell([0, -0.06, 0.26], [0.065, 0.048, 0.06], null, { col: PAL.dark, k: 0.04 });
  for (const s of [-1, 1]) J.ell([s * 0.1, -0.02, 0.0], [0.05, 0.07, 0.08], null, { col: PAL.skin, k: 0.04 });
  const jaw = J.mesh(0.012, { colorSharp: 0.02, aoStep: 0.02 });
  yield;
  // mani (osso «hand»): palmo, quattro dita a due falangi piegate in avanti, pollice
  const hands = [-1, 1].map(s => {
    const M = new Sculpt({ noise: 0.0015, noiseF: 30 });
    M.ell([0, -0.07, 0.015], [0.095, 0.085, 0.05], null, { col: PAL.dark, k: 0.04 });
    M.cone([0, 0.02, 0], [0, -0.08, 0.01], 0.07, 0.075, { col: PAL.darker, k: 0.04 });
    const tips = [];
    for (let k = 0; k < 4; k++) {
      const fx = (k - 1.5) * 0.052, len = k === 0 || k === 3 ? 0.88 : 1;
      const a = [fx, -0.13, 0.03], b = [fx * 1.12, -0.13 - 0.12 * len, 0.065], c = [fx * 1.2, -0.13 - 0.2 * len, 0.125];
      M.cone(a, b, 0.032, 0.027, { col: PAL.darker, k: 0.02 }); M.cone(b, c, 0.027, 0.021, { col: PAL.darker, k: 0.015 });
      M.sphere(a, 0.034, { col: PAL.dark, k: 0.02 });
      tips.push([c, [c[0] - b[0], c[1] - b[1], c[2] - b[2]]]);
    }
    const ta = [-s * 0.07, -0.05, 0.05], tb = [-s * 0.12, -0.11, 0.11], tc = [-s * 0.14, -0.17, 0.165];
    M.cone(ta, tb, 0.034, 0.028, { col: PAL.darker, k: 0.025 }); M.cone(tb, tc, 0.028, 0.021, { col: PAL.darker, k: 0.015 });
    tips.push([tc, [tc[0] - tb[0], tc[1] - tb[1], tc[2] - tb[2]]]);
    return { geo: M.mesh(0.011, { colorSharp: 0.015, aoStep: 0.016 }), tips };
  });
  yield;
  // piedi (osso «toe»): pianta, tre dita in avanti, sperone dietro
  const feet = [-1, 1].map(s => {
    const M = new Sculpt({ noise: 0.0015, noiseF: 30 });
    M.ell([0, -0.035, 0.04], [0.12, 0.065, 0.14], null, { col: PAL.darker, k: 0.04 });
    M.cone([0, 0.05, -0.02], [0, -0.03, 0.03], 0.075, 0.08, { col: PAL.darker, k: 0.04 });
    const tips = [];
    for (let k = -1; k <= 1; k++) {
      const a = [k * 0.055, -0.04, 0.1], b = [k * 0.085, -0.065, 0.22 - Math.abs(k) * 0.02], c = [k * 0.1, -0.09, 0.3 - Math.abs(k) * 0.03];
      M.cone(a, b, 0.045, 0.036, { col: PAL.darker, k: 0.025 }); M.cone(b, c, 0.036, 0.028, { col: PAL.darker, k: 0.02 });
      tips.push([c, [c[0] - b[0], c[1] - b[1], c[2] - b[2]]]);
    }
    M.cone([0, -0.02, -0.06], [0, -0.06, -0.13], 0.04, 0.026, { col: PAL.darker, k: 0.025 });
    tips.push([[0, -0.06, -0.13], [0, -0.3, -0.7]]);
    return { geo: M.mesh(0.012, { colorSharp: 0.015, aoStep: 0.016 }), tips };
  });
  SCULPTED = { body, head, jaw, hands, feet, ms: [tA - t0, tB - tA, tC - tB, performance.now() - tC].map(Math.round).join('/') + ' v' + [body, head, jaw, hands[0].geo, feet[0].geo].map(g => g.attributes.position.count).join('/') };
  return SCULPTED;
}

const _yAxis = new THREE.Vector3(0, -1, 0);
/** artiglio ricurvo con la punta lungo dir (piegato verso «curl») */
function talonAt(parent, base, dir, len, r, bend, mat, curl = [0, 0, 1]) {
  const g = talonGeo(len, r, bend);
  const d = new THREE.Vector3().fromArray(dir).normalize();
  // orienta: −y → dir, e il piegamento (+z) verso «curl» (ortogonalizzato)
  const c = new THREE.Vector3().fromArray(curl); c.addScaledVector(d, -c.dot(d)).normalize();
  const x = new THREE.Vector3().crossVectors(c, d.clone().negate());
  const m = new THREE.Matrix4().makeBasis(x, d.clone().negate(), c).setPosition(new THREE.Vector3().fromArray(base));
  g.applyMatrix4(m);
  return add(parent, g, mat);
}

/** costruisce il gargoyle (alto ~3,3 m, apertura alare ~8 m); l'origine è fra i piedi, guarda verso +z */
function makeRig() {
  const MT = mats();
  const root = new THREE.Group();
  const R = { root, legs: [], arms: [], wings: [] };
  // ── ossa (le stesse di prima) ──
  const hips = R.hips = bone(root, 0, 1.6, 0);
  for (const s of [-1, 1]) {
    const thigh = bone(hips, s * 0.34, -0.06, 0), shin = bone(thigh, 0, -0.86, 0), ankle = bone(shin, 0, -0.78, 0), toe = bone(ankle, 0, -0.52, 0);
    R.legs.push({ thigh, shin, ankle, toe, s });
  }
  const chest = R.chest = bone(hips, 0, 0.1, 0.02);
  const neck = R.neck = bone(chest, 0, 1.05, 0.18);
  const head = R.head = bone(neck, 0, 0.38, 0.06);
  const jaw = R.jaw = bone(head, 0, -0.1, 0.08);
  for (const s of [-1, 1]) {
    const sh = bone(chest, s * 0.64, 0.84, 0.0), el = bone(sh, 0, -0.92, 0), hand = bone(el, 0, -0.9, 0);
    R.arms.push({ sh, el, hand, s });
  }
  // ali: omero → avambraccio → tre dita; la membrana è una geometria dinamica
  for (const s of [-1, 1]) {
    const wr = bone(chest, s * 0.28, 0.86, -0.36);
    const arm = bone(wr, 0, 0, 0);
    add(arm, T(limbGeo(1.05, 0.085, 0.055, 0.25, 10), 0, 0, 0, 0, 0, s * Math.PI / 2), MT.dark);
    const fore = bone(arm, s * 1.05, 0, 0);
    add(fore, T(new THREE.SphereGeometry(0.075, 10, 8), 0, 0, 0), MT.dark);
    add(fore, T(limbGeo(1.45, 0.06, 0.04, 0.12, 9), 0, 0, 0, 0, 0, s * Math.PI / 2), MT.dark);
    const wrist = bone(fore, s * 1.45, 0, 0);
    add(wrist, T(new THREE.SphereGeometry(0.05, 8, 6), 0, 0, 0), MT.dark);
    add(wrist, T(talonGeo(0.24, 0.035, 0.5), 0, 0.04, 0, 0, 0, Math.PI), MT.claw);                             // artiglio del pollice
    const fingers = [];
    for (const [len, base] of [[2.0, 0], [2.15, 0], [1.75, 0]]) {
      const f = bone(wrist, 0, 0, 0);
      add(f, T(limbGeo(len, 0.038, 0.01, 0.04, 7), 0, 0, 0, 0, 0, s * Math.PI / 2), MT.dark);
      add(f, T(talonGeo(0.16, 0.02, 0.4), s * len, 0, 0, 0, 0, s * Math.PI / 2), MT.claw);                    // uncino in punta
      fingers.push({ b: f, len, base });
    }
    R.wings.push({ wr, arm, fore, wrist, fingers, s });
  }
  R.membranes = R.wings.map(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MEM_TRIS * 9), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(MEM_TRIS * 6), 2));
    const m = new THREE.Mesh(g, MT.wing); m.castShadow = true; m.frustumCulled = false; root.add(m);
    return m;
  });
  R.pose = defaultPose();
  R.prev = null;
  applyPose(R, R.pose);
  R.root.updateMatrixWorld(true);
  return R;
}
function rigBones(R) {
  const bones = [R.hips, R.chest, R.neck, R.head];
  for (const L of R.legs) bones.push(L.thigh, L.shin, L.ankle, L.toe);
  for (const A of R.arms) bones.push(A.sh, A.el, A.hand);
  return bones;
}
export function buildGargoyle() {
  const MT = mats(), rnd = mulberry(4242);
  const R = makeRig(), { root, chest, head, jaw } = R;
  // ── scultura (nella posa di riferimento) ──
  const bones = rigBones(R);
  const SP = sculptParts(R, bones);
  R.sculptMs = SP.ms;
  const skin = new THREE.SkinnedMesh(SP.body, flesh());
  skin.castShadow = true; skin.receiveShadow = true; skin.frustumCulled = false;
  root.add(skin);
  skin.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
  R.skin = skin;
  const rigid = (parent, geo) => { const m = new THREE.Mesh(geo, flesh()); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  rigid(head, SP.head); rigid(jaw, SP.jaw);
  R.arms.forEach((A, i) => {
    const H = SP.hands[i]; rigid(A.hand, H.geo);
    H.tips.forEach(([p, d], k) => talonAt(A.hand, p, d, k === 4 ? 0.2 : 0.27, 0.027, 0.75, MT.claw, [0, -0.3, 1]));
    add(A.el, T(talonGeo(0.26, 0.045, 0.3), 0, -0.02, -0.1, -2.5, 0, 0), MT.horn);                                   // sperone del gomito
  });
  R.legs.forEach((L, i) => {
    const F = SP.feet[i]; rigid(L.toe, F.geo);
    F.tips.forEach(([p, d], k) => talonAt(L.toe, p, d, k === 3 ? 0.16 : 0.24, 0.032, 0.6, MT.claw, k === 3 ? [0, 1, 0] : [0, -1, 0.3]));
  });
  // ── testa: occhi, denti, corna ──
  for (const s of [-1, 1]) {
    add(head, T(new THREE.SphereGeometry(0.036, 12, 8), s * 0.105, 0.072, 0.258), MT.eye, false);
    talonAt(head, [s * 0.11, 0.25, -0.06], [s * 0.35, 0.55, -1], 0.34, 0.05, 0.55, MT.horn, [0, 1, 0]);            // cornetti all'indietro
    talonAt(head, [s * 0.075, -0.12, 0.31], [0, -1, 0.1], 0.13, 0.022, 0.15, MT.horn, [0, 0, 1]);                    // zanne superiori
    talonAt(jaw, [s * 0.065, -0.02, 0.26], [0, 1, 0.05], 0.09, 0.018, 0.1, MT.horn, [0, 0, 1]);                       // zanne inferiori
    for (let k = 0; k < 3; k++) talonAt(head, [s * (0.05 - k * 0.012) , -0.125, 0.29 - k * 0.04 - (k ? 0 : 0.0)], [0, -1, 0], 0.045, 0.012, 0, MT.horn);
  }
  add(head, T(new THREE.BoxGeometry(0.17, 0.03, 0.2), 0, -0.13, 0.22), MT.mouth);
  add(jaw, T(new THREE.BoxGeometry(0.15, 0.03, 0.2), 0, -0.01, 0.15), MT.mouth);
  // ── criniera: ciocche morbide e ricurve su spalle, collo e alto dorso, collare e frangia sul petto ──
  {
    const tufts = [];
    const tint = (g, v) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = v; c[i * 3 + 1] = v * 0.94; c[i * 3 + 2] = v * 0.86; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
    for (let i = 0; i < 170; i++) {
      // a strati: quelli interni più corti e scuri, gli esterni lunghi e chiari, ricadono sul dorso
      const layer = rnd(), a = (rnd() - 0.5) * Math.PI * 1.5 + Math.PI, h = 0.66 + rnd() * 0.52, rr = 0.36 + layer * 0.2;
      const x = Math.sin(a) * rr * 1.25, z = Math.cos(a) * rr * 0.92, len = 0.3 + layer * 0.45 + rnd() * 0.15;
      const g = tuftGeo(len, 0.085 + rnd() * 0.06, 0.3 + rnd() * 0.3, (rnd() - 0.5) * 0.5);
      T(g, x, h, z, -1.2 - rnd() * 0.55, (rnd() - 0.5) * 0.5, -x * 0.8 + (rnd() - 0.5) * 0.4);
      tufts.push(tint(g, 0.55 + layer * 0.35 + rnd() * 0.12));
    }
    for (let i = 0; i < 22; i++) {   // collare attorno al collo
      const a = (i / 22) * Math.PI * 2, len = 0.26 + rnd() * 0.2, g = tuftGeo(len, 0.06, 0.2, 0);
      T(g, Math.sin(a) * 0.29, 1.03, Math.cos(a) * 0.22 + 0.08, -0.5 + Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.9);
      tufts.push(tint(g, 0.8 + rnd() * 0.3));
    }
    for (let i = 0; i < 26; i++) {   // frangia sul petto
      const x = (rnd() - 0.5) * 0.75, len = 0.22 + rnd() * 0.26, g = tuftGeo(len, 0.045, -0.25, (rnd() - 0.5) * 0.3); g.rotateX(Math.PI);
      T(g, x, 1.0 + rnd() * 0.1, 0.32 + rnd() * 0.08, 0.3 + rnd() * 0.3, 0, (rnd() - 0.5) * 0.5);
      tufts.push(tint(g, 0.85 + rnd() * 0.25));
    }
    const geo = mergeGeometries(tufts.map(g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
    add(chest, geo, MT.mane);
    const spikes = [];
    for (let k = 0; k < 6; k++) { const sp = talonGeo(0.3 - k * 0.035, 0.045, 0.5); T(sp, 0, 0.42 - k * 0.12, -0.48 + k * 0.015, 2.1, 0, 0); spikes.push(sp); }
    add(chest, M(spikes), MT.horn);
  }
  root.traverse(o => { if (o.isMesh) o.userData.boss = true; });
  return R;
}
const MEM_TRIS = 12;

// ═════════════════════════ POSE ═════════════════════════
//  Una posa è un insieme di numeri (angoli in radianti) che si possono mescolare fra loro.
function defaultPose() {
  return {
    hipY: 0, hipZ: 0, hipX: 0, lean: 0.75, twist: 0, roll: 0, neckX: -0.45, headX: -0.25, headY: 0, jaw: 0.08,
    thL: -0.55, shL: 1.45, anL: -1.25, toL: 0.35, spL: 0.06, thR: -0.55, shR: 1.45, anR: -1.25, toR: 0.35, spR: 0.06,
    aXL: -0.35, aZL: 0.25, aYL: 0, elL: -0.55, wrL: 0.2, aXR: -0.35, aZR: 0.25, aYR: 0, elR: -0.55, wrR: 0.2,
    wSpL: 0, wFlL: 0, wSpR: 0, wFlR: 0, ground: 1, bodyRoll: 0, bodyPitch: 0,
  };
}
const KEYS = Object.keys(defaultPose());
export function mixPose(a, b, k, out = {}) { for (const key of KEYS) out[key] = lerp(a[key], b[key], k); return out; }
function sym(p, key, l, r) { p[key + 'L'] = l; p[key + 'R'] = r ?? l; }

/** riposo: respira, si guarda attorno, ali ripiegate sul dorso */
function poseIdle(T) {
  const p = defaultPose(), br = Math.sin(T * 1.7);
  p.lean = 0.78 + br * 0.03; p.neckX = -0.5 - br * 0.02; p.headY = Math.sin(T * 0.37) * 0.5 + Math.sin(T * 1.13) * 0.08; p.headX = -0.2 + Math.sin(T * 0.5) * 0.08;
  p.jaw = 0.06 + Math.max(0, Math.sin(T * 0.8)) * 0.1;
  p.aXL = p.aXR = -0.4 + br * 0.04; p.elL = p.elR = -0.6;
  p.wSpL = p.wSpR = 0.05 + Math.max(0, Math.sin(T * 0.21)) ** 6 * 0.6;   // ogni tanto si stira le ali
  p.wFlL = p.wFlR = Math.sin(T * 1.7) * 0.03;
  return p;
}
/** accucciato e immobile, avvolto nelle ali */
function poseSleep(T) {
  const p = defaultPose(), br = Math.sin(T * 0.9);
  p.lean = 1.15 + br * 0.02; p.neckX = -0.1; p.headX = 0.35; p.jaw = 0.02;
  sym(p, 'th', -1.25); sym(p, 'sh', 2.4); sym(p, 'an', -1.9); sym(p, 'to', 0.9);
  sym(p, 'aX', -0.9); sym(p, 'el', -1.2); sym(p, 'aZ', 0.15);
  sym(p, 'wSp', 0.12); sym(p, 'wFl', -0.25);
  return p;
}
/** camminata (phase in radianti) e corsa a quattro zampe (run 0..1) */
function poseWalk(phase, run, T) {
  const p = defaultPose(), sn = Math.sin(phase), cs = Math.cos(phase);
  const A = lerp(0.42, 0.75, run);
  p.lean = lerp(0.85, 1.25, run) + Math.abs(cs) * 0.05 * (1 + run);
  p.neckX = lerp(-0.55, -0.85, run); p.headX = lerp(-0.2, -0.35, run);
  p.twist = sn * lerp(0.12, 0.05, run);
  p.hipZ = -sn * 0.04;
  for (const [sd, ph] of [['L', 0], ['R', Math.PI]]) {
    const s1 = Math.sin(phase + ph), c1 = Math.cos(phase + ph), lift = Math.max(0, -c1);
    p['th' + sd] = -0.55 + s1 * A;
    p['sh' + sd] = 1.4 + lift * lerp(0.7, 1.1, run) + run * 0.1;
    p['an' + sd] = -1.2 - lift * 0.55 + s1 * 0.15;
    p['to' + sd] = 0.3 + lift * 0.4;
    // braccia: in camminata oscillano opposte alle gambe; in corsa toccano terra (galoppo da gorilla)
    p['aX' + sd] = lerp(-0.45 - s1 * 0.35, -1.0 - s1 * 0.75, run);
    p['el' + sd] = lerp(-0.55 - lift * 0.3, -0.25 - Math.max(0, s1) * 0.9, run);
    p['aZ' + sd] = lerp(0.25, 0.32, run);
    p['wFl' + sd] = Math.sin(phase * 2) * 0.05 * (1 + run * 3) - run * 0.15;
    p['wSp' + sd] = run * 0.25;
  }
  p.jaw = 0.1 + run * 0.15;
  return p;
}
/** ruggito: si alza sulle zampe, spalanca ali e fauci */
function poseRoar(t, T) {
  const p = defaultPose(), up = seg(t, 0, 0.25) * (1 - seg(t, 0.8, 1)), fl = Math.sin(T * 7) * 0.35 * up;
  p.lean = lerp(0.8, 0.15, up); p.neckX = lerp(-0.5, 0.1, up); p.headX = lerp(-0.2, -0.75, up); p.jaw = lerp(0.08, 0.75, up);
  sym(p, 'th', lerp(-0.55, -0.25, up)); sym(p, 'sh', lerp(1.45, 1.0, up)); sym(p, 'an', lerp(-1.25, -0.95, up));
  sym(p, 'aX', lerp(-0.4, -1.3, up)); sym(p, 'aZ', lerp(0.25, 1.15, up)); sym(p, 'el', lerp(-0.55, -1.0, up));
  sym(p, 'wSp', up); sym(p, 'wFl', 0.35 * up + fl);
  p.hipY = up * 0.15;
  return p;
}
/** artigliata: carica col braccio dietro, poi spazza davanti ruotando tutto il busto (side: 1 = destra) */
function poseSwipe(t, side, T) {
  const p = defaultPose();
  const wind = seg(t, 0, 0.36), strike = seg(t, 0.36, 0.56), rec = seg(t, 0.68, 1);
  const k = wind * (1 - strike), hit = strike * (1 - rec);
  const S = side > 0 ? 'R' : 'L', O = side > 0 ? 'L' : 'R', sg = side > 0 ? -1 : 1;   // lato destro = −x
  p.twist = sg * (0.6 * k - 0.85 * hit);
  p.lean = 0.75 - 0.15 * k + 0.35 * hit;
  p.hipZ = 0; p.hipX = 0.1 * hit;
  p.roll = sg * (0.12 * k - 0.15 * hit);
  p.neckX = -0.5 + 0.1 * k - 0.15 * hit; p.headY = -sg * 0.35 * hit; p.jaw = 0.1 + 0.55 * hit + 0.2 * k;
  p['aX' + S] = lerp(-0.35, 0.5, k) + (-1.55 - 0.5) * hit;
  p['aZ' + S] = lerp(0.25, 1.45, k) - 1.35 * hit;
  p['aY' + S] = sg * 0.5 * hit;
  p['el' + S] = lerp(-0.55, -1.7, k) + 1.4 * hit;
  p['wr' + S] = 0.2 + 0.6 * hit;
  p['aX' + O] = -0.6 + 0.3 * hit; p['aZ' + O] = 0.45 + 0.2 * k; p['el' + O] = -0.9;
  // passo in avanti con la gamba opposta
  p['th' + O] = -0.55 - 0.45 * hit - 0.1 * k; p['sh' + O] = 1.45 + 0.15 * hit;
  p['th' + S] = -0.55 + 0.35 * hit; p['sh' + S] = 1.5 - 0.2 * hit;
  p.wSpL = p.wSpR = 0.25 * k + 0.45 * hit; p.wFlL = p.wFlR = 0.2 * k - 0.25 * hit;
  p.hipY = -0.1 * hit;
  return p;
}
/** schianto: entrambe le braccia alte sopra la testa, ali spalancate, poi giù con tutto il peso */
function poseDouble(t, T) {
  const p = defaultPose();
  const up = seg(t, 0, 0.4) * (1 - seg(t, 0.44, 0.56)), down = seg(t, 0.44, 0.56) * (1 - seg(t, 0.72, 1));
  p.lean = 0.75 - 0.6 * up + 0.75 * down; p.neckX = -0.5 + 0.3 * up - 0.3 * down; p.headX = -0.2 - 0.3 * up; p.jaw = 0.1 + 0.6 * up + 0.4 * down;
  sym(p, 'aX', -0.35 - 2.6 * up - 1.15 * down); sym(p, 'aZ', 0.25 + 0.35 * up - 0.05 * down); sym(p, 'el', -0.55 - 0.6 * up + 0.4 * down);
  sym(p, 'wr', 0.2 + 0.5 * down);
  sym(p, 'th', -0.55 + 0.15 * up - 0.5 * down); sym(p, 'sh', 1.45 - 0.35 * up + 0.7 * down); sym(p, 'an', -1.25 + 0.25 * up - 0.35 * down);
  sym(p, 'wSp', 0.9 * up + 0.7 * down); sym(p, 'wFl', 0.6 * up - 0.5 * down);
  p.hipY = 0.22 * up - 0.35 * down;
  return p;
}
/** balzo: si accuccia, vola disteso in avanti con le braccia tese, atterra schiantandosi */
function posePounce(t, T) {
  const p = defaultPose();
  const crouch = seg(t, 0, 0.22) * (1 - seg(t, 0.22, 0.3)), air = seg(t, 0.24, 0.36) * (1 - seg(t, 0.68, 0.78)), land = seg(t, 0.72, 0.8) * (1 - seg(t, 0.86, 1));
  const fl = Math.sin(T * 14) * 0.55 * air;
  p.lean = 0.75 + 0.35 * crouch + 0.55 * air + 0.6 * land; p.neckX = -0.5 - 0.5 * air; p.headX = -0.2 - 0.25 * air; p.jaw = 0.1 + 0.6 * air + 0.3 * land;
  sym(p, 'th', -0.55 - 0.7 * crouch + 0.9 * air - 0.6 * land); sym(p, 'sh', 1.45 + 0.9 * crouch - 0.6 * air + 0.8 * land); sym(p, 'an', -1.25 - 0.4 * crouch + 0.6 * air - 0.4 * land);
  sym(p, 'aX', -0.35 + 0.4 * crouch - 1.55 * air - 1.0 * land); sym(p, 'aZ', 0.25 + 0.55 * air + 0.1 * land); sym(p, 'el', -0.55 - 0.5 * crouch + 0.35 * air);
  sym(p, 'wSp', 0.35 * crouch + 1.0 * air + 0.6 * land); sym(p, 'wFl', 0.55 * crouch + fl - 0.4 * land);
  p.hipY = -0.45 * crouch - 0.4 * land;
  p.bodyPitch = 0.35 * air;
  return p;
}
/** giravolta: ruota su se stesso con le braccia aperte (colpisce tutto attorno) */
function poseSpin(t, T) {
  const p = defaultPose();
  const k = seg(t, 0, 0.25) * (1 - seg(t, 0.8, 1));
  p.lean = 0.75 + 0.25 * k; p.jaw = 0.1 + 0.5 * k;
  sym(p, 'aX', -0.35 - 0.95 * k); sym(p, 'aZ', 0.25 + 1.1 * k); sym(p, 'el', -0.55 + 0.35 * k);
  sym(p, 'th', -0.55 - 0.25 * k); sym(p, 'sh', 1.45 + 0.45 * k);
  sym(p, 'wSp', 0.85 * k); sym(p, 'wFl', 0.1 * k);
  p.hipY = -0.15 * k;
  p.spinY = 0;
  return p;
}
/** a terra senza vita: crolla su un fianco con le ali afflosciate */
function poseDeath(t, T) {
  const p = defaultPose(), k = seg(t, 0, 0.9);
  p.lean = lerp(0.75, 0.2, k); p.neckX = lerp(-0.5, 0.3, k); p.headX = lerp(-0.2, 0.4, k); p.jaw = 0.45 * k;
  sym(p, 'th', lerp(-0.55, -1.2, k)); sym(p, 'sh', lerp(1.45, 1.8, k)); sym(p, 'an', -1.25);
  sym(p, 'aX', lerp(-0.35, -1.0, k)); sym(p, 'aZ', lerp(0.25, -0.15, k)); sym(p, 'el', -0.6);   // braccia raccolte: nessun arto puntato al cielo
  sym(p, 'wSp', 0.12 * k); sym(p, 'wFl', lerp(0, -0.45, k));   // ali ripiegate: a terra non svettano più
  p.bodyRoll = 1.35 * k; p.hipY = -0.9 * k; p.ground = 1 - k;
  return p;
}

/** posa per uno stato: { st, t (secondi nello stato), phase, run } */
export function poseFor(s, T) {
  const mv = MOVES[s.st], u = mv ? clamp(s.t / mv.dur, 0, 1) : 0;
  switch (s.st) {
    case 'sleep': return poseSleep(T);
    case 'walk': return poseWalk(s.phase, s.run || 0, T);
    case 'roar': return poseRoar(clamp(s.t / 2.0, 0, 1), T);
    case 'swipeR': return poseSwipe(u, 1, T);
    case 'swipeL': return poseSwipe(u, -1, T);
    case 'double': return poseDouble(u, T);
    case 'pounce': return posePounce(u, T);
    case 'spin': return poseSpin(u, T);
    case 'dead': return poseDeath(clamp(s.t / 1.4, 0, 1), T);
    default: return poseIdle(T);
  }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _inv = new THREE.Matrix4();
/** applica una posa alle ossa (e ricalcola le membrane delle ali) */
export function applyPose(R, p, hitK = 0) {
  R.hips.position.set(0, 1.6 + p.hipY, 0);
  R.hips.rotation.set(p.hipX + p.bodyPitch, 0, p.hipZ + p.bodyRoll);
  R.chest.rotation.set(p.lean - hitK * 0.3, p.twist, p.roll);
  R.neck.rotation.set(p.neckX, p.headY * 0.4, 0);
  R.head.rotation.set(p.headX + hitK * 0.3, p.headY * 0.6, 0);
  R.jaw.rotation.x = p.jaw;
  for (const L of R.legs) {
    const sd = L.s > 0 ? 'L' : 'R';
    L.thigh.rotation.set(p['th' + sd], 0, L.s * p['sp' + sd]);
    L.shin.rotation.x = p['sh' + sd]; L.ankle.rotation.x = p['an' + sd]; L.toe.rotation.x = p['to' + sd] - (p['th' + sd] + p['sh' + sd] + p['an' + sd]) * 0.4;
  }
  for (const A of R.arms) {
    const sd = A.s > 0 ? 'L' : 'R';
    A.sh.rotation.set(p['aX' + sd], A.s * p['aY' + sd], A.s * p['aZ' + sd]);
    A.el.rotation.x = Math.min(0, p['el' + sd]); A.hand.rotation.x = p['wr' + sd];
  }
  for (const W of R.wings) {
    const sd = W.s > 0 ? 'L' : 'R', sp = clamp(p['wSp' + sd], 0, 1.2), fl = p['wFl' + sd], s = W.s;
    // chiusa: omero all'indietro e in su, avambraccio ripiegato, dita raccolte; aperta: tutto disteso di lato
    // chiusa: omero in alto e all'indietro, avambraccio che ricade lungo il dorso, dita raccolte verso il basso;
    // aperta: tutto disteso di lato (le dita si spostano via via indietro)
    W.arm.rotation.set(0, s * lerp(0.95, 0.2, sp), s * (lerp(0.95, 0.15, sp) + fl));
    W.fore.rotation.set(0, s * lerp(0.35, 0.3, sp), s * lerp(-2.55, -0.1, sp));
    W.wrist.rotation.set(0, s * lerp(0.1, -0.1, sp), s * lerp(0.3, 0, sp));
    W.fingers.forEach((f, k) => { f.b.rotation.set(0, s * lerp(0.1 + k * 0.12, [-0.15, 0.45, 1.05][k], sp), s * lerp(0.1 - k * 0.08, -0.12 - k * 0.12, sp)); });
  }
  // appoggio: i piedi restano sul suolo (si abbassa/alza il bacino)
  R.root.updateMatrixWorld(true);
  if (p.ground > 0.01) {
    _inv.copy(R.root.matrixWorld).invert();
    let lo = Infinity;
    for (const L of R.legs) { L.toe.getWorldPosition(_v); _v.applyMatrix4(_inv); lo = Math.min(lo, _v.y); }
    R.hips.position.y -= (lo - 0.11) * p.ground;
    R.root.updateMatrixWorld(true);
  }
  updateMembranes(R);
}
function updateMembranes(R) {
  _inv.copy(R.root.matrixWorld).invert();
  const loc = (obj, x = 0, y = 0, z = 0) => { _v.set(x, y, z); obj.localToWorld(_v); return _v.applyMatrix4(_inv).toArray(); };
  R.wings.forEach((W, i) => {
    const s = W.s, root = loc(W.wr), elbow = loc(W.fore), wrist = loc(W.wrist);
    const tips = W.fingers.map(f => loc(f.b, s * f.len, 0, 0));
    const hip = loc(R.hips, s * 0.42, 0.05, -0.15);
    const mid = (a, b, k = 0.5, pull = 0.18) => { const m = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; return [lerp(m[0], wrist[0], pull), lerp(m[1], wrist[1], pull), lerp(m[2], wrist[2], pull)]; };
    const tris = [];
    const push = (a, b, c) => tris.push(a, b, c);
    const m01 = mid(tips[0], tips[1]), m12 = mid(tips[1], tips[2]);
    push(wrist, tips[0], m01); push(wrist, m01, tips[1]); push(wrist, tips[1], m12); push(wrist, m12, tips[2]);
    // tra l'ultimo dito e il fianco (bordo smerlato) e la parte vicino al corpo
    const m2h = mid(tips[2], hip, 0.5, 0.0), sag = [lerp(m2h[0], elbow[0], 0.22), lerp(m2h[1], elbow[1], 0.22), lerp(m2h[2], elbow[2], 0.22)];
    push(wrist, tips[2], sag); push(wrist, sag, elbow); push(elbow, sag, hip); push(elbow, hip, root);
    const g = R.membranes[i].geometry, P = g.attributes.position, U = g.attributes.uv;
    for (let k = 0; k < MEM_TRIS * 3; k++) {
      const v = tris[k] || tris[tris.length - 1];
      P.setXYZ(k, v[0], v[1], v[2]); U.setXY(k, v[0] * 0.4, v[1] * 0.4 + v[2] * 0.3);
    }
    P.needsUpdate = true; U.needsUpdate = true;
    g.computeVertexNormals(); g.computeBoundingSphere();
  });
}

/**
 * aggiorna l'animazione del boss: st = { st, t, phase, run }; mescola dolcemente col precedente
 * (R._from = posa da cui si parte, R._blend = 0..1)
 */
export function animateGargoyle(R, st, dt, T, hitK = 0) {
  if (R._st !== st.st) { R._from = { ...(R._cur || poseFor(st, T)) }; R._blend = 0; R._st = st.st; }
  R._blend = Math.min(1, (R._blend ?? 1) + dt / (st.st === 'dead' ? 0.15 : 0.18));
  const target = poseFor(st, T);
  R._cur = R._blend < 1 ? mixPose(R._from, target, smooth(R._blend)) : target;
  applyPose(R, R._cur, hitK);
}

/** punti di impatto per i proiettili (coordinate del mondo): [x, y, z, raggio, testa?] */
const _hs = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
export function hitSpheres(R) {
  R.hips.getWorldPosition(_hs[0]);
  R.chest.localToWorld(_hs[1].set(0, 0.6, 0));
  R.head.localToWorld(_hs[2].set(0, 0.04, 0.1));
  R.chest.localToWorld(_hs[3].set(0, 0.15, 0.05));
  return [[_hs[0], 0.62, false], [_hs[1], 0.82, false], [_hs[3], 0.62, false], [_hs[2], 0.36, true]];
}

// ═════════════════════════ ARTIGLI (arma) ═════════════════════════
/** un guanto: bracciale di cuoio scuro con fibbie d'oro e tre lame ricurve oltre le nocche (lungo +z) */
function clawGauntletGeo() {
  const parts = { leather: [], gold: [], claw: [], mane: [] };
  parts.leather.push(T(new THREE.CylinderGeometry(0.058, 0.07, 0.24, 10), 0, 0, -0.04, Math.PI / 2, 0, 0));
  parts.leather.push(T(new THREE.BoxGeometry(0.11, 0.06, 0.1), 0, 0, 0.1));
  for (const z of [-0.12, 0.03]) parts.gold.push(T(new THREE.TorusGeometry(0.07, 0.012, 5, 12), 0, 0, z));
  parts.gold.push(T(new THREE.BoxGeometry(0.12, 0.03, 0.05), 0, 0.03, 0.13));
  for (let k = -1; k <= 1; k++) {
    const t = talonGeo(0.34, 0.02, 0.45); T(t, 0, 0, 0, -Math.PI / 2, 0, 0); T(t, k * 0.035, 0.02, 0.15, 0, k * 0.08, 0);
    { const P = t.attributes.position; for (let i = 0; i < P.count; i++) P.setX(i, P.getX(i) * 0.5); }
    parts.claw.push(t);
  }
  const r = mulberry(9);
  for (let i = 0; i < 8; i++) { const c = new THREE.ConeGeometry(0.02, 0.09 + r() * 0.05, 4); T(c, (r() - 0.5) * 0.09, 0.05, -0.15 + r() * 0.12, -1.2, 0, (r() - 0.5) * 0.6); parts.mane.push(c); }
  return { leather: M(parts.leather), gold: M(parts.gold), claw: M(parts.claw), mane: M(parts.mane) };
}
let CLAW_GEO = null;
const CLAW_MATS = {};
function clawMats() {
  if (CLAW_MATS.leather) return CLAW_MATS;
  Object.assign(CLAW_MATS, {
    leather: new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d6a640', roughness: 0.3, metalness: 0.9 }),
    claw: new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.25, metalness: 0.15, emissive: '#3a1a00', emissiveIntensity: 0.15 }),
    mane: new THREE.MeshStandardMaterial({ color: '#7d6a58', roughness: 0.95, flatShading: true }),
  });
  return CLAW_MATS;
}
/** un guanto (gruppo) — lame lungo +z */
export function buildClawGauntlet() {
  CLAW_GEO = CLAW_GEO || clawGauntletGeo();
  const g = new THREE.Group(), mt = clawMats();
  for (const k of ['leather', 'gold', 'claw', 'mane']) { const m = new THREE.Mesh(CLAW_GEO[k], mt[k]); m.castShadow = true; g.add(m); }
  return g;
}
/** la coppia di Artigli (per il bottino a terra e l'icona) */
export function buildClawsPair() {
  const g = new THREE.Group();
  const a = buildClawGauntlet(), b = buildClawGauntlet();
  a.position.set(-0.07, 0, 0); a.rotation.set(0, 0.12, 0.25);
  b.position.set(0.07, 0.0, -0.06); b.rotation.set(0, -0.12, -0.25);
  g.add(a, b);
  return g;
}
