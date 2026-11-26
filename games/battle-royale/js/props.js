// ─────────────────────────────────────────────────────────────
//  Oggetti 3D low-poly semi-realistici (geometrie con colori per vertice)
//  01 albero · 02 catasta di legna · 03 pila di mattoni · 05 casetta · 06 barile
//  Se nella cartella models/ ci sono i file .glb originali, vengono usati quelli.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { normalFromHeight, NORMALS } from './texgen.js?v=19';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/**
 * Una parte di un modello: geometria + colore (+ trasformazione).
 * opts.jit = variazione casuale di luminosità per faccia (look low-poly)
 * opts.colorFn(nx, ny, nz, x, y, z) → colore personalizzato per faccia
 */
function part(geo, color, o = {}) {
  return { geo, color, o };
}

/** Unisce più parti in un'unica geometria non indicizzata con colori per vertice */
export function mergeParts(parts, seed = 1) {
  const rnd = mulberry32(seed);
  const pos = [], nor = [], col = [];
  const n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3();
  for (const { geo, color, o } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (o.post) g.applyMatrix4(o.post);
    const P = g.attributes.position;
    const base = new THREE.Color(color);
    const faceK = new Map();
    for (let i = 0; i < P.count; i += 3) {
      a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); cc.fromBufferAttribute(P, i + 2);
      n.subVectors(cc, b).cross(_p.subVectors(a, b)).normalize();
      if (o.colorFn) _c.set(o.colorFn(n.x, n.y, n.z, (a.x + b.x + cc.x) / 3, (a.y + b.y + cc.y) / 3, (a.z + b.z + cc.z) / 3, rnd) || color);
      else _c.copy(base);
      const j = o.jit ?? 0.08;
      // v22: stessa variazione per i triangoli complanari (niente diagonali chiare/scure sulle facce piatte di assi e casse)
      const nk = `${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}`;
      let k = faceK.get(nk);
      if (k === undefined) { k = 1 + (rnd() * 2 - 1) * j; faceK.set(nk, k); }
      // le facce rivolte verso l'alto sono un po' più chiare (luce dal cielo)
      const sky = o.noSky ? 1 : 1 + Math.max(0, n.y) * 0.06;
      const r = Math.min(1, _c.r * k * sky), gg = Math.min(1, _c.g * k * sky), bb = Math.min(1, _c.b * k * sky);
      for (let v = 0; v < 3; v++) {
        pos.push(P.getX(i + v), P.getY(i + v), P.getZ(i + v));
        nor.push(n.x, n.y, n.z);
        col.push(r, gg, bb);
      }
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  out.userData.shared = true;
  return out;
}

/** sposta i vertici in modo casuale (forme più naturali) */
function wobble(geo, amt, seed, keepBottom = false) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const rnd = mulberry32(seed);
  const P = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < P.count; i++) {
    const key = `${P.getX(i).toFixed(3)}|${P.getY(i).toFixed(3)}|${P.getZ(i).toFixed(3)}`;
    let d = map.get(key);
    if (!d) { d = [(rnd() * 2 - 1) * amt, (rnd() * 2 - 1) * amt, (rnd() * 2 - 1) * amt]; map.set(key, d); }
    if (keepBottom && P.getY(i) < -0.2) continue;
    P.setXYZ(i, P.getX(i) + d[0], P.getY(i) + d[1], P.getZ(i) + d[2]);
  }
  return g;
}

// ═════════════ 01 · ALBERI ═════════════
function trunkParts(h, r0, r1, color, lean = 0) {
  return [part(new THREE.CylinderGeometry(r1, r0, h, 7, 2), color, { y: h / 2, rz: lean, jit: 0.12 })];
}

function makePine() {
  const parts = trunkParts(3.2, 0.32, 0.18, '#5e3d22');
  // radici
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.BoxGeometry(0.16, 0.2, 0.7), '#5a3a20', { y: 0.08, ry: i * Math.PI / 2 + 0.4, z: 0, x: 0, post: new THREE.Matrix4().makeTranslation(Math.sin(i * Math.PI / 2 + 0.4) * 0.3, 0, Math.cos(i * Math.PI / 2 + 0.4) * 0.3) }));
  const tiers = [[2.4, 2.3, 2.1], [1.95, 2.1, 3.2], [1.5, 1.9, 4.25], [1.05, 1.7, 5.25], [0.6, 1.3, 6.15]];
  const greens = ['#2a5d2f', '#2f6834', '#357238', '#3b7c3e', '#43884a'];
  tiers.forEach(([r, h, y], i) => {
    const cone = wobble(new THREE.ConeGeometry(r, h, 8, 1), 0.12, 11 + i);
    parts.push(part(cone, greens[i], { y: y + h / 2 - 0.2, ry: i * 0.7, jit: 0.13, colorFn: (nx, ny, nz, x, yy, z, rnd) => ny < -0.3 ? '#1f4524' : null }));
  });
  return mergeParts(parts, 101);
}

function makeOak() {
  const parts = trunkParts(3.4, 0.4, 0.24, '#6a4526');
  // rami
  parts.push(part(new THREE.CylinderGeometry(0.08, 0.13, 1.6, 6), '#6a4526', { x: 0.45, y: 3.2, rz: -0.8, jit: 0.1 }));
  parts.push(part(new THREE.CylinderGeometry(0.07, 0.12, 1.4, 6), '#6a4526', { x: -0.4, y: 3.3, z: 0.2, rz: 0.75, ry: 0.4, jit: 0.1 }));
  // chioma a grappoli
  const blobs = [[0, 4.7, 0, 1.9], [1.2, 4.3, 0.3, 1.35], [-1.15, 4.4, -0.2, 1.4], [0.3, 4.4, 1.15, 1.3], [-0.2, 4.3, -1.15, 1.3], [0.2, 5.7, 0.1, 1.3]];
  const greens = ['#4b9437', '#559f3d', '#438731', '#5aa842', '#4f9a3a', '#62b048'];
  blobs.forEach(([x, y, z, r], i) => {
    const g = wobble(new THREE.IcosahedronGeometry(r, 0), r * 0.12, 30 + i);
    parts.push(part(g, greens[i], { x, y, z, jit: 0.14, colorFn: (nx, ny) => ny < -0.4 ? '#346b28' : null }));
  });
  return mergeParts(parts, 202);
}

function makeBirch() {
  const parts = [];
  // tronco bianco con segni scuri
  parts.push(part(new THREE.CylinderGeometry(0.15, 0.24, 4.2, 7, 6), '#e6e2d6', {
    y: 2.1, jit: 0.05,
    colorFn: (nx, ny, nz, x, y, z, rnd) => (rnd() < 0.22 ? '#3a3a36' : '#e8e4d8'),
  }));
  const blobs = [[0, 4.4, 0, 1.25, 1.5], [0.15, 5.6, -0.1, 1.05, 1.4], [-0.1, 6.6, 0.1, 0.75, 1.3]];
  const greens = ['#7ab546', '#86bf4e', '#93c957'];
  blobs.forEach(([x, y, z, r, sy], i) => {
    const g = wobble(new THREE.DodecahedronGeometry(r, 0), r * 0.1, 60 + i);
    parts.push(part(g, greens[i], { x, y, z, sy, jit: 0.13 }));
  });
  return mergeParts(parts, 303);
}

// versioni semplificate per la media distanza (stessa sagoma e colori, molti meno triangoli)
function makePineLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.2, 0.3, 3.2, 5, 1, true), '#5e3d22', { y: 1.6 }),
    part(new THREE.ConeGeometry(2.3, 3.6, 6, 1, true), '#2f6834', { y: 3.6, jit: 0.1 }),
    part(new THREE.ConeGeometry(1.5, 3.0, 6, 1, true), '#3b7c3e', { y: 5.5, ry: 0.5, jit: 0.1 }),
  ], 111);
}
function makeOakLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.24, 0.4, 3.4, 5, 1, true), '#6a4526', { y: 1.7 }),
    part(new THREE.IcosahedronGeometry(2.3, 0), '#4f9a3a', { y: 4.7, sy: 0.85, jit: 0.12 }),
    part(new THREE.IcosahedronGeometry(1.3, 0), '#5aa842', { y: 5.8, x: 0.3, jit: 0.12 }),
  ], 222);
}
function makeBirchLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.15, 0.24, 4.2, 5, 1, true), '#e6e2d6', { y: 2.1 }),
    part(new THREE.IcosahedronGeometry(1.3, 0), '#86bf4e', { y: 5.2, sy: 1.6, jit: 0.12 }),
  ], 333);
}

