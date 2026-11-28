// ─────────────────────────────────────────────────────────────
//  Pannello impostazioni a schede (Grafica · Controlli · Audio · Interfaccia)
//  Costruito da uno schema: ogni voce legge/scrive settings[key] o settings.gfx[key].
// ─────────────────────────────────────────────────────────────
const pct = v => Math.round(v * 100) + '%';
const CH_COLORS = ['#ffffff', '#ff6bf0', '#7a7aff', '#4de8ff', '#4dff6a', '#ffe14d', '#ff4d5e'];

const SCHEMA = [
  { id: 'gfx', label: 'Grafica', items: [
    { key: 'preset', gfx: true, type: 'seg', label: 'Qualità generale', options: [['basso', 'Bassa'], ['medio', 'Media'], ['alto', 'Alta'], ['ultra', 'Ultra'], ['custom', 'Personalizzata']], hint: 'Imposta tutte le opzioni qui sotto in un colpo solo.' },
    { key: 'scale', gfx: true, type: 'range', label: 'Risoluzione di rendering', min: 0.5, max: 2, step: 0.05, fmt: pct, hint: 'Sotto il 100% più FPS, sopra il 100% immagine più nitida (supersampling).' },
    { key: 'shadows', gfx: true, type: 'select', label: 'Ombre', options: [['off', 'Disattivate'], ['low', 'Basse'], ['high', 'Alte (morbide)'], ['ultra', 'Ultra (4K, morbide)']] },
    { key: 'texq', gfx: true, type: 'select', label: 'Qualità texture', options: [['low', 'Bassa'], ['normal', 'Normale'], ['high', 'Alta (2× + rilievo)']], reload: true, hint: 'Si applica al prossimo caricamento della pagina.' },
    { key: 'aniso', gfx: true, type: 'select', label: 'Filtro anisotropico', options: [[1, 'Off'], [4, '4×'], [8, '8×'], [16, '16×']], num: true, hint: 'Texture nitide anche viste di sbieco (strade, tetti, terreno).' },
    { key: 'aa', gfx: true, type: 'select', label: 'Anti-aliasing', options: [['off', 'Disattivato'], ['fxaa', 'FXAA (leggero)'], ['smaa', 'SMAA (bilanciato)'], ['msaa', 'MSAA 4× (preciso)']] },
    { key: 'bloom', gfx: true, type: 'toggle', label: 'Bagliore (bloom)', hint: 'Alone luminoso su sole, spari, esplosioni e oggetti leggendari.' },
    { key: 'ao', gfx: true, type: 'toggle', label: 'Occlusione ambientale (GTAO)', hint: 'Ombre di contatto negli angoli e sotto gli oggetti. Pesante.' },
    { key: 'view', gfx: true, type: 'range', label: 'Distanza visiva', min: 0.6, max: 1.8, step: 0.05, fmt: pct, hint: 'Distanza della nebbia, del dettaglio di case e alberi.' },
    { key: 'grass', gfx: true, type: 'range', label: 'Densità erba', min: 0, max: 1.5, step: 0.05, fmt: v => v <= 0 ? 'Off' : pct(v), hint: 'L\'erba alta per nascondersi resta sempre visibile.' },
    { key: 'dynRes', gfx: true, type: 'toggle', label: 'Risoluzione dinamica', hint: 'Se il gioco scende sotto i 40 FPS abbassa un po\' la risoluzione (mai sotto il 75%), poi la rialza.' },
    { key: 'autoQ', gfx: true, type: 'toggle', label: 'Qualità automatica (minimo 30 FPS)', hint: 'Se il gioco scende sotto i 30 FPS toglie l\'occlusione ambientale, semplifica anti-aliasing e ombre e dirada un po\' l\'erba. Non spegne mai ombre, bloom e distanza visiva e rimette tutto quando torna fluido.' },
    { key: 'fpsCap', gfx: true, type: 'select', label: 'Limite FPS', options: [[0, 'Illimitati'], [30, '30'], [60, '60'], [120, '120'], [144, '144']], num: true },
  ] },
  { id: 'ctrl', label: 'Controlli', items: [
    { key: 'sens', type: 'range', label: 'Sensibilità mouse', min: 0.3, max: 3, step: 0.05, fmt: v => v.toFixed(2) },
    { key: 'adsSens', type: 'range', label: 'Sensibilità in mira (tasto destro)', min: 0.3, max: 2, step: 0.05, fmt: pct },
    // v41: zoom in mira per classe d'arma (100% = quello dell'arma)
    { key: 'adsK_pistol', type: 'range', label: 'Zoom in mira · pistole', min: 0.5, max: 1.5, step: 0.05, fmt: pct, hint: 'Meno = campo visivo più largo mirando. Ogni classe d\'arma ha il suo.' },
    { key: 'adsK_smg', type: 'range', label: 'Zoom in mira · mitragliette', min: 0.5, max: 1.5, step: 0.05, fmt: pct },
    { key: 'adsK_shotgun', type: 'range', label: 'Zoom in mira · fucili a pompa', min: 0.5, max: 1.5, step: 0.05, fmt: pct },
    { key: 'adsK_ar', type: 'range', label: 'Zoom in mira · fucili d\'assalto', min: 0.5, max: 1.5, step: 0.05, fmt: pct },
    { key: 'adsK_sniper', type: 'range', label: 'Zoom in mira · cecchini e balestra', min: 0.5, max: 1.5, step: 0.05, fmt: pct },
    { key: 'adsK_rocket', type: 'range', label: 'Zoom in mira · lanciarazzi', min: 0.5, max: 1.5, step: 0.05, fmt: pct },
    { key: 'invertY', type: 'toggle', label: 'Inverti asse verticale' },
    { key: 'fov', type: 'range', label: 'Campo visivo (FOV)', min: 60, max: 100, step: 1, fmt: v => v + '°' },
    { key: 'crouchHold', type: 'select', label: 'Abbassarsi (C)', options: [[false, 'Premi per alternare'], [true, 'Tieni premuto']], bool: true },
    { key: 'shake', type: 'toggle', label: 'Scossa della telecamera', hint: 'Rinculo ed esplosioni scuotono la visuale.' },
    { key: 'touch', type: 'select', label: 'Comandi touch', options: [['auto', 'Automatici (su telefono e tablet)'], ['on', 'Sempre attivi'], ['off', 'Disattivati']], hint: 'Joystick, pulsanti e trascinamento per guardarsi intorno.' },
    { key: 'touchSens', type: 'range', label: 'Sensibilità touch', min: 0.3, max: 3, step: 0.05, fmt: v => v.toFixed(2) },
    { key: 'touchSize', type: 'range', label: 'Dimensione pulsanti touch', min: 0.7, max: 1.4, step: 0.05, fmt: pct },
    // v40: più giocabile da telefono
    { key: 'touchLayout', type: 'button', label: 'Disponi i pulsanti touch', btn: '✋ Disponi', action: 'touchLayout', hint: 'Sposta ogni pulsante dove ti viene comodo e cambiane la dimensione.' },
    { key: 'touchAlpha', type: 'range', label: 'Opacità pulsanti touch', min: 0.25, max: 1, step: 0.05, fmt: pct, hint: 'Pulsanti più trasparenti = si vede meglio la partita.' },
    { key: 'autoFire', type: 'select', label: 'Fuoco automatico (touch)', options: [['on', 'Attivo'], ['off', 'Disattivato']], hint: 'Spara da solo quando il mirino è sopra un avversario. Il pulsante di fuoco funziona sempre.' },
    { key: 'aimAssist', type: 'select', label: 'Assistenza alla mira (touch)', options: [['strong', 'Forte'], ['on', 'Normale'], ['off', 'Disattivata']], hint: 'Vicino a un avversario la visuale rallenta e lo segue un po\'.' },
    { key: 'haptics', type: 'toggle', label: 'Vibrazione', hint: 'Breve vibrazione quando spari, colpisci o vieni colpito (sui telefoni che la supportano).' },
  ] },
  { id: 'audio', label: 'Audio', items: [
    { key: 'vol', type: 'range', label: 'Volume generale', min: 0, max: 1, step: 0.05, fmt: pct },
    { key: 'amb', type: 'range', label: 'Suoni d\'ambiente (vento, tempesta)', min: 0, max: 1, step: 0.05, fmt: pct },
  ] },
  { id: 'hud', label: 'Interfaccia', items: [
    { key: 'chColor', type: 'color', label: 'Colore mirino', options: CH_COLORS },
    { key: 'chSize', type: 'range', label: 'Dimensione mirino', min: 0.6, max: 1.8, step: 0.05, fmt: pct },
    { key: 'minimap', type: 'select', label: 'Minimappa', options: [['small', 'Piccola'], ['normal', 'Normale'], ['big', 'Grande']] },
    { key: 'fpsShow', gfx: true, type: 'toggle', label: 'Mostra FPS' },
  ] },
];
const PRESET_KEYS = ['scale', 'shadows', 'texq', 'aniso', 'aa', 'bloom', 'ao', 'view', 'grass'];

