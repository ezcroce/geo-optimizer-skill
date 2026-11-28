import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import WebSocket from 'ws';

function packet(socket, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off('packet', onPacket); reject(new Error(`Timed out waiting for ${type}`)); }, 5000);
    function onPacket(message) {
      if (message.type !== type || !predicate(message)) return;
      clearTimeout(timeout); socket.off('packet', onPacket); resolve(message);
    }
    socket.on('packet', onPacket);
  });
}

test('Socket.IO serves ten clients with authoritative movement and hidden roles; legacy WS still works', { timeout: 20000 }, async () => {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: '0', NODE_ENV: 'production', CLIENT_ORIGINS: 'https://the-heist-social.vercel.app' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const clients = [];
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 6000);
      server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}`)); });
      server.stdout.on('data', chunk => { output += chunk; const match = output.match(/0\.0\.0\.0:(\d+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 10; i++) {
      const socket = io(base, { transports: ['websocket'], reconnection: false, forceNew: true, autoConnect: false, extraHeaders: { origin: 'https://the-heist-social.vercel.app' } });
      clients.push(socket);
      const welcome = packet(socket, 'welcome'); socket.connect(); socket.playerId = (await welcome).playerId;
    }
    const host = clients[0];
    let reply = packet(host, 'joined_room'); host.emit('packet', { type: 'create_private_room' });
    const code = (await reply).lobby.code;
    for (const client of clients.slice(1)) {
      reply = packet(client, 'joined_room'); client.emit('packet', { type: 'join_room_code', code }); await reply;
    }
    const promises = clients.map(c => packet(c, 'sim_state', p => p.state.players.length === 10));
    host.emit('packet', { type: 'start_match' });
    const states = await Promise.all(promises);
    const thieves = states.map((s, i) => s.state.players.find(p => p.id === clients[i].playerId).role === 'thief');
    assert.equal(thieves.filter(Boolean).length, 1);
    states.forEach((s, i) => assert.ok(s.state.players.filter(p => p.id !== clients[i].playerId).every(p => p.role === 'unknown')));
    reply = packet(host, 'sim_state', p => p.state.sabotage.blackoutRemaining > 0);
    clients[thieves.indexOf(true)].emit('packet', { type: 'player_action', action: 'sabotage', kind: 'blackout' });
    assert.ok((await reply).state.sabotage.blackoutRemaining <= 12);
    const before = states[0].state.players.find(p => p.id === host.playerId);
    reply = packet(host, 'sim_state', p => p.state.players.find(q => q.id === host.playerId).speed > 0);
    host.emit('packet', { type: 'move_input', dx: 1e100, dz: 0, sprint: true });
    const after = (await reply).state.players.find(p => p.id === host.playerId);
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 2);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((resolve, reject) => { ws.on('message', data => { if (JSON.parse(data).type === 'welcome') { ws.close(); resolve(); } }); ws.on('error', reject); });
  } finally {
    clients.forEach(client => client.disconnect());
    server.kill();
  }
});
