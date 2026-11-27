// Limiti del centro del personaggio in coordinate locali della stanza:
// includono già un margine per il corpo rispetto ai bordi del pavimento.
export const ROOM_WIDTH = 22,
  ROOM_DEPTH = 16;
export const ROOM_SCALE_X = ROOM_WIDTH / 16,
  ROOM_SCALE_Z = ROOM_DEPTH / 11.6;
export const MAIN_STATIONS = Object.freeze({
  coffee: { x: -6.05, y: 2.05, z: -5.1 },
  milk: { x: 6.4, y: 1.85, z: -5.1 },
  service: { x: 0, y: 1.65, z: 3.52 },
});
export const PLAYER_BOUNDS = Object.freeze({
  minX: -10.3,
  maxX: 10.3,
  minZ: -7.25,
  maxZ: 7.25,
});
export const COUNTERS = Object.freeze([
  Object.freeze({
    x: -6.1 * ROOM_SCALE_X,
    z: -0.8 * ROOM_SCALE_Z,
    w: 1.5 * ROOM_SCALE_X,
    d: 5.2 * ROOM_SCALE_Z,
  }),
  Object.freeze({
    x: 0,
    z: -4.1 * ROOM_SCALE_Z,
    w: 13.4 * ROOM_SCALE_X,
    d: 1.5 * ROOM_SCALE_Z,
  }),
  Object.freeze({
    x: 0,
    z: 2.8 * ROOM_SCALE_Z,
    w: 9.2 * ROOM_SCALE_X,
    d: 1.45 * ROOM_SCALE_Z,
  }),
]);

// In 0G il contatto assorbe quasi tutta la velocità normale, non la tangente.
// Lo scivolamento è indipendente dal frame rate; niente spinte tangenziali gratuite.
export function resolveCounterCollision(
  position,
  velocity,
  counter,
  zeroG,
  dt,
) {
  const dx = position.x - counter.x,
    dz = position.z - counter.z;
  const ox = counter.w / 2 + 0.3 - Math.abs(dx);
  const oz = counter.d / 2 + 0.3 - Math.abs(dz);
  if (ox <= 0 || oz <= 0) return false;
  const axis = ox < oz ? "x" : "z";
  const normalAxis = axis === "x" ? "x" : "y";
  const tangentAxis = axis === "x" ? "y" : "x";
  const sign = Math.sign(axis === "x" ? dx : dz) || 1;
  position[axis] += sign * ((axis === "x" ? ox : oz) + 0.001);
  if (velocity[normalAxis] * sign < 0)
    velocity[normalAxis] = zeroG ? -velocity[normalAxis] * 0.08 : 0;
  if (zeroG) velocity[tangentAxis] *= Math.exp(-0.08 * Math.max(0, dt));
  return true;
}

/**
 * Corregge penetrazione e velocità normale al bordo prima del rendering.
 * position usa gli assi x/z; velocity è un vettore 2D (x/y), come in Three.js.
 * La componente tangenziale e una velocità già diretta all'interno restano intatte.
 */
export function resolveRoomBounds(position, velocity, restitution = 0) {
  for (const [axis, velocityAxis, min, max] of [
    ["x", "x", PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX],
    ["z", "y", PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ],
  ]) {
    if (position[axis] <= min) {
      position[axis] = min;
      if (velocity[velocityAxis] < 0)
        velocity[velocityAxis] = restitution
          ? -velocity[velocityAxis] * restitution
          : 0;
    } else if (position[axis] >= max) {
      position[axis] = max;
      if (velocity[velocityAxis] > 0)
        velocity[velocityAxis] = restitution
          ? -velocity[velocityAxis] * restitution
          : 0;
    }
  }
}

export function resolvePlayerCollision(a, va, b, vb, radius = 0.82) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= radius) return 0;
  const nx = distance > 0.001 ? dx / distance : 1;
  const nz = distance > 0.001 ? dz / distance : 0;
  const penetration = (radius - distance) / 2 + 0.001;
  a.x -= nx * penetration;
  a.z -= nz * penetration;
  b.x += nx * penetration;
  b.z += nz * penetration;
  const approach = (va.x - vb.x) * nx + (va.y - vb.y) * nz;
  if (approach <= 0) return 0;
  const impulse = approach * 0.75;
  va.x -= impulse * nx;
  va.y -= impulse * nz;
  vb.x += impulse * nx;
  vb.y += impulse * nz;
  return approach;
}
