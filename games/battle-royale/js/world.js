// Mondo di gioco: terreno, città, alberi, collisioni e raycast
import * as THREE from 'three';

export const HALF = 200;          // la mappa va da -200 a +200
export const WATER_LEVEL = -2.6;

export const TOWNS = [
  { name: 'Centro Caos', x: 5, z: 0, r: 40, houses: 9 },
  { name: 'Piazza Pulita', x: -105, z: -95, r: 32, houses: 6 },
  { name: 'Torri Tremanti', x: 100, z: -105, r: 30, houses: 4, towers: true },
  { name: 'Borgo Bottino', x: -110, z: 95, r: 32, houses: 6 },
  { name: 'Villa Vertigine', x: 112, z: 92, r: 28, houses: 5 },
  { name: 'Porto Pigro', x: -140, z: 0, r: 22, houses: 3, containers: true },
  { name: 'Fattoria Felice', x: 40, z: 130, r: 22, houses: 3 },
  { name: 'Deposito Dannato', x: 30, z: -140, r: 24, houses: 2, containers: true },
];

// ── generatore pseudo-casuale con seme (mappa sempre uguale) ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const srand = mulberry32(1337);
const sr = (a, b) => a + srand() * (b - a);

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function baseHeight(x, z) {
  let h = 7 * Math.sin(x * 0.018 + 0.5) * Math.cos(z * 0.015 - 0.3)
    + 3.2 * Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.041 + 0.7)
    + 1.1 * Math.sin(x * 0.12) * Math.cos(z * 0.105)
    + 0.4 * Math.sin(x * 0.31 + z * 0.27);
  // un lago a sud-ovest del centro
  const ld = Math.hypot(x + 50, z - 40);
  h -= 9 * (1 - smoothstep(0, 32, ld));
  return h;
}

for (const t of TOWNS) t.h = Math.max(1.2, baseHeight(t.x, t.z) + 0.5);

export function terrainHeight(x, z) {
  let h = baseHeight(x, z);
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.r + 18) {
      const k = 1 - smoothstep(t.r, t.r + 18, d);
      h = h + (t.h - h) * k;
    }
  }
  // isola: la costa scende nel mare oltre il bordo della mappa
  const e = Math.max(Math.abs(x), Math.abs(z)) + 6 * Math.sin(x * 0.05 + z * 0.03);
  if (e > 176) h = h + (-9 - h) * smoothstep(176, 200, e);
  return h;
}

// ─────────────── Collisioni ───────────────
export const colliders = [];
const CELL = 16;
const grid = new Map();
let stamp = 0;

function cellKey(ix, iz) { return ix * 4096 + iz; }

export function addCollider(c) {
  if (c.type === 'cyl') {
    c.minX = c.x - c.r; c.maxX = c.x + c.r; c.minZ = c.z - c.r; c.maxZ = c.z + c.r;
  }
  c._s = 0;
  colliders.push(c);
  c.cells = [];
  const x0 = Math.floor(c.minX / CELL), x1 = Math.floor(c.maxX / CELL);
  const z0 = Math.floor(c.minZ / CELL), z1 = Math.floor(c.maxZ / CELL);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const k = cellKey(ix, iz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(c);
    c.cells.push(k);
  }
  return c;
}

export function removeCollider(c) {
  const i = colliders.indexOf(c);
  if (i >= 0) colliders.splice(i, 1);
  for (const k of c.cells) {
    const arr = grid.get(k);
    if (!arr) continue;
    const j = arr.indexOf(c);
    if (j >= 0) arr.splice(j, 1);
  }
}

export function queryColliders(x, z, r) {
  stamp++;
  const out = [];
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const arr = grid.get(cellKey(ix, iz));
    if (!arr) continue;
    for (const c of arr) if (c._s !== stamp) { c._s = stamp; out.push(c); }
  }
  return out;
}

/** Altezza del suolo (terreno o cima di una cassa) sotto un punto */
export function groundAt(x, z, feetY, radius = 0.35) {
  let g = terrainHeight(x, z);
  const list = queryColliders(x, z, radius + 0.1);
  for (const c of list) {
    if (c.noStand) continue;
    if (c.maxY > feetY + 0.5) continue; // troppo alto per salirci
    if (c.maxY <= g) continue;
    if (c.type === 'box') {
      if (x > c.minX - radius * 0.6 && x < c.maxX + radius * 0.6 && z > c.minZ - radius * 0.6 && z < c.maxZ + radius * 0.6) g = c.maxY;
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + radius * 0.5) g = c.maxY;
  }
  return g;
}

