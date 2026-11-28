// ─────────────────────────────────────────────────────────────
//  Rumore procedurale con seme: simplex 2D, fBm e ridged (creste montuose)
// ─────────────────────────────────────────────────────────────
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GX = new Float32Array([1, -1, 1, -1, 1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071]);
const GY = new Float32Array([0, 0, 0, 0, 1, 1, -1, -1, 0.7071, 0.7071, -0.7071, -0.7071]);
const GX8 = new Float32Array([1, -1, 1, -1, 1, 0, -1, 0]), GY8 = new Float32Array([1, 1, -1, -1, 0, 1, 0, -1]);

/** simplex 2D con seme → funzione (x, y) in [-1, 1] circa */
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = perm[i] & 7; }
  return function noise2(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { g = pm[ii + perm[jj]]; tt *= tt; n += tt * tt * (GX8[g] * x0 + GY8[g] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { g = pm[ii + i1 + perm[jj + j1]]; tt *= tt; n += tt * tt * (GX8[g] * x1 + GY8[g] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { g = pm[ii + 1 + perm[jj + 1]]; tt *= tt; n += tt * tt * (GX8[g] * x2 + GY8[g] * y2); }
    return 70 * n;
  };
}

/** moto browniano frazionario: somma di ottave (risultato circa in [-1, 1]) */
export function fbm(n, x, y, oct = 4, lac = 2.03, gain = 0.5) {
  let a = 1, f = 1, s = 0, norm = 0;
  for (let o = 0; o < oct; o++) { s += a * n(x * f + o * 17.3, y * f - o * 9.1); norm += a; a *= gain; f *= lac; }
  return s / norm;
}

/** rumore a creste (montagne): 0 nelle valli, 1 sulle creste */
export function ridged(n, x, y, oct = 4, lac = 2.1, gain = 0.5) {
  let a = 1, f = 1, s = 0, norm = 0, w = 1;
  for (let o = 0; o < oct; o++) {
    let v = 1 - Math.abs(n(x * f + o * 31.7, y * f + o * 12.9));
    v *= v;
    s += v * a * w; norm += a;
    w = Math.min(1, Math.max(0, v * 1.6));
    a *= gain; f *= lac;
  }
  return s / norm;
}
