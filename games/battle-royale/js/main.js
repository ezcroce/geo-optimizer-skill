// ═════════════════════════════════════════════════════════════
//  ARENA ROYALE 3D — battle royale in terza persona (Three.js)
// ═════════════════════════════════════════════════════════════
import * as THREE from 'three';
import {
  RARITIES, WEAPONS, WEAPON_POOL, CONSUMABLES, AMMO_TYPES, SKINS, GLIDERS,
  DIFFICULTY, STORM_PHASES, BOT_NAMES, HATS, BACKPACKS, MODES,
} from './config.js?v=8';
import * as PR from './progress.js?v=8';
import { NET, broadcast as netSend, sendTo as netSendTo } from './net.js?v=8';
import { initMenu } from './menu.js?v=8';
import * as A from './audio.js?v=8';
import {
  buildWorld, terrainHeight, groundAt, resolveCollisions, rayWorld, rayColliders,
  addCollider, removeCollider, HALF, WATER_LEVEL, TOWNS, SCALE, GRASS_PLAYER, tallGrassAt,
} from './world.js?v=8';
import { buildCharacter, buildWeaponMesh, buildItemMesh, buildGlider, buildBus, RIG } from './character.js?v=8';
import { loadModelOverrides, MODEL_SOURCE } from './props.js?v=8';
import { resetPose, setLeg, setArm, legsLocomotion, legsAir, armsSwing, poseHold, poseClimb, poseMantle, poseSkydive, poseGlide, poseSwim, poseDeath } from './anim.js?v=8';

const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function angLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}
function angDiff(a, b) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function weighted(list, key = 'w') {
  const tot = list.reduce((s, x) => s + x[key], 0);
  let r = Math.random() * tot;
  for (const x of list) { r -= x[key]; if (r <= 0) return x; }
  return list[list.length - 1];
}
function rollRarity(weights) {
  const tot = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return 0;
}

// ─────────────── Impostazioni salvate ───────────────
const settings = Object.assign({ name: 'Giocatore', skin: 'recluta', glider: 'classico', difficulty: 'normale', players: 100, sens: 1, vol: 0.5, mode: 'br', hat: 'none', back: 'none' },
  JSON.parse(localStorage.getItem('arenaRoyale') || '{}'));
// oggetti equipaggiati ma non (più) posseduti → torna a quelli base
if (!PR.owns('skin', settings.skin)) settings.skin = 'recluta';
if (!PR.owns('glider', settings.glider)) settings.glider = 'classico';
if (!PR.owns('hat', settings.hat)) settings.hat = 'none';
if (!PR.owns('back', settings.back)) settings.back = 'none';
if (!MODES.some(m => m.id === settings.mode)) settings.mode = 'br';
function saveSettings() { localStorage.setItem('arenaRoyale', JSON.stringify(settings)); }

// ─────────────── Renderer & scena ───────────────
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c9e3f8', 190, 720);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2600);

const hemi = new THREE.HemisphereLight('#d6ebff', '#5f6a3c', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffeccc', 2.65);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(70, 130, 45);
const flashLight = new THREE.PointLight('#ffb050', 0, 30, 2);
scene.add(flashLight);

function gradientMaterial(top, bottom) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) },
      warm: { value: new THREE.Color('#ffe2b8') }, sunDir: { value: SUN_OFF.clone().normalize() },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 warm; uniform vec3 sunDir; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y * 1.3 + 0.12, 0.0, 1.0);
        vec3 col = mix(bottom, top, pow(h, 0.8));
        float s = max(dot(d, sunDir), 0.0);
        col = mix(col, warm, pow(s, 6.0) * 0.35 * (1.0 - h * 0.5));   // alone caldo intorno al sole
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 3.0 + pow(s, 60.0) * 0.25);   // disco del sole
        col = mix(col, bottom * 1.02, smoothstep(0.08, -0.05, d.y));   // foschia all'orizzonte
        gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 20), gradientMaterial('#2f72d2', '#cfe6fb'));
sky.renderOrder = -1;
scene.add(sky);

// Nuvole
const clouds = [];
{
  const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
  const cg = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 28; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(cg, cm);
      const s = rand(6, 13);
      m.scale.set(s * 1.3, s * 0.6, s);
      m.position.set(j * rand(6, 10) - n * 4, rand(-2, 2), rand(-5, 5));
      g.add(m);
    }
    g.position.set(rand(-400, 400), rand(150, 200), rand(-400, 400));
    scene.add(g);
    clouds.push(g);
  }
}

// Mondo
// se in models/ ci sono i file .glb originali vengono caricati prima di costruire il mondo
const loadedModels = await loadModelOverrides('models/');
if (loadedModels.length) console.info('Modelli GLB caricati:', loadedModels.join(', '));
let world = buildWorld(scene, { seed: 1337, random: false });
/** ricostruisce l'isola (Random Map: un seme nuovo a ogni partita) */
async function prepareWorld(seed, random) {
  if (world.seed === seed && world.random === random) return;
  const ld = $('#loading');
  ld.querySelector('p').textContent = random ? "Generazione di un'isola casuale…" : "Caricamento dell'isola…";
  ld.classList.remove('hidden');
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 40)));
  for (const c of G.chests) if (c.mesh) scene.remove(c.mesh);
  G.chests = [];
  world.dispose();
  world = buildWorld(scene, { seed, random });
  for (const cs of world.chestSpots) G.chests.push({ pos: cs.pos.clone(), rot: cs.rot, mesh: null, lid: null, opened: false, t: 0 });
  window.__game && (window.__game.world = world);
  ld.classList.add('hidden');
}

// ─────────────── Effetti: particelle, traccianti, flash ───────────────
const PMAX = 500;
const particleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), PMAX);
particleMesh.frustumCulled = false;
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(particleMesh);
const P = [];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _col = new THREE.Color();
for (let i = 0; i < PMAX; i++) {
  P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.1, g: 1 });
  _m4.makeScale(0, 0, 0);
  particleMesh.setMatrixAt(i, _m4);
  particleMesh.setColorAt(i, _col.set('#ffffff'));
}
let pIdx = 0;
function emit(pos, color, n = 6, speed = 4, life = 0.5, size = 0.12, g = 1) {
  _col.set(color);
  for (let k = 0; k < n; k++) {
    pIdx = (pIdx + 1) % PMAX;
    const p = P[pIdx];
    p.x = pos.x; p.y = pos.y; p.z = pos.z;
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
    const s = speed * rand(0.4, 1);
    p.vx = Math.cos(a) * Math.cos(e) * s; p.vy = Math.abs(Math.sin(e)) * s + speed * 0.3; p.vz = Math.sin(a) * Math.cos(e) * s;
    p.life = p.max = life * rand(0.6, 1.2); p.size = size * rand(0.6, 1.3); p.g = g;
    particleMesh.setColorAt(pIdx, _col);
  }
  particleMesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = P[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vy -= 14 * p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const s = p.life > 0 ? p.size * (p.life / p.max) : 0;
    _m4.compose(_p.set(p.x, p.y, p.z), _q, _s.set(s, s, s));
    particleMesh.setMatrixAt(i, _m4);
  }
  particleMesh.instanceMatrix.needsUpdate = true;
}

const tracers = [];
{
  const tg = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.frustumCulled = false;
    scene.add(m);
    tracers.push({ m, life: 0 });
  }
}
let tIdx = 0;
function tracer(a, b, color = '#ffe9a0', width = 0.035, life = 0.07, opacity = 0.85) {
  const t = tracers[tIdx = (tIdx + 1) % tracers.length];
  const len = a.distanceTo(b);
  if (len < 0.5) return;
  t.m.position.copy(a).add(b).multiplyScalar(0.5);
  t.m.scale.set(width, width, len);
  t.m.lookAt(b);
  t.m.material.color.set(color);
  t.m.material.opacity = opacity;
  t.m.visible = true;
  t.life = t.max = life; t.op = opacity;
}
const flashes = [];
{
  const fg = new THREE.IcosahedronGeometry(0.14, 0);
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: '#ffd560', transparent: true, opacity: 0.95 }));
    m.visible = false; scene.add(m);
    flashes.push({ m, life: 0 });
  }
}
let fIdx = 0;
function muzzleFlash(pos, big = false) {
  const f = flashes[fIdx = (fIdx + 1) % flashes.length];
  f.m.position.copy(pos);
  f.m.scale.setScalar(big ? 2.2 : rand(0.9, 1.4));
  f.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  f.m.visible = true; f.life = 0.05;
}
const booms = [];
{
  const bg = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: '#ff9a30', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m);
    booms.push({ m, life: 0, r: 1 });
  }
}
let bIdx = 0;
function updateEffects(dt) {
  for (const t of tracers) if (t.life > 0) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max) * t.op; if (t.life <= 0) t.m.visible = false; }
  for (const f of flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.m.visible = false; }
  for (const b of booms) if (b.life > 0) {
    b.life -= dt;
    const k = 1 - b.life / 0.55;
    b.m.scale.setScalar(b.r * (0.3 + k * 1.1));
    b.m.material.opacity = Math.max(0, 1 - k) * 0.9;
    b.m.material.color.setHSL(0.08 - k * 0.06, 1, 0.6 - k * 0.3);
    if (b.life <= 0) b.m.visible = false;
  }
  if (flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 200);
}

// ─────────────── Stato di gioco ───────────────
const G = {
  state: 'menu', paused: false, time: 0,
  chars: [], player: null, loot: [], chests: [], projectiles: [], bullets: [], walls: [],
  storm: null, bus: null, diff: DIFFICULTY.normale,
  camYaw: 0, camPitch: 0, camDist: 4.2, fov: 70, shake: 0,
  ads: false, build: { on: false }, spectate: null, endShown: false,
  dmgNums: [], killfeed: [], msgT: 0, hitT: 0, hurtT: 0, placement: 0,
  mode: 'br', net: null, netForce: false, lootSeq: 0, lootPrefix: '', lootInit: false, matchStats: { chests: 0 },
};

const SLOT_COUNT = 5;
const GRAVITY = 22;
const JUMP_V = 7.8;
const CHAR_R = 0.4, CHAR_H = 1.85;
const BODY = [[0.45, 0.33], [0.95, 0.36], [1.35, 0.36]];

function buildPickaxe(color = '#7fd0ff') {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.85), new THREE.MeshStandardMaterial({ color: '#6b4524' }));
  h.position.z = 0.25; g.add(h);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.1), new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }));
  head.position.set(0, 0.05, 0.65); g.add(head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ─────────────── Personaggi ───────────────
class Character {
  constructor(name, skin, isPlayer = false, cos = null) {
    this.name = name; this.skin = skin; this.isPlayer = isPlayer; this.human = isPlayer;
    this.cos = cos || {};
    this.m = buildCharacter(skin, this.cos);
    scene.add(this.m.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.hp = 100; this.shield = 0; this.alive = true;
    this.slots = new Array(SLOT_COUNT).fill(null);
    this.active = 0;
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0, rockets: 0 };
    this.mats = 30;
    this.mode = 'bus'; this.onGround = false; this.inWater = false;
    this.fireCd = 0; this.reloading = 0; this.reloadSlot = -1; this.using = null; this.swing = 0;
    this.kills = 0; this.walkPhase = 0; this.moveAmt = 0; this.deadT = 0;
    this.glider = null; this.heldKey = ''; this.bloom = 0;
    this.damageDealt = 0;
    this.crouch = false; this.crouchK = 0;           // abbassarsi
    this.stamina = 100; this.climbDir = new THREE.Vector3(); this.climbPhase = 0; this.mantle = null; // arrampicata
    this.equipT = 0; this.landT = 0;                  // animazioni
    this.m.root.visible = false;
    this.updateHeld();
  }
  get slot() { return this.slots[this.active]; }
  get weapon() { const s = this.slot; return s && s.kind === 'weapon' ? s : null; }
  get hScale() { return 1 - 0.27 * this.crouchK; }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.35 * this.hScale, this.pos.z); }
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.65 * this.hScale, this.pos.z); }
  updateHeld() {
    const s = this.slot;
    const key = s ? (s.kind === 'weapon' ? `w${s.id}${s.rarity}` : `c${s.id}`) : 'pick';
    if (key === this.heldKey) return;
    this.heldKey = key;
    const gp = this.m.gunPivot;
    while (gp.children.length) gp.remove(gp.children[0]);
    let mesh;
    if (!s) mesh = buildPickaxe(this.skin.accColor || '#7fd0ff');
    else if (s.kind === 'weapon') mesh = buildWeaponMesh(s.id, s.rarity);
    else { mesh = buildItemMesh('cons', s.id); mesh.scale.setScalar(0.75); mesh.position.set(0, 0, 0.12); }
    gp.add(mesh);
  }
  setActive(i) {
    if (i === this.active) return;
    this.active = i;
    this.reloading = 0; this.using = null;
    this.fireCd = Math.max(this.fireCd, 0.25);
    this.equipT = 0.28;
    this.updateHeld();
  }
}

// ─────────────── Arrampicata ───────────────
const CLIMB_SPEED = 3.4;
const _co = new THREE.Vector3(), _cd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** Cerca una superficie arrampicabile davanti al personaggio */
function wallAhead(ch, dir, height = 1.0, reach = CHAR_R + 0.45) {
  _co.set(ch.pos.x, ch.pos.y + height, ch.pos.z);
  const h = rayColliders(_co, dir, reach);
  if (!h || h.collider.tree) return null;
  return h;
}
/** Direzione "verso il muro" allineata alla faccia colpita */
function wallDir(ch, hit, dir) {
  const c = hit.collider;
  if (c.type === 'cyl') return _cd.set(c.x - ch.pos.x, 0, c.z - ch.pos.z).normalize();
  const px = ch.pos.x + dir.x * hit.t, pz = ch.pos.z + dir.z * hit.t;
  const e = [Math.abs(px - c.minX), Math.abs(px - c.maxX), Math.abs(pz - c.minZ), Math.abs(pz - c.maxZ)];
  const m = Math.min(...e);
  if (m === e[0]) return _cd.set(1, 0, 0);
  if (m === e[1]) return _cd.set(-1, 0, 0);
  if (m === e[2]) return _cd.set(0, 0, 1);
  return _cd.set(0, 0, -1);
}
function canStartClimb(ch, dir) {
  if (ch.stamina < 15 || ch.mode !== 'ground' || ch.using) return null;
  const hit = wallAhead(ch, dir);
  if (!hit) return null;
  if (hit.collider.maxY - ch.pos.y < 0.5) return null;  // è solo un gradino
  // serve spazio libero sopra (niente scalate sotto un soffitto, es. dentro casa)
  _co.set(ch.pos.x, ch.pos.y + CHAR_H, ch.pos.z);
  const room = hit.collider.maxY + CHAR_H - (ch.pos.y + CHAR_H) + 0.2;
  if (rayColliders(_co, _up, room)) return null;
  return hit;
}
function startClimb(ch, hit, dir) {
  ch.climbDir.copy(wallDir(ch, hit, dir));
  ch.mode = 'climb';
  ch.climbH = 0;
  ch.vel.set(0, 0, 0);
  ch.crouch = false;
  ch.reloading = 0;
  ch.mantle = null;
  if (ch.isPlayer) { A.playStep(); toggleBuild(false); }
}
function endClimb(ch, jumpOff = false) {
  ch.mode = 'ground'; ch.onGround = false; ch.mantle = null;
  if (jumpOff) ch.vel.set(-ch.climbDir.x * 4.5, 6.5, -ch.climbDir.z * 4.5);
  else ch.vel.set(0, 0, 0);
}
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function updateClimb(ch, dt, up, down, jump) {
  // scavalcamento finale (animazione fluida verso la cima)
  if (ch.mantle) {
    const M = ch.mantle;
    M.t = Math.min(1, M.t + dt / 0.6);
    // prima si tira su (sale), poi spinge e porta il corpo oltre il bordo (avanza)
    const ky = easeInOut(Math.min(1, M.t / 0.62)), kx = easeInOut(clamp((M.t - 0.3) / 0.7, 0, 1));
    ch.pos.x = lerp(M.from.x, M.to.x, kx);
    ch.pos.z = lerp(M.from.z, M.to.z, kx);
    ch.pos.y = lerp(M.from.y, Math.max(M.to.y, M.from.y), ky) + Math.sin(kx * Math.PI) * 0.12 + (M.to.y < M.from.y ? (M.to.y - M.from.y) * kx : 0);
    ch.climbPhase += dt * 10;
    if (M.t >= 1) { ch.pos.copy(M.to); ch.mode = 'ground'; ch.onGround = true; ch.vel.set(0, 0, 0); ch.mantle = null; ch.landT = 0.2; }
    return;
  }
  if (jump) { endClimb(ch, true); return; }
  let dir = up ? 1 : (down ? -1 : 0);
  // soffitto sopra la testa?
  if (dir > 0) {
    _co.set(ch.pos.x, ch.pos.y + CHAR_H, ch.pos.z);
    if (rayColliders(_co, _up, 0.15)) { endClimb(ch); return; }
  }
  ch.stamina -= dt * (dir ? 11 : 5);
  if (ch.stamina <= 0) { ch.stamina = 0; endClimb(ch); return; }
  ch.pos.y += dir * CLIMB_SPEED * dt;
  ch.climbH += dir * CLIMB_SPEED * dt;
  ch.climbPhase += dt * dir * 7;
  ch.moveAmt = Math.abs(dir) * 2;
  // resta attaccato alla parete (3 sonde: piedi, vita, testa → le finestre non ingannano)
  const low = wallAhead(ch, ch.climbDir, 0.3, CHAR_R + 0.7);
  const mid = wallAhead(ch, ch.climbDir, 1.0, CHAR_R + 0.7);
  const top = wallAhead(ch, ch.climbDir, 1.75, CHAR_R + 0.7);
  const any = low || mid || top;
  if (any && any.t > CHAR_R + 0.12) { ch.pos.x += ch.climbDir.x * (any.t - CHAR_R - 0.08); ch.pos.z += ch.climbDir.z * (any.t - CHAR_R - 0.08); }
  // in cima: tutto il corpo ha superato il bordo → scavalca
  if (!any && dir >= 0 && ch.climbH > 0.4) {
    const tx = ch.pos.x + ch.climbDir.x * 0.95, tz = ch.pos.z + ch.climbDir.z * 0.95;
    const ty = groundAt(tx, tz, ch.pos.y + 0.8);
    // se dietro il bordo c'è il vuoto (muro sottile) scavalca e lascia agire la gravità
    const toY = ty < ch.pos.y - 0.6 ? ch.pos.y + 0.2 : ty;
    ch.mantle = { t: 0, from: ch.pos.clone(), to: new THREE.Vector3(tx, toY, tz) };
    if (ch.isPlayer) A.playStep();
    return;
  }
  if (!any) { endClimb(ch); return; }
  // scendendo, tocca terra
  if (dir < 0) {
    const g = groundAt(ch.pos.x, ch.pos.z, ch.pos.y);
    if (ch.pos.y <= g) { ch.pos.y = g; ch.mode = 'ground'; ch.onGround = true; }
  }
}

function muzzlePos(ch, out = new THREE.Vector3()) {
  const s = ch.weapon;
  const z = s ? WEAPONS[s.id].muzzle : 0.6;
  ch.m.root.updateMatrixWorld();
  return ch.m.gunPivot.localToWorld(out.set(0, 0.02, z));
}

function showGlider(ch, on) {
  if (on && !ch.glider) {
    const gid = ch.isPlayer ? settings.glider : ch.cos.glider;
    const gd = GLIDERS.find(g => g.id === gid) || pick(GLIDERS);
    ch.glider = buildGlider(gd);
    ch.m.root.add(ch.glider);
  } else if (!on && ch.glider) {
    ch.m.root.remove(ch.glider);
    ch.glider = null;
  }
}

// Movimento a terra
function groundMove(ch, mx, mz, speed, dt, jump) {
  const prevY = ch.pos.y;
  const acc = ch.onGround ? 14 : 3;
  ch.vel.x += (mx * speed - ch.vel.x) * Math.min(1, acc * dt);
  ch.vel.z += (mz * speed - ch.vel.z) * Math.min(1, acc * dt);
  ch.pos.x += ch.vel.x * dt;
  ch.pos.z += ch.vel.z * dt;
  resolveCollisions(ch.pos, CHAR_R, CHAR_H);
  const lim = HALF - 4;
  ch.pos.x = clamp(ch.pos.x, -lim, lim);
  ch.pos.z = clamp(ch.pos.z, -lim, lim);
  if (jump && ch.onGround) { ch.vel.y = JUMP_V; ch.onGround = false; }
  ch.vel.y -= GRAVITY * dt;
  ch.pos.y += ch.vel.y * dt;
  let g = groundAt(ch.pos.x, ch.pos.z, Math.max(prevY, ch.pos.y));
  const swimY = WATER_LEVEL - 1.25;
  ch.inWater = g < swimY + 0.05;
  if (ch.inWater) g = swimY;
  if (ch.pos.y <= g) {
    if (!ch.onGround && ch.vel.y < -7) landFx(ch, ch.vel.y);
    ch.pos.y = g; ch.vel.y = 0; ch.onGround = true;
  }
  else if (ch.onGround && ch.vel.y <= 0 && ch.pos.y - g < 0.7) { ch.pos.y = g; ch.vel.y = 0; }
  else ch.onGround = false;
  ch.moveAmt = Math.hypot(ch.vel.x, ch.vel.z);
}

