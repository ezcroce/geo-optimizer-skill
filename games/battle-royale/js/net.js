// ─────────────────────────────────────────────────────────────
//  Modalità online: lobby con codice stanza, collegamento peer-to-peer
//  (WebRTC tramite PeerJS: nessun server di gioco, il creatore della lobby fa da "host").
//  Topologia a stella: i client parlano solo con l'host, che inoltra i messaggi agli altri.
//  Per provare in locale con due schede dello stesso browser: gioco.html?net=local
// ─────────────────────────────────────────────────────────────

export const MAX_PLAYERS = 8;
const PREFIX = 'arenaroyale3d-';
const VERSION = 11;
export const GAME_VERSION = 'v45';

// v34: PeerJS (canale JSON) rifiuta i messaggi oltre ~16 KB ("Message too big for JSON channel"):
// l'avvio della partita (100 bot) e le istantanee affollate superavano il limite e facevano cadere il collegamento.
// Ora i messaggi grandi vengono spezzati in pezzi e ricomposti all'arrivo.
const FRAME_MAX = 5000;    // caratteri: sotto questa soglia il messaggio parte intero
const CHUNK = 3500;        // caratteri per pezzo (anche con escape/UTF-8 resta ben sotto i 16 KB)
const WIRE_LIMIT = 16000;  // byte: limite del canale (controllato nel trasporto locale per i test)
let chunkSeq = 0;
function frames(msg) {
  const s = JSON.stringify(msg);
  if (s.length <= FRAME_MAX) return [msg];
  const n = Math.ceil(s.length / CHUNK), k = (chunkSeq = (chunkSeq + 1) % 1e9);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ t: '_c', k, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) });
  return out;
}
class Reassembler {
  constructor() { this.m = new Map(); }
  take(from, msg) {
    if (!msg || msg.t !== '_c') return msg;
    const key = from + ':' + msg.k, now = Date.now();
    let e = this.m.get(key);
    if (!e) {
      for (const [kk, v] of this.m) if (now - v.t > 30000) this.m.delete(kk);
      e = { p: new Array(msg.n), c: 0, t: now };
      this.m.set(key, e);
    }
    if (e.p[msg.i] === undefined) { e.p[msg.i] = msg.d; e.c++; }
    if (e.c < msg.n) return null;
    this.m.delete(key);
    try { return JSON.parse(e.p.join('')); } catch { return null; }
  }
  clear() { this.m.clear(); }
}

export const NET = {
  role: 'off',          // 'off' | 'host' | 'client'
  code: '',             // codice della stanza (5 lettere)
  myId: '',             // id di rete di questo giocatore
  hostId: '',
  players: [],          // lobby: [{ id, name, skin, hat, back, host }]
  mode: 'br',           // modalità scelta dall'host
  team: 'solo',         // v23: singolo / duo / trio / squad
  vs: false,            // v23: true = amici uno contro l'altro (ognuno con la sua squadra di bot)
  inMatch: false,
  status: '',
  transport: null,
  onMessage: null,      // (from, msg) → per il gioco
  onLobby: null,        // () → aggiornare l'interfaccia della lobby
  onChat: null,         // (name, text)
  onClose: null,        // (motivo)
  onStatus: null,       // v36: (testo) avanzamento del collegamento
  local: new URLSearchParams(location.search).get('net') === 'local',
};

function randCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

// ── caricamento pigro di PeerJS (solo quando serve) ──
let peerLib = null;
function loadPeerJS() {
  if (peerLib) return peerLib;
  peerLib = new Promise((res, rej) => {
    if (window.peerjs) { res(window.peerjs); return; }
    const s = document.createElement('script');
    s.src = './vendor/peerjs.min.js?v=19';
    s.onload = () => window.peerjs ? res(window.peerjs) : rej(new Error('PeerJS non disponibile'));
    s.onerror = () => { peerLib = null; rej(new Error('Impossibile caricare PeerJS')); };
    document.head.appendChild(s);
  });
  return peerLib;
}

