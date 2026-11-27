// ─────────────────────────────────────────────────────────────
//  v41: oggetti da lancio (tasto G, H per cambiare tipo)
//   · traiettoria parabolica vera: velocità iniziale + gravità, rimbalzi sui muri e sul terreno
//     (riflessione sulla normale della superficie colpita, con attrito e perdita di energia)
//   · Fumogeno: nube di sfere dense che si allarga e copre la vista (anche ai bot: smokeBlocks)
//   · Granata a frammentazione: miccia di 2,5 s, danni ad area che calano con la distanza,
//     distrugge muri e strutture vicine
//   · Granata a impulso: non fa danni, spinge via chi è vicino; lanciata sotto i piedi è una
//     catapulta (la gestisce main.js con onDetonate)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const THROWABLES = {
  frag: { name: 'Granata a frammentazione', short: 'Granata', icon: '💣', color: '#6f7f3c', max: 6, pickup: 2, fuse: 2.5, rarity: 2 },
  smoke: { name: 'Fumogeno', short: 'Fumogeno', icon: '💨', color: '#9aa4ae', max: 4, pickup: 2, fuse: 1.4, rarity: 1 },
  impulse: { name: 'Granata a impulso', short: 'Impulso', icon: '🌀', color: '#38b6ff', max: 4, pickup: 2, fuse: 1.0, rarity: 3 },
};
export const THROW_IDS = ['frag', 'smoke', 'impulse'];
export const THROW_G = 20;         // gravità dei lanci (m/s²)
export const THROW_SPEED = 21;     // velocità iniziale (m/s)
export const FRAG = { dmg: 95, radius: 6.5 };
export const IMPULSE = { radius: 6.5 };
export const SMOKE = { radius: 5.6, life: 15, puffs: 44 };

// ───────────── modelli ─────────────
const _mats = {};
function mat(key, color, o = {}) { return _mats[key] || (_mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...o })); }
const _geos = {};
function geo(key, f) { return _geos[key] || (_geos[key] = f()); }

/** modello dell'oggetto (in mano, a terra, in volo): ~12 cm, con la base in y=0 */
export function buildThrowMesh(id) {
  const g = new THREE.Group();
  if (id === 'frag') {
    // corpo a "ananas" con le scanalature, leva e anello della sicura
    const body = new THREE.Mesh(geo('fragB', () => { const s = new THREE.SphereGeometry(0.06, 12, 10); s.scale(1, 1.18, 1); return s; }), mat('frag', '#5d6b33', { roughness: 0.7 }));
    body.position.y = 0.07; g.add(body);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(geo('fragR', () => new THREE.TorusGeometry(0.06, 0.006, 4, 16)), mat('fragD', '#3f4a22', { roughness: 0.8 }));
      r.rotation.x = Math.PI / 2; r.position.y = 0.045 + i * 0.025; r.scale.setScalar(1 - Math.abs(i - 1) * 0.12); g.add(r);
    }
    const cap = new THREE.Mesh(geo('fragC', () => new THREE.CylinderGeometry(0.022, 0.026, 0.03, 10)), mat('steel', '#a9aeb4', { metalness: 0.7, roughness: 0.35 }));
    cap.position.y = 0.145; g.add(cap);
    const lever = new THREE.Mesh(geo('fragL', () => new THREE.BoxGeometry(0.016, 0.1, 0.012)), mat('steel', '#a9aeb4'));
    lever.position.set(0.035, 0.11, 0); lever.rotation.z = -0.25; g.add(lever);
    const ring = new THREE.Mesh(geo('fragP', () => new THREE.TorusGeometry(0.018, 0.004, 4, 12)), mat('gold', '#d8b24a', { metalness: 0.8, roughness: 0.3 }));
    ring.position.set(-0.03, 0.155, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
  } else if (id === 'smoke') {
    // bomboletta con fascia colorata e tappo
    const body = new THREE.Mesh(geo('smB', () => new THREE.CylinderGeometry(0.045, 0.045, 0.15, 14)), mat('smoke', '#7d8790', { roughness: 0.6 }));
    body.position.y = 0.075; g.add(body);
    const band = new THREE.Mesh(geo('smF', () => new THREE.CylinderGeometry(0.047, 0.047, 0.035, 14)), mat('smokeB', '#e8eef2', { roughness: 0.5 }));
    band.position.y = 0.09; g.add(band);
    const cap = new THREE.Mesh(geo('smC', () => new THREE.CylinderGeometry(0.03, 0.04, 0.03, 12)), mat('steel', '#a9aeb4', { metalness: 0.7, roughness: 0.35 }));
    cap.position.y = 0.165; g.add(cap);
    for (const a of [0, 2.1, 4.2]) { const h = new THREE.Mesh(geo('smH', () => new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6)), mat('dark', '#222')); h.position.set(Math.cos(a) * 0.02, 0.183, Math.sin(a) * 0.02); g.add(h); }
  } else {
    // impulso: sfera blu luminosa con due anelli d'energia
    const body = new THREE.Mesh(geo('imB', () => new THREE.SphereGeometry(0.06, 16, 12)), mat('imp', '#1a8fe0', { emissive: '#2ab4ff', emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.3 }));
    body.position.y = 0.07; g.add(body);
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(geo('imR', () => new THREE.TorusGeometry(0.075, 0.008, 6, 20)), mat('impR', '#d8f4ff', { emissive: '#9be3ff', emissiveIntensity: 1.2 }));
      r.position.y = 0.07; r.rotation.set(Math.PI / 2 + i * 1.1, i * 0.6, 0); g.add(r);
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** velocità iniziale del lancio dalla direzione di mira (yaw, pitch): un po' verso l'alto, come un lancio a parabola */
export function throwVelocity(yaw, pitch, out = new THREE.Vector3(), speed = THROW_SPEED) {
  const p = Math.min(1.25, pitch + 0.2);
  out.set(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)).multiplyScalar(speed);
  return out;
}

