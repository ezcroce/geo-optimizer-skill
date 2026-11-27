/* Infinite Alibi — Modalità Streamer: legge la chat di Twitch in sola lettura (login anonimo
 * "justinfan", nessun token) via WebSocket IRC e trasforma i messaggi in comandi di gioco.
 *
 * Comandi supportati in chat:
 *   !vota <iniziale | numero | nome>   voto del pubblico (uno per spettatore, l'ultimo vale)
 *   !glitch                            disturbo di segnale FINTO e dichiarato sullo schermo
 *                                      (cooldown globale): non conta come prova
 *   !indizio <testo>                   il messaggio compare nel riquadro della chat
 */
(function (root) {
  'use strict';
  const IA = (root.IA = root.IA || {});

  function parseIrc(line) {
    // @tags :prefix COMMAND params :trailing
    let rest = line;
    const out = { tags: {}, prefix: '', command: '', params: [], trailing: '' };
    if (rest.startsWith('@')) {
      const sp = rest.indexOf(' ');
      rest.slice(1, sp).split(';').forEach((kv) => { const [k, v] = kv.split('='); out.tags[k] = v || ''; });
      rest = rest.slice(sp + 1);
    }
    if (rest.startsWith(':')) {
      const sp = rest.indexOf(' ');
      out.prefix = rest.slice(1, sp);
      rest = rest.slice(sp + 1);
    }
    const ti = rest.indexOf(' :');
    if (ti >= 0) { out.trailing = rest.slice(ti + 2); rest = rest.slice(0, ti); }
    const parts = rest.split(' ').filter(Boolean);
    out.command = parts.shift() || '';
    out.params = parts;
    return out;
  }

  /** Interpreta un messaggio di chat in un comando di gioco (null se non è un comando). */
  function parseCommand(text) {
    const m = String(text).trim().match(/^!(\w+)\s*(.*)$/);
    if (!m) return null;
    const cmd = m[1].toLowerCase();
    const arg = m[2].trim();
    if (cmd === 'vota' || cmd === 'voto' || cmd === 'vote') return { type: 'vote', arg };
    if (cmd === 'glitch') return { type: 'glitch' };
    if (cmd === 'indizio' || cmd === 'clue') return { type: 'clue', arg: arg.slice(0, 140) };
    return null;
  }

  /** Risolve l'argomento di !vota in un indice di personaggio (o -1). */
  function resolveSuspect(arg, names, initials) {
    const a = String(arg || '').trim().toLowerCase();
    if (!a) return -1;
    const n = parseInt(a, 10);
    if (!isNaN(n) && n >= 1 && n <= names.length) return n - 1;
    let idx = initials.findIndex((x, i) => i < names.length && String(x).toLowerCase() === a);
    if (idx >= 0) return idx;
    idx = names.findIndex((nm) => nm.toLowerCase().split(/\s+/).some((w) => w.replace(/[()]/g, '') === a));
    if (idx >= 0) return idx;
    return names.findIndex((nm) => nm.toLowerCase().includes(a));
  }

  function TwitchChat(handlers) {
    this.h = handlers || {};
    this.ws = null;
    this.channel = null;
    this.status = 'off';
  }
  TwitchChat.prototype.connect = function (channel) {
    this.disconnect();
    const ch = String(channel || '').trim().replace(/^#/, '').toLowerCase();
    if (!/^[a-z0-9_]{2,25}$/.test(ch)) { this.setStatus('error', 'Nome canale non valido'); return; }
    this.channel = ch;
    this.setStatus('connecting');
    let ws;
    try { ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (e) { this.setStatus('error', e.message); return; }
    this.ws = ws;
    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
      ws.send('JOIN #' + ch);
    };
    ws.onmessage = (ev) => {
      String(ev.data).split('\r\n').filter(Boolean).forEach((line) => {
        const m = parseIrc(line);
        if (m.command === 'PING') ws.send('PONG :' + (m.trailing || 'tmi.twitch.tv'));
        else if (m.command === '366' || m.command === 'ROOMSTATE') this.setStatus('live');
        else if (m.command === 'PRIVMSG') {
          const user = m.tags['display-name'] || m.prefix.split('!')[0];
          this.receive(user, m.trailing);
        }
      });
    };
    ws.onerror = () => this.setStatus('error', 'Connessione a Twitch non riuscita');
    ws.onclose = () => { if (this.ws === ws) this.setStatus('off'); };
  };
  TwitchChat.prototype.receive = function (user, text) {
    if (this.h.message) this.h.message(user, text, parseCommand(text));
  };
  TwitchChat.prototype.disconnect = function () {
    if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) { /* già chiuso */ } }
    this.setStatus('off');
  };
  TwitchChat.prototype.setStatus = function (s, msg) {
    this.status = s;
    if (this.h.status) this.h.status(s, msg);
  };

  IA.TwitchChat = TwitchChat;
  IA.parseIrc = parseIrc;
  IA.parseCommand = parseCommand;
  IA.resolveSuspect = resolveSuspect;
})(typeof window !== 'undefined' ? window : globalThis);
