// ─────────────────────────────────────────────────────────────
//  Città a tema v27: ogni tema ha la sua pianta, le sue strade e i suoi edifici.
//   • western  → via principale sterrata con passerelle di legno, case ricavate dentro camion,
//                piccole miniere scavate nella roccia (galleria percorribile, binari e carrelli)
//   • alpine   → vicoli innevati con cumuli di neve, piazzetta col campanile, chalet e legnaie
//   • coastal  → stradine di sabbia e passerelle, palafitte con scale e terrazzino, cabine
//   • farm     → una carrareccia, fienili rossi, campi coltivati, trattori e balle di fieno
//   • castle   → mura merlate con porte, torri d'angolo e scale per il cammino di ronda
//  Qui ci sono le texture delle strade, gli oggetti instanziati (colori per vertice) e i costruttori.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeParts } from './props.js?v=26';
import { normalFromHeight, NORMALS, TEXQ, ANISO } from './texgen.js?v=19';

const P = (geo, color, o = {}) => ({ geo, color, o });

// ═════════ texture delle strade ═════════
function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function cv(b = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(16, Math.round(b * TEXQ));
  const g = c.getContext('2d');
  g.setTransform(c.width / b, 0, 0, c.height / b, 0, 0);
  return { c, g };
}
function grain(g, c, amount, rnd) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (rnd() - 0.5) * amount; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(img, 0, 0); g.restore();
}
function blots(g, n, rnd, cols, r0 = 6, r1 = 26) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * 128, y = rnd() * 128, r = r0 + rnd() * (r1 - r0);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, cols[Math.floor(rnd() * cols.length)]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    // ripetuto ai bordi: la texture resta affiancabile
    for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
  }
}
const gray = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
function finish(c, H, strength) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO.value;
  if (NORMALS && H) t.userData.normal = normalFromHeight(H.c, strength);
  return t;
}
const TX = new Map();
const once = (k, f) => { if (!TX.has(k)) TX.set(k, f()); return TX.get(k); };

/** terra battuta: ciottoli, crepe e polvere più chiara */
export const dirtRoadTexture = () => once('dirt', () => {
  const r = rng(301), { c, g } = cv(), H = NORMALS ? cv() : null;
  g.fillStyle = '#9b7b53'; g.fillRect(0, 0, 128, 128);
  blots(g, 26, r, ['rgba(70,48,28,0.28)', 'rgba(220,190,140,0.22)', 'rgba(120,90,55,0.25)']);
  if (H) { H.g.fillStyle = gray(120); H.g.fillRect(0, 0, 128, 128); }
  for (let i = 0; i < 260; i++) {
    const x = r() * 128, y = r() * 128, s = 0.6 + r() * 1.8, k = r();
    g.fillStyle = k < 0.5 ? `rgba(60,42,25,${0.3 + r() * 0.3})` : `rgba(215,195,160,${0.3 + r() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill();
    if (H) { H.g.fillStyle = gray(150 + r() * 90); H.g.beginPath(); H.g.ellipse(x, y, s, s * 0.8, 0, 0, 7); H.g.fill(); }
  }
  g.strokeStyle = 'rgba(55,38,22,0.35)'; g.lineWidth = 0.6;
  for (let k = 0; k < 6; k++) { let x = r() * 128, y = r() * 128; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 12; y += (r() - 0.5) * 12; g.lineTo(x, y); } g.stroke(); }
  grain(g, c, 18, r);
  if (H) grain(H.g, H.c, 50, r);
  return finish(c, H, 1.6);
});
/** neve battuta: chiazze di neve sporca, impronte, cristalli */
export const snowRoadTexture = () => once('snowroad', () => {
  const r = rng(311), { c, g } = cv(), H = NORMALS ? cv() : null;
  g.fillStyle = '#e4e9ef'; g.fillRect(0, 0, 128, 128);
  blots(g, 22, r, ['rgba(150,160,172,0.35)', 'rgba(255,255,255,0.5)', 'rgba(170,160,150,0.25)'], 8, 30);
  if (H) { H.g.fillStyle = gray(140); H.g.fillRect(0, 0, 128, 128); }
  // impronte di scarponi
  for (let i = 0; i < 28; i++) {
    const x = r() * 128, y = r() * 128, a = r() * 6.28;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(140,152,168,0.35)'; g.beginPath(); g.ellipse(0, 0, 1.6, 3.4, 0, 0, 7); g.fill();
    g.restore();
    if (H) { H.g.fillStyle = gray(90); H.g.beginPath(); H.g.ellipse(x, y, 1.6, 3.2, a, 0, 7); H.g.fill(); }
  }
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.fillRect(r() * 128, r() * 128, 0.6, 0.6); }
  grain(g, c, 10, r);
  if (H) grain(H.g, H.c, 60, r);
  return finish(c, H, 1.2);
});
/** sabbia: increspature del vento e granelli */
export const sandRoadTexture = () => once('sand', () => {
  const r = rng(321), { c, g } = cv(), H = NORMALS ? cv() : null;
  g.fillStyle = '#dcc48e'; g.fillRect(0, 0, 128, 128);
  blots(g, 18, r, ['rgba(180,150,100,0.25)', 'rgba(250,236,200,0.3)']);
  if (H) { H.g.fillStyle = gray(128); H.g.fillRect(0, 0, 128, 128); }
  for (let y = 0; y < 128; y += 5.33) {
    g.strokeStyle = 'rgba(160,130,85,0.22)'; g.lineWidth = 1.1; g.beginPath();
    for (let x = 0; x <= 128; x += 4) { const yy = y + Math.sin(x / 128 * 6.283 * 2 + y * 0.3) * 1.4; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    g.stroke();
    if (H) { H.g.strokeStyle = gray(70); H.g.lineWidth = 1.4; H.g.beginPath(); for (let x = 0; x <= 128; x += 4) { const yy = y + Math.sin(x / 128 * 6.283 * 2 + y * 0.3) * 1.4; x ? H.g.lineTo(x, yy) : H.g.moveTo(x, yy); } H.g.stroke(); }
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,95,60,0.4)' : 'rgba(255,248,225,0.5)'; g.fillRect(r() * 128, r() * 128, 0.7, 0.7); }
  grain(g, c, 12, r);
  return finish(c, H, 1.4);
});
/** assi di legno (passerelle, terrazzini, scale): 6 assi ogni 2 m, chiodi e venature */
export const plankTexture = () => once('plank', () => {
  const r = rng(331), { c, g } = cv(), H = NORMALS ? cv() : null;
  const n = 6, w = 128 / n;
  if (H) { H.g.fillStyle = gray(30); H.g.fillRect(0, 0, 128, 128); }
  for (let i = 0; i < n; i++) {
    const y = i * w, k = 0.82 + r() * 0.3;
    const base = [138 * k, 102 * k, 66 * k];
    g.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`; g.fillRect(0, y + 0.8, 128, w - 1.6);
    for (let l = 0; l < 7; l++) { g.strokeStyle = `rgba(60,38,20,${0.12 + r() * 0.15})`; g.lineWidth = 0.5; g.beginPath(); const yy = y + 2 + r() * (w - 4); g.moveTo(0, yy); for (let x = 0; x <= 128; x += 16) g.lineTo(x, yy + Math.sin(x * 0.08 + l) * 0.8); g.stroke(); }
    const cut = r() * 128;   // giunta fra due assi
    g.fillStyle = 'rgba(30,18,8,0.7)'; g.fillRect(cut, y + 0.8, 1, w - 1.6);
    g.fillStyle = 'rgba(40,40,40,0.8)';
    for (const x of [cut - 3, cut + 3]) for (const yy of [y + 4, y + w - 4]) g.fillRect(x, yy, 1.1, 1.1);
    if (H) { H.g.fillStyle = gray(170 + r() * 40); H.g.fillRect(0, y + 1, 128, w - 2); H.g.fillStyle = gray(40); H.g.fillRect(cut, y, 1, w); }
  }
  grain(g, c, 14, r);
  return finish(c, H, 2.2);
});
/** campo arato: solchi paralleli */
export const fieldTexture = () => once('field', () => {
  const r = rng(341), { c, g } = cv(), H = NORMALS ? cv() : null;
  g.fillStyle = '#5e4630'; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, '#4a3624'); gr.addColorStop(0.5, '#7a5c3c'); gr.addColorStop(1, '#4a3624');
    g.fillStyle = gr; g.fillRect(x, 0, 16, 128);
    if (H) { const hg = H.g.createLinearGradient(x, 0, x + 16, 0); hg.addColorStop(0, gray(40)); hg.addColorStop(0.5, gray(210)); hg.addColorStop(1, gray(40)); H.g.fillStyle = hg; H.g.fillRect(x, 0, 16, 128); }
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.6 ? 'rgba(30,20,10,0.4)' : 'rgba(150,120,80,0.4)'; g.fillRect(r() * 128, r() * 128, 1, 1); }
  grain(g, c, 16, r);
  return finish(c, H, 2.6);
});
/** sampietrini con neve negli interstizi (piazzetta alpina) */
export const snowCobbleTexture = () => once('snowcobble', () => {
  const r = rng(351), { c, g } = cv(), H = NORMALS ? cv() : null;
  g.fillStyle = '#e8edf2'; g.fillRect(0, 0, 128, 128);
  if (H) { H.g.fillStyle = gray(60); H.g.fillRect(0, 0, 128, 128); }
  const s = 8;
  for (let row = 0; row < 16; row++) {
    const off = (row % 2) * s * 0.5;
    for (let x = -s + off; x < 128; x += s) {
      if (r() < 0.35) continue;   // coperti dalla neve
      const y = row * s, k = 0.75 + r() * 0.4;
      g.fillStyle = `rgb(${(128 * k) | 0},${(124 * k) | 0},${(118 * k) | 0})`;
      g.beginPath(); g.roundRect(x + 1, y + 1, s - 2, s - 2, 2); g.fill();
      if (H) { H.g.fillStyle = gray(160 + r() * 60); H.g.beginPath(); H.g.roundRect(x + 1, y + 1, s - 2, s - 2, 2); H.g.fill(); }
    }
  }
  blots(g, 12, r, ['rgba(255,255,255,0.55)'], 6, 18);
  grain(g, c, 10, r);
  return finish(c, H, 2);
});

