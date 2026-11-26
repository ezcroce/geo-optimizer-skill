// Modelli 3D low‑poly: personaggi con skin, armi e deltaplani
import * as THREE from 'three';
import { REAL, attachReal, realKind } from './realchar.js?v=34';
import { normalFromHeight, NORMALS } from './texgen.js?v=19';
import { clothTexture, skinTexture, hairTexture, gliderTexture, COLORED, CLOTH_LOOK, SKIN_CLOTH } from './chartex.js?v=31';
/** normal map ricavata dalla trama (cache per texture) */
function nrm(t, k = 1.2) { if (!NORMALS) return null; if (!t.userData.n) { t.userData.n = normalFromHeight(t.image, k); t.userData.n.repeat.copy(t.repeat); } return t.userData.n; }
import { WEAPONS, RARITIES, HATS, BACKPACKS } from './config.js?v=34';
import { mergeParts } from './props.js?v=33';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = rimify(new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }));
  matCache.set(key, m);
  return m;
}
/**
 * Luce di contorno (rim light): i bordi del personaggio si schiariscono un poco verso il cielo,
 * così si staccano dallo sfondo anche in ombra. Un'unica variante di shader per tutti.
 */
export const CHAR_RIM = { value: new THREE.Color(0.1, 0.12, 0.16) };   // v23: più tenue (meno effetto plastica)
function rimify(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = CHAR_RIM;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <opaque_fragment>', 'outgoingLight += uRim * pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'charRim1';
  return m;
}
/** materiali "fisici" (riflesso morbido dei tessuti) solo con qualità texture normale o alta */
const HQ = NORMALS;
const lighter = (hex, t = 0.45) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), t);
/** materiale di un tessuto: trama + rilievo + lucentezza tipica (seta lucida, jeans opaco, cuoio, metallo…) */
function fabricMat(kind, color, opts = {}) {
  const key = 'fab' + kind + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const t = clothTexture(kind, color, opts.extra);
  const L = CLOTH_LOOK[kind] || CLOTH_LOOK.cotton;
  const o = {
    color: COLORED.has(kind) ? '#ffffff' : color, map: t.map,
    roughness: L.rough, metalness: L.metal ?? 0.02,
    ...(t.normalMap ? { normalMap: t.normalMap, normalScale: new THREE.Vector2(...(kind === 'leather' || kind === 'ripstop' ? [0.4, 0.4] : [0.8, 0.8])) } : {}),
  };
  const extra = { ...opts }; delete extra.extra;
  let m;
  if (HQ && (L.sheen || L.coat)) {
    m = new THREE.MeshPhysicalMaterial({ ...o, ...extra });
    if (L.sheen) { m.sheen = L.sheen * 0.6; m.sheenRoughness = L.sheenRough ?? 0.75; m.sheenColor = lighter(COLORED.has(kind) ? '#9a9a9a' : color, 0.2); }
    if (L.coat) { m.clearcoat = L.coat; m.clearcoatRoughness = 0.35; }
  } else m = new THREE.MeshStandardMaterial({ ...o, ...extra });
  rimify(m);
  matCache.set(key, m);
  return m;
}
/** pelle: pori leggerissimi e un velo rosato ai bordi (finto sottopelle) */
function skinMat(color, opts = {}) {
  const key = 'skin' + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const t = skinTexture();
  const o = { color, map: t.map, roughness: 0.58, metalness: 0.0, ...(t.normalMap ? { normalMap: t.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) } : {}), ...opts };
  let m;
  if (HQ) { m = new THREE.MeshPhysicalMaterial(o); m.sheen = 0.35; m.sheenRoughness = 0.5; m.sheenColor = new THREE.Color(color).lerp(new THREE.Color('#ff8a70'), 0.5); }
  else m = new THREE.MeshStandardMaterial(o);
  rimify(m);
  matCache.set(key, m);
  return m;
}
/** capelli: ciocche con riflesso lucido */
function hairMat(color) {
  const key = 'hair' + color;
  if (matCache.has(key)) return matCache.get(key);
  const t = hairTexture();
  const o = { color, map: t.map, roughness: 0.55, metalness: 0.02, ...(t.normalMap ? { normalMap: t.normalMap, normalScale: new THREE.Vector2(0.9, 0.9) } : {}) };
  let m;
  if (HQ) { m = new THREE.MeshPhysicalMaterial(o); m.sheen = 0.8; m.sheenRoughness = 0.35; m.sheenColor = lighter(color, 0.55); }
  else m = new THREE.MeshStandardMaterial(o);
  rimify(m);
  matCache.set(key, m);
  return m;
}
// trama di tessuto condivisa: cotone fine (si moltiplica per il colore senza cambiarlo)
function fabricTex() { return clothTexture('cotton').map; }
function clothMat(color, kind = 'cotton') { return fabricMat(kind, color); }
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

