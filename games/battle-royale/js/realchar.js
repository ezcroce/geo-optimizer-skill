// ─────────────────────────────────────────────────────────────
//  Personaggi realistici (v25)
//  Modelli umani scolpiti e texturizzati (scheletro standard Mixamo, file .glb in models/chars/).
//  Lo scheletro procedurale di character.js resta invisibile e continua a fare tutte le animazioni
//  (corsa, mira, arrampicata, nuoto, deltaplano, emote…): ogni fotogramma la posa viene trasferita
//  alle ossa del modello vero (retargeting). Con l'arma in mano le braccia usano la cinematica inversa
//  così le mani restano esattamente sull'impugnatura.
//  v26: ogni skin ha il SUO personaggio (models/chars/<id>.glb, persone realistiche create con
//  VRM Avatar Maker dagli asset CC0 di MakeHuman): corpo, viso, capelli e vestiti diversi.
//  Si caricano solo quando servono; nel frattempo si vede il modello base, poi il cambio è automatico.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { dressUp, HAS_COSTUME } from './costume.js?v=46';

export const REAL = { ready: false, bases: {}, promise: null, prefix: 'models/chars/' };
const FILES = { soldier: 'soldato.glb', woman: 'donna.glb' };
// skin con il corpo femminile (le altre usano il soldato con l'armatura ricolorata)
const WOMAN = new Set(['esploratrice', 'tamsin', 'scienziata', 'giardiniera', 'sommozzatrice']);
export const realKind = (skin) => (WOMAN.has(skin.id) ? 'woman' : 'soldier');

// ── v26: un personaggio diverso per ogni skin ──
export const SKIN_MODELS = new Set(['recluta', 'esploratrice', 'zombie', 'agente', 'ninja', 'tattico', 'pirata', 'meccanico',
  'cyber', 'astro', 'banana', 'cavaliere', 'drago', 'leo', 'tamsin', 'oren', 'cowboy', 'scienziata', 'vichingo', 'samurai',
  'robot', 'spettro', 'giardiniera', 'rapper',
  'gladiatore', 'imperatore', 'arlecchino', 'cuoco', 'sommozzatrice', 'mummia']);
// v40: le skin nuove usano le stesse persone MakeHuman di altre skin (stesso file .glb, scaricato una volta sola
// dal browser) con un costume e colori tutti loro
const MODEL_FILE = { gladiatore: 'recluta', imperatore: 'agente', arlecchino: 'agente', cuoco: 'meccanico', sommozzatrice: 'esploratrice', mummia: 'zombie' };
// questi personaggi hanno già un copricapo (casco, cappello, cappuccio, corna): niente cappello cosmetico sopra
const OWN_HAT = new Set(['ninja', 'tattico', 'pirata', 'cavaliere', 'drago', 'cowboy', 'spettro', 'samurai', 'astro', 'vichingo', 'robot', 'banana',
  'gladiatore', 'imperatore', 'arlecchino', 'cuoco', 'sommozzatrice']);