// ═════════ geometrie ═════════
/** specchia una geometria già unita (non indicizzata) lungo x, mantenendo le facce rivolte all'esterno */
function mirrorX(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color;
  for (let i = 0; i < pos.count; i++) { pos.setX(i, -pos.getX(i)); nor.setX(i, -nor.getX(i)); }
  for (let i = 0; i < pos.count; i += 3) for (const a of [pos, nor, col]) {
    for (let k = 0; k < a.itemSize; k++) { const t = a.array[(i + 1) * a.itemSize + k]; a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k]; a.array[(i + 2) * a.itemSize + k] = t; }
  }
  pos.needsUpdate = nor.needsUpdate = col.needsUpdate = true;
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
/** sasso irregolare: icosaedro deformato con un rumore che dipende dalla posizione (nessuna crepa) */
function rockGeo(r, seed, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 1.7 + seed) * Math.sin(v.y * 2.1 + seed * 1.3) * Math.sin(v.z * 1.9 + seed * 0.7) + 0.5 * Math.sin(v.x * 3.3 - v.z * 2.7 + seed * 2.1);
    v.multiplyScalar(1 + 0.18 * n); v.x *= sx; v.y *= sy; v.z *= sz;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
/** pneumatico con battistrada (profilo ruotato) */
function tyreGeo(r, w, seg = 18) {
  const h = w / 2, pts = [[r * 0.62, -h], [r * 0.93, -h], [r, -h * 0.6], [r, h * 0.6], [r * 0.93, h], [r * 0.62, h]];
  const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}
const LAMP_GLOW = '#ffd890';
const TRUCK_PAINT = ['#b8442e', '#2f5f8a', '#d6a93a', '#e6e2d8', '#4c7040', '#7d848c'];
export const TRUCK_PAINTS = TRUCK_PAINT.length;

