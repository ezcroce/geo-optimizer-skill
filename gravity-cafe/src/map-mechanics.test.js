import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, advanceState } from "./game-state.js";
import {
  MELT_LEVEL,
  ZEN_LEVEL,
  MAP_RADIUS,
  MAP_SCALE,
  LIFT_X,
  LIFT_Z,
  ORBIT_RADIUS,
  getMapEnvironment,
  getMapStations,
  getMapCounters,
  stationAt,
  nearLift,
  zenForce,
  resolveCircularBounds,
} from "./map-mechanics.js";

test("Melt-Core first outage is at 45s, lasts 15s and repeats every 45s", () => {
  for (const [time, hot, clock] of [
    [0, false, 45],
    [44, false, 1],
    [45, true, 15],
    [59, true, 1],
    [60, false, 30],
    [89, false, 1],
    [90, true, 15],
  ]) {
    const env = getMapEnvironment(MELT_LEVEL, time);
    assert.equal(env.hot, hot);
    assert.equal(env.clock, clock);
    assert.equal(env.gravity, hot ? 0 : 1);
  }
});

test("Melt-Core recipes require the right deck and delivery moves away from heat", () => {
  assert.equal(
    stationAt(MELT_LEVEL, 0, { x: -3.8 * MAP_SCALE, z: -2 * MAP_SCALE }, 0),
    null,
  );
  assert.equal(
    stationAt(MELT_LEVEL, 0, { x: -3.8 * MAP_SCALE, z: -2 * MAP_SCALE }, 1),
    "coffee",
  );
  assert.equal(
    stationAt(MELT_LEVEL, 0, { x: 3.8 * MAP_SCALE, z: -2 * MAP_SCALE }, 2),
    "milk",
  );
  assert.equal(
    stationAt(MELT_LEVEL, 45, { x: 0, z: 2.4 * MAP_SCALE }, 0),
    null,
  );
  assert.equal(
    stationAt(MELT_LEVEL, 45, { x: 0, z: 2.4 * MAP_SCALE }, 2),
    "service",
  );
  assert.equal(getMapStations(MELT_LEVEL, 60).service.deck, 0);
});

test("both visible elevators are reachable but do not activate remotely", () => {
  assert.equal(nearLift({ x: -LIFT_X, z: LIFT_Z }), true);
  assert.equal(nearLift({ x: LIFT_X, z: LIFT_Z }), true);
  assert.equal(nearLift({ x: 0, z: 0.7 }), false);
});

test("Zen cycles normal, north, ceiling, outward and wraps at 72s", () => {
  const expected = ["normal", "north", "ceiling", "outward", "normal"];
  expected.forEach((phase, i) => {
    const env = getMapEnvironment(ZEN_LEVEL, i * 18);
    assert.equal(env.phase, phase);
    assert.equal(env.clock, 18);
  });
});

test("Zen fields act north and radially without NaN at the centre", () => {
  assert.deepEqual(zenForce("north", { x: 3, z: 1 }), { x: 0, y: -1.3 });
  assert.deepEqual(zenForce("outward", { x: 0, z: 0 }), { x: 0, y: 0 });
  const force = zenForce("outward", { x: 3, z: 4 });
  assert.ok(force.x > 0 && force.y > 0);
  assert.ok(Math.abs(Math.hypot(force.x, force.y) - 1.3) < 1e-12);
  assert.deepEqual(zenForce("ceiling", { x: 3, z: 4 }), { x: 0, y: 0 });
});

test("Zen delivery follows the table orbit and collision box follows it", () => {
  for (const time of [0, 20, 70, 150]) {
    const station = getMapStations(ZEN_LEVEL, time).service;
    assert.ok(
      Math.abs(Math.hypot(station.x, station.z) - ORBIT_RADIUS) < 1e-12,
    );
    assert.equal(stationAt(ZEN_LEVEL, time, station), "service");
    const counter = getMapCounters(ZEN_LEVEL, time, 0).at(-1);
    assert.equal(counter.x, station.x);
    assert.equal(counter.z, station.z);
  }
});

test("special map clocks and hazards freeze with pause", () => {
  for (const level of [MELT_LEVEL, ZEN_LEVEL]) {
    const s = createState(level);
    s.running = true;
    advanceState(s, 46);
    const environment = getMapEnvironment(level, s.elapsed);
    s.paused = true;
    advanceState(s, 90);
    assert.deepEqual(getMapEnvironment(level, s.elapsed), environment);
  }
});

