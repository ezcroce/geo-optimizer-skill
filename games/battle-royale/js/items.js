// ─────────────────────────────────────────────────────────────
//  Consumabili 3D: bende, medikit, mini scudo e pozione scudo.
//  Modelli arrotondati con texture procedurali (garza, plastica, vetro,
//  etichette) e icone renderizzate dai modelli stessi.
//  Geometrie e materiali sono condivisi: centinaia di oggetti a terra
//  costano come pochi.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=19';
import { renderIcon } from './weapons.js?v=19';

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const once = (f) => { let v; return () => v || (v = f()); };

// ───────────── texture ─────────────
/** garza: trama a rete fine color crema, con qualche filo più scuro */
const gauzeTex = once(() => {
  const B = 64, A = canvas2d(B), g = A.g, rnd = mulberry(11);
  g.fillStyle = '#f3eee2'; g.fillRect(0, 0, B, B);
  for (let i = 0; i < B; i += 3) {
    g.fillStyle = 'rgba(150,130,100,0.22)'; g.fillRect(0, i, B, 1);
    g.fillStyle = 'rgba(150,130,100,0.16)'; g.fillRect(i, 0, 1, B);
  }
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(120,100,70,${0.05 + rnd() * 0.08})`; g.fillRect(0, Math.floor(rnd() * B), B, 1); }
  // spirale dei giri sovrapposti (bande orizzontali leggere)
  for (let y = 0; y < B; y += 16) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, y, B, 2); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 2, B, 1); }
  const map = colorTex(A.c); map.repeat.set(3, 1);
  let normalMap = null;
  if (NORMALS) {
    const H = canvas2d(B); H.g.fillStyle = '#808080'; H.g.fillRect(0, 0, B, B);
    for (let i = 0; i < B; i += 3) { H.g.fillStyle = '#b0b0b0'; H.g.fillRect(0, i, B, 1); H.g.fillRect(i, 0, 1, B); }
    normalMap = normalFromHeight(H.c, 0.8); normalMap.repeat.set(3, 1);
  }
  return { map, normalMap };
});
/** testa del rotolo: spirale di garza */
const spiralTex = once(() => {
  const B = 64, A = canvas2d(B), g = A.g;
  g.fillStyle = '#efe8d8'; g.fillRect(0, 0, B, B);
  g.strokeStyle = 'rgba(140,120,90,0.45)'; g.lineWidth = 0.9;
  g.beginPath();
  for (let a = 0; a < Math.PI * 2 * 7; a += 0.1) { const r = 9 + a * 0.5; const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = '#d6cbb2'; g.beginPath(); g.arc(32, 32, 8.5, 0, 7); g.fill();   // anima di cartone
  g.fillStyle = '#8a7a5a'; g.beginPath(); g.arc(32, 32, 6, 0, 7); g.fill();
  return colorTex(A.c, false);
});
/** fascetta di carta delle bende: croce rossa ripetuta */
const bandLabelTex = once(() => {
  const B = 128, A = canvas2d(B), g = A.g;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, B, B);
  g.fillStyle = '#d42a2a'; g.fillRect(0, 0, B, 10); g.fillRect(0, B - 10, B, 10);
  for (let i = 0; i < 4; i++) { const cx = 16 + i * 32; g.fillRect(cx - 4, 40, 8, 48); g.fillRect(cx - 12, 60, 24, 8); }
  return colorTex(A.c);
});
/** plastica del medikit: bianco con graffi leggeri e polvere sui bordi */
const plasticTex = once(() => {
  const B = 128, A = canvas2d(B), g = A.g, rnd = mulberry(23);
  g.fillStyle = '#f6f6f4'; g.fillRect(0, 0, B, B);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.04})`; g.fillRect(rnd() * B, rnd() * B, 1.5, 1.5); }
  g.lineWidth = 0.6;
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(90,90,90,${0.08 + rnd() * 0.12})`; const x = rnd() * B, y = rnd() * B, a = rnd() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (4 + rnd() * 12), y + Math.sin(a) * (4 + rnd() * 12)); g.stroke(); }
  const map = colorTex(A.c); map.repeat.set(4, 4);
  return map;
});
/** etichetta delle pozioni: blu notte, scudo bianco con fulmine e valore */
function potionLabelTex(big) {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, big ? '#163a8c' : '#1d5fae'); gr.addColorStop(1, big ? '#0b1f52' : '#123d78');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#cfe6ff'; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12);
  g.strokeStyle = 'rgba(207,230,255,0.4)'; g.lineWidth = 1.5; g.strokeRect(13, 13, W - 26, H - 26);
  // scudo al centro (la parte frontale del cilindro è a u=0.25… qui il disegno è centrato e ripetuto due volte)
  const shield = (cx) => {
    g.save(); g.translate(cx, H / 2 + 4);
    g.beginPath(); g.moveTo(0, -40); g.quadraticCurveTo(26, -34, 34, -32); g.quadraticCurveTo(36, 8, 0, 42); g.quadraticCurveTo(-36, 8, -34, -32); g.quadraticCurveTo(-26, -34, 0, -40); g.closePath();
    g.fillStyle = '#eaf4ff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7fc4ff'; g.stroke();
    g.beginPath(); g.moveTo(6, -26); g.lineTo(-12, 4); g.lineTo(0, 4); g.lineTo(-6, 28); g.lineTo(14, -6); g.lineTo(2, -6); g.closePath();
    g.fillStyle = big ? '#2a6aff' : '#2ab0ff'; g.fill();
    g.restore();
  };
  shield(W * 0.25); shield(W * 0.75);
  g.fillStyle = '#ffffff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(big ? '+50' : '+25', W * 0.5, H / 2 + 4);
  g.fillText(big ? '+50' : '+25', 0, H / 2 + 4); g.fillText(big ? '+50' : '+25', W, H / 2 + 4);
  const t = colorTex(c, false); t.wrapS = THREE.RepeatWrapping;
  return t;
}
const labelSmall = once(() => potionLabelTex(false));
const labelBig = once(() => potionLabelTex(true));
/** tappo zigrinato (righe verticali) */
const knurlTex = once(() => {
  const B = 64, A = canvas2d(B), g = A.g;
  g.fillStyle = '#d8dde4'; g.fillRect(0, 0, B, B);
  for (let x = 0; x < B; x += 4) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 1.5, B); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 2, 0, 1, B); }
  const map = colorTex(A.c); map.repeat.set(4, 1);
  let normalMap = null;
  if (NORMALS) { const H = canvas2d(B); H.g.fillStyle = '#c0c0c0'; H.g.fillRect(0, 0, B, B); for (let x = 0; x < B; x += 4) { H.g.fillStyle = '#404040'; H.g.fillRect(x, 0, 2, B); } normalMap = normalFromHeight(H.c, 1.5); normalMap.repeat.set(4, 1); }
  return { map, normalMap };
});

// ───────────── materiali condivisi ─────────────
const M = {};
const std = (k, o) => M[k] || (M[k] = new THREE.MeshStandardMaterial(o));
const mats = {
  gauze: () => { const t = gauzeTex(); return std('gauze', { map: t.map, normalMap: t.normalMap, roughness: 0.95 }); },
  spiral: () => std('spiral', { map: spiralTex(), roughness: 0.95 }),
  band: () => std('band', { map: bandLabelTex(), roughness: 0.7 }),
  plastic: () => std('plastic', { map: plasticTex(), roughness: 0.38, metalness: 0 }),
  red: () => std('red', { color: '#d8262a', roughness: 0.42 }),
  redDark: () => std('redDark', { color: '#9e1a1e', roughness: 0.6 }),
  rubber: () => std('rubber', { color: '#2a2c30', roughness: 0.85 }),
  steel: () => std('steel', { color: '#c9ced6', metalness: 0.9, roughness: 0.28 }),
  knurl: () => { const t = knurlTex(); return std('knurl', { map: t.map, normalMap: t.normalMap, metalness: 0.85, roughness: 0.32 }); },
  cork: () => std('cork', { color: '#b48a5a', roughness: 0.95 }),
  glass: () => std('glass', { color: '#cfe8ff', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.4, depthWrite: false }),
  liquidS: () => std('liquidS', { color: '#5cc8ff', emissive: '#1e8dff', emissiveIntensity: 1.25, roughness: 0.15, transparent: true, opacity: 0.92 }),
  liquidB: () => std('liquidB', { color: '#3f7dff', emissive: '#1a3dff', emissiveIntensity: 1.35, roughness: 0.15, transparent: true, opacity: 0.92 }),
  bubble: () => std('bubble', { color: '#e8f8ff', emissive: '#bfe8ff', emissiveIntensity: 0.9, roughness: 0.1 }),
  labelS: () => std('labelS', { map: labelSmall(), roughness: 0.55 }),
  labelB: () => std('labelB', { map: labelBig(), roughness: 0.55 }),
  gold: () => std('gold', { color: '#e8c04a', metalness: 0.9, roughness: 0.3 }),
};

// ───────────── geometrie ─────────────
const G = new Map();
const geo = (k, f) => { if (!G.has(k)) { const g = f(); g.userData.shared = true; G.set(k, g); } return G.get(k); };
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function crossShape(a, b) {
  const s = new THREE.Shape();
  s.moveTo(-b, -a); s.lineTo(b, -a); s.lineTo(b, -b); s.lineTo(a, -b); s.lineTo(a, b); s.lineTo(b, b); s.lineTo(b, a);
  s.lineTo(-b, a); s.lineTo(-b, b); s.lineTo(-a, b); s.lineTo(-a, -b); s.lineTo(-b, -b); s.closePath();
  return s;
}
const extrude = (shape, depth, bevel) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
};
const at = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)));
  return g;
};
/** unisce geometrie con gli stessi attributi (solo posizione/normale/uv) */
function merge(list) {
  return mergeGeometries(list.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    n.clearGroups();
    return n;
  }));
}

function add(group, g, m, cast = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; group.add(o); return o; }

// ── Bende: due rotoli di garza con fascetta e un lembo srotolato ──
function buildBandage() {
  const g = new THREE.Group();
  const roll = geo('bRoll', () => new THREE.CylinderGeometry(0.075, 0.075, 0.17, 20, 1));
  const band = geo('bBand', () => new THREE.CylinderGeometry(0.077, 0.077, 0.055, 20, 1, true));
  const tail = geo('bTail', () => {
    // lembo srotolato: parte da sotto il rotolo e si stende a terra, leggermente ondulato
    const P = [], U = [], idx = [], n = 12;
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = t * 0.24, y = -0.0742 + Math.max(0, Math.sin(t * 10)) * 0.006 * t;
      P.push(-0.072, y, z, 0.072, y, z); U.push(0, t * 1.5, 1, t * 1.5);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); b.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    b.setIndex(idx); b.computeVertexNormals();
    return b;
  });
  const end = [mats.gauze(), mats.spiral(), mats.spiral()];
  for (const [x, z, ry] of [[-0.02, -0.06, 0.15], [0.03, 0.08, -0.2]]) {
    const r = new THREE.Group(); r.position.set(x, -0.03, z); r.rotation.y = ry; g.add(r);
    add(r, roll, end).rotation.z = Math.PI / 2;
    add(r, band, mats.band()).rotation.z = Math.PI / 2;
    if (z > 0) add(r, tail, std('tail', { map: gauzeTex().map, roughness: 0.95, side: THREE.DoubleSide }), false);
  }
  return g;
}

// ── Medikit: valigetta arrotondata, croce in rilievo, maniglia e chiusure ──
function buildMedkit() {
  const g = new THREE.Group();
  const shell = geo('mShell', () => { const e = extrude(roundRect(0.46, 0.3, 0.06), 0.17, 0.02); e.computeVertexNormals(); return e; });
  const cross = geo('mCross', () => merge([at(extrude(crossShape(0.085, 0.026), 0.012, 0.004), 0, 0, 0.108), at(extrude(crossShape(0.085, 0.026), 0.012, 0.004), 0, 0, -0.108)]));
  const bump = geo('mBump', () => {
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(at(new THREE.SphereGeometry(0.04, 10, 8), sx * 0.212, sy * 0.132, sz * 0.085));
    return merge(corners);
  });
  const handle = geo('mHandle', () => merge([
    at(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), 0, 0.17, 0),
    at(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 10), -0.07, 0.17, 0), at(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 10), 0.07, 0.17, 0),
  ]));
  const latch = geo('mLatch', () => merge([0, 1].map(i => at(new THREE.BoxGeometry(0.045, 0.06, 0.018), (i ? 1 : -1) * 0.15, 0.11, 0.108))));
  add(g, shell, mats.plastic());
  add(g, cross, mats.red());
  add(g, bump, mats.redDark());
  add(g, handle, mats.rubber());
  add(g, latch, mats.steel());
  // fascia rossa che gira attorno alla valigetta (sopra, sotto e ai lati)
  add(g, geo('mStrip', () => { const s = roundRect(0.514, 0.354, 0.08); s.holes.push(roundRect(0.49, 0.33, 0.07)); return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.025); }), mats.red());
  g.scale.setScalar(1.05);
  return g;
}

// ── Mini scudo: fiaschetta tonda di vetro con liquido azzurro luminoso ──
function buildMiniShield() {
  const g = new THREE.Group();
  const glass = geo('sGlass', () => lathe([[0.001, -0.14], [0.06, -0.135], [0.11, -0.1], [0.135, -0.03], [0.13, 0.04], [0.1, 0.1], [0.05, 0.13], [0.04, 0.15], [0.04, 0.19], [0.048, 0.2], [0.048, 0.21], [0.001, 0.21]], 22));
  const liquid = geo('sLiquid', () => lathe([[0.001, -0.128], [0.056, -0.124], [0.1, -0.092], [0.123, -0.03], [0.119, 0.04], [0.092, 0.075], [0.001, 0.075]], 20));
  const cork = geo('sCork', () => lathe([[0.001, 0.19], [0.036, 0.19], [0.04, 0.25], [0.001, 0.25]], 14));
  const ring = geo('sRing', () => new THREE.TorusGeometry(0.046, 0.009, 6, 18).rotateX(Math.PI / 2).translate(0, 0.165, 0));
  const label = geo('sLabel', () => new THREE.CylinderGeometry(0.1365, 0.1365, 0.06, 22, 1, true, -Math.PI * 0.35, Math.PI * 0.7).translate(0, 0.0, 0));
  const bubbles = geo('sBub', () => merge([[0.03, -0.05, 0.05, 0.012], [-0.05, 0.0, 0.02, 0.009], [0.06, 0.03, -0.02, 0.008], [-0.02, -0.08, -0.04, 0.01], [0.0, 0.05, 0.06, 0.007]].map(([x, y, z, r]) => at(new THREE.SphereGeometry(r, 6, 4), x, y, z))));
  add(g, liquid, mats.liquidS(), false);
  add(g, bubbles, mats.bubble(), false);
  add(g, label, mats.labelS(), false).rotation.y = Math.PI / 2;
  add(g, cork, mats.cork());
  add(g, ring, mats.steel());
  const gl = add(g, glass, mats.glass(), false); gl.renderOrder = 2;
  g.position.y = 0.01;
  return g;
}

// ── Pozione scudo: bottiglia alta con liquido blu, tappo zigrinato, etichetta e anelli d'oro ──
function buildShieldPotion() {
  const g = new THREE.Group();
  const glass = geo('pGlass', () => lathe([[0.001, -0.2], [0.11, -0.2], [0.13, -0.18], [0.135, -0.1], [0.135, 0.06], [0.12, 0.11], [0.07, 0.15], [0.05, 0.17], [0.05, 0.22], [0.001, 0.22]], 24));
  const liquid = geo('pLiquid', () => lathe([[0.001, -0.188], [0.105, -0.188], [0.122, -0.172], [0.126, -0.1], [0.126, 0.07], [0.001, 0.07]], 22));
  const cap = geo('pCap', () => new THREE.CylinderGeometry(0.06, 0.06, 0.07, 22).translate(0, 0.235, 0));
  const capTop = geo('pCapTop', () => new THREE.SphereGeometry(0.06, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.27, 0));
  const rings = geo('pRings', () => merge([at(new THREE.TorusGeometry(0.137, 0.009, 6, 28), 0, -0.17, 0, Math.PI / 2), at(new THREE.TorusGeometry(0.137, 0.009, 6, 28), 0, 0.05, 0, Math.PI / 2), at(new THREE.TorusGeometry(0.054, 0.007, 6, 16), 0, 0.175, 0, Math.PI / 2)]));
  const label = geo('pLabel', () => new THREE.CylinderGeometry(0.1375, 0.1375, 0.16, 26, 1, true, -Math.PI * 0.4, Math.PI * 0.8).translate(0, -0.06, 0));
  const bubbles = geo('pBub', () => merge([[0.04, -0.12, 0.06, 0.013], [-0.06, -0.02, 0.03, 0.01], [0.07, 0.03, -0.02, 0.009], [-0.03, -0.15, -0.05, 0.011], [0.02, 0.0, 0.07, 0.008], [-0.07, 0.05, -0.03, 0.007]].map(([x, y, z, r]) => at(new THREE.SphereGeometry(r, 6, 4), x, y, z))));
  add(g, liquid, mats.liquidB(), false);
  add(g, bubbles, mats.bubble(), false);
  add(g, label, mats.labelB(), false).rotation.y = Math.PI / 2;
  add(g, rings, mats.gold());
  add(g, cap, mats.knurl());
  add(g, capTop, mats.steel());
  const gl = add(g, glass, mats.glass(), false); gl.renderOrder = 2;
  return g;
}

const BUILD = { bandage: buildBandage, medkit: buildMedkit, minishield: buildMiniShield, shield: buildShieldPotion };
/** modello 3D del consumabile (null se l'id non esiste) */
export function buildConsumableMesh(id) {
  const f = BUILD[id];
  if (!f) return null;
  const g = f();
  g.userData.cons = id;
  return g;
}
/** luce colorata sotto le pozioni (alone a terra) */
export const CONS_GLOW = { minishield: '#3ab4ff', shield: '#2a6aff' };

const ICON_ROT = { bandage: [0.55, -0.5, 0], medkit: [0.3, -0.45, 0], minishield: [0.2, 0.3, 0], shield: [0.18, 0.3, 0] };
/** icona (data URL) del consumabile, renderizzata dal modello 3D; null se WebGL non è disponibile */
export function consIcon(id) {
  if (!BUILD[id]) return null;
  return renderIcon('cons|' + id, () => buildConsumableMesh(id), ICON_ROT[id], 128, 128);
}
