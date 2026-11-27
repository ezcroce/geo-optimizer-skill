// ═════════════════════════════════════════════════════════════
//  ARENA ROYALE 3D — battle royale in terza persona (Three.js)
// ═════════════════════════════════════════════════════════════
import { EMOTES, poseEmote } from './emotes.js?v=44';
const EMOTE_KEYS = ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus'];   // v39: 6 7 8 9 0 ' (sei balletti)
import * as THREE from 'three';
import {
  RARITIES, WEAPONS, WEAPON_POOL, CONSUMABLES, AMMO_TYPES, SKINS, GLIDERS,
  DIFFICULTY, scaledDifficulty, STORM_PHASES, DUEL_PHASES, BOT_NAMES, HATS, BACKPACKS, MODES, TEAM_MODES, teamSize, MATE_COLORS,
} from './config.js?v=44';
import * as PR from './progress.js?v=44';
import { NET, broadcast as netSend, sendTo as netSendTo } from './net.js?v=44';
import { initMenu } from './menu.js?v=44';
import { createGfx, PRESETS, GFX_DEFAULT } from './gfx.js?v=44';
import { initSettingsUI } from './settings-ui.js?v=44';
import { applyAnisotropy } from './texgen.js?v=19';
import * as A from './audio.js?v=44';
import {
  buildWorld, terrainHeight, groundAt, resolveCollisions, ceilingAt, rayWorld, rayColliders,
  addCollider, removeCollider, HALF, WATER_LEVEL, TOWNS, SCALE, GRASS_PLAYER, tallGrassAt, QUALITY, GRASS_FADE,
  biomeAt, biomeName, BIOME_NAMES, THEME_LABEL, CLIP, mulberry32, queryColliders, rampTop,
} from './world.js?v=44';
import { createWeather } from './weather.js?v=24';
import { createEvents } from './events.js?v=19';
import { buildCharacter, buildWeaponMesh, buildItemMesh, buildGlider, buildBus, RIG } from './character.js?v=44';
import { weaponIcon, cachedWeaponIcon } from './weapons.js?v=44';
import { consIcon, ammoIcon, rocketProjectileGeo } from './items.js?v=44';
import { buildChestMesh } from './models3d.js?v=44';
import { createTouch, IS_TOUCH_DEVICE } from './touch.js?v=44';
import { createInventory } from './inventory.js?v=44';
import { loadModelOverrides, MODEL_SOURCE, PROPS, LEAVES, treeMaterial, bushMaterial, leafMaterial, bushLeafMaterial, rockMaterial, propMaterial, logMaterial, shedMaterial, WIND } from './props.js?v=44';
import { loadRealChars, syncAllReal, loadSkinModel, prioritizeSkins, ALL_SKIN_MODELS, realWarmObject, skinLoadStatus } from './realchar.js?v=44';
import { createStoves } from './stove.js?v=26';
import { resetPose, setLeg, setArm, legsLocomotion, legsAir, legsAirBlend, armsSwing, poseHold, handsToGun, poseClimb, poseMantle, poseSkydive, poseGlide, poseSwim, poseDeath, gaitRate, posePickaxe, poseUse, poseClaws } from './anim.js?v=44';
import { buildPickaxe, heldConsumable } from './held.js?v=44';
import { createBossFight, createClawFX, BOSS_CHANCE } from './bossfight.js?v=44';
import { MOVES as CLAW_MOVES, buildClawGauntlet } from './boss.js?v=44';
import { createCrosshair } from './crosshair.js?v=44';
import { createThrowables, buildThrowMesh, buildPlacedMesh, throwVelocity, THROWABLES, THROW_IDS, THROW_G, THROW_SPEED, FRAG, IMPULSE, PAD, TRAP } from './throwables.js?v=44';
import { skyMaterial, buildCloudGeometry, cloudMaterial, faceClouds } from './sky.js?v=44';

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
const SETTINGS_DEFAULT = () => ({
  name: 'Giocatore', skin: 'recluta', glider: 'classico', difficulty: 'normale', players: 100, sens: 1, vol: 0.5, mode: 'br', team: 'solo', hat: 'none', back: 'none',
  // controlli, audio e interfaccia
  adsSens: 1, invertY: false, fov: 70,
  adsK_pistol: 1, adsK_smg: 1, adsK_shotgun: 1, adsK_ar: 1, adsK_sniper: 1, adsK_rocket: 1,   // v41: zoom in mira per classe d'arma
  crouchHold: false, shake: true, amb: 1, chColor: '#ffffff', chSize: 1, minimap: 'normal',
  touch: 'auto', touchSens: 1, touchSize: 1,
  touchAlpha: 0.9, autoFire: 'on', aimAssist: 'on', haptics: true, touchLayout: {},   // v40
  gfx: { ...GFX_DEFAULT },
});
const FIRST_RUN = !localStorage.getItem('arenaRoyale');
const settings = Object.assign(SETTINGS_DEFAULT(), JSON.parse(localStorage.getItem('arenaRoyale') || '{}'));
// primo avvio su telefono/tablet: grafica leggera (si può cambiare nelle impostazioni)
if (FIRST_RUN && IS_TOUCH_DEVICE) settings.gfx = { ...GFX_DEFAULT, preset: 'basso', ...PRESETS.basso, fpsCap: 60 };
settings.gfx = { ...GFX_DEFAULT, ...(settings.gfx || {}) };
// oggetti equipaggiati ma non (più) posseduti → torna a quelli base
if (!PR.owns('skin', settings.skin)) settings.skin = 'recluta';
if (!PR.owns('glider', settings.glider)) settings.glider = 'classico';
if (!PR.owns('hat', settings.hat)) settings.hat = 'none';
if (!PR.owns('back', settings.back)) settings.back = 'none';
if (!MODES.some(m => m.id === settings.mode)) settings.mode = 'br';
if (typeof settings.vs !== 'boolean') settings.vs = false;
if (!TEAM_MODES.some(m => m.id === settings.team)) settings.team = 'solo';
function saveSettings() { localStorage.setItem('arenaRoyale', JSON.stringify(settings)); }

// ─────────────── Renderer & scena ───────────────
const canvas = $('#game');
// l'anti-aliasing è fatto nel post-processing (MSAA nel render target, FXAA o SMAA)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.onBeforeRender = syncAllReal;   // v25: posa dei personaggi realistici prima di ogni render
scene.fog = new THREE.Fog('#c9e3f8', 190, 720);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2600);

const hemi = new THREE.HemisphereLight('#d6ebff', '#5f6a3c', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffeccc', 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(70, 130, 45);
// v42: assi della camera delle ombre (guarda lungo -SUN_OFF con l'alto = +Y) per agganciare il centro ai texel
const SUN_AZ = SUN_OFF.clone().normalize(), SUN_AX = new THREE.Vector3(0, 1, 0).cross(SUN_AZ).normalize(), SUN_AY = SUN_AZ.clone().cross(SUN_AX), _sunF = new THREE.Vector3();
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
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), skyMaterial(SUN_OFF));   // v37: cielo a fasce con striature (pixel art in 3D)
sky.renderOrder = -1;
scene.add(sky);
// meteo e atmosfera: nebbia d'altezza, montagne all'orizzonte, neve/foglie/polvere locali
const weather = createWeather(scene, { biomeAt, terrainHeight });
const SUN_BASE = new THREE.Color('#ffeccc'), SUN_GOLD = new THREE.Color('#ffb84a');
// riflessi ambientali dal cielo (metalli, vetri, acqua): mappa d'ambiente prefiltrata una volta sola
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), gradientMaterial('#2f72d2', '#cfe6fb')));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 24), new THREE.MeshBasicMaterial({ color: '#56653a' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -8;
  envScene.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02, 0.1, 400).texture;
  scene.environmentIntensity = 0.22;
  pm.dispose();
}
hemi.intensity = 1.02;
renderer.info.autoReset = false;   // con il post-processing si contano tutti i passaggi del frame
const gfx = createGfx(renderer, scene, camera, sun);

// Nuvole
// v37: nuvole a sbuffi con i riccioli (come quelle disegnate a pixel, ma in 3D): una geometria per nuvola,
// 8 forme diverse condivise, ognuna si gira verso la camera
const clouds = [];
{
  const cm = cloudMaterial();
  const shapes = Array.from({ length: 8 }, () => buildCloudGeometry(Math.random, rand(80, 130)));
  for (let i = 0; i < 30; i++) {
    const g = new THREE.Mesh(shapes[i % shapes.length], cm);
    g.position.set(rand(-900, 900), rand(180, 260), rand(-900, 900));
    g.scale.setScalar(rand(1, 1.6));
    g.frustumCulled = true;
    scene.add(g);
    clouds.push(g);
  }
}

// Mondo
// se in models/ ci sono i file .glb originali vengono caricati prima di costruire il mondo
const LD = (f, t) => { try { window.LOADING && window.LOADING.set(f, t); } catch { /* schermata assente */ } };   // v40
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
LD(0.62, 'Caricamento dei personaggi…');
const [loadedModels] = await Promise.all([loadModelOverrides('models/'), loadRealChars('models/chars/', [settings.skin])]);   // v25/v26: personaggi realistici (quello del giocatore subito)
if (loadedModels.length) console.info('Modelli GLB caricati:', loadedModels.join(', '));
LD(0.74, "Costruzione dell'isola…");
await nextPaint();
let world = buildWorld(scene, { seed: 1337, random: false });
LD(0.93, 'Ultimi ritocchi…');
let stoves = createStoves(scene, world);   // v26: stufe a legna delle casette
/** ricostruisce l'isola (Random Map: un seme nuovo a ogni partita) */
async function prepareWorld(seed, random) {
  if (world.seed === seed && world.random === random) return false;
  const ld = $('#loading');
  ld.classList.remove('hidden');
  LD(0.18, random ? "Generazione di un'isola casuale…" : "Caricamento dell'isola…");
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 380)));   // v40: il tempo di far vedere la schermata
  for (const c of G.chests) if (c.mesh) scene.remove(c.mesh);
  G.chests = [];
  world.dispose();
  stoves.dispose();
  world = buildWorld(scene, { seed, random });
  stoves = createStoves(scene, world);
  for (const cs of world.chestSpots) G.chests.push({ pos: cs.pos.clone(), rot: cs.rot, mesh: null, lid: null, opened: false, t: 0 });
  window.__game && (window.__game.world = world);
  LD(1, 'Pronti al lancio!');
  await new Promise(r => setTimeout(r, 250));
  ld.classList.add('hidden');
  return true;
}
/** v40: schermata di caricamento breve prima del bus quando l'isola è già pronta (si scaldano i personaggi) */
async function matchIntro() {
  const ld = $('#loading');
  ld.classList.remove('hidden');
  LD(0.35, 'Il bus della battaglia sta partendo…');
  await new Promise(r => setTimeout(r, 500));
  LD(1, 'Pronti al lancio!');
  await new Promise(r => setTimeout(r, 700));
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
function emit(pos, color, n = 6, speed = 4, life = 0.5, size = 0.12, g = 1, hdr = 1) {
  _col.set(color); if (hdr !== 1) _col.multiplyScalar(hdr);   // v42: hdr > 1 → scintille che col bloom brillano
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
// v42: lampo dei colpi critici (in HDR, sommato: col bloom fa un piccolo bagliore dorato)
const crits = [];
{
  const cg = new THREE.IcosahedronGeometry(0.16, 1);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.6, 2.2), transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.visible = false; m.renderOrder = 5; scene.add(m);
    crits.push({ m, life: 0 });
  }
}
let cIdx = 0;
function critFlash(pos) {
  const f = crits[cIdx = (cIdx + 1) % crits.length];
  f.m.position.copy(pos); f.life = 0.16; f.m.visible = true;
  emit(pos, '#ffe28a', 7, 4.5, 0.25, 0.05, 0.1);
  if (pos.distanceTo(camera.position) < 60) gfx.kick(0.55);
}
function updateEffects(dt) {
  for (const f of crits) if (f.life > 0) {
    f.life -= dt; const k = 1 - f.life / 0.16;
    f.m.scale.setScalar(0.6 + k * 2.2); f.m.material.opacity = (1 - k) ** 1.5;
    if (f.life <= 0) f.m.visible = false;
  }
  for (const t of tracers) if (t.life > 0) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max) * t.op; if (t.life <= 0) t.m.visible = false; }
  for (const f of flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.m.visible = false; }
  for (const b of booms) if (b.life > 0) {
    b.life -= dt;
    const k = 1 - b.life / 0.55;
    b.m.scale.setScalar(b.r * (0.3 + k * 1.1));
    b.m.material.opacity = Math.max(0, 1 - k) * 0.9;
    if (b.blue) b.m.material.color.setHSL(0.55, 1, 0.65 - k * 0.2); else b.m.material.color.setHSL(0.08 - k * 0.06, 1, 0.6 - k * 0.3);
    b.m.material.color.multiplyScalar(1 + 5 * (1 - k) ** 3);   // v42: palla di fuoco in HDR: col bloom brilla davvero
    if (b.life <= 0) { b.m.visible = false; b.blue = false; }
  }
  if (flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 200);
  if (G.flashBlueT > 0 && (G.flashBlueT -= dt) <= 0) flashLight.color.set('#ffb050');
}

// ─────────────── Stato di gioco ───────────────
const G = {
  state: 'menu', paused: false, time: 0,
  chars: [], player: null, loot: [], chests: [], projectiles: [], bullets: [], walls: [],
  storm: null, bus: null, diff: scaledDifficulty('normale'),
  camYaw: 0, camPitch: 0, camDist: 4.2, fov: 70, shake: 0,
  ads: false, build: { on: false }, spectate: null, endShown: false,
  dmgNums: [], killfeed: [], msgT: 0, hitT: 0, hurtT: 0, placement: 0,
  mode: 'br', net: null, netForce: false, lootSeq: 0, lootPrefix: '', lootInit: false, matchStats: { chests: 0 },
};

const SLOT_COUNT = 5;
const GRAVITY = 22;
const JUMP_V = 7.8;
const JUMP_STAMINA = 7;   // v42
const CHAR_R = 0.4, CHAR_H = 1.85;
const BODY = [[0.45, 0.33], [0.95, 0.36], [1.35, 0.36]];

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
    this.throws = { frag: 0, smoke: 0, impulse: 0, pad: 0, trap: 0 }; this.throwSel = 'frag'; this.throwCd = 0; this.throwAnim = 0;   // v41
    this.st = { shots: 0, hits: 0, heads: 0, healed: 0, built: 0, dist: 0, taken: 0, maxKillD: 0 };   // v41: statistiche
    this.crouch = false; this.crouchK = 0;           // abbassarsi
    this.stamina = 100; this.climbDir = new THREE.Vector3(); this.climbPhase = 0; this.mantle = null; // arrampicata
    this.equipT = 0; this.landT = 0;                  // animazioni
    this.slide = null; this.slideCd = 0; this.slideK = 0; this.vault = null; this.hopN = 0; this.landAt = -9;   // v42: scivolata, scavalco, salti di fila
    this.m.root.visible = false;
    this.updateHeld();
  }
  get slot() { return this.slots[this.active]; }
  get weapon() { const s = this.slot; return s && s.kind === 'weapon' ? s : null; }
  get hScale() { return Math.min(1 - 0.27 * this.crouchK, 1 - 0.42 * this.slideK); }   // v42: in scivolata la sagoma è bassa
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.35 * this.hScale, this.pos.z); }
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.65 * this.hScale, this.pos.z); }
  updateHeld() {
    const s = this.slot;
    const key = s ? (s.kind === 'weapon' ? `w${s.id}${s.rarity}` : `c${s.id}`) : 'pick';
    if (key === this.heldKey) return;
    this.heldKey = key;
    const gp = this.m.gunPivot;
    while (gp.children.length) gp.remove(gp.children[0]);
    if (this._claws) { for (const g of this._claws) if (g.parent) g.parent.remove(g); this._claws = null; this.m._clawG = null; }
    this.claw = null; this.clawQueue = null; this.pushX = this.pushZ = 0;
    let mesh;
    if (!s) mesh = buildPickaxe(this.skin.accColor || '#7fd0ff');
    else if (s.kind === 'weapon' && WEAPONS[s.id] && WEAPONS[s.id].melee) {
      // v38: Artigli del Gargoyle: un guanto per mano (le lame proseguono oltre le nocche)
      mesh = new THREE.Group();
      this._claws = [0, 1].map(i => { const g = buildClawGauntlet(); g.rotation.set(Math.PI / 2, 0, 0); g.position.y = -0.02; g.scale.setScalar(0.82); this.m.hands[i].add(g); return g; });
      this.m._clawG = this._claws;   // v41: realchar.js li tiene attaccati al polso del modello vero
    }
    else if (s.kind === 'weapon') mesh = buildWeaponMesh(s.id, s.rarity);
    else mesh = heldConsumable(s.id);
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
const CLIMB_SPEED = 2.7;   // v21: arrampicata più lenta e faticosa
const _co = new THREE.Vector3(), _cd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** Cerca una superficie arrampicabile davanti al personaggio */
function wallAhead(ch, dir, height = 1.0, reach = CHAR_R + 0.45) {
  _co.set(ch.pos.x, ch.pos.y + height, ch.pos.z);
  const h = rayColliders(_co, dir, reach);
  if (!h || h.collider.tree || h.collider.type === 'ramp') return null;   // v41: sulle rampe si cammina
  return h;
}
/** Direzione "verso il muro" allineata alla faccia colpita */
function wallDir(ch, hit, dir) {
  const c = hit.collider;
  if (c.type === 'cyl') return _cd.set(c.x - ch.pos.x, 0, c.z - ch.pos.z).normalize();
  if (c.type === 'ring') { const k = Math.hypot(ch.pos.x - c.x, ch.pos.z - c.z) > c.r1 ? 1 : -1; return _cd.set((c.x - ch.pos.x) * k, 0, (c.z - ch.pos.z) * k).normalize(); }
  const px = ch.pos.x + dir.x * hit.t, pz = ch.pos.z + dir.z * hit.t;
  const e = [Math.abs(px - c.minX), Math.abs(px - c.maxX), Math.abs(pz - c.minZ), Math.abs(pz - c.maxZ)];
  const m = Math.min(...e);
  if (m === e[0]) return _cd.set(1, 0, 0);
  if (m === e[1]) return _cd.set(-1, 0, 0);
  if (m === e[2]) return _cd.set(0, 0, 1);
  return _cd.set(0, 0, -1);
}
function canStartClimb(ch, dir) {
  if (ch.stamina < 28 || ch.mode !== 'ground' || ch.using) return null;
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
  ch.stamina -= dt * (dir > 0 ? 17 : dir < 0 ? 9 : 7);
  ch.tireT = 1.2;
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

// ─────────────── v42: scavalco automatico e scivolata ───────────────
const _vq = new THREE.Vector3(), _vt = new THREE.Vector3();
/**
 * Scavalca (o sale sopra) un ostacolo basso davanti: muretti, staccionate, casse, gradoni del Colosseo.
 * maxRel = quanto può essere alto il bordo sopra i piedi (in corsa 1,25 m, con SPAZIO 1,75 m, in volo 2,3 m).
 * Se dietro il bordo c'è il vuoto (muro sottile) lo supera e ricade dall'altra parte mantenendo lo slancio.
 */
function tryVault(ch, dir, maxRel) {
  if (ch.vault || ch.mode !== 'ground' || ch.inWater || ch.using) return false;
  let hit = null;
  for (const h of [0.35, 0.8, 1.3]) {
    if (h > maxRel + 0.1) break;
    _co.set(ch.pos.x, ch.pos.y + h, ch.pos.z);
    const r = rayColliders(_co, dir, CHAR_R + 0.6);
    if (r) { if (r.collider.tree || r.collider.type === 'ramp' || r.collider.noStand) return false; hit = r; break; }
  }
  if (!hit) return false;
  const t = hit.t;
  const px = ch.pos.x + dir.x * (t + 0.3), pz = ch.pos.z + dir.z * (t + 0.3);
  const top = groundAt(px, pz, ch.pos.y + maxRel + 0.05, 0.1);
  const rel = top - ch.pos.y;
  if (rel < 0.45 || rel > maxRel) return false;
  // sopra il bordo deve esserci spazio per passare (niente finestre basse o soffitti)
  _co.set(px, top + 0.05, pz);
  if (rayColliders(_co, _up, 1.25)) return false;
  _co.set(ch.pos.x, top + 0.3, ch.pos.z);
  if (rayColliders(_co, dir, t + 0.55)) return false;
  // muro sottile (dietro c'è il vuoto) o ripiano su cui salire?
  const qx = ch.pos.x + dir.x * (t + 1.05), qz = ch.pos.z + dir.z * (t + 1.05);
  const beyond = groundAt(qx, qz, top + 0.3, 0.1);
  const over = beyond < top - 0.5 && rel < 1.6;
  if (over) { _co.set(px, top + 0.3, pz); if (rayColliders(_co, dir, 1.0)) return false; }
  const to = over ? new THREE.Vector3(qx + dir.x * 0.15, top + 0.12, qz + dir.z * 0.15) : new THREE.Vector3(px + dir.x * 0.2, top, pz + dir.z * 0.2);
  // il punto d'arrivo dev'essere libero
  _vt.copy(to); resolveCollisions(_vt, CHAR_R, CHAR_H);
  if (Math.hypot(_vt.x - to.x, _vt.z - to.z) > 0.2) return false;
  if (!over && ceilingAt(to.x, to.z, to.y, CHAR_H, CHAR_R) < to.y + CHAR_H) return false;
  const sp = Math.max(ch.moveAmt, 3.5);
  ch.vault = { t: 0, dur: (0.2 + rel * 0.16) * (ch.onGround ? 1 : 1.15), from: ch.pos.clone(), to, over, top, sp: over ? Math.max(sp, 4.8) : sp, dx: dir.x, dz: dir.z, side: Math.random() < 0.5 ? -1 : 1 };
  ch.slide = null; ch.crouch = false; ch.emote = null; ch.vel.set(0, 0, 0);
  ch.stamina = Math.max(0, ch.stamina - 4); ch.tireT = Math.max(ch.tireT || 0, 0.3);
  ch.yaw = ch.isPlayer ? ch.yaw : Math.atan2(dir.x, dir.z);
  const d = ch.pos.distanceTo(camera.position);
  if (d < 35) A.playVault(ch.isPlayer ? 0 : d);
  if (ch.isPlayer) { G.matchStats.vaults = (G.matchStats.vaults || 0) + 1; touch.buzz(8); }
  return true;
}
function updateVault(ch, dt) {
  const V = ch.vault;
  V.t = Math.min(1, V.t + dt / V.dur);
  const k = V.t, peak = Math.max(V.from.y, V.top) + 0.2;
  // sale in fretta fino al bordo, passa sopra, poi scende (o si appoggia) dall'altra parte
  ch.pos.y = k < 0.5 ? lerp(V.from.y, peak, 1 - Math.pow(1 - k / 0.5, 2)) : lerp(peak, V.to.y, Math.pow((k - 0.5) / 0.5, 2));
  const kx = smooth01(clamp((k - 0.12) / 0.88, 0, 1));
  ch.pos.x = lerp(V.from.x, V.to.x, kx); ch.pos.z = lerp(V.from.z, V.to.z, kx);
  ch.moveAmt = V.sp; ch.onGround = true;
  ch.vel.set(V.dx * V.sp, 0, V.dz * V.sp);
  if (k >= 1) {
    ch.vault = null; ch.pos.copy(V.to);
    if (V.over) { ch.vel.set(V.dx * V.sp, 0.5, V.dz * V.sp); ch.onGround = false; }
    else { ch.vel.set(V.dx * V.sp * 0.7, 0, V.dz * V.sp * 0.7); ch.onGround = true; ch.landAt = G.time; }
    ch.landT = 0.12;
  }
}
/** v42: scivolata: si parte correndo (premendo C), si abbassa la sagoma e si mantiene lo slancio; in discesa accelera */
const SLIDE = { minSpeed: 6.0, boost: 2.4, max: 13, friction: 5.2, cd: 0.9, stamina: 12 };
function canSlide(ch) {
  return ch.mode === 'ground' && ch.onGround && !ch.inWater && !ch.vault && !ch.slide && !ch.using && ch.moveAmt > SLIDE.minSpeed && G.time > ch.slideCd && ch.stamina >= SLIDE.stamina * 0.6;
}
function startSlide(ch) {
  const sp = Math.hypot(ch.vel.x, ch.vel.z) || 1;
  ch.slide = { t: 0, dx: ch.vel.x / sp, dz: ch.vel.z / sp, sp: Math.min(SLIDE.max, Math.max(sp + SLIDE.boost, 9.4)), air: 0 };
  ch.crouch = false; ch.emote = null; ch.reloading = ch.reloading;   // si può ricaricare scivolando
  ch.stamina = Math.max(0, ch.stamina - SLIDE.stamina); ch.tireT = Math.max(ch.tireT || 0, 0.6);
  const d = ch.pos.distanceTo(camera.position);
  if (d < 40) A.playSlide(surfaceUnder(ch), ch.isPlayer ? 0 : d);
  if (ch.isPlayer) { G.matchStats.slides = (G.matchStats.slides || 0) + 1; touch.buzz(12); }
}
function endSlide(ch, crouch = false) {
  ch.slide = null; ch.slideCd = G.time + SLIDE.cd;
  ch.crouch = crouch;
}
/** un passo della scivolata; ritorna false se è finita (il movimento normale riprende) */
function updateSlide(ch, dt, sx, sz, jump) {
  const S = ch.slide;
  S.t += dt;
  // pendenza nella direzione della scivolata: in discesa accelera, in salita frena subito
  terrainGrad(ch.pos.x, ch.pos.z, _tg);
  const onTerrain = ch.pos.y - terrainHeight(ch.pos.x, ch.pos.z) < 0.35;
  const down = onTerrain ? -(_tg[0] * S.dx + _tg[1] * S.dz) : 0;
  S.sp = Math.min(SLIDE.max, S.sp + (down * 15 - SLIDE.friction * (S.t > 0.25 ? 1 : 0.4)) * dt);
  // si può curvare appena
  const sl = Math.hypot(sx, sz);
  if (sl > 0.1) {
    const k = Math.min(1, dt * 1.6);
    S.dx += (sx / sl - S.dx) * k; S.dz += (sz / sl - S.dz) * k;
    const l = Math.hypot(S.dx, S.dz) || 1; S.dx /= l; S.dz /= l;
  }
  S.air = ch.onGround ? 0 : S.air + dt;
  if (jump && ch.onGround) {   // salto in scivolata: si conserva lo slancio
    const sp = S.sp;
    endSlide(ch);
    groundMove(ch, S.dx, S.dz, sp, dt, true);
    ch.vel.x = S.dx * sp; ch.vel.z = S.dz * sp;
    return true;
  }
  if (S.sp < 3.8 || (S.t > 1.7 && down < 0.12) || S.air > 0.35 || ch.inWater) return false;
  groundMove(ch, S.dx, S.dz, S.sp, dt, false);
  // contro un muro si ferma
  if (S.t > 0.12 && ch.moveAmt < S.sp * 0.45) S.sp = Math.max(0, ch.moveAmt);
  // polvere (o spruzzi) dai piedi
  if (ch.pos.distanceToSquared(camera.position) < 50 * 50 && Math.random() < dt * 30) {
    const surf = surfaceUnder(ch), col = { snow: '#f2f6fa', sand: '#e0c890', stone: '#c9c2b4', wood: '#a88458', water: '#d8f0ff' }[surf] || '#a8946a';
    emit(_p.set(ch.pos.x - S.dx * 0.3 + rand(-0.2, 0.2), ch.pos.y + 0.08, ch.pos.z - S.dz * 0.3 + rand(-0.2, 0.2)), col, 1, 1.6, 0.45, 0.16, 0.25);
  }
  return true;
}

function muzzlePos(ch, out = new THREE.Vector3()) {
  const s = ch.weapon;
  const z = s ? WEAPONS[s.id].muzzle : 0.6;
  const g = ch.m.gunPivot.children[0], sc = g ? g.scale.z : 1;   // v29: le armi in mano sono in scala
  ch.m.root.updateMatrixWorld();
  return ch.m.gunPivot.localToWorld(out.set(0, 0.02 * sc, z * sc));
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
const SLOPE_SLIDE = 1.15;   // tan ≈ 49°: oltre si scivola
function terrainGrad(x, z, out) {
  const e = 0.7;
  out[0] = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  out[1] = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  return out;
}
const _tg = [0, 0];
function groundMove(ch, mx, mz, speed, dt, jump) {
  if (ch.vault) { updateVault(ch, dt); return; }   // v42: scavalco in corso
  const prevY = ch.pos.y;
  // ── pendii di montagna: in salita si rallenta e ci si stanca, oltre ~45° non si sale e oltre ~49° si scivola ──
  let sx = 0, sz = 0;
  ch.steepT = Math.max(0, (ch.steepT || 0) - dt);
  if (ch.mode === 'ground' && !ch.inWater && (ch.onGround || ch.steepT > 0)) {
    const x = ch.pos.x, z = ch.pos.z;
    if (ch.pos.y - terrainHeight(x, z) < 0.35) {
      terrainGrad(x, z, _tg);
      const gx = _tg[0], gz = _tg[1], gl = Math.hypot(gx, gz);
      ch.slope = gl;
      const ml = Math.hypot(mx, mz);
      const human = ch.isPlayer || ch.human;
      if (ml > 0.01 && gl > 0.28) {
        const up = (mx * gx + mz * gz) / ml;          // pendenza nella direzione di marcia
        if (up > 0.28) {
          speed *= clamp(1.16 - up * 0.62, 0.3, 1);
          ch.stamina = Math.max(0, ch.stamina - dt * up * (speed > 5.5 ? 13 : 6.5));
          ch.tireT = 0.9;
          if (ch.stamina < 6) speed *= 0.5;
          const lim = human ? 1.0 : 1.4;
          if (up > lim) {
            const k = (mx * gx + mz * gz) / (gl * gl);   // toglie la componente in salita
            mx -= gx * k; mz -= gz * k;
            ch.steepT = 0.6; jump = false;
          }
        }
      }
      if (gl > SLOPE_SLIDE && ch.onGround) {
        const k = Math.min(1, (gl - SLOPE_SLIDE) * 1.6) * 6.5 / gl;
        sx = -gx * k; sz = -gz * k; jump = false;
        if (ch.isPlayer && Math.random() < dt * 6) emit(_p.set(ch.pos.x, ch.pos.y + 0.05, ch.pos.z), '#b9b2a2', 1, 1.2, 0.45, 0.12, 0.3);
      }
    }
  }
  // ── nuoto: inerzia, galleggiamento, bracciate lente, niente salti in acqua alta ──
  const swimY = WATER_LEVEL - 1.25;
  let acc = ch.onGround ? 14 : ch.impulseFly ? 0.7 : 3;   // v41: spinti dall'impulso si vola davvero
  if (ch.inWater) {
    acc = 2.4;
    const raw = groundAt(ch.pos.x, ch.pos.z, ch.pos.y + 0.5);
    if (jump && raw < swimY - 0.35) jump = false;   // non si salta fuori dall'acqua alta
  }
  ch.vel.x += (mx * speed + sx - ch.vel.x) * Math.min(1, acc * dt);
  ch.vel.z += (mz * speed + sz - ch.vel.z) * Math.min(1, acc * dt);
  ch.pos.x += (ch.vel.x + (ch.pushX || 0)) * dt;   // v38: push = scatto delle mosse degli Artigli
  ch.pos.z += (ch.vel.z + (ch.pushZ || 0)) * dt;
  resolveCollisions(ch.pos, CHAR_R, CHAR_H);
  const lim = HALF - 4;
  ch.pos.x = clamp(ch.pos.x, -lim, lim);
  ch.pos.z = clamp(ch.pos.z, -lim, lim);
  if (jump && ch.onGround) {
    // v42: contro lo "spam di salto": ogni salto costa resistenza e i salti a ripetizione (entro mezzo secondo
    //  dall'atterraggio) sono sempre più bassi; la mira resta imprecisa in volo e appena atterrati (currentSpread)
    const hop = G.time - ch.landAt < 0.5 ? Math.min(3, ch.hopN + 1) : 0;
    ch.hopN = hop;
    let jk = [1, 0.9, 0.8, 0.72][hop];
    if (ch.stamina < JUMP_STAMINA) jk *= 0.8;
    ch.stamina = Math.max(0, ch.stamina - JUMP_STAMINA * (1 + hop * 0.5)); ch.tireT = Math.max(ch.tireT || 0, 0.45);
    ch.vel.y = JUMP_V * jk; ch.onGround = false;
    // v41: per l'animazione del salto: gamba che stacca e quanta rincorsa c'era
    ch.jumpLead = Math.sin(ch.walkPhase || 0) > 0 ? 0 : 1; ch.jumpRun = clamp(Math.hypot(ch.vel.x, ch.vel.z) / 5.5, 0, 1); ch.jumpT = 0;
  }
  ch.vel.y -= GRAVITY * (G.gravK ?? 1) * dt;
  ch.pos.y += ch.vel.y * dt;
  // v41: soffitto: saltando si sbatte la testa e si ricade (prima si veniva spinti fuori dai muri)
  if (ch.vel.y > 0) {
    const cy = ceilingAt(ch.pos.x, ch.pos.z, prevY, CHAR_H, CHAR_R);
    if (ch.pos.y + CHAR_H > cy) { ch.pos.y = Math.max(prevY, cy - CHAR_H); ch.vel.y = 0; }
  }
  let g = groundAt(ch.pos.x, ch.pos.z, Math.max(prevY, ch.pos.y));
  const wasWater = ch.inWater;
  ch.inWater = g < swimY + 0.05;
  if (ch.inWater) {
    // galleggia: dondola sulle onde e affonda un po' quando nuota veloce
    ch.swimPh = (ch.swimPh ?? Math.random() * 6) + dt * (1.6 + ch.moveAmt * 0.25);
    g = swimY + Math.sin(ch.swimPh * 1.3) * 0.06 + (ch.swimK || 0) * 0.32;   // a stile libero il corpo sale in superficie
    if (!wasWater && ch.vel.y < -3) splashFx(ch, ch.vel.y);
  }
  if (ch.pos.y <= g) {
    if (!ch.onGround && ch.vel.y < -7 && !ch.inWater) landFx(ch, ch.vel.y);
    // v27: danni da caduta (oltre ~4 m; in acqua o col deltaplano non ci si fa male)
    if (!ch.onGround && !ch.inWater && ch.vel.y < -FALL_SAFE_VY && ch.alive && !ch.impulseFly) fallDamage(ch, -ch.vel.y);
    if (!ch.onGround) ch.landAt = G.time;   // v42: per la precisione dopo l'atterraggio e i salti di fila
    ch.pos.y = g; ch.vel.y = 0; ch.onGround = true; ch.impulseFly = false;
  }
  else if (ch.onGround && ch.vel.y <= 0 && ch.pos.y - g < 0.7) { ch.pos.y = g; ch.vel.y = 0; }
  else ch.onGround = false;
  ch.moveAmt = Math.hypot(ch.vel.x, ch.vel.z);
  if (ch.inWater) swimFx(ch, dt);
}

// ── acqua: anelli che si allargano sulla superficie, schizzi e suoni delle bracciate ──
const rippleGeo = new THREE.RingGeometry(0.93, 1, 32).rotateX(-Math.PI / 2);
const ripples = [];
function addRipple(x, z, size = 1, life = 1.4, op = 0.4) {
  let r = ripples.find(q => !q.mesh.visible);
  if (!r) {
    if (ripples.length >= 40) return;
    const mat = new THREE.MeshBasicMaterial({ color: '#eaf7ff', transparent: true, opacity: 0, depthWrite: false, fog: true });
    r = { mesh: new THREE.Mesh(rippleGeo, mat) };
    r.mesh.renderOrder = 2; scene.add(r.mesh); ripples.push(r);
  }
  r.mesh.visible = true; r.mesh.position.set(x, WATER_LEVEL + 0.03, z);
  r.t = 0; r.life = life; r.size = size; r.op = op;
}
function updateRipples(dt) {
  for (const r of ripples) {
    if (!r.mesh.visible) continue;
    r.t += dt;
    const k = r.t / r.life;
    if (k >= 1) { r.mesh.visible = false; continue; }
    const s = r.size * (0.3 + k * 1.5);
    r.mesh.scale.set(s, 1, s);
    r.mesh.material.opacity = r.op * (1 - k) * Math.min(1, k * 6);
  }
}
function splashFx(ch, vy) {
  const near = ch.pos.distanceToSquared(camera.position) < 70 * 70;
  if (!near) return;
  const k = Math.min(1.6, -vy / 12);
  emit(_p.set(ch.pos.x, WATER_LEVEL + 0.1, ch.pos.z), '#e4f6ff', Math.round(10 + k * 10), 4 + k * 2, 0.8, 0.14, 1);
  addRipple(ch.pos.x, ch.pos.z, 1.2 + k, 1.6, 0.55); addRipple(ch.pos.x, ch.pos.z, 0.7 + k * 0.5, 1.1, 0.5);
  A.playSplash(ch.isPlayer ? 1 : 0.5 * Math.max(0, 1 - ch.pos.distanceTo(camera.position) / 70));
}
function swimFx(ch, dt) {
  if (ch.pos.distanceToSquared(camera.position) > 60 * 60) return;
  ch.rippleT = (ch.rippleT ?? 0) - dt;
  if (ch.rippleT > 0) return;
  const moving = ch.moveAmt > 0.6;
  ch.rippleT = moving ? 0.42 : 1.1;
  // scia: anelli dietro al nuotatore, schizzi delle bracciate
  addRipple(ch.pos.x - ch.vel.x * 0.12, ch.pos.z - ch.vel.z * 0.12, moving ? 0.8 : 0.55, moving ? 1.3 : 1.8, moving ? 0.18 : 0.12);
  if (moving) {
    const fx = Math.sin(ch.yaw), fz = Math.cos(ch.yaw), side = (ch._swSide = -(ch._swSide || 1));
    emit(_p.set(ch.pos.x + fx * 0.6 - fz * 0.35 * side, WATER_LEVEL + 0.08, ch.pos.z + fz * 0.6 + fx * 0.35 * side), '#e8f7ff', 4, 1.8, 0.45, 0.08, 1);
    if (ch.isPlayer) A.playSwim();
  }
}

const FALL_SAFE_VY = 13;          // ≈ 3,8 m di caduta libera (g = 22)
function fallDamage(ch, vy) {
  const amt = Math.round((vy - FALL_SAFE_VY) * 4.5);   // 6 m ≈ 15, 10 m ≈ 37, 25 m ≈ 90
  if (amt < 1) return;
  ch.landT = 0.35;
  if (ch.isPlayer) {
    A.playHurt();
    G.shake = Math.max(G.shake || 0, Math.min(0.6, amt / 60));
    if (ch.hp - amt > 0) showMsg('', `Caduta: -${amt} PV`, 1.2);
  }
  damage(ch, amt, null, false, 'fall', true);
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
    const padUp = G.time - (ch.padAt ?? -9) < 3 && ch.vel.y > -3;   // v42: lanciati dal trampolino: il deltaplano si apre dopo il punto più alto
    if (!padUp && (ch.pos.y - gh < 45 || (deploy && ch.pos.y - gh < 115))) {
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
// v39: i balletti (coreografie a fotogrammi chiave) stanno in emotes.js
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
  const e = ch.emote, T = ch.emoteT, k = smooth01(T * 3.2) * smooth01((e.dur - T) * 3.2); // dissolvenza in entrata/uscita
  m.gunPivot.visible = false;
  // si gira verso la telecamera per farsi vedere
  if (ch.isPlayer) { ch.emoteYaw = ch.emoteYaw === undefined ? ch.yaw : ch.emoteYaw; m.root.rotation.y = ch.yaw + Math.PI * easeInOut(Math.min(1, T * 2.5)); }
  const b = poseEmote(m, e.id, T, k);
  if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 0.15 + Math.abs(Math.sin(b * Math.PI)) * 0.3, Math.min(1, dt * 6));
}

/** vicino: modello completo animato · lontano: modello semplificato · oltre la nebbia: nascosto */
/** sbattere le palpebre: ogni 2–5 s, per 0,12 s (gli occhi restano chiusi da morti) */
function blink(c, dt) {
  const L = c.m.lids;
  if (!L) return;
  if (!c.alive) { L.visible = true; return; }
  c.blinkT = (c.blinkT ?? Math.random() * 4) - dt;
  if (c.blinkT < 0) { L.visible = c.blinkT > -0.12; if (c.blinkT <= -0.12) c.blinkT = 2 + Math.random() * 3; }
  else L.visible = false;
}
// ─────────────── v43: prestazioni dei personaggi ───────────────
//  Con 100 giocatori i personaggi erano più di metà delle draw call (ognuno ~100 pezzi, disegnati due volte:
//  scena e ombre, anche quelli alle spalle). Ora: fuori dall'inquadratura non si disegnano e si animano di rado;
//  oltre PERF.charShadow non fanno ombra; i pezzettini (bottoni, fibbie, maniglie del piccone…) spariscono oltre
//  PERF.smallNear; da PERF.anim2/anim3 m la posa si aggiorna a frame alterni (1 su 2 / 1 su 3).
const PERF = { charFull: 80, charShadow: 26, smallNear: 22, anim2: 28, anim3: 55, lootFull: 45, lootShadow: 22, botFar2: 140, botFar3: 280 };
const _frus = new THREE.Frustum(), _frusM = new THREE.Matrix4(), _frusS = new THREE.Sphere(), _ws = new THREE.Vector3();
let frameN = 0;
function perfFrame() {
  frameN++;
  camera.updateMatrixWorld();
  _frusM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frus.setFromProjectionMatrix(_frusM);
}
/** elenco (rinfrescato ogni 2–3 s) dei pezzi di un personaggio: tutti, e quelli piccoli (< 7 cm) */
function charParts(c) {
  const m = c.m;
  if (m._pp && G.time < m._ppT) return m._pp;
  const all = [], small = [];
  m.root.traverse(o => {
    if (!o.isMesh || o === m.lod) return;
    if (o.userData._cs === undefined) o.userData._cs = o.castShadow;
    all.push(o);
    if (!o.isSkinnedMesh && o.geometry) {
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      o.getWorldScale(_ws);
      if (g.boundingSphere.radius * Math.max(_ws.x, _ws.y, _ws.z) < 0.07) small.push(o);
    }
  });
  m._pp = { all, small }; m._ppT = G.time + 2 + Math.random();
  m._shOn = m._smOn = undefined;
  return m._pp;
}
/** ombre e dettagli piccoli (i pezzi nascosti passano al layer 1: la camera non lo disegna, .visible resta libero) */
function charDetail(c, shadow, small) {
  const P = charParts(c), m = c.m;
  if (m._shOn !== shadow) { m._shOn = shadow; for (const o of P.all) o.castShadow = shadow && o.userData._cs; }
  if (m._smOn !== small) { m._smOn = small; for (const o of P.small) o.layers.set(small ? 0 : 1); }
}
function updateCharVisual(c, dt) {
  const m = c.m;
  blink(c, dt);
  if (c.isPlayer) { m.body.visible = true; m.lod.visible = false; charDetail(c, true, true); animateChar(c, dt); return; }
  const d2 = c.pos.distanceToSquared(camera.position);
  if (d2 < PERF.charFull * PERF.charFull) {
    c._animAcc = (c._animAcc || 0) + dt;
    const inView = d2 < 100 || _frus.intersectsSphere(_frusS.set(_ws.set(c.pos.x, c.pos.y + 1, c.pos.z), 2.6));
    if (!inView) {
      // fuori dall'inquadratura: niente disegno; la posa si aggiorna ogni tanto (serve a mani, arma e altezza)
      m.body.visible = false; m.lod.visible = false;
      m.root.position.copy(c.pos);
      if ((frameN + c.idx) % 6 === 0) { animateChar(c, Math.min(c._animAcc, 0.25)); c._animAcc = 0; }
      return;
    }
    m.body.visible = true; m.lod.visible = false;
    charDetail(c, c.alive && d2 < PERF.charShadow * PERF.charShadow, d2 < PERF.smallNear * PERF.smallNear);
    const div = !c.alive || d2 < PERF.anim2 * PERF.anim2 ? 1 : d2 < PERF.anim3 * PERF.anim3 ? 2 : 3;
    if (div === 1 || (frameN + c.idx) % div === 0) { animateChar(c, Math.min(c._animAcc, 0.25)); c._animAcc = 0; }
    else m.root.position.copy(c.pos);
    return;
  }
  if (!c.alive) { m.body.visible = false; m.lod.visible = false; m.root.position.copy(c.pos); return; }
  m.body.visible = false;
  m.root.position.copy(c.pos); m.root.rotation.set(0, c.yaw, 0);
  // v24: i nemici lontani restano visibili fin dentro la nebbia (prima sparivano di colpo a 480 m)
  const far = Math.min(1400, scene.fog.far * 1.05);
  if (d2 > far * far) { m.lod.visible = false; return; }
  m.lod.visible = true;
  const falling = c.mode === 'fall';
  m.lod.rotation.x = falling ? 1.15 : 0;
  m.lod.position.y = falling ? 1 : 0;
}

const smooth01 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
function animateChar(ch, dt) {
  const m = ch.m;
  m._animF = frameN;   // v43: posa nuova da copiare sul modello realistico
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
  // v31: per la posa una molla smorzata (parte e arriva morbida, senza rimbalzi) invece dello scatto lineare
  {
    const tgt = ch.crouch && ch.mode === 'ground' ? 1 : 0, h = Math.min(dt, 0.05);
    ch.crouchV = (ch.crouchV || 0) + ((tgt - (ch.crouchA ?? 0)) * 160 - (ch.crouchV || 0) * 25) * h;
    ch.crouchA = clamp((ch.crouchA ?? 0) + ch.crouchV * h, 0, 1);
    if (ch.crouchA === 0 || ch.crouchA === 1) ch.crouchV *= 0.5;
  }
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
  const ck = ch.crouchA ?? ch.crouchK;
  // v32: andatura in base alla velocità: si cammina fino a ~3 m/s, a 5,3 m/s (passo normale) si corre, a 7,6 m/s si scatta
  const mv = Math.min(1, spd / 1.4);
  const run = smooth01((spd - 2.8) / 2.2) * (1 - ck);
  const spr = smooth01((spd - 5.8) / 1.6) * (1 - ck);
  // medikit: da fermi ci si inginocchia per curarsi
  const useMed = !!(ch.using && ch.slot && ch.slot.id === 'medkit' && ch.onGround);
  ch.kneelK = lerp(ch.kneelK || 0, useMed && spd < 1 ? 1 : 0, Math.min(1, dt * 6));
  const kneel = smooth01(ch.kneelK), ckL = Math.max(ck, kneel * 0.92);
  const fx = Math.sin(ch.yaw), fz = Math.cos(ch.yaw);
  const fwd = ch.vel.x * fx + ch.vel.z * fz;
  const side = ch.vel.x * -fz + ch.vel.z * fx;   // positivo = verso destra
  // ── direzione di marcia rispetto allo sguardo: avanti, indietro, di lato, in diagonale ──
  //   il bacino (e le gambe) si gira verso dove cammini, il busto resta rivolto al bersaglio
  const hspd = Math.hypot(fwd, side);
  let hipT = 0, backT = 0, strafeT = 0;
  if (hspd > 0.6 && !ch.inWater) {
    const a = Math.atan2(side, fwd);                      // 0 avanti · +π/2 destra · ±π indietro
    backT = Math.cos(a) < (ch.backK > 0.5 ? -0.05 : -0.3) ? 1 : 0;   // isteresi: niente scatti a 90°
    strafeT = Math.abs(Math.sin(a));
    const rel = backT ? a - Math.sign(a) * Math.PI : a;
    hipT = -clamp(rel, -1.2, 1.2) * 0.55 * (1 - spr * 0.4);
  } else if (mv < 0.15 && ch.onGround) {
    hipT = clamp(-yawRate * 0.06, -0.35, 0.35);           // girandosi da fermo il bacino resta indietro
  }
  ch.hipYaw = lerp(ch.hipYaw || 0, hipT, Math.min(1, dt * 9));
  ch.backK = lerp(ch.backK || 0, backT, Math.min(1, dt * 9));
  ch.strafeK = lerp(ch.strafeK || 0, strafeT, Math.min(1, dt * 7));
  const sideSign = side >= 0 ? 1 : -1;
  // in retromarcia le gambe girano al contrario e il passo è più corto
  const dirSign = ch.backK > 0.5 ? -1 : 1;
  // v32: la frequenza dei passi viene dalla lunghezza dell'appoggio: il piede a terra non pattina
  ch.walkPhase += dt * gaitRate(spd, mv, run, spr, ck) * (1 - ch.backK * 0.12) * (mv > 0.05 ? 1 : 0) * dirSign;
  const sw = Math.sin(ch.walkPhase) * mv;
  if (mv > 0.3 && ch.onGround && (ch.isPlayer || ch.alive)) {
    const step = Math.floor((ch.walkPhase - Math.PI / 2) / Math.PI);   // un passo a ogni appoggio
    if (step !== ch._lastStep) { ch._lastStep = step; footstep(ch); }   // v41: per superficie, anche i nemici
  }
  // inclinazioni morbide: avanti quando corri, di lato quando ti sposti o giri
  ch.leanFwd = lerp(ch.leanFwd || 0, clamp(fwd * 0.012, -0.06, 0.07) + run * 0.05 + spr * 0.1, Math.min(1, dt * 8));
  ch.leanSide = lerp(ch.leanSide || 0, clamp(-side * 0.022 - yawRate * 0.03, -0.2, 0.2), Math.min(1, dt * 8));
  m.body.rotation.x = ch.leanFwd * (1 - ck * 0.6);
  m.body.rotation.z = ch.leanSide * (1 - ck * 0.5);
  m.body.rotation.y = ch.hipYaw;

  // gambe
  let bodyY = legsLocomotion(m, ch.walkPhase, mv, run, ckL, spr);
  // v32: con un'arma pesante, da fermi, gambe più larghe e ginocchia morbide (il peso va sostenuto)
  {
    const hw = m.gunPivot.children[0] && m.gunPivot.children[0].userData.hold;
    const wH = hw && hw.cls === 'heavy' && ch.onGround && !ch.inWater ? (1 - mv) * (1 - ckL) : 0;
    ch.heavyK = lerp(ch.heavyK || 0, wH, Math.min(1, dt * 6));
    if (ch.heavyK > 0.01) for (let i = 0; i < 2; i++) {
      const h = ch.heavyK;
      m.legs[i].rotation.z += (i ? 1 : -1) * 0.055 * h; m.legs[i].rotation.x -= 0.05 * h; m.knees[i].rotation.x += 0.13 * h; m.feet[i].rotation.x -= 0.08 * h;
      m.feet[i].rotation.z = -m.legs[i].rotation.z * 0.8;
    }
    bodyY -= 0.018 * ch.heavyK;
  }
  // v31: in aria la posa delle gambe si fonde con quella a terra (niente scatto staccando o atterrando;
  // i saltini di un attimo, scendendo da un marciapiede, non cambiano posa)
  ch.airT = ch.onGround || ch.inWater ? 0 : (ch.airT || 0) + dt;
  const airborne = !ch.onGround && !ch.inWater && (ch.airT > 0.12 || ch.vel.y > 1.5);
  ch.airK = lerp(ch.airK || 0, airborne ? 1 : 0, Math.min(1, dt * (airborne ? (ch.vel.y > 3 ? 16 : 10) : 18)));
  // v41: salto animato: stacco con la gamba tesa, ginocchia raccolte in salita, falcata in corsa, gambe che cercano il suolo
  ch.jumpT = (ch.jumpT ?? 9) + dt;
  const airO = _airO; airO.run = ch.jumpRun ?? smooth01(ch.moveAmt / 5.5); airO.lead = ch.jumpLead || 0; airO.t = ch.airT; airO.push = ch.vel.y > 2 ? clamp(1 - ch.jumpT / 0.16, 0, 1) : 0;
  if (ch.airK > 0.001) { legsAirBlend(m, ch.vel.y / 6, smooth01(ch.airK), airO); bodyY *= 1 - ch.airK; }
  if (ch.onGround && !ch.inWater) {
    // passo laterale: falcata in avanti più corta, le gambe si aprono e chiudono di lato
    const sk2 = ch.strafeK * mv;
    if (sk2 > 0.02) for (let i = 0; i < 2; i++) {
      const ph = ch.walkPhase + i * Math.PI;
      if (ck < 0.5) m.legs[i].rotation.x *= 1 - 0.4 * sk2;
      m.legs[i].rotation.z += (Math.sin(ph) * 0.2 + (i ? 0.04 : -0.04)) * sk2 * sideSign;
      m.feet[i].rotation.z = -m.legs[i].rotation.z * 0.6;
    }
    // indietro: passi corti, ginocchia più piegate, punta del piede che tocca per prima
    const bk = ch.backK * mv;
    if (bk > 0.02) for (let i = 0; i < 2; i++) {
      m.legs[i].rotation.x *= 1 - 0.25 * bk * (1 - ck);
      m.knees[i].rotation.x += 0.15 * bk;
      m.feet[i].rotation.x += 0.12 * bk;
    }
    // girandosi da fermo: piccoli passi sul posto
    if (mv < 0.15 && Math.abs(yawRate) > 1.3 && ck < 0.5) {
      ch.turnPh = (ch.turnPh || 0) + dt * 11;
      for (let i = 0; i < 2; i++) {
        const lift = Math.max(0, Math.sin(ch.turnPh + i * Math.PI));
        m.legs[i].rotation.x -= lift * 0.32; m.knees[i].rotation.x += lift * 0.62; m.feet[i].rotation.x -= lift * 0.3;
      }
    }
  }
  // respiro e spostamento del peso da fermo
  const idle = 1 - mv;
  // v31: da fermi in piedi il peso passa lentamente da una gamba all'altra (ginocchio libero appena piegato)
  if (ch.onGround && !ch.inWater && ck < 0.5 && idle > 0.05) {
    const ws = Math.sin(t * 0.42 + (ch._wsPh ??= Math.random() * 6.3)) * idle * (1 - ck * 2);
    const free = ws > 0 ? 1 : 0, a = Math.abs(ws);
    m.knees[free].rotation.x += a * 0.14; m.legs[free].rotation.x -= a * 0.04; m.feet[free].rotation.x -= a * 0.1;
    m.body.position.x += (free ? -1 : 1) * a * 0.018;
    m.torso.rotation.z += (free ? 1 : -1) * a * 0.02;
  }
  const breath = Math.sin(t * 2.1) * 0.5 + 0.5;
  // atterraggio: piccolo affondo elastico (piega le ginocchia)
  if (ch.landT > 0) ch.landT = Math.max(0, ch.landT - dt);
  const land = Math.sin((ch.landT / 0.3) * Math.PI) * ch.landT;
  if (land > 0) for (let i = 0; i < 2; i++) { m.legs[i].rotation.x -= land * 1.6; m.knees[i].rotation.x += land * 3.2; m.feet[i].rotation.x -= land * 1.6; }
  m.body.position.y = bodyY - land * 0.45 + breath * 0.01 * idle;
  // busto: si piega in avanti da accovacciato, ruota con le spalle quando cammini
  m.torso.rotation.x = (0.26 + 0.08 * mv) * ck + land * 0.5 + breath * 0.022 * idle * (1 + ck) + run * 0.03 + spr * 0.05 + kneel * 0.12;
  // v32: il bacino ruota verso la gamba che avanza e le spalle in senso opposto (braccio destro avanti con la gamba
  // sinistra); con un'arma in mano il busto resta quasi fermo per non far ballare la mira
  {
    const gh = m._gait ? m._gait.h[1] - m._gait.h[0] : 0;            // > 0: gamba destra avanti
    const armed = !!(ch.slot && ch.slot.kind === 'weapon');
    const red = (1 - ck * 0.7) * (1 - ch.strafeK * 0.6) * (1 - ch.backK * 0.5);
    const pelvis = gh * (0.075 + 0.03 * run) * red;
    m.body.rotation.y = ch.hipYaw + pelvis;
    m.torso.rotation.y = -pelvis - gh * (armed ? 0.025 : 0.1 + 0.05 * run) * red - ch.hipYaw;
  }
  m.torso.rotation.x -= 0.07 * ch.backK * mv;   // indietro: busto un po' più eretto
  // bacino/spalle: piccolo rollio opposto allo spostamento sulla gamba d'appoggio
  m.torso.rotation.z = Math.sin(t * 0.9) * 0.015 * idle - Math.cos(ch.walkPhase) * 0.03 * mv * (1 - ck) * (1 - spr * 0.5);
  m.torso.position.y = RIG.hip;
  // v42: scivolata: gamba d'attacco tesa in avanti, l'altra piegata sotto, busto all'indietro, bacino quasi a terra
  ch.slideK = lerp(ch.slideK, (ch.slide || ch.slideNet) && ch.mode === 'ground' ? 1 : 0, Math.min(1, dt * ((ch.slide || ch.slideNet) ? 14 : 8)));
  if (ch.slideK > 0.01) {
    const k = smooth01(ch.slideK), L = (o, v) => lerp(o, v, k);
    m.legs[0].rotation.x = L(m.legs[0].rotation.x, -1.25); m.legs[0].rotation.z = L(m.legs[0].rotation.z, -0.04);
    m.knees[0].rotation.x = L(m.knees[0].rotation.x, 0.15); m.feet[0].rotation.x = L(m.feet[0].rotation.x, 0.45);
    m.legs[1].rotation.x = L(m.legs[1].rotation.x, -0.12); m.legs[1].rotation.z = L(m.legs[1].rotation.z, 0.32);
    m.knees[1].rotation.x = L(m.knees[1].rotation.x, 2.05); m.feet[1].rotation.x = L(m.feet[1].rotation.x, -0.55);
    m.body.rotation.x = L(m.body.rotation.x, 0); m.body.rotation.z = L(m.body.rotation.z, 0.05);
    m.body.position.y = L(m.body.position.y, -0.5); m.body.position.z = L(m.body.position.z, 0.12);
    m.torso.rotation.x = L(m.torso.rotation.x, -0.32); m.torso.rotation.z = L(m.torso.rotation.z, -0.06);
  }
  // v42: scavalco: si appoggia con le mani e passa le gambe raccolte di lato sopra il bordo
  {
    let vk = -1;
    if (ch.vault) vk = ch.vault.t;
    else if (ch.vaultNet) { ch._vnT = (ch._vnT ?? 0) + dt; vk = Math.min(1, ch._vnT / 0.42); } else ch._vnT = 0;
    if (vk >= 0) {
      const w = smooth01(Math.min(1, vk / 0.22)) * (1 - smooth01((vk - 0.72) / 0.28)), sd = ch.vault ? ch.vault.side : 1, L = (o, v) => lerp(o, v, w);
      for (let i = 0; i < 2; i++) {
        m.legs[i].rotation.x = L(m.legs[i].rotation.x, -1.15 - i * 0.2); m.legs[i].rotation.z = L(m.legs[i].rotation.z, sd * 0.45);
        m.knees[i].rotation.x = L(m.knees[i].rotation.x, 1.75 - i * 0.3); m.feet[i].rotation.x = L(m.feet[i].rotation.x, -0.3);
      }
      m.body.rotation.z = L(m.body.rotation.z, -sd * 0.22); m.body.position.y = L(m.body.position.y, -0.12);
      m.torso.rotation.x = L(m.torso.rotation.x, 0.42); m.torso.rotation.y = L(m.torso.rotation.y, sd * 0.25);
      if (!(ch.slot && ch.slot.kind === 'weapon')) { setArm(m, sd > 0 ? 0 : 1, lerp(0, -0.55, w), (sd > 0 ? -1 : 1) * 0.15 * w, -0.1); }
    }
  }

  // la testa ogni tanto si guarda attorno quando sei fermo
  ch.lookT = (ch.lookT ?? rand(2, 5)) - dt;
  if (ch.lookT <= 0) { ch.lookT = rand(2.5, 6); ch.lookYaw = idle > 0.8 && !G.ads ? rand(-0.55, 0.55) : 0; }
  ch.lookCur = lerp(ch.lookCur || 0, idle > 0.8 && !(ch.isPlayer && (mouse.left || G.ads)) ? (ch.lookYaw || 0) : 0, Math.min(1, dt * 3));

  // in acqua: bracciate
  if (ch.inWater) {
    m.gunPivot.visible = false;
    const swk = clamp((ch.moveAmt - 0.5) / 2.6, 0, 1);   // 0 = a galla, 1 = stile libero
    ch.swimK = lerp(ch.swimK ?? 0, swk, Math.min(1, dt * 3));
    ch.swimT = (ch.swimT || 0) + dt * (1.6 + ch.swimK * 3.2 * Math.min(1.4, ch.moveAmt / 3));
    poseSwim(m, ch.swimT, ch.swimK);
    m.body.rotation.x = 0.12 + ch.swimK * 0.95; m.body.position.y = 0.15 + Math.sin(ch.swimT * 2) * 0.035 * ch.swimK;
    m.body.rotation.z = Math.sin(ch.swimT) * 0.12 * ch.swimK;   // rollio delle bracciate
    if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 1.2, dt * 4);
    return;
  }

  const p = ch.pitch;
  const s = ch.slot;
  const lean = m.torso.rotation.x + m.body.rotation.x;
  const sprinting = spr > 0.5 && ch.onGround && ck < 0.3 && !(ch.isPlayer && (mouse.left || G.ads));
  ch.sprintK = lerp(ch.sprintK || 0, sprinting ? 1 : 0, Math.min(1, dt * 9));
  const sk = ch.sprintK;
  m.gunPivot.rotation.set(-p, 0, 0);
  m.gunPivot.position.set(0.12, 0.37, 0.34);
  if (!s) {
    // v32: piccone nella mano destra: pronto, oscilla col passo, colpo caricato sopra la spalla (anim.js)
    armsSwing(m, ch.walkPhase, mv, run, ck);
    posePickaxe(m, { mv, run, sk, swing: ch.swing > 0 ? clamp(1 - ch.swing / 0.45, 0, 1) : -1, ck });
  } else if (s.kind === 'cons') {
    // v32: bende, medikit e pozioni hanno ognuno la sua animazione d'uso (anim.js)
    poseUse(m, s.id, ch.using ? clamp(ch.using.t / ch.using.total, 0, 1) : -1, { mv, run, t });
  } else if (WEAPONS[s.id] && WEAPONS[s.id].melee) {
    // v38: Artigli: guardia, e le mosse del Gargoyle con tutto il corpo (anim.js)
    m.gunPivot.visible = false;
    const cl = ch.claw, cm = cl && CLAW_MOVES[cl.id];
    poseClaws(m, { mv, run, sk, ck, phase: ch.walkPhase, t, move: cl ? cl.id : null, u: cl ? cl.t / cm.dur : 0 });
  } else {
    // arma: posa di mira, oppure "arma in sicurezza" mentre corri (v29: mani sull'arma con la IK)
    poseHold(m, p, sk, sw, lean);
    // v32: l'arma ondeggia col passo (le pesanti più lente e ampie) e respira appena da ferma
    const hc = m._hold && m._hold.h.cls, wk = hc === 'heavy' ? 1.5 : hc === 'light' ? 0.7 : 1, aimK = 1 - sk;
    const ph = ch.walkPhase;
    m.gunPivot.position.y += (Math.cos(ph * 2) * 0.01 * mv + Math.sin(t * 1.6) * 0.0035 * idle) * wk * aimK;
    m.gunPivot.position.x += Math.sin(ph) * 0.007 * mv * wk * aimK;
    m.gunPivot.rotateZ(Math.sin(ph) * 0.028 * mv * wk * aimK);
  }
  const holdingGun = s && s.kind === 'weapon' && !(WEAPONS[s.id] && WEAPONS[s.id].melee);
  let reloadPh = -1;
  // ricarica: l'arma si inclina verso l'interno, la mano d'appoggio va al caricatore e alla tasca
  if (holdingGun && ch.reloading > 0) {
    const dur = WEAPONS[s.id].reload;
    reloadPh = clamp(1 - ch.reloading / dur, 0, 1);
    // il lanciarazzi resta sulla spalla: si inclina appena
    const b = bump(reloadPh) * (m._hold && m._hold.h.kind === 'shoulder' ? 0.3 : 1);
    m.gunPivot.rotateZ(-0.45 * b);          // v32: arma nella destra, si inclina verso sinistra
    m.gunPivot.rotateX(0.22 * b);
    m.gunPivot.translateZ(0.08 * b);        // la porta via dalla spalla: il calcio non entra nel petto
    m.gunPivot.position.y -= 0.05 * b;
    m.head.rotation.x = 0.25 * b;
  }
  // rinculo: l'arma arretra lungo la canna e la bocca sale
  if (ch.recoilT > 0) {
    ch.recoilT = Math.max(0, ch.recoilT - dt);
    const r = ch.recoilT / 0.14;
    const kick = r * r * (ch.recoilK || 1);
    if (holdingGun) { m.gunPivot.translateZ(-kick * 0.06); m.gunPivot.rotateX(-kick * 0.16); }
    else { m.gunPivot.position.z -= kick * 0.1; m.gunPivot.rotation.x += kick * 0.3; }
    m.torso.rotation.x -= kick * 0.06;
  }
  // cambio arma: l'oggetto scende e risale con un'animazione morbida
  if (ch.equipT > 0) {
    ch.equipT = Math.max(0, ch.equipT - dt);
    const e = Math.sin((ch.equipT / 0.28) * Math.PI * 0.5);
    m.gunPivot.position.y -= e * 0.3;
    m.gunPivot.rotateX(e * 1.1);
    if (!holdingGun) { m.arms[1].rotation.x += e * 0.8; m.arms[0].rotation.x += e * 0.8; }
  }
  if (holdingGun) handsToGun(m, reloadPh);
  // colpito: sussulto
  if (ch.hitT > 0) {
    ch.hitT = Math.max(0, ch.hitT - dt);
    const h = bump(1 - ch.hitT / 0.3);
    m.torso.rotation.z += h * 0.22 * (ch.hitDir || 1);
    m.torso.rotation.x -= h * 0.12;
    m.head.rotation.z = h * 0.25 * (ch.hitDir || 1);
  }
  // v41: busto e braccia seguono il salto (in salita il petto si apre, in discesa ci si raccoglie e si guarda giù)
  if (ch.airK > 0.01 && !ch.inWater) {
    const ak = smooth01(ch.airK), up = clamp(ch.vel.y / 6, -1.3, 1), k = Math.max(0, up), dn = Math.min(1, Math.max(0, -up));
    const run = airO.run, side = airO.lead ? 1 : -1, fall = clamp((ch.airT - 0.55) / 0.45, 0, 1) * dn;
    m.torso.rotation.x += (-0.1 * k + 0.12 * dn + 0.1 * run * k) * ak;
    m.torso.rotation.y += side * 0.14 * run * ak * (1 - dn * 0.5);
    m.body.rotation.x += (0.06 * run * k - 0.05 * dn) * ak;
    if (!holdingGun && !(s && WEAPONS[s.id] && WEAPONS[s.id].melee)) {
      // braccia libere: si alzano con lo slancio e si aprono per l'equilibrio scendendo (dondolano nelle cadute lunghe)
      for (let i = 0; i < 2; i++) {
        const sd = i ? 1 : -1, opp = (i === (airO.lead || 0)) ? -1 : 1;
        const wob = Math.sin(ch.airT * 7 + i * 2) * 0.25 * fall;
        m.arms[i].rotation.x += (-(0.75 * k + 0.25) - opp * 0.45 * run * (1 - dn) + 0.35 * dn + wob) * ak * (s ? 0.35 : 1);
        m.arms[i].rotation.z += sd * (0.12 + 0.45 * dn) * ak * (s ? 0.35 : 1);
        m.elbows[i].rotation.x = Math.min(0, m.elbows[i].rotation.x - 0.25 * ak * k);
      }
    } else {
      // arma in mano: si solleva appena con lo slancio e si abbassa ricadendo
      m.gunPivot.position.y += (0.035 * k - 0.03 * dn) * ak;
      m.gunPivot.rotateX(0.06 * dn * ak - 0.04 * k * ak);
    }
    m.head.rotation.x += 0.18 * dn * ak - 0.05 * k * ak;
  }
  // v41: lancio (granata, fumogeno): mentre miri il braccio destro è caricato dietro la testa, poi la frustata in avanti
  const aimThr = ch.isPlayer && G.throwAim;
  if (ch.throwAnim > 0) { ch.throwAnim += dt; if (ch.throwAnim > 0.6) ch.throwAnim = 0; }
  ch.throwHoldK = lerp(ch.throwHoldK || 0, aimThr ? 1 : 0, Math.min(1, dt * 12));
  if (ch.throwAnim > 0 || ch.throwHoldK > 0.02) {
    const u = ch.throwAnim > 0 ? ch.throwAnim / 0.6 : 0;
    // carica (0) → rilascio (0.25) → accompagnamento (0.6) → ritorno
    const cock = ch.throwAnim > 0 ? Math.max(0, 1 - u / 0.22) : ch.throwHoldK;
    const swing = ch.throwAnim > 0 ? smooth01(clamp((u - 0.05) / 0.35, 0, 1)) * (1 - smooth01(clamp((u - 0.6) / 0.4, 0, 1))) : 0;
    const w = Math.max(cock, swing, ch.throwAnim > 0 ? 1 - smooth01(clamp((u - 0.7) / 0.3, 0, 1)) : ch.throwHoldK);
    const ax = -2.7 * cock + (-0.9) * swing * (1 - cock), el = -1.7 * cock - 0.25 * swing;
    m.arms[1].rotation.x = lerp(m.arms[1].rotation.x, ax, w);
    m.arms[1].rotation.z = lerp(m.arms[1].rotation.z, 0.35 * cock - 0.15 * swing, w);
    m.elbows[1].rotation.x = lerp(m.elbows[1].rotation.x, el, w);
    m.arms[0].rotation.x = lerp(m.arms[0].rotation.x, -1.2 * cock - 0.2 * swing, w * 0.8);   // l'altro braccio indica il bersaglio
    m.elbows[0].rotation.x = lerp(m.elbows[0].rotation.x, -0.3, w * 0.8);
    m.torso.rotation.y += (0.42 * cock - 0.38 * swing) * w;
    m.torso.rotation.x += 0.12 * swing * w - 0.06 * cock * w;
    if (w >= 0.4 && m.gunPivot.visible) { m.gunPivot.visible = false; ch._thrHid = true; }   // l'arma sparisce durante il lancio
    else if (w < 0.4 && ch._thrHid) { ch._thrHid = false; if (!(s && WEAPONS[s.id] && WEAPONS[s.id].melee)) m.gunPivot.visible = true; }
  } else if (ch._thrHid) { ch._thrHid = false; if (!(s && WEAPONS[s.id] && WEAPONS[s.id].melee)) m.gunPivot.visible = true; }
  if (!m._headLock) m.head.rotation.x += -p * 0.5 - m.torso.rotation.x * 0.6;   // bevendo la testa la decide la posa
  m.head.rotation.y = ch.lookCur - m.torso.rotation.y - ch.hipYaw;
  // canne della minigun che girano
  const wm = m.gunPivot.children[0];
  if (wm && wm.userData.spin) wm.userData.spin.rotation.z += dt * 38 * (ch.spinK || 0);
  if (m.cape) m.cape.rotation.x = lerp(m.cape.rotation.x, 0.08 + mv * 0.55 + run * 0.25 + Math.sin(t * 6) * 0.04 * mv + (ch.onGround ? 0 : 0.5), Math.min(1, dt * 6));
}

const _airO = { run: 0, lead: 0, t: 0, push: 0 };
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
  // v38: il Gargoyle
  const bh = bossFight.ray(o, d, c ? c.t : lim);
  if (bh) return { t: bh.t, boss: true, head: bh.head };
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
  if (throwSys.clouds.length && throwSys.smokeBlocks(o, t)) return false;   // v41: il fumo nasconde
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
  if (def.melee || s.mag >= def.mag || ch.ammo[def.ammo] <= 0) return;
  ch.reloading = def.reload;
  ch.reloadSlot = ch.active;
  ch.using = null;
  if (ch.isPlayer) A.playReload();
}

function fireWeapon(ch, aimFn, again = null) {
  const s = ch.weapon;
  if (!s) return false;
  const def = WEAPONS[s.id];
  if (def.melee) return clawAttack(ch);
  if (ch.fireCd > 0 || ch.reloading > 0 || ch.using || ch.mode === 'climb' || ch.inWater) return false;   // a nuoto non si spara
  // minigun: le canne devono prima prendere giri
  if (def.spin) { ch.spinReq = G.time; if ((ch.spinK || 0) < 1) return false; }
  if (s.mag <= 0) {
    if (ch.ammo[def.ammo] > 0) startReload(ch);
    else { if (ch.isPlayer) { A.playEmpty(); showMsg('', 'Munizioni esaurite!', 1.2); } ch.fireCd = 0.3; }
    return false;
  }
  s.mag--;
  ch.fireCd = def.rate;
  // raffica: il primo colpo programma i successivi a distanza di burstGap
  if (def.burst) {
    if (ch.burstLeft > 0 && ch.burstSlot === s) ch.burstLeft--;
    else { ch.burstLeft = def.burst - 1; ch.burstSlot = s; ch.burstNext = again || (() => fireWeapon(ch, aimFn)); }
    if (s.mag <= 0) ch.burstLeft = 0;
    if (ch.burstLeft > 0) ch.fireCd = def.burstGap;
  }
  ch.emote = null;
  ch.recoilT = 0.14; ch.recoilK = def.pellets > 1 || def.projectile ? 1.6 : def.rate > 0.5 ? 1.3 : def.spin ? 0.35 : 0.7;
  if (ch.isPlayer) { XH.fire(def.pellets > 1 || def.projectile ? 1.4 : def.rate > 0.5 ? 1.1 : def.spin ? 0.25 : 0.6); ch.st.shots += def.pellets || 1; }
  const mult = RARITIES[s.rarity].mult * (ch.isPlayer ? 1 : botDiff(ch).dmgMult);
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
  if (ch.isPlayer) { A.playGun('melee'); XH.fire(0.5); }
  setTimeout(() => {
    if (!ch.alive) return;
    const o = ch.chest();
    const d = new THREE.Vector3(Math.sin(ch.yaw) * Math.cos(ch.pitch), Math.sin(ch.pitch), Math.cos(ch.yaw) * Math.cos(ch.pitch));
    const hit = rayAll(o, d, 2.4, ch);
    if (!hit) return;
    const p = o.clone().addScaledVector(d, hit.t);
    if (hit.char) { damage(hit.char, 20, ch, false, 'Piccone'); emit(p, '#d02020', 6, 3, 0.4, 0.08); return; }
    if (hit.boss) { bossFight.hurt(20, ch, false, p); emit(p, '#6a1a10', 6, 3, 0.4, 0.08); return; }
    if (hit.collider) {
      if (hit.collider.hp) damageWall(hit.collider, 50);
      if (hit.collider.spec || hit.collider.rock || hit.collider.special) structHit(hit.collider, p, 55, ch);
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
const _cfp = new THREE.Vector3();
function damage(t, amount, attacker, head = false, how = '', ignoreShield = false) {
  if (!t.alive || amount <= 0) return;
  // v23: niente fuoco amico fra compagni di squadra
  if (attacker && attacker !== t && G.teamSize > 1 && attacker.team === t.team) return;
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
    attacker.st.hits++; if (head) attacker.st.heads++;   // v41
    PR.track('damage', amount);
    if (head) PR.track('headshot', 1);
    dmgNumber(new THREE.Vector3(t.pos.x + rand(-0.3, 0.3), t.pos.y + 2.1, t.pos.z), amount, head ? 'head' : (sh > 0 ? 'shield' : ''));
    G.hitT = 0.15; $('#hitmarker').classList.toggle('head', head);
    touch.buzz(head ? 22 : 12);   // v40
    XH.hit(head ? 'head' : sh > 0 ? 'shield' : 'body');
    sh > 0 ? A.playShieldHit() : A.playHit(head);
    if (head && t.m && t.m.head) critFlash(t.m.head.getWorldPosition(_cfp));   // v42
  }
  if (t === G.player) {
    G.hurtT = 0.4;
    if (attacker) { A.playHurt(); touch.buzz(35); }
    t.st.taken += amount;
    if (attacker && attacker !== t) hurtFrom(attacker, amount);   // v41: arco rosso verso chi ti colpisce + scossa
    else G.shake = Math.max(G.shake, clamp(amount / 120, 0.04, 0.3));
  }
  if (!t.isPlayer && attacker && attacker !== t && attacker.alive && t.ai) {
    if (!t.ai.target || Math.random() < 0.6) { t.ai.target = attacker; t.ai.lastSeen = G.time; t.ai.lastSeenPos.copy(attacker.pos); }
    t.ai.alert = 3;
  }
  if (G.teamSize > 1 && attacker && attacker !== t && attacker.alive) teamAssist(t, attacker);
  if (G.net && NET.role === 'host' && (t.human || (attacker && attacker.human))) {
    netSend({ t: 'hp', v: t.idx, hp: Math.max(0, Math.round(t.hp)), sh: Math.round(t.shield), a: attacker ? attacker.idx : -1, amt: amount, h: head ? 1 : 0, w: how });
  }
  if (t.hp <= 0) { if (G.net && NET.role === 'client') return; kill(t, attacker, how); }
}

function aliveCount() { let n = 0; for (const c of G.chars) if (c.alive) n++; return n; }
/** squadre ancora in gara (in singolo = giocatori vivi) */
function aliveTeams() { const s = new Set(); for (const c of G.chars) if (c.alive) s.add(c.team); return s.size; }
const teamOf = (c) => (G.teams && G.teams.get(c.team)) || [c];
const teamAlive = (team) => G.chars.some(c => c.alive && c.team === team);
/** v34: difficoltà del singolo bot (i compagni dei giocatori veri usano quella base) */
function botDiff(b) { return G.humanTeams && G.diffAlly && b && G.humanTeams.has(b.team) ? G.diffAlly : G.diff; }
const isMate = (a, b) => a !== b && G.teamSize > 1 && a.team === b.team;
/** il capogruppo che il bot segue: il primo compagno vivo (gli umani hanno la precedenza) */
function leaderOf(b) {
  if (G.teamSize <= 1) return null;
  for (const c of teamOf(b)) if (c.alive) return c === b ? null : c;
  return null;
}
/** un compagno viene colpito (o colpisce): i bot della squadra lì vicino entrano in combattimento */
function teamAssist(victim, attacker) {
  const now = G.time;
  for (const side of [[victim, attacker], [attacker, victim]]) {
    const [friend, foe] = side;
    if (friend.team === foe.team) continue;
    for (const m of teamOf(friend)) {
      if (m === friend || !m.alive || !m.ai || m.remote || m.mode !== 'ground') continue;
      if (m.ai.target && m.ai.target.alive && Math.random() < 0.7) continue;
      if (m.pos.distanceTo(foe.pos) > 70) continue;
      m.ai.target = foe; m.ai.lastSeen = now; m.ai.lastSeenPos.copy(foe.pos); m.ai.alert = 3;
    }
  }
}
function mateToWatch() { return G.player ? teamOf(G.player).find(c => c.alive && c !== G.player) : null; }
/** giocatore vivo più vicino a un punto (per lo spettatore) */
function nearestAlive(at) {
  let best = null, bd = Infinity;
  for (const c of G.chars) { if (!c.alive || c === G.player) continue; const d = at ? c.pos.distanceToSquared(at) : 0; if (d < bd) { bd = d; best = c; } }
  return best;
}

function kill(t, attacker, how) {
  if (!t.alive) return;
  if (G.net && NET.role === 'host') netSend({ t: 'kill', v: t.idx, a: attacker ? attacker.idx : -1, w: how });
  t.alive = false; t.hp = 0; t.shield = 0; t.deadT = 0;
  t.using = null; t.reloading = 0;
  showGlider(t, false);
  const teamDead = !teamAlive(t.team);
  const place = aliveTeams() + 1;
  t.place = teamDead ? place : place - 1;
  if (teamDead) for (const m of teamOf(t)) m.place = place;
  // rilascia l'inventario
  const drops = [];
  if (!t.remote) for (const s of t.slots) if (s) drops.push(s.kind === 'weapon' ? { kind: 'weapon', id: s.id, rarity: s.rarity, mag: s.mag } : { kind: 'cons', id: s.id, count: s.count });
  if (!t.remote) for (const [k, v] of Object.entries(t.ammo)) if (v > 0) drops.push({ kind: 'ammo', id: k, count: Math.min(v, 60) });
  if (t.mats > 0 && !t.remote) drops.push({ kind: 'mats', count: Math.min(t.mats, 200) });
  if (!t.remote && t.throws) for (const k of THROW_IDS) if (t.throws[k] > 0) drops.push({ kind: 'throw', id: k, count: t.throws[k] });   // v41
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
    if (attacker.st) attacker.st.maxKillD = Math.max(attacker.st.maxKillD, attacker.pos.distanceTo(t.pos));   // v41
    const wk = Object.keys(WEAPONS).find(k => WEAPONS[k].name === how);
    const wr = wk && attacker.weapon && attacker.weapon.id === wk ? attacker.weapon.rarity : 1;
    text = `<b>${esc(attacker.name)}</b> ${wk ? weaponIconHTML(wk, wr, 'wi kfi', true) : `<span style="opacity:.7">[${esc(how)}]</span>`} ${esc(t.name)}`;
  } else if (how === 'Gargoyle') text = `${esc(t.name)} è stato sbranato dal Gargoyle 🦇`;
  else if (how === 'storm') text = `${esc(t.name)} è stato consumato dalla tempesta ⛈`;
  else if (how === 'fall') text = `${esc(t.name)} è caduto da troppo in alto 🪂`;
  else text = `${esc(t.name)} si è eliminato da solo 💥`;
  addFeed(text, attacker === G.player || t === G.player);
  if (attacker === G.player && t !== G.player) {
    PR.track('kill', 1);
    XH.kill();
    const wid = Object.keys(WEAPONS).find(k => WEAPONS[k].name === how);
    if (wid) {
      PR.track('kill_' + wid, 1);
      // le missioni per tipo contano anche le varianti (es. DMR e fucile da caccia per il cecchino)
      const fam = { pistol: 'pistol', smg: 'smg', ar: 'ar', shotgun: 'shotgun', sniper: 'sniper', rocket: 'rocket' }[WEAPONS[wid].role];
      if (fam && fam !== wid) PR.track('kill_' + fam, 1);
    }
    A.playKill();
    showMsg('', `Hai eliminato ${t.name}!`, 2);
  }
  if (t === G.player) {
    G.placement = place;
    G.killedBy = attacker && attacker !== t ? attacker.name : (how === 'Gargoyle' ? 'il Gargoyle' : how === 'storm' ? 'la tempesta' : how === 'fall' ? 'una brutta caduta' : 'te stesso');
    G.ads = false;
    const mate = mateToWatch();
    if (mate) {
      // squadre: guardi un compagno, la partita finisce quando cade tutta la squadra
      G.spectate = mate;
      showMsg('SEI STATO ELIMINATO', `Ora guardi ${mate.name}: se la tua squadra vince, vinci anche tu!`, 4);
    } else {
      // v33: modalità spettatore: dopo un attimo si guarda chi ti ha eliminato
      G.spectate = attacker && attacker.alive && attacker !== t ? attacker : null;
      setTimeout(() => deathToSpectate(attacker && attacker !== t ? attacker : null), 1800);
    }
  } else if (G.player && !G.player.alive && t.team === G.player.team) {
    if (teamDead) { G.placement = place; G.killedBy = attacker && attacker !== t ? attacker.name : (how === 'storm' ? 'la tempesta' : G.killedBy || 'la tempesta'); G.teamWiped = true; setTimeout(() => deathToSpectate(attacker && attacker !== t ? attacker : null), 1800); }
    else if (G.spectate === t || !G.spectate) G.spectate = mateToWatch();
  }
  if (G.player && G.spectate === t && t !== G.player) {
    // chi stavi guardando è caduto: passi a chi l'ha eliminato (o a un compagno, o a chi è più vicino)
    const nx = mateToWatch() || (attacker && attacker.alive && attacker !== t ? attacker : null) || nearestAlive(t.pos);
    G.spectate = nx;
    if (G.specOn && nx) showMsg('', `${t.name} è stato eliminato · ora osservi ${nx.name}`, 2.4);
  }
  if (G.specOn && G.player && !G.player.alive && aliveTeams() <= 1) setTimeout(() => { if (G.specOn) { const w = G.chars.find(c => c.alive); if (w) showMsg(`${w.name.toUpperCase()} HA VINTO`, '', 3); setTimeout(showEndScreen, 2600); } }, 600);
  if (G.player && teamDead && G.teamSize > 1 && t.team !== G.player.team && attacker && attacker.team === G.player.team) addFeed(`<span style="color:#ffd23a">✔ La tua squadra ha eliminato la squadra di ${esc(t.name)}</span>`, true);
  if (G.player && aliveTeams() <= 1 && teamAlive(G.player.team) && !G.endShown) setTimeout(() => endMatch(true), 1200);
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// ─────────────── Razzi ───────────────
const rocketGeo = rocketProjectileGeo();   // v37: razzo a fuso giallo con la gabbia di stecche
const rocketMat = new THREE.MeshStandardMaterial({ color: '#d9c63c', roughness: 0.5, emissive: '#ff8a20', emissiveIntensity: 0.18 });
const grenadeGeo = new THREE.SphereGeometry(0.055, 10, 8).scale(1, 1, 1.35);
const grenadeMat = new THREE.MeshStandardMaterial({ color: '#4a5a32', roughness: 0.6, metalness: 0.3, emissive: '#ffb030', emissiveIntensity: 0.12 });
function spawnRocket(owner, pos, dir, dmg, def) {
  const mesh = new THREE.Mesh(def.grenade ? grenadeGeo : rocketGeo, def.grenade ? grenadeMat : rocketMat);
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

/** v42: di cosa è fatto quello che il proiettile ha colpito */
function hitMaterial(hit, at) {
  if (hit.terrain) {
    const b = biomeAt(at.x, at.z), th = terrainHeight(at.x, at.z);
    if (b[1] > 0.5) return 'snow';
    if (b[2] > 0.5 || (b[4] > 0.5 && th < WATER_LEVEL + 2.2)) return 'sand';
    return 'dirt';
  }
  const c = hit.collider;
  if (!c) return 'stone';
  if (c.surf) return c.surf === 'wood' ? 'wood' : c.surf;
  if (c.built || c.door || c.tree || (c.prop && c.harvest) || (c.barrel && c.harvest)) return 'wood';
  if (c.barrel || c.car || c.special) return 'metal';
  return 'stone';
}
/** v42: particelle diverse per materiale: pietra = polvere chiara e schegge, terra = zolle che ricadono,
 *  metallo = scintille brillanti, legno = schegge marroni, neve/sabbia = sbuffo */
function impactFx(at, mat, d) {
  if (d > 120) return;
  const lod = d < 40 ? 1 : 0.5;
  switch (mat) {
    case 'metal':
      emit(at, '#ffd27a', Math.ceil(7 * lod), 7, 0.22, 0.035, 1.6, 4.5);
      emit(at, '#fff4d0', Math.ceil(3 * lod), 3, 0.06, 0.09, 0, 6);
      emit(at, '#6e7278', 2, 1.2, 0.35, 0.06, -0.05);
      break;
    case 'wood':
      emit(at, '#8a5a2e', Math.ceil(5 * lod), 3.6, 0.5, 0.06, 1.4);
      emit(at, '#c8a070', Math.ceil(3 * lod), 1.4, 0.45, 0.1, -0.1);
      break;
    case 'dirt':
      emit(at, '#5e4a30', Math.ceil(6 * lod), 3.2, 0.55, 0.075, 2.2);
      emit(at, '#8a7656', Math.ceil(3 * lod), 1.1, 0.7, 0.16, -0.05);
      if (Math.random() < 0.5) emit(at, '#5f7a34', 2, 2.4, 0.4, 0.05, 1.5);
      break;
    case 'sand':
      emit(at, '#d8c08a', Math.ceil(7 * lod), 2.4, 0.6, 0.08, 1.6);
      emit(at, '#e8d6a8', Math.ceil(3 * lod), 1, 0.8, 0.18, -0.05);
      break;
    case 'snow':
      emit(at, '#f4f8ff', Math.ceil(8 * lod), 2.2, 0.7, 0.09, 0.9);
      break;
    default:   // pietra, intonaco, cemento
      emit(at, '#d8d0c0', Math.ceil(4 * lod), 1.3, 0.75, 0.17, -0.12);
      emit(at, '#a49a88', Math.ceil(4 * lod), 4, 0.35, 0.05, 1.8);
      emit(at, '#ffd27a', 2, 5, 0.1, 0.03, 0.2, 2.5);
  }
  if (d < 30) A.playImpact(mat === 'dirt' || mat === 'sand' || mat === 'snow' ? 'soft' : mat, d);
}
function bulletImpact(b, hit, end, dist) {
  const def = b.def;
  const fall = dist > def.range * 0.5 ? Math.max(0.5, 1 - (dist - def.range * 0.5) / def.range) : 1;
  const near = end.distanceToSquared(camera.position) < 120 * 120;
  if (hit.boss) { bossFight.hurt(b.dmg * fall, b.owner, hit.head, end); if (near) emit(end, '#6a1a10', 5, 3, 0.4, 0.08); return; }
  if (hit.char) {
    damage(hit.char, b.dmg * fall * (hit.head ? 2 : 1), b.owner, hit.head, def.name);
    if (near) emit(end, '#d02020', 5, 3, 0.4, 0.08);
  } else {
    if (near) impactFx(end, hitMaterial(hit, end), end.distanceTo(camera.position));
    if (hit.collider && hit.collider.hp) damageWall(hit.collider, b.dmg * fall);
    if (hit.collider && (hit.collider.spec || hit.collider.rock || hit.collider.special)) structHit(hit.collider, end, b.dmg * fall * (b.owner && !b.owner.human ? 0.5 : 1), b.owner);
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
  b.m.position.copy(at); b.r = radius; b.life = 0.55; b.m.visible = true; b.blue = false; flashLight.color.set('#ffb050'); G.flashBlueT = 0;
  emit(at, '#ff8a20', 26, 9, 0.8, 0.25, 0.6);
  emit(at, '#444444', 18, 5, 1.2, 0.35, -0.1);
  flashLight.position.copy(at); flashLight.intensity = 80;
  const d = at.distanceTo(camera.position);
  A.playExplosion(d);
  if (d < 140) gfx.kick(clamp(1.25 - d / 110, 0.25, 1));   // v42: bagliore dell'esplosione
  G.shake = Math.max(G.shake, clamp(1 - d / 45, 0, 1));
  for (const c of G.chars) {
    if (!c.alive || c.mode === 'bus') continue;
    const dist = c.chest().distanceTo(at);
    if (dist < radius) damage(c, dmg * (1 - dist / radius * 0.7) * (c === owner ? 0.5 : 1), owner, false, how);
  }
  if (bossFight.active) {   // v38: il Gargoyle è grosso: lo prende anche un'esplosione vicina
    const bc = bossFight.center(_p), dist = Math.max(0, bc.distanceTo(at) - 1.2);
    if (dist < radius) bossFight.hurt(dmg * (1 - dist / radius * 0.7), owner, false, bc);
  }
  for (const b of world.barrels) {
    if (!b.explosive || b.dead) continue;
    if (Math.abs(b.x - at.x) < radius && Math.abs(b.z - at.z) < radius && Math.hypot(b.x - at.x, b.y + 0.6 - at.y, b.z - at.z) < radius) damageBarrel(b, 999, owner);
  }
  for (const w of [...G.walls]) {
    const cx = (w.minX + w.maxX) / 2, cz = (w.minZ + w.maxZ) / 2;
    if (Math.hypot(cx - at.x, cz - at.z) < radius + 1.5) damageWall(w, 400);
  }
  structBlast(at, radius * 0.75, dmg * 3, owner);
  for (const q of [...G.placed]) if (q.pos.distanceTo(at) < radius * 0.6) removePlaced(q);   // v42: le esplosioni distruggono trappole e trampolini
}

// ═══════════════════════════════════════════════════════════════
//  v41: oggetti da lancio, segnalazioni (ping), indicatore dei danni, passi per superficie
// ═══════════════════════════════════════════════════════════════
const throwSys = createThrowables({
  scene, rayWorld, terrainHeight,
  onDetonate(g) {
    if (g.id === 'frag') explode(g.pos.clone().setY(g.pos.y + 0.15), g.owner, FRAG.dmg, FRAG.radius, 'Granata');
    else impulseBlast(g.pos.clone(), g.owner);
  },
  onBounce(g, speed) { const d = g.pos.distanceTo(camera.position); if (d < 45) A.playBounce(d, Math.min(1, speed / 14)); },
  onSmoke(c) { const d = c.pos.distanceTo(camera.position); A.playSmoke(d); emit(c.pos.clone().setY(c.pos.y + 0.4), '#d8dde2', 16, 4, 0.9, 0.5, -0.2); },
});
const THROW_CD = 0.7;
/** v41: soluzione balistica: con che angolo (e forza) lanciare da `from` per arrivare in `to` */
function aimThrow(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y, d = Math.max(0.5, Math.hypot(dx, dz));
  const g = THROW_G;
  let v = THROW_SPEED, disc = v ** 4 - g * (g * d * d + 2 * dy * v * v);
  if (disc < 0) { v = Math.sqrt(g * (dy + Math.hypot(d, dy))) * 1.01; disc = Math.max(0, v ** 4 - g * (g * d * d + 2 * dy * v * v)); }
  const th = Math.atan((v * v - Math.sqrt(disc)) / (g * d));   // traiettoria bassa
  return { yaw: Math.atan2(dx, dz), pitch: th - 0.2, speed: Math.min(THROW_SPEED, v) };
}
const _thv = new THREE.Vector3(), _tho = new THREE.Vector3();
/** origine del lancio: sopra la spalla destra */
function throwOrigin(ch, out) {
  const fx = Math.sin(ch.yaw), fz = Math.cos(ch.yaw);
  return out.set(ch.pos.x + fx * 0.35 - fz * 0.25, ch.pos.y + 1.75 * ch.hScale, ch.pos.z + fz * 0.35 + fx * 0.25);
}
function throwItem(ch, id, yaw = ch.yaw, pitch = ch.pitch, speed = THROW_SPEED, remote = false) {
  if (!remote) {
    if (!ch.alive || ch.mode !== 'ground' || (ch.throws[id] || 0) <= 0 || (ch.throwCd || 0) > G.time) return false;
    ch.throws[id]--; ch.throwCd = G.time + THROW_CD;
  }
  const o = throwOrigin(ch, _tho);
  throwVelocity(yaw, pitch, _thv, speed).addScaledVector(ch.vel, 0.45);
  throwSys.spawn(id, ch, o, _thv);
  ch.throwAnim = 0.001; ch.throwId = id; ch.emote = null;
  ch.lastShotT = G.time;
  const d = o.distanceTo(camera.position);
  if (d < 60) A.playThrow(d);
  if (ch.isPlayer) { G.matchStats.thrown = (G.matchStats.thrown || 0) + 1; touch.buzz(10); }
  if (G.net && !remote && (ch === G.player || (NET.role === 'host' && !ch.remote && !ch.human))) netSend({ t: 'thr', v: ch.idx, id, y: +yaw.toFixed(3), p: +pitch.toFixed(3), s: +speed.toFixed(2) });
  return true;
}
/** v41: granata a impulso: spinta senza danni; sotto i piedi di chi l'ha lanciata è una catapulta verso dove guarda */
function impulseBlast(at, owner) {
  const d0 = at.distanceTo(camera.position);
  emit(at, '#5ad0ff', 34, 11, 0.45, 0.2, 0.15); emit(at, '#ffffff', 14, 7, 0.3, 0.12, 0.2);
  const b = booms[bIdx = (bIdx + 1) % booms.length];
  b.m.position.copy(at); b.r = IMPULSE.radius * 0.7; b.life = 0.4; b.m.visible = true; b.blue = true;
  flashLight.position.copy(at); flashLight.color.set('#6ad8ff'); flashLight.intensity = 50; G.flashBlueT = 0.25;
  A.playImpulse(d0);
  G.shake = Math.max(G.shake, clamp(1 - d0 / 30, 0, 0.45));
  for (const c of G.chars) {
    if (!c.alive || (c.mode !== 'ground' && c.mode !== 'climb') || c.remote) continue;
    const dx = c.pos.x - at.x, dz = c.pos.z - at.z, dy = c.pos.y + 0.9 - at.y, hd = Math.hypot(dx, dz);
    const d = Math.hypot(hd, dy);
    if (d > IMPULSE.radius) continue;
    const k = 1 - d / IMPULSE.radius;
    const under = c === owner && hd < 2.6 && dy > -0.8 && dy < 2.4;
    let vx, vz, vy;
    if (under) { const sp = 9 + 3 * Math.min(1, c.moveAmt / 5); vx = Math.sin(c.yaw) * sp; vz = Math.cos(c.yaw) * sp; vy = 17.5; }
    else { const h = 7 + 13 * k, ux = hd > 0.05 ? dx / hd : Math.sin(c.yaw), uz = hd > 0.05 ? dz / hd : Math.cos(c.yaw); vx = ux * h; vz = uz * h; vy = 6 + 8 * k; }
    if (c.mode === 'climb') { c.mode = 'ground'; c.mantle = null; }
    c.vel.set(vx, Math.max(c.vel.y, vy), vz);
    c.onGround = false; c.impulseFly = true; c.pos.y += 0.05; c.emote = null; c.using = null;
    if (c.ai) c.ai.alert = 2;
    if (c.isPlayer) { touch.buzz(25); if (under) showMsg('', '🌀 Lanciato in aria!', 1.2); }
  }
}
// ── anteprima della traiettoria (tenendo premuto G) ──
const TRAJ_N = 90;
const trajGeo = new THREE.BufferGeometry();
trajGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAJ_N * 3), 3));
const trajLine = new THREE.Line(trajGeo, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.35, gapSize: 0.22, transparent: true, opacity: 0.9, depthTest: false }));
trajLine.frustumCulled = false; trajLine.visible = false; trajLine.renderOrder = 20;
scene.add(trajLine);
const trajEnd = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
trajEnd.visible = false; trajEnd.renderOrder = 21;
scene.add(trajEnd);
const _trajPts = [], _trajUp = new THREE.Vector3(0, 1, 0);
function showTrajectory(p, id) {
  const o = throwOrigin(p, _tho);
  throwVelocity(G.camYaw, G.camPitch, _thv).addScaledVector(p.vel, 0.45);
  const nrm = throwSys.predict(o, _thv, _trajPts, 2.6);
  const arr = trajGeo.attributes.position.array, n = Math.min(TRAJ_N, _trajPts.length);
  for (let i = 0; i < TRAJ_N; i++) { const q = _trajPts[Math.min(i, n - 1)]; arr[i * 3] = q.x; arr[i * 3 + 1] = q.y; arr[i * 3 + 2] = q.z; }
  trajGeo.attributes.position.needsUpdate = true;
  trajGeo.setDrawRange(0, n);
  trajLine.computeLineDistances();
  const col = id === 'frag' ? '#ffb347' : id === 'smoke' ? '#e8eef2' : '#6ad8ff';
  trajLine.material.color.set(col); trajEnd.material.color.set(col);
  trajLine.visible = true;
  const last = _trajPts[n - 1];
  trajEnd.visible = !!nrm;
  if (nrm) { trajEnd.position.copy(last).addScaledVector(nrm, 0.04); trajEnd.quaternion.setFromUnitVectors(_trajUp, nrm); const s = id === 'frag' ? 1.7 : id === 'impulse' ? 1.5 : 1.2; trajEnd.scale.setScalar(s); }
}
function hideTrajectory() { trajLine.visible = false; trajEnd.visible = false; }
/** prossimo tipo di oggetto da lancio che hai (H) */
function cycleThrow(p) {
  for (let k = 1; k <= THROW_IDS.length; k++) {
    const id = THROW_IDS[(THROW_IDS.indexOf(p.throwSel) + k) % THROW_IDS.length];
    if (p.throws[id] > 0 || k === THROW_IDS.length) { p.throwSel = id; break; }
  }
  A.playUI();
}
// ─────────────── v42: oggetti da piazzare: trampolino di lancio e trappola a spuntoni ───────────────
G.placed = [];
const _pe = new THREE.Vector3(), _plD = new THREE.Vector3(), _ps = new THREE.Vector3();
/** dove finirebbe l'oggetto: il punto guardato (fino a 7 m) se è un piano, altrimenti 2 m davanti ai piedi */
function placeSpot(p, out) {
  camera.getWorldDirection(_plD);
  const o = camera.position, hit = rayWorld(o, _plD, 14);
  let ok = false;
  if (hit) {
    _ps.copy(o).addScaledVector(_plD, hit.t);
    const g = groundAt(_ps.x, _ps.z, _ps.y + 0.3, 0.1);
    if (Math.abs(g - _ps.y) < 0.35 && Math.hypot(_ps.x - p.pos.x, _ps.z - p.pos.z) < 7 && Math.abs(g - p.pos.y) < 4) { out.set(_ps.x, g, _ps.z); ok = true; }
  }
  if (!ok) { const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); out.set(p.pos.x + fx * 2, 0, p.pos.z + fz * 2); out.y = groundAt(out.x, out.z, p.pos.y + 0.6, 0.1); }
  // valido: non in acqua, non sopra un altro oggetto, spazio libero intorno
  let valid = out.y > WATER_LEVEL - 0.3 && Math.abs(out.y - p.pos.y) < 4;
  for (const q of G.placed) if (Math.hypot(q.pos.x - out.x, q.pos.z - out.z) < 1.5 && Math.abs(q.pos.y - out.y) < 1) valid = false;
  if (valid) { _vt.set(out.x, out.y + 0.05, out.z); resolveCollisions(_vt, 0.55, 1.2); if (Math.hypot(_vt.x - out.x, _vt.z - out.z) > 0.12) valid = false; }
  if (valid && hasLineToSpot(p, out) === false) valid = false;
  return valid;
}
function hasLineToSpot(p, at) {
  const o = p.eye(_pe), d = _plD.set(at.x - o.x, at.y + 0.3 - o.y, at.z - o.z), L = d.length();
  d.divideScalar(L);
  return !rayWorld(o, d, L - 0.2);
}
const placeGhost = new THREE.Group(); placeGhost.visible = false; scene.add(placeGhost);
let placeGhostId = '';
function showPlaceGhost(p, id) {
  if (placeGhostId !== id) {
    while (placeGhost.children.length) placeGhost.remove(placeGhost.children[0]);
    const m = buildPlacedMesh(id);
    m.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: '#66ff88', transparent: true, opacity: 0.45, depthWrite: false }); o.castShadow = false; } });
    if (m.userData.spikes) m.userData.spikes.position.y = 0;
    placeGhost.add(m); placeGhostId = id;
  }
  const ok = placeSpot(p, placeGhost.position);
  placeGhost.rotation.y = p.yaw;
  placeGhost.traverse(o => { if (o.isMesh) o.material.color.set(ok ? '#66ff88' : '#ff5a5a'); });
  placeGhost.visible = true;
  return ok;
}
function placeItem(ch, id, x, y, z, yaw = ch.yaw, remote = false, key = null) {
  if (!remote) {
    if (!ch.alive || ch.mode !== 'ground' || (ch.throws[id] || 0) <= 0 || (ch.throwCd || 0) > G.time) return null;
    ch.throws[id]--; ch.throwCd = G.time + 0.5;
    key = ch.idx + ':' + (G.placeSeq = (G.placeSeq || 0) + 1);
  }
  // un massimo per giocatore: il più vecchio sparisce
  const mine = G.placed.filter(q => q.owner === ch && q.id === id);
  if (mine.length >= (id === 'pad' ? 2 : 3)) removePlaced(mine[0]);
  const mesh = buildPlacedMesh(id);
  mesh.position.set(x, y, z); mesh.rotation.y = yaw;
  scene.add(mesh);
  const P = { id, key, owner: ch, pos: new THREE.Vector3(x, y, z), mesh, t: 0, life: id === 'pad' ? PAD.life : TRAP.life, arm: id === 'pad' ? 0.25 : TRAP.arm, fired: 0, cd: new Map() };
  G.placed.push(P);
  ch.throwAnim = 0.001; ch.throwId = id; ch.emote = null;
  const d = P.pos.distanceTo(camera.position);
  if (d < 40) A.playPlace(d);
  if (d < 60) emit(_p.set(x, y + 0.15, z), id === 'pad' ? '#ffb050' : '#c9ced6', 8, 2.5, 0.4, 0.1, 0.5);
  if (ch.isPlayer) { G.matchStats.placed = (G.matchStats.placed || 0) + 1; touch.buzz(10); }
  if (G.net && !remote && (ch === G.player || (NET.role === 'host' && !ch.remote && !ch.human))) netSend({ t: 'pl', v: ch.idx, id, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), r: +yaw.toFixed(2), k: key });
  return P;
}
function removePlaced(P) {
  const i = G.placed.indexOf(P);
  if (i >= 0) G.placed.splice(i, 1);
  scene.remove(P.mesh);
}
/** trampolino: su in alto e poi il deltaplano si apre da solo (come scendendo dal bus) */
function launchFromPad(c, P) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  c.mode = 'fall'; c.padAt = G.time; c.onGround = false;
  c.vel.set(c.vel.x * 0.4 + fx * 5, PAD.vy, c.vel.z * 0.4 + fz * 5);
  c.pos.y += 0.1; c.crouch = false; c.slide = null; c.vault = null; c.using = null; c.emote = null; c.impulseFly = false;
  P.cd.set(c, G.time + 1.5);
  if (c.ai) {
    // i bot volano verso la zona sicura (o lontano da chi li insegue)
    const st = safeTarget(), tg = c.ai.target;
    let ux = st.x - c.pos.x, uz = st.z - c.pos.z;
    if (Math.hypot(ux, uz) < st.r * 0.6 && tg) { ux = c.pos.x - tg.pos.x; uz = c.pos.z - tg.pos.z; }
    const l = Math.hypot(ux, uz) || 1;
    c.ai.dropTarget.set(c.pos.x + ux / l * 55, 0, c.pos.z + uz / l * 55); c.ai.fo = null;
  }
  const d = c.pos.distanceTo(camera.position);
  A.playLaunch(c.isPlayer ? 0 : d);
  if (d < 70) { emit(_p.copy(P.pos).setY(P.pos.y + 0.3), '#ffb050', 18, 6, 0.5, 0.14, -0.4); emit(_p.copy(P.pos).setY(P.pos.y + 0.2), '#ffffff', 10, 3, 0.6, 0.2, -0.2); }
  if (c.isPlayer) { toggleBuild(false); G.throwAim = false; hideTrajectory(); placeGhost.visible = false; touch.buzz(30); showMsg('', '🚀 In volo! Il deltaplano si apre da solo', 1.6); G.matchStats.pads = (G.matchStats.pads || 0) + 1; }
}
function updatePlaced(dt) {
  for (let i = G.placed.length - 1; i >= 0; i--) {
    const P = G.placed[i];
    P.t += dt;
    const near = P.pos.distanceToSquared(camera.position) < 120 * 120;
    P.mesh.visible = near;
    if (P.t > P.life || (P.fired && G.time - P.fired > 1.6)) { removePlaced(P); continue; }
    if (P.id === 'pad') {
      if (near && P.mesh.userData.ring) P.mesh.userData.ring.material.emissiveIntensity = 1.2 + Math.sin(G.time * 5) * 0.6;
      if (P.t < P.arm) continue;
      for (const c of G.chars) {
        if (!c.alive || c.remote || c.mode !== 'ground' || c.vault || (P.cd.get(c) || 0) > G.time) continue;
        const dx = c.pos.x - P.pos.x, dz = c.pos.z - P.pos.z, dy = c.pos.y - P.pos.y;
        if (dx * dx + dz * dz < PAD.r * PAD.r && dy > -0.3 && dy < 0.7) launchFromPad(c, P);
      }
    } else if (P.id === 'trap') {
      const sp = P.mesh.userData.spikes;
      if (P.fired) { const k = Math.min(1, (G.time - P.fired) / 0.08); sp.position.y = lerp(-0.36, 0.02, k); continue; }
      if (P.t < P.arm) continue;
      for (const c of G.chars) {
        if (!c.alive || c.mode !== 'ground' || c === P.owner || isMate(P.owner, c)) continue;
        const dx = c.pos.x - P.pos.x, dz = c.pos.z - P.pos.z, dy = c.pos.y - P.pos.y;
        if (dx * dx + dz * dz < TRAP.r * TRAP.r && dy > -0.4 && dy < 0.6) {
          P.fired = G.time;
          // i danni li decide il cancello di rete come per i proiettili (chi ha piazzato la trappola)
          damage(c, TRAP.dmg, P.owner && P.owner.alive !== undefined ? P.owner : null, false, 'Trappola');
          c.trapSlowT = G.time + 1.2;
          const d = P.pos.distanceTo(camera.position);
          A.playTrap(d);
          if (d < 60) { emit(_p.copy(P.pos).setY(P.pos.y + 0.5), '#d02020', 10, 3, 0.5, 0.09); emit(_p.copy(P.pos).setY(P.pos.y + 0.2), '#fff2c0', 8, 5, 0.15, 0.05, 0.2); }
          if (c.isPlayer) { showMsg('', '🪤 Trappola!', 1.2); touch.buzz(40); }
          break;
        }
      }
    }
  }
}

/** se il tipo scelto è finito passa a uno che hai ancora */
function fixThrowSel(p) { if (p.throws[p.throwSel] > 0) return; const id = THROW_IDS.find(k => p.throws[k] > 0); if (id) p.throwSel = id; }

// ── segnalazioni rapide (ping) per la squadra: Z o rotellina del mouse ──
G.pings = [];
const PING_KIND = {
  enemy: { icon: '⚠', label: 'Nemico', color: '#ff4a4a', life: 6 },
  loot: { icon: '📦', label: 'Bottino', color: '#ffd23a', life: 10 },
  go: { icon: '📍', label: 'Andiamo qui', color: '#4ad8ff', life: 10 },
  danger: { icon: '❗', label: 'Pericolo', color: '#ff9a3a', life: 8 },
};
function addPing(kind, pos, owner, target = null, label = null, remote = false) {
  const K = PING_KIND[kind];
  // una segnalazione per giocatore (la nuova sostituisce la vecchia)
  for (let i = G.pings.length - 1; i >= 0; i--) if (G.pings[i].owner === owner) { G.pings[i].el.remove(); G.pings.splice(i, 1); }
  const el = document.createElement('div');
  el.className = 'ping ping-' + kind;
  el.style.setProperty('--pc', K.color);
  el.innerHTML = `<i><u>${K.icon}</u></i><b>${esc(label || K.label)}</b><small></small>`;
  $('#pingLayer').appendChild(el);
  const pg = { kind, pos: pos.clone(), owner, target, t: 0, life: K.life, el };
  G.pings.push(pg);
  if (owner && G.player && (owner === G.player || owner.team === G.player.team)) {
    A.playPing(kind);
    if (owner !== G.player) addFeed(`<span style="color:${K.color}">${K.icon} <b>${esc(owner.name)}</b>: ${esc(label || K.label)}</span>`, false);
  }
  // i compagni bot reagiscono: attaccano il nemico segnalato o vanno dove hai indicato
  if (owner && G.teamSize > 1) for (const m of teamOf(owner)) {
    if (m === owner || !m.alive || !m.ai || m.remote || m.mode !== 'ground') continue;
    if (kind === 'enemy' && target && target.alive) { m.ai.target = target; m.ai.lastSeen = G.time; m.ai.lastSeenPos.copy(target.pos); m.ai.alert = 4; }
    else if (kind === 'go' || kind === 'loot') { m.ai.pingGoal = pos.clone(); m.ai.pingT = G.time + 14; }
  }
  if (G.net && !remote && owner === G.player) netSend({ t: 'ping', o: owner.idx, k: kind, p: [+pos.x.toFixed(1), +pos.y.toFixed(1), +pos.z.toFixed(1)], tg: target ? target.idx : -1, l: label || '' });
  return pg;
}
const _pd = new THREE.Vector3();
function playerPing() {
  const p = G.player;
  if (!p || !p.alive || p.mode === 'bus') return;
  if ((G.pingCd || 0) > G.time) return;
  G.pingCd = G.time + 0.35;
  camera.getWorldDirection(_pd);
  const h = rayAll(camera.position, _pd, 400, p);
  const at = h ? camera.position.clone().addScaledVector(_pd, h.t) : camera.position.clone().addScaledVector(_pd, 120);
  if (!h && at.y < terrainHeight(at.x, at.z)) at.y = terrainHeight(at.x, at.z);
  // doppio tocco veloce = pericolo
  const dbl = G.time - (G.lastPingT || -9) < 0.45;
  G.lastPingT = G.time;
  if (h && h.char && h.char.alive && !(G.teamSize > 1 && h.char.team === p.team)) { addPing('enemy', h.char.pos, p, h.char, `Nemico: ${h.char.name}`); return; }
  let best = null, bd = 2.2 * 2.2;
  for (const L of G.loot) { const d = L.pos.distanceToSquared(at); if (d < bd) { bd = d; best = L; } }
  if (best) { addPing('loot', best.pos, p, null, lootPingLabel(best.item)); return; }
  addPing(dbl ? 'danger' : 'go', at, p);
}
function lootPingLabel(it) {
  if (it.kind === 'weapon') return `${WEAPONS[it.id].name} (${RARITIES[it.rarity].name})`;
  if (it.kind === 'cons') return CONSUMABLES[it.id].name;
  if (it.kind === 'throw') return THROWABLES[it.id].short;
  if (it.kind === 'ammo') return AMMO_TYPES[it.id].name;
  return 'Materiali';
}
function updatePings(dt) {
  const W = innerWidth, H = innerHeight;
  for (let i = G.pings.length - 1; i >= 0; i--) {
    const pg = G.pings[i];
    pg.t += dt;
    if (pg.target && pg.target.alive && pg.t < 3.5) pg.pos.copy(pg.target.pos);
    if (pg.t > pg.life || (pg.target && !pg.target.alive && pg.kind === 'enemy') || G.state === 'menu') { pg.el.remove(); G.pings.splice(i, 1); continue; }
    _proj.set(pg.pos.x, pg.pos.y + (pg.kind === 'enemy' ? 2.3 : 1.2), pg.pos.z).project(camera);
    let x = (_proj.x + 1) / 2 * W, y = (1 - _proj.y) / 2 * H;
    const behind = _proj.z > 1;
    // fuori dallo schermo: resta sul bordo, nella direzione giusta
    if (behind) { x = W - x; y = H - 30; }
    const off = behind || x < 30 || x > W - 30 || y < 40 || y > H - 40;
    x = clamp(x, 30, W - 30); y = clamp(y, 40, H - 40);
    pg.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    pg.el.classList.toggle('edge', off);
    pg.el.style.opacity = Math.min(1, (pg.life - pg.t) * 1.5).toFixed(2);
    const d = G.player ? Math.round(G.player.pos.distanceTo(pg.pos)) : 0;
    const sm = pg.el.lastChild; if (sm._d !== d) { sm._d = d; sm.textContent = d + ' m'; }
  }
}
/** i bot compagni segnalano da soli i nemici che avvistano (al massimo uno ogni 6 s per squadra) */
function botAutoPing(b, tgt) {
  if (G.teamSize <= 1 || !G.player || b.team !== G.player.team || !tgt) return;
  G.teamPingT = G.teamPingT || 0;
  if (G.time < G.teamPingT) return;
  if (G.pings.some(pg => pg.target === tgt)) return;
  G.teamPingT = G.time + 6;
  addPing('enemy', tgt.pos, b, tgt, `Nemico: ${tgt.name}`);
}

// ── indicatore di direzione dei danni subiti (archi rossi attorno al mirino) ──
G.dmgDirs = [];
const dmgDirCv = document.createElement('canvas');
dmgDirCv.id = 'dmgDir';
$('#hud').appendChild(dmgDirCv);
const dmgDirG = dmgDirCv.getContext('2d');
function hurtFrom(attacker, amount) {
  if (!attacker || !G.player) return;
  const p = G.player, a = Math.atan2(attacker.pos.x - p.pos.x, attacker.pos.z - p.pos.z);
  const k = clamp(amount / 35, 0.35, 1);
  const old = G.dmgDirs.find(d => d.src === attacker && d.t > 0.6);
  if (old) { old.a = a; old.t = 1.5; old.k = Math.min(1, old.k + k * 0.5); }
  else { G.dmgDirs.push({ a, t: 1.5, k, src: attacker }); if (G.dmgDirs.length > 6) G.dmgDirs.shift(); }
  G.shake = Math.max(G.shake, clamp(amount / 85, 0.07, 0.5));   // scossa proporzionale al danno
}
function drawDmgDirs(dt) {
  const S = Math.min(innerWidth, innerHeight) * 0.62, dpr = Math.min(2, devicePixelRatio || 1);
  if (dmgDirCv._s !== S) { dmgDirCv._s = S; dmgDirCv.width = dmgDirCv.height = Math.round(S * dpr); dmgDirCv.style.width = dmgDirCv.style.height = S + 'px'; }
  const g = dmgDirG, C = S / 2;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, S, S);
  if (!G.dmgDirs.length) { dmgDirCv.style.display = 'none'; return; }
  dmgDirCv.style.display = 'block';
  const R = S * 0.36, camYaw = G.camYaw;
  for (let i = G.dmgDirs.length - 1; i >= 0; i--) {
    const d = G.dmgDirs[i];
    d.t -= dt;
    if (d.t <= 0 || !G.player || !G.player.alive) { G.dmgDirs.splice(i, 1); continue; }
    if (d.src && d.src.alive && G.player) d.a = Math.atan2(d.src.pos.x - G.player.pos.x, d.src.pos.z - G.player.pos.z);
    // angolo sullo schermo: 0 = davanti (in alto), positivo = a destra
    const rel = angDiff(camYaw, d.a);
    const sa = -Math.PI / 2 - rel;
    const fade = Math.min(1, d.t / 0.6), half = 0.32 + 0.12 * d.k;
    const gr = g.createRadialGradient(C, C, R - 26, C, C, R + 10);
    gr.addColorStop(0, 'rgba(255,40,30,0)');
    gr.addColorStop(0.65, `rgba(255,40,30,${(0.85 * fade).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(255,40,30,0)');
    g.strokeStyle = gr; g.lineWidth = 22 + 12 * d.k; g.lineCap = 'round';
    g.beginPath(); g.arc(C, C, R - 8, sa - half, sa + half); g.stroke();
    // punta della freccia verso l'attaccante
    g.fillStyle = `rgba(255,70,60,${(0.95 * fade).toFixed(3)})`;
    const tx = C + Math.cos(sa) * (R + 16), ty = C + Math.sin(sa) * (R + 16), nx = Math.cos(sa), ny = Math.sin(sa);
    g.beginPath(); g.moveTo(tx + nx * 12, ty + ny * 12); g.lineTo(tx - ny * 10, ty + nx * 10); g.lineTo(tx + ny * 10, ty - nx * 10); g.closePath(); g.fill();
  }
}

// ── passi: suono diverso per superficie, posizionato a destra/sinistra, per tutti i personaggi vicini ──
const _cr = new THREE.Vector3();
function surfaceUnder(ch) {
  if (ch.inWater) return 'water';
  const x = ch.pos.x, z = ch.pos.z, th = terrainHeight(x, z);
  if (ch.pos.y > th + 0.1) {
    for (const c of queryColliders(x, z, 0.45)) {
      if (c.type === 'ramp') { if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && Math.abs(rampTop(c, x, z) - ch.pos.y) < 0.3) return 'wood'; continue; }
      if (Math.abs(c.maxY - ch.pos.y) > 0.3) continue;
      if (c.type === 'box' && (x < c.minX - 0.35 || x > c.maxX + 0.35 || z < c.minZ - 0.35 || z > c.maxZ + 0.35)) continue;
      if (c.type === 'cyl' && Math.hypot(x - c.x, z - c.z) > c.r + 0.35) continue;
      if (c.built || c.door) return 'wood';
      if (c.surf) return c.surf;
      if (c.barrel || c.car) return 'metal';
      return c.arena || c.rock || c.type === 'ring' ? 'stone' : 'wood';
    }
  }
  const b = biomeAt(x, z);   // meadow, snow, desert, autumn, tropic
  if (b[1] > 0.5) return 'snow';
  if (b[2] > 0.5 || (b[4] > 0.5 && th < WATER_LEVEL + 2.2)) return 'sand';
  return 'grass';
}
function footstep(ch) {
  const cam = camera.position;
  const dx = ch.pos.x - cam.x, dz = ch.pos.z - cam.z, d = ch.isPlayer ? 0 : Math.hypot(dx, dz, ch.pos.y - cam.y);
  if (d > 38) return;
  _cr.set(-Math.cos(G.camYaw), 0, Math.sin(G.camYaw));   // destra della camera (come in updateCamera)
  const pan = ch.isPlayer ? 0 : clamp((dx * _cr.x + dz * _cr.z) / Math.max(4, d), -1, 1);
  const loud = (ch.crouch ? 0.45 : 1) * (ch.moveAmt > 6.2 ? 1.3 : 1) * (ch.isPlayer ? 0.8 : 1.15);
  A.playStep(surfaceUnder(ch), d, pan, loud);
}

// ─────────────── v33: strutture distruttibili (effetti, macerie, materiali) ───────────────
const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
G.debris = [];
const _dq = new THREE.Quaternion(), _dax = new THREE.Vector3();
function addDebris(mat, w, h, d, x, y, z, vx, vy, vz, life, slab = false) {
  if (G.debris.length > 220) { const o = G.debris.shift(); scene.remove(o.m); }
  const m = new THREE.Mesh(debrisGeo, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = slab && w * h * d > 0.5; m.receiveShadow = true;
  scene.add(m);
  G.debris.push({ m, v: new THREE.Vector3(vx, vy, vz), av: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(slab ? 0.8 : 6), life, t: 0, slab, rest: false, hy: Math.min(w, h, d) / 2 });
}
function updateDebris(dt) {
  for (let i = G.debris.length - 1; i >= 0; i--) {
    const o = G.debris[i], m = o.m;
    o.t += dt;
    if (!o.rest) {
      o.v.y -= 22 * dt;
      m.position.addScaledVector(o.v, dt);
      const al = o.av.length();
      if (al > 0.01) { _dq.setFromAxisAngle(_dax.copy(o.av).divideScalar(al), al * dt); m.quaternion.premultiply(_dq); }
      const gy = terrainHeight(m.position.x, m.position.z) + o.hy;
      if (m.position.y < gy) {
        m.position.y = gy;
        if (o.v.y < -3 && !o.slab) { o.v.y *= -0.3; o.v.x *= 0.6; o.v.z *= 0.6; o.av.multiplyScalar(0.5); }
        else { o.rest = true; if (o.slab && o.t < 3 && m.position.distanceToSquared(camera.position) < 60 * 60) emit(m.position, '#a89c8a', 3, 2.5, 0.8, 0.25, -0.05); }
      }
    }
    const left = o.life - o.t;
    if (left < 1.2) { if (o.slab) m.position.y -= dt * 1.2; else m.scale.multiplyScalar(Math.max(0, 1 - dt * 3)); }
    if (left <= 0) { scene.remove(m); G.debris.splice(i, 1); }
  }
}
/** effetti degli eventi di rottura restituiti da world.damageAt / damageSphere */
function structEffects(ev, src, remote = false) {
  const near = (x, z, r = 140) => (x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 < r * r;
  if (ev.chipped && !ev.cells.length && src && src.isPlayer) { /* solo scheggiato: le particelle dell'impatto bastano */ }
  for (const c of ev.cells) {
    if (!near(c.x, c.z)) continue;
    const p = new THREE.Vector3(c.x, c.y, c.z);
    emit(p, c.color, 14, 4.5, 0.7, 0.16);
    emit(p, '#b8b0a4', 8, 2, 1.1, 0.35, -0.05);
    if (c.material && !c.rock) {
      const n = c.thin < 0.06 ? 2 : 4, sz = Math.min(0.5, c.s * 0.32);
      for (let k = 0; k < n; k++) addDebris(c.material, sz * rand(0.6, 1.1), sz * rand(0.6, 1.1), Math.max(0.05, Math.min(c.thin, sz)), c.x + rand(-0.4, 0.4), c.y + rand(-0.4, 0.4), c.z + rand(-0.4, 0.4), rand(-3, 3), rand(1, 4), rand(-3, 3), 3 + Math.random());
    }
    if (src && src.isPlayer) A.playBuild();
  }
  for (const o of ev.objects) {
    const p = new THREE.Vector3(o.x, o.y + o.s * 0.5, o.z);
    if (near(o.x, o.z)) {
      emit(p, o.car ? '#3a3a3a' : '#8d8a84', 22, 5, 1.2, 0.3, -0.05);
      emit(p, o.car ? '#ff9a3a' : '#a09c94', 12, 6, 0.6, 0.18);
      if (o.car) { A.playExplosion(p.distanceTo(camera.position)); G.shake = Math.max(G.shake, clamp(1 - p.distanceTo(camera.position) / 30, 0, 0.6)); }
      else A.playBuild();
    }
    if (!remote) spawnLoot({ kind: 'mats', count: o.mats }, new THREE.Vector3(o.x, terrainHeight(o.x, o.z) + 0.1, o.z), true);
  }
  for (const k of ev.collapses) {
    const visible = near(k.x, k.z, 220);
    if (visible) {
      for (const b of k.boxes) addDebris(b.material, b.w, b.h, b.d, b.x, b.y, b.z, rand(-0.8, 0.8), rand(-1, 0.5), rand(-0.8, 0.8), 5 + Math.random() * 1.5, true);
      const n = Math.min(14, 4 + Math.round((k.w + k.d) / 2));
      for (let i = 0; i < n; i++) emit(new THREE.Vector3(k.x + rand(-k.w / 2, k.w / 2), k.y + rand(0, k.h), k.z + rand(-k.d / 2, k.d / 2)), '#b0a698', 10, 3, 1.6, 0.6, -0.04);
      const d = Math.hypot(k.x - camera.position.x, k.z - camera.position.z);
      A.playExplosion(d + 15); G.shake = Math.max(G.shake, clamp(1 - d / 50, 0, 0.7));
      if (src && src.isPlayer) showMsg('', '🏚 Struttura crollata! Materiali a terra', 2.2);
    }
    if (!remote) {
      // materiali sparsi dove è crollata la struttura
      const piles = Math.min(4, 1 + Math.floor(k.mats / 60));
      for (let i = 0; i < piles; i++) {
        const x = k.x + rand(-k.w / 3, k.w / 3), z = k.z + rand(-k.d / 3, k.d / 3);
        spawnLoot({ kind: 'mats', count: Math.ceil(k.mats / piles) }, new THREE.Vector3(x, groundAt(x, z, terrainHeight(x, z) + 1) + 0.1, z), true);
      }
    }
  }
}
function structHit(c, p, amount, src) {
  const ev = world.damageAt(c, p, amount);
  structEffects(ev, src);
  if (G.net && (src === G.player || (NET.role === 'host' && src && !src.remote && !src.human))) netSend({ t: 'sdmg', p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], a: Math.round(amount) });
}
function structBlast(at, r, amount, src) {
  const ev = world.damageSphere(at, r, amount);
  structEffects(ev, src);
  if (G.net && (src === G.player || (NET.role === 'host' && src && !src.remote && !src.human))) netSend({ t: 'sdmg', p: [+at.x.toFixed(2), +at.y.toFixed(2), +at.z.toFixed(2)], a: Math.round(amount), r: +r.toFixed(2) });
}

// ─────────────── Costruzioni: muri, pavimenti e rampe (v41) ───────────────
const wallGeoX = new THREE.BoxGeometry(4, 3.6, 0.25);
const floorGeo = new THREE.BoxGeometry(4, 0.22, 4);
const RAMP_RISE = 3.5, RAMP_LEN = Math.hypot(4, RAMP_RISE);
const rampGeo = new THREE.BoxGeometry(4, 0.22, RAMP_LEN);
const BUILD_PIECES = ['wall', 'floor', 'ramp'];
const PIECE_NAME = { wall: 'Muro', floor: 'Pavimento', ramp: 'Rampa' };
const PIECE_COST = 10;
const ghostMat = new THREE.MeshBasicMaterial({ color: '#4aa0ff', transparent: true, opacity: 0.35, depthWrite: false });
const ghost = new THREE.Mesh(wallGeoX, ghostMat);
ghost.visible = false;
scene.add(ghost);
G.build.piece = 'wall';
/** dove va il pezzo: muro davanti a te; pavimento e rampa nella casella di 4 m davanti (guardando in alto: un piano più su) */
function buildSpot(p, piece = G.build.piece || 'wall') {
  const yawSnap = Math.round(p.yaw / (Math.PI / 2)) * (Math.PI / 2);
  const fx = Math.round(Math.sin(yawSnap)), fz = Math.round(Math.cos(yawSnap));
  const feet = p.onGround ? p.pos.y : groundAt(p.pos.x, p.pos.z, p.pos.y + 0.5);
  if (piece === 'wall') {
    const x = Math.round((p.pos.x + fx * 2.4) * 2) / 2, z = Math.round((p.pos.z + fz * 2.4) * 2) / 2;
    let g = Math.max(groundAt(x, z, p.pos.y + 1), WATER_LEVEL - 1.2);
    if (feet - g > 1.2) g = feet;   // in cima a pavimenti e rampe: il muro va al tuo livello, non giù a terra
    return { k: 'wall', x, z, g, yawSnap, alongX: fz !== 0 };
  }
  const x = Math.round((p.pos.x + fx * 2.6) * 2) / 2, z = Math.round((p.pos.z + fz * 2.6) * 2) / 2;
  const dir = (fx ? 'x' : 'z') + ((fx || fz) > 0 ? '+' : '-');
  if (piece === 'floor') {
    const up = G.camPitch > 0.3 ? RAMP_RISE : 0;
    const g = Math.max(feet + up, groundAt(x, z, feet + up + 0.6), WATER_LEVEL - 1.0);
    return { k: 'floor', x, z, g, yawSnap, dir, alongX: fz !== 0 };
  }
  // rampa: parte dal livello dei tuoi piedi (o dal terreno sotto il bordo vicino) e sale di un piano
  const nx = x - fx * 2, nz = z - fz * 2;
  const g = Math.max(feet, groundAt(nx, nz, feet + 0.6), WATER_LEVEL - 1.0);
  return { k: 'ramp', x, z, g, yawSnap, dir, alongX: fz !== 0 };
}
/** mostra la sagoma del pezzo che stai per costruire */
function showGhost(p) {
  const s = buildSpot(p);
  ghost.visible = true;
  ghost.rotation.set(0, 0, 0);
  if (s.k === 'wall') { ghost.geometry = wallGeoX; ghost.position.set(s.x, s.g + 1.7, s.z); ghost.rotation.y = s.alongX ? 0 : Math.PI / 2; }
  else if (s.k === 'floor') { ghost.geometry = floorGeo; ghost.position.set(s.x, s.g - 0.11, s.z); }
  else { ghost.geometry = rampGeo; placeRampMesh(ghost, s); }
  ghostMat.color.set(p.mats >= PIECE_COST ? '#4aa0ff' : '#ff4a4a');
  return s;
}
function placeRampMesh(mesh, s) {
  const ang = Math.atan2(RAMP_RISE, 4);
  mesh.position.set(s.x, s.g + RAMP_RISE / 2 - 0.1, s.z);
  // la lastra (lunga lungo z) si inclina verso la direzione in cui sale
  const yaw = s.dir === 'z+' ? 0 : s.dir === 'z-' ? Math.PI : s.dir === 'x+' ? Math.PI / 2 : -Math.PI / 2;
  mesh.rotation.set(-ang, yaw, 0, 'YXZ');
}
function placeWall(p) {
  if (p.mats < PIECE_COST) { showMsg('', 'Materiali insufficienti! Colpisci alberi e rocce col piccone', 1.6); A.playEmpty(); return; }
  const s = buildSpot(p);
  if (s.k === 'wall') {
    const hw = s.alongX ? 2 : 0.125, hd = s.alongX ? 0.125 : 2;
    for (const c of G.chars) {
      if (c.alive && (c.mode === 'ground' || c.mode === 'climb') && Math.abs(c.pos.x - s.x) < hw + CHAR_R && Math.abs(c.pos.z - s.z) < hd + CHAR_R) { A.playEmpty(); return; }
    }
  } else if (s.k === 'floor') {
    // niente pavimenti dentro le persone (all'altezza del busto)
    for (const c of G.chars) if (c.alive && c !== p && Math.abs(c.pos.x - s.x) < 2 + CHAR_R && Math.abs(c.pos.z - s.z) < 2 + CHAR_R && s.g > c.pos.y + 0.4 && s.g < c.pos.y + CHAR_H) { A.playEmpty(); return; }
  }
  // stesso pezzo già lì? niente doppioni
  if (G.walls.some(w => w.piece === s.k && Math.abs((w.minX + w.maxX) / 2 - s.x) < 0.3 && Math.abs((w.minZ + w.maxZ) / 2 - s.z) < 0.3 && Math.abs(w.baseY - s.g) < 0.5 && (s.k !== 'wall' || w.alongX === s.alongX))) { A.playEmpty(); return; }
  p.mats -= PIECE_COST;
  makeWall(s);
  if (p.isPlayer) { PR.track('build', 1); p.st.built++; }
  if (G.net) netSend({ t: 'wall', k: s.k, x: s.x, z: s.z, g: +s.g.toFixed(2), ax: s.alongX ? 1 : 0, d: s.dir || '' });
}
function makeWall(s) {
  const k = s.k || 'wall';
  const mat = new THREE.MeshStandardMaterial({ map: world.woodTex, normalMap: world.woodTex.userData.normal || null, roughness: 0.85, color: '#ffffff' });
  let mesh, c;
  if (k === 'wall') {
    const hw = s.alongX ? 2 : 0.125, hd = s.alongX ? 0.125 : 2;
    mesh = new THREE.Mesh(wallGeoX, mat);
    mesh.position.set(s.x, s.g + 1.8 - 0.1, s.z);
    mesh.rotation.y = s.alongX ? 0 : Math.PI / 2;
    c = { type: 'box', minX: s.x - hw, maxX: s.x + hw, minZ: s.z - hd, maxZ: s.z + hd, minY: s.g - 0.4, maxY: s.g + 3.5, hp: 150, maxHp: 150 };
  } else if (k === 'floor') {
    mesh = new THREE.Mesh(floorGeo, mat);
    mesh.position.set(s.x, s.g - 0.11, s.z);
    c = { type: 'box', minX: s.x - 2, maxX: s.x + 2, minZ: s.z - 2, maxZ: s.z + 2, minY: s.g - 0.22, maxY: s.g, hp: 140, maxHp: 140 };
  } else {
    mesh = new THREE.Mesh(rampGeo, mat);
    placeRampMesh(mesh, s);
    c = { type: 'ramp', dir: s.dir, minX: s.x - 2, maxX: s.x + 2, minZ: s.z - 2, maxZ: s.z + 2, minY: s.g, maxY: s.g + RAMP_RISE, hp: 140, maxHp: 140 };
  }
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  Object.assign(c, { built: true, mesh, noStand: false, piece: k, baseY: s.g, alongX: !!s.alongX });
  addCollider(c);
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
      ch.st.healed += ch.hp + ch.shield - before;   // v41
      if (G.net && NET.role === 'client') netSend({ t: 'hpset', hp: ch.hp, sh: ch.shield, relay: false });
    }
    s.count--;
    if (s.count <= 0) ch.slots[ch.active] = null;
    ch.using = null;
    ch.updateHeld();
    if (ch.isPlayer) A.playHeal();
    // v32: piccolo sbuffo colorato (verde per le cure, azzurro per gli scudi)
    if (ch.pos.distanceToSquared(camera.position) < 60 * 60) {
      const c = ch.chest(_p.set(0, 0, 0));
      emit(c, d.shield ? '#5ad0ff' : '#7dff8a', 12, 1.6, 0.7, 0.07, -0.6);
      emit(c, '#ffffff', 5, 1.2, 0.5, 0.05, -0.4);
    }
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
  // forzieri ed eventi danno solo una *probabilità* di salire di rarità (sopra la rara è molto difficile)
  let r = rollRarity(w.rar);
  for (let i = 0; i < bonus; i++) if (Math.random() < (r >= 3 ? 0.12 : r === 2 ? 0.3 : 0.5)) r++;
  r = Math.min(4, r);
  return { kind: 'weapon', id: w.id, rarity: r, mag: WEAPONS[w.id].mag };
}
function randomCons() {
  const ids = ['bandage', 'bandage', 'medkit', 'minishield', 'minishield', 'shield'];
  const id = pick(ids);
  return { kind: 'cons', id, count: CONSUMABLES[id].count, rarity: CONSUMABLES[id].rarity };
}
/** v41: oggetto da lancio a caso (fumogeni comuni, impulso raro) */
function randomThrow() {
  const r = Math.random(), id = r < 0.36 ? 'frag' : r < 0.66 ? 'smoke' : r < 0.8 ? 'impulse' : r < 0.9 ? 'trap' : 'pad';   // v42: trappole e trampolini
  return { kind: 'throw', id, count: THROWABLES[id].pickup };
}
function ammoFor(id) {
  const t = WEAPONS[id].ammo;
  return { kind: 'ammo', id: t, count: AMMO_TYPES[t].pickup };
}

function itemLabel(it) {
  if (it.kind === 'weapon') return `${WEAPONS[it.id].name} <span style="color:${RARITIES[it.rarity].color}">[${RARITIES[it.rarity].name}]</span>`;
  if (it.kind === 'cons') return `${CONSUMABLES[it.id].icon} ${CONSUMABLES[it.id].name} x${it.count}`;
  if (it.kind === 'ammo') return `${AMMO_TYPES[it.id].name} x${it.count}`;
  if (it.kind === 'throw') return `${THROWABLES[it.id].icon} ${THROWABLES[it.id].name} x${it.count}`;
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
  else if (item.kind === 'throw') { model = buildThrowMesh(item.id); model.scale.setScalar(2.4); model.rotation.z = 0.5; }
  else model = buildItemMesh(item.kind, item.id);
  model.position.y = item.kind === 'throw' ? 0.3 : 0.45;
  model.traverse(o => { if (o.isMesh) o.castShadow = false; });
  g.add(model);
  const rar = item.kind === 'weapon' ? item.rarity : (item.kind === 'cons' ? CONSUMABLES[item.id].rarity : item.kind === 'throw' ? THROWABLES[item.id].rarity : -1);
  if (rar >= 0) {
    const ring = new THREE.Mesh(ringGeo, lootMats[rar].ring);
    ring.position.y = 0.04;
    g.add(ring); L.ring = ring;
    if (rar >= 2 && item.kind === 'weapon') { const beam = new THREE.Mesh(beamGeo, lootMats[rar].beam); g.add(beam); }
  }
  g.position.copy(pos);
  scene.add(g);
  L.mesh = g; L.model = model;
}
function removeLoot(L, remote = false) {
  L.gone = true;   // v43
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
  if (it.kind === 'throw') {   // v41: vanno nella cintura, non occupano slot
    const T = THROWABLES[it.id], add = Math.min(T.max - (ch.throws[it.id] || 0), it.count);
    if (add <= 0) return false;
    ch.throws[it.id] = (ch.throws[it.id] || 0) + add; it.count -= add;
    if (ch.isPlayer && (ch.throws[ch.throwSel] || 0) <= add) ch.throwSel = it.id;
    if (it.count <= 0) removeLoot(L);
    return true;
  }
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
    if (!ch.isPlayer && it.kind === 'weapon' && WEAPONS[it.id].ammo) ch.ammo[WEAPONS[it.id].ammo] += WEAPONS[it.id].mag * 2;
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

const LOOT_FULL2 = 50 * 50;
function updateLoot(dt) {
  const cp = camera.position;
  for (const L of G.loot) {
    const d2 = L.pos.distanceToSquared(cp);
    const near = d2 < 150 * 150;
    if (near && !L.mesh) buildLootMesh(L);
    if (L.mesh) L.mesh.visible = near;
    if (!near) { if (L.pop > 0) L.pop -= dt; continue; }
    // v37: oltre i 50 m il modello (6–10 pezzi) e l'anello spariscono, resta solo la colonna di luce delle
    //  armi rare: prima centinaia di oggetti lontani costavano più draw call di tutta la città
    const close = d2 < PERF.lootFull * PERF.lootFull;
    if (L.model.visible !== close) { L.model.visible = close; if (L.ring) L.ring.visible = close; }
    if (!close) { if (L.pop > 0) L.pop -= dt; L.mesh.position.y = L.pos.y; continue; }
    // v43: l'ombra degli oggetti a terra solo da vicino (ognuno è fatto di 6–10 pezzi)
    const sh = d2 < PERF.lootShadow * PERF.lootShadow;
    if (L._sh !== sh) { L._sh = sh; L.model.traverse(o => { if (o.isMesh) { if (o.userData._cs === undefined) o.userData._cs = o.castShadow; o.castShadow = sh && o.userData._cs; } }); }
    L.bob += dt;
    L.model.rotation.y += dt * 1.2;
    L.model.position.y = 0.45 + Math.sin(L.bob * 2) * 0.08;
    if (L.pop > 0) { L.pop -= dt; L.mesh.position.y = L.pos.y + Math.sin((L.pop / 0.35) * Math.PI) * 0.8; }
    else L.mesh.position.y = L.pos.y;
  }
  // raccolta automatica di munizioni e materiali
  // v43: prima ogni personaggio controllava tutto il bottino della mappa (100 × ~1500 per frame): ora una griglia di 4 m
  lootGrid.clear();
  for (const L of G.loot) {
    if (L.pop > 0 || (L.item.kind !== 'ammo' && L.item.kind !== 'mats' && L.item.kind !== 'throw')) continue;
    const k = Math.floor(L.pos.x / 4) * 4096 + Math.floor(L.pos.z / 4);
    const a = lootGrid.get(k); if (a) a.push(L); else lootGrid.set(k, [L]);
  }
  if (!lootGrid.size) return;
  for (const c of G.chars) {
    if (!c.alive || c.mode !== 'ground' || c.remote) continue;
    const gx = Math.floor(c.pos.x / 4), gz = Math.floor(c.pos.z / 4);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
    const cell = lootGrid.get((gx + ox) * 4096 + gz + oz);
    if (!cell) continue;
    for (const L of cell) {
      if (L.gone) continue;
      if (L.item.kind === 'throw' && (c.throws[L.item.id] || 0) >= THROWABLES[L.item.id].max) continue;
      const dx = L.pos.x - c.pos.x, dz = L.pos.z - c.pos.z;
      if (dx * dx + dz * dz < 1.6 && Math.abs(L.pos.y - c.pos.y) < 1.5) {
        if (c.isPlayer) { dmgNumber(L.pos.clone().setY(L.pos.y + 1), '+' + Math.min(L.item.count, L.item.kind === 'throw' ? THROWABLES[L.item.id].max - (c.throws[L.item.id] || 0) : 999) + ' ' + (L.item.kind === 'mats' ? '🪵' : L.item.kind === 'throw' ? THROWABLES[L.item.id].icon : AMMO_TYPES[L.item.id].short), 'shield'); A.playPickup(); }
        pickupLoot(c, L);
      }
    }
    }
  }
}
const lootGrid = new Map();
const humansNow = [];

// ─────────────── v34: pre-riscaldamento (shader, texture, icone) ───────────────
// Le prime partite scattavano perché ogni materiale nuovo (armi, oggetti, forzieri, deltaplani…) veniva
// compilato la prima volta che compariva sullo schermo, e le icone delle armi venivano disegnate a richiesta
// (con un contesto WebGL a parte) proprio durante il combattimento. Ora tutto si prepara in anticipo.
let warmProto = null, warmWallMat = null;
function warmGroup() {
  if (warmProto) return warmProto;
  const g = new THREE.Group(); g.name = 'warmup';
  let i = 0;
  const add = o => { if (!o) return; o.position.set((i % 12) * 1.6, -400, Math.floor(i / 12) * 1.6); i++; g.add(o); };
  const tryAdd = f => { try { add(f()); } catch (e) { console.warn('warmup', e && e.message); } };
  for (const id of Object.keys(WEAPONS)) for (const r of [0, 1, 2, 3, 4]) tryAdd(() => buildWeaponMesh(id, r));
  tryAdd(() => buildPickaxe());
  for (const id of Object.keys(CONSUMABLES)) { tryAdd(() => buildItemMesh('cons', id)); tryAdd(() => heldConsumable(id)); }
  for (const id of Object.keys(AMMO_TYPES)) tryAdd(() => buildItemMesh('ammo', id));
  tryAdd(() => buildItemMesh('mats', 'wood'));
  tryAdd(() => buildChestMesh().g);
  for (const gd of GLIDERS) tryAdd(() => buildGlider(gd));
  for (const lm of lootMats) { add(new THREE.Mesh(ringGeo, lm.ring)); add(new THREE.Mesh(beamGeo, lm.beam)); }
  add(new THREE.Mesh(wallGeoX, ghostMat));
  g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  warmProto = g;
  return g;
}
/** compile() sceglie la variante dello shader in base a dove si disegna: con il post-processing la scena va in
 *  un render target (uscita lineare), senza va sullo schermo (sRGB). Si compila con la stessa destinazione. */
function compileFor(obj, target = null) {
  const prev = renderer.getRenderTarget();
  try { renderer.setRenderTarget(gfx.target || null); return renderer.compileAsync(obj, camera, target || undefined).catch(() => null); }
  finally { renderer.setRenderTarget(prev); }
}
function warmTextures(root) {
  const seen = new Set();
  root.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap']) {
      const t = m[k];
      if (t && t.isTexture && !seen.has(t) && t.image) { seen.add(t); try { renderer.initTexture(t); } catch { /* immagine non pronta */ } }
    }
  });
}
/** compila in parallelo tutti i materiali della scena + gli oggetti che compariranno più avanti */
function warmUp() {
  const t0 = performance.now();
  const g = warmGroup();
  // un muro costruito usa il legno dell'isola corrente
  const wm = warmWallMat || (warmWallMat = new THREE.MeshStandardMaterial({ roughness: 0.85, color: '#ffffff' }));
  wm.map = world.woodTex || null; wm.normalMap = world.woodTex && world.woodTex.userData.normal || null; wm.needsUpdate = true;
  const wall = new THREE.Mesh(wallGeoX, wm);
  wall.castShadow = wall.receiveShadow = true; wall.position.y = -400; wall.frustumCulled = false;
  g.add(wall);
  scene.add(g);
  let p;
  try {
    scene.updateMatrixWorld();
    p = compileFor(scene);
    warmTextures(scene);
  } catch (e) { console.warn('warmup', e && e.message); p = Promise.resolve(); }
  scene.remove(g); g.remove(wall);
  G.warmMs = Math.round(performance.now() - t0);
  return p;
}
/** v34: scarica in sottofondo i personaggi di tutte le skin (prima arrivavano durante la partita, uno per ogni skin
 *  vista per la prima volta) e prepara subito shader e texture di ciascuno */
const skinWarmed = new Set();
function warmSkin(id) {
  if (skinWarmed.has(id)) return;
  const skin = SKINS.find(k => k.id === id);
  if (!skin) return;
  skinWarmed.add(id);
  try {
    const o = realWarmObject(skin);
    if (!o) return;
    o.updateMatrixWorld(true);
    compileFor(o, scene);
    warmTextures(o);
  } catch (e) { console.warn('warm skin', id, e && e.message); }
}
function preloadSkins(first = []) {
  const ids = [...new Set([...first, ...ALL_SKIN_MODELS()])];
  for (const id of ids) loadSkinModel(id).then(b => { if (b) warmSkin(id); });
  if (first.length) prioritizeSkins(first);
}
/** v34: alla prima partita aspetta (al massimo maxMs) che i personaggi siano pronti, invece di scaricarli giocando */
async function skinsReady(maxMs = 25000, keepOpen = false) {   // v40: keepOpen = subito dopo si carica l'isola (stessa schermata)
  let st = skinLoadStatus();
  if (st.done >= st.total) return;
  preloadSkins([settings.skin]);
  const ld = $('#loading');
  ld.classList.remove('hidden');
  const t0 = performance.now();
  while (st.done < st.total && performance.now() - t0 < maxMs) {
    LD(0.04 + 0.14 * st.done / Math.max(1, st.total), `Preparazione dei personaggi… ${st.done}/${st.total}`);
    await new Promise(r => setTimeout(r, 120));
    st = skinLoadStatus();
  }
  if (!keepOpen) ld.classList.add('hidden');
}
function preloadIcons() {
  const jobs = [];
  for (const id of Object.keys(WEAPONS)) for (let r = 0; r < RARITIES.length; r++) jobs.push(() => weaponIcon(id, r));
  for (const id of Object.keys(CONSUMABLES)) jobs.push(() => consIcon(id));
  for (const id of Object.keys(AMMO_TYPES)) jobs.push(() => ammoIcon(id));
  const step = () => {
    // si lavora nel menu, nel bus e a fine partita; durante il gioco vero si aspetta
    if (G.state === 'play' && !G.spectate) { setTimeout(step, 500); return; }
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < 12) { try { jobs.shift()(); } catch { /* icona non disponibile */ } }
    G.iconJobs = jobs.length;
    if (jobs.length) setTimeout(step, 30);
  };
  setTimeout(step, 1200);
}

// Forzieri: modello 3D in models3d.js
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
  const w = randomWeapon(G.goldT > 0 ? 2 : 1);   // evento "bottino d'oro": rarità superiore
  const items = [w, ammoFor(w.id), randomCons(), { kind: 'mats', count: 30 }];
  if (Math.random() < 0.5) items.push(randomThrow());   // v41
  items.forEach((it, i) => {
    const a = c.rot + (i - (items.length - 1) / 2) * 0.6;
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
  vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  // v24: strisce senza aliasing (si sfumano quando diventano più fitte dei pixel) e muro che svanisce da lontano:
  // prima all'orizzonte comparivano grossi "denti" chiari o scuri
  fragmentShader: `uniform float time; varying vec2 vUv; varying vec3 vW;
    float band(float x) { float w = fwidth(x); return mix(sin(x) * 0.5 + 0.5, 0.5, smoothstep(0.6, 2.2, w)); }
    void main(){
      float s = band(vUv.x * 600.0 + time * 1.5 + sin(vUv.y * 30.0 + time) * 3.0);
      float s2 = band(vUv.x * 230.0 - time * 0.8 + vUv.y * 50.0);
      float a = 0.2 + 0.16 * s * s2;
      // alto e sfumato in cima; più basso visto da lontano
      a *= smoothstep(0.85, 0.2, vUv.y);
      float dist = distance(vW.xz, cameraPosition.xz);
      a *= 1.0 - smoothstep(220.0, 520.0, dist) * 0.92;
      a *= 1.0 - smoothstep(cameraPosition.y + 40.0, cameraPosition.y + 160.0, vW.y) * step(260.0, dist);
      gl_FragColor = vec4(mix(vec3(0.45,0.15,0.85), vec3(0.85,0.5,1.0), s * 0.5), a);
    }`,
});
const stormWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 260, 128, 1, true), stormMat);
stormWall.position.y = 90;
stormWall.renderOrder = 2;
scene.add(stormWall);

/** v37: fasi della tempesta (quelle del duello sono brevi e strette) */
const PH = () => (G.duel ? DUEL_PHASES : STORM_PHASES);
function newStorm() {
  if (G.duel) {
    // duello: arena di 75 m attorno al punto scelto dall'host
    const d = G.duel, R = 75;
    const s = { phase: 0, state: 'wait', timer: DUEL_PHASES[0].wait, cx: d.x, cz: d.z, r: R, dps: 1, fx: d.x, fz: d.z, fr: R, tx: d.x, tz: d.z, tr: DUEL_PHASES[0].radius, tick: 0 };
    pickNextCircle(s);
    return s;
  }
  const s = { phase: 0, state: 'wait', timer: STORM_PHASES[0].wait, cx: 0, cz: 0, r: 300 * SCALE, dps: 1, fx: 0, fz: 0, fr: 300 * SCALE, tx: 0, tz: 0, tr: 150 * SCALE, tick: 0 };
  pickNextCircle(s);
  return s;
}
function pickNextCircle(s) {
  const ph = PH()[s.phase];
  s.tr = ph.radius;
  const maxOff = Math.max(0, Math.min(s.r, 190 * SCALE) - ph.radius) * (G.duel ? 0.4 : 0.8);
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
      s.state = 'shrink'; s.timer = PH()[s.phase].shrink;
      s.fx = s.cx; s.fz = s.cz; s.fr = s.r;
      s.dps = PH()[s.phase].dps;
      if (G.player.alive) showMsg('LA TEMPESTA SI RESTRINGE!', 'Raggiungi la zona sicura', 3);
    } else if (s.state === 'shrink') {
      const ph = PH()[s.phase];
      const k = clamp(1 - s.timer / ph.shrink, 0, 1);
      s.cx = lerp(s.fx, s.tx, k); s.cz = lerp(s.fz, s.tz, k); s.r = lerp(s.fr, s.tr, k);
      if (s.timer <= 0) {
        s.phase++;
        if (s.phase >= PH().length) { s.state = 'done'; }
        else { s.state = 'wait'; s.timer = PH()[s.phase].wait; pickNextCircle(s); }
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
    showMsg('', tk('Premi SPAZIO per aprire il deltaplano prima', 'Tocca APRI per il deltaplano prima'), 3);
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
  // eliche, fiamma del bruciatore, lampeggiante, bandiere e fumo dello scarico
  const u = busMesh.userData;
  if (u.props) for (const pr of u.props) pr.rotation.z += dt * 22;
  if (u.flame) { const f = 0.85 + Math.random() * 0.3; u.flame.scale.set(f, 0.7 + Math.random() * 0.6, f); }
  if (u.beacon) u.beacon.rotation.y += dt * 7;
  if (u.flags) u.flags.forEach((f, i) => { f.rotation.y = Math.sin(G.time * 5 + i * 1.7) * 0.18; });
  if (u.exhaust && busMesh.visible && (B._smk = (B._smk || 0) - dt) <= 0 && busMesh.position.distanceToSquared(camera.position) < 120 * 120) {
    B._smk = 0.12;
    emit(busMesh.localToWorld(_p.copy(u.exhaust)), '#7a7a7a', 1, 0.8, 1.1, 0.32, -0.15);
  }
  if (k > 0.93) for (const c of G.chars) if (c.alive && c.mode === 'bus') jumpFromBus(c);
  if (k > 1.3) busMesh.visible = false;
  for (const c of G.chars) if (c.mode === 'bus') c.pos.copy(B.pos);
}

// ─────────────── Intelligenza artificiale dei bot ───────────────
const WEAPON_VALUE = { pistol: 1, smg: 2, shotgun: 2.4, ar: 2.7, sniper: 2.3, rocket: 2.4, revolver: 1.5, compact: 1.9, burst: 2.6, heavyar: 2.6, dmr: 2.4, tactical: 2.3, drum: 2.5, hunting: 2.1, minigun: 2.6, lmg: 2.7, doublebarrel: 2.3, handcannon: 1.7, crossbow: 2.2, grenade: 2.5, silenced: 2.1 };
function weaponScore(s, dist) {
  if (!s || s.kind !== 'weapon') return -1;
  const id = s.id;
  let v;
  switch (WEAPONS[id].role) {
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
    coverCd: 0, throwCd: 0, flankSide: Math.random() < 0.5 ? -1 : 1, flankT: 0, fleeT: 0, pingGoal: null, pingT: 0,   // v41
  };
}

/** erba alta: un personaggio accovacciato dentro si vede solo da vicino (o se ha appena sparato) */
function hideRange(c) { return G.time - (c.lastShotT ?? -99) < 1.5 ? 25 : 10; }
function dist0(a, b) { return a.pos.distanceTo(b.pos); }
function botThink(b) {
  const ai = b.ai;
  // scegli il bersaglio
  let tgt = ai.target && ai.target.alive && ai.target.mode !== 'bus' && !isMate(b, ai.target) ? ai.target : null;
  if (tgt && tgt.pos.distanceTo(b.pos) > 130) tgt = null;
  if (!tgt || Math.random() < (botDiff(b).aggro || 0.15)) {
    let best = null, bd = Infinity;
    // v21: vista più corta e campo visivo più stretto → incontri più rari, partite più lunghe
    const range = (b.slots.some(s => s && s.kind === 'weapon' && WEAPONS[s.id].role === 'sniper') ? 85 : 55) * (botDiff(b).sight || 1);
    for (const c of G.chars) {
      if (c === b || !c.alive || c.mode === 'bus' || c.mode === 'fall') continue;
      if (isMate(b, c)) continue;
      const d = c.pos.distanceTo(b.pos);
      if (d > (c.human ? range : range * 0.38) || d >= bd) continue;
      if (c.hidden && d > hideRange(c)) continue;
      const ang = Math.abs(angDiff(b.yaw, Math.atan2(c.pos.x - b.pos.x, c.pos.z - b.pos.z)));
      if (ang > 1.35 && d > 9 && ai.alert <= 0) continue;
      if (!hasLOS(b, c)) continue;
      best = c; bd = d;
    }
    if (best) tgt = best;
  }
  let los = false;
  if (tgt) {
    los = hasLOS(b, tgt) && !(tgt.hidden && dist0(b, tgt) > hideRange(tgt));
    if (los) {
      if (ai.target !== tgt) { ai.seenT = 0; botAutoPing(b, tgt); }
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

  // v41: tattica: al riparo a curarsi, fuga, aggiramento, granate e fumogeni
  if (botTactics(b, tgt, los, hasWeapon, dist, inStormNow)) return;
  if (tgt && los && hasWeapon && !inStormNow) { ai.state = 'fight'; ai.goal = null; ai.goalLoot = ai.goalChest = null; return; }
  if (tgt && los && !hasWeapon) {
    // fuggi e cerca armi
    ai.state = 'flee';
  }
  if (tgt && !los && hasWeapon && !inStormNow) { ai.state = 'chase'; ai.goalLoot = ai.goalChest = null; ai.goal = flankGoal(b, tgt); return; }

  // cura
  ai.healCd -= 0.3;
  const lostT = tgt ? G.time - ai.lastSeen : 99;
  if ((!tgt || (!los && lostT > 1.2)) && ai.healCd <= 0 && !inStormNow && (b.hp < 75 || b.shield < 50)) {
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
  // v37: duello: niente giri per forzieri, il bot va a cercare l'avversario (sa più o meno dov'è, come se lo sentisse)
  if (G.duel && hasWeapon) {
    let foe = null, fd = Infinity;
    for (const c of G.chars) { if (c === b || !c.alive || isMate(b, c)) continue; const d = dist0(b, c); if (d < fd) { fd = d; foe = c; } }
    if (foe) {
      if (ai.state !== 'chase' || !ai.goal || ai.goal.distanceTo(b.pos) < 4 || Math.random() < 0.1) ai.goal = new THREE.Vector3(foe.pos.x + rand(-6, 6), 0, foe.pos.z + rand(-6, 6));
      ai.state = 'chase'; ai.goalLoot = ai.goalChest = null;
      return;
    }
  }
  // squadra: resta vicino al capogruppo (umano: molto vicino, bot: più libero)
  const L = leaderOf(b);
  if (L && L.mode !== 'bus' && L.mode !== 'fall' && L.mode !== 'glide') {
    const far = L.human ? 16 : 30, dl = Math.hypot(L.pos.x - b.pos.x, L.pos.z - b.pos.z);
    if (dl > far || (ai.state === 'follow' && dl > far * 0.45)) {
      if (!ai.fo) ai.fo = { x: rand(-3.5, 3.5), z: rand(-3.5, 3.5) };
      ai.state = 'follow'; ai.goalLoot = ai.goalChest = null;
      ai.goal = new THREE.Vector3(L.pos.x + ai.fo.x, 0, L.pos.z + ai.fo.z);
      return;
    }
    if (ai.state === 'follow') ai.state = 'idle';
  }
  // v41: un compagno ha segnalato un punto: andiamo lì
  if (ai.pingGoal && G.time < ai.pingT) {
    if (Math.hypot(ai.pingGoal.x - b.pos.x, ai.pingGoal.z - b.pos.z) > 4) { ai.state = 'follow'; ai.goal = ai.pingGoal.clone(); ai.goalLoot = ai.goalChest = null; return; }
    ai.pingGoal = null;
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

// ─────────────── v41: tattica dei bot ───────────────
const _cv = new THREE.Vector3(), _cv2 = new THREE.Vector3(), _ce = new THREE.Vector3();
/** il punto (x, z) è dentro un ostacolo? */
function blockedAt(x, z, y) {
  for (const c of queryColliders(x, z, 0.5)) {
    if (c.maxY < y + 0.5 || c.minY > y + 1.7) continue;
    if (c.type === 'box') { if (x > c.minX - 0.45 && x < c.maxX + 0.45 && z > c.minZ - 0.45 && z < c.maxZ + 0.45) return true; }
    else if (c.type === 'cyl') { if (Math.hypot(x - c.x, z - c.z) < c.r + 0.45) return true; }
  }
  return false;
}
/** un riparo vicino: un punto da cui la minaccia non ti vede (preferendo quelli lontani da lei) */
function findCover(b, threat) {
  const eye = threat.eye(_ce);
  const away = Math.atan2(b.pos.x - threat.pos.x, b.pos.z - threat.pos.z);
  let best = null, bs = Infinity;
  for (const r of [3.5, 6, 9, 13]) {
    for (let k = 0; k < 10; k++) {
      const a = away + (k - 4.5) * 0.55;
      const x = b.pos.x + Math.sin(a) * r, z = b.pos.z + Math.cos(a) * r;
      if (Math.abs(x) > HALF - 12 || Math.abs(z) > HALF - 12) continue;
      const g = groundAt(x, z, b.pos.y + 2);
      if (g < WATER_LEVEL - 0.6 || Math.abs(g - b.pos.y) > 2.2) continue;
      if (blockedAt(x, z, g)) continue;
      // nascosto? raggio dagli occhi della minaccia al petto nel punto
      _cv.set(x, g + 1.25, z); _cv2.subVectors(_cv, eye);
      const L = _cv2.length(); _cv2.divideScalar(L);
      const h = rayWorld(eye, _cv2, L - 0.3);
      if (!h || h.t > L - 1) continue;
      const sc = r + Math.abs(k - 4.5) * 0.9 + (threat.pos.distanceTo(_cv) < 8 ? 10 : 0);
      if (sc < bs) { bs = sc; best = new THREE.Vector3(x, 0, z); }
    }
    if (best) break;   // il riparo più vicino che funziona
  }
  return best;
}
/** aggiramento: invece di correre dritto dove l'hai visto, arriva di lato (i compagni da lati opposti) */
function flankGoal(b, tgt) {
  const ai = b.ai, lp = ai.lastSeenPos;
  const dx = lp.x - b.pos.x, dz = lp.z - b.pos.z, d = Math.hypot(dx, dz);
  const D = botDiff(b);
  if (d < 11 || (D.tactics || 0.7) < 0.5) return lp.clone();
  if (ai.flankTgt !== tgt) { ai.flankTgt = tgt; ai.flankSide = (b.idx & 1) ? 1 : -1; if (Math.random() < 0.3) ai.flankSide *= -1; ai.flankT = 0; }
  const ux = dx / d, uz = dz / d, off = Math.min(13, d * 0.55) * ai.flankSide;
  const gx = lp.x - ux * d * 0.35 - uz * off, gz = lp.z - uz * d * 0.35 + ux * off;
  if (blockedAt(gx, gz, groundAt(gx, gz, b.pos.y + 2))) return lp.clone();
  // arrivato al punto laterale: ora vai sul bersaglio
  if (Math.hypot(gx - b.pos.x, gz - b.pos.z) < 4 || ai.flankT > 9) return lp.clone();
  ai.flankT += 0.3;
  return new THREE.Vector3(gx, 0, gz);
}
/** prova a lanciare: vero se la traiettoria prevista arriva vicino al punto voluto */
const _tp = [];
function botThrow(b, id, at, tol = 3.5) {
  if ((b.throws[id] || 0) <= 0 || (b.throwCd || 0) > G.time || b.using || b.mode !== 'ground') return false;
  const o = throwOrigin(b, _tho), sol = aimThrow(o, at);
  const D = botDiff(b), err = (D.aimError || 0.07) * 0.6;
  const yaw = sol.yaw + rand(-err, err), pitch = sol.pitch + rand(-err, err) * 0.5;
  throwVelocity(yaw, pitch, _thv, sol.speed);
  throwSys.predict(o, _thv, _tp, 3);
  const end = _tp[_tp.length - 1];
  if (!end || Math.hypot(end.x - at.x, end.z - at.z) > tol || Math.abs(end.y - at.y) > 3) { b.ai.throwCd = G.time + 1.2; return false; }
  b.yaw = sol.yaw;
  return throwItem(b, id, yaw, pitch, sol.speed);
}
function botTactics(b, tgt, los, hasWeapon, dist, inStorm) {
  const ai = b.ai, D = botDiff(b), T = D.tactics ?? 0.7;
  if (!tgt || inStorm || b.mode !== 'ground' || b.inWater) { if (ai.state === 'cover' || ai.state === 'flee2') ai.state = 'idle'; return false; }
  const hpT = b.hp + b.shield;
  const healI = b.slots.findIndex(sl => sl && sl.kind === 'cons' && canUse(b, sl.id));
  const lostT = G.time - ai.lastSeen;
  const canThrow = ai.throwCd <= G.time && (b.throwCd || 0) <= G.time;
  // 1) poca vita: cerca un riparo (con un fumogeno fra te e lui, se ce l'hai) e curati lì
  if (hpT < 55 && Math.random() < T + 0.25) {
    if (ai.state !== 'cover' && ai.coverCd <= G.time) {
      ai.coverCd = G.time + 2.5;
      const cp = findCover(b, tgt);
      if (cp) {
        ai.state = 'cover'; ai.goal = cp; ai.goalLoot = ai.goalChest = null; ai.coverT = 0;
        if (los && canThrow && dist < 40 && Math.random() < T) {
          _cv.set(lerp(b.pos.x, tgt.pos.x, 0.25), 0, lerp(b.pos.z, tgt.pos.z, 0.25)); _cv.y = groundAt(_cv.x, _cv.z, b.pos.y + 2);
          botThrow(b, 'smoke', _cv, 5);
        }
        return true;
      }
    }
    if (ai.state === 'cover' && ai.goal) {
      ai.coverT = (ai.coverT || 0) + 0.3;
      const arrived = Math.hypot(ai.goal.x - b.pos.x, ai.goal.z - b.pos.z) < 1.4;
      if (!los && (arrived || lostT > 0.8) && healI >= 0) {
        // v42: prima di curarsi piazza una trappola verso dove arriverà il nemico
        if (b.throws.trap > 0 && Math.random() < T) {
          const ux = ai.lastSeenPos.x - b.pos.x, uz = ai.lastSeenPos.z - b.pos.z, ul = Math.hypot(ux, uz) || 1, tx = b.pos.x + ux / ul * 1.8, tz = b.pos.z + uz / ul * 1.8, ty = groundAt(tx, tz, b.pos.y + 0.6, 0.1);
          if (Math.abs(ty - b.pos.y) < 0.6 && !G.placed.some(q => q.pos.distanceTo(_cv.set(tx, ty, tz)) < 1.5)) placeItem(b, 'trap', tx, ty, tz, Math.atan2(ux, uz));
        }
        b.setActive(healI); startUse(b); ai.state = 'heal'; ai.goal = null; ai.healCd = 2; return true;
      }
      if (!arrived && ai.coverT < 6) return true;
      ai.state = 'idle'; ai.goal = null;   // niente cure o riparo scoperto: torna a combattere
    }
    // 2) quasi morto, niente cure e lui è vicino e più in forma: scappa (zigzagando)
    if (healI < 0 && hpT < 35 && dist < 28 && tgt.hp + tgt.shield > hpT + 25 && Math.random() < T) {
      ai.state = 'flee2'; ai.fleeT = G.time + rand(2.5, 4.5); ai.goal = null;
      // impulso sotto i piedi o fra te e lui per allontanarlo
      if (canThrow && dist < 9 && b.throws.impulse > 0 && Math.random() < 0.6) { _cv.copy(tgt.pos); botThrow(b, 'impulse', _cv, 4); }
      else if (b.throws.pad > 0 && b.onGround && Math.random() < 0.7) placeItem(b, 'pad', b.pos.x, b.pos.y, b.pos.z);   // v42: trampolino sotto i piedi e via
      return true;
    }
  } else if (ai.state === 'cover') ai.state = 'idle';
  if (ai.state === 'flee2' && G.time < ai.fleeT) return true;
  if (ai.state === 'flee2') ai.state = 'idle';
  if (!hasWeapon) return false;
  // 3) granata dove l'hai visto sparire dietro un riparo, o su chi sta fermo/accovacciato o dentro i muri costruiti
  if (canThrow && b.throws.frag > 0 && Math.random() < T * 0.55) {
    const dl = Math.hypot(ai.lastSeenPos.x - b.pos.x, ai.lastSeenPos.z - b.pos.z);
    const camping = los && dist > 8 && dist < 32 && (tgt.crouch || tgt.moveAmt < 0.8 || G.walls.some(w => Math.hypot((w.minX + w.maxX) / 2 - tgt.pos.x, (w.minZ + w.maxZ) / 2 - tgt.pos.z) < 3.2));
    const hiding = !los && lostT > 0.8 && lostT < 6 && dl > 8 && dl < 32;
    if (camping || hiding) {
      _cv.copy(hiding ? ai.lastSeenPos : tgt.pos);
      if (botThrow(b, 'frag', _cv, 3.2)) { ai.throwCd = G.time + rand(5, 9); return false; }
    }
  }
  return false;
}

function botWants(b, it) {
  if (it.kind === 'weapon' && WEAPONS[it.id].melee) return 0;   // v38: gli Artigli sono per i giocatori
  if (it.kind === 'ammo') return b.slots.some(s => s && s.kind === 'weapon' && WEAPONS[s.id].ammo === it.id) ? 0.8 : 0.1;
  if (it.kind === 'mats') return 0.1;
  if (it.kind === 'throw') return (b.throws[it.id] || 0) < THROWABLES[it.id].max ? 0.6 : 0;
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
    if (it.kind === 'ammo' || it.kind === 'mats' || it.kind === 'throw') continue;
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
// v43: griglia delle case (celle di 16 m): prima ogni bot scorreva tutte le case della mappa 3 volte per frame
const HG = { ref: null, n: -1, map: new Map() };
const EMPTY = [];
function housesNear(x, z) {
  const W = world.houses;
  if (HG.ref !== W || HG.n !== W.length) {
    HG.ref = W; HG.n = W.length; HG.map.clear();
    for (const h of W) {
      const x0 = Math.floor((h.cx - h.w / 2 - 1) / 16), x1 = Math.floor((h.cx + h.w / 2 + 1) / 16);
      const z0 = Math.floor((h.cz - h.d / 2 - 1) / 16), z1 = Math.floor((h.cz + h.d / 2 + 1) / 16);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 4096 + j, a = HG.map.get(k); if (a) a.push(h); else HG.map.set(k, [h]); }
    }
  }
  return HG.map.get(Math.floor(x / 16) * 4096 + Math.floor(z / 16)) || EMPTY;
}
function houseAt(x, z, y) {
  for (const h of housesNear(x, z)) {
    if (h.collapsed) continue;
    if (Math.abs(x - h.cx) < h.w / 2 - 0.15 && Math.abs(z - h.cz) < h.d / 2 - 0.15 && (y === undefined || y < h.roofTop - 0.5)) return h;
  }
  return null;
}
// Navigazione semplice: passa dalle porte per entrare/uscire dalle case
function navPoint(b, goal) {
  // sul tetto? scendi dal bordo più vicino
  for (const h of housesNear(b.pos.x, b.pos.z)) {
    if (!h.collapsed && b.pos.y > h.roofTop - 0.6 && Math.abs(b.pos.x - h.cx) < h.w / 2 + 0.4 && Math.abs(b.pos.z - h.cz) < h.d / 2 + 0.4) {
      const ex = h.w / 2 - Math.abs(b.pos.x - h.cx), ez = h.d / 2 - Math.abs(b.pos.z - h.cz);
      if (ex < ez) return _nav.set(h.cx + Math.sign(b.pos.x - h.cx || 1) * (h.w / 2 + 2), 0, b.pos.z);
      return _nav.set(b.pos.x, 0, h.cz + Math.sign(b.pos.z - h.cz || 1) * (h.d / 2 + 2));
    }
  }
  const hb = houseAt(b.pos.x, b.pos.z, b.pos.y), hg = houseAt(goal.x, goal.z);
  // v24: palazzi a più piani → usa le rampe di scale
  const fl = hb && hb.stair && hb.stair.flights;
  if (fl && fl.length) {
    const fNow = Math.max(0, Math.floor((b.pos.y - hb.baseY + 0.4) / 3));
    const gy = hb === hg && goal.y !== undefined && goal.y > hb.baseY - 1 ? goal.y : hb.baseY;
    const fGoal = Math.max(0, Math.floor((gy - hb.baseY + 0.4) / 3));
    if (fNow !== fGoal) {
      const onF = fl.find(f => b.pos.x > f.box[0] - 0.1 && b.pos.x < f.box[1] + 0.1 && b.pos.z > f.box[2] - 0.1 && b.pos.z < f.box[3] + 0.1);
      if (fGoal > fNow) {
        const f = fl[Math.min(fNow, fl.length - 1)];
        return onF ? _nav.set(f.ex, 0, f.ez) : _nav.set(f.sx, 0, f.sz);
      }
      const f = fl[Math.min(fNow - 1, fl.length - 1)];
      if (f) return onF ? _nav.set(f.sx, 0, f.sz) : _nav.set(f.ex, 0, f.ez);
    }
  }
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
const _bv = new THREE.Vector3();
function updateBot(b, dt) {
  const ai = b.ai;
  if (!b.alive) return;
  const Ld = G.teamSize > 1 ? leaderOf(b) : null;
  if (b.mode === 'bus') {
    // i compagni bot di un umano saltano subito dopo di lui
    if (Ld && Ld.human) {
      if (Ld.mode !== 'bus') { if (ai.followJump == null) ai.followJump = G.bus.t + rand(0.25, 1.4); if (G.bus.t >= ai.followJump) jumpFromBus(b); }
    } else if (G.bus.t >= ai.jumpT) jumpFromBus(b);
    return;
  }
  if (b.mode === 'fall' || b.mode === 'glide') {
    if (Ld && Ld.human && Ld.alive && Ld.mode !== 'bus') {
      if (!ai.fo) ai.fo = { x: rand(-4, 4), z: rand(-4, 4) };
      ai.dropTarget.set(Ld.pos.x + ai.fo.x * 1.6, 0, Ld.pos.z + ai.fo.z * 1.6);
    }
    const dx = ai.dropTarget.x - b.pos.x, dz = ai.dropTarget.z - b.pos.z;
    const d = Math.hypot(dx, dz);
    const mx = d > 2 ? dx / d : 0, mz = d > 2 ? dz / d : 0;
    if (d > 1) b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), dt * 3);
    airMove(b, mx * Math.min(1, d / 10), mz * Math.min(1, d / 10), dt, d < 25);
    return;
  }
  if (b.mode === 'climb') { updateClimb(b, dt, true, false, false); return; }
  if (b.vault) { groundMove(b, 0, 0, 0, dt, false); return; }   // v42
  ai.alert -= dt;
  ai.think -= dt;
  const gkey = ai.goalLoot || ai.goalChest || ai.goal;
  if (gkey !== ai._g) { ai._g = gkey; ai.goalT = 0; }
  ai.goalT = (ai.goalT || 0) + dt;
  if (ai.goal && ai.goalT > 20 && ai.state !== 'zone') { ai.goalT = 0; ai.bad.add(ai.goalLoot); ai.bad.add(ai.goalChest); ai.goal = null; ai.goalLoot = null; ai.goalChest = null; ai.state = 'idle'; }
  if (ai.think <= 0) { ai.think = 0.25 + Math.random() * 0.15; botThink(b); botTryPickup(b); botDoors(b); }

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
      if (!b.crouch && Math.random() < 0.1 && b.stamina > 40) jump = true;   // v42: saltare costa resistenza e precisione
    }
    const fwd = dist > pref * 1.25 ? 1 : dist < pref * 0.6 ? -0.7 : 0;
    mx = fx * fwd + rx * ai.strafe; mz = fz * fwd + rz * ai.strafe;
    const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l; }
    speed = 4.6;
    // fuoco
    const D = botDiff(b);
    if (w && ai.seenT > D.reaction && Math.abs(angDiff(b.yaw, wantYaw)) < 0.25) {
      const def = WEAPONS[w.id];
      if (ai.pauseT > 0) ai.pauseT -= dt;
      else if (dist < def.range * 0.9 && G.time - ai.lastSeen < 0.6) {
        const origin = b.chest();
        const aimY = tgt.pos.y + (Math.random() < 0.15 ? 1.75 : 1.2);
        // il proiettile impiega tempo ad arrivare: il bot mira dove sarà il bersaglio e un po' più in alto
        const d3 = Math.hypot(tgt.pos.x - origin.x, aimY - origin.y, tgt.pos.z - origin.z);
        const tFly = d3 / (def.speed || 300);
        const lead = D.lead * rand(0.7, 1.15);
        const comp = 0.5 * BULLET_G * (def.drop ?? 1) * tFly * tFly * D.lead * rand(0.85, 1.1);
        const dir = new THREE.Vector3(tgt.pos.x + tgt.vel.x * tFly * lead, aimY + tgt.vel.y * tFly * lead * 0.4 + comp, tgt.pos.z + tgt.vel.z * tFly * lead).sub(origin).normalize();
        const err = (D.aimError * (1 + tgt.moveAmt * 0.07) * (b.moveAmt > 1 ? 1.25 : 1) + def.spread * 0.6) * (b.onGround ? 1 + jumpPenalty(b) * 0.8 : 1.9) * (b.slide ? 1.25 : 1) * (tgt.slide ? 1.15 : 1);   // v42
        if (fireWeapon(b, () => ({ origin, dir: spreadDir(dir, err), max: def.range }))) {
          if (!def.auto) ai.pauseT = rand(0.1, 0.5);
          else if (++ai.burst > rand(4, 9) * D.burst) { ai.burst = 0; ai.pauseT = rand(0.3, 0.8) / D.burst; }
        }
      }
    } else if (!w && dist < 2.5) {
      melee(b);
    }
  } else {
    let goal = ai.goal;
    if ((ai.state === 'flee' || ai.state === 'flee2') && tgt) {
      // v41: fuga a zigzag (più difficile da colpire), verso la zona sicura se possibile
      const ax = b.pos.x - tgt.pos.x, az = b.pos.z - tgt.pos.z, al = Math.hypot(ax, az) || 1, zz = Math.sin(G.time * 2.3 + b.idx) * 0.6;
      const st = safeTarget(), sx = st.x - b.pos.x, sz = st.z - b.pos.z, sl = Math.hypot(sx, sz) || 1;
      const ux = ax / al + (sl > st.r * 0.5 ? sx / sl * 0.5 : 0), uz = az / al + (sl > st.r * 0.5 ? sz / sl * 0.5 : 0);
      goal = _bd.set(b.pos.x + (ux - uz * zz) * 10, 0, b.pos.z + (uz + ux * zz) * 10);
      if (ai.state === 'flee2' && Math.random() < dt * 0.6) ai.wantJump = true;
    }
    if (goal) {
      const gd = Math.hypot(goal.x - b.pos.x, goal.z - b.pos.z);
      // v43: il punto di passaggio (porte, scale) si ricalcola 6–7 volte al secondo invece che a ogni frame
      let np = goal;
      if (ai.state !== 'flee' && ai.state !== 'flee2') {
        if (ai.npGoal !== goal || G.time > (ai.npT || 0) || !ai.npV) { const r = navPoint(b, goal); ai.npV = (ai.npV || new THREE.Vector3()).set(r.x, r.y || 0, r.z); ai.npSame = r === goal; ai.npGoal = goal; ai.npT = G.time + 0.15; }
        np = ai.npSame ? goal : ai.npV;
      }
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
        speed = d > 25 || ai.state === 'zone' || ai.state === 'flee' || ai.state === 'flee2' || ai.state === 'cover' || ai.state === 'follow' ? 7 : 5.2;
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
  if (G.time < (b.trapSlowT || 0)) speed *= 0.45;   // v42
  if (b.inWater) { speed *= 0.55; b.crouch = false; }
  if (ai.wantJump) { jump = true; ai.wantJump = false; }
  if (b.slide) { if (!updateSlide(b, dt, mx, mz, false)) { endSlide(b, false); groundMove(b, mx, mz, speed, dt, jump); } }
  else {
    // v42: scavalca gli ostacoli bassi senza fermarsi; correndo verso un riparo o scappando ogni tanto scivola
    if ((mx || mz) && speed >= 5 && b.onGround && !b.inWater && G.time > (ai.vaultChk || 0)) {
      ai.vaultChk = G.time + 0.2;
      if (tryVault(b, _bv.set(mx, 0, mz).normalize(), 1.3)) return;
    }
    if (speed >= 7 && b.moveAmt > 6.2 && /cover|flee|zone/.test(ai.state) && Math.random() < dt * 0.35 && b.stamina > 40 && canSlide(b)) startSlide(b);
    groundMove(b, mx, mz, speed, dt, jump);
  }
  ai.stuckT -= dt;
  if (ai.stuckT <= 0) {
    const moved = Math.hypot(b.pos.x - ai.lastPos.x, b.pos.z - ai.lastPos.z);
    if ((mx || mz) && speed > 0 && moved < speed * 0.5 * 0.25) {
      ai.avoidT = rand(0.6, 1.2); ai.avoidSign = Math.random() < 0.5 ? -1 : 1; ai.wantJump = true;
      // ostacolo basso davanti (casse, container, muri costruiti)? arrampicati
      const md = new THREE.Vector3(mx, 0, mz).normalize();
      if (tryVault(b, md, 1.75)) { ai.avoidT = 0; ai.lastPos.copy(b.pos); ai.stuckT = 0.5; return; }   // v42
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
const INV_MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'ControlLeft']);
const mouse = { left: false, right: false, leftPressed: false };
let pointerLocked = false;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  // v22: inventario con TAB (Esc lo chiude); mentre è aperto i tasti servono solo all'inventario
  if (e.code === 'Tab' && G.state === 'play') { e.preventDefault(); if (!e.repeat) toggleInventory(); return; }
  if (G.invOpen) {
    e.preventDefault();
    // v33: il gioco non si ferma: con l'inventario aperto ci si continua a muovere (WASD, salto, scatto, accovacciarsi)
    if (INV_MOVE_KEYS.has(e.code)) { if (!keys[e.code]) pressed.add(e.code); keys[e.code] = true; return; }
    if (e.code === 'Escape') toggleInventory(false);
    else if (!e.repeat) inventory.key(e.code);
    return;
  }
  if (!keys[e.code]) pressed.add(e.code);
  keys[e.code] = true;
  if (['Space', 'Tab'].includes(e.code) && G.state !== 'menu') e.preventDefault();
  if (e.code === 'Escape' && (G.state === 'play' || G.state === 'bus') && !pointerLocked && !G.mapOpen) togglePause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });
canvas.addEventListener('mousedown', e => {
  A.initAudio();
  if ((G.state === 'play' || G.state === 'bus') && !G.invOpen) {
    if (!pointerLocked && !G.paused) requestLock();
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
    if (e.button === 1) { mouse.middlePressed = true; e.preventDefault(); }   // v41: clic della rotellina = segnalazione
  }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (G.state === 'menu') { if (lobby.drag) lobby.rotV += e.movementX * 0.01; return; }
  if (G.specOn || (G.player && !G.player.alive && G.spectate)) {
    if (!(e.buttons & 1) && !(e.buttons & 2) && !pointerLocked) return;
    G.specOrbit = (G.specOrbit || 0) - e.movementX * 0.005; G.specPitch = clamp((G.specPitch || 0) - e.movementY * 0.004, -0.6, 0.6); G.specIdle = 0;
    return;
  }
  if (G.paused || G.state === 'end' || G.invOpen) return;
  if (!pointerLocked && !(e.buttons & 1) && !(e.buttons & 2)) { if (!lockFailed) return; }
  // Chrome a volte invia salti enormi subito dopo il pointer lock: ignorali
  if (performance.now() - lockTime < 120 || Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
  const zoomK = G.ads ? settings.adsSens / currentZoom() : 1;
  const s = 0.0022 * settings.sens * zoomK;
  G.camYaw -= e.movementX * s;
  G.camPitch = clamp(G.camPitch - e.movementY * s * (settings.invertY ? -1 : 1), -1.35, 1.35);
});
addEventListener('wheel', e => {
  if (G.state !== 'play' || !G.player || !G.player.alive) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  if (G.build.on) { setPiece(BUILD_PIECES[(BUILD_PIECES.indexOf(G.build.piece) + dir + BUILD_PIECES.length) % BUILD_PIECES.length]); return; }   // v41
  G.player.setActive((G.player.active + dir + SLOT_COUNT) % SLOT_COUNT);
}, { passive: true });

let lockFailed = false;
let lockTime = 0;
function requestLock() {
  if (touch.T.on) return;          // sul telefono non c'è il puntatore da bloccare
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { lockFailed = true; });
  } catch { lockFailed = true; }
}
document.addEventListener('pointerlockchange', () => {
  const was = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) lockTime = performance.now();
  if (was && !pointerLocked && (G.state === 'play' || G.state === 'bus') && !G.paused && !G.invOpen && !G.mapOpen) togglePause(true);
});
document.addEventListener('pointerlockerror', () => { lockFailed = true; });

// ─────────────── Comandi touch (telefono / tablet) ───────────────
const touch = createTouch({
  G, keys, pressed, mouse, settings,
  look(dx, dy) {
    if (G.paused || G.state === 'end' || G.state === 'menu') return;
    const zoomK = G.ads ? settings.adsSens / currentZoom() : 1;
    const s = 0.0045 * (settings.touchSens || 1) * zoomK * (G.assistSlow || 1);   // v40: rallenta sopra un avversario
    G.camYaw -= dx * s;
    G.camPitch = clamp(G.camPitch - dy * s * (settings.invertY ? -1 : 1), -1.35, 1.35);
  },
  togglePause: () => togglePause(true),
  toggleInv: () => toggleInventory(),
  saveSettings: () => saveSettings(),
  onSlot(i) {
    const p = G.player;
    if (!p || !p.alive || G.state !== 'play') return;
    p.setActive(i);
    if (G.build.on) toggleBuild(false);
  },
});
const touchOn = () => settings.touch === 'on' || (settings.touch !== 'off' && IS_TOUCH_DEVICE);
/** testo dei suggerimenti: tastiera o touch */
const tk = (kb, tc) => touch.T.on ? tc : kb;

// ─────────────── Inventario (TAB) ───────────────
const inventory = createInventory({
  G, weaponIconHTML, consIconHTML,
  swap(i, j) {
    // l'oggetto in mano resta in mano: l'indice attivo segue l'oggetto spostato
    const p = G.player, held = p.active;
    [p.slots[i], p.slots[j]] = [p.slots[j], p.slots[i]];
    if (held === i) p.active = j; else if (held === j) p.active = i;
    if (p.reloading > 0) { p.reloading = 0; p.reloadSlot = -1; }
    p.using = null;
    p.updateHeld();
  },
  drop(i) {
    const p = G.player, sl = p.slots[i];
    if (!sl) return;
    dropAt(p, itemFromSlot(sl));
    p.slots[i] = null;
    if (i === p.active) { p.using = null; p.reloading = 0; }
    p.updateHeld();
  },
  dropAmmo(id) {
    const p = G.player, n = Math.min(p.ammo[id], AMMO_TYPES[id].pickup);
    if (n <= 0) return;
    p.ammo[id] -= n;
    dropAt(p, { kind: 'ammo', id, count: n });
  },
  equip(i) { const p = G.player; p.setActive(i); if (G.build.on) toggleBuild(false); },
  onOpen() {
    for (const k in keys) if (!INV_MOVE_KEYS.has(k)) keys[k] = false;
    pressed.clear();
    mouse.left = mouse.right = false;
    touch.T.mx = touch.T.my = 0; touch.T.sprint = false;
    G.ads = false;
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.classList.add('inv-open');
  },
  onClose() {
    document.body.classList.remove('inv-open');
    if (G.state === 'play' && !G.paused && G.player && G.player.alive) requestLock();
  },
  sound: k => A.playInv(k),
});
function toggleInventory(force) {
  if (force === undefined && !G.invOpen && G.paused) return;
  inventory.toggle(force);
}

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
      // sul telefono prova anche a bloccare lo schermo in orizzontale
      if (touch.T.on && r && r.then) r.then(() => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch { /* non supportato */ } }).catch(() => {});
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
  if (G.paused && G.invOpen) inventory.close();
  $('#pause').classList.toggle('hidden', !G.paused);
  mouse.left = mouse.right = false;
}
$('#resumeBtn').onclick = e => { e.stopPropagation(); togglePause(false); requestLock(); };
$('#pause').addEventListener('click', e => { if (e.target.id === 'pause' || e.target.tagName === 'P' || e.target.tagName === 'H2') { togglePause(false); requestLock(); } });
$('#quitBtn').onclick = () => { togglePause(false); toMenu(); };
// ─────────────── Impostazioni (grafica, controlli, audio, interfaccia) ───────────────
let fogK = 1;
// ─────────────── v43: qualità automatica (minimo 30 FPS) ───────────────
//  Se nonostante la risoluzione dinamica il gioco resta sotto i 30 FPS, si scende di un gradino alla volta
//  (fino a 4): niente AO e MSAA → ombre basse e niente bloom → niente ombre, meno erba e distanza → minimo.
//  Quando torna fluido (sopra ~50 FPS a lungo) risale piano. Le impostazioni scelte dal giocatore non cambiano.
const AUTO = { lvl: 0, t0: 0, n: 0, sum: 0, prev: 0, low: 0, high: 0, coolT: 0, blockUpT: 0, downT: 0 };
// v44: la qualità automatica è delicata: non tocca mai risoluzione, distanza visiva e bloom, non spegne le ombre.
//  Livello 1: niente AO, FXAA al posto di MSAA/SMAA, ombre ultra → alte (quasi invisibile).
//  Livello 2: ombre basse ed erba un po' più rada.
const AUTO_MAX = 2;
const AUTO_NAMES = ['', 'senza occlusione ambientale, FXAA', 'ombre più semplici, erba più rada'];
function effGfx() {
  const g = { ...settings.gfx }, L = g.autoQ === false ? 0 : AUTO.lvl;
  if (L >= 1) { g.ao = false; if (g.shadows === 'ultra') g.shadows = 'high'; if (g.aa === 'msaa' || g.aa === 'smaa') g.aa = 'fxaa'; }
  if (L >= 2) { if (g.shadows !== 'off') g.shadows = 'low'; g.grass = Math.min(g.grass, 0.6); }
  return g;
}
/** distanze di dettaglio (personaggi, bottino, porte, bot) in base alla grafica effettiva */
function applyPerf(g) {
  const sh = { off: 0, low: 16, high: 26, ultra: 40 }[g.shadows] ?? 26, v = g.view;
  PERF.charFull = clamp(85 * v, 45, 150);
  PERF.charShadow = sh;
  PERF.smallNear = 12 + 10 * v;
  PERF.anim2 = 18 + 10 * v;
  PERF.anim3 = 38 + 17 * v;
  PERF.lootFull = clamp(28 + 18 * v, 30, 70);
  PERF.lootShadow = sh ? Math.min(22, sh) : 0;
  PERF.botFar2 = 140; PERF.botFar3 = 280;
  QUALITY.doorNear = 170 * v; QUALITY.hwNear = 30 * v;
}
function autoQualityTick(now) {
  const live = G.state === 'play' && !G.paused && !document.hidden && settings.gfx.autoQ !== false;
  if (!live) { AUTO.prev = 0; AUTO.n = 0; AUTO.sum = 0; AUTO.t0 = 0; return; }
  if (AUTO.prev) { const ft = now - AUTO.prev; if (ft < 400) { AUTO.sum += ft; AUTO.n++; } }
  AUTO.prev = now;
  if (!AUTO.t0) AUTO.t0 = now;
  if (now - AUTO.t0 < 2000 || AUTO.n < 15) return;
  const avg = AUTO.sum / AUTO.n; AUTO.t0 = now; AUTO.n = 0; AUTO.sum = 0;
  if (now < AUTO.coolT) return;
  const cap = settings.gfx.fpsCap, floorRes = !settings.gfx.dynRes || dynState.k <= DYN_MIN + 0.02;
  if (avg > 1000 / 30 * 1.06) { AUTO.low++; AUTO.high = 0; } else if (avg < 1000 / 42 && !(cap > 0 && cap <= 30)) { AUTO.high++; AUTO.low = 0; } else { AUTO.low = 0; AUTO.high = 0; }
  // sotto 30 per 2 finestre (4 s) con la risoluzione già al minimo (o per 3 finestre comunque) → un gradino giù
  if (AUTO.lvl < AUTO_MAX && ((AUTO.low >= 2 && floorRes) || AUTO.low >= 4)) {
    AUTO.lvl++; AUTO.low = 0; AUTO.coolT = now + 3500; AUTO.downT = now;
    applyAutoGfx();
    hudToast(`⚙️ Grafica alleggerita (${AUTO_NAMES[AUTO.lvl]}) per restare sopra i 30 FPS`);
  } else if (AUTO.lvl > 0 && AUTO.high >= 4 && now > AUTO.blockUpT) {
    // risale se va sopra i 42 FPS da 8 s; se poi ricade entro 20 s, per 1 minuto non ci riprova
    AUTO.lvl--; AUTO.high = 0; AUTO.coolT = now + 4000;
    AUTO.upT = now; applyAutoGfx();
  }
  if (AUTO.upT && AUTO.downT > AUTO.upT && AUTO.downT - AUTO.upT < 20000) { AUTO.blockUpT = now + 60000; AUTO.upT = 0; }
}
function applyAutoGfx() {
  const e = effGfx();
  gfx.apply(e);
  applyQuality(e);
}
function applyQuality(e) {
  const v = e.view;
  fogK = v;
  QUALITY.detailIn = 240 * v; QUALITY.detailOut = 310 * v; QUALITY.treeHi = 80 * v; QUALITY.nearOnly = 150 * v;
  QUALITY.grassOn = e.grass > 0.01;
  QUALITY.grassDens = 0.8 * Math.max(0.1, e.grass);
  QUALITY.grassR = 64 * clamp(0.6 + e.grass * 0.4, 0.6, 1.25);
  GRASS_FADE.value = QUALITY.grassR / 64;
  QUALITY.version++;
  weather.setQuality(clamp(0.3 + e.grass * 0.6, 0.3, 1));
  applyPerf(e);
}
function applySettings(key = '*') {
  const g = settings.gfx, all = key === '*';
  if (key === 'autoQ' && g.autoQ === false && AUTO.lvl) { AUTO.lvl = 0; }
  if (all || ['preset', 'scale', 'shadows', 'aa', 'bloom', 'ao', 'autoQ'].includes(key)) gfx.apply(effGfx());
  if (all || key === 'preset' || key === 'aniso') applyAnisotropy(scene, Math.min(g.aniso, gfx.maxAniso || 1));
  if (all || ['preset', 'view', 'grass', 'shadows', 'autoQ'].includes(key)) applyQuality(effGfx());
  if (all || key === 'vol') A.setVolume(settings.vol);
  if (all || key === 'amb') A.setAmbience(settings.amb);
  if (all || key === 'shake') { if (!settings.shake) G.shake = 0; }
  if (all || key === 'chColor' || key === 'chSize') {
    const ch = $('#crosshair');
    ch.style.setProperty('--cc', settings.chColor);
    ch.style.setProperty('--k', settings.chSize);
  }
  if (all || key === 'minimap') {
    const px = { small: 150, normal: 200, big: 260 }[settings.minimap] || 200;
    mmCanvas.width = mmCanvas.height = px;
    mmCanvas.style.width = mmCanvas.style.height = px + 'px';
  }
  if (all || key === 'fpsShow') $('#fps').classList.toggle('hidden', !g.fpsShow);
  if (all || key === 'touch') {
    touch.enable(touchOn());
    $('#pause p').textContent = touch.T.on ? 'Tocca per riprendere' : 'Clicca per riprendere';
    $('#buildHint').textContent = touch.T.on ? 'MODALITÀ COSTRUZIONE · Spara: muro (10 🪵) · tocca di nuovo il pulsante per uscire' : 'MODALITÀ COSTRUZIONE · Click sx: muro (10 🪵) · Q per uscire';
  }
  if (all || key === 'touchSize') document.documentElement.style.setProperty('--tk', settings.touchSize || 1);
  if (all || key === 'touchSize' || key === 'touchAlpha' || key === 'touchLayout') touch.applyLayout();   // v40
}
const settingsUI = initSettingsUI({
  settings, presets: PRESETS,
  save: saveSettings,
  apply: applySettings,
  defaults: () => { const d = SETTINGS_DEFAULT(); for (const k of ['name', 'skin', 'glider', 'difficulty', 'players', 'mode', 'hat', 'back']) delete d[k]; return d; },
  onReload: () => location.reload(),
  action: (name, done) => { if (name === 'touchLayout') touch.editLayout(done); },   // v40
});
$('#setPauseBtn').onclick = e => { e.stopPropagation(); settingsUI.open(); };
$('#setMenuBtn').onclick = () => { A.playUI(); settingsUI.open(); };

const SIGHT_NAMES = { iron: 'Tacca e mirino', notch: 'Tacca a V', holo: 'Olografico', reddot: 'Red dot', tri: 'Prismatico', bead: 'Bindella e perla', rocket: 'Telemetro', scope: 'Cannocchiale', acog: 'Ottica tattica', vintage: "Ottica d'epoca" };
// v41: ogni classe d'arma ha il suo zoom in mira (regolabile nelle impostazioni) e la sua velocità di passaggio:
// pistole e pompa entrano in mira di scatto, i cecchini con calma
const ADS_SPEED = { pistol: 17, smg: 15, shotgun: 18, ar: 12, sniper: 8, rocket: 9, melee: 14 };
function currentZoom() {
  const w = G.player && G.player.weapon;
  if (!w) return 1.2;
  const def = WEAPONS[w.id], k = settings['adsK_' + def.role] ?? 1;
  return Math.max(1.02, 1 + (def.zoom - 1) * k);
}
function adsSpeed() { const w = G.player && G.player.weapon; return w ? ADS_SPEED[WEAPONS[w.id].role] || 12 : 12; }

// ─────────────── Giocatore ───────────────
/** v42: imprecisione residua dopo un atterraggio (0..1, svanisce in 0,4 s; di più dopo i salti a ripetizione) */
function jumpPenalty(c) { const k = 1 - (G.time - (c.landAt ?? -9)) / 0.4; return k > 0 ? k * (0.9 + 0.3 * (c.hopN || 0)) : 0; }
function currentSpread(p) {
  const w = p.weapon;
  if (!w) return 0;
  const def = WEAPONS[w.id];
  let s = def.spread;
  if (G.ads) s = def.adsSpread !== undefined ? def.adsSpread : s * 0.45;
  if (p.moveAmt > 1) s *= 1.4;
  // v42: in volo la mira è imprecisa (sempre di più con i salti di fila) e torna a posto in 0,4 s dopo l'atterraggio:
  //  saltare a caso per non farsi colpire non conviene più
  if (!p.onGround && !p.vault) s *= 2.2 + 0.35 * p.hopN;
  else s *= 1 + jumpPenalty(p);
  if (p.slide) s *= 1.3;
  if (p.crouchK > 0.5) s *= 0.65;   // accovacciato = più preciso
  return s + p.bloom;
}

// ── porte: si aprono/chiudono con E; i bot le aprono quando ci passano ──
function updateDoors(dt) {
  for (const d of world.doors) {
    const t = d.open ? 1 : 0;
    if (d.ang === t) continue;
    d.ang = d.open ? Math.min(1, d.ang + dt / 0.55) : Math.max(0, d.ang - dt / 0.42);
    world.poseDoor(d);
  }
}
function toggleDoor(d, by, open = !d.open, remote = false) {
  if (!world.setDoor(d, open)) return;
  const dd = Math.hypot(d.x - camera.position.x, d.z - camera.position.z);
  if (dd < 45) A.playDoor(open, by && by.isPlayer ? 1 : Math.max(0.05, 1 - dd / 45) * 0.7);
  if (G.net && !remote) netSend({ t: 'door', k: d.i, o: open ? 1 : 0 });
}
// v26: stufa a legna delle casette (E per accendere/spegnere)
function toggleStove(st, by, lit = !st.lit, remote = false) {
  if (!stoves.setLit(st, lit) && !lit) return;
  const dd = Math.hypot(st.x - camera.position.x, st.z - camera.position.z);
  if (dd < 30) {
    if (lit) { A.playPickup(); for (let i = 0; i < 3; i++) emit(_p.set(st.x, st.y, st.z), '#ffb040', 4, 1.2, 0.35, 0.03, 0.4); }
    else A.playDoor(false, 0.4);
  }
  if (by && by.isPlayer && lit) showMsg('', '🔥 Stufa accesa: resta dentro al calduccio per recuperare salute', 3);
  if (G.net && !remote) netSend({ t: 'stove', k: st.i, o: lit ? 1 : 0 });
}
function botDoors(b) {
  for (const d of world.doors) {
    if (d.open || d.broken || Math.abs(d.x - b.pos.x) > 2.3 || Math.abs(d.z - b.pos.z) > 2.3 || Math.abs(d.y - b.pos.y) > 2) continue;
    toggleDoor(d, b, true);
  }
}
function nearestInteract(p) {
  let best = null, bs = Infinity;
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  for (const L of G.loot) {
    if (L.item.kind === 'ammo' || L.item.kind === 'mats' || L.item.kind === 'throw') continue;
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
  const st = stoves.nearest(p);
  if (st) { const d = Math.hypot(st.x - p.pos.x, st.z - p.pos.z); if (d - 0.6 < bs) { bs = d - 0.6; best = { stove: st }; } }
  for (const dr of world.doors) {
    if (dr.broken) continue;
    const dx = dr.x - p.pos.x, dz = dr.z - p.pos.z;
    if (Math.abs(dx) > 2.6 || Math.abs(dz) > 2.6 || Math.abs(dr.y - p.pos.y) > 1.8) continue;
    const d = Math.hypot(dx, dz);
    if (d > 2.4) continue;
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    const sc = d - facing * 0.8 + 0.5;
    if (sc < bs) { bs = sc; best = { door: dr }; }
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
  const TC = touch.T;
  if (TC.on && (TC.mx || TC.my)) { mx += fx * TC.my + rx * TC.mx; mz += fz * TC.my + rz * TC.mx; }   // joystick analogico
  const l = Math.hypot(mx, mz);
  if (l > 1) { mx /= l; mz /= l; }
  if (p.mode === 'fall' || p.mode === 'glide') {
    airMove(p, mx, mz, dt, pressed.has('Space'));
    G.ads = false;
    return;
  }
  const fwdHeld = keys.KeyW || keys.ArrowUp || (TC.on && TC.my > 0.5);
  const backHeld = keys.KeyS || keys.ArrowDown || (TC.on && TC.my < -0.5);
  if (p.mode === 'climb') {
    G.ads = false; G.interact = null; ghost.visible = false;
    updateClimb(p, dt, fwdHeld, backHeld, pressed.has('Space'));
    return;
  }
  // v42: scavalco in corso: niente azioni per quel mezzo secondo
  if (p.vault) { groundMove(p, 0, 0, 0, dt, false); G.ads = false; G.interact = null; ghost.visible = false; return; }
  // arrampicata: SPAZIO contro un muro, oppure salta verso un muro tenendo W
  _v.set(fx, 0, fz);
  G.climbHint = null;
  const sprintKey = !!(keys.ShiftLeft || keys.ShiftRight || TC.sprint);
  // v42: scavalco automatico: correndo contro un ostacolo basso (fino a 1,25 m) lo si supera da soli; con SPAZIO
  //  fino a 1,75 m; saltando verso un bordo (fino a 2 m sopra i piedi) ci si aggrappa e si sale in un attimo
  if (fwdHeld && !G.build.on) {
    const jumpP = pressed.has('Space');
    const mr = !p.onGround ? (p.vel.y < 5 && !p.impulseFly ? 2.0 : 0) : jumpP ? 1.75 : (sprintKey || p.slide) && p.moveAmt > 4.8 ? 1.25 : 0;
    if (mr && tryVault(p, _v, mr)) { p._noJumpUntilRelease = true; return; }
  }
  if (fwdHeld && !G.build.on) {
    const hit = canStartClimb(p, _v);
    if (hit && (pressed.has('Space') || (!p.onGround && p.vel.y < 4))) { startClimb(p, hit, _v); return; }
    G.climbHint = hit;
  }
  // abbassarsi (v42: premendo C mentre corri parte la scivolata)
  if (pressed.has('KeyC') && canSlide(p) && (sprintKey || p.moveAmt > 6.6)) { startSlide(p); pressed.delete('KeyC'); }
  else if (p.slide) {
    if (pressed.has('KeyC') || (settings.crouchHold && !keys.KeyC && p.slide.t > 0.25)) { endSlide(p, false); pressed.delete('KeyC'); }
  } else if (settings.crouchHold) {
    const want = !!keys.KeyC && !p.inWater;
    if (want !== p.crouch) { p.crouch = want; if (want) A.playStep(); }
  } else if (pressed.has('KeyC')) { p.crouch = !p.crouch; if (p.crouch) A.playStep(); }
  let stoodUp = false;
  if (p.crouch && !settings.crouchHold && (pressed.has('Space') || (keys.ShiftLeft || keys.ShiftRight))) { p.crouch = false; stoodUp = pressed.has('Space'); }
  // slot (con l'inventario aperto i tasti delle azioni servono all'inventario: qui arrivano solo i movimenti)
  if (G.invOpen) for (const k of [...pressed]) if (!INV_MOVE_KEYS.has(k)) pressed.delete(k);
  for (let i = 0; i < SLOT_COUNT; i++) if (pressed.has('Digit' + (i + 1))) {
    // v41: in costruzione 1 = muro, 2 = pavimento, 3 = rampa
    if (G.build.on && i < BUILD_PIECES.length) { setPiece(BUILD_PIECES[i]); continue; }
    p.setActive(i); if (G.build.on) toggleBuild(false);
  }
  if (pressed.has('KeyQ')) toggleBuild();
  if (G.build.on && pressed.has('KeyR')) { setPiece(BUILD_PIECES[(BUILD_PIECES.indexOf(G.build.piece) + 1) % BUILD_PIECES.length]); pressed.delete('KeyR'); }
  if (pressed.has('KeyB')) { const i = ((p._emoteIdx ?? -1) + 1) % EMOTES.length; p._emoteIdx = i; startEmote(p, EMOTES[i].id); }
  for (let i = 0; i < EMOTES.length; i++) if (pressed.has(EMOTE_KEYS[i])) startEmote(p, EMOTES[i].id);
  if (pressed.has('KeyR')) startReload(p);
  if (pressed.has('KeyX') && p.slot) { dropAt(p, itemFromSlot(p.slot)); p.slots[p.active] = null; p.using = null; p.reloading = 0; p.updateHeld(); }
  // v41: oggetti da lancio: tieni premuto G per vedere la traiettoria, rilascia per lanciare; H cambia tipo
  if (pressed.has('KeyH')) cycleThrow(p);
  fixThrowSel(p);
  const placing = !!THROWABLES[p.throwSel].place;   // v42: trampolino e trappola si piazzano a terra
  if (keys.KeyG && !G.invOpen && p.throws[p.throwSel] > 0 && !G.build.on && !p.inWater) {
    G.throwAim = true; G.throwAimT = G.time;
    if (placing) { hideTrajectory(); G.placeOk = showPlaceGhost(p, p.throwSel); } else { placeGhost.visible = false; showTrajectory(p, p.throwSel); }
  } else if (G.throwAim) {
    G.throwAim = false; hideTrajectory(); placeGhost.visible = false;
    if (!keys.KeyG && !G.build.on && !p.inWater) {
      if (!placing) throwItem(p, p.throwSel, G.camYaw, G.camPitch);
      else if (G.placeOk && placeSpot(p, _ps)) placeItem(p, p.throwSel, _ps.x, _ps.y, _ps.z, p.yaw);
      else showMsg('', 'Qui non si può piazzare', 1.1);
    }
  } else if (pressed.has('KeyG') && !p.throws[p.throwSel]) showMsg('', 'Non hai oggetti da lancio', 1.2);
  if (!G.throwAim && placeGhost.visible) placeGhost.visible = false;
  if (pressed.has('KeyZ') || mouse.middlePressed) playerPing();
  mouse.middlePressed = false;
  const inter = nearestInteract(p);
  if (pressed.has('KeyE') && inter) {
    if (inter.loot) { if (pickupLoot(p, inter.loot, true)) A.playPickup(); }
    else if (inter.chest) openChest(p, inter.chest);
    else if (inter.door) toggleDoor(inter.door, p);
    else if (inter.stove) toggleStove(inter.stove, p);
  }
  G.interact = inter;
  G.ads = mouse.right && !G.build.on && !!p.weapon && p.reloading <= 0 && !p.inWater;
  const sprint = (keys.ShiftLeft || keys.ShiftRight || TC.sprint) && !G.ads && !mouse.left && mz * fz + mx * fx > 0.3;
  let speed = sprint ? 7.6 : 5.3;
  if (p.crouch) speed = 2.8;
  if (G.ads) speed = Math.min(speed, 3.4);
  if (p.weapon && WEAPONS[p.weapon.id].moveMult) speed *= WEAPONS[p.weapon.id].moveMult;
  if (p.using) speed = Math.min(speed, 2.6);
  if (G.time < (p.trapSlowT || 0)) speed *= 0.45;   // v42: piede nella trappola
  if (p.inWater) {
    // nuoto: lento, con lo sprint si nuota a stile libero ma si consuma la resistenza
    p.crouch = false;
    const fast = sprint && p.stamina > 4;
    speed = fast ? 4.3 : 2.9;
    if (fast) { p.stamina = Math.max(0, p.stamina - dt * 11); p.tireT = 0.8; }
    if (p.stamina < 4) speed = 2.1;
  }
  if (stoodUp) p._noJumpUntilRelease = true;
  if (!keys.Space) p._noJumpUntilRelease = false;
  const wantJump = keys.Space && !p._noJumpUntilRelease && !p.crouch;
  if (p.slide) {
    // v42: scivolata (finita: si resta abbassati, a meno di tenere premuto lo scatto)
    if (!updateSlide(p, dt, mx, mz, wantJump && pressed.has('Space'))) { endSlide(p, settings.crouchHold ? !!keys.KeyC : !sprintKey); groundMove(p, mx, mz, speed, dt, false); }
  } else groundMove(p, mx, mz, speed, dt, wantJump);
  // azioni
  touchAimTick(p, dt);   // v40: assistenza alla mira e fuoco automatico (solo touch)
  p.bloom = Math.max(0, p.bloom - dt * 0.12);
  if (G.build.on) {
    showGhost(p);
    if (mouse.leftPressed || (mouse.left && (p._bt = (p._bt || 0) - dt) <= 0)) { placeWall(p); p._bt = 0.25; }
  } else {
    ghost.visible = false;
    const s = p.slot;
    if (!s) { if (mouse.left) melee(p); }
    else if (s.kind === 'cons') { if (mouse.leftPressed) startUse(p); }
    else {
      const def = WEAPONS[s.id];
      if (def.melee) {
        // v38: Artigli: clic = mossa successiva della combo (in coda se ne stai già facendo una), tenendo premuto
        // la combo continua; mirando (tasto destro) il clic è un balzo
        if (mouse.leftPressed) clawAttack(p, G.ads ? 'pounce' : null);
        else if (mouse.left && !p.claw) clawAttack(p, null);
      } else if ((def.auto && (mouse.left || G.autoTrig)) || mouse.leftPressed || (G.autoTrig && p.fireCd <= 0)) playerFire(p, def);
    }
  }
}

// ─────────────── v40: telefono: assistenza alla mira e fuoco automatico ───────────────
const _aimD = new THREE.Vector3(), _aimR = new THREE.Vector3(), _aimU = new THREE.Vector3(), _aimT = new THREE.Vector3();
function touchAimTick(p, dt) {
  G.autoTrig = false; G.assistSlow = 1;
  if (!touch.T.on || G.build.on || !p.alive || p.mode === 'climb' || p.inWater) return;
  const s = p.slot, def = s && s.kind !== 'cons' ? WEAPONS[s.id] : null;
  if (!def || def.melee) return;
  camera.getWorldDirection(_aimD);
  _aimR.crossVectors(_aimD, camera.up).normalize();
  _aimU.crossVectors(_aimR, _aimD).normalize();
  const camPos = camera.position;
  const mode = settings.aimAssist || 'on';
  if (mode !== 'off') {
    const maxA = (mode === 'strong' ? 7 : 4.5) * Math.PI / 180;
    let best = null, bestA = maxA;
    for (const c of G.chars) {
      if (c === p || !c.alive || c.mode === 'bus' || isMate(p, c)) continue;
      _aimT.set(c.pos.x, c.pos.y + 1.15 * (c.hScale || 1), c.pos.z).sub(camPos);
      const L = _aimT.length();
      if (L > def.range || L < 1) continue;
      _aimT.divideScalar(L);
      const a = Math.acos(Math.min(1, _aimT.dot(_aimD)));
      if (a < bestA && hasLOS(p, c)) { bestA = a; best = c; }
    }
    if (best) {
      const k = 1 - bestA / maxA;
      G.assistSlow = 1 - 0.45 * k;
      // segue un po' il bersaglio (più forte se spari, miri o ti muovi)
      const active = mouse.left || G.ads || touch.T.mx || touch.T.my;
      const pull = (mode === 'strong' ? 5 : 3) * (active ? 1 : 0.35) * k * Math.min(1, dt);
      _aimT.set(best.pos.x, best.pos.y + 1.15 * (best.hScale || 1), best.pos.z).sub(camPos).normalize();
      G.camYaw -= _aimT.dot(_aimR) * pull;
      G.camPitch = clamp(G.camPitch + _aimT.dot(_aimU) * pull, -1.35, 1.35);
    }
  }
  if (settings.autoFire !== 'off' && G.state === 'play' && !(s.mag <= 0 && !(p.ammo[def.ammo] > 0))) {
    const hit = rayAll(camPos, _aimD, def.range + 8, p);
    if (hit && (hit.boss || (hit.char && !isMate(p, hit.char)))) G.autoTrig = true;
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
  }, () => playerFire(p, def));
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
  if (G.build.on) updateBuildHint();
}
/** v41: pezzo da costruire (muro, pavimento, rampa) */
function setPiece(k) {
  if (G.build.piece === k) return;
  G.build.piece = k; A.playUI(); updateBuildHint();
}
function updateBuildHint() {
  const el = $('#buildHint');
  el.innerHTML = 'COSTRUZIONE · ' + BUILD_PIECES.map((k, i) => `<span class="${G.build.piece === k ? 'on' : ''}"><kbd>${i + 1}</kbd> ${PIECE_NAME[k]}</span>`).join(' ') +
    ` · <kbd>R</kbd>/rotella cambia · Click sx: piazza (${PIECE_COST} 🪵) · <kbd>Q</kbd> esci`;
}

// ─────────────── Telecamera ───────────────
const camTarget = new THREE.Vector3(), _specUp = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.player;
  const F0 = settings.fov;
  let pivot, dist, shoulder = 0.75, wantFov = F0;
  let yaw = G.camYaw, pitch = G.camPitch;
  if (!p.alive) {
    const t = G.spectate && G.spectate.alive ? G.spectate : p;
    if (t !== p && (G.specOn || G.spectate)) {
      // v33: spettatore: alle spalle di chi osservi, girato come lui; trascinando il mouse ci si gira attorno
      G.specIdle = (G.specIdle || 0) + dt;
      if (G.specIdle > 2.5) G.specOrbit = lerp(G.specOrbit || 0, 0, Math.min(1, dt * 1.5));
      G.specYaw = angLerp(G.specYaw ?? t.yaw, t.yaw, Math.min(1, dt * 5));
      const air = t.mode === 'fall' || t.mode === 'glide', bus = t.mode === 'bus';
      pivot = camTarget.copy(bus ? G.bus.pos : t.pos).add(_specUp.set(0, bus ? 3 : air ? (t.mode === 'glide' ? 3.3 : 1.5) : 1.75 - 0.5 * (t.crouchK || 0), 0));
      yaw = G.specYaw + (G.specOrbit || 0); G.camYaw = yaw;
      pitch = bus ? -0.3 : air ? -0.35 : clamp((t.pitch || 0) * 0.7 - 0.1 + (G.specPitch || 0), -1.1, 0.9); G.camPitch = pitch;
      dist = bus ? 26 : air ? 7 : 3.9; shoulder = bus || air ? 0 : 0.8;
    } else {
      pivot = camTarget.copy(t.pos).add(new THREE.Vector3(0, 1.6, 0));
      G.camYaw += dt * 0.25; yaw = G.camYaw; pitch = -0.35; dist = 7; shoulder = 0;
    }
  } else if (p.mode === 'bus') {
    pivot = camTarget.copy(G.bus.pos).add(new THREE.Vector3(0, 3, 0));
    dist = 26; shoulder = 0; wantFov = F0 + 5;
  } else if (p.mode === 'fall' || p.mode === 'glide') {
    // v31: in deltaplano la camera sta sopra la vela (a 2.9 m sul pilota): si vede la tela dall'alto, non di taglio
    pivot = camTarget.copy(p.pos).add(new THREE.Vector3(0, p.mode === 'glide' ? 3.3 : 1.5, 0));
    dist = p.mode === 'fall' ? 7 : 6.8; shoulder = 0; wantFov = p.mode === 'fall' ? F0 + 15 : F0 + 5;
  } else {
    pivot = camTarget.copy(p.pos).add(new THREE.Vector3(0, 1.8 - 0.55 * p.crouchK - 0.7 * p.slideK, 0));
    dist = G.ads ? 2.2 : 3.8;
    shoulder = G.ads ? 0.75 : 1.0;
    if (G.ads) wantFov = F0 / currentZoom();
    if (p.moveAmt > 6.5) wantFov = F0 + 6;
    if (p.slide && !G.ads) wantFov = F0 + 9;   // v42: la scivolata dà un colpo di velocità
  }
  // v31: l'altezza del punto guardato cambia con una transizione morbida (paracadute → deltaplano → a terra)
  if (p.alive && p.mode !== 'bus') {
    const off = pivot.y - p.pos.y;
    G.camOffY = G.camOffY === undefined || Math.abs(G.camOffY - off) > 6 ? off : lerp(G.camOffY, off, Math.min(1, dt * (p.mode === 'ground' ? 10 : 4)));
    pivot.y = p.pos.y + G.camOffY;
  }
  G.fov = lerp(G.fov, wantFov, Math.min(1, dt * (G.ads || G.adsWas ? adsSpeed() : 12)));
  G.adsWas = G.ads || Math.abs(G.fov - wantFov) > 0.5;
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
  if (!settings.shake) G.shake = 0;
  if (G.shake > 0) {
    camera.position.x += rand(-1, 1) * G.shake * 0.25;
    camera.position.y += rand(-1, 1) * G.shake * 0.25;
    G.shake = Math.max(0, G.shake - dt * 2.5);
  }
  camera.lookAt(base.addScaledVector(dir, 50));
  // nascondi il modello quando si usa un cannocchiale o la camera è troppo vicina
  const wdef = p.alive && p.mode === 'ground' && p.weapon ? WEAPONS[p.weapon.id] : null;
  const zFov = wdef ? F0 / currentZoom() : F0;   // v41: zoom per classe regolabile
  const scoped = !!(G.ads && wdef && wdef.scope && G.fov < zFov * 1.12 + 0.5);
  // ottica da mira (red dot, olografico, tacca e mirino…) quando lo zoom è quasi completo
  const sighted = !!(G.ads && wdef && !wdef.scope && wdef.sight !== 'none' && !G.build.on && G.fov < F0 - (F0 - zFov) * 0.6);
  if (p.alive && p.mode !== 'bus') p.m.root.visible = !scoped && d > 0.9;
  const scEl = $('#scope'), siEl = $('#sight');
  if (wdef && scEl.dataset.s !== wdef.sight) {
    scEl.dataset.s = wdef.sight; siEl.dataset.s = wdef.sight;
    const label = SIGHT_NAMES[wdef.sight] || '';
    scEl.querySelector('.mag').textContent = `${label} · ${String(+currentZoom().toFixed(1)).replace('.', ',')}×`;
    siEl.querySelector('.name').textContent = `${label} · ${String(+currentZoom().toFixed(1)).replace('.', ',')}×`;
  }
  scEl.classList.toggle('hidden', !scoped);
  siEl.classList.toggle('hidden', !sighted);
  G.sighted = sighted;
  // ombre e cielo seguono la camera
  // v42: il quadrato delle ombre è spostato in avanti, dove guardi (più dettaglio sul visibile), e il centro è
  //  agganciato alla griglia dei texel della shadow map: muovendosi i bordi delle ombre non tremolano più
  const focus = _sunF.copy(p.alive && p.mode !== 'bus' ? p.pos : camera.position);
  {
    const sc = sun.shadow.camera, ext = sc.right, texel = (2 * ext) / sun.shadow.mapSize.x;
    focus.x += Math.sin(G.camYaw) * ext * 0.3; focus.z += Math.cos(G.camYaw) * ext * 0.3;
    const u = focus.dot(SUN_AX), v = focus.dot(SUN_AY), w = focus.dot(SUN_AZ);
    focus.copy(SUN_AX).multiplyScalar(Math.round(u / texel) * texel).addScaledVector(SUN_AY, Math.round(v / texel) * texel).addScaledVector(SUN_AZ, w);
    // bias proporzionato alla dimensione del texel: ombre nette senza "acne" né personaggi che fluttuano
    sun.shadow.normalBias = texel * 0.9; sun.shadow.bias = -0.00012 - texel * 0.00006;
  }
  sun.position.copy(focus).add(SUN_OFF);
  sun.target.position.copy(focus);
  sky.position.copy(camera.position);
  {
    const alt = clamp((camera.position.y - terrainHeight(camera.position.x, camera.position.z)) / 160, 0, 1);
    scene.fog.near = lerp(160, 420, alt) * fogK * weather.fogMul;
    scene.fog.far = lerp(620, 1500, alt) * fogK * lerp(weather.fogMul, 1, 0.15);
    scene.fog.color.copy(weather.fogTint);
  }
  // v25: dentro le case il soffitto resta al suo posto (prima tetti e piani superiori sparivano per mostrare il
  // personaggio dall'alto): la telecamera si accorcia contro soffitti e pareti grazie alle collisioni qui sopra
  CLIP.y.value = 1e9;
}

// ─────────────── HUD ───────────────
const XH = createCrosshair($('#crosshair'));   // v32: mirino dinamico
const _xhD = new THREE.Vector3();
const hud = {
  alive: $('#aliveCount'), kills: $('#killCount'), storm: $('#stormInfo'),
  hpFill: $('#hpFill'), hpText: $('#hpText'), shFill: $('#shieldFill'), shText: $('#shieldText'),
  hotbar: $('#hotbar'), mag: $('#magText'), res: $('#reserves'), mats: $('#matsText'),
  prompt: $('#prompt'), progress: $('#progress'), progFill: $('#progressFill'), progText: $('#progressText'),
  cross: $('#crosshair'), hit: $('#hitmarker'), center: $('#centerMsg'), sub: $('#subMsg'),
  smoke: $('#smokeVeil'), thr: $('#throwHud'),
  vignette: $('#vignette'), lowVig: $('#lowVig'), stRow: $('#staminaRow'), stFill: $('#staminaFill'), crouch: $('#crouchBadge'), hidden: $('#hiddenBadge'), poi: $('#poiName'), evt: $('#eventBar'), dmg: $('#damageLayer'), feed: $('#killfeed'),
};
const cache = {};
function setHTML(el, key, html) { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; } }

/** icona dell'arma: foto del modello 3D (o sagoma SVG se WebGL non riesce a farla) */
function weaponIconHTML(id, rarity, cls = 'wi', lazy = false) {
  // lazy (registro delle eliminazioni): se l'icona non è ancora pronta si usa quella vettoriale, senza fermare il gioco
  const url = lazy ? cachedWeaponIcon(id, rarity) : weaponIcon(id, rarity);
  return url ? `<img class="${cls}" src="${url}" alt="" draggable="false">` : weaponSVG(id, rarity);
}
/** icona del consumabile: foto del modello 3D (o emoji se WebGL non riesce a farla) */
function ammoIconHTML(id, cls = 'ci') {
  const url = ammoIcon(id);
  return url ? `<img class="${cls}" src="${url}" alt="">` : '';
}
function consIconHTML(id, cls = 'ci') {
  const url = consIcon(id);
  return url ? `<img class="${cls}" src="${url}" alt="" draggable="false">` : CONSUMABLES[id].icon;
}
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
  inventory.update();
  const p = G.player;
  setHTML(hud.alive, 'alive', G.teamSize > 1 ? `${aliveCount()}<small> · ${aliveTeams()} sq.</small>` : String(aliveCount()));
  renderTeamHud(false);
  updateMateTags();
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
      else if (x.kind === 'weapon') { inner = weaponIconHTML(x.id, x.rarity); rb = RARITIES[x.rarity].color; }
      else { inner = consIconHTML(x.id); rb = RARITIES[CONSUMABLES[x.id].rarity].color; cnt = 'x' + x.count; }
      const bg = rb ? `background:linear-gradient(180deg, rgba(0,0,0,.45), ${rb}55)` : '';
      return `<div class="slot ${i === p.active ? 'on' : ''}" style="${bg}"><span class="k">${i + 1}</span>${inner}<span class="c">${cnt}</span>${rb ? `<div class="rbar" style="background:${rb}"></div>` : ''}</div>`;
    }).join('');
  }
  const sl = p.slot;
  let magHtml;
  if (!sl) magHtml = '<small>Piccone</small>';
  else if (sl.kind === 'weapon' && WEAPONS[sl.id].melee) magHtml = `∞<div style="font-size:13px;color:${RARITIES[sl.rarity].color}">${WEAPONS[sl.id].name}</div>`;
  else if (sl.kind === 'weapon') { const def = WEAPONS[sl.id]; magHtml = `${sl.mag}<small> / ${p.ammo[def.ammo]}</small><div style="font-size:13px;color:${RARITIES[sl.rarity].color}">${def.name}</div>`; }
  else magHtml = `<small>${CONSUMABLES[sl.id].name} x${sl.count}</small>`;
  setHTML(hud.mag, 'mag', magHtml);
  setHTML(hud.res, 'res', Object.entries(p.ammo).filter(([, v]) => v > 0).map(([k, v]) => `<span style="color:${AMMO_TYPES[k].color}">${AMMO_TYPES[k].short} ${v}</span>`).join(''));
  setHTML(hud.mats, 'mats', String(p.mats));
  // prompt
  let pr = '';
  if (p.mode === 'bus') pr = '';
  else if (p.mode === 'climb' && p.alive) { pr = tk('🧗 <kbd>W</kbd> sali · <kbd>S</kbd> scendi · <kbd>Spazio</kbd> salta via', '🧗 Joystick su: sali · giù: scendi · <b>STACCATI</b> per saltare via'); hud.prompt.style.borderLeftColor = '#ffd23a'; }
  else if (G.interact && p.alive) {
    if (G.interact.loot) {
      const it = G.interact.loot.item;
      const col = it.kind === 'weapon' ? RARITIES[it.rarity].color : '#fff';
      pr = `<span style="border-color:${col}"><kbd class="kbE">E</kbd> Raccogli ${it.kind === 'weapon' ? weaponIconHTML(it.id, it.rarity, 'wi pi') : it.kind === 'cons' ? consIconHTML(it.id, 'ci pi') : it.kind === 'ammo' ? ammoIconHTML(it.id, 'ci pi') : ''}${it.kind === 'cons' ? `${CONSUMABLES[it.id].name} x${it.count}` : itemLabel(it)}</span>`;
      hud.prompt.style.borderLeftColor = col;
    } else if (G.interact.door) {
      const o = G.interact.door.open;
      pr = tk(`<kbd>E</kbd> ${o ? 'Chiudi' : 'Apri'} la porta 🚪`, `Porta 🚪 tocca <b>${o ? 'CHIUDI' : 'APRI'}</b>`); hud.prompt.style.borderLeftColor = '#c8a070';
    } else if (G.interact.stove) {
      const st = G.interact.stove;
      pr = st.lit ? tk(`<kbd>E</kbd> Spegni la stufa 🔥 <small>(${Math.ceil(st.t)} s di legna)</small>`, 'Stufa 🔥 tocca <b>SPEGNI</b>')
        : tk('<kbd>E</kbd> Accendi la stufa 🔥', 'Stufa 🔥 tocca <b>ACCENDI</b>');
      hud.prompt.style.borderLeftColor = '#ff8a3a';
    } else { pr = tk('<kbd>E</kbd> Apri il forziere ✨', 'Forziere ✨ tocca <b>APRI</b>'); hud.prompt.style.borderLeftColor = '#ffd24a'; }
  } else if (G.warm && p.alive && p.hp < 100) { pr = `🔥 Al calduccio: +2 PS/s <small>(${Math.ceil(G.warm.t)} s)</small>`; hud.prompt.style.borderLeftColor = '#ff8a3a';
  } else if (G.climbHint && p.alive && p.mode === 'ground') { pr = tk('🧗 <kbd>W</kbd> + <kbd>Spazio</kbd> per arrampicarti', '🧗 Spingi avanti + <b>SALTA</b> per arrampicarti'); hud.prompt.style.borderLeftColor = '#7fe07a'; }
  setHTML(hud.prompt, 'prompt', pr);
  hud.prompt.style.display = pr ? 'block' : 'none';
  // progress
  let prog = null;
  if (p.reloading > 0 && p.weapon) prog = [1 - p.reloading / WEAPONS[p.weapon.id].reload, 'Ricarica…'];
  else if (p.using) prog = [p.using.t / p.using.total, `Uso ${CONSUMABLES[p.slot.id].name}…`];
  hud.progress.classList.toggle('hidden', !prog);
  if (prog) { hud.progFill.style.width = (prog[0] * 100) + '%'; setHTML(hud.progText, 'pt', prog[1]); }
  // mirino (v32: dinamico, disegnato da crosshair.js)
  {
    const scopedNow = !$('#scope').classList.contains('hidden');
    const show = p.alive && p.mode === 'ground' && !G.build.on && !scopedNow && !G.sighted;
    const w = p.weapon, cdef = w ? WEAPONS[w.id] : null, cons = !!(p.slot && p.slot.kind === 'cons');
    const spread = currentSpread(p);
    const px = Math.tan(Math.max(spread, 0.004)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (innerHeight / 2);
    // cosa c'è sotto il mirino (ogni 60 ms): un nemico, a che distanza, se il piccone ci arriva
    G.xhT = (G.xhT || 0) - dt;
    if (!show) { G.xhEnemy = false; G.xhReach = false; G.xhAlly = false; }
    else if (G.xhT <= 0) {
      G.xhT = 0.06;
      camera.getWorldDirection(_xhD);
      const off = camera.position.distanceTo(p.chest());
      const h = rayAll(camera.position, _xhD, cdef ? Math.min(700, (cdef.range || 300) * 1.6 + off) : off + 3, p);
      G.xhEnemy = !!(h && h.char && h.char.alive && !(G.teamSize > 1 && h.char.team === p.team));
      G.xhAlly = !!(h && h.char && h.char.alive && G.teamSize > 1 && h.char.team === p.team);   // v41: verde sui compagni (niente fuoco amico)
      G.xhDist = h ? Math.max(0, h.t - off * 0.9) : Infinity;
      G.xhReach = !cdef && !cons && !!h && h.t - off < 2.4;
    }
    XH.update(dt, {
      show, style: cdef ? cdef.cross || 'cross' : cons ? 'cons' : 'melee',
      spreadPx: cdef ? Math.min(60, px) : 4, color: settings.chColor, size: settings.chSize,
      enemy: !!G.xhEnemy && (!!cdef || !!G.xhReach),
      ally: !!G.xhAlly,
      outRange: !!cdef && G.xhDist > (cdef.range || 999),
      sprint: (p.sprintK || 0) > 0.5,
      reload: p.reloading > 0 && cdef ? clamp(1 - p.reloading / cdef.reload, 0, 1) : -1,
      ready: cdef && cdef.rate >= 0.5 && !cdef.burst ? 1 - clamp(p.fireCd / cdef.rate, 0, 1) : -1,
      mag: cdef && cdef.mag ? w.mag / cdef.mag : -1,
      use: p.using ? p.using.t / p.using.total : -1, useShield: !!(p.using && cons && CONSUMABLES[p.slot.id].shield),
      spin: cdef && cdef.spin ? p.spinK || 0 : 0, reach: !!G.xhReach,
    });
  }
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
      el.classList.toggle('sighted', !!G.sighted);
    } else el.style.display = 'none';
  }
  G.hitT -= dt;
  hud.hit.style.opacity = G.hitT > 0 ? 1 : 0;
  G.hurtT -= dt;
  const low = p.alive && p.hp < 30 ? 0.35 + Math.sin(G.time * 6) * 0.15 : 0;
  hud.vignette.style.opacity = Math.max(low * 0.6, G.hurtT > 0 ? G.hurtT * 1.5 : 0);
  // v42: vita bassa: i bordi si scuriscono e si stringono (sotto 40 PS), il colore si spegne e batte il cuore
  {
    const lk = p.alive && p.mode !== 'bus' ? clamp((40 - p.hp) / 30, 0, 1) : 0;
    G.lowK = lerp(G.lowK || 0, lk, Math.min(1, dt * 3));
    const el = hud.lowVig;
    if (G.lowK > 0.01) {
      const beat = G.lowK * (0.92 + 0.08 * Math.max(0, Math.sin(G.time * (5 + G.lowK * 3)) ** 8));
      el.style.opacity = beat.toFixed(3); el.style.setProperty('--lowR', (62 - G.lowK * 24).toFixed(1) + '%');
      if (!el.classList.contains('on')) el.classList.add('on');
      if (G.time > (G.beatT || 0)) { G.beatT = G.time + 1.15 - G.lowK * 0.4; A.playHeartbeat(G.lowK); }
    } else if (el.classList.contains('on')) { el.classList.remove('on'); el.style.opacity = 0; }
    $('#game').style.filter = G.lowK > 0.05 && !G.sighted ? `saturate(${(1 - G.lowK * 0.55).toFixed(2)})` : '';
  }
  if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) { hud.center.textContent = ''; hud.sub.textContent = ''; } }
  // luogo
  let poi = '';
  for (const t of TOWNS) if (Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < t.r + 8) poi = t.name + (t.theme && t.theme !== 'classic' ? `<small>${THEME_LABEL[t.theme]}</small>` : '');
  if (!poi && p.mode !== 'bus') { const b = biomeName(p.pos.x, p.pos.z); if (b !== 'meadow') poi = `<small>${BIOME_NAMES[b]}</small>`; }
  setHTML(hud.poi, 'poi', poi);
  setHTML(hud.evt, 'evt', events.hudText());
  hud.evt.style.display = hud.evt.innerHTML ? '' : 'none';
  updateDmgNums(dt);
  drawDmgDirs(dt);   // v41
  // v41: velo grigio quando la camera è dentro una nube di fumo
  { const sk = throwSys.smokeAt(camera.position); if (Math.abs(sk - (G._smk || 0)) > 0.01) { G._smk = sk; hud.smoke.style.opacity = sk.toFixed(2); } }
  // v41: oggetto da lancio scelto
  { const n = p.throws ? p.throws[p.throwSel] || 0 : 0, tot = p.throws ? THROW_IDS.reduce((a, k) => a + (p.throws[k] || 0), 0) : 0;
    const key = tot ? `${p.throwSel}|${n}|${tot}|${G.throwAim ? 1 : 0}` : '';
    if (key !== G._thrKey) {
      G._thrKey = key;
      hud.thr.classList.toggle('hidden', !tot || p.mode === 'bus');
      if (tot) { const T = THROWABLES[p.throwSel]; hud.thr.children[0].textContent = T.icon; hud.thr.children[1].textContent = '×' + n; hud.thr.children[2].textContent = T.short + (tot > n ? ' · H cambia' : ''); hud.thr.style.setProperty('--tc', T.color); hud.thr.classList.toggle('aim', !!G.throwAim); }
    } }
  drawMinimap();
  if ($('#bigmap').classList.contains('hidden') === false) drawBigMap();
}

const mmCanvas = $('#minimap');
const mmCtx = mmCanvas.getContext('2d');
function w2m(v, center, view, S) { return (v - center) / view * S + S / 2; }
function drawMinimap() {
  const S = mmCanvas.width, view = 220;
  const p = G.player;
  const c = p.mode === 'bus' ? G.bus.pos : (p.alive ? p.pos : camera.position);
  const MM = world.minimap.width, k = MM / (HALF * 2);
  mmCtx.fillStyle = '#2a78bd';
  mmCtx.fillRect(0, 0, S, S);
  mmCtx.drawImage(world.minimap, (c.x - view / 2 + HALF) * k, (c.z - view / 2 + HALF) * k, view * k, view * k, 0, 0, S, S);
  drawStormOn(mmCtx, S, c.x, c.z, view);
  events.drawMarkers(mmCtx, S, c.x, c.z, view, w2m);
  drawBusLine(mmCtx, S, c.x, c.z, view);
  drawPingsOn(mmCtx, S, c.x, c.z, view, 1);
  mmCtx.font = 'bold 10px sans-serif'; mmCtx.textAlign = 'center';
  for (const t of TOWNS) {
    const x = w2m(t.x, c.x, view, S), y = w2m(t.z, c.z, view, S);
    if (x < -40 || x > S + 40 || y < -10 || y > S + 10) continue;
    mmCtx.fillStyle = 'rgba(0,0,0,.6)'; mmCtx.fillText(t.name, x + 1, y + 1);
    mmCtx.fillStyle = '#fff'; mmCtx.fillText(t.name, x, y);
  }
  drawMates(mmCtx, S, c.x, c.z, view, 4.5);
  drawPlayerArrow(mmCtx, w2m(p.pos.x, c.x, view, S), w2m(p.pos.z, c.z, view, S), 7);
}
function drawMates(ctx, S, cx, cz, view, r) {
  if (!G.player || G.teamSize <= 1) return;
  for (const m of teamOf(G.player)) {
    if (m === G.player || !m.alive || m.mode === 'bus') continue;
    const x = clamp(w2m(m.pos.x, cx, view, S), r, S - r), y = clamp(w2m(m.pos.z, cz, view, S), r, S - r);
    ctx.fillStyle = m.mateColor || '#3ad6ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
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
/** v41: segnalazioni sulla minimappa e sulla mappa grande */
function drawPingsOn(ctx, S, cx, cz, view, k) {
  for (const pg of G.pings) {
    const x = w2m(pg.pos.x, cx, view, S), y = w2m(pg.pos.z, cz, view, S);
    if (x < -10 || y < -10 || x > S + 10 || y > S + 10) continue;
    const K = PING_KIND[pg.kind], r = (5 + Math.sin(pg.t * 8) * 1.2) * k;
    ctx.fillStyle = K.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.2); ctx.lineTo(x - r * 0.8, y - r * 1.2); ctx.arc(x, y - r * 1.5, r * 0.85, Math.PI * 0.85, Math.PI * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
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
// v33: mappa grande con zoom (rotellina, pizzico, tasti + e −) e spostamento trascinando
const BM = { zoom: 1, cx: 0, cz: 0, follow: true, drag: null, pinch: null };
const BM_MAX = 8;
function bigMapOpen() { return !$('#bigmap').classList.contains('hidden'); }
function toggleBigMap(force) {
  const open = force !== undefined ? force : !bigMapOpen();
  $('#bigmap').classList.toggle('hidden', !open);
  document.body.classList.toggle('map-open', open);
  G.mapOpen = open;
  if (open) {
    BM.follow = true; mouse.left = mouse.right = false; G.ads = false;
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (G.state === 'play' && !G.paused && !G.invOpen && G.player && G.player.alive) requestLock();
}
function bmView() { return HALF * 2 / BM.zoom; }
function bmClampCenter() {
  const v = bmView() / 2, lim = Math.max(0, HALF - v);
  BM.cx = clamp(BM.cx, -lim, lim); BM.cz = clamp(BM.cz, -lim, lim);
}
/** zoom attorno a un punto del canvas (px, py in coordinate del canvas 0..640) */
function bmZoomAt(f, px = 320, py = 320) {
  const S = bmCanvas.width, v0 = bmView();
  const wx = BM.cx + (px / S - 0.5) * v0, wz = BM.cz + (py / S - 0.5) * v0;
  BM.zoom = clamp(BM.zoom * f, 1, BM_MAX);
  const v1 = bmView();
  BM.cx = wx - (px / S - 0.5) * v1; BM.cz = wz - (py / S - 0.5) * v1;
  BM.follow = false; bmClampCenter();
  $('#bmZoom').textContent = BM.zoom < 1.05 ? '1×' : BM.zoom.toFixed(1).replace('.', ',') + '×';
}
const bmLocal = (e) => { const r = bmCanvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * bmCanvas.width, (e.clientY - r.top) / r.height * bmCanvas.height]; };
bmCanvas.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = bmLocal(e); bmZoomAt(Math.exp(-e.deltaY * 0.0016), x, y); }, { passive: false });
const bmPtr = new Map();
bmCanvas.addEventListener('pointerdown', e => {
  e.preventDefault(); bmCanvas.setPointerCapture(e.pointerId);
  bmPtr.set(e.pointerId, bmLocal(e));
  if (bmPtr.size === 2) { const [a, b] = [...bmPtr.values()]; BM.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; BM.drag = null; }
  else BM.drag = bmLocal(e);
});
bmCanvas.addEventListener('pointermove', e => {
  if (!bmPtr.has(e.pointerId)) return;
  const p = bmLocal(e); bmPtr.set(e.pointerId, p);
  if (bmPtr.size === 2 && BM.pinch) {
    const [a, b] = [...bmPtr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (BM.pinch.d > 10) bmZoomAt(d / BM.pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    BM.pinch.d = d;
  } else if (BM.drag) {
    const k = bmView() / bmCanvas.width;
    BM.cx -= (p[0] - BM.drag[0]) * k; BM.cz -= (p[1] - BM.drag[1]) * k;
    BM.drag = p; BM.follow = false; bmClampCenter();
  }
});
const bmUp = e => { bmPtr.delete(e.pointerId); if (bmPtr.size < 2) BM.pinch = null; if (!bmPtr.size) BM.drag = null; };
bmCanvas.addEventListener('pointerup', bmUp); bmCanvas.addEventListener('pointercancel', bmUp);
$('#bmIn').addEventListener('click', e => { e.stopPropagation(); bmZoomAt(1.5); });
$('#bmOut').addEventListener('click', e => { e.stopPropagation(); bmZoomAt(1 / 1.5); });
$('#bmCenter').addEventListener('click', e => { e.stopPropagation(); BM.follow = true; });
$('#bmClose').addEventListener('click', e => { e.stopPropagation(); toggleBigMap(false); });
addEventListener('keydown', e => {
  if (!G.mapOpen || e.target.tagName === 'INPUT') return;
  if (e.code === 'Equal' || e.code === 'NumpadAdd') bmZoomAt(1.4);
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') bmZoomAt(1 / 1.4);
  else if (e.code === 'Escape') toggleBigMap(false);
});
function drawBigMap() {
  const S = bmCanvas.width;
  const p = G.player;
  const pp = !p ? camera.position : p.mode === 'bus' ? G.bus.pos : p.alive ? p.pos : (G.spectate && G.spectate.alive ? G.spectate.pos : camera.position);
  if (BM.follow) { BM.cx = pp.x; BM.cz = pp.z; bmClampCenter(); }
  const view = bmView(), cx = BM.cx, cz = BM.cz;
  const MM = world.minimap.width, k = MM / (HALF * 2);
  bmCtx.fillStyle = '#2a78bd'; bmCtx.fillRect(0, 0, S, S);
  bmCtx.imageSmoothingEnabled = true; bmCtx.imageSmoothingQuality = 'high';
  bmCtx.drawImage(world.minimap, (cx - view / 2 + HALF) * k, (cz - view / 2 + HALF) * k, view * k, view * k, 0, 0, S, S);
  // da vicino: case ed edifici ridisegnati netti (la minimappa ha 2 m per pixel)
  if (BM.zoom > 1.8) {
    const sc = S / view, a = clamp((BM.zoom - 1.8) / 1.2, 0, 1);
    bmCtx.globalAlpha = a;
    for (const h of world.houses) {
      if (h.collapsed) continue;
      const x = w2m(h.cx - h.w / 2, cx, view, S), y = w2m(h.cz - h.d / 2, cz, view, S), w = h.w * sc, d = h.d * sc;
      if (x > S || y > S || x + w < 0 || y + d < 0) continue;
      bmCtx.fillStyle = h.city === 'capannone' ? '#5a6672' : h.city === 'miniera' ? '#6a4a34' : h.city ? '#7a4a38' : '#6a4632';
      bmCtx.fillRect(x, y, w, d);
      bmCtx.strokeStyle = 'rgba(0,0,0,.55)'; bmCtx.lineWidth = 1; bmCtx.strokeRect(x + 0.5, y + 0.5, w - 1, d - 1);
      if (h.ruined) { bmCtx.strokeStyle = '#ffb43a'; bmCtx.beginPath(); bmCtx.moveTo(x, y); bmCtx.lineTo(x + w, y + d); bmCtx.moveTo(x + w, y); bmCtx.lineTo(x, y + d); bmCtx.stroke(); }
    }
    bmCtx.globalAlpha = 1;
  }
  drawStormOn(bmCtx, S, cx, cz, view);
  events.drawMarkers(bmCtx, S, cx, cz, view, w2m);
  drawBusLine(bmCtx, S, cx, cz, view);
  drawPingsOn(bmCtx, S, cx, cz, view, 1.6);
  bmCtx.font = `bold ${Math.round(13 + Math.min(5, BM.zoom))}px sans-serif`; bmCtx.textAlign = 'center';
  for (const t of TOWNS) {
    const x = w2m(t.x, cx, view, S), y = w2m(t.z, cz, view, S);
    if (x < -60 || x > S + 60 || y < -20 || y > S + 20) continue;
    bmCtx.fillStyle = 'rgba(0,0,0,.6)'; bmCtx.fillText(t.name, x + 1, y + 1);
    bmCtx.fillStyle = '#fff'; bmCtx.fillText(t.name, x, y);
  }
  // scala in metri
  {
    const mpp = view / S, nice = [10, 25, 50, 100, 200, 400, 800].find(m => m / mpp > 60) || 800, L = nice / mpp;
    bmCtx.fillStyle = 'rgba(0,0,0,.55)'; bmCtx.fillRect(12, S - 30, L + 16, 20);
    bmCtx.fillStyle = '#fff'; bmCtx.fillRect(20, S - 18, L, 3); bmCtx.fillRect(20, S - 23, 2, 10); bmCtx.fillRect(20 + L - 2, S - 23, 2, 10);
    bmCtx.font = 'bold 11px sans-serif'; bmCtx.textAlign = 'center'; bmCtx.fillText(nice + ' m', 20 + L / 2, S - 21);
  }
  drawMates(bmCtx, S, cx, cz, view, 6);
  if (p && (p.alive || p.mode === 'bus')) drawPlayerArrow(bmCtx, w2m(pp.x, cx, view, S), w2m(pp.z, cz, view, S), 10);
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
  bossFight.clear(); clawFX.reset();
  for (const o of G.debris) scene.remove(o.m);
  G.debris.length = 0;
  inventory.close();
  events.reset();
  weather.hide();
  world.resetProps();
  stoves.reset();
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
  // v44: ogni partita riparte con la grafica piena (la qualità automatica ricalcola da capo)
  if (AUTO.lvl) { AUTO.lvl = 0; applyAutoGfx(); }
  AUTO.low = AUTO.high = 0; AUTO.blockUpT = 0; AUTO.upT = AUTO.downT = 0;
  dynState.ceil = 1; dynState.ceilT = 0; if (dynState.k !== 1) { dynState.k = 1; gfx.setDyn(1); }
  try {
    const mode = NET.role === 'host' ? NET.mode : settings.mode;
    const random = mode === 'random';
    const seed = random ? 1 + Math.floor(Math.random() * 2e9) : 1337;
    await skinsReady(25000, !(world.seed === seed && world.random === random));
    const rebuilt = await prepareWorld(seed, random);
    if (!rebuilt && NET.role !== 'host') await matchIntro();
    if (NET.role === 'host') {
      // la lista dei partecipanti e dei bot la decide l'host
      const players = NET.players.map(p => ({ id: p.id, name: p.name, skin: p.skin, cos: { hat: p.hat, back: p.back, glider: p.glider } }));
      const duel = mode === 'duel';
      const total = duel ? (players.length > 1 ? players.length : 2) : 100;   // v37: duello senza bot (da solo: un bot)
      const names = makeBotNames(total - players.length);
      const bots = names.map(n => ({ name: n, skin: pick(SKINS).id, cos: randomCos() }));
      // v23: squadre. "Squadra" = gli amici insieme (a gruppi della dimensione scelta), "Versus" = ognuno nella sua squadra con i bot
      const T = duel ? 1 : teamSize(NET.team), vs = NET.vs || T === 1;
      players.forEach((p, i) => { p.team = vs ? i : Math.floor(i / T); });
      const used = players.length ? Math.max(...players.map(p => p.team)) + 1 : 0;
      const fill = new Array(used).fill(0); players.forEach(p => fill[p.team]++);
      let bi = 0;
      for (let tm = 0; tm < used; tm++) for (let k = fill[tm]; k < T && bi < bots.length; k++) bots[bi++].team = tm;
      for (let k = 0; bi < bots.length; k++) bots[bi++].team = used + Math.floor(k / T);
      const busAng = Math.random() * Math.PI * 2, busOff = rand(-50, 50) * SCALE;
      G.duel = duel ? pickDuelSpot() : null;
      const st = newStorm();
      const start = { t: 'start', seed, random, mode, team: duel ? 'solo' : NET.team, duel: G.duel, boss: !duel && bossRoll(), vs: !!NET.vs, lootSeed: Math.floor(Math.random() * 2e9), players, bots, bus: [busAng, busOff], storm: stormState(st), diff: settings.difficulty };
      NET.inMatch = true;
      // v34: si parte quando tutti hanno caricato l'isola (o dopo 45 s), così nessuno perde il bus o i primi messaggi
      const wait = new Set(NET.players.filter(p => !p.host).map(p => p.id));
      G.netReady = wait;
      netSend(start);
      if (wait.size) {
        const ld = $('#loading');
        ld.classList.remove('hidden');
        LD(null, 'In attesa degli altri giocatori…');
        const t0 = performance.now();
        while (wait.size && performance.now() - t0 < 45000 && NET.role === 'host') {
          wait.forEach(id => { if (!NET.players.some(p => p.id === id)) wait.delete(id); });
          await new Promise(r => setTimeout(r, 100));
        }
        ld.classList.add('hidden');
      }
      G.netReady = null;
      if (NET.role !== 'host') return;
      netSend({ t: 'go' });
      beginMatch(start);
    } else beginMatch(null);
  } finally { G.starting = false; }
}
/** client: l'host ha avviato la partita */
async function onNetStart(msg) {
  if (G.state !== 'menu') clearMatchToMenuSilently();
  // v34: i messaggi che arrivano mentre l'isola si carica vengono messi da parte (prima andavano persi)
  G.netQueue = []; G.netGo = false; G.netAborted = false;
  try {
    await skinsReady(20000, !(world.seed === msg.seed && world.random === msg.random));
    await prepareWorld(msg.seed, msg.random);
  } catch (e) { G.netQueue = null; $('#loading').classList.add('hidden'); throw e; }
  netSend({ t: 'ready', relay: false });
  if (!G.netGo) {
    const ld = $('#loading');
    ld.classList.remove('hidden');
    LD(null, 'In attesa degli altri giocatori…');
    const t0 = performance.now();
    while (!G.netGo && performance.now() - t0 < 30000 && NET.role === 'client') await new Promise(r => setTimeout(r, 50));
    ld.classList.add('hidden');
  }
  if (NET.role !== 'client' || G.netAborted) { G.netQueue = null; if (G.netAborted) menuApi.toast("L'host ha annullato la partita"); return; }
  const q = G.netQueue; G.netQueue = null;
  beginMatch(msg);
  for (const [f, m] of q) onNetMessage(f, m);
}
function clearMatchToMenuSilently() {
  clearMatch(); G.player = null; G.state = 'menu';
  for (const id of ['#end', '#pause', '#bigmap', '#scope']) $(id).classList.add('hidden');
  document.body.classList.remove('map-open'); G.mapOpen = false;
}

function setupBot(b) {
  b.ai = makeAI();
  // punto di atterraggio: città o luogo casuale
  let tx, tz;
  if (Math.random() < 0.32) { const t = pick(TOWNS); tx = t.x + rand(-t.r * 0.8, t.r * 0.8); tz = t.z + rand(-t.r * 0.8, t.r * 0.8); }
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
  G.team = net ? (net.team || 'solo') : (G.mode === 'duel' ? 'solo' : settings.team);
  G.duel = G.mode === 'duel' ? ((net && net.duel) || pickDuelSpot()) : null;
  G.teamSize = teamSize(G.team);
  G.teamWiped = false; G.killedBy = '';
  G.net = net ? { sendT: 0, snapT: 0, stormT: 0, byPeer: new Map() } : null;
  G.diff = scaledDifficulty((net && net.diff) || settings.difficulty, G.team, net ? (net.players || []).length : 1);
  G.time = 0; G.endShown = false; G.spectate = null; G.paused = false; G.ads = false;
  exitSpectate(); G.specKiller = null; G.specPitch = 0;
  G.lootSeq = 0; G.lootPrefix = ''; G.matchStats = { chests: 0, grass: 0, climb: 0, glide: 0, walk: 0, surv: 0 };
  throwSys.clear(); hideTrajectory(); G.throwAim = false; for (const q of [...G.placed]) removePlaced(q); placeGhost.visible = false;   // v42
  for (const pg of G.pings) pg.el.remove(); G.pings.length = 0; G.dmgDirs.length = 0; G.teamPingT = 0;   // v41
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
    else spawnLoot(randomThrow(), off());   // v41
    // v42: niente più munizioni sparse di un tipo a caso né mucchietti di legna per terra: ogni oggetto deve servire
    //  subito (le munizioni stanno accanto alla loro arma, la legna si raccoglie col piccone)
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
      c.human = true; c.team = pl.team ?? G.chars.length;
      if (me) { G.player = c; myIdx = G.chars.length; }
      else { c.remote = true; c.mats = 0; c.netId = pl.id; G.net.byPeer.set(pl.id, c); }
      G.chars.push(c);
    }
    G.lootPrefix = myIdx + ':';
    for (const bt of net.bots) {
      const b = new Character(bt.name, SKINS.find(x => x.id === bt.skin) || SKINS[0], false, bt.cos);
      b.team = bt.team ?? 1000 + G.chars.length;
      if (NET.role === 'host') setupBot(b); else { b.remote = true; b.mats = 0; }
      G.chars.push(b);
    }
  } else {
    G.bus = newBus();
    G.storm = newStorm();
    const skin = SKINS.find(s => s.id === settings.skin) || SKINS[0];
    const player = new Character(settings.name || 'Giocatore', skin, true, myCos());
    player.team = 0;
    G.player = player;
    G.chars.push(player);
    const T = G.teamSize;
    const nb = G.duel ? 1 : clamp((Number(settings.players) || 100) - 1, T, 99);
    const names = makeBotNames(nb);
    for (let i = 0; i < nb; i++) {
      const b = new Character(names[i % names.length], pick(SKINS), false, randomCos());
      // i primi T-1 bot sono i tuoi compagni, gli altri a gruppi di T
      b.team = i < T - 1 ? 0 : 1 + Math.floor((i - (T - 1)) / T);
      setupBot(b);
      G.chars.push(b);
    }
  }
  G.chars.forEach((c, i) => { c.idx = i; });
  buildTeams();
  // v34: i bot compagni di squadra dei giocatori veri restano al livello base, il potenziamento vale per i nemici
  G.humanTeams = G.teamSize > 1 ? new Set(G.chars.filter(c => c.human).map(c => c.team)) : null;
  G.diffAlly = scaledDifficulty(G.diff.key, 'solo', 1);
  const player = G.player;
  for (const c of G.chars) c.pos.copy(G.bus.pos);
  G.camYaw = Math.atan2(G.bus.b.x - G.bus.a.x, G.bus.b.z - G.bus.a.z) + Math.PI * 0.5;
  G.camPitch = -0.25;
  G.state = 'bus';
  $('#menu').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  scene.fog.far = 560;
  // v38: il Gargoyle del Colosseo (solo in alcune partite, mai nei duelli)
  G.bossOn = !G.duel && (net ? !!net.boss : bossRoll());
  if (G.bossOn && bossFight.spawn()) addFeed('🦇 Nel Colosseo al centro dell\'isola dorme un <b>Gargoyle</b>… chi lo sconfigge prende i suoi Artigli', false);
  if (G.duel) startDuel();
  else showMsg('BENVENUTO NEL BATTLE BUS!', (G.mode === 'random' ? '🎲 Random Map: isola nuova! · ' : '') + tk('Premi SPAZIO per lanciarti · muovi il mouse per guardarti intorno', 'Tocca LANCIATI quando vuoi · trascina per guardarti intorno'), 6);
  $('#netInfo').classList.toggle('hidden', !G.net);
  // personaggi delle skin in questa partita per primi
  preloadSkins([...new Set(G.chars.map(c => c.skin && c.skin.id).filter(Boolean))]);
  window.__warm = warmUp();
  if (G.net) $('#netInfo').textContent = `🌐 Online · stanza ${NET.code} · ${NET.players.length} giocatori + bot`;
  cache.hot = null;
  if (settings.fs !== false && !isFullscreen()) toggleFullscreen(true);
  requestLock();
}

// ─────────────── v37: duello 1 contro 1 ───────────────
/** punto dell'arena: una località a caso (case e ripari), lontano dall'acqua */
function pickDuelSpot() {
  // v38: metà dei duelli si combatte nell'arena dei gladiatori, sulla sabbia
  const ar = TOWNS.find(t => t.arena);
  if (ar && Math.random() < 0.5) return { x: r2(ar.x), z: r2(ar.z), a: r2(Math.random() * Math.PI * 2), r: 17 };   // fra la statua e le colonne (r 22)
  for (let i = 0; i < 40; i++) {
    const t = pick(TOWNS.filter(t => !t.arena));
    const x = t.x + rand(-0.3, 0.3) * t.r, z = t.z + rand(-0.3, 0.3) * t.r;
    if (terrainHeight(x, z) > WATER_LEVEL + 1 && Math.abs(x) < HALF - 90 && Math.abs(z) < HALF - 90) return { x: r2(x), z: r2(z), a: r2(Math.random() * Math.PI * 2) };
  }
  return { x: 0, z: 0, a: 0 };
}
/** tutti a terra ai lati opposti dell'arena, con lo stesso equipaggiamento */
function startDuel() {
  const d = G.duel, n = G.chars.length;
  if (busMesh) busMesh.visible = false;
  G.bus.t = G.bus.dur * 2;
  G.chars.forEach((c, i) => {
    const a = d.a + (i / n) * Math.PI * 2;
    let x = d.x + Math.cos(a) * (d.r || 28), z = d.z + Math.sin(a) * (d.r || 28);
    // se il punto è in acqua o dentro un muro, ci si avvicina al centro
    for (let k = 0; k < 6 && (terrainHeight(x, z) < WATER_LEVEL + 0.5); k++) { x = lerp(x, d.x, 0.3); z = lerp(z, d.z, 0.3); }
    c.mode = 'ground'; c.onGround = true; c.vel.set(0, 0, 0);
    c.pos.set(x, groundAt(x, z, terrainHeight(x, z) + 2), z);
    c.yaw = Math.atan2(d.x - x, d.z - z);
    c.m.root.visible = true;
    c.slots[0] = { kind: 'weapon', id: 'ar', rarity: 3, mag: WEAPONS.ar.mag };
    c.slots[1] = { kind: 'weapon', id: 'shotgun', rarity: 3, mag: WEAPONS.shotgun.mag };
    c.slots[2] = { kind: 'weapon', id: 'smg', rarity: 2, mag: WEAPONS.smg.mag };
    c.slots[3] = { kind: 'cons', id: 'minishield', count: 4 };
    c.slots[4] = { kind: 'cons', id: 'bandage', count: 5 };
    c.ammo = { light: 150, medium: 180, heavy: 0, shells: 36, rockets: 0 };
    c.mats = 400; c.shield = 50;
    c.active = -1; c.setActive(0);
    if (c.ai) { c.ai.state = 'idle'; c.ai.dropTarget.set(d.x, 0, d.z); }
  });
  if (G.player) { G.camYaw = G.player.yaw; G.camPitch = -0.05; }
  G.state = 'play';
  const foes = G.chars.filter(c => c !== G.player).map(c => c.name);
  showMsg('⚔️ 1 CONTRO 1', `contro ${foes.slice(0, 3).join(', ')}${foes.length > 3 ? '…' : ''} · la tempesta si chiude in fretta`, 4);
}

/** raggruppa i personaggi per squadra; le squadre di soli bot atterrano insieme */
function buildTeams() {
  G.teams = new Map();
  for (const c of G.chars) {
    if (c.team === undefined) c.team = 5000 + c.idx;
    if (!G.teams.has(c.team)) G.teams.set(c.team, []);
    G.teams.get(c.team).push(c);
  }
  for (const arr of G.teams.values()) {
    arr.sort((a, b) => (b.human ? 1 : 0) - (a.human ? 1 : 0));
    if (arr.length < 2 || arr[0].human) continue;
    const lead = arr[0];
    if (!lead.ai) continue;
    for (const m of arr.slice(1)) {
      if (!m.ai) continue;
      m.ai.dropTarget.set(lead.ai.dropTarget.x + rand(-5, 5), 0, lead.ai.dropTarget.z + rand(-5, 5));
      m.ai.jumpT = lead.ai.jumpT + rand(0, 0.8);
    }
  }
  // targhette dei compagni
  const box = $('#mateTags'); box.innerHTML = '';
  G.mateTags = [];
  if (G.teamSize > 1) {
    teamOf(G.player).filter(c => c !== G.player).forEach((c, i) => {
      const el = document.createElement('div'); el.className = 'mtag';
      el.style.setProperty('--mc', MATE_COLORS[(i + 1) % MATE_COLORS.length]);
      el.innerHTML = `<b>${esc(c.name)}</b><i><u></u></i>`;
      box.appendChild(el);
      c.mateColor = MATE_COLORS[(i + 1) % MATE_COLORS.length];
      G.mateTags.push({ c, el, bar: el.querySelector('u') });
    });
  }
  G.player.mateColor = MATE_COLORS[0];
  renderTeamHud(true);
}
function renderTeamHud(force) {
  const box = $('#teamHud');
  if (!G.player || G.teamSize <= 1) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const mates = teamOf(G.player);
  const key = mates.map(c => `${c.alive ? 1 : 0}${Math.ceil(Math.max(0, c.hp) / 5)}|${Math.ceil(c.shield / 5)}`).join(',');
  if (!force && key === G._teamKey) return;
  G._teamKey = key;
  box.innerHTML = `<div class="th-h">${TEAM_MODES.find(t => t.id === G.team).name.toUpperCase()}</div>` + mates.map(c => `<div class="tm ${c.alive ? '' : 'dead'}" style="--mc:${c.mateColor || '#fff'}">
    <span class="dot"></span><span class="nm">${esc(c.name)}${c === G.player ? ' (tu)' : ''}</span>
    <span class="bars"><i class="sh" style="width:${clamp(c.shield, 0, 100)}%"></i><i class="hp" style="width:${clamp(c.hp, 0, 100)}%"></i></span></div>`).join('');
}
const _tagV = new THREE.Vector3();
function updateMateTags() {
  if (!G.mateTags || !G.mateTags.length) return;
  const W = innerWidth, H = innerHeight;
  for (const t of G.mateTags) {
    const c = t.c;
    if (!c.alive || c.mode === 'bus' || G.state === 'end') { t.el.style.display = 'none'; continue; }
    _tagV.set(c.pos.x, c.pos.y + 2.35, c.pos.z).project(camera);
    if (_tagV.z > 1) { t.el.style.display = 'none'; continue; }
    const x = clamp((_tagV.x * 0.5 + 0.5) * W, 30, W - 30), y = clamp((-_tagV.y * 0.5 + 0.5) * H, 30, H - 30);
    const d = c.pos.distanceTo(camera.position);
    t.el.style.display = '';
    t.el.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(-50%,-100%) scale(${clamp(1.25 - d / 160, 0.7, 1.1).toFixed(2)})`;
    t.el.dataset.d = d > 25 ? Math.round(d) + ' m' : '';
    t.bar.style.width = clamp(c.hp, 0, 100) + '%';
  }
}

/** risultati della partita (una volta sola): XP, monete, missioni, testo della schermata finale */
function finishMatch(win) {
  if (G.endShown) return false;
  G.endShown = true;
  inventory.close();
  G.state = 'end';
  G.ads = false;
  const p = G.player;
  const place = win ? 1 : G.placement;
  $('#end').classList.toggle('win', win);
  $('#endPlace').textContent = '#' + place;
  const squad = G.teamSize > 1;
  const duel = G.mode === 'duel';
  $('#endTitle').textContent = win ? (duel ? 'DUELLO VINTO!' : 'VITTORIA REALE!') : (squad ? 'SQUADRA ELIMINATA' : duel ? 'DUELLO PERSO' : 'ELIMINATO');
  $('#endSub').textContent = win
    ? (duel ? `Hai battuto ${G.chars.filter(c => c !== p).map(c => c.name).slice(0, 3).join(', ')} in 1 contro 1. ⚔️🏆` : squad ? (p.alive ? 'La tua squadra è l\'ultima in piedi. Leggendari! 🏆' : 'I tuoi compagni hanno chiuso la partita: vittoria di squadra! 🏆') : 'Sei l\'ultimo sopravvissuto. Leggendario! 🏆')
    : (squad ? `La tua squadra è caduta · ultimo colpo: ${G.killedBy}` : `Sei stato eliminato da ${G.killedBy}`);
  const surv = G.time;
  // v41: statistiche dettagliate di fine partita
  const S = p.st, acc = S.shots ? Math.min(100, Math.round(S.hits / S.shots * 100)) : 0, hs = S.hits ? Math.round(S.heads / S.hits * 100) : 0;
  const dist = S.dist >= 1000 ? (S.dist / 1000).toFixed(2) + ' km' : Math.round(S.dist) + ' m';
  const st = (v, l, ic, cls = '') => `<div class="${cls}"><i>${ic}</i><b>${v}</b><span>${l}</span></div>`;
  $('#endStats').innerHTML =
    st(p.kills, 'Uccisioni', '💀', 'big') + st(Math.round(p.damageDealt), 'Danni inflitti', '💥', 'big') + st(fmtTime(surv), 'Tempo', '⏱', 'big') + st(`#${place}<small>/${G.teamSize > 1 ? G.teams.size : G.chars.length}</small>`, 'Posizione', '🏅', 'big') +
    st(acc + '%', 'Precisione', '🎯') + st(hs + '%', 'Colpi alla testa', '🧠') + st(S.maxKillD ? Math.round(S.maxKillD) + ' m' : '—', 'Uccisione più lontana', '📏') +
    st(Math.round(S.taken), 'Danni subiti', '🩸') + st(Math.round(S.healed), 'Vita e scudo curati', '💚') + st(dist, 'Distanza percorsa', '👟') +
    st(S.built, 'Muri costruiti', '🧱') + st(G.matchStats.chests, 'Forzieri aperti', '🧰') + st(G.matchStats.thrown || 0, 'Oggetti lanciati', '💣');
  // progressi: XP del pass, monete, missioni
  PR.track('survive', Math.floor(G.time));
  const res = PR.matchResult({ place, total: G.chars.length, kills: p.kills, time: G.time, damage: p.damageDealt, chests: G.matchStats.chests, win, mode: G.mode, online: !!G.net });
  renderEndXp(res);
  $('#againBtn').classList.toggle('hidden', NET.role === 'client');
  $('#againBtn').textContent = NET.role === 'host' ? 'NUOVA PARTITA PER TUTTI' : 'GIOCA ANCORA';
  return true;
}
function showEndScreen(delay = 0) {
  exitSpectate();
  if (document.pointerLockElement) document.exitPointerLock();
  // si può tornare a guardare la partita finché c'è qualcuno in piedi
  const can = G.player && !G.player.alive && G.chars.some(c => c.alive && c !== G.player) && !(G.duel && aliveTeams() <= 1);
  $('#specBtn').classList.toggle('hidden', !can);
  setTimeout(() => { if (!G.specOn && G.state === 'end') $('#end').classList.remove('hidden'); }, delay);
}
function endMatch(win) {
  if (win && G.player && G.player.alive && G.player.mode === 'ground') startEmote(G.player, 'tifo');
  if (!finishMatch(win)) return;
  showEndScreen(win ? 600 : 0);
  win ? A.playVictory() : A.playDefeat();
  if (win) showMsg(G.mode === 'duel' ? '⚔️ DUELLO VINTO!' : '#1 VITTORIA REALE!', '', 5);
}

// ─────────────── Spettatore (v33) ───────────────
/** dopo l'eliminazione: risultati salvati, poi si osserva chi ti ha eliminato (o il più vicino) */
function deathToSpectate(killer) {
  if (G.state === 'menu') return;
  if (!finishMatch(false)) { if (!G.specOn) showEndScreen(); return; }
  A.playDefeat();
  const t = killer && killer.alive ? killer : nearestAlive(G.player && G.player.pos);
  if (!t || aliveTeams() <= 0 || (G.duel && aliveTeams() <= 1)) { showEndScreen(G.duel ? 900 : 0); return; }   // v37: duello finito, niente spettatore
  enterSpectate(t, killer);
}
function enterSpectate(target, killer = G.specKiller) {
  if (!target) return;
  G.specOn = true; G.specKiller = killer || G.specKiller || null;
  G.spectate = target; G.specYaw = target.yaw; G.specOrbit = 0; G.specIdle = 0;
  $('#end').classList.add('hidden');
  $('#spectate').classList.remove('hidden');
  document.body.classList.add('spectating');
  updateSpectateHud(true);
}
function exitSpectate() {
  if (!G.specOn) return;
  G.specOn = false;
  $('#spectate').classList.add('hidden');
  document.body.classList.remove('spectating');
}
function specCycle(dir) {
  const list = G.chars.filter(c => c.alive && c !== G.player);
  if (!list.length) return;
  const i = list.indexOf(G.spectate);
  G.spectate = list[((i < 0 ? 0 : i + dir) + list.length) % list.length];
  G.specOrbit = 0; G.specYaw = G.spectate.yaw;
  A.playUI();
  updateSpectateHud(true);
}
function updateSpectateHud(force) {
  if (!G.specOn) return;
  const t = G.spectate;
  if (!t || !t.alive) { const n = nearestAlive(t && t.pos); if (n) G.spectate = n; else { showEndScreen(); return; } }
  const c = G.spectate;
  G.specHudT = (G.specHudT || 0) - 1;
  if (!force && G.specHudT > 0) return;
  G.specHudT = 6;
  const w = c.weapon ? WEAPONS[c.weapon.id] : null;
  const isKiller = c === G.specKiller;
  setHTML($('#specName'), 'sn', `${esc(c.name)}${isKiller ? ' <em>TI HA ELIMINATO</em>' : (G.player && c.team === G.player.team && G.teamSize > 1 ? ' <em class="mate">COMPAGNO</em>' : '')}`);
  setHTML($('#specInfo'), 'si', `<span>💀 ${c.kills}</span><span class="sh">🛡 ${Math.ceil(c.shield)}</span><span class="hp">❤ ${Math.ceil(c.hp)}</span>${w ? `<span>${weaponIconHTML(c.weapon.id, c.weapon.rarity, 'wi')} ${esc(w.name)}</span>` : '<span>⛏ Piccone</span>'}<span>👤 ${G.chars.filter(x => x.alive).length} vivi</span>`);
}
$('#specPrev').onclick = e => { e.stopPropagation(); specCycle(-1); };
$('#specNext').onclick = e => { e.stopPropagation(); specCycle(1); };
$('#specKill').onclick = e => { e.stopPropagation(); if (G.specKiller && G.specKiller.alive) { G.spectate = G.specKiller; G.specOrbit = 0; updateSpectateHud(true); } };
$('#specMenu').onclick = e => { e.stopPropagation(); A.playUI(); exitSpectate(); toMenu(); };
$('#specExit').onclick = e => { e.stopPropagation(); A.playUI(); showEndScreen(); };
$('#specBtn').onclick = () => { A.playUI(); const t = (G.specKiller && G.specKiller.alive && G.specKiller) || nearestAlive(G.player && G.player.pos); if (t) enterSpectate(t); };
addEventListener('keydown', e => {
  if (!G.specOn || e.target.tagName === 'INPUT') return;
  if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space') { e.preventDefault(); specCycle(1); }
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') specCycle(-1);
  else if (e.code === 'KeyK') $('#specKill').click();
  else if (e.code === 'Escape' || e.code === 'Enter') showEndScreen();
});
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
  exitSpectate();
  if (G.net && NET.role === 'host') { netSend({ t: 'abort' }); NET.inMatch = false; }
  G.net = null;
  clearMatch();
  G.state = 'menu';
  G.player = null;
  if (busMesh) busMesh.visible = false;
  $('#hud').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#pause').classList.add('hidden');
  $('#bigmap').classList.add('hidden'); document.body.classList.remove('map-open'); G.mapOpen = false;
  $('#scope').classList.add('hidden');
  $('#stormTint').style.opacity = 0;
  $('#vignette').style.opacity = 0; $('#lowVig').style.opacity = 0; $('#lowVig').classList.remove('on'); $('#game').style.filter = ''; G.lowK = 0;
  A.setStormSound(0);
  $('#menu').classList.remove('hidden');
  if (menuApi) menuApi.refresh();
}

// ─────────────── Lobby (armadietto) ───────────────
const lobby = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100), char: null, rot: 0.4, rotV: 0, drag: false, ring: null };
lobby.scene.onBeforeRender = syncAllReal;
{
  // v30: la lobby è un angolo della mappa: prato con il sentiero, boschetto, capanno con la legna, rocce e fiori,
  // colline e montagne nella foschia, nuvole e il bus della battaglia che passa in cielo
  const L = lobby.scene;
  lobby.cam.far = 260; lobby.cam.updateProjectionMatrix();
  L.fog = new THREE.Fog('#d4e3ef', 34, 175);
  L.add(new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), skyMaterial(new THREE.Vector3(4, 8, 5), { top: '#2f6fd8', mid: '#5b9cf0', bottom: '#d6ecff' })));
  L.add(new THREE.HemisphereLight('#dcecff', '#56663a', 1.15));
  const key = new THREE.DirectionalLight('#fff0d8', 2.7); key.position.set(4, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  L.add(key);
  const rim = new THREE.DirectionalLight('#a8d8ff', 1.5); rim.position.set(-4, 3, -4); L.add(rim);
  // riflessi per metalli e vetri (come nella partita)
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), gradientMaterial('#3d86dc', '#ffe3bd')));
    const gr = new THREE.Mesh(new THREE.CircleGeometry(100, 24), new THREE.MeshBasicMaterial({ color: '#56653a' })); gr.rotation.x = -Math.PI / 2; gr.position.y = -8; env.add(gr);
    const pm = new THREE.PMREMGenerator(renderer);
    L.environment = pm.fromScene(env, 0.02, 0.1, 400).texture; L.environmentIntensity = 0.35;
    pm.dispose();
  }
  const G = -0.08;   // quota del prato intorno al piedistallo
  const rnd = mulberry32(7331);
  const pathX = (z) => 3.4 + 1.4 * Math.sin(z * 0.28) - Math.max(0, -z - 6) * 0.35;
  const hAt = (x, z) => {
    const back = Math.max(0, -z - 10) / 22, side = Math.max(0, Math.abs(x) - 9) / 16;
    let h = G + 0.05 * Math.sin(x * 1.3 + z * 0.7) * Math.sin(z * 1.1 - x * 0.4) * Math.min(1, Math.hypot(x, z) / 3);
    h += (7 * Math.pow(back, 1.4) + 3.5 * side * side) * (0.65 + 0.35 * Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07));
    h += (back + side) * 0.6 * Math.sin(x * 0.4) * Math.sin(z * 0.33);
    return h;
  };
  // prato: colori per vertice (erba, sentiero in terra battuta, roccia sui pendii) e trama fine
  {
    const geo = new THREE.PlaneGeometry(150, 110, 150, 110); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -38);
    const q = geo.attributes.position, cols = new Float32Array(q.count * 3), c = new THREE.Color();
    const gA = new THREE.Color('#5d8a3a'), gB = new THREE.Color('#7da447'), gC = new THREE.Color('#4a7a34'), dirt = new THREE.Color('#a08158'), rock = new THREE.Color('#8c8a80');
    for (let i = 0; i < q.count; i++) {
      const x = q.getX(i), z = q.getZ(i), h = hAt(x, z);
      q.setY(i, h);
      const n = 0.5 + 0.5 * Math.sin(x * 0.7 + Math.sin(z * 0.5) * 2) * Math.cos(z * 0.6 - x * 0.2);
      c.copy(gA).lerp(gB, n).lerp(gC, Math.max(0, Math.sin(x * 0.23 + z * 0.31)) * 0.5);
      const dp = Math.abs(x - pathX(z));
      if (z > -26 && z < 12 && dp < 1.1) c.lerp(dirt, Math.min(1, (1.1 - dp) / 0.45) * 0.9);
      const sl = Math.abs(hAt(x + 0.5, z) - h) + Math.abs(hAt(x, z + 0.5) - h);
      if (sl > 0.55) c.lerp(rock, Math.min(1, (sl - 0.55) * 2));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const tc = document.createElement('canvas'); tc.width = tc.height = 128;
    const tg = tc.getContext('2d'); tg.fillStyle = '#d8d8d8'; tg.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 2600; k++) { const v = 150 + Math.floor(rnd() * 105); tg.fillStyle = `rgb(${v},${v},${v})`; tg.fillRect(rnd() * 128, rnd() * 128, 1, 2 + rnd() * 3); }
    const gt = new THREE.CanvasTexture(tc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(60, 44); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 8;
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: gt, roughness: 0.95, metalness: 0 }));
    ground.receiveShadow = true; L.add(ground);
  }
  // ciuffi d'erba e fiori (instanziati, si muovono col vento)
  {
    const pos = [], col = [];
    for (let b = 0; b < 5; b++) {
      const a = b / 5 * Math.PI, h = 0.18 + (b % 2) * 0.08, dx = Math.cos(a) * 0.05, dz = Math.sin(a) * 0.05, lean = (b - 2) * 0.03;
      pos.push(-dx, 0, -dz, dx, 0, dz, lean, h, lean * 0.5);
      for (const k of [0.55, 0.55, 1.0]) col.push(0.32 * k, 0.55 * k, 0.2 * k);
    }
    const tuft = new THREE.BufferGeometry();
    tuft.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tuft.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tuft.computeVertexNormals();
    const tm = bushMaterial.clone(); tm.side = THREE.DoubleSide; tm.onBeforeCompile = bushMaterial.onBeforeCompile; tm.customProgramCacheKey = bushMaterial.customProgramCacheKey;
    const N = 1400, im = new THREE.InstancedMesh(tuft, tm, N), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), cc = new THREE.Color();
    let n = 0;
    while (n < N) {
      const a = rnd() * Math.PI * 2, r = 1.5 + Math.pow(rnd(), 0.7) * 16, x = Math.cos(a) * r, z = Math.sin(a) * r - 4;
      if (Math.abs(x - pathX(z)) < 0.8 || Math.hypot(x, z) < 1.45) continue;
      const flower = rnd() < 0.06;
      m4.compose(new THREE.Vector3(x, hAt(x, z) - 0.01, z), qq.setFromAxisAngle(up, rnd() * 6.3), new THREE.Vector3(1, flower ? 1.3 : 0.7 + rnd() * 0.8, 1));
      im.setMatrixAt(n, m4);
      im.setColorAt(n, flower ? cc.set(['#ffffff', '#ffe04a', '#ff7ab0', '#b08aff'][Math.floor(rnd() * 4)]).multiplyScalar(2.2) : cc.setRGB(0.85 + rnd() * 0.4, 0.9 + rnd() * 0.3, 0.8 + rnd() * 0.3));
      n++;
    }
    im.receiveShadow = true; L.add(im);
  }
  // alberi, rocce, cespugli, capanno con la legna, ceppi, funghi, barili
  const inst = (geo, matl, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, matl, list.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach((o, k) => { m4.compose(new THREE.Vector3(o.x, o.y ?? hAt(o.x, o.z) - 0.1, o.z), qq.setFromAxisAngle(up, o.r ?? rnd() * 6.3), new THREE.Vector3(o.s ?? 1, (o.s ?? 1) * (o.sy ?? 1), o.s ?? 1)); im.setMatrixAt(k, m4); });
    im.castShadow = cast; im.receiveShadow = true; L.add(im); return im;
  };
  const free = (x, z) => !(Math.abs(x) < 6.2 && z > -13) && Math.abs(x - pathX(z)) > 1.8 && !(Math.abs(x + 7.5) < 3.5 && Math.abs(z + 11) < 3);
  const trees = { pine: [], oak: [], birch: [] };
  for (let k = 0, tries = 0; k < 46 && tries < 900; tries++) {
    const x = (rnd() - 0.5) * 70, z = 4 - rnd() * 52;
    if (!free(x, z) || (z > -6 && Math.abs(x) < 9)) continue;
    const kind = Math.abs(x) > 12 || z < -22 ? (rnd() < 0.65 ? 'pine' : 'oak') : (rnd() < 0.5 ? 'birch' : 'oak');
    trees[kind].push({ x, z, s: 0.75 + rnd() * 0.5, sy: 0.9 + rnd() * 0.25, r: rnd() * 6.3 }); k++;
  }
  for (const [kind, list] of Object.entries(trees)) if (list.length) { inst(PROPS[kind], treeMaterial, list); if (LEAVES[kind]) inst(LEAVES[kind], leafMaterial, list); }
  const rocks = [[-4.2, -3.5, 0.5], [5.8, -6, 0.8], [-9, -4, 1.1], [8.5, 1.5, 0.7], [-6.5, 0.8, 0.45], [2.6, -14, 1.3], [-12, -16, 1.6], [11, -12, 1.4]];
  rocks.forEach(([x, z, s], k) => inst(PROPS.rocks[k % PROPS.rocks.length], rockMaterial, [{ x, z, s, y: hAt(x, z) - 0.15 * s }]));
  const bushes = [[-5.2, -2.2], [5.1, -2.8], [-7.6, -7.4], [6.8, -9], [-3.6, -9.5], [9.2, -4.5], [-10, -1.5], [2.2, -11.5]];
  bushes.forEach(([x, z], k) => { const o = [{ x, z, s: 0.9 + (k % 3) * 0.2, r: k * 1.7 }], v = k % PROPS.bushes.length; inst(PROPS.bushes[v], bushMaterial, o, false); if (LEAVES.bushes[v]) inst(LEAVES.bushes[v], bushLeafMaterial, o, false); });
  inst(PROPS.shed, PROPS.shed.attributes.aTile ? shedMaterial : propMaterial, [{ x: -7.6, z: -11.2, r: 0.55 }]);
  inst(PROPS.logs, logMaterial, [{ x: -4.6, z: -10.4, r: 1.9, s: 0.8 }]);
  inst(PROPS.stumps[0], propMaterial, [{ x: 4.6, z: -4.6 }, { x: -8.4, z: -5.8, s: 1.2 }]);
  inst(PROPS.mushrooms[1], propMaterial, [{ x: 4.9, z: -4.1 }, { x: -6.0, z: -1.6 }]);
  inst(PROPS.barrelWood, propMaterial, [{ x: -5.6, z: -12.4 }]);
  inst(PROPS.fern, bushMaterial, [{ x: -4.9, z: -5.2 }, { x: 6.2, z: -3.2 }, { x: -2.8, z: -7.2 }]);
  // staccionata lungo il sentiero
  {
    const wood = new THREE.MeshStandardMaterial({ color: '#8a6440', roughness: 0.9 });
    const posts = [];
    for (let k = 0; k < 9; k++) { const z = -1.5 - k * 1.4, x = pathX(z) + 1.25; posts.push([x, z]); }
    const pg = new THREE.BoxGeometry(0.12, 0.9, 0.12), m4 = new THREE.Matrix4();
    const pim = new THREE.InstancedMesh(pg, wood, posts.length);
    posts.forEach(([x, z], k) => { m4.makeTranslation(x, hAt(x, z) + 0.4, z); pim.setMatrixAt(k, m4); });
    pim.castShadow = true; L.add(pim);
    for (let k = 0; k < posts.length - 1; k++) for (const hh of [0.3, 0.65]) {
      const [x0, z0] = posts[k], [x1, z1] = posts[k + 1], len = Math.hypot(x1 - x0, z1 - z0);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, len + 0.1), wood);
      rail.position.set((x0 + x1) / 2, (hAt(x0, z0) + hAt(x1, z1)) / 2 + hh, (z0 + z1) / 2); rail.rotation.y = Math.atan2(x1 - x0, z1 - z0); rail.castShadow = true; L.add(rail);
    }
  }
  // montagne lontane (si sciolgono nella foschia)
  {
    const mm = new THREE.MeshLambertMaterial({ color: '#7e93a8', flatShading: true }), sm = new THREE.MeshLambertMaterial({ color: '#f2f6fa', flatShading: true });
    for (let k = 0; k < 11; k++) {
      const a = -Math.PI / 2 + (k / 10 - 0.5) * 2.4, R = 110 + rnd() * 30, h = 26 + rnd() * 26, r = 22 + rnd() * 16;
      const mo = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mm); mo.position.set(Math.cos(a) * R, h / 2 - 2, Math.sin(a) * R); mo.rotation.y = rnd() * 6; L.add(mo);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, h * 0.28, 7), sm); cap.position.set(mo.position.x, h - 2 - h * 0.14 + 0.05, mo.position.z); cap.rotation.y = mo.rotation.y; L.add(cap);
    }
  }
  // v37: nuvole a sbuffi con i riccioli, come nel cielo della partita
  {
    lobby.clouds = [];
    const cm = cloudMaterial();
    for (let k = 0; k < 8; k++) {
      const cl = new THREE.Mesh(buildCloudGeometry(rnd, 24 + rnd() * 14), cm);
      cl.position.set((rnd() - 0.5) * 220, 26 + rnd() * 24, -95 - rnd() * 55);
      L.add(cl); lobby.clouds.push(cl);
    }
  }
  // il bus della battaglia che attraversa il cielo
  lobby.bus = buildBus(); lobby.bus.scale.setScalar(0.9); lobby.bus.traverse(o => { if (o.isMesh) o.castShadow = false; });
  L.add(lobby.bus);
  // piedistallo in pietra con l'anello del colore della rarità
  const stoneC = document.createElement('canvas'); stoneC.width = stoneC.height = 128;
  { const sg = stoneC.getContext('2d'); sg.fillStyle = '#b8b8b8'; sg.fillRect(0, 0, 128, 128); for (let k = 0; k < 1800; k++) { const v = 120 + Math.floor(rnd() * 110); sg.fillStyle = `rgba(${v},${v},${v},0.5)`; sg.beginPath(); sg.arc(rnd() * 128, rnd() * 128, 0.5 + rnd() * 2.2, 0, 7); sg.fill(); } }
  const st = new THREE.CanvasTexture(stoneC); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(4, 1); st.colorSpace = THREE.SRGBColorSpace;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.26, 40), new THREE.MeshStandardMaterial({ color: '#9a9488', map: st, roughness: 0.85, metalness: 0.02 }));
  ped.position.y = -0.13; ped.receiveShadow = true; ped.castShadow = true; L.add(ped);
  lobby.ring = new THREE.Mesh(new THREE.TorusGeometry(1.215, 0.028, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffcf2e' }));
  lobby.ring.rotation.x = Math.PI / 2; lobby.ring.position.y = -0.005; L.add(lobby.ring);
  lobby.groundY = G;
  // polline e lucciole che fluttuano nell'aria
  const pg = new THREE.BufferGeometry();
  const arr = new Float32Array(220 * 3);
  for (let i = 0; i < 220; i++) { arr[i * 3] = (rnd() - 0.5) * 18; arr[i * 3 + 1] = 0.2 + rnd() * 4.5; arr[i * 3 + 2] = 2 - rnd() * 14; }
  pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  lobby.stars = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#fff4c0', size: 0.045, transparent: true, opacity: 0.85, depthWrite: false }));
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
/** v23: compagni di squadra (amici o bot) accanto al personaggio, avversari della lobby più indietro */
let lobbyMatesKey = '';
function lobbyTeamPlan() {
  const team = NET.role === 'off' ? settings.team : NET.team;
  const T = teamSize(team);
  const mates = [], foes = [];
  if (NET.role !== 'off') {
    const vs = NET.vs || T === 1;
    const tf = (i) => vs ? i : Math.floor(i / T);
    const mi = Math.max(0, NET.players.findIndex(p => p.id === NET.myId));
    NET.players.forEach((p, i) => { if (p.id !== NET.myId) (tf(i) === tf(mi) ? mates : foes).push(p); });
  }
  for (let i = mates.length; i < T - 1; i++) {
    const sk = SKINS[(i * 7 + 3 + settings.skin.length) % SKINS.length];
    mates.push({ id: 'bot' + i, name: 'BOT', skin: sk.id, hat: 'none', back: i === 1 ? 'tactical' : 'none', bot: true });
  }
  return { T, mates: mates.slice(0, 3), foes: foes.slice(0, 6) };
}
function nameSprite(text, color, bg = 'rgba(0,0,0,.55)') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 8, 248, 48, 14); g.fill();
  g.fillStyle = color; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(1.2, 0.3, 1); sp.position.y = 2.35;
  return sp;
}
function refreshLobbyMates() {
  const plan = lobbyTeamPlan();
  const key = JSON.stringify([plan.mates.map(o => [o.id, o.skin, o.hat, o.back, o.name]), plan.foes.map(o => [o.id, o.skin, o.hat, o.back, o.name])]);
  if (key === lobbyMatesKey) return;
  lobbyMatesKey = key;
  for (const m of lobby.mates) lobby.scene.remove(m.root);
  lobby.mates = [];
  const SQUAD = plan.mates.length === 1 ? [[1.1, -0.5]] : [[-1.05, -0.5], [1.05, -0.5], [2.05, -1.45]];
  const FAR = [[2.3, -3.6], [-2.3, -3.6], [1.1, -4.6], [-1.1, -4.6], [3.0, -5.6], [-3.0, -5.6]];   // dentro lo spazio libero tra i pannelli
  const add = (o, spot, tag, color, bg) => {
    const c = buildCharacter(SKINS.find(s => s.id === o.skin) || SKINS[0], { hat: o.hat, back: o.back });
    c.root.position.set(spot[0], lobby.groundY ?? 0, spot[1]);
    c.root.rotation.y = -Math.sign(spot[0]) * 0.35;
    c.root.traverse(q => { if (q.isMesh) q.castShadow = true; });
    c.root.add(nameSprite(tag, color, bg));
    c.phase = Math.random() * 6;
    c.appear = 0;
    c.root.scale.setScalar(0.001);
    lobby.scene.add(c.root);
    lobby.mates.push(c);
  };
  plan.mates.forEach((o, i) => add(o, SQUAD[i], o.bot ? 'BOT' : (o.host ? '★ ' : '') + o.name, o.bot ? '#bfc8e0' : MATE_COLORS[(i + 1) % MATE_COLORS.length]));
  plan.foes.forEach((o, i) => add(o, FAR[i], 'VS · ' + o.name, '#ffffff', 'rgba(200,30,50,.75)'));
  lobby.squadN = plan.mates.length;
}
lobby.mates = [];
canvas.addEventListener('pointerdown', () => { if (G.state === 'menu') lobby.drag = true; });
// sul telefono il modello nella lobby si gira trascinando il dito
{
  let lx = null;
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') lx = e.clientX; });
  canvas.addEventListener('pointermove', e => { if (G.state === 'menu' && e.pointerType !== 'mouse' && lx !== null) { lobby.rotV += (e.clientX - lx) * 0.01; lx = e.clientX; } });
  addEventListener('pointerup', () => { lx = null; });
}
addEventListener('pointerup', () => { lobby.drag = false; });
// v33: zoom nell'armadietto (rotellina verso il punto indicato, pizzico, cursore, tasti testa / figura intera)
lobby.zoom = 1; lobby.zoomT = 1; lobby.focusY = 0.95; lobby.focusT = 0.95;
const lobbyCanZoom = () => G.state === 'menu' && menuApi && menuApi.tab() === 'locker';
function lobbyZoomTo(z, fy) {
  lobby.zoomT = clamp(z, 1, 4);
  if (fy !== undefined) lobby.focusT = fy;
  if (lobby.zoomT < 1.02) lobby.focusT = 0.95;
  lobby.focusT = clamp(lobby.focusT, 0.35, 1.75);
  const r = $('#lobbyZoomR'); if (r && document.activeElement !== r) r.value = lobby.zoomT;
}
/** altezza (m) sul piano del personaggio sotto un punto dello schermo */
function lobbyWorldY(clientY) {
  const cz = lobby.cam.position.z, vh = 2 * cz * Math.tan(THREE.MathUtils.degToRad(lobby.cam.fov / 2));
  return lobby.cam.position.y + (lobby._ly - lobby.cam.position.y) + (0.5 - clientY / innerHeight) * vh;
}
canvas.addEventListener('wheel', e => {
  if (!lobbyCanZoom()) return;
  e.preventDefault();
  const z = lobby.zoomT * Math.exp(-e.deltaY * 0.0018);
  lobbyZoomTo(z, lerp(lobby.focusT, lobbyWorldY(e.clientY), 0.35));
}, { passive: false });
{
  const pts = new Map(); let pd = 0, py = null;
  canvas.addEventListener('pointerdown', e => { if (!lobbyCanZoom()) return; pts.set(e.pointerId, [e.clientX, e.clientY]); py = e.clientY; if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !lobbyCanZoom()) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pd > 10) lobbyZoomTo(lobby.zoomT * d / pd, lobbyWorldY((a[1] + b[1]) / 2));
      pd = d;
    } else if (py !== null && lobby.zoomT > 1.05) {
      // trascinando in verticale si scorre lungo il personaggio
      const vh = 2 * lobby.cam.position.z * Math.tan(THREE.MathUtils.degToRad(lobby.cam.fov / 2));
      lobbyZoomTo(lobby.zoomT, lobby.focusT + (e.clientY - py) / innerHeight * vh);
      py = e.clientY;
    }
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) py = null; };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  const zb = $('#lobbyZoom');
  if (zb) {
    zb.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.dataset.z;
      if (k === 'in') lobbyZoomTo(lobby.zoomT * 1.35, lobby.focusT === 0.95 ? 1.25 : lobby.focusT);
      else if (k === 'out') lobbyZoomTo(lobby.zoomT / 1.35);
      else if (k === 'head') lobbyZoomTo(3.6, 1.62);
      else if (k === 'body') lobbyZoomTo(1, 0.95);
    });
    $('#lobbyZoomR').addEventListener('input', e => lobbyZoomTo(+e.target.value, lobby.focusT === 0.95 && +e.target.value > 1.05 ? 1.3 : lobby.focusT));
  }
}
function renderLobby(dt) {
  const c = lobby.char;
  const t = performance.now() / 1000;
  // v23: con i compagni in lobby il personaggio resta rivolto verso la camera (si può comunque girare trascinando)
  const faceFront = menuApi && menuApi.tab() === 'play' && lobby.squadN > 0;
  if (faceFront && Math.abs(lobby.rotV) < 0.004) {
    const front = Math.round(lobby.rot / (Math.PI * 2)) * Math.PI * 2 + Math.sin(t * 0.5) * 0.18;
    lobby.rot += (front - lobby.rot) * Math.min(1, dt * 3) + lobby.rotV;
  } else lobby.rot += lobby.rotV + dt * 0.35;
  lobby.rotV *= 0.9;
  if (c) {
    c.root.rotation.y = lobby.rot;
    resetPose(c);
    if (c.glider) poseGlide(c, t);
    else {
      // posa da armadietto: fucile in mano, respiro e peso che si sposta
      poseHold(c, -0.25, 1, Math.sin(t * 0.8) * 0.12, 0);   // v37: arma a riposo: calcio sulla spalla destra, bocca in basso a sinistra
      const br = Math.sin(t * 2) * 0.5 + 0.5;
      c.body.position.y = br * 0.012;
      c.torso.rotation.x = br * 0.02;
      c.torso.rotation.z = Math.sin(t * 0.6) * 0.02;
      setLeg(c, 0, -0.04, 0.08, 0.04); setLeg(c, 1, 0.06, 0.12, -0.06);
    }
    c.head.rotation.y = Math.sin(t * 0.7) * 0.25;
    if (c.cape) c.cape.rotation.x = 0.12 + Math.sin(t * 1.5) * 0.05;
  }
  const tab0 = menuApi ? menuApi.tab() : 'play';
  for (const m of lobby.mates) {
    m.root.visible = tab0 === 'play';
    m.appear = Math.min(1, m.appear + dt * 2.2);
    const e = 1 - Math.pow(1 - m.appear, 3);
    m.root.scale.setScalar(Math.max(0.001, e * (1 + Math.sin(m.appear * Math.PI) * 0.08)));
    resetPose(m);
    const tt = t + m.phase;
    poseHold(m, -0.3, 1, Math.sin(tt * 0.8) * 0.12, 0);
    m.body.position.y = (Math.sin(tt * 2) * 0.5 + 0.5) * 0.012;
    m.head.rotation.y = Math.sin(tt * 0.6) * 0.3;
    setLeg(m, 0, -0.04, 0.08, 0.04); setLeg(m, 1, 0.06, 0.12, -0.06);
  }
  lobby.stars.rotation.y = t * 0.02;
  lobby.stars.position.y = Math.sin(t * 0.4) * 0.15;
  WIND.value = t % 1800;
  // v30: il bus attraversa il cielo dietro il personaggio, le nuvole scorrono piano
  if (lobby.bus) {
    const k = ((t * 0.018) % 1), x = -150 + k * 300;
    lobby.bus.position.set(x, 30 + Math.sin(t * 0.5) * 0.8, -95);
    lobby.bus.rotation.set(0, Math.PI / 2, Math.sin(t * 0.7) * 0.03);
  }
  if (lobby.clouds) { for (const cl of lobby.clouds) { cl.position.x += dt * 0.8; if (cl.position.x > 130) cl.position.x = -130; } faceClouds(lobby.clouds, lobby.cam); }
  // personaggio centrato nello spazio libero tra i pannelli (metri per pixel alla distanza della camera)
  const tab = menuApi ? menuApi.tab() : 'play';
  // con la squadra la camera si allontana un po' per inquadrare tutti
  if (tab !== 'locker' && lobby.zoomT !== 1) lobbyZoomTo(1, 0.95);
  lobby.zoom += (lobby.zoomT - lobby.zoom) * Math.min(1, dt * 8);
  lobby.focusY += (lobby.focusT - lobby.focusY) * Math.min(1, dt * 8);
  const zk = (lobby.zoom - 1) / 3;
  const wantZ = (tab === 'play' ? 7.4 + (lobby.squadN || 0) * 1.1 : 7.4) / lobby.zoom;
  lobby.cam.position.z += (wantZ - lobby.cam.position.z) * Math.min(1, dt * (lobby.zoom > 1.01 ? 10 : 4));
  const mpp = 2 * lobby.cam.position.z * Math.tan(THREE.MathUtils.degToRad(lobby.cam.fov / 2)) / innerHeight;
  let sx = 0, ly = 0.95;
  if (innerWidth > 900) {
    if (tab === 'play') sx = -((380 + 34) - (340 + 34)) / 2 * mpp + (lobby.squadN === 1 ? 0.5 : lobby.squadN === 3 ? 0.45 : 0);
    else if (tab === 'pass') { sx = 0; ly = 0.15; }
    else sx = (440 + 34) / 2 * mpp;
  }
  lobby.cam.position.x += (sx - lobby.cam.position.x) * Math.min(1, dt * 6);
  if (tab === 'locker') ly = lerp(ly, lobby.focusY, Math.min(1, zk * 3));
  lobby._ly = (lobby._ly ?? ly) + (ly - (lobby._ly ?? ly)) * Math.min(1, dt * 6);
  lobby.cam.position.y = lerp(1.25, lobby._ly + 0.08, Math.min(1, zk * 2));
  lobby.cam.lookAt(lobby.cam.position.x, lobby._ly, 0);
  gfx.render(lobby.scene, lobby.cam);
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
  const fl = (c.onGround ? 1 : 0) | (c.crouch ? 2 : 0) | (c.inWater ? 4 : 0) | (c.swing > 0.2 ? 8 : 0) | (c.using ? 16 : 0) | (c.reloading > 0 ? 32 : 0) | (c.slide ? 64 : 0) | (c.vault ? 128 : 0);   // v42
  return [c.idx, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r2(c.yaw), r2(c.pitch), MODE_CODES.indexOf(c.mode), fl,
    r2(c.vel.x), r2(c.vel.y), r2(c.vel.z), heldCode(c),
    c.mode === 'climb' ? r2(Math.atan2(c.climbDir.x, c.climbDir.z)) : 0, r2(c.climbPhase || 0), c.mantle ? r2(c.mantle.t) : -1, c.emote ? c.emote.id : 0,
    c.claw ? CLAW_IDS.indexOf(c.claw.id) : -1, c.claw ? r2(c.claw.t) : 0];
}
function applyCharState(c, a) {
  const n = c.net || (c.net = {});
  n.x = a[1]; n.y = a[2]; n.z = a[3]; n.yaw = a[4]; n.pitch = a[5]; n.mode = MODE_CODES[a[6]] || 'ground'; n.fl = a[7];
  n.vx = a[8]; n.vy = a[9]; n.vz = a[10]; n.held = a[11]; n.cy = a[12]; n.cp = a[13]; n.mt = a[14]; n.em = a[15]; n.cl = a[16] ?? -1; n.clt = a[17] || 0; n.t = performance.now();
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
  c.slideNet = !!(n.fl & 64); c.vaultNet = !!(n.fl & 128);   // v42
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
  // v38: mosse degli Artigli
  if (n.cl >= 0 && CLAW_IDS[n.cl]) {
    const id = CLAW_IDS[n.cl];
    if (!c.claw || c.claw.id !== id || c.claw.t > n.clt + 0.35 || (c.claw.t < n.clt - 0.35)) c.claw = { id, t: n.clt, hit: true };
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
  if (def.spin) { ch.spinReq = G.time; ch.spinK = 1; }
  ch.recoilT = 0.14; ch.recoilK = def.pellets > 1 || def.projectile ? 1.6 : def.rate > 0.5 ? 1.3 : def.spin ? 0.35 : 0.7;
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
    // v34: chi è lontano (oltre 120 m) viene aggiornato una volta su tre: dimezza la banda dell'host senza differenze visibili
    N.snapN = (N.snapN || 0) + 1;
    const all = N.snapN % 3 === 0;
    for (const rc of G.chars) {
      if (!rc.remote || !rc.human || !rc.netId) continue;
      const list = [];
      const air = rc.mode === 'bus' || rc.mode === 'fall';
      const far = air ? 1200 : 800, near = air ? 1200 : 120;
      for (const c of G.chars) {
        if (c === rc || !c.alive || c.mode === 'bus') continue;
        const d2 = c.pos.distanceToSquared(rc.pos);
        if (c.human || d2 < near * near || (all && d2 < far * far)) list.push(encodeChar(c));
      }
      netSendTo(rc.netId, { t: 'snap', c: list, bt: r2(G.bus ? G.bus.t : 0), gt: r2(G.time) });
    }
  }
  if (now - N.stormT > 1000) { N.stormT = now; netSend({ t: 'storm', s: stormState(G.storm) }); }
}
const _nv = new THREE.Vector3();
function onNetMessage(from, m) {
  if (m.t === 'start') { onNetStart(m); return; }
  if (m.t === 'abort') { if (G.netQueue) { G.netAborted = true; G.netGo = true; } if (G.state !== 'menu') { toMenu(); menuApi.toast("L'host ha terminato la partita"); } return; }
  if (m.t === 'ready') { if (G.netReady) G.netReady.delete(from); return; }
  if (m.t === 'go') { G.netGo = true; return; }
  if (G.netQueue) { if (m.t !== 'snap' && m.t !== 'storm' && m.t !== 'boss' && G.netQueue.length < 3000) G.netQueue.push([from, m]); return; }
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
      case 'boss': case 'bhit': case 'bdead': bossFight.onNet(m, sender); break;
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
      case 'door': { const d = world.doors[m.k]; if (d) toggleDoor(d, null, !!m.o, true); break; }
      case 'stove': { const st = world.stoves[m.k]; if (st) toggleStove(st, null, !!m.o, true); break; }
      case 'evt': if (NET.role === 'client') events.start(m); break;
      case 'sdmg': {
        const at = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
        structEffects(m.r ? world.damageSphere(at, m.r, m.a) : world.damagePoint(at, m.a), null, true);
        break;
      }
      case 'pl': {   // v42: trampolino o trappola piazzati da un altro giocatore (o da un bot dell'host)
        const ch = C[m.v];
        if (!ch || ch === G.player || !THROWABLES[m.id] || !THROWABLES[m.id].place) break;
        if (!G.placed.some(q => q.key === m.k)) placeItem(ch, m.id, m.x, m.y, m.z, m.r || 0, true, m.k);
        break;
      }
      case 'thr': {   // v41: oggetto da lancio di un altro giocatore (o di un bot dell'host)
        const ch = C[m.v];
        if (!ch || ch === G.player || !THROWABLES[m.id]) break;
        throwItem(ch, m.id, m.y, m.p, m.s, true);
        break;
      }
      case 'ping': {   // v41: segnalazione di un compagno
        const ch = C[m.o];
        if (!ch || ch === G.player || !PING_KIND[m.k] || !G.player || ch.team !== G.player.team) break;
        addPing(m.k, _nv.set(m.p[0], m.p[1], m.p[2]), ch, m.tg >= 0 ? C[m.tg] : null, m.l || null, true);
        break;
      }
      case 'wall': {
        const g = m.g;
        makeWall({ k: m.k || 'wall', x: m.x, z: m.z, g, alongX: !!m.ax, dir: m.d || 'z+' });
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
  if (p.mode !== 'bus') p.st.dist += Math.hypot(p.vel.x, p.vel.z) * dt;   // v41: distanza percorsa (anche planando)
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
// ─────────────── v38: Gargoyle e Artigli ───────────────
const clawFX = createClawFX(scene);
const bossFight = createBossFight({
  scene, G, camera, TOWNS, groundAt, damage, emit, spawnLoot, addFeed, showMsg, esc, A, fx: clawFX,
  net: () => ({ on: !!G.net && NET.role !== 'off', host: !!G.net && NET.role === 'host', client: !!G.net && NET.role === 'client' }),
  send: (m) => netSend(m),
  shake: (k) => { G.shake = Math.max(G.shake, k); },
  onPlayerHit: (amt, head, pos) => {
    PR.track('damage', amt);
    dmgNumber(new THREE.Vector3(pos.x + rand(-0.4, 0.4), pos.y + 0.4, pos.z + rand(-0.4, 0.4)), amt, head ? 'head' : '');
    G.hitT = 0.15; $('#hitmarker').classList.toggle('head', head);
    XH.hit(head ? 'head' : 'body');
    A.playHit(head);
  },
});
/** il boss c'è in questa partita? (?boss=1 lo forza, ?boss=0 lo toglie) */
function bossRoll() {
  const q = new URLSearchParams(location.search).get('boss');
  if (q === '1') return true;
  if (q === '0') return false;
  return Math.random() < BOSS_CHANCE;
}
const CLAW_IDS = Object.keys(CLAW_MOVES);
const CLAW_COMBO = ['swipeR', 'swipeL', 'spin', 'double'];
const CLAW_SPEED = 1.2;          // il giocatore è più piccolo e un po' più rapido del Gargoyle
const CLAW_SCALE = 0.72;         // portata delle mosse rispetto al boss
/** inizia (o mette in coda) una mossa degli Artigli */
function clawAttack(ch, special = null) {
  if (ch.mode !== 'ground' || ch.using || ch.inWater) return false;
  if (ch.claw) {
    const cm = CLAW_MOVES[ch.claw.id];
    if (ch.claw.t / cm.dur > 0.35) ch.clawQueue = special || true;
    return false;
  }
  let id = special;
  if (id === 'pounce' && ((ch.pounceCd || 0) > G.time || !ch.onGround)) id = null;
  if (!id) {
    const gap = G.time - (ch.clawLastT ?? -9);
    ch.clawCombo = gap < 0.55 ? ((ch.clawCombo ?? -1) + 1) % CLAW_COMBO.length : 0;
    id = CLAW_COMBO[ch.clawCombo];
  }
  if (id === 'pounce') { ch.pounceCd = G.time + 2.2; ch.clawCombo = -1; }
  ch.claw = { id, t: 0, hit: false };
  ch.emote = null; ch.lastShotT = G.time; ch.reloading = 0;
  if (ch.isPlayer) XH.fire(0.6);
  return true;
}
function updateClaw(c, dt) {
  const cl = c.claw, mv = CLAW_MOVES[cl.id];
  const prevU = cl.t / mv.dur;
  cl.t += dt * CLAW_SPEED;
  const u = cl.t / mv.dur, realDur = mv.dur / CLAW_SPEED;
  if (!c.remote) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let push = 0;
    if (cl.id === 'pounce') {
      const [a, b] = mv.air;
      if (prevU < a && u >= a && c.onGround) { c.vel.y = 6.2; c.onGround = false; }
      if (u > a && u < b) push = 7.5 / ((b - a) * realDur);
    } else {
      const a = mv.hit - 0.2, b = mv.hit + 0.02;
      if (u > a && u < b) push = mv.lunge * 0.8 / ((b - a) * realDur);
    }
    c.pushX = fx * push; c.pushZ = fz * push;
    if (!cl.hit && u >= mv.hit) { cl.hit = true; clawStrike(c, cl.id, mv); }
  }
  if (prevU < mv.hit && u >= mv.hit) clawEffects(c, cl.id, mv);
  if (u >= 1) {
    c.claw = null; c.pushX = c.pushZ = 0; c.clawLastT = G.time;
    if (c.clawQueue && !c.remote) { const q = c.clawQueue; c.clawQueue = null; clawAttack(c, q === true ? null : q); }
  }
}
function clawStrike(c, id, mv) {
  const mult = (c.weapon ? RARITIES[c.weapon.rarity].mult : 1) * (c.isPlayer || c.human ? 1 : botDiff(c).dmgMult);
  const dmg = mv.pdmg * mult, reach = mv.reach * CLAW_SCALE + 0.35, name = WEAPONS.claws.name;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const ix = c.pos.x + fx * 1.3, iz = c.pos.z + fz * 1.3, aoe = mv.aoe ? mv.aoe * 0.75 : 0;
  let any = false;
  for (const t of G.chars) {
    if (t === c || !t.alive || t.mode === 'bus' || isMate(c, t)) continue;
    const dx = t.pos.x - c.pos.x, dz = t.pos.z - c.pos.z, dy = t.pos.y - c.pos.y;
    if (dy < -1.4 || dy > 2.2) continue;
    const d = Math.hypot(dx, dz);
    const ang = Math.abs(angDelta(Math.atan2(dx, dz), c.yaw));
    if ((d <= reach && ang <= mv.arc) || (aoe && Math.hypot(t.pos.x - ix, t.pos.z - iz) <= aoe)) {
      damage(t, dmg, c, false, name); any = true;
      emit(t.chest(), '#d02020', 8, 3.5, 0.45, 0.09);
    }
  }
  if (bossFight.active) {
    const bc = bossFight.center(new THREE.Vector3()), dx = bc.x - c.pos.x, dz = bc.z - c.pos.z, dy = bc.y - c.pos.y;
    const d = Math.max(0, Math.hypot(dx, dz) - 1.0), ang = Math.abs(angDelta(Math.atan2(dx, dz), c.yaw));
    if (dy > -2 && dy < 4 && ((d <= reach && ang <= mv.arc + 0.3) || (aoe && Math.max(0, Math.hypot(bc.x - ix, bc.z - iz) - 1) <= aoe))) {
      bossFight.hurt(dmg, c, false, bc); any = true; emit(bc, '#6a1a10', 8, 3.5, 0.45, 0.09);
    }
  }
  // muri, auto e rocce davanti
  const o = c.chest(), d = new THREE.Vector3(fx, 0, fz);
  const hit = rayWorld(o, d, reach);
  if (hit && hit.collider) {
    const p = o.clone().addScaledVector(d, hit.t);
    if (hit.collider.hp) damageWall(hit.collider, 90);
    if (hit.collider.spec || hit.collider.rock || hit.collider.special) structHit(hit.collider, p, 80, c);
    if (hit.collider.barrel) damageBarrel(hit.collider.barrel, 40, c);
    emit(p, '#bbbbbb', 6, 3, 0.4, 0.08);
  }
  if (any && c.isPlayer) G.shake = Math.max(G.shake, 0.25);
}
function clawEffects(c, id, mv) {
  const dist = c.isPlayer ? 0 : c.pos.distanceTo(camera.position);
  if (dist > 140) return;
  const y = c.pos.y + 1.15 * c.hScale;
  const col = '#fff1c4';
  const at = new THREE.Vector3(c.pos.x, y, c.pos.z);
  if (id === 'swipeR' || id === 'swipeL') { clawFX.slash(at, c.yaw, id === 'swipeR' ? 1 : -1, 1.75, 0.4, col, 0.22); A.playGun('claw', dist); }
  else if (id === 'spin') { clawFX.spin(at, c.yaw, 1.9, col); A.playGun('claw', dist); }
  else {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), x = c.pos.x + fx * 1.3, z = c.pos.z + fz * 1.3;
    at.set(x, groundAt(x, z, c.pos.y + 1), z);
    clawFX.ring(at, (mv.aoe || 3) * 0.95, '#ffe2a8');
    emit(at, '#cbb89a', 14, 4.5, 0.7, 0.22, 0.3);
    A.playGun('clawHeavy', dist);
    if (c.isPlayer) G.shake = Math.max(G.shake, 0.35);
  }
}

// eventi della mappa (decisi dall'host o dal gioco offline)
const events = createEvents({
  scene, G, weather, sun, sunBase: SUN_BASE, sunGold: SUN_GOLD, TOWNS, HALF, WATER_LEVEL,
  isAuthority: () => !G.net || NET.role === 'host', send: (m) => netSend(m),
  explode, spawnLoot, randomWeapon, ammoFor, emit, showMsg, addFeed, terrainHeight, groundAt,
  playAlert: () => { A.playUI(); setTimeout(() => A.playUI(), 140); },
});

function update(dt) {
  G.time += dt;
  perfFrame();   // v43
  if (pressed.has('KeyM')) toggleBigMap();
  updateBus(dt);
  updatePlayer(dt);
  netTick(dt);
  progressTick(dt);
  // v43: i bot lontani da tutti i giocatori veri pensano e si muovono a frame alterni (con il tempo accumulato)
  humansNow.length = 0;
  for (const c of G.chars) if (c.alive && (c.isPlayer || c.human) && c.mode !== 'bus') humansNow.push(c.pos);
  if (!humansNow.length) humansNow.push(camera.position);
  for (const c of G.chars) {
    if (!c.isPlayer) {
      if (c.remote) updatePuppet(c, dt);
      else if (c.mode !== 'ground' || !c.alive) updateBot(c, dt);
      else {
        let d2 = Infinity;
        for (const h of humansNow) { const dx = h.x - c.pos.x, dz = h.z - c.pos.z, q = dx * dx + dz * dz; if (q < d2) d2 = q; }
        const div = d2 < PERF.botFar2 * PERF.botFar2 ? 1 : d2 < PERF.botFar3 * PERF.botFar3 ? 2 : 3;
        c._botAcc = (c._botAcc || 0) + dt;
        if (div === 1 || (frameN + c.idx) % div === 0) { updateBot(c, Math.min(c._botAcc, 0.1)); c._botAcc = 0; }
      }
    }
    c.hidden = c.alive && c.mode === 'ground' && c.crouch && !c.inWater && tallGrassAt(c.pos.x, c.pos.z);
    if (c.alive) {
      c.fireCd = Math.max(0, c.fireCd - dt);
      if (c.burstLeft > 0 && c.fireCd <= 0) {
        if (c.weapon !== c.burstSlot || c.reloading > 0) c.burstLeft = 0;
        else c.burstNext();
      }
      const wdef = c.weapon && WEAPONS[c.weapon.id];
      if (wdef && wdef.spin) {
        const want = G.time - (c.spinReq ?? -9) < 0.15 && c.reloading <= 0;
        if (want && c.isPlayer && (c.spinK || 0) < 0.05 && !(c._spinSnd > G.time)) { A.playGun('spin'); c._spinSnd = G.time + 0.5; }
        c.spinK = want ? Math.min(1, (c.spinK || 0) + dt / wdef.spin) : Math.max(0, (c.spinK || 0) - dt * 0.9);
      } else c.spinK = 0;
      c.tireT = Math.max(0, (c.tireT || 0) - dt);
      if (c.mode !== 'climb' && c.onGround && c.tireT <= 0) c.stamina = Math.min(100, c.stamina + dt * (c.inWater ? 6 : 15));
      c.swing = Math.max(0, c.swing - dt);
      if (c.claw) updateClaw(c, dt); else if (c.pushX || c.pushZ) c.pushX = c.pushZ = 0;
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
  bossFight.update(dt);
  clawFX.update(dt);
  // v41: oggetti da lancio, segnalazioni
  throwSys.update(dt);
  updatePlaced(dt);   // v42: trampolini e trappole
  if (trajLine.visible && G.throwAimT !== G.time) { hideTrajectory(); G.throwAim = false; }
  updatePings(dt);
  updateLoot(dt);
  updateChests(dt);
  updateProjectiles(dt);
  updateBullets(dt);
  updateStorm(dt);
  events.update(dt);
  updateParticles(dt);
  updateDebris(dt);
  updateRipples(dt);
  updateDoors(dt);
  G.warm = stoves.update(dt, camera, G.chars);
  updateEffects(dt);
  for (const cl of clouds) { cl.position.x += dt * 2; if (cl.position.x > 450) cl.position.x = -450; }
  faceClouds(clouds, camera);
  sky.material.uniforms.uTime.value += dt;
  updateCamera(dt);
  weather.update(dt, G.time, camera, renderer, true);
  updateHUD(dt);
  updateSpectateHud();
}

const _menuStream = new THREE.Vector3(0, 0, 0);
// ─────────────── v37: risoluzione dinamica ───────────────
//  misura il tempo medio dei frame in partita: se il gioco scende sotto ~48 FPS abbassa la risoluzione
//  a piccoli passi (fino al 55%), quando torna fluido la rialza piano. Ricorda il livello che faceva
//  rallentare, così non oscilla avanti e indietro.
let shadowTick = 0;
// v44: scende solo sotto i 40 FPS e mai sotto il 75% (prima: sotto i 48 FPS, fino al 50%: immagine troppo sgranata)
const DYN_MIN = 0.75;
const dynState = { k: 1, t0: 0, n: 0, sum: 0, prev: 0, ceil: 1, ceilT: 0, coolT: 0 };
function dynResTick(now) {
  const D = dynState;
  const live = (G.state === 'play' || G.state === 'bus') && !G.paused && !document.hidden;
  if (!settings.gfx.dynRes || !live) {
    if (!settings.gfx.dynRes && D.k !== 1) { D.k = 1; gfx.setDyn(1); }
    D.prev = 0; D.n = 0; D.sum = 0; return;
  }
  if (D.prev) { const ft = now - D.prev; if (ft < 250) { D.sum += ft; D.n++; } }
  D.prev = now;
  if (!D.t0) D.t0 = now;
  if (now - D.t0 < 1500 || D.n < 20) return;
  const avg = D.sum / D.n; D.t0 = now; D.n = 0; D.sum = 0;
  const cap = settings.gfx.fpsCap;
  const target = 1000 / Math.min(cap > 0 ? cap : 60, 60);
  const slow = Math.max(target * 1.25, 1000 / 40), fast = Math.max(target * 1.08, 1000 / 52);
  if (now < D.coolT) return;
  if (now > D.ceilT) D.ceil = 1;   // dopo un minuto riprova anche i livelli più alti
  if (avg > slow && D.k > DYN_MIN) {
    D.ceil = Math.min(D.ceil, D.k - 0.05); D.ceilT = now + 60000;
    D.k = Math.max(DYN_MIN, D.k - (avg > slow * 1.5 ? 0.1 : 0.05));
    gfx.setDyn(D.k); D.coolT = now + 1500;
  } else if (avg < fast && D.k < Math.min(1, D.ceil)) {
    D.k = Math.min(1, D.ceil, D.k + 0.05);
    gfx.setDyn(D.k); D.coolT = now + 4000;
  }
}
let last = performance.now();
const fpsEl = $('#fps');
let fpsN = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // limite FPS (1 ms di tolleranza: rAF non è preciso)
  const cap = settings.gfx.fpsCap;
  if (cap > 0 && now - last < 1000 / cap - 1) return;
  const lastCalls = renderer.info.render.calls;
  renderer.info.reset();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (settings.gfx.fpsShow) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} FPS · ${lastCalls} draw` + (dynState.k < 0.99 ? ` · ris. ${Math.round(dynState.k * 100)}%` : ''); fpsN = 0; fpsT = 0; }
  }
  world.update(G.state === 'menu' ? _menuStream : camera.position, G.state === 'menu' ? 8 : 5);
  if (G.player && G.player.alive && G.state === 'play') GRASS_PLAYER.value.copy(G.player.pos); else GRASS_PLAYER.value.set(0, -9999, 0);
  touch.update();
  document.body.classList.toggle('playing', G.state === 'play' || G.state === 'bus');
  // telefono girato in verticale durante la partita: metti in pausa finché non torna orizzontale
  if (touch.T.on && (G.state === 'play' || G.state === 'bus') && !G.paused && !G.net && innerHeight > innerWidth * 1.1) togglePause(true);
  if (G.state === 'menu') { renderer.shadowMap.autoUpdate = true; renderLobby(dt); pressed.clear(); return; }
  if (!G.paused) update(dt);
  // v37: le ombre del sole si ridisegnano a frame alterni (metà dei draw call per la mappa delle ombre);
  //  la matrice delle ombre si aggiorna solo quando la mappa viene ridisegnata, quindi restano ferme e precise
  shadowTick++;
  const se = settings.gfx.shadows === 'ultra' ? 1 : (dynState.k < 0.8 ? 3 : 2);
  renderer.shadowMap.autoUpdate = se <= 1 || shadowTick % se === 0;
  gfx.render(scene, camera);
  dynResTick(now);
  autoQualityTick(now);   // v43
  pressed.clear();
  mouse.leftPressed = false;
}

addEventListener('resize', () => {
  gfx.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  lobby.cam.aspect = innerWidth / innerHeight; lobby.cam.updateProjectionMatrix();
});

applySettings();
buildMenu();
LD(1, 'Pronti!');
setTimeout(() => $('#loading').classList.add('hidden'), 300);
// icone delle armi: preparate poco per volta, quando il menu è già visibile
{
  const q = [];
  for (const id of Object.keys(CONSUMABLES)) q.push([id, -1]);
  for (const id of Object.keys(WEAPONS)) for (let r = 0; r < RARITIES.length; r++) q.push([id, r]);
  // v43: in partita si ferma (ogni icona costa qualche millisecondo: niente scatti durante gli scontri)
  const tick = () => { if (!q.length) return; if (G.state !== 'menu') { setTimeout(tick, 1000); return; } const [id, r] = q.shift(); if (r < 0) consIcon(id); else weaponIcon(id, r); setTimeout(tick, 40); };
  setTimeout(tick, 1200);
}
requestAnimationFrame(frame);

// accesso da console per il debug
window.__game = { WATER_LEVEL, touch, events, weather, TOWNS, biomeAt, gfx, settings, applySettings, settingsUI, QUALITY, NET, PR, prepareWorld, beginMatch, tallGrassAt, scene, camera, mouse, spawnBullet, updateBullets, WEAPONS, MODEL_SOURCE, explode, damageBarrel, G, startMatch, update, terrainHeight, groundAt, world, jumpFromBus, keys, pressed, updatePlayer, canStartClimb, damage, startEmote, camera, renderer, toggleStove, toggleDoor, spawnLoot, kill, structHit, structBlast, structEffects, toggleBigMap, BM, toggleInventory, lobby, lobbyZoomTo, specCycle, skinLoadStatus, bossFight, clawAttack, rayAll, throwSys, throwItem, impulseBlast, addPing, playerPing, hurtFrom, makeWall, placeWall, buildSpot, setPiece, toggleBuild, botTactics, findCover, finishMatch, surfaceUnder, currentZoom, tryVault, startSlide, updateSlide, canSlide, currentSpread, jumpPenalty, placeItem, placeSpot, updatePlaced, hitMaterial, impactFx, critFlash, rayColliders, ARENA_INFO: () => world.arena, ceilingAt, addColliderT: addCollider, removeColliderT: removeCollider, AUTO, PERF, effGfx, dynState, autoQualityTick, dynResTick, QUALITY_REF: QUALITY, get stoves() { return stoves; } };
preloadIcons();
setTimeout(() => preloadSkins([settings.skin]), 300);
