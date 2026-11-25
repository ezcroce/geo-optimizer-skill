// Modelli 3D low‑poly: personaggi con skin, armi e deltaplani
import * as THREE from 'three';
import { normalFromHeight, NORMALS } from './texgen.js?v=11';
/** normal map ricavata dalla trama (cache per texture) */
function nrm(t, k = 1.2) { if (!NORMALS) return null; if (!t.userData.n) { t.userData.n = normalFromHeight(t.image, k); t.userData.n.repeat.copy(t.repeat); } return t.userData.n; }
import { WEAPONS, RARITIES, HATS, BACKPACKS } from './config.js?v=11';
import { mergeParts } from './props.js?v=11';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
  matCache.set(key, m);
  return m;
}
// trama di tessuto condivisa (quasi bianca: moltiplica il colore della skin senza cambiarlo)
let _fabric = null;
function fabricTex() {
  if (_fabric) return _fabric;
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 1 : 0;          // intreccio diagonale
    const v = 236 + weave * 12 + (Math.random() - 0.5) * 18 - ((y % 16 === 0) ? 22 : 0);   // + cuciture
    const j = (y * S + x) * 4;
    d[j] = d[j + 1] = d[j + 2] = Math.max(0, Math.min(255, v)); d[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _fabric = new THREE.CanvasTexture(c);
  _fabric.wrapS = _fabric.wrapT = THREE.RepeatWrapping;
  _fabric.repeat.set(2, 2);
  _fabric.colorSpace = THREE.SRGBColorSpace;
  return _fabric;
}
function clothMat(color) {
  const key = 'cloth' + color;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, map: fabricTex(), normalMap: nrm(fabricTex(), 0.9), normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.85, metalness: 0.02 });
  matCache.set(key, m);
  return m;
}
function glowMat(color) {
  const key = 'glow' + color;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 });
  matCache.set(key, m);
  return m;
}

const boxGeoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!boxGeoCache.has(k)) boxGeoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return boxGeoCache.get(k);
}

function box(w, h, d, material, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(boxGeo(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

// ─────────────── Geometrie arrotondate condivise ───────────────
const geoCache = new Map();
function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); }
  return g;
}
const capsuleGeo = (r, len, seg = 8) => cachedGeo(`cap${r}|${len}|${seg}`, () => new THREE.CapsuleGeometry(r, len, 3, seg));
const sphereGeo = (ws = 12, hs = 9) => cachedGeo(`sph${ws}|${hs}`, () => new THREE.SphereGeometry(1, ws, hs));
const domeGeo = (theta = Math.PI / 2, ws = 16) => cachedGeo(`dome${theta.toFixed(3)}|${ws}`, () => new THREE.SphereGeometry(1, ws, 8, 0, Math.PI * 2, 0, theta));
const cylGeo = (rt, rb, h, seg = 10, open = false) => cachedGeo(`cyl${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const torusGeo = (r, t, seg = 16) => cachedGeo(`tor${r}|${t}|${seg}`, () => new THREE.TorusGeometry(r, t, 6, seg));
const coneGeo = (r, h, seg = 8) => cachedGeo(`cone${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
// busto: profilo ruotato (vita stretta, petto e spalle arrotondate) e schiacciato sui fianchi
const torsoGeo = (wide = 1) => cachedGeo('torso' + wide, () => {
  const pts = [[0.001, 0], [0.165, 0], [0.172, 0.08], [0.178, 0.16], [0.198, 0.26], [0.228, 0.36], [0.24, 0.44], [0.225, 0.5], [0.17, 0.555], [0.08, 0.585], [0.001, 0.59]]
    .map(([r, y]) => new THREE.Vector2(r * wide, y));
  const g = new THREE.LatheGeometry(pts, 14);
  g.scale(1, 1, 0.64);
  g.computeVertexNormals();
  return g;
});
// bacino: guscio arrotondato su cui si attaccano le gambe
const pelvisGeo = () => cachedGeo('pelvis', () => {
  const g = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.scale(0.19, 0.16, 0.125); g.rotateX(Math.PI); g.translate(0, 0.06, 0);
  return g;
});
// scarpa: suola piatta con punta arrotondata
const shoeGeo = () => cachedGeo('shoe', () => {
  const g = new THREE.CapsuleGeometry(0.06, 0.15, 3, 8);
  g.rotateX(Math.PI / 2); g.scale(1, 0.85, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.02) p.setY(i, -0.02 - (p.getY(i) + 0.02) * 0.25);   // suola piatta
  g.computeVertexNormals();
  return g;
});

// gamba dei pantaloni larghi: si gonfia sotto il ginocchio e si stringe alla caviglia (nelle bende)
const widePantGeo = () => cachedGeo('widePant', () => {
  const pts = [[0.001, -0.33], [0.06, -0.33], [0.075, -0.3], [0.098, -0.22], [0.1, -0.12], [0.092, -0.03], [0.085, 0.02], [0.001, 0.03]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 12); g.computeVertexNormals(); return g;
});

/** unisce più geometrie (normali lisce e uv conservate) in una sola: una draw call */
const _mm = new THREE.Matrix4(), _mq = new THREE.Quaternion(), _me = new THREE.Euler(), _ms = new THREE.Vector3(), _mp = new THREE.Vector3();
function mergeSmooth(list) {
  const pos = [], nor = [], uv = [];
  for (const [geo, o = {}] of list) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    _me.set(o.rx || 0, o.ry || 0, o.rz || 0); _mq.setFromEuler(_me);
    _ms.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1); _mp.set(o.x || 0, o.y || 0, o.z || 0);
    g.applyMatrix4(_mm.compose(_mp, _mq, _ms));
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i));
      uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
// mano con palmo, quattro dita leggermente piegate e pollice (side = -1 sinistra, 1 destra)
const handGeo = (side) => cachedGeo('hand' + side, () => {
  const parts = [[new THREE.SphereGeometry(1, 12, 9), { y: -0.04, z: 0.004, sx: 0.054, sy: 0.058, sz: 0.042 }]];
  const lens = [0.03, 0.038, 0.041, 0.034];
  for (let i = 0; i < 4; i++) {
    const x = (-0.031 + i * 0.0205) * side, L = lens[i];
    parts.push([new THREE.CapsuleGeometry(0.0128, L, 2, 6), { x, y: -0.094 - L * 0.4, z: 0.016 + L * 0.25, rx: -0.45, rz: (i - 1.5) * 0.06 * side }]);
  }
  parts.push([new THREE.CapsuleGeometry(0.0155, 0.032, 2, 6), { x: -0.05 * side, y: -0.05, z: 0.032, rx: -0.7, rz: 0.4 * side }]);
  return mergeSmooth(parts);
});
const darker = (hex, k = 0.78) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

function mesh(geo, material, x = 0, y = 0, z = 0, parent = null, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
const sph = (r, material, x, y, z, parent, sy = 1, sz = 1, ws = 12, hs = 9) => mesh(sphereGeo(ws, hs), material, x, y, z, parent, r, r * sy, r * sz);

// ─────────────── Texture dei personaggi ───────────────
function noiseCanvas(S, base, amt, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  if (draw) draw(g, S);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _denim = null, _leather = null, _brushed = null, _knit = null;
/** tela diagonale da jeans (grigio chiaro: si moltiplica per il colore dei pantaloni) */
function denimTex() {
  return _denim || (_denim = noiseCanvas(64, '#e4e4e4', 22, (g, S) => {
    g.lineWidth = 1;
    for (let i = -S; i < S * 2; i += 3) { g.strokeStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.1})`; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.setLineDash([2, 2]);
    g.beginPath(); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S); g.stroke();   // cucitura laterale
    g.setLineDash([]);
  }));
}
/** cuoio con pori e piccole pieghe */
function leatherTex() {
  return _leather || (_leather = noiseCanvas(64, '#dcdcdc', 30, (g, S) => {
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.08})`; g.beginPath(); const x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); g.quadraticCurveTo(x + rnd(-6, 6), y + rnd(-3, 3), x + rnd(-10, 10), y + rnd(-4, 4)); g.stroke(); }
  }));
}
/** metallo spazzolato per armature */
function brushedTex() {
  return _brushed || (_brushed = noiseCanvas(64, '#e8e8e8', 12, (g, S) => {
    for (let i = 0; i < 90; i++) { const y = Math.random() * S; g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + rnd(-1, 1)); g.stroke(); }
  }));
}
/** maglia di lana (cuffie, sciarpe) */
function knitTex() {
  return _knit || (_knit = noiseCanvas(32, '#e8e8e8', 16, (g, S) => {
    for (let x = 0; x < S; x += 4) for (let y = 0; y < S; y += 4) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x + 1.5, y, 1, 4); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y + ((x / 4) % 2) * 2, 1, 2); }
  }));
}
function texMat(kind, color, opts = {}) {
  const key = kind + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const map = kind === 'denim' ? denimTex() : kind === 'leather' ? leatherTex() : kind === 'knit' ? knitTex() : brushedTex();
  const m = new THREE.MeshStandardMaterial({ color, map, normalMap: nrm(map, kind === 'metal' ? 0.4 : 1.2), normalScale: new THREE.Vector2(0.6, 0.6), roughness: kind === 'metal' ? 0.3 : kind === 'leather' ? 0.55 : 0.85, metalness: kind === 'metal' ? 0.85 : 0.03, ...opts });
  matCache.set(key, m);
  return m;
}

/**
 * Texture della testa (sfera): pelle, capelli dipinti, occhi, sopracciglia, bocca.
 * Sulla sfera di three.js u=0.25 è la faccia (+Z) e la parte alta della texture è la cima della testa.
 */