// ── v36: server STUN/TURN ──
// Senza un server TURN che faccia da ponte, due giocatori dietro NAT "difficili" (CGNAT dei gestori, reti mobili,
// alcune reti di scuola/ufficio) non riescono a collegarsi direttamente e l'ingresso nella lobby restava appeso.
// Più server, anche su TCP/443 (passa quasi ovunque). Si può aggiungere il proprio: ?turn=turn:host:porta|utente|password
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:freestun.net:3478', username: 'free', credential: 'free' },
];
{
  const extra = new URLSearchParams(location.search).get('turn');
  if (extra) { const [urls, username, credential] = extra.split('|'); if (/^turns?:/.test(urls || '')) ICE_SERVERS.unshift({ urls, username, credential }); }
}
function peerOptions(relayOnly = false) {
  return { debug: 1, config: { iceServers: ICE_SERVERS, sdpSemantics: 'unified-plan', iceTransportPolicy: relayOnly ? 'relay' : 'all' } };
}

// ── trasporto WebRTC (PeerJS) ──
class PeerTransport {
  constructor() { this.conns = new Map(); this.peer = null; this.re = new Reassembler(); }
  async host(code, onConn, onData, onDrop) {
    const { Peer } = await loadPeerJS();
    return new Promise((res, rej) => {
      const peer = new Peer(PREFIX + code, peerOptions());
      this.peer = peer;
      let opened = false;
      const to = setTimeout(() => rej(new Error('Il server di collegamento non risponde')), 15000);
      peer.on('open', id => { clearTimeout(to); opened = true; res(id); });
      peer.on('error', e => {
        console.warn('rete (host):', e && e.type, e && e.message);
        if (!opened) { clearTimeout(to); if (e.type === 'unavailable-id') rej(new Error('Codice già in uso, riprova')); else rej(new Error(errText(e))); return; }
        // dopo l'apertura: se si perde il server di collegamento, ci si riaggancia (altrimenti nessuno può più entrare)
        if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e.type)) setTimeout(() => { if (this.peer === peer && peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch { /* */ } }, 2000);
      });
      peer.on('connection', conn => {
        conn.on('open', () => { this.conns.set(conn.peer, conn); onConn(conn.peer); });
        // (il primo messaggio può arrivare insieme all'apertura: il canale va registrato subito, o la risposta si perde)
        conn.on('data', d => { if (conn.open && !this.conns.has(conn.peer)) this.conns.set(conn.peer, conn); const m = this.re.take(conn.peer, d); if (m) onData(conn.peer, m); });
        conn.on('close', () => { if (this.conns.get(conn.peer) === conn) { this.conns.delete(conn.peer); onDrop(conn.peer); } });
        // un errore sul canale (es. messaggio rifiutato) non significa che il giocatore se n'è andato
        conn.on('error', e => { console.warn('rete:', e && (e.type || e.message)); if (!conn.open && this.conns.get(conn.peer) === conn) { this.conns.delete(conn.peer); onDrop(conn.peer); } });
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ignora */ } });
    });
  }
  /**
   * v36: ingresso in tre tentativi (il terzo forzando il ponte TURN), con lo stato passo per passo.
   * Prima un collegamento diretto fallito restava appeso 20 s e finiva con un fuorviante "lobby non trovata".
   */
  async join(code, onData, onDrop, onStatus = () => {}) {
    const { Peer } = await loadPeerJS();
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const relay = attempt === 2;
      if (attempt) onStatus(relay ? 'Collegamento diretto non riuscito: provo attraverso un server ponte…' : 'Nuovo tentativo di collegamento…');
      try { return await this._joinOnce(Peer, PREFIX + code, onData, onDrop, onStatus, relay, relay ? 25000 : 15000, attempt === 0); }
      catch (e) { lastErr = e; this.close(); if (e.fatal) break; }
    }
    throw lastErr || new Error('Collegamento non riuscito');
  }
  _joinOnce(Peer, target, onData, onDrop, onStatus, relay, ms, first) {
    return new Promise((res, rej) => {
      if (first) onStatus('Contatto il server di collegamento…');
      const peer = new Peer(peerOptions(relay));
      this.peer = peer;
      let done = false, stage = 'server';
      const fail = (msg, fatal = false) => { if (done) return; done = true; clearTimeout(to); const e = new Error(msg); e.fatal = fatal; rej(e); };
      const to = setTimeout(() => fail(stage === 'server' ? 'Il server di collegamento non risponde: controlla la connessione'
        : 'Lobby trovata, ma il collegamento con l’host non riesce (rete o firewall). Provate un’altra rete, ad esempio l’hotspot del telefono'), ms);
      peer.on('error', e => {
        console.warn('rete (client):', e && e.type, e && e.message);
        if (e.type === 'peer-unavailable') fail('Nessuna lobby con questo codice: controlla il codice e che l’host tenga aperta la scheda del gioco', true);
        else if (e.type === 'browser-incompatible') fail(errText(e), true);
        else fail(errText(e));
      });
      peer.on('open', id => {
        stage = 'ice';
        if (first || relay) onStatus(relay ? 'Lobby trovata, collegamento attraverso il server ponte…' : 'Lobby trovata, collegamento con l’host…');
        const conn = peer.connect(target, { reliable: true, serialization: 'json' });
        conn.on('open', () => { if (done) return; done = true; clearTimeout(to); this.conns.set(conn.peer, conn); res({ myId: id, hostId: conn.peer }); });
        conn.on('data', d => { const m = this.re.take(conn.peer, d); if (m) onData(conn.peer, m); });
        conn.on('close', () => { if (!done) fail('Collegamento con l’host interrotto'); else if (this.conns.get(conn.peer) === conn) { this.conns.delete(conn.peer); onDrop(conn.peer); } });
        conn.on('error', e => { console.warn('rete:', e && (e.type || e.message)); if (!conn.open) fail('Collegamento con l’host non riuscito (rete o firewall)'); });
      });
    });
  }
  send(id, msg) { const c = this.conns.get(id); if (c && c.open) try { for (const f of frames(msg)) c.send(f); } catch { /* canale chiuso */ } }
  close() { for (const c of this.conns.values()) try { c.close(); } catch { /* */ } this.conns.clear(); this.re.clear(); if (this.peer) try { this.peer.destroy(); } catch { /* */ } this.peer = null; }
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Connessione al server di collegamento non riuscita';
  if (t === 'browser-incompatible') return 'Il browser non supporta WebRTC';
  return (e && e.message) || 'Errore di rete';
}