export const TOWN_SPECIALS = {
  /** telaio, ruote e cabina di un camion (la parte abitabile è fatta di box in truckHome);
   *  cassone da x = -3.1 a 3.1, cabina verso +x (c dispari = specchiato) */
  truck: (c = 0) => {
    const paint = TRUCK_PAINT[(c >> 1) % TRUCK_PAINT.length], dark = '#1c1d20', steel = '#8d939a', glass = '#22303a';
    const parts = [];
    // telaio e paraurti posteriore
    for (const z of [-0.55, 0.55]) parts.push(P(new THREE.BoxGeometry(8.8, 0.2, 0.16), '#2a2b2e', { x: 1.25, y: 0.52, z }));
    parts.push(P(new THREE.BoxGeometry(0.16, 0.18, 2.3), '#3a3b3e', { x: -3.18, y: 0.42 }));
    for (const z of [-0.85, 0.85]) parts.push(P(new THREE.BoxGeometry(0.06, 0.08, 0.3), '#c82a20', { x: -3.27, y: 0.42, z, noSky: true }));
    // ruote: gemellate dietro, singole davanti
    const wheel = (x, z, r) => {
      parts.push(P(tyreGeo(r, 0.3), dark, { x, y: r, z, jit: 0.02 }));
      parts.push(P(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.26, 14), steel, { x, y: r, z: z * 0.98, rx: Math.PI / 2, jit: 0 }));
      parts.push(P(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.3, 8), '#5a5f66', { x, y: r, z, rx: Math.PI / 2, jit: 0 }));
    };
    for (const x of [-1.95, -0.95]) for (const z of [-1.0, 1.0]) wheel(x, z, 0.41);
    for (const z of [-1.0, 1.0]) wheel(4.45, z, 0.41);
    // parafanghi posteriori e serbatoio del gasolio
    for (const z of [-1.18, 1.18]) parts.push(P(new THREE.BoxGeometry(2.35, 0.05, 0.36), '#26272a', { x: -1.45, y: 0.86, z }));
    parts.push(P(new THREE.CylinderGeometry(0.26, 0.26, 0.9, 12), '#9aa0a6', { x: 2.4, y: 0.5, z: 0.9, rz: Math.PI / 2 }));
    // cabina: profilo laterale estruso (muso piatto, parabrezza inclinato)
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.6); sh.lineTo(2.22, 0.6); sh.lineTo(2.3, 1.35); sh.lineTo(2.22, 1.6); sh.lineTo(2.06, 2.62); sh.lineTo(1.88, 2.86); sh.lineTo(0.12, 2.9); sh.lineTo(0, 2.8); sh.closePath();
    const cab = new THREE.ExtrudeGeometry(sh, { depth: 2.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 2 });
    cab.translate(0, 0, -1.15);
    parts.push(P(cab, paint, { x: 3.2, jit: 0.025 }));
    // vetri: parabrezza (inclinato), finestrini laterali, lunotto
    parts.push(P(new THREE.BoxGeometry(0.04, 0.95, 2.05), glass, { x: 3.2 + 2.18, y: 2.12, rz: -0.16, noSky: true, jit: 0 }));
    for (const z of [-1.2, 1.2]) {
      parts.push(P(new THREE.BoxGeometry(1.1, 0.78, 0.03), glass, { x: 3.2 + 1.35, y: 2.2, z, noSky: true, jit: 0 }));
      parts.push(P(new THREE.BoxGeometry(0.03, 2.0, 0.03), '#2a2b2e', { x: 3.2 + 0.72, y: 1.7, z: z * 1.005 }));        // battuta della portiera
      parts.push(P(new THREE.BoxGeometry(0.18, 0.04, 0.05), '#2a2b2e', { x: 3.2 + 0.9, y: 1.6, z: z * 1.01 }));         // maniglia
      parts.push(P(new THREE.BoxGeometry(0.5, 0.06, 0.3), '#3a3b3e', { x: 3.2 + 1.3, y: 0.75, z: z * 1.06 }));          // predellino
      parts.push(P(new THREE.BoxGeometry(0.05, 0.05, 0.42), '#2a2b2e', { x: 3.2 + 2.2, y: 2.3, z: z * 1.15 }));         // braccio specchio
      parts.push(P(new THREE.BoxGeometry(0.1, 0.42, 0.2), '#2a2b2e', { x: 3.2 + 2.22, y: 2.15, z: z * 1.33 }));         // specchio
    }
    // calandra, fari, paraurti, tergicristalli
    parts.push(P(new THREE.BoxGeometry(0.05, 0.55, 1.5), '#2a2c30', { x: 3.2 + 2.3, y: 1.12, colorFn: (nx, ny, nz, x, y) => (Math.floor(y * 14) % 2 ? '#3c3f44' : '#1e1f22') }));
    for (const z of [-0.82, 0.82]) {
      parts.push(P(new THREE.BoxGeometry(0.05, 0.2, 0.36), '#fff6d8', { x: 3.2 + 2.31, y: 0.98, z, noSky: true, jit: 0 }));
      parts.push(P(new THREE.BoxGeometry(0.05, 0.08, 0.2), '#f0a020', { x: 3.2 + 2.31, y: 1.18, z: z * 1.15, noSky: true, jit: 0 }));
    }
    parts.push(P(new THREE.BoxGeometry(0.22, 0.3, 2.4), '#2e3034', { x: 3.2 + 2.33, y: 0.68 }));
    parts.push(P(new THREE.BoxGeometry(0.03, 0.03, 0.9), '#141414', { x: 3.2 + 2.2, y: 1.66, z: -0.45, rx: 0.3 }));
    // tubo di scarico dietro la cabina e visiera parasole
    parts.push(P(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), '#a8adb2', { x: 3.12, y: 2.2, z: 1.0 }));
    parts.push(P(new THREE.BoxGeometry(0.42, 0.06, 2.2), paint, { x: 3.2 + 2.1, y: 2.95, rz: -0.25 }));
    const g = mergeParts(parts, 2701 + c);
    return c & 1 ? mirrorX(g) : g;
  },
  /** collinetta rocciosa con la galleria della miniera (ingresso a z = 0 verso +z, galleria verso -z) */
  mineHill: (c = 0) => {
    const snowy = c === 1, cols = snowy ? ['#7d8086', '#8d9096', '#72767c'] : ['#a5623c', '#b8754a', '#8e5534', '#c08458'];
    const r = rng(3101 + c), parts = [];
    const top = snowy ? (nx, ny) => (ny > 0.55 ? '#eef2f6' : null) : null;
    const rock = (x, y, z, rad, s = [1, 1, 1]) => parts.push(P(rockGeo(rad, r() * 10, ...s), cols[Math.floor(r() * cols.length)], { x, y, z, jit: 0.07, colorFn: top }));
    const L = 11;
    for (let z = 0.4; z > -L - 1; z -= 1.8) {
      for (const sx of [-1, 1]) {
        const rad = 2.0 + r() * 0.6;
        rock(sx * (2.05 + rad * 1.22), rad * 0.55, z + (r() - 0.5) * 0.6, rad, [1, 0.9, 1]);
        const rad2 = 2.6 + r() * 0.8;
        rock(sx * (5.6 + r() * 1.4), rad2 * 0.3, z - 0.6, rad2, [1, 0.75, 1]);
      }
      const rt = 1.9 + r() * 0.5;
      for (const sx of [-1.4, 1.4]) rock(sx + (r() - 0.5) * 0.4, 3.32 + rt * 1.22, z + (r() - 0.5) * 0.5, rt, [1, 0.85, 1]);
    }
    rock(0, 1.6, -L - 1.8, 2.9, [1.2, 0.9, 1]);                    // fondo
    rock(0, 6.4, -5.5, 3.1, [1.3, 0.7, 1.6]); rock(1.5, 5.6, -9.5, 2.6, [1.2, 0.8, 1]);   // cima
    // massi sparsi davanti all'ingresso
    for (let i = 0; i < 4; i++) { const sx = r() < 0.5 ? -1 : 1; rock(sx * (2.6 + r() * 2.2), 0.2, 1.4 + r() * 2.5, 0.45 + r() * 0.4); }
    return mergeParts(parts, 3101 + c);
  },
  /** binario della miniera: 4 m lungo z */
  rails: () => {
    const parts = [];
    for (let z = -1.67; z < 2; z += 0.67) parts.push(P(new THREE.BoxGeometry(1.4, 0.09, 0.2), '#5a4028', { y: 0.045, z, jit: 0.12 }));
    for (const x of [-0.48, 0.48]) { parts.push(P(new THREE.BoxGeometry(0.07, 0.1, 4.0), '#5c5650', { x, y: 0.14 })); parts.push(P(new THREE.BoxGeometry(0.03, 0.02, 4.0), '#a8a29a', { x, y: 0.2, jit: 0 })); }
    return mergeParts(parts, 3201);
  },
  /** carrello da miniera con minerale */
  mineCart: () => {
    const parts = [], rust = '#6a4632';
    const body = new THREE.CylinderGeometry(0.72, 0.55, 0.75, 4, 1); body.rotateY(Math.PI / 4); body.scale(0.85, 1, 1.2);
    parts.push(P(body, rust, { y: 0.78, jit: 0.06 }));
    parts.push(P(new THREE.BoxGeometry(1.1, 0.08, 1.45), '#3e3a36', { y: 1.16 }));
    for (const x of [-0.48, 0.48]) for (const z of [-0.45, 0.45]) {
      parts.push(P(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), '#2e2c2a', { x, y: 0.2, z, rz: Math.PI / 2 }));
      parts.push(P(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), '#8a8580', { x, y: 0.2, z, rz: Math.PI / 2 }));
    }
    const r = rng(3301);
    for (let i = 0; i < 9; i++) parts.push(P(rockGeo(0.2 + r() * 0.12, i), r() < 0.25 ? '#d8b040' : (r() < 0.5 ? '#4a4a4c' : '#62605c'), { x: (r() - 0.5) * 0.7, y: 1.15 + r() * 0.12, z: (r() - 0.5) * 1.0, jit: 0.1 }));
    return mergeParts(parts, 3301);
  },
  /** mucchio di minerale e piccone */
  orePile: () => {
    const parts = [], r = rng(3401);
    for (let i = 0; i < 14; i++) parts.push(P(rockGeo(0.25 + r() * 0.2, i * 1.3), r() < 0.2 ? '#d6ae3e' : (r() < 0.5 ? '#55524e' : '#6e6a64'), { x: (r() - 0.5) * 1.4, y: 0.15 + r() * 0.3, z: (r() - 0.5) * 1.2, jit: 0.1 }));
    parts.push(P(new THREE.BoxGeometry(0.05, 0.05, 1.0), '#7a5232', { x: 0.7, y: 0.5, z: 0.2, rx: 0.9 }));
    parts.push(P(new THREE.BoxGeometry(0.06, 0.06, 0.6), '#5a5f66', { x: 0.7, y: 0.86, z: -0.12, ry: Math.PI / 2 }));
    return mergeParts(parts, 3401);
  },
  /** lampione rustico: palo di legno, braccio e lanterna */
  lantern: () => mergeParts([
    P(new THREE.BoxGeometry(0.17, 3.4, 0.17), '#5a3e26', { y: 1.7 }),
    P(new THREE.BoxGeometry(0.1, 0.1, 0.8), '#4a3220', { y: 3.2, z: 0.35 }),
    P(new THREE.BoxGeometry(0.06, 0.5, 0.06), '#4a3220', { y: 2.95, z: 0.16, rx: 0.8 }),
    P(new THREE.BoxGeometry(0.02, 0.2, 0.02), '#2a2a2a', { y: 3.05, z: 0.7 }),
    P(new THREE.BoxGeometry(0.26, 0.05, 0.26), '#262626', { y: 2.94, z: 0.7 }),
    P(new THREE.BoxGeometry(0.2, 0.3, 0.2), LAMP_GLOW, { y: 2.76, z: 0.7, noSky: true, jit: 0 }),
    P(new THREE.ConeGeometry(0.2, 0.14, 4), '#262626', { y: 2.98, z: 0.7, ry: Math.PI / 4 }),
    P(new THREE.BoxGeometry(0.24, 0.04, 0.24), '#262626', { y: 2.6, z: 0.7 }),
  ], 3501),
  /** botte di legno con cerchi */
  barrel: () => {
    const g = new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.36, 0.25], [0.38, 0.45], [0.36, 0.65], [0.3, 0.9], [0, 0.9]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
    return mergeParts([P(g, '#8a5a32', { jit: 0.04, colorFn: (nx, ny, nz, x, y) => (ny > 0.9 ? '#6e4626' : (Math.abs(y - 0.15) < 0.05 || Math.abs(y - 0.75) < 0.05 ? '#3a3a3a' : null)) })], 3601);
  },
  /** catasta di legna (tronchetti con le facce tagliate chiare) sotto una tettoia */
  woodpile: () => {
    const parts = [], r = rng(3701);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 9 - row; i++) {
      parts.push(P(new THREE.CylinderGeometry(0.11 + r() * 0.03, 0.12, 0.6, 7), '#6a4a30', { x: -1.0 + i * 0.25 + row * 0.12, y: 0.12 + row * 0.21, z: (r() - 0.5) * 0.06, rx: Math.PI / 2, colorFn: (nx, ny, nz) => (Math.abs(nz) > 0.7 ? '#cfa46e' : null) }));
    }
    for (const x of [-1.2, 1.2]) parts.push(P(new THREE.BoxGeometry(0.1, 1.2, 0.1), '#4a3220', { x, y: 0.6, z: -0.3 }));
    parts.push(P(new THREE.BoxGeometry(2.7, 0.06, 0.95), '#5a3a24', { y: 1.22, z: 0.0, rx: 0.12 }));
    parts.push(P(new THREE.BoxGeometry(2.7, 0.08, 0.9), '#eef2f6', { y: 1.28, z: 0.0, rx: 0.12, noSky: true }));
    return mergeParts(parts, 3701);
  },
  /** abete addobbato al centro della piazzetta alpina */
  xmasTree: () => {
    const parts = [], r = rng(3801);
    parts.push(P(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 8), '#5a3a24', { y: 0.6 }));
    for (let k = 0; k < 5; k++) {
      const y = 1.0 + k * 1.35, rad = 2.6 - k * 0.48;
      parts.push(P(new THREE.ConeGeometry(rad, 2.0, 12), '#24502e', { y: y + 1.0, jit: 0.06, colorFn: (nx, ny) => (ny > 0.62 ? '#eef3f6' : null) }));
      for (let i = 0; i < 6 + (4 - k); i++) {
        const a = r() * 6.28, h = r() * 1.2;
        const rr = rad * (1 - (h + 0.3) / 2.0) + 0.05;
        parts.push(P(new THREE.IcosahedronGeometry(0.11, 0), ['#d8302a', '#f2c230', '#2a6ad8', '#f2f2f2'][i % 4], { x: Math.cos(a) * rr, y: y + 0.3 + h, z: Math.sin(a) * rr, noSky: true, jit: 0 }));
      }
    }
    parts.push(P(new THREE.OctahedronGeometry(0.35, 0), '#ffd84a', { y: 8.6, noSky: true, jit: 0 }));
    return mergeParts(parts, 3801);
  },
  /** campanile in pietra con cella campanaria e cuspide (3,2 × 3,2 m) */
  bellTower: () => {
    const stone = '#b3aa98', parts = [];
    parts.push(P(new THREE.BoxGeometry(3.2, 8, 3.2), stone, { y: 4, jit: 0.03, colorFn: (nx, ny, nz, x, y) => (Math.floor(y / 0.5) % 2 ? null : '#a59c8a') }));
    parts.push(P(new THREE.BoxGeometry(3.5, 0.3, 3.5), '#9a917f', { y: 8.1 }));
    // cella campanaria: quattro pilastri, campana, cornice
    for (const x of [-1.4, 1.4]) for (const z of [-1.4, 1.4]) parts.push(P(new THREE.BoxGeometry(0.45, 2.2, 0.45), stone, { x, y: 9.35, z }));
    parts.push(P(new THREE.LatheGeometry([[0, 0], [0.55, 0], [0.5, 0.15], [0.38, 0.6], [0.3, 0.85], [0, 0.9]].map(([a, b]) => new THREE.Vector2(a, b)), 12), '#a8823a', { y: 8.9 }));
    parts.push(P(new THREE.BoxGeometry(3.5, 0.3, 3.5), '#9a917f', { y: 10.55 }));
    parts.push(P(new THREE.ConeGeometry(2.45, 4.2, 4), '#4a4f5a', { y: 12.8, ry: Math.PI / 4, colorFn: (nx, ny) => (ny > 0.25 ? '#eef2f6' : null) }));
    parts.push(P(new THREE.BoxGeometry(0.08, 1.0, 0.08), '#2a2a2a', { y: 15.3 }));
    parts.push(P(new THREE.BoxGeometry(0.5, 0.08, 0.08), '#2a2a2a', { y: 15.5 }));
    // orologio e portoncino
    parts.push(P(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), '#f2efe6', { y: 6.6, z: 1.62, rx: Math.PI / 2, noSky: true }));
    parts.push(P(new THREE.BoxGeometry(0.05, 0.4, 0.04), '#1e1e1e', { y: 6.75, z: 1.66 }));
    parts.push(P(new THREE.BoxGeometry(0.3, 0.05, 0.04), '#1e1e1e', { x: 0.12, y: 6.6, z: 1.66 }));
    parts.push(P(new THREE.BoxGeometry(1.2, 2.2, 0.08), '#5a3a24', { y: 1.1, z: 1.62 }));
    return mergeParts(parts, 3901);
  },
  /** bancarella del mercato (castello) con tendone a righe e merce */
  stall: (c = 0) => {
    const cc = ['#c8302a', '#2a6ab0', '#2f8a4a', '#d89a20'][c % 4], parts = [];
    for (const x of [-1.3, 1.3]) for (const z of [-0.6, 0.6]) parts.push(P(new THREE.BoxGeometry(0.1, z > 0 ? 2.2 : 2.5, 0.1), '#6a4a2a', { x, y: z > 0 ? 1.1 : 1.25, z }));
    parts.push(P(new THREE.BoxGeometry(2.7, 0.08, 1.3), '#8a6a44', { y: 0.9 }));
    parts.push(P(new THREE.BoxGeometry(2.7, 0.8, 0.05), '#7a5a34', { y: 0.5, z: 0.62 }));
    parts.push(P(new THREE.BoxGeometry(2.9, 0.05, 1.6, 8, 1, 1), cc, { y: 2.42, rx: -0.2, colorFn: (nx, ny, nz, x) => (Math.floor((x + 1.45) / 0.3625) % 2 ? '#f4efe4' : cc) }));
    const r = rng(4001 + c);
    for (let i = 0; i < 10; i++) parts.push(P(new THREE.IcosahedronGeometry(0.1, 0), ['#d83a2a', '#f2b230', '#6aa83a', '#e86a20'][Math.floor(r() * 4)], { x: -1.1 + r() * 2.2, y: 1.0, z: -0.4 + r() * 0.8, jit: 0.1 }));
    for (let i = 0; i < 3; i++) parts.push(P(new THREE.BoxGeometry(0.4, 0.25, 0.3), '#b08a54', { x: -0.9 + i * 0.9, y: 1.06, z: -0.3 }));
    return mergeParts(parts, 4001 + c);
  },
  /** cabina da spiaggia a righe */
  beachHut: (c = 0) => {
    const cc = ['#2a7ad8', '#d83a3a', '#2a9a6a', '#e8a020'][c % 4], parts = [];
    parts.push(P(new THREE.BoxGeometry(1.9, 2.3, 1.9, 8, 1, 1), cc, { y: 1.25, jit: 0.02, colorFn: (nx, ny, nz, x, y, z) => (Math.abs(ny) > 0.5 ? null : (Math.floor(((Math.abs(nx) > 0.5 ? z : x) + 0.95) / 0.2375) % 2 ? '#f6f4ee' : cc)) }));
    parts.push(P(new THREE.ConeGeometry(1.6, 0.8, 4), '#f6f4ee', { y: 2.8, ry: Math.PI / 4 }));
    parts.push(P(new THREE.BoxGeometry(2.1, 0.12, 2.3), '#a8845a', { y: 0.06, z: 0.15 }));
    parts.push(P(new THREE.BoxGeometry(0.8, 1.9, 0.04), '#f6f4ee', { y: 1.1, z: 0.97 }));
    return mergeParts(parts, 4101 + c);
  },
  /** torretta del bagnino */
  lifeguard: () => {
    const parts = [];
    for (const x of [-0.8, 0.8]) for (const z of [-0.8, 0.8]) parts.push(P(new THREE.BoxGeometry(0.12, 2.2, 0.12), '#f2f2ee', { x, y: 1.1, z, rx: z * 0.05, rz: -x * 0.05 }));
    parts.push(P(new THREE.BoxGeometry(2.0, 0.1, 2.0), '#a8845a', { y: 2.2 }));
    parts.push(P(new THREE.BoxGeometry(1.8, 0.9, 0.06), '#d8302a', { y: 2.7, z: -0.9 }));
    for (const x of [-0.9, 0.9]) parts.push(P(new THREE.BoxGeometry(0.06, 0.9, 1.8), '#d8302a', { x, y: 2.7 }));
    parts.push(P(new THREE.BoxGeometry(2.2, 0.08, 2.2), '#f2f2ee', { y: 3.7 }));
    for (const x of [-0.9, 0.9]) for (const z of [-0.9, 0.9]) parts.push(P(new THREE.BoxGeometry(0.06, 1.5, 0.06), '#f2f2ee', { x, y: 2.95, z }));
    for (let i = 0; i < 6; i++) parts.push(P(new THREE.BoxGeometry(0.7, 0.05, 0.12), '#a8845a', { y: 0.25 + i * 0.36, z: 1.25 - i * 0.07 }));
    for (const x of [-0.37, 0.37]) parts.push(P(new THREE.BoxGeometry(0.06, 2.4, 0.06), '#f2f2ee', { x, y: 1.15, z: 1.08, rx: 0.2 }));
    parts.push(P(new THREE.BoxGeometry(0.9, 0.45, 0.04), '#f2f2ee', { y: 3.1, z: 0.95, noSky: true, colorFn: (nx, ny, nz, x) => (Math.abs(x) < 0.08 ? '#d8302a' : null) }));
    return mergeParts(parts, 4201);
  },
  /** rastrelliera con tavole da surf */
  surfRack: () => {
    const parts = [];
    for (const x of [-1.0, 1.0]) parts.push(P(new THREE.BoxGeometry(0.1, 1.2, 0.5), '#8a6a44', { x, y: 0.6 }));
    parts.push(P(new THREE.BoxGeometry(2.1, 0.08, 0.08), '#8a6a44', { y: 1.0, z: -0.2 }));
    ['#f2c230', '#2aa8d8', '#e8502a'].forEach((cc, i) => parts.push(P(new THREE.SphereGeometry(1, 14, 6), cc, { x: -0.6 + i * 0.6, y: 1.05, z: 0.05, sx: 0.26, sy: 1.05, sz: 0.04, rx: -0.25, colorFn: (nx, ny, nz, x) => (Math.abs(x - (-0.6 + i * 0.6)) < 0.03 ? '#f6f6f2' : null) })));
    return mergeParts(parts, 4301);
  },
  /** barca a remi tirata in secca */
  boat: (c = 0) => {
    const cc = ['#2a6ab0', '#c8302a', '#2a8a5a'][c % 3], parts = [];
    parts.push(P(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#f2f0ea', { y: 0.55, sx: 0.85, sy: 0.55, sz: 2.2, colorFn: (nx, ny, nz, x, y) => (y > 0.32 ? cc : (y < 0.2 ? '#7a4a2a' : null)) }));
    parts.push(P(new THREE.TorusGeometry(1, 0.05, 4, 24), cc, { y: 0.56, rx: Math.PI / 2, sx: 0.85, sy: 2.2 }));
    for (const z of [-0.7, 0.2, 1.0]) parts.push(P(new THREE.BoxGeometry(1.4 - Math.abs(z) * 0.3, 0.05, 0.25), '#a8845a', { y: 0.42, z }));
    parts.push(P(new THREE.BoxGeometry(0.05, 0.05, 2.0), '#a8845a', { x: 0.3, y: 0.46, z: 0.1, ry: 0.15 }));
    return mergeParts(parts, 4401 + c);
  },
  /** trattore */
  tractor: (c = 0) => {
    const cc = ['#b8302a', '#2f7a3a', '#2a5aa8'][c % 3], parts = [];
    parts.push(P(new THREE.BoxGeometry(0.9, 0.7, 2.0), cc, { y: 1.05, z: 0.6 }));                      // cofano
    parts.push(P(new THREE.BoxGeometry(0.75, 0.1, 0.06), '#2a2a2a', { y: 1.0, z: 1.62, colorFn: () => '#2a2a2a' }));
    parts.push(P(new THREE.BoxGeometry(1.3, 0.25, 1.3), '#3a3a3a', { y: 0.95, z: -0.7 }));            // pianale
    parts.push(P(new THREE.BoxGeometry(0.5, 0.5, 0.45), '#2a2a2a', { y: 1.35, z: -0.85 }));            // sedile
    for (const x of [-0.6, 0.6]) for (const z of [-0.2, -1.35]) parts.push(P(new THREE.BoxGeometry(0.06, 1.5, 0.06), '#2a2a2a', { x, y: 2.0, z }));
    parts.push(P(new THREE.BoxGeometry(1.35, 0.08, 1.3), cc, { y: 2.78, z: -0.75 }));
    parts.push(P(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), '#3a3a3a', { x: 0.3, y: 1.8, z: 1.2 }));
    for (const x of [-0.85, 0.85]) {
      parts.push(P(tyreGeo(0.78, 0.45, 20), '#1c1c1e', { x, y: 0.78, z: -0.7, ry: Math.PI / 2 }));
      parts.push(P(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 12), '#d8c030', { x: x * 1.0, y: 0.78, z: -0.7, rz: Math.PI / 2, jit: 0 }));
      parts.push(P(tyreGeo(0.42, 0.25, 16), '#1c1c1e', { x: x * 0.75, y: 0.42, z: 1.2, ry: Math.PI / 2 }));
      parts.push(P(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 10), '#d8c030', { x: x * 0.75, y: 0.42, z: 1.2, rz: Math.PI / 2, jit: 0 }));
      parts.push(P(new THREE.BoxGeometry(0.5, 0.05, 1.3), cc, { x: x * 1.0, y: 1.6, z: -0.7 }));
    }
    for (const x of [-0.3, 0.3]) parts.push(P(new THREE.BoxGeometry(0.15, 0.1, 0.04), '#fff4d0', { x, y: 1.25, z: 1.61, noSky: true }));
    return mergeParts(parts, 4501 + c);
  },
  /** spaventapasseri */
  scarecrow: () => mergeParts([
    P(new THREE.BoxGeometry(0.1, 2.3, 0.1), '#6a4a2a', { y: 1.15 }),
    P(new THREE.BoxGeometry(1.6, 0.08, 0.08), '#6a4a2a', { y: 1.6 }),
    P(new THREE.BoxGeometry(0.62, 0.75, 0.28), '#4a6aa0', { y: 1.4, jit: 0.1 }),
    P(new THREE.BoxGeometry(1.5, 0.22, 0.24), '#4a6aa0', { y: 1.62 }),
    P(new THREE.SphereGeometry(0.22, 8, 6), '#d8c28a', { y: 2.05 }),
    P(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), '#a8843a', { y: 2.22 }),
    P(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 10), '#a8843a', { y: 2.35 }),
    P(new THREE.ConeGeometry(0.1, 0.3, 5), '#e2c25a', { x: 0.8, y: 1.55, rz: Math.PI / 2 }),
    P(new THREE.ConeGeometry(0.1, 0.3, 5), '#e2c25a', { x: -0.8, y: 1.55, rz: -Math.PI / 2 }),
  ], 4601),
  /** rotoballa di fieno (sdraiata) */
  roundBale: () => mergeParts([
    P(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 16), '#d6b45a', { y: 0.75, rz: Math.PI / 2, jit: 0.05, colorFn: (nx) => (Math.abs(nx) > 0.7 ? '#c8a44a' : null) }),
    P(new THREE.TorusGeometry(0.68, 0.025, 4, 16), '#b8963a', { x: 0.62, y: 0.75, ry: Math.PI / 2 }),
  ], 4701),
  /** colture: 0 = grano, 1 = mais, 2 = ortaggi (riquadro di 4 × 4 m) */
  crops: (c = 0) => {
    const parts = [], r = rng(4801 + c);
    if (c === 1) {
      for (let x = -1.6; x <= 1.61; x += 0.8) for (let z = -1.8; z < 1.9; z += 0.6) {
        const h = 1.7 + r() * 0.5, ox = x + (r() - 0.5) * 0.15, oz = z + (r() - 0.5) * 0.15;
        parts.push(P(new THREE.BoxGeometry(0.05, h, 0.05), '#5f8a2e', { x: ox, y: h / 2, z: oz, jit: 0.1 }));
        for (let k = 0; k < 2; k++) parts.push(P(new THREE.BoxGeometry(0.5, 0.02, 0.1), '#6f9a34', { x: ox + (k ? 0.2 : -0.2), y: 0.6 + k * 0.5 + r() * 0.2, z: oz, rz: k ? -0.5 : 0.5, ry: r() * 3, jit: 0.1 }));
        parts.push(P(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 5), '#e2c25a', { x: ox + 0.05, y: h * 0.7, z: oz, rz: -0.3 }));
      }
    } else if (c === 2) {
      for (let x = -1.6; x <= 1.61; x += 0.55) for (let z = -1.7; z < 1.8; z += 0.55) parts.push(P(new THREE.IcosahedronGeometry(0.2 + r() * 0.06, 0), r() < 0.5 ? '#6aa83a' : '#8ac04a', { x: x + (r() - 0.5) * 0.1, y: 0.15, z: z + (r() - 0.5) * 0.1, sy: 0.7, jit: 0.12 }));
    } else {
      for (let x = -1.75; x <= 1.76; x += 0.35) for (let z = -1.75; z < 1.8; z += 0.5) {
        const h = 0.7 + r() * 0.3;
        parts.push(P(new THREE.ConeGeometry(0.17, h, 4), '#d8b44a', { x: x + (r() - 0.5) * 0.12, y: h / 2, z: z + (r() - 0.5) * 0.12, ry: r() * 2, jit: 0.12, colorFn: (nx, ny, nz, px, py) => (py < h * 0.3 ? '#a8943a' : null) }));
      }
    }
    return mergeParts(parts, 4801 + c);
  },
  /** cumulo di neve spalata */
  snowPile: () => {
    const parts = [], r = rng(4901);
    for (let i = 0; i < 5; i++) parts.push(P(rockGeo(0.6 + r() * 0.4, i * 2), '#eef2f6', { x: (r() - 0.5) * 1.6, y: 0.1, z: (r() - 0.5) * 0.9, sy: 0.55, jit: 0.04 }));
    return mergeParts(parts, 4901);
  },
  /** slitta di legno */
  sled: () => {
    const parts = [];
    parts.push(P(new THREE.BoxGeometry(0.5, 0.05, 1.1), '#a0663a', { y: 0.3 }));
    for (const x of [-0.24, 0.24]) {
      parts.push(P(new THREE.BoxGeometry(0.04, 0.04, 1.3), '#c83a2a', { x, y: 0.04, z: 0.05 }));
      parts.push(P(new THREE.BoxGeometry(0.04, 0.3, 0.04), '#c83a2a', { x, y: 0.17, z: 0.62, rx: -0.6 }));
      for (const z of [-0.35, 0.3]) parts.push(P(new THREE.BoxGeometry(0.04, 0.27, 0.04), '#8a5a32', { x, y: 0.16, z }));
    }
    return mergeParts(parts, 5001);
  },
  /** rastrelliera con sci e racchette */
  skiRack: () => {
    const parts = [];
    for (const x of [-0.9, 0.9]) parts.push(P(new THREE.BoxGeometry(0.1, 1.3, 0.1), '#5a3e26', { x, y: 0.65 }));
    parts.push(P(new THREE.BoxGeometry(1.9, 0.08, 0.12), '#5a3e26', { y: 1.15 }));
    ['#d8302a', '#2a6ad8', '#f2c230', '#2a2a2a'].forEach((cc, i) => {
      for (const s of [-0.05, 0.05]) parts.push(P(new THREE.BoxGeometry(0.08, 1.7, 0.02), cc, { x: -0.6 + i * 0.4 + s, y: 0.9, z: 0.1, rx: -0.12 }));
    });
    return mergeParts(parts, 5101);
  },
  /** fuoco da campo spento (pietre, legna e brace) */
  campfire: () => {
    const parts = [], r = rng(5201);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; parts.push(P(rockGeo(0.16 + r() * 0.06, i), '#7a746c', { x: Math.cos(a) * 0.55, y: 0.08, z: Math.sin(a) * 0.55, jit: 0.1 })); }
    for (let i = 0; i < 4; i++) parts.push(P(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), '#3a2a1e', { y: 0.2, rx: Math.PI / 2 - 0.4, ry: i * Math.PI / 2, z: 0 }));
    parts.push(P(new THREE.IcosahedronGeometry(0.22, 0), '#e8642a', { y: 0.06, sy: 0.4, noSky: true, jit: 0 }));
    for (const x of [-1.3, 1.3]) parts.push(P(new THREE.CylinderGeometry(0.2, 0.22, 1.4, 8), '#6a4a30', { x, y: 0.2, rx: Math.PI / 2, colorFn: (nx, ny, nz) => (Math.abs(nz) > 0.7 ? '#c89a64' : null) }));
    return mergeParts(parts, 5201);
  },
  /** staccionata per legare i cavalli (western) */
  hitchRail: () => mergeParts([
    P(new THREE.BoxGeometry(0.14, 1.1, 0.14), '#6a4a2a', { x: -1.2, y: 0.55 }),
    P(new THREE.BoxGeometry(0.14, 1.1, 0.14), '#6a4a2a', { x: 1.2, y: 0.55 }),
    P(new THREE.BoxGeometry(2.7, 0.12, 0.12), '#7a5a34', { y: 1.0 }),
    P(new THREE.BoxGeometry(0.9, 0.35, 0.5), '#6a4a2a', { x: 0.6, y: 0.18, z: 0.5, colorFn: (nx, ny) => (ny > 0.7 ? '#4a7aa0' : null) }),
  ], 5301),
  /** carro di legno abbandonato con ruote a raggi */
  wagon: () => {
    const parts = [];
    parts.push(P(new THREE.BoxGeometry(1.4, 0.5, 3.0), '#8a6a44', { y: 1.0, jit: 0.06 }));
    parts.push(P(new THREE.BoxGeometry(1.3, 0.06, 2.9), '#6a4a2a', { y: 0.78 }));
    for (const x of [-0.78, 0.78]) for (const z of [-1.0, 1.0]) {
      parts.push(P(new THREE.TorusGeometry(0.55, 0.05, 4, 16), '#4a3220', { x, y: 0.58, z, ry: Math.PI / 2 }));
      for (let k = 0; k < 4; k++) parts.push(P(new THREE.BoxGeometry(0.03, 1.08, 0.03), '#5a3e26', { x, y: 0.58, z, rx: k * Math.PI / 4 }));
    }
    parts.push(P(new THREE.BoxGeometry(0.08, 0.08, 1.6), '#5a3e26', { y: 0.6, z: 2.2, rx: -0.15 }));
    return mergeParts(parts, 5401);
  },
};

