// ─────────────────────────────────────────────────────────────
//  Modelli 3D "pieni": Battle Bus con mongolfiera, forziere.
//  Volumi arrotondati e smussati, parti in rilievo (cornici, fari,
//  griglie, cerchioni, assi, borchie) e texture procedurali con rilievo,
//  così gli oggetti hanno spessore e non sembrano scatole piatte.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=45';

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
    gold: new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#a86a00', emissiveIntensity: 0.35, metalness: 0.9, roughness: 0.25 }),
    sign: new THREE.MeshStandardMaterial({ map: busSign(), emissive: '#ffffff', emissiveMap: busSign(), emissiveIntensity: 0.9, roughness: 0.4 }),
    plate: new THREE.MeshStandardMaterial({ map: busPlate(), roughness: 0.5, metalness: 0.2 }),
    win: new THREE.MeshPhysicalMaterial({ map: busWindows(), roughness: 0.06, metalness: 0.35, clearcoat: 1, envMapIntensity: 1.3 }),
    sand: new THREE.MeshStandardMaterial({ color: '#b39a6a', roughness: 1 }),
    flag: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    flame: new THREE.MeshBasicMaterial({ color: '#ff9a30', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    flameCore: new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
});
/** adesivi sul fianco: «100», stella con fulmine, logo della mongolfiera */
const busStickers = once(() => {
  const W = 768, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // 1) cerchio «100 giocatori»
  g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill();
  g.lineWidth = 14; g.strokeStyle = '#c0242a'; g.stroke();
  g.fillStyle = '#c0242a'; g.font = 'bold 96px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('100', 128, 118);
  g.font = 'bold 30px Arial, sans-serif'; g.fillText('GIOCATORI', 128, 190);
  // 2) stella con fulmine
  g.save(); g.translate(384, 128);
  g.fillStyle = '#ffffff'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 50 : 118; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.lineWidth = 8; g.strokeStyle = '#1b2a6a'; g.stroke();
  g.fillStyle = '#ffb020'; g.beginPath(); g.moveTo(14, -70); g.lineTo(-30, 10); g.lineTo(0, 10); g.lineTo(-14, 70); g.lineTo(34, -14); g.lineTo(4, -14); g.closePath(); g.fill();
  g.restore();
  // 3) mongolfiera stilizzata
  g.save(); g.translate(640, 120);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.fill();
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#c0242a' : '#f2f2ee'; g.beginPath(); g.moveTo(0, 70); g.ellipse(0, -10, 72 - i * 12, 80, 0, Math.PI, 0); g.closePath(); g.fill(); }
  g.fillStyle = '#8a5a2b'; g.fillRect(-20, 82, 40, 26);
  g.strokeStyle = '#8a5a2b'; g.lineWidth = 4; g.beginPath(); g.moveTo(-40, 50); g.lineTo(-18, 84); g.moveTo(40, 50); g.lineTo(18, 84); g.stroke();
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
});
/** sporco e fango sulla parte bassa della carrozzeria (trasparente in alto) */
const busMud = once(() => {
  const W = 512, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(80,60,40,0)'); gr.addColorStop(0.6, 'rgba(80,60,40,0.35)'); gr.addColorStop(1, 'rgba(60,45,30,0.7)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) { const x = rnd() * W, y = H * (0.35 + rnd() * 0.65), r = 1 + rnd() * 4; g.fillStyle = `rgba(70,52,34,${0.25 + rnd() * 0.45})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
});
/** insegna luminosa sul tetto */
const busSign = once(() => {
  const W = 512, H = 96, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#10141c'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,190,40,0.07)';
  for (let x = 4; x < W; x += 8) for (let y = 4; y < H; y += 8) { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }   // matrice di LED
  g.font = '900 58px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ffb020'; g.shadowBlur = 14; g.fillStyle = '#ffc640';
  g.fillText('★ 100 ★ ISOLA', W / 2, H / 2 + 2);
  return colorTex(c, false);
});
/** targa */
const busPlate = once(() => {
  const W = 256, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f6f0'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1f4fb0'; g.fillRect(0, 0, 30, H); g.fillRect(W - 30, 0, 30, H);
  g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
  g.font = '800 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#16181c';
  g.fillText('BR 100', W / 2, H / 2 + 2);
  g.fillStyle = '#ffcc33'; g.font = '700 14px sans-serif'; g.fillText('I', 15, H / 2 + 14);
  return colorTex(c, false);
});
/** finestrini: interno buio con sedili, passeggeri in sagoma e riflesso del cielo (6 riquadri diversi) */
const busWindows = once(() => {
  const N = 6, CW = 128, H = 128, c = document.createElement('canvas'); c.width = CW * N; c.height = H;
  const g = c.getContext('2d'), rnd = mulberry(31);
  const skins = ['#e8b48a', '#c58c5f', '#8a5a3a', '#f0c8a0', '#a8e070'];
  const tops = ['#e83a3a', '#2f6fd6', '#ffcc33', '#44c070', '#a050e0', '#ff8a2a'];
  for (let i = 0; i < N; i++) {
    const x0 = i * CW;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#24384e'); gr.addColorStop(1, '#0c1520');
    g.fillStyle = gr; g.fillRect(x0, 0, CW, H);
    // passeggeri: testa e spalle dietro allo schienale
    const n = 1 + (rnd() * 2 | 0);
    for (let k = 0; k < n; k++) {
      const px = x0 + 24 + k * 56 + rnd() * 18, py = 62 + rnd() * 8;
      g.fillStyle = tops[(rnd() * tops.length) | 0]; g.beginPath(); g.ellipse(px, py + 34, 24, 20, 0, 0, 7); g.fill();
      g.fillStyle = skins[(rnd() * skins.length) | 0]; g.beginPath(); g.arc(px, py, 14, 0, 7); g.fill();
      if (rnd() < 0.6) { g.fillStyle = tops[(rnd() * tops.length) | 0]; g.fillRect(px - 15, py - 16, 30, 8); }   // cappellino
    }
    // schienali rossi
    g.fillStyle = '#9a2228'; g.fillRect(x0 + 6, 92, CW - 12, 36);
    g.fillStyle = '#c3333a'; g.fillRect(x0 + 6, 92, CW - 12, 6);
    // riflesso diagonale
    g.save(); g.beginPath(); g.rect(x0, 0, CW, H); g.clip();
    g.fillStyle = 'rgba(200,230,255,0.16)'; g.beginPath(); g.moveTo(x0 + 20, 0); g.lineTo(x0 + 70, 0); g.lineTo(x0 + 10, H); g.lineTo(x0 - 40, H); g.fill();
    g.fillStyle = 'rgba(200,230,255,0.08)'; g.beginPath(); g.moveTo(x0 + 85, 0); g.lineTo(x0 + 100, 0); g.lineTo(x0 + 40, H); g.lineTo(x0 + 25, H); g.fill();
    g.restore();
  }
  return colorTex(c, false);
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
      const wg = new THREE.BoxGeometry(0.04, 0.95, 0.98), U = wg.attributes.uv, cell = (winZ.indexOf(z) * 7 + (sx > 0 ? 3 : 0)) % 6;
      for (let i = 0; i < U.count; i++) U.setX(i, (cell + (sx > 0 ? 1 - U.getX(i) : U.getX(i))) / 6);
      glass.push(at(wg, sx * (W / 2 + 0.032), 0.45, z));
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
  mesh(merge(glass), M.win, g, false);
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
  busExtras(g, M, { W, L, H, z0, z1, y1, ringY });
  return g;
}

/** dettagli aggiuntivi del bus: tetto, retro, ruote, eliche, bruciatore, bandierine e zavorre */
function busExtras(g, M, { W, L, H, z0, z1, y1, ringY }) {
  const parts = {};
  const add = (k, geo) => (parts[k] || (parts[k] = [])).push(geo);
  const roofTop = y1 + 0.17;
  // ── tetto: insegna luminosa, lampeggiante, trombe, condizionatore, borsone ──
  const signG = new THREE.BoxGeometry(1.7, 0.34, 0.1);
  const sign = new THREE.Mesh(signG, [M.dark, M.dark, M.dark, M.dark, M.sign, M.sign]);
  sign.position.set(0, roofTop + 0.3, 2.62); g.add(sign);
  for (const x of [-0.7, 0.7]) add('dark', at(new THREE.BoxGeometry(0.06, 0.16, 0.06), x, roofTop + 0.06, 2.62));
  add('dark', at(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 16), 0, roofTop + 0.05, 3.15));
  const beacon = new THREE.Group(); beacon.position.set(0, roofTop + 0.1, 3.15); g.add(beacon);
  mesh(at(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 0, 0, 0, 1, 1.25, 1), M.amber, beacon, false);
  mesh(at(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12, 1, true, 0, Math.PI), 0, 0.09, 0), M.chrome, beacon, false);
  for (const x of [-0.45, 0.45]) {
    add('chrome', at(new THREE.CylinderGeometry(0.11, 0.025, 0.5, 12, 1, true), x, roofTop + 0.12, 3.05, Math.PI / 2));
    add('dark', at(new THREE.BoxGeometry(0.05, 0.1, 0.05), x, roofTop + 0.05, 2.9));
  }
  add('roof', at(rbox(1.7, 0.16, 1.3, 0.08), 0, roofTop + 0.08, 0.7));                        // condizionatore
  for (const z of [0.4, 1.0]) {
    add('dark', at(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 18), 0.35, roofTop + 0.17, z));
    add('dark', at(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 18), -0.35, roofTop + 0.17, z));
    for (const x of [-0.35, 0.35]) for (const r of [0, Math.PI / 2]) add('chrome', at(new THREE.BoxGeometry(0.54, 0.02, 0.03), x, roofTop + 0.19, z, 0, r, 0));
  }
  add('dark', at(new THREE.CapsuleGeometry(0.2, 0.7, 4, 10), -0.65, y1 + 0.58, 1.55, 0, 0, Math.PI / 2));   // borsone
  for (const x of [-0.85, -0.45]) add('rubber', at(new THREE.TorusGeometry(0.205, 0.02, 4, 14), x, y1 + 0.58, 1.55, 0, Math.PI / 2, 0));
  for (const [x, z, w, d, ry] of [[-0.4, -2.6, 1.2, 0.9, 0.2], [0.55, -1.4, 0.9, 0.7, -0.3]]) {       // cinghie sui bagagli
    add('rubber', at(new THREE.BoxGeometry(w + 0.04, 0.04, 0.08), x, y1 + 0.62 + (w > 1 ? 0.29 : 0.24), z, 0, ry, 0));
  }
  // grondaie cromate lungo il tetto e antenna
  for (const sx of [-1, 1]) add('chrome', at(new THREE.CylinderGeometry(0.03, 0.03, L - 1.6, 6), sx * (W / 2 + 0.02), y1 - 0.06, -0.45, Math.PI / 2));
  add('dark', rod(new THREE.Vector3(1.2, roofTop, -3.95), new THREE.Vector3(1.32, roofTop + 1.1, -4.15), 0.012, 4));
  add('tail', at(new THREE.SphereGeometry(0.035, 6, 4), 1.32, roofTop + 1.1, -4.15));
  // bandiere sui pali posteriori del portapacchi
  const flagGeo = (sx) => {
    const fg = new THREE.PlaneGeometry(0.9, 0.55, 10, 1), P = fg.attributes.position, col = [];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) + 0.45, y = P.getY(i);
      P.setZ(i, Math.sin(x * 6) * 0.07 * x);
      const star = Math.hypot(x - 0.42, y) < 0.13;
      const c = new THREE.Color(star ? '#ffffff' : (y > 0.09 ? '#ffcc33' : y < -0.09 ? '#e83a3a' : '#2f6fd6'));
      col.push(c.r, c.g, c.b);
    }
    fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    fg.translate(0.45, 0, 0); fg.rotateY(Math.PI / 2); fg.computeVertexNormals();
    return fg;
  };
  const flags = [];
  for (const sx of [-1, 1]) {
    add('chrome', rod(new THREE.Vector3(sx * 1.2, y1 + 0.35, -3.6), new THREE.Vector3(sx * 1.2, y1 + 1.85, -3.6), 0.025, 6));
    add('gold', at(new THREE.SphereGeometry(0.05, 8, 6), sx * 1.2, y1 + 1.88, -3.6));
    const f = new THREE.Mesh(flagGeo(sx), M.flag); f.position.set(sx * 1.2, y1 + 1.55, -3.6); g.add(f); flags.push(f);
  }
  // ── eliche laterali (spingono il bus) ──
  const props = [];
  for (const sx of [-1, 1]) {
    const px = sx * 2.15, py = y1 + 0.4, pz = -1.0;
    add('chrome', rod(new THREE.Vector3(sx * 1.2, y1 + 0.35, pz + 0.3), new THREE.Vector3(px, py, pz + 0.2), 0.04, 6));
    add('chrome', rod(new THREE.Vector3(sx * 1.2, y1 + 0.35, pz - 0.5), new THREE.Vector3(px, py, pz - 0.2), 0.04, 6));
    add('paint', at(new THREE.CapsuleGeometry(0.2, 0.6, 4, 12), px, py, pz, Math.PI / 2));
    add('gold', at(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 14), px, py, pz + 0.1, Math.PI / 2));
    add('dark', at(new THREE.CylinderGeometry(0.06, 0.12, 0.2, 10), px, py, pz - 0.5, Math.PI / 2));
    const pr = new THREE.Group(); pr.position.set(px, py, pz - 0.62); g.add(pr); props.push(pr);
    const blades = [];
    for (let i = 0; i < 3; i++) blades.push(at(new THREE.BoxGeometry(0.1, 0.62, 0.025), 0, 0.33, 0, 0.25, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(i / 3 * Math.PI * 2)));
    mesh(merge(blades), M.wood, pr);
    mesh(at(new THREE.SphereGeometry(0.075, 10, 6), 0, 0, -0.03), M.chrome, pr, false);
  }
  // ── retro: griglia del motore, scarico, targa, paraspruzzi ──
  for (let i = 0; i < 6; i++) add('dark', at(new THREE.BoxGeometry(1.3, 0.05, 0.06), 0, -0.55 - i * 0.11, z0 - 0.15, -0.5));
  add('chrome', at(new THREE.CylinderGeometry(0.075, 0.075, 0.7, 10, 1, true), 1.05, -1.58, z0 + 0.05, Math.PI / 2));
  add('rubber', at(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), 1.05, -1.58, z0 - 0.3, Math.PI / 2));
  add('roof', at(new THREE.BoxGeometry(0.7, 0.2, 0.03), 0, -1.32, z0 - 0.29));
  for (const [z, sz] of [[z1 + 0.312, 1], [z0 - 0.312, -1]]) { const pl = new THREE.PlaneGeometry(0.66, 0.17); if (sz < 0) pl.rotateY(Math.PI); add('plate', at(pl, 0, z > 0 ? -1.32 : -1.32, z)); }
  for (const sx of [-1, 1]) for (const z of [-3.68, 2.12]) {
    add('rubber', at(new THREE.BoxGeometry(0.5, 0.4, 0.03), sx * (W / 2 - 0.15), -1.9, z));
    add('chrome', at(new THREE.BoxGeometry(0.5, 0.04, 0.035), sx * (W / 2 - 0.15), -1.72, z));
  }
  // ── fianchi: luci di posizione, tappo del serbatoio, prese d'aria, predellino ──
  for (const sx of [-1, 1]) {
    for (const z of [-3.9, -0.6, 2.0]) add('amber', at(rbox(0.04, 0.08, 0.16, 0.02), sx * (W / 2 + 0.03), -1.05, z));
    for (let i = 0; i < 5; i++) add('dark', at(new THREE.BoxGeometry(0.03, 0.04, 0.34), sx * (W / 2 + 0.02), -0.25 - i * 0.1, -4.12));
  }
  add('chrome', at(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14), -(W / 2 + 0.02), -1.0, -2.1, 0, 0, Math.PI / 2));
  add('chrome', at(new THREE.BoxGeometry(0.36, 0.05, 0.45), W / 2 + 0.14, -1.38, 3.82));
  add('dark', at(new THREE.BoxGeometry(0.04, 0.2, 0.45), W / 2 + 0.3, -1.46, 3.82));
  // ── muso: paracolpi, fendinebbia, stemma, trombe ──
  for (const x of [-0.8, 0.8]) {
    add('chrome', rod(new THREE.Vector3(x, -1.45, z1 + 0.42), new THREE.Vector3(x, -0.45, z1 + 0.42), 0.045, 8));
    add('chrome', rod(new THREE.Vector3(x, -0.6, z1 + 0.42), new THREE.Vector3(x, -0.6, z1 + 0.1), 0.035, 6));
    add('head', at(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), x * 1.2, -1.3, z1 + 0.29, Math.PI / 2));
    add('chrome', at(new THREE.TorusGeometry(0.095, 0.015, 4, 14), x * 1.2, -1.3, z1 + 0.31));
  }
  for (const y of [-0.5, -1.15]) add('chrome', rod(new THREE.Vector3(-0.8, y, z1 + 0.42), new THREE.Vector3(0.8, y, z1 + 0.42), 0.04, 8));
  {
    const st = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.07 : 0.17; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    add('gold', at(new THREE.ExtrudeGeometry(st, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }), 0, -0.75, z1 + 0.15));
  }
  // ── fianchi: bottazzi in gomma, adesivi, fango e barra luminosa sul tetto ──
  const stM = new THREE.MeshStandardMaterial({ map: busStickers(), transparent: true, alphaTest: 0.5, roughness: 0.45 });
  const mudM = new THREE.MeshStandardMaterial({ map: busMud(), transparent: true, depthWrite: false, roughness: 1 });
  for (const sx of [-1, 1]) {
    add('rubber', at(rbox(0.06, 0.12, 4.3, 0.03), sx * (W / 2 + 0.02), -1.3, 0));
    add('chrome', at(new THREE.BoxGeometry(0.03, 0.02, 4.25), sx * (W / 2 + 0.05), -1.3, 0));
    [[0, -1.4], [2, 0.2], [1, 1.3]].forEach(([k, z]) => {
      const pg = new THREE.PlaneGeometry(0.42, 0.42), U = pg.attributes.uv;
      for (let i = 0; i < U.count; i++) U.setX(i, (k + U.getX(i)) / 3);
      pg.rotateY(sx * Math.PI / 2);
      g.add(new THREE.Mesh(at(pg, sx * (W / 2 + 0.024), -1.04, z), stM));
    });
    const mud = new THREE.PlaneGeometry(L - 0.6, 0.45); mud.rotateY(sx * Math.PI / 2);
    const mm = new THREE.Mesh(at(mud, sx * (W / 2 + 0.022), -1.27, 0), mudM);
    mm.renderOrder = 1; g.add(mm);
  }
  add('dark', at(rbox(1.9, 0.14, 0.22, 0.05), 0, roofTop + 0.07, 3.3));                        // barra luminosa anteriore
  for (let i = 0; i < 6; i++) add(i % 5 === 0 ? 'amber' : 'head', at(rbox(0.22, 0.08, 0.04, 0.02), -0.8 + i * 0.32, roofTop + 0.07, 3.42));
  // ── ruote: bulloni ──
  for (const sx of [-1, 1]) for (const z of [-2.9, 2.9]) for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    add('chrome', at(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 6), sx * (W / 2 + 0.12), -1.55 + Math.cos(a) * 0.2, z + Math.sin(a) * 0.2, 0, 0, Math.PI / 2));
  }
  // ── mongolfiera: bruciatore con fiamma, corona in cima, zavorre e festoni ──
  const by = ringY + 0.55;
  add('chrome', at(new THREE.CylinderGeometry(0.2, 0.24, 0.26, 14), 0, by, 0));
  add('dark', at(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 14), 0, by - 0.13, 0));
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; add('chrome', rod(new THREE.Vector3(Math.cos(a) * 0.22, by - 0.1, Math.sin(a) * 0.22), new THREE.Vector3(Math.cos(a) * 0.8, ringY + 0.4, Math.sin(a) * 0.8), 0.025, 4)); }
  for (const x of [-0.4, 0.4]) add('roof', at(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), x, ringY + 0.25, 0));   // bombole
  const flame = new THREE.Group(); flame.position.set(0, by + 0.14, 0); g.add(flame);
  mesh(at(new THREE.ConeGeometry(0.2, 0.9, 12, 1, true), 0, 0.45, 0), M.flame, flame, false);
  mesh(at(new THREE.ConeGeometry(0.1, 0.55, 10, 1, true), 0, 0.28, 0), M.flameCore, flame, false);
  const topY = 7.5 + 4.5 * 0.85;
  add('gold', at(new THREE.TorusGeometry(0.7, 0.07, 6, 24), 0, topY - 0.06, 0, Math.PI / 2));
  add('gold', at(new THREE.CylinderGeometry(0.35, 0.45, 0.12, 16), 0, topY, 0));
  for (let i = 0; i < 8; i++) {                                                              // sacchi di zavorra
    const a = i / 8 * Math.PI * 2 + 0.2, x = Math.cos(a) * 0.82, z = Math.sin(a) * 0.82;
    add('rope', rod(new THREE.Vector3(x, ringY + 0.4, z), new THREE.Vector3(x * 1.05, ringY - 0.15, z * 1.05), 0.012, 3));
    add('sand', at(new THREE.SphereGeometry(0.13, 8, 6), x * 1.05, ringY - 0.3, z * 1.05, 0, a, 0, 1, 1.3, 1));
    add('rope', at(new THREE.TorusGeometry(0.07, 0.015, 3, 8), x * 1.05, ringY - 0.15, z * 1.05, Math.PI / 2));
  }
  // festoni di bandierine lungo le quattro funi d'angolo
  {
    const pos = [], col = [], cols = ['#e83a3a', '#ffcc33', '#2f6fd6', '#ffffff', '#44c070'].map(c => new THREE.Color(c));
    let ci = 0;
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const a = new THREE.Vector3(x * 3.2, 7.5 - 1.2, z * 4.0), b = new THREE.Vector3(x * 1.2, y1 + 0.35, z > 0 ? 2.2 : -3.6);
      const d = b.clone().sub(a), len = d.length(); d.normalize();
      for (let t = 0.3; t < len - 0.5; t += 0.42) {
        const p0 = a.clone().addScaledVector(d, t), p1 = a.clone().addScaledVector(d, t + 0.3);
        const p2 = a.clone().addScaledVector(d, t + 0.15); p2.y -= 0.32;
        pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        const c = cols[ci++ % cols.length]; for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    bg.computeVertexNormals();
    mesh(bg, M.flag, g, false);
  }
  for (const [k, list] of Object.entries(parts)) mesh(merge(list), M[k], g, k !== 'head' && k !== 'amber' && k !== 'plate');
  g.userData.props = props;
  g.userData.flame = flame;
  g.userData.beacon = beacon;
  g.userData.flags = flags;
  g.userData.exhaust = new THREE.Vector3(1.05, -1.58, z0 - 0.35);
}

// ───────────── Forziere (v38: assi scure, cornice di legno con borchie d'oro, cantonali d'avorio,
//  lucchetto di ferro e fermaglio dorato a fiamma sul coperchio) ─────────────
/** assi grigio-brune con venature, nodi e fughe scure (assi orizzontali lungo u) */
const chestPlanks = once(() => {
  const B = 256, A = canvas2d(B), g = A.g, rnd = mulberry(38);
  g.fillStyle = '#4a4440'; g.fillRect(0, 0, B, B);
  const rows = 6, rh = B / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh, l = 26 + rnd() * 10;
    g.fillStyle = `hsl(${22 + rnd() * 10},${15 + rnd() * 8}%,${l - 4}%)`; g.fillRect(0, y, B, rh);
    for (let i = 0; i < 26; i++) {
      const vy = y + 3 + rnd() * (rh - 6), amp = 0.6 + rnd() * 1.6, ph = rnd() * 6;
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '20,14,10' : '120,104,90'},${0.18 + rnd() * 0.25})`; g.lineWidth = 0.6 + rnd() * 1.1;
      g.beginPath(); for (let x = 0; x <= B; x += 8) { const yy = vy + Math.sin(x / B * 6.28 * 2 + ph) * amp; x ? g.lineTo(x, yy) : g.moveTo(0, yy); } g.stroke();
    }
    if (rnd() < 0.6) { const kx = rnd() * B, ky = y + rh * (0.3 + rnd() * 0.4); for (let k = 7; k > 0; k -= 1.6) { g.strokeStyle = `rgba(25,16,10,${0.5 - k * 0.04})`; g.lineWidth = 1; g.beginPath(); g.ellipse(kx, ky, k * 2, k * 0.8, 0, 0, 6.28); g.stroke(); } }
    const hl = g.createLinearGradient(0, y, 0, y + rh); hl.addColorStop(0, 'rgba(255,240,220,0.10)'); hl.addColorStop(0.5, 'rgba(0,0,0,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = hl; g.fillRect(0, y, B, rh);
    g.fillStyle = 'rgba(8,5,3,0.9)'; g.fillRect(0, y, B, 2.5);
  }
  const map = colorTex(A.c);
  let normalMap = null;
  if (NORMALS) { const H = canvas2d(B); H.g.fillStyle = '#a0a0a0'; H.g.fillRect(0, 0, B, B); for (let r = 0; r < rows; r++) { H.g.fillStyle = '#181818'; H.g.fillRect(0, r * rh, B, 3); H.g.fillStyle = '#7a7a7a'; H.g.fillRect(0, r * rh + 3, B, 2); } normalMap = normalFromHeight(H.c, 2.2); }
  return { map, normalMap };
});
/** legno della cornice: bruno caldo, venatura lunga e bordi consumati */
const chestFrameWood = once(() => {
  const B = 128, A = canvas2d(B), g = A.g, rnd = mulberry(83);
  g.fillStyle = '#6b3f1e'; g.fillRect(0, 0, B, B);
  for (let i = 0; i < 60; i++) {
    const vy = rnd() * B, amp = 0.5 + rnd() * 1.5, ph = rnd() * 6;
    g.strokeStyle = `rgba(${rnd() < 0.5 ? '40,20,8' : '150,96,52'},${0.2 + rnd() * 0.3})`; g.lineWidth = 0.6 + rnd();
    g.beginPath(); for (let x = 0; x <= B; x += 8) { const yy = vy + Math.sin(x / B * 6.28 + ph) * amp; x ? g.lineTo(x, yy) : g.moveTo(0, yy); } g.stroke();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(20,10,4,${rnd() * 0.25})`; g.fillRect(rnd() * B, rnd() * B, 1 + rnd() * 2, 1); }
  return { map: colorTex(A.c) };
});
const chestMats = once(() => {
  const w = chestPlanks(), f = chestFrameWood();
  return {
    wood: new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normalMap, roughness: 0.82 }),
    frame: new THREE.MeshStandardMaterial({ map: f.map, roughness: 0.62, metalness: 0.05 }),
    ivory: new THREE.MeshStandardMaterial({ color: '#ece0c2', roughness: 0.42, metalness: 0.18 }),
    stud: new THREE.MeshStandardMaterial({ color: '#e0b04a', emissive: '#a86a00', emissiveIntensity: 0.25, metalness: 0.9, roughness: 0.3 }),
    iron: new THREE.MeshStandardMaterial({ color: '#4a3a30', metalness: 0.75, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0e0a08', roughness: 0.9 }),
    flame: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#8a5200', emissiveIntensity: 0.25, metalness: 0.75, roughness: 0.3 }),
    // compatibilità (prima i pezzi d'oro si chiamavano gold)
    get gold() { return this.stud; },
  };
});
/** fermaglio a fiamma: lingue sottili che salgono dal lucchetto e si aprono sul coperchio (colori oro → arancio → rosso) */
function flameHasp(R) {
  const shape = new THREE.Shape();
  // contorno in (x, s): s = 1 sul retro del coperchio (cinghia stretta), s = 0 sul bordo davanti dove
  // la cinghia si apre in lingue di fuoco che scendono verso il lucchetto
  const L = [[0.035, 1], [0.035, 0.52], [0.06, 0.4], [0.05, 0.33], [0.095, 0.21], [0.07, 0.19], [0.118, 0.04], [0.068, 0.1], [0.05, 0.0], [0.024, 0.07], [0, -0.04]];
  shape.moveTo(L[0][0], L[0][1]);
  for (const [x, y] of L) shape.lineTo(x, y);
  for (let i = L.length - 2; i >= 0; i--) { const [x, y] = L[i]; shape.lineTo(-x * (0.92 + (i % 3) * 0.06), y + (i % 2 ? 0.012 : -0.01)); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 2 });
  // piega sul coperchio: s → angolo sull'ellisse del coperchio (dal davanti verso la cima)
  const P = geo.attributes.position, col = [];
  const cA = new THREE.Color('#ffd75a'), cB = new THREE.Color('#ffa232'), cC = new THREE.Color('#b8321a');
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), sN = P.getY(i), dz = P.getZ(i);
    const a = 0.1 + sN * 1.8;                          // 0 = bordo davanti, π/2 = in cima, oltre = verso il retro
    const r = R + 0.014 + dz;
    P.setXYZ(i, x, Math.sin(a) * r * 0.62 + 0.004, R - 0.005 + Math.cos(a) * r);
    const t = Math.min(1, Math.abs(x) / 0.12 + Math.max(0, 0.45 - sN) * 0.9);
    const c = cA.clone().lerp(cB, Math.min(1, t * 1.1)).lerp(cC, Math.max(0, t - 0.6) * 1.6);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
const chestGeos = once(() => {
  const W = 1, Hb = 0.55, D = 0.65, R = 0.33, T = 0.06;
  // cassa: assi con piedini (le uv seguono le assi orizzontali)
  const base = merge([at(rbox(W - 0.02, Hb - 0.04, D - 0.02, 0.03), 0, Hb / 2 + 0.01, 0)]);
  { const P = base.attributes.position, U = base.attributes.uv, N = base.attributes.normal; for (let i = 0; i < P.count; i++) { const sideX = Math.abs(N.getX(i)) > 0.7; U.setXY(i, (sideX ? P.getZ(i) : P.getX(i)) * 0.9, P.getY(i) * 2.2); } }
  // cornice: montanti agli angoli + traverse in alto e in basso su tutti e quattro i lati
  const frame = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(at(rbox(T + 0.02, Hb, T + 0.02, 0.012), sx * (W / 2 - T / 2 + 0.005), Hb / 2, sz * (D / 2 - T / 2 + 0.005)));
  for (const y of [0.07, Hb - 0.03]) {
    for (const sz of [-1, 1]) frame.push(at(rbox(W + 0.02, 0.07, 0.035, 0.012), 0, y, sz * (D / 2 + 0.008)));
    for (const sx of [-1, 1]) frame.push(at(rbox(0.035, 0.07, D + 0.02, 0.012), sx * (W / 2 + 0.008), y, 0));
  }
  // traversa verticale centrale sul davanti e sul retro
  for (const sz of [-1, 1]) frame.push(at(rbox(0.07, Hb - 0.1, 0.03, 0.01), 0, Hb / 2, sz * (D / 2 + 0.006)));
  // piedini e cantonali d'avorio in basso (come nella foto: punte chiare agli angoli)
  const ivoryBase = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    ivoryBase.push(at(rbox(0.16, 0.06, 0.16, 0.02), sx * (W / 2 - 0.04), 0.03, sz * (D / 2 - 0.04)));
    ivoryBase.push(at(new THREE.BoxGeometry(0.11, 0.05, 0.018), sx * (W / 2 - 0.05), 0.085, sz * (D / 2 + 0.03)));
  }
  // borchie d'oro lungo le traverse
  const studs = [], stud = (x, y, z) => studs.push(at(new THREE.SphereGeometry(0.013, 6, 4), x, y, z));
  for (const y of [0.07, Hb - 0.03]) {
    for (let x = -0.44; x <= 0.441; x += 0.088) for (const sz of [-1, 1]) stud(x, y, sz * (D / 2 + 0.028));
    for (let z = -0.27; z <= 0.271; z += 0.09) for (const sx of [-1, 1]) stud(sx * (W / 2 + 0.028), y, z);
  }
  for (let y = 0.16; y < Hb - 0.08; y += 0.09) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { stud(sx * (W / 2 + 0.012), y, sz * (D / 2 - 0.03)); stud(sx * (W / 2 - 0.03), y, sz * (D / 2 + 0.012)); }
  // coperchio a botte con i fianchi pieni; perno sul bordo posteriore
  const half = new THREE.CylinderGeometry(R, R, W - 0.1, 18, 1, false, 0, Math.PI);   // metà superiore (piatta sotto)
  at(half, 0, 0, R - 0.005, 0, 0, Math.PI / 2);
  half.scale(1, 0.62, 1);
  { const P = half.attributes.position, U = half.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) * 0.9, Math.atan2(P.getY(i) / 0.62, P.getZ(i) - R) * 0.55); }
  // cantonali d'avorio alle due estremità del coperchio (fasce larghe a botte) + bordo bruno davanti
  const ivoryLid = [];
  for (const sx of [-1, 1]) {
    const arc = new THREE.CylinderGeometry(R + 0.018, R + 0.018, 0.1, 18, 1, false, 0, Math.PI);
    at(arc, sx * (W / 2 - 0.045), 0, R - 0.005, 0, 0, Math.PI / 2); arc.scale(1, 0.62, 1);
    ivoryLid.push(arc);
  }
  const lidFrame = [at(rbox(W + 0.02, 0.075, 0.04, 0.012), 0, 0.035, D - 0.005), at(rbox(W + 0.02, 0.075, 0.04, 0.012), 0, 0.035, 0.0)];
  for (const sx of [-1, 1]) lidFrame.push(at(rbox(0.04, 0.075, D + 0.02, 0.012), sx * (W / 2 + 0.005), 0.035, R - 0.005));
  const lidStuds = [];
  for (const sx of [-1, 1]) for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + k / 6 * Math.PI; lidStuds.push(at(new THREE.SphereGeometry(0.016, 6, 4), sx * (W / 2 - 0.045), Math.cos(a) * (R + 0.022) * 0.62, R - 0.005 + Math.sin(a) * (R + 0.022))); }
  for (let x = -0.44; x <= 0.441; x += 0.088) lidStuds.push(at(new THREE.SphereGeometry(0.012, 6, 4), x, 0.035, D + 0.018));
  // lucchetto di ferro (corpo arrotondato, arco spesso) appeso alla piastra
  const lock = merge([
    at(rbox(0.21, 0.23, 0.07, 0.06), 0, -0.22, D + 0.045),
    at(new THREE.TorusGeometry(0.06, 0.017, 8, 14, Math.PI), 0, -0.1, D + 0.045),
    at(rbox(0.12, 0.05, 0.03, 0.01), 0, -0.02, D + 0.01),
  ]);
  const keyhole = merge([at(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), 0, -0.2, D + 0.082, Math.PI / 2), at(new THREE.BoxGeometry(0.014, 0.05, 0.02), 0, -0.235, D + 0.082)]);
  const flame = flameHasp(R);
  // maniglie laterali di ferro
  const handles = merge([-1, 1].map(sx => at(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), sx * (W / 2 + 0.035), 0.3, 0, 0, Math.PI / 2, Math.PI)));
  return { base, frame: merge(frame), ivoryBase: merge(ivoryBase), studs: merge(studs), half, ivoryLid: merge(ivoryLid), lidFrame: merge(lidFrame), lidStuds: merge(lidStuds), lock, keyhole, flame, handles };
});
/** forziere: cassa di assi con cornice borchiata e coperchio a botte (lid ruota su x per aprirsi) */
export function buildChestMesh() {
  const M = chestMats(), G = chestGeos();
  const g = new THREE.Group();
  mesh(G.base, M.wood, g);
  mesh(G.frame, M.frame, g);
  mesh(G.ivoryBase, M.ivory, g, false);
  mesh(G.studs, M.stud, g, false);
  mesh(G.handles, M.iron, g, false);
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.325);
  mesh(G.half, M.wood, lid);
  mesh(G.ivoryLid, M.ivory, lid);
  mesh(G.lidFrame, M.frame, lid, false);
  mesh(G.lidStuds, M.stud, lid, false);
  mesh(G.flame, M.flame, lid, false);
  mesh(G.lock, M.iron, lid, false);
  mesh(G.keyhole, M.dark, lid, false);
  g.add(lid);
  return { g, lid };
}
