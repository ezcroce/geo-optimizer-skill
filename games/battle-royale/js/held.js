// ─────────────────────────────────────────────────────────────
//  v32: oggetti in mano. Piccone con texture. Manico di frassino (venature, nodi, segni d'uso)
//  con impugnatura di cuoio avvolta a spirale, pomolo e ghiera colorati,
//  testa d'acciaio forgiato a mezzaluna con due punte (spazzolato, colpi di
//  martello, bordi lucidati dall'uso). Il pivot è il centro del pugno destro,
//  il manico va lungo +Z e la lama sta nel piano YZ (vedi posePickaxe in anim.js). Consumabili in mano (heldConsumable).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=49';
import { buildItemMesh } from './character.js?v=49';

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const TEX = {};
/** colore + rilievo disegnati una volta sola */
function tex(key, base, draw, height, strength, rx = 1, ry = 1) {
  if (TEX[key]) return TEX[key];
  const A = canvas2d(base); draw(A.g, base, mulberry(key.length * 977 + 13));
  const map = colorTex(A.c); map.repeat.set(rx, ry);
  let normalMap = null;
  if (NORMALS && height) {
    const H = canvas2d(base); H.g.fillStyle = '#808080'; H.g.fillRect(0, 0, base, base);
    height(H.g, base, mulberry(key.length * 977 + 29));
    normalMap = normalFromHeight(H.c, strength); normalMap.repeat.set(rx, ry);
  }
  return (TEX[key] = { map, normalMap });
}

/** frassino: venature lunghe e ondulate lungo il manico (v), due nodi, macchie di sporco vicino alla presa */
const woodTex = () => tex('pickWood', 256, (g, S, r) => {
  const grd = g.createLinearGradient(0, 0, S, 0);
  grd.addColorStop(0, '#8a5a30'); grd.addColorStop(0.5, '#9a6738'); grd.addColorStop(1, '#8a5a30');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x0 = r() * S, w = 0.6 + r() * 1.8, dark = r() < 0.7;
    g.strokeStyle = dark ? `rgba(60,32,14,${0.18 + r() * 0.3})` : `rgba(210,160,100,${0.1 + r() * 0.15})`;
    g.lineWidth = w; g.beginPath();
    for (let y = -8; y <= S + 8; y += 8) { const x = x0 + Math.sin(y * 0.025 + i) * 3 + Math.sin(y * 0.11 + i * 2) * 0.8; y < 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }
  for (const [x, y] of [[0.3, 0.25], [0.72, 0.7]]) {
    for (let k = 7; k > 0; k--) { g.strokeStyle = `rgba(55,28,12,${0.12 + k * 0.03})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x * S, y * S, k * 2.2, k * 4.5, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(40,20,8,0.85)'; g.beginPath(); g.ellipse(x * S, y * S, 2.5, 4, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(30,20,10,${0.04 + r() * 0.06})`; g.fillRect(r() * S, r() * S, 1 + r() * 5, 1 + r() * 14); }
}, (g, S, r) => {
  for (let i = 0; i < 90; i++) { const x = r() * S; g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`; g.fillRect(x, 0, 0.8 + r() * 1.2, S); }
  for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(r() * S, r() * S, 1, 3 + r() * 8); }
}, 1.2, 1, 3);

/** cuoio: grana fine, pieghe e bordi più scuri della striscia avvolta */
const leatherTex = () => tex('pickLeather', 128, (g, S, r) => {
  g.fillStyle = '#5a3a22'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.12})` : `rgba(255,220,180,${r() * 0.06})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(20,10,4,${0.12 + r() * 0.15})`; g.lineWidth = 0.7; g.beginPath(); const x = r() * S, y = r() * S; g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + r() * 6 - 3, x + 14 + r() * 10, y + r() * 4 - 2); g.stroke(); }
  const grd = g.createLinearGradient(0, 0, 0, S); grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(0.2, 'rgba(0,0,0,0)'); grd.addColorStop(0.8, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
}, (g, S, r) => {
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.25})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
}, 1.6, 2, 1);