function landFx(ch, vy) {
  ch.landT = Math.min(0.3, -vy * 0.02);
  if (ch.pos.distanceToSquared(camera.position) < 60 * 60) {
    for (let i = 0; i < 6; i++) emit(_p.set(ch.pos.x + rand(-0.4, 0.4), ch.pos.y + 0.1, ch.pos.z + rand(-0.4, 0.4)), '#cdbf9a', 1, 2.2, 0.5, 0.14, 0.3);
  }
  if (ch.isPlayer) A.playStep();
}

// Movimento in caduta libera / deltaplano
function airMove(ch, mx, mz, dt, deploy) {
  const gh = terrainHeight(ch.pos.x, ch.pos.z);
  if (ch.mode === 'fall') {
    ch.vel.y = Math.max(ch.vel.y - 30 * dt, -40);
    ch.vel.x = lerp(ch.vel.x, mx * 24, Math.min(1, dt * 2));
    ch.vel.z = lerp(ch.vel.z, mz * 24, Math.min(1, dt * 2));
    if (ch.pos.y - gh < 45 || (deploy && ch.pos.y - gh < 115)) {
      ch.mode = 'glide';
      showGlider(ch, true);
      if (ch.isPlayer) A.playUI();
    }
  } else {
    ch.vel.y = lerp(ch.vel.y, -6.5, Math.min(1, dt * 3));
    ch.vel.x = lerp(ch.vel.x, mx * 13, Math.min(1, dt * 1.5));
    ch.vel.z = lerp(ch.vel.z, mz * 13, Math.min(1, dt * 1.5));
  }
  const prevY = ch.pos.y;
  ch.pos.addScaledVector(ch.vel, dt);
  const lim = HALF - 5;
  ch.pos.x = clamp(ch.pos.x, -lim, lim);
  ch.pos.z = clamp(ch.pos.z, -lim, lim);
  resolveCollisions(ch.pos, CHAR_R, CHAR_H);
  let g = groundAt(ch.pos.x, ch.pos.z, prevY);
  if (g < WATER_LEVEL - 1.25) g = WATER_LEVEL - 1.25;
  if (ch.pos.y <= g) {
    ch.pos.y = g; ch.vel.set(0, 0, 0);
    ch.mode = 'ground'; ch.onGround = true;
    showGlider(ch, false);
    landFx(ch, -12);
    if (ch.isPlayer) showMsg('', '', 0);
  }
  ch.moveAmt = Math.hypot(ch.vel.x, ch.vel.z);
}

// ─────────────── Animazioni dei personaggi ───────────────
const EMOTES = [
  { id: 'ballo', name: 'Ballo disco', icon: '🕺', dur: 4.2 },
  { id: 'saluto', name: 'Saluto', icon: '👋', dur: 2.4 },
  { id: 'floss', name: 'Floss', icon: '💃', dur: 4.0 },
  { id: 'tifo', name: 'Esultanza', icon: '🙌', dur: 2.6 },
];
const easeOutBounce = x => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
const bump = x => Math.sin(clamp(x, 0, 1) * Math.PI);
function angDelta(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

function startEmote(ch, id) {
  if (!ch.alive || ch.mode !== 'ground' || ch.using || ch.reloading > 0) return;
  const e = EMOTES.find(x => x.id === id) || EMOTES[0];
  ch.emote = e; ch.emoteT = 0; ch.crouch = false;
  if (ch.isPlayer) { toggleBuild(false); showMsg('', `${e.icon} ${e.name}`, 1.2); }
}
function stopEmote(ch) { ch.emote = null; }


function animateEmote(ch, m, dt) {
  const e = ch.emote, T = ch.emoteT, k = Math.min(1, T * 4) * Math.min(1, (e.dur - T) * 4); // dissolvenza in entrata/uscita
  m.gunPivot.visible = false;
  // si gira verso la telecamera per farsi vedere
  if (ch.isPlayer) { ch.emoteYaw = ch.emoteYaw === undefined ? ch.yaw : ch.emoteYaw; m.root.rotation.y = ch.yaw + Math.PI * easeInOut(Math.min(1, T * 2.5)); }
  const b = T * (e.id === 'ballo' ? 7.5 : e.id === 'floss' ? 9 : 6);
  if (e.id === 'ballo') {
    const s = Math.sin(b);
    m.body.position.y = Math.abs(Math.sin(b)) * 0.12 * k;
    m.body.rotation.z = s * 0.12 * k;
    m.torso.rotation.y = s * 0.3 * k;
    const up = Math.sin(b * 0.5) > 0;
    m.arms[1].rotation.set(lerp(0, up ? -2.7 : -0.4, k), 0, lerp(0, up ? -0.5 : 0.3, k));
    m.arms[0].rotation.set(lerp(0, up ? -0.4 : -2.7, k), 0, lerp(0, up ? -0.3 : 0.5, k));
    m.legs[0].rotation.set(Math.max(0, s) * -0.5 * k, 0, 0);
    m.legs[1].rotation.set(Math.max(0, -s) * -0.5 * k, 0, 0);
    m.head.rotation.set(0, s * 0.25 * k, Math.sin(b * 2) * 0.08 * k);
  } else if (e.id === 'saluto') {
    m.arms[1].rotation.set(-2.6 * k, 0, (-0.35 + Math.sin(b * 1.6) * 0.45) * k);
    m.arms[0].rotation.set(0, 0, 0.1 * k);
    m.body.rotation.z = Math.sin(b * 0.8) * 0.04 * k;
    m.head.rotation.set(0, 0, Math.sin(b * 1.6) * 0.12 * k);
  } else if (e.id === 'floss') {
    const s = Math.sin(b);
    const front = Math.sin(b * 0.5) > 0 ? 1 : -1;
    m.arms[0].rotation.set(front * 0.45 * k, 0, s * 0.7 * k);
    m.arms[1].rotation.set(-front * 0.45 * k, 0, s * 0.7 * k);
    m.body.rotation.z = -s * 0.14 * k;
    m.body.position.x = -s * 0.08 * k;
    m.legs[0].rotation.z = s * 0.1 * k; m.legs[1].rotation.z = s * 0.1 * k;
  } else if (e.id === 'tifo') {
    const hop = Math.abs(Math.sin(b));
    m.body.position.y = hop * 0.35 * k;
    m.arms[0].rotation.set(-2.9 * k, 0, (0.35 + hop * 0.2) * k);
    m.arms[1].rotation.set(-2.9 * k, 0, (-0.35 - hop * 0.2) * k);
    m.legs[0].rotation.x = -hop * 0.5 * k; m.legs[1].rotation.x = -hop * 0.3 * k;
    m.head.rotation.x = -0.3 * k;
  }
  if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 0.15 + Math.abs(Math.sin(b)) * 0.3, Math.min(1, dt * 6));
}

/** vicino: modello completo animato · lontano: modello semplificato · oltre la nebbia: nascosto */
function updateCharVisual(c, dt) {
  const m = c.m;
  if (c.isPlayer || !c.alive) { m.body.visible = true; m.lod.visible = false; animateChar(c, dt); return; }
  const d2 = c.pos.distanceToSquared(camera.position);
  if (d2 < 85 * 85) { m.body.visible = true; m.lod.visible = false; animateChar(c, dt); return; }
  m.body.visible = false;
  m.root.position.copy(c.pos); m.root.rotation.set(0, c.yaw, 0);
  if (d2 > 480 * 480) { m.lod.visible = false; return; }
  m.lod.visible = true;
  const falling = c.mode === 'fall';
  m.lod.rotation.x = falling ? 1.15 : 0;
  m.lod.position.y = falling ? 1 : 0;
}

function animateChar(ch, dt) {
  const m = ch.m;
  m.root.position.copy(ch.pos);
  m.root.rotation.y = ch.yaw;
  m.root.rotation.z = 0;
  const t = G.time;
  // ── morte: caduta all'indietro con rimbalzo e "puff" finale ──
  if (!ch.alive) {
    ch.deadT += dt;
    const k = easeOutBounce(Math.min(1, ch.deadT / 0.75));
    resetPose(m);
    m.body.rotation.x = -Math.PI / 2 * k;
    m.body.position.y = 0.25 * k;
    poseDeath(m, k);
    m.gunPivot.visible = false;
    if (ch.deadT > 2.2 && m.root.visible) {
      m.root.visible = false;
      if (ch.pos.distanceToSquared(camera.position) < 90 * 90) {
        emit(_p.copy(ch.pos).setY(ch.pos.y + 0.5), '#ffffff', 14, 3, 0.7, 0.18, -0.2);
        emit(_p.copy(ch.pos).setY(ch.pos.y + 0.5), RARITIES[ch.skin.rarity].color, 10, 4, 0.8, 0.12, -0.3);
      }
    }
    return;
  }
  // velocità di rotazione (per inclinarsi in curva)
  const yawRate = dt > 0 ? angDelta(ch.yaw, ch._prevYaw ?? ch.yaw) / dt : 0;
  ch._prevYaw = ch.yaw;
  if (ch.mode === 'fall') {
    resetPose(m);
    m.body.rotation.x = lerp(m.body.rotation.x, 1.15, dt * 4);
    m.body.position.y = 1;
    m.body.rotation.z = lerp(m.body.rotation.z || 0, clamp(-yawRate * 0.15, -0.5, 0.5), dt * 4);
    poseSkydive(m, t);
    m.gunPivot.visible = false;
    return;
  }
  m.body.rotation.x = lerp(m.body.rotation.x, 0, Math.min(1, dt * 8));
  resetPose(m);
  ch.crouchK = lerp(ch.crouchK, ch.crouch && ch.mode === 'ground' ? 1 : 0, Math.min(1, dt * 10));
  if (ch.mode === 'climb') {
    m.root.rotation.y = Math.atan2(ch.climbDir.x, ch.climbDir.z);
    m.gunPivot.visible = false;
    if (ch.mantle) poseMantle(m, ch.mantle.t);
    else poseClimb(m, ch.climbPhase);
    if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 0.15, dt * 4);
    return;
  }
  if (ch.mode === 'glide') {
    ch.leanSide = lerp(ch.leanSide || 0, clamp(-yawRate * 0.25, -0.45, 0.45), Math.min(1, dt * 4));
    m.root.rotation.z = ch.leanSide;
    poseGlide(m, t);
    m.body.position.y = Math.sin(t * 1.6) * 0.05;
    m.gunPivot.visible = false;
    if (m.cape) m.cape.rotation.x = 1.0 + Math.sin(t * 9) * 0.08;
    return;
  }

  // ── emote ──
  if (ch.emote) {
    ch.emoteT += dt;
    if (ch.emoteT >= ch.emote.dur || ch.moveAmt > 1.2 || !ch.onGround) ch.emote = null;
    else { animateEmote(ch, m, dt); return; }
  }

  // ── a terra ──
  m.gunPivot.visible = true;
  ch.animSpd = lerp(ch.animSpd || 0, ch.moveAmt, Math.min(1, dt * 10));
  const spd = ch.animSpd;
  const ck = ch.crouchK;
  const mv = Math.min(1, spd / (5.2 - ck * 2.6));
  const run = clamp((spd - 5.6) / 2, 0, 1) * (1 - ck);
  const fx = Math.sin(ch.yaw), fz = Math.cos(ch.yaw);
  const fwd = ch.vel.x * fx + ch.vel.z * fz;
  const side = ch.vel.x * -fz + ch.vel.z * fx;   // positivo = verso destra
  // in retromarcia le gambe girano al contrario
  const dirSign = fwd < -0.5 && Math.abs(fwd) > Math.abs(side) ? -1 : 1;
  ch.walkPhase += dt * (3.4 + spd * 1.45 + ck * 1.2) * (mv > 0.05 ? 1 : 0) * dirSign;
  const sw = Math.sin(ch.walkPhase) * mv;
  if (ch.isPlayer && mv > 0.3 && ch.onGround) {
    const step = Math.floor(ch.walkPhase / Math.PI);
    if (step !== ch._lastStep) { ch._lastStep = step; A.playStep(); }
  }
  // inclinazioni morbide: avanti quando corri, di lato quando ti sposti o giri
  ch.leanFwd = lerp(ch.leanFwd || 0, clamp(fwd * 0.016, -0.08, 0.1) + run * 0.14, Math.min(1, dt * 8));
  ch.leanSide = lerp(ch.leanSide || 0, clamp(-side * 0.022 - yawRate * 0.03, -0.2, 0.2), Math.min(1, dt * 8));
  m.body.rotation.x = ch.leanFwd * (1 - ck * 0.6);
  m.body.rotation.z = ch.leanSide * (1 - ck * 0.5);

  // gambe
  let bodyY = 0;
  if (!ch.onGround && !ch.inWater) legsAir(m, ch.vel.y / 6);
  else bodyY = legsLocomotion(m, ch.walkPhase, mv, run, ck);
  // passo laterale: le gambe si aprono un po' di lato
  if (ch.onGround && Math.abs(side) > 1 && Math.abs(side) > Math.abs(fwd)) {
    const ss = Math.sin(ch.walkPhase) * 0.18 * Math.sign(side) * mv;
    m.legs[0].rotation.z += ss; m.legs[1].rotation.z += ss;
  }
  // respiro e spostamento del peso da fermo
  const idle = 1 - mv;
  const breath = Math.sin(t * 2.1) * 0.5 + 0.5;
  // atterraggio: piccolo affondo elastico (piega le ginocchia)
  if (ch.landT > 0) ch.landT = Math.max(0, ch.landT - dt);
  const land = Math.sin((ch.landT / 0.3) * Math.PI) * ch.landT;
  if (land > 0) for (let i = 0; i < 2; i++) { m.legs[i].rotation.x -= land * 1.6; m.knees[i].rotation.x += land * 3.2; m.feet[i].rotation.x -= land * 1.6; }
  m.body.position.y = bodyY - land * 0.45 + breath * 0.01 * idle;
  // busto: si piega in avanti da accovacciato, ruota con le spalle quando cammini
  m.torso.rotation.x = 0.32 * ck + land * 0.5 + breath * 0.022 * idle + run * 0.06;
  m.torso.rotation.y = Math.sin(ch.walkPhase) * (0.1 + run * 0.08) * mv * (1 - ck * 0.7);
  m.torso.rotation.z = Math.sin(t * 0.9) * 0.015 * idle;
  m.torso.position.y = RIG.hip + Math.abs(Math.cos(ch.walkPhase)) * 0.008 * mv;

  // la testa ogni tanto si guarda attorno quando sei fermo
  ch.lookT = (ch.lookT ?? rand(2, 5)) - dt;
  if (ch.lookT <= 0) { ch.lookT = rand(2.5, 6); ch.lookYaw = idle > 0.8 && !G.ads ? rand(-0.55, 0.55) : 0; }
  ch.lookCur = lerp(ch.lookCur || 0, idle > 0.8 && !(ch.isPlayer && (mouse.left || G.ads)) ? (ch.lookYaw || 0) : 0, Math.min(1, dt * 3));

  // in acqua: bracciate
  if (ch.inWater) {
    m.gunPivot.visible = false;
    poseSwim(m, t);
    m.body.rotation.x = 0.5; m.body.position.y = 0.15 + Math.sin(t * 4.5) * 0.04;
    if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 1.2, dt * 4);
    return;
  }

  const p = ch.pitch;
  const s = ch.slot;
  const lean = m.torso.rotation.x + m.body.rotation.x;
  const sprinting = run > 0.5 && ch.onGround && ck < 0.3 && !(ch.isPlayer && (mouse.left || G.ads));
  ch.sprintK = lerp(ch.sprintK || 0, sprinting ? 1 : 0, Math.min(1, dt * 9));
  const sk = ch.sprintK;
  m.gunPivot.rotation.set(-p, 0, 0);
  m.gunPivot.position.set(0.12, 0.37, 0.34);
  if (!s) {
    // piccone: braccia libere che oscillano, colpo dall'alto
    armsSwing(m, ch.walkPhase, mv, run, ck);
    const k = ch.swing > 0 ? Math.sin((1 - ch.swing / 0.45) * Math.PI) : 0;
    setArm(m, 1, -0.75 - k * 1.5 + sw * 0.2 - sk * 0.2 - lean * 0.5, 0.12, -0.75 + k * 0.5);
    m.gunPivot.position.set(0.24, 0.18 + k * 0.3, 0.28);
    m.gunPivot.rotation.set(-0.6 + k * 1.6, 0, 0);
  } else if (s.kind === 'cons') {
    const k = ch.using ? Math.sin(G.time * 10) * 0.2 : 0;
    setArm(m, 1, -0.75 + k - lean, 0.1, -1.0);
    setArm(m, 0, -0.75 - k - lean, 0.4, -1.1);
    m.gunPivot.position.set(0.05, 0.3, 0.32);
  } else {
    // arma: posa di mira, oppure "arma bassa" mentre corri
    poseHold(m, p, sk, sw, lean);
    // ricarica: la mano sinistra scende al caricatore e torna su, l'arma si inclina
    if (ch.reloading > 0) {
      const dur = WEAPONS[s.id].reload;
      const ph = 1 - ch.reloading / dur;
      const dip = bump(ph / 0.55), push = bump((ph - 0.55) / 0.45);
      m.arms[0].rotation.x += dip * 0.9 - push * 0.25;
      m.elbows[0].rotation.x -= dip * 0.6;
      m.arms[0].rotation.z += dip * 0.2;
      m.gunPivot.rotation.z += 0.55 * bump(ph);
      m.gunPivot.rotation.x += 0.35 * bump(ph);
      m.head.rotation.x = 0.25 * bump(ph);
    }
  }
  // rinculo
  if (ch.recoilT > 0) {
    ch.recoilT = Math.max(0, ch.recoilT - dt);
    const r = ch.recoilT / 0.14;
    const kick = r * r * (ch.recoilK || 1);
    m.gunPivot.position.z -= kick * 0.1;
    m.gunPivot.rotation.x += kick * 0.3;
    m.arms[0].rotation.x += kick * 0.14; m.arms[1].rotation.x += kick * 0.14;
    m.elbows[1].rotation.x = Math.min(0, m.elbows[1].rotation.x - kick * 0.2);
    m.torso.rotation.x -= kick * 0.06;
  }
  // cambio arma: l'oggetto scende e risale con un'animazione morbida
  if (ch.equipT > 0) {
    ch.equipT = Math.max(0, ch.equipT - dt);
    const e = Math.sin((ch.equipT / 0.28) * Math.PI * 0.5);
    m.gunPivot.position.y -= e * 0.4;
    m.gunPivot.rotation.x += e * 1.2;
    m.arms[1].rotation.x += e * 0.8;
    m.arms[0].rotation.x += e * 0.8;
  }
  // colpito: sussulto
  if (ch.hitT > 0) {
    ch.hitT = Math.max(0, ch.hitT - dt);
    const h = bump(1 - ch.hitT / 0.3);
    m.torso.rotation.z += h * 0.22 * (ch.hitDir || 1);
    m.torso.rotation.x -= h * 0.12;
    m.head.rotation.z = h * 0.25 * (ch.hitDir || 1);
  }
  m.head.rotation.x += -p * 0.5 - m.torso.rotation.x * 0.6;
  m.head.rotation.y = ch.lookCur - m.torso.rotation.y;
  if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 0.08 + mv * 0.55 + run * 0.25 + Math.sin(t * 6) * 0.04 * mv + (ch.onGround ? 0 : 0.5), Math.min(1, dt * 6));
}

// ─────────────── Raycast su personaggi ───────────────
function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  if (c > 0 && b > 0) return -1;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t < 0 ? 0 : t;
}
function rayChars(o, d, maxDist, ignore) {
  let best = maxDist, hc = null, head = false;
  for (const c of G.chars) {
    if (!c.alive || c === ignore || c.mode === 'bus') continue;
    const cx = c.pos.x, cy = c.pos.y + 1, cz = c.pos.z;
    const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z;
    const tp = ox * d.x + oy * d.y + oz * d.z;
    if (tp < -1.5 || tp > best + 1.5) continue;
    const px = o.x + d.x * tp - cx, py = o.y + d.y * tp - cy, pz = o.z + d.z * tp - cz;
    if (px * px + py * py + pz * pz > 2.6) continue;
    const hs = c.hScale;
    const th = raySphere(o, d, cx, c.pos.y + 1.79 * hs, cz, 0.27);
    if (th >= 0 && th < best) { best = th; hc = c; head = true; }
    for (const [yy, r] of BODY) {
      const t = raySphere(o, d, cx, c.pos.y + yy * hs, cz, r);
      if (t >= 0 && t < best - 0.01) { best = t; hc = c; head = false; }
    }
  }
  return hc ? { t: best, char: hc, head } : null;
}
function rayAll(o, d, maxDist, ignore) {
  const w = rayWorld(o, d, maxDist);
  const lim = w ? w.t : maxDist;
  const c = rayChars(o, d, lim, ignore);
  return c || w;
}
const _u = new THREE.Vector3(), _v = new THREE.Vector3();
function spreadDir(dir, s) {
  if (s <= 0) return dir.clone();
  _u.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.95) _u.set(1, 0, 0);
  _u.crossVectors(dir, _u).normalize();
  _v.crossVectors(dir, _u).normalize();
  const r = Math.tan(s * Math.sqrt(Math.random())), th = Math.random() * Math.PI * 2;
  return dir.clone().addScaledVector(_u, Math.cos(th) * r).addScaledVector(_v, Math.sin(th) * r).normalize();
}
function hasLOS(a, b) {
  const o = a.eye(), t = b.chest();
  const d = t.sub(o);
  const len = d.length();
  d.divideScalar(len);
  return !rayWorld(o, d, len - 0.4);
}