/** Spinge fuori un cerchio (personaggio) dai collisori */
export function resolveCollisions(pos, radius, height) {
  const list = queryColliders(pos.x, pos.z, radius + 0.2);
  let hit = false;
  for (const c of list) {
    if (pos.y >= c.maxY - 0.05 || pos.y + height <= c.minY) continue;
    if (!c.noStand && c.maxY - pos.y <= 0.5) continue; // gradino: ci si sale sopra
    if (c.type === 'box') {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        } else {
          // centro dentro il box: esci dal lato più vicino
          const pen = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z];
          const m = Math.min(...pen);
          if (m === pen[0]) pos.x = c.minX - radius;
          else if (m === pen[1]) pos.x = c.maxX + radius;
          else if (m === pen[2]) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
        hit = true;
      }
    } else {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min && d > 1e-6) {
        pos.x += (dx / d) * (min - d);
        pos.z += (dz / d) * (min - d);
        hit = true;
      }
    }
  }
  return hit;
}

function rayBox(o, d, c) {
  let tmin = 0, tmax = Infinity;
  const mins = [c.minX, c.minY, c.minZ], maxs = [c.maxX, c.maxY, c.maxZ];
  const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ds[i]) < 1e-9) {
      if (os[i] < mins[i] || os[i] > maxs[i]) return -1;
    } else {
      let t1 = (mins[i] - os[i]) / ds[i];
      let t2 = (maxs[i] - os[i]) / ds[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

function rayCyl(o, d, c) {
  const dx = o.x - c.x, dz = o.z - c.z;
  const a = d.x * d.x + d.z * d.z;
  const cc = dx * dx + dz * dz - c.r * c.r;
  if (a < 1e-9) {
    if (cc > 0) return -1;
    return -1;
  }
  const b = 2 * (dx * d.x + dz * d.z);
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  let t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) { if (cc < 0) t = 0; else return -1; }
  const y = o.y + d.y * t;
  if (y < c.minY || y > c.maxY) return -1;
  return t;
}

/** Raycast contro i collisori. Ritorna {t, collider} oppure null */
export function rayColliders(o, d, maxDist, ignore = null) {
  let best = maxDist, hit = null;
  for (const c of colliders) {
    if (c === ignore) continue;
    const t = c.type === 'box' ? rayBox(o, d, c) : rayCyl(o, d, c);
    if (t >= 0 && t < best) { best = t; hit = c; }
  }
  return hit ? { t: best, collider: hit } : null;
}

/** Raycast contro il terreno (ray marching + bisezione) */
export function rayTerrain(o, d, maxDist) {
  const step = 1.2;
  let prevT = 0;
  for (let t = step; t <= maxDist + step; t += step) {
    const tt = Math.min(t, maxDist);
    const y = o.y + d.y * tt;
    if (d.y > 0 && y > 60) return -1;
    if (y < terrainHeight(o.x + d.x * tt, o.z + d.z * tt)) {
      let a = prevT, b = tt;
      for (let i = 0; i < 8; i++) {
        const m = (a + b) / 2;
        if (o.y + d.y * m < terrainHeight(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
      }
      return a;
    }
    prevT = tt;
    if (tt >= maxDist) break;
  }
  return -1;
}

/** Raycast completo (collisori + terreno) */
export function rayWorld(o, d, maxDist, ignore = null) {
  const c = rayColliders(o, d, maxDist, ignore);
  const lim = c ? c.t : maxDist;
  const tt = rayTerrain(o, d, lim);
  if (tt >= 0) return { t: tt, collider: null, terrain: true };
  return c;
}

// ─────────────── Costruzione della scena ───────────────
const M = {};
function m(name, color, opts = {}) {
  if (!M[name]) M[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
  return M[name];
}

function makeWallTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  g.strokeStyle = line; g.lineWidth = 2;
  for (let y = 0; y < 128; y += 16) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    const off = (y / 16) % 2 ? 16 : 0;
    for (let x = off; x < 128; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a6a35'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#6e4620'; g.lineWidth = 3;
  g.strokeRect(2, 2, 60, 60);
  g.beginPath(); g.moveTo(2, 2); g.lineTo(62, 62); g.stroke();
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,30,10,${Math.random() * 0.15})`; g.fillRect(Math.random() * 64, Math.random() * 64, 8, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const roads = [];
function buildRoads() {
  const order = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [5, 3], [3, 6], [6, 4], [2, 7], [7, 1], [4, 2]];
  for (const [a, b] of order) roads.push([TOWNS[a], TOWNS[b]]);
}
function roadDist(x, z) {
  let best = Infinity;
  for (const [a, b] of roads) {
    const vx = b.x - a.x, vz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
    const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
    if (d < best) best = d;
  }
  return best;
}

function inTown(x, z, pad = 0) {
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return t;
  return null;
}

export function buildWorld(scene) {
  buildRoads();
  const lootSpots = [];
  const chestSpots = [];
  const houses = [];

  // ── Terreno ──
  const SEG = 160;
  const geo = new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  const grass1 = new THREE.Color('#5d9c3f'), grass2 = new THREE.Color('#7cb84a'), sand = new THREE.Color('#d9c48a');
  const rock = new THREE.Color('#8a8578'), dirt = new THREE.Color('#a68a5a'), snow = new THREE.Color('#f2f2f2'), town = new THREE.Color('#9aa36b');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2);
    col.copy(grass1).lerp(grass2, n * 0.8);
    if (inTown(x, z, 4)) col.lerp(town, 0.45);
    const rd = roadDist(x, z);
    if (rd < 3.5) col.lerp(dirt, 1 - rd / 3.5);
    if (h < WATER_LEVEL + 1.2) col.lerp(sand, Math.min(1, (WATER_LEVEL + 1.2 - h) / 1.2));
    if (h > 14) col.lerp(rock, Math.min(1, (h - 14) / 6));
    if (h > 28) col.lerp(snow, Math.min(1, (h - 28) / 8));
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ── Acqua ──
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: '#2a7fc0', transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  scene.add(water);

  // ── Materiali edifici ──
  const wallColors = ['#e8dcc0', '#d9b48a', '#c9d6df', '#e6c3b0', '#cfe0c0', '#f0e0a0'];
  const wallMats = wallColors.map(c => new THREE.MeshStandardMaterial({ map: makeWallTexture(c, 'rgba(0,0,0,0.12)'), roughness: 0.9 }));
  const roofMats = ['#a33b2a', '#5a5f6a', '#3b5a8a', '#7a4a2a'].map(c => m('roof' + c, c));
  const floorMat = m('floor', '#8a6a4a');
  const woodTex = makeWoodTexture();
  const crateMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
  const metalMat = m('metal', '#6a6f78', { metalness: 0.6, roughness: 0.4 });
  const containerMats = ['#c0392b', '#2471a3', '#d68910', '#1e8449'].map(c => m('cont' + c, c, { metalness: 0.4, roughness: 0.6 }));

  const staticMeshes = [];
  function addBox(w, h, d, x, y, z, material, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (material.map && opts.uv !== false) {
      // ripeti la texture in base alla dimensione
      const uv = g.attributes.uv;
      const normal = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i));
        const sx = nx > 0.5 ? d : w, sy = ny > 0.5 ? d : h;
        uv.setXY(i, uv.getX(i) * sx / 2, uv.getY(i) * sy / 2);
      }
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    staticMeshes.push(mesh);
    let c = null;
    if (opts.collide !== false) {
      c = addCollider({ type: 'box', minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2, mesh, noStand: opts.noStand });
    }
    return { mesh, c };
  }

  function placeHouse(cx, cz, w, d, baseY, rot90) {
    if (rot90) { const t = w; w = d; d = t; }
    const H = 3.8, T = 0.35, door = 2.2;
    const wm = wallMats[Math.floor(srand() * wallMats.length)];
    const parts = [];
    // pavimento
    parts.push(addBox(w, 0.2, d, cx, baseY + 0.1, cz, floorMat, { cast: false }).mesh);
    const doorSide = Math.floor(srand() * 4);
    const doors = [];
    const normals = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const sides = [
      { x: cx, z: cz - d / 2 + T / 2, len: w, horiz: true },
      { x: cx, z: cz + d / 2 - T / 2, len: w, horiz: true },
      { x: cx - w / 2 + T / 2, z: cz, len: d, horiz: false },
      { x: cx + w / 2 - T / 2, z: cz, len: d, horiz: false },
    ];
    sides.forEach((s, i) => {
      const hasDoor = i === doorSide || (i === (doorSide ^ 1) && srand() < 0.5);
      const hasWindow = !hasDoor && srand() < 0.7;
      if (hasDoor) doors.push({ x: s.x, z: s.z, nx: normals[i][0], nz: normals[i][1] });
      if (hasDoor || hasWindow) {
        const gap = hasDoor ? door : 1.6;
        const seg = (s.len - gap) / 2;
        const off = gap / 2 + seg / 2;
        for (const sgn of [-1, 1]) {
          if (s.horiz) parts.push(addBox(seg, H, T, s.x + sgn * off, baseY + H / 2, s.z, wm).mesh);
          else parts.push(addBox(T, H, seg, s.x, baseY + H / 2, s.z + sgn * off, wm).mesh);
        }
        if (hasDoor) {
          const lh = H - 2.6;
          if (s.horiz) parts.push(addBox(gap, lh, T, s.x, baseY + 2.6 + lh / 2, s.z, wm).mesh);
          else parts.push(addBox(T, lh, gap, s.x, baseY + 2.6 + lh / 2, s.z, wm).mesh);
        } else {
          // finestra: muro sotto e sopra
          if (s.horiz) {
            parts.push(addBox(gap, 1.1, T, s.x, baseY + 0.55, s.z, wm).mesh);
            parts.push(addBox(gap, 1.1, T, s.x, baseY + H - 0.55, s.z, wm).mesh);
          } else {
            parts.push(addBox(T, 1.1, gap, s.x, baseY + 0.55, s.z, wm).mesh);
            parts.push(addBox(T, 1.1, gap, s.x, baseY + H - 0.55, s.z, wm).mesh);
          }
        }
      } else {
        if (s.horiz) parts.push(addBox(s.len, H, T, s.x, baseY + H / 2, s.z, wm).mesh);
        else parts.push(addBox(T, H, s.len, s.x, baseY + H / 2, s.z, wm).mesh);
      }
    });
    // tetto
    const roofM = roofMats[Math.floor(srand() * roofMats.length)];
    const roof = addBox(w + 0.6, 0.3, d + 0.6, cx, baseY + H + 0.15, cz, roofM);
    const house = { cx, cz, w, d, baseY, roof: roof.mesh, roofTop: baseY + H + 0.3, doors };
    houses.push(house);
    // loot e casse dentro la casa
    const nLoot = 1 + Math.floor(srand() * 3);
    for (let i = 0; i < nLoot; i++) {
      lootSpots.push(new THREE.Vector3(cx + sr(-w / 2 + 1.2, w / 2 - 1.2), baseY + 0.2, cz + sr(-d / 2 + 1.2, d / 2 - 1.2)));
    }
    if (srand() < 0.55) chestSpots.push({ pos: new THREE.Vector3(cx + sr(-w / 2 + 1.3, w / 2 - 1.3), baseY + 0.2, cz + sr(-d / 2 + 1.3, d / 2 - 1.3)), rot: srand() * Math.PI });
    // un tavolo
    if (srand() < 0.6) {
      const tx = cx + sr(-w / 4, w / 4), tz = cz + sr(-d / 4, d / 4);
      addBox(1.6, 0.9, 0.9, tx, baseY + 0.55, tz, crateMat);
    }
    return house;
  }

  function overlapsHouse(x, z, w, d) {
    for (const h of houses) {
      if (Math.abs(x - h.cx) < (w + h.w) / 2 + 4 && Math.abs(z - h.cz) < (d + h.d) / 2 + 4) return true;
    }
    return false;
  }

  for (const t of TOWNS) {
    let placed = 0, tries = 0;
    while (placed < t.houses && tries < 200) {
      tries++;
      const w = Math.round(sr(8, 13)), d = Math.round(sr(8, 12));
      const a = srand() * Math.PI * 2, rr = placed === 0 && t.houses > 6 ? sr(14, 20) : sr(4, t.r - 8);
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      const rot = srand() < 0.5;
      const ww = rot ? d : w, dd = rot ? w : d;
      if (overlapsHouse(x, z, ww, dd)) continue;
      placeHouse(x, z, w, d, t.h, rot);
      placed++;
    }
    // torri
    if (t.towers) {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.4;
        const x = t.x + Math.cos(a) * (t.r - 6), z = t.z + Math.sin(a) * (t.r - 6);
        addBox(5, 18, 5, x, t.h + 9, z, wallMats[2]);
        addBox(6, 0.6, 6, x, t.h + 18.3, z, metalMat);
        lootSpots.push(new THREE.Vector3(x + 3.5, t.h + 0.2, z));
      }
    }
    if (t.containers) {
      for (let i = 0; i < 7; i++) {
        const x = t.x + sr(-t.r + 4, t.r - 4), z = t.z + sr(-t.r + 4, t.r - 4);
        if (overlapsHouse(x, z, 7, 7)) continue;
        const rot = srand() < 0.5;
        const stack = srand() < 0.35 ? 2 : 1;
        for (let s = 0; s < stack; s++) {
          addBox(rot ? 2.5 : 6.5, 2.6, rot ? 6.5 : 2.5, x, t.h + 1.3 + s * 2.6, z, containerMats[Math.floor(srand() * 4)]);
        }
        lootSpots.push(new THREE.Vector3(x + (rot ? 2 : 0), t.h + 0.2, z + (rot ? 0 : 2)));
      }
    }
    // casse di legno come copertura
    const nCrates = Math.floor(t.r / 3);
    for (let i = 0; i < nCrates; i++) {
      const a = srand() * Math.PI * 2, rr = sr(3, t.r);
      const x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr;
      if (overlapsHouse(x, z, 1.5, 1.5)) continue;
      const s = sr(1.1, 1.4);
      const gy = terrainHeight(x, z);
      addBox(s, s, s, x, gy + s / 2, z, crateMat);
      if (srand() < 0.3) addBox(s * 0.9, s * 0.9, s * 0.9, x + 0.1, gy + s + s * 0.45, z, crateMat);
      if (srand() < 0.5) lootSpots.push(new THREE.Vector3(x + s, gy, z));
    }
  }

  // Fontana al centro
  {
    const t = TOWNS[0];
    const f = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 1, 20), m('stone', '#b8b4a8'));
    f.position.set(t.x, t.h + 0.5, t.z); f.castShadow = f.receiveShadow = true; scene.add(f);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 20), m('fwater', '#4aa8e0', { metalness: 0.3, roughness: 0.1 }));
    w.position.set(t.x, t.h + 0.95, t.z); scene.add(w);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 10), m('stone', '#b8b4a8'));
    p.position.set(t.x, t.h + 2, t.z); p.castShadow = true; scene.add(p);
    addCollider({ type: 'cyl', x: t.x, z: t.z, r: 3.3, minY: t.h - 1, maxY: t.h + 1 });
    addCollider({ type: 'cyl', x: t.x, z: t.z, r: 0.5, minY: t.h, maxY: t.h + 3.5, noStand: true });
    lootSpots.push(new THREE.Vector3(t.x, t.h + 1.05, t.z + 1.8));
  }

  // ── Alberi (instanced) ──
  const trees = [];
  let tries = 0;
  while (trees.length < 420 && tries < 5000) {
    tries++;
    const x = sr(-HALF + 8, HALF - 8), z = sr(-HALF + 8, HALF - 8);
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.8 || h > 26) continue;
    if (inTown(x, z, 6)) continue;
    if (roadDist(x, z) < 4) continue;
    trees.push({ x, z, h, s: sr(0.8, 1.35), pine: srand() < 0.55 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3, 6);
  trunkGeo.translate(0, 1.5, 0);
  const pineGeo = new THREE.ConeGeometry(1.9, 5, 7);
  pineGeo.translate(0, 5, 0);
  const roundGeo = new THREE.IcosahedronGeometry(2.2, 0);
  roundGeo.translate(0, 4.2, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, m('trunk', '#6b4524'), trees.length);
  const pines = trees.filter(t => t.pine), rounds = trees.filter(t => !t.pine);
  const pineMesh = new THREE.InstancedMesh(pineGeo, m('pine', '#2f6b34', { flatShading: true }), pines.length);
  const roundMesh = new THREE.InstancedMesh(roundGeo, m('leaf', '#4f9a3a', { flatShading: true }), rounds.length);
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const tcol = new THREE.Color();
  let pi = 0, ri = 0;
  trees.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), srand() * 6.28);
    sc.set(t.s, t.s, t.s); p.set(t.x, t.h - 0.2, t.z);
    mat4.compose(p, q, sc);
    trunkMesh.setMatrixAt(i, mat4);
    tcol.setHSL(0.28 + sr(-0.04, 0.05), 0.5, sr(0.28, 0.4));
    if (t.pine) { pineMesh.setMatrixAt(pi, mat4); pineMesh.setColorAt(pi++, tcol); }
    else { roundMesh.setMatrixAt(ri, mat4); roundMesh.setColorAt(ri++, tcol); }
    addCollider({ type: 'cyl', x: t.x, z: t.z, r: 0.4 * t.s, minY: t.h - 1, maxY: t.h + 3.2 * t.s, noStand: true, tree: true });
  });
  for (const im of [trunkMesh, pineMesh, roundMesh]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // ── Rocce ──
  const rocks = [];
  tries = 0;
  while (rocks.length < 140 && tries < 3000) {
    tries++;
    const x = sr(-HALF + 6, HALF - 6), z = sr(-HALF + 6, HALF - 6);
    if (inTown(x, z, 3)) continue;
    const h = terrainHeight(x, z);
    rocks.push({ x, z, h, s: sr(0.7, 2.4) });
  }
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), m('rock', '#8f8b82', { flatShading: true }), rocks.length);
  rocks.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(srand() * 3, srand() * 3, srand() * 3));
    sc.set(r.s * sr(0.9, 1.4), r.s * sr(0.6, 1), r.s * sr(0.9, 1.3));
    p.set(r.x, r.h + r.s * 0.25, r.z);
    mat4.compose(p, q, sc);
    rockMesh.setMatrixAt(i, mat4);
    addCollider({ type: 'cyl', x: r.x, z: r.z, r: r.s * 0.95, minY: r.h - 2, maxY: r.h + r.s * 0.9 });
    if (srand() < 0.15) lootSpots.push(new THREE.Vector3(r.x + r.s + 0.8, r.h, r.z));
  });
  rockMesh.castShadow = rockMesh.receiveShadow = true;
  scene.add(rockMesh);

  // ── Erba decorativa ──
  const grassGeo = new THREE.ConeGeometry(0.12, 0.6, 3);
  grassGeo.translate(0, 0.3, 0);
  const grassMesh = new THREE.InstancedMesh(grassGeo, m('grass', '#6fae45'), 2500);
  for (let i = 0; i < 2500; i++) {
    const x = sr(-HALF, HALF), z = sr(-HALF, HALF);
    const h = terrainHeight(x, z);
    p.set(x, h < WATER_LEVEL ? -100 : h, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), srand() * 6);
    const s = sr(0.6, 1.4); sc.set(s, s, s);
    mat4.compose(p, q, sc);
    grassMesh.setMatrixAt(i, mat4);
  }
  scene.add(grassMesh);

  // Loot sparso per la mappa
  for (let i = 0; i < 45; i++) {
    const x = sr(-HALF + 15, HALF - 15), z = sr(-HALF + 15, HALF - 15);
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.3) continue;
    lootSpots.push(new THREE.Vector3(x, h, z));
  }
  for (let i = 0; i < 10; i++) {
    const x = sr(-HALF + 20, HALF - 20), z = sr(-HALF + 20, HALF - 20);
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.3 || inTown(x, z, 5)) continue;
    chestSpots.push({ pos: new THREE.Vector3(x, h, z), rot: srand() * 3 });
  }

  // ── Minimappa pre-renderizzata ──
  const MM = 300;
  const mm = document.createElement('canvas');
  mm.width = mm.height = MM;
  const g = mm.getContext('2d');
  const img = g.createImageData(MM, MM);
  for (let py = 0; py < MM; py++) for (let px = 0; px < MM; px++) {
    const x = (px / MM) * HALF * 2 - HALF, z = (py / MM) * HALF * 2 - HALF;
    const h = terrainHeight(x, z);
    let r, gg, b;
    if (h < WATER_LEVEL) { r = 40; gg = 120; b = 190; }
    else if (h < WATER_LEVEL + 1) { r = 210; gg = 195; b = 140; }
    else if (h > 24) { const k = Math.min(1, (h - 24) / 10); r = 130 + 110 * k; gg = 125 + 115 * k; b = 115 + 125 * k; }
    else { const s = Math.max(0, Math.min(1, (h + 4) / 22)); r = 70 + 40 * s; gg = 130 + 40 * s; b = 55 + 20 * s; }
    if (roadDist(x, z) < 2.5) { r = 170; gg = 145; b = 100; }
    const i = (py * MM + px) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const k = MM / (HALF * 2);
  g.fillStyle = 'rgba(60,40,30,0.85)';
  for (const h of houses) g.fillRect((h.cx - h.w / 2 + HALF) * k, (h.cz - h.d / 2 + HALF) * k, h.w * k, h.d * k);
  g.fillStyle = 'rgba(30,80,30,0.55)';
  for (const t of trees) g.fillRect((t.x + HALF) * k - 1, (t.z + HALF) * k - 1, 2, 2);

  return { lootSpots, chestSpots, houses, minimap: mm, crateMat, woodTex };
}