// tinte dei vestiti (parte del nome della mesh → colore): la trama del tessuto resta, cambia solo il colore
const TINTS = {
  recluta: { 't-shirt': '#76845a', cargo: '#3e4630' },
  esploratrice: { tank: '#c8743c' },
  zombie: { 't-shirt': '#6e7c8a', wool: '#3a3f4a' },
  tattico: { sweater: '#59613f', cargo: '#4a4f3a' },
  banana: { 't-shirt': '#ffd83a' },
  cavaliere: { uniform: '#e0b440', boots: '#6b5212' },
  astro: { boots: '#d8d8e0' },
  leo: { polo: '#6f7d48' },
  tamsin: { robe: '#ad2738' },
  oren: { hero_suit: '#585866', boots: '#4c4c55' },
  cowboy: { polo: '#b0643a', wool: '#3b4a6b' },
  samurai: { kimono: '#9a1a24' },
  giardiniera: { casualsuit: '#5f8c40' },
  rapper: { 't-shirt': '#262626', cargo: '#3a5a9a' },
  gladiatore: { 't-shirt': '#8a2a1e', cargo: '#6e2418', boots: '#5a3a1e' },
  imperatore: { suit: '#e9e2d2', shoes: '#6a4a2a' },
  cuoco: { worksuit: '#2e2e34', boots: '#1e1e1e' },
};
const skinModel = (skin) => (SKIN_MODELS.has(skin.id) ? skin.id : null);
const LOADING = new Map();   // id → promise
let loader = null, busy = 0;
const QUEUE = [];
/** carica (una volta sola) il personaggio di una skin; al massimo due download alla volta */
export function loadSkinModel(id) {
  if (!SKIN_MODELS.has(id)) return Promise.resolve(null);
  if (LOADING.has(id)) return LOADING.get(id);
  loader = loader || new GLTFLoader();
  const p = new Promise(res => QUEUE.push([id, res]));
  LOADING.set(id, p);
  pump();
  return p;
}
/** v34: mette in testa alla coda le skin indicate (es. quelle della partita appena iniziata) */
export function prioritizeSkins(ids) {
  for (const id of [...ids].reverse()) {
    if (!SKIN_MODELS.has(id)) continue;
    if (!LOADING.has(id)) { loadSkinModel(id); }
    const i = QUEUE.findIndex(q => q[0] === id);
    if (i > 0) QUEUE.unshift(QUEUE.splice(i, 1)[0]);
  }
}
export const ALL_SKIN_MODELS = () => [...SKIN_MODELS];
/** v34: quanti personaggi delle skin sono già pronti (o falliti) */
export function skinLoadStatus() { let done = 0; for (const id of SKIN_MODELS) if (REAL.bases[id] !== undefined) done++; return { done, total: SKIN_MODELS.size }; }
/** v34: copia "finta" del personaggio di una skin (stessi materiali delle istanze vere), solo per pre-compilare shader e texture */
export function realWarmObject(skin) {
  const id = skinModel(skin), base = id && REAL.bases[id];
  if (!base) return null;
  const inst = cloneSkinned(base.scene);
  inst.traverse(o => {
    if (o.isMesh) {
      o.material = base.own ? ownMat(base, base.mats[o.name] || o.material, skin, o.name) : recolorMat(base, base.mats[o.name] || o.material, skin, o.name);
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    }
  });
  const rg = new THREE.Group(); rg.scale.setScalar(base.s); rg.position.y = base.oy; rg.add(inst);
  return rg;
}
function pump() {
  while (busy < 2 && QUEUE.length) {
    const [id, res] = QUEUE.shift();
    busy++;
    loader.loadAsync(REAL.prefix + (MODEL_FILE[id] || id) + '.glb')
      .then(g => (REAL.bases[id] = prepare(id, g)))
      .catch(e => { console.warn('Personaggio non caricato:', id, e); REAL.bases[id] = null; return null; })
      .then(r => { busy--; res(r); pump(); });
  }
}

const MAIN = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
// ossa in stile Unreal/MakeHuman (pelvis, spine_01, upperarm_l…) → nomi Mixamo usati qui sotto
const UE = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', head: 'Head',
  clavicle: 'Shoulder', upperarm: 'Arm', lowerarm: 'ForeArm', hand: 'Hand', thigh: 'UpLeg', calf: 'Leg', foot: 'Foot', ball: 'ToeBase',
  thumb: 'HandThumb', index: 'HandIndex', middle: 'HandMiddle', ring: 'HandRing', pinky: 'HandPinky' };
const norm = (n) => {
  n = n.replace(/^mixamorig:?/, '');
  if (UE[n]) return UE[n];
  const m = /^([a-z]+)(?:_0(\d))?_([lr])$/.exec(n);
  if (m && UE[m[1]]) return (m[3] === 'l' ? 'Left' : 'Right') + UE[m[1]] + (m[2] || '');
  return n;
};
const HEAD_Y = 1.6;            // altezza dell'articolazione della testa nello scheletro procedurale (RIG.hip + RIG.headY)
const ARM_SPLAY = 0.1;         // a riposo le braccia sono leggermente staccate dai fianchi
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** modelli base (sempre) + i personaggi delle skin indicate (es. quella del giocatore), prima di iniziare */
export function loadRealChars(prefix = 'models/chars/', skins = []) {
  if (REAL.promise) return REAL.promise;
  REAL.prefix = prefix;
  loader = loader || new GLTFLoader();
  REAL.promise = Promise.all([...Object.entries(FILES).map(async ([k, f]) => {
    try { REAL.bases[k] = prepare(k, await loader.loadAsync(prefix + f)); }
    catch (e) { console.warn('Modello realistico non caricato:', f, e); }
  }), ...skins.map(loadSkinModel)]).then(() => { REAL.ready = !!(REAL.bases.soldier || REAL.bases.woman); return REAL.ready; });
  return REAL.promise;
}

