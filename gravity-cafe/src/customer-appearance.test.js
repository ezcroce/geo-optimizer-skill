import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import {
  applyCustomerAppearance,
  prepareCustomerModel,
  animateCustomerFace,
  SKIN_TONES,
} from "./customer-appearance.js";
import { CUSTOMER_COLORS, alienAvatar } from "./avatars.js";
function model() {
  const root = new THREE.Group();
  for (const name of ["Skin", "Outfit", "Metal"]) {
    const material = new THREE.MeshPhysicalMaterial();
    material.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.name = name;
    root.add(mesh);
  }
  for (const name of [
    "TechVisor",
    "OpenHelmet",
    "VIPScarf",
    "VIPCape",
    "BrowL",
    "BrowR",
  ]) {
    const group = new THREE.Group();
    group.name = name;
    root.add(group);
  }
  return root;
}
test("customer archetypes change accessories, skin and outfit; pooled VIP accessories are removed on reuse", () => {
  const m = model();
  prepareCustomerModel(m);
  for (const kind of [0, 1, 2]) {
    applyCustomerAppearance(m, kind, true);
    assert.equal(m.getObjectByName("TechVisor").visible, kind === 0);
    assert.equal(m.getObjectByName("OpenHelmet").visible, kind === 1);
    assert.ok(m.getObjectByName("VIPScarf").visible);
    assert.equal(
      "#" + m.getObjectByName("Skin").material.color.getHexString(),
      SKIN_TONES[kind],
    );
    assert.equal(
      "#" + m.getObjectByName("Outfit").material.color.getHexString(),
      CUSTOMER_COLORS[kind],
    );
  }
  applyCustomerAppearance(m, 0, false);
  assert.ok(!m.getObjectByName("VIPScarf").visible);
  assert.ok(!m.getObjectByName("VIPCape").visible);
  assert.equal(m.getObjectByName("Skin").material.roughness, 0.48);
  assert.ok(m.getObjectByName("Skin").material.roughnessMap.isDataTexture);
  assert.equal(m.getObjectByName("Metal").material.metalness, 0.75);
});
test("material copies isolate customers, and hurry eyebrows relax again after the animation", () => {
  const a = model(),
    b = a.clone();
  prepareCustomerModel(a);
  prepareCustomerModel(b);
  applyCustomerAppearance(a, 0, true);
  applyCustomerAppearance(b, 2, false);
  assert.notEqual(
    a.getObjectByName("Skin").material,
    b.getObjectByName("Skin").material,
  );
  animateCustomerFace(a, "Hurry", 2);
  assert.ok(a.getObjectByName("BrowL").rotation.z < -0.1);
  assert.ok(a.getObjectByName("BrowR").rotation.z > 0.1);
  animateCustomerFace(a, "Idle", 0);
  assert.equal(a.getObjectByName("BrowL").rotation.z, 0);
  assert.notEqual(alienAvatar(0), alienAvatar(1));
  assert.notEqual(alienAvatar(1), alienAvatar(2));
});
test("generated customer GLB retains exactly seven named rig joints, five clips and selectable accessories", async () => {
  const data = await readFile(
    new URL("../public/models/customer.glb", import.meta.url),
  );
  assert.equal(data.toString("utf8", 0, 4), "glTF");
  const size = data.readUInt32LE(12);
  const gltf = JSON.parse(data.toString("utf8", 20, 20 + size));
  assert.deepEqual(
    gltf.skins[0].joints.map((i) => gltf.nodes[i].name).sort(),
    ["Hips", "Spine", "Head", "ArmL", "ArmR", "LegL", "LegR"].sort(),
  );
  assert.deepEqual(
    gltf.animations.map((a) => a.name).sort(),
    ["Idle", "Walk", "Float", "Cheer", "Hurry"].sort(),
  );
  for (const name of [
    "TechVisor",
    "OpenHelmet",
    "VIPScarf",
    "VIPCape",
    "BrowL",
    "BrowR",
  ])
    assert.ok(
      gltf.nodes.some((n) => n.name === name),
      name,
    );
  assert.ok(gltf.materials.some((m) => m.name === "Skin"));
  assert.ok(gltf.materials.some((m) => m.name === "Outfit"));
  const body = gltf.nodes.find((n) => n.name === "RiggedBody");
  assert.ok(
    gltf.meshes[body.mesh].primitives.length <= 9,
    "batch organic detail by material",
  );
});
