// ─────────────────────────────────────────────────────────────
//  Comandi touch per telefoni e tablet: joystick analogico, trascina per
//  guardare, pulsanti grandi per sparare, mirare, saltare, costruire…
//  I pulsanti scrivono negli stessi `keys`/`pressed`/`mouse` della tastiera,
//  così il resto del gioco non cambia.
// ─────────────────────────────────────────────────────────────

/** dispositivo con schermo touch come puntatore principale */
export const IS_TOUCH_DEVICE = (() => {
  try {
    return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);
  } catch { return false; }
})();

const ICON = {
  fire: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="2"/></svg>',
  aim: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="currentColor" stroke-width="1.8"/></svg>',
  jump: '<svg viewBox="0 0 24 24"><path d="M12 4l7 8h-4.5v7h-5v-7H5z" fill="currentColor"/></svg>',
  crouch: '<svg viewBox="0 0 24 24"><path d="M12 20l-7-8h4.5V5h5v7H19z" fill="currentColor"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M20 3v6h-6z" fill="currentColor"/></svg>',
  build: '<svg viewBox="0 0 24 24"><path d="M3 20h18v-3H3zM4 15h7v-4H4zm9 0h7v-4h-7zM7.5 9h9V5h-9z" fill="currentColor"/></svg>',
  use: '<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 1 3 3v5.2l3.6.9a2 2 0 0 1 1.5 2.3l-1 5.6H8.6l-3.3-5.4 1.3-1.2 2.7 1.6V6a3 3 0 0 1 3-3z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4l6 2 5-2v16l-5 2-6-2-5 2V6zm0 2.2v11.6l6 2V8.2z" fill="currentColor"/></svg>',
  emote: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.3" fill="currentColor"/><circle cx="15" cy="10" r="1.3" fill="currentColor"/><path d="M8 14.2c2.2 2.6 5.8 2.6 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  inv: '<svg viewBox="0 0 24 24"><path d="M9 4h6a2 2 0 0 1 2 2v1h1.5A2.5 2.5 0 0 1 21 9.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5A2.5 2.5 0 0 1 5.5 7H7V6a2 2 0 0 1 2-2zm0 2v1h6V6zm-2 6v2h10v-2z" fill="currentColor"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 15l-5-5h3V4h4v6h3zM5 18h14v2H5z" fill="currentColor"/></svg>',
  // v41: granata, segnalazione, cambio pezzo da costruire, cambio oggetto da lancio
  throw: '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="6.5" fill="currentColor"/><path d="M9.5 6.5h4l1 2h-6z" fill="currentColor"/><path d="M14 5.5c2-2.5 5-2 6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  ping: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="currentColor"/></svg>',
  piece: '<svg viewBox="0 0 24 24"><path d="M3 20h18L3 6z" fill="currentColor"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/**
 * @param {object} api  { G, keys, pressed, mouse, settings, look(dx, dy), togglePause(), requestFs(), onSlot(i) }
 */
export function createTouch(api) {
  const { G, keys, pressed, mouse } = api;
  const T = { on: false, mx: 0, my: 0, sprint: false };

  const root = document.createElement('div');
  root.id = 'touchui';
  root.className = 'hidden';
  root.innerHTML = `
    <div class="tjoy" id="tJoy"><div class="tjbase"><div class="tjknob"></div></div></div>
    <button class="tbtn tfire" data-b="fire" aria-label="Spara">${ICON.fire}</button>
    <button class="tbtn tfireL" data-b="fire" aria-label="Spara">${ICON.fire}</button>
    <button class="tbtn taim" data-b="aim" aria-label="Mira">${ICON.aim}<span>MIRA</span></button>
    <button class="tbtn tjump" data-b="jump" aria-label="Salta">${ICON.jump}<span id="tJumpLbl">SALTA</span></button>
    <button class="tbtn tcrouch" data-b="crouch" aria-label="Abbassati">${ICON.crouch}</button>
    <button class="tbtn treload" data-b="reload" aria-label="Ricarica">${ICON.reload}</button>
    <button class="tbtn tbuild" data-b="build" aria-label="Costruisci">${ICON.build}</button>
    <button class="tbtn tthrow hidden" data-b="throw" aria-label="Lancia">${ICON.throw}<span id="tThrowLbl">LANCIA</span></button>
    <button class="tbtn tpiece hidden" data-b="piece" aria-label="Cambia pezzo">${ICON.piece}<span id="tPieceLbl">MURO</span></button>
    <button class="tbtn tuse hidden" data-b="use" aria-label="Raccogli">${ICON.use}<span id="tUseLbl">RACCOGLI</span></button>
    <button class="tbtn tbusjump hidden" data-b="jump" aria-label="Lanciati">${ICON.jump}<span>LANCIATI</span></button>
    <div class="ttop">
      <button class="tbtn tsmall" data-b="pause" aria-label="Pausa">${ICON.pause}</button>
      <button class="tbtn tsmall" data-b="map" aria-label="Mappa">${ICON.map}</button>
      <button class="tbtn tsmall" data-b="emote" aria-label="Balletto">${ICON.emote}</button>
      <button class="tbtn tsmall" data-b="drop" aria-label="Lascia oggetto">${ICON.drop}</button>
      <button class="tbtn tsmall" data-b="ping" aria-label="Segnala">${ICON.ping}</button>
      <button class="tbtn tsmall" data-b="swap" aria-label="Cambia oggetto da lancio">${ICON.swap}</button>
      <button class="tbtn tsmall" data-b="inv" aria-label="Inventario">${ICON.inv}</button>
    </div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const joy = $('#tJoy'), base = joy.querySelector('.tjbase'), knob = joy.querySelector('.tjknob');
  const btn = {};
  root.querySelectorAll('.tbtn').forEach(b => { (btn[b.dataset.b] ||= []).push(b); });

  // ── tasti virtuali ──
  const press = code => { if (!keys[code]) pressed.add(code); keys[code] = true; };
  const release = code => { keys[code] = false; };
  const DOWN = {
    fire: () => { mouse.left = true; mouse.leftPressed = true; },
    aim: () => { mouse.right = !mouse.right; },
    jump: () => press('Space'),
    crouch: () => press('KeyC'),
    reload: () => press('KeyR'),
    build: () => press('KeyQ'),
    use: () => press('KeyE'),
    emote: () => press('KeyB'),
    map: () => press('KeyM'),
    drop: () => press('KeyX'),
    throw: () => press('KeyG'), ping: () => press('KeyZ'), piece: () => press('KeyR'), swap: () => press('KeyH'),
    pause: () => api.togglePause(),
    inv: () => api.toggleInv && api.toggleInv(),
  };
  const UP = {
    fire: () => { mouse.left = false; },
    jump: () => release('Space'), crouch: () => release('KeyC'), reload: () => release('KeyR'), build: () => release('KeyQ'),
    use: () => release('KeyE'), emote: () => release('KeyB'), map: () => release('KeyM'), drop: () => release('KeyX'),
    throw: () => release('KeyG'), ping: () => release('KeyZ'), piece: () => release('KeyR'), swap: () => release('KeyH'),
  };

  // ── puntatori attivi: joystick, sguardo, pulsanti ──
  const ptr = new Map();       // pointerId → { kind, b, x, y, ox, oy }
  const JR = 58;               // raggio del joystick (px)
  function setKnob(dx, dy) { knob.style.transform = `translate(${dx}px, ${dy}px)`; }
  function joyRest() {
    base.style.left = ''; base.style.top = ''; joy.classList.remove('active');
    setKnob(0, 0); T.mx = T.my = 0; T.sprint = false;
  }
  root.addEventListener('pointerdown', e => {
    if (ED.on) { edDown(e); return; }
    if (!T.on) return;
    e.preventDefault();
    const b = e.target.closest('.tbtn');
    if (b) {
      const name = b.dataset.b;
      b.classList.add('down');
      ptr.set(e.pointerId, { kind: 'btn', b: name, el: b, x: e.clientX, y: e.clientY });
      try { root.setPointerCapture(e.pointerId); } catch { /* ok */ }
      DOWN[name] && DOWN[name]();
      if (name === 'fire' && api.settings?.haptics !== false && navigator.vibrate) try { navigator.vibrate(8); } catch { /* ok */ }
      return;
    }
    try { root.setPointerCapture(e.pointerId); } catch { /* ok */ }
    // metà sinistra: joystick (appare dove appoggi il pollice); il resto: guardarsi intorno
    const hasJoy = [...ptr.values()].some(p => p.kind === 'joy');
    if (e.clientX < innerWidth * 0.42 && !hasJoy) {
      const r = joy.getBoundingClientRect();
      const ox = Math.max(r.left + JR, Math.min(e.clientX, r.right - JR)), oy = Math.max(r.top + JR, Math.min(e.clientY, r.bottom - JR));
      base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px';
      joy.classList.add('active');
      ptr.set(e.pointerId, { kind: 'joy', ox, oy });
      moveJoy(e.clientX, e.clientY, ox, oy);
    } else ptr.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
  }, { passive: false });
  function moveJoy(x, y, ox, oy) {
    let dx = x - ox, dy = y - oy;
    const l = Math.hypot(dx, dy);
    const over = l / JR;
    if (l > JR) { dx *= JR / l; dy *= JR / l; }
    setKnob(dx, dy);
    const k = Math.min(1, l / JR);
    const dead = 0.12;
    const m = k < dead ? 0 : (k - dead) / (1 - dead);
    T.mx = l ? dx / Math.min(l, JR) * m : 0;
    T.my = l ? -dy / Math.min(l, JR) * m : 0;
    // spingendo il joystick fino in fondo verso l'alto si corre
    T.sprint = over > 1.25 && T.my > 0.75;
    joy.classList.toggle('sprint', T.sprint);
  }
  root.addEventListener('pointermove', e => {
    if (ED.on) { edMove(e); return; }
    const p = ptr.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (p.kind === 'joy') moveJoy(e.clientX, e.clientY, p.ox, p.oy);
    else if (p.kind === 'look' || (p.kind === 'btn' && (p.b === 'fire' || p.b === 'aim'))) {
      // anche il pulsante di fuoco si può trascinare per mirare mentre spari
      api.look(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    }
  }, { passive: false });
  function end(e) {
    if (ED.on) { edUp(e); return; }
    const p = ptr.get(e.pointerId);
    if (!p) return;
    ptr.delete(e.pointerId);
    if (p.kind === 'joy') joyRest();
    else if (p.kind === 'btn') {
      p.el.classList.remove('down');
      if (!(p.b === 'fire' && [...ptr.values()].some(q => q.b === 'fire'))) UP[p.b] && UP[p.b]();
    }
  }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('contextmenu', e => e.preventDefault());

  function releaseAll() {
    for (const p of ptr.values()) if (p.kind === 'btn') { p.el.classList.remove('down'); UP[p.b] && UP[p.b](); }
    ptr.clear(); joyRest();
    mouse.left = false;
  }

  // slot della barra: si toccano per sceglierli
  const hotbar = document.getElementById('hotbar');
  hotbar.addEventListener('pointerdown', e => {
    if (!T.on) return;
    const s = e.target.closest('.slot');
    if (!s) return;
    e.preventDefault();
    const i = [...hotbar.children].indexOf(s);
    if (i >= 0) api.onSlot(i);
  });
  // la minimappa apre la mappa grande
  // v33: la mappa grande si chiude col pulsante ✕ (pizzico = zoom, trascinare = spostarsi)
  document.getElementById('minimapWrap').addEventListener('pointerdown', e => { if (T.on) { e.preventDefault(); press('KeyM'); setTimeout(() => release('KeyM'), 50); } });

  function enable(on) {
    T.on = !!on;
    document.body.classList.toggle('touch', T.on);
    if (!T.on) { releaseAll(); root.classList.add('hidden'); }
  }

  const vis = (name, show) => { for (const b of btn[name] || []) b.classList.toggle('hidden', !show); };
  /** chiamato a ogni fotogramma: mostra solo i pulsanti che servono in quel momento */
  function update() {
    if (ED.on) return;
    if (!T.on) return;
    const playing = (G.state === 'play' || G.state === 'bus') && !G.paused && G.player;
    root.classList.toggle('hidden', !playing);
    if (!playing) { if (ptr.size) releaseAll(); return; }
    const p = G.player;
    const alive = p.alive;
    const bus = p.mode === 'bus', air = p.mode === 'fall' || p.mode === 'glide';
    const ground = alive && !bus && !air;
    vis('fire', ground && p.mode !== 'climb');
    vis('aim', ground && !!p.weapon && !G.build.on);
    vis('reload', ground && !!p.weapon && !G.build.on);
    vis('crouch', ground && p.mode !== 'climb');
    vis('build', ground && p.mode !== 'climb');
    vis('jump', alive && !bus && p.mode !== 'glide');
    vis('drop', ground && !!p.slot);
    const thr = p.throws ? Object.values(p.throws).reduce((a, b) => a + (b || 0), 0) : 0;
    vis('throw', ground && thr > 0 && !G.build.on && p.mode !== 'climb');
    vis('swap', ground && thr > 0 && (p.throws[p.throwSel] || 0) < thr);
    vis('piece', ground && G.build.on);
    vis('ping', alive && !bus);
    if (thr > 0) { const l = $('#tThrowLbl'), tx = (({ frag: 'GRANATA', smoke: 'FUMO', impulse: 'IMPULSO', pad: 'TRAMPOLINO', trap: 'TRAPPOLA' })[p.throwSel] || 'LANCIA') + ' ' + (p.throws[p.throwSel] || 0); if (l.textContent !== tx) l.textContent = tx; }
    if (G.build.on) { const l = $('#tPieceLbl'), tx = ({ wall: 'MURO', floor: 'PAVIMENTO', ramp: 'RAMPA' })[G.build.piece] || 'MURO'; if (l.textContent !== tx) l.textContent = tx; }
    vis('emote', ground);
    root.querySelector('.tbusjump').classList.toggle('hidden', !(alive && bus));
    const inter = ground && G.interact;
    root.querySelector('.tuse').classList.toggle('hidden', !inter);
    if (inter) $('#tUseLbl').textContent = inter.chest ? 'APRI' : inter.stove ? (inter.stove.lit ? 'SPEGNI' : 'ACCENDI') : inter.door ? (inter.door.open ? 'CHIUDI' : 'APRI') : 'RACCOGLI';
    $('#tJumpLbl').textContent = p.mode === 'fall' ? 'APRI' : p.mode === 'climb' ? 'STACCATI' : 'SALTA';
    for (const b of btn.aim || []) b.classList.toggle('on', !!mouse.right);
    for (const b of btn.build || []) b.classList.toggle('on', !!G.build.on);
    for (const b of btn.crouch || []) b.classList.toggle('on', !!p.crouch);
    if (!p.weapon && mouse.right) mouse.right = false;
  }

  // ═════════ v40: pulsanti su misura (posizione e dimensione), trasparenza, vibrazione ═════════
  const S = api.settings || {};
  const keyOf = el => el.classList.contains('ttop') ? 'ttop' : [...el.classList].find(c => c !== 'tbtn' && c !== 'hidden' && c !== 'on' && c !== 'down' && c !== 'tsmall' && c !== 'sel' && /^t[A-Za-z]+$/.test(c));
  const movable = () => [...root.querySelectorAll('.tbtn:not(.tsmall), .ttop')];
  /** applica posizioni e dimensioni salvate (centro in frazione dello schermo, s = scala) */
  function applyLayout() {
    const L = S.touchLayout || {};
    root.style.setProperty('--talpha', String(S.touchAlpha ?? 1));
    for (const el of movable()) {
      const k = keyOf(el), c = L[k];
      el.style.removeProperty('--k');
      el.style.left = el.style.top = el.style.right = el.style.bottom = '';
      if (!c) continue;
      if (c.s && c.s !== 1) el.style.setProperty('--k', `calc(var(--tk, 1) * ${c.s})`);
      const w = el.offsetWidth || 60, h = el.offsetHeight || 60;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.left = Math.round(c.x * innerWidth - w / 2) + 'px';
      el.style.top = Math.round(c.y * innerHeight - h / 2) + 'px';
    }
  }
  addEventListener('resize', () => setTimeout(applyLayout, 60));
  const ED = { on: false, sel: null, drag: null, done: null, bar: null };
  function edSelect(el) {
    for (const b of movable()) b.classList.toggle('sel', b === el);
    ED.sel = el;
    const lbl = ED.bar.querySelector('.tedname');
    lbl.textContent = el ? (el.getAttribute('aria-label') || (keyOf(el) === 'ttop' ? 'Pulsanti in alto' : 'Pulsante')) : 'Tocca un pulsante';
  }
  function edSave(el) {
    const r = el.getBoundingClientRect(), k = keyOf(el);
    S.touchLayout = S.touchLayout || {};
    const prev = S.touchLayout[k] || {};
    S.touchLayout[k] = { x: +((r.left + r.width / 2) / innerWidth).toFixed(4), y: +((r.top + r.height / 2) / innerHeight).toFixed(4), s: prev.s || 1 };
  }
  function edDown(e) {
    e.preventDefault();
    if (e.target.closest('.tedbar')) return;
    let el = e.target.closest('.tbtn, .ttop');
    if (el && el.classList.contains('tsmall')) el = el.closest('.ttop');
    if (!el) { edSelect(null); return; }
    edSelect(el);
    const r = el.getBoundingClientRect();
    ED.drag = { id: e.pointerId, el, dx: e.clientX - r.left, dy: e.clientY - r.top };
    try { root.setPointerCapture(e.pointerId); } catch { /* ok */ }
  }
  function edMove(e) {
    const d = ED.drag; if (!d || d.id !== e.pointerId) return;
    e.preventDefault();
    const el = d.el, w = el.offsetWidth, h = el.offsetHeight;
    el.style.right = 'auto'; el.style.bottom = 'auto';
    el.style.left = Math.round(Math.max(0, Math.min(innerWidth - w, e.clientX - d.dx))) + 'px';
    el.style.top = Math.round(Math.max(0, Math.min(innerHeight - h, e.clientY - d.dy))) + 'px';
  }
  function edUp(e) {
    const d = ED.drag; if (!d || d.id !== e.pointerId) return;
    ED.drag = null; edSave(d.el);
  }
  function edScale(f) {
    const el = ED.sel; if (!el) return;
    edSave(el);
    const k = keyOf(el), c = S.touchLayout[k];
    c.s = Math.max(0.6, Math.min(1.8, +((c.s || 1) * f).toFixed(3)));
    applyLayout(); edSave(el);
  }
  /** apre l'editor dei pulsanti; done() quando si preme «Fatto» */
  function editLayout(done) {
    if (ED.on) return;
    ED.on = true; ED.done = done || null;
    releaseAll();
    if (!ED.bar) {
      ED.bar = document.createElement('div');
      ED.bar.className = 'tedbar';
      ED.bar.innerHTML = `<div class="tedtxt"><b>Disponi i pulsanti</b><span>Trascinali dove vuoi · tocca un pulsante per ingrandirlo o rimpicciolirlo</span></div>
        <div class="tedctl"><span class="tedname">Tocca un pulsante</span><button data-a="minus" aria-label="Più piccolo">−</button><button data-a="plus" aria-label="Più grande">+</button>
        <button data-a="reset" class="ghost">Ripristina</button><button data-a="done" class="ok">Fatto</button></div>`;
      ED.bar.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        const a = ev.target.closest('button')?.dataset.a; if (!a) return;
        ev.preventDefault();
        if (a === 'minus') edScale(1 / 1.12);
        else if (a === 'plus') edScale(1.12);
        else if (a === 'reset') { S.touchLayout = {}; applyLayout(); edSelect(null); }
        else if (a === 'done') closeEditor();
      });
      root.appendChild(ED.bar);
    }
    root.classList.remove('hidden'); root.classList.add('editing');
    document.body.classList.add('touch-edit');
    applyLayout(); edSelect(null);
  }
  function closeEditor() {
    ED.on = false; ED.drag = null;
    for (const b of movable()) b.classList.remove('sel');
    root.classList.remove('editing'); document.body.classList.remove('touch-edit');
    if (!T.on || !(G.state === 'play' || G.state === 'bus')) root.classList.add('hidden');
    api.saveSettings && api.saveSettings();
    const cb = ED.done; ED.done = null; if (cb) cb();
  }
  /** vibrazione breve (se il telefono la supporta e l'opzione è attiva) */
  function buzz(ms) { if (!T.on || S.haptics === false || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch { /* ok */ } }
  applyLayout();

  return { T, enable, update, releaseAll, root, applyLayout, editLayout, buzz, get editing() { return ED.on; } };
}