/** acciaio forgiato: spazzolatura, colpi di martello, scaglie scure di forgia e graffi lucidi */
const steelTex = () => tex('pickSteel', 256, (g, S, r) => {
  g.fillStyle = '#9ea4aa'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { const y = r() * S; g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,44,50'},${0.04 + r() * 0.07})`; g.fillRect(0, y, S, 0.6 + r()); }
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rr = 6 + r() * 14;
    const grd = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 1, x, y, rr);
    grd.addColorStop(0, 'rgba(255,255,255,0.12)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.05)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(30,28,30,${0.12 + r() * 0.18})`; g.beginPath(); g.ellipse(r() * S, r() * S, 4 + r() * 18, 2 + r() * 8, r() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(235,240,245,${0.25 + r() * 0.3})`; g.lineWidth = 0.6; const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 26 - 13, y + r() * 6 - 3); g.stroke(); }
}, (g, S, r) => {
  for (let i = 0; i < 40; i++) {
    const x = r() * S, y = r() * S, rr = 5 + r() * 12;
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.12})`; g.fillRect(0, r() * S, S, 0.8); }
}, 1.4, 3, 3);

const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
/** lama a mezzaluna con due punte, nel piano YZ, spessore lungo X che si assottiglia verso le punte */
function bladeGeo() {
  const sh = new THREE.Shape();
  // coordinate della forma: x → y del modello (in alto/in basso), y → z del modello (lungo il manico)
  sh.moveTo(0.3, 0.592);
  sh.bezierCurveTo(0.2, 0.672, 0.09, 0.705, 0, 0.708);
  sh.bezierCurveTo(-0.09, 0.705, -0.19, 0.676, -0.28, 0.6);
  sh.bezierCurveTo(-0.19, 0.64, -0.09, 0.634, 0, 0.628);
  sh.bezierCurveTo(0.09, 0.632, 0.2, 0.628, 0.3, 0.592);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 18 });
  g.translate(0, 0, -0.016);
  // (sx, sy, sz) → (x = sz, y = sx, z = sy): permutazione ciclica, una rotazione vera (le normali seguono)
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = Math.min(1, Math.abs(y) / 0.3);
    p.setX(i, p.getX(i) * (1 - 0.62 * k * k));
  }
  g.computeVertexNormals();
  return g;
}
/** striscia di cuoio avvolta a spirale attorno all'impugnatura */
function wrapGeo() {
  const turns = 8.5, z0 = -0.085, z1 = 0.155, r = 0.0262;
  const curve = new THREE.Curve();
  curve.getPoint = (t, out = new THREE.Vector3()) => { const a = t * turns * Math.PI * 2; return out.set(Math.cos(a) * r, Math.sin(a) * r, z0 + (z1 - z0) * t); };
  return new THREE.TubeGeometry(curve, 160, 0.0058, 6, false);
}

const MATS = new Map();
function mats(color) {
  if (MATS.has(color)) return MATS.get(color);
  const W = woodTex(), L = leatherTex(), St = steelTex();
  const c = new THREE.Color(color);
  const steelCol = new THREE.Color('#d6dbe0').lerp(c, 0.18);
  const m = {
    wood: new THREE.MeshStandardMaterial({ map: W.map, normalMap: W.normalMap, roughness: 0.72, metalness: 0 }),
    leather: new THREE.MeshStandardMaterial({ map: L.map, normalMap: L.normalMap, roughness: 0.8, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: steelCol, map: St.map, normalMap: St.normalMap, roughness: 0.38, metalness: 0.42, emissive: '#1a1d22' }),
    paint: new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2c30', map: St.map, roughness: 0.5, metalness: 0.55 }),
  };
  MATS.set(color, m);
  return m;
}

/** piccone in mano (pivot = pugno destro). color: colore d'accento della skin */
export function buildPickaxe(color = '#7fd0ff') {
  const M = mats(color);
  const g = new THREE.Group();
  const add = (geom, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geom, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // manico: più largo verso il pomolo, leggermente rastremato sotto la testa
  add(geo('handle', () => new THREE.CylinderGeometry(0.0215, 0.0245, 0.74, 14, 6).rotateX(Math.PI / 2)), M.wood, 0, 0, 0.27);
  // impugnatura di cuoio: manicotto + spirale in rilievo
  add(geo('sleeve', () => new THREE.CylinderGeometry(0.0262, 0.0268, 0.25, 14, 1).rotateX(Math.PI / 2)), M.leather, 0, 0, 0.035);
  add(geo('wrap', wrapGeo), M.leather);
  // pomolo e ghiere
  add(geo('pommel', () => new THREE.SphereGeometry(0.034, 14, 10).scale(1, 1, 0.62)), M.paint, 0, 0, -0.112);
  add(geo('ring', () => new THREE.CylinderGeometry(0.029, 0.029, 0.014, 14).rotateX(Math.PI / 2)), M.dark, 0, 0, -0.088);
  add(geo('ring', () => null), M.dark, 0, 0, 0.162);
  add(geo('collar', () => new THREE.CylinderGeometry(0.027, 0.03, 0.05, 14).rotateX(Math.PI / 2)), M.paint, 0, 0, 0.585);
  // occhio della testa (dove passa il manico) e cuneo che lo blocca
  add(geo('eye', () => new THREE.BoxGeometry(0.058, 0.09, 0.078)), M.paint, 0, 0, 0.652);
  add(geo('wedge', () => new THREE.BoxGeometry(0.03, 0.05, 0.012)), M.dark, 0, 0, 0.695);
  add(geo('blade', bladeGeo), M.steel);
  g.userData.pick = true;
  return g;
}

/** consumabile in mano, centrato sul punto di presa (scala da oggetto vero, non da bottino a terra) */
export function heldConsumable(id) {
  const mesh = buildItemMesh('cons', id);
  const g = new THREE.Group();
  if (id === 'bandage') {
    // un solo rotolo, senza il lembo srotolato
    const roll = mesh.children[0]; mesh.remove(roll);
    roll.position.set(0, 0, 0); roll.rotation.set(0, 0, 0); roll.scale.setScalar(0.55);
    g.add(roll);
  } else {
    const k = { medkit: 0.58, minishield: 0.42, shield: 0.56 }[id] || 0.6;
    mesh.scale.multiplyScalar(k); mesh.position.multiplyScalar(k);
    g.add(mesh);
  }
  g.userData.cons = id;
  return g;
}
