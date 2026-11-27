import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
// Original procedural equipment inspired by the supplied EVA reference; no image/logo is bundled.
export function spaceEquipment(accessory, mats) {
  const box = (x, y, z) => new RoundedBoxGeometry(x, y, z, 3, 0.012);
  const metal = mats[7],
    cloth = mats[0],
    rubber = mats[5];
  const shell = new T.SphereGeometry(
    0.145,
    48,
    32,
    0,
    Math.PI * 2,
    0.83,
    Math.PI - 0.83,
  )
    .rotateX(Math.PI / 2)
    .scale(1, 1.14, 1);
  const helmet = accessory("OpenHelmet", 2, shell, cloth, [0, 0.1, 0]);
  const add = (name, g, mat, pos) => {
    const m = new T.Mesh(g, mat);
    m.name = name;
    m.position.set(...pos);
    helmet.add(m);
    return m;
  };
  const visor = new T.MeshPhysicalMaterial({
    color: "#101923",
    metalness: 0.75,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
  });
  visor.name = "EVAVisor";
  add(
    "PressureVisor",
    new T.SphereGeometry(0.144, 48, 28, 0, Math.PI * 2, 0, 0.84)
      .rotateX(Math.PI / 2)
      .scale(1, 1.14, 1),
    visor,
    [0, 0, 0],
  );
  const rim = new T.TorusGeometry(Math.sin(0.83) * 0.145, 0.009, 12, 64).scale(
    1,
    1.14,
    1,
  );
  add("VisorSeal", rim, rubber, [0, 0, Math.cos(0.83) * 0.145]);
  accessory(
    "PressureCollar",
    1,
    new T.TorusGeometry(0.067, 0.013, 12, 64).rotateX(Math.PI / 2),
    metal,
    [0, 0.272, 0],
  );
  accessory("LifeSupport", 1, box(0.23, 0.34, 0.12), cloth, [0, 0.035, -0.16]);
  accessory(
    "ChestConsole",
    1,
    box(0.105, 0.12, 0.035),
    cloth,
    [0, 0.065, 0.125],
  );
  accessory(
    "ConsoleInset",
    1,
    box(0.028, 0.076, 0.012),
    rubber,
    [0.019, 0.07, 0.15],
  );
  for (const side of [-1, 1]) {
    accessory(
      "ShoulderPatch" + side,
      side < 0 ? 3 : 4,
      box(0.065, 0.075, 0.012),
      cloth,
      [side * 0.012, -0.035, 0.062],
    );
    accessory(
      "ThighPocket" + side,
      side < 0 ? 5 : 6,
      box(0.092, 0.14, 0.028),
      cloth,
      [side * 0.014, -0.17, 0.075],
    );
    for (let row = 0; row < 2; row++) {
      const port = new T.CylinderGeometry(0.018, 0.018, 0.023, 24).rotateX(
        Math.PI / 2,
      );
      accessory("SuitPort" + side + row, 1, port, row === 0 ? metal : rubber, [
        side * 0.06,
        -0.03 - row * 0.055,
        0.131,
      ]);
    }
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(side * 0.06, -0.087, 0.14),
      new T.Vector3(side * 0.125, -0.08, 0.17),
      new T.Vector3(side * 0.15, 0.03, 0.11),
    ]);
    accessory(
      "OxygenHose" + side,
      1,
      new T.TubeGeometry(curve, 32, 0.009, 10, false),
      cloth,
      [0, 0, 0],
    );
  }
}
export function inflateSuit(geometry) {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const arm =
      T.MathUtils.smoothstep(Math.abs(x), 0.19, 0.245) *
      (1 - T.MathUtils.smoothstep(y, 1.31, 1.43));
    const center =
      Math.sign(x) *
      T.MathUtils.lerp(
        0.285,
        0.198,
        T.MathUtils.clamp((y - 0.835) / 0.495, 0, 1),
      );
    const leg =
      (1 - T.MathUtils.smoothstep(y, 0.76, 0.9)) *
      (1 - T.MathUtils.smoothstep(Math.abs(x), 0.19, 0.24));
    const legCenter = Math.sign(x) * 0.107;
    const expanded = T.MathUtils.lerp(
      x * 1.06,
      center + (x - center) * 1.31,
      arm,
    );
    const px = T.MathUtils.lerp(expanded, x + (x - legCenter) * 0.24, leg);
    const joint =
      Math.exp(-((y - 0.49) ** 2) / 0.004) +
      Math.exp(-((y - 1.07) ** 2) / 0.003);
    const fold =
      0.0022 * Math.sin(y * 185 + Math.abs(x) * 13) * Math.min(1, joint);
    p.setXYZ(i, px + Math.sign(x) * fold, y, z * 1.28 + Math.sign(z) * fold);
  }
  geometry.computeVertexNormals();
  return geometry;
}
