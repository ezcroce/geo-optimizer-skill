// ─────────────────────────────────────────────────────────────
//  Consumabili 3D: bende, medikit, mini scudo e pozione scudo.
//  Modelli arrotondati con texture procedurali (garza, plastica, vetro,
//  etichette) e icone renderizzate dai modelli stessi.
//  Geometrie e materiali sono condivisi: centinaia di oggetti a terra
//  costano come pochi.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=51';
import { renderIcon } from './weapons.js?v=51';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

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
  const g = c.getContext('2d', WRF);
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

// ─────────────────────────────────────────────────────────────
//  v37: munizioni a terra come le scatole vere dei negozi di caccia:
//   leggere  → scatola azzurra "Game-Shot" calibro 22 con la fascia bianca;
//   medie    → scatola di cartone avana con la targa rossa e i disegni degli animali (20 cartucce);
//   pesanti  → stessa serie, "Magnum", cartone più scuro e sigillo dorato;
//   cartucce → scatola verde scuro del bosco nella nebbia "Privilege Game 34" con i bossoli verdi;
//   razzi    → il razzo a fuso giallo con la gabbia di stecche (dalla foto), due appoggiati vicini.
//  Accanto alle scatole qualche cartuccia, come nelle foto.
// ─────────────────────────────────────────────────────────────
const AMMO = {
  light: { kind: 'box', size: [0.3, 0.17, 0.09], label: 'leggere' },
  medium: { kind: 'box', size: [0.3, 0.2, 0.085], label: 'medie' },
  heavy: { kind: 'box', size: [0.33, 0.22, 0.095], label: 'pesanti' },
  shells: { kind: 'box', size: [0.26, 0.26, 0.11], label: 'cartucce' },
  rockets: { kind: 'spindle', size: [0.78, 0.12, 0.2], label: 'razzi' },
};
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d', WRF) }; }
function speckle(g, w, h, n, a, rnd) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * a})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); } }
function spaced(g, txt, x, y, sp) { // testo spaziato centrato
  const ws = [...txt].map((ch) => g.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (txt.length - 1);
  let cx = x - tot / 2; g.textAlign = 'left';
  [...txt].forEach((ch, i) => { g.fillText(ch, cx, y); cx += ws[i] + sp; });
  g.textAlign = 'center';
}
/** faccia stampata della scatola (fronte e retro) */
function ammoFrontTex(id) {
  const rnd = mulberry(500 + id.length * 31);
  if (id === 'light') {
    const W = 512, H = 300, { c, g } = cnv(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7aa0d8'); gr.addColorStop(0.45, '#3f66a8'); gr.addColorStop(1, '#16305e');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(150, 120, 10, 150, 120, 260); rg.addColorStop(0, 'rgba(210,230,255,0.45)'); rg.addColorStop(1, 'rgba(210,230,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // venature tipo foto del cielo/acqua
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${0.03 + rnd() * 0.06})`; g.lineWidth = 2 + rnd() * 6; const y = rnd() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + rnd() * 30 - 15, W * 0.7, y + rnd() * 30 - 15, W, y + rnd() * 20 - 10); g.stroke(); }
    speckle(g, W, H, 1500, 0.06, rnd);
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = 'bold 58px "Arial Black", Impact, sans-serif'; g.fillText('ARENA', 26, 70);
    g.font = 'bold 17px Arial, sans-serif'; spaced(g, 'AMMUNITION', 118, 94, 5);
    // fascia bianca curva con la scritta
    g.fillStyle = 'rgba(240,244,252,0.96)';
    g.beginPath(); g.moveTo(0, 238); g.quadraticCurveTo(250, 128, W, 150); g.lineTo(W, 222); g.quadraticCurveTo(260, 196, 0, 300); g.closePath(); g.fill();
    g.strokeStyle = '#9fb6dc'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 238); g.quadraticCurveTo(250, 128, W, 150); g.stroke();
    g.save(); g.translate(280, 208); g.rotate(-0.13);
    g.fillStyle = '#1c346c'; g.font = 'italic bold 52px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.fillText('GAME-SHOT', 0, 0);
    g.restore();
    // bollino rosso del calibro
    g.fillStyle = '#d0262a'; g.beginPath(); g.arc(452, 60, 34, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(452, 60, 28, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 26px "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('22', 452, 70);
    g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'right'; g.fillText('50 CARTUCCE · CAL. 22 LR', W - 18, H - 14);
    return colorTex(c, false);
  }
  if (id === 'medium' || id === 'heavy') {
    const heavy = id === 'heavy', W = 512, H = 340, { c, g } = cnv(W, H);
    g.fillStyle = heavy ? '#7a5636' : '#a37b50'; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 4000, 0.08, rnd);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,38,20,${rnd() * 0.06})`; g.fillRect(0, rnd() * H, W, 1 + rnd() * 2); }
    // disegni a tratto degli animali (bufalo a destra, elefante dietro)
    g.strokeStyle = 'rgba(55,35,18,0.42)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.ellipse(395, 120, 62, 46, 0, 0, 7); g.stroke();                               // testa del bufalo
    g.beginPath(); g.moveTo(340, 95); g.bezierCurveTo(300, 40, 360, 30, 395, 78); g.bezierCurveTo(430, 30, 490, 40, 450, 95); g.stroke();   // corna
    g.beginPath(); g.moveTo(375, 140); g.lineTo(385, 150); g.moveTo(415, 140); g.lineTo(405, 150); g.stroke();
    g.beginPath(); g.moveTo(205, 300); g.bezierCurveTo(210, 220, 300, 200, 330, 250); g.bezierCurveTo(345, 280, 330, 320, 300, 330); g.stroke();   // elefante
    g.beginPath(); g.moveTo(330, 250); g.bezierCurveTo(360, 280, 350, 320, 372, 330); g.stroke();   // proboscide
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(55,35,18,${0.15 + rnd() * 0.2})`; g.lineWidth = 1.5; const x = 180 + rnd() * 320, y = 40 + rnd() * 280; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 30 - 15, y + rnd() * 16 - 8); g.stroke(); }
    // targa rossa del marchio
    g.fillStyle = heavy ? '#1b1715' : '#c21f1a'; g.fillRect(22, 26, 300, 94);
    g.strokeStyle = heavy ? '#c9a14a' : '#f2e6d0'; g.lineWidth = 3; g.strokeRect(28, 32, 288, 82);
    g.fillStyle = heavy ? '#c9a14a' : '#ffffff'; g.fillRect(40, 44, 54, 58);
    g.fillStyle = heavy ? '#1b1715' : '#c21f1a'; g.font = 'bold 50px Georgia, serif'; g.textAlign = 'center'; g.fillText('A', 67, 92);
    g.fillStyle = heavy ? '#e8c46a' : '#ffffff'; g.font = 'italic bold 56px Georgia, "Times New Roman", serif'; g.textAlign = 'left'; g.fillText('Arena', 106, 94);
    g.fillStyle = '#f6efe2'; g.font = 'bold 21px Georgia, serif';
    g.fillText(heavy ? 'SERIE CACCIA PERICOLOSA' : 'SERIE CACCIA GROSSA', 28, 156);
    if (heavy) { g.fillStyle = '#e8c46a'; g.font = 'bold 34px Georgia, serif'; g.fillText('MAGNUM', 28, 196); }
    g.fillStyle = 'rgba(250,244,232,0.92)'; g.font = 'italic 19px Georgia, serif';
    g.fillText('Precise.', 28, 238); g.fillText('Letali.', 28, 262); g.fillText('Affidabili.', 28, 286);
    // sigillo rotondo
    const sx = 448, sy = 250;
    g.fillStyle = heavy ? '#b08a36' : '#a81d18'; g.beginPath(); g.arc(sx, sy, 46, 0, 7); g.fill();
    g.strokeStyle = '#f6efe2'; g.lineWidth = 2.5; g.beginPath(); g.arc(sx, sy, 40, 0, 7); g.stroke(); g.beginPath(); g.arc(sx, sy, 27, 0, 7); g.stroke();
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.fillStyle = '#f6efe2'; g.fillRect(sx + Math.cos(a) * 33 - 1.5, sy + Math.sin(a) * 33 - 1.5, 3, 3); }
    g.fillStyle = '#f6efe2'; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.fillText('A', sx, sy + 9);
    g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'left'; g.fillText(heavy ? '10 CARTUCCE' : '20 CARTUCCE', 28, H - 16);
    return colorTex(c, false);
  }
  if (id === 'shells') {
    const W = 400, H = 400, { c, g } = cnv(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#26332f'); gr.addColorStop(0.55, '#1a2421'); gr.addColorStop(1, '#0b0f0e');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // bosco nella nebbia con la luce in fondo e un cacciatore solitario
    const rg = g.createRadialGradient(200, 190, 5, 200, 190, 170); rg.addColorStop(0, 'rgba(215,222,212,0.75)'); rg.addColorStop(0.4, 'rgba(160,172,160,0.3)'); rg.addColorStop(1, 'rgba(120,130,120,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, w = 3 + rnd() * 14, far = rnd();
      g.fillStyle = `rgba(${12 + far * 40},${16 + far * 46},${14 + far * 42},${0.55 + (1 - far) * 0.4})`;
      g.beginPath(); g.moveTo(x - w / 2, 0); g.lineTo(x + w / 2, 0); g.lineTo(x + w / 2 + (rnd() - 0.5) * 10, 250); g.lineTo(x - w / 2 + (rnd() - 0.5) * 10, 250); g.fill();
      for (let k = 0; k < 3; k++) { g.strokeStyle = g.fillStyle; g.lineWidth = 1 + rnd() * 2; const y = 30 + rnd() * 150; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 60, y - 20 - rnd() * 30); g.stroke(); }
    }
    g.fillStyle = '#0d1211'; g.beginPath(); g.arc(200, 197, 4.5, 0, 7); g.fill(); g.fillRect(196, 201, 8, 22); g.fillRect(197, 222, 2.5, 12); g.fillRect(201, 222, 2.5, 12);
    const fg = g.createLinearGradient(0, 220, 0, H); fg.addColorStop(0, 'rgba(10,14,13,0)'); fg.addColorStop(0.3, 'rgba(10,14,13,0.9)'); fg.addColorStop(1, '#0a0d0c');
    g.fillStyle = fg; g.fillRect(0, 220, W, H - 220);
    // marchio color bronzo
    const bg = g.createLinearGradient(0, 40, 0, 110); bg.addColorStop(0, '#f0c9a0'); bg.addColorStop(0.5, '#b97a4c'); bg.addColorStop(1, '#7c4a2a');
    g.fillStyle = bg; g.font = 'bold 74px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.fillText('A&R', 200, 108);
    g.strokeStyle = 'rgba(40,20,10,0.6)'; g.lineWidth = 1.5; g.strokeText('A&R', 200, 108);
    g.fillStyle = '#f2f2ee'; g.font = '44px Georgia, "Times New Roman", serif'; spaced(g, 'PRIVILEGE', 200, 284, 6);
    g.font = '28px Georgia, serif'; spaced(g, 'GAME', 186, 316, 9);
    g.fillStyle = '#7fb0a0'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'left'; g.fillText('34', 252, 316); g.textAlign = 'center';
    g.fillStyle = '#e8e8e2'; g.font = 'bold 13px Arial, sans-serif'; g.fillText('FAI LA TUA SCELTA NATURALE', 200, 342);
    g.fillStyle = '#163029'; g.fillRect(0, 356, W, 44);
    g.strokeStyle = '#e8e8e2'; g.lineWidth = 2; g.beginPath(); g.arc(28, 378, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(28, 378, 4, 0, 7); g.stroke();
    g.fillStyle = '#e8e8e2'; g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('12   70mm   2¾"   34   1¼"   GREEN CORE', 52, 384);
    return colorTex(c, false);
  }
  return null;
}
/** fianchi e coperchio: tinta della scatola con una riga e il calibro */
function ammoSideTex(id) {
  const rnd = mulberry(900 + id.length * 7), W = 256, H = 128, { c, g } = cnv(W, H);
  const col = { light: '#2a4d8c', medium: '#a37b50', heavy: '#7a5636', shells: '#16241f' }[id];
  g.fillStyle = col; g.fillRect(0, 0, W, H); speckle(g, W, H, 900, 0.07, rnd);
  const acc = { light: '#ffffff', medium: '#c21f1a', heavy: '#c9a14a', shells: '#b97a4c' }[id];
  g.fillStyle = acc; g.fillRect(0, H * 0.7, W, 8);
  g.fillStyle = id === 'shells' || id === 'light' ? '#e8e8e2' : '#f6efe2';
  g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText({ light: '22 LR · 40 GR', medium: '.308 WIN · 165 GR', heavy: '.375 H&H · 300 GR', shells: '12/70 · 34 g' }[id], W / 2, H * 0.4);
  return colorTex(c, false);
}
const ammoMat = (id, part) => {
  if (part === 'front') return std('aF37' + id, { map: ammoFrontTex(id), roughness: 0.78, metalness: 0 });
  return std('aS37' + id, { map: ammoSideTex(id), roughness: 0.85, metalness: 0 });
};
/** cartuccia (bossolo d'ottone + ogiva) distesa lungo x */
function cartridgeGeo(r, L) {
  return lathe([[0.001, 0], [r * 1.05, 0], [r * 1.05, L * 0.06], [r * 0.85, L * 0.08], [r, L * 0.1], [r, L * 0.62], [r * 0.95, L * 0.64], [r * 0.8, L * 0.8], [r * 0.45, L * 0.95], [0.001, L]], 10).rotateZ(-Math.PI / 2);
}
/** ogiva (punta morbida di rame/piombo) per le cartucce delle scatole */
function tipGeo(r, L) {
  return lathe([[r * 0.95, L * 0.64], [r * 0.8, L * 0.8], [r * 0.45, L * 0.95], [0.001, L]], 10).rotateZ(-Math.PI / 2);
}
/** cartuccia del fucile a pompa: bossolo di plastica verde e fondello alto argentato (in piedi, lungo y) */
function shellGeos() {
  const hull = geo('aHull37', () => new THREE.CylinderGeometry(0.0105, 0.0105, 0.05, 14).translate(0, 0.04, 0));
  const base = geo('aBase37', () => lathe([[0.001, 0], [0.0122, 0], [0.0122, 0.003], [0.011, 0.004], [0.011, 0.016], [0.001, 0.016]], 14));
  const crimp = geo('aCrimp37', () => new THREE.CylinderGeometry(0.004, 0.0105, 0.004, 14).translate(0, 0.067, 0));
  return { hull, base, crimp };
}
/** v37: razzo a fuso con la gabbia di stecche gialle (lungo x) */
function spindleGeo() {
  return geo('aSpindle37', () => {
    const parts = [];
    parts.push(new THREE.CylinderGeometry(0.011, 0.011, 0.74, 8).rotateZ(Math.PI / 2));                        // asta
    // punta avvolta dallo spago (elica) e coda
    const hel = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * 44 * Math.PI; hel.push(new THREE.Vector3(0.12 + t * 0.24, Math.cos(a) * 0.0135 * (1 - t * 0.5), Math.sin(a) * 0.0135 * (1 - t * 0.5))); }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hel), 240, 0.0035, 4, false));
    parts.push(lathe([[0.001, 0], [0.016, 0.0], [0.014, 0.04], [0.001, 0.06]], 8).rotateZ(-Math.PI / 2).translate(0.34, 0, 0));
    parts.push(lathe([[0.001, 0], [0.018, 0.01], [0.016, 0.05], [0.001, 0.055]], 8).rotateZ(Math.PI / 2).translate(-0.33, 0, 0));
    // gabbia: 8 stecche a doppia pancia con l'anello in mezzo
    const prof = [[-0.24, 0.012], [-0.17, 0.05], [-0.1, 0.03], [-0.03, 0.055], [0.05, 0.012]];
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * Math.PI * 2;
      const pts = prof.map(([x, r], i) => { const a = a0 + i * 0.12; return new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r); });
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0032, 4, false));
    }
    for (const [x, r] of [[-0.1, 0.03], [-0.17, 0.05], [-0.03, 0.055]]) parts.push(new THREE.TorusGeometry(r, 0.0035, 4, 18).rotateY(Math.PI / 2).translate(x, 0, 0));
    return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n); return g; }));
  });
}
export function buildAmmoMesh(id) {
  const d = AMMO[id];
  if (!d) return null;
  const g = new THREE.Group(), [w, h, dp] = d.size;
  const brassM = std('aBrass', { color: '#d8b050', metalness: 0.85, roughness: 0.3 });
  if (d.kind === 'spindle') {
    const m = std('aSpindleM37', { color: '#d9c63c', roughness: 0.55, metalness: 0.1 });
    const s1 = add(g, spindleGeo(), m); s1.scale.setScalar(1.2); s1.rotation.set(0.5, 0, 0.35);   // un fuso solo, in diagonale come nella foto
    g.userData.ammo = id;
    return g;
  }
  // scatola in piedi con il fronte stampato
  const front = ammoMat(id, 'front'), side = ammoMat(id, 'side');
  const box = add(g, geo('aBox37' + id, () => new THREE.BoxGeometry(w, h, dp)), [side, side, side, side, front, front]);
  box.receiveShadow = true;
  const base = -h / 2, rng = mulberry(77 + id.length);
  if (id === 'shells') {
    const S = shellGeos();
    const green = std('aHullM37', { color: '#1f4a3a', roughness: 0.45 }), silver = std('aSilver37', { color: '#cfcfd2', metalness: 0.9, roughness: 0.25 });
    const put = (x, z, lying) => {
      const s = new THREE.Group();
      add(s, S.hull, green); add(s, S.base, silver); add(s, S.crimp, green);
      s.position.set(x, base + (lying ? 0.012 : 0), z); if (lying) { s.rotation.z = Math.PI / 2; s.rotation.y = rng() * 2; }
      g.add(s);
    };
    put(w / 2 + 0.03, dp / 2 + 0.01, false); put(w / 2 + 0.06, dp / 2 - 0.03, true);
  } else {
    // cartucce accanto: una in piedi, due sdraiate (le leggere sono piccole)
    const [r, L] = id === 'light' ? [0.0045, 0.03] : id === 'heavy' ? [0.0095, 0.09] : [0.0078, 0.07];
    const cg = geo('aCart37' + id, () => cartridgeGeo(r, L)), tg = geo('aTip37' + id, () => tipGeo(r * 1.01, L * 1.002));
    const tip = std(id === 'light' ? 'aLead37' : 'aCopper37', { color: id === 'light' ? '#8d8a86' : '#c56a3a', metalness: 0.7, roughness: 0.35 });
    const put = (x, z, up, ry) => {
      const s = new THREE.Group(); add(s, cg, brassM, false); add(s, tg, tip, false);
      if (up) { s.rotation.z = Math.PI / 2; s.position.set(x, base, z); }
      else { s.rotation.y = ry; s.position.set(x, base + r, z); }
      g.add(s);
    };
    put(w / 2 + 0.03, 0.0, true, 0);
    put(-w * 0.2, dp / 2 + 0.03, false, 0.3 + rng() * 0.4);
    put(w * 0.15, dp / 2 + 0.045, false, -0.5 + rng() * 0.3);
  }
  g.userData.ammo = id;
  return g;
}
const AMMO_ICON_ROT = { light: [0.25, -0.45, 0], medium: [0.25, -0.45, 0], heavy: [0.25, -0.45, 0], shells: [0.25, -0.45, 0], rockets: [0.35, 0.25, 0.1] };
/** icona (data URL) delle munizioni, renderizzata dal modello */
export function ammoIcon(id) {
  if (!AMMO[id]) return null;
  return renderIcon('ammo37|' + id, () => buildAmmoMesh(id), AMMO_ICON_ROT[id], 128, 128);
}
/** v37: il razzo in volo è lo stesso fuso giallo con la gabbia (asse lungo +z, punta avanti) */
export function rocketProjectileGeo() { return geo('aSpindleZ37', () => spindleGeo().clone().rotateY(-Math.PI / 2).scale(1.25, 1.25, 1.25)); }
