export const MELT_LEVEL = 3;
export const ZEN_LEVEL = 4;
export const DECK_HEIGHT = 3.2;
export const MAP_RADIUS = 8.5;
export const MAP_SCALE = MAP_RADIUS / 6.65;
export const LIFT_X = 5.6 * MAP_SCALE,
  LIFT_Z = 0.7 * MAP_SCALE;
export const VINE_X = 4 * MAP_SCALE,
  VINE_Z = 0.2 * MAP_SCALE;
export const ORBIT_RADIUS = 4.7 * MAP_SCALE;

export function getMapEnvironment(level, elapsed) {
  if (level === MELT_LEVEL) {
    const phase = elapsed % 45;
    const hot = elapsed >= 45 && phase < 15;
    return {
      gravity: hot ? 0 : 1,
      clock: hot ? 15 - phase : 45 - phase,
      phase: hot ? "overheat" : "cooling",
      label: hot ? "Guasto refrigerante · 0G" : "Raffreddamento · 1G",
      hot,
    };
  }
  if (level === ZEN_LEVEL) {
    const phase = Math.floor(elapsed / 18) % 4;
    return {
      gravity: phase === 0 ? 1 : 0,
      clock: 18 - (elapsed % 18),
      phase: ["normal", "north", "ceiling", "outward"][phase],
      label: [
        "Gravità normale · 1G",
        "Campo verso nord",
        "Campo sul soffitto",
        "Campo radiale esterno",
      ][phase],
      hot: false,
    };
  }
  if (level === MAGNETIC_LEVEL) {
    const stage = Math.floor(elapsed / 20);
    const phase = [0, 1, 2, 3, 1, 0, 3, 2][stage % 8];
    const gravity = stage % 2 === 0 ? 1 : 0;
    return {
      gravity,
      clock: 20 - (elapsed % 20),
      phase: ["north", "south", "east", "west"][phase],
      force: [
        { x: 0, z: -2 },
        { x: 0, z: 2 },
        { x: 2, z: 0 },
        { x: -2, z: 0 },
      ][phase],
      label: `Polarità ${["Nord", "Sud", "Est", "Ovest"][phase]} · ${gravity ? "1G" : "0G"}`,
      hot: false,
    };
  }
  if (level === CRYO_LEVEL) {
    const gravity = Math.floor(elapsed / 24) % 2 === 0 ? 1 : 0;
    return {
      gravity,
      clock: 24 - (elapsed % 24),
      phase: gravity ? "ice" : "crystals",
      label: gravity ? "Ghiaccio · inerzia 1G" : "Cristalli liberi · 0G",
      hot: false,
    };
  }
  if (level === REACTOR_LEVEL) {
    const phase = elapsed % 16,
      warning = phase >= 13;
    return {
      gravity: elapsed < 16 || phase >= 12 ? 1 : 0,
      clock: 16 - phase,
      phase: warning
        ? "warning"
        : phase < 12 && elapsed >= 16
          ? "unstable"
          : "stable",
      warning,
      countdown: warning ? Math.ceil(16 - phase) : 0,
      label: warning
        ? `IMPULSO TRA ${Math.ceil(16 - phase)}s · RIPARATI`
        : elapsed >= 16 && phase < 12
          ? "Turbolenza · 0G"
          : "Nucleo in carica · 1G",
      hot: false,
    };
  }
  return null;
}

export function getMapStations(level, elapsed = 0) {
  if (level === MELT_LEVEL) {
    const hot = getMapEnvironment(level, elapsed).hot;
    return {
      coffee: { x: -3.8 * MAP_SCALE, z: -2 * MAP_SCALE, deck: 1 },
      milk: { x: 3.8 * MAP_SCALE, z: -2 * MAP_SCALE, deck: 2 },
      service: { x: 0, z: 2.4 * MAP_SCALE, deck: hot ? 2 : 0 },
    };
  }
  if (level === ZEN_LEVEL) {
    return {
      coffee: { x: -1.8 * MAP_SCALE, z: -1.5 * MAP_SCALE, deck: 0 },
      milk: { x: 1.8 * MAP_SCALE, z: -1.5 * MAP_SCALE, deck: 0 },
      service: {
        x: Math.cos(elapsed * 0.08) * ORBIT_RADIUS,
        z: Math.sin(elapsed * 0.08) * ORBIT_RADIUS,
        deck: 0,
      },
    };
  }
  if (level === MAGNETIC_LEVEL)
    return {
      coffee: { x: -3.8 * MAP_SCALE, z: 0, deck: 0 },
      milk: { x: 3.8 * MAP_SCALE, z: 0, deck: 0 },
      service: { x: 0, z: 4.4 * MAP_SCALE, deck: 0 },
    };
  if (level === CRYO_LEVEL)
    return {
      coffee: { x: -4.1 * MAP_SCALE, z: -2.7 * MAP_SCALE, deck: 0 },
      milk: { x: 4.1 * MAP_SCALE, z: -2.7 * MAP_SCALE, deck: 0 },
      service: { x: 0, z: 4.6 * MAP_SCALE, deck: 0 },
    };
  if (level === REACTOR_LEVEL)
    return {
      coffee: { x: -4.7 * MAP_SCALE, z: -2.5 * MAP_SCALE, deck: 0 },
      milk: { x: 4.7 * MAP_SCALE, z: -2.5 * MAP_SCALE, deck: 0 },
      service: { x: 0, z: 4.4 * MAP_SCALE, deck: 0, elevation: 1.3 },
    };
  return null;
}

