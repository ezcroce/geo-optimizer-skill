import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from '../src/engine/gameSimulation.js';
import { CHARACTER_PRESETS } from '../src/data/characters.js';

test('one random thief among the ten participants, ignoring old role preferences', () => {
  const originalRandom = Math.random;
  try {
    for (const preference of ['thief', 'civilian', undefined]) {
      for (let index = 0; index < 10; index++) {
        Math.random = () => (index + 0.5) / 10;
        const sim = new GameSimulation();
        const preset = CHARACTER_PRESETS[0];
        sim.initMatch([{ id: 'human', name: preset.name, presetId: preset.id, isBot: false, appearance: { ...preset } }], preference);
        assert.equal(sim.state.players.length, 10);
        assert.equal(sim.state.players.filter(p => p.role === 'thief').length, 1);
        assert.equal(sim.state.players[index].role, 'thief');
        sim.clearTimers();
      }
    }
  } finally {
    Math.random = originalRandom;
  }
});