const faceCache = new Map();
function faceMaterial(skin) {
  if (faceCache.has(skin.id)) return faceCache.get(skin.id);
  // si disegna in coordinate 256×128 su una tela al doppio della risoluzione (occhi anime nitidi)
  const W = 256, H = 128, RS = 2;
  const c = document.createElement('canvas'); c.width = W * RS; c.height = H * RS;
  const g = c.getContext('2d'); g.scale(RS, RS);
  const e = document.createElement('canvas'); e.width = W * RS; e.height = H * RS;
  const ge = e.getContext('2d'); ge.scale(RS, RS);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const mask = skin.acc === 'ninja';
  const robot = skin.id === 'robot';
  const base = mask ? skin.shirt : skin.skin;
  // pelle con sfumature (guance più calde, ombra sotto il mento)
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * (robot ? 8 : 10); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  const FX = 64;   // centro della faccia
  if (!mask && !robot && skin.id !== 'banana') {
    const grd = g.createRadialGradient(FX - 22, 74, 1, FX - 22, 74, 12); grd.addColorStop(0, 'rgba(230,90,80,0.22)'); grd.addColorStop(1, 'rgba(230,90,80,0)');
    g.fillStyle = grd; g.fillRect(FX - 40, 60, 30, 30);
    const grd2 = g.createRadialGradient(FX + 22, 74, 1, FX + 22, 74, 12); grd2.addColorStop(0, 'rgba(230,90,80,0.22)'); grd2.addColorStop(1, 'rgba(230,90,80,0)');
    g.fillStyle = grd2; g.fillRect(FX + 8, 60, 30, 30);
  }
  g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, 108, W, 20);
  if (skin.faceMask) {
    // maschera di stoffa sotto gli occhi che avvolge tutta la parte bassa della testa
    g.fillStyle = skin.faceMask;
    g.beginPath(); g.moveTo(0, 70); g.lineTo(FX - 26, 70); g.quadraticCurveTo(FX, 62, FX + 26, 70); g.lineTo(W, 70); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 71.5); g.lineTo(FX - 26, 71.5); g.quadraticCurveTo(FX, 63.5, FX + 26, 71.5); g.lineTo(W, 71.5); g.stroke();
    // cucitura centrale e trama leggera del tessuto
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.moveTo(FX, 67); g.lineTo(FX, 112); g.stroke();
    for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * W, 70 + Math.random() * 58, 1.2, 1.2); }
  }
  // capelli dipinti: cima e nuca (con basette); il ciuffo vero è una mesh
  const hair = skin.hair && !mask && !robot ? skin.hair : null;
  if (hair) {
    g.fillStyle = hair;
    g.fillRect(0, 0, W, 30);
    g.beginPath(); g.moveTo(FX + 30, 28); g.quadraticCurveTo(FX + 44, 66, FX + 50, 82); g.lineTo(W, 82); g.lineTo(W, 28); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(FX - 30, 28); g.quadraticCurveTo(FX - 44, 66, FX - 50, 82); g.lineTo(0, 82); g.lineTo(0, 28); g.closePath(); g.fill();
    g.fillRect(FX + 50, 28, W, 60);
    // attaccatura sulla fronte, ciocche
    g.beginPath(); g.moveTo(FX - 32, 28); g.quadraticCurveTo(FX - 10, 40, FX, 34); g.quadraticCurveTo(FX + 12, 42, FX + 32, 28); g.lineTo(FX + 32, 20); g.lineTo(FX - 32, 20); g.fill();
    for (let i = 0; i < 160; i++) { const x = Math.random() * W, y = Math.random() * 80; if (y > 30 && Math.abs(x - FX) < 44) continue; g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.14)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y + rnd(4, 10)); g.stroke(); }
  }
  if (mask) {
    // passamontagna: fascia scoperta sugli occhi
    g.fillStyle = skin.skin; g.fillRect(FX - 36, 50, 72, 16);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(FX - 36, 49, 72, 2); g.fillRect(FX - 36, 65, 72, 2);
  }
  if (robot) {
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
    for (const x of [20, 108, 150, 200, 240]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.beginPath(); g.moveTo(0, 40); g.lineTo(W, 40); g.moveTo(0, 96); g.lineTo(W, 96); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.4)'; for (const [x, y] of [[24, 44], [104, 44], [24, 92], [104, 92]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  }
  if (skin.id === 'drago' || skin.id === 'zombie' || skin.id === 'spettro') {
    // squame / pelle a chiazze / brina
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      if (skin.id === 'drago') { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x, y, 4, 0.2, Math.PI - 0.2); g.stroke(); }
      else if (skin.id === 'zombie') { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,80,40,0.25)' : 'rgba(150,170,120,0.25)'; g.beginPath(); g.arc(x, y, rnd(2, 7), 0, 7); g.fill(); }
      else { g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x, y, 1.5, 1.5); }
    }
    if (skin.id === 'zombie') {   // punti di sutura
      g.strokeStyle = '#2a2a22'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(FX + 6, 30); g.lineTo(FX + 26, 46); g.stroke();
      for (let i = 0; i < 5; i++) { const x = FX + 8 + i * 4, y = 32 + i * 3.2; g.beginPath(); g.moveTo(x - 2, y + 2.5); g.lineTo(x + 2, y - 2.5); g.stroke(); }
    }
  }
  // occhi
  const glowEye = skin.acc === 'horns' ? '#ffb000' : skin.id === 'zombie' ? '#c8ff4a' : skin.id === 'spettro' ? '#9fe8ff' : robot ? skin.glow : null;
  const EY = 58;
  for (const s of [-1, 1]) {
    const ex = FX + s * 15;
    if (glowEye) {
      for (const gg of [g, ge]) {
        gg.fillStyle = glowEye; gg.beginPath();
        if (skin.id === 'drago') gg.ellipse(ex, EY, 5, 3.4, s * 0.25, 0, 7); else gg.ellipse(ex, EY, robot ? 6 : 4.6, robot ? 2.4 : 3.6, 0, 0, 7);
        gg.fill();
      }
      if (skin.id === 'drago') { g.fillStyle = '#200'; g.fillRect(ex - 0.8, EY - 3.2, 1.6, 6.4); }
      continue;
    }
    // occhi in stile anime: grandi, iride verticale sfumata, due riflessi e ciglia spesse
    const ic = skin.eyes || (skin.rarity % 2 ? '#3a7a4a' : '#5a3a22');
    const icDark = '#' + new THREE.Color(ic).multiplyScalar(0.42).getHexString();
    const icLight = '#' + new THREE.Color(ic).lerp(new THREE.Color('#ffffff'), 0.35).getHexString();
    g.fillStyle = '#fbf8f2'; g.beginPath(); g.ellipse(ex, EY, 6.4, 5.3, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(110,70,60,0.22)'; g.beginPath(); g.ellipse(ex, EY - 3.1, 6.2, 2.1, 0, 0, 7); g.fill();
    const ix = ex + s * 0.3, iy = EY + 0.5;
    const lg = g.createLinearGradient(0, iy - 4.7, 0, iy + 4.7);
    lg.addColorStop(0, icDark); lg.addColorStop(0.42, ic); lg.addColorStop(1, icLight);
    g.fillStyle = lg; g.beginPath(); g.ellipse(ix, iy, 3.7, 4.7, 0, 0, 7); g.fill();
    g.strokeStyle = icDark; g.lineWidth = 0.7; g.stroke();
    g.fillStyle = '#0b0b10'; g.beginPath(); g.ellipse(ix, iy + 0.3, 1.7, 2.4, 0, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ix - 1.3, iy - 1.9, 1.25, 1.5, -0.3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(ix + 1.25, iy + 2.1, 0.6, 0, 7); g.fill();
    // linea superiore spessa con codina esterna, ciglia inferiori sottili
    g.strokeStyle = '#1a0e0a'; g.lineCap = 'round';
    g.lineWidth = 2.1; g.beginPath(); g.ellipse(ex, EY + 0.3, 6.6, 5.6, 0, Math.PI * 1.07, Math.PI * 1.93); g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(ex + s * 6.1, EY - 1.4); g.lineTo(ex + s * 8.3, EY - 3.1); g.stroke();
    if (skin.lashes) { g.lineWidth = 1.1; g.beginPath(); g.moveTo(ex + s * 4.6, EY - 4.0); g.lineTo(ex + s * 6.4, EY - 6.0); g.stroke(); g.beginPath(); g.moveTo(ex + s * 6.8, EY + 0.2); g.lineTo(ex + s * 8.6, EY - 0.6); g.stroke(); }
    g.strokeStyle = 'rgba(70,35,28,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(ex, EY + 0.1, 5.4, 4.9, 0, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    g.lineCap = 'butt';
    // sopracciglia
    if (!mask) {
      const bt = skin.browTilt || 0;   // >0: sopracciglia aggrottate (sguardo deciso)
      g.strokeStyle = skin.beard || skin.hair || '#3a2a1a'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ex - s * 6, EY - 8.5 + bt * 2.2); g.quadraticCurveTo(ex, EY - 11 + bt * 0.6, ex + s * 6.5, EY - 9.5 - bt * 1.2 + (skin.id === 'agente' ? 1.5 : 0)); g.stroke();
      g.lineCap = 'butt';
    }
  }
  if (!mask && !robot && !skin.faceMask) {
    // bocca e ombra del naso
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(FX, 71, 3.5, 2, 0, 0, 7); g.fill();
    g.strokeStyle = skin.id === 'zombie' ? '#3a2a22' : '#8a3a30'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath();
    if (skin.id === 'zombie') { g.moveTo(FX - 8, 82); g.lineTo(FX - 3, 80); g.lineTo(FX + 2, 83); g.lineTo(FX + 8, 80); }
    else if (skin.id === 'drago') { g.moveTo(FX - 9, 80); g.quadraticCurveTo(FX, 84, FX + 9, 80); }
    else {
      // labbro inferiore pieno + linea della bocca
      g.fillStyle = 'rgba(190,90,80,0.45)'; g.beginPath(); g.moveTo(FX - 6, 81); g.quadraticCurveTo(FX, 88, FX + 6, 81); g.quadraticCurveTo(FX, 83.5, FX - 6, 81); g.fill();
      g.moveTo(FX - 7, 80); g.quadraticCurveTo(FX, 84.5, FX + 7, 80);
    }
    g.stroke();
    // fossette agli angoli della bocca
    if (skin.id !== 'zombie' && skin.id !== 'drago') { g.strokeStyle = 'rgba(120,50,40,0.35)'; g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.arc(FX + s * 8.2, 79.2, 1.6, s > 0 ? 2.2 : -0.6, s > 0 ? 3.6 : 0.9); g.stroke(); } }
    if (skin.id === 'drago') { g.fillStyle = '#f2f2e0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(FX + s * 6, 81); g.lineTo(FX + s * 4.5, 85); g.lineTo(FX + s * 3, 81.5); g.fill(); } }
  }
  if (skin.beard) {
    g.fillStyle = skin.beard;
    g.beginPath(); g.moveTo(FX - 34, 66); g.quadraticCurveTo(FX - 30, 100, FX, 104); g.quadraticCurveTo(FX + 30, 100, FX + 34, 66); g.lineTo(FX + 26, 66); g.quadraticCurveTo(FX + 14, 88, FX + 9, 77); g.lineTo(FX - 9, 77); g.quadraticCurveTo(FX - 14, 88, FX - 26, 66); g.fill();
    g.fillRect(FX - 11, 74, 22, 4);   // baffi
    for (let i = 0; i < 80; i++) { const x = FX + rnd(-30, 30), y = rnd(70, 102); g.strokeStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-1, 1), y + 3); g.stroke(); }
  }
  if (skin.acc === 'pirate') { g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(FX + 15, 50); g.lineTo(FX + 64, 30); g.moveTo(FX + 15, 66); g.lineTo(FX - 60, 40); g.stroke(); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const opts = { map, roughness: robot ? 0.35 : 0.62, metalness: robot ? 0.7 : 0.02 };
  if (glowEye) { const em = new THREE.CanvasTexture(e); em.colorSpace = THREE.SRGBColorSpace; Object.assign(opts, { emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 1.4 }); }
  const m = new THREE.MeshStandardMaterial(opts);
  faceCache.set(skin.id, m);
  return m;
}

// ─────────────── Proporzioni del personaggio ───────────────
// piedi a y=0 · anche a 0,9 · spalle a 1,4 · centro della testa a 1,8 (come le hitbox)
export const RIG = { hip: 0.9, thigh: 0.44, shin: 0.4, shoulderY: 0.5, shoulderX: 0.27, upper: 0.3, fore: 0.28, headY: 0.7 };
const HEAD_FULL = ['knight', 'astro', 'banana'];          // caschi che coprono tutta la testa
const HEAD_TOP = ['helmet', 'cap', 'capback', 'pirate'];  // copricapi che un cappello sostituisce

/**
 * Costruisce un personaggio umanoide con la skin indicata e, se c'è, il cappello e lo zaino scelti.
 * Il modello guarda verso +Z, i piedi sono a y=0. Articolazioni: anche/ginocchia/caviglie, spalle/gomiti.
 */
