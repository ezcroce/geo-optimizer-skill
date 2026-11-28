// ─────────────────────────────────────────────────────────────
//  Città v24: reticolo di strade asfaltate con marciapiedi, piazza centrale, palazzi a più piani
//  (scale, solai, tetti praticabili), negozi con vetrine/insegne/tende, capannoni, case con giardino,
//  lampioni, panchine, auto parcheggiate, semafori, fermate del bus.
//  Tutto è fatto di box (uniti per materiale quando il chunk viene costruito) + oggetti "speciali" instanziati.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { CAR_VARIANTS, CAR_DIMS, CAR_PAINTS } from './cars.js?v=48';
import { mergeParts } from './props.js?v=48';
import {
  facadeTexture, plainTexture, asphaltTexture, sidewalkTexture, cobbleTexture, roofFlatTexture, tileTexture,
  concreteTexture, corrugatedTexture, railTexture, awningTexture, AWNING_COLORS, signAtlas, signGeometry, SHOPS,
  productsTexture, booksTexture,
} from './citytex.js?v=48';
import { TOWN_SPECIALS, townBuilders } from './townkit.js?v=48';

// ── reticolo stradale ──
export const STREET = { RW: 3.3, SW: 2.0 };          // mezza carreggiata, marciapiede
const CH = STREET.RW + STREET.SW;                    // mezzo corridoio (strada + marciapiede)

/** v27: ogni tema ha la sua pianta e il suo tipo di strada (asfalto, sampietrini, sterrato, neve, sabbia) */
const STREET_STYLE = {
  classic: { surf: 'asphalt', walk: 'sidewalk', rw: 3.3, sw: 2.0 },
  industrial: { surf: 'asphalt', walk: 'sidewalk', rw: 3.3, sw: 2.0 },
  port: { surf: 'asphalt', walk: 'sidewalk', rw: 3.3, sw: 2.0 },
  castle: { surf: 'cobble', walk: 'sidewalk', rw: 3.0, sw: 1.6 },
  alpine: { surf: 'snow', walk: null, rw: 2.6, sw: 0 },
  western: { surf: 'dirt', walk: 'plank', rw: 4.2, sw: 1.8 },
  coastal: { surf: 'sand', walk: 'plank', rw: 2.8, sw: 1.6 },
  farm: { surf: 'dirt', walk: null, rw: 2.5, sw: 0 },
};
/**
 * Pianta della città: linee parallele a z (ox = offset in x) e parallele a x (oz), piazza quadrata di mezzo lato hp.
 *  grid  → reticolo con la piazza nel blocco centrale (paese, zona industriale, porto, castello dentro le mura)
 *  main  → una sola via principale larga (western)
 *  lanes → due vicoli paralleli con la piazzetta in mezzo (alpino)
 *  cross → due stradine che si incrociano nella piazzetta (borgo marinaro)
 *  track → una carrareccia fra i campi (fattoria)
 */
export function planTown(t) {
  const th = t.theme || 'classic', st = STREET_STYLE[th] || STREET_STYLE.classic;
  const pl = { R: t.r - 3, ...st, ch: st.rw + st.sw, ox: [], oz: [], hp: 0, P: 36, layout: 'grid', wallS: 0, box: 0 };
  t.wallS = 0;
  if (th === 'western') { pl.layout = 'main'; pl.oz = [0]; }
  else if (th === 'alpine') { pl.layout = 'lanes'; if (16 < t.r - 13) { pl.ox = [-16, 16]; pl.hp = 16 - pl.ch - 0.8; } }
  else if (th === 'coastal') { pl.layout = 'cross'; pl.ox = [0]; pl.oz = [0]; pl.hp = 7.5; }
  else if (th === 'farm') { pl.layout = 'track'; pl.ox = [0]; }
  else {
    const ind = th === 'industrial' || th === 'port';
    const P = ind && t.r >= 66 ? 44 : 36, offs = [];
    for (let k = -4; k <= 3; k++) { const o = (k + 0.5) * P; if (Math.abs(o) < t.r - 13) offs.push(o); }
    pl.P = P; pl.ox = offs; pl.oz = offs.slice();
    if (offs.length >= 2) pl.hp = P / 2 - pl.ch;
    if (th === 'castle') { pl.wallS = t.r + 1; pl.box = pl.wallS - 3.2; t.wallS = pl.wallS + 2.4; }
  }
  pl.offs = pl.ox;
  t.plan = pl;
}
const lineLen = (pl, o) => Math.sqrt(Math.max(0, pl.R * pl.R - o * o));
/** 0 = niente, 1 = marciapiede/passerella, 2 = carreggiata, 3 = piazza */
export function streetAt(t, x, z) {
  const pl = t.plan; if (!pl) return 0;
  const lx = x - t.x, lz = z - t.z;
  if (lx * lx + lz * lz > (pl.R + 1) * (pl.R + 1)) return 0;
  if (pl.hp && Math.abs(lx) < pl.hp && Math.abs(lz) < pl.hp) return 3;
  let best = 0;
  for (const o of pl.ox) { const d = Math.abs(lx - o); if (d < pl.ch && Math.abs(lz) < lineLen(pl, o)) best = Math.max(best, d < pl.rw ? 2 : 1); }
  for (const o of pl.oz) { const d = Math.abs(lz - o); if (d < pl.ch && Math.abs(lx) < lineLen(pl, o)) best = Math.max(best, d < pl.rw ? 2 : 1); }
  return best;
}
/** il cerchio (x,z,r) tocca una strada o un marciapiede? */
export function onStreet(t, x, z, r = 0) {
  const pl = t.plan; if (!pl) return false;
  const lx = x - t.x, lz = z - t.z;
  for (const o of pl.ox) if (Math.abs(lx - o) < pl.ch + r && Math.abs(lz) < lineLen(pl, o) + r) return true;
  for (const o of pl.oz) if (Math.abs(lz - o) < pl.ch + r && Math.abs(lx) < lineLen(pl, o) + r) return true;
  if (pl.hp) { const hp = pl.hp + r; if (Math.abs(lx) < hp && Math.abs(lz) < hp) return true; }
  return false;
}

