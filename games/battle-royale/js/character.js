// Modelli 3D low‑poly: personaggi con skin, armi e deltaplani
import * as THREE from 'three';
import { WEAPONS, RARITIES } from './config.js?v=3';

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
  if (!['ninja', 'knight', 'astro'].includes(skin.acc)) box(0.14, 0.03, 0.02, mat('#6b2a20'), 0, 0.11, 0.215, head);
  if (skin.hair && !['cap', 'pirate'].includes(skin.acc)) box(0.44, 0.1, 0.44, mat(skin.hair), 0, headH - 0.02, -0.01, head);

  const accM = skin.accColor ? mat(skin.accColor) : darkM;
  switch (skin.acc) {
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

  return { root, body, legs, arms, torso, head, gunPivot, cape };
}

/** Modello dell'arma: la canna punta verso +Z */
export function buildWeaponMesh(id, rarity = 0) {
  const def = WEAPONS[id];
  const g = new THREE.Group();
  if (!def) return g;
  const rc = RARITIES[rarity].color;
  const colors = {
    m: mat('#2a2c30', { metalness: 0.7, roughness: 0.35 }),
    b: mat(id === 'rocket' ? '#4b5a3a' : '#3d4148', { metalness: 0.4, roughness: 0.5 }),
    r: new THREE.MeshStandardMaterial({ color: rc, emissive: rc, emissiveIntensity: rarity >= 3 ? 0.6 : 0.25, metalness: 0.5, roughness: 0.4 }),
    w: mat('#7a4a22'),
  };
  for (const p of def.parts) box(p[0], p[1], p[2], colors[p[6]], p[3], p[4], p[5], g);
  return g;
}

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
