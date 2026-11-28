import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/engine/gameSimulation.js';
import { CHARACTER_PRESETS } from '../src/data/characters.js';
import { canReceiveEvent, publicJewels } from '../src/engine/privacy.js';

function match() {
  const sim = new GameSimulation();
  sim.initMatch([{ id: 'human', presetId: CHARACTER_PRESETS[0].id, name: 'Human', appearance: CHARACTER_PRESETS[0], isBot: false }]);
  return sim;
}

test('only thief can sabotage and CCTV recovers after timeout', () => {
  const sim = match(), thief = sim.state.players.find(p => p.role === 'thief'), civil = sim.state.players.find(p => p.role === 'civilian');
  assert.equal(sim.triggerSabotage(civil.id, 'cctv'), false);
  assert.equal(sim.triggerSabotage(thief.id, 'cctv'), true);
  assert.ok(sim.state.sabotage.cctvGlitchRemaining > 0);
  sim.state.sabotage.cctvGlitchRemaining = 0.01;
  sim.update(0.02);
  assert.equal(sim.state.sabotage.cctvGlitchRemaining, 0);
  sim.clearTimers();
});

test('expulsion needs majority of alive players and invalid votes are rejected', () => {
  for (const count of [4, 6]) {
    const sim = match(), players = sim.state.players, candidate = players[1];
    sim.startMeeting(players[0].id, 'Discussione'); sim.advanceToVoting(); sim.clearTimers();
    assert.equal(sim.castVote(players[0].id, 'nobody'), false);
    for (let i = 0; i < players.length; i++) sim.castVote(players[i].id, i < count ? candidate.id : 'skip');
    assert.equal(candidate.eliminated, count === 6);
    sim.clearTimers();
  }
});

test('private crime notifications and culprit ID do not leak to civilians', () => {
  const state = { players: [{ id: 'a', role: 'thief' }, { id: 'b', role: 'civilian' }] };
  assert.equal(canReceiveEvent({ type: 'jewel_stolen', playerId: 'a' }, 'b', state), false);
  assert.equal(canReceiveEvent({ type: 'secret_passage', playerId: 'a' }, 'a', state), true);
  assert.equal(canReceiveEvent({ type: 'diamond_stashed' }, 'b', state), false);
  const jewels = { ring: { stolen: true, stolenBy: 'a' } };
  assert.equal(publicJewels(jewels, false).ring.stolenBy, null);
  assert.equal(publicJewels(jewels, true).ring.stolenBy, 'a');
});

test('secret passage requires thief, proximity, a valid linked destination and active play', async () => {
  const { SECRET_PASSAGES } = await import('../src/data/villaLayout.js');
  const sim = match();
  const thief = sim.state.players.find(p => p.role === 'thief');
  const civilian = sim.state.players.find(p => p.role === 'civilian');
  const source = SECRET_PASSAGES[0], destination = SECRET_PASSAGES.find(p => p.id === source.targets[0]);
  thief.x = source.x + 10; thief.z = source.z;
  assert.equal(sim.useSecretPassage(thief.id, source.id, destination.id), false);
  thief.x = civilian.x = source.x; thief.z = civilian.z = source.z;
  assert.equal(sim.useSecretPassage(civilian.id, source.id, destination.id), false);
  assert.equal(sim.useSecretPassage(thief.id, source.id, source.id), false);
  assert.equal(sim.useSecretPassage(thief.id, source.id, destination.id), true);
  assert.equal(thief.x, destination.x); assert.equal(thief.z, destination.z);
  sim.clearTimers();
});

test('movement respects elapsed time and rejects non-finite input', () => {
  const sim = match(), p = sim.state.players[0];
  sim.isBlocked = () => false;
  p.x = 0; p.z = 0;
  sim.movePlayer(p, 1, 0, 0.2);
  const one = p.x;
  p.x = 0;
  for (let i = 0; i < 4; i++) sim.movePlayer(p, 1, 0, 0.05);
  assert.ok(Math.abs(p.x - one) < 1e-10);
  sim.movePlayer(p, Infinity, 0, 0.05);
  assert.ok(Number.isFinite(p.x));
  const before = p.x;
  sim.state.phase = 'meeting';
  sim.movePlayer(p, 1, 0, 0.05);
  assert.equal(p.x, before);
  sim.clearTimers();
});
