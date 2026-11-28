// ─────────────────────────────────────────────────────────────
//  Texture procedurali dei personaggi: tessuti (cotone, jeans, lino,
//  ripstop, maglia, seta, imbottito), pelle, cuoio, metallo, capelli e
//  fantasie colorate (mimetica, scozzese, quadretti, esagoni, squame, brina,
//  macchie). Tutte ripetibili, con normal map ricavata dal rilievo.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=52';
/** v47: canvas delle texture in memoria normale: si rileggono i pixel (rilievo, foto) senza farli tornare dalla GPU */
const WRF = { willReadFrequently: true };

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const col = (hex) => new THREE.Color(hex);
const css = (c) => '#' + c.getHexString();
const shade = (hex, k) => css(col(hex).multiplyScalar(k));
const mix = (a, b, t) => css(col(a).lerp(col(b), t));

/** ripete un disegno ai bordi così la texture si affianca senza giunte */
function wrap(S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    if (x + dx + r < 0 || x + dx - r > S || y + dy + r < 0 || y + dy - r > S) continue;
    fn(x + dx, y + dy);
  }
}
function blob(g, x, y, r, rnd, sx = 1.5) {
  g.beginPath();
  const n = 10, ph = rnd() * 6;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, rr = r * (0.65 + 0.3 * Math.sin(a * 3 + ph) + rnd() * 0.25);
    const px = x + Math.cos(a) * rr * sx, py = y + Math.sin(a) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
function dots(g, S, rnd, n, a, b, size = 1) {
  for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? a : b; g.fillRect(rnd() * S, rnd() * S, size, size); }
}

const CACHE = new Map();
/**
 * Crea (una volta sola) texture colore + normal map.
 * draw(g, S, rnd) disegna il colore, height(g, S, rnd) il rilievo (grigio 50% = piatto).
 */
function make(key, base, draw, height, strength = 1.5, repeat = 2) {
  if (CACHE.has(key)) return CACHE.get(key);
  const A = canvas2d(base);
  draw(A.g, base, mulberry(hash(key)));
  const map = colorTex(A.c);
  map.repeat.set(repeat, repeat);
  let normalMap = null;
  if (height && NORMALS) {
    const H = canvas2d(base);
    H.g.fillStyle = '#808080'; H.g.fillRect(0, 0, base, base);
    height(H.g, base, mulberry(hash(key) + 7));
    normalMap = normalFromHeight(H.c, strength);
    normalMap.repeat.set(repeat, repeat);
  }
  const r = { map, normalMap };
  CACHE.set(key, r);
  return r;
}

