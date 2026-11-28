// ─────────────────────────────────────────────────────────────
//  Utilità per le texture procedurali: qualità, normal map dal rilievo
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const saved = (() => { try { return JSON.parse(localStorage.getItem('arenaRoyale') || '{}').gfx || {}; } catch { return {}; } })();
// primo avvio su telefono/tablet: texture leggere (come il preset "Bassa" scelto in main.js)
try { if (!localStorage.getItem('arenaRoyale') && matchMedia('(pointer: coarse)').matches && !saved.texq) saved.texq = 'low'; } catch { /* ok */ }
/** qualità delle texture: 1 = normale, 2 = alta (risoluzione doppia), 0.5 = bassa */
export const TEXQ = saved.texq === 'low' ? 0.5 : saved.texq === 'normal' ? 1 : 2;
/** normal map attive (rilievo) */
export const NORMALS = saved.texq !== 'low';
export const ANISO = { value: Number(saved.aniso) || 8 };

/** canvas quadrato + contesto, con la scala già applicata (si disegna sempre in coordinate "base") */
export function canvas2d(base) {
  const S = Math.max(16, Math.round(base * TEXQ));
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.setTransform(S / base, 0, 0, S / base, 0, 0);
  return { c, g, S, k: S / base };
}

/** grana fine a risoluzione piena (rumore in scala di grigi) */
export function addGrain(g, S, amount, rnd = Math.random) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (rnd() - 0.5) * amount; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(img, 0, 0);
  g.restore();
}

/**
 * Normal map (spazio tangente) da un canvas di altezze in scala di grigi (chiaro = in rilievo).
 * Usa il filtro di Sobel e ripete i bordi (texture affiancabili).
 */
export function normalFromHeight(hc, strength = 2) {
  const S = hc.width, H = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, S, H).data;
  const out = document.createElement('canvas');
  out.width = S; out.height = H;
  const og = out.getContext('2d');
  const img = og.createImageData(S, H), d = img.data;
  const h = (x, y) => src[((((y % H) + H) % H) * S + (((x % S) + S) % S)) * 4] / 255;
  const k = strength * S / 128;
  for (let y = 0; y < H; y++) for (let x = 0; x < S; x++) {
    const tl = h(x - 1, y - 1), t = h(x, y - 1), tr = h(x + 1, y - 1);
    const l = h(x - 1, y), r = h(x + 1, y);
    const bl = h(x - 1, y + 1), b = h(x, y + 1), br = h(x + 1, y + 1);
    const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
    const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
    let nx = -dx * k, ny = dy * k, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    const i = (y * S + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = ANISO.value;
  return tex;
}

/** texture colore da canvas (ripetibile, sRGB) */
export function colorTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO.value;
  return t;
}

/** imposta il filtro anisotropico su tutte le texture di una scena */
export function applyAnisotropy(root, n) {
  ANISO.value = n;
  const seen = new Set();
  root.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap']) {
      const t = m[key];
      if (t && !seen.has(t) && t.anisotropy !== n) { seen.add(t); t.anisotropy = n; t.needsUpdate = true; }
    }
  });
}

// ═════════════════════════════════════════════════════════════
//  v45: texture fotografiche (img/tex/*.jpg, 1024 px, affiancabili senza cuciture)
//  Fanno da base alle texture procedurali: le tinte, le finestre e i dettagli si disegnano sopra.
//  Se un'immagine non arriva, ogni generatore torna al disegno procedurale di prima.
// ═════════════════════════════════════════════════════════════
const PHOTO_LIST = ['stone', 'plaster', 'brick', 'roof', 'wood', 'cobble', 'asphalt', 'slabs', 'grass', 'dirt',
  'rock', 'concrete', 'metal', 'parquet', 'snow', 'sand', 'slate', 'paintwood'];   // v46: seconda serie
export const PHOTOS = {};
function loadPhoto(n) {
  return new Promise(res => {
    const im = new Image();
    const to = setTimeout(() => res(null), 25000);
    im.onload = () => { clearTimeout(to); res(im); };
    im.onerror = () => { clearTimeout(to); res(null); };
    im.src = new URL(`../img/tex/${n}.jpg?v=46`, import.meta.url).href;
  });
}
try {
  const ims = await Promise.all(PHOTO_LIST.map(loadPhoto));
  PHOTO_LIST.forEach((n, i) => { if (ims[i]) PHOTOS[n] = { img: ims[i], sizes: new Map(), tex: null }; });
} catch { /* niente foto: texture procedurali */ }
export const hasPhoto = (n) => !!PHOTOS[n];

