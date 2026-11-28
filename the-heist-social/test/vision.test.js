import test from 'node:test';
import assert from 'node:assert/strict';
import { traceSight, hasLineOfSight, sightObstacles, visibilityPolygon, cameraSees } from '../src/engine/vision.js';

test('walls and cover block sight, distance and unobstructed rays are respected', () => {
  const cover = [{ minX: 2, maxX: 3, minZ: -1, maxZ: 1 }];
  assert.equal(traceSight(0, 0, 1, 0, 10, cover), 2);
  assert.equal(hasLineOfSight({ x: 0, z: 0 }, { x: 4, z: 0 }, 10, cover), false);
  assert.equal(hasLineOfSight({ x: 0, z: 0 }, { x: 1, z: 0 }, 10, cover), true);
  assert.equal(hasLineOfSight({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.5, cover), false);
  assert.equal(visibilityPolygon({ x: 0, z: 0 }, 5, cover, 16).length, 16);
});

test('locked doors add occluders and camera detection follows cone and line of sight', () => {
  const open = sightObstacles({ lockedWings: {} });
  const closed = sightObstacles({ lockedWings: { center: 10 } });
  assert.ok(closed.length > open.length);
  const camera = { pos: { x: 0, z: 0 }, lookAt: { x: 1, z: 0 }, fov: 60, detectRadius: 10 };
  assert.equal(cameraSees(camera, { x: 4, z: 0 }, []), true);
  assert.equal(cameraSees(camera, { x: -4, z: 0 }, []), false);
  assert.equal(cameraSees(camera, { x: 4, z: 0 }, [{ minX: 2, maxX: 3, minZ: -1, maxZ: 1 }]), false);
});

test('blackout blinds civilians while thief keeps a short visual radius', async () => {
  const { playerSightRange } = await import('../src/engine/vision.js');
  assert.equal(playerSightRange({ role: 'civilian' }, { blackoutRemaining: 3 }), 0);
  assert.equal(playerSightRange({ role: 'thief' }, { blackoutRemaining: 3 }), 4.5);
  assert.equal(playerSightRange({ role: 'civilian' }, { blackoutRemaining: 0 }), 11);
});

test('hedges obstruct sight but do not block walking', async () => {
  const { GameSimulation } = await import('../src/engine/gameSimulation.js');
  const { FURNITURE } = await import('../src/data/villaLayout.js');
  const sim = new GameSimulation(); sim.initMatch([]);
  const hedge = FURNITURE.find(f => f.id === 'f_back_hedge1');
  assert.equal(sim.isBlocked(hedge.x, hedge.z), false);
  assert.equal(hasLineOfSight({ x: hedge.x, z: hedge.z - hedge.d / 2 - 1 }, { x: hedge.x, z: hedge.z + hedge.d / 2 + 1 }, 10, sightObstacles(sim.state.sabotage)), false);
  sim.clearTimers();
});