// ── trame "neutre" (quasi bianche: si moltiplicano per il colore del vestito) ──
const weave = (g, S, rnd, cell, lo, hi) => {
  for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) {
    const on = ((x / cell) + (y / cell)) % 2;
    g.fillStyle = on ? `rgba(255,255,255,${hi})` : `rgba(0,0,0,${lo})`;
    g.fillRect(x, y, cell, cell);
  }
};
const T = {
  /** cotone: tela fine e regolare, qualche filo irregolare */
  cotton: () => make('cotton', 64, (g, S, rnd) => {
    g.fillStyle = '#efefef'; g.fillRect(0, 0, S, S);
    weave(g, S, rnd, 1, 0.05, 0.05);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.04})`; g.fillRect(0, Math.floor(rnd() * S), S, 1); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.05})`; g.fillRect(Math.floor(rnd() * S), 0, 1, S); }
    dots(g, S, rnd, 300, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.05)');
  }, (g, S) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { g.fillStyle = (x + y) % 2 ? '#a0a0a0' : '#606060'; g.fillRect(x, y, 1, 1); } }, 0.8, 3),
  /** jeans: diagonale, scoloriture e cucitura laterale */
  denim: () => make('denim', 128, (g, S, rnd) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
    g.lineWidth = 1;
    for (let i = -S; i < S * 2; i += 3) { g.strokeStyle = `rgba(255,255,255,${0.14 + rnd() * 0.1})`; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    for (let i = -S; i < S * 2; i += 3) { g.strokeStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.moveTo(i + 1.5, 0); g.lineTo(i + 1.5 + S, S); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) { const x = rnd() * S, y = rnd() * S; wrap(S, x, y, 30, (px, py) => blob(g, px, py, 14 + rnd() * 10, rnd, 0.6)); }
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S); g.stroke();
    g.strokeStyle = 'rgba(255,240,200,0.5)'; g.lineWidth = 1; g.setLineDash([3, 2]);
    for (const dx of [-3, 3]) { g.beginPath(); g.moveTo(S * 0.5 + dx, 0); g.lineTo(S * 0.5 + dx, S); g.stroke(); }
    g.setLineDash([]);
  }, (g, S) => {
    g.lineWidth = 1.2;
    for (let i = -S; i < S * 2; i += 3) { g.strokeStyle = '#b0b0b0'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    g.strokeStyle = '#303030'; g.lineWidth = 2; g.beginPath(); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S); g.stroke();
  }, 1.2, 2),
  /** lino: fili grossi e irregolari */
  linen: () => make('linen', 128, (g, S, rnd) => {
    g.fillStyle = '#ececea'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.04})`; g.fillRect(0, rnd() * S, S, 1 + rnd() * 1.5); }
    for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.04})`; g.fillRect(rnd() * S, 0, 1 + rnd() * 1.5, S); }
  }, (g, S, rnd) => {
    for (let i = 0; i < 40; i++) { g.fillStyle = rnd() < 0.5 ? '#949494' : '#6c6c6c'; g.fillRect(0, rnd() * S, S, 1 + rnd()); g.fillRect(rnd() * S, 0, 1 + rnd(), S); }
  }, 0.45, 2),
  /** ripstop militare: tela con griglia di rinforzo in rilievo */
  ripstop: () => make('ripstop', 64, (g, S, rnd) => {
    g.fillStyle = '#ebebeb'; g.fillRect(0, 0, S, S);
    weave(g, S, rnd, 1, 0.05, 0.04);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let k = 0; k < S; k += 32) { g.fillRect(k, 0, 1, S); g.fillRect(0, k, S, 1); }
    g.fillStyle = 'rgba(0,0,0,0.035)';
    for (let k = 1; k < S; k += 32) { g.fillRect(k, 0, 1, S); g.fillRect(0, k, S, 1); }
  }, (g, S) => { g.fillStyle = '#a0a0a0'; for (let k = 0; k < S; k += 32) { g.fillRect(k, 0, 1, S); g.fillRect(0, k, S, 1); } }, 0.5, 5),
  /** v23: gomma con battistrada a tasselli (suole, parti degli elmetti) */
  rubber: () => make('rubber', 64, (g, S, rnd) => {
    g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, S, S);
    dots(g, S, rnd, 260, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)');
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < S; x += 8) g.fillRect(x + 1, y + 1, 5, 5);
  }, (g, S) => { g.fillStyle = '#b8b8b8'; for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < S; x += 8) g.fillRect(x + 1, y + 1, 5, 5); }, 0.7, 1),
  /** v23: paglia intrecciata */
  straw: () => make('straw', 128, (g, S, rnd) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 8) {
      const o = (y / 4) % 2 ? 4 : 0;
      g.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.1})`; g.fillRect(x + o, y, 7, 3);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + o + 7, y, 1, 4); g.fillRect(x + o, y + 3, 8, 1);
    }
  }, (g, S) => { for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 8) { const o = (y / 4) % 2 ? 4 : 0; g.fillStyle = '#c8c8c8'; g.fillRect(x + o, y, 7, 3); g.fillStyle = '#404040'; g.fillRect(x + o + 7, y, 1, 4); } }, 1.3, 3),
  /** v23: cordura (nylon spesso degli zaini) a trama a canestro */
  cordura: () => make('cordura', 128, (g, S, rnd) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) {
      const on = ((x >> 1) + (y >> 1)) % 2;
      g.fillStyle = on ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; g.fillRect(x, y, 2, 2);
    }
    dots(g, S, rnd, 200, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.05)');
  }, (g, S) => { for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) { g.fillStyle = ((x >> 1) + (y >> 1)) % 2 ? '#a8a8a8' : '#585858'; g.fillRect(x, y, 2, 2); } }, 0.9, 4),
  /** v23: fettuccia (cinghie) con righe in lunghezza */
  webbing: () => make('webbing', 32, (g, S) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 2) { g.fillStyle = x % 4 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)'; g.fillRect(x, 0, 1, S); }
  }, (g, S) => { for (let x = 0; x < S; x += 2) { g.fillStyle = x % 4 ? '#505050' : '#b0b0b0'; g.fillRect(x, 0, 1, S); } }, 1.0, 4),
  /** maglia: colonne di punti a V */
  knit: () => make('knit', 128, (g, S) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 6) for (let y = 0; y < S; y += 5) {
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 4); g.lineTo(x + 6, y); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x + 3, y + 4.5); g.lineTo(x + 3, y + 5); g.stroke();
    }
  }, (g, S) => {
    for (let x = 0; x < S; x += 6) for (let y = 0; y < S; y += 5) {
      g.strokeStyle = '#d0d0d0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 4); g.lineTo(x + 6, y); g.stroke();
    }
  }, 1.6, 3),
  /** seta: liscia con riflessi e una fantasia geometrica appena accennata */
  silk: () => make('silk', 128, (g, S) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
    const r = 16, h = r * Math.sqrt(3);
    for (let row = -1; row < S / h * 2 + 2; row++) for (let c = -1; c < S / r + 2; c++) {
      const cx = c * r * 2 + (row % 2 ? r : 0), cy = row * h;
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
    }
  }, (g, S) => {
    g.strokeStyle = '#6a6a6a'; g.lineWidth = 1;
    const r = 16, h = r * Math.sqrt(3);
    for (let row = -1; row < S / h * 2 + 2; row++) for (let c = -1; c < S / r + 2; c++) {
      const cx = c * r * 2 + (row % 2 ? r : 0), cy = row * h;
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
    }
  }, 0.6, 2),
  /** v31: feltro (cappelli): fibre corte intrecciate a caso, leggera peluria e variazioni di tono */
  felt: () => make('felt', 128, (g, S, rnd) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`; const x = rnd() * S, y = rnd() * S; wrap(S, x, y, 40, (px, py) => blob(g, px, py, 18 + rnd() * 16, mulberry(i * 31 + 5), 1.2)); }
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 1.5 + rnd() * 3;
      g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.06 + rnd() * 0.08})` : `rgba(0,0,0,${0.05 + rnd() * 0.07})`; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, (g, S, rnd) => {
    for (let i = 0; i < 2000; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 1.5 + rnd() * 3; g.strokeStyle = rnd() < 0.5 ? '#9a9a9a' : '#666'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }, 0.8, 3),
  /** v31: pelliccia sintetica (bordi del cappello di Natale): ciuffi morbidi */
  plush: () => make('plush', 128, (g, S, rnd) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) { const x = rnd() * S, y = rnd() * S, r = 2 + rnd() * 4; const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }, (g, S, rnd) => {
    for (let i = 0; i < 700; i++) { const x = rnd() * S, y = rnd() * S, r = 2 + rnd() * 4; const gr = g.createRadialGradient(x, y, 0.5, x, y, r); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#505050'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  }, 1.6, 2),
  /** abito gessato */
  suit: () => make('suit', 64, (g, S, rnd) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, S, S);
    for (let i = -S; i < S * 2; i += 2) { g.strokeStyle = 'rgba(0,0,0,0.06)'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.3)';
    for (let x = 0; x < S; x += 16) g.fillRect(x, 0, 0.8, S);
    dots(g, S, rnd, 200, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.05)');
  }, (g, S) => { for (let i = -S; i < S * 2; i += 2) { g.strokeStyle = '#999'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); } }, 0.6, 3),
  /** tuta imbottita (astronauta): pannelli gonfi con cuciture */
  panels: () => make('panels', 64, (g, S) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) {
      const gr = g.createRadialGradient(x + 16, y + 13, 2, x + 16, y + 16, 22);
      gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)');
      g.fillStyle = gr; g.fillRect(x, y, 32, 32);
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    for (let k = 0; k <= S; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); }
  }, (g, S) => {
    for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) {
      const gr = g.createRadialGradient(x + 16, y + 16, 2, x + 16, y + 16, 20);
      gr.addColorStop(0, '#d0d0d0'); gr.addColorStop(1, '#404040');
      g.fillStyle = gr; g.fillRect(x, y, 32, 32);
    }
  }, 2.2, 2),
  /** cuoio con grana a puntini e piccole pieghe */
  leather: () => make('leather', 256, (g, S, rnd) => {
    g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 3600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.06})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.4, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`; g.lineWidth = 0.8; g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 6, x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 8); g.stroke(); }
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.06)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, (g, S, rnd) => {
    for (let i = 0; i < 2800; i++) { g.fillStyle = rnd() < 0.5 ? '#949494' : '#6c6c6c'; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 1.6, 0, 7); g.fill(); }
  }, 0.7, 2),
  /** metallo spazzolato con pannelli e rivetti */
  metal: () => make('metal', 128, (g, S, rnd) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { const y = rnd() * S; g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.09)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (rnd() - 0.5) * 2); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.32)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, S * 0.5); g.lineTo(S, S * 0.5); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S * 0.5); g.moveTo(S * 0.25, S * 0.5); g.lineTo(S * 0.25, S); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, S * 0.5 + 1.4); g.lineTo(S, S * 0.5 + 1.4); g.stroke();
    for (const [x, y] of [[6, 6], [S * 0.5 - 6, 6], [S * 0.5 + 6, 6], [S - 6, 6], [6, S * 0.5 + 7], [S * 0.25 - 6, S * 0.5 + 7], [S * 0.25 + 6, S * 0.5 + 7], [S - 6, S * 0.5 + 7]]) {
      const gr = g.createRadialGradient(x - 0.8, y - 0.8, 0.2, x, y, 2.6);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#8a8a8a');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
    }
  }, (g, S) => {
    g.strokeStyle = '#202020'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, S * 0.5); g.lineTo(S, S * 0.5); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S * 0.5); g.moveTo(S * 0.25, S * 0.5); g.lineTo(S * 0.25, S); g.stroke();
    g.fillStyle = '#f0f0f0';
    for (const [x, y] of [[6, 6], [S * 0.5 - 6, 6], [S * 0.5 + 6, 6], [S - 6, 6], [6, S * 0.5 + 7], [S * 0.25 - 6, S * 0.5 + 7], [S * 0.25 + 6, S * 0.5 + 7], [S - 6, S * 0.5 + 7]]) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
  }, 1.6, 1),
  /** pelle: pori minuscoli e lievi chiazze calde */
  skin: () => make('skin', 64, (g, S, rnd) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,170,150,0.06)';
    for (let i = 0; i < 10; i++) { const x = rnd() * S, y = rnd() * S; wrap(S, x, y, 14, (px, py) => blob(g, px, py, 6 + rnd() * 6, rnd, 1)); }
    dots(g, S, rnd, 500, 'rgba(255,255,255,0.05)', 'rgba(90,40,30,0.06)');
  }, (g, S, rnd) => { for (let i = 0; i < 600; i++) { g.fillStyle = rnd() < 0.6 ? '#707070' : '#999'; g.fillRect(rnd() * S, rnd() * S, 1, 1); } }, 0.5, 3),
  /** capelli: ciocche verticali con riflessi */
  hair: () => make('hair', 64, (g, S, rnd) => {
    g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 120; i++) {
      const x = rnd() * S, w = 0.6 + rnd() * 1.6;
      g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.08 + rnd() * 0.16})` : `rgba(0,0,0,${0.08 + rnd() * 0.16})`;
      g.fillRect(x, 0, w, S);
    }
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.42, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, (g, S, rnd) => { for (let i = 0; i < 110; i++) { g.fillStyle = rnd() < 0.5 ? '#c0c0c0' : '#404040'; g.fillRect(rnd() * S, 0, 0.6 + rnd() * 1.4, S); } }, 1.4, 2),
};

// ── fantasie colorate (dipendono dal colore del vestito) ──
const P = {
  /** mimetica boschiva costruita sui toni del vestito */
  camo: (c) => make('camo' + c, 128, (g, S, rnd) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    for (const [cc, n, r] of [[mix(c, '#c9c08a', 0.35), 9, 15], [shade(c, 0.62), 11, 14], [mix(shade(c, 0.35), '#2a2214', 0.5), 9, 10]]) {
      g.fillStyle = cc;
      for (let i = 0; i < n; i++) { const x = rnd() * S, y = rnd() * S, rr = r * (0.6 + rnd() * 0.7); wrap(S, x, y, rr * 1.8, (px, py) => blob(g, px, py, rr, mulberry(i * 31 + n))); }
    }
    weave(g, S, rnd, 1, 0.04, 0.03);
  }, (g, S) => { g.fillStyle = '#929292'; for (let k = 0; k < S; k += 16) { g.fillRect(k, 0, 1, S); g.fillRect(0, k, S, 1); } }, 0.6, 2),   // trama ripstop appena accennata (prima sembrava una griglia)
  /** scozzese (camicia da cowboy) */
  plaid: (c) => make('plaid' + c, 64, (g, S) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    const dk = shade(c, 0.5), lt = mix(c, '#fff3d0', 0.55);
    g.globalAlpha = 0.55; g.fillStyle = dk;
    g.fillRect(0, 8, S, 14); g.fillRect(8, 0, 14, S);
    g.globalAlpha = 0.4; g.fillRect(0, 40, S, 6); g.fillRect(40, 0, 6, S);
    g.globalAlpha = 0.8; g.fillStyle = lt;
    g.fillRect(0, 30, S, 1.5); g.fillRect(30, 0, 1.5, S); g.fillRect(0, 54, S, 1); g.fillRect(54, 0, 1, S);
    g.globalAlpha = 1;
    for (let i = -S; i < S * 2; i += 2) { g.strokeStyle = 'rgba(0,0,0,0.06)'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); }
  }, (g, S) => { for (let i = -S; i < S * 2; i += 2) { g.strokeStyle = '#aaa'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); } }, 0.6, 2),
  /** quadretti vichy */
  gingham: (c) => make('ging' + c, 64, (g, S) => {
    g.fillStyle = mix(c, '#ffffff', 0.7); g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.5; g.fillStyle = c;
    for (let k = 0; k < S; k += 16) { g.fillRect(k, 0, 8, S); g.fillRect(0, k, S, 8); }
    g.globalAlpha = 1;
    weave(g, S, null, 1, 0.04, 0.04);
  }, (g, S) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { g.fillStyle = (x + y) % 2 ? '#999' : '#666'; g.fillRect(x, y, 1, 1); } }, 0.6, 3),
  /** pannelli esagonali con filetti luminosi (cyber) */
  hex: (c, glow = '#00f0ff') => make('hex' + c + glow, 128, (g, S) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    const r = 10, h = r * Math.sqrt(3);
    const cols = Math.round(S / (r * 3)), rr = S / (cols * 3);
    for (let row = -1; row <= Math.ceil(S / (rr * Math.sqrt(3) / 2)) + 1; row++) for (let cc = -1; cc <= cols + 1; cc++) {
      const cx = cc * rr * 3 + (row % 2 ? rr * 1.5 : 0), cy = row * rr * Math.sqrt(3) / 2;
      const gr = g.createLinearGradient(cx, cy - rr, cx, cy + rr);
      gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = gr;
      g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * rr * 0.92, cy + Math.sin(a) * rr * 0.92); } g.fill();
    }
    g.strokeStyle = glow; g.globalAlpha = 0.28; g.lineWidth = 1;
    for (let row = -1; row <= Math.ceil(S / (rr * Math.sqrt(3) / 2)) + 1; row++) for (let cc = -1; cc <= cols + 1; cc++) {
      const cx = cc * rr * 3 + (row % 2 ? rr * 1.5 : 0), cy = row * rr * Math.sqrt(3) / 2;
      g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke();
    }
    g.globalAlpha = 1;
    void h;
  }, (g, S) => {
    const cols = Math.round(S / 30), rr = S / (cols * 3);
    g.fillStyle = '#b0b0b0';
    for (let row = -1; row <= Math.ceil(S / (rr * Math.sqrt(3) / 2)) + 1; row++) for (let cc = -1; cc <= cols + 1; cc++) {
      const cx = cc * rr * 3 + (row % 2 ? rr * 1.5 : 0), cy = row * rr * Math.sqrt(3) / 2;
      g.beginPath(); for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * rr * 0.85, cy + Math.sin(a) * rr * 0.85); } g.fill();
    }
  }, 1.4, 2),
  /** squame sovrapposte (drago) */
  scales: (c) => make('scales' + c, 64, (g, S) => {
    g.fillStyle = shade(c, 0.6); g.fillRect(0, 0, S, S);
    const r = 8;
    for (let row = -1; row < S / (r * 0.75) + 2; row++) for (let k = -1; k < S / (r * 2) + 2; k++) {
      const x = k * r * 2 + (row % 2 ? r : 0), y = row * r * 0.75;
      const gr = g.createRadialGradient(x, y + r * 0.2, 1, x, y, r * 1.1);
      gr.addColorStop(0, mix(c, '#ffd0a0', 0.25)); gr.addColorStop(0.7, c); gr.addColorStop(1, shade(c, 0.45));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI); g.fill();
    }
  }, (g, S) => {
    const r = 8;
    for (let row = -1; row < S / (r * 0.75) + 2; row++) for (let k = -1; k < S / (r * 2) + 2; k++) {
      const x = k * r * 2 + (row % 2 ? r : 0), y = row * r * 0.75;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, '#e0e0e0'); gr.addColorStop(1, '#303030');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI); g.fill();
    }
  }, 2.0, 3),
  /** brina con cristalli (spettro) */
  frost: (c) => make('frost' + c, 128, (g, S, rnd) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    const branch = (x, y, a, l, d) => {
      if (d > 3 || l < 3) return;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      wrap(S, x, y, l + 2, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + x2 - x, py + y2 - y); g.stroke(); });
      branch(x2, y2, a + 0.6, l * 0.6, d + 1); branch(x2, y2, a - 0.6, l * 0.6, d + 1); branch(x2, y2, a, l * 0.7, d + 1);
    };
    for (let i = 0; i < 7; i++) { const x = rnd() * S, y = rnd() * S; for (let k = 0; k < 6; k++) branch(x, y, k * Math.PI / 3 + rnd() * 0.3, 10 + rnd() * 6, 0); }
    dots(g, S, rnd, 400, 'rgba(255,255,255,0.18)', 'rgba(120,160,220,0.1)');
  }, (g, S, rnd) => { dots(g, S, rnd, 800, '#b8b8b8', '#707070'); }, 0.8, 2),
  /** stoffa logora con macchie e strappi (zombie) */
  stains: (c) => make('stain' + c, 128, (g, S, rnd) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    weave(g, S, rnd, 1, 0.05, 0.04);
    for (const [cc, n] of [['rgba(70,90,40,0.28)', 7], ['rgba(80,50,30,0.3)', 7], ['rgba(0,0,0,0.18)', 5]]) {
      g.fillStyle = cc;
      for (let i = 0; i < n; i++) { const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 10; wrap(S, x, y, r * 2, (px, py) => blob(g, px, py, r, mulberry(i * 7 + n), 1.2)); }
    }
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 8, y + 6 + rnd() * 8); g.lineTo(x + (rnd() - 0.5) * 10, y + 14 + rnd() * 6); g.stroke(); }
  }, (g, S, rnd) => { dots(g, S, rnd, 900, '#a8a8a8', '#585858'); }, 0.9, 2),
  /** v30: legno con venature (chitarra, scudo) */
  wood: (c) => make('wood' + c, 128, (g, S, rnd) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) {
      const y0 = rnd() * S, a = 1 + rnd() * 3, ph = rnd() * 6, k = rnd();
      g.strokeStyle = k < 0.55 ? `rgba(40,20,5,${0.1 + rnd() * 0.16})` : `rgba(255,230,190,${0.06 + rnd() * 0.08})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath();
      for (let x = 0; x <= S; x += 4) { const y = y0 + Math.sin(x / S * Math.PI * 2 + ph) * a + Math.sin(x / S * Math.PI * 6 + ph * 2) * a * 0.3; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 3; i++) { const x = rnd() * S, y = rnd() * S; const gr = g.createRadialGradient(x, y, 0.5, x, y, 7); gr.addColorStop(0, 'rgba(40,18,4,0.45)'); gr.addColorStop(1, 'rgba(40,18,4,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 9, 3.5, 0, 0, 7); g.fill(); }
  }, (g, S, rnd) => { for (let i = 0; i < 40; i++) { const y = rnd() * S; g.fillStyle = rnd() < 0.5 ? '#767676' : '#8c8c8c'; g.fillRect(0, y, S, 1 + rnd() * 1.5); } }, 0.6, 1),
  /** v30: piume sovrapposte con rachide e barbe (ali d'angelo) */
  feather: (c) => make('feather' + c, 128, (g, S, rnd) => {
    g.fillStyle = shade(c, 0.86); g.fillRect(0, 0, S, S);
    const rows = 4, cols = 4, fw = S / cols, fh = S / rows;
    for (let r = -1; r <= rows; r++) for (let k = -1; k <= cols; k++) {
      const x = k * fw + (r % 2 ? fw / 2 : 0), y = r * fh;
      wrap(S, x + fw / 2, y + fh, fh * 1.4, (px, py) => {
        const gr = g.createLinearGradient(px - fw / 2, 0, px + fw / 2, 0);
        gr.addColorStop(0, shade(c, 0.8)); gr.addColorStop(0.5, mix(c, '#ffffff', 0.25)); gr.addColorStop(1, shade(c, 0.78));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(px - fw * 0.5, py - fh); g.quadraticCurveTo(px - fw * 0.55, py - fh * 0.1, px, py + fh * 0.32); g.quadraticCurveTo(px + fw * 0.55, py - fh * 0.1, px + fw * 0.5, py - fh); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 0.6;
        for (let b = 0; b < 9; b++) { const yy = py - fh + b * fh * 0.14; g.beginPath(); g.moveTo(px, yy); g.lineTo(px - fw * 0.42, yy - fh * 0.08); g.moveTo(px, yy); g.lineTo(px + fw * 0.42, yy - fh * 0.08); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(px, py - fh); g.lineTo(px, py + fh * 0.28); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(px - fw * 0.5, py - fh * 0.2); g.quadraticCurveTo(px - fw * 0.4, py + fh * 0.1, px, py + fh * 0.32); g.quadraticCurveTo(px + fw * 0.4, py + fh * 0.1, px + fw * 0.5, py - fh * 0.2); g.stroke();
      });
    }
  }, (g, S) => {
    const rows = 4, cols = 4, fw = S / cols, fh = S / rows;
    for (let r = -1; r <= rows; r++) for (let k = -1; k <= cols; k++) {
      const x = k * fw + (r % 2 ? fw / 2 : 0) + fw / 2, y = r * fh + fh;
      const gr = g.createLinearGradient(0, y - fh, 0, y + fh * 0.3); gr.addColorStop(0, '#606060'); gr.addColorStop(1, '#b0b0b0');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - fw * 0.5, y - fh); g.quadraticCurveTo(x - fw * 0.55, y - fh * 0.1, x, y + fh * 0.32); g.quadraticCurveTo(x + fw * 0.55, y - fh * 0.1, x + fw * 0.5, y - fh); g.closePath(); g.fill();
    }
  }, 1.4, 1),
  /** v30: membrana venata (ali di drago) */
  membrane: (c) => make('memb' + c, 128, (g, S, rnd) => {
    g.fillStyle = c; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`; const x = rnd() * S, y = rnd() * S; wrap(S, x, y, 30, (px, py) => blob(g, px, py, 14 + rnd() * 10, mulberry(i * 13), 1.3)); }
    const vein = (x, y, a, l, w, d) => {
      if (d > 4 || l < 4) return;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      wrap(S, x, y, l + 2, (px, py) => { g.strokeStyle = shade(c, 0.45); g.lineWidth = w; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + (x2 - x) * 0.5 + 3, py + (y2 - y) * 0.5 - 2, px + x2 - x, py + y2 - y); g.stroke(); });
      vein(x2, y2, a + 0.5 + rnd() * 0.3, l * 0.65, w * 0.7, d + 1); vein(x2, y2, a - 0.5 - rnd() * 0.3, l * 0.65, w * 0.7, d + 1);
    };
    for (let i = 0; i < 5; i++) vein(rnd() * S, rnd() * S, rnd() * 6.28, 22, 2, 0);
    dots(g, S, rnd, 500, 'rgba(255,200,150,0.08)', 'rgba(0,0,0,0.08)', 1.5);
  }, (g, S, rnd) => { dots(g, S, rnd, 900, '#9a9a9a', '#666666', 1.5); }, 1.0, 1),
};

/** tipi di tessuto che hanno un colore proprio (il materiale resta bianco) */
export const COLORED = new Set(Object.keys(P));
/** texture per un tipo di tessuto: { map, normalMap } */
export function clothTexture(kind, color, extra) {
  if (P[kind]) return P[kind](color, extra);
  return (T[kind] || T.cotton)();
}
export function skinTexture() { return T.skin(); }
export function hairTexture() { return T.hair(); }

/** come reagisce alla luce ogni tessuto */
export const CLOTH_LOOK = {
  cotton: { rough: 0.86, sheen: 0.45 }, denim: { rough: 0.9, sheen: 0.35 }, linen: { rough: 0.9, sheen: 0.5 },
  ripstop: { rough: 0.82, sheen: 0.3 }, knit: { rough: 0.95, sheen: 0.7 }, silk: { rough: 0.42, sheen: 1, sheenRough: 0.35 },
  suit: { rough: 0.7, sheen: 0.5 }, panels: { rough: 0.7, sheen: 0.4 }, leather: { rough: 0.5, sheen: 0, coat: 0.25 },
  metal: { rough: 0.32, metal: 0.85, sheen: 0 },
  camo: { rough: 0.85, sheen: 0.35 }, plaid: { rough: 0.85, sheen: 0.5 }, gingham: { rough: 0.85, sheen: 0.5 },
  hex: { rough: 0.38, sheen: 0, coat: 0.6 }, scales: { rough: 0.45, sheen: 0, coat: 0.45 }, frost: { rough: 0.35, sheen: 0.6, coat: 0.3 },
  stains: { rough: 0.95, sheen: 0.3 },
  wood: { rough: 0.42, sheen: 0, coat: 0.55 }, feather: { rough: 0.9, sheen: 0.8, sheenRough: 0.5 }, membrane: { rough: 0.6, sheen: 0.25 },
  rubber: { rough: 0.85, sheen: 0 }, felt: { rough: 0.93, sheen: 0.8, sheenRough: 0.6 }, plush: { rough: 1, sheen: 1, sheenRough: 0.5 }, straw: { rough: 0.9, sheen: 0.2 }, cordura: { rough: 0.7, sheen: 0.35 }, webbing: { rough: 0.75, sheen: 0.4 },
};

/** stoffa di ogni skin: [maglia, pantaloni] (il resto usa cotone e jeans) */
export const SKIN_CLOTH = {
  recluta: ['camo', 'camo'], tattico: ['camo', 'ripstop'], esploratrice: ['cotton', 'denim'], zombie: ['stains', 'stains'],
  agente: ['suit', 'suit'], ninja: ['linen', 'linen'], pirata: ['linen', 'leather'], meccanico: ['cotton', 'denim'],
  cyber: ['hex', 'hex'], astro: ['panels', 'panels'], banana: ['cotton', 'cotton'], drago: ['scales', 'scales'],
  leo: ['cotton', 'ripstop'], tamsin: ['silk', 'linen'], oren: ['ripstop', 'ripstop'], cowboy: ['plaid', 'denim'],
  scienziata: ['cotton', 'denim'], vichingo: ['knit', 'leather'], samurai: ['silk', 'linen'], spettro: ['frost', 'frost'],
  giardiniera: ['gingham', 'denim'], rapper: ['knit', 'denim'],
  gladiatore: ['linen', 'leather'], imperatore: ['linen', 'linen'], arlecchino: ['silk', 'silk'], cuoco: ['cotton', 'suit'],
  sommozzatrice: ['rubber', 'rubber'], mummia: ['linen', 'linen'],
};


/**
 * v30: vela del deltaplano (non ripetuta): u = apertura (0 sinistra → 1 destra), v = corda (0 bordo d'attacco → 1 d'uscita).
 * Tela ripstop con cuciture dei pannelli, tasca del bordo d'attacco e un disegno diverso per ogni deltaplano.
 */
const GL_CACHE = new Map();
export function gliderTexture(id, color, accent) {
  const key = id + color + accent;
  if (GL_CACHE.has(key)) return GL_CACHE.get(key);
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', WRF), rnd = mulberry(hash(key));
  const X = (u) => u * W, Y = (v) => v * H;
  const sym = (fn) => { fn(1); g.save(); g.translate(W, 0); g.scale(-1, 1); fn(-1); g.restore(); };   // disegno simmetrico
  g.fillStyle = color; g.fillRect(0, 0, W, H);
  switch (id) {
    case 'fiamma': {
      for (const [col, k] of [[mix(color, '#ff9a1a', 0.6), 1], [accent, 0.72], ['#fff4c0', 0.38]]) {
        g.fillStyle = col;
        for (let i = 0; i < 18; i++) {
          const u = (i + 0.5) / 18, len = (0.35 + 0.35 * Math.abs(Math.sin(i * 2.3))) * k, w = 0.03 * (0.6 + k * 0.6);
          g.beginPath(); g.moveTo(X(u - w), 0);
          g.bezierCurveTo(X(u - w * 1.2), Y(len * 0.4), X(u + w * 1.5), Y(len * 0.6), X(u + Math.sin(i) * 0.02), Y(len));
          g.bezierCurveTo(X(u - w * 0.4), Y(len * 0.65), X(u + w * 1.2), Y(len * 0.35), X(u + w), 0); g.fill();
        }
      }
      break;
    }
    case 'notte': {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, shade(color, 0.6)); gr.addColorStop(1, mix(color, accent, 0.25));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 220; i++) { g.fillStyle = rnd() < 0.7 ? 'rgba(255,255,255,0.85)' : accent; const r = rnd() < 0.9 ? 0.8 : 1.8; g.beginPath(); g.arc(rnd() * W, rnd() * H, r, 0, 7); g.fill(); }
      sym(() => { g.fillStyle = '#f4ecff'; g.beginPath(); g.arc(X(0.22), Y(0.45), 26, 0, 7); g.fill(); g.fillStyle = shade(color, 0.8); g.beginPath(); g.arc(X(0.22) + 11, Y(0.45) - 6, 23, 0, 7); g.fill(); });
      g.strokeStyle = accent; g.lineWidth = 3; g.shadowColor = accent; g.shadowBlur = 8;
      for (const v of [0.14, 0.88]) { g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(W, Y(v)); g.stroke(); }
      g.shadowBlur = 0;
      break;
    }
    case 'smeraldo': {
      g.strokeStyle = mix(color, accent, 0.35); g.lineWidth = 2;
      for (let k = -12; k < 24; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + H, H); g.stroke(); g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 - H, H); g.stroke(); }
      g.fillStyle = accent; g.globalAlpha = 0.85;
      sym(() => { g.beginPath(); g.moveTo(X(0.5), Y(0.08)); g.lineTo(X(0.3), Y(0.5)); g.lineTo(X(0.5), Y(0.34)); g.closePath(); g.fill(); });
      g.globalAlpha = 1;
      break;
    }
    case 'arcobaleno': {
      const RB = ['#ff3a3a', '#ff9a1a', '#ffe02a', '#3ad04a', '#2ab0ff', '#4a5aff', '#b04aff'];
      for (let i = 0; i < 14; i++) { g.fillStyle = RB[Math.abs(Math.round(i < 7 ? 6 - i : i - 7))]; g.fillRect(X(i / 14), 0, W / 14 + 1, H); }
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, W, Y(0.08));
      break;
    }
    case 'oro': {
      const gr = g.createLinearGradient(0, 0, W, 0);
      for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? mix(color, '#fff6d0', 0.45) : shade(color, 0.78));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,70,0,0.45)'; g.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const a = (i / 23 - 0.5) * 2.6; g.beginPath(); g.moveTo(X(0.5), 0); g.lineTo(X(0.5) + Math.sin(a) * W, Math.cos(a) * H * 1.4); g.stroke(); }
      g.strokeStyle = accent; g.lineWidth = 2.5;
      for (const r of [40, 70, 100]) { g.beginPath(); g.arc(X(0.5), 0, r, 0, Math.PI); g.stroke(); }
      sym(() => { g.strokeStyle = 'rgba(140,80,0,0.6)'; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(X(0.12 + k * 0.05), Y(0.75), 10, 0, 7); g.stroke(); } });
      break;
    }
    case 'tigre': {
      g.fillStyle = mix(color, '#ffe0a0', 0.25); g.fillRect(0, 0, W, Y(0.12));
      g.fillStyle = accent;
      sym(() => {
        for (let i = 0; i < 9; i++) {
          const u = 0.04 + i * 0.052 + rnd() * 0.01, len = 0.45 + rnd() * 0.4, w = 0.012 + rnd() * 0.01;
          g.beginPath(); g.moveTo(X(u - w), H);
          g.bezierCurveTo(X(u - w * 2), Y(1 - len * 0.4), X(u + w * 2.5), Y(1 - len * 0.7), X(u + 0.02), Y(1 - len));
          g.bezierCurveTo(X(u + w * 0.5), Y(1 - len * 0.6), X(u + w * 1.4), Y(1 - len * 0.3), X(u + w), H); g.fill();
        }
      });
      break;
    }
    // ── v40: Stagione 2 · Il Colosseo ──
    case 'imperiale': {   // porpora imperiale: greca d'oro sul bordo, aquila con le ali spiegate e alloro
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, shade(color, 1.1)); gr.addColorStop(1, shade(color, 0.7));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = accent; g.fillRect(0, Y(0.06), W, Y(0.1));
      // greca (meandro) sul bordo d'attacco
      g.strokeStyle = shade(color, 0.8); g.lineWidth = 2.2;
      for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, Y(0.145)); g.lineTo(x, Y(0.075)); g.lineTo(x + 12, Y(0.075)); g.lineTo(x + 12, Y(0.125)); g.lineTo(x + 5, Y(0.125)); g.lineTo(x + 5, Y(0.1)); g.stroke(); }
      g.fillStyle = accent; g.fillRect(0, Y(0.9), W, Y(0.04));
      // aquila stilizzata al centro
      g.fillStyle = accent;
      sym(() => {
        g.beginPath(); g.moveTo(X(0.5), Y(0.38));
        for (let k = 0; k < 5; k++) { const u = 0.5 - 0.035 - k * 0.032, v = 0.36 + k * 0.035; g.lineTo(X(u), Y(v - 0.08)); g.lineTo(X(u + 0.012), Y(v + 0.06)); }
        g.lineTo(X(0.47), Y(0.62)); g.lineTo(X(0.5), Y(0.66)); g.closePath(); g.fill();
        // rami d'alloro ai lati
        for (let k = 0; k < 8; k++) { const t = k / 7, u = 0.3 - t * 0.2, v = 0.55 + Math.sin(t * 2.6) * 0.12; g.beginPath(); g.ellipse(X(u), Y(v), 9, 4, -0.6 + t, 0, 7); g.fill(); }
      });
      g.beginPath(); g.arc(X(0.5), Y(0.34), 11, 0, 7); g.fill();
      g.fillStyle = shade(color, 0.9); g.font = 'bold 22px serif'; g.textAlign = 'center'; g.fillText('SPQR', X(0.5), Y(0.82));
      break;
    }
    case 'laguna': {   // la laguna veneta: onde, gondola e leone alato sul fondo azzurro
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, mix(color, '#ffffff', 0.25)); gr.addColorStop(1, shade(color, 0.75));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
      for (let r = 0; r < 7; r++) { g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = Y(0.42 + r * 0.075) + Math.sin(x * 0.06 + r) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      g.fillStyle = accent; g.fillRect(0, Y(0.08), W, Y(0.06));
      sym(() => {   // gondola
        g.fillStyle = '#141414'; g.beginPath(); g.moveTo(X(0.08), Y(0.6)); g.quadraticCurveTo(X(0.2), Y(0.72), X(0.34), Y(0.6)); g.lineTo(X(0.36), Y(0.5)); g.quadraticCurveTo(X(0.3), Y(0.64), X(0.1), Y(0.58)); g.closePath(); g.fill();
        g.fillStyle = accent; g.fillRect(X(0.34), Y(0.48), 4, 10);
        g.strokeStyle = '#141414'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0.12), Y(0.62)); g.lineTo(X(0.1), Y(0.4)); g.stroke();
      });
      // leone alato (sagoma semplice) in oro
      g.fillStyle = accent;
      g.beginPath(); g.ellipse(X(0.5), Y(0.36), 16, 11, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(X(0.5) + 14, Y(0.29), 8, 0, 7); g.fill();
      sym(() => { g.beginPath(); g.moveTo(X(0.49), Y(0.32)); g.quadraticCurveTo(X(0.43), Y(0.16), X(0.4), Y(0.22)); g.quadraticCurveTo(X(0.44), Y(0.3), X(0.47), Y(0.36)); g.fill(); });
      break;
    }
    case 'carnevale': {   // arlecchino: losanghe colorate con bordino dorato
      const C = [color, accent, '#2a8a3a', '#f2c230', '#1a1a1a'];
      const dw = 32, dh = 40;
      for (let j = -1; j < H / dh * 2 + 1; j++) for (let i = -1; i < W / dw + 1; i++) {
        const cx = i * dw + (j % 2 ? dw / 2 : 0), cy = j * dh / 2;
        g.fillStyle = C[(i * 3 + j * 2 + 100) % C.length];
        g.beginPath(); g.moveTo(cx, cy - dh / 2); g.lineTo(cx + dw / 2, cy); g.lineTo(cx, cy + dh / 2); g.lineTo(cx - dw / 2, cy); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,215,90,0.75)'; g.lineWidth = 1.2; g.stroke();
      }
      break;
    }
    case 'mosaico': {   // tessere di un mosaico romano: fondo chiaro, greca e rosone al centro
      const T = 8;
      for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) { g.fillStyle = mix(color, '#ffffff', rnd() * 0.25 - 0.05); g.fillRect(x + 0.6, y + 0.6, T - 1.2, T - 1.2); }
      const tile = (x, y, c) => { g.fillStyle = mix(c, '#000000', rnd() * 0.18); g.fillRect(x * T + 0.6, y * T + 0.6, T - 1.2, T - 1.2); };
      const nx = W / T, ny = H / T;
      for (let x = 0; x < nx; x++) { tile(x, 2, accent); tile(x, ny - 3, accent); if (x % 4 < 2) tile(x, 3, '#2a2a2a'); }
      const cx = nx / 2 - 0.5, cy = ny / 2;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.0), a = Math.atan2(y - cy, x - cx);
        if (d < 9 && d > 7.6) tile(x, y, accent);
        else if (d < 6.5 && Math.cos(a * 8) > 0.2 && d > 1.5) tile(x, y, '#2a6a8a');
        else if (d < 1.6) tile(x, y, '#f0c040');
        const ex = Math.min(x, nx - 1 - x);
        if (ex > 3 && ex < 26 && Math.abs(y - cy) < 6 && Math.cos(ex * 0.9) * 4 > Math.abs(y - cy) - 1 && Math.cos(ex * 0.9) * 4 < Math.abs(y - cy) + 1) tile(x, y, '#3a7a3a');
      }
      break;
    }
    case 'tramonto': {   // tramonto sul mare: sfumatura arancio-viola, sole e gabbiani
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(0.45, color); gr.addColorStop(1, accent);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,240,190,0.95)'; g.beginPath(); g.arc(X(0.5), Y(0.62), 34, 0, 7); g.fill();
      g.fillStyle = shade(accent, 0.8); g.fillRect(0, Y(0.72), W, Y(0.28));
      g.strokeStyle = 'rgba(255,200,140,0.6)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) { const y = Y(0.76 + k * 0.035), w = 60 - k * 8; g.beginPath(); g.moveTo(X(0.5) - w, y); g.lineTo(X(0.5) + w, y); g.stroke(); }
      g.strokeStyle = '#2a1030'; g.lineWidth = 2;
      sym(() => { for (const [u, v] of [[0.2, 0.3], [0.28, 0.22], [0.12, 0.4]]) { g.beginPath(); g.moveTo(X(u) - 8, Y(v)); g.quadraticCurveTo(X(u) - 4, Y(v) - 6, X(u), Y(v)); g.quadraticCurveTo(X(u) + 4, Y(v) - 6, X(u) + 8, Y(v)); g.stroke(); } });
      break;
    }
    default: {   // classico: due fasce parallele al bordo d'attacco e un sole al centro
      g.fillStyle = accent; g.fillRect(0, Y(0.2), W, Y(0.07)); g.fillRect(0, Y(0.31), W, Y(0.025));
      g.fillStyle = mix(color, '#000000', 0.25); g.fillRect(0, Y(0.9), W, Y(0.1));
      g.fillStyle = accent; g.beginPath(); g.arc(X(0.5), Y(0.58), 22, 0, 7); g.fill();
      g.fillStyle = color; g.beginPath(); g.arc(X(0.5), Y(0.58), 13, 0, 7); g.fill();
    }
  }
  // ombreggiatura verso il bordo d'uscita, tasca del bordo d'attacco (mylar) e orlo
  const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, W, Y(0.05));
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, Y(0.975), W, Y(0.025));
  // trama ripstop e cuciture dei pannelli
  g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 6) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y < H; y += 6) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.5;
  for (let k = 1; k < 12; k++) { g.beginPath(); g.moveTo(X(k / 12), Y(0.05)); g.lineTo(X(k / 12), H); g.stroke(); }
  g.beginPath(); g.moveTo(0, Y(0.05)); g.lineTo(W, Y(0.05)); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.2)'; for (let k = 1; k < 12; k++) g.fillRect(X(k / 12) + 1.5, Y(0.05), 1, H);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; map.anisotropy = 4;
  let normalMap = null;
  if (NORMALS) {
    const hc = document.createElement('canvas'); hc.width = W / 2; hc.height = H / 2;
    const hg = hc.getContext('2d', WRF); hg.fillStyle = '#808080'; hg.fillRect(0, 0, W / 2, H / 2);
    hg.fillStyle = '#9a9a9a'; for (let x = 0; x < W / 2; x += 3) hg.fillRect(x, 0, 1, H / 2);
    hg.fillStyle = '#585858'; for (let k = 1; k < 12; k++) hg.fillRect(k / 12 * W / 2 - 1, H / 40, 2, H / 2);
    hg.fillRect(0, H / 40 - 1, W / 2, 2);
    normalMap = normalFromHeight(hc, 1.2); normalMap.flipY = false; normalMap.wrapS = normalMap.wrapT = THREE.ClampToEdgeWrapping;
  }
  const r = { map, normalMap };
  GL_CACHE.set(key, r);
  return r;
}
