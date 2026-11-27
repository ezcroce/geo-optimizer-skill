import * as T from "three";
import { spaceEquipment, inflateSuit } from "./reference-details.mjs";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const smoothUnion = (a, b, k = 0.025) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const ell = (x, y, z, c, rx, ry, rz) =>
  (Math.hypot((x - c[0]) / rx, (y - c[1]) / ry, (z - c[2]) / rz) - 1) *
  Math.min(rx, ry, rz);
function limb(x, y, z, a, b, ra, rb) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2],
    u = T.MathUtils.clamp(
      ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) /
        (dx * dx + dy * dy + dz * dz),
      0,
      1,
    );
  return (
    Math.hypot(
      x - a[0] - dx * u,
      y - a[1] - dy * u,
      (z - a[2] - dz * u) * 1.08,
    ) - T.MathUtils.lerp(ra, rb, u)
  );
}
function interpolate(rows, y) {
  let i = 0;
  while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
  const a = rows[i],
    b = rows[i + 1],
    prev = rows[Math.max(0, i - 1)],
    next = rows[Math.min(rows.length - 1, i + 2)],
    d = b[0] - a[0],
    t = T.MathUtils.clamp((y - a[0]) / d, 0, 1);
  return [1, 2].map((axis) => {
    const m0 = (b[axis] - prev[axis]) / (b[0] - prev[0]),
      m1 = (next[axis] - a[axis]) / (next[0] - a[0]);
    return Math.max(
      0.0003,
      (2 * t * t * t - 3 * t * t + 1) * a[axis] +
        (t * t * t - 2 * t * t + t) * d * m0 +
        (-2 * t * t * t + 3 * t * t) * b[axis] +
        (t * t * t - t * t) * d * m1,
    );
  });
}

