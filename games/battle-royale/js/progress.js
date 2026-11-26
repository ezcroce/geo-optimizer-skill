// ─────────────────────────────────────────────────────────────
//  Progressi del giocatore: pass battaglia, negozio, missioni, monete
//  (tutto salvato nel browser con localStorage)
// ─────────────────────────────────────────────────────────────
import { SKINS, HATS, BACKPACKS, GLIDERS, RARITIES } from './config.js?v=33';

const KEY = 'arenaRoyaleProfile';
export const XP_PER_TIER = 1000;
export const PASS_TIERS = 40;
export const PREMIUM_PRICE = 950;
export const SEASON = { name: 'Stagione 1 · Isole Selvagge', ends: '2027-02-28' };

/** catalogo: tipo → lista oggetti */
export const CATALOG = { skin: SKINS, hat: HATS, back: BACKPACKS, glider: GLIDERS };
export const TYPE_NAMES = { skin: 'Skin', hat: 'Cappello', back: 'Zaino', glider: 'Deltaplano', coins: 'Monete' };
export function itemOf(type, id) { return (CATALOG[type] || []).find(x => x.id === id); }

// ── ricompense del pass: [livello, ricompensa] ──
const R = (type, idOrN) => type === 'coins' ? { type, n: idOrN } : { type, id: idOrN };
const FREE = [
  [1, R('hat', 'beanie')], [4, R('coins', 100)], [6, R('back', 'hiker')], [8, R('coins', 100)], [10, R('skin', 'cowboy')],
  [12, R('hat', 'beret')], [13, R('coins', 150)], [16, R('glider', 'arcobaleno')], [19, R('coins', 150)], [22, R('hat', 'cowboy')], [25, R('skin', 'scienziata')],
  [28, R('coins', 200)], [30, R('back', 'tactical')], [32, R('back', 'sword')], [36, R('coins', 200)], [40, R('coins', 500)],
];
const PREMIUM = [
  [1, R('coins', 300)], [3, R('hat', 'viking')], [7, R('coins', 200)], [9, R('skin', 'vichingo')], [12, R('hat', 'tactical')], [14, R('hat', 'wizard')],
  [18, R('coins', 250)], [21, R('back', 'shield')], [24, R('back', 'wings')], [29, R('glider', 'oro')], [34, R('coins', 300)], [37, R('hat', 'crown')], [40, R('skin', 'samurai')],
];
/** tutti i livelli del pass con le due ricompense (gratis / premium) */
export const PASS = Array.from({ length: PASS_TIERS }, (_, i) => ({
  tier: i + 1,
  free: (FREE.find(f => f[0] === i + 1) || [])[1] || null,
  prem: (PREMIUM.find(f => f[0] === i + 1) || [])[1] || null,
}));