/** prepara un modello: scala all'altezza dello scheletro procedurale, braccia lungo i fianchi, mani rilassate */
function prepare(kind, gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const bones = {};
  scene.traverse(o => { if (o.isBone) bones[norm(o.name)] = o; });
  // il modello deve guardare verso +Z come lo scheletro procedurale (le dita dei piedi indicano il davanti)
  const toe = bones.LeftToeBase || bones.LeftToe_End, foot = bones.LeftFoot;
  if (toe && foot && toe.getWorldPosition(new THREE.Vector3()).z < foot.getWorldPosition(new THREE.Vector3()).z) {
    scene.rotation.y += Math.PI;
    scene.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(scene, true);
  const headW = bones.Head.getWorldPosition(new THREE.Vector3());
  const s = HEAD_Y / (headW.y - box.min.y);
  const rg = new THREE.Group();
  rg.scale.setScalar(s);
  rg.position.y = -box.min.y * s;
  rg.add(scene);
  rg.updateMatrixWorld(true);
  const wp = (b, v = new THREE.Vector3()) => b.getWorldPosition(v);
  const align = (name, child, dir) => {
    const b = bones[name], c = bones[child];
    if (!b || !c) return;
    rg.updateMatrixWorld(true);
    const cur = wp(c).sub(wp(b)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    const wq = b.getWorldQuaternion(new THREE.Quaternion());
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  };
  // braccia dalla posa a T verso il basso (come lo scheletro procedurale a riposo), gambe dritte
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const down = new THREE.Vector3(sx * Math.sin(ARM_SPLAY), -Math.cos(ARM_SPLAY), 0);
    align(side + 'Arm', side + 'ForeArm', down);
    align(side + 'ForeArm', side + 'Hand', new THREE.Vector3(sx * Math.sin(ARM_SPLAY * 0.6), -1, 0.04));
    align(side + 'UpLeg', side + 'Leg', new THREE.Vector3(sx * 0.02, -1, 0));
    align(side + 'Leg', side + 'Foot', new THREE.Vector3(0, -1, -0.02));
  }
  rg.updateMatrixWorld(true);
  // v28: il costume che rende riconoscibile la skin (ali e coda del drago, cappuccio del ninja, armature…)
  if (HAS_COSTUME.has(kind)) {
    const meshes = {};
    scene.traverse(o => { if (o.isMesh && !meshes[o.name]) meshes[o.name] = o; });
    if (dressUp(kind, { meshes, bones, norm })) rg.updateMatrixWorld(true);
  }
  // tabella delle ossa principali: genitore, rotazione a riposo nello spazio del corpo
  const list = MAIN.filter(n => bones[n]);
  const idx = Object.fromEntries(list.map((n, i) => [n, i]));
  const parent = list.map(n => { let p = bones[n].parent; while (p && p.isBone && idx[norm(p.name)] === undefined) p = p.parent; return p && p.isBone ? idx[norm(p.name)] : -1; });
  const restWQ = list.map(n => bones[n].getWorldQuaternion(new THREE.Quaternion()));
  const hips = bones.Hips;
  const baseQ = hips.parent.getWorldQuaternion(new THREE.Quaternion());
  const baseInv = hips.parent.matrixWorld.clone().invert();
  const baseM = hips.parent.matrixWorld.clone();
  const hipsRest = wp(hips);
  const unit = new THREE.Vector3().setFromMatrixScale(hips.matrixWorld).x;   // scala mondo delle ossa
  // posizioni utili per gli agganci
  const headPos = wp(bones.Head), spinePos = wp(bones.Spine);
  // materiali originali (per i ricolori)
  const mats = {};
  scene.traverse(o => { if (o.isMesh) mats[o.name] = o.material; });
  // personaggi per skin: asse di piegatura di ogni falange (gli assi locali delle ossa non sono quelli di Mixamo)
  const own = kind !== 'soldier' && kind !== 'woman';
  let fingerAxis = null;
  if (own) {
    fingerAxis = {};
    for (const side of ['Left', 'Right']) {
      const palm = new THREE.Vector3(side === 'Left' ? -1 : 1, 0, 0);   // braccia giù: il palmo guarda il fianco
      for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) {
        const b = bones[side + 'Hand' + f + k]; if (!b) continue;
        const nb = bones[side + 'Hand' + f + (k + 1)];
        const dir = nb ? wp(nb).sub(wp(b)) : wp(b).sub(wp(b.parent));
        const ax = dir.normalize().cross(f === 'Thumb' ? new THREE.Vector3(0, 0, -1) : palm).normalize();
        fingerAxis[side + f + k] = ax.applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert());
      }
    }
  }
  if (own) scene.traverse(o => {
    // luminanza media (per le tinte) letta adesso; dopo il caricamento sulla GPU l'immagine viene liberata
    const t = o.isMesh && o.material.map;
    if (!t || t.userData.lum !== undefined) return;
    t.userData.lum = avgLum(t);
    t.onUpdate = () => { if (t.image && t.image.close) { t.image.close(); } };
  });
  // cima della testa (per appoggiare i cappelli): dal corpo nudo, senza capelli
  let headTop = HEAD_Y + 0.2;
  scene.traverse(o => { if (o.isSkinnedMesh && o.name === 'body') { const bb = new THREE.Box3().setFromObject(o, true); headTop = bb.max.y; } });
  const headFit = measureHead(scene, bones, rg), torsoFit = measureTorso(scene, bones, rg);
  scene.removeFromParent();
  return { kind, own, scene, s, oy: rg.position.y, list, idx, parent, restWQ, baseQ, baseInv, baseM, hipsRest, unit, headPos, spinePos, mats, matCache: new Map(), fingerAxis, headTop, headFit, torsoFit };
}