// ═════════════ alberi dei biomi ═════════════
const SNOWC = '#dde5ee';
function makeSnowPine() {
  const parts = trunkParts(3.0, 0.3, 0.17, '#4e3420');
  const tiers = [[2.3, 2.2, 2.0], [1.85, 2.0, 3.1], [1.4, 1.8, 4.1], [0.95, 1.6, 5.05], [0.55, 1.2, 5.9]];
  const greens = ['#1f4a2c', '#24522f', '#2a5b33', '#2f6437', '#356d3c'];
  tiers.forEach(([r, h, y], i) => {
    const cone = wobble(new THREE.ConeGeometry(r, h, 8, 1), 0.12, 15 + i);
    // neve sulle facce rivolte verso l'alto
    parts.push(part(cone, greens[i], { y: y + h / 2 - 0.2, ry: i * 0.7, jit: 0.1, colorFn: (nx, ny, nz, x, yy, z, rnd) => ny > 0.3 && rnd() < 0.85 ? SNOWC : (ny < -0.3 ? '#173a22' : null) }));
  });
  parts.push(part(wobble(new THREE.ConeGeometry(0.32, 0.6, 6, 1), 0.04, 9), SNOWC, { y: 6.7, jit: 0.04 }));
  return mergeParts(parts, 121);
}
function makeSnowPineLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.2, 0.3, 3, 5, 1, true), '#4e3420', { y: 1.5 }),
    part(new THREE.ConeGeometry(2.2, 3.5, 6, 1, true), '#24522f', { y: 3.5, jit: 0.1, colorFn: (nx, ny) => ny > 0.45 ? SNOWC : null }),
    part(new THREE.ConeGeometry(1.4, 2.9, 6, 1, true), '#2f6437', { y: 5.3, ry: 0.5, jit: 0.1, colorFn: (nx, ny) => ny > 0.45 ? SNOWC : null }),
  ], 131);
}
function makeAutumnOak() {
  const parts = trunkParts(3.3, 0.4, 0.24, '#5e3b22');
  parts.push(part(new THREE.CylinderGeometry(0.08, 0.13, 1.6, 6), '#5e3b22', { x: 0.45, y: 3.2, rz: -0.8, jit: 0.1 }));
  parts.push(part(new THREE.CylinderGeometry(0.07, 0.12, 1.4, 6), '#5e3b22', { x: -0.4, y: 3.3, z: 0.2, rz: 0.75, ry: 0.4, jit: 0.1 }));
  const blobs = [[0, 4.6, 0, 1.85], [1.2, 4.2, 0.3, 1.3], [-1.15, 4.3, -0.2, 1.35], [0.3, 4.3, 1.15, 1.25], [-0.2, 4.2, -1.15, 1.25], [0.2, 5.6, 0.1, 1.25]];
  const cols = ['#d9822b', '#c8562a', '#e0a030', '#b8452a', '#d97a2a', '#e8b040'];
  blobs.forEach(([x, y, z, r], i) => {
    const g = wobble(new THREE.IcosahedronGeometry(r, 0), r * 0.13, 70 + i);
    parts.push(part(g, cols[i], { x, y, z, jit: 0.16, colorFn: (nx, ny) => ny < -0.4 ? '#8a3a1c' : null }));
  });
  return mergeParts(parts, 212);
}
function makeAutumnOakLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.24, 0.4, 3.3, 5, 1, true), '#5e3b22', { y: 1.65 }),
    part(new THREE.IcosahedronGeometry(2.25, 0), '#d27a2a', { y: 4.6, sy: 0.85, jit: 0.14 }),
    part(new THREE.IcosahedronGeometry(1.25, 0), '#e2a434', { y: 5.7, x: 0.3, jit: 0.12 }),
  ], 232);
}
function makeAutumnBirch() {
  const parts = [part(new THREE.CylinderGeometry(0.15, 0.24, 4.2, 7, 6), '#e6e2d6', { y: 2.1, jit: 0.05, colorFn: (nx, ny, nz, x, y, z, rnd) => (rnd() < 0.22 ? '#3a3a36' : '#e8e4d8') })];
  const blobs = [[0, 4.4, 0, 1.25, 1.5], [0.15, 5.6, -0.1, 1.05, 1.4], [-0.1, 6.6, 0.1, 0.75, 1.3]];
  const cols = ['#e8c02c', '#f0cf3a', '#f2b632'];
  blobs.forEach(([x, y, z, r, sy], i) => parts.push(part(wobble(new THREE.DodecahedronGeometry(r, 0), r * 0.1, 64 + i), cols[i], { x, y, z, sy, jit: 0.14 })));
  return mergeParts(parts, 313);
}
function makeAutumnBirchLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.15, 0.24, 4.2, 5, 1, true), '#e6e2d6', { y: 2.1 }),
    part(new THREE.IcosahedronGeometry(1.3, 0), '#eec636', { y: 5.2, sy: 1.6, jit: 0.12 }),
  ], 343);
}
function makePalm() {
  const parts = [];
  // tronco curvo ad anelli
  let x = 0, y = 0, lean = 0;
  for (let i = 0; i < 7; i++) {
    const h = 0.95, r = 0.27 - i * 0.017;
    parts.push(part(new THREE.CylinderGeometry(r * 0.9, r, h, 7, 1), i % 2 ? '#8a6a44' : '#7a5c3a', { x, y: y + h / 2, rz: -lean, jit: 0.06 }));
    y += h * Math.cos(lean); x += h * Math.sin(lean); lean += 0.045;
  }
  // foglie: lunghe lame inclinate verso il basso
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + 0.2, len = 2.9 + (k % 3) * 0.3;
    const leaf = wobble(new THREE.BoxGeometry(len, 0.06, 0.7, 4, 1, 1), 0.04, 500 + k);
    // piega la foglia: le punte scendono
    const P = leaf.attributes.position;
    for (let i = 0; i < P.count; i++) { const u = (P.getX(i) + len / 2) / len; P.setY(i, P.getY(i) - u * u * 1.3); P.setZ(i, P.getZ(i) * (1 - u * 0.75)); }
    leaf.translate(len / 2, 0, 0);
    parts.push(part(leaf, k % 2 ? '#3f9a3a' : '#4fae44', { x, y: y + 0.05, ry: a, rz: 0.25, jit: 0.12, colorFn: (nx, ny) => ny < -0.5 ? '#2c6e2a' : null }));
  }
  for (let k = 0; k < 3; k++) parts.push(part(new THREE.IcosahedronGeometry(0.17, 0), '#6a4a22', { x: x + Math.cos(k * 2.1) * 0.22, y: y - 0.25, z: Math.sin(k * 2.1) * 0.22 }));
  return mergeParts(parts, 404);
}
function makePalmLow() {
  const parts = [part(new THREE.CylinderGeometry(0.18, 0.27, 6.6, 5, 1, true), '#7a5c3a', { y: 3.3, x: 0.35, rz: -0.12 })];
  for (let k = 0; k < 5; k++) parts.push(part(new THREE.BoxGeometry(2.8, 0.06, 0.6), '#46a43f', { x: 0.75 + Math.cos(k * 1.256) * 1.2, y: 6.2, z: Math.sin(k * 1.256) * 1.2, ry: -k * 1.256, rz: -0.35 }));
  return mergeParts(parts, 414);
}
function makeCactus() {
  const g = '#4f8a3a', parts = [];
  const rib = (nx, ny, nz, x, y, z, rnd) => (rnd() < 0.3 ? '#447a32' : (ny > 0.7 ? '#62a048' : null));
  parts.push(part(new THREE.CylinderGeometry(0.34, 0.4, 4.2, 8, 3), g, { y: 2.1, jit: 0.06, colorFn: rib }));
  parts.push(part(new THREE.SphereGeometry(0.34, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), g, { y: 4.2, colorFn: rib }));
  for (const [s, y0, h] of [[1, 1.6, 1.5], [-1, 2.3, 1.2]]) {
    parts.push(part(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 7), g, { x: s * 0.5, y: y0, rz: Math.PI / 2, colorFn: rib }));
    parts.push(part(new THREE.CylinderGeometry(0.21, 0.22, h, 7, 2), g, { x: s * 0.85, y: y0 + h / 2 - 0.1, colorFn: rib }));
    parts.push(part(new THREE.SphereGeometry(0.21, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), g, { x: s * 0.85, y: y0 + h - 0.1 }));
  }
  parts.push(part(new THREE.IcosahedronGeometry(0.12, 0), '#f07aa0', { y: 4.5, noSky: true }));
  return mergeParts(parts, 505);
}
function makeCactusLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.34, 0.4, 4.4, 5, 1), '#4f8a3a', { y: 2.2 }),
    part(new THREE.BoxGeometry(1.7, 0.36, 0.36), '#4f8a3a', { y: 1.8 }),
    part(new THREE.BoxGeometry(0.36, 1.4, 0.36), '#4f8a3a', { x: 0.85, y: 2.5 }),
  ], 515);
}
function makeDeadTree() {
  const c = '#6b5a4a', parts = trunkParts(3.6, 0.32, 0.14, c, 0.05);
  const br = [[0.6, 2.4, 0, -0.9, 1.6], [-0.55, 2.9, 0.2, 0.85, 1.5], [0.2, 3.3, -0.5, 0.6, 1.3], [-0.1, 3.7, 0.45, -0.5, 1.1], [0.45, 3.9, 0.1, -0.35, 0.9]];
  br.forEach(([x, y, z, rz, h], i) => parts.push(part(new THREE.CylinderGeometry(0.035, 0.09, h, 5), i % 2 ? '#5f4f40' : c, { x, y, z, rz, ry: i * 1.3, jit: 0.08 })));
  return mergeParts(parts, 606);
}
function makeDeadTreeLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.14, 0.32, 3.6, 4, 1, true), '#6b5a4a', { y: 1.8 }),
    part(new THREE.BoxGeometry(1.8, 0.12, 0.12), '#6b5a4a', { y: 2.9, rz: 0.5 }),
  ], 616);
}

