// ─────────────────────────────────────────────────────────────
//  v28: costumi dei personaggi realistici
//  I modelli di models/chars/ sono persone "normali" (asset MakeHuman): da soli un drago o un ninja
//  sembrano un ragazzo vestito di rosso o di nero. Qui ogni skin riceve i pezzi che la rendono
//  riconoscibile, costruiti sul corpo vero del personaggio:
//   • gusci: copie del corpo scuoiato, gonfiate di qualche millimetro/centimetro e con gli stessi pesi
//     delle ossa → si muovono con le animazioni (cappucci, armature, scaglie, pellicce, hakama…).
//     I bordi (fessura degli occhi, giunture dell'armatura) sono tagliati per pixel nello shader,
//     così le linee sono pulite anche se i triangoli del corpo sono grandi;
//   • pezzi rigidi agganciati alle ossa: ali, coda, corna, elmi, spade, scudi, zaino spaziale…
//  Tutti i materiali hanno rilievo procedurale (scaglie, trama del tessuto, lamelle laccate, pelo,
//  metallo martellato) calcolato dalla posizione a riposo: niente texture da scaricare.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
let NORM = (n) => n;
const isArm = (b) => /Arm|Hand|Shoulder/.test(b), isLeg = (b) => /UpLeg|Leg|Foot|Toe/.test(b);

// ═════════ shader ═════════
const LIB = /* glsl */`
varying vec3 vRest; varying vec3 vRN; varying float vK; varying float vCut;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h33(vec3 p) { return vec3(h31(p), h31(p + 17.13), h31(p + 41.71)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
// celle di Voronoi: x = distanza dal centro più vicino, y = dal secondo, z = id della cella
vec3 cell3(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + h33(i + g) * 0.8 - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h31(i + g + 3.7); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
// rilievo (bump) da un'altezza procedurale in metri
vec3 bumpN(vec3 nrm, float h, float s) {
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition); float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(sy, nrm), r2 = cross(nrm, sx); float det = dot(sx, r1);
  vec3 g = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * nrm - s * g);
}
// scaglie da rettile: cupole sovrapposte con solchi
float scales(vec3 p, float k, out float id) { vec3 c = cell3(p * k); id = c.z; return smoothstep(0.0, 0.18, c.y - c.x) * (1.0 - c.x * 0.7); }
// tessuto: trama fine + pieghe morbide
float cloth(vec3 p) { return fbm(p * 22.0) * 0.0016 + vnoise(p * 260.0) * 0.00025; }
// metallo battuto
float hammered(vec3 p) { vec3 c = cell3(p * 45.0); return -c.x * c.x * 0.0009 + vnoise(p * 300.0) * 0.00008; }
// fila di lamelle laccate tenute da cordoncini (armatura giapponese); s = coordinata orizzontale
float lamellar(float s, float y, float rowH, out float lace) {
  float r = fract(y / rowH), col = fract(s / 0.022);
  float plate = smoothstep(0.0, 0.12, r) * (1.0 - smoothstep(0.85, 1.0, r));
  float cord = 1.0 - smoothstep(0.08, 0.16, abs(fract(s / 0.044) - 0.5));
  lace = cord * step(0.12, r);
  return plate * 0.0016 - (1.0 - smoothstep(0.0, 0.08, abs(col - 0.5) - 0.42)) * 0.0004 + lace * 0.0007;
}
`;

const MATS = new Map();
/**
 * materiale procedurale (o variante procedurale di un materiale esistente con la sua texture)
 * spec.code: GLSL con p (posizione a riposo), n (normale a riposo); può cambiare col, H (rilievo in m),
 *            RGH, MET, EMI, e usare CLIP (true = buco)
 */