/** v30: forma vera della testa (capelli compresi) nello spazio del corpo, per far calzare i cappelli:
 *  vertici guidati soprattutto dall'osso della testa (o dai suoi figli), sopra l'attaccatura del collo */
function measureHead(scene, bones, rg) {
  if (!bones.Head) return null;
  rg.updateMatrixWorld(true);
  const headSet = new Set(); bones.Head.traverse(b => { if (b.isBone) headSet.add(b); });
  const jy = bones.Head.getWorldPosition(new THREE.Vector3()).y;
  const P = [], v = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, bs = o.skeleton.bones;
    if (!si || !sw) return;
    const n = o.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 20000));
    for (let i = 0; i < n; i += step) {
      let best = -1, bw = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (best < 0 || !headSet.has(bs[best])) continue;
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);
      if (v.y > jy - 0.02) P.push(v.x, v.y, v.z);
    }
  });
  if (P.length < 60) return null;
  const pick = (arr, q) => { arr.sort((a, b) => a - b); return arr[Math.min(arr.length - 1, Math.floor(arr.length * q))]; };
  const ys = [];
  for (let i = 1; i < P.length; i += 3) ys.push(P[i]);
  const top = pick(ys.slice(), 0.9995);
  // larghezza e profondità nella fascia della fronte (dove poggia il cappello), senza le orecchie
  const band = (y) => y > top - 0.13 && y < top - 0.035;
  const xs = [], zs = [];
  for (let i = 0; i < P.length; i += 3) if (band(P[i + 1])) { xs.push(P[i]); zs.push(P[i + 2]); }
  if (xs.length < 20) return null;
  const x0 = pick(xs.slice(), 0.004), x1 = pick(xs.slice(), 0.996), z0 = pick(zs.slice(), 0.004), z1 = pick(zs.slice(), 0.996);
  let rx = (x1 - x0) / 2; const rz = (z1 - z0) / 2;
  if (rx > rz * 1.25) rx = rz * 0.9;   // capelli voluminosi ai lati: conta la forma del cranio
  // v32: quanto sporge davanti alla bocca (casco, visiera, barba, muso): per bere si appoggia lì
  const cx = (x0 + x1) / 2, my = top - 0.175, fz = [];
  for (let i = 0; i < P.length; i += 3) if (P[i + 1] > my - 0.06 && P[i + 1] < my + 0.03 && Math.abs(P[i] - cx) < 0.06) fz.push(P[i + 2]);
  const front = fz.length > 8 ? pick(fz, 0.995) : -Infinity;
  return { top, cx, cz: (z0 + z1) / 2, rx, rz, front };
}

/** v30: sezione vera del busto all'altezza del petto (schiena, petto, mezza larghezza), per appoggiare gli zaini */
function measureTorso(scene, bones, rg) {
  const spine = new Set(['Spine', 'Spine1', 'Spine2'].map(n => bones[n]).filter(Boolean));
  if (!spine.size) return null;
  rg.updateMatrixWorld(true);
  const Y = 1.26, xs = [], back = [], front = [], v = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, bs = o.skeleton.bones;
    if (!si || !sw) return;
    const n = o.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 25000));
    for (let i = 0; i < n; i += step) {
      let best = -1, bw = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (best < 0 || !spine.has(bs[best])) continue;
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.y - Y) > 0.07) continue;
      xs.push(Math.abs(v.x));
      if (Math.abs(v.x) < 0.08) (v.z < 0 ? back : front).push(v.z);
    }
  });
  if (xs.length < 40 || back.length < 8 || front.length < 8) return null;
  const pick = (arr, q) => { arr.sort((a, b) => a - b); return arr[Math.min(arr.length - 1, Math.floor(arr.length * q))]; };
  return { y: Y, halfW: pick(xs, 0.97), back: Math.max(-0.32, pick(back, 0.03)), front: Math.min(0.32, pick(front, 0.97)) };
}

