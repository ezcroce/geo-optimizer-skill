// ─────────────────────────────────────────────────────────────
//  Texture procedurali dei personaggi: tessuti (cotone, jeans, lino,
//  ripstop, maglia, seta, imbottito), pelle, cuoio, metallo, capelli e
//  fantasie colorate (mimetica, scozzese, quadretti, esagoni, squame, brina,
//  macchie). Tutte ripetibili, con normal map ricavata dal rilievo.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { canvas2d, normalFromHeight, colorTex, NORMALS } from './texgen.js?v=16';

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
  }, (g, S) => { g.fillStyle = '#a0a0a0'; for (let k = 0; k < S; k += 32) { g.fillRect(k, 0, 2, S); g.fillRect(0, k, S, 2); } }, 0.5, 2),
  /** maglia: colonne di punti a V */
  knit: () => make('knit', 64, (g, S) => {
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
  leather: () => make('leather', 128, (g, S, rnd) => {
    g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.06})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.4, 0, 7); g.fill(); }
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`; g.lineWidth = 0.8; g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 6, x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 8); g.stroke(); }
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.06)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, (g, S, rnd) => {
    for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < 0.5 ? '#949494' : '#6c6c6c'; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 1.6, 0, 7); g.fill(); }
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
};

/** stoffa di ogni skin: [maglia, pantaloni] (il resto usa cotone e jeans) */
export const SKIN_CLOTH = {
  recluta: ['camo', 'camo'], tattico: ['camo', 'ripstop'], esploratrice: ['cotton', 'denim'], zombie: ['stains', 'stains'],
  agente: ['suit', 'suit'], ninja: ['linen', 'linen'], pirata: ['linen', 'leather'], meccanico: ['cotton', 'denim'],
  cyber: ['hex', 'hex'], astro: ['panels', 'panels'], banana: ['cotton', 'cotton'], drago: ['scales', 'scales'],
  leo: ['cotton', 'ripstop'], tamsin: ['silk', 'linen'], oren: ['ripstop', 'ripstop'], cowboy: ['plaid', 'denim'],
  scienziata: ['cotton', 'denim'], vichingo: ['knit', 'leather'], samurai: ['silk', 'linen'], spettro: ['frost', 'frost'],
  giardiniera: ['gingham', 'denim'], rapper: ['knit', 'denim'],
};