function pmat(key, spec, src = null) {
  if (MATS.has(key)) return MATS.get(key);
  const m = src ? src.clone() : new THREE.MeshStandardMaterial({ color: spec.color || '#ffffff', roughness: spec.rough ?? 0.7, metalness: spec.metal ?? 0 });
  if (spec.side) m.side = spec.side;
  if (spec.transparent) { m.transparent = true; m.opacity = spec.opacity ?? 0.85; m.depthWrite = spec.depthWrite ?? true; }
  if (spec.vertexColors) m.vertexColors = true;
  if (spec.envI !== undefined) m.envMapIntensity = spec.envI;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec3 aRN; attribute float aK; attribute float aCut; varying vec3 vRest; varying vec3 vRN; varying float vK; varying float vCut;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vRN = aRN; vK = aK; vCut = aCut;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LIB + (spec.lib || ''))
      .replace('#include <map_fragment>', `#include <map_fragment>
        float AAF = clamp(1.6 - length(fwidth(vRest)) * 160.0, 0.0, 1.0);   // 1 da vicino, 0 quando un pixel copre ~1 cm (niente moiré)
        vec3 p = vRest, n = normalize(vRN); vec3 col = diffuseColor.rgb; float H = 0.0, RGH = roughness, MET = metalness; vec3 EMI = vec3(0.0); bool CLIP = false;
        { ${spec.code || ''} }
        if (CLIP || vCut > 0.0) discard;   // vCut: bordo del guscio tagliato a metà dei triangoli (linea pulita)
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = RGH;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = MET;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = bumpN(normal, H * (0.3 + 0.7 * AAF), ${(spec.bump ?? 1).toFixed(2)});`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += EMI;');
  };
  m.customProgramCacheKey = () => 'cos-' + key;
  m.name = 'cos-' + key;
  MATS.set(key, m);
  return m;
}
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const glv = (v) => `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;
const f4 = (x) => (+x).toFixed(4);

// ═════════ geometria del corpo a riposo ═════════
/** posizioni/normali nel sistema del personaggio (metri, piedi a y=0, sguardo verso +z) e matrici di skinning */
function restOf(mesh) {
  if (mesh.userData.rest) return mesh.userData.rest;
  const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, N = pos.count;
  const sk = mesh.skeleton;
  const bm = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i]));
  const pre = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
  const P = new Float32Array(N * 3), M = new Array(N), A = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const e = A.elements; e.fill(0);
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k); if (!w) continue;
      const be = bm[si.getComponent(i, k)].elements;
      for (let j = 0; j < 16; j++) e[j] += w * be[j];
    }
    const Mv = new THREE.Matrix4().multiplyMatrices(pre, A).multiply(mesh.bindMatrix);
    M[i] = Mv;
    v.fromBufferAttribute(pos, i).applyMatrix4(Mv);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
  }
  // normali morbide, mediate fra i vertici nella stessa posizione (cuciture UV) per non aprire crepe nei gusci
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  if (g.index) tg.setIndex(g.index);
  tg.computeVertexNormals();
  const Nn = tg.attributes.normal.array, acc = new Map();
  const key = (i) => `${Math.round(P[i * 3] * 2000)},${Math.round(P[i * 3 + 1] * 2000)},${Math.round(P[i * 3 + 2] * 2000)}`;
  for (let i = 0; i < N; i++) { const k = key(i); const a = acc.get(k) || [0, 0, 0]; a[0] += Nn[i * 3]; a[1] += Nn[i * 3 + 1]; a[2] += Nn[i * 3 + 2]; acc.set(k, a); }
  const NR = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1; NR[i * 3] = a[0] / l; NR[i * 3 + 1] = a[1] / l; NR[i * 3 + 2] = a[2] / l; }
  // osso dominante di ogni vertice (nomi normalizzati: LeftForeArm, RightUpLeg, Head…)
  const names = sk.bones.map(b => NORM(b.name)), B = new Array(N);
  for (let i = 0; i < N; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } } B[i] = names[best] || ''; }
  mesh.userData.rest = { P, N: NR, M, B };
  return mesh.userData.rest;
}
/** aggiunge aRest/aRN (posizione e normale a riposo) a una mesh esistente, per i materiali procedurali */
function addRest(mesh) {
  const R = restOf(mesh), g = mesh.geometry;
  if (!g.attributes.aRest) { g.setAttribute('aRest', new THREE.BufferAttribute(R.P, 3)); g.setAttribute('aRN', new THREE.BufferAttribute(R.N, 3)); }
  return R;
}
/**
 * guscio: copia (di una parte) della mesh scuoiata, spostata di off(p, n) metri lungo la normale
 * (o di disp(p, n) → Vector3) e con gli stessi pesi delle ossa.
 */
// I corpi MakeHuman non hanno la pelle sotto i vestiti (i vertici coperti sono stati tolti):
// un guscio "del corpo" si costruisce quindi sull'unione di corpo + vestiti.
let BODY = null, CLOTH = [], ROOT = null;
const CLOTH_RE = /suit|shirt|tunic|kimono|robe|uniform|pants|jeans|shorts|sweater|polo|tank|cargo|dress|boots|shoes/i;
function shell(src, name, mat, opt = {}) {
  if (src !== BODY || !CLOTH.length) return shell1(src, name, mat, opt);
  let first = null;
  for (const s of [BODY, ...CLOTH]) { const m = shell1(s, name, mat, opt); first = first || m; }
  return first;
}
function shell1(src, name, mat, { sel = () => true, off = () => 0.01, disp = null, k = null, edge = null } = {}) {
  const R = restOf(src), g = src.geometry, N = g.attributes.position.count;
  const idx = g.index ? g.index.array : Array.from({ length: N }, (_, i) => i);
  const ok = new Uint8Array(N), p = v3(), n = v3();
  for (let i = 0; i < N; i++) { p.fromArray(R.P, i * 3); n.fromArray(R.N, i * 3); ok[i] = sel(p, n, R.B[i]) ? 1 : 0; }
  const map = new Int32Array(N).fill(-1), tri = [];
  let cnt = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (!(ok[a] || ok[b] || ok[c])) continue;
    for (const k of [a, b, c]) { if (map[k] < 0) map[k] = cnt++; tri.push(map[k]); }
  }
  if (!tri.length) return null;
  const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2), rest = new Float32Array(cnt * 3), rn = new Float32Array(cnt * 3);
  const skI = new Uint16Array(cnt * 4), skW = new Float32Array(cnt * 4), K = new Float32Array(cnt), CUT = new Float32Array(cnt);
  const inv = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = v3(), d = v3();
  const QD = disp ? new Float32Array(cnt * 3) : null, SRC = disp ? new Int32Array(cnt) : null;
  const UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  for (let i = 0; i < N; i++) {
    const j = map[i]; if (j < 0) continue;
    p.fromArray(R.P, i * 3); n.fromArray(R.N, i * 3);
    if (disp) d.copy(disp(p, n, R.B[i])); else d.copy(n).multiplyScalar(off(p, n, R.B[i]));
    if (k) K[j] = k(p, n, R.B[i]);
    // edge: distanza (m) dal bordo, positiva dentro → taglio dritto anche su triangoli grandi
    CUT[j] = edge ? (ok[i] ? -edge(p, n, R.B[i]) : Math.max(-edge(p, n, R.B[i]), 0.01)) : (ok[i] ? -1 : 1);
    q.copy(p).add(d);
    if (QD) { QD[j * 3] = q.x; QD[j * 3 + 1] = q.y; QD[j * 3 + 2] = q.z; SRC[j] = i; }
    inv.copy(R.M[i]).invert();
    q.applyMatrix4(inv);
    pos[j * 3] = q.x; pos[j * 3 + 1] = q.y; pos[j * 3 + 2] = q.z;
    nm.getNormalMatrix(inv);
    q.copy(n).applyMatrix3(nm).normalize();
    nor[j * 3] = q.x; nor[j * 3 + 1] = q.y; nor[j * 3 + 2] = q.z;
    rest[j * 3] = p.x; rest[j * 3 + 1] = p.y; rest[j * 3 + 2] = p.z;
    rn[j * 3] = n.x; rn[j * 3 + 1] = n.y; rn[j * 3 + 2] = n.z;
    if (UV) { uv[j * 2] = UV.getX(i); uv[j * 2 + 1] = UV.getY(i); }
    for (let k = 0; k < 4; k++) { skI[j * 4 + k] = SI.getComponent(i, k); skW[j * 4 + k] = SW.getComponent(i, k); }
  }
  if (QD) {
    // forma cambiata (muso, elmo): le normali vanno ricalcolate, altrimenti la luce "disegna" ancora la faccia di sotto
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(QD, 3)); tg.setIndex(tri); tg.computeVertexNormals();
    const Nn = tg.attributes.normal.array, acc = new Map();
    const key = (j) => `${Math.round(QD[j * 3] * 2000)},${Math.round(QD[j * 3 + 1] * 2000)},${Math.round(QD[j * 3 + 2] * 2000)}`;
    for (let j = 0; j < cnt; j++) { const kk = key(j); const a = acc.get(kk) || [0, 0, 0]; a[0] += Nn[j * 3]; a[1] += Nn[j * 3 + 1]; a[2] += Nn[j * 3 + 2]; acc.set(kk, a); }
    for (let j = 0; j < cnt; j++) {
      const a = acc.get(key(j)); q.set(a[0], a[1], a[2]).normalize();
      inv.copy(R.M[SRC[j]]).invert(); nm.getNormalMatrix(inv);
      q.applyMatrix3(nm).normalize();
      nor[j * 3] = q.x; nor[j * 3 + 1] = q.y; nor[j * 3 + 2] = q.z;
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  sg.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
  sg.setAttribute('aRN', new THREE.BufferAttribute(rn, 3));
  sg.setAttribute('skinIndex', new THREE.BufferAttribute(skI, 4));
  sg.setAttribute('skinWeight', new THREE.BufferAttribute(skW, 4));
  sg.setAttribute('aK', new THREE.BufferAttribute(K, 1));
  sg.setAttribute('aCut', new THREE.BufferAttribute(CUT, 1));
  sg.setIndex(tri);
  const m = new THREE.SkinnedMesh(sg, mat);
  m.name = 'cos_' + name;
  // stessa trasformazione della mesh d'origine (le mesh quantizzate hanno la scala sul nodo)
  m.matrix.copy(src.matrix); m.matrix.decompose(m.position, m.quaternion, m.scale);
  (src.parent || ROOT).add(m);
  m.bind(src.skeleton, src.bindMatrix);
  return m;
}

// ═════════ pezzi rigidi ═════════
/** aRest/aRN = posizione/normale locali (o una coordinata a scelta, es. lungo il tubo) */
function rigid(g, restFn = null) {
  g = g.index ? g : g;
  const P = g.attributes.position, Nn = g.attributes.normal;
  const r = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const v = restFn ? restFn(i, P) : [P.getX(i), P.getY(i), P.getZ(i)];
    r[i * 3] = v[0]; r[i * 3 + 1] = v[1]; r[i * 3 + 2] = v[2];
  }
  g.setAttribute('aRest', new THREE.BufferAttribute(r, 3));
  g.setAttribute('aRN', Nn.clone());
  return g;
}
/** tubo che si assottiglia lungo una curva; aRest = (t, angolo, 0) + posizione in aRestP */
function taper(pts, rFn, seg = 24, rad = 10, { sx = 1, sy = 1, closed = true, along = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const P = g.attributes.position;
  const rest = new Float32Array(P.count * 3);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t), N = g.normals[i], B = g.binormals[i], r = rFn(t);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j, a = j / rad * Math.PI * 2;
      const x = Math.cos(a) * r * sx, y = Math.sin(a) * r * sy;
      P.setXYZ(k, c.x + N.x * x + B.x * y, c.y + N.y * x + B.y * y, c.z + N.z * x + B.z * y);
      if (along) { rest[k * 3] = t; rest[k * 3 + 1] = j / rad; rest[k * 3 + 2] = r; }
      else { rest[k * 3] = c.x + N.x * x + B.x * y; rest[k * 3 + 1] = c.y + N.y * x + B.y * y; rest[k * 3 + 2] = c.z + N.z * x + B.z * y; }
    }
  }
  g.computeVertexNormals();
  g.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
  g.setAttribute('aRN', g.attributes.normal.clone());
  if (closed) {
    // tappo alla base (la punta è già chiusa se il raggio finale è ~0)
    const c0 = curve.getPointAt(0);
    const cap = new THREE.CircleGeometry(rFn(0) * Math.max(sx, sy), rad).lookAt(curve.getTangentAt(0).negate());
    cap.translate(c0.x, c0.y, c0.z);
    return mergeG([g, rigid(cap, along ? () => [0, 0, rFn(0)] : null)]);
  }
  return g;
}
function mergeG(list) {
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'aRest', 'aRN'];
  let total = 0; const parts = list.map(g => { const n = g.index ? g.toNonIndexed() : g; total += n.attributes.position.count; return n; });
  for (const nm of names) {
    const arr = new Float32Array(total * 3); let o = 0;
    for (const g of parts) { const a = g.attributes[nm]; arr.set(a.array.subarray(0, a.count * 3), o); o += a.count * 3; }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}
/** superficie da una griglia parametrica f(u, v) → [x, y, z]; aRest = (u, v, 0) se uvRest */
function surf(f, nu, nv, uvRest = true) {
  const pos = [], rest = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv; const p = f(u, v); pos.push(...p); rest.push(...(uvRest ? [u, v, 0] : p)); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const ng = g.toNonIndexed();
  const r = new Float32Array(idx.length * 3); idx.forEach((k, i) => { r[i * 3] = rest[k * 3]; r[i * 3 + 1] = rest[k * 3 + 1]; r[i * 3 + 2] = rest[k * 3 + 2]; });
  ng.setAttribute('aRest', new THREE.BufferAttribute(r, 3));
  ng.setAttribute('aRN', ng.attributes.normal.clone());
  return ng;
}

// ═════════ materiali dei costumi ═════════
const MAT = {
  dragonSkin: (src, clip = '', k = 'dragonSkin') => pmat(k, { code: clip + `
      float id; float s = scales(p, 62.0, id);
      // ventre a piastre trasversali chiare
      float bw = mix(0.035, 0.085, smoothstep(0.88, 1.25, p.y)) * (1.0 - smoothstep(1.3, 1.42, p.y) * 0.6);
      float belly = smoothstep(0.015, 0.0, abs(p.x) - bw) * smoothstep(0.1, 0.35, n.z) * smoothstep(0.84, 0.9, p.y) * (1.0 - smoothstep(1.36, 1.42, p.y));
      float plate = 1.0 - smoothstep(0.0, 0.25, abs(fract(p.y / 0.034) - 0.5) - 0.25);
      vec3 base = mix(vec3(0.30, 0.025, 0.02), vec3(0.52, 0.06, 0.03), id);
      base = mix(base, vec3(0.06, 0.008, 0.008), smoothstep(0.15, 0.0, s) * 0.8);
      vec3 bel = mix(vec3(0.62, 0.32, 0.08), vec3(0.78, 0.46, 0.14), plate);
      col = mix(base, bel, belly);
      H = mix(s * 0.0022, plate * 0.0016, belly);
      RGH = mix(0.38, 0.6, belly) + (1.0 - s) * 0.2; MET = 0.05;
      EMI = vec3(0.12, 0.02, 0.0) * smoothstep(0.1, 0.0, s) * (1.0 - belly);` }, src),
  dragonHorn: () => pmat('dragonHorn', { rough: 0.45, code: `
      float t = p.x; col = mix(vec3(0.82, 0.74, 0.58), vec3(0.16, 0.11, 0.08), smoothstep(0.35, 1.0, t));
      H = sin(t * 90.0) * 0.0007 + vnoise(vec3(t * 40.0, p.y * 8.0, 0.0)) * 0.0006; RGH = 0.35 + t * 0.25;` }),
  wingBone: () => pmat('wingBone', { rough: 0.5, code: `
      float id; float s = scales(p, 120.0, id); col = mix(vec3(0.24, 0.03, 0.02), vec3(0.4, 0.06, 0.03), id); H = s * 0.0012;` }),
  membrane: () => pmat('membrane', { side: THREE.DoubleSide, rough: 0.55, code: `
      // venature e bordo scuro; un po' di luce che "passa" attraverso la membrana
      float vein = 1.0 - smoothstep(0.0, 0.03, abs(fract(p.x * 7.0 + vnoise(p * 6.0) * 0.6) - 0.5) - 0.44);
      float edge = smoothstep(0.86, 1.0, p.y);
      col = mix(vec3(0.42, 0.05, 0.03), vec3(0.62, 0.16, 0.05), vnoise(p * 9.0)) * (1.0 - vein * 0.45) * (1.0 - edge * 0.5);
      H = vein * 0.0012 + fbm(p * 14.0) * 0.0015;
      EMI = vec3(0.18, 0.035, 0.0) * (1.0 - vein) * (1.0 - edge);` }),
  ninjaCloth: () => pmat('ninjaCloth', { color: '#15161b', rough: 0.88, code: `
      H = cloth(p) * 1.4; col *= 0.9 + vnoise(p * 30.0) * 0.2;` }),
  ninjaHood: (eye) => pmat('ninjaHood', { color: '#16171d', rough: 0.88, code: `
      // fessura per gli occhi (superellisse sulla faccia)
      vec2 e = vec2(p.x / 0.064, (p.y - ${f4(eye.y + 0.002)}) / 0.0175);
      CLIP = n.z > 0.15 && p.z > ${f4(eye.z - 0.05)} && (pow(abs(e.x), 4.0) + pow(abs(e.y), 4.0)) < 1.0;
      H = cloth(p) * 1.5; col *= 0.9 + vnoise(p * 30.0) * 0.2;` }),
  ninjaMask: (eye) => pmat('ninjaMask', { color: '#1b1c22', rough: 0.9, code: `
      CLIP = p.y > ${f4(eye.y - 0.021)} + p.x * p.x * 1.2;
      H = cloth(p) * 1.5 + sin(p.y * 260.0) * 0.0003;` }),
  sash: (c) => pmat('sash' + c, { color: c, rough: 0.8, code: `H = cloth(p) + sin((p.y + p.x * 0.3) * 330.0) * 0.00035;` }),
  wraps: (c) => pmat('wraps' + c, { color: c, rough: 0.9, code: `float w = fract((p.y + atan(p.x, p.z) * 0.012) / 0.018); H = smoothstep(0.0, 0.2, w) * (1.0 - smoothstep(0.8, 1.0, w)) * 0.001 + cloth(p) * 0.5; col *= 0.85 + w * 0.2;` }),
  lacquer: (c, k = 'l') => pmat('lacq' + k + c, { color: c, rough: 0.22, metal: 0.05, code: `H = vnoise(p * 60.0) * 0.0002;` }),
  saya: () => pmat('saya', { color: '#0b0b0d', rough: 0.18, metal: 0.1, envI: 1.4, code: `H = vnoise(p * 80.0) * 0.0001;` }),
  tsuka: () => pmat('tsuka', { color: '#1a1a24', rough: 0.85, code: `
      // intreccio a rombi sul manico (coordinate lungo il tubo)
      float a = p.x * 60.0, b = p.y * 6.0; float dia = abs(fract(a + b) - 0.5) + abs(fract(a - b) - 0.5);
      float wrap = smoothstep(0.42, 0.5, dia);
      col = mix(vec3(0.07, 0.07, 0.1), vec3(0.85, 0.82, 0.74), 1.0 - wrap); H = wrap * 0.0008;` }),
  steel: (c = '#9ea4ab', k = 's') => pmat('steel' + k + c, { color: c, rough: 0.3, metal: 0.95, envI: 1.6, code: `H = hammered(p) * 0.6;` }),
  gold: () => pmat('gold', { color: '#f0c25a', rough: 0.3, metal: 0.75, envI: 2.6, code: `H = hammered(p);` }),
  // armatura giapponese: lamelle laccate cremisi legate da cordoncini blu notte
  lamellar: (c, mode = 0) => pmat('lam' + mode + c, { color: c, rough: 0.25, metal: 0.05, envI: 1.2, code: `
      float s = ${mode === 0 ? 'atan(p.x, p.z) * 0.16' : 'p.x * 0.4'}, lace;
      H = lamellar(s, p.y, ${mode === 0 ? '0.042' : '0.12'}, lace);
      col = mix(col, vec3(0.03, 0.04, 0.10), lace); RGH = mix(0.22, 0.85, lace);
      col *= 0.92 + vnoise(p * 40.0) * 0.12;` }),
  kabuto: () => pmat('kabuto', { color: '#121214', rough: 0.3, metal: 0.4, envI: 1.3, code: `
      float a = atan(p.x, p.z) * 32.0 / 6.2832; float r = abs(fract(a) - 0.5);
      H = smoothstep(0.3, 0.5, r) * 0.0012; float riv = step(0.92, fract(a)) * step(0.5, fract(p.y * 80.0));
      col = mix(col, vec3(0.85, 0.66, 0.3), riv * 0.6);` }),
  hakama: (c) => pmat('hakama' + c, { color: c, rough: 0.9, code: `
      float a = atan(p.x - sign(p.x) * 0.1, p.z); float pl = sin(a * 14.0);
      H = pl * 0.0018 + cloth(p) * 0.6; float stripe = step(0.85, fract(a * 9.0));
      col *= (0.85 + 0.15 * pl) * (1.0 - stripe * 0.25);` }),
  // cotta di maglia (anelli) sotto l'armatura
  mail: (src) => pmat('mail', { color: '#5c6066', rough: 0.4, metal: 0.85, envI: 1.4, code: `
      float s = atan(p.x, p.z) * 0.16; vec2 g = vec2(s / 0.008, p.y / 0.006); g.x += mod(floor(g.y), 2.0) * 0.5;
      vec2 f = fract(g) - 0.5; float ring = 1.0 - smoothstep(0.08, 0.2, abs(length(f) - 0.32));
      ring = mix(0.55, ring, AAF); col = vec3(0.36, 0.38, 0.4) * (0.5 + ring * 0.7); H = ring * 0.0006;` }),
  plateGold: (gaps) => pmat('plateGold', { color: '#f0c25a', rough: 0.3, metal: 0.72, envI: 2.6, code: `
      ${gaps}
      H = hammered(p) * 0.7 + (1.0 - smoothstep(0.0, 0.006, abs(p.x))) * step(0.0, n.z) * step(0.9, p.y) * step(p.y, 1.42) * 0.002;
      float lame = 1.0 - smoothstep(0.0, 0.08, abs(fract(p.y / 0.03) - 0.5) - 0.42);
      H -= lame * LAMES * 0.0012; col *= 1.0 - lame * LAMES * 0.25;`, lib: '' }),
  cape: (c) => pmat('cape' + c, { color: c, side: THREE.DoubleSide, rough: 0.75, code: `float f = sin(p.x * 34.0 + sin(p.y * 3.0)) ; H = f * 0.004 + cloth(p * 0.7) * 0.6; col *= 0.82 + 0.18 * (f * 0.5 + 0.5);` }),
  plume: (c) => pmat('plume' + c, { color: c, side: THREE.DoubleSide, rough: 0.8, code: `float b = fract(p.y * 90.0 + p.x * 12.0); H = b * 0.0006; col *= 0.8 + b * 0.25;` }),
  suitWhite: () => pmat('suitWhite', { color: '#eceef0', rough: 0.55, code: `H = vnoise(p * 50.0) * 0.0004; float panel = 1.0 - smoothstep(0.0, 0.004, abs(fract(p.y * 5.0) - 0.5) - 0.495); col *= 1.0 - panel * 0.15;` }),
  visorGold: () => pmat('visorGold', { color: '#d9a548', rough: 0.06, metal: 1, envI: 2.6 }),
  alu: () => pmat('alu', { color: '#b8bcc2', rough: 0.35, metal: 0.9, envI: 1.6, code: `H = vnoise(vec3(p.x * 900.0, p.y * 20.0, p.z * 900.0)) * 0.0001;` }),
  bananaSkin: () => pmat('banana', { side: THREE.DoubleSide, rough: 0.55, code: `
      // p.x = lungo il frutto (0 = sotto, 1 = sopra), p.y = giro (0..1)
      float t = p.x, a = p.y; float ridge = 1.0 - smoothstep(0.0, 0.03, abs(fract(a * 5.0) - 0.5) - 0.44);
      col = mix(vec3(0.95, 0.78, 0.12), vec3(0.98, 0.86, 0.25), vnoise(vec3(t * 20.0, a * 30.0, 0.0)));
      col = mix(col, vec3(0.55, 0.62, 0.15), smoothstep(0.82, 1.0, t) + smoothstep(0.08, 0.0, t) * 0.6);
      vec3 c = cell3(vec3(t * 26.0, a * 40.0, 1.3)); float spot = smoothstep(0.16, 0.06, c.x) * step(0.72, c.z);
      col = mix(col, vec3(0.32, 0.2, 0.06), spot * 0.85);
      col *= 1.0 - ridge * 0.18;
      if (!gl_FrontFacing) col = vec3(0.93, 0.9, 0.78) * (0.8 + vnoise(vec3(t * 60.0, a * 60.0, 0.0)) * 0.2);
      H = ridge * 0.002 + vnoise(vec3(t * 120.0, a * 160.0, 0.0)) * 0.0003;` }),
  bananaStem: () => pmat('bananaStem', { color: '#5a4a22', rough: 0.85, code: `H = fbm(p * 200.0) * 0.0008; col *= 0.8 + vnoise(p * 90.0) * 0.4;` }),
  felt: (c) => pmat('felt' + c, { color: c, rough: 0.95, side: THREE.DoubleSide, code: `H = vnoise(p * 400.0) * 0.00025 + fbm(p * 30.0) * 0.0006;` }),
  feltTrim: (c, t) => pmat('feltTrim' + c + t, { color: c, rough: 0.95, side: THREE.DoubleSide, code: `
      float tr = smoothstep(0.86, 0.9, p.x); col = mix(col, ${t}, tr); RGH = mix(0.95, 0.35, tr); MET = tr * 0.8;
      H = vnoise(p * 400.0) * 0.00025 + tr * 0.0008;` }),
  leather: (c) => pmat('leather' + c, { color: c, rough: 0.6, code: `H = fbm(p * 140.0) * 0.0005; col *= 0.85 + vnoise(p * 40.0) * 0.3;` }),
  coat: (c) => pmat('coat' + c, { color: c, rough: 0.82, code: `
      H = cloth(p);
      // due file di bottoni d'oro sul petto e risvolti dorati ai polsi
      vec2 b = vec2(abs(p.x) - 0.075, fract((p.y - 0.95) / 0.07) - 0.5);
      float btn = (1.0 - smoothstep(0.006, 0.009, length(vec2(b.x, b.y * 0.07)))) * step(0.3, n.z) * step(0.95, p.y) * step(p.y, 1.36);
      col = mix(col, vec3(0.85, 0.65, 0.25), btn); MET = btn; RGH = mix(0.82, 0.3, btn); H += btn * 0.002;` }),
  fur: (c, edge) => pmat('fur' + c, { color: c, rough: 1, code: `
      float f = fbm(vec3(p.x * 160.0, p.y * 40.0, p.z * 160.0)); float tip = vnoise(p * 300.0);
      col *= 0.6 + f * 0.7; col = mix(col, vec3(0.85, 0.8, 0.7), smoothstep(0.75, 1.0, tip) * 0.3);
      H = f * 0.004 + tip * 0.001;
      CLIP = fbm(p * 30.0) > 0.66 && p.y < ${f4(edge)};` }),
  wood: (c) => pmat('wood' + c, { color: c, rough: 0.75, side: THREE.DoubleSide, code: `
      float r = atan(p.y, p.x); float plank = step(0.5, fract(p.x / 0.09)); float g = fbm(vec3(p.x * 40.0, p.y * 3.0, 0.0));
      col *= 0.8 + g * 0.35; col = mix(col, vec3(0.75, 0.72, 0.65), step(0.0, p.x * p.y) * 0.75);
      H = g * 0.0012 - (1.0 - smoothstep(0.0, 0.004, abs(fract(p.x / 0.09) - 0.5) - 0.49)) * 0.002;` }),
  ice: (src, c) => pmat('ice' + c, { transparent: true, opacity: 0.86, code: `
      col = mix(col, ${c}, 0.65);
      float fr = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
      EMI = vec3(0.18, 0.4, 0.75) * (0.35 + fr * 1.4) * (0.75 + vnoise(p * 20.0) * 0.5);
      H = fbm(p * 40.0) * 0.001; RGH = 0.35;` }, src),
  robotSkin: (src) => pmat('robotSkin', { color: '#9aa3ad', rough: 0.32, metal: 0.95, envI: 1.6, code: `
      col = vec3(0.56, 0.6, 0.66); float seam = 1.0 - smoothstep(0.0, 0.003, min(abs(fract(p.y * 9.0) - 0.5) - 0.497 + 0.0, abs(fract(atan(p.x, p.z) * 1.3) - 0.5) - 0.497));
      H = -seam * 0.0012 + hammered(p) * 0.3; col *= 1.0 - seam * 0.5;` }),
  zombieSkin: (src) => pmat('zombieSkin', { code: `
      float rot = fbm(p * 18.0); float vein = 1.0 - smoothstep(0.0, 0.02, abs(fbm(p * 30.0) - 0.5));
      col = mix(col, col * vec3(0.55, 0.62, 0.5), smoothstep(0.45, 0.75, rot));
      col = mix(col, vec3(0.22, 0.25, 0.32), vein * 0.35);
      vec3 c = cell3(p * 9.0); float wound = smoothstep(0.22, 0.1, c.x) * step(0.82, c.z);
      col = mix(col, vec3(0.28, 0.03, 0.03), wound); RGH = mix(RGH, 0.25, wound); H = rot * 0.001 - wound * 0.002;` }, src),
  zombieCloth: (src) => pmat('zombieCloth', { code: `
      vec3 c = cell3(p * 7.0); CLIP = fbm(p * 26.0) > 0.68 || (c.x < 0.16 && c.z > 0.86);
      float blood = smoothstep(0.55, 0.7, fbm(p * 9.0 + 4.0)); col = mix(col * 0.75, vec3(0.25, 0.03, 0.02), blood * 0.8);
      col *= 0.75 + fbm(p * 40.0) * 0.3;` }, src),
  glowEye: (src, c) => pmat('eye' + c, { code: `EMI = ${c} * (0.6 + 0.6 * smoothstep(0.2, 0.6, dot(col, vec3(0.33))));` }, src),
};
// fra gusci dello stesso costume i materiali vanno istanziati una volta sola per personaggio
const vec = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`; };

