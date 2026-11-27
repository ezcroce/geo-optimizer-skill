/* Infinite Alibi — server online autoritativo (Node.js + WebSocket).
 *
 *  - Serve i file statici del gioco e accetta WebSocket su /ws (una sola porta).
 *  - Genera il caso dal seed in modo deterministico (stesso codice del client: js/world.js).
 *  - Anti-cheat: agli investigatori NON arrivano mai seed, colpevole o percorsi reali prima del
 *    verdetto. Ricevono solo il filmato "precotto" (IA.bakeFootage), cioè ciò che si vede.
 *    Il Colpevole riceve seed e indice per poter montare; le sue modifiche vengono validate qui.
 *  - Fasi e timer sono decisi dal server: lobby → edit → evidence → trial → vote
 *    [→ overtime → runoff] → verdict.
 *
 * Avvio:  npm install && npm start      (PORT=8080 di default)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

require('../js/world.js');
require('../js/footage.js');
const IA = globalThis.IA;

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS || 3);
const MAX_PLAYERS = 6;
const REVEAL_PAUSE = Number(process.env.REVEAL_PAUSE || 4); // secondi per guardare i voti prima dei supplementari

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res) {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (_) { res.writeHead(400); res.end('bad request'); return; }
  if (url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  // La homepage e i due giochi condividono la stessa origine, incluso /ws.
  const GAMES = path.resolve(ROOT, '..');
  if (url === '/infinite-alibi' || url === '/infinite-alibi-tactical' || url === '/infinite-alibi-heist') {
    res.writeHead(302, { location: url + '/' }); res.end(); return;
  }
  let root, relative;
  if (url === '/' || url === '/index.html') { root = GAMES; relative = 'index.html'; }
  else if (url.startsWith('/infinite-alibi-heist/')) {
    root = path.join(GAMES, 'infinite-alibi-heist');
    relative = url.slice('/infinite-alibi-heist/'.length) || 'index.html';
  } else if (url.startsWith('/infinite-alibi-tactical/')) {
    root = path.join(GAMES, 'infinite-alibi-tactical');
    relative = url.slice('/infinite-alibi-tactical/'.length) || 'index.html';
  } else if (url.startsWith('/infinite-alibi/')) {
    root = ROOT; relative = url.slice('/infinite-alibi/'.length) || 'index.html';
  } else { // compatibilità con gli URL precedenti del gioco originale
    root = ROOT; relative = url.slice(1);
  }
  const file = path.resolve(root, relative);
  const rel = path.relative(root, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || /^(server|node_modules|tests)([\\/]|$)/.test(rel) || rel.startsWith('package')) {
    res.writeHead(404); res.end('not found'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Stanze
// ---------------------------------------------------------------------------
const rooms = new Map();
const PHASES = IA.CONFIG.phases;

function code4() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}
function send(ws, type, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ type }, data || {})));
}
function broadcast(room, type, data, except) {
  for (const p of room.players) if (p !== except) send(p.ws, type, data);
}
function publicPlayers(room) {
  return room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, idx: p.idx }));
}
function roomState(room) {
  return { code: room.code, hostId: room.hostId, phase: room.phase, settings: room.settings, players: publicPlayers(room), scores: room.scores };
}
function pushRoom(room) {
  broadcast(room, 'room', roomState(room));
}
function remaining(room) {
  return room.deadline ? Math.max(0, (room.deadline - Date.now()) / 1000) : null;
}

function setPhase(room, phase, seconds, extra) {
  clearTimeout(room.timer);
  room.phase = phase;
  const mul = room.settings.timerMul;
  const secs = seconds != null && mul ? seconds * mul : null;
  room.deadline = secs ? Date.now() + secs * 1000 : null;
  if (secs) room.timer = setTimeout(() => onTimeout(room, phase), secs * 1000);
  broadcast(room, 'phase', Object.assign({ phase, seconds: secs }, extra || {}));
}

function onTimeout(room, phase) {
  if (room.phase !== phase) return;
  if (phase === 'edit') startEvidence(room);
  else if (phase === 'evidence') setPhase(room, 'trial', PHASES.trial);
  else if (phase === 'trial') startVote(room, null);
  else if (phase === 'overtime') startVote(room, room.candidates);
}

function startCase(room) {
  const active = room.players.filter((p) => p.connected);
  room.players = active; // chi è uscito durante la lobby non rientra nel caso
  const n = active.length;
  IA.setDifficulty(room.settings.difficulty);
  room.seed = crypto.randomInt(1, 1e6);
  room.culprit = crypto.randomInt(n);
  room.names = active.map((p) => p.name);
  room.initials = IA.makeInitials(room.names);
  active.forEach((p, i) => (p.idx = i));
  room.cs = IA.generateCase(room.seed, n, room.culprit);
  room.cs.names = room.names;
  room.edits = IA.emptyEdits();
  room.votes = {};
  room.candidates = null;
  room.round = 0;
  room.baked = null;
  room.hints = null;
  room.lensUsed = {};
  room.verdict = null;
  for (const p of active) sendRole(room, p);
  pushRoom(room);
  setPhase(room, 'edit', PHASES.edit);
}

function sendRole(room, p) {
  const isCulprit = p.idx === room.culprit;
  send(p.ws, 'role', {
    index: p.idx,
    culprit: isCulprit,
    n: room.names.length,
    names: room.names,
    initials: room.initials,
    difficulty: room.settings.difficulty,
    aids: room.settings.aids,
    // solo il Colpevole riceve i dati per rigenerare il filmato reale e montarlo
    secret: isCulprit ? { seed: room.seed, culprit: room.culprit } : undefined,
  });
}

function startEvidence(room) {
  IA.setDifficulty(room.settings.difficulty);
  if (IA.validateEdits(room.cs, room.edits).length) room.edits = IA.emptyEdits();
  room.baked = IA.bakeFootage(room.cs, room.edits);
  if (room.settings.aids) room.hints = buildHints(room);
  broadcast(room, 'footage', { baked: room.baked, hints: room.hints ? { glow: room.hints.glow, lenses: 2 } : null });
  setPhase(room, 'evidence', PHASES.evidence);
}

// Aiuti per principianti: stessa logica del client (IA.anomalyHints), calcolata solo qui.
function buildHints(room) {
  return IA.anomalyHints(room.cs, IA.analyze(room.cs, room.edits).clues);
}

function startVote(room, candidates) {
  room.votes = {};
  room.candidates = candidates;
  setPhase(room, candidates ? 'runoff' : 'vote', null, { candidates });
}

function connectedVoters(room) {
  return room.players.filter((p) => p.connected && p.idx != null);
}

function maybeCloseVote(room, force) {
  const voters = connectedVoters(room);
  const done = voters.every((p) => room.votes[p.idx] != null);
  broadcast(room, 'voteStatus', { voted: Object.keys(room.votes).map(Number), total: voters.length });
  if (!done && !force) return;
  const n = room.names.length;
  const arr = new Array(n).fill(0);
  for (const k in room.votes) arr[room.votes[k]]++;
  const r = IA.tallyResult(arr);
  const votes = Object.assign({}, room.votes);
  if (r.tied && room.round === 0) {
    room.round = 1;
    room.candidates = r.top;
    broadcast(room, 'tally', { votes, tally: arr, result: 'overtime', candidates: r.top });
    clearTimeout(room.timer);
    room.phase = 'tally';
    room.timer = setTimeout(() => setPhase(room, 'overtime', PHASES.overtime, { candidates: r.top }), REVEAL_PAUSE * 1000);
    return;
  }
  const convicted = r.tied ? -1 : r.convicted;
  const caught = convicted === room.culprit;
  // classifica: +1 a chi vota il Colpevole, +3 al Colpevole se la fa franca
  for (const k in votes) if (Number(k) !== room.culprit && votes[k] === room.culprit) room.scores[room.names[k]] = (room.scores[room.names[k]] || 0) + 1;
  if (!caught) room.scores[room.names[room.culprit]] = (room.scores[room.names[room.culprit]] || 0) + 3;
  room.verdict = { caught, convicted, tally: arr, votes, runoff: room.round > 0 };
  broadcast(room, 'tally', { votes, tally: arr, result: caught ? 'caught' : convicted >= 0 ? 'innocent' : 'escaped' });
  // solo ora la verità diventa pubblica
  broadcast(room, 'reveal', { seed: room.seed, culprit: room.culprit, edits: room.edits, verdict: room.verdict, difficulty: room.settings.difficulty, scores: room.scores });
  setPhase(room, 'verdict', null);
  pushRoom(room);
}

// ---------------------------------------------------------------------------
// Messaggi
// ---------------------------------------------------------------------------
function cleanName(s) {
  return String(s || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Giocatore';
}

function handle(ws, msg) {
  const me = ws.player;
  const room = me && rooms.get(me.room);
  switch (msg.type) {
    case 'create': {
      const r = { code: code4(), players: [], hostId: null, phase: 'lobby', settings: { difficulty: 'normale', timerMul: 1, aids: false }, scores: {}, timer: null };
      rooms.set(r.code, r);
      join(ws, r, msg.name);
      break;
    }
    case 'join': {
      const r = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!r) return send(ws, 'error', { message: 'Stanza inesistente' });
      if (msg.id) {
        const old = r.players.find((p) => p.id === msg.id);
        if (old) return rejoin(ws, r, old);
      }
      if (r.phase !== 'lobby' && r.phase !== 'verdict') return send(ws, 'error', { message: 'Partita già in corso' });
      if (r.players.length >= MAX_PLAYERS) return send(ws, 'error', { message: 'Stanza piena (max 6)' });
      join(ws, r, msg.name);
      break;
    }
    case 'settings': {
      if (!room || room.hostId !== me.id || (room.phase !== 'lobby' && room.phase !== 'verdict')) return;
      const s = msg.settings || {};
      if (IA.CONFIG.DIFFICULTY[s.difficulty]) room.settings.difficulty = s.difficulty;
      if ([0, 1, 2].includes(Number(s.timerMul))) room.settings.timerMul = Number(s.timerMul);
      if (typeof s.aids === 'boolean') room.settings.aids = s.aids;
      pushRoom(room);
      break;
    }
    case 'start': {
      if (!room || room.hostId !== me.id) return;
      if (room.phase !== 'lobby' && room.phase !== 'verdict') return;
      if (room.players.filter((p) => p.connected).length < MIN_PLAYERS) return send(ws, 'error', { message: `Servono almeno ${MIN_PLAYERS} giocatori` });
      startCase(room);
      break;
    }
    case 'edits': {
      if (!room || room.phase !== 'edit' || me.idx !== room.culprit) return;
      IA.setDifficulty(room.settings.difficulty);
      const e = sanitizeEdits(msg.edits);
      const errs = IA.validateEdits(room.cs, e);
      if (errs.length) return send(ws, 'error', { message: errs.join(', ') });
      room.edits = e;
      if (msg.final) startEvidence(room);
      break;
    }
    case 'next': {
      if (!room || room.hostId !== me.id) return;
      if (room.phase === 'evidence') setPhase(room, 'trial', PHASES.trial);
      else if (room.phase === 'trial') startVote(room, null);
      else if (room.phase === 'overtime') startVote(room, room.candidates);
      else if (room.phase === 'vote' || room.phase === 'runoff') maybeCloseVote(room, true);
      break;
    }
    case 'vote': {
      if (!room || (room.phase !== 'vote' && room.phase !== 'runoff') || me.idx == null) return;
      const t = Number(msg.target);
      if (!Number.isInteger(t) || t < 0 || t >= room.names.length || t === me.idx) return send(ws, 'error', { message: 'Voto non valido' });
      if (room.candidates && !room.candidates.includes(t)) return send(ws, 'error', { message: 'Al ballottaggio si vota solo fra i sospettati' });
      room.votes[me.idx] = t;
      maybeCloseVote(room, false);
      break;
    }
    case 'laser': {
      if (!room || !['trial', 'overtime', 'evidence'].includes(room.phase) || me.idx == null) return;
      const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
      broadcast(room, 'laser', { from: me.idx, cam: n(msg.cam, 0, 5) | 0, lx: n(msg.lx, 0, 240), ly: n(msg.ly, 0, 180), t: n(msg.t, 0, 30), start: !!msg.start }, me);
      break;
    }
    case 'say': {
      if (!room || me.idx == null) return;
      const text = String(msg.text || '').replace(/[<>]/g, '').slice(0, 160).trim();
      let mark;
      if (msg.mark && typeof msg.mark === 'object') {
        const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
        mark = { cam: n(msg.mark.cam, 0, 5) | 0, lx: n(msg.mark.lx, 0, 240), ly: n(msg.mark.ly, 0, 180), t: n(msg.mark.t, 0, 30) };
      }
      if (text) broadcast(room, 'chat', { from: me.idx, text, mark });
      break;
    }
    case 'lens': {
      if (!room || room.phase !== 'evidence' || !room.hints) return;
      const used = room.lensUsed[me.id] || 0;
      if (used >= 2) return send(ws, 'error', { message: 'Lenti esaurite' });
      room.lensUsed[me.id] = used + 1;
      const target = room.hints.lens[used] || null;
      send(ws, 'lens', { target, left: 1 - used });
      break;
    }
    default:
      send(ws, 'error', { message: 'Messaggio sconosciuto' });
  }
}

function sanitizeEdits(e) {
  e = e || {};
  const num = (v) => Math.round(Number(v) * 10) / 10;
  const out = IA.emptyEdits();
  if (e.splice) out.splice = { cam: num(e.splice.cam) | 0, t0: num(e.splice.t0), len: num(e.splice.len), src0: num(e.splice.src0) };
  if (e.glitch) out.glitch = { cam: num(e.glitch.cam) | 0, t0: num(e.glitch.t0), len: num(e.glitch.len) };
  if (e.deepfake) out.deepfake = { t: num(e.deepfake.t), victim: num(e.deepfake.victim) | 0, weak: e.deepfake.weak === 'shadow' ? 'shadow' : 'prop' };
  for (const k of ['splice', 'glitch']) if (out[k] && (out[k].cam < 0 || out[k].cam > 5)) out[k] = null;
  return out;
}

function join(ws, room, name) {
  const p = { id: crypto.randomUUID(), name: cleanName(name), ws, connected: true, idx: null, room: room.code };
  room.players.push(p);
  if (!room.hostId) room.hostId = p.id;
  ws.player = p;
  send(ws, 'joined', { id: p.id, code: room.code });
  pushRoom(room);
}

function rejoin(ws, room, p) {
  if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch (e) { /* già chiuso */ } }
  p.ws = ws;
  p.connected = true;
  ws.player = p;
  send(ws, 'joined', { id: p.id, code: room.code, rejoined: true });
  pushRoom(room);
  if (room.phase !== 'lobby' && p.idx != null) {
    sendRole(room, p);
    if (room.baked) send(ws, 'footage', { baked: room.baked, hints: room.hints ? { glow: room.hints.glow, lenses: Math.max(0, 2 - (room.lensUsed[p.id] || 0)) } : null });
    if (room.verdict) send(ws, 'reveal', { seed: room.seed, culprit: room.culprit, edits: room.edits, verdict: room.verdict, difficulty: room.settings.difficulty, scores: room.scores });
    send(ws, 'phase', { phase: room.phase, seconds: remaining(room), candidates: room.candidates });
  }
}

