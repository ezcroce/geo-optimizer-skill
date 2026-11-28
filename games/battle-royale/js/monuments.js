// ─────────────────────────────────────────────────────────────
//  v38: monumenti unici della mappa
//   · chiesa barocca (facciata a due ordini con colonne, nicchie con statue, orologio e campanili)
//     con il grande blocco di marmo accanto, in una piazza
//   · arena dei gladiatori al centro della mappa (Colosseo): podio, gradinate, muro esterno ad archi,
//     velario a strisce, colonne e la statua dell'imperatore che indica il cielo
//  Geometrie unite (mergeParts) con un atlante 2×2 dedicato: 0 travertino a blocchi, 1 sabbia,
//  2 intonaco chiaro della chiesa, 3 marmo bianco venato.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeParts, makeAtlasMaterial } from './props.js?v=47';
import { paintPhoto, photosReady } from './texgen.js?v=47';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function makeMonumentAtlas() {
  const S = 1024, H = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', WRF), rnd = mulberry(3801);
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  // 0 · travertino a blocchi (filari orizzontali sfalsati, fori e macchie)
  {
    const ox = 0, oy = 0, rows = 4, rh = H / rows;
    g.fillStyle = '#e6d6b8'; g.fillRect(ox, oy, H, H);
    for (let r = 0; r < rows; r++) {
      const n = 2, bw = H / n, off = (r % 2) * bw / 2;
      for (let k = -1; k <= n; k++) {
        const x = ox + off + k * bw, y = oy + r * rh;
        g.fillStyle = hsl(36 + rnd() * 8, 28 + rnd() * 14, 74 + rnd() * 9); g.fillRect(x, y, bw, rh);
        for (let q = 0; q < 70; q++) { g.fillStyle = hsl(34, 25, 48 + rnd() * 20, 0.25 + rnd() * 0.35); g.beginPath(); g.ellipse(x + rnd() * bw, y + rnd() * rh, 1 + rnd() * 4, 0.6 + rnd() * 1.4, 0, 0, 6.283); g.fill(); }
        for (let q = 0; q < 6; q++) { g.strokeStyle = hsl(34, 20, 60, 0.25); g.lineWidth = 1; const yy = y + rnd() * rh; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + bw, yy + (rnd() - 0.5) * 6); g.stroke(); }
        const sh = g.createLinearGradient(0, y, 0, y + rh); sh.addColorStop(0, 'rgba(255,250,235,0.18)'); sh.addColorStop(0.85, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(60,40,20,0.22)');
        g.fillStyle = sh; g.fillRect(x, y, bw, rh);
        g.fillStyle = 'rgba(95,75,50,0.75)'; g.fillRect(x, y, 3, rh);
      }
      g.fillStyle = 'rgba(95,75,50,0.75)'; g.fillRect(ox, oy + r * rh, H, 3);
    }
    // macchie scure di sporco colato
    for (let q = 0; q < 26; q++) { const x = ox + rnd() * H, y = oy + rnd() * H; const gr = g.createLinearGradient(0, y, 0, y + 80); gr.addColorStop(0, 'rgba(70,55,35,0.16)'); gr.addColorStop(1, 'rgba(70,55,35,0)'); g.fillStyle = gr; g.fillRect(x, y, 6 + rnd() * 18, 80); }
  }
  // 1 · sabbia dell'arena (grana fine, ciottoli, solchi rastrellati)
  {
    const ox = H, oy = 0;
    g.fillStyle = '#d9b27a'; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 14000; k++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(120,84,40,${0.12 + rnd() * 0.2})` : `rgba(255,236,196,${0.12 + rnd() * 0.25})`; g.fillRect(ox + rnd() * H, oy + rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let k = 0; k < 60; k++) { g.fillStyle = hsl(30, 18, 45 + rnd() * 30, 0.6); g.beginPath(); g.ellipse(ox + rnd() * H, oy + rnd() * H, 2 + rnd() * 4, 1.5 + rnd() * 3, rnd() * 3, 0, 6.283); g.fill(); }
    for (let k = 0; k < 20; k++) { const y = oy + rnd() * H; g.strokeStyle = 'rgba(140,100,55,0.14)'; g.lineWidth = 3 + rnd() * 5; g.beginPath(); g.moveTo(ox, y); g.bezierCurveTo(ox + H * 0.3, y + (rnd() - 0.5) * 40, ox + H * 0.7, y + (rnd() - 0.5) * 40, ox + H, y); g.stroke(); }
    for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(120,80,40,0.16)'; g.beginPath(); g.ellipse(ox + rnd() * H, oy + rnd() * H, 8 + rnd() * 26, 4 + rnd() * 12, rnd() * 3, 0, 6.283); g.fill(); }
  }
  // 2 · pietra chiara della chiesa (bugnato fine, quasi bianco)
  {
    const ox = 0, oy = H, rows = 6, rh = H / rows;
    g.fillStyle = '#efe6d4'; g.fillRect(ox, oy, H, H);
    for (let r = 0; r < rows; r++) for (let k = -1; k < 3; k++) {
      const bw = H / 2, x = ox + k * bw + (r % 2) * bw / 2, y = oy + r * rh;
      g.fillStyle = hsl(40, 22 + rnd() * 10, 86 + rnd() * 6); g.fillRect(x, y, bw, rh);
      for (let q = 0; q < 40; q++) { g.fillStyle = hsl(36, 18, 70 + rnd() * 10, 0.18); g.fillRect(x + rnd() * bw, y + rnd() * rh, 1 + rnd() * 3, 1); }
      g.fillStyle = 'rgba(150,135,110,0.55)'; g.fillRect(x, y, 2, rh);
    }
    for (let r = 0; r < rows; r++) { g.fillStyle = 'rgba(150,135,110,0.55)'; g.fillRect(ox, oy + r * rh, H, 2); }
  }
  // 3 · marmo bianco con venature grigio-oro
  {
    const ox = H, oy = H;
    g.fillStyle = '#f3efe8'; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 700; k++) { g.fillStyle = hsl(40, 15, 88 + rnd() * 8, 0.3); const r = 4 + rnd() * 20; g.beginPath(); g.arc(ox + rnd() * H, oy + rnd() * H, r, 0, 6.283); g.fill(); }
    for (let k = 0; k < 22; k++) {
      let x = rnd() * H, y = rnd() * H, a = rnd() * 6.28;
      g.strokeStyle = rnd() < 0.35 ? hsl(36, 38, 55, 0.6) : hsl(220, 6, 48 + rnd() * 14, 0.45 + rnd() * 0.3); g.lineWidth = 0.8 + rnd() * 2.2;
      g.beginPath(); g.moveTo(ox + x, oy + y);
      for (let s2 = 0; s2 < 50; s2++) { a += (rnd() - 0.5) * 0.6; x = (x + Math.cos(a) * 9 + H) % H; y = (y + Math.sin(a) * 9 + H) % H; if (s2 % 10 === 9) { g.stroke(); g.beginPath(); g.moveTo(ox + x, oy + y); } else g.lineTo(ox + x, oy + y); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // v47: le foto arrivano in parallelo al resto del gioco: la grana si aggiunge appena sono pronte (prima dell'isola)
  photosReady.then(() => {
    // v45: grana fotografica sopra il disegno: travertino poroso, sabbia vera, intonaco e marmo appena segnati
    paintPhoto(g, 'plaster', 0, 0, H, H, { tile: H / 2, mode: 'detail', strength: 0.5, contrast: 1.1 });
    if (!paintPhoto(g, 'sand', H, 0, H, H, { tile: H / 2, mode: 'detail', strength: 0.75, contrast: 1.1 })) paintPhoto(g, 'dirt', H, 0, H, H, { tile: H / 2, mode: 'detail', strength: 0.55, contrast: 1.0 });   // v46: sabbia vera
    paintPhoto(g, 'plaster', 0, H, H, H, { tile: H / 2, mode: 'detail', strength: 0.4, contrast: 1.0, ox: 0.5 });
    paintPhoto(g, 'plaster', H, H, H, H, { tile: H / 2, mode: 'detail', strength: 0.22, contrast: 1.0, oy: 0.5 });
    t.needsUpdate = true;
  });
  return t;
}
export const monumentAtlas = makeMonumentAtlas();
export const monumentMaterial = makeAtlasMaterial('monument', monumentAtlas, { roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide });

// ───────────── aiuti geometrici ─────────────
const P = (geo, color, o = {}) => ({ geo, color, o });
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** cilindro fra due punti */
function rod(ax, ay, az, bx, by, bz, r, seg = 6, r2 = r) {
  _v0.set(bx - ax, by - ay, bz - az);
  const len = _v0.length();
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, _v1.copy(_v0).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
/** geometria da una lista di triangoli (winding corretto con il verso suggerito) */
class TriBuf {
  constructor() { this.p = []; }
  tri(A, B, C, hint) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) this.p.push(...A, ...C, ...B); else this.p.push(...A, ...B, ...C);
  }
  quad(A, B, C, D, hint) { this.tri(A, B, C, hint); this.tri(A, C, D, hint); }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); return g; }
}
/**
 * blocco a corona circolare fra due varchi (angoli gA → gB, misurati come atan2(z, x)); il varco è un
 * corridoio dritto di mezza larghezza w, quindi il bordo del blocco segue la retta (angolo = asin(w/r)).
 * faces: { top, inner, outer, caps } · innerY0 = da dove parte la faccia interna (sotto è nascosta)
 */
function sectorBlock(ra, rb, y0, y1, gA, gB, w, seg, faces = {}) {
  const T = new TriBuf(), F = { top: true, inner: true, outer: false, caps: true, innerY0: y0, ...faces };
  // F.bridge: settore che SCAVALCA un varco largo 2w centrato su gA (volta del corridoio sotto le gradinate)
  const ang = F.bridge ? (r, t) => gA + (t * 2 - 1) * Math.asin(Math.min(0.99, (w + 0.03) / r))
    : (r, t) => {   // v42: F.wA / F.wB = taglio diverso all'inizio e alla fine (varco del corridoio da una parte, scalinata dall'altra)
      const wa = F.wA ?? w, wb = F.wB ?? w, sa = wa > 0 ? Math.asin(Math.min(0.99, wa / r)) : 0, sb = wb > 0 ? Math.asin(Math.min(0.99, wb / r)) : 0;
      return (gA + sa) + ((gB - sb) - (gA + sa)) * t;
    };
  const pt = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let k = 0; k < seg; k++) {
    const t0 = k / seg, t1 = (k + 1) / seg;
    const a0 = ang(ra, t0), a1 = ang(ra, t1), b0 = ang(rb, t0), b1 = ang(rb, t1);
    const am = (a0 + a1) / 2, rin = [-Math.cos(am), 0, -Math.sin(am)], rout = [Math.cos(am), 0, Math.sin(am)];
    if (F.top) T.quad(pt(ra, a0, y1), pt(rb, b0, y1), pt(rb, b1, y1), pt(ra, a1, y1), [0, 1, 0]);
    if (F.inner) T.quad(pt(ra, a0, F.innerY0), pt(ra, a1, F.innerY0), pt(ra, a1, y1), pt(ra, a0, y1), rin);
    if (F.outer) T.quad(pt(rb, b0, y0), pt(rb, b1, y0), pt(rb, b1, y1), pt(rb, b0, y1), rout);
    if (F.bottom) T.quad(pt(ra, a0, y0), pt(ra, a1, y0), pt(rb, b1, y0), pt(rb, b0, y0), [0, -1, 0]);
  }
  if (F.caps && (w > 0 || F.wA || F.wB) && !F.bridge) for (const [t, s] of [[0, -1], [1, 1]]) {
    if ((t ? F.wB ?? w : F.wA ?? w) <= 0) continue;
    const aa = ang(ra, t), bb = ang(rb, t), tang = [-Math.sin(aa) * s, 0, Math.cos(aa) * s];   // v41: verso corretto (prima i fianchi dei corridoi erano rivolti all'interno e sembravano trasparenti)
    T.quad(pt(ra, aa, y0), pt(rb, bb, y0), pt(rb, bb, y1), pt(ra, aa, y1), tang);
  }
  return T.geo();
}
/** prisma triangolare (tetto a capanna), colmo lungo z */
function prism(w, h, d) {
  const T = new TriBuf(), x = w / 2, z = d / 2;
  const L = [-x, 0, -z], R = [x, 0, -z], Tp = [0, h, -z], L2 = [-x, 0, z], R2 = [x, 0, z], T2 = [0, h, z];
  T.quad(L, Tp, T2, L2, [-h, x, 0]); T.quad(R, R2, T2, Tp, [h, x, 0]);
  T.tri(L, R, Tp, [0, 0, -1]); T.tri(L2, T2, R2, [0, 0, 1]);
  return T.geo();
}
/** figura umana stilizzata (statue): piedi in y=0, guarda verso +z; pose: 'saint' | 'point' | 'bless' */
function statueParts(parts, color, tile, post, pose = 'saint', ts = 0.45) {
  const o = (x = 0, y = 0, z = 0, ex = {}) => ({ tile, ts, jit: 0.04, x, y, z, post, ...ex });
  parts.push(P(new THREE.BoxGeometry(0.13, 0.08, 0.27), color, o(-0.1, 0.04, 0.05)));
  parts.push(P(new THREE.BoxGeometry(0.13, 0.08, 0.27), color, o(0.1, 0.04, 0.05)));
  // veste con pieghe (lathe ondulato)
  const prof = []; for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(0.34 - t * 0.12 + Math.sin(t * 9) * 0.012, t * 1.0)); }
  const robe = new THREE.LatheGeometry(prof, 14);
  { const Pp = robe.attributes.position; for (let i = 0; i < Pp.count; i++) { const x = Pp.getX(i), z = Pp.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 7) * 0.05 * (1 - Pp.getY(i)); Pp.setXYZ(i, x * k, Pp.getY(i), z * k); } }
  parts.push(P(robe, color, o(0, 0.05, 0)));
  parts.push(P(new THREE.CylinderGeometry(0.21, 0.23, 0.52, 10), color, o(0, 1.28, 0)));
  parts.push(P(new THREE.BoxGeometry(0.46, 0.14, 0.3), color, o(0, 1.44, 0)));
  parts.push(P(new THREE.BoxGeometry(0.55, 0.12, 0.32), color, o(0.02, 1.2, 0.02, { rz: 0.55 })));       // fascia della toga
  parts.push(P(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), color, o(0, 1.57, 0)));
  parts.push(P(new THREE.SphereGeometry(0.125, 10, 8), color, o(0, 1.72, 0.01, { sy: 1.15 })));
  parts.push(P(new THREE.BoxGeometry(0.05, 0.05, 0.06), color, o(0, 1.7, 0.13)));                          // naso
  if (pose === 'point') {
    parts.push(P(new THREE.TorusGeometry(0.12, 0.022, 4, 12), '#d8c28a', { ...o(0, 1.78, 0, { rx: Math.PI / 2 }), tile: -1 }));   // corona d'alloro
    // braccio destro (−x) alzato che indica il cielo
    parts.push(P(rod(-0.24, 1.47, 0, -0.33, 1.78, 0.05, 0.065), color, o()));
    parts.push(P(rod(-0.33, 1.78, 0.05, -0.37, 2.06, 0.11, 0.055), color, o()));
    parts.push(P(new THREE.SphereGeometry(0.055, 8, 6), color, o(-0.372, 2.1, 0.115)));
    parts.push(P(rod(-0.372, 2.12, 0.12, -0.38, 2.24, 0.14, 0.016), color, o()));
    // braccio sinistro che regge il mantello
    parts.push(P(rod(0.24, 1.47, 0, 0.3, 1.2, 0.06, 0.065), color, o()));
    parts.push(P(rod(0.3, 1.2, 0.06, 0.2, 1.02, 0.2, 0.055), color, o()));
    parts.push(P(new THREE.BoxGeometry(0.16, 0.62, 0.1), color, o(0.27, 0.78, 0.1, { rz: 0.06 })));
    parts.push(P(new THREE.BoxGeometry(0.5, 0.9, 0.08), color, o(0, 1.0, -0.22, { rx: 0.08 })));          // mantello dietro
  } else if (pose === 'bless') {
    parts.push(P(rod(-0.24, 1.47, 0, -0.32, 1.25, 0.12, 0.06), color, o()));
    parts.push(P(rod(-0.32, 1.25, 0.12, -0.3, 1.5, 0.26, 0.05), color, o()));
    parts.push(P(rod(0.24, 1.47, 0, 0.28, 1.15, 0.08, 0.06), color, o()));
    parts.push(P(rod(0.28, 1.15, 0.08, 0.12, 1.1, 0.24, 0.05), color, o()));
    parts.push(P(new THREE.BoxGeometry(0.2, 0.26, 0.05), color, o(0.08, 1.14, 0.27, { rx: -0.4 })));     // libro
  } else {
    parts.push(P(rod(-0.24, 1.47, 0, -0.28, 1.15, 0.1, 0.06), color, o()));
    parts.push(P(rod(-0.28, 1.15, 0.1, -0.08, 1.12, 0.22, 0.05), color, o()));
    parts.push(P(rod(0.24, 1.47, 0, 0.28, 1.15, 0.1, 0.06), color, o()));
    parts.push(P(rod(0.28, 1.15, 0.1, 0.08, 1.14, 0.22, 0.05), color, o()));
    parts.push(P(rod(0.0, 1.13, 0.24, 0.0, 0.2, 0.3, 0.02), color, o()));                                  // bastone/croce
    parts.push(P(new THREE.BoxGeometry(0.22, 0.03, 0.03), color, o(0, 1.9, 0.28)));
    parts.push(P(rod(0.0, 1.13, 0.28, 0.0, 2.0, 0.28, 0.02), color, o()));
  }
}

// ═════════════════════════ CHIESA BAROCCA ═════════════════════════
// origine: centro della facciata a terra; la facciata guarda verso +z. Ingombro: x −7.3…14.6, z −10.2…2.6
export const CHURCH_W = { minX: -7.3, maxX: 14.6, minZ: -10.2, maxZ: 2.6 };
export function churchGeo() {
  const ST = { tile: 2, ts: 2.2, jit: 0.025 }, MB = { tile: 3, ts: 7, jit: 0.02 }, WM = '#fff8ec', DK = '#2a2420', TRIM = '#fbf3e2';
  const parts = [];
  const B = (w, h, d, x, y, z, color = WM, o = ST) => parts.push(P(new THREE.BoxGeometry(w, h, d), color, { ...o, x, y, z }));
  const C = (rt, rb, h, seg, x, y, z, color = WM, o = ST) => parts.push(P(new THREE.CylinderGeometry(rt, rb, h, seg), color, { ...o, x, y, z }));
  // mezzo disco nel piano xy (y ≥ 0), spessore lungo z / nel piano yz (y ≥ 0), spessore lungo x
  const half = (r, x, y, z, color, o = ST) => parts.push(P(new THREE.CylinderGeometry(r, r, 0.1, 12, 1, false, -Math.PI / 2, Math.PI), color, { ...o, x, y, z, rx: -Math.PI / 2 }));
  const halfX = (r, x, y, z, color, o = ST) => parts.push(P(new THREE.CylinderGeometry(r, r, 0.1, 12, 1, false, 0, Math.PI), color, { ...o, x, y, z, rz: Math.PI / 2 }));
  /** colonna corinzia con base, fusto rastremato (scanalature con jit) e capitello */
  const column = (x, z, y0, h, r) => {
    B(r * 2.7, 0.22, r * 2.7, x, y0 + 0.11, z, TRIM); C(r * 1.25, r * 1.35, 0.22, 12, x, y0 + 0.33, z, TRIM);
    C(r * 0.9, r, h - 0.95, 14, x, y0 + 0.44 + (h - 0.95) / 2, z, WM, { ...ST, jit: 0.05 });
    C(r * 1.45, r * 0.95, 0.42, 10, x, y0 + h - 0.31, z, TRIM); B(r * 3, 0.16, r * 3, x, y0 + h - 0.06, z, TRIM);
    for (const s of [-1, 1]) parts.push(P(new THREE.TorusGeometry(r * 0.32, r * 0.12, 4, 8), TRIM, { ...ST, x: x + s * r * 1.1, y: y0 + h - 0.32, z: z + r * 0.9 }));   // volute del capitello
  };
  const niche = (x, z, y0, wN, hN, pose) => {
    B(wN + 0.36, 0.18, 0.5, x, y0 - 0.09, z + 0.1, TRIM);                // davanzale
    B(wN, hN, 0.08, x, y0 + hN / 2, z - 0.02, '#8f8678', { tile: -1, jit: 0 });
    half(wN / 2, x, y0 + hN, z - 0.02, '#8f8678', { tile: -1, jit: 0 });
    parts.push(P(new THREE.TorusGeometry(wN / 2 + 0.08, 0.08, 4, 12, Math.PI), TRIM, { ...ST, x, y: y0 + hN, z: z + 0.06 }));
    for (const s of [-1, 1]) B(0.16, hN, 0.16, x + s * (wN / 2 + 0.08), y0 + hN / 2, z + 0.06, TRIM);
    statueParts(parts, '#fbfaf6', 3, new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + 0.02, z + 0.1), new THREE.Quaternion(), new THREE.Vector3(1.32, 1.32, 1.32)), pose);
  };
  const urn = (x, y, z, s = 1) => { C(0.12 * s, 0.2 * s, 0.25 * s, 8, x, y + 0.12 * s, z, TRIM); parts.push(P(new THREE.SphereGeometry(0.26 * s, 10, 7), TRIM, { ...ST, x, y: y + 0.45 * s, z })); parts.push(P(new THREE.ConeGeometry(0.1 * s, 0.32 * s, 8), TRIM, { ...ST, x, y: y + 0.82 * s, z })); };
  const balustrade = (x0, x1, y, z) => {
    B(x1 - x0, 0.14, 0.42, (x0 + x1) / 2, y + 0.07, z); B(x1 - x0, 0.14, 0.46, (x0 + x1) / 2, y + 0.86, z);
    for (let x = x0 + 0.22; x < x1 - 0.1; x += 0.36) parts.push(P(new THREE.LatheGeometry([[0.07, 0], [0.11, 0.1], [0.06, 0.28], [0.11, 0.5], [0.06, 0.7]].map(([r, yy]) => new THREE.Vector2(r, yy)), 6), TRIM, { ...ST, x, y: y + 0.13, z }));
  };

  // zoccolo, gradini davanti e corpo della chiesa
  B(14.6, 0.6, 10.6, 0, 0.3, -4.9, '#e9dfcb');
  for (let i = 0; i < 3; i++) B(6.4 - i * 0.5, 0.2, 0.55, 0, 0.1 + i * 0.2, 2.25 - i * 0.5, '#efe5d2');
  B(13, 14.4, 9.2, 0, 0.6 + 7.2, -5.1);
  parts.push(P(prism(13.4, 3.4, 9.6), '#b9a58a', { ...ST, tile: 0, ts: 1.6, y: 15.0, z: -5.1 }));          // tetto a capanna dietro la facciata
  // finestre ad arco sui fianchi
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = -2.6 - k * 2.6, x = sx * 6.52;
    B(0.08, 2.4, 1.1, x, 4.6, z, DK, { tile: -1, jit: 0 });
    halfX(0.55, x, 5.8, z, DK, { tile: -1, jit: 0 });
    B(0.12, 0.2, 1.5, x + sx * 0.04, 3.32, z, TRIM);
    B(0.2, 13.4, 0.5, sx * 6.55, 7.3, z - 1.3, TRIM);                    // lesene
  }
  // ── ordine inferiore ──
  B(13.6, 7.7, 0.7, 0, 0.6 + 3.85, -0.25);
  B(5.6, 7.7, 1.3, 0, 0.6 + 3.85, 0.4);                                   // avancorpo centrale
  for (const s of [-1, 1]) { column(s * 2.15, 1.25, 0.6, 7.0, 0.36); column(s * 3.35, 0.45, 0.6, 7.0, 0.36); column(s * 6.35, 0.4, 0.6, 7.0, 0.33); }
  // portale: porta di legno, cornice e timpano curvo
  B(2.3, 4.3, 0.1, 0, 0.6 + 2.15, 1.07, '#4c2f1c', { tile: -1, jit: 0.05 });
  half(1.15, 0, 4.9, 1.07, '#3e2616', { tile: -1, jit: 0 });
  for (let k = 0; k < 4; k++) B(0.9, 0.9, 0.06, (k % 2 ? 0.55 : -0.55), 1.6 + Math.floor(k / 2) * 1.5, 1.13, '#5e3b22', { tile: -1, jit: 0.04 });
  for (const s of [-1, 1]) B(0.3, 4.4, 0.24, s * 1.3, 0.6 + 2.2, 1.1, TRIM);
  parts.push(P(new THREE.TorusGeometry(1.32, 0.15, 5, 14, Math.PI), TRIM, { ...ST, y: 4.9, z: 1.12 }));
  parts.push(P(new THREE.TorusGeometry(1.75, 0.16, 5, 16, Math.PI), TRIM, { ...ST, y: 5.6, z: 1.18 }));
  B(3.9, 0.22, 0.5, 0, 5.62, 1.15, TRIM);
  B(1.0, 0.7, 0.2, 0, 6.5, 1.12, TRIM);                                   // cartiglio
  // nicchie con le statue fra le colonne
  niche(-4.75, 0.12, 2.0, 1.25, 3.0, 'saint'); niche(4.75, 0.12, 2.0, 1.25, 3.0, 'bless');
  // trabeazione e cornicione
  B(14.2, 0.8, 1.2, 0, 8.0, 0.2, TRIM); B(6.2, 0.8, 1.3, 0, 8.0, 1.0, TRIM);
  B(14.6, 0.3, 1.6, 0, 8.55, 0.25, TRIM); B(6.6, 0.3, 1.6, 0, 8.55, 1.15, TRIM);
  // ── ordine superiore ──
  B(9.4, 5.9, 0.6, 0, 8.7 + 2.95, -0.35);
  B(4.6, 5.9, 1.0, 0, 8.7 + 2.95, 0.05);
  balustrade(-6.9, -2.4, 8.7, 0.95); balustrade(2.4, 6.9, 8.7, 0.95);
  for (const s of [-1, 1]) {
    column(s * 1.85, 0.7, 8.7, 5.6, 0.29);
    B(0.62, 5.4, 0.3, s * 4.35, 8.7 + 2.9, 0.0, TRIM);
    // volute laterali che raccordano i due ordini
    parts.push(P(new THREE.TorusGeometry(1.25, 0.26, 6, 12, Math.PI / 2), TRIM, { ...ST, x: s * 4.75, y: 8.75, z: -0.15, rz: s > 0 ? 0 : Math.PI / 2 }));
    C(0.42, 0.42, 0.55, 12, s * 6.0, 9.15, -0.15, TRIM, { ...ST, rx: Math.PI / 2 });
    urn(s * 6.6, 8.7, 0.6, 1.1);
  }
  // finestrone centrale
  B(1.7, 2.6, 0.08, 0, 11.5, 0.58, '#34424f', { tile: -1, jit: 0 });
  for (const s of [-1, 1]) B(0.22, 2.9, 0.2, s * 0.95, 11.5, 0.6, TRIM);
  B(2.3, 0.22, 0.3, 0, 10.1, 0.62, TRIM); B(2.4, 0.22, 0.32, 0, 12.95, 0.62, TRIM);
  parts.push(P(prism(2.6, 0.6, 0.3), TRIM, { ...ST, y: 13.05, z: 0.62 }));
  B(0.06, 2.5, 0.06, 0, 11.5, 0.64, '#1d2228', { tile: -1, jit: 0 }); B(1.6, 0.06, 0.06, 0, 11.6, 0.64, '#1d2228', { tile: -1, jit: 0 });
  B(10.2, 0.6, 1.1, 0, 14.6, -0.05, TRIM); B(10.8, 0.25, 1.35, 0, 15.0, 0.0, TRIM);
  // ── attico con l'orologio ──
  B(4.4, 3.3, 0.9, 0, 15.1 + 1.65, -0.15);
  for (const s of [-1, 1]) parts.push(P(new THREE.TorusGeometry(0.95, 0.2, 5, 10, Math.PI / 2), TRIM, { ...ST, x: s * 2.2, y: 15.1, z: -0.1, rz: s > 0 ? 0 : Math.PI / 2 }));
  C(1.42, 1.42, 0.16, 28, 0, 16.75, 0.36, '#f6f0e2', { tile: -1, jit: 0, rx: Math.PI / 2 });
  parts.push(P(new THREE.TorusGeometry(1.48, 0.12, 6, 28), '#d9c493', { tile: -1, jit: 0.02, x: 0, y: 16.75, z: 0.44 }));
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; B(k % 3 ? 0.07 : 0.12, k % 3 ? 0.22 : 0.32, 0.04, Math.sin(a) * 1.18, 16.75 + Math.cos(a) * 1.18, 0.46, '#3a3530', { tile: -1, jit: 0, rz: -a }); }
  B(0.09, 0.8, 0.04, 0.25, 17.05, 0.5, '#22201e', { tile: -1, jit: 0, rz: -0.6 });     // lancette (le 10 e 10)
  B(0.07, 1.05, 0.04, -0.36, 17.1, 0.52, '#22201e', { tile: -1, jit: 0, rz: 0.75 });
  parts.push(P(new THREE.TorusGeometry(2.25, 0.22, 5, 18, Math.PI), TRIM, { ...ST, y: 18.4, z: -0.1 }));
  half(2.15, 0, 18.4, -0.2, WM);                                            // timpano curvo pieno
  C(0.75, 0.75, 0.12, 16, 0, 19.25, -0.08, '#e3d6bd', { tile: -1, jit: 0, rx: Math.PI / 2 });   // oculo
  B(4.9, 0.25, 1.1, 0, 18.4, -0.1, TRIM);
  urn(0, 20.55, -0.1, 1.25); urn(-2.3, 18.5, -0.1, 0.9); urn(2.3, 18.5, -0.1, 0.9);
  B(0.12, 1.1, 0.12, 0, 22.35, -0.1, '#3a342d', { tile: -1, jit: 0 }); B(0.6, 0.12, 0.12, 0, 22.55, -0.1, '#3a342d', { tile: -1, jit: 0 });   // croce
  // statue sul cornicione superiore
  for (const s of [-1, 1]) statueParts(parts, '#fbfaf6', 3, new THREE.Matrix4().compose(new THREE.Vector3(s * 4.3, 15.15, 0.1), new THREE.Quaternion(), new THREE.Vector3(1.1, 1.1, 1.1)), s > 0 ? 'bless' : 'saint');
  // ── campanili dietro la facciata ──
  for (const s of [-1, 1]) {
    const x = s * 4.6, z = -6.6;
    B(3.2, 5.6, 3.2, x, 15.0 + 2.8, z);
    for (const [dx, dz] of [[0, 1.61], [0, -1.61], [1.61, 0], [-1.61, 0]]) {
      B(dz ? 1.2 : 0.08, 2.2, dz ? 0.08 : 1.2, x + dx, 18.1, z + dz, DK, { tile: -1, jit: 0 });
      (dz ? half : halfX)(0.6, x + dx, 19.2, z + dz, DK, { tile: -1, jit: 0 });
    }
    C(0.45, 0.62, 0.8, 10, x, 18.4, z, '#c89a3a', { tile: -1, jit: 0.04 });   // campana (si intravede)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.3, 5.7, 0.3, x + sx * 1.62, 17.85, z + sz * 1.62, TRIM);
    B(3.8, 0.3, 3.8, x, 20.95, z, TRIM);
    // tetto a pagoda (falde concave) con lanterna e pigna
    parts.push(P(new THREE.CylinderGeometry(0.4, 2.7, 1.3, 4, 1), '#8f7b62', { tile: 0, ts: 1.3, jit: 0.03, x, y: 21.75, z, ry: Math.PI / 4 }));
    parts.push(P(new THREE.CylinderGeometry(2.7, 2.85, 0.16, 4, 1), '#a08a6c', { tile: 0, ts: 1.3, jit: 0.03, x, y: 21.12, z, ry: Math.PI / 4 }));
    C(0.36, 0.36, 0.9, 8, x, 22.85, z, TRIM); C(0.5, 0.2, 0.3, 8, x, 23.45, z, TRIM);
    parts.push(P(new THREE.SphereGeometry(0.3, 10, 7), TRIM, { ...ST, x, y: 23.85, z }));
    parts.push(P(new THREE.ConeGeometry(0.1, 0.5, 8), TRIM, { ...ST, x, y: 24.35, z }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) urn(x + sx * 1.7, 21.1, z + sz * 1.7, 0.55);
  }
  // ── il grande blocco di marmo accanto alla chiesa ──
  B(8.0, 9.6, 10.4, 10.6, 4.8, -4.9, '#ffffff', MB);
  B(8.2, 0.25, 10.6, 10.6, 9.62, -4.9, '#f2ede4', MB);
  const g = mergeParts(parts, 3802);
  g.userData.monument = true;
  return g;
}
/** collisori della chiesa (coordinate locali, facciata verso +z) */
export function churchColliders() {
  return [
    { minX: -7.3, maxX: 7.3, minY: 0, maxY: 0.6, minZ: -10.2, maxZ: 0.4 },            // zoccolo
    { minX: -6.5, maxX: 6.5, minY: 0, maxY: 15.1, minZ: -9.7, maxZ: -0.5 },            // corpo
    { minX: -6.8, maxX: 6.8, minY: 0, maxY: 8.7, minZ: -0.6, maxZ: 0.1 },              // facciata bassa
    { minX: -2.8, maxX: 2.8, minY: 0.6, maxY: 8.7, minZ: 0.1, maxZ: 1.1 },             // avancorpo
    { minX: -5.3, maxX: 5.3, minY: 8.7, maxY: 15.12, minZ: -0.65, maxZ: 0.6 },         // ordine superiore
    { minX: -2.2, maxX: 2.2, minY: 15.1, maxY: 18.5, minZ: -0.6, maxZ: 0.3 },          // attico
    { minX: -6.2, maxX: -3.0, minY: 15.0, maxY: 21.1, minZ: -8.2, maxZ: -5.0 },        // campanili
    { minX: 3.0, maxX: 6.2, minY: 15.0, maxY: 21.1, minZ: -8.2, maxZ: -5.0 },
    { minX: 6.6, maxX: 14.6, minY: 0, maxY: 9.75, minZ: -10.1, maxZ: 0.3 },            // blocco di marmo
    { minX: -3.2, maxX: 3.2, minY: 0, maxY: 0.2, minZ: 1.1, maxZ: 2.55 },              // gradini
    { minX: -2.95, maxX: 2.95, minY: 0, maxY: 0.4, minZ: 1.1, maxZ: 2.0 },
    { minX: -2.7, maxX: 2.7, minY: 0, maxY: 0.6, minZ: 1.1, maxZ: 1.5 },
    // colonne in aggetto (riparo)
    ...[-3.35, -2.15, 2.15, 3.35].map(x => ({ type: 'cyl', x, z: x * x > 6 ? 0.45 : 1.25, r: 0.45, minY: 0.6, maxY: 7.6, noStand: true })),
    ...[-6.35, 6.35].map(x => ({ type: 'cyl', x, z: 0.4, r: 0.42, minY: 0.6, maxY: 7.6, noStand: true })),
  ];
}

// ═════════════════════════ ARENA DEI GLADIATORI ═════════════════════════
export const ARENA = {
  RF: 30,                 // raggio della sabbia (il boss non esce di qui)
  POD: 31.2, POD_H: 3.2,  // podio
  TIERS: 8, TW: 2.35, TH: 1.55,
  RW0: 50, RW1: 53, WALL_H: 22, GATE_H: 7,
  TUN_H: 3.6,             // v39: volta dei corridoi sotto le gradinate
  GATE_W: 2.6,            // mezza larghezza dei varchi (corridoi sugli assi)
  AISLE_W: 1.05,          // v42: mezza larghezza delle scalinate sulle diagonali (dalla sabbia all'anello più alto)
  SAND_STEPS: 8, STAIR_R0: 26.4,
};
const GATES = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/**
 * costruisce l'arena centrata in (cx, cy, cz): ritorna la geometria (in coordinate locali) e, in
 * coordinate del mondo, collisori, punti bottino e forzieri
 */
export function buildArena(cx, cy, cz, seed = 1) {
  const A = ARENA, rnd = mulberry(seed * 7 + 3), w = A.GATE_W;
  const TR = { tile: 0, ts: 2.6, jit: 0.035 }, SAND = { tile: 1, ts: 7, jit: 0 }, MB = { tile: 3, ts: 0.5, jit: 0.03 };
  const parts = [], colliders = [], loot = [], chests = [];
  const spans = [0, 1, 2, 3].map(k => [k * Math.PI / 2, (k + 1) * Math.PI / 2]);
  // v42: 4 scalinate sulle diagonali (fra un corridoio e l'altro): nei collisori delle gradinate sono varchi
  //  "morbidi" (senza muri di fianco: ai lati si sale o si scende sui sedili); i gradini sono settori d'anello
  //  limitati alla striscia della scalinata
  const AW = A.AISLE_W, AISLES = [1, 3, 5, 7].map(k => { const a = k * Math.PI / 4; return { a, ax: Math.cos(a), az: Math.sin(a) }; });
  const aisleGates = AISLES.map(q => ({ ax: q.ax, az: q.az, w: AW - 0.38, soft: 1 }));
  const gatesW = GATES.map(([ax, az]) => ({ ax, az, w }));
  const gatesT = [...gatesW, ...aisleGates];
  // ogni quarto fra due corridoi diviso in due dalla scalinata
  const halves = spans.flatMap(([gA, gB]) => { const m = (gA + gB) / 2; return [[gA, m, { wA: w, wB: AW }], [m, gB, { wA: AW, wB: w }]]; });
  const add = (geo, color, o = TR) => parts.push(P(geo, color, o));
  const box = (w2, h, d, x, y, z, color, o = TR) => parts.push(P(new THREE.BoxGeometry(w2, h, d), color, { ...o, x, y, z }));
  const cyl = (rt, rb, h, seg, x, y, z, color, o = TR) => parts.push(P(new THREE.CylinderGeometry(rt, rb, h, seg), color, { ...o, x, y, z }));
  const W = (x, y, z) => new THREE.Vector3(cx + x, cy + y, cz + z);
  /** collisori dei fianchi dei corridoi (scatole allineate agli assi) per un anello fra ra e rb */
  const gateWalls = (ra, rb, y0, y1, thick = 0.8) => {
    for (const [ax, az] of GATES) for (const s of [-1, 1]) {
      const a0 = Math.sqrt(Math.max(0, ra * ra - w * w)), a1 = rb, p0 = s > 0 ? w : -w - thick, p1 = s > 0 ? w + thick : -w;
      const xs = ax ? [cx + Math.min(a0 * ax, a1 * ax), cx + Math.max(a0 * ax, a1 * ax)] : [cx + p0, cx + p1];
      const zs = az ? [cz + Math.min(a0 * az, a1 * az), cz + Math.max(a0 * az, a1 * az)] : [cz + p0, cz + p1];
      colliders.push({ type: 'box', minX: xs[0], maxX: xs[1], minY: cy + y0, maxY: cy + y1, minZ: zs[0], maxZ: zs[1], arena: true });
    }
  };

  // ── sabbia e corridoi lastricati ──
  add(new THREE.CylinderGeometry(A.RF + 0.4, A.RF + 0.4, 0.4, 64), '#ffffff', { ...SAND, y: -0.15 });
  for (const [ax, az] of GATES) box(ax ? 24 : w * 2, 0.1, az ? 24 : w * 2, ax * (A.RF + 12), 0.03, az * (A.RF + 12), '#cfc2a8', { ...TR, ts: 1.6 });
  // ── podio con parapetto e stendardi ──
  for (const [gA, gB, cut] of halves) {
    add(sectorBlock(A.RF, A.POD, 0, A.POD_H, gA, gB, w, 12, { top: true, ...cut }), '#d9c7a6');
    add(sectorBlock(A.POD - 0.35, A.POD, A.POD_H, A.POD_H + 0.6, gA, gB, w, 12, { outer: true, ...cut }), '#e8dcc4');
    add(sectorBlock(A.RF - 0.05, A.RF + 0.02, 0.0, 0.5, gA, gB, w, 12, { top: false, caps: false, ...cut }), '#9a8a70');   // zoccolo scuro
    add(sectorBlock(A.RF - 0.12, A.RF, A.POD_H - 0.25, A.POD_H, gA, gB, w, 12, { top: true, ...cut }), '#b04a2a', { tile: -1, jit: 0 });   // fascia rossa
  }
  colliders.push({ type: 'ring', x: cx, z: cz, r0: A.RF, r1: A.POD, minY: cy - 1, maxY: cy + A.POD_H + 0.6, gates: gatesT, arena: true });
  gateWalls(A.RF, A.POD, -1, A.POD_H + 0.6);
  for (let k = 0; k < 4; k++) for (const f of [0.2, 0.36, 0.64, 0.8]) {
    const a = (k + f) * Math.PI / 2, r = A.RF - 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r, ry = Math.atan2(-Math.cos(a), -Math.sin(a));
    box(2.2, 2.4, 0.05, x, 1.75, z, '#8e1c16', { tile: -1, jit: 0.02, ry });
    box(2.3, 0.14, 0.07, x, 2.95, z, '#d9b44a', { tile: -1, jit: 0, ry });
    box(1.0, 1.0, 0.07, x - Math.cos(a) * 0.01, 1.85, z - Math.sin(a) * 0.01, '#d9b44a', { tile: -1, jit: 0, ry, rz: Math.PI / 4 });
    box(0.62, 0.62, 0.08, x - Math.cos(a) * 0.03, 1.85, z - Math.sin(a) * 0.03, '#8e1c16', { tile: -1, jit: 0, ry, rz: Math.PI / 4 });
    box(1.6, 0.6, 0.05, x, 0.35, z, '#8e1c16', { tile: -1, jit: 0.02, ry, rz: 0 });
  }
  // ── gradinate ──
  for (let i = 0; i < A.TIERS; i++) {
    const ra = A.POD + i * A.TW, rb = ra + A.TW, y1 = A.POD_H + (i + 1) * A.TH, yPrev = i ? A.POD_H + i * A.TH : A.POD_H;
    const tint = i % 2 ? '#dccaa8' : '#e6d6b6';
    for (const [gA, gB, cut] of halves) {
      add(sectorBlock(ra, rb, 0, y1, gA, gB, w, 12, { innerY0: yPrev, ...cut }), tint);
      add(sectorBlock(ra - 0.02, ra + 0.5, y1, y1 + 0.06, gA, gB, w, 12, { inner: false, caps: false, ...cut }), '#f0e6d2');   // bordo del sedile
    }
    colliders.push({ type: 'ring', x: cx, z: cz, r0: ra, r1: rb, minY: cy - 1, maxY: cy + y1, gates: gatesT, arena: true });
    gateWalls(ra, rb, -1, y1);
    // v39: sopra i varchi le gradinate continuano (volta a TUN_H): prima il taglio era a tutta altezza e
    // da dentro si vedeva attraverso il muro esterno (che dal lato interno è chiuso solo sopra le gradinate)
    for (const [ax, az] of GATES) {
      const ga = Math.atan2(az, ax), last = i === A.TIERS - 1;
      add(sectorBlock(ra, rb, A.TUN_H, y1, ga, ga, w, 3, { bridge: true, bottom: true, outer: last, innerY0: Math.max(A.TUN_H, yPrev) }), tint);
      add(sectorBlock(ra - 0.02, ra + 0.5, y1, y1 + 0.06, ga, ga, w, 3, { bridge: true, inner: false }), '#f0e6d2');
      const a0 = ra, a1 = rb, xs = ax ? [cx + Math.min(a0 * ax, a1 * ax), cx + Math.max(a0 * ax, a1 * ax)] : [cx - w - 0.05, cx + w + 0.05];
      const zs = az ? [cz + Math.min(a0 * az, a1 * az), cz + Math.max(a0 * az, a1 * az)] : [cz - w - 0.05, cz + w + 0.05];
      colliders.push({ type: 'box', minX: xs[0], maxX: xs[1], minY: cy + A.TUN_H, maxY: cy + y1, minZ: zs[0], maxZ: zs[1], arena: true });
    }
    // bottino sparso sulle gradinate
    if (i % 2 === 1) for (let k = 0; k < 2; k++) { let f = 0.15 + rnd() * 0.7; if (Math.abs(f - 0.5) < 0.09) f += f < 0.5 ? -0.12 : 0.12; const a = (Math.floor(rnd() * 4) + f) * Math.PI / 2, r = ra + A.TW / 2; loot.push(W(Math.cos(a) * r, y1 + 0.1, Math.sin(a) * r)); }
  }
  const topY = A.POD_H + A.TIERS * A.TH;    // 15.6
  // ── v42: scalinate sulle diagonali: 8 gradini dalla sabbia al podio, poi 4 per ogni gradinata fino in cima ──
  {
    const steps = [];   // [r0, r1, quota]
    const n0 = A.SAND_STEPS, run0 = (A.RF - A.STAIR_R0) / n0;
    for (let m = 0; m < n0; m++) steps.push([A.STAIR_R0 + m * run0, A.STAIR_R0 + (m + 1) * run0, (m + 1) * A.POD_H / n0]);
    steps.push([A.RF, A.POD, A.POD_H]);   // pianerottolo sul podio (il parapetto qui è aperto)
    for (let i = 0; i < A.TIERS; i++) for (let j = 0; j < 4; j++) {
      const r0 = A.POD + i * A.TW + j * A.TW / 4;
      steps.push([r0, r0 + A.TW / 4, A.POD_H + i * A.TH + (j + 1) * A.TH / 4]);
    }
    for (const q of AISLES) {
      const ry = Math.PI / 2 - q.a;
      steps.forEach(([r0, r1, top], idx) => {
        const rm = (r0 + r1) / 2, yb = idx < n0 ? 0 : Math.max(0, top - 1.4), h = top - yb;
        box(AW * 2, h, r1 - r0 + 0.02, q.ax * rm, yb + h / 2, q.az * rm, idx % 2 ? '#e2d3b4' : '#ebdec4', { ...TR, ry });
        box(AW * 2 + 0.02, 0.05, 0.12, q.ax * (r0 + 0.06), top + 0.005, q.az * (r0 + 0.06), '#f4ecdc', { ...TR, ry });   // spigolo chiaro del gradino
        colliders.push({ type: 'ring', x: cx, z: cz, r0, r1, minY: cy - 1, maxY: cy + top, gates: [], only: { ax: q.ax, az: q.az, w: AW }, arena: true });
      });
      // fianchi della rampa dalla sabbia al podio (muretti bassi con un cordolo)
      for (const sd of [-1, 1]) {
        const px = -q.az * sd * (AW + 0.15), pz = q.ax * sd * (AW + 0.15);
        for (let m = 0; m < n0; m++) {
          const [r0, r1, top] = steps[m], rm = (r0 + r1) / 2;
          box(0.3, top + 0.35, r1 - r0 + 0.01, q.ax * rm + px, (top + 0.35) / 2, q.az * rm + pz, '#d4c29e', { ...TR, ry });
        }
      }
    }
    // i muretti della rampa: collisori (scatole sottili, solo dalla sabbia)
    for (const q of AISLES) for (const sd of [-1, 1]) for (let m = 0; m < n0; m++) {
      const [r0, r1, top] = steps[m], rm = (r0 + r1) / 2;
      const x = cx + q.ax * rm - q.az * sd * (AW + 0.22), z = cz + q.az * rm + q.ax * sd * (AW + 0.22);
      colliders.push({ type: 'cyl', x, z, r: 0.25, minY: cy - 1, maxY: cy + top + 0.35, noStand: true, arena: true });
    }
  }
  // ── v42: scale di legno dall'anello più alto alla cima del muro esterno (una per corridoio, appoggiata al muro) ──
  {
    const U0 = 47.8, U1 = 49.0, V = 5, LAND = 1.6, N = 18, rise = A.WALL_H - topY;
    for (const [ax, az] of GATES) {
      // u = verso l'esterno lungo l'asse, v = di lato (la scala sale da v = -V a v = +V)
      const sgn = ax + az > 0 ? 1 : -1;                 // verso di salita
      const P2 = (u, v) => ax ? [ax * u, v * sgn] : [v * -sgn, az * u];
      const ryS = ax ? 0 : Math.PI / 2;
      for (let k = 0; k < N; k++) {
        const v = -V + (k + 0.5) * (2 * V / N), y = topY + (k + 1) * rise / N;
        const [x, z] = P2((U0 + U1) / 2, v);
        box(ax ? U1 - U0 : 2 * V / N + 0.04, 0.09, ax ? 2 * V / N + 0.04 : U1 - U0, x, y - 0.045, z, k % 2 ? '#8a5a32' : '#7d5230', { tile: -1, jit: 0.05 });
        box(ax ? U1 - U0 : 0.04, rise / N, ax ? 0.04 : U1 - U0, ...((p) => [p[0], y - rise / N / 2, p[1]])(P2((U0 + U1) / 2, v - V / N)), '#5e3b22', { tile: -1, jit: 0.04 });   // alzata
      }
      // cosciali e corrimano
      for (const u of [U0 + 0.06, U1 - 0.06]) { const a = P2(u, -V), b = P2(u, V); add(rod(a[0], topY + 0.1, a[1], b[0], A.WALL_H - 0.05, b[1], 0.07, 4), '#5a3a20', { tile: -1, jit: 0.03 }); }
      for (let k = 0; k <= 4; k++) { const v = -V + k * (2 * V / 4), y = topY + (k / 4) * rise, [x, z] = P2(U0 + 0.05, v); add(rod(x, y, z, x, y + 1.05, z, 0.045, 5), '#5a3a20', { tile: -1, jit: 0.03 }); }
      { const a = P2(U0 + 0.05, -V), b = P2(U0 + 0.05, V); add(rod(a[0], topY + 1.05, a[1], b[0], A.WALL_H + 1.05, b[1], 0.04, 5), '#6e4526', { tile: -1, jit: 0.03 }); }
      // pianerottolo in cima (fino al muro) con travi di sostegno
      { const [x, z] = P2((U0 + A.RW0 + 0.6) / 2, V + LAND / 2), wu = A.RW0 + 0.6 - U0;
        box(ax ? wu : LAND, 0.25, ax ? LAND : wu, x, A.WALL_H - 0.125, z, '#7d5230', { tile: -1, jit: 0.04 });
        for (const u of [U0 + 0.15, U1]) { const [bx2, bz2] = P2(u, V + LAND / 2); add(rod(bx2, topY, bz2, bx2, A.WALL_H - 0.25, bz2, 0.09, 5), '#5a3a20', { tile: -1, jit: 0.03 }); } }
      // collisori: rampa (si cammina sopra, i proiettili la colpiscono) e pianerottolo
      const [ax0, az0] = P2(U0, -V), [ax1, az1] = P2(U1, V);
      const dir = ax ? (sgn > 0 ? 'z+' : 'z-') : (sgn > 0 ? 'x-' : 'x+');
      colliders.push({ type: 'ramp', minX: cx + Math.min(ax0, ax1), maxX: cx + Math.max(ax0, ax1), minZ: cz + Math.min(az0, az1), maxZ: cz + Math.max(az0, az1), minY: cy + topY, maxY: cy + A.WALL_H, dir, surf: 'wood', arena: true });
      const [lx0, lz0] = P2(U0, V), [lx1, lz1] = P2(A.RW0 + 0.6, V + LAND);
      colliders.push({ type: 'box', minX: cx + Math.min(lx0, lx1), maxX: cx + Math.max(lx0, lx1), minZ: cz + Math.min(lz0, lz1), maxZ: cz + Math.max(lz0, lz1), minY: cy + A.WALL_H - 0.25, maxY: cy + A.WALL_H, surf: 'wood', arena: true });
    }
  }
  // ── muro esterno: arcate su due ordini, attico, cornici; i varchi passano sotto ──
  for (const [gA, gB] of spans) add(sectorBlock(A.RW0, A.RW1, 0, A.GATE_H, gA, gB, w, 30, { outer: true, top: false, innerY0: 0 }), '#d6c09a');
  add(sectorBlock(A.RW0, A.RW1, A.GATE_H, A.WALL_H, 0, Math.PI * 2, 0, 120, { outer: true, inner: true, top: true, caps: false, innerY0: topY - 0.2 }), '#d6c09a');
  add(sectorBlock(A.RW0, A.RW1, A.GATE_H - 0.02, A.GATE_H, 0, Math.PI * 2, 0, 120, { top: false, inner: false, outer: false, caps: false }), '#d6c09a');
  // soffitto dei passaggi sotto l'arco
  for (const [ax, az] of GATES) box(ax ? A.RW1 - A.RW0 + 0.4 : w * 2 + 0.2, 0.2, az ? A.RW1 - A.RW0 + 0.4 : w * 2 + 0.2, ax * (A.RW0 + A.RW1) / 2, A.GATE_H - 0.1, az * (A.RW0 + A.RW1) / 2, '#cbb38c');
  colliders.push({ type: 'ring', x: cx, z: cz, r0: A.RW0, r1: A.RW1, minY: cy - 1, maxY: cy + A.GATE_H, gates: gatesW, arena: true });
  colliders.push({ type: 'ring', x: cx, z: cz, r0: A.RW0, r1: A.RW1, minY: cy + A.GATE_H, maxY: cy + A.WALL_H, gates: [], arena: true });
  gateWalls(A.RW0, A.RW1, -1, A.GATE_H, 0.5);
  // cornici marcapiano
  for (const [y, h, out] of [[7.0, 0.8, 0.5], [14.6, 0.7, 0.45], [18.4, 0.35, 0.3], [21.6, 0.6, 0.6]]) add(sectorBlock(A.RW1 - 0.02, A.RW1 + out, y, y + h, 0, Math.PI * 2, 0, 120, { outer: true, caps: false, inner: false }), '#e4d3b0');
  // arcate: archi scuri (vuoti) tra semicolonne, 60 campate (il varco cade al centro di una campata)
  const NB = 60, DKA = '#2b2219', archShape = (wA, hA) => { const s = new THREE.Shape(); s.moveTo(-wA / 2, 0); s.lineTo(wA / 2, 0); s.lineTo(wA / 2, hA - wA / 2); s.absarc(0, hA - wA / 2, wA / 2, 0, Math.PI, false); s.lineTo(-wA / 2, 0); return s; };
  const arch1 = new THREE.ShapeGeometry(archShape(3.3, 5.6), 5), arch2 = new THREE.ShapeGeometry(archShape(3.3, 5.4), 5), win3 = new THREE.ShapeGeometry(archShape(1.3, 1.6), 1);
  for (let k = 0; k < NB; k++) {
    const a = k / NB * Math.PI * 2, gate = k % 15 === 0, r = A.RW1 + 0.03, ry = Math.PI / 2 - a;
    const at = (rr) => ({ x: Math.cos(a) * rr, z: Math.sin(a) * rr });
    const p1 = at(r);
    if (!gate) add(arch1.clone(), DKA, { tile: -1, jit: 0, x: p1.x, y: 0.7, z: p1.z, ry });
    add(arch2.clone(), DKA, { tile: -1, jit: 0, x: p1.x, y: 8.4, z: p1.z, ry });
    if (k % 2 === 0) add(win3.clone(), DKA, { tile: -1, jit: 0, x: p1.x, y: 16.2, z: p1.z, ry });
    // ghiera dell'arco
    const ring = new THREE.TorusGeometry(1.75, 0.16, 3, 10, Math.PI);
    if (!gate) add(ring.clone(), '#e8d8b6', { ...TR, x: p1.x, y: 0.7 + 5.6 - 1.65, z: p1.z, ry });
    else add(new THREE.TorusGeometry(w + 0.2, 0.22, 3, 12, Math.PI), '#e8d8b6', { ...TR, x: Math.cos(a) * (r + 0.05), y: A.GATE_H - w - 0.4, z: Math.sin(a) * (r + 0.05), ry });
    add(ring, '#e8d8b6', { ...TR, x: p1.x, y: 8.4 + 5.4 - 1.65, z: p1.z, ry });
    // semicolonne fra le campate
    const ab = (k + 0.5) / NB * Math.PI * 2, rc = A.RW1 + 0.12;
    for (const [y0, h] of [[0.2, 6.8], [7.8, 6.8]]) {
      cyl(0.36, 0.4, h - 0.6, 8, Math.cos(ab) * rc, y0 + 0.3 + (h - 0.6) / 2, Math.sin(ab) * rc, '#eadcbf');
      box(1.0, 0.3, 1.0, Math.cos(ab) * rc, y0 + h - 0.15, Math.sin(ab) * rc, '#eadcbf', { ...TR, ry: Math.PI / 2 - ab });
      box(0.9, 0.3, 0.9, Math.cos(ab) * rc, y0 + 0.15, Math.sin(ab) * rc, '#eadcbf', { ...TR, ry: Math.PI / 2 - ab });
    }
    box(0.7, 6.0, 0.25, Math.cos(ab) * (A.RW1 + 0.1), 15.0 + 3.3, Math.sin(ab) * (A.RW1 + 0.1), '#eadcbf', { ...TR, ry: Math.PI / 2 - ab });   // lesene dell'attico
  }
  // ── galleria superiore: colonnine sulla cima delle gradinate ──
  for (let k = 0; k < NB; k++) {
    if (k % 15 === 0) continue;
    const a = k / NB * Math.PI * 2, r = A.RW0 - 0.45, x = Math.cos(a) * r, z = Math.sin(a) * r;
    cyl(0.24, 0.28, 4.6, 7, x, topY + 2.3, z, '#efe2c6');
    box(0.7, 0.25, 0.7, x, topY + 4.7, z, '#efe2c6', { ...TR, ry: Math.PI / 2 - a });
    colliders.push({ type: 'cyl', x: cx + x, z: cz + z, r: 0.3, minY: cy + topY, maxY: cy + topY + 4.8, noStand: true, arena: true });
  }
  add(sectorBlock(A.RW0 - 0.8, A.RW0, topY + 4.8, topY + 5.3, 0, Math.PI * 2, 0, 120, { inner: true, outer: true, caps: false }), '#e4d3b0');
  // ── velario: pennoni sul muro e teli a strisce rosse e crema inclinati verso l'interno ──
  const NP = 30;
  for (let k = 0; k < NP; k++) {
    const a = (k + 0.5) / NP * Math.PI * 2, rp = A.RW0 + 1.5, x = Math.cos(a) * rp, z = Math.sin(a) * rp;
    add(rod(x, A.WALL_H, z, x, A.WALL_H + 5.5, z, 0.2, 6), '#6a4a30', { tile: -1, jit: 0.04 });
    // telo: 6 strisce, bordo esterno alto sul muro, bordo interno più basso sopra le gradinate
    const a0 = a + 0.012, a1 = a + Math.PI * 2 / NP - 0.012, ro = A.RW0 + 1.2, ri = A.RW0 - 8.5, yo = A.WALL_H + 4.8, yi = A.WALL_H - 0.8;
    const T = [new TriBuf(), new TriBuf()];
    const NS = 6, NR = 3;
    for (let s = 0; s < NS; s++) for (let q = 0; q < NR; q++) {
      const P4 = [[s, q], [s + 1, q], [s + 1, q + 1], [s, q + 1]].map(([ss, qq]) => {
        const aa = a0 + (a1 - a0) * ss / NS, t = qq / NR, rr = ro + (ri - ro) * t, sag = Math.sin(t * Math.PI) * 0.6 + Math.sin(ss / NS * Math.PI) * 0.25;
        return [Math.cos(aa) * rr, yo + (yi - yo) * t - sag, Math.sin(aa) * rr];
      });
      T[s % 2].quad(P4[0], P4[1], P4[2], P4[3], [0, 1, 0]);
      T[s % 2].quad(P4[0], P4[3], P4[2], P4[1], [0, -1, 0]);
    }
    add(T[0].geo(), '#b8261c', { tile: -1, jit: 0.03 }); add(T[1].geo(), '#f1e4c8', { tile: -1, jit: 0.03 });
    // telaio: traversa interna rossa e funi
    const ci = (aa) => [Math.cos(aa) * ri, yi - 0.05, Math.sin(aa) * ri];
    const c0 = ci(a0), c1 = ci(a1);
    add(rod(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], 0.12, 5), '#7a1a12', { tile: -1, jit: 0 });
    add(rod(x, A.WALL_H + 5.4, z, (c0[0] + c1[0]) / 2, yi, (c0[2] + c1[2]) / 2, 0.03, 3), '#5a4632', { tile: -1, jit: 0 });
  }
  // ── colonne libere sulla sabbia (riparo), due spezzate ──
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + k * Math.PI / 3, r = 22, x = Math.cos(a) * r, z = Math.sin(a) * r, h = k === 1 ? 4.2 : k === 4 ? 6.0 : 8.4;
    box(1.7, 0.7, 1.7, x, 0.35, z, '#e2d2b2');
    cyl(0.55, 0.6, h - 1.4, 12, x, 0.7 + (h - 1.4) / 2, z, '#f0e6d0', { ...TR, ts: 1.4, jit: 0.06 });
    if (h > 8) { cyl(0.85, 0.58, 0.55, 10, x, h - 0.4, z, '#f4ead6'); box(1.9, 0.3, 1.9, x, h - 0.0, z, '#f4ead6'); }
    else box(1.25, 0.25, 1.25, x + 0.05, h - 0.65, z, '#e8dcc4', { ...TR, rz: 0.12 });
    colliders.push({ type: 'cyl', x: cx + x, z: cz + z, r: 0.85, minY: cy - 1, maxY: cy + 0.7, arena: true });
    colliders.push({ type: 'cyl', x: cx + x, z: cz + z, r: 0.62, minY: cy, maxY: cy + (h > 8 ? h + 0.15 : h - 0.55), noStand: h > 8, arena: true });
    if (h < 8) loot.push(W(x, h - 0.5, z));
    // detriti
    for (let q = 0; q < 2; q++) box(0.7 + rnd() * 0.6, 0.35, 0.5 + rnd() * 0.4, x + (rnd() - 0.5) * 4, 0.12, z + (rnd() - 0.5) * 4, '#d8c8a8', { ...TR, ry: rnd() * 3, rx: (rnd() - 0.5) * 0.3 });
  }
  // ── la statua dell'imperatore al centro (indica il cielo) ──
  box(5.0, 0.5, 5.0, 0, 0.25, 0, '#d8c7a6');
  box(3.9, 2.2, 3.9, 0, 1.6, 0, '#ffffff', { ...MB, ts: 3 });
  box(4.4, 0.35, 4.4, 0, 2.85, 0, '#efe8dc', { ...MB, ts: 3 });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; box(2.2, 0.7, 0.06, Math.sin(a) * 1.96, 1.65, Math.cos(a) * 1.96, '#c6a04a', { tile: -1, jit: 0, ry: a }); }   // targhe dorate
  statueParts(parts, '#f7f4ee', 3, new THREE.Matrix4().compose(new THREE.Vector3(0, 3.02, 0), new THREE.Quaternion().setFromAxisAngle(_up, Math.PI / 2), new THREE.Vector3(4.6, 4.6, 4.6)), 'point', 0.42);
  colliders.push({ type: 'box', minX: cx - 2.5, maxX: cx + 2.5, minY: cy - 1, maxY: cy + 0.5, minZ: cz - 2.5, maxZ: cz + 2.5, arena: true });
  colliders.push({ type: 'box', minX: cx - 2.2, maxX: cx + 2.2, minY: cy, maxY: cy + 3.02, minZ: cz - 2.2, maxZ: cz + 2.2, arena: true });
  colliders.push({ type: 'cyl', x: cx, z: cz, r: 1.25, minY: cy + 3.0, maxY: cy + 11.5, noStand: true, arena: true });
  loot.push(W(0, 3.1, 1.6), W(3.4, 0.1, 0), W(-3.4, 0.1, 0), W(0, 0.1, -3.4));
  for (const [ax, az] of GATES) loot.push(W(ax * 41 + az * 1.2, 0.1, az * 41 + ax * 1.2));
  loot.push(W(Math.cos(0.4) * 51.5, A.WALL_H + 0.1, Math.sin(0.4) * 51.5), W(Math.cos(3.6) * 51.5, A.WALL_H + 0.1, Math.sin(3.6) * 51.5));
  chests.push({ pos: W(Math.cos(Math.PI / 6 + 0.25) * 24.5, 0.06, Math.sin(Math.PI / 6 + 0.25) * 24.5), rot: 0.7 });
  chests.push({ pos: W(Math.cos(Math.PI * 7 / 6 + 0.25) * 24.5, 0.06, Math.sin(Math.PI * 7 / 6 + 0.25) * 24.5), rot: 3.8 });
  chests.push({ pos: W(Math.cos(Math.PI / 4 + 0.1) * (A.POD + A.TW * 7.5), topY + 0.02, Math.sin(Math.PI / 4 + 0.1) * (A.POD + A.TW * 7.5)), rot: Math.PI / 4 + 0.1 + Math.PI / 2 });   // v42: accanto alla scalinata
  const geo = mergeParts(parts, 3803);
  geo.userData.monument = true;
  return { geo, colliders, loot, chests };
}