// ═════════ misure del personaggio a riposo ═════════
function measure(ctx) {
  const J = {}, w = v3();
  for (const k in ctx.bones) J[k] = ctx.bones[k].getWorldPosition(v3());
  const body = ctx.meshes.body, R = restOf(body), P = R.P;
  const hb = new THREE.Box3();
  for (let i = 0; i < P.length; i += 3) {
    w.set(P[i], P[i + 1], P[i + 2]);
    if (w.y > J.Neck.y + 0.03 && Math.hypot(w.x - J.Head.x, w.z - J.Head.z) < 0.26) hb.expandByPoint(w);
  }
  let eye = v3(J.Head.x, J.Head.y + 0.06, hb.max.z - 0.02);
  if (ctx.meshes.eyes) {
    const E = restOf(ctx.meshes.eyes).P, b = new THREE.Box3();
    for (let i = 0; i < E.length; i += 3) b.expandByPoint(w.set(E[i], E[i + 1], E[i + 2]));
    eye = b.getCenter(v3()); eye.z = b.max.z; ctx.eyeW = (b.max.x - b.min.x) / 2;
  }
  const hc = hb.getCenter(v3());
  return { J, hb, hc, eye, top: hb.max.y, front: hb.max.z, back: hb.min.z, hw: (hb.max.x - hb.min.x) / 2, mouth: eye.y - 0.072, chin: eye.y - 0.112 };
}

/** aggancia un oggetto a un osso conservando la posa a riposo (posizione/rotazione nel sistema del personaggio) */
function attach(ctx, bone, obj, pos = v3(), rot = null) {
  const b = ctx.bones[bone] || ctx.bones.Spine2;
  b.updateWorldMatrix(true, false);
  const q = rot ? (rot.isQuaternion ? rot : new THREE.Quaternion().setFromEuler(rot)) : new THREE.Quaternion();
  const M = new THREE.Matrix4().compose(pos, q, v3(1, 1, 1));
  const L = b.matrixWorld.clone().invert().multiply(M);
  // i pezzi vengono uniti per osso e materiale alla fine (meno draw call)
  obj.matrixAutoUpdate = false; obj.matrix.copy(L); obj.updateMatrixWorld(true);
  obj.traverse(o => { if (o.isMesh) ctx.parts.push({ bone: b, geo: o.geometry, mat: o.material, M: o.matrixWorld.clone(), name: o.name }); });
  return obj;
}
function flushParts(ctx) {
  const groups = new Map();
  for (const p of ctx.parts) { const k = p.bone.uuid + '|' + p.mat.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  for (const list of groups.values()) {
    const geos = list.map(p => {
      const g = p.geo.clone(); g.applyMatrix4(p.M);
      if (!g.attributes.aRest) rigid(g);
      return g;
    });
    const g = mergeG(geos);
    const bi = BODY.skeleton.bones.indexOf(list[0].bone);
    if (bi < 0) { g.computeBoundingSphere(); const o = new THREE.Mesh(g, list[0].mat); o.name = 'cos_' + list[0].name; list[0].bone.add(o); continue; }
    // pezzo rigido → SkinnedMesh legata a un solo osso (così si unisce ai gusci con lo stesso materiale: meno draw call)
    const sk = BODY.skeleton;
    const Mb = new THREE.Matrix4().multiplyMatrices(BODY.matrixWorld, BODY.bindMatrixInverse)
      .multiply(new THREE.Matrix4().multiplyMatrices(list[0].bone.matrixWorld, sk.boneInverses[bi])).multiply(BODY.bindMatrix);
    const inv = Mb.clone().invert().multiply(list[0].bone.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(inv), n = g.attributes.position.count;
    g.attributes.position.applyMatrix4(inv); g.attributes.normal.applyNormalMatrix(nm);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aCut', new THREE.BufferAttribute(new Float32Array(n).fill(-1), 1));
    g.setIndex([...Array(n).keys()]);
    const o = new THREE.SkinnedMesh(g, list[0].mat); o.name = 'cos_' + list[0].name;
    o.matrix.copy(BODY.matrix); o.matrix.decompose(o.position, o.quaternion, o.scale);
    ROOT.add(o); o.bind(sk, BODY.bindMatrix);
  }
  ctx.parts = [];
  // gusci con lo stesso materiale (stesso scheletro e trasformazione) → una sola SkinnedMesh
  const sk = new Map();
  ROOT.traverse(o => {
    if (!o.isSkinnedMesh || !o.name.startsWith('cos_')) return;
    const key = o.material.uuid + '|' + o.skeleton.uuid + '|' + o.parent.uuid + '|' + o.matrix.elements.map(x => x.toFixed(5)).join(',') + '|' + o.bindMatrix.elements.map(x => x.toFixed(5)).join(',');
    if (!sk.has(key)) sk.set(key, []); sk.get(key).push(o);
  });
  for (const list of sk.values()) {
    if (list.length < 2) continue;
    const names = Object.keys(list[0].geometry.attributes);
    if (!list.every(o => names.every(n => o.geometry.attributes[n]))) continue;
    const g = new THREE.BufferGeometry(), idx = []; let off = 0;
    for (const n of names) {
      const A0 = list[0].geometry.attributes[n], tot = list.reduce((a, o) => a + o.geometry.attributes[n].array.length, 0);
      const arr = new A0.array.constructor(tot); let o2 = 0;
      for (const o of list) { arr.set(o.geometry.attributes[n].array, o2); o2 += o.geometry.attributes[n].array.length; }
      g.setAttribute(n, new THREE.BufferAttribute(arr, A0.itemSize));
    }
    for (const o of list) { const I = o.geometry.index.array; for (let i = 0; i < I.length; i++) idx.push(I[i] + off); off += o.geometry.attributes.position.count; }
    g.setIndex(idx);
    const keep = list[0]; keep.geometry.dispose(); keep.geometry = g;
    for (const o of list.slice(1)) { o.removeFromParent(); o.geometry.dispose(); }
  }
}
/** superficie della schiena (z minima del corpo + vestiti) alla quota y, entro |x - x0| < xr */
function backAt(y, x0 = 0, xr = 0.06, dy = 0.03) {
  let z = Infinity;
  for (const m of [BODY, ...CLOTH]) {
    const P = restOf(m).P;
    for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - y) < dy && Math.abs(P[i] - x0) < xr && P[i + 2] < z) z = P[i + 2];
  }
  return z;
}
const mesh = (g, m, name) => { const o = new THREE.Mesh(g, m); o.name = 'cos_' + name; return o; };
const hideMesh = (ctx, part) => { for (const k of Object.keys(ctx.meshes)) if (k.includes(part)) { ctx.meshes[k].removeFromParent(); delete ctx.meshes[k]; } };
const meshBy = (ctx, part) => { const k = Object.keys(ctx.meshes).find(k => k.includes(part)); return k ? ctx.meshes[k] : null; };

