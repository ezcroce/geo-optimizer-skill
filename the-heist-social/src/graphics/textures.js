import * as THREE from 'three';

const texCache = new Map();

// Deterministic pseudo-random helper so procedural grains look organic & repeatable
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function makeTexture(key, size, drawFn, { repeatX = 1, repeatY = 1, isData = false, transparent = false } = {}) {
  const fullKey = `${key}_${repeatX.toFixed(2)}_${repeatY.toFixed(2)}_${isData ? 'd' : 'c'}`;
  if (texCache.has(fullKey)) return texCache.get(fullKey);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!transparent) {
    ctx.fillStyle = isData ? '#808080' : '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }
  drawFn(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isData ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(fullKey, tex);
  return tex;
}

// =========================================================
// 1. FLOORS, GROUNDS & WATER (COLOR + BUMP)
// =========================================================
export function getFloorTextureSet(type, widthMeters = 10, depthMeters = 10) {
  const rx = Math.max(1, Math.round(widthMeters / 2.4));
  const ry = Math.max(1, Math.round(depthMeters / 2.4));

  switch (type) {
    case 'marble_checker': {
      const rxc = Math.max(1, Math.round(widthMeters / 2.2));
      const ryc = Math.max(1, Math.round(depthMeters / 2.2));
      const map = makeTexture('fl_mcheck', 512, (ctx, s) => {
        const half = s / 2;
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 2; col++) {
            const dark = (row + col) % 2 === 1;
            ctx.fillStyle = dark ? '#1d222c' : '#efe9df';
            ctx.fillRect(col * half, row * half, half, half);

            // Subtle natural marble clouding
            for (let k = 0; k < 18; k++) {
              const gx = col * half + hash2(k, row * 7 + col) * half;
              const gy = row * half + hash2(col * 5 + k, k) * half;
              const rad = 24 + (k % 4) * 16;
              const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, rad);
              grad.addColorStop(0, dark ? 'rgba(255,255,255,0.04)' : 'rgba(160,148,130,0.08)');
              grad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = grad;
              ctx.fillRect(col * half, row * half, half, half);
            }

            // Veins
            ctx.strokeStyle = dark ? 'rgba(212,175,55,0.22)' : 'rgba(120,112,98,0.24)';
            ctx.lineWidth = 2;
            for (let v = 0; v < 5; v++) {
              ctx.beginPath();
              ctx.moveTo(col * half + ((v * 57) % half), row * half);
              ctx.bezierCurveTo(
                col * half + half * 0.28,
                row * half + half * 0.42,
                col * half + half * 0.72,
                row * half + half * 0.58,
                col * half + ((v * 91 + 80) % half),
                row * half + half
              );
              ctx.stroke();
            }

            // Brass/grout inlay border
            ctx.strokeStyle = 'rgba(186,154,88,0.42)';
            ctx.lineWidth = 3;
            ctx.strokeRect(col * half + 1.5, row * half + 1.5, half - 3, half - 3);
          }
        }
      }, { repeatX: rxc, repeatY: ryc });

      const bumpMap = makeTexture('fl_mcheck_b', 256, (ctx, s) => {
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(0, 0, s, s);
        const half = s / 2;
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, half - 4, half - 4);
        ctx.strokeRect(half + 2, 2, half - 4, half - 4);
        ctx.strokeRect(2, half + 2, half - 4, half - 4);
        ctx.strokeRect(half + 2, half + 2, half - 4, half - 4);
      }, { repeatX: rxc, repeatY: ryc, isData: true });

      return { map, bumpMap, bumpScale: 0.018 };
    }

    case 'marble_white': {
      const map = makeTexture('fl_mwhite', 512, (ctx, s) => {
        ctx.fillStyle = '#f2ede4';
        ctx.fillRect(0, 0, s, s);
        const step = s / 2;
        ctx.strokeStyle = 'rgba(138,132,122,0.26)';
        ctx.lineWidth = 2.4;
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          ctx.moveTo((i * 67) % s, 0);
          ctx.bezierCurveTo(s * 0.25, s * 0.35, s * 0.75, s * 0.65, (i * 131 + 90) % s, s);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(180,165,138,0.45)';
        ctx.lineWidth = 3;
        for (let x = 0; x <= s; x += step) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(s, x); ctx.stroke();
        }
      }, { repeatX: rx, repeatY: ry });

      const bumpMap = makeTexture('fl_mwhite_b', 256, (ctx, s) => {
        ctx.fillStyle = '#dcdcdc';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 4;
        for (let x = 0; x <= s; x += s / 2) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(s, x); ctx.stroke();
        }
      }, { repeatX: rx, repeatY: ry, isData: true });

      return { map, bumpMap, bumpScale: 0.016 };
    }

    case 'parquet_warm':
    case 'parquet_dark':
    case 'parquet_herringbone': {
      const base = type === 'parquet_dark' ? '#422a1c' : type === 'parquet_herringbone' ? '#633f25' : '#734b2e';
      const alt = type === 'parquet_dark' ? '#513524' : type === 'parquet_herringbone' ? '#764d2f' : '#855938';
      const map = makeTexture(`fl_${type}`, 512, (ctx, s) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, s, s);
        const plankH = s / 8;
        const plankW = s / 2;
        for (let r = 0; r < 8; r++) {
          const offset = (r % 2) * (plankW / 2);
          for (let c = -1; c < 3; c++) {
            const x = c * plankW + offset;
            const y = r * plankH;
            ctx.fillStyle = (r + c) % 2 === 0 ? base : alt;
            ctx.fillRect(x, y, plankW - 2, plankH - 2);

            // Organic wood grain streaks inside each plank
            ctx.strokeStyle = 'rgba(28, 15, 7, 0.24)';
            ctx.lineWidth = 1.2;
            for (let g = 1; g <= 5; g++) {
              const gy = y + (plankH / 6) * g;
              ctx.beginPath();
              ctx.moveTo(x + 3, gy);
              ctx.bezierCurveTo(
                x + plankW * 0.35,
                gy + ((g % 2 === 0 ? 1 : -1) * 4),
                x + plankW * 0.65,
                gy - ((g % 2 === 0 ? 1 : -1) * 4),
                x + plankW - 4,
                gy
              );
              ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(20,10,5,0.48)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, plankW - 2, plankH - 2);
          }
        }
      }, { repeatX: rx, repeatY: ry });

      const bumpMap = makeTexture(`fl_${type}_b`, 256, (ctx, s) => {
        ctx.fillStyle = '#cfcfcf';
        ctx.fillRect(0, 0, s, s);
        const plankH = s / 8;
        const plankW = s / 2;
        ctx.strokeStyle = '#303030';
        ctx.lineWidth = 2;
        for (let r = 0; r < 8; r++) {
          const offset = (r % 2) * (plankW / 2);
          for (let c = -1; c < 3; c++) {
            ctx.strokeRect(c * plankW + offset, r * plankH, plankW - 1, plankH - 1);
          }
        }
      }, { repeatX: rx, repeatY: ry, isData: true });

      return { map, bumpMap, bumpScale: 0.025 };
    }

    case 'slate_tech': {
      const map = makeTexture('fl_slate', 512, (ctx, s) => {
        ctx.fillStyle = '#1b222e';
        ctx.fillRect(0, 0, s, s);
        const tile = s / 4;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#202938' : '#19202c';
            ctx.fillRect(c * tile + 2, r * tile + 2, tile - 4, tile - 4);
            // Brushed metallic lines
            ctx.strokeStyle = 'rgba(148,163,184,0.08)';
            for (let l = 6; l < tile - 6; l += 8) {
              ctx.beginPath();
              ctx.moveTo(c * tile + 4, r * tile + l);
              ctx.lineTo(c * tile + tile - 4, r * tile + l);
              ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(56,189,248,0.22)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(c * tile + 2, r * tile + 2, tile - 4, tile - 4);
          }
        }
      }, { repeatX: rx, repeatY: ry });
      return { map, bumpMap: null, bumpScale: 0 };
    }

    case 'travertine': {
      const map = makeTexture('fl_trav', 512, (ctx, s) => {
        ctx.fillStyle = '#a89b88';
        ctx.fillRect(0, 0, s, s);
        const tile = s / 4;
        const shades = ['#ded2bf', '#d4c6b0', '#dfd5c5', '#cbbca4'];
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            ctx.fillStyle = shades[(r * 3 + c) % shades.length];
            ctx.fillRect(c * tile + 4, r * tile + 4, tile - 8, tile - 8);
            // Porous travertine pits & mineral bands
            ctx.fillStyle = 'rgba(115, 98, 78, 0.22)';
            for (let p = 0; p < 22; p++) {
              const px = c * tile + 8 + hash2(p, r * 4 + c) * (tile - 16);
              const py = r * tile + 8 + hash2(c * 7 + p, p) * (tile - 16);
              ctx.fillRect(px, py, 5, 2);
            }
          }
        }
      }, { repeatX: rx, repeatY: ry });

      const bumpMap = makeTexture('fl_trav_b', 256, (ctx, s) => {
        ctx.fillStyle = '#383838';
        ctx.fillRect(0, 0, s, s);
        const tile = s / 4;
        ctx.fillStyle = '#d4d4d4';
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            ctx.fillRect(c * tile + 3, r * tile + 3, tile - 6, tile - 6);
          }
        }
      }, { repeatX: rx, repeatY: ry, isData: true });

      return { map, bumpMap, bumpScale: 0.04 };
    }

    case 'grass':
    default: {
      const grx = Math.max(2, Math.round(widthMeters / 3.2));
      const gry = Math.max(2, Math.round(depthMeters / 3.2));
      const map = makeTexture('fl_grass', 512, (ctx, s) => {
        const stripe = s / 4;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#244b2c' : '#2b5734';
          ctx.fillRect(0, i * stripe, s, stripe);
        }
        // Rich multi-tone grass blades & clover micro-detail
        const bladeColors = ['#356b3f', '#1c3b22', '#3f7a49', '#2e5e37'];
        for (let i = 0; i < 2600; i++) {
          const x = hash2(i, 13) * s;
          const y = hash2(29, i) * s;
          ctx.fillStyle = bladeColors[i % bladeColors.length];
          ctx.fillRect(x, y, 2.2, 5.5);
        }
      }, { repeatX: grx, repeatY: gry });

      const bumpMap = makeTexture('fl_grass_b', 256, (ctx, s) => {
        ctx.fillStyle = '#787878';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1600; i++) {
          const x = hash2(i, 7) * s;
          const y = hash2(19, i) * s;
          ctx.fillStyle = i % 2 === 0 ? '#b8b8b8' : '#484848';
          ctx.fillRect(x, y, 2, 4);
        }
      }, { repeatX: grx, repeatY: gry, isData: true });

      return { map, bumpMap, bumpScale: 0.045 };
    }
  }
}

