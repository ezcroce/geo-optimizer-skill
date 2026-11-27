// ─────────────────────────────────────────────────────────────
//  Inventario (TAB): armi e oggetti nei 5 slot, munizioni, materiali,
//  statistiche dell'arma. Si riordina trascinando (mouse o dito) o con
//  i tasti 1-5; si può equipaggiare e gettare a terra.
// ─────────────────────────────────────────────────────────────
import { WEAPONS, RARITIES, AMMO_TYPES, CONSUMABLES } from './config.js?v=44';

const STAT_MAX = (() => {
  const m = { dmg: 0, dps: 0, range: 0, mag: 0 };
  for (const d of Object.values(WEAPONS)) {
    const dmg = d.dmg * (d.pellets || 1) * 1.38;
    m.dmg = Math.max(m.dmg, dmg); m.dps = Math.max(m.dps, dmg / d.rate);
    m.range = Math.max(m.range, d.range); m.mag = Math.max(m.mag, d.mag);
  }
  return m;
})();
const ROLE = { pistol: 'Pistola', smg: 'Mitraglietta', ar: 'Fucile', shotgun: 'Fucile a canna liscia', sniper: 'Precisione', rocket: 'Esplosivo', melee: 'Corpo a corpo', lmg: 'Mitragliatrice', minigun: 'Mitragliatrice' };

/**
 * @param {object} api { G, weaponIconHTML, consIconHTML, swap(i,j), drop(i), dropAmmo(id, n), equip(i), onOpen(), onClose(), sound(kind) }
 */
