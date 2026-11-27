import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  turnView,
  movementVector,
  advanceFlight,
  resolveVerticalBounds,
  rayTarget,
  aimAt,
} from "./first-person.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);

test("first-person movement is relative to view heading, not screen-isometric axes", () => {
  const q = new T.Quaternion();
  near(movementVector(q, 0, 1, 0, false).z, -1);
  q.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 2);
  near(movementVector(q, 0, 1, 0, false).x, -1);
  near(movementVector(q, 1, 0, 0, false).z, -1);
});
test("ground movement ignores pitch, while zero-G thrust follows full orientation", () => {
  const q = new T.Quaternion().setFromAxisAngle(
    new T.Vector3(1, 0, 0),
    Math.PI / 3,
  );
  near(movementVector(q, 0, 1, 0, false).y, 0);
  assert.ok(movementVector(q, 0, 1, 0, true).y > 0.8);
});
test("local up thrust rotates with roll: all three translational degrees are independent", () => {
  const q = new T.Quaternion();
  turnView(q, 0, 0, Math.PI / 2, true);
  near(movementVector(q, 0, 0, 1, true).x, -1);
  near(movementVector(q, 1, 0, 0, true).y, 1);
});
test("zero-G look can rotate upside-down without a pitch clamp or gimbal lock", () => {
  const q = new T.Quaternion();
  turnView(q, 0, -Math.PI, 0, true);
  near(new T.Vector3(0, 1, 0).applyQuaternion(q).y, -1);
  for (let i = 0; i < 1000; i++) turnView(q, 0.1, 0.07, 0.05, true);
  near(q.length(), 1);
  assert.ok(q.toArray().every(Number.isFinite));
});
test("ground look clamps pitch and gradually restores the horizon after a gravity change", () => {
  const q = new T.Quaternion();
  turnView(q, 0, 10, 0, false);
  assert.ok(new T.Euler().setFromQuaternion(q, "YXZ").x >= -1.48 - 1e-5);
  q.setFromEuler(new T.Euler(0.1, 0.5, 0.8, "YXZ"));
  for (let i = 0; i < 120; i++) turnView(q, 0, 0, 0, false);
  near(new T.Euler().setFromQuaternion(q, "YXZ").z, 0);
});
test("zero-G inertia persists without input, Shift brakes all three velocity axes", () => {
  const p = new T.Vector3(),
    v = new T.Vector3(2, 3, 1);
  advanceFlight(p, v, new T.Vector3(), 1 / 60, { zeroG: true });
  assert.ok(v.y > 2.9);
  for (let i = 0; i < 60; i++)
    advanceFlight(p, v, new T.Vector3(), 1 / 60, { zeroG: true, brake: true });
  assert.ok(v.length() < 0.0001);
});
test("three-dimensional thrust is speed-limited and diagonal input is normalized", () => {
  const q = new T.Quaternion(),
    input = movementVector(q, 1, 1, 1, true);
  near(input.length(), 1);
  const p = new T.Vector3(),
    v = new T.Vector3();
  for (let i = 0; i < 1000; i++)
    advanceFlight(p, v, input, 1 / 60, { zeroG: true });
  near(v.length(), 4.6);
  assert.ok(p.y > 0);
});
test("floor and ceiling contacts correct only outward vertical velocity", () => {
  let p = { y: -1 },
    v = { y: -3 };
  resolveVerticalBounds(p, v, 0.13, 4.6, true);
  near(p.y, 0.13);
  assert.ok(v.y > 0);
  p.y = 5;
  v.y = 2;
  resolveVerticalBounds(p, v, 0.13, 4.6, true);
  near(p.y, 4.6);
  assert.ok(v.y < 0);
  p.y = 4.6;
  v.y = -2;
  resolveVerticalBounds(p, v, 0.13, 4.6, true);
  near(v.y, -2);
});
test("gravity returns a floating player to the floor instead of snapping altitude", () => {
  const p = new T.Vector3(0, 3, 0),
    v = new T.Vector3();
  advanceFlight(p, v, new T.Vector3(), 1 / 60, { zeroG: false });
  assert.ok(p.y < 3 && p.y > 2.9);
  assert.ok(v.y < 0);
});
test("centre ray requires looking at a close target; a nearby object behind is not interactable", () => {
  const camera = new T.PerspectiveCamera(76, 1, 0.06, 100);
  const target = new T.Mesh(new T.BoxGeometry(1, 1, 1));
  target.position.z = -2;
  target.userData.target = { kind: "station", station: "coffee" };
  target.updateMatrixWorld();
  assert.equal(rayTarget(camera, [target], [])?.station, "coffee");
  camera.rotateY(Math.PI);
  assert.equal(rayTarget(camera, [target], []), null);
  camera.rotateY(Math.PI);
  target.position.z = -6;
  target.updateMatrixWorld();
  assert.equal(rayTarget(camera, [target], []), null);
});
test("raycasting respects occlusion: no serving through a counter or a floor", () => {
  const camera = new T.PerspectiveCamera(),
    target = new T.Mesh(new T.BoxGeometry(1, 1, 1));
  target.position.z = -3;
  target.userData.target = { kind: "pickup" };
  target.updateMatrixWorld();
  const wall = new T.Mesh(new T.BoxGeometry(2, 2, 0.1));
  wall.position.z = -1;
  wall.updateMatrixWorld();
  assert.equal(rayTarget(camera, [target], [wall]), null);
  wall.position.x = 5;
  wall.updateMatrixWorld();
  assert.equal(rayTarget(camera, [target], [wall])?.kind, "pickup");
});
test("initial view points at the actual machine, including its height", () => {
  const q = new T.Quaternion(),
    from = new T.Vector3(-4.2, 1.73, -1.8),
    to = new T.Vector3(-4.4, 2.05, -3.7);
  aimAt(q, from, to);
  const forward = new T.Vector3(0, 0, -1).applyQuaternion(q);
  near(forward.dot(to.sub(from).normalize()), 1);
});

test("zero-G body contact transfers vertical momentum as well as horizontal momentum", async () => {
  const { resolveBodyContact } = await import("./first-person.js");
  const a = new T.Vector3(),
    b = new T.Vector3(0, 0.5, 0),
    va = new T.Vector3(0, 3, 0),
    vb = new T.Vector3();
  const impact = resolveBodyContact(a, va, b, vb);
  assert.equal(impact, 3);
  assert.ok(b.y - a.y >= 0.82);
  assert.ok(vb.y > va.y);
  near(va.y + vb.y, 3);
});

test("Cryo ice reduces grounded deceleration by exactly 75 percent without changing dry movement", () => {
  const p = new T.Vector3(),
    v = new T.Vector3(4, 0, 0),
    dry = v.clone();
  advanceFlight(p, v, new T.Vector3(), 1 / 60, {
    zeroG: false,
    groundFriction: 0.25,
  });
  advanceFlight(new T.Vector3(), dry, new T.Vector3(), 1 / 60, {
    zeroG: false,
  });
  assert.ok(Math.abs((4 - v.x) / (4 - dry.x) - 0.25) < 1e-10);
});
