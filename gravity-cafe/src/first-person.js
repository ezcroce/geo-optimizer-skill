import * as THREE from "three";
export const EYE_HEIGHT = 1.6;
export const INTERACTION_RANGE = 3.4;
const X = new THREE.Vector3(1, 0, 0),
  Y = new THREE.Vector3(0, 1, 0),
  Z = new THREE.Vector3(0, 0, 1);

// In 0G tutte le rotazioni sono locali: nessun up globale e nessun gimbal lock.
// A terra si recupera gradualmente l'orizzonte, mantenendo lo sguardo.
export function turnView(orientation, yaw, pitch, roll, zeroG, dt = 1 / 60) {
  if (zeroG) {
    orientation.multiply(new THREE.Quaternion().setFromAxisAngle(Y, -yaw));
    orientation.multiply(new THREE.Quaternion().setFromAxisAngle(X, -pitch));
    orientation.multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll));
  } else {
    const euler = new THREE.Euler().setFromQuaternion(orientation, "YXZ");
    euler.y -= yaw;
    euler.x = THREE.MathUtils.clamp(euler.x - pitch, -1.48, 1.48);
    euler.z *= Math.exp(-10 * dt);
    orientation.setFromEuler(euler);
  }
  return orientation.normalize();
}
export function movementVector(orientation, strafe, forward, up, zeroG) {
  const vector = new THREE.Vector3(strafe, zeroG ? up : 0, -forward);
  if (vector.length() > 1) vector.normalize();
  if (zeroG) return vector.applyQuaternion(orientation);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(orientation);
  const yaw = Math.atan2(-direction.x, -direction.z);
  return vector.applyAxisAngle(Y, yaw);
}
export function advanceFlight(
  position,
  velocity,
  input,
  dt,
  { brake = false, zeroG = true, dashing = false, groundFriction = 1 } = {},
) {
  if (zeroG) {
    velocity.addScaledVector(input, dt * 4.5);
    velocity.multiplyScalar(Math.exp(-(brake ? 12 : 0.1) * dt));
    velocity.clampLength(0, dashing ? 7 : 4.6);
  } else {
    const alpha = Math.min(1, dt * 12 * groundFriction);
    if (dashing) {
      velocity.x *= Math.exp(-2 * dt);
      velocity.z *= Math.exp(-2 * dt);
    } else {
      velocity.x = THREE.MathUtils.lerp(velocity.x, input.x * 3.5, alpha);
      velocity.z = THREE.MathUtils.lerp(velocity.z, input.z * 3.5, alpha);
    }
    velocity.y -= 9.8 * dt;
  }
  position.addScaledVector(velocity, dt);
}
export function resolveVerticalBounds(
  position,
  velocity,
  floor,
  ceiling,
  zeroG,
) {
  if (position.y <= floor) {
    position.y = floor;
    if (velocity.y < 0) velocity.y = zeroG ? -velocity.y * 0.18 : 0;
  }
  if (position.y >= ceiling) {
    position.y = ceiling;
    if (velocity.y > 0) velocity.y = zeroG ? -velocity.y * 0.18 : 0;
  }
}
export function aimAt(orientation, from, to) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(from);
  camera.lookAt(to);
  orientation.copy(camera.quaternion);
}

// Le mesh di picking sono invisibili al renderer ma visibili al Raycaster.
// Il primo collider colpito decide l'interazione: niente E attraverso banconi o piani.
export function rayTarget(
  camera,
  targets,
  blockers,
  range = INTERACTION_RANGE,
) {
  camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(), camera);
  ray.far = range;
  const hits = ray.intersectObjects([...targets, ...blockers], false);
  return hits[0]?.object.userData.target
    ? {
        ...hits[0].object.userData.target,
        distance: hits[0].distance,
        object: hits[0].object,
      }
    : null;
}

// Contatto tra corpi in volo: separazione e impulso lungo la normale 3D.
export function resolveBodyContact(a, va, b, vb, radius = 0.82) {
  const normal = new THREE.Vector3().subVectors(b, a),
    distance = normal.length();
  if (distance >= radius) return 0;
  if (distance < 0.0001) normal.set(1, 0, 0);
  else normal.divideScalar(distance);
  const penetration = (radius - distance) / 2 + 0.001;
  a.addScaledVector(normal, -penetration);
  b.addScaledVector(normal, penetration);
  const approach = new THREE.Vector3().subVectors(va, vb).dot(normal);
  if (approach <= 0) return 0;
  va.addScaledVector(normal, -approach * 0.75);
  vb.addScaledVector(normal, approach * 0.75);
  return approach;
}
