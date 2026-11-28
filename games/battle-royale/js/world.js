// Mondo di gioco: terreno, città, alberi, collisioni e raycast
// La parte "logica" (collisioni, posizioni di case/alberi/bottino) è calcolata all'avvio perché
// serve ai bot in tutta l'isola; la parte grafica è generata a CHUNK attorno alla telecamera,
// un pezzo per volta, e liberata quando ci si allontana.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d, addGrain, normalFromHeight, colorTex, NORMALS, TEXQ, hasPhoto, paintPhoto, photoTexture, photoMeanLinear } from './texgen.js?v=51';
import { planTown, streetAt, onStreet, buildCity, CITY_SPECIALS, STREET } from './city.js?v=51';
import { carInstances } from './cars.js?v=51';
import { monumentMaterial, churchGeo, churchColliders, buildArena, ARENA } from './monuments.js?v=51';
import { makeNoise, fbm, ridged } from './noise.js?v=51';
import { mergeParts, TREE_KINDS, PROPS, PROP_DIMS, SHED, MODEL_SOURCE, propMaterial, metalPropMaterial, logMaterial, treeMaterial, bushMaterial, rockMaterial, WIND, LEAVES, leafMaterial, bushLeafMaterial, TREE_MATS, shedMaterial, civicMaterial } from './props.js?v=51';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

/** posizione del giocatore: l'erba vicina si piega al suo passaggio */
export const GRASS_PLAYER = { value: new THREE.Vector3(0, -9999, 0) };

export const SCALE = 3;               // la mappa è 3 volte più grande della versione originale
export const HALF = 200 * SCALE;      // la mappa va da -600 a +600
export const WATER_LEVEL = -2.6;
export const CHUNK = 100;             // lato di un chunk (m)
/** qualità grafica regolabile dalle impostazioni (distanze di dettaglio, erba) */
export const GRASS_FADE = { value: 1 };
export const QUALITY = { detailIn: 240, detailOut: 310, grassR: 64, grassDens: 0.8, treeHi: 110, nearOnly: 150, doorNear: 110, hwNear: 28, grassOn: true, version: 0 };
const EDGE = HALF + 60;               // il terreno continua un po' nel mare

const DEFAULT_TOWNS = [
  // v24: città più grandi (reticolo di strade, palazzi, negozi)
  // v38: al centro della mappa c'è l'arena (Colosseo), al posto della città più grande
  { name: 'Colosseo Caos', x: 0, z: 0, r: 70, houses: 0, arena: true },
  { name: 'Piazza Pulita', x: -315, z: -285, r: 54, houses: 7 },
  { name: 'Torri Tremanti', x: 300, z: -315, r: 50, houses: 4, towers: true },
  { name: 'Borgo Bottino', x: -330, z: 285, r: 54, houses: 7 },
  { name: 'Villa Vertigine', x: 336, z: 276, r: 50, houses: 5 },
  { name: 'Porto Pigro', x: -430, z: 0, r: 50, houses: 3, containers: true },
  { name: 'Fattoria Felice', x: 120, z: 390, r: 46, houses: 3 },
  { name: 'Deposito Dannato', x: 90, z: -430, r: 50, houses: 2, containers: true },
  { name: 'Lido Lampo', x: 466, z: -20, r: 48, houses: 5 },
  { name: 'Castello Cosmico', x: -130, z: -175, r: 52, houses: 6, towers: true },
  { name: 'Miniera Matta', x: -440, z: -420, r: 48, houses: 3, containers: true },
  { name: 'Bosco Brivido', x: -200, z: 430, r: 46, houses: 4, k: 1.08 },
  { name: 'Faro Folle', x: 456, z: 456, r: 46, houses: 3, towers: true },
  { name: 'Campeggio Caos', x: 190, z: 170, r: 50, houses: 4 },
  { name: 'Valle Vortice', x: -470, z: 190, r: 48, houses: 3 },
  { name: 'Stazione Strana', x: 230, z: -170, r: 50, houses: 5, containers: true },
  { name: 'Paese Pazzo', x: -10, z: 250, r: 54, houses: 6 },
  { name: 'Rocca Ribelle', x: -20, z: -290, r: 50, houses: 4 },
];
/** v41: le case sono più grandi: anche i paesi si allargano (il Colosseo resta com'è) */
const TOWN_K = 1.2;
/** città della mappa corrente (l'array resta lo stesso: viene riempito di nuovo a ogni mappa) */
export const TOWNS = DEFAULT_TOWNS.map(t => ({ ...t, r: t.arena ? t.r : Math.round(t.r * (t.k || TOWN_K)) }));
/** mappa corrente: seme e tipo (classica o casuale) */
export const MAP = { seed: 1337, random: false };

// ── generatore pseudo-casuale con seme (mappa sempre uguale) ──
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let srand = mulberry32(1337);
const sr = (a, b) => a + srand() * (b - a);

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const P1 = ['Borgo', 'Villa', 'Porto', 'Monte', 'Valle', 'Bosco', 'Rocca', 'Lago', 'Piana', 'Forte', 'Colle', 'Riva', 'Torre', 'Campo', 'Baia', 'Poggio', 'Pieve', 'Cava'];
const P2 = ['Pazzo', 'Perduto', 'Ruggente', 'Nebbioso', 'Dorato', 'Selvaggio', 'Tranquillo', 'Ventoso', 'Fiorito', 'Stregato', 'Felice', 'Lucente', 'Brontolone', 'Segreto', 'Gelato', 'Rovente', 'Spettrale', 'Sonnolento', 'Lampo', 'Bizzarro'];
// ─────────────── Biomi ───────────────
// pesi per punto: [prateria, neve, deserto, autunno, tropicale]
export const BIOME_IDS = ['meadow', 'snow', 'desert', 'autumn', 'tropic'];
export const BIOME_NAMES = { meadow: 'Prateria', snow: 'Montagne innevate', desert: 'Deserto', autumn: "Bosco d'autunno", tropic: 'Costa tropicale' };
const BI = { meadow: 0, snow: 1, desert: 2, autumn: 3, tropic: 4 };
const DEFAULT_BIOMES = [
  { b: 'snow', x: -350, z: -320, r: 300 },
  { b: 'desert', x: 340, z: 340, r: 270 },
  { b: 'autumn', x: 330, z: -320, r: 250 },
  { b: 'tropic', x: -380, z: 340, r: 240 },
];
const BIOME_CENTERS = DEFAULT_BIOMES.map(b => ({ ...b }));

const DEFAULT_MOUNTAINS = [
  { x: -390, z: -170, r: 175, h: 95 },    // massiccio innevato
  { x: -200, z: -470, r: 120, h: 62 },
  { x: 380, z: 90, r: 120, h: 52 },
  { x: -110, z: 470, r: 95, h: 38 },
  { x: 150, z: -300, r: 90, h: 40 },
  { x: 440, z: -190, r: 85, h: 42 },
];
const DEFAULT_LAKES = [
  { x: -150, z: 110, r: 90, d: 10 },
  { x: 300, z: -60, r: 50, d: 9 },
  { x: -300, z: 420, r: 45, d: 9 },
];
const MOUNTAINS = DEFAULT_MOUNTAINS.map(m => ({ ...m }));
const LAKES = DEFAULT_LAKES.map(l => ({ ...l }));
/** fiumi: polilinee che scavano canyon fino al mare */
export const RIVERS = [];

const TP = { lift: 0 };
// rumori della mappa corrente (cambiano con il seme)
let NZ = null;
function makeNoises(seed) {
  NZ = {
    a: makeNoise(seed ^ 0x1a2b), b: makeNoise(seed ^ 0x3c4d), c: makeNoise(seed ^ 0x5e6f),
    ridge: makeNoise(seed ^ 0x7788), shape: makeNoise(seed ^ 0x99aa), coast: makeNoise(seed ^ 0xbbcc),
    coast2: makeNoise(seed ^ 0xddee), isl: makeNoise(seed ^ 0x1357), mesa: makeNoise(seed ^ 0x2468),
    dune: makeNoise(seed ^ 0x3579), warp: makeNoise(seed ^ 0x4680), lake: makeNoise(seed ^ 0x5791),
  };
}

function riverDist(x, z) {
  let best = Infinity, w = 0;
  for (const rv of RIVERS) {
    if (x < rv.minX || x > rv.maxX || z < rv.minZ || z > rv.maxZ) continue;
    const P = rv.pts;
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1];
      const vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
      if (d < best) { best = d; w = rv.w; }
    }
  }
  return [best, w];
}

/** pesi dei biomi calcolati (lento: serve solo a riempire la griglia) */
function biomeRaw(x, z, out) {
  out.fill(0);
  const wx = fbm(NZ.warp, x * 0.004, z * 0.004, 3) * 85, wz = fbm(NZ.warp, z * 0.004 + 7.7, x * 0.004 - 3.1, 3) * 85;
  let sum = 0;
  for (const c of BIOME_CENTERS) {
    const d = Math.hypot(x + wx - c.x, z + wz - c.z);
    const w = smoothstep(c.r, c.r * 0.55, d);
    out[BI[c.b]] += w; sum += w;
  }
  if (sum > 1) for (let i = 1; i < 5; i++) out[i] /= sum;
  out[0] = Math.max(0, 1 - Math.min(1, sum));
  return out;
}

// griglia dei biomi (8 m) e dell'altezza (2,5 m, allineata ai vertici dei chunk)
const BSTEP = 8, BN = 177, BOFF = 704;
const BGRID = new Float32Array(BN * BN * 5);
const HSTEP = 2.5, HN = 561, HOFF = 700;
const HF = new Float32Array(HN * HN);
const _bw = new Float32Array(5), _bo = new Float32Array(5);

/** pesi dei biomi in (x,z) (interpolati; l'array restituito è condiviso) */
export function biomeAt(x, z, out = _bo) {
  const fx = Math.min(BN - 1.001, Math.max(0, (x + BOFF) / BSTEP)), fz = Math.min(BN - 1.001, Math.max(0, (z + BOFF) / BSTEP));
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
  const i00 = (iz * BN + ix) * 5, i10 = i00 + 5, i01 = i00 + BN * 5, i11 = i01 + 5;
  for (let k = 0; k < 5; k++) {
    out[k] = (BGRID[i00 + k] * (1 - tx) + BGRID[i10 + k] * tx) * (1 - tz) + (BGRID[i01 + k] * (1 - tx) + BGRID[i11 + k] * tx) * tz;
  }
  return out;
}
/** biomi con il peso maggiore in (x,z) */
export function biomeName(x, z) {
  const b = biomeAt(x, z);
  let best = 0;
  for (let k = 1; k < 5; k++) if (b[k] > b[best]) best = k;
  return BIOME_IDS[best];
}

/** altezza "naturale" (colline, biomi, montagne, laghi, fiumi), senza città né costa */
function rawHeight(x, z, bw) {
  const N = NZ;
  let h = 9 * fbm(N.a, x * 0.0028, z * 0.0028, 4) + 2.4 * fbm(N.b, x * 0.011, z * 0.011, 3) + 0.45 * N.c(x * 0.06, z * 0.06) + 3.6 + TP.lift;
  // le città stanno in conche più tranquille
  let calm = 1;
  for (const t of TOWNS) {
    const dx = x - t.x, dz = z - t.z, R = t.r + 120;
    if (dx > R || dx < -R || dz > R || dz < -R) continue;
    calm = Math.min(calm, smoothstep(t.r + 25, t.r + 115, Math.hypot(dx, dz)));
  }
  const wS = bw[1], wD = bw[2], wA = bw[3], wT = bw[4];
  if (wA > 0) h += wA * 4.5 * (fbm(N.c, x * 0.006, z * 0.006, 3) + 0.6) * calm;
  if (wT > 0) h = h + (h * 0.55 + 0.6 - h) * wT;
  if (wS > 0) h += wS * 7 * calm;
  if (wD > 0) {
    // dune e mese a gradoni (canyon nel deserto)
    // v36: dune più alte e dalla cresta affilata (si spianano vicino alle città)
    const dr = 1 - Math.abs(N.dune(x * 0.013 + 0.35 * N.warp(x * 0.004, z * 0.004), z * 0.0058));
    const dune = (1.7 + 3.4 * calm) * dr * dr * (3 - 2 * dr) * 1.15;
    const mm = fbm(N.mesa, x * 0.0052, z * 0.0052, 3);
    const mesa = (smoothstep(0.16, 0.22, mm) * 13 + smoothstep(0.38, 0.43, mm) * 9) * calm;
    h = h + ((h * 0.45 + 2.2 + dune + mesa) - h) * wD;
  }
  for (const m of MOUNTAINS) {
    const dx = x - m.x, dz = z - m.z;
    if (dx > m.r * 1.4 || dx < -m.r * 1.4 || dz > m.r * 1.4 || dz < -m.r * 1.4) continue;
    const d = Math.hypot(dx, dz) * (1 + 0.3 * N.shape(x * 0.0045 + m.x * 0.01, z * 0.0045));
    if (d >= m.r) continue;
    const k = 1 - d / m.r, shape = k * k * (3 - 2 * k);
    const rid = ridged(N.ridge, x * 0.0046, z * 0.0046, 4);
    h += m.h * (shape * (0.58 + 0.42 * rid) + 0.22 * shape * shape * (rid - 0.45)) * (0.25 + 0.75 * calm);
  }
  for (const l of LAKES) {
    const dx = x - l.x, dz = z - l.z;
    if (dx > l.r * 1.3 || dx < -l.r * 1.3 || dz > l.r * 1.3 || dz < -l.r * 1.3) continue;
    const d = Math.hypot(dx, dz) * (1 + 0.22 * N.lake(x * 0.012, z * 0.012));
    if (d < l.r) h -= l.d * (1 - smoothstep(0, l.r, d));
  }
  if (RIVERS.length) {
    const [rd, rw] = riverDist(x, z);
    const bank = 9 + Math.max(0, h) * (wD > 0.5 ? 0.05 : 0.16);
    if (rd < rw + bank) {
      const bed = WATER_LEVEL - 2.6 - 1.2 * smoothstep(rw, 0, rd);
      const k = 1 - smoothstep(rw * 0.6, rw + bank, rd);
      h = h + (Math.min(h, bed) - h) * k;
    }
  }
  return h;
}
function baseHeight(x, z) { return rawHeight(x, z, biomeRaw(x, z, _bw)); }

/** costa irregolare: baie, penisole e isolotti */
function coastMask(x, z) {
  const ex = Math.abs(x) / HALF, ez = Math.abs(z) / HALF;
  let e = Math.pow(ex ** 8 + ez ** 8, 1 / 8);
  e += 0.12 * fbm(NZ.coast, x * 0.003, z * 0.003, 4) + 0.018 * NZ.coast2(x * 0.011, z * 0.011);
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.r + 110) e -= 0.13 * (1 - smoothstep(t.r + 20, t.r + 110, d));
  }
  return e;
}

function buildBiomeGrid() {
  for (let j = 0; j < BN; j++) for (let i = 0; i < BN; i++) {
    biomeRaw(i * BSTEP - BOFF, j * BSTEP - BOFF, _bw);
    BGRID.set(_bw, (j * BN + i) * 5);
  }
}
/** le strade restano percorribili: tagliano le colline e scavalcano i fiumi su un argine */
function roadCarve(x, z, h, segs = roads) {
  let best = 1e9, lin = 0;
  for (const [a, b] of segs) {
    const vx = b.x - a.x, vz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
    if (d < best) { best = d; lin = a.h + (b.h - a.h) * t; }
  }
  if (best > 10) return h;
  const k = (1 - smoothstep(3.5, 10, best)) * smoothstep(15, 5, Math.abs(h - lin));
  return h + (Math.max(lin, WATER_LEVEL + 1.2) - h) * k;
}
function buildHeightGrid() { for (let j = 0; j < HN; j++) heightRow(j); }
/** v48: una riga della griglia delle altezze (così il calcolo si può spezzare e fare mentre si scaricano i file) */
function heightRow(j) {
  {
    const z = j * HSTEP - HOFF;
    // v48: solo le strade a meno di 10 m da questa riga possono scavare il terreno (risultato identico, molti meno conti)
    const rowRoads = roads.filter(([a, b]) => z >= Math.min(a.z, b.z) - 11 && z <= Math.max(a.z, b.z) + 11);
    const coastFar = Math.abs(z) < HALF * 0.6;   // la costa (e > 0.82) non può arrivare a meno di 0,6·HALF dal centro
    for (let i = 0; i < HN; i++) {
      const x = i * HSTEP - HOFF;
      let h = rawHeight(x, z, biomeAt(x, z, _bw));
      if (rowRoads.length) h = roadCarve(x, z, h, rowRoads);
      let inT = false;
      for (const t of TOWNS) {
        const dx = x - t.x, dz = z - t.z, R = t.r + 24;
        if (dx > R || dx < -R || dz > R || dz < -R) continue;
        const d = Math.hypot(dx, dz);
        if (d < R) h = h + (t.h - h) * (1 - smoothstep(t.r + 5, R, d));   // v24: piano fino a r+5 (lotti esterni)
        if (d < t.r + 6) inT = true;
      }
      const e = (coastFar && Math.abs(x) < HALF * 0.6) ? 0 : coastMask(x, z);
      if (e > 0.82 && !inT) {
        h = h + (-12 - h) * smoothstep(0.82, 0.97, e);
        const isl = fbm(NZ.isl, x * 0.009, z * 0.009, 3);
        if (isl > 0.3 && e < 1.2) h = Math.max(h, WATER_LEVEL - 2 + Math.min(8, (isl - 0.3) * 60) * smoothstep(1.2, 1.05, e));
      }
      HF[j * HN + i] = h;
    }
  }
}

let fieldsReady = false;
let pendingSteps = null;   // v48: preparazione a passi ancora in corso (prewarmMap)
function ensureFields() {
  if (fieldsReady) return;
  fieldsReady = true;
  const steps = pendingSteps || fieldsSteps();   // se prewarmMap non ha finito, si completa qui di fila
  pendingSteps = null;
  for (const _ of steps) { /* tutto di fila */ }
}
/** v48: biomi, strade, fiumi, altezze e temi a passi (yield = punto in cui si può lasciare respirare il browser) */
function* fieldsSteps() {
  makeNoises(MAP.seed);
  buildBiomeGrid();
  yield 'biomi';
  for (const t of TOWNS) t.h = Math.max(1.2, rawHeight(t.x, t.z, biomeAt(t.x, t.z, _bw)) + 0.5);
  roads.length = 0; buildRoads();
  yield 'strade';
  makeRivers(mulberry32(MAP.seed ^ 0x5eed), MAP.random ? 1 + (MAP.seed % 3) : 2);
  yield 'fiumi';
  for (let j = 0; j < HN; j++) { heightRow(j); if ((j & 3) === 3) yield (j % 112 === 111 ? 'altezze ' + Math.round(j / HN * 100) + '%' : null); }
  assignThemes(mulberry32(MAP.seed ^ 0x7e3a), MAP.random);
  for (const t of TOWNS) { if (t.arena) { t.theme = 'arena'; t.plan = null; continue; } planTown(t); t.church = null; }
  // v38: la chiesa barocca affaccia sulla piazza della città a reticolo più vicina al centro
  let best = null;
  for (const t of TOWNS) if (!t.arena && t.plan.layout === 'grid' && t.plan.hp >= 12 && /classic|castle|port|industrial/.test(t.theme) && (!best || Math.hypot(t.x, t.z) < Math.hypot(best.x, best.z))) best = t;
  if (best) best.church = { x: best.x - 4, z: best.z - best.plan.hp + 10.4 };
}

/** altezza del terreno (griglia precalcolata da 2,5 m, interpolazione bilineare) */
export function terrainHeight(x, z) {
  if (!fieldsReady) ensureFields();
  let fx = (x + HOFF) / HSTEP, fz = (z + HOFF) / HSTEP;
  if (fx < 0) fx = 0; else if (fx > HN - 1.0001) fx = HN - 1.0001;
  if (fz < 0) fz = 0; else if (fz > HN - 1.0001) fz = HN - 1.0001;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * HN + ix;
  const a = HF[i], b = HF[i + 1], c = HF[i + HN], d = HF[i + HN + 1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/** fiumi: dalle zone interne verso il mare, evitando le città */
function makeRivers(r, count) {
  RIVERS.length = 0;
  for (let n = 0, att = 0; n < count && att < 60; att++) {
    const a0 = r() * Math.PI * 2, d0 = 110 + r() * 200;
    let x = Math.cos(a0) * d0, z = Math.sin(a0) * d0;
    if (TOWNS.some(t => Math.hypot(t.x - x, t.z - z) < t.r + 60)) continue;
    if (RIVERS.some(rv => rv.pts.some(p => Math.hypot(p[0] - x, p[1] - z) < 160))) continue;
    let dir = Math.atan2(z, x) + (r() - 0.5) * 1.2;
    const pts = [[x, z]];
    let ok = false;
    for (let s = 0; s < 70; s++) {
      let placed = false;
      for (let tr = 0; tr < 9 && !placed; tr++) {
        const nd = dir + (r() - 0.5) * 0.55 + (tr ? (tr % 2 ? 1 : -1) * Math.ceil(tr / 2) * 0.38 : 0);
        const nx = x + Math.cos(nd) * 26, nz = z + Math.sin(nd) * 26;
        if (TOWNS.some(t => Math.hypot(t.x - nx, t.z - nz) < t.r + 42)) continue;
        // si allontana dal centro (verso il mare)
        if (Math.hypot(nx, nz) < Math.hypot(x, z) - 8) continue;
        x = nx; z = nz; dir = nd * 0.8 + Math.atan2(z, x) * 0.2; placed = true;
      }
      if (!placed) break;
      pts.push([x, z]);
      if (Math.max(Math.abs(x), Math.abs(z)) > HALF + 50) { ok = true; break; }
    }
    if (!ok || pts.length < 6) continue;
    const w = 6 + r() * 3;
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), pad = w + 40;
    LAKES.push({ x: pts[0][0], z: pts[0][1], r: 26 + r() * 10, d: 7 });
    RIVERS.push({ pts, w, minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad, minZ: Math.min(...zs) - pad, maxZ: Math.max(...zs) + pad });
    n++;
  }
}

// ─────────────── Città tematiche ───────────────
const THEME_NAMES = {
  alpine: [['Baita', 'Malga', 'Rifugio', 'Passo', 'Vetta', 'Slitta'], ['Gelata', 'Nevosa', 'Bianca', 'Ghiacciata', 'Polare', 'Brinata']],
  western: [['Saloon', 'Ranch', 'Canyon', 'Miniera', 'Forte', 'Oasi'], ['Rovente', 'Polverosa', 'Sabbiosa', 'Arida', 'Dorata', 'Selvaggia']],
  coastal: [['Laguna', 'Baia', 'Porto', 'Lido', 'Spiaggia', 'Scogliera'], ['Tropicale', 'Azzurra', 'Smeraldo', 'Soleggiata', 'Corallina', 'Salata']],
  farm: [['Fattoria', 'Mulino', 'Cascina', 'Vigna', 'Granaio', 'Frutteto'], ['Dorata', 'Ramata', 'Rossa', 'Frizzante', 'Croccante', 'Matura']],
  industrial: [['Deposito', 'Fabbrica', 'Raffineria', 'Cantiere', 'Officina', 'Scalo'], ['Fumoso', 'Arrugginito', 'Rumoroso', 'Elettrico', 'Metallico', 'Oleoso']],
  castle: [['Castello', 'Rocca', 'Fortezza', 'Torrione', 'Bastione', 'Maniero'], ['Cosmico', 'Ribelle', 'Antico', 'Fantasma', 'Reale', 'Oscuro']],
  classic: [P1, P2],
};
export const THEME_LABEL = { arena: 'Arena dei gladiatori', classic: 'Paese', alpine: 'Villaggio alpino', western: 'Città western', coastal: 'Borgo marinaro', farm: 'Fattoria', industrial: 'Zona industriale', castle: 'Castello', port: 'Porto' };
function assignThemes(r, random) {
  const used = new Set();
  for (const t of TOWNS) {
    const b = biomeAt(t.x, t.z, _bw);
    let theme = 'classic';
    // vicino al mare? (campiona attorno alla città)
    let sea = false;
    for (let k = 0; k < 8 && !sea; k++) { const a = k / 8 * Math.PI * 2; if (coastMask(t.x + Math.cos(a) * (t.r + 70), t.z + Math.sin(a) * (t.r + 70)) > 0.86) sea = true; }
    const nm = t.name || '';
    if (b[1] > 0.5) theme = 'alpine';
    else if (!random && /^Porto|^Molo/.test(nm) || t.containers && sea) theme = 'port';
    else if (!random && /^Fattoria/.test(nm)) theme = 'farm';
    else if (!random && /^Castello|^Rocca/.test(nm)) theme = 'castle';
    else if (b[2] > 0.5) theme = 'western';
    else if (b[4] > 0.5) theme = 'coastal';
    else if (t.containers) theme = 'industrial';
    else if (t.towers && b[3] <= 0.5) theme = 'castle';
    else if (b[3] > 0.5) theme = 'farm';
    else if (sea) theme = 'coastal';
    t.theme = theme;
    if (random && THEME_NAMES[theme] && theme !== 'classic') {
      const [A, B] = THEME_NAMES[theme];
      for (let k = 0; k < 30; k++) { const s = A[Math.floor(r() * A.length)] + ' ' + B[Math.floor(r() * B.length)]; if (!used.has(s)) { used.add(s); t.name = s; break; } }
    }
  }
}


/** prepara le città, le montagne, i laghi, i biomi e i fiumi per il seme indicato */
let prewarmed = null;   // v48: chiave della mappa già preparata da prewarmMap
function configureMap(seed, random) {
  if (prewarmed === seed + '|' + random && fieldsReady) {
    // biomi, strade, fiumi e altezze sono già pronti (calcolati durante i download): si azzera solo il resto
    prewarmed = null;
    srand = mulberry32(seed);
    colliders.length = 0; grid.clear(); stamp = 0;
    TALL.length = 0; tallGrid.clear();
    return;
  }
  prewarmed = null; pendingSteps = null;
  defineMap(seed, random);
  colliders.length = 0; grid.clear(); roads.length = 0; stamp = 0;
  TALL.length = 0; tallGrid.clear();
  // biomi, altezze (le città stanno sopra il livello del mare), strade, fiumi e temi
  fieldsReady = false; ensureFields();
}
/**
 * v48: prepara la mappa a piccoli passi (al massimo `budget` ms per volta) mentre il gioco aspetta foto e personaggi:
 * sul telefono la griglia delle altezze da sola teneva lo schermo fermo per molti secondi su "Costruzione dell'isola"
 */
export async function prewarmMap(seed = 1337, random = false, budget = 12) {
  defineMap(seed, random);
  roads.length = 0;
  const steps = fieldsSteps();
  pendingSteps = steps; fieldsReady = false;
  for (;;) {
    // fra un passo e l'altro i campi risultano "non pronti": chi li chiede completa il lavoro di fila (ensureFields)
    if (pendingSteps !== steps) return;
    fieldsReady = true;
    const t = performance.now();
    let done = false;
    while (!done && performance.now() - t < budget) {
      const r = steps.next(); done = r.done;
      if (r.value && window.__trace) window.__trace('terreno: ' + r.value);   // v50: registro dei passi
    }
    if (done) { pendingSteps = null; prewarmed = seed + '|' + random; return; }
    fieldsReady = false;
    await new Promise(r => setTimeout(r, 0));
  }
}
/** città, montagne, laghi e biomi della mappa (fissa o casuale) */
function defineMap(seed, random) {
  MAP.seed = seed; MAP.random = random;
  srand = mulberry32(seed);
  TOWNS.length = 0; MOUNTAINS.length = 0; LAKES.length = 0; BIOME_CENTERS.length = 0;
  if (!random) {
    for (const t of DEFAULT_TOWNS) TOWNS.push({ ...t, r: t.arena ? t.r : Math.round(t.r * (t.k || TOWN_K)) });
    for (const m of DEFAULT_MOUNTAINS) MOUNTAINS.push({ ...m });
    for (const l of DEFAULT_LAKES) LAKES.push({ ...l });
    for (const bc of DEFAULT_BIOMES) BIOME_CENTERS.push({ ...bc });
  } else {
    const r = mulberry32(seed ^ 0x9e3779b9), R = (a, b) => a + r() * (b - a);
    // città: una grande vicino al centro, le altre sparse con distanza minima
    const n = 14 + Math.floor(r() * 5), used = new Set();
    const name = () => { for (let k = 0; k < 50; k++) { const s = P1[Math.floor(r() * P1.length)] + ' ' + P2[Math.floor(r() * P2.length)]; if (!used.has(s)) { used.add(s); return s; } } return 'Paese ' + used.size; };
    TOWNS.push({ name: 'Colosseo ' + name().split(' ').pop(), x: R(-25, 25), z: R(-25, 25), r: 70, houses: 0, arena: true });
    for (let k = 0; TOWNS.length < n && k < 3000; k++) {
      const x = R(-HALF + 100, HALF - 100), z = R(-HALF + 100, HALF - 100);
      if (TOWNS.some(t => Math.hypot(t.x - x, t.z - z) < (t.r > 60 ? 200 : 172))) continue;
      const tr = Math.round(R(46, 54) * TOWN_K), kind = r();
      TOWNS.push({ name: name(), x, z, r: tr, houses: Math.max(2, Math.round(tr / 5.5 + R(-1, 1.5))), towers: kind < 0.2, containers: kind > 0.78 });
    }
    // biomi: uno per quadrante, in ordine e posizione casuali
    const kinds = ['snow', 'desert', 'autumn', 'tropic'];
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    const a0 = R(0, 6.28);
    kinds.forEach((bk, k) => { const a = a0 + k * Math.PI / 2 + R(-0.35, 0.35), d = R(300, 400); BIOME_CENTERS.push({ b: bk, x: Math.cos(a) * d, z: Math.sin(a) * d, r: R(230, 300) }); });
    const okM = (m) => !TOWNS.some(t => Math.hypot(t.x - m.x, t.z - m.z) < m.r * 0.55 + t.r) && !MOUNTAINS.some(o => Math.hypot(o.x - m.x, o.z - m.z) < o.r * 0.7 + m.r * 0.6);
    // il massiccio più alto sta nel bioma innevato
    const sn = BIOME_CENTERS.find(bc => bc.b === 'snow');
    for (let k = 0; k < 400; k++) {
      const m = { x: Math.max(-HALF + 130, Math.min(HALF - 130, sn.x * R(0.5, 1) + R(-90, 90))), z: Math.max(-HALF + 130, Math.min(HALF - 130, sn.z * R(0.5, 1) + R(-90, 90))), r: R(140, 180), h: R(75, 100) };
      if (okM(m) || k === 399) { MOUNTAINS.push(m); break; }
    }
    for (let k = 0; MOUNTAINS.length < 4 + (seed % 3) && k < 600; k++) {
      const m = { x: R(-HALF + 100, HALF - 100), z: R(-HALF + 100, HALF - 100), r: R(70, 130), h: R(28, 62) };
      if (okM(m)) MOUNTAINS.push(m);
    }
    for (let k = 0; LAKES.length < 2 + Math.floor((seed >> 3) % 3) && k < 500; k++) {
      const l = { x: R(-HALF + 100, HALF - 100), z: R(-HALF + 100, HALF - 100), r: R(40, 85), d: R(8, 11) };
      if (TOWNS.some(t => Math.hypot(t.x - l.x, t.z - l.z) < l.r + t.r + 25)) continue;
      if (MOUNTAINS.some(o => Math.hypot(o.x - l.x, o.z - l.z) < o.r * 0.7 + l.r)) continue;
      if (LAKES.some(o => Math.hypot(o.x - l.x, o.z - l.z) < o.r + l.r)) continue;
      LAKES.push(l);
    }
  }
}

// ─────────────── Erba alta (ci si nasconde dentro) ───────────────
const TALL = [];                 // macchie circolari { x, z, r }
const tallGrid = new Map();      // celle da 40 m → macchie che le toccano
const TCELL = 40;
function addTallPatch(p) {
  TALL.push(p);
  for (let ix = Math.floor((p.x - p.r) / TCELL); ix <= Math.floor((p.x + p.r) / TCELL); ix++)
    for (let iz = Math.floor((p.z - p.r) / TCELL); iz <= Math.floor((p.z + p.r) / TCELL); iz++) {
      const k = ix * 1000 + iz;
      if (!tallGrid.has(k)) tallGrid.set(k, []);
      tallGrid.get(k).push(p);
    }
}
/** true se il punto è dentro una macchia d'erba alta (bordo irregolare) */
export function tallGrassAt(x, z) {
  const arr = tallGrid.get(Math.floor(x / TCELL) * 1000 + Math.floor(z / TCELL));
  if (!arr) return false;
  for (const p of arr) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < p.r * (0.82 + 0.18 * Math.sin(Math.atan2(dz, dx) * 3 + p.x))) return true;
  }
  return false;
}
export function tallGrassPatches() { return TALL; }

