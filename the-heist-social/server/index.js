import { hasLineOfSight, sightObstacles, playerSightRange } from '../src/engine/vision.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'node:events';
import { GameSimulation } from '../src/engine/gameSimulation.js';
import { CHARACTER_PRESETS } from '../src/data/characters.js';
import { canReceiveEvent, publicJewels } from '../src/engine/privacy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORT = Number(process.env.PORT || 3000);

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VL-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const rooms = new Map(); // code -> RoomObject

function createRoom({ isPublic = false }) {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const room = {
    code,
    isPublic,
    status: 'lobby', // 'lobby' | 'in_game'
    hostId: null,
    fillWithBots: true,
    clients: new Map(), // playerId -> { ws, id, name, presetId, appearance, input: { dx: 0, dz: 0 } }
    sim: null,
    tickInterval: null,
    broadcastCounter: 0,
  };
  rooms.set(code, room);
  return room;
}

function serializeLobby(room) {
  return {
    code: room.code,
    isPublic: room.isPublic,
    status: room.status,
    hostId: room.hostId,
    fillWithBots: room.fillWithBots,
    players: Array.from(room.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      presetId: c.presetId,
      appearance: c.appearance,
    })),
  };
}

// Tailor state per recipient so Civilians can't inspect WebSocket frames to cheat & see who the Thief is during 'playing'!
function serializeStateForPlayer(state, recipientId) {
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
      carrierId:
        revealAll || me?.role === 'thief' ? state.mainDiamond.carrierId : null,
      stashedAt:
        revealAll || me?.role === 'thief' ? state.mainDiamond.stashedAt : null,
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

function broadcastRoom(room, payload) {
  const raw = JSON.stringify(payload);
  for (const client of room.clients.values()) {
    if (client.ws.readyState === 1) {
      client.ws.send(raw);
    }
  }
}

function broadcastSimState(room) {
  if (!room.sim?.state) return;
  for (const client of room.clients.values()) {
    if (client.ws.readyState === 1) {
      client.ws.send(
        JSON.stringify({
          type: 'sim_state',
          state: serializeStateForPlayer(room.sim.state, client.id),
        })
      );
    }
  }
}

function startRoomMatch(room) {
  if (room.status === 'in_game') return;
  if (!room.fillWithBots && room.clients.size < 10) {
    const host = room.clients.get(room.hostId);
    host?.ws.send(JSON.stringify({ type: 'error_msg', message: 'Servono 10 giocatori: attendi gli ospiti o attiva il riempimento IA.' }));
    return;
  }
  room.status = 'in_game';

  const roster = Array.from(room.clients.values()).map((c) => ({
    id: c.id,
    name: c.name,
    presetId: c.presetId,
    isBot: false,
    appearance: c.appearance,
  }));

  room.sim = new GameSimulation({
    mode: 'online_host',
    onEvent: (ev) => {
      for (const client of room.clients.values()) {
        if (client.ws.readyState === 1 && canReceiveEvent(ev, client.id, room.sim.state)) {
          client.ws.send(JSON.stringify({ type: 'sim_event', event: ev }));
        }
      }
      broadcastSimState(room);
    },
  });

  room.sim.initMatch(roster);

  broadcastSimState(room);

  const TICK_DT = 0.05; // 20 Hz server physics & AI tick
  room.tickInterval = setInterval(() => {
    if (!room.sim?.state) return;

    // Apply latest human movement inputs
    if (room.sim.state.phase === 'playing') {
      for (const client of room.clients.values()) {
        const p = room.sim.state.players.find((x) => x.id === client.id);
        if (p && !p.eliminated && Date.now() - (client.input.updatedAt || 0) < 500 && (client.input.dx || client.input.dz)) {
          room.sim.movePlayer(p, client.input.dx, client.input.dz, TICK_DT, client.input.sprint ? 6.1 : 4.5);
        } else if (p) {
          p.speed = 0;
        }
      }
    }

    room.sim.update(TICK_DT);
    room.broadcastCounter++;
    if (room.broadcastCounter % 2 === 0) {
      // 10 Hz full state snapshots (smoothly interpolated at 60fps on clients)
      broadcastSimState(room);
    }

    if (room.sim.state.phase === 'gameover') {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
      room.status = 'lobby';
      broadcastSimState(room);
    }
  }, 50);
}

function removeClientFromRoom(client) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  room.clients.delete(client.id);
  if (room.clients.size === 0) {
    if (room.tickInterval) clearInterval(room.tickInterval);
    if (room.sim) room.sim.clearTimers();
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === client.id) {
    room.hostId = room.clients.keys().next().value;
  }
  broadcastRoom(room, { type: 'lobby_update', lobby: serializeLobby(room) });
}

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);

  // Health & Active Lobby Stats endpoint
  app.get('/api/status', (_req, res) => {
    res.json({
      ok: true,
      activeRooms: rooms.size,
      onlinePlayers: Array.from(rooms.values()).reduce((sum, r) => sum + r.clients.size, 0),
    });
  });

  // WebSocket Multiplayer Server on /ws
  const wss = new WebSocketServer({ noServer: true, maxPayload: 400000 });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://localhost').pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    }
  });

  // Keep the existing message protocol while allowing a Socket.IO transport.
  const allowedOrigins = (process.env.CLIENT_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const io = new SocketIOServer(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 400000,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      let sameOrigin = false;
      try { sameOrigin = !origin || new URL(origin).host === req.headers.host; } catch {}
      cb(null, sameOrigin || allowedOrigins.includes(origin));
    },
  });
  const handleConnection = (ws) => {
    const playerId = `p_${ Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const defaultPreset = CHARACTER_PRESETS[Math.floor(Math.random() * CHARACTER_PRESETS.length)];
    const client = {
      ws,
      id: playerId,
      name: defaultPreset.name,
      presetId: defaultPreset.id,
      appearance: { ...defaultPreset },
      roomCode: null,
      input: { dx: 0, dz: 0 },
    };

    ws.send(JSON.stringify({ type: 'welcome', playerId }));

    ws.on('message', (rawBuf) => {
      let msg;
      try {
        msg = JSON.parse(rawBuf.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;

      if (msg.type === 'set_profile') {
        if (msg.name) client.name = String(msg.name).trim().slice(0, 22) || client.name;
        if (msg.presetId) client.presetId = msg.presetId;
        if (msg.appearance) client.appearance = { ...client.appearance, ...msg.appearance, name: client.name };
        if (client.roomCode && rooms.has(client.roomCode)) {
          const r = rooms.get(client.roomCode);
          broadcastRoom(r, { type: 'lobby_update', lobby: serializeLobby(r) });
        }
        return;
      }

      if (msg.type === 'create_private_room') {
        removeClientFromRoom(client);
        const room = createRoom({ isPublic: false });
        room.hostId = client.id;
        room.clients.set(client.id, client);
        client.roomCode = room.code;
        ws.send(JSON.stringify({ type: 'joined_room', lobby: serializeLobby(room) }));
        return;
      }

      if (msg.type === 'join_room_code') {
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error_msg', message: `Stanza "${code}" non trovata.` }));
          return;
        }
        if (room.status !== 'lobby') {
          ws.send(JSON.stringify({ type: 'error_msg', message: 'La partita in questa stanza è già iniziata.' }));
          return;
        }
        if (room.clients.size >= 10) {
          ws.send(JSON.stringify({ type: 'error_msg', message: 'La stanza è piena (10/10 giocatori).' }));
          return;
        }
        removeClientFromRoom(client);
        room.clients.set(client.id, client);
        client.roomCode = room.code;
        ws.send(JSON.stringify({ type: 'joined_room', lobby: serializeLobby(room) }));
        broadcastRoom(room, { type: 'lobby_update', lobby: serializeLobby(room) });
        return;
      }

      if (msg.type === 'quick_matchmaking') {
        removeClientFromRoom(client);
        let pubRoom = Array.from(rooms.values()).find(
          (r) => r.isPublic && r.status === 'lobby' && r.clients.size < 10
        );
        if (!pubRoom) {
          pubRoom = createRoom({ isPublic: true });
          pubRoom.hostId = client.id;
        }
        pubRoom.clients.set(client.id, client);
        client.roomCode = pubRoom.code;
        ws.send(JSON.stringify({ type: 'joined_room', lobby: serializeLobby(pubRoom) }));
        broadcastRoom(pubRoom, { type: 'lobby_update', lobby: serializeLobby(pubRoom) });
        return;
      }

      if (msg.type === 'leave_room') {
        removeClientFromRoom(client);
        return;
      }

      const room = client.roomCode ? rooms.get(client.roomCode) : null;
      if (!room) return;

      if (msg.type === 'toggle_bots' && room.hostId === client.id) {
        room.fillWithBots = Boolean(msg.fillWithBots);
        broadcastRoom(room, { type: 'lobby_update', lobby: serializeLobby(room) });
        return;
      }

      if (msg.type === 'start_match' && room.hostId === client.id) {
        startRoomMatch(room);
        return;
      }

      if (!room.sim?.state) return;

      // In-game packets
      if (msg.type === 'move_input') {
        client.input.dx = Number.isFinite(msg.dx) ? Math.max(-1, Math.min(1, msg.dx)) : 0;
        client.input.dz = Number.isFinite(msg.dz) ? Math.max(-1, Math.min(1, msg.dz)) : 0;
        client.input.sprint = msg.sprint === true;
        client.input.updatedAt = Date.now();
        return;
      }

      if (msg.type === 'player_action') {
        const p = room.sim.state.players.find((x) => x.id === client.id);
        if (!p || p.eliminated) return;
        const meetingAction = ['chat', 'skip_discussion', 'vote'].includes(msg.action);
        if ((meetingAction && room.sim.state.phase !== 'meeting') || (!meetingAction && room.sim.state.phase !== 'playing')) return;

        switch (msg.action) {
          case 'complete_task':
            room.sim.completeCivilianTask(client.id, msg.taskId);
            break;
          case 'steal_jewel':
            room.sim.completeJewelSteal(client.id, msg.jewelId);
            break;
          case 'diamond_stash':
            room.sim.toggleMainDiamondStash(client.id, msg.spotId);
            break;
          case 'inspect_diamond':
            room.sim.inspectDiamondSpot(client.id, msg.spotId);
            break;
          case 'secret_passage':
            room.sim.useSecretPassage(client.id, msg.fromSpId, msg.toSpId);
            break;
          case 'toggle_hide':
            room.sim.toggleHide(client.id, msg.spotId);
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
            room.sim.triggerSabotage(client.id, msg.kind, msg.wing);
            break;
          case 'repair':
            room.sim.repairSabotage(client.id);
            break;
          case 'save_evidence':
            if (msg.evidence) room.sim.saveCctvEvidence(client.id, msg.evidence);
            break;
          case 'call_meeting':
            if (msg.isClueReport) {
              if (msg.jewelId && room.sim.state.jewels[msg.jewelId]) {
                room.sim.state.jewels[msg.jewelId].clueRemaining = 0;
              }
              room.sim.startMeeting(client.id, msg.reason || 'Indizio di furto rilevato!');
            } else if (p.emergencyCallsLeft > 0 && room.sim.state.emergencyCooldown <= 0) {
              p.emergencyCallsLeft--;
              room.sim.startMeeting(client.id, 'Pulsante d’Emergenza premuto nell’Atrio!');
            }
            break;
          case 'chat':
            room.sim.postChatMessage(client.id, msg.text || '', msg.evidence || null);
            break;
          case 'skip_discussion':
            if (room.hostId === client.id) room.sim.advanceToVoting();
            break;
          case 'vote':
            room.sim.castVote(client.id, msg.targetId);
            break;
        }
        broadcastSimState(room);
        return;
      }

      // Push-to-Talk Voice Clip Relay during Plenary Meetings!
      if (msg.type === 'voice_clip' && msg.audioDataUrl) {
        broadcastRoom(room, {
          type: 'voice_clip',
          senderId: client.id,
          senderName: client.name,
          audioDataUrl: String(msg.audioDataUrl).slice(0, 350000),
        });
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(client);
    });
  };
  wss.on('connection', handleConnection);
  io.on('connection', (socket) => {
    const channel = new EventEmitter();
    channel.readyState = 1;
    channel.send = data => socket.emit('packet', JSON.parse(data));
    socket.on('packet', data => {
      if (data && typeof data === 'object' && !Array.isArray(data)) channel.emit('message', JSON.stringify(data));
    });
    socket.on('disconnect', () => { channel.readyState = 3; channel.emit('close'); });
    handleConnection(channel);
  });

  // In production (e.g. Render/Railway) serve built dist/; in dev mount Vite middleware
  if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[THE HEIST SOCIAL] Villa Bellavista server listening on http://0.0.0.0:${server.address().port}`);
  });
}

bootstrap();