// ─────────────── Combattimento ───────────────
function startReload(ch) {
  const s = ch.weapon;
  if (!s || ch.reloading > 0) return;
  const def = WEAPONS[s.id];
  if (s.mag >= def.mag || ch.ammo[def.ammo] <= 0) return;
  ch.reloading = def.reload;
  ch.reloadSlot = ch.active;
  ch.using = null;
  if (ch.isPlayer) A.playReload();
}

function fireWeapon(ch, aimFn) {
  const s = ch.weapon;
  if (!s) return false;
  const def = WEAPONS[s.id];
  if (ch.fireCd > 0 || ch.reloading > 0 || ch.using || ch.mode === 'climb') return false;
  if (s.mag <= 0) {
    if (ch.ammo[def.ammo] > 0) startReload(ch);
    else { if (ch.isPlayer) { A.playEmpty(); showMsg('', 'Munizioni esaurite!', 1.2); } ch.fireCd = 0.3; }
    return false;
  }
  s.mag--;
  ch.fireCd = def.rate;
  ch.emote = null;
  ch.recoilT = 0.14; ch.recoilK = def.pellets > 1 || def.projectile ? 1.6 : def.rate > 0.5 ? 1.3 : 0.7;
  const mult = RARITIES[s.rarity].mult * (ch.isPlayer ? 1 : G.diff.dmgMult);
  const muzzle = muzzlePos(ch);
  A.playGun(def.sound, ch.isPlayer ? 0 : muzzle.distanceTo(camera.position));
  if (muzzle.distanceTo(camera.position) < 140) muzzleFlash(muzzle, def.pellets > 1 || def.projectile);
  if (ch.isPlayer) { flashLight.position.copy(muzzle); flashLight.intensity = 25; }
  const net = G.net && !ch.remote ? { t: 'shot', i: ch.idx, w: s.id, r: s.rarity, o: [], d: [] } : null;
  for (let i = 0; i < def.pellets; i++) {
    const { origin, dir } = aimFn(i);
    const o = def.projectile ? muzzle : origin;
    if (net) { net.o.push(+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)); net.d.push(+dir.x.toFixed(4), +dir.y.toFixed(4), +dir.z.toFixed(4)); }
    if (def.projectile) { spawnRocket(ch, muzzle, dir, def.dmg * mult, def); continue; }
    spawnBullet(ch, origin, dir, def, def.dmg * mult);
  }
  if (net) netShot(ch, net);
  ch.lastShotT = G.time;
  if (ch.isPlayer) ch.shots = (ch.shots || 0) + 1;
  if (s.mag === 0 && ch.ammo[def.ammo] > 0) setTimeout(() => { if (ch.alive && ch.weapon === s) startReload(ch); }, 250);
  return true;
}

function melee(ch) {
  if (ch.swing > 0 || ch.fireCd > 0) return;
  ch.swing = 0.45; ch.fireCd = 0.45;
  if (ch.isPlayer) A.playGun('melee');
  setTimeout(() => {
    if (!ch.alive) return;
    const o = ch.chest();
    const d = new THREE.Vector3(Math.sin(ch.yaw) * Math.cos(ch.pitch), Math.sin(ch.pitch), Math.cos(ch.yaw) * Math.cos(ch.pitch));
    const hit = rayAll(o, d, 2.4, ch);
    if (!hit) return;
    const p = o.clone().addScaledVector(d, hit.t);
    if (hit.char) { damage(hit.char, 20, ch, false, 'Piccone'); emit(p, '#d02020', 6, 3, 0.4, 0.08); return; }
    if (hit.collider) {
      if (hit.collider.hp) damageWall(hit.collider, 50);
      if (hit.collider.barrel) damageBarrel(hit.collider.barrel, 20, ch);
      const gain = hit.collider.harvest ?? (hit.collider.tree ? 12 : (hit.collider.type === 'cyl' ? 8 : 0));
      if (gain && ch.isPlayer) {
        ch.mats = Math.min(999, ch.mats + gain);
        dmgNumber(p, `+${gain} 🪵`, 'shield');
      }
      const pt = hit.collider.prop && hit.collider.prop.type;
      emit(p, hit.collider.tree || pt === 'logs' || (hit.collider.barrel && !hit.collider.barrel.explosive) ? '#8a5a2a' : pt === 'bricks' ? '#b5533a' : '#999999', 7, 3.5, 0.45, 0.1);
      if (ch.isPlayer) A.playHit(false);
    }
  }, 160);
}

const BOT_VS_BOT = 0.2;
function damage(t, amount, attacker, head = false, how = '', ignoreShield = false) {
  if (!t.alive || amount <= 0) return;
  if (G.net && !G.netForce && !netDamageGate(t, amount, attacker, head, how, ignoreShield)) return;
  // con 100 giocatori i bot fra loro si fanno meno male: la partita dura di più e tu resti protagonista
  if (attacker && !attacker.human && !t.human && attacker !== t) amount *= BOT_VS_BOT;
  amount = Math.max(1, Math.round(amount));
  let sh = 0;
  if (!ignoreShield) { sh = Math.min(t.shield, amount); t.shield -= sh; }
  t.hp -= (amount - sh);
  if (attacker && attacker !== t) {
    t.lastAttacker = attacker;
    t.hitT = 0.3; t.emote = null;
    { const dx = attacker.pos.x - t.pos.x, dz = attacker.pos.z - t.pos.z; t.hitDir = (dx * Math.cos(t.yaw) - dz * Math.sin(t.yaw)) > 0 ? -1 : 1; }
    attacker.damageDealt += amount;
  }
  if (attacker === G.player && t !== G.player) {
    PR.track('damage', amount);
    if (head) PR.track('headshot', 1);
    dmgNumber(new THREE.Vector3(t.pos.x + rand(-0.3, 0.3), t.pos.y + 2.1, t.pos.z), amount, head ? 'head' : (sh > 0 ? 'shield' : ''));
    G.hitT = 0.15; $('#hitmarker').classList.toggle('head', head);
    sh > 0 ? A.playShieldHit() : A.playHit(head);
  }
  if (t === G.player) {
    G.hurtT = 0.4;
    if (attacker) A.playHurt();
  }
  if (!t.isPlayer && attacker && attacker !== t && attacker.alive && t.ai) {
    if (!t.ai.target || Math.random() < 0.6) { t.ai.target = attacker; t.ai.lastSeen = G.time; t.ai.lastSeenPos.copy(attacker.pos); }
    t.ai.alert = 3;
  }
  if (G.net && NET.role === 'host' && (t.human || (attacker && attacker.human))) {
    netSend({ t: 'hp', v: t.idx, hp: Math.max(0, Math.round(t.hp)), sh: Math.round(t.shield), a: attacker ? attacker.idx : -1, amt: amount, h: head ? 1 : 0, w: how });
  }
  if (t.hp <= 0) { if (G.net && NET.role === 'client') return; kill(t, attacker, how); }
}

function aliveCount() { let n = 0; for (const c of G.chars) if (c.alive) n++; return n; }

function kill(t, attacker, how) {
  if (!t.alive) return;
  if (G.net && NET.role === 'host') netSend({ t: 'kill', v: t.idx, a: attacker ? attacker.idx : -1, w: how });
  t.alive = false; t.hp = 0; t.shield = 0; t.deadT = 0;
  t.using = null; t.reloading = 0;
  showGlider(t, false);
  const place = aliveCount() + 1;
  t.place = place;
  // rilascia l'inventario
  const drops = [];
  if (!t.remote) for (const s of t.slots) if (s) drops.push(s.kind === 'weapon' ? { kind: 'weapon', id: s.id, rarity: s.rarity, mag: s.mag } : { kind: 'cons', id: s.id, count: s.count });
  if (!t.remote) for (const [k, v] of Object.entries(t.ammo)) if (v > 0) drops.push({ kind: 'ammo', id: k, count: Math.min(v, 60) });
  if (t.mats > 0 && !t.remote) drops.push({ kind: 'mats', count: Math.min(t.mats, 200) });
  drops.forEach((it, i) => {
    const a = (i / drops.length) * Math.PI * 2;
    const x = t.pos.x + Math.cos(a) * 1.3, z = t.pos.z + Math.sin(a) * 1.3;
    spawnLoot(it, new THREE.Vector3(x, groundAt(x, z, t.pos.y + 1), z), true);
  });
  emit(t.chest(), '#ffffff', 16, 5, 0.8, 0.15, 0.3);
  // kill feed
  let text;
  if (attacker && attacker !== t) {
    attacker.kills++;
    text = `<b>${esc(attacker.name)}</b> ha eliminato ${esc(t.name)} <span style="opacity:.7">[${esc(how)}]</span>`;
  } else if (how === 'storm') text = `${esc(t.name)} è stato consumato dalla tempesta ⛈`;
  else text = `${esc(t.name)} si è eliminato da solo 💥`;
  addFeed(text, attacker === G.player || t === G.player);
  if (attacker === G.player && t !== G.player) {
    PR.track('kill', 1);
    const wid = Object.keys(WEAPONS).find(k => WEAPONS[k].name === how);
    if (wid) PR.track('kill_' + wid, 1);
    A.playKill();
    showMsg('', `Hai eliminato ${t.name}!`, 2);
  }
  if (t === G.player) {
    G.placement = place;
    G.spectate = attacker && attacker.alive ? attacker : null;
    G.killedBy = attacker && attacker !== t ? attacker.name : (how === 'storm' ? 'la tempesta' : 'te stesso');
    G.ads = false;
    setTimeout(() => endMatch(false), 1800);
  }
  if (aliveCount() <= 1 && G.player.alive && !G.endShown) setTimeout(() => endMatch(true), 1200);
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// ─────────────── Razzi ───────────────
const rocketGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8).rotateX(Math.PI / 2);
const rocketMat = new THREE.MeshStandardMaterial({ color: '#555', emissive: '#ff5020', emissiveIntensity: 0.3 });
function spawnRocket(owner, pos, dir, dmg, def) {
  const mesh = new THREE.Mesh(rocketGeo, rocketMat);
  mesh.position.copy(pos);
  scene.add(mesh);
  G.projectiles.push({ owner, pos: pos.clone(), dir: dir.clone(), vel: dir.clone().multiplyScalar(def.speed || 55), g: BULLET_G * (def.drop ?? 0), dmg, def, life: 6, mesh });
}
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.vel.y -= pr.g * dt;
    const step = pr.vel.length() * dt;
    pr.dir.copy(pr.vel).normalize();
    const hit = rayAll(pr.pos, pr.dir, step, pr.owner);
    pr.life -= dt;
    if (hit || pr.life <= 0) {
      const at = pr.pos.clone().addScaledVector(pr.dir, hit ? hit.t : 0);
      explode(at, pr.owner, pr.dmg, pr.def.splash);
      scene.remove(pr.mesh);
      G.projectiles.splice(i, 1);
      continue;
    }
    pr.pos.addScaledVector(pr.dir, step);
    pr.mesh.position.copy(pr.pos);
    pr.mesh.lookAt(_p.copy(pr.pos).add(pr.dir));
    emit(pr.pos, Math.random() < 0.5 ? '#ffb040' : '#888888', 1, 0.6, 0.5, 0.18, -0.05);
  }
}
// ─────────────── Proiettili balistici: velocità, gravità e tempo di volo ───────────────
const BULLET_G = 9.8;
const BMAX = 900;
const bulletGeo = new THREE.BoxGeometry(1, 1, 1); bulletGeo.translate(0, 0, -0.5);   // la punta è nell'origine, la scia va indietro
const bulletMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const bulletMesh = new THREE.InstancedMesh(bulletGeo, bulletMat, BMAX);
bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
bulletMesh.frustumCulled = false;
bulletMesh.count = 0;
bulletMesh.setColorAt(0, new THREE.Color('#ffffff'));
scene.add(bulletMesh);
const _bdir = new THREE.Vector3(), _bz = new THREE.Vector3(0, 0, 1), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bm = new THREE.Matrix4();
const _bcolP = new THREE.Color('#fff0a8'), _bcolB = new THREE.Color('#ffae5a'), _bcolS = new THREE.Color('#bfe4ff');

function spawnBullet(owner, origin, dir, def, dmg) {
  if (G.bullets.length >= BMAX) G.bullets.shift();
  G.bullets.push({
    owner, def, dmg, pos: origin.clone(), prev: origin.clone(),
    vel: dir.clone().multiplyScalar(def.speed || 300), g: BULLET_G * (def.drop ?? 1),
    dist: 0, max: def.range * 1.35, whiz: false, player: owner.isPlayer,
  });
}

function bulletImpact(b, hit, end, dist) {
  const def = b.def;
  const fall = dist > def.range * 0.5 ? Math.max(0.5, 1 - (dist - def.range * 0.5) / def.range) : 1;
  const near = end.distanceToSquared(camera.position) < 120 * 120;
  if (hit.char) {
    damage(hit.char, b.dmg * fall * (hit.head ? 2 : 1), b.owner, hit.head, def.name);
    if (near) emit(end, '#d02020', 5, 3, 0.4, 0.08);
  } else {
    if (near) {
      emit(end, hit.terrain ? '#7a6a4a' : '#d8d0c0', 4, 3, 0.35, 0.07);
      if (!hit.terrain) emit(end, '#ffd27a', 2, 5, 0.12, 0.04, 0.2);   // scintille
    }
    if (hit.collider && hit.collider.hp) damageWall(hit.collider, b.dmg * fall);
    if (hit.collider && hit.collider.barrel) damageBarrel(hit.collider.barrel, b.dmg * fall, b.owner);
  }
}

function updateBullets(dt) {
  const P = G.player, cam = camera.position;
  let n = 0;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.vel.y -= b.g * dt;                                  // gravità
    const sx = b.vel.x * dt, sy = b.vel.y * dt, sz = b.vel.z * dt;
    const len = Math.hypot(sx, sy, sz);
    _bdir.set(sx / len, sy / len, sz / len);
    const hit = rayAll(b.pos, _bdir, len, b.owner);
    // sibilo quando un proiettile nemico ti passa vicino alla testa
    if (!b.whiz && !b.player && P && P.alive) {
      const hx = P.pos.x - b.pos.x, hy = P.pos.y + 1.6 - b.pos.y, hz = P.pos.z - b.pos.z;
      const tp = clamp(hx * _bdir.x + hy * _bdir.y + hz * _bdir.z, 0, hit ? hit.t : len);
      const cx = hx - _bdir.x * tp, cy = hy - _bdir.y * tp, cz = hz - _bdir.z * tp;
      if (cx * cx + cy * cy + cz * cz < 2.4 * 2.4 && !(hit && hit.char === P)) { b.whiz = true; A.playWhiz(); }
    }
    b.prev.copy(b.pos);
    if (hit) {
      const end = b.pos.clone().addScaledVector(_bdir, hit.t);
      bulletImpact(b, hit, end, b.dist + hit.t);
      G.bullets.splice(i, 1);
      continue;
    }
    b.pos.addScaledVector(_bdir, len);
    b.dist += len;
    // acqua: schizzo
    if (b.prev.y > WATER_LEVEL && b.pos.y <= WATER_LEVEL) {
      const k = (b.prev.y - WATER_LEVEL) / (b.prev.y - b.pos.y);
      const at = _p.copy(b.prev).lerp(b.pos, k);
      if (at.distanceToSquared(cam) < 120 * 120) emit(at, '#d8f0ff', 6, 3.5, 0.5, 0.09, 0.8);
      G.bullets.splice(i, 1);
      continue;
    }
    if (b.dist > b.max) { G.bullets.splice(i, 1); continue; }
    // scia di fumo del cecchino
    if (b.def.scope && b.pos.distanceToSquared(cam) < 260 * 260) tracer(b.prev, b.pos, '#e8f0ff', 0.03, 0.45, 0.35);
  }
  // disegno: una scia luminosa per proiettile (solo quelli abbastanza vicini)
  for (const b of G.bullets) {
    if (n >= BMAX) break;
    const d2 = b.pos.distanceToSquared(cam);
    if (d2 > 380 * 380) continue;
    const sp = b.vel.length();
    _bdir.copy(b.vel).divideScalar(sp);
    const streak = Math.min(b.dist + 0.2, clamp(sp * 0.011, 1.6, 6));
    const w = (b.player ? 0.05 : 0.04) * (1 + Math.sqrt(d2) / 120);   // da lontano un po' più spessa, per vederla
    _bq.setFromUnitVectors(_bz, _bdir);
    _bm.compose(b.pos, _bq, _bs.set(w, w, streak));
    bulletMesh.setMatrixAt(n, _bm);
    bulletMesh.setColorAt(n, b.def.scope ? _bcolS : b.player ? _bcolP : _bcolB);
    n++;
  }
  bulletMesh.count = n;
  bulletMesh.instanceMatrix.needsUpdate = true;
  if (bulletMesh.instanceColor) bulletMesh.instanceColor.needsUpdate = true;
}

/** barile rosso: dopo un po' di colpi esplode (e può farne esplodere altri vicini) */
function damageBarrel(pr, dmg, owner) {
  if (!pr.explosive || pr.dead) return;
  pr.hp -= dmg;
  if (pr.hp > 0) return;
  world.destroyBarrel(pr);
  const at = new THREE.Vector3(pr.x, pr.y + 0.6, pr.z);
  setTimeout(() => { if (G.state === 'play' || G.state === 'bus') explode(at, owner, 75, 6, 'Barile esplosivo'); }, 60 + Math.random() * 120);
}

function explode(at, owner, dmg, radius, how = 'Lanciarazzi') {
  const b = booms[bIdx = (bIdx + 1) % booms.length];
  b.m.position.copy(at); b.r = radius; b.life = 0.55; b.m.visible = true;
  emit(at, '#ff8a20', 26, 9, 0.8, 0.25, 0.6);
  emit(at, '#444444', 18, 5, 1.2, 0.35, -0.1);
  flashLight.position.copy(at); flashLight.intensity = 80;
  const d = at.distanceTo(camera.position);
  A.playExplosion(d);
  G.shake = Math.max(G.shake, clamp(1 - d / 45, 0, 1));
  for (const c of G.chars) {
    if (!c.alive || c.mode === 'bus') continue;
    const dist = c.chest().distanceTo(at);
    if (dist < radius) damage(c, dmg * (1 - dist / radius * 0.7) * (c === owner ? 0.5 : 1), owner, false, how);
  }
  for (const b of world.barrels) {
    if (!b.explosive || b.dead) continue;
    if (Math.abs(b.x - at.x) < radius && Math.abs(b.z - at.z) < radius && Math.hypot(b.x - at.x, b.y + 0.6 - at.y, b.z - at.z) < radius) damageBarrel(b, 999, owner);
  }
  for (const w of [...G.walls]) {
    const cx = (w.minX + w.maxX) / 2, cz = (w.minZ + w.maxZ) / 2;
    if (Math.hypot(cx - at.x, cz - at.z) < radius + 1.5) damageWall(w, 400);
  }
}

// ─────────────── Muri costruiti ───────────────
const wallGeoX = new THREE.BoxGeometry(4, 3.6, 0.25);
const ghostMat = new THREE.MeshBasicMaterial({ color: '#4aa0ff', transparent: true, opacity: 0.35, depthWrite: false });
const ghost = new THREE.Mesh(wallGeoX, ghostMat);
ghost.visible = false;
scene.add(ghost);
function buildSpot(p) {
  const yawSnap = Math.round(p.yaw / (Math.PI / 2)) * (Math.PI / 2);
  const fx = Math.round(Math.sin(yawSnap)), fz = Math.round(Math.cos(yawSnap));
  const x = Math.round((p.pos.x + fx * 2.4) * 2) / 2, z = Math.round((p.pos.z + fz * 2.4) * 2) / 2;
  const g = Math.max(groundAt(x, z, p.pos.y + 1), WATER_LEVEL - 1.2);
  return { x, z, g, yawSnap, alongX: fz !== 0 };
}
function placeWall(p) {
  if (p.mats < 10) { showMsg('', 'Materiali insufficienti! Colpisci alberi e rocce col piccone', 1.6); A.playEmpty(); return; }
  const s = buildSpot(p);
  const hw = s.alongX ? 2 : 0.125, hd = s.alongX ? 0.125 : 2;
  for (const c of G.chars) {
    if (c.alive && (c.mode === 'ground' || c.mode === 'climb') && Math.abs(c.pos.x - s.x) < hw + CHAR_R && Math.abs(c.pos.z - s.z) < hd + CHAR_R) { A.playEmpty(); return; }
  }
  p.mats -= 10;
  makeWall(s);
  if (p.isPlayer) PR.track('build', 1);
  if (G.net) netSend({ t: 'wall', x: s.x, z: s.z, g: +s.g.toFixed(2), ax: s.alongX ? 1 : 0 });
}
function makeWall(s) {
  const hw = s.alongX ? 2 : 0.125, hd = s.alongX ? 0.125 : 2;
  const mat = new THREE.MeshStandardMaterial({ map: world.woodTex, roughness: 0.9, color: '#ffffff' });
  const mesh = new THREE.Mesh(wallGeoX, mat);
  mesh.position.set(s.x, s.g + 1.8 - 0.1, s.z);
  mesh.rotation.y = s.alongX ? 0 : Math.PI / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const c = addCollider({ type: 'box', minX: s.x - hw, maxX: s.x + hw, minZ: s.z - hd, maxZ: s.z + hd, minY: s.g - 0.4, maxY: s.g + 3.5, hp: 150, maxHp: 150, built: true, mesh, noStand: false });
  G.walls.push(c);
  A.playBuild();
  emit(mesh.position, '#c8964a', 8, 2, 0.4, 0.12);
}
function damageWall(c, dmg) {
  if (!c.hp) return;
  c.hp -= dmg;
  if (c.mesh) {
    const k = clamp(c.hp / c.maxHp, 0, 1);
    c.mesh.material.color.setRGB(1, 0.5 + k * 0.5, 0.5 + k * 0.5);
  }
  if (c.hp <= 0) {
    removeCollider(c);
    if (c.mesh) { scene.remove(c.mesh); emit(c.mesh.position, '#a8743a', 16, 4, 0.8, 0.22); }
    G.walls.splice(G.walls.indexOf(c), 1);
    A.playBuild();
  }
}