// ─────────────── Collisioni ───────────────
export const colliders = [];
const CELL = 16;
const grid = new Map();
let stamp = 0;

function cellKey(ix, iz) { return (ix + 2048) * 4096 + (iz + 2048); }

export function addCollider(c) {
  if (c.type === 'cyl') {
    c.minX = c.x - c.r; c.maxX = c.x + c.r; c.minZ = c.z - c.r; c.maxZ = c.z + c.r;
  } else if (c.type === 'ring') {
    // v38: anello (gradinate e muri dell'arena): corona circolare fra r0 e r1, con varchi rettilinei (gates: {ax, az, w})
    c.gates = c.gates || [];
    if (c.only) {
      // v42: settore di anello limitato a una striscia rettilinea (gradini delle scalinate del Colosseo):
      //  nella griglia occupa solo il suo rettangolo, non tutto l'anello
      const g = c.only, px = -g.az, pz = g.ax, xs = [], zs = [];
      for (const r of [c.r0, c.r1]) for (const s of [-1, 1]) { const a = Math.sqrt(Math.max(0, r * r - g.w * g.w)); xs.push(c.x + g.ax * a + px * g.w * s, c.x + g.ax * r + px * g.w * s); zs.push(c.z + g.az * a + pz * g.w * s, c.z + g.az * r + pz * g.w * s); }
      c.minX = Math.min(...xs); c.maxX = Math.max(...xs); c.minZ = Math.min(...zs); c.maxZ = Math.max(...zs);
    } else { c.minX = c.x - c.r1; c.maxX = c.x + c.r1; c.minZ = c.z - c.r1; c.maxZ = c.z + c.r1; }
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

/** v38: true se (x, z) cade in uno dei varchi dell'anello */
export function ringGap(c, x, z, m = 0) {
  const dx = x - c.x, dz = z - c.z;
  if (c.only) { const g = c.only; if (!(dx * g.ax + dz * g.az > 0 && Math.abs(dz * g.ax - dx * g.az) < g.w)) return true; }   // v42: fuori dalla striscia
  for (const g of c.gates) if (dx * g.ax + dz * g.az > 0 && Math.abs(dz * g.ax - dx * g.az) < g.w - m) return true;
  return false;
}
/** v41: rampe costruite: quota della superficie inclinata in (x, z) (sale lungo c.dir: 'x+', 'x-', 'z+', 'z-') */
export function rampTop(c, x, z) {
  const ax = c.dir[0] === 'x', u = ax ? x : z, u0 = ax ? c.minX : c.minZ, u1 = ax ? c.maxX : c.maxZ;
  let t = (u - u0) / (u1 - u0);
  if (c.dir[1] === '-') t = 1 - t;
  return c.minY + Math.max(0, Math.min(1, t)) * (c.maxY - c.minY);
}
/** Altezza del suolo (terreno o cima di una cassa) sotto un punto */
export function groundAt(x, z, feetY, radius = 0.35) {
  let g = terrainHeight(x, z);
  const list = queryColliders(x, z, radius + 0.1);
  for (const c of list) {
    if (c.noStand) continue;
    if (c.type === 'ramp') {
      if (x < c.minX - 0.05 || x > c.maxX + 0.05 || z < c.minZ - 0.05 || z > c.maxZ + 0.05) continue;
      const s = rampTop(c, x, z);
      if (s <= feetY + 0.6 && s > g) g = s;
      continue;
    }
    if (c.maxY > feetY + 0.5) continue; // troppo alto per salirci
    if (c.maxY <= g) continue;
    if (c.type === 'box') {
      if (x > c.minX - radius * 0.6 && x < c.maxX + radius * 0.6 && z > c.minZ - radius * 0.6 && z < c.maxZ + radius * 0.6) g = c.maxY;
    } else if (c.type === 'ring') {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > c.r0 - radius * 0.5 && d < c.r1 + radius * 0.5 && !ringGap(c, x, z)) g = c.maxY;
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + radius * 0.5) g = c.maxY;
  }
  return g;
}

/** Spinge fuori un cerchio (personaggio) dai collisori */
export function resolveCollisions(pos, radius, height) {
  const list = queryColliders(pos.x, pos.z, radius + 0.2);
  let hit = false;
  for (const c of list) {
    if (c.type === 'ramp') continue;   // v41: sulle rampe si cammina, non spingono
    if (pos.y >= c.maxY - 0.05 || pos.y + height <= c.minY) continue;
    // v41: ciò che sta sopra la testa (soffitti, architravi di porte e finestre, solai) è un soffitto, non un muro:
    //  saltando sopra un tavolo la testa entrava nel tetto e la spinta laterale ti buttava fuori dalla casa
    if (c.minY > pos.y + height * 0.62 && c.type === 'box') continue;
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
    } else if (c.type === 'ring') {
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r0 - radius || d > c.r1 + radius || d < 1e-6 || ringGap(c, pos.x, pos.z)) continue;
      const to = d - c.r0 < c.r1 - d ? c.r0 - radius : c.r1 + radius;
      // v42: vicino al bordo di un varco (scalinate, corridoi) si esce di lato, verso il varco, se è più vicino:
      //  prima si veniva sbalzati in avanti o indietro di un gradino intero
      let lat = Math.abs(to - d), gx = 0, gz = 0;
      if (!c.only) for (const g of c.gates) {
        if (!g.soft || dx * g.ax + dz * g.az <= 0) continue;   // solo i varchi senza muri di fianco (scalinate)
        const cr = dz * g.ax - dx * g.az, e = Math.abs(cr) - g.w + 0.02;
        if (e < lat) { lat = e; const sg = cr > 0 ? 1 : -1; gx = g.az * sg * e; gz = -g.ax * sg * e; }
      }
      if (gx || gz) { pos.x += gx; pos.z += gz; }
      else { pos.x = c.x + dx / d * to; pos.z = c.z + dz / d * to; }
      hit = true;
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

/** v41: quota del soffitto più basso sopra (x, z) a partire dall'altezza della testa (Infinity se non c'è) */
export function ceilingAt(x, z, feetY, height, radius = 0.35) {
  let top = Infinity;
  const r = radius * 0.8, from = feetY + height * 0.62;
  for (const c of queryColliders(x, z, radius + 0.1)) {
    if (c.type !== 'box' || c.minY <= from || c.minY >= top) continue;
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) top = c.minY;
  }
  return top;
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

/** v41: raggio contro una rampa (lastra inclinata spessa 0,25 m) */
function rayRamp(o, d, c) {
  const ax = c.dir[0] === 'x', neg = c.dir[1] === '-';
  const u0 = ax ? c.minX : c.minZ, u1 = ax ? c.maxX : c.maxZ;
  const slope = (c.maxY - c.minY) / (u1 - u0) * (neg ? -1 : 1), base = neg ? u1 : u0;
  const ou = ax ? o.x : o.z, du = ax ? d.x : d.z;
  let best = -1;
  for (const off of [0, -0.25]) {
    // y(t) = o.y + d.y t   ·   piano: y = minY + off + slope (u - base)
    const A = o.y - (c.minY + off + slope * (ou - base)), B = d.y - slope * du;
    if (Math.abs(B) < 1e-9) continue;
    const t = -A / B;
    if (t < 0 || (best >= 0 && t >= best)) continue;
    const x = o.x + d.x * t, z = o.z + d.z * t;
    if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
    best = t;
  }
  return best;
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

/** v38: raggio contro un anello (corona circolare in verticale, con i varchi) */
function rayRing(o, d, c) {
  const ox = o.x - c.x, oz = o.z - c.z, a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), cc0 = ox * ox + oz * oz;
  const ok = (t) => {
    if (t < 0) return false;
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, r = Math.hypot(x - c.x, z - c.z);
    return y >= c.minY - 1e-3 && y <= c.maxY + 1e-3 && r >= c.r0 - 1e-3 && r <= c.r1 + 1e-3 && !ringGap(c, x, z);
  };
  if (ok(0)) return 0;
  const cand = [];
  if (a > 1e-9) for (const R of [c.r1, c.r0]) {
    const disc = b * b - 4 * a * (cc0 - R * R);
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    cand.push((-b - sq) / (2 * a), (-b + sq) / (2 * a));
  }
  if (Math.abs(d.y) > 1e-9) cand.push((c.maxY - o.y) / d.y, (c.minY - o.y) / d.y);
  cand.sort((p, q) => p - q);
  for (const t of cand) if (ok(t)) return t;
  return -1;
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
      const t = c.type === 'box' ? rayBox(o, d, c) : c.type === 'ring' ? rayRing(o, d, c) : c.type === 'ramp' ? rayRamp(o, d, c) : rayCyl(o, d, c);
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
// v24: taglio dei piani superiori del palazzo in cui si trova il giocatore (scarta i frammenti sopra uClipY
// dentro il rettangolo uClipBox = minX, minZ, maxX, maxZ). Aggiornato da main.js ogni frame.
export const CLIP = { box: { value: new THREE.Vector4(0, 0, 0, 0) }, y: { value: 1e9 } };
const _clipDone = new WeakSet();
function clipCompile(sh) {
  sh.uniforms.uClipBox = CLIP.box; sh.uniforms.uClipY = CLIP.y;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vClipW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 cw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ncw = instanceMatrix * cw;\n#endif\nvClipW = (modelMatrix * cw).xyz; }');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vClipW;\nuniform vec4 uClipBox;\nuniform float uClipY;')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vClipW.y > uClipY && vClipW.x > uClipBox.x && vClipW.x < uClipBox.z && vClipW.z > uClipBox.y && vClipW.z < uClipBox.w) discard;');
}
function clipMat(mt) {
  if (_clipDone.has(mt)) return;
  _clipDone.add(mt);
  if (mt.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return;
  mt.onBeforeCompile = clipCompile;
  mt.needsUpdate = true;
}

function m(name, color, opts = {}) {
  if (!M[name]) M[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
  return M[name];
}

// ── texture degli edifici: colore + rilievo (normal map), risoluzione secondo la qualità scelta ──
function withNormal(color, height, strength) {
  const t = colorTex(color);
  if (NORMALS) t.userData.normal = normalFromHeight(height, strength);
  return t;
}
// v45: intonaco fotografico unico per tutte le case; il colore di ogni casa è la tinta del materiale
let _plasterTex = null;
const PLASTER_K = 1 / 0.86;
function makeWallTexture(base, line) {
  if (hasPhoto('plaster')) {
    if (!_plasterTex) {
      const B = 256, { c, g } = canvas2d(B), H = NORMALS ? canvas2d(B) : null;
      paintPhoto(g, 'plaster', 0, 0, B, B, { tint: '#dbdbdb', keep: 0.6, contrast: 0.85 });
      // umidità e sporco verso il basso (affiancabile solo in orizzontale: in verticale ripete ogni 2 m come prima)
      for (let i = 0; i < 16; i++) {
        const x = Math.random() * B, y = 150 + Math.random() * 106, r = 14 + Math.random() * 34;
        for (const ox of [-B, 0, B]) {
          const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
          gr.addColorStop(0, 'rgba(70,58,36,0.10)'); gr.addColorStop(1, 'rgba(70,58,36,0)');
          g.fillStyle = gr; g.fillRect(x + ox - r, y - r, r * 2, r * 2);
        }
      }
      if (H) paintPhoto(H.g, 'plaster', 0, 0, B, B, { mode: 'height', contrast: 0.7 });
      _plasterTex = colorTex(c);
      if (H) _plasterTex.userData.normal = normalFromHeight(H.c, 0.45);
    }
    const t = _plasterTex;
    // la stessa texture per tutti: la tinta passa al materiale (texMat)
    return { isTexProxy: true, tex: t, tint: base, tintK: PLASTER_K };
  }
  const { c, g, S } = canvas2d(128), H = canvas2d(128), h = H.g;
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  h.fillStyle = 'rgb(150,150,150)'; h.fillRect(0, 0, 128, 128);
  // blocchi con leggere variazioni di tono e di sporgenza
  for (let y = 0; y < 128; y += 16) {
    const off = (y / 16) % 2 ? 16 : 0;
    for (let x = off - 32; x < 128; x += 32) {
      const k = Math.random();
      g.fillStyle = k < 0.5 ? `rgba(0,0,0,${0.02 + k * 0.06})` : `rgba(255,255,255,${(k - 0.5) * 0.12})`;
      g.fillRect(x, y, 32, 16);
      const hv = 140 + Math.floor(Math.random() * 30);
      h.fillStyle = `rgb(${hv},${hv},${hv})`; h.fillRect(x + 1, y + 1, 30, 14);
    }
  }
  // macchie di umidità e sporco in basso
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 128, y = 70 + Math.random() * 58, r = 6 + Math.random() * 16;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(60,50,30,0.10)'); gr.addColorStop(1, 'rgba(60,50,30,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  addGrain(g, S, 14); addGrain(h, H.S, 40);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 128, y = Math.random() * 128, w = 1 + Math.random() * 3, hh = 1 + Math.random() * 3;
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; g.fillRect(x, y, w, hh);
    h.fillStyle = 'rgba(0,0,0,0.25)'; h.fillRect(x, y, w, hh);
  }
  // fughe
  for (let y = 0; y < 128; y += 16) {
    g.lineWidth = 2; g.strokeStyle = line; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + 1.5); g.lineTo(128, y + 1.5); g.stroke();
    h.lineWidth = 2.2; h.strokeStyle = 'rgb(40,40,40)'; h.beginPath(); h.moveTo(0, y); h.lineTo(128, y); h.stroke();
    const off = (y / 16) % 2 ? 16 : 0;
    g.lineWidth = 2; g.strokeStyle = line;
    for (let x = off; x < 128; x += 32) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke();
      h.beginPath(); h.moveTo(x, y); h.lineTo(x, y + 16); h.stroke();
    }
  }
  return withNormal(c, H.c, 2.2);
}

const _roofN = {};
/** v45: muro di pietra fotografico (blocchi irregolari con muschio, come nel riferimento) */
function makeStoneWallTexture() {
  if (!hasPhoto('stone')) return makeWallTexture('#a39d92', 'rgba(0,0,0,0.25)');
  const B = 256, { c, g } = canvas2d(B), H = NORMALS ? canvas2d(B) : null;
  paintPhoto(g, 'stone', 0, 0, B, B, { bright: 1.18, contrast: 1.05 });
  if (H) paintPhoto(H.g, 'stone', 0, 0, B, B, { mode: 'height', contrast: 1.5 });
  return H ? withNormal(c, H.c, 1.1) : colorTex(c);
}
function makeRoofTexture(base) {
  // v45: coppi fotografici (muschio e licheni) per i tetti caldi; v46: ardesia per quelli grigi e blu
  const hsl = {}; new THREE.Color(base).getHSL(hsl);
  const warm = (hsl.h < 0.12 || hsl.h > 0.95) && hsl.s > 0.2;
  const kind = warm || !hasPhoto('slate') ? 'roof' : 'slate';
  if (hasPhoto(kind)) {
    const B = 256, { c, g } = canvas2d(B);
    if (kind === 'roof') paintPhoto(g, 'roof', 0, 0, B, B, { tint: base, keep: warm ? 0.55 : 0.25, contrast: 1.1, bright: 1.18 });
    else paintPhoto(g, 'slate', 0, 0, B, B, { tint: base, keep: 0.5, contrast: 1.05, bright: 1.15 });
    if (NORMALS && !_roofN[kind]) { const H = canvas2d(B); paintPhoto(H.g, kind, 0, 0, B, B, { mode: 'height', contrast: 1.4 }); _roofN[kind] = normalFromHeight(H.c, 1.1); }
    const t = colorTex(c); if (_roofN[kind]) t.userData.normal = _roofN[kind];
    return t;
  }
  const { c, g, S } = canvas2d(128), H = canvas2d(128), h = H.g;
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  h.fillStyle = '#000'; h.fillRect(0, 0, 128, 128);
  // file di tegole sfalsate: ogni tegola è più alta in basso (si sovrappone a quella sotto)
  for (let row = 0; row < 8; row++) {
    const y = row * 16, off = row % 2 ? 8 : 0;
    for (let x = -off; x < 128; x += 16) {
      const k = 0.85 + Math.random() * 0.3;
      g.fillStyle = `rgba(${k > 1 ? 255 : 0},${k > 1 ? 255 : 0},${k > 1 ? 255 : 0},${Math.abs(k - 1) * 0.35})`;
      g.fillRect(x + 1, y + 1, 14, 13);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + 13, 16, 3);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y, 1.5, 14);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 2, y + 2, 11, 2);
      if (Math.random() < 0.18) { g.fillStyle = 'rgba(70,90,40,0.25)'; g.fillRect(x + 2 + Math.random() * 8, y + 6, 4, 6); }   // muschio
      const gr = h.createLinearGradient(0, y, 0, y + 15);
      gr.addColorStop(0, 'rgb(70,70,70)'); gr.addColorStop(0.85, 'rgb(220,220,220)'); gr.addColorStop(1, 'rgb(40,40,40)');
      h.fillStyle = gr; h.fillRect(x + 1, y, 14, 15);
      // tegola curva (coppo): più alta al centro
      const gx = h.createLinearGradient(x, 0, x + 16, 0);
      gx.addColorStop(0, 'rgba(0,0,0,0.35)'); gx.addColorStop(0.5, 'rgba(255,255,255,0.15)'); gx.addColorStop(1, 'rgba(0,0,0,0.35)');
      h.fillStyle = gx; h.fillRect(x + 1, y, 14, 15);
    }
  }
  addGrain(g, S, 12); addGrain(h, H.S, 22);
  return withNormal(c, H.c, 2.6);
}

function makeBrickTexture(base = '#9a4a3a') {
  if (hasPhoto('brick')) {
    const B = 256, { c, g } = canvas2d(B), H = NORMALS ? canvas2d(B) : null;
    paintPhoto(g, 'brick', 0, 0, B, B, { bright: 1.05 });
    if (H) paintPhoto(H.g, 'brick', 0, 0, B, B, { mode: 'height', contrast: 1.3 });
    return H ? withNormal(c, H.c, 0.9) : colorTex(c);
  }
  const { c, g, S } = canvas2d(64), H = canvas2d(64), h = H.g;
  g.fillStyle = '#d8cfc0'; g.fillRect(0, 0, 64, 64);
  h.fillStyle = 'rgb(50,50,50)'; h.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < 64; x += 16) {
      const k = 0.8 + Math.random() * 0.35;
      const cc = new THREE.Color(base).multiplyScalar(k);
      g.fillStyle = '#' + cc.getHexString();
      g.fillRect(x + 1, row * 8 + 1, 14, 6);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 1, row * 8 + 1, 14, 1);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 1, row * 8 + 6, 14, 1);
      if (Math.random() < 0.15) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3 + Math.random() * 8, row * 8 + 2, 2, 2); }   // scheggiature
      const hv = 190 + Math.floor(Math.random() * 40);
      h.fillStyle = `rgb(${hv},${hv},${hv})`; h.fillRect(x + 1.2, row * 8 + 1.2, 13.6, 5.6);
    }
  }
  addGrain(g, S, 16); addGrain(h, H.S, 50);
  return withNormal(c, H.c, 2.4);
}

function makeWoodTexture() {
  // v21: risoluzione doppia, assi con venature curve, nodi, bordi consumati e scanalature profonde
  const B = 128, { c, g, S } = canvas2d(B), H = canvas2d(B), h = H.g;
  g.fillStyle = '#9a6a35'; g.fillRect(0, 0, B, B);
  h.fillStyle = 'rgb(150,150,150)'; h.fillRect(0, 0, B, B);
  const PW = B / 5;
  // v45: assi fotografiche (venature, nodi e chiodi veri) al posto di quelle disegnate
  const photo = paintPhoto(g, 'wood', 0, 0, B, B, { bright: 1.12 });
  if (photo) paintPhoto(h, 'wood', 0, 0, B, B, { mode: 'height', contrast: 1.5, base: 150 });
  for (let x = 0; !photo && x < B - 0.1; x += PW) {
    const k = 0.86 + Math.random() * 0.28;
    g.fillStyle = `rgba(${k > 1 ? 255 : 40},${k > 1 ? 215 : 20},${k > 1 ? 150 : 0},${Math.abs(k - 1) * 0.7})`; g.fillRect(x, 0, PW, B);
    // venature: linee ondulate che si stringono attorno ai nodi
    const knots = [];
    if (Math.random() < 0.7) knots.push([x + 4 + Math.random() * (PW - 8), 10 + Math.random() * (B - 20), 1.6 + Math.random() * 1.6]);
    for (let i = 0; i < 16; i++) {
      const vx = x + 1 + Math.random() * (PW - 2), a = 0.06 + Math.random() * 0.16;
      g.strokeStyle = `rgba(70,35,10,${a})`; g.lineWidth = 0.5 + Math.random() * 0.6;
      h.strokeStyle = `rgba(0,0,0,${0.04 + a * 0.4})`; h.lineWidth = 1.1;
      for (const ctx of [g, h]) {
        ctx.beginPath(); ctx.moveTo(vx, 0);
        for (let y = 4; y <= B; y += 4) {
          let dx = Math.sin(y * 0.05 + vx) * 0.8;
          for (const [kx, ky, kr] of knots) { const d = Math.hypot(vx - kx, y - ky); if (d < kr * 5) dx += (vx < kx ? -1 : 1) * (kr * 5 - d) * 0.35; }
          ctx.lineTo(vx + dx, y);
        }
        ctx.stroke();
      }
    }
    for (const [kx, ky, kr] of knots) {
      const gr = g.createRadialGradient(kx, ky, 0, kx, ky, kr * 1.6);
      gr.addColorStop(0, 'rgba(45,22,6,0.9)'); gr.addColorStop(0.5, 'rgba(80,40,12,0.6)'); gr.addColorStop(1, 'rgba(80,40,12,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, kr * 1.3, kr * 1.8, 0, 0, 7); g.fill();
      h.fillStyle = 'rgba(0,0,0,0.5)'; h.beginPath(); h.ellipse(kx, ky, kr, kr * 1.4, 0, 0, 7); h.fill();
    }
    // fessura tra le assi + bordi smussati (luce sul bordo, ombra nella fessura)
    g.fillStyle = 'rgba(30,14,3,0.75)'; g.fillRect(x, 0, 1.2, B);
    g.fillStyle = 'rgba(255,225,170,0.14)'; g.fillRect(x + 1.2, 0, 1, B);
    h.fillStyle = 'rgb(10,10,10)'; h.fillRect(x, 0, 1.4, B);
    h.fillStyle = 'rgb(110,110,110)'; h.fillRect(x + 1.4, 0, 1.2, B); h.fillRect(x + PW - 1.2, 0, 1.2, B);
  }
  // cornice e traversa diagonale (cassa), in rilievo e con ombra portata
  const frame = (ctx, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.strokeRect(5, 5, B - 10, B - 10); ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(B - 5, B - 5); ctx.stroke(); };
  frame(g, 'rgba(25,12,3,0.55)', 9.5);
  let frameStyle = '#74491f';
  if (photo) {
    // cornice con le venature orizzontali (foto ruotata), un po' più scura delle assi
    const tc = document.createElement('canvas'); tc.width = tc.height = S;
    const tg = tc.getContext('2d', WRF); tg.setTransform(S / B, 0, 0, S / B, 0, 0);
    paintPhoto(tg, 'wood', 0, 0, B, B, { rot: true, tint: '#7a4c22', keep: 0.7, contrast: 1.25, ox: 0.37 });
    frameStyle = g.createPattern(tc, 'repeat'); frameStyle.setTransform(new DOMMatrix().scale(B / S));
  }
  frame(g, frameStyle, 7);
  g.strokeStyle = 'rgba(255,220,160,0.16)'; g.lineWidth = 1; g.strokeRect(2.5, 2.5, B - 5, B - 5);
  frame(h, 'rgb(250,250,250)', 7);
  // chiodi (testa lucida con ombra)
  for (const [x, y] of [[6, 6], [B - 6, 6], [6, B - 6], [B - 6, B - 6], [B / 2, B / 2], [B / 2, 6], [B / 2, B - 6]]) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x + 0.6, y + 0.6, 1.9, 0, 7); g.fill();
    g.fillStyle = '#4a4a4c'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
    g.fillStyle = '#9a9aa0'; g.beginPath(); g.arc(x - 0.4, y - 0.4, 0.6, 0, 7); g.fill();
    h.fillStyle = '#fff'; h.beginPath(); h.arc(x, y, 1.7, 0, 7); h.fill();
  }
  // v22: niente grana per pixel sul rilievo (dava puntini e righe "rumorose" da vicino); rilievo leggermente sfocato
  addGrain(g, S, 4);
  { const tmp = document.createElement('canvas'); tmp.width = tmp.height = H.S; const tg = tmp.getContext('2d', WRF); tg.filter = 'blur(0.8px)'; tg.drawImage(H.c, 0, 0); h.save(); h.setTransform(1, 0, 0, 1, 0, 0); h.drawImage(tmp, 0, 0); h.restore(); }
  const t = withNormal(c, H.c, 2.2);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (t.userData.normal) t.userData.normal.wrapS = t.userData.normal.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ─────────────── Interni: parquet, tessuti, tappeti, quadri, porte ───────────────