export function getFloorTexture(type, widthMeters = 10, depthMeters = 10) {
  return getFloorTextureSet(type, widthMeters, depthMeters).map;
}

export function getPoolWaterTexture() {
  return makeTexture('pool_water', 512, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#0891b2');
    grad.addColorStop(0.5, '#06b6d4');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    // Mosaic pool tile grid beneath water
    ctx.strokeStyle = 'rgba(12, 74, 110, 0.25)';
    ctx.lineWidth = 1.5;
    for (let t = 0; t <= s; t += 32) {
      ctx.beginPath(); ctx.moveTo(t, 0); ctx.lineTo(t, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, t); ctx.lineTo(s, t); ctx.stroke();
    }

    // Sparkling caustic light web
    ctx.strokeStyle = 'rgba(224, 247, 250, 0.42)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 28; i++) {
      const cx = (i * 97) % s;
      const cy = (i * 163) % s;
      const r = 32 + (i % 4) * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, { repeatX: 2, repeatY: 4 });
}

// =========================================================
// 2. VILLA WALLS, STONEWORK, DOORS & IRONWORK
// =========================================================
export function getVillaWallTextures(lengthMeters = 6, isExterior = false) {
  const rx = Math.max(1, Math.round(lengthMeters / 2.6));

  if (isExterior) {
    // Tuscan Villa Exterior: Warm Venetian stucco above + Rusticated travertine stone base below!
    const map = makeTexture('wall_ext', 512, (ctx, s) => {
      // Upper Venetian plaster
      const grad = ctx.createLinearGradient(0, 0, 0, s * 0.68);
      grad.addColorStop(0, '#e3d8c4');
      grad.addColorStop(1, '#d6c7ae');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s * 0.68);

      // Plaster mineral mottling
      for (let i = 0; i < 900; i++) {
        const x = hash2(i, 3) * s;
        const y = hash2(11, i) * (s * 0.68);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,240,0.12)' : 'rgba(140,120,95,0.10)';
        ctx.fillRect(x, y, 6, 5);
      }

      // Classical top frieze & stringcourse molding
      ctx.fillStyle = '#efe7d8';
      ctx.fillRect(0, 0, s, 22);
      ctx.fillStyle = '#b5a388';
      ctx.fillRect(0, 22, s, 7);
      ctx.fillStyle = '#efe7d8';
      ctx.fillRect(0, s * 0.66, s, 14);

      // Lower 32%: Rusticated Roman Ashlar Stone Plinth
      const plinthTop = Math.floor(s * 0.68);
      ctx.fillStyle = '#9c8e7b';
      ctx.fillRect(0, plinthTop, s, s - plinthTop);
      const rows = 3;
      const rowH = (s - plinthTop) / rows;
      const blockW = s / 4;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (blockW / 2);
        for (let c = -1; c < 5; c++) {
          const bx = c * blockW + off;
          const by = plinthTop + r * rowH;
          ctx.fillStyle = (r + c) % 2 === 0 ? '#cfc2ae' : '#c5b6a0';
          ctx.fillRect(bx + 3, by + 3, blockW - 6, rowH - 6);
          ctx.strokeStyle = 'rgba(255,250,240,0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx + 5, by + 5, blockW - 10, rowH - 10);
        }
      }
    }, { repeatX: rx, repeatY: 1 });

    const bumpMap = makeTexture('wall_ext_b', 256, (ctx, s) => {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#b2b2b2' : '#828282';
        ctx.fillRect(hash2(i, 5) * s, hash2(9, i) * s * 0.68, 4, 4);
      }
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(0, s * 0.66, s, 8);
      const plinthTop = Math.floor(s * 0.68);
      ctx.fillStyle = '#303030';
      ctx.fillRect(0, plinthTop, s, s - plinthTop);
      const rowH = (s - plinthTop) / 3;
      const blockW = s / 4;
      ctx.fillStyle = '#d8d8d8';
      for (let r = 0; r < 3; r++) {
        const off = (r % 2) * (blockW / 2);
        for (let c = -1; c < 5; c++) {
          ctx.fillRect(c * blockW + off + 3, plinthTop + r * rowH + 3, blockW - 6, rowH - 6);
        }
      }
    }, { repeatX: rx, repeatY: 1, isData: true });

    return { map, bumpMap, bumpScale: 0.055 };
  }

  // Interior Wall: Warm Venetian Damask Wallpaper + Dark Walnut Boiserie Wainscoting!
  const map = makeTexture('wall_int', 512, (ctx, s) => {
    const dadoY = Math.floor(s * 0.64);
    const grad = ctx.createLinearGradient(0, 0, 0, dadoY);
    grad.addColorStop(0, '#dfd4be');
    grad.addColorStop(1, '#cfc1a6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, dadoY);

    // Subtle Venetian vertical silk stripes & gold diamond motif
    ctx.fillStyle = 'rgba(255, 248, 230, 0.18)';
    for (let x = 0; x < s; x += 32) {
      ctx.fillRect(x, 18, 12, dadoY - 24);
    }
    ctx.strokeStyle = 'rgba(180, 145, 72, 0.22)';
    ctx.lineWidth = 1.5;
    for (let x = 32; x < s; x += 64) {
      for (let y = 56; y < dadoY - 30; y += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x + 10, y);
        ctx.lineTo(x, y + 14);
        ctx.lineTo(x - 10, y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Crown molding
    ctx.fillStyle = '#f3ead8';
    ctx.fillRect(0, 0, s, 16);
    ctx.fillStyle = '#b89758';
    ctx.fillRect(0, 16, s, 4);

    // Walnut Chair Rail & Boiserie Lower Wainscoting
    ctx.fillStyle = '#4a2e1d';
    ctx.fillRect(0, dadoY, s, s - dadoY);
    ctx.fillStyle = '#c8a24e';
    ctx.fillRect(0, dadoY + 3, s, 4);

    const panelW = s / 2;
    for (let p = 0; p < 2; p++) {
      const px = p * panelW + 18;
      const py = dadoY + 20;
      const pw = panelW - 36;
      const ph = s - dadoY - 42;
      ctx.fillStyle = '#5c3924';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#c8a24e';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 6, py + 6, pw - 12, ph - 12);
    }
    // Dark baseboard
    ctx.fillStyle = '#2d1a0f';
    ctx.fillRect(0, s - 16, s, 16);
  }, { repeatX: rx, repeatY: 1 });

  const bumpMap = makeTexture('wall_int_b', 256, (ctx, s) => {
    const dadoY = Math.floor(s * 0.64);
    ctx.fillStyle = '#909090';
    ctx.fillRect(0, 0, s, dadoY);
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, dadoY, s, 8);
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(0, dadoY + 8, s, s - dadoY - 8);
    const panelW = s / 2;
    ctx.strokeStyle = '#ececec';
    ctx.lineWidth = 3;
    for (let p = 0; p < 2; p++) {
      ctx.strokeRect(p * panelW + 10, dadoY + 12, panelW - 20, s - dadoY - 24);
    }
  }, { repeatX: rx, repeatY: 1, isData: true });

  return { map, bumpMap, bumpScale: 0.038 };
}

export function getWoodMaterial(variant = 'dark', repeatX = 1, repeatY = 1) {
  const isDark = variant === 'dark';
  const c1 = isDark ? '#3e2415' : '#684127';
  const c2 = isDark ? '#4f2f1c' : '#7d4f30';
  const grainStroke = isDark ? 'rgba(20, 10, 4, 0.38)' : 'rgba(38, 20, 8, 0.30)';

  const map = makeTexture(`wood_${variant}`, 512, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = grainStroke;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 68; i++) {
      const x = (i / 68) * s;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + Math.sin(i * 0.7) * 14,
        s * 0.33,
        x - Math.cos(i * 0.5) * 14,
        s * 0.66,
        x,
        s
      );
      ctx.stroke();
    }
  }, { repeatX, repeatY });

  const bumpMap = makeTexture(`wood_${variant}_b`, 256, (ctx, s) => {
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#585858';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 54; i++) {
      const x = (i / 54) * s;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 8, s * 0.4, x - 8, s * 0.7, x, s);
      ctx.stroke();
    }
  }, { repeatX, repeatY, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.024,
    roughness: isDark ? 0.38 : 0.44,
    metalness: 0.04,
  });
}