// ── ricolori: la texture originale resta (pieghe, sporco, cuciture) ma le zone cambiano colore con la skin ──
const lin = (hex) => new THREE.Color(hex);   // THREE.Color converte già da sRGB a lineare
function recolorMat(base, src, skin, part) {
  const key = part + '|' + skin.id;
  if (base.matCache.has(key)) return base.matCache.get(key);
  const m = src.clone();
  const U = {
    uA: { value: lin(skin.shirt || '#d8c8a8') }, uB: { value: lin(skin.pants || '#4a5a3a') },
    uC: { value: lin(skin.accColor || skin.cape || skin.shirt || '#c03030') }, uD: { value: lin(skin.glow || skin.accColor || '#7fd0ff') },
  };
  const isSoldier = base.kind === 'soldier';
  const visor = part.includes('visor');
  if (skin.metal) { m.metalness = 0.55; m.roughness = 0.38; }
  if (isSoldier && (skin.glow || visor)) {
    m.emissive = lin(skin.glow || '#9fd8ff'); m.emissiveIntensity = visor ? (skin.glow ? 1.4 : 0.25) : 0;
    if (!visor) { m.emissiveMap = null; }
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uA, uB, uC, uD;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = (mx - mn) / max(mx, 1e-3);
        ${isSoldier && !visor ? `
        // armatura (piastre color sabbia) → colore della maglia; tessuto verde oliva → pantaloni; strisce rosse → accento
        float plate = step(c.b, c.g) * step(c.g, c.r) * smoothstep(0.06, 0.14, c.r) * smoothstep(0.38, 0.5, sat) * (1.0 - smoothstep(0.86, 0.95, sat));
        float red = smoothstep(0.82, 0.95, sat) * step(c.g * 3.0, c.r) * smoothstep(0.08, 0.16, c.r);
        float cloth = step(c.r, c.g * 1.08) * step(c.b, c.g) * smoothstep(0.25, 0.4, sat) * (1.0 - smoothstep(0.1, 0.16, l));
        c = mix(c, uA * min(l / 0.5, 1.6), plate);
        c = mix(c, uB * min(l / 0.085, 2.0), cloth);
        c = mix(c, uC * min(l / 0.1, 2.0), red);` : ''}
        ${!isSoldier ? `
        // giallo dei pantaloni → pantaloni della skin; azzurro dei dettagli → accento
        float yel = step(c.b * 4.0, c.g) * step(c.g, c.r * 1.05) * smoothstep(0.25, 0.4, c.r) * step(0.45 * c.r, c.g);
        float teal = step(c.r * 1.6, c.g) * step(c.r * 1.6, c.b) * smoothstep(0.04, 0.1, c.b);
        c = mix(c, uB * min(l / 0.62, 1.5), yel);
        c = mix(c, uC * min(l / 0.2, 1.6), teal);` : ''}
        diffuseColor.rgb = c;
      }`);
  };
  m.customProgramCacheKey = () => 'real-' + base.kind + (visor ? 'v' : '');
  base.matCache.set(key, m);
  return m;
}

// ── v26: tinta dei vestiti dei personaggi per skin (luminanza della texture × colore) ──
function avgLum(tex) {
  const img = tex && tex.image; if (!img || !img.width) return 0.5;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const lv = (x) => Math.pow(x / 255, 2.2);
      sum += 0.2126 * lv(d[i]) + 0.7152 * lv(d[i + 1]) + 0.0722 * lv(d[i + 2]); n++;
    }
    return n ? Math.max(0.02, sum / n) : 0.5;
  } catch (e) { return 0.5; }
}
function tintMat(base, src, hex, name) {
  const key = name + '|' + hex;
  if (base.matCache.has(key)) return base.matCache.get(key);
  const m = src.clone();
  const U = { uT: { value: lin(hex) }, uL: { value: src.map ? src.map.userData.lum ?? 0.5 : 0.5 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uT; uniform float uL;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      { float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = uT * clamp(l / uL, 0.0, 1.8); }`);
  };
  m.customProgramCacheKey = () => 'real-tint';
  base.matCache.set(key, m);
  return m;
}
function ownMat(base, src, skin, name) {
  if (src.name && src.name.startsWith('cos-')) return src;   // materiali dei costumi: già definitivi
  const t = TINTS[skin.id];
  if (t) for (const k in t) if (name.includes(k)) return tintMat(base, src, t[k], name);
  return src;
}

// ── personaggi attivi (riferimenti deboli: quelli eliminati vengono raccolti dal garbage collector) ──
const ACTIVE = [];

/**
 * Sostituisce l'aspetto del personaggio procedurale m con il modello realistico.
 * keep: oggetti dello scheletro procedurale che restano visibili (cappelli, zaini, mantello).
 */
