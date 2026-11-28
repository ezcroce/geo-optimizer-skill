// ─────────────────────────────────────────────────────────────
//  Oggetti 3D low-poly semi-realistici (geometrie con colori per vertice)
//  01 albero · 02 catasta di legna · 03 pila di mattoni · 05 casetta · 06 barile
//  Se nella cartella models/ ci sono i file .glb originali, vengono usati quelli.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { normalFromHeight, NORMALS, photoTexture, photoMeanLinear, photosReady } from './texgen.js?v=52';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

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
  const pos = [], nor = [], col = [], uvs = [], tls = [];
  // v36: parti con texture (o.tile = riquadro dell'atlante, o.ts = metri per ripetizione): uv proiettate
  // dalla faccia nelle coordinate locali (prima di ruotare), così le tavole restano dritte anche sulle falde
  const anyTile = parts.some((pp) => pp.o.tile !== undefined);
  const n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3();
  for (const { geo, color, o } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    if (anyTile) {
      const P0 = g.attributes.position, tile = o.tile ?? -1, ts = o.ts || 1, u0 = rnd() * 7, v0 = rnd() * 7;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox, dim = [(bb.max.x - bb.min.x) * _s.x, (bb.max.y - bb.min.y) * _s.y, (bb.max.z - bb.min.z) * _s.z];
      const L = (i) => [P0.getX(i) * _s.x, P0.getY(i) * _s.y, P0.getZ(i) * _s.z];
      for (let i = 0; i < P0.count; i += 3) {
        const A = L(i), Bv = L(i + 1), Cv = L(i + 2);
        const e1 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], e2 = [Cv[0] - A[0], Cv[1] - A[1], Cv[2] - A[2]];
        const fn = [Math.abs(e1[1] * e2[2] - e1[2] * e2[1]), Math.abs(e1[2] * e2[0] - e1[0] * e2[2]), Math.abs(e1[0] * e2[1] - e1[1] * e2[0])];
        let ax = fn[0] > fn[1] && fn[0] > fn[2] ? [2, 1] : fn[1] > fn[2] ? [0, 2] : [0, 1];
        if (o.grain && dim[ax[1]] > dim[ax[0]]) ax = [ax[1], ax[0]];
        if (o.swap) ax = [ax[1], ax[0]];
        for (const V of [A, Bv, Cv]) { uvs.push(V[ax[0]] / ts + u0, V[ax[1]] / ts + v0); tls.push(tile + 1); }
      }
    }
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
  if (anyTile) { out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); out.setAttribute('aTile', new THREE.Float32BufferAttribute(tls, 1)); }
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

// ═════════════ v35: fogliame a ciuffi (stile cartoon) ═════════════
// Le chiome non sono più poliedri pieni: un nucleo scuro (per non vedere attraverso) coperto da tante
// "carte" con un ciuffo di foglie ritagliato (alpha test) e normali sferiche → chiome morbide e gonfie
// con il bordo frastagliato di foglie. Atlante 2×2: 0 ciuffo di foglie, 1 ramo di aghi, 2 fogliame fitto
// (per i nuclei), 3 rametto a foglie tonde (cespugli).
function makeLeafAtlas() {
  const SW = 1024, SH = 512, H = 256, c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d', WRF);
  const rnd = mulberry32(3535);
  const grey = (k) => { const L = Math.round(255 * Math.max(0, Math.min(1, k))); return `rgb(${L},${L},${L})`; };
  const leaf = (x, y, len, wid, ang, k) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = grey(k);
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(wid * 0.95, -len * 0.18, wid * 0.8, -len * 0.72, 0, -len);
    g.bezierCurveTo(-wid * 0.8, -len * 0.72, -wid * 0.95, -len * 0.18, 0, 0);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.11)';                       // metà in ombra: dà volume alla foglia
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(wid * 0.95, -len * 0.18, wid * 0.8, -len * 0.72, 0, -len); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.17)'; g.lineWidth = Math.max(1, wid * 0.09);
    g.beginPath(); g.moveTo(0, -len * 0.06); g.lineTo(0, -len * 0.84); g.stroke();
    g.restore();
  };
  const tileClip = (ox, oy) => { g.save(); g.beginPath(); g.rect(ox + 2, oy + 2, H - 4, H - 4); g.clip(); };
  const cluster = (ox, oy, n, rIn, len0, len1, wid0, wid1, k0) => {
    tileClip(ox, oy);
    const cx = ox + H / 2, cy = oy + H / 2;
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {                            // rametti sotto le foglie
      const a = rnd() * 6.283;
      g.strokeStyle = grey(0.36 + rnd() * 0.1); g.lineWidth = 2.5 + rnd() * 2;
      g.beginPath(); g.moveTo(cx, cy + H * 0.12);
      g.quadraticCurveTo(cx + Math.cos(a) * rIn * 0.4, cy + Math.sin(a) * rIn * 0.4, cx + Math.cos(a) * rIn * 0.95, cy + Math.sin(a) * rIn * 0.95); g.stroke();
    }
    const L = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, d = Math.pow(rnd(), 0.6) * rIn;
      L.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, a: a + Math.PI / 2 + (rnd() - 0.5) * 0.9, len: len0 + rnd() * (len1 - len0), wid: wid0 + rnd() * (wid1 - wid0), k: k0 + rnd() * (1 - k0) });
    }
    L.sort((p, q) => p.k - q.k);                             // prima le foglie scure (dietro), poi le chiare
    for (const l of L) leaf(l.x, l.y, l.len, l.wid, l.a, l.k);
    g.restore();
  };
  // 0 · ciuffo di foglie per le chiome
  cluster(0, 0, 48, 60, 40, 62, 15, 24, 0.5);
  // 1 · ramo di aghi (il ramo va dal basso verso l'alto del riquadro)
  {
    const ox = 256, oy = 0, cx = ox + H / 2;
    tileClip(ox, oy);
    g.lineCap = 'round';
    const N = [];
    for (let i = 0; i < 190; i++) {
      const t = Math.pow(rnd(), 0.85), y = oy + H - 10 - t * (H - 26), side = rnd() < 0.5 ? -1 : 1;
      const len = (16 + 92 * Math.pow(1 - t, 0.8)) * (0.7 + rnd() * 0.3), a = (0.55 + rnd() * 0.5) * side;
      N.push({ x: cx + (rnd() - 0.5) * 6, y, ex: cx + Math.sin(a) * len, ey: y - Math.cos(a) * len * 0.75, w: 2.2 + rnd() * 1.8, k: 0.45 + rnd() * 0.55 });
    }
    N.sort((p, q) => p.k - q.k);
    for (const nd of N) { g.strokeStyle = grey(nd.k); g.lineWidth = nd.w; g.beginPath(); g.moveTo(nd.x, nd.y); g.quadraticCurveTo((nd.x + nd.ex) / 2, (nd.y + nd.ey) / 2 - 6, nd.ex, nd.ey); g.stroke(); }
    g.strokeStyle = grey(0.4);
    for (let i = 0; i < 12; i++) { const y0 = oy + H - 8 - i * 20; g.lineWidth = 7 - i * 0.45; g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y0 - 22); g.stroke(); }
    g.restore();
  }
  // 2 · fogliame fitto e opaco (nuclei delle chiome)
  {
    const ox = 512, oy = 0;
    tileClip(ox, oy);
    g.fillStyle = grey(0.5); g.fillRect(ox, oy, H, H);
    for (let i = 0; i < 300; i++) leaf(ox + rnd() * H, oy + rnd() * H, 26 + rnd() * 22, 11 + rnd() * 8, rnd() * 6.283, 0.42 + rnd() * 0.58);
    g.restore();
  }
  // 3 · rametto a foglie tonde e fitte (cespugli)
  cluster(768, 0, 70, 68, 26, 42, 15, 23, 0.45);
  // 4 · v36: rami penduli del salice (fili sottili con foglioline strette che scendono)
  {
    const ox = 0, oy = 256;
    tileClip(ox, oy);
    g.lineCap = 'round';
    for (const sx of [42, 98, 150, 206]) {
      const sw = (rnd() - 0.5) * 30, pts = [];
      for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push([ox + sx + Math.sin(t * 2.6 + sx) * 7 + sw * t * t, oy + 4 + t * 246]); }
      g.strokeStyle = grey(0.42); g.lineWidth = 2.2;
      g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      const L = [];
      for (let k = 1; k < 24; k++) for (const side of [-1, 1]) {
        if (rnd() < 0.15) continue;
        const [x, y] = pts[k];
        L.push({ x, y, a: Math.PI + side * (0.35 + rnd() * 0.5), len: 16 + rnd() * 12 * (1 - k / 40), wid: 5 + rnd() * 3, k: 0.5 + rnd() * 0.5 });
      }
      L.sort((p, q) => p.k - q.k);
      for (const l of L) leaf(l.x, l.y, l.len, l.wid, l.a, l.k);
    }
    g.restore();
  }
  const img = g.getImageData(0, 0, SW, SH), d = img.data;
  // pixel trasparenti → grigio medio (niente aloni neri con il filtro bilineare e le mipmap)
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 8) { d[i] = d[i + 1] = d[i + 2] = 150; d[i + 3] = 0; }
  const tex = new THREE.DataTexture(new Uint8Array(d.buffer.slice(0)), SW, SH, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}
export const leafTexture = makeLeafAtlas();