export function stationAt(level, elapsed, position, deck = 0) {
  const stations = getMapStations(level, elapsed);
  if (!stations) return null;
  return (
    Object.entries(stations).find(
      ([, s]) =>
        s.deck === deck &&
        Math.hypot(position.x - s.x, position.z - s.z) < 1.65,
    )?.[0] ?? null
  );
}

export function nearLift(position) {
  return [-LIFT_X, LIFT_X].some(
    (x) => Math.hypot(position.x - x, position.z - LIFT_Z) < 1.25,
  );
}

export function zenForce(phase, position) {
  if (phase === "north") return { x: 0, y: -1.3 };
  if (phase === "outward") {
    const length = Math.hypot(position.x, position.z);
    if (length > 0.01)
      return { x: (position.x / length) * 1.3, y: (position.z / length) * 1.3 };
  }
  return { x: 0, y: 0 };
}

export function resolveCircularBounds(position, velocity, radius = MAP_RADIUS) {
  const length = Math.hypot(position.x, position.z);
  if (length < radius) return;
  const nx = position.x / length,
    nz = position.z / length;
  position.x = nx * radius;
  position.z = nz * radius;
  const outward = velocity.x * nx + velocity.y * nz;
  if (outward > 0) {
    velocity.x -= outward * nx * 1.35;
    velocity.y -= outward * nz * 1.35;
  }
}

export function getMapCounters(level, elapsed, deck) {
  const stations = getMapStations(level, elapsed);
  if (!stations) return [];
  const counters = Object.entries(stations)
    .filter(([, station]) => station.deck === deck)
    .map(([name, station]) => ({
      x: station.x,
      z: station.z,
      w: (name === "service" ? 1.8 : 1.5) * MAP_SCALE,
      d: (name === "service" ? 1.8 : 1) * MAP_SCALE,
      elevation: station.elevation ?? 0,
    }));
  if (level === MAGNETIC_LEVEL && deck === 0)
    counters.push(
      { x: 0, z: 0, w: 6 * MAP_SCALE, d: 0.85 * MAP_SCALE },
      { x: 0, z: 0, w: 0.85 * MAP_SCALE, d: 6 * MAP_SCALE },
    );
  return counters;
}