// ═════════════ rocce ═════════════
function makeRock(seed, kind = 0) {
  const rnd = mulberry32(seed * 7 + 3);
  // 0 = masso tondeggiante, 1 = lastra piatta, 2 = spuntone, 3 = masso spaccato
  const base = kind === 2 ? new THREE.OctahedronGeometry(1, 1) : new THREE.DodecahedronGeometry(1, 1);
  let g = wobble(base, kind === 3 ? 0.24 : 0.16, seed);
  if (kind === 1) g.scale(1.35, 0.5, 1.1);
  if (kind === 2) g.scale(0.75, 1.45, 0.8);
  if (kind === 3) { g.scale(1.15, 0.85, 1); }
  // v22: colore di base uniforme con leggere variazioni per faccia (stile low-poly); muschio e neve li dipinge lo shader
  const warm = rnd() < 0.5;
  return withUV(mergeParts([part(g, warm ? '#948e84' : '#8c8b86', {
    jit: 0.06,
    colorFn: (nx, ny) => (ny < -0.25 ? (warm ? '#76716a' : '#706f6b') : null),
  })], seed));
}
function makePebbles() {
  const parts = [];
  const rnd = mulberry32(77);
  for (let i = 0; i < 4; i++) {
    const a = rnd() * 6.28, d = 0.12 + rnd() * 0.3, s = 0.07 + rnd() * 0.1;
    parts.push(part(wobble(new THREE.DodecahedronGeometry(1, 0), 0.15, 80 + i), rnd() < 0.5 ? '#8a867c' : '#a29d92', { x: Math.cos(a) * d, y: s * 0.35, z: Math.sin(a) * d, sx: s * 1.3, sy: s * 0.7, sz: s, jit: 0.12 }));
  }
  return withUV(mergeParts(parts, 78));
}
/** gruppetto di funghi: porcini e qualche amanita rossa a pois */
function makeMushrooms(seed, red) {
  const parts = [], rnd = mulberry32(seed);
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, d = i ? 0.08 + rnd() * 0.2 : 0, s = (i ? 0.6 + rnd() * 0.4 : 1) * 0.15;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = s * (1.3 + rnd() * 0.6), lean = (rnd() - 0.5) * 0.3;
    parts.push(part(new THREE.CylinderGeometry(s * 0.22, s * 0.3, h, 7), '#efe6d2', { x, y: h / 2, z, rz: lean, jit: 0.05 }));
    const capC = red ? '#d0281e' : (rnd() < 0.5 ? '#8a5428' : '#a8743a');
    parts.push(part(new THREE.SphereGeometry(s * 0.62, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), capC, { x: x - lean * h * 0.5, y: h * 0.92, z, sy: red ? 0.75 : 0.62, rz: lean, jit: 0.06 }));
    parts.push(part(new THREE.CircleGeometry(s * 0.6, 9), '#e8d8b8', { x: x - lean * h * 0.5, y: h * 0.92, z, rx: Math.PI / 2, jit: 0.04 }));   // lamelle
    if (red) for (let k = 0; k < 5; k++) {
      const b = rnd() * 6.28, rr = s * (0.15 + rnd() * 0.32);
      parts.push(part(new THREE.SphereGeometry(s * 0.07, 5, 3), '#ffffff', { x: x - lean * h * 0.5 + Math.cos(b) * rr, y: h * 0.92 + Math.sqrt(Math.max(0, (s * 0.62) ** 2 - rr * rr)) * 0.75, z: z + Math.sin(b) * rr, sy: 0.5, jit: 0.02, noSky: true }));
    }
  }
  return withUV(mergeParts(parts, seed + 1));
}
/** ceppo d'albero con radici e anelli del legno */
function makeStump(seed) {
  const parts = [], rnd = mulberry32(seed);
  const r = 0.26 + rnd() * 0.08, h = 0.28 + rnd() * 0.18;
  parts.push(part(wobble(new THREE.CylinderGeometry(r, r * 1.18, h, 9, 1), 0.03, seed, true), '#5e4024', { y: h / 2, jit: 0.12,
    colorFn: (nx, ny) => ny > 0.9 ? (rnd() < 0.5 ? '#c99a5b' : '#b8864a') : (rnd() < 0.3 ? '#4a321c' : '#5e4024') }));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * 6.28 + rnd() * 0.6;
    parts.push(part(new THREE.ConeGeometry(r * 0.32, r * 1.5, 5), '#553a20', { x: Math.cos(a) * r * 1.1, y: 0.04, z: Math.sin(a) * r * 1.1, rx: Math.sin(a) * 1.35, rz: -Math.cos(a) * 1.35, jit: 0.1 }));
  }
  parts.push(part(new THREE.SphereGeometry(r * 0.55, 7, 4), '#5f8a2e', { x: r * 0.35, y: h - 0.01, z: r * 0.3, sx: 1, sy: 0.18, sz: 0.8, jit: 0.15 }));   // muschio sul taglio
  return withUV(mergeParts(parts, seed + 1));
}
/** felce: fronde arcuate, ognuna con una fila di foglioline triangolari ai due lati della costa */
function makeFern(seed) {
  const parts = [], rnd = mulberry32(seed);
  const fr = 8, N = 9;
  for (let i = 0; i < fr; i++) {
    const a = i / fr * 6.28 + rnd() * 0.5, len = 0.6 + rnd() * 0.35, lift = 0.45 + rnd() * 0.25;
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), sd = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const P = (t) => d.clone().multiplyScalar(t * len).setY(len * lift * t * (1.7 - 1.45 * t) + 0.02);
    const pos = [];
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N, tm = (t0 + t1) / 2;
      const p0 = P(t0), p1 = P(t1 + 0.03), w = 0.15 * len * (1 - 0.8 * tm);
      for (const sx of [-1, 1]) {
        const tip = P(tm).addScaledVector(sd, sx * w).addScaledVector(d, w * 0.45); tip.y -= w * 0.25;
        pos.push(p0.x, p0.y, p0.z, ...(sx > 0 ? [tip.x, tip.y, tip.z, p1.x, p1.y, p1.z] : [p1.x, p1.y, p1.z, tip.x, tip.y, tip.z]));
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    parts.push(part(g, '#3f7a24', { jit: 0.06, colorFn: (nx, ny, nz, x, y, z) => Math.hypot(x, z) > len * 0.6 ? '#5a9a30' : '#3f7a24' }));
  }
  return withUV(mergeParts(parts, seed + 1));
}
/** aggiunge coordinate uv fittizie (servono per usare lo slot `map`) */
function withUV(g) {
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

// ═════════════ cespugli ═════════════
function makeBush(seed, flowers = null) {
  const rnd = mulberry32(seed);
  const parts = [];
  const n = 4 + Math.floor(rnd() * 3);
  const greens = ['#3f8a33', '#4a9a3a', '#55a540', '#3a7d2f'];
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rnd(), d = i === 0 ? 0 : 0.35 + rnd() * 0.25, r = i === 0 ? 0.62 : 0.38 + rnd() * 0.2;
    const x = Math.cos(a) * d, y = (i === 0 ? 0.6 : 0.4 + rnd() * 0.25), z = Math.sin(a) * d;
    blobs.push([x, y, z, r]);
    const g = wobble(new THREE.IcosahedronGeometry(r, 0), r * 0.18, seed + i);
    parts.push(part(g, greens[i % greens.length], { x, y, z, sy: 0.85, jit: 0.14, colorFn: (nx, ny) => (ny < -0.4 ? '#2c5e25' : null) }));
  }
  // fiori: piccole gemme sulla parte alta della chioma
  if (flowers) {
    for (let k = 0; k < 14; k++) {
      const [bx, by, bz, br] = blobs[Math.floor(rnd() * blobs.length)];
      const th = rnd() * 6.283, ph = rnd() * 1.1;              // solo emisfero superiore
      const x = bx + Math.sin(ph) * Math.cos(th) * br * 0.98, y = by + Math.cos(ph) * br * 0.85 * 0.98, z = bz + Math.sin(ph) * Math.sin(th) * br * 0.98;
      parts.push(part(new THREE.OctahedronGeometry(0.09, 0), flowers[k % flowers.length], { x, y, z, jit: 0.05, noSky: true }));
    }
  }
  return mergeParts(parts, seed);
}