// ── trasporto locale (BroadcastChannel tra schede dello stesso browser, per i test) ──
class LocalTransport {
  constructor() { this.ch = null; this.id = 'L' + Math.random().toString(36).slice(2, 9); this.conns = new Set(); this.re = new Reassembler(); }
  async host(code, onConn, onData, onDrop) {
    this.ch = new BroadcastChannel(PREFIX + code);
    this.ch.onmessage = ({ data: m }) => {
      if (m.to !== this.id) return;
      if (m.kind === 'connect') { this.conns.add(m.from); this.ch.postMessage({ kind: 'accept', from: this.id, to: m.from }); onConn(m.from); }
      else if (m.kind === 'bye') { this.conns.delete(m.from); onDrop(m.from); }
      else if (this.conns.has(m.from)) { const d = this.re.take(m.from, m.data); if (d) onData(m.from, d); }
    };
    // annuncia l'host a chi lo cerca
    this.ch.addEventListener('message', ({ data: m }) => { if (m.kind === 'find') this.ch.postMessage({ kind: 'here', from: this.id, to: m.from }); });
    return this.id;
  }
  async join(code, onData, onDrop) {
    this.ch = new BroadcastChannel(PREFIX + code);
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Nessuna lobby con questo codice')), 10000);
      this.ch.onmessage = ({ data: m }) => {
        if (m.to !== this.id) return;
        if (m.kind === 'here') this.ch.postMessage({ kind: 'connect', from: this.id, to: m.from });
        else if (m.kind === 'accept') { clearTimeout(to); this.host_ = m.from; this.conns.add(m.from); res({ myId: this.id, hostId: m.from }); }
        else if (m.kind === 'bye') onDrop(m.from);
        else { const d = this.re.take(m.from, m.data); if (d) onData(m.from, d); }
      };
      this.ch.postMessage({ kind: 'find', from: this.id });
    });
  }
  send(id, msg) {
    if (!this.ch) return;
    for (const f of frames(msg)) {
      // stesso limite del canale WebRTC, così i test in locale scoprono i messaggi troppo grandi
      const b = new TextEncoder().encode(JSON.stringify(f)).length;
      if (b >= WIRE_LIMIT) { console.error('rete: messaggio troppo grande', b, f.t); continue; }
      this.ch.postMessage({ from: this.id, to: id, data: f });
    }
  }
  close() { if (this.ch) { for (const c of this.conns) this.ch.postMessage({ kind: 'bye', from: this.id, to: c }); this.ch.close(); } this.ch = null; this.conns.clear(); }
}