export function getCofferedDoorMaterial() {
  const map = makeTexture('door_coffered', 512, (ctx, s) => {
    ctx.fillStyle = '#53311c';
    ctx.fillRect(0, 0, s, s);
    // Vertical wood grain
    ctx.strokeStyle = 'rgba(24, 12, 5, 0.32)';
    for (let x = 0; x < s; x += 9) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    // 4 Carved Coffered Panels + Gold Inlay
    const panels = [
      [48, 36, 176, 185],
      [288, 36, 176, 185],
      [48, 256, 176, 210],
      [288, 256, 176, 210],
    ];
    for (const [px, py, pw, ph] of panels) {
      ctx.fillStyle = '#3f2414';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#241208';
      ctx.lineWidth = 6;
      ctx.strokeRect(px, py, pw, ph);
      ctx.strokeStyle = '#c8a24e';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 10, py + 10, pw - 20, ph - 20);
    }
    // Brass doorknob escutcheon
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.roundRect(s - 38, s * 0.46, 18, 56, 6);
    ctx.fill();
  });

  const bumpMap = makeTexture('door_coffered_b', 256, (ctx, s) => {
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(0, 0, s, s);
    const panels = [
      [24, 18, 88, 92],
      [144, 18, 88, 92],
      [24, 128, 88, 105],
      [144, 128, 88, 105],
    ];
    for (const [px, py, pw, ph] of panels) {
      ctx.fillStyle = '#505050';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#989898';
      ctx.fillRect(px + 8, py + 8, pw - 16, ph - 16);
    }
  }, { isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.045,
    roughness: 0.4,
    metalness: 0.06,
  });
}