// ═════════════ texture della pietra (dati lineari, media ~0,5) ═════════════
function makeStoneTexture() {
  // v22: niente grana per pixel (dava il "rumore" a quadretti da vicino): solo macchie morbide e venature sfumate
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S);
  const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
  const rnd = mulberry32(999);
  for (const [n, r0, r1, a] of [[40, 30, 70, 0.10], [120, 10, 28, 0.09], [260, 4, 10, 0.06]]) {
    for (let i = 0; i < n; i++) {
      const x = rnd() * S, y = rnd() * S, r = r0 + rnd() * (r1 - r0), v = rnd() < 0.5 ? 0 : 255;
      wrap((ox, oy) => {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, `rgba(${v},${v},${v},${a})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
  }
  // venature sottili e sfumate
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.filter = 'blur(1px)';
  for (let i = 0; i < 14; i++) {
    let x = rnd() * S, y = rnd() * S, a = rnd() * 6.28;
    const pts = [[x, y]];
    for (let k = 0; k < 8 + rnd() * 8; k++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push([x, y]); }
    wrap((ox, oy) => {
      g.strokeStyle = 'rgba(30,30,30,0.22)'; g.lineWidth = 2.2;
      g.beginPath(); pts.forEach(([px, py], k) => k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)); g.stroke();
    });
  }
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// ═════════════ 02 · CATASTA DI LEGNA ═════════════
function makeLogs() {
  // v21: tronchi a 12 lati con corteccia irregolare, sezioni con anelli concentrici in rilievo e cinghie
  const parts = [];
  const rnd = mulberry32(77);
  const r = 0.2, len = 2.2;
  const rows = [4, 3, 2];
  rows.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * (r * 2.05);
      const y = r + row * r * 1.75;
      const dl = (rnd() - 0.5) * 0.25, rr = r * (0.9 + rnd() * 0.2), L = len + dl;
      const x0 = (rnd() - 0.5) * 0.15;
      let geo = new THREE.CylinderGeometry(rr, rr * 0.96, L, 12, 3, true);
      geo = wobble(geo, 0.018, 900 + row * 10 + i);
      parts.push(part(geo, '#5e3d22', {
        x: x0, y, z, rz: Math.PI / 2, rx: rnd() * 3, jit: 0.18,
        colorFn: (nx, ny, nz, px, py, pz, r2) => r2() < 0.22 ? '#4a2f1a' : (r2() < 0.15 ? '#6e4c2e' : '#5e3d22'),
      }));
      // estremità: cerchio chiaro (alburno), anelli scuri e cuore in rilievo
      for (const sd of [-1, 1]) {
        const ex = x0 + sd * L / 2, ry = sd > 0 ? Math.PI / 2 : -Math.PI / 2;
        parts.push(part(new THREE.CircleGeometry(rr * 0.98, 12), '#c99a5b', { x: ex, y, z, ry, jit: 0.04 }));
        parts.push(part(new THREE.RingGeometry(rr * 0.55, rr * 0.62, 12), '#a8743e', { x: ex + sd * 0.004, y, z, ry, jit: 0.02 }));
        parts.push(part(new THREE.RingGeometry(rr * 0.25, rr * 0.3, 10), '#a8743e', { x: ex + sd * 0.006, y, z, ry, jit: 0.02 }));
        parts.push(part(new THREE.CylinderGeometry(rr * 0.12, rr * 0.16, 0.03, 8), '#8a5a2e', { x: ex, y, z, rz: Math.PI / 2, jit: 0.02 }));
      }
    }
  });
  // paletti di sostegno e due cinghie di ferro
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(0.12, 1.25, 0.12), '#4a3220', { x: sx * 0.85, y: 0.62, z: sz * 0.95, jit: 0.1 }));
  }
  for (const sx of [-0.55, 0.55]) {
    parts.push(part(new THREE.BoxGeometry(0.05, 0.02, 1.95), '#3a3a3e', { x: sx, y: r * 2 + 2 * r * 1.75 + 0.01, jit: 0.04 }));
    for (const sz of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.05, 1.2, 0.02), '#3a3a3e', { x: sx, y: 0.6, z: sz * 0.99, jit: 0.04 }));
  }
  return mergeParts(parts, 78);
}

// ═════════════ 03 · PILA DI MATTONI ═════════════
function makeBricks() {
  const parts = [];
  const rnd = mulberry32(99);
  // pallet
  for (const z of [-0.42, 0, 0.42]) parts.push(part(new THREE.BoxGeometry(1.2, 0.1, 0.12), '#8a6a42', { y: 0.05, z, jit: 0.1 }));
  for (let i = 0; i < 7; i++) parts.push(part(new THREE.BoxGeometry(0.15, 0.03, 1.0), '#a9814f', { x: -0.5 + i * 0.167, y: 0.115, jit: 0.12 }));
  // mattoni in strati incrociati
  const bw = 0.36, bh = 0.11, bd = 0.17;
  const reds = ['#a8452f', '#b5533a', '#9a3d2a', '#c0603f', '#a34a35'];
  for (let layer = 0; layer < 5; layer++) {
    const y = 0.13 + bh / 2 + layer * (bh + 0.012);
    const alongX = layer % 2 === 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 5; b++) {
      if (layer === 4 && rnd() < 0.3) continue;     // qualche mattone già preso
      const px = alongX ? (a - 1) * (bw + 0.01) : (b - 2) * (bd + 0.03);
      const pz = alongX ? (b - 2) * (bd + 0.03) : (a - 1) * (bw + 0.01) * 0.85;
      parts.push(part(new THREE.BoxGeometry(alongX ? bw : bd, bh, alongX ? bd : bw), reds[Math.floor(rnd() * reds.length)], { x: px, y, z: pz, ry: (rnd() - 0.5) * 0.06, jit: 0.1 }));
    }
  }
  // due mattoni caduti a terra
  parts.push(part(new THREE.BoxGeometry(bw, bh, bd), '#b5533a', { x: 0.85, y: bh / 2, z: 0.3, ry: 0.7 }));
  parts.push(part(new THREE.BoxGeometry(bw, bh, bd), '#9a3d2a', { x: 0.75, y: bh / 2, z: -0.45, ry: -0.3 }));
  return mergeParts(parts, 100);
}

// ═════════════ 06 · BARILI ═════════════
function makeBarrel(kind) {
  // v21: più segmenti, doghe alternate, cerchioni in rilievo, bordi arrotondati, coperchio con tappi e ruggine
  const parts = [];
  const H = 1.15, R = 0.4;
  if (kind === 'wood') {
    const prof = (t) => R * (0.86 + Math.sin(t * Math.PI) * 0.14);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(prof(t), t * H)); }
    const lathe = new THREE.LatheGeometry(pts, 18);
    parts.push(part(lathe, '#8a5a30', { jit: 0, colorFn: (nx, ny, nz, x, y, z, rnd) => {
      const a = Math.atan2(z, x), k = Math.floor((a + Math.PI) / (Math.PI * 2) * 18);
      return ['#8f5e33', '#7e5029', '#986638', '#84552d'][k % 4];
    } }));
    // coperchio incassato con assi e bordo
    parts.push(part(new THREE.CircleGeometry(prof(1) - 0.03, 18), '#a57444', { y: H - 0.035, rx: -Math.PI / 2, jit: 0.06, colorFn: (nx, ny, nz, x) => Math.abs(Math.round(x / 0.11) - x / 0.11) < 0.08 ? '#6e4a26' : null }));
    parts.push(part(new THREE.TorusGeometry(prof(1) - 0.012, 0.022, 6, 18), '#7a4c26', { y: H - 0.01, rx: Math.PI / 2, jit: 0.05 }));
    for (const y of [0.1, 0.36, 0.79, 1.05]) {
      const rr = prof(y / H) + 0.008;
      parts.push(part(new THREE.TorusGeometry(rr, 0.018, 4, 18), '#3a3a3e', { y, rx: Math.PI / 2, sy: 1, sz: 1.8, jit: 0.04 }));
      // rivetti
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + y; parts.push(part(new THREE.SphereGeometry(0.014, 5, 4), '#8a8a90', { x: Math.cos(a) * (rr + 0.012), y, z: Math.sin(a) * (rr + 0.012), jit: 0 })); }
    }
    parts.push(part(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8), '#5a3a1e', { x: 0, y: H * 0.55, z: prof(0.55) + 0.005, rx: Math.PI / 2, jit: 0 }));
  } else {
    const body = kind === 'red' ? '#c62e24' : '#2f5f9e', dark = kind === 'red' ? '#8a1e17' : '#1f4170';
    const bodyGeo = wobble(new THREE.CylinderGeometry(R, R, H - 0.06, 20, 6, true), 0.006, kind === 'red' ? 11 : 12);
    parts.push(part(bodyGeo, body, { y: H / 2, jit: 0.05 }));
    // fondo e coperchio con bordo arrotolato
    for (const y of [0.03, H - 0.03]) {
      parts.push(part(new THREE.TorusGeometry(R - 0.004, 0.026, 6, 20), dark, { y, rx: Math.PI / 2, jit: 0.04 }));
    }
    parts.push(part(new THREE.CircleGeometry(R - 0.01, 20), dark, { y: H - 0.045, rx: -Math.PI / 2, jit: 0.04 }));
    parts.push(part(new THREE.CircleGeometry(R - 0.01, 20), dark, { y: 0.01, rx: Math.PI / 2, jit: 0.04 }));
    // costole di rotolamento in rilievo
    for (const y of [H / 3, (2 * H) / 3]) parts.push(part(new THREE.TorusGeometry(R + 0.004, 0.02, 5, 20), body, { y, rx: Math.PI / 2, jit: 0.04 }));
    // tappi (uno grande e uno piccolo)
    parts.push(part(new THREE.CylinderGeometry(0.065, 0.07, 0.035, 10), '#cfcfcf', { x: 0.2, y: H - 0.03, jit: 0.04 }));
    parts.push(part(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 8), '#bdbdbd', { x: -0.22, y: H - 0.035, z: 0.08, jit: 0.04 }));
    if (kind === 'red') {
      // fascia gialla di pericolo con triangolo e fiamma stilizzata
      parts.push(part(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.22, 20, 1, true), '#f2c230', { y: H / 2, jit: 0.04 }));
      const tri = new THREE.CylinderGeometry(0.11, 0.11, 0.02, 3);
      parts.push(part(tri, '#151515', { y: H / 2, z: R + 0.012, rx: Math.PI / 2, rz: Math.PI / 6, jit: 0 }));
      parts.push(part(new THREE.CylinderGeometry(0.06, 0.06, 0.022, 3), '#f2c230', { y: H / 2 - 0.005, z: R + 0.016, rx: Math.PI / 2, rz: Math.PI / 6, jit: 0 }));
    } else {
      parts.push(part(new THREE.CylinderGeometry(R + 0.005, R + 0.005, 0.14, 20, 1, true), '#e8e8e8', { y: H * 0.52, jit: 0.04, colorFn: (nx, ny, nz, x, y, z) => Math.abs(Math.atan2(z, x) - 1.2) < 0.5 ? null : body }));
    }
  }
  return mergeParts(parts, kind.length * 13);
}

// ═════════════ 05 · CASETTA ═════════════
/** v26: la casetta di legno è abitabile: porta vera (anta a parte, in world.js), pavimento a tavole,
 *  letto, tavolo con sgabelli, mensole, tappeto e una stufa a legna con il tubo che esce dal tetto */
export const SHED = {
  W: 4.2, D: 3.6, WH: 2.5, RH: 1.35, floor: 0.3,
  door: { x: -0.525, w: 1.05, top: 2.7 },          // vano della porta sul lato +Z
  stove: { x: -1.55, z: -1.25, fireY: 0.62, fireZ: -0.97, pipeTop: 4.15 },
};
function makeShed() {
  const parts = [];
  const { W, D, WH, RH } = SHED, F = SHED.floor;
  const rnd = mulberry32(55);
  // basamento in pietra
  parts.push(part(new THREE.BoxGeometry(W + 0.2, 0.3, D + 0.2), '#8f8a80', { y: 0.15, jit: 0.1 }));
  // pavimento a tavole
  const floorC = ['#7a5434', '#6e4b2e', '#83593a'];
  for (let i = 0; i < 9; i++) {
    const z = -D / 2 + 0.2 + (i + 0.5) * (D - 0.4) / 9;
    parts.push(part(new THREE.BoxGeometry(W - 0.2, 0.03, (D - 0.4) / 9 - 0.015), floorC[i % 3], { y: F + 0.015, z, jit: 0.05 }));
  }
  // pareti a tavole verticali (sul davanti si lascia il vano della porta)
  const plank = 0.35;
  const woodC = ['#a8763f', '#9c6c38', '#b07f46', '#946535'];
  const dx0 = SHED.door.x - SHED.door.w / 2, dx1 = SHED.door.x + SHED.door.w / 2;
  for (const sz of [-1, 1]) for (let i = 0; i < Math.round(W / plank); i++) {
    const x = -W / 2 + plank / 2 + i * plank;
    if (sz > 0 && x > dx0 && x < dx1) continue;
    parts.push(part(new THREE.BoxGeometry(plank - 0.02, WH, 0.1), woodC[Math.floor(rnd() * 4)], { x, y: F + WH / 2, z: sz * (D / 2 - 0.05), jit: 0.06 }));
  }
  for (const sx of [-1, 1]) for (let i = 0; i < Math.round(D / plank); i++) {
    const z = -D / 2 + plank / 2 + i * plank;
    parts.push(part(new THREE.BoxGeometry(0.1, WH, plank - 0.02), woodC[Math.floor(rnd() * 4)], { x: sx * (W / 2 - 0.05), y: F + WH / 2, z, jit: 0.06 }));
  }
  // stipiti e architrave della porta
  for (const x of [dx0 - 0.05, dx1 + 0.05]) parts.push(part(new THREE.BoxGeometry(0.1, SHED.door.top - F, 0.16), '#5e3f22', { x, y: (SHED.door.top + F) / 2, z: D / 2 - 0.05, jit: 0.04 }));
  parts.push(part(new THREE.BoxGeometry(SHED.door.w + 0.3, F + WH - SHED.door.top + 0.02, 0.16), '#5e3f22', { x: SHED.door.x, y: (SHED.door.top + F + WH) / 2, z: D / 2 - 0.05, jit: 0.04 }));
  parts.push(part(new THREE.BoxGeometry(SHED.door.w + 0.2, 0.06, 0.4), '#7a7368', { x: SHED.door.x, y: F + 0.02, z: D / 2 + 0.15 }));   // soglia
  // timpani triangolari
  for (const sz of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, RH); shape.lineTo(-W / 2, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    parts.push(part(g, '#9a6a36', { y: F + WH, z: sz * (D / 2) - (sz > 0 ? 0.1 : 0), jit: 0.06 }));
  }
  // travi angolari e trave di colmo interna
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.16, WH, 0.16), '#5e3f22', { x: sx * (W / 2 - 0.04), y: F + WH / 2, z: sz * (D / 2 - 0.04), jit: 0.05 }));
  parts.push(part(new THREE.BoxGeometry(0.14, 0.16, D - 0.1), '#5e3f22', { y: F + WH + RH - 0.25 }));
  // tetto a due falde (tegole a file)
  const slope = Math.atan2(RH, W / 2 + 0.3), sl = Math.hypot(W / 2 + 0.3, RH) + 0.1;
  const roofC = ['#8a3326', '#9a3a2b', '#7d2e22'];
  for (const sx of [-1, 1]) {
    for (let r = 0; r < 5; r++) {
      const t = (r + 0.5) / 5;
      const cx = sx * (W / 2 + 0.3) * (1 - t) + 0, cy = F + WH + RH * t - 0.12 + 0.08;
      parts.push(part(new THREE.BoxGeometry(sl / 5 + 0.06, 0.09, D + 0.6), roofC[r % 3], { x: cx, y: cy, rz: -sx * slope, jit: 0.07 }));
    }
    // assito sotto le tegole (si vede da dentro)
    parts.push(part(new THREE.BoxGeometry(sl, 0.03, D - 0.1), '#8a6440', { x: sx * (W / 4 + 0.05), y: F + WH + RH / 2 - 0.1, rz: -sx * slope, jit: 0.05 }));
  }
  parts.push(part(new THREE.BoxGeometry(0.2, 0.18, D + 0.7), '#5e2a20', { y: F + WH + RH + 0.02 }));
  // finestra sul davanti e una sul fianco
  const win = (x, y, z, ry) => {
    parts.push(part(new THREE.BoxGeometry(1.1, 0.9, 0.05), '#f0ece0', { x, y, z, ry }));
    parts.push(part(new THREE.BoxGeometry(0.9, 0.7, 0.14), '#5f8fae', { x, y, z, ry, jit: 0.02 }));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.7, 0.16), '#f0ece0', { x, y, z, ry }));
    parts.push(part(new THREE.BoxGeometry(0.9, 0.06, 0.16), '#f0ece0', { x, y, z, ry }));
  };
  win(1.05, 1.75, D / 2 - 0.04, 0);
  win(W / 2 - 0.04, 1.75, 0.3, Math.PI / 2);
  parts.push(part(new THREE.BoxGeometry(1.2, 0.08, 0.2), '#f0ece0', { x: 1.05, y: 1.28, z: D / 2 + 0.1 }));
  // fioriera sotto la finestra
  parts.push(part(new THREE.BoxGeometry(1.0, 0.22, 0.25), '#7a4a2a', { x: 1.05, y: 1.1, z: D / 2 + 0.17 }));
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.IcosahedronGeometry(0.11, 1), ['#e04a6a', '#f2c230', '#e86a3a', '#c04dff'][i], { x: 0.7 + i * 0.23, y: 1.27, z: D / 2 + 0.17, jit: 0.1 }));
  // ── interno ──
  const iron = '#2b2a28';
  const S = SHED.stove;
  // stufa a legna in ghisa con il vetro, i piedini e il tubo fino sopra il tetto
  parts.push(part(new THREE.BoxGeometry(0.62, 0.62, 0.52), iron, { x: S.x, y: F + 0.12 + 0.31, z: S.z, jit: 0.04 }));
  parts.push(part(new THREE.BoxGeometry(0.68, 0.05, 0.58), '#3a3936', { x: S.x, y: F + 0.76, z: S.z }));
  for (const lx of [-0.24, 0.24]) for (const lz of [-0.19, 0.19]) parts.push(part(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 6), iron, { x: S.x + lx, y: F + 0.06, z: S.z + lz }));
  parts.push(part(new THREE.BoxGeometry(0.36, 0.26, 0.02), '#1a1210', { x: S.x, y: F + S.fireY - F + 0.02, z: S.z + 0.265 }));
  parts.push(part(new THREE.BoxGeometry(0.05, 0.05, 0.05), '#b0a080', { x: S.x + 0.22, y: F + 0.47, z: S.z + 0.29 }));
  parts.push(part(new THREE.CylinderGeometry(0.075, 0.075, S.pipeTop - F - 0.78, 10), '#3a3936', { x: S.x, y: (S.pipeTop + F + 0.78) / 2, z: S.z }));
  parts.push(part(new THREE.CylinderGeometry(0.16, 0.12, 0.12, 10), '#3a3936', { x: S.x, y: S.pipeTop + 0.05, z: S.z }));
  parts.push(part(new THREE.BoxGeometry(0.9, 0.02, 0.8), '#6a6560', { x: S.x + 0.05, y: F + 0.04, z: S.z + 0.1 }));   // lastra di pietra sotto
  // legna accanto alla stufa
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) parts.push(part(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 7), '#6e4a2a', { x: S.x + 0.6 + j * 0.13 + i * 0.06, y: F + 0.07 + i * 0.11, z: S.z - 0.05, rx: Math.PI / 2, jit: 0.12, colorFn: (nx, ny, nz) => Math.abs(nz) > 0.9 ? '#c99a5b' : null }));
  // letto con testiera, materasso, coperta a quadri e cuscino
  const bx = 1.45, bz = -0.75;
  parts.push(part(new THREE.BoxGeometry(1.0, 0.3, 1.95), '#6b4527', { x: bx, y: F + 0.15 + 0.05, z: bz, jit: 0.05 }));
  parts.push(part(new THREE.BoxGeometry(1.0, 0.75, 0.07), '#5a3a20', { x: bx, y: F + 0.42, z: bz - 0.96, jit: 0.05 }));
  parts.push(part(new THREE.BoxGeometry(0.92, 0.14, 1.86), '#e8e0cc', { x: bx, y: F + 0.47, z: bz }));
  parts.push(part(new THREE.BoxGeometry(0.98, 0.07, 1.25), '#9a2f2a', { x: bx, y: F + 0.56, z: bz + 0.32, jit: 0.12 }));
  parts.push(part(new THREE.BoxGeometry(0.98, 0.075, 0.12), '#2f4a6a', { x: bx, y: F + 0.565, z: bz - 0.18 }));
  parts.push(part(new THREE.BoxGeometry(0.6, 0.12, 0.34), '#f4f0e6', { x: bx, y: F + 0.6, z: bz - 0.72 }));
  // tavolo con due sgabelli e una lanterna
  const tx = -1.3, tz = 0.0;
  parts.push(part(new THREE.BoxGeometry(0.8, 0.05, 0.6), '#8a5a32', { x: tx, y: F + 0.74, z: tz, jit: 0.05 }));
  for (const lx of [-0.34, 0.34]) for (const lz of [-0.24, 0.24]) parts.push(part(new THREE.BoxGeometry(0.05, 0.72, 0.05), '#6b4527', { x: tx + lx, y: F + 0.36, z: tz + lz }));
  for (const [sx, sz] of [[0.0, 0.52], [0.62, -0.05]]) {
    parts.push(part(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), '#8a5a32', { x: tx + sx, y: F + 0.45, z: tz + sz }));
    for (let k = 0; k < 3; k++) { const a = k * 2.094; parts.push(part(new THREE.CylinderGeometry(0.02, 0.025, 0.44, 5), '#6b4527', { x: tx + sx + Math.cos(a) * 0.11, y: F + 0.22, z: tz + sz + Math.sin(a) * 0.11 })); }
  }
  parts.push(part(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 8), '#3a3936', { x: tx + 0.15, y: F + 0.78, z: tz - 0.1 }));
  parts.push(part(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 8), '#ffd890', { x: tx + 0.15, y: F + 0.86, z: tz - 0.1 }));
  parts.push(part(new THREE.CylinderGeometry(0.02, 0.06, 0.05, 8), '#3a3936', { x: tx + 0.15, y: F + 0.955, z: tz - 0.1 }));
  parts.push(part(new THREE.CylinderGeometry(0.08, 0.06, 0.07, 9), '#c8c0b0', { x: tx - 0.2, y: F + 0.8, z: tz + 0.1 }));   // ciotola
  // mensole sulla parete sinistra con barattoli e libri
  for (const y of [1.25, 1.75]) {
    parts.push(part(new THREE.BoxGeometry(0.28, 0.04, 1.0), '#7a5434', { x: -W / 2 + 0.24, y: F + y, z: 1.0 }));
    for (let k = 0; k < 4; k++) {
      const z = 0.62 + k * 0.24;
      if (rnd() < 0.5) parts.push(part(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), ['#c8a050', '#8ab070', '#d8d0c0', '#b05a3a'][k], { x: -W / 2 + 0.24, y: F + y + 0.1, z }));
      else parts.push(part(new THREE.BoxGeometry(0.18, 0.22, 0.06), ['#7a2a2a', '#2a4a7a', '#4a6a3a', '#8a6a2a'][k], { x: -W / 2 + 0.24, y: F + y + 0.13, z, jit: 0.1 }));
    }
  }
  // tappeto
  parts.push(part(new THREE.BoxGeometry(1.3, 0.015, 0.95), '#8a3a2a', { x: 0.2, y: F + 0.04, z: 0.55 }));
  parts.push(part(new THREE.BoxGeometry(1.1, 0.017, 0.75), '#c89a4a', { x: 0.2, y: F + 0.041, z: 0.55 }));
  // legna accatastata fuori
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) {
    parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 7), '#6e4a2a', { x: -W / 2 - 0.25 - i * 0.0, y: 0.42 + i * 0.21, z: -0.6 + j * 0.25 + i * 0.12, rx: Math.PI / 2, jit: 0.12, colorFn: (nx, ny, nz) => Math.abs(nz) > 0.9 ? '#c99a5b' : null }));
  }
  const geo = mergeParts(parts, 56);
  geo.userData.dims = { w: W + 0.6, d: D + 0.6, wallH: F + WH, h: F + WH + RH };
  return geo;
}

// ═════════════ catalogo ═════════════
export const PROPS = {
  pine: makePine(), oak: makeOak(), birch: makeBirch(),
  pineLow: makePineLow(), oakLow: makeOakLow(), birchLow: makeBirchLow(),
  snowPine: makeSnowPine(), snowPineLow: makeSnowPineLow(), autumnOak: makeAutumnOak(), autumnOakLow: makeAutumnOakLow(),
  autumnBirch: makeAutumnBirch(), autumnBirchLow: makeAutumnBirchLow(), palm: makePalm(), palmLow: makePalmLow(),
  cactus: makeCactus(), cactusLow: makeCactusLow(), deadTree: makeDeadTree(), deadTreeLow: makeDeadTreeLow(),
  rocks: [makeRock(5, 0), makeRock(17, 0), makeRock(29, 1), makeRock(41, 2), makeRock(53, 3)],
  pebbles: makePebbles(),
  bushes: [makeBush(401), makeBush(433), makeBush(467, ['#f2f2f2', '#ffe066']), makeBush(491, ['#e86fa8', '#c77dff'])],
  logs: makeLogs(), bricks: makeBricks(),
  mushrooms: [makeMushrooms(611, false), makeMushrooms(631, true), makeMushrooms(653, false)],
  stumps: [makeStump(701), makeStump(733)],
  fern: makeFern(811),
  barrelWood: makeBarrel('wood'), barrelBlue: makeBarrel('blue'), barrelRed: makeBarrel('red'),
  shed: makeShed(),
};
// dimensioni di riferimento (per i collisori)
/** tutti i tipi di albero (ognuno ha anche la versione Low) */
export const TREE_KINDS = ['pine', 'oak', 'birch', 'snowPine', 'autumnOak', 'autumnBirch', 'palm', 'cactus', 'deadTree'];
export const PROP_DIMS = {
  logs: { w: 2.35, h: 1.2, d: 1.75 },
  bricks: { w: 1.25, h: 0.75, d: 1.05 },
  barrel: { r: 0.42, h: 1.15 },
  shed: PROPS.shed.userData.dims,
};
export const propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02, flatShading: true });
/** tempo del vento, aggiornato ogni frame dal gioco */
export const WIND = { value: 0 };

/**
 * Vento per vegetazione instanziata: oscilla i vertici sopra `from` metri,
 * con fase diversa per ogni istanza (presa dalla sua posizione).
 */
function addWind(mat, from, amount, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          #else
            vec2 ip = vec2(0.0);
          #endif
          float hh = max(0.0, transformed.y - ${from.toFixed(2)});
          float k = hh * hh * ${amount.toFixed(4)};
          float ph = uWind * 1.35 + ip.x * 0.11 + ip.y * 0.083;
          transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3) * k;
          transformed.z += (cos(ph * 0.83 + 0.6) * 0.5) * k;
        }`);
    // vicino alla telecamera (terza persona contro un albero) la chioma si dissolve a retino
    // invece di riempire lo schermo con il suo lato in ombra
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      {
        float camD = length( vViewPosition );
        if ( camD < 6.5 ) {
          float a = smoothstep( 3.0, 6.5, camD );
          vec2 q = floor( mod( gl_FragCoord.xy, 4.0 ) );
          float th = ( mod( q.x * 2.0 + q.y * 3.0, 4.0 ) * 4.0 + mod( q.x + q.y * 2.0, 4.0 ) + 0.5 ) / 16.0;
          if ( a < th ) discard;
        }
      }`);
  };
  mat.customProgramCacheKey = () => 'wind-' + key;
  return mat;
}
export const treeMaterial = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02, flatShading: true }), 2.2, 0.0045, 'tree');
export const bushMaterial = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, flatShading: true }), 0.3, 0.07, 'bush');

/** roccia con texture di pietra proiettata sui 3 assi (coordinate oggetto) */
const stoneTex = makeStoneTexture();
// rumore 3D liscio per gli shader (hash senza seno: stabile anche con coordinate grandi)
const GLSL_NOISE = `
  float rHash(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float rNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(mix(rHash(i), rHash(i + vec3(1, 0, 0)), u.x), mix(rHash(i + vec3(0, 1, 0)), rHash(i + vec3(1, 1, 0)), u.x), u.y),
               mix(mix(rHash(i + vec3(0, 0, 1)), rHash(i + vec3(1, 0, 1)), u.x), mix(rHash(i + vec3(0, 1, 1)), rHash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
  }
  // fbm che si spegne quando le ottave diventano più piccole di un pixel (niente sfarfallio né puntini)
  float rFbm(vec3 p, float fw) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * (rNoise(p) - 0.5) * (1.0 - smoothstep(0.25, 0.7, fw)); p = p * 2.03 + vec3(7.1, 3.7, 1.3); fw *= 2.03; a *= 0.5; }
    return s;
  }
`;
// v22: roccia ridisegnata. Niente rilievo preso dalla texture (i texel filtrati davano i "quadretti"): forme e rilievo
// vengono da rumore 3D liscio che si attenua con la distanza; venature a strati morbide, muschio e neve sulle facce in alto
export const rockMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.0, flatShading: true, map: stoneTex });
rockMaterial.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 aSurf;\nvarying vec3 vOP;\nvarying vec3 vON;\nvarying vec2 vSurf;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal; vSurf = aSurf;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
        varying vec3 vOP;
        varying vec3 vON;
        varying vec2 vSurf;
        float rockH;
        ${GLSL_NOISE}`)
    .replace('#include <map_fragment>', '')   // la texture si campiona in triplanare qui sotto (le UV delle rocce sono vuote)
    .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 P = vOP;
        vec3 nn = normalize(vON);
        float fw = length(fwidth(P));
        float n1 = rFbm(P * 0.45, fw * 0.45);                         // grandi macchie
        float n2 = rFbm(P * 1.9 + 11.0, fw * 1.9);                    // dettaglio medio
        // texture di pietra solo come leggera marezzatura (mip normali, niente grana)
        vec3 w = abs(nn); w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z);
        vec3 tp = P * 0.35;
        float t = texture2D(map, tp.yz).r * w.x + texture2D(map, tp.xz).r * w.y + texture2D(map, tp.xy).r * w.z;
        // strati della roccia: bande morbide e ondulate, sfumate se troppo fitte per lo schermo
        float sp = P.y * 2.2 + n1 * 5.0;
        float bandAA = 1.0 - smoothstep(0.4, 1.2, fwidth(sp));
        float strata = (0.5 + 0.5 * sin(sp)) * bandAA + 0.5 * (1.0 - bandAA);
        float tone = (1.0 + n1 * 0.36 + n2 * 0.14) * (0.94 + 0.1 * t) * (0.94 + 0.1 * strata);
        diffuseColor.rgb *= clamp(tone, 0.55, 1.2);
        // muschio (prati, boschi) e neve (montagna) sulle facce rivolte verso l'alto, con bordo irregolare
        float up = nn.y + n1 * 0.9 + n2 * 0.4;
        float moss = vSurf.y * smoothstep(0.42, 0.72, up);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.30, 0.09) * (0.85 + n2 * 0.8 + t * 0.3), moss);
        float snow = clamp(vSurf.x, 0.0, 1.0) * smoothstep(0.5, 0.78, up);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.77, 0.82) * (0.97 + n2 * 0.1), snow);
        diffuseColor.rgb = min(diffuseColor.rgb, vec3(0.8));            // mai bianco abbagliante
        rockH = (n1 * 0.6 + n2 * 0.4) * (1.0 - snow * 0.7);
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
        float dhx = dFdx(rockH), dhy = dFdy(rockH);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
        float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
        normal = normalize(abs(det) * normal - grad * 0.9);
      }`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 1.0;');
};
rockMaterial.customProgramCacheKey = () => 'rock-v22';

/** rilievo procedurale (bump con rumore 3D) per legno e metallo degli oggetti di scena: più tridimensionali
 *  v22: venature lisce e continue (prima l'hash dava blocchi e anelli a macchie), che si sfumano da lontano */
function addSurfaceDetail(mat, key, opts) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSP;\nvarying vec3 vSN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSP = position; vSN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSP;
        varying vec3 vSN;
        float surfH;
        ${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 c = vColor.rgb;
          float gr = c.g / max(c.r, 0.001);
          float woody = ${opts.wood === false ? '0.0' : '1.0'} * smoothstep(0.25, 0.33, gr) * (1.0 - smoothstep(0.68, 0.75, gr)) * (1.0 - smoothstep(0.62, 0.7, c.r)) * step(c.b, c.g);   // marroni (spazio lineare) → legno
          // legno: coordinate "stirate" lungo la fibra, deformate piano → venature lunghe e ondulate
          vec3 q = vSP * vec3(${opts.grain});
          float fw = length(fwidth(q));
          float warp = rNoise(vSP * vec3(${opts.warp || '0.9, 0.18, 0.9'}) * 1.0) * 2.0;
          float gx = rNoise(q) * 6.0 + rNoise(q * 1.9 + 5.0) * 2.0 + warp;
          float aa = 1.0 - smoothstep(0.35, 1.1, fwidth(gx));            // da lontano le righe si fondono in un tono medio
          float stripe = 0.5 + 0.5 * sin(gx * 3.14159);
          stripe = mix(0.55, smoothstep(0.15, 0.95, stripe), aa);
          float fiber = rNoise(q * vec3(3.0, 0.6, 3.0)) - 0.5;
          float fiberAA = 1.0 - smoothstep(0.3, 0.9, fw * 3.0);
          float tone = rFbm(vSP * 0.8, length(fwidth(vSP)) * 0.8);
          float wood = mix(0.86, 1.04, stripe) * (1.0 + fiber * 0.10 * fiberAA) * (1.0 + tone * 0.35);
          // metallo / vernice: macchie morbide e graffi fini (sfumati da lontano)
          float blot = rNoise(vSP * 3.0);
          vec3 sq = vSP * vec3(18.0, 2.0, 18.0);
          float scrAA = 1.0 - smoothstep(0.3, 0.9, length(fwidth(sq)));
          float scr = smoothstep(0.82, 0.95, rNoise(sq)) * scrAA;
          float metal = mix(0.93, 1.03, blot) * (1.0 - scr * 0.12);
          diffuseColor.rgb *= mix(metal, wood, woody);
          // sporco e ombra di contatto verso il basso
          diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(0.0, 0.25, vSP.y));
          surfH = mix(blot * 0.15, stripe * 0.10 * aa + fiber * 0.04 * fiberAA, woody) * ${opts.bump.toFixed(2)};
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(surfH), dhy = dFdy(surfH);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
        }`);
  };
  mat.customProgramCacheKey = () => 'surf22-' + key;
  return mat;
}
addSurfaceDetail(propMaterial, 'prop', { grain: '2.2, 0.25, 2.2', bump: 1.0 });