export function createInventory(api) {
  const { G } = api;
  const root = document.getElementById('inventory');
  const $ = s => root.querySelector(s);
  const slotsEl = $('#invSlots'), detailEl = $('#invDetail'), ammoEl = $('#invAmmo'), barsEl = $('#invBars'), dropZone = $('#invDrop');
  let open = false, sel = -1, sig = '', drag = null, noClick = false;

  function isOpen() { return open; }
  function toggle(force) {
    const want = force !== undefined ? force : !open;
    if (want === open) return;
    if (want && (G.state !== 'play' || !G.player || !G.player.alive || G.player.mode === 'bus')) return;
    open = want;
    G.invOpen = open;
    root.classList.toggle('hidden', !open);
    if (open) { sel = G.player.slot ? G.player.active : G.player.slots.findIndex(Boolean); sig = ''; render(); api.onOpen(); api.sound('open'); }
    else { endDrag(); api.onClose(); api.sound('close'); }
  }

  // ── disegno ──
  function signature() {
    const p = G.player;
    return p.slots.map(s => s ? `${s.kind}${s.id}${s.rarity}${s.count}${s.mag}` : '-').join('|') + `#${p.active}#${sel}#` +
      Object.values(p.ammo).join(',') + `#${p.mats}#${Math.round(p.hp)}#${Math.round(p.shield)}#${p.reloading > 0 ? 1 : 0}`;
  }
  function slotHTML(s, i) {
    const p = G.player;
    const on = i === p.active, isSel = i === sel;
    if (!s) return `<div class="islot empty ${on ? 'on' : ''} ${isSel ? 'sel' : ''}" data-i="${i}"><span class="k">${i + 1}</span><div class="ic">${on ? '⛏️' : ''}</div><div class="nm">${on ? 'Piccone' : 'Vuoto'}</div></div>`;
    let ic, nm, sub, col;
    if (s.kind === 'weapon') {
      const d = WEAPONS[s.id], r = RARITIES[s.rarity];
      col = r.color; ic = api.weaponIconHTML(s.id, s.rarity); nm = d.name;
      const res = p.ammo[d.ammo];
      sub = d.melee ? '<span class="mag">∞</span> <span class="am">corpo a corpo</span>'
        : `<span class="mag ${s.mag === 0 ? 'zero' : ''}">${s.mag}/${d.mag}</span> <span class="am" style="color:${AMMO_TYPES[d.ammo].color}">● ${res}</span>`;
    } else {
      const d = CONSUMABLES[s.id];
      col = RARITIES[d.rarity].color; ic = api.consIconHTML(s.id); nm = d.name;
      sub = `<span class="mag">x${s.count}</span><span class="am">/ ${d.stack}</span>`;
    }
    return `<div class="islot ${on ? 'on' : ''} ${isSel ? 'sel' : ''}" data-i="${i}" style="--rc:${col}"><span class="k">${i + 1}</span>${on ? '<span class="eq">IN MANO</span>' : ''}<div class="ic">${ic}</div><div class="nm">${nm}</div><div class="sb">${sub}</div><div class="rb"></div></div>`;
  }
  function bar(label, v, txt, col = '#ffcf2e') {
    return `<div class="stat"><span>${label}</span><div class="sbar"><i style="width:${Math.round(Math.max(0.04, Math.min(1, v)) * 100)}%;background:${col}"></i></div><b>${txt}</b></div>`;
  }
  function detailHTML() {
    const p = G.player, s = p.slots[sel];
    if (sel < 0) return '<div class="none">Seleziona uno slot per vedere i dettagli</div>';
    const btns = (extra = '') => `<div class="acts">
        <button class="ghost" data-a="left" ${sel === 0 ? 'disabled' : ''}>◀</button>
        <button class="ghost" data-a="right" ${sel === 4 ? 'disabled' : ''}>▶</button>
        ${extra}
        ${s ? '<button class="ghost danger" data-a="drop">Getta</button>' : ''}
      </div>`;
    if (!s) return `<div class="dh"><div class="big">⛏️</div><div><h3>Slot ${sel + 1} vuoto</h3><div class="rar" style="color:#aaa">Senza oggetti impugni il piccone</div></div></div>
      <p class="desc">Raccogli un'arma o un oggetto per riempirlo, oppure trascinaci sopra un oggetto da un altro slot.</p>${btns(sel !== p.active ? '<button class="play small" data-a="equip">Impugna</button>' : '')}`;
    const equip = sel !== p.active ? '<button class="play small" data-a="equip">Impugna</button>' : '<span class="inhand">✔ In mano</span>';
    if (s.kind === 'weapon') {
      const d = WEAPONS[s.id], r = RARITIES[s.rarity];
      const dmg = d.dmg * r.mult, tot = dmg * (d.pellets || 1);
      const dps = tot / d.rate, acc = 1 - Math.min(1, d.spread / 0.12);
      const res = p.ammo[d.ammo], at = AMMO_TYPES[d.ammo];
      if (d.melee) return `<div class="dh" style="--rc:${r.color}"><div class="big w">${api.weaponIconHTML(s.id, s.rarity)}</div>
          <div><h3>${d.name}</h3><div class="rar" style="color:${r.color}">${r.name} · ${ROLE[d.role] || ''}</div></div></div>
        <p class="desc">${d.desc || ''}</p>
        <div class="stats2">
          ${bar('Danno', dmg / STAT_MAX.dmg, Math.round(dmg), r.color)}
          ${bar('Danni/s', dps / STAT_MAX.dps, Math.round(dps), r.color)}
          ${bar('Portata', d.range / 10, d.range + ' m')}
          ${bar('Munizioni', 1, '∞', '#7fd0ff')}
        </div>
        <div class="ammoline" style="--ac:#ffcf2e">✦ Combo: artigliata destra → sinistra → giravolta → schianto · mira + attacco = balzo</div>
        ${btns(equip)}`;
      return `<div class="dh" style="--rc:${r.color}"><div class="big w">${api.weaponIconHTML(s.id, s.rarity)}</div>
          <div><h3>${d.name}</h3><div class="rar" style="color:${r.color}">${r.name} · ${ROLE[d.role] || ''}</div></div></div>
        <p class="desc">${d.desc || ''}</p>
        <div class="stats2">
          ${bar('Danno', tot / STAT_MAX.dmg, d.pellets > 1 ? `${Math.round(dmg)}×${d.pellets}` : Math.round(dmg), r.color)}
          ${bar('Danni/s', dps / STAT_MAX.dps, Math.round(dps), r.color)}
          ${bar('Cadenza', Math.min(1, (1 / d.rate) / 14), (1 / d.rate).toFixed(1) + '/s')}
          ${bar('Precisione', acc, Math.round(acc * 100) + '%')}
          ${bar('Portata', d.range / STAT_MAX.range, d.range + ' m')}
          ${bar('Caricatore', d.mag / STAT_MAX.mag, `${s.mag}/${d.mag}`)}
          ${bar('Ricarica', 1 - Math.min(1, d.reload / 4), d.reload.toFixed(1) + ' s', '#7fd0ff')}
        </div>
        <div class="ammoline" style="--ac:${at.color}">● ${at.name}: <b>${res}</b> in riserva${res === 0 ? ' <em>— nessuna munizione!</em>' : ''}${d.zoom > 1.3 ? ` · zoom ${d.zoom}×` : ''}</div>
        ${btns(equip)}`;
    }
    const d = CONSUMABLES[s.id], r = RARITIES[d.rarity];
    const eff = d.hp ? `Cura <b>${d.hp}</b> salute (fino a ${d.maxHp})` : `Dà <b>${d.shield}</b> scudo (fino a ${d.maxShield})`;
    return `<div class="dh" style="--rc:${r.color}"><div class="big">${api.consIconHTML(s.id)}</div>
        <div><h3>${d.name} <small>x${s.count}</small></h3><div class="rar" style="color:${r.color}">${r.name} · Consumabile</div></div></div>
      <p class="desc">${eff}. Tempo d'uso ${d.time} s. Massimo ${d.stack} per slot.</p>
      <p class="desc dim">Impugnalo e tieni premuto il tasto sinistro per usarlo.</p>
      ${btns(equip)}`;
  }
  function ammoHTML() {
    const p = G.player;
    const held = new Set(p.slots.filter(s => s && s.kind === 'weapon').map(s => WEAPONS[s.id].ammo));
    let h = '<h4>MUNIZIONI</h4>';
    for (const [id, t] of Object.entries(AMMO_TYPES)) {
      const n = p.ammo[id], need = held.has(id);
      const users = p.slots.map((s, i) => s && s.kind === 'weapon' && WEAPONS[s.id].ammo === id ? i + 1 : 0).filter(Boolean);
      h += `<div class="arow ${n ? '' : 'zero'} ${need ? 'need' : ''}" style="--ac:${t.color}">
        <span class="pip"></span><span class="an">${t.short}${users.length ? `<small>slot ${users.join(', ')}</small>` : ''}</span>
        <b>${n}</b><button class="ghost tiny" data-ammo="${id}" ${n ? '' : 'disabled'} title="Getta ${Math.min(n, t.pickup)}">⤓</button></div>`;
    }
    h += `<h4>MATERIALI</h4><div class="arow" style="--ac:#c8a070"><span class="pip"></span><span class="an">Legno e pietra</span><b>${p.mats}</b></div>`;
    // riepilogo cure
    const cons = {};
    for (const s of p.slots) if (s && s.kind === 'cons') cons[s.id] = (cons[s.id] || 0) + s.count;
    const ck = Object.keys(cons);
    h += '<h4>CURE</h4>' + (ck.length ? ck.map(id => `<div class="arow" style="--ac:${RARITIES[CONSUMABLES[id].rarity].color}"><span class="pip"></span><span class="an">${CONSUMABLES[id].name}</span><b>${cons[id]}</b></div>`).join('') : '<div class="none">Nessuna cura</div>');
    return h;
  }
  function render() {
    const p = G.player;
    if (!p) return;
    sig = signature();
    slotsEl.innerHTML = p.slots.map(slotHTML).join('');
    detailEl.innerHTML = detailHTML();
    ammoEl.innerHTML = ammoHTML();
    const hp = Math.max(0, Math.round(p.hp)), sh = Math.max(0, Math.round(p.shield));
    barsEl.innerHTML = `<div class="ib hp"><i style="width:${hp}%"></i><span>❤ ${hp}</span></div><div class="ib sh"><i style="width:${sh}%"></i><span>◆ ${sh}</span></div>`;
  }
  /** chiamata ogni fotogramma: aggiorna solo se qualcosa è cambiato */
  function update() {
    if (!open) return;
    const p = G.player;
    if (!p || !p.alive || G.state !== 'play') { toggle(false); return; }
    if (signature() !== sig) render();
  }

  // ── azioni ──
  function doSwap(i, j) {
    if (i === j || i < 0 || j < 0 || j > 4) return;
    api.swap(i, j);
    if (sel === i) sel = j; else if (sel === j) sel = i;
    api.sound('move');
    render();
    const el = slotsEl.querySelector(`[data-i="${j}"]`);
    if (el) el.animate([{ transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }
  function doDrop(i) {
    if (!G.player.slots[i]) return;
    api.drop(i); api.sound('drop'); render();
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) {
      if (b.dataset.ammo) { api.dropAmmo(b.dataset.ammo); api.sound('drop'); render(); return; }
      const a = b.dataset.a;
      if (a === 'left') doSwap(sel, sel - 1);
      else if (a === 'right') doSwap(sel, sel + 1);
      else if (a === 'drop') doDrop(sel);
      else if (a === 'equip') { api.equip(sel); api.sound('move'); render(); }
      else if (a === 'close') toggle(false);
      return;
    }
    if (e.target === root && !noClick) toggle(false);   // clic fuori dal pannello
  });
  slotsEl.addEventListener('dblclick', e => {
    const el = e.target.closest('.islot');
    if (el) { api.equip(+el.dataset.i); render(); }
  });

  // ── trascinamento (mouse e dito) ──
  slotsEl.addEventListener('pointerdown', e => {
    const el = e.target.closest('.islot');
    if (!el || e.button > 0) return;
    drag = { i: +el.dataset.i, x: e.clientX, y: e.clientY, el, ghost: null, id: e.pointerId };
  });
  addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7 || !G.player.slots[drag.i]) return;
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.classList.add('ghostslot');
      root.appendChild(drag.ghost);
      drag.el.classList.add('lifting');
      root.classList.add('dragging');
    }
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    const over = document.elementFromPoint(e.clientX, e.clientY);
    slotsEl.querySelectorAll('.islot').forEach(s => s.classList.toggle('target', s !== drag.el && s.contains(over)));
    dropZone.classList.toggle('over', !!over && dropZone.contains(over));
  });
  addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    if (!d.ghost) {   // semplice clic: seleziona
      sel = d.i; drag = null; api.sound('tick'); render(); return;
    }
    const over = document.elementFromPoint(e.clientX, e.clientY);
    const target = over && over.closest && over.closest('.islot');
    const toDrop = over && dropZone.contains(over);
    endDrag();
    noClick = true; setTimeout(() => { noClick = false; }, 0);
    if (toDrop) doDrop(d.i);
    else if (target && slotsEl.contains(target)) { sel = d.i; doSwap(d.i, +target.dataset.i); }
  });
  addEventListener('pointercancel', () => endDrag());
  function endDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.el) drag.el.classList.remove('lifting');
    slotsEl.querySelectorAll('.target').forEach(s => s.classList.remove('target'));
    dropZone.classList.remove('over');
    root.classList.remove('dragging');
    drag = null;
  }

  /** tasti mentre l'inventario è aperto: 1-5 sposta l'oggetto selezionato, frecce cambiano selezione, G getta (WASD muovono il personaggio) */
  function key(code) {
    if (!open) return false;
    const m = /^Digit([1-5])$/.exec(code);
    if (m) { const j = +m[1] - 1; if (sel >= 0 && sel !== j) doSwap(sel, j); else { sel = j; render(); } return true; }
    if (code === 'ArrowLeft') { sel = Math.max(0, sel - 1); api.sound('tick'); render(); return true; }
    if (code === 'ArrowRight') { sel = Math.min(4, sel + 1); api.sound('tick'); render(); return true; }
    if (code === 'KeyX' || code === 'KeyG' || code === 'Delete') { doDrop(sel); return true; }
    if (code === 'Enter' || code === 'KeyE') { if (sel >= 0) { api.equip(sel); render(); } return true; }
    return true;
  }

  return { toggle, isOpen, update, key, close: () => toggle(false) };
}
