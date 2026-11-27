import * as THREE from "three";
import { createSurfaces, createLocalEnvironment } from "./surfaces.js";
import { createStations } from "./stations.js";
import { createCustomers } from "./customers.js";
import { createModelLibrary } from "./models.js";
import {
  EYE_HEIGHT,
  turnView,
  movementVector,
  advanceFlight,
  resolveVerticalBounds,
  rayTarget,
  aimAt,
  resolveBodyContact,
} from "./first-person.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  COUNTERS,
  MAIN_STATIONS,
  ROOM_SCALE_X,
  ROOM_SCALE_Z,
  PLAYER_BOUNDS,
  resolveCounterCollision,
  resolveRoomBounds,
  resolvePlayerCollision,
} from "./physics.js";
import { createSpecialMaps } from "./map-scenes.js";
import { bindTouchButton } from "./touch-controls.js";
import {
  MAGNETIC_LEVEL,
  CRYO_LEVEL,
  REACTOR_LEVEL,
  applyMapDynamics,
  onIce,
  reactorFloor,
  getMapObstacles,
  deflectCrystal,
  MELT_LEVEL,
  MAP_SCALE,
  MAP_RADIUS,
  LIFT_X,
  LIFT_Z,
  VINE_X,
  VINE_Z,
  ZEN_LEVEL,
  DECK_HEIGHT,
  getMapEnvironment,
  getMapStations,
  getMapCounters,
  nearLift,
  zenForce,
  resolveCircularBounds,
} from "./map-mechanics.js";
// Un batch per materiale, senza inglobare i nodi che devono animarsi.
function batchMeshes(parent, objects) {
  const groups = new Map(),
    retained = [];
  for (const object of objects) {
    if (
      !object.isMesh ||
      object.isInstancedMesh ||
      object.material.transparent
    ) {
      retained.push(object);
      continue;
    }
    if (!groups.has(object.material.uuid)) groups.set(object.material.uuid, []);
    groups.get(object.material.uuid).push(object);
  }
  for (const parts of groups.values()) {
    const geometries = parts.map((object) => {
      object.updateMatrix();
      return object.geometry.clone().applyMatrix4(object.matrix);
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) {
      retained.push(...parts);
      continue;
    }
    const batch = new THREE.Mesh(geometry, parts[0].material);
    batch.castShadow = parts.some((part) => part.castShadow);
    batch.receiveShadow = parts.some((part) => part.receiveShadow);
    for (const part of parts) {
      parent.remove(part);
      part.geometry.dispose();
    }
    parent.add(batch);
    retained.push(batch);
  }
  return retained;
}

export function createWorld(
  canvas,
  {
    getState,
    getOrders = () => [],
    interact,
    throwDrink = () => {},
    onSpill = () => {},
    notify = () => {},
    onPause = () => {},
  },
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#102d37");
  scene.fog = new THREE.Fog("#102d37", 40, 90);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const menuCamera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
  menuCamera.position.set(17, 19, 23);
  menuCamera.lookAt(0, 0.9, 0);
  const cameras = [0, 1].map(
    () => new THREE.PerspectiveCamera(76, 1, 0.06, 120),
  );
  cameras.forEach((camera) => scene.add(camera));
  let assetWarning = false;
  const models = createModelLibrary({
    onError: (name) => {
      if (!assetWarning) {
        assetWarning = true;
        notify("Modello 3D non disponibile: uso la versione di riserva.");
      }
      console.warn(`GLB ${name}: caricamento non riuscito`);
    },
  });
  scene.add(new THREE.HemisphereLight(0xe8fff6, 0x7d8b88, 2.5));
  const sun = new THREE.DirectionalLight(0xffefd8, 4);
  sun.position.set(-8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -15,
    right: 15,
    top: 15,
    bottom: -15,
  });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const starPositions = [];
  let starSeed = 7654;
  for (let i = 0; i < 450; i++) {
    starSeed = (starSeed * 16807) % 2147483647;
    const x = (starSeed % 1000) / 10 - 50;
    starSeed = (starSeed * 16807) % 2147483647;
    starPositions.push(x, (starSeed % 700) / 10 - 15, -25 - (i % 25));
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#b3cfd2",
        size: 0.08,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
      }),
    ),
  );

  const surfaces = createSurfaces();
  scene.environment = createLocalEnvironment();
  scene.environmentIntensity = 0.5;
  const materialCache = new Map();
  const mat = (color, roughness = 0.75, metalness = 0) => {
    const key = `${color}:${roughness}:${metalness}`;
    if (!materialCache.has(key))
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness, metalness }),
      );
    return materialCache.get(key);
  };
  const M = {
    floor: mat("#a9c7b9"),
    edge: mat("#638e7f"),
    wall: mat("#b8d5c5"),
    cream: mat("#f5ebd7"),
    white: mat("#fff8e7"),
    dark: mat("#28594c"),
    green: mat("#5a8b73"),
    orange: mat("#e68b4a"),
    metal: mat("#b5c7bb", 0.3, 0.4),
    coffee: mat("#59392a"),
    blue: mat("#658e95"),
    black: mat("#213d38"),
  };
  M.green.map = surfaces.wood;
  M.green.bumpMap = surfaces.wood;
  M.green.bumpScale = 0.025;
  M.cream.map = surfaces.marble;
  M.cream.roughnessMap = surfaces.marble;
  M.cream.bumpMap = surfaces.marble;
  M.cream.bumpScale = 0.012;
  M.metal.roughnessMap = surfaces.brushed;
  M.metal.bumpMap = surfaces.brushed;
  M.metal.bumpScale = 0.012;
  function box(w, h, d, m, x = 0, y = 0, z = 0, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    rt,
    rb,
    h,
    m,
    x = 0,
    y = 0,
    z = 0,
    parent = scene,
    segments = 24,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, segments),
      m,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sphere(r, m, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const room = new THREE.Group();
  scene.add(room);
  box(16, 0.55, 11.6, M.edge, 0, -0.35, 0, room);
  box(15.8, 0.12, 11.4, M.floor, 0, -0.01, 0, room);
  const tileGeo = new THREE.BoxGeometry(0.975, 0.025, 0.975);
  const tileMatrix = new THREE.Matrix4();
  for (let parity = 0; parity < 2; parity++) {
    const positions = [];
    for (let x = -7; x <= 7; x++)
      for (let z = -5; z <= 5; z++)
        if (Math.abs((x + z) % 2) === parity) positions.push([x, z]);
    const tiles = new THREE.InstancedMesh(
      tileGeo,
      mat(parity ? "#a7c2b1" : "#b9cfc0"),
      positions.length,
    );
    positions.forEach(([x, z], i) => {
      tileMatrix.makeTranslation(x, 0.065, z);
      tiles.setMatrixAt(i, tileMatrix);
    });
    tiles.receiveShadow = true;
    room.add(tiles);
  }
  // Cutaway walls and deep space windows.
  box(16, 4.1, 0.22, M.wall, 0, 2, -5.65, room);
  box(0.22, 3.5, 11.5, M.wall, -7.9, 1.7, 0, room);
  box(16, 0.16, 0.35, M.dark, 0, 4.05, -5.6, room);
  box(0.35, 0.18, 11.4, M.dark, -7.88, 3.45, 0, room);
  const spaceMat = mat("#173f40");
  for (let i = 0; i < 3; i++) {
    const wx = -4.8 + i * 4.8;
    box(4.2, 2.45, 0.18, M.cream, wx, 2.55, -5.46, room);
    box(3.92, 2.16, 0.2, spaceMat, wx, 2.55, -5.34, room);
    box(0.07, 2.12, 0.08, M.green, wx, 2.55, -5.19, room);
    box(3.9, 0.07, 0.08, M.green, wx, 2.55, -5.18, room);
    for (let j = 0; j < 17; j++) {
      const hash = Math.sin((j + 1) * (i + 3) * 43.2) * 43758;
      const r = hash - Math.floor(hash);
      sphere(
        0.012 + (j % 3) * 0.006,
        mat("#c4ddd0"),
        wx - 1.8 + ((j * 1.618) % 3.5),
        1.6 + r * 1.8,
        -5.19,
        room,
      );
    }
  }
  const planet = sphere(0.63, mat("#b6be8e"), 4.9, 2.6, -5.15, room);
  planet.scale.z = 0.13;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.045, 8, 64),
    M.cream,
  );
  ring.position.set(4.9, 2.6, -5.1);
  ring.scale.y = 0.35;
  ring.rotation.z = -0.35;
  room.add(ring);
  // Side window and wall details.
  box(0.15, 1.5, 3.4, M.cream, -7.73, 2.2, -2.3, room);
  box(0.17, 1.28, 3.1, spaceMat, -7.62, 2.2, -2.3, room);
  for (let i = 0; i < 4; i++)
    box(0.05, 0.04, 2.5, M.green, -7.51, 1.8 + i * 0.23, -2.3, room);
  box(0.15, 0.8, 1.2, M.dark, -7.65, 1.8, 3.1, room);
  box(0.17, 0.6, 0.9, M.cream, -7.54, 1.8, 3.1, room);
  // Back counter.
  function counter(x, z, w, d) {
    box(w, 1.12, d, M.green, x, 0.66, z, room);
    box(w + 0.12, 0.18, d + 0.15, M.cream, x, 1.3, z, room);
    box(w, 0.1, 0.05, M.dark, x, 0.2, z + d / 2 + 0.02, room);
    for (let i = 0; i < Math.floor(w / 1.1); i++) {
      box(
        0.83,
        0.7,
        0.025,
        M.floor,
        x - w / 2 + 0.6 + i * 1.1,
        0.7,
        z + d / 2 + 0.015,
        room,
      );
      box(
        0.28,
        0.045,
        0.07,
        M.dark,
        x - w / 2 + 0.6 + i * 1.1,
        0.9,
        z + d / 2 + 0.05,
        room,
      );
    }
  }
  counter(0, -4.1, 13.4, 1.5);
  counter(-6.1, -0.8, 1.5, 5.2);
  function cup(x, y, z, parent = room, color = M.white) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    cylinder(0.16, 0.12, 0.28, color, 0, 0.15, 0, g);
    g.userData.fill = cylinder(0.135, 0.135, 0.012, M.coffee, 0, 0.295, 0, g);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.035, 8, 14),
      color,
    );
    handle.position.set(0.17, 0.17, 0);
    g.add(handle);
    cylinder(0.23, 0.23, 0.035, color, 0, 0.015, 0, g);
    parent.add(g);
    models.cup(g);
    return g;
  }
  const rackCups = [];
  for (let i = 0; i < 4; i++) {
    const c = cup(-5.25 + i * 0.54, 2.83, -4.05, room);
    c.userData.fill.visible = false;
    rackCups.push(c);
  }
  // Shelving and milk station.
  box(2.9, 0.13, 0.65, M.dark, -0.4, 2.6, -4.8, room);
  for (let i = 0; i < 5; i++) {
    cylinder(
      0.17,
      0.17,
      0.46,
      mat(["#d2b68a", "#fff1d1", "#e2a77e", "#c9bfa0", "#8ca696"][i]),
      -1.45 + i * 0.52,
      2.9,
      -4.8,
      room,
    );
    cylinder(0.18, 0.18, 0.06, M.dark, -1.45 + i * 0.52, 3.15, -4.8, room);
  }
  // L'isola resta bassa: i clienti sono sul bordo vicino, non dietro ai mobili.
  counter(0, 2.8, 9.2, 1.45);
  box(9.4, 0.13, 1.62, M.cream, 0, 1.44, 2.8, room);
  // Planters make a lived-in space station.
  function plant(x, z) {
    cylinder(0.34, 0.25, 0.55, M.cream, x, 0.34, z, room);
    for (let i = 0; i < 7; i++) {
      const leaf = sphere(
        0.3,
        M.green,
        x + Math.sin(i * 2.4) * 0.26,
        0.8 + (i % 3) * 0.15,
        z + Math.cos(i * 2.4) * 0.2,
        room,
      );
      leaf.scale.set(0.45, 1.6, 0.5);
      leaf.rotation.z = Math.sin(i) * 0.6;
    }
  }
  plant(-6.7, 4.55);
  plant(6.8, -4.1);
  // Brass lamps above the island.
  for (const x of [-3.7, 1.5]) {
    cylinder(0.025, 0.025, 2.6, M.dark, x, 4.4, -1.9, room);
    cylinder(0.18, 0.52, 0.36, M.cream, x, 3, -1.9, room);
    cylinder(0.4, 0.4, 0.04, mat("#ffe4a6"), x, 2.8, -1.9, room);
  }
  function person(color, alien = false) {
    const g = new THREE.Group();
    const body = cylinder(0.28, 0.36, 0.62, mat(color), 0, 0.85, 0, g);
    const head = sphere(0.32, alien ? mat("#b1c991") : M.cream, 0, 1.43, 0, g);
    if (!alien) {
      box(0.5, 0.25, 0.12, M.dark, 0, 1.43, 0.26, g);
      box(0.46, 0.17, 0.13, mat("#80b9ad", 0.15, 0.4), 0, 1.45, 0.29, g);
      cylinder(0.34, 0.34, 0.1, M.white, 0, 1.72, 0, g);
      sphere(0.2, M.white, -0.16, 1.85, 0, g);
      sphere(0.22, M.white, 0.12, 1.88, 0, g);
      box(0.22, 0.48, 0.18, M.metal, 0, 0.95, -0.37, g);
      box(0.44, 0.45, 0.035, M.cream, 0, 0.84, 0.32, g);
    } else {
      for (let i of [-1, 1]) {
        sphere(0.105, M.black, i * 0.13, 1.48, 0.26, g);
        sphere(0.027, M.white, i * 0.13 - 0.025, 1.52, 0.34, g);
      }
    }
    const legs = [];
    for (const i of [-1, 1]) {
      const leg = cylinder(0.1, 0.12, 0.4, M.dark, i * 0.17, 0.35, 0, g);
      legs.push(leg);
      box(0.23, 0.15, 0.36, M.dark, i * 0.17, 0.15, 0.08, g);
      const arm = cylinder(0.1, 0.12, 0.46, mat(color), i * 0.4, 0.85, 0.05, g);
      arm.rotation.z = i * 0.3;
      sphere(0.11, M.cream, i * 0.46, 0.64, 0.06, g);
    }
    const jets = [];
    if (!alien)
      for (const side of [-1, 1]) {
        const jet = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.5, 10),
          new THREE.MeshBasicMaterial({ color: "#8bf5dc" }),
        );
        jet.position.set(side * 0.16, 0.55, -0.36);
        jet.rotation.x = Math.PI;
        jet.visible = false;
        g.add(jet);
        jets.push(jet);
      }
    batchMeshes(
      g,
      g.children.filter((part) => !legs.includes(part) && !jets.includes(part)),
    );
    g.userData = { legs, jets };
    g.userData.actor = models.character(
      g,
      alien ? "customer" : "barista",
      [...g.children],
      color,
    );
    return g;
  }
  const players = [person("#e59a55"), person("#7999b8")];
  players[0].position.set(-0.5, 0.13, 0.15);
  players[1].position.set(1.4, 0.13, 0.1);
  room.add(players[0]);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.55, 40),
    new THREE.MeshBasicMaterial({
      color: "#f1bd69",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.13;
  room.add(marker);
  const snapZones = [
    [-4.5, -2.65],
    [4.5, -2.65],
    [0, 1.55],
  ].map(([x, z]) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.62, 48),
      new THREE.MeshBasicMaterial({
        color: "#f2d48a",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.14, z);
    room.add(ring);
    return ring;
  });
  const hole = new THREE.Group();
  hole.position.set(0.2, 1.6, -1.3);
  sphere(0.35, M.black, 0, 0, 0, hole);
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(0.55 + i * 0.15, 0.025, 8, 60),
      mat("#ccabda"),
    );
    r.rotation.x = Math.PI / 2 + i * 0.4;
    hole.add(r);
  }
  room.add(hole);
  hole.visible = false;
  const floats = [];
  let seed = 742;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  for (let i = 0; i < 8; i++) {
    const g =
      i % 3 === 0
        ? cup(0, 0, 0, room)
        : new THREE.Mesh(
            new THREE.SphereGeometry(0.08 + random() * 0.09, 16, 12),
            i % 2 ? M.coffee : mat("#d9b789"),
          );
    if (i % 3 !== 0) room.add(g);
    g.position.set(
      -5 + random() * 10,
      1.3 + random() * 2.6,
      -2.5 + random() * 4,
    );
    g.userData.base = g.position.clone();
    g.userData.velocity = new THREE.Vector3(
      (random() - 0.5) * 0.6,
      0,
      (random() - 0.5) * 0.6,
    );
    floats.push(g);
  }
  const floorGrip = mat("#627a71", 0.82, 0.2);
  floorGrip.map = surfaces.grip;
  floorGrip.bumpMap = surfaces.grip;
  floorGrip.bumpScale = 0.025;
  for (const x of [-4.4, 4.65])
    box(2.6, 0.025, 1.05, floorGrip, x, 0.1, -2.7, room);
  const legacyObjects = room.children.filter(
    (obj) =>
      !players.includes(obj) &&
      obj !== marker &&
      !snapZones.includes(obj) &&
      !floats.includes(obj) &&
      !rackCups.includes(obj) &&
      obj !== hole,
  );
  // Si allarga la sola pianta, non l'altezza o i personaggi.
  for (const object of legacyObjects) {
    object.position.x *= ROOM_SCALE_X;
    object.position.z *= ROOM_SCALE_Z;
    object.scale.x *= ROOM_SCALE_X;
    object.scale.z *= ROOM_SCALE_Z;
  }
  // Scenografia immobile e personaggi usano batch distinti.
  legacyObjects.splice(
    0,
    legacyObjects.length,
    ...batchMeshes(room, legacyObjects),
  );
  const specialMaps = createSpecialMaps(room, { cup, person, surfaces });
  const stationVisuals = createStations(room, { cup, surfaces });
  for (const group of Object.values(stationVisuals.groups))
    batchMeshes(
      group,
      group.children.filter(
        (child) => child.isMesh && !child.material.transparent,
      ),
    );
  const customerSystem = createCustomers(room, {
    person,
    onAgitate: (position) => {
      for (const object of floats) {
        if (object.position.distanceTo(position) > 5 || object.userData.effect)
          continue;
        const delta = object.position.clone().sub(position).normalize();
        object.userData.velocity.addScaledVector(delta, 0.65);
        object.userData.velocity.y += 0.4;
        object.userData.jostleUntil = getState().elapsed + 1.3;
      }
    },
  });
  const decks = [0, 0],
    jetUntil = [0, 0],
    sporeUntil = [0, 0];
  const velocities = [new THREE.Vector2(), new THREE.Vector2()],
    drinks = [null, null],
    drinkMeshes = [null, null];
  let level = 0,
    coop = false,
    menuMode = true,
    objective = "coffee",
    shake = 0;
  const orientations = [new THREE.Quaternion(), new THREE.Quaternion()];
  const verticalVelocity = [0, 0];
  const handCups = [null, null];
  const dashUntil = [0, 0],
    padButtons = [[], []];
  let qualityTime = 0,
    qualityFrames = 0;
  function adaptQuality(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    qualityTime += dt;
    qualityFrames++;
    if (qualityTime < 1.5) return;
    if (
      qualityTime / qualityFrames > 1 / 32 &&
      renderer.getPixelRatio() > 0.66
    ) {
      renderer.setPixelRatio(Math.max(0.65, renderer.getPixelRatio() * 0.8));
      resize();
    }
    qualityTime = 0;
    qualityFrames = 0;
  }
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]") || !getState().running) return;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      ) ||
      (coop && level === MELT_LEVEL && ["PageUp", "PageDown"].includes(e.code))
    )
      e.preventDefault();
    keys.add(e.code);
    if (!e.repeat && ["Space", "Digit0", "Numpad0"].includes(e.code))
      toss(e.code === "Space" ? 0 : 1);
    if (!e.repeat && e.code === "KeyQ") toss(0, true);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  function holdDrink(idx, type) {
    drinks[idx] = type;
    if (drinkMeshes[idx]) {
      players[idx].remove(drinkMeshes[idx]);
      drinkMeshes[idx] = null;
    }
    if (handCups[idx]) {
      cameras[idx].remove(handCups[idx]);
      handCups[idx] = null;
    }
    if (type) {
      handCups[idx] = cup(0.28, -0.3, -0.8, cameras[idx]);
      handCups[idx].scale.setScalar(0.65);
      handCups[idx].rotation.x = 0.2;
      paintCup(handCups[idx], type);
    }
    if (type) {
      drinkMeshes[idx] = cup(0.1, 0.85, 0.58, players[idx]);
      paintCup(drinkMeshes[idx], type);
    }
  }
  function paintCup(group, type) {
    models.setCupType(group, type);
    const fill = group.userData.fill;
    fill.visible = type !== "empty";
    fill.material =
      type === "cappuccino"
        ? M.white
        : type === "latte"
          ? latteMaterial
          : M.coffee;
  }
  const latteMaterial = mat("#c59b6d");
  const preparing = [null, null];
  const streams = [0, 1].map(() =>
    Array.from({ length: 6 }, () => {
      const drop = sphere(0.028, M.coffee, 0, 0, 0, room);
      drop.visible = false;
      drop.castShadow = false;
      return drop;
    }),
  );
  function feedback(kind, idx = 0) {
    const p = players[idx].position;
    const colors = {
      serve: "#e9ca78",
      brew: "#9ce3d0",
      spill: "#b77d45",
      bump: "#e7e7cf",
    };
    if (kind === "serve" || kind === "spill") shake = kind === "serve" ? 3 : 6;
    for (let j = 0; j < (kind === "serve" ? 16 : 7); j++) {
      const spark = sphere(
        0.055 + Math.random() * 0.03,
        mat(colors[kind] ?? "#c5ead1"),
        p.x,
        p.y + 1.2,
        p.z,
        room,
      );
      spark.userData = {
        effect: true,
        life: 0.7 + Math.random() * 0.6,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          1 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      };
      floats.push(spark);
    }
  }
  function toss(idx, drop = false) {
    const state = getState();
    if ((idx === 1 && !coop) || !state.running || state.paused) return;
    if (!drinks[idx]) {
      if (drop) return;
      if (state.elapsed < dashUntil[idx]) return;
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
        orientations[idx],
      );
      if (state.gravity) {
        direction.y = 0;
        direction.normalize();
      }
      velocities[idx].add(
        new THREE.Vector2(direction.x, direction.z).multiplyScalar(5),
      );
      if (!state.gravity) verticalVelocity[idx] += direction.y * 5;
      dashUntil[idx] = state.elapsed + 1;
      feedback("bump", idx);
      return;
    }
    const p = players[idx],
      type = drinks[idx],
      direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
        orientations[idx],
      );
    const object = cup(
      p.position.x + direction.x * 0.75,
      p.position.y + EYE_HEIGHT + direction.y * 0.75,
      p.position.z + direction.z * 0.75,
      room,
    );
    paintCup(object, type);
    object.userData = {
      ...object.userData,
      pickupType: type,
      owner: idx,
      born: state.elapsed,
      deck: decks[idx],
      base: object.position.clone(),
      velocity: direction
        .multiplyScalar(drop ? 1 : 6)
        .add(
          new THREE.Vector3(
            velocities[idx].x,
            verticalVelocity[idx] + (drop || !state.gravity ? 0 : 0.7),
            velocities[idx].y,
          ),
        ),
      thrown: true,
    };
    floats.push(object);
    holdDrink(idx, null);
    throwDrink(idx);
  }
  function spill(object) {
    if (!object.userData.pickupType || object.userData.pickupType === "empty")
      return;
    object.userData.pickupType = "empty";
    paintCup(object, "empty");
    for (let j = 0; j < 7; j++) {
      const drop = sphere(
        0.09 + Math.random() * 0.06,
        M.coffee,
        object.position.x,
        object.position.y,
        object.position.z,
        room,
      );
      drop.userData = {
        liquid: true,
        life: 12,
        thrown: true,
        deck: object.userData.deck,
        base: drop.position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
      };
      floats.push(drop);
    }
    shake = 5;
    onSpill();
  }
  function pickupIndex(idx) {
    if (drinks[idx]) return -1;
    const target = getTarget(idx);
    return target?.kind === "pickup" ? floats.indexOf(target.item) : -1;
  }

  function pickup(idx) {
    const index = pickupIndex(idx);
    if (index < 0) return false;
    const item = floats[index];
    holdDrink(idx, item.userData.pickupType);
    room.remove(item);
    floats.splice(index, 1);
    return true;
  }
  function takeCup(idx) {
    if (drinks[idx] || getStation(idx) !== "coffee") return false;
    const item = rackCups.find((g) => g.visible);
    if (!item) return false;
    item.visible = false;
    item.userData.restock = getState().elapsed + 4;
    holdDrink(idx, "empty");
    return true;
  }

  function changeDeck(idx, delta, fromLift = false) {
    const state = getState();
    if (
      !state.running ||
      state.paused ||
      level !== MELT_LEVEL ||
      (state.gravity && !fromLift)
    )
      return false;
    const next = Math.max(
      getMapEnvironment(level, state.elapsed).hot ? 1 : 0,
      Math.min(2, decks[idx] + delta),
    );
    if (next === decks[idx]) return false;
    liftTransit[idx] = { from: players[idx].position.y, elapsed: 0 };
    decks[idx] = next;
    notify(
      `P${idx + 1} · Piano ${next} · ${fromLift ? "Ascensore in movimento" : "Propulsori attivi"}`,
    );
    return true;
  }
  const liftTransit = [null, null];
  function stationPosition(name) {
    const station = getMapStations(level, getState().elapsed)?.[name];
    if (station)
      return new THREE.Vector3(
        station.x,
        station.deck * DECK_HEIGHT +
          (station.elevation ?? 0) +
          (name === "service" ? 1.35 : 1.75),
        station.z + (name === "service" ? 0 : 0.25),
      );
    const base = MAIN_STATIONS[name];
    return new THREE.Vector3(base.x, base.y, base.z);
  }
  function getNearbyStation(i) {
    const p = players[i].position;
    return (
      ["coffee", "milk", "service"].find((name) => {
        const station = stationPosition(name);
        return (
          Math.hypot(p.x - station.x, p.z - station.z) < 3.3 &&
          Math.abs(p.y + EYE_HEIGHT - station.y) < 2.1
        );
      }) ?? null
    );
  }
  const shell = new THREE.Group();
  room.add(shell);
  const shellGlass = new THREE.MeshStandardMaterial({
    color: "#285b64",
    transparent: true,
    opacity: 0.25,
    metalness: 0.2,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  box(15.6, 6.4, 0.07, shellGlass, 0, 3.2, 5.6, shell);
  box(0.07, 6.4, 11.2, shellGlass, 7.8, 3.2, 0, shell);
  const shellMetal = mat("#366057");
  for (const x of [-7.7, -3.8, 0, 3.8, 7.7])
    box(0.09, 6.4, 0.12, shellMetal, x, 3.2, 5.6, shell);
  for (const z of [-5.5, -1.8, 1.8, 5.5])
    box(0.12, 6.4, 0.09, shellMetal, 7.8, 3.2, z, shell);
  for (const y of [0.2, 3.2, 6.4]) {
    box(15.6, 0.09, 0.12, shellMetal, 0, y, 5.6, shell);
    box(0.12, 0.09, 11.2, shellMetal, 7.8, y, 0, shell);
  }
  shell.scale.set(ROOM_SCALE_X, 1, ROOM_SCALE_Z);
  const roof = box(15.6, 0.035, 11.2, shellGlass, 0, 6.4, 0, shell);
  roof.castShadow = false;
  box(0.08, 0.08, 11.2, shellMetal, 0, 6.42, 0, shell);
  shell.children.forEach((child) => {
    if (child.material?.transparent) child.castShadow = false;
  });
  const holograms = ["coffee", "milk", "service"].map((name) => {
    const group = new THREE.Group();
    room.add(group);
    const material = new THREE.MeshBasicMaterial({
      color: name === "service" ? "#ffce76" : "#9af6d1",
      transparent: true,
      opacity: 0.7,
    });
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.25, 4),
      material,
    );
    arrow.rotation.z = Math.PI;
    group.add(arrow);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.016, 6, 24),
      material,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    group.add(ring);
    return { group, arrow, ring, name };
  });
  const targetMaterial = new THREE.MeshBasicMaterial({
    visible: false,
    side: THREE.DoubleSide,
  });
  const blockers = [];
  function pickMesh(geometry, target, collection = null) {
    const mesh = new THREE.Mesh(geometry, targetMaterial);
    mesh.userData.target = target;
    room.add(mesh);
    collection?.push(mesh);
    return mesh;
  }
  const stationTargets = ["coffee", "milk", "service"].map((name) =>
    pickMesh(new THREE.BoxGeometry(1, 1, 1), {
      kind: "station",
      station: name,
    }),
  );
  const liftTargets = [-LIFT_X, LIFT_X].map((x) => {
    const mesh = pickMesh(new THREE.BoxGeometry(0.9, 1.8, 1), { kind: "lift" });
    mesh.position.x = x;
    return mesh;
  });
  const vineTargets = [-VINE_X, VINE_X].map((x) => {
    const mesh = pickMesh(new THREE.BoxGeometry(0.55, 4, 0.55), {
      kind: "vine",
    });
    mesh.position.set(x, 2, VINE_Z);
    return mesh;
  });
  const counterBlockers = Array.from({ length: 18 }, () =>
    pickMesh(new THREE.BoxGeometry(1, 1, 1), null, blockers),
  );
  const wallBlockers = [
    pickMesh(new THREE.BoxGeometry(16, 12, 0.15), null, blockers),
    pickMesh(new THREE.BoxGeometry(0.15, 12, 12), null, blockers),
  ];
  wallBlockers[0].position.set(0, 4, -5.65);
  wallBlockers[1].position.set(-7.9, 4, 0);
  wallBlockers.forEach((mesh) => {
    mesh.position.x *= ROOM_SCALE_X;
    mesh.position.z *= ROOM_SCALE_Z;
    mesh.scale.set(ROOM_SCALE_X, 1, ROOM_SCALE_Z);
  });
  const deckBlockers = [1, 2].map((deck) => {
    const m = pickMesh(
      new THREE.RingGeometry(
        3.1 * MAP_SCALE,
        7.1 * MAP_SCALE,
        48,
        1,
        0,
        Math.PI * 1.16,
      ),
      null,
      blockers,
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = deck * DECK_HEIGHT;
    return m;
  });
  const pickupTargets = new Map();
  const targetOutline = new THREE.BoxHelper(undefined, 0xb7ffdc);
  targetOutline.material.depthTest = false;
  targetOutline.material.transparent = true;
  targetOutline.material.opacity = 0.4;
  scene.add(targetOutline);
  targetOutline.visible = false;
  function syncTargets() {
    stationTargets.forEach((mesh, index) => {
      const name = ["coffee", "milk", "service"][index];
      mesh.position.copy(stationPosition(name));
      mesh.scale.set(
        name === "coffee" && level < MELT_LEVEL
          ? 2.55
          : name === "service" && level < MELT_LEVEL
            ? 8.7
            : 1.6,
        name === "service" ? 0.55 : 1.2,
        name === "service" ? 1.4 : 1.15,
      );
    });
    liftTargets.forEach((mesh) => {
      mesh.position.y = decks[0] * DECK_HEIGHT + 0.9;
      mesh.position.z = LIFT_Z;
    });
    const activeCounters =
      level < MELT_LEVEL
        ? [...COUNTERS]
        : [0, 1, 2].flatMap((deck) =>
            getMapCounters(level, getState().elapsed, deck).map((c) => ({
              ...c,
              deck,
            })),
          );
    activeCounters.push(...getMapObstacles(level));
    counterBlockers.forEach((mesh, index) => {
      const counter = activeCounters[index];
      mesh.userData.enabled = !!counter;
      if (counter) {
        mesh.position.set(
          counter.x,
          (counter.deck ?? 0) * DECK_HEIGHT +
            (counter.elevation ?? 0) +
            (counter.height ?? 1.3) / 2,
          counter.z,
        );
        mesh.scale.set(counter.w, counter.height ?? 1.3, counter.d);
      }
    });
    for (const [item, proxy] of pickupTargets) {
      if (!floats.includes(item)) {
        room.remove(proxy);
        proxy.geometry.dispose();
        pickupTargets.delete(item);
      }
    }
    for (const item of floats) {
      if (!item.userData.pickupType) continue;
      if (!pickupTargets.has(item))
        pickupTargets.set(
          item,
          pickMesh(new THREE.SphereGeometry(0.27, 10, 8), {
            kind: "pickup",
            item,
          }),
        );
      pickupTargets
        .get(item)
        .position.copy(item.position)
        .add(new THREE.Vector3(0, 0.15, 0));
    }
    room.updateMatrixWorld(true);
  }
  function updateCameras() {
    room.updateMatrixWorld(true);
    cameras.forEach((camera, i) => {
      const eye = players[i].userData.actor?.eye;
      if (eye) eye.getWorldPosition(camera.position);
      else {
        camera.position
          .copy(players[i].position)
          .add(new THREE.Vector3(0, EYE_HEIGHT, 0));
        room.localToWorld(camera.position);
      }
      camera.quaternion.copy(room.quaternion).multiply(orientations[i]);
      camera.updateMatrixWorld(true);
      if (handCups[i])
        handCups[i].position.x = Math.min(0.28, 0.22 * camera.aspect);
    });
  }
  function getTarget(i) {
    if (menuMode) return null;
    syncTargets();
    updateCameras();
    const choices = [
      ...stationTargets,
      ...pickupTargets.values(),
      ...customerSystem.targets(),
    ];
    if (level === MELT_LEVEL) {
      liftTargets.forEach(
        (mesh) => (mesh.position.y = decks[i] * DECK_HEIGHT + 0.9),
      );
      choices.push(...liftTargets);
    }
    if (level === ZEN_LEVEL) choices.push(...vineTargets);
    room.updateMatrixWorld(true);
    return rayTarget(cameras[i], choices, [
      ...counterBlockers.filter((mesh) => mesh.userData.enabled),
      ...(level < MELT_LEVEL ? wallBlockers : []),
      ...(level === MELT_LEVEL ? deckBlockers : []),
    ]);
  }
  function getStation(i) {
    const target = getTarget(i);
    return target?.station ?? null;
  }
  function solveHeight(i, beforeY, dt) {
    const p = players[i].position,
      state = getState();
    const velocity = { y: verticalVelocity[i] };
    if (liftTransit[i]) {
      const lift = liftTransit[i];
      lift.elapsed += dt;
      const alpha = Math.min(1, lift.elapsed / 1.1);
      const eased = alpha * alpha * (3 - 2 * alpha);
      p.y = THREE.MathUtils.lerp(
        lift.from,
        decks[i] * DECK_HEIGHT + 0.13,
        eased,
      );
      velocity.y = 0;
      if (alpha === 1) liftTransit[i] = null;
    } else if (state.gravity) {
      let floor =
        level === MELT_LEVEL
          ? decks[i] * DECK_HEIGHT + 0.13
          : 0.13 + (level === REACTOR_LEVEL ? reactorFloor(p) : 0);
      const counters =
        level < MELT_LEVEL
          ? COUNTERS
          : getMapCounters(level, state.elapsed, decks[i]);
      const top = floor + (level < MELT_LEVEL ? 1.4 : 1.05);
      if (
        beforeY >= top - 0.03 &&
        counters.some(
          (c) =>
            Math.abs(p.x - c.x) < c.w / 2 + 0.1 &&
            Math.abs(p.z - c.z) < c.d / 2 + 0.1,
        )
      )
        floor = top;
      resolveVerticalBounds(
        p,
        velocity,
        floor,
        level === MELT_LEVEL ? 8 : 4.6,
        true,
      );
      if (p.y <= floor + 0.001) velocity.y = 0;
    } else {
      const counters =
        level < MELT_LEVEL
          ? COUNTERS
          : getMapCounters(level, state.elapsed, decks[i]);
      const counterTop =
        (level === MELT_LEVEL
          ? decks[i] * DECK_HEIGHT
          : level === REACTOR_LEVEL
            ? reactorFloor(p)
            : 0) + (level < MELT_LEVEL ? 1.5 : 1.15);
      if (
        beforeY >= counterTop &&
        p.y < counterTop &&
        counters.some(
          (c) =>
            Math.abs(p.x - c.x) < c.w / 2 + 0.1 &&
            Math.abs(p.z - c.z) < c.d / 2 + 0.1,
        )
      ) {
        p.y = counterTop;
        velocity.y = Math.abs(velocity.y) * 0.15;
      }
      const hot = getMapEnvironment(level, state.elapsed)?.hot;
      if (hot && beforeY < DECK_HEIGHT + 0.13) {
        p.y = DECK_HEIGHT + 0.13;
        beforeY = p.y;
        velocity.y = 0;
        if (decks[i] === 0)
          notify("Suolo rovente! Evacuazione al piano 1 · R/F per volare.");
        decks[i] = 1;
      }
      resolveVerticalBounds(
        p,
        velocity,
        hot
          ? DECK_HEIGHT + 0.13
          : 0.13 + (level === REACTOR_LEVEL ? reactorFloor(p) : 0),
        level === MELT_LEVEL ? 8 : 4.6,
        true,
      );
      if (level === MELT_LEVEL) {
        const radius = Math.hypot(p.x, p.z),
          angle = (Math.atan2(-p.z, p.x) + Math.PI * 2) % (Math.PI * 2);
        if (
          radius > 3.1 * MAP_SCALE &&
          radius < 7.1 * MAP_SCALE &&
          angle < Math.PI * 1.16
        )
          for (const deck of [1, 2]) {
            const y = deck * DECK_HEIGHT;
            if (beforeY >= y + 0.05 && p.y < y + 0.13) {
              p.y = y + 0.13;
              if (velocity.y < 0) velocity.y = -velocity.y * 0.15;
            } else if (beforeY + 1.8 <= y && p.y + 1.8 > y) {
              p.y = y - 1.8;
              if (velocity.y > 0) velocity.y = -velocity.y * 0.15;
            }
          }
        decks[i] = THREE.MathUtils.clamp(
          Math.floor((p.y + 0.2) / DECK_HEIGHT),
          hot ? 1 : 0,
          2,
        );
      }
    }
    verticalVelocity[i] = velocity.y;
  }
  const fpsViews = [0, 1].map((i) => {
    const element = document.createElement("div");
    element.className = `fps-view fps-view-${i}`;
    element.innerHTML = `<div class="view-player">P${i + 1} <span>${i ? "Frecce · IJKL sguardo · Invio" : navigator.maxTouchPoints > 0 ? "Pad · Trascina per guardare" : "WASD · Mouse / trascina"}</span></div><div class="crosshair"></div><div class="aim-caption"></div><div class="view-inventory"></div><div class="flight-readout"></div><div class="nav-markers">${["coffee", "milk", "service"].map((name) => `<div data-nav="${name}"><b>⌄</b><span></span></div>`).join("")}</div>`;
    canvas.parentElement.append(element);
    return element;
  });
  let viewports = [];
  function updateViewports(width, height) {
    const stacked = coop && height > width;
    viewports = [0, 1].map((i) => ({
      x: coop && !stacked ? (i * width) / 2 : 0,
      y: coop && stacked ? (i * height) / 2 : 0,
      width: coop && !stacked ? width / 2 : width,
      height: coop && stacked ? height / 2 : height,
    }));
    fpsViews.forEach((element, i) => {
      const box = viewports[i];
      Object.assign(element.style, {
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      element.hidden = menuMode || (i === 1 && !coop);
      cameras[i].aspect = box.width / box.height;
      cameras[i].updateProjectionMatrix();
    });
    document.body.classList.toggle("split-stacked", stacked);
  }
  function updateNavigation() {
    shell.visible = !menuMode && level < MELT_LEVEL;
    holograms.forEach(({ group, ring, name }) => {
      group.visible = !menuMode;
      group.position.copy(stationPosition(name));
      group.position.y += 1.02 + Math.sin(getState().elapsed * 2.5) * 0.08;
      ring.rotation.z = getState().elapsed;
      group.scale.setScalar(name === objective ? 1.2 : 0.8);
    });
    fpsViews.forEach((element, i) => {
      element.hidden = menuMode || (i === 1 && !coop);
      if (element.hidden) return;
      const camera = cameras[i],
        target = getTarget(i);
      element.classList.toggle("has-target", !!target);
      const names = {
        coffee: "MACCHINA CAFFÈ",
        milk: "DISTRIBUTORE LATTE",
        service: "CONSEGNA",
        pickup: "TAZZA",
        lift: "ASCENSORE",
        vine: "LIANA",
      };
      const hint = target
        ? (target.kind === "customer"
            ? `CLIENTE #${target.orderId}`
            : (names[target.station ?? target.kind] ?? "")) +
          ` · ${target.distance.toFixed(1)} m · ${i ? "INVIO" : "E"}`
        : "";
      element.querySelector(".aim-caption").textContent = hint;
      element.querySelector(".view-inventory").textContent =
        `P${i + 1} · ${{ empty: "TAZZA VUOTA", espresso: "ESPRESSO", latte: "CAFFELLATTE", cappuccino: "CAPPUCCINO", doppio: "DOPPIO ESPRESSO" }[drinks[i]] ?? "MANI LIBERE"}${preparing[i] ? " · PREPARAZIONE…" : ""}`;
      element.querySelector(".flight-readout").textContent =
        `${getState().gravity ? "1G" : `0G · ${i ? "PAG↑↓ QUOTA · U/O ROLLIO" : "R/F QUOTA · Z/C ROLLIO"}`} · ${Math.hypot(velocities[i].x, velocities[i].y, verticalVelocity[i]).toFixed(1)} m/s · ${players[i].position.y.toFixed(1)} m`;
      element.querySelectorAll("[data-nav]").forEach((marker) => {
        const name = marker.dataset.nav,
          point = room.localToWorld(
            stationPosition(name).add(new THREE.Vector3(0, 1, 0)),
          );
        const distance = camera.position.distanceTo(point),
          projected = point.clone().project(camera);
        const behind =
          point
            .clone()
            .sub(camera.position)
            .dot(camera.getWorldDirection(new THREE.Vector3())) < 0;
        let x = projected.x,
          y = -projected.y;
        if (behind) {
          x = -x;
          y = -y;
          if (Math.abs(x) < 0.1) x = 1;
        }
        const scale = Math.max(1, Math.abs(x) / 0.85, Math.abs(y) / 0.56);
        x /= scale;
        y /= scale;
        const limit = Math.max(0.2, 1 - 120 / viewports[i].width);
        x = THREE.MathUtils.clamp(x, -limit, limit);
        marker.style.left = `${50 + x * 50}%`;
        marker.style.top = `${50 + y * 50}%`;
        marker.classList.toggle("objective", name === objective);
        marker.classList.toggle("edge", behind || scale > 1);
        marker.querySelector("span").textContent =
          `${{ coffee: "CAFFÈ", milk: "LATTE", service: "CONSEGNA" }[name]} · ${Math.round(distance)}m`;
      });
    });
  }
  function render() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    shell.visible = !menuMode && level < MELT_LEVEL;
    if (menuMode) {
      players.forEach((player, i) => (player.visible = i === 0 || coop));
      marker.visible = true;
      targetOutline.visible = false;
      renderer.render(scene, menuCamera);
      return;
    }
    updateCameras();
    marker.visible = false;
    renderer.setScissorTest(true);
    for (let i = 0; i < (coop ? 2 : 1); i++) {
      const box = viewports[i];
      players.forEach(
        (player, index) =>
          (player.visible = index !== i && (index === 0 || coop)),
      );
      handCups.forEach((cup, index) => {
        if (cup) cup.visible = index === i;
      });
      const target = getTarget(i);
      targetOutline.visible = !!target;
      if (target) {
        targetOutline.setFromObject(
          target.kind === "pickup" ? target.item : target.object,
        );
      }
      renderer.setViewport(
        box.x,
        height - box.y - box.height,
        box.width,
        box.height,
      );
      renderer.setScissor(
        box.x,
        height - box.y - box.height,
        box.width,
        box.height,
      );
      renderer.render(scene, cameras[i]);
    }
    players.forEach((player, index) => (player.visible = index === 0 || coop));
    targetOutline.visible = false;
    renderer.setScissorTest(false);
  }
  let lookPointer = null;
  function requestPointer(event) {
    if (event && coop) {
      const rect = canvas.getBoundingClientRect(),
        view = viewports[1];
      if (
        event.clientX - rect.left >= view.x &&
        event.clientY - rect.top >= view.y
      )
        return;
    }
    if (
      !getState().running ||
      getState().paused ||
      navigator.maxTouchPoints > 0
    )
      return;
    // Le anteprime in iframe possono vietare il pointer lock: il drag resta sempre disponibile.
    try {
      const request = canvas.requestPointerLock?.();
      request?.catch?.(() => {});
    } catch {}
  }
  canvas.addEventListener("click", requestPointer);
  canvas.addEventListener("pointerdown", (event) => {
    if (menuMode || getState().paused) return;
    const box = canvas.getBoundingClientRect(),
      x = event.clientX - box.left,
      y = event.clientY - box.top;
    const index =
      coop && viewports[1] && x >= viewports[1].x && y >= viewports[1].y
        ? 1
        : 0;
    lookPointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      index,
    };
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      /* Capture facoltativa nelle WebView. */
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (
      !lookPointer ||
      event.pointerId !== lookPointer.id ||
      document.pointerLockElement === canvas
    )
      return;
    if (!getState().running || getState().paused) return;
    turnView(
      orientations[lookPointer.index],
      (event.clientX - lookPointer.x) * 0.004,
      (event.clientY - lookPointer.y) * 0.004,
      0,
      !getState().gravity,
    );
    lookPointer.x = event.clientX;
    lookPointer.y = event.clientY;
  });
  const endLook = (event) => {
    if (lookPointer?.id === event.pointerId) lookPointer = null;
  };
  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);
  canvas.addEventListener("lostpointercapture", endLook);
  document.addEventListener("mousemove", (event) => {
    if (
      document.pointerLockElement !== canvas ||
      !getState().running ||
      getState().paused
    )
      return;
    turnView(
      orientations[0],
      event.movementX * 0.0023,
      event.movementY * 0.0023,
      0,
      !getState().gravity,
    );
  });
  let wasLocked = false;
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    if (wasLocked && !locked && getState().running && !getState().paused)
      onPause();
    wasLocked = locked;
    document.body.classList.toggle(
      "mouse-locked",
      document.pointerLockElement === canvas,
    );
    keys.clear();
  });

  const touch = document.createElement("div");
  touch.className = "touch-controls";
  touch.innerHTML = `<div class="touch-pad"><button data-key="KeyW" aria-label="Avanti">↑</button><div><button data-key="KeyA" aria-label="Sinistra">←</button><button data-key="KeyS" aria-label="Indietro">↓</button><button data-key="KeyD" aria-label="Destra">→</button></div></div><div class="touch-actions"><div class="touch-decks"><button data-deck="1" aria-label="Spinta verso alto locale">↑</button><button data-deck="-1" aria-label="Spinta verso basso locale">↓</button><button data-key="KeyZ" aria-label="Rollio sinistro">↶</button><button data-key="KeyC" aria-label="Rollio destro">↷</button></div><button class="touch-throw" aria-label="Lancia o scatta">↗</button><button data-key="ShiftLeft" aria-label="Frena in zero G">Frena</button><button class="touch-interact" aria-label="Interagisci">E</button></div>`;
  canvas.parentElement.append(touch);
  const touchResets = [];
  touch.querySelectorAll("[data-key]").forEach((b) =>
    touchResets.push(
      bindTouchButton(
        b,
        () => keys.add(b.dataset.key),
        () => keys.delete(b.dataset.key),
      ),
    ),
  );
  touchResets.push(
    bindTouchButton(touch.querySelector(".touch-interact"), () => interact(0)),
  );
  touch.querySelectorAll("[data-deck]").forEach((b) =>
    touchResets.push(
      bindTouchButton(
        b,
        () => keys.add(b.dataset.deck === "1" ? "KeyR" : "KeyF"),
        () => keys.delete(b.dataset.deck === "1" ? "KeyR" : "KeyF"),
      ),
    ),
  );
  touchResets.push(
    bindTouchButton(touch.querySelector(".touch-throw"), () => toss(0)),
  );
  function clearInput() {
    keys.clear();
    if (lookPointer) {
      try {
        canvas.releasePointerCapture?.(lookPointer.id);
      } catch {}
    }
    lookPointer = null;
    touchResets.forEach((reset) => reset());
  }
  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  });
  const sporeOverlay = document.createElement("div");
  sporeOverlay.className = "spore-overlay";
  sporeOverlay.setAttribute("aria-hidden", "true");
  canvas.parentElement.append(sporeOverlay);
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    let aspect = width / height;
    const h = Math.max(level === MELT_LEVEL ? 12.1 : 10.8, 13.9 / aspect);
    menuCamera.left = -h * aspect;
    menuCamera.right = h * aspect;
    menuCamera.top = h;
    menuCamera.bottom = -h;
    menuCamera.updateProjectionMatrix();
    updateViewports(width, height);
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  let dynamicsElapsed = 0;
  function update(dt, t, draw = true) {
    const state = getState();
    const moving = state.running && !state.paused;
    const pulse =
      moving &&
      level === REACTOR_LEVEL &&
      Math.floor(state.elapsed / 16) > Math.floor(dynamicsElapsed / 16);
    if (moving) dynamicsElapsed = state.elapsed;
    room.position.x +=
      ((menuMode ? 4.6 : 0) - room.position.x) * Math.min(1, dt * 4);
    room.position.z +=
      ((menuMode ? -2 : 0) - room.position.z) * Math.min(1, dt * 4);
    if (!menuMode) {
      room.position.set(0, 0, 0);
      room.rotation.set(0, 0, 0);
    }
    rackCups.forEach((g, i) => {
      const stations = getMapStations(level, state.elapsed);
      if (stations)
        g.position.set(
          stations.coffee.x - 0.6 + i * 0.4,
          stations.coffee.deck * DECK_HEIGHT + 2.1,
          stations.coffee.z - 0.1,
        );
      else {
        g.position.set(
          MAIN_STATIONS.coffee.x - 0.94 + i * 0.59,
          2.83,
          MAIN_STATIONS.coffee.z - 0.2,
        );
        g.scale.setScalar(0.75);
      }
      if (!g.visible && state.elapsed >= g.userData.restock) g.visible = true;
    });
    const environment = getMapEnvironment(level, state.elapsed);
    if (level >= MELT_LEVEL) t = state.elapsed;
    if (!moving) clearInput();
    specialMaps.update(state, decks);
    for (let i = 0; i < (coop ? 2 : 1); i++) {
      const p = players[i],
        v = velocities[i];
      const input = new THREE.Vector2(
        (keys.has(i ? "ArrowRight" : "KeyD") ? 1 : 0) -
          (keys.has(i ? "ArrowLeft" : "KeyA") ? 1 : 0),
        (keys.has(i ? "ArrowDown" : "KeyS") ? 1 : 0) -
          (keys.has(i ? "ArrowUp" : "KeyW") ? 1 : 0),
      );
      const pad = navigator.getGamepads?.()[i];
      if (moving && pad) {
        input.x += Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0;
        input.y += Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : 0;
        if (pad.buttons[0]?.pressed && !padButtons[i][0]) interact(i);
        if (pad.buttons[2]?.pressed && !padButtons[i][2]) toss(i);
        const dead = (value) => (Math.abs(value ?? 0) > 0.14 ? value : 0);
        turnView(
          orientations[i],
          dead(pad.axes[2]) * dt * 2.2,
          dead(pad.axes[3]) * dt * 2.2,
          ((pad.buttons[4]?.pressed ? 1 : 0) -
            (pad.buttons[5]?.pressed ? 1 : 0)) *
            dt *
            1.8,
          !state.gravity,
          dt,
        );
        padButtons[i] = pad.buttons.map((b) => b.pressed);
      }
      if (input.length() > 1) input.normalize();
      if (moving) {
        const yaw =
          ((keys.has(i ? "KeyL" : "Numpad6") ? 1 : 0) -
            (keys.has(i ? "KeyJ" : "Numpad4") ? 1 : 0)) *
          dt *
          1.8;
        const pitch =
          ((keys.has(i ? "KeyK" : "Numpad2") ? 1 : 0) -
            (keys.has(i ? "KeyI" : "Numpad8") ? 1 : 0)) *
          dt *
          1.8;
        const roll =
          ((keys.has(i ? "KeyU" : "KeyZ") ? 1 : 0) -
            (keys.has(i ? "KeyO" : "KeyC") ? 1 : 0)) *
          dt *
          1.8;
        turnView(orientations[i], yaw, pitch, roll, !state.gravity, dt);
        const up =
          (keys.has(i ? "PageUp" : "KeyR") ? 1 : 0) -
          (keys.has(i ? "PageDown" : "KeyF") ? 1 : 0) +
          (pad?.buttons[3]?.pressed ? 1 : 0) -
          (pad?.buttons[6]?.pressed ? 1 : 0);
        const direction = movementVector(
          orientations[i],
          input.x,
          -input.y,
          up,
          !state.gravity,
        );
        const velocity = new THREE.Vector3(v.x, verticalVelocity[i], v.y);
        const beforeY = p.position.y;
        advanceFlight(p.position, velocity, direction, dt, {
          zeroG: !state.gravity,
          groundFriction: level === CRYO_LEVEL && onIce(p.position) ? 0.25 : 1,
          brake:
            keys.has("ShiftLeft") ||
            keys.has("ShiftRight") ||
            pad?.buttons[1]?.pressed,
          dashing: state.elapsed < dashUntil[i] - 0.65,
        });
        const beforeForce = velocity.clone();
        applyMapDynamics(level, state.elapsed, dt, p.position, velocity, {
          pulse,
          brake:
            keys.has("ShiftLeft") ||
            keys.has("ShiftRight") ||
            pad?.buttons[1]?.pressed,
        });
        p.position.addScaledVector(velocity.clone().sub(beforeForce), dt);
        v.set(velocity.x, velocity.z);
        verticalVelocity[i] = velocity.y;
        solveHeight(i, beforeY, dt);
        if (level === 2) {
          const pull = new THREE.Vector2(
            0.2 - p.position.x,
            -1.3 - p.position.z,
          );
          v.addScaledVector(pull.normalize(), dt * 0.55);
        }
        if (level < MELT_LEVEL) {
          if (p.position.y < 1.48)
            for (const counter of COUNTERS)
              resolveCounterCollision(
                p.position,
                v,
                counter,
                !state.gravity,
                dt,
              );
          resolveRoomBounds(p.position, v, state.gravity ? 0 : 0.45);
        } else {
          for (const obstacle of getMapObstacles(level))
            if (p.position.y < obstacle.height)
              resolveCounterCollision(
                p.position,
                v,
                obstacle,
                !state.gravity,
                dt,
              );
          if (
            p.position.y -
              decks[i] * DECK_HEIGHT -
              (level === REACTOR_LEVEL ? reactorFloor(p.position) : 0) <
            1.15
          )
            for (const counter of getMapCounters(
              level,
              state.elapsed,
              decks[i],
            ))
              resolveCounterCollision(
                p.position,
                v,
                counter,
                !state.gravity,
                dt,
              );
          resolveCircularBounds(p.position, v);
          if (level === MELT_LEVEL) {
            if (environment.hot && decks[i] === 0) {
              decks[i] = 1;
              p.position.y = DECK_HEIGHT + 0.13;
              verticalVelocity[i] = 0;
              notify("Suolo rovente! Evacuazione al piano 1 · R/F per volare.");
            }
            if (environment.hot && state.elapsed >= jetUntil[i]) {
              if (
                Math.hypot(p.position.x + 1.8 * MAP_SCALE, p.position.z) <
                  0.85 &&
                decks[i] < 2
              ) {
                verticalVelocity[i] = 5;
                v.y -= 2;
                jetUntil[i] = state.elapsed + 2;
                notify("Ventilatore agganciato · Catapulta verso il piano 2!");
              } else if (
                Math.abs(Math.abs(p.position.x) - 3 * MAP_SCALE) < 0.5 &&
                Math.abs(p.position.z - 0.3 * MAP_SCALE) < 0.7 &&
                state.elapsed % 4 < 1
              ) {
                v.x += Math.sign(p.position.x) * 2;
                jetUntil[i] = state.elapsed + 2;
                notify("Sbuffo di vapore! Mantieni la rotta.");
              }
            }
          } else if (level === ZEN_LEVEL) {
            const force = zenForce(environment.phase, p.position);
            v.x += force.x * dt;
            v.y += force.y * dt;
            if (
              v.length() > 2 &&
              [-VINE_X, VINE_X].some(
                (x) =>
                  Math.hypot(p.position.x - x, p.position.z - VINE_Z) < 0.8,
              ) &&
              state.elapsed >= sporeUntil[i]
            ) {
              sporeUntil[i] = state.elapsed + 3;
              notify("Spore in cabina! La vista torna limpida tra 3 secondi.");
            }
          }
        }
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
          orientations[i],
        );
        p.rotation.y = Math.atan2(forward.x, forward.z);
      }
      if (drinkMeshes[i])
        drinkMeshes[i].rotation.z =
          Math.sin(t * 8) * Math.min(v.length() * 0.035, 0.1);
      p.userData.jets.forEach((jet) => {
        jet.visible = moving && !state.gravity && v.length() > 0.2;
        jet.scale.y = 0.8 + Math.sin(t * 25) * 0.3;
      });
    }
    if (
      coop &&
      moving &&
      Math.abs(players[0].position.y - players[1].position.y) < 1
    ) {
      let impact;
      if (!state.gravity) {
        const a = new THREE.Vector3(
            velocities[0].x,
            verticalVelocity[0],
            velocities[0].y,
          ),
          b = new THREE.Vector3(
            velocities[1].x,
            verticalVelocity[1],
            velocities[1].y,
          );
        impact = resolveBodyContact(
          players[0].position,
          a,
          players[1].position,
          b,
        );
        velocities[0].set(a.x, a.z);
        velocities[1].set(b.x, b.z);
        verticalVelocity[0] = a.y;
        verticalVelocity[1] = b.y;
      } else
        impact = resolvePlayerCollision(
          players[0].position,
          velocities[0],
          players[1].position,
          velocities[1],
        );
      if (impact > 2.5) {
        shake = 3;
        feedback("bump", 0);
      }
      for (let i = 0; i < 2; i++) {
        if (level < MELT_LEVEL)
          resolveRoomBounds(
            players[i].position,
            velocities[i],
            state.gravity ? 0 : 0.45,
          );
        else resolveCircularBounds(players[i].position, velocities[i]);
        solveHeight(i, players[i].position.y, 0);
      }
    }
    marker.position.x = players[0].position.x;
    marker.position.z = players[0].position.z;
    marker.position.y =
      level === MELT_LEVEL ? decks[0] * DECK_HEIGHT + 0.16 : 0.16;
    sporeOverlay.classList.toggle(
      "visible",
      level === ZEN_LEVEL &&
        sporeUntil
          .slice(0, coop ? 2 : 1)
          .some((until) => until > state.elapsed),
    );
    room.updateMatrixWorld(true);
    const stations = getMapStations(level, state.elapsed);
    for (const name of ["coffee", "milk", "service"]) {
      const position = stationPosition(name);
      stationVisuals.groups[name].position.copy(position);
    }
    stationVisuals.update(state.elapsed, preparing, getOrders());
    customerSystem.update(
      moving ? dt : menuMode ? dt : 0,
      state,
      getOrders(),
      stationPosition("service"),
      {
        menu: menuMode,
        floor:
          level === MELT_LEVEL
            ? (stations?.service.deck ?? 0) * DECK_HEIGHT + 0.13
            : 0.13 + (stations?.service.elevation ?? 0),
      },
    );
    snapZones.forEach((ring, i) => {
      if (stations) {
        const station = Object.values(stations)[i];
        ring.position.set(
          station.x,
          station.deck * DECK_HEIGHT + 0.16,
          station.z,
        );
      }
      if (!stations) {
        const position = MAIN_STATIONS[["coffee", "milk", "service"][i]];
        ring.position.set(
          position.x,
          0.16,
          position.z + (i === 2 ? -0.9 : 1.2),
        );
      }
      const p = players[0].position;
      const near =
        Math.hypot(p.x - ring.position.x, p.z - ring.position.z) < 1.8 &&
        (!stations || Object.values(stations)[i].deck === decks[0]);
      ring.material.opacity = near ? 0.65 + Math.sin(t * 5) * 0.25 : 0.12;
      ring.scale.setScalar(near ? 1 + Math.sin(t * 4) * 0.08 : 1);
      ring.material.color.set(near ? "#ebc56c" : "#7f9f7e");

      if (["coffee", "milk", "service"][i] === objective && !menuMode) {
        ring.material.color.set("#f2c467");
        ring.material.opacity = 0.65 + Math.sin(t * 4) * 0.25;
        ring.scale.setScalar(1.2 + Math.sin(t * 3) * 0.08);
      }
    });
    updateCameras();
    streams.forEach((drops, idx) => {
      const station = preparing[idx];
      const source = station
        ? stationPosition(station).add(
            new THREE.Vector3(station === "milk" ? 1.02 : -0.7, -0.2, 0.42),
          )
        : null;
      drops.forEach((drop, j) => {
        drop.visible = !!station;
        if (!source) return;
        drop.material = station === "coffee" ? M.coffee : M.white;
        const target = handCups[idx]
          ? room.worldToLocal(
              handCups[idx].localToWorld(new THREE.Vector3(0, 0.287, 0)),
            )
          : players[idx].position.clone().add(new THREE.Vector3(0, 1.4, 0));
        const phase = (state.elapsed * 2 + j / 6) % 1;
        drop.position.lerpVectors(source, target, phase);
        if (!state.gravity) drop.position.y += Math.sin(phase * Math.PI) * 0.4;
      });
    });
    for (let index = floats.length - 1; index >= 0; index--) {
      const g = floats[index],
        data = g.userData,
        v = data.velocity;
      if (
        moving ||
        (menuMode && !state.paused && !data.thrown && !data.effect)
      ) {
        if (data.effect) {
          data.life -= dt;
          g.position.addScaledVector(v, dt);
          v.y -= 4 * dt;
          g.scale.setScalar(Math.max(0.1, data.life));
        } else if (data.thrown) {
          const floor =
            (level === MELT_LEVEL
              ? (data.deck ?? 0) * DECK_HEIGHT
              : level === REACTOR_LEVEL
                ? reactorFloor(g.position)
                : 0) + 0.17;
          applyMapDynamics(level, state.elapsed, dt, g.position, v, { pulse });
          if (level === CRYO_LEVEL && !state.gravity)
            deflectCrystal(g.position, v, state.elapsed);
          if (state.gravity) v.y -= 8 * dt;
          const previousY = g.position.y;
          g.position.addScaledVector(v, dt);
          v.multiplyScalar(Math.exp(-0.3 * dt));
          if (data.pickupType) {
            const counters =
              level < MELT_LEVEL
                ? COUNTERS
                : [
                    ...getMapCounters(level, state.elapsed, data.deck ?? 0),
                    ...getMapObstacles(level),
                  ];
            const baseY =
              level === MELT_LEVEL ? (data.deck ?? 0) * DECK_HEIGHT : 0;
            for (const counter of counters) {
              const topY =
                baseY + (counter.elevation ?? 0) + (counter.height ?? 1.6);
              if (
                Math.abs(g.position.x - counter.x) < counter.w / 2 + 0.12 &&
                Math.abs(g.position.z - counter.z) < counter.d / 2 + 0.12 &&
                previousY >= topY &&
                g.position.y < topY
              ) {
                g.position.y = topY;
                v.y = Math.abs(v.y) * 0.25;
                spill(g);
              } else if (g.position.y < topY && g.position.y > baseY) {
                const planar = { x: v.x, y: v.z },
                  speed = Math.hypot(v.x, v.z);
                if (
                  resolveCounterCollision(g.position, planar, counter, true, dt)
                ) {
                  v.x = planar.x;
                  v.z = planar.y;
                  if (speed > 2) spill(g);
                }
              }
            }
          }
          g.rotation.y += dt * 2;
          if (g.position.y < floor) {
            const impact = Math.abs(v.y);
            g.position.y = floor;
            v.y = Math.abs(v.y) * 0.25;
            v.x *= 0.88;
            v.z *= 0.88;
            if (impact > 1.8) spill(g);
          }
          if (g.position.y > 9) {
            g.position.y = 9;
            v.y = -Math.abs(v.y);
          }
          if (level < MELT_LEVEL) {
            const planar = { x: v.x, y: v.z },
              beforeX = v.x,
              beforeZ = v.z;
            resolveRoomBounds(g.position, planar, 0.55);
            v.x = planar.x;
            v.z = planar.y;
            if (Math.abs(beforeX - v.x) + Math.abs(beforeZ - v.z) > 2) spill(g);
          } else {
            const planar = { x: v.x, y: v.z };
            resolveCircularBounds(g.position, planar, MAP_RADIUS);
            v.x = planar.x;
            v.z = planar.y;
          }
          for (let i = 0; i < (coop ? 2 : 1); i++) {
            if (data.owner === i && state.elapsed - data.born < 0.5) continue;
            if (
              g.position.distanceTo(
                players[i].position.clone().add(new THREE.Vector3(0, 1, 0)),
              ) < 0.6 &&
              v.length() > 1
            ) {
              velocities[i].add(
                new THREE.Vector2(v.x, v.z).multiplyScalar(
                  data.liquid ? 1.2 : 0.5,
                ),
              );
              spill(g);
              v.multiplyScalar(-0.5);
              shake = 3;
            }
          }
          if (data.liquid) data.life -= dt;
        } else {
          if (level >= MAGNETIC_LEVEL && !state.gravity) {
            applyMapDynamics(level, state.elapsed, dt, g.position, v, {
              pulse,
            });
            g.position.addScaledVector(v, dt);
            const planar = { x: v.x, y: v.z };
            resolveCircularBounds(g.position, planar);
            v.x = planar.x;
            v.z = planar.y;
            g.position.y = THREE.MathUtils.clamp(g.position.y, 0.17, 4.5);
          }
          if (data.jostleUntil > state.elapsed) {
            g.position.addScaledVector(v, dt);
            v.multiplyScalar(Math.exp(-1.3 * dt));
          } else g.position.y = data.base.y + Math.sin(t * 0.6 + index) * 0.2;
          g.rotation.y += dt * 0.3;
          if (!state.gravity) {
            g.position.x += v.x * dt * 0.4;
            g.position.z += v.z * dt * 0.4;
          }
        }
        if (level === 2 && !data.effect) {
          const delta = hole.position.clone().sub(g.position);
          g.position.addScaledVector(delta, dt * 0.13);
          if (delta.length() < 0.4) g.position.copy(data.base);
        }
      }
      if (
        (data.life !== undefined && data.life <= 0) ||
        (floats.length > 110 && data.effect)
      ) {
        room.remove(g);
        g.geometry?.dispose();
        floats.splice(index, 1);
        continue;
      }
      g.visible = data.effect || data.thrown || !state.gravity || index < 3;
    }
    hole.rotation.y = t * 0.7;
    hole.rotation.z = t * 0.2;
    for (let i = 0; i < (coop ? 2 : 1); i++) {
      const model = players[i].userData.actor?.model;
      if (!model) continue;
      if (!state.gravity && !menuMode) {
        model.quaternion
          .copy(players[i].quaternion)
          .invert()
          .multiply(orientations[i])
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              Math.PI,
            ),
          );
        model.position
          .set(0, EYE_HEIGHT, 0)
          .sub(
            new THREE.Vector3(0, EYE_HEIGHT, 0).applyQuaternion(
              model.quaternion,
            ),
          );
      } else {
        model.quaternion.identity();
        model.position.set(0, 0, 0);
      }
    }
    models.update(moving ? dt : menuMode ? dt : 0, (actor) => {
      const index = players.indexOf(actor.parent);
      if (index >= 0)
        return !state.gravity
          ? "Float"
          : velocities[index].length() > 0.2
            ? "Walk"
            : "Idle";
      return (
        actor.parent.userData.customerAnimation ??
        (!state.gravity ? "Float" : "Idle")
      );
    });
    if (level === 1 && moving && menuMode) {
      room.rotation.z = Math.sin(state.elapsed * 0.1) * 0.09;
      room.rotation.y = Math.sin(state.elapsed * 0.08) * 0.09;
    } else {
      if (!state.paused) {
        room.rotation.z *= 0.97;
        room.rotation.y *= 0.97;
      }
    }
    if (!state.paused) shake *= Math.exp(-10 * dt);
    canvas.style.transform =
      shake > 0.2
        ? `translate(${Math.sin(t * 93) * shake}px,${Math.cos(t * 87) * shake}px) scale(1.012)`
        : "";
    updateCameras();
    updateNavigation();
    if (draw) render();
  }
  function reset() {
    dynamicsElapsed = 0;
    players[0].position.set(
      level === MELT_LEVEL
        ? -LIFT_X + 0.3
        : level === ZEN_LEVEL
          ? -1.8 * MAP_SCALE
          : MAIN_STATIONS.coffee.x + 0.15,
      0.13,
      level === MELT_LEVEL
        ? LIFT_Z
        : level === ZEN_LEVEL
          ? -0.1 * MAP_SCALE
          : MAIN_STATIONS.coffee.z + 2.7,
    );
    players[1].position.set(
      level === MELT_LEVEL ? -LIFT_X + 1.4 : MAIN_STATIONS.coffee.x + 1.4,
      0.13,
      level === MELT_LEVEL ? LIFT_Z : MAIN_STATIONS.coffee.z + 2.7,
    );
    if (level >= MAGNETIC_LEVEL) {
      const coffee = getMapStations(level, 0).coffee;
      players.forEach((p, i) =>
        p.position.set(coffee.x + i * 0.85, 0.13, coffee.z + 2.1),
      );
    }
    room.rotation.set(0, 0, 0);
    rackCups.forEach((g) => {
      g.visible = true;
      g.userData.restock = 0;
    });
    customerSystem.reset();
    liftTransit.fill(null);
    verticalVelocity.fill(0);
    orientations.forEach((q, i) =>
      aimAt(
        q,
        players[i].position.clone().add(new THREE.Vector3(0, EYE_HEIGHT, 0)),
        stationPosition("coffee"),
      ),
    );
    dashUntil.fill(0);
    velocities.forEach((v) => v.set(0, 0));
    holdDrink(0, null);
    holdDrink(1, null);
    for (let i = floats.length - 1; i >= 0; i--) {
      if (floats[i].userData.thrown || floats[i].userData.effect) {
        room.remove(floats[i]);
        floats.splice(i, 1);
      } else floats[i].position.copy(floats[i].userData.base);
    }
    preparing.fill(null);
    decks.fill(0);
    jetUntil.fill(0);
    sporeUntil.fill(0);
    sporeOverlay.classList.remove("visible");
    clearInput();
  }
  return {
    update,
    adaptQuality,
    render,
    releasePointer: () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      clearInput();
    },
    getView: (i) => orientations[i],
    getVelocity: (i) =>
      new THREE.Vector3(velocities[i].x, verticalVelocity[i], velocities[i].y),
    getTarget,
    getCamera: (i) => {
      updateCameras();
      return cameras[i];
    },
    getActors: () => models.actors,
    getCustomers: () => customerSystem.pool,
    customerServed: (id, complete) => customerSystem.served(id, complete),
    getNearbyStation,
    requestPointer,
    setMenuMode: (value) => {
      menuMode = value;
      document.body.classList.toggle("first-person", !value);
      if (value && document.pointerLockElement === canvas)
        document.exitPointerLock();
      if (!value) room.position.set(0, 0, 0);
      resize();
    },
    setObjective: (value) => {
      objective = value;
    },
    feedback,
    takeCup,
    pickup,
    setPreparation: (idx, station) => {
      preparing[idx] = station;
    },
    hasPickup: (idx) => pickupIndex(idx) >= 0,
    toss,
    reset,
    getPosition: (i) => players[i].position,
    getDrink: (i) => drinks[i],
    holdDrink,
    clearInput,
    getDeck: (i) => decks[i],
    getStation,
    interactEnvironment(i) {
      const target = getTarget(i);
      if (
        target?.kind === "lift" &&
        level === MELT_LEVEL &&
        nearLift(players[i].position)
      ) {
        changeDeck(i, decks[i] === 2 ? -2 : 1, true);
        return true;
      }
      if (
        target?.kind === "vine" &&
        level === ZEN_LEVEL &&
        [-VINE_X, VINE_X].some(
          (x) =>
            Math.hypot(
              players[i].position.x - x,
              players[i].position.z - VINE_Z,
            ) < 1.4,
        )
      ) {
        const v = velocities[i];
        v.set(-players[i].position.z + 2, players[i].position.x)
          .normalize()
          .multiplyScalar(5.5);
        notify("Liana agganciata · Slancio orbitale!");
        return true;
      }
      return false;
    },
    setCoop(value) {
      coop = value;
      document.body.classList.toggle("split-screen", value);
      resize();
      if (value) room.add(players[1]);
      else {
        room.remove(players[1]);
        holdDrink(1, null);
      }
    },
    setLevel(value) {
      level = value;
      legacyObjects.forEach((obj) => (obj.visible = value < MELT_LEVEL));
      specialMaps.select(value);
      scene.background.set(
        value === MELT_LEVEL
          ? "#263c46"
          : value === ZEN_LEVEL
            ? "#183f43"
            : "#102d37",
      );
      scene.fog.color.copy(scene.background);
      menuCamera.position.set(17, value === MELT_LEVEL ? 15 : 19, 23);
      menuCamera.lookAt(
        0,
        value === MELT_LEVEL ? 3.7 : value === ZEN_LEVEL ? 1.6 : 0.9,
        0,
      );
      touch.querySelector(".touch-decks").hidden = false;
      const defaults = [
        [-4.5, -2.65],
        [4.5, -2.65],
        [0, 1.55],
      ];
      snapZones.forEach((ring, i) =>
        ring.position.set(defaults[i][0], 0.14, defaults[i][1]),
      );
      resize();
      hole.visible = value === 2;
      reset();
    },
  };
}