// ═════════ costruttori (usano le funzioni di city.js / world.js passate in K) ═════════
const NORM = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const faceOf = (nx, nz) => NORM.findIndex(n => n[0] === nx && n[1] === nz);
const TRUCK_BODY = ['#d8d4cc', '#b8c4cc', '#c9a26a', '#9aa88a', '#c8b8a0', '#a8b0b8', '#d2b48c'];

export function townBuilders(K) {
  const { C, frame, special, MAT, rnd, sr, pick, stats } = K;
  const { addBox, addCollider, lootSpots, chestSpots, houses } = C;
  const M = C.M;
  const mats = {
    get plank() { return K.mc('tk-plank', () => K.texMat(plankTexture(), { roughness: 0.85 })); },
    get dirt() { return K.mc('tk-dirt', () => K.texMat(dirtRoadTexture(), { roughness: 1 })); },
    get snow() { return K.mc('tk-snow', () => K.texMat(snowRoadTexture(), { roughness: 0.9 })); },
    get sand() { return K.mc('tk-sand', () => K.texMat(sandRoadTexture(), { roughness: 1 })); },
    get field() { return K.mc('tk-field', () => K.texMat(fieldTexture(), { roughness: 1 })); },
    get snowCobble() { return K.mc('tk-snowcobble', () => K.texMat(snowCobbleTexture(), { roughness: 0.9 })); },
    get bank() { return K.solid('tk-bank', '#eef2f6', { roughness: 1 }); },
    get timber() { return K.solid('tk-timber', '#5e4026', { roughness: 0.9 }); },
    get roofMetal() { return K.mc('tk-roofmetal', () => K.texMat(K.corrTex(), { color: '#9aa0a6', roughness: 0.6, metalness: 0.3 })); },
    get canvas() { return K.solid('tk-canvas', '#d8ccb0', { roughness: 0.95, side: THREE.DoubleSide }); },
    get blanket() { return K.solid('tk-blanket', '#8a3a3a', { roughness: 1 }); },
    get water() { return K.solid('tk-water', '#3a6a9a', { roughness: 0.5 }); },
    get solar() { return K.solid('tk-solar', '#1e2a44', { roughness: 0.25, metalness: 0.4 }); },
  };

  // ═════════ casa-camion (western) ═════════
  /** cx, cz = centro del lotto (9 × 2,5 m lungo la strada), face = lato della strada, s = lato della cabina */
  function truckHome(cx, cz, face, y, theme) {
    const s = rnd() < 0.5 ? 1 : -1, LB = 6.2, DB = 2.5, T = 0.1;
    const F0 = frame(cx, cz, 9, DB, face);
    const bx = F0.x(-s * 1.2, DB / 2), bz = F0.z(-s * 1.2, DB / 2);
    const F = frame(bx, bz, LB, DB, face);
    const fy = y + 0.85, top = fy + 2.7, wh = top - (fy - 0.05), wy = (fy - 0.05 + top) / 2;
    const color = pick(TRUCK_BODY), wm = K.corrMat(color);
    const house = { cx: bx, cz: bz, w: F.W, d: F.D, baseY: y, roofMesh: null, roofTop: top + 0.12, doors: [], wallColor: color, roofColor: '#9aa0a6', theme, furn: [], lodH: top - y, city: 'camion' };
    const H = { house }, nc = { house, collide: false, cast: false };
    // pavimento sopra il telaio (sotto c'è solo un collisore: le ruote restano visibili)
    F.box(0, DB / 2, y + 0.725, LB, 0.25, DB, M.floorMat, { house, cast: false });
    { const [x0, x1, z0, z1] = F.rect(-LB / 2, LB / 2, 0, DB); addCollider({ type: 'box', minX: x0, maxX: x1, minY: y, maxY: y + 0.6, minZ: z0, maxZ: z1 }); }
    // pareti di lamiera con porta e finestre
    const ud = -s * 0.9, uw = s * 1.55;
    const run = (alongU, fixed, a0, a1, holes) => {
      const piece = (a, b, ya, yb) => { if (b - a < 0.02 || yb - ya < 0.02) return; const hy = yb - ya, yc = (ya + yb) / 2; if (alongU) F.box((a + b) / 2, fixed, yc, b - a, hy, T, wm, H); else F.box(fixed, (a + b) / 2, yc, T, hy, b - a, wm, H); };
      let cur = a0;
      for (const h of holes.sort((p, q) => p.a0 - q.a0)) {
        piece(cur, h.a0, fy - 0.05, top); piece(h.a0, h.a1, fy - 0.05, h.y0); piece(h.a0, h.a1, h.y1, top);
        if (h.glass) { const c = (h.a0 + h.a1) / 2, gh = h.y1 - h.y0; if (alongU) F.box(c, fixed, h.y0 + gh / 2, h.a1 - h.a0, gh, 0.04, MAT.glass, { house, cast: false }); else F.box(fixed, c, h.y0 + gh / 2, 0.04, gh, h.a1 - h.a0, MAT.glass, { house, cast: false }); }
        cur = h.a1;
      }
      piece(cur, a1, fy - 0.05, top);
    };
    const win = (a, w) => ({ a0: a - w / 2, a1: a + w / 2, y0: fy + 1.0, y1: fy + 1.9, glass: true });
    run(true, T / 2, -LB / 2, LB / 2, [{ a0: ud - 0.62, a1: ud + 0.62, y0: fy, y1: fy + 2.4 }, win(uw, 1.0)]);
    run(true, DB - T / 2, -LB / 2, LB / 2, [win(s * 0.4, 1.3)]);
    run(false, -s * (LB / 2 - T / 2), T, DB - T, [win(DB / 2, 0.8)]);
    run(false, s * (LB / 2 - T / 2), T, DB - T, []);
    C.makeDoor(F.x(ud, T / 2), F.z(ud, T / 2), fy - 0.2, !F.sw, F.N[0], F.N[1], house, 1.2);
    // cornici delle finestre, fascia colorata, ruggine sugli spigoli
    const stripe = K.solid('tk-stripe' + (Math.floor(rnd() * 4)), pick(['#b8442e', '#2f5f8a', '#d6a93a', '#4c7040']), { roughness: 0.6 });
    for (const [a, b] of [[-LB / 2, ud - 0.62], [ud + 0.62, uw - 0.5], [uw + 0.5, LB / 2]].map(p => p.sort((x, y) => x - y))) if (b - a > 0.1) F.box((a + b) / 2, -0.03, fy + 0.5, b - a, 0.22, 0.04, stripe, nc);
    for (const u of [-LB / 2, LB / 2]) for (const v of [0, DB]) F.box(u, v, wy, 0.12, wh, 0.12, MAT.steelDark, nc);
    // tetto (sparisce quando entri), soffitto, plafoniera
    F.box(0, DB / 2, top + 0.06, LB + 0.12, 0.12, DB + 0.12, mats.roofMetal, { house, roof: true });
    F.box(0, DB / 2, top - 0.03, LB - 2 * T, 0.03, DB - 2 * T, MAT.ceil, nc);
    F.box(0, DB / 2, top - 0.06, 0.5, 0.04, 0.3, MAT.lamp, nc);
    if (rnd() < 0.6) { F.box(s * 1.2, DB / 2, top + 0.17, 1.6, 0.06, 1.0, mats.solar, { house, roof: true, collide: false }); F.box(s * 1.2, DB / 2, top + 0.13, 1.7, 0.04, 1.1, MAT.steelDark, { house, roof: true, collide: false, cast: false }); }
    if (rnd() < 0.6) F.box(-s * 2.2, DB / 2, top + 0.45, 0.8, 0.7, 0.8, mats.water, { house, roof: true });
    // gradino davanti alla porta
    F.box(ud, -0.42, y + 0.21, 1.3, 0.42, 0.8, mats.plank, { cast: false });
    // arredo: letto in fondo, cucinino verso la cabina, tavolino
    const bu = -s * (LB / 2 - T - 0.98);
    F.box(bu, DB - T - 0.46, fy + 0.22, 1.95, 0.44, 0.9, M.furnWoodMats ? M.furnWoodMats[0] : M.darkWoodMat, H);
    F.box(bu, DB - T - 0.46, fy + 0.5, 1.9, 0.14, 0.86, pick(M.blanketMats || [mats.blanket]), nc);
    F.box(bu - s * 0.8, DB - T - 0.46, fy + 0.62, 0.3, 0.12, 0.6, K.solid('tk-pillow', '#efe9dc'), nc);
    const ku = s * (LB / 2 - T - 0.32);
    F.box(ku, DB / 2, fy + 0.45, 0.62, 0.9, DB - 2 * T - 0.1, (M.cabinetMats && M.cabinetMats[0]) || M.darkWoodMat, H);
    F.box(ku, DB / 2, fy + 0.92, 0.66, 0.04, DB - 2 * T - 0.06, M.counterTopMat || MAT.steelDark, nc);
    F.box(s * 0.75, DB - T - 0.33, fy + 0.72, 0.9, 0.05, 0.6, M.darkWoodMat, nc);
    F.box(s * 0.75, DB - T - 0.33, fy + 0.36, 0.08, 0.72, 0.08, M.darkWoodMat, nc);
    // tendalino a righe con due pali, sedie e botte
    const aw = Math.floor(rnd() * 6), au = ud + s * 0.7;
    F.box(au, -1.15, top - 0.2, 3.6, 0.05, 2.3, MAT.awning(aw), { collide: false, cast: true });
    for (const du of [-1.7, 1.7]) F.box(au + du, -2.25, (y + top - 0.2) / 2, 0.06, top - 0.2 - y, 0.06, MAT.steelDark, { collide: false, cast: false });
    if (rnd() < 0.7) special('cafeSet', F.x(au + s * 0.8, -1.6), F.z(au + s * 0.8, -1.6), y, [0.45, 0.78, false], { rot: F.rot });
    if (rnd() < 0.6) special('barrel', F.x(-s * 3.6, -0.6), F.z(-s * 3.6, -0.6), y, [0.38, 0.9, false]);
    // telaio, ruote e cabina (instanziati)
    special('truck', F.x(0, DB / 2), F.z(0, DB / 2), y, null, { rot: F.rot, c: Math.floor(rnd() * TRUCK_PAINTS) * 2 + (s > 0 ? 1 : 0) });
    { const [x0, x1, z0, z1] = F.rect(s * (LB / 2 + 0.05), s * (LB / 2 + 2.45), 0.05, DB - 0.05); addCollider({ type: 'box', minX: x0, maxX: x1, minY: y, maxY: y + 2.95, minZ: z0, maxZ: z1 }); }
    // bottino
    lootSpots.push(new THREE.Vector3(F.x(-s * 0.2, 1.0), fy, F.z(-s * 0.2, 1.0)));
    if (rnd() < 0.45) chestSpots.push({ pos: new THREE.Vector3(F.x(-s * 0.45, DB - T - 0.42), fy, F.z(-s * 0.45, DB - T - 0.42)), rot: F.rot + Math.PI });
    houses.push(house);
    C.chunkAt(bx, bz).houses.push(house);
    stats.camion = (stats.camion || 0) + 1;
    return house;
  }

  // ═════════ miniera ═════════
  /** galleria scavata in una collinetta rocciosa; N = direzione verso l'esterno della città, off = spostamento laterale */
  function mineFrame(t, N, off, L = 11) {
    const Tg = [-N[1], N[0]], re = t.r - 16;
    const ex = t.x + N[0] * re + Tg[0] * off, ez = t.z + N[1] * re + Tg[1] * off;
    return frame(ex + N[0] * L / 2, ez + N[1] * L / 2, 3.6, L, faceOf(-N[0], -N[1]));
  }
  function mineRect(t, N, off) { const F = mineFrame(t, N, off); return F.rect(-8, 8, -8, 14); }
  function mine(t, N, off, snowy) {
    const L = 11, F = mineFrame(t, N, off, L), y = t.h;
    const nc = { collide: false, cast: false }, plank = M.crateMat || mats.plank;
    // rivestimento di assi, centine ogni 2,2 m, soffitto
    for (const sd of [-1, 1]) F.box(sd * 1.66, L / 2, y + 1.55, 0.12, 3.1, L, plank, { cast: false });
    F.box(0, L / 2, y + 3.2, 3.5, 0.14, L, plank, { cast: false });
    F.box(0, L - 0.06, y + 1.6, 3.2, 3.2, 0.12, plank, { cast: false });
    for (let v = 0.4; v < L - 0.2; v += 2.2) {
      for (const sd of [-1, 1]) F.box(sd * 1.48, v, y + 1.45, 0.24, 2.9, 0.24, mats.timber, nc);
      F.box(0, v, y + 3.0, 3.2, 0.26, 0.26, mats.timber, nc);
      if (Math.round(v / 2.2) % 2) F.box(1.3, v, y + 2.35, 0.14, 0.22, 0.14, MAT.lamp, nc);   // lanterne
    }
    // portale con architrave e tavola
    for (const sd of [-1, 1]) F.box(sd * 1.9, -0.1, y + 1.85, 0.42, 3.7, 0.42, mats.timber, { cast: true });
    F.box(0, -0.1, y + 3.6, 4.8, 0.45, 0.5, mats.timber, { cast: true });
    F.box(0, -0.4, y + 4.25, 2.2, 0.62, 0.08, M.darkWoodMat, nc);
    F.box(0, -0.45, y + 4.25, 1.9, 0.12, 0.02, K.solid('tk-minesign', '#e8d8a8'), nc);
    // collina rocciosa (instanziata) e i suoi collisori
    special('mineHill', F.x(0, 0), F.z(0, 0), y, null, { rot: F.rot, c: snowy ? 1 : 0 });
    const col = (u0, u1, v0, v1, y0, y1) => { const [x0, x1, z0, z1] = F.rect(u0, u1, v0, v1); addCollider({ type: 'box', minX: x0, maxX: x1, minY: y + y0, maxY: y + y1, minZ: z0, maxZ: z1 }); };
    col(1.72, 6.6, 0.3, L + 2.4, -1, 5.4); col(-6.6, -1.72, 0.3, L + 2.4, -1, 5.4);
    col(-6.6, 6.6, 0.3, L + 2.4, 3.28, 7.0); col(-1.72, 1.72, L, L + 2.4, -1, 3.28);
    // binari dentro e fuori, carrelli, minerale, casse
    for (const v of [L - 2.2, L - 6.2, L - 10.2, -3.8, -7.8]) special('rails', F.x(0, v), F.z(0, v), y, null, { rot: F.rot });
    const cart = (v) => { special('mineCart', F.x(0, v), F.z(0, v), y + 0.1, null, { rot: F.rot }); const [x0, x1, z0, z1] = F.rect(-0.62, 0.62, v - 0.85, v + 0.85); addCollider({ type: 'box', minX: x0, maxX: x1, minY: y, maxY: y + 1.3, minZ: z0, maxZ: z1 }); };
    cart(-4.5); cart(L - 3.2);
    special('orePile', F.x(-0.9, L - 1.0), F.z(-0.9, L - 1.0), y, [0.7, 0.6, false], { rot: F.rot });
    C.addCrate(0.9, 0.8, 0.9, F.x(1.0, 3.2), y + 0.4, F.z(1.0, 3.2), {});
    C.addCrate(0.9, 0.8, 0.9, F.x(2.6, -1.6), y + 0.4, F.z(2.6, -1.6), {});
    special('barrel', F.x(-2.6, -1.2), F.z(-2.6, -1.2), y, [0.38, 0.9, false]);
    // bottino: dentro la galleria (forziere in fondo)
    lootSpots.push(new THREE.Vector3(F.x(-0.6, L * 0.45), y + 0.05, F.z(-0.6, L * 0.45)));
    lootSpots.push(new THREE.Vector3(F.x(0.6, L - 1.4), y + 0.05, F.z(0.6, L - 1.4)));
    chestSpots.push({ pos: new THREE.Vector3(F.x(0.75, L - 0.9), y + 0.05, F.z(0.75, L - 0.9)), rot: F.rot });
    const house = { cx: (F.rect(-1.7, 1.7, 0, L)[0] + F.rect(-1.7, 1.7, 0, L)[1]) / 2, cz: (F.rect(-1.7, 1.7, 0, L)[2] + F.rect(-1.7, 1.7, 0, L)[3]) / 2, w: F.W, d: F.D, baseY: y, roofMesh: null, roofTop: y + 3.3, doors: [], wallColor: snowy ? '#8d9096' : '#a5623c', roofColor: snowy ? '#e8eef4' : '#b8754a', theme: t.theme, furn: [], lodH: 5.5, city: 'miniera' };
    houses.push(house); C.chunkAt(house.cx, house.cz).houses.push(house);
    stats.miniere = (stats.miniere || 0) + 1;
  }

  // ═════════ palafitta (coastal) ═════════
  function stiltHouse(cx, cz, w, d, face, y, th) {
    const lift = 1.6, F = frame(cx, cz, w, d, face);
    const sw = face >= 2;
    const hs = C.placeHouse(cx, cz, sw ? d : w, sw ? w : d, y + lift, false, th, face);
    hs.lodH = 4.1 + lift; hs.baseY = y; hs.stilt = lift;
    const post = M.darkWoodMat;
    for (const u of [-w / 2 + 0.25, 0, w / 2 - 0.25]) for (const v of [0.25, d / 2, d - 0.25]) {
      if (u === 0 && v === d / 2) continue;
      F.box(u, v, y + lift / 2, 0.3, lift + 0.05, 0.3, post, {});
    }
    // terrazzino davanti alla porta, ringhiere, scala di 5 gradini
    F.box(0, -0.7, y + lift + 0.1, 3.4, 0.2, 1.4, mats.plank, { cast: true });
    for (const sd of [-1, 1]) { F.box(sd * 1.65, -0.7, y + lift + 0.7, 0.08, 1.0, 1.4, mats.plank, { collide: true }); F.box(sd * 1.65, -1.36, y + lift / 2, 0.16, lift, 0.16, post, {}); }
    for (let i = 1; i <= 5; i++) { const tp = lift + 0.2 - i * 0.3, v = -1.4 - (i - 0.5) * 0.32; F.box(0, v, y + tp / 2, 1.3, tp, 0.32, mats.plank, { cast: false }); }
    for (const sd of [-1, 1]) F.box(sd * 0.68, -2.2, y + 0.95, 0.06, 0.06, 1.7, post, { collide: false, cast: false });
    return hs;
  }

  // ═════════ campi coltivati (farm) ═════════
  function field(cx, cz, w, d, y, kind) {
    addBox(w, 0.06, d, cx, y + 0.03, cz, mats.field, { collide: false, cast: false, lodColor: '#6a4e34' });
    for (let x = -w / 2 + 2; x <= w / 2 - 1.99; x += 4) for (let z = -d / 2 + 2; z <= d / 2 - 1.99; z += 4) special('crops', cx + x, cz + z, y + 0.05, null, { rot: 0, c: kind });
    // staccionata decorativa (ci si passa attraverso) con un varco
    const fm = M.darkWoodMat, gapSide = Math.floor(rnd() * 4);
    for (const [sd, horiz] of [[-1, true], [1, true], [-1, false], [1, false]]) {
      const len = horiz ? w : d, side = (horiz ? 0 : 2) + (sd > 0 ? 1 : 0);
      for (let a = -len / 2; a <= len / 2 + 0.01; a += 2.4) {
        if (side === gapSide && Math.abs(a) < 1.6) continue;
        const px = horiz ? cx + a : cx + sd * (w / 2 + 0.4), pz = horiz ? cz + sd * (d / 2 + 0.4) : cz + a;
        addBox(0.12, 1.0, 0.12, px, y + 0.5, pz, fm, { collide: false });
      }
      for (const yy of [0.45, 0.85]) {
        const segs = side === gapSide ? [[-len / 2, -1.6], [1.6, len / 2]] : [[-len / 2, len / 2]];
        for (const [a, b] of segs) { const L = b - a, m = (a + b) / 2; if (horiz) addBox(L, 0.09, 0.06, cx + m, y + yy, cz + sd * (d / 2 + 0.4), fm, { collide: false, cast: false }); else addBox(0.06, 0.09, L, cx + sd * (w / 2 + 0.4), y + yy, cz + m, fm, { collide: false, cast: false }); }
      }
    }
    if (kind === 0 && rnd() < 0.6) special('scarecrow', cx + sr(-w / 4, w / 4), cz + sr(-d / 4, d / 4), y, [0.15, 2.3, true]);
    stats.campi = (stats.campi || 0) + 1;
  }

  // ═════════ mura del castello ═════════
  function castleWalls(t) {
    const pl = t.plan, y = t.h, s = pl.wallS, WT = 2.4, Ht = 7, stone = M.stoneMat, lod = '#a39d92';
    const mid = s + WT / 2;
    const openings = [];   // per lato: intervalli lungo il muro senza muratura
    const sides = [{ nx: 0, nz: -1 }, { nx: 0, nz: 1 }, { nx: -1, nz: 0 }, { nx: 1, nz: 0 }];
    sides.forEach((sd, i) => {
      const along = sd.nx === 0;   // muro parallelo a x
      const lines = along ? pl.ox : pl.oz;
      const gates = [];
      if (lines.length) {
        const sorted = [...lines].sort((a, b) => Math.abs(a) - Math.abs(b) || (i % 2 ? b - a : a - b));
        gates.push(sorted[0]);
      }
      const holes = gates.map(g => [g - pl.rw - 0.6, g + pl.rw + 0.6, 'gate', g]);
      // varchi dove passano le strade tra le città
      let inGap = null;
      for (let a = -s - WT; a <= s + WT; a += 1) {
        const x = t.x + (along ? a : sd.nx * mid), z = t.z + (along ? sd.nz * mid : a);
        const on = C.roadDist(x, z) < 4.2;
        if (on && inGap === null) inGap = a;
        if (!on && inGap !== null) { holes.push([inGap - 1, a + 1, 'road']); inGap = null; }
      }
      if (inGap !== null) holes.push([inGap - 1, s + WT + 1, 'road']);
      openings.push({ sd, along, holes, gates });
      // tratti di muro (base adattata al terreno)
      const segs = []; let cur = -s - WT;
      for (const [h0, h1] of holes.sort((p, q) => p[0] - q[0])) { if (h0 > cur) segs.push([cur, h0]); cur = Math.max(cur, h1); }
      if (cur < s + WT) segs.push([cur, s + WT]);
      for (const [a0, a1] of segs) for (let a = a0; a < a1 - 0.01; a += 6) {
        const b = Math.min(a1, a + 6), m = (a + b) / 2, len = b - a;
        const P0 = (q) => [t.x + (along ? q : sd.nx * mid), t.z + (along ? sd.nz * mid : q)];
        let gmin = Infinity;
        for (const q of [a, m, b]) { const [qx, qz] = P0(q); gmin = Math.min(gmin, C.terrainHeight(qx, qz)); }
        const base = Math.min(y, gmin) - 1.5, topY = y + Ht, hh = topY - base;
        const [cx, cz] = P0(m);
        if (along) addBox(len, hh, WT, cx, base + hh / 2, cz, stone, { lodColor: lod }); else addBox(WT, hh, len, cx, base + hh / 2, cz, stone, { lodColor: lod });
        // merli sul lato esterno (riparo per chi sta sul cammino di ronda)
        for (let q = a + 0.5; q < b - 0.3; q += 1.6) {
          const ox = along ? t.x + q : t.x + sd.nx * (s + WT - 0.25), oz = along ? t.z + sd.nz * (s + WT - 0.25) : t.z + q;
          addBox(along ? 0.85 : 0.5, 1.0, along ? 0.5 : 0.85, ox, topY + 0.5, oz, stone, {});
        }
        // cornice sporgente
        if (along) addBox(len, 0.25, 0.3, cx, topY - 0.4, t.z + sd.nz * (s + WT + 0.12), M.trimMat, { collide: false, cast: false }); else addBox(0.3, 0.25, len, t.x + sd.nx * (s + WT + 0.12), topY - 0.4, cz, M.trimMat, { collide: false, cast: false });
      }
      // porte: architrave, contrafforti, strada lastricata fino al muro, scala per salire
      for (const g of gates) {
        const gw = 2 * pl.rw + 1.2, gx = along ? t.x + g : t.x + sd.nx * mid, gz = along ? t.z + sd.nz * mid : t.z + g;
        if (along) addBox(gw, Ht - 4.6, WT, gx, y + 4.6 + (Ht - 4.6) / 2, gz, stone, { lodColor: lod }); else addBox(WT, Ht - 4.6, gw, gx, y + 4.6 + (Ht - 4.6) / 2, gz, stone, { lodColor: lod });
        for (const e of [-1, 1]) {
          // contrafforti ai lati della porta (sporgono verso l'esterno)
          const px = along ? gx + e * (gw / 2 + 0.6) : gx + sd.nx * 0.6, pz = along ? gz + sd.nz * 0.6 : gz + e * (gw / 2 + 0.6);
          addBox(along ? 1.2 : WT + 1.2, Ht + 2.2, along ? WT + 1.2 : 1.2, px, y + (Ht + 2.2) / 2 - 1, pz, stone, { lodColor: lod });
        }
        const L = Math.sqrt(Math.max(0, pl.R * pl.R - g * g));
        const r0 = L - 0.5, r1 = s + WT + 0.5;
        const mc = (r0 + r1) / 2;
        if (along) addBox(2 * pl.rw, 0.08, r1 - r0, t.x + g, y, t.z + sd.nz * mc, K.roadMat(pl), { collide: false, cast: false });
        else addBox(r1 - r0, 0.08, 2 * pl.rw, t.x + sd.nx * mc, y, t.z + g, K.roadMat(pl), { collide: false, cast: false });
        // scala addossata al muro, lato interno, accanto alla porta (16 gradini)
        const dir = g >= 0 ? -1 : 1, start = g + dir * (gw / 2 + 1.3), rise = Ht / 16;
        for (let k = 1; k <= 16; k++) {
          const q = start + dir * (k - 0.5) * 0.6, hh = rise * k;
          if (along) addBox(0.6, hh, 1.4, t.x + q, y + hh / 2, t.z + sd.nz * (s - 0.7), stone, { cast: k > 12 });
          else addBox(1.4, hh, 0.6, t.x + sd.nx * (s - 0.7), y + hh / 2, t.z + q, stone, { cast: k > 12 });
        }
        lootSpots.push(new THREE.Vector3(along ? t.x + g + dir * 3 : t.x + sd.nx * mid, y + Ht + 0.05, along ? t.z + sd.nz * mid : t.z + g + dir * 3));
      }
    });
    // torri d'angolo con merli e bandiera
    let fi = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = t.x + sx * mid, z = t.z + sz * mid, Tt = Ht + 4;
      const gmin = Math.min(y, C.terrainHeight(x, z), C.terrainHeight(x + sx * 3, z + sz * 3)) - 1.5;
      addBox(6, y + Tt - gmin, 6, x, (gmin + y + Tt) / 2, z, stone, { lodColor: lod });
      addBox(6.8, 0.5, 6.8, x, y + Tt + 0.25, z, stone, { lodColor: lod });
      for (let k = 0; k < 4; k++) for (let u = -3.0; u <= 3.01; u += 1.5) {
        const mx = k < 2 ? u : (k === 2 ? -3.15 : 3.15), mz = k < 2 ? (k === 0 ? -3.15 : 3.15) : u;
        addBox(0.6, 0.9, 0.6, x + mx, y + Tt + 0.95, z + mz, stone, {});
      }
      special('flag', x, z, y + Tt + 0.5, null, { c: fi++ });
      lootSpots.push(new THREE.Vector3(x - sx * 1.2, y + Tt + 0.5, z - sz * 1.2));
    }
    stats.mura = (stats.mura || 0) + 1;
    return openings;
  }

  return { truckHome, mine, mineRect, stiltHouse, field, castleWalls, mats };
}