export function buildCharacter(skin, cos = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // ruota tutto (per caduta/morte)
  root.add(body);

  const metal = !!skin.metal;
  const shirtM = metal ? texMat('metal', skin.shirt) : clothMat(skin.shirt);
  const pantsM = metal ? texMat('metal', skin.pants) : texMat('denim', skin.pants);
  const skinM = mat(skin.skin, { roughness: 0.6 });
  const shoeM = texMat('leather', skin.shoes);
  const soleM = mat('#1a1a1a', { roughness: 0.9 });
  const darkM = mat('#111111');
  const gloveM = metal ? texMat('metal', skin.accColor || skin.shirt) : skin.gloves ? texMat('leather', skin.gloves) : skinM;

  // ── gambe: anca → ginocchio → caviglia ──
  const legs = [], knees = [], feet = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.105 * side, RIG.hip, 0);
    body.add(hip);
    const wk = skin.wide ? 1.13 : 1;   // pantaloni larghi da arti marziali
    mesh(capsuleGeo(0.098, 0.27), pantsM, 0, -0.21, 0, hip, 1.04 * wk, 1, wk);           // coscia
    const knee = new THREE.Group(); knee.position.y = -RIG.thigh; hip.add(knee);
    const shinM = skin.shorts ? skinM : pantsM;                                            // pantaloncini: gamba nuda
    if (skin.wide) mesh(widePantGeo(), pantsM, 0, 0, -0.005, knee);
    else mesh(capsuleGeo(0.075, 0.27), shinM, 0, -0.19, -0.005, knee, skin.shorts ? 0.86 : 1, 1, skin.shorts ? 0.86 : 1);   // stinco
    sph(skin.wide ? 0.088 : skin.shorts ? 0.066 : 0.074, shinM, 0, 0, 0.005, knee);       // ginocchio
    const ankle = new THREE.Group(); ankle.position.y = -RIG.shin; knee.add(ankle);
    mesh(shoeGeo(), shoeM, 0, -0.005, 0.05, ankle);
    mesh(boxGeo(0.125, 0.025, 0.27), soleM, 0, -0.045, 0.05, ankle);
    if (!skin.boots && !metal && !skin.tabi && !skin.flats) mesh(cachedGeo('laces', () => mergeSmooth([
      [new THREE.BoxGeometry(0.066, 0.008, 0.011), { y: 0.044, z: 0.035 }], [new THREE.BoxGeometry(0.06, 0.008, 0.011), { y: 0.042, z: 0.062 }],
      [new THREE.BoxGeometry(0.052, 0.008, 0.011), { y: 0.038, z: 0.089 }],
      [new THREE.BoxGeometry(0.128, 0.014, 0.1), { y: -0.008, z: 0.02 }],
    ])), mat('#f2f0ea', { roughness: 0.7 }), 0, -0.005, 0.05, ankle);
    if (skin.boots) mesh(cylGeo(0.088, 0.08, 0.2, 10), shoeM, 0, 0.07, 0, ankle);
    if (skin.tabi) mesh(cylGeo(0.082, 0.078, 0.1, 10), shoeM, 0, 0.025, 0, ankle);
    if (skin.kneepads) mesh(capsuleGeo(0.06, 0.04), mat(skin.kneepads), 0, 0, 0.065, knee, 1.1, 1, 0.6);
    if (skin.glow) mesh(boxGeo(0.03, 0.3, 0.02), glowMat(skin.glow), 0.04 * side, -0.2, 0.072, knee);
    if (skin.overalls) mesh(capsuleGeo(0.1, 0.25), clothMat(skin.overalls), 0, -0.2, 0, hip, 1.06, 1, 1.02);
    legs.push(hip); knees.push(knee); feet.push(ankle);
  }

  // ── busto ──
  const torso = new THREE.Group();
  torso.position.set(0, RIG.hip, 0);
  body.add(torso);
  mesh(pelvisGeo(), pantsM, 0, 0.04, 0, torso);
  const chestM = skin.vest ? shirtM : shirtM;
  mesh(torsoGeo(1), chestM, 0, 0.02, 0, torso);
  mesh(cylGeo(0.062, 0.07, 0.16, 10), mask(skin) ? shirtM : skin.faceMask ? mat(skin.faceMask, { roughness: 0.9 }) : skinM, 0, 0.64, 0, torso);   // collo
  // dettagli dei vestiti: colletto, orlo e bottoni (un'unica mesh), tasche posteriori
  const trimM = metal ? shirtM : clothMat(darker(skin.shirt, 0.72));
  if (!metal) {
    const plain = !skin.vest && !skin.tie && !skin.coat && !skin.overalls && !skin.glow;
    const tl = [[new THREE.TorusGeometry(0.088, 0.021, 6, 14), { y: 0.6, rx: Math.PI / 2, sz: 1, sy: 0.75 }]];
    if (!skin.belt && !skin.toolbelt && !skin.overalls) tl.push([new THREE.CylinderGeometry(0.176, 0.172, 0.045, 14, 1, true), { y: 0.1, sz: 0.66 }]);
    if (plain) for (const [y, z] of [[0.3, 0.137], [0.39, 0.152], [0.48, 0.152]]) tl.push([new THREE.SphereGeometry(0.011, 6, 4), { y, z, sz: 0.5 }]);
    mesh(cachedGeo('trim' + (skin.belt || skin.toolbelt || skin.overalls ? 0 : 1) + (plain ? 1 : 0), () => mergeSmooth(tl)), trimM, 0, 0, 0, torso);
    mesh(cachedGeo('pockets', () => mergeSmooth([
      [new THREE.BoxGeometry(0.075, 0.075, 0.012), { x: -0.075, y: -0.005, z: -0.112, rx: 0.35 }],
      [new THREE.BoxGeometry(0.075, 0.075, 0.012), { x: 0.075, y: -0.005, z: -0.112, rx: 0.35 }],
    ])), skin.overalls ? clothMat(darker(skin.overalls, 0.75)) : texMat('denim', darker(skin.pants, 0.7)), 0, 0, 0, torso);
  }
  if (skin.belt) mesh(cylGeo(0.178, 0.178, 0.06, 14), texMat('leather', skin.belt), 0, 0.07, 0, torso, 1, 1, 0.68);
  if (skin.belt) mesh(boxGeo(0.07, 0.05, 0.02), mat('#d8b040', { metalness: 0.8, roughness: 0.3 }), 0, 0.07, 0.125, torso);
  if (skin.tie) {
    mesh(boxGeo(0.14, 0.34, 0.02), mat('#f2f2f2'), 0, 0.42, 0.148, torso).rotation.x = -0.12;
    mesh(boxGeo(0.055, 0.3, 0.02), mat(skin.tie), 0, 0.4, 0.158, torso).rotation.x = -0.12;
  }
  if (skin.glow) {
    for (const x of [-0.11, 0.11]) mesh(boxGeo(0.035, 0.4, 0.02), glowMat(skin.glow), x, 0.33, 0.138 + 0.01, torso).rotation.x = -0.1;
    mesh(boxGeo(0.3, 0.035, 0.02), glowMat(skin.glow), 0, 0.46, 0.152, torso);
  }
  if (skin.torn) {
    mesh(boxGeo(0.12, 0.1, 0.02), mat('#3b4552'), 0.07, 0.25, 0.122, torso);
    mesh(boxGeo(0.1, 0.07, 0.02), skinM, -0.08, 0.38, 0.14, torso);
  }
  if (skin.coat) {
    // camice lungo aperto davanti
    const cm = clothMat('#f4f4f2');
    mesh(torsoGeo(1.06), cm, 0, 0.02, -0.004, torso);
    mesh(cylGeo(0.2, 0.25, 0.42, 12, true), mat('#f4f4f2', { side: THREE.DoubleSide, roughness: 0.85 }), 0, -0.16, -0.01, torso, 1, 1, 0.7);
    mesh(boxGeo(0.05, 0.42, 0.02), clothMat(skin.shirt), 0, 0.3, 0.158, torso).rotation.x = -0.1;
  }
  if (metal) {
    // spallacci e pettorale
    for (const s of [-1, 1]) mesh(domeGeo(Math.PI / 2, 12), texMat('metal', skin.accColor), 0.25 * s, 0.5, 0, torso, 0.13, 0.1, 0.13).rotation.z = -0.4 * s;
    mesh(cylGeo(0.2, 0.17, 0.28, 12), texMat('metal', skin.accColor), 0, 0.36, 0.02, torso, 1.05, 1, 0.7);
  }
  if (skin.vest) {
    // giubbotto tattico con tasche, radio e fibbie
    const vm = mat(skin.vest, { roughness: 0.9 });
    mesh(cylGeo(0.215, 0.19, 0.36, 12), vm, 0, 0.34, 0, torso, 1, 1, 0.72);
    for (const x of [-0.12, 0, 0.12]) {
      mesh(boxGeo(0.1, 0.11, 0.05), mat(skin.pouch || '#2e3324'), x, 0.26, 0.15, torso);
      mesh(boxGeo(0.1, 0.025, 0.055), mat('#1d2016'), x, 0.32, 0.152, torso);
    }
    mesh(boxGeo(0.06, 0.12, 0.05), darkM, -0.15, 0.44, 0.13, torso);
    mesh(cylGeo(0.006, 0.006, 0.14, 4), darkM, -0.13, 0.56, 0.13, torso);
  }
  if (skin.overalls) {
    const om = clothMat(skin.overalls);
    mesh(boxGeo(0.26, 0.2, 0.02), om, 0, 0.2, 0.13, torso).rotation.x = -0.05;
    for (const x of [-0.1, 0.1]) {
      mesh(boxGeo(0.05, 0.36, 0.02), om, x, 0.4, 0.14, torso).rotation.x = -0.12;
      mesh(boxGeo(0.05, 0.36, 0.02), om, x, 0.4, -0.14, torso).rotation.x = 0.12;
      mesh(sphereGeo(6, 4), mat('#e8c040', { metalness: 0.7, roughness: 0.3 }), x, 0.3, 0.145, torso, 0.018);
    }
    mesh(boxGeo(0.11, 0.08, 0.02), mat('#24508a'), 0, 0.2, 0.145, torso);
    mesh(cylGeo(0.008, 0.008, 0.1, 4), mat('#d8d8d8', { metalness: 0.8, roughness: 0.3 }), 0.03, 0.24, 0.15, torso);
  }
  if (skin.toolbelt) {
    mesh(cylGeo(0.185, 0.185, 0.06, 14), texMat('leather', '#4a3322'), 0, 0.07, 0, torso, 1, 1, 0.7);
    mesh(boxGeo(0.08, 0.1, 0.06), texMat('leather', '#5a4030'), -0.17, 0.02, 0.1, torso);
    mesh(boxGeo(0.07, 0.09, 0.06), texMat('leather', '#5a4030'), 0.17, 0.02, 0.1, torso);
    mesh(cylGeo(0.012, 0.012, 0.18, 5), mat('#b8b8b8', { metalness: 0.8, roughness: 0.3 }), 0.17, -0.06, 0.13, torso);
  }
  if (skin.scarf) {
    const sm = texMat('knit', skin.scarf);
    mesh(torusGeo(0.1, 0.045, 14), sm, 0, 0.6, 0.01, torso).rotation.x = Math.PI / 2 - 0.15;
    mesh(boxGeo(0.08, 0.26, 0.03), sm, -0.07, 0.46, 0.15, torso).rotation.set(-0.15, 0, 0.1);
  }
  if (skin.fur) mesh(torusGeo(0.15, 0.07, 14), mat(skin.fur, { roughness: 1 }), 0, 0.56, 0, torso, 1, 1, 0.8).rotation.x = Math.PI / 2;
  if (skin.chain) {
    mesh(torusGeo(0.12, 0.012, 18), mat(skin.chain, { metalness: 0.95, roughness: 0.2 }), 0, 0.46, 0.09, torso, 1, 1.2, 1).rotation.x = -0.35;
    mesh(cylGeo(0.035, 0.035, 0.012, 10), mat(skin.chain, { metalness: 0.95, roughness: 0.2 }), 0, 0.33, 0.15, torso).rotation.x = Math.PI / 2 - 0.2;
  }

  // ── zaino (della skin o scelto nell'armadietto) ──
  const backId = cos.back && cos.back !== 'none' ? cos.back : (skin.backpack ? 'skinpack' : null);
  if (backId) buildBack(backId, skin, torso, cos);

  // ── mantello ──
  let cape = null;
  if (skin.cape) {
    cape = new THREE.Group();
    cape.position.set(0, 0.56, -0.15);
    mesh(boxGeo(0.46, 1.0, 0.025), mat(skin.cape, { side: THREE.DoubleSide, map: fabricTex() }), 0, -0.5, 0, cape);
    mesh(cylGeo(0.03, 0.03, 0.46, 6), mat(skin.accColor || '#d8b040', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0.01, cape).rotation.z = Math.PI / 2;
    torso.add(cape);
  }

  // ── braccia: spalla → gomito → mano ──
  const arms = [], elbows = [], hands = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(RIG.shoulderX * side, RIG.shoulderY, 0);
    torso.add(sh);
    const upperM = skin.sleeveless ? skinM : shirtM;
    sph(skin.sleeveless ? 0.074 : 0.082, upperM, 0, 0, 0, sh);                             // spalla
    mesh(capsuleGeo(skin.sleeveless ? 0.062 : 0.07, 0.18), upperM, 0, -0.15, 0, sh);      // braccio
    const el = new THREE.Group(); el.position.y = -RIG.upper; sh.add(el);
    const sleeve = skin.short ? skinM : shirtM;
    mesh(capsuleGeo(skin.short ? 0.054 : 0.06, 0.17), sleeve, 0, -0.13, 0, el);          // avambraccio
    const hand = new THREE.Group(); hand.position.y = -RIG.fore; el.add(hand);
    mesh(handGeo(side), gloveM, 0, 0, 0, hand);                                           // mano con dita
    // polsini della manica
    if (!skin.short && !metal && !skin.glow && !skin.coat) mesh(cylGeo(0.064, 0.062, 0.035, 10), trimM, 0, -0.245, 0, el);
    if (skin.glow) mesh(cylGeo(0.064, 0.064, 0.03, 10), glowMat(skin.glow), 0, -0.2, 0, el);
    if (metal) mesh(cylGeo(0.072, 0.066, 0.14, 10), texMat('metal', skin.accColor), 0, -0.16, 0, el);
    arms.push(sh); elbows.push(el); hands.push(hand);
  }

  // ── testa ──
  const head = new THREE.Group();
  head.position.set(0, RIG.headY, 0);
  torso.add(head);
  const hasHat = cos.hat && cos.hat !== 'none' && !HEAD_FULL.includes(skin.acc) ? cos.hat : (skin.hat && !HEAD_FULL.includes(skin.acc) ? skin.hat : null);
  const eyeY = 0.25, FZ = 0.205;
  let lids = null;
  if (skin.banana) {
    mesh(capsuleGeo(0.2, 0.36, 12), faceMaterial(skin), 0, 0.33, 0, head, 1, 1, 1.02).rotation.z = 0.08;
  } else {
    mesh(sphereGeo(18, 14), faceMaterial(skin), 0, 0.225, 0, head, 0.2, 0.225, 0.205);
    if (!['astro', 'knight'].includes(skin.acc)) {
      if (skin.id !== 'robot') mesh(coneGeo(0.03, 0.07, 6), skin.acc === 'ninja' ? shirtM : skin.faceMask ? mat(skin.faceMask, { roughness: 0.9 }) : skinM, 0, 0.205, 0.215, head).rotation.x = Math.PI / 2 + 0.35;   // naso
      for (const s of [-1, 1]) sph(0.04, skin.acc === 'ninja' ? shirtM : skinM, 0.196 * s, 0.215, -0.01, head, 1.2, 0.6, 8, 6);   // orecchie
    }
    // palpebre: chiuse per un istante ogni tanto (sbattere le palpebre)
    if (!['astro', 'knight', 'visor', 'shades'].includes(skin.acc) && skin.id !== 'robot') {
      lids = mesh(cachedGeo('lids', () => mergeSmooth([
        [new THREE.SphereGeometry(1, 10, 6), { x: -0.071, ry: -0.36, sx: 0.033, sy: 0.024, sz: 0.012 }],
        [new THREE.SphereGeometry(1, 10, 6), { x: 0.071, ry: 0.36, sx: 0.033, sy: 0.024, sz: 0.012 }],
      ])), skin.acc === 'ninja' ? skinM : mat(darker(skin.skin, 0.92), { roughness: 0.6 }), 0, 0.258, 0.188, head);
      lids.castShadow = false; lids.visible = false;
    }
  }
  // ciuffo di capelli (volume sopra la texture)
  if (skin.hair && !hasHat && skin.hairStyle !== 'swept' && !HEAD_TOP.includes(skin.acc) && !['ninja', 'visor', 'knight', 'astro'].includes(skin.acc)) {
    const hm = mat(skin.hair, { roughness: 0.8 });
    const tuft = mesh(cachedGeo('hairFringe', () => {
      const parts = [[new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), {}]];
      // ciocche della frangia e sulla nuca
      for (let i = 0; i < 5; i++) parts.push([new THREE.ConeGeometry(0.22, 0.5, 5), { x: (i - 2) * 0.24, y: 0.3, z: 0.8, rx: 2.0 + (i % 2) * 0.15, rz: (i - 2) * 0.15 }]);
      for (let i = 0; i < 4; i++) parts.push([new THREE.ConeGeometry(0.26, 0.55, 5), { x: (i - 1.5) * 0.36, y: 0.25, z: -0.85, rx: -2.1, rz: (i - 1.5) * -0.2 }]);
      return mergeSmooth(parts);
    }), hm, 0, 0.27, -0.01, head, 0.212, 0.2, 0.218);
    tuft.rotation.x = -0.32;
    if (skin.id === 'spettro' || skin.id === 'vichingo') mesh(domeGeo(Math.PI * 0.55), hm, 0, 0.22, -0.03, head, 0.215, 0.24, 0.22).rotation.x = -0.6;
  }

  const accM = skin.accColor ? mat(skin.accColor) : darkM;
  const acc = hasHat && HEAD_TOP.includes(skin.acc) ? 'none' : skin.acc;
  switch (acc) {
    case 'helmet': {
      // elmetto con occhiali protettivi
      const hm = mat(skin.accColor, { roughness: 0.9 });
      mesh(domeGeo(Math.PI / 2), hm, 0, 0.28, 0, head, 0.245, 0.22, 0.255);
      mesh(cylGeo(0.255, 0.265, 0.035, 18), hm, 0, 0.28, 0, head, 1, 1, 1.04);
      mesh(cylGeo(0.252, 0.252, 0.035, 18, true), mat('#151515'), 0, 0.36, 0, head, 1, 1, 1.04);
      for (const s of [-1, 1]) mesh(cylGeo(0.05, 0.05, 0.03, 10), mat('#e0a040', { metalness: 0.6, roughness: 0.15 }), 0.075 * s, 0.37, 0.245, head).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) mesh(boxGeo(0.02, 0.2, 0.03), darkM, 0.2 * s, 0.17, 0.05, head);
      break;
    }
    case 'ponytail': {
      // frangia, coda di cavallo ed elastico
      const hm = mat(skin.hair, { roughness: 0.75 });
      mesh(domeGeo(Math.PI * 0.5), hm, 0, 0.25, -0.005, head, 0.214, 0.225, 0.22).rotation.x = -0.2;
      mesh(torusGeo(0.045, 0.018, 10), mat(skin.accColor || '#e04a6a'), 0, 0.31, -0.215, head).rotation.x = 0.5;
      const tail = mesh(capsuleGeo(0.055, 0.24), hm, 0, 0.14, -0.25, head);
      tail.rotation.x = 0.22;
      break;
    }
    case 'capback':
    case 'cap': {
      mesh(domeGeo(Math.PI / 2), accM, 0, 0.29, 0, head, 0.218, 0.17, 0.225);
      const brim = mesh(cylGeo(0.13, 0.13, 0.018, 14), accM, 0, 0.3, acc === 'cap' ? 0.21 : -0.21, head, 1, 1, 1.25);
      brim.rotation.x = acc === 'cap' ? 0.12 : -0.12;
      mesh(sphereGeo(6, 4), accM, 0, 0.46, 0, head, 0.02);
      if (acc === 'capback') mesh(boxGeo(0.07, 0.04, 0.02), mat('#ffffff'), 0, 0.34, 0.215, head);
      break;
    }
    case 'glasses': {
      // occhiali tondi da esploratore (un'unica mesh)
      mesh(cachedGeo('roundGlasses', () => mergeSmooth([
        [new THREE.TorusGeometry(0.041, 0.0055, 6, 18), { x: -0.072, ry: -0.32 }], [new THREE.TorusGeometry(0.041, 0.0055, 6, 18), { x: 0.072, ry: 0.32 }],
        [new THREE.TorusGeometry(0.022, 0.005, 5, 8, Math.PI), { y: 0.004, z: 0.008 }],
        [new THREE.BoxGeometry(0.008, 0.008, 0.19), { x: -0.168, y: 0.006, z: -0.09, ry: -0.18 }], [new THREE.BoxGeometry(0.008, 0.008, 0.19), { x: 0.168, y: 0.006, z: -0.09, ry: 0.18 }],
      ])), mat(skin.accColor || '#5a3a22', { roughness: 0.4, metalness: 0.3 }), 0, eyeY, FZ + 0.012, head);
      break;
    }
    case 'shades':
      for (const s of [-1, 1]) mesh(cylGeo(0.042, 0.042, 0.012, 12), mat('#050505', { metalness: 0.9, roughness: 0.1 }), 0.066 * s, eyeY, FZ + 0.01, head, 1.15, 1, 0.85).rotation.x = Math.PI / 2;
      mesh(boxGeo(0.04, 0.012, 0.012), mat('#222', { metalness: 0.9 }), 0, eyeY + 0.01, FZ + 0.012, head);
      for (const s of [-1, 1]) mesh(boxGeo(0.01, 0.012, 0.2), mat('#222', { metalness: 0.9 }), 0.19 * s, eyeY + 0.01, 0.1, head);
      break;
    case 'ninja':
      mesh(cylGeo(0.212, 0.212, 0.05, 18, true), mat(skin.accColor, { side: THREE.DoubleSide }), 0, 0.33, 0, head, 1, 1, 1.03);
      mesh(boxGeo(0.04, 0.03, 0.26), accM, 0.05, 0.31, -0.32, head).rotation.set(0.5, 0.2, 0);
      mesh(boxGeo(0.04, 0.03, 0.22), accM, -0.04, 0.29, -0.3, head).rotation.set(0.7, -0.2, 0);
      break;
    case 'pirate': {
      const hm = mat(skin.accColor, { roughness: 0.9 });
      mesh(domeGeo(Math.PI / 2), hm, 0, 0.3, 0, head, 0.22, 0.2, 0.22);
      const br = mesh(cylGeo(0.36, 0.36, 0.025, 3), hm, 0, 0.33, 0, head, 1, 1, 0.9); br.rotation.y = Math.PI;
      mesh(cylGeo(0.224, 0.224, 0.03, 16, true), mat('#c9a03a', { metalness: 0.5, roughness: 0.4 }), 0, 0.33, 0, head);
      mesh(cylGeo(0.04, 0.04, 0.014, 10), darkM, 0.075, eyeY, FZ + 0.004, head).rotation.x = Math.PI / 2;
      break;
    }
    case 'visor':
      mesh(new THREE.CylinderGeometry(0.218, 0.218, 0.075, 18, 1, true, -1.2, 2.4), glowMat(skin.accColor), 0, eyeY, 0, head, 1, 1, 1.04);
      mesh(domeGeo(Math.PI * 0.45), mat('#202040', { metalness: 0.5, roughness: 0.4 }), 0, 0.27, 0, head, 0.215, 0.2, 0.22);
      break;
    case 'astro': {
      const glass = new THREE.Mesh(sphereGeo(16, 12), new THREE.MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.32, metalness: 0.9, roughness: 0.05 }));
      glass.position.set(0, 0.23, 0); glass.scale.setScalar(0.32);
      head.add(glass);
      mesh(torusGeo(0.24, 0.05, 18), accM, 0, -0.01, 0, head).rotation.x = Math.PI / 2;
      break;
    }
    case 'banana':
      mesh(cylGeo(0.035, 0.05, 0.14, 6), accM, 0.02, 0.66, -0.02, head).rotation.z = -0.3;
      mesh(sphereGeo(8, 6), mat('#6b4a12'), 0, 0.03, 0, head, 0.12, 0.05, 0.12);
      break;
    case 'knight': {
      const km = texMat('metal', skin.accColor);
      mesh(sphereGeo(16, 12), km, 0, 0.23, 0, head, 0.24, 0.26, 0.25);
      mesh(boxGeo(0.28, 0.035, 0.03), darkM, 0, eyeY, 0.24, head);
      for (let i = -2; i <= 2; i++) mesh(boxGeo(0.014, 0.08, 0.02), darkM, i * 0.04, 0.15, 0.245, head);
      mesh(cylGeo(0.035, 0.035, 0.05, 8), km, 0, 0.5, 0, head);
      mesh(capsuleGeo(0.05, 0.25), mat('#c41a2a', { roughness: 0.95 }), 0, 0.56, -0.12, head, 1, 1, 1.6).rotation.x = 1.1;
      break;
    }
    case 'horns': {
      for (const s of [-1, 1]) {
        const h = mesh(coneGeo(0.05, 0.28, 8), accM, 0.13 * s, 0.45, -0.02, head);
        h.rotation.z = -0.55 * s; h.rotation.x = -0.25;
      }
      mesh(boxGeo(0.3, 0.035, 0.05), mat('#5e0a0f'), 0, 0.33, 0.18, head).rotation.x = -0.3;
      break;
    }
    default: break;
  }
  if (hasHat) buildHat(hasHat, skin, head);
  if (skin.hero) buildHero(skin, { legs, knees, feet, arms, elbows, hands, torso, head, skinM, shirtM, pantsM, hasHat });

  // Punto in cui l'arma viene impugnata
  const gunPivot = new THREE.Group();
  gunPivot.position.set(0.12, 0.43, 0.3);
  torso.add(gunPivot);

  root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });

  // versione semplificata per la distanza: un'unica mesh (una sola draw call)
  const lod = new THREE.Mesh(lodGeometry(skin, cos), lodMat);
  lod.castShadow = true;
  lod.visible = false;
  root.add(lod);

  return { root, body, legs, knees, feet, arms, elbows, hands, torso, head, gunPivot, cape, lod, lids };
}
function mask(skin) { return skin.acc === 'ninja'; }

