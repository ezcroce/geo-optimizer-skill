// ─────────────────────────────────────────────────────────────
//  Texture procedurali delle città (v24): facciate con finestre e persiane, intonaco a bugnato,
//  asfalto, marciapiedi, sampietrini, lamiera, tetti piani, insegne dei negozi e tende da sole.
//  Tutte le facciate ripetono 4 campate × 4 piani: una cella = 3 m × 3 m.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { normalFromHeight, NORMALS, TEXQ, ANISO, hasPhoto, paintPhoto } from './texgen.js?v=50';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

// v45: foto di base per ogni stile di muro (una ripetizione = 2 m, uguale su facciate e muri lisci)
const WALL_PHOTO = {
  plaster: { name: 'plaster', o: (c) => ({ tint: c, keep: 0.5, contrast: 0.85, bright: 1.08 }), hc: 0.7 },
  pastel: { name: 'plaster', o: (c) => ({ tint: c, keep: 0.3, contrast: 0.65, bright: 1.08 }), hc: 0.5 },
  brick: { name: 'brick', o: (c) => ({ tint: c, keep: 0.85, contrast: 1.0, bright: 1.08 }), hc: 1.3 },
  stone: { name: 'stone', o: (c) => ({ tint: c, keep: 0.55, contrast: 1.0, bright: 1.0 }), hc: 1.5 },
  wood: { name: 'wood', o: (c) => ({ tint: c, keep: 0.45, contrast: 1.1, bright: 1.05 }), hc: 0.45 },   // v46: rilievo basso, le venature non sono buchi
  modern: { name: 'concrete', o: (c) => ({ tint: c, keep: 0, contrast: 0.6, bright: 1.06 }), hc: 0.5 },   // v46: cemento vero
};
/** dipinge la foto dello stile su tutto il canvas (W×H in coordinate base, `meters` = metri coperti in larghezza) */
function wallPhoto(style, color, g, h, W, Hh, meters) {
  const P = WALL_PHOTO[style];
  if (!P || !hasPhoto(P.name)) return false;
  const tile = W / (meters / 2);
  paintPhoto(g, P.name, 0, 0, W, Hh, { tile, ...P.o(color) });
  if (h) paintPhoto(h, P.name, 0, 0, W, Hh, { tile, mode: 'height', contrast: P.hc });
  return true;
}

export const BAY = 3, FLOOR = 3;          // campata e altezza di un piano (m)

function rng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** canvas rettangolare in coordinate "base" (scalato secondo la qualità delle texture) */
function cv(bw, bh, q = TEXQ) {
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(bw * q)); c.height = Math.max(8, Math.round(bh * q));
  const g = c.getContext('2d', WRF);
  g.setTransform(c.width / bw, 0, 0, c.height / bh, 0, 0);
  return { c, g };
}
function grain(g, c, amount, rnd = Math.random) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (rnd() - 0.5) * amount; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(img, 0, 0); g.restore();
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(h, k, a = 1) {
  const [r, g, b] = hexRgb(h);
  return `rgba(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0},${a})`;
}
const gray = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;
function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO.value;
  return t;
}
function mottle(g, W, H, n, rnd, dark = 0.06, light = 0.05) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rnd() < 0.5 ? `rgba(0,0,0,${dark * rnd()})` : `rgba(255,255,255,${light * rnd()})`;
    gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ═════════ facciate (4 campate × 4 piani) ═════════
export const FACADE_STYLES = {
  plaster: { colors: ['#e3b778', '#d48a5c', '#efd9a8', '#e6b3a0', '#f0e2c0', '#c99a6e'], shutters: ['#3f6e4a', '#5a3a24', '#2f5a44', '#6a7a3a'], frame: '#efe6d2' },
  pastel: { colors: ['#f2a898', '#9fd2e6', '#f5df94', '#b8e0c0', '#f7f2ea'], shutters: ['#2a6ab0', '#f4f4f4', '#2a8a8a', '#d8503a'], frame: '#ffffff' },
  brick: { colors: ['#9a4a3a', '#b0603f'], frame: '#f2efe6' },
  modern: { colors: ['#d9dcdf', '#b8bfc6', '#ece7dd'], frame: '#34393f' },
  glass: { colors: ['#4a7fa8', '#3f8f8a', '#5a6f8f'] },
  wood: { colors: ['#8a5a32', '#a06a3a'], frame: '#f2efe6' },
  stone: { colors: ['#a8a090', '#b9ae98'], frame: '#d8d0bc' },
};
const P = 64 / 3;                 // pixel per metro nella texture di facciata (base)

function glassPane(g, x, y, w, h, rnd, tint = null) {
  const gr = g.createLinearGradient(x, y, x, y + h);
  gr.addColorStop(0, tint ? shade(tint, 1.5) : '#a9c8dc'); gr.addColorStop(0.45, tint ? shade(tint, 0.95) : '#5f7f98'); gr.addColorStop(1, tint ? shade(tint, 0.55) : '#2a3a4c');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  // riflesso obliquo del cielo
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  const o = rnd() * w;
  g.beginPath(); g.moveTo(x + o, y); g.lineTo(x + o + w * 0.35, y); g.lineTo(x + o - w * 0.2, y + h); g.lineTo(x + o - w * 0.55, y + h); g.fill();
  g.restore();
}
function shutterPanel(g, h, x, y, w, ht, color) {
  g.fillStyle = color; g.fillRect(x, y, w, ht);
  g.fillStyle = shade(color, 0.7); g.fillRect(x, y, w, 1); g.fillRect(x, y + ht - 1, w, 1); g.fillRect(x, y, 1, ht); g.fillRect(x + w - 1, y, 1, ht);
  for (let yy = y + 2.5; yy < y + ht - 1.5; yy += 2.6) { g.fillStyle = shade(color, 0.72); g.fillRect(x + 1, yy, w - 2, 0.9); g.fillStyle = shade(color, 1.18); g.fillRect(x + 1, yy + 0.9, w - 2, 0.5); }
  if (h) {
    h.fillStyle = gray(205); h.fillRect(x, y, w, ht);
    for (let yy = y + 2.5; yy < y + ht - 1.5; yy += 2.6) { h.fillStyle = gray(150); h.fillRect(x + 1, yy, w - 2, 0.9); }
  }
}