// ═════════ armi e accessori ═════════
/** katana nel fodero: lunghezza totale L, lungo l'asse +y locale (manico in alto) */
function katana(L = 1.0, sayaMat = MAT.saya()) {
  const g = new THREE.Group(), blade = L * 0.72, hilt = L * 0.26;
  const saya = taper([v3(0, 0, 0), v3(0, blade * 0.5, 0.006), v3(0, blade, 0.018)], (t) => 0.014 + (1 - t) * 0.002 - (t < 0.04 ? 0.004 : 0), 16, 8, { sx: 1.45, sy: 0.75 });
  g.add(mesh(saya, sayaMat, 'saya'));
  const tsuba = rigid(new THREE.CylinderGeometry(0.038, 0.038, 0.008, 18).translate(0, blade + 0.004, 0.018));
  g.add(mesh(tsuba, MAT.steel('#2a2622', 't'), 'tsuba'));
  const tsuka = taper([v3(0, blade + 0.008, 0.018), v3(0, blade + hilt * 0.5, 0.024), v3(0, blade + hilt, 0.03)], () => 0.013, 10, 8, { sx: 1.3, sy: 0.9, along: true });
  g.add(mesh(tsuka, MAT.tsuka(), 'tsuka'));
  const kashira = rigid(new THREE.SphereGeometry(0.016, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.6, 0.9).translate(0, blade + hilt, 0.03));
  g.add(mesh(kashira, MAT.steel('#2a2622', 't'), 'kashira'));
  return g;
}
/** spada medievale nel fodero (asse +y, elsa in alto) */
function longsword(L = 1.05, grip = MAT.leather('#3a2414'), metal = MAT.gold()) {
  const g = new THREE.Group(), blade = L * 0.75;
  g.add(mesh(taper([v3(0, 0, 0), v3(0, blade, 0)], (t) => (t < 0.06 ? 0.012 + t * 0.2 : 0.024), 8, 8, { sx: 1.6, sy: 0.55 }), MAT.leather('#2a1810'), 'fodero'));
  g.add(mesh(taper([v3(-0.11, blade + 0.01, 0), v3(0, blade + 0.016, 0), v3(0.11, blade + 0.01, 0)], (t) => 0.009 + Math.abs(t - 0.5) * 0.006, 12, 8), metal, 'guardia'));
  g.add(mesh(taper([v3(0, blade + 0.02, 0), v3(0, blade + 0.2, 0)], () => 0.013, 6, 8, { along: true }), grip, 'impugnatura'));
  g.add(mesh(rigid(new THREE.SphereGeometry(0.024, 12, 8).scale(1, 1, 0.6).translate(0, blade + 0.22, 0)), metal, 'pomolo'));
  return g;
}

/** spada appesa al fianco: guardia in `guard`, il fodero scende inclinato all'indietro di `back` rad e in fuori di `out` */
function hangSword(ctx, sw, blade, guard, back, out) {
  const dir = v3(-out, 1, Math.tan(back)).normalize();                     // dal puntale verso l'elsa
  const tip = guard.clone().addScaledVector(dir, -blade);
  return attach(ctx, 'Hips', sw, tip, new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir));
}