const torso = [
  [0.79, 0.12, 0.083],
  [0.9, 0.158, 0.102],
  [1.03, 0.145, 0.093],
  [1.18, 0.185, 0.11],
  [1.31, 0.195, 0.098],
  [1.38, 0.15, 0.075],
  [1.425, 0.043, 0.041],
];
export function suitField(x, y, z) {
  const [rx, rz] = interpolate(torso, y);
  let d = Math.max(
    (Math.hypot(x / rx, z / rz) - 1) * Math.min(rx, rz),
    0.79 - y,
    y - 1.425,
  );
  for (const side of [-1, 1]) {
    let arm = limb(
      x,
      y,
      z,
      [side * 0.198, 1.33, 0],
      [side * 0.257, 1.08, 0.008],
      0.065,
      0.049,
    );
    arm = smoothUnion(
      arm,
      limb(
        x,
        y,
        z,
        [side * 0.257, 1.08, 0.008],
        [side * 0.285, 0.835, 0.034],
        0.049,
        0.035,
      ),
      0.018,
    );
    d = smoothUnion(d, arm, 0.038);
    let leg = limb(
      x,
      y,
      z,
      [side * 0.088, 0.845, 0],
      [side * 0.105, 0.49, 0.014],
      0.09,
      0.066,
    );
    leg = smoothUnion(
      leg,
      limb(
        x,
        y,
        z,
        [side * 0.105, 0.49, 0.014],
        [side * 0.11, 0.14, 0],
        0.066,
        0.051,
      ),
      0.02,
    );
    leg = smoothUnion(
      leg,
      ell(x, y, z, [side * 0.11, 0.09, 0.052], 0.061, 0.06, 0.125),
      0.018,
    );
    d = smoothUnion(d, leg, 0.028);
  }
  // Minute drape around knees, waist and elbows, rather than bead-like muscles.
  const folds =
    (Math.exp(-((y - 0.51) ** 2) / 0.006) +
      Math.exp(-((y - 1.07) ** 2) / 0.004)) *
    Math.sin(y * 130 + z * 18) *
    0.0014;
  return d + folds;
}
function isoSurface(field, min, max, resolution = 76) {
  const material = new T.MeshStandardMaterial(),
    mc = new MarchingCubes(resolution, material, false, false, 90000);
  mc.isolation = 0;
  const span = max.map((v, i) => v - min[i]);
  let n = 0;
  for (let z = 0; z < resolution; z++)
    for (let y = 0; y < resolution; y++)
      for (let x = 0; x < resolution; x++)
        mc.field[n++] = -field(
          min[0] + (x / resolution) * span[0],
          min[1] + (y / resolution) * span[1],
          min[2] + (z / resolution) * span[2],
        );
  mc.update();
  const geo = new T.BufferGeometry();
  geo.setAttribute(
    "position",
    new T.BufferAttribute(
      mc.geometry.attributes.position.array.slice(0, mc.count * 3),
      3,
    ),
  );
  const p = geo.attributes.position,
    uv = [];
  for (let i = 0; i < p.count; i++) {
    const x = min[0] + (p.getX(i) + 1) * 0.5 * span[0],
      y = min[1] + (p.getY(i) + 1) * 0.5 * span[1],
      z = min[2] + (p.getZ(i) + 1) * 0.5 * span[2];
    p.setXYZ(i, x, y, z);
    uv.push(x * 1.4 + 0.5, y * 0.65);
  }
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  const welded = mergeVertices(geo, 1e-5);
  welded.computeVertexNormals();
  mc.geometry.dispose();
  material.dispose();
  return welded;
}
export function continuousSuit() {
  return isoSurface(suitField, [-0.43, 0.012, -0.17], [0.43, 1.48, 0.23]);
}
const headRows = [
  [-0.13, 0.037, 0.035],
  [-0.055, 0.041, 0.036],
  [-0.025, 0.033, 0.039],
  [0, 0.051, 0.052],
  [0.045, 0.069, 0.062],
  [0.09, 0.077, 0.073],
  [0.14, 0.07, 0.077],
  [0.19, 0.066, 0.071],
  [0.225, 0.046, 0.049],
  [0.24, 0.0003, 0.0003],
];
export function facePoint(y, angle, alien = false) {
  let [rx, rz] = interpolate(headRows, y);
  if (alien) {
    const crown = T.MathUtils.smoothstep(y, 0.08, 0.17);
    rx *= T.MathUtils.lerp(0.87, 1.17, crown);
    rz *= T.MathUtils.lerp(0.95, 1.1, crown);
  }
  const u = Math.sin(angle),
    front = Math.max(0, Math.cos(angle)),
    x = rx * u;
  let z = rz * Math.cos(angle) - 0.009;
  if (front > 0) {
    const socket = Math.exp(
      -((Math.abs(x) - 0.031) ** 2) / 0.00014 - (y - 0.112) ** 2 / 0.00016,
    );
    const bridge =
      0.022 * Math.exp(-(x * x) / 0.000055 - (y - 0.085) ** 2 / 0.0011);
    const tip =
      0.023 * Math.exp(-(x * x) / 0.0001 - (y - 0.062) ** 2 / 0.00009);
    const cheek =
      0.006 *
      Math.exp(
        -((Math.abs(x) - 0.047) ** 2) / 0.0002 - (y - 0.068) ** 2 / 0.00015,
      );
    const brow =
      0.006 *
      Math.exp(
        -((Math.abs(x) - 0.032) ** 2) / 0.0003 - (y - 0.134) ** 2 / 0.00005,
      );
    const lip =
      0.0035 * Math.exp(-(x * x) / 0.00042 - (y - 0.022) ** 2 / 0.000016) -
      0.0028 * Math.exp(-(x * x) / 0.0004 - (y - 0.026) ** 2 / 0.000003);
    const ridge = alien
      ? 0.0035 *
        Math.cos(x * 210 + y * 20) *
        Math.exp(-((y - 0.18) ** 2) / 0.004)
      : 0;
    z +=
      front *
      ((bridge + tip) * (alien ? 0.48 : 1) +
        cheek +
        brow -
        (alien ? 0.02 : 0.013) * socket +
        lip +
        ridge);
  }
  const ear =
    Math.exp(-((y - 0.095) ** 2) / 0.0009) *
    Math.exp(-((Math.abs(u) - 1) ** 2) / 0.004);
  return [x + Math.sign(x) * ear * (alien ? 0.015 : 0.01), y, z];
}
export function continuousHead(alien = false) {
  const positions = [],
    uv = [],
    indices = [],
    rows = 112,
    sides = 96;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= sides; i++) {
      positions.push(
        ...facePoint(
          -0.13 + (j / rows) * 0.37,
          (i / sides) * Math.PI * 2,
          alien,
        ),
      );
      uv.push(i / sides, j / rows);
    }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i,
        b = a + sides + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Match normals on the UV seam; the surface itself has no separate facial pieces.
  const norm = g.attributes.normal;
  for (let j = 0; j <= rows; j++) {
    const a = j * (sides + 1),
      b = a + sides,
      v = new T.Vector3()
        .fromBufferAttribute(norm, a)
        .add(new T.Vector3().fromBufferAttribute(norm, b))
        .normalize();
    norm.setXYZ(a, v.x, v.y, v.z);
    norm.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}
