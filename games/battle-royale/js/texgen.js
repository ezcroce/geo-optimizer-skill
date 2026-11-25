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
