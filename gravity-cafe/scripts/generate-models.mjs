// Asset originali del progetto, esportati come veri GLB riggati (nessuna rete).
// Rigenerazione: node scripts/generate-models.mjs
import * as T from "three";
import { rebalanceCustomer } from "./customer-anatomy.mjs";
import { sculptCharacter } from "./sculpted-character.mjs";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { writeFile } from "node:fs/promises";
class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((data) => {
      this.result = data;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((data) => {
      this.result = `data:${blob.type};base64,${Buffer.from(data).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader = FileReader;
const mat = (color) => new T.MeshStandardMaterial({ color, roughness: 0.65 });
async function save(name, scene, animations = []) {
  scene.traverse((node) => {
    if (node.geometry?.attributes.normal) {
      const normals = node.geometry.attributes.normal;
      for (let i = 0; i < normals.count; i++)
        if (
          Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) < 0.01
        )
          normals.setXYZ(i, 0, 1, 0);
      node.geometry.normalizeNormals();
    }
  });
  const data = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    animations,
  });
  await writeFile(
    new URL(`../public/models/${name}.glb`, import.meta.url),
    Buffer.from(data),
  );
  console.log(name, data.byteLength);
}
async function character(name, alien = false) {
  const root = new T.Group();
  root.name = name;
  const boneNames = ["Hips", "Spine", "Head", "ArmL", "ArmR", "LegL", "LegR"];
  const bones = boneNames.map((n) => {
    const b = new T.Bone();
    b.name = n;
    return b;
  });
  bones[0].position.y = 0.86;
  bones[1].position.y = 0.27;
  bones[2].position.y = 0.36;
  bones[0].add(bones[1], bones[5], bones[6]);
  bones[1].add(bones[2], bones[3], bones[4]);
  bones[3].position.set(-0.225, 0.2, 0);
  bones[4].position.set(0.225, 0.2, 0);
  bones[5].position.set(-0.1, -0.02, 0);
  bones[6].position.set(0.1, -0.02, 0);
  root.add(bones[0]);
  root.updateMatrixWorld(true);
  const { pieces: geometries, mats } = sculptCharacter(root, bones, alien);
  if (alien) rebalanceCustomer(root, bones, geometries, mats);
  // mergeGeometries(useGroups) crea un gruppo per pezzo: rimappiamo il materiale.
  const materialIds = [
    ...new Set(geometries.map((g) => g.groups[0].materialIndex)),
  ];
  const batches = materialIds.map((id) =>
    mergeGeometries(
      geometries.filter((g) => g.groups[0].materialIndex === id),
      false,
    ),
  );
  const geo = mergeGeometries(batches, true);
  geo.groups.forEach((g, i) => (g.materialIndex = materialIds[i]));
  const mesh = new T.SkinnedMesh(geo, mats);
  mesh.name = "RiggedBody";
  root.add(mesh);
  mesh.bind(new T.Skeleton(bones));
  const track = (bone, axis, values) =>
    new T.QuaternionKeyframeTrack(
      `${bone}.quaternion`,
      [0, 0.25, 0.5, 0.75, 1],
      values.flatMap((angle) =>
        new T.Quaternion()
          .setFromAxisAngle(
            new T.Vector3(
              axis === "x" ? 1 : 0,
              axis === "y" ? 1 : 0,
              axis === "z" ? 1 : 0,
            ),
            angle,
          )
          .toArray(),
      ),
    );
  const clips = [
    new T.AnimationClip("Idle", 2, [
      track("Spine", "z", [0, 0.025, 0, -0.025, 0]),
      track("Head", "y", [-0.08, 0, 0.08, 0, -0.08]),
    ]),
    new T.AnimationClip("Walk", 1, [
      track("LegL", "x", [0.5, 0, -0.5, 0, 0.5]),
      track("LegR", "x", [-0.5, 0, 0.5, 0, -0.5]),
      track("ArmL", "x", [-0.35, 0, 0.35, 0, -0.35]),
      track("ArmR", "x", [0.35, 0, -0.35, 0, 0.35]),
    ]),
    new T.AnimationClip("Float", 2, [
      track("ArmL", "z", [-0.35, -0.6, -0.35, -0.15, -0.35]),
      track("ArmR", "z", [0.35, 0.6, 0.35, 0.15, 0.35]),
      track("LegL", "x", [-0.3, -0.6, -0.3, 0.1, -0.3]),
      track("LegR", "x", [0.1, -0.3, -0.6, -0.3, 0.1]),
    ]),
  ];
  clips.push(
    new T.AnimationClip("Cheer", 1, [
      track("ArmL", "z", [0, 2.5, 2.8, 2.5, 0]),
      track("ArmR", "z", [0, -2.5, -2.8, -2.5, 0]),
      track("Head", "x", [0, -0.2, 0, -0.2, 0]),
    ]),
    new T.AnimationClip("Hurry", 1, [
      track("Spine", "z", [-0.08, 0.08, -0.08, 0.08, -0.08]),
      track("ArmL", "x", [-0.6, 0.6, -0.6, 0.6, -0.6]),
      track("ArmR", "x", [0.6, -0.6, 0.6, -0.6, 0.6]),
    ]),
  );
  for (const clip of clips)
    if (["Idle", "Float"].includes(clip.name))
      for (const track of clip.tracks)
        track.times = new Float32Array(Array.from(track.times, (t) => t * 2));
  {
    const idle = clips.find((c) => c.name === "Idle");
    idle.tracks.push(
      new T.VectorKeyframeTrack(
        "Spine.scale",
        [0, 1, 2],
        [1, 1, 1, 1.015, 1.025, 1.01, 1, 1, 1],
      ),
    );
    for (const clip of clips)
      if (["Walk", "Hurry"].includes(clip.name))
        clip.tracks.push(track("Head", "y", [-0.05, 0, 0.05, 0, -0.05]));
  }
  await save(name, root, clips);
}
await character("barista");
await character("customer", true);
const cup = new T.Group();
cup.name = "CoffeeCup";
function piece(name, geo, material, x, y, z) {
  const m = new T.Mesh(geo, material);
  m.name = name;
  m.position.set(x, y, z);
  cup.add(m);
  return m;
}
const cream = mat("#f8efd9");
piece(
  "Ceramic",
  new T.CylinderGeometry(0.16, 0.12, 0.28, 24, 1, true),
  cream,
  0,
  0.16,
  0,
).material.side = T.DoubleSide;
piece(
  "Base",
  new T.CylinderGeometry(0.12, 0.12, 0.025, 24),
  cream,
  0,
  0.035,
  0,
);
piece(
  "Rim",
  new T.TorusGeometry(0.16, 0.016, 8, 24),
  cream,
  0,
  0.3,
  0,
).rotation.x = Math.PI / 2;
piece("Handle", new T.TorusGeometry(0.1, 0.032, 8, 20), cream, 0.175, 0.17, 0);
piece(
  "Fill",
  new T.CylinderGeometry(0.14, 0.14, 0.012, 24),
  mat("#59392a"),
  0,
  0.287,
  0,
);
piece(
  "Saucer",
  new T.CylinderGeometry(0.245, 0.22, 0.025, 32),
  cream,
  0,
  0.015,
  0,
);
piece(
  "SaucerRim",
  new T.TorusGeometry(0.227, 0.016, 8, 32),
  cream,
  0,
  0.035,
  0,
).rotation.x = Math.PI / 2;
const crema = piece(
  "Crema",
  new T.TorusGeometry(0.112, 0.014, 8, 28),
  mat("#c78e43"),
  0,
  0.296,
  0,
);
crema.rotation.x = Math.PI / 2;
const latte = piece(
  "LatteArt",
  new T.TorusGeometry(0.065, 0.019, 8, 24),
  mat("#fff2d6"),
  0,
  0.301,
  0,
);
latte.rotation.x = Math.PI / 2;
latte.scale.x = 0.6;
const foam = new T.Group();
foam.name = "Foam";
cup.add(foam);
for (let i = 0; i < 13; i++) {
  const bubble = new T.Mesh(
    new T.SphereGeometry(0.044 + (i % 3) * 0.012, 12, 8),
    mat("#fff3db"),
  );
  bubble.position.set(
    Math.sin(i * 2.4) * 0.09,
    0.3 + (i % 3) * 0.017,
    Math.cos(i * 2.4) * 0.09,
  );
  bubble.scale.y = 0.65;
  foam.add(bubble);
}
const foamParts = foam.children.map((part) => {
  part.updateMatrix();
  return part.geometry.clone().applyMatrix4(part.matrix);
});
const foamMesh = new T.Mesh(
  mergeGeometries(foamParts, false),
  foam.children[0].material,
);
foamMesh.name = "Foam";
cup.remove(foam);
cup.add(foamMesh);
const ceramicParts = cup.children.filter((part) => part.material === cream);
const ceramicGeometry = mergeGeometries(
  ceramicParts.map((part) => {
    part.updateMatrix();
    return part.geometry.clone().applyMatrix4(part.matrix);
  }),
  false,
);
ceramicParts.forEach((part) => cup.remove(part));
const ceramic = new T.Mesh(ceramicGeometry, cream);
ceramic.name = "Ceramic";
cup.add(ceramic);
await save("cup", cup);