/** accumulatore di triangoli per il fogliame (posizione, normale, colore, uv) */
function leafBuf() {
  const P = [], N = [], C = [], U = [];
  return {
    v(p, n, c, u, w) { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); C.push(c.r, c.g, c.b); U.push(u, w); },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.computeBoundingSphere(); g.computeBoundingBox();
      g.userData.shared = true;
      return g;
    },
  };
}
// atlante 4 × 2: ogni riquadro è largo 0,25 e alto 0,5 in coordinate uv
const TILE = (i) => [(i % 4) * 0.25, Math.floor(i / 4) * 0.5];
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _cA = new THREE.Color(), _cB = new THREE.Color();
function randUnit(rnd, out) {
  const z = rnd() * 2 - 1, a = rnd() * 6.2832, r = Math.sqrt(1 - z * z);
  return out.set(Math.cos(a) * r, z, Math.sin(a) * r);
}
/** una carta (quad) di foglie: centro, semiasse orizzontale U, semiasse verticale V (verso la punta) */
function leafCard(B, ctr, Ua, Va, tile, nrm, col) {
  const [u0, v0] = TILE(tile);
  const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => {
    const p = ctr.clone().addScaledVector(Ua, s).addScaledVector(Va, t);
    return { p, n: nrm(p), c: col(p), u: u0 + 0.25 * (0.012 + (0.5 + 0.5 * s) * 0.976), w: v0 + 0.5 * (0.012 + (0.5 - 0.5 * t) * 0.976) };
  });
  for (const k of [0, 1, 2, 0, 2, 3]) { const q = cs[k]; B.v(q.p, q.n, q.c, q.u, q.w); }
}
/** nucleo opaco (geometria qualunque) con uv proiettate dalla normale sul riquadro del fogliame fitto */
function leafCore(B, geo, off, nrm, col) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position, [u0, v0] = TILE(2);
  for (let i = 0; i < P.count; i++) {
    const p = new THREE.Vector3(P.getX(i) + off.x, P.getY(i) + off.y, P.getZ(i) + off.z), n = nrm(p);
    B.v(p, n, col(p), u0 + 0.25 * (0.04 + (0.5 + 0.5 * n.x) * 0.92), v0 + 0.5 * (0.04 + (0.5 + 0.5 * n.z) * 0.92));
  }
}
/**
 * chioma a grappoli: blobs = [x, y, z, r]. Nucleo scuro per ogni grappolo + carte di foglie sulla superficie,
 * colori della tavolozza con ombra interna (più scuro in basso e verso il centro) e cime schiarite dal sole.
 */
function leafCanopy(B, o) {
  const rnd = mulberry32(o.seed), blobs = o.blobs;
  const C = new THREE.Vector3(...o.center);
  let yMin = Infinity, yMax = -Infinity, R = 0;
  for (const [x, y, z, r] of blobs) { yMin = Math.min(yMin, y - r); yMax = Math.max(yMax, y + r); R = Math.max(R, Math.hypot(x - C.x, y - C.y, z - C.z) + r); }
  const rMax = Math.max(...blobs.map((b) => b[3]));
  const deep = new THREE.Color(o.deep).lerp(new THREE.Color(o.palette[0]), 0.45), top = new THREE.Color(o.top || '#ffffff'), pal = o.palette.map((c) => new THREE.Color(c));
  const nrmAt = (p, bc) => _v3.subVectors(p, C).divideScalar(R).addScaledVector(_v2.subVectors(p, bc).normalize(), 0.35).normalize().clone();
  const shade = (p, base, out) => {
    const h = Math.min(1, Math.max(0, (p.y - yMin) / (yMax - yMin))), rr = Math.min(1, p.distanceTo(C) / R);
    const ao = 0.56 + 0.44 * Math.min(1, Math.max(0, h * 0.5 + rr * 0.75 - 0.15));
    out.copy(base).multiplyScalar(ao);
    return out.lerp(top, Math.max(0, h * 1.5 - 0.85) * (o.topK ?? 0.3) * ao).clone();
  };
  blobs.forEach(([x, y, z, r], bi) => {
    const bc = new THREE.Vector3(x, y, z);
    const core = wobble(new THREE.IcosahedronGeometry(r * (o.core ?? 0.78), 1), r * 0.07, o.seed + 50 + bi);
    leafCore(B, core, bc, (p) => nrmAt(p, bc), (p) => shade(p, deep, _cA).multiplyScalar(0.85 + rnd() * 0.15));
  });
  const dir = new THREE.Vector3(), nn = new THREE.Vector3(), Ua = new THREE.Vector3(), Va = new THREE.Vector3();
  blobs.forEach(([x, y, z, r], bi) => {
    const bc = new THREE.Vector3(x, y, z), n = Math.round((o.density ?? 20) * r * r);
    for (let k = 0; k < n; k++) {
      randUnit(rnd, dir);
      if (dir.y < -0.35 && rnd() < 0.6) dir.y = -dir.y * 0.4;
      dir.normalize();
      const p = bc.clone().addScaledVector(dir, r * (0.8 + rnd() * 0.28));
      // carte completamente sepolte dentro un altro grappolo: non servono
      let hidden = false;
      for (let j = 0; j < blobs.length; j++) if (j !== bi) { const b = blobs[j]; if (Math.hypot(p.x - b[0], p.y - b[1], p.z - b[2]) < b[3] * 0.8) { hidden = true; break; } }
      if (hidden) continue;
      nn.copy(dir).addScaledVector(randUnit(rnd, _v1), o.spread ?? 0.5).normalize();
      Ua.crossVectors(Math.abs(nn.y) < 0.92 ? _v1.set(0, 1, 0) : _v1.set(1, 0, 0), nn).normalize();
      Va.crossVectors(nn, Ua).normalize();
      const roll = rnd() * 6.2832, cr = Math.cos(roll), sr = Math.sin(roll);
      const U2 = Ua.clone().multiplyScalar(cr).addScaledVector(Va, sr), V2 = Va.clone().multiplyScalar(cr).addScaledVector(Ua, -sr);
      const sz = o.card * (0.8 + rnd() * 0.4) * (0.7 + 0.3 * r / rMax) * 0.5;
      U2.multiplyScalar(sz); V2.multiplyScalar(sz);
      const base = _cB.copy(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.92 + rnd() * 0.16).clone();
      leafCard(B, p, U2, V2, o.tile ?? 0, (q) => nrmAt(q, bc), (q) => shade(q, base, _cA));
    }
  });
}
const pal0 = (o) => new THREE.Color(o.palette[0]);
/** abete: palchi di rami (carte di aghi che pendono verso il basso) attorno a coni scuri */
function pineCanopy(B, o) {
  const rnd = mulberry32(o.seed), up = new THREE.Vector3(0, 1, 0);
  const pal = o.palette.map((c) => new THREE.Color(c)), deep = new THREE.Color(o.deep).lerp(pal0(o), 0.35), snow = new THREE.Color('#e6eef6');
  const nT = o.tiers.length;
  o.tiers.forEach(([R, y, cnt, hh], i) => {
    const fr = i / (nT - 1);
    const cone = wobble(new THREE.ConeGeometry(R * 0.5, hh, 8, 1), 0.06, o.seed + i);
    leafCore(B, cone, new THREE.Vector3(0, y + hh * 0.38, 0),
      (p) => _v1.set(p.x, 0, p.z).normalize().multiplyScalar(0.7).add(_v2.set(0, 0.7, 0)).normalize().clone(),
      (p) => _cA.copy(deep).multiplyScalar(0.7 + 0.3 * (p.y - y) / hh).clone());
    const cn = Math.round(cnt * 1.35);
    for (let j = 0; j < cn; j++) {
      const ang = (j + rnd() * 0.5) / cn * 6.2832 + i * 0.7;
      const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      for (const layer of [0, 1, 2]) {
        const len = R * (0.92 + rnd() * 0.22) * [1, 0.85, 0.72][layer], droop = [0.32, 0.55, 0.1][layer] + rnd() * 0.18;
        const Vt = dir.clone().multiplyScalar(Math.cos(droop)).addScaledVector(up, -Math.sin(droop));
        const side = new THREE.Vector3().crossVectors(up, dir).normalize();
        const tilt = [1, -1, 1][layer] * (0.25 + rnd() * 0.3) + (layer === 2 ? 0.75 : 0);
        const Us = side.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(up, Math.sin(tilt));
        const ctr = new THREE.Vector3(0, y + hh * [0.18, 0.3, 0.45][layer], 0).addScaledVector(Vt, len * 0.5);
        const base = _cB.copy(pal[Math.floor(rnd() * pal.length)]).multiplyScalar(0.9 + rnd() * 0.18).clone();
        const snowy = (o.snow || 0) * (rnd() < 0.85 ? 1 : 0.3);
        leafCard(B, ctr, Us.multiplyScalar(len * 0.5), Vt.multiplyScalar(len * 0.58), 1,
          (p) => { const rr = Math.hypot(p.x, p.z) + 0.001; return new THREE.Vector3(p.x / rr * 0.6, 0.8, p.z / rr * 0.6).normalize(); },
          (p) => {
            const rr = Math.min(1, Math.hypot(p.x, p.z) / R);
            const c = _cA.copy(base).multiplyScalar((0.6 + 0.45 * rr) * (0.85 + 0.2 * fr));
            if (snowy) c.lerp(snow, Math.min(1, snowy * (0.35 + rr * 0.65)) * (layer ? 0.55 : 0.9));
            return c.clone();
          });
      }
    }
  });
  // punta
  const [tR, tY] = o.tip;
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI;
    const base = _cB.copy(pal[pal.length - 1]).clone();
    leafCard(B, new THREE.Vector3(0, tY, 0), new THREE.Vector3(Math.cos(a) * tR * 0.5, 0, Math.sin(a) * tR * 0.5), new THREE.Vector3(0, tR, 0), 1,
      () => new THREE.Vector3(0, 1, 0), () => (o.snow ? _cA.copy(base).lerp(snow, 0.6 * o.snow) : _cA.copy(base)).clone());
  }
}

