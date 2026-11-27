/* Infinite Alibi — rendering delle telecamere di sorveglianza su un unico <canvas>.
 * La scena è in scala di grigi (filtro CCTV); laser, puntine e annotazioni sono a colori.
 */
(function (root) {
  'use strict';
  const IA = (root.IA = root.IA || {});
  const { CONFIG, ROOMS, STUDIO, PEDESTAL, AVATARS } = IA;
  const RW = CONFIG.roomW;
  const RH = CONFIG.roomH;

  const CW = 1224;
  const CH = 618;
  const GAP = 6;
  const FW = (CW - GAP * 4) / 3; // 400
  const FH = (CH - GAP * 3) / 2; // 300
  const BG_SCALE = 3.4;

  const g = (v, a) => (a == null ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${a})`);

  // ---------------------------------------------------------------------------
  // Sfondi statici delle stanze (cache in alta risoluzione)
  // ---------------------------------------------------------------------------
  function rect(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h); }
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.2; ctx.stroke(); }
  }

  function drawFloor(ctx, id, rng) {
    switch (id) {
      case 0: // Cucina: piastrelle a scacchi
        for (let y = 0; y < RH; y += 20) for (let x = 0; x < RW; x += 20) rect(ctx, x, y, 20, 20, g(((x + y) / 20) % 2 ? 84 : 70));
        break;
      case 1: // Sala da pranzo: listoni
        rect(ctx, 0, 0, RW, RH, g(78));
        ctx.strokeStyle = g(62);
        ctx.lineWidth = 1;
        for (let y = 0; y < RH; y += 12) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(RW, y); ctx.stroke();
          const off = (y / 12) % 2 ? 30 : 75;
          for (let x = off; x < RW; x += 90) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke(); }
        }
        break;
      case 2: // Studio: tappeto
        rect(ctx, 0, 0, RW, RH, g(64));
        rect(ctx, 34, 40, 172, 112, g(54), g(96));
        ctx.strokeStyle = g(80);
        ctx.strokeRect(42, 48, 156, 96);
        break;
      case 3: // Biblioteca: legno scuro
        rect(ctx, 0, 0, RW, RH, g(60));
        ctx.strokeStyle = g(50);
        for (let x = 0; x < RW; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RH); ctx.stroke(); }
        break;
      case 4: // Salone: spina di pesce
        rect(ctx, 0, 0, RW, RH, g(82));
        ctx.strokeStyle = g(68);
        for (let y = -20; y < RH + 20; y += 16) for (let x = 0; x < RW; x += 16) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y + 8); ctx.lineTo(x + 16, y); ctx.stroke();
        }
        break;
      case 5: // Giardino: erba e ghiaia
        rect(ctx, 0, 0, RW, RH, g(58));
        for (let i = 0; i < 900; i++) rect(ctx, rng() * RW, rng() * RH, 1.5, 1.5, g(40 + Math.floor(rng() * 34)));
        ctx.fillStyle = g(104);
        ctx.fillRect(100, 0, 40, 70);
        ctx.fillRect(0, 70, 140, 40);
        for (let i = 0; i < 260; i++) {
          const x = rng() * 140;
          const y = rng() * 110;
          if ((x > 100 && y < 70) || (y > 70 && y < 110)) rect(ctx, x, y, 1.6, 1.6, g(80 + Math.floor(rng() * 50)));
        }
        break;
    }
  }

  function drawFurniture(ctx, id) {
    const F = g(150);
    const F2 = g(120);
    const E = g(30);
    switch (id) {
      case 0:
        rect(ctx, 8, 8, 224, 20, F, E); // bancone
        rect(ctx, 8, 8, 20, 164, F, E);
        circle(ctx, 60, 18, 6, g(60), E); circle(ctx, 80, 18, 6, g(60), E); // fornelli
        rect(ctx, 150, 12, 26, 12, g(110), E); // lavello
        rect(ctx, 200, 140, 30, 32, g(190), E); // frigo
        break;
      case 1:
        rect(ctx, 56, 26, 128, 36, g(132), E); // tavolo
        for (let x = 66; x < 184; x += 22) { rect(ctx, x, 14, 12, 9, F2, E); rect(ctx, x, 65, 12, 9, F2, E); }
        rect(ctx, 210, 12, 22, 40, g(108), E); // credenza
        break;
      case 2:
        rect(ctx, 14, 12, 84, 30, g(140), E); // scrivania
        rect(ctx, 46, 44, 18, 14, F2, E); // sedia
        rect(ctx, 216, 12, 16, 120, g(100), E); // libreria
        for (let y = 18; y < 128; y += 10) rect(ctx, 218, y, 12, 6, g(70 + (y % 30)));
        rect(ctx, 182, 140, 42, 32, g(126), E); // poltrona
        circle(ctx, PEDESTAL.x, PEDESTAL.y, PEDESTAL.r, g(176), E, 1.6); // piedistallo
        circle(ctx, PEDESTAL.x, PEDESTAL.y, PEDESTAL.r - 4, g(150));
        break;
      case 3:
        rect(ctx, 8, 8, 18, 164, g(100), E);
        rect(ctx, 8, 154, 160, 18, g(100), E);
        for (let y = 14; y < 150; y += 9) rect(ctx, 10, y, 14, 5, g(60 + (y % 40)));
        for (let x = 30; x < 166; x += 9) rect(ctx, x, 156, 5, 14, g(60 + (x % 40)));
        rect(ctx, 190, 128, 38, 40, g(140), E); // poltrona
        circle(ctx, 176, 150, 7, g(170), E); // lampada
        break;
      case 4:
        rect(ctx, 60, 138, 120, 26, g(136), E); // divano
        rect(ctx, 96, 108, 48, 20, g(110), E); // tavolino
        rect(ctx, 96, 8, 48, 14, g(40), E); // camino
        rect(ctx, 104, 10, 32, 8, g(200));
        rect(ctx, 14, 138, 26, 26, g(150), E); rect(ctx, 200, 138, 26, 26, g(150), E);
        break;
      case 5:
        circle(ctx, 182, 116, 24, g(130), E, 2); // fontana
        circle(ctx, 182, 116, 17, g(170));
        circle(ctx, 182, 116, 5, g(220));
        for (let x = 150; x < 236; x += 14) circle(ctx, x, 168, 9, g(44), g(22));
        for (let y = 60; y < 160; y += 14) circle(ctx, 228, y, 9, g(44), g(22));
        break;
    }
  }

  function drawWalls(ctx, id) {
    const r = ROOMS[id];
    const T = 7;
    const dw = 22;
    ctx.fillStyle = g(26);
    const sides = [
      { has: r.r > 0, draw: (a, b) => ctx.fillRect(a, 0, b - a, T), len: RW },
      { has: r.r < CONFIG.rows - 1, draw: (a, b) => ctx.fillRect(a, RH - T, b - a, T), len: RW },
      { has: r.c > 0, draw: (a, b) => ctx.fillRect(0, a, T, b - a), len: RH },
      { has: r.c < CONFIG.cols - 1, draw: (a, b) => ctx.fillRect(RW - T, a, T, b - a), len: RH },
    ];
    for (const s of sides) {
      if (s.has) { s.draw(0, s.len / 2 - dw); s.draw(s.len / 2 + dw, s.len); }
      else s.draw(0, s.len);
    }
  }

  const bgCache = {};
  function roomBackground(id) {
    if (bgCache[id]) return bgCache[id];
    const c = document.createElement('canvas');
    c.width = Math.round(RW * BG_SCALE);
    c.height = Math.round(RH * BG_SCALE);
    const ctx = c.getContext('2d');
    ctx.scale(BG_SCALE, BG_SCALE);
    let seed = 99 + id;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    drawFloor(ctx, id, rng);
    drawFurniture(ctx, id);
    drawWalls(ctx, id);
    bgCache[id] = c;
    return c;
  }

  let noiseTiles = null;
  function noise() {
    if (noiseTiles) return noiseTiles;
    noiseTiles = [];
    for (let k = 0; k < 4; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 200;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(200, 200);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      noiseTiles.push(c);
    }
    return noiseTiles;
  }

  // ---------------------------------------------------------------------------
  // Personaggi
  // ---------------------------------------------------------------------------
  function drawProp(ctx, prop, x, y, ang, r, fill, stroke, shadow) {
    const hx = x + Math.cos(ang + 1.0) * (r + 2);
    const hy = y + Math.sin(ang + 1.0) * (r + 2);
    ctx.save();
    ctx.lineCap = 'round';
    switch (prop) {
      case 'cup':
        circle(ctx, hx, hy, 3.4, fill, stroke, 1);
        ctx.beginPath(); ctx.arc(hx + 3.6 * Math.cos(ang), hy + 3.6 * Math.sin(ang), 1.6, 0, Math.PI * 2);
        ctx.strokeStyle = shadow ? fill : stroke; ctx.lineWidth = 1.2; ctx.stroke();
        break;
      case 'cane':
        ctx.strokeStyle = shadow ? fill : g(36); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * 15, hy + Math.sin(ang) * 15); ctx.stroke();
        circle(ctx, hx, hy, 2.4, shadow ? fill : g(200));
        break;
      case 'book':
        ctx.translate(hx, hy); ctx.rotate(ang);
        ctx.fillStyle = fill; ctx.fillRect(-3, -4.5, 8, 9);
        if (!shadow) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(-3, -4.5, 8, 9); ctx.fillStyle = g(250); ctx.fillRect(-1, -3.5, 1, 7); }
        break;
      case 'umbrella': {
        const ex = hx + Math.cos(ang + 0.15) * 22;
        const ey = hy + Math.sin(ang + 0.15) * 22;
        if (!shadow) { ctx.strokeStyle = g(205); ctx.lineWidth = 5.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke(); }
        ctx.strokeStyle = shadow ? fill : g(20); ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = shadow ? fill : g(210); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(hx - Math.cos(ang) * 2, hy - Math.sin(ang) * 2, 2.6, ang, ang + Math.PI); ctx.stroke();
        break;
      }
      case 'scarf': {
        const bx = x - Math.cos(ang) * (r + 1);
        const by = y - Math.sin(ang) * (r + 1);
        ctx.strokeStyle = shadow ? fill : g(236); ctx.lineWidth = 3;
        for (const off of [-0.35, 0.35]) {
          ctx.beginPath(); ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx - Math.cos(ang + off) * 8, by - Math.sin(ang + off) * 8, bx - Math.cos(ang + off * 1.6) * 14, by - Math.sin(ang + off * 1.6) * 14);
          ctx.stroke();
        }
        break;
      }
      case 'hat':
        if (shadow) circle(ctx, x, y, r + 4.5, fill);
        break;
    }
    ctx.restore();
  }

  function drawHat(ctx, x, y, r) {
    circle(ctx, x, y, r + 4.5, g(24), g(8), 1);
    circle(ctx, x, y, r * 0.62, g(46), g(10), 1);
    ctx.strokeStyle = g(210);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r * 0.62 + 1.6, 0, Math.PI * 2); ctx.stroke();
  }

  function patternFill(ctx, L, x, y, r) {
    const dark = L.lum > 140 ? g(Math.max(0, L.lum - 120)) : g(Math.min(255, L.lum + 110));
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = g(L.lum); ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = 1.6;
    switch (L.pattern) {
      case 'stripes':
        for (let k = -r * 2; k < r * 2; k += 4.5) { ctx.beginPath(); ctx.moveTo(x + k, y - r); ctx.lineTo(x + k + r * 2, y + r); ctx.stroke(); }
        break;
      case 'dots':
        for (let a = -r; a < r; a += 5) for (let b = -r; b < r; b += 5) circle(ctx, x + a + 2, y + b + 2, 1.2, dark);
        break;
      case 'half':
        ctx.fillRect(x, y - r, r, r * 2);
        break;
      case 'ring':
        ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'cross':
        ctx.fillRect(x - r, y - 1.6, r * 2, 3.2); ctx.fillRect(x - 1.6, y - r, 3.2, r * 2);
        break;
    }
    ctx.restore();
  }

  function drawCharacter(ctx, ch, initials, time) {
    const T = AVATARS[ch.idx]; // vero personaggio: ombra e oggetti
    const L = AVATARS[ch.look]; // aspetto mostrato (diverso solo durante il deepfake)
    const bob = ch.moving ? Math.sin(time * 15 + ch.idx * 2) * 0.7 : 0;
    const x = ch.x;
    const y = ch.y + bob;
    // ombra: sempre la sagoma vera
    const sx = x + T.h * 1.7;
    const sy = y + T.h * 1.25;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(sx, sy, T.r * 1.08, T.r * 0.9, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
    drawProp(ctx, T.prop, sx, sy, ch.ang, T.r, 'rgba(0,0,0,0.42)', null, true);
    ctx.restore();
    // braccio teso verso il piedistallo durante il furto
    if (ch.crime) {
      const ped = IA.toGlobal(STUDIO, [PEDESTAL.x, PEDESTAL.y]);
      const a = Math.atan2(ped.y - y, ped.x - x);
      ctx.strokeStyle = g(L.lum > 140 ? 200 : 140); ctx.lineWidth = 3; ctx.lineCap = 'round';
      const reach = 10 + Math.sin(time * 6) * 4;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * L.r, y + Math.sin(a) * L.r);
      ctx.lineTo(x + Math.cos(a) * (L.r + reach), y + Math.sin(a) * (L.r + reach)); ctx.stroke();
    }
    if (T.prop !== 'hat' && T.prop !== 'scarf') drawProp(ctx, T.prop, x, y, ch.ang, L.r, g(190), g(20));
    if (T.prop === 'scarf') drawProp(ctx, 'scarf', x, y, ch.ang, L.r, g(236), g(20));
    patternFill(ctx, L, x, y, L.r);
    circle(ctx, x, y, L.r, null, g(12), 1.6);
    // direzione dello sguardo
    circle(ctx, x + Math.cos(ch.ang) * (L.r - 2.5), y + Math.sin(ch.ang) * (L.r - 2.5), 1.6, L.lum > 140 ? g(10) : g(245));
    if (T.prop === 'hat') drawHat(ctx, x, y, L.r);
    const label = initials[ch.look] || L.key;
    ctx.font = `bold ${Math.max(8, L.r * 1.05)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const onHat = T.prop === 'hat';
    ctx.fillStyle = onHat ? g(240) : L.lum > 140 ? g(10) : g(250);
    if (!onHat && (L.pattern === 'stripes' || L.pattern === 'dots' || L.pattern === 'cross')) {
      ctx.lineWidth = 2.6; ctx.strokeStyle = L.lum > 140 ? g(250) : g(10); ctx.strokeText(label, x, y + 0.5);
    }
    ctx.fillText(label, x, y + 0.5);
  }

  function drawJewel(ctx, time) {
    const p = IA.toGlobal(STUDIO, [PEDESTAL.x, PEDESTAL.y]);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(5, -1); ctx.lineTo(0, 6); ctx.lineTo(-5, -1); ctx.closePath();
    ctx.fillStyle = g(250); ctx.fill(); ctx.strokeStyle = g(30); ctx.lineWidth = 1; ctx.stroke();
    const tw = (Math.sin(time * 5) + 1) / 2;
    ctx.strokeStyle = g(255, 0.4 + tw * 0.6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-9 - tw * 2, -7); ctx.lineTo(-5, -7); ctx.moveTo(-7, -9 - tw * 2); ctx.lineTo(-7, -5); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------------------
  function Renderer(canvas) {
    this.canvas = canvas;
    canvas.width = CW;
    canvas.height = CH;
    this.ctx = canvas.getContext('2d');
    this.focus = null;
  }
  Renderer.W = CW;
  Renderer.H = CH;

  Renderer.prototype.feedRect = function (cam) {
    if (this.focus === null || this.focus === undefined) {
      const r = ROOMS[cam];
      return { x: GAP + r.c * (FW + GAP), y: GAP + r.r * (FH + GAP), w: FW, h: FH, s: FW / RW };
    }
    if (cam !== this.focus) return null;
    const s = Math.min((CW - GAP * 2) / RW, (CH - GAP * 2) / RH);
    const w = RW * s;
    const h = RH * s;
    return { x: (CW - w) / 2, y: (CH - h) / 2, w, h, s };
  };
  Renderer.prototype.hit = function (px, py) {
    for (let cam = 0; cam < ROOMS.length; cam++) {
      const r = this.feedRect(cam);
      if (r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return { cam, lx: (px - r.x) / r.s, ly: (py - r.y) / r.s };
    }
    return null;
  };
  Renderer.prototype.toScreen = function (cam, lx, ly) {
    const r = this.feedRect(cam);
    if (!r) return null;
    return { x: r.x + lx * r.s, y: r.y + ly * r.s, s: r.s };
  };

  /**
   * opts: { cs, edits, t, initials, time, selectedCam, mode: 'live'|'edit'|'replay', previewEdits, pins, lasers, botMarks }
   */
  Renderer.prototype.draw = function (o) {
    const ctx = this.ctx;
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, CW, CH);
    const tiles = noise();
    for (let cam = 0; cam < ROOMS.length; cam++) {
      const R = this.feedRect(cam);
      if (!R) continue;
      const st = IA.feedState(o.cs, o.edits, cam, o.t);
      ctx.save();
      ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      if (st.glitch) {
        this.drawStatic(R, o.time, tiles);
      } else {
        ctx.drawImage(roomBackground(cam), R.x, R.y, R.w, R.h);
        ctx.save();
        ctx.translate(R.x, R.y);
        ctx.scale(R.s, R.s);
        const rr = IA.roomRect(cam);
        ctx.translate(-rr.x, -rr.y);
        if (st.jewel) drawJewel(ctx, o.time);
        const sorted = st.chars.slice().sort((a, b) => a.y - b.y);
        for (const ch of sorted) drawCharacter(ctx, ch, o.initials, o.time);
        if (o.mode === 'replay') this.replayMarks(ctx, o, st, cam);
        ctx.restore();
        // pellicola: rumore, scanline, vignetta
        ctx.globalAlpha = 0.07;
        ctx.drawImage(tiles[Math.floor(o.time * 24) % 4], R.x - Math.random() * 40, R.y - Math.random() * 40, R.w + 80, R.h + 80);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      for (let y = R.y; y < R.y + R.h; y += 3) ctx.fillRect(R.x, y, R.w, 1);
      const vg = ctx.createRadialGradient(R.x + R.w / 2, R.y + R.h / 2, R.h * 0.35, R.x + R.w / 2, R.y + R.h / 2, R.w * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(R.x, R.y, R.w, R.h);
      this.hud(R, cam, st, o);
      ctx.restore();
      // cornici
      ctx.lineWidth = 2;
      if (o.mode === 'replay' && this.editedAt(o, cam)) { ctx.strokeStyle = '#ff3b3b'; ctx.setLineDash([8, 5]); }
      else if (o.selectedCam === cam) ctx.strokeStyle = '#ffb703';
      else ctx.strokeStyle = '#1d2733';
      ctx.strokeRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
      ctx.setLineDash([]);
    }
    this.drawPins(o);
    this.drawBotMarks(o);
    this.drawLasers(o);
    if (o.banner) this.drawBanner(o.banner);
  };

  Renderer.prototype.editedAt = function (o, cam) {
    const e = o.realEdits;
    if (!e) return false;
    const t = o.t;
    if (e.splice && e.splice.cam === cam && t >= e.splice.t0 && t < e.splice.t0 + e.splice.len) return true;
    if (e.glitch && e.glitch.cam === cam && t >= e.glitch.t0 && t < e.glitch.t0 + e.glitch.len) return true;
    return false;
  };

  Renderer.prototype.drawStatic = function (R, time, tiles) {
    const ctx = this.ctx;
    ctx.fillStyle = '#111';
    ctx.fillRect(R.x, R.y, R.w, R.h);
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(tiles[(Math.floor(time * 30) + k) % 4], R.x - Math.random() * 60, R.y - Math.random() * 60, R.w + 120, R.h + 120);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const y = R.y + Math.random() * R.h;
      ctx.fillStyle = g(Math.random() > 0.5 ? 230 : 20, 0.5);
      ctx.fillRect(R.x, y, R.w, 2 + Math.random() * 10);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const fs = Math.round(R.h * 0.075);
    ctx.font = `bold ${fs}px "Courier New", monospace`;
    const txt = 'SEGNALE PERSO';
    const w = ctx.measureText(txt).width + 24;
    ctx.fillRect(R.x + R.w / 2 - w / 2, R.y + R.h / 2 - fs, w, fs * 2);
    ctx.fillStyle = '#eee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, R.x + R.w / 2, R.y + R.h / 2);
  };

  Renderer.prototype.hud = function (R, cam, st, o) {
    const ctx = this.ctx;
    const fs = Math.max(11, Math.round(R.h * 0.045));
    ctx.font = `bold ${fs}px "Courier New", monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const label = `CAM 0${cam + 1} ${ROOMS[cam].name.toUpperCase()}`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(R.x + 6, R.y + 6, ctx.measureText(label).width + 10, fs + 6);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText(label, R.x + 11, R.y + 9);
    // REC
    if (Math.floor(o.time * 1.6) % 2 === 0) {
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath(); ctx.arc(R.x + R.w - 44, R.y + 9 + fs / 2, fs * 0.32, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e8e8e8';
    ctx.textAlign = 'right';
    ctx.fillText('REC', R.x + R.w - 9, R.y + 9);
    // timestamp: mostra il tempo DELLA SORGENTE — è qui che lo splice si tradisce
    const ts = IA.clockText(st.s, true);
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(ts).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(R.x + R.w - tw - 16, R.y + R.h - fs - 12, tw + 10, fs + 6);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillText(ts, R.x + R.w - 11, R.y + R.h - 9);
    if (o.mode === 'edit' && o.previewEdits && (st.spliced || st.glitch)) {
      ctx.textAlign = 'left';
      ctx.fillStyle = st.glitch ? '#ff6b6b' : '#ffb703';
      ctx.fillText(st.glitch ? '▲ DISTURBO' : `✂ TAGLIO da ${IA.clockText(st.s)}`, R.x + 10, R.y + R.h - 9);
    }
  };

  Renderer.prototype.replayMarks = function (ctx, o, st, cam) {
    const cs = o.cs;
    for (const ch of st.chars) {
      if (ch.idx !== cs.culprit) continue;
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(ch.x, ch.y, AVATARS[ch.idx].r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    const e = o.realEdits;
    if (e && e.deepfake && o.t >= e.deepfake.t && o.t < e.deepfake.t + CONFIG.deepfake.len) {
      const ch = st.chars.find((c) => c.idx === cs.culprit && c.inRoom);
      if (ch) {
        ctx.fillStyle = '#ff3b3b';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`DEEPFAKE: sembrava ${o.initials[e.deepfake.victim]}`, ch.x, ch.y - AVATARS[ch.idx].r - 14);
      }
    }
    if (this.editedAt(o, cam)) {
      const r = IA.roomRect(cam);
      ctx.fillStyle = 'rgba(255,40,40,0.85)';
      ctx.fillRect(r.x + 8, r.y + 30, 150, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const glitch = e.glitch && e.glitch.cam === cam && o.t >= e.glitch.t0 && o.t < e.glitch.t0 + e.glitch.len;
      ctx.fillText(glitch ? 'QUI C\'ERA IL DISTURBO' : `TAGLIO: mostrava ${IA.clockText(IA.sourceTime(e, cam, o.t))}`, r.x + 12, r.y + 38);
    }
  };

  Renderer.prototype.drawPins = function (o) {
    if (!o.pins) return;
    const ctx = this.ctx;
    o.pins.forEach((p, i) => {
      const s = this.toScreen(p.cam, p.lx, p.ly);
      if (!s) return;
      const near = Math.abs(o.t - p.t) < 1.2;
      ctx.globalAlpha = near ? 1 : 0.35;
      ctx.fillStyle = p.color || '#ffb703';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y - 14, 8, Math.PI * 0.75, Math.PI * 2.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), s.x, s.y - 14);
      ctx.globalAlpha = 1;
    });
  };

  Renderer.prototype.drawBotMarks = function (o) {
    if (!o.botMarks) return;
    const ctx = this.ctx;
    for (const m of o.botMarks) {
      const age = o.now - m.born;
      if (age > m.life) continue;
      const s = this.toScreen(m.cam, m.lx, m.ly);
      if (!s) continue;
      const k = Math.min(1, age / 0.6);
      const fade = age > m.life - 0.8 ? (m.life - age) / 0.8 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const rad = 22 * (s.s / 1.67);
      for (let a = 0; a <= Math.PI * 2.15 * k; a += 0.15) {
        const rr = rad + Math.sin(a * 3 + m.seed) * 3;
        const x = s.x + Math.cos(a) * rr * 1.25;
        const y = s.y + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = m.color;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, s.x, s.y - rad - 8);
      ctx.restore();
    }
  };

  Renderer.prototype.drawLasers = function (o) {
    if (!o.lasers) return;
    const ctx = this.ctx;
    for (const L of o.lasers) {
      const pts = L.points.filter((p) => o.now - p.t < 2.2);
      if (!pts.length) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = L.color;
      ctx.shadowColor = L.color;
      ctx.shadowBlur = 12;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].brk) continue;
        ctx.globalAlpha = Math.max(0, 1 - (o.now - pts[i].t) / 2.2);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      const last = pts[pts.length - 1];
      if (o.now - last.t < 0.5) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  };

  Renderer.prototype.drawBanner = function (text) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 26px "Courier New", monospace';
    const w = ctx.measureText(text).width + 40;
    ctx.fillStyle = 'rgba(200,20,30,0.88)';
    ctx.fillRect(CW / 2 - w / 2, 14, w, 42);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, CW / 2, 36);
    ctx.restore();
  };

  // ---------------------------------------------------------------------------
  // Animazione comica di espulsione dalla villa
  // ---------------------------------------------------------------------------
  Renderer.prototype.drawExpel = function (o) {
    const ctx = this.ctx;
    const p = o.progress; // 0..1 (circa 4 s)
    const sky = ctx.createLinearGradient(0, 0, 0, CH);
    sky.addColorStop(0, '#1b2a4a');
    sky.addColorStop(1, '#3d2c55');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + ((i * 37) % 7) / 10})`;
      ctx.fillRect((i * 197) % CW, (i * 89) % 300, 2, 2);
    }
    ctx.fillStyle = '#f6e8b1';
    ctx.beginPath(); ctx.arc(1050, 100, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b5d34';
    ctx.fillRect(0, 520, CW, 98);
    // villa
    const vx = 330;
    ctx.fillStyle = '#e9dcc3';
    ctx.fillRect(vx, 300, 420, 220);
    ctx.fillStyle = '#9b3b2f';
    ctx.beginPath(); ctx.moveTo(vx - 30, 300); ctx.lineTo(vx + 210, 190); ctx.lineTo(vx + 450, 300); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd56b';
    for (let i = 0; i < 4; i++) { ctx.fillRect(vx + 30 + i * 100, 340, 50, 50); ctx.fillRect(vx + 30 + i * 100, 420, 50, 40); }
    ctx.fillStyle = '#5a3b22';
    const doorOpen = Math.min(1, p * 4);
    ctx.fillRect(vx + 180, 430, 60, 90);
    ctx.fillStyle = '#1a0f08';
    ctx.fillRect(vx + 180, 430, 60 * doorOpen, 90);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('VILLA ALIBI', vx + 210, 290);
    // traiettoria del colpevole
    const av = AVATARS[o.culprit];
    let x;
    let y;
    let rot = 0;
    let sc = 1;
    if (p < 0.25) {
      x = vx + 210; y = 480; sc = 0.6 + p * 1.6;
    } else {
      const k = (p - 0.25) / 0.75;
      x = vx + 210 + k * 900;
      y = 480 - Math.sin(k * Math.PI) * 420 + k * 60;
      rot = k * Math.PI * 7;
      sc = 1 + k * 0.6;
    }
    // stivale
    if (p > 0.18 && p < 0.42) {
      const kb = (p - 0.18) / 0.24;
      ctx.save();
      ctx.translate(vx + 160 + kb * 30, 470);
      ctx.rotate(-0.6 + kb * 1.0);
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(-10, -60, 26, 60);
      ctx.fillRect(-10, -10, 56, 22);
      ctx.restore();
      if (p > 0.24 && p < 0.34) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px Impact, sans-serif';
        ctx.fillText('BAM!', vx + 260, 420);
      }
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sc * 2.2, sc * 2.2);
    ctx.fillStyle = av.color;
    ctx.beginPath(); ctx.arc(0, 0, av.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = `bold ${av.r}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.initials[o.culprit], 0, 1);
    ctx.restore();
    if (p > 0.3) {
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4 + p * 3;
        const d = (p - 0.3) * 900 * ((i % 5) + 1) / 5;
        ctx.fillStyle = ['#ff4d6d', '#ffd43b', '#4dabf7', '#69db7c', '#da77f2'][i % 5];
        ctx.fillRect(vx + 210 + Math.cos(a) * d, 430 + Math.sin(a) * d * 0.6 + d * 0.3, 7, 4);
      }
    }
    const tp = Math.min(1, Math.max(0, (p - 0.35) * 3));
    ctx.save();
    ctx.globalAlpha = tp;
    ctx.translate(CW / 2, 110);
    ctx.scale(0.6 + tp * 0.4, 0.6 + tp * 0.4);
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('ESPULSO DALLA VILLA!', 0, 0);
    ctx.fillText('ESPULSO DALLA VILLA!', 0, 0);
    ctx.font = 'bold 28px sans-serif';
    ctx.lineWidth = 4;
    const sub = `${o.name} era il colpevole`;
    ctx.strokeText(sub, 0, 50);
    ctx.fillStyle = '#fff';
    ctx.fillText(sub, 0, 50);
    ctx.restore();
  };

  IA.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