let _parquetTex = null;
function makeParquetTexture() {
  if (hasPhoto('parquet')) {
    // v46: parquet fotografico (rovere a doghe sfalsate), condiviso da pavimenti e mobili
    if (!_parquetTex) {
      const B = 256, { c, g } = canvas2d(B), H = NORMALS ? canvas2d(B) : null;
      paintPhoto(g, 'parquet', 0, 0, B, B, { contrast: 1.0, bright: 0.95 });
      if (H) paintPhoto(H.g, 'parquet', 0, 0, B, B, { mode: 'height', contrast: 1.2 });
      _parquetTex = H ? withNormal(c, H.c, 0.7) : colorTex(c);
    }
    return _parquetTex;
  }
  const B = 128, { c, g, S } = canvas2d(B), H = canvas2d(B), h = H.g;
  h.fillStyle = 'rgb(160,160,160)'; h.fillRect(0, 0, B, B);
  const tones = ['#8e623a', '#9a6c40', '#84582f', '#a3754a', '#7c5130'];
  const PW = B / 8;
  for (let i = 0; i < 8; i++) {
    let y = -Math.random() * 40;
    while (y < B) {
      const len = 34 + Math.random() * 40;
      g.fillStyle = tones[Math.floor(Math.random() * tones.length)]; g.fillRect(i * PW, y, PW, len);
      for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(60,30,10,${0.05 + Math.random() * 0.1})`; g.fillRect(i * PW + 1 + Math.random() * (PW - 2), y, 0.6, len); }
      g.fillStyle = 'rgba(30,15,5,0.7)'; g.fillRect(i * PW, y, PW, 0.9);
      h.fillStyle = 'rgb(30,30,30)'; h.fillRect(i * PW, y, PW, 1);
      y += len;
    }
    g.fillStyle = 'rgba(30,15,5,0.6)'; g.fillRect(i * PW, 0, 0.9, B);
    h.fillStyle = 'rgb(30,30,30)'; h.fillRect(i * PW, 0, 1, B);
  }
  // v45: venature fotografiche sulle doghe
  paintPhoto(g, 'wood', 0, 0, B, B, { tile: B / 2, mode: 'detail', strength: 0.75, contrast: 1.1 });
  // cera: riflesso morbido
  const gr = g.createLinearGradient(0, 0, B, B); gr.addColorStop(0, 'rgba(255,240,210,0.06)'); gr.addColorStop(0.5, 'rgba(255,240,210,0)'); gr.addColorStop(1, 'rgba(255,240,210,0.05)');
  g.fillStyle = gr; g.fillRect(0, 0, B, B);
  addGrain(g, S, 8); addGrain(h, H.S, 10);
  return withNormal(c, H.c, 1.6);
}
function makeFabricTexture() {
  const B = 64, { c, g, S } = canvas2d(B), H = canvas2d(B), h = H.g;
  g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, B, B);
  h.fillStyle = 'rgb(128,128,128)'; h.fillRect(0, 0, B, B);
  // trama a spina: fili alternati
  for (let y = 0; y < B; y += 2) for (let x = 0; x < B; x += 2) {
    const on = ((x + y) / 2) % 4 < 2;
    g.fillStyle = on ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'; g.fillRect(x, y, 2, 2);
    h.fillStyle = on ? 'rgb(170,170,170)' : 'rgb(90,90,90)'; h.fillRect(x, y, 2, 2);
  }
  addGrain(g, S, 16); addGrain(h, H.S, 20);
  return withNormal(c, H.c, 1.2);
}
function makeRugTexture(c1, c2, c3) {
  const B = 128, { c, g, S } = canvas2d(B), H = canvas2d(B), h = H.g;
  g.fillStyle = c1; g.fillRect(0, 0, B, B);
  h.fillStyle = 'rgb(140,140,140)'; h.fillRect(0, 0, B, B);
  g.strokeStyle = c2; g.lineWidth = 9; g.strokeRect(10, 10, B - 20, B - 20);
  g.strokeStyle = c3; g.lineWidth = 2.5; g.strokeRect(18, 18, B - 36, B - 36); g.strokeRect(5, 5, B - 10, B - 10);
  // medaglione centrale e motivi a rombo
  g.fillStyle = c2; g.beginPath(); g.moveTo(B / 2, 30); g.lineTo(B - 30, B / 2); g.lineTo(B / 2, B - 30); g.lineTo(30, B / 2); g.closePath(); g.fill();
  g.fillStyle = c3; g.beginPath(); g.moveTo(B / 2, 44); g.lineTo(B - 44, B / 2); g.lineTo(B / 2, B - 44); g.lineTo(44, B / 2); g.closePath(); g.fill();
  g.fillStyle = c1; g.beginPath(); g.arc(B / 2, B / 2, 7, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) { const x = i < 2 ? 26 : B - 26, y = i % 2 ? 26 : B - 26; g.fillStyle = c3; g.fillRect(x - 3, y - 3, 6, 6); }
  for (let y = 0; y < B; y += 1.5) { h.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.15)`; h.fillRect(0, y, B, 0.8); }
  addGrain(g, S, 22); addGrain(h, H.S, 30);
  return withNormal(c, H.c, 1.4);
}
function makePaintingTexture(k) {
  const B = 64, { c, g, S } = canvas2d(B);
  const skies = [['#f6c27a', '#e9776a'], ['#8ec5ff', '#e8f4ff'], ['#2a2f5a', '#7a5ac8'], ['#ffe6b0', '#9fd0e8']];
  const [s1, s2] = skies[k % skies.length];
  let gr = g.createLinearGradient(0, 0, 0, B * 0.6); gr.addColorStop(0, s1); gr.addColorStop(1, s2);
  g.fillStyle = gr; g.fillRect(0, 0, B, B);
  if (k % 4 === 2) { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(46, 14, 5, 0, 7); g.fill(); }
  else { g.fillStyle = 'rgba(255,250,220,0.9)'; g.beginPath(); g.arc(18 + k * 7 % 30, 18, 6, 0, 7); g.fill(); }
  // colline / montagne / mare a strati
  const layers = [['#5a7a4a', 34], ['#3f5f3a', 42], ['#2e4a2e', 52]];
  if (k % 4 === 1) layers.splice(0, 3, ['#9aa6b8', 28], ['#6a7a90', 38], ['#2f6a9a', 50]);
  layers.forEach(([col, y], i) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, B);
    for (let x = 0; x <= B; x += 4) g.lineTo(x, y + Math.sin(x * (0.08 + i * 0.05) + k * 1.7 + i) * (6 - i * 1.5) - (k % 4 === 1 && i === 0 ? Math.max(0, 14 - Math.abs(x - 32) * 0.9) : 0));
    g.lineTo(B, B); g.fill();
  });
  // pennellate
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; g.fillRect(Math.random() * B, Math.random() * B, 3 + Math.random() * 4, 1); }
  addGrain(g, S, 10);
  return colorTex(c, false);
}
function makeDoorTexture(paint) {
  // anta con 4 riquadri in rilievo (la texture si stira in altezza sulla porta)
  const B = 64, { c, g, S } = canvas2d(B), H = canvas2d(B), h = H.g;
  g.fillStyle = paint; g.fillRect(0, 0, B, B);
  h.fillStyle = 'rgb(150,150,150)'; h.fillRect(0, 0, B, B);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; g.fillRect(Math.random() * B, 0, 0.6, B); }
  const panels = [[9, 6, 46, 20], [9, 32, 46, 26]];
  for (const [x, y, w, hh] of panels) {
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y, w, 1.4); g.fillRect(x, y, 1.4, hh);
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x, y + hh - 1.4, w, 1.4); g.fillRect(x + w - 1.4, y, 1.4, hh);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 4, y + 3, w - 8, hh - 6);
    h.fillStyle = 'rgb(70,70,70)'; h.fillRect(x, y, w, hh);
    h.fillStyle = 'rgb(200,200,200)'; h.fillRect(x + 3, y + 3, w - 6, hh - 6);
  }
  addGrain(g, S, 10); addGrain(h, H.S, 8);
  // v46: legno verniciato vero (venature sotto la vernice, piccole scrostature)
  paintPhoto(g, 'paintwood', 0, 0, B, B, { mode: 'detail', strength: 0.5, contrast: 0.55, ox: 0.05 });
  const t = withNormal(c, H.c, 2.2);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
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
  for (const t of TOWNS) {
    if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return t;
    // v27: le città murate occupano tutto il quadrato delle mura
    if (t.wallS && Math.abs(x - t.x) < t.wallS + pad && Math.abs(z - t.z) < t.wallS + pad) return t;
  }
  return null;
}

// colore del terreno in un punto (usato sia dai chunk dettagliati sia da quelli lontani)
const _gc = {
  grass1: new THREE.Color('#5c9a36'), grass2: new THREE.Color('#a4c248'), meadow: new THREE.Color('#47883a'),   // v36: prati più dorati
  dry: new THREE.Color('#c4b858'), flower: new THREE.Color('#c2c652'), sand: new THREE.Color('#e3cf92'), wetSand: new THREE.Color('#a8956a'),
  rock: new THREE.Color('#878274'), rockDark: new THREE.Color('#6a665c'), dirt: new THREE.Color('#a8865a'), dirtEdge: new THREE.Color('#7f8a48'),
  snow: new THREE.Color('#dfe6ee'), town: new THREE.Color('#9aa36b'),
  // biomi
  snowA: new THREE.Color('#dce4ee'), snowB: new THREE.Color('#c6d3e3'), frost: new THREE.Color('#a9b9a4'), iceRock: new THREE.Color('#6f7682'),
  sandA: new THREE.Color('#efd0a2'), sandB: new THREE.Color('#dcae7c'), redRock: new THREE.Color('#b8693a'), redRock2: new THREE.Color('#d39a5c'), dryBush: new THREE.Color('#a39a58'),
  autA: new THREE.Color('#b48a3a'), autB: new THREE.Color('#9a6a2c'), leaves: new THREE.Color('#c25a26'), autGreen: new THREE.Color('#7f8c3a'),
  tropA: new THREE.Color('#3fb04a'), tropB: new THREE.Color('#5cc44e'), whiteSand: new THREE.Color('#f3e7c4'),
  asphalt: new THREE.Color('#505256'), road: new THREE.Color('#66676a'), walk: new THREE.Color('#b3aea4'), cobble: new THREE.Color('#8a8276'),
  townSnow: new THREE.Color('#e4e9ef'), townSand: new THREE.Color('#d8b98a'), townStone: new THREE.Color('#b9b1a0'), townDirt: new THREE.Color('#a8865a'), townBeach: new THREE.Color('#e2cc9a'),
  // v27: strade delle città a tema
  dirtRoad: new THREE.Color('#9b7b53'), snowRoad: new THREE.Color('#d2d9e2'), sandRoad: new THREE.Color('#d9c18c'), plank: new THREE.Color('#8a6a44'), snowCobble: new THREE.Color('#c9d0d8'),
};
const TOWN_GROUND_K = { arena: 0.85, alpine: 0.8, western: 0.7, coastal: 0.72, farm: 0.6 };
const SURF_GC = { asphalt: 'asphalt', cobble: 'cobble', dirt: 'dirtRoad', snow: 'snowRoad', sand: 'sandRoad' };
const _bc = new THREE.Color();
const TOWN_GROUND = { arena: 'townSand', alpine: 'townSnow', western: 'townSand', coastal: 'townBeach', castle: 'townStone', farm: 'townDirt', industrial: 'townStone', port: 'townStone' };
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
  // biomi: neve, deserto, bosco d'autunno, costa tropicale
  const bw = biomeAt(x, z), wS = bw[1], wD = bw[2], wA = bw[3], wT = bw[4];
  if (wA > 0.01) {
    _bc.copy(_gc.autA).lerp(_gc.autB, mid).lerp(_gc.leaves, smoothstep(0.55, 0.85, patch(x, z, 0.05, 2.7)) * 0.55).lerp(_gc.autGreen, smoothstep(0.6, 0.9, big) * 0.5);
    out.lerp(_bc, smoothstep(0, 0.8, wA));
  }
  if (wT > 0.01) { _bc.copy(_gc.tropA).lerp(_gc.tropB, n * 0.8); out.lerp(_bc, smoothstep(0, 0.8, wT)); }
  if (wD > 0.01) {
    _bc.copy(_gc.sandA).lerp(_gc.sandB, mid * 0.8 + 0.2 * Math.sin(x * 0.09 + z * 0.03));
    _bc.lerp(_gc.dryBush, smoothstep(0.65, 0.9, patch(x, z, 0.07, 3.3)) * 0.35);
    out.lerp(_bc, smoothstep(0.05, 0.75, wD));
  }
  if (wS > 0.01) {
    _bc.copy(_gc.frost).lerp(_gc.snowA, smoothstep(0.3, 0.75, wS));
    _bc.lerp(_gc.snowB, smoothstep(0.45, 0.8, patch(x, z, 0.06, 1.1)) * 0.5);
    out.lerp(_bc, smoothstep(0.05, 0.6, wS));
  }
  const tw = inTown(x, z, 4);
  // v27: il suolo racconta il tema (neve fitta, sabbia, aia di terra battuta) e sfuma verso il bordo
  if (tw) out.lerp(TOWN_GROUND[tw.theme] ? _gc[TOWN_GROUND[tw.theme]] : _gc.town, (TOWN_GROUND_K[tw.theme] || 0.45) * (1 - smoothstep(tw.r - 4, tw.r + 4, Math.hypot(x - tw.x, z - tw.z)) * 0.5));
  // v24: dentro le città il reticolo di strade (si vede anche da lontano sul terreno semplificato)
  const st = tw ? streetAt(tw, x, z) : 0;
  if (st) { const pl = tw.plan; out.copy(st === 2 ? _gc[SURF_GC[pl.surf] || 'asphalt'] : st === 3 ? (tw.theme === 'alpine' ? _gc.snowCobble : _gc.cobble) : (pl.walk === 'plank' ? _gc.plank : _gc.walk)); }
  else if (!tw || Math.hypot(x - tw.x, z - tw.z) > tw.r - 3) {
    // strade tra le città: asfalto (sterrato nel deserto) con bordo erboso più scuro
    const rd = roadDist(x, z);
    if (rd < 5) out.lerp(_gc.dirtEdge, smoothstep(5, 3.5, rd) * 0.5);
    if (rd < 3.6) out.lerp(wD > 0.5 ? _gc.dirt : _gc.road, smoothstep(3.6, 2.6, rd));
  }
  // spiagge, con sabbia bagnata vicino all'acqua
  if (h < WATER_LEVEL + 1.4 + wT * 1.6) out.lerp(wT > 0.4 ? _gc.whiteSand : _gc.sand, Math.min(1, (WATER_LEVEL + 1.4 + wT * 1.6 - h) / 1.2));
  if (h < WATER_LEVEL + 0.35) out.lerp(_gc.wetSand, Math.min(1, (WATER_LEVEL + 0.35 - h) / 0.6));
  // pendii ripidi → roccia (pendenza stimata dalle differenze dell'altezza)
  if (slope === null) {
    const gx = terrainHeight(x + 1.5, z) - terrainHeight(x - 1.5, z), gz = terrainHeight(x, z + 1.5) - terrainHeight(x, z - 1.5);
    slope = Math.hypot(gx, gz) / 3;
  }
  // roccia: nel deserto arenaria rossa a strati, sulle montagne innevate roccia fredda
  if (wD > 0.3) {
    _bc.copy(_gc.redRock).lerp(_gc.redRock2, 0.5 + 0.5 * Math.sin(h * 1.7 + Math.sin(x * 0.02) * 0.8));
    _gc._rk = _bc;
  } else if (wS > 0.4) _gc._rk = _gc.iceRock;
  else _gc._rk = _gc.rock;
  if (h > WATER_LEVEL + 0.5) out.lerp(_gc._rk, smoothstep(0.55, 1.0, slope) * 0.85);
  if (h > 24) out.lerp(_gc._rk, Math.min(1, (h - 24) / 10) * (1 - wS * 0.6));
  if (h > 28) out.lerp(_gc.rockDark, smoothstep(0.5, 0.8, mid) * 0.35 * (1 - wD));
  // neve sulle cime (più in basso nel bioma innevato), meno sui pendii ripidi
  const snowLine = 46 - wS * 30;
  if (h > snowLine) out.lerp(_gc.snow, Math.min(1, (h - snowLine) / 8) * (1 - smoothstep(0.8, 1.4, slope) * 0.65));
  return out;
}