// ── missioni ──
// stat: cosa conta · goal: obiettivo · max: conta il valore migliore in una partita invece della somma
const DAILY = [
  { id: 'd_kills', stat: 'kill', goal: 3, xp: 500, text: 'Elimina {g} avversari' },
  { id: 'd_chests', stat: 'chest', goal: 5, xp: 400, text: 'Apri {g} forzieri' },
  { id: 'd_survive', stat: 'survive', goal: 300, xp: 500, max: true, text: 'Sopravvivi 5 minuti in una partita' },
  { id: 'd_matches', stat: 'match', goal: 2, xp: 400, text: 'Gioca {g} partite' },
  { id: 'd_top10', stat: 'top10', goal: 1, xp: 600, text: 'Arriva tra i primi 10' },
  { id: 'd_damage', stat: 'damage', goal: 500, xp: 500, text: 'Infliggi {g} danni agli avversari' },
  { id: 'd_grass', stat: 'grass', goal: 30, xp: 400, text: "Resta nascosto nell'erba alta per {g} secondi" },
  { id: 'd_climb', stat: 'climb', goal: 25, xp: 400, text: 'Arrampicati per {g} metri' },
  { id: 'd_glide', stat: 'glide', goal: 45, xp: 300, text: 'Plana con il deltaplano per {g} secondi' },
  { id: 'd_heal', stat: 'heal', goal: 100, xp: 400, text: 'Recupera {g} punti di salute o scudo' },
  { id: 'd_head', stat: 'headshot', goal: 5, xp: 500, text: 'Colpisci {g} volte alla testa' },
  { id: 'd_sniper', stat: 'kill_sniper', goal: 1, xp: 600, text: 'Elimina un avversario con il fucile di precisione' },
  { id: 'd_shotgun', stat: 'kill_shotgun', goal: 2, xp: 500, text: 'Elimina {g} avversari con il fucile a pompa' },
  { id: 'd_walk', stat: 'walk', goal: 2000, xp: 400, text: 'Percorri {g} metri a piedi' },
  { id: 'd_random', stat: 'match_random', goal: 1, xp: 500, text: 'Gioca una partita in Random Map' },
  { id: 'd_build', stat: 'build', goal: 10, xp: 300, text: 'Costruisci {g} muri' },
];
const WEEKLY = [
  { id: 'w_kills', stat: 'kill', goal: 25, xp: 2500, coins: 100, text: 'Elimina {g} avversari' },
  { id: 'w_chests', stat: 'chest', goal: 30, xp: 2000, coins: 80, text: 'Apri {g} forzieri' },
  { id: 'w_win', stat: 'win', goal: 1, xp: 3000, coins: 150, text: 'Vinci una partita (Vittoria Reale)' },
  { id: 'w_top10', stat: 'top10', goal: 5, xp: 2500, coins: 100, text: 'Arriva tra i primi 10 per {g} volte' },
  { id: 'w_damage', stat: 'damage', goal: 4000, xp: 2000, coins: 80, text: 'Infliggi {g} danni' },
  { id: 'w_grass', stat: 'grass', goal: 180, xp: 1500, coins: 60, text: "Resta nascosto nell'erba alta per {g} secondi" },
  { id: 'w_climb', stat: 'climb', goal: 150, xp: 1500, coins: 60, text: 'Arrampicati per {g} metri' },
  { id: 'w_matches', stat: 'match', goal: 10, xp: 2000, coins: 80, text: 'Gioca {g} partite' },
  { id: 'w_online', stat: 'match_online', goal: 2, xp: 2500, coins: 100, text: 'Gioca {g} partite online con gli amici' },
  { id: 'w_head', stat: 'headshot', goal: 30, xp: 2000, coins: 80, text: 'Colpisci {g} volte alla testa' },
];

// ── salvataggio ──
function defaults() {
  const owned = {};
  for (const [t, list] of Object.entries(CATALOG)) owned[t] = list.filter(x => !x.lock).map(x => x.id);
  return { xp: 0, coins: 300, premium: false, owned, granted: { free: 0, prem: 0 }, missions: {}, stats: { matches: 0, wins: 0, kills: 0, best: 0 }, equip: { hat: 'none', back: 'none' }, seen: {} };
}
function load() {
  let p;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { p = null; }
  const d = defaults();
  if (!p) return d;
  p = Object.assign(d, p);
  for (const t of Object.keys(CATALOG)) {           // nuovi oggetti gratuiti aggiunti in futuro
    p.owned[t] = Array.from(new Set([...(p.owned[t] || []), ...d.owned[t]]));
  }
  return p;
}
export const profile = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* spazio pieno o modalità privata */ } }