export function getCarvedStoneMaterial(repeatX = 1, repeatY = 1) {
  const map = makeTexture('carved_stone', 512, (ctx, s) => {
    ctx.fillStyle = '#cabfa9';
    ctx.fillRect(0, 0, s, s);
    const rowH = s / 4;
    const colW = s / 2;
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * (colW / 2);
      for (let c = -1; c < 3; c++) {
        const x = c * colW + off;
        const y = r * rowH;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#dbd1be' : '#cfc3ae';
        ctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
      }
    }
    // Natural limestone speckles
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(90,80,68,0.18)' : 'rgba(255,252,245,0.20)';
      ctx.fillRect(hash2(i, 4) * s, hash2(8, i) * s, 3, 3);
    }
  }, { repeatX, repeatY });

  const bumpMap = makeTexture('carved_stone_b', 256, (ctx, s) => {
    ctx.fillStyle = '#383838';
    ctx.fillRect(0, 0, s, s);
    const rowH = s / 4;
    const colW = s / 2;
    ctx.fillStyle = '#d4d4d4';
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * (colW / 2);
      for (let c = -1; c < 3; c++) {
        ctx.fillRect(c * colW + off + 3, r * rowH + 3, colW - 6, rowH - 6);
      }
    }
  }, { repeatX, repeatY, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.045,
    roughness: 0.72,
  });
}

