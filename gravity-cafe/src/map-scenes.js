import * as THREE from "three";
import {
  MAGNETIC_LEVEL,
  CRYO_LEVEL,
  REACTOR_LEVEL,
  MAGNET_PLATES,
  CRYO_VENTS,
  iceCrystals,
  getMapObstacles,
  getMapCounters,
  DECK_HEIGHT,
  MAP_SCALE,
  MELT_LEVEL,
  ZEN_LEVEL,
  getMapEnvironment,
  getMapStations,
} from "./map-mechanics.js";

// Le nuove mappe sono scenografie procedurali: nessun asset o texture remota.
export function createSpecialMaps(parent, { cup, person, surfaces }) {
  const melt = new THREE.Group(),
    zen = new THREE.Group();
  parent.add(melt, zen);
  melt.scale.set(MAP_SCALE, 1, MAP_SCALE);
  zen.scale.set(MAP_SCALE, 1, MAP_SCALE);
  const material = (color) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
  const steel = material("#53666c"),
    rim = material("#263c44"),
    cream = material("#d9d8bc");
  if (surfaces) {
    steel.roughnessMap = surfaces.brushed;
    steel.bumpMap = surfaces.grip;
    steel.bumpScale = 0.035;
  }
  const copper = material("#b78a54"),
    leaf = material("#639a73"),
    violet = material("#a391b9");
  const glow = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
    });
  const magma = glow("#f98432"),
    cyan = glow("#63c6c3"),
    gold = glow("#dbba64");
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#9acbc0",
    transparent: true,
    opacity: 0.22,
    roughness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  function mesh(geometry, mat, position, group) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(...position);
    m.castShadow = mat !== glass;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  const box = (w, h, d, mat, x, y, z, g) =>
    mesh(new THREE.BoxGeometry(w, h, d), mat, [x, y, z], g);
  const cylinder = (r, h, mat, x, y, z, g) =>
    mesh(new THREE.CylinderGeometry(r, r, h, 36), mat, [x, y, z], g);
  const ball = (r, mat, x, y, z, g) =>
    mesh(new THREE.SphereGeometry(r, 14, 10), mat, [x, y, z], g);
  function ring(inner, outer, y, mat, g, start = 0, length = Math.PI * 2) {
    const r = mesh(
      new THREE.RingGeometry(inner, outer, 64, 1, start, length),
      mat,
      [0, y, 0],
      g,
    );
    r.rotation.x = -Math.PI / 2;
    return r;
  }
  function tube(points, r, mat, g) {
    return mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        28,
        r,
        8,
        false,
      ),
      mat,
      [0, 0, 0],
      g,
    );
  }
  function label(text, x, y, z, g, color = "#c8d8c5") {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#19353de6";
    ctx.roundRect(0, 0, 512, 80, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, depthTest: true }),
    );
    sprite.scale.set(2.6, 0.4, 1);
    sprite.position.set(x, y, z);
    g.add(sprite);
    return sprite;
  }
  function coffeeStation(x, y, z, g) {
    cylinder(0.9, 1, steel, x, y + 0.5, z, g);
    box(1.9, 0.12, 1.2, cream, x, y + 1.05, z, g);
  }

  function milkStation(x, y, z, g) {
    cylinder(0.8, 1, steel, x, y + 0.5, z, g);
    box(1.8, 0.1, 1.2, cream, x, y + 1.05, z, g);
  }

  function serviceStation(g) {
    cylinder(1.2, 1, steel, 0, 0.5, 0, g);
    cylinder(1.4, 0.12, cream, 0, 1.05, 0, g);
    ring(1.45, 1.53, 0.06, gold, g);
    cup(0.4, 1.12, 0, g);
    label("CONSEGNA", 0, 2, 0, g);
  }
  // MELT-CORE: tre terrazze circolari aperte sul fronte, condotti incandescenti.
  const hotFloor = material("#6b7568");
  hotFloor.emissive = new THREE.Color("#ff561b");
  cylinder(7.2, 0.5, rim, 0, -0.35, 0, melt);
  cylinder(7.05, 0.08, hotFloor, 0, -0.05, 0, melt);
  ring(6.8, 7.2, 0.04, copper, melt);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const strip = box(0.06, 0.03, 12.8, steel, 0, 0.01, 0, melt);
    strip.rotation.y = a;
  }
  const floors = [];
  for (let deck = 1; deck <= 2; deck++) {
    const y = deck * DECK_HEIGHT;
    const safetyGlass = glass.clone();
    safetyGlass.opacity = 0.08;
    cylinder(7, 0.04, safetyGlass, 0, y - 0.025, 0, melt);
    const surface = ring(3.1, 7.1, y, steel, melt, 0, Math.PI * 1.16);
    floors.push(surface);
    ring(6.85, 7.12, y + 0.025, copper, melt, 0, Math.PI * 1.16);
    ring(3.1, 3.2, y + 0.035, cyan, melt, 0, Math.PI * 1.16);
    for (let i = 0; i < 13; i++) {
      const a = (i / 12) * Math.PI * 1.16;
      const x = Math.cos(a) * 7,
        z = -Math.sin(a) * 7;
      cylinder(0.035, 0.65, copper, x, y + 0.34, z, melt);
    }
    label(`PIANO 0${deck}`, 0, y + 0.7, -6.5, melt);
  }
  cylinder(0.65, 9.9, steel, 0, 4.7, -5.4, melt);
  cylinder(0.8, 0.18, copper, 0, 9.6, -5.4, melt);
  for (const x of [-7.6, 7.6]) {
    cylinder(0.35, 10, rim, x, 4.4, -3, melt);
    cylinder(0.2, 9.7, magma, x, 4.4, -2.61, melt);
    for (let i = 0; i < 5; i++)
      cylinder(0.42, 0.12, copper, x, i * 2, -3, melt);
    tube(
      [
        [x, -0.4, -3],
        [x, 0, 1],
        [x * 0.85, 1, 2],
      ],
      0.16,
      steel,
      melt,
    );
  }
  const lifts = [];
  for (const x of [-5.6, 5.6]) {
    for (const dz of [-0.7, 0.7])
      cylinder(0.055, 8.4, copper, x, 3.9, 0.7 + dz, melt);
    const lift = new THREE.Group();
    lift.position.set(x, 0, 0.7);
    melt.add(lift);
    cylinder(0.85, 0.12, copper, 0, 0.1, 0, lift);
    ring(0.65, 0.85, 0.18, cyan, lift);
    lifts.push(lift);
    label("E · ASCENSORE", x, 1.1, 1.15, melt);
  }
  coffeeStation(-3.8, DECK_HEIGHT, -2, melt);
  milkStation(3.8, DECK_HEIGHT * 2, -2, melt);
  const delivery = new THREE.Group();
  delivery.position.set(0, 0, 2.4);
  melt.add(delivery);
  serviceStation(delivery);
  const fans = [];
  for (const y of [0, DECK_HEIGHT, DECK_HEIGHT * 2]) {
    const fan = new THREE.Group();
    fan.position.set(-1.8, y + 0.15, 0);
    melt.add(fan);
    cylinder(0.6, 0.12, rim, 0, 0, 0, fan);
    for (let blade = 0; blade < 4; blade++) {
      const b = box(0.2, 0.04, 1.1, copper, 0, 0.1, 0, fan);
      b.rotation.y = (blade * Math.PI) / 4;
    }
    fans.push(fan);
  }
  label("JET / 0G", -1.8, 1, 0, melt);
  const steam = [];
  const mist = new THREE.MeshBasicMaterial({
    color: "#c9e0dc",
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  for (let i = 0; i < 6; i++) {
    const puff = ball(0.18, mist, (-1) ** i * 3, 1 + i * 0.35, 0.3, melt);
    steam.push(puff);
  }
  for (const x of [-6.8, 6.8])
    for (let i = 0; i < 3; i++) {
      const panel = box(1.1, 0.7, 0.15, rim, x, 1.7 + i * 2.7, -3.8, melt);
      panel.rotation.y = x > 0 ? -0.5 : 0.5;
      box(0.85, 0.42, 0.18, cyan, x, 1.7 + i * 2.7, -3.7, melt);
    }
  label("THE MELT-CORE STATION", 0, 10, -5.3, melt, "#f1c88c");

  // BOTANICAL: coupole panoramiche, passerelle trasparenti e isole orbitanti.
  cylinder(7.15, 0.35, rim, 0, -0.3, 0, zen);
  cylinder(6.95, 0.08, glass, 0, -0.06, 0, zen);
  ring(6.8, 7.15, 0.01, leaf, zen);
  cylinder(2.9, 0.22, cream, 0, 0.05, 0, zen);
  for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
    const bridge = box(13, 0.06, 0.8, glass, 0, 0.05, 0, zen);
    bridge.rotation.y = angle;
  }
  for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      pts.push([
        Math.cos(a) * 7.2 * Math.cos(angle),
        Math.sin(a) * 7.2,
        Math.cos(a) * 7.2 * Math.sin(angle),
      ]);
    }
    tube(pts, 0.045, leaf, zen);
  }
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const star = ball(
      0.025,
      cyan,
      Math.cos(a) * 7.6,
      2 + (i % 7) * 0.6,
      Math.sin(a) * 7.6,
      zen,
    );
    star.castShadow = false;
  }
  function plant(x, y, z, g, scale = 1) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.scale.setScalar(scale);
    g.add(p);
    cylinder(0.35, 0.5, copper, 0, 0.25, 0, p);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const l = ball(
        0.35,
        i % 3 ? leaf : violet,
        Math.sin(a) * 0.4,
        0.8 + (i % 3) * 0.25,
        Math.cos(a) * 0.3,
        p,
      );
      l.scale.set(0.5, 1.9, 0.7);
      l.rotation.z = Math.sin(a) * 0.6;
    }
    return p;
  }
  const islands = [];
  for (let i = 0; i < 4; i++) {
    const island = new THREE.Group();
    zen.add(island);
    cylinder(1.15, 0.22, leaf, 0, 0.08, 0, island);
    cylinder(0.65, 0.1, cream, 0, 1, 0, island);
    cylinder(0.08, 0.9, copper, 0, 0.5, 0, island);
    cup(0.2, 1.1, 0, island);
    plant(0.7, 0.2, 0.4, island, 0.6);
    islands.push(island);
  }
  const servingHalo = ring(1.05, 1.18, 0.24, gold, islands[0]);
  label("E · CONSEGNA", 0, 2.1, 0, islands[0]);
  coffeeStation(-1.8, 0, -1.5, zen);
  milkStation(1.8, 0, -1.5, zen);
  const vines = [];
  for (const x of [-4, 4]) {
    const vine = new THREE.Group();
    zen.add(vine);
    vine.position.set(x, 0, 0.2);
    tube(
      [
        [0, 5.8, 0],
        [0.3, 4.5, 0.2],
        [-0.3, 2.4, 0],
        [0, 0.8, 0],
      ],
      0.06,
      leaf,
      vine,
    );
    for (let i = 0; i < 6; i++) {
      const l = ball(
        0.24,
        i % 2 ? leaf : violet,
        Math.sin(i * 2) * 0.3,
        1.3 + i * 0.7,
        0.05,
        vine,
      );
      l.scale.set(1.7, 0.7, 0.8);
    }
    label("E · LIANA", 0, 2, 0, vine);
    vines.push(vine);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    plant(Math.cos(a) * 6.2, 0.1, Math.sin(a) * 6.2, zen, 0.8 + (i % 3) * 0.2);
  }
  label("ZERO-G BOTANICAL GARDEN", 0, 7.7, -2, zen);
  // 06–08: tutte le misure planari condividono MAP_SCALE con la simulazione.
  const additions = new Map(),
    rotors = [],
    discharges = [],
    jets = [],
    crystals = [];
  const ice = new THREE.MeshPhysicalMaterial({
    color: "#a8e8f4",
    roughness: 0.14,
    metalness: 0.12,
    transparent: true,
    opacity: 0.7,
  });
  const reactorGlow = glow("#f5a56b");
  let core, pulseRing;
  for (const level of [MAGNETIC_LEVEL, CRYO_LEVEL, REACTOR_LEVEL]) {
    const group = new THREE.Group();
    group.scale.set(MAP_SCALE, 1, MAP_SCALE);
    parent.add(group);
    additions.set(level, group);
    group.visible = false;
    cylinder(7.1, 0.32, rim, 0, -0.2, 0, group);
    cylinder(
      6.95,
      0.06,
      level === CRYO_LEVEL ? ice : steel,
      0,
      -0.025,
      0,
      group,
    );
    ring(6.6, 6.9, 0.02, level === REACTOR_LEVEL ? reactorGlow : cyan, group);
    for (let i = -6; i <= 6; i++) {
      box(0.018, 0.01, Math.sqrt(49 - i * i) * 2, cream, i, 0.015, 0, group);
      box(Math.sqrt(49 - i * i) * 2, 0.01, 0.018, cream, 0, 0.015, i, group);
    }
    const stations = getMapStations(level);
    for (const [name, station] of Object.entries(stations)) {
      const x = station.x / MAP_SCALE,
        z = station.z / MAP_SCALE,
        y = station.elevation ?? 0;
      box(
        name === "service" ? 1.8 : 1.5,
        1.05,
        name === "service" ? 1.8 : 1,
        rim,
        x,
        y + 0.525,
        z,
        group,
      );
      box(
        name === "service" ? 1.8 : 1.5,
        0.08,
        name === "service" ? 1.8 : 1,
        cream,
        x,
        y + 1.05,
        z,
        group,
      );
    }
    if (level === MAGNETIC_LEVEL) {
      label("06 · CROGIOLO MAGNETICO", 0, 5.8, -5.9, group);
      box(9, 0.035, 1, copper, 0, 0.03, 0, group);
      box(1, 0.035, 10, copper, 0, 0.03, 0, group);
      for (const c of getMapCounters(level, 0, 0).slice(3)) {
        box(
          c.w / MAP_SCALE,
          1.05,
          c.d / MAP_SCALE,
          rim,
          c.x / MAP_SCALE,
          0.525,
          c.z / MAP_SCALE,
          group,
        );
        box(
          c.w / MAP_SCALE,
          0.08,
          c.d / MAP_SCALE,
          cream,
          c.x / MAP_SCALE,
          1.05,
          c.z / MAP_SCALE,
          group,
        );
      }
      for (const plate of MAGNET_PLATES) {
        const r = ring(0.5, 0.65, 0.07, cyan, group);
        r.position.y = plate.y ?? 0.07;
        r.position.x = plate.x / MAP_SCALE;
        r.position.z = plate.z / MAP_SCALE;
        cylinder(
          0.48,
          0.06,
          steel,
          r.position.x,
          (plate.y ?? 0.07) - 0.035,
          r.position.z,
          group,
        );
      }
      for (const [name, x, z] of [
        ["NORD", 0, -6.4],
        ["SUD", 0, 6.4],
        ["EST", 6.4, 0],
        ["OVEST", -6.4, 0],
      ])
        label(name, x, 2.6, z, group, "#91e7ee");
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          x = Math.cos(a) * 6.3,
          z = Math.sin(a) * 6.3;
        const rotor = new THREE.Group();
        rotor.position.set(x, 0, z);
        group.add(rotor);
        rotors.push(rotor);
        cylinder(0.3, 3.5, rim, 0, 1.75, 0, rotor);
        for (let j = 0; j < 5; j++) {
          const coil = mesh(
            new THREE.TorusGeometry(0.55, 0.065, 8, 24),
            copper,
            [0, 0.7 + j * 0.48, 0],
            rotor,
          );
          coil.rotation.x = Math.PI / 2;
        }
        const tipMaterial = cyan.clone();
        rotor.userData.tip = tipMaterial;
        rotor.userData.axis = new THREE.Vector2(Math.cos(a), Math.sin(a));
        box(1.2, 0.3, 0.25, tipMaterial, 0, 3.4, 0, rotor);
        const arc = tube(
          [
            [0, 3.2, 0],
            [0.6, 3.7, 0.3],
            [0.3, 4.1, -0.2],
            [1.1, 4.3, 0],
          ],
          0.018,
          cyan,
          rotor,
        );
        discharges.push(arc);
      }
    }
    if (level === CRYO_LEVEL) {
      label("07 · SERRA CRIOGENICA", 0, 6, -5.6, group);
      const dome = mesh(
        new THREE.SphereGeometry(7, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
        glass,
        [0, 0, 0],
        group,
      );
      dome.scale.y = 0.85;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const points = Array.from({ length: 13 }, (_, j) => {
          const t = (j * Math.PI) / 24;
          return [
            Math.cos(a) * Math.cos(t) * 7,
            Math.sin(t) * 5.95,
            Math.sin(a) * Math.cos(t) * 7,
          ];
        });
        tube(points, 0.025, cyan, group);
      }
      for (const y of [2.2, 4.4])
        ring(
          Math.sqrt(49 - (y / 0.85) ** 2) - 0.018,
          Math.sqrt(49 - (y / 0.85) ** 2) + 0.018,
          y,
          cyan,
          group,
        );

      box(12, 0.035, 2.6, ice, 0, 0.04, 0, group);
      box(2.2, 0.035, 12, ice, 0, 0.04, 0, group);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a) * 6,
          z = Math.sin(a) * 6;
        cylinder(0.55, 2.4, steel, x, 1.2, z, group);
        ball(0.55, ice, x, 2.4, z, group);
        label("N₂ · −196°C", x, 1.6, z + 0.56, group, "#a5edff");
        for (let j = 0; j < 5; j++)
          box(0.9, 0.035, 0.7, ice, x, 0.4 + j * 0.38, z, group);
      }
      for (const vent of CRYO_VENTS) {
        const x = vent.x / MAP_SCALE,
          z = vent.z / MAP_SCALE;
        ring(0.25, 0.4, 0.08, cyan, group).position.set(x, 0.08, z);
        for (let j = 0; j < 6; j++) {
          const p = ball(0.14, glass, x, 0.2, z, group);
          jets.push({ p, x, z, index: jets.length });
        }
      }
      for (let i = 0; i < 7; i++)
        crystals.push(
          mesh(new THREE.OctahedronGeometry(0.34, 1), ice, [0, 1, 0], group),
        );
      for (const x of [-2, 2]) {
        box(0.12, 1.5, 2.5, glass, x, 0.75, 4.6, group);
        box(0.14, 0.08, 2.5, cyan, x, 1.5, 4.6, group);
      }
    }
    if (level === REACTOR_LEVEL) {
      label(
        "08 · REATTORE / RIPARO PRIMA DELL’IMPULSO",
        0,
        5.8,
        -5.9,
        group,
        "#ffcb96",
      );
      core = cylinder(0.7, 3.8, reactorGlow, 0, 1.9, 0, group);
      for (let i = 0; i < 5; i++) {
        const r = mesh(
          new THREE.TorusGeometry(1, 0.08, 8, 40),
          copper,
          [0, 0.5 + i * 0.7, 0],
          group,
        );
        r.rotation.x = Math.PI / 2;
      }
      pulseRing = ring(0.9, 1.1, 0.09, reactorGlow, group);
      for (const o of getMapObstacles(level).slice(1)) {
        box(
          o.w / MAP_SCALE,
          o.height,
          o.d / MAP_SCALE,
          rim,
          o.x / MAP_SCALE,
          o.height / 2,
          o.z / MAP_SCALE,
          group,
        );
        // Curved outer cladding; AABB is conservative and shared by raycasts.
        const shell = mesh(
          new THREE.CylinderGeometry(
            1.15,
            1.15,
            2.5,
            24,
            1,
            true,
            Math.PI * 0.2,
            Math.PI * 0.65,
          ),
          steel,
          [o.x / MAP_SCALE, 1.25, o.z / MAP_SCALE],
          group,
        );
        shell.scale.set((o.w / MAP_SCALE) * 0.4, 1, (o.d / MAP_SCALE) * 0.4);
        box(
          o.w / MAP_SCALE,
          0.08,
          o.d / MAP_SCALE,
          reactorGlow,
          o.x / MAP_SCALE,
          o.height,
          o.z / MAP_SCALE,
          group,
        );
      }
      box(4.8 / MAP_SCALE, 0.16, 2.4, steel, 0, 1.22, 4.5, group);
      const rampGeo = new THREE.BufferGeometry();
      const x = 2.4 / MAP_SCALE,
        z0 = 1.8 / MAP_SCALE,
        z1 = 4.2 / MAP_SCALE;
      rampGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [-x, 0, z0, x, 0, z0, x, 1.3, z1, -x, 0, z0, x, 1.3, z1, -x, 1.3, z1],
          3,
        ),
      );
      rampGeo.computeVertexNormals();
      const rampMat = steel.clone();
      rampMat.side = THREE.DoubleSide;
      mesh(rampGeo, rampMat, [0, 0, 0], group);
      label("RAMPA · CONSEGNA ↑", 0, 2.9, 4.5, group, "#ffe0a6");
    }
  }

  melt.visible = zen.visible = false;
  return {
    select(level) {
      additions.forEach((g, id) => (g.visible = id === level));
      melt.visible = level === MELT_LEVEL;
      zen.visible = level === ZEN_LEVEL;
    },
    update(state, decks) {
      const t = state.elapsed;
      if (state.level === MAGNETIC_LEVEL) {
        const env = getMapEnvironment(state.level, t);
        rotors.forEach((r, i) => {
          r.rotation.y = t * 0.5 + i;
          const active =
            r.userData.axis.x * env.force.x + r.userData.axis.y * env.force.z >
            1;
          r.userData.tip.color.set(active ? "#98f8ff" : "#596376");
          r.userData.tip.emissiveIntensity = active ? 1.5 : 0.15;
        });
        discharges.forEach(
          (arc, i) =>
            (arc.visible = !state.gravity && Math.sin(t * 17 + i) > -0.2),
        );
      }
      if (state.level === CRYO_LEVEL) {
        const positions = iceCrystals(t);
        crystals.forEach((c, i) => {
          c.visible = !state.gravity;
          c.position.set(
            positions[i].x / MAP_SCALE,
            positions[i].y,
            positions[i].z / MAP_SCALE,
          );
          c.rotation.set(t * 0.3 + i, t * 0.5, 0);
        });
        jets.forEach(({ p, x, z, index }) => {
          const vent = Math.floor(index / 6);
          p.visible = (t + vent * 3) % 8 < 1.4;
          p.position.set(
            x + Math.sin(index) * 0.1,
            0.2 + ((t * 2 + index * 0.2) % 2.8),
            z,
          );
          p.scale.setScalar(0.6 + p.position.y * 0.6);
        });
      }
      if (state.level === REACTOR_LEVEL) {
        const env = getMapEnvironment(state.level, t);
        core.scale.x = core.scale.z =
          1 + Math.sin(t * (env.warning ? 12 : 3)) * 0.08;
        reactorGlow.emissiveIntensity = env.warning
          ? 2 + Math.sin(t * 12)
          : 0.8;
        const phase = t % 16;
        pulseRing.visible = t >= 16 && phase < 1.5;
        pulseRing.scale.setScalar(1 + phase * 5);
      }

      if (state.level === MELT_LEVEL) {
        const hot = getMapEnvironment(state.level, t).hot;
        hotFloor.color.set(hot ? "#c2723d" : "#6b7568");
        hotFloor.emissiveIntensity = hot ? 0.6 : 0;
        fans.forEach((f) => (f.rotation.y = t * (hot ? 9 : 1)));
        lifts.forEach((l, i) => (l.position.y = decks[i] * DECK_HEIGHT));
        delivery.position.y =
          getMapStations(state.level, t).service.deck * DECK_HEIGHT;
        steam.forEach((p, i) => {
          p.visible = hot;
          p.position.y = ((t * 1.2 + i * 0.6) % 5) + 0.5;
          p.scale.setScalar(0.6 + p.position.y / 5);
        });
      }
      if (state.level === ZEN_LEVEL) {
        islands.forEach((g, i) => {
          const a = t * 0.08 + (i * Math.PI) / 2;
          g.position.set(
            Math.cos(a) * 4.7,
            0.25 + Math.sin(t * 0.7 + i) * 0.1,
            Math.sin(a) * 4.7,
          );
          g.rotation.y = -a;
        });
        vines.forEach((v, i) => (v.rotation.z = Math.sin(t * 0.6 + i) * 0.06));
        servingHalo.rotation.z = t * 0.3;
      }
    },
  };
}
