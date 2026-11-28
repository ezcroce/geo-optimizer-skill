import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBlueprint } from '../src/graphics/blueprint.js';
import { createJewelOrnament } from '../src/graphics/jewels.js';
import { GameSimulation } from '../src/engine/gameSimulation.js';
import { JEWELS, ROOMS } from '../src/data/villaLayout.js';

function canvasRecorder(width = 920, height = 640) {
  const calls = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'measureText') return text => ({ width: text.length * 6 });
      if (key === 'fill') return () => calls.push(['fill', target.fillStyle]);
      if (key in target) return target[key];
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { width, height, getContext: () => ctx, calls };
}

test('detailed map draws room labels and respects role-restricted markers', () => {
  const state = { jewels: Object.fromEntries(JEWELS.map(j => [j.id, { stolen: false }])), sabotage: { lockedWings: {} } };
  const civilian = { x: 0, z: 0, role: 'civilian', assignedTasks: [] };
  const map = canvasRecorder();
  assert.doesNotThrow(() => drawBlueprint(map, state, civilian, true));
  const labels = map.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  for (const room of ROOMS) assert.ok(labels.includes(room.shortName));
  assert.ok(labels.includes('N ▲'));
  assert.ok(!map.calls.some(c => c[0] === 'fill' && c[1] === '#c084fc'));
  const thiefMap = canvasRecorder();
  drawBlueprint(thiefMap, state, { ...civilian, role: 'thief' }, true);
  assert.ok(thiefMap.calls.some(c => c[0] === 'fill' && c[1] === '#c084fc'));
  const mini = canvasRecorder(230, 184);
  assert.doesNotThrow(() => drawBlueprint(mini, state, { ...civilian, role: 'thief' }, false));
  assert.ok(map.calls.length > mini.calls.length);
});

test('twelve distinct treasures build faceted 3D ornaments', () => {
  globalThis.document = { createElement: () => canvasRecorder(256, 256) };
  for (const [i, jewel] of JEWELS.entries()) {
    const model = createJewelOrnament(jewel.id, i);
    assert.ok(model.children.length >= 2, jewel.id);
    assert.ok(model.children.some(child => child.material?.map || child.material?.metalness > 0), jewel.id);
  }
  const ring = createJewelOrnament('j_ring');
  const tiara = createJewelOrnament('j_tiara');
  assert.notEqual(ring.children.length, tiara.children.length);
});

test('blocked movement does not report walking just because the other axis is zero', () => {
  const sim = new GameSimulation();
  const p = { x: 0, z: 0, speed: 0, eliminated: false, hidden: false };
  sim.isBlocked = () => true;
  sim.movePlayer(p, 0, 1, 0.05);
  assert.equal(p.speed, 0);
  assert.equal(p.z, 0);
});
