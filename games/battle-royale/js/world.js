// Mondo di gioco: terreno, città, alberi, collisioni e raycast
// La parte "logica" (collisioni, posizioni di case/alberi/bottino) è calcolata all'avvio perché
// serve ai bot in tutta l'isola; la parte grafica è generata a CHUNK attorno alla telecamera,
// un pezzo per volta, e liberata quando ci si allontana.
import * as THREE from 'three';
import { PROPS, PROP_DIMS, propMaterial, metalPropMaterial, treeMaterial, bushMaterial, rockMaterial, WIND } from './props.js?v=7';

/** posizione del giocatore: l'erba vicina si piega al suo passaggio */
export const GRASS_PLAYER = { value: new THREE.Vector3(0, -9999, 0) };

export const SCALE = 3;               // la mappa è 3 volte più grande della versione originale
export const HALF = 200 * SCALE;      // la mappa va da -600 a +600
export const WATER_LEVEL = -2.6;
export const CHUNK = 100;             // lato di un chunk (m)
const EDGE = HALF + 60;               // il terreno continua un po' nel mare

export const TOWNS = [
  { name: 'Centro Caos', x: 15, z: 0, r: 52, houses: 12 },
  { name: 'Piazza Pulita', x: -315, z: -285, r: 34, houses: 7 },
  { name: 'Torri Tremanti', x: 300, z: -315, r: 32, houses: 4, towers: true },
  { name: 'Borgo Bottino', x: -330, z: 285, r: 34, houses: 7 },
  { name: 'Villa Vertigine', x: 336, z: 276, r: 30, houses: 5 },
  { name: 'Porto Pigro', x: -430, z: 0, r: 26, houses: 3, containers: true },
  { name: 'Fattoria Felice', x: 120, z: 390, r: 26, houses: 3 },
  { name: 'Deposito Dannato', x: 90, z: -430, r: 28, houses: 2, containers: true },
  { name: 'Lido Lampo', x: 470, z: -20, r: 30, houses: 5 },
  { name: 'Castello Cosmico', x: -130, z: -175, r: 34, houses: 6, towers: true },
  { name: 'Miniera Matta', x: -440, z: -420, r: 26, houses: 3, containers: true },
  { name: 'Bosco Brivido', x: -200, z: 430, r: 28, houses: 4 },
  { name: 'Faro Folle', x: 460, z: 460, r: 24, houses: 3, towers: true },
  { name: 'Campeggio Caos', x: 190, z: 170, r: 28, houses: 4 },
  { name: 'Valle Vortice', x: -470, z: 190, r: 26, houses: 3 },
  { name: 'Stazione Strana', x: 230, z: -170, r: 32, houses: 5, containers: true },
  { name: 'Paese Pazzo', x: -10, z: 250, r: 32, houses: 6 },
  { name: 'Rocca Ribelle', x: -20, z: -290, r: 28, houses: 4 },
];

// ── generatore pseudo-casuale con seme (mappa sempre uguale) ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const srand = mulberry32(1337);
const sr = (a, b) => a + srand() * (b - a);

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const MOUNTAINS = [
  { x: -290, z: -60, r: 120, h: 36 },
  { x: 340, z: 70, r: 105, h: 32 },
  { x: -90, z: 470, r: 85, h: 26 },
  { x: 150, z: -300, r: 70, h: 20 },
];
const LAKES = [
  { x: -150, z: 110, r: 90, d: 10 },
  { x: 300, z: -60, r: 50, d: 9 },
  { x: -300, z: 420, r: 45, d: 9 },
];

function baseHeight(x, z) {
  const X = x / 1.8, Z = z / 1.8;   // colline più ampie
  let h = 7 * Math.sin(X * 0.018 + 0.5) * Math.cos(Z * 0.015 - 0.3)
    + 3.2 * Math.sin(X * 0.047 + 1.3) * Math.sin(Z * 0.041 + 0.7)
    + 1.1 * Math.sin(x * 0.12) * Math.cos(z * 0.105)
    + 0.4 * Math.sin(x * 0.31 + z * 0.27);
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r) { const k = 1 - d / m.r; h += m.h * k * k * (3 - 2 * k) * (0.85 + 0.15 * Math.sin(x * 0.07 + z * 0.05)); }
  }
  for (const l of LAKES) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < l.r) h -= l.d * (1 - smoothstep(0, l.r, d));
  }
  return h;
}

for (const t of TOWNS) t.h = Math.max(1.2, baseHeight(t.x, t.z) + 0.5);

export function terrainHeight(x, z) {
  let h = baseHeight(x, z);
  for (const t of TOWNS) {
    const dx = x - t.x, dz = z - t.z;
    const R = t.r + 18;
    if (dx > R || dx < -R || dz > R || dz < -R) continue;
    const d = Math.hypot(dx, dz);
    if (d < R) {
      const k = 1 - smoothstep(t.r, R, d);
      h = h + (t.h - h) * k;
    }
  }
  // isola: la costa scende nel mare oltre il bordo della mappa
  const e = Math.max(Math.abs(x), Math.abs(z)) + 14 * Math.sin(x * 0.02 + z * 0.013) + 6 * Math.sin(x * 0.05 - z * 0.04);
  const c0 = HALF - 72;
  if (e > c0) h = h + (-9 - h) * smoothstep(c0, HALF, e);
  return h;
}

// ─────────────── Collisioni ───────────────
export const colliders = [];
const CELL = 16;
const grid = new Map();
let stamp = 0;

function cellKey(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); }

export function addCollider(c) {
  if (c.type === 'cyl') {
    c.minX = c.x - c.r; c.maxX = c.x + c.r; c.minZ = c.z - c.r; c.maxZ = c.z + c.r;
  }
  c._s = 0;
  colliders.push(c);
  c.cells = [];
  const x0 = Math.floor(c.minX / CELL), x1 = Math.floor(c.maxX / CELL);
  const z0 = Math.floor(c.minZ / CELL), z1 = Math.floor(c.maxZ / CELL);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const k = cellKey(ix, iz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(c);
    c.cells.push(k);
  }
  return c;
}

export function removeCollider(c) {
  const i = colliders.indexOf(c);
  if (i >= 0) colliders.splice(i, 1);
  for (const k of c.cells) {
    const arr = grid.get(k);
    if (!arr) continue;
    const j = arr.indexOf(c);
    if (j >= 0) arr.splice(j, 1);
  }
}

export function queryColliders(x, z, r) {
  stamp++;
  const out = [];
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const arr = grid.get(cellKey(ix, iz));
    if (!arr) continue;
    for (const c of arr) if (c._s !== stamp) { c._s = stamp; out.push(c); }
  }
  return out;
}

/** Altezza del suolo (terreno o cima di una cassa) sotto un punto */
export function groundAt(x, z, feetY, radius = 0.35) {
  let g = terrainHeight(x, z);
  const list = queryColliders(x, z, radius + 0.1);
  for (const c of list) {
    if (c.noStand) continue;
    if (c.maxY > feetY + 0.5) continue; // troppo alto per salirci
    if (c.maxY <= g) continue;
    if (c.type === 'box') {
      if (x > c.minX - radius * 0.6 && x < c.maxX + radius * 0.6 && z > c.minZ - radius * 0.6 && z < c.maxZ + radius * 0.6) g = c.maxY;
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + radius * 0.5) g = c.maxY;
  }
  return g;
}

/** Spinge fuori un cerchio (personaggio) dai collisori */
export function resolveCollisions(pos, radius, height) {
  const list = queryColliders(pos.x, pos.z, radius + 0.2);
  let hit = false;
  for (const c of list) {
    if (pos.y >= c.maxY - 0.05 || pos.y + height <= c.minY) continue;
    if (!c.noStand && c.maxY - pos.y <= 0.5) continue; // gradino: ci si sale sopra
    if (c.type === 'box') {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        } else {
          // centro dentro il box: esci dal lato più vicino
          const pen = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z];
          const m = Math.min(...pen);
          if (m === pen[0]) pos.x = c.minX - radius;
          else if (m === pen[1]) pos.x = c.maxX + radius;
          else if (m === pen[2]) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
        hit = true;
      }
    } else {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min && d > 1e-6) {
        pos.x += (dx / d) * (min - d);
        pos.z += (dz / d) * (min - d);
        hit = true;
      }
    }
  }
  return hit;
}