/** disegna 4×4 celle di facciata; h = canvas delle altezze (null per le varianti di colore) */
function drawFacade(style, color, g, h, rS, rC) {
  const S = FACADE_STYLES[style];
  const W = 256;
  g.fillStyle = color; g.fillRect(0, 0, W, W);
  if (h) { h.fillStyle = gray(128); h.fillRect(0, 0, W, W); }
  const photo = wallPhoto(style, color, g, h, W, W, 4 * BAY);
  if (photo && style !== 'modern' && style !== 'glass') {
    // la foto sostituisce mattoni, assi, pietre e macchie disegnati
  } else if (style === 'brick') {
    for (let y = 0; y < W; y += 4) {
      const off = (y / 4) % 2 ? 5 : 0;
      for (let x = -off; x < W; x += 10) {
        g.fillStyle = shade(color, 0.82 + rC() * 0.32); g.fillRect(x + 0.6, y + 0.6, 8.8, 2.8);
        if (h) { h.fillStyle = gray(150 + rS() * 20); h.fillRect(x + 0.6, y + 0.6, 8.8, 2.8); }
      }
    }
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#cfc6b6'; g.fillRect(0, 0, W, W); g.globalCompositeOperation = 'source-over';
    if (h) { h.globalCompositeOperation = 'destination-over'; h.fillStyle = gray(90); h.fillRect(0, 0, W, W); h.globalCompositeOperation = 'source-over'; }
  } else if (style === 'wood') {
    for (let x = 0; x < W; x += 6) {
      g.fillStyle = shade(color, 0.85 + rC() * 0.3); g.fillRect(x, 0, 6, W);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 0.8, W);
      if (h) { h.fillStyle = gray(150); h.fillRect(x + 0.8, 0, 5.2, W); h.fillStyle = gray(70); h.fillRect(x, 0, 0.8, W); }
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(40,20,5,0.18)'; g.fillRect(rC() * W, rC() * W, 0.6, 4 + rC() * 14); }
  } else if (style === 'stone') {
    for (let y = 0; y < W; y += 10) {
      let x = -rS() * 20;
      while (x < W) {
        const bw = 14 + rS() * 14;
        g.fillStyle = shade(color, 0.8 + rC() * 0.35); g.fillRect(x + 1, y + 1, bw - 2, 8);
        if (h) { h.fillStyle = gray(150 + rS() * 30); h.fillRect(x + 1, y + 1, bw - 2, 8); }
        x += bw;
      }
    }
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = shade(color, 0.6); g.fillRect(0, 0, W, W); g.globalCompositeOperation = 'source-over';
    if (h) { h.globalCompositeOperation = 'destination-over'; h.fillStyle = gray(80); h.fillRect(0, 0, W, W); h.globalCompositeOperation = 'source-over'; }
  } else if (style === 'modern') {
    if (!photo) mottle(g, W, W, 20, rC, 0.03, 0.03);
    for (let y = 0; y <= W; y += 32) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y - 0.5, W, 1); if (h) { h.fillStyle = gray(100); h.fillRect(0, y - 0.5, W, 1); } }
    for (let x = 0; x <= W; x += 32) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x - 0.5, 0, 1, W); if (h) { h.fillStyle = gray(100); h.fillRect(x - 0.5, 0, 1, W); } }
  } else if (style === 'glass') {
    const gr = g.createLinearGradient(0, 0, 0, W);
    gr.addColorStop(0, shade(color, 1.75)); gr.addColorStop(0.5, shade(color, 1.0)); gr.addColorStop(1, shade(color, 0.62));
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 7; i++) {      // nuvole riflesse
      const x = rC() * W, y = rC() * W * 0.6, r = 18 + rC() * 30;
      const cg = g.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(255,255,255,0.22)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (h) { h.fillStyle = gray(110); h.fillRect(0, 0, W, W); }
  } else {
    // intonaco (anche pastello): macchie morbide e leggera grana
    mottle(g, W, W, 36, rC, 0.07, 0.06);
  }
  for (let r = 0; r < 4; r++) {
    const top = r * 64;
    // marcapiano (fascia orizzontale al livello del pavimento: in basso nella cella)
    if (style === 'plaster' || style === 'pastel' || style === 'stone') {
      g.fillStyle = style === 'stone' ? shade(color, 1.15) : 'rgba(255,255,255,0.22)'; g.fillRect(0, top + 60, W, 3.2);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, top + 63.2, W, 0.8);
      if (h) { h.fillStyle = gray(185); h.fillRect(0, top + 60, W, 3.2); }
    }
    if (style === 'glass') {
      g.fillStyle = shade(color, 0.38); g.fillRect(0, top + 55, W, 9);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, top + 55, W, 0.8);
      if (h) { h.fillStyle = gray(150); h.fillRect(0, top + 55, W, 9); }
    }
    for (let c = 0; c < 4; c++) {
      const cx = c * 64 + 32, v = rS();
      if (style === 'glass') {
        for (const px of [c * 64, c * 64 + 32]) {
          const k = rC();
          g.fillStyle = k < 0.3 ? 'rgba(0,0,0,0.10)' : k > 0.8 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0)'; g.fillRect(px, top, 32, 55);
          if (k > 0.55 && k < 0.7) { g.fillStyle = 'rgba(235,235,225,0.22)'; for (let yy = top + 3; yy < top + 30; yy += 2) g.fillRect(px + 2, yy, 28, 0.8); }   // tende alla veneziana
          g.fillStyle = '#20262c'; g.fillRect(px - 0.8, top, 1.6, 64);
          if (h) { h.fillStyle = gray(175); h.fillRect(px - 0.8, top, 1.6, 64); }
        }
        continue;
      }
      if (style === 'modern') {
        const ww = 2.5 * P, wh = 1.55 * P, wy1 = top + 64 - 0.9 * P, wy0 = wy1 - wh;
        g.fillStyle = S.frame; g.fillRect(cx - ww / 2 - 1.5, wy0 - 1.5, ww + 3, wh + 3);
        glassPane(g, cx - ww / 2, wy0, ww, wh, rC);
        g.fillStyle = S.frame; g.fillRect(cx - 0.8, wy0, 1.6, wh);
        if (rC() < 0.3) { g.fillStyle = 'rgba(240,236,226,0.75)'; g.fillRect(cx - ww / 2, wy0, ww * 0.45, wh); }
        if (h) { h.fillStyle = gray(165); h.fillRect(cx - ww / 2 - 1.5, wy0 - 1.5, ww + 3, wh + 3); h.fillStyle = gray(40); h.fillRect(cx - ww / 2, wy0, ww, wh); }
        continue;
      }
      const small = style === 'wood' || style === 'stone';
      const ww = (small ? 1.05 : 1.2) * P, wh = (small ? 1.35 : 1.8) * P, wy1 = top + 64 - (small ? 1.05 : 0.9) * P, wy0 = wy1 - wh;
      const frame = S.frame;
      if (style === 'stone') {
        // finestra ad arco con conci
        g.fillStyle = shade(color, 1.25);
        g.beginPath(); g.moveTo(cx - ww / 2 - 3, wy1 + 2); g.lineTo(cx - ww / 2 - 3, wy0 + ww / 2); g.arc(cx, wy0 + ww / 2, ww / 2 + 3, Math.PI, 0); g.lineTo(cx + ww / 2 + 3, wy1 + 2); g.fill();
        g.save(); g.beginPath(); g.moveTo(cx - ww / 2, wy1); g.lineTo(cx - ww / 2, wy0 + ww / 2); g.arc(cx, wy0 + ww / 2, ww / 2, Math.PI, 0); g.lineTo(cx + ww / 2, wy1); g.clip();
        glassPane(g, cx - ww / 2, wy0, ww, wh, rC); g.restore();
        g.fillStyle = shade(color, 0.6); g.fillRect(cx - 0.6, wy0 + 4, 1.2, wh - 4);
        if (h) {
          h.fillStyle = gray(190); h.beginPath(); h.moveTo(cx - ww / 2 - 3, wy1 + 2); h.lineTo(cx - ww / 2 - 3, wy0 + ww / 2); h.arc(cx, wy0 + ww / 2, ww / 2 + 3, Math.PI, 0); h.lineTo(cx + ww / 2 + 3, wy1 + 2); h.fill();
          h.fillStyle = gray(30); h.beginPath(); h.moveTo(cx - ww / 2, wy1); h.lineTo(cx - ww / 2, wy0 + ww / 2); h.arc(cx, wy0 + ww / 2, ww / 2, Math.PI, 0); h.lineTo(cx + ww / 2, wy1); h.fill();
        }
        continue;
      }
      // cornice in pietra, cimasa e davanzale
      g.fillStyle = frame; g.fillRect(cx - ww / 2 - 2.5, wy0 - 2.5, ww + 5, wh + 5);
      if (style !== 'wood') { g.fillRect(cx - ww / 2 - 5, wy0 - 7, ww + 10, 3.6); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - ww / 2 - 5, wy0 - 3.4, ww + 10, 0.9); }
      g.fillStyle = frame; g.fillRect(cx - ww / 2 - 4, wy1 + 1.5, ww + 8, 2.6);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - ww / 2 - 4, wy1 + 4.1, ww + 8, 0.8);
      if (style === 'brick') { for (let x = cx - ww / 2 - 2; x < cx + ww / 2 + 2; x += 2.4) { g.fillStyle = shade(color, 0.7 + rC() * 0.2); g.fillRect(x, wy0 - 7, 2, 4.5); } }
      glassPane(g, cx - ww / 2, wy0, ww, wh, rC);
      if (rC() < 0.35) { g.fillStyle = 'rgba(244,236,220,0.82)'; g.fillRect(cx - ww / 2, wy0, ww * 0.3, wh); g.fillRect(cx + ww / 2 - ww * 0.3, wy0, ww * 0.3, wh); }
      g.fillStyle = frame; g.fillRect(cx - 0.8, wy0, 1.6, wh); g.fillRect(cx - ww / 2, wy0 + wh * 0.32, ww, 1.4);
      if (h) {
        h.fillStyle = gray(182); h.fillRect(cx - ww / 2 - 2.5, wy0 - 2.5, ww + 5, wh + 5);
        if (style !== 'wood') { h.fillStyle = gray(210); h.fillRect(cx - ww / 2 - 5, wy0 - 7, ww + 10, 3.6); }
        h.fillStyle = gray(215); h.fillRect(cx - ww / 2 - 4, wy1 + 1.5, ww + 8, 2.6);
        h.fillStyle = gray(25); h.fillRect(cx - ww / 2, wy0, ww, wh);
        h.fillStyle = gray(120); h.fillRect(cx - 0.8, wy0, 1.6, wh);
      }
      // persiane (aperte, chiuse o assenti)
      if (S.shutters) {
        const sc = S.shutters[Math.floor(rS() * S.shutters.length)];
        if (v < 0.16) { shutterPanel(g, h, cx - ww / 2, wy0, ww / 2, wh, sc); shutterPanel(g, h, cx, wy0, ww / 2, wh, sc); }
        else if (v < 0.82) { shutterPanel(g, h, cx - ww / 2 - 3 - ww / 2, wy0 - 1, ww / 2, wh + 2, sc); shutterPanel(g, h, cx + ww / 2 + 3, wy0 - 1, ww / 2, wh + 2, sc); }
      }
      if (style === 'wood') {
        // fioriera sotto la finestra
        g.fillStyle = '#7a3a1e'; g.fillRect(cx - ww / 2 - 2, wy1 + 4, ww + 4, 4);
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? '#3f8a3a' : (rC() < 0.5 ? '#e03a4a' : '#f070a0'); g.beginPath(); g.arc(cx - ww / 2 + 1 + i * (ww / 8), wy1 + 3 - rC() * 2, 1.6, 0, 7); g.fill(); }
        if (h) { h.fillStyle = gray(220); h.fillRect(cx - ww / 2 - 2, wy1 + 1, ww + 4, 7); }
      }
      // colature di sporco sotto il davanzale
      const sg = g.createLinearGradient(0, wy1 + 4, 0, wy1 + 20);
      sg.addColorStop(0, 'rgba(40,30,20,0.10)'); sg.addColorStop(1, 'rgba(40,30,20,0)');
      g.fillStyle = sg; g.fillRect(cx - ww / 2, wy1 + 4, ww, 16);
    }
  }
}