// ═════════════ 01 · ALBERI ═════════════
function trunkParts(h, r0, r1, color, lean = 0) {
  return [part(new THREE.CylinderGeometry(r1, r0, h, 7, 2), color, { y: h / 2, rz: lean, jit: 0.12 })];
}
function branchParts(color, list) {
  return list.map(([x, y, z, len, rz, ry]) => part(new THREE.CylinderGeometry(0.06, 0.12, len, 6), color, { x, y, z, rz, ry, jit: 0.1 }));
}
const PINE_TIERS = [[2.5, 1.7, 9, 1.6], [2.15, 2.55, 9, 1.5], [1.8, 3.4, 8, 1.4], [1.45, 4.2, 7, 1.3], [1.1, 4.95, 6, 1.2], [0.75, 5.65, 5, 1.05], [0.45, 6.3, 4, 0.9]];
function makePine() {
  const parts = trunkParts(6.4, 0.32, 0.07, '#5e3d22');
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.BoxGeometry(0.16, 0.2, 0.7), '#5a3a20', { y: 0.08, ry: i * Math.PI / 2 + 0.4, post: new THREE.Matrix4().makeTranslation(Math.sin(i * Math.PI / 2 + 0.4) * 0.3, 0, Math.cos(i * Math.PI / 2 + 0.4) * 0.3) }));
  const B = leafBuf();
  pineCanopy(B, { seed: 101, tiers: PINE_TIERS, tip: [0.55, 7.2], palette: ['#2f7538', '#3a8640', '#2d6a33', '#459049'], deep: '#1a4422' });
  return { wood: mergeParts(parts, 101), leaf: B.build() };
}
const OAK_BLOBS = [[0, 4.9, 0, 1.95], [1.35, 4.45, 0.35, 1.4], [-1.3, 4.55, -0.25, 1.45], [0.35, 4.5, 1.3, 1.35], [-0.25, 4.4, -1.3, 1.35], [0.15, 6.05, 0.1, 1.4], [0.95, 5.55, -0.8, 1.1], [-0.9, 5.65, 0.8, 1.1]];
function makeOak() {
  const parts = trunkParts(3.6, 0.42, 0.26, '#6a4526');
  parts.push(...branchParts('#6a4526', [[0.5, 3.5, 0, 1.7, -0.8, 0], [-0.45, 3.6, 0.2, 1.5, 0.75, 0.4], [0.1, 3.7, -0.5, 1.4, 0.7, 1.7]]));
  const B = leafBuf();
  leafCanopy(B, { seed: 202, blobs: OAK_BLOBS, center: [0, 4.6, 0], palette: ['#4c9a34', '#58a83a', '#3f8a2e', '#66b444'], deep: '#244f1c', top: '#d8ec7a', card: 1.9 });
  return { wood: mergeParts(parts, 202), leaf: B.build() };
}
const BIRCH_TRUNK = () => part(new THREE.CylinderGeometry(0.13, 0.24, 5.6, 7, 6), '#e6e2d6', { y: 2.8, jit: 0.05, colorFn: (nx, ny, nz, x, y, z, rnd) => (rnd() < 0.22 ? '#3a3a36' : '#e8e4d8') });
function makeBirch() {
  // betulla "lime": chioma ovale verde acido
  const parts = [BIRCH_TRUNK()];
  parts.push(...branchParts('#d8d4c8', [[0.35, 4.2, 0, 1.0, -0.7, 0], [-0.3, 4.6, 0.1, 0.9, 0.7, 0.5]]));
  const B = leafBuf();
  leafCanopy(B, { seed: 303, blobs: [[0, 4.7, 0, 1.4], [0.2, 5.85, -0.1, 1.3], [-0.1, 6.9, 0.1, 0.98], [0.8, 5.1, 0.4, 0.95], [-0.75, 5.4, -0.35, 1.0]], center: [0, 5.5, 0], palette: ['#8fc63a', '#a3d444', '#7cb832', '#b5df52'], deep: '#3f6e1c', top: '#eef68a', card: 1.6 });
  return { wood: mergeParts(parts, 303), leaf: B.build() };
}

// versioni semplificate per la media distanza (stessa sagoma e colori, molti meno triangoli)
function makePineLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.2, 0.3, 3.2, 5, 1, true), '#5e3d22', { y: 1.6 }),
    part(new THREE.ConeGeometry(2.4, 3.8, 7, 1, true), '#2c6232', { y: 3.5, jit: 0.1 }),
    part(new THREE.ConeGeometry(1.5, 3.3, 7, 1, true), '#34703a', { y: 5.6, ry: 0.5, jit: 0.1 }),
  ], 111);
}
function makeOakLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.24, 0.4, 3.4, 5, 1, true), '#6a4526', { y: 1.7 }),
    part(new THREE.IcosahedronGeometry(2.5, 0), '#43862f', { y: 4.8, sy: 0.85, jit: 0.12 }),
    part(new THREE.IcosahedronGeometry(1.4, 0), '#509a38', { y: 6.0, x: 0.3, jit: 0.12 }),
  ], 222);
}
function makeBirchLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.15, 0.24, 4.2, 5, 1, true), '#e6e2d6', { y: 2.1 }),
    part(new THREE.IcosahedronGeometry(1.45, 0), '#86b838', { y: 5.6, sy: 1.6, jit: 0.12 }),
  ], 333);
}

// ═════════════ alberi dei biomi ═════════════
const SNOWC = '#dde5ee';
function makeSnowPine() {
  const parts = trunkParts(6.2, 0.3, 0.07, '#4e3420');
  const B = leafBuf();
  pineCanopy(B, { seed: 121, tiers: PINE_TIERS.map(([r, y, n, h]) => [r * 0.95, y - 0.1, n, h]), tip: [0.5, 7.05], palette: ['#1f4a2c', '#24522f', '#2a5b33', '#2f6437'], deep: '#14301c', snow: 1 });
  return { wood: mergeParts(parts, 121), leaf: B.build() };
}
function makeSnowPineLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.2, 0.3, 3, 5, 1, true), '#4e3420', { y: 1.5 }),
    part(new THREE.ConeGeometry(2.3, 3.7, 7, 1, true), '#24522f', { y: 3.4, jit: 0.1, colorFn: (nx, ny) => ny > 0.45 ? SNOWC : null }),
    part(new THREE.ConeGeometry(1.45, 3.2, 7, 1, true), '#2f6437', { y: 5.4, ry: 0.5, jit: 0.1, colorFn: (nx, ny) => ny > 0.45 ? SNOWC : null }),
  ], 131);
}
function makeAutumnOak() {
  // quercia rossa
  const parts = trunkParts(3.5, 0.4, 0.24, '#5e3b22');
  parts.push(...branchParts('#5e3b22', [[0.5, 3.4, 0, 1.7, -0.8, 0], [-0.45, 3.5, 0.2, 1.5, 0.75, 0.4], [0.1, 3.6, -0.5, 1.4, 0.7, 1.7]]));
  const B = leafBuf();
  leafCanopy(B, { seed: 212, blobs: OAK_BLOBS.map(([x, y, z, r]) => [-z, y - 0.1, x, r * 0.97]), center: [0, 4.5, 0], palette: ['#d8402a', '#c23222', '#e85a2e', '#b52a20'], deep: '#5e1810', top: '#ffb070', topK: 0.35, card: 1.9 });
  return { wood: mergeParts(parts, 212), leaf: B.build() };
}
function makeAutumnOakLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.24, 0.4, 3.3, 5, 1, true), '#5e3b22', { y: 1.65 }),
    part(new THREE.IcosahedronGeometry(2.45, 0), '#b8321f', { y: 4.7, sy: 0.85, jit: 0.14 }),
    part(new THREE.IcosahedronGeometry(1.35, 0), '#d0482a', { y: 5.9, x: 0.3, jit: 0.12 }),
  ], 232);
}
function makeAutumnBirch() {
  // albero arancione dalla chioma tonda
  const parts = [BIRCH_TRUNK()];
  parts.push(...branchParts('#d8d4c8', [[0.4, 4.0, 0, 1.1, -0.75, 0], [-0.35, 4.2, 0.1, 1.0, 0.7, 0.5]]));
  const B = leafBuf();
  leafCanopy(B, { seed: 313, blobs: [[0, 5.2, 0, 1.65], [1.05, 4.85, 0.3, 1.15], [-1.0, 4.95, -0.3, 1.2], [0.2, 6.35, 0, 1.25], [0.3, 4.75, -1.05, 1.05], [-0.3, 4.85, 1.05, 1.05]], center: [0, 5.2, 0], palette: ['#f08a2a', '#e8702a', '#f5a43a', '#dc5f24'], deep: '#7a3010', top: '#ffe08a', topK: 0.35, card: 1.75 });
  return { wood: mergeParts(parts, 313), leaf: B.build() };
}
function makeAutumnBirchLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.15, 0.24, 4.2, 5, 1, true), '#e6e2d6', { y: 2.1 }),
    part(new THREE.IcosahedronGeometry(1.7, 0), '#de7426', { y: 5.4, sy: 1.25, jit: 0.12 }),
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
// ═════════════ v36: tubi lisci con costolature (cactus saguaro, tronchi curvi) ═════════════
/**
 * tubo lungo una linea (pts) con raggio variabile; ribs > 0 = costolature verticali (cactus).
 * Telai a trasporto parallelo, normali lisce. color(rib, t, p) → THREE.Color per vertice.
 */