// ─────────────── Eroi anime originali (Leo, Tamsin, Oren) ───────────────
// Riproducono i tre personaggi dello script Blender "original_anime_heroes_rigged.py"
// (stessi colori, convertiti da lineare a sRGB, e stessi accessori) con le proporzioni del gioco.
const TORSO_PROFILE = [[0.165, 0], [0.172, 0.08], [0.178, 0.16], [0.198, 0.26], [0.228, 0.36], [0.24, 0.44], [0.225, 0.5], [0.17, 0.555], [0.08, 0.585]];
function torsoR(y) {
  const t = y - 0.02, P = TORSO_PROFILE;
  if (t <= P[0][1]) return P[0][0];
  for (let i = 0; i < P.length - 1; i++) if (t <= P[i + 1][1]) { const k = (t - P[i][1]) / (P[i + 1][1] - P[i][1]); return P[i][0] + (P[i + 1][0] - P[i][0]) * k; }
  return P[P.length - 1][0];
}
/** punto sulla superficie del busto (coordinate del gruppo torso), davanti o dietro */
function onTorso(x, y, push = 0.006, back = false) {
  const r = torsoR(y), z = 0.64 * Math.sqrt(Math.max(r * r - x * x, 0)) + push;
  return new THREE.Vector3(x, y, back ? -z : z);
}
/** tubo che segue la superficie del busto (cinghie, bordi, cuciture) */
function surfTube(pts, r, push = 0.006, back = false, closed = false) {
  const v = pts.map(p => p.isVector3 ? p : onTorso(p[0], p[1], push, back));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v, closed), v.length * 6, r, 5, closed);
}
const heroGeo = (key, list) => cachedGeo('hero_' + key, () => mergeSmooth(list));

