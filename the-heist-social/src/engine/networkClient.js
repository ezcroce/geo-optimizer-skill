import { hasLineOfSight, sightObstacles, playerSightRange } from './vision.js';
import { Peer } from 'peerjs';
import { io } from 'socket.io-client';
import { GameSimulation } from './gameSimulation.js';
import { CHARACTER_PRESETS } from '../data/characters.js';
import { canReceiveEvent, publicJewels } from './privacy.js';

const PEER_PREFIX = 'ths-villa-2026-';

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VL-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function maskStateForRecipient(state, recipientId) {
  const me = state.players.find((p) => p.id === recipientId);
  const revealAll = state.phase === 'gameover';
  const obstacles = sightObstacles(state.sabotage);
  const sightRange = playerSightRange(me, state.sabotage);
  return {
    phase: state.phase,
    matchTime: state.matchTime,
    emergencyCooldown: state.emergencyCooldown,
    jewels: publicJewels(state.jewels, revealAll || me?.role === 'thief'),
    stolenJewelsCount: state.stolenJewelsCount,
    jewelQuota: state.jewelQuota,
    mainDiamond: {
      name: state.mainDiamond.name,
      recoveredByCivilians: state.mainDiamond.recoveredByCivilians,
      carrierId: revealAll || me?.role === 'thief' ? state.mainDiamond.carrierId : null,
      stashedAt: revealAll || me?.role === 'thief' ? state.mainDiamond.stashedAt : null,
    },
    securityProgress: state.securityProgress,
    sabotage: state.sabotage,
    recentCctvLogs: revealAll || (me?.role === 'civilian' && me.usingCctv) ? state.recentCctvLogs : [],
    thiefCaughtMoments: revealAll ? state.thiefCaughtMoments || [] : [],
    meeting: state.meeting,
    winner: state.winner,
    winReason: state.winReason,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      role: revealAll || p.id === recipientId || p.eliminated ? p.role : 'unknown',
      appearance: p.appearance,
      x: p.x,
      z: p.z,
      rotY: p.rotY,
      speed: p.speed,
      eliminated: p.eliminated,
      hidden: p.hidden,
      usingCctv: p.usingCctv,
      interacting: p.interacting,
      activeCrime: (revealAll || p.id === recipientId || (me?.role === 'civilian' && me.usingCctv) || (me && !p.hidden && hasLineOfSight(me, p, sightRange, obstacles))) ? p.activeCrime : null,
      currentRoom: p.currentRoom,
      emergencyCallsLeft: p.id === recipientId ? p.emergencyCallsLeft : undefined,
      cctvBattery: p.id === recipientId ? p.cctvBattery : undefined,
      assignedTasks: p.id === recipientId ? p.assignedTasks : [],
      savedEvidence: p.id === recipientId ? p.savedEvidence : [],
    })),
  };
}

export class NetworkClient {
  constructor(handlers = {}) {
    this.ws = null;
    this.socket = null;
    this.transport = null; // 'ws' | 'webrtc'
    this.playerId = null;
    this.connected = false;
    this.handlers = handlers;
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Local profile cache (used in WebRTC cloud mode)
    const def = CHARACTER_PRESETS[0];
    this.profile = {
      name: def.name,
      presetId: def.id,
      appearance: { ...def },
    };

    // WebRTC Cloud Room Coordinator state
    this.peer = null;
    this.hostConn = null;
    this.rtcHostRoom = null;
  }

  async connect() {
    if (this.connected && this.playerId) {
      return this.playerId;
    }

    // A separately deployed authoritative server can be selected at build time.
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    if (await this._tryConnectSocketIO(backendUrl)) {
      this.transport = 'socketio';
      return this.playerId;
    }
    if (backendUrl) throw new Error('Server multiplayer non raggiungibile. Riprova più tardi.');

    // Try the legacy same-origin WebSocket server before static-host fallback.
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const wsWorked = await this._tryConnectWebSocket();
      if (wsWorked) {
        this.transport = 'ws';
        return this.playerId;
      }
    }