/** pixel della foto ridimensionata a size×size (in cache) e colore medio */
export function photoData(name, size) {
  const P = PHOTOS[name];
  if (!P) return null;
  size = Math.max(4, Math.round(size));
  let D = P.sizes.get(size);
  if (!D) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // riduzione a passi (meno aliasing di un salto unico da 1024 px)
    let src = P.img, s = P.img.width;
    while (s / 2 > size * 1.4) {
      const t = document.createElement('canvas'); t.width = t.height = Math.round(s / 2);
      const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height);
      src = t; s = t.width;
    }
    g.drawImage(src, 0, 0, size, size);
    const px = g.getImageData(0, 0, size, size).data;
    let r = 0, gg = 0, b = 0;
    const n = size * size;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; }
    r /= n; gg /= n; b /= n;
    D = { size, px, canvas: c, mean: [r, gg, b], lum: 0.299 * r + 0.587 * gg + 0.114 * b };
    P.sizes.set(size, D);
  }
  return D;
}
/** colore medio della foto in spazio lineare (per gli shader) */
export function photoMeanLinear(name) {
  const D = photoData(name, 64);
  if (!D) return [0.5, 0.5, 0.5];
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const m = [0, 0, 0], px = D.px;
  for (let i = 0; i < px.length; i += 4) { m[0] += lin(px[i]); m[1] += lin(px[i + 1]); m[2] += lin(px[i + 2]); }
  const n = px.length / 4;
  return m.map(v => v / n);
}
/** texture three.js della foto intera (ripetibile, con mipmap), condivisa */
export function photoTexture(name) {
  const P = PHOTOS[name];
  if (!P) return null;
  if (!P.tex) {
    P.tex = new THREE.Texture(P.img);
    P.tex.wrapS = P.tex.wrapT = THREE.RepeatWrapping;
    P.tex.colorSpace = THREE.SRGBColorSpace;
    P.tex.anisotropy = ANISO.value;
    P.tex.needsUpdate = true;
  }
  return P.tex;
}
const hexRgb = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/**
 * Dipinge la foto `name` ripetuta in un rettangolo del canvas (coordinate "base" del contesto, come gli altri disegni).
 *  · tile: lato di una ripetizione della foto (coordinate base; deve dividere il canvas per restare affiancabile)
 *  · mode 'color' (predefinito): colori della foto; con tint = tinta × chiaroscuro della foto
 *      keep: quanto delle sfumature di colore della foto resta sotto la tinta (0 = solo chiaroscuro, 1 = tutte)
 *  · mode 'detail': moltiplica ciò che è già disegnato per il chiaroscuro della foto (strength)
 *  · mode 'height': scrive le altezze (chiaro = in rilievo) per la normal map
 *  · contrast, bright, alpha (mescola sopra l'esistente), rot (foto ruotata di 90°), ox/oy (spostamento 0..1)
 */
export function paintPhoto(g, name, x, y, w, h, o = {}) {
  if (!PHOTOS[name]) return false;
  const T = g.getTransform();
  const X0 = Math.round(T.a * x + T.e), Y0 = Math.round(T.d * y + T.f);
  const W = Math.round(T.a * (x + w) + T.e) - X0, H = Math.round(T.d * (y + h) + T.f) - Y0;
  if (W <= 0 || H <= 0) return false;
  // lato della ripetizione in pixel (anche frazionario: la foto si campiona in proporzione, così resta periodica esatta)
  const tdx = Math.max(4, (o.tile ?? w) * T.a), tdy = Math.max(4, (o.tile ?? w) * T.d);
  const S = Math.ceil(Math.max(tdx, tdy));
  const D = photoData(name, S), s = D.px;
  const img = g.getImageData(X0, Y0, W, H), d = img.data;
  const mode = o.mode || 'color', contrast = o.contrast ?? 1, bright = o.bright ?? 1, alpha = o.alpha ?? 1, keep = o.keep ?? 0.5;
  const strength = o.strength ?? 1, rot = !!o.rot;
  const ox = (o.ox || 0) * tdx, oy = (o.oy || 0) * tdy;
  const us = new Int32Array(W);
  for (let i = 0; i < W; i++) { const f = ((i + 0.5 + ox) / tdx) % 1; us[i] = Math.min(S - 1, Math.floor(f * S)); }
  const [mr, mg, mb] = D.mean, ml = D.lum;
  const tint = o.tint ? hexRgb(o.tint) : null;
  const base = o.base ?? 128;
  for (let j = 0; j < H; j++) {
    const v = Math.min(S - 1, Math.floor((((j + 0.5 + oy) / tdy) % 1) * S));
    for (let i = 0; i < W; i++) {
      const u = us[i];
      const k = rot ? (((S - 1 - u) * S + v) * 4) : ((v * S + u) * 4);
      const r = s[k], gg = s[k + 1], b = s[k + 2];
      const L = 0.299 * r + 0.587 * gg + 0.114 * b;
      const q = (j * W + i) * 4;
      let R, G, B;
      if (mode === 'detail') {
        const f = 1 + (1 + (L / ml - 1) * contrast - 1) * strength;
        R = d[q] * f; G = d[q + 1] * f; B = d[q + 2] * f;
      } else if (mode === 'height') {
        R = G = B = base + (L - ml) * contrast;
      } else if (tint) {
        const lr = L / ml;
        const rr = 1 + (lr + (r / mr - lr) * keep - 1) * contrast, rg = 1 + (lr + (gg / mg - lr) * keep - 1) * contrast, rb = 1 + (lr + (b / mb - lr) * keep - 1) * contrast;
        R = tint[0] * rr * bright; G = tint[1] * rg * bright; B = tint[2] * rb * bright;
      } else {
        R = (mr + (r - mr) * contrast) * bright; G = (mg + (gg - mg) * contrast) * bright; B = (mb + (b - mb) * contrast) * bright;
      }
      if (alpha < 1) { R = d[q] + (R - d[q]) * alpha; G = d[q + 1] + (G - d[q + 1]) * alpha; B = d[q + 2] + (B - d[q + 2]) * alpha; }
      d[q] = R; d[q + 1] = G; d[q + 2] = B; d[q + 3] = 255;
    }
  }
  g.putImageData(img, X0, Y0);
  return true;
}