// ── oggetti speciali delle città (geometrie con colori per vertice, instanziate per chunk) ──
const P = (geo, color, o = {}) => ({ geo, color, o });
const CAR_COLORS = ['#c0392b', '#2471a3', '#f2f2f2', '#1f1f22', '#d4ac0d', '#7f8c8d', '#16a085', '#8e44ad', '#e67e22', '#2c3e50'];
export const CITY_SPECIALS = {
  lamp: () => mergeParts([
    P(new THREE.CylinderGeometry(0.17, 0.22, 0.6, 8), '#26302b', { y: 0.3 }),
    P(new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8), '#2b3530', { y: 2.6 }),
    P(new THREE.TorusGeometry(0.45, 0.04, 5, 10, Math.PI / 2), '#2b3530', { y: 4.45, z: 0.45, ry: Math.PI / 2, rz: 0 }),
    P(new THREE.BoxGeometry(0.06, 0.06, 0.55), '#2b3530', { y: 4.9, z: 0.72 }),
    P(new THREE.CylinderGeometry(0.12, 0.3, 0.26, 8), '#1f2622', { y: 4.78, z: 1.0 }),
    P(new THREE.CylinderGeometry(0.26, 0.2, 0.08, 8), '#fff4c8', { y: 4.62, z: 1.0, noSky: true, jit: 0 }),
  ], 1101),
  bench: () => {
    // v38: panchina da parco: listelli larghi di legno arancio verniciato e fianchi di ghisa nera a ricciolo
    const W = { tile: 0, ts: 1.9, grain: true, jit: 0.03 }, IRON = { tile: 3, ts: 1, jit: 0 };
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(P(new THREE.BoxGeometry(1.86, 0.045, 0.115), '#ffffff', { ...W, y: 0.47 - i * 0.004, z: 0.2 - i * 0.135 }));
    for (let i = 0; i < 3; i++) parts.push(P(new THREE.BoxGeometry(1.86, 0.115, 0.04), '#ffffff', { ...W, y: 0.64 + i * 0.15, z: -0.28 - i * 0.035, rx: -0.2 }));
    const tube = (pts, r = 0.028) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([y, z]) => new THREE.Vector3(0, y, z))), 18, r, 5, false);
    for (const x of [-0.8, 0.8]) {
      // gamba anteriore curva → bracciolo a ricciolo
      parts.push(P(tube([[0.0, 0.3], [0.2, 0.27], [0.44, 0.24], [0.6, 0.27], [0.66, 0.2], [0.62, 0.12], [0.55, 0.14]], 0.03), '#ffffff', { ...IRON, x }));
      // gamba posteriore → montante dello schienale
      parts.push(P(tube([[0.0, -0.3], [0.25, -0.24], [0.45, -0.22], [0.7, -0.29], [0.98, -0.37], [1.0, -0.38]], 0.032), '#ffffff', { ...IRON, x }));
      // traversa sotto il sedile e piedini
      parts.push(P(new THREE.BoxGeometry(0.05, 0.05, 0.6), '#ffffff', { ...IRON, x, y: 0.43, z: -0.01 }));
      parts.push(P(new THREE.BoxGeometry(0.09, 0.03, 0.12), '#ffffff', { ...IRON, x, y: 0.015, z: 0.3 }));
      parts.push(P(new THREE.BoxGeometry(0.09, 0.03, 0.12), '#ffffff', { ...IRON, x, y: 0.015, z: -0.3 }));
      // ricciolo decorativo fra le gambe
      parts.push(P(new THREE.TorusGeometry(0.07, 0.014, 4, 12), '#ffffff', { ...IRON, x, y: 0.25, z: 0.0, ry: Math.PI / 2 }));
    }
    const g = mergeParts(parts, 1102);
    g.userData.civic = true;
    return g;
  },
  bin: () => mergeParts([
    P(new THREE.CylinderGeometry(0.27, 0.23, 0.85, 10), '#2f5a3a', { y: 0.43 }),
    P(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 10), '#26302b', { y: 0.86 }),
    P(new THREE.BoxGeometry(0.05, 0.9, 0.05), '#26302b', { x: 0.3, y: 0.45 }),
  ], 1103),
  hydrant: () => mergeParts([
    P(new THREE.CylinderGeometry(0.13, 0.15, 0.62, 8), '#c8302a', { y: 0.31 }),
    P(new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#c8302a', { y: 0.62 }),
    P(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), '#d8d4cc', { y: 0.45, rz: Math.PI / 2 }),
  ], 1104),
  car: (c = 0) => {
    const col = CAR_COLORS[c % CAR_COLORS.length], glass = '#1d2a33';
    const parts = [
      P(new THREE.BoxGeometry(1.78, 0.55, 4.15), col, { y: 0.6, jit: 0.03 }),
      P(new THREE.BoxGeometry(1.6, 0.52, 2.1, 1, 1, 1), col, { y: 1.13, z: -0.15, jit: 0.03, colorFn: (nx, ny) => (ny > 0.6 ? null : glass) }),
      P(new THREE.BoxGeometry(1.82, 0.16, 4.22), '#2a2c30', { y: 0.36 }),
      P(new THREE.BoxGeometry(0.34, 0.12, 0.05), '#f4f2e0', { x: -0.6, y: 0.72, z: 2.08, noSky: true }),
      P(new THREE.BoxGeometry(0.34, 0.12, 0.05), '#f4f2e0', { x: 0.6, y: 0.72, z: 2.08, noSky: true }),
      P(new THREE.BoxGeometry(0.34, 0.12, 0.05), '#c8201a', { x: -0.6, y: 0.74, z: -2.08 }),
      P(new THREE.BoxGeometry(0.34, 0.12, 0.05), '#c8201a', { x: 0.6, y: 0.74, z: -2.08 }),
      P(new THREE.BoxGeometry(0.5, 0.12, 0.04), '#e8e8e0', { y: 0.45, z: 2.12 }),
      P(new THREE.BoxGeometry(0.1, 0.1, 0.18), col, { x: -0.88, y: 1.0, z: 0.75 }),
      P(new THREE.BoxGeometry(0.1, 0.1, 0.18), col, { x: 0.88, y: 1.0, z: 0.75 }),
    ];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      parts.push(P(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), '#1a1a1c', { x: sx * 0.82, y: 0.34, z: sz * 1.35, rz: Math.PI / 2, jit: 0 }));
      parts.push(P(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 10), '#b8bcc2', { x: sx * 0.95, y: 0.34, z: sz * 1.35, rz: Math.PI / 2, jit: 0 }));
    }
    return mergeParts(parts, 1110 + c);
  },
  semaforo: () => mergeParts([
    P(new THREE.CylinderGeometry(0.06, 0.07, 3.3, 8), '#2a2c2e', { y: 1.65 }),
    P(new THREE.BoxGeometry(0.32, 0.92, 0.26), '#1a1b1d', { y: 3.5 }),
    P(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), '#e8302a', { y: 3.78, z: 0.14, rx: Math.PI / 2, noSky: true, jit: 0 }),
    P(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), '#f2b020', { y: 3.5, z: 0.14, rx: Math.PI / 2, noSky: true, jit: 0 }),
    P(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), '#2ac860', { y: 3.22, z: 0.14, rx: Math.PI / 2, noSky: true, jit: 0 }),
  ], 1120),
  planter: () => mergeParts([
    P(new THREE.CylinderGeometry(1.0, 0.9, 0.6, 14), '#b8b0a0', { y: 0.3 }),
    P(new THREE.CylinderGeometry(0.88, 0.88, 0.04, 14), '#4a6a2a', { y: 0.6 }),
  ], 1121),
  fountain2: () => {
    // v38: fontana ottagonale di marmo crema: due gradini, vasca con bordo, fusto con due coppe, getti d'acqua
    const M = { tile: 1, ts: 2.2, jit: 0.03 }, WT = { tile: 2, ts: 3, jit: 0, noSky: true };
    const oct = (rt, rb, h, y, o = M) => P(new THREE.CylinderGeometry(rt, rb, h, 8), '#ffffff', { ...o, y, ry: Math.PI / 8 });
    const parts = [
      oct(4.7, 4.75, 0.24, 0.12), oct(4.3, 4.3, 0.24, 0.36),
      // vasca: parete ottagonale cava con bordo sporgente (l'acqua si vede dentro)
      P(new THREE.LatheGeometry([[3.98, 0.48], [3.98, 1.16], [4.14, 1.2], [4.14, 1.36], [3.56, 1.36], [3.5, 1.3], [3.5, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 8), '#ffffff', { ...M, ry: Math.PI / 8 }),
      oct(3.5, 3.5, 0.1, 0.55),
      P(new THREE.CylinderGeometry(3.52, 3.52, 0.06, 8), '#ffffff', { ...WT, y: 1.1, ry: Math.PI / 8 }),
      oct(0.62, 0.8, 0.35, 1.25), oct(0.42, 0.55, 1.1, 1.95),
      oct(1.75, 0.5, 0.42, 2.66), oct(1.85, 1.85, 0.07, 2.9),
      P(new THREE.CylinderGeometry(1.62, 1.62, 0.05, 8), '#ffffff', { ...WT, y: 2.86, ry: Math.PI / 8 }),
      oct(0.26, 0.34, 0.75, 3.25), oct(0.95, 0.3, 0.3, 3.75), oct(1.0, 1.0, 0.05, 3.92),
      P(new THREE.CylinderGeometry(0.86, 0.86, 0.04, 8), '#ffffff', { ...WT, y: 3.9, ry: Math.PI / 8 }),
      oct(0.16, 0.24, 0.4, 4.15), P(new THREE.SphereGeometry(0.22, 10, 8), '#ffffff', { ...M, y: 4.45 }),
      P(new THREE.ConeGeometry(0.1, 0.35, 8), '#ffffff', { ...M, y: 4.73 }),
    ];
    // getti: uno alto al centro, otto archi dalla coppa piccola e otto grandi dalla coppa grande nella vasca
    const arc = (r0, y0, r1, y1, up, a) => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(a) * r0, y0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * (r0 + (r1 - r0) * 0.45), y0 + up, Math.sin(a) * (r0 + (r1 - r0) * 0.45)), new THREE.Vector3(Math.cos(a) * r1, y1, Math.sin(a) * r1)), 10, 0.022, 4, false);
    parts.push(P(new THREE.CylinderGeometry(0.03, 0.07, 1.4, 6), '#ffffff', { ...WT, y: 5.4 }));
    parts.push(P(new THREE.SphereGeometry(0.16, 6, 4), '#ffffff', { ...WT, y: 6.1 }));
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + Math.PI / 8;
      parts.push(P(arc(0.15, 4.85, 0.95, 3.95, 0.55, a), '#ffffff', WT));
      parts.push(P(arc(1.0, 3.9, 1.7, 2.9, 0.35, a + Math.PI / 8), '#ffffff', WT));
      parts.push(P(arc(1.85, 2.9, 3.0, 1.12, 0.6, a), '#ffffff', WT));
    }
    const g = mergeParts(parts, 1122);
    g.userData.civic = true;
    return g;
  },
  statue: () => mergeParts([
    P(new THREE.BoxGeometry(2.2, 0.3, 2.2), '#bdb4a2', { y: 0.15 }),
    P(new THREE.BoxGeometry(1.5, 1.7, 1.5), '#c8bfad', { y: 1.15 }),
    P(new THREE.BoxGeometry(1.8, 0.22, 1.8), '#bdb4a2', { y: 2.06 }),
    P(new THREE.BoxGeometry(0.2, 0.95, 0.24), '#5f7f6a', { x: -0.14, y: 2.65 }),
    P(new THREE.BoxGeometry(0.2, 0.95, 0.24), '#5f7f6a', { x: 0.14, y: 2.65 }),
    P(new THREE.BoxGeometry(0.58, 0.8, 0.34), '#5f7f6a', { y: 3.5 }),
    P(new THREE.SphereGeometry(0.19, 10, 8), '#5f7f6a', { y: 4.1 }),
    P(new THREE.BoxGeometry(0.15, 0.75, 0.15), '#5f7f6a', { x: 0.45, y: 4.05, rz: -0.35 }),
    P(new THREE.BoxGeometry(0.15, 0.7, 0.15), '#5f7f6a', { x: -0.38, y: 3.4, rz: 0.12 }),
    P(new THREE.BoxGeometry(0.06, 1.2, 0.06), '#7a8f80', { x: 0.62, y: 4.6, rz: -0.35 }),
  ], 1123),
  well: () => mergeParts([
    P(new THREE.CylinderGeometry(1.0, 1.08, 0.85, 16), '#a8a090', { y: 0.42 }),
    P(new THREE.CylinderGeometry(0.82, 0.82, 0.05, 16), '#203040', { y: 0.7, jit: 0 }),
    P(new THREE.BoxGeometry(0.14, 2.0, 0.14), '#7a5232', { x: -0.95, y: 1.4 }),
    P(new THREE.BoxGeometry(0.14, 2.0, 0.14), '#7a5232', { x: 0.95, y: 1.4 }),
    P(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8), '#6a4a2a', { y: 1.9, rz: Math.PI / 2 }),
    P(new THREE.ConeGeometry(1.55, 0.9, 4), '#8a3a2a', { y: 2.75, ry: Math.PI / 4 }),
    P(new THREE.CylinderGeometry(0.16, 0.13, 0.3, 8), '#6a4a2a', { y: 1.2 }),
  ], 1124),
  kiosk: () => mergeParts([
    P(new THREE.BoxGeometry(2.4, 2.3, 1.8), '#2f5a3a', { y: 1.15, colorFn: (nx, ny, nz, x, y) => (nz > 0.5 && y > 0.9 && y < 2.0 ? (Math.floor(x * 3 + 10) % 3 === 0 ? '#e8302a' : Math.floor(x * 3 + 10) % 3 === 1 ? '#f2f2f2' : '#2a6ab0') : null) }),
    P(new THREE.BoxGeometry(2.9, 0.16, 2.3), '#24452d', { y: 2.38 }),
    P(new THREE.BoxGeometry(2.0, 0.35, 0.05), '#f2d24a', { y: 2.12, z: 0.93, noSky: true }),
    P(new THREE.BoxGeometry(2.2, 0.08, 0.5), '#24452d', { y: 0.95, z: 1.1 }),
  ], 1125),
  busStop: () => mergeParts([
    P(new THREE.BoxGeometry(3.4, 0.08, 1.5), '#8aa0b0', { y: 2.5 }),
    P(new THREE.BoxGeometry(3.2, 1.9, 0.04), '#b8d4e4', { y: 1.35, z: -0.68, noSky: true }),
    P(new THREE.BoxGeometry(0.08, 2.5, 0.08), '#3a3f45', { x: -1.6, y: 1.25, z: -0.68 }),
    P(new THREE.BoxGeometry(0.08, 2.5, 0.08), '#3a3f45', { x: 1.6, y: 1.25, z: -0.68 }),
    P(new THREE.BoxGeometry(2.4, 0.06, 0.4), '#3a3f45', { y: 0.46, z: -0.42 }),
    P(new THREE.BoxGeometry(0.06, 2.9, 0.06), '#3a3f45', { x: 2.0, y: 1.45, z: 0.4 }),
    P(new THREE.BoxGeometry(0.5, 0.5, 0.05), '#1f6fb8', { x: 2.0, y: 2.8, z: 0.4, noSky: true }),
  ], 1126),
  acUnit: () => mergeParts([
    P(new THREE.BoxGeometry(1.0, 0.8, 0.75), '#c9ccd0', { y: 0.4 }),
    P(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12), '#3a3f45', { y: 0.45, z: 0.38, rx: Math.PI / 2 }),
    P(new THREE.BoxGeometry(1.1, 0.06, 0.85), '#9aa0a6', { y: 0.82 }),
  ], 1127),
  roofTank: () => mergeParts([
    P(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), '#e8e8e4', { y: 1.15 }),
    P(new THREE.BoxGeometry(1.4, 0.5, 1.4), '#6a7078', { y: 0.25 }),
  ], 1128),
  antenna: () => mergeParts([
    P(new THREE.CylinderGeometry(0.03, 0.04, 2.6, 6), '#5a5f66', { y: 1.3 }),
    P(new THREE.BoxGeometry(1.0, 0.03, 0.03), '#5a5f66', { y: 2.2 }),
    P(new THREE.BoxGeometry(0.7, 0.03, 0.03), '#5a5f66', { y: 2.45 }),
    P(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 12), '#d8dce0', { y: 1.4, x: 0.25, rz: 1.2 }),
  ], 1129),
  cafeSet: () => {
    const parts = [
      P(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14), '#f2f0ea', { y: 0.74 }),
      P(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 6), '#3a3a3a', { y: 0.36 }),
      P(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10), '#3a3a3a', { y: 0.02 }),
    ];
    for (const s of [-1, 1]) {
      parts.push(P(new THREE.BoxGeometry(0.42, 0.04, 0.42), '#3a6ab0', { x: s * 0.7, y: 0.45 }));
      parts.push(P(new THREE.BoxGeometry(0.04, 0.45, 0.42), '#3a6ab0', { x: s * 0.9, y: 0.68 }));
      for (const a of [-1, 1]) for (const b of [-1, 1]) parts.push(P(new THREE.BoxGeometry(0.03, 0.45, 0.03), '#3a3a3a', { x: s * 0.7 + a * 0.18, y: 0.22, z: b * 0.18 }));
    }
    return mergeParts(parts, 1130);
  },
  rack: () => {
    // scaffalatura industriale (montanti blu, travi arancioni) con bancali
    const parts = [];
    for (const x of [-1.9, 0, 1.9]) for (const z of [-0.5, 0.5]) parts.push(P(new THREE.BoxGeometry(0.1, 4.2, 0.1), '#2a5aa8', { x, y: 2.1, z }));
    for (const y of [0.15, 1.5, 2.85]) for (const z of [-0.5, 0.5]) parts.push(P(new THREE.BoxGeometry(3.9, 0.12, 0.08), '#e8801a', { y, z }));
    return mergeParts(parts, 1131);
  },
};

Object.assign(CITY_SPECIALS, TOWN_SPECIALS);

// ── materiali (condivisi tra le mappe) ──
const MC = new Map();
const mc = (k, f) => { if (!MC.has(k)) MC.set(k, f()); return MC.get(k); };
const texMat = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t, normalMap: t.userData.normal || null, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.9, ...o });
const facadeMat = (s, c) => mc('f' + s + c, () => texMat(facadeTexture(s, c), s === 'glass' ? { roughness: 0.22, metalness: 0.35 } : {}));
const plainMat = (s, c) => mc('p' + s + c, () => texMat(plainTexture(s, c)));
const corrMat = (c) => mc('c' + c, () => texMat(corrugatedTexture(), { color: c, roughness: 0.55, metalness: 0.35 }));
const solid = (k, c, o = {}) => mc(k, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }));
const MAT = {
  get asphalt() { return mc('asphalt', () => texMat(asphaltTexture(), { roughness: 0.95 })); },
  get sidewalk() { return mc('sidewalk', () => texMat(sidewalkTexture(), { roughness: 0.9 })); },
  get cobble() { return mc('cobble', () => texMat(cobbleTexture(), { roughness: 0.9 })); },
  get roof() { return mc('roofFlat', () => texMat(roofFlatTexture(), { roughness: 0.95 })); },
  get tile() { return mc('tile', () => texMat(tileTexture(), { roughness: 0.4 })); },
  get concrete() { return mc('concrete', () => texMat(concreteTexture(), { roughness: 0.9 })); },
  get curb() { return mc('curb', () => texMat(concreteTexture(), { color: '#e2ded6', roughness: 0.85 })); },
  get paint() { return solid('paint', '#f2f2ec', { roughness: 0.6 }); },
  get paintY() { return solid('paintY', '#f0c030', { roughness: 0.6 }); },
  get glass() { return mc('glass', () => new THREE.MeshStandardMaterial({ color: '#a8cce0', roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false })); },
  get rail() { return mc('rail', () => new THREE.MeshStandardMaterial({ map: railTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 })); },
  get board() { return solid('signBoard', '#26282c', { roughness: 0.6 }); },
  get sign() { return mc('signAtlas', () => { const t = signAtlas(); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.22, roughness: 0.5 }); }); },
  get inner() { return solid('innerWall', '#efe9dc', { roughness: 0.95 }); },
  get ceil() { return mc('ceil', () => texMat(concreteTexture(), { color: '#fbf8f2', roughness: 0.95, emissive: '#b8b2a6', emissiveIntensity: 0.3, normalScale: new THREE.Vector2(0.25, 0.25) })); },
  get lamp() { return solid('ceilLamp', '#fffaf0', { roughness: 0.4, emissive: '#fff4dc', emissiveIntensity: 0.9 }); },
  get stair() { return mc('stair', () => texMat(concreteTexture(), { color: '#d8d2c6', roughness: 0.8 })); },
  get products() { return mc('products', () => texMat(productsTexture(), { roughness: 0.7 })); },
  get books() { return mc('booksT', () => texMat(booksTexture(), { roughness: 0.85 })); },
  get hedge() { return solid('hedge', '#3d7536', { roughness: 1 }); },
  get cross() { return solid('pharmaCross', '#1fbf5a', { emissive: '#18c858', emissiveIntensity: 0.9 }); },
  get steelDark() { return solid('steelDark', '#4a5058', { metalness: 0.7, roughness: 0.4 }); },
  get gate() { return solid('gate', '#5a6068', { metalness: 0.5, roughness: 0.5 }); },
  get porchWood() { return solid('porchWood', '#8a5a32', { roughness: 0.9 }); },
  awning(i) { return mc('awn' + i, () => new THREE.MeshStandardMaterial({ map: awningTexture(i), roughness: 0.9, side: THREE.DoubleSide })); },
};
export function cityMaterialsReady() { return MC.size; }