    // 2. Seamless Cloud WebRTC Mode (works on GitHub Pages, Vercel, raw.githack.com, file://)
    this.transport = 'webrtc';
    this.playerId = `rtc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    this.connected = true;
    return this.playerId;
  }

  _tryConnectSocketIO(backendUrl) {
    return new Promise((resolve) => {
      let settled = false;
      const socket = io(backendUrl || undefined, { transports: ['websocket'], reconnection: false, timeout: 1800, autoConnect: false });
      const finish = ok => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) socket.disconnect();
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 2000);
      socket.on('packet', data => {
        if (data.type === 'welcome' && !settled) {
          this.socket = socket;
          this.playerId = data.playerId;
          this.connected = true;
          finish(true);
        } else if (settled && this.socket === socket) this._dispatchIncoming(data);
      });
      socket.on('connect_error', () => finish(false));
      socket.on('disconnect', () => {
        if (this.socket === socket) {
          this.socket = null;
          this.connected = false;
          this.handlers.onDisconnect?.();
        }
        finish(false);
      });
      socket.connect();
    });
  }

  _tryConnectWebSocket() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        const timeout = setTimeout(() => {
          try { ws.close(); } catch {}
          finish(false);
        }, 1600);

        ws.onmessage = (ev) => {
          let data;
          try {
            data = JSON.parse(ev.data);
          } catch {
            return;
          }

          if (data.type === 'welcome') {
            clearTimeout(timeout);
            this.ws = ws;
            this.playerId = data.playerId;
            this.connected = true;
            finish(true);
            return;
          }
          this._dispatchIncoming(data);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          finish(false);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (this.transport === 'ws') {
            this.connected = false;
            this.handlers.onDisconnect?.();
          }
          finish(false);
        };
      } catch {
        finish(false);
      }
    });
  }

  _dispatchIncoming(data) {
    if (data.type === 'voice_clip' && data.audioDataUrl) {
      if (data.senderId !== this.playerId) {
        const audio = new Audio(data.audioDataUrl);
        audio.volume = 0.9;
        audio.play().catch(() => {});
      }
      this.handlers.onVoiceActivity?.(data);
      return;
    }
    this.handlers.onMessage?.(data);
  }

  send(payload) {
    if (this.transport === 'socketio') {
      if (this.socket?.connected) this.socket.emit('packet', payload);
      return;
    }
    if (this.transport === 'ws') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      }
      return;
    }

    if (this.transport === 'webrtc') {
      this._handleWebRtcSend(payload);
    }
  }

  // =========================================================
  // CLOUD WEBRTC ROOM ENGINE (STATIC HOSTING / VERCEL / PAGES)
  // =========================================================
  _cleanupPeer() {
    if (this.rtcHostRoom?.tickInterval) {
      clearInterval(this.rtcHostRoom.tickInterval);
    }
    if (this.rtcHostRoom?.sim) {
      this.rtcHostRoom.sim.clearTimers();
    }
    this.rtcHostRoom = null;
    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
  }

  _handleWebRtcSend(msg) {
    if (msg.type === 'set_profile') {
      if (msg.name) this.profile.name = String(msg.name).trim().slice(0, 22) || this.profile.name;
      if (msg.presetId) this.profile.presetId = msg.presetId;
      if (msg.appearance) this.profile.appearance = { ...this.profile.appearance, ...msg.appearance, name: this.profile.name };

      if (this.rtcHostRoom) {
        const me = this.rtcHostRoom.clients.get(this.playerId);
        if (me) {
          me.name = this.profile.name;
          me.presetId = this.profile.presetId;
          me.appearance = this.profile.appearance;
          this._rtcBroadcastLobby();
        }
      } else if (this.hostConn?.open) {
        this.hostConn.send(msg);
      }
      return;
    }

    if (msg.type === 'create_private_room') {
      this._rtcCreateRoom(randomRoomCode(), false);
      return;
    }

    if (msg.type === 'join_room_code') {
      const code = String(msg.code || '').trim().toUpperCase();
      this._rtcJoinRoom(code);
      return;
    }

    if (msg.type === 'quick_matchmaking') {
      // Try joining public room VL-PUB1; if unoccupied, host VL-PUB1 automatically!
      this._rtcJoinRoom('VL-PUB1', true);
      return;
    }

    if (msg.type === 'leave_room') {
      this._cleanupPeer();
      return;
    }

    // If we are the coordinator of the WebRTC room, process directly; otherwise forward to coordinator
    if (this.rtcHostRoom) {
      this._rtcProcessRoomPacket(this.playerId, msg);
    } else if (this.hostConn?.open) {
      this.hostConn.send(msg);
    }
  }

  _rtcCreateRoom(code, isPublic = false) {
    this._cleanupPeer();
    const peerId = `${PEER_PREFIX}${code}`;
    const peer = new Peer(peerId);
    this.peer = peer;

    peer.on('open', () => {
      this.rtcHostRoom = {
        code,
        isPublic,
        status: 'lobby',
        hostId: this.playerId,
        fillWithBots: true,
        clients: new Map(),
        sim: null,
        tickInterval: null,
        broadcastCounter: 0,
      };

      this.rtcHostRoom.clients.set(this.playerId, {
        id: this.playerId,
        conn: null, // local coordinator
        name: this.profile.name,
        presetId: this.profile.presetId,
        appearance: { ...this.profile.appearance },
        input: { dx: 0, dz: 0 },
      });

      this._dispatchIncoming({ type: 'joined_room', lobby: this._rtcSerializeLobby() });
    });

    peer.on('connection', (conn) => {
      conn.on('data', (pkt) => {
        if (!this.rtcHostRoom) return;
        if (pkt.type === 'hello_join') {
          if (this.rtcHostRoom.status !== 'lobby') {
            conn.send({ type: 'error_msg', message: 'La partita in questa stanza è già iniziata.' });
            return;
          }
          if (this.rtcHostRoom.clients.size >= 10) {
            conn.send({ type: 'error_msg', message: 'Stanza piena (10/10 giocatori).' });
            return;
          }
          this.rtcHostRoom.clients.set(pkt.playerId, {
            id: pkt.playerId,
            conn,
            name: pkt.profile?.name || 'Ospite',
            presetId: pkt.profile?.presetId || 'lorenzo',
            appearance: pkt.profile?.appearance || CHARACTER_PRESETS[0],
            input: { dx: 0, dz: 0 },
          });
          conn.send({ type: 'joined_room', lobby: this._rtcSerializeLobby() });
          this._rtcBroadcastLobby();
          return;
        }
        if (pkt.senderId) {
          this._rtcProcessRoomPacket(pkt.senderId, pkt.payload);
        }
      });

      conn.on('close', () => {
        if (!this.rtcHostRoom) return;
        for (const [cid, c] of this.rtcHostRoom.clients.entries()) {
          if (c.conn === conn) {
            this.rtcHostRoom.clients.delete(cid);
          }
        }
        this._rtcBroadcastLobby();
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && !isPublic) {
        this._rtcCreateRoom(randomRoomCode(), false);
      } else {
        this._dispatchIncoming({
          type: 'error_msg',
          message: 'Impossibile registrare la stanza cloud. Riprova tra un istante.',
        });
      }
    });
  }

  _rtcJoinRoom(code, fallbackCreatePublic = false) {
    this._cleanupPeer();
    const peer = new Peer();
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(`${PEER_PREFIX}${code}`, { reliable: true });
      this.hostConn = conn;

      let joined = false;
      const joinTimer = setTimeout(() => {
        if (!joined) {
          if (fallbackCreatePublic) {
            this._rtcCreateRoom('VL-PUB1', true);
          } else {
            this._cleanupPeer();
            this._dispatchIncoming({ type: 'error_msg', message: `Stanza "${code}" non trovata o non attiva.` });
          }
        }
      }, 3200);

      conn.on('open', () => {
        conn.send({
          type: 'hello_join',
          playerId: this.playerId,
          profile: this.profile,
        });
      });

      conn.on('data', (data) => {
        if (data.type === 'joined_room') {
          joined = true;
          clearTimeout(joinTimer);
        }
        this._dispatchIncoming(data);
      });

      conn.on('close', () => {
        clearTimeout(joinTimer);
        if (joined) {
          this.handlers.onDisconnect?.();
        }
      });

      conn.on('error', () => {
        clearTimeout(joinTimer);
        if (fallbackCreatePublic && !joined) {
          this._rtcCreateRoom('VL-PUB1', true);
        }
      });

      // Override send wrapper so senderId is attached
      const origSend = conn.send.bind(conn);
      conn.send = (p) => {
        if (p.type === 'hello_join') origSend(p);
        else origSend({ senderId: this.playerId, payload: p });
      };
    });

    peer.on('error', () => {
      if (fallbackCreatePublic) {
        this._rtcCreateRoom('VL-PUB1', true);
      } else {
        this._dispatchIncoming({ type: 'error_msg', message: `Stanza "${code}" non raggiungibile.` });
      }
    });
  }

  _rtcSerializeLobby() {
    const r = this.rtcHostRoom;
    return {
      code: r.code,
      isPublic: r.isPublic,
      status: r.status,
      hostId: r.hostId,
      fillWithBots: r.fillWithBots,
      players: Array.from(r.clients.values()).map((c) => ({
        id: c.id,
        name: c.name,
        presetId: c.presetId,
        appearance: c.appearance,
      })),
    };
  }

  _rtcBroadcast(packet) {
    const r = this.rtcHostRoom;
    if (!r) return;
    for (const c of r.clients.values()) {
      if (c.id === this.playerId) {
        this._dispatchIncoming(packet);
      } else if (c.conn?.open) {
        c.conn.send(packet);
      }
    }
  }

  _rtcBroadcastLobby() {
    this._rtcBroadcast({ type: 'lobby_update', lobby: this._rtcSerializeLobby() });
  }

  _rtcBroadcastSimState() {
    const r = this.rtcHostRoom;
    if (!r?.sim?.state) return;
    for (const c of r.clients.values()) {
      const tailored = {
        type: 'sim_state',
        state: maskStateForRecipient(r.sim.state, c.id),
      };
      if (c.id === this.playerId) {
        this._dispatchIncoming(tailored);
      } else if (c.conn?.open) {
        c.conn.send(tailored);
      }
    }
  }

  _rtcProcessRoomPacket(senderId, msg) {
    const r = this.rtcHostRoom;
    if (!r) return;
    const client = r.clients.get(senderId);
    if (!client) return;

    if (msg.type === 'set_profile') {
      if (msg.name) client.name = String(msg.name).trim().slice(0, 22) || client.name;
      if (msg.presetId) client.presetId = msg.presetId;
      if (msg.appearance) client.appearance = { ...client.appearance, ...msg.appearance, name: client.name };
      this._rtcBroadcastLobby();
      return;
    }

    if (msg.type === 'toggle_bots' && senderId === r.hostId) {
      r.fillWithBots = Boolean(msg.fillWithBots);
      this._rtcBroadcastLobby();
      return;
    }

    if (msg.type === 'start_match' && senderId === r.hostId) {
      this._rtcStartMatch();
      return;
    }

    if (msg.type === 'voice_clip' && msg.audioDataUrl) {
      this._rtcBroadcast({
        type: 'voice_clip',
        senderId,
        senderName: client.name,
        audioDataUrl: String(msg.audioDataUrl).slice(0, 350000),
      });
      return;
    }

    if (!r.sim?.state) return;

    if (msg.type === 'move_input') {
      client.input.dx = Number.isFinite(msg.dx) ? Math.max(-1, Math.min(1, msg.dx)) : 0;
      client.input.dz = Number.isFinite(msg.dz) ? Math.max(-1, Math.min(1, msg.dz)) : 0;
      client.input.sprint = msg.sprint === true;
      client.input.updatedAt = Date.now();
      return;
    }

    if (msg.type === 'player_action') {
      const p = r.sim.state.players.find((x) => x.id === senderId);
      if (!p || p.eliminated) return;
      const meetingAction = ['chat', 'skip_discussion', 'vote'].includes(msg.action);
      if ((meetingAction && r.sim.state.phase !== 'meeting') || (!meetingAction && r.sim.state.phase !== 'playing')) return;

      switch (msg.action) {
        case 'complete_task':
          r.sim.completeCivilianTask(senderId, msg.taskId);
          break;
        case 'steal_jewel':
          r.sim.completeJewelSteal(senderId, msg.jewelId);
          break;
        case 'diamond_stash':
          r.sim.toggleMainDiamondStash(senderId, msg.spotId);
          break;
        case 'inspect_diamond':
          r.sim.inspectDiamondSpot(senderId, msg.spotId);
          break;
        case 'secret_passage':
          r.sim.useSecretPassage(senderId, msg.fromSpId, msg.toSpId);
          break;
        case 'toggle_hide':
          r.sim.toggleHide(senderId, msg.spotId);
          break;
        case 'set_cctv_open':
          p.usingCctv = p.role === 'civilian' && Boolean(msg.open);
          break;
        case 'set_interacting':
          p.interacting = Boolean(msg.interacting);
          if (msg.crime) {
            p.activeCrime = msg.crime;
            p.crimeTimer = 2.5;
          }
          break;
        case 'sabotage':
          r.sim.triggerSabotage(senderId, msg.kind, msg.wing);
          break;
        case 'repair':
          r.sim.repairSabotage(senderId);
          break;
        case 'save_evidence':
          if (msg.evidence) r.sim.saveCctvEvidence(senderId, msg.evidence);
          break;
        case 'call_meeting':
          if (msg.isClueReport) {
            if (msg.jewelId && r.sim.state.jewels[msg.jewelId]) {
              r.sim.state.jewels[msg.jewelId].clueRemaining = 0;
            }
            r.sim.startMeeting(senderId, msg.reason || 'Indizio di furto rilevato!');
          } else if (p.emergencyCallsLeft > 0 && r.sim.state.emergencyCooldown <= 0) {
            p.emergencyCallsLeft--;
            r.sim.startMeeting(senderId, 'Pulsante d’Emergenza premuto nell’Atrio!');
          }
          break;
        case 'chat':
          r.sim.postChatMessage(senderId, msg.text || '', msg.evidence || null);
          break;
        case 'skip_discussion':
          if (r.hostId === senderId) r.sim.advanceToVoting();
          break;
        case 'vote':
          r.sim.castVote(senderId, msg.targetId);
          break;
      }
      this._rtcBroadcastSimState();
    }
  }

  _rtcStartMatch() {
    const r = this.rtcHostRoom;
    if (!r || r.status === 'in_game') return;
    if (!r.fillWithBots && r.clients.size < 10) {
      this.handlers.onMessage?.({ type: 'error_msg', message: 'Servono 10 giocatori: attendi gli ospiti o attiva il riempimento IA.' });
      return;
    }
    r.status = 'in_game';

    const roster = Array.from(r.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      presetId: c.presetId,
      isBot: false,
      appearance: c.appearance,
    }));

    r.sim = new GameSimulation({
      mode: 'online_host',
      onEvent: (ev) => {
        for (const client of r.clients.values()) {
          if (!canReceiveEvent(ev, client.id, r.sim.state)) continue;
          const packet = { type: 'sim_event', event: ev };
          if (client.id === this.playerId) this._dispatchIncoming(packet);
          else if (client.conn?.open) client.conn.send(packet);
        }
        this._rtcBroadcastSimState();
      },
    });

    r.sim.initMatch(roster);

    this._rtcBroadcastSimState();

    const TICK_DT = 0.05;
    r.tickInterval = setInterval(() => {
      if (!r.sim?.state) return;
      if (r.sim.state.phase === 'playing') {
        for (const client of r.clients.values()) {
          const p = r.sim.state.players.find((x) => x.id === client.id);
          if (p && !p.eliminated && Date.now() - (client.input.updatedAt || 0) < 500 && (client.input.dx || client.input.dz)) {
            r.sim.movePlayer(p, client.input.dx, client.input.dz, TICK_DT, client.input.sprint ? 6.1 : 4.5);
          } else if (p) {
            p.speed = 0;
          }
        }
      }

      r.sim.update(TICK_DT);
      r.broadcastCounter++;
      if (r.broadcastCounter % 2 === 0) {
        this._rtcBroadcastSimState();
      }

      if (r.sim.state.phase === 'gameover') {
        clearInterval(r.tickInterval);
        r.tickInterval = null;
        r.status = 'lobby';
        this._rtcBroadcastSimState();
      }
    }, 50);
  }

  // =========================================================
  // PUSH-TO-TALK VOICE RECORDING
  // =========================================================
  async startPushToTalk() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microfono non supportato su questo browser.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      if (blob.size < 400) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          this.send({ type: 'voice_clip', audioDataUrl: reader.result });
        }
      };
      reader.readAsDataURL(blob);
    };
    this.mediaRecorder.start();
  }

  stopPushToTalk() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }
}
