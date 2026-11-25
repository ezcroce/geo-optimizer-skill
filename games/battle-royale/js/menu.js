// ─────────────────────────────────────────────────────────────
//  Menu principale: Gioca · Armadietto · Pass battaglia · Negozio · Missioni
//  + lobby online (codice stanza, chat, compagni)
// ─────────────────────────────────────────────────────────────
import { SKINS, HATS, BACKPACKS, GLIDERS, RARITIES, MODES, TEAM_MODES, teamSize, MATE_COLORS } from './config.js?v=19';
import { NEWS, NEWS_VERSION } from './news.js?v=25';
import * as PR from './progress.js?v=19';
import * as N from './net.js?v=19';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const HAT_ICON = { none: '∅', cap: '🧢', beanie: '🧶', cowboy: '🤠', headphones: '🎧', straw: '👒', tophat: '🎩', viking: '⛑️', wizard: '🧙', crown: '👑', halo: '😇' };
const BACK_ICON = { none: '∅', school: '🎒', hiker: '🏕️', guitar: '🎸', sword: '🗡️', jetpack: '🚀', wings: '🕊️', dragonwings: '🐉' };
const SETTING_KEY = { skin: 'skin', hat: 'hat', back: 'back', glider: 'glider' };

function icon(type, it) {
  if (type === 'coins') return '🪙';
  if (type === 'hat') return HAT_ICON[it.id] || '🎩';
  if (type === 'back') return BACK_ICON[it.id] || '🎒';
  if (type === 'glider') return '🪂';
  return '';
}
/** sfondo della carta: colore della rarità + colori dell'oggetto */
function cardBg(type, it) {
  const r = RARITIES[it.rarity || 0].color;
  if (type === 'skin') return `linear-gradient(200deg, ${it.shirt}aa 0 22%, transparent 22%), linear-gradient(160deg, ${r}cc, ${r}33 70%), #141a3a`;
  if (type === 'glider') return `linear-gradient(135deg, ${it.color}aa 0 45%, ${it.accent}88 45% 55%, transparent 55%), linear-gradient(160deg, ${r}cc, ${r}33 70%), #141a3a`;
  return `linear-gradient(160deg, ${r}cc, ${r}33 70%), #141a3a`;
}
function skinSwatch(s) { return `<div class="swatch"><i style="background:${s.shirt}"></i><i style="background:${s.pants}"></i><i style="background:${s.accColor || s.skin}"></i></div>`; }