// ── stili per tema ──
const PALETTE = {
  plaster: ['#e3b778', '#d48a5c', '#efd9a8', '#e6b3a0', '#f0e2c0', '#c99a6e'],
  pastel: ['#f2a898', '#9fd2e6', '#f5df94', '#b8e0c0', '#f7f2ea'],
  brick: ['#9a4a3a', '#b0603f'],
  modern: ['#d9dcdf', '#b8bfc6', '#ece7dd'],
  glass: ['#4a7fa8', '#3f8f8a', '#5a6f8f'],
  wood: ['#8a5a32', '#a06a3a'],
  stone: ['#a8a090', '#b9ae98'],
};
const THEME_TAG = { classic: 'u', castle: 'u', coastal: 'c', port: 'c', alpine: 'a', western: 'w', industrial: 'i', farm: 'a' };
const TREE_FOR = { classic: ['oak', 'birch'], coastal: ['palm', 'palm', 'oak'], port: ['palm', 'oak'], alpine: ['snowPine'], western: ['cactus'], farm: ['oak', 'birch'], industrial: ['birch', 'oak'], castle: ['pine', 'oak'] };
const NORM = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const WAREHOUSE_COLORS = ['#8a9aa6', '#b05a3a', '#6a7f5a', '#c9a24a', '#d0d4d8', '#4a6a8a'];

/**
 * Costruisce tutte le città. C = funzioni e materiali di world.js:
 * { TOWNS, addBox, addGeo, addCollider, special, houses, lootSpots, chestSpots, extraTrees, makeDoor, furnish,
 *   placeHouse, cgeo, rnd, gableRoofGeo, gableEndGeo, ridgeGeo, roofMatFor, addCrate, M }
 */