function onClose(ws) {
  const p = ws.player;
  if (!p) return;
  const room = rooms.get(p.room);
  if (!room || p.ws !== ws) return;
  p.connected = false;
  if (room.phase === 'lobby') room.players = room.players.filter((x) => x !== p);
  if (room.hostId === p.id) {
    const next = room.players.find((x) => x.connected);
    room.hostId = next ? next.id : null;
  }
  if (!room.players.some((x) => x.connected)) {
    clearTimeout(room.timer);
    // la stanza resta qualche minuto per eventuali riconnessioni
    room.cleanup = setTimeout(() => { if (!room.players.some((x) => x.connected)) rooms.delete(room.code); }, 5 * 60 * 1000);
    return;
  }
  clearTimeout(room.cleanup);
  pushRoom(room);
  if (room.phase === 'vote' || room.phase === 'runoff') maybeCloseVote(room, false);
}

function createServer() {
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch (e) { return send(ws, 'error', { message: 'JSON non valido' }); }
      try { handle(ws, msg); } catch (e) { console.error(e); send(ws, 'error', { message: 'Errore del server' }); }
    });
    ws.on('close', () => onClose(ws));
  });
  return { server, wss, rooms };
}

if (require.main === module) {
  const { server } = createServer();
  server.listen(PORT, HOST, () => console.log(`Infinite Alibi online su http://${HOST}:${PORT}  (WebSocket: /ws)`));
}

module.exports = { createServer };
