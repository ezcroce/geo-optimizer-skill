import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYER_BOUNDS as B, resolveRoomBounds } from "./physics.js";

const walls = [
  { name: "left", axis: "x", velocityAxis: "x", bound: B.minX, sign: -1 },
  { name: "right", axis: "x", velocityAxis: "x", bound: B.maxX, sign: 1 },
  { name: "back", axis: "z", velocityAxis: "y", bound: B.minZ, sign: -1 },
  { name: "front", axis: "z", velocityAxis: "y", bound: B.maxZ, sign: 1 },
];

for (const wall of walls) {
  for (const restitution of [0, 0.45]) {
    test(`${wall.name} wall clamps position and resolves outward velocity (${restitution ? "0G" : "1G"})`, () => {
      const position = {
        x: 0,
        y: 1,
        z: 0,
        [wall.axis]: wall.bound + wall.sign * 100,
      };
      const velocity = { x: 2, y: 2, [wall.velocityAxis]: wall.sign * 100 };
      resolveRoomBounds(position, velocity, restitution);
      assert.equal(position[wall.axis], wall.bound);
      assert.equal(position.y, 1);
      assert.equal(
        velocity[wall.velocityAxis],
        restitution ? -wall.sign * 100 * restitution : 0,
      );
      const tangent = wall.velocityAxis === "x" ? "y" : "x";
      assert.equal(velocity[tangent], 2);
    });
  }

  test(`${wall.name} wall allows immediate movement back into the room`, () => {
    const position = { x: 0, z: 0, [wall.axis]: wall.bound + wall.sign };
    const velocity = { x: 0, y: 0, [wall.velocityAxis]: -wall.sign * 3 };
    resolveRoomBounds(position, velocity, 0.45);
    assert.equal(position[wall.axis], wall.bound);
    assert.equal(velocity[wall.velocityAxis], -wall.sign * 3);
    position[wall.axis] += velocity[wall.velocityAxis] * 0.1;
    resolveRoomBounds(position, velocity, 0.45);
    assert.equal(position[wall.axis], wall.bound - wall.sign * 0.3);
  });

  test(`${wall.name} wall resolves velocity even at exact contact`, () => {
    const position = { x: 0, z: 0, [wall.axis]: wall.bound };
    const velocity = { x: 0, y: 0, [wall.velocityAxis]: wall.sign * 4 };
    resolveRoomBounds(position, velocity, 0.45);
    assert.equal(velocity[wall.velocityAxis], -wall.sign * 1.8);
  });
}

test("interior movement is unchanged", () => {
  const position = { x: 1, y: 0.5, z: -1 };
  const velocity = { x: 3, y: -4 };
  const before = structuredClone({ position, velocity });
  resolveRoomBounds(position, velocity, 0.45);
  assert.deepEqual({ position, velocity }, before);
});

test("diagonal corner impacts resolve both axes", () => {
  const position = { x: B.maxX + 10, z: B.minZ - 10 };
  const velocity = { x: 20, y: -20 };
  resolveRoomBounds(position, velocity, 0.45);
  assert.deepEqual(position, { x: B.maxX, z: B.minZ });
  assert.deepEqual(velocity, { x: -9, y: 9 });
});

test("repeated outward impulses cannot accumulate or escape the room", () => {
  const position = { x: B.maxX, z: B.minZ };
  const velocity = { x: 0, y: 0 };
  for (let frame = 0; frame < 300; frame++) {
    velocity.x += 100;
    velocity.y -= 100;
    position.x += velocity.x * 0.2;
    position.z += velocity.y * 0.2;
    resolveRoomBounds(position, velocity, 0.45);
    assert.ok(position.x <= B.maxX && position.x >= B.minX);
    assert.ok(position.z <= B.maxZ && position.z >= B.minZ);
    assert.ok(velocity.x <= 0 && velocity.y >= 0);
  }
});

test("resolving one local player does not change the other player's velocity", () => {
  const first = { position: { x: B.maxX + 1, z: 0 }, velocity: { x: 4, y: 0 } };
  const second = { position: { x: 1, z: 1 }, velocity: { x: 1, y: 2 } };
  const before = structuredClone(second);
  resolveRoomBounds(first.position, first.velocity, 0.45);
  assert.deepEqual(second, before);
});