export const metalPropMaterial = addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3, flatShading: true }), 'metal', { grain: '2.2, 0.25, 2.2', bump: 0.7, wood: false });
/** legno dei tronchi accatastati: venature lungo x (l'asse dei tronchi) */
export const logMaterial = addSurfaceDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, flatShading: true }), 'log', { grain: '0.25, 2.6, 2.6', warp: '0.18, 0.9, 0.9', bump: 1.0 });
export const MODEL_SOURCE = { tree: 'procedurale', logs: 'procedurale', bricks: 'procedurale', shed: 'procedurale', barrel: 'procedurale' };

// ═════════════ caricamento dei modelli GLB originali (facoltativo) ═════════════
const GLB_FILES = {
  tree: '01_albero.glb',
  logs: '02_legna.glb',
  bricks: '03_mattoni.glb',
  shed: '05_casa.glb',
  barrel: '06_barile.glb',
};
// misure finali desiderate: altezza (h) oppure lato più lungo (len)
const GLB_TARGET = { tree: { h: 7.5 }, logs: { len: 2.3 }, bricks: { len: 1.25 }, shed: { h: 4.2 }, barrel: { h: 1.15 } };

function averageTextureColor(tex) {
  try {
    const img = tex && tex.image;
    if (!img || !img.width) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = 4;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 4, 4);
    const d = g.getImageData(0, 0, 4, 4).data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return new THREE.Color(r / n / 255, gg / n / 255, b / n / 255).convertSRGBToLinear();
  } catch { return null; }
}

