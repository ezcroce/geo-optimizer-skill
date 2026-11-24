// ─────────────────────────────────────────────────────────────
//  Modalità online: lobby con codice stanza, collegamento peer-to-peer
//  (WebRTC tramite PeerJS: nessun server di gioco, il creatore della lobby fa da "host").
//  Topologia a stella: i client parlano solo con l'host, che inoltra i messaggi agli altri.
//  Per provare in locale con due schede dello stesso browser: gioco.html?net=local
// ─────────────────────────────────────────────────────────────

export const MAX_PLAYERS = 8;
const PREFIX = 'arenaroyale3d-';
const VERSION = 8;

export const NET = {
  role: 'off',          // 'off' | 'host' | 'client'
  code: '',             // codice della stanza (5 lettere)
  myId: '',             // id di rete di questo giocatore
  hostId: '',
  players: [],          // lobby: [{ id, name, skin, hat, back, host }]
  mode: 'br',           // modalità scelta dall'host
  inMatch: false,
  status: '',
  transport: null,
  onMessage: null,      // (from, msg) → per il gioco
  onLobby: null,        // () → aggiornare l'interfaccia della lobby
  onChat: null,         // (name, text)
  onClose: null,        // (motivo)
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
    s.src = './vendor/peerjs.min.js?v=9';
    s.onload = () => window.peerjs ? res(window.peerjs) : rej(new Error('PeerJS non disponibile'));
    s.onerror = () => { peerLib = null; rej(new Error('Impossibile caricare PeerJS')); };
    document.head.appendChild(s);
  });
  return peerLib;
}

// ── trasporto WebRTC (PeerJS) ──
class PeerTransport {
  constructor() { this.conns = new Map(); this.peer = null; }
  async host(code, onConn, onData, onDrop) {
    const { Peer } = await loadPeerJS();
    return new Promise((res, rej) => {
      const peer = new Peer(PREFIX + code, { debug: 0 });
      this.peer = peer;
      const to = setTimeout(() => rej(new Error('Il server di collegamento non risponde')), 15000);
      peer.on('open', id => { clearTimeout(to); res(id); });
      peer.on('error', e => { clearTimeout(to); if (e.type === 'unavailable-id') rej(new Error('Codice già in uso, riprova')); else rej(new Error(errText(e))); });
      peer.on('connection', conn => {
        conn.on('open', () => { this.conns.set(conn.peer, conn); onConn(conn.peer); });
        conn.on('data', d => onData(conn.peer, d));
        conn.on('close', () => { this.conns.delete(conn.peer); onDrop(conn.peer); });
        conn.on('error', () => { this.conns.delete(conn.peer); onDrop(conn.peer); });
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ignora */ } });
    });
  }
  async join(code, onData, onDrop) {
    const { Peer } = await loadPeerJS();
    return new Promise((res, rej) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const to = setTimeout(() => rej(new Error('Lobby non trovata o host non raggiungibile')), 20000);
      peer.on('error', e => { clearTimeout(to); rej(new Error(e.type === 'peer-unavailable' ? 'Nessuna lobby con questo codice' : errText(e))); });
      peer.on('open', id => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => { clearTimeout(to); this.conns.set(conn.peer, conn); res({ myId: id, hostId: conn.peer }); });
        conn.on('data', d => onData(conn.peer, d));
        conn.on('close', () => onDrop(conn.peer));
        conn.on('error', () => onDrop(conn.peer));
      });
    });
  }
  send(id, msg) { const c = this.conns.get(id); if (c && c.open) try { c.send(msg); } catch { /* canale chiuso */ } }
  close() { for (const c of this.conns.values()) try { c.close(); } catch { /* */ } this.conns.clear(); if (this.peer) try { this.peer.destroy(); } catch { /* */ } this.peer = null; }
}
function errText(e) {
  const t = e && e.type;
  if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Connessione al server di collegamento non riuscita';
  if (t === 'browser-incompatible') return 'Il browser non supporta WebRTC';
  return (e && e.message) || 'Errore di rete';
}

// ── trasporto locale (BroadcastChannel tra schede dello stesso browser, per i test) ──
class LocalTransport {
  constructor() { this.ch = null; this.id = 'L' + Math.random().toString(36).slice(2, 9); this.conns = new Set(); }
  async host(code, onConn, onData, onDrop) {
    this.ch = new BroadcastChannel(PREFIX + code);
    this.ch.onmessage = ({ data: m }) => {
      if (m.to !== this.id) return;
      if (m.kind === 'connect') { this.conns.add(m.from); this.ch.postMessage({ kind: 'accept', from: this.id, to: m.from }); onConn(m.from); }
      else if (m.kind === 'bye') { this.conns.delete(m.from); onDrop(m.from); }
      else if (this.conns.has(m.from)) onData(m.from, m.data);
    };
    // annuncia l'host a chi lo cerca
    this.ch.addEventListener('message', ({ data: m }) => { if (m.kind === 'find') this.ch.postMessage({ kind: 'here', from: this.id, to: m.from }); });
    return this.id;
  }
  async join(code, onData, onDrop) {
    this.ch = new BroadcastChannel(PREFIX + code);
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Nessuna lobby con questo codice')), 3000);
      this.ch.onmessage = ({ data: m }) => {
        if (m.to !== this.id) return;
        if (m.kind === 'here') this.ch.postMessage({ kind: 'connect', from: this.id, to: m.from });
        else if (m.kind === 'accept') { clearTimeout(to); this.host_ = m.from; this.conns.add(m.from); res({ myId: this.id, hostId: m.from }); }
        else if (m.kind === 'bye') onDrop(m.from);
        else onData(m.from, m.data);
      };
      this.ch.postMessage({ kind: 'find', from: this.id });
    });
  }
  send(id, msg) { if (this.ch) this.ch.postMessage({ from: this.id, to: id, data: msg }); }
  close() { if (this.ch) { for (const c of this.conns) this.ch.postMessage({ kind: 'bye', from: this.id, to: c }); this.ch.close(); } this.ch = null; this.conns.clear(); }
}

// ── API della lobby ──
let me = null;   // { name, skin, hat, back }
function lobbyMsg() { return { t: 'lobby', players: NET.players, mode: NET.mode, code: NET.code }; }
function hostBroadcastLobby() { broadcast(lobbyMsg()); NET.onLobby && NET.onLobby(); }

function hostOnData(from, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'hello') {
    if (msg.ver !== VERSION) { NET.transport.send(from, { t: 'kick', why: 'Versione del gioco diversa: ricarica la pagina' }); return; }
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
  if (msg.t === 'lobby') { NET.players = msg.players; NET.mode = msg.mode; NET.onLobby && NET.onLobby(); return; }
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
    const { myId, hostId } = await NET.transport.join(code, clientOnData, clientOnDrop);
    NET.role = 'client'; NET.code = code; NET.myId = myId; NET.hostId = hostId;
    NET.status = '';
    NET.transport.send(hostId, { t: 'hello', ver: VERSION, ...info });
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
  else if (NET.role === 'client') NET.transport.send(NET.hostId, { t: 'hello', ver: VERSION, ...me });
}
export function setMode(mode) { NET.mode = mode; if (NET.role === 'host') hostBroadcastLobby(); }
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