// texture di dettaglio del terreno (dati lineari): R = filini d'erba fini, G = chiazze morbide
function makeGroundDetail() {
  const S = 256, c = document.createElement('canvas');   // (v45: canale R dalla foto della terra)
  c.width = c.height = S;
  const g = c.getContext('2d', WRF);
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
  // v45: canale R = grana fotografica della terra (sassolini, zolle) al posto dei filini disegnati
  if (hasPhoto('dirt')) {
    const H = document.createElement('canvas'); H.width = H.height = S;
    const hg = H.getContext('2d', { willReadFrequently: true });
    paintPhoto(hg, 'dirt', 0, 0, S, S, { mode: 'height', contrast: 1.35, base: 150 });
    const hd = hg.getImageData(0, 0, S, S).data, im2 = g.getImageData(0, 0, S, S), d2 = im2.data;
    for (let i = 0; i < d2.length; i += 4) d2[i] = hd[i];
    g.putImageData(im2, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** aggiunge la texture di dettaglio (coordinate mondo, due scale) a un materiale del terreno.
 *  Usa lo slot `map` integrato (binding affidabile) ma sostituisce il campionamento. */
function addGroundDetail(mat, tex, near = 70, far = 260, amount = 1, bump = false, flora = false) {
  mat.map = tex;
  // v45: prato fotografico nelle zone verdi (solo il materiale vicino, con la flora)
  const grassTex = flora ? photoTexture('grass') : null;
  const grassMean = grassTex ? photoMeanLinear('grass') : null;
  // v46: neve e sabbia fotografiche dove il terreno è bianco o color sabbia
  const snowTex = flora ? photoTexture('snow') : null, sandTex = flora ? photoTexture('sand') : null;
  const snowMean = snowTex ? photoMeanLinear('snow') : null, sandMean = sandTex ? photoMeanLinear('sand') : null;
  const ss = !!(snowTex && sandTex);
  mat.onBeforeCompile = (sh) => {
    if (grassTex) {
      sh.uniforms.grassMap = { value: grassTex };
      sh.uniforms.grassMean = { value: new THREE.Vector3(...grassMean) };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D grassMap;\nuniform vec3 grassMean;');
    }
    if (ss) {
      sh.uniforms.snowMap = { value: snowTex }; sh.uniforms.sandMap = { value: sandTex };
      sh.uniforms.snowMean = { value: new THREE.Vector3(...snowMean) }; sh.uniforms.sandMean = { value: new THREE.Vector3(...sandMean) };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D snowMap;\nuniform sampler2D sandMap;\nuniform vec3 snowMean;\nuniform vec3 sandMean;');
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <map_fragment>', `
        float gdNear = 1.0 - smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, length(vWPos - cameraPosition));
        {
          float dist = length(vWPos - cameraPosition);
          float fine = texture2D(map, vWPos.xz * 0.17).r;
          float fine2 = texture2D(map, vWPos.xz * 0.071 + vec2(0.31, 0.67)).r;
          float blot = texture2D(map, vWPos.xz * 0.019).g;
          float nearK = 1.0 - smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, dist);
          float d = mix(1.0, 0.45 + 0.95 * fine, nearK * 0.9) * mix(1.0, 0.62 + 0.75 * fine2, 0.6);
          d *= 0.72 + 0.5 * blot;
          ${ss ? `
          // v46: su neve e sabbia la grana della terra si attenua (ci pensano le loro foto)
          float vMin = min(vColor.r, min(vColor.g, vColor.b)), vMax = max(vColor.r, max(vColor.g, vColor.b));
          float snowD = smoothstep(0.62, 0.78, vMin) * smoothstep(0.2, 0.08, vMax - vMin);
          float sandD = smoothstep(0.45, 0.6, vColor.r) * smoothstep(0.88, 0.75, vColor.g / max(vColor.r, 0.01)) * smoothstep(0.5, 0.36, vColor.b / max(vColor.r, 0.01));
          d = mix(d, 1.0 + (d - 1.0) * 0.3, max(snowD, sandD));` : ''}
          diffuseColor.rgb *= mix(1.0, d, ${amount.toFixed(2)});
        }`)
      .replace('#include <color_fragment>', flora ? `#include <color_fragment>
        {
          // v36: prato con i fiorellini viola e increspature del vento sulla sabbia
          vec3 vc = vColor.rgb;
          float dist = length(vWPos - cameraPosition);
          float greenK = smoothstep(0.93, 1.12, vc.g / max(vc.r, 0.01)) * smoothstep(0.5, 0.9, vc.g / max(vc.b, 0.01) * 0.35);
          vec2 fc = vWPos.xz * 2.4;
          vec2 ci = floor(fc), cf = fract(fc);
          float h1 = fract(sin(dot(ci, vec2(127.1, 311.7))) * 43758.5453), h2 = fract(sin(dot(ci, vec2(269.5, 183.3))) * 43758.5453);
          float patchF = texture2D(map, vWPos.xz * 0.011 + vec2(0.53, 0.21)).g;
          float rr = length(cf - (vec2(h1, h2) * 0.6 + 0.2));
          float fw = fwidth(fc.x);
          float flw = (1.0 - smoothstep(0.1 - fw * 0.5, 0.125 + fw, rr)) * step(h1 * 0.8 + h2 * 0.2, smoothstep(0.38, 0.7, patchF) * 0.7);
          flw *= greenK * (1.0 - smoothstep(0.12, 0.3, fw)) * (1.0 - smoothstep(28.0, 48.0, dist));
          vec3 fcol = mix(vec3(0.34, 0.14, 0.56), vec3(0.55, 0.32, 0.8), h2);
          diffuseColor.rgb = mix(diffuseColor.rgb, fcol, flw);
          ${grassTex ? `
          {
            // v45: foto del prato (due scale, per non far vedere la ripetizione), sfuma con la distanza
            vec3 g1 = texture2D(grassMap, vWPos.xz * 0.31).rgb, g2 = texture2D(grassMap, vWPos.xz * 0.077 + vec2(0.37, 0.11)).rgb;
            vec3 grel = clamp(mix(g1, g2, 0.35) / grassMean, 0.0, 2.6);
            float gk = greenK * (1.0 - smoothstep(55.0, 150.0, dist)) * 0.85;
            diffuseColor.rgb *= mix(vec3(1.0), grel, gk);
          }` : ''}
          ${ss ? `
          {
            // v46: neve e sabbia fotografiche (due scale), sfumano con la distanza
            float fade = 1.0 - smoothstep(50.0, 140.0, dist);
            float vMin = min(vc.r, min(vc.g, vc.b)), vMax = max(vc.r, max(vc.g, vc.b));
            float snowK = smoothstep(0.62, 0.78, vMin) * smoothstep(0.2, 0.08, vMax - vMin);
            vec3 s1 = texture2D(snowMap, vWPos.xz * 0.27).rgb, s2 = texture2D(snowMap, vWPos.xz * 0.061 + vec2(0.21, 0.63)).rgb;
            vec3 srel = clamp(mix(s1, s2, 0.4) / snowMean, 0.0, 1.6);
            float sdk = smoothstep(0.45, 0.6, vc.r) * smoothstep(0.88, 0.75, vc.g / max(vc.r, 0.01)) * smoothstep(0.5, 0.36, vc.b / max(vc.r, 0.01));
            vec3 d1 = texture2D(sandMap, vWPos.xz * 0.29).rgb, d2 = texture2D(sandMap, vWPos.xz * 0.067 + vec2(0.57, 0.19)).rgb;
            vec3 drel = clamp(mix(d1, d2, 0.4) / sandMean, 0.0, 2.0);
            drel = mix(vec3(dot(drel, vec3(0.333))), drel, 0.35);   // tiene il colore del terreno, prende chiaroscuro e conchiglie
            diffuseColor.rgb *= mix(vec3(1.0), srel, snowK * fade * 0.9);
            diffuseColor.rgb *= mix(vec3(1.0), drel, sdk * fade * 0.85);
          }` : ''}
          // macchie un po' più gialle tra l'erba (erba secca e fiorita, come nel riferimento)
          diffuseColor.rgb *= mix(vec3(1.0), vec3(1.1, 1.04, 0.72), greenK * smoothstep(0.55, 0.85, patchF) * 0.35);
          // sabbia: increspature parallele, deformate e più marcate sui fianchi delle dune
          float sandK = smoothstep(0.45, 0.6, vc.r) * smoothstep(0.88, 0.75, vc.g / max(vc.r, 0.01)) * smoothstep(0.5, 0.36, vc.b / max(vc.r, 0.01));
          if (sandK > 0.01) {
            float warp = texture2D(map, vWPos.xz * 0.023).r * 6.0 + texture2D(map, vWPos.xz * 0.09).g * 1.5;
            float ph = dot(vWPos.xz, vec2(0.82, 0.57)) * 7.5 + warp * 3.0;
            float fwr = fwidth(ph);
            float rip = sin(ph) * (1.0 - smoothstep(0.8, 2.5, fwr));
            float rip2 = sin(dot(vWPos.xz, vec2(0.6, -0.8)) * 1.9 + warp) * (1.0 - smoothstep(0.8, 2.5, fwidth(dot(vWPos.xz, vec2(0.6, -0.8)) * 1.9)));
            diffuseColor.rgb *= 1.0 + sandK * (0.07 * rip + 0.05 * rip2);
          }
        }` : '#include <color_fragment>')
      .replace('#include <normal_fragment_maps>', bump ? `#include <normal_fragment_maps>
        {
          // micro-rilievo del terreno: pendenza della texture di dettaglio → normale inclinata
          vec2 uv = vWPos.xz * 0.17, uv2 = vWPos.xz * 0.071 + vec2(0.31, 0.67);
          float h0 = texture2D(map, uv).r, hx = texture2D(map, uv + vec2(0.012, 0.0)).r, hz = texture2D(map, uv + vec2(0.0, 0.012)).r;
          float g0 = texture2D(map, uv2).r, gx = texture2D(map, uv2 + vec2(0.01, 0.0)).r, gz = texture2D(map, uv2 + vec2(0.0, 0.01)).r;
          vec3 b = vec3(h0 - hx, 0.0, h0 - hz) * 1.6 * gdNear + vec3(g0 - gx, 0.0, g0 - gz) * 0.9 * (0.4 + 0.6 * gdNear);
          normal = normalize(normal + (viewMatrix * vec4(b, 0.0)).xyz);
        }` : '#include <normal_fragment_maps>');
  };
  mat.customProgramCacheKey = () => 'ground-' + near + '-' + far + '-' + amount + (bump ? 'b' : '') + (flora ? 'f36' : '') + (grassTex ? 'g45' : '') + (ss ? 's46' : '');
}

/** normal map affiancabile per l'acqua (somma di onde con frequenze intere) */
function makeWaterNormal() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', WRF), img = g.createImageData(S, S), d = img.data;
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

// ─────────────── decorazioni delle città tematiche (geometrie condivise, colori per vertice) ───────────────
const P = (geo, color, o = {}) => ({ geo, color, o });
const SPECIAL_GEO = {
  snowman: () => mergeParts([
    P(new THREE.IcosahedronGeometry(0.55, 1), '#f4f7fb', { y: 0.45, jit: 0.04 }),
    P(new THREE.IcosahedronGeometry(0.4, 1), '#f4f7fb', { y: 1.12, jit: 0.04 }),
    P(new THREE.IcosahedronGeometry(0.28, 1), '#f4f7fb', { y: 1.6, jit: 0.04 }),
    P(new THREE.ConeGeometry(0.06, 0.32, 5), '#f08a24', { y: 1.6, z: 0.36, rx: Math.PI / 2 }),
    P(new THREE.BoxGeometry(0.06, 0.06, 0.04), '#222222', { x: -0.1, y: 1.7, z: 0.24 }),
    P(new THREE.BoxGeometry(0.06, 0.06, 0.04), '#222222', { x: 0.1, y: 1.7, z: 0.24 }),
    P(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8), '#2a2a30', { y: 1.95 }),
    P(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), '#2a2a30', { y: 1.82 }),
    P(new THREE.TorusGeometry(0.3, 0.06, 4, 10), '#c83a3a', { y: 1.36, rx: Math.PI / 2 }),
    P(new THREE.BoxGeometry(0.05, 0.75, 0.05), '#5a3a20', { x: 0.55, y: 1.25, rz: -0.9 }),
    P(new THREE.BoxGeometry(0.05, 0.75, 0.05), '#5a3a20', { x: -0.55, y: 1.25, rz: 0.9 }),
  ], 901),
  waterTower: () => {
    const parts = [];
    for (const [x, z] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) parts.push(P(new THREE.BoxGeometry(0.25, 5.2, 0.25), '#6e4a2a', { x, y: 2.6, z }));
    parts.push(P(new THREE.BoxGeometry(2.6, 0.12, 0.15), '#6e4a2a', { y: 2.2, z: 1.2, rz: 0.9 }), P(new THREE.BoxGeometry(2.6, 0.12, 0.15), '#6e4a2a', { y: 2.2, z: -1.2, rz: -0.9 }));
    parts.push(P(new THREE.CylinderGeometry(1.8, 1.8, 2.6, 12), '#9a6a3a', { y: 6.5, colorFn: (nx, ny, nz, x, y) => (Math.abs(y - 5.6) < 0.12 || Math.abs(y - 7.4) < 0.12 ? '#3a3a3a' : null) }));
    parts.push(P(new THREE.ConeGeometry(2.0, 1.1, 12), '#6a4a2a', { y: 8.35 }));
    parts.push(P(new THREE.BoxGeometry(2.6, 0.15, 2.6), '#6e4a2a', { y: 5.2 }));
    return mergeParts(parts, 902);
  },
  umbrella: (c = 0) => {
    const cols = ['#e04848', '#2a8ad8', '#f0b030', '#3aa860'], cc = cols[c % 4];
    return mergeParts([
      P(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), '#f2f2f2', { y: 1.2 }),
      P(new THREE.ConeGeometry(1.5, 0.55, 10, 1, true), cc, { y: 2.45, colorFn: (nx, ny, nz, x, y, z) => (Math.floor((Math.atan2(z, x) + 3.15) / 0.628) % 2 ? '#f6f6f0' : cc) }),
      P(new THREE.BoxGeometry(0.7, 0.08, 1.6), '#f2e6c8', { x: 1.0, y: 0.25, z: 0.3, ry: 0.4 }),
    ], 903 + c);
  },
  silo: () => mergeParts([
    P(new THREE.CylinderGeometry(2, 2, 9, 14, 6), '#c9cdd2', { y: 4.5, colorFn: (nx, ny, nz, x, y, z, r) => (Math.abs(((y % 1.5) + 1.5) % 1.5) < 0.12 ? '#9aa0a6' : null) }),
    P(new THREE.SphereGeometry(2.05, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#b04032', { y: 9 }),
    P(new THREE.BoxGeometry(0.5, 9, 0.12), '#7a7f86', { x: 0, y: 4.5, z: 2.05 }),
  ], 904),
  stack: () => mergeParts([
    P(new THREE.CylinderGeometry(1.1, 1.6, 22, 12, 11), '#9a5a42', { y: 11, colorFn: (nx, ny, nz, x, y) => (y > 18.5 && y < 20.5 ? '#f2f2f2' : (y > 16.5 && y < 18.5 ? '#c83a32' : null)) }),
    P(new THREE.CylinderGeometry(1.25, 1.25, 0.4, 12), '#3a3a3a', { y: 22 }),
  ], 905),
  lighthouse: () => mergeParts([
    P(new THREE.CylinderGeometry(1.1, 1.7, 13, 12, 6), '#f4f4f0', { y: 6.5, colorFn: (nx, ny, nz, x, y) => (Math.floor(y / 2.2) % 2 ? '#d23a32' : null) }),
    P(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 12), '#3a3a3a', { y: 13.1 }),
    P(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 10), '#ffe9a0', { y: 13.9, noSky: true, jit: 0 }),
    P(new THREE.ConeGeometry(1.1, 1, 10), '#d23a32', { y: 15 }),
  ], 906),
  flag: (c = 0) => {
    const cols = ['#c83a3a', '#3a5ac8', '#e0b030', '#3aa860'];
    return mergeParts([
      P(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), '#3a3a3a', { y: 2 }),
      P(new THREE.BoxGeometry(1.8, 1.1, 0.05, 4, 1, 1), cols[c % 4], { x: 0.95, y: 3.4, colorFn: (nx, ny, nz, x) => (Math.abs(x - 0.95) < 0.18 ? '#f2f2f2' : null) }),
    ], 907 + c);
  },
};
Object.assign(SPECIAL_GEO, CITY_SPECIALS);
const _specialCache = new Map();
/**
 * Tetto a due falde: lastra spessa con colmo lungo x. half = mezza luce orizzontale (sporto compreso),
 * rise = altezza del colmo sopra la gronda, thick = spessore. y = 0 alla gronda (sotto).
 * Le uv sono in metri/2 come i box texturizzati.
 */
function gableRoofGeo(len, half, rise, thick) {
  const P = [], U = [], idx = [];
  const quad = (a, b, c, d, ua, ub, uc, ud) => {
    const o = P.length / 3;
    P.push(...a, ...b, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ud);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const L = len / 2, sl = Math.hypot(half, rise) / 2;
  for (const s of [-1, 1]) {
    const top = (x, zz) => [x, rise * (1 - zz / half) + thick, s * zz];
    const bot = (x, zz) => [x, rise * (1 - zz / half), s * zz];
    // facce ordinate in modo che la normale punti fuori (si corregge con s)
    const T = [top(-L, 0), top(L, 0), top(L, half), top(-L, half)];
    const Bt = [bot(-L, 0), bot(L, 0), bot(L, half), bot(-L, half)];
    const uT = [[-L / 2, sl], [L / 2, sl], [L / 2, 0], [-L / 2, 0]];
    if (s > 0) { quad(T[0], T[3], T[2], T[1], uT[0], uT[3], uT[2], uT[1]); quad(Bt[0], Bt[1], Bt[2], Bt[3], uT[0], uT[1], uT[2], uT[3]); }
    else { quad(T[0], T[1], T[2], T[3], uT[0], uT[1], uT[2], uT[3]); quad(Bt[0], Bt[3], Bt[2], Bt[1], uT[0], uT[3], uT[2], uT[1]); }
    // gronda (fascia)
    const e = [bot(-L, half), bot(L, half), top(L, half), top(-L, half)], ue = [[-L / 2, 0], [L / 2, 0], [L / 2, thick / 2], [-L / 2, thick / 2]];
    if (s > 0) quad(e[0], e[1], e[2], e[3], ue[0], ue[1], ue[2], ue[3]); else quad(e[0], e[3], e[2], e[1], ue[0], ue[3], ue[2], ue[1]);
    // bordi sulle testate (lungo la pendenza)
    for (const xe of [-1, 1]) {
      const q = [bot(xe * L, 0), bot(xe * L, half), top(xe * L, half), top(xe * L, 0)], uq = [[0, sl], [0, 0], [thick / 2, 0], [thick / 2, sl]];
      if (xe * s < 0) quad(q[0], q[1], q[2], q[3], uq[0], uq[1], uq[2], uq[3]); else quad(q[0], q[3], q[2], q[1], uq[0], uq[3], uq[2], uq[1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  ng.computeBoundingSphere();
  return ng;
}
/** timpano (muro triangolare sotto le falde), spessore t, nel piano zy, base a y = 0 */
function gableEndGeo(wallHalf, half, rise, t) {
  const top = (zz) => rise * (1 - zz / half);
  const sh = new THREE.Shape();
  sh.moveTo(-wallHalf, 0); sh.lineTo(wallHalf, 0); sh.lineTo(wallHalf, top(wallHalf)); sh.lineTo(0, rise); sh.lineTo(-wallHalf, top(wallHalf)); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  g.rotateY(Math.PI / 2);
  return g;
}
/** colmo: trave arrotondata lungo x */
function ridgeGeo(len) { const g = new THREE.CylinderGeometry(0.13, 0.13, len, 8); g.rotateZ(Math.PI / 2); return g; }

function specialGeo(type, c = 0) {
  const key = type + ':' + (c || 0);
  if (!_specialCache.has(key)) _specialCache.set(key, SPECIAL_GEO[type](c || 0));
  return _specialCache.get(key);
}

// ═════════════════════════ COSTRUZIONE ═════════════════════════
/** costruisce l'isola tutta di fila (cambio di mappa a partita già avviata) */
export function buildWorld(scene, opts = {}) {
  const steps = buildWorldSteps(scene, opts);
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}
/**
 * v49: costruisce l'isola a sezioni lasciando respirare il browser fra l'una e l'altra (al massimo `budget` ms di fila):
 * sul telefono la schermata "Costruzione dell'isola" restava congelata per molti secondi e sembrava bloccata.
 * onStep(frazione 0..1) aggiorna la barra di caricamento.
 */
export async function buildWorldAsync(scene, opts = {}, onStep = null, budget = 50) {
  const steps = buildWorldSteps(scene, opts);
  let k = 0, t = performance.now();
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
    k++;
    if (window.__trace) window.__trace('isola: ' + r.value);   // v50: registro dei passi (diagnostica sul telefono)
    if (performance.now() - t > budget) {
      if (onStep) onStep(Math.min(1, k / BUILD_STEPS));
      await new Promise(res => setTimeout(res, 0));   // (niente requestAnimationFrame: con la scheda in background si fermerebbe)
      t = performance.now();
    }
  }
}
const BUILD_STEPS = 22;
function* buildWorldSteps(scene, opts = {}) {
  configureMap(opts.seed ?? 1337, !!opts.random);
  yield 'mappa pronta';
  const lootSpots = [];
  const chestSpots = [];
  const houses = [];

  yield 'griglia dei chunk';
  // ── griglia dei chunk ──
  const NC = Math.ceil(EDGE / CHUNK);            // chunk per lato da 0 al bordo
  const chunks = new Map();
  const chunkKey = (cx, cz) => cx + ',' + cz;
  for (let cx = -NC; cx < NC; cx++) for (let cz = -NC; cz < NC; cz++) {
    chunks.set(chunkKey(cx, cz), { cx, cz, x0: cx * CHUNK, z0: cz * CHUNK, boxes: [], doors: [], trees: [], rocks: [], bushes: [], specials: [], houses: [], props: [], detail: null, lod: null, state: 0 });
  }
  const chunkAt = (x, z) => chunks.get(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)));

  yield 'materiali';
  // ── materiali ──
  const wallColors = ['#e8dcc0', '#d9b48a', '#c9d6df', '#e6c3b0', '#cfe0c0', '#f0e0a0'];
  const texMat = (t, opts = {}) => {
    // v45: intonaco fotografico condiviso, colore della casa come tinta del materiale
    if (t.isTexProxy) return new THREE.MeshStandardMaterial({ map: t.tex, normalMap: t.tex.userData.normal || null, normalScale: new THREE.Vector2(0.9, 0.9), color: new THREE.Color(t.tint).multiplyScalar(t.tintK), ...opts });
    return new THREE.MeshStandardMaterial({ map: t, normalMap: t.userData.normal || null, normalScale: new THREE.Vector2(0.9, 0.9), ...opts });
  };
  const wallMats = wallColors.map(c => texMat(makeWallTexture(c, 'rgba(0,0,0,0.12)'), { roughness: 0.9 }));
  const roofColors = ['#a33b2a', '#5a5f6a', '#3b5a8a', '#7a4a2a'];
  const roofMats = roofColors.map(c => texMat(makeRoofTexture(c), { roughness: 0.72 }));
  const stoneMat = texMat(makeStoneWallTexture(), { roughness: 0.95 });
  const trimMat = m('trim', '#f1ede2');
  const brickMat = texMat(makeBrickTexture(), { roughness: 0.9 });
  const capMat = m('cap', '#55575c');
  const shutterColors = ['#3f6e4a', '#3c5f8a', '#7a4a2a', '#8a3a3a', '#5f6a3a'];
  const shutterMats = shutterColors.map(c => m('shut' + c, c));
  const matMat = m('doormat', '#7a3b2a');
  // v25: soffitti (luce di rimbalzo simulata: altrimenti la luce emisferica dal basso li tinge di verde scuro)
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.95, emissive: '#b8b2a6', emissiveIntensity: 0.32 });
  const ceilLampMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.4, emissive: '#fff4dc', emissiveIntensity: 0.9 });
  const floorMat = texMat(makeParquetTexture(), { roughness: 0.62 });
  yield 'arredi degli interni';
  // ── arredi degli interni (v21) ──
  const fabricTex = makeFabricTexture();
  const fab = (c) => texMat(fabricTex, { color: c, roughness: 0.95 });
  const sofaMats = ['#6a8fb0', '#a8584a', '#5f7a4e', '#c8a46a', '#7a6a9a'].map(fab);
  const blanketMats = ['#c8443a', '#3a6ab0', '#e0b040', '#4a8a5a', '#d87aa0'].map(fab);
  const linenMat = fab('#f2f0ea'), cushionMat = fab('#efe4cf');
  const furnWoodMats = [texMat(makeParquetTexture(), { color: '#d9b48a', roughness: 0.7 }), texMat(makeParquetTexture(), { color: '#8a6040', roughness: 0.7 })];
  const darkWoodMat = m('darkwood', '#4a3020', { roughness: 0.7 });
  const counterTopMat = m('counterTop', '#d8d4cc', { roughness: 0.35 });
  const cabinetMats = ['#f0ece2', '#9ab8a8', '#c8d8e8', '#e8d0a8'].map(c => m('cab' + c, c, { roughness: 0.6 }));
  const steelMat = m('steel', '#b8bcc2', { metalness: 0.7, roughness: 0.35 });
  const blackMat = m('blackApp', '#1a1b1e', { roughness: 0.4 });
  const screenMat = m('screen', '#0e1a2a', { roughness: 0.15, metalness: 0.3, emissive: '#1a3a5a', emissiveIntensity: 0.35 });
  const lampShadeMat = m('lampShade', '#fff2d8', { emissive: '#ffd9a0', emissiveIntensity: 0.75, roughness: 0.9 });
  const fireMat = m('fireGlow', '#ff8a2a', { emissive: '#ff6a10', emissiveIntensity: 1.6, roughness: 1 });
  const sootMat = m('soot', '#1c1816', { roughness: 1 });
  const potMat = m('pot', '#b8603a', { roughness: 0.9 }), leafMat = m('leafIn', '#3f7a3a', { roughness: 0.8 });
  const bookMats = ['#8a2a2a', '#2a4a7a', '#3a6a3a', '#c8a040', '#5a3a6a', '#d8d0c0', '#1f1f24'].map(c => m('book' + c, c, { roughness: 0.75 }));
  const rugMats = [['#8a2a2a', '#e8c890', '#2a3a5a'], ['#2a4a6a', '#d8c8a0', '#8a3a2a'], ['#5a6a3a', '#efe0b8', '#7a3a2a']].map(([a, b, c]) => texMat(makeRugTexture(a, b, c), { roughness: 1 }));
  const paintMats = [0, 1, 2, 3].map(k => new THREE.MeshStandardMaterial({ map: makePaintingTexture(k), roughness: 0.8 }));
  const frameMat = m('picFrame', '#a8823a', { metalness: 0.4, roughness: 0.45 });
  const doorMats = ['#7a4a2a', '#3f6e4a', '#3c5f8a', '#8a3a3a', '#e8e0d0'].map(c => texMat(makeDoorTexture(c), { roughness: 0.7 }));
  const knobMat = m('knob', '#d8b04a', { metalness: 0.85, roughness: 0.3 });
  const doors = [];
  const woodTex = makeWoodTexture();
  const crateMat = texMat(woodTex, { roughness: 0.88, normalScale: new THREE.Vector2(1.0, 1.0) });
  const metalMat = m('metal', '#6a6f78', { metalness: 0.6, roughness: 0.4 });
  const contColors = ['#c0392b', '#2471a3', '#d68910', '#1e8449'];
  const containerMats = contColors.map(c => m('cont' + c, c, { metalness: 0.4, roughness: 0.6 }));
  const contFrameMats = contColors.map(c => m('contF' + c, '#' + new THREE.Color(c).multiplyScalar(0.62).getHexString(), { metalness: 0.5, roughness: 0.55 }));
  yield 'città tematiche';
  // ── città tematiche: tavolozze di muri e tetti (materiali creati solo per i temi presenti) ──
  const THEMES = {
    classic: { walls: wallColors, roofs: roofColors },
    alpine: { walls: ['#8a5a32', '#a06a3a', '#efe8dc'], roofs: ['#5a3a24', '#4a4f5a'], snowRoof: true },
    western: { walls: ['#c89a62', '#b9824e', '#d8b27a'], roofs: ['#7a5230', '#8a6a44'], facade: true },
    coastal: { walls: ['#f4b6a8', '#a8d8e8', '#f6e3a1', '#f7f4ee'], roofs: ['#c8643a', '#3a7ab8'], awning: true },
    farm: { walls: ['#a83a2a', '#b84a32', '#efe6d2'], roofs: ['#4a4f5a', '#6a3a2a'] },
    industrial: { walls: ['#8f969c', '#a0a6aa', '#9a6a4a'], roofs: ['#5a5f6a', '#3f444c'], bigChimney: true },
    port: { walls: ['#8fa4b4', '#c9d6df', '#e8dcc0'], roofs: ['#3b5a8a', '#5a5f6a'], bigChimney: true },
    castle: { walls: ['stone'], roofs: ['#4a4f5a', '#3b3f48'], merlons: true },
  };
  const wallCache = new Map(wallColors.map((c, i) => [c, wallMats[i]])), roofCache = new Map(roofColors.map((c, i) => [c, roofMats[i]]));
  wallCache.set('stone', stoneMat);
  const wallMatFor = (c) => { if (!wallCache.has(c)) wallCache.set(c, texMat(makeWallTexture(c, 'rgba(0,0,0,0.12)'), { roughness: 0.9 })); return wallCache.get(c); };
  const roofMatFor = (c) => { if (!roofCache.has(c)) roofCache.set(c, texMat(makeRoofTexture(c), { roughness: 0.72 })); return roofCache.get(c); };
  const snowMat = m('snowroof', '#e2e8f0', { roughness: 1 });
  const signMat = m('sign', '#5a3a1e');
  const awningMats = ['#e04848', '#2a8ad8', '#f0b030', '#3aa860'].map(c => m('awn' + c, c));
  const hayMat = m('hay', '#e2c25a', { roughness: 1 });
  const fenceMat = m('fence', '#a37a4a');
  const groundDetail = makeGroundDetail();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  addGroundDetail(terrainMat, groundDetail, 70, 260, 1, NORMALS, true);
  const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  addGroundDetail(lodMat, groundDetail, 0, 1, 0.7);
  const blockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

  /** Registra un box: il collisore subito, la mesh quando il chunk viene generato */
  /** cassa di legno con i 12 spigoli rinforzati in rilievo */
  const crateEdgeMat = m('crateEdge', '#6a4220', { roughness: 0.9 });
  function addCrate(w, h, d, x, y, z, opts = {}) {
    const b = addBox(w, h, d, x, y, z, crateMat, opts);
    const e = Math.min(w, h, d) * 0.11, o = { house: opts.house, collide: false, cast: false };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(e, h + 0.02, e, x + sx * (w / 2 - e / 2 + 0.01), y, z + sz * (d / 2 - e / 2 + 0.01), crateEdgeMat, o);
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) addBox(w + 0.02, e, e, x, y + sy * (h / 2 - e / 2 + 0.01), z + sz * (d / 2 - e / 2 + 0.01), crateEdgeMat, o);
      for (const sx of [-1, 1]) addBox(e, e, d - e * 2, x + sx * (w / 2 - e / 2 + 0.01), y + sy * (h / 2 - e / 2 + 0.01), z, crateEdgeMat, o);
    }
    return b;
  }
  /** geometria su misura (tetti a falde, timpani): solo grafica, sparisce col tetto se roof */
  function addGeo(geo, x, y, z, material, opts = {}) {
    const spec = { geo, w: 0, h: 0, d: 0, x, y, z, material, cast: opts.cast !== false, house: opts.house, roof: opts.roof, mesh: null, rotY: opts.rotY || 0 };
    chunkAt(x, z).boxes.push(spec);
    return spec;
  }
  function addBox(w, h, d, x, y, z, material, opts = {}) {
    const spec = { w, h, d, x, y, z, material, cast: opts.cast !== false, lodColor: opts.lodColor, house: opts.house, roof: opts.roof, mesh: null };
    chunkAt(x, z).boxes.push(spec);
    if (opts.collide !== false) {
      spec.c = addCollider({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2, noStand: opts.noStand });
      spec.c.spec = spec;
    }
    return spec;
  }

  yield 'porte';
  // ── porte: collisore solo quando sono chiuse; le ante vengono animate dal gioco ──
  function setDoor(dr, open, silent = false) {
    if (dr.broken) return false;
    if (dr.open === open && !silent) return false;
    dr.open = open;
    if (open && dr.cOn) { removeCollider(dr.c); dr.cOn = false; }
    if (!open && !dr.cOn) { addCollider(dr.c); dr.cOn = true; }
    if (silent) dr.ang = open ? 1 : 0;
    return true;
  }
  const leafGeoCache = new Map();
  function leafGeo(lw, lh) {
    const k = lw.toFixed(2) + '|' + lh.toFixed(2);
    if (!leafGeoCache.has(k)) { const g = new THREE.BoxGeometry(lw, lh, 0.07).translate(lw / 2, lh / 2, 0); g.userData.shared = true; leafGeoCache.set(k, g); }
    return leafGeoCache.get(k);
  }
  const knobGeo = new THREE.SphereGeometry(0.045, 10, 8); knobGeo.userData.shared = true;
  const plateGeo = new THREE.BoxGeometry(0.06, 0.2, 0.01); plateGeo.userData.shared = true;
  // v43: maniglie e placche delle due facce fuse in un solo pezzo (prima 4 draw call per anta, ora 1)
  const hwCache = new Map();
  function hardwareGeo(lw) {
    const k = lw.toFixed(2);
    if (!hwCache.has(k)) {
      const parts = [];
      for (const zs of [-1, 1]) {
        parts.push(knobGeo.clone().translate(lw - 0.11, 1.0, zs * 0.07));
        parts.push(plateGeo.clone().toNonIndexed().translate(lw - 0.11, 1.0, zs * 0.04));
      }
      const g = mergeGeometries(parts.map(q => q.index ? q.toNonIndexed() : q)); g.userData.shared = true;
      hwCache.set(k, g);
    }
    return hwCache.get(k);
  }
  /** costruisce le due ante (pivot sui cardini) quando il chunk diventa visibile */
  function buildDoorLeaves(dr, group) {
    const lw2 = dr.gap / 2 - 0.03, lh = dr.lh || 2.36;
    const tx = dr.horiz ? 1 : 0, tz = dr.horiz ? 0 : 1;   // direzione lungo il muro
    dr.leaves = [];
    const single = dr.single, lwS = dr.gap - 0.03;
    for (const sgn of single ? [-1] : [-1, 1]) {
      // cardine all'estremità del vano; l'asse x locale punta verso il centro della porta
      const hx = dr.x + tx * sgn * (dr.gap / 2 - 0.01), hz = dr.z + tz * sgn * (dr.gap / 2 - 0.01);
      const lw = single ? lwS : lw2;
      const dx = -tx * sgn, dz = -tz * sgn;
      const base = Math.atan2(-dz, dx);
      const lzx = Math.sin(base), lzz = Math.cos(base);
      const into = (lzx * dr.nx + lzz * dr.nz) > 0 ? 1 : -1;   // verso di apertura: sempre verso l'interno
      const piv = new THREE.Group();
      piv.position.set(hx, dr.y, hz);
      const leaf = new THREE.Mesh(leafGeo(lw, lh), dr.mat);
      leaf.castShadow = true; leaf.receiveShadow = true;
      piv.add(leaf);
      const hw = new THREE.Mesh(hardwareGeo(lw), knobMat); piv.add(hw);
      piv.userData = { base, into, hw };
      group.add(piv);
      dr.leaves.push(piv);
    }
    poseDoor(dr);
  }
  function poseDoor(dr) {
    if (!dr.leaves) return;
    const e = dr.ang * dr.ang * (3 - 2 * dr.ang);
    for (const piv of dr.leaves) piv.rotation.y = piv.userData.base + piv.userData.into * e * 1.72;
  }

  yield 'arredamento degli interni';
  // ── arredamento degli interni ──
  const WALL_T = 0.35;
  /** box appoggiato alla faccia interna di un muro: u lungo il muro, dist dalla parete */
  function inner(s, u, dist, y, lu, lh, ld, mat, opts = { collide: false, cast: false }) {
    const o = WALL_T / 2 + dist + ld / 2, n = s.n;
    if (s.horiz) return addBox(lu, lh, ld, s.x + u, y, s.z - n[1] * o, mat, opts);
    return addBox(ld, lh, lu, s.x - n[0] * o, y, s.z + u, mat, opts);
  }
  const geoCache = new Map();
  const cgeo = (k, f) => { if (!geoCache.has(k)) { const g = f(); g.userData.shared = true; geoCache.set(k, g); } return geoCache.get(k); };
  function furnish(house, sides, baseY, H, T, theme, fo = {}) {
    const F = fo.F || (house.furn = []);
    const fy = baseY + 0.2;
    const at = (s, u, dist) => s.horiz ? [s.x + u, s.z - s.n[1] * (T / 2 + dist)] : [s.x - s.n[0] * (T / 2 + dist), s.z + u];
    // v41: mobili in scala con i personaggi (K): ogni pezzo si ingrandisce attorno al centro del mobile (U0)
    const K = fo.k ?? 1.12;
    let U0 = 0;
    const su = (u) => U0 + (u - U0) * K;
    const reg = (s, u, lu, ld, dist = 0) => { const [x, z] = at(s, su(u), (dist + ld / 2) * K); lu *= K; ld *= K; F.push(s.horiz ? { x, z, hw: lu / 2, hd: ld / 2 } : { x, z, hw: ld / 2, hd: lu / 2 }); };
    const fb = (s, u, dist, y0, lu, lh, ld, mat) => {
      const y = y0 * K; let h = lh * K;
      if (y + h > H - 0.22) h = Math.max(0.01, H - 0.22 - y);   // niente mobili dentro il soffitto (piani da 3 m)
      inner(s, su(u), dist * K, fy + y + h / 2, lu * K, h, ld * K, mat, { house, collide: false, cast: h > 0.25 && lu > 0.2 });
    };
    const col = (s, u, lu, ld, h, dist = 0) => {
      const [x, z] = at(s, su(u), (dist + ld / 2) * K);
      lu *= K; ld *= K;
      const hw = s.horiz ? lu / 2 : ld / 2, hd = s.horiz ? ld / 2 : lu / 2;
      addCollider({ type: 'box', minX: x - hw, maxX: x + hw, minY: fy, maxY: fy + Math.min(h * K, H - 0.25), minZ: z - hd, maxZ: z + hd });
    };
    const rotFor = (s) => s.horiz ? (s.n[1] < 0 ? 0 : Math.PI) : (s.n[0] < 0 ? Math.PI / 2 : -Math.PI / 2);
    const wood = furnWoodMats[Math.floor(srand() * furnWoodMats.length)];
    const sofaM = sofaMats[Math.floor(srand() * sofaMats.length)], blanketM = blanketMats[Math.floor(srand() * blanketMats.length)];
    const cabM = cabinetMats[Math.floor(srand() * cabinetMats.length)];
    const store = theme === 'industrial' || theme === 'port';
    // passaggio libero davanti alle porte
    for (const s of sides) if (s.door) reg(s, 0, 2.6, 2.4);

    const items = {
      bed: { D: 2.05, L: 0, tall: false, make(s, u) {
        const L = this.w, D = 2.05, bu = u - 0.28;
        fb(s, bu, 0, 0, L, 0.32, D, wood); col(s, bu, L, D, 0.5);
        fb(s, bu, 0.05, 0.32, L - 0.08, 0.17, D - 0.1, linenMat);
        fb(s, bu, 0.62, 0.47, L - 0.02, 0.07, D - 0.66, blanketM);
        fb(s, bu, 0.5, 0.49, L - 0.04, 0.06, 0.14, linenMat);
        if (L > 1.2) for (const k of [-1, 1]) fb(s, bu + k * L / 4, 0.1, 0.49, L / 2 - 0.12, 0.13, 0.36, cushionMat);
        else fb(s, bu, 0.1, 0.49, L - 0.2, 0.13, 0.36, cushionMat);
        fb(s, bu, 0, 0, L + 0.08, 1.05, 0.08, wood); fb(s, bu, 0, 1.05, L + 0.14, 0.05, 0.11, darkWoodMat);
        fb(s, bu, D - 0.06, 0, L + 0.04, 0.6, 0.06, wood);
        // comodino con lampada
        const nu = bu + L / 2 + 0.3;
        fb(s, nu, 0, 0, 0.46, 0.52, 0.42, wood); fb(s, nu, 0.42, 0.3, 0.3, 0.03, 0.012, darkWoodMat);
        { const [lx, lz] = at(s, su(nu), 0.21 * K); addGeo(cgeo('lampS', () => new THREE.CylinderGeometry(0.1, 0.15, 0.2, 10)), lx, fy + 0.52 * K + 0.1, lz, lampShadeMat, { house, cast: false }); }
        fb(s, nu, 0.17, 0.52, 0.08, 0.17, 0.08, steelMat);
        reg(s, u, L + 0.56, D);
      } },
      sofa: { D: 1.95, L: 2.1, make(s, u) {
        const L = 2.0, D = 0.88;
        fb(s, u, 0, 0.08, L, 0.3, D, sofaM); col(s, u, L, D, 0.5);
        for (const a of [-1, 1]) for (const b of [0, 1]) fb(s, u + a * (L / 2 - 0.08), b ? D - 0.1 : 0.04, 0, 0.06, 0.08, 0.06, darkWoodMat);
        for (let k = -1; k <= 1; k++) fb(s, u + k * (L - 0.4) / 3, 0.2, 0.38, (L - 0.4) / 3 - 0.03, 0.13, D - 0.24, sofaM);
        fb(s, u, 0, 0.38, L, 0.5, 0.2, sofaM);
        for (const k of [-1, 1]) fb(s, u + k * (L / 4 - 0.05), 0.18, 0.51, L / 2 - 0.25, 0.32, 0.12, sofaM);
        for (const k of [-1, 1]) fb(s, u + k * (L / 2 - 0.1), 0, 0.38, 0.2, 0.24, D, sofaM);
        fb(s, u - L / 2 + 0.38, 0.3, 0.5, 0.36, 0.3, 0.12, blanketM);
        // tavolino da salotto con riviste
        fb(s, u, D + 0.42, 0.38, 1.1, 0.05, 0.6, wood); col(s, u, 1.1, 0.6, 0.43, D + 0.42);
        for (const a of [-1, 1]) for (const b of [0, 1]) fb(s, u + a * 0.5, D + 0.45 + b * 0.5, 0, 0.05, 0.38, 0.05, darkWoodMat);
        fb(s, u + 0.2, D + 0.6, 0.43, 0.28, 0.02, 0.2, bookMats[Math.floor(srand() * bookMats.length)]);
        reg(s, u, L, D + 1.05);
      } },
      shelf: { D: 0.36, L: 1.6, tall: true, make(s, u) {
        const L = 1.5, D = 0.36, HH = 2.0;
        fb(s, u, 0, 0, L, HH, 0.03, darkWoodMat); col(s, u, L, D, HH);
        for (const k of [-1, 1]) fb(s, u + k * (L / 2 - 0.025), 0, 0, 0.05, HH, D, store ? steelMat : wood);
        const lv = [0.04, 0.46, 0.88, 1.3, 1.72];
        for (const y of lv) fb(s, u, 0, y, L - 0.1, 0.04, D, store ? steelMat : wood);
        fb(s, u, 0, HH, L + 0.06, 0.05, D + 0.04, store ? steelMat : wood);
        for (const y of lv) {
          if (store) {
            let c = u - L / 2 + 0.1;
            while (c < u + L / 2 - 0.35) { const bw = sr(0.25, 0.42), bh = sr(0.18, 0.36); if (srand() < 0.8) fb(s, c + bw / 2, 0.04, y + 0.04, bw, bh, D - 0.08, srand() < 0.6 ? crateMat : cabinetMats[1]); c += bw + 0.04; }
            continue;
          }
          let c = u - L / 2 + 0.06 + srand() * 0.2;
          while (c < u + L / 2 - 0.12) {
            if (srand() < 0.12) { c += sr(0.1, 0.3); continue; }
            const n = 3 + Math.floor(srand() * 7), mat = bookMats[Math.floor(srand() * bookMats.length)];
            for (let i = 0; i < n && c < u + L / 2 - 0.1; i++) {
              const bw = sr(0.03, 0.06), bh = sr(0.24, 0.36);
              fb(s, c + bw / 2, 0.05, y + 0.04, bw, bh, sr(0.2, 0.27), srand() < 0.75 ? mat : bookMats[Math.floor(srand() * bookMats.length)]);
              c += bw + 0.004;
            }
            c += sr(0.02, 0.12);
          }
        }
        reg(s, u, L, D);
      } },
      wardrobe: { D: 0.6, L: 1.3, tall: true, make(s, u) {
        const L = 1.2, D = 0.6, HH = 2.1, M = store ? steelMat : wood;
        fb(s, u, 0, 0.06, L, HH - 0.06, D, M); col(s, u, L, D, HH);
        fb(s, u, 0.04, 0, L - 0.08, 0.06, D - 0.08, darkWoodMat);
        fb(s, u, 0, HH, L + 0.08, 0.06, D + 0.05, store ? steelMat : darkWoodMat);
        fb(s, u, D, 0.1, 0.015, HH - 0.2, 0.01, darkWoodMat);
        for (const k of [-1, 1]) {
          fb(s, u + k * 0.07, D, 1.0, 0.025, 0.22, 0.03, store ? blackMat : knobMat);
          fb(s, u + k * L / 4, D, 0.2, L / 2 - 0.16, HH - 0.5, 0.008, store ? blackMat : darkWoodMat);
        }
        reg(s, u, L, D);
      } },
      kitchen: { D: 0.62, L: 2.5, make(s, u, win) {
        const L = 2.4, D = 0.62;
        fb(s, u, 0, 0.08, L, 0.8, D - 0.02, cabM); col(s, u, L, D, 0.93);
        fb(s, u, 0.04, 0, L - 0.04, 0.08, D - 0.08, blackMat);
        for (let k = 1; k < 4; k++) fb(s, u - L / 2 + k * L / 4, D - 0.02, 0.12, 0.012, 0.72, 0.012, darkWoodMat);
        for (let k = 0; k < 4; k++) fb(s, u - L / 2 + (k + 0.5) * L / 4, D - 0.02, 0.76, 0.2, 0.025, 0.03, steelMat);
        fb(s, u, 0, 0.88, L + 0.04, 0.05, D + 0.03, counterTopMat);
        const us = u - L / 4, ut = u + L / 4;
        fb(s, us, 0.1, 0.93, 0.56, 0.012, 0.4, steelMat); fb(s, us, 0.15, 0.925, 0.44, 0.01, 0.3, blackMat);
        fb(s, us, 0.03, 0.93, 0.05, 0.3, 0.05, steelMat); fb(s, us, 0.03, 1.2, 0.04, 0.04, 0.18, steelMat);
        fb(s, ut, 0.06, 0.93, 0.6, 0.015, 0.5, blackMat);
        for (const a of [-1, 1]) for (const b of [0, 1]) fb(s, ut + a * 0.14, 0.14 + b * 0.24, 0.945, 0.15, 0.008, 0.15, steelMat);
        fb(s, ut, D - 0.02, 0.6, 0.5, 0.012, 0.012, steelMat);
        if (!win) {
          fb(s, u, 0, 0.94, L, 0.52, 0.015, m('tile', '#e8eef0', { roughness: 0.3 }));
          fb(s, u, 0, 1.48, L, 0.68, 0.34, cabM);
          for (let k = 1; k < 4; k++) fb(s, u - L / 2 + k * L / 4, 0.34, 1.5, 0.012, 0.64, 0.012, darkWoodMat);
          fb(s, ut, 0, 1.4, 0.64, 0.08, 0.42, steelMat);
        }
        // piatti, pentola e tagliere
        fb(s, ut - 0.14, 0.14, 0.955, 0.24, 0.16, 0.24, steelMat);
        fb(s, us - 0.45, 0.12, 0.93, 0.36, 0.02, 0.24, wood);
        reg(s, u, L, D);
      } },
      tv: { D: 0.42, L: 1.6, make(s, u) {
        fb(s, u, 0, 0, 1.5, 0.5, 0.42, darkWoodMat); col(s, u, 1.5, 0.42, 0.5);
        fb(s, u, 0.42, 0.08, 0.66, 0.3, 0.008, wood);
        fb(s, u, 0.1, 0.5, 0.32, 0.03, 0.2, blackMat); fb(s, u, 0.18, 0.53, 0.06, 0.08, 0.04, blackMat);
        fb(s, u, 0.1, 0.6, 1.16, 0.68, 0.06, blackMat);
        fb(s, u, 0.16, 0.64, 1.08, 0.6, 0.004, screenMat);
        reg(s, u, 1.5, 0.42);
      } },
      desk: { D: 1.25, L: 1.4, make(s, u) {
        const L = 1.3, D = 0.65;
        fb(s, u, 0, 0.72, L, 0.04, D, wood); col(s, u, L, D, 0.76);
        for (const a of [-1, 1]) for (const b of [0, 1]) fb(s, u + a * (L / 2 - 0.05), 0.03 + b * (D - 0.1), 0, 0.05, 0.72, 0.05, darkWoodMat);
        fb(s, u + 0.35, 0, 0.42, 0.5, 0.3, D - 0.04, wood);
        fb(s, u - 0.15, 0.22, 0.76, 0.36, 0.02, 0.25, blackMat); fb(s, u - 0.15, 0.1, 0.76, 0.36, 0.24, 0.015, blackMat);
        fb(s, u - 0.15, 0.115, 0.78, 0.32, 0.2, 0.004, screenMat);
        fb(s, u + 0.35, 0.25, 0.76, 0.22, 0.015, 0.3, linenMat);
        chair(s, u, D + 0.15);
        reg(s, u, L, D + 0.6);
      } },
      fireplace: { D: 1.2, L: 1.9, tall: true, make(s, u) {
        const L = 1.8, D = 0.6;
        fb(s, u, 0, 0, L, 1.25, D, stoneMat); col(s, u, L, D + 0.1, 1.3);
        fb(s, u, D, 0.1, 0.96, 0.78, 0.012, sootMat);
        fb(s, u, D + 0.012, 0.12, 0.62, 0.05, 0.01, darkWoodMat);
        fb(s, u, D + 0.014, 0.16, 0.46, 0.26, 0.008, fireMat);
        fb(s, u, D + 0.016, 0.42, 0.22, 0.14, 0.006, fireMat);
        fb(s, u, 0, 1.25, L + 0.2, 0.08, D + 0.12, darkWoodMat);
        fb(s, u, 0, 1.33, L - 0.4, H - 0.2 - 1.33, D - 0.2, stoneMat);
        fb(s, u - 0.5, D - 0.12 + 0.06, 1.33, 0.12, 0.2, 0.12, potMat);
        fb(s, u + 0.45, D - 0.12 + 0.04, 1.33, 0.3, 0.22, 0.05, frameMat);
        fb(s, u, D, 0, L + 0.3, 0.03, 0.6, stoneMat);
        reg(s, u, L + 0.3, D + 0.6);
      } },
      plant: { D: 0.5, L: 0.6, make(s, u) {
        fb(s, u, 0.08, 0, 0.36, 0.38, 0.36, potMat); fb(s, u, 0.06, 0.36, 0.4, 0.05, 0.4, potMat);
        const [x, z] = at(s, su(u), 0.26 * K);
        addGeo(cgeo('plantA', () => new THREE.IcosahedronGeometry(0.36, 0)), x, fy + 0.85 * K, z, leafMat, { house });
        addGeo(cgeo('plantB', () => new THREE.IcosahedronGeometry(0.26, 0)), x + 0.1, fy + 1.2 * K, z - 0.05, leafMat, { house });
        fb(s, u, 0.24, 0.4, 0.04, 0.4, 0.04, darkWoodMat);
        reg(s, u, 0.5, 0.5);
      } },
      lamp: { D: 0.4, L: 0.5, tall: true, make(s, u) {
        fb(s, u, 0.12, 0, 0.3, 0.03, 0.3, blackMat); fb(s, u, 0.25, 0.03, 0.035, 1.4, 0.035, steelMat);
        const [x, z] = at(s, su(u), 0.27 * K);
        addGeo(cgeo('lampF', () => new THREE.CylinderGeometry(0.16, 0.24, 0.3, 12)), x, fy + 1.43 * K + 0.15, z, lampShadeMat, { house, cast: false });
        reg(s, u, 0.4, 0.4);
      } },
    };
    function chair(s, u, dist) {
      fb(s, u, dist, 0.44, 0.44, 0.05, 0.44, wood);
      for (const a of [-1, 1]) for (const b of [0, 1]) fb(s, u + a * 0.18, dist + 0.02 + b * 0.36, 0, 0.04, 0.44, 0.04, darkWoodMat);
      fb(s, u, dist + 0.4, 0.49, 0.44, 0.48, 0.04, wood);
      fb(s, u, dist + 0.05, 0.49, 0.38, 0.04, 0.34, cushionMat);
    }
    const bags = {
      alpine: ['fireplace', 'bed', 'kitchen', 'wardrobe', 'shelf', 'sofa', 'plant'],
      castle: ['fireplace', 'bed', 'shelf', 'wardrobe', 'shelf', 'lamp'],
      western: ['kitchen', 'shelf', 'bed', 'fireplace', 'desk', 'lamp'],
      farm: ['kitchen', 'fireplace', 'bed', 'wardrobe', 'sofa', 'plant'],
      industrial: ['shelf', 'desk', 'wardrobe', 'shelf', 'kitchen', 'lamp'],
      port: ['shelf', 'desk', 'wardrobe', 'shelf', 'sofa', 'plant'],
    };
    const bag = (bags[theme] || ['bed', 'kitchen', 'sofa', 'shelf', 'tv', 'wardrobe', 'desk', 'plant', 'lamp']).slice();
    // ordine: il primo resta (stanza tipica del tema), il resto mescolato
    for (let i = bag.length - 1; i > 1; i--) { const j = 1 + Math.floor(srand() * i); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    items.bed.w = srand() < 0.5 ? 1.0 : 1.55; items.bed.L = items.bed.w + 0.62;
    const walls = sides.filter(s => !s.door);
    for (let i = walls.length - 1; i > 0; i--) { const j = Math.floor(srand() * (i + 1)); [walls[i], walls[j]] = [walls[j], walls[i]]; }
    let placed = 0;
    const maxItems = fo.max ?? 3 + Math.floor(srand() * 3);
    const winHit = (s, a, b) => s.win && a < 1.18 && b > -1.18;
    const pics = [];
    for (const s of walls) {
      const umin = -s.len / 2 + T + 0.06, umax = s.len / 2 - T - 0.06;
      let cur = umin + srand() * 0.25, guard = 0;
      while (cur < umax - 0.4 && placed < maxItems && guard++ < 10) {
        let k = -1;
        for (let j = 0; j < bag.length; j++) {
          const it = items[bag[j]], iL = it.L * K, iD = it.D * K;
          if (cur + iL > umax) continue;
          if (it.tall && winHit(s, cur, cur + iL)) continue;
          // non sovrapporsi ad altri mobili (pareti adiacenti negli angoli)
          const [x, z] = at(s, cur + iL / 2, iD / 2);
          const hw = s.horiz ? iL / 2 : iD / 2, hd = s.horiz ? iD / 2 : iL / 2;
          if (F.some(f => Math.abs(x - f.x) < f.hw + hw && Math.abs(z - f.z) < f.hd + hd)) continue;
          k = j; break;
        }
        if (k < 0) { cur += 0.6; continue; }
        const name = bag.splice(k, 1)[0], it = items[name], iL = it.L * K;
        const nearWin = winHit(s, cur - 0.1, cur + iL + 0.1);
        U0 = cur + iL / 2;
        it.make(s, U0, nearWin);
        U0 = 0;
        F[F.length - 1].tall = it.tall || (name === 'kitchen' && !nearWin);
        cur += iL + sr(0.15, 0.7); placed++;
        if (!bag.length) break;
      }
      // un quadro sulla parete libera (non sopra le finestre né sui mobili alti)
      if (pics.length < 2 && srand() < 0.75) {
        const u = s.win ? (srand() < 0.5 ? -1 : 1) * sr(1.5, Math.max(1.6, s.len / 2 - 1.2)) : sr(-s.len / 4, s.len / 4);
        const [x, z] = at(s, u, 0.03);
        if (!F.some(f => Math.abs(x - f.x) < f.hw + 0.5 && Math.abs(z - f.z) < f.hd + 0.3 && f.tall) && Math.abs(u) < s.len / 2 - T - 0.6) {
          const pw = sr(0.7, 1.0), ph = pw * sr(0.62, 0.8);
          fb(s, u, 0, 1.55, pw + 0.1, ph + 0.1, 0.04, frameMat);
          const [px, pz] = at(s, u, 0.045);
          addGeo(cgeo('pic' + pw.toFixed(2) + ph.toFixed(2), () => new THREE.PlaneGeometry(pw, ph)), px, fy + 1.6 + ph / 2, pz, paintMats[Math.floor(srand() * paintMats.length)], { house, rotY: rotFor(s), cast: false });
          pics.push(u);
        }
      }
    }
    // tavolo da pranzo con sedie e tappeto (se c'è spazio in mezzo alla stanza; v41: in scala K)
    const w = house.w, d = house.d, cx = house.cx, cz = house.cz;
    for (let t = 0; t < 12; t++) {
      const along = srand() < 0.5;
      const x = cx + sr(-w / 2 + 2.2 * K, w / 2 - 2.2 * K), z = cz + sr(-d / 2 + 2.2 * K, d / 2 - 2.2 * K);
      const hw = (along ? 1.35 : 1.15) * K, hd = (along ? 1.15 : 1.35) * K;
      if (F.some(f => Math.abs(x - f.x) < f.hw + hw && Math.abs(z - f.z) < f.hd + hd)) continue;
      const tw = (along ? 1.5 : 0.9) * K, td = (along ? 0.9 : 1.5) * K, ty = 0.75 * K;
      const rug = rugMats[Math.floor(srand() * rugMats.length)];
      addGeo(cgeo('rug' + along + K, () => new THREE.PlaneGeometry((along ? 2.8 : 2.2) * K, (along ? 2.2 : 2.8) * K).rotateX(-Math.PI / 2)), x, fy + 0.012, z, rug, { house, cast: false });
      addBox(tw, 0.05 * K, td, x, fy + ty, z, wood, { house, collide: false });
      addCollider({ type: 'box', minX: x - tw / 2, maxX: x + tw / 2, minY: fy, maxY: fy + ty + 0.03, minZ: z - td / 2, maxZ: z + td / 2 });
      for (const a of [-1, 1]) for (const b of [-1, 1]) addBox(0.06 * K, ty - 0.02, 0.06 * K, x + a * (tw / 2 - 0.08 * K), fy + (ty - 0.02) / 2, z + b * (td / 2 - 0.08 * K), darkWoodMat, { house, collide: false, cast: false });
      // 4 sedie ai lati lunghi, schienale verso l'esterno
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        const ox = (along ? a * 0.4 : b * 0.72) * K, oz = (along ? b * 0.72 : a * 0.4) * K;
        const sx = x + ox, sz = z + oz, c = 0.44 * K;
        addBox(c, 0.05 * K, c, sx, fy + 0.465 * K, sz, wood, { house, collide: false, cast: false });
        for (const p of [-1, 1]) for (const q of [-1, 1]) addBox(0.04 * K, 0.44 * K, 0.04 * K, sx + p * 0.18 * K, fy + 0.22 * K, sz + q * 0.18 * K, darkWoodMat, { house, collide: false, cast: false });
        const bx = along ? 0 : b * 0.2 * K, bz = along ? b * 0.2 * K : 0;
        addBox(along ? c : 0.04 * K, 0.48 * K, along ? 0.04 * K : c, sx + bx, fy + 0.73 * K, sz + bz, wood, { house, collide: false });
      }
      // vaso con fiori e tovaglietta
      addBox(0.12, 0.2, 0.12, x, fy + ty + 0.125, z, potMat, { house, collide: false, cast: false });
      addGeo(cgeo('flowers', () => new THREE.IcosahedronGeometry(0.13, 0)), x, fy + ty + 0.29, z, blanketMats[Math.floor(srand() * blanketMats.length)], { house, cast: false });
      addBox((along ? 0.9 : 0.4) * K, 0.008, (along ? 0.4 : 0.9) * K, x, fy + ty + 0.03, z, linenMat, { house, collide: false, cast: false });
      F.push({ x, z, hw, hd });
      break;
    }
  }

  function placeHouse(cx, cz, w, d, baseY, rot90, theme = 'classic', doorFace = -1) {
    if (rot90) { const t = w; w = d; d = t; }
    // v41: case più alte e larghe (i personaggi dentro sembravano giganti): soffitto 4,4 m, porte 2,5 × 3 m,
    //  finestre più ampie con l'architrave a 3,2 m (ci si passa saltando senza sbattere la testa)
    const H = 4.4, T = 0.35, door = 2.5, doorH = 3.0, winW = 2.0, sill = 1.1, winTop = H - 1.2;
    const TH = THEMES[theme] || THEMES.classic;
    const wi = Math.floor(srand() * TH.walls.length);
    const wm = wallMatFor(TH.walls[wi]);
    const house = { cx, cz, w, d, baseY, roofMesh: null, roofTop: baseY + H + 0.3, lodH: H + 0.3, doors: [], wallColor: TH.walls[wi] === 'stone' ? '#a39d92' : TH.walls[wi], theme };
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
    const doorSide = doorFace >= 0 ? doorFace : Math.floor(srand() * 4);
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
      s.door = hasDoor; s.win = hasWindow; s.n = normals[i];
      if (hasDoor) {
        // porta vera a due ante (si apre e chiude con E), alcune restano aperte dall'inizio
        const dr = { i: doors.length, x: s.x, z: s.z, y: baseY + 0.2, lh: doorH - 0.24, horiz: s.horiz, nx: normals[i][0], nz: normals[i][1], gap: door, open0: srand() < 0.3, open: false, ang: 0, mat: doorMats[Math.floor(srand() * doorMats.length)], c: null, leaves: null, house };
        dr.c = { type: 'box', minX: s.horiz ? s.x - door / 2 : s.x - 0.08, maxX: s.horiz ? s.x + door / 2 : s.x + 0.08, minY: baseY + 0.2, maxY: baseY + doorH, minZ: s.horiz ? s.z - 0.08 : s.z - door / 2, maxZ: s.horiz ? s.z + 0.08 : s.z + door / 2, door: dr };
        setDoor(dr, dr.open0, true);
        doors.push(dr); chunkAt(s.x, s.z).doors.push(dr);
        house.doors.push({ x: s.x, z: s.z, nx: normals[i][0], nz: normals[i][1], door: dr });
      }
      if (hasDoor || hasWindow) {
        const gap = hasDoor ? door : winW;
        const seg = (s.len - gap) / 2;
        const off = gap / 2 + seg / 2;
        const n = normals[i];
        for (const sgn of [-1, 1]) {
          if (s.horiz) { addBox(seg, H, T, s.x + sgn * off, baseY + H / 2, s.z, wm, ho); plinth(s, seg, s.x + sgn * off, s.z); }
          else { addBox(T, H, seg, s.x, baseY + H / 2, s.z + sgn * off, wm, ho); plinth(s, seg, s.x, s.z + sgn * off); }
        }
        if (hasDoor) {
          // cornice della porta e zerbino
          for (const sgn of [-1, 1]) outer(s, n, sgn * (gap / 2 + 0.07), baseY + doorH / 2, 0.14, doorH, 0.1, trimMat);
          outer(s, n, 0, baseY + doorH + 0.07, gap + 0.28, 0.14, 0.1, trimMat);
          outer(s, n, 0, baseY - 0.02, gap + 0.7, 0.16, 0.75, stoneMat);   // gradino
          outer(s, n, 0, baseY + 0.075, 1.3, 0.03, 0.6, matMat);
        } else {
          // finestra: cornice, davanzale e persiane aperte
          const wh = winTop - sill, wy = baseY + sill + wh / 2;
          for (const sgn of [-1, 1]) outer(s, n, sgn * (gap / 2 + 0.06), wy, 0.12, wh + 0.12, 0.08, trimMat);
          outer(s, n, 0, baseY + winTop + 0.06, gap + 0.24, 0.12, 0.08, trimMat);
          outer(s, n, 0, baseY + sill - 0.04, gap + 0.4, 0.08, 0.26, trimMat);
          if (seg > 1.2) for (const sgn of [-1, 1]) outer(s, n, sgn * (gap / 2 + 0.12 + 0.5), wy, 0.98, wh, 0.05, shutM);
          // infisso dentro il vano (solo la traversa alta: il vano resta libero per scavalcare)
          if (s.horiz) addBox(gap, 0.07, 0.08, s.x, baseY + winTop - 0.5, s.z, trimMat, deco);
          else addBox(0.08, 0.07, gap, s.x, baseY + winTop - 0.5, s.z, trimMat, deco);
        }
        if (hasDoor) {
          const lh = H - doorH;
          if (s.horiz) addBox(gap, lh, T, s.x, baseY + doorH + lh / 2, s.z, wm, ho);
          else addBox(T, lh, gap, s.x, baseY + doorH + lh / 2, s.z, wm, ho);
        } else {
          const th2 = H - winTop;
          if (s.horiz) {
            addBox(gap, sill, T, s.x, baseY + sill / 2, s.z, wm, ho);
            addBox(gap, th2, T, s.x, baseY + winTop + th2 / 2, s.z, wm, ho);
          } else {
            addBox(T, sill, gap, s.x, baseY + sill / 2, s.z, wm, ho);
            addBox(T, th2, gap, s.x, baseY + winTop + th2 / 2, s.z, wm, ho);
          }
          plinth(s, gap, s.x, s.z);
        }
      } else {
        if (s.horiz) addBox(s.len, H, T, s.x, baseY + H / 2, s.z, wm, ho);
        else addBox(T, H, s.len, s.x, baseY + H / 2, s.z, wm, ho);
        plinth(s, s.len, s.x, s.z);
      }
    });
    // battiscopa all'interno, arredi, tappeti e quadri
    sides.forEach(s => {
      const L = s.len - 2 * T, gap = s.door ? door : 0;
      const pieces = gap ? [[-(L / 2 + gap / 2) / 2, (L - gap) / 2]].concat([[(L / 2 + gap / 2) / 2, (L - gap) / 2]]) : [[0, L]];
      for (const [u, lu] of pieces) inner(s, u, 0.02, baseY + 0.27, lu, 0.14, 0.04, trimMat);
    });
    furnish(house, sides, baseY, H, T, theme);
    // lesene in rilievo agli angoli
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(T + 0.16, H - 0.5, T + 0.16, cx + sx * (w / 2 - T / 2), baseY + 0.5 + (H - 0.5) / 2, cz + sz * (d / 2 - T / 2), TH.walls[wi] === 'stone' ? trimMat : stoneMat, { ...deco, cast: false });
    const ri = Math.floor(srand() * TH.roofs.length);
    addBox(w + 0.6, 0.3, d + 0.6, cx, baseY + H + 0.15, cz, roofMatFor(TH.roofs[ri]), { ...ho, roof: true });
    // v25: soffitto intonacato sotto il tetto e sotto il cornicione (resta visibile quando si entra)
    addBox(w - 2 * T, 0.03, d - 2 * T, cx, baseY + H - 0.21, cz, ceilMat, { house, collide: false, cast: false });
    addBox(0.55, 0.05, 0.55, cx, baseY + H - 0.25, cz, ceilLampMat, { house, collide: false, cast: false });
    // tetto a due falde (non per le facciate western né per i castelli): colmo sul lato lungo
    const pitched = !TH.facade && !TH.merlons;
    const alongX = w >= d, span = alongX ? d : w, rlen = alongX ? w : d;
    const half = span / 2 + 0.75, rise = (TH.bigChimney ? 0.3 : TH.snowRoof ? 0.68 : 0.55) * half, thick = 0.18;
    const yb = baseY + H + 0.3;
    const roofAt = (x, z) => pitched ? Math.max(0, rise * (1 - Math.abs(alongX ? z - cz : x - cx) / half)) : 0;
    if (pitched) {
      const rot = alongX ? 0 : Math.PI / 2;
      const rm = roofMatFor(TH.roofs[ri]);
      addGeo(gableRoofGeo(rlen + 1.1, half, rise, thick), cx, yb - 0.02, cz, rm, { ...ho, roof: true, rotY: rot });
      addGeo(ridgeGeo(rlen + 1.2), cx, yb - 0.02 + rise + thick, cz, capMat, { ...ho, roof: true, rotY: rot });
      if (TH.snowRoof) addGeo(gableRoofGeo(rlen + 0.9, half - 0.12, rise * (half - 0.12) / half, 0.14), cx, yb + 0.16, cz, snowMat, { ...ho, roof: true, rotY: rot, cast: false });
      // timpani alle due testate (stesso muro della casa)
      const eg = gableEndGeo(span / 2, half, rise, T);
      for (const e of [-1, 1]) {
        if (alongX) addGeo(eg, cx + e * (w / 2 - T / 2), yb - 0.02, cz, wm, { ...ho, roof: true });
        else addGeo(eg, cx, yb - 0.02, cz + e * (d / 2 - T / 2), wm, { ...ho, roof: true, rotY: Math.PI / 2 });
      }
      // falde calpestabili: gradini invisibili che seguono la pendenza
      const NS = 5;
      for (const sd of [-1, 1]) for (let k = 0; k < NS; k++) {
        const a = half * k / NS, b2 = half * (k + 1) / NS, ym = rise * (1 - (a + b2) / 2 / half) + thick;
        const lo = sd > 0 ? a : -b2, hi = sd > 0 ? b2 : -a;
        if (alongX) addCollider({ type: 'box', minX: cx - rlen / 2 - 0.5, maxX: cx + rlen / 2 + 0.5, minY: yb, maxY: yb + ym, minZ: cz + lo, maxZ: cz + hi });
        else addCollider({ type: 'box', minX: cx + lo, maxX: cx + hi, minY: yb, maxY: yb + ym, minZ: cz - rlen / 2 - 0.5, maxZ: cz + rlen / 2 + 0.5 });
      }
      house.pitch = { alongX, rise };
    }
    // dettagli del tema
    const ds = sides[doorSide], dn = normals[doorSide];
    if (TH.snowRoof && !pitched) {
      addBox(w + 0.75, 0.28, d + 0.75, cx, baseY + H + 0.44, cz, snowMat, { ...ho, roof: true, collide: false, cast: false });
      addBox(w * 0.6, 0.18, d * 0.6, cx, baseY + H + 0.64, cz, snowMat, { ...ho, roof: true, collide: false, cast: false });
    }
    if (TH.facade) {
      // falsa facciata western con insegna
      const fl = ds.len + 0.4;
      if (ds.horiz) addBox(fl, 1.9, T, ds.x, baseY + H + 0.95, ds.z, wm, { ...ho, roof: true });
      else addBox(T, 1.9, fl, ds.x, baseY + H + 0.95, ds.z, wm, { ...ho, roof: true });
      outer(ds, dn, 0, baseY + H + 0.9, ds.len * 0.55, 0.75, 0.08, signMat);
      outer(ds, dn, 0, baseY + H + 1.95, fl, 0.14, 0.14, trimMat);
    }
    if (TH.awning) outer(ds, dn, 0, baseY + doorH + 0.45, door + 1.6, 0.1, 1.4, awningMats[Math.floor(srand() * awningMats.length)]);
    if (TH.merlons) {
      for (let u = -w / 2; u <= w / 2 + 0.01; u += 1.5) for (const zz of [-1, 1]) addBox(0.6, 0.7, 0.6, cx + u, baseY + H + 0.65, cz + zz * (d / 2 + 0.05), stoneMat, { ...ho, roof: true, collide: false });
      for (let u = -d / 2 + 1.5; u <= d / 2 - 1.49; u += 1.5) for (const xx of [-1, 1]) addBox(0.6, 0.7, 0.6, cx + xx * (w / 2 + 0.05), baseY + H + 0.65, cz + u, stoneMat, { ...ho, roof: true, collide: false });
    }
    // cornicione sotto il tetto e comignolo (fanno parte del "tetto": spariscono quando entri)
    addBox(w + 0.3, 0.22, d + 0.3, cx, baseY + H - 0.08, cz, trimMat, { ...ho, roof: true, collide: false, cast: false });
    {
      const sx = srand() < 0.5 ? -1 : 1, sz = srand() < 0.5 ? -1 : 1;
      const chx = cx + sx * (w / 2 - 1.1), chz = cz + sz * (d / 2 - 1.1);
      const chH = Math.max(TH.bigChimney ? 4.5 : 1.4, roofAt(chx, chz) + 1.1);
      if (!TH.merlons) {
        addBox(0.8, chH, 0.8, chx, baseY + H + 0.3 + chH / 2, chz, brickMat, { ...ho, roof: true });
        addBox(0.95, 0.14, 0.95, chx, baseY + H + 0.3 + chH + 0.05, chz, capMat, { ...ho, roof: true, collide: false });
      }
    }
    house.roofColor = TH.roofs[ri];
    houses.push(house);
    chunkAt(cx, cz).houses.push(house);
    // loot e casse dentro la casa (lontano dai mobili e dal passaggio delle porte)
    const freeSpot = (r, tries = 14) => {
      for (let k = 0; k < tries; k++) {
        const x = cx + sr(-w / 2 + 0.9, w / 2 - 0.9), z = cz + sr(-d / 2 + 0.9, d / 2 - 0.9);
        if (house.furn.every(f => Math.abs(x - f.x) > f.hw + r || Math.abs(z - f.z) > f.hd + r)) return [x, z];
      }
      return null;
    };
    const nLoot = 1 + Math.floor(srand() * 3);
    for (let i = 0; i < nLoot; i++) {
      const p = freeSpot(0.35); if (p) lootSpots.push(new THREE.Vector3(p[0], baseY + 0.2, p[1]));
    }
    if (srand() < 0.7) { const p = freeSpot(0.7); if (p) { chestSpots.push({ pos: new THREE.Vector3(p[0], baseY + 0.2, p[1]), rot: srand() * Math.PI }); house.furn.push({ x: p[0], z: p[1], hw: 0.6, hd: 0.6 }); } }
    if (srand() < 0.45) { const p = freeSpot(1.0); if (p) addCrate(1.6, 0.9, 0.9, p[0], baseY + 0.55, p[1], ho); }
    return house;
  }

  function overlapsHouse(x, z, w, d) {
    for (const h of houses) {
      if (Math.abs(x - h.cx) < (w + h.w) / 2 + 4 && Math.abs(z - h.cz) < (d + h.d) / 2 + 4) return true;
    }
    return false;
  }

  /** decorazioni tipiche di ogni tema (pupazzi di neve, serbatoi, silos, palme, ciminiere…) */
  const extraTrees = [];
  function townSpot(t, r, rMin = 4, rMax = t.r - 2) {
    for (let k = 0; k < 40; k++) {
      const a = srand() * Math.PI * 2, rr = sr(rMin, rMax);
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      if (overlapsHouse(x, z, r * 2, r * 2) || onStreet(t, x, z, r + 0.5) || (rr > t.r - 3 && roadDist(x, z) < r + 2.5)) continue;
      if (queryColliders(x, z, r).some(c => c.type === 'cyl' ? Math.hypot(c.x - x, c.z - z) < c.r + r : (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ))) continue;
      return [x, z];
    }
    return null;
  }
  function special(type, x, z, h, col, extra = {}) {
    const e = { type, x, z, h, rot: srand() * 6.28, ...extra };
    chunkAt(x, z).specials.push(e);
    if (col) { e.c = addCollider({ type: 'cyl', x, z, r: col[0], minY: h - 1, maxY: h + col[1], noStand: col[2] }); e.c.special = e; }
    return e;
  }
  function townExtras(t) {
    const th = t.theme;
    if (th === 'alpine') {
      for (let i = 0; i < 3; i++) { const s = townSpot(t, 0.8); if (s) special('snowman', s[0], s[1], t.h, [0.55, 1.7, true]); }
      for (let i = 0; i < 5; i++) { const s = townSpot(t, 1.2, t.r * 0.6, t.r + 4); if (s) extraTrees.push({ x: s[0], z: s[1], k: 'snowPine' }); }
      // v27: cumuli di neve, slitte e un falò per scaldarsi
      for (let i = 0; i < 6; i++) { const s = townSpot(t, 1.0); if (s) special('snowPile', s[0], s[1], t.h, null); }
      for (let i = 0; i < 2; i++) { const s = townSpot(t, 1.0); if (s) special('sled', s[0], s[1], t.h, null); }
      { const s = townSpot(t, 1.6); if (s) special('campfire', s[0], s[1], t.h, [0.8, 0.4, false]); }
    } else if (th === 'western') {
      { const s = townSpot(t, 2.4); if (s) { special('waterTower', s[0], s[1], t.h, [1.9, 8.2, false]); lootSpots.push(new THREE.Vector3(s[0] + 2.6, t.h + 0.2, s[1])); } }
      for (let i = 0; i < 6; i++) { const s = townSpot(t, 1, t.r * 0.5, t.r + 6); if (s) extraTrees.push({ x: s[0], z: s[1], k: 'cactus' }); }
      for (let i = 0; i < 3; i++) { const s = townSpot(t, 0.9); if (s) addBox(1.6, 1.0, 1.0, s[0], t.h + 0.5, s[1], hayMat, { lodColor: '#e2c25a' }); }
      // v27: falò dell'accampamento con tronchi per sedersi, carrelli da miniera abbandonati
      for (let i = 0; i < 2; i++) { const s = townSpot(t, 1.8); if (s) special('campfire', s[0], s[1], t.h, [0.8, 0.4, false]); }
      { const s = townSpot(t, 1.4); if (s) special('orePile', s[0], s[1], t.h, [1.1, 0.9, false]); }
    } else if (th === 'coastal') {
      for (let i = 0; i < 7; i++) { const s = townSpot(t, 1.2, 4, t.r + 6); if (s) extraTrees.push({ x: s[0], z: s[1], k: 'palm' }); }
      for (let i = 0; i < 4; i++) { const s = townSpot(t, 1.3); if (s) special('umbrella', s[0], s[1], t.h, [0.12, 2.4, true], { c: i }); }
      // v27: cabine a righe, torretta del bagnino (con bottino in cima), surf e barche in secca
      for (let i = 0; i < 4; i++) { const s = townSpot(t, 1.5); if (s) special('beachHut', s[0], s[1], t.h, [1.1, 3.2, false], { c: i }); }
      { const s = townSpot(t, 1.6, t.r * 0.4, t.r + 4); if (s) { special('lifeguard', s[0], s[1], t.h, null, { rot: 0 }); addCollider({ type: 'box', minX: s[0] - 1, maxX: s[0] + 1, minY: t.h + 2.1, maxY: t.h + 2.25, minZ: s[1] - 1, maxZ: s[1] + 1 }); lootSpots.push(new THREE.Vector3(s[0], t.h + 2.27, s[1])); } }
      for (let i = 0; i < 2; i++) { const s = townSpot(t, 1.2); if (s) special('surfRack', s[0], s[1], t.h, [0.9, 1.3, true]); }
      for (let i = 0; i < 3; i++) { const s = townSpot(t, 2.3, t.r * 0.55, t.r + 6); if (s) special('boat', s[0], s[1], t.h, [1.2, 1.0, false], { c: i }); }
      { const s = townSpot(t, 1.6); if (s) special('campfire', s[0], s[1], t.h, [0.8, 0.4, false]); }
    } else if (th === 'castle') {
      for (let i = 0; i < 4; i++) { const s = townSpot(t, 0.6); if (s) special('barrel', s[0], s[1], t.h, [0.38, 0.9, false]); }
      for (let i = 0; i < 2; i++) { const s = townSpot(t, 1.0); if (s) special('woodpile', s[0], s[1], t.h, [0.9, 1.0, false]); }
      { const s = townSpot(t, 1.6); if (s) special('campfire', s[0], s[1], t.h, [0.8, 0.4, false]); }
    } else if (th === 'farm') {
      { const s = townSpot(t, 2.3); if (s) { special('silo', s[0], s[1], t.h, [2.1, 10.5, false]); lootSpots.push(new THREE.Vector3(s[0] + 2.8, t.h + 0.2, s[1])); } }
      // v27: trattori, rotoballe e spaventapasseri
      for (let i = 0; i < 2; i++) { const s = townSpot(t, 2.0); if (s) special('tractor', s[0], s[1], t.h, [1.3, 2.8, false], { c: i }); }
      for (let i = 0; i < 6; i++) { const s = townSpot(t, 0.9); if (s) special('roundBale', s[0], s[1], t.h, [0.8, 1.5, false]); }
      for (let i = 0; i < 3; i++) { const s = townSpot(t, 0.9); if (s) special('scarecrow', s[0], s[1], t.h, [0.12, 2.4, true]); }
      for (let i = 0; i < 6; i++) { const s = townSpot(t, 0.9); if (s) { addBox(1.5, 1.2, 1.2, s[0], t.h + 0.6, s[1], hayMat, { lodColor: '#e2c25a' }); if (srand() < 0.4) addBox(1.5, 1.2, 1.2, s[0] + 0.1, t.h + 1.8, s[1], hayMat); } }
      // staccionate (decorative: ci si passa attraverso)
      for (let i = 0; i < 4; i++) {
        const s = townSpot(t, 3); if (!s) continue;
        const along = srand() < 0.5;
        for (let k = -2; k <= 2; k++) addBox(0.15, 1.1, 0.15, s[0] + (along ? k * 1.4 : 0), t.h + 0.55, s[1] + (along ? 0 : k * 1.4), fenceMat, { collide: false });
        for (const y of [0.45, 0.9]) addBox(along ? 5.8 : 0.08, 0.12, along ? 0.08 : 5.8, s[0], t.h + y, s[1], fenceMat, { collide: false, cast: false });
      }
    } else if (th === 'industrial' || th === 'port') {
      for (let i = 0; i < (th === 'port' ? 1 : 2); i++) { const s = townSpot(t, 2); if (s) special('stack', s[0], s[1], t.h, [1.6, 22, false]); }
      if (th === 'port') { const s = townSpot(t, 1.5); if (s) special('lighthouse', s[0], s[1], t.h, [1.7, 14, false]); }
    }
    if (/^Faro/.test(t.name) && th !== 'port') { const s = townSpot(t, 1.5); if (s) special('lighthouse', s[0], s[1], t.h, [1.7, 14, false]); }
  }

  yield 'città';
  // ── città (v24): strade, piazze, palazzi, negozi, capannoni e case (city.js) ──
  function makeDoor(x, z, y, horiz, nx, nz, house, gap = 2.2) {
    const dr = { i: doors.length, x, z, y: y + 0.2, horiz, nx, nz, gap, open0: srand() < 0.3, open: false, ang: 0, mat: doorMats[Math.floor(srand() * doorMats.length)], c: null, leaves: null, house };
    dr.c = { type: 'box', minX: horiz ? x - gap / 2 : x - 0.08, maxX: horiz ? x + gap / 2 : x + 0.08, minY: y + 0.2, maxY: y + 2.6, minZ: horiz ? z - 0.08 : z - gap / 2, maxZ: horiz ? z + gap / 2 : z + 0.08, door: dr };
    setDoor(dr, dr.open0, true);
    doors.push(dr); chunkAt(x, z).doors.push(dr);
    house.doors.push({ x, z, nx, nz, door: dr });
    return dr;
  }
  const cityStats = buildCity({
    TOWNS: TOWNS.filter(t => !t.arena), addBox, addGeo, addCollider, special, houses, lootSpots, chestSpots, extraTrees, makeDoor, furnish, placeHouse, cgeo, chunkAt, addCrate,
    rnd: () => srand(), gableRoofGeo, gableEndGeo, ridgeGeo, roofMatFor, terrainHeight, roadDist,
    M: { floorMat, trimMat, stoneMat, capMat, brickMat, crateMat, counterTopMat, blackMat, darkWoodMat, steelMat, potMat, leafMat, cabinetMats, sofaMats, blanketMats, furnWoodMats, screenMat, bookMats, snowMat, hayMat },
  });
  // v38: monumenti (l'arena al centro, la chiesa barocca in piazza): mesh permanenti, si vedono da lontano
  const landmarks = [];
  for (const t of TOWNS) {
    if (t.arena) {
      const A = buildArena(t.x, t.h, t.z, MAP.seed);
      const mm = new THREE.Mesh(A.geo, monumentMaterial);
      mm.position.set(t.x, t.h, t.z); mm.castShadow = mm.receiveShadow = true;
      scene.add(mm); landmarks.push(mm);
      for (const c of A.colliders) addCollider(c);
      lootSpots.push(...A.loot); chestSpots.push(...A.chests);
      t.arenaR = ARENA.RF;
    }
    if (t.church) {
      const { x, z } = t.church, y = t.h + 0.16;
      const mm = new THREE.Mesh(churchGeo(), monumentMaterial);
      mm.position.set(x, y, z); mm.castShadow = mm.receiveShadow = true;
      scene.add(mm); landmarks.push(mm);
      for (const c of churchColliders()) {
        if (c.type === 'cyl') addCollider({ ...c, x: c.x + x, z: c.z + z, minY: c.minY + y, maxY: c.maxY + y });
        else addCollider({ type: 'box', ...c, minX: c.minX + x, maxX: c.maxX + x, minZ: c.minZ + z, maxZ: c.maxZ + z, minY: c.minY + y - (c.minY ? 0 : 0.5), maxY: c.maxY + y });
      }
      lootSpots.push(new THREE.Vector3(x + 9.0, y + 9.8, z - 3.0), new THREE.Vector3(x - 1.8, y + 0.62, z + 2.0), new THREE.Vector3(x + 2.5, y + 8.75, z + 0.4), new THREE.Vector3(x + 3.2, y + 15.13, z + 0.2));
      chestSpots.push({ pos: new THREE.Vector3(x + 11.6, y + 9.75, z - 6.0), rot: 0 });
    }
  }
  const freeOfCity = (t, x, z, w, d) => !overlapsHouse(x, z, w, d) && !onStreet(t, x, z, Math.max(w, d) / 2 + 0.5);
  for (const t of TOWNS) {
    if (t.arena) continue;
    townExtras(t);
    if (t.towers && !t.wallS) {
      for (let i = 0; i < 4; i++) {
        let a = i * Math.PI / 2 + 0.4, rr = t.r - 6, ok = false;
        for (let k = 0; k < 30 && !ok; k++) {
          a = i * Math.PI / 2 + 0.4 + (k ? sr(-0.7, 0.7) : 0); rr = k ? sr(t.r * 0.45, t.r - 5) : t.r - 6;
          ok = freeOfCity(t, t.x + Math.cos(a) * rr, t.z + Math.sin(a) * rr, 7, 7);
        }
        if (!ok) continue;
        const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
        if (t.theme === 'castle') {
          // torre di pietra con merli e bandiera
          addBox(5, 18, 5, x, t.h + 9, z, stoneMat, { lodColor: '#a39d92' });
          addBox(6, 0.6, 6, x, t.h + 18.3, z, stoneMat, { lodColor: '#a39d92' });
          for (let k = 0; k < 4; k++) for (let u = -2.4; u <= 2.41; u += 1.6) {
            const mx = k < 2 ? u : (k === 2 ? -2.75 : 2.75), mz = k < 2 ? (k === 0 ? -2.75 : 2.75) : u;
            addBox(0.6, 0.8, 0.6, x + mx, t.h + 19, z + mz, stoneMat, { collide: false });
          }
          chunkAt(x, z).specials.push({ type: 'flag', x, z, h: t.h + 18.6, c: i });
        } else {
          addBox(5, 18, 5, x, t.h + 9, z, wallMats[2], { lodColor: wallColors[2] });
          addBox(6, 0.6, 6, x, t.h + 18.3, z, metalMat, { lodColor: '#6a6f78' });
        }
        lootSpots.push(new THREE.Vector3(x + 3.5, t.h + 0.2, z));
      }
    }
    if (t.containers) {
      for (let i = 0; i < 8; i++) {
        const x = t.x + sr(-t.r + 4, t.r - 4), z = t.z + sr(-t.r + 4, t.r - 4);
        if (Math.hypot(x - t.x, z - t.z) > t.r - 4 || !freeOfCity(t, x, z, 7, 7)) continue;
        const rot = srand() < 0.5;
        const stack = srand() < 0.35 ? 2 : 1;
        for (let s = 0; s < stack; s++) {
          const ci = Math.floor(srand() * 4);
          const cy = t.h + 1.3 + s * 2.6;
          addBox(rot ? 2.5 : 6.5, 2.6, rot ? 6.5 : 2.5, x, cy, z, containerMats[ci], { lodColor: contColors[ci] });
          // lamiera ondulata (nervature), montanti d'angolo, longheroni e barre di chiusura delle porte
          const o = { collide: false, cast: false }, L = 6.5, Wd = 2.5, cm = containerMats[ci], fm = contFrameMats[ci];
          const P = (u, v, lu, lv, h, y) => rot ? addBox(lv, h, lu, x + v, y, z + u, fm, o) : addBox(lu, h, lv, x + u, y, z + v, fm, o);
          const R = (u, v, lu, lv, h, y) => rot ? addBox(lv, h, lu, x + v, y, z + u, cm, o) : addBox(lu, h, lv, x + u, y, z + v, cm, o);
          for (let u = -L / 2 + 0.45; u < L / 2 - 0.3; u += 0.42) for (const sv of [-1, 1]) R(u, sv * (Wd / 2 + 0.03), 0.18, 0.06, 2.3, cy);
          for (const su of [-1, 1]) for (const sv of [-1, 1]) P(su * (L / 2 - 0.08), sv * (Wd / 2 - 0.08), 0.2, 0.2, 2.62, cy);
          for (const sy of [-1, 1]) for (const sv of [-1, 1]) P(0, sv * (Wd / 2 - 0.05), L + 0.01, 0.14, 0.16, cy + sy * 1.22);
          for (const vv of [-0.75, -0.3, 0.3, 0.75]) P(L / 2 + 0.03, vv, 0.05, 0.05, 2.3, cy);
        }
        lootSpots.push(new THREE.Vector3(x + (rot ? 2 : 0), t.h + 0.2, z + (rot ? 0 : 2)));
      }
    }
    const nCrates = Math.floor(t.r / 3);
    for (let i = 0; i < nCrates; i++) {
      const a = srand() * Math.PI * 2, rr = sr(3, t.r);
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      if (!freeOfCity(t, x, z, 1.5, 1.5)) continue;
      const s = sr(1.1, 1.4);
      const gy = terrainHeight(x, z);
      addCrate(s, s, s, x, gy + s / 2, z);
      if (srand() < 0.3) addCrate(s * 0.9, s * 0.9, s * 0.9, x + 0.1, gy + s + s * 0.45, z);
      if (srand() < 0.5) lootSpots.push(new THREE.Vector3(x + s, gy, z));
    }
  }

  yield 'alberi';
  // ── alberi (solo dati + collisori) ──
  const trees = [];
  let tries = 0;
  const NTREES = Math.round(420 * SCALE * SCALE * 0.95 * 1.7);
  // densità dei boschi: alberi fitti nelle macchie scure, radi nei prati
  const forestK = (x, z) => 0.18 + 0.82 * smoothstep(0.42, 0.72, patch(x, z, 0.0085, 2.1) * 0.75 + patch(x, z, 0.031, 5.3) * 0.25);
  while (trees.length < NTREES && tries < NTREES * 14) {
    tries++;
    const x = sr(-HALF + 8, HALF - 8), z = sr(-HALF + 8, HALF - 8);
    const bw = biomeAt(x, z), wS = bw[1], wD = bw[2], wA = bw[3], wT = bw[4];
    // il deserto ha pochi cactus, la costa tropicale palme sparse
    const dens = forestK(x, z) * (1 - wD * 0.82) * (1 - wT * 0.35);
    if (srand() > dens) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.8 || h > 58 - wD * 20) continue;
    if (inTown(x, z, 6)) continue;
    if (roadDist(x, z) < 4) continue;
    const slope = Math.hypot(terrainHeight(x + 1.5, z) - h, terrainHeight(x, z + 1.5) - h) / 1.5;
    if (slope > 1.1) continue;
    const t = { x, z, h, s: sr(0.8, 1.45), rot: srand() * 6.28, hue: 0.28 + sr(-0.04, 0.05), light: sr(0.28, 0.4) };
    // tipo di albero in base al bioma dominante e all'altitudine
    const r = srand(), pick = srand();
    if (wD > pick && wD > 0.25) t.k = r < 0.8 ? 'cactus' : 'deadTree';
    else if (wS > pick && wS > 0.2) t.k = r < 0.93 ? 'snowPine' : 'deadTree';
    else if (wT > pick && wT > 0.2) t.k = r < 0.62 ? 'palm' : (r < 0.85 ? 'oak' : 'birch');
    else if (wA > pick && wA > 0.2) t.k = r < 0.5 ? 'autumnOak' : (r < 0.78 ? 'autumnBirch' : (r < 0.95 ? 'pine' : 'deadTree'));
    else t.k = r < (h > 12 ? 0.8 : 0.5) ? 'pine' : (t.rot > 4.4 ? 'birch' : (t.rot < 0.55 ? 'autumnOak' : (t.rot < 0.9 ? 'autumnBirch' : 'oak')));
    if (h > 34 && t.k !== 'cactus') t.k = h > 42 || wS > 0.3 ? 'snowPine' : 'pine';
    t.pine = t.k === 'pine' || t.k === 'snowPine';
    if (t.k === 'cactus') t.s *= 0.85;
    trees.push(t);
    chunkAt(x, z).trees.push(t);
    addCollider({ type: 'cyl', x, z, r: (t.k === 'cactus' ? 0.45 : 0.4) * t.s, minY: h - 1, maxY: h + 3.2 * t.s, noStand: true, tree: true });
  }

  for (const e of extraTrees) {
    const h = e.y ?? terrainHeight(e.x, e.z);
    const t = { x: e.x, z: e.z, h, s: sr(0.85, 1.25), rot: srand() * 6.28, hue: 0.28 + sr(-0.03, 0.04), light: sr(0.3, 0.38), k: e.k, pine: e.k === 'snowPine' };
    trees.push(t);
    chunkAt(t.x, t.z).trees.push(t);
    addCollider({ type: 'cyl', x: t.x, z: t.z, r: 0.42 * t.s, minY: h - 1, maxY: h + 3.2 * t.s, noStand: true, tree: true });
  }

  yield 'cespugli';
  // ── cespugli (nessuna collisione: ci si può nascondere dentro) ──
  const NBUSH = Math.round(520 * SCALE * SCALE);
  tries = 0;
  let nb = 0;
  while (nb < NBUSH && tries < NBUSH * 8) {
    tries++;
    const x = sr(-HALF + 6, HALF - 6), z = sr(-HALF + 6, HALF - 6);
    if (srand() > (0.35 + forestK(x, z) * 0.65) * (1 - biomeAt(x, z)[1] * 0.75) * (1 - biomeAt(x, z)[2] * 0.6)) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.9 || h > 40) continue;
    if (inTown(x, z, 4) || roadDist(x, z) < 3.5) continue;
    chunkAt(x, z).bushes.push({ x, z, h, s: sr(0.7, 1.4), rot: srand() * 6.28, v: Math.floor(srand() * 4) });
    nb++;
  }

  yield 'rocce';
  // ── rocce ──
  const NROCKS = Math.round(140 * SCALE * SCALE * 0.9 * 1.4);
  tries = 0;
  let nr = 0;
  while (nr < NROCKS && tries < NROCKS * 20) {
    tries++;
    const x = sr(-HALF + 6, HALF - 6), z = sr(-HALF + 6, HALF - 6);
    if (inTown(x, z, 4)) continue;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL - 1) continue;
    const r = { x, z, h, s: sr(0.7, 2.4), e: [srand() * 3, srand() * 3, srand() * 3], k: [sr(0.9, 1.4), sr(0.6, 1), sr(0.9, 1.3)] };
    r.shape = Math.floor(srand() * 5);
    chunkAt(x, z).rocks.push(r); nr++;
    r.c = addCollider({ type: 'cyl', x, z, r: r.s * 0.95, minY: h - 2, maxY: h + r.s * 0.9, rock: r });
    // a volte qualche masso più piccolo accanto (gruppi di rocce)
    if (srand() < 0.35) {
      const nk = 1 + Math.floor(srand() * 3);
      for (let k = 0; k < nk; k++) {
        const a2 = srand() * 6.28, d2 = r.s * sr(1.1, 1.8), x2 = x + Math.cos(a2) * d2, z2 = z + Math.sin(a2) * d2;
        const h2 = terrainHeight(x2, z2);
        if (h2 < WATER_LEVEL - 1 || inTown(x2, z2, 3)) continue;
        const r2 = { x: x2, z: z2, h: h2, s: r.s * sr(0.3, 0.55), e: [srand() * 3, srand() * 3, srand() * 3], k: [sr(0.9, 1.4), sr(0.6, 1), sr(0.9, 1.3)], shape: Math.floor(srand() * 5) };
        chunkAt(x2, z2).rocks.push(r2);
        if (r2.s > 0.45) r2.c = addCollider({ type: 'cyl', x: x2, z: z2, r: r2.s * 0.95, minY: h2 - 2, maxY: h2 + r2.s * 0.9, rock: r2 });
      }
    }
    if (srand() < 0.15) lootSpots.push(new THREE.Vector3(x + r.s + 0.8, h, z));
  }

  yield 'erba alta';
  // ── erba alta: macchie nei prati dove ci si può nascondere (generatore a parte: il resto della mappa non cambia) ──
  {
    const tr = mulberry32(MAP.seed ^ 0x51ed27), R = (a, b) => a + tr() * (b - a);
    const NTALL = 85;
    for (let k = 0, n = 0; n < NTALL && k < 6000; k++) {
      const x = R(-HALF + 25, HALF - 25), z = R(-HALF + 25, HALF - 25);
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 1.6 || h > 26) continue;
      { const bw = biomeAt(x, z); if (bw[1] > 0.25 || bw[2] > 0.4) continue; }
      if (inTown(x, z, 9) || roadDist(x, z) < 7) continue;
      if (Math.hypot(terrainHeight(x + 3, z) - h, terrainHeight(x, z + 3) - h) / 3 > 0.33) continue;
      const r = R(5, 11.5);
      if (TALL.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 14)) continue;
      addTallPatch({ x, z, r, seed: Math.floor(tr() * 1e9) });
      n++;
    }
  }

  yield 'oggetti di scena';
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
    } else if (type === 'shed' && MODEL_SOURCE.shed === 'procedurale') {
      shedInterior(pr);
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
  yield 'casette di legno';
  // ── v26: casette di legno abitabili ──
  const stoves = [];
  /** box nelle coordinate del modello (x, z) → collisore nel mondo (rotazioni multiple di 90°) */
  function shedBox(pr, x0, x1, z0, z1, y0, y1, extra = {}) {
    const c = Math.round(Math.cos(pr.rot)), s = Math.round(Math.sin(pr.rot));
    const xs = [], zs = [];
    for (const lx of [x0, x1]) for (const lz of [z0, z1]) { xs.push(pr.x + lx * c + lz * s); zs.push(pr.z - lx * s + lz * c); }
    return addCollider({ type: 'box', minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), minY: pr.y + y0, maxY: pr.y + y1, ...extra });
  }
  function shedWorld(pr, lx, lz) {
    const c = Math.cos(pr.rot), s = Math.sin(pr.rot);
    return [pr.x + lx * c + lz * s, pr.z - lx * s + lz * c];
  }
  function shedInterior(pr) {
    const { W, D, WH, RH, floor: F } = SHED, T = 0.12, top = F + WH;
    const d0 = SHED.door.x - SHED.door.w / 2, d1 = SHED.door.x + SHED.door.w / 2;
    shedBox(pr, -W / 2 - 0.1, W / 2 + 0.1, -D / 2 - 0.1, D / 2 + 0.1, -1, F);                 // basamento / pavimento
    shedBox(pr, -W / 2, W / 2, -D / 2, -D / 2 + T, F, top);                                   // parete di fondo
    shedBox(pr, -W / 2, -W / 2 + T, -D / 2, D / 2, F, top);                                   // fianchi
    shedBox(pr, W / 2 - T, W / 2, -D / 2, D / 2, F, top);
    shedBox(pr, -W / 2, d0, D / 2 - T, D / 2, F, top);                                        // davanti, ai lati della porta
    shedBox(pr, d1, W / 2, D / 2 - T, D / 2, F, top);
    shedBox(pr, d0, d1, D / 2 - T, D / 2, SHED.door.top, top);                                // sopra la porta
    shedBox(pr, -W / 2, W / 2, -D / 2, D / 2, top, top + 0.25);                               // soffitto / base del tetto
    const k = 0.45;                                                                           // falde (ci si sale a gradini)
    shedBox(pr, -W * k / 2, W * k / 2, -D / 2 + 0.3, D / 2 - 0.3, top + 0.25, F + WH + RH - 0.2);
    shedBox(pr, 0.95, 1.95, -1.72, 0.22, F, F + 0.62);                                        // letto
    const S = SHED.stove;
    shedBox(pr, S.x - 0.34, S.x + 0.34, S.z - 0.29, S.z + 0.29, F, F + 0.78);                // stufa
    shedBox(pr, S.x - 0.08, S.x + 0.08, S.z - 0.08, S.z + 0.08, F + 0.78, top);              // tubo
    shedBox(pr, -1.7, -0.9, -0.3, 0.3, F, F + 0.77);                                          // tavolo
    // porta vera a un'anta (si apre verso l'interno, E per aprire/chiudere)
    const [dx, dz] = shedWorld(pr, SHED.door.x, D / 2 - 0.05);
    const q90 = Math.abs(Math.round(Math.sin(pr.rot))) === 1;
    const house = { doors: [], shed: pr };
    const dr = makeDoor(dx, dz, pr.y + F - 0.2, !q90, Math.sin(pr.rot), Math.cos(pr.rot), house, SHED.door.w - 0.02);
    dr.single = true; dr.open0 = false; setDoor(dr, false, true);
    pr.door = dr;
    // stufa a legna (si accende con E: fuoco, fumo dal comignolo e calduccio che cura)
    const [fx, fz] = shedWorld(pr, S.x, S.fireZ), [cx, cz] = shedWorld(pr, S.x, S.z);
    const st = { i: stoves.length, x: fx, y: pr.y + S.fireY, z: fz, cx, cz, top: pr.y + S.pipeTop + 0.12, floor: pr.y + F, lit: false, t: 0, pr };
    st.room = { x: pr.x, z: pr.z, w: W, d: D, rot: pr.rot };
    stoves.push(st); pr.stove = st;
  }
  const barrelKinds = () => { const r = srand(); return r < 0.35 ? 'barrelRed' : r < 0.65 ? 'barrelBlue' : 'barrelWood'; };
  // nelle città
  for (const t of TOWNS) {
    if (t.arena) continue;
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
    if (TALL.some(p => Math.hypot(p.x - x, p.z - z) < p.r * 1.06 + 3.6)) continue;   // v26: niente erba alta dentro la casetta
    const rot = Math.floor(srand() * 4) * Math.PI / 2;
    addProp('shed', x, z, rot, { y: base });
    nSheds++;
    // bottino accanto alla porta (la porta guarda verso +Z del modello)
    const fx = Math.sin(rot), fz = Math.cos(rot);
    const dd = PROP_DIMS.shed.d / 2 + 1.0;
    if (MODEL_SOURCE.shed === 'procedurale') {
      // v26: il bottino è dentro (sul tappeto) e spesso c'è un forziere ai piedi del letto
      const pr = chunkAt(x, z).props[chunkAt(x, z).props.length - 1];
      const [lx, lz] = shedWorld(pr, 0.2, 0.55);
      lootSpots.push(new THREE.Vector3(lx, base + SHED.floor + 0.05, lz));
      if (srand() < 0.6) { const [cx2, cz2] = shedWorld(pr, 1.45, 0.95); chestSpots.push({ pos: new THREE.Vector3(cx2, base + SHED.floor, cz2), rot: rot + Math.PI / 2 }); }
    } else lootSpots.push(new THREE.Vector3(x + fx * dd, terrainHeight(x + fx * dd, z + fz * dd), z + fz * dd));
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

  yield 'bottino sparso';
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

  yield 'acqua';
  // ── acqua (unica, enorme e leggera) ──
  const waterNormal = makeWaterNormal();
  waterNormal.repeat.set(6000 / 22, 6000 / 22);
  // mappa di profondità dell'acqua (R = profondità/8 m) per colore, trasparenza e schiuma sulla riva
  const depthTex = (() => {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d', WRF), img = g.createImageData(S, S), d = img.data;
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
      // v24: alberi lontani come coni / chiome sfaccettate (prima erano parallelepipedi scuri che all'orizzonte sembravano monoliti neri)
      let g = b.shape === 'cone' ? new THREE.ConeGeometry(b.w / 2, b.h, 6, 1)
        : b.shape === 'blob' ? new THREE.IcosahedronGeometry(b.w / 2, 0).scale(1, b.h / b.w, 1)
        : new THREE.BoxGeometry(b.w, b.h, b.d);
      if (b.ry) g.rotateY(b.ry);
      if (g.index) { const ng = g.toNonIndexed(); g.dispose(); g = ng; }
      if (b.shape) g.computeVertexNormals();
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

  const LOD_TREE = { pine: ['#2b5c30', 2.6, 6, 4], oak: ['#417f30', 2.8, 6, 4.7], birch: ['#82b23a', 2.2, 5, 5.5], snowPine: ['#9fb3ad', 2.5, 6, 4], autumnOak: ['#b2321f', 2.8, 5, 4.7], autumnBirch: ['#d8722a', 2.4, 5, 5.2], palm: ['#4a9a40', 3.2, 1.2, 6.2], cactus: ['#4a9a38', 0.9, 5, 2.4], deadTree: ['#6b5a4a', 0.6, 3.5, 1.8] };
  function buildLod(ch) {
    const group = new THREE.Group();
    const t = new THREE.Mesh(terrainGeo(ch, LSEG, 0.35), lodMat);
    t.receiveShadow = false;
    group.add(t);
    const blocks = [];
    for (const h of ch.houses) {
      const lh = h.lodH ?? 4.7;
      blocks.push({ w: h.w, h: lh, d: h.d, x: h.cx, y: h.baseY + lh / 2, z: h.cz, color: h.wallColor, top: h.roofColor });
      if (h.pitch) for (let k = 1; k <= 2; k++) {                       // tetto a falde: due gradoni
        const f = 1 - k / 3, ax = h.pitch.alongX;
        blocks.push({ w: ax ? h.w + 0.6 : (h.w + 1.5) * f, h: h.pitch.rise / 3, d: ax ? (h.d + 1.5) * f : h.d + 0.6, x: h.cx, y: h.baseY + lh + h.pitch.rise * (k - 0.5) / 3, z: h.cz, color: h.roofColor, top: h.roofColor });
      }
    }
    for (const b of ch.boxes) if (b.lodColor) blocks.push({ w: b.w, h: b.h, d: b.d, x: b.x, y: b.y, z: b.z, color: b.lodColor });
    for (const pr of ch.props) if (pr.type === 'shed') {
      const D = PROP_DIMS.shed, q90 = Math.round(pr.rot / (Math.PI / 2)) % 2 !== 0;
      blocks.push({ w: q90 ? D.d - 0.6 : D.w - 0.6, h: D.h * 0.8, d: q90 ? D.w - 0.6 : D.d - 0.6, x: pr.x, y: pr.y + D.h * 0.4, z: pr.z, color: '#8e959c', top: '#4f6274' });
    }
    // alberi lontani: un cono semplice ogni 3 alberi
    for (let i = 0; i < ch.trees.length; i += 2) {
      const tr = ch.trees[i];
      const lc = LOD_TREE[tr.k] || LOD_TREE.oak;
      const cone = /pine/i.test(tr.k), thin = tr.k === 'cactus' || tr.k === 'deadTree';
      const sz = tr.s * 1.15, ry = (tr.x * 7.1 + tr.z * 3.3) % 6.28;
      // tronco sottile + chioma: cono per i pini, poliedro per le latifoglie
      const base = Math.max(0.4, lc[3] - lc[2] / 2) * sz;
      if (!thin) blocks.push({ w: 0.4 * sz, h: base + 0.6, d: 0.4 * sz, x: tr.x, y: tr.h + (base + 0.6) / 2, z: tr.z, color: '#6b4a32' });
      if (thin) blocks.push({ w: lc[1] * sz, h: lc[2] * sz, d: lc[1] * sz, x: tr.x, y: tr.h + lc[3] * sz, z: tr.z, color: lc[0] });
      else if (cone) blocks.push({ w: lc[1] * sz * 1.3, h: lc[2] * sz * 1.15, x: tr.x, y: tr.h + base + lc[2] * sz * 0.575, z: tr.z, color: lc[0], shape: 'cone', ry });
      else blocks.push({ w: lc[1] * sz * 1.3, h: Math.min(lc[2], lc[1] * 1.5) * sz * 1.1, x: tr.x, y: tr.h + lc[3] * sz, z: tr.z, color: lc[0], shape: 'blob', ry });
    }
    const bg = mergedBlocks(blocks);
    if (bg) group.add(new THREE.Mesh(bg, blockMat));
    scene.add(group);
    ch.lod = group;
  }

  // geometrie condivise per alberi/rocce/erba
  yield 'erba';
  // ── erba: ciuffi di fili sottili (colori per vertice: scuri alla base, chiari in punta) ──
  /**
   * Ciuffo d'erba: fili curvi a 3 segmenti che si assottigliano fino alla punta.
   * Le normali sono a metà tra "verso l'alto" e la faccia del filo, così ogni filo prende la luce
   * in modo diverso secondo l'orientamento (volume invece di un tappeto piatto).
   */
  function makeTuft(blades, seed, h0 = 0.32, hr = 0.42, rad = 0.16, wMul = 1, dryK = 0.18, lite = false) {
    // fili veri in 3D: sezione a "V" (piegati lungo la nervatura centrale), 4 segmenti curvi,
    // ogni metà ha la sua normale → un lato prende luce e l'altro resta in ombra, come l'erba vera
    const rnd = mulberry32(seed);
    const P = [], C = [], N = [];
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();
    for (let b = 0; b < blades; b++) {
      const a = rnd() * 6.283, r0 = Math.sqrt(rnd()) * rad, h = h0 + rnd() * hr, w = (0.034 + rnd() * 0.026) * wMul;
      const lean = 0.12 + rnd() * 0.36, la = a + (rnd() - 0.5) * 0.9;
      const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0;
      const fa = la + Math.PI / 2 + (rnd() - 0.5) * 0.8;        // la lama guarda verso dove si piega
      const px = Math.cos(fa) * w, pz = Math.sin(fa) * w;         // mezza larghezza
      const fnx = -Math.sin(fa), fnz = Math.cos(fa);              // lato della piega (nervatura in fuori)
      const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;   // curvatura
      const fold = 0.55 + rnd() * 0.35;                           // profondità della V
      const tone = 0.88 + rnd() * 0.26, dry = rnd() < dryK ? 1 : 0;
      // punti lungo il filo: t, larghezza relativa, luminosità
      const st = lite ? [[0, 0.9, 0.36], [0.5, 0.85, 0.78], [1, 0, 1.15]] : [[0, 0.85, 0.32], [0.28, 1, 0.58], [0.55, 0.85, 0.8], [0.8, 0.52, 0.98], [1, 0, 1.18]];
      const ring = st.map(([t, k, c]) => {
        const cx = bx + lx * t * t, cz = bz + lz * t * t, y = h * t * (1 - lean * 0.28 * t);
        const m = w * fold * k;
        return { L: [cx - px * k, y, cz - pz * k], M: [cx + fnx * m, y + w * 0.15 * k, cz + fnz * m], R: [cx + px * k, y, cz + pz * k], c };
      });
      const tri = (v0, c0, v1, c1, v2, c2) => {
        _a.set(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]);
        _b.set(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]);
        _n.crossVectors(_a, _b).normalize();
        if (_n.x * fnx + _n.z * fnz < 0) _n.negate();             // normale verso il lato esterno della V
        _n.y = _n.y * 0.7 + 0.32; _n.normalize();                 // un po' verso l'alto: niente fili neri controluce
        for (const [v, c] of [[v0, c0], [v1, c1], [v2, c2]]) {
          P.push(v[0], v[1], v[2]); N.push(_n.x, _n.y, _n.z);
          const cc = c * tone;
          C.push(cc * (dry ? 1.18 : 1), cc * (dry ? 1.05 : 1), cc * (dry ? 0.68 : 1));
        }
      };
      for (let i = 0; i < ring.length - 1; i++) {
        const A = ring[i], B = ring[i + 1];
        // metà sinistra (L-M) e destra (M-R); la nervatura è un po' più chiara
        const cm = 1.07;
        if (i < ring.length - 2) {
          tri(A.L, A.c, A.M, A.c * cm, B.M, B.c * cm); tri(A.L, A.c, B.M, B.c * cm, B.L, B.c);
          tri(A.M, A.c * cm, A.R, A.c, B.R, B.c); tri(A.M, A.c * cm, B.R, B.c, B.M, B.c * cm);
        } else {
          tri(A.L, A.c, A.M, A.c * cm, B.M, B.c); tri(A.M, A.c * cm, A.R, A.c, B.M, B.c);
        }
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
  const tuftGeo = makeTuft(9, 9001, 0.3, 0.42, 0.22);
  const tuftFarGeo = makeTuft(6, 9002, 0.34, 0.4, 0.26, 1.25, 0.18, true);
  const tallGeo = makeTuft(7, 4242, 0.85, 0.6, 0.3, 1.5, 0.3);   // erba alta: fili fino a 1,45 m
  const flowerGeo = makeFlower();
  /** materiale dell'erba: vento a raffiche, si piega attorno al giocatore e sfuma con la distanza */
  function grassMaterial(fade0, fade1, key, sway = 0.55, scaled = true, flat = false) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = WIND;
      sh.uniforms.uPlayer = GRASS_PLAYER;
      sh.uniforms.uFadeK = GRASS_FADE;
      // doppia faccia: si usa sempre la normale "esterna" della V (le due metà del filo restano
      // una più chiara e una più scura da qualunque lato le guardi); un filo di traslucenza nelle foglie
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (flat ? '' : ' totalEmissiveRadiance += diffuseColor.rgb * vec3(0.04, 0.07, 0.015);'));
    sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform vec3 uPlayer;\nuniform float uFadeK;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float hg = max(transformed.y, 0.0);
            float gust = 0.55 + 0.45 * sin(uWind * 0.6 + ip.x * 0.018 + ip.z * 0.013);
            float ph = uWind * 2.2 + ip.x * 0.23 + ip.z * 0.19;
            float sw = (sin(ph) * 0.6 + sin(ph * 2.7 + 1.3) * 0.25) * gust * hg * hg * ${sway.toFixed(2)};
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
            transformed *= 1.0 - smoothstep(${fade0.toFixed(1)}${scaled ? ' * uFadeK' : ''}, ${fade1.toFixed(1)}${scaled ? ' * uFadeK' : ''}, dc);
          }`);
    };
    mat.customProgramCacheKey = () => 'grass-' + key;
    return mat;
  }
  const grassNearMat = grassMaterial(42, 62, 'near');
  const grassFarMat = grassMaterial(140, 190, 'far', 0.55, false);
  const flowerMat = grassMaterial(40, 60, 'flower', 0.55, true, true);
  const fernMat = grassMaterial(46, 66, 'fern', 0.22);
  const tallMat = grassMaterial(95, 135, 'tall', 0.16, false);
  /** dove può crescere l'erba (niente acqua, sabbia, rocce ripide, neve, strade e piazze) */
  function grassOK(x, z, h, slope = 0) {
    if (h < WATER_LEVEL + 1.2 || h > 38 || slope > 0.7) return false;
    // niente erba sulla neve e nella sabbia del deserto (bordo sfumato)
    const bw = biomeAt(x, z);
    if (bw[1] > 0.32 + 0.25 * Math.sin(x * 0.37 + z * 0.29) * Math.sin(z * 0.21) || bw[2] > 0.5 + 0.2 * Math.sin(x * 0.3 - z * 0.23)) return false;
    if (inTown(x, z, -5)) return false;
    if (roadDist(x, z) < 2.8) return false;
    return true;
  }
  /** true se in (x,z) c'è un box a livello del suolo (pavimenti, casette, casse) */
  function underBox(x, z, h) {
    for (const c of queryColliders(x, z, 0.3)) {
      if (c.type === 'cyl' || c.type === 'ring') continue;
      if (c.minY < h + 0.4 && x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2) return true;
    }
    return false;
  }
  // campo d'erba fitta attorno alla telecamera, a celle da 32 m costruite poco per volta
  const GCELL = 32;
  let grassVer = QUALITY.version;
  const grassCells = new Map();
  function buildGrassCell(gx, gz) {
    const rnd = mulberry32((gx * 92837111) ^ (gz * 689287499) ^ 0x5bd1e995);
    const x0 = gx * GCELL, z0 = gz * GCELL;
    const NT = Math.max(1, Math.round(GCELL * GCELL * QUALITY.grassDens)), NF = Math.round(110 * Math.min(1, QUALITY.grassDens / 0.8)), NP = 16;
    const grp = new THREE.Group();
    const gm = new THREE.InstancedMesh(tuftGeo, grassNearMat, NT);
    const fm = new THREE.InstancedMesh(flowerGeo, flowerMat, NF);
    const pm = new THREE.InstancedMesh(PROPS.pebbles, rockMaterial, NP);
    // dettagli del sottobosco: funghi, ceppi e felci (solo estetici, senza collisioni)
    const NMx = 5, NSx = 2, NFe = Math.round(10 * Math.min(1, QUALITY.grassDens / 0.8));
    const mm = PROPS.mushrooms.map(g => new THREE.InstancedMesh(g, propMaterial, NMx));
    const sm = PROPS.stumps.map(g => new THREE.InstancedMesh(g, propMaterial, NSx));
    const fe = new THREE.InstancedMesh(PROPS.fern, fernMat, Math.max(1, NFe));
    const mc = mm.map(() => 0), scnt = sm.map(() => 0); let nfe = 0;
    {
      const rnd2 = mulberry32((gx * 19349663) ^ (gz * 83492791) ^ 0x1234567);
      for (let i = 0; i < NMx * 2 + NSx * 2 + NFe; i++) {
        const x = x0 + rnd2() * GCELL, z = z0 + rnd2() * GCELL, r1 = rnd2(), r2 = rnd2();
        const h = terrainHeight(x, z);
        if (!grassOK(x, z, h) || underBox(x, z, h) || inTown(x, z, 2)) continue;
        const b = biomeAt(x, z);
        if (b[2] > 0.45 || b[1] > 0.6) continue;                 // niente sottobosco nel deserto e sulla neve
        const forest = forestK(x, z);
        q.setFromAxisAngle(up, r1 * 6.28);
        if (i < NMx * 2) {                                      // funghi nelle zone più ombrose
          if (forest < 0.55) continue;
          const k = Math.floor(r2 * 3 * 0.999), im = mm[k]; if (mc[k] >= NMx) continue;
          const s = 0.8 + r2 * 0.6; sc.set(s, s, s); p.set(x, h - 0.02, z); mat4.compose(p, q, sc); im.setMatrixAt(mc[k]++, mat4);
        } else if (i < NMx * 2 + NSx * 2) {                     // ceppi
          if (forest < 0.7) continue;
          const k = r2 < 0.5 ? 0 : 1; if (scnt[k] >= NSx) continue;
          const s = 0.85 + r2 * 0.5; sc.set(s, s, s); p.set(x, h - 0.05, z); mat4.compose(p, q, sc); sm[k].setMatrixAt(scnt[k]++, mat4);
        } else {                                                // felci
          if (forest < 0.45 || b[3] > 0.5 || nfe >= NFe) continue;
          const s = 0.8 + r2 * 0.7; sc.set(s, s * (0.8 + r1 * 0.4), s); p.set(x, h - 0.03, z); mat4.compose(p, q, sc); fe.setMatrixAt(nfe++, mat4);
        }
      }
    }
    let n = 0, nf = 0, np = 0;
    const flowerCols = ['#b48cff', '#9a6ad8', '#c49aff', '#ffffff', '#b48cff', '#ffe14d', '#8a5cd0', '#ff7eb6'];   // v36: prati fioriti di viola
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
        if (r3 > 0.25 + fpatch * 0.75 || biomeAt(x, z)[3] > 0.6) continue;
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
    for (const [im, cnt] of [[gm, n], [fm, nf], [pm, np], [fe, nfe], ...mm.map((im, k) => [im, mc[k]]), ...sm.map((im, k) => [im, scnt[k]])]) {
      if (im !== gm && im !== fm && im !== fe && im !== pm) im.castShadow = cnt > 0;
      im.count = cnt;
      if (!cnt) continue;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      grp.add(im);
    }
    scene.add(grp);
    return { grp, ims: [gm, fm, pm, fe, ...mm, ...sm] };
  }
  function disposeGrassCell(c) {
    scene.remove(c.grp);
    for (const im of c.ims) im.dispose();
  }
  function updateGrass(camPos, t0, budgetMs) {
    const groundY = terrainHeight(camPos.x, camPos.z);
    const GR = QUALITY.grassR;
    if (grassVer !== QUALITY.version) { grassVer = QUALITY.version; for (const c of grassCells.values()) disposeGrassCell(c); grassCells.clear(); }
    const high = camPos.y - groundY > 70 || !QUALITY.grassOn;            // dal bus / in caduta l'erba fitta non serve
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
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), p2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), eul = new THREE.Euler();
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

  /** v33: box statici del chunk in un gruppo a parte (si ricostruisce da solo quando una parete si rompe) */
  function buildBoxes(ch, group) {
    // box statici uniti per materiale; i tetti restano separati (uno per casa) per poterli nascondere
    const byMat = new Map(), byGeo = new Map();
    const roofGroups = new Map();
    for (const b of ch.boxes) {
      if (b.dead) continue;   // v33: pezzi distrutti (o sostituiti dai frammenti)
      if (b.roof && b.house) {
        clipMat(b.material);
        let rg = roofGroups.get(b.house);
        if (!rg) { rg = new THREE.Group(); roofGroups.set(b.house, rg); group.add(rg); b.house.roofMesh = rg; }
        const mesh = new THREE.Mesh(b.geo || boxGeometry(b), b.material);
        mesh.position.set(b.x, b.y, b.z);
        if (b.rotY) mesh.rotation.y = b.rotY;
        mesh.castShadow = b.cast; mesh.receiveShadow = true;
        rg.add(mesh);
        continue;
      }
      clipMat(b.material);
      if (b.geo) {
        // v24: geometrie uguali (lampade, piante, insegne, tende…) → una sola InstancedMesh
        const gk = b.geo.uuid + b.material.uuid + (b.cast ? 1 : 0);
        let e = byGeo.get(gk);
        if (!e) { e = { geo: b.geo, material: b.material, cast: b.cast, list: [] }; byGeo.set(gk, e); }
        e.list.push(b);
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
    for (const e of byGeo.values()) {
      if (e.list.length === 1) {
        const b = e.list[0], mesh = new THREE.Mesh(b.geo, b.material);
        mesh.position.set(b.x, b.y, b.z); if (b.rotY) mesh.rotation.y = b.rotY;
        mesh.castShadow = b.cast; mesh.receiveShadow = true;
        group.add(mesh);
        continue;
      }
      const im = new THREE.InstancedMesh(e.geo, e.material, e.list.length);
      e.list.forEach((b, i) => { q.setFromAxisAngle(up, b.rotY || 0); p.set(b.x, b.y, b.z); sc.set(1, 1, 1); mat4.compose(p, q, sc); im.setMatrixAt(i, mat4); });
      im.castShadow = e.cast; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  }
  function buildDetail(ch) {
    const group = new THREE.Group();
    const terrain = new THREE.Mesh(terrainGeo(ch, DSEG, 0), terrainMat);
    terrain.receiveShadow = true;
    group.add(terrain);
    { const bg = new THREE.Group(); buildBoxes(ch, bg); group.add(bg); ch.boxGroup = bg; }
    for (const dr of ch.doors) if (!dr.broken) buildDoorLeaves(dr, group);
    // alberi: abete, quercia, betulla (modelli low-poly con colori per vertice)
    if (ch.trees.length) {
      const kinds = {};
      for (const t of ch.trees) (kinds[t.k] || (kinds[t.k] = [])).push(t);
      ch.treeHi = []; ch.treeLo = [];
      for (const [k, list] of Object.entries(kinds)) {
        const placeTree = (t, i, im) => {
          q.setFromAxisAngle(up, t.rot); sc.set(t.s, t.s * (0.92 + (t.light - 0.28) * 1.2), t.s); p.set(t.x, t.h - 0.15, t.z);
          mat4.compose(p, q, sc);
          im.setMatrixAt(i, mat4);
          const v = 0.86 + (t.light - 0.28) * 1.1, hs = (t.hue - 0.28) * 2.2;
          im.setColorAt(i, col.setRGB(v * (1 + hs * 0.6), v, v * (1 - hs * 0.4)));
        };
        for (const low of [false, true]) {
          const im = instanced(PROPS[low ? k + 'Low' : k], (!low && TREE_MATS[k]) || treeMaterial, list, placeTree);
          if (!im) continue;
          if (low) { im.castShadow = false; im.visible = false; }
          group.add(im);
          (low ? ch.treeLo : ch.treeHi).push(im);
        }
        // v35: chioma a carte di foglie (solo nella versione dettagliata)
        if (LEAVES[k]) { const lm = instanced(LEAVES[k], leafMaterial, list, placeTree); if (lm) { group.add(lm); ch.treeHi.push(lm); } }
      }
    }
    // rocce (5 forme): sono statiche, quindi vengono unite in un'unica geometria per chunk (1 draw call)
    if (ch.rocks.length) {
      const nm = new THREE.Matrix3();
      let total = 0;
      for (const r of ch.rocks) if (!r.dead) total += PROPS.rocks[(r.shape ?? 0) % PROPS.rocks.length].attributes.position.count;
      const P = new Float32Array(total * 3), Nn = new Float32Array(total * 3), C = new Float32Array(total * 3), SF = new Float32Array(total * 2);
      let o = 0;
      const v = new THREE.Vector3();
      for (const r of ch.rocks) {
        if (r.dead) continue;
        const g = PROPS.rocks[(r.shape ?? 0) % PROPS.rocks.length];
        // arenaria rossa nel deserto, roccia fredda e innevata in montagna
        const bw = biomeAt(r.x, r.z), tR = 1 + bw[2] * 0.35 - bw[1] * 0.04, tG = 1 + bw[2] * 0.02, tB = 1 - bw[2] * 0.3 + bw[1] * 0.06;
        const snowTop = bw[1] > 0.4 || r.h > 46;
        // v22: neve e muschio sfumati dallo shader (prima erano triangoli bianchi/verdi a caso)
        const sSnow = snowTop ? 1 : Math.max(0, (bw[1] - 0.15) * 2), sMoss = snowTop ? 0 : Math.max(0, 1 - bw[2] * 2.5 - bw[1] * 2) * (0.35 + (Math.abs(Math.sin(r.x * 12.9 + r.z * 78.2)) * 0.65));
        q.setFromEuler(eul.set(r.e[0] * 0.3, r.e[1], r.e[2] * 0.3));
        sc.set(r.s * r.k[0], r.s * r.k[1], r.s * r.k[2]);
        p.set(r.x, r.h + r.s * 0.15, r.z);
        mat4.compose(p, q, sc);
        nm.getNormalMatrix(mat4);
        const gp = g.attributes.position, gn = g.attributes.normal, gc = g.attributes.color;
        for (let i = 0; i < gp.count; i++, o++) {
          v.fromBufferAttribute(gp, i).applyMatrix4(mat4); P[o * 3] = v.x; P[o * 3 + 1] = v.y; P[o * 3 + 2] = v.z;
          v.fromBufferAttribute(gn, i).applyMatrix3(nm).normalize(); Nn[o * 3] = v.x; Nn[o * 3 + 1] = v.y; Nn[o * 3 + 2] = v.z;
          C[o * 3] = Math.min(1, gc.getX(i) * tR); C[o * 3 + 1] = gc.getY(i) * tG; C[o * 3 + 2] = gc.getZ(i) * tB;
          SF[o * 2] = sSnow; SF[o * 2 + 1] = sMoss;
        }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(P, 3));
      rg.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
      rg.setAttribute('color', new THREE.BufferAttribute(C, 3));
      rg.setAttribute('aSurf', new THREE.BufferAttribute(SF, 2));
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
        const matl = type === 'barrelBlue' || type === 'barrelRed' ? metalPropMaterial : type === 'logs' ? logMaterial : type === 'shed' && PROPS.shed.attributes.aTile ? shedMaterial : propMaterial;
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
    ch.doorPiv = [];   // v43: ante delle porte: spariscono da lontano (le maniglie ancora prima)
    for (const dr of ch.doors) if (dr.leaves) ch.doorPiv.push(...dr.leaves);
    if (ch.bushes.length) {
      const lists = PROPS.bushes.map(() => []);
      for (const b of ch.bushes) lists[b.v].push(b);
      lists.forEach((list, k) => {
        const placeBush = (b, i, im) => {
          q.setFromAxisAngle(up, b.rot); sc.set(b.s, b.s * 0.9, b.s); p.set(b.x, b.h - 0.1, b.z);
          mat4.compose(p, q, sc);
          im.setMatrixAt(i, mat4);
          groundColor(b.x, b.z, b.h, col, 0.2);
          const v = 0.85 + Math.min(0.3, (col.g - 0.45) * 0.6);
          // tinta del bioma: foglie rosse in autunno, brinate sulla neve, secche nel deserto
          const bw = biomeAt(b.x, b.z), wA = bw[3], wS = bw[1], wD = bw[2];
          const tr = 1 + wA * 0.5 + wS * 0.1 + wD * 0.25, tg = 1 - wA * 0.2 + wS * 0.12, tb = 1 - wA * 0.5 + wS * 0.25 - wD * 0.35;
          im.setColorAt(i, col.setRGB(v * tr, v * tg, v * 0.95 * tb));
        };
        for (const [geo, matl] of [[PROPS.bushes[k], bushMaterial], [LEAVES.bushes[k], bushLeafMaterial]]) {
          const im = geo && instanced(geo, matl, list, placeBush);
          if (im) { im.castShadow = false; group.add(im); ch.nearOnly.push(im); }
        }
      });
    }
    // ciuffi d'erba radi per la media distanza (quelli fitti li gestisce grassField)
    {
      const rnd = mulberry32((ch.cx * 73856093) ^ (ch.cz * 19349663));
      const N = 280, gm = new THREE.InstancedMesh(tuftFarGeo, grassFarMat, N);
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
    // erba alta: le macchie che toccano questo chunk
    {
      const list = TALL.filter(p => p.x + p.r > ch.x0 && p.x - p.r < ch.x0 + CHUNK && p.z + p.r > ch.z0 && p.z - p.r < ch.z0 + CHUNK);
      let total = 0;
      for (const p of list) total += Math.round(Math.PI * p.r * p.r * 1.5);
      if (total) {
        const im = new THREE.InstancedMesh(tallGeo, tallMat, total);
        let n = 0;
        for (const p of list) {
          const rnd = mulberry32(p.seed), N = Math.round(Math.PI * p.r * p.r * 1.5);
          for (let i = 0; i < N; i++) {
            const a = rnd() * 6.283, d = Math.sqrt(rnd()) * p.r * 1.05, r1 = rnd(), r2 = rnd();
            const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
            if (x < ch.x0 || x >= ch.x0 + CHUNK || z < ch.z0 || z >= ch.z0 + CHUNK) continue;
            if (!tallGrassAt(x, z) && r1 > 0.3) continue;           // bordo sfrangiato
            const h = terrainHeight(x, z);
            if (h < WATER_LEVEL + 0.8) continue;
            const edge = tallGrassAt(x, z) ? 1 : 0.6;
            q.setFromAxisAngle(up, r2 * 6.28); const sc0 = (0.8 + r1 * 0.45) * edge; sc.set(1, sc0, 1); p2.set(x, h - 0.05, z);
            mat4.compose(p2, q, sc); im.setMatrixAt(n, mat4);
            groundColor(x, z, h, col, 0.1);
            im.setColorAt(n, col.lerp(_gc.dry, 0.18 + r2 * 0.2).multiplyScalar(1.0 + r1 * 0.15));
            n++;
          }
        }
        im.count = n; im.receiveShadow = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        group.add(im); ch.nearOnly.push(im);
      }
    }
    // oggetti speciali (v24: instanziati per tipo, nelle città ce ne sono centinaia)
    const spec = new Map();
    for (const s of ch.specials) {
      if (s.dead) continue;
      if (SPECIAL_GEO[s.type]) {
        const k = s.type + '|' + (s.c || 0);
        if (!spec.has(k)) spec.set(k, []);
        spec.get(k).push(s);
        continue;
      }
      if (s.type === 'fountain') {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 1, 20), m('stone', '#b8b4a8'));
        f.position.set(s.x, s.h + 0.5, s.z); f.castShadow = f.receiveShadow = true; group.add(f);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 20), m('fwater', '#4aa8e0', { metalness: 0.3, roughness: 0.1 }));
        w.position.set(s.x, s.h + 0.95, s.z); group.add(w);
        const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 10), m('stone', '#b8b4a8'));
        pp.position.set(s.x, s.h + 2, s.z); pp.castShadow = true; group.add(pp);
      }
    }
    for (const list of spec.values()) {
      if (list[0].type === 'car') {
        // v25: auto realistiche, carrozzeria a colori per istanza + dettagli (vetri, gomme, cerchi, fari)
        for (const im of carInstances(list[0].c || 0, list, (s) => { q.setFromAxisAngle(up, s.rot || 0); p.set(s.x, s.h, s.z); sc.set(1, 1, 1); return mat4.compose(p, q, sc); }, scene.environment, (mt) => { clipMat(mt); return mt; })) group.add(im);
        continue;
      }
      clipMat(propMaterial); clipMat(civicMaterial);
      const sg = specialGeo(list[0].type, list[0].c);
      const im = new THREE.InstancedMesh(sg, sg.userData.rock ? rockMaterial : sg.userData.civic ? civicMaterial : propMaterial, list.length);   // v38: panchine e fontane con le texture   // v33: colline di roccia vera
      list.forEach((s, i) => { q.setFromAxisAngle(up, s.rot || 0); p.set(s.x, s.h, s.z); sc.set(1, 1, 1); mat4.compose(p, q, sc); im.setMatrixAt(i, mat4); });
      im.castShadow = im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
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
    for (const dr of ch.doors) dr.leaves = null;
    for (const pr of ch.props) { pr.im = null; }
  }

  // ═════════════ v33: strutture distruttibili ═════════════
  // Ogni box statico (pareti, pavimenti, solai, casse, mobili) si divide in celle da ~1,35 m sulle sue due
  // dimensioni maggiori: colpi, picconate ed esplosioni tolgono vita alle celle vicine al punto colpito e una
  // cella distrutta apre un buco (il box viene sostituito da pochi rettangoli che coprono le celle rimaste).
  // Dopo ogni rottura si controlla la gravità: i pezzi collegati fra loro che non toccano più il terreno
  // crollano tutti insieme e lasciano materiali. Il terreno, le strade e le lastre a terra non si rompono.
  const DCELL = 1.35, dirty = new Set(), dirtyB = new Set(), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // registro di ciò che è cambiato, per rimettere tutto a posto a inizio partita
  const REG = { chunks: new Map(), rocks: new Set(), specials: new Set(), doors: new Set(), houses: new Set() };
  const regChunk = (ch) => { if (ch && !REG.chunks.has(ch)) REG.chunks.set(ch, ch.boxes.slice()); };
  const offC = (c) => { if (c && !c.off) { removeCollider(c); c.off = true; } };
  const onC = (c) => { if (c && c.off) { c.off = false; addCollider(c); } };
  function resetBroken() {
    for (const [ch, orig] of REG.chunks) {
      for (const b of ch.boxes) if (b.frag) removeCollider(b.c);
      ch.boxes = orig;
      for (const b of orig) { if (b.dead) { b.dead = false; onC(b.c); } delete b.cg; }
      dirty.add(ch);
    }
    for (const r of REG.rocks) {
      if (r.c && !r.c.off) removeCollider(r.c);
      r.s = r.s0; r.dead = false; r.hp = undefined;
      r.c = addCollider({ type: 'cyl', x: r.x, z: r.z, r: r.s * 0.95, minY: r.h - 2, maxY: r.h + r.s * 0.9, rock: r });
      dirty.add(chunkAt(r.x, r.z));
    }
    for (const e of REG.specials) { e.dead = false; e.hp = undefined; onC(e.c); dirty.add(chunkAt(e.x, e.z)); }
    for (const dr of REG.doors) dr.broken = false;
    for (const h of REG.houses) h.collapsed = false;
    for (const k of Object.keys(REG)) REG[k].clear();
    if (dirty.size) flushDirty();
  }
  const terrMaxUnder = (c) => Math.max(terrainHeight((c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2), terrainHeight(c.minX + 0.05, c.minZ + 0.05), terrainHeight(c.maxX - 0.05, c.minZ + 0.05), terrainHeight(c.minX + 0.05, c.maxZ - 0.05), terrainHeight(c.maxX - 0.05, c.maxZ - 0.05));
  function breakable(sp) {
    if (sp.brk !== undefined) return sp.brk;
    const c = sp.c, big = Math.max(sp.w, sp.h, sp.d);
    const tg = terrainHeight(sp.x, sp.z);
    // lastre a terra (strade, marciapiedi, piazze, fondamenta) = mondo: non si rompono
    sp.brk = !!c && big < 70 && !(c.minY <= tg + 0.35 && sp.h < 0.75) && !(sp.h < 0.75 && Math.min(sp.w, sp.d) > 14);
    return sp.brk;
  }
  function cellHp(sp) {
    const m = sp.material;
    if (m && (m.transparent || m.opacity < 1)) return 12;                // vetri
    const t = Math.min(sp.w, sp.h, sp.d);
    return t > 0.55 ? 260 : t > 0.3 ? 180 : 130;                         // muri spessi (pietra) più duri
  }
  function initCells(sp) {
    const dims = [sp.w, sp.h, sp.d];
    let thin = 0; for (let i = 1; i < 3; i++) if (dims[i] < dims[thin]) thin = i;
    const ax = [0, 1, 2].filter(i => i !== thin);
    const n = ax.map(i => Math.max(1, Math.min(28, Math.round(dims[i] / DCELL))));
    const hp0 = cellHp(sp);
    sp.cg = { ax, n, hp: new Float32Array(n[0] * n[1]).fill(hp0), hp0, frags: [] };
  }
  const _ctr = [0, 0, 0];
  function cellCenter(sp, i, j, out = _ctr) {
    const g = sp.cg, base = [sp.x, sp.y, sp.z], dims = [sp.w, sp.h, sp.d];
    out[0] = base[0]; out[1] = base[1]; out[2] = base[2];
    out[g.ax[0]] = base[g.ax[0]] - dims[g.ax[0]] / 2 + (i + 0.5) * dims[g.ax[0]] / g.n[0];
    out[g.ax[1]] = base[g.ax[1]] - dims[g.ax[1]] / 2 + (j + 0.5) * dims[g.ax[1]] / g.n[1];
    return out;
  }
  /** rettangoli che coprono le celle vive (fusione golosa) → nuovi box e collisori */
  function rebuildFrags(sp) {
    const g = sp.cg, ch = chunkAt(sp.x, sp.z);
    regChunk(ch);
    if (!sp.dead) { sp.dead = true; offC(sp.c); }
    if (g.frags.length) { const set = new Set(g.frags); ch.boxes = ch.boxes.filter(b => !set.has(b)); for (const f of g.frags) removeCollider(f.c); }
    g.frags = [];
    const [na, nb] = g.n, used = new Uint8Array(na * nb), alive = (i, j) => g.hp[j * na + i] > 0 && !used[j * na + i];
    const dims = [sp.w, sp.h, sp.d], base = [sp.x, sp.y, sp.z];
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      if (!alive(i, j)) continue;
      let i1 = i; while (i1 + 1 < na && alive(i1 + 1, j)) i1++;
      let j1 = j; for (;;) { if (j1 + 1 >= nb) break; let ok = true; for (let k = i; k <= i1; k++) if (!alive(k, j1 + 1)) { ok = false; break; } if (!ok) break; j1++; }
      for (let jj = j; jj <= j1; jj++) for (let k = i; k <= i1; k++) used[jj * na + k] = 1;
      const d = dims.slice(), c = base.slice(), A = g.ax[0], B = g.ax[1], ca = dims[A] / na, cb = dims[B] / nb;
      d[A] = (i1 - i + 1) * ca; c[A] = base[A] - dims[A] / 2 + (i + (i1 - i + 1) / 2) * ca;
      d[B] = (j1 - j + 1) * cb; c[B] = base[B] - dims[B] / 2 + (j + (j1 - j + 1) / 2) * cb;
      const f = { w: d[0], h: d[1], d: d[2], x: c[0], y: c[1], z: c[2], material: sp.material, cast: sp.cast, house: sp.house, roof: sp.roof, mesh: null, frag: sp };
      f.c = addCollider({ type: 'box', minX: c[0] - d[0] / 2, maxX: c[0] + d[0] / 2, minY: c[1] - d[1] / 2, maxY: c[1] + d[1] / 2, minZ: c[2] - d[2] / 2, maxZ: c[2] + d[2] / 2, noStand: sp.c && sp.c.noStand });
      f.c.spec = sp; f.c.fragOf = f;
      ch.boxes.push(f); g.frags.push(f);
    }
    dirtyB.add(ch);
  }
  function specColor(sp) {
    const m = sp.material;
    if (sp.lodColor) return sp.lodColor;
    if (m && m.color) { const c = m.color; const k = m.map ? 0.75 : 1; return '#' + new THREE.Color(c.r * k, c.g * k, c.b * k).getHexString(); }
    return '#b0a090';
  }
  /** danno a un box nel punto p (raggio r: 0 = solo la cella colpita). Restituisce gli eventi per il gioco */
  function damageSpec(sp, p, amount, r, ev) {
    if (sp.dead && !sp.cg) return;
    if (!breakable(sp)) return;
    if (!sp.cg) initCells(sp);
    const g = sp.cg, [na, nb] = g.n, dims = [sp.w, sp.h, sp.d], base = [sp.x, sp.y, sp.z], P = [p.x, p.y, p.z];
    const A = g.ax[0], B = g.ax[1], ca = dims[A] / na, cb = dims[B] / nb;
    const fi = Math.floor((P[A] - (base[A] - dims[A] / 2)) / ca), fj = Math.floor((P[B] - (base[B] - dims[B] / 2)) / cb);
    let broke = 0;
    const hitCell = (i, j, dmg) => {
      if (i < 0 || j < 0 || i >= na || j >= nb) return;
      const k = j * na + i; if (g.hp[k] <= 0) return;
      g.hp[k] -= dmg;
      if (g.hp[k] <= 0) { broke++; const cc = cellCenter(sp, i, j); ev.cells.push({ x: cc[0], y: cc[1], z: cc[2], s: Math.max(ca, cb), color: specColor(sp), material: sp.material, thin: Math.min(...dims) }); }
    };
    if (r <= 0) hitCell(clamp(fi, 0, na - 1), clamp(fj, 0, nb - 1), amount);
    else {
      const ri = Math.ceil(r / ca) + 1, rj = Math.ceil(r / cb) + 1;
      for (let j = fj - rj; j <= fj + rj; j++) for (let i = fi - ri; i <= fi + ri; i++) {
        if (i < 0 || j < 0 || i >= na || j >= nb) continue;
        const cc = cellCenter(sp, i, j), dd = Math.hypot(cc[0] - p.x, cc[1] - p.y, cc[2] - p.z);
        if (dd < r + Math.max(ca, cb) * 0.5) hitCell(i, j, amount * (1 - Math.min(1, dd / (r + 0.5)) * 0.6));
      }
    }
    if (!broke) { ev.chipped = specColor(sp); return; }
    rebuildFrags(sp);
    ev.touched.add(sp);
  }
  yield 'gravità';
  // ── gravità: i pezzi collegati che non toccano più terra crollano ──
  const touching = (a, b, e = 0.06) => a.minX <= b.maxX + e && a.maxX >= b.minX - e && a.minY <= b.maxY + e && a.maxY >= b.minY - e && a.minZ <= b.maxZ + e && a.maxZ >= b.minZ - e;
  function structural(c) { return c && c.type === 'box' && c.spec && !(c.spec.dead && !c.spec.cg); }
  function grounded(c) { return c.minY <= terrMaxUnder(c) + 0.35; }
  function checkSupport(seeds, ev) {
    const seen = new Set();
    for (const s0 of seeds) {
      if (seen.has(s0) || !structural(s0) || colliders.indexOf(s0) < 0) continue;
      const comp = [], stack = [s0]; seen.add(s0);
      let ok = false;
      while (stack.length) {
        const c = stack.pop(); comp.push(c);
        if (grounded(c)) { ok = true; break; }
        if (comp.length > 700) { ok = true; break; }       // troppo grande: di sicuro appoggia da qualche parte
        const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, rr = Math.max(c.maxX - c.minX, c.maxZ - c.minZ) / 2 + 0.2;
        for (const n of queryColliders(cx, cz, rr)) if (!seen.has(n) && structural(n) && touching(c, n)) { seen.add(n); stack.push(n); }
      }
      if (!ok) collapse(comp, ev);
    }
  }
  function collapse(comp, ev) {
    const bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    const parents = new Set();
    for (const c of comp) { parents.add(c.spec); for (const k of ['minX', 'minY', 'minZ']) bb[k] = Math.min(bb[k], c[k]); for (const k of ['maxX', 'maxY', 'maxZ']) bb[k] = Math.max(bb[k], c[k]); }
    const falling = [];
    let vol = 0;
    const chs = new Set();
    for (let x = Math.floor(bb.minX / CHUNK) * CHUNK; x <= bb.maxX; x += CHUNK) for (let z = Math.floor(bb.minZ / CHUNK) * CHUNK; z <= bb.maxZ; z += CHUNK) { const ch = chunkAt(x + 1, z + 1); if (ch) chs.add(ch); }
    for (const sp of parents) { const c = chunkAt(sp.x, sp.z); if (c) chs.add(c); }
    const inBB = (x, y, z, up = 0) => x >= bb.minX - 0.2 && x <= bb.maxX + 0.2 && z >= bb.minZ - 0.2 && z <= bb.maxZ + 0.2 && y >= bb.minY - 0.3 && y <= bb.maxY + up;
    for (const ch of chs) {
      regChunk(ch);
      const keep = [];
      for (const b of ch.boxes) {
        const isParent = parents.has(b), mine = isParent || (b.frag && parents.has(b.frag)) || (!b.c && !b.frag && !b.dead && inBB(b.x, b.y, b.z, 5));
        if (!mine) { keep.push(b); continue; }
        if (isParent && b.dead) continue;                  // già sostituito dai frammenti
        if (b.frag) removeCollider(b.c); else offC(b.c);
        b.dead = true;
        if (!b.geo && b.w * b.h * b.d > 0.004) { vol += b.w * b.h * b.d; falling.push(b); }
      }
      ch.boxes = keep;
      for (const sp of ch.specials) if (!sp.dead && inBB(sp.x, sp.h + 0.2, sp.z, 1)) { sp.dead = true; offC(sp.c); REG.specials.add(sp); }
      for (const dr of ch.doors) if (!dr.broken && inBB(dr.x, dr.y + 1, dr.z, 1)) { if (dr.cOn) { removeCollider(dr.c); dr.cOn = false; } dr.broken = true; REG.doors.add(dr); }
      dirty.add(ch);
    }
    for (const sp of parents) { offC(sp.c); sp.dead = true; if (sp.cg) sp.cg.frags = []; }
    for (const h of houses) if (!h.collapsed && h.cx >= bb.minX && h.cx <= bb.maxX && h.cz >= bb.minZ && h.cz <= bb.maxZ) { h.collapsed = true; h.roofMesh = null; REG.houses.add(h); }
    falling.sort((a, b) => b.w * b.h * b.d - a.w * a.h * a.d);
    ev.collapses.push({ x: (bb.minX + bb.maxX) / 2, y: bb.minY, z: (bb.minZ + bb.maxZ) / 2, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY, d: bb.maxZ - bb.minZ, boxes: falling.slice(0, 70), mats: Math.round(clamp(vol * 3, 12, 240)) });
  }
  yield 'rocce, auto e oggetti';
  // ── rocce, auto e oggetti: vita propria, si rimpiccioliscono a tappe e poi spariscono ──
  function damageObj(c, amount, ev) {
    if (c.rock) {
      const r = c.rock;
      if (r.dead) return;
      if (r.hp === undefined) { if (r.s0 === undefined) r.s0 = r.s; r.hp0 = r.hp = Math.round(90 + r.s * 140); r.stage = 0; REG.rocks.add(r); }
      r.hp -= amount;
      const st = r.hp <= 0 ? 3 : r.hp < r.hp0 / 3 ? 2 : r.hp < r.hp0 * 2 / 3 ? 1 : 0;
      if (st === r.stage) { ev.chipped = '#8d8a84'; return; }
      const ch = chunkAt(r.x, r.z);
      removeCollider(r.c);
      ev.cells.push({ x: r.x, y: r.h + r.s * 0.5, z: r.z, s: r.s, color: '#8d8a84', rock: true });
      if (st >= 3) { r.dead = true; ev.objects.push({ kind: 'rock', x: r.x, y: r.h, z: r.z, s: r.s, mats: Math.round(8 + r.s * 14) }); }
      else { for (let k = r.stage; k < st; k++) r.s *= 0.78; r.c = addCollider({ type: 'cyl', x: r.x, z: r.z, r: r.s * 0.95, minY: r.h - 2, maxY: r.h + r.s * 0.9, rock: r }); }
      r.stage = st; dirty.add(ch);
      return;
    }
    if (c.special) {
      const e = c.special;
      if (e.dead) return;
      const big = e.type === 'car' || e.type === 'truck' || e.type === 'waterTower';
      if (e.hp === undefined) e.hp = big ? 420 : 140;
      e.hp -= amount;
      if (e.hp > 0) { ev.chipped = big ? '#6a6e74' : '#9a8a74'; return; }
      e.dead = true; offC(e.c); REG.specials.add(e);
      ev.objects.push({ kind: e.type, x: e.x, y: e.h, z: e.z, s: big ? 2.2 : 0.9, mats: big ? 45 : 12, car: e.type === 'car' });
      dirty.add(chunkAt(e.x, e.z));
    }
  }
  const newEv = () => ({ cells: [], collapses: [], objects: [], touched: new Set(), chipped: null });
  function finishEv(ev) {
    if (ev.touched.size) {
      const seeds = [];
      for (const sp of ev.touched) {
        const q = { minX: sp.x - sp.w / 2, maxX: sp.x + sp.w / 2, minY: sp.y - sp.h / 2, maxY: sp.y + sp.h / 2, minZ: sp.z - sp.d / 2, maxZ: sp.z + sp.d / 2 };
        for (const n of queryColliders(sp.x, sp.z, Math.max(sp.w, sp.d) / 2 + 0.3)) if (structural(n) && touching(q, n, 0.1)) seeds.push(n);
      }
      checkSupport(seeds, ev);
    }
    delete ev.touched;
    return ev;
  }
  /** colpo (proiettile o piccone) su un collisore nel punto p */
  function damageAt(c, p, amount) {
    const ev = newEv();
    if (!c) return ev;
    if (c.spec) damageSpec(c.spec, p, amount, 0, ev);
    else if (c.rock || c.special) damageObj(c, amount, ev);
    return finishEv(ev);
  }
  /** colpo arrivato dalla rete: si cerca il collisore che contiene il punto */
  function damagePoint(p, amount) {
    let best = null, bs = Infinity;
    const inside = (c, e) => c.type === 'box' ? (p.x >= c.minX - e && p.x <= c.maxX + e && p.y >= c.minY - e && p.y <= c.maxY + e && p.z >= c.minZ - e && p.z <= c.maxZ + e) : (Math.hypot(p.x - c.x, p.z - c.z) <= c.r + e && p.y >= c.minY && p.y <= c.maxY + e);
    for (const c of queryColliders(p.x, p.z, 0.3)) {
      if (!(c.spec || c.rock || c.special) || !inside(c, 0.12)) continue;
      // prima chi contiene davvero il punto, poi chi si può rompere
      const sc = (inside(c, 0.001) ? 0 : 1) + (c.spec && !breakable(c.spec) ? 2 : 0);
      if (sc < bs) { bs = sc; best = c; }
    }
    return damageAt(best, p, amount);
  }
  /** esplosione: celle e oggetti entro il raggio */
  function damageSphere(p, radius, amount) {
    const ev = newEv(), done = new Set();
    for (const c of queryColliders(p.x, p.z, radius + 1)) {
      const dx = Math.max(c.minX - p.x, 0, p.x - c.maxX), dy = Math.max(c.minY - p.y, 0, p.y - c.maxY), dz = Math.max(c.minZ - p.z, 0, p.z - c.maxZ);
      if (Math.hypot(dx, dy, dz) > radius) continue;
      if (c.spec) { if (!done.has(c.spec)) { done.add(c.spec); damageSpec(c.spec, p, amount, radius, ev); } }
      else if (c.rock || c.special) damageObj(c, amount * 0.8, ev);
    }
    return finishEv(ev);
  }
  /** ricostruisce subito i chunk cambiati (prima il nuovo, poi via il vecchio: niente buchi per un frame) */
  function flushDirty() {
    for (const ch of dirtyB) {
      if (dirty.has(ch) || !ch.detail || !ch.boxGroup) { dirty.add(ch); continue; }
      const old = ch.boxGroup;
      for (const h of ch.houses) h.roofMesh = null;
      const bg = new THREE.Group(); buildBoxes(ch, bg); ch.detail.add(bg); ch.boxGroup = bg;
      ch.detail.remove(old);
      old.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    }
    dirtyB.clear();
    for (const ch of dirty) {
      if (!ch.detail) continue;
      const old = ch.detail;
      ch.detail = null;
      for (const b of ch.boxes) b.mesh = null;
      for (const h of ch.houses) h.roofMesh = null;
      for (const dr of ch.doors) dr.leaves = null;
      for (const pr of ch.props) pr.im = null;
      buildDetail(ch);
      disposeGroup(old);
    }
    dirty.clear();
  }

  yield 'barili esplosivi';
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
    resetBroken();
    for (const dr of doors) { setDoor(dr, dr.open0, true); poseDoor(dr); }
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

  yield 'streaming';
  // ── streaming: costruisce i chunk vicini un po' per frame ──
  const stats = { detail: 0, lod: 0, built: 0 };
  let lastKey = '';
  let order = [];
  const chunkList = [...chunks.values()];

  function update(camPos, budgetMs = 6) {
    { const t = performance.now() * 0.001; waterNormal.offset.set(t * 0.012, t * 0.007); WIND.value = t % 1800; }
    if (dirty.size || dirtyB.size) flushDirty();
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
      for (const ch of chunkList) if (ch.detail && ch.dist > QUALITY.detailOut) unloadDetail(ch);
    }
    // priorità: dettaglio vicino → orizzonte lontano
    let work = 0;
    for (const ch of order) {
      if (performance.now() - t0 > budgetMs && work > 0) break;
      if (ch.dist <= QUALITY.detailIn && !ch.detail) { buildDetail(ch); stats.built++; work++; continue; }
      if (!ch.lod && ch.dist < 1400) { buildLod(ch); work++; }
    }
    // il terreno lontano si nasconde dove c'è quello dettagliato
    let nd = 0, nl = 0;
    for (const ch of chunkList) {
      if (ch.lod) { ch.lod.visible = !ch.detail; nl++; }
      if (ch.detail) {
        nd++;
        const dx = Math.max(ch.x0 - camPos.x, 0, camPos.x - (ch.x0 + CHUNK)), dz = Math.max(ch.z0 - camPos.z, 0, camPos.z - (ch.z0 + CHUNK));
        const near = Math.hypot(dx, dz) < QUALITY.nearOnly;
        if (ch.nearOnly) for (const im of ch.nearOnly) im.visible = near;
        if (ch.doorPiv) {
          const dd = Math.hypot(dx, dz), dn = dd < QUALITY.doorNear, hn = dd < QUALITY.hwNear;
          for (const pv of ch.doorPiv) { pv.visible = dn; if (pv.userData.hw) pv.userData.hw.visible = hn; pv.children[0].castShadow = dd < 50; }
        }
        const dTree = Math.hypot(dx, dz) < QUALITY.treeHi;
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

  yield 'minimappa pre-renderizzata';
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
    if (h < WATER_LEVEL) { const dp = Math.min(1, (WATER_LEVEL - h) / 9); r = 60 - 30 * dp; gg = 145 - 40 * dp; b = 205 - 20 * dp; }
    else {
      const bw = biomeAt(x, z), s = Math.max(0, Math.min(1, (h + 4) / 22));
      // colore del bioma
      r = (70 + 40 * s) * bw[0] + 236 * bw[1] + 222 * bw[2] + 196 * bw[3] + 70 * bw[4];
      gg = (130 + 40 * s) * bw[0] + 241 * bw[1] + 190 * bw[2] + 130 * bw[3] + 175 * bw[4];
      b = (55 + 20 * s) * bw[0] + 248 * bw[1] + 130 * bw[2] + 60 * bw[3] + 70 * bw[4];
      if (h < WATER_LEVEL + 1) { r = 220; gg = 205; b = 150; }
      const hx = terrainHeight(x + 2, z) - terrainHeight(x - 2, z), hz = terrainHeight(x, z + 2) - terrainHeight(x, z - 2);
      const slope = Math.hypot(hx, hz) / 4;
      const rk = Math.max(Math.min(1, Math.max(0, (h - 24) / 10)) * (1 - bw[1] * 0.7), Math.min(1, Math.max(0, (slope - 0.55) / 0.5)) * 0.8);
      const rc = bw[2] > 0.3 ? [190, 110, 65] : [135, 130, 120];
      r += (rc[0] - r) * rk; gg += (rc[1] - gg) * rk; b += (rc[2] - b) * rk;
      const sl = 46 - bw[1] * 30;
      if (h > sl) { const k = Math.min(1, (h - sl) / 8); r += (245 - r) * k; gg += (248 - gg) * k; b += (252 - b) * k; }
      // ombreggiatura del rilievo (luce da nord-ovest)
      const sh = Math.max(0.55, Math.min(1.3, 1 + (hx + hz) * 0.09));
      r *= sh; gg *= sh; b *= sh;
    }
    const i = (py * MM + px) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const k = MM / (HALF * 2);
  // strade disegnate come linee (molto più veloce che calcolarle per pixel)
  g.strokeStyle = 'rgb(170,145,100)'; g.lineWidth = 2.2; g.lineCap = 'round';
  for (const [a, b] of roads) { g.beginPath(); g.moveTo((a.x + HALF) * k, (a.z + HALF) * k); g.lineTo((b.x + HALF) * k, (b.z + HALF) * k); g.stroke(); }
  // v24: reticolo stradale delle città e piazze
  for (const t of TOWNS) {
    const pl = t.plan; if (!pl) continue;
    const cw = (pl.ch || (STREET.RW + STREET.SW)) * 2 * k;
    g.fillStyle = { dirt: 'rgb(150,120,82)', snow: 'rgb(214,220,228)', sand: 'rgb(214,192,140)', cobble: 'rgb(130,124,114)' }[pl.surf] || 'rgb(118,116,112)';
    for (const o of pl.ox) { const L = Math.sqrt(Math.max(0, pl.R * pl.R - o * o)); g.fillRect((t.x + o + HALF) * k - cw / 2, (t.z - L + HALF) * k, cw, 2 * L * k); }
    for (const o of pl.oz) { const L = Math.sqrt(Math.max(0, pl.R * pl.R - o * o)); g.fillRect((t.x - L + HALF) * k, (t.z + o + HALF) * k - cw / 2, 2 * L * k, cw); }
    if (pl.hp) { const hp = pl.hp * k; g.fillStyle = 'rgb(160,150,135)'; g.fillRect((t.x + HALF) * k - hp, (t.z + HALF) * k - hp, 2 * hp, 2 * hp); }
    if (t.wallS) { g.strokeStyle = 'rgb(120,112,100)'; g.lineWidth = Math.max(1.5, 2.4 * k); const ws = (t.wallS - 1.2) * k; g.strokeRect((t.x + HALF) * k - ws, (t.z + HALF) * k - ws, 2 * ws, 2 * ws); }
  }
  g.fillStyle = 'rgba(30,80,30,0.5)';
  for (const t of trees) g.fillRect((t.x + HALF) * k - 0.75, (t.z + HALF) * k - 0.75, 1.5, 1.5);
  g.fillStyle = 'rgba(150,170,60,0.55)';
  for (const p of TALL) { g.beginPath(); g.arc((p.x + HALF) * k, (p.z + HALF) * k, Math.max(1.5, p.r * k), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(60,40,30,0.9)';
  for (const h of houses) if (h.city) { g.fillStyle = h.city === 'capannone' ? 'rgba(70,80,90,0.95)' : 'rgba(110,60,45,0.95)'; g.fillRect((h.cx - h.w / 2 + HALF) * k, (h.cz - h.d / 2 + HALF) * k, Math.max(2, h.w * k), Math.max(2, h.d * k)); }
  g.fillStyle = 'rgba(60,40,30,0.9)';
  for (const h of houses) if (!h.city) g.fillRect((h.cx - h.w / 2 + HALF) * k, (h.cz - h.d / 2 + HALF) * k, Math.max(2, h.w * k), Math.max(2, h.d * k));

  // casette e cataste sulla minimappa
  for (const ch of chunks.values()) for (const pr of ch.props) {
    if (pr.type === 'shed') { g.fillStyle = 'rgba(120,70,40,0.95)'; g.fillRect((pr.x + HALF) * k - 1.5, (pr.z + HALF) * k - 1.5, 3, 3); }
  }

  /** libera tutta la grafica di questa mappa (prima di generarne un'altra) */
  function dispose() {
    for (const lm of landmarks) { scene.remove(lm); lm.geometry.dispose(); }
    scene.remove(water); water.geometry.dispose(); waterMat.dispose(); depthTex.dispose();
    for (const ch of chunkList) { if (ch.detail) unloadDetail(ch); if (ch.lod) { disposeGroup(ch.lod); ch.lod = null; } }
    for (const c of grassCells.values()) disposeGrassCell(c);
    grassCells.clear();
    for (const m of [terrainMat, lodMat, blockMat, stoneMat, brickMat, crateMat, ...wallMats, ...roofMats]) { if (m.map) m.map.dispose(); if (m.normalMap) m.normalMap.dispose(); m.dispose(); }
    for (const g of boxGeoCache.values()) g.dispose();
    boxGeoCache.clear();
  }

  Object.assign(stats, { city: cityStats });
  return { doors, stoves, setDoor, poseDoor, lootSpots, chestSpots, houses, barrels, minimap: mm, crateMat, woodTex, update, prewarm, stats, chunks, destroyBarrel, resetProps, damageAt, damageSphere, damagePoint, dispose, seed: MAP.seed, random: MAP.random };
}