// ─────────────── Consumabili ───────────────
function canUse(ch, id) {
  const d = CONSUMABLES[id];
  if (d.hp) return ch.hp < d.maxHp;
  if (d.shield) return ch.shield < d.maxShield;
  return false;
}
function startUse(ch) {
  const s = ch.slot;
  if (!s || s.kind !== 'cons' || ch.using) return;
  if (!canUse(ch, s.id)) {
    if (ch.isPlayer) { showMsg('', CONSUMABLES[s.id].hp ? 'Salute già al massimo' : 'Scudo già al massimo', 1.2); A.playEmpty(); }
    return;
  }
  ch.using = { t: 0, total: CONSUMABLES[s.id].time, slot: ch.active };
}
function updateUse(ch, dt) {
  if (!ch.using) return;
  if (ch.active !== ch.using.slot) { ch.using = null; return; }
  ch.using.t += dt;
  if (ch.using.t >= ch.using.total) {
    const s = ch.slot;
    const d = CONSUMABLES[s.id];
    const before = ch.hp + ch.shield;
    if (d.hp) ch.hp = Math.min(d.maxHp, ch.hp + d.hp);
    if (d.shield) ch.shield = Math.min(d.maxShield, ch.shield + d.shield);
    if (ch.isPlayer) {
      PR.track('heal', ch.hp + ch.shield - before);
      if (G.net && NET.role === 'client') netSend({ t: 'hpset', hp: ch.hp, sh: ch.shield, relay: false });
    }
    s.count--;
    if (s.count <= 0) ch.slots[ch.active] = null;
    ch.using = null;
    ch.updateHeld();
    if (ch.isPlayer) A.playHeal();
  }
}

// ─────────────── Bottino ───────────────
const ringGeo = new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2);
const beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 6, 6, 1, true);
beamGeo.translate(0, 3, 0);
const lootMats = RARITIES.map(r => ({
  ring: new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  beam: new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
}));

function randomWeapon(bonus = 0) {
  const w = weighted(WEAPON_POOL);
  const r = Math.min(4, rollRarity(w.rar) + bonus);
  return { kind: 'weapon', id: w.id, rarity: r, mag: WEAPONS[w.id].mag };
}
function randomCons() {
  const ids = ['bandage', 'bandage', 'medkit', 'minishield', 'minishield', 'shield'];
  const id = pick(ids);
  return { kind: 'cons', id, count: CONSUMABLES[id].count, rarity: CONSUMABLES[id].rarity };
}
function ammoFor(id) {
  const t = WEAPONS[id].ammo;
  return { kind: 'ammo', id: t, count: AMMO_TYPES[t].pickup };
}

function itemLabel(it) {
  if (it.kind === 'weapon') return `${WEAPONS[it.id].name} <span style="color:${RARITIES[it.rarity].color}">[${RARITIES[it.rarity].name}]</span>`;
  if (it.kind === 'cons') return `${CONSUMABLES[it.id].icon} ${CONSUMABLES[it.id].name} x${it.count}`;
  if (it.kind === 'ammo') return `${AMMO_TYPES[it.id].name} x${it.count}`;
  return `Materiali x${it.count}`;
}

function spawnLoot(item, pos, pop = false, id = null) {
  const L = { item, pos: pos.clone(), mesh: null, model: null, bob: Math.random() * 6, pop: pop ? 0.35 : 0, id: id ?? (G.lootPrefix + (G.lootSeq++)) };
  if (G.net && id === null && !G.lootInit) netSend({ t: 'loot', id: L.id, it: item, p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)], pop: pop ? 1 : 0 });
  G.loot.push(L);
  if (pop || pos.distanceToSquared(camera.position) < 150 * 150) buildLootMesh(L);
  return L;
}
function buildLootMesh(L) {
  const item = L.item, pos = L.pos;
  const g = new THREE.Group();
  let model;
  if (item.kind === 'weapon') { model = buildWeaponMesh(item.id, item.rarity); model.rotation.y = Math.PI / 2; model.rotation.z = 0.15; }
  else model = buildItemMesh(item.kind, item.id);
  model.position.y = 0.45;
  model.traverse(o => { if (o.isMesh) o.castShadow = false; });
  g.add(model);
  const rar = item.kind === 'weapon' ? item.rarity : (item.kind === 'cons' ? CONSUMABLES[item.id].rarity : -1);
  if (rar >= 0) {
    const ring = new THREE.Mesh(ringGeo, lootMats[rar].ring);
    ring.position.y = 0.04;
    g.add(ring);
    if (rar >= 2 && item.kind === 'weapon') { const beam = new THREE.Mesh(beamGeo, lootMats[rar].beam); g.add(beam); }
  }
  g.position.copy(pos);
  scene.add(g);
  L.mesh = g; L.model = model;
}
function removeLoot(L, remote = false) {
  const i = G.loot.indexOf(L);
  if (i >= 0) G.loot.splice(i, 1);
  if (G.net && !remote && i >= 0) netSend({ t: 'pick', id: L.id });
  if (L.mesh) scene.remove(L.mesh);
}
function slotFromItem(it) {
  return it.kind === 'weapon' ? { kind: 'weapon', id: it.id, rarity: it.rarity, mag: it.mag } : { kind: 'cons', id: it.id, count: it.count };
}
function itemFromSlot(s) {
  return s.kind === 'weapon' ? { kind: 'weapon', id: s.id, rarity: s.rarity, mag: s.mag } : { kind: 'cons', id: s.id, count: s.count };
}
function dropAt(ch, item) {
  const fx = Math.sin(ch.yaw), fz = Math.cos(ch.yaw);
  const x = ch.pos.x + fx * 1.2 + rand(-0.3, 0.3), z = ch.pos.z + fz * 1.2 + rand(-0.3, 0.3);
  spawnLoot(item, new THREE.Vector3(x, groundAt(x, z, ch.pos.y + 1), z), true);
}

function pickupLoot(ch, L, allowSwap = true) {
  const it = L.item;
  if (it.kind === 'ammo') { ch.ammo[it.id] = Math.min(AMMO_TYPES[it.id].max, ch.ammo[it.id] + it.count); removeLoot(L); return true; }
  if (it.kind === 'mats') { ch.mats = Math.min(999, ch.mats + it.count); removeLoot(L); return true; }
  if (it.kind === 'cons') {
    const def = CONSUMABLES[it.id];
    for (const s of ch.slots) {
      if (s && s.kind === 'cons' && s.id === it.id && s.count < def.stack) {
        const add = Math.min(def.stack - s.count, it.count);
        s.count += add; it.count -= add;
        if (it.count <= 0) { removeLoot(L); return true; }
      }
    }
  }
  const e = (ch.isPlayer && !ch.slot) ? ch.active : ch.slots.indexOf(null);
  if (e >= 0) {
    ch.slots[e] = slotFromItem(it);
    removeLoot(L);
    if (!ch.isPlayer && it.kind === 'weapon') ch.ammo[WEAPONS[it.id].ammo] += WEAPONS[it.id].mag * 2;
    ch.updateHeld();
    return true;
  }
  if (allowSwap && ch.slot) {
    const old = ch.slot;
    ch.slots[ch.active] = slotFromItem(it);
    removeLoot(L);
    dropAt(ch, itemFromSlot(old));
    ch.updateHeld();
    return true;
  }
  return false;
}

function updateLoot(dt) {
  const cp = camera.position;
  for (const L of G.loot) {
    const d2 = L.pos.distanceToSquared(cp);
    const near = d2 < 150 * 150;
    if (near && !L.mesh) buildLootMesh(L);
    if (L.mesh) L.mesh.visible = near;
    if (!near) { if (L.pop > 0) L.pop -= dt; continue; }
    L.bob += dt;
    L.model.rotation.y += dt * 1.2;
    L.model.position.y = 0.45 + Math.sin(L.bob * 2) * 0.08;
    if (L.pop > 0) { L.pop -= dt; L.mesh.position.y = L.pos.y + Math.sin((L.pop / 0.35) * Math.PI) * 0.8; }
    else L.mesh.position.y = L.pos.y;
  }
  // raccolta automatica di munizioni e materiali
  for (const c of G.chars) {
    if (!c.alive || c.mode !== 'ground' || c.remote) continue;
    for (let i = G.loot.length - 1; i >= 0; i--) {
      const L = G.loot[i];
      if (L.item.kind !== 'ammo' && L.item.kind !== 'mats') continue;
      if (L.pop > 0) continue;
      const dx = L.pos.x - c.pos.x, dz = L.pos.z - c.pos.z;
      if (dx * dx + dz * dz < 1.6 && Math.abs(L.pos.y - c.pos.y) < 1.5) {
        if (c.isPlayer) { dmgNumber(L.pos.clone().setY(L.pos.y + 1), '+' + L.item.count + ' ' + (L.item.kind === 'mats' ? '🪵' : AMMO_TYPES[L.item.id].short), 'shield'); A.playPickup(); }
        pickupLoot(c, L);
      }
    }
  }
}

// Forzieri
const chestMats = {
  base: new THREE.MeshStandardMaterial({ color: '#8a5a1a', roughness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ffae00', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.3 }),
};
function buildChestMesh() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.55, 0.65), chestMats.base);
  base.position.y = 0.28; base.castShadow = true; g.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.67), chestMats.gold);
  trim.position.y = 0.5; g.add(trim);
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.32);
  const lm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 0.65), chestMats.base);
  lm.position.set(0, 0.11, 0.32); lm.castShadow = true; lid.add(lm);
  const lt = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.67), chestMats.gold);
  lt.position.set(0, 0.22, 0.32); lid.add(lt);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.04), chestMats.gold);
  lock.position.set(0, 0.0, 0.66); lid.add(lock);
  g.add(lid);
  return { g, lid };
}
for (const cs of world.chestSpots) G.chests.push({ pos: cs.pos.clone(), rot: cs.rot, mesh: null, lid: null, opened: false, t: 0 });
function ensureChestMesh(c) {
  if (c.mesh) return;
  const { g, lid } = buildChestMesh();
  g.position.copy(c.pos);
  g.rotation.y = c.rot;
  scene.add(g);
  c.mesh = g; c.lid = lid;
  if (c.opened) lid.rotation.x = -1.9;
}
function openChest(ch, c) {
  if (c.opened) return;
  c.opened = true;
  if (ch && ch.isPlayer) { PR.track('chest', 1); G.matchStats.chests++; }
  if (G.net && ch) netSend({ t: 'chest', k: G.chests.indexOf(c) });
  if (!ch) { emit(c.pos.clone().setY(c.pos.y + 0.7), '#ffd24a', 20, 4, 0.8, 0.1, 0.4); if (c.pos.distanceTo(camera.position) < 40) A.playChest(); return; }
  const w = randomWeapon(1);
  const items = [w, ammoFor(w.id), randomCons(), { kind: 'mats', count: 30 }];
  items.forEach((it, i) => {
    const a = c.rot + (i - 1.5) * 0.6;
    const x = c.pos.x + Math.sin(a) * 1.3, z = c.pos.z + Math.cos(a) * 1.3;
    spawnLoot(it, new THREE.Vector3(x, groundAt(x, z, c.pos.y + 1), z), true);
  });
  emit(c.pos.clone().setY(c.pos.y + 0.7), '#ffd24a', 20, 4, 0.8, 0.1, 0.4);
  if (c.pos.distanceTo(camera.position) < 40) A.playChest();
}
function updateChests(dt) {
  const cp = camera.position;
  for (const c of G.chests) {
    const near = c.pos.distanceToSquared(cp) < 160 * 160;
    if (near) ensureChestMesh(c);
    if (c.mesh) c.mesh.visible = near;
    if (!near) continue;
    if (c.opened) { c.lid.rotation.x = lerp(c.lid.rotation.x, -1.9, Math.min(1, dt * 6)); continue; }
    c.lid.rotation.x = 0;
    c.t -= dt;
    if (c.t <= 0 && c.pos.distanceToSquared(camera.position) < 30 * 30) {
      c.t = 0.25;
      emit(_p.copy(c.pos).add(new THREE.Vector3(rand(-0.5, 0.5), 0.9, rand(-0.4, 0.4))), '#ffe680', 1, 0.6, 0.9, 0.06, -0.15);
    }
  }
}