export function initMenu(api) {
  const S = api.settings;
  let tab = 'play', lockerCat = 'skin', toastT = 0;

  // ── notifiche ──
  function toast(html) {
    const t = $('#menuToast');
    t.innerHTML = html; t.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.add('hidden'), 3200);
  }
  PR.onProgress(e => {
    if (e.type === 'reward' && e.source === 'pass') {
      const r = e.reward, it = r.type === 'coins' ? null : PR.itemOf(r.type, r.id);
      toast(`🎁 Ricompensa sbloccata: <b>${r.type === 'coins' ? r.n + ' monete' : esc(it ? it.name : r.id)}</b>`);
    }
    refreshWallet();
  });

  // ── schede ──
  document.querySelectorAll('#tabs button').forEach(b => {
    b.onclick = () => { api.ui(); setTab(b.dataset.tab); };
  });
  function setTab(t) {
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('.tabpage').forEach(p => p.classList.toggle('hidden', p.dataset.page !== t));
    api.preview(null);   // torna all'aspetto equipaggiato
    if (t === 'locker') renderLocker();
    if (t === 'pass') renderPass();
    if (t === 'shop') renderShop();
    if (t === 'missions') renderMissions();
    if (t === 'play') renderPlay();
  }

  // ── portafoglio e livello ──
  function refreshWallet() {
    $('#lvlNum').textContent = PR.tier();
    $('#xpFill').style.width = (PR.tierProgress() * 100).toFixed(1) + '%';
    $('#coinNum').textContent = PR.profile.coins.toLocaleString('it-IT');
    const M = PR.missionsNow();
    $('#missionDot').classList.toggle('hidden', ![...M.daily, ...M.weekly].some(m => !m.done && m.progress / m.goal >= 0.8));
    $('#lockerDot').classList.toggle('hidden', !Object.values(PR.profile.seen).some(v => v === false));
  }

  // ── pagina Gioca ──
  const nm = $('#playerName');
  nm.value = S.name;
  nm.oninput = () => { S.name = nm.value.trim().slice(0, 16) || 'Giocatore'; api.save(); N.updateMe(meInfo()); renderSquad(); };
  nm.addEventListener('keydown', e => e.stopPropagation());
  document.querySelectorAll('#players button').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.p) === Number(S.players));
    b.onclick = () => { S.players = Number(b.dataset.p); api.save(); document.querySelectorAll('#players button').forEach(x => x.classList.toggle('on', x === b)); api.ui(); renderSummary(); };
  });
  document.querySelectorAll('#difficulty button').forEach(b => {
    b.classList.toggle('on', b.dataset.d === S.difficulty);
    b.onclick = () => { S.difficulty = b.dataset.d; api.save(); document.querySelectorAll('#difficulty button').forEach(x => x.classList.toggle('on', x === b)); api.ui(); renderSummary(); };
  });
  $('#playBtn').onclick = () => { api.ui(); api.play(); };

  function renderModes() {
    const wrap = $('#modes');
    const cur = N.NET.role === 'off' ? S.mode : N.NET.mode;
    wrap.innerHTML = '';
    for (const m of MODES) {
      const b = document.createElement('button');
      const locked = N.NET.role === 'client';
      b.className = 'mode' + (m.id === cur ? ' on' : '') + (locked && m.id !== cur ? ' locked' : '');
      b.innerHTML = `<b>${m.icon} ${esc(m.name)}</b><span>${esc(m.desc)}</span>`;
      b.onclick = () => {
        if (locked) { toast("La modalità la sceglie l'host della lobby"); return; }
        api.ui();
        S.mode = m.id; api.save();
        if (N.NET.role === 'host') N.setMode(m.id);
        renderModes(); renderSummary();
      };
      wrap.appendChild(b);
    }
  }
  // ── v23: squadre (singolo/duo/trio/squad) + Squadra/Versus online ──
  const curTeam = () => (N.NET.role === 'off' ? S.team : N.NET.team) || 'solo';
  const curVs = () => (N.NET.role === 'off' ? false : !!N.NET.vs);
  const person = (c) => `<svg viewBox="0 0 20 28" class="pp"><circle cx="10" cy="6.5" r="5.2" fill="${c}"/><path d="M1.5 27c0-8 3.6-12.6 8.5-12.6S18.5 19 18.5 27z" fill="${c}"/></svg>`;
  function renderTeams() {
    const wrap = $('#teamModes'), cur = curTeam(), locked = N.NET.role === 'client';
    wrap.innerHTML = '';
    for (const m of TEAM_MODES) {
      const b = document.createElement('button');
      b.className = 'tmode' + (m.id === cur ? ' on' : '') + (locked && m.id !== cur ? ' locked' : '');
      b.innerHTML = `<div class="people">${Array.from({ length: m.size }, (_, i) => person(i === 0 ? '#ffcf2e' : 'currentColor')).join('')}</div><b>${esc(m.name)}</b>`;
      b.title = m.desc;
      b.onclick = () => {
        if (locked) { toast("Le squadre le sceglie l'host della lobby"); return; }
        api.ui();
        S.team = m.id; api.save();
        if (N.NET.role === 'host') N.setTeam(m.id, N.NET.vs);
        renderTeamsAll();
      };
      wrap.appendChild(b);
    }
    $('#teamDesc').textContent = (TEAM_MODES.find(t => t.id === cur) || TEAM_MODES[0]).desc;
    // Squadra / Versus: solo in lobby e con squadre da 2+
    const vr = $('#vsRow');
    vr.classList.toggle('hidden', N.NET.role === 'off' || teamSize(cur) === 1);
    vr.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.vs === '1') === curVs());
      b.classList.toggle('locked', locked);
      b.onclick = () => {
        if (locked) { toast("Squadra o Versus lo sceglie l'host"); return; }
        api.ui(); S.vs = b.dataset.vs === '1'; api.save();
        N.setTeam(curTeam(), S.vs);
        renderTeamsAll();
      };
    });
  }
  function renderTeamsAll() { renderTeams(); renderSquad(); renderSummary(); api.lobbyChanged(); }
  /** chi è nella mia squadra (stessa regola che usa l'host all'avvio) */
  function myTeamPlan() {
    const T = teamSize(curTeam());
    if (N.NET.role === 'off') return { T, mates: [{ name: S.name, skin: S.skin, me: true }], foes: [] };
    const P = N.NET.players, vs = curVs() || T === 1;
    const team = (i) => vs ? i : Math.floor(i / T);
    const mi = Math.max(0, P.findIndex(p => p.id === N.NET.myId));
    const mates = [], foes = [];
    P.forEach((p, i) => { const e = { name: p.name, skin: p.skin, host: p.host, me: p.id === N.NET.myId }; (team(i) === team(mi) ? mates : foes).push(e); });
    return { T, mates, foes };
  }
  function renderSquad() {
    const { T, mates, foes } = myTeamPlan();
    const bar = $('#squadBar');
    let html = '';
    for (let i = 0; i < T; i++) {
      const m = mates[i];
      const col = MATE_COLORS[i % MATE_COLORS.length];
      if (m) {
        const sk = SKINS.find(x => x.id === m.skin) || SKINS[0];
        html += `<div class="sq ${m.me ? 'me' : 'friend'}" style="--mc:${col}"><i class="av" style="background:${sk.shirt}">${esc((m.name || '?')[0].toUpperCase())}</i><div><b>${esc(m.name)}</b><span>${m.me ? 'Tu' : 'Amico'}${m.host ? ' · host' : ''}</span></div></div>`;
      } else {
        const canInvite = N.NET.role !== 'client';
        html += `<div class="sq bot ${canInvite ? 'invite' : ''}" style="--mc:${col}"><i class="av">${canInvite ? '＋' : '🤖'}</i><div><b>${canInvite ? 'Invita' : 'Bot'}</b><span>${canInvite ? 'o gioca un bot' : 'compagno'}</span></div></div>`;
      }
    }
    if (foes.length) html += `<div class="sqvs"><b>VS</b>${foes.map(f => `<span>${esc(f.name)}</span>`).join('')}</div>`;
    bar.innerHTML = html;
    bar.classList.toggle('solo', T === 1); bar.classList.toggle('n4', T >= 4);
    bar.querySelectorAll('.sq.invite').forEach(el => el.onclick = () => {
      api.ui();
      if (N.NET.role === 'off') { $('#hostBtn').click(); }
      else $('#copyCode').click();
    });
    const me = SKINS.find(x => x.id === S.skin) || SKINS[0];
    $('#meAvatar').style.background = `linear-gradient(160deg, ${me.shirt}, ${me.pants})`;
    $('#meAvatar').textContent = (S.name || 'G')[0].toUpperCase();
  }
  function renderSummary() {
    const tm = TEAM_MODES.find(t => t.id === curTeam()) || TEAM_MODES[0];
    const mp = MODES.find(m => m.id === (N.NET.role === 'off' ? S.mode : N.NET.mode)) || MODES[0];
    const extra = N.NET.role === 'off' ? `${S.players} giocatori · ${{ facile: 'facile', normale: 'normale', difficile: 'difficile' }[S.difficulty] || ''}` : (tm.size > 1 ? (curVs() ? 'Versus' : 'Squadra con gli amici') : 'Online · 100 giocatori');
    $('#playSummary').innerHTML = `<b>${esc(tm.name.toUpperCase())}</b><i>·</i>${mp.icon} ${esc(mp.name)}<i>·</i><span>${esc(extra)}</span>`;
    $('#optsSum').textContent = `${S.players} · ${S.difficulty}`;
  }
  // ── cartello delle novità ──
  let newsI = 0, newsT = 0;
  function renderNews() {
    const n = NEWS[newsI];
    const unseen = localStorage.getItem('arenaNews') !== NEWS_VERSION;
    $('#newsBoard').innerHTML = `<h3><span>📰 Novità ${unseen ? '<em class="newtag">NUOVO</em>' : ''}</span><span class="nav"><button data-d="-1" aria-label="Precedente">‹</button><button data-d="1" aria-label="Successiva">›</button></span></h3>
      <div class="nslide" style="--nc:${n.color}"><div class="nv"><span>${n.icon}</span><b>${n.v}</b><em>${esc(n.title)}</em></div>
      <ul>${n.items.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}</ul>${n.items.length > 3 ? `<div class="more">+${n.items.length - 3} altre · tocca per leggere tutto</div>` : ''}</div>
      <div class="ndots">${NEWS.map((_, i) => `<i class="${i === newsI ? 'on' : ''}"></i>`).join('')}</div>`;
    $('#newsBoard').querySelectorAll('.nav button').forEach(b => b.onclick = e => { e.stopPropagation(); api.ui(); stepNews(Number(b.dataset.d)); });
  }
  function stepNews(d) { newsI = (newsI + d + NEWS.length) % NEWS.length; renderNews(); clearInterval(newsT); newsT = setInterval(() => stepNews(1), 7000); }
  function openNews() {
    $('#newsList').innerHTML = NEWS.map((n, i) => `<div class="nitem" style="--nc:${n.color};animation-delay:${i * 0.07}s"><div class="nv"><span>${n.icon}</span><b>${n.v}</b><em>${esc(n.title)}</em>${i === 0 ? '<em class="newtag">NUOVO</em>' : ''}</div><ul>${n.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
    $('#newsModal').classList.remove('hidden');
    localStorage.setItem('arenaNews', NEWS_VERSION);
    renderNews();
  }
  $('#newsBoard').onclick = () => { api.ui(); openNews(); };
  $('#newsClose').onclick = () => { api.ui(); $('#newsModal').classList.add('hidden'); };
  $('#newsModal').onclick = e => { if (e.target.id === 'newsModal') $('#newsModal').classList.add('hidden'); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#newsModal').classList.contains('hidden')) { e.stopPropagation(); $('#newsModal').classList.add('hidden'); } }, true);
  renderNews();
  newsT = setInterval(() => stepNews(1), 7000);

  function renderPlayBtn() {
    const b = $('#playBtn');
    const r = N.NET.role;
    b.disabled = r === 'client';
    b.classList.toggle('wait', r === 'client');
    b.innerHTML = `<span>${r === 'host' ? 'AVVIA PARTITA' : r === 'client' ? "IN ATTESA DELL'HOST…" : 'GIOCA'}</span>`;
    $('#offlineOpts').classList.toggle('hidden', r === 'client');
    $('#players').parentElement && document.querySelectorAll('#players button').forEach(x => { x.disabled = r !== 'off'; x.style.opacity = r !== 'off' ? 0.45 : 1; });
  }
  function renderPlay() {
    renderModes();
    renderTeams();
    renderSquad();
    renderSummary();
    renderPlayBtn();
    const M = PR.missionsNow();
    $('#playMissions').innerHTML = `<h3><span>Missioni di oggi</span><span>›</span></h3>` + M.daily.map(m => `
      <div class="mini-m"><div>${m.done ? '✅' : '◻️'} ${esc(m.label)}</div><div class="mbar"><i style="width:${(m.progress / m.goal * 100).toFixed(0)}%"></i></div></div>`).join('');
    const t = PR.tier();
    const next = PR.PASS.slice(t).find(x => x.free || (PR.profile.premium && x.prem));
    const nr = next ? (next.free || next.prem) : null;
    const nit = nr && nr.type !== 'coins' ? PR.itemOf(nr.type, nr.id) : null;
    $('#playPass').innerHTML = `<h3><span>Pass battaglia · livello ${t}</span><span>›</span></h3>
      <div class="xpbar" style="width:100%;height:9px"><i style="width:${(PR.tierProgress() * 100).toFixed(1)}%"></i></div>
      <div class="hint">${nr ? `Prossima ricompensa al livello ${next.tier}: <b>${nr.type === 'coins' ? nr.n + ' monete' : esc(nit ? nit.name : '')}</b>` : 'Hai completato il pass!'}</div>`;
    refreshWallet();
  }
  $('#playMissions').onclick = () => { api.ui(); setTab('missions'); };
  $('#playPass').onclick = () => { api.ui(); setTab('pass'); };

  // ── armadietto ──
  document.querySelectorAll('#lockerCats button').forEach(b => {
    b.onclick = () => { api.ui(); lockerCat = b.dataset.cat; document.querySelectorAll('#lockerCats button').forEach(x => x.classList.toggle('on', x === b)); renderLocker(); };
  });
  function renderLocker() {
    const wrap = $('#skins');
    wrap.innerHTML = '';
    const list = PR.CATALOG[lockerCat];
    const sorted = [...list].sort((a, b) => (PR.owns(lockerCat, b.id) - PR.owns(lockerCat, a.id)) || ((a.rarity || 0) - (b.rarity || 0)));
    for (const it of sorted) {
      const own = PR.owns(lockerCat, it.id);
      const on = S[SETTING_KEY[lockerCat]] === it.id;
      const r = RARITIES[it.rarity || 0];
      const d = document.createElement('div');
      d.className = 'skin' + (on ? ' on' : '') + (own ? '' : ' locked');
      d.style.background = cardBg(lockerCat, it);
      const isNew = PR.profile.seen[lockerCat + ':' + it.id] === false;
      d.innerHTML = (lockerCat === 'skin' ? skinSwatch(it) : `<div class="ico">${icon(lockerCat, it)}</div>`) +
        (own ? (isNew ? '<span class="new">NUOVO</span>' : '') : '<span class="lock">🔒</span>') +
        `<div class="rr" style="color:${own ? '#fff' : r.color}">${r.name}</div><div class="nm">${esc(it.name)}</div>` +
        (own ? '' : `<div class="how">${esc(PR.unlockInfo(lockerCat, it.id))}</div>`);
      d.onclick = () => {
        api.ui();
        if (!own) { previewItem(lockerCat, it.id); toast(`🔒 ${esc(it.name)} — ${esc(PR.unlockInfo(lockerCat, it.id))}`); return; }
        S[SETTING_KEY[lockerCat]] = it.id; api.save();
        if (isNew) { PR.profile.seen[lockerCat + ':' + it.id] = true; PR.save(); }
        api.preview(lockerCat === 'glider' ? { glider: it.id } : null);
        N.updateMe(meInfo());
        renderLocker(); refreshWallet();
      };
      wrap.appendChild(d);
    }
    // segna come visti quelli della categoria aperta (dopo un attimo)
    setTimeout(() => {
      let ch = false;
      for (const it of list) if (PR.profile.seen[lockerCat + ':' + it.id] === false) { PR.profile.seen[lockerCat + ':' + it.id] = true; ch = true; }
      if (ch) { PR.save(); refreshWallet(); }
    }, 2500);
  }
  function previewItem(type, id) {
    if (type === 'skin') api.preview({ skin: id });
    else if (type === 'hat') api.preview({ hat: id });
    else if (type === 'back') api.preview({ back: id });
    else if (type === 'glider') api.preview({ glider: id });
  }

  // ── pass battaglia ──
  $('#seasonName').textContent = PR.SEASON.name;
  $('#premiumBtn').onclick = () => {
    if (PR.profile.premium) return;
    const r = PR.buyPremium();
    if (!r.ok) { toast('❌ ' + esc(r.msg)); return; }
    api.ui(); toast('🌟 Pass premium attivato! Le ricompense già raggiunte sono tue');
    renderPass(); refreshWallet();
  };
  function rewardCell(r, prem, tier, reached) {
    if (!r) return `<div class="rw ${prem ? 'prem' : ''} empty"></div>`;
    const it = r.type === 'coins' ? null : PR.itemOf(r.type, r.id);
    const got = reached && (!prem || PR.profile.premium);
    const lock = !got;
    const bg = it ? cardBg(r.type, it) : 'linear-gradient(160deg, #a07a1acc, #3a2a0a)';
    const ic = r.type === 'skin' ? `<div class="ic" style="font-size:12px;top:8px">${skinSwatch(it)}</div>` : `<div class="ic">${icon(r.type, it || {})}</div>`;
    return `<div class="rw ${prem ? 'prem' : ''} ${got ? 'got' : ''} ${lock ? 'lock' : ''}" data-type="${r.type}" data-id="${r.id || ''}" style="background:${bg}">
      ${ic}<span class="ty">${PR.TYPE_NAMES[r.type]}</span>${r.type === 'coins' ? r.n + ' monete' : esc(it.name)}</div>`;
  }
  function renderPass() {
    const t = PR.tier();
    $('#passLvl').textContent = t;
    $('#passXp').textContent = t >= PR.PASS_TIERS ? 'pass completato!' : `${Math.round(PR.tierProgress() * PR.XP_PER_TIER)} / ${PR.XP_PER_TIER} XP`;
    const pb = $('#premiumBtn');
    pb.classList.toggle('owned', PR.profile.premium);
    pb.textContent = PR.profile.premium ? '✔ Pass premium attivo' : `Pass premium · ${PR.PREMIUM_PRICE} 🪙`;
    const track = $('#passTrack');
    track.innerHTML = PR.PASS.map(x => `<div class="tier ${x.tier <= t ? 'reached' : ''} ${x.tier === t ? 'current' : ''}">
      <div class="num">${x.tier}</div>${rewardCell(x.free, false, x.tier, x.tier <= t)}${rewardCell(x.prem, true, x.tier, x.tier <= t)}</div>`).join('');
    track.querySelectorAll('.rw[data-type]').forEach(el => {
      el.onclick = () => {
        const type = el.dataset.type, id = el.dataset.id;
        if (type === 'coins') return;
        api.ui();
        previewItem(type, id);
        const it = PR.itemOf(type, id);
        toast(`${esc(it.name)} · ${PR.owns(type, id) ? 'già tuo: equipaggialo nell\'armadietto' : esc(PR.unlockInfo(type, id))}`);
      };
    });
    requestAnimationFrame(() => {
      const cur = track.querySelector('.tier.current');
      if (cur) track.scrollLeft = cur.offsetLeft - track.clientWidth / 2 + 52;
    });
  }

  // ── negozio ──
  function renderShop() {
    const grid = $('#shopGrid');
    const offers = PR.shopToday();
    grid.innerHTML = '';
    for (const o of offers) {
      const own = PR.owns(o.type, o.item.id);
      const r = RARITIES[o.item.rarity || 0];
      const d = document.createElement('div');
      d.className = 'offer' + (o.featured ? ' featured' : '');
      d.style.background = cardBg(o.type, o.item);
      const full = PR.priceOf(o.type, o.item);
      d.innerHTML = (o.sale ? '<span class="badge">-20%</span>' : o.featured ? '<span class="badge feat">In evidenza</span>' : '') +
        (o.type === 'skin' ? `<div class="ic" style="font-size:14px">${skinSwatch(o.item)}</div>` : `<div class="ic">${icon(o.type, o.item)}</div>`) +
        `<div class="ty">${PR.TYPE_NAMES[o.type]} · <span style="color:${r.color}">${r.name}</span></div><div class="nm">${esc(o.item.name)}</div>` +
        `<button class="buy ${own ? 'owned' : ''}">${own ? '✔ Già tuo' : (o.sale ? `<span class="old">${full}</span>` : '') + o.price + ' 🪙'}</button>`;
      d.onclick = e => {
        grid.querySelectorAll('.offer').forEach(x => x.classList.remove('sel'));
        d.classList.add('sel');
        previewItem(o.type, o.item.id);
        if (e.target.closest('.buy') && !own) {
          const res = PR.buy(o.type, o.item.id, o.price);
          if (!res.ok) { toast('❌ ' + esc(res.msg)); return; }
          api.ui();
          toast(`🛍️ Hai comprato <b>${esc(o.item.name)}</b>! Lo trovi nell'armadietto`);
          renderShop(); refreshWallet();
        }
      };
      grid.appendChild(d);
    }
  }
  setInterval(() => {
    if (tab !== 'shop') return;
    const ms = PR.msToMidnight();
    const h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60;
    $('#shopTimer').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);

  // ── missioni ──
  function renderMissions() {
    const M = PR.missionsNow();
    const row = m => `<div class="mission ${m.done ? 'done' : ''}">
      <div class="top"><span>${m.done ? '✅ ' : ''}${esc(m.label)}</span><span class="rew">+${m.xp} XP${m.coins ? ` · ${m.coins} 🪙` : ''}</span></div>
      <div class="mbar"><i style="width:${(m.progress / m.goal * 100).toFixed(1)}%"></i></div>
      <div class="cnt">${Math.floor(m.progress).toLocaleString('it-IT')} / ${m.goal.toLocaleString('it-IT')}</div></div>`;
    const ms = PR.msToMidnight();
    $('#missionList').innerHTML =
      `<div class="mgroup"><span>GIORNALIERE</span><span>nuove tra ${Math.floor(ms / 3.6e6)} h ${Math.floor(ms / 6e4) % 60} min</span></div>` + M.daily.map(row).join('') +
      `<div class="mgroup"><span>SETTIMANALI</span><span>si rinnovano il lunedì</span></div>` + M.weekly.map(row).join('');
  }

  // ── online ──
  const NET = N.NET;
  function meInfo() { return { name: S.name, skin: S.skin, hat: S.hat, back: S.back, glider: S.glider }; }
  const chatLog = $('#chatLog');
  function addChat(name, text) {
    const d = document.createElement('div');
    if (!name) { d.className = 'sys'; d.textContent = text; }
    else d.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    chatLog.appendChild(d);
    while (chatLog.children.length > 60) chatLog.firstChild.remove();
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  /** v23: riga di riepilogo sotto la lista dei giocatori online */
function lobbyHint() {
  const NET = N.NET, n = NET.players.length, T = teamSize(NET.team);
  if (T === 1) return `gli altri ${100 - n} posti sono bot`;
  const teams = Math.floor(100 / T);
  if (NET.vs) return `versus: ogni amico guida una squadra di bot · ${teams} squadre`;
  const friendTeams = Math.ceil(n / T);
  return `${friendTeams === 1 ? 'siete nella stessa squadra' : `amici divisi in ${friendTeams} squadre`} · ${teams} squadre da ${T}, il resto sono bot`;
}
function renderOnline() {
    const inLobby = NET.role !== 'off';
    $('#onlineIdle').classList.toggle('hidden', inLobby);
    $('#onlineLobby').classList.toggle('hidden', !inLobby);
    if (inLobby) {
      $('#roomCode').textContent = NET.code;
      $('#lobbyPlayers').innerHTML = NET.players.map(p => {
        const sk = SKINS.find(s => s.id === p.skin) || SKINS[0];
        return `<div class="lp"><i style="background:${sk.shirt}"></i>${esc(p.name)}${p.host ? '<span class="tag">HOST</span>' : ''}${p.id === NET.myId ? '<span class="tag me">TU</span>' : ''}</div>`;
      }).join('') + `<div class="hint">${NET.players.length}/${N.MAX_PLAYERS} giocatori · ${lobbyHint()}</div>`;
    }
    $('#onlineBadge').innerHTML = inLobby ? `<span class="live">● ${NET.players.length} in lobby</span>` : '';
    renderModes();
    renderTeams();
    renderSquad();
    renderSummary();
    renderPlayBtn();
    api.lobbyChanged();
  }
  NET.onLobby = renderOnline;
  NET.onChat = addChat;
  NET.onMessage = (from, msg) => api.netMessage(from, msg);
  NET.onClose = why => { renderOnline(); api.netClosed(why); addChat('', why || 'Connessione chiusa'); };
  const status = (t, err = false) => { const el = $('#netStatus'); el.textContent = t; el.classList.toggle('err', err); };
  $('#hostBtn').onclick = async () => {
    api.ui();
    status('Creazione della lobby…');
    try {
      NET.mode = S.mode; NET.team = S.team; NET.vs = !!S.vs;
      await N.createLobby(meInfo());
      N.setMode(S.mode); N.setTeam(S.team, !!S.vs);
      chatLog.innerHTML = '';
      addChat('', `Lobby creata! Dai il codice ${NET.code} ai tuoi amici.`);
      status('Fino a 8 giocatori: gli altri posti sono riempiti dai bot.');
      renderOnline();
    } catch (e) { status(e.message || 'Errore', true); }
  };
  $('#joinBtn').onclick = async () => {
    api.ui();
    status('Collegamento…');
    try {
      await N.joinLobby($('#joinCode').value, meInfo());
      chatLog.innerHTML = '';
      addChat('', 'Sei entrato nella lobby. La partita la avvia l\'host.');
      status('');
      renderOnline();
    } catch (e) { status(e.message || 'Errore', true); }
  };
  $('#joinCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#joinBtn').click(); });
  $('#joinCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#leaveBtn').onclick = () => { api.ui(); N.leaveLobby(); renderOnline(); status('Hai lasciato la lobby.'); };
  $('#copyCode').onclick = () => {
    const url = new URL(location.href); url.search = '?lobby=' + NET.code + (NET.local ? '&net=local' : '');
    navigator.clipboard?.writeText(url.toString()).then(() => toast('🔗 Link della lobby copiato: mandalo ai tuoi amici'), () => toast('Codice: ' + NET.code));
  };
  const sendChat = () => { const i = $('#chatInput'); N.chat(i.value); i.value = ''; };
  $('#chatSend').onclick = sendChat;
  $('#chatInput').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') sendChat(); });
  // link d'invito: gioco.html?lobby=CODICE
  const inv = new URLSearchParams(location.search).get('lobby');
  if (inv) { $('#joinCode').value = inv.toUpperCase().slice(0, 5); setTimeout(() => $('#joinBtn').click(), 300); }
  // l'avvio della partita arriva come messaggio di rete
  const prevOnMessage = NET.onMessage;
  NET.onMessage = (from, msg) => { if (msg && msg.t === 'start') api.netStart(msg); else prevOnMessage(from, msg); };

  // ── avvio ──
  renderOnline();
  setTab('play');
  return {
    refresh() { setTab(tab); renderOnline(); },
    toast,
    tab: () => tab,
  };
}
