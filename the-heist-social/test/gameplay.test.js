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