function handField(side) {
  return (x, y, z) => {
    const cx = side * 0.285;
    let d = ell(x, y, z, [cx, 0.782, 0.035], 0.026, 0.055, 0.021);
    d = smoothUnion(
      d,
      limb(
        x,
        y,
        z,
        [cx, 0.772, 0.041],
        [cx + side * 0.005, 0.713, 0.043],
        0.021,
        0.015,
      ),
      0.012,
    );
    return smoothUnion(
      d,
      limb(
        x,
        y,
        z,
        [cx - side * 0.02, 0.792, 0.045],
        [cx - side * 0.039, 0.754, 0.061],
        0.013,
        0.009,
      ),
      0.011,
    );
  };
}
function patch(width, height, z, curve = 0.003) {
  const g = new T.PlaneGeometry(width * 2, height * 2, 24, 12),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / width,
      v = p.getY(i) / height;
    p.setXYZ(
      i,
      p.getX(i),
      p.getY(i) * Math.sqrt(Math.max(0, 1 - u * u)),
      z + curve * (1 - u * u) * (1 - v * v),
    );
  }
  g.computeVertexNormals();
  return g;
}
// La stoffa resta davanti a entrambe le cosce, anche sotto il cavallo.
export function apronDepth(x, y) {
  const [rx, rz] = interpolate(torso, Math.max(0.8, y));
  return Math.max(
    0.126,
    rz * Math.sqrt(1 - Math.min(0.88, Math.abs(x) / rx) ** 2) + 0.008,
  );
}