function buildHero(skin, P) {
  const { legs, knees, feet, arms, elbows, hands, torso, head, skinM, shirtM, pantsM } = P;
  const hairM = mat(skin.hair || '#333', { roughness: 0.7 });
  const goldM = mat(skin.gold || '#f0c860', { metalness: 0.85, roughness: 0.3 });
  const DS = THREE.DoubleSide;
  switch (skin.hero) {
    case 'leo': {
      // giacca da campo aperta: maglietta, listelli, tasche con bottoni, spalline
      const jd = clothMat(darker(skin.shirt, 0.74)), cream = clothMat('#f7f0de');
      const brass = mat('#ecc66a', { metalness: 0.85, roughness: 0.3 }), leather = texMat('leather', '#b9895c'), leatherD = texMat('leather', '#8f6448');
      mesh(sphereGeo(12, 10), cream, 0, 0.34, onTorso(0, 0.34, -0.014).z, torso, 0.05, 0.17, 0.028);
      const pockets = [], flaps = [], buttons = [];
      for (const sx of [-1, 1]) {
        for (const [px, py, hw, hh] of [[0.1, 0.41, 0.036, 0.042], [0.112, 0.13, 0.042, 0.048]]) {
          const p = onTorso(sx * px, py, 0.004), ry = Math.atan2(0.64 * sx * px, Math.sqrt(Math.max(torsoR(py) ** 2 - px * px, 1e-4))) * 1.0;
          pockets.push([new THREE.BoxGeometry(hw * 2, hh * 2, 0.012), { x: p.x, y: p.y, z: p.z, ry }]);
          flaps.push([new THREE.BoxGeometry(hw * 2 + 0.008, 0.024, 0.016), { x: p.x, y: p.y + hh * 0.88, z: p.z + 0.004, ry }]);
          buttons.push([new THREE.SphereGeometry(0.0075, 6, 4), { x: p.x, y: p.y + hh * 0.7, z: p.z + 0.012 }]);
        }
        flaps.push([new THREE.BoxGeometry(0.09, 0.016, 0.05), { x: sx * 0.19, y: 0.545, z: 0, rz: sx * -0.35 }]);   // spalline
      }
      mesh(heroGeo('leoPockets', pockets), shirtM, 0, 0, 0, torso);
      mesh(heroGeo('leoFlaps', flaps), jd, 0, 0, 0, torso);
      mesh(heroGeo('leoButtons', buttons), brass, 0, 0, 0, torso);
      mesh(cachedGeo('hero_leoPlacket', () => mergeSmooth([[surfTube([[0.052, 0.04], [0.054, 0.2], [0.056, 0.36], [0.05, 0.5], [0.04, 0.56]], 0.0065, 0.004), {}], [surfTube([[-0.052, 0.04], [-0.054, 0.2], [-0.056, 0.36], [-0.05, 0.5], [-0.04, 0.56]], 0.0065, 0.004), {}]])), jd, 0, 0, 0, torso);
      // bandana arancione con nodo
      mesh(heroGeo('leoBandana', [
        [new THREE.TorusGeometry(0.082, 0.03, 6, 16), { y: 0.62, rx: Math.PI / 2 }],
        [new THREE.ConeGeometry(0.055, 0.1, 4), { y: 0.565, z: 0.1, rx: Math.PI + 0.25, sz: 0.4 }],
        [new THREE.SphereGeometry(0.026, 8, 6), { y: 0.605, z: 0.1 }],
      ]), clothMat('#f29a48'), 0, 0, 0, torso);
      // borsa a tracolla: cinghia che gira sul busto + borsa sul fianco
      mesh(cachedGeo('hero_leoStrap', () => {
        const front = [[0.1, 0.52], [0.03, 0.4], [-0.05, 0.27], [-0.13, 0.15], [-0.19, 0.05]].map(([x, y]) => onTorso(x, y, 0.012));
        const back = front.slice().reverse().map(v => new THREE.Vector3(v.x, v.y, -v.z));
        const pts = [new THREE.Vector3(0.135, 0.585, 0), ...front, new THREE.Vector3(-0.235, 0.0, 0), ...back];
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 60, 0.012, 5, true);
      }), leather, 0, 0, 0, torso, 1, 1, 1);
      mesh(heroGeo('leoBag', [[new THREE.BoxGeometry(0.06, 0.14, 0.17), { x: -0.25, y: -0.04 }]]), leather, 0, 0, 0, torso);
      mesh(heroGeo('leoBagFlap', [[new THREE.BoxGeometry(0.068, 0.07, 0.176), { x: -0.253, y: 0.005 }]]), leatherD, 0, 0, 0, torso);
      sph(0.012, brass, -0.29, -0.01, 0, torso);
      // maniche arrotolate al gomito, orologio al polso
      for (let i = 0; i < 2; i++) mesh(cylGeo(0.075, 0.075, 0.055, 12), jd, 0, -0.275, 0, arms[i]);
      mesh(torusGeo(0.056, 0.009, 14), leather, 0, -0.235, 0, elbows[0]).rotation.x = Math.PI / 2;
      mesh(cylGeo(0.017, 0.017, 0.01, 10), brass, 0, -0.235, 0.06, elbows[0]).rotation.x = Math.PI / 2;
      // pantaloncini cargo: orlo e tasconi laterali; calzettoni a righe
      const shortsD = clothMat(darker(skin.pants, 0.78)), sock = clothMat('#f8f6f0'), stripe = clothMat('#e0574c');
      for (let i = 0; i < 2; i++) {
        const sx = i ? 1 : -1;
        mesh(cylGeo(0.104, 0.104, 0.03, 14, true), shortsD, 0, -0.375, 0, legs[i]);
        mesh(heroGeo('leoCargo' + sx, [[new THREE.BoxGeometry(0.03, 0.11, 0.11), { x: sx * 0.098, y: -0.2 }], [new THREE.BoxGeometry(0.034, 0.026, 0.118), { x: sx * 0.1, y: -0.14 }]]), shortsD, 0, 0, 0, legs[i]);
        mesh(cylGeo(0.068, 0.066, 0.13, 12), sock, 0, -0.17, -0.005, knees[i]);
        mesh(heroGeo('leoStripes', [[new THREE.TorusGeometry(0.068, 0.005, 5, 14), { y: -0.115, rx: Math.PI / 2 }], [new THREE.TorusGeometry(0.0675, 0.005, 5, 14), { y: -0.14, rx: Math.PI / 2 }]]), stripe, 0, 0, -0.005, knees[i]);
        mesh(heroGeo('leoToe', [[new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { y: 0.0, z: 0.15, sx: 0.064, sy: 0.04, sz: 0.06 }]]), texMat('leather', darker(skin.shoes, 0.75)), 0, 0, 0, feet[i]);
      }
      // riccioli che spuntano sotto il cappello (o sulla testa se il cappello è tolto)
      mesh(cachedGeo('hero_leoCurls', () => {
        const parts = [], rnd = mulberryLocal(7);
        for (let a = 70; a <= 290; a += 20) {
          const r = a * Math.PI / 180, y = 0.27 + (rnd() - 0.5) * 0.04;
          parts.push([new THREE.IcosahedronGeometry(1, 1), { x: Math.sin(r) * 0.2, y, z: Math.cos(r) * 0.205, s: 0.04 + rnd() * 0.01 }]);
        }
        for (let a = 120; a <= 240; a += 24) { const r = a * Math.PI / 180; parts.push([new THREE.IcosahedronGeometry(1, 1), { x: Math.sin(r) * 0.19, y: 0.2, z: Math.cos(r) * 0.2, s: 0.04 }]); }
        for (let i = -2; i <= 2; i++) parts.push([new THREE.IcosahedronGeometry(1, 1), { x: i * 0.04, y: 0.33 - Math.abs(i) * 0.008, z: 0.188 - Math.abs(i) * 0.012, s: 0.027 }]);
        return mergeSmooth(parts);
      }), hairM, 0, 0, 0, head);
      break;
    }
    case 'tamsin': {
      const cream = clothMat('#f3ecdc'), wrapD = mat('#c9bfae', { roughness: 0.9 }), sash = clothMat('#2c2c34');
      // casacca senza maniche con colletto alla coreana e finiture oro
      mesh(cylGeo(0.076, 0.082, 0.06, 14), shirtM, 0, 0.63, 0, torso);
      mesh(cachedGeo('hero_tamsinGold', () => mergeSmooth([
        [surfTube([[0.05, 0.6], [0.02, 0.5], [-0.01, 0.41], [-0.05, 0.29], [-0.1, 0.18], [-0.13, 0.11]], 0.0065, 0.006), {}],
        [new THREE.TorusGeometry(0.078, 0.006, 5, 16), { y: 0.66, rx: Math.PI / 2 }],
        [new THREE.TorusGeometry(0.076, 0.0065, 5, 16), { x: -0.252, y: 0.5, ry: Math.PI / 2 }],
        [new THREE.TorusGeometry(0.076, 0.0065, 5, 16), { x: 0.252, y: 0.5, ry: Math.PI / 2 }],
      ])), goldM, 0, 0, 0, torso);
      // fascia in vita con nodo e due code
      mesh(heroGeo('tamsinSash', [
        [new THREE.CylinderGeometry(0.188, 0.184, 0.075, 16), { y: 0.1, sz: 0.7 }],
        [new THREE.SphereGeometry(0.036, 8, 6), { x: 0.1, y: 0.1, z: 0.122 }],
        [new THREE.BoxGeometry(0.036, 0.2, 0.012), { x: 0.088, y: -0.02, z: 0.124, rz: 0.08 }],
        [new THREE.BoxGeometry(0.036, 0.22, 0.012), { x: 0.118, y: -0.03, z: 0.118, rz: -0.14 }],
      ]), sash, 0, 0, 0, torso);
      // bende su avambracci, mani e caviglie
      for (let i = 0; i < 2; i++) {
        mesh(cylGeo(0.06, 0.057, 0.2, 10), cream, 0, -0.15, 0, elbows[i]);
        mesh(heroGeo('tamsinArmWrap', [0, 1, 2, 3, 4].map(k => [new THREE.TorusGeometry(0.0595, 0.0035, 4, 14), { y: -0.07 - k * 0.04, rx: Math.PI / 2 + 0.32 }])), wrapD, 0, 0, 0, elbows[i]);
        mesh(torusGeo(0.045, 0.012, 12), cream, 0, -0.035, 0, hands[i], 1.25, 1, 1).rotation.x = Math.PI / 2;
        mesh(cylGeo(0.063, 0.06, 0.1, 10), cream, 0, -0.355, -0.005, knees[i]);
        mesh(heroGeo('tamsinLegWrap', [0, 1, 2].map(k => [new THREE.TorusGeometry(0.062, 0.0035, 4, 14), { y: -0.32 - k * 0.03, rx: Math.PI / 2 + 0.3 }])), wrapD, 0, 0, -0.005, knees[i]);
      }
      // treccia lunga con anello d'oro e nappa
      mesh(cachedGeo('hero_braid', () => {
        const parts = [];
        for (let i = 0; i < 12; i++) {
          const r = 0.047 - i * 0.0014;
          parts.push([new THREE.SphereGeometry(1, 10, 7), { x: i % 2 ? 0.011 : -0.011, y: 0.9 - i * 0.056, z: -0.205, rz: i % 2 ? 0.45 : -0.45, sx: r, sy: r * 1.35, sz: r * 0.8 }]);
        }
        parts.push([new THREE.ConeGeometry(0.03, 0.1, 7), { y: 0.2, z: -0.205, rx: Math.PI }]);
        return mergeSmooth(parts);
      }), hairM, 0, 0, 0, torso);
      mesh(torusGeo(0.026, 0.008, 12), goldM, 0, 0.255, -0.205, torso).rotation.x = Math.PI / 2;
      // ciocche ai lati del viso e orecchini
      mesh(heroGeo('tamsinLocks', [
        [new THREE.CapsuleGeometry(0.026, 0.15, 2, 6), { x: -0.183, y: 0.17, z: 0.085, rz: -0.12, rx: 0.12 }],
        [new THREE.CapsuleGeometry(0.026, 0.15, 2, 6), { x: 0.183, y: 0.17, z: 0.085, rz: 0.12, rx: 0.12 }],
      ]), hairM, 0, 0, 0, head);
      mesh(heroGeo('tamsinEarrings', [[new THREE.TorusGeometry(0.013, 0.003, 4, 10), { x: -0.205, y: 0.175, z: -0.01, ry: Math.PI / 2 }], [new THREE.TorusGeometry(0.013, 0.003, 4, 10), { x: 0.205, y: 0.175, z: -0.01, ry: Math.PI / 2 }]]), goldM, 0, 0, 0, head);
      break;
    }
    case 'oren': {
      const cloakM = mat('#256168', { roughness: 0.85, map: fabricTex(), side: DS }), cloakD = clothMat('#184a50');
      const scarfM = texMat('knit', '#9a3046'), steel = texMat('metal', '#aab3be'), leather = texMat('leather', '#8d6e50');
      const wrapM = clothMat('#a9b0b5'), wrapD = mat('#858c92', { roughness: 0.9 }), wood = texMat('leather', '#9c7a58');
      // mantellina con cappuccio abbassato e bordo d'oro
      mesh(cachedGeo('hero_capelet', () => {
        const g = new THREE.LatheGeometry([[0.335, 0.355], [0.305, 0.42], [0.272, 0.5], [0.215, 0.57], [0.135, 0.63], [0.1, 0.665]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
        g.scale(1, 1, 0.74); g.computeVertexNormals(); return g;
      }), cloakM, 0, 0, 0, torso);
      mesh(torusGeo(0.335, 0.008, 28), goldM, 0, 0.355, 0, torso, 1, 0.74, 1).rotation.x = Math.PI / 2;
      mesh(sphereGeo(12, 9), cloakD, 0, 0.62, -0.16, torso, 0.12, 0.07, 0.075);   // cappuccio abbassato
      // sciarpa rossa con coda lunga sulla schiena
      mesh(heroGeo('orenScarf', [
        [new THREE.TorusGeometry(0.09, 0.033, 6, 16), { y: 0.6, rx: Math.PI / 2 }],
        [new THREE.TorusGeometry(0.082, 0.03, 6, 16), { y: 0.645, rx: Math.PI / 2 }],
        [new THREE.BoxGeometry(0.088, 0.6, 0.024), { x: 0.05, y: 0.3, z: -0.245, rx: 0.05, rz: 0.06 }],
      ]), scarfM, 0, 0, 0, torso);
      sph(0.017, goldM, 0, 0.63, 0.112, torso, 1, 0.4);
      // tasche sulla cintura (dietro) e fondina sulla coscia destra
      mesh(heroGeo('orenPouches', [[new THREE.BoxGeometry(0.07, 0.08, 0.045), { x: -0.11, y: 0.05, z: -0.125, ry: 0.5 }], [new THREE.BoxGeometry(0.07, 0.08, 0.045), { x: 0.11, y: 0.05, z: -0.125, ry: -0.5 }]]), leather, 0, 0, 0, torso);
      mesh(heroGeo('orenHolster', [
        [new THREE.BoxGeometry(0.035, 0.13, 0.08), { x: -0.105, y: -0.19 }],
        [new THREE.CylinderGeometry(0.106, 0.106, 0.02, 14, 1, true), { y: -0.13 }],
        [new THREE.CylinderGeometry(0.102, 0.102, 0.02, 14, 1, true), { y: -0.25 }],
      ]), leather, 0, 0, 0, legs[0]);
      // parabracci d'acciaio con cinghie
      for (let i = 0; i < 2; i++) {
        mesh(cylGeo(0.07, 0.062, 0.16, 10), steel, 0, -0.15, 0, elbows[i]);
        mesh(heroGeo('orenBracer', [[new THREE.CylinderGeometry(0.074, 0.074, 0.022, 10, 1, true), { y: -0.09 }], [new THREE.CylinderGeometry(0.068, 0.068, 0.022, 10, 1, true), { y: -0.21 }]]), leather, 0, 0, 0, elbows[i]);
        // bende alle gambe e stivali tabi (punta divisa)
        mesh(cylGeo(0.07, 0.064, 0.22, 10), wrapM, 0, -0.235, -0.005, knees[i]);
        mesh(heroGeo('orenLegWrap', [0, 1, 2, 3].map(k => [new THREE.TorusGeometry(0.069, 0.004, 4, 14), { y: -0.15 - k * 0.05, rx: Math.PI / 2 + 0.28 }])), wrapD, 0, 0, -0.005, knees[i]);
        mesh(boxGeo(0.008, 0.012, 0.09), mat('#2a2a30'), (i ? 1 : -1) * -0.014, 0.036, 0.15, feet[i]).rotation.x = 0.3;
      }
      // bastone di legno sulla schiena
      const staff = new THREE.Group(); staff.position.set(0.015, 0.33, -0.27); staff.rotation.z = -0.5; torso.add(staff);
      mesh(cylGeo(0.018, 0.018, 1.0, 8), wood, 0, 0, 0, staff);
      mesh(heroGeo('staffCaps', [[new THREE.CylinderGeometry(0.021, 0.021, 0.06, 8), { y: 0.48 }], [new THREE.CylinderGeometry(0.021, 0.021, 0.06, 8), { y: -0.48 }]]), steel, 0, 0, 0, staff);
      mesh(heroGeo('staffWrap', [-0.05, 0, 0.05].map(y => [new THREE.CylinderGeometry(0.021, 0.021, 0.022, 8), { y }])), leather, 0, 0, 0, staff);
      // capelli argento pettinati all'indietro, ciocche laterali e ciuffo sulla fronte
      mesh(cachedGeo('hero_orenHair', () => {
        const parts = [[new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), { y: 0.24, sx: 0.215, sy: 0.235, sz: 0.226, rx: -0.32 }]];
        for (let i = -2; i <= 2; i++) parts.push([new THREE.ConeGeometry(0.06, 0.22, 5), { x: i * 0.072, y: 0.3 - Math.abs(i) * 0.025, z: -0.2, rx: -2.05, rz: i * 0.12 }]);
        for (const sx of [-1, 1]) parts.push([new THREE.ConeGeometry(0.05, 0.18, 5), { x: sx * 0.185, y: 0.25, z: -0.07, rx: -2.4, rz: sx * 0.3 }]);
        // ciuffo che ricade sulla fronte: ciocche appiattite che seguono la curva della testa
        parts.push([new THREE.ConeGeometry(0.034, 0.13, 5), { x: -0.06, y: 0.335, z: 0.178, rx: Math.PI - 0.5, rz: 0.12, sz: 0.45 }]);
        parts.push([new THREE.ConeGeometry(0.03, 0.11, 5), { x: -0.11, y: 0.335, z: 0.158, rx: Math.PI - 0.55, rz: -0.12, sz: 0.45 }]);
        return mergeSmooth(parts);
      }), hairM, 0, 0, 0, head);
      break;
    }
    default: break;
  }
}
function mulberryLocal(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** cappelli sbloccabili (config HATS) */
function buildHat(id, skin, head) {
  const H = HATS.find(h => h.id === id) || { color: '#444' };
  const c = mat(H.color, { roughness: 0.8 }), a = mat(H.accent || '#ffffff', { roughness: 0.6 });
  const g = new THREE.Group(); g.position.y = 0.3; head.add(g);
  switch (id) {
    case 'cap':
      mesh(domeGeo(Math.PI / 2), c, 0, -0.01, 0, g, 0.218, 0.17, 0.225);
      mesh(cylGeo(0.13, 0.13, 0.018, 14), c, 0, 0, 0.21, g, 1, 1, 1.25).rotation.x = 0.12;
      break;
    case 'beanie': {
      const k = texMat('knit', H.color);
      mesh(domeGeo(Math.PI / 2), k, 0, -0.03, 0, g, 0.222, 0.22, 0.228).rotation.x = -0.12;
      mesh(cylGeo(0.226, 0.226, 0.06, 18), texMat('knit', '#f2f2f2'), 0, -0.04, 0, g, 1, 1, 1.03);
      sph(0.06, texMat('knit', '#f2f2f2'), 0, 0.2, -0.03, g);
      break;
    }
    case 'cowboy': {
      const l = texMat('leather', H.color);
      mesh(cylGeo(0.36, 0.36, 0.02, 20), l, 0, 0.02, 0, g, 1, 1, 0.85).rotation.x = 0.04;
      mesh(cylGeo(0.15, 0.2, 0.17, 14), l, 0, 0.11, 0, g, 1, 1, 1.1);
      mesh(cylGeo(0.2, 0.2, 0.035, 14), mat('#2a1a10'), 0, 0.045, 0, g, 1, 1, 1.1);
      break;
    }
    case 'headphones':
      mesh(torusGeo(0.22, 0.022, 16), c, 0, -0.08, 0, g, 1, 1.05, 1).rotation.y = Math.PI / 2;
      for (const s of [-1, 1]) {
        mesh(cylGeo(0.075, 0.075, 0.06, 14), c, 0.22 * s, -0.08, 0, g).rotation.z = Math.PI / 2;
        mesh(cylGeo(0.05, 0.05, 0.065, 12), glowMat(H.accent), 0.225 * s, -0.08, 0, g).rotation.z = Math.PI / 2;
      }
      break;
    case 'straw': {
      const st = mat(H.color, { roughness: 0.95, map: fabricTex() });
      mesh(cylGeo(0.38, 0.4, 0.02, 20), st, 0, 0, 0, g);
      mesh(cylGeo(0.18, 0.21, 0.13, 16), st, 0, 0.07, 0, g);
      mesh(cylGeo(0.215, 0.215, 0.035, 16), mat('#c0302a'), 0, 0.03, 0, g);
      break;
    }
    case 'tophat':
      mesh(cylGeo(0.3, 0.3, 0.02, 20), c, 0, 0, 0, g);
      mesh(cylGeo(0.18, 0.17, 0.34, 18), c, 0, 0.17, 0, g);
      mesh(cylGeo(0.181, 0.181, 0.05, 18), a, 0, 0.05, 0, g);
      break;
    case 'viking': {
      const vm = texMat('metal', H.color);
      mesh(domeGeo(Math.PI / 2), vm, 0, -0.03, 0, g, 0.235, 0.24, 0.24);
      mesh(cylGeo(0.24, 0.24, 0.04, 18), texMat('metal', '#b08a3a'), 0, -0.03, 0, g);
      for (const s of [-1, 1]) {
        const h = mesh(coneGeo(0.045, 0.26, 8), mat(H.accent), 0.25 * s, 0.07, 0, g);
        h.rotation.z = -1.0 * s;
      }
      break;
    }
    case 'wizard': {
      mesh(cylGeo(0.34, 0.34, 0.02, 20), c, 0, 0, 0, g);
      const cone = mesh(coneGeo(0.2, 0.5, 14), c, 0, 0.25, -0.02, g); cone.rotation.x = -0.18;
      for (let i = 0; i < 4; i++) sph(0.018, glowMat(H.accent), Math.cos(i * 1.7) * 0.14, 0.08 + i * 0.07, Math.sin(i * 1.7) * 0.14 - i * 0.01, g);
      break;
    }
    case 'crown': {
      const gm = mat(H.color, { metalness: 0.95, roughness: 0.2 });
      mesh(cylGeo(0.17, 0.16, 0.08, 16, true), mat(H.color, { metalness: 0.95, roughness: 0.2, side: THREE.DoubleSide }), 0, 0.04, 0, g);
      for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; mesh(coneGeo(0.03, 0.08, 4), gm, Math.sin(an) * 0.165, 0.12, Math.cos(an) * 0.165, g); }
      sph(0.028, glowMat(H.accent), 0, 0.05, 0.17, g);
      break;
    }
    case 'halo':
      mesh(torusGeo(0.17, 0.02, 20), glowMat(H.color), 0, 0.22, 0, g).rotation.x = Math.PI / 2;
      break;
    case 'bucket': {
      // cappello a secchiello da esploratore (Leo), leggermente inclinato all'indietro
      const bm = mat(H.color, { roughness: 0.9, map: fabricTex(), side: THREE.DoubleSide });
      const bg = new THREE.Group(); bg.rotation.x = -0.12; g.add(bg);
      mesh(cylGeo(0.17, 0.2, 0.16, 22), bm, 0, 0.12, 0, bg);
      mesh(domeGeo(Math.PI / 2, 22), bm, 0, 0.199, 0, bg, 0.17, 0.035, 0.17);
      mesh(cylGeo(0.205, 0.31, 0.06, 24, true), bm, 0, 0.03, 0, bg);
      mesh(cylGeo(0.203, 0.199, 0.035, 22, true), mat(H.accent, { roughness: 0.8 }), 0, 0.075, 0, bg);
      for (const y of [0.13, 0.165]) mesh(torusGeo(0.19 - (y - 0.13) * 0.6, 0.0022, 22), mat(H.accent), 0, y, 0, bg).rotation.x = Math.PI / 2;
      break;
    }
    default: break;
  }
  return g;
}