export function buildCity(C) {
  const { addBox, addGeo, addCollider, special, houses, lootSpots, chestSpots, extraTrees, cgeo, M } = C;
  const rnd = C.rnd, sr = (a, b) => a + rnd() * (b - a), pick = (a) => a[Math.floor(rnd() * a.length)];
  const stats = { palazzi: 0, negozi: 0, case: 0, capannoni: 0, auto: 0, lampioni: 0 };
  // v27: costruttori delle città a tema (camion, miniere, palafitte, campi, mura)
  const K = { C, frame: (...a) => frame(...a), special, MAT, rnd, sr, pick, stats, mc, texMat, solid, corrMat, corrTex: corrugatedTexture, roadMat: (pl) => roadMat(pl) };
  const TB = townBuilders(K);
  const roadMat = (pl) => ({ asphalt: MAT.asphalt, cobble: MAT.cobble, dirt: TB.mats.dirt, snow: TB.mats.snow, sand: TB.mats.sand })[pl.surf] || MAT.asphalt;

  /** sistema di riferimento locale di un edificio: u lungo la facciata, v verso l'interno (0 = facciata) */
  function frame(cx, cz, w, d, face) {
    const N = NORM[face], Tg = [-N[1], N[0]], sw = N[0] !== 0;
    const fx = (u, v) => cx + Tg[0] * u + N[0] * (d / 2 - v), fz = (u, v) => cz + Tg[1] * u + N[1] * (d / 2 - v);
    return {
      N, Tg, sw, W: sw ? d : w, D: sw ? w : d, x: fx, z: fz, rot: Math.atan2(N[0], N[1]),
      box: (u, v, y, lu, lh, lv, mat, o) => addBox(sw ? lv : lu, lh, sw ? lu : lv, fx(u, v), y, fz(u, v), mat, o),
      rect(u0, u1, v0, v1) { const xa = fx(u0, v0), xb = fx(u1, v1), za = fz(u0, v0), zb = fz(u1, v1); return [Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)]; },
    };
  }

  // ═════════ palazzo a più piani ═════════
  function palazzo(o) {
    const T = 0.35, { w, d, n, y, face } = o, hw = w / 2;
    const F = frame(o.cx, o.cz, w, d, face);
    const flat = o.roof !== 'gable';
    const nf = flat ? n : n - 1;                         // rampe di scale (l'ultima porta sul tetto piano)
    const shop = o.shop ?? -1;
    const house = { cx: o.cx, cz: o.cz, w: F.W, d: F.D, baseY: y, roofMesh: null, roofTop: y + 3 * n + 0.2, doors: [], wallColor: o.color, roofColor: flat ? '#8d8b86' : o.roofColor, theme: o.theme, furn: [], floors: n, lodH: 3 * n + (flat ? 1.2 : 0.2), city: 'palazzo' };
    house.clip = [o.cx - F.W / 2 - 1.1, o.cz - F.D / 2 - 1.1, o.cx + F.W / 2 + 1.1, o.cz + F.D / 2 + 1.1];
    const H = { house }, deco = { house, collide: false }, nc = { house, collide: false, cast: false };
    const fMat = facadeMat(o.style, o.color), gMat = plainMat(o.gStyle || o.style, o.gColor || o.color), pMat = plainMat(o.style, o.color);
    const su = o.stairSide || 1, U = (s) => su * (hw - T - s);
    const vA = T + 1.4, vB = vA + 3.2;
    const run = (alongU, fixed, a0, a1, yb, hh, holes, mat) => {
      const piece = (a, b, ya, hy) => {
        if (b - a < 0.02 || hy < 0.02) return;
        if (alongU) F.box((a + b) / 2, fixed, ya + hy / 2, b - a, hy, T, mat, H); else F.box(fixed, (a + b) / 2, ya + hy / 2, T, hy, b - a, mat, H);
      };
      let cur = a0;
      for (const h of holes.sort((p, q) => p.a0 - q.a0)) {
        piece(cur, h.a0, yb, hh); piece(h.a0, h.a1, yb, h.y0 - yb); piece(h.a0, h.a1, h.y1, yb + hh - h.y1);
        if (h.glass) { const c = (h.a0 + h.a1) / 2, gh = h.y1 - h.y0; if (alongU) F.box(c, fixed, h.y0 + gh / 2, h.a1 - h.a0, gh, 0.05, MAT.glass, { house, cast: false }); else F.box(fixed, c, h.y0 + gh / 2, 0.05, gh, h.a1 - h.a0, MAT.glass, { house, cast: false }); }
        if (h.win) {   // davanzale e cornice esterna
          const c = (h.a0 + h.a1) / 2, out = fixed < d / 2 ? -0.1 : d + 0.1, outS = fixed < 0 ? -hw - 0.1 : hw + 0.1;
          if (alongU) { F.box(c, out, h.y0 - 0.05, h.a1 - h.a0 + 0.24, 0.1, 0.22, M.trimMat, nc); F.box(c, out, h.y1 + 0.07, h.a1 - h.a0 + 0.2, 0.14, 0.12, M.trimMat, nc); }
          else { F.box(outS, c, h.y0 - 0.05, 0.22, 0.1, h.a1 - h.a0 + 0.24, M.trimMat, nc); F.box(outS, c, h.y1 + 0.07, 0.12, 0.14, h.a1 - h.a0 + 0.2, M.trimMat, nc); }
        }
        cur = h.a1;
      }
      piece(cur, a1, yb, hh);
    };
    const inStair = (u0, u1) => { const a = Math.min(U(0), U(2.9)), b = Math.max(U(0), U(2.9)); return u1 > a && u0 < b; };
    // ── piano terra ──
    const fh = [{ a0: -1.1, a1: 1.1, y0: y + 0.2, y1: y + 2.6 }];
    if (shop >= 0) {
      const a = 1.55, b = hw - 0.5;
      if (b - a > 0.9) { fh.push({ a0: a, a1: b, y0: y + 0.45, y1: y + 2.6, glass: true }); fh.push({ a0: -b, a1: -a, y0: y + 0.45, y1: y + 2.6, glass: true }); }
    } else {
      for (let uc = -hw + 1.5; uc < hw; uc += 3) if (Math.abs(uc) > 2.4) fh.push({ a0: uc - 0.6, a1: uc + 0.6, y0: y + 1.0, y1: y + 2.4, glass: true, win: true });
    }
    run(true, T / 2, -hw, hw, y, 3, fh, gMat);
    const bh = [];
    if (o.backDoor) bh.push({ a0: -1.1, a1: 1.1, y0: y + 0.2, y1: y + 2.6 });
    for (let uc = -hw + 1.5; uc < hw; uc += 3) if (Math.abs(uc) > 2.4 && !inStair(uc - 0.7, uc + 0.7)) bh.push({ a0: uc - 0.6, a1: uc + 0.6, y0: y + 1.0, y1: y + 2.4, glass: true, win: true });
    run(true, d - T / 2, -hw, hw, y, 3, bh, gMat);
    for (const sd of [-1, 1]) {
      const sh = [];
      if (sd !== su) for (let vc = 2.6; vc < d - 1.6; vc += 3) sh.push({ a0: vc - 0.6, a1: vc + 0.6, y0: y + 1.0, y1: y + 2.4, glass: true, win: true });
      run(false, sd * (hw - T / 2), T, d - T, y, 3, sh, gMat);
    }
    // porte (davanti e dietro) con cornice
    const doorAt = (v, nx, nz, out) => {
      C.makeDoor(F.x(0, v), F.z(0, v), y, !F.sw, nx, nz, house);
      for (const s of [-1, 1]) F.box(s * 1.17, out, y + 1.4, 0.14, 2.6, 0.1, M.trimMat, nc);
      F.box(0, out, y + 2.67, 2.48, 0.14, 0.1, M.trimMat, nc);
    };
    doorAt(T / 2, F.N[0], F.N[1], -0.05);
    if (o.backDoor) doorAt(d - T / 2, -F.N[0], -F.N[1], d + 0.05);
    // zoccolo in pietra sulla facciata
    for (const [a, b] of [[-hw, -1.25], [1.25, hw]]) F.box((a + b) / 2, -0.04, y + 0.25, b - a, 0.5, 0.1, M.stoneMat, nc);
    // ── piani superiori: un box per lato (finestre dipinte nella texture di facciata) ──
    if (n > 1) {
      const hh = 3 * (n - 1), yc = y + 3 + hh / 2;
      F.box(0, T / 2, yc, w, hh, T, fMat, H); F.box(0, d - T / 2, yc, w, hh, T, fMat, H);
      for (const sd of [-1, 1]) F.box(sd * (hw - T / 2), d / 2, yc, T, hh, d - 2 * T, fMat, H);
      if (o.style !== 'glass' && o.style !== 'modern') F.box(0, -0.07, y + 3.0, w + 0.14, 0.24, 0.14, M.trimMat, nc);   // marcapiano
    }
    // pavimento del piano terra
    F.box(0, d / 2, y + 0.1, w - 2 * T, 0.2, d - 2 * T, shop >= 0 ? MAT.tile : M.floorMat, { house, cast: false });
    // ── solai con il vano scala ──
    const slabs = (k) => {
      const yb = y + 3 * k, roof = k === n, hole = k - 1 < nf ? (k - 1) % 2 : -1;
      const sMin = roof ? -T : 0, sMax = roof ? w - T : w - 2 * T, vMin = roof ? 0 : T, vMax = roof ? d : d - T;
      const piece = (s0, s1, v0, v1) => {
        if (s1 - s0 < 0.02 || v1 - v0 < 0.02) return;
        const u0 = Math.min(U(s0), U(s1)), u1 = Math.max(U(s0), U(s1)), uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
        F.box(uc, vc, yb + 0.1, u1 - u0, 0.2, v1 - v0, MAT.ceil, { house, cast: roof });   // v25: intradosso intonacato
        F.box(uc, vc, yb + 0.21, u1 - u0, 0.02, v1 - v0, roof ? MAT.roof : M.floorMat, nc);
      };
      piece(sMin, sMax, vMin, vA); piece(sMin, sMax, vB, vMax);
      if (hole < 0) piece(sMin, sMax, vA, vB);
      else if (hole === 0) piece(1.2, sMax, vA, vB);
      else { piece(sMin, 1.32, vA, vB); piece(2.52, sMax, vA, vB); }
      if (hole >= 0) {
        // ringhiere attorno al vano (non dal lato in cui si arriva)
        const dir = (k - 1) % 2 ? -1 : 1, vS = dir > 0 ? vA + 0.03 : vB - 0.03, sC = hole ? 1.92 : 0.6;
        F.box(U(sC), vS, yb + 0.7, 1.2, 1.0, 0.05, MAT.rail, { house, cast: false });
        if (hole === 1) F.box(U(2.54), (vA + vB) / 2, yb + 0.7, 0.05, 1.0, 3.2, MAT.rail, { house, cast: false });
        if (roof && hole === 0) F.box(U(1.22), (vA + vB) / 2, yb + 0.7, 0.05, 1.0, 3.2, MAT.rail, { house, cast: false });
      }
    };
    for (let k = 1; k <= n; k++) slabs(k);
    // v25: plafoniere al centro di ogni piano (lontane dal vano scala)
    for (let k = 1; k <= n; k++) F.box(0, (d + vB) / 2 > d - T - 0.6 ? d / 2 : (vB + d - T) / 2, y + 3 * k - 0.03, 0.6, 0.05, 0.6, MAT.lamp, { house, cast: false, collide: false });
    // ── scale: rampe di 10 gradini (alzata 30 cm), corsie alternate ──
    const flights = [];
    for (let j = 0; j < nf; j++) {
      const lane = j % 2, sC = lane ? 1.92 : 0.6, dir = lane ? -1 : 1, fy = y + 3 * j + 0.2;
      for (let i = 1; i <= 10; i++) {
        const vc = dir > 0 ? vA + 0.32 * (i - 0.5) : vB - 0.32 * (i - 0.5);
        F.box(U(sC), vc, fy + 0.15 * i, 1.2, 0.3 * i, 0.32, MAT.stair, { house, cast: i > 6 });
      }
      const vS = dir > 0 ? vA : vB, vE = dir > 0 ? vB : vA, r = F.rect(U(sC) - 0.6, U(sC) + 0.6, vA, vB);
      flights.push({ k: j, sx: F.x(U(sC), vS - dir * 0.8), sz: F.z(U(sC), vS - dir * 0.8), ex: F.x(U(sC), vE + dir * 0.9), ez: F.z(U(sC), vE + dir * 0.9), box: r });
    }
    for (let k = 0; k < n; k++) F.box(U(1.26), (vA + vB) / 2, y + 3 * k + 1.6, 0.12, 2.8, 3.2, MAT.inner, H);   // muro tra le rampe
    house.stair = { flights };
    // ── cornicione, lesene, parapetto o tetto a falde ──
    const top = y + 3 * n;
    F.box(0, -0.15, top - 0.08, w + 0.6, 0.34, 0.3, M.trimMat, nc); F.box(0, d + 0.15, top - 0.08, w + 0.6, 0.34, 0.3, M.trimMat, nc);
    for (const sd of [-1, 1]) F.box(sd * (hw + 0.15), d / 2, top - 0.08, 0.3, 0.34, d, M.trimMat, nc);
    const pil = { plaster: M.trimMat, pastel: M.trimMat, brick: M.stoneMat, stone: M.stoneMat, wood: M.darkWoodMat }[o.style];
    const Ht = 3 * n + (flat ? 1.2 : 0);
    if (pil) for (const sx of [-1, 1]) for (const vv of [0.18, d - 0.18]) F.box(sx * (hw - 0.18), vv, y + Ht / 2, 0.5, Ht, 0.5, pil, nc);
    const roofY = top + 0.2;
    if (flat) {
      const ph = o.falseFront ? 2.4 : 1.0;
      F.box(0, T / 2, roofY + ph / 2, w, ph, T, pMat, H); F.box(0, d - T / 2, roofY + 0.5, w, 1.0, T, pMat, H);
      for (const sd of [-1, 1]) F.box(sd * (hw - T / 2), d / 2, roofY + 0.5, T, 1.0, d - 2 * T, pMat, H);
      F.box(0, T / 2, roofY + ph + 0.05, w + 0.12, 0.1, T + 0.12, M.trimMat, nc); F.box(0, d - T / 2, roofY + 1.05, w + 0.12, 0.1, T + 0.12, M.trimMat, nc);
      for (const sd of [-1, 1]) F.box(sd * (hw - T / 2), d / 2, roofY + 1.05, T + 0.12, 0.1, d - 2 * T, M.trimMat, nc);
      if (o.merlons) for (let u = -hw + 0.4; u <= hw - 0.39; u += 1.4) for (const vv of [T / 2, d - T / 2]) F.box(u, vv, roofY + 1.4, 0.6, 0.7, T + 0.1, M.stoneMat, nc);
      // impianti sul tetto (lontano dal vano scala)
      const free = (u, v, r) => !(Math.abs(u - U(1.26)) < 1.26 + r + 0.6 && v > vA - r - 0.6 && v < vB + r + 0.6);
      const roofThings = o.theme === 'coastal' && rnd() < 0.6 ? ['umbrella', 'umbrella'] : ['acUnit', rnd() < 0.5 ? 'acUnit' : 'roofTank', rnd() < 0.4 ? 'antenna' : null];
      roofThings.forEach((ty, i) => {
        if (!ty) return;
        for (let tr = 0; tr < 6; tr++) {
          const u = sr(-hw + 1.4, hw - 1.4), v = sr(1.4, d - 1.4);
          if (!free(u, v, 0.9)) continue;
          special(ty, F.x(u, v), F.z(u, v), roofY + 0.02, ty === 'antenna' ? null : ty === 'umbrella' ? [0.12, 2.4, true] : [ty === 'roofTank' ? 0.8 : 0.6, ty === 'roofTank' ? 1.8 : 0.85, false], { rot: F.rot + (rnd() < 0.5 ? 0 : Math.PI), c: i });
          break;
        }
      });
      if (o.flag) special('flag', F.x(hw - 1, 1), F.z(hw - 1, 1), roofY + 1.0, null, { c: Math.floor(rnd() * 4) });
    } else {
      const alongX = F.W >= F.D, span = alongX ? F.D : F.W, rlen = alongX ? F.W : F.D;
      const half = span / 2 + 0.6, rise = (o.snow ? 0.62 : 0.5) * half, thick = 0.18, rot = alongX ? 0 : Math.PI / 2;
      const rm = C.roofMatFor(o.roofColor);
      addGeo(C.gableRoofGeo(rlen + 0.9, half, rise, thick), o.cx, roofY - 0.02, o.cz, rm, { house, rotY: rot });
      addGeo(C.ridgeGeo(rlen + 1.0), o.cx, roofY - 0.02 + rise + thick, o.cz, M.capMat, { house, rotY: rot });
      if (o.snow) addGeo(C.gableRoofGeo(rlen + 0.7, half - 0.12, rise * (half - 0.12) / half, 0.14), o.cx, roofY + 0.16, o.cz, M.snowMat, { house, rotY: rot, cast: false });
      const eg = C.gableEndGeo(span / 2, half, rise, T);
      for (const e of [-1, 1]) {
        if (alongX) addGeo(eg, o.cx + e * (F.W / 2 - T / 2), roofY - 0.02, o.cz, pMat, { house });
        else addGeo(eg, o.cx, roofY - 0.02, o.cz + e * (F.D / 2 - T / 2), pMat, { house, rotY: Math.PI / 2 });
      }
      for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) {
        const a = half * k / 5, b2 = half * (k + 1) / 5, ym = rise * (1 - (a + b2) / 2 / half) + thick;
        const lo = sd > 0 ? a : -b2, hi = sd > 0 ? b2 : -a;
        if (alongX) addCollider({ type: 'box', minX: o.cx - rlen / 2 - 0.4, maxX: o.cx + rlen / 2 + 0.4, minY: roofY, maxY: roofY + ym, minZ: o.cz + lo, maxZ: o.cz + hi });
        else addCollider({ type: 'box', minX: o.cx + lo, maxX: o.cx + hi, minY: roofY, maxY: roofY + ym, minZ: o.cz - rlen / 2 - 0.4, maxZ: o.cz + rlen / 2 + 0.4 });
      }
      house.pitch = { alongX, rise };
      house.roofTop = roofY + rise + thick;
      // comignolo
      const cu = sr(-hw + 1.2, hw - 1.2), cv = sr(1.2, d - 1.2);
      addBox(0.7, rise + 1.2, 0.7, F.x(cu, cv), roofY + (rise + 1.2) / 2, F.z(cu, cv), M.brickMat, { house, collide: false });
    }
    // ── balconi sulla facciata ──
    if (n > 1 && o.balconies) {
      for (let k = 1; k < n; k++) for (let uc = -hw + 1.5; uc < hw; uc += 3) {
        if (rnd() > o.balconies) continue;
        const yb = y + 3 * k;
        F.box(uc, -0.45, yb + 0.08, 2.1, 0.16, 0.9, MAT.concrete, H);
        F.box(uc, -0.88, yb + 0.66, 2.1, 1.0, 0.04, MAT.rail, { house, cast: false });
        for (const s of [-1, 1]) F.box(uc + s * 1.03, -0.45, yb + 0.66, 0.04, 1.0, 0.86, MAT.rail, { house, cast: false, collide: false });
      }
    }
    // ── portico western: tettoia sul marciapiede ──
    if (o.porch) {
      F.box(0, -1.05, y + 3.05, w, 0.14, 2.2, MAT.porchWood, H);
      for (let uc = -hw + 0.2; uc <= hw - 0.19; uc += Math.max(2.4, (w - 0.4) / Math.round((w - 0.4) / 3))) F.box(uc, -2.05, y + 1.52, 0.18, 3.0, 0.18, MAT.porchWood, deco);
    }
    // ── negozio: insegna, tende, croce verde, arredo interno ──
    const fl = [];                                       // ingombri (per il bottino) del piano corrente
    const stairEx = (list) => { const r = F.rect(Math.min(U(0), U(2.9)), Math.max(U(0), U(2.9)), T, d - T); list.push({ x: (r[0] + r[1]) / 2, z: (r[2] + r[3]) / 2, hw: (r[1] - r[0]) / 2, hd: (r[3] - r[2]) / 2 }); };
    if (shop >= 0) {
      const S = SHOPS[shop];
      const sy = o.falseFront ? roofY + 1.3 : y + 3.3, sw = Math.min(w - 1.2, o.falseFront ? 4.4 : 3.2), shh = sw / 4;
      F.box(0, -0.06, sy, sw + 0.24, shh + 0.2, 0.12, MAT.board, nc);
      addGeo(cgeo('sign' + shop + '_' + sw.toFixed(1), () => signGeometry(shop, sw, shh)), F.x(0, -0.125), sy, F.z(0, -0.125), MAT.sign, { house, rotY: F.rot, cast: false });
      if (S.cross) {
        const cu = hw - 0.25;
        F.box(cu, -0.55, y + 3.6, 0.08, 0.26, 0.8, MAT.cross, nc); F.box(cu, -0.55, y + 3.6, 0.08, 0.8, 0.26, MAT.cross, nc);
        F.box(cu, -0.12, y + 3.6, 0.1, 0.08, 0.3, MAT.board, nc);
      }
      if (o.awnings && !o.porch) {
        const ai = Math.floor(rnd() * AWNING_COLORS.length), am = MAT.awning(ai);
        for (const sgn of [-1, 1]) {
          const a = 1.5, b = hw - 0.45; if (b - a < 0.9) continue;
          const lu = +(b - a + 0.2).toFixed(1), uc = sgn * (a + b) / 2;
          addGeo(cgeo('awn' + lu, () => new THREE.BoxGeometry(lu, 0.04, 1.4).rotateX(0.32)), F.x(uc, -0.67), y + 2.62, F.z(uc, -0.67), am, { house, rotY: F.rot });
          addGeo(cgeo('awnV' + lu, () => new THREE.BoxGeometry(lu, 0.28, 0.02)), F.x(uc, -1.33), y + 2.26, F.z(uc, -1.33), am, { house, rotY: F.rot, cast: false });
        }
      }
      stairEx(fl);
      shopInterior(F, o, house, fl, y + 0.2, su, hw, d, T);
      stats.negozi++;
    } else {
      const fl0 = [];
      stairEx(fl0);
      C.furnish(house, sidesFor(F, w, d, T, true, o.backDoor), y, 3.0, T, o.theme, { F: fl0, max: 3 + Math.floor(rnd() * 2) });
      fl.push(...fl0);
    }
    const lootIn = (list, fy, p) => {
      if (rnd() > p) return;
      const sp = freeSpot(F, list, hw, d, T, 0.4);
      if (sp) lootSpots.push(new THREE.Vector3(sp[0], fy, sp[1]));
    };
    lootIn(fl, y + 0.2, 0.9);
    if (shop >= 0) lootIn(fl, y + 0.2, 0.4);
    const chestK = rnd() < 0.5 ? Math.floor(rnd() * n) : -1;
    for (let k = 1; k < n; k++) {
      const flk = []; stairEx(flk);
      const fy = y + 3 * k + 0.2;
      if (rnd() < 0.6) C.furnish(house, sidesFor(F, w, d, T, false, false), y + 3 * k, 3.0, T, o.theme, { F: flk, max: 2 + Math.floor(rnd() * 2) });
      lootIn(flk, fy, 0.75);
      if (k === chestK) { const sp = freeSpot(F, flk, hw, d, T, 0.75); if (sp) chestSpots.push({ pos: new THREE.Vector3(sp[0], fy, sp[1]), rot: rnd() * Math.PI }); }
    }
    if (chestK === 0) { const sp = freeSpot(F, fl, hw, d, T, 0.75); if (sp) chestSpots.push({ pos: new THREE.Vector3(sp[0], y + 0.2, sp[1]), rot: rnd() * Math.PI }); }
    if (flat && rnd() < 0.45) { const u = -su * sr(0.5, hw - 1.5); lootSpots.push(new THREE.Vector3(F.x(u, d - 1.2), roofY + 0.02, F.z(u, d - 1.2))); }
    houses.push(house);
    C.chunkAt(o.cx, o.cz).houses.push(house);
    stats.palazzi++;
    return house;
  }

  /** muri (in coordinate mondo) per furnish(): facciata, retro e fianchi */
  function sidesFor(F, w, d, T, ground, backDoor) {
    const hw = w / 2;
    const S = (u, v, len, alongU, n, door, win) => ({ x: F.x(u, v), z: F.z(u, v), len, horiz: alongU ? !F.sw : F.sw, n, door, win });
    return [
      S(0, T / 2, w, true, [F.N[0], F.N[1]], ground, true),
      S(0, d - T / 2, w, true, [-F.N[0], -F.N[1]], ground && backDoor, true),
      S(hw - T / 2, d / 2, d, false, [F.Tg[0], F.Tg[1]], false, false),
      S(-(hw - T / 2), d / 2, d, false, [-F.Tg[0], -F.Tg[1]], false, false),
    ];
  }
  function freeSpot(F, list, hw, d, T, r) {
    for (let k = 0; k < 16; k++) {
      const u = sr(-hw + T + 0.6, hw - T - 0.6), v = sr(T + 0.7, d - T - 0.7);
      if (Math.abs(u) < 1.5 && v < T + 1.6) continue;                       // davanti alla porta
      const x = F.x(u, v), z = F.z(u, v);
      if (list.every(f => Math.abs(x - f.x) > f.hw + r || Math.abs(z - f.z) > f.hd + r)) return [x, z];
    }
    return null;
  }

  // ═════════ arredo dei negozi ═════════
  function shopInterior(F, o, house, fl, fy, su, hw, d, T) {
    const kind = SHOPS[o.shop].f;
    // spazio libero (le scale occupano 2,9 m dal muro laterale su)
    const uL = su > 0 ? -hw + T + 0.1 : -hw + T + 3.0, uR = su > 0 ? hw - T - 3.0 : hw - T - 0.1;
    const L = uR - uL, uc = (uL + uR) / 2, vBack = d - T;
    const reg = (u0, u1, v0, v1) => { const r = F.rect(u0, u1, v0, v1); fl.push({ x: (r[0] + r[1]) / 2, z: (r[2] + r[3]) / 2, hw: (r[1] - r[0]) / 2, hd: (r[3] - r[2]) / 2 }); };
    const pc = (u, v, y0, lu, lh, lv, mat, col) => F.box(u, v, fy + y0 + lh / 2, lu, lh, lv, mat, { house, collide: !!col, cast: lh > 0.3 });
    const cab = pick(M.cabinetMats), wood = pick(M.furnWoodMats);
    const counter = (u, v, len, alongU = true) => {
      if (alongU) { pc(u, v, 0, len, 1.0, 0.6, cab, true); pc(u, v, 1.0, len + 0.06, 0.05, 0.68, M.counterTopMat); pc(u - len / 2 + 0.35, v, 1.05, 0.38, 0.26, 0.3, M.blackMat); reg(u - len / 2, u + len / 2, v - 0.35, v + 0.35); }
      else { pc(u, v, 0, 0.6, 1.0, len, cab, true); pc(u, v, 1.0, 0.68, 0.05, len + 0.06, M.counterTopMat); pc(u, v - len / 2 + 0.35, 1.05, 0.3, 0.26, 0.38, M.blackMat); reg(u - 0.35, u + 0.35, v - len / 2, v + len / 2); }
    };
    const wallUnit = (u, v, len, mat = MAT.products, alongU = true, hh = 2.1) => {
      if (alongU) { pc(u, v, 0, len, hh, 0.42, mat, true); for (const yy of [0.02, 0.72, 1.42]) pc(u, v - 0.02, yy, len + 0.04, 0.04, 0.48, M.steelMat); reg(u - len / 2, u + len / 2, v - 0.3, v + 0.3); }
      else { pc(u, v, 0, 0.42, hh, len, mat, true); for (const yy of [0.02, 0.72, 1.42]) pc(u, v, yy, 0.48, 0.04, len + 0.04, M.steelMat); reg(u - 0.3, u + 0.3, v - len / 2, v + len / 2); }
    };
    const gondola = (u, v, len) => { pc(u, v, 0, len, 0.12, 0.85, M.steelMat, true); pc(u, v, 0.12, len - 0.06, 1.45, 0.72, MAT.products, true); pc(u, v, 1.57, len, 0.04, 0.85, M.steelMat); reg(u - len / 2, u + len / 2, v - 0.45, v + 0.45); };
    const table = (u, v) => {
      addGeo(cgeo('ctab', () => new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14)), F.x(u, v), fy + 0.74, F.z(u, v), wood, { house });
      pc(u, v, 0, 0.07, 0.72, 0.07, M.darkWoodMat);
      for (const s of [-1, 1]) { pc(u + s * 0.68, v, 0.42, 0.42, 0.05, 0.42, wood); pc(u + s * 0.88, v, 0.47, 0.05, 0.45, 0.42, wood); for (const a of [-1, 1]) for (const b of [-1, 1]) pc(u + s * 0.68 + a * 0.17, v + b * 0.17, 0, 0.04, 0.42, 0.04, M.darkWoodMat); }
      reg(u - 1.0, u + 1.0, v - 0.5, v + 0.5);
    };
    const plant = (u, v) => { pc(u, v, 0, 0.4, 0.42, 0.4, M.potMat); addGeo(cgeo('plantA', () => new THREE.IcosahedronGeometry(0.36, 0)), F.x(u, v), fy + 0.85, F.z(u, v), M.leafMat, { house }); reg(u - 0.3, u + 0.3, v - 0.3, v + 0.3); };
    const sofa = (u, v, facing) => { pc(u, v, 0.08, 2.0, 0.34, 0.85, M.sofaMats[0], true); pc(u, v + facing * 0.34, 0.42, 2.0, 0.5, 0.18, M.sofaMats[0]); reg(u - 1.0, u + 1.0, v - 0.45, v + 0.45); };
    const backLen = Math.max(1.2, L - 0.4);
    switch (kind) {
      case 'cafe':
        wallUnit(uc, vBack - 0.22, backLen);
        counter(uc, vBack - 1.5, Math.min(4, L - 0.8));
        for (let u = uL + 1.1; u < uR - 1.0; u += 2.3) table(u, T + 3.0);
        break;
      case 'market': {
        const gl = Math.min(5, L - 1.4);
        gondola(uc, T + 3.0, gl);
        if (d - 2 * T > 8.2) gondola(uc, T + 5.2, gl);
        wallUnit(uc, vBack - 0.22, backLen);
        break;
      }
      case 'bakery': case 'gelato':
        wallUnit(uc, vBack - 0.22, backLen);
        pc(uc, vBack - 1.9, 0, Math.min(4, L - 1), 0.9, 0.7, cab, true); pc(uc, vBack - 1.9, 0.9, Math.min(4, L - 1), 0.42, 0.62, MAT.glass); pc(uc, vBack - 1.9, 0.92, Math.min(4, L - 1) - 0.2, 0.12, 0.5, MAT.products);
        reg(uc - Math.min(4, L - 1) / 2, uc + Math.min(4, L - 1) / 2, vBack - 2.3, vBack - 1.5);
        if (kind === 'gelato') table(uc, T + 3.0);
        break;
      case 'books':
        wallUnit(uc, vBack - 0.22, backLen, MAT.books);
        pc(uc, T + 3.4, 0, 1.6, 0.8, 0.9, wood, true); pc(uc - 0.3, T + 3.4, 0.8, 0.5, 0.12, 0.35, pick(M.bookMats)); pc(uc + 0.35, T + 3.4, 0.8, 0.4, 0.2, 0.3, pick(M.bookMats));
        reg(uc - 0.8, uc + 0.8, T + 2.9, T + 3.9);
        break;
      case 'bank': {
        const cl = Math.max(1.2, L - 0.6);
        counter(uc, vBack - 2.2, cl);
        pc(uc, vBack - 2.2, 1.05, cl, 0.9, 0.04, MAT.glass);
        pc(uL + 0.6, vBack - 0.5, 0, 1.0, 1.4, 0.8, MAT.steelDark, true); reg(uL + 0.1, uL + 1.1, vBack - 0.9, vBack - 0.1);
        plant(uR - 0.4, T + 2.4);
        break;
      }
      case 'lobby':
        counter(uc, vBack - 1.8, Math.min(2.8, L - 1));
        if (L > 3) { sofa(uc, T + 3.0, -1); plant(uL + 0.4, vBack - 0.5); plant(uR - 0.4, vBack - 0.5); }
        break;
      case 'clothes':
        for (const v of [T + 3.0, T + 5.0]) {
          if (v > vBack - 1.5) break;
          const rl = Math.min(2.6, L - 1.2);
          pc(uc, v, 1.45, rl, 0.04, 0.04, M.steelMat); for (const s of [-1, 1]) pc(uc + s * rl / 2, v, 0, 0.04, 1.47, 0.04, M.steelMat);
          for (let u = uc - rl / 2 + 0.25; u < uc + rl / 2 - 0.15; u += 0.32) pc(u, v, 0.55, 0.08, 0.85, 0.5, pick(M.blanketMats));
          reg(uc - rl / 2, uc + rl / 2, v - 0.35, v + 0.35);
        }
        counter(uc, vBack - 1.2, Math.min(2.2, L - 1));
        break;
      case 'flowers':
        for (const v of [T + 3.0, vBack - 1.0]) {
          pc(uc, v, 0, Math.min(2.4, L - 1), 0.75, 0.8, wood, true);
          for (let u = uc - Math.min(2.4, L - 1) / 2 + 0.3; u < uc + Math.min(2.4, L - 1) / 2 - 0.2; u += 0.5) {
            pc(u, v, 0.75, 0.26, 0.24, 0.26, M.potMat);
            addGeo(cgeo('flowers', () => new THREE.IcosahedronGeometry(0.13, 0)), F.x(u, v), fy + 1.12, F.z(u, v), pick(M.blanketMats), { house, cast: false });
          }
          reg(uc - 1.2, uc + 1.2, v - 0.4, v + 0.4);
        }
        break;
      default:   // farmacia, tabacchi, ferramenta, ottica…
        wallUnit(uc, vBack - 0.22, backLen);
        counter(uc, vBack - 1.9, Math.min(3.5, L - 1));
        if (d - 2 * T > 7) wallUnit(su > 0 ? uL + 0.22 : uR - 0.22, (T + 2.2 + vBack - 2.6) / 2, Math.max(1, vBack - 2.6 - T - 2.2), MAT.products, false);
    }
  }

  // ═════════ capannone (zona industriale / porto) ═════════
  function warehouse(o) {
    const T = 0.3, { w, d, y, face } = o, hw = w / 2, Hh = 7;
    const F = frame(o.cx, o.cz, w, d, face);
    const house = { cx: o.cx, cz: o.cz, w: F.W, d: F.D, baseY: y, roofMesh: null, roofTop: y + Hh + 0.25, doors: [], wallColor: o.color, roofColor: o.barn ? '#4a4f5a' : '#7a7c80', theme: o.theme, furn: [], floors: 2, lodH: Hh + 0.6, city: o.barn ? 'fienile' : 'capannone' };
    house.clip = [o.cx - F.W / 2 - 1.1, o.cz - F.D / 2 - 1.1, o.cx + F.W / 2 + 1.1, o.cz + F.D / 2 + 1.1];
    const H = { house }, nc = { house, collide: false, cast: false };
    const wm = o.barn ? plainMat('wood', o.color) : corrMat(o.color);
    const piece = (alongU, fixed, a, b, ya, hy, mat = wm) => { if (b - a < 0.02 || hy < 0.02) return; if (alongU) F.box((a + b) / 2, fixed, ya + hy / 2, b - a, hy, T, mat, H); else F.box(fixed, (a + b) / 2, ya + hy / 2, T, hy, b - a, mat, H); };
    const su = o.stairSide || 1;
    const bigU = -su * hw / 2, dU = su * (hw - 2.2);
    // facciata: portone aperto (4,8 × 4,8 m) e porta
    const holes = [[bigU - 2.4, bigU + 2.4, y + 4.8], [dU - 1.1, dU + 1.1, y + 2.6]].sort((a, b) => a[0] - b[0]);
    let cur = -hw;
    for (const [a, b, top] of holes) { piece(true, T / 2, cur, a, y, Hh); piece(true, T / 2, a, b, top, y + Hh - top); cur = b; }
    piece(true, T / 2, cur, hw, y, Hh);
    C.makeDoor(F.x(dU, T / 2), F.z(dU, T / 2), y, !F.sw, F.N[0], F.N[1], house);
    F.box(bigU, -0.05, y + 4.95, 5.1, 0.3, 0.12, MAT.gate, nc);                             // architrave del portone
    F.box(bigU, -0.02, y + 0.04, 5.0, 0.08, 1.4, MAT.concrete, nc);                        // rampa
    for (const s of [-1, 1]) F.box(bigU + s * 2.5, -0.06, y + 2.4, 0.14, 4.8, 0.12, o.barn ? M.trimMat : MAT.paintY, nc);
    // retro e fianchi con una fascia di finestre alte
    const band = (alongU, fixed, a0, a1) => {
      if (o.barn) {
        // fienile: tavole piene con qualche finestrella quadrata del fienile (niente nastro di vetro industriale)
        piece(alongU, fixed, a0, a1, y, 5.0); piece(alongU, fixed, a0, a1, y + 6.0, Hh - 6.0);
        let c0 = a0;
        for (let c = a0 + 2.2; c < a1 - 1.2; c += 3.4) {
          piece(alongU, fixed, c0, c - 0.45, y + 5.0, 1.0);
          if (alongU) F.box(c, fixed, y + 5.5, 0.9, 0.9, 0.06, MAT.glass, { house, cast: false }); else F.box(fixed, c, y + 5.5, 0.06, 0.9, 0.9, MAT.glass, { house, cast: false });
          piece(alongU, fixed, c - 0.45, c + 0.45, y + 5.0, 0.05); piece(alongU, fixed, c - 0.45, c + 0.45, y + 5.95, 0.05);
          c0 = c + 0.45;
        }
        piece(alongU, fixed, c0, a1, y + 5.0, 1.0);
        return;
      }
      piece(alongU, fixed, a0, a1, y, 5.0); piece(alongU, fixed, a0, a1, y + 6.0, 1.0);
      const c = (a0 + a1) / 2, len = a1 - a0;
      if (alongU) F.box(c, fixed, y + 5.5, len, 1.0, 0.06, MAT.glass, { house, cast: false }); else F.box(fixed, c, y + 5.5, 0.06, 1.0, len, MAT.glass, { house, cast: false });
    };
    band(true, d - T / 2, -hw, hw);
    for (const sd of [-1, 1]) band(false, sd * (hw - T / 2), T, d - T);
    // tetto piano con fascia colorata e parapetto basso
    F.box(0, d / 2, y + Hh + 0.12, w, 0.24, d, MAT.inner, H);
    F.box(0, d / 2, y + Hh + 0.25, w, 0.02, d, MAT.roof, nc);
    if (!o.barn) {
      F.box(0, -0.06, y + Hh - 0.35, w + 0.12, 0.7, 0.12, MAT.board, nc);
      for (const [u, v, lu, lv] of [[0, T / 2, w, T], [0, d - T / 2, w, T], [-hw + T / 2, d / 2, T, d - 2 * T], [hw - T / 2, d / 2, T, d - 2 * T]]) F.box(u, v, y + Hh + 0.5, lu, 0.5, lv, MAT.concrete, H);
    } else {
      // v27: fienile con tetto a due falde (calpestabile) e timpani di legno
      const alongX = F.W >= F.D, span = alongX ? F.D : F.W, rlen = alongX ? F.W : F.D;
      const half = span / 2 + 0.5, rise = 0.6 * half, thick = 0.2, rot = alongX ? 0 : Math.PI / 2, roofY = y + Hh + 0.24;
      addGeo(C.gableRoofGeo(rlen + 0.8, half, rise, thick), o.cx, roofY, o.cz, C.roofMatFor('#4a4f5a'), { house, rotY: rot, roof: true });
      addGeo(C.ridgeGeo(rlen + 0.9), o.cx, roofY + rise + thick, o.cz, M.capMat, { house, rotY: rot, roof: true });
      const eg = C.gableEndGeo(span / 2, half, rise, T);
      for (const e of [-1, 1]) {
        if (alongX) addGeo(eg, o.cx + e * (F.W / 2 - T / 2), roofY, o.cz, wm, { house, roof: true });
        else addGeo(eg, o.cx, roofY, o.cz + e * (F.D / 2 - T / 2), wm, { house, roof: true, rotY: Math.PI / 2 });
      }
      for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) {
        const a = half * k / 5, b2 = half * (k + 1) / 5, ym = rise * (1 - (a + b2) / 2 / half) + thick;
        const lo = sd > 0 ? a : -b2, hi = sd > 0 ? b2 : -a;
        if (alongX) addCollider({ type: 'box', minX: o.cx - rlen / 2 - 0.4, maxX: o.cx + rlen / 2 + 0.4, minY: roofY, maxY: roofY + ym, minZ: o.cz + lo, maxZ: o.cz + hi });
        else addCollider({ type: 'box', minX: o.cx + lo, maxX: o.cx + hi, minY: roofY, maxY: roofY + ym, minZ: o.cz - rlen / 2 - 0.4, maxZ: o.cz + rlen / 2 + 0.4 });
      }
      house.pitch = { alongX, rise }; house.lodH = Hh + 0.24; house.roofTop = roofY + rise + thick;
      // balle di fieno nel soppalco
      for (let i = 0; i < 3; i++) { const u = -su * (1.2 + i * 1.7), v = d - T - 0.55; if (Math.abs(u) > hw - 1) break; addBox(1.4, 0.8, 0.9, F.x(u, v), y + 3.2 + 0.4, F.z(u, v), M.hayMat || M.crateMat, { house }); }
    }
    // pavimento
    F.box(0, d / 2, y + 0.1, w - 2 * T, 0.2, d - 2 * T, MAT.concrete, { house, cast: false });
    // soppalco sul retro (5 m) con scala lungo il fianco "su"
    const vm = d - T - 5, U = (s) => su * (hw - T - s), fy = y + 0.2;
    F.box(0, (vm + d - T) / 2, y + 3.1, w - 2 * T, 0.2, d - T - vm, MAT.concrete, H);
    for (let i = 1; i <= 10; i++) F.box(U(0.6), vm - 3.2 + 0.32 * (i - 0.5), fy + 0.15 * i, 1.2, 0.3 * i, 0.32, MAT.stair, { house, cast: i > 6 });
    { const a = Math.min(U(1.25), U(w - 2 * T)), b = Math.max(U(1.25), U(w - 2 * T)); F.box((a + b) / 2, vm + 0.03, y + 3.7, b - a, 1.0, 0.05, MAT.rail, { house, cast: false }); }
    for (let x = -hw + 1; x <= hw - 1; x += Math.max(2.5, (w - 2) / 4)) F.box(x, vm + 0.1, y + 1.5, 0.2, 3.0, 0.2, MAT.gate, H);   // pilastri del soppalco
    house.stair = { flights: [{ k: 0, sx: F.x(U(0.6), vm - 4.0), sz: F.z(U(0.6), vm - 4.0), ex: F.x(U(0.6), vm + 0.9), ez: F.z(U(0.6), vm + 0.9), box: F.rect(U(0.6) - 0.6, U(0.6) + 0.6, vm - 3.2, vm) }] };
    // scaffali e casse
    const rU = -su * (hw - T - 0.7);
    for (let v = 2.5; v < vm - 1.2; v += 4.2) {
      special('rack', F.x(rU, v + 1.95), F.z(rU, v + 1.95), y + 0.2, null, { rot: F.rot + Math.PI / 2 });
      addCollider({ type: 'box', minX: Math.min(F.x(rU - 0.55, v), F.x(rU + 0.55, v + 3.9)), maxX: Math.max(F.x(rU - 0.55, v), F.x(rU + 0.55, v + 3.9)), minY: y, maxY: y + 4.2, minZ: Math.min(F.z(rU - 0.55, v), F.z(rU + 0.55, v + 3.9)), maxZ: Math.max(F.z(rU - 0.55, v), F.z(rU + 0.55, v + 3.9)), noStand: true });
      for (const ly of [0.41, 1.76]) if (rnd() < 0.8) { const cv = v + 1.0 + rnd() * 2; C.addCrate(1.1, 1.0, 1.1, F.x(rU, cv), y + ly + 0.5, F.z(rU, cv), { house, collide: false }); }
    }
    for (let i = 0; i < 3; i++) { const u = sr(-hw / 3, hw / 3), v = sr(2.5, vm - 1.5), s = sr(1.0, 1.4); C.addCrate(s, s, s, F.x(u, v), y + 0.2 + s / 2, F.z(u, v), H); }
    for (let i = 0; i < 2; i++) { const u = sr(-hw + 2, hw - 2), v = sr(vm + 1, d - T - 1), s = 1.1; C.addCrate(s, s, s, F.x(u, v), y + 3.2 + s / 2, F.z(u, v), H); }
    // insegna (non sui fienili)
    if (!o.barn) {
      const si = SHOPS.findIndex(s => s.n === (o.theme === 'port' ? 'MAGAZZINO' : pick(['OFFICINA', 'MAGAZZINO'])));
      addGeo(cgeo('sign' + si + '_4.8', () => signGeometry(si, 4.8, 1.2)), F.x(-bigU, -0.14), y + 5.6, F.z(-bigU, -0.14), MAT.sign, { house, rotY: F.rot, cast: false });
      F.box(-bigU, -0.07, y + 5.6, 5.0, 1.4, 0.1, MAT.board, nc);
    }
    // bottino
    { const u = sr(-hw / 2, hw / 2), v = sr(2, vm - 2); lootSpots.push(new THREE.Vector3(F.x(u, v), y + 0.2, F.z(u, v))); }
    lootSpots.push(new THREE.Vector3(F.x(0, vm + 2.5), y + 3.2, F.z(0, vm + 2.5)));
    if (rnd() < 0.6) chestSpots.push({ pos: new THREE.Vector3(F.x(-su * (hw - 2), vm + 2.5), y + 3.2, F.z(-su * (hw - 2), vm + 2.5)), rot: F.rot });
    houses.push(house);
    C.chunkAt(o.cx, o.cz).houses.push(house);
    if (o.barn) stats.fienili = (stats.fienili || 0) + 1; else stats.capannoni++;
    return house;
  }

  // ═════════ strade, marciapiedi, piazza ═════════
  function streets(t) {
    const pl = t.plan, y = t.h, RW = pl.rw, SW = pl.sw;
    const segs = (a, b, cuts) => { const out = []; let cur = a; for (const [c0, c1] of cuts.sort((p, q) => p[0] - q[0])) { if (c1 <= cur || c0 >= b) continue; if (c0 > cur) out.push([cur, c0]); cur = Math.max(cur, c1); } if (cur < b) out.push([cur, b]); return out; };
    const sideItems = [];   // posti per lampioni/auto lungo i marciapiedi
    const asph = pl.surf === 'asphalt', rm = roadMat(pl), plank = pl.walk === 'plank';
    const nc = { collide: false, cast: false };
    for (const vert of [true, false]) for (const o of (vert ? pl.ox : pl.oz)) {
      const L = lineLen(pl, o);
      const crosses = (vert ? pl.oz : pl.ox).filter(c => Math.abs(c) < L - RW && Math.abs(o) < lineLen(pl, c) - RW);
      const pz = pl.hp && Math.abs(o) < pl.hp ? [[-pl.hp, pl.hp]] : [];          // la strada entra nella piazzetta
      // carreggiata: le strade lungo z si interrompono agli incroci (l'incrocio appartiene a quelle lungo x)
      const road = segs(-L, L, (vert ? crosses.map(c => [c - RW, c + RW]) : []).concat(pz));
      const B = (a0, a1, off, hgt, yc, wid, mat, opt) => {
        const len = a1 - a0, c = (a0 + a1) / 2;
        if (vert) addBox(wid, hgt, len, t.x + o + off, yc, t.z + c, mat, opt); else addBox(len, hgt, wid, t.x + c, yc, t.z + o + off, mat, opt);
      };
      for (const [a, b] of road) {
        B(a, b, 0, 0.08, y, 2 * RW, rm, nc);
        // linea di mezzeria tratteggiata (lontano dagli incroci)
        if (asph) for (let s = a + 4.5; s < b - 4.5; s += 6) B(s, s + 2.6, 0, 0.012, y + 0.045, 0.14, MAT.paint, nc);
      }
      // strisce pedonali ai lati di ogni incrocio
      if (asph) for (const c of crosses) for (const sd of [-1, 1]) {
        const zc = c + sd * (RW + SW / 2);
        if (Math.abs(zc) > L - 1) continue;
        for (let k = -2.5; k <= 2.5; k += 1) B(zc - 0.9, zc + 0.9, k * 1.1, 0.012, y + 0.046, 0.55, MAT.paint, nc);
      }
      if (SW > 0) {
        // marciapiedi (con cordolo) o passerelle di legno rialzate, interrotti agli incroci
        const walk = segs(-L, L, crosses.map(c => [c - RW - SW, c + RW + SW]).concat(pz));
        for (const sd of [-1, 1]) for (const [a, b] of walk) {
          if (b - a < 0.3) continue;
          if (plank) {
            B(a, b, sd * (RW + SW / 2), 0.3, y + 0.075, SW, TB.mats.plank, { cast: false });
            B(a, b, sd * (RW + 0.07), 0.34, y + 0.06, 0.14, TB.mats.timber, nc);
          } else {
            B(a, b, sd * (RW + SW / 2), 0.22, y + 0.05, SW, MAT.sidewalk, { cast: false });
            B(a, b, sd * (RW + 0.09), 0.24, y + 0.05, 0.18, MAT.curb, nc);
          }
          sideItems.push({ vert, o, sd, a, b });
        }
      } else {
        // niente marciapiedi: lampioni sul bordo; nei vicoli alpini cumuli di neve spalata lungo i lati
        const edge = segs(-L, L, crosses.map(c => [c - RW - 1.5, c + RW + 1.5]).concat(pz));
        for (const sd of [-1, 1]) for (const [a, b] of edge) {
          if (b - a < 2) continue;
          sideItems.push({ vert, o, sd, a, b });
          if (pl.surf === 'snow') for (let q = a + 1 + rnd() * 2; q < b - 2; ) {
            const e = Math.min(b - 1, q + sr(2.5, 6));
            B(q, e, sd * (RW - 0.45), 0.4, y + 0.2, 0.8, TB.mats.bank, { cast: false });
            q = e + sr(2, 5);
          }
        }
      }
    }
    // quadratini d'angolo dei marciapiedi agli incroci
    if (SW > 0) for (const ox of pl.ox) for (const oz of pl.oz) {
      if (Math.abs(oz) > lineLen(pl, ox) - RW || Math.abs(ox) > lineLen(pl, oz) - RW) continue;
      if (pl.hp && Math.abs(ox) < pl.hp && Math.abs(oz) < pl.hp) continue;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox(SW, plank ? 0.3 : 0.22, SW, t.x + ox + sx * (RW + SW / 2), y + (plank ? 0.075 : 0.05), t.z + oz + sz * (RW + SW / 2), plank ? TB.mats.plank : MAT.sidewalk, { cast: false });
      if (asph && t.r >= 70) for (const s of [-1, 1]) special('semaforo', t.x + ox + s * (RW + 0.4), t.z + oz + s * (RW + 0.4), y + 0.16, [0.1, 3.4, true], { rot: s > 0 ? 0 : Math.PI });
    }
    return sideItems;
  }

  function piazza(t) {
    const pl = t.plan, y = t.h, hp = pl.hp;
    if (!hp) return;
    const th = t.theme, cross = pl.layout === 'cross';
    addBox(hp * 2, 0.22, hp * 2, t.x, y + 0.05, t.z, th === 'alpine' ? TB.mats.snowCobble : MAT.cobble, { cast: false });
    // v38: nella piazza con la chiesa barocca (lato nord, costruita in world.js) niente monumento centrale
    const church = !!t.church;
    const mon = church ? 'none' : th === 'castle' || th === 'industrial' ? 'statue' : th === 'alpine' ? 'xmasTree' : th === 'western' || th === 'farm' ? 'well' : 'fountain2';
    if (mon === 'fountain2') { special('fountain2', t.x, t.z, y + 0.16, null, { rot: 0 }); addCollider({ type: 'cyl', x: t.x, z: t.z, r: 4.6, minY: y - 1, maxY: y + 0.64 }); addCollider({ type: 'cyl', x: t.x, z: t.z, r: 4.1, minY: y - 1, maxY: y + 1.5 }); addCollider({ type: 'cyl', x: t.x, z: t.z, r: 0.75, minY: y, maxY: y + 4.8, noStand: true }); lootSpots.push(new THREE.Vector3(t.x, y + 1.22, t.z + 2.4)); }
    else if (mon === 'statue') { special('statue', t.x, t.z, y + 0.16, null, { rot: rnd() * 6.28 }); addCollider({ type: 'box', minX: t.x - 1.1, maxX: t.x + 1.1, minY: y, maxY: y + 2.2, minZ: t.z - 1.1, maxZ: t.z + 1.1 }); lootSpots.push(new THREE.Vector3(t.x + 2.2, y + 0.16, t.z)); }
    else if (mon === 'xmasTree') {
      // v27: abete addobbato al centro e campanile sul lato della piazzetta
      special('xmasTree', t.x, t.z, y + 0.16, [0.45, 8, true], { rot: 0 });
      lootSpots.push(new THREE.Vector3(t.x + 3.2, y + 0.16, t.z));
      const bz = t.z - hp + 2.4;
      special('bellTower', t.x, bz, y + 0.16, null, { rot: 0 });
      addCollider({ type: 'box', minX: t.x - 1.6, maxX: t.x + 1.6, minY: y, maxY: y + 8.2, minZ: bz - 1.6, maxZ: bz + 1.6 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) addCollider({ type: 'box', minX: t.x + sx * 1.4 - 0.23, maxX: t.x + sx * 1.4 + 0.23, minY: y + 8.2, maxY: y + 10.5, minZ: bz + sz * 1.4 - 0.23, maxZ: bz + sz * 1.4 + 0.23, noStand: true });
      lootSpots.push(new THREE.Vector3(t.x, y + 8.36, bz));
    }
    else if (mon === 'well') { special('well', t.x, t.z, y + 0.16, null, { rot: rnd() * 6.28 }); addCollider({ type: 'cyl', x: t.x, z: t.z, r: 1.1, minY: y - 1, maxY: y + 1.0 }); lootSpots.push(new THREE.Vector3(t.x + 1.8, y + 0.16, t.z)); }
    const trees = TREE_FOR[th] || TREE_FOR.classic;
    const k = hp - 3.2, lampT = pl.surf === 'asphalt' ? 'lamp' : 'lantern';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (church && sz < 0) continue;
      if (!cross) {
        special('planter', t.x + sx * k, t.z + sz * k, y + 0.16, [1.0, 0.75, false], { rot: 0 });
        extraTrees.push({ x: t.x + sx * k, z: t.z + sz * k, k: pick(trees), y: y + 0.76 });
      }
      special(lampT, t.x + sx * (hp - 0.6), t.z + sz * (hp - 0.6), y + 0.16, [0.15, 5, true], { rot: Math.atan2(-sx, -sz) });
      stats.lampioni++;
    }
    if (th === 'alpine') {
      // slitte, rastrelliera degli sci, legnaia, cumuli di neve
      special('skiRack', t.x + hp - 1.2, t.z + 3.5, y + 0.16, [0.3, 1.3, true], { rot: -Math.PI / 2 });
      special('sled', t.x - hp + 1.6, t.z + 2.5, y + 0.16, null, { rot: 0.4 });
      special('woodpile', t.x - hp + 1.0, t.z - 4.5, y + 0.16, null, { rot: Math.PI / 2 });
      addCollider({ type: 'box', minX: t.x - hp + 0.4, maxX: t.x - hp + 1.6, minY: y, maxY: y + 1.0, minZ: t.z - 5.9, maxZ: t.z - 3.1 });
      special('snowPile', t.x + hp - 2, t.z - hp + 5, y + 0.16, null);
    }
    if (th === 'castle') {
      // mercato: bancarelle su un lato della piazza
      for (let i = 0; i < 3; i++) {
        const sx = t.x - hp + 3 + i * 3.6, sz = t.z + hp - 1.6;
        if (sx > t.x + hp - 2) break;
        special('stall', sx, sz, y + 0.16, null, { rot: Math.PI, c: i });
        addCollider({ type: 'box', minX: sx - 1.35, maxX: sx + 1.35, minY: y, maxY: y + 1.0, minZ: sz - 0.7, maxZ: sz + 0.7 });
      }
    }
    // panchine rivolte verso il monumento, cestini
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + (cross ? Math.PI / 4 : 0), r = cross ? 5.6 : 6.2;
      if (church && Math.sin(a) < -0.5) continue;
      for (const off of (cross ? [0] : [-1.4, 1.4])) {
        const bx = t.x + Math.cos(a) * r - Math.sin(a) * off, bz = t.z + Math.sin(a) * r + Math.cos(a) * off;
        special('bench', bx, bz, y + 0.16, null, { rot: Math.atan2(-Math.cos(a), -Math.sin(a)) });
        addCollider({ type: 'cyl', x: bx, z: bz, r: 0.55, minY: y, maxY: y + 0.6 });
      }
      if (!cross) special('bin', t.x + Math.cos(a) * r - Math.sin(a) * 3.0, t.z + Math.sin(a) * r + Math.cos(a) * 3.0, y + 0.16, [0.28, 0.9, false]);
    }
    // edicola, tavolini del bar
    if ((th === 'classic' || th === 'port' || th === 'castle') && !church) {
      special('kiosk', t.x + hp - 2.2, t.z - hp + 2.0, y + 0.16, null, { rot: Math.PI / 2 * Math.round(rnd() * 3) });
      addCollider({ type: 'box', minX: t.x + hp - 3.6, maxX: t.x + hp - 0.8, minY: y, maxY: y + 2.5, minZ: t.z - hp + 0.6, maxZ: t.z - hp + 3.4 });
      for (let i = 0; i < (th === 'castle' ? 0 : 3); i++) {
        const cx = t.x - hp + 2.0 + i * 2.6, cz = t.z + hp - 2.4;
        special('cafeSet', cx, cz, y + 0.16, [0.45, 0.78, false], { rot: 0 });
        if (i !== 1) special('umbrella', cx, cz + 0.01, y + 0.16, null, { c: i, rot: 0 });
      }
    }
  }

  /** lampioni, auto parcheggiate, cestini e fermate lungo le strade */
  function streetLife(t, items) {
    const pl = t.plan, y = t.h, RW = pl.rw, SW = pl.sw, asph = pl.surf === 'asphalt', th = t.theme;
    const lampT = asph ? 'lamp' : 'lantern', lampOff = SW > 0 ? RW + 0.5 : RW - 0.3;
    const ly = y + (pl.walk === 'plank' ? 0.225 : SW > 0 ? 0.16 : 0.04);
    let busDone = t.r < 40 || !asph;
    for (const it of items) {
      const pos = (s, off) => it.vert ? [t.x + it.o + off, t.z + s] : [t.x + s, t.z + it.o + off];
      const len = it.b - it.a;
      // lampioni alternati (uno ogni ~22 m; lanterne di legno fuori dalle città asfaltate)
      const step = asph ? 22 : 18;
      for (let s = it.a + 4 + ((it.sd > 0) ? 0 : step / 2); s < it.b - 3; s += step) {
        const [x, z] = pos(s, it.sd * lampOff);
        const rot = it.vert ? (it.sd > 0 ? -Math.PI / 2 : Math.PI / 2) : (it.sd > 0 ? Math.PI : 0);
        special(lampT, x, z, ly, [0.15, 5, true], { rot });
        stats.lampioni++;
        if (asph && rnd() < 0.25) { const [bx, bz] = pos(s + 1.2, it.sd * (RW + 0.5)); special('bin', bx, bz, y + 0.16, [0.28, 0.9, false]); }
      }
      if (asph && rnd() < 0.15) { const [hx, hz] = pos(it.a + len * rnd(), it.sd * (RW + 0.35)); special('hydrant', hx, hz, y + 0.16, [0.16, 0.7, true]); }
      if (!busDone && len > 14 && rnd() < 0.3) {
        busDone = true;
        const s = (it.a + it.b) / 2, [x, z] = pos(s, it.sd * (RW + SW - 0.75));
        const rot = it.vert ? (it.sd > 0 ? -Math.PI / 2 : Math.PI / 2) : (it.sd > 0 ? Math.PI : 0);
        special('busStop', x, z, y + 0.16, null, { rot });
        addCollider({ type: 'box', minX: x - (it.vert ? 0.75 : 1.7), maxX: x + (it.vert ? 0.75 : 1.7), minY: y + 2.4, maxY: y + 2.6, minZ: z - (it.vert ? 1.7 : 0.75), maxZ: z + (it.vert ? 1.7 : 0.75) });
      }
      if (th === 'western') {
        // staccionate per i cavalli lungo la via, botti sulle passerelle, qualche carro
        for (let s = it.a + 7; s < it.b - 7; s += 13) {
          if (rnd() < 0.45) { const [x, z] = pos(s, it.sd * (RW - 0.4)); special('hitchRail', x, z, y + 0.04, null, { rot: (it.vert ? Math.PI / 2 : 0) + (it.sd > 0 ? Math.PI : 0) }); }
          if (rnd() < 0.35) { const [x, z] = pos(s + 4, it.sd * (RW + SW - 0.45)); special('barrel', x, z, ly, [0.38, 0.9, false]); }
        }
        if (len > 30 && rnd() < 0.5) { const [x, z] = pos(it.a + len * sr(0.3, 0.7), it.sd * (RW - 1.4)); special('wagon', x, z, y + 0.04, null, { rot: it.vert ? 0 : Math.PI / 2 }); addCollider({ type: 'box', minX: x - (it.vert ? 0.8 : 1.6), maxX: x + (it.vert ? 0.8 : 1.6), minY: y, maxY: y + 1.3, minZ: z - (it.vert ? 1.6 : 0.8), maxZ: z + (it.vert ? 1.6 : 0.8) }); }
      }
      // auto parcheggiate lungo il cordolo (solo nelle città asfaltate)
      if (!asph) continue;
      for (let s = it.a + 5; s < it.b - 5; s += 6.5) {
        if (rnd() > 0.32) continue;
        const [x, z] = pos(s + sr(-0.6, 0.6), it.sd * (RW - 1.15));
        const flip = rnd() < 0.5 ? 0 : Math.PI;
        // v25: auto realistiche (berlina, utilitaria, SUV) con vernice metallizzata
        const cv = Math.floor(rnd() * CAR_VARIANTS), D = CAR_DIMS[cv];
        special('car', x, z, y + 0.02, null, { rot: (it.vert ? 0 : Math.PI / 2) + flip, c: cv, paint: Math.floor(rnd() * CAR_PAINTS.length) });
        const hx = it.vert ? D.hx : D.hz, hz = it.vert ? D.hz : D.hx;
        addCollider({ type: 'box', minX: x - hx, maxX: x + hx, minY: y, maxY: y + D.h, minZ: z - hz, maxZ: z + hz });
        stats.auto++;
      }
    }
  }

  // ═════════ lotti: edifici lungo i lati dei blocchi ═════════
  function blocks(t) {
    const pl = t.plan, y = t.h, th = t.theme, CHp = pl.ch;
    const big = t.r >= 70;
    const placed = [...(t.reserve || [])];
    // v27: nelle piante non a reticolo la piazzetta è un'area libera (non un blocco intero)
    if (pl.hp && pl.layout !== 'grid') placed.push([t.x - pl.hp - 1, t.x + pl.hp + 1, t.z - pl.hp - 1, t.z + pl.hp + 1]);
    const used = new Set();
    const tag = THEME_TAG[th] || 'u';
    const shopPick = () => {
      const cand = SHOPS.map((s, i) => i).filter(i => SHOPS[i].tags.includes(tag) && !used.has(i));
      const pool = cand.length ? cand : SHOPS.map((s, i) => i).filter(i => SHOPS[i].tags.includes(tag));
      const i = pick(pool); used.add(i); return i;
    };
    const fits = (x0, x1, z0, z1, gap) => {
      for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
        if (Math.hypot(px - t.x, pz - t.z) > t.r + 2) return false;
        if (pl.box && (Math.abs(px - t.x) > pl.box || Math.abs(pz - t.z) > pl.box)) return false;   // dentro le mura
      }
      for (const r of placed) if (x0 < r[1] + gap && x1 > r[0] - gap && z0 < r[3] + gap && z1 > r[2] - gap) return false;
      return true;
    };
    /** che edificio mettere in un lotto (tema, distanza dal centro) */
    function spec(rho, maxD) {
      const res = (n0, n1) => n0 + Math.floor(rnd() * (n1 - n0 + 1));
      const ws = [9, 12, 12, 15];
      const s = { kind: 'palazzo', w: pick(ws), d: Math.min(maxD, Math.round(sr(9, 12))), sb: 0 };
      // v27: nel deserto si vive dentro i camion; solo il centro della via ha saloon ed empori
      if (th === 'western' && (rho > 0.42 || s.d < 8.5 || rnd() < 0.25)) return { kind: 'truck', w: 9, d: 2.5, sb: 2.9 };
      if (s.d < 8.5) return { kind: 'house', w: 10.5, d: Math.max(8, maxD), sb: 0 };
      const house = () => ({ kind: 'house', w: Math.round(sr(10, 13)), d: Math.min(maxD - 3.5, Math.round(sr(9.5, 12))), sb: 3.5 });   // v41: case più grandi
      switch (th) {
        case 'western':
          return { ...s, w: pick([9, 12]), n: res(1, 2), style: 'wood', color: pick(PALETTE.wood), roof: 'flat', falseFront: true, porch: true, shop: rnd() < 0.75 ? shopPick() : -1 };
        case 'alpine':
          if (rho > 0.5 && rnd() < 0.65) return house();
          return { ...s, n: res(2, 3), style: 'wood', color: pick(PALETTE.wood), gStyle: rnd() < 0.5 ? 'stone' : 'plaster', gColor: rnd() < 0.5 ? '#b9ae98' : '#efe6d6', roof: 'gable', roofColor: pick(['#5a3a24', '#4a4f5a']), snow: true, balconies: 0.5, shop: rnd() < 0.45 ? shopPick() : -1 };
        case 'farm':
          // fienili rossi con il tetto a falde e case coloniche
          if (maxD >= 12 && rnd() < 0.45) return { kind: 'warehouse', barn: true, w: pick([12, 15]), d: Math.min(maxD, 13), sb: 0, color: pick(['#9a2f24', '#a8352a', '#8a2a20']) };
          if (rho > 0.3 || rnd() < 0.5) return house();
          return { ...s, n: res(1, 2), style: pick(['plaster', 'brick']), color: pick(PALETTE.plaster), roof: 'gable', roofColor: pick(['#a33b2a', '#6a3a2a']), shop: rnd() < 0.7 ? shopPick() : -1 };
        case 'industrial': case 'port':
          if (maxD >= 13 && rnd() < (th === 'industrial' ? 0.6 : 0.45)) return { kind: 'warehouse', w: pick([15, 18, 21]), d: Math.min(maxD, Math.round(sr(13, 17))), sb: 0, color: pick(WAREHOUSE_COLORS) };
          if (th === 'industrial') return { ...s, n: res(2, 3), style: pick(['modern', 'brick', 'modern']), color: null, roof: 'flat', shop: rnd() < 0.3 ? shopPick() : -1 };
          return { ...s, n: res(2, 3), style: pick(['pastel', 'plaster']), color: null, roof: 'flat', balconies: 0.3, awnings: true, shop: rnd() < 0.4 ? shopPick() : -1 };
        case 'castle':
          if (rho > 0.8 && rnd() < 0.5) return house();
          return { ...s, n: res(2, 3), style: 'stone', color: pick(PALETTE.stone), roof: rnd() < 0.5 ? 'gable' : 'flat', roofColor: pick(['#4a4f5a', '#3b3f48']), merlons: true, flag: rnd() < 0.3, shop: rnd() < 0.35 ? shopPick() : -1 };
        case 'coastal':
          // palafitte (case su pali con scala e terrazzino) lontano dal centro
          if (rho > 0.4 && maxD >= 12) return { kind: 'stilt', w: Math.round(sr(9.5, 11.5)), d: Math.min(maxD - 3.5, Math.round(sr(8.5, 10))), sb: 3.5 };
          return { ...s, n: res(2, 3), style: 'pastel', color: pick(PALETTE.pastel), roof: 'flat', balconies: 0.45, awnings: true, shop: rho < 0.7 && rnd() < 0.6 ? shopPick() : -1 };
        default: {
          if (rho > 0.82 && rnd() < 0.7) return house();
          if (big && rho < 0.38 && rnd() < 0.3) return { ...s, w: pick([12, 15]), d: Math.min(maxD, 12), n: res(5, 7), style: 'glass', color: pick(PALETTE.glass), gStyle: 'modern', gColor: '#3a3f45', roof: 'flat', shop: rnd() < 0.5 ? shopPick() : -1 };
          const center = rho < 0.5;
          const n = center ? res(3, big ? 5 : 4) : res(2, 3);
          const style = pick(center ? ['plaster', 'plaster', 'brick', 'modern', 'pastel'] : ['plaster', 'plaster', 'brick', 'pastel']);
          const gable = style !== 'modern' && rnd() < (center ? 0.25 : 0.5);
          return { ...s, n, style, color: null, roof: gable ? 'gable' : 'flat', roofColor: pick(['#a33b2a', '#b5512f', '#8a3a2a']), balconies: style === 'modern' ? 0.2 : 0.35, awnings: true, shop: rnd() < (center ? 0.8 : 0.35) ? shopPick() : -1 };
        }
      }
    }
    const placeLot = (sp, face, cx, cz, x0, x1, z0, z1) => {
      if (sp.kind === 'truck') return TB.truckHome(cx, cz, face, y, th);
      if (sp.kind === 'stilt') {
        const hs = TB.stiltHouse(cx, cz, sp.w, sp.d, face, y, th);
        if (rnd() < 0.7) { const F = frame(cx, cz, sp.w, sp.d, face), tu = sg1() * (sp.w / 2 + 0.6); extraTrees.push({ x: F.x(tu, -2.2), z: F.z(tu, -2.2), k: 'palm' }); }
        stats.case++;
        return hs;
      }
      if (sp.kind === 'house') {
        const sw = face >= 2;
        const hs = C.placeHouse(cx, cz, sw ? sp.d : sp.w, sw ? sp.w : sp.d, y, false, th, face);
        // siepe e vialetto davanti al giardino
        if (sp.sb > 1) {
          const F = frame(cx, cz, sp.w, sp.d, face), half = sp.w / 2 + 0.8;
          for (const sg of [-1, 1]) F.box(sg * (half + 0.9) / 2, -sp.sb + 0.35, y + 0.45, half - 0.9, 0.9, 0.6, MAT.hedge, { cast: true });
          F.box(0, -sp.sb / 2, y + 0.03, 1.3, 0.06, sp.sb, MAT.concrete, { collide: false, cast: false });
          if (rnd() < 0.6) { const tu = sg1() * (half - 1.2); extraTrees.push({ x: F.x(tu, -sp.sb + 1.4), z: F.z(tu, -sp.sb + 1.4), k: pick(TREE_FOR[th] || TREE_FOR.classic) }); }
        }
        // chalet: catasta di legna addossata a un fianco
        if (th === 'alpine' && rnd() < 0.75) {
          const F = frame(cx, cz, sp.w, sp.d, face), sd = sg1();
          special('woodpile', F.x(sd * (sp.w / 2 + 0.55), sp.d / 2), F.z(sd * (sp.w / 2 + 0.55), sp.d / 2), y, null, { rot: F.rot + sd * Math.PI / 2 });
          const [a0, a1, b0, b1] = F.rect(sd * (sp.w / 2 + 0.05), sd * (sp.w / 2 + 1.05), sp.d / 2 - 1.4, sp.d / 2 + 1.4);
          addCollider({ type: 'box', minX: a0, maxX: a1, minY: y, maxY: y + 1.0, minZ: b0, maxZ: b1 });
        }
        stats.case++;
        return hs;
      }
      if (sp.kind === 'warehouse') return warehouse({ ...sp, cx, cz, y, face, theme: th, stairSide: rnd() < 0.5 ? 1 : -1 });
      const style = sp.style;
      const color = sp.color || pick(PALETTE[style]);
      return palazzo({ ...sp, color, cx, cz, y, face, theme: th, stairSide: rnd() < 0.5 ? 1 : -1, backDoor: rnd() < 0.5 });
    };
    const sg1 = () => (rnd() < 0.5 ? -1 : 1);
    /** porta verso il centro della città (o verso la via principale) */
    const faceTo = (cx, cz) => {
      if (pl.layout === 'main') return cz < t.z ? 1 : 0;
      if (pl.layout === 'track') return cx < t.x ? 3 : 2;
      const dx = t.x - cx, dz = t.z - cz; return Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 2 : 3) : (dz < 0 ? 0 : 1);
    };
    function fill(r) {
      const tries = th === 'western' ? 14 : th === 'farm' ? 24 : 6;
      for (let k = 0; k < tries; k++) {
        if (th === 'farm' && rnd() < 0.7) {
          // campo coltivato con staccionata
          const w = Math.round(sr(8, 18) / 4) * 4, d = Math.round(sr(8, 14) / 4) * 4;
          const cx = t.x + sr(r.x0 + w / 2 + 1, r.x1 - w / 2 - 1), cz = t.z + sr(r.z0 + d / 2 + 1, r.z1 - d / 2 - 1);
          if (!fits(cx - w / 2 - 1, cx + w / 2 + 1, cz - d / 2 - 1, cz + d / 2 + 1, 1.0)) continue;
          placed.push([cx - w / 2 - 1, cx + w / 2 + 1, cz - d / 2 - 1, cz + d / 2 + 1]);
          TB.field(cx, cz, w, d, y, Math.floor(rnd() * 3));
          continue;
        }
        if (th === 'western') {
          // camion parcheggiati in file, rivolti verso la via principale
          const cx = t.x + sr(r.x0 + 6, r.x1 - 6), cz = t.z + sr(r.z0 + 5, r.z1 - 5), face = faceTo(cx, cz);
          const sw = face >= 2, W = sw ? 2.5 + 2.9 : 9, D = sw ? 9 : 2.5 + 2.9;
          const ox = sw ? (face === 2 ? -1.45 : 1.45) : 0, oz = sw ? 0 : (face === 0 ? -1.45 : 1.45);   // il lotto comprende il tendalino davanti
          if (!fits(cx + ox - W / 2 - 1, cx + ox + W / 2 + 1, cz + oz - D / 2 - 1, cz + oz + D / 2 + 1, 1.2)) continue;
          placed.push([cx + ox - W / 2 - 1, cx + ox + W / 2 + 1, cz + oz - D / 2 - 1, cz + oz + D / 2 + 1]);
          TB.truckHome(cx, cz, face, y, th);
          continue;
        }
        const w = Math.round(sr(10, 13)), d = Math.round(sr(9.5, 12));
        const stilt = th === 'coastal', m = stilt ? 4 : 1.5;
        const cx = t.x + sr(r.x0 + w / 2 + m, r.x1 - w / 2 - m), cz = t.z + sr(r.z0 + d / 2 + m, r.z1 - d / 2 - m);
        if (!fits(cx - w / 2 - m, cx + w / 2 + m, cz - d / 2 - m, cz + d / 2 + m, 1.5)) continue;
        placed.push([cx - w / 2 - m, cx + w / 2 + m, cz - d / 2 - m, cz + d / 2 + m]);
        const face = faceTo(cx, cz);
        if (stilt) { const sw = face >= 2; TB.stiltHouse(cx, cz, sw ? d : w, sw ? w : d, face, y, th); }
        else C.placeHouse(cx, cz, w, d, y, false, th, face);
        if (rnd() < 0.5) extraTrees.push({ x: cx + sg1() * (w / 2 + 2), z: cz + sg1() * (d / 2 + 2), k: pick(TREE_FOR[th] || TREE_FOR.classic) });
        stats.case++;
      }
    }
    // bordi dei blocchi
    const ex = [-Infinity, ...[...pl.ox].sort((p, q) => p - q), Infinity], ez = [-Infinity, ...[...pl.oz].sort((p, q) => p - q), Infinity];
    const rects = [];
    for (let i = 0; i + 1 < ex.length; i++) for (let j = 0; j + 1 < ez.length; j++) {
      const xa = ex[i], xb = ex[i + 1], za = ez[j], zb = ez[j + 1];
      const x0 = isFinite(xa) ? xa + CHp : -pl.R, x1 = isFinite(xb) ? xb - CHp : pl.R;
      const z0 = isFinite(za) ? za + CHp : -pl.R, z1 = isFinite(zb) ? zb - CHp : pl.R;
      if (pl.layout === 'grid' && pl.hp && x0 <= 0 && x1 >= 0 && z0 <= 0 && z1 >= 0) continue;          // piazza
      rects.push({ x0, x1, z0, z1, sides: [isFinite(za), isFinite(zb), isFinite(xa), isFinite(xb)] });
    }
    // prima i lotti affacciati sulle strade (dal centro verso fuori)
    rects.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
    for (const r of rects) {
      const bw = r.x1 - r.x0, bd = r.z1 - r.z0;
      for (let face = 0; face < 4; face++) {
        if (!r.sides[face]) continue;
        // face 0: strada a z minore (edificio rivolto a -z), 1: z maggiore, 2: x minore, 3: x maggiore
        const alongX = face < 2;
        const depthAvail = alongX ? bd : bw;
        const opp = r.sides[face ^ 1];
        const maxD = opp ? depthAvail / 2 - 0.7 : Math.min(depthAvail - 2, 17);
        if (maxD < 6.5) continue;
        const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
        let u = a0 + 0.2, guard = 0;
        while (u < a1 - 6 && guard++ < 40) {
          const midA = u + 6, edge = face === 0 ? r.z0 : face === 1 ? r.z1 : face === 2 ? r.x0 : r.x1;
          const px = alongX ? midA : edge, pz = alongX ? edge : midA;
          const rho = Math.hypot(px + (alongX ? 0 : 0), pz) / t.r;
          let sp = spec(rho, maxD);
          if (u + sp.w > a1) { if (sp.kind === 'palazzo' && a1 - u >= 9) sp.w = Math.floor((a1 - u) / 3) * 3; else if (sp.kind === 'house' && a1 - u >= 9.5) sp.w = Math.floor(a1 - u); else break; }
          const inward = face === 0 || face === 2 ? 1 : -1;
          const fLine = edge + inward * sp.sb, cMid = fLine + inward * sp.d / 2;
          const ua = u + sp.w / 2;
          const cx = t.x + (alongX ? ua : cMid), cz = t.z + (alongX ? cMid : ua);
          const W = alongX ? sp.w : sp.d, D = alongX ? sp.d : sp.w;
          const bx0 = cx - W / 2, bx1 = cx + W / 2, bz0 = cz - D / 2, bz1 = cz + D / 2;
          // il lotto include il giardino davanti
          const lx0 = alongX ? bx0 : Math.min(bx0, t.x + fLine - inward * sp.sb), lx1 = alongX ? bx1 : Math.max(bx1, t.x + fLine - inward * sp.sb);
          const lz0 = alongX ? Math.min(bz0, t.z + fLine - inward * sp.sb) : bz0, lz1 = alongX ? Math.max(bz1, t.z + fLine - inward * sp.sb) : bz1;
          if (fits(lx0, lx1, lz0, lz1, sp.kind === 'house' ? 2.0 : 1.3)) {
            placed.push([lx0, lx1, lz0, lz1]);
            placeLot(sp, face, cx, cz);
            u += sp.w + sr(1.3, sp.kind === 'house' ? 4 : 2.6);
          } else u += 1.5;
        }
      }
      // riempimento delle zone senza strada: case con giardino, file di camion, palafitte o campi coltivati
      if (!r.sides.every(Boolean) && th !== 'industrial') fill(r);
    }
    return placed;
  }

  /** v27: strutture speciali del tema che occupano spazio prima dei lotti (mura, miniere) */
  function themed(t) {
    t.reserve = [];
    const pl = t.plan;
    if (t.theme === 'castle' && pl.wallS) TB.castleWalls(t);
    const wantMine = t.theme === 'western' ? 2 : (t.theme === 'alpine' && (/^Miniera/.test(t.name || '') || rnd() < 0.4)) ? 1 : 0;
    if (!wantMine) return;
    // direzioni libere da strade: perpendicolari alla via principale (western) o oltre i vicoli (alpino)
    const dirs = t.theme === 'western' ? [[0, -1], [0, 1]] : [[1, 0], [-1, 0], [0, -1], [0, 1]];
    let made = 0;
    for (const N of dirs) {
      if (made >= wantMine) break;
      for (let k = 0; k < 8; k++) {
        const off = sr(-12, 12);
        const [x0, x1, z0, z1] = TB.mineRect(t, N, off);
        const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]];
        if (pts.some(([x, z]) => streetAt(t, x, z))) continue;
        if ([[x0, z0], [x1, z0], [x0, z1], [x1, z1]].some(([x, z]) => C.roadDist(x, z) < 6)) continue;
        if (t.reserve.some(r => x0 < r[1] && x1 > r[0] && z0 < r[3] && z1 > r[2])) continue;
        t.reserve.push([x0, x1, z0, z1]);
        TB.mine(t, N, off, t.theme === 'alpine');
        made++;
        break;
      }
    }
  }

  for (const t of C.TOWNS) {
    if (!t.plan) planTown(t);
    const items = streets(t);
    piazza(t);
    themed(t);
    t.lots = blocks(t);
    streetLife(t, items);
  }
  return stats;
}
