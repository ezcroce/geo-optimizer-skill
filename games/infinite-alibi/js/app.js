/* Infinite Alibi — macchina a stati del gioco e interfaccia. */
(function () {
  'use strict';
  const IA = window.IA;
  const { CONFIG, AVATARS, ROOMS, STUDIO, PROP_NAMES } = IA;
  const D = CONFIG.duration;

  const $ = (s) => document.querySelector(s);
  const canvas = $('#cctv');
  const R = new IA.Renderer(canvas);
  const tl = $('#timeline');
  const tlx = tl.getContext('2d');
  const side = $('#side');
  const modal = $('#modal');
  const modalBack = $('#modalBack');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => performance.now() / 1000;
  const r1 = (v) => Math.round(v * 10) / 10;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const PHASE_LABEL = { menu: 'MENU', roles: 'RUOLI', edit: 'MONTAGGIO', handoff: 'PASSAGGIO', evidence: 'RACCOLTA PROVE', trial: 'PROCESSO', vote: 'VOTO', verdict: 'VERDETTO', replay: 'REPLAY REALE', overtime: 'SUPPLEMENTARI', runoff: 'BALLOTTAGGIO', lobby: 'LOBBY ONLINE', wait: 'IN ATTESA' };
  const ROOM_COLORS = ['#e8590c', '#1c7ed6', '#e03131', '#2f9e44', '#9c36b5', '#66a80f'];
  const ICONS = { timestamp: '⏱', missing: '👻', duplicate: '👥', teleport: '⚡', glitch: '▲', crime: '💎', 'jewel-alone': '💎', 'jewel-back': '💎', 'jewel-glitch': '💎', presence: '👁', visit: '👣', lurk: '👣', 'deepfake-prop': '🎩', 'deepfake-shadow': '🌑', 'deepfake-flicker': '✨', 'splice-lag': '📉' };
  const DIFF_LABEL = { facile: 'Facile', normale: 'Normale', esperto: 'Esperto' };

  // ---------------------------------------------------------------------------
  // Stato
  // ---------------------------------------------------------------------------
  const S = {
    phase: 'menu',
    mode: null, // 'party' | 'detective' | 'culprit'
    timerMul: 1,
    names: ['Giulia', 'Marco', 'Sara', 'Luca'],
    scores: {},
    cs: null,
    user: -1,
    initials: [],
    edits: IA.emptyEdits(),
    ed: null,
    tool: 'splice',
    showOriginal: false,
    clues: [],
    bots: [],
    t: 0,
    playing: false,
    speed: 1,
    deadline: null,
    pins: [],
    lasers: [],
    laserColor: 0,
    botMarks: [],
    chat: [],
    schedule: [],
    trialStart: 0,
    accusations: 0,
    votes: null,
    anim: null,
    replayEdited: false,
    seedOverride: null,
    difficulty: 'normale',
    aids: true, // aiuti per principianti (filtro di movimento + lenti) negli investigatori
    filter: true,
    hints: null,
    lens: null,
    lensLeft: 0,
    runoff: null, // candidati del ballottaggio dopo un pareggio
    audienceGlitch: null,
    baked: null, // online: filmato precotto ricevuto dal server
    net: null,
    stream: { on: false, channel: '', sim: false, status: 'off', votes: {}, feed: [], lastGlitch: 0, userGlitch: {}, nextSim: 0 },
  };

  // ---------------------------------------------------------------------------
  // Audio minimale
  // ---------------------------------------------------------------------------
  let actx = null;
  function beep(freq, dur, type, vol) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const gn = actx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      gn.gain.value = vol || 0.04;
      gn.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(gn).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + dur);
    } catch (e) { /* audio non disponibile */ }
  }

  // ---------------------------------------------------------------------------
  // Utilità UI
  // ---------------------------------------------------------------------------
  function openModal(html) {
    modal.innerHTML = html;
    modalBack.classList.remove('hidden');
  }
  function closeModal() {
    modalBack.classList.add('hidden');
    modal.innerHTML = '';
  }
  function setSide(html) { side.innerHTML = html; }
  function setPhase(p) {
    S.phase = p;
    $('#phase').textContent = PHASE_LABEL[p] || p.toUpperCase();
  }
  function setTimer(sec) {
    S.deadline = sec && S.timerMul ? now() + sec * S.timerMul : null;
    S.lastTick = null;
  }
  function hint(text) { $('#hint').textContent = text || ''; }
  function nameOf(i) { return S.cs.names[i]; }
  function label(i) { return nameOf(i) + (i === S.user ? ' (tu)' : ''); }
  function colorOf(i) { return AVATARS[i].color; }
  function swatch(i) { return `<span class="swatch" style="background:${colorOf(i)}"></span>`; }
  function who(i) { return `<b style="color:${colorOf(i)}">${esc(label(i))}</b>`; }

  // ---------------------------------------------------------------------------
  // Menu e regole
  // ---------------------------------------------------------------------------
  function rulesHtml() {
    return `<div class="rules">
      <h3>Il caso</h3>
      <p>Nella villa è stato rubato il gioiello di famiglia dallo <b>Studio (CAM 03)</b>. Uno dei presenti è il Colpevole. Le telecamere hanno registrato tutto… ma il Colpevole ha avuto accesso al montaggio.</p>
      <h3>1 · Montaggio (solo il Colpevole, ${CONFIG.phases.edit} s)</h3>
      <ul>
        <li><b>✂ Taglia e Cuci</b>: sostituisci fino a ${CONFIG.splice.maxLen} s di una telecamera con ${CONFIG.splice.maxLen} s della stessa telecamera presi da un altro momento (es. lo Studio vuoto di prima, o te stesso in Cucina per un alibi).</li>
        <li><b>🎭 Deepfake</b> (1 volta): per ${CONFIG.deepfake.len} s il tuo avatar diventa quello di un innocente. Scegli tu quale dettaglio «tradisce»: l'<b>oggetto in mano</b> o l'<b>ombra</b>. L'avatar sfarfalla sempre un po'.</li>
        <li><b>▲ Glitch</b>: statico su una telecamera fino a ${CONFIG.glitch.maxLen} s. Nasconde tutto, ma <i>i glitch non sono mai casuali</i>.</li>
      </ul>
      <h3>2 · Raccolta prove (tutti, ${CONFIG.phases.evidence} s)</h3>
      <ul>
        <li><b>⏱ Timestamp</b>: un taglio fa saltare o tornare indietro l'orologio della telecamera.</li>
        <li><b>📉 Scatto del taglio</b>: nel punto di giunzione la luce lampeggia e l'immagine ha un micro-scatto, visibile anche senza leggere l'orologio.</li>
        <li><b>⚡ Continuità spaziale</b>: nessuno attraversa la villa in mezzo secondo, nessuno sta in due stanze, nessuno sparisce da tutte le camere.</li>
        <li><b>🌑 Ombre, 🎩 oggetti e ✨ sfarfallio</b>: il deepfake cambia la faccia, ma l'ombra <i>oppure</i> l'oggetto in mano resta quello vero (cappello, tazza, bastone, libro, ombrello, sciarpa), e l'avatar tremola.</li>
        <li><b>🧭 Aiuti</b> (opzionali): il <b>filtro di movimento</b> illumina di arancione una camera quando c'è un'anomalia di continuità; le <b>lenti</b> (2 per partita) ti portano dritto su un dettaglio sospetto.</li>
        <li>Clic su una telecamera = <b>puntina</b> sull'indizio · doppio clic = ingrandisci · <span class="kbd">←</span><span class="kbd">→</span> fotogramma per fotogramma.</li>
      </ul>
      <h3>3 · Processo (${CONFIG.phases.trial} s) e verdetto</h3>
      <ul>
        <li>Discutete e trascinate sul video per usare il <b>puntatore laser</b>. In Party ognuno ha il suo colore (tasti <span class="kbd">1</span>–<span class="kbd">6</span>).</li>
        <li>Voto istantaneo a maggioranza. In caso di <b>pareggio</b>: ${CONFIG.phases.overtime} s di <b>tempi supplementari</b> in cui parlano solo i sospettati più votati, poi <b>ballottaggio</b> secco fra loro. Se anche il ballottaggio è pari, il Colpevole la fa franca.</li>
        <li>Colpevole preso → espulsione comica. Innocente condannato → <b>Replay Reale</b> senza tagli.</li>
      </ul>
      <h3>Personaggi</h3>
      <ul>${AVATARS.map((a) => `<li>${a.key} · ${esc(a.name)} — ${PROP_NAMES[a.prop]}, sagoma ${a.r >= 12 ? 'grande' : a.r <= 9 ? 'piccola' : 'media'}</li>`).join('')}</ul>
    </div>`;
  }

  function showMenu() {
    stopAll();
    setPhase('menu');
    S.mode = null;
    S.baked = null;
    S.hints = null;
    S.lens = null;
    S.runoff = null;
    S.lasers = [];
    if (!S.cs || S.cs.stub || !S.initials.length) {
      S.cs = IA.generateCase(12345, 5, 2);
      S.cs.names = AVATARS.slice(0, 5).map((a) => a.name);
      S.initials = AVATARS.map((a) => a.key);
    }
    S.edits = IA.emptyEdits();
    S.playing = true;
    setSide(`<h2>Infinite Alibi</h2><p>Il filmato di sfondo è un caso dimostrativo. Scegli una modalità per iniziare.</p>`);
    openModal(`
      <h1>INFINITE <b>ALIBI</b></h1>
      <p class="tagline">Deduzione sociale in 3 minuti. Il Colpevole monta i filmati di sorveglianza. Voi trovate il trucco.</p>
      <div class="modes">
        <button class="mode" data-act="mode" data-mode="party"><span class="ico">🎉</span><b>Party</b><span>3–6 amici, un solo schermo. Ruoli segreti, il Colpevole monta il video di nascosto, poi discutete a voce col laser.</span></button>
        <button class="mode" data-act="mode" data-mode="detective"><span class="ico">🕵️</span><b>Detective</b><span>Un Colpevole IA ha già truccato i filmati. Trova i micro-indizi, presentali al processo e convinci la giuria di bot.</span></button>
        <button class="mode" data-act="mode" data-mode="culprit"><span class="ico">🎬</span><b>Colpevole</b><span>Sei tu il ladro. Taglia, cuci, glitcha e fai un deepfake: poi difenditi da 4 investigatori bot.</span></button>
        <button class="mode" data-act="mode" data-mode="online"><span class="ico">🌐</span><b>Online</b><span>3–6 giocatori, ognuno sul suo dispositivo. Il server custodisce il caso e il montaggio: nessuno può sbirciare.</span></button>
      </div>
      <div class="row">
        <label>Timer</label>
        <select id="timerSel">
          <option value="1" ${S.timerMul === 1 ? 'selected' : ''}>Standard (~3 minuti a partita)</option>
          <option value="2" ${S.timerMul === 2 ? 'selected' : ''}>Rilassato (tempi doppi)</option>
          <option value="0" ${S.timerMul === 0 ? 'selected' : ''}>Senza timer (allenamento)</option>
        </select>
        <label>Caso n°</label>
        <input type="text" id="seedIn" placeholder="casuale" value="${S.seedOverride || ''}" style="max-width:120px" />
      </div>
      <div class="row">
        <label>Difficoltà</label>
        <select id="diffSel">${Object.keys(CONFIG.DIFFICULTY).map((k) => `<option value="${k}" ${S.difficulty === k ? 'selected' : ''}>${DIFF_LABEL[k] || k} — deepfake ${CONFIG.DIFFICULTY[k].deepfakeLen} s, ${k === 'facile' ? 'indizi vistosi' : k === 'esperto' ? 'indizi sottili' : 'indizi equilibrati'}</option>`).join('')}</select>
        <label class="toggle" style="flex:0 0 auto"><input type="checkbox" id="aidsSel" ${S.aids ? 'checked' : ''}/> 🧭 Aiuti per principianti</label>
      </div>
      <div class="row"><button data-act="streamSetup">📺 Modalità streamer${S.stream.on ? ' (attiva)' : ''}</button></div>
      <details><summary>Come si gioca</summary>${rulesHtml()}</details>
    `);
  }

  function readMenuOptions() {
    const ts = $('#timerSel');
    if (ts) S.timerMul = Number(ts.value);
    const si = $('#seedIn');
    if (si) S.seedOverride = si.value.trim() ? Math.abs(parseInt(si.value.trim(), 10)) || null : null;
    const ds = $('#diffSel');
    if (ds) S.difficulty = ds.value;
    const as = $('#aidsSel');
    if (as) S.aids = as.checked;
    IA.setDifficulty(S.difficulty);
  }

  function showPartySetup() {
    const rows = S.names.map((n, i) => `<div class="name-row">${swatch(i)}<input type="text" data-name="${i}" value="${esc(n)}" maxlength="14" /></div>`).join('');
    openModal(`
      <h2>🎉 Party — chi gioca?</h2>
      <p class="tagline">Da 3 a 6 giocatori. Ogni giocatore è un personaggio nella villa (stesso simbolo e oggetto per tutta la partita).</p>
      <div class="names">${rows}</div>
      <div class="row">
        <button data-act="addName" ${S.names.length >= 6 ? 'disabled' : ''}>+ Aggiungi</button>
        <button data-act="delName" ${S.names.length <= 3 ? 'disabled' : ''}>− Rimuovi</button>
      </div>
      <div class="row"><button data-act="menu">← Indietro</button><button class="primary" data-act="partyGo">Distribuisci i ruoli →</button></div>
    `);
  }
  function readNames() {
    document.querySelectorAll('[data-name]').forEach((inp) => {
      S.names[Number(inp.dataset.name)] = inp.value.trim() || `Giocatore ${Number(inp.dataset.name) + 1}`;
    });
  }

  // ---------------------------------------------------------------------------
  // Nuovo caso
  // ---------------------------------------------------------------------------
  function newCase() {
    const seed = S.seedOverride || Math.floor(Math.random() * 1e6);
    const n = S.mode === 'party' ? S.names.length : 5;
    const rng = IA.makeRng(seed ^ 0x5bd1e995);
    let culprit;
    if (S.mode === 'party') { culprit = rng.int(n); S.user = -1; }
    else if (S.mode === 'culprit') { culprit = rng.int(n); S.user = culprit; }
    else { S.user = rng.int(n); culprit = (S.user + 1 + rng.int(n - 1)) % n; }
    const cs = IA.generateCase(seed, n, culprit);
    if (S.mode === 'party') {
      cs.names = S.names.slice(0, n);
      S.initials = IA.makeInitials(cs.names);
      cs.names.forEach((nm) => { if (!(nm in S.scores)) S.scores[nm] = 0; });
    } else {
      cs.names = AVATARS.slice(0, n).map((a) => a.name);
      S.initials = AVATARS.map((a) => a.key);
    }
    S.cs = cs;
    S.seed = seed;
    resetCaseState();
    const rngB = IA.makeRng(seed + 99);
    for (let i = 0; i < n; i++) if (i !== S.user) S.bots.push(IA.makeBot(i, rngB));
    S.rng = IA.makeRng(seed + 7);
  }

  function resetCaseState() {
    IA.setDifficulty(S.difficulty);
    S.edits = IA.emptyEdits();
    S.clues = [];
    S.bots = [];
    S.pins = [];
    S.lasers = [];
    S.botMarks = [];
    S.chat = [];
    S.schedule = [];
    S.votes = null;
    S.anim = null;
    S.accusations = 0;
    S.replayEdited = false;
    S.showOriginal = false;
    S.t = 0;
    S.verdict = null;
    S.runoff = null;
    S.hints = null;
    S.lens = null;
    S.lensLeft = 0;
    S.baked = null;
    S.cwin = null;
    S.audienceGlitch = null;
    S.stream.votes = {};
    R.focus = null;
  }

  function stopAll() {
    S.deadline = null;
    S.schedule = [];
    S.anim = null;
    closeModal();
    hint('');
  }

  // ---------------------------------------------------------------------------
  // Party: distribuzione segreta dei ruoli
  // ---------------------------------------------------------------------------
  function partyRoles(k) {
    setPhase('roles');
    S.playing = false;
    if (k >= S.cs.n) return partyEditIntro();
    openModal(`
      <h2 class="center">Passa il dispositivo a</h2>
      <div class="big-role" style="background:#151c25;color:${colorOf(k)}">${esc(nameOf(k))}</div>
      <p class="center muted">Gli altri non guardano. Simbolo «${esc(S.initials[k])}», oggetto: ${PROP_NAMES[AVATARS[k].prop]}.</p>
      <button class="primary" data-act="reveal" data-k="${k}">Mostra il mio ruolo</button>
    `);
  }
  function partyReveal(k) {
    const cul = k === S.cs.culprit;
    openModal(`
      <h2 class="center">${esc(nameOf(k))}, sei…</h2>
      <div class="big-role ${cul ? 'cul' : 'inn'}">${cul ? 'IL COLPEVOLE' : 'INNOCENTE'}</div>
      <p class="center">${cul
        ? `Hai rubato il gioiello nello Studio alle <b>${IA.clockText(S.cs.Tc)}</b>. Tra poco avrai ${CONFIG.phases.edit} s per truccare i filmati. Poi bluffa!`
        : 'Osserva i filmati, trova i micro-indizi e smaschera il Colpevole al processo.'}</p>
      <button class="primary" data-act="nextRole" data-k="${k + 1}">Ho capito — nascondi e passa</button>
    `);
  }
  function partyEditIntro() {
    openModal(`
      <h2 class="center">🎬 Il Colpevole prende il dispositivo</h2>
      <p class="center">Tutti gli altri chiudono gli occhi o si girano. Il Colpevole ha <b>${CONFIG.phases.edit} secondi</b> per manomettere i filmati.</p>
      <p class="center muted">(Tutti tocchino lo schermo a turno se volete confondere chi lo sta usando davvero.)</p>
      <button class="primary" data-act="startEdit">Sono il Colpevole: inizia il montaggio</button>
    `);
  }

  // ---------------------------------------------------------------------------
  // Fase 1 — Montaggio (Edit Tool)
  // ---------------------------------------------------------------------------
  function defaultDraft() {
    const cs = S.cs;
    const Tc = Math.round(cs.Tc);
    const innocents = [];
    for (let i = 0; i < cs.n; i++) if (i !== cs.culprit) innocents.push(i);
    return {
      splice: { on: false, cam: STUDIO, t0: clamp(Tc, 0, D - 3), len: 3, src0: 1 },
      deepfake: { on: false, t: r1(cs.Tc), victim: innocents[0], weak: 'prop' },
      glitch: { on: false, cam: STUDIO, t0: clamp(Tc - 2, 0, D - 3), len: 3 },
    };
  }
  function draftToEdits() {
    const e = S.ed;
    const sp = e.splice;
    const gl = e.glitch;
    sp.len = clamp(sp.len, CONFIG.splice.minLen, CONFIG.splice.maxLen);
    sp.t0 = clamp(sp.t0, 0, D - sp.len);
    sp.src0 = clamp(sp.src0, 0, D - sp.len);
    gl.len = clamp(gl.len, CONFIG.glitch.minLen, CONFIG.glitch.maxLen);
    gl.t0 = clamp(gl.t0, 0, D - gl.len);
    e.deepfake.t = clamp(e.deepfake.t, 0, D - CONFIG.deepfake.len);
    S.edits = {
      splice: sp.on ? { cam: sp.cam, t0: r1(sp.t0), len: r1(sp.len), src0: r1(sp.src0) } : null,
      glitch: gl.on ? { cam: gl.cam, t0: r1(gl.t0), len: r1(gl.len) } : null,
      deepfake: e.deepfake.on ? { t: r1(e.deepfake.t), victim: e.deepfake.victim, weak: e.deepfake.weak === 'shadow' ? 'shadow' : 'prop' } : null,
    };
    scheduleRisk();
    if (S.mode === 'online') netSendEdits(false);
  }

  function startEdit() {
    closeModal();
    setPhase('edit');
    S.ed = defaultDraft();
    S.tool = 'splice';
    draftToEdits();
    const win = IA.culpritWindow(S.cs);
    S.cwin = win;
    S.t = Math.max(0, win.tin - 2);
    S.playing = true;
    setTimer(CONFIG.phases.edit);
    renderEditSide();
    hint('Clic su una telecamera per sceglierla per lo strumento attivo · doppio clic = ingrandisci');
  }

  function camOptions(sel) {
    return ROOMS.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>CAM 0${r.id + 1} · ${r.name}</option>`).join('');
  }

  function renderEditSide() {
    const cs = S.cs;
    const e = S.ed;
    const tab = (k, label) => `<button class="${S.tool === k ? 'on' : ''}" data-act="tool" data-tool="${k}">${label}</button>`;
    let tool = '';
    if (S.tool === 'splice') {
      const sp = e.splice;
      tool = `
        <label class="toggle"><input type="checkbox" data-ed="splice.on" ${sp.on ? 'checked' : ''}/> ✂ Taglia e Cuci attivo</label>
        <p class="muted">Sostituisci un pezzo di una telecamera con un altro momento della stessa telecamera. Il timestamp, però, mostrerà l'ora della sorgente…</p>
        <div class="row"><label>Camera</label><select data-ed="splice.cam">${camOptions(sp.cam)}</select></div>
        <div class="row"><label>Taglio da</label><input type="range" min="0" max="${D}" step="0.1" value="${sp.t0}" data-ed="splice.t0"/><span class="val" data-v="splice.t0"></span></div>
        <div class="row"><label>Durata</label><input type="range" min="${CONFIG.splice.minLen}" max="${CONFIG.splice.maxLen}" step="0.1" value="${sp.len}" data-ed="splice.len"/><span class="val" data-v="splice.len"></span></div>
        <div class="row"><label>Sorgente</label><input type="range" min="0" max="${D}" step="0.1" value="${sp.src0}" data-ed="splice.src0"/><span class="val" data-v="splice.src0"></span></div>
        <div class="row"><button class="small" data-act="ph" data-k="splice.t0">Taglio = playhead</button><button class="small" data-act="ph" data-k="splice.src0">Sorgente = playhead</button><button class="small" data-act="preview" data-k="splice">▶ Anteprima</button></div>`;
    } else if (S.tool === 'deepfake') {
      const df = e.deepfake;
      const vis = deepfakeVisible();
      tool = `
        <label class="toggle"><input type="checkbox" data-ed="deepfake.on" ${df.on ? 'checked' : ''}/> 🎭 Deepfake attivo (1 uso)</label>
        <p class="muted">Per ${CONFIG.deepfake.len} s il tuo avatar diventa quello di un innocente, con un leggero sfarfallio costante (difficoltà: ${DIFF_LABEL[S.difficulty] || S.difficulty}). Un dettaglio però fallisce sempre: scegli quale.</p>
        <div class="row"><label>Vittima</label><select data-ed="deepfake.victim">${cs.names.map((n, i) => (i === cs.culprit ? '' : `<option value="${i}" ${i === df.victim ? 'selected' : ''}>${esc(n)}</option>`)).join('')}</select></div>
        <div class="row"><label>Tradisce</label><select data-ed="deepfake.weak">
          <option value="prop" ${df.weak !== 'shadow' ? 'selected' : ''}>🎩 l'oggetto: resta in mano ${PROP_NAMES[AVATARS[cs.culprit].prop]}</option>
          <option value="shadow" ${df.weak === 'shadow' ? 'selected' : ''}>🌑 l'ombra: resta la tua sagoma</option>
        </select></div>
        <div class="row"><label>Istante</label><input type="range" min="0" max="${D - CONFIG.deepfake.len}" step="0.1" value="${df.t}" data-ed="deepfake.t"/><span class="val" data-v="deepfake.t"></span></div>
        <div class="row"><button class="small" data-act="ph" data-k="deepfake.t">Istante = playhead</button><button class="small" data-act="preview" data-k="deepfake">▶ Anteprima</button></div>
        <p class="muted" data-v="deepfake.vis">${vis}</p>`;
    } else {
      const gl = e.glitch;
      tool = `
        <label class="toggle"><input type="checkbox" data-ed="glitch.on" ${gl.on ? 'checked' : ''}/> ▲ Disturbo segnale attivo</label>
        <p class="muted">Statico totale su una telecamera. Nasconde tutto… ma gli investigatori sanno che non è casuale, e chi non si vede altrove era lì dentro.</p>
        <div class="row"><label>Camera</label><select data-ed="glitch.cam">${camOptions(gl.cam)}</select></div>
        <div class="row"><label>Da</label><input type="range" min="0" max="${D}" step="0.1" value="${gl.t0}" data-ed="glitch.t0"/><span class="val" data-v="glitch.t0"></span></div>
        <div class="row"><label>Durata</label><input type="range" min="${CONFIG.glitch.minLen}" max="${CONFIG.glitch.maxLen}" step="0.1" value="${gl.len}" data-ed="glitch.len"/><span class="val" data-v="glitch.len"></span></div>
        <div class="row"><button class="small" data-act="ph" data-k="glitch.t0">Inizio = playhead</button><button class="small" data-act="preview" data-k="glitch">▶ Anteprima</button></div>`;
    }
    setSide(`
      <div class="card secret">
        <h2>🎬 Sala montaggio</h2>
        <p>Sei ${who(cs.culprit)}. Hai rubato il gioiello alle <b>${IA.clockText(cs.Tc)}</b>. Sei inquadrato nello Studio da <b>${IA.clockText(S.cwin.tin)}</b> a <b>${IA.clockText(S.cwin.tout)}</b> (riga «TU» sulla timeline).</p>
      </div>
      <div class="tabs">${tab('splice', '✂ Taglia')}${tab('deepfake', '🎭 Deepfake')}${tab('glitch', '▲ Glitch')}</div>
      <div class="card">${tool}</div>
      <div class="card">
        <h3>📱 I tuoi complici <span id="moodLbl" class="mood"></span></h3>
        <div class="chat advice" id="advice"><div class="msg">Stanno guardando il tuo montaggio…</div></div>
        <label class="toggle"><input type="checkbox" data-act="orig" ${S.showOriginal ? 'checked' : ''}/> Mostra il filmato originale</label>
      </div>
      <button class="primary" data-act="finishEdit">Consegna il filmato ✓</button>
    `);
    updateEditLabels();
    updateRisk();
  }

  function deepfakeVisible() {
    const df = S.ed.deepfake;
    const p = IA.charPos(S.cs, S.cs.culprit, df.t);
    const cam = IA.roomAt(p.x, p.y);
    const e = S.edits;
    const hidden = (e.glitch && e.glitch.cam === cam && df.t >= e.glitch.t0 && df.t < e.glitch.t0 + e.glitch.len) ||
      (e.splice && e.splice.cam === cam && df.t >= e.splice.t0 && df.t < e.splice.t0 + e.splice.len);
    if (hidden) return '<span class="bad">✗ In quell\'istante sei nascosto da un altro tuo trucco: il deepfake andrebbe sprecato.</span>';
    return `<span class="ok">✓ In quell'istante sei inquadrato da CAM 0${cam + 1} (${ROOMS[cam].name}).</span>`;
  }

  function updateEditLabels() {
    const e = S.ed;
    const set = (k, txt) => { const el = side.querySelector(`[data-v="${k}"]`); if (el) el.innerHTML = txt; };
    set('splice.t0', `${IA.clockText(e.splice.t0).slice(3)}`);
    set('splice.len', `${e.splice.len.toFixed(1)} s`);
    set('splice.src0', `${IA.clockText(e.splice.src0).slice(3)}`);
    set('deepfake.t', `${IA.clockText(e.deepfake.t).slice(3)}`);
    set('glitch.t0', `${IA.clockText(e.glitch.t0).slice(3)}`);
    set('glitch.len', `${e.glitch.len.toFixed(1)} s`);
    if (S.tool === 'deepfake') set('deepfake.vis', deepfakeVisible());
  }

  let riskTimer = null;
  function scheduleRisk() {
    clearTimeout(riskTimer);
    riskTimer = setTimeout(updateRisk, 200);
  }
  // Feedback narrativo dei complici virtuali al posto della barra percentuale
  const MOOD_COLORS = ['#3ddc84', '#ffb703', '#ff3b3b'];
  const ACC_COLORS = { 'il Socio': '#7fe0ff', 'la Talpa': '#da77f2', 'Zio Montatore': '#ffd43b' };
  function updateRisk() {
    if (S.phase !== 'edit') return;
    const box = $('#advice');
    const lbl = $('#moodLbl');
    if (!box) return;
    const { clues } = IA.analyze(S.cs, S.edits);
    const p = IA.convictionProb(S.cs, clues, 80, 4242);
    const m = IA.moodLabel(p);
    const key = JSON.stringify(S.edits);
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    lbl.textContent = `${m.icon} ${m.label}`;
    lbl.style.color = MOOD_COLORS[m.level];
    const tips = IA.culpritAdvice(S.cs, clues, IA.makeRng(4242 + key.length));
    box.innerHTML = tips.map((tp) => `<div class="msg" style="--c:${tp.risk < 0 ? '#3ddc84' : ACC_COLORS[tp.who] || '#aaa'}"><b>${esc(tp.who)}:</b> ${esc(tp.text)}</div>`).join('');
  }

  function finishEdit() {
    draftToEdits();
    S.showOriginal = false;
    if (S.mode === 'online') {
      netSendEdits(true);
      S.deadline = null;
      setSide('<h2>📼 Filmato consegnato</h2><p>Il server sta preparando il filmato per gli investigatori…</p>');
      return;
    }
    S.analysis = IA.analyze(S.cs, S.edits);
    S.clues = S.analysis.clues;
    if (S.mode === 'party') {
      setPhase('handoff');
      S.playing = false;
      S.deadline = null;
      openModal(`
        <h2 class="center">📼 Filmato consegnato</h2>
        <p class="center">Il Colpevole posa il dispositivo. Ora tutti guardano lo schermo: avete <b>${CONFIG.phases.evidence} secondi</b> per raccogliere le prove.</p>
        <button class="primary" data-act="startEvidence">Mostra i filmati a tutti</button>
      `);
    } else {
      startEvidence();
    }
  }

  // ---------------------------------------------------------------------------
  // Detective: il Colpevole IA monta il video
  // ---------------------------------------------------------------------------
  function aiEditIntro() {
    setPhase('edit');
    S.playing = false;
    openModal(`
      <h2 class="center">🕵️ Caso n° ${S.seed}</h2>
      <p class="center">Sei ${who(S.user)} (${PROP_NAMES[AVATARS[S.user].prop]}). Sei innocente.<br/>Uno degli altri quattro ha rubato il gioiello dallo Studio… e sta già truccando i filmati.</p>
      <div class="big-role" style="background:#151c25;color:var(--amber)" id="aiWork">✂ MONTAGGIO IN CORSO…</div>
    `);
    setTimeout(() => {
      S.edits = IA.aiEdits(S.cs, IA.makeRng(S.seed + 3));
      S.analysis = IA.analyze(S.cs, S.edits);
      S.clues = S.analysis.clues;
      const el = $('#aiWork');
      if (el) el.textContent = '📼 FILMATO CONSEGNATO';
      setTimeout(() => { closeModal(); startEvidence(); }, 900);
    }, 1300);
  }

  // ---------------------------------------------------------------------------
  // Fase 2 — Raccolta prove
  // ---------------------------------------------------------------------------
  function startEvidence() {
    closeModal();
    setPhase('evidence');
    S.t = 0;
    S.playing = true;
    S.speed = 1;
    syncSpeed();
    R.focus = null;
    if (S.mode !== 'online') {
      setTimer(CONFIG.phases.evidence);
      // aiuti per principianti: solo per chi indaga (non per il Colpevole umano)
      if (S.aids && S.mode !== 'culprit') { S.hints = IA.anomalyHints(S.cs, S.clues); S.lensLeft = 2; }
    }
    for (const b of S.bots) if (b.idx !== S.cs.culprit) IA.botObserve(b, S.clues, S.rng);
    S.chatterAt = now() + 6;
    renderEvidenceSide();
    hint('Clic = puntina su un indizio · doppio clic = ingrandisci · ←/→ fotogramma per fotogramma');
  }

  function pinsHtml(withPresent) {
    if (!S.pins.length) return S.phase === 'evidence' ? '<p class="muted">Nessuna puntina. Clicca su una telecamera dove noti qualcosa di strano.</p>' : '<p class="muted">Nessuna puntina messa durante la raccolta prove.</p>';
    return `<div class="list">${S.pins.map((p, i) => `
      <div class="item"><span class="tag">#${i + 1}</span><span class="grow">CAM 0${p.cam + 1} · ${IA.clockText(p.t)}${p.presented ? (p.match ? ' <span class="ok">✓ convincente</span>' : ' <span class="bad">✗ niente di strano</span>') : ''}</span>
        <button class="small" data-act="seek" data-t="${p.t}">vai</button>
        ${withPresent && !p.presented ? `<button class="small primary" data-act="present" data-k="${i}">Presenta</button>` : ''}
        ${!withPresent ? `<button class="small" data-act="unpin" data-k="${i}">✕</button>` : ''}
      </div>`).join('')}</div>`;
  }

  function renderEvidenceSide() {
    const cs = S.cs;
    let intro;
    if (S.mode === 'party') intro = '<p>Guardate tutti lo schermo. Mettete in pausa, andate fotogramma per fotogramma, segnate con le puntine ciò che non torna.</p>';
    else if (S.mode === 'detective') intro = `<p>Sei ${who(S.user)}. Trova cosa non torna nei filmati: le puntine che metti ora potrai <b>presentarle</b> al processo.</p>`;
    else if (S.mode === 'online') intro = isOnlineCulprit()
      ? `<p>Sei ${who(S.user)}, <b class="bad">il Colpevole</b>. Gli altri stanno guardando il tuo filmato: metti qualche puntina anche tu, per sembrare uno di loro.</p>`
      : `<p>Sei ${who(S.user)}. Il filmato arriva dal server già montato: trova cosa non torna e metti le puntine da presentare al processo.</p>`;
    else intro = `<p>I quattro investigatori stanno guardando il tuo filmato… Preparati a difenderti. Puoi mettere puntine anche tu, per preparare le accuse.</p>`;
    setSide(`
      <h2>🔎 Raccolta prove</h2>
      ${intro}
      <div class="card">
        <h3>Cosa cercare</h3>
        <p class="muted">⏱ orologi che saltano o tornano indietro · ⚡ spostamenti impossibili · 👥 la stessa persona in due stanze · 👻 qualcuno che sparisce · 🌑 ombre che non corrispondono · 🎩 oggetti in mano alla persona sbagliata · ▲ disturbi di segnale</p>
      </div>
      <div class="card"><h3>Personaggi</h3><div class="chips">${cs.names.map((n, i) => `<span class="chip" style="background:#0c1117">${swatch(i)}<b>${esc(S.initials[i])}</b> ${esc(label(i))} · ${PROP_NAMES[AVATARS[i].prop].replace(/^(il |la |l')/, '')}</span>`).join('')}</div></div>
      ${aidsHtml()}
      <div class="card"><h3>Puntine</h3><div id="pinList">${pinsHtml(false)}</div></div>
      ${S.mode === 'culprit' ? '<div class="card"><h3>Gli investigatori</h3><div class="chat" id="chat"></div></div>' : ''}
      ${S.mode === 'online' ? netNextButton('Passa al processo →') : '<button class="primary" data-act="startTrial">Passa al processo →</button>'}
    `);
    if (S.mode === 'culprit') renderChat();
  }

  function aidsHtml() {
    if (!S.hints) return '';
    return `<div class="card aids"><h3>🧭 Aiuti per principianti</h3>
      <label class="toggle"><input type="checkbox" data-act="filter" ${S.filter ? 'checked' : ''}/> Filtro di movimento <span class="muted">(la camera si illumina di arancione su un'anomalia di continuità)</span></label>
      <div class="row"><button data-act="lens" id="btnLens" ${S.lensLeft > 0 ? '' : 'disabled'}>🔍 Lente automatica (${S.lensLeft} rimaste)</button></div>
    </div>`;
  }
  function useLens() {
    if (S.lensLeft <= 0) return;
    if (S.mode === 'online') { netSend('lens'); return; }
    const target = S.hints && S.hints.lens[2 - S.lensLeft];
    S.lensLeft--;
    showLens(target);
  }
  function showLens(target) {
    const b = $('#btnLens');
    if (b) { b.textContent = `🔍 Lente automatica (${S.lensLeft} rimaste)`; b.disabled = S.lensLeft <= 0; }
    if (!target) { hint('🔍 La lente non trova altro di strano nelle immagini… forse il trucco è un\'assenza: contate le persone!'); return; }
    R.focus = null;
    S.playing = false;
    S.t = clamp(target.t - 0.2, 0, D);
    S.lens = { cam: target.cam, lx: target.lx, ly: target.ly, born: now(), life: 5 };
    hint(`🔍 Lente: CAM 0${target.cam + 1} alle ${IA.clockText(target.t)} — guarda bene lì, fotogramma per fotogramma.`);
    beep(1046, 0.08, 'triangle');
  }

  function addPin(hit) {
    if (S.pins.length >= 9) S.pins.shift();
    S.pins.push({ cam: hit.cam, lx: hit.lx, ly: hit.ly, t: r1(S.t), color: S.mode === 'party' ? '#ffb703' : colorOf(Math.max(0, S.user)) });
    beep(880, 0.06, 'triangle');
    const pl = $('#pinList');
    if (pl) pl.innerHTML = pinsHtml(S.phase === 'trial' && S.mode !== 'party');
  }

  // ---------------------------------------------------------------------------
  // Fase 3 — Processo
  // ---------------------------------------------------------------------------
  function startTrial() {
    setPhase('trial');
    if (S.mode !== 'online') setTimer(CONFIG.phases.trial);
    S.playing = true;
    S.trialStart = now();
    S.schedule = [];
    if (S.mode === 'detective' || S.mode === 'culprit') buildBotSpeech();
    renderTrialSide();
    hint(S.mode === 'party' ? 'Trascina sul video per usare il laser · tasti 1–6 = colore del giocatore' : S.mode === 'online' ? 'Trascina sul video: il tuo laser lo vedono tutti · scrivi in chat o presenta le puntine' : 'Trascina sul video per usare il laser · presenta le tue puntine alla giuria');
  }

  function speak(i, text, clue, isMe) {
    S.msgId = (S.msgId || 0) + 1;
    S.chat.push({ id: S.msgId, i, text, clue, me: !!isMe });
    if (S.chat.length > 40) S.chat.shift();
    if (clue) {
      S.botMarks.push({ cam: clue.cam, lx: clue.lx, ly: clue.ly, color: colorOf(i), label: S.initials[i], born: now(), life: 4.5, seed: Math.random() * 6 });
    }
    beep(isMe ? 520 : 300 + i * 60, 0.05, 'sine', 0.05);
    renderChat();
  }

  function msgHtml(m) {
    return `<div class="msg ${m.me ? 'me' : ''}" style="--c:${colorOf(m.i)}"><b>${esc(label(m.i))}:</b> ${esc(m.text)}${m.clue ? ` <a data-act="seek" data-t="${m.clue.t}">▶ ${IA.clockText(m.clue.t).slice(3)}</a>` : ''}</div>`;
  }
  function renderChat() {
    const el = $('#chat');
    if (!el) return;
    // append-only: i messaggi già mostrati non ripartono con l'animazione
    const shown = Number(el.dataset.count || 0);
    const first = el.dataset.first === String(S.chat[0] && S.chat[0].id);
    if (shown && first && shown <= S.chat.length) el.insertAdjacentHTML('beforeend', S.chat.slice(shown).map(msgHtml).join(''));
    else el.innerHTML = S.chat.map(msgHtml).join('');
    el.dataset.count = S.chat.length;
    el.dataset.first = String(S.chat[0] && S.chat[0].id);
    el.scrollTop = el.scrollHeight;
  }

  function buildBotSpeech() {
    const cs = S.cs;
    const T = CONFIG.phases.trial * (S.timerMul || 1);
    const span = Math.min(T, 60) - 10;
    const rng = S.rng;
    const items = [];
    for (const b of S.bots) {
      if (b.idx === cs.culprit) continue;
      const mine = S.clues.filter((c) => b.noticed.has(c.id) && Object.keys(c.points).length > 0)
        .sort((a, b2) => maxAbs(b2.points) - maxAbs(a.points));
      const tamper = S.clues.filter((c) => b.noticed.has(c.id) && Object.keys(c.points).length === 0);
      const pick = mine.slice(0, 2).concat(tamper.slice(0, 1));
      pick.forEach((c) => items.push({ bot: b.idx, text: c.say, clue: c }));
      if (!pick.length) items.push({ bot: b.idx, text: rng.pick(['Io non ho visto niente di strano… qualcuno ha notato qualcosa?', 'Sembra tutto normale. Troppo normale.', 'Ho guardato la CAM 03 tre volte, giuro che non capisco.']) });
    }
    // Il Colpevole IA bluffa (Detective)
    if (S.mode === 'detective') {
      const c = cs.culprit;
      const e = S.edits;
      const target = e.deepfake ? e.deepfake.victim : consensusTop([c, S.user]);
      items.push({ bot: c, text: `Io ero in ${ROOMS[cs.culpritStart].name} quasi tutto il tempo, controllate la CAM 0${cs.culpritStart + 1}!` });
      if (target >= 0) {
        items.push({ bot: c, text: `Secondo me è stato ${nameOf(target)}. L'ho visto${e.deepfake ? ' nello Studio' : ' vicino allo Studio'}, chiarissimo.`, accuse: target });
      }
      if (e.glitch) items.push({ bot: c, text: 'Quel disturbo sarà un guasto, la villa è vecchia…' });
    }
    const order = rng.shuffle(items);
    order.forEach((it, k) => { it.at = 1.5 + (span * (k + rng.next() * 0.6)) / Math.max(1, order.length); });
    S.schedule = order.sort((a, b) => a.at - b.at);
  }
  function maxAbs(p) { let m = 0; for (const k in p) m = Math.max(m, Math.abs(p[k])); return m; }
  function consensusArr() {
    const cons = new Array(S.cs.n).fill(0);
    for (const b of S.bots) if (b.idx !== S.cs.culprit) IA.botScores(S.cs, S.clues, b).forEach((v, i) => (cons[i] += v));
    return cons;
  }
  function consensusTop(exclude) {
    const cons = consensusArr();
    let best = -1;
    let bv = -Infinity;
    cons.forEach((v, i) => { if (!exclude.includes(i) && v > bv) { bv = v; best = i; } });
    return best;
  }

  function persuade(target, amount, speakerIsCulprit) {
    for (const b of S.bots) {
      if (b.idx === S.cs.culprit || b.idx === target) continue;
      const sc = IA.botScores(S.cs, S.clues, b);
      const top = Math.max.apply(null, sc);
      if (top < 4 && S.rng.next() < 0.65) b.bias[target] = (b.bias[target] || 0) + amount;
      else if (speakerIsCulprit && top >= 4 && S.rng.next() < 0.3) b.bias[S.cs.culprit] = (b.bias[S.cs.culprit] || 0) + 0.5;
    }
  }

  function tickSchedule() {
    if ((S.phase !== 'trial' && S.phase !== 'overtime') || !S.schedule.length) return;
    const el = now() - S.trialStart;
    while (S.schedule.length && S.schedule[0].at <= el) {
      const it = S.schedule.shift();
      speak(it.bot, it.text, it.clue);
      if (it.accuse != null) persuade(it.accuse, 1.2, true);
      if (it.clue) S.t = clamp(it.clue.t - 0.3, 0, D);
    }
  }

  function renderTrialSide() {
    const cs = S.cs;
    let body = '';
    if (S.mode === 'party') {
      body = `
        <p>Discutete <b>a voce</b>! Chi ha visto cosa? Trascinate sul video per cerchiare gli errori col laser.</p>
        <div class="card laser-pick"><h3>Laser di</h3><div class="chips">${cs.names.map((n, i) => `<button class="small ${S.laserColor === i ? 'on' : ''}" style="--c:${colorOf(i)}" data-act="laser" data-k="${i}">${swatch(i)} ${i + 1} · ${esc(n)}</button>`).join('')}</div></div>
        <div class="card"><h3>Puntine</h3>${pinsHtml(false)}</div>`;
    } else {
      const others = [];
      for (let i = 0; i < cs.n; i++) if (i !== S.user) others.push(i);
      const quick = S.mode === 'culprit'
        ? `<button class="small" data-act="say" data-k="glitch">«È solo un guasto tecnico!»</button><button class="small" data-act="say" data-k="alibi">«Io ero altrove!»</button>`
        : '';
      body = `
        <div class="card"><h3>Aula</h3><div class="chat" id="chat"></div></div>
        <div class="card"><h3>Le tue puntine</h3><div id="pinList">${pinsHtml(true)}</div></div>
        <div class="card"><h3>Accusa (${2 - S.accusations} rimaste)</h3><div class="chips">${others.map((i) => `<button class="small" data-act="accuse" data-k="${i}" ${S.accusations >= 2 ? 'disabled' : ''}>${swatch(i)} ${esc(nameOf(i))}</button>`).join('')}</div>
        ${quick ? `<div class="chips">${quick}</div>` : ''}</div>`;
    }
    if (S.mode === 'online') {
      const others = [];
      for (let i = 0; i < cs.n; i++) if (i !== S.user) others.push(i);
      body = `
        <div class="card"><h3>Aula</h3><div class="chat" id="chat"></div>
          <form class="row" id="sayForm"><input type="text" id="sayIn" maxlength="160" placeholder="Scrivi agli altri…" autocomplete="off"/><button class="small" type="submit">Invia</button></form></div>
        <div class="card"><h3>Le tue puntine</h3><div id="pinList">${pinsHtml(true)}</div></div>
        <div class="card"><h3>Accusa (${2 - S.accusations} rimaste)</h3><div class="chips">${others.map((i) => `<button class="small" data-act="accuse" data-k="${i}" ${S.accusations >= 2 ? 'disabled' : ''}>${swatch(i)} ${esc(nameOf(i))}</button>`).join('')}</div></div>`;
      setSide(`<h2>⚖️ Processo</h2>${body}${netNextButton('Al voto →')}`);
      const el = $('#chat');
      if (el) { el.dataset.count = 0; }
      renderChat();
      return;
    }
    setSide(`<h2>⚖️ Processo</h2>${body}<button class="primary" data-act="startVote">Al voto →</button>`);
    renderChat();
  }

  function matchClue(pin) {
    const lenient = ['timestamp', 'glitch', 'missing', 'duplicate', 'jewel-alone', 'jewel-back', 'jewel-glitch'];
    let best = null;
    let bd = Infinity;
    for (const c of S.clues) {
      if (c.cam !== pin.cam && c.type !== 'missing') continue;
      const t2 = c.t2 != null ? c.t2 : c.t;
      if (pin.t < c.t - 1.5 || pin.t > t2 + 1.5) continue;
      const dist = Math.hypot(pin.lx - c.lx, pin.ly - c.ly);
      if (dist > 70 && !lenient.includes(c.type)) continue;
      const score = Math.abs(pin.t - c.t) + dist / 100;
      if (score < bd) { bd = score; best = c; }
    }
    return best;
  }

  function presentPin(k) {
    const p = S.pins[k];
    if (!p || p.presented) return;
    p.presented = true;
    if (S.mode === 'online') {
      const mark = { cam: p.cam, lx: p.lx, ly: p.ly, t: p.t };
      const text = `Guardate qui: CAM 0${p.cam + 1} alle ${IA.clockText(p.t)}!`;
      speak(S.user, text, mark, true);
      netSend('say', { text, mark });
      S.t = p.t;
      const pl = $('#pinList');
      if (pl) pl.innerHTML = pinsHtml(true);
      return;
    }
    speak(S.user, `Guardate qui: CAM 0${p.cam + 1} alle ${IA.clockText(p.t)}!`, { cam: p.cam, lx: p.lx, ly: p.ly, t: p.t }, true);
    S.t = p.t;
    const c = matchClue(p);
    const responders = S.bots.filter((b) => b.idx !== S.cs.culprit);
    setTimeout(() => {
      if (c) {
        p.match = true;
        responders.forEach((b) => b.noticed.add(c.id));
        const r = S.rng.pick(responders);
        if (r) speak(r.idx, `Hai ragione! ${c.text}`, c);
        if (c.points[S.cs.culprit] > 0 && S.mode === 'detective') {
          setTimeout(() => speak(S.cs.culprit, S.rng.pick(['Ma dai, sarà un errore della telecamera…', 'Non significa niente!', 'State esagerando, è solo un video sgranato.'])), 1400);
        }
      } else {
        p.match = false;
        const r = S.rng.pick(responders);
        if (r) speak(r.idx, S.rng.pick(['Io lì non vedo niente di strano.', 'Mmm, mi sembra tutto normale in quel punto.', 'Non mi convince, guarda meglio.']));
      }
      const pl = $('#pinList');
      if (pl) pl.innerHTML = pinsHtml(true);
    }, 900);
    const pl = $('#pinList');
    if (pl) pl.innerHTML = pinsHtml(true);
  }

  function accuse(target) {
    if (S.accusations >= 2) return;
    S.accusations++;
    if (S.mode === 'online') {
      const text = `Io accuso ${nameOf(target)}!`;
      speak(S.user, text, null, true);
      netSend('say', { text });
      renderTrialSide();
      return;
    }
    speak(S.user, S.rng.pick([`Secondo me è stato ${nameOf(target)}!`, `Guardate bene ${nameOf(target)}: troppe coincidenze.`, `Io accuso ${nameOf(target)}!`]), null, true);
    persuade(target, S.mode === 'culprit' ? 1.6 : 1.2, S.mode === 'culprit');
    setTimeout(() => {
      const responders = S.bots.filter((b) => b.idx !== S.cs.culprit && b.idx !== target);
      const r = S.rng.pick(responders);
      if (r) {
        const sc = IA.botScores(S.cs, S.clues, r);
        let top = 0;
        sc.forEach((v, i) => { if (i !== r.idx && v > sc[top]) top = i; });
        speak(r.idx, top === target ? `Sono d'accordo, ${nameOf(target)} non me la racconta giusta.` : `Io invece guarderei ${nameOf(top)}…`);
      }
      if (target !== S.cs.culprit || S.mode === 'culprit') speak(target, S.rng.pick(['Io? Ma siete matti!', 'Non c\'entro niente, controllate i filmati!', 'Questa è una calunnia!']));
      else if (S.mode === 'detective') speak(target, S.rng.pick(['Assurdo! Io ero dall\'altra parte della villa!', 'Prove? Non avete prove!']));
    }, 800);
    renderTrialSide();
  }

  function quickSay(kind) {
    const cs = S.cs;
    if (kind === 'glitch') {
      speak(S.user, 'Quel disturbo è solo un guasto tecnico, la villa è vecchia!', null, true);
      setTimeout(() => {
        const r = S.rng.pick(S.bots);
        speak(r.idx, 'I glitch non sono mai casuali. Lo sanno tutti.');
        S.bots.forEach((b) => { if ([...b.noticed].some((id) => (S.clues.find((c) => c.id === id) || {}).type === 'glitch')) b.bias[cs.culprit] = (b.bias[cs.culprit] || 0) + 0.4; });
      }, 900);
    } else {
      const room = ROOMS[cs.culpritStart].name;
      speak(S.user, `Io ero in ${room}, guardate la CAM 0${cs.culpritStart + 1}!`, null, true);
      setTimeout(() => {
        const miss = S.clues.find((c) => c.type === 'missing' && c.who === cs.culprit);
        const doubter = miss && S.bots.find((b) => b.noticed.has(miss.id));
        if (doubter) { speak(doubter.idx, `Ma tra le ${IA.clockText(miss.t)} e le ${IA.clockText(miss.t2)} non ti vedo da nessuna parte!`, miss); doubter.bias[cs.culprit] = (doubter.bias[cs.culprit] || 0) + 1; }
        else { const r = S.rng.pick(S.bots); speak(r.idx, 'Mmm, può darsi…'); S.bots.forEach((b) => (b.bias[cs.culprit] = (b.bias[cs.culprit] || 0) - 0.4)); }
      }, 900);
    }
  }

  // ---------------------------------------------------------------------------
  // Fase 4 — Voto
  // ---------------------------------------------------------------------------
  function startVote() {
    setPhase('vote');
    S.deadline = null;
    S.schedule = [];
    S.playing = false;
    S.runoff = null;
    hint('');
    S.votes = new Array(S.cs.n).fill(-1);
    if (S.mode === 'online') return onlineVote();
    if (S.mode === 'party') partyVote(0);
    else soloVote();
  }

  function voteGrid(voter, act) {
    const cs = S.cs;
    const cands = S.phase === 'runoff' && S.runoff ? S.runoff : null;
    return `<div class="vote-grid">${cs.names.map((n, i) => (i === voter || (cands && !cands.includes(i)) ? '' : `<button data-act="${act}" data-k="${i}"><span class="swatch" style="background:${colorOf(i)};width:22px;height:22px"></span><b>${esc(S.initials[i])}</b>${esc(label(i))}</button>`)).join('')}</div>`;
  }
  function runoffNote() {
    return S.phase === 'runoff' ? `<p class="center"><b>Ballottaggio</b> fra ${S.runoff.map((i) => who(i)).join(' e ')}.</p>` : '';
  }

  function partyVote(k) {
    if (k >= S.cs.n) return revealVotes();
    S.voter = k;
    openModal(`
      <h2 class="center">🗳 Voto segreto di <span style="color:${colorOf(k)}">${esc(nameOf(k))}</span></h2>
      ${runoffNote()}
      <p class="center muted">Gli altri non guardano. Chi è il Colpevole?</p>
      ${voteGrid(k, 'pvote')}
    `);
  }

  function soloVote() {
    openModal(`
      <h2 class="center">🗳 Il tuo voto</h2>
      ${runoffNote()}
      <p class="center muted">${S.mode === 'culprit' ? 'Sei il Colpevole: vota un innocente per confondere la giuria.' : 'Chi ha rubato il gioiello?'}</p>
      ${voteGrid(S.user, 'svote')}
    `);
  }

  function onlineVote() {
    openModal(`
      <h2 class="center">🗳 Il tuo voto</h2>
      ${runoffNote()}
      <p class="center muted">${isOnlineCulprit() ? 'Sei il Colpevole: vota un innocente per confondere la giuria.' : 'Chi ha rubato il gioiello?'}</p>
      ${voteGrid(S.user, 'nvote')}
      <p class="center muted" id="voteStatus"></p>
      ${S.net && S.net.isHost ? '<button data-act="netNext">Chiudi il voto adesso</button>' : ''}
    `);
  }

  function botVotes() {
    const cs = S.cs;
    const cons = consensusArr();
    const cands = S.phase === 'runoff' ? S.runoff : undefined;
    for (const b of S.bots) {
      S.votes[b.idx] = IA.botVote(cs, S.clues, b, S.rng, b.idx === cs.culprit, b.idx === cs.culprit ? cons : null, cands);
    }
  }

  /** Voto del pubblico (modalità streamer): la maggioranza della chat vale 1 voto di giuria. */
  function audienceVote() {
    if (!S.stream.on) return { target: -1, count: 0 };
    const counts = {};
    let total = 0;
    for (const u in S.stream.votes) {
      const v = S.stream.votes[u];
      if (S.phase === 'runoff' && S.runoff && !S.runoff.includes(v)) continue;
      counts[v] = (counts[v] || 0) + 1;
      total++;
    }
    let best = -1;
    let bv = 0;
    let tie = false;
    for (const k in counts) { if (counts[k] > bv) { bv = counts[k]; best = Number(k); tie = false; } else if (counts[k] === bv) tie = true; }
    return { target: tie ? -1 : best, count: total, counts };
  }

  function revealVotes(online) {
    const cs = S.cs;
    const n = cs.n;
    const tally = new Array(n).fill(0);
    S.votes.forEach((v) => { if (v >= 0) tally[v]++; });
    const lines = S.votes.map((v, i) => (v >= 0 ? `<div class="item">${swatch(i)}<span class="grow">${esc(label(i))}</span><span class="tag">→ ${esc(label(v))}</span></div>` : ''));
    const aud = online ? { target: -1 } : audienceVote();
    if (aud.target >= 0) {
      tally[aud.target]++;
      lines.push(`<div class="item"><span class="swatch" style="background:#9146ff"></span><span class="grow">📺 Pubblico (${aud.count} voti in chat)</span><span class="tag">→ ${esc(label(aud.target))}</span></div>`);
    }
    const audNote = !online && S.stream.on && aud.target < 0 && aud.count ? `<p class="center muted">📺 Pubblico: ${aud.count} voti in chat ma in parità, voto nullo.</p>` : '';
    const r = online ? online.r : IA.tallyResult(tally);
    const wasRunoff = S.phase === 'runoff';
    let goOvertime = false;
    if (r.tied && !wasRunoff) { goOvertime = true; S.verdict = null; }
    else {
      S.verdict = { tally, convicted: r.tied ? -1 : r.convicted, runoff: wasRunoff };
      S.verdict.caught = S.verdict.convicted === cs.culprit;
    }
    const counts = new Array(n).fill(0);
    const totalVotes = lines.filter(Boolean).length;
    const bars = () => counts.map((v, i) => `<div class="row"><label>${swatch(i)} ${esc(label(i))}</label><div><div class="bar" style="width:${(v / Math.max(1, totalVotes)) * 100}%;background:${colorOf(i)}">${v}</div></div></div>`).join('');
    const btn = goOvertime
      ? (online ? '<p class="center"><b>⚖️ Pareggio!</b> Tempi supplementari in arrivo…</p>' : `<button class="primary" data-act="overtime" id="btnVerdict" disabled>⏱ Pareggio! Tempi supplementari →</button>`)
      : `<button class="primary" data-act="verdict" id="btnVerdict" disabled>${online ? 'Attendi il verdetto…' : 'Verdetto →'}</button>`;
    openModal(`
      <h2 class="center">🗳 ${wasRunoff ? 'Ballottaggio' : 'Voti'}</h2>
      <div class="list" id="voteLines"></div>
      <div class="tally" id="tally">${bars()}</div>
      ${audNote}
      ${btn}
    `);
    S.pendingOvertime = goOvertime ? r.top : null;
    const votesAll = S.votes.map((v, i) => ({ v, line: lines[i] })).filter((x) => x.line);
    if (aud.target >= 0) votesAll.push({ v: aud.target, line: lines[lines.length - 1] });
    // rivelazione voto per voto
    votesAll.forEach((x, i) => setTimeout(() => {
      const vl = $('#voteLines');
      const tb = $('#tally');
      if (!vl || !tb) return;
      vl.insertAdjacentHTML('beforeend', x.line);
      if (x.v >= 0) counts[x.v]++;
      tb.innerHTML = bars();
      beep(300 + i * 70, 0.08, 'square', 0.04);
      if (i === votesAll.length - 1) {
        S.votesShown = true;
        const b = $('#btnVerdict');
        if (b && (!online || S.revealed)) { b.disabled = false; if (online) b.textContent = 'Verdetto →'; }
        beep(200, 0.25, 'sawtooth', 0.05);
      }
    }, 350 * (i + 1)));
    if (!votesAll.length) { S.votesShown = true; const b = $('#btnVerdict'); if (b && (!online || S.revealed)) b.disabled = false; }
  }

  // ---------------------------------------------------------------------------
  // Pareggio → tempi supplementari (solo i sospettati più votati parlano) → ballottaggio
  // ---------------------------------------------------------------------------
  function startOvertime(cands) {
    closeModal();
    setPhase('overtime');
    S.runoff = cands;
    S.otStart = now();
    S.otTurn = -1;
    S.pleaUsed = false;
    S.playing = true;
    S.schedule = [];
    S.stream.votes = {};
    if (S.mode !== 'online') setTimer(CONFIG.phases.overtime);
    if (S.mode === 'detective' || S.mode === 'culprit') buildPleas(cands);
    renderOvertimeSide();
    hint(`Tempi supplementari: parlano solo ${cands.map((i) => nameOf(i)).join(' e ')}`);
    beep(660, 0.12, 'square', 0.05); setTimeout(() => beep(880, 0.2, 'square', 0.05), 150);
  }

  function otTurnLen() { return (CONFIG.phases.overtime * (S.timerMul || 1)) / S.runoff.length; }
  function renderOvertimeSide() {
    const cands = S.runoff;
    const userIsCand = cands.includes(S.user);
    const turnInfo = cands.map((i, k) => `<div class="item ot-turn" data-turn="${k}">${swatch(i)}<span class="grow">${esc(label(i))}</span><span class="tag">${Math.round(otTurnLen())} s</span></div>`).join('');
    let body = '';
    if (S.mode === 'party') body = `<p>Solo i sospettati parlano: <b>arringa finale</b> di ${Math.round(otTurnLen())} secondi ciascuno, nell'ordine. Tutti gli altri in silenzio!</p>`;
    else if (S.mode === 'online') body = `<div class="card"><h3>Aula</h3><div class="chat" id="chat"></div>${userIsCand ? '<form class="row" id="sayForm"><input type="text" id="sayIn" maxlength="160" placeholder="La tua arringa finale…" autocomplete="off"/><button class="small" type="submit">Invia</button></form>' : '<p class="muted">Ascolta le arringhe: la chat è riservata ai sospettati.</p>'}</div>`;
    else body = `<div class="card"><h3>Aula</h3><div class="chat" id="chat"></div></div>${userIsCand ? `<div class="card"><h3>La tua arringa</h3><div class="chips">
        <button class="small" data-act="plea" data-k="clue">«Riguardate gli indizi!»</button>
        <button class="small" data-act="plea" data-k="alibi">«Ho un alibi!»</button>
        <button class="small" data-act="plea" data-k="other">«È stato l'altro!»</button></div></div>` : ''}`;
    setSide(`<h2>⏱ Tempi supplementari</h2>
      <div class="card"><h3>Arringhe finali</h3><div class="list">${turnInfo}</div></div>
      ${body}
      ${S.mode === 'online' ? netNextButton('Al ballottaggio →') : '<button class="primary" data-act="startRunoff">Al ballottaggio →</button>'}`);
    renderChat();
    updateOtTurn(true);
  }
  function updateOtTurn(force) {
    if (S.phase !== 'overtime' || !S.runoff) return;
    const k = Math.min(S.runoff.length - 1, Math.floor((now() - S.otStart) / otTurnLen()));
    if (k === S.otTurn && !force) return;
    if (k !== S.otTurn && !force) beep(520, 0.1, 'triangle');
    S.otTurn = k;
    document.querySelectorAll('.ot-turn').forEach((el) => el.classList.toggle('speaking', Number(el.dataset.turn) === k));
  }

  function buildPleas(cands) {
    const cs = S.cs;
    const turn = otTurnLen();
    cands.forEach((c, k) => {
      if (c === S.user) return;
      const base = k * turn + 1;
      const other = cands.find((x) => x !== c);
      let lines;
      if (c === cs.culprit) {
        lines = [`Ascoltatemi: io ero in ${ROOMS[cs.culpritStart].name}, i filmati lo dimostrano.`, `Avete visto anche voi quanto è strano il comportamento di ${nameOf(other)}. Non fatevi ingannare!`];
      } else {
        const strong = S.clues.filter((cl) => (cl.points[cs.culprit] || 0) > 0).sort((a, b) => b.points[cs.culprit] * b.notice - a.points[cs.culprit] * a.notice)[0];
        lines = ['Sono innocente, ve lo giuro.', strong ? `Riguardate questo: ${strong.text}` : `Non ho prove, ma ${nameOf(other)} non mi convince.`];
      }
      lines.forEach((text, j) => S.schedule.push({ bot: c, text, at: base + j * Math.max(2, turn * 0.4), clue: j === 1 && c !== cs.culprit ? S.clues.filter((cl) => (cl.points[cs.culprit] || 0) > 0).sort((a, b) => b.points[cs.culprit] * b.notice - a.points[cs.culprit] * a.notice)[0] : null, plea: c }));
    });
    S.schedule.sort((a, b) => a.at - b.at);
    S.trialStart = S.otStart;
  }

  function userPlea(kind) {
    if (!S.runoff || !S.runoff.includes(S.user) || S.pleaUsed) return;
    S.pleaUsed = true;
    const cs = S.cs;
    const other = S.runoff.find((x) => x !== S.user);
    if (kind === 'clue') {
      const strong = S.mode === 'detective' ? S.clues.filter((cl) => (cl.points[other] || 0) > 0)[0] : null;
      speak(S.user, strong ? `Riguardate: ${strong.text}` : 'Riguardate gli indizi con calma, non ho niente da nascondere!', strong, true);
      if (strong) persuade(other, 1.4, false);
    } else if (kind === 'alibi') {
      speak(S.user, 'Io non sono mai entrato nello Studio, controllate tutte le camere!', null, true);
      S.bots.forEach((b) => { if (b.idx !== cs.culprit) b.bias[S.user] = (b.bias[S.user] || 0) - 0.5; });
    } else {
      speak(S.user, `Pensateci: è stato ${nameOf(other)}, è evidente!`, null, true);
      persuade(other, S.mode === 'culprit' ? 1.3 : 1.0, S.mode === 'culprit');
    }
    document.querySelectorAll('[data-act="plea"]').forEach((b) => (b.disabled = true));
  }

  function startRunoff() {
    setPhase('runoff');
    S.deadline = null;
    S.schedule = [];
    S.playing = false;
    hint('');
    S.votes = new Array(S.cs.n).fill(-1);
    if (S.mode === 'online') return onlineVote();
    if (S.mode === 'party') partyVote(0);
    else soloVote();
  }

  // ---------------------------------------------------------------------------
  // Fase 5 — Verdetto, espulsione comica o Replay Reale
  // ---------------------------------------------------------------------------
  function verdict() {
    closeModal();
    setPhase('verdict');
    const cs = S.cs;
    const v = S.verdict;
    if (S.mode === 'party') {
      S.votes.forEach((vote, i) => { if (i !== cs.culprit && vote === cs.culprit) S.scores[nameOf(i)] += 1; });
      if (!v.caught) S.scores[nameOf(cs.culprit)] += 3;
    }
    if (v.caught) {
      S.anim = { type: 'expel', start: now(), dur: 4.5 };
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'square', 0.05), 900 + i * 140));
      setSide(`<h2>⚖️ Verdetto</h2><p>La giuria ha deciso…</p>`);
    } else {
      [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'sawtooth', 0.05), i * 260));
      startReplay(true);
    }
  }

  function startReplay(dramatic) {
    S.anim = null;
    setPhase('replay');
    S.replayEdited = false;
    R.focus = null;
    S.t = dramatic ? Math.max(0, S.cwin ? S.cwin.tin - 3 : IA.culpritWindow(S.cs).tin - 3) : 0;
    if (!S.cwin) S.cwin = IA.culpritWindow(S.cs);
    S.playing = true;
    S.speed = 1;
    syncSpeed();
    renderResultSide();
    hint('Replay Reale: il colpevole è cerchiato in rosso, i pezzi manomessi hanno la cornice tratteggiata');
  }

  function editsSummary() {
    const e = S.edits;
    const out = [];
    if (e.splice) out.push(`✂ Taglio su CAM 0${e.splice.cam + 1} (${ROOMS[e.splice.cam].name}): ${IA.clockText(e.splice.t0).slice(3)}–${IA.clockText(e.splice.t0 + e.splice.len).slice(3)} sostituito con ${IA.clockText(e.splice.src0).slice(3)}–${IA.clockText(e.splice.src0 + e.splice.len).slice(3)}`);
    if (e.glitch) out.push(`▲ Disturbo su CAM 0${e.glitch.cam + 1} (${ROOMS[e.glitch.cam].name}) da ${IA.clockText(e.glitch.t0).slice(3)} per ${e.glitch.len.toFixed(1)} s`);
    if (e.deepfake) out.push(`🎭 Deepfake: per ${CONFIG.deepfake.len} s alle ${IA.clockText(e.deepfake.t).slice(3)} sembrava ${esc(nameOf(e.deepfake.victim))} — tradito ${e.deepfake.weak === 'shadow' ? "dall'ombra" : "dall'oggetto in mano"}`);
    if (!out.length) out.push('Nessuna manipolazione: filmato originale!');
    return out.map((s) => `<div class="item">${s}</div>`).join('');
  }

  function renderResultSide() {
    const cs = S.cs;
    const v = S.verdict;
    let head;
    if (!v) head = '<h2>🎞 Replay</h2>';
    else if (v.caught) head = `<h2 class="ok">✔ Colpevole smascherato!</h2><p>${who(cs.culprit)} è stato espulso dalla villa.</p>`;
    else if (v.convicted >= 0) head = `<h2 class="bad">✘ Condannato un innocente!</h2><p>${who(v.convicted)} è stato accusato ingiustamente. Il vero colpevole era ${who(cs.culprit)}.</p>`;
    else head = `<h2 class="bad">✘ Giuria divisa!</h2><p>${v.runoff ? 'Pari anche al ballottaggio' : 'Nessuna maggioranza'}: ${who(cs.culprit)} la fa franca.</p>`;
    if (v && v.runoff && v.convicted >= 0) head += '<p class="muted">Deciso al ballottaggio dopo i tempi supplementari.</p>';
    const meCul = S.mode === 'culprit' || (S.mode === 'online' && S.user === cs.culprit);
    const userLine = meCul ? (v && !v.caught ? '<p class="ok"><b>Hai vinto: il bluff ha funzionato.</b></p>' : '<p class="bad"><b>Ti hanno scoperto.</b></p>')
      : S.mode === 'detective' || S.mode === 'online' ? (v && v.caught ? '<p class="ok"><b>Giustizia è fatta.</b></p>' : '<p class="bad"><b>Il ladro è scappato col gioiello.</b></p>') : '';
    const clueItems = S.clues.filter((c) => c.type !== 'presence' || c.who === cs.culprit).map((c) => {
      const by = S.bots.filter((b) => b.noticed.has(c.id) && b.idx !== cs.culprit).map((b) => S.initials[b.idx]).join(' ');
      return `<div class="item"><span>${ICONS[c.type] || '•'}</span><span class="grow">${esc(c.text)}${S.mode !== 'party' ? `<br/><span class="muted">${by ? 'Notato da: ' + by : 'Nessuno l\'ha notato'}</span>` : ''}</span><button class="small" data-act="seekEdited" data-t="${c.t}">vedi</button></div>`;
    }).join('');
    const scores = S.mode === 'party' || S.mode === 'online' ? `<div class="card"><h3>Classifica</h3><div class="list">${Object.entries(S.scores).sort((a, b) => b[1] - a[1]).map(([n, s]) => `<div class="item"><span class="grow">${esc(n)}</span><span class="tag">${s} pt</span></div>`).join('')}</div><p class="muted">+1 a chi vota il Colpevole · +3 al Colpevole se la fa franca</p></div>` : '';
    setSide(`
      ${head}${userLine}
      <div class="row"><button class="${S.replayEdited ? '' : 'on'}" data-act="replayReal">🎞 Replay Reale</button><button class="${S.replayEdited ? 'on' : ''}" data-act="replayEdited">📼 Versione truccata</button></div>
      <div class="card"><h3>Cosa ha fatto il Colpevole</h3><div class="list">${editsSummary()}</div></div>
      <div class="card"><h3>I micro-indizi che c'erano</h3><div class="list">${clueItems || '<p class="muted">Nessuno.</p>'}</div></div>
      ${scores}
      <div class="row"><button data-act="vclip">📱 Clip verticale 9:16</button></div>
      ${S.mode === 'online'
        ? (S.net && S.net.isHost ? '<div class="row"><button class="primary" data-act="netAgain">Nuova partita nella stanza</button><button data-act="menu">Esci</button></div>' : '<p class="muted">In attesa che l\'host avvii una nuova partita…</p><div class="row"><button data-act="menu">Esci</button></div>')
        : '<div class="row"><button class="primary" data-act="again">Nuovo caso</button><button data-act="menu">Menu</button></div>'}
      <p class="muted center">Caso n° ${S.seed}</p>
    `);
  }

  // ---------------------------------------------------------------------------
  // Timeline e trasporto
  // ---------------------------------------------------------------------------
  function drawTimeline() {
    const rect = tl.getBoundingClientRect();
    const W = Math.max(100, Math.round(rect.width * devicePixelRatio));
    const Hh = Math.round(54 * devicePixelRatio);
    if (tl.width !== W || tl.height !== Hh) { tl.width = W; tl.height = Hh; }
    const c = tlx;
    const dpr = devicePixelRatio;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = W / dpr;
    const pad = 8;
    const X = (t) => pad + (t / D) * (w - pad * 2);
    c.clearRect(0, 0, w, 54);
    c.fillStyle = '#0b1016';
    c.fillRect(0, 0, w, 54);
    const showEdits = S.phase === 'edit' || S.phase === 'replay';
    // riga "TU" nel montaggio: in che stanza si trova davvero il colpevole
    if (S.phase === 'edit' && S.cs && (S.mode === 'culprit' || S.mode === 'party')) {
      for (let t = 0; t < D; t += 0.2) {
        const p = IA.charPos(S.cs, S.cs.culprit, t);
        c.fillStyle = ROOM_COLORS[IA.roomAt(p.x, p.y)];
        c.fillRect(X(t), 30, X(t + 0.2) - X(t) + 0.5, 8);
      }
      c.fillStyle = '#9fb0c2';
      c.font = '9px sans-serif';
      c.fillText('TU', 1, 37);
      const ped = X(S.cs.Tc);
      c.strokeStyle = '#fff';
      c.strokeRect(ped, 29, X(S.cs.Tc + CONFIG.crimeLen) - ped, 10);
    }
    if (showEdits && S.edits) {
      const e = S.edits;
      if (e.splice) {
        c.fillStyle = 'rgba(255,183,3,0.55)';
        c.fillRect(X(e.splice.t0), 6, X(e.splice.t0 + e.splice.len) - X(e.splice.t0), 18);
        c.strokeStyle = 'rgba(255,183,3,0.9)';
        c.setLineDash([3, 3]);
        c.strokeRect(X(e.splice.src0), 8, X(e.splice.src0 + e.splice.len) - X(e.splice.src0), 14);
        c.setLineDash([]);
      }
      if (e.glitch) {
        c.fillStyle = 'rgba(255,59,59,0.6)';
        c.fillRect(X(e.glitch.t0), 6, X(e.glitch.t0 + e.glitch.len) - X(e.glitch.t0), 18);
      }
      if (e.deepfake) {
        c.fillStyle = 'rgba(177,151,252,0.9)';
        c.fillRect(X(e.deepfake.t), 4, Math.max(3, X(e.deepfake.t + CONFIG.deepfake.len) - X(e.deepfake.t)), 22);
      }
    }
    // tacche
    c.fillStyle = '#5c6b7c';
    c.font = '10px "Courier New", monospace';
    for (let s = 0; s <= D; s++) {
      const x = X(s);
      c.fillRect(x, s % 5 === 0 ? 40 : 45, 1, s % 5 === 0 ? 10 : 5);
      if (s % 5 === 0) c.fillText(':' + String(s).padStart(2, '0'), x + 2, 52);
    }
    // puntine
    S.pins.forEach((p, i) => {
      c.fillStyle = p.color || '#ffb703';
      c.beginPath(); c.arc(X(p.t), 14, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000';
      c.font = 'bold 8px sans-serif';
      c.fillText(String(i + 1), X(p.t) - 2.5, 17);
    });
    // playhead
    c.fillStyle = '#fff';
    c.fillRect(X(S.t) - 1, 0, 2, 54);
  }

  function seekFromTimeline(ev) {
    const rect = tl.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    S.t = clamp(((x - 8) / (rect.width - 16)) * D, 0, D);
  }
  let tlDrag = false;
  tl.addEventListener('pointerdown', (ev) => { tlDrag = true; tl.setPointerCapture(ev.pointerId); seekFromTimeline(ev); });
  tl.addEventListener('pointermove', (ev) => { if (tlDrag) seekFromTimeline(ev); });
  tl.addEventListener('pointerup', () => { tlDrag = false; });

  function syncSpeed() {
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === S.speed));
  }
  document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = Number(b.dataset.speed); syncSpeed(); }));
  $('#btnPlay').addEventListener('click', () => { S.playing = !S.playing; });
  $('#btnBack').addEventListener('click', () => { S.playing = false; S.t = clamp(S.t - 0.1, 0, D); });
  $('#btnFwd').addEventListener('click', () => { S.playing = false; S.t = clamp(S.t + 0.1, 0, D); });

  // ---------------------------------------------------------------------------
  // Input sul canvas: puntine, selezione camera, laser, zoom
  // ---------------------------------------------------------------------------
  function canvasPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - rect.left) / rect.width) * IA.Renderer.W, y: ((ev.clientY - rect.top) / rect.height) * IA.Renderer.H };
  }
  let clickTimer = null;
  let laserDown = false;
  canvas.addEventListener('pointerdown', (ev) => {
    if (S.phase === 'trial' || S.phase === 'overtime') {
      laserDown = true;
      canvas.setPointerCapture(ev.pointerId);
      const p = canvasPoint(ev);
      const L = currentLaser();
      L.points.push({ x: p.x, y: p.y, t: now(), brk: true });
      netLaser(p, true);
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!laserDown) return;
    const p = canvasPoint(ev);
    currentLaser().points.push({ x: p.x, y: p.y, t: now() });
    netLaser(p, false);
  });
  let lastLaserSent = 0;
  function netLaser(p, start) {
    if (S.mode !== 'online') return;
    const tn = now();
    if (!start && tn - lastLaserSent < 0.04) return;
    lastLaserSent = tn;
    const hit = R.hit(p.x, p.y);
    if (hit) netSend('laser', { cam: hit.cam, lx: hit.lx, ly: hit.ly, t: S.t, start });
  }
  canvas.addEventListener('pointerup', () => { laserDown = false; });
  function currentLaser() {
    const idx = S.mode === 'party' ? S.laserColor : Math.max(0, S.user);
    let L = S.lasers.find((l) => l.idx === idx);
    if (!L) { L = { idx, color: colorOf(idx), points: [] }; S.lasers.push(L); }
    if (L.points.length > 400) L.points.splice(0, 200);
    return L;
  }
  canvas.addEventListener('click', (ev) => {
    const p = canvasPoint(ev);
    const hit = R.hit(p.x, p.y);
    if (!hit) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      if (S.phase === 'evidence') addPin(hit);
      else if (S.phase === 'edit' && S.ed && S.tool !== 'deepfake') {
        S.ed[S.tool].cam = hit.cam;
        S.ed[S.tool].on = true;
        draftToEdits();
        renderEditSide();
      }
    }, 230);
  });
  canvas.addEventListener('dblclick', (ev) => {
    clearTimeout(clickTimer);
    const p = canvasPoint(ev);
    const hit = R.hit(p.x, p.y);
    R.focus = R.focus === null && hit ? hit.cam : null;
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT')) return;
    if (ev.code === 'Space') { ev.preventDefault(); S.playing = !S.playing; }
    else if (ev.key === 'ArrowLeft' || ev.key === ',') { S.playing = false; S.t = clamp(S.t - 0.1, 0, D); }
    else if (ev.key === 'ArrowRight' || ev.key === '.') { S.playing = false; S.t = clamp(S.t + 0.1, 0, D); }
    else if (ev.key === 'Escape') { R.focus = null; }
    else if (/^[1-6]$/.test(ev.key) && S.phase === 'trial' && S.mode === 'party') {
      const k = Number(ev.key) - 1;
      if (k < S.cs.n) { S.laserColor = k; renderTrialSide(); }
    }
  });

  // ---------------------------------------------------------------------------
  // Azioni (delegazione)
  // ---------------------------------------------------------------------------
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const act = el.dataset.act;
    const k = el.dataset.k != null ? (isNaN(Number(el.dataset.k)) ? el.dataset.k : Number(el.dataset.k)) : null;
    switch (act) {
      case 'mode':
        readMenuOptions();
        S.mode = el.dataset.mode;
        if (S.mode === 'party') showPartySetup();
        else if (S.mode === 'online') showOnlineMenu();
        else { closeModal(); newCase(); if (S.mode === 'culprit') soloCulpritIntro(); else aiEditIntro(); }
        break;
      case 'menu': netLeave(); showMenu(); break;
      case 'addName': readNames(); if (S.names.length < 6) S.names.push(`Giocatore ${S.names.length + 1}`); showPartySetup(); break;
      case 'delName': readNames(); if (S.names.length > 3) S.names.pop(); showPartySetup(); break;
      case 'partyGo': readNames(); newCase(); partyRoles(0); break;
      case 'reveal': partyReveal(k); break;
      case 'nextRole': partyRoles(k); break;
      case 'startEdit': startEdit(); break;
      case 'tool': S.tool = el.dataset.tool; renderEditSide(); break;
      case 'ph': {
        const [a, b] = String(k).split('.');
        S.ed[a][b] = r1(S.t);
        S.ed[a].on = true;
        draftToEdits();
        renderEditSide();
        break;
      }
      case 'preview': {
        const e = S.ed[k];
        e.on = true;
        draftToEdits();
        S.showOriginal = false;
        S.t = clamp((k === 'deepfake' ? e.t : e.t0) - 1, 0, D);
        if (k !== 'deepfake') R.focus = null;
        S.playing = true;
        renderEditSide();
        break;
      }
      case 'finishEdit': finishEdit(); break;
      case 'startEvidence': startEvidence(); break;
      case 'startTrial': startTrial(); break;
      case 'unpin': S.pins.splice(k, 1); { const pl = $('#pinList'); if (pl) pl.innerHTML = pinsHtml(false); } break;
      case 'seek': S.t = clamp(Number(el.dataset.t), 0, D); S.playing = false; break;
      case 'present': presentPin(k); break;
      case 'accuse': accuse(k); break;
      case 'say': quickSay(k); break;
      case 'laser': S.laserColor = k; renderTrialSide(); break;
      case 'startVote': startVote(); break;
      case 'pvote': S.votes[S.voter] = k; beep(600, 0.05); partyVote(S.voter + 1); break;
      case 'svote': S.votes[S.user] = k; botVotes(); revealVotes(); break;
      case 'nvote': netSend('vote', { target: k }); document.querySelectorAll('[data-act="nvote"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.k) === k)); { const vs = $('#voteStatus'); if (vs) vs.textContent = 'Voto inviato. Puoi ancora cambiarlo finché tutti non hanno votato.'; } break;
      case 'overtime': if (S.pendingOvertime) startOvertime(S.pendingOvertime); break;
      case 'startRunoff': startRunoff(); break;
      case 'plea': userPlea(k); break;
      case 'lens': useLens(); break;
      case 'vclip': makeVClip(); break;
      case 'vclipCancel': if (S.vclip) S.vclip.cancel(); S.vclip = null; closeModal(); break;
      case 'streamSetup': showStreamSetup(); break;
      case 'streamConnect': streamConnect(); break;
      case 'streamOff': streamOff(); break;
      case 'netCreate': netConnect(() => netSend('create', { name: readNetName() })); break;
      case 'netJoin': netConnect(() => netSend('join', { code: ($('#netCode').value || '').toUpperCase(), name: readNetName(), id: netSavedId(($('#netCode').value || '').toUpperCase()) })); break;
      case 'netStart': netSend('start'); break;
      case 'netNext': netSend('next'); break;
      case 'netAgain': netSend('start'); break;
      case 'verdict': verdict(); break;
      case 'replayReal': S.replayEdited = false; renderResultSide(); break;
      case 'replayEdited': S.replayEdited = true; renderResultSide(); break;
      case 'seekEdited': S.replayEdited = true; S.t = clamp(Number(el.dataset.t) - 0.5, 0, D); S.playing = false; renderResultSide(); break;
      case 'again':
        if (S.mode === 'online') { netSend('start'); break; }
        newCase();
        if (S.mode === 'party') partyRoles(0);
        else if (S.mode === 'culprit') soloCulpritIntro();
        else aiEditIntro();
        break;
      case 'closeModal': closeModal(); break;
    }
  });

  side.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.act === 'orig') { S.showOriginal = el.checked; return; }
    if (el.dataset.act === 'filter') { S.filter = el.checked; return; }
    const key = el.dataset.ed;
    if (!key || !S.ed) return;
    const [a, b] = key.split('.');
    if (el.type === 'checkbox') S.ed[a][b] = el.checked;
    else if (el.tagName === 'SELECT') { S.ed[a][b] = b === 'weak' ? el.value : Number(el.value); S.ed[a].on = true; const cb = side.querySelector(`[data-ed="${a}.on"]`); if (cb) cb.checked = true; }
    else { S.ed[a][b] = Number(el.value); S.ed[a].on = true; const cb = side.querySelector(`[data-ed="${a}.on"]`); if (cb) cb.checked = true; }
    draftToEdits();
    updateEditLabels();
    if (b === 't0' || b === 'src0' || b === 't') { S.playing = false; S.t = b === 'src0' ? S.ed[a].t0 : S.ed[a][b]; }
  });

  function soloCulpritIntro() {
    setPhase('edit');
    S.playing = false;
    const cs = S.cs;
    openModal(`
      <h2 class="center">🎬 Caso n° ${S.seed}</h2>
      <div class="big-role cul">SEI IL COLPEVOLE</div>
      <p class="center">Sei ${who(cs.culprit)} (${PROP_NAMES[AVATARS[cs.culprit].prop]}). Alle <b>${IA.clockText(cs.Tc)}</b> hai rubato il gioiello dallo Studio.<br/>Hai <b>${CONFIG.phases.edit} secondi</b> per truccare i filmati, poi 4 investigatori li analizzeranno.</p>
      <p class="center muted">Suggerimento: combina gli strumenti. Ogni trucco nasconde qualcosa… e lascia un micro-indizio.</p>
      <button class="primary" data-act="startEdit">Apri la sala montaggio</button>
    `);
  }

  $('#btnHelp').addEventListener('click', () => {
    if (!modalBack.classList.contains('hidden') && S.phase === 'menu') return;
    openModal(`<h2>Come si gioca</h2>${rulesHtml()}<button class="primary" data-act="closeModal">Chiudi</button>`);
  });
  $('#btnMenu').addEventListener('click', () => { if (S.phase === 'menu' || confirm('Abbandonare la partita e tornare al menu?')) { netLeave(); showMenu(); } });
  $('#btnStream').addEventListener('click', () => showStreamSetup());
  side.addEventListener('submit', (ev) => {
    if (ev.target.id !== 'sayForm') return;
    ev.preventDefault();
    const inp = $('#sayIn');
    const text = (inp.value || '').trim();
    if (!text) return;
    inp.value = '';
    speak(S.user, text, null, true);
    netSend('say', { text });
  });

  // ---------------------------------------------------------------------------
  // Clip verticale 9:16 automatica (fine partita)
  // ---------------------------------------------------------------------------
  function makeVClip() {
    if (!IA.makeVerticalClip || !S.cs || !S.verdict) return;
    openModal(`
      <h2 class="center">📱 Clip verticale</h2>
      <p class="center muted">Montaggio automatico in corso (≈${Math.round(IA.CLIP_TOTAL || 17)} s): la camera sotto accusa, i fumetti, il confronto truccato/reale e il verdetto.</p>
      <div class="vclip"><canvas id="vclipCanvas"></canvas></div>
      <div class="meter"><div id="vclipBar" style="width:0%;background:var(--amber)"></div></div>
      <div class="row" id="vclipActions"><button data-act="vclipCancel">Annulla</button></div>
    `);
    const speaker = S.mode === 'detective' || (S.mode === 'online' && S.user !== S.cs.culprit) ? S.user : undefined;
    S.vclip = IA.makeVerticalClip({
      cs: S.cs, edits: S.edits, clues: S.clues, verdict: S.verdict, initials: S.initials, seed: S.seed, speaker,
      canvas: $('#vclipCanvas'),
      onProgress: (p) => { const b = $('#vclipBar'); if (b) b.style.width = Math.round(p * 100) + '%'; },
    });
    const job = S.vclip;
    job.done.then((blob) => {
      if (S.vclip !== job) return;
      S.vclip = null;
      const act = $('#vclipActions');
      if (!act) return;
      if (!blob) { act.innerHTML = '<p class="muted">Il browser non supporta la registrazione video: puoi comunque registrare lo schermo di questa anteprima.</p><button data-act="closeModal">Chiudi</button>'; return; }
      const url = URL.createObjectURL(blob);
      act.innerHTML = `<a class="button primary" href="${url}" download="infinite-alibi-caso-${S.seed}-9x16.webm">⬇ Scarica la clip (.webm)</a><button data-act="vclip">↻ Rigenera</button><button data-act="closeModal">Chiudi</button>`;
    });
  }

  // ---------------------------------------------------------------------------
  // Modalità streamer (Twitch): voti e glitch dalla chat
  // ---------------------------------------------------------------------------
  const SIM_VIEWERS = ['pixel_nonna', 'gattoNinja', 'xX_detective_Xx', 'lupo_solitario', 'tortellino99', 'MrSospetto', 'la_vedova_nera', 'caffe_corretto', 'zio_bot', 'ombraviola', 'sherlock_veneto', 'patatina42'];
  const twitch = IA.TwitchChat ? new IA.TwitchChat({
    status: (st, msg) => { S.stream.status = st; if (msg) streamPush('⚙', msg, true); renderStream(); const el = $('#streamStatus'); if (el) el.textContent = streamStatusText(); },
    message: (user, text, cmd) => onChatMessage(user, text, cmd),
  }) : null;

  function streamStatusText() {
    const st = S.stream.status;
    if (S.stream.sim && st !== 'live') return 'chat simulata';
    return { off: 'disconnesso', connecting: 'connessione…', live: 'in diretta', error: 'errore' }[st] || st;
  }
  function showStreamSetup() {
    if (S.phase === 'menu') readMenuOptions(); // non perdere timer/difficoltà già scelti
    openModal(`
      <h2>📺 Modalità streamer</h2>
      <p class="tagline">Per chi gioca in diretta su Twitch (o con la chat proiettata su Discord). Il gioco legge la chat in sola lettura: niente login, niente chiavi.</p>
      <div class="row"><label>Canale Twitch</label><input type="text" id="streamChan" placeholder="nome_canale" value="${esc(S.stream.channel)}" /></div>
      <label class="toggle"><input type="checkbox" id="streamSim" ${S.stream.sim ? 'checked' : ''}/> Simula una chat (demo / prova senza diretta)</label>
      <div class="card">
        <h3>Comandi per gli spettatori</h3>
        <p><span class="kbd">!vota G</span> (iniziale, numero o nome) durante processo e voto: la maggioranza della chat vale <b>1 voto di giuria</b>.</p>
        <p><span class="kbd">!glitch</span> manda un disturbo di segnale <b>finto</b> sullo schermo dello streamer (cooldown 10 s). È etichettato «DISTURBO DALLA CHAT»: non è una prova.</p>
        <p><span class="kbd">!indizio testo</span> suggerisce qualcosa allo streamer.</p>
      </div>
      <p class="muted" id="streamStatus">Stato: ${streamStatusText()}</p>
      <div class="row">
        <button class="primary" data-act="streamConnect">${S.stream.on ? 'Aggiorna' : 'Attiva'}</button>
        ${S.stream.on ? '<button data-act="streamOff">Disattiva</button>' : ''}
        <button data-act="${S.phase === 'menu' ? 'menu' : 'closeModal'}">${S.phase === 'menu' ? '← Menu' : 'Chiudi'}</button>
      </div>
    `);
  }
  function streamConnect() {
    const ch = ($('#streamChan').value || '').trim();
    S.stream.channel = ch;
    S.stream.sim = $('#streamSim').checked;
    S.stream.on = true;
    S.stream.nextSim = now() + 1;
    if (ch && twitch) twitch.connect(ch);
    else if (twitch) twitch.disconnect();
    if (!ch && !S.stream.sim) S.stream.sim = true;
    $('#streamBox').classList.remove('hidden');
    $('#btnStream').classList.add('on');
    streamPush('⚙', ch ? `Collegamento a #${ch}…` : 'Chat simulata attiva', true);
    if (S.phase === 'menu') showMenu(); else closeModal();
  }
  function streamOff() {
    S.stream.on = false;
    S.stream.sim = false;
    if (twitch) twitch.disconnect();
    $('#streamBox').classList.add('hidden');
    $('#btnStream').classList.remove('on');
    if (S.phase === 'menu') showMenu(); else closeModal();
  }
  function streamPush(user, text, sys) {
    S.stream.feed.push({ user, text, sys: !!sys });
    if (S.stream.feed.length > 7) S.stream.feed.shift();
    renderStream();
  }
  const VOTE_PHASES = ['trial', 'overtime', 'vote', 'runoff'];
  function onChatMessage(user, text, cmd) {
    if (!S.stream.on) return;
    if (cmd && cmd.type === 'vote' && S.cs && S.cs.names && VOTE_PHASES.includes(S.phase)) {
      const idx = IA.resolveSuspect(cmd.arg, S.cs.names, S.initials);
      if (idx >= 0 && (!(S.phase === 'overtime' || S.phase === 'runoff') || !S.runoff || S.runoff.includes(idx))) {
        S.stream.votes[user] = idx;
        streamPush(user, `🗳 vota ${S.initials[idx]}`);
        return;
      }
    }
    if (cmd && cmd.type === 'glitch' && ['evidence', 'trial', 'overtime'].includes(S.phase)) {
      const tn = now();
      if (tn - S.stream.lastGlitch > 10 && tn - (S.stream.userGlitch[user] || -99) > 30) {
        S.stream.lastGlitch = tn;
        S.stream.userGlitch[user] = tn;
        S.audienceGlitch = { cam: Math.floor(Math.random() * ROOMS.length), until: tn + 1.6, by: user };
        beep(140, 0.25, 'sawtooth', 0.05);
        streamPush(user, `📺 !glitch sulla CAM 0${S.audienceGlitch.cam + 1}`);
        return;
      }
    }
    streamPush(user, text);
  }
  function renderStream() {
    const box = $('#streamBox');
    if (!box || !S.stream.on) return;
    const aud = VOTE_PHASES.includes(S.phase) && S.cs && S.cs.names ? audienceVote() : null;
    const bars = aud && aud.count ? `<div class="sv">${Object.keys(aud.counts).map((k) => `<span style="border-color:${colorOf(Number(k))}">${esc(S.initials[k])} ${aud.counts[k]}</span>`).join('')}</div>` : '';
    box.innerHTML = `<div class="sh">📺 CHAT ${S.stream.channel ? '#' + esc(S.stream.channel) : ''} · ${streamStatusText()}</div>
      ${S.stream.feed.map((m) => `<div class="sm ${m.sys ? 'sys' : ''}"><b>${esc(m.user)}</b> ${esc(m.text)}</div>`).join('')}
      ${bars}
      <div class="sf">${VOTE_PHASES.includes(S.phase) ? '!vota &lt;iniziale&gt;' : ['evidence', 'trial'].includes(S.phase) ? '!glitch per disturbare lo streamer' : 'in attesa della partita'}</div>`;
  }
  function simChatTick(tn) {
    if (!S.stream.on || !S.stream.sim || tn < S.stream.nextSim) return;
    S.stream.nextSim = tn + 0.9 + Math.random() * 1.8;
    const user = SIM_VIEWERS[Math.floor(Math.random() * SIM_VIEWERS.length)];
    let text;
    if (S.cs && S.cs.names && VOTE_PHASES.includes(S.phase) && Math.random() < 0.75) {
      // la chat simulata segue gli indizi più vistosi, con un po' di caos
      const pool = S.phase === 'overtime' || S.phase === 'runoff' ? S.runoff : S.cs.names.map((_, i) => i);
      const w = pool.map((i) => {
        let v = 0.6;
        for (const c of S.clues) v += Math.max(0, (c.points[i] || 0) * c.notice * 0.5);
        return v;
      });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      let pick = pool[0];
      for (let k = 0; k < pool.length; k++) { r -= w[k]; if (r <= 0) { pick = pool[k]; break; } }
      text = `!vota ${S.initials[pick]}`;
    } else if (['evidence', 'trial'].includes(S.phase) && Math.random() < 0.18) text = '!glitch';
    else text = ['KEKW', 'ma chi è stato??', 'riguarda la CAM 3!!', 'il timestamp ha saltato giuro', 'sospettoso...', 'ombra strana', 'LUL', 'F', 'fermo immagine pls', 'quello col cappello 👀'][Math.floor(Math.random() * 10)];
    onChatMessage(user, text, IA.parseCommand(text));
  }

  // ---------------------------------------------------------------------------
  // Online: client del server autoritativo (server/server.js)
  // ---------------------------------------------------------------------------
  function isOnlineCulprit() { return S.mode === 'online' && S.net && S.net.role && S.net.role.culprit; }
  function netSend(type, data) {
    if (!S.net || !S.net.ws || S.net.ws.readyState !== 1) return;
    S.net.ws.send(JSON.stringify(Object.assign({ type }, data || {})));
  }
  let editsTimer = null;
  function netSendEdits(final) {
    clearTimeout(editsTimer);
    if (final) { netSend('edits', { edits: S.edits, final: true }); return; }
    editsTimer = setTimeout(() => netSend('edits', { edits: S.edits }), 300);
  }
  function netNextButton(label) {
    return S.net && S.net.isHost ? `<button class="primary" data-act="netNext">${label} <span class="muted">(host)</span></button>` : '<p class="muted center">Si prosegue allo scadere del timer (o quando l\'host decide).</p>';
  }
  function readNetName() {
    const v = (($('#netName') || {}).value || '').trim() || 'Giocatore';
    try { localStorage.setItem('ia-name', v); } catch (e) { /* storage non disponibile */ }
    return v;
  }
  function netSavedId(code) { try { return sessionStorage.getItem('ia-id-' + code) || undefined; } catch (e) { return undefined; } }
  function showOnlineMenu(err) {
    let saved = '';
    try { saved = localStorage.getItem('ia-name') || ''; } catch (e) { /* niente */ }
    const fileMode = location.protocol === 'file:';
    openModal(`
      <h2>🌐 Online</h2>
      <p class="tagline">Ognuno gioca dal suo dispositivo. Il server genera il caso e custodisce il montaggio del Colpevole: gli altri ricevono il filmato solo all'inizio della raccolta prove, senza dati segreti.</p>
      ${fileMode ? '<div class="card secret"><p>Stai aprendo il file in locale. Per giocare online avvia il server:<br/><span class="kbd">cd games/infinite-alibi && npm install && npm start</span><br/>poi apri <b>http://localhost:8080</b> (o l\'indirizzo del server) su ogni dispositivo.</p></div>' : ''}
      ${err ? `<p class="bad">${esc(err)}</p>` : ''}
      <div class="row"><label>Il tuo nome</label><input type="text" id="netName" maxlength="14" value="${esc(saved)}" placeholder="es. Giulia"/></div>
      <div class="row"><button class="primary" data-act="netCreate" ${fileMode ? 'disabled' : ''}>Crea una stanza</button></div>
      <div class="row"><label>Codice</label><input type="text" id="netCode" maxlength="4" placeholder="ABCD" style="text-transform:uppercase"/><button data-act="netJoin" ${fileMode ? 'disabled' : ''}>Entra</button></div>
      <div class="row"><button data-act="menu">← Menu</button></div>
    `);
  }
  function netConnect(then) {
    if (S.net && S.net.ws && S.net.ws.readyState === 1) { then(); return; }
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { showOnlineMenu('Server non raggiungibile.'); return; }
    S.net = { ws, id: null, code: null, room: null, role: null, isHost: false };
    ws.onopen = then;
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onNet(m); };
    ws.onerror = () => { if (S.phase === 'menu') showOnlineMenu('Server non raggiungibile: è avviato con «npm start»?'); };
    ws.onclose = () => {
      if (!S.net || S.net.ws !== ws) return;
      if (S.mode === 'online' && S.phase !== 'menu') {
        hint('⚠ Connessione persa: riprovo…');
        const code = S.net.code;
        const id = S.net.id;
        setTimeout(() => { if (S.mode === 'online' && S.net && S.net.ws === ws) { S.net.ws = null; netConnect(() => netSend('join', { code, id })); } }, 1500);
      }
    };
  }
  function netLeave() {
    if (!S.net) return;
    const ws = S.net.ws;
    S.net = null;
    if (ws) { try { ws.close(); } catch (e) { /* già chiusa */ } }
  }

  function showLobby() {
    const r = S.net.room;
    const host = S.net.isHost;
    const players = r.players.map((p) => `<div class="item"><span class="grow">${esc(p.name)}${p.id === S.net.id ? ' (tu)' : ''}${p.id === r.hostId ? ' 👑' : ''}</span><span class="tag">${p.connected ? 'online' : 'offline'}</span></div>`).join('');
    const st = r.settings;
    openModal(`
      <h2>🌐 Stanza <span class="room-code">${esc(r.code)}</span></h2>
      <p class="tagline">Condividi il codice: gli altri aprono questa stessa pagina, scelgono «Online» ed entrano. Da 3 a 6 giocatori.</p>
      <div class="list">${players}</div>
      ${host ? `<div class="row"><label>Difficoltà</label><select id="netDiff">${Object.keys(CONFIG.DIFFICULTY).map((k) => `<option value="${k}" ${st.difficulty === k ? 'selected' : ''}>${DIFF_LABEL[k] || k}</option>`).join('')}</select>
        <label>Timer</label><select id="netTimer"><option value="1" ${st.timerMul === 1 ? 'selected' : ''}>Standard</option><option value="2" ${st.timerMul === 2 ? 'selected' : ''}>Rilassato</option><option value="0" ${st.timerMul === 0 ? 'selected' : ''}>Senza timer</option></select></div>
        <label class="toggle"><input type="checkbox" id="netAids" ${st.aids ? 'checked' : ''}/> 🧭 Aiuti per principianti (filtro di movimento + 2 lenti)</label>
        <div class="row"><button class="primary" data-act="netStart" ${r.players.filter((p) => p.connected).length < 3 ? 'disabled' : ''}>Inizia la partita</button><button data-act="menu">Esci</button></div>`
      : `<p class="muted">Difficoltà ${DIFF_LABEL[st.difficulty] || st.difficulty} · aiuti ${st.aids ? 'sì' : 'no'}. In attesa che l'host avvii la partita…</p><div class="row"><button data-act="menu">Esci</button></div>`}
    `);
    const send = () => netSend('settings', { settings: { difficulty: $('#netDiff').value, timerMul: Number($('#netTimer').value), aids: $('#netAids').checked } });
    if (host) ['#netDiff', '#netTimer', '#netAids'].forEach((q) => $(q).addEventListener('change', send));
  }

  function onlineStub(role) {
    // Agli investigatori basta sapere chi gioca: il caso vero resta sul server.
    return { n: role.n, names: role.names.slice(), culprit: -1, chars: [], Tc: 0, culpritStart: 0, stub: true };
  }

  function onNet(m) {
    const net = S.net;
    if (!net) return;
    switch (m.type) {
      case 'joined':
        net.id = m.id; net.code = m.code;
        try { sessionStorage.setItem('ia-id-' + m.code, m.id); } catch (e) { /* niente */ }
        if (!m.rejoined) setPhase('lobby');
        break;
      case 'room':
        net.room = m;
        net.isHost = m.hostId === net.id;
        if (m.scores) S.scores = m.scores;
        if (S.phase === 'lobby' || (S.phase === 'menu' && m.phase === 'lobby')) { setPhase('lobby'); showLobby(); }
        break;
      case 'role': {
        S.mode = 'online';
        net.role = m;
        stopAll();
        S.difficulty = m.difficulty;
        if (net.room && net.room.settings) S.timerMul = net.room.settings.timerMul;
        S.user = m.index;
        S.bots = [];
        S.rng = IA.makeRng(Date.now() & 0xffff);
        if (m.culprit) {
          S.cs = IA.generateCase(m.secret.seed, m.n, m.secret.culprit);
          S.cs.names = m.names.slice();
          S.seed = m.secret.seed;
        } else {
          S.cs = onlineStub(m);
          S.seed = '—';
        }
        S.initials = m.initials.slice();
        resetCaseState();
        S.revealed = false;
        if (m.culprit) {
          startEdit();
          S.deadline = null;
          hint('Sei il Colpevole: monta il filmato prima dello scadere del tempo (il server consegna l\'ultima versione valida)');
        } else {
          setPhase('wait');
          S.playing = true;
          setSide(`<h2>⏳ Montaggio in corso</h2><p>Sei ${who(S.user)}: <b class="ok">innocente</b>.</p><p>Uno degli altri giocatori è il Colpevole e sta truccando i filmati. Il server te li consegnerà fra poco.</p>`);
        }
        break;
      }
      case 'phase':
        S.deadline = m.seconds ? now() + m.seconds : null;
        S.lastTick = null;
        if (m.phase === 'edit') break;
        if (m.phase === 'evidence') startEvidence();
        else if (m.phase === 'trial') startTrial();
        else if (m.phase === 'vote') startVote();
        else if (m.phase === 'overtime') startOvertime(m.candidates);
        else if (m.phase === 'runoff') { S.runoff = m.candidates; startRunoff(); }
        if (m.seconds) S.deadline = now() + m.seconds;
        break;
      case 'footage':
        S.baked = m.baked;
        S.hints = m.hints ? { glow: m.hints.glow, lens: [] } : null;
        S.lensLeft = m.hints ? m.hints.lenses : 0;
        break;
      case 'lens':
        S.lensLeft = m.left;
        showLens(m.target);
        break;
      case 'laser': {
        const sp = R.toScreen(m.cam, m.lx, m.ly);
        if (!sp) break;
        let L = S.lasers.find((l) => l.idx === m.from);
        if (!L) { L = { idx: m.from, color: colorOf(m.from), points: [] }; S.lasers.push(L); }
        L.points.push({ x: sp.x, y: sp.y, t: now(), brk: m.start });
        if (L.points.length > 400) L.points.splice(0, 200);
        break;
      }
      case 'chat':
        speak(m.from, m.text, m.mark || null);
        break;
      case 'voteStatus': { const vs = $('#voteStatus'); if (vs) vs.textContent = `Hanno votato ${m.voted.length} su ${m.total}`; break; }
      case 'tally': {
        S.votes = new Array(S.cs.n).fill(-1);
        for (const k in m.votes) S.votes[Number(k)] = m.votes[k];
        S.revealed = false;
        S.votesShown = false;
        const r = m.result === 'overtime' ? { tied: true, top: m.candidates, convicted: -1 } : IA.tallyResult(m.tally);
        if (m.result === 'escaped') { r.tied = true; r.convicted = -1; }
        revealVotes({ r });
        break;
      }
      case 'reveal': {
        IA.setDifficulty(m.difficulty);
        const names = S.cs.names;
        S.cs = IA.generateCase(m.seed, names.length, m.culprit);
        S.cs.names = names;
        S.seed = m.seed;
        S.edits = m.edits;
        S.analysis = IA.analyze(S.cs, S.edits);
        S.clues = S.analysis.clues;
        S.cwin = IA.culpritWindow(S.cs);
        S.verdict = m.verdict;
        S.scores = m.scores || S.scores;
        S.baked = null;
        S.revealed = true;
        const b = $('#btnVerdict');
        if (b && S.votesShown) { b.disabled = false; b.textContent = 'Verdetto →'; }
        break;
      }
      case 'error':
        if (S.phase === 'menu' || S.phase === 'lobby') { if (S.phase === 'menu') showOnlineMenu(m.message); else hint('⚠ ' + m.message); }
        else hint('⚠ ' + m.message);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Clip virali: registrazione del canvas
  // ---------------------------------------------------------------------------
  let recorder = null;
  let chunks = [];
  $('#btnClip').addEventListener('click', () => {
    const btn = $('#btnClip');
    if (recorder) { recorder.stop(); return; }
    if (!canvas.captureStream || !window.MediaRecorder) { alert('Il tuo browser non supporta la registrazione del canvas.'); return; }
    const stream = canvas.captureStream(30);
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const link = $('#clipLink');
      link.href = URL.createObjectURL(blob);
      link.classList.remove('hidden');
      setTimeout(() => link.classList.add('hidden'), 20000);
      btn.classList.remove('recording');
      btn.textContent = '⏺ Clip';
      recorder = null;
    };
    recorder.start();
    btn.classList.add('recording');
    btn.textContent = '■ Stop';
  });

  // ---------------------------------------------------------------------------
  // Loop principale
  // ---------------------------------------------------------------------------
  let last = now();
  function frame() {
    const tn = now();
    const dt = Math.min(0.1, tn - last);
    last = tn;
    if (S.playing && !S.anim) {
      S.t += dt * S.speed;
      if (S.t >= D) S.t = S.phase === 'replay' ? D : 0;
      if (S.phase === 'replay' && S.t >= D) S.playing = false;
    }
    // timer di fase
    const timerEl = $('#timer');
    if (S.deadline) {
      const rem = Math.max(0, S.deadline - tn);
      timerEl.textContent = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(Math.floor(rem % 60)).padStart(2, '0')}`;
      timerEl.classList.toggle('urgent', rem < 10);
      const sec = Math.ceil(rem);
      if (rem < 5.5 && sec !== S.lastTick) { S.lastTick = sec; beep(sec <= 1 ? 1200 : 900, 0.05); }
      if (rem <= 0) {
        S.deadline = null;
        if (S.mode === 'online') { /* le fasi online le decide il server */ }
        else if (S.phase === 'edit') finishEdit();
        else if (S.phase === 'evidence') startTrial();
        else if (S.phase === 'trial') startVote();
        else if (S.phase === 'overtime') startRunoff();
      }
    } else {
      timerEl.textContent = '--:--';
      timerEl.classList.remove('urgent');
    }
    tickSchedule();
    updateOtTurn(false);
    simChatTick(tn);
    if (S.stream.on && tn - (S.streamDrawn || 0) > 0.5) { S.streamDrawn = tn; renderStream(); }
    if (S.phase === 'evidence' && S.mode === 'culprit' && tn > (S.chatterAt || Infinity)) {
      S.chatterAt = tn + 7 + Math.random() * 5;
      const b = S.rng.pick(S.bots);
      const seen = S.clues.filter((c) => b.noticed.has(c.id));
      const c = seen.length && S.rng.next() < 0.7 ? S.rng.pick(seen) : null;
      speak(b.idx, c ? S.rng.pick([`Mmm… la CAM 0${c.cam + 1} intorno alle ${IA.clockText(c.t)} è interessante.`, `Fermi tutti, riguardo la CAM 0${c.cam + 1}…`, 'Ho visto qualcosa. Ne parliamo al processo.']) : S.rng.pick(['Tutto normale, per ora.', 'Quanta gente in Cucina…', 'Qualcuno ha visto il gioiello?']));
    }
    // disegno
    if (S.cs) {
      if (S.anim && S.anim.type === 'expel') {
        const p = (tn - S.anim.start) / S.anim.dur;
        R.drawExpel({ progress: Math.min(1, p), culprit: S.cs.culprit, initials: S.initials, name: nameOf(S.cs.culprit) });
        if (p >= 1.25) { S.anim = null; startReplay(false); S.playing = false; S.replayEdited = false; renderResultSide(); }
      } else {
        let edits = S.edits;
        let mode = 'live';
        let banner = null;
        if (S.phase === 'edit') { mode = 'edit'; if (S.showOriginal) edits = null; }
        if (S.phase === 'replay') {
          if (S.replayEdited) { banner = '📼 VERSIONE TRUCCATA'; }
          else { edits = null; mode = 'replay'; banner = '🎞 REPLAY REALE — SENZA TAGLI'; }
        }
        const investigating = S.phase === 'evidence' || S.phase === 'trial' || S.phase === 'overtime';
        let feed = null;
        if (S.mode === 'online' && S.phase !== 'replay') {
          if (S.baked) feed = (cam, t) => IA.bakedFeedState(S.baked, cam, t);
          else if (!isOnlineCulprit()) feed = (cam, t) => ({ s: t, glitch: true, chars: [], jewel: false });
        }
        R.draw({
          cs: S.cs,
          feed,
          glow: S.filter && S.hints && investigating ? (cam, t) => IA.glowAt(S.hints.glow, cam, t) : null,
          lens: S.lens,
          audienceGlitch: S.stream.on && investigating ? S.audienceGlitch : null,
          edits,
          realEdits: S.edits,
          t: S.t,
          initials: S.initials,
          time: tn,
          now: tn,
          mode,
          previewEdits: !S.showOriginal,
          selectedCam: S.phase === 'edit' && S.ed && S.tool !== 'deepfake' && S.ed[S.tool].on ? S.ed[S.tool].cam : null,
          pins: investigating ? S.pins : null,
          lasers: S.lasers,
          botMarks: S.botMarks,
          banner,
        });
      }
      $('#clock').textContent = IA.clockText(S.t);
      $('#btnPlay').textContent = S.playing ? '❚❚' : '▶';
      drawTimeline();
    }
    S.botMarks = S.botMarks.filter((m) => tn - m.born < m.life);
    requestAnimationFrame(frame);
  }

  showMenu();
  requestAnimationFrame(frame);
  window.__IA_STATE = S; // utile per il debug da console
})();