const listeners = new Set();
/** eventi: { type: 'level'|'reward'|'mission'|'coins', ... } per mostrare notifiche */
export function onProgress(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(e) { for (const fn of listeners) fn(e); }

export function owns(type, id) { return (profile.owned[type] || []).includes(id); }
function give(type, id) { if (!owns(type, id)) { profile.owned[type].push(id); profile.seen[type + ':' + id] = false; } }
function grant(r, source) {
  if (!r) return;
  if (r.type === 'coins') profile.coins += r.n;
  else give(r.type, r.id);
  emit({ type: 'reward', reward: r, source });
}

// ── livelli ──
export function tier() { return Math.min(PASS_TIERS, 1 + Math.floor(profile.xp / XP_PER_TIER)); }
export function tierProgress() { return tier() >= PASS_TIERS ? 1 : (profile.xp % XP_PER_TIER) / XP_PER_TIER; }
/** consegna le ricompense dei livelli raggiunti */
function grantTiers() {
  const t = tier();
  while (profile.granted.free < t) { profile.granted.free++; grant(PASS[profile.granted.free - 1].free, 'pass'); }
  if (profile.premium) while (profile.granted.prem < t) { profile.granted.prem++; grant(PASS[profile.granted.prem - 1].prem, 'pass'); }
}
export function addXP(n) {
  const before = tier();
  profile.xp += Math.max(0, Math.round(n));
  const after = tier();
  if (after > before) emit({ type: 'level', from: before, to: after });
  grantTiers();
  save();
}
export function addCoins(n) { profile.coins += n; emit({ type: 'coins', n }); save(); }
export function buyPremium() {
  if (profile.premium) return { ok: false, msg: 'Hai già il pass premium' };
  if (profile.coins < PREMIUM_PRICE) return { ok: false, msg: `Servono ${PREMIUM_PRICE} monete` };
  profile.coins -= PREMIUM_PRICE;
  profile.premium = true;
  grantTiers();
  save();
  return { ok: true };
}
// regalo iniziale: il livello 1 del pass è subito tuo
grantTiers();

// ── negozio a rotazione giornaliera ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function today(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 86400000 + 1) / 7);
}
const BASE_PRICE = [200, 500, 800, 1200, 1800];
const TYPE_MULT = { skin: 1, hat: 0.5, back: 0.6, glider: 0.7 };
export function priceOf(type, item) { return Math.round(BASE_PRICE[item.rarity || 0] * TYPE_MULT[type] / 50) * 50; }
/** offerte di oggi: 2 in evidenza (skin) + 4 giornaliere, sempre le stesse per tutto il giorno */
export function shopToday() {
  const rnd = mulberry32(hashStr('shop' + today()));
  const pool = [];
  for (const [type, list] of Object.entries(CATALOG)) for (const it of list) if (it.lock === 'shop') pool.push({ type, item: it });
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const skins = shuffle(pool.filter(p => p.type === 'skin'));
  const others = shuffle(pool.filter(p => p.type !== 'skin'));
  const featured = skins.slice(0, 2);
  const daily = [...skins.slice(2, 3), ...others].slice(0, 4);
  return [...featured, ...daily].map((p, i) => ({ ...p, featured: i < 2, price: Math.round(priceOf(p.type, p.item) * (i === 0 ? 0.8 : 1) / 50) * 50, sale: i === 0 }));
}
export function msToMidnight() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); return m - n; }
export function buy(type, id, price) {
  if (owns(type, id)) return { ok: false, msg: 'Lo possiedi già' };
  if (profile.coins < price) return { ok: false, msg: `Ti mancano ${price - profile.coins} monete` };
  profile.coins -= price;
  give(type, id);
  save();
  return { ok: true };
}
/** come si sblocca un oggetto (per l'armadietto) */
export function unlockInfo(type, id) {
  if (owns(type, id)) return null;
  for (const t of PASS) {
    if (t.free && t.free.type === type && t.free.id === id) return `Pass battaglia · livello ${t.tier}`;
    if (t.prem && t.prem.type === type && t.prem.id === id) return `Pass premium · livello ${t.tier}`;
  }
  const it = itemOf(type, id);
  if (it && it.lock === 'shop') return `Negozio · ${priceOf(type, it)} monete`;
  return 'Bloccato';
}