export function attachReal(m, skin, keep = {}) {
  if (!REAL.ready) return false;
  const id = skinModel(skin);
  let base = id && REAL.bases[id];
  let want = null;
  if (!base) {
    base = REAL.bases[realKind(skin)] || REAL.bases.soldier || REAL.bases.woman;
    // il personaggio della skin arriva dopo (si scarica quando il personaggio si vede da vicino):
    // intanto il modello base, poi il cambio automatico
    if (id && REAL.bases[id] !== null) want = id;
  }
  if (!base) return false;
  const first = !m.real;
  if (m.real) { m.real.rg.removeFromParent(); m.real = null; }
  // il cappello cosmetico: solo dove non c'è già un copricapo (elmetto del soldato o copricapo del personaggio)
  // (sui personaggi per skin solo il cappello scelto dal giocatore: il loro look ha già il suo stile)
  const hats = base.own ? (OWN_HAT.has(skin.id) || !keep.chosenHat ? [] : keep.hats || []) : (base.kind === 'woman' ? keep.hats || [] : []);
  keep = { ...keep, hat: hats, cape: base.own ? null : keep.cape };   // i personaggi per skin hanno già i loro vestiti: niente mantello piatto
  const inst = cloneSkinned(base.scene);
  const rg = new THREE.Group();
  rg.name = 'real';
  rg.scale.setScalar(base.s); rg.position.y = base.oy;
  rg.add(inst);
  const bones = {};
  inst.traverse(o => {
    if (o.isBone) bones[norm(o.name)] = o;
    if (o.isMesh) {
      o.material = base.own ? ownMat(base, base.mats[o.name] || o.material, skin, o.name)
        : recolorMat(base, base.mats[o.name] || o.material, skin, o.name);
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    }
  });
  const B = base.list.map(n => bones[n]);
  // nasconde le mesh procedurali (restano gruppi/articolazioni per le animazioni)
  const keepSet = new Set([m.gunPivot, m.lod, ...(keep.hat || []), ...(keep.back || []), keep.cape].filter(Boolean));
  const hide = (o) => { if (keepSet.has(o)) { o.visible = true; return; } if (o.isMesh) o.visible = false; for (const c of o.children) hide(c); };
  hide(m.body);
  // agganci: cappelli sulla testa vera, zaino e mantello sulla schiena vera
  rg.updateMatrixWorld(true);
  const anchor = (bone, pos) => {
    const a = new THREE.Object3D();
    _m.compose(pos, _q.identity(), _v.set(1, 1, 1));
    bone.add(a);
    a.matrix.copy(bone.matrixWorld.clone().invert().multiply(_m));
    a.matrix.decompose(a.position, a.quaternion, a.scale);
    return a;
  };
  if (keep.hat && keep.hat.length && bones.Head) {
    // v30: il cappello calza sulla testa vera: scalato sulla sua larghezza (capelli compresi) e appoggiato sulla cima
    // (i cappelli sono disegnati per la testa procedurale: ellissoide 0.2 × 0.225 × 0.205 con la cima a 0.45)
    const f = base.own && base.headFit;
    let a;
    if (f) {
      // un filo più largo e più alto della testa: la calotta copre anche i capelli
      const k = THREE.MathUtils.clamp((f.rx / 0.2 + f.rz / 0.205) / 2 * 1.12, 0.36, 0.95), ky = k * 1.15;
      a = anchor(bones.Head, new THREE.Vector3(f.cx, f.top - 0.452 * ky - 0.004, f.cz - 0.004));   // v31: calza un filo più in basso
      a.scale.multiply(_v.set(k, ky, k));
    } else {
      const hy = base.own ? base.headTop - 0.4 : HEAD_Y + (base.kind === 'woman' ? -0.12 : 0.04);
      a = anchor(bones.Head, new THREE.Vector3(0, hy, base.own ? -0.01 : base.kind === 'woman' ? 0.0 : 0.01));
    }
    for (const o of keep.hat) a.add(o);
  }
  const back = [...(keep.back || []), ...(keep.cape ? [keep.cape] : [])];
  if (back.length && bones.Spine) {
    // v30: zaini appoggiati sulla schiena vera: il busto procedurale (a 0.36 sopra il bacino: schiena -0.146,
    // petto +0.146, mezza larghezza 0.228) viene portato sulla sezione misurata del modello
    const f = base.own && base.torsoFit;
    let a;
    if (f) {
      const sx = THREE.MathUtils.clamp(f.halfW / 0.228, 0.68, 1.15), sz = THREE.MathUtils.clamp((f.front - f.back) / 0.292, 0.6, 1.35);
      a = anchor(bones.Spine, new THREE.Vector3(0, f.y - 0.36 * sx, (f.front + f.back) / 2));
      a.scale.multiply(_v.set(sx, sx, sz));
    } else a = anchor(bones.Spine, new THREE.Vector3(0, 0.9, base.kind === 'soldier' ? -0.035 : -0.01));
    for (const o of back) a.add(o);
  }
  m.body.add(rg);
  m.lids = null;
  // dita: rilassate, oppure strette sull'impugnatura
  const fingers = [];
  for (const side of ['Left', 'Right']) for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) {
    const b = bones[side + 'Hand' + f + k];
    if (b) fingers.push({ b, q0: b.quaternion.clone(), thumb: f === 'Thumb', trigger: side === 'Right' && f === 'Index', k, hand: side === 'Right' ? 0 : 1,
      ax: (base.fingerAxis && base.fingerAxis[side + f + k]) || new THREE.Vector3(1, 0, 0) });
  }
  m.real = { rg, B, base, Q: B.map(() => new THREE.Quaternion()), P: B.map(() => new THREE.Vector3()), fingers, grip: -1, want, skin, keep };
  m._syncF = -1; m._ppT = 0;   // v43: nuovo modello: va sincronizzato e ricontato
  // v32: bocca e collo nello spazio del busto (per bere dalle pozioni)
  if (base.headFit && base.headPos) {
    const f = base.headFit, hr = base.hipsRest;
    m.neckRest = new THREE.Vector3(base.headPos.x - hr.x, base.headPos.y - hr.y, base.headPos.z - hr.z);
    m.mouthRest = new THREE.Vector3(f.cx - hr.x, f.top - 0.175 - hr.y, Math.max(f.cz + f.rz * 0.95, f.front + 0.02) - hr.z);
  }
  setGrip(m.real, 0);
  if (first) ACTIVE.push(new WeakRef(m));
  return true;
}