export const MAGNETIC_LEVEL = 5;
export const CRYO_LEVEL = 6;
export const REACTOR_LEVEL = 7;
export const MAGNET_PLATES = [
  { x: -3.8 * MAP_SCALE, z: 1.5 * MAP_SCALE },
  { x: 3.8 * MAP_SCALE, z: 1.5 * MAP_SCALE },
  { x: 0, z: 3.4 * MAP_SCALE },
  { x: -3.8 * MAP_SCALE, z: 0, y: 1.13 },
  { x: 3.8 * MAP_SCALE, z: 0, y: 1.13 },
];
export const CRYO_VENTS = [
  { x: -2.5 * MAP_SCALE, z: 0 },
  { x: 2.5 * MAP_SCALE, z: 0 },
];
export function onMagnetPlate(position) {
  return MAGNET_PLATES.some(
    (p) =>
      Math.abs(position.y - (p.y ?? 0.13)) < 0.5 &&
      Math.hypot(position.x - p.x, position.z - p.z) < 0.8,
  );
}
export function onIce(position) {
  return (
    position.y < 0.45 &&
    (Math.abs(position.z) < 1.3 * MAP_SCALE ||
      Math.abs(position.x) < 1.1 * MAP_SCALE)
  );
}
export function reactorFloor(position) {
  // Ponte raggiungibile anche in 1G tramite rampa, senza teletrasporto.
  return Math.abs(position.x) < 2.4
    ? Math.max(0, Math.min(1, (position.z - 1.8) / 2.4)) * 1.3
    : 0;
}
export function getMapObstacles(level) {
  if (level === MAGNETIC_LEVEL)
    return Array.from({ length: 8 }, (_, i) => ({
      x: Math.cos((i * Math.PI) / 4) * 6.3 * MAP_SCALE,
      z: Math.sin((i * Math.PI) / 4) * 6.3 * MAP_SCALE,
      w: 0.9 * MAP_SCALE,
      d: 0.9 * MAP_SCALE,
      height: 3.6,
    }));
  if (level === CRYO_LEVEL)
    return [
      ...[-1, 1].map((sign) => ({
        x: sign * 2 * MAP_SCALE,
        z: 4.6 * MAP_SCALE,
        w: 0.12 * MAP_SCALE,
        d: 2.5 * MAP_SCALE,
        height: 1.5,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        x: Math.cos((i * Math.PI) / 3) * 6 * MAP_SCALE,
        z: Math.sin((i * Math.PI) / 3) * 6 * MAP_SCALE,
        w: 1.1 * MAP_SCALE,
        d: 1.1 * MAP_SCALE,
        height: 2.95,
      })),
    ];
  if (level === REACTOR_LEVEL)
    return [
      { x: 0, z: 0, w: 1.8, d: 1.8, height: 4 },
      ...[-1, 1].map((sign) => ({
        x: sign * 3.1 * MAP_SCALE,
        z: 0,
        w: 0.48 * MAP_SCALE,
        d: 2.6 * MAP_SCALE,
        height: 2.6,
      })),
      {
        x: 0,
        z: -3.4 * MAP_SCALE,
        w: 2.8 * MAP_SCALE,
        d: 0.48 * MAP_SCALE,
        height: 2.6,
      },
    ];
  return [];
}
function segmentBox(position, box) {
  let lo = 0,
    hi = 1;
  for (const [axis, extent] of [
    ["x", "w"],
    ["z", "d"],
  ]) {
    const delta = position[axis];
    if (Math.abs(delta) < 1e-8) {
      if (Math.abs(box[axis]) > box[extent] / 2) return false;
      continue;
    }
    let a = (box[axis] - box[extent] / 2) / delta,
      b = (box[axis] + box[extent] / 2) / delta;
    if (a > b) [a, b] = [b, a];
    lo = Math.max(lo, a);
    hi = Math.min(hi, b);
    if (lo > hi) return false;
  }
  return lo > 0 && lo < 1 && position.y * lo < (box.height ?? 1.3);
}
export function shelteredFromPulse(position) {
  return [
    ...getMapObstacles(REACTOR_LEVEL).slice(1),
    ...getMapCounters(REACTOR_LEVEL, 0, 0),
  ].some((box) => segmentBox(position, box));
}
export function iceCrystals(elapsed) {
  return Array.from({ length: 7 }, (_, i) => {
    const a = (i * Math.PI * 2) / 7 + elapsed * 0.09;
    return {
      x: Math.cos(a) * 4.5 * MAP_SCALE,
      y: 1.25 + Math.sin(elapsed * 0.6 + i) * 0.6,
      z: Math.sin(a) * 4.5 * MAP_SCALE,
      radius: 0.44,
    };
  });
}
export function deflectCrystal(position, velocity, elapsed) {
  for (const crystal of iceCrystals(elapsed)) {
    const dx = position.x - crystal.x,
      dy = position.y - crystal.y,
      dz = position.z - crystal.z;
    const distance = Math.hypot(dx, dy, dz),
      radius = crystal.radius + 0.17;
    if (distance >= radius) continue;
    const nx = distance > 1e-6 ? dx / distance : 1,
      ny = distance > 1e-6 ? dy / distance : 0,
      nz = distance > 1e-6 ? dz / distance : 0;
    position.x = crystal.x + nx * radius;
    position.y = crystal.y + ny * radius;
    position.z = crystal.z + nz * radius;
    const approach = velocity.x * nx + velocity.y * ny + velocity.z * nz;
    if (approach < 0) {
      velocity.x -= 1.85 * approach * nx;
      velocity.y -= 1.85 * approach * ny;
      velocity.z -= 1.85 * approach * nz;
    }
    return true;
  }
  return false;
}
// Impulso temporale one-shot (non ripetuto per frame) e forze comuni a corpi e tazze.
export function applyMapDynamics(
  level,
  elapsed,
  dt,
  position,
  velocity,
  { brake = false, pulse: triggerPulse } = {},
) {
  const env = getMapEnvironment(level, elapsed);
  if (!env || dt <= 0) return;
  if (level === MAGNETIC_LEVEL && !env.gravity) {
    if (onMagnetPlate(position)) {
      velocity.x *= Math.exp(-20 * dt);
      velocity.z *= Math.exp(-20 * dt);
      velocity.y *= Math.exp(-20 * dt);
      return;
    }
    velocity.x += env.force.x * dt;
    velocity.z += env.force.z * dt;
  }
  if (
    level === CRYO_LEVEL &&
    CRYO_VENTS.some(
      (p, i) =>
        Math.hypot(position.x - p.x, position.z - p.z) < 0.75 &&
        (elapsed + i * 3) % 8 < 1.4,
    )
  )
    velocity.y += 16 * dt;
  if (level === REACTOR_LEVEL) {
    const pulse =
      triggerPulse ??
      Math.floor(elapsed / 16) > Math.floor(Math.max(0, elapsed - dt) / 16);
    const radius = Math.hypot(position.x, position.z);
    if (pulse && radius > 0.1 && !shelteredFromPulse(position)) {
      velocity.x += (position.x / radius) * 6.5;
      velocity.z += (position.z / radius) * 6.5;
      velocity.y += 2.2;
    }
    if (!env.gravity) {
      velocity.y += Math.sin(elapsed * 5 + position.x) * 1.2 * dt;
      velocity.x += Math.sin(elapsed * 3 + position.z) * 0.3 * dt;
    }
  }
  if (brake) {
    velocity.x *= Math.exp(-8 * dt);
    velocity.z *= Math.exp(-8 * dt);
  }
}