const facadeNormals = new Map(), facadeCache = new Map();
/** texture di facciata (colore + normal map condivisa per stile) */
export function facadeTexture(style, color) {
  const key = style + color;
  if (facadeCache.has(key)) return facadeCache.get(key);
  const seed = Object.keys(FACADE_STYLES).indexOf(style) * 101 + 7;
  // v46: le facciate in legno (solo 2 colori) hanno il doppio di risoluzione, così le assi della foto si leggono anche da vicino
  const fq = style === 'wood' ? Math.min(2, TEXQ) * 2 : TEXQ;
  const { c, g } = cv(256, 256, fq);
  let H = null;
  if (NORMALS && !facadeNormals.has(style)) H = cv(256, 256, fq);
  drawFacade(style, color, g, H && H.g, rng(seed), rng(seed * 31 + parseInt(color.slice(1), 16)));
  grain(g, c, style === 'glass' ? 6 : 14);
  if (H) {
    // v46: con la foto il rilievo c'è già; il rumore per pixel, ingrandito da vicino, faceva le "bolle"
    const ph = WALL_PHOTO[style] && hasPhoto(WALL_PHOTO[style].name);
    grain(H.g, H.c, ph ? 4 : 26);
    facadeNormals.set(style, normalFromHeight(H.c, style === 'glass' ? 1.2 : ph ? (style === 'wood' ? 0.8 : 0.9) : 2.4));
  }
  const t = tex(c);
  t.repeat.set(2 / (4 * BAY), 2 / (4 * FLOOR));
  if (NORMALS) { const n = facadeNormals.get(style); n.repeat.copy(t.repeat); t.userData.normal = n; }
  facadeCache.set(key, t);
  return t;
}