test("special maps preserve phase after large time steps and practice", () => {
  const s = createState(MELT_LEVEL, { practice: true });
  s.running = true;
  advanceState(s, 18045);
  assert.equal(s.running, true);
  assert.equal(s.remaining, 300);
  assert.equal(s.gravity, 0);
  assert.equal(s.gravityClock, 15);
});

test("circular map boundaries reflect normal velocity and preserve tangent", () => {
  const p = { x: 100, z: 0 },
    v = { x: 10, y: 2 };
  resolveCircularBounds(p, v);
  assert.equal(p.x, MAP_RADIUS);
  assert.equal(p.z, 0);
  assert.equal(v.x, -3.5);
  assert.equal(v.y, 2);
  const inward = { x: -1, y: 2 };
  resolveCircularBounds(p, inward);
  assert.deepEqual(inward, { x: -1, y: 2 });
});

test("original maps keep their existing layout", () => {
  assert.equal(getMapEnvironment(0, 99), null);
  assert.equal(getMapStations(0), null);
  assert.deepEqual(getMapCounters(0, 0, 0), []);
});

test("new stations have exact durations, gravity intervals and independent pause-safe state", async () => {
  const { LEVELS } = await import("./game-state.js");
  assert.equal(LEVELS.length, 8);
  for (const [level, tag, duration, interval] of [
    [5, "MAGNETIC", 270, 20],
    [6, "CRYO", 300, 24],
    [7, "REACTOR", 300, 16],
  ]) {
    assert.equal(LEVELS[level].tag, tag);
    assert.equal(LEVELS[level].duration, duration);
    assert.equal(LEVELS[level].gravityInterval, interval);
    const state = createState(level);
    state.running = true;
    advanceState(state, interval);
    assert.equal(state.gravity, 0);
    assert.equal(state.gravityClock, interval);
    state.paused = true;
    const before = { ...state };
    advanceState(state, 120);
    assert.deepEqual(state, before);
  }
});

test("Magnetic polarity changes every twenty seconds and all four directions exert force in zero-G", async () => {
  const { applyMapDynamics } = await import("./map-mechanics.js");
  for (const [time, gravity, phase] of [
    [0, 1, "north"],
    [20, 0, "south"],
    [40, 1, "east"],
    [60, 0, "west"],
    [80, 1, "south"],
    [100, 0, "north"],
    [120, 1, "west"],
    [140, 0, "east"],
  ]) {
    const env = getMapEnvironment(5, time);
    assert.equal(env.gravity, gravity);
    assert.equal(env.phase, phase);
    assert.equal(env.clock, 20);
    const velocity = { x: 0, y: 0, z: 0 };
    applyMapDynamics(5, time, 1, { x: 1, y: 2, z: 1 }, velocity);
    assert.equal(velocity.x, gravity ? 0 : env.force.x);
    assert.equal(velocity.z, gravity ? 0 : env.force.z);
  }
});

test("magnetic floor and countertop plates damp all three axes only within their physical height", async () => {
  const { MAGNET_PLATES, onMagnetPlate, applyMapDynamics } =
    await import("./map-mechanics.js");
  for (const plate of MAGNET_PLATES) {
    const pos = { ...plate, y: plate.y ?? 0.13 };
    assert.ok(onMagnetPlate(pos));
    const v = { x: 3, y: 2, z: -3 };
    applyMapDynamics(5, 20, 0.5, pos, v);
    assert.ok(Math.hypot(v.x, v.y, v.z) < 0.001);
    assert.ok(!onMagnetPlate({ ...pos, y: pos.y + 1.2 }));
  }
});

test("Cryo alternates every twenty-four seconds, ice footprint excludes dry floor and airborne players", async () => {
  const { onIce } = await import("./map-mechanics.js");
  for (const [time, gravity] of [
    [0, 1],
    [23.99, 1],
    [24, 0],
    [47.99, 0],
    [48, 1],
  ])
    assert.equal(getMapEnvironment(6, time).gravity, gravity);
  assert.ok(onIce({ x: 3, z: 0, y: 0.13 }));
  assert.ok(onIce({ x: 0, z: 3, y: 0.13 }));
  assert.ok(!onIce({ x: 3, z: 3, y: 0.13 }));
  assert.ok(!onIce({ x: 0, z: 0, y: 2 }));
});

test("cryogenic vents lift players and loose cups in one-G and stop outside their period or footprint", async () => {
  const { CRYO_VENTS, applyMapDynamics } = await import("./map-mechanics.js");
  for (const [time, position, lifts] of [
    [0.2, { ...CRYO_VENTS[0], y: 0.13 }, true],
    [3, { ...CRYO_VENTS[0], y: 0.13 }, false],
    [0.2, { x: 0, z: 3, y: 0.13 }, false],
  ]) {
    const v = { x: 0, y: 0, z: 0 };
    applyMapDynamics(6, time, 0.1, position, v);
    assert.equal(v.y > 0, lifts);
  }
});

