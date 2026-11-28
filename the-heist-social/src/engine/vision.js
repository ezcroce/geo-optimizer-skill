import { WALL_SEGMENTS, DOORS, FURNITURE } from '../data/villaLayout.js';

// Furniture tall enough to obstruct sight; low tables, rugs and beds do not form walls.
const COVER_TYPES = new Set(['wardrobe', 'bookshelf', 'cabinet', 'folding_screen', 'hedge', 'server_rack', 'cctv_desk', 'kitchen_counter']);
const wallBoxes = WALL_SEGMENTS.map(s => ({
  minX: Math.min(s.x1, s.x2) - s.thickness / 2,
  maxX: Math.max(s.x1, s.x2) + s.thickness / 2,
  minZ: Math.min(s.z1, s.z2) - s.thickness / 2,
  maxZ: Math.max(s.z1, s.z2) + s.thickness / 2,
}));
const coverBoxes = FURNITURE.filter(f => (f.solid || f.type === 'hedge') && COVER_TYPES.has(f.type)).map(f => {
  const swap = Math.abs(Math.sin(f.rot || 0)) > 0.7;
  const hw = (swap ? f.d : f.w) / 2, hd = (swap ? f.w : f.d) / 2;
  return { minX: f.x - hw, maxX: f.x + hw, minZ: f.z - hd, maxZ: f.z + hd };
});

export function sightObstacles(sabotage = {}) {
  const doors = DOORS.filter(d => (sabotage.lockedWings?.[d.wing] || 0) > 0).map(d => {
    const h = d.orientation === 'h';
    return { minX: d.x - (h ? d.width / 2 : .22), maxX: d.x + (h ? d.width / 2 : .22), minZ: d.z - (h ? .22 : d.width / 2), maxZ: d.z + (h ? .22 : d.width / 2) };
  });
  return [...wallBoxes, ...coverBoxes, ...doors];
}

// Return the distance of the first ray-box hit, or maxDistance if nothing blocks it.
export function traceSight(x, z, dx, dz, maxDistance, obstacles) {
  let nearest = maxDistance;
  for (const box of obstacles) {
    let lo = 0, hi = nearest;
    if (Math.abs(dx) < 1e-9) {
      if (x < box.minX || x > box.maxX) continue;
    } else {
      const a = (box.minX - x) / dx, b = (box.maxX - x) / dx;
      lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    }
    if (Math.abs(dz) < 1e-9) {
      if (z < box.minZ || z > box.maxZ) continue;
    } else {
      const a = (box.minZ - z) / dz, b = (box.maxZ - z) / dz;
      lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    }
    if (hi >= lo && hi > 0 && lo > 0.001) nearest = Math.min(nearest, lo);
  }
  return nearest;
}

export function hasLineOfSight(from, to, range, obstacles) {
  const dx = to.x - from.x, dz = to.z - from.z, distance = Math.hypot(dx, dz);
  if (distance < 0.001) return true;
  if (distance > range) return false;
  return traceSight(from.x, from.z, dx / distance, dz / distance, distance, obstacles) >= distance - 0.02;
}

export function visibilityPolygon(origin, radius, obstacles, rays = 128) {
  return Array.from({ length: rays }, (_, i) => {
    const angle = i * Math.PI * 2 / rays, dx = Math.cos(angle), dz = Math.sin(angle);
    const d = traceSight(origin.x, origin.z, dx, dz, radius, obstacles);
    return { x: origin.x + d * dx, z: origin.z + d * dz };
  });
}

// Approximate camera detection with a horizontal cone and the same cover as the world.
export function cameraSees(camera, player, obstacles) {
  const dx = player.x - camera.pos.x, dz = player.z - camera.pos.z;
  const fx = camera.lookAt.x - camera.pos.x, fz = camera.lookAt.z - camera.pos.z;
  const distance = Math.hypot(dx, dz), facingLength = Math.hypot(fx, fz);
  if (distance > camera.detectRadius || distance < 0.01 || facingLength < 0.01) return false;
  const cosine = (dx * fx + dz * fz) / (distance * facingLength);
  if (cosine < Math.cos(camera.fov * Math.PI / 360)) return false;
  return hasLineOfSight({ x: camera.pos.x, z: camera.pos.z }, player, camera.detectRadius, obstacles);
}

// A civilian is blinded by a blackout; the thief keeps a short torch radius.
export function playerSightRange(player, sabotage) {
  if (sabotage?.blackoutRemaining > 0) return player?.role === 'thief' ? 4.5 : 0;
  return 11;
}
