// ─────────────────────────────────────────────────────────────
//  v39: scultura procedurale (campi di distanza con segno → mesh)
//   · primitive: coni arrotondati fra due punti (ossa, dita, muscoli allungati), ellissoidi
//     (muscoli, cranio, ventre), ciascuno con un proprio sistema di riferimento (rotazione e
//     schiacciamento). Si fondono con un'unione morbida (smooth-min), quindi niente giunture:
//     i muscoli si raccordano fra loro come in una scultura in creta. Le primitive «sub» scavano.
//   · superficie estratta con i «surface nets» (un vertice per cella, quadrilateri sugli spigoli
//     che attraversano la superficie), poi proiettata sulla superficie vera con un passo di Newton
//   · pesi dello scheletro (fino a 4 ossa per vertice), colori per primitiva fusi morbidamente
//     e occlusione ambientale calcolata dal campo stesso
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** cono arrotondato fra a e b (raggi r1, r2) — Inigo Quilez */
function sdRoundCone(px, py, pz, P) {
  const { ax, ay, az, bax, bay, baz, l2, rr, a2, il2, r1, r2 } = P;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
/** ellissoide (approssimazione con limite inferiore) */
function sdEll(px, py, pz, P) {
  const x = px / P.rx, y = py / P.ry, z = pz / P.rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x1 = x / P.rx, y1 = y / P.ry, z1 = z / P.rz;
  const k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
  return k1 < 1e-9 ? -Math.min(P.rx, P.ry, P.rz) : k0 * (k0 - 1) / k1;
}
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

// rumore di valore 3D (bozzi della pelle)
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

/**
 * una scultura: si aggiungono primitive (in coordinate «frame» = matrice corrente, di solito quella di
 * un osso) e poi si chiede la mesh.
 */
export class Sculpt {
  constructor({ noise = 0, noiseF = 9 } = {}) { this.prims = []; this.frame = new THREE.Matrix4(); this.bone = 0; this.noise = noise; this.noiseF = noiseF; }
  /** imposta il sistema di riferimento (matrice) e l'osso a cui vanno le prossime primitive */
  at(matrix, bone = this.bone) { this.frame.copy(matrix || _m.identity()); this.bone = bone; return this; }
  _push(type, P, o, inv, minS, bbC, bbR) {
    const pr = { type, P, k: o.k ?? 0.05, sub: !!o.sub, bone: o.bone ?? this.bone, col: new THREE.Color(o.col || '#b89c7c'), inv, minS, w: o.w ?? 1, noSkin: !!o.noSkin };
    const e = bbR + pr.k + 0.02;
    pr.bb = [bbC.x - e, bbC.y - e, bbC.z - e, bbC.x + e, bbC.y + e, bbC.z + e];
    this.prims.push(pr); return pr;
  }
  /**
   * cono arrotondato fra a e b (nel frame corrente); o.flat = [sx, sz] schiaccia la sezione (orecchie, artigli
   * piatti) lungo gli assi locali perpendicolari, o.roll ruota la sezione attorno all'asse
   */
  cone(a, b, r1, r2, o = {}) {
    _a.fromArray(a).applyMatrix4(this.frame); _b.fromArray(b).applyMatrix4(this.frame);
    const sc = this.frameScale();
    r1 *= sc; r2 *= sc;
    let inv = null, minS = 1;
    const A = _a.clone(), B = _b.clone();
    if (o.flat) {
      // frame locale: y lungo l'asse del cono, x/z perpendicolari (schiacciati)
      const ax = B.clone().sub(A).normalize();
      let ref = Math.abs(ax.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      if (o.ref) ref = new THREE.Vector3().fromArray(o.ref).transformDirection(this.frame);
      const xz = new THREE.Vector3().crossVectors(ax, ref).normalize(), zz = new THREE.Vector3().crossVectors(xz, ax).normalize();
      if (o.roll) { xz.applyAxisAngle(ax, o.roll); zz.applyAxisAngle(ax, o.roll); }
      const [sx, sz] = o.flat;
      const M = new THREE.Matrix4().makeBasis(xz.multiplyScalar(sx), ax, zz.multiplyScalar(sz)).setPosition(A);
      inv = M.clone().invert(); minS = Math.min(sx, sz, 1);
      const l = A.distanceTo(B);
      A.set(0, 0, 0); B.set(0, l, 0);
    }
    const bax = B.x - A.x, bay = B.y - A.y, baz = B.z - A.z, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2;
    const P = { ax: A.x, ay: A.y, az: A.z, bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2 };
    const c = _a.clone().add(_b).multiplyScalar(0.5);
    return this._push('cone', P, o, inv, minS, c, _a.distanceTo(_b) / 2 + Math.max(r1, r2));
  }
  /** ellissoide di centro c e semiassi r (nel frame corrente), ruotato di rot = [rx, ry, rz] (Eulero) */
  ell(c, r, rot = null, o = {}) {
    const sc = this.frameScale();
    _q.setFromEuler(_e.set(...(rot || [0, 0, 0])));
    const M = new THREE.Matrix4().compose(_t.fromArray(c), _q, _s.set(1, 1, 1)).premultiply(this.frame);
    // togli la scala del frame (la portiamo nei semiassi)
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); M.decompose(pos, q, s);
    const inv = new THREE.Matrix4().compose(pos, q, _s.set(1, 1, 1)).invert();
    const P = { rx: r[0] * sc, ry: r[1] * sc, rz: r[2] * sc };
    return this._push('ell', P, o, inv, 1, pos, Math.max(P.rx, P.ry, P.rz));
  }
  sphere(c, r, o = {}) { return this.ell(c, [r, r, r], null, o); }
  frameScale() { return _s.setFromMatrixScale(this.frame).x; }

  /** distanza dalla singola primitiva */
  dPrim(pr, x, y, z) {
    if (pr.inv) { const e = pr.inv.elements; const lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14]; x = lx; y = ly; z = lz; }
    return (pr.type === 'cone' ? sdRoundCone(x, y, z, pr.P) : sdEll(x, y, z, pr.P)) * pr.minS;
  }
  /** campo completo in un punto */
  eval(x, y, z) {
    let d = 1;
    for (const pr of this.prims) {
      const b = pr.bb; if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) continue;
      const dp = this.dPrim(pr, x, y, z);
      d = pr.sub ? smax(d, -dp, pr.k) : smin(d, dp, pr.k);
    }
    if (this.noise) d += vnoise(x * this.noiseF, y * this.noiseF, z * this.noiseF) * this.noise;
    return d;
  }

  /**
   * estrae la superficie: step = lato della cella. opts.bones = numero di ossa (per i pesi),
   * opts.ao = occlusione ambientale. Restituisce una BufferGeometry indicizzata (posizione, normale,
   * colore, e se richiesto skinIndex/skinWeight).
   */
  mesh(step, opts = {}) {
    const P = this.prims.filter(p => !p.sub);
    if (!P.length) return new THREE.BufferGeometry();
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of P) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.bb[i]); hi[i] = Math.max(hi[i], p.bb[i + 3]); }
    for (let i = 0; i < 3; i++) { lo[i] -= step * 2; hi[i] += step * 2; }
    const nx = Math.ceil((hi[0] - lo[0]) / step) + 1, ny = Math.ceil((hi[1] - lo[1]) / step) + 1, nz = Math.ceil((hi[2] - lo[2]) / step) + 1;
    const N = nx * ny * nz, F = new Float32Array(N).fill(1);
    const id = (i, j, k) => i + nx * (j + ny * k);
    // campo sulla griglia: ogni primitiva aggiorna solo le celle del suo riquadro
    for (const pr of this.prims) {
      const b = pr.bb;
      const i0 = Math.max(0, Math.floor((b[0] - lo[0]) / step)), i1 = Math.min(nx - 1, Math.ceil((b[3] - lo[0]) / step));
      const j0 = Math.max(0, Math.floor((b[1] - lo[1]) / step)), j1 = Math.min(ny - 1, Math.ceil((b[4] - lo[1]) / step));
      const k0 = Math.max(0, Math.floor((b[2] - lo[2]) / step)), k1 = Math.min(nz - 1, Math.ceil((b[5] - lo[2]) / step));
      for (let k = k0; k <= k1; k++) { const z = lo[2] + k * step;
        for (let j = j0; j <= j1; j++) { const y = lo[1] + j * step; let ix = id(i0, j, k);
          for (let i = i0; i <= i1; i++, ix++) {
            const dp = this.dPrim(pr, lo[0] + i * step, y, z);
            F[ix] = pr.sub ? smax(F[ix], -dp, pr.k) : smin(F[ix], dp, pr.k);
          } } }
    }
    if (this.noise) for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const ix = id(i, j, k); if (Math.abs(F[ix]) < step * 3) F[ix] += vnoise((lo[0] + i * step) * this.noiseF, (lo[1] + j * step) * this.noiseF, (lo[2] + k * step) * this.noiseF) * this.noise;
    }
    // surface nets: un vertice per cella attraversata
    const cellV = new Int32Array(N).fill(-1), pos = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const v8 = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) { v8[c] = F[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v8[c] < 0) neg++; }
      if (neg === 0 || neg === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) {
        const va = v8[a], vb = v8[b]; if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
      }
      cellV[id(i, j, k)] = pos.length / 3;
      pos.push(lo[0] + (i + sx / n) * step, lo[1] + (j + sy / n) * step, lo[2] + (k + sz / n) * step);
    }
    // quadrilateri: per ogni spigolo della griglia che attraversa la superficie, le 4 celle attorno
    const idx = [];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const v0 = F[id(i, j, k)], in0 = v0 < 0;
      // spigolo lungo x
      if (in0 !== (F[id(i + 1, j, k)] < 0)) quad(cellV[id(i, j, k)], cellV[id(i, j - 1, k)], cellV[id(i, j - 1, k - 1)], cellV[id(i, j, k - 1)], !in0);
      if (in0 !== (F[id(i, j + 1, k)] < 0)) quad(cellV[id(i, j, k)], cellV[id(i, j, k - 1)], cellV[id(i - 1, j, k - 1)], cellV[id(i - 1, j, k)], !in0);
      if (in0 !== (F[id(i, j, k + 1)] < 0)) quad(cellV[id(i, j, k)], cellV[id(i - 1, j, k)], cellV[id(i - 1, j - 1, k)], cellV[id(i, j - 1, k)], !in0);
    }
    const nv = pos.length / 3, V = new Float32Array(pos);
    // passo di Newton: porta i vertici sulla superficie vera (le forme restano morbide e precise)
    const h = step * 0.25;
    const grad = (x, y, z, out) => { out[0] = this.eval(x + h, y, z) - this.eval(x - h, y, z); out[1] = this.eval(x, y + h, z) - this.eval(x, y - h, z); out[2] = this.eval(x, y, z + h) - this.eval(x, y, z - h); const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l; return out; };
    const g = [0, 0, 0], NRM = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      let x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
      for (let it = 0; it < 2; it++) { const d = this.eval(x, y, z); grad(x, y, z, g); const s = clamp(d, -step, step); x -= g[0] * s; y -= g[1] * s; z -= g[2] * s; }
      V[v * 3] = x; V[v * 3 + 1] = y; V[v * 3 + 2] = z;
      grad(x, y, z, g); NRM[v * 3] = g[0]; NRM[v * 3 + 1] = g[1]; NRM[v * 3 + 2] = g[2];
    }
    // orientamento dei triangoli coerente con la normale del campo
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      if (fx * (NRM[a] + NRM[b] + NRM[c]) + fy * (NRM[a + 1] + NRM[b + 1] + NRM[c + 1]) + fz * (NRM[a + 2] + NRM[b + 2] + NRM[c + 2]) < 0) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
    }
    // colori e pesi: fusione morbida delle primitive vicine
    const COL = new Float32Array(nv * 3), nb = opts.bones || 0;
    const SI = nb ? new Uint16Array(nv * 4) : null, SW = nb ? new Float32Array(nv * 4) : null;
    const bw = new Float32Array(Math.max(1, nb)), ds = new Float32Array(this.prims.length);
    const cs = opts.colorSharp ?? 0.025, ws = opts.weightSoft ?? 0.05;
    for (let v = 0; v < nv; v++) {
      const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
      let dmin = Infinity;
      for (let p = 0; p < this.prims.length; p++) {
        const pr = this.prims[p], b = pr.bb;
        if (pr.sub || x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) { ds[p] = Infinity; continue; }
        ds[p] = this.dPrim(pr, x, y, z) - pr.k * 0.3; if (ds[p] < dmin) dmin = ds[p];
      }
      let cr = 0, cg = 0, cb = 0, cw = 0; bw.fill(0);
      for (let p = 0; p < this.prims.length; p++) {
        if (ds[p] === Infinity) continue;
        const pr = this.prims[p], dd = ds[p] - dmin;
        const wc = Math.exp(-dd / cs) * pr.w; cr += pr.col.r * wc; cg += pr.col.g * wc; cb += pr.col.b * wc; cw += wc;
        if (nb && !pr.noSkin) bw[pr.bone] += Math.exp(-dd / ws);
      }
      if (cw > 0) { COL[v * 3] = cr / cw; COL[v * 3 + 1] = cg / cw; COL[v * 3 + 2] = cb / cw; }
      if (nb) {
        // le 4 ossa più pesanti
        const top = [];
        for (let i = 0; i < nb; i++) if (bw[i] > 1e-4) top.push([bw[i], i]);
        top.sort((a, b) => b[0] - a[0]); top.length = Math.min(4, top.length);
        const sum = top.reduce((s, t) => s + t[0], 0) || 1;
        top.forEach(([w, i], q) => { SI[v * 4 + q] = i; SW[v * 4 + q] = w / sum; });
        if (!top.length) { SI[v * 4] = 0; SW[v * 4] = 1; }
      }
    }
    // occlusione ambientale (dal campo): le pieghe fra i muscoli si scuriscono
    if (opts.ao !== false) {
      const aoS = opts.aoStep || step * 1.6, aoK = opts.aoK ?? 0.85;
      for (let v = 0; v < nv; v++) {
        const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2], n0 = NRM[v * 3], n1 = NRM[v * 3 + 1], n2 = NRM[v * 3 + 2];
        let occ = 0, wsum = 0;
        for (let s = 1; s <= 4; s++) { const dd = aoS * s, w = 1 / s; occ += w * clamp((dd - this.eval(x + n0 * dd, y + n1 * dd, z + n2 * dd)) / dd, 0, 1); wsum += w; }
        const ao = 1 - aoK * occ / wsum;
        COL[v * 3] *= ao; COL[v * 3 + 1] *= ao; COL[v * 3 + 2] *= ao;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(V, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(NRM, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(COL, 3));
    if (nb) { geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4)); }
    geo.setIndex(nv > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
    geo.computeBoundingSphere();
    return geo;
  }
}

