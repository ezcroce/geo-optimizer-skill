'use strict';
/* ============================================================================
   INFINITE ALIBI: TACTICAL HEIST — vision.js
   Requisito tecnico n.2: raycasting 2D per i coni visivi di guardie e telecamere,
   stati verde/giallo/rosso, Fog of War e rilevamento.
   ============================================================================ */
globalThis.TH = globalThis.TH || {};

TH.vision = (() => {
  const { W, H, TS, T, tileAt } = TH.world;

  const isWall = (tx, ty, doors) => {
    const t = tileAt(tx, ty);
    const d = TH.world.doorAt(tx, ty);
    return t === T.WALL || t === T.FURN || !!(d && doors && doors[tx + ',' + ty] && doors[tx + ',' + ty].locked);
  };

  // Linea di vista tra due punti (coordinate tile, float): true se non c'è un muro in mezzo.
  function los(x0, y0, x1, y1, doors) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist * 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t), doors)) return false;
    }
    return true;
  }

  // Cono visivo: lancia N raggi nell'arco (fov) attorno all'angolo (ang, radianti),
  // fino a range o a un muro. Ritorna il poligono [{x,y}...] in coordinate tile.
  function cone(x, y, ang, fov, range, rays, doors) {
    rays = rays || 26;
    const pts = [{ x, y }];
    for (let i = 0; i <= rays; i++) {
      const a = ang - fov / 2 + (fov * i) / rays;
      const dx = Math.cos(a), dy = Math.sin(a);
      let d = 0, px = x, py = y;
      const step = 0.12;
      while (d < range) {
        d += step;
        px = x + dx * d; py = y + dy * d;
        if (isWall(Math.floor(px), Math.floor(py), doors)) { px -= dx * step; py -= dy * step; break; }
      }
      pts.push({ x: px, y: py });
    }
    return pts;
  }

  // Un punto è dentro il cono? (poligono convesso-ish: test per settore + LOS)
  function inCone(poly, x, y, ox, oy, doors) {
    // punto nel poligono (ray casting)
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    if (!inside) return false;
    return los(ox, oy, x, y, doors);
  }

  // Tile visibili da un punto entro un raggio (per la Fog of War dei ladri).
  // Ritorna un Set di indici tile (y*W+x).
  function visibleTiles(x, y, range, doors) {
    const out = new Set();
    const r = Math.ceil(range);
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const cx = tx + 0.5, cy = ty + 0.5;
        if (Math.hypot(cx - x, cy - y) > range) continue;
        if (los(x, y, cx, cy, doors)) out.add(ty * W + tx);
      }
    }
    return out;
  }

  // Quanto un osservatore "vede" un ladro: 0..1 (per il rilevamento).
  // Più vicino = più veloce; correre e stare fermi sotto la luce espongono di più.
  function spotRate(dist, range, thief) {
    let r = 1.15 - dist / range;                 // 1.15 a bruciapelo -> ~0.15 ai bordi
    if (thief.state === 'run') r *= 1.6;
    if (thief.state === 'sneak') r *= 0.45;
    if (thief.blending) r *= 0.35;               // Trasformista tra gli ospiti
    return Math.max(0.05, r);
  }

  return { los, cone, inCone, visibleTiles, spotRate, isWall };
})();