// ═════════ muri lisci (piano terra, parapetti, fianchi): ripetono ogni 2 m ═════════
const plainNormals = new Map(), plainCache = new Map();
export function plainTexture(style, color) {
  const key = style + color;
  if (plainCache.has(key)) return plainCache.get(key);
  const { c, g } = cv(128, 128);
  const needH = NORMALS && !plainNormals.has(style);
  const H = needH ? cv(128, 128) : null, h = H && H.g;
  const rS = rng(Object.keys(FACADE_STYLES).indexOf(style) * 13 + 3), rC = rng(parseInt(color.slice(1), 16));
  const base = style === 'glass' ? '#4a4d52' : color;
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  if (h) { h.fillStyle = gray(150); h.fillRect(0, 0, 128, 128); }
  const photo = wallPhoto(style, color, g, h, 128, 128, 2);
  if (photo && style !== 'plaster' && style !== 'modern') {
    // foto al posto del disegno
  } else if (style === 'plaster' || style === 'pastel') {
    if (!photo) mottle(g, 128, 128, 24, rC, 0.07, 0.05);
    if (style === 'plaster') {
      // bugnato: corsi orizzontali ogni 50 cm, giunti sfalsati ogni metro
      for (let y = 0; y < 128; y += 32) {
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y, 128, 2); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y + 2, 128, 1);
        const off = (y / 32) % 2 ? 32 : 0;
        for (let x = off; x < 128 + 64; x += 64) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 1, y, 2, 32); }
        if (h) { h.fillStyle = gray(60); h.fillRect(0, y, 128, 2.5); for (let x = off; x < 128 + 64; x += 64) h.fillRect(x - 1, y, 2, 32); }
      }
    }
  } else if (style === 'brick') {
    g.fillStyle = '#cfc6b6'; g.fillRect(0, 0, 128, 128);
    if (h) { h.fillStyle = gray(80); h.fillRect(0, 0, 128, 128); }
    for (let y = 0; y < 128; y += 4.27) {
      const off = Math.round(y / 4.27) % 2 ? 6 : 0;
      for (let x = -off; x < 128; x += 12) {
        g.fillStyle = shade(color, 0.8 + rC() * 0.35); g.fillRect(x + 0.6, y + 0.6, 10.8, 3.1);
        if (h) { h.fillStyle = gray(160 + rS() * 30); h.fillRect(x + 0.6, y + 0.6, 10.8, 3.1); }
      }
    }
  } else if (style === 'modern' || style === 'glass') {
    mottle(g, 128, 128, 12, rC, 0.05, 0.04);
    for (let k = 0; k <= 128; k += 64) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, k - 0.8, 128, 1.6); g.fillRect(k - 0.8, 0, 1.6, 128); if (h) { h.fillStyle = gray(70); h.fillRect(0, k - 0.8, 128, 1.6); h.fillRect(k - 0.8, 0, 1.6, 128); } }
    if (style === 'glass') for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${rC() * 0.08})`; g.fillRect(rC() * 128, rC() * 128, 1, 1); }
  } else if (style === 'wood') {
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = shade(color, 0.85 + rC() * 0.3); g.fillRect(x, 0, 8, 128); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 1, 128);
      if (h) { h.fillStyle = gray(70); h.fillRect(x, 0, 1, 128); }
    }
  } else if (style === 'stone') {
    g.fillStyle = shade(color, 0.6); g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      let x = -rS() * 30;
      while (x < 128) { const bw = 20 + rS() * 24; g.fillStyle = shade(color, 0.82 + rC() * 0.3); g.fillRect(x + 1, y + 1, bw - 2, 14); if (h) { h.fillStyle = gray(150 + rS() * 40); h.fillRect(x + 1, y + 1, bw - 2, 14); } x += bw; }
    }
  }
  // sporco in basso (schizzi dal marciapiede)
  const sg = g.createLinearGradient(0, 96, 0, 128); sg.addColorStop(0, 'rgba(50,40,30,0)'); sg.addColorStop(1, 'rgba(50,40,30,0.12)');
  g.fillStyle = sg; g.fillRect(0, 96, 128, 32);
  grain(g, c, 12);
  if (H) { const ph = WALL_PHOTO[style] && hasPhoto(WALL_PHOTO[style].name); grain(h, H.c, ph ? 4 : 30); plainNormals.set(style, normalFromHeight(H.c, ph ? 1.0 : 2.2)); }
  const t = tex(c);
  if (NORMALS) t.userData.normal = plainNormals.get(style);
  plainCache.set(key, t);
  return t;
}

// ═════════ superfici: asfalto, marciapiede, sampietrini, tetto piano, piastrelle, cemento, lamiera ═════════
const simple = new Map();
function once(key, f) { if (!simple.has(key)) simple.set(key, f()); return simple.get(key); }
function withH(c, H, strength) { const t = tex(c); if (NORMALS && H) t.userData.normal = normalFromHeight(H.c, strength); return t; }

export const asphaltTexture = () => once('asphalt', () => {
  const r = rng(11), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  g.fillStyle = '#45474b'; g.fillRect(0, 0, 128, 128);
  if (hasPhoto('asphalt')) {
    // v45: asfalto fotografico (contrasto ridotto: le macchie grandi non devono ripetersi ogni 2 m)
    paintPhoto(g, 'asphalt', 0, 0, 128, 128, { contrast: 0.8, bright: 1.0 });
    if (H) paintPhoto(H.g, 'asphalt', 0, 0, 128, 128, { mode: 'height', contrast: 1.4 });
    return withH(c, H, 1.2);
  }
  mottle(g, 128, 128, 30, r, 0.12, 0.05);
  for (let i = 0; i < 2600; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.25 * r()})` : `rgba(220,220,215,${0.22 * r()})`; g.fillRect(r() * 128, r() * 128, 0.7 + r() * 0.8, 0.7 + r() * 0.8); }
  // crepe sottili e rattoppi
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6;
  for (let k = 0; k < 4; k++) { let x = r() * 128, y = r() * 128; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (r() - 0.5) * 10; y += (r() - 0.5) * 10; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(20,20,22,0.25)'; g.fillRect(r() * 90, r() * 90, 22 + r() * 18, 14 + r() * 12);
  grain(g, c, 16, r);
  if (H) { H.g.fillStyle = gray(128); H.g.fillRect(0, 0, 128, 128); grain(H.g, H.c, 70, r); }
  return withH(c, H, 1.2);
});
export const sidewalkTexture = () => once('sidewalk', () => {
  const r = rng(21), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  g.fillStyle = '#9d988f'; g.fillRect(0, 0, 128, 128);
  if (H) { H.g.fillStyle = gray(60); H.g.fillRect(0, 0, 128, 128); }
  if (hasPhoto('slabs')) {
    paintPhoto(g, 'slabs', 0, 0, 128, 128, { bright: 0.95 });
    if (H) paintPhoto(H.g, 'slabs', 0, 0, 128, 128, { mode: 'height', contrast: 1.6 });
    return withH(c, H, 1.6);
  }
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
    const k = 0.92 + r() * 0.14;
    g.fillStyle = shade('#c2bdb2', k); g.fillRect(x + 0.8, y + 0.8, 30.4, 30.4);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(x + r() * 30, y + r() * 30, 1, 1); }
    if (H) { H.g.fillStyle = gray(165 + r() * 20); H.g.fillRect(x + 0.8, y + 0.8, 30.4, 30.4); }
  }
  mottle(g, 128, 128, 10, r, 0.08, 0.03);
  grain(g, c, 12, r);
  return withH(c, H, 1.6);
});
export const cobbleTexture = () => once('cobble', () => {
  // sampietrini: cubetti di porfido/basalto a file leggermente sfalsate
  const r = rng(31), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  g.fillStyle = '#5a554c'; g.fillRect(0, 0, 128, 128);
  if (H) { H.g.fillStyle = gray(40); H.g.fillRect(0, 0, 128, 128); }
  if (hasPhoto('cobble')) {
    paintPhoto(g, 'cobble', 0, 0, 128, 128, { bright: 1.0 });
    if (H) paintPhoto(H.g, 'cobble', 0, 0, 128, 128, { mode: 'height', contrast: 1.9 });
    return withH(c, H, 2.4);
  }
  const s = 6.4;
  for (let row = 0; row < 20; row++) {
    const off = (row % 2) * s * 0.5 + r() * 1.5;
    for (let x = -s + off; x < 128; x += s) {
      const y = row * s, k = 0.75 + r() * 0.45, tone = r() < 0.5 ? '#8e877a' : '#7a7468';
      g.fillStyle = shade(tone, k);
      const jx = (r() - 0.5) * 0.8, jy = (r() - 0.5) * 0.8;
      g.beginPath(); g.roundRect(x + 0.7 + jx, y + 0.7 + jy, s - 1.4, s - 1.4, 1.4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 1.3 + jx, y + 1.1 + jy, s - 3, 1);
      if (H) { H.g.fillStyle = gray(150 + r() * 70); H.g.beginPath(); H.g.roundRect(x + 0.7 + jx, y + 0.7 + jy, s - 1.4, s - 1.4, 1.6); H.g.fill(); }
    }
  }
  grain(g, c, 14, r);
  return withH(c, H, 2.6);
});
export const roofFlatTexture = () => once('roofFlat', () => {
  const r = rng(41), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  g.fillStyle = '#7d7c78'; g.fillRect(0, 0, 128, 128);
  if (hasPhoto('asphalt')) {
    // tetto piano: guaina con ghiaietto (asfalto fotografico schiarito)
    paintPhoto(g, 'asphalt', 0, 0, 128, 128, { tint: '#8a8984', keep: 0, contrast: 0.9, ox: 0.5, oy: 0.5 });
    for (let y = 0; y < 128; y += 42) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 128, 1.4); }
    if (H) paintPhoto(H.g, 'asphalt', 0, 0, 128, 128, { mode: 'height', contrast: 1.4, ox: 0.5, oy: 0.5 });
    return withH(c, H, 1.4);
  }
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.2 * r()})` : `rgba(255,255,255,${0.18 * r()})`; g.fillRect(r() * 128, r() * 128, 1, 1); }
  for (let y = 0; y < 128; y += 42) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 128, 1.4); }
  mottle(g, 128, 128, 14, r, 0.12, 0.04);
  if (H) { H.g.fillStyle = gray(128); H.g.fillRect(0, 0, 128, 128); grain(H.g, H.c, 90, r); }
  return withH(c, H, 1.4);
});
export const tileTexture = () => once('tile', () => {
  const r = rng(51), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, 128, 128);
  if (H) { H.g.fillStyle = gray(80); H.g.fillRect(0, 0, 128, 128); }
  for (let y = 0; y < 128; y += 25.6) for (let x = 0; x < 128; x += 25.6) {
    const chk = (Math.round(x / 25.6) + Math.round(y / 25.6)) % 2;
    g.fillStyle = shade(chk ? '#e8e2d6' : '#d8d0c2', 0.95 + r() * 0.08); g.fillRect(x + 0.6, y + 0.6, 24.4, 24.4);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, y + 2, 10, 2);
    if (H) { H.g.fillStyle = gray(170); H.g.fillRect(x + 0.6, y + 0.6, 24.4, 24.4); }
  }
  grain(g, c, 8, r);
  return withH(c, H, 1.2);
});
export const concreteTexture = () => once('concrete', () => {
  const r = rng(61), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  g.fillStyle = '#a5a29b'; g.fillRect(0, 0, 128, 128);
  const cname = hasPhoto('concrete') ? 'concrete' : 'plaster';
  if (hasPhoto(cname)) {
    // cemento fotografico (v46: foto dedicata con i forellini d'aria; prima intonaco grigio)
    paintPhoto(g, cname, 0, 0, 128, 128, { tint: '#a5a29b', keep: 0.15, contrast: 0.85, oy: 0.3 });
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 1); g.fillRect(0, 0, 1, 128);
    if (H) { paintPhoto(H.g, cname, 0, 0, 128, 128, { mode: 'height', contrast: 1.0, oy: 0.3 }); H.g.fillStyle = gray(60); H.g.fillRect(0, 0, 128, 1.2); H.g.fillRect(0, 0, 1.2, 128); }
    return withH(c, H, 1.0);
  }
  mottle(g, 128, 128, 30, r, 0.1, 0.06);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 1); g.fillRect(0, 0, 1, 128);
  grain(g, c, 14, r);
  if (H) { H.g.fillStyle = gray(128); H.g.fillRect(0, 0, 128, 128); grain(H.g, H.c, 40, r); H.g.fillStyle = gray(60); H.g.fillRect(0, 0, 128, 1.2); H.g.fillRect(0, 0, 1.2, 128); }
  return withH(c, H, 1.3);
});
/** lamiera ondulata chiara: il colore viene dal materiale (una texture per tutti i capannoni) */
export const corrugatedTexture = () => once('corr', () => {
  const r = rng(71), { c, g } = cv(128, 128), H = NORMALS ? cv(128, 128) : null;
  if (hasPhoto('metal')) {
    // v46: lamiera zincata fotografica con colature di ruggine (chiara: il colore lo dà il materiale)
    paintPhoto(g, 'metal', 0, 0, 128, 128, { bright: 1.18, contrast: 1.0 });
    if (H) {
      // onde regolari (16 ogni 2 m, come la foto) + ammaccature dalla foto
      for (let x = 0; x < 128; x += 8) { const hg = H.g.createLinearGradient(x, 0, x + 8, 0); hg.addColorStop(0, gray(50)); hg.addColorStop(0.5, gray(205)); hg.addColorStop(1, gray(50)); H.g.fillStyle = hg; H.g.fillRect(x, 0, 8, 128); }
      paintPhoto(H.g, 'metal', 0, 0, 128, 128, { mode: 'detail', strength: 0.35, contrast: 1.0 });
    }
    return withH(c, H, 1.6);
  }
  for (let x = 0; x < 128; x += 8) {
    const gr = g.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, '#b8b8b8'); gr.addColorStop(0.5, '#f4f4f4'); gr.addColorStop(1, '#a8a8a8');
    g.fillStyle = gr; g.fillRect(x, 0, 8, 128);
    if (H) { const hg = H.g.createLinearGradient(x, 0, x + 8, 0); hg.addColorStop(0, gray(40)); hg.addColorStop(0.5, gray(220)); hg.addColorStop(1, gray(40)); H.g.fillStyle = hg; H.g.fillRect(x, 0, 8, 128); }
  }
  for (let i = 0; i < 18; i++) { const x = r() * 128, y = r() * 128, l = 10 + r() * 40; const sg = g.createLinearGradient(0, y, 0, y + l); sg.addColorStop(0, 'rgba(120,60,20,0.18)'); sg.addColorStop(1, 'rgba(120,60,20,0)'); g.fillStyle = sg; g.fillRect(x, y, 2 + r() * 4, l); }
  g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < 128; y += 64) g.fillRect(0, y, 128, 1);
  grain(g, c, 10, r);
  return withH(c, H, 2.2);
});
/** ringhiera: sbarre verticali con trasparenza (alphaTest), nella metà bassa della texture (pannelli alti 1 m) */
export const railTexture = () => once('rail', () => {
  const { c, g } = cv(64, 64, Math.max(1, TEXQ));
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#25282c';
  g.fillRect(0, 32 + 0.2, 64, 2.2); g.fillRect(0, 62, 64, 2);
  for (let x = 0; x < 64; x += 4) g.fillRect(x + 1.2, 32, 1.4, 32);
  const t = tex(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
});
/** tende da sole a righe (le righe seguono la larghezza della tenda) */
export const AWNING_COLORS = [['#d8323a', '#f4efe4'], ['#1f6fb8', '#f4efe4'], ['#2f8a4a', '#f4efe4'], ['#e8a020', '#4a2a1a'], ['#7a2a5a', '#f2d8e8'], ['#3a3a3a', '#d8d0bc']];
export function awningTexture(i) {
  return once('awn' + i, () => {
    const [a, b] = AWNING_COLORS[i % AWNING_COLORS.length];
    const { c, g } = cv(64, 64);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? b : a; g.fillRect(k * 8, 0, 8, 64); }
    g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 64; y += 6) g.fillRect(0, y, 64, 1);
    grain(g, c, 10);
    return tex(c);
  });
}

// ═════════ insegne dei negozi: un atlante 4 × 8 con tutti i nomi ═════════
export const SHOPS = [
  { n: 'BAR', bg: '#1f3a5a', fg: '#ffd24a', f: 'cafe', tags: 'u c a i' },
  { n: 'PIZZERIA', bg: '#b8322a', fg: '#ffffff', f: 'cafe', tags: 'u c' },
  { n: 'FARMACIA', bg: '#1f8a4a', fg: '#ffffff', f: 'shelves', cross: true, tags: 'u c a' },
  { n: 'ALIMENTARI', bg: '#f2e6c8', fg: '#7a3a1a', f: 'market', tags: 'u c a' },
  { n: 'PANETTERIA', bg: '#7a4a2a', fg: '#ffe6b0', f: 'bakery', tags: 'u c a' },
  { n: 'GELATERIA', bg: '#f7c6d8', fg: '#b0306a', f: 'gelato', tags: 'u c' },
  { n: 'TABACCHI', bg: '#1a1a2a', fg: '#ffffff', f: 'shelves', tags: 'u c a' },
  { n: 'EDICOLA', bg: '#2a6ab0', fg: '#ffffff', f: 'books', tags: 'u c' },
  { n: 'BANCA', bg: '#e8e4da', fg: '#1f3a5a', f: 'bank', tags: 'u' },
  { n: 'HOTEL', bg: '#3a2a5a', fg: '#ffd24a', f: 'lobby', tags: 'u c a w' },
  { n: 'RISTORANTE', bg: '#5a2a1a', fg: '#f2d8a0', f: 'cafe', tags: 'u c a' },
  { n: 'FERRAMENTA', bg: '#d8402a', fg: '#ffffff', f: 'shelves', tags: 'u i' },
  { n: 'ABBIGLIAMENTO', bg: '#111111', fg: '#f2f2f2', f: 'clothes', tags: 'u' },
  { n: 'SUPERMERCATO', bg: '#e03a2a', fg: '#ffffff', f: 'market', tags: 'u c' },
  { n: 'CINEMA', bg: '#8a1a2a', fg: '#ffd24a', f: 'lobby', tags: 'u' },
  { n: 'OTTICA', bg: '#ffffff', fg: '#1f3a5a', f: 'shelves', tags: 'u' },
  { n: 'FIORAIO', bg: '#3a7a3a', fg: '#ffe6f0', f: 'flowers', tags: 'u c' },
  { n: 'MACELLERIA', bg: '#a82a2a', fg: '#ffffff', f: 'market', tags: 'u a' },
  { n: 'PESCHERIA', bg: '#2a7aa8', fg: '#ffffff', f: 'market', tags: 'c' },
  { n: 'LIBRERIA', bg: '#4a3a2a', fg: '#f2e6c8', f: 'books', tags: 'u' },
  { n: 'CAFFÈ', bg: '#3a2418', fg: '#f2d8a0', f: 'cafe', tags: 'u c' },
  { n: 'POSTE', bg: '#ffd200', fg: '#1f3a8a', f: 'bank', tags: 'u a' },
  { n: 'MUNICIPIO', bg: '#d8d0bc', fg: '#3a2a1a', f: 'lobby', tags: '' },
  { n: 'PALESTRA', bg: '#222831', fg: '#3ad6ff', f: 'clothes', tags: 'u' },
  { n: 'SALOON', bg: '#5a3a1e', fg: '#ffd8a0', f: 'cafe', tags: 'w' },
  { n: 'SCERIFFO', bg: '#4a2e18', fg: '#ffd24a', f: 'bank', tags: 'w' },
  { n: 'EMPORIO', bg: '#6a4a2a', fg: '#f2e6c8', f: 'market', tags: 'w' },
  { n: 'BARBIERE', bg: '#f2f2f2', fg: '#b8322a', f: 'shelves', tags: 'w' },
  { n: 'RIFUGIO', bg: '#5a3a24', fg: '#f2e6c8', f: 'cafe', tags: 'a' },
  { n: 'NOLEGGIO SCI', bg: '#2a6ab0', fg: '#ffffff', f: 'clothes', tags: 'a' },
  { n: 'OFFICINA', bg: '#3a3f45', fg: '#ffb020', f: 'shelves', tags: 'i' },
  { n: 'MAGAZZINO', bg: '#555b62', fg: '#ffffff', f: 'market', tags: 'i' },
];
export const signAtlas = () => once('signs', () => {
  const q = TEXQ < 1 ? 0.5 : 1;
  const { c, g } = cv(1024, 512, q);
  for (let i = 0; i < SHOPS.length; i++) {
    const s = SHOPS[i], x = (i % 4) * 256, y = Math.floor(i / 4) * 64;
    g.fillStyle = s.bg; g.fillRect(x, y, 256, 64);
    const gr = g.createLinearGradient(0, y, 0, y + 64); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = gr; g.fillRect(x, y, 256, 64);
    g.strokeStyle = s.fg; g.globalAlpha = 0.55; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, 244, 52); g.globalAlpha = 1;
    let fs = 40;
    g.font = `900 ${fs}px "Trebuchet MS", "Arial Black", Arial, sans-serif`;
    while (g.measureText(s.n).width > 220 && fs > 16) { fs -= 2; g.font = `900 ${fs}px "Trebuchet MS", "Arial Black", Arial, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(s.n, x + 129, y + 34);
    g.fillStyle = s.fg; g.fillText(s.n, x + 128, y + 32);
  }
  const t = tex(c, false);
  t.generateMipmaps = true;
  return t;
});
/** piano con le coordinate UV della cella dell'insegna i (rivolto verso +z) */
export function signGeometry(i, w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const u0 = (i % 4) / 4 + 0.002, u1 = (i % 4 + 1) / 4 - 0.002, r = Math.floor(i / 4), v0 = 1 - (r + 1) / 8 + 0.003, v1 = 1 - r / 8 - 0.003;
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
  return g;
}