function ribTube(pts, radii, o = {}) {
  const N = o.seg || 24, ribs = o.ribs || 0, dep = o.depth || 0;
  const T = pts.map((p, i) => pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  const nrm = Math.abs(T[0].x) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const pos = [], col = [], idx = [], ridge = [];
  for (let i = 0; i < pts.length; i++) {
    nrm.addScaledVector(T[i], -nrm.dot(T[i])).normalize();
    const bin = new THREE.Vector3().crossVectors(T[i], nrm);
    for (let j = 0; j <= N; j++) {
      const th = j / N * Math.PI * 2, rib = ribs ? Math.cos(ribs * th) : 0;
      const r = radii[i] * (1 + dep * (rib > 0 ? Math.pow(rib, 0.6) : -Math.pow(-rib, 1.6)));
      const p = pts[i].clone().addScaledVector(nrm, Math.cos(th) * r).addScaledVector(bin, Math.sin(th) * r);
      pos.push(p.x, p.y, p.z);
      const c = o.color ? o.color(rib, i / (pts.length - 1), p) : _cA.set('#ffffff');
      col.push(c.r, c.g, c.b);
      if (o.spines && ribs && Math.abs(rib - 1) < 1e-3 && i > 0 && i < pts.length - 2 && radii[i] > radii[0] * 0.6) ridge.push({ p, n: p.clone().sub(pts[i]).normalize() });
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < N; j++) {
    const a = i * (N + 1) + j, b = a + N + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.ridge = ridge;
  return g;
}
/** aggiunge una calotta arrotondata in fondo alla linea */
function withCap(pts, radii, k = 6) {
  const n = pts.length, end = pts[n - 1], dir = end.clone().sub(pts[n - 2]).normalize(), R = radii[n - 1];
  for (let i = 1; i <= k; i++) { const f = i / k * Math.PI / 2; pts.push(end.clone().addScaledVector(dir, Math.sin(f) * R * 0.9)); radii.push(Math.max(0.012, Math.cos(f) * R)); }
  return [pts, radii];
}
/** unisce geometrie (diventano non indicizzate) mantenendo normali e colori */
function concatGeos(list) {
  const P = [], N = [], C = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); if (c) C.push(c.getX(i), c.getY(i), c.getZ(i)); else C.push(1, 1, 1); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  out.userData.shared = true;
  return out;
}
/** cactus saguaro in stile cartoon: fusto e braccia costolati, lisci, con le spine chiare sulle creste */
function makeCactus() {
  const ridgeC = new THREE.Color('#7cc24e'), grooveC = new THREE.Color('#2c6a26'), tipC = new THREE.Color('#9ad65c');
  const color = (base) => (rib, t, p) => _cA.copy(grooveC).lerp(ridgeC, Math.pow((rib + 1) / 2, 0.8)).multiplyScalar(0.86 + 0.18 * Math.min(1, p.y / 5)).lerp(tipC, Math.max(0, (p.y - base) / 6) * 0.25).clone();
  const geos = [];
  // fusto
  let pts = [], rad = [];
  for (let i = 0; i <= 14; i++) { const y = -0.3 + i / 14 * 5.4; pts.push(new THREE.Vector3(Math.sin(y * 0.5) * 0.04, y, 0)); rad.push(0.44 - i / 14 * 0.05); }
  [pts, rad] = withCap(pts, rad);
  const trunk = ribTube(pts, rad, { ribs: 10, depth: 0.1, seg: 40, color: color(0), spines: true });
  geos.push(trunk);
  // braccia: in fuori, gomito arrotondato, poi su
  const arms = [[0.3, 1.7, 3.6, 0.27], [3.5, 2.5, 4.1, 0.24], [2.0, 3.2, 4.5, 0.2]];
  for (const [a, y0, y1, r] of arms) {
    const dx = Math.cos(a), dz = Math.sin(a), out = 0.62, er = 0.34;
    pts = []; rad = [];
    for (let d = 0.05; d <= out; d += 0.14) { pts.push(new THREE.Vector3(dx * d, y0, dz * d)); rad.push(r); }
    for (let k = 1; k <= 6; k++) { const f = k / 6 * Math.PI / 2; pts.push(new THREE.Vector3(dx * (out + Math.sin(f) * er), y0 + (1 - Math.cos(f)) * er, dz * (out + Math.sin(f) * er))); rad.push(r); }
    const xe = out + er;
    for (let y = y0 + er + 0.35; y <= y1; y += 0.35) { pts.push(new THREE.Vector3(dx * xe, y, dz * xe)); rad.push(r * (1 - 0.1 * (y - y0) / (y1 - y0))); }
    [pts, rad] = withCap(pts, rad, 5);
    geos.push(ribTube(pts, rad, { ribs: 8, depth: 0.1, seg: 32, color: color(y0), spines: true }));
  }
  // spine: piccoli coni chiari sulle creste (una ogni tanto)
  const spineC = new THREE.Color('#f4efd2'), rnd = mulberry32(5150);
  const cone = new THREE.ConeGeometry(0.022, 0.1, 3), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  for (const g of geos.slice()) for (const { p, n } of g.userData.ridge) {
    if (rnd() < 0.45) continue;
    const s = cone.clone(); q.setFromUnitVectors(up, n.clone().add(new THREE.Vector3(0, 0.25, 0)).normalize());
    m.compose(p.clone().addScaledVector(n, 0.035), q, new THREE.Vector3(1, 1, 1)); s.applyMatrix4(m);
    const cc = []; for (let i = 0; i < s.attributes.position.count; i++) cc.push(spineC.r, spineC.g, spineC.b);
    s.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    geos.push(s);
  }
  return concatGeos(geos);
}
function makeCactusLow() {
  return mergeParts([
    part(new THREE.CylinderGeometry(0.4, 0.44, 5.4, 6, 1), '#4a9a38', { y: 2.4 }),
    part(new THREE.BoxGeometry(1.0, 0.5, 0.5), '#4a9a38', { x: 0.5, y: 1.7, ry: -0.3 }),
    part(new THREE.BoxGeometry(0.5, 1.8, 0.5), '#55a63e', { x: 0.92, y: 2.65, z: 0.28 }),
    part(new THREE.BoxGeometry(0.46, 1.6, 0.46), '#55a63e', { x: -0.9, y: 3.3, z: -0.32 }),
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
// v35: cupola fitta di rametti fogliosi (carte del riquadro 3) attorno a un nucleo scuro; la parte
// "legnosa" (instanziata col materiale dei cespugli) ha solo i rametti alla base e gli eventuali fiori.
function makeBush(seed, flowers = null, palette = ['#4a9a38', '#58aa40', '#64b848', '#43903a']) {
  const rnd = mulberry32(seed);
  const parts = [];
  const n = 4 + Math.floor(rnd() * 3);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rnd(), d = i === 0 ? 0 : 0.36 + rnd() * 0.22, r = i === 0 ? 0.64 : 0.4 + rnd() * 0.18;
    blobs.push([Math.cos(a) * d, i === 0 ? 0.6 : 0.42 + rnd() * 0.22, Math.sin(a) * d, r]);
  }
  // rametti alla base
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.28 + rnd() * 0.6;
    parts.push(part(new THREE.CylinderGeometry(0.018, 0.035, 0.55, 4), '#4a3520', { x: Math.cos(a) * 0.12, y: 0.22, z: Math.sin(a) * 0.12, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5, jit: 0.1 }));
  }
  if (flowers) {
    for (let k = 0; k < 16; k++) {
      const [bx, by, bz, br] = blobs[Math.floor(rnd() * blobs.length)];
      const th = rnd() * 6.283, ph = rnd() * 1.1;
      const rr = br * (1.0 + rnd() * 0.08);
      parts.push(part(new THREE.OctahedronGeometry(0.085, 0), flowers[k % flowers.length], { x: bx + Math.sin(ph) * Math.cos(th) * rr, y: by + Math.cos(ph) * rr * 0.9, z: bz + Math.sin(ph) * Math.sin(th) * rr, jit: 0.05, noSky: true }));
    }
  }
  const B = leafBuf();
  leafCanopy(B, { seed: seed + 7, blobs: blobs.map(([x, y, z, r]) => [x, y * 0.95, z, r]), center: [0, 0.3, 0], palette, deep: '#2c5a20', top: '#d6ee7a', topK: 0.3, card: 0.72, density: 74, core: 0.82, tile: 3, spread: 0.3 });
  return { wood: mergeParts(parts, seed), leaf: B.build() };
}

// ═════════════ texture della pietra (dati lineari, media ~0,5) ═════════════
function makeStoneTexture() {
  // v22: niente grana per pixel (dava il "rumore" a quadretti da vicino): solo macchie morbide e venature sfumate
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', WRF);
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
// ═════════════ v36: atlante "borgo medievale" per le casette (tavole grigie, pietra, ardesia, travi) ═════════════
function makeHouseAtlas() {
  const S = 1024, H = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', WRF), rnd = mulberry32(3636);
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  // ── 0 · tavole verticali grigio-azzurre consumate ──
  {
    const ox = 0, oy = 0, NP = 6, w = H / NP;
    for (let i = 0; i < NP; i++) {
      const x0 = ox + i * w, L = 50 + rnd() * 14, hue = 205 + rnd() * 15, sat = 8 + rnd() * 9;
      g.fillStyle = hsl(hue, sat, L); g.fillRect(x0, oy, w, H);
      // venature verticali ondulate (periodiche in altezza → si ripete senza giunte)
      for (let k = 0; k < 34; k++) {
        const gx = x0 + 4 + rnd() * (w - 8), amp = 1 + rnd() * 3, f = 1 + Math.floor(rnd() * 3), ph = rnd() * 6.28, dl = (rnd() - 0.55) * 22;
        g.strokeStyle = hsl(hue, sat, Math.max(15, Math.min(85, L + dl)), 0.35 + rnd() * 0.3); g.lineWidth = 0.8 + rnd() * 1.6;
        g.beginPath();
        for (let y = 0; y <= H; y += 8) { const xx = gx + Math.sin(y / H * 6.283 * f + ph) * amp; y ? g.lineTo(xx, oy + y) : g.moveTo(xx, oy + y); }
        g.stroke();
      }
      // nodi
      for (let k = 0; k < 2; k++) if (rnd() < 0.7) {
        const kx = x0 + 12 + rnd() * (w - 24), ky = oy + 20 + rnd() * (H - 40);
        for (let r = 9; r > 1; r -= 2.2) { g.strokeStyle = hsl(hue, sat, L - 18 + r, 0.6); g.lineWidth = 1.4; g.beginPath(); g.ellipse(kx, ky, r * 0.7, r * 1.4, 0, 0, 6.283); g.stroke(); }
      }
      // giunta orizzontale (tavole di lunghezza diversa)
      if (rnd() < 0.6) { const jy = oy + 40 + rnd() * (H - 80); g.fillStyle = 'rgba(25,28,32,0.85)'; g.fillRect(x0, jy, w, 3); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0, jy + 3, w, 2); }
      // fessura scura tra le tavole + bordo chiaro smussato
      g.fillStyle = 'rgba(20,22,26,0.95)'; g.fillRect(x0, oy, 4, H);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x0 + 4, oy, 3, H);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0 + w - 6, oy, 6, H);
      // chiodi
      for (const ny of [oy + 30, oy + H / 2 + 10]) for (const nx of [x0 + 12, x0 + w - 14]) { g.fillStyle = 'rgba(30,30,32,0.9)'; g.beginPath(); g.arc(nx, ny + (rnd() - 0.5) * 8, 2.6, 0, 6.283); g.fill(); }
    }
  }
  // ── 1 · muro di pietre arrotondate con la malta ──
  {
    const ox = H, oy = 0;
    g.save(); g.beginPath(); g.rect(ox, oy, H, H); g.clip();
    g.fillStyle = '#4f4c48'; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; g.fillRect(ox + rnd() * H, oy + rnd() * H, 2, 2); }
    let y = 0;
    const rows = [];
    while (y < H - 1) { let hh = 52 + Math.floor(rnd() * 34); if (H - (y + hh) < 50) hh = H - y; rows.push([y, hh]); y += hh; }
    const stone = (x, y0, w, hh) => {
      const L = 48 + rnd() * 22, hue = rnd() < 0.7 ? 30 + rnd() * 20 : 200 + rnd() * 20, sat = 4 + rnd() * 7;
      for (const dx of [0, -H, H]) {
        const cx = ox + x + w / 2 + dx, cy = oy + y0 + hh / 2, rx = w / 2 - 3, ry = hh / 2 - 3;
        g.beginPath();
        for (let k = 0; k < 14; k++) {
          const a = k / 14 * 6.283, j = 0.9 + rnd() * 0.12;
          const px = cx + Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.6) * rx * j, py = cy + Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.6) * ry * j;
          k ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath();
        const gr = g.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.6, cy + ry);
        gr.addColorStop(0, hsl(hue, sat, L + 14)); gr.addColorStop(0.45, hsl(hue, sat, L)); gr.addColorStop(1, hsl(hue, sat, L - 16));
        g.fillStyle = gr; g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
        // screpolature e licheni
        g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx - rx * 0.5 + rnd() * rx * 0.4, cy - ry * 0.3); g.lineTo(cx + rnd() * rx * 0.5, cy + ry * 0.4 * rnd()); g.stroke();
        if (rnd() < 0.25) { g.fillStyle = 'rgba(150,160,90,0.25)'; g.beginPath(); g.ellipse(cx + (rnd() - 0.5) * rx, cy + (rnd() - 0.5) * ry, 6 + rnd() * 8, 4 + rnd() * 5, 0, 0, 6.283); g.fill(); }
      }
    };
    for (const [y0, hh] of rows) {
      let x = -rnd() * 60;
      const xEnd = x + H;
      while (x < xEnd - 1) { let w = 70 + rnd() * 80; if (xEnd - (x + w) < 45) w = xEnd - x; stone(((x % H) + H) % H, y0, w, hh); x += w; }
    }
    g.restore();
  }
  // ── 2 · ardesia azzurra a file sfalsate ──
  {
    const ox = 0, oy = H, NR = 8, rh = H / NR;
    g.fillStyle = '#2a333c'; g.fillRect(ox, oy, H, H);
    for (let r = 0; r < NR; r++) {
      const y0 = oy + r * rh;
      let x = r % 2 ? -rnd() * 30 - 20 : -rnd() * 20;
      while (x < H) {
        const w = 44 + rnd() * 26, L = 40 + rnd() * 16, hue = 205 + rnd() * 14, sat = 14 + rnd() * 12;
        for (const dx of [0, H]) {
          const x0 = ox + x + dx - (x + w > H ? H : 0) * (dx ? 1 : 0);
          const xx = dx ? x0 - H : x0;
          if (xx > ox + H || xx + w < ox) continue;
          const gr = g.createLinearGradient(0, y0, 0, y0 + rh);
          gr.addColorStop(0, hsl(hue, sat, L + 8)); gr.addColorStop(0.75, hsl(hue, sat, L)); gr.addColorStop(1, hsl(hue, sat, L - 14));
          g.fillStyle = gr;
          g.beginPath();
          const cut = rnd() < 0.25 ? 8 + rnd() * 8 : 2;
          g.moveTo(xx + 2, y0 + 1); g.lineTo(xx + w - 2, y0 + 1); g.lineTo(xx + w - 2, y0 + rh - cut); g.lineTo(xx + w - 2 - cut, y0 + rh - 2); g.lineTo(xx + 2 + (rnd() < 0.2 ? 6 : 0), y0 + rh - 2); g.closePath();
          g.fill();
          for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(255,255,255,${0.04 + rnd() * 0.06})`; g.lineWidth = 1; const yy = y0 + 6 + rnd() * (rh - 12); g.beginPath(); g.moveTo(xx + 4, yy); g.lineTo(xx + w - 4, yy + (rnd() - 0.5) * 4); g.stroke(); }
        }
        x += w;
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ox, y0 + rh - 3, H, 3);    // ombra della fila sopra
    }
  }
  // ── 3 · travi di legno caldo (venatura lungo u) ──
  {
    const ox = H, oy = H;
    g.fillStyle = '#9a6233'; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 120; k++) {
      const gy = rnd() * H, amp = 1 + rnd() * 4, f = 1 + Math.floor(rnd() * 3), ph = rnd() * 6.28, dl = (rnd() - 0.5) * 30;
      g.strokeStyle = hsl(26 + rnd() * 8, 45 + rnd() * 15, 34 + dl * 0.6, 0.35 + rnd() * 0.35); g.lineWidth = 0.8 + rnd() * 2.2;
      g.beginPath();
      for (let x = 0; x <= H; x += 8) { const yy = gy + Math.sin(x / H * 6.283 * f + ph) * amp; x ? g.lineTo(ox + x, oy + yy) : g.moveTo(ox, oy + yy); }
      g.stroke();
    }
    for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(40,20,8,0.7)'; g.lineWidth = 1.5 + rnd() * 1.5; const y = oy + rnd() * H, x0 = ox + rnd() * H * 0.6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 60 + rnd() * 140, y + (rnd() - 0.5) * 6); g.stroke(); }
    for (let k = 0; k < 4; k++) { const kx = ox + rnd() * H, ky = oy + rnd() * H; for (let r = 12; r > 1; r -= 2.5) { g.strokeStyle = hsl(24, 50, 22 + r, 0.55); g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, r * 1.6, r * 0.7, 0, 0, 6.283); g.stroke(); } }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export const houseAtlas = makeHouseAtlas();
/**
 * v36: materiale delle casette: atlante 2×2 scelto per triangolo (attributo aTile = riquadro + 1, 0 = solo colore)
 * con ripetizione dentro il riquadro (fract + textureGrad: niente righe sulle giunte delle mipmap).
 */
export function makeAtlasMaterial(key, atlas = houseAtlas, opt = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.88, metalness: 0.0, flatShading: true, ...opt });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;\nvarying float vTile;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTile = aTile;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTile;')
      .replace('#include <map_fragment>', `
        if ( vTile > 0.5 ) {
          float tl = floor( vTile - 0.5 );
          vec2 off = vec2( mod( tl, 2.0 ), 1.0 - floor( tl / 2.0 ) ) * 0.5;   // (la CanvasTexture è capovolta: riga 0 in alto)
          vec2 tuv = off + 0.5 * ( 0.008 + fract( vMapUv ) * 0.984 );
          vec4 texelColor = textureGrad( map, tuv, dFdx( vMapUv ) * 0.492, dFdy( vMapUv ) * 0.492 );
          diffuseColor *= texelColor;
        }`);
  };
  m.customProgramCacheKey = () => 'atlas36-' + key;
  return m;
}
export const shedMaterial = makeAtlasMaterial('shed');

/**
 * v38: atlante "civico" 2×2 per gli arredi di piazza:
 *  0 · listelli di legno verniciato arancio (panchine), venatura lungo u
 *  1 · marmo crema con venature sottili (fontane)
 *  2 · acqua chiara con increspature e riflessi
 *  3 · ghisa nera opaca con riflessi (fianchi delle panchine)
 */
function makeCivicAtlas() {
  const S = 1024, H = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', WRF), rnd = mulberry32(3838);
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  // 0 · legno arancio: una tavola per riquadro (la venatura corre lungo u e si ripete senza giunte)
  {
    const ox = 0, oy = 0;
    const gr = g.createLinearGradient(0, oy, 0, oy + H);
    gr.addColorStop(0, '#e59a55'); gr.addColorStop(0.5, '#d7823c'); gr.addColorStop(1, '#c46d2c');
    g.fillStyle = gr; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 140; k++) {
      const vy = oy + rnd() * H, amp = 2 + rnd() * 7, f = 1 + Math.floor(rnd() * 2), ph = rnd() * 6.28;
      g.strokeStyle = hsl(22 + rnd() * 10, 55 + rnd() * 20, 30 + rnd() * 25, 0.18 + rnd() * 0.3); g.lineWidth = 0.6 + rnd() * 2.4;
      g.beginPath(); for (let x = 0; x <= H; x += 8) { const yy = vy + Math.sin(x / H * 6.283 * f + ph) * amp; x ? g.lineTo(ox + x, yy) : g.moveTo(ox, yy); } g.stroke();
    }
    for (let k = 0; k < 5; k++) { const kx = ox + rnd() * H, ky = oy + rnd() * H; for (let r = 14; r > 1; r -= 2.6) { g.strokeStyle = hsl(20, 60, 22 + r, 0.4); g.lineWidth = 1.4; g.beginPath(); g.ellipse(kx, ky, r * 1.8, r * 0.6, 0, 0, 6.283); g.stroke(); } }
    const sh = g.createLinearGradient(0, oy, 0, oy + H);          // vernice lucida: riflesso chiaro in alto, bordo scuro
    sh.addColorStop(0, 'rgba(255,236,200,0.35)'); sh.addColorStop(0.18, 'rgba(255,236,200,0)'); sh.addColorStop(0.9, 'rgba(60,20,0,0)'); sh.addColorStop(1, 'rgba(60,20,0,0.35)');
    g.fillStyle = sh; g.fillRect(ox, oy, H, H);
  }
  // 1 · marmo crema
  {
    const ox = H, oy = 0;
    g.fillStyle = '#e9dfc9'; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 900; k++) { g.fillStyle = hsl(38 + rnd() * 10, 25 + rnd() * 20, 78 + rnd() * 14, 0.25); const r = 2 + rnd() * 14; g.beginPath(); g.arc(ox + rnd() * H, oy + rnd() * H, r, 0, 6.283); g.fill(); }
    for (let k = 0; k < 14; k++) {
      let x = rnd() * H, y = rnd() * H, a = rnd() * 6.28;
      g.strokeStyle = hsl(30, 18, 55 + rnd() * 15, 0.25 + rnd() * 0.25); g.lineWidth = 0.6 + rnd() * 1.4;
      g.beginPath(); g.moveTo(ox + x, oy + y);
      for (let s2 = 0; s2 < 40; s2++) { a += (rnd() - 0.5) * 0.7; x = (x + Math.cos(a) * 9 + H) % H; y = (y + Math.sin(a) * 9 + H) % H; if (s2 % 9 === 8) { g.stroke(); g.beginPath(); g.moveTo(ox + x, oy + y); } else g.lineTo(ox + x, oy + y); }
      g.stroke();
    }
    // giunti dei blocchi (leggeri)
    g.strokeStyle = 'rgba(120,104,80,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox, oy + H / 2); g.lineTo(ox + H, oy + H / 2); g.moveTo(ox + H / 2, oy); g.lineTo(ox + H / 2, oy + H / 2); g.moveTo(ox + 4, oy + H / 2); g.lineTo(ox + 4, oy + H); g.stroke();
  }
  // 2 · acqua
  {
    const ox = 0, oy = H;
    const gr = g.createLinearGradient(0, oy, 0, oy + H); gr.addColorStop(0, '#9fdcf2'); gr.addColorStop(1, '#5fb8de');
    g.fillStyle = gr; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 220; k++) {
      const x = rnd() * H, y = rnd() * H, w = 10 + rnd() * 50;
      g.strokeStyle = `rgba(255,255,255,${0.15 + rnd() * 0.35})`; g.lineWidth = 1 + rnd() * 2.5;
      g.beginPath(); g.moveTo(ox + x, oy + y); g.quadraticCurveTo(ox + x + w / 2, oy + y - 4 - rnd() * 4, ox + x + w, oy + y); g.stroke();
    }
    for (let k = 0; k < 80; k++) { g.fillStyle = `rgba(30,90,140,${rnd() * 0.18})`; g.beginPath(); g.ellipse(ox + rnd() * H, oy + rnd() * H, 10 + rnd() * 30, 3 + rnd() * 6, 0, 0, 6.283); g.fill(); }
  }
  // 3 · ghisa nera
  {
    const ox = H, oy = H;
    g.fillStyle = '#1c1d20'; g.fillRect(ox, oy, H, H);
    for (let k = 0; k < 2500; k++) { const v = 20 + rnd() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(ox + rnd() * H, oy + rnd() * H, 2, 2); }
    const sh = g.createLinearGradient(ox, 0, ox + H, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.55, 'rgba(255,255,255,0.0)');
    g.fillStyle = sh; g.fillRect(ox, oy, H, H);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
export const civicAtlas = makeCivicAtlas();
export const civicMaterial = makeAtlasMaterial('civic', civicAtlas, { roughness: 0.5, metalness: 0.05 });

export const SHED = {
  W: 4.2, D: 3.6, WH: 2.5, RH: 1.35, floor: 0.3,
  door: { x: -0.525, w: 1.05, top: 2.7 },          // vano della porta sul lato +Z
  stove: { x: -1.55, z: -1.25, fireY: 0.62, fireZ: -0.97, pipeTop: 4.15 },
};
function makeShed() {
  const parts = [];
  const { W, D, WH, RH } = SHED, F = SHED.floor;
  const rnd = mulberry32(55);
  // v36: stile borgo medievale (come il riferimento): zoccolo in pietra, tavole grigie consumate, intelaiatura
  // di travi calde che sporgono, tetto spesso di ardesia azzurra e scuri con la croce
  const WH_ = '#ffffff';
  const PLANK = { tile: 0, ts: 1.6, jit: 0.05 }, STONE = { tile: 1, ts: 1.15, jit: 0.06 }, SLATE = { tile: 2, ts: 1.25, jit: 0.05, swap: true }, BEAM = { tile: 3, ts: 1.9, jit: 0.07, grain: true };
  // basamento in pietra (scende sotto terra per i pendii)
  parts.push(part(new THREE.BoxGeometry(W + 0.3, 1.1, D + 0.3), WH_, { ...STONE, y: -0.25 }));
  // pavimento a tavole
  const floorC = ['#7a5434', '#6e4b2e', '#83593a'];
  for (let i = 0; i < 9; i++) {
    const z = -D / 2 + 0.2 + (i + 0.5) * (D - 0.4) / 9;
    parts.push(part(new THREE.BoxGeometry(W - 0.2, 0.03, (D - 0.4) / 9 - 0.015), floorC[i % 3], { y: F + 0.015, z, jit: 0.05 }));
  }
  const dx0 = SHED.door.x - SHED.door.w / 2, dx1 = SHED.door.x + SHED.door.w / 2;
  // pareti di tavole (davanti si lascia il vano della porta)
  parts.push(part(new THREE.BoxGeometry(W, WH, 0.1), WH_, { ...PLANK, y: F + WH / 2, z: -(D / 2 - 0.05) }));
  parts.push(part(new THREE.BoxGeometry(dx0 + W / 2, WH, 0.1), WH_, { ...PLANK, x: (-W / 2 + dx0) / 2, y: F + WH / 2, z: D / 2 - 0.05 }));
  parts.push(part(new THREE.BoxGeometry(W / 2 - dx1, WH, 0.1), WH_, { ...PLANK, x: (W / 2 + dx1) / 2, y: F + WH / 2, z: D / 2 - 0.05 }));
  parts.push(part(new THREE.BoxGeometry(SHED.door.w, F + WH - SHED.door.top, 0.1), WH_, { ...PLANK, x: SHED.door.x, y: (SHED.door.top + F + WH) / 2, z: D / 2 - 0.05 }));
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.1, WH, D), WH_, { ...PLANK, x: sx * (W / 2 - 0.05), y: F + WH / 2 }));
  // zoccolo di pietra all'esterno fino a ~1 m (davanti interrotto dalla porta)
  const SK = 1.0, skH = SK - 0.25, skY = 0.25 + skH / 2;
  parts.push(part(new THREE.BoxGeometry(W + 0.3, skH, 0.16), WH_, { ...STONE, y: skY, z: -(D / 2 + 0.03) }));
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.16, skH, D + 0.3), WH_, { ...STONE, x: sx * (W / 2 + 0.03), y: skY }));
  parts.push(part(new THREE.BoxGeometry(dx0 - 0.1 + W / 2 + 0.15, skH, 0.16), WH_, { ...STONE, x: (-W / 2 - 0.15 + dx0 - 0.1) / 2, y: skY, z: D / 2 + 0.03 }));
  parts.push(part(new THREE.BoxGeometry(W / 2 + 0.15 - dx1 - 0.1, skH, 0.16), WH_, { ...STONE, x: (W / 2 + 0.15 + dx1 + 0.1) / 2, y: skY, z: D / 2 + 0.03 }));
  // intelaiatura: montanti d'angolo, corrente sopra lo zoccolo e trave di banchina che sporgono
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.22, F + WH - SK + 0.05, 0.22), WH_, { ...BEAM, x: sx * (W / 2 + 0.01), y: (SK + F + WH) / 2, z: sz * (D / 2 + 0.01) }));
  for (const sz of [-1, 1]) parts.push(part(new THREE.BoxGeometry(W + 0.75, 0.24, 0.24), WH_, { ...BEAM, y: F + WH - 0.02, z: sz * (D / 2 + 0.04) }));
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.24, 0.24, D + 0.75), WH_, { ...BEAM, x: sx * (W / 2 + 0.04), y: F + WH + 0.0 }));
  parts.push(part(new THREE.BoxGeometry(W + 0.3, 0.16, 0.18), WH_, { ...BEAM, y: SK + 0.05, z: -(D / 2 + 0.06) }));
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.18, 0.16, D + 0.3), WH_, { ...BEAM, x: sx * (W / 2 + 0.06), y: SK + 0.05 }));
  parts.push(part(new THREE.BoxGeometry(dx0 - 0.1 + W / 2 + 0.15, 0.16, 0.18), WH_, { ...BEAM, x: (-W / 2 - 0.15 + dx0 - 0.1) / 2, y: SK + 0.05, z: D / 2 + 0.06 }));
  parts.push(part(new THREE.BoxGeometry(W / 2 + 0.15 - dx1 - 0.1, 0.16, 0.18), WH_, { ...BEAM, x: (W / 2 + 0.15 + dx1 + 0.1) / 2, y: SK + 0.05, z: D / 2 + 0.06 }));
  // controventi diagonali: parete di fondo e fianco sinistro (il destro ha la finestra)
  const top = F + WH - 0.15, bot = SK + 0.12;
  const brace = (a0, a1, alongX, side) => {
    const dl = a1 - a0, dy = top - bot, len = Math.hypot(dl, dy), ang = Math.atan2(dl, dy), mid = (a0 + a1) / 2;
    if (alongX) parts.push(part(new THREE.BoxGeometry(0.15, len, 0.12), WH_, { ...BEAM, x: mid, y: (top + bot) / 2, z: side, rz: -ang }));
    else parts.push(part(new THREE.BoxGeometry(0.12, len, 0.15), WH_, { ...BEAM, x: side, y: (top + bot) / 2, z: mid, rx: ang }));
  };
  brace(-W / 2 + 0.2, -0.35, true, -(D / 2 + 0.07)); brace(W / 2 - 0.2, 0.35, true, -(D / 2 + 0.07));
  brace(-D / 2 + 0.2, -0.3, false, -(W / 2 + 0.07)); brace(D / 2 - 0.2, 0.3, false, -(W / 2 + 0.07));
  for (const [x, z, w, d] of [[0, -(D / 2 + 0.07), 0.15, 0.12], [-(W / 2 + 0.07), 0, 0.12, 0.15]]) parts.push(part(new THREE.BoxGeometry(w, top - bot + 0.1, d), WH_, { ...BEAM, x, y: (top + bot) / 2, z }));
  // stipiti e architrave della porta
  for (const x of [dx0 - 0.06, dx1 + 0.06]) parts.push(part(new THREE.BoxGeometry(0.14, SHED.door.top - F + 0.1, 0.2), WH_, { ...BEAM, x, y: (SHED.door.top + F) / 2 + 0.05, z: D / 2 - 0.03 }));
  parts.push(part(new THREE.BoxGeometry(SHED.door.w + 0.5, 0.2, 0.22), WH_, { ...BEAM, x: SHED.door.x, y: SHED.door.top + 0.1, z: D / 2 - 0.02 }));
  parts.push(part(new THREE.BoxGeometry(SHED.door.w + 0.3, 0.1, 0.45), WH_, { ...STONE, x: SHED.door.x, y: F - 0.0, z: D / 2 + 0.17 }));   // soglia
  // timpani triangolari di tavole, con il monaco e le tavole di gronda che si incrociano in cima
  const slope = Math.atan2(RH, W / 2 + 0.3), sl = Math.hypot(W / 2 + 0.3, RH) + 0.1;
  for (const sz of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, RH); shape.lineTo(-W / 2, 0);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    parts.push(part(g, WH_, { ...PLANK, y: F + WH, z: sz * (D / 2) - (sz > 0 ? 0.1 : 0) }));
    parts.push(part(new THREE.BoxGeometry(0.15, RH - 0.15, 0.12), WH_, { ...BEAM, y: F + WH + (RH - 0.15) / 2, z: sz * (D / 2 + 0.05) }));
    for (const sx of [-1, 1]) {
      const L = sl + 0.55, dir = new THREE.Vector2(-sx * Math.cos(slope), Math.sin(slope));
      const cx = sx * (W / 4 + 0.15) + dir.x * 0.3, cy = F + WH + RH / 2 + 0.2 + dir.y * 0.3;
      parts.push(part(new THREE.BoxGeometry(L, 0.22, 0.13), WH_, { ...BEAM, x: cx, y: cy, z: sz * (D / 2 + 0.4), rz: -sx * slope }));
    }
  }
  parts.push(part(new THREE.BoxGeometry(0.14, 0.16, D - 0.1), '#5e3f22', { y: F + WH + RH - 0.25 }));
  // tetto spesso di ardesia, con le teste dei puntoni sotto la gronda
  for (const sx of [-1, 1]) {
    parts.push(part(new THREE.BoxGeometry(sl + 0.3, 0.17, D + 0.75), WH_, { ...SLATE, x: sx * ((W / 2 + 0.3) / 2 + 0.05), y: F + WH + RH / 2 + 0.06, rz: -sx * slope }));
    parts.push(part(new THREE.BoxGeometry(sl, 0.03, D - 0.1), '#8a6440', { x: sx * (W / 4 + 0.05), y: F + WH + RH / 2 - 0.1, rz: -sx * slope, jit: 0.05 }));   // assito (da dentro)
    for (let k = 0; k < 6; k++) parts.push(part(new THREE.BoxGeometry(0.6, 0.12, 0.12), WH_, { ...BEAM, x: sx * (W / 2 + 0.25), y: F + WH + 0.08, z: -D / 2 - 0.1 + k * (D + 0.2) / 5, rz: -sx * slope }));
  }
  parts.push(part(new THREE.BoxGeometry(0.26, 0.24, D + 0.95), WH_, { ...BEAM, y: F + WH + RH + 0.08 }));
  // finestre con cornice di legno e scuri aperti con la croce
  const win = (x, y, z, ry) => {
    const c = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz = 0) => ({ x: x + lx * c + lz * sn, z: z - lx * sn + lz * c });
    parts.push(part(new THREE.BoxGeometry(0.9, 0.7, 0.14), '#5f8fae', { x, y, z, ry, jit: 0.02 }));
    parts.push(part(new THREE.BoxGeometry(1.08, 0.12, 0.2), WH_, { ...BEAM, ...at(0, 0.02), y: y + 0.41, ry }));
    parts.push(part(new THREE.BoxGeometry(1.08, 0.12, 0.2), WH_, { ...BEAM, ...at(0, 0.02), y: y - 0.41, ry }));
    for (const s of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.1, 0.82, 0.18), WH_, { ...BEAM, ...at(s * 0.49, 0.02), y, ry }));
    parts.push(part(new THREE.BoxGeometry(0.05, 0.7, 0.16), '#3a2a1a', { x, y, z, ry }));
    for (const s of [-1, 1]) {
      const p0 = at(s * 0.76, 0.1);
      parts.push(part(new THREE.BoxGeometry(0.42, 0.84, 0.05), '#e6d2bc', { ...BEAM, ...p0, y, ry }));
      const ang = Math.atan2(0.42, 0.84);
      for (const d of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.06, 0.9, 0.04), '#9c7a5c', { ...BEAM, ...at(s * 0.76, 0.14), y, ry, rz: d * ang, post: null }));
      for (const yy of [-0.36, 0.36]) parts.push(part(new THREE.BoxGeometry(0.42, 0.07, 0.04), '#9c7a5c', { ...BEAM, ...at(s * 0.76, 0.14), y: y + yy, ry }));
    }
  };
  win(1.05, 1.75, D / 2 - 0.04, 0);
  win(W / 2 - 0.04, 1.75, 0.3, Math.PI / 2);
  // fioriera sotto la finestra
  parts.push(part(new THREE.BoxGeometry(1.0, 0.22, 0.25), WH_, { ...BEAM, x: 1.05, y: 1.18, z: D / 2 + 0.2 }));
  for (let i = 0; i < 4; i++) parts.push(part(new THREE.IcosahedronGeometry(0.11, 1), ['#e04a6a', '#f2c230', '#e86a3a', '#c04dff'][i], { x: 0.7 + i * 0.23, y: 1.35, z: D / 2 + 0.2, jit: 0.1 }));
  // lanterna accanto alla porta
  const lx = dx0 - 0.42, lz = D / 2 + 0.05;
  parts.push(part(new THREE.BoxGeometry(0.05, 0.05, 0.26), '#2b2a28', { x: lx, y: 2.45, z: lz + 0.1 }));
  parts.push(part(new THREE.BoxGeometry(0.17, 0.24, 0.17), '#2b2a28', { x: lx, y: 2.28, z: lz + 0.22 }));
  parts.push(part(new THREE.BoxGeometry(0.13, 0.17, 0.19), '#ffd27a', { x: lx, y: 2.28, z: lz + 0.22, jit: 0, noSky: true }));
  parts.push(part(new THREE.BoxGeometry(0.19, 0.17, 0.13), '#ffd27a', { x: lx, y: 2.28, z: lz + 0.22, jit: 0, noSky: true }));
  parts.push(part(new THREE.ConeGeometry(0.14, 0.12, 4), '#2b2a28', { x: lx, y: 2.46, z: lz + 0.22, ry: Math.PI / 4 }));
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
// v35: gli alberi a foglie hanno due geometrie: legno (materiale degli alberi) e fogliame (LEAVES, materiale delle foglie)
const LEAFY = { pine: makePine(), oak: makeOak(), birch: makeBirch(), snowPine: makeSnowPine(), autumnOak: makeAutumnOak(), autumnBirch: makeAutumnBirch() };
const BUSHES = [makeBush(401), makeBush(433, null, ['#5aa83c', '#68b844', '#78c64c', '#509c38']), makeBush(467, ['#f2f2f2', '#ffe066']), makeBush(491, ['#e86fa8', '#c77dff'], ['#418a34', '#4e9a3c', '#5aa844', '#3c8031'])];
export const LEAVES = { bushes: BUSHES.map((b) => b.leaf) };
for (const [k, t] of Object.entries(LEAFY)) LEAVES[k] = t.leaf;
export const PROPS = {
  pine: LEAFY.pine.wood, oak: LEAFY.oak.wood, birch: LEAFY.birch.wood,
  pineLow: makePineLow(), oakLow: makeOakLow(), birchLow: makeBirchLow(),
  snowPine: LEAFY.snowPine.wood, snowPineLow: makeSnowPineLow(), autumnOak: LEAFY.autumnOak.wood, autumnOakLow: makeAutumnOakLow(),
  autumnBirch: LEAFY.autumnBirch.wood, autumnBirchLow: makeAutumnBirchLow(), palm: makePalm(), palmLow: makePalmLow(),
  cactus: makeCactus(), cactusLow: makeCactusLow(), deadTree: makeDeadTree(), deadTreeLow: makeDeadTreeLow(),
  rocks: [makeRock(5, 0), makeRock(17, 0), makeRock(29, 1), makeRock(41, 2), makeRock(53, 3)],
  pebbles: makePebbles(),
  bushes: BUSHES.map((b) => b.wood),
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
          // v33: raffiche. Un fronte d'onda lento attraversa l'isola (da sud-ovest) ogni 20-30 s: in mezzo
          // la vegetazione quasi ferma, quando passa la raffica si piega, ondeggia forte e le foglie fremono
          float front = uWind * 0.32 - dot(ip, vec2(0.6, 0.8)) * 0.012;
          float gust = pow(max(0.0, sin(front) * 0.6 + sin(front * 0.43 + 1.9) * 0.4), 3.0);
          float amp = 0.35 + gust * 2.4;
          transformed.x += ((sin(ph) * 0.7 + sin(ph * 2.3 + 1.7) * 0.3) * amp + gust * 1.3) * k;
          transformed.z += ((cos(ph * 0.83 + 0.6) * 0.5) * amp + gust * 1.0) * k;
          // fremito delle foglie: piccolo e veloce, diverso per ogni vertice
          float fl = sin(uWind * 9.0 + position.x * 4.1 + position.z * 3.3 + position.y * 2.7) * min(hh, 1.0) * (0.012 + gust * 0.05) * ${(amount > 0.02 ? 0.6 : 1).toFixed(2)};
          transformed += normal * fl;
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
  mat.customProgramCacheKey = () => 'wind33-' + key;
  return mat;
}
/**
 * v33: texture procedurali per alberi e cespugli. Foglie: ciuffi chiari/scuri, nervature di piccole foglie,
 * bordi più luminosi verso il cielo (luce che passa) e ombra interna verso il tronco; corteccia: solchi
 * verticali ondulati e nodi. Tutto rumore 3D liscio che si spegne con la distanza (niente sfarfallio).
 */
function addFoliageDetail(mat, bush) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFP;\nvarying vec3 vFN;\nvarying float vFH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vFP = position + vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]) * 0.37;
        #else
          vFP = position;
        #endif
        vFN = normal; vFH = position.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFP;
        varying vec3 vFN;
        varying float vFH;
        float folH;
        ${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 c = vColor.rgb;
          float fw = length(fwidth(vFP));
          float leafy = smoothstep(0.95, 1.25, c.g / max(c.r, 0.001)) + smoothstep(0.55, 0.8, c.r) * smoothstep(0.25, 0.4, c.g) * (1.0 - step(c.r * 1.6, c.g));   // verdi (e foglie autunnali/neve chiara)
          leafy = clamp(leafy, 0.0, 1.0);
          float barky = (1.0 - leafy) * step(c.b, c.g) * step(c.g, c.r);
          // foglie: ciuffi grandi + foglioline piccole (si attenuano da lontano)
          float clump = rFbm(vFP * ${bush ? '1.6' : '0.9'}, fw * ${bush ? '1.6' : '0.9'});
          vec3 lp = vFP * ${bush ? '9.0' : '6.0'};
          float fa = 1.0 - smoothstep(0.25, 0.8, length(fwidth(lp)));
          float leaf = (rNoise(lp) - 0.5) * fa;
          float vein = smoothstep(0.42, 0.5, abs(fract(rNoise(lp * 0.5 + 3.1) * 4.0) - 0.5)) * fa;
          vec3 nn = normalize(vFN);
          float skyLit = smoothstep(-0.2, 0.9, nn.y);
          float leafMul = (1.0 + clump * 0.55 + leaf * 0.32 - vein * 0.07) * mix(0.78, 1.1, skyLit);
          vec3 leafTint = mix(vec3(1.0), vec3(1.06, 1.08, 0.86), smoothstep(0.1, 0.35, clump));   // ciuffi al sole più gialli
          // corteccia: solchi verticali ondulati e nodi
          vec3 bq = vFP * vec3(7.0, 1.1, 7.0);
          float ba = 1.0 - smoothstep(0.3, 0.9, length(fwidth(bq)));
          float groove = 0.5 + 0.5 * sin((rNoise(bq) * 5.0 + rNoise(vFP * vec3(2.0, 0.35, 2.0)) * 3.0) * 3.14159);
          float knot = smoothstep(0.78, 0.9, rNoise(vFP * 2.6 + 11.0)) * ba;
          float barkMul = mix(0.9, mix(0.72, 1.08, smoothstep(0.2, 0.85, groove)), ba) * (1.0 - knot * 0.25) * (1.0 + rFbm(vFP * 1.5, fw * 1.5) * 0.3);
          vec3 col = diffuseColor.rgb;
          col = mix(col, col * leafTint * leafMul, leafy);
          col = mix(col, col * barkMul, barky);
          // ombra di contatto alla base
          col *= mix(0.72, 1.0, smoothstep(0.0, ${bush ? '0.35' : '0.9'}, vFH));
          diffuseColor.rgb = col;
          folH = leafy * (clump * 0.25 + leaf * 0.18) + barky * (groove * 0.18 * ba + knot * 0.1);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(folH), dhy = dFdy(folH);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2) * 0.6);
        }`);
  };
  return mat;
}
export const treeMaterial = addWind(addFoliageDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02, flatShading: true }), false), 2.2, 0.0045, 'tree');
export const bushMaterial = addWind(addFoliageDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, flatShading: true }), true), 0.3, 0.07, 'bush');
/**
 * v35: materiale delle carte di foglie. Alpha test sul ritaglio, doppia faccia SENZA ribaltare la normale
 * sul retro (le normali sferiche della chioma valgono per entrambe le facce → luce morbida e gonfia),
 * e un po' di luce che "passa" attraverso le foglie in controluce.
 */
