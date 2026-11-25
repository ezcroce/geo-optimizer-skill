// ─────────────────────────────────────────────────────────────
//  Auto realistiche (v25)
//  Carrozzeria modellata come superficie continua (sezioni trasversali lungo la vettura, con cofano,
//  parabrezza, tetto, lunotto, passaruota e fiancate bombate), vernice metallizzata con trasparente
//  lucido che riflette il cielo, vetri a specchio, gomme con spalla e cerchi in lega, fari, fanali,
//  griglia, maniglie, specchietti e targhe italiane. Tre carrozzerie: berlina, utilitaria, SUV.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { normalFromHeight, NORMALS } from './texgen.js?v=19';

// colori di serie (metallizzati e pastello)
export const CAR_PAINTS = ['#8f1a1a', '#1e3f73', '#e9e9e6', '#121316', '#9da3a8', '#5d6266', '#2f4a3a', '#c7b48f', '#1d6f8a', '#b8b9b4', '#6a1f2e', '#d9a21b'];

// keyframe [z, y]: z da coda (-L/2) a muso (+L/2)
const VARIANTS = [
  { // berlina
    name: 'berlina', L: 4.45, W: 1.82, wr: 0.68, roof: 1.43, R: 0.33, tw: 0.23, axF: 1.36, axR: -1.33, yb: 0.25,
    top: [[-2.225, 0.6], [-2.17, 0.88], [-2.0, 0.99], [-1.3, 1.03], [-1.08, 1.12], [-0.55, 1.4], [-0.3, 1.43], [0.3, 1.43], [0.55, 1.36], [1.12, 0.97], [1.6, 0.9], [2.1, 0.8], [2.2, 0.7], [2.225, 0.52]],
    belt: [[-2.225, 0.6], [-2.1, 0.86], [-1.2, 0.98], [0.9, 0.93], [1.6, 0.86], [2.1, 0.76], [2.225, 0.5]],
    bot: [[-2.225, 0.42], [-2.05, 0.3], [2.0, 0.3], [2.225, 0.38]], pillarB: -0.12, pillarC: -0.98,
  },
  { // utilitaria (due volumi)
    name: 'utilitaria', L: 3.95, W: 1.74, wr: 0.66, roof: 1.5, R: 0.31, tw: 0.21, axF: 1.22, axR: -1.2, yb: 0.24,
    top: [[-1.975, 0.62], [-1.95, 0.95], [-1.88, 1.18], [-1.7, 1.44], [-1.45, 1.5], [0.25, 1.5], [0.5, 1.44], [1.02, 1.0], [1.5, 0.88], [1.88, 0.76], [1.96, 0.62], [1.975, 0.5]],
    belt: [[-1.975, 0.6], [-1.9, 0.95], [-1.4, 1.0], [0.9, 0.92], [1.5, 0.84], [1.9, 0.72], [1.975, 0.48]],
    bot: [[-1.975, 0.42], [-1.85, 0.3], [1.8, 0.3], [1.975, 0.38]], pillarB: -0.2, pillarC: -1.5,
  },
  { // SUV
    name: 'suv', L: 4.62, W: 1.92, wr: 0.76, roof: 1.74, R: 0.38, tw: 0.26, axF: 1.42, axR: -1.38, yb: 0.36,
    top: [[-2.31, 0.75], [-2.29, 1.05], [-2.22, 1.32], [-2.08, 1.68], [-1.85, 1.74], [0.3, 1.74], [0.55, 1.68], [1.1, 1.22], [1.7, 1.12], [2.18, 1.02], [2.28, 0.9], [2.31, 0.66]],
    belt: [[-2.31, 0.72], [-2.22, 1.12], [-1.5, 1.2], [0.9, 1.14], [1.7, 1.06], [2.2, 0.96], [2.31, 0.64]],
    bot: [[-2.31, 0.55], [-2.1, 0.42], [2.05, 0.42], [2.31, 0.52]], pillarB: -0.16, pillarC: -1.25,
  },
];
export const CAR_VARIANTS = VARIANTS.length;
export const CAR_DIMS = VARIANTS.map(v => ({ hx: v.W / 2 + 0.06, hz: v.L / 2 + 0.02, h: v.roof + 0.02 }));