/** Converte la scena GLB in una sola geometria con colori per vertice, con i piedi a y=0 */
function gltfToGeometry(root, key) {
  root.updateMatrixWorld(true);
  const pos = [], nor = [], col = [];
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const matColor = mats.map(m => {
      const c = (m && m.color ? m.color.clone() : new THREE.Color(1, 1, 1));
      if (m && m.map) { const avg = averageTextureColor(m.map); if (avg) c.multiply(avg); }
      return c;
    });
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color;
    for (const gr of groups) {
      const mc = matColor[gr.materialIndex || 0] || matColor[0];
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i));
        nor.push(N.getX(i), N.getY(i), N.getZ(i));
        if (C) col.push(C.getX(i) * mc.r, C.getY(i) * mc.g, C.getZ(i) * mc.b);
        else col.push(mc.r, mc.g, mc.b);
      }
    }
    g.dispose();
  });
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingBox();
  // asse verticale: il file dice Z; se il modello è "sdraiato" lo raddrizziamo
  let bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3());
  const zUp = Math.abs(bb.min.z) < Math.abs(bb.min.y) * 0.5 && bb.min.y < -0.2 * size.y;
  if (zUp || (key === 'tree' && size.z > size.y * 1.2) || (key === 'barrel' && size.z > size.y * 1.2)) {
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    bb = geo.boundingBox; size = bb.getSize(new THREE.Vector3());
  }
  const t = GLB_TARGET[key];
  const k = t.h ? t.h / Math.max(0.001, size.y) : t.len / Math.max(0.001, size.x, size.z);
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  geo.translate(-cx, -bb.min.y, -cz);
  geo.scale(k, k, k);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  geo.userData.shared = true;
  return geo;
}