export function getWroughtIronFenceMaterial(lengthMeters = 10) {
  const rx = Math.max(2, Math.round(lengthMeters / 1.2));
  const map = makeTexture('iron_fence', 256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    // Horizontal top & bottom forged rails
    ctx.fillStyle = '#1b2029';
    ctx.fillRect(0, 22, s, 14);
    ctx.fillRect(0, s - 24, s, 16);

    // Vertical iron pickets + golden spear finials!
    for (let x = 16; x < s; x += 32) {
      ctx.fillStyle = '#1e2430';
      ctx.fillRect(x - 4, 22, 8, s - 30);
      // Gold spearhead tip
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x + 7, 22);
      ctx.lineTo(x - 7, 22);
      ctx.closePath();
      ctx.fill();
    }
  }, { repeatX: rx, repeatY: 1, transparent: true });

  return new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    metalness: 0.72,
    roughness: 0.32,
  });
}

// =========================================================
// 3. GARDEN TREES, BARK, CYPRESS, OLIVE CANOPIES & ROSE HEDGES
// =========================================================
export function getTreeBarkMaterial() {
  const map = makeTexture('tree_bark', 512, (ctx, s) => {
    ctx.fillStyle = '#4a3321';
    ctx.fillRect(0, 0, s, s);
    const barkTones = ['#382415', '#5c402a', '#2c1b0e', '#694b34', '#3d472c']; // subtle moss hint
    for (let i = 0; i < 220; i++) {
      const x = hash2(i, 2) * s;
      const y = hash2(6, i) * s;
      const w = 6 + hash2(i, 9) * 14;
      const h = 45 + hash2(12, i) * 110;
      ctx.fillStyle = barkTones[i % barkTones.length];
      ctx.fillRect(x, y, w, h);
    }
    // Deep vertical bark fissures
    ctx.strokeStyle = '#1d1108';
    ctx.lineWidth = 3;
    for (let x = 8; x < s; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 9, s * 0.35, x - 9, s * 0.7, x + 3, s);
      ctx.stroke();
    }
  }, { repeatX: 2, repeatY: 2 });

  const bumpMap = makeTexture('tree_bark_b', 256, (ctx, s) => {
    ctx.fillStyle = '#909090';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#dcdcdc' : '#303030';
      ctx.fillRect(hash2(i, 2) * s, hash2(6, i) * s, 6, 48);
    }
  }, { repeatX: 2, repeatY: 2, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.085,
    roughness: 0.92,
  });
}