// ─────────────── Tempesta ───────────────
const stormMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  uniforms: { time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float time; varying vec2 vUv;
    void main(){
      float s = sin(vUv.x * 600.0 + time * 1.5 + sin(vUv.y * 30.0 + time) * 3.0) * 0.5 + 0.5;
      float s2 = sin(vUv.x * 230.0 - time * 0.8 + vUv.y * 50.0) * 0.5 + 0.5;
      float a = 0.2 + 0.16 * s * s2;
      a *= smoothstep(0.85, 0.2, vUv.y);
      gl_FragColor = vec4(mix(vec3(0.45,0.15,0.85), vec3(0.85,0.5,1.0), s * 0.5), a);
    }`,
});
const stormWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 260, 128, 1, true), stormMat);
stormWall.position.y = 90;
stormWall.renderOrder = 2;
scene.add(stormWall);

function newStorm() {
  const s = { phase: 0, state: 'wait', timer: STORM_PHASES[0].wait, cx: 0, cz: 0, r: 300 * SCALE, dps: 1, fx: 0, fz: 0, fr: 300 * SCALE, tx: 0, tz: 0, tr: 150 * SCALE, tick: 0 };
  pickNextCircle(s);
  return s;
}
function pickNextCircle(s) {
  const ph = STORM_PHASES[s.phase];
  s.tr = ph.radius;
  const maxOff = Math.max(0, Math.min(s.r, 190 * SCALE) - ph.radius) * 0.8;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * maxOff;
    const x = s.cx + Math.cos(a) * d, z = s.cz + Math.sin(a) * d;
    if (Math.abs(x) < HALF - 30 && Math.abs(z) < HALF - 30 && terrainHeight(x, z) > WATER_LEVEL) { s.tx = x; s.tz = z; return; }
  }
  s.tx = s.cx; s.tz = s.cz;
}
function updateStorm(dt) {
  const s = G.storm;
  if (s.state !== 'done') {
    s.timer -= dt;
    if (s.state === 'wait' && s.timer <= 0) {
      s.state = 'shrink'; s.timer = STORM_PHASES[s.phase].shrink;
      s.fx = s.cx; s.fz = s.cz; s.fr = s.r;
      s.dps = STORM_PHASES[s.phase].dps;
      if (G.player.alive) showMsg('LA TEMPESTA SI RESTRINGE!', 'Raggiungi la zona sicura', 3);
    } else if (s.state === 'shrink') {
      const ph = STORM_PHASES[s.phase];
      const k = clamp(1 - s.timer / ph.shrink, 0, 1);
      s.cx = lerp(s.fx, s.tx, k); s.cz = lerp(s.fz, s.tz, k); s.r = lerp(s.fr, s.tr, k);
      if (s.timer <= 0) {
        s.phase++;
        if (s.phase >= STORM_PHASES.length) { s.state = 'done'; }
        else { s.state = 'wait'; s.timer = STORM_PHASES[s.phase].wait; pickNextCircle(s); }
      }
    }
  }
  stormWall.position.x = s.cx; stormWall.position.z = s.cz;
  const r = Math.max(0.5, s.r);
  stormWall.scale.set(r, 1, r);
  stormMat.uniforms.time.value = G.time;
  s.tick -= dt;
  if (s.tick <= 0) {
    s.tick = 1;
    for (const c of G.chars) {
      if (!c.alive || c.mode === 'bus') continue;
      if (Math.hypot(c.pos.x - s.cx, c.pos.z - s.cz) > s.r) damage(c, s.dps, null, false, 'storm', true);
    }
  }
  if (G.player) {
    const out = G.player.alive && G.player.mode !== 'bus' && Math.hypot(G.player.pos.x - s.cx, G.player.pos.z - s.cz) > s.r;
    $('#stormTint').style.opacity = out ? 1 : 0;
    const dEdge = Math.abs(Math.hypot(camera.position.x - s.cx, camera.position.z - s.cz) - s.r);
    A.setStormSound(out ? 1 : clamp(1 - dEdge / 40, 0, 0.6));
  }
}
function safeTarget() {
  const s = G.storm;
  if (s.state === 'done') return { x: s.cx, z: s.cz, r: Math.max(s.r, 1) };
  return { x: s.tx, z: s.tz, r: s.tr };
}

// ─────────────── Battle bus ───────────────
let busMesh = null;
function newBus(ang = Math.random() * Math.PI * 2, off = rand(-50, 50) * SCALE) {
  const nx = -Math.sin(ang), nz = Math.cos(ang);
  const R = 235 * SCALE, Y = 200;
  const a = new THREE.Vector3(Math.cos(ang) * R + nx * off, Y, Math.sin(ang) * R + nz * off);
  const b = new THREE.Vector3(-Math.cos(ang) * R + nx * off, Y, -Math.sin(ang) * R + nz * off);
  if (!busMesh) { busMesh = buildBus(); scene.add(busMesh); }
  busMesh.visible = true;
  busMesh.position.copy(a);
  busMesh.lookAt(b);
  return { a, b, t: 0, dur: a.distanceTo(b) / 62, pos: a.clone() };
}
function jumpFromBus(ch) {
  ch.mode = 'fall';
  ch.pos.copy(G.bus.pos).add(new THREE.Vector3(rand(-1, 1), -4, rand(-1, 1)));
  ch.pos.x = clamp(ch.pos.x, -HALF + 6, HALF - 6);
  ch.pos.z = clamp(ch.pos.z, -HALF + 6, HALF - 6);
  ch.vel.set(0, -5, 0);
  ch.m.root.visible = true;
  if (ch.isPlayer) {
    G.state = 'play';
    showMsg('', 'Premi SPAZIO per aprire il deltaplano prima', 3);
    A.playUI();
  }
}
function updateBus(dt) {
  const B = G.bus;
  if (!B) return;
  B.t += dt;
  const k = B.t / B.dur;
  B.pos.lerpVectors(B.a, B.b, Math.min(k, 1.3));
  busMesh.position.copy(B.pos);
  busMesh.position.y += Math.sin(G.time * 1.5) * 0.6;
  if (k > 0.93) for (const c of G.chars) if (c.alive && c.mode === 'bus') jumpFromBus(c);
  if (k > 1.3) busMesh.visible = false;
  for (const c of G.chars) if (c.mode === 'bus') c.pos.copy(B.pos);
}

// ─────────────── Intelligenza artificiale dei bot ───────────────
const WEAPON_VALUE = { pistol: 1, smg: 2, shotgun: 2.4, ar: 2.7, sniper: 2.3, rocket: 2.4 };
function weaponScore(s, dist) {
  if (!s || s.kind !== 'weapon') return -1;
  const id = s.id;
  let v;
  switch (id) {
    case 'shotgun': v = dist < 10 ? 5 : dist < 18 ? 2.5 : 0.3; break;
    case 'smg': v = dist < 20 ? 4 : dist < 40 ? 2.5 : 0.8; break;
    case 'ar': v = dist < 8 ? 2.5 : dist < 80 ? 4 : 2.5; break;
    case 'sniper': v = dist < 25 ? 0.8 : dist < 60 ? 2.5 : 5; break;
    case 'rocket': v = dist < 8 ? 0.2 : dist < 60 ? 4.2 : 2; break;
    default: v = dist < 40 ? 2 : 1;
  }
  return v * RARITIES[s.rarity].mult;
}
function hasAmmoFor(ch, s) { return s.mag > 0 || ch.ammo[WEAPONS[s.id].ammo] > 0; }

function makeAI() {
  return {
    state: 'idle', target: null, lastSeen: -99, lastSeenPos: new THREE.Vector3(), seenT: 0,
    goal: null, goalLoot: null, goalChest: null, think: Math.random() * 0.3,
    strafe: 1, strafeT: 0, avoidT: 0, avoidSign: 1, stuckT: 0.5, lastPos: new THREE.Vector3(),
    burst: 0, pauseT: 0, jumpT: 0, bad: new Set(), dropTarget: new THREE.Vector3(), wantJump: false, alert: 0, healCd: 0,
  };
}

/** erba alta: un personaggio accovacciato dentro si vede solo da vicino (o se ha appena sparato) */
function hideRange(c) { return G.time - (c.lastShotT ?? -99) < 1.5 ? 25 : 10; }
function dist0(a, b) { return a.pos.distanceTo(b.pos); }
function botThink(b) {
  const ai = b.ai;
  // scegli il bersaglio
  let tgt = ai.target && ai.target.alive && ai.target.mode !== 'bus' ? ai.target : null;
  if (tgt && tgt.pos.distanceTo(b.pos) > 130) tgt = null;
  if (!tgt || Math.random() < 0.15) {
    let best = null, bd = Infinity;
    const range = b.slots.some(s => s && s.id === 'sniper') ? 110 : 75;
    for (const c of G.chars) {
      if (c === b || !c.alive || c.mode === 'bus' || c.mode === 'fall') continue;
      const d = c.pos.distanceTo(b.pos);
      if (d > (c.human ? range : range * 0.45) || d >= bd) continue;
      if (c.hidden && d > hideRange(c)) continue;
      const ang = Math.abs(angDiff(b.yaw, Math.atan2(c.pos.x - b.pos.x, c.pos.z - b.pos.z)));
      if (ang > 1.9 && d > 12 && ai.alert <= 0) continue;
      if (!hasLOS(b, c)) continue;
      best = c; bd = d;
    }
    if (best) tgt = best;
  }
  let los = false;
  if (tgt) {
    los = hasLOS(b, tgt) && !(tgt.hidden && dist0(b, tgt) > hideRange(tgt));
    if (los) {
      if (ai.target !== tgt) ai.seenT = 0;
      ai.target = tgt; ai.lastSeen = G.time; ai.lastSeenPos.copy(tgt.pos);
    } else if (G.time - ai.lastSeen > 5) { ai.target = null; tgt = null; }
  }
  ai.target = tgt;
  const hasWeapon = b.slots.some(s => s && s.kind === 'weapon' && hasAmmoFor(b, s));
  // scelta arma
  const dist = tgt ? tgt.pos.distanceTo(b.pos) : 30;
  if (!b.using && b.reloading <= 0) {
    let bi = -1, bs = -1;
    b.slots.forEach((s, i) => { if (s && s.kind === 'weapon' && hasAmmoFor(b, s)) { const sc = weaponScore(s, dist); if (sc > bs) { bs = sc; bi = i; } } });
    if (bi >= 0 && bi !== b.active && (!tgt || Math.random() < 0.5)) b.setActive(bi);
    if (bi < 0 && b.slot && b.slot.kind === 'weapon') b.setActive(b.slots.indexOf(null) >= 0 ? b.slots.indexOf(null) : b.active);
  }
  const s = G.storm;
  const st = safeTarget();
  const dZone = Math.hypot(b.pos.x - st.x, b.pos.z - st.z);
  const inStormNow = Math.hypot(b.pos.x - s.cx, b.pos.z - s.cz) > s.r - 3;

  if (tgt && los && hasWeapon && !inStormNow) { ai.state = 'fight'; ai.goal = null; ai.goalLoot = ai.goalChest = null; return; }
  if (tgt && los && !hasWeapon) {
    // fuggi e cerca armi
    ai.state = 'flee';
  }
  if (tgt && !los && hasWeapon && !inStormNow) { ai.state = 'chase'; ai.goalLoot = ai.goalChest = null; ai.goal = ai.lastSeenPos.clone(); return; }

  // cura
  ai.healCd -= 0.3;
  if (!tgt && ai.healCd <= 0 && !inStormNow && (b.hp < 75 || b.shield < 50)) {
    const i = b.slots.findIndex(sl => sl && sl.kind === 'cons' && canUse(b, sl.id));
    if (i >= 0) { b.setActive(i); startUse(b); ai.state = 'heal'; ai.goal = null; ai.healCd = 2; return; }
  }
  if (b.using) return;

  // tempesta
  // vai verso la zona solo quando serve (tempo necessario + margine)
  const needT = Math.max(0, dZone - st.r * 0.7) / 6.5;
  const urgent = inStormNow || s.state === 'done' || (s.state === 'shrink' ? dZone > st.r * 0.85 : (dZone > st.r * 0.85 && s.timer < needT + 15));
  if (urgent || (ai.state === 'zone' && ai.goal && dZone > st.r * 0.6)) {
    if (ai.state !== 'zone' || !ai.goal) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * st.r * 0.5;
      ai.goal = new THREE.Vector3(st.x + Math.cos(a) * rr, 0, st.z + Math.sin(a) * rr);
      ai.goalLoot = ai.goalChest = null;
    }
    ai.state = 'zone';
    return;
  }
  // bottino
  if (ai.state === 'chest' && ai.goalChest && !ai.goalChest.opened) return;
  if (ai.state !== 'loot' || !ai.goalLoot || !G.loot.includes(ai.goalLoot)) {
    let bestL = null, bsc = -Infinity;
    for (const L of G.loot) {
      const d = Math.hypot(L.pos.x - b.pos.x, L.pos.z - b.pos.z);
      if (d > 40 || ai.bad.has(L)) continue;
      const w = botWants(b, L.item);
      if (w <= 0) continue;
      const sc = w * 12 - d;
      if (sc > bsc) { bsc = sc; bestL = L; }
    }
    let bestC = null, bcd = 35;
    for (const c of G.chests) {
      if (c.opened || ai.bad.has(c)) continue;
      const d = c.pos.distanceTo(b.pos);
      if (d < bcd) { bcd = d; bestC = c; }
    }
    if (bestC && (!bestL || bcd < 15)) { ai.state = 'chest'; ai.goalChest = bestC; ai.goal = bestC.pos.clone(); return; }
    if (bestL) { ai.state = 'loot'; ai.goalLoot = bestL; ai.goal = bestL.pos.clone(); return; }
  } else return;
  // vagabonda
  if (!ai.goal || ai.state !== 'wander') {
    const a = Math.random() * Math.PI * 2, rr = rand(10, 40);
    let gx = b.pos.x + Math.cos(a) * rr, gz = b.pos.z + Math.sin(a) * rr;
    if (Math.hypot(gx - st.x, gz - st.z) > st.r * 0.8) { gx = lerp(gx, st.x, 0.5); gz = lerp(gz, st.z, 0.5); }
    ai.goal = new THREE.Vector3(clamp(gx, -HALF + 10, HALF - 10), 0, clamp(gz, -HALF + 10, HALF - 10));
    ai.goalLoot = ai.goalChest = null;
    ai.state = 'wander';
  }
}

function botWants(b, it) {
  if (it.kind === 'ammo') return b.slots.some(s => s && s.kind === 'weapon' && WEAPONS[s.id].ammo === it.id) ? 0.8 : 0.1;
  if (it.kind === 'mats') return 0.1;
  const empty = b.slots.includes(null);
  if (it.kind === 'cons') {
    const st = b.slots.some(s => s && s.kind === 'cons' && s.id === it.id && s.count < CONSUMABLES[it.id].stack);
    return (empty || st) ? 1.5 : 0;
  }
  const weapons = b.slots.filter(s => s && s.kind === 'weapon');
  const v = WEAPON_VALUE[it.id] * RARITIES[it.rarity].mult;
  if (weapons.length === 0) return 5;
  if (empty && weapons.length < 3) return 2 + v * 0.5;
  let worst = Infinity;
  for (const s of weapons) worst = Math.min(worst, WEAPON_VALUE[s.id] * RARITIES[s.rarity].mult);
  return v > worst * 1.15 ? 1.5 : 0;
}

function botTryPickup(b) {
  for (const L of [...G.loot]) {
    if (L.pop > 0) continue;
    const dx = L.pos.x - b.pos.x, dz = L.pos.z - b.pos.z;
    if (dx * dx + dz * dz > 3.2 || Math.abs(L.pos.y - b.pos.y) > 1.6) continue;
    const it = L.item;
    if (it.kind === 'ammo' || it.kind === 'mats') continue;
    if (botWants(b, it) <= 0) continue;
    if (!pickupLoot(b, L, false) && it.kind === 'weapon') {
      // sostituisci l'arma peggiore
      let wi = -1, wv = Infinity;
      b.slots.forEach((s, i) => { if (s && s.kind === 'weapon') { const v = WEAPON_VALUE[s.id] * RARITIES[s.rarity].mult; if (v < wv) { wv = v; wi = i; } } });
      if (wi >= 0) {
        const old = b.slots[wi];
        b.slots[wi] = slotFromItem(it);
        b.ammo[WEAPONS[it.id].ammo] += WEAPONS[it.id].mag * 2;
        removeLoot(L);
        dropAt(b, itemFromSlot(old));
        b.updateHeld();
      }
    }
  }
}

const _bd = new THREE.Vector3();
const _nav = new THREE.Vector3();
function houseAt(x, z, y) {
  for (const h of world.houses) {
    if (Math.abs(x - h.cx) < h.w / 2 - 0.15 && Math.abs(z - h.cz) < h.d / 2 - 0.15 && (y === undefined || y < h.roofTop - 0.5)) return h;
  }
  return null;
}
// Navigazione semplice: passa dalle porte per entrare/uscire dalle case
function navPoint(b, goal) {
  // sul tetto? scendi dal bordo più vicino
  for (const h of world.houses) {
    if (b.pos.y > h.roofTop - 0.6 && Math.abs(b.pos.x - h.cx) < h.w / 2 + 0.4 && Math.abs(b.pos.z - h.cz) < h.d / 2 + 0.4) {
      const ex = h.w / 2 - Math.abs(b.pos.x - h.cx), ez = h.d / 2 - Math.abs(b.pos.z - h.cz);
      if (ex < ez) return _nav.set(h.cx + Math.sign(b.pos.x - h.cx || 1) * (h.w / 2 + 2), 0, b.pos.z);
      return _nav.set(b.pos.x, 0, h.cz + Math.sign(b.pos.z - h.cz || 1) * (h.d / 2 + 2));
    }
  }
  const hb = houseAt(b.pos.x, b.pos.z, b.pos.y), hg = houseAt(goal.x, goal.z);
  if (hb === hg) return goal;
  const h = hb || hg;
  if (!h.doors.length) return goal;
  const ref = hb ? goal : b.pos;
  let door = h.doors[0], bd = Infinity;
  for (const d of h.doors) { const dd = Math.hypot(d.x - ref.x, d.z - ref.z); if (dd < bd) { bd = dd; door = d; } }
  const rx = b.pos.x - door.x, rz = b.pos.z - door.z;
  const sN = rx * door.nx + rz * door.nz;            // >0 fuori
  const lat = Math.abs(rx * -door.nz + rz * door.nx); // distanza laterale dalla porta
  if (hb) return lat < 0.7 && sN > -1.6 ? _nav.set(door.x + door.nx * 2.5, 0, door.z + door.nz * 2.5) : _nav.set(door.x - door.nx * 1.3, 0, door.z - door.nz * 1.3);
  return lat < 0.7 && sN < 2.8 ? _nav.set(door.x - door.nx * 1.5, 0, door.z - door.nz * 1.5) : _nav.set(door.x + door.nx * 2.2, 0, door.z + door.nz * 2.2);
}
function updateBot(b, dt) {
  const ai = b.ai;
  if (!b.alive) return;
  if (b.mode === 'bus') { if (G.bus.t >= ai.jumpT) jumpFromBus(b); return; }
  if (b.mode === 'fall' || b.mode === 'glide') {
    const dx = ai.dropTarget.x - b.pos.x, dz = ai.dropTarget.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    const mx = d > 2 ? dx / d : 0, mz = d > 2 ? dz / d : 0;
    if (d > 1) b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), dt * 3);
    airMove(b, mx * Math.min(1, d / 10), mz * Math.min(1, d / 10), dt, d < 25);
    return;
  }
  if (b.mode === 'climb') { updateClimb(b, dt, true, false, false); return; }
  ai.alert -= dt;
  ai.think -= dt;
  const gkey = ai.goalLoot || ai.goalChest || ai.goal;
  if (gkey !== ai._g) { ai._g = gkey; ai.goalT = 0; }
  ai.goalT = (ai.goalT || 0) + dt;
  if (ai.goal && ai.goalT > 20 && ai.state !== 'zone') { ai.goalT = 0; ai.bad.add(ai.goalLoot); ai.bad.add(ai.goalChest); ai.goal = null; ai.goalLoot = null; ai.goalChest = null; ai.state = 'idle'; }
  if (ai.think <= 0) { ai.think = 0.25 + Math.random() * 0.15; botThink(b); botTryPickup(b); }

  let mx = 0, mz = 0, speed = 5.2, jump = false;
  const tgt = ai.target;
  if (b.using) {
    speed = 0;
    if (tgt && G.time - ai.lastSeen < 0.5) b.using = null;
  } else if (ai.state === 'fight' && tgt && tgt.alive) {
    const dx = tgt.pos.x - b.pos.x, dz = tgt.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz);
    const dy = (tgt.pos.y + 1.3) - (b.pos.y + 1.5);
    b.yaw = angLerp(b.yaw, wantYaw, dt * 7);
    b.pitch = lerp(b.pitch, Math.atan2(dy, dist), Math.min(1, dt * 7));
    ai.seenT += dt;
    const w = b.weapon;
    const pref = w ? ({ shotgun: 5, smg: 12, ar: 25, sniper: 55, rocket: 25, pistol: 15 })[w.id] : 2;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    const rx = -Math.cos(b.yaw), rz = Math.sin(b.yaw);
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) {
      ai.strafeT = rand(0.5, 1.6); ai.strafe = pick([-1, 1, 1, -1, 0]);
      b.crouch = ai.strafe === 0 && Math.random() < 0.7;   // si abbassa quando sta fermo a sparare
      if (!b.crouch && Math.random() < 0.25) jump = true;
    }
    const fwd = dist > pref * 1.25 ? 1 : dist < pref * 0.6 ? -0.7 : 0;
    mx = fx * fwd + rx * ai.strafe; mz = fz * fwd + rz * ai.strafe;
    const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l; }
    speed = 4.6;
    // fuoco
    if (w && ai.seenT > G.diff.reaction && Math.abs(angDiff(b.yaw, wantYaw)) < 0.25) {
      const def = WEAPONS[w.id];
      if (ai.pauseT > 0) ai.pauseT -= dt;
      else if (dist < def.range * 0.9 && G.time - ai.lastSeen < 0.6) {
        const origin = b.chest();
        const aimY = tgt.pos.y + (Math.random() < 0.15 ? 1.75 : 1.2);
        // il proiettile impiega tempo ad arrivare: il bot mira dove sarà il bersaglio e un po' più in alto
        const d3 = Math.hypot(tgt.pos.x - origin.x, aimY - origin.y, tgt.pos.z - origin.z);
        const tFly = d3 / (def.speed || 300);
        const lead = G.diff.lead * rand(0.7, 1.15);
        const comp = 0.5 * BULLET_G * (def.drop ?? 1) * tFly * tFly * G.diff.lead * rand(0.85, 1.1);
        const dir = new THREE.Vector3(tgt.pos.x + tgt.vel.x * tFly * lead, aimY + tgt.vel.y * tFly * lead * 0.4 + comp, tgt.pos.z + tgt.vel.z * tFly * lead).sub(origin).normalize();
        const err = G.diff.aimError * (1 + tgt.moveAmt * 0.07) * (b.moveAmt > 1 ? 1.25 : 1) + def.spread * 0.6;
        if (fireWeapon(b, () => ({ origin, dir: spreadDir(dir, err), max: def.range }))) {
          if (!def.auto) ai.pauseT = rand(0.1, 0.5);
          else if (++ai.burst > rand(4, 9)) { ai.burst = 0; ai.pauseT = rand(0.3, 0.8); }
        }
      }
    } else if (!w && dist < 2.5) {
      melee(b);
    }
  } else {
    let goal = ai.goal;
    if (ai.state === 'flee' && tgt) goal = _bd.set(b.pos.x * 2 - tgt.pos.x, 0, b.pos.z * 2 - tgt.pos.z);
    if (goal) {
      const gd = Math.hypot(goal.x - b.pos.x, goal.z - b.pos.z);
      const np = ai.state === 'flee' ? goal : navPoint(b, goal);
      const dx = np.x - b.pos.x, dz = np.z - b.pos.z;
      const d = Math.max(Math.hypot(dx, dz), 0.001);
      const gy = ai.goalLoot ? ai.goalLoot.pos.y : (ai.goalChest ? ai.goalChest.pos.y : b.pos.y);
      if (gd < 1.2 && Math.abs(gy - b.pos.y) > 1.6) { ai.bad.add(ai.goalLoot); ai.bad.add(ai.goalChest); ai.goal = null; ai.goalLoot = null; ai.goalChest = null; ai.state = 'idle'; }
      else if (gd < 1.2) {
        if (ai.state === 'chest' && ai.goalChest) openChest(b, ai.goalChest);
        if (ai.state === 'loot') botTryPickup(b);
        ai.goal = null; ai.goalLoot = null; ai.goalChest = null;
        if (ai.state !== 'zone') ai.state = 'idle';
      } else {
        mx = dx / d; mz = dz / d;
        speed = d > 25 || ai.state === 'zone' || ai.state === 'flee' ? 7 : 5.2;
        b.yaw = angLerp(b.yaw, Math.atan2(mx, mz), dt * 6);
        b.pitch = lerp(b.pitch, 0, dt * 3);
      }
    }
  }
  // aggira gli ostacoli
  if (ai.avoidT > 0) {
    ai.avoidT -= dt;
    const c = Math.cos(ai.avoidSign * 1.3), s = Math.sin(ai.avoidSign * 1.3);
    const nx = mx * c - mz * s, nz = mx * s + mz * c;
    mx = nx; mz = nz;
  }
  if (ai.state !== 'fight') b.crouch = false;
  if (b.crouch) speed = Math.min(speed, 2.8);
  if (b.inWater) { speed *= 0.6; b.crouch = false; }
  if (ai.wantJump) { jump = true; ai.wantJump = false; }
  groundMove(b, mx, mz, speed, dt, jump);
  ai.stuckT -= dt;
  if (ai.stuckT <= 0) {
    const moved = Math.hypot(b.pos.x - ai.lastPos.x, b.pos.z - ai.lastPos.z);
    if ((mx || mz) && speed > 0 && moved < speed * 0.5 * 0.25) {
      ai.avoidT = rand(0.6, 1.2); ai.avoidSign = Math.random() < 0.5 ? -1 : 1; ai.wantJump = true;
      // ostacolo basso davanti (casse, container, muri costruiti)? arrampicati
      const md = new THREE.Vector3(mx, 0, mz).normalize();
      const ch = canStartClimb(b, md);
      if (ch && ch.collider.maxY - b.pos.y < 3.7 && Math.random() < 0.7) { startClimb(b, ch, md); ai.avoidT = 0; ai.lastPos.copy(b.pos); ai.stuckT = 0.5; return; }
      // muro costruito davanti? sparagli
      const o = b.chest(), d = new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
      const h = rayWorld(o, d, 2.5);
      if (h && h.collider && h.collider.built) {
        if (b.weapon) fireWeapon(b, () => ({ origin: o, dir: d, max: 5 })); else melee(b);
      }
    }
    ai.lastPos.copy(b.pos);
    ai.stuckT = 0.5;
  }
}

// ─────────────── Input ───────────────
const keys = {};
const pressed = new Set();
const mouse = { left: false, right: false, leftPressed: false };
let pointerLocked = false;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (!keys[e.code]) pressed.add(e.code);
  keys[e.code] = true;
  if (['Space', 'Tab'].includes(e.code) && G.state !== 'menu') e.preventDefault();
  if (e.code === 'Escape' && (G.state === 'play' || G.state === 'bus') && !pointerLocked) togglePause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });
canvas.addEventListener('mousedown', e => {
  A.initAudio();
  if (G.state === 'play' || G.state === 'bus') {
    if (!pointerLocked && !G.paused) requestLock();
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
  }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (G.state === 'menu') { if (lobby.drag) lobby.rotV += e.movementX * 0.01; return; }
  if (G.paused || G.state === 'end') return;
  if (!pointerLocked && !(e.buttons & 1) && !(e.buttons & 2)) { if (!lockFailed) return; }
  // Chrome a volte invia salti enormi subito dopo il pointer lock: ignorali
  if (performance.now() - lockTime < 120 || Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
  const zoomK = G.ads ? 1 / currentZoom() : 1;
  const s = 0.0022 * settings.sens * zoomK;
  G.camYaw -= e.movementX * s;
  G.camPitch = clamp(G.camPitch - e.movementY * s, -1.35, 1.35);
});
addEventListener('wheel', e => {
  if (G.state !== 'play' || !G.player || !G.player.alive) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  G.player.setActive((G.player.active + dir + SLOT_COUNT) % SLOT_COUNT);
}, { passive: true });

let lockFailed = false;
let lockTime = 0;
function requestLock() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { lockFailed = true; });
  } catch { lockFailed = true; }
}
document.addEventListener('pointerlockchange', () => {
  const was = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) lockTime = performance.now();
  if (was && !pointerLocked && (G.state === 'play' || G.state === 'bus') && !G.paused) togglePause(true);
});
document.addEventListener('pointerlockerror', () => { lockFailed = true; });

// ─────────────── Schermo intero ───────────────
const inFrame = (() => { try { return window.top !== window.self; } catch { return true; } })();
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function toggleFullscreen(force) {
  const want = force !== undefined ? force : !isFullscreen();
  try {
    if (want && !isFullscreen()) {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn) return fsFailed();
      const r = fn.call(el, { navigationUI: 'hide' });
      if (r && r.catch) r.catch(fsFailed);
    } else if (!want && isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
  } catch { fsFailed(); }
}
function fsFailed() {
  // dentro un riquadro (anteprima) il browser può vietarlo: proponi la nuova scheda
  $('#newTab').classList.remove('hidden');
  if (G.state === 'menu') $('#newTab').animate([{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 400 });
}
function updateFsUi() {
  const t = isFullscreen() ? '🗗 Esci da schermo intero' : '⛶ Schermo intero';
  $('#fsBtn').textContent = t; $('#fsPauseBtn').textContent = t;
}
document.addEventListener('fullscreenchange', updateFsUi);
document.addEventListener('webkitfullscreenchange', updateFsUi);
if (inFrame) $('#newTab').classList.remove('hidden');
$('#fsBtn').onclick = () => toggleFullscreen();
$('#fsPauseBtn').onclick = e => { e.stopPropagation(); toggleFullscreen(); };
$('#fsAuto').checked = settings.fs !== false;
$('#fsAuto').onchange = e => { settings.fs = e.target.checked; saveSettings(); };
addEventListener('keydown', e => {
  if (e.code === 'KeyF' && e.target.tagName !== 'INPUT' && !e.repeat) toggleFullscreen();
});

function togglePause(force) {
  G.paused = force !== undefined ? force : !G.paused;
  $('#pause').classList.toggle('hidden', !G.paused);
  mouse.left = mouse.right = false;
}
$('#resumeBtn').onclick = e => { e.stopPropagation(); togglePause(false); requestLock(); };
$('#pause').addEventListener('click', e => { if (e.target.id === 'pause' || e.target.tagName === 'P' || e.target.tagName === 'H2') { togglePause(false); requestLock(); } });
$('#quitBtn').onclick = () => { togglePause(false); toMenu(); };
$('#sens').value = settings.sens;
$('#vol').value = settings.vol;
$('#sens').oninput = e => { settings.sens = +e.target.value; saveSettings(); };
$('#vol').oninput = e => { settings.vol = +e.target.value; A.setVolume(settings.vol); saveSettings(); };

function currentZoom() {
  const w = G.player && G.player.weapon;
  return w ? WEAPONS[w.id].zoom : 1.2;
}

// ─────────────── Giocatore ───────────────
function currentSpread(p) {
  const w = p.weapon;
  if (!w) return 0;
  const def = WEAPONS[w.id];
  let s = def.spread;
  if (G.ads) s = def.adsSpread !== undefined ? def.adsSpread : s * 0.45;
  if (p.moveAmt > 1) s *= 1.4;
  if (!p.onGround) s *= 2;
  if (p.crouchK > 0.5) s *= 0.65;   // accovacciato = più preciso
  return s + p.bloom;
}

function nearestInteract(p) {
  let best = null, bs = Infinity;
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  for (const L of G.loot) {
    if (L.item.kind === 'ammo' || L.item.kind === 'mats') continue;
    const dx = L.pos.x - p.pos.x, dz = L.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.5 || Math.abs(L.pos.y - p.pos.y) > 1.8) continue;
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    const sc = d - facing * 1.2;
    if (sc < bs) { bs = sc; best = { loot: L }; }
  }
  for (const c of G.chests) {
    if (c.opened) continue;
    const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z);
    if (d < 2.6 && Math.abs(c.pos.y - p.pos.y) < 1.8 && d - 1 < bs) { bs = d - 1; best = { chest: c }; }
  }
  return best;
}

function updatePlayer(dt) {
  const p = G.player;
  if (!p.alive) return;
  p.yaw = G.camYaw;
  p.pitch = G.camPitch;
  if (p.mode === 'bus') {
    if (pressed.has('Space')) jumpFromBus(p);
    return;
  }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
  if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
  if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
  if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
  const l = Math.hypot(mx, mz);
  if (l > 0) { mx /= l; mz /= l; }
  if (p.mode === 'fall' || p.mode === 'glide') {
    airMove(p, mx, mz, dt, pressed.has('Space'));
    G.ads = false;
    return;
  }
  const fwdHeld = keys.KeyW || keys.ArrowUp;
  const backHeld = keys.KeyS || keys.ArrowDown;
  if (p.mode === 'climb') {
    G.ads = false; G.interact = null; ghost.visible = false;
    updateClimb(p, dt, fwdHeld, backHeld, pressed.has('Space'));
    return;
  }
  // arrampicata: SPAZIO contro un muro, oppure salta verso un muro tenendo W
  _v.set(fx, 0, fz);
  G.climbHint = null;
  if (fwdHeld && !G.build.on) {
    const hit = canStartClimb(p, _v);
    if (hit && (pressed.has('Space') || (!p.onGround && p.vel.y < 4))) { startClimb(p, hit, _v); return; }
    G.climbHint = hit;
  }
  // abbassarsi
  if (pressed.has('KeyC')) { p.crouch = !p.crouch; if (p.crouch) A.playStep(); }
  let stoodUp = false;
  if (p.crouch && (pressed.has('Space') || (keys.ShiftLeft || keys.ShiftRight))) { p.crouch = false; stoodUp = pressed.has('Space'); }
  // slot
  for (let i = 0; i < SLOT_COUNT; i++) if (pressed.has('Digit' + (i + 1))) { p.setActive(i); if (G.build.on) toggleBuild(false); }
  if (pressed.has('KeyQ')) toggleBuild();
  if (pressed.has('KeyB')) { const i = ((p._emoteIdx ?? -1) + 1) % EMOTES.length; p._emoteIdx = i; startEmote(p, EMOTES[i].id); }
  for (let i = 0; i < EMOTES.length; i++) if (pressed.has('Digit' + (6 + i))) startEmote(p, EMOTES[i].id);
  if (pressed.has('KeyR')) startReload(p);
  if (pressed.has('KeyG') && p.slot) { dropAt(p, itemFromSlot(p.slot)); p.slots[p.active] = null; p.using = null; p.reloading = 0; p.updateHeld(); }
  const inter = nearestInteract(p);
  if (pressed.has('KeyE') && inter) {
    if (inter.loot) { if (pickupLoot(p, inter.loot, true)) A.playPickup(); }
    else if (inter.chest) openChest(p, inter.chest);
  }
  G.interact = inter;
  G.ads = mouse.right && !G.build.on && !!p.weapon && p.reloading <= 0;
  const sprint = (keys.ShiftLeft || keys.ShiftRight) && !G.ads && !mouse.left && mz * fz + mx * fx > 0.3;
  let speed = sprint ? 7.6 : 5.3;
  if (p.crouch) speed = 2.8;
  if (G.ads) speed = Math.min(speed, 3.4);
  if (p.using) speed = Math.min(speed, 2.6);
  if (p.inWater) { speed *= 0.6; p.crouch = false; }
  if (stoodUp) p._noJumpUntilRelease = true;
  if (!keys.Space) p._noJumpUntilRelease = false;
  groundMove(p, mx, mz, speed, dt, keys.Space && !p._noJumpUntilRelease && !p.crouch);
  // azioni
  p.bloom = Math.max(0, p.bloom - dt * 0.12);
  if (G.build.on) {
    const s = buildSpot(p);
    ghost.visible = true;
    ghost.position.set(s.x, s.g + 1.7, s.z);
    ghost.rotation.y = s.alongX ? 0 : Math.PI / 2;
    ghostMat.color.set(p.mats >= 10 ? '#4aa0ff' : '#ff4a4a');
    if (mouse.leftPressed || (mouse.left && (p._bt = (p._bt || 0) - dt) <= 0)) { placeWall(p); p._bt = 0.25; }
  } else {
    ghost.visible = false;
    const s = p.slot;
    if (!s) { if (mouse.left) melee(p); }
    else if (s.kind === 'cons') { if (mouse.leftPressed) startUse(p); }
    else {
      const def = WEAPONS[s.id];
      if ((def.auto && mouse.left) || mouse.leftPressed) playerFire(p, def);
    }
  }
}

function playerFire(p, def) {
  const spread = currentSpread(p);
  const camPos = camera.position.clone();
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const fired = fireWeapon(p, () => {
    const dir = spreadDir(camDir, spread);
    const hit = rayAll(camPos, dir, def.range + 8, p);
    const target = camPos.clone().addScaledVector(dir, hit ? hit.t : def.range);
    const origin = p.chest();
    origin.y += 0.15;
    const d = target.sub(origin);
    const len = d.length();
    return { origin, dir: d.divideScalar(len), max: len + 0.5 };
  });
  if (fired) {
    G.camPitch = clamp(G.camPitch + def.recoil * (G.ads ? 0.6 : 1), -1.35, 1.35);
    G.camYaw += rand(-1, 1) * def.recoil * 0.3;
    p.bloom = Math.min(0.08, p.bloom + def.spread * 0.25);
    G.shake = Math.max(G.shake, def.recoil * 3);
  }
}

function toggleBuild(force) {
  G.build.on = force !== undefined ? force : !G.build.on;
  ghost.visible = G.build.on;
  $('#buildHint').classList.toggle('hidden', !G.build.on);
}

// ─────────────── Telecamera ───────────────
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.player;
  let pivot, dist, shoulder = 0.75, wantFov = 70;
  let yaw = G.camYaw, pitch = G.camPitch;
  if (!p.alive) {
    const t = G.spectate && G.spectate.alive ? G.spectate : p;
    pivot = camTarget.copy(t.pos).add(new THREE.Vector3(0, 1.6, 0));
    G.camYaw += dt * 0.25; yaw = G.camYaw; pitch = -0.35; dist = 7; shoulder = 0;
  } else if (p.mode === 'bus') {
    pivot = camTarget.copy(G.bus.pos).add(new THREE.Vector3(0, 3, 0));
    dist = 26; shoulder = 0; wantFov = 75;
  } else if (p.mode === 'fall' || p.mode === 'glide') {
    pivot = camTarget.copy(p.pos).add(new THREE.Vector3(0, 1.5, 0));
    dist = p.mode === 'fall' ? 7 : 6; shoulder = 0; wantFov = p.mode === 'fall' ? 85 : 75;
  } else {
    pivot = camTarget.copy(p.pos).add(new THREE.Vector3(0, 1.8 - 0.55 * p.crouchK, 0));
    dist = G.ads ? 2.2 : 3.8;
    shoulder = G.ads ? 0.75 : 1.0;
    if (G.ads) wantFov = 70 / currentZoom();
    if (p.moveAmt > 6.5) wantFov = 76;
  }
  G.fov = lerp(G.fov, wantFov, Math.min(1, dt * 12));
  if (Math.abs(camera.fov - G.fov) > 0.01) { camera.fov = G.fov; camera.updateProjectionMatrix(); }
  G.camDist = lerp(G.camDist, dist, Math.min(1, dt * 8));
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  if (shoulder > 0) {
    const sh = rayWorld(pivot, right, shoulder + 0.3);
    if (sh) shoulder = Math.max(0, sh.t - 0.3);
  }
  const base = pivot.clone().addScaledVector(right, shoulder);
  const back = dir.clone().negate();
  let d = G.camDist;
  const hit = rayWorld(base, back, d + 0.3);
  if (hit) d = Math.max(0.4, hit.t - 0.3);
  camera.position.copy(base).addScaledVector(back, d);
  if (G.shake > 0) {
    camera.position.x += rand(-1, 1) * G.shake * 0.25;
    camera.position.y += rand(-1, 1) * G.shake * 0.25;
    G.shake = Math.max(0, G.shake - dt * 2.5);
  }
  camera.lookAt(base.addScaledVector(dir, 50));
  // nascondi il modello quando si usa il mirino del cecchino o la camera è troppo vicina
  const scoped = G.ads && p.weapon && WEAPONS[p.weapon.id].scope && G.fov < 30;
  if (p.alive && p.mode !== 'bus') p.m.root.visible = !scoped && d > 0.9;
  $('#scope').classList.toggle('hidden', !scoped);
  // ombre e cielo seguono la camera
  const focus = p.alive && p.mode !== 'bus' ? p.pos : camera.position;
  sun.position.copy(focus).add(SUN_OFF);
  sun.target.position.copy(focus);
  sky.position.copy(camera.position);
  {
    const alt = clamp((camera.position.y - terrainHeight(camera.position.x, camera.position.z)) / 160, 0, 1);
    scene.fog.near = lerp(160, 420, alt);
    scene.fog.far = lerp(620, 1500, alt);
  }
  // tetti trasparenti se sei dentro una casa
  for (const h of world.houses) {
    const inside = p.alive && Math.abs(p.pos.x - h.cx) < h.w / 2 && Math.abs(p.pos.z - h.cz) < h.d / 2 && p.pos.y < h.roofTop - 0.5;
    if (h.roofMesh) h.roofMesh.visible = !inside;
  }
}

// ─────────────── HUD ───────────────
const hud = {
  alive: $('#aliveCount'), kills: $('#killCount'), storm: $('#stormInfo'),
  hpFill: $('#hpFill'), hpText: $('#hpText'), shFill: $('#shieldFill'), shText: $('#shieldText'),
  hotbar: $('#hotbar'), mag: $('#magText'), res: $('#reserves'), mats: $('#matsText'),
  prompt: $('#prompt'), progress: $('#progress'), progFill: $('#progressFill'), progText: $('#progressText'),
  cross: $('#crosshair'), hit: $('#hitmarker'), center: $('#centerMsg'), sub: $('#subMsg'),
  vignette: $('#vignette'), stRow: $('#staminaRow'), stFill: $('#staminaFill'), crouch: $('#crouchBadge'), hidden: $('#hiddenBadge'), poi: $('#poiName'), dmg: $('#damageLayer'), feed: $('#killfeed'),
};
const cache = {};
function setHTML(el, key, html) { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; } }

function weaponSVG(id, rarity) {
  const def = WEAPONS[id];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of def.parts) {
    minX = Math.min(minX, p[5] - p[2] / 2); maxX = Math.max(maxX, p[5] + p[2] / 2);
    minY = Math.min(minY, -p[4] - p[1] / 2); maxY = Math.max(maxY, -p[4] + p[1] / 2);
  }
  const col = { m: '#30343a', b: '#8a9099', r: RARITIES[rarity].color, w: '#a8703a' };
  const rects = def.parts.map(p => `<rect x="${(p[5] - p[2] / 2).toFixed(3)}" y="${(-p[4] - p[1] / 2).toFixed(3)}" width="${p[2]}" height="${p[1]}" fill="${col[p[6]]}" stroke="#000" stroke-width="0.012"/>`).join('');
  const pad = 0.04;
  return `<svg viewBox="${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}" preserveAspectRatio="xMidYMid meet">${rects}</svg>`;
}

function showMsg(title, sub, dur) {
  hud.center.textContent = title || '';
  hud.sub.textContent = sub || '';
  G.msgT = dur;
}
function addFeed(html, me) {
  const d = document.createElement('div');
  d.className = 'kf' + (me ? ' me' : '');
  d.innerHTML = html;
  hud.feed.prepend(d);
  while (hud.feed.children.length > 6) hud.feed.lastChild.remove();
  setTimeout(() => d.remove(), 7000);
}
function dmgNumber(pos, val, cls) {
  const el = document.createElement('div');
  el.className = 'dmg ' + (cls || '');
  el.textContent = val;
  hud.dmg.appendChild(el);
  G.dmgNums.push({ el, pos: pos.clone(), t: 0, vx: rand(-0.6, 0.6) });
}
const _proj = new THREE.Vector3();
function updateDmgNums(dt) {
  for (let i = G.dmgNums.length - 1; i >= 0; i--) {
    const d = G.dmgNums[i];
    d.t += dt;
    d.pos.y += dt * 1.2; d.pos.x += d.vx * dt;
    _proj.copy(d.pos).project(camera);
    if (d.t > 0.9 || _proj.z > 1) { d.el.remove(); G.dmgNums.splice(i, 1); continue; }
    d.el.style.left = ((_proj.x + 1) / 2 * innerWidth) + 'px';
    d.el.style.top = ((1 - _proj.y) / 2 * innerHeight) + 'px';
    d.el.style.opacity = d.t > 0.6 ? (0.9 - d.t) / 0.3 : 1;
  }
}
function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

function updateHUD(dt) {
  const p = G.player;
  setHTML(hud.alive, 'alive', String(aliveCount()));
  setHTML(hud.kills, 'kills', String(p.kills));
  const s = G.storm;
  let st;
  if (s.state === 'wait') st = `⛈ La tempesta si restringe tra <b>${fmtTime(s.timer)}</b>`;
  else if (s.state === 'shrink') st = `⛈ Tempesta in avvicinamento <b>${fmtTime(s.timer)}</b>`;
  else st = '⛈ Zona finale';
  setHTML(hud.storm, 'storm', st);
  const outside = p.alive && Math.hypot(p.pos.x - s.cx, p.pos.z - s.cz) > s.r;
  hud.storm.classList.toggle('warn', outside || s.state === 'shrink');
  hud.hpFill.style.width = clamp(p.hp, 0, 100) + '%';
  hud.shFill.style.width = clamp(p.shield, 0, 100) + '%';
  setHTML(hud.hpText, 'hp', String(Math.ceil(Math.max(0, p.hp))));
  setHTML(hud.shText, 'sh', String(Math.ceil(p.shield)));
  hud.stRow.classList.toggle('show', p.stamina < 99.5 || p.mode === 'climb');
  hud.stFill.style.width = p.stamina + '%';
  hud.stFill.classList.toggle('low', p.stamina < 25);
  hud.crouch.classList.toggle('show', p.crouch && p.mode === 'ground' && p.alive);
  hud.hidden.classList.toggle('show', !!p.hidden);
  // hotbar
  const sig = p.slots.map(x => x ? `${x.kind}${x.id}${x.rarity}${x.count}` : '-').join('|') + p.active;
  if (cache.hot !== sig) {
    cache.hot = sig;
    hud.hotbar.innerHTML = p.slots.map((x, i) => {
      let inner = '', rb = '', cnt = '';
      if (!x) inner = i === p.active ? '<span style="font-size:24px">⛏️</span>' : '';
      else if (x.kind === 'weapon') { inner = weaponSVG(x.id, x.rarity); rb = RARITIES[x.rarity].color; }
      else { inner = CONSUMABLES[x.id].icon; rb = RARITIES[CONSUMABLES[x.id].rarity].color; cnt = 'x' + x.count; }
      const bg = rb ? `background:linear-gradient(180deg, rgba(0,0,0,.45), ${rb}55)` : '';
      return `<div class="slot ${i === p.active ? 'on' : ''}" style="${bg}"><span class="k">${i + 1}</span>${inner}<span class="c">${cnt}</span>${rb ? `<div class="rbar" style="background:${rb}"></div>` : ''}</div>`;
    }).join('');
  }
  const sl = p.slot;
  let magHtml;
  if (!sl) magHtml = '<small>Piccone</small>';
  else if (sl.kind === 'weapon') { const def = WEAPONS[sl.id]; magHtml = `${sl.mag}<small> / ${p.ammo[def.ammo]}</small><div style="font-size:13px;color:${RARITIES[sl.rarity].color}">${def.name}</div>`; }
  else magHtml = `<small>${CONSUMABLES[sl.id].name} x${sl.count}</small>`;
  setHTML(hud.mag, 'mag', magHtml);
  setHTML(hud.res, 'res', Object.entries(p.ammo).filter(([, v]) => v > 0).map(([k, v]) => `<span style="color:${AMMO_TYPES[k].color}">${AMMO_TYPES[k].short} ${v}</span>`).join(''));
  setHTML(hud.mats, 'mats', String(p.mats));
  // prompt
  let pr = '';
  if (p.mode === 'bus') pr = '';
  else if (p.mode === 'climb' && p.alive) { pr = '🧗 <kbd>W</kbd> sali · <kbd>S</kbd> scendi · <kbd>Spazio</kbd> salta via'; hud.prompt.style.borderLeftColor = '#ffd23a'; }
  else if (G.interact && p.alive) {
    if (G.interact.loot) {
      const it = G.interact.loot.item;
      const col = it.kind === 'weapon' ? RARITIES[it.rarity].color : '#fff';
      pr = `<span style="border-color:${col}"><kbd>E</kbd> Raccogli ${itemLabel(it)}</span>`;
      hud.prompt.style.borderLeftColor = col;
    } else { pr = '<kbd>E</kbd> Apri il forziere ✨'; hud.prompt.style.borderLeftColor = '#ffd24a'; }
  } else if (G.climbHint && p.alive && p.mode === 'ground') { pr = '🧗 <kbd>W</kbd> + <kbd>Spazio</kbd> per arrampicarti'; hud.prompt.style.borderLeftColor = '#7fe07a'; }
  setHTML(hud.prompt, 'prompt', pr);
  hud.prompt.style.display = pr ? 'block' : 'none';
  // progress
  let prog = null;
  if (p.reloading > 0 && p.weapon) prog = [1 - p.reloading / WEAPONS[p.weapon.id].reload, 'Ricarica…'];
  else if (p.using) prog = [p.using.t / p.using.total, `Uso ${CONSUMABLES[p.slot.id].name}…`];
  hud.progress.classList.toggle('hidden', !prog);
  if (prog) { hud.progFill.style.width = (prog[0] * 100) + '%'; setHTML(hud.progText, 'pt', prog[1]); }
  // mirino
  const spread = currentSpread(p);
  const px = Math.tan(Math.max(spread, 0.004)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (innerHeight / 2);
  hud.cross.style.setProperty('--s', Math.min(60, 3 + px) + 'px');
  const scopedNow = !$('#scope').classList.contains('hidden');
  hud.cross.style.display = (p.alive && p.mode === 'ground' && !G.build.on && !scopedNow) ? 'block' : 'none';
  // telemetro: distanza, tempo di volo e caduta del proiettile mentre miri
  {
    const w = p.alive && p.mode === 'ground' && G.ads && p.weapon ? WEAPONS[p.weapon.id] : null;
    const el = $('#rangeInfo');
    if (w) {
      G.rangeT = (G.rangeT || 0) - dt;
      if (G.rangeT <= 0) {
        G.rangeT = 0.1;
        const cd = new THREE.Vector3(); camera.getWorldDirection(cd);
        const h = rayAll(camera.position, cd, 700, p);
        if (h) {
          const d = Math.max(0, h.t - camera.position.distanceTo(p.chest()) * 0.5);
          const tf = d / (w.speed || 300), drop = 0.5 * BULLET_G * (w.drop ?? 1) * tf * tf;
          el.innerHTML = `<b>${Math.round(d)} m</b> · ${tf.toFixed(2).replace('.', ',')} s${drop >= 0.15 ? ` · <span>↓ ${drop.toFixed(1).replace('.', ',')} m</span>` : ''}`;
        } else el.innerHTML = '<b>— m</b>';
      }
      el.style.display = 'block';
      el.classList.toggle('scoped', !$('#scope').classList.contains('hidden'));
    } else el.style.display = 'none';
  }
  G.hitT -= dt;
  hud.hit.style.opacity = G.hitT > 0 ? 1 : 0;
  G.hurtT -= dt;
  const low = p.alive && p.hp < 30 ? 0.35 + Math.sin(G.time * 6) * 0.15 : 0;
  hud.vignette.style.opacity = Math.max(low, G.hurtT > 0 ? G.hurtT * 1.5 : 0);
  if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) { hud.center.textContent = ''; hud.sub.textContent = ''; } }
  // luogo
  let poi = '';
  for (const t of TOWNS) if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < t.r + 8) poi = t.name;
  setHTML(hud.poi, 'poi', poi);
  updateDmgNums(dt);
  drawMinimap();
  if ($('#bigmap').classList.contains('hidden') === false) drawBigMap();
}

const mmCanvas = $('#minimap');
const mmCtx = mmCanvas.getContext('2d');
function w2m(v, center, view, S) { return (v - center) / view * S + S / 2; }
function drawMinimap() {
  const S = 200, view = 220;
  const p = G.player;
  const c = p.mode === 'bus' ? G.bus.pos : (p.alive ? p.pos : camera.position);
  const MM = world.minimap.width, k = MM / (HALF * 2);
  mmCtx.fillStyle = '#2a78bd';
  mmCtx.fillRect(0, 0, S, S);
  mmCtx.drawImage(world.minimap, (c.x - view / 2 + HALF) * k, (c.z - view / 2 + HALF) * k, view * k, view * k, 0, 0, S, S);
  drawStormOn(mmCtx, S, c.x, c.z, view);
  drawBusLine(mmCtx, S, c.x, c.z, view);
  mmCtx.font = 'bold 10px sans-serif'; mmCtx.textAlign = 'center';
  for (const t of TOWNS) {
    const x = w2m(t.x, c.x, view, S), y = w2m(t.z, c.z, view, S);
    if (x < -40 || x > S + 40 || y < -10 || y > S + 10) continue;
    mmCtx.fillStyle = 'rgba(0,0,0,.6)'; mmCtx.fillText(t.name, x + 1, y + 1);
    mmCtx.fillStyle = '#fff'; mmCtx.fillText(t.name, x, y);
  }
  drawPlayerArrow(mmCtx, w2m(p.pos.x, c.x, view, S), w2m(p.pos.z, c.z, view, S), 7);
}
function drawStormOn(ctx, S, cx, cz, view) {
  const s = G.storm;
  if (!s) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  ctx.arc(w2m(s.cx, cx, view, S), w2m(s.cz, cz, view, S), Math.max(0, s.r / view * S), 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(120,40,220,0.45)';
  ctx.fill('evenodd');
  ctx.strokeStyle = '#c070ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(w2m(s.cx, cx, view, S), w2m(s.cz, cz, view, S), Math.max(0, s.r / view * S), 0, Math.PI * 2); ctx.stroke();
  if (s.state !== 'done') {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(w2m(s.tx, cx, view, S), w2m(s.tz, cz, view, S), Math.max(0, s.tr / view * S), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
function drawBusLine(ctx, S, cx, cz, view) {
  const B = G.bus;
  if (!B || B.t / B.dur > 1 || G.player.mode !== 'bus') return;
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(w2m(B.a.x, cx, view, S), w2m(B.a.z, cz, view, S));
  ctx.lineTo(w2m(B.b.x, cx, view, S), w2m(B.b.z, cz, view, S));
  ctx.stroke(); ctx.setLineDash([]);
  const x = w2m(B.pos.x, cx, view, S), y = w2m(B.pos.z, cz, view, S);
  ctx.fillStyle = '#2f6fd6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function drawPlayerArrow(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-G.camYaw);
  ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, s * 1.3); ctx.lineTo(s * 0.8, -s * 0.8); ctx.lineTo(0, -s * 0.3); ctx.lineTo(-s * 0.8, -s * 0.8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
const bmCanvas = $('#bigmapCanvas');
const bmCtx = bmCanvas.getContext('2d');
function drawBigMap() {
  const S = 640, view = HALF * 2;
  bmCtx.drawImage(world.minimap, 0, 0, S, S);
  drawStormOn(bmCtx, S, 0, 0, view);
  drawBusLine(bmCtx, S, 0, 0, view);
  bmCtx.font = 'bold 14px sans-serif'; bmCtx.textAlign = 'center';
  for (const t of TOWNS) {
    const x = w2m(t.x, 0, view, S), y = w2m(t.z, 0, view, S);
    bmCtx.fillStyle = 'rgba(0,0,0,.6)'; bmCtx.fillText(t.name, x + 1, y + 1);
    bmCtx.fillStyle = '#fff'; bmCtx.fillText(t.name, x, y);
  }
  const p = G.player;
  const pp = p.mode === 'bus' ? G.bus.pos : p.pos;
  drawPlayerArrow(bmCtx, w2m(pp.x, 0, view, S), w2m(pp.z, 0, view, S), 10);
}

// ─────────────── Partita ───────────────
function makeBotNames(n) {
  const out = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const A1 = ['Lupo', 'Falco', 'Gatto', 'Drago', 'Squalo', 'Orso', 'Tigre', 'Volpe', 'Aquila', 'Cobra', 'Panda', 'Riccio', 'Polpo', 'Grifo', 'Bisonte', 'Gufo', 'Ghepardo', 'Scorpione', 'Cinghiale', 'Lince'];
  const A2 = ['Rosso', 'Nero', 'Veloce', 'Matto', 'Furioso', 'Ninja', 'Turbo', 'Zen', 'Gentile', 'Pazzo', 'Felice', 'Elettrico', 'Dorato', 'Solitario', 'Selvaggio', 'Pigro', 'Veneto', 'Stellare'];
  const used = new Set(out);
  for (let k = 0; out.length < n && k < 5000; k++) {
    const nm = pick(A1) + (Math.random() < 0.5 ? '_' : '') + pick(A2) + (Math.random() < 0.55 ? Math.floor(rand(1, 99)) : '');
    if (!used.has(nm)) { used.add(nm); out.push(nm); }
  }
  return out.slice(0, n);
}

function clearMatch() {
  world.resetProps();
  for (const c of G.chars) scene.remove(c.m.root);
  G.chars = [];
  for (const L of G.loot) if (L.mesh) scene.remove(L.mesh);
  G.loot = [];
  for (const pr of G.projectiles) scene.remove(pr.mesh);
  G.projectiles = [];
  G.bullets = []; bulletMesh.count = 0;
  for (const w of [...G.walls]) { removeCollider(w); scene.remove(w.mesh); }
  G.walls = [];
  for (const c of G.chests) { c.opened = false; if (c.lid) c.lid.rotation.x = 0; }
  for (const d of G.dmgNums) d.el.remove();
  G.dmgNums = [];
  hud.feed.innerHTML = '';
}

/** rende ripetibile Math.random (stesso bottino per tutti i giocatori online) */
function withSeed(seed, fn) {
  const orig = Math.random;
  let x = seed >>> 0;
  Math.random = () => { x |= 0; x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  try { fn(); } finally { Math.random = orig; }
}
const randomCos = () => ({
  hat: Math.random() < 0.3 ? pick(HATS).id : 'none',
  back: Math.random() < 0.35 ? pick(BACKPACKS).id : 'none',
  glider: pick(GLIDERS).id,
});
function myCos() { return { hat: settings.hat, back: settings.back, glider: settings.glider }; }

/** GIOCA: offline subito, online solo l'host avvia la partita per tutti */
async function startMatch() {
  if (G.starting) return;
  if (NET.role === 'client') { menuApi && menuApi.toast("Aspetta: la partita la avvia l'host della lobby"); return; }
  G.starting = true;
  try {
    const mode = NET.role === 'host' ? NET.mode : settings.mode;
    const random = mode === 'random';
    const seed = random ? 1 + Math.floor(Math.random() * 2e9) : 1337;
    await prepareWorld(seed, random);
    if (NET.role === 'host') {
      // la lista dei partecipanti e dei bot la decide l'host
      const players = NET.players.map(p => ({ id: p.id, name: p.name, skin: p.skin, cos: { hat: p.hat, back: p.back, glider: p.glider } }));
      const total = 100;
      const names = makeBotNames(total - players.length);
      const bots = names.map(n => ({ name: n, skin: pick(SKINS).id, cos: randomCos() }));
      const busAng = Math.random() * Math.PI * 2, busOff = rand(-50, 50) * SCALE;
      const st = newStorm();
      const start = { t: 'start', seed, random, mode, lootSeed: Math.floor(Math.random() * 2e9), players, bots, bus: [busAng, busOff], storm: stormState(st), diff: settings.difficulty };
      NET.inMatch = true;
      netSend(start);
      beginMatch(start);
    } else beginMatch(null);
  } finally { G.starting = false; }
}
/** client: l'host ha avviato la partita */
async function onNetStart(msg) {
  if (G.state !== 'menu') clearMatchToMenuSilently();
  await prepareWorld(msg.seed, msg.random);
  beginMatch(msg);
}
function clearMatchToMenuSilently() {
  clearMatch(); G.player = null; G.state = 'menu';
  for (const id of ['#end', '#pause', '#bigmap', '#scope']) $(id).classList.add('hidden');
}

function setupBot(b) {
  b.ai = makeAI();
  // punto di atterraggio: città o luogo casuale
  let tx, tz;
  if (Math.random() < 0.55) { const t = pick(TOWNS); tx = t.x + rand(-t.r * 0.8, t.r * 0.8); tz = t.z + rand(-t.r * 0.8, t.r * 0.8); }
  else { tx = rand(-HALF + 25, HALF - 25); tz = rand(-HALF + 25, HALF - 25); }
  const hh = houseAt(tx, tz);
  if (hh && hh.doors.length) { const dd = pick(hh.doors); tx = dd.x + dd.nx * 3; tz = dd.z + dd.nz * 3; }
  b.ai.dropTarget.set(tx, 0, tz);
  // salta quando il bus passa vicino al punto
  const B = G.bus, ab = B.b.clone().sub(B.a);
  const k = clamp(((tx - B.a.x) * ab.x + (tz - B.a.z) * ab.z) / ab.lengthSq(), 0.1, 0.88);
  b.ai.jumpT = k * B.dur + rand(-2.5, 1.5);
  b.mats = 0;
}

function beginMatch(net) {
  A.initAudio();
  A.setVolume(settings.vol);
  clearMatch();
  G.mode = net ? net.mode : settings.mode;
  G.net = net ? { sendT: 0, snapT: 0, stormT: 0, byPeer: new Map() } : null;
  G.diff = DIFFICULTY[(net && net.diff) || settings.difficulty] || DIFFICULTY.normale;
  G.time = 0; G.endShown = false; G.spectate = null; G.paused = false; G.ads = false;
  G.lootSeq = 0; G.lootPrefix = ''; G.matchStats = { chests: 0, grass: 0, climb: 0, glide: 0, walk: 0, surv: 0 };
  PR.resetMatchMax();
  toggleBuild(false);
  // bottino iniziale (online: uguale per tutti grazie al seme comune)
  const spawnInitial = () => {
  for (const spot of world.lootSpots) {
    if (Math.random() < 0.18) continue;
    const r = Math.random();
    const off = () => new THREE.Vector3(spot.x + rand(-0.6, 0.6), spot.y, spot.z + rand(-0.6, 0.6));
    if (r < 0.55) {
      const w = randomWeapon();
      spawnLoot(w, off());
      const a = ammoFor(w.id);
      const p2 = off(); p2.x += 0.8;
      spawnLoot(a, p2);
    } else if (r < 0.8) spawnLoot(randomCons(), off());
    else if (r < 0.93) { const t = pick(Object.keys(AMMO_TYPES).filter(k => k !== 'rockets')); spawnLoot({ kind: 'ammo', id: t, count: AMMO_TYPES[t].pickup }, off()); }
    else spawnLoot({ kind: 'mats', count: 30 }, off());
  }
  };
  G.lootInit = true;
  if (net) withSeed(net.lootSeed, spawnInitial); else spawnInitial();
  G.lootInit = false;
  // personaggi
  if (net) {
    G.bus = newBus(net.bus[0], net.bus[1]);
    G.storm = Object.assign(newStorm(), net.storm);
    let myIdx = 0;
    for (const pl of net.players) {
      const skin = SKINS.find(x => x.id === pl.skin) || SKINS[0];
      const me = pl.id === NET.myId;
      const c = new Character(pl.name, skin, me, pl.cos);
      c.human = true;
      if (me) { G.player = c; myIdx = G.chars.length; }
      else { c.remote = true; c.mats = 0; c.netId = pl.id; G.net.byPeer.set(pl.id, c); }
      G.chars.push(c);
    }
    G.lootPrefix = myIdx + ':';
    for (const bt of net.bots) {
      const b = new Character(bt.name, SKINS.find(x => x.id === bt.skin) || SKINS[0], false, bt.cos);
      if (NET.role === 'host') setupBot(b); else { b.remote = true; b.mats = 0; }
      G.chars.push(b);
    }
  } else {
    G.bus = newBus();
    G.storm = newStorm();
    const skin = SKINS.find(s => s.id === settings.skin) || SKINS[0];
    const player = new Character(settings.name || 'Giocatore', skin, true, myCos());
    G.player = player;
    G.chars.push(player);
    const nb = clamp((Number(settings.players) || 100) - 1, 1, 99);
    const names = makeBotNames(nb);
    for (let i = 0; i < nb; i++) {
      const b = new Character(names[i % names.length], pick(SKINS), false, randomCos());
      setupBot(b);
      G.chars.push(b);
    }
  }
  G.chars.forEach((c, i) => { c.idx = i; });
  const player = G.player;
  for (const c of G.chars) c.pos.copy(G.bus.pos);
  G.camYaw = Math.atan2(G.bus.b.x - G.bus.a.x, G.bus.b.z - G.bus.a.z) + Math.PI * 0.5;
  G.camPitch = -0.25;
  G.state = 'bus';
  $('#menu').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  scene.fog.far = 560;
  showMsg('BENVENUTO NEL BATTLE BUS!', (G.mode === 'random' ? '🎲 Random Map: isola nuova! · ' : '') + 'Premi SPAZIO per lanciarti · muovi il mouse per guardarti intorno', 6);
  $('#netInfo').classList.toggle('hidden', !G.net);
  if (G.net) $('#netInfo').textContent = `🌐 Online · stanza ${NET.code} · ${NET.players.length} giocatori + bot`;
  cache.hot = null;
  if (settings.fs !== false && !isFullscreen()) toggleFullscreen(true);
  requestLock();
}

function endMatch(win) {
  if (win && G.player && G.player.alive && G.player.mode === 'ground') startEmote(G.player, 'tifo');
  if (G.endShown) return;
  G.endShown = true;
  G.state = 'end';
  G.ads = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const p = G.player;
  const place = win ? 1 : G.placement;
  $('#end').classList.toggle('win', win);
  $('#endPlace').textContent = '#' + place;
  $('#endTitle').textContent = win ? 'VITTORIA REALE!' : 'ELIMINATO';
  $('#endSub').textContent = win ? 'Sei l\'ultimo sopravvissuto. Leggendario! 🏆' : `Sei stato eliminato da ${G.killedBy}`;
  const surv = G.time;
  $('#endStats').innerHTML = `<div><b>${p.kills}</b><span>Uccisioni</span></div><div><b>${Math.round(p.damageDealt)}</b><span>Danni inflitti</span></div><div><b>${fmtTime(surv)}</b><span>Tempo</span></div><div><b>${G.chars.length}</b><span>Giocatori</span></div>`;
  // progressi: XP del pass, monete, missioni
  PR.track('survive', Math.floor(G.time));
  const res = PR.matchResult({ place, total: G.chars.length, kills: p.kills, time: G.time, damage: p.damageDealt, chests: G.matchStats.chests, win, mode: G.mode, online: !!G.net });
  renderEndXp(res);
  $('#againBtn').classList.toggle('hidden', NET.role === 'client');
  $('#againBtn').textContent = NET.role === 'host' ? 'NUOVA PARTITA PER TUTTI' : 'GIOCA ANCORA';
  setTimeout(() => $('#end').classList.remove('hidden'), win ? 600 : 0);
  win ? A.playVictory() : A.playDefeat();
  if (win) showMsg('#1 VITTORIA REALE!', '', 5);
}
function renderEndXp(r) {
  const rows = r.lines.map(l => `<div class="row"><span>${esc(l.label)}</span><b>+${l.xp} XP</b></div>`).join('');
  const lv = r.tierAfter > r.tierBefore ? `<div class="lvup">⭐ LIVELLO ${r.tierAfter} RAGGIUNTO! Nuove ricompense nel pass</div>` : '';
  $('#endXp').innerHTML = `${rows}<div class="tot"><span>Totale</span><span>+${r.xp} XP · +${r.coins} 🪙</span></div>
    <div class="xpbar"><i style="width:${(PR.tierProgress() * 100).toFixed(1)}%"></i></div>${lv}`;
}
$('#againBtn').onclick = () => { A.playUI(); startMatch(); };
$('#menuBtn').onclick = () => { A.playUI(); toMenu(); };

function toMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (G.net && NET.role === 'host') { netSend({ t: 'abort' }); NET.inMatch = false; }
  G.net = null;
  clearMatch();
  G.state = 'menu';
  G.player = null;
  if (busMesh) busMesh.visible = false;
  $('#hud').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#pause').classList.add('hidden');
  $('#bigmap').classList.add('hidden');
  $('#scope').classList.add('hidden');
  $('#stormTint').style.opacity = 0;
  $('#vignette').style.opacity = 0;
  A.setStormSound(0);
  $('#menu').classList.remove('hidden');
  if (menuApi) menuApi.refresh();
}

// ─────────────── Lobby (armadietto) ───────────────
const lobby = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100), char: null, rot: 0.4, rotV: 0, drag: false, ring: null };
{
  const L = lobby.scene;
  L.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), gradientMaterial('#1d2f8a', '#0a0f2e')));
  L.add(new THREE.HemisphereLight('#bcd4ff', '#20203a', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(3, 5, 4); key.castShadow = true; L.add(key);
  const rim = new THREE.DirectionalLight('#6fd3ff', 2.2); rim.position.set(-4, 3, -4); L.add(rim);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.3, 32), new THREE.MeshStandardMaterial({ color: '#222a55', metalness: 0.5, roughness: 0.4 }));
  ped.position.y = -0.15; ped.receiveShadow = true; L.add(ped);
  lobby.ring = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffcf2e' }));
  lobby.ring.rotation.x = Math.PI / 2; lobby.ring.position.y = 0.01; L.add(lobby.ring);
  // particelle decorative
  const pg = new THREE.BufferGeometry();
  const arr = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) { arr[i * 3] = rand(-8, 8); arr[i * 3 + 1] = rand(-1, 6); arr[i * 3 + 2] = rand(-8, 2); }
  pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  lobby.stars = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#9fc8ff', size: 0.04 }));
  L.add(lobby.stars);
  lobby.cam.position.set(0, 1.25, 7.4);
  lobby.cam.lookAt(0, 0.95, 0);
}
/** personaggio nell'armadietto: skin + cappello + zaino (+ deltaplano in anteprima) */
let lobbyLook = null;
function setLobbyLook(look) {
  look = Object.assign({ skin: settings.skin, hat: settings.hat, back: settings.back, glider: null }, look || {});
  const key = JSON.stringify(look);
  if (key === lobbyLook) return;
  lobbyLook = key;
  const skin = SKINS.find(s => s.id === look.skin) || SKINS[0];
  if (lobby.char) lobby.scene.remove(lobby.char.root);
  lobby.char = buildCharacter(skin, { hat: look.hat, back: look.back });
  lobby.char.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  lobby.char.gunPivot.add(buildWeaponMesh('ar', 4));
  if (look.glider) {
    const gd = GLIDERS.find(g => g.id === look.glider) || GLIDERS[0];
    const gl = buildGlider(gd); gl.position.y += 0.05; lobby.char.root.add(gl); lobby.char.glider = true;
  }
  lobby.scene.add(lobby.char.root);
  lobby.ring.material.color.set(RARITIES[skin.rarity].color);
  $('#skinName').innerHTML = `${skin.name} · <span style="color:${RARITIES[skin.rarity].color}">${RARITIES[skin.rarity].name}</span>`;
}
function setLobbySkin(skin) { setLobbyLook({ skin: skin.id }); }
/** compagni della lobby online ai lati del personaggio */
let lobbyMatesKey = '';
function refreshLobbyMates() {
  const others = NET.role === 'off' ? [] : NET.players.filter(p => p.id !== NET.myId).slice(0, 6);
  const key = JSON.stringify(others.map(o => [o.id, o.skin, o.hat, o.back, o.name]));
  if (key === lobbyMatesKey) return;
  lobbyMatesKey = key;
  for (const m of lobby.mates) lobby.scene.remove(m.root);
  lobby.mates = [];
  const SPOTS = [[1.7, -0.9], [3.0, -1.7], [4.3, -2.6], [1.1, -2.8], [2.5, -3.5], [3.9, -4.3]];
  others.forEach((o, i) => {
    const c = buildCharacter(SKINS.find(s => s.id === o.skin) || SKINS[0], { hat: o.hat, back: o.back });
    c.root.position.set(SPOTS[i][0], 0, SPOTS[i][1]);
    c.root.rotation.y = -0.45;
    c.root.traverse(q => { if (q.isMesh) q.castShadow = true; });
    // targhetta con il nome
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(4, 8, 248, 48, 14); g.fill();
    g.fillStyle = o.host ? '#ffcf2e' : '#ffffff'; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((o.host ? '★ ' : '') + o.name, 128, 33);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(1.2, 0.3, 1); sp.position.y = 2.35; c.root.add(sp);
    c.phase = Math.random() * 6;
    lobby.scene.add(c.root);
    lobby.mates.push(c);
  });
}
lobby.mates = [];
canvas.addEventListener('pointerdown', () => { if (G.state === 'menu') lobby.drag = true; });
addEventListener('pointerup', () => { lobby.drag = false; });
function renderLobby(dt) {
  const c = lobby.char;
  const t = performance.now() / 1000;
  lobby.rot += lobby.rotV + dt * 0.35;
  lobby.rotV *= 0.9;
  if (c) {
    c.root.rotation.y = lobby.rot;
    resetPose(c);
    if (c.glider) poseGlide(c, t);
    else {
      // posa da armadietto: fucile in mano, respiro e peso che si sposta
      poseHold(c, -0.25 + Math.sin(t * 0.8) * 0.03, 0, 0, 0);
      const br = Math.sin(t * 2) * 0.5 + 0.5;
      c.body.position.y = br * 0.012;
      c.torso.rotation.x = br * 0.02;
      c.torso.rotation.z = Math.sin(t * 0.6) * 0.02;
      setLeg(c, 0, -0.04, 0.08, 0.04); setLeg(c, 1, 0.06, 0.12, -0.06);
    }
    c.head.rotation.y = Math.sin(t * 0.7) * 0.25;
    if (c.cape) c.cape.rotation.x = 0.12 + Math.sin(t * 1.5) * 0.05;
  }
  for (const m of lobby.mates) {
    resetPose(m);
    const tt = t + m.phase;
    poseHold(m, -0.3, 0, 0, 0);
    m.body.position.y = (Math.sin(tt * 2) * 0.5 + 0.5) * 0.012;
    m.head.rotation.y = Math.sin(tt * 0.6) * 0.3;
    setLeg(m, 0, -0.04, 0.08, 0.04); setLeg(m, 1, 0.06, 0.12, -0.06);
  }
  lobby.stars.rotation.y = t * 0.02;
  // personaggio centrato nello spazio libero tra i pannelli (metri per pixel alla distanza della camera)
  const tab = menuApi ? menuApi.tab() : 'play';
  const mpp = 2 * 7.4 * Math.tan(THREE.MathUtils.degToRad(lobby.cam.fov / 2)) / innerHeight;
  let sx = 0, ly = 0.95;
  if (innerWidth > 900) {
    if (tab === 'play') sx = -((380 + 34) - (340 + 34)) / 2 * mpp;
    else if (tab === 'pass') { sx = 0; ly = 0.15; }
    else sx = (440 + 34) / 2 * mpp;
  }
  lobby.cam.position.x += (sx - lobby.cam.position.x) * Math.min(1, dt * 6);
  lobby._ly = (lobby._ly ?? ly) + (ly - (lobby._ly ?? ly)) * Math.min(1, dt * 6);
  lobby.cam.position.y = 1.25;
  lobby.cam.lookAt(lobby.cam.position.x, lobby._ly, 0);
  renderer.render(lobby.scene, lobby.cam);
}

let menuApi = null;
function buildMenu() {
  menuApi = initMenu({
    settings, save: saveSettings,
    ui: () => { A.initAudio(); A.playUI(); },
    preview: look => setLobbyLook(look),
    play: () => startMatch(),
    lobbyChanged: () => refreshLobbyMates(),
    netStart: msg => onNetStart(msg),
    netMessage: (from, msg) => onNetMessage(from, msg),
    netClosed: why => { if (G.state !== 'menu') { toMenu(); } menuApi.toast(why || 'Connessione chiusa'); },
  });
  setLobbyLook(null);
}

// ─────────────── Online: sincronizzazione della partita ───────────────
// L'host simula bot, tempesta e salute di tutti; ogni giocatore muove il proprio personaggio
// e decide i propri colpi. Gli altri personaggi sono "marionette" mosse dai messaggi.
const MODE_CODES = ['bus', 'fall', 'glide', 'ground', 'climb'];
const r2 = v => Math.round(v * 100) / 100;
function stormState(st) {
  const o = {};
  for (const k of ['phase', 'state', 'timer', 'cx', 'cz', 'r', 'dps', 'fx', 'fz', 'fr', 'tx', 'tz', 'tr']) o[k] = typeof st[k] === 'number' ? r2(st[k]) : st[k];
  return o;
}
function heldCode(c) {
  const s = c.slot;
  if (!s) return 'p';
  return s.kind === 'weapon' ? `w:${s.id}:${s.rarity}` : `c:${s.id}`;
}
function encodeChar(c) {
  const fl = (c.onGround ? 1 : 0) | (c.crouch ? 2 : 0) | (c.inWater ? 4 : 0) | (c.swing > 0.2 ? 8 : 0) | (c.using ? 16 : 0) | (c.reloading > 0 ? 32 : 0);
  return [c.idx, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r2(c.yaw), r2(c.pitch), MODE_CODES.indexOf(c.mode), fl,
    r2(c.vel.x), r2(c.vel.y), r2(c.vel.z), heldCode(c),
    c.mode === 'climb' ? r2(Math.atan2(c.climbDir.x, c.climbDir.z)) : 0, r2(c.climbPhase || 0), c.mantle ? r2(c.mantle.t) : -1, c.emote ? c.emote.id : 0];
}
function applyCharState(c, a) {
  const n = c.net || (c.net = {});
  n.x = a[1]; n.y = a[2]; n.z = a[3]; n.yaw = a[4]; n.pitch = a[5]; n.mode = MODE_CODES[a[6]] || 'ground'; n.fl = a[7];
  n.vx = a[8]; n.vy = a[9]; n.vz = a[10]; n.held = a[11]; n.cy = a[12]; n.cp = a[13]; n.mt = a[14]; n.em = a[15]; n.t = performance.now();
}
function updatePuppet(c, dt) {
  const n = c.net;
  if (!n || !c.alive) return;
  if (c.mode !== n.mode) {
    if (n.mode !== 'bus') c.m.root.visible = true;
    if (n.mode === 'glide') showGlider(c, true); else if (c.mode === 'glide') showGlider(c, false);
    if (c.mode === 'bus' || Math.hypot(n.x - c.pos.x, n.z - c.pos.z) > 40) c.pos.set(n.x, n.y, n.z);
    c.mode = n.mode;
  }
  if (c.mode === 'bus') return;
  const age = Math.min(0.25, (performance.now() - n.t) / 1000);
  const tx = n.x + n.vx * age, ty = n.y + (c.mode === 'ground' ? 0 : n.vy * age), tz = n.z + n.vz * age;
  if (Math.hypot(tx - c.pos.x, ty - c.pos.y, tz - c.pos.z) > 12) c.pos.set(tx, ty, tz);
  const k = Math.min(1, dt * 12);
  c.pos.x += (tx - c.pos.x) * k; c.pos.y += (ty - c.pos.y) * k; c.pos.z += (tz - c.pos.z) * k;
  c.yaw = angLerp(c.yaw, n.yaw, k); c.pitch = lerp(c.pitch, n.pitch, k);
  c.vel.set(n.vx, n.vy, n.vz);
  c.moveAmt = c.mode === 'climb' ? Math.abs(n.vy) : Math.hypot(n.vx, n.vz);
  c.onGround = !!(n.fl & 1); c.crouch = !!(n.fl & 2); c.inWater = !!(n.fl & 4);
  if (n.fl & 8 && c.swing <= 0) c.swing = 0.45;
  c.using = n.fl & 16 ? (c.using || { t: 0, total: 1, slot: c.active }) : null;
  if (c.using) c.using.t = Math.min(c.using.total * 0.9, c.using.t + dt);
  c.reloading = n.fl & 32 ? 0.5 : 0;
  if (c.mode === 'climb') { c.climbDir.set(Math.sin(n.cy), 0, Math.cos(n.cy)); c.climbPhase = n.cp; c.mantle = n.mt >= 0 ? { t: n.mt } : null; }
  else c.mantle = null;
  if (n.held !== c._held) {
    c._held = n.held;
    const [kind, id, rar] = n.held.split(':');
    c.slots.fill(null); c.active = 0;
    if (kind === 'w' && WEAPONS[id]) c.slots[0] = { kind: 'weapon', id, rarity: +rar || 0, mag: 1 };
    else if (kind === 'c' && CONSUMABLES[id]) c.slots[0] = { kind: 'cons', id, count: 1 };
    c.updateHeld();
  }
  if (n.em && (!c.emote || c.emote.id !== n.em)) startEmote(c, n.em);
  else if (!n.em && c.emote) stopEmote(c);
}
/** chi decide i danni: true = applicali qui; false = li gestisce l'host (o un altro giocatore) */
function netDamageGate(t, amount, attacker, head, how, ignoreShield) {
  if (NET.role === 'host') {
    if (attacker && attacker.remote) return false;          // i colpi degli altri giocatori arrivano come "hit"
    if (!attacker && t.remote) return false;                // tempesta/cadute: le calcola il giocatore stesso
    return true;
  }
  // client: invia all'host solo ciò che riguarda me
  if (attacker === G.player || (!attacker && t === G.player)) {
    netSend({ t: 'hit', v: t.idx, amt: Math.round(amount * 10) / 10, h: head ? 1 : 0, w: how, env: attacker ? 0 : 1, ig: ignoreShield ? 1 : 0, relay: false });
  }
  return false;
}
function netShot(ch, msg) {
  if (NET.role === 'host') {
    // i colpi dei bot vanno solo a chi è abbastanza vicino da vederli
    for (const c of G.chars) if (c.remote && c.human && c.netId && c.pos.distanceToSquared(ch.pos) < 260 * 260) netSendTo(c.netId, msg);
  } else netSend(msg);
}
function remoteShot(ch, m) {
  const s = { id: m.w, rarity: m.r };
  const def = WEAPONS[m.w];
  if (!def || !ch) return;
  ch.lastShotT = G.time;
  ch.recoilT = 0.14; ch.recoilK = def.pellets > 1 || def.projectile ? 1.6 : def.rate > 0.5 ? 1.3 : 0.7;
  ch.emote = null;
  const o = new THREE.Vector3(m.o[0], m.o[1], m.o[2]);
  const dist = o.distanceTo(camera.position);
  A.playGun(def.sound, dist);
  if (dist < 140) muzzleFlash(o, def.pellets > 1 || def.projectile);
  const dmg = def.dmg * RARITIES[s.rarity || 0].mult;
  for (let i = 0; i < m.d.length / 3; i++) {
    const oi = new THREE.Vector3(m.o[i * 3] ?? m.o[0], m.o[i * 3 + 1] ?? m.o[1], m.o[i * 3 + 2] ?? m.o[2]);
    const d = new THREE.Vector3(m.d[i * 3], m.d[i * 3 + 1], m.d[i * 3 + 2]);
    if (def.projectile) spawnRocket(ch, oi, d, dmg, def); else spawnBullet(ch, oi, d, def, dmg);
  }
}
function netTick(dt) {
  const N = G.net;
  if (!N || NET.role === 'off') return;
  const now = performance.now();
  if (NET.role === 'client') {
    if (G.player && G.player.alive && now - N.sendT > 66) { N.sendT = now; netSend({ t: 'st', s: encodeChar(G.player), relay: false }); }
    return;
  }
  // host: istantanee per ogni giocatore remoto (solo i personaggi vicini, per risparmiare banda)
  if (now - N.snapT > 100) {
    N.snapT = now;
    for (const rc of G.chars) {
      if (!rc.remote || !rc.human || !rc.netId) continue;
      const list = [];
      const far = rc.mode === 'bus' || rc.mode === 'fall' ? 900 : 480;
      for (const c of G.chars) {
        if (c === rc || !c.alive || c.mode === 'bus') continue;
        if (c.human || c.pos.distanceToSquared(rc.pos) < far * far) list.push(encodeChar(c));
      }
      netSendTo(rc.netId, { t: 'snap', c: list, bt: r2(G.bus ? G.bus.t : 0), gt: r2(G.time) });
    }
  }
  if (now - N.stormT > 1000) { N.stormT = now; netSend({ t: 'storm', s: stormState(G.storm) }); }
}
const _nv = new THREE.Vector3();
function onNetMessage(from, m) {
  if (m.t === 'start') { onNetStart(m); return; }
  if (m.t === 'abort') { if (G.state !== 'menu') { toMenu(); menuApi.toast("L'host ha terminato la partita"); } return; }
  if (!G.net || G.state === 'menu') return;
  const C = G.chars;
  const sender = NET.role === 'host' ? G.net.byPeer.get(from) : null;
  G.netForce = true;
  try {
    switch (m.t) {
      case 'st': if (sender && sender.alive) applyCharState(sender, m.s); break;
      case 'snap':
        for (const a of m.c) { const c = C[a[0]]; if (c && c !== G.player && c.alive) applyCharState(c, a); }
        if (G.bus && Math.abs(G.bus.t - m.bt) > 0.4 && G.bus.t < G.bus.dur * 1.3) G.bus.t = m.bt;
        break;
      case 'storm': if (G.storm) Object.assign(G.storm, m.s); break;
      case 'shot': {
        const ch = C[m.i];
        if (!ch || ch === G.player) break;
        remoteShot(ch, m);
        break;
      }
      case 'hit': {   // host: un giocatore ha colpito qualcuno (o si è fatto male da solo)
        if (NET.role !== 'host' || !sender) break;
        const t = C[m.v];
        if (!t) break;
        damage(t, m.amt, m.env ? null : sender, !!m.h, m.w, !!m.ig);
        break;
      }
      case 'hp': {
        const t = C[m.v];
        if (!t || !t.alive) break;
        const att = m.a >= 0 ? C[m.a] : null;
        damage(t, m.amt, att, !!m.h, m.w, true);
        t.hp = m.hp; t.shield = m.sh;
        break;
      }
      case 'hpset': if (sender) { sender.hp = m.hp; sender.shield = m.sh; } break;
      case 'kill': { const t = C[m.v]; if (t && t.alive) kill(t, m.a >= 0 ? C[m.a] : null, m.w); break; }
      case 'loot': {
        if (G.loot.some(L => L.id === m.id)) break;
        spawnLoot(m.it, _nv.set(m.p[0], m.p[1], m.p[2]), !!m.pop, m.id);
        break;
      }
      case 'pick': { const L = G.loot.find(x => x.id === m.id); if (L) removeLoot(L, true); break; }
      case 'chest': { const c = G.chests[m.k]; if (c && !c.opened) openChest(null, c); break; }
      case 'wall': {
        const g = m.g;
        makeWall({ x: m.x, z: m.z, g, alongX: !!m.ax });
        break;
      }
      case 'ev':
        if (m.e === 'left' && NET.role === 'host') {
          // chi esce dalla partita diventa un bot
          const c = G.net.byPeer.get(m.id);
          if (c && c.alive) {
            c.remote = false; c.human = false; c.netId = null; c.ai = makeAI(); c.ai.jumpT = 0;
            c.slots[0] = randomWeapon(); c.active = 0; c.updateHeld();
            const am = WEAPONS[c.slots[0].id].ammo; c.ammo[am] += 60;
            addFeed(`${esc(c.name)} ha lasciato la partita (ora è un bot)`, false);
          }
        }
        break;
    }
  } finally { G.netForce = false; }
}

// ─────────────── Progressi durante la partita (missioni) ───────────────
function progressTick(dt) {
  const p = G.player, S = G.matchStats;
  if (!p || !p.alive || G.state !== 'play') return;
  if (p.hidden) { S.grass += dt; if (S.grass >= 1) { S.grass -= 1; PR.track('grass', 1); } }
  if (p.mode === 'climb') { const dy = p.pos.y - (S.lastY ?? p.pos.y); if (dy > 0) { S.climb += dy; if (S.climb >= 1) { PR.track('climb', Math.floor(S.climb)); S.climb %= 1; } } }
  S.lastY = p.pos.y;
  if (p.mode === 'glide') { S.glide += dt; if (S.glide >= 1) { S.glide -= 1; PR.track('glide', 1); } }
  if (p.mode === 'ground' && p.onGround) {
    S.walk += Math.hypot(p.vel.x, p.vel.z) * dt;
    if (S.walk >= 10) { PR.track('walk', 10); S.walk -= 10; }
  }
  S.surv += dt;
  if (S.surv >= 10) { S.surv = 0; PR.track('survive', Math.floor(G.time)); }
}
/** notifiche in partita (missione completata, livello) */
function hudToast(html) {
  const box = $('#toasts');
  if (!box) return;
  const d = document.createElement('div');
  d.className = 'toast'; d.innerHTML = html;
  box.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}
PR.onProgress(e => {
  if (G.state === 'menu') return;
  if (e.type === 'mission') { hudToast(`✅ Missione completata<small>${esc(e.mission.label)} · +${e.mission.xp} XP</small>`); A.playPickup(); }
  else if (e.type === 'level') hudToast(`⭐ Livello ${e.to} del pass raggiunto!`);
});

// ─────────────── Ciclo principale ───────────────
function update(dt) {
  G.time += dt;
  if (pressed.has('KeyM')) $('#bigmap').classList.toggle('hidden');
  updateBus(dt);
  updatePlayer(dt);
  netTick(dt);
  progressTick(dt);
  for (const c of G.chars) {
    if (!c.isPlayer) { if (c.remote) updatePuppet(c, dt); else updateBot(c, dt); }
    c.hidden = c.alive && c.mode === 'ground' && c.crouch && !c.inWater && tallGrassAt(c.pos.x, c.pos.z);
    if (c.alive) {
      c.fireCd = Math.max(0, c.fireCd - dt);
      if (c.mode !== 'climb' && c.onGround) c.stamina = Math.min(100, c.stamina + dt * 22);
      c.swing = Math.max(0, c.swing - dt);
      if (c.reloading > 0) {
        if (c.active !== c.reloadSlot || !c.weapon) c.reloading = 0;
        else {
          c.reloading -= dt;
          if (c.reloading <= 0) {
            const s = c.weapon, def = WEAPONS[s.id];
            const take = Math.min(def.mag - s.mag, c.ammo[def.ammo]);
            s.mag += take; c.ammo[def.ammo] -= take;
            c.reloading = 0;
          }
        }
      }
      updateUse(c, dt);
    }
    if (c.mode !== 'bus') updateCharVisual(c, dt);
    else if (c.mode !== 'bus') { c.m.root.position.copy(c.pos); c.m.root.rotation.y = c.yaw; }
  }
  updateLoot(dt);
  updateChests(dt);
  updateProjectiles(dt);
  updateBullets(dt);
  updateStorm(dt);
  updateParticles(dt);
  updateEffects(dt);
  for (const cl of clouds) { cl.position.x += dt * 2; if (cl.position.x > 450) cl.position.x = -450; }
  updateCamera(dt);
  updateHUD(dt);
}

const _menuStream = new THREE.Vector3(0, 0, 0);
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(G.state === 'menu' ? _menuStream : camera.position, G.state === 'menu' ? 8 : 5);
  if (G.player && G.player.alive && G.state === 'play') GRASS_PLAYER.value.copy(G.player.pos); else GRASS_PLAYER.value.set(0, -9999, 0);
  if (G.state === 'menu') { renderLobby(dt); pressed.clear(); return; }
  if (!G.paused) update(dt);
  renderer.render(scene, camera);
  pressed.clear();
  mouse.leftPressed = false;
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  lobby.cam.aspect = innerWidth / innerHeight; lobby.cam.updateProjectionMatrix();
});

buildMenu();
$('#loading').classList.add('hidden');
requestAnimationFrame(frame);

// accesso da console per il debug
window.__game = { NET, PR, prepareWorld, beginMatch, tallGrassAt, scene, camera, mouse, spawnBullet, updateBullets, WEAPONS, MODEL_SOURCE, explode, damageBarrel, G, startMatch, update, terrainHeight, groundAt, world, jumpFromBus, keys, pressed, updatePlayer, canStartClimb, damage, startEmote, camera, renderer };
