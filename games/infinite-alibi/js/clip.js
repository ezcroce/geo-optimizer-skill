/* Infinite Alibi — generatore automatico di clip verticali 9:16 (TikTok / Shorts / Reels).
 *
 * Copione (~16 s): titolo → la telecamera sotto accusa nella versione truccata con il fumetto
 * dell'indizio e il laser → confronto truccato/reale uno sopra l'altro → verdetto (espulsione
 * comica oppure «l'ha fatta franca»). Viene disegnato in tempo reale su un canvas 720×1280
 * e registrato con MediaRecorder.
 */
(function (root) {
  'use strict';
  const IA = (root.IA = root.IA || {});
  const { CONFIG, ROOMS, STUDIO, AVATARS, PEDESTAL } = IA;
  const VW = 720;
  const VH = 1280;
  const D = CONFIG.duration;
  const SCRIPT = { title: 2, fake: 5.5, split: 5, verdict: 4.5 };
  const TOTAL = SCRIPT.title + SCRIPT.fake + SCRIPT.split + SCRIPT.verdict;

  function keyClue(cs, clues) {
    let best = null;
    let bs = -Infinity;
    for (const c of clues) {
      if (c.type === 'visit' || c.type === 'lurk') continue;
      const p = c.points[cs.culprit] || 0;
      const sc = c.notice * (p > 0 ? p : Object.keys(c.points).length ? -1 : 0.6);
      if (sc > bs) { bs = sc; best = c; }
    }
    return best || { cam: STUDIO, t: cs.Tc, lx: PEDESTAL.x, ly: PEDESTAL.y, say: 'Chi ha preso il gioiello?', type: 'crime' };
  }

  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const tryL = line ? line + ' ' + w : w;
      if (ctx.measureText(tryL).width > maxW && line) { lines.push(line); line = w; } else line = tryL;
    }
    if (line) lines.push(line);
    return lines;
  }

  function outlined(ctx, text, x, y, size, fill, stroke) {
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 8);
    ctx.strokeStyle = stroke || '#000';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill || '#fff';
    ctx.fillText(text, x, y);
  }

  function token(ctx, idx, initials, x, y, r) {
    const av = AVATARS[idx];
    ctx.fillStyle = av.color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, r / 10); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.round(r * 0.95)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials[idx], x, y + 1);
  }

  function bubble(ctx, who, color, text, y) {
    ctx.font = '600 30px system-ui, sans-serif';
    const lines = wrap(ctx, text, VW - 120);
    const h = 64 + lines.length * 38;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(40, y, VW - 80, h, 26); else ctx.rect(40, y, VW - 80, h);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(110, y); ctx.lineTo(140, y - 26); ctx.lineTo(160, y); ctx.fill();
    ctx.fillStyle = color;
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(who, 66, y + 16);
    ctx.fillStyle = '#111';
    ctx.font = '600 30px system-ui, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, 66, y + 52 + i * 38));
  }

  function label(ctx, text, x, y, bg) {
    ctx.font = 'bold 28px "Courier New", monospace';
    const w = ctx.measureText(text).width + 28;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, 44);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 14, y + 23);
  }

  function scribble(ctx, x, y, rad, k, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2.2 * k; a += 0.12) {
      const rr = rad + Math.sin(a * 3) * 5;
      const px = x + Math.cos(a) * rr * 1.2;
      const py = y + Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * opts: { cs, edits, clues, verdict:{caught, convicted}, initials, seed, speaker?, canvas?, onProgress?(0..1) }
   * Ritorna { canvas, done: Promise<Blob|null>, cancel() }
   */
  function makeVerticalClip(opts) {
    const { cs, edits, clues, verdict, initials } = opts;
    const canvas = opts.canvas || document.createElement('canvas');
    canvas.width = VW;
    canvas.height = VH;
    const ctx = canvas.getContext('2d');
    const hidden = new IA.Renderer(document.createElement('canvas'));
    const key = keyClue(cs, clues);
    const w0 = Math.max(0, Math.min(D - SCRIPT.fake, key.t - 2.5));
    let speaker = opts.speaker;
    if (speaker == null || speaker < 0) speaker = (cs.culprit + 1) % cs.n;
    const name = (i) => cs.names[i];

    let rec = null;
    const chunks = [];
    if (canvas.captureStream && root.MediaRecorder) {
      const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      try {
        rec = new MediaRecorder(canvas.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 4e6 } : undefined);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      } catch (e) { rec = null; }
    }
    let cancelled = false;
    let resolveDone;
    const done = new Promise((r) => (resolveDone = r));
    const start = performance.now() / 1000;

    function frame() {
      if (cancelled) return;
      const now = performance.now() / 1000;
      const T = now - start;
      draw(T, now);
      if (opts.onProgress) opts.onProgress(Math.min(1, T / TOTAL));
      if (T < TOTAL) requestAnimationFrame(frame);
      else if (rec && rec.state === 'recording') {
        rec.onstop = () => resolveDone(new Blob(chunks, { type: 'video/webm' }));
        rec.stop();
      } else resolveDone(null);
    }

    function bg() {
      const gr = ctx.createLinearGradient(0, 0, 0, VH);
      gr.addColorStop(0, '#0b0f16');
      gr.addColorStop(1, '#161022');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, VW, VH);
    }
    function footer() {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`INFINITE ALIBI · caso n° ${opts.seed}`, VW / 2, VH - 70);
      ctx.fillStyle = '#ffb703';
      ctx.fillText('#InfiniteAlibi', VW / 2, VH - 36);
    }
    function feedOpts(t, now, real) {
      return { cs, edits: real ? null : edits, realEdits: edits, t, initials, time: now, now, mode: real ? 'replay' : 'live' };
    }

    function draw(T, now) {
      bg();
      let t1 = T;
      if (t1 < SCRIPT.title) {
        const k = Math.min(1, t1 / 0.5);
        outlined(ctx, 'CHI HA RUBATO', VW / 2, 330, 74 * (0.7 + 0.3 * k), '#fff');
        outlined(ctx, 'IL GIOIELLO? 💎', VW / 2, 420, 74 * (0.7 + 0.3 * k), '#ffd43b');
        const n = cs.n;
        for (let i = 0; i < n; i++) {
          const x = VW / 2 + (i - (n - 1) / 2) * 116;
          const y = 640 + Math.sin(now * 4 + i) * 10;
          token(ctx, i, initials, x, y, 46);
          ctx.fillStyle = '#ccd';
          ctx.font = '600 20px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(name(i).split(' ').pop(), x, y + 74);
        }
        ctx.fillStyle = '#9fb0c2';
        ctx.font = '600 30px system-ui, sans-serif';
        ctx.fillText('Uno di loro ha truccato i filmati.', VW / 2, 860);
        ctx.fillText('Riesci a trovare il trucco?', VW / 2, 905);
        footer();
        return;
      }
      t1 -= SCRIPT.title;
      if (t1 < SCRIPT.fake) {
        const ft = w0 + t1;
        const R = IA.Renderer.fitRect(0, 300, VW, 560);
        hidden.drawFeed(ctx, R, key.cam, feedOpts(ft, now, false));
        label(ctx, '📼 FILMATO DI SORVEGLIANZA', 30, 220, 'rgba(0,0,0,0.75)');
        outlined(ctx, 'GUARDA BENE…', VW / 2, 140, 64, '#ffd43b');
        if (ft >= key.t - 0.4) {
          const k = Math.min(1, (ft - (key.t - 0.4)) / 0.7);
          scribble(ctx, R.x + key.lx * R.s, R.y + key.ly * R.s, 46, k, AVATARS[speaker].color);
          bubble(ctx, name(speaker), AVATARS[speaker].color, key.say || key.text, 920);
        }
        footer();
        return;
      }
      t1 -= SCRIPT.fake;
      if (t1 < SCRIPT.split) {
        const ft = w0 + Math.min(SCRIPT.fake, t1 * (SCRIPT.fake / SCRIPT.split));
        const Rt = IA.Renderer.fitRect(20, 150, VW - 40, 470);
        const Rb = IA.Renderer.fitRect(20, 690, VW - 40, 470);
        hidden.drawFeed(ctx, Rt, key.cam, feedOpts(ft, now, false));
        hidden.drawFeed(ctx, Rb, key.cam, feedOpts(ft, now, true));
        label(ctx, '📼 TRUCCATO', Rt.x + 10, Rt.y + Rt.h - 56, 'rgba(255,140,0,0.9)');
        label(ctx, '🎞 REPLAY REALE', Rb.x + 10, Rb.y + Rb.h - 56, 'rgba(220,30,40,0.92)');
        outlined(ctx, 'LA VERITÀ:', VW / 2, 80, 60, '#fff');
        footer();
        return;
      }
      t1 -= SCRIPT.split;
      const p = Math.min(1, t1 / (SCRIPT.verdict - 0.6));
      if (verdict && verdict.caught) {
        hidden.drawExpel({ progress: p, culprit: cs.culprit, initials, name: name(cs.culprit) });
        ctx.drawImage(hidden.canvas, 250, 170, 724, 448, 0, 420, VW, 446);
        outlined(ctx, 'ESPULSO', VW / 2, 190, 110, '#ffd43b');
        outlined(ctx, 'DALLA VILLA!', VW / 2, 300, 84, '#ffd43b');
        ctx.fillStyle = '#fff';
        ctx.font = '800 38px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${name(cs.culprit)} era il colpevole`, VW / 2, 950);
      } else {
        ctx.fillStyle = '#2a0710';
        ctx.fillRect(0, 0, VW, VH);
        outlined(ctx, "L'HA FATTA", VW / 2, 230, 96, '#ff4d6d');
        outlined(ctx, 'FRANCA! 😈', VW / 2, 340, 96, '#ff4d6d');
        const bounce = Math.abs(Math.sin(now * 5)) * 20;
        token(ctx, cs.culprit, initials, VW / 2, 600 - bounce, 120);
        ctx.fillStyle = '#fff';
        ctx.font = '800 40px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Era ${name(cs.culprit)}`, VW / 2, 800);
        ctx.font = '600 32px system-ui, sans-serif';
        ctx.fillStyle = '#ffc9d0';
        ctx.fillText(verdict && verdict.convicted >= 0 ? `Condannato per errore: ${name(verdict.convicted)}` : 'La giuria non si è messa d\'accordo', VW / 2, 860);
      }
      footer();
    }

    if (rec) rec.start(250);
    requestAnimationFrame(frame);
    return {
      canvas,
      done,
      total: TOTAL,
      cancel() { cancelled = true; if (rec && rec.state === 'recording') rec.stop(); resolveDone(null); },
    };
  }

  IA.makeVerticalClip = makeVerticalClip;
  IA.CLIP_TOTAL = TOTAL;
})(typeof window !== 'undefined' ? window : globalThis);