export function getTreeFoliageMaterial(species = 'cypress') {
  const isOlive = species === 'olive';
  const palette = isOlive
    ? ['#2d4d31', '#3f6642', '#587f56', '#76996e', '#213b25']
    : ['#122b1a', '#1b3f26', '#255432', '#31693f', '#0e2214'];

  const map = makeTexture(`foliage_${species}`, 512, (ctx, s) => {
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, s, s);

    // Hundreds of overlapping organic leaf / cypress frond clusters!
    for (let i = 0; i < 1500; i++) {
      const cx = hash2(i, 31) * s;
      const cy = hash2(47, i) * s;
      const rx = isOlive ? 10 + (i % 7) * 2.5 : 7 + (i % 5) * 2;
      const ry = isOlive ? 6 + (i % 5) * 2 : 14 + (i % 6) * 3;
      const rot = (hash2(i, i) - 0.5) * 1.4;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = palette[i % palette.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Subtle sunlit leaf tips / tiny Mediterranean berries or cones
    for (let b = 0; b < 90; b++) {
      ctx.fillStyle = isOlive ? '#a3be8c' : '#6b533b';
      ctx.beginPath();
      ctx.arc(hash2(b, 71) * s, hash2(83, b) * s, isOlive ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeatX: 2, repeatY: isOlive ? 2 : 3 });

  const bumpMap = makeTexture(`foliage_${species}_b`, 256, (ctx, s) => {
    ctx.fillStyle = '#505050';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const cx = hash2(i, 31) * s;
      const cy = hash2(47, i) * s;
      ctx.fillStyle = i % 3 === 0 ? '#e6e6e6' : i % 3 === 1 ? '#a4a4a4' : '#303030';
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + (i % 4) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeatX: 2, repeatY: isOlive ? 2 : 3, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.09,
    roughness: 0.84,
  });
}

export function getHedgeMaterial(withRoses = false, widthMeters = 4) {
  const rx = Math.max(1, Math.round(widthMeters / 1.5));
  const map = makeTexture(`hedge_${withRoses ? 'rose' : 'box'}`, 512, (ctx, s) => {
    ctx.fillStyle = '#163820';
    ctx.fillRect(0, 0, s, s);
    const greens = ['#1c4527', '#255933', '#2f6b3e', '#14301b', '#397c49'];
    for (let i = 0; i < 2200; i++) {
      const x = hash2(i, 17) * s;
      const y = hash2(23, i) * s;
      ctx.fillStyle = greens[i % greens.length];
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 5, hash2(i, 3) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    if (withRoses) {
      const roseColors = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af'];
      for (let r = 0; r < 65; r++) {
        const rxp = hash2(r, 91) * s;
        const ryp = hash2(53, r) * s;
        ctx.fillStyle = roseColors[r % roseColors.length];
        ctx.beginPath();
        ctx.arc(rxp, ryp, 6 + (r % 3) * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9f1239';
        ctx.beginPath();
        ctx.arc(rxp + 1, ryp + 1, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { repeatX: rx, repeatY: 1 });

  const bumpMap = makeTexture('hedge_b', 256, (ctx, s) => {
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#dadada' : '#343434';
      ctx.beginPath();
      ctx.arc(hash2(i, 17) * s, hash2(23, i) * s, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeatX: rx, repeatY: 1, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.075,
    roughness: 0.86,
  });
}

// =========================================================
// 4. FURNITURE, UPHOLSTERY, RUGS, MARBLE PROPS & TECH
// =========================================================
export function getPolishedMarblePropMaterial() {
  const map = makeTexture('prop_calacatta', 512, (ctx, s) => {
    ctx.fillStyle = '#f6f3ec';
    ctx.fillRect(0, 0, s, s);
    // Grey & champagne Calacatta marble veins
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(196, 158, 84, 0.34)' : 'rgba(128, 124, 118, 0.28)';
      ctx.lineWidth = i % 2 === 0 ? 3.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(hash2(i, 1) * s, 0);
      ctx.bezierCurveTo(
        hash2(i, 2) * s,
        s * 0.33,
        hash2(i, 3) * s,
        s * 0.66,
        hash2(i, 4) * s,
        s
      );
      ctx.stroke();
    }
  });

  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.2,
    metalness: 0.08,
  });
}

export function getPersianRugMaterial(primaryColor = '#7f1d1d') {
  const map = makeTexture(`rug_${primaryColor}`, 512, (ctx, s) => {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, s, s);

    // Ornate golden & ivory double borders
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 14;
    ctx.strokeRect(22, 22, s - 44, s - 44);
    ctx.strokeStyle = '#f5ebd6';
    ctx.lineWidth = 4;
    ctx.strokeRect(42, 42, s - 84, s - 84);
    ctx.strokeRect(54, 54, s - 108, s - 108);

    // Geometric border motif
    ctx.fillStyle = '#f5ebd6';
    for (let t = 36; t < s - 36; t += 28) {
      ctx.fillRect(t - 4, 18, 8, 8);
      ctx.fillRect(t - 4, s - 26, 8, 8);
      ctx.fillRect(18, t - 4, 8, 8);
      ctx.fillRect(s - 26, t - 4, 8, 8);
    }

    // Central Venetian Medallion
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.34)';
    ctx.beginPath();
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const rad = a % 2 === 0 ? 128 : 88;
      if (a === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();
    ctx.restore();

    // Subtle woven textile threads
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < s; y += 4) ctx.fillRect(0, y, s, 1);
  });

  const bumpMap = makeTexture('rug_weave_b', 256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#a8a8a8';
    for (let y = 0; y < s; y += 3) ctx.fillRect(0, y, s, 1);
    for (let x = 0; x < s; x += 3) ctx.fillRect(x, 0, 1, s);
  }, { repeatX: 3, repeatY: 3, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.022,
    roughness: 0.88,
  });
}

export function getTuftedUpholsteryMaterial(baseHex = '#7c2d12') {
  const map = makeTexture(`tuft_${baseHex}`, 256, (ctx, s) => {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, s, s);
    const step = s / 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= 4; r++) {
      for (let c = 0; c <= 4; c++) {
        const x = c * step;
        const y = r * step;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + step / 2, y + step / 2);
        ctx.moveTo(x + step, y);
        ctx.lineTo(x + step / 2, y + step / 2);
        ctx.stroke();

        // Recessed tuft button
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { repeatX: 2, repeatY: 1 });

  const bumpMap = makeTexture('tuft_b', 256, (ctx, s) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, s, s);
    const step = s / 4;
    ctx.strokeStyle = '#585858';
    ctx.lineWidth = 4;
    for (let r = 0; r <= 4; r++) {
      for (let c = 0; c <= 4; c++) {
        const x = c * step;
        const y = r * step;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + step, y + step);
        ctx.moveTo(x + step, y);
        ctx.lineTo(x, y + step);
        ctx.stroke();
        ctx.fillStyle = '#202020';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { repeatX: 2, repeatY: 1, isData: true });

  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.04,
    roughness: 0.55,
  });
}

export function getBookSpinesMaterial() {
  const map = makeTexture('book_spines', 512, (ctx, s) => {
    ctx.fillStyle = '#1e120a';
    ctx.fillRect(0, 0, s, s);
    const colors = ['#7f1d1d', '#1e3a5f', '#14532d', '#78350f', '#4c1d95', '#3f2e21', '#881337'];
    let x = 6;
    let idx = 0;
    while (x < s - 14) {
      const bw = 18 + Math.floor(hash2(idx, 9) * 16);
      const bh = s - 18 - Math.floor(hash2(4, idx) * 28);
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(x, s - bh, bw - 2, bh);
      // Gold foil spine bands
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(x + 2, s - bh + 18, bw - 6, 4);
      ctx.fillRect(x + 2, s - bh + 34, bw - 6, 3);
      ctx.fillRect(x + 2, s - 28, bw - 6, 4);
      x += bw;
      idx++;
    }
  }, { repeatX: 2, repeatY: 1 });

  return new THREE.MeshStandardMaterial({ map, roughness: 0.62 });
}

export function getCctvConsoleScreenMaterial() {
  const map = makeTexture('cctv_desk_screen', 512, (ctx, s) => {
    ctx.fillStyle = '#07111e';
    ctx.fillRect(0, 0, s, s);
    const hw = s / 2;
    const hh = s / 2;
    const labels = ['CAM 01 ATRIO', 'CAM 02 SALONE', 'CAM 03 STUDIO', 'CAM 06 PISCINA'];
    for (let i = 0; i < 4; i++) {
      const gx = (i % 2) * hw;
      const gy = Math.floor(i / 2) * hh;
      ctx.fillStyle = i % 2 === 0 ? '#0c2338' : '#0a1d30';
      ctx.fillRect(gx + 6, gy + 6, hw - 12, hh - 12);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 6, gy + 6, hw - 12, hh - 12);
      // Simulated blueprint wireframe inside mini-monitor
      ctx.strokeStyle = 'rgba(56,189,248,0.35)';
      ctx.beginPath();
      ctx.moveTo(gx + 20, gy + hh - 30);
      ctx.lineTo(gx + hw * 0.5, gy + 45);
      ctx.lineTo(gx + hw - 20, gy + hh - 30);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(gx + 20, gy + 22, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(labels[i], gx + 32, gy + 27);
    }
  });

  return new THREE.MeshStandardMaterial({
    map,
    emissive: 0x38bdf8,
    emissiveMap: map,
    emissiveIntensity: 0.9,
    roughness: 0.18,
  });
}

export function getTechCabinetMaterial(isPower = false) {
  const map = makeTexture(`tech_${isPower ? 'pwr' : 'srv'}`, 256, (ctx, s) => {
    ctx.fillStyle = isPower ? '#27303d' : '#161e2b';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, s - 16, s - 16);

    if (isPower) {
      // Yellow/Black hazard stripe + breaker switches
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(24, 24, s - 48, 26);
      ctx.fillStyle = '#111827';
      for (let x = 28; x < s - 36; x += 24) {
        ctx.fillRect(x, 24, 10, 26);
      }
      // Breaker toggles
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(36, 74 + r * 38, s - 72, 24);
        ctx.fillStyle = r === 1 ? '#ef4444' : '#22c55e';
        ctx.fillRect(s - 66, 79 + r * 38, 18, 14);
      }
    } else {
      // Server rack blades & blinking status LEDs
      for (let r = 0; r < 7; r++) {
        const y = 20 + r * 32;
        ctx.fillStyle = '#0b111d';
        ctx.fillRect(20, y, s - 40, 24);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(28, y + 8, 8, 8);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(42, y + 8, 8, 8);
      }
    }
  });

  return new THREE.MeshStandardMaterial({
    map,
    metalness: 0.62,
    roughness: 0.34,
  });
}