/**
 * Prova a caricare i file .glb da models/. Se un file manca resta il modello procedurale.
 * Va chiamato PRIMA di buildWorld (così i collisori usano le misure giuste).
 */
export async function loadModelOverrides(base = 'models/') {
  const loaded = [];
  let Loader = null;
  await Promise.all(Object.entries(GLB_FILES).map(async ([key, file]) => {
    try {
      const res = await fetch(base + file, { cache: 'no-cache' });
      if (!res.ok) return;
      const type = res.headers.get('content-type') || '';
      if (type.includes('text/html')) return;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 20) return;
      if (!Loader) ({ GLTFLoader: Loader } = await import('three/addons/loaders/GLTFLoader.js'));
      const gltf = await new Promise((ok, ko) => new Loader().parse(buf, base, ok, ko));
      const geo = gltfToGeometry(gltf.scene, key);
      if (!geo) return;
      const s = geo.boundingBox.getSize(new THREE.Vector3());
      if (key === 'tree') { for (const k of TREE_KINDS) PROPS[k] = PROPS[k + 'Low'] = geo; }
      else if (key === 'barrel') { PROPS.barrelWood = PROPS.barrelBlue = PROPS.barrelRed = geo; PROP_DIMS.barrel = { r: Math.max(s.x, s.z) / 2 + 0.02, h: s.y }; }
      else if (key === 'shed') { PROPS.shed = geo; PROP_DIMS.shed = { w: s.x, d: s.z, wallH: s.y * 0.6, h: s.y }; }
      else { PROPS[key] = geo; PROP_DIMS[key] = { w: s.x, h: s.y, d: s.z }; }
      MODEL_SOURCE[key] = file;
      loaded.push(file);
    } catch (err) {
      console.warn('Modello non caricato:', file, err && err.message);
    }
  }));
  return loaded;
}