/** v32: presa per mano (g0 destra, g1 sinistra; 0 rilassata → 1 stretta). full: anche l'indice destro chiuso (piccone, oggetti) */
function setGrip(R, g0, g1 = g0, full = false) {
  const key = g0 * 1000 + g1 + (full ? 0.5 : 0);
  if (Math.abs(R.grip - key) < 0.02) return;
  R.grip = key;
  for (const f of R.fingers) {
    const g = f.hand ? g1 : g0;
    const a = f.thumb ? 0.15 + g * 0.35 : (0.28 + 0.12 * f.k) + g * (f.trigger && !full ? 0.35 : 0.95);
    f.b.quaternion.copy(f.q0).multiply(_q.setFromAxisAngle(f.ax, a));
  }
}

const _pq = {}; ['torso', 'head', 'a0', 'a1', 'e0', 'e1', 'h0', 'h1', 'l0', 'l1', 'k0', 'k1', 'f0', 'f1'].forEach(k => (_pq[k] = new THREE.Quaternion()));
const _pp = { s: [new THREE.Vector3(), new THREE.Vector3()], e: [new THREE.Vector3(), new THREE.Vector3()], h: [new THREE.Vector3(), new THREE.Vector3()] };

/** trasferisce la posa dello scheletro procedurale al modello vero */
export function syncReal(m) {
  const R = m.real; if (!R) return;
  const base = R.base, I = base.idx, B = R.B, Q = R.Q, P = R.P;
  // rotazioni procedurali nello spazio del corpo (a riposo sono tutte nulle)
  const T = m.torso.quaternion;
  _pq.torso.copy(T);
  _pq.head.copy(T).multiply(m.head.quaternion);
  for (let i = 0; i < 2; i++) {
    _pq['a' + i].copy(T).multiply(m.arms[i].quaternion);
    _pq['e' + i].copy(_pq['a' + i]).multiply(m.elbows[i].quaternion);
    _pq['h' + i].copy(_pq['e' + i]).multiply(m.hands[i].quaternion);
    _pq['l' + i].copy(m.legs[i].quaternion);
    _pq['k' + i].copy(_pq['l' + i]).multiply(m.knees[i].quaternion);
    _pq['f' + i].copy(_pq['k' + i]).multiply(m.feet[i].quaternion);
  }
  // indice 0 dello scheletro procedurale = lato destro (x negativa)
  const tgt = R.tgt || (R.tgt = (() => {
    const t = new Array(B.length).fill(null);
    const set = (n, k) => { if (I[n] !== undefined) t[I[n]] = k; };
    set('Spine', 'torso'); set('Head', 'head');
    set('RightArm', 'a0'); set('RightForeArm', 'e0'); set('RightHand', 'h0');
    set('LeftArm', 'a1'); set('LeftForeArm', 'e1'); set('LeftHand', 'h1');
    set('RightUpLeg', 'l0'); set('RightLeg', 'k0'); set('RightFoot', 'f0');
    set('LeftUpLeg', 'l1'); set('LeftLeg', 'k1'); set('LeftFoot', 'f1');
    return t;
  })());
  const u = base.unit;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], p = base.parent[i];
    const pq = p >= 0 ? Q[p] : base.baseQ;
    if (i === I.Hips) {
      // il bacino segue l'altezza/spostamento del busto procedurale (accovacciarsi, dondolio)
      _v.copy(m.torso.position).sub(_v2.set(0, 0.9, 0)).add(base.hipsRest);
      b.position.copy(_v).applyMatrix4(base.baseInv);
      P[i].copy(_v);
    } else P[i].copy(b.position).multiplyScalar(u).applyQuaternion(pq).add(P[p >= 0 ? p : I.Hips]);
    const k = tgt[i];
    if (k) {
      Q[i].copy(_pq[k]).multiply(base.restWQ[i]);
      b.quaternion.copy(_q.copy(pq).invert().multiply(Q[i]));
    } else Q[i].copy(pq).multiply(b.quaternion);
  }
  // arma in mano → cinematica inversa delle braccia verso le mani procedurali (sull'impugnatura)
  const gp = m.gunPivot;
  let hold = gp.visible && gp.children.some(c => c.visible) && m.body.visible;
  const gr = m._grip, gun = hold && gp.children[0] && gp.children[0].userData.weapon;
  if (gr && hold) setGrip(R, gr[0], gr[1], !gun); else setGrip(R, hold || m._clawG ? 1 : 0);   // v41: con gli Artigli il pugno è chiuso
  if (hold) {
    for (let i = 0; i < 2; i++) {
      const side = i ? 'Left' : 'Right';
      const ia = I[side + 'Arm'], ie = I[side + 'ForeArm'], ih = I[side + 'Hand'];
      if (ia === undefined || ie === undefined || ih === undefined) continue;
      // posizioni procedurali: spalla, gomito, polso
      const s = _pp.s[i].copy(m.arms[i].position).applyQuaternion(T).add(m.torso.position);
      const e = _pp.e[i].copy(m.elbows[i].position).applyQuaternion(_pq['a' + i]).add(s);
      const h = _pp.h[i].copy(m.hands[i].position).applyQuaternion(_pq['e' + i]).add(e);
      ik(B, Q, P, base, ia, ie, ih, h, e.sub(s));
    }
  }
  R.rg.updateMatrixWorld(true);
  // v41: Artigli: i guanti stanno sulle mani procedurali, ma senza IK il polso del modello vero cade altrove
  //  (proporzioni diverse) e i guanti sembravano galleggiare: li spostiamo sul polso vero a ogni fotogramma
  if (m._clawG) for (let i = 0; i < 2; i++) {
    const g = m._clawG[i], ih = I[i ? 'LeftHand' : 'RightHand'];
    if (!g || !g.parent || ih === undefined) continue;
    B[ih].getWorldPosition(_cw);
    g.parent.updateWorldMatrix(true, false);
    g.parent.worldToLocal(_cw);
    g.position.set(_cw.x, _cw.y - 0.035, _cw.z);
    g.updateMatrixWorld(true);
  }
}
const _cw = new THREE.Vector3();

