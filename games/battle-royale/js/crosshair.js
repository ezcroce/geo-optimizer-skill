// ─────────────────────────────────────────────────────────────
//  v32: mirino dinamico disegnato su canvas.
//  · le linee si aprono quanto la dispersione vera dell'arma (movimento, salto, mira, colpi in fila)
//    e "saltano" a ogni colpo, poi rientrano con una molla
//  · forma diversa per ogni famiglia d'armi (pistola, mitraglietta, fucile, pompa, cecchino, razzi,
//    minigun, piccone, consumabili)
//  · diventa rosso quando punta un nemico, si attenua fuori portata o mentre si scatta (non si spara)
//  · anelli d'informazione: ricarica, colpo pronto (armi lente), caricatore quasi vuoto, uso di cure e scudi
//  · indicatori di colpo: bianco al corpo, azzurro sullo scudo, giallo alla testa, rosso per l'eliminazione
// ─────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const S = 220, C = S / 2;                         // lato del canvas (px CSS) e centro
const COL = { ally: '#4dff7a', enemy: '#ff4848', head: '#ffd23a', shield: '#5ac8ff', body: '#ffffff', kill: '#ff3030', heal: '#7dff8a', shieldUse: '#5ad0ff' };
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hexNum(c) {
  if (c[0] === '#') return parseInt(c.slice(1), 16);
  const m = c.match(/\d+/g) || [255, 255, 255];
  return (+m[0] << 16) | (+m[1] << 8) | +m[2];
}
function mixHex(a, b, t) {
  const pa = hexNum(a), pb = hexNum(b);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

export function createCrosshair(el) {
  el.innerHTML = '';
  const cv = document.createElement('canvas');
  el.appendChild(cv);
  const g = cv.getContext('2d');
  let dpr = 0;
  const st = { gap: 6, kickV: 0, kick: 0, enemyK: 0, alpha: 1, style: 'cross', hits: [], killT: 0, styleT: 1, prevStyle: '' };

  function resize() {
    const d = Math.min(3, window.devicePixelRatio || 1);
    if (d === dpr) return;
    dpr = d; cv.width = cv.height = Math.round(S * d);
  }

  // ── primitive con bordo scuro (si leggono su cielo, neve e buio) ──
  let col = '#fff', lw = 2;
  function strokePath(path, w = lw, c = col) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = w + 2.2; path(); g.stroke();
    // v35: alone luminoso del colore del mirino (stile "neon" dei riferimenti)
    g.shadowColor = c; g.shadowBlur = glowPx;
    g.strokeStyle = c; g.lineWidth = w; path(); g.stroke();
    g.shadowBlur = 0;
  }
  let glowPx = 4;
  const line = (x1, y1, x2, y2, w, c) => strokePath(() => { g.beginPath(); g.moveTo(C + x1, C + y1); g.lineTo(C + x2, C + y2); }, w, c);
  const arc = (r, a0, a1, w, c) => strokePath(() => { g.beginPath(); g.arc(C, C, r, a0, a1); }, w, c);
  function dot(r = 1.6, c = col) {
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(C, C, r + 1.1, 0, TAU); g.fill();
    g.shadowColor = c; g.shadowBlur = glowPx;
    g.fillStyle = c; g.beginPath(); g.arc(C, C, r, 0, TAU); g.fill();
    g.shadowBlur = 0;
  }
  /** quattro linee (o meno: mask = [su, giù, sinistra, destra]) a distanza gap, lunghe len */
  function ticks(gap, len, w, mask = [1, 1, 1, 1]) {
    if (mask[0]) line(0, -gap, 0, -gap - len, w);
    if (mask[1]) line(0, gap, 0, gap + len, w);
    if (mask[2]) line(-gap, 0, -gap - len, 0, w);
    if (mask[3]) line(gap, 0, gap + len, 0, w);
  }
  function brackets(r, l, w) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strokePath(() => { g.beginPath(); g.moveTo(C + sx * r, C + sy * (r - l)); g.lineTo(C + sx * r, C + sy * r); g.lineTo(C + sx * (r - l), C + sy * r); }, w);
  }
  /** anello d'avanzamento (0..1) con traccia leggera sotto */
  function ring(r, k, c, w = 2.4, a0 = -Math.PI / 2, span = TAU) {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = w + 2; g.beginPath(); g.arc(C, C, r, a0, a0 + span); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = w; g.beginPath(); g.arc(C, C, r, a0, a0 + span); g.stroke();
    if (k > 0.001) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(C, C, r, a0, a0 + span * clamp(k, 0, 1)); g.stroke(); }
  }

  /** punto pieno in una posizione qualsiasi (pallini, mil-dot) */
  function pip(x, y, r, c = col) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(C + x, C + y, r + 0.9, 0, TAU); g.fill();
    g.shadowColor = c; g.shadowBlur = glowPx * 0.7;
    g.fillStyle = c; g.beginPath(); g.arc(C + x, C + y, r, 0, TAU); g.fill();
    g.shadowBlur = 0;
  }
  /** cerchio vuoto in una posizione qualsiasi */
  function ringAt(x, y, r, w, fill) {
    strokePath(() => { g.beginPath(); g.arc(C + x, C + y, r, 0, TAU); }, w);
    if (fill) { g.fillStyle = col; g.beginPath(); g.arc(C + x, C + y, r * 0.55, 0, TAU); g.fill(); }
  }
  /** rombo vuoto al centro */
  function diamond(r, w) { strokePath(() => { g.beginPath(); g.moveTo(C, C - r); g.lineTo(C + r, C); g.lineTo(C, C + r); g.lineTo(C - r, C); g.closePath(); }, w); }
  /** tacca radiale all'angolo a, da r0 a r1 */
  const radial = (a, r0, r1, w, c) => line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1, w, c);
  /** raggio degli anelli: segue la dispersione ma non scende sotto un minimo leggibile */
  const arR = (gp, s) => Math.max(9 * s, gp * 0.9 + 4 * s);
  const shotR = (gp, s) => Math.max(10 * s, gp * 0.92 + 3 * s);
  /** quattro archi centrati sulle diagonali (rot) di ampiezza span (radianti) */
  function shotArcs(r, span, w, rot = Math.PI / 4) { for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; arc(r, a - span / 2, a + span / 2, w); } }
  const faint = (k, fn) => { const a = g.globalAlpha; g.globalAlpha = a * k; fn(); g.globalAlpha = a; };

  // ── forme per famiglia d'armi (v33: tutte ridisegnate, i pompa rifatti da zero) ──
  function shape(style, gp, s) {
    switch (style) {
      case 'dot': {    // pistole: punto netto, tre tacche corte e un arco sottile in alto che si apre con la dispersione
        ticks(gp, 5 * s, 2 * s, [0, 1, 1, 1]);
        faint(0.7, () => arc(gp + 2 * s, -Math.PI * 0.78, -Math.PI * 0.22, 1.5 * s));
        dot(1.8 * s); break;
      }
      case 'tri': {    // mitragliette: tre tacche a 120° (giù, su-sinistra, su-destra) e punto
        for (const a of [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 - TAU / 3]) radial(a, gp, gp + 7 * s, 2 * s);
        dot(1.5 * s); break;
      }
      case 'chev': {   // raffica: tre chevron sotto (uno per colpo della raffica) e tacche laterali
        for (let i = 0; i < 3; i++) {
          const y = gp + 2 * s + i * 4 * s, w = (7 - i * 1.4) * s;
          faint(1 - i * 0.22, () => strokePath(() => { g.beginPath(); g.moveTo(C - w, C + y + 4 * s); g.lineTo(C, C + y); g.lineTo(C + w, C + y + 4 * s); }, 1.8 * s));
        }
        ticks(gp, 7 * s, 2 * s, [0, 0, 1, 1]); dot(1.4 * s); break;
      }
      // ━━━━━━━━━━━━━━ POMPA (v35, dal riferimento) ━━━━━━━━━━━━━━
      // cerchio spezzato in quattro archi (vuoti in alto, in basso e ai lati) che si apre sul cono dei pallini
      case 'pump': {   // fucile a pompa: i quattro archi puliti; mentre si pompa si allontanano e si accorciano
        const rd = st.ready >= 0 && st.ready < 1 ? st.ready : 1;
        const r = shotR(gp, s) + (1 - rd) * 7 * s;
        shotArcs(r, 0.95 - (1 - rd) * 0.35, 2.4 * s);
        dot(1.5 * s); break;
      }
      case 'tactical': {// tattico: stessi archi, più corti, con i pallini nel cono
        const r = shotR(gp, s);
        shotArcs(r, 0.78, 2.4 * s);
        faint(0.7, () => { for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; pip(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 0.95 * s); } });
        dot(1.4 * s); break;
      }
      case 'drum': {   // a tamburo: gli archi ruotano di un ottavo di giro a ogni colpo
        st.drumRot = lerp(st.drumRot || 0, (st.shots || 0) * Math.PI / 4, 0.25);
        const r = shotR(gp, s);
        shotArcs(r, 0.9, 2.4 * s, Math.PI / 4 + st.drumRot);
        dot(1.5 * s); break;
      }
      case 'double': { // doppietta: archi + le due canne al centro (piene se cariche)
        const r = shotR(gp, s) + 1 * s, loaded = st.mag >= 0 ? Math.round(st.mag * 2) : 2;
        shotArcs(r, 1.0, 2.4 * s);
        ringAt(-3.6 * s, 0, 2.4 * s, 1.4 * s, loaded >= 1);
        ringAt(3.6 * s, 0, 2.4 * s, 1.4 * s, loaded >= 2);
        break;
      }
      // ━━━━━━━━━━━━━━ FUCILI D'ASSALTO (v35, dal riferimento) ━━━━━━━━━━━━━━
      case 'ar': {     // assalto: anello sottile, quattro tacche che lo attraversano e punto al centro
        const r = arR(gp, s);
        arc(r, 0, TAU, 1.7 * s);
        for (let i = 0; i < 4; i++) radial(i * Math.PI / 2, r - 4 * s, r + 4 * s, 2 * s);
        dot(1.6 * s); break;
      }
      case 'heavy': {  // assalto pesante: anello spesso, croce che esce dall'anello e punto grosso
        const r = arR(gp, s);
        arc(r, 0, TAU, 3 * s);
        for (let i = 0; i < 4; i++) radial(i * Math.PI / 2, 4.5 * s, r + 6 * s, 2.6 * s);
        dot(2.8 * s); break;
      }
      case 'burst': {  // a raffica: anello sottile, croce fine all'interno e quattro paletti sull'anello
        const r = arR(gp, s);
        arc(r, 0, TAU, 1.6 * s);
        for (let i = 0; i < 4; i++) radial(i * Math.PI / 2, 2.5 * s, r - 1 * s, 1.1 * s);
        for (let i = 0; i < 4; i++) radial(i * Math.PI / 2, r - 5 * s, r + 0.5 * s, 3 * s);
        break;
      }
      case 'lmg': {    // mitragliatrice leggera: anello spesso e piccola croce piena al centro
        const r = arR(gp, s) + 1 * s;
        arc(r, 0, TAU, 3.2 * s);
        line(-3.6 * s, 0, 3.6 * s, 0, 2.6 * s); line(0, -3.6 * s, 0, 3.6 * s, 2.6 * s);
        break;
      }
      case 'cross': shape('ar', gp, s); break;
      case 'chev': shape('burst', gp, s); break;
      // vecchi nomi (salvataggi e mod): portati sulle forme nuove
      case 'circle': shape('pump', gp, s); break;
      case 'circle2': shape('drum', gp, s); break;
      case 'snipe': {  // cecchino senza ottica: linee lunghe e sottili con mil-dot, punto piccolo
        ticks(gp, 13 * s, 1.4 * s);
        for (const d of [gp + 17 * s, gp + 22 * s]) { pip(0, d, 0.9 * s); pip(-d, 0, 0.9 * s); pip(d, 0, 0.9 * s); }
        dot(1.2 * s); break;
      }
      case 'hunt': {   // fucile da caccia / balestra: croce sottile e cerchio spezzato in quattro tra le tacche
        ticks(gp, 10 * s, 1.3 * s);
        const r = gp + 14 * s;
        faint(0.65, () => { for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; arc(r, a - 0.5, a + 0.5, 1.2 * s); } });
        dot(1.1 * s); break;
      }
      case 'square':   // DMR: angoli che si chiudono sul bersaglio e piccolo chevron sotto il punto
        brackets(gp + 4 * s, 5 * s, 1.8 * s);
        strokePath(() => { g.beginPath(); g.moveTo(C - 3 * s, C + 6 * s); g.lineTo(C, C + 3.5 * s); g.lineTo(C + 3 * s, C + 6 * s); }, 1.4 * s);
        dot(1.4 * s); break;
      case 'square4': {// minigun: angoli + anello che si riempie mentre le canne prendono giri
        brackets(gp + 6 * s, 6 * s, 2 * s);
        ring(gp + 15 * s, st.spin || 0, st.spin >= 1 ? '#ffb43a' : col, 2 * s);
        ticks(gp - 1 * s, 3 * s, 1.6 * s);
        dot(1.6 * s); break;
      }
      case 'rocket': { // razzi / granate: cerchio di mira con quattro tacche e scala di caduta con le distanze
        arc(11 * s, 0, TAU, 1.8 * s); dot(1.6 * s);
        for (let i = 0; i < 4; i++) radial(i * Math.PI / 2, 11 * s, 15 * s, 1.6 * s);
        line(0, 15 * s, 0, 42 * s, 1.4 * s);
        g.font = `700 ${Math.round(7 * s)}px system-ui, sans-serif`; g.textBaseline = 'middle';
        [[20, 8, '25'], [28, 6, '50'], [36, 4, '75']].forEach(([y, w, t]) => {
          line(-w * s, y * s, w * s, y * s, 1.6 * s);
          g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(t, C + (w + 3) * s + 0.8, C + y * s + 0.8);
          g.fillStyle = col; g.fillText(t, C + (w + 3) * s, C + y * s);
        });
        break;
      }
      case 'melee': {  // piccone: anello piccolo; a portata gli angoli si chiudono
        const k = st.reachK || 0;
        arc(lerp(7, 5, k) * s, 0, TAU, 1.6 * s);
        if (k > 0.02) { g.globalAlpha *= k; brackets(lerp(16, 10, k) * s, 4 * s, 2 * s); g.globalAlpha /= Math.max(0.001, k); }
        dot(1.3 * s); break;
      }
      case 'cons':     // cure e scudi in mano: solo un punto discreto
        g.globalAlpha *= 0.55; dot(1.6 * s); g.globalAlpha /= 0.55; break;
      default:         // qualsiasi altro nome: mirino d'assalto
        if (style !== 'ar') shape('ar', gp, s);
    }
  }

  return {
    /** colpo sparato: le linee saltano in fuori (k ≈ forza del rinculo) */
    fire(k = 1) { st.kickV += 90 * k; st.shots = (st.shots || 0) + 1; },
    /** colpo a segno: kind = body | head | shield */
    hit(kind = 'body') { st.hits.push({ t: 0, kind }); if (st.hits.length > 6) st.hits.shift(); },
    kill() { st.killT = 0.001; },
    /**
     * s: { show, style, spreadPx, color, size, enemy, outRange, sprint, reload (0..1 | −1), ready (0..1 | −1),
     *      mag (frazione | −1), use (0..1 | −1), useShield, spin, reach, ally }
     */
    update(dt, s) {
      resize();
      el.style.display = s.show ? 'block' : 'none';
      if (!s.show) { st.hits.length = 0; st.killT = 0; return; }
      // molla del "salto" ai colpi, apertura che segue la dispersione
      st.kickV += (-st.kick * 260 - st.kickV * 24) * dt;
      st.kick = Math.max(0, st.kick + st.kickV * dt);
      st.gap = lerp(st.gap, s.spreadPx, Math.min(1, dt * 18));
      st.enemyK = lerp(st.enemyK, s.enemy ? 1 : 0, Math.min(1, dt * 16));
      st.reachK = lerp(st.reachK || 0, s.reach ? 1 : 0, Math.min(1, dt * 14));
      st.allyK = lerp(st.allyK || 0, s.ally && !s.enemy ? 1 : 0, Math.min(1, dt * 16));   // v41: compagno sotto il mirino
      st.spin = s.spin || 0;
      st.mag = s.mag ?? -1; st.ready = s.ready ?? -1;
      const wantA = s.sprint ? 0.32 : s.outRange ? 0.55 : 1;
      st.alpha = lerp(st.alpha, wantA, Math.min(1, dt * 10));
      if (s.style !== st.style) { st.prevStyle = st.style; st.style = s.style; st.styleT = 0; }
      st.styleT = Math.min(1, st.styleT + dt * 6);

      const k = s.size || 1;
      glowPx = 3.5 * k;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, S);
      col = mixHex(mixHex(s.color || '#ffffff', COL.ally, st.allyK), COL.enemy, st.enemyK);
      // cambio d'arma: la nuova forma si apre dal centro
      const pop = 0.6 + 0.4 * (1 - Math.pow(1 - st.styleT, 3));
      const gp = (Math.min(64, st.gap) + st.kick) * (s.sprint ? 0.6 : 1) * pop + 3;
      g.globalAlpha = st.alpha * (0.35 + 0.65 * st.styleT);
      shape(st.style, gp, k);

      // ── anelli d'informazione ──
      g.globalAlpha = 1;
      const R = Math.max(gp + 14 * k, 20 * k);
      if (s.reload >= 0) ring(R, s.reload, '#ffd23a', 2.6 * k);
      else if (s.use >= 0) ring(R, s.use, s.useShield ? COL.shieldUse : COL.heal, 2.8 * k);
      else {
        if (s.ready >= 0 && s.ready < 1 && st.style !== 'pump') ring(R - 2 * k, s.ready, '#ffffff', 2 * k, Math.PI * 0.75, Math.PI * 0.5);    // colpo pronto (arco in basso)
        if (s.mag >= 0 && s.mag < 0.34) {                                                                              // caricatore quasi vuoto (arco a destra)
          g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / (s.mag <= 0 ? 120 : 260)));
          ring(R + 2 * k, s.mag, s.mag <= 0.12 ? '#ff5050' : '#ffb43a', 2.2 * k, -Math.PI * 0.22, Math.PI * 0.44);
          g.globalAlpha = 1;
        }
      }

      // ── indicatori di colpo ──
      for (let i = st.hits.length - 1; i >= 0; i--) {
        const h = st.hits[i]; h.t += dt;
        const T = h.kind === 'head' ? 0.32 : 0.24;
        if (h.t > T) { st.hits.splice(i, 1); continue; }
        const u = h.t / T, a = 1 - u * u;
        const r0 = (h.kind === 'head' ? 7 : 6) * k + u * 4 * k, r1 = r0 + (h.kind === 'head' ? 9 : 7) * k;
        g.globalAlpha = a;
        const c = COL[h.kind] || '#fff';
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) line(sx * r0 * 0.707, sy * r0 * 0.707, sx * r1 * 0.707, sy * r1 * 0.707, (h.kind === 'head' ? 2.8 : 2.2) * k, c);
      }
      if (st.killT > 0) {
        st.killT += dt;
        const u = st.killT / 0.55;
        if (u >= 1) st.killT = 0;
        else {
          g.globalAlpha = 1 - u;
          const r0 = 8 * k, r1 = r0 + 13 * k * (0.7 + 0.3 * Math.min(1, u * 4));
          for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) line(sx * r0 * 0.707, sy * r0 * 0.707, sx * r1 * 0.707, sy * r1 * 0.707, 3.2 * k, COL.kill);
          arc((10 + u * 26) * k, 0, TAU, 2 * k * (1 - u) + 0.5, COL.kill);
        }
      }
      g.globalAlpha = 1;
    },
  };
}