/**
 * @param {object} o  { settings, save(), apply(key), presets, defaults(), onReload() }
 */
export function initSettingsUI(o) {
  const root = document.getElementById('settings');
  const tabsEl = root.querySelector('#setTabs'), body = root.querySelector('#setBody'), note = root.querySelector('#setNote');
  let tab = 'gfx', onClose = null;
  const startTexq = o.settings.gfx.texq;

  const get = it => it.gfx ? o.settings.gfx[it.key] : o.settings[it.key];
  function set(it, v) {
    if (it.gfx) o.settings.gfx[it.key] = v; else o.settings[it.key] = v;
    if (it.key === 'preset' && o.presets[v]) Object.assign(o.settings.gfx, o.presets[v]);
    else if (it.gfx && PRESET_KEYS.includes(it.key)) o.settings.gfx.preset = matchPreset();
    o.save();
    o.apply(it.key);
    if (it.key === 'preset' || (it.gfx && PRESET_KEYS.includes(it.key))) render();   // aggiorna i controlli collegati
    updateNote();
  }
  function matchPreset() {
    for (const [name, p] of Object.entries(o.presets)) if (PRESET_KEYS.every(k => p[k] === o.settings.gfx[k])) return name;
    return 'custom';
  }
  function updateNote() {
    if (o.settings.gfx.texq !== startTexq) {
      note.innerHTML = '⟳ La qualità delle texture cambierà al prossimo avvio. <button class="ghost tiny" id="setReload">Ricarica ora</button>';
      note.querySelector('#setReload').onclick = () => o.onReload();
    } else note.textContent = '';
  }

  function control(it) {
    const row = document.createElement('div');
    row.className = 'setrow' + (it.type === 'seg' ? ' segrow' : '');
    const v = get(it);
    let html = `<div class="setlbl"><b>${it.label}</b>${it.hint ? `<small>${it.hint}</small>` : ''}</div><div class="setctl">`;
    if (it.type === 'range') html += `<input type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${v}"><output>${it.fmt(v)}</output>`;
    else if (it.type === 'toggle') html += `<button class="tgl${v ? ' on' : ''}" aria-pressed="${!!v}"><i></i></button>`;
    else if (it.type === 'select') html += `<select>${it.options.map(([val, l]) => `<option value="${val}"${String(val) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    else if (it.type === 'seg') html += it.options.filter(([val]) => val !== 'custom' || v === 'custom').map(([val, l]) => `<button data-v="${val}" class="${val === v ? 'on' : ''}">${l}</button>`).join('');
    else if (it.type === 'button') html += `<button class="setbtn">${it.btn}</button>`;
    else if (it.type === 'color') html += it.options.map(c => `<button class="sw${c === v ? ' on' : ''}" data-v="${c}" style="--c:${c}"></button>`).join('');
    row.innerHTML = html + '</div>';
    const ctl = row.querySelector('.setctl');
    if (it.type === 'range') {
      const inp = ctl.querySelector('input'), out = ctl.querySelector('output');
      inp.oninput = () => { out.textContent = it.fmt(+inp.value); set(it, +inp.value); };
    } else if (it.type === 'toggle') {
      const b = ctl.querySelector('button');
      b.onclick = () => { const nv = !get(it); b.classList.toggle('on', nv); b.setAttribute('aria-pressed', nv); set(it, nv); };
    } else if (it.type === 'button') {
      ctl.querySelector('button').onclick = () => {
        const reopen = onClose; onClose = null;
        root.classList.add('hidden');
        o.action && o.action(it.action, () => open(reopen));
      };
    } else if (it.type === 'select') {
      const s = ctl.querySelector('select');
      s.onchange = () => set(it, it.num ? +s.value : it.bool ? s.value === 'true' : s.value);
    } else {
      ctl.querySelectorAll('button').forEach(b => b.onclick = () => {
        ctl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        set(it, b.dataset.v);
      });
    }
    return row;
  }

  function render() {
    tabsEl.innerHTML = SCHEMA.map(s => `<button data-t="${s.id}" class="${s.id === tab ? 'on' : ''}">${s.label}</button>`).join('');
    tabsEl.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    const sec = SCHEMA.find(s => s.id === tab);
    body.innerHTML = '';
    for (const it of sec.items) body.appendChild(control(it));
    updateNote();
  }

  function open(cb) { onClose = cb || null; render(); root.classList.remove('hidden'); }
  function close() { if (root.classList.contains('hidden')) return; root.classList.add('hidden'); const cb = onClose; onClose = null; if (cb) cb(); }
  root.querySelector('#setClose').onclick = close;
  root.querySelector('#setDone').onclick = close;
  root.querySelector('#setReset').onclick = () => {
    const d = o.defaults();
    for (const k of Object.keys(d)) if (k !== 'gfx') o.settings[k] = d[k];
    Object.assign(o.settings.gfx, d.gfx);
    o.save(); o.apply('*'); render();
  };
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });
  // Esc chiude il pannello senza togliere la pausa
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && !root.classList.contains('hidden')) { e.stopImmediatePropagation(); e.preventDefault(); close(); }
  }, true);
  return { open, close, get isOpen() { return !root.classList.contains('hidden'); } };
}