const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _hp = new THREE.Vector3(), _c = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

/**
 * ctx: { scene, rayWorld(o, d, max), terrainHeight(x, z), onDetonate(g), onBounce(g, speed), onSmoke(cloud) }
 */
export function createThrowables(ctx) {
  const { scene } = ctx;
  const list = [];
  const clouds = [];

  // ── normale della superficie colpita (terreno, scatole, anelli, cilindri) ──
  function surfaceNormal(hit, p, out) {
    if (!hit.collider) {
      const e = 0.6, hx = ctx.terrainHeight(p.x + e, p.z) - ctx.terrainHeight(p.x - e, p.z), hz = ctx.terrainHeight(p.x, p.z + e) - ctx.terrainHeight(p.x, p.z - e);
      return out.set(-hx, 2 * e, -hz).normalize();
    }
    const c = hit.collider;
    if (c.type === 'ramp') {   // v41: rampa costruita: normale del piano inclinato (o di sotto)
      const ax = c.dir[0] === 'x', L = ax ? c.maxX - c.minX : c.maxZ - c.minZ, k = (c.maxY - c.minY) / L * (c.dir[1] === '-' ? -1 : 1);
      out.set(ax ? -k : 0, 1, ax ? 0 : -k).normalize();
      let t = ((ax ? p.x : p.z) - (ax ? c.minX : c.minZ)) / L; if (c.dir[1] === '-') t = 1 - t;
      const top = c.minY + Math.max(0, Math.min(1, t)) * (c.maxY - c.minY);
      return p.y < top - 0.13 ? out.negate() : out;
    }
    if (c.type === 'box') {
      const f = [p.x - c.minX, c.maxX - p.x, p.y - c.minY, c.maxY - p.y, p.z - c.minZ, c.maxZ - p.z];
      let k = 0; for (let i = 1; i < 6; i++) if (Math.abs(f[i]) < Math.abs(f[k])) k = i;
      return out.set(k === 0 ? -1 : k === 1 ? 1 : 0, k === 2 ? -1 : k === 3 ? 1 : 0, k === 4 ? -1 : k === 5 ? 1 : 0);
    }
    if (p.y > c.maxY - 0.08) return out.set(0, 1, 0);
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
    if (c.type === 'ring') { const inner = d < (c.r0 + c.r1) / 2; return out.set(dx / d * (inner ? -1 : 1), 0, dz / d * (inner ? -1 : 1)); }
    return out.set(dx / d, 0, dz / d);
  }

  /** un passo di simulazione (condiviso fra lancio vero e anteprima della traiettoria) */
  function step(pos, vel, h, ignore) {
    vel.y -= THROW_G * h;
    const len = vel.length() * h;
    if (len < 1e-5) return null;
    _d.copy(vel).divideScalar(vel.length());
    const hit = ctx.rayWorld(pos, _d, len + 0.07, ignore);
    if (hit && hit.t <= len + 0.07) {
      _hp.copy(pos).addScaledVector(_d, Math.max(0, hit.t - 0.07));
      surfaceNormal(hit, _hp.clone().addScaledVector(_d, 0.08), _n);
      pos.copy(_hp).addScaledVector(_n, 0.03);
      return _n;
    }
    pos.addScaledVector(vel, h);
    return null;
  }

  function spawn(id, owner, pos, vel) {
    const mesh = buildThrowMesh(id);
    if (id === 'frag') mesh.children[0].material = mesh.children[0].material.clone();   // lampeggia da sola
    mesh.position.copy(pos);
    scene.add(mesh);
    const g = { id, owner, pos: pos.clone(), vel: vel.clone(), t: 0, fuse: THROWABLES[id].fuse, rest: false, mesh, spin: new THREE.Vector3(Math.random() * 14 - 7, Math.random() * 8, Math.random() * 14 - 7), bounces: 0, landT: -1 };
    list.push(g);
    return g;
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i];
      g.t += dt;
      if (!g.rest) {
        const n = Math.max(1, Math.ceil(g.vel.length() * dt / 0.5));
        for (let k = 0; k < n && !g.rest; k++) {
          const nrm = step(g.pos, g.vel, dt / n, null);
          if (nrm) {
            const vn = g.vel.dot(nrm), speed = g.vel.length();
            // rimbalzo: componente normale riflessa e smorzata, quella tangente frenata dall'attrito
            g.vel.addScaledVector(nrm, -vn);
            g.vel.multiplyScalar(nrm.y > 0.6 ? 0.5 : 0.8);
            g.vel.addScaledVector(nrm, -vn * 0.36);
            g.spin.multiplyScalar(0.6);
            if (speed > 2.5) { g.bounces++; ctx.onBounce && ctx.onBounce(g, speed); }
            if (g.landT < 0 && nrm.y > 0.6) g.landT = g.t;
            if (nrm.y > 0.6 && g.vel.length() < 1.3) { g.rest = true; g.vel.set(0, 0, 0); }
          }
        }
        g.mesh.position.copy(g.pos);
        g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt; g.mesh.rotation.z += g.spin.z * dt;
      } else {
        g.mesh.position.copy(g.pos);
        g.mesh.rotation.x *= 0.9; g.mesh.rotation.z *= 0.9;
      }
      // l'impulso scoppia appena tocca terra (dopo un attimo), gli altri allo scadere della miccia
      const boom = g.t >= g.fuse || (g.id === 'impulse' && g.landT >= 0 && g.t - g.landT > 0.35);
      // la granata lampeggia sempre più veloce
      if (g.id === 'frag') { const m = g.mesh.children[0].material; m.emissive.set('#ff3020'); m.emissiveIntensity = Math.sin(g.t * (6 + g.t * 10)) > 0.6 ? 0.9 : 0; }
      if (boom) {
        if (g.id === 'smoke') addCloud(g.pos, g.owner);
        else ctx.onDetonate && ctx.onDetonate(g);
        scene.remove(g.mesh);
        list.splice(i, 1);
      }
    }
    updateClouds(dt);
  }

  /** punti della traiettoria prevista (fino al primo impatto o a 2,5 s) */
  function predict(pos, vel, out, maxT = 2.5) {
    const p = pos.clone(), v = vel.clone(), h = 1 / 30;
    let n = 0;
    out[n++] = p.clone();
    let hitN = null;
    for (let t = 0; t < maxT && n < 90; t += h) {
      hitN = step(p, v, h, null);
      out[n++] = p.clone();
      if (hitN) break;
    }
    out.length = n;
    return hitN ? hitN.clone() : null;
  }

  // ── nubi di fumo: sfere dense (InstancedMesh) che si allargano, ondeggiano e si dissolvono ──
  const MAXP = SMOKE.puffs * 8;
  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const puffMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, MAXP);
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puffs.frustumCulled = false; puffs.count = 0; puffs.castShadow = false; puffs.receiveShadow = true;
  puffs.setColorAt(0, new THREE.Color('#ffffff'));
  scene.add(puffs);
  const _col = new THREE.Color();

  function addCloud(at, owner) {
    if (clouds.length >= 8) clouds.shift();
    const c = { pos: at.clone(), t: 0, life: SMOKE.life, owner, p: [] };
    for (let k = 0; k < SMOKE.puffs; k++) {
      const a = Math.random() * Math.PI * 2, u = Math.random(), r = Math.sqrt(u) * SMOKE.radius * 0.82;
      c.p.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.5 + Math.random() * SMOKE.radius * 0.75 * (1 - u * 0.5), s: 1.2 + Math.random() * 1.2, ph: Math.random() * 6.3, sh: 0.72 + Math.random() * 0.22 });
    }
    clouds.push(c);
    ctx.onSmoke && ctx.onSmoke(c);
  }
  /** raggio attuale della nube (cresce in 1,6 s, si ritira negli ultimi 2 s) */
  function cloudK(c) { return Math.min(1, c.t / 1.6) * Math.min(1, (c.life - c.t) / 2); }
  function updateClouds(dt) {
    let n = 0;
    for (let i = clouds.length - 1; i >= 0; i--) { clouds[i].t += dt; if (clouds[i].t >= clouds[i].life) clouds.splice(i, 1); }
    for (const c of clouds) {
      const k = cloudK(c), grow = 1 - Math.pow(1 - Math.min(1, c.t / 1.6), 3);
      for (const p of c.p) {
        if (n >= MAXP) break;
        const w = Math.sin(c.t * 0.7 + p.ph) * 0.25;
        _s.setScalar(p.s * (0.25 + 0.75 * k) * (1 + w * 0.2));
        _c.set(c.pos.x + p.x * grow + w, c.pos.y + p.y * grow + c.t * 0.04, c.pos.z + p.z * grow - w * 0.5);
        _q.setFromEuler(_e.set(p.ph + c.t * 0.1, p.ph * 2, 0));
        _m4.compose(_c, _q, _s);
        puffs.setMatrixAt(n, _m4);
        puffs.setColorAt(n, _col.setScalar(p.sh));
        n++;
      }
    }
    puffs.count = n;
    puffs.instanceMatrix.needsUpdate = true;
    if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  }
  /** il segmento a→b attraversa una nube densa? (vista dei bot, mira assistita) */
  function smokeBlocks(a, b) {
    for (const c of clouds) {
      const k = cloudK(c); if (k < 0.45) continue;
      const R = SMOKE.radius * 0.85 * k;
      _c.set(c.pos.x, c.pos.y + SMOKE.radius * 0.35, c.pos.z);
      _d.subVectors(b, a); const L2 = _d.lengthSq(); if (L2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, _hp.subVectors(_c, a).dot(_d) / L2));
      _hp.copy(a).addScaledVector(_d, t);
      if (_hp.distanceToSquared(_c) < R * R) return true;
    }
    return false;
  }
  /** quanto è denso il fumo in un punto (0..1) — per il velo sullo schermo quando la camera è dentro */
  function smokeAt(p) {
    let best = 0;
    for (const c of clouds) {
      const k = cloudK(c); if (k <= 0) continue;
      const R = SMOKE.radius * k;
      const d = Math.hypot(p.x - c.pos.x, (p.y - c.pos.y - SMOKE.radius * 0.35) * 1.3, p.z - c.pos.z);
      best = Math.max(best, Math.min(1, (1 - d / R) * 2.2));
    }
    return best;
  }
  function clear() {
    for (const g of list) scene.remove(g.mesh);
    list.length = 0; clouds.length = 0; puffs.count = 0;
  }
  return { spawn, update, predict, smokeBlocks, smokeAt, clear, list, clouds };
}