export function getSilkScreenMaterial() {
  const map = makeTexture('silk_screen', 512, (ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#78350f');
    grad.addColorStop(0.5, '#92400e');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    // 3 Folding panels with golden botanical branches
    const pw = s / 3;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 6;
      ctx.strokeRect(i * pw + 8, 8, pw - 16, s - 16);
      ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
      ctx.beginPath();
      ctx.arc(i * pw + pw / 2, s * 0.38, 42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, s - 40);
    ctx.bezierCurveTo(s * 0.35, s * 0.55, s * 0.65, s * 0.45, s - 50, 80);
    ctx.stroke();
  });

  return new THREE.MeshStandardMaterial({ map, roughness: 0.48, metalness: 0.12 });
}

export function getAntiqueTrunkMaterial() {
  const map = makeTexture('antique_trunk', 256, (ctx, s) => {
    ctx.fillStyle = '#4a2c18';
    ctx.fillRect(0, 0, s, s);
    // Diamond monogram pattern
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    for (let y = 16; y < s; y += 32) {
      for (let x = 16; x < s; x += 32) {
        ctx.strokeRect(x - 6, y - 6, 12, 12);
      }
    }
    // Leather straps & brass buckles
    ctx.fillStyle = '#271509';
    ctx.fillRect(44, 0, 24, s);
    ctx.fillRect(s - 68, 0, 24, s);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(40, s * 0.44, 32, 22);
    ctx.fillRect(s - 72, s * 0.44, 32, 22);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, s - 8, s - 8);
  });

  return new THREE.MeshStandardMaterial({ map, roughness: 0.52, metalness: 0.18 });
}