// suola: sagoma della scarpa (punta tonda, arco plantare) estrusa con bordo smussato
const soleGeo = () => cachedGeo('sole23', () => {
  const sh = new THREE.Shape();
  sh.moveTo(-0.05, -0.125); sh.quadraticCurveTo(-0.064, -0.13, -0.062, -0.07);
  sh.quadraticCurveTo(-0.054, 0.0, -0.064, 0.06); sh.quadraticCurveTo(-0.07, 0.14, 0.0, 0.142);
  sh.quadraticCurveTo(0.07, 0.14, 0.064, 0.06); sh.quadraticCurveTo(0.058, 0.0, 0.062, -0.07);
  sh.quadraticCurveTo(0.064, -0.13, 0.05, -0.125); sh.quadraticCurveTo(0.0, -0.138, -0.05, -0.125);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(Math.PI / 2); g.translate(0, 0.022, 0);
  // uv dall'alto per il battistrada
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 6 + 0.5, p.getZ(i) * 6 + 0.5);
  g.computeVertexNormals();
  return g;
});
/** scatola con spigoli arrotondati (zaini, tasche) */
const roundBoxGeo = (w, h, d, r, seg = 5) => cachedGeo(`rbox${w}|${h}|${d}|${r}`, () => {
  const g = new THREE.BoxGeometry(1, 1, 1, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, nr = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) * w, p.getY(i) * h, p.getZ(i) * d);
    c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    n.copy(v).sub(c);
    if (n.lengthSq() > 1e-12) { n.normalize(); v.copy(c).addScaledVector(n, r); nr.setXYZ(i, n.x, n.y, n.z); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
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
function texMat(kind, color, opts = {}) {
  // v30: metallo meno "specchio" (con metalness alta senza riflessi intorno diventava quasi nero)
  if (kind === 'metal' && opts.metalness === undefined) opts = { metalness: 0.55, roughness: 0.38, ...opts };
  return fabricMat(kind, color, opts);
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
  let m;
  if (HQ && !robot) { m = new THREE.MeshPhysicalMaterial(opts); m.sheen = 0.35; m.sheenRoughness = 0.5; m.sheenColor = new THREE.Color(base).lerp(new THREE.Color('#ff8a70'), 0.5); }
  else m = new THREE.MeshStandardMaterial(opts);
  rimify(m);
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
  const [shirtK, pantsK] = SKIN_CLOTH[skin.id] || ['cotton', 'denim'];
  const shirtM = metal ? texMat('metal', skin.shirt) : fabricMat(shirtK, skin.shirt, shirtK === 'hex' ? { extra: skin.glow || '#00f0ff' } : {});
  const pantsM = metal ? texMat('metal', skin.pants) : fabricMat(pantsK, skin.pants, pantsK === 'hex' ? { extra: skin.glow || '#00f0ff' } : {});
  const skinM = skin.id === 'robot' || skin.banana ? mat(skin.skin, { roughness: 0.5 }) : skinMat(skin.skin);
  const shoeM = texMat('leather', skin.shoes);
  const soleM = texMat('rubber', '#1c1c1c');
  const midM = mat('#efece4', { roughness: 0.65 });
  const darkM = mat('#111111');
  const gloveM = metal ? texMat('metal', skin.accColor || skin.shirt) : skin.gloves ? texMat('leather', skin.gloves) : skinM;

  // ── gambe: anca → ginocchio → caviglia ──
  const legs = [], knees = [], feet = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.105 * side, RIG.hip, 0);
    body.add(hip);
    const knee = new THREE.Group(); knee.position.y = -RIG.thigh; hip.add(knee);
    if (skin.wide) mesh(widePantGeo(), pantsM, 0, 0, -0.005, knee);
    const ankle = new THREE.Group(); ankle.position.y = -RIG.shin; knee.add(ankle);
    if (skin.boots) mesh(shoeGeo(), shoeM, 0, -0.012, 0.06, ankle, 1.12, 1.3, 1.2);   // v23: scarpone pieno, raccordato al gambale
    else mesh(shoeGeo(), shoeM, 0, -0.005, 0.05, ankle);
    // v23: suola sagomata in gomma (battistrada), intersuola chiara sulle sneaker, rinforzo del tallone
    mesh(soleGeo(), soleM, 0, -0.058, skin.boots ? 0.062 : 0.05, ankle, 1, 1, skin.boots ? 1.16 : 1);
    if (!skin.boots && !metal && !skin.tabi && !skin.flats) {
      mesh(soleGeo(), midM, 0, -0.04, 0.05, ankle, 1.01, 0.75, 1.0);
      mesh(cachedGeo('heelTab', () => new THREE.CylinderGeometry(0.058, 0.062, 0.05, 10, 1, true, Math.PI * 0.62, Math.PI * 0.76)), texMat('leather', darker(skin.shoes, 0.7), { side: THREE.DoubleSide }), 0, 0.0, -0.035, ankle);
      mesh(boxGeo(0.034, 0.03, 0.006), mat('#e8e8e8', { roughness: 0.5 }), 0.064, 0.002, 0.02, ankle).rotation.y = Math.PI / 2;   // logo laterale
    }
    if (!skin.boots && !metal && !skin.tabi && !skin.flats) mesh(cachedGeo('laces', () => mergeSmooth([
      [new THREE.BoxGeometry(0.066, 0.008, 0.011), { y: 0.044, z: 0.035 }], [new THREE.BoxGeometry(0.06, 0.008, 0.011), { y: 0.042, z: 0.062 }],
      [new THREE.BoxGeometry(0.052, 0.008, 0.011), { y: 0.038, z: 0.089 }],
      [new THREE.BoxGeometry(0.128, 0.014, 0.1), { y: -0.008, z: 0.02 }],
    ])), mat('#f2f0ea', { roughness: 0.7 }), 0, -0.005, 0.05, ankle);
    if (skin.boots) {
      // v23: gambale sagomato (più largo in alto), risvolto cucito e tacco
      mesh(cachedGeo('bootShaft', () => { const g = new THREE.LatheGeometry([[0.07, -0.03], [0.08, 0.0], [0.083, 0.08], [0.088, 0.15], [0.092, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 16); g.scale(1, 1, 1.08); return g; }), shoeM, 0, 0.0, 0, ankle);
      mesh(torusGeo(0.09, 0.008, 16), texMat('leather', darker(skin.shoes, 0.65)), 0, 0.178, 0, ankle, 1, 1, 1.08).rotation.x = Math.PI / 2;
      mesh(boxGeo(0.1, 0.03, 0.07), soleM, 0, -0.035, -0.045, ankle);
    }
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
  const neckM = mask(skin) ? shirtM : skin.faceMask ? mat(skin.faceMask, { roughness: 0.9 }) : skinM;
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
  const backStart = torso.children.length;
  if (backId) buildBack(backId, skin, torso, cos);
  const backParts = torso.children.slice(backStart);

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
    const el = new THREE.Group(); el.position.y = -RIG.upper; sh.add(el);
    if (skin.short && !skin.sleeveless) mesh(cylGeo(0.07, 0.072, 0.03, 14, true), trimM, 0, -0.215, 0, sh);   // orlo della manica corta
    const hand = new THREE.Group(); hand.position.y = -RIG.fore; el.add(hand);
    mesh(handGeo(side), gloveM, 0, 0, 0, hand);                                           // mano con dita
    // polsini della manica
    if (!skin.short && !metal && !skin.glow && !skin.coat) mesh(cylGeo(0.056, 0.053, 0.035, 12), trimM, 0, -0.245, 0, el);
    if (skin.glow) mesh(cylGeo(0.058, 0.058, 0.03, 12), glowMat(skin.glow), 0, -0.2, 0, el);
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
    const hm = hairMat(skin.hair);
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
      const hm = hairMat(skin.hair);
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
  // ── corpo unico senza giunture: busto, collo, braccia e gambe in una sola mesh deformabile ──
  body.add(buildBodySkin(skin, { torso, head, legs, knees, feet, arms, elbows, hands, shirtM, pantsM, skinM, neckM }));
  const hatStart = head.children.length;
  if (hasHat) buildHat(hasHat, skin, head);
  const hatParts = head.children.slice(hatStart);
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

  const m = { root, body, legs, knees, feet, arms, elbows, hands, torso, head, gunPivot, cape, lod, lids };
  // v25: modello umano realistico (se caricato) al posto delle mesh procedurali; lo scheletro resta per le animazioni.
  // Il soldato ha già l'elmetto: i cappelli si vedono solo sul modello femminile
  if (REAL.ready && !cos.procedural) attachReal(m, skin, { hats: hatParts, chosenHat: !!(cos.hat && cos.hat !== 'none'), back: backParts, cape });
  return m;
}
function mask(skin) { return skin.acc === 'ninja'; }

// ─────────────── Corpo unico (skinning) ───────────────
// Le articolazioni del rig restano gli stessi gruppi animati da anim.js, ma ora fanno da "ossa"
// di un'unica SkinnedMesh: braccia e gambe sono tubi continui che si piegano morbidamente a
// gomiti e ginocchia, le spalle sfumano nel busto e il collo nella testa. Niente sfere ai giunti.
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** profilo [distanza lungo l'arto, raggio] con calotte arrotondate in cima e in fondo */
function limbProfile(pts, capTop = true, capBottom = true) {
  const out = [];
  if (capTop) { const [d0, R] = pts[0]; for (let k = 0; k < 4; k++) { const f = k / 4 * Math.PI / 2; out.push([d0 - R * Math.cos(f), R * Math.sin(f)]); } }
  out.push(...pts);
  if (capBottom) { const [d1, R] = pts[pts.length - 1]; for (let k = 1; k <= 4; k++) { const f = k / 4 * Math.PI / 2; out.push([d1 + R * Math.sin(f), R * Math.cos(f)]); } }
  return out;
}
const ARM_PROFILE = limbProfile([[0, 0.08], [0.06, 0.076], [0.14, 0.071], [0.2, 0.067], [0.24, 0.064], [0.27, 0.062], [0.3, 0.061], [0.33, 0.06], [0.36, 0.06], [0.42, 0.058], [0.48, 0.054], [0.53, 0.049], [0.575, 0.043]]);
const LEG_PROFILE = limbProfile([[0, 0.095], [0.08, 0.1], [0.18, 0.098], [0.28, 0.092], [0.35, 0.086], [0.39, 0.081], [0.42, 0.078], [0.44, 0.076], [0.46, 0.076], [0.49, 0.077], [0.54, 0.078], [0.6, 0.075], [0.68, 0.068], [0.76, 0.06], [0.83, 0.055]]);
const NECK_PROFILE = [[0, 0.088], [0.05, 0.08], [0.11, 0.074], [0.17, 0.072], [0.22, 0.072]];   // v23: collo più robusto
const SEG = 14;
const skinGeoCache = new Map();

/**
 * v23: occlusione ambientale "cotta" sui vertici del corpo (ascelle, inguine, sotto il mento, fra le gambe).
 * Ogni vertice è un dischetto che oscura gli altri che lo "vedono" davanti a sé; la testa è un ellissoide.
 */
function bakeAO(P, N) {
  const n = P.length / 3, src = [];
  for (let i = 0; i < n; i++) src.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], 0.0011]);
  // testa (centro a 1,825 m) e mani (sotto i polsi)
  const hc = [0, RIG.hip + RIG.headY + 0.225, 0], hr = [0.2, 0.225, 0.205];
  for (let k = 0; k < 90; k++) {
    const yy = 1 - (k + 0.5) / 90 * 2, rr = Math.sqrt(1 - yy * yy), th = k * 2.39996;
    const ux = Math.cos(th) * rr, uz = Math.sin(th) * rr;
    src.push([hc[0] + ux * hr[0], hc[1] + yy * hr[1], hc[2] + uz * hr[2], ux, yy, uz, 0.0062]);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    let occ = 0;
    for (const e of src) {
      let dx = e[0] - px, dy = e[1] - py, dz = e[2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 4e-5 || d2 > 0.09) continue;
      const d = Math.sqrt(d2); dx /= d; dy /= d; dz /= d;
      const ce = nx * dx + ny * dy + nz * dz;
      if (ce <= 0.05) continue;
      const cr = Math.abs(e[3] * dx + e[4] * dy + e[5] * dz);
      occ += e[6] * ce * (0.35 + 0.65 * cr) / (Math.PI * d2 + e[6]);
    }
    const ground = 0.8 + 0.2 * smoothstep(0.02, 0.4, py);
    out[i] = Math.max(0.42, 1 - occ * 0.55) * ground;
  }
  return out;
}
/**
 * v23: materiale del corpo con occlusione cotta, pieghe dei vestiti (rilievo procedurale vicino alle
 * articolazioni) e cuciture laterali con impunture. Variante per materiale, in cache.
 */
const bodyMatCache = new Map();
function bodyMat(base, cloth) {
  const key = base.uuid + (cloth ? 'c' : 's');
  if (bodyMatCache.has(key)) return bodyMatCache.get(key);
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = CHAR_RIM;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAO;\nattribute float aFold;\nvarying float vAO;\nvarying float vFold;\nvarying vec2 vBUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = aAO; vFold = aFold; vBUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRim;
varying float vAO;
varying float vFold;
varying vec2 vBUv;
float foldH(vec2 uv) {
  float a = sin(uv.y * 58.0 + 2.6 * sin(uv.x * 12.566 + uv.y * 6.0) + 1.1 * sin(uv.x * 31.4));
  float b = sin(uv.y * 36.0 - uv.x * 25.13 + 1.3 * sin(uv.y * 7.0));
  float crease = (0.5 + 0.5 * a) * (0.5 + 0.5 * a) * 0.8 + (0.5 + 0.5 * b) * (0.5 + 0.5 * b) * 0.4;
  float drape = sin(uv.y * 19.0 + 1.5 * sin(uv.x * 12.566)) * 0.25;
  return (crease * vFold + drape * 0.3) * ${cloth ? '1.0' : '0.0'};
}
float seamD(vec2 uv) { return abs(fract(uv.x * 2.0) - 0.5) * 0.5; }
vec3 bodyPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float fd) {
  vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * fd;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
${cloth ? `{ float fh = foldH(vBUv); diffuseColor.rgb *= 1.0 - 0.3 * vFold * (1.0 - clamp(fh / max(vFold, 0.01) / 1.1, 0.0, 1.0));
  float sd = seamD(vBUv), fw = fwidth(vBUv.x) * 0.6 + 1e-4;
  float line = 1.0 - smoothstep(0.005, 0.005 + fw, sd);
  float st = smoothstep(0.009 - fw, 0.009, sd) * (1.0 - smoothstep(0.0125, 0.0125 + fw, sd)) * step(0.45, fract(vBUv.y * 70.0));
  diffuseColor.rgb *= 1.0 - 0.4 * line;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + 0.04, st * 0.55); }` : ''}
diffuseColor.rgb *= vAO;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${cloth ? `{ float H = foldH(vBUv) * 0.0045 + (1.0 - smoothstep(0.0, 0.008, seamD(vBUv))) * 0.0012;
  normal = bodyPerturb(-vViewPosition, normal, vec2(dFdx(H), dFdy(H)) * 1.0, faceDirection); }` : ''}`)
      .replace('#include <opaque_fragment>', 'outgoingLight += uRim * vAO * pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'charBody23' + (cloth ? 'c' : 's');
  bodyMatCache.set(key, m);
  return m;
}

/**
 * Costruisce la geometria del corpo (coordinate del gruppo "body" a riposo).
 * B = indici delle ossa; mats = indici dei materiali; opz = varianti della skin.
 */
function bodyGeometry(o) {
  const P = [], N = [], U = [], SI = [], SW = [], F = [], tris = new Map();
  const tri = (m, a, b, c) => { if (!tris.has(m)) tris.set(m, []); tris.get(m).push(a, b, c); };
  const vert = (x, y, z, nx, ny, nz, u, v, w, f = 0) => {
    P.push(x, y, z); N.push(nx, ny, nz); U.push(u, v); F.push(f);
    const e = Object.entries(w).filter(([, k]) => k > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = e.reduce((s, [, k]) => s + k, 0) || 1;
    for (let i = 0; i < 4; i++) { SI.push(e[i] ? +e[i][0] : 0); SW.push(e[i] ? e[i][1] / tot : 0); }
    return P.length / 3 - 1;
  };
  /**
   * tubo verticale: profile [d, r] (d cresce verso il basso, o verso l'alto se up), centro (cx, y0, cz).
   * ring(d) → { m: materiale, s: scala raggio, sx: scala in x, w: pesi {osso: peso} }; split = d dove cambia stoffa (orlo)
   */
  const tube = (profile, cx, y0, cz, ring, up = false, splits = []) => {
    // normali dal profilo (prima degli orli)
    const nrm = profile.map((p, i) => {
      const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
      const dr = b[1] - a[1], dd = b[0] - a[0];
      if (p[1] < 1e-4) return [0, i === 0 ? -1 : 1];
      const l = Math.hypot(dr, dd) || 1; return [dd / l, -dr / l];   // [radiale, lungo d]
    });
    const rows = [];
    profile.forEach((p, i) => {
      rows.push({ d: p[0], r: p[1], n: nrm[i] });
      const sp = splits.find(x => x > p[0] && i + 1 < profile.length && x <= profile[i + 1][0]);
      if (sp !== undefined) {
        const nx = profile[i + 1], k = (sp - p[0]) / (nx[0] - p[0]), r = p[1] + (nx[1] - p[1]) * k;
        rows.push({ d: sp - 1e-5, r, n: nrm[i], hemA: true });
        rows.push({ d: sp + 1e-5, r, n: nrm[i + 1], hemB: true });
      }
    });
    let len = 0;
    const idx = rows.map((row, i) => {
      if (i) len += Math.hypot(row.d - rows[i - 1].d, row.r - rows[i - 1].r);
      const R = ring(row.d), sgn = up ? 1 : -1, y = y0 + sgn * row.d;
      const out = [];
      for (let j = 0; j <= SEG; j++) {
        const th = j / SEG * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th);
        const rx = -sn, rz = -cs;                                    // giunzione delle uv sul retro
        let nx = row.n[0] * rx / R.sx, ny = row.n[1] * sgn, nz = row.n[0] * rz;
        const l = Math.hypot(nx, ny, nz) || 1;
        out.push(vert(cx + rx * row.r * R.s * R.sx, y, cz + rz * row.r * R.s, nx / l, ny / l, nz / l, j / SEG, len / 0.5, R.w, R.f || 0));
      }
      return { out, m: R.m };
    });
    for (let i = 0; i < idx.length - 1; i++) {
      const A = idx[i].out, Bv = idx[i + 1].out, m = idx[i].m;
      for (let j = 0; j < SEG; j++) {
        if (up) { tri(m, A[j], A[j + 1], Bv[j]); tri(m, A[j + 1], Bv[j + 1], Bv[j]); }
        else { tri(m, A[j], Bv[j], A[j + 1]); tri(m, A[j + 1], Bv[j], Bv[j + 1]); }
      }
    }
  };
  const B = o.B;
  // ── gambe ──
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, L = i ? B.legR : B.legL;
    const hemD = o.shorts ? 0.36 : 99;
    tube(LEG_PROFILE, 0.105 * sd, RIG.hip, 0, (d) => {
      const kw = smoothstep(0.37, 0.51, d), aw = 0.7 * smoothstep(0.8, 0.88, d);
      const thighX = 1.04 * o.wk, s = d > hemD ? 0.86 : 1;
      // pieghe: dietro/davanti al ginocchio, stoffa che si accumula alla caviglia, inguine
      const f = d > hemD ? 0 : Math.max(Math.exp(-(((d - 0.45) / 0.07) ** 2)), 0.85 * smoothstep(0.66, 0.8, d), 0.55 * smoothstep(0.1, 0.0, d), 0.18);
      return { m: d > hemD ? o.M.skin : o.M.pants, s, sx: thighX + (1 - thighX) * smoothstep(0.3, 0.46, d), w: { [L[0]]: (1 - kw), [L[1]]: kw * (1 - aw), [L[2]]: kw * aw }, f };
    }, false, o.shorts ? [hemD] : []);
  }
  // ── braccia ──
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, A = i ? B.armR : B.armL;
    const hemD = o.upperM === o.foreM ? 99 : o.upperM === o.M.shirt ? 0.215 : 0.3;
    tube(ARM_PROFILE, RIG.shoulderX * sd, RIG.hip + RIG.shoulderY, 0, (d) => {
      const ew = smoothstep(0.24, 0.36, d), hw = 0.6 * smoothstep(0.56, 0.63, d);
      const upper = d < hemD;
      const s = upper ? (o.sleeveless ? 0.89 : 1) : (o.short ? 0.9 : 1);
      const cloth = (upper ? o.upperM : o.foreM) === o.M.shirt;
      const f = !cloth ? 0 : Math.max(Math.exp(-(((d - 0.31) / 0.06) ** 2)), 0.7 * smoothstep(0.45, 0.56, d), 0.5 * smoothstep(0.08, 0.0, d), 0.18);
      return { m: upper ? o.upperM : o.foreM, s, sx: 1, w: { [A[0]]: 1 - ew, [A[1]]: ew * (1 - hw), [A[2]]: ew * hw }, f };
    }, false, hemD < 9 ? [hemD] : []);
  }
  // ── collo: dal busto alla testa ──
  tube(NECK_PROFILE, 0, RIG.hip + 0.54, 0, (d) => ({ m: o.M.neck, s: 1, sx: 1, w: { [B.torso]: 1 - smoothstep(0.08, 0.17, d), [B.head]: smoothstep(0.08, 0.17, d) } }), true);
  // ── busto e bacino (le spalle seguono un po' le braccia, il bacino un po' le gambe) ──
  const addRigid = (g, dy, m, wfn, ffn = () => 0) => {
    const gp = g.attributes.position, gn = g.attributes.normal, gu = g.attributes.uv, base = P.length / 3;
    for (let k = 0; k < gp.count; k++) {
      const x = gp.getX(k), y = gp.getY(k) + dy, z = gp.getZ(k);
      vert(x, RIG.hip + y, z, gn.getX(k), gn.getY(k), gn.getZ(k), gu.getX(k), gu.getY(k), wfn(x, y, z), ffn(x, y, z));
    }
    const id = g.index;
    for (let k = 0; k < id.count; k += 3) tri(m, base + id.getX(k), base + id.getX(k + 1), base + id.getX(k + 2));
  };
  addRigid(torsoGeo(1), 0.02, o.M.shirt, (x, y) => {
    const ws = 0.55 * smoothstep(0.15, 0.235, Math.abs(x)) * smoothstep(0.36, 0.47, y);
    return { [B.torso]: 1 - ws, [x < 0 ? B.armL[0] : B.armR[0]]: ws };
  }, (x, y) => Math.max(0.6 * smoothstep(0.16, 0.04, y), 0.45 * smoothstep(0.17, 0.22, Math.abs(x)) * smoothstep(0.28, 0.4, y), 0.15));
  addRigid(pelvisGeo(), 0.04, o.M.pants, (x, y) => {
    const wh = 0.45 * smoothstep(0.0, 0.11, Math.abs(x)) * smoothstep(0.04, -0.07, y);
    return { [B.torso]: 1 - wh, [x < 0 ? B.legL[0] : B.legR[0]]: wh };
  }, () => 0.3);
  // gruppi per materiale (un'unica draw call per stoffa)
  const g = new THREE.BufferGeometry(), index = [];
  for (const [m, t] of [...tris.entries()].sort((a, b) => a[0] - b[0])) { g.addGroup(index.length, t.length, m); index.push(...t); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.setAttribute('aFold', new THREE.Float32BufferAttribute(F, 1));
  g.setAttribute('aAO', new THREE.Float32BufferAttribute(bakeAO(P, N), 1));
  g.setIndex(index);
  g.userData.shared = true;
  return g;
}

function buildBodySkin(skin, R) {
  const bones = [R.torso, R.legs[0], R.knees[0], R.feet[0], R.legs[1], R.knees[1], R.feet[1], R.arms[0], R.elbows[0], R.hands[0], R.arms[1], R.elbows[1], R.hands[1], R.head];
  const B = { torso: 0, legL: [1, 2, 3], legR: [4, 5, 6], armL: [7, 8, 9], armR: [10, 11, 12], head: 13 };
  // materiali: indici fissi 0..3 (maglia, pantaloni, pelle, collo)
  const isCloth = (mm) => mm !== R.skinM && !(mm.metalness > 0.5);
  const materials = [R.shirtM, R.pantsM, R.skinM, R.neckM].map(mm => bodyMat(mm, isCloth(mm)));
  const M = { shirt: 0, pants: 1, skin: 2, neck: 3 };
  const upperM = skin.sleeveless ? M.skin : M.shirt, foreM = skin.short ? M.skin : M.shirt;
  const key = [skin.shorts ? 1 : 0, skin.wide ? 1 : 0, upperM, foreM].join('|');
  let geo = skinGeoCache.get(key);
  if (!geo) {
    geo = bodyGeometry({ B, M, upperM, foreM, shorts: !!skin.shorts, sleeveless: !!skin.sleeveless, short: !!skin.short, wk: skin.wide ? 1.13 : 1 });
    skinGeoCache.set(key, geo);
  }
  const m = new THREE.SkinnedMesh(geo, materials);
  m.castShadow = true;
  m.name = 'bodySkin';
  // rig a riposo per il "bind": tutte le articolazioni sono ancora nella posa iniziale
  const top = R.torso.parent;
  top.add(m);
  let root = top; while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
  m.bind(new THREE.Skeleton(bones), m.matrixWorld);
  top.remove(m);
  m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 1.35);   // copre tutte le pose
  return m;
}

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
  const hairM = hairMat(skin.hair || '#333');
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
/** v30: profilo di rotazione [r, y] (cappelli), con schiacciamento opzionale in z */
function lathe(pts, seg = 20, sx = 1, sz = 1, uvs = 1) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.scale(sx, 1, sz); g.computeVertexNormals();
  if (uvs !== 1) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * uvs, u.getY(i) * uvs); }
  return g;
}
/** v30: tesa ad anello da r0 a r1 con altezza lift(r - r0, angolo) (0 = davanti, verso +z) */
function brimGeo(r0, r1, sz, lift, seg = 40, rs = 6) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rs; j++) for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2, r = r0 + (r1 - r0) * j / rs;
    pos.push(Math.sin(a) * r, lift(r - r0, a + Math.PI / 2), Math.cos(a) * r * sz);
    uv.push(i / seg * 6, j / rs);
  }
  for (let j = 0; j < rs; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** v30: corno ricurvo (verso l'esterno e poi in alto), base sul lato del casco */
function hornGeo() {
  const b = new THREE.CylinderGeometry(0.004, 0.042, 0.3, 12, 12); b.translate(0, 0.15, 0);
  const q = b.attributes.position, R = 0.19;
  for (let i = 0; i < q.count; i++) {
    const t = q.getY(i) / 0.3, an = t * 1.6, lx = q.getX(i), lz = q.getZ(i);
    // linea mediana ad arco (tangente iniziale +x, poi verso l'alto) e sezione perpendicolare
    const px = Math.sin(an) * R, py = (1 - Math.cos(an)) * R;
    q.setXYZ(i, px - lx * Math.sin(an), py + lx * Math.cos(an), lz + 0.03 * t * t);
  }
  b.computeVertexNormals(); return b;
}
/** v30: stellina a 5 punte (decori del cappello da mago) */
function starGeo() {
  const sh = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.011 : 0.026, a = k / 10 * Math.PI * 2; k ? sh.lineTo(Math.sin(a) * r, Math.cos(a) * r) : sh.moveTo(Math.sin(a) * r, Math.cos(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }); g.translate(0, 0, -0.003); return g;
}
function buildHat(id, skin, head) {
  const H = HATS.find(h => h.id === id) || { color: '#444' };
  // v23: tessuti veri (trama + rilievo) al posto dei colori pieni
  const c = texMat(['tophat'].includes(id) ? 'suit' : 'cotton', H.color), a = mat(H.accent || '#ffffff', { roughness: 0.6 });
  const g = new THREE.Group(); g.position.y = 0.3; head.add(g);
  switch (id) {
    case 'cap': {
      // berretto da baseball: 6 spicchi con cuciture, bottone, occhielli, visiera curva e cinturino dietro
      const seam = mat(darker(H.color, 0.55), { roughness: 0.9 });
      mesh(domeGeo(Math.PI / 2, 24), c, 0, -0.01, 0, g, 0.228, 0.172, 0.236);
      mesh(cachedGeo('capSeams', () => mergeSmooth([0, 1, 2, 3, 4, 5].map(i => [new THREE.TorusGeometry(1, 0.012, 3, 20, Math.PI / 2), { ry: i / 6 * Math.PI * 2 + Math.PI / 2, rz: 0 }]))), seam, 0, -0.01, 0, g, 0.229, 0.173, 0.237);
      sph(0.016, c, 0, 0.16, 0, g, 0.55);
      for (const an of [0.6, 1.6, 2.6, -0.6, -1.6, -2.6]) mesh(torusGeo(0.007, 0.002, 8), seam, Math.sin(an) * 0.135, 0.1, Math.cos(an) * 0.14, g).rotation.set(-0.9, an, 0, 'YXZ');
      // visiera: mezzo ovale sottile e smussato, curvata verso il basso ai lati
      mesh(cachedGeo('capBrim23', () => {
        const sh = new THREE.Shape(); sh.moveTo(-0.2, 0); sh.bezierCurveTo(-0.2, 0.34, 0.2, 0.34, 0.2, 0); sh.quadraticCurveTo(0, 0.06, -0.2, 0);
        const b = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
        b.rotateX(Math.PI / 2);
        const q = b.attributes.position;
        for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) - 0.9 * q.getX(i) * q.getX(i) - 0.15 * q.getZ(i) * q.getZ(i));
        b.computeVertexNormals(); return b;
      }), c, 0, 0.005, 0.085, g).rotation.x = 0.08;
      mesh(boxGeo(0.07, 0.022, 0.012), mat('#1e1e1e', { roughness: 0.5 }), 0, -0.02, -0.233, g);
      mesh(boxGeo(0.02, 0.014, 0.006), mat('#c8ccd2', { metalness: 0.85, roughness: 0.3 }), 0.022, -0.02, -0.24, g);
      break;
    }
    case 'beanie': {
      const k = texMat('knit', H.color);
      mesh(domeGeo(Math.PI / 2), k, 0, 0.0, 0, g, 0.222, 0.2, 0.228).rotation.x = -0.12;
      mesh(cylGeo(0.226, 0.226, 0.055, 18), texMat('knit', '#f2f2f2'), 0, -0.005, 0, g, 1, 1, 1.03);
      sph(0.055, texMat('knit', '#f2f2f2'), 0, 0.21, -0.03, g);
      break;
    }
    case 'cowboy': {
      // v30: corona con la piega in cima e tesa in cuoio rialzata ai lati, fascia con fibbia
      const l = texMat('felt', H.color, { side: THREE.DoubleSide });   // v31: feltro (prima cuoio)
      mesh(cachedGeo('cowCrown31', () => lathe([[0.214, -0.012], [0.213, 0.04], [0.205, 0.13], [0.196, 0.19], [0.17, 0.215], [0.1, 0.212], [0.03, 0.185], [0.0, 0.18]], 32, 1, 1.12, 3)), l, 0, 0, 0, g);
      mesh(cachedGeo('cowDent30', () => { const b = new THREE.BoxGeometry(0.035, 0.03, 0.3, 1, 1, 6); return b; }), mat(darker(H.color, 0.55), { roughness: 0.6 }), 0, 0.188, 0.0, g);
      mesh(cachedGeo('cowBrim30', () => brimGeo(0.212, 0.4, 1.12, (r, a) => 2.4 * r * r * Math.cos(a) ** 2 - 0.35 * r * r * Math.sin(a) ** 2 * (Math.sin(a) > 0 ? 1 : 0.4))), l, 0, -0.005, 0, g);
      mesh(cachedGeo('cowBand30', () => lathe([[0.2155, 0.0], [0.2145, 0.04]], 22, 1, 1.12)), texMat('leather', '#2a1a10', { side: THREE.DoubleSide }), 0, 0, 0, g);
      mesh(boxGeo(0.045, 0.035, 0.012), mat('#d8c070', { metalness: 0.9, roughness: 0.25 }), 0, 0.02, 0.239, g);   // fibbia
      for (const sx of [-1, 1]) mesh(boxGeo(0.006, 0.05, 0.008), mat('#d8c070', { metalness: 0.9, roughness: 0.25 }), 0.03 * sx, 0.02, 0.238, g);
      break;
    }
    case 'headphones': {
      // v30: archetto da orecchio a orecchio con imbottitura, padiglioni in similpelle, cursori e luci
      const shell = mat(H.color, { roughness: 0.35, metalness: 0.25 }), pad = texMat('leather', '#1c1c1e');
      mesh(cachedGeo('hpBand30', () => new THREE.TorusGeometry(0.236, 0.014, 8, 36, Math.PI)), shell, 0, -0.085, 0, g, 1, 1, 1.6);
      mesh(cachedGeo('hpPad30', () => new THREE.TorusGeometry(0.222, 0.016, 8, 24, Math.PI * 0.5)), pad, 0, -0.085, 0, g, 1, 1, 2.2).rotation.z = Math.PI * 0.25;
      mesh(cachedGeo('hpGlow30', () => new THREE.TorusGeometry(0.2505, 0.0035, 4, 30, Math.PI * 0.7)), glowMat(H.accent), 0, -0.085, 0.0, g, 1, 1, 1).rotation.z = Math.PI * 0.15;
      for (const s of [-1, 1]) {
        mesh(boxGeo(0.012, 0.07, 0.022), mat('#9aa0a8', { metalness: 0.85, roughness: 0.3 }), 0.242 * s, -0.115, 0, g);   // cursore
        const cup = new THREE.Group(); cup.position.set(0.25 * s, -0.16, 0.005); cup.rotation.set(0, 0, Math.PI / 2 - 0.08 * s); g.add(cup);
        // asse y locale del padiglione: +s verso la testa
        mesh(cachedGeo('hpCup30', () => lathe([[0.0, 0.0], [0.064, 0.0], [0.072, 0.012], [0.074, 0.03], [0.066, 0.046], [0.0, 0.05]], 20)), shell, 0, -0.012 * s, 0, cup, 1, s, 1.15);
        mesh(torusGeo(0.056, 0.02, 18), pad, 0, 0.045 * s, 0, cup, 1, 1, 1.15).rotation.x = Math.PI / 2;
        mesh(torusGeo(0.05, 0.005, 20), glowMat(H.accent), 0, -0.014 * s, 0, cup, 1, 1, 1.15).rotation.x = Math.PI / 2;
        mesh(cylGeo(0.03, 0.03, 0.006, 14), mat('#2a2a30', { metalness: 0.6, roughness: 0.3 }), 0, -0.016 * s, 0, cup, 1, 1, 1.15);
      }
      // microfono
      const mic = mesh(cachedGeo('hpMic30', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.24, -0.19, 0.03), new THREE.Vector3(0.22, -0.25, 0.12), new THREE.Vector3(0.14, -0.28, 0.2), new THREE.Vector3(0.08, -0.285, 0.22)]), 14, 0.006, 5)), shell, 0, 0, 0, g);
      void mic;
      sph(0.016, texMat('knit', '#202020'), 0.075, -0.285, 0.222, g);
      break;
    }
    case 'straw': {
      // v30: paglietta intrecciata a tesa larga, appena spiovente, con nastro e fiocco
      const st = texMat('straw', H.color, { side: THREE.DoubleSide });
      mesh(cachedGeo('straw30', () => lathe([[0.41, -0.03], [0.4, -0.018], [0.33, -0.004], [0.25, 0.006], [0.216, 0.01], [0.214, 0.06], [0.206, 0.17], [0.198, 0.2], [0.17, 0.212], [0.0, 0.216]], 28, 1, 1.04, 4)), st, 0, 0, 0, g);
      mesh(cachedGeo('strawEdge30', () => new THREE.TorusGeometry(0.405, 0.008, 5, 40)), st, 0, -0.026, 0, g, 1, 1, 1.04).rotation.x = Math.PI / 2;
      mesh(cachedGeo('strawBand30', () => lathe([[0.222, 0.012], [0.218, 0.058]], 24, 1, 1.04)), mat('#c0302a', { roughness: 0.55, side: THREE.DoubleSide }), 0, 0, 0, g);
      for (const sx of [-1, 1]) sph(0.022, mat('#c0302a', { roughness: 0.55 }), 0.035 * sx - 0.1, 0.035, 0.222, g, 0.6, 0.5).rotation.z = 0.5 * sx;
      sph(0.012, mat('#a0221e', { roughness: 0.55 }), -0.1, 0.035, 0.232, g);
      break;
    }
    case 'tophat': {
      // v30: cilindro in feltro con la corona appena svasata e la tesa arrotolata ai lati
      const felt = texMat('felt', H.color, { side: THREE.DoubleSide });
      mesh(cachedGeo('topCrown31', () => lathe([[0.213, -0.01], [0.206, 0.08], [0.2, 0.18], [0.208, 0.3], [0.218, 0.355], [0.214, 0.362], [0.0, 0.364]], 32, 1, 1.1, 3)), felt, 0, 0, 0, g);
      mesh(cachedGeo('topBrim30', () => brimGeo(0.21, 0.315, 1.1, (r, a) => 3.6 * r * r * Math.cos(a) ** 2 - 0.4 * r * r)), felt, 0, -0.004, 0, g);
      mesh(cachedGeo('topBand30', () => lathe([[0.2075, 0.012], [0.2045, 0.07]], 24, 1, 1.1)), texMat('silk', H.accent || '#a01a2a', { side: THREE.DoubleSide }), 0, 0, 0, g);
      mesh(boxGeo(0.04, 0.05, 0.012), texMat('silk', H.accent || '#a01a2a'), 0.12, 0.04, 0.19, g).rotation.y = 0.55;
      break;
    }
    case 'viking': {
      // v30: calotta a spicchi rivettati, cerchio di bronzo, paranaso e corna ricurve
      const vm = texMat('metal', H.color), br = texMat('metal', '#b08a3a');
      mesh(domeGeo(Math.PI / 2, 24), vm, 0, -0.03, 0, g, 0.235, 0.24, 0.244);
      for (let i = 0; i < 4; i++) mesh(cachedGeo('vikRib30', () => new THREE.TorusGeometry(1, 0.035, 4, 24, Math.PI)), br, 0, -0.03, 0, g, 0.237, 0.242, 0.246).rotation.y = i / 4 * Math.PI;
      mesh(cachedGeo('vikRim30', () => lathe([[0.244, -0.07], [0.248, -0.04], [0.244, -0.01]], 26, 1, 1.03)), br, 0, 0, 0, g);
      for (let i = 0; i < 14; i++) { const an = i / 14 * Math.PI * 2; sph(0.009, br, Math.sin(an) * 0.249, -0.04, Math.cos(an) * 0.256, g); }
      mesh(boxGeo(0.03, 0.11, 0.012), br, 0, -0.1, 0.25, g).rotation.x = -0.12;   // paranaso
      const horn = texMat('leather', H.accent || '#f0e8d0');
      for (const s of [-1, 1]) mesh(cachedGeo('vikHorn30', () => hornGeo()), horn, 0.215 * s, 0.0, 0.02, g, s, 1, 1);
      break;
    }
    case 'wizard': {
      // v30: cappello a punta floscio, piegato all'indietro, tesa ondulata, nastro e stelle
      const c2 = texMat('felt', H.color, { side: THREE.DoubleSide });
      mesh(cachedGeo('wizBrim30', () => brimGeo(0.21, 0.37, 1.05, (r, a) => 0.035 * Math.sin(a * 3 + 0.5) * (r / 0.16) - 0.3 * r * r)), c2, 0, -0.006, 0, g);
      mesh(cachedGeo('wizCone30', () => {
        const b = new THREE.ConeGeometry(0.214, 0.62, 22, 14, true); b.translate(0, 0.31, 0);
        const q = b.attributes.position;
        for (let i = 0; i < q.count; i++) { const y = q.getY(i), t = y / 0.62; q.setZ(i, q.getZ(i) * 1.05 - 0.32 * t * t * t); q.setY(i, y * (1 - 0.18 * t * t) + 0.03 * Math.sin(t * 9) * t); q.setX(i, q.getX(i) + 0.03 * Math.sin(t * 5) * t); }
        b.computeVertexNormals(); return b;
      }), c2, 0, -0.008, 0, g);
      mesh(cachedGeo('wizBand30', () => lathe([[0.215, 0.0], [0.198, 0.05]], 24, 1, 1.05)), texMat('silk', H.accent, { side: THREE.DoubleSide }), 0, 0, 0, g);
      for (let i = 0; i < 5; i++) {
        const t = 0.15 + i * 0.13, an = i * 2.1 + 0.6;
        const st = mesh(cachedGeo('wizStar30', () => starGeo()), glowMat(H.accent), Math.sin(an) * (0.2 - t * 0.27), 0.04 + t * 0.48, Math.cos(an) * (0.21 - t * 0.28) - 0.32 * (t / 0.62) ** 3 * 0.9, g);
        st.rotation.set(0, an, 0);
      }
      break;
    }
    case 'crown': {
      // v30: corona d'oro a punte con gigli, gemme incastonate e cuscino di velluto
      const gm = texMat('metal', H.color, { side: THREE.DoubleSide });
      mesh(cachedGeo('crownBand30', () => {
        const b = new THREE.CylinderGeometry(0.218, 0.212, 0.2, 48, 6, true); b.translate(0, 0.1, 0);
        const q = b.attributes.position;
        for (let i = 0; i < q.count; i++) { const y = q.getY(i); if (y < 0.06) continue; const an = Math.atan2(q.getX(i), q.getZ(i)); const peak = Math.pow(Math.abs(Math.cos(an * 4)), 6); q.setY(i, 0.06 + (y - 0.06) * (0.25 + 0.75 * peak)); }
        b.computeVertexNormals(); return b;
      }), gm, 0, -0.03, 0, g, 1, 1, 1.05);
      mesh(torusGeo(0.218, 0.012, 32), gm, 0, -0.028, 0, g, 1, 1, 1.05).rotation.x = Math.PI / 2;
      mesh(torusGeo(0.22, 0.008, 32), gm, 0, 0.03, 0, g, 1, 1, 1.05).rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        const an = i / 8 * Math.PI * 2;
        sph(0.016, gm, Math.sin(an) * 0.214, 0.172, Math.cos(an) * 0.214 * 1.05, g);
        sph(0.017, mat(i % 2 ? '#2a6ae0' : H.accent, { roughness: 0.1, metalness: 0.3, emissive: i % 2 ? '#2a6ae0' : H.accent, emissiveIntensity: 0.25 }), Math.sin(an + 0.39) * 0.226, 0.0, Math.cos(an + 0.39) * 0.226 * 1.05, g, 1, 1);
      }
      mesh(domeGeo(Math.PI / 2, 20), texMat('knit', '#8a1424'), 0, 0.02, 0, g, 0.205, 0.13, 0.215);
      mesh(cylGeo(0.012, 0.012, 0.05, 8), gm, 0, 0.17, 0, g);
      mesh(cylGeo(0.036, 0.036, 0.008, 4), gm, 0, 0.19, 0, g).rotation.x = Math.PI / 2;
      mesh(cylGeo(0.036, 0.036, 0.008, 4), gm, 0, 0.19, 0, g).rotation.set(Math.PI / 2, 0, Math.PI / 2);
      break;
    }
    case 'halo':
      mesh(torusGeo(0.17, 0.02, 20), glowMat(H.color), 0, 0.22, 0, g).rotation.x = Math.PI / 2;
      break;
    case 'beret': {
      const bm = texMat('felt', H.color);
      const bg = new THREE.Group(); bg.rotation.set(-0.08, 0, 0.22); bg.position.y = -0.055; g.add(bg);
      mesh(sphereGeo(18, 10), bm, -0.03, 0.125, -0.01, bg, 0.255, 0.075, 0.245);
      mesh(torusGeo(0.206, 0.016, 22), mat(darker(H.color, 0.6), { roughness: 0.8 }), 0, 0.07, 0, bg).rotation.x = Math.PI / 2;
      mesh(cylGeo(0.007, 0.011, 0.03, 6), bm, -0.03, 0.2, -0.01, bg);
      const badge = mesh(cylGeo(0.03, 0.03, 0.008, 12), mat(H.accent, { metalness: 0.9, roughness: 0.25 }), -0.075, 0.105, 0.19, bg);
      badge.rotation.x = Math.PI / 2 - 0.35;
      break;
    }
    case 'tactical': {
      // elmetto da combattimento: calotta in tessuto, binari laterali, paraorecchie e visore notturno alzato
      const hm = texMat('ripstop', H.color), dk = texMat('rubber', '#23251f');
      mesh(domeGeo(Math.PI / 2, 20), hm, 0, -0.035, -0.005, g, 0.243, 0.24, 0.252);
      mesh(torusGeo(0.243, 0.011, 24), dk, 0, -0.035, -0.005, g, 1, 1, 1.035).rotation.x = Math.PI / 2;
      for (const sx of [-1, 1]) {
        mesh(boxGeo(0.018, 0.026, 0.17), dk, 0.236 * sx, 0.01, -0.01, g).rotation.z = 0.18 * sx;
        mesh(cylGeo(0.062, 0.062, 0.035, 14), dk, 0.218 * sx, -0.085, 0, g).rotation.z = Math.PI / 2;
        mesh(cylGeo(0.045, 0.045, 0.037, 12), mat('#3a3d34', { roughness: 0.5 }), 0.22 * sx, -0.085, 0, g).rotation.z = Math.PI / 2;
      }
      mesh(boxGeo(0.06, 0.045, 0.025), dk, 0, 0.09, 0.228, g).rotation.x = -0.45;
      const nv = new THREE.Group(); nv.position.set(0, 0.17, 0.255); nv.rotation.x = -0.35; g.add(nv);
      mesh(boxGeo(0.1, 0.03, 0.035), dk, 0, -0.035, 0, nv);
      for (const sx of [-1, 1]) {
        mesh(cylGeo(0.021, 0.026, 0.085, 10), dk, 0.034 * sx, 0.01, 0, nv);
        mesh(cylGeo(0.017, 0.017, 0.004, 10), glowMat(H.accent), 0.034 * sx, 0.054, 0, nv);
      }
      mesh(boxGeo(0.035, 0.02, 0.045), glowMat('#ff3030'), 0, 0.12, -0.2, g).rotation.x = 0.7;   // luce stroboscopica
      mesh(boxGeo(0.07, 0.045, 0.01), mat('#8a9070'), 0.17, 0.11, -0.12, g).rotation.set(0.4, -0.9, 0.5);   // toppa in velcro
      break;
    }
    case 'santa': {
      // v31: velluto morbido che si piega e ricade di lato, bordo e pon pon di pelliccia a ciuffi
      const red = texMat('felt', H.color, { side: THREE.DoubleSide }), fur = texMat('plush', H.accent);
      const tipAt = (t) => new THREE.Vector3(0.2 * t * t * t * t + 0.01 * t, 0.43 * t - 0.17 * t * t * t * t, -0.1 * t * t);
      mesh(cachedGeo('santaCone31b', () => {
        const b = new THREE.CylinderGeometry(0.0, 1, 1, 24, 16, true); b.translate(0, 0.5, 0);
        const q = b.attributes.position;
        for (let i = 0; i < q.count; i++) {
          const t = q.getY(i), r = 0.216 * (1 - Math.pow(t, 1.25)) * (1 - 0.15 * t) + 0.012 * (1 - t) * Math.sin(Math.atan2(q.getX(i), q.getZ(i)) * 5 + t * 9);
          const c = tipAt(t), ax = q.getX(i), az = q.getZ(i), l = Math.hypot(ax, az) || 1;
          q.setXYZ(i, c.x + ax / l * r, c.y, c.z + az / l * r * 1.04);
        }
        b.computeVertexNormals(); return b;
      }), red, 0, 0.0, 0, g);
      mesh(cachedGeo('santaTrim31', () => {
        const b = new THREE.TorusGeometry(0.218, 0.045, 10, 40); b.rotateX(Math.PI / 2);
        const q = b.attributes.position;
        for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i), a = Math.atan2(x, z); const k = 1 + 0.06 * Math.sin(a * 23) * Math.cos(y * 60); q.setXYZ(i, x * (1 + (k - 1) * 0.3), y * k, z * 1.04 * (1 + (k - 1) * 0.3)); }
        b.computeVertexNormals(); return b;
      }), fur, 0, 0.0, 0, g);
      const tp = tipAt(1);
      mesh(cachedGeo('santaPom31', () => {
        const b = new THREE.IcosahedronGeometry(0.055, 3), q = b.attributes.position;
        for (let i = 0; i < q.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(q, i); const k = 1 + 0.12 * Math.sin(v.x * 140) * Math.sin(v.y * 130) * Math.sin(v.z * 150); q.setXYZ(i, v.x * k, v.y * k, v.z * k); }
        b.computeVertexNormals(); return b;
      }), fur, tp.x + 0.02, tp.y - 0.04, tp.z, g);
      break;
    }
    case 'foxears': {
      const fm = mat(H.color, { roughness: 0.95 }), inner = mat('#f2b8a8', { roughness: 1 }), tip = mat('#2a1a12', { roughness: 1 });
      mesh(cachedGeo('foxband30', () => new THREE.TorusGeometry(0.236, 0.012, 6, 26, Math.PI)), mat('#2a2a2a', { roughness: 0.5 }), 0, -0.085, 0.02, g, 1, 1, 1.5);
      for (const sx of [-1, 1]) {
        const e = new THREE.Group(); e.position.set(0.12 * sx, 0.155, 0.02); e.rotation.set(-0.12, 0, -0.38 * sx); g.add(e);
        mesh(coneGeo(0.075, 0.17, 6), fm, 0, 0, 0, e, 1, 1, 0.45);
        mesh(coneGeo(0.048, 0.115, 6), inner, 0, -0.015, 0.02, e, 1, 1, 0.3);
        mesh(coneGeo(0.03, 0.05, 6), tip, 0, 0.062, 0, e, 1, 1, 0.47);
        mesh(coneGeo(0.03, 0.06, 5), mat(H.accent, { roughness: 1 }), 0.02 * sx, -0.06, 0.03, e, 1, 1, 0.5).rotation.z = 0.5 * sx;
      }
      break;
    }
    case 'samurai': {
      // kabuto laccato con corna dorate (kuwagata) e paranuca a lamelle
      const lq = mat(H.color, { roughness: 0.32, metalness: 0.35 }), gold = mat(H.accent, { metalness: 0.9, roughness: 0.25 });
      const lqDS = mat(H.color, { roughness: 0.32, metalness: 0.35, side: THREE.DoubleSide });
      mesh(domeGeo(Math.PI / 2, 20), lq, 0, -0.02, -0.005, g, 0.24, 0.225, 0.248);
      for (let i = 0; i < 4; i++) { const r = mesh(cachedGeo('kabutoRib', () => new THREE.TorusGeometry(1, 0.022, 4, 24, Math.PI)), gold, 0, -0.02, -0.005, g, 0.242, 0.228, 0.25); r.rotation.y = i / 4 * Math.PI; }
      mesh(torusGeo(0.24, 0.012, 24), gold, 0, -0.02, -0.005, g, 1, 1, 1.035).rotation.x = Math.PI / 2;
      mesh(cylGeo(0.034, 0.04, 0.025, 12), gold, 0, 0.21, 0, g);
      for (let i = 0; i < 3; i++) {
        const r0 = 0.25 + i * 0.03;
        mesh(cachedGeo('shikoro' + i, () => new THREE.CylinderGeometry(r0, r0 + 0.05, 0.05, 22, 1, true, Math.PI * 0.32, Math.PI * 1.36)), lqDS, 0, -0.05 - i * 0.042, -0.01, g);
        mesh(cachedGeo('shikoroG' + i, () => new THREE.CylinderGeometry(r0 + 0.05, r0 + 0.052, 0.008, 22, 1, true, Math.PI * 0.32, Math.PI * 1.36)), gold, 0, -0.075 - i * 0.042, -0.01, g);
      }
      for (const sx of [-1, 1]) {
        mesh(boxGeo(0.02, 0.09, 0.1), lq, 0.255 * sx, -0.05, 0.12, g).rotation.y = 0.55 * sx;
        mesh(boxGeo(0.022, 0.06, 0.07), gold, 0.257 * sx, -0.05, 0.12, g).rotation.y = 0.55 * sx;
        mesh(boxGeo(0.026, 0.26, 0.012), gold, 0.075 * sx, 0.16, 0.235, g).rotation.set(-0.2, 0, -0.42 * sx);
      }
      mesh(cylGeo(0.04, 0.04, 0.012, 16), mat('#c0202a', { roughness: 0.4 }), 0, 0.055, 0.238, g).rotation.x = Math.PI / 2 - 0.15;
      mesh(boxGeo(0.3, 0.014, 0.08), lq, 0, -0.012, 0.215, g).rotation.x = 0.28;
      break;
    }
    case 'bucket': {
      // cappello a secchiello da esploratore (Leo), leggermente inclinato all'indietro
      const bm = texMat('ripstop', H.color, { side: THREE.DoubleSide });
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

/** v30: piuma (lunghezza 1 verso il basso, larghezza 1): sagoma affusolata appena incurvata */
function featherGeo() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.quadraticCurveTo(0.55, -0.12, 0.5, -0.6); sh.quadraticCurveTo(0.4, -0.95, 0.05, -1.0); sh.quadraticCurveTo(-0.35, -0.9, -0.45, -0.55); sh.quadraticCurveTo(-0.5, -0.12, 0, 0);
  const geo = new THREE.ShapeGeometry(sh, 6);
  const q = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i); q.setZ(i, -0.25 * x * x + 0.04 * y * y); uv.setXY(i, x * 0.5 + 0.5, -y); }
  geo.computeVertexNormals(); return geo;
}
/** zaini e oggetti sulla schiena (config BACKPACKS) */
function buildBack(id, skin, torso) {
  const B = BACKPACKS.find(b => b.id === id) || { color: skin.backpack || '#7a5a2a', accent: skin.accColor || '#333' };
  const nylon = ['skinpack', 'school', 'hiker'].includes(id);
  const c = nylon ? texMat('ripstop', id === 'skinpack' ? skin.backpack : B.color) : mat(B.color, { roughness: 0.85, map: fabricTex() });
  const a = nylon ? texMat('cordura', B.accent || '#333') : mat(B.accent || '#333', { roughness: 0.6 });
  const g = new THREE.Group(); g.position.set(0, 0.36, -0.15); torso.add(g);
  const web = texMat('webbing', '#24252a'), buckle = mat('#9aa0a8', { metalness: 0.85, roughness: 0.3 });
  // spallacci che passano sopra le spalle e scendono sul petto
  const straps = (m = web) => {
    for (const sx of [-1, 1]) {
      mesh(cachedGeo('strap' + sx, () => surfTube([onTorso(0.1 * sx, 0.44, 0.014, true), new THREE.Vector3(0.1 * sx, 0.585, 0), onTorso(0.1 * sx, 0.5, 0.012), onTorso(0.108 * sx, 0.38, 0.012), onTorso(0.118 * sx, 0.24, 0.01)], 0.014)), m, 0, 0, 0, torso, 1);
      const bk = onTorso(0.108 * sx, 0.36, 0.024); mesh(boxGeo(0.04, 0.03, 0.012), buckle, bk.x, bk.y, bk.z, torso);
    }
    const sc = onTorso(0, 0.42, 0.016);
    mesh(boxGeo(0.2, 0.018, 0.012), m, sc.x, sc.y, sc.z - 0.004, torso);   // cinghia sternale
  };
  // tracolla in diagonale (spada, chitarra, faretra...)
  const sling = (m = web) => mesh(cachedGeo('sling', () => surfTube([onTorso(0.15, 0.2, 0.014, true), onTorso(0.02, 0.36, 0.014, true), onTorso(-0.1, 0.5, 0.014, true), new THREE.Vector3(-0.12, 0.585, 0), onTorso(-0.1, 0.5, 0.012), onTorso(0.0, 0.38, 0.012), onTorso(0.1, 0.27, 0.012), onTorso(0.16, 0.18, 0.012)], 0.016)), m, 0, 0, 0, torso, 1);
  switch (id) {
    case 'skinpack':
    case 'school': {
      // v23: zaino vero: corpo squadrato con spigoli morbidi, tasca frontale, cerniere con cursori, tasche laterali a rete
      const zipM = mat('#1e1e22', { roughness: 0.5 });
      mesh(roundBoxGeo(0.3, 0.37, 0.13, 0.05), c, 0, 0.0, -0.08, g);
      mesh(roundBoxGeo(0.25, 0.3, 0.035, 0.015), texMat('cordura', darker(B.color || skin.backpack || '#555', 0.6)), 0, 0.0, -0.012, g);   // schienale imbottito
      mesh(roundBoxGeo(0.23, 0.14, 0.055, 0.025), a, 0, -0.085, -0.155, g);                       // tasca frontale
      // cerniere: arco sul fianco del corpo e sulla tasca
      mesh(cachedGeo('zipMain', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.152, -0.15, 0), new THREE.Vector3(-0.152, 0.12, 0), new THREE.Vector3(-0.12, 0.178, 0), new THREE.Vector3(0, 0.188, 0), new THREE.Vector3(0.12, 0.178, 0), new THREE.Vector3(0.152, 0.12, 0), new THREE.Vector3(0.152, -0.15, 0)]), 30, 0.005, 4)), zipM, 0, 0, -0.105, g);
      mesh(cachedGeo('zipPocket', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.11, -0.13, 0), new THREE.Vector3(-0.1, -0.03, 0), new THREE.Vector3(0, -0.012, 0), new THREE.Vector3(0.1, -0.03, 0), new THREE.Vector3(0.11, -0.13, 0)]), 20, 0.004, 4)), zipM, 0, 0, -0.184, g);
      for (const [x, y, z] of [[-0.07, 0.186, -0.105], [0.07, 0.186, -0.105], [0.04, -0.016, -0.186]]) {
        mesh(boxGeo(0.016, 0.01, 0.01), buckle, x, y, z, g);
        mesh(boxGeo(0.009, 0.034, 0.004), zipM, x, y - 0.02, z - 0.008, g).rotation.x = 0.3;
      }
      mesh(torusGeo(0.035, 0.008, 10), web, 0, 0.2, -0.04, g).rotation.y = Math.PI / 2;           // maniglia
      for (const sx of [-1, 1]) mesh(roundBoxGeo(0.045, 0.12, 0.09, 0.02), texMat('cordura', darker(B.accent || '#333', 0.85)), 0.165 * sx, -0.09, -0.08, g);   // tasche laterali
      mesh(boxGeo(0.12, 0.012, 0.004), mat('#d8dde4', { metalness: 0.6, roughness: 0.25 }), 0, -0.12, -0.184, g);   // striscia riflettente
      straps();
      break;
    }
    case 'hiker':
      mesh(capsuleGeo(0.15, 0.3, 10), c, 0, 0.06, -0.08, g, 1, 1, 0.6);
      mesh(sphereGeo(14, 8), c, 0, 0.27, -0.085, g, 0.155, 0.06, 0.1);                           // coperchio
      mesh(cylGeo(0.06, 0.06, 0.32, 10), a, 0, 0.3, -0.06, g).rotation.z = Math.PI / 2;   // sacco a pelo
      for (const sx of [-1, 1]) mesh(torusGeo(0.064, 0.007, 12), web, 0.1 * sx, 0.3, -0.06, g).rotation.y = Math.PI / 2;
      mesh(boxGeo(0.2, 0.12, 0.06), a, 0, -0.08, -0.16, g);
      for (const sx of [-1, 1]) {
        mesh(cylGeo(0.008, 0.008, 0.5, 6), buckle, 0.15 * sx, 0.07, -0.02, g);                   // telaio
        mesh(boxGeo(0.02, 0.014, 0.1), web, 0.148 * sx, 0.12, -0.08, g);                          // cinghie di compressione
        mesh(boxGeo(0.02, 0.014, 0.1), web, 0.148 * sx, -0.02, -0.08, g);
      }
      mesh(cylGeo(0.032, 0.032, 0.13, 12), mat('#2a8ad0', { roughness: 0.3, metalness: 0.3 }), 0.17, -0.07, -0.08, g);   // borraccia
      mesh(cylGeo(0.018, 0.018, 0.02, 8), mat('#1a1a1a'), 0.17, 0.005, -0.08, g);
      mesh(torusGeo(0.02, 0.004, 10), mat('#ff7a1a', { metalness: 0.6, roughness: 0.3 }), -0.1, -0.15, -0.2, g);       // moschettone
      straps();
      break;
    case 'tactical': {
      const tm = texMat('ripstop', B.color);
      mesh(boxGeo(0.3, 0.36, 0.12), tm, 0, 0.02, -0.07, g);
      mesh(boxGeo(0.26, 0.15, 0.06), tm, 0, -0.06, -0.16, g);                                    // tasca grande
      for (let i = 0; i < 4; i++) mesh(boxGeo(0.305, 0.016, 0.125), web, 0, 0.16 - i * 0.045, -0.07, g);   // fettucce MOLLE
      for (let i = 0; i < 2; i++) mesh(boxGeo(0.265, 0.014, 0.065), web, 0, -0.02 - i * 0.05, -0.16, g);
      for (const sx of [-1, 1]) mesh(boxGeo(0.07, 0.12, 0.08), tm, 0.18 * sx, -0.04, -0.07, g);   // tasche laterali
      mesh(boxGeo(0.07, 0.1, 0.045), mat(B.accent, { roughness: 0.55 }), 0.1, 0.18, -0.04, g);   // radio
      mesh(cylGeo(0.004, 0.006, 0.5, 6), mat('#111'), 0.12, 0.47, -0.04, g).rotation.z = -0.08;   // antenna
      sph(0.01, mat('#111'), 0.14, 0.72, -0.04, g);
      mesh(boxGeo(0.012, 0.012, 0.004), glowMat('#3aff6a'), 0.08, 0.22, -0.064, g);
      mesh(boxGeo(0.09, 0.055, 0.006), mat('#7a8460'), -0.05, 0.1, -0.133, g);                  // toppa
      straps();
      break;
    }
    case 'quiver': {
      const qg = new THREE.Group(); qg.rotation.z = 0.45; qg.position.set(0, 0.04, -0.07); g.add(qg);
      const lm = texMat('leather', B.color);
      mesh(cylGeo(0.07, 0.055, 0.5, 14), lm, 0, 0, -0.02, qg);
      mesh(torusGeo(0.07, 0.01, 14), mat('#d8b048', { metalness: 0.85, roughness: 0.3 }), 0, 0.25, -0.02, qg).rotation.x = Math.PI / 2;
      for (const y of [-0.12, 0.1]) mesh(torusGeo(0.068 - (y + 0.12) * 0.03, 0.008, 14), mat('#2a1a10'), 0, y, -0.02, qg).rotation.x = Math.PI / 2;
      const shaft = mat('#c8a070', { roughness: 0.7 }), fl = mat(B.accent, { roughness: 0.8, side: THREE.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const an = i / 6 * Math.PI * 2, ax = Math.cos(an) * 0.035, az = Math.sin(an) * 0.035 - 0.02, h = 0.12 + (i % 3) * 0.03;
        mesh(cylGeo(0.005, 0.005, h, 5), shaft, ax, 0.25 + h / 2, az, qg);
        for (const r of [0, Math.PI / 2]) mesh(boxGeo(0.002, 0.06, 0.026), i % 2 ? fl : mat('#f2f2ea', { side: THREE.DoubleSide }), ax, 0.22 + h, az, qg).rotation.y = r + an;
      }
      sling(texMat('leather', '#3a2414'));
      break;
    }
    case 'surf': {
      const sg = new THREE.Group(); sg.rotation.z = 0.28; sg.position.set(0, 0.05, -0.1); g.add(sg);
      // v31: tavola in vetroresina lucida (niente venature di legno), listello centrale, bordi colorati e grafica
      sg.scale.setScalar(0.9);
      const glass = new THREE.MeshPhysicalMaterial({ color: B.color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
      const accM = new THREE.MeshPhysicalMaterial({ color: B.accent, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
      mesh(capsuleGeo(0.16, 0.74, 18), glass, 0, 0, 0, sg, 1, 1, 0.13);
      mesh(capsuleGeo(0.163, 0.74, 18), accM, 0, 0, 0.0, sg, 1, 1.002, 0.06);                    // bordo (rail) colorato
      mesh(boxGeo(0.006, 1.02, 0.044), texMat('wood', '#c89a5a'), 0, 0, 0, sg);                   // listello di legno
      for (const [y, w] of [[0.27, 0.2], [0.21, 0.24]]) mesh(boxGeo(w, 0.018, 0.0435), accM, 0, y, 0, sg);
      mesh(cylGeo(0.06, 0.06, 0.0436, 20), mat('#ff7a2a', { roughness: 0.3 }), 0, -0.12, 0, sg).rotation.x = Math.PI / 2;   // logo
      mesh(cylGeo(0.04, 0.04, 0.0438, 20), glass, 0, -0.12, 0, sg).rotation.x = Math.PI / 2;
      for (const [dx, h] of [[0, 0.09], [0.06, 0.07], [-0.06, 0.07]]) mesh(boxGeo(0.006, h, 0.075), accM, dx, -0.42, -0.055, sg).rotation.x = 0.25;   // tre pinne
      mesh(cylGeo(0.004, 0.004, 0.3, 6), mat('#202020', { roughness: 0.6 }), 0, -0.6, -0.03, sg);   // leash
      sling();
      break;
    }
    case 'shield': {
      const shg = new THREE.Group(); shg.position.set(0, 0.0, -0.1); shg.rotation.z = 0.12; g.add(shg);
      const wood = texMat('wood', B.color), met = texMat('metal', B.accent);
      mesh(cylGeo(0.27, 0.27, 0.03, 26), wood, 0, 0, 0, shg).rotation.x = Math.PI / 2;
      for (let i = -2; i <= 2; i++) mesh(boxGeo(0.006, 0.5 - Math.abs(i) * 0.08, 0.034), mat(darker(B.color, 0.55)), i * 0.1, 0, 0, shg);
      mesh(cylGeo(0.13, 0.13, 0.032, 22), mat('#a01e22', { roughness: 0.7 }), 0, 0, -0.001, shg, 1, 1, 1).rotation.x = Math.PI / 2;
      mesh(torusGeo(0.27, 0.016, 28), met, 0, 0, 0, shg);
      sph(0.065, met, 0, 0, -0.018, shg, 1, 0.55);
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2; sph(0.012, met, Math.cos(an) * 0.22, Math.sin(an) * 0.22, -0.017, shg); }
      sling(texMat('leather', '#3a2414'));
      break;
    }
    case 'guitar': {
      // v30: chitarra acustica vera: cassa sagomata in legno con bordo, rosetta, ponte, manico con tasti e paletta con meccaniche
      const gg = new THREE.Group(); gg.rotation.z = 0.6; gg.position.z = -0.085; g.add(gg);
      const top = texMat('wood', B.color), side = texMat('wood', darker(B.color, 0.6)), neckM = texMat('wood', B.accent);
      const body = mesh(cachedGeo('guitarBody30', () => {
        const pts = [];
        const hw = (y) => Math.max(Math.sqrt(Math.max(0, 0.15 ** 2 - (y + 0.12) ** 2)), Math.sqrt(Math.max(0, 0.112 ** 2 - (y - 0.07) ** 2)));
        for (let k = 0; k <= 30; k++) { const y = -0.27 + k / 30 * 0.452; pts.push(new THREE.Vector2(hw(y), y)); }
        const sh = new THREE.Shape(); sh.moveTo(0, -0.27);
        for (const p of pts) sh.lineTo(p.x, p.y);
        for (let k = pts.length - 1; k >= 0; k--) sh.lineTo(-pts[k].x, pts[k].y);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
        geo.translate(0, 0, -0.03); geo.computeVertexNormals();
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
        return geo;
      }), [top, side], 0, 0, 0, gg);
      void body;
      mesh(torusGeo(0.04, 0.006, 20), mat('#e8d8b0', { roughness: 0.5 }), 0, -0.02, -0.037, gg);                 // rosetta
      mesh(cylGeo(0.036, 0.036, 0.004, 18), mat('#140c06', { roughness: 0.9 }), 0, -0.02, -0.035, gg).rotation.x = Math.PI / 2;   // buca
      mesh(boxGeo(0.1, 0.022, 0.012), texMat('wood', '#2a160a'), 0, -0.17, -0.04, gg);                          // ponte
      mesh(boxGeo(0.052, 0.4, 0.024), neckM, 0, 0.37, -0.005, gg);                                               // manico
      mesh(boxGeo(0.046, 0.38, 0.005), mat('#1a0f08', { roughness: 0.6 }), 0, 0.36, -0.019, gg);                 // tastiera
      for (let i = 0; i < 9; i++) mesh(boxGeo(0.047, 0.002, 0.003), mat('#d8d8d8', { metalness: 0.9, roughness: 0.3 }), 0, 0.2 + i * 0.038, -0.022, gg);
      mesh(roundBoxGeo(0.075, 0.13, 0.02, 0.008), neckM, 0, 0.62, 0.0, gg);                                     // paletta
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) mesh(cylGeo(0.006, 0.006, 0.03, 6), mat('#d8d8d8', { metalness: 0.9, roughness: 0.3 }), 0.048 * sx, 0.58 + k * 0.035, 0, gg).rotation.z = Math.PI / 2;
      for (let i = 0; i < 6; i++) mesh(boxGeo(0.0018, 0.6, 0.002), mat('#e0e0e0', { metalness: 0.9, roughness: 0.3 }), -0.0125 + i * 0.005, 0.2, -0.026, gg);   // corde
      sling(texMat('webbing', '#1a1a1a'));
      break;
    }
    case 'sword': {
      // v30: spadone nel fodero di cuoio con puntale e fascette di metallo, elsa ricurva, impugnatura fasciata e pomolo luminoso
      const sg = new THREE.Group(); sg.rotation.z = -0.7; sg.position.z = -0.075; g.add(sg);
      const gold = texMat('metal', B.accent), steel = texMat('metal', B.color), lth = texMat('leather', '#4a2a16');
      mesh(cachedGeo('scabbard30', () => {
        const sh = new THREE.Shape(); sh.moveTo(-0.045, 0.26); sh.lineTo(0.045, 0.26); sh.lineTo(0.04, -0.36); sh.quadraticCurveTo(0, -0.46, -0.04, -0.36); sh.closePath();
        return new THREE.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
      }), lth, 0, 0, -0.012, sg);
      for (const y of [0.22, -0.05]) mesh(boxGeo(0.104, 0.03, 0.044), gold, 0, y, 0, sg);
      mesh(coneGeo(0.05, 0.1, 4), gold, 0, -0.41, 0, sg, 1, 1, 0.42).rotation.set(Math.PI, Math.PI / 4, 0);   // puntale
      mesh(boxGeo(0.07, 0.03, 0.016), steel, 0, 0.275, 0, sg);                                                  // tallone della lama
      mesh(cachedGeo('guard30', () => { const c = new THREE.TorusGeometry(0.16, 0.014, 6, 16, Math.PI * 0.5); c.rotateZ(Math.PI * 0.25); c.translate(0, -0.2, 0); return c; }), gold, 0, 0.5, 0, sg, 1, 1, 1.4);
      mesh(cylGeo(0.021, 0.024, 0.15, 8), lth, 0, 0.39, 0, sg);
      for (let k = 0; k < 6; k++) mesh(torusGeo(0.023, 0.004, 8), mat('#2a1a10'), 0, 0.33 + k * 0.024, 0, sg).rotation.set(Math.PI / 2, 0, 0.3);
      mesh(cylGeo(0.03, 0.022, 0.03, 8), gold, 0, 0.475, 0, sg);
      sph(0.032, glowMat('#ff3a3a'), 0, 0.5, 0, sg);
      sling(texMat('leather', '#3a2414'));
      break;
    }
    case 'jetpack': {
      // v30: due serbatoi in metallo spazzolato con fasce, centralina con spie, tubi, ugelli e fiamme
      const jm = texMat('metal', B.color), dk = mat('#2a2c30', { metalness: 0.7, roughness: 0.35 });
      for (const s of [-1, 1]) {
        mesh(cachedGeo('jetTank30', () => lathe([[0.0, -0.17], [0.05, -0.165], [0.068, -0.14], [0.072, -0.1], [0.072, 0.1], [0.066, 0.15], [0.045, 0.18], [0.02, 0.192], [0.0, 0.194]], 16)), jm, 0.088 * s, 0.02, -0.085, g);
        for (const y of [-0.08, 0.1]) mesh(torusGeo(0.073, 0.006, 16), mat(B.accent, { roughness: 0.4 }), 0.088 * s, y, -0.085, g).rotation.x = Math.PI / 2;
        mesh(cachedGeo('jetNoz30', () => lathe([[0.03, 0.0], [0.04, -0.02], [0.058, -0.08], [0.054, -0.085], [0.034, -0.03], [0.026, 0.0]], 14)), dk, 0.088 * s, -0.15, -0.085, g);
        mesh(coneGeo(0.042, 0.18, 10), glowMat(B.accent), 0.088 * s, -0.32, -0.085, g).rotation.x = Math.PI;
        mesh(coneGeo(0.022, 0.1, 8), glowMat('#fff2c0'), 0.088 * s, -0.27, -0.085, g).rotation.x = Math.PI;
        mesh(cylGeo(0.012, 0.012, 0.04, 8), dk, 0.088 * s, 0.22, -0.085, g);   // valvola
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.088 * s, 0.24, -0.085), new THREE.Vector3(0.05 * s, 0.27, -0.06), new THREE.Vector3(0.0, 0.2, -0.05)]), 8, 0.007, 5), texMat('rubber', '#1a1a1a'), 0, 0, 0, g);
      }
      mesh(roundBoxGeo(0.11, 0.24, 0.07, 0.02), texMat('metal', darker(B.color, 0.55)), 0, 0.02, -0.04, g);
      mesh(boxGeo(0.06, 0.04, 0.006), mat('#101418', { roughness: 0.2 }), 0, 0.08, -0.076, g);
      for (let k = 0; k < 3; k++) mesh(boxGeo(0.01, 0.01, 0.006), glowMat(['#3aff6a', '#ffd23a', '#ff3a3a'][k]), -0.018 + k * 0.018, 0.08, -0.08, g);
      for (let k = 0; k < 4; k++) mesh(boxGeo(0.08, 0.006, 0.006), dk, 0, -0.02 - k * 0.02, -0.077, g);   // griglia
      straps(texMat('webbing', '#202226'));
      break;
    }
    case 'wings': {
      // v30: ali d'angelo piumate: ossatura ad arco con copritrici corte e remiganti lunghe, piume con texture
      const fm = texMat('feather', B.color, { side: THREE.DoubleSide, emissive: B.accent, emissiveIntensity: 0.08 });
      const fm2 = texMat('feather', darker(B.color, 0.9), { side: THREE.DoubleSide, emissive: B.accent, emissiveIntensity: 0.05 });
      const arm = (t) => new THREE.Vector3(0.06 + 0.62 * t, 0.12 + 0.34 * Math.sin(t * 2.4) - 0.16 * t * t, -0.02 - 0.05 * t);
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(0.05 * s, 0.08, -0.08); w.rotation.set(0.05, 0.4 * s, 0); w.scale.x = s; g.add(w);
        const ap = []; for (let k = 0; k <= 8; k++) ap.push(arm(k / 8));
        mesh(cachedGeo('wingArm30', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ap), 16, 0.028, 6)), fm, 0, 0, 0, w);
        // remiganti (lunghe, verso il basso e l'esterno), poi copritrici sopra
        for (const [row, n, len0, len1, dz, m] of [[0, 13, 0.24, 0.6, 0, fm2], [1, 11, 0.14, 0.3, -0.012, fm], [2, 9, 0.08, 0.14, -0.022, fm]]) {
          for (let k = 0; k < n; k++) {
            const t = 0.04 + k / (n - 1) * (row ? 0.9 : 0.98), p = arm(t);
            const L = len0 + (len1 - len0) * Math.pow(t, 1.2) * (row === 0 && t > 0.85 ? 0.9 : 1);
            const f = mesh(cachedGeo('feather30', () => featherGeo()), m, p.x, p.y + 0.01, p.z + dz - k * 0.0006, w, 0.11 + 0.08 * (row === 0 ? t : 0.5), L, 1);
            f.rotation.set(0.12 + row * 0.05, 0, -0.1 + t * (row === 0 ? 1.15 : 0.7));
          }
        }
      }
      break;
    }
    case 'dragonwings': {
      // v30: ali di drago: ossa con artigli, quattro dita a ventaglio e membrana venata con il bordo a festoni
      const memM = texMat('membrane', B.color, { side: THREE.DoubleSide }), boneM = texMat('leather', darker(B.color, 0.5)), claw = mat('#e8dcc0', { roughness: 0.4 });
      const W0 = new THREE.Vector2(0.05, 0.06), Wr = new THREE.Vector2(0.34, 0.34);
      const tips = [new THREE.Vector2(0.66, 0.42), new THREE.Vector2(0.72, 0.08), new THREE.Vector2(0.56, -0.22), new THREE.Vector2(0.28, -0.32)];
      for (const s of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(0.05 * s, 0.06, -0.09); w.rotation.set(0, 0.42 * s, 0.05 * s); w.scale.x = s; g.add(w);
        mesh(cachedGeo('dwMemb30', () => {
          const sh = new THREE.Shape(); sh.moveTo(W0.x, W0.y); sh.lineTo(Wr.x, Wr.y); sh.lineTo(tips[0].x, tips[0].y);
          const all = [...tips, new THREE.Vector2(0.03, -0.16)];
          for (let k = 0; k < all.length - 1; k++) { const a = all[k], b = all[k + 1]; const mid = a.clone().add(b).multiplyScalar(0.5).lerp(Wr, 0.28); sh.quadraticCurveTo(mid.x, mid.y, b.x, b.y); }
          sh.closePath();
          const geo = new THREE.ShapeGeometry(sh, 8);
          const q = geo.attributes.position, uv = geo.attributes.uv;
          for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i); q.setZ(i, -0.06 * Math.sin(Math.min(1, x / 0.7) * Math.PI) - 0.03 * x); uv.setXY(i, x * 2.5, y * 2.5); }
          geo.computeVertexNormals(); return geo;
        }), memM, 0, 0, 0, w);
        rod(new THREE.Vector3(W0.x, W0.y, 0), new THREE.Vector3(Wr.x, Wr.y, -0.02), 0.022, boneM, w, 7);
        tips.forEach((tp, k) => {
          const zt = -0.06 * Math.sin(Math.min(1, tp.x / 0.7) * Math.PI) - 0.03 * tp.x;
          rod(new THREE.Vector3(Wr.x, Wr.y, -0.02), new THREE.Vector3(tp.x, tp.y, zt), 0.013 - k * 0.002, boneM, w, 6);
          mesh(coneGeo(0.012, 0.05, 6), claw, tp.x, tp.y, zt, w).rotation.z = -Math.atan2(tp.x - Wr.x, tp.y - Wr.y);
        });
        sph(0.032, boneM, Wr.x, Wr.y, -0.02, w);
        mesh(coneGeo(0.016, 0.08, 6), claw, Wr.x + 0.01, Wr.y + 0.06, -0.02, w).rotation.z = -0.3;   // artiglio del pollice
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

// ─────────────── Armi ───────────────
// I modelli, le texture e le icone delle armi sono in weapons.js
export { buildWeaponMesh } from './weapons.js?v=34';
import { buildConsumableMesh, buildAmmoMesh } from './items.js?v=34';
function rnd(a, b) { return a + Math.random() * (b - a); }

/** Modelli semplici per consumabili e munizioni a terra */
export function buildItemMesh(kind, id) {
  const g = new THREE.Group();
  if (kind === 'cons') {
    const c = buildConsumableMesh(id);
    if (c) return c;
  } else if (kind === 'ammo') {
    const a = buildAmmoMesh(id);   // v27: cassette di munizioni con texture
    if (a) return a;
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
/** v30: deltaplano vero: vela a doppia superficie con bombatura e bordo d'uscita a festoni tra le stecche,
 *  tasca del bordo d'attacco, chiglia, traversa, king post con i cavi, trapezio di comando, imbrago e alette.
 *  La vela ha una texture disegnata per ogni modello (fiamme, tigre, stelle, arcobaleno…) */
const GL_W = 2.15, GL_NOSE = 1.35, GL_TIP_Z = -0.42;
function gliderSail(under) {
  return cachedGeo('glSail30' + (under ? 'u' : ''), () => {
    const nu = 48, nv = under ? 6 : 16, pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const sgn = i / nu * 2 - 1, a = Math.abs(sgn), vv = j / nv * (under ? 0.42 : 1);
      const leZ = GL_NOSE - a * (GL_NOSE - GL_TIP_Z);
      const scal = 0.07 * Math.sin(Math.PI * ((a * 6) % 1)) * (1 - a * 0.6);
      const teZ = -0.32 - a * 0.3 + scal;
      const z = leZ + (teZ - leZ) * vv;
      let y = 0.13 * Math.sin(Math.PI * Math.min(1, vv * 1.15)) * (1 - Math.pow(a, 1.6)) + 0.14 * a * a - 0.04 * vv * vv;
      if (under) y -= 0.07 * Math.sin(Math.PI * vv / 0.42) * (1 - a * 0.8);
      pos.push(sgn * GL_W * (1 - 0.04 * vv * a), y, z);
      uv.push((sgn + 1) / 2, vv);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  });
}
/** punto della vela (stessa formula della geometria) */
function sailPt(sgn, vv, lift = 0) {
  const a = Math.abs(sgn), leZ = GL_NOSE - a * (GL_NOSE - GL_TIP_Z), teZ = -0.32 - a * 0.3;
  const y = 0.13 * Math.sin(Math.PI * Math.min(1, vv * 1.15)) * (1 - Math.pow(a, 1.6)) + 0.14 * a * a - 0.04 * vv * vv;
  return new THREE.Vector3(sgn * GL_W * (1 - 0.04 * vv * a), y + lift, leZ + (teZ - leZ) * vv);
}
const _ra = new THREE.Vector3(), _rq = new THREE.Quaternion(), _ry = new THREE.Vector3(0, 1, 0);
/** tubo dritto da a a b */
function rod(a, b, r, m, parent, seg = 6) {
  _ra.subVectors(b, a);
  const len = _ra.length();
  const o = mesh(cylGeo(r, r, 1, seg), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent, 1, len, 1);
  o.quaternion.copy(_rq.setFromUnitVectors(_ry, _ra.normalize()));
  return o;
}
const glMatCache = new Map();
function sailMat(gd) {
  if (glMatCache.has(gd.id)) return glMatCache.get(gd.id);
  const t = gliderTexture(gd.id, gd.color, gd.accent);
  const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap || null, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide, roughness: 0.62, metalness: gd.id === 'oro' ? 0.35 : 0.02,
    emissive: '#ffffff', emissiveMap: t.map, emissiveIntensity: 0.16 });   // la tela lascia passare un po' di luce (si legge il disegno anche da sotto)
  glMatCache.set(gd.id, m);
  return m;
}
export function buildGlider(glider) {
  const g = new THREE.Group();
  const sm = sailMat(glider);
  const sail = mesh(gliderSail(false), sm, 0, 0, 0, g); sail.castShadow = true;
  mesh(gliderSail(true), sm, 0, 0, 0, g);
  const tube = texMat('metal', '#aab0ba'), dark = mat('#26282c', { roughness: 0.45, metalness: 0.5 });
  const pocket = texMat('ripstop', glider.accent);
  // tasca del bordo d'attacco (tubo rivestito di tela) dal naso alle estremità
  for (const sgn of [-1, 1]) {
    const pts = []; for (let k = 0; k <= 10; k++) pts.push(sailPt(sgn * k / 10, 0.004, -0.004));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.034, 8), pocket, 0, 0, 0, g).castShadow = true;
    // stecche sopra la vela
    for (let k = 1; k <= 6; k++) {
      const a = k / 6.6, bp = []; for (let q = 0; q <= 6; q++) bp.push(sailPt(sgn * a, 0.06 + q / 6 * 0.9, 0.006));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 10, 0.006, 4), dark, 0, 0, 0, g);
    }
    // alette alle estremità
    const tip = sailPt(sgn, 0.02);
    sph(0.045, dark, tip.x, tip.y, tip.z, g, 1, 1.6);
    const fin = mesh(cachedGeo('glFin30', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-0.32, 0); sh.quadraticCurveTo(-0.3, 0.2, -0.12, 0.26); sh.lineTo(0, 0.04); return new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); }), pocket, tip.x, tip.y, tip.z + 0.02, g);
    fin.rotation.y = -Math.PI / 2; fin.position.x -= 0.006; fin.scale.setScalar(0.6);
  }
  // chiglia, traversa, king post e cavi
  const keelA = new THREE.Vector3(0, 0.02, GL_NOSE - 0.05), keelB = new THREE.Vector3(0, -0.02, -0.55);
  rod(keelA, keelB, 0.026, tube, g, 8);
  const cross = [sailPt(-0.55, 0.1, -0.04), sailPt(0.55, 0.1, -0.04)];
  const hub = new THREE.Vector3(0, -0.035, 0.3);
  for (const c of cross) rod(hub, c, 0.022, tube, g, 8);
  const kp = new THREE.Vector3(0, 0.62, 0.22);
  rod(new THREE.Vector3(0, 0.05, 0.22), kp, 0.016, tube, g);
  const wire = mat('#c8ccd2', { metalness: 0.8, roughness: 0.3 });
  for (const p of [keelA, keelB, sailPt(-0.98, 0.05), sailPt(0.98, 0.05), cross[0], cross[1]]) rod(kp, p, 0.0035, wire, g, 3);
  // trapezio (A-frame) e barra di comando
  const top = new THREE.Vector3(0, -0.05, 0.2);
  const bl = new THREE.Vector3(-0.58, -1.03, 0.16), br = new THREE.Vector3(0.58, -1.03, 0.16);
  for (const b of [bl, br]) { rod(top, b, 0.019, tube, g, 8).scale.z = 1.9; sph(0.03, dark, b.x, b.y, b.z, g); }
  rod(bl, br, 0.017, tube, g, 8);
  for (const sx of [-1, 1]) mesh(cylGeo(0.024, 0.024, 0.16, 8), texMat('rubber', '#1a1a1a'), 0.26 * sx, -1.03, 0.16, g).rotation.z = Math.PI / 2;   // manopole
  for (const b of [bl, br]) for (const p of [keelA, keelB, sailPt(-0.98, 0.05), sailPt(0.98, 0.05)]) if (p.x * b.x >= 0) rod(b, p, 0.003, wire, g, 3);
  // imbrago: cinghia dalla chiglia alla schiena del pilota
  rod(new THREE.Vector3(0, -0.04, 0.02), new THREE.Vector3(0, -1.3, -0.1), 0.011, texMat('webbing', '#2a2c30'), g, 5);
  mesh(torusGeo(0.03, 0.007, 10), mat('#ff7a1a', { metalness: 0.6, roughness: 0.3 }), 0, -0.07, 0.02, g);
  g.position.y = 2.9;
  return g;
}

/** Il "Battle Bus" volante: modello in models3d.js */
export { buildBus } from './models3d.js?v=19';
