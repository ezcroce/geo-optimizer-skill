// ─────────────────────────────────────────────────────────────
//  Personaggi realistici (v25)
//  Modelli umani scolpiti e texturizzati (scheletro standard Mixamo, file .glb in models/chars/).
//  Lo scheletro procedurale di character.js resta invisibile e continua a fare tutte le animazioni
//  (corsa, mira, arrampicata, nuoto, deltaplano, emote…): ogni fotogramma la posa viene trasferita
//  alle ossa del modello vero (retargeting). Con l'arma in mano le braccia usano la cinematica inversa
//  così le mani restano esattamente sull'impugnatura.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const REAL = { ready: false, bases: {}, promise: null };
const FILES = { soldier: 'soldato.glb', woman: 'donna.glb' };
// skin con il corpo femminile (le altre usano il soldato con l'armatura ricolorata)
const WOMAN = new Set(['esploratrice', 'tamsin', 'scienziata', 'giardiniera']);
export const realKind = (skin) => (WOMAN.has(skin.id) ? 'woman' : 'soldier');

const MAIN = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const norm = (n) => n.replace(/^mixamorig:?/, '');
const HEAD_Y = 1.6;            // altezza dell'articolazione della testa nello scheletro procedurale (RIG.hip + RIG.headY)
const ARM_SPLAY = 0.1;         // a riposo le braccia sono leggermente staccate dai fianchi
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();

export function loadRealChars(prefix = 'models/chars/') {
  if (REAL.promise) return REAL.promise;
  const loader = new GLTFLoader();
  REAL.promise = Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    try { REAL.bases[k] = prepare(k, await loader.loadAsync(prefix + f)); }
    catch (e) { console.warn('Modello realistico non caricato:', f, e); }
  })).then(() => { REAL.ready = !!(REAL.bases.soldier || REAL.bases.woman); return REAL.ready; });
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
  scene.removeFromParent();
  return { kind, scene, s, oy: rg.position.y, list, idx, parent, restWQ, baseQ, baseInv, baseM, hipsRest, unit, headPos, spinePos, mats, matCache: new Map() };
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

// ── personaggi attivi (riferimenti deboli: quelli eliminati vengono raccolti dal garbage collector) ──
const ACTIVE = [];

/**
 * Sostituisce l'aspetto del personaggio procedurale m con il modello realistico.
 * keep: oggetti dello scheletro procedurale che restano visibili (cappelli, zaini, mantello).
 */
export function attachReal(m, skin, keep = {}) {
  if (!REAL.ready) return false;
  const base = REAL.bases[realKind(skin)] || REAL.bases.soldier || REAL.bases.woman;
  if (!base) return false;
  const inst = cloneSkinned(base.scene);
  const rg = new THREE.Group();
  rg.name = 'real';
  rg.scale.setScalar(base.s); rg.position.y = base.oy;
  rg.add(inst);
  const bones = {};
  inst.traverse(o => {
    if (o.isBone) bones[norm(o.name)] = o;
    if (o.isMesh) {
      o.material = recolorMat(base, base.mats[o.name] || o.material, skin, o.name);
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    }
  });
  const B = base.list.map(n => bones[n]);
  // nasconde le mesh procedurali (restano gruppi/articolazioni per le animazioni)
  const keepSet = new Set([m.gunPivot, m.lod, ...(keep.hat || []), ...(keep.back || []), keep.cape].filter(Boolean));
  const hide = (o) => { if (keepSet.has(o)) return; if (o.isMesh) o.visible = false; for (const c of o.children) hide(c); };
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
    const a = anchor(bones.Head, new THREE.Vector3(0, HEAD_Y + (base.kind === "woman" ? -0.12 : 0.04), base.kind === 'woman' ? 0.0 : 0.01));
    for (const o of keep.hat) a.add(o);
  }
  const back = [...(keep.back || []), ...(keep.cape ? [keep.cape] : [])];
  if (back.length && bones.Spine) {
    const a = anchor(bones.Spine, new THREE.Vector3(0, 0.9, base.kind === 'soldier' ? -0.035 : -0.01));
    for (const o of back) a.add(o);
  }
  m.body.add(rg);
  m.lids = null;
  // dita: rilassate, oppure strette sull'impugnatura
  const fingers = [];
  for (const side of ['Left', 'Right']) for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) {
    const b = bones[side + 'Hand' + f + k];
    if (b) fingers.push({ b, q0: b.quaternion.clone(), thumb: f === 'Thumb', trigger: side === 'Right' && f === 'Index', k });
  }
  m.real = { rg, B, base, Q: B.map(() => new THREE.Quaternion()), P: B.map(() => new THREE.Vector3()), fingers, grip: -1 };
  setGrip(m.real, 0);
  ACTIVE.push(new WeakRef(m));
  return true;
}

function setGrip(R, g) {
  if (Math.abs(R.grip - g) < 0.02) return;
  R.grip = g;
  for (const f of R.fingers) {
    const a = f.thumb ? 0.15 + g * 0.35 : (0.28 + 0.12 * f.k) + g * (f.trigger ? 0.35 : 0.95);
    f.b.quaternion.copy(f.q0).multiply(_q.setFromAxisAngle(_v.set(1, 0, 0), a));
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
  setGrip(R, hold ? 1 : 0);
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
}

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
    syncReal(m);
  }
}