function makeLeafMaterial(bush) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTexture, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.0 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * ${bush ? '0.08' : '0.11'};`);
  };
  return m;
}
export const leafMaterial = addWind(makeLeafMaterial(false), 2.2, 0.0045, 'leaf');
/** v36: cactus lisci (normali per vertice, niente sfaccettature) e un filo di lucido */
export const cactusMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0 });
/** materiale per tipo di albero (versione dettagliata): di base treeMaterial */
export const TREE_MATS = { cactus: cactusMaterial };   // v52: + deadTree: barkMaterial (sotto)
export const bushLeafMaterial = addWind(makeLeafMaterial(true), 0.3, 0.07, 'bushleaf');

/** roccia con texture di pietra proiettata sui 3 assi (coordinate oggetto) */
// v46: roccia fotografica (granito con licheni e muschio) campionata in triplanare; se manca, la marezzatura di prima
// v47: la foto arriva in parallelo al resto del gioco: la texture si assegna appena è pronta (prima di costruire l'isola)
let rockPhoto = null, rockMean = [0.5, 0.5, 0.5];
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
export const rockMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.0, flatShading: true });
photosReady.then(() => {
  rockPhoto = photoTexture('rock');
  if (rockPhoto) rockMean = photoMeanLinear('rock');
  rockMaterial.map = rockPhoto || makeStoneTexture();
  rockMaterial.needsUpdate = true;
});
rockMaterial.onBeforeCompile = (sh) => {
  sh.uniforms.rockMean = { value: new THREE.Vector3(...rockMean) };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 aSurf;\nvarying vec3 vOP;\nvarying vec3 vON;\nvarying vec2 vSurf;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal; vSurf = aSurf;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
        varying vec3 vOP;
        varying vec3 vON;
        varying vec2 vSurf;
        uniform vec3 rockMean;
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
        vec3 tp = P * 0.3;
        ${rockPhoto ? `
        vec3 c3 = texture2D(map, tp.yz).rgb * w.x + texture2D(map, tp.xz).rgb * w.y + texture2D(map, tp.xy).rgb * w.z;
        vec3 rrel = clamp(c3 / rockMean, 0.3, 1.8);
        float rl = dot(rrel, vec3(0.299, 0.587, 0.114));
        float t = clamp(rl * 0.5, 0.0, 1.0);
        float rNear = 1.0 - smoothstep(50.0, 180.0, length(vViewPosition));` : `
        float t = texture2D(map, tp.yz).r * w.x + texture2D(map, tp.xz).r * w.y + texture2D(map, tp.xy).r * w.z;`}
        // strati della roccia: bande morbide e ondulate, sfumate se troppo fitte per lo schermo
        float sp = P.y * 2.2 + n1 * 5.0;
        float bandAA = 1.0 - smoothstep(0.4, 1.2, fwidth(sp));
        float strata = (0.5 + 0.5 * sin(sp)) * bandAA + 0.5 * (1.0 - bandAA);
        float tone = (1.0 + n1 * 0.36 + n2 * 0.14) * (0.94 + 0.1 * t) * (0.94 + 0.1 * strata);
        diffuseColor.rgb *= clamp(tone, 0.55, 1.2);
        ${rockPhoto ? 'diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(rl), rrel, 0.6), 0.75 * (0.45 + 0.55 * rNear));' : ''}
        // muschio (prati, boschi) e neve (montagna) sulle facce rivolte verso l'alto, con bordo irregolare
        float up = nn.y + n1 * 0.9 + n2 * 0.4;
        float moss = vSurf.y * smoothstep(0.42, 0.72, up);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.30, 0.09) * (0.85 + n2 * 0.8 + t * 0.3), moss);
        float snow = clamp(vSurf.x, 0.0, 1.0) * smoothstep(0.5, 0.78, up);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.77, 0.82) * (0.97 + n2 * 0.1), snow);
        diffuseColor.rgb = min(diffuseColor.rgb, vec3(0.8));            // mai bianco abbagliante
        rockH = (n1 * 0.6 + n2 * 0.4) * (1.0 - snow * 0.7);
        // v52: niente rilievo preso dalla foto: la derivata di una texture filtrata è a gradini (i "quadretti" e la grana
        // a puntini sulle rocce); il rilievo resta quello del rumore liscio, la foto dà solo colore e chiaroscuro
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
rockMaterial.customProgramCacheKey = () => 'rock-v22' + (rockPhoto ? 'p52' : '');

/**
 * v52: materiali fotografici per gli oggetti "tondi" (silo, ciminiere) e per gli alberi secchi.
 *  · cylPhotoMaterial: foto avvolta attorno all'asse verticale dell'oggetto (coordinate cilindriche, senza cucitura
 *    visibile: le derivate si prendono dall'angolo continuo), tinta dal colore dei vertici. Niente rilievo a rumore
 *    (era quello a dare i "quadretti" scuri sul silo).
 *  · barkMaterial: corteccia fotografica proiettata sui 3 assi, ombreggiatura liscia (prima: righe lucide e quasi nero).
 */
function cylPhotoMaterial(name, key, { tile = 1.6, around = 8, rough = 0.7, metal = 0.1, sat = 0.75, k = 1 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
  let mean = [0.5, 0.5, 0.5], has = false;
  photosReady.then(() => { const t = photoTexture(name); if (t) { mat.map = t; mean = photoMeanLinear(name); has = true; mat.needsUpdate = true; } });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.pMean = { value: new THREE.Vector3(...mean) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCP;\nuniform vec3 pMean;')
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', `#include <color_fragment>
      ${has ? `{
        float a1 = atan(vCP.z, vCP.x), a2 = atan(-vCP.z, -vCP.x);
        vec2 g1 = vec2(dFdx(a1), dFdy(a1)), g2 = vec2(dFdx(a2), dFdy(a2));
        vec2 ga = dot(g1, g1) < dot(g2, g2) ? g1 : g2;
        float ka = ${around.toFixed(2)} / 6.28318;
        vec2 uv = vec2(a1 * ka, vCP.y / ${tile.toFixed(2)});
        vec3 ph = textureGrad(map, uv, vec2(ga.x * ka, dFdx(uv.y)), vec2(ga.y * ka, dFdy(uv.y))).rgb;
        vec3 rel = clamp(ph / pMean, 0.2, 2.2);
        float rl = dot(rel, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb *= mix(vec3(rl), rel, ${sat.toFixed(2)}) * ${k.toFixed(2)};
      }` : ''}`);
  };
  mat.customProgramCacheKey = () => 'cyl52-' + key + (has ? 'p' : '');
  return mat;
}
export const siloMaterial = cylPhotoMaterial('metal', 'silo', { tile: 1.8, around: 7, rough: 0.55, metal: 0.25, sat: 0.8 });
export const stackMaterial = cylPhotoMaterial('brick', 'stack', { tile: 1.4, around: 5, rough: 0.9, metal: 0.0, sat: 0.6 });

export const barkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
{
  let has = false;
  photosReady.then(() => { const t = photoTexture('bark'); if (t) { barkMaterial.map = t; has = true; barkMaterial.needsUpdate = true; } });
  barkMaterial.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBP;\nvarying vec3 vBN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position; vBN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBP;\nvarying vec3 vBN;\nfloat barkH;\n${GLSL_NOISE}\nfloat rFbmB(vec3 p) { return rFbm(p, length(fwidth(p))); }`)
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        barkH = 0.0;
        ${has ? `
        vec3 w = abs(normalize(vBN)); w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z);
        vec3 tp = vBP * vec3(1.6, 0.8, 1.6);   // fessure allungate in verticale
        vec3 b = texture2D(map, tp.zy).rgb * w.x + texture2D(map, tp.xz).rgb * w.y + texture2D(map, tp.xy).rgb * w.z;
        // la foto dà il dettaglio; il colore del vertice (legno secco, grigio-bruno) dà la tinta
        float lb = dot(b, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(lb), b, 0.8) * vec3(1.12, 1.0, 0.88) * 1.45 * (dot(diffuseColor.rgb, vec3(0.333)) / 0.106);
        barkH = rFbmB(vBP * vec3(6.0, 1.2, 6.0)) * 0.12;` : ''}
        diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 0.8, vBP.y));   // terra e ombra alla base
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
        float dhx = dFdx(barkH), dhy = dFdy(barkH);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
        float det = dot(dpx, r1);
        normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2) * 0.5);
      }`);
  };
  barkMaterial.customProgramCacheKey = () => 'bark52' + (has ? 'p' : '');
}

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
      if (key === 'tree') { for (const k of TREE_KINDS) { PROPS[k] = PROPS[k + 'Low'] = geo; LEAVES[k] = null; } }
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
TREE_MATS.deadTree = barkMaterial;   // v52: albero secco con la corteccia fotografica