/** zaini e oggetti sulla schiena (config BACKPACKS) */
function buildBack(id, skin, torso) {
  const B = BACKPACKS.find(b => b.id === id) || { color: skin.backpack || '#7a5a2a', accent: skin.accColor || '#333' };
  const c = id === 'skinpack' ? mat(skin.backpack, { roughness: 0.85, map: fabricTex() }) : mat(B.color, { roughness: 0.85, map: fabricTex() });
  const a = mat(B.accent || '#333', { roughness: 0.6 });
  const g = new THREE.Group(); g.position.set(0, 0.36, -0.15); torso.add(g);
  switch (id) {
    case 'skinpack':
    case 'school':
      mesh(capsuleGeo(0.15, 0.14, 10), c, 0, 0, -0.07, g, 1.05, 1, 0.55);
      mesh(boxGeo(0.18, 0.1, 0.05), a, 0, -0.08, -0.14, g);
      for (const s of [-1, 1]) mesh(boxGeo(0.035, 0.36, 0.02), mat('#2a2a2a'), 0.12 * s, 0.03, 0.03, g);
      break;
    case 'hiker':
      mesh(capsuleGeo(0.15, 0.3, 10), c, 0, 0.06, -0.08, g, 1, 1, 0.6);
      mesh(cylGeo(0.06, 0.06, 0.32, 10), a, 0, 0.3, -0.06, g).rotation.z = Math.PI / 2;   // sacco a pelo
      mesh(boxGeo(0.2, 0.12, 0.06), a, 0, -0.1, -0.16, g);
      break;
    case 'guitar': {
      const gg = new THREE.Group(); gg.rotation.z = 0.6; gg.position.z = -0.08; g.add(gg);
      const w = mat(B.color, { roughness: 0.4, map: fabricTex() });
      mesh(cylGeo(0.15, 0.15, 0.06, 16), w, 0, -0.12, 0, gg).rotation.x = Math.PI / 2;
      mesh(cylGeo(0.12, 0.12, 0.06, 16), w, 0, 0.06, 0, gg).rotation.x = Math.PI / 2;
      mesh(cylGeo(0.04, 0.04, 0.062, 10), a, 0, -0.06, 0.002, gg).rotation.x = Math.PI / 2;
      mesh(boxGeo(0.045, 0.42, 0.03), a, 0, 0.36, 0, gg);
      mesh(boxGeo(0.07, 0.1, 0.03), a, 0, 0.6, 0, gg);
      break;
    }
    case 'sword': {
      const sg = new THREE.Group(); sg.rotation.z = -0.7; sg.position.z = -0.06; g.add(sg);
      mesh(boxGeo(0.07, 0.75, 0.015), texMat('metal', B.color), 0, -0.1, 0, sg);
      mesh(boxGeo(0.24, 0.04, 0.05), mat(B.accent, { metalness: 0.9, roughness: 0.25 }), 0, 0.29, 0, sg);
      mesh(cylGeo(0.022, 0.022, 0.16, 6), texMat('leather', '#3a2414'), 0, 0.39, 0, sg);
      sph(0.035, glowMat('#ff3a3a'), 0, 0.48, 0, sg);
      break;
    }
    case 'jetpack': {
      const jm = texMat('metal', B.color);
      for (const s of [-1, 1]) {
        mesh(capsuleGeo(0.07, 0.24, 10), jm, 0.085 * s, 0, -0.08, g);
        mesh(coneGeo(0.055, 0.08, 10), mat('#333', { metalness: 0.8 }), 0.085 * s, -0.22, -0.08, g).rotation.x = Math.PI;
        mesh(coneGeo(0.04, 0.16, 8), glowMat(B.accent), 0.085 * s, -0.33, -0.08, g).rotation.x = Math.PI;
      }
      mesh(boxGeo(0.12, 0.2, 0.06), mat('#333'), 0, 0, -0.03, g);
      break;
    }
    case 'wings':
    case 'dragonwings': {
      const wm = id === 'wings' ? mat(B.color, { roughness: 0.9, side: THREE.DoubleSide, emissive: B.accent, emissiveIntensity: 0.15 }) : mat(B.color, { roughness: 0.6, side: THREE.DoubleSide });
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(0.06 * s, 0.05, -0.06); w.rotation.set(0, 0.35 * s, 0.25 * s); g.add(w);
        if (id === 'wings') for (let i = 0; i < 4; i++) mesh(capsuleGeo(0.05, 0.3 - i * 0.05, 8), wm, s * (0.15 + i * 0.07), 0.1 - i * 0.05, 0, w, 1, 1, 0.35).rotation.z = s * (1.1 + i * 0.25);
        else {
          mesh(cylGeo(0.015, 0.015, 0.5, 5), mat(B.accent), s * 0.22, 0.12, 0, w).rotation.z = s * 1.1;
          const memb = new THREE.Mesh(new THREE.CircleGeometry(0.3, 5, 0, Math.PI * 0.8), wm);
          memb.position.set(s * 0.05, -0.05, 0); memb.rotation.set(0, s > 0 ? 0 : Math.PI, -0.1); memb.castShadow = true;
          w.add(memb);
        }
      }
      break;
    }
    default: break;
  }
  return g;
}

const lodMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const lodCache = new Map();
function lodGeometry(skin, cos = {}) {
  const key = skin.id + '|' + (cos.hat || '') + '|' + (cos.back || '');
  if (lodCache.has(key)) return lodCache.get(key);
  const top = skin.vest || skin.shirt, headC = skin.acc === 'ninja' ? skin.shirt : skin.skin;
  const hatC = cos.hat && cos.hat !== 'none' ? (HATS.find(h => h.id === cos.hat)?.color || '#444')
    : ['cap', 'capback', 'pirate', 'visor', 'knight', 'helmet'].includes(skin.acc) ? (skin.accColor || '#333') : (skin.hair || headC);
  const parts = [];
  const P = (g, c, x, y, z, o = {}) => parts.push({ geo: g, color: c, o: { x, y, z, jit: 0.02, noSky: true, ...o } });
  const C = (r, l) => new THREE.CapsuleGeometry(r, l, 1, 6);
  for (const sx of [-0.105, 0.105]) { P(C(0.09, 0.62), skin.pants, sx, 0.47, 0); P(new THREE.BoxGeometry(0.13, 0.08, 0.26), skin.shoes, sx, 0.04, 0.05); }
  P(new THREE.CylinderGeometry(0.235, 0.17, 0.6, 7), top, 0, 1.2, 0, { sz: 0.66 });
  for (const sx of [-0.28, 0.28]) { P(C(0.065, 0.5), skin.shirt, sx, 1.1, 0); P(new THREE.SphereGeometry(0.06, 5, 4), skin.skin, sx, 0.8, 0); }
  if (skin.banana) P(C(0.2, 0.36), headC, 0, 1.92, 0);
  else { P(new THREE.SphereGeometry(0.2, 8, 6), headC, 0, 1.825, 0, { sy: 1.12 }); P(new THREE.SphereGeometry(0.215, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), hatC, 0, 1.87, -0.01, { sy: 0.9 }); }
  if (skin.cape) P(new THREE.BoxGeometry(0.46, 1.0, 0.03), skin.cape, 0, 0.98, -0.17);
  if (skin.backpack || (cos.back && cos.back !== 'none')) P(new THREE.BoxGeometry(0.3, 0.36, 0.16), skin.backpack || BACKPACKS.find(b => b.id === cos.back)?.color || '#555', 0, 1.26, -0.24);
  const g = mergeParts(parts, 3);
  lodCache.set(key, g);
  return g;
}

