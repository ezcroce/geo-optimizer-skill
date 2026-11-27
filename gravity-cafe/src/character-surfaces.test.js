import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  characterTextures,
  prepareCharacterMaterials,
} from "./character-surfaces.js";
import {
  apronDepth,
  continuousSuit,
  continuousHead,
  suitField,
} from "../scripts/sculpted-character.mjs";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { readFile } from "node:fs/promises";

test("skin pores, skin roughness and woven cloth use four distinct cached linear data maps", () => {
  const maps = characterTextures();
  assert.equal(characterTextures(), maps);
  assert.equal(new Set(Object.values(maps)).size, 4);
  for (const texture of Object.values(maps)) {
    assert.equal(texture.image.width, 128);
    assert.equal(texture.colorSpace, T.NoColorSpace);
    assert.equal(texture.wrapS, T.RepeatWrapping);
    assert.ok(texture.generateMipmaps);
    const values = texture.image.data.filter((_, i) => i % 4 === 0);
    assert.ok(new Set(values).size > 10);
  }
  assert.notDeepEqual(maps.skinBump.image.data, maps.clothBump.image.data);
  assert.notDeepEqual(maps.skinBump.image.data, maps.skinRoughness.image.data);
});

test("barista apron and suits get soft physical sheen, distinct textile bump and independent materials", () => {
  const a = new T.Group();
  for (const name of ["Skin", "Outfit", "Fabric", "Apron"]) {
    const material = new T.MeshStandardMaterial({ color: "#aabbcc" });
    material.name = name;
    a.add(new T.Mesh(new T.PlaneGeometry(), material));
  }
  const b = a.clone();
  prepareCharacterMaterials(a);
  prepareCharacterMaterials(b);
  for (let i = 0; i < a.children.length; i++) {
    const m = a.children[i].material;
    assert.ok(m.isMeshPhysicalMaterial);
    assert.notEqual(m, b.children[i].material);
    assert.equal(m.clearcoat, 0);
    assert.equal(m.color.getHex(), 0xaabbcc);
    if (m.name !== "Skin") {
      assert.ok(m.sheen >= 0.4);
      assert.ok(m.roughness >= 0.88);
      assert.equal(m.bumpMap, characterTextures().clothBump);
    } else {
      assert.equal(m.roughness, 0.48);
      assert.equal(m.bumpMap, characterTextures().skinBump);
    }
  }
});

function componentCount(source) {
  const g = source.clone();
  for (const name of Object.keys(g.attributes))
    if (name !== "position") g.deleteAttribute(name);
  const welded = mergeVertices(g, 1e-5),
    index = welded.index;
  const parent = Array.from(
    { length: welded.attributes.position.count },
    (_, i) => i,
  );
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const used = new Set();
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i),
      b = index.getX(i + 1),
      c = index.getX(i + 2);
    parent[find(a)] = find(b);
    parent[find(c)] = find(b);
    used.add(a);
    used.add(b);
    used.add(c);
  }
  return new Set([...used].map(find)).size;
}
test("the garment is one welded anatomical shell, not intersecting shoulder, knee or torso pieces", () => {
  const suit = continuousSuit();
  assert.equal(componentCount(suit), 1);
  for (const name of ["position", "normal", "uv"])
    assert.ok(Array.from(suit.attributes[name].array).every(Number.isFinite));
  assert.ok(suitField(0.205, 1.34, 0) < 0, "connected shoulder");
  assert.ok(suitField(0.105, 0.49, 0.014) < 0, "continuous knee");
  assert.ok(suitField(0, 0.9, 0) < 0, "continuous waist");
  const adult = continuousHead(true);
  assert.equal(componentCount(adult), 1);
  suit.computeBoundingBox();
  adult.computeBoundingBox();
  assert.ok(
    (adult.boundingBox.max.x - adult.boundingBox.min.x) /
      (suit.boundingBox.max.x - suit.boundingBox.min.x) <
      0.4,
    "adult head-to-shoulder proportion",
  );
  const pos = adult.attributes.position,
    norm = adult.attributes.normal;
  let front = 0;
  for (let i = 0; i < pos.count; i++)
    if (
      Math.abs(pos.getX(i)) < 0.001 &&
      pos.getZ(i) > 0.04 &&
      pos.getY(i) > 0.15
    ) {
      assert.ok(norm.getZ(i) > 0, "face normals point outwards");
      front++;
    }
  assert.ok(front > 10);
});

test("both original GLBs retain seven bones, five clips, smooth skinning and a breathing torso", async () => {
  for (const name of ["customer", "barista"]) {
    const file = await readFile(
      new URL(`../public/models/${name}.glb`, import.meta.url),
    );
    const jsonLength = file.readUInt32LE(12),
      gltf = JSON.parse(file.toString("utf8", 20, 20 + jsonLength));
    assert.ok(
      gltf.nodes.some(
        (n) => n.extras?.surfaceDesign === "continuous-anatomy-v2",
      ),
    );
    assert.equal(gltf.skins[0].joints.length, 7);
    assert.deepEqual(gltf.animations.map((c) => c.name).sort(), [
      "Cheer",
      "Float",
      "Hurry",
      "Idle",
      "Walk",
    ]);
    const spine = gltf.nodes.findIndex((n) => n.name === "Spine");
    assert.ok(
      gltf.animations
        .find((a) => a.name === "Idle")
        .channels.some(
          (c) => c.target.node === spine && c.target.path === "scale",
        ),
    );
    const body = gltf.nodes.find((n) => n.name === "RiggedBody"),
      primitives = gltf.meshes[body.mesh].primitives;
    assert.ok(primitives.length < 11);
    const a = gltf.accessors[primitives[0].attributes.WEIGHTS_0],
      view = gltf.bufferViews[a.bufferView],
      offset = 28 + jsonLength + (view.byteOffset ?? 0) + (a.byteOffset ?? 0),
      stride = view.byteStride ?? 16;
    let blended = 0;
    for (let i = 0; i < a.count; i++) {
      const weights = [0, 1, 2, 3].map((j) =>
        file.readFloatLE(offset + i * stride + j * 4),
      );
      assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-5);
      if (weights[1] > 0 && weights[1] < 1) blended++;
    }
    assert.ok(blended > 100, "torso cloth blends Hips and Spine");
    if (name === "barista") {
      assert.ok(gltf.nodes.some((n) => n.name === "BaristaCap"));
      assert.ok(gltf.materials.some((m) => m.name === "Apron"));
    }
  }
});

test("apron clears the trouser front at the hips and thighs", () => {
  for (const y of [0.76, 0.84, 0.9, 1.0, 1.2])
    for (const x of [-0.16, -0.08, 0, 0.08, 0.16])
      assert.ok(apronDepth(x, y) >= 0.126);
});
