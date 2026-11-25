// ─────────────────────────────────────────────────────────────
//  Modelli 3D "pieni": Battle Bus con mongolfiera, forziere.
//  Volumi arrotondati e smussati, parti in rilievo (cornici, fari,
//  griglie, cerchioni, assi, borchie) e texture procedurali con rilievo,
//  così gli oggetti hanno spessore e non sembrano scatole piatte.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=14';

const once = (f) => { let v; return () => v || (v = f()); };
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const at = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => g.applyMatrix4(new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
function merge(list) {
  return mergeGeometries(list.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    n.clearGroups();
    return n;
  }));
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** scatola smussata (estrusione di un rettangolo arrotondato) centrata nell'origine */
function rbox(w, h, d, r = 0.05, bevel = r * 0.6) {
  const b = Math.min(bevel, w * 0.4, h * 0.4, d * 0.45);
  const rr = Math.max(0.001, Math.min(r - b * 0.5, (w - 2 * b) / 2 - 1e-3, (h - 2 * b) / 2 - 1e-3));
  const dep = Math.max(0.001, d - b * 2);
  const g = new THREE.ExtrudeGeometry(roundRect(w - b * 2, h - b * 2, rr), { depth: dep, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -dep / 2);
  return g;
}
/** cilindro orientato da a a b */
function rod(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
function mesh(g, m, parent, cast = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; }

// ───────────── texture ─────────────
/** vernice del bus: lamiera con pannelli rivettati e un velo di sporco in basso */
const busPaint = once(() => {
  const B = 256, A = canvas2d(B), g = A.g, rnd = mulberry(5);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, B, B);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.03})`; g.fillRect(rnd() * B, rnd() * B, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.2;
  for (let x = 0; x <= B; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, B); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 0; x <= B; x += 64) for (let y = 6; y < B; y += 16) { g.beginPath(); g.arc(x + 4, y, 1.2, 0, 7); g.fill(); g.beginPath(); g.arc(x - 4, y, 1.2, 0, 7); g.fill(); }
  const map = colorTex(A.c); map.repeat.set(1, 1);
  let normalMap = null;
  if (NORMALS) {
    const H = canvas2d(B); H.g.fillStyle = '#808080'; H.g.fillRect(0, 0, B, B);
    H.g.strokeStyle = '#303030'; H.g.lineWidth = 2;
    for (let x = 0; x <= B; x += 64) { H.g.beginPath(); H.g.moveTo(x, 0); H.g.lineTo(x, B); H.g.stroke(); }
    H.g.fillStyle = '#f0f0f0';
    for (let x = 0; x <= B; x += 64) for (let y = 6; y < B; y += 16) { H.g.beginPath(); H.g.arc(x + 4, y, 1.5, 0, 7); H.g.fill(); H.g.beginPath(); H.g.arc(x - 4, y, 1.5, 0, 7); H.g.fill(); }
    normalMap = normalFromHeight(H.c, 1.2);
  }
  return { map, normalMap };
});
/** fascia laterale con la scritta BATTLE BUS */
const busDecal = once(() => {
  const W = 1024, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffcc33'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14);
  g.font = 'italic 900 78px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#11306a'; g.strokeText('BATTLE BUS', W / 2, H / 2 + 3);
  g.fillStyle = '#e83a3a'; g.fillText('BATTLE BUS', W / 2, H / 2 + 3);
  for (const x of [80, W - 80]) { g.fillStyle = '#2f6fd6'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 18 : 40; g.lineTo(x + Math.cos(a) * r, H / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); }
  return colorTex(c, false);
});
/** spicchi della mongolfiera: tessuto con cuciture e toppe */
const balloonTex = once(() => {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), rnd = mulberry(77);
  const N = 16;
  for (let i = 0; i < N; i++) {
    g.fillStyle = i % 2 ? '#e83a3a' : '#c92a2e'; g.fillRect(i * W / N, 0, W / N + 1, H);
  }
  g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.43, W, H * 0.12);   // fascia bianca all'equatore
  g.fillStyle = '#ffcc33'; g.fillRect(0, H * 0.425, W, 3); g.fillRect(0, H * 0.55, W, 3);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
  for (let i = 0; i <= N; i++) { g.beginPath(); g.moveTo(i * W / N, 0); g.lineTo(i * W / N, H); g.stroke(); }
  for (let y = 0; y < H; y += 32) { g.strokeStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`; g.fillRect(rnd() * W, rnd() * H, 3, 3); }
  const t = colorTex(c, false); t.wrapS = THREE.RepeatWrapping;
  return t;
});
/** assi di legno del forziere */
const chestWood = once(() => {
  const B = 128, A = canvas2d(B), g = A.g, rnd = mulberry(31);
  g.fillStyle = '#9a6430'; g.fillRect(0, 0, B, B);
  for (let y = 0; y < B; y += 32) {
    const k = 0.85 + rnd() * 0.3;
    g.fillStyle = `rgba(${k > 1 ? 255 : 30},${k > 1 ? 200 : 15},${k > 1 ? 120 : 0},${Math.abs(k - 1) * 0.7})`; g.fillRect(0, y, B, 32);
    for (let i = 0; i < 10; i++) { const vy = y + 2 + rnd() * 28; g.strokeStyle = `rgba(60,30,8,${0.12 + rnd() * 0.18})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, vy); g.bezierCurveTo(40, vy + 2, 90, vy - 2, B, vy + 1); g.stroke(); }
    g.fillStyle = 'rgba(30,15,4,0.65)'; g.fillRect(0, y, B, 2);
  }
  const map = colorTex(A.c);
  let normalMap = null;
  if (NORMALS) { const H = canvas2d(B); H.g.fillStyle = '#a0a0a0'; H.g.fillRect(0, 0, B, B); for (let y = 0; y < B; y += 32) { H.g.fillStyle = '#202020'; H.g.fillRect(0, y, B, 2.5); } normalMap = normalFromHeight(H.c, 2); }
  return { map, normalMap };
});

// ───────────── Battle Bus ─────────────
const busMats = once(() => {
  const p = busPaint();
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: '#2f6fd6', map: p.map, normalMap: p.normalMap, roughness: 0.38, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    roof: new THREE.MeshStandardMaterial({ color: '#f2f2ee', map: p.map, roughness: 0.5, metalness: 0.15 }),
    decal: new THREE.MeshStandardMaterial({ map: busDecal(), roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#1d3346', roughness: 0.05, metalness: 0.6, clearcoat: 1, envMapIntensity: 1.4 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.85 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d9dee4', roughness: 0.18, metalness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.6, metalness: 0.4 }),
    head: new THREE.MeshStandardMaterial({ color: '#fff8d8', emissive: '#ffe9a0', emissiveIntensity: 1.6, roughness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: '#ff3a2a', emissive: '#ff2a1a', emissiveIntensity: 1.2, roughness: 0.3 }),
    amber: new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ff9000', emissiveIntensity: 0.9, roughness: 0.3 }),
    balloon: new THREE.MeshStandardMaterial({ map: balloonTex(), roughness: 0.75 }),
    rope: new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.85 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.8, side: THREE.DoubleSide }),
  };
});
/** Il "Battle Bus" volante: carrozzeria arrotondata, finestrini incassati, fari, ruote con cerchioni e mongolfiera a spicchi */
export function buildBus() {
  const M = busMats();
  const g = new THREE.Group();
  const L = 9, W = 3.2, H = 3;
  // carrozzeria: profilo laterale (z avanti, y su) estruso lungo x, con spigoli molto arrotondati
  const side = new THREE.Shape();
  const z0 = -L / 2, z1 = L / 2, y0 = -H / 2, y1 = H / 2;
  side.moveTo(z0 + 0.35, y0); side.lineTo(z1 - 0.45, y0); side.quadraticCurveTo(z1, y0, z1, y0 + 0.45);
  side.lineTo(z1 - 0.12, y1 - 0.75); side.quadraticCurveTo(z1 - 0.2, y1, z1 - 0.95, y1);         // muso con parabrezza inclinato
  side.lineTo(z0 + 0.6, y1); side.quadraticCurveTo(z0, y1, z0, y1 - 0.6);
  side.lineTo(z0, y0 + 0.35); side.quadraticCurveTo(z0, y0, z0 + 0.35, y0);
  const bodyG = new THREE.ExtrudeGeometry(side, { depth: W - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 4, curveSegments: 10 });
  bodyG.translate(0, 0, -(W - 0.3) / 2); bodyG.rotateY(-Math.PI / 2);
  // uv in metri per i pannelli rivettati
  { const P = bodyG.attributes.position, U = bodyG.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getZ(i) / 4, P.getY(i) / 4); }
  mesh(bodyG, M.paint, g);
  // tetto bianco leggermente bombato
  mesh(at(rbox(W - 0.1, 0.22, L - 1.9, 0.1), 0, y1 + 0.06, -0.45), M.roof, g);
  // finestrini laterali: vetro incassato con cornice in gomma e montanti
  const winZ = [-3.3, -2.15, -1.0, 0.15, 1.3, 2.45];
  const glass = [], frames = [];
  for (const sx of [-1, 1]) {
    for (const z of winZ) {
      glass.push(at(new THREE.BoxGeometry(0.04, 0.95, 0.98), sx * (W / 2), 0.45, z));
      frames.push(at(new THREE.BoxGeometry(0.05, 1.1, 1.12), sx * (W / 2 + 0.015), 0.45, z));
    }
    // fascia con la scritta e modanatura cromata
    const dec = new THREE.PlaneGeometry(L - 1.6, 0.55); dec.rotateY(sx * Math.PI / 2); at(dec, sx * (W / 2 + 0.02), -0.45, -0.25);
    mesh(dec, M.decal, g, false);
    mesh(at(new THREE.CylinderGeometry(0.035, 0.035, L - 0.8, 8), sx * (W / 2 + 0.03), -0.83, -0.1, Math.PI / 2), M.chrome, g, false);
    // porta con maniglia (lato destro)
    if (sx > 0) {
      mesh(at(new THREE.BoxGeometry(0.03, 2.1, 1.0), W / 2 + 0.01, -0.2, 3.55), M.dark, g, false);
      mesh(at(new THREE.BoxGeometry(0.035, 0.9, 0.42), W / 2 + 0.02, 0.35, 3.33), M.glass, g, false);
      mesh(at(new THREE.BoxGeometry(0.035, 0.9, 0.42), W / 2 + 0.02, 0.35, 3.78), M.glass, g, false);
    }
    // specchietti
    mesh(at(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), sx * (W / 2 + 0.18), 0.6, 4.25, 0, 0, Math.PI / 2), M.dark, g);
    mesh(at(rbox(0.12, 0.42, 0.26, 0.06), sx * (W / 2 + 0.42), 0.55, 4.25), M.dark, g);
  }
  mesh(merge(frames), M.rubber, g, false);
  mesh(merge(glass), M.glass, g, false);
  // parabrezza inclinato e lunotto
  const ws = at(new THREE.BoxGeometry(W - 0.5, 1.15, 0.05), 0, 0.62, z1 - 0.12, -0.1);
  mesh(at(rbox(W - 0.32, 1.32, 0.08, 0.15, 0.02), 0, 0.62, z1 - 0.15, -0.1), M.rubber, g, false);
  mesh(ws, M.glass, g, false);
  mesh(at(new THREE.BoxGeometry(W - 0.8, 0.8, 0.05), 0, 0.6, z0 - 0.13), M.glass, g, false);
  // tergicristalli
  for (const x of [-0.6, 0.6]) mesh(at(new THREE.BoxGeometry(0.9, 0.035, 0.03), x, 0.08, z1 - 0.06, -0.1, 0, 0.35 * Math.sign(x)), M.dark, g, false);
  // muso: griglia a lamelle, fari tondi, frecce, paraurti e targa
  const grille = [at(rbox(1.6, 0.6, 0.08, 0.08, 0.02), 0, -0.75, z1 + 0.06)];
  for (let i = 0; i < 5; i++) grille.push(at(new THREE.BoxGeometry(1.45, 0.04, 0.06), 0, -0.95 + i * 0.1, z1 + 0.11));
  mesh(merge(grille), M.chrome, g, false);
  for (const sx of [-1, 1]) {
    mesh(at(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 18), sx * 1.15, -0.72, z1 + 0.04, Math.PI / 2), M.chrome, g, false);
    mesh(at(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), sx * 1.15, -0.72, z1 + 0.08, Math.PI / 2, 0, 0, 1, 0.45, 1), M.head, g, false);
    mesh(at(rbox(0.22, 0.12, 0.06, 0.04), sx * 1.15, -0.38, z1 + 0.04), M.amber, g, false);
    // fanali posteriori
    mesh(at(rbox(0.22, 0.5, 0.08, 0.05), sx * 1.3, -0.55, z0 - 0.13), M.tail, g, false);
  }
  mesh(at(rbox(W + 0.1, 0.32, 0.32, 0.14), 0, -1.3, z1 + 0.12), M.dark, g);
  mesh(at(rbox(W + 0.1, 0.32, 0.32, 0.14), 0, -1.3, z0 - 0.12), M.dark, g);
  mesh(at(new THREE.BoxGeometry(0.7, 0.2, 0.03), 0, -1.32, z1 + 0.29), M.roof, g, false);
  // scaletta posteriore e portapacchi sul tetto
  const rack = [];
  for (const x of [-1.2, 1.2]) rack.push(rod(new THREE.Vector3(x, y1 + 0.35, -3.6), new THREE.Vector3(x, y1 + 0.35, 2.2), 0.045, 8));
  for (let z = -3.4; z <= 2.1; z += 0.9) rack.push(rod(new THREE.Vector3(-1.2, y1 + 0.35, z), new THREE.Vector3(1.2, y1 + 0.35, z), 0.03, 6));
  for (const x of [-1.2, 1.2]) for (const z of [-3.6, 2.2]) rack.push(rod(new THREE.Vector3(x, y1 + 0.15, z), new THREE.Vector3(x, y1 + 0.35, z), 0.04, 6));
  for (const x of [-0.5, 0.5]) rack.push(rod(new THREE.Vector3(x, -1.2, z0 - 0.2), new THREE.Vector3(x, y1 - 0.1, z0 - 0.2), 0.035, 6));
  for (let y = -0.9; y < y1 - 0.2; y += 0.38) rack.push(rod(new THREE.Vector3(-0.5, y, z0 - 0.2), new THREE.Vector3(0.5, y, z0 - 0.2), 0.03, 6));
  mesh(merge(rack), M.chrome, g);
  // bagagli sul portapacchi
  mesh(at(rbox(1.2, 0.55, 0.9, 0.12), -0.4, y1 + 0.62, -2.6, 0, 0.2), M.wood, g);
  mesh(at(rbox(0.9, 0.45, 0.7, 0.12), 0.55, y1 + 0.57, -1.4, 0, -0.3), M.decal, g);
  // ruote: pneumatico tornito, cerchione con razze e passaruota
  const tireG = new THREE.LatheGeometry([[0.36, -0.2], [0.52, -0.21], [0.6, -0.16], [0.62, 0], [0.6, 0.16], [0.52, 0.21], [0.36, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 22);
  const rimG = merge([new THREE.CylinderGeometry(0.37, 0.37, 0.3, 18), ...[0, 1, 2, 3, 4].map(i => at(new THREE.BoxGeometry(0.07, 0.04, 0.6), 0, 0.17, 0, 0, i / 5 * Math.PI, 0)), at(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10), 0, 0.2, 0)]);
  const archG = new THREE.CylinderGeometry(0.78, 0.78, 0.36, 18, 1, true, -Math.PI / 2, Math.PI);
  const tires = [], rims = [], arches = [];
  for (const sx of [-1, 1]) for (const z of [-2.9, 2.9]) {
    tires.push(at(tireG.clone(), sx * (W / 2 - 0.15), -1.55, z, 0, 0, Math.PI / 2));
    rims.push(at(rimG.clone(), sx * (W / 2 - 0.12), -1.55, z, 0, 0, -sx * Math.PI / 2));
    arches.push(at(archG.clone(), sx * (W / 2 - 0.02), -1.5, z, 0, 0, Math.PI / 2));
  }
  mesh(merge(tires), M.rubber, g);
  mesh(merge(rims), M.chrome, g, false);
  mesh(merge(arches), M.mouth, g, false);
  // ── mongolfiera a spicchi ──
  const env = new THREE.SphereGeometry(4.5, 32, 20);
  const balloon = mesh(env, M.balloon, g);
  balloon.scale.set(1, 0.85, 1.4);
  balloon.position.y = 7.5;
  // cuciture in rilievo lungo gli spicchi
  const seams = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16 * Math.PI; pts.push(new THREE.Vector3(Math.sin(t) * Math.cos(a) * 4.53, Math.cos(t) * 4.53, Math.sin(t) * Math.sin(a) * 4.53)); }
    seams.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.04, 4, false));
  }
  const sm = mesh(merge(seams), M.rope, g, false); sm.scale.copy(balloon.scale); sm.position.copy(balloon.position);
  // bocca della mongolfiera e anello di carico con le funi
  const ringY = 3.2;
  mesh(at(new THREE.CylinderGeometry(1.1, 0.75, 0.6, 20, 1, true), 0, 7.5 - 4.5 * 0.85 + 0.15, 0), M.mouth, g, false);
  mesh(at(new THREE.TorusGeometry(0.8, 0.07, 6, 20), 0, ringY + 0.4, 0, Math.PI / 2), M.wood, g);
  const ropes = [];
  const mouthY = 7.5 - 4.5 * 0.85 + 0.2;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    ropes.push(rod(new THREE.Vector3(Math.cos(a) * 1.0, mouthY, Math.sin(a) * 1.0 * 1.2), new THREE.Vector3(Math.cos(a) * 0.8, ringY + 0.4, Math.sin(a) * 0.8), 0.025, 4));
  }
  for (const x of [-1.2, 1.2]) for (const z of [-3.6, 2.2]) ropes.push(rod(new THREE.Vector3(x * 0.55, ringY + 0.4, z * 0.18), new THREE.Vector3(x, y1 + 0.35, z), 0.035, 5));
  for (const x of [-1, 1]) for (const z of [-1, 1]) ropes.push(rod(new THREE.Vector3(x * 3.2, 7.5 - 1.2, z * 4.0), new THREE.Vector3(x * 1.2, y1 + 0.35, z > 0 ? 2.2 : -3.6), 0.03, 4));
  mesh(merge(ropes), M.rope, g, false);
  return g;
}

// ───────────── Forziere ─────────────
const chestMats = once(() => {
  const w = chestWood();
  return {
    wood: new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normalMap, roughness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: '#3a2412', roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ffae00', emissiveIntensity: 0.55, metalness: 0.85, roughness: 0.28 }),
    iron: new THREE.MeshStandardMaterial({ color: '#4a4c52', metalness: 0.8, roughness: 0.45 }),
  };
});
const chestGeos = once(() => {
  const W = 1, Hb = 0.55, D = 0.65, R = 0.33;
  // cassa: scatola smussata con assi in rilievo e piedini
  const base = merge([at(rbox(W, Hb, D, 0.05), 0, Hb / 2, 0), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => at(new THREE.BoxGeometry(0.12, 0.06, 0.12), sx * (W / 2 - 0.08), 0.03, sz * (D / 2 - 0.08))))]);
  { const P = base.attributes.position, U = base.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, (P.getX(i) + P.getZ(i)) * 0.9, P.getY(i) * 1.6); }
  // coperchio a botte (mezzo cilindro) con fianchi pieni; perno sul bordo posteriore
  const half = new THREE.CylinderGeometry(R, R, W - 0.02, 16, 1, false, -Math.PI / 2, Math.PI);
  at(half, 0, 0, R - 0.005, 0, 0, Math.PI / 2);
  half.scale(1, 0.62, 1);
  { const P = half.attributes.position, U = half.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) * 0.9, (P.getZ(i) + P.getY(i)) * 1.6); }
  const lidRim = at(rbox(W, 0.08, D, 0.04), 0, 0.04, R - 0.005);
  // fasce metalliche (base + coperchio), borchie agli angoli, serratura
  const bandsBase = [], bandsLid = [];
  for (const x of [-0.32, 0.32]) {
    bandsBase.push(at(new THREE.BoxGeometry(0.09, Hb + 0.01, D + 0.025), x, Hb / 2, 0));
    const arc = new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.09, 16, 1, true, -Math.PI / 2, Math.PI);
    at(arc, x, 0, R - 0.005, 0, 0, Math.PI / 2); arc.scale(1, 0.62, 1);
    bandsLid.push(arc);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bandsBase.push(at(new THREE.BoxGeometry(0.1, 0.1, 0.1), sx * (W / 2 - 0.03), Hb - 0.05, sz * (D / 2 - 0.03)));
    bandsBase.push(at(new THREE.BoxGeometry(0.1, 0.1, 0.1), sx * (W / 2 - 0.03), 0.09, sz * (D / 2 - 0.03)));
  }
  bandsBase.push(at(new THREE.BoxGeometry(W + 0.02, 0.07, D + 0.02), 0, Hb - 0.035, 0));
  const lock = merge([at(rbox(0.2, 0.24, 0.05, 0.04), 0, -0.02, D + 0.0), at(new THREE.TorusGeometry(0.05, 0.015, 6, 12), 0, -0.17, D + 0.01)]);
  const keyhole = merge([at(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), 0, 0.0, D + 0.03, Math.PI / 2), at(new THREE.BoxGeometry(0.016, 0.045, 0.02), 0, -0.03, D + 0.03)]);
  // maniglie laterali
  const handles = merge([-1, 1].map(sx => at(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), sx * (W / 2 + 0.02), 0.3, 0, 0, Math.PI / 2, Math.PI)));
  return { base, half, lidRim, bandsBase: merge(bandsBase), bandsLid: merge(bandsLid), lock, keyhole, handles };
});
/** forziere: cassa di assi con fasce dorate e coperchio a botte (lid ruota su x per aprirsi) */
export function buildChestMesh() {
  const M = chestMats(), G = chestGeos();
  const g = new THREE.Group();
  mesh(G.base, M.wood, g);
  mesh(G.bandsBase, M.gold, g, false);
  mesh(G.handles, M.iron, g, false);
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.325);
  mesh(G.half, M.wood, lid);
  mesh(G.lidRim, M.wood, lid, false);
  mesh(G.bandsLid, M.gold, lid, false);
  mesh(G.lock, M.gold, lid, false);
  mesh(G.keyhole, M.dark, lid, false);
  g.add(lid);
  return { g, lid };
}