// ── missioni del giorno e della settimana ──
function pickMissions(pool, key, n) {
  const rnd = mulberry32(hashStr(key));
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const out = [], stats = new Set();
  for (const m of a) { if (stats.has(m.stat)) continue; stats.add(m.stat); out.push(m); if (out.length >= n) break; }
  return out;
}
function missionState(key) {
  if (!profile.missions[key]) {
    // si tengono solo il giorno e la settimana correnti
    const keepD = 'D' + today(), keepW = 'W' + weekKey();
    for (const k of Object.keys(profile.missions)) if (k !== keepD && k !== keepW) delete profile.missions[k];
    profile.missions[key] = { p: {}, done: {} };
  }
  return profile.missions[key];
}
export function missionsNow() {
  const dk = 'D' + today(), wk = 'W' + weekKey();
  const ds = missionState(dk), ws = missionState(wk);
  const fmt = (m, st, weekly) => ({ ...m, weekly, label: m.text.replace('{g}', m.goal.toLocaleString('it-IT')), progress: Math.min(m.goal, st.p[m.id] || 0), done: !!st.done[m.id], coins: m.coins || 0 });
  return {
    daily: pickMissions(DAILY, 'daily' + today(), 3).map(m => fmt(m, ds, false)),
    weekly: pickMissions(WEEKLY, 'weekly' + weekKey(), 3).map(m => fmt(m, ws, true)),
    dayKey: dk, weekKey: wk,
  };
}
/** conteggi durante la partita: progress(stat, quanto) o, per le missioni "max", il valore migliore */
const matchMax = {};
export function track(stat, amount = 1) {
  const M = missionsNow();
  let changed = false;
  for (const m of [...M.daily, ...M.weekly]) {
    if (m.stat !== stat || m.done) continue;
    const st = profile.missions[m.weekly ? M.weekKey : M.dayKey];
    if (m.max) { matchMax[m.id] = Math.max(matchMax[m.id] || 0, amount); st.p[m.id] = Math.max(st.p[m.id] || 0, matchMax[m.id]); }
    else st.p[m.id] = (st.p[m.id] || 0) + amount;
    changed = true;
    if (st.p[m.id] >= m.goal) {
      st.done[m.id] = true;
      emit({ type: 'mission', mission: m });
      if (m.coins) profile.coins += m.coins;
      addXP(m.xp);
    }
  }
  if (changed) save();
}
export function resetMatchMax() { for (const k of Object.keys(matchMax)) delete matchMax[k]; }

/**
 * Fine partita: calcola XP e monete.
 * r = { place, total, kills, time, damage, chests, win, mode, online }
 */
export function matchResult(r) {
  const lines = [];
  const add = (label, xp) => { if (xp > 0) lines.push({ label, xp: Math.round(xp) }); };
  add(`Sopravvivenza (${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')})`, Math.min(1400, r.time * 1.6));
  add(`Eliminazioni ×${r.kills}`, r.kills * 80);
  add(`Forzieri aperti ×${r.chests}`, r.chests * 20);
  add('Danni inflitti', Math.min(600, r.damage / 5));
  const frac = r.place / Math.max(2, r.total);
  if (r.win) add('Vittoria Reale!', 600);
  else if (r.place <= 10) add('Tra i primi 10', 250);
  else if (frac <= 0.25) add('Tra i primi 25%', 120);
  if (r.mode === 'random') add('Bonus Random Map', 100);
  if (r.online) add('Bonus partita online', 150);
  const xp = lines.reduce((s, l) => s + l.xp, 0);
  const coins = 15 + r.kills * 5 + (r.win ? 100 : r.place <= 10 ? 30 : 0);
  const tierBefore = tier(), xpBefore = profile.xp;
  profile.stats.matches++; profile.stats.kills += r.kills;
  if (r.win) profile.stats.wins++;
  profile.stats.best = profile.stats.best ? Math.min(profile.stats.best, r.place) : r.place;
  profile.coins += coins;
  addXP(xp);
  // missioni legate al risultato
  track('match', 1);
  if (r.mode === 'random') track('match_random', 1);
  if (r.online) track('match_online', 1);
  if (r.place <= 10) track('top10', 1);
  if (r.win) track('win', 1);
  resetMatchMax();
  save();
  return { lines, xp, coins, tierBefore, tierAfter: tier(), xpBefore, xpAfter: profile.xp };
}
export function rarityColor(r) { return RARITIES[r || 0].color; }
