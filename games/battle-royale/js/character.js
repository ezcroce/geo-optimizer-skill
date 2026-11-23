// Modelli 3D low‑poly: personaggi con skin, armi e deltaplani
import * as THREE from 'three';
import { WEAPONS, RARITIES } from './config.js?v=5';
import { mergeParts } from './props.js?v=5';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
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

/**
 * Costruisce un personaggio umanoide con la skin indicata.
 * Il modello guarda verso +Z, i piedi sono a y=0.
 */
export function buildCharacter(skin) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // ruota tutto (per caduta/morte)
  root.add(body);

  const metal = skin.metal ? { metalness: 0.85, roughness: 0.28 } : {};
  const shirtM = mat(skin.shirt, metal);
  const pantsM = mat(skin.pants, metal);
  const skinM = mat(skin.skin);
  const shoeM = mat(skin.shoes);
  const darkM = mat('#111111');

  // Gambe (pivot all'anca)
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.15 * side, 0.85, 0);
    box(0.24, 0.72, 0.26, pantsM, 0, -0.36, 0, pivot);
    box(0.26, 0.14, 0.34, shoeM, 0, -0.78, 0.04, pivot);
    if (skin.kneepads) box(0.27, 0.14, 0.06, mat(skin.kneepads), 0, -0.4, 0.13, pivot);
    if (skin.boots) box(0.27, 0.26, 0.29, shoeM, 0, -0.62, 0.01, pivot);
    if (skin.glow) box(0.05, 0.55, 0.02, glowMat(skin.glow), 0.05 * side, -0.36, 0.135, pivot);
    body.add(pivot);
    legs.push(pivot);
  }

  // Busto
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);
  body.add(torso);
  box(0.62, 0.72, 0.34, shirtM, 0, 0.36, 0, torso);
  if (skin.belt) box(0.64, 0.08, 0.36, mat(skin.belt), 0, 0.06, 0, torso);
  if (skin.tie) {
    box(0.2, 0.5, 0.02, mat('#f2f2f2'), 0, 0.42, 0.175, torso);
    box(0.07, 0.4, 0.03, mat(skin.tie), 0, 0.42, 0.185, torso);
  }
  if (skin.glow) {
    box(0.06, 0.6, 0.02, glowMat(skin.glow), -0.16, 0.38, 0.175, torso);
    box(0.06, 0.6, 0.02, glowMat(skin.glow), 0.16, 0.38, 0.175, torso);
    box(0.4, 0.05, 0.02, glowMat(skin.glow), 0, 0.6, 0.175, torso);
  }
  if (skin.torn) {
    box(0.18, 0.14, 0.02, mat('#3b4552'), 0.12, 0.25, 0.175, torso);
    box(0.14, 0.1, 0.02, mat('#86ab70'), -0.15, 0.5, 0.175, torso);
  }
  if (skin.backpack) {
    box(0.48, 0.55, 0.22, mat(skin.backpack), 0, 0.38, -0.27, torso);
    box(0.1, 0.1, 0.05, mat(skin.accColor), 0.12, 0.5, -0.39, torso);
  }
  if (skin.metal) {
    box(0.66, 0.16, 0.38, mat(skin.accColor, metal), 0, 0.66, 0, torso); // spallacci
  }
  if (skin.vest) {
    // giubbotto tattico con tasche, radio e fibbie
    const vm = mat(skin.vest);
    box(0.66, 0.5, 0.4, vm, 0, 0.42, 0, torso);
    for (const x of [-0.18, 0, 0.18]) {
      box(0.15, 0.15, 0.07, mat(skin.pouch || '#2e3324'), x, 0.3, 0.215, torso);
      box(0.15, 0.03, 0.075, mat('#1d2016'), x, 0.385, 0.218, torso);
    }
    box(0.08, 0.16, 0.06, darkM, -0.22, 0.6, 0.21, torso);           // radio
    box(0.015, 0.14, 0.015, darkM, -0.2, 0.74, 0.21, torso);           // antenna
    box(0.67, 0.05, 0.41, mat('#1d2016'), 0, 0.2, 0, torso);
  }
  if (skin.overalls) {
    // salopette: pettorina, bretelle con bottoni e tasca
    const om = mat(skin.overalls);
    box(0.4, 0.3, 0.02, om, 0, 0.2, 0.176, torso);
    for (const x of [-0.16, 0.16]) {
      box(0.08, 0.5, 0.02, om, x, 0.47, 0.177, torso);
      box(0.08, 0.5, 0.02, om, x, 0.47, -0.177, torso);
      box(0.05, 0.05, 0.02, mat('#e8c040', { metalness: 0.7, roughness: 0.3 }), x, 0.36, 0.19, torso);
    }
    box(0.16, 0.12, 0.02, mat('#24508a'), 0, 0.18, 0.19, torso);
    box(0.03, 0.14, 0.02, mat('#d8d8d8', { metalness: 0.8, roughness: 0.3 }), 0.05, 0.25, 0.2, torso);   // cacciavite nel taschino
  }
  if (skin.toolbelt) {
    box(0.66, 0.08, 0.38, mat('#4a3322'), 0, 0.06, 0, torso);
    box(0.12, 0.14, 0.08, mat('#5a4030'), -0.24, 0.0, 0.17, torso);
    box(0.1, 0.12, 0.08, mat('#5a4030'), 0.25, 0.0, 0.15, torso);
    box(0.04, 0.22, 0.04, mat('#b8b8b8', { metalness: 0.8, roughness: 0.3 }), 0.25, -0.1, 0.2, torso);   // chiave inglese
  }
  if (skin.scarf) {
    const sm = mat(skin.scarf);
    box(0.5, 0.13, 0.42, sm, 0, 0.72, 0, torso);
    box(0.12, 0.32, 0.05, sm, -0.14, 0.52, 0.2, torso);
  }

  // Mantello (pivot in alto sulla schiena)
  let cape = null;
  if (skin.cape) {
    cape = new THREE.Group();
    cape.position.set(0, 0.7, -0.19);
    const c = box(0.58, 1.05, 0.04, mat(skin.cape, { side: THREE.DoubleSide }), 0, -0.52, 0, cape);
    c.castShadow = true;
    torso.add(cape);
  }

  // Braccia (pivot alla spalla)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.41 * side, 0.66, 0);
    box(0.2, 0.62, 0.22, shirtM, 0, -0.28, 0, pivot);
    box(0.18, 0.14, 0.2, skin.metal ? mat(skin.accColor, metal) : skinM, 0, -0.64, 0, pivot);
    if (skin.glow) box(0.21, 0.05, 0.23, glowMat(skin.glow), 0, -0.45, 0, pivot);
    torso.add(pivot);
    arms.push(pivot);
  }

  // Testa
  const head = new THREE.Group();
  head.position.set(0, 0.74, 0);
  torso.add(head);
  const headH = skin.banana ? 0.62 : 0.42;
  const headMat = skin.acc === 'ninja' ? shirtM : skinM;
  box(0.42, headH, 0.42, headMat, 0, headH / 2, 0, head);
  const eyeY = 0.24;
  const eyeM = skin.acc === 'horns' ? glowMat('#ffb000') : (skin.id === 'zombie' ? glowMat('#c8ff4a') : darkM);
  box(0.07, 0.07, 0.02, eyeM, -0.1, eyeY, 0.215, head);
  box(0.07, 0.07, 0.02, eyeM, 0.1, eyeY, 0.215, head);
  if (!['ninja', 'knight', 'astro'].includes(skin.acc) && !skin.beard) box(0.14, 0.03, 0.02, mat('#6b2a20'), 0, 0.11, 0.215, head);
  if (skin.beard) {
    const bm = mat(skin.beard);
    box(0.43, 0.15, 0.08, bm, 0, 0.07, 0.19, head);
    box(0.06, 0.18, 0.4, bm, -0.2, 0.12, 0.0, head);
    box(0.06, 0.18, 0.4, bm, 0.2, 0.12, 0.0, head);
    box(0.18, 0.04, 0.03, bm, 0, 0.15, 0.225, head);   // baffi
  }
  if (skin.hair && !['cap', 'pirate'].includes(skin.acc)) box(0.44, 0.1, 0.44, mat(skin.hair), 0, headH - 0.02, -0.01, head);

  const accM = skin.accColor ? mat(skin.accColor) : darkM;
  switch (skin.acc) {
    case 'helmet':
      // elmetto con occhiali protettivi
      box(0.5, 0.2, 0.5, mat(skin.accColor, { roughness: 0.9 }), 0, 0.5, 0, head);
      box(0.54, 0.05, 0.54, mat(skin.accColor, { roughness: 0.9 }), 0, 0.4, 0, head);
      box(0.4, 0.08, 0.05, mat('#151515'), 0, 0.44, 0.26, head);
      box(0.12, 0.07, 0.03, mat('#e0a040', { metalness: 0.6, roughness: 0.15 }), -0.1, 0.44, 0.29, head);
      box(0.12, 0.07, 0.03, mat('#e0a040', { metalness: 0.6, roughness: 0.15 }), 0.1, 0.44, 0.29, head);
      box(0.04, 0.24, 0.04, darkM, -0.24, 0.3, 0.05, head);
      box(0.04, 0.24, 0.04, darkM, 0.24, 0.3, 0.05, head);
      break;
    case 'ponytail':
      // capelli con frangia e coda di cavallo
      box(0.44, 0.14, 0.44, mat(skin.hair), 0, headH - 0.02, -0.01, head);
      box(0.44, 0.08, 0.06, mat(skin.hair), 0, headH - 0.1, 0.2, head);
      box(0.06, 0.3, 0.44, mat(skin.hair), -0.2, 0.26, -0.01, head);
      box(0.06, 0.3, 0.44, mat(skin.hair), 0.2, 0.26, -0.01, head);
      box(0.1, 0.06, 0.08, mat(skin.accColor || '#e04a6a'), 0, 0.36, -0.24, head);
      { const tail = box(0.13, 0.36, 0.11, mat(skin.hair), 0, 0.18, -0.29, head); tail.rotation.x = 0.35; }
      break;
    case 'capback':
      // berretto girato al contrario
      box(0.45, 0.12, 0.45, accM, 0, 0.45, 0, head);
      box(0.4, 0.04, 0.24, accM, 0, 0.42, -0.3, head);
      box(0.1, 0.06, 0.02, mat('#ffffff'), 0, 0.47, 0.226, head);
      break;
    case 'cap':
      box(0.45, 0.12, 0.45, accM, 0, 0.45, 0, head);
      box(0.4, 0.04, 0.24, accM, 0, 0.4, 0.3, head);
      break;
    case 'shades':
      box(0.44, 0.08, 0.03, mat('#050505', { metalness: 0.9, roughness: 0.1 }), 0, eyeY, 0.225, head);
      break;
    case 'ninja':
      box(0.43, 0.12, 0.43, skinM, 0, eyeY, 0.002, head);
      box(0.07, 0.05, 0.02, darkM, -0.1, eyeY, 0.218, head);
      box(0.07, 0.05, 0.02, darkM, 0.1, eyeY, 0.218, head);
      box(0.44, 0.06, 0.44, accM, 0, 0.34, 0, head);
      box(0.06, 0.05, 0.3, accM, 0.08, 0.32, -0.32, head);
      box(0.06, 0.05, 0.26, accM, -0.05, 0.3, -0.3, head);
      break;
    case 'pirate':
      box(0.74, 0.05, 0.52, accM, 0, 0.44, 0, head);
      box(0.46, 0.2, 0.44, accM, 0, 0.56, 0, head);
      box(0.47, 0.04, 0.45, mat('#c9a03a'), 0, 0.48, 0, head);
      box(0.1, 0.1, 0.03, darkM, 0.1, eyeY, 0.225, head);
      box(0.44, 0.02, 0.02, darkM, 0, eyeY + 0.06, 0.22, head);
      break;
    case 'visor':
      box(0.46, 0.1, 0.05, glowMat(skin.accColor), 0, eyeY, 0.21, head);
      box(0.46, 0.14, 0.46, mat('#202040'), 0, 0.42, 0, head);
      break;
    case 'astro': {
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12),
        new THREE.MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.35, metalness: 0.9, roughness: 0.05 }));
      glass.position.set(0, 0.22, 0);
      head.add(glass);
      box(0.5, 0.08, 0.5, accM, 0, -0.02, 0, head);
      break;
    }
    case 'banana':
      box(0.12, 0.14, 0.12, accM, 0, headH + 0.06, -0.03, head);
      box(0.44, 0.06, 0.44, mat('#f0c820'), 0, 0.42, 0, head);
      break;
    case 'knight':
      box(0.47, 0.47, 0.47, mat(skin.accColor, { metalness: 0.9, roughness: 0.25 }), 0, 0.22, 0, head);
      box(0.36, 0.05, 0.02, darkM, 0, eyeY, 0.24, head);
      box(0.08, 0.3, 0.4, mat('#c41a2a'), 0, 0.58, -0.05, head);
      break;
    case 'horns': {
      const hornGeo = new THREE.ConeGeometry(0.07, 0.32, 6);
      for (const s of [-1, 1]) {
        const h = new THREE.Mesh(hornGeo, accM);
        h.position.set(0.16 * s, 0.5, 0);
        h.rotation.z = -0.5 * s;
        h.castShadow = true;
        head.add(h);
      }
      box(0.44, 0.06, 0.1, mat('#5e0a0f'), 0, 0.36, 0.17, head);
      break;
    }
    default: break;
  }

  // Punto in cui l'arma viene impugnata
  const gunPivot = new THREE.Group();
  gunPivot.position.set(0.2, 0.5, 0.32);
  torso.add(gunPivot);

  // Ombra a terra finta (per leggibilità) – disattivata, si usano le ombre reali
  root.traverse(o => { if (o.isMesh) o.receiveShadow = false; });

  // versione semplificata per la distanza: un'unica mesh (una sola draw call)
  const lod = new THREE.Mesh(lodGeometry(skin), lodMat);
  lod.castShadow = true;
  lod.visible = false;
  root.add(lod);

  return { root, body, legs, arms, torso, head, gunPivot, cape, lod };
}

const lodMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const lodCache = new Map();
function lodGeometry(skin) {
  if (lodCache.has(skin.id)) return lodCache.get(skin.id);
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const top = skin.shirt, head = skin.acc === 'ninja' ? skin.shirt : skin.skin;
  const hat = skin.helmet || ['cap', 'capback', 'pirate', 'visor', 'knight', 'helmet'].includes(skin.acc) ? (skin.accColor || skin.hair || '#333') : (skin.hair || head);
  const parts = [];
  const P = (g, c, x, y, z) => parts.push({ geo: g, color: c, o: { x, y, z, jit: 0.02, noSky: true } });
  for (const sx of [-0.15, 0.15]) { P(B(0.24, 0.72, 0.26), skin.pants, sx, 0.49, 0); P(B(0.26, 0.14, 0.34), skin.shoes, sx, 0.07, 0.04); }
  P(B(0.62, 0.72, 0.34), skin.vest || top, 0, 1.21, 0);
  for (const sx of [-0.41, 0.41]) { P(B(0.2, 0.62, 0.22), top, sx, 1.23, 0); P(B(0.18, 0.14, 0.2), skin.skin, sx, 0.87, 0); }
  const hh = skin.banana ? 0.62 : 0.42;
  P(B(0.42, hh, 0.42), head, 0, 1.59 + hh / 2, 0);
  P(B(0.45, 0.12, 0.45), hat, 0, 1.59 + hh + 0.02, 0);
  if (skin.cape) P(B(0.58, 1.05, 0.04), skin.cape, 0, 1.03, -0.2);
  if (skin.backpack) P(B(0.48, 0.55, 0.22), skin.backpack, 0, 1.23, -0.27);
  const g = mergeParts(parts, 3);
  lodCache.set(skin.id, g);
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
      w: new THREE.MeshStandardMaterial({ map: walnutTex(), roughness: 0.55, metalness: 0.02 }),
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
