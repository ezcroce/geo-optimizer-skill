import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { readFile } from "node:fs/promises";
import {
  CUSTOMER_LANDMARKS,
  customerHeight,
  customerPoint,
  customerSuitWeights,
  customerSkinPoint,
  rebalanceCustomer,
} from "../scripts/customer-anatomy.mjs";

test("customer height follows anatomical landmarks monotonically with no sudden step at the waist", () => {
  for (const [source, target] of CUSTOMER_LANDMARKS)
    assert.ok(Math.abs(customerHeight(source) - target) < 1e-10);
  let previous = customerHeight(0.03);
  for (let y = 0.031; y < 1.85; y += 0.001) {
    const current = customerHeight(y);
    assert.ok(current > previous);
    previous = current;
  }
  const a = customerPoint(0.1, 0.81999, 0.08),
    b = customerPoint(0.1, 0.82001, 0.08);
  assert.ok(a.distanceTo(b) < 0.0001);
});

test("head-to-shoulder balance, left/right symmetry and proper hand length stay within adult ranges", () => {
  const head = customerPoint(0.083, 1.58, 0).x * 2,
    shoulders = customerPoint(0.255, 1.34, 0).x * 2;
  assert.ok(shoulders / head > 2.4 && shoulders / head < 3.2);
  for (const y of [0.14, 0.49, 0.8, 0.9, 1.18, 1.45, 1.6])
    for (const x of [0.01, 0.12, 0.28]) {
      const left = customerPoint(-x, y, 0.05),
        right = customerPoint(x, y, 0.05);
      assert.ok(Math.abs(left.x + right.x) < 1e-12);
      assert.equal(left.y, right.y);
      assert.equal(left.z, right.z);
    }
  const wrist = customerSkinPoint(0.285, 0.835, 0.035),
    tip = customerSkinPoint(0.29, 0.713, 0.043),
    cuff = customerPoint(0.285, 0.8, 0.035);
  assert.ok(wrist.y - tip.y > 0.14 && wrist.y - tip.y < 0.19);
  assert.ok(wrist.distanceTo(cuff) < 0.005, "hand meets cuff");
  assert.ok(
    customerPoint(0.01, 0.8, 0).x >= 0,
    "inner thigh never crosses the centreline",
  );
});

test("the customer correction moves rig pivots and accessories along with the surface", () => {
  const root = new T.Group(),
    hips = new T.Bone(),
    head = new T.Bone();
  hips.position.y = 0.86;
  head.position.y = 0.63;
  hips.add(head);
  root.add(hips);
  const prop = new T.Mesh(
    new T.PlaneGeometry(0.04, 0.02),
    new T.MeshStandardMaterial(),
  );
  prop.position.set(0.03, 0.11, 0.08);
  head.add(prop);
  root.updateMatrixWorld(true);
  const old = prop.getWorldPosition(new T.Vector3()),
    expected = customerPoint(...old.toArray());
  rebalanceCustomer(root, [hips, head], [], []);
  assert.ok(prop.getWorldPosition(new T.Vector3()).distanceTo(expected) < 1e-8);
  assert.ok(
    Math.abs(head.getWorldPosition(new T.Vector3()).y - customerHeight(1.49)) <
      1e-8,
  );
});

test("only the regenerated customer GLB carries the balanced anatomy revision", async () => {
  for (const name of ["customer", "barista"]) {
    const file = await readFile(
      new URL(`../public/models/${name}.glb`, import.meta.url),
    );
    const length = file.readUInt32LE(12),
      gltf = JSON.parse(file.toString("utf8", 20, 20 + length));
    assert.equal(
      gltf.nodes.some((n) => n.extras?.anatomy === "balanced-customer-v3"),
      name === "customer",
    );
  }
});

test("cuffs follow the arm rather than the leg during Walk and Cheer", () => {
  for (const side of [-1, 1]) {
    const cuff = customerSuitWeights(side * 0.28, 0.805);
    assert.equal(cuff.ids[2], side < 0 ? 3 : 4);
    assert.ok(cuff.weights[2] > 0.99);
    assert.equal(cuff.weights[3], 0);
    const knee = customerSuitWeights(side * 0.1, 0.49);
    assert.ok(knee.weights[3] > 0.99);
    assert.equal(knee.weights[2], 0);
  }
  for (const y of [0.14, 0.49, 0.8, 0.92, 1.18, 1.34])
    for (const x of [-0.28, -0.15, 0, 0.15, 0.28]) {
      const weights = customerSuitWeights(x, y).weights;
      assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-9);
      assert.ok(weights.every((w) => w >= 0 && w <= 1));
    }
});

test("reference customer has EVA equipment, a sealed dark visor and separate selectable helmet", async () => {
  const file = await readFile(
    new URL("../public/models/customer.glb", import.meta.url),
  );
  const gltf = JSON.parse(
    file.toString("utf8", 20, 20 + file.readUInt32LE(12)),
  );
  for (const name of [
    "OpenHelmet",
    "PressureVisor",
    "VisorSeal",
    "PressureCollar",
    "LifeSupport",
    "ChestConsole",
    "OxygenHose-1",
    "OxygenHose1",
    "ThighPocket-1",
    "ThighPocket1",
  ])
    assert.ok(
      gltf.nodes.some((n) => n.name === name),
      name,
    );
  const helmet = gltf.nodes.find((n) => n.name === "OpenHelmet");
  const childNames = helmet.children.map((i) => gltf.nodes[i].name);
  assert.ok(childNames.includes("PressureVisor"));
  assert.ok(childNames.includes("VisorSeal"));
  const visor = gltf.materials.find((m) => m.name === "EVAVisor");
  assert.ok(visor.pbrMetallicRoughness.roughnessFactor <= 0.15);
  assert.ok(
    gltf.nodes.some((n) => n.extras?.referenceDesign === "grey-alien-eva-v1"),
  );
});