// ═════════ merci sugli scaffali e libri (righe alte 1/3 di metro, la texture ripete ogni 2 m) ═════════
export const productsTexture = () => once('products', () => {
  const r = rng(81), { c, g } = cv(256, 256);
  g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, 256, 256);
  const pal = ['#d8323a', '#f2c230', '#2f8a4a', '#1f6fb8', '#f07a20', '#7a2a8a', '#f2f2f2', '#3a3a3a', '#e85a8a', '#4ab0c8', '#a8c838', '#c8a070'];
  const rowH = 256 / 6;
  for (let row = 0; row < 6; row++) {
    const y1 = (row + 1) * rowH - 3;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, row * rowH, 256, 4);             // ombra del ripiano sopra
    let x = 1;
    while (x < 255) {
      const kind = r(), col = pal[Math.floor(r() * pal.length)];
      const bw = kind < 0.4 ? 6 + r() * 6 : kind < 0.75 ? 10 + r() * 12 : 14 + r() * 16;
      const bh = kind < 0.4 ? rowH * (0.55 + r() * 0.3) : rowH * (0.4 + r() * 0.45);
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n && x < 255; k++) {
        const top = y1 - bh;
        if (kind < 0.4) {     // bottiglie / lattine
          g.fillStyle = col; g.fillRect(x, top + bh * 0.25, bw - 1, bh * 0.75);
          g.fillRect(x + bw * 0.3, top, bw * 0.35, bh * 0.3);
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x, top + bh * 0.5, bw - 1, bh * 0.18);
        } else {              // scatole
          g.fillStyle = col; g.fillRect(x, top, bw - 1, bh);
          g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 2, top + bh * 0.3, bw - 5, bh * 0.22);
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + bw - 3, top, 2, bh);
        }
        x += bw;
      }
      x += 1 + r() * 3;
    }
    g.fillStyle = '#9aa0a6'; g.fillRect(0, y1, 256, 3);
  }
  grain(g, c, 8, r);
  return tex(c);
});
export const booksTexture = () => once('books', () => {
  const r = rng(91), { c, g } = cv(256, 256);
  g.fillStyle = '#5a3a24'; g.fillRect(0, 0, 256, 256);
  const pal = ['#8a2a2a', '#2a4a7a', '#3a6a3a', '#c8a040', '#5a3a6a', '#d8d0c0', '#1f1f24', '#a8582a', '#2a6a6a'];
  const rowH = 256 / 6;
  for (let row = 0; row < 6; row++) {
    const y1 = (row + 1) * rowH - 4;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, row * rowH, 256, 5);
    let x = 2;
    while (x < 254) {
      const bw = 2.5 + r() * 4, bh = rowH * (0.6 + r() * 0.3), col = pal[Math.floor(r() * pal.length)];
      if (r() < 0.06) { x += 6; continue; }
      g.fillStyle = col; g.fillRect(x, y1 - bh, bw - 0.5, bh);
      g.fillStyle = 'rgba(255,230,160,0.55)'; g.fillRect(x, y1 - bh * 0.75, bw - 0.5, 1); g.fillRect(x, y1 - bh * 0.3, bw - 0.5, 1);
      x += bw;
    }
    g.fillStyle = '#7a5232'; g.fillRect(0, y1, 256, 4);
  }
  grain(g, c, 10, r);
  return tex(c);
});