test("ice crystal collision separates cups and reflects incoming velocity but never pulls outgoing cups back", async () => {
  const { iceCrystals, deflectCrystal } = await import("./map-mechanics.js");
  const c = iceCrystals(25)[0];
  const pos = { x: c.x + 0.2, y: c.y, z: c.z },
    v = { x: -3, y: 0, z: 0 };
  assert.ok(deflectCrystal(pos, v, 25));
  assert.ok(v.x > 0);
  assert.ok(pos.x >= c.x + 0.6);
  const departing = { x: c.x + 0.2, y: c.y, z: c.z },
    out = { x: 3, y: 0, z: 0 };
  assert.ok(deflectCrystal(departing, out, 25));
  assert.equal(out.x, 3);
  assert.ok(!deflectCrystal({ x: 0, y: 4, z: 0 }, v, 25));
});

test("Reactor has a three-second warning and twelve seconds of zero-G following each pulse", () => {
  for (const [time, gravity, countdown] of [
    [0, 1, 0],
    [12.9, 1, 0],
    [13, 1, 3],
    [14, 1, 2],
    [15, 1, 1],
    [16, 0, 0],
    [27.99, 0, 0],
    [28, 1, 0],
    [29, 1, 3],
    [32, 0, 0],
  ]) {
    const env = getMapEnvironment(7, time);
    assert.equal(env.gravity, gravity, `gravity ${time}`);
    assert.equal(env.countdown, countdown, `warning ${time}`);
  }
});

test("reactor pulse is radial, one-shot, blocked by shielding and can be suppressed for repeated fixed steps", async () => {
  const { applyMapDynamics, shelteredFromPulse } =
    await import("./map-mechanics.js");
  assert.ok(shelteredFromPulse({ x: 6, z: 0, y: 0.13 }));
  assert.ok(!shelteredFromPulse({ x: 3, z: 3, y: 0.13 }));
  assert.ok(!shelteredFromPulse({ x: 6, z: 0, y: 8 }));
  const exposed = { x: 3, z: 3, y: 0.13 },
    v = { x: 0, y: 0, z: 0 };
  applyMapDynamics(7, 16, 0.016, exposed, v);
  assert.ok(v.x > 4 && v.z > 4 && v.y > 2);
  const protectedV = { x: 0, y: 0, z: 0 };
  applyMapDynamics(7, 16, 0.016, { x: 6, z: 0, y: 0.13 }, protectedV);
  assert.ok(Math.abs(protectedV.x) < 0.01);
  const noRepeat = { x: 0, y: 0, z: 0 };
  applyMapDynamics(7, 16, 0.016, exposed, noRepeat, { pulse: false });
  assert.ok(Math.abs(noRepeat.x) < 0.01);
  const later = { x: 0, y: 0, z: 0 };
  applyMapDynamics(7, 17, 0.016, exposed, later);
  assert.ok(Math.abs(later.x) < 0.01);
});

test("new station targets, obstacle collision and radius share scaled world coordinates", async () => {
  const { getMapObstacles, reactorFloor } = await import("./map-mechanics.js");
  const { resolveCounterCollision } = await import("./physics.js");
  for (const level of [5, 6, 7]) {
    for (const [name, s] of Object.entries(getMapStations(level))) {
      assert.ok(Math.hypot(s.x, s.z) < MAP_RADIUS);
      assert.equal(stationAt(level, 0, s, 0), name);
      assert.ok(
        getMapCounters(level, 0, 0).some((c) => c.x === s.x && c.z === s.z),
      );
    }
    for (const obstacle of getMapObstacles(level)) {
      const p = { x: obstacle.x, z: obstacle.z },
        v = { x: 0, y: 0 };
      assert.ok(resolveCounterCollision(p, v, obstacle, true, 1 / 60));
      assert.ok(
        Math.abs(p.x - obstacle.x) > obstacle.w / 2 ||
          Math.abs(p.z - obstacle.z) > obstacle.d / 2,
      );
    }
  }
  assert.equal(reactorFloor({ x: 0, z: 1.8 }), 0);
  assert.equal(reactorFloor({ x: 0, z: 3 }), 0.65);
  assert.equal(reactorFloor({ x: 0, z: 5.6 }), 1.3);
  assert.equal(reactorFloor({ x: 4, z: 5.6 }), 0);
});