// ═════════ costumi ═════════
const COSTUMES = {
  // ── Drago Rosso: pelle a scaglie, muso, corna all'indietro, ali membranose, coda con punta a freccia ──
  drago(ctx, M) {
    hideMesh(ctx, 'horns');
    for (const k of Object.keys(ctx.meshes)) {
      const o = ctx.meshes[k];
      if (k === 'body' || k.includes('suit') || k.includes('boots')) { addRest(o); o.material = MAT.dragonSkin(); }
    }
    if (ctx.meshes.eyes) { addRest(ctx.meshes.eyes); ctx.meshes.eyes.material = pmat('dragonEye', { code: `
        float d = abs(p.x) - ${f4(ctx.eyeW * 0.5)}; float slit = smoothstep(0.0025, 0.0045, abs(p.x - sign(p.x) * ${f4(ctx.eyeW * 0.5)}));
        col = mix(vec3(0.05, 0.02, 0.0), vec3(1.0, 0.62, 0.05), slit); EMI = vec3(1.0, 0.45, 0.02) * slit * 0.9; RGH = 0.1;` }, ctx.meshes.eyes.material); }
    for (const k of ['eyebrow', 'eyelash']) hideMesh(ctx, k);
    // muso: la parte bassa della faccia si allunga in avanti, la fronte forma due arcate sopra gli occhi
    const E = M.eye, body = ctx.meshes.body;
    const ex = (ctx.eyeW || 0.032) * 0.5;
    const holes = `CLIP = p.z > ${f4(E.z - 0.04)} && min(length(vec2((p.x - ${f4(ex)}) / 0.019, (p.y - ${f4(E.y)}) / 0.011)), length(vec2((p.x + ${f4(ex)}) / 0.019, (p.y - ${f4(E.y)}) / 0.011))) < 1.0;`;
    shell(body, 'muso', MAT.dragonSkin(null, holes, 'dragonMuzzle'), {
      sel: (p) => p.y > M.chin - 0.03 && p.y < E.y + 0.05 && p.z > M.hc.z - 0.01 && Math.abs(p.x) < 0.09,
      disp: (p, n) => {
        const fx = Math.max(0, 1 - Math.pow(Math.abs(p.x) / 0.07, 2));
        const fy = Math.max(0, 1 - Math.pow((p.y - (E.y - 0.05)) / 0.065, 2));
        const front = THREE.MathUtils.smoothstep(p.z, M.hc.z, M.front);
        const snout = 0.095 * fx * fy * front;
        const brow = 0.012 * Math.max(0, 1 - Math.pow((p.y - (E.y + 0.025)) / 0.015, 2)) * THREE.MathUtils.smoothstep(Math.abs(p.x), 0.0, 0.03) * front;
        return v3(p.x * 0.15 * fx * fy * front, -snout * 0.18, snout).addScaledVector(n, 0.004 + brow);
      },
    });
    // corna principali (all'indietro e verso l'alto) e corna minori sulle guance
    const hm = MAT.dragonHorn();
    for (const s of [-1, 1]) {
      const b = v3(M.hc.x + s * 0.05, M.top - 0.035, M.hc.z - 0.01);
      const pts = [b, b.clone().add(v3(s * 0.03, 0.05, -0.06)), b.clone().add(v3(s * 0.055, 0.085, -0.15)), b.clone().add(v3(s * 0.06, 0.08, -0.25)), b.clone().add(v3(s * 0.05, 0.05, -0.31))];
      attach(ctx, 'Head', mesh(taper(pts, (t) => 0.026 * (1 - t) + 0.002, 26, 12, { along: true }), hm, 'corno'));
      for (let i = 0; i < 3; i++) {
        const c = v3(M.hc.x + s * (M.hw - 0.005), E.y - 0.02 - i * 0.022, M.hc.z - 0.02 - i * 0.02);
        attach(ctx, 'Head', mesh(taper([c, c.clone().add(v3(s * 0.035, 0.012, -0.045))], (t) => 0.009 * (1 - t) + 0.001, 6, 8, { along: true }), hm, 'spina'));
      }
    }
    // cresta di spine lungo la schiena (dalla nuca al bacino)
    const sp = [['Head', M.hc.y - 0.02, M.back + 0.01, 0.035], ['Neck', M.J.Neck.y, M.J.Neck.z - 0.06, 0.04], ['Spine2', M.J.Spine2.y + 0.06, M.J.Spine2.z - 0.13, 0.055], ['Spine2', M.J.Spine2.y - 0.05, M.J.Spine2.z - 0.135, 0.06], ['Spine1', M.J.Spine1.y, M.J.Spine1.z - 0.13, 0.055], ['Spine', M.J.Spine.y, M.J.Spine.z - 0.12, 0.045], ['Hips', M.J.Hips.y - 0.01, M.J.Hips.z - 0.12, 0.035]];
    for (const [bn, y, z, h] of sp) {
      const c = v3(0, y, z);
      attach(ctx, bn, mesh(taper([c, c.clone().add(v3(0, h * 0.35, -h)), c.clone().add(v3(0, h * 0.25, -h * 1.15))], (t) => h * 0.32 * (1 - t) + 0.001, 6, 8, { sx: 0.45, sy: 1.6, along: true }), hm, 'spina'));
    }
    // ali: ossa (braccio, avambraccio, dita) e membrana tesa a festoni fra le dita
    const root = v3(0, M.J.Spine2.y + 0.07, M.J.Spine2.z - 0.12);
    for (const s of [-1, 1]) {
      const W = (x, y, z) => root.clone().add(v3(s * x, y, -z));
      const sh = W(0.07, 0.02, 0.02), el = W(0.34, 0.22, 0.2), wr = W(0.6, 0.42, 0.34);
      const tips = [W(1.12, 0.3, 0.52), W(1.02, -0.06, 0.55), W(0.8, -0.38, 0.5), W(0.46, -0.55, 0.38)];
      const low = W(0.1, -0.42, 0.06);
      const bm = MAT.wingBone();
      attach(ctx, 'Spine2', mesh(taper([sh, el.clone().lerp(sh, 0.5).add(v3(0, 0.02, 0)), el], (t) => 0.024 - t * 0.006, 10, 10), bm, 'ala'));
      attach(ctx, 'Spine2', mesh(taper([el, wr], (t) => 0.018 - t * 0.006, 8, 10), bm, 'ala'));
      for (const tp of tips) attach(ctx, 'Spine2', mesh(taper([wr, wr.clone().lerp(tp, 0.5).add(v3(0, 0.03, -0.02)), tp], (t) => 0.011 * (1 - t) + 0.002, 14, 8), bm, 'dito'));
      // artiglio sul polso dell'ala
      attach(ctx, 'Spine2', mesh(taper([wr, wr.clone().add(v3(s * 0.02, 0.07, 0.01)), wr.clone().add(v3(s * 0.04, 0.09, 0.03))], (t) => 0.012 * (1 - t) + 0.001, 8, 8, { along: true }), hm, 'artiglio'));
      // membrana: pannelli fra polso e punte (bordo a festoni) + pannello fra corpo, gomito e ultimo dito
      const panels = [];
      const panel = (A, B, C, sc = 0.2) => surf((u, v) => {
        const e = B.clone().lerp(C, v); e.lerp(A, sc * Math.sin(Math.PI * v));
        const q = A.clone().lerp(e, u); q.z -= 0.035 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        return [q.x, q.y, q.z];
      }, 8, 10, false);
      for (let i = 0; i + 1 < tips.length; i++) panels.push(panel(wr, tips[i], tips[i + 1]));
      panels.push(panel(wr, tips[tips.length - 1], low, 0.16));
      panels.push(surf((u, v) => { const a = sh.clone().lerp(el, u).lerp(wr, u * u * 0.0); const b = low.clone().lerp(wr, u); const q = a.lerp(b, v); q.z -= 0.025 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v); return [q.x, q.y, q.z]; }, 8, 6, false));
      const memb = mergeG(panels);
      // coordinate per le venature: x = angolo attorno al polso, y = distanza relativa
      const P = memb.attributes.position, R = memb.attributes.aRest;
      for (let i = 0; i < P.count; i++) {
        const dx = (P.getX(i) - wr.x) * s, dy = P.getY(i) - wr.y, d = Math.hypot(dx, dy, P.getZ(i) - wr.z);
        R.setXYZ(i, Math.atan2(dy, dx) / Math.PI, Math.min(1, d / 0.62), P.getZ(i));
      }
      attach(ctx, 'Spine2', mesh(memb, MAT.membrane(), 'membrana'));
    }
    // coda: grossa alla base, scende a terra e si arriccia, punta a freccia e spine sul dorso
    const H0 = M.J.Hips;
    const tp = [v3(0, H0.y - 0.04, H0.z - 0.1), v3(0, H0.y - 0.2, H0.z - 0.34), v3(0.06, H0.y - 0.55, H0.z - 0.62), v3(0.18, 0.2, H0.z - 0.92), v3(0.38, 0.1, H0.z - 1.08), v3(0.56, 0.12, H0.z - 1.0)];
    const tg = taper(tp, (t) => 0.09 * Math.pow(1 - t, 1.25) + 0.01, 40, 14);
    attach(ctx, 'Hips', mesh(tg, MAT.dragonSkin(), 'coda'));
    const curve = new THREE.CatmullRomCurve3(tp, false, 'centripetal');
    for (let i = 1; i < 12; i++) {
      const t = i / 13, c = curve.getPointAt(t), tan = curve.getTangentAt(t), r = 0.09 * Math.pow(1 - t, 1.25) + 0.01;
      const up = v3(0, 1, 0).addScaledVector(tan, -tan.y).normalize();
      const b = c.clone().addScaledVector(up, r * 0.85), h = 0.055 * (1 - t) + 0.015;
      attach(ctx, 'Hips', mesh(taper([b, b.clone().addScaledVector(up, h).addScaledVector(tan, h * 0.6)], (q) => h * 0.45 * (1 - q) + 0.001, 4, 6, { sx: 0.35, sy: 1.4, along: true }), hm, 'spina'));
    }
    {
      const c = curve.getPointAt(1), tan = curve.getTangentAt(1);
      const sh2 = new THREE.Shape(); sh2.moveTo(0, -0.01); sh2.quadraticCurveTo(0.07, 0.02, 0.0, 0.13); sh2.quadraticCurveTo(-0.07, 0.02, 0, -0.01);
      const g = rigid(new THREE.ExtrudeGeometry(sh2, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -0.006));
      const o = mesh(g, MAT.dragonSkin(), 'punta');
      const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), tan).multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI / 2));
      attach(ctx, 'Hips', o, c.clone().addScaledVector(tan, -0.02), q);
    }
  },

  // ── Ninja Ombra: cappuccio con la fessura per gli occhi, maschera sul viso, fascia, katana sulla schiena ──
  ninja(ctx, M) {
    const body = ctx.meshes.body, E = M.eye, J = M.J;
    const neckY = J.Neck.y - 0.05;
    // v31: il corpo MakeHuman del ninja NON ha la nuca né la calotta (erano coperte dal cappuccio del modello):
    // il cappuccio nero si costruisce quindi anche sul cappuccio originale, altrimenti da dietro la testa è un buco
    const hood = meshBy(ctx, 'hood');
    let backZ = M.back, topY = M.top;
    shell(body, 'cappuccio', MAT.ninjaHood(E), { sel: (p) => p.y > neckY && Math.hypot(p.x - J.Neck.x, p.z - J.Neck.z) < 0.24, off: (p) => 0.007 + THREE.MathUtils.smoothstep(p.y, M.top - 0.06, M.top) * 0.006 });
    if (hood && hood.isSkinnedMesh) {
      const HP = restOf(hood).P;
      for (let i = 0; i < HP.length; i += 3) { backZ = Math.min(backZ, HP[i + 2]); topY = Math.max(topY, HP[i + 1]); }
      shell1(hood, 'cappuccio', MAT.ninjaHood(E), { off: () => 0.003 });
    }
    shell(body, 'maschera', MAT.ninjaMask(E), { sel: (p) => p.y > M.chin - 0.04 && p.y < E.y - 0.012 && Math.hypot(p.x - J.Neck.x, p.z - J.Neck.z) < 0.24 && p.y > neckY + 0.02, off: () => 0.0115 });
    hideMesh(ctx, 'mask'); hideMesh(ctx, 'hood');
    // nodo della maschera dietro la testa, con le due code
    const kn = v3(0, E.y - 0.03, backZ - 0.006);
    attach(ctx, 'Head', mesh(rigid(new THREE.SphereGeometry(0.02, 10, 8).scale(1.4, 0.9, 0.7).translate(kn.x, kn.y, kn.z)), MAT.ninjaCloth(), 'nodo'));
    for (const s of [-1, 1]) {
      const a = kn.clone().add(v3(s * 0.01, -0.01, -0.005));
      attach(ctx, 'Head', mesh(taper([a, a.clone().add(v3(s * 0.025, -0.08, -0.03)), a.clone().add(v3(s * 0.03, -0.2, -0.045))], (t) => 0.014 - t * 0.004, 10, 6, { sx: 1, sy: 0.18 }), MAT.ninjaCloth(), 'coda'));
    }
    // fascia rossa in vita con il nodo sul fianco
    const hy = J.Hips.y;
    shell(body, 'fascia', MAT.sash('#7a1018'), { sel: (p, n, b) => !isArm(b) && p.y > hy + 0.015 && p.y < hy + 0.105, off: () => 0.022, edge: (p) => Math.min(p.y - hy - 0.015, hy + 0.105 - p.y) });
    attach(ctx, 'Hips', mesh(rigid(new THREE.SphereGeometry(0.03, 10, 8).scale(0.6, 1, 1.1).translate(-0.17, hy + 0.06, 0.02)), MAT.sash('#7a1018'), 'nodo'));
    for (const dz of [-0.02, 0.025]) attach(ctx, 'Hips', mesh(taper([v3(-0.175, hy + 0.05, 0.02 + dz), v3(-0.19, hy - 0.08, 0.03 + dz * 2), v3(-0.19, hy - 0.2, 0.03 + dz * 2.4)], (t) => 0.024, 8, 6, { sx: 0.18, sy: 1 }), MAT.sash('#7a1018'), 'coda'));
    // fasce su avambracci e polpacci
    for (const s of ['Left', 'Right']) {
      const a = J[s + 'ForeArm'], h = J[s + 'Hand'];
      if (a && h) shell(body, 'tekko', MAT.wraps('#24252b'), { sel: (p, n, b) => b === s + 'ForeArm' && p.y < a.y - 0.05, off: () => 0.012 });
      const k = J[s + 'Leg'], f = J[s + 'Foot'];
      if (k && f) shell(body, 'kyahan', MAT.wraps('#202126'), { sel: (p, n, b) => b === s + 'Leg' && p.y < k.y - 0.07 && p.y > f.y + 0.05, off: () => 0.016 });
    }
    // katana sulla schiena in diagonale (manico sopra la spalla destra) con la cinghia sul petto
    // v31: puntale vicino al fianco sinistro (+x), manico che spunta sopra la spalla destra (−x), appoggiata alla schiena
    {
      const S2 = J.Spine2, L = 0.9;
      const yT = hy + 0.06, yS = S2.y + 0.05;
      const zT = backAt(yT, S2.x + 0.1, 0.05), zS = backAt(yS, S2.x - 0.035, 0.05);
      const tip = v3(S2.x + 0.13, yT - 0.03, (isFinite(zT) ? zT : S2.z - 0.14) - 0.03);
      const mid = v3(S2.x - 0.035, yS, (isFinite(zS) ? zS : S2.z - 0.16) - 0.035);
      const top = tip.clone().add(mid.clone().sub(tip).normalize().multiplyScalar(L));
      const dir = top.clone().sub(tip).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir);
      attach(ctx, 'Spine2', katana(L, MAT.lacquer('#4a1218', 'n')), tip, q);   // fodero laccato rosso scuro: si vede sul vestito nero
    }
    const strap = pmat('ninjaStrap', { color: '#2a1c14', rough: 0.6, code: `CLIP = abs(p.x + (p.y - ${f4(J.Spine1.y)}) * 0.9) > 0.022; H = fbm(p * 140.0) * 0.0005;` });
    shell(body, 'cinghia', strap, { sel: (p, n, b) => !isArm(b) && p.y > hy && p.y < J.Neck.y && Math.abs(p.x + (p.y - J.Spine1.y) * 0.9) < 0.05, off: () => 0.016 });
  },

  // ── Samurai Cremisi: armatura a lamelle laccate, kabuto con mezzaluna d'oro, mempo, hakama e due spade ──
  samurai(ctx, M) {
    hideMesh(ctx, 'kimono'); hideMesh(ctx, 'ponytail'); hideMesh(ctx, 'beard');
    const body = ctx.meshes.body, E = M.eye, J = M.J, hy = J.Hips.y;
    const sx = J.LeftArm ? Math.abs(J.LeftArm.x) : 0.17;
    const crimson = '#8c1420';
    // kimono interno (busto e maniche) e hakama larghi
    const kn = J.LeftLeg ? J.LeftLeg.y : 0.5;
    shell(body, 'kimono', pmat('kimonoIn', { color: '#1c2333', rough: 0.85, code: 'H = cloth(p) * 1.3;' }), { sel: (p, n, b) => !/Hand|Leg|Foot|Toe|Head/.test(b) && p.y > hy - 0.05 && p.y < J.Neck.y - 0.02 && !(/ForeArm/.test(b) && J.LeftHand && p.y < J.LeftHand.y + 0.05), off: () => 0.012 });
    shell(body, 'hakama', MAT.hakama('#26272c'), { sel: (p, n, b) => /Hips|Leg|Spine$/.test(b) && p.y < hy + 0.06 && p.y > kn - 0.15, edge: (p) => p.y - (kn - 0.15), off: (p) => 0.02 + Math.pow(THREE.MathUtils.clamp((hy - p.y) / (hy - kn + 0.15), 0, 1), 1.5) * 0.07 });
    // do (corazza), kusazuri (falde), kote e suneate
    shell(body, 'do', MAT.lamellar(crimson), { sel: (p, n, b) => !isArm(b) && /Spine|Hips/.test(b) && p.y > hy + 0.02 && p.y < J.Neck.y - 0.07, off: () => 0.036 });
    shell(body, 'kusazuri', MAT.lamellar(crimson, 2), { sel: (p, n, b) => /Hips|UpLeg|Spine$/.test(b) && p.y < hy + 0.03 && p.y > hy - 0.27, off: (p) => 0.06 + (hy - p.y) * 0.25, edge: (p) => Math.min(p.y - (hy - 0.27), hy + 0.03 - p.y) });
    for (const s of ['Left', 'Right']) {
      const a = J[s + 'ForeArm'], h = J[s + 'Hand'], k = J[s + 'Leg'], f = J[s + 'Foot'];
      if (a && h) shell(body, 'kote', MAT.lamellar('#1a1a1e', 3), { sel: (p, n, b) => (b === s + 'ForeArm' && p.y < a.y - 0.03) || b === s + 'Hand', off: (p, n, b) => (b === s + 'Hand' ? 0.008 : 0.02) });
      if (k && f) shell(body, 'suneate', MAT.kabuto(), { sel: (p, n, b) => b === s + 'Leg' && p.y < k.y - 0.12 && p.y > f.y + 0.05, off: () => 0.03 });
    }
    // sode: grandi spallacci a lamelle appesi alle spalle
    for (const s of [-1, 1]) {
      const sideB = s > 0 ? 'LeftArm' : 'RightArm', A = J[sideB]; if (!A) continue;
      const g = surf((u, v) => { const a = (u - 0.5) * 1.5; const r = 0.13 + v * 0.02; return [A.x + s * (0.02 + Math.cos(a) * r * 0.55), A.y + 0.03 - v * 0.24, A.z + Math.sin(a) * r * 0.9]; }, 10, 6, false);
      const R = g.attributes.aRest, P = g.attributes.position;
      for (let i = 0; i < P.count; i++) R.setXYZ(i, P.getZ(i) * 2.5, P.getY(i), 0);
      attach(ctx, sideB, mesh(g, MAT.lamellar(crimson, 1), 'sode'));
    }
    // kabuto: coppa a costole con rivetti, shikoro a tre giri, fukigaeshi, visiera e mezzaluna d'oro
    shell(body, 'kabuto', MAT.kabuto(), { sel: (p) => p.y > E.y + 0.03 && Math.hypot(p.x - J.Neck.x, p.z - J.Neck.z) < 0.24, off: (p) => 0.03 + (p.y - E.y) * 0.08 });
    const hc = M.hc, rimY = E.y + 0.035, R0 = M.hw + 0.035;
    // v31: shikoro aperto davanti (prima copriva la faccia e lasciava scoperta la nuca)
    for (let tier = 0; tier < 3; tier++) {
      const g = surf((u, v) => { const a = Math.PI * 0.24 + u * Math.PI * 1.52; const r = R0 + 0.012 + tier * 0.02 + v * 0.05; const y = rimY - tier * 0.045 - v * 0.05; return [hc.x + Math.sin(a) * r, y, hc.z - 0.005 + Math.cos(a) * r * 1.08]; }, 24, 3, false);
      const P = g.attributes.position, Rr = g.attributes.aRest;
      for (let i = 0; i < P.count; i++) Rr.setXYZ(i, Math.atan2(P.getX(i) - hc.x, -(P.getZ(i) - hc.z)) * 1.2, P.getY(i), 0);
      attach(ctx, 'Head', mesh(g, MAT.lamellar(crimson, 1), 'shikoro'));
    }
    for (const s of [-1, 1]) {
      const g = surf((u, v) => [hc.x + s * (R0 + 0.01 + u * 0.05), rimY - 0.01 - v * 0.07, M.front - 0.06 - u * 0.04 + v * 0.01], 3, 3, false);
      attach(ctx, 'Head', mesh(g, MAT.lacquer(crimson, 'f'), 'fukigaeshi'));
    }
    attach(ctx, 'Head', mesh(surf((u, v) => { const a = (u - 0.5) * 2.2; return [hc.x + Math.sin(a) * (R0 + v * 0.04), rimY + 0.005 - v * 0.012, hc.z + Math.cos(a) * (M.front - hc.z + 0.03 + v * 0.04)]; }, 16, 2, false), MAT.kabuto(), 'visiera'));
    {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.bezierCurveTo(0.08, 0.02, 0.17, 0.09, 0.21, 0.2); sh.bezierCurveTo(0.14, 0.11, 0.06, 0.06, 0, 0.05);
      sh.bezierCurveTo(-0.06, 0.06, -0.14, 0.11, -0.21, 0.2); sh.bezierCurveTo(-0.17, 0.09, -0.08, 0.02, 0, 0);
      const g = rigid(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 12 }));
      attach(ctx, 'Head', mesh(g, MAT.gold(), 'maedate'), v3(hc.x, rimY + 0.03, M.front + 0.012), new THREE.Euler(-0.25, 0, 0));
    }
    // mempo (maschera sulla bocca) laccata
    shell(body, 'mempo', MAT.lacquer('#3a0a0e', 'm'), { sel: (p) => p.y > M.chin - 0.03 && p.y < E.y - 0.038 && p.z > hc.z && Math.abs(p.x) < 0.075, off: (p) => 0.012 + Math.max(0, 1 - Math.abs(p.x) / 0.03) * 0.004 });
    // katana e wakizashi al fianco sinistro
    // v31: infilate nell'obi sul fianco sinistro (+x): tsuba davanti al fianco, fodero che scende all'indietro
    const sideSword = (L, guard, up, out) => {
      const dir = v3(-out, Math.sin(up), Math.cos(up)).normalize();          // dal puntale verso il manico
      const tip = guard.clone().addScaledVector(dir, -L * 0.72);
      attach(ctx, 'Hips', katana(L), tip, new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir));
    };
    sideSword(0.98, v3(0.255, hy + 0.05, J.Hips.z + 0.1), 0.42, 0.12);
    sideSword(0.66, v3(0.225, hy + 0.08, J.Hips.z + 0.12), 0.36, 0.08);
  },

  // ── Cavaliere d'Oro: armatura completa a piastre dorate su cotta di maglia, elmo con pennacchio, mantello e spada ──
  cavaliere(ctx, M) {
    for (const k of ['helmet', 'short04', 'beard', 'boots', 'eyebrow', 'eyelash']) hideMesh(ctx, k);
    const body = ctx.meshes.body, E = M.eye, J = M.J, hy = J.Hips.y;
    const uni = meshBy(ctx, 'uniform');
    if (uni) { addRest(uni); uni.material = MAT.mail(); }
    addRest(body);
    // un solo guscio d'oro con spessori diversi per pezzo; nelle giunture (gomiti, ginocchia, vita, collo) resta la maglia
    const sx = J.LeftArm ? Math.abs(J.LeftArm.x) : 0.17;
    const el = J.LeftForeArm, kn = J.LeftLeg, wr = J.LeftHand, an = J.LeftFoot;
    const zone = (p, n, b) => {
      if (/Head|Neck/.test(b) || p.y > J.Neck.y) return 'helm';
      if (/Hand/.test(b)) return 'hand';
      if (/ForeArm/.test(b)) return Math.abs(p.y - el.y) < 0.045 ? 'couter' : 'vamb';
      if (/Arm|Shoulder/.test(b)) return (p.y > J.LeftArm.y - 0.09 && Math.abs(p.x) > sx - 0.06) ? 'pauldron' : (/Shoulder/.test(b) ? 'chest' : (Math.abs(p.y - el.y) < 0.045 ? 'couter' : 'rere'));
      if (/Foot|Toe/.test(b)) return 'sabaton';
      if (/UpLeg/.test(b)) return Math.abs(p.y - kn.y) < 0.05 ? 'poleyn' : (p.y > hy - 0.04 ? 'fauld' : 'cuisse');
      if (/Leg/.test(b)) return Math.abs(p.y - kn.y) < 0.05 ? 'poleyn' : (p.y < an.y + 0.04 ? 'sabaton' : 'greave');
      return p.y > hy + 0.1 ? 'chest' : 'fauld';
    };
    const OFF = { helm: 0.024, pauldron: 0.055, couter: 0.03, rere: 0.022, vamb: 0.022, hand: 0.009, chest: 0.034, fauld: 0.04, poleyn: 0.036, cuisse: 0.026, greave: 0.026, sabaton: 0.014 };
    const gaps = `
      float ax = abs(p.x); float LAMES = 0.0;
      // fessura e fori dell'elmo
      vec2 sl = vec2(p.x / 0.07, (p.y - ${f4(E.y)}) / 0.0065);
      bool slit = n.z > 0.2 && p.z > ${f4(E.z - 0.05)} && (pow(abs(sl.x), 6.0) + pow(abs(sl.y), 2.0)) < 1.0;
      vec2 hf = vec2(fract((p.x - 0.02) / 0.012) - 0.5, fract((p.y - ${f4(E.y - 0.05)}) / 0.012) - 0.5);
      bool holes = p.x > 0.02 && p.x < 0.06 && p.y < ${f4(E.y - 0.025)} && p.y > ${f4(E.y - 0.075)} && n.z > 0.3 && length(hf) < 0.22;
      // giunture
      bool arm = vK > 0.5 && vK < 1.5, leg = vK > 1.5;
      bool neck = !arm && !leg && p.y > ${f4(J.Neck.y - 0.035)} && p.y < ${f4(J.Neck.y - 0.012)};
      bool waist = !arm && !leg && abs(p.y - ${f4(hy + 0.1)}) < 0.007;
      bool armJ = arm && (abs(abs(p.y - ${f4(el.y)}) - 0.045) < 0.007 || abs(p.y - ${f4(wr.y + 0.006)}) < 0.006);
      bool legJ = leg && (abs(abs(p.y - ${f4(kn.y)}) - 0.05) < 0.008 || abs(p.y - ${f4(an.y + 0.04)}) < 0.006);
      CLIP = slit || holes || neck || waist || armJ || legJ;
      if (!arm && p.y > ${f4(hy - 0.04)} && p.y < ${f4(hy + 0.1)}) LAMES = 1.0;
      if (arm && p.y > ${f4(J.LeftArm.y - 0.09)}) LAMES = 1.0;
      if (leg && p.y < ${f4(an.y + 0.04)}) LAMES = 1.0;
      // bordi ribattuti scuri attorno a fessura e piastre
      col *= 1.0 - (1.0 - smoothstep(0.0, 0.004, abs(abs(p.y - ${f4(E.y)}) - 0.0075))) * step(0.2, n.z) * step(${f4(E.z - 0.05)}, p.z) * step(abs(p.x), 0.075) * 0.5;`;
    // elmo chiuso: la testa viene "gonfiata" su un ellissoide liscio (niente faccia d'oro con naso e labbra)
    const hcy = (M.top + M.chin) / 2 - 0.012, er = v3(M.hw + 0.03, (M.top - M.chin) / 2 + 0.04, (M.front - M.back) / 2 + 0.03);
    const hcz = (M.front + M.back) / 2 + 0.008;
    const disp = (p, n, b) => {
      const z = zone(p, n, b);
      if (z === 'helm') {
        const d = v3((p.x - M.hc.x) / er.x, (p.y - hcy) / er.y, (p.z - hcz) / er.z), L = d.length();
        if (L < 1 && L > 1e-4) { d.divideScalar(L); return v3(M.hc.x + d.x * er.x, hcy + d.y * er.y, hcz + d.z * er.z).sub(p).addScaledVector(n, 0.004); }
      }
      return n.clone().multiplyScalar(OFF[z]);
    };
    shell(body, 'armatura', MAT.plateGold(gaps), { disp, k: (p, n, b) => (isArm(b) && !/Shoulder/.test(b) ? 1 : isLeg(b) ? 2 : 0) });
    // pennacchio rosso sull'elmo
    const top = v3(M.hc.x, M.top + 0.02, M.hc.z);
    attach(ctx, 'Head', mesh(taper([top.clone().add(v3(0, -0.01, 0.02)), top.clone().add(v3(0, 0.03, 0.01))], (t) => 0.012, 4, 8), MAT.gold(), 'portapiume'));
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 0.9, L = 0.26 + Math.cos(a * 2) * 0.05;
      const b = top.clone().add(v3(0, 0.03, 0.01));
      const pts = [b, b.clone().add(v3(Math.sin(a) * 0.05, 0.1, -0.03)), b.clone().add(v3(Math.sin(a) * 0.11, 0.12, -L * 0.6)), b.clone().add(v3(Math.sin(a) * 0.15, 0.02, -L))];
      attach(ctx, 'Head', mesh(taper(pts, (t) => 0.022 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.002, 12, 6, { sx: 1, sy: 0.15 }), MAT.plume('#a3122a'), 'piuma'));
    }
    // mantello rosso dalle spalle ai polpacci
    const S2 = J.Spine2;
    const capeG = surf((u, v) => {
      const w = 0.2 + v * 0.18, x = (u - 0.5) * 2 * w, y = J.Neck.y - 0.06 - v * 0.98;
      const z = S2.z - 0.15 - v * 0.14 - Math.cos((u - 0.5) * Math.PI) * 0.05 * (1 - v * 0.4) + Math.sin(u * Math.PI * 6) * 0.018 * v;
      return [x, y, z];
    }, 18, 12, false);
    attach(ctx, 'Spine2', mesh(capeG, MAT.cape('#8e0f22'), 'mantello'));
    // spada al fianco
    // v31: guardia alla cintura sul fianco sinistro, fodero che scende verso il polpaccio inclinato all'indietro
    hangSword(ctx, longsword(1.05), 1.05 * 0.75, v3(0.235, hy + 0.02, J.Hips.z + 0.05), 0.36, 0.1);
  },

  // ── Astronauta: casco rigido bianco con visiera dorata a specchio, zaino PLSS e pannello sul petto ──
  astro(ctx, M) {
    hideMesh(ctx, 'bob');
    const J = M.J, hc = M.hc;
    const C = v3(hc.x, (M.top + M.chin) / 2 + 0.01, hc.z + 0.012), R = Math.max(0.155, (M.top - M.chin) / 2 + 0.05);
    const shellG = rigid(new THREE.SphereGeometry(R, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.78).translate(C.x, C.y, C.z));
    // apertura frontale: il guscio bianco lascia il posto alla visiera
    const P = shellG.attributes.position, keep = [];
    const ix = shellG.index.array;
    for (let t = 0; t < ix.length; t += 3) {
      let front = 0;
      for (let k = 0; k < 3; k++) { const i = ix[t + k]; const dz = P.getZ(i) - C.z, dy = P.getY(i) - C.y, dx = P.getX(i) - C.x; if (dz > R * 0.35 && dy < R * 0.55 && dy > -R * 0.55 && Math.abs(dx) < R * 0.82) front++; }
      if (front < 3) keep.push(ix[t], ix[t + 1], ix[t + 2]);
    }
    shellG.setIndex(keep);
    attach(ctx, 'Head', mesh(shellG, MAT.suitWhite(), 'casco'));
    const vis = rigid(new THREE.SphereGeometry(R - 0.004, 40, 24, -Math.PI * 0.38 + Math.PI / 2, Math.PI * 0.76, Math.PI * 0.27, Math.PI * 0.5).rotateY(-Math.PI / 2).rotateY(Math.PI / 2).translate(C.x, C.y, C.z));
    attach(ctx, 'Head', mesh(vis, MAT.visorGold(), 'visiera'));
    attach(ctx, 'Head', mesh(rigid(new THREE.TorusGeometry(R * 0.66, 0.018, 10, 32).rotateX(Math.PI / 2).translate(C.x, C.y - R * 0.76, C.z - 0.005)), MAT.alu(), 'anello'));
    for (const s of [-1, 1]) {
      attach(ctx, 'Head', mesh(rigid(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 14).rotateX(Math.PI / 2).translate(C.x + s * (R + 0.012), C.y + 0.04, C.z + 0.02)), MAT.alu(), 'luce'));
      attach(ctx, 'Head', mesh(rigid(new THREE.CircleGeometry(0.014, 14).translate(C.x + s * (R + 0.012), C.y + 0.04, C.z + 0.051)), pmat('lamp', { color: '#fff8e0', code: 'EMI = vec3(1.2, 1.15, 1.0);' }), 'luce'));
    }
    // zaino PLSS con tubi verso il petto
    const S2 = J.Spine2;
    const bp = rigid(new THREE.BoxGeometry(0.36, 0.48, 0.17, 4, 6, 2));
    { const p = bp.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = 0.03; const cx = Math.sign(x) * Math.max(0, Math.abs(x) - (0.18 - r)), cz = Math.sign(z) * Math.max(0, Math.abs(z) - (0.085 - r)); const l = Math.hypot(cx, cz); if (l > r) { p.setX(i, x - cx + cx / l * r); p.setZ(i, z - cz + cz / l * r); } } bp.computeVertexNormals(); bp.setAttribute('aRN', bp.attributes.normal.clone()); }
    attach(ctx, 'Spine2', mesh(bp, MAT.suitWhite(), 'zaino'), v3(0, S2.y - 0.02, S2.z - 0.24));
    const chest = rigid(new THREE.BoxGeometry(0.2, 0.1, 0.06));
    attach(ctx, 'Spine2', mesh(chest, MAT.suitWhite(), 'pannello'), v3(0, S2.y - 0.06, S2.z + 0.15));
    for (let i = 0; i < 4; i++) attach(ctx, 'Spine2', mesh(rigid(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 10).rotateX(Math.PI / 2).translate(-0.06 + i * 0.04, S2.y - 0.05, S2.z + 0.185)), pmat('knob' + (i % 2), { color: i % 2 ? '#c03020' : '#2a5ab0', rough: 0.4 }), 'manopola'));
    for (const s of [-1, 1]) {
      const a = v3(s * 0.1, S2.y - 0.2, S2.z + 0.13), b = v3(s * 0.2, S2.y - 0.15, S2.z - 0.05), c = v3(s * 0.15, S2.y + 0.1, S2.z - 0.17);
      attach(ctx, 'Spine2', mesh(taper([a, b, c], () => 0.011, 16, 8), pmat('hose', { color: '#d8dce0', rough: 0.5, code: 'H = sin(p.y * 900.0 + p.x * 900.0) * 0.0003;' }), 'tubo'));
    }
  },

  // ── Agente Banana: costume da banana gigante con il buco per la faccia, picciolo in cima ──
  banana(ctx, M) {
    hideMesh(ctx, 'afro'); hideMesh(ctx, 'glasses');
    const J = M.J, E = M.eye, S2 = J.Spine2;
    const y0 = J.LeftLeg ? J.LeftLeg.y + 0.16 : 0.62, y1 = M.top + 0.2;
    const zc = S2.z - 0.01;
    // asse del frutto leggermente curvo in avanti in cima
    const axis = (t) => { const y = y0 + (y1 - y0) * t; return v3(0, y, zc + 0.05 * Math.sin(Math.PI * t) - 0.02 + Math.pow(t, 3) * 0.08); };
    const rad = (t) => {
      const yy = y0 + (y1 - y0) * t;
      let r = 0.23 + 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.4));
      if (yy > E.y - 0.12) r = THREE.MathUtils.lerp(r, 0.17, THREE.MathUtils.smoothstep(yy, E.y - 0.12, E.y));
      if (t > 0.86) r *= Math.max(0.12, 1 - Math.pow((t - 0.86) / 0.14, 1.6) * 0.88);
      return r;
    };
    const NU = 36, NV = 30;
    const pos = [], rest = [], idx = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const t = j / NV, a = i / NU * Math.PI * 2, c = axis(t);
      const r = rad(t) * (1 + 0.045 * Math.cos(5 * a)) * (Math.abs(Math.cos(a)) > 0.7 ? 1 : 1);
      pos.push(c.x + Math.sin(a) * r * 1.05, c.y, c.z + Math.cos(a) * r * 0.92);
      rest.push(t, i / NU, 0);
    }
    // buco per la faccia e per le braccia: niente triangoli in quelle zone
    const P = (i, j) => { const k = (j * (NU + 1) + i) * 3; return v3(pos[k], pos[k + 1], pos[k + 2]); };
    const hole = (p) => {
      const face = p.z > zc && Math.pow((p.x) / 0.085, 2) + Math.pow((p.y - (E.y - 0.03)) / 0.105, 2) < 1;
      let arm = false;
      for (const s of ['LeftArm', 'RightArm']) { const A = J[s]; if (A && Math.hypot(p.y - (A.y - 0.07), p.z - (A.z)) < 0.085 && Math.sign(p.x) === Math.sign(A.x)) arm = true; }
      return face || arm;
    };
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
      const ctr = P(i, j).add(P(i + 1, j + 1)).multiplyScalar(0.5);
      if (hole(ctr)) continue;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aRest', new THREE.Float32BufferAttribute(rest, 3));
    g.setIndex(idx); g.computeVertexNormals();
    g.setAttribute('aRN', g.attributes.normal.clone());
    attach(ctx, 'Spine2', mesh(g, MAT.bananaSkin(), 'banana'));
    // picciolo in cima e punta scura in fondo
    const tTop = axis(1);
    attach(ctx, 'Spine2', mesh(taper([tTop.clone().add(v3(0, -0.04, 0)), tTop.clone().add(v3(0, 0.06, 0.02)), tTop.clone().add(v3(0, 0.12, 0.07))], (t) => 0.032 - t * 0.008, 8, 7), MAT.bananaStem(), 'picciolo'));
    attach(ctx, 'Spine2', mesh(rigid(new THREE.TorusGeometry(rad(0) * 0.99, 0.012, 6, 36).rotateX(Math.PI / 2).scale(1.05, 1, 0.92).translate(0, y0, axis(0).z)), MAT.bananaStem(), 'orlo'));
  },

  // ── Capitan Pirata: tricorno con bordo dorato, benda sull'occhio, giacca rossa con bottoni, fusciacca e sciabola ──
  pirata(ctx, M) {
    hideMesh(ctx, 'fedora');
    const body = ctx.meshes.body, J = M.J, E = M.eye, hc = M.hc, hy = J.Hips.y;
    const sx = J.LeftArm ? Math.abs(J.LeftArm.x) : 0.17;
    // tricorno: falda rialzata su tre lati, con tre punte
    const r0 = M.hw + 0.012, crownH = 0.085, base = v3(hc.x, M.top - 0.045, hc.z - 0.005);
    const crown = rigid(new THREE.LatheGeometry([v3(r0, 0, 0), v3(r0 + 0.004, crownH * 0.6, 0), v3(r0 - 0.012, crownH * 0.92, 0), v3(r0 * 0.6, crownH, 0), v3(0.001, crownH + 0.004, 0)].map(p => new THREE.Vector2(p.x, p.y)), 28).scale(1, 1, 1.12).translate(base.x, base.y, base.z));
    const brim = surf((u, v) => {
      const a = u * Math.PI * 2, c = Math.pow(Math.max(0, Math.cos(3 * a)), 6);
      const R = r0 + v * (0.1 + 0.055 * c);
      const up = v * v * (0.105 * (1 - 0.8 * c));
      return [base.x + Math.sin(a) * R, base.y + 0.005 + up, base.z + Math.cos(a) * R * 1.12];
    }, 60, 5, false);
    { const Pp = brim.attributes.position, Rr = brim.attributes.aRest; for (let i = 0; i < Pp.count; i++) { const d = Math.hypot(Pp.getX(i) - base.x, (Pp.getZ(i) - base.z) / 1.12); Rr.setXYZ(i, (d - r0) / 0.15, Pp.getY(i), 0); } }
    attach(ctx, 'Head', mesh(crown, MAT.felt('#151313'), 'tricorno'));
    attach(ctx, 'Head', mesh(brim, MAT.feltTrim('#151313', 'vec3(0.8, 0.6, 0.22)'), 'falda'));
    // teschio bianco sul davanti
    attach(ctx, 'Head', mesh(rigid(new THREE.CircleGeometry(0.014, 16).translate(0, 0, 0)), pmat('skull', { color: '#ece6d6', rough: 0.6, side: THREE.DoubleSide }), 'teschio'), v3(hc.x, base.y + 0.075, base.z + (r0 + 0.1) * 1.12 - 0.006), new THREE.Euler(-0.5, 0, 0));
    // benda sull'occhio destro (lato -x) e laccio attorno alla testa
    const ex = -(ctx.eyeW || 0.032) * 0.98;
    const patch = surf((u, v) => { const a = u * Math.PI * 2, r = v * 0.022; return [ex + Math.cos(a) * r * 1.15, E.y + Math.sin(a) * r, E.z + 0.008 + (1 - v * v) * 0.005]; }, 16, 3, false);
    attach(ctx, 'Head', mesh(patch, MAT.leather('#111010'), 'benda'));
    const bandMat = pmat('patchStrap', { color: '#141212', rough: 0.6, code: `CLIP = abs(p.y - (${f4(E.y)} + (p.x - ${f4(ex)}) * -0.45 * step(0.0, p.z - ${f4(hc.z)}) + 0.035 * step(p.z, ${f4(hc.z)}))) > 0.0045;` });
    shell(body, 'laccio', bandMat, { sel: (p) => p.y > E.y - 0.05 && p.y < E.y + 0.06 && Math.hypot(p.x - hc.x, p.z - hc.z) < 0.16, off: () => 0.004 });
    // giacca rossa (busto, maniche e falde) con fusciacca e cinturone
    shell(body, 'giacca', MAT.coat('#5e0f18'), { sel: (p, n, b) => !/Hand|Head|Foot|Toe/.test(b) && !(/Leg/.test(b) && !/UpLeg/.test(b)) && p.y > hy - 0.38 && p.y < J.Neck.y - 0.015 && !(/ForeArm/.test(b) && J.LeftHand && p.y < J.LeftHand.y + 0.06), off: (p) => 0.022 + Math.max(0, hy - p.y) * 0.12, edge: (p, n, b) => (isArm(b) ? 1 : p.y - (hy - 0.38)) });
    shell(body, 'fusciacca', MAT.sash('#a8202a'), { sel: (p, n, b) => !isArm(b) && p.y > hy + 0.02 && p.y < hy + 0.11, off: () => 0.04, edge: (p) => Math.min(p.y - hy - 0.02, hy + 0.11 - p.y) });
    hangSword(ctx, longsword(0.86, MAT.leather('#2a1a10'), MAT.steel('#b9a070', 'b')), 0.86 * 0.75, v3(0.245, hy + 0.0, J.Hips.z + 0.06), 0.45, 0.12);
  },

  // ── Vichingo: elmo di ferro con corna e nasale, mantello di pelliccia, scudo rotondo sulla schiena, ascia ──
  vichingo(ctx, M) {
    const body = ctx.meshes.body, J = M.J, E = M.eye, hc = M.hc;
    shell(body, 'elmo', MAT.steel('#6a6e72', 'i'), { sel: (p) => p.y > E.y + 0.025 && Math.hypot(p.x - hc.x, p.z - hc.z) < 0.17, off: (p) => 0.026 + (p.y - E.y) * 0.04 });
    attach(ctx, 'Head', mesh(rigid(new THREE.BoxGeometry(0.018, 0.07, 0.008).translate(hc.x, E.y - 0.005, M.front + 0.02)), MAT.steel('#6a6e72', 'i'), 'nasale'));
    attach(ctx, 'Head', mesh(rigid(new THREE.TorusGeometry(M.hw + 0.03, 0.008, 6, 40).rotateX(Math.PI / 2).scale(1, 1, 1.18).translate(hc.x, E.y + 0.03, hc.z)), MAT.steel('#4a3a26', 'b'), 'cerchio'));
    const horn = MAT.dragonHorn();
    for (const s of [-1, 1]) {
      const b = v3(hc.x + s * (M.hw + 0.02), E.y + 0.065, hc.z);
      attach(ctx, 'Head', mesh(taper([b, b.clone().add(v3(s * 0.07, 0.03, 0.01)), b.clone().add(v3(s * 0.11, 0.1, 0.03)), b.clone().add(v3(s * 0.1, 0.17, 0.06))], (t) => 0.026 * (1 - t) + 0.002, 20, 12, { along: true }), horn, 'corno'));
    }
    // pelliccia sulle spalle (bordo frastagliato)
    const S2 = J.Spine2;
    const furM = MAT.fur('#6a5440', S2.y - 0.02);
    const sx = J.LeftArm ? Math.abs(J.LeftArm.x) : 0.17;
    shell(body, 'pelliccia', furM, { sel: (p, n, b) => !/ForeArm|Hand|Head/.test(b) && p.y > S2.y + (p.z > S2.z ? 0.05 : -0.12) && p.y < J.Neck.y + 0.02 && !(/Arm/.test(b) && p.y < J.LeftArm.y - 0.08) && !(p.z > J.Neck.z + 0.02 && p.y > S2.y + 0.1 && Math.abs(p.x) < 0.07), off: (p) => 0.045 + Math.max(0, 0.06 - Math.abs(Math.abs(p.x) - sx)) * 0.3 });
    // scudo tondo dipinto con borchia
    const sh = new THREE.Group();
    sh.add(mesh(rigid(new THREE.CircleGeometry(0.38, 40)), MAT.wood('#8a2a22'), 'scudo'));
    sh.add(mesh(rigid(new THREE.TorusGeometry(0.38, 0.012, 6, 48)), MAT.steel('#4a4846', 'r'), 'bordo'));
    sh.add(mesh(rigid(new THREE.SphereGeometry(0.07, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), MAT.steel('#6a6e72', 'i'), 'borchia'));
    attach(ctx, 'Spine2', sh, v3(0, S2.y - 0.06, S2.z - 0.24), new THREE.Euler(0, Math.PI, 0.3));
    // ascia al fianco
    const ax = new THREE.Group(), hy = J.Hips.y;
    ax.add(mesh(taper([v3(0, 0, 0), v3(0, 0.62, 0)], () => 0.015, 4, 8, { along: true }), MAT.wood('#5a3a20'), 'manico'));
    const bl = new THREE.Shape(); bl.moveTo(0, 0); bl.lineTo(0.05, 0.02); bl.quadraticCurveTo(0.14, -0.02, 0.15, -0.09); bl.quadraticCurveTo(0.1, -0.06, 0.05, -0.08); bl.lineTo(0, -0.07);
    ax.add(mesh(rigid(new THREE.ExtrudeGeometry(bl, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1 }).translate(0.01, 0.6, -0.005)), MAT.steel('#8a8e92', 'a'), 'lama'));
    attach(ctx, 'Hips', ax, v3(0.225, hy - 0.5, J.Hips.z + 0.05), new THREE.Euler(0, Math.PI / 2, 0.1));
  },

  // ── Spettro Gelido: veste di ghiaccio semitrasparente e luminosa, pelle livida, occhi azzurri accesi ──
  spettro(ctx, M) {
    for (const k of Object.keys(ctx.meshes)) {
      const o = ctx.meshes[k];
      if (k.includes('robe') || k.includes('hood')) { addRest(o); o.material = MAT.ice(o.material, vec('#bfe0ff')); }
      if (k === 'body') { addRest(o); o.material = pmat('ghostSkin', { code: `col = mix(col, vec3(0.62, 0.74, 0.9), 0.7); EMI = vec3(0.05, 0.12, 0.25);` }, o.material); }
      if (k.includes('long01')) { addRest(o); o.material = pmat('ghostHair', { code: `col = mix(col, vec3(0.9, 0.96, 1.0), 0.85); EMI = vec3(0.1, 0.18, 0.3);` }, o.material); }
    }
    if (ctx.meshes.eyes) { addRest(ctx.meshes.eyes); ctx.meshes.eyes.material = MAT.glowEye(ctx.meshes.eyes.material, 'vec3(0.4, 0.9, 1.6)'); }
    // corona di ghiaccioli sul cappuccio
    const J = M.J, hc = M.hc;
    const iceM = pmat('icicle', { color: '#d8f0ff', rough: 0.1, metal: 0.1, transparent: true, opacity: 0.8, code: `EMI = vec3(0.25, 0.55, 0.9) * 0.6;` });
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 2.4, b = v3(hc.x + Math.sin(a) * (M.hw + 0.05), M.top + 0.0 - Math.abs(a) * 0.03, hc.z + Math.cos(a) * (M.front - hc.z + 0.04));
      const h = 0.06 + (i % 2) * 0.04 - Math.abs(a) * 0.012;
      attach(ctx, 'Head', mesh(taper([b, b.clone().add(v3(Math.sin(a) * 0.01, h, 0))], (t) => 0.013 * (1 - t) + 0.0005, 4, 6), iceM, 'ghiaccio'));
    }
  },

  // ── Robot X-9: pelle metallica a pannelli, antenna, occhi e nucleo luminosi ──
  robot(ctx, M) {
    for (const k of ['eyebrow', 'eyelash']) hideMesh(ctx, k);
    if (ctx.meshes.body) { addRest(ctx.meshes.body); ctx.meshes.body.material = MAT.robotSkin(); }
    const J = M.J, hc = M.hc, S2 = J.Spine2;
    let cz = S2.z + 0.165;
    for (const k of Object.keys(ctx.meshes)) {
      const o = ctx.meshes[k];
      if (/suit|boots|shoes/.test(k)) {
        const R = addRest(o);
        o.material = pmat('robotPlate' + (k.includes('suit') ? 's' : 'b'), { code: `
          col = ${k.includes('suit') ? 'vec3(0.7, 0.74, 0.8)' : 'vec3(0.38, 0.4, 0.45)'} * (0.8 + 0.2 * smoothstep(0.0, 0.5, dot(diffuseColor.rgb, vec3(0.33))));
          float seam = 1.0 - smoothstep(0.0, 0.004, abs(fract(p.y * 7.0) - 0.5) - 0.494);
          col *= 1.0 - seam * 0.6; H = -seam * 0.001 + hammered(p) * 0.25; RGH = 0.34; MET = 0.4;`, envI: 2.4 }, o.material);
        if (k.includes('suit')) for (let i = 0; i < R.P.length; i += 3) if (Math.abs(R.P[i]) < 0.05 && Math.abs(R.P[i + 1] - (S2.y - 0.02)) < 0.03) cz = Math.max(cz, R.P[i + 2] + 0.004);
      }
    }
    if (ctx.meshes.eyes) { addRest(ctx.meshes.eyes); ctx.meshes.eyes.material = pmat('robotEye', { color: '#ff3a2a', code: 'col = vec3(0.4, 0.02, 0.0); EMI = vec3(2.2, 0.25, 0.1);' }); }
    for (const s of [-1, 1]) attach(ctx, 'Head', mesh(rigid(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 16).rotateZ(Math.PI / 2).translate(hc.x + s * (M.hw + 0.006), M.eye.y - 0.01, hc.z)), MAT.alu(), 'orecchio'));
    attach(ctx, 'Head', mesh(taper([v3(hc.x + 0.06, M.top - 0.02, hc.z - 0.02), v3(hc.x + 0.07, M.top + 0.12, hc.z - 0.03)], () => 0.004, 3, 6), MAT.alu(), 'antenna'));
    const glow = pmat('robotGlow', { color: '#3affd0', code: 'EMI = vec3(0.3, 1.6, 1.25);' });
    attach(ctx, 'Head', mesh(rigid(new THREE.SphereGeometry(0.011, 10, 8).translate(hc.x + 0.07, M.top + 0.125, hc.z - 0.03)), glow, 'luce'));
    attach(ctx, 'Spine2', mesh(rigid(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24).rotateX(Math.PI / 2).translate(0, S2.y - 0.02, cz)), glow, 'nucleo'));
    attach(ctx, 'Spine2', mesh(rigid(new THREE.TorusGeometry(0.04, 0.007, 6, 28).translate(0, S2.y - 0.02, cz + 0.004)), MAT.alu(), 'anello'));
  },

  // ── Zombie: pelle marcia con ferite, maglia strappata e insanguinata, occhi spenti ──
  zombie(ctx) {
    for (const k of Object.keys(ctx.meshes)) {
      const o = ctx.meshes[k];
      if (k === 'body') { addRest(o); o.material = MAT.zombieSkin(o.material); }
      if (k.includes('shirt') || k.includes('pants')) { addRest(o); o.material = MAT.zombieCloth(o.material); }
    }
    if (ctx.meshes.eyes) { addRest(ctx.meshes.eyes); ctx.meshes.eyes.material = pmat('zEye', { code: `col = mix(col, vec3(0.75, 0.72, 0.5), 0.6); EMI = vec3(0.12, 0.1, 0.02);` }, ctx.meshes.eyes.material); }
  },

  // ── Cowboy: vero cappello da cowboy (cupola schiacciata e falda arricciata ai lati) ──
  // ── Scienziata Pazza: camice bianco lungo e occhialoni da laboratorio sulla fronte ──
  scienziata(ctx, M) {
    const body = ctx.meshes.body, J = M.J, E = M.eye, hc = M.hc, hy = J.Hips.y;
    const coat = pmat('labCoat', { color: '#f2f3f0', rough: 0.8, code: `
      H = cloth(p) * 1.2;
      // apertura davanti, taschino e due tasche
      float open = 1.0 - smoothstep(0.004, 0.008, abs(p.x - 0.01)) ;
      CLIP = n.z > 0.3 && abs(p.x - 0.005) < 0.022 && p.y > ${f4(J.Spine2.y + 0.04)};
      vec2 tp = vec2(abs(p.x) - 0.09, p.y - ${f4(hy - 0.08)});
      float pocket = step(abs(tp.x), 0.045) * step(abs(tp.y), 0.05) * step(0.3, n.z);
      float pe = pocket * (1.0 - step(abs(tp.x), 0.042) * step(abs(tp.y), 0.047));
      col *= 1.0 - open * 0.25 - pe * 0.2; H += pocket * 0.0008;` });
    shell(body, 'camice', coat, { sel: (p, n, b) => !/Hand|Head|Foot|Toe/.test(b) && !(/Leg/.test(b) && !/UpLeg/.test(b) && p.y < hy - 0.42) && p.y > hy - 0.45 && p.y < J.Neck.y + 0.01 && !(/ForeArm/.test(b) && J.LeftHand && p.y < J.LeftHand.y + 0.06),
      off: (p) => 0.02 + Math.max(0, hy - p.y) * 0.2, edge: (p, n, b) => (isArm(b) ? 1 : p.y - (hy - 0.42)) });
    // occhialoni: due lenti tonde con montatura di gomma e cinghia attorno alla testa
    const gy = E.y + 0.055, gz = M.front - 0.012;
    const rub = MAT.leather('#2a2c30'), lens = pmat('goggleLens', { color: '#9fd6e8', rough: 0.05, metal: 0.3, envI: 2.2, code: 'EMI = vec3(0.02, 0.06, 0.08);' });
    for (const sgn of [-1, 1]) {
      const c = v3(hc.x + sgn * 0.034, gy, gz);
      attach(ctx, 'Head', mesh(rigid(new THREE.CylinderGeometry(0.026, 0.028, 0.022, 20, 1, true).rotateX(Math.PI / 2).rotateY(sgn * 0.25).translate(c.x, c.y, c.z)), rub, 'montatura'));
      attach(ctx, 'Head', mesh(rigid(new THREE.CircleGeometry(0.024, 20).rotateY(sgn * 0.25).translate(c.x + sgn * 0.003, c.y, c.z + 0.011)), lens, 'lente'));
    }
    attach(ctx, 'Head', mesh(rigid(new THREE.TorusGeometry(M.hw + 0.012, 0.007, 4, 40).rotateX(Math.PI / 2).scale(1, 1, 1.2).translate(hc.x, gy, hc.z)), rub, 'cinghia'));
  },

  cowboy(ctx, M) {
    hideMesh(ctx, 'fedora');
    const hc = M.hc, r0 = M.hw + 0.012, base = v3(hc.x, M.top - 0.05, hc.z - 0.005);
    const crown = rigid(new THREE.LatheGeometry([[r0, 0], [r0 + 0.003, 0.07], [r0 - 0.01, 0.11], [r0 * 0.55, 0.12], [0.001, 0.105]].map(([x, y]) => new THREE.Vector2(x, y)), 28).scale(0.95, 1, 1.18));
    { const p = crown.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); if (y > 0.09) p.setY(i, y - Math.exp(-x * x / 0.0012) * 0.02); } crown.computeVertexNormals(); crown.setAttribute('aRN', crown.attributes.normal.clone()); }
    crown.translate(base.x, base.y, base.z);
    const brim = surf((u, v) => { const a = u * Math.PI * 2, R = r0 + v * 0.11; const side = Math.pow(Math.abs(Math.sin(a)), 2); return [base.x + Math.sin(a) * R * 0.98, base.y + 0.004 + v * v * (0.075 * side - 0.012 * (1 - side)), base.z + Math.cos(a) * R * 1.16]; }, 56, 5, false);
    const felt = MAT.felt('#7a5534');
    attach(ctx, 'Head', mesh(crown, felt, 'cappello'));
    attach(ctx, 'Head', mesh(brim, felt, 'falda'));
    attach(ctx, 'Head', mesh(rigid(new THREE.CylinderGeometry(r0 + 0.004, r0 + 0.005, 0.016, 28, 1, true).scale(0.95, 1, 1.18).translate(base.x, base.y + 0.012, base.z)), MAT.leather('#2a1a10'), 'nastro'));
  },
};

/** aggiunge il costume della skin al modello (una volta, quando il personaggio viene preparato) */
export function dressUp(id, ctx) {
  const f = COSTUMES[id];
  if (!f || !ctx.meshes.body) return false;
  if (ctx.norm) NORM = ctx.norm;
  ctx.parts = [];
  BODY = ctx.meshes.body; ROOT = BODY.parent;
  CLOTH = Object.keys(ctx.meshes).filter(k => k !== 'body' && CLOTH_RE.test(k) && ctx.meshes[k].isSkinnedMesh).map(k => ctx.meshes[k]);
  try {
    const M = measure(ctx);
    f(ctx, M);
    flushParts(ctx);
    BODY = null; CLOTH = []; ROOT = null;
    return true;
  } catch (e) { console.warn('Costume non applicato:', id, e); return false; }
}
export const HAS_COSTUME = new Set(Object.keys(COSTUMES));