export function sculptCharacter(root, bones, alien) {
  const material = (name, color, roughness = 0.85) => {
    const m = new T.MeshStandardMaterial({ color, roughness });
    m.name = name;
    return m;
  };
  const mats = [
    material("Outfit", alien ? "#d4d0c4" : "#50635d"),
    material("Fabric", alien ? "#b4b3ab" : "#34413f"),
    material("Skin", alien ? "#a9b0a5" : "#bc9c85", 0.48),
    material("EyeWhite", alien ? "#111b20" : "#bcbab0", alien ? 0.16 : 0.43),
    material("Iris", "#5b635b", 0.45),
    material("Pupil", "#202522", 0.35),
    material("Apron", "#b8aa90", 0.92),
    material("Metal", "#a18c65", 0.28),
  ];
  mats[7].metalness = 0.75;
  for (const material of mats) material.vertexColors = true;
  const pieces = [];
  function add(g, mat, weights) {
    const color = [],
      positions = g.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      let r = 1,
        green = 1,
        b = 1;
      if (mat === 2 && y > 1.45) {
        const ly = y - 1.49,
          lip =
            Math.exp((-x * x) / 0.00032 - (ly - 0.023) ** 2 / 0.000025) *
            Math.max(0, z / 0.07),
          socket =
            Math.exp(
              -((Math.abs(x) - 0.031) ** 2) / 0.0002 -
                (ly - 0.113) ** 2 / 0.00023,
            ) * Math.max(0, z / 0.07);
        r -= 0.12 * lip + 0.08 * socket;
        green -= 0.3 * lip + 0.1 * socket;
        b -= 0.25 * lip + 0.08 * socket;
      }
      if (mat === 0 && z > 0.04) {
        const zipper =
          Math.exp((-x * x) / 0.000008) * T.MathUtils.smoothstep(y, 0.87, 0.94);
        const seam = Math.exp(-((Math.abs(x) - 0.122) ** 2) / 0.000009);
        r = green = b = 1 - 0.13 * zipper - 0.06 * seam;
      }
      if (mat === 1 && y < 0.065) r = green = b = 0.7;
      color.push(r, green, b);
    }
    g.setAttribute("color", new T.Float32BufferAttribute(color, 3));
    g.clearGroups();
    g.addGroup(0, g.index.count, mat);
    const p = g.attributes.position,
      ids = [],
      ws = [];
    for (let i = 0; i < p.count; i++) {
      const w = weights(p.getX(i), p.getY(i), p.getZ(i));
      ids.push(...w.ids);
      ws.push(...w.weights);
    }
    g.setAttribute("skinIndex", new T.Uint16BufferAttribute(ids, 4));
    g.setAttribute("skinWeight", new T.Float32BufferAttribute(ws, 4));
    pieces.push(g);
  }
  const solidWeight = (bone) => () => ({
    ids: [bone, 0, 0, 0],
    weights: [1, 0, 0, 0],
  });
  const suit = continuousSuit();
  if (alien) inflateSuit(suit);
  // One welded surface across shoulder, axilla, waist, hips and knees.
  const p = suit.attributes.position;
  // Split only material indices, never the silhouette: the source remains one connected shell.
  const byMaterial = new Map();
  for (let i = 0; i < suit.index.count; i += 3) {
    let y = 0;
    for (let k = 0; k < 3; k++) y += p.getY(suit.index.getX(i + k)) / 3;
    const m = y < 0.16 ? 1 : y < 0.865 ? 1 : 0;
    if (!byMaterial.has(m)) byMaterial.set(m, []);
    byMaterial.get(m).push(...[0, 1, 2].map((k) => suit.index.getX(i + k)));
  }
  function suitWeights(x, y) {
    const spine = T.MathUtils.smoothstep(y, 0.86, 1.34) * 0.9;
    const arm =
      T.MathUtils.smoothstep(Math.abs(x), 0.17, 0.26) *
      T.MathUtils.smoothstep(y, 0.77, 0.92);
    const leg = 1 - T.MathUtils.smoothstep(y, 0.72, 0.88);
    const bone = x < 0 ? 3 : 4,
      legBone = x < 0 ? 5 : 6;
    return {
      ids: [0, 1, bone, legBone],
      weights: [
        (1 - spine) * (1 - arm) * (1 - leg),
        spine * (1 - arm) * (1 - leg),
        arm * (1 - leg),
        leg,
      ],
    };
  }
  for (const [m, indices] of byMaterial) {
    const g = suit.clone();
    g.setIndex(indices);
    add(g, m, suitWeights);
  }
  const head = continuousHead(alien)
    .scale(1.08, 0.94, 1.05)
    .translate(0, 1.485, 0);
  add(head, 2, (_x, y) => {
    const neck = 1 - T.MathUtils.smoothstep(y, 1.385, 1.48);
    return { ids: [2, 1, 0, 0], weights: [1 - neck, neck, 0, 0] };
  });
  for (const side of [-1, 1])
    add(
      isoSurface(
        handField(side),
        [side * 0.285 - 0.065, 0.695, -0.005],
        [side * 0.285 + 0.065, 0.847, 0.09],
        42,
      ),
      2,
      solidWeight(side < 0 ? 3 : 4),
    );
  function accessory(name, bone, g, mat, pos) {
    if (bone === 2) {
      g = g.clone().scale(1.08, 0.94, 1.05);
      pos = [pos[0] * 1.08, pos[1] * 0.94 - 0.005, pos[2] * 1.05];
    }
    const m = new T.Mesh(g, mat);
    m.name = name;
    m.position.set(...pos);
    bones[bone].add(m);
    return m;
  }
  for (const side of [-1, 1]) {
    const cx = side * 0.031;
    const eye = accessory(
      "Eye" + side,
      2,
      patch(
        alien ? 0.025 : 0.018,
        alien ? 0.012 : 0.0067,
        alien ? 0.065 : 0.059,
        0.007,
      ),
      mats[3],
      [cx, 0.112, 0],
    );
    if (alien) eye.rotation.z = side * 0.22;
    const iris = accessory(
      "Iris" + side,
      2,
      new T.CircleGeometry(0.0062, 32),
      mats[4],
      [cx, 0.112, 0.0645],
    );
    const pupil = accessory(
      "Pupil" + side,
      2,
      new T.CircleGeometry(0.0028, 24),
      mats[5],
      [cx, 0.112, 0.065],
    );
    if (alien) {
      iris.visible = false;
      pupil.visible = false;
    }
    const brow = patch(0.02, 0.0018, 0.071, 0.001);
    accessory(side < 0 ? "BrowL" : "BrowR", 2, brow, mats[1], [cx, 0.133, 0]);
  }
  const lens = new T.MeshPhysicalMaterial({
    color: "#819c96",
    transparent: true,
    opacity: 0.16,
    roughness: 0.25,
  });
  lens.name = "VisorGlass";
  accessory(
    "TechVisor",
    2,
    patch(0.067, 0.017, 0.088, 0.002),
    lens,
    [0, 0.112, 0],
  );
  // Thin tailored headwear, not oversized spherical helmets.
  const cap = continuousHead(alien);
  const capPos = cap.attributes.position;
  for (let i = 0; i < capPos.count; i++) {
    const x = capPos.getX(i),
      y = capPos.getY(i),
      z = capPos.getZ(i);
    capPos.setXYZ(i, x * 1.025, Math.max(0.166, y) * 1.012, z * 1.025);
  }
  cap.computeVertexNormals();
  if (alien) spaceEquipment(accessory, mats);
  else accessory("OpenHelmet", 2, cap.clone(), mats[1], [0, 0, 0]);
  const scarf = patch(0.065, 0.026, 0.075, 0.004);
  accessory("VIPScarf", 1, scarf, mats[7], [0, 0.265, 0]);
  const cape = new T.PlaneGeometry(0.32, 0.56, 24, 32),
    cp = cape.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      y = cp.getY(i);
    cp.setZ(i, -0.1 - Math.cos(x * 28) * 0.009 - (0.28 - y) * 0.12);
  }
  cape.computeVertexNormals();
  mats[7].side = T.DoubleSide;
  accessory("VIPCape", 1, cape, mats[7], [0, -0.01, 0]);
  if (!alien) {
    for (const name of ["TechVisor", "OpenHelmet", "VIPScarf", "VIPCape"])
      root.getObjectByName(name).visible = false;
    accessory("BaristaCap", 2, cap, mats[6], [0, 0.012, 0]);
    const apron = new T.PlaneGeometry(0.29, 0.54, 28, 36),
      ap = apron.attributes.position;
    for (let i = 0; i < ap.count; i++) {
      const x = ap.getX(i),
        y = ap.getY(i);
      const px = x * (1.05 - y * 0.5),
        py = y + 1.025;
      ap.setXYZ(
        i,
        px,
        py,
        apronDepth(px, py) + Math.cos(x * 46) * 0.002 * (0.3 - y),
      );
    }
    apron.computeVertexNormals();
    mats[6].side = T.DoubleSide;
    add(apron, 6, suitWeights);
  }
  if (alien) root.userData.referenceDesign = "grey-alien-eva-v1";
  root.userData.surfaceDesign = "continuous-anatomy-v2";
  return { pieces, mats };
}