test("0G counter contact preserves nearly all tangential motion", async () => {
  const { resolveCounterCollision } = await import("./physics.js");
  const p = { x: 0.9, z: 0 },
    v = { x: -4, y: 2 };
  assert.equal(
    resolveCounterCollision(p, v, { x: 0, z: 0, w: 2, d: 2 }, true, 0.1),
    true,
  );
  assert.ok(p.x > 1.3);
  assert.equal(v.x, 0.32);
  assert.ok(v.y > 1.98 && v.y < 2);
});

test("counter collision does not reverse a player already escaping", async () => {
  const { resolveCounterCollision } = await import("./physics.js");
  const p = { x: 0.9, z: 0 },
    v = { x: 3, y: 1 };
  resolveCounterCollision(p, v, { x: 0, z: 0, w: 2, d: 2 }, true, 0.1);
  assert.equal(v.x, 3);
});

test("counter slide damping is time-based, not frame-based", async () => {
  const { resolveCounterCollision } = await import("./physics.js");
  const counter = { x: 0, z: 0, w: 2, d: 2 };
  const full = { x: -1, y: 2 },
    half = { x: -1, y: 2 };
  resolveCounterCollision({ x: 0.9, z: 0 }, full, counter, true, 0.2);
  resolveCounterCollision({ x: 0.9, z: 0 }, half, counter, true, 0.1);
  resolveCounterCollision({ x: 0.9, z: 0 }, half, counter, true, 0.1);
  assert.ok(Math.abs(full.y - half.y) < 1e-12);
});

test("1G counter collision stops normal motion without damping the tangent", async () => {
  const { resolveCounterCollision } = await import("./physics.js");
  const v = { x: 2, y: 4 };
  resolveCounterCollision(
    { x: 0, z: -0.9 },
    v,
    { x: 0, z: 0, w: 2, d: 2 },
    false,
    0.1,
  );
  assert.deepEqual(v, { x: 2, y: 0 });
});

test("co-op baristas separate on contact and exchange momentum", async () => {
  const { resolvePlayerCollision } = await import("./physics.js");
  const a = { x: 0, z: 0 },
    b = { x: 0.4, z: 0 },
    va = { x: 4, y: 0 },
    vb = { x: 0, y: 0 };
  const impact = resolvePlayerCollision(a, va, b, vb);
  assert.equal(impact, 4);
  assert.ok(b.x - a.x >= 0.82);
  assert.ok(vb.x > 0);
  assert.ok(Math.abs(va.x + vb.x - 4) < 1e-10);
});
test("co-op contact never adds impulse when players are already separating", async () => {
  const { resolvePlayerCollision } = await import("./physics.js");
  const va = { x: -1, y: 2 },
    vb = { x: 1, y: 2 };
  assert.equal(
    resolvePlayerCollision({ x: 0, z: 0 }, va, { x: 0.3, z: 0 }, vb),
    0,
  );
  assert.deepEqual(va, { x: -1, y: 2 });
  assert.deepEqual(vb, { x: 1, y: 2 });
});
test("overlapping player centres resolve without NaN", async () => {
  const { resolvePlayerCollision } = await import("./physics.js");
  const a = { x: 0, z: 0 },
    b = { x: 0, z: 0 };
  resolvePlayerCollision(a, { x: 0, y: 0 }, b, { x: 0, y: 0 });
  assert.ok(Number.isFinite(a.x) && b.x - a.x >= 0.82);
});

test("the expanded room keeps walkable margins and a wide central aisle", async () => {
  const { ROOM_WIDTH, ROOM_DEPTH, PLAYER_BOUNDS, COUNTERS, MAIN_STATIONS } =
    await import("./physics.js");
  assert.equal(ROOM_WIDTH, 22);
  assert.equal(ROOM_DEPTH, 16);
  assert.ok(PLAYER_BOUNDS.maxX < ROOM_WIDTH / 2);
  assert.ok(PLAYER_BOUNDS.maxZ < ROOM_DEPTH / 2);
  assert.ok(
    COUNTERS[2].z - COUNTERS[2].d / 2 - (COUNTERS[1].z + COUNTERS[1].d / 2) > 6,
  );
  assert.ok(MAIN_STATIONS.milk.x - MAIN_STATIONS.coffee.x > 12);
});