// ── API della lobby ──
let me = null;   // { name, skin, hat, back }
function lobbyMsg() { return { t: 'lobby', players: NET.players, mode: NET.mode, team: NET.team, vs: NET.vs, code: NET.code }; }
function hostBroadcastLobby() { broadcast(lobbyMsg()); NET.onLobby && NET.onLobby(); }

function hostOnData(from, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'hello') {
    if (msg.ver !== VERSION) { NET.transport.send(from, { t: 'kick', why: `Versione del gioco diversa (host ${GAME_VERSION}, tu ${msg.gv || 'più vecchia'}): aprite tutti lo stesso link del gioco (il pulsante 🔗 dell’host lo copia)` }); return; }
    if (NET.inMatch) { NET.transport.send(from, { t: 'kick', why: 'La partita è già iniziata' }); return; }
    if (NET.players.length >= MAX_PLAYERS) { NET.transport.send(from, { t: 'kick', why: 'Lobby piena' }); return; }
    const p = NET.players.find(x => x.id === from) || { id: from };
    Object.assign(p, { name: String(msg.name || 'Ospite').slice(0, 16), skin: msg.skin, hat: msg.hat, back: msg.back, glider: msg.glider, host: false });
    if (!NET.players.includes(p)) NET.players.push(p);
    hostBroadcastLobby();
    NET.onChat && NET.onChat('', `${p.name} è entrato nella lobby`);
    broadcast({ t: 'chat', name: '', text: `${p.name} è entrato nella lobby` }, from);
    return;
  }
  if (msg.t === 'chat') {
    const p = NET.players.find(x => x.id === from);
    const m = { t: 'chat', name: p ? p.name : '?', text: String(msg.text || '').slice(0, 140) };
    NET.onChat && NET.onChat(m.name, m.text);
    broadcast(m, from);
    return;
  }
  // messaggi di gioco: li usa l'host e li inoltra agli altri
  if (msg.relay !== false) broadcast(msg, from);
  NET.onMessage && NET.onMessage(from, msg);
}
function hostOnDrop(id) {
  const i = NET.players.findIndex(p => p.id === id);
  if (i < 0) return;
  const p = NET.players[i];
  NET.players.splice(i, 1);
  NET.onChat && NET.onChat('', `${p.name} ha lasciato la lobby`);
  broadcast({ t: 'chat', name: '', text: `${p.name} ha lasciato la lobby` });
  if (NET.inMatch) { const m = { t: 'ev', e: 'left', id }; broadcast(m); NET.onMessage && NET.onMessage(id, m); }
  else hostBroadcastLobby();
}
function clientOnData(from, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'lobby') { NET.players = msg.players; NET.mode = msg.mode; NET.team = msg.team || 'solo'; NET.vs = !!msg.vs; NET.onLobby && NET.onLobby(); return; }
  if (msg.t === 'chat') { NET.onChat && NET.onChat(msg.name, msg.text); return; }
  if (msg.t === 'kick') { const why = msg.why; leaveLobby(true); NET.onClose && NET.onClose(why); return; }
  NET.onMessage && NET.onMessage(from, msg);
}
function clientOnDrop() {
  if (NET.role !== 'client') return;
  leaveLobby(true);
  NET.onClose && NET.onClose("L'host ha chiuso la lobby");
}