/** cinematica inversa a due ossa (braccio + avambraccio) con il gomito verso pole */
function ik(B, Q, P, base, ia, ie, ih, target, pole) {
  const u = base.unit;
  const S = P[ia];
  const a = B[ie].position.length() * u, b = B[ih].position.length() * u;
  const dir = _v.copy(target).sub(S);
  let d = dir.length();
  if (d < 1e-4) return;
  dir.divideScalar(d);
  d = Math.min(d, (a + b) * 0.999);
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const perp = _v2.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0).addScaledVector(dir, dir.y);
  perp.normalize();
  const E = _v3.copy(S).addScaledVector(dir, x).addScaledVector(perp, h);
  const pa = base.parent[ia], pqA = pa >= 0 ? Q[pa] : base.baseQ;
  // braccio: ruota la direzione attuale (verso il gomito) su quella voluta
  const cur = new THREE.Vector3().copy(B[ie].position).normalize().applyQuaternion(Q[ia]);
  const want = new THREE.Vector3().copy(E).sub(S).normalize();
  Q[ia].premultiply(_q.setFromUnitVectors(cur, want));
  B[ia].quaternion.copy(_q2.copy(pqA).invert().multiply(Q[ia]));
  // avambraccio (rotazione del retargeting + correzione verso il polso)
  Q[ie].copy(Q[ia]).multiply(B[ie].quaternion);
  const cur2 = new THREE.Vector3().copy(B[ih].position).normalize().applyQuaternion(Q[ie]);
  const want2 = new THREE.Vector3().copy(target).sub(E).normalize();
  Q[ie].premultiply(_q.setFromUnitVectors(cur2, want2));
  B[ie].quaternion.copy(_q2.copy(Q[ia]).invert().multiply(Q[ie]));
  // mano: orientamento del retargeting, ricalcolato rispetto al nuovo avambraccio
  const handW = new THREE.Quaternion().copy(Q[ih]);
  B[ih].quaternion.copy(_q2.copy(Q[ie]).invert().multiply(handW));
  P[ie].copy(E);
}

/** da chiamare prima di ogni render (scene.onBeforeRender): aggiorna tutti i personaggi visibili */
export function syncAllReal() {
  for (let i = ACTIVE.length - 1; i >= 0; i--) {
    const m = ACTIVE[i].deref();
    if (!m) { ACTIVE.splice(i, 1); continue; }
    if (!m.root.parent || !m.root.visible || !m.body.visible) continue;
    const R = m.real;
    if (R && R.want) {
      if (REAL.bases[R.want] !== undefined) {
        // è arrivato il personaggio della skin: sostituisce il modello base
        if (REAL.bases[R.want]) attachReal(m, R.skin, { ...R.keep, hat: undefined });
        else R.want = null;
      } else loadSkinModel(R.want);
    }
    // v43: se la posa non è cambiata da quando l'abbiamo copiata (personaggi lontani animati a frame alterni) si salta
    if (m._animF !== undefined) { if (m._animF === m._syncF) continue; m._syncF = m._animF; }
    syncReal(m);
  }
}
