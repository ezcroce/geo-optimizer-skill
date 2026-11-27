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
  const g = c.getContext('2d'), r = mulberry(66);
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
    mane: new THREE.MeshStandardMaterial({ color: '#7d6a58', roughness: 0.95, flatShading: true }),
    horn: new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.35, metalness: 0.1 }),
    claw: new THREE.MeshStandardMaterial({ color: '#2a221e', roughness: 0.3, metalness: 0.2 }),
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
/** costruisce il gargoyle (alto ~3,3 m, apertura alare ~8 m); l'origine è fra i piedi, guarda verso +z */
export function buildGargoyle() {
  const MT = mats(), rnd = mulberry(4242);
  const root = new THREE.Group();
  const R = { root, legs: [], arms: [], wings: [] };
  const hips = R.hips = bone(root, 0, 1.6, 0);
  add(hips, T(new THREE.SphereGeometry(0.42, 14, 10), 0, 0, -0.02, 0, 0, 0, 1, 0.8, 0.95), MT.skin);
  add(hips, T(new THREE.ConeGeometry(0.16, 0.9, 7), 0, -0.05, -0.55, -2.1, 0, 0), MT.dark);           // moncone di coda
  // gambe digitigrade: coscia → stinco (all'indietro) → metatarso → piede con tre artigli
  for (const s of [-1, 1]) {
    const thigh = bone(hips, s * 0.34, -0.06, 0);
    add(thigh, limbGeo(0.86, 0.24, 0.13, 0.25), MT.skin);
    const shin = bone(thigh, 0, -0.86, 0);
    add(shin, limbGeo(0.78, 0.13, 0.08, 0.1), MT.skin);
    add(shin, T(new THREE.ConeGeometry(0.05, 0.22, 5), 0, -0.05, -0.12, -2.2, 0, 0), MT.horn);        // sperone sul ginocchio
    const ankle = bone(shin, 0, -0.78, 0);
    add(ankle, limbGeo(0.52, 0.085, 0.065, 0.05, 7), MT.dark);
    const toe = bone(ankle, 0, -0.52, 0);
    add(toe, T(new THREE.SphereGeometry(0.13, 8, 6), 0, -0.02, 0.06, 0, 0, 0, 1, 0.55, 1.3), MT.dark);
    for (const k of [-1, 0, 1]) add(toe, T(talonGeo(0.3, 0.035, 0.6), k * 0.07, -0.02, 0.18, -1.45, k * 0.25, 0), MT.claw);
    add(toe, T(talonGeo(0.18, 0.03, 0.5), 0, 0.0, -0.08, 1.9, 0, 0), MT.claw);
    R.legs.push({ thigh, shin, ankle, toe, s });
  }
  // busto ingobbito (ossa lungo +y), criniera, spine sul dorso
  const chest = R.chest = bone(hips, 0, 0.1, 0.02);
  add(chest, T(new THREE.SphereGeometry(0.5, 16, 12), 0, 0.2, 0.04, 0, 0, 0, 0.9, 0.75, 0.82), MT.skin);   // ventre
  add(chest, T(new THREE.SphereGeometry(0.62, 16, 12), 0, 0.68, -0.02, 0, 0, 0, 1.12, 0.78, 0.86), MT.skin); // cassa toracica
  for (const s of [-1, 1]) {
    add(chest, T(new THREE.SphereGeometry(0.3, 10, 8), s * 0.26, 0.74, 0.33, 0, 0, 0, 1, 0.8, 0.55), MT.skin);  // pettorali
    add(chest, T(new THREE.SphereGeometry(0.3, 10, 8), s * 0.52, 0.86, -0.1, 0, 0, 0, 1, 0.85, 1), MT.skin);    // trapezi/spalle
    for (let k = 0; k < 3; k++) add(chest, T(new THREE.SphereGeometry(0.1, 6, 5), s * 0.42, 0.42 - k * 0.12, 0.3 - k * 0.02, 0, 0, 0, 1.4, 0.6, 0.7), MT.skin);   // costole
  }
  {
    const tufts = [];
    for (let i = 0; i < 46; i++) {
      // criniera folta su spalle, collo e alto dorso: ciocche piatte stese all'indietro, che ricadono sul dorso
      const a = (rnd() - 0.5) * Math.PI * 1.35 + Math.PI, h = 0.7 + rnd() * 0.5, rr = 0.42 + rnd() * 0.18;
      const x = Math.sin(a) * rr * 1.2, z = Math.cos(a) * rr * 0.85, len = 0.4 + rnd() * 0.4;
      const cg = new THREE.ConeGeometry(0.1 + rnd() * 0.07, len, 5, 2); cg.translate(0, len / 2, 0);
      { const P = cg.attributes.position; for (let k = 0; k < P.count; k++) { const t = P.getY(k) / len; P.setZ(k, P.getZ(k) * 0.45 - t * t * 0.12); } }
      T(cg, x, h, z, -1.25 - rnd() * 0.5, 0, -x * 0.7 + (rnd() - 0.5) * 0.35);
      tufts.push(cg);
    }
    for (let i = 0; i < 14; i++) {   // collare attorno al collo
      const a = (i / 14) * Math.PI * 2, len = 0.3 + rnd() * 0.2, cg = new THREE.ConeGeometry(0.09, len, 5, 1); cg.translate(0, len / 2, 0);
      T(cg, Math.sin(a) * 0.3, 1.05, Math.cos(a) * 0.22 + 0.08, -0.5 + Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.9); tufts.push(cg);
    }
    for (let i = 0; i < 18; i++) {   // frangia sul petto
      const x = (rnd() - 0.5) * 0.8, len = 0.25 + rnd() * 0.3, cg = new THREE.ConeGeometry(0.06, len, 4, 1); cg.translate(0, -len / 2, 0);
      T(cg, x, 0.98 + rnd() * 0.12, 0.34 + rnd() * 0.08, 0.3 + rnd() * 0.3, 0, (rnd() - 0.5) * 0.5); tufts.push(cg);
    }
    add(chest, M(tufts), MT.mane);
    const spikes = [];
    for (let k = 0; k < 5; k++) { const sp = new THREE.ConeGeometry(0.05, 0.28 - k * 0.03, 5); sp.translate(0, 0.14, 0); T(sp, 0, 0.5 - k * 0.14, -0.5 + k * 0.02, -0.7, 0, 0); spikes.push(sp); }
    add(chest, M(spikes), MT.horn);
  }
  // collo e testa da pipistrello (cranio allungato, muso, orecchie a punta, mascella mobile, zanne)
  const neck = R.neck = bone(chest, 0, 1.05, 0.18);
  add(neck, T(limbGeo(0.36, 0.17, 0.2, 0.05, 8), 0, 0.36, 0, Math.PI, 0, 0), MT.skin);
  const head = R.head = bone(neck, 0, 0.38, 0.06);
  add(head, T(new THREE.SphereGeometry(0.26, 14, 10), 0, 0.06, -0.02, 0, 0, 0, 1, 0.92, 1.12), MT.skin);
  add(head, T(new THREE.SphereGeometry(0.17, 12, 8), 0, -0.04, 0.24, 0, 0, 0, 0.95, 0.75, 1.0), MT.skin);   // muso
  add(head, T(new THREE.BoxGeometry(0.44, 0.08, 0.14), 0, 0.13, 0.2, 0.25, 0, 0), MT.dark);                  // arcata sopraccigliare
  add(head, T(new THREE.SphereGeometry(0.06, 8, 6), 0, 0.0, 0.4, 0, 0, 0, 1.3, 0.8, 0.9), MT.dark);        // naso
  for (const s of [-1, 1]) {
    add(head, T(new THREE.SphereGeometry(0.045, 8, 6), s * 0.11, 0.07, 0.29), MT.eye, false);
    // orecchie lunghe e appuntite, verso dietro e in fuori
    const ear = new THREE.ConeGeometry(0.11, 0.62, 5, 2); ear.translate(0, 0.31, 0);
    { const P = ear.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) * 0.35); }
    add(head, T(ear, s * 0.2, 0.18, -0.05, -0.75, 0, -s * 0.95), MT.skin);
    add(head, T(new THREE.ConeGeometry(0.035, 0.12, 4), s * 0.08, -0.12, 0.33, Math.PI, 0, 0), MT.horn);     // zanne superiori
    add(head, T(new THREE.ConeGeometry(0.06, 0.3, 5), s * 0.16, 0.24, -0.12, -0.9, 0, -s * 0.4), MT.horn);   // cornetti
  }
  add(head, T(new THREE.BoxGeometry(0.2, 0.05, 0.16), 0, -0.13, 0.25), MT.mouth);
  const jaw = R.jaw = bone(head, 0, -0.1, 0.08);
  add(jaw, T(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0.0, 0.14, 0, 0, 0, 0.95, 0.6, 1.1), MT.skin);
  add(jaw, T(new THREE.BoxGeometry(0.18, 0.04, 0.2), 0, -0.01, 0.15), MT.mouth);
  for (const s of [-1, 1]) add(jaw, T(new THREE.ConeGeometry(0.032, 0.11, 4), s * 0.08, 0.04, 0.24), MT.horn);
  // braccia lunghe con mani a quattro artigli
  for (const s of [-1, 1]) {
    const sh = bone(chest, s * 0.64, 0.84, 0.0);
    add(sh, T(new THREE.SphereGeometry(0.24, 10, 8), 0, -0.02, 0), MT.skin);
    add(sh, limbGeo(0.92, 0.19, 0.13, 0.3), MT.skin);
    const el = bone(sh, 0, -0.92, 0);
    add(el, limbGeo(0.9, 0.13, 0.085, 0.25), MT.skin);
    add(el, T(new THREE.ConeGeometry(0.05, 0.3, 5), 0, 0.0, -0.1, -2.5, 0, 0), MT.horn);                  // sperone del gomito
    const hand = bone(el, 0, -0.9, 0);
    add(hand, T(new THREE.SphereGeometry(0.12, 8, 6), 0, -0.07, 0.02, 0, 0, 0, 1.15, 1, 0.75), MT.dark);
    const cl = [];
    for (let k = 0; k < 4; k++) {
      const fx = (k - 1.5) * 0.055, fz = 0.05 - Math.abs(k - 1.5) * 0.02;
      const f = limbGeo(0.18, 0.035, 0.028, 0, 5); T(f, fx, -0.14, fz, 0.35, 0, 0); cl.push(f);
      cl.push(T(talonGeo(0.3, 0.03, 0.7), fx, -0.29, fz + 0.06, 0.35, 0, 0));
    }
    const thumb = talonGeo(0.22, 0.03, 0.6); T(thumb, s * -0.1, -0.08, 0.1, 0.4, 0, s * 0.9); cl.push(thumb);
    add(hand, M(cl), MT.claw);
    R.arms.push({ sh, el, hand, s });
  }
  // ali: omero → avambraccio → tre dita; la membrana è una geometria dinamica
  for (const s of [-1, 1]) {
    const wr = bone(chest, s * 0.28, 0.86, -0.36);
    const arm = bone(wr, 0, 0, 0);
    add(arm, T(limbGeo(1.05, 0.09, 0.06, 0.2, 7), 0, 0, 0, 0, 0, s * Math.PI / 2), MT.dark);
    const fore = bone(arm, s * 1.05, 0, 0);
    add(fore, T(limbGeo(1.45, 0.065, 0.045, 0.1, 6), 0, 0, 0, 0, 0, s * Math.PI / 2), MT.dark);
    const wrist = bone(fore, s * 1.45, 0, 0);
    add(wrist, T(talonGeo(0.24, 0.035, 0.5), 0, 0.04, 0, 0, 0, Math.PI), MT.claw);                             // artiglio del pollice
    const fingers = [];
    for (const [len, base] of [[2.0, 0], [2.15, 0], [1.75, 0]]) {
      const f = bone(wrist, 0, 0, 0);
      add(f, T(limbGeo(len, 0.04, 0.012, 0, 5), 0, 0, 0, 0, 0, s * Math.PI / 2), MT.dark);
      fingers.push({ b: f, len, base });
    }
    R.wings.push({ wr, arm, fore, wrist, fingers, s });
  }
  // membrane (una per ala): ventaglio dal polso alle punte delle dita, poi fino al fianco
  R.membranes = R.wings.map(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MEM_TRIS * 9), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(MEM_TRIS * 6), 2));
    const m = new THREE.Mesh(g, MT.wing); m.castShadow = true; m.frustumCulled = false; root.add(m);
    return m;
  });
  R.pose = defaultPose();
  R.prev = null;
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