// ─────────────── Texture procedurali delle armi ───────────────
const texCache = new Map();
function canvasTex(key, size, draw, repeat = true) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
function rnd(a, b) { return a + Math.random() * (b - a); }
/** metallo brunito spazzolato con graffi */
function gunmetalTex(base = '#50555d') {
  return canvasTex('gm' + base, 128, (g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * S, l = rnd(10, 70);
      g.strokeStyle = Math.random() < 0.5 ? `rgba(255,255,255,${rnd(0.02, 0.07)})` : `rgba(0,0,0,${rnd(0.04, 0.12)})`;
      g.lineWidth = rnd(0.5, 1.3);
      g.beginPath(); const x = Math.random() * S; g.moveTo(x, y); g.lineTo(x + l, y + rnd(-0.6, 0.6)); g.stroke();
    }
    for (let i = 0; i < 10; i++) {   // graffi chiari
      g.strokeStyle = `rgba(210,215,220,${rnd(0.15, 0.35)})`; g.lineWidth = 0.7;
      g.beginPath(); const x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); g.lineTo(x + rnd(-14, 14), y + rnd(-6, 6)); g.stroke();
    }
    // bordi consumati
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.08, 'rgba(255,255,255,0)'); gr.addColorStop(0.92, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
}
/** polimero con zigrinatura (impugnature, calci) */
function polymerTex(base = '#3b3f45') {
  return canvasTex('pl' + base, 128, (g, S) => {
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < S; x += 4) {
      g.fillStyle = `rgba(0,0,0,${rnd(0.12, 0.25)})`; g.fillRect(x, y, 2, 2);
      g.fillStyle = `rgba(255,255,255,${rnd(0.02, 0.06)})`; g.fillRect(x + 1, y, 1, 1);
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;    // linea del pannello
    g.beginPath(); g.moveTo(0, S - 2); g.lineTo(S, S - 2); g.stroke();
    for (const [x, y] of [[18, S - 12]]) {   // vite
      g.fillStyle = '#777'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.stroke();
    }
  });
}
/** legno di noce venato e verniciato */
function walnutTex() {
  return canvasTex('walnut', 128, (g, S) => {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, '#8a5428'); gr.addColorStop(0.5, '#6e3f1c'); gr.addColorStop(1, '#84502a');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 34; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,18,6' : '160,100,50'},${rnd(0.15, 0.4)})`;
      g.lineWidth = rnd(0.6, 2.2);
      const y0 = Math.random() * S, a = rnd(2, 7), f = rnd(0.02, 0.07), ph = Math.random() * 6;
      g.beginPath();
      for (let x = 0; x <= S; x += 4) { const y = y0 + Math.sin(x * f + ph) * a; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {   // nodi
      const x = Math.random() * S, y = Math.random() * S;
      for (let r = 6; r > 0; r -= 2) { g.strokeStyle = `rgba(50,22,8,${0.5 - r * 0.05})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r * 1.8, r, 0, 0, 7); g.stroke(); }
    }
    g.fillStyle = 'rgba(255,230,190,0.07)'; g.fillRect(0, S * 0.15, S, S * 0.12);   // riflesso della vernice
  });
}
/** pannello colorato della rarità: Comune/Non comune a righe, Raro a chevron, Epico esagoni, Leggendario oro inciso */
function rarityTex(rarity) {
  const rc = RARITIES[rarity].color;
  return canvasTex('rar' + rarity, 128, (g, S) => {
    const base = new THREE.Color(rc);
    const dark = '#' + base.clone().multiplyScalar(0.55).getHexString(), light = '#' + base.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString();
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, light); gr.addColorStop(0.45, rc); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.lineWidth = 2;
    if (rarity <= 1) {
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      for (let x = -S; x < S * 2; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + S, S); g.stroke(); }
    } else if (rarity === 2) {
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      for (let y = -16; y < S + 16; y += 16) { g.beginPath(); for (let x = 0; x <= S; x += 16) g.lineTo(x, y + ((x / 16) % 2 ? 8 : 0)); g.stroke(); }
    } else if (rarity === 3) {
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5;
      const r = 9, h = r * Math.sqrt(3);
      for (let row = -1; row < S / h + 1; row++) for (let col = -1; col < S / (r * 3) + 1; col++) {
        const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0), cy = row * h / 2;
        g.beginPath();
        for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        g.stroke();
      }
    } else {
      // oro con incisioni a volute
      g.strokeStyle = 'rgba(90,50,0,0.55)'; g.lineWidth = 1.4;
      for (let i = 0; i < 9; i++) {
        const cx = Math.random() * S, cy = Math.random() * S;
        g.beginPath();
        for (let a = 0; a < 12; a += 0.25) g.lineTo(cx + Math.cos(a) * a * 1.4, cy + Math.sin(a) * a * 1.4);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,250,210,0.5)'; g.lineWidth = 2; g.strokeRect(4, 4, S - 8, S - 8);
    }
    // riflesso lucido
    const hl = g.createLinearGradient(0, 0, 0, S);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(0.25, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(0, 0, S, S);
  });
}

/** box con UV proporzionali alle dimensioni: la texture non si stira sui pezzi lunghi */
const texBoxCache = new Map();
function texBoxGeo(w, h, d, density = 4) {
  const k = `${w}|${h}|${d}|${density}`;
  if (texBoxCache.has(k)) return texBoxCache.get(k);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const su = ax > 0.5 ? d : w, sv = ay > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su * density, uv.getY(i) * sv * density);
  }
  texBoxCache.set(k, g);
  return g;
}
function tbox(w, h, d, material, x, y, z, parent, density) {
  const m = new THREE.Mesh(texBoxGeo(w, h, d, density), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Dettagli extra per ogni arma: [w, h, d, x, y, z, materiale]
//  m = metallo, b = corpo, r = rarità, w = legno, k = nero opaco, g = vetro/lente, s = ottone
const WEAPON_DETAILS = {
  pistol: [
    [0.03, 0.015, 0.11, 0, -0.098, 0.08, 'k'], [0.03, 0.05, 0.015, 0, -0.075, 0.13, 'k'],    // guardia del grilletto
    [0.012, 0.04, 0.012, 0, -0.07, 0.07, 'm'],                                                // grilletto
    [0.018, 0.025, 0.02, 0, 0.082, 0.25, 'k'], [0.05, 0.025, 0.02, 0, 0.082, -0.05, 'k'],     // mire
    [0.086, 0.06, 0.008, 0, 0.02, -0.035, 'k'], [0.086, 0.06, 0.008, 0, 0.02, -0.015, 'k'],    // zigrinatura del carrello
    [0.03, 0.03, 0.01, 0, 0, 0.272, 'k'],                                                     // volata
  ],
  smg: [
    [0.06, 0.06, 0.16, 0, 0.0, 0.45, 'k'],                                                    // silenziatore
    [0.005, 0.04, 0.08, 0.047, 0.02, 0.12, 'k'],                                              // finestra di espulsione
    [0.03, 0.015, 0.1, 0, -0.085, 0.07, 'k'], [0.012, 0.035, 0.012, 0, -0.07, 0.06, 'm'],
    [0.015, 0.04, 0.02, 0, 0.1, 0.3, 'm'], [0.04, 0.03, 0.03, 0, 0.1, 0.0, 'm'],             // mire
    [0.065, 0.02, 0.075, 0, -0.27, 0.2, 'r'],                                                 // fondello del caricatore
  ],
  ar: [
    [0.05, 0.06, 0.12, 0, 0.17, 0.15, 'k'], [0.044, 0.045, 0.01, 0, 0.175, 0.212, 'g'],     // red dot
    [0.012, 0.012, 0.008, 0, 0.18, 0.2, 'dot'],
    [0.07, 0.07, 0.08, 0, 0.02, 0.89, 'k'],                                                   // freno di bocca
    [0.015, 0.07, 0.02, 0, 0.08, 0.6, 'm'],                                                   // mirino anteriore
    [0.103, 0.025, 0.04, 0, 0.0, 0.42, 'k'], [0.103, 0.025, 0.04, 0, 0.0, 0.5, 'k'], [0.103, 0.025, 0.04, 0, 0.0, 0.34, 'k'],   // feritoie del paramano
    [0.03, 0.015, 0.1, 0, -0.1, 0.04, 'k'],
    [0.072, 0.03, 0.105, 0, -0.3, 0.27, 'r'],                                                 // fondello del caricatore
    [0.095, 0.17, 0.03, 0, -0.02, -0.465, 'k'],                                               // calciolo in gomma
  ],
  shotgun: [
    [0.05, 0.05, 0.5, 0, -0.025, 0.55, 'm'],                                                  // tubo serbatoio
    [0.015, 0.015, 0.015, 0, 0.065, 0.84, 's'],                                               // mirino a perla
    [0.02, 0.04, 0.02, -0.06, 0.0, -0.02, 'sh'], [0.02, 0.04, 0.02, -0.06, 0.0, 0.02, 'sh'], [0.02, 0.04, 0.02, -0.06, 0.0, 0.06, 'sh'], [0.02, 0.04, 0.02, -0.06, 0.0, 0.10, 'sh'],   // cartucce sul fianco
    [0.095, 0.16, 0.03, 0, -0.05, -0.49, 'k'],                                                // calciolo
    [0.03, 0.015, 0.1, 0, -0.075, 0.02, 'k'],
    [0.112, 0.012, 0.22, 0, -0.03, 0.52, 'k'], [0.112, 0.012, 0.22, 0, -0.07, 0.52, 'k'],    // scanalature della pompa
  ],
  sniper: [
    [0.1, 0.1, 0.08, 0, 0.13, 0.36, 'm'], [0.085, 0.085, 0.012, 0, 0.13, 0.402, 'g'],       // obiettivo e lente
    [0.07, 0.07, 0.012, 0, 0.13, -0.045, 'g'],                                                // oculare
    [0.03, 0.035, 0.03, 0, 0.19, 0.15, 'k'], [0.035, 0.03, 0.03, 0.055, 0.13, 0.15, 'k'],    // torrette
    [0.06, 0.05, 0.08, 0, 0.02, 1.13, 'k'],                                                   // freno di bocca
    [0.015, 0.015, 0.26, 0.03, -0.07, 0.52, 'k'], [0.015, 0.015, 0.26, -0.03, -0.07, 0.52, 'k'],   // bipiede ripiegato
    [0.08, 0.02, 0.02, 0.07, 0.03, -0.02, 'm'], [0.035, 0.035, 0.035, 0.115, 0.03, -0.02, 'k'],    // otturatore
    [0.03, 0.015, 0.1, 0, -0.1, -0.02, 'k'],
    [0.09, 0.05, 0.12, 0, 0.065, -0.3, 'r'],                                                  // poggiaguancia
  ],
  rocket: [
    [0.04, 0.09, 0.09, -0.13, 0.13, 0.35, 'k'], [0.03, 0.05, 0.01, -0.13, 0.13, 0.4, 'g'],   // mirino ottico
    [0.15, 0.15, 0.1, 0, 0.06, 0.86, 'wh'], [0.09, 0.09, 0.08, 0, 0.06, 0.94, 'wh'],          // testata del razzo
    [0.06, 0.12, 0.26, 0, -0.08, -0.1, 'k'],                                                  // spallaccio
    [0.205, 0.205, 0.04, 0, 0.06, 0.62, 'y'], [0.205, 0.205, 0.04, 0, 0.06, -0.22, 'y'],      // strisce di pericolo
  ],
};

/** Modello dell'arma: la canna punta verso +Z (texture e dettagli procedurali) */
export function buildWeaponMesh(id, rarity = 0) {
  const def = WEAPONS[id];
  const g = new THREE.Group();
  if (!def) return g;
  const rc = RARITIES[rarity].color;
  const key = id + '|' + rarity;
  let colors = weaponMats.get(key);
  if (!colors) {
    const gm = gunmetalTex(), pl = polymerTex(id === 'rocket' ? '#56683f' : '#454a52'), rt = rarityTex(rarity);
    colors = {
      m: new THREE.MeshStandardMaterial({ map: gm, bumpMap: gm, bumpScale: 0.6, metalness: 0.4, roughness: 0.38 }),
      b: new THREE.MeshStandardMaterial({ map: pl, bumpMap: pl, bumpScale: 1.2, metalness: 0.05, roughness: 0.75 }),
      r: new THREE.MeshStandardMaterial({ map: rt, emissive: rc, emissiveMap: rt, emissiveIntensity: rarity >= 3 ? 0.45 : 0.15, metalness: rarity === 4 ? 0.5 : 0.2, roughness: rarity === 4 ? 0.3 : 0.42 }),
      w: new THREE.MeshStandardMaterial({ map: walnutTex(), bumpMap: walnutTex(), bumpScale: 0.5, roughness: 0.55, metalness: 0.02 }),
      k: mat('#25272c', { metalness: 0.2, roughness: 0.6 }),
      g: new THREE.MeshStandardMaterial({ color: '#7fd0ff', emissive: '#1a5a8a', emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.05 }),
      dot: glowMat('#ff2a2a'),
      s: mat('#d8b040', { metalness: 0.9, roughness: 0.25 }),
      sh: mat('#c0302a', { roughness: 0.5 }),
      wh: mat('#d8d4c8', { roughness: 0.5 }),
      y: mat('#f2c230', { roughness: 0.5 }),
    };
    weaponMats.set(key, colors);
  }
  for (const p of def.parts) tbox(p[0], p[1], p[2], colors[p[6]], p[3], p[4], p[5], g, p[6] === 'w' ? 3 : p[6] === 'b' ? 2.5 : 5);
  for (const p of WEAPON_DETAILS[id] || []) tbox(p[0], p[1], p[2], colors[p[6]] || colors.k, p[3], p[4], p[5], g, 5);
  return g;
}
const weaponMats = new Map();

/** Modelli semplici per consumabili e munizioni a terra */
export function buildItemMesh(kind, id) {
  const g = new THREE.Group();
  if (kind === 'cons') {
    switch (id) {
      case 'bandage':
        box(0.35, 0.12, 0.25, mat('#f2ece0'), 0, 0, 0, g);
        box(0.36, 0.13, 0.06, mat('#d03030'), 0, 0, 0, g);
        break;
      case 'medkit':
        box(0.5, 0.35, 0.22, mat('#f4f4f4'), 0, 0, 0, g);
        box(0.08, 0.24, 0.23, mat('#e02828'), 0, 0, 0, g);
        box(0.24, 0.08, 0.23, mat('#e02828'), 0, 0, 0, g);
        break;
      case 'minishield': {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: '#4ab8ff', emissive: '#1a70ff', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
        g.add(m);
        box(0.06, 0.08, 0.06, mat('#dddddd'), 0, 0.18, 0, g);
        break;
      }
      case 'shield': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.36, 10),
          new THREE.MeshStandardMaterial({ color: '#3a7dff', emissive: '#1a4aff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }));
        g.add(m);
        box(0.1, 0.1, 0.1, mat('#dddddd'), 0, 0.23, 0, g);
        break;
      }
    }
  } else if (kind === 'ammo') {
    box(0.4, 0.22, 0.26, mat('#3e4a2c'), 0, 0, 0, g);
    box(0.41, 0.07, 0.27, mat(idColor(id)), 0, 0.04, 0, g);
  } else if (kind === 'mats') {
    for (let i = 0; i < 3; i++) box(0.6, 0.08, 0.16, mat('#a8743a'), 0, i * 0.09 - 0.09, (i % 2) * 0.05, g);
  }
  return g;
}

function idColor(id) {
  return ({ light: '#9fd4ff', medium: '#8fe08a', heavy: '#ff8a6a', shells: '#ffd36a', rockets: '#ff5050' })[id] || '#ffffff';
}

/** Deltaplano */
export function buildGlider(glider) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.3);
  shape.lineTo(1.9, -0.5);
  shape.lineTo(0, -0.1);
  shape.lineTo(-1.9, -0.5);
  shape.lineTo(0, 1.3);
  const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: glider.color, side: THREE.DoubleSide, roughness: 0.6 }));
  wing.rotation.x = -Math.PI / 2;
  wing.castShadow = true;
  g.add(wing);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1.4), mat(glider.accent));
  stripe.position.set(0, 0.01, -0.4);
  g.add(stripe);
  const barM = mat('#333333');
  for (const s of [-1, 1]) {
    const bar = box(0.03, 1.1, 0.03, barM, 0.35 * s, -0.55, 0, g);
    bar.rotation.z = 0.3 * s;
  }
  box(0.9, 0.04, 0.04, barM, 0, -1.08, 0.05, g);
  g.position.y = 2.9;
  return g;
}

/** Il "Battle Bus" volante */
export function buildBus() {
  const g = new THREE.Group();
  box(3.2, 3, 9, mat('#2f6fd6'), 0, 0, 0, g);
  box(3.25, 1, 7.6, mat('#bfe6ff', { metalness: 0.6, roughness: 0.1 }), 0, 0.6, -0.4, g);
  box(3.25, 0.25, 9.05, mat('#ffffff'), 0, -0.6, 0, g);
  box(2.8, 1.1, 0.1, mat('#bfe6ff', { metalness: 0.6, roughness: 0.1 }), 0, 0.5, 4.52, g);
  const wheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12);
  const wm = mat('#1a1a1a');
  for (const x of [-1.6, 1.6]) for (const z of [-3, 3]) {
    const w = new THREE.Mesh(wheelGeo, wm);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, -1.6, z);
    g.add(w);
  }
  const balloon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 18, 14), mat('#e83a3a'));
  balloon.scale.set(1, 0.85, 1.4);
  balloon.position.y = 7.5;
  g.add(balloon);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(4.55, 18, 4, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.1), mat('#ffffff'));
  stripe.scale.copy(balloon.scale); stripe.position.copy(balloon.position);
  g.add(stripe);
  const ropeM = mat('#444444');
  for (const x of [-1.4, 1.4]) for (const z of [-4, 4]) box(0.06, 4, 0.06, ropeM, x, 3.2, z * 0.8, g);
  return g;
}