export function getLoungerStripeMaterial() {
  const map = makeTexture('lounger_stripe', 256, (ctx, s) => {
    const sw = s / 8;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#faf5e8' : '#d4af37';
      ctx.fillRect(i * sw, 0, sw, s);
    }
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.72 });
}

export function getPianoKeyboardMaterial() {
  const map = makeTexture('piano_keys', 256, (ctx, s) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, s, s);
    const keys = 24;
    const kw = s / keys;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (let i = 0; i < keys; i++) {
      ctx.strokeRect(i * kw, 0, kw, s);
      if ([0, 1, 3, 4, 5].includes(i % 7)) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(i * kw + kw * 0.65, 0, kw * 0.65, s * 0.62);
      }
    }
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.25 });
}

export function getVillaPaintingMaterial(index = 0) {
  const map = makeTexture(`painting_${index}`, 256, (ctx, s) => {
    if (index % 3 === 0) {
      // Tuscan Sunset Hills & Cypresses
      const sky = ctx.createLinearGradient(0, 0, 0, s * 0.65);
      sky.addColorStop(0, '#1e3a5f');
      sky.addColorStop(1, '#f59e0b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#2d4f32';
      ctx.beginPath();
      ctx.moveTo(0, s * 0.65);
      ctx.quadraticCurveTo(s * 0.4, s * 0.48, s, s * 0.68);
      ctx.lineTo(s, s);
      ctx.lineTo(0, s);
      ctx.fill();
      ctx.fillStyle = '#14291a';
      for (const px of [52, 86, 190]) {
        ctx.beginPath();
        ctx.ellipse(px, s * 0.56, 8, 34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (index % 3 === 1) {
      // Venetian Lagoon Night
      const sky = ctx.createLinearGradient(0, 0, 0, s);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(0.55, '#312e81');
      sky.addColorStop(1, '#0e7490');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(s * 0.72, s * 0.28, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(28, s * 0.42, 95, s * 0.22);
    } else {
      // Classical Crimson & Gold Abstract Crest
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, 68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#b45309';
      ctx.fillRect(s / 2 - 28, s / 2 - 28, 56, 56);
    }
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.45 });
}

export function getSuitFabricBumpMap() {
  return makeTexture('suit_wool_bump', 128, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#9c9c9c';
    for (let y = 0; y < s; y += 4) {
      for (let x = (y % 8 === 0 ? 0 : 2); x < s; x += 4) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }, { repeatX: 6, repeatY: 6, isData: true });
}