export async function createLobby(info) {
  leaveLobby(true);
  me = info;
  NET.transport = NET.local ? new LocalTransport() : new PeerTransport();
  NET.status = 'Creazione della lobby…';
  let lastErr;
  for (let k = 0; k < 3; k++) {
    const code = randCode();
    try {
      const id = await NET.transport.host(code, () => { /* aspetta "hello" */ }, hostOnData, hostOnDrop);
      NET.role = 'host'; NET.code = code; NET.myId = id; NET.hostId = id;
      NET.players = [{ id, name: info.name, skin: info.skin, hat: info.hat, back: info.back, glider: info.glider, host: true }];
      NET.status = '';
      NET.onLobby && NET.onLobby();
      return code;
    } catch (e) { lastErr = e; NET.transport.close(); NET.transport = NET.local ? new LocalTransport() : new PeerTransport(); }
  }
  NET.transport = null; NET.status = '';
  throw lastErr || new Error('Impossibile creare la lobby');
}
export async function joinLobby(code, info) {
  leaveLobby(true);
  me = info;
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error('Il codice è di 5 caratteri');
  NET.transport = NET.local ? new LocalTransport() : new PeerTransport();
  NET.status = 'Collegamento alla lobby…';
  try {
    const { myId, hostId } = await NET.transport.join(code, clientOnData, clientOnDrop, (t) => { NET.status = t; NET.onStatus && NET.onStatus(t); });
    NET.role = 'client'; NET.code = code; NET.myId = myId; NET.hostId = hostId;
    NET.status = '';
    NET.transport.send(hostId, { t: 'hello', ver: VERSION, gv: GAME_VERSION, ...info });
    return code;
  } catch (e) {
    if (NET.transport) NET.transport.close();
    NET.transport = null; NET.status = '';
    throw e;
  }
}
export function leaveLobby(silent = false) {
  if (NET.transport) NET.transport.close();
  NET.transport = null;
  const was = NET.role;
  NET.role = 'off'; NET.code = ''; NET.players = []; NET.inMatch = false; NET.myId = ''; NET.hostId = '';
  if (!silent && was !== 'off') NET.onLobby && NET.onLobby();
}
/** aggiorna nome/skin/cosmetici nella lobby */
export function updateMe(info) {
  me = Object.assign(me || {}, info);
  if (NET.role === 'host') { Object.assign(NET.players[0], info); hostBroadcastLobby(); }
  else if (NET.role === 'client') NET.transport.send(NET.hostId, { t: 'hello', ver: VERSION, gv: GAME_VERSION, ...me });
}
export function setMode(mode) { NET.mode = mode; if (NET.role === 'host') hostBroadcastLobby(); }
/** v23: dimensione squadre e Squadra/Versus (solo l'host) */
export function setTeam(team, vs) { NET.team = team; NET.vs = !!vs; if (NET.role === 'host') hostBroadcastLobby(); }
export function chat(text) {
  text = String(text || '').trim().slice(0, 140);
  if (!text || NET.role === 'off') return;
  if (NET.role === 'host') { broadcast({ t: 'chat', name: me.name, text }); NET.onChat && NET.onChat(me.name, text); }
  else { NET.transport.send(NET.hostId, { t: 'chat', text }); NET.onChat && NET.onChat(me.name, text); }
}
/** host: a tutti i client (tranne uno) · client: all'host */
export function broadcast(msg, except = null) {
  if (!NET.transport) return;
  if (NET.role === 'host') { for (const p of NET.players) if (!p.host && p.id !== except) NET.transport.send(p.id, msg); }
  else if (NET.role === 'client') NET.transport.send(NET.hostId, msg);
}
export function sendTo(id, msg) { if (NET.transport) NET.transport.send(id, msg); }
export const send = broadcast;