function rayBox(o, d, c) {
  let tmin = 0, tmax = Infinity;
  const mins = [c.minX, c.minY, c.minZ], maxs = [c.maxX, c.maxY, c.maxZ];
  const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mins[i] || os[i] > maxs[i]) return -1;
    } else {
      let t1 = (mins[i] - os[i]) / ds[i];
      let t2 = (maxs[i] - os[i]) / ds[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

function rayCyl(o, d, c) {
  const dx = o.x - c.x, dz = o.z - c.z;
  const a = d.x * d.x + d.z * d.z;
  const cc = dx * dx + dz * dz - c.r * c.r;
  if (a < 1e-9) {
    // raggio verticale: colpisce solo se parte dentro il cilindro
    if (cc > 0) return -1;
    const t = d.y > 0 ? c.minY - o.y : o.y - c.maxY;
    return t >= 0 ? t : (o.y >= c.minY && o.y <= c.maxY ? 0 : -1);
  }
  const b = 2 * (dx * d.x + dz * d.z);
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  let t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) { if (cc < 0) t = 0; else return -1; }
  const y = o.y + d.y * t;
  if (y < c.minY || y > c.maxY) return -1;
  return t;
}

/** Raycast contro i collisori, attraversando solo le celle della griglia toccate dal raggio (DDA).
 *  Ritorna {t, collider} oppure null */
export function rayColliders(o, d, maxDist, ignore = null) {
  stamp++;
  let best = maxDist, hit = null;
  const test = (arr) => {
    for (const c of arr) {
      if (c._s === stamp || c === ignore) continue;
      c._s = stamp;
      const t = c.type === 'box' ? rayBox(o, d, c) : rayCyl(o, d, c);
      if (t >= 0 && t < best) { best = t; hit = c; }
    }
  };
  let ix = Math.floor(o.x / CELL), iz = Math.floor(o.z / CELL);
  const hl = Math.hypot(d.x, d.z);
  if (hl < 1e-6) { const a = grid.get(cellKey(ix, iz)); if (a) test(a); return hit ? { t: best, collider: hit } : null; }
  const stepX = d.x > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
  const tdx = Math.abs(d.x) > 1e-9 ? CELL / Math.abs(d.x) : Infinity;
  const tdz = Math.abs(d.z) > 1e-9 ? CELL / Math.abs(d.z) : Infinity;
  let tmx = Math.abs(d.x) > 1e-9 ? ((d.x > 0 ? (ix + 1) * CELL - o.x : o.x - ix * CELL) / Math.abs(d.x)) : Infinity;
  let tmz = Math.abs(d.z) > 1e-9 ? ((d.z > 0 ? (iz + 1) * CELL - o.z : o.z - iz * CELL) / Math.abs(d.z)) : Infinity;
  let tEnter = 0;
  for (let n = 0; n < 4000; n++) {
    if (tEnter > best) break;
    const a = grid.get(cellKey(ix, iz));
    if (a) test(a);
    if (tmx < tmz) { tEnter = tmx; tmx += tdx; ix += stepX; }
    else { tEnter = tmz; tmz += tdz; iz += stepZ; }
    if (tEnter > maxDist) break;
  }
  return hit ? { t: best, collider: hit } : null;
}

/** Raycast contro il terreno (ray marching + bisezione) */
export function rayTerrain(o, d, maxDist) {
  const step = 1.2;
  let prevT = 0;
  for (let t = step; t <= maxDist + step; t += step) {
    const tt = Math.min(t, maxDist);
    const y = o.y + d.y * tt;
    if (d.y > 0 && y > 80) return -1;
    if (y < terrainHeight(o.x + d.x * tt, o.z + d.z * tt)) {
      let a = prevT, b = tt;
      for (let i = 0; i < 8; i++) {
        const m = (a + b) / 2;
        if (o.y + d.y * m < terrainHeight(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
      }
      return a;
    }
    prevT = tt;
    if (tt >= maxDist) break;
  }
  return -1;
}

/** Raycast completo (collisori + terreno) */
export function rayWorld(o, d, maxDist, ignore = null) {
  const c = rayColliders(o, d, maxDist, ignore);
  const lim = c ? c.t : maxDist;
  const tt = rayTerrain(o, d, lim);
  if (tt >= 0) return { t: tt, collider: null, terrain: true };
  return c;
}

// ─────────────── Materiali e texture condivisi ───────────────
const M = {};
function m(name, color, opts = {}) {
  if (!M[name]) M[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
  return M[name];
}

function makeWallTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  // blocchi con leggere variazioni di tono
  for (let y = 0; y < 128; y += 16) {
    const off = (y / 16) % 2 ? 16 : 0;
    for (let x = off - 32; x < 128; x += 32) {
      const k = Math.random();
      g.fillStyle = k < 0.5 ? `rgba(0,0,0,${0.02 + k * 0.06})` : `rgba(255,255,255,${(k - 0.5) * 0.12})`;
      g.fillRect(x, y, 32, 16);
    }
  }
  // grana dell'intonaco
  const img = g.getImageData(0, 0, 128, 128), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * 14; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  // fughe con un filo di luce sotto (effetto rilievo)
  g.lineWidth = 2;
  for (let y = 0; y < 128; y += 16) {
    g.strokeStyle = line; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + 1.5); g.lineTo(128, y + 1.5); g.stroke(); g.lineWidth = 2;
    const off = (y / 16) % 2 ? 16 : 0;
    g.strokeStyle = line;
    for (let x = off; x < 128; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeRoofTexture(base) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  // file di tegole sfalsate con ombra sotto ogni fila
  for (let row = 0; row < 8; row++) {
    const y = row * 16, off = row % 2 ? 8 : 0;
    for (let x = -off; x < 128; x += 16) {
      const k = 0.85 + Math.random() * 0.3;
      g.fillStyle = `rgba(${k > 1 ? 255 : 0},${k > 1 ? 255 : 0},${k > 1 ? 255 : 0},${Math.abs(k - 1) * 0.35})`;
      g.fillRect(x + 1, y + 1, 14, 13);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + 13, 16, 3);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y, 1.5, 14);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 2, y + 2, 11, 2);
    }
  }
  { const img = g.getImageData(0, 0, 128, 128), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * 12; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(img, 0, 0); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBrickTexture(base = '#9a4a3a') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8cfc0'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < 64; x += 16) {
      const k = 0.8 + Math.random() * 0.35;
      const cc = new THREE.Color(base).multiplyScalar(k);
      g.fillStyle = '#' + cc.getHexString();
      g.fillRect(x + 1, row * 8 + 1, 14, 6);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 1, row * 8 + 1, 14, 1);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 1, row * 8 + 6, 14, 1);
    }
  }
  { const img = g.getImageData(0, 0, 64, 64), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * 16; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(img, 0, 0); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a6a35'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#6e4620'; g.lineWidth = 3;
  g.strokeRect(2, 2, 60, 60);
  g.beginPath(); g.moveTo(2, 2); g.lineTo(62, 62); g.stroke();
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,30,10,${Math.random() * 0.15})`; g.fillRect(Math.random() * 64, Math.random() * 64, 8, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─────────────── Strade (collegano ogni città alle 2 più vicine) ───────────────
const roads = [];
function buildRoads() {
  const seen = new Set();
  TOWNS.forEach((a, i) => {
    const near = TOWNS.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.z - b.z) })).filter(o => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2);
    for (const { j } of near) {
      const key = Math.min(i, j) + '-' + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      roads.push([a, TOWNS[j]]);
    }
  });
}
function roadDist(x, z) {
  let best = Infinity;
  for (const [a, b] of roads) {
    const vx = b.x - a.x, vz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
    if (d < best) best = d;
  }
  return best;
}

function inTown(x, z, pad = 0) {
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return t;
  return null;
}

// colore del terreno in un punto (usato sia dai chunk dettagliati sia da quelli lontani)
const _gc = {
  grass1: new THREE.Color('#4f9a3a'), grass2: new THREE.Color('#82c04e'), meadow: new THREE.Color('#3f8436'),
  dry: new THREE.Color('#b5b65a'), flower: new THREE.Color('#9fc95a'), sand: new THREE.Color('#e3cf92'), wetSand: new THREE.Color('#a8956a'),
  rock: new THREE.Color('#878274'), rockDark: new THREE.Color('#6a665c'), dirt: new THREE.Color('#a8865a'), dirtEdge: new THREE.Color('#7f8a48'),
  snow: new THREE.Color('#f4f7fb'), town: new THREE.Color('#9aa36b'),
};
// rumore liscio economico (somma di seni sfasati, deterministico)
function patch(x, z, f, o) {
  return 0.5 + 0.25 * Math.sin(x * f + Math.sin(z * f * 0.7 + o) * 1.7) + 0.25 * Math.sin(z * f * 1.13 - Math.cos(x * f * 0.6 - o) * 1.9);
}
function groundColor(x, z, h, out, slope = null) {
  // base: due verdi che si alternano + macchie di prato scuro, erba secca e fiorita
  const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2);
  out.copy(_gc.grass1).lerp(_gc.grass2, n * 0.7);
  const big = patch(x, z, 0.011, 1.3), mid = patch(x, z, 0.043, 4.1);
  out.lerp(_gc.meadow, smoothstep(0.55, 0.85, big) * 0.6);
  out.lerp(_gc.dry, smoothstep(0.62, 0.9, mid) * smoothstep(0.35, 0.15, big) * 0.75);
  out.lerp(_gc.flower, smoothstep(0.7, 0.95, patch(x, z, 0.09, 7.7)) * 0.35);
  if (inTown(x, z, 4)) out.lerp(_gc.town, 0.45);
  // strade sterrate con bordo erboso più scuro
  const rd = roadDist(x, z);
  if (rd < 5) out.lerp(_gc.dirtEdge, smoothstep(5, 3.5, rd) * 0.5);
  if (rd < 3.5) out.lerp(_gc.dirt, 1 - rd / 3.5);
  // spiagge, con sabbia bagnata vicino all'acqua
  if (h < WATER_LEVEL + 1.4) out.lerp(_gc.sand, Math.min(1, (WATER_LEVEL + 1.4 - h) / 1.2));
  if (h < WATER_LEVEL + 0.35) out.lerp(_gc.wetSand, Math.min(1, (WATER_LEVEL + 0.35 - h) / 0.6));
  // pendii ripidi → roccia (pendenza stimata dalle differenze dell'altezza)
  if (slope === null) {
    const gx = terrainHeight(x + 1.5, z) - terrainHeight(x - 1.5, z), gz = terrainHeight(x, z + 1.5) - terrainHeight(x, z - 1.5);
    slope = Math.hypot(gx, gz) / 3;
  }
  if (h > WATER_LEVEL + 0.5) out.lerp(_gc.rock, smoothstep(0.55, 1.0, slope) * 0.85);
  if (h > 14) out.lerp(_gc.rock, Math.min(1, (h - 14) / 6));
  if (h > 16) out.lerp(_gc.rockDark, smoothstep(0.5, 0.8, mid) * 0.4);
  if (h > 28) out.lerp(_gc.snow, Math.min(1, (h - 28) / 8) * (1 - smoothstep(0.7, 1.2, slope) * 0.6));
  return out;
}

// texture di dettaglio del terreno (dati lineari): R = filini d'erba fini, G = chiazze morbide
function makeGroundDetail() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(150,150,0)'; g.fillRect(0, 0, S, S);
  const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
  // canale G: chiazze morbide
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 10 + Math.random() * 38, v = Math.random() < 0.5 ? 90 : 215;
    wrap((ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgba(0,${v},0,0.35)`); gr.addColorStop(1, `rgba(0,${v},0,0)`);
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
  // canale R: filini d'erba e granelli (additivo/sottrattivo sul rosso)
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) d[i] = 150 + (Math.random() - 0.5) * 50;
  for (let k = 0; k < 2600; k++) {
    let x = Math.random() * S, y = Math.random() * S;
    const len = 2 + Math.random() * 5, dx = (Math.random() - 0.5) * 0.7, v = Math.random() < 0.55 ? 90 : 225;
    for (let t = 0; t < len; t++) {
      const ix = ((Math.round(x) % S) + S) % S, iy = ((Math.round(y) % S) + S) % S;
      const j = (iy * S + ix) * 4;
      d[j] = d[j] * 0.4 + v * 0.6;
      x += dx; y -= 1;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** aggiunge la texture di dettaglio (coordinate mondo, due scale) a un materiale del terreno.
 *  Usa lo slot `map` integrato (binding affidabile) ma sostituisce il campionamento. */
function addGroundDetail(mat, tex, near = 70, far = 260, amount = 1) {
  mat.map = tex;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <map_fragment>', `
        {
          float dist = length(vWPos - cameraPosition);
          float fine = texture2D(map, vWPos.xz * 0.17).r;
          float fine2 = texture2D(map, vWPos.xz * 0.071 + vec2(0.31, 0.67)).r;
          float blot = texture2D(map, vWPos.xz * 0.019).g;
          float nearK = 1.0 - smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, dist);
          float d = mix(1.0, 0.45 + 0.95 * fine, nearK * 0.9) * mix(1.0, 0.62 + 0.75 * fine2, 0.6);
          d *= 0.72 + 0.5 * blot;
          diffuseColor.rgb *= mix(1.0, d, ${amount.toFixed(2)});
        }`);
  };
  mat.customProgramCacheKey = () => 'ground-' + near + '-' + far + '-' + amount;
}

/** normal map affiancabile per l'acqua (somma di onde con frequenze intere) */
function makeWaterNormal() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const waves = [];
  for (let i = 0; i < 9; i++) waves.push({ kx: Math.round((Math.random() - 0.5) * 10), ky: Math.round((Math.random() - 0.5) * 10) || 1, a: 0.4 / (1 + i * 0.4), p: Math.random() * 6.283 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) {
      const ph = (w.kx * x + w.ky * y) / S * 6.283 + w.p, cs = Math.cos(ph) * w.a;
      dx += cs * w.kx * 0.08; dy += cs * w.ky * 0.08;
    }
    const nx = -dx, ny = -dy, nz = 1, l = Math.hypot(nx, ny, nz), j = (y * S + x) * 4;
    d[j] = (nx / l * 0.5 + 0.5) * 255; d[j + 1] = (ny / l * 0.5 + 0.5) * 255; d[j + 2] = (nz / l * 0.5 + 0.5) * 255; d[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ═════════════════════════ COSTRUZIONE ═════════════════════════
export function buildWorld(scene) {
  buildRoads();
  const lootSpots = [];
  const chestSpots = [];
  const houses = [];

  // ── griglia dei chunk ──
  const NC = Math.ceil(EDGE / CHUNK);            // chunk per lato da 0 al bordo
  const chunks = new Map();
  const chunkKey = (cx, cz) => cx + ',' + cz;
  for (let cx = -NC; cx < NC; cx++) for (let cz = -NC; cz < NC; cz++) {
    chunks.set(chunkKey(cx, cz), { cx, cz, x0: cx * CHUNK, z0: cz * CHUNK, boxes: [], trees: [], rocks: [], bushes: [], specials: [], houses: [], props: [], detail: null, lod: null, state: 0 });
  }
  const chunkAt = (x, z) => chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));

  // ── materiali ──
  const wallColors = ['#e8dcc0', '#d9b48a', '#c9d6df', '#e6c3b0', '#cfe0c0', '#f0e0a0'];
  const wallMats = wallColors.map(c => new THREE.MeshStandardMaterial({ map: makeWallTexture(c, 'rgba(0,0,0,0.12)'), roughness: 0.9 }));
  const roofColors = ['#a33b2a', '#5a5f6a', '#3b5a8a', '#7a4a2a'];
  const roofMats = roofColors.map(c => new THREE.MeshStandardMaterial({ map: makeRoofTexture(c), roughness: 0.8 }));
  const stoneMat = new THREE.MeshStandardMaterial({ map: makeWallTexture('#a39d92', 'rgba(0,0,0,0.25)'), roughness: 0.95 });
  const trimMat = m('trim', '#f1ede2');
  const brickMat = new THREE.MeshStandardMaterial({ map: makeBrickTexture(), roughness: 0.9 });
  const capMat = m('cap', '#55575c');
  const shutterColors = ['#3f6e4a', '#3c5f8a', '#7a4a2a', '#8a3a3a', '#5f6a3a'];
  const shutterMats = shutterColors.map(c => m('shut' + c, c));
  const matMat = m('doormat', '#7a3b2a');
  const floorMat = m('floor', '#8a6a4a');
  const woodTex = makeWoodTexture();
  const crateMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
  const metalMat = m('metal', '#6a6f78', { metalness: 0.6, roughness: 0.4 });
  const contColors = ['#c0392b', '#2471a3', '#d68910', '#1e8449'];
  const containerMats = contColors.map(c => m('cont' + c, c, { metalness: 0.4, roughness: 0.6 }));
  const groundDetail = makeGroundDetail();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  addGroundDetail(terrainMat, groundDetail, 70, 260, 1);
  const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  addGroundDetail(lodMat, groundDetail, 0, 1, 0.7);
  const blockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

  /** Registra un box: il collisore subito, la mesh quando il chunk viene generato */
  function addBox(w, h, d, x, y, z, material, opts = {}) {
    const spec = { w, h, d, x, y, z, material, cast: opts.cast !== false, lodColor: opts.lodColor, house: opts.house, roof: opts.roof, mesh: null };
    chunkAt(x, z).boxes.push(spec);
    if (opts.collide !== false) {
      spec.c = addCollider({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2, noStand: opts.noStand });
    }
    return spec;
  }

  function placeHouse(cx, cz, w, d, baseY, rot90) {
    if (rot90) { const t = w; w = d; d = t; }
    const H = 3.8, T = 0.35, door = 2.2;
    const wi = Math.floor(srand() * wallMats.length);
    const wm = wallMats[wi];
    const house = { cx, cz, w, d, baseY, roofMesh: null, roofTop: baseY + H + 0.3, doors: [], wallColor: wallColors[wi] };
    const ho = { house };
    const deco = { house, collide: false };
    const shutM = shutterMats[Math.floor(srand() * shutterMats.length)];
    addBox(w, 0.2, d, cx, baseY + 0.1, cz, floorMat, { cast: false, ...ho });
    // zoccolo in pietra sotto un pezzo di muro (solo estetico)
    const plinth = (s, len, x, z) => {
      if (s.horiz) addBox(len, 0.55, T + 0.14, x, baseY + 0.275, z, stoneMat, { ...deco, cast: false });
      else addBox(T + 0.14, 0.55, len, x, baseY + 0.275, z, stoneMat, { ...deco, cast: false });
    };
    // elemento sporgente sulla faccia esterna del muro: u = lungo il muro, v = altezza
    const outer = (s, n, u, y, lu, lh, depth, mat) => {
      const o = T / 2 + depth / 2;
      if (s.horiz) addBox(lu, lh, depth, s.x + u, y, s.z + n[1] * o, mat, deco);
      else addBox(depth, lh, lu, s.x + n[0] * o, y, s.z + u, mat, deco);
    };
    const doorSide = Math.floor(srand() * 4);
    const normals = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const sides = [
      { x: cx, z: cz - d / 2 + T / 2, len: w, horiz: true },
      { x: cx, z: cz + d / 2 - T / 2, len: w, horiz: true },
      { x: cx - w / 2 + T / 2, z: cz, len: d, horiz: false },
      { x: cx + w / 2 - T / 2, z: cz, len: d, horiz: false },
    ];
    sides.forEach((s, i) => {
      const hasDoor = i === doorSide || (i === (doorSide ^ 1) && srand() < 0.5);
      const hasWindow = !hasDoor && srand() < 0.7;
      if (hasDoor) house.doors.push({ x: s.x, z: s.z, nx: normals[i][0], nz: normals[i][1] });
      if (hasDoor || hasWindow) {
        const gap = hasDoor ? door : 1.6;
        const seg = (s.len - gap) / 2;
        const off = gap / 2 + seg / 2;
        const n = normals[i];
        for (const sgn of [-1, 1]) {
          if (s.horiz) { addBox(seg, H, T, s.x + sgn * off, baseY + H / 2, s.z, wm, ho); plinth(s, seg, s.x + sgn * off, s.z); }
          else { addBox(T, H, seg, s.x, baseY + H / 2, s.z + sgn * off, wm, ho); plinth(s, seg, s.x, s.z + sgn * off); }
        }
        if (hasDoor) {
          // cornice della porta e zerbino
          for (const sgn of [-1, 1]) outer(s, n, sgn * (gap / 2 + 0.07), baseY + 1.3, 0.14, 2.6, 0.1, trimMat);
          outer(s, n, 0, baseY + 2.67, gap + 0.28, 0.14, 0.1, trimMat);
          outer(s, n, 0, baseY + 0.02, 1.3, 0.04, 0.9, matMat);
        } else {
          // finestra: cornice, davanzale e persiane aperte
          const wy = baseY + H / 2;
          for (const sgn of [-1, 1]) outer(s, n, sgn * (gap / 2 + 0.06), wy, 0.12, 1.72, 0.08, trimMat);
          outer(s, n, 0, baseY + H - 1.1 + 0.06, gap + 0.24, 0.12, 0.08, trimMat);
          outer(s, n, 0, baseY + 1.1 - 0.04, gap + 0.4, 0.08, 0.26, trimMat);
          if (seg > 1.0) for (const sgn of [-1, 1]) outer(s, n, sgn * (gap / 2 + 0.12 + 0.4), wy, 0.78, 1.6, 0.05, shutM);
        }
        if (hasDoor) {
          const lh = H - 2.6;
          if (s.horiz) addBox(gap, lh, T, s.x, baseY + 2.6 + lh / 2, s.z, wm, ho);
          else addBox(T, lh, gap, s.x, baseY + 2.6 + lh / 2, s.z, wm, ho);
        } else {
          if (s.horiz) {
            addBox(gap, 1.1, T, s.x, baseY + 0.55, s.z, wm, ho);
            addBox(gap, 1.1, T, s.x, baseY + H - 0.55, s.z, wm, ho);
          } else {
            addBox(T, 1.1, gap, s.x, baseY + 0.55, s.z, wm, ho);
            addBox(T, 1.1, gap, s.x, baseY + H - 0.55, s.z, wm, ho);
          }
          plinth(s, gap, s.x, s.z);
        }
      } else {
        if (s.horiz) addBox(s.len, H, T, s.x, baseY + H / 2, s.z, wm, ho);
        else addBox(T, H, s.len, s.x, baseY + H / 2, s.z, wm, ho);
        plinth(s, s.len, s.x, s.z);
      }
    });
    const ri = Math.floor(srand() * roofMats.length);
    addBox(w + 0.6, 0.3, d + 0.6, cx, baseY + H + 0.15, cz, roofMats[ri], { ...ho, roof: true });
    // cornicione sotto il tetto e comignolo (fanno parte del "tetto": spariscono quando entri)
    addBox(w + 0.3, 0.22, d + 0.3, cx, baseY + H - 0.08, cz, trimMat, { ...ho, roof: true, collide: false, cast: false });
    {
      const sx = srand() < 0.5 ? -1 : 1, sz = srand() < 0.5 ? -1 : 1;
      const chx = cx + sx * (w / 2 - 1.1), chz = cz + sz * (d / 2 - 1.1);
      addBox(0.8, 1.4, 0.8, chx, baseY + H + 0.3 + 0.7, chz, brickMat, { ...ho, roof: true });
      addBox(0.95, 0.14, 0.95, chx, baseY + H + 0.3 + 1.45, chz, capMat, { ...ho, roof: true, collide: false });
    }
    house.roofColor = roofColors[ri];
    houses.push(house);
    chunkAt(cx, cz).houses.push(house);
    // loot e casse dentro la casa
    const nLoot = 1 + Math.floor(srand() * 3);
    for (let i = 0; i < nLoot; i++) {
      lootSpots.push(new THREE.Vector3(cx + sr(-w / 2 + 1.2, w / 2 - 1.2), baseY + 0.2, cz + sr(-d / 2 + 1.2, d / 2 - 1.2)));
    }
    if (srand() < 0.7) chestSpots.push({ pos: new THREE.Vector3(cx + sr(-w / 2 + 1.3, w / 2 - 1.3), baseY + 0.2, cz + sr(-d / 2 + 1.3, d / 2 - 1.3)), rot: srand() * Math.PI });
    if (srand() < 0.6) {
      const tx = cx + sr(-w / 4, w / 4), tz = cz + sr(-d / 4, d / 4);
      addBox(1.6, 0.9, 0.9, tx, baseY + 0.55, tz, crateMat, ho);
    }
    return house;
  }

  function overlapsHouse(x, z, w, d) {
    for (const h of houses) {
      if (Math.abs(x - h.cx) < (w + h.w) / 2 + 4 && Math.abs(z - h.cz) < (d + h.d) / 2 + 4) return true;
    }
    return false;
  }

  // ── città ──
  for (const t of TOWNS) {
    let placed = 0, tries = 0;
    while (placed < t.houses && tries < 300) {
      tries++;
      const w = Math.round(sr(8, 13)), d = Math.round(sr(8, 12));
      const a = srand() * Math.PI * 2, rr = placed === 0 && t.houses > 6 ? sr(14, 20) : sr(4, t.r - 8);
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      const rot = srand() < 0.5;
      const ww = rot ? d : w, dd = rot ? w : d;
      if (overlapsHouse(x, z, ww, dd)) continue;
      placeHouse(x, z, w, d, t.h, rot);
      placed++;
    }
    if (t.towers) {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.4;
        const x = t.x + Math.cos(a) * (t.r - 6), z = t.z + Math.sin(a) * (t.r - 6);
        addBox(5, 18, 5, x, t.h + 9, z, wallMats[2], { lodColor: wallColors[2] });
        addBox(6, 0.6, 6, x, t.h + 18.3, z, metalMat, { lodColor: '#6a6f78' });
        lootSpots.push(new THREE.Vector3(x + 3.5, t.h + 0.2, z));
      }
    }
    if (t.containers) {
      for (let i = 0; i < 8; i++) {
        const x = t.x + sr(-t.r + 4, t.r - 4), z = t.z + sr(-t.r + 4, t.r - 4);
        if (overlapsHouse(x, z, 7, 7)) continue;
        const rot = srand() < 0.5;
        const stack = srand() < 0.35 ? 2 : 1;
        for (let s = 0; s < stack; s++) {
          const ci = Math.floor(srand() * 4);
          addBox(rot ? 2.5 : 6.5, 2.6, rot ? 6.5 : 2.5, x, t.h + 1.3 + s * 2.6, z, containerMats[ci], { lodColor: contColors[ci] });
        }
        lootSpots.push(new THREE.Vector3(x + (rot ? 2 : 0), t.h + 0.2, z + (rot ? 0 : 2)));
      }
    }
    const nCrates = Math.floor(t.r / 3);
    for (let i = 0; i < nCrates; i++) {
      const a = srand() * Math.PI * 2, rr = sr(3, t.r);
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      if (overlapsHouse(x, z, 1.5, 1.5)) continue;
      const s = sr(1.1, 1.4);
      const gy = terrainHeight(x, z);
      addBox(s, s, s, x, gy + s / 2, z, crateMat);
      if (srand() < 0.3) addBox(s * 0.9, s * 0.9, s * 0.9, x + 0.1, gy + s + s * 0.45, z, crateMat);
      if (srand() < 0.5) lootSpots.push(new THREE.Vector3(x + s, gy, z));
    }
  }

  // ── fontana al centro ──
  {
    const t = TOWNS[0];
    chunkAt(t.x, t.z).specials.push({ type: 'fountain', x: t.x, z: t.z, h: t.h });
    addCollider({ type: 'cyl', x: t.x, z: t.z, r: 3.3, minY: t.h - 1, maxY: t.h + 1 });
    addCollider({ type: 'cyl', x: t.x, z: t.z, r: 0.5, minY: t.h, maxY: t.h + 3.5, noStand: true });
    lootSpots.push(new THREE.Vector3(t.x, t.h + 1.05, t.z + 1.8));
  }

  // ── alberi (solo dati + collisori) ──
  const trees = [];
  let tries = 0;
  const NTREES = Math.round(420 * SCALE * SCALE * 0.95 * 1.7);
  // densità dei boschi: alberi fitti nelle macchie scure, radi nei prati
  const forestK = (x, z) => 0.18 + 0.82 * smoothstep(0.42, 0.72, patch(x, z, 0.0085, 2.1) * 0.75 + patch(x, z, 0.031, 5.3) * 0.25);
  while (trees.length < NTREES && tries < NTREES * 14) {
    tries++;
    const x = sr(-HALF + 8, HALF - 8), z = sr(-HALF + 8, HALF - 8);
    if (srand() > forestK(x, z)) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.8 || h > 26) continue;
    if (inTown(x, z, 6)) continue;
    if (roadDist(x, z) < 4) continue;
    const t = { x, z, h, s: sr(0.8, 1.45), pine: srand() < (h > 12 ? 0.8 : 0.5), rot: srand() * 6.28, hue: 0.28 + sr(-0.04, 0.05), light: sr(0.28, 0.4) };
    trees.push(t);
    chunkAt(x, z).trees.push(t);
    addCollider({ type: 'cyl', x, z, r: 0.4 * t.s, minY: h - 1, maxY: h + 3.2 * t.s, noStand: true, tree: true });
  }

  // ── cespugli (nessuna collisione: ci si può nascondere dentro) ──
  const NBUSH = Math.round(520 * SCALE * SCALE);
  tries = 0;
  let nb = 0;
  while (nb < NBUSH && tries < NBUSH * 8) {
    tries++;
    const x = sr(-HALF + 6, HALF - 6), z = sr(-HALF + 6, HALF - 6);
    if (srand() > 0.35 + forestK(x, z) * 0.65) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.9 || h > 24) continue;
    if (inTown(x, z, 2) || roadDist(x, z) < 3.5) continue;
    chunkAt(x, z).bushes.push({ x, z, h, s: sr(0.7, 1.4), rot: srand() * 6.28, v: Math.floor(srand() * 4) });
    nb++;
  }

  // ── rocce ──
  const NROCKS = Math.round(140 * SCALE * SCALE * 0.9 * 1.4);
  tries = 0;
  let nr = 0;
  while (nr < NROCKS && tries < NROCKS * 20) {
    tries++;
    const x = sr(-HALF + 6, HALF - 6), z = sr(-HALF + 6, HALF - 6);
    if (inTown(x, z, 3)) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL - 1) continue;
    const r = { x, z, h, s: sr(0.7, 2.4), e: [srand() * 3, srand() * 3, srand() * 3], k: [sr(0.9, 1.4), sr(0.6, 1), sr(0.9, 1.3)] };
    r.shape = Math.floor(srand() * 5);
    chunkAt(x, z).rocks.push(r); nr++;
    addCollider({ type: 'cyl', x, z, r: r.s * 0.95, minY: h - 2, maxY: h + r.s * 0.9 });
    // a volte qualche masso più piccolo accanto (gruppi di rocce)
    if (srand() < 0.35) {
      const nk = 1 + Math.floor(srand() * 3);
      for (let k = 0; k < nk; k++) {
        const a2 = srand() * 6.28, d2 = r.s * sr(1.1, 1.8), x2 = x + Math.cos(a2) * d2, z2 = z + Math.sin(a2) * d2;
        const h2 = terrainHeight(x2, z2);
        if (h2 < WATER_LEVEL - 1 || inTown(x2, z2, 3)) continue;
        const r2 = { x: x2, z: z2, h: h2, s: r.s * sr(0.3, 0.55), e: [srand() * 3, srand() * 3, srand() * 3], k: [sr(0.9, 1.4), sr(0.6, 1), sr(0.9, 1.3)], shape: Math.floor(srand() * 5) };
        chunkAt(x2, z2).rocks.push(r2);
        if (r2.s > 0.45) addCollider({ type: 'cyl', x: x2, z: z2, r: r2.s * 0.95, minY: h2 - 2, maxY: h2 + r2.s * 0.9 });
      }
    }
    if (srand() < 0.15) lootSpots.push(new THREE.Vector3(x + r.s + 0.8, h, z));
  }

  // ── oggetti di scena: catasta di legna, pile di mattoni, barili, casette ──
  const barrels = [];
  /** true se in (x,z) c'è spazio libero di raggio r (niente collisori né case) */
  function freeSpot(x, z, r) {
    for (const c of queryColliders(x, z, r + 1)) {
      if (c.type === 'cyl') { if (Math.hypot(c.x - x, c.z - z) < c.r + r) return false; }
      else if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return false;
    }
    return !overlapsHouseR(x, z, r);
  }
  function overlapsHouseR(x, z, r) {
    for (const h of houses) if (Math.abs(x - h.cx) < h.w / 2 + r + 0.6 && Math.abs(z - h.cz) < h.d / 2 + r + 0.6) return true;
    return false;
  }
  function flatEnough(x, z, r, maxDiff) {
    const h0 = terrainHeight(x, z);
    let lo = h0, hi = h0;
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
      const h = terrainHeight(x + dx * 0.7, z + dz * 0.7); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return hi - lo < maxDiff ? lo : null;
  }
  function addProp(type, x, z, rot, extra = {}) {
    const y = extra.y ?? terrainHeight(x, z);
    const pr = { type, x, y, z, rot, ...extra };
    chunkAt(x, z).props.push(pr);
    const q90 = Math.round(rot / (Math.PI / 2)) % 2 !== 0;   // ruotato di 90°: scambia larghezza e profondità
    if (type === 'logs' || type === 'bricks') {
      const D = PROP_DIMS[type];
      const w = q90 ? D.d : D.w, d = q90 ? D.w : D.d;
      pr.c = addCollider({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minY: y - 0.5, maxY: y + D.h, minZ: z - d / 2, maxZ: z + d / 2, harvest: type === 'logs' ? 16 : 10, prop: pr });
    } else if (type.startsWith('barrel')) {
      const D = PROP_DIMS.barrel;
      pr.c = addCollider({ type: 'cyl', x, z, r: D.r, minY: y - 0.3, maxY: y + D.h, barrel: pr, harvest: type === 'barrelWood' ? 6 : 0 });
      if (type === 'barrelRed') { pr.explosive = true; pr.hp = pr.maxHp = 35; }
      barrels.push(pr);
    } else if (type === 'shed') {
      const D = PROP_DIMS.shed;
      const w = q90 ? D.d : D.w, d = q90 ? D.w : D.d;
      addCollider({ type: 'box', minX: x - w / 2 + 0.25, maxX: x + w / 2 - 0.25, minY: y - 1, maxY: y + D.wallH, minZ: z - d / 2 + 0.25, maxZ: z + d / 2 - 0.25 });
      // parte alta del tetto (più stretta: ci si può arrampicare a gradini)
      const k = 0.45;
      addCollider({ type: 'box', minX: x - (q90 ? w / 2 - 0.3 : w * k / 2), maxX: x + (q90 ? w / 2 - 0.3 : w * k / 2), minY: y + D.wallH, maxY: y + D.h - 0.2, minZ: z - (q90 ? d * k / 2 : d / 2 - 0.3), maxZ: z + (q90 ? d * k / 2 : d / 2 - 0.3) });
    }
    return pr;
  }
  const barrelKinds = () => { const r = srand(); return r < 0.35 ? 'barrelRed' : r < 0.65 ? 'barrelBlue' : 'barrelWood'; };
  // nelle città
  for (const t of TOWNS) {
    const nLogs = 1 + Math.floor(t.r / 18), nBricks = (t.containers ? 4 : 1) + Math.floor(srand() * 2), nBarrelGroups = Math.floor(t.r / 9) + (t.containers ? 4 : 0);
    const tryPlace = (n, r, fn) => {
      let placed = 0;
      for (let k = 0; k < n * 25 && placed < n; k++) {
        const a = srand() * Math.PI * 2, rr = sr(4, t.r + 4);
        const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
        if (roadDist(x, z) < 3.5 || !freeSpot(x, z, r)) continue;
        fn(x, z); placed++;
      }
    };
    tryPlace(nLogs, 1.5, (x, z) => addProp('logs', x, z, Math.floor(srand() * 4) * Math.PI / 2));
    tryPlace(nBricks, 0.9, (x, z) => addProp('bricks', x, z, Math.floor(srand() * 4) * Math.PI / 2));
    tryPlace(nBarrelGroups, 1.6, (x, z) => {
      const n = 1 + Math.floor(srand() * 3);
      for (let i = 0; i < n; i++) {
        const bx = x + (i === 0 ? 0 : Math.cos(i * 2.2) * 0.9), bz = z + (i === 0 ? 0 : Math.sin(i * 2.2) * 0.9);
        if (i === 0 || freeSpot(bx, bz, 0.42)) addProp(barrelKinds(), bx, bz, srand() * 6.28);
      }
    });
  }
  // in campagna: casette isolate, cataste nei boschi e qualche barile
  let nSheds = 0;
  for (let k = 0; k < 3000 && nSheds < 48; k++) {
    const x = sr(-HALF + 30, HALF - 30), z = sr(-HALF + 30, HALF - 30);
    if (inTown(x, z, 14)) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 1.2 || h > 24) continue;
    const base = flatEnough(x, z, 3.2, 1.3);
    if (base === null || !freeSpot(x, z, 3.6)) continue;
    const rot = Math.floor(srand() * 4) * Math.PI / 2;
    addProp('shed', x, z, rot, { y: base });
    nSheds++;
    // bottino accanto alla porta (la porta guarda verso +Z del modello)
    const fx = Math.sin(rot), fz = Math.cos(rot);
    const dd = PROP_DIMS.shed.d / 2 + 1.0;
    lootSpots.push(new THREE.Vector3(x + fx * dd, terrainHeight(x + fx * dd, z + fz * dd), z + fz * dd));
    if (srand() < 0.45) {
      const cxp = x - fz * (PROP_DIMS.shed.w / 2 + 1.2), czp = z + fx * (PROP_DIMS.shed.w / 2 + 1.2);
      if (freeSpot(cxp, czp, 0.8)) chestSpots.push({ pos: new THREE.Vector3(cxp, terrainHeight(cxp, czp), czp), rot: rot });
    }
    if (srand() < 0.5) { const lx = x + fz * 4.5, lz = z - fx * 4.5; if (freeSpot(lx, lz, 1.5)) addProp('logs', lx, lz, rot); }
    if (srand() < 0.4) { const bx = x - fx * 3.6 + fz * 2.5, bz = z - fz * 3.6 - fx * 2.5; if (freeSpot(bx, bz, 0.45)) addProp(srand() < 0.5 ? 'barrelWood' : 'barrelBlue', bx, bz, srand() * 6); }
  }
  for (let k = 0, n = 0; k < 4000 && n < 130; k++) {
    const x = sr(-HALF + 15, HALF - 15), z = sr(-HALF + 15, HALF - 15);
    if (inTown(x, z, 4)) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.8 || h > 24 || flatEnough(x, z, 1.4, 0.8) === null || !freeSpot(x, z, 1.5)) continue;
    addProp('logs', x, z, Math.floor(srand() * 4) * Math.PI / 2); n++;
  }
  for (let k = 0, n = 0; k < 3000 && n < 90; k++) {
    const x = sr(-HALF + 15, HALF - 15), z = sr(-HALF + 15, HALF - 15);
    if (inTown(x, z, 4) || roadDist(x, z) > 9 || roadDist(x, z) < 3.5) continue;   // lungo le strade
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.5 || !freeSpot(x, z, 0.5)) continue;
    addProp(barrelKinds(), x, z, srand() * 6.28); n++;
  }

  // ── bottino sparso ──
  for (let i = 0; i < 60 * SCALE * SCALE; i++) {
    const x = sr(-HALF + 15, HALF - 15), z = sr(-HALF + 15, HALF - 15);
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.3) continue;
    lootSpots.push(new THREE.Vector3(x, h, z));
  }
  for (let i = 0; i < 14 * SCALE * SCALE; i++) {
    const x = sr(-HALF + 20, HALF - 20), z = sr(-HALF + 20, HALF - 20);
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.3 || inTown(x, z, 5)) continue;
    chestSpots.push({ pos: new THREE.Vector3(x, h, z), rot: srand() * 3 });
  }

  // ── acqua (unica, enorme e leggera) ──
  const waterNormal = makeWaterNormal();
  waterNormal.repeat.set(6000 / 22, 6000 / 22);
  // mappa di profondità dell'acqua (R = profondità/8 m) per colore, trasparenza e schiuma sulla riva
  const depthTex = (() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = -800 + (i + 0.5) / S * 1600, z = -800 + (j + 0.5) / S * 1600;
      const dep = Math.max(0, Math.min(1, (WATER_LEVEL - terrainHeight(x, z)) / 8));
      const k = (j * S + i) * 4;
      d[k] = dep * 255; d[k + 1] = 0; d[k + 2] = 0; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  })();
  const waterMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: depthTex, transparent: true, opacity: 0.86, roughness: 0.14, metalness: 0.2,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.45, 0.45) });
  waterMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <map_fragment>', `
        float wDep = texture2D(map, (vWPos.xz + 800.0) / 1600.0).r;
        float wN = texture2D(normalMap, vNormalMapUv * 2.7).r;
        float wN2 = texture2D(normalMap, vNormalMapUv * 0.9 + 0.4).g;
        vec3 wShallow = vec3(0.05, 0.50, 0.50), wDeep = vec3(0.012, 0.12, 0.33), wOcean = vec3(0.006, 0.055, 0.18);
        vec3 wCol = mix(wShallow, wDeep, smoothstep(0.0, 0.4, wDep));
        wCol = mix(wCol, wOcean, smoothstep(0.45, 1.0, wDep));
        float wFoam = smoothstep(0.55, 1.0, (1.0 - smoothstep(0.0, 0.1, wDep)) * 1.15 + (wN - 0.5) * 0.9 + (wN2 - 0.5) * 0.5);
        diffuseColor.rgb = mix(wCol, vec3(0.92, 0.96, 1.0), wFoam * 0.85);
        diffuseColor.a = clamp(mix(0.5, 0.93, smoothstep(0.0, 0.35, wDep)) + wFoam * 0.4, 0.0, 1.0);`)
      .replace('#include <opaque_fragment>', `
        float wFres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
        outgoingLight = mix(outgoingLight, vec3(0.45, 0.66, 0.88), wFres * 0.4);
        #include <opaque_fragment>`);
  };
  waterMat.customProgramCacheKey = () => 'water-depth';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  scene.add(water);

  // ═════════ generazione grafica per chunk ═════════
  const col = new THREE.Color();
  const DSEG = 40;     // dettaglio: 2,5 m tra i vertici
  const LSEG = 10;     // lontano: 10 m tra i vertici

  function terrainGeo(ch, seg, skirt) {
    const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(ch.x0 + CHUNK / 2, 0, ch.z0 + CHUNK / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const n = seg + 1, hs = new Float32Array(pos.count), step = CHUNK / seg;
    for (let i = 0; i < pos.count; i++) hs[i] = terrainHeight(pos.getX(i), pos.getZ(i));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = hs[i];
      const r = (i / n) | 0, c = i % n;
      // pendenza dalle altezze vicine della griglia (niente campionamenti extra)
      const hl = hs[r * n + Math.max(0, c - 1)], hr = hs[r * n + Math.min(n - 1, c + 1)];
      const hu = hs[Math.max(0, r - 1) * n + c], hd = hs[Math.min(n - 1, r + 1) * n + c];
      const sx = (hr - hl) / (step * ((c > 0 && c < n - 1) ? 2 : 1)), sz = (hd - hu) / (step * ((r > 0 && r < n - 1) ? 2 : 1));
      pos.setY(i, h - skirt);
      groundColor(x, z, h, col, Math.hypot(sx, sz));
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // unisce tanti box colorati in un'unica geometria (per i chunk lontani)
  function mergedBlocks(list) {
    const pos = [], nor = [], colr = [];
    const c = new THREE.Color();
    for (const b of list) {
      const g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
      g.translate(b.x, b.y, b.z);
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      c.set(b.color);
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
        // la faccia superiore usa il colore del tetto
        if (b.top && n[i + 1] > 0.5) { const t = new THREE.Color(b.top); colr.push(t.r, t.g, t.b); } else colr.push(c.r, c.g, c.b);
      }
      g.dispose();
    }
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    return geo;
  }

  function buildLod(ch) {
    const group = new THREE.Group();
    const t = new THREE.Mesh(terrainGeo(ch, LSEG, 0.35), lodMat);
    t.receiveShadow = false;
    group.add(t);
    const blocks = [];
    for (const h of ch.houses) blocks.push({ w: h.w, h: 4.1, d: h.d, x: h.cx, y: h.baseY + 2.05, z: h.cz, color: h.wallColor, top: h.roofColor });
    for (const b of ch.boxes) if (b.lodColor) blocks.push({ w: b.w, h: b.h, d: b.d, x: b.x, y: b.y, z: b.z, color: b.lodColor });
    for (const pr of ch.props) if (pr.type === 'shed') {
      const D = PROP_DIMS.shed, q90 = Math.round(pr.rot / (Math.PI / 2)) % 2 !== 0;
      blocks.push({ w: q90 ? D.d - 0.6 : D.w - 0.6, h: D.h * 0.8, d: q90 ? D.w - 0.6 : D.d - 0.6, x: pr.x, y: pr.y + D.h * 0.4, z: pr.z, color: '#a8763f', top: '#8a3326' });
    }
    // alberi lontani: un cono semplice ogni 3 alberi
    for (let i = 0; i < ch.trees.length; i += 3) {
      const tr = ch.trees[i];
      blocks.push({ w: 2.6 * tr.s, h: 6 * tr.s, d: 2.6 * tr.s, x: tr.x, y: tr.h + 4 * tr.s, z: tr.z, color: tr.pine ? '#2f5f30' : '#457f35' });
    }
    const bg = mergedBlocks(blocks);
    if (bg) group.add(new THREE.Mesh(bg, blockMat));
    scene.add(group);
    ch.lod = group;
  }

  // geometrie condivise per alberi/rocce/erba
  // ── erba: ciuffi di fili sottili (colori per vertice: scuri alla base, chiari in punta) ──
  function makeTuft(blades, seed) {
    const rnd = mulberry32(seed);
    const P = [], C = [], N = [];
    for (let b = 0; b < blades; b++) {
      const a = rnd() * 6.283, r0 = rnd() * 0.16, h = 0.32 + rnd() * 0.42, w = 0.035 + rnd() * 0.025;
      const lean = 0.08 + rnd() * 0.28, la = a + (rnd() - 0.5) * 0.8;
      const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;          // larghezza perpendicolare
      const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;  // inclinazione
      const tone = 0.92 + rnd() * 0.22, dry = rnd() < 0.18 ? 1 : 0;
      const v = [
        [bx - px, 0, bz - pz, 0.42], [bx + px, 0, bz + pz, 0.42],
        [bx + lx * 0.35 + px * 0.6, h * 0.5, bz + lz * 0.35 + pz * 0.6, 0.78], [bx + lx * 0.35 - px * 0.6, h * 0.5, bz + lz * 0.35 - pz * 0.6, 0.78],
        [bx + lx, h, bz + lz, 1.12],
      ];
      for (const tri of [[0, 1, 2], [0, 2, 3], [3, 2, 4]]) for (const k of tri) {
        const [x, y, z, c] = v[k];
        P.push(x, y, z); N.push(0, 1, 0);
        const cc = c * tone;
        C.push(cc * (dry ? 1.18 : 1), cc * (dry ? 1.05 : 1), cc * (dry ? 0.7 : 1));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.computeBoundingSphere();
    g.userData.shared = true;
    return g;
  }
  // fiore: stelo + corolla a croce (colore dall'istanza)
  function makeFlower() {
    const P = [], C = [], N = [];
    const push = (x, y, z, r, gg, b) => { P.push(x, y, z); N.push(0, 1, 0); C.push(r, gg, b); };
    const h = 0.3;
    push(-0.012, 0, 0, 0.35, 0.55, 0.3); push(0.012, 0, 0, 0.35, 0.55, 0.3); push(0, h, 0, 0.45, 0.65, 0.35);
    for (let i = 0; i < 5; i++) {
      const a0 = i / 5 * 6.283, a1 = a0 + 0.9;
      push(0, h, 0, 1, 0.92, 0.5);
      push(Math.cos(a0) * 0.07, h + 0.015, Math.sin(a0) * 0.07, 1, 1, 1);
      push(Math.cos(a1) * 0.07, h + 0.015, Math.sin(a1) * 0.07, 1, 1, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.computeBoundingSphere(); g.userData.shared = true;
    return g;
  }
  const tuftGeo = makeTuft(5, 9001);
  const flowerGeo = makeFlower();
  /** materiale dell'erba: vento a raffiche, si piega attorno al giocatore e sfuma con la distanza */
  function grassMaterial(fade0, fade1, key) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = WIND;
      sh.uniforms.uPlayer = GRASS_PLAYER;
        // i fili sono sottili e a doppia faccia: la normale resta sempre verso l'alto (niente retro scuro)
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'));
    sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform vec3 uPlayer;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float hg = max(transformed.y, 0.0);
            float gust = 0.55 + 0.45 * sin(uWind * 0.6 + ip.x * 0.018 + ip.z * 0.013);
            float ph = uWind * 2.2 + ip.x * 0.23 + ip.z * 0.19;
            float sw = (sin(ph) * 0.6 + sin(ph * 2.7 + 1.3) * 0.25) * gust * hg * hg * 0.55;
            transformed.x += sw; transformed.z += sw * 0.45;
            vec2 away = ip.xz - uPlayer.xz;
            float dp = length(away);
            if (dp < 1.4 && abs(ip.y - uPlayer.y) < 1.5) {
              float push = (1.0 - dp / 1.4) * hg * 0.9;
              vec2 dir = dp > 0.01 ? away / dp : vec2(1.0, 0.0);
              transformed.xz += dir * push;
              transformed.y *= 1.0 - (1.0 - dp / 1.4) * 0.45;
            }
            float dc = distance(ip, cameraPosition);
            transformed *= 1.0 - smoothstep(${fade0.toFixed(1)}, ${fade1.toFixed(1)}, dc);
          }`);
    };
    mat.customProgramCacheKey = () => 'grass-' + key;
    return mat;
  }
  const grassNearMat = grassMaterial(42, 62, 'near');
  const grassFarMat = grassMaterial(140, 190, 'far');
  const flowerMat = grassMaterial(40, 60, 'flower');
  /** dove può crescere l'erba (niente acqua, sabbia, rocce ripide, neve, strade e piazze) */
  function grassOK(x, z, h, slope = 0) {
    if (h < WATER_LEVEL + 1.2 || h > 24 || slope > 0.7) return false;
    if (inTown(x, z, -5)) return false;
    if (roadDist(x, z) < 2.8) return false;
    return true;
  }
  /** true se in (x,z) c'è un box a livello del suolo (pavimenti, casette, casse) */
  function underBox(x, z, h) {
    for (const c of queryColliders(x, z, 0.3)) {
      if (c.type === 'cyl') continue;
      if (c.minY < h + 0.4 && x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2) return true;
    }
    return false;
  }
  // campo d'erba fitta attorno alla telecamera, a celle da 32 m costruite poco per volta
  const GCELL = 32, GR = 64, GDENS = 0.55;
  const TREE_HI = 110;       // alberi dettagliati fin qui, poi la versione semplificata
  const NEAR_ONLY = 150;      // oltre questa distanza i cespugli e l'erba media non si disegnano
  const grassCells = new Map();
  function buildGrassCell(gx, gz) {
    const rnd = mulberry32((gx * 92837111) ^ (gz * 689287499) ^ 0x5bd1e995);
    const x0 = gx * GCELL, z0 = gz * GCELL;
    const NT = Math.round(GCELL * GCELL * GDENS), NF = 70, NP = 16;
    const grp = new THREE.Group();
    const gm = new THREE.InstancedMesh(tuftGeo, grassNearMat, NT);
    const fm = new THREE.InstancedMesh(flowerGeo, flowerMat, NF);
    const pm = new THREE.InstancedMesh(PROPS.pebbles, rockMaterial, NP);
    let n = 0, nf = 0, np = 0;
    const flowerCols = ['#ffffff', '#ffe14d', '#ff7eb6', '#b48cff', '#ff6a4d'];
    const fpatch = patch(x0 + 16, z0 + 16, 0.05, 3.3);      // alcune zone più fiorite
    for (let i = 0; i < NT + NF + NP; i++) {
      const x = x0 + rnd() * GCELL, z = z0 + rnd() * GCELL;
      const r1 = rnd(), r2 = rnd(), r3 = rnd();
      const h = terrainHeight(x, z);
      if (i >= NT + NF) {                                      // sassolini: anche su sabbia e sterrato
        if (h < WATER_LEVEL - 0.3 || h > 30 || inTown(x, z, -5) || underBox(x, z, h)) continue;
        q.setFromAxisAngle(up, r1 * 6.28); const s = 0.7 + r2 * 1.1; sc.set(s, s, s); p.set(x, h - 0.02, z);
        mat4.compose(p, q, sc); pm.setMatrixAt(np++, mat4);
        continue;
      }
      if (!grassOK(x, z, h)) continue;
      const slope = Math.hypot(terrainHeight(x + 1, z) - h, terrainHeight(x, z + 1) - h);
      if (slope > 0.7 || underBox(x, z, h)) continue;
      if (i >= NT) {                                           // fiori
        if (r3 > 0.25 + fpatch * 0.75) continue;
        q.setFromAxisAngle(up, r1 * 6.28); const s = 0.8 + r2 * 0.6; sc.set(s, s * (0.8 + r3 * 0.6), s); p.set(x, h - 0.02, z);
        mat4.compose(p, q, sc); fm.setMatrixAt(nf, mat4);
        fm.setColorAt(nf, col.set(flowerCols[Math.floor(r2 * 997) % flowerCols.length]));
        nf++;
        continue;
      }
      q.setFromAxisAngle(up, r1 * 6.28);
      const s = 0.75 + r2 * 0.65; sc.set(s, s * (0.75 + r3 * 0.6), s); p.set(x, h - 0.03, z);
      mat4.compose(p, q, sc);
      gm.setMatrixAt(n, mat4);
      groundColor(x, z, h, col, slope);
      gm.setColorAt(n, col.multiplyScalar(1.05 + r3 * 0.2));
      n++;
    }
    for (const [im, cnt] of [[gm, n], [fm, nf], [pm, np]]) {
      im.count = cnt;
      if (!cnt) continue;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      grp.add(im);
    }
    scene.add(grp);
    return { grp, ims: [gm, fm, pm] };
  }
  function disposeGrassCell(c) {
    scene.remove(c.grp);
    for (const im of c.ims) im.dispose();
  }
  function updateGrass(camPos, t0, budgetMs) {
    const groundY = terrainHeight(camPos.x, camPos.z);
    const high = camPos.y - groundY > 70;            // dal bus / in caduta l'erba fitta non serve
    // scarica le celle lontane
    for (const [k, c] of grassCells) {
      const cx = (c.gx + 0.5) * GCELL - camPos.x, cz = (c.gz + 0.5) * GCELL - camPos.z;
      if (high || Math.hypot(cx, cz) > GR + GCELL) { disposeGrassCell(c); grassCells.delete(k); }
    }
    if (high) return;
    // costruisce la cella mancante più vicina (al massimo 2 per frame)
    let built = 0;
    while (built < 2) {
      let best = null, bd = 1e9;
      const g0x = Math.floor((camPos.x - GR) / GCELL), g1x = Math.floor((camPos.x + GR) / GCELL);
      const g0z = Math.floor((camPos.z - GR) / GCELL), g1z = Math.floor((camPos.z + GR) / GCELL);
      for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) {
        if (grassCells.has(gx + ',' + gz)) continue;
        const dx = Math.max(gx * GCELL - camPos.x, 0, camPos.x - (gx + 1) * GCELL);
        const dz = Math.max(gz * GCELL - camPos.z, 0, camPos.z - (gz + 1) * GCELL);
        const d = Math.hypot(dx, dz);
        if (d < GR && d < bd) { bd = d; best = [gx, gz]; }
      }
      if (!best) break;
      if (built > 0 && performance.now() - t0 > budgetMs) break;
      const tb = performance.now();
      const c = buildGrassCell(best[0], best[1]);
      stats.grassMs = +(performance.now() - tb).toFixed(2);
      c.gx = best[0]; c.gz = best[1];
      grassCells.set(best[0] + ',' + best[1], c);
      built++;
    }
    stats.grass = grassCells.size;
  }
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), eul = new THREE.Euler();
  const boxGeoCache = new Map();

  function boxGeometry(b) {
    const key = `${b.w.toFixed(2)}|${b.h.toFixed(2)}|${b.d.toFixed(2)}|${b.material.map ? 1 : 0}`;
    let g = boxGeoCache.get(key);
    if (g) return g;
    g = new THREE.BoxGeometry(b.w, b.h, b.d);
    if (b.material.map) {
      const uv = g.attributes.uv, normal = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i));
        const sx = nx > 0.5 ? b.d : b.w, sy = ny > 0.5 ? b.d : b.h;
        uv.setXY(i, uv.getX(i) * sx / 2, uv.getY(i) * sy / 2);
      }
    }
    g.userData.shared = true;
    boxGeoCache.set(key, g);
    return g;
  }

  /** unisce tanti box (stesso materiale) in una sola geometria indicizzata */
  function mergeBoxList(list) {
    let nv = 0, ni = 0;
    const geos = list.map(b => boxGeometry(b));
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    list.forEach((b, k) => {
      const g = geos[k];
      const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, I = g.index.array;
      const n = g.attributes.position.count;
      for (let i = 0; i < n; i++) {
        pos[(vo + i) * 3] = P[i * 3] + b.x; pos[(vo + i) * 3 + 1] = P[i * 3 + 1] + b.y; pos[(vo + i) * 3 + 2] = P[i * 3 + 2] + b.z;
        nor[(vo + i) * 3] = N[i * 3]; nor[(vo + i) * 3 + 1] = N[i * 3 + 1]; nor[(vo + i) * 3 + 2] = N[i * 3 + 2];
        uv[(vo + i) * 2] = U[i * 2]; uv[(vo + i) * 2 + 1] = U[i * 2 + 1];
      }
      for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
      vo += n; io += I.length;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  function instanced(geo, material, items, place) {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(geo, material, items.length);
    items.forEach((it, i) => { place(it, i, im); });
    im.castShadow = true; im.receiveShadow = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    return im;
  }

  function buildDetail(ch) {
    const group = new THREE.Group();
    const terrain = new THREE.Mesh(terrainGeo(ch, DSEG, 0), terrainMat);
    terrain.receiveShadow = true;
    group.add(terrain);
    // box statici uniti per materiale; i tetti restano separati (uno per casa) per poterli nascondere
    const byMat = new Map();
    const roofGroups = new Map();
    for (const b of ch.boxes) {
      if (b.roof && b.house) {
        let rg = roofGroups.get(b.house);
        if (!rg) { rg = new THREE.Group(); roofGroups.set(b.house, rg); group.add(rg); b.house.roofMesh = rg; }
        const mesh = new THREE.Mesh(boxGeometry(b), b.material);
        mesh.position.set(b.x, b.y, b.z);
        mesh.castShadow = b.cast; mesh.receiveShadow = true;
        rg.add(mesh);
        continue;
      }
      const key = b.material.uuid + (b.cast ? 1 : 0);
      let e = byMat.get(key);
      if (!e) { e = { material: b.material, cast: b.cast, list: [] }; byMat.set(key, e); }
      e.list.push(b);
    }
    for (const e of byMat.values()) {
      const mesh = new THREE.Mesh(mergeBoxList(e.list), e.material);
      mesh.castShadow = e.cast; mesh.receiveShadow = true;
      group.add(mesh);
    }
    // alberi: abete, quercia, betulla (modelli low-poly con colori per vertice)
    if (ch.trees.length) {
      const kinds = { pine: [], oak: [], birch: [] };
      for (const t of ch.trees) kinds[t.pine ? 'pine' : (t.rot > 4.4 ? 'birch' : 'oak')].push(t);
      ch.treeHi = []; ch.treeLo = [];
      for (const [k, list] of Object.entries(kinds)) {
        for (const low of [false, true]) {
          const im = instanced(PROPS[low ? k + 'Low' : k], treeMaterial, list, (t, i, im) => {
            q.setFromAxisAngle(up, t.rot); sc.set(t.s, t.s * (0.92 + (t.light - 0.28) * 1.2), t.s); p.set(t.x, t.h - 0.15, t.z);
            mat4.compose(p, q, sc);
            im.setMatrixAt(i, mat4);
            const v = 0.86 + (t.light - 0.28) * 1.1, hs = (t.hue - 0.28) * 2.2;
            im.setColorAt(i, col.setRGB(v * (1 + hs * 0.6), v, v * (1 - hs * 0.4)));
          });
          if (!im) continue;
          if (low) { im.castShadow = false; im.visible = false; }
          group.add(im);
          (low ? ch.treeLo : ch.treeHi).push(im);
        }
      }
    }
    // rocce (5 forme): sono statiche, quindi vengono unite in un'unica geometria per chunk (1 draw call)
    if (ch.rocks.length) {
      const nm = new THREE.Matrix3();
      let total = 0;
      for (const r of ch.rocks) total += PROPS.rocks[(r.shape ?? 0) % PROPS.rocks.length].attributes.position.count;
      const P = new Float32Array(total * 3), Nn = new Float32Array(total * 3), C = new Float32Array(total * 3);
      let o = 0;
      const v = new THREE.Vector3();
      for (const r of ch.rocks) {
        const g = PROPS.rocks[(r.shape ?? 0) % PROPS.rocks.length];
        q.setFromEuler(eul.set(r.e[0] * 0.3, r.e[1], r.e[2] * 0.3));
        sc.set(r.s * r.k[0], r.s * r.k[1], r.s * r.k[2]);
        p.set(r.x, r.h + r.s * 0.15, r.z);
        mat4.compose(p, q, sc);
        nm.getNormalMatrix(mat4);
        const gp = g.attributes.position, gn = g.attributes.normal, gc = g.attributes.color;
        for (let i = 0; i < gp.count; i++, o++) {
          v.fromBufferAttribute(gp, i).applyMatrix4(mat4); P[o * 3] = v.x; P[o * 3 + 1] = v.y; P[o * 3 + 2] = v.z;
          v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize(); Nn[o * 3] = v.x; Nn[o * 3 + 1] = v.y; Nn[o * 3 + 2] = v.z;
          C[o * 3] = gc.getX(i); C[o * 3 + 1] = gc.getY(i); C[o * 3 + 2] = gc.getZ(i);
        }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(P, 3));
      rg.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
      rg.setAttribute('color', new THREE.BufferAttribute(C, 3));
      rg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(total * 2), 2));
      rg.computeBoundingSphere();
      const rm = new THREE.Mesh(rg, rockMaterial);
      rm.castShadow = rm.receiveShadow = true;
      group.add(rm);
    }
    // oggetti di scena
    if (ch.props.length) {
      const byType = new Map();
      for (const pr of ch.props) {
        if (pr.dead) continue;
        if (!byType.has(pr.type)) byType.set(pr.type, []);
        byType.get(pr.type).push(pr);
      }
      for (const [type, list] of byType) {
        const matl = type === 'barrelBlue' || type === 'barrelRed' ? metalPropMaterial : propMaterial;
        const im = instanced(PROPS[type], matl, list, (pr, i, im) => {
          q.setFromAxisAngle(up, pr.rot); sc.set(1, 1, 1); p.set(pr.x, pr.y, pr.z);
          mat4.compose(p, q, sc);
          im.setMatrixAt(i, mat4);
          pr.im = im; pr.ii = i;
        });
        if (im) group.add(im);
      }
    }
    // cespugli (4 varianti, due con fiori) ed erba media: visibili solo nei chunk vicini
    ch.nearOnly = [];
    if (ch.bushes.length) {
      const lists = PROPS.bushes.map(() => []);
      for (const b of ch.bushes) lists[b.v].push(b);
      lists.forEach((list, k) => {
        const im = instanced(PROPS.bushes[k], bushMaterial, list, (b, i, im) => {
          q.setFromAxisAngle(up, b.rot); sc.set(b.s, b.s * 0.9, b.s); p.set(b.x, b.h - 0.1, b.z);
          mat4.compose(p, q, sc);
          im.setMatrixAt(i, mat4);
          groundColor(b.x, b.z, b.h, col, 0.2);
          const v = 0.85 + (col.g - 0.45) * 0.6;
          im.setColorAt(i, col.setRGB(v * (col.r > 0.45 ? 1.08 : 1), v, v * 0.95));
        });
        if (im) { im.castShadow = false; group.add(im); ch.nearOnly.push(im); }
      });
    }
    // ciuffi d'erba radi per la media distanza (quelli fitti li gestisce grassField)
    {
      const rnd = mulberry32((ch.cx * 73856093) ^ (ch.cz * 19349663));
      const N = 150, gm = new THREE.InstancedMesh(tuftGeo, grassFarMat, N);
      let n = 0;
      for (let i = 0; i < N; i++) {
        const x = ch.x0 + rnd() * CHUNK, z = ch.z0 + rnd() * CHUNK;
        const h = terrainHeight(x, z);
        if (!grassOK(x, z, h)) continue;
        q.setFromAxisAngle(up, rnd() * 6.28);
        const s = 1.1 + rnd() * 0.7; sc.set(s, s * (0.9 + rnd() * 0.4), s); p.set(x, h - 0.03, z);
        mat4.compose(p, q, sc);
        gm.setMatrixAt(n, mat4);
        groundColor(x, z, h, col, 0.1);
        gm.setColorAt(n, col.multiplyScalar(1.12));
        n++;
      }
      gm.count = n; gm.receiveShadow = true;
      if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
      gm.computeBoundingSphere();
      group.add(gm); ch.nearOnly.push(gm);
    }
    // oggetti speciali
    for (const s of ch.specials) {
      if (s.type === 'fountain') {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 1, 20), m('stone', '#b8b4a8'));
        f.position.set(s.x, s.h + 0.5, s.z); f.castShadow = f.receiveShadow = true; group.add(f);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 20), m('fwater', '#4aa8e0', { metalness: 0.3, roughness: 0.1 }));
        w.position.set(s.x, s.h + 0.95, s.z); group.add(w);
        const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 10), m('stone', '#b8b4a8'));
        pp.position.set(s.x, s.h + 2, s.z); pp.castShadow = true; group.add(pp);
      }
    }
    scene.add(group);
    ch.detail = group;
  }

  function disposeGroup(g) {
    scene.remove(g);
    g.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  }
  function unloadDetail(ch) {
    if (!ch.detail) return;
    disposeGroup(ch.detail);
    ch.detail = null;
    for (const b of ch.boxes) b.mesh = null;
    for (const h of ch.houses) h.roofMesh = null;
    for (const pr of ch.props) { pr.im = null; }
  }

  // ── barili esplosivi ──
  const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function destroyBarrel(pr) {
    if (pr.dead) return;
    pr.dead = true;
    removeCollider(pr.c);
    if (pr.im) { pr.im.setMatrixAt(pr.ii, _zero); pr.im.instanceMatrix.needsUpdate = true; }
  }
  /** a inizio partita rimette a posto i barili esplosi */
  function resetProps() {
    for (const pr of barrels) {
      if (pr.explosive) pr.hp = pr.maxHp;
      if (!pr.dead) continue;
      pr.dead = false;
      addCollider(pr.c);
      const ch = chunkAt(pr.x, pr.z);
      if (ch && ch.detail) unloadDetail(ch);
    }
    lastKey = '';
  }

  // ── streaming: costruisce i chunk vicini un po' per frame ──
  const DETAIL_IN = 240, DETAIL_OUT = 310;   // raggio di caricamento / scaricamento del dettaglio
  const stats = { detail: 0, lod: 0, built: 0 };
  let lastKey = '';
  let order = [];
  const chunkList = [...chunks.values()];

  function update(camPos, budgetMs = 6) {
    { const t = performance.now() * 0.001; waterNormal.offset.set(t * 0.012, t * 0.007); WIND.value = t % 1800; }
    const t0 = performance.now();
    const ccx = Math.floor(camPos.x / 25), ccz = Math.floor(camPos.z / 25);
    const key = ccx + ',' + ccz;
    if (key !== lastKey) {
      lastKey = key;
      for (const ch of chunkList) {
        const dx = Math.max(ch.x0 - camPos.x, 0, camPos.x - (ch.x0 + CHUNK));
        const dz = Math.max(ch.z0 - camPos.z, 0, camPos.z - (ch.z0 + CHUNK));
        ch.dist = Math.hypot(dx, dz);
      }
      order = chunkList.slice().sort((a, b) => a.dist - b.dist);
      // scarica il dettaglio dei chunk lontani
      for (const ch of chunkList) if (ch.detail && ch.dist > DETAIL_OUT) unloadDetail(ch);
    }
    // priorità: dettaglio vicino → orizzonte lontano
    let work = 0;
    for (const ch of order) {
      if (performance.now() - t0 > budgetMs && work > 0) break;
      if (ch.dist <= DETAIL_IN && !ch.detail) { buildDetail(ch); stats.built++; work++; continue; }
      if (!ch.lod && ch.dist < 1400) { buildLod(ch); work++; }
    }
    // il terreno lontano si nasconde dove c'è quello dettagliato
    let nd = 0, nl = 0;
    for (const ch of chunkList) {
      if (ch.lod) { ch.lod.visible = !ch.detail; nl++; }
      if (ch.detail) {
        nd++;
        const dx = Math.max(ch.x0 - camPos.x, 0, camPos.x - (ch.x0 + CHUNK)), dz = Math.max(ch.z0 - camPos.z, 0, camPos.z - (ch.z0 + CHUNK));
        const near = Math.hypot(dx, dz) < NEAR_ONLY;
        if (ch.nearOnly) for (const im of ch.nearOnly) im.visible = near;
        const dTree = Math.hypot(dx, dz) < TREE_HI;
        if (ch.treeHi) { for (const im of ch.treeHi) im.visible = dTree; for (const im of ch.treeLo) im.visible = !dTree; }
      }
    }
    stats.detail = nd; stats.lod = nl;
    updateGrass(camPos, t0, budgetMs + 2);
    return work;
  }
  /** costruisce subito tutto ciò che serve attorno a un punto (es. prima di atterrare) */
  function prewarm(pos, radius = 120) {
    for (const ch of chunkList) {
      const dx = Math.max(ch.x0 - pos.x, 0, pos.x - (ch.x0 + CHUNK));
      const dz = Math.max(ch.z0 - pos.z, 0, pos.z - (ch.z0 + CHUNK));
      if (Math.hypot(dx, dz) <= radius && !ch.detail) buildDetail(ch);
    }
    lastKey = '';
  }

  // ── minimappa pre-renderizzata ──
  const MM = 600;
  const mm = document.createElement('canvas');
  mm.width = mm.height = MM;
  const g = mm.getContext('2d');
  const img = g.createImageData(MM, MM);
  for (let py = 0; py < MM; py++) for (let px = 0; px < MM; px++) {
    const x = (px / MM) * HALF * 2 - HALF, z = (py / MM) * HALF * 2 - HALF;
    const h = terrainHeight(x, z);
    let r, gg, b;
    if (h < WATER_LEVEL) { r = 40; gg = 120; b = 190; }
    else if (h < WATER_LEVEL + 1) { r = 210; gg = 195; b = 140; }
    else if (h > 24) { const k = Math.min(1, (h - 24) / 10); r = 130 + 110 * k; gg = 125 + 115 * k; b = 115 + 125 * k; }
    else { const s = Math.max(0, Math.min(1, (h + 4) / 22)); r = 70 + 40 * s; gg = 130 + 40 * s; b = 55 + 20 * s; }
    const i = (py * MM + px) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const k = MM / (HALF * 2);
  // strade disegnate come linee (molto più veloce che calcolarle per pixel)
  g.strokeStyle = 'rgb(170,145,100)'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (const [a, b] of roads) { g.beginPath(); g.moveTo((a.x + HALF) * k, (a.z + HALF) * k); g.lineTo((b.x + HALF) * k, (b.z + HALF) * k); g.stroke(); }
  g.fillStyle = 'rgba(30,80,30,0.5)';
  for (const t of trees) g.fillRect((t.x + HALF) * k - 0.75, (t.z + HALF) * k - 0.75, 1.5, 1.5);
  g.fillStyle = 'rgba(60,40,30,0.9)';
  for (const h of houses) g.fillRect((h.cx - h.w / 2 + HALF) * k, (h.cz - h.d / 2 + HALF) * k, Math.max(2, h.w * k), Math.max(2, h.d * k));

  // casette e cataste sulla minimappa
  for (const ch of chunks.values()) for (const pr of ch.props) {
    if (pr.type === 'shed') { g.fillStyle = 'rgba(120,70,40,0.95)'; g.fillRect((pr.x + HALF) * k - 1.5, (pr.z + HALF) * k - 1.5, 3, 3); }
  }

  return { lootSpots, chestSpots, houses, barrels, minimap: mm, crateMat, woodTex, update, prewarm, stats, chunks, destroyBarrel, resetProps };
}