/**
 * materiale per le sculture: colori dei vertici + trama della pelle proiettata sui tre assi (non servono
 * coordinate UV) nello spazio dell'oggetto (per le mesh con scheletro: quello della posa di riferimento,
 * così la trama resta incollata alla pelle quando si muove)
 */
export function sculptMaterial(detail, { scale = 2.2, amount = 0.75, roughness = 0.8, color = '#ffffff', bump = 0.0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDetail = { value: detail };
    sh.uniforms.uTriS = { value: scale };
    sh.uniforms.uTriA = { value: amount };
    sh.uniforms.uBump = { value: bump };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP = position;\nvTriN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;\nuniform sampler2D tDetail;\nuniform float uTriS;\nuniform float uTriA;\nuniform float uBump;\nvec3 triW() { vec3 w = pow(abs(normalize(vTriN)), vec3(4.0)); return w / (w.x + w.y + w.z); }\nvec3 triTex(vec3 p) { vec3 w = triW(); return texture2D(tDetail, p.zy * uTriS).rgb * w.x + texture2D(tDetail, p.xz * uTriS).rgb * w.y + texture2D(tDetail, p.xy * uTriS).rgb * w.z; }')
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ vec3 tt = triTex(vTriP); diffuseColor.rgb *= mix(vec3(1.0), tt * 1.3, uTriA); }')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n{ float tl = dot(triTex(vTriP * 2.7), vec3(0.333)); roughnessFactor = clamp(roughnessFactor + (0.5 - tl) * 0.3, 0.35, 1.0); }');
  };
  m.customProgramCacheKey = () => 'sculptTri1';
  return m;
}
