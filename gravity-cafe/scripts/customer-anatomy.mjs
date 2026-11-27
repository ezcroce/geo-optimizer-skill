import * as T from "three";

// Rapporti del cliente in metri, indipendenti dal modello e dalla camera del barista.
export const CUSTOMER_LANDMARKS = [
  [0.03, 0.03],
  [0.14, 0.14],
  [0.49, 0.49],
  [0.845, 0.87],
  [1.03, 1.05],
  [1.18, 1.2],
  [1.33, 1.35],
  [1.425, 1.445],
  [1.4615, 1.475],
  [1.49, 1.501],
  [1.59, 1.603],
  [1.711, 1.738],
  [1.85, 1.877],
];
export function customerHeight(y) {
  const rows = CUSTOMER_LANDMARKS;
  let i = 0;
  while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
  const a = rows[i],
    b = rows[i + 1],
    p = rows[Math.max(0, i - 1)],
    n = rows[Math.min(rows.length - 1, i + 2)],
    d = b[0] - a[0],
    t = (y - a[0]) / d;
  const m0 = (b[1] - p[1]) / (b[0] - p[0]),
    m1 = (n[1] - a[1]) / (n[0] - a[0]);
  return (
    (2 * t * t * t - 3 * t * t + 1) * a[1] +
    (t * t * t - 2 * t * t + t) * d * m0 +
    (-2 * t * t * t + 3 * t * t) * b[1] +
    (t * t * t - t * t) * d * m1
  );
}
export function customerPoint(x, y, z) {
  const head = T.MathUtils.smoothstep(y, 1.405, 1.48);
  let px = x,
    pz = z;
  const pelvis = 1 + 0.075 * Math.exp(-((y - 0.92) ** 2) / 0.015),
    chest = 1 - 0.035 * Math.exp(-((y - 1.25) ** 2) / 0.015);
  px = x * pelvis * chest;
  const arm =
    T.MathUtils.smoothstep(Math.abs(x), 0.18, 0.25) *
    (1 - T.MathUtils.smoothstep(y, 1.3, 1.43));
  const center = T.MathUtils.lerp(
    0.285,
    0.198,
    T.MathUtils.clamp((y - 0.835) / 0.495, 0, 1),
  );
  const forearm =
    Math.sign(x) * (center - 0.008 + (Math.abs(x) - center) * 1.1);
  px = T.MathUtils.lerp(px, forearm, arm);
  const leg =
    (1 - T.MathUtils.smoothstep(y, 0.76, 0.9)) *
    (1 - T.MathUtils.smoothstep(Math.abs(x), 0.19, 0.23));
  const legCenter = Math.sign(x) * 0.107,
    legX =
      x +
      (x - legCenter) * 0.1 * T.MathUtils.smoothstep(Math.abs(x), 0.025, 0.08);
  px = T.MathUtils.lerp(px, legX, leg);
  pz = z * (1 + 0.08 * leg);
  px = T.MathUtils.lerp(px, x * 1.12, head);
  pz = T.MathUtils.lerp(pz, z * 1.08, head);
  return new T.Vector3(px, customerHeight(y), pz);
}
export function customerSkinPoint(x, y, z) {
  if (y > 1) return customerPoint(x, y, z);
  // Il polsino termina a 0,80m: il palmo non deve restare quasi interamente dentro la manica.
  return new T.Vector3(
    Math.sign(x) * (0.277 + (Math.abs(x) - 0.285) * 1.25),
    customerHeight(0.8) + (customerHeight(y) - customerHeight(0.835)) * 1.2,
    0.035 + (z - 0.035) * 1.15,
  );
}
export function customerSuitWeights(x, y) {
  const arm =
    T.MathUtils.smoothstep(Math.abs(x), 0.18, 0.245) *
    (1 - T.MathUtils.smoothstep(y, 1.35, 1.44));
  const leg =
    (1 - T.MathUtils.smoothstep(y, 0.75, 0.89)) *
    (1 - T.MathUtils.smoothstep(Math.abs(x), 0.18, 0.23));
  const spine = T.MathUtils.smoothstep(y, 0.88, 1.35) * 0.9;
  return {
    ids: [0, 1, x < 0 ? 3 : 4, x < 0 ? 5 : 6],
    weights: [
      (1 - arm) * (1 - leg) * (1 - spine),
      (1 - arm) * (1 - leg) * spine,
      arm,
      (1 - arm) * leg,
    ],
  };
}
function morphGeometry(
  geometry,
  origin = new T.Vector3(),
  map = customerPoint,
) {
  const p = geometry.attributes.position,
    n = geometry.attributes.normal,
    matrix = new T.Matrix3(),
    h = 0.0001,
    normal = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      v = map(x, y, z);
    if (n) {
      const dx = map(x + h, y, z)
          .sub(v)
          .multiplyScalar(1 / h),
        dy = map(x, y + h, z)
          .sub(v)
          .multiplyScalar(1 / h),
        dz = map(x, y, z + h)
          .sub(v)
          .multiplyScalar(1 / h);
      matrix
        .set(dx.x, dy.x, dz.x, dx.y, dy.y, dz.y, dx.z, dy.z, dz.z)
        .invert()
        .transpose();
      normal.fromBufferAttribute(n, i).applyMatrix3(matrix).normalize();
      n.setXYZ(i, normal.x, normal.y, normal.z);
    }
    v.sub(origin);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
export function rebalanceCustomer(root, bones, pieces, materials) {
  root.updateMatrixWorld(true);
  const pivots = bones.map((b) =>
    customerPoint(...b.getWorldPosition(new T.Vector3()).toArray()),
  );
  // Anche i pivot e gli accessori seguono la correzione: niente testa staccata o mani fuori dai polsini.
  const accessories = [];
  root.traverse((node) => {
    if (node.isMesh) {
      node.updateMatrixWorld(true);
      const origin = customerPoint(
        ...node.getWorldPosition(new T.Vector3()).toArray(),
      );
      const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
      morphGeometry(geometry, origin);
      accessories.push({ node, origin, geometry });
    }
  });
  for (const piece of pieces) {
    const material = materials[piece.groups[0].materialIndex].name;
    if (material === "Outfit" || material === "Fabric") {
      const pos = piece.attributes.position,
        ids = piece.attributes.skinIndex,
        weights = piece.attributes.skinWeight;
      for (let i = 0; i < pos.count; i++) {
        const w = customerSuitWeights(pos.getX(i), pos.getY(i));
        ids.setXYZW(i, ...w.ids);
        weights.setXYZW(i, ...w.weights);
      }
    }
    morphGeometry(
      piece,
      new T.Vector3(),
      material === "Skin" ? customerSkinPoint : customerPoint,
    );
  }
  bones.forEach((bone, i) => {
    const parent = bones.indexOf(bone.parent);
    bone.position.copy(pivots[i]);
    if (parent >= 0) bone.position.sub(pivots[parent]);
  });
  root.updateMatrixWorld(true);
  for (const { node, origin, geometry } of accessories) {
    node.geometry = geometry;
    node.position.copy(node.parent.worldToLocal(origin.clone()));
    node.quaternion.identity();
    node.scale.setScalar(1);
  }
  root.updateMatrixWorld(true);
  root.userData.anatomy = "balanced-customer-v3";
}