/** Catmull-Rom sui keyframe (z crescente) */
function curve(keys) {
  return (z) => {
    if (z <= keys[0][0]) return keys[0][1];
    const n = keys.length;
    if (z >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (z > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
    const t = (z - p1[0]) / (p2[0] - p1[0]);
    // tangenti scalate sull'intervallo (curve non uniformi)
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * (p2[0] - p1[0]);
    const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * (p2[0] - p1[0]);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

const MAT = { PAINT: 0, GLASS: 1, BLACK: 2, CHROME: 3, TYRE: 4, HEAD: 5, TAIL: 6, PLATE: 7, RIM: 8 };

/** costruisce la carrozzeria di una variante: { paint: geometria verniciata, parts: geometria multi-materiale } */
function buildVariant(v) {
  const top = curve(v.top), belt0 = curve(v.belt), bot0 = curve(v.bot);
  const hl = v.L / 2, hw = v.W / 2;
  const PF = 3.0, PR = 3.4;                           // forma in pianta del muso / della coda (superellisse)
  const halfW = (z) => { const zn = Math.min(1, Math.abs(z) / hl), p = z > 0 ? PF : PR; return hw * Math.pow(Math.max(0, 1 - Math.pow(zn, p)), 1 / p); };
  const arch = (z) => {
    let y = 0;
    for (const az of [v.axF, v.axR]) { const d = Math.abs(z - az), ra = v.R + 0.1; if (d < ra) y = Math.max(y, v.R + 0.02 + Math.sqrt(ra * ra - d * d) * 0.98 - 0.02); }
    return y;
  };
  const bot = (z) => Math.max(bot0(z), arch(z));
  const belt = (z) => Math.min(belt0(z), top(z) - 0.025);
  const cab = (z) => THREE.MathUtils.clamp((top(z) - belt(z) - 0.06) / (v.roof - 1.0 - 0.06 - (v.name === 'suv' ? 0.18 : 0)), 0, 1);
  // stazioni più fitte alle estremità
  const NS = 44, zs = [];
  for (let i = 0; i < NS; i++) { const t = i / (NS - 1); zs.push(-hl * 0.997 + (Math.sin((t - 0.5) * Math.PI) * 0.5 + 0.5 + (t * 2 - 1) * 0) * hl * 1.994); }
  const sect = (z) => {
    const w = halfW(z), yb = bot(z), yl = belt(z), yt = top(z), c = cab(z);
    const H = Math.max(0.05, yl - yb), h = yt - yl;
    const wt = THREE.MathUtils.lerp(w * 0.9, Math.min(v.wr, w * 0.9), c);
    const re = Math.min(0.07, h * 0.35), crown = 0.015 + 0.012 * c;
    const ux = w * 0.94 - 0.03 * c;
    const pts = [
      [0, yb], [w * 0.8, yb], [w * 0.95, yb + 0.03], [w * 0.993, yb + 0.12 * H + 0.03], [w, yb + 0.55 * H], [w * 0.988, yb + 0.86 * H], [w * 0.955, yl],
      [ux, yl + Math.min(0.012, h * 0.3)], [THREE.MathUtils.lerp(ux, wt, 0.5) + 0.012 * c, yl + (h - re) * 0.5], [wt, yt - re], [wt - re * 0.85, yt - re * 0.12], [wt * 0.55, yt + crown * 0.8], [0, yt + crown],
    ];
    return pts;
  };
  const S = zs.map(z => sect(z));
  const NP = S[0].length;                         // punti per metà sezione
  const ring = (pts) => { const r = []; for (let k = 0; k < NP; k++) r.push(pts[k]); for (let k = NP - 2; k >= 1; k--) r.push([-pts[k][0], pts[k][1]]); return r; };   // anello chiuso: destra poi sinistra (x>0 è la destra se il muso guarda +z... indifferente)
  const R = S.map(ring), RN = R[0].length;
  const pos = [], idx = [], tcls = [];
  zs.forEach((z, i) => { for (const [x, y] of R[i]) pos.push(x, y, z); });
  const hk = (k) => (k < NP ? k : 2 * NP - 2 - k);
  for (let i = 0; i < NS - 1; i++) {
    const zm = (zs[i] + zs[i + 1]) / 2, c = cab(zm), roofSt = top(zm) >= v.roof - 0.05;
    for (let k = 0; k < RN; k++) {
      const a = i * RN + k, b = i * RN + (k + 1) % RN, c2 = (i + 1) * RN + k, d = (i + 1) * RN + (k + 1) % RN;
      idx.push(a, c2, b, b, c2, d);
      // classe del quadrilatero secondo il tratto di sezione (bordi dei vetri dritti, niente dentelli)
      const j = Math.min(hk(k), hk((k + 1) % RN));
      let cls = 'paint';
      if (j <= 1) cls = 'black';
      else if (c > 0.3) {
        if (j === 6) cls = c > 0.6 ? 'black' : 'paint';
        else if ((j === 7 || j === 8) && c > 0.6) {
          cls = 'glass';
          if (Math.abs(zm - v.pillarB) < 0.07) cls = 'black';
          else if (Math.abs(zm - v.pillarC) < 0.11) cls = 'paint';
        } else if (j >= 10 && !roofSt && c > 0.55) cls = 'glass';
      }
      tcls.push(cls, cls);
    }
  }
  // tappi alle estremità (ventaglio dal centro)
  for (const [i, s] of [[0, -1], [NS - 1, 1]]) {
    const cx = 0, cy = R[i].reduce((a, p) => a + p[1], 0) / RN;
    const ci = pos.length / 3; pos.push(cx, cy, zs[i] + s * 0.004);
    for (let k = 0; k < RN; k++) { const a = i * RN + k, b = i * RN + (k + 1) % RN; if (s > 0) idx.push(ci, a, b); else idx.push(ci, b, a); tcls.push('paint'); }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // verso dei triangoli: le normali devono puntare fuori (controllo sul fianco destro)
  {
    const n = g.attributes.normal, p = g.attributes.position;
    const k = 4; if (n.getX(k) * p.getX(k) < 0) { const ix = g.index.array; for (let t = 0; t < ix.length; t += 3) { const s2 = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s2; } g.computeVertexNormals(); }
    // tappi: la normale del centro deve guardare avanti (muso) / indietro (coda)
    const ix = g.index.array, capStart = (NS - 1) * RN * 6;
    for (const [c0, sgn] of [[capStart, -1], [capStart + RN * 3, 1]]) {
      const ci = ix[c0];
      if (g.attributes.normal.getZ(ci) * sgn < 0) for (let t = c0; t < c0 + RN * 3; t += 3) { const s2 = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s2; }
    }
    g.computeVertexNormals();
  }
  g = g.toNonIndexed();
  // ── classificazione dei triangoli: vernice / vetro / plastica nera ──
  const P = g.attributes.position, N = g.attributes.normal;
  const tris = { paint: [], glass: [], black: [] };
  const fn = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let t = 0; t < P.count; t += 3) tris[tcls[t / 3]].push(t);
  // ── uv in metri: fianchi proiettati su (z, y), muso e coda su (x, y), resto su un'area neutra ──
  const UVW = v.L + 0.2;
  const sub = (list, uvFn) => {
    const p = [], n = [], u = [];
    for (const t of list) {
      A.fromBufferAttribute(P, t); B.fromBufferAttribute(P, t + 1); C.fromBufferAttribute(P, t + 2);
      fn.subVectors(C, B).cross(A.clone().sub(B)).normalize();
      for (let k = 0; k < 3; k++) {
        p.push(P.getX(t + k), P.getY(t + k), P.getZ(t + k));
        n.push(N.getX(t + k), N.getY(t + k), N.getZ(t + k));
        if (uvFn) u.push(...uvFn(P.getX(t + k), P.getY(t + k), P.getZ(t + k), fn));
      }
    }
    return { p, n, u };
  };
  const uvPaint = (x, y, z, f) => {
    if (Math.abs(f.x) > 0.55 && Math.abs(f.z) < 0.75) return [(z + UVW / 2) / UVW, 0.5 + y / 2.0 * 0.5];          // fianco
    if (f.z > 0.45) return [0.25 + x / 2.2 * 0.5, y / 2.0 * 0.5];                                                    // muso
    if (f.z < -0.45) return [0.75 - x / 2.2 * 0.5, y / 2.0 * 0.5];                                                   // coda
    return [0.02, 0.98];                                                                                              // cofano, tetto: tinta piena
  };
  const body = sub(tris.paint, uvPaint);
  // specchietti (verniciati)
  const mirrorParts = [];
  {
    const zA = v.top.find(k => k[0] > 0.6 && k[1] < v.roof - 0.25)?.[0] ?? 1.0;
    const zM = zA - 0.12, yM = belt(zM) + 0.09, wM = THREE.MathUtils.lerp(halfW(zM) * 0.9, v.wr, cab(zM));
    for (const s of [-1, 1]) {
      const m = new THREE.SphereGeometry(1, 10, 6);
      m.scale(0.1, 0.075, 0.12); m.translate(s * (wM + 0.13), yM, zM);
      mirrorParts.push(m);
      const arm = new THREE.BoxGeometry(0.12, 0.03, 0.05); arm.translate(s * (wM + 0.05), yM - 0.02, zM);
      mirrorParts.push({ black: arm });
      const glass = new THREE.CircleGeometry(1, 10); glass.scale(0.075, 0.055, 1); glass.rotateY(Math.PI); glass.translate(s * (wM + 0.13), yM, zM - 0.118);
      mirrorParts.push({ glass });
    }
  }
  const pushGeo = (acc, geo, uvConst) => {
    if (!geo.attributes.normal || geo.userData.recalc) geo.computeVertexNormals();
    const gg = geo.index ? geo.toNonIndexed() : geo;
    const p = gg.attributes.position, n = gg.attributes.normal, u = gg.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      acc.p.push(p.getX(i), p.getY(i), p.getZ(i)); acc.n.push(n.getX(i), n.getY(i), n.getZ(i));
      if (acc.u) { if (uvConst) acc.u.push(...uvConst); else acc.u.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    }
  };
  for (const m of mirrorParts) if (m.isBufferGeometry) pushGeo(body, m, [0.02, 0.98]);
  const paintGeo = new THREE.BufferGeometry();
  paintGeo.setAttribute('position', new THREE.Float32BufferAttribute(body.p, 3));
  paintGeo.setAttribute('normal', new THREE.Float32BufferAttribute(body.n, 3));
  paintGeo.setAttribute('uv', new THREE.Float32BufferAttribute(body.u, 2));
  paintGeo.computeBoundingSphere();

  // ── parti non verniciate (un'unica geometria a gruppi di materiali) ──
  const groups = new Map();   // mat -> {p,n,u}
  const G = (mat) => { if (!groups.has(mat)) groups.set(mat, { p: [], n: [], u: [] }); return groups.get(mat); };
  const glassSub = sub(tris.glass, (x, y, z) => [x * 0.5, y * 0.5]);
  Object.assign(G(MAT.GLASS), { p: glassSub.p, n: glassSub.n, u: glassSub.u });
  const blackSub = sub(tris.black, (x, y, z) => [z * 0.5, y * 0.5]);
  Object.assign(G(MAT.BLACK), { p: blackSub.p, n: blackSub.n, u: blackSub.u });
  for (const m of mirrorParts) if (!m.isBufferGeometry) { if (m.black) pushGeo(G(MAT.BLACK), m.black); if (m.glass) pushGeo(G(MAT.CHROME), m.glass); }
  // ruote: pneumatico con spalla arrotondata, cerchio in lega a 5 razze, disco freno
  const tyreProf = [];
  {
    const r = v.R, ri = r * 0.68, tw = v.tw;
    const prof = [[ri, -tw * 0.42], [r * 0.9, -tw * 0.5], [r * 0.97, -tw * 0.46], [r, -tw * 0.3], [r, tw * 0.3], [r * 0.97, tw * 0.46], [r * 0.9, tw * 0.5], [ri, tw * 0.42]];
    for (const [a, b] of prof) tyreProf.push(new THREE.Vector2(a, b));
  }
  for (const az of [v.axF, v.axR]) for (const s of [-1, 1]) {
    const xw = s * (hw - v.tw * 0.5 - 0.035), yw = v.R;
    const tyre = new THREE.LatheGeometry(tyreProf, 20);
    tyre.rotateZ(Math.PI / 2); tyre.translate(xw, yw, az);
    pushGeo(G(MAT.TYRE), tyre);
    // cerchio: catino + razze
    const ri = v.R * 0.68;
    const dish = new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.02, 20, 1, true); dish.rotateZ(Math.PI / 2); dish.translate(xw + s * v.tw * 0.36, yw, az);
    pushGeo(G(MAT.RIM), dish);
    const hub = new THREE.CylinderGeometry(ri * 0.22, ri * 0.26, 0.05, 10); hub.rotateZ(Math.PI / 2); hub.translate(xw + s * v.tw * 0.4, yw, az);
    pushGeo(G(MAT.RIM), hub);
    const back = new THREE.CircleGeometry(ri * 0.98, 16); back.rotateY(s * Math.PI / 2); back.translate(xw + s * v.tw * 0.18, yw, az);
    pushGeo(G(MAT.BLACK), back);
    const disc = new THREE.CircleGeometry(ri * 0.72, 14); disc.rotateY(s * Math.PI / 2); disc.translate(xw + s * v.tw * 0.24, yw, az);
    pushGeo(G(MAT.BLACK), disc);
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.BoxGeometry(0.035, ri * 0.82, 0.075);
      sp.translate(0, ri * 0.5, 0); sp.rotateX(k * Math.PI * 2 / 5 + (az > 0 ? 0.3 : 0)); sp.translate(xw + s * v.tw * 0.36, yw, az);
      pushGeo(G(MAT.RIM), sp);
    }
  }
  // fari anteriori, fanali posteriori, terza luce, targhe
  const zAtX = (x, front) => { const fr = Math.min(0.999, Math.abs(x) / hw), p = front ? PF : PR; return (front ? 1 : -1) * hl * Math.pow(1 - Math.pow(fr, p), 1 / p); };
  const lamp = (mat, x, y, z, sx, sy, sz, ry) => {
    const l = new THREE.SphereGeometry(1, 14, 8); l.scale(sx, sy, sz); l.rotateY(ry); l.translate(x, y, z);
    pushGeo(G(mat), l);
  };
  {
    const zf = hl * 0.9, yH = (belt(zf) + top(zf)) / 2 - 0.035;
    for (const s of [-1, 1]) {
      const xh = hw * 0.62, z = zAtX(xh, true) - 0.06;
      const slope = Math.atan2(zAtX(xh + 0.05, true) - zAtX(xh - 0.05, true), 0.1);
      lamp(MAT.HEAD, s * xh, yH, z - 0.035, 0.25, 0.055, 0.1, -s * slope * 0.9);
      // fendinebbia
      lamp(MAT.HEAD, s * hw * 0.6, bot(hl * 0.92) + 0.1, zAtX(hw * 0.6, true) - 0.04, 0.06, 0.03, 0.04, 0);
      const zr = zAtX(xh, false) + 0.075, yR = belt(-hl * 0.95) - 0.06;
      lamp(MAT.TAIL, s * hw * 0.66, yR, zr, 0.23, 0.055, 0.085, s * slope * 0.9);
    }
    // griglia: listelli scuri con cornice cromata sul muso
    const zg = zAtX(0.36, true) - 0.015, yg = bot(hl * 0.95) + 0.17;
    const grille = new THREE.BoxGeometry(0.78, 0.17, 0.05); grille.translate(0, yg, zg);
    pushGeo(G(MAT.BLACK), grille);
    const frame = new THREE.BoxGeometry(0.82, 0.02, 0.055); frame.translate(0, yg + 0.095, zg + 0.004); pushGeo(G(MAT.CHROME), frame);
    // targhe (davanti più in basso, dietro sul portellone)
    const plate = (z, y, s) => { const pl = new THREE.PlaneGeometry(0.52, 0.115); if (s < 0) pl.rotateY(Math.PI); pl.translate(0, y, z); pushGeo(G(MAT.PLATE), pl); };
    plate(zAtX(0.27, true) + 0.04, bot(hl * 0.96) + 0.06, 1);
    plate(zAtX(0.27, false) - 0.035, belt(-hl * 0.96) - 0.2, -1);
    // maniglie cromate
    for (const s of [-1, 1]) for (const zh of [v.pillarB + 0.62, v.pillarB - 0.28]) {
      const yh = belt(zh) - 0.09, xx = halfW(zh) * 0.985 + 0.004;
      const hnd = new THREE.BoxGeometry(0.02, 0.028, 0.16); hnd.translate(s * xx, yh, zh); pushGeo(G(MAT.CHROME), hnd);
    }
  }
  // assemblaggio a gruppi
  const parts = new THREE.BufferGeometry();
  const ap = [], an = [], au = [];
  let off = 0;
  for (const [mat, d] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const cnt = d.p.length / 3;
    ap.push(...d.p); an.push(...d.n);
    for (let i = 0; i < cnt; i++) au.push(d.u[i * 2] || 0, d.u[i * 2 + 1] || 0);
    parts.addGroup(off, cnt, mat);
    off += cnt;
  }
  parts.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
  parts.setAttribute('normal', new THREE.Float32BufferAttribute(an, 3));
  parts.setAttribute('uv', new THREE.Float32BufferAttribute(au, 2));
  parts.computeBoundingSphere();
  paintGeo.userData.shared = parts.userData.shared = true;
  return { paint: paintGeo, parts, v, belt, top, bot, halfW, UVW };
}

// ── texture della vernice: linee delle portiere, sportello carburante, muso con prese d'aria, coda ──
function paintTexture(B) {
  const v = B.v, S = 1024, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  const UVW = B.UVW;
  // fianco: u = (z + UVW/2)/UVW, v = 0.5 + y/4  (in canvas y è capovolto)
  const sx = (z) => (z + UVW / 2) / UVW * S, sy = (y) => S - (0.5 + y / 4) * S;
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2.2; g.lineCap = 'round';
  const seam = (pts) => { g.beginPath(); pts.forEach(([z, y], i) => (i ? g.lineTo(sx(z), sy(y)) : g.moveTo(sx(z), sy(y)))); g.stroke(); };
  const zB = v.pillarB, zFd = Math.min(v.axF - v.R - 0.14, zB + 1.05), zRd = v.name === 'utilitaria' ? null : Math.max(v.axR + v.R + 0.12, zB - 0.95);
  const yb = (z) => B.bot(z) + 0.07, yt = (z) => B.belt(z) + 0.002;
  seam([[zFd, yt(zFd)], [zFd + 0.03, yb(zFd) + 0.15], [zFd, yb(zFd)]]);
  seam([[zB, yt(zB)], [zB, yb(zB)]]);
  if (zRd !== null) seam([[zRd, yt(zRd)], [zRd - 0.06, yb(zRd) + 0.25], [zRd - 0.02, yb(zRd)]]);
  else seam([[zB - 0.95, yt(zB - 0.95)], [zB - 0.95, yb(zB - 0.95)]]);
  // linea del cofano/parafango e nervatura laterale
  g.lineWidth = 1.6; seam([[v.axF + v.R + 0.25, B.belt(v.axF) + 0.004], [zFd + 0.02, B.belt(zFd) + 0.004]]);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 5;
  seam([[-v.L / 2 + 0.2, B.belt(0) - 0.12], [v.L / 2 - 0.25, B.belt(0) - 0.15]]);
  // sottoporta più scuro
  { const gr = g.createLinearGradient(0, sy(0.75), 0, sy(0.2)); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(sx(-v.L / 2), sy(0));
    for (let z = -v.L / 2; z <= v.L / 2 + 0.01; z += 0.05) g.lineTo(sx(z), sy(B.bot(z) + 0.18));
    g.lineTo(sx(v.L / 2), sy(0)); g.closePath(); g.fill(); }
  // sportello carburante
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2;
  { const zf = v.axR + v.R + 0.22, yf = B.belt(zf) - 0.12; g.strokeRect(sx(zf) - 9, sy(yf) - 9, 18, 18); }
  // muso: u = 0.25 + x/4.4, v = y/4 ; coda: u = 0.75 - x/4.4
  const fx = (x) => (0.25 + x / 4.4) * S, rx = (x) => (0.75 - x / 4.4) * S, fy = (y) => S - (y / 4) * S;
  const yb0 = B.bot(v.L / 2 * 0.95);
  // presa d'aria inferiore e cornice
  g.fillStyle = '#1a1b1d';
  g.beginPath(); g.roundRect(fx(-0.62), fy(yb0 + 0.12), fx(0.62) - fx(-0.62), fy(yb0 + 0.02) - fy(yb0 + 0.12), 8); g.fill();
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx(-0.86), fy(yb0 + 0.26)); g.lineTo(fx(0.86), fy(yb0 + 0.26)); g.stroke();
  // coda: linea del portellone e diffusore
  const ybR = B.bot(-v.L / 2 * 0.95);
  g.fillStyle = '#1a1b1d'; g.beginPath(); g.roundRect(rx(0.7), fy(ybR + 0.1), rx(-0.7) - rx(0.7), fy(ybR) - fy(ybR + 0.1), 6); g.fill();
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2.2;
  const yTr = B.belt(-v.L / 2 * 0.9) - 0.32;
  g.beginPath(); g.moveTo(rx(0.62), fy(yTr)); g.lineTo(rx(-0.62), fy(yTr)); g.stroke();
  for (const sxx of [0.62, -0.62]) { g.beginPath(); g.moveTo(rx(sxx), fy(yTr)); g.lineTo(rx(sxx * 1.05), fy(B.top(-v.L / 2 * 0.9))); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const n = NORMALS ? normalFromHeight(cv, 1.4) : null;
  if (n) n.wrapS = n.wrapT = THREE.ClampToEdgeWrapping;
  return { map: t, normal: n };
}

function plateTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 512, 112);
  g.fillStyle = '#1c3f9e'; g.fillRect(0, 0, 50, 112); g.fillRect(462, 0, 50, 112);
  g.fillStyle = '#f2cf2a'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(25 + Math.cos(a) * 13, 34 + Math.sin(a) * 13, 2.4, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('I', 25, 96);
  g.fillStyle = '#121212'; g.font = 'bold 78px monospace'; g.fillText('AR 125 RY', 256, 84);
  g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(2, 2, 508, 108);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

let CACHE = null;
/** geometrie e materiali delle auto (creati una volta sola). env = mappa d'ambiente della scena */
export function carAssets(env = null) {
  if (CACHE) return CACHE;
  const variants = VARIANTS.map(buildVariant);
  const E = env ? { envMap: env } : {};
  const paintMats = variants.map(B => {
    const tx = paintTexture(B);
    return new THREE.MeshPhysicalMaterial({
      color: '#ffffff', map: tx.map, normalMap: tx.normal, normalScale: new THREE.Vector2(0.6, 0.6),
      metalness: 0.55, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.05, ...E,
    });
  });
  const mats = [];
  mats[MAT.GLASS] = new THREE.MeshPhysicalMaterial({ color: '#0b1218', metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, ...E });
  mats[MAT.BLACK] = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.62, metalness: 0.1, envMapIntensity: 0.4, ...E });
  mats[MAT.CHROME] = new THREE.MeshStandardMaterial({ color: '#d6dade', roughness: 0.16, metalness: 1, envMapIntensity: 1.4, ...E });
  mats[MAT.TYRE] = new THREE.MeshStandardMaterial({ color: '#19191b', roughness: 0.9, metalness: 0 });
  mats[MAT.HEAD] = new THREE.MeshPhysicalMaterial({ color: '#aeb8c2', roughness: 0.05, metalness: 0.85, clearcoat: 1, emissive: '#fff6e0', emissiveIntensity: 0.06, envMapIntensity: 1.6, ...E });
  mats[MAT.TAIL] = new THREE.MeshPhysicalMaterial({ color: '#7a0b0b', roughness: 0.12, metalness: 0.2, clearcoat: 1, emissive: '#5a0000', emissiveIntensity: 0.5, envMapIntensity: 1.2, ...E });
  mats[MAT.PAINT] = mats[MAT.BLACK];
  mats[MAT.PLATE] = new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.45, metalness: 0.1 });
  mats[MAT.RIM] = new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.28, metalness: 0.9, envMapIntensity: 1.2, ...E });
  CACHE = { variants, paintMats, mats };
  return CACHE;
}

/** n auto di una variante in un chunk: due InstancedMesh (carrozzeria verniciata a colori per istanza + dettagli) */
export function carInstances(variant, list, place, env, prep = (m) => m) {
  const A = carAssets(env);
  const B = A.variants[variant % A.variants.length];
  const body = new THREE.InstancedMesh(B.paint, prep(A.paintMats[variant % A.variants.length]), list.length);
  const det = new THREE.InstancedMesh(B.parts, A.mats.map(m => prep(m)), list.length);
  const col = new THREE.Color();
  list.forEach((s, i) => {
    const mtx = place(s, i);
    body.setMatrixAt(i, mtx); det.setMatrixAt(i, mtx);
    body.setColorAt(i, col.set(CAR_PAINTS[(s.paint ?? i) % CAR_PAINTS.length]));
  });
  body.instanceColor.needsUpdate = true;
  body.castShadow = true; body.receiveShadow = true;
  det.castShadow = false; det.receiveShadow = true;
  body.computeBoundingSphere(); det.computeBoundingSphere();
  return [body, det];
}
