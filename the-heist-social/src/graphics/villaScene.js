import * as THREE from 'three';
import { updateHumanoidAnimation } from './humanoid.js';
import { createJewelOrnament } from './jewels.js';
import {
  ESTATE_BOUNDS,
  ROOMS,
  WALL_SEGMENTS,
  DOORS,
  FURNITURE,
  JEWELS,
  CCTV_CAMERAS,
  SECRET_PASSAGES,
  DIAMOND_HIDING_SPOTS,
} from '../data/villaLayout.js';
import {
  getFloorTextureSet,
  getPoolWaterTexture,
  getVillaWallTextures,
  getWoodMaterial,
  getCofferedDoorMaterial,
  getCarvedStoneMaterial,
  getWroughtIronFenceMaterial,
  getTreeBarkMaterial,
  getTreeFoliageMaterial,
  getHedgeMaterial,
  getPolishedMarblePropMaterial,
  getPersianRugMaterial,
  getTuftedUpholsteryMaterial,
  getBookSpinesMaterial,
  getCctvConsoleScreenMaterial,
  getTechCabinetMaterial,
  getSilkScreenMaterial,
  getAntiqueTrunkMaterial,
  getLoungerStripeMaterial,
  getPianoKeyboardMaterial,
  getVillaPaintingMaterial,
} from './textures.js';

export class VillaSceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x244d2b);
    this.scene.fog = new THREE.FogExp2(0x244d2b, 0.004);

    // Orthographic isometric view gives the villa a miniature-diorama look.
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.5, 160);
    this.cameraZoom = 18.5;
    this.cameraYaw = Math.PI / 4;
    this.cameraTarget = new THREE.Vector3(-7, 0, 7);

    // Dedicated offscreen WebGLRenderTarget for live CCTV camera feeds & snapshots
    this.cctvRenderTarget = new THREE.WebGLRenderTarget(640, 360, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    this.cctvCameras = new Map();
    this.cctvLedMeshes = new Map();

    // Dynamic registries
    this.wallMeshes = [];
    this.doorObjects = new Map();
    this.jewelObjects = new Map();
    this.secretMarkers = new Map();
    this.diamondStashMarkers = new Map();
    this.repairSparks = [];
    this.indoorLights = [];
    this.swayingTrees = [];
    this.poolWaterTex = null;

    this._buildLighting();
    this._buildGroundsAndFloors();
    this._buildPerimeterFencePathsAndTrees();
    this._buildWallsDoorsAndPaintings();
    this._buildFurniture();
    this._buildInteractiveMarkers();
    this._buildCctvCameras();

    this._onResize = () => {
      if (!this.renderer) return;
      this._updateCameraFrustum();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  _buildLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffead2, 0.84);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffebc4, 0x566b32, 0.66);
    this.scene.add(this.hemiLight);

    // Moonlight / Architectural Flood Key Light
    this.dirLight = new THREE.DirectionalLight(0xffebc5, 1.65);
    this.dirLight.position.set(-18, 34, 24);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 95;
    const d = 38;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Warm indoor room chandelier lights
    const roomLightCoords = [
      { x: -18, z: -10, color: 0xffdfb8, intensity: 15 }, // Master
      { x: -7.5, z: -10, color: 0xf8fafc, intensity: 13 }, // Bathroom
      { x: 4, z: -10, color: 0xffd8a8, intensity: 16 }, // Study
      { x: 17.5, z: -10, color: 0x7dd3fc, intensity: 14 }, // Security CCTV
      { x: -7, z: 7, color: 0xffe4b5, intensity: 19 }, // Foyer
      { x: 5.5, z: 7, color: 0xffdfa8, intensity: 18 }, // Salon
      { x: 18, z: 7, color: 0xfff3db, intensity: 17 }, // Kitchen
      { x: -18.5, z: 7, color: 0xffdfb8, intensity: 15 }, // Guest Bedroom
      { x: 0, z: -2, color: 0xffe4b5, intensity: 15 }, // Central Gallery
    ];

    for (const rl of roomLightCoords) {
      const pl = new THREE.PointLight(rl.color, rl.intensity, 18, 1.35);
      pl.position.set(rl.x, 3.6, rl.z);
      this.scene.add(pl);
      this.indoorLights.push({ light: pl, baseIntensity: rl.intensity, baseColor: new THREE.Color(rl.color) });
    }

    // Outdoor Pool & Fountain Accent Lights
    const poolGlow = new THREE.PointLight(0x06b6d4, 17, 17, 1.3);
    poolGlow.position.set(-29.2, 1.4, 1.5);
    this.scene.add(poolGlow);

    const fountainGlow = new THREE.PointLight(0xfbbf24, 14, 16, 1.3);
    fountainGlow.position.set(-7.0, 2.3, 19.8);
    this.scene.add(fountainGlow);
  }

  _buildGroundsAndFloors() {
    // Base Estate Lawn with rich grass blades + bump map
    const estateW = 74;
    const estateD = 60;
    const grassSet = getFloorTextureSet('grass', estateW, estateD);
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(estateW, estateD),
      new THREE.MeshStandardMaterial({
        map: grassSet.map,
        bumpMap: grassSet.bumpMap,
        bumpScale: grassSet.bumpScale,
        roughness: 0.9,
      })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.02;
    lawn.receiveShadow = true;
    this.scene.add(lawn);

    // Individual Room & Zone Floor Slabs (Textured + Bump Mapped!)
    for (const room of ROOMS) {
      if (room.floorType === 'grass') continue;
      const w = room.bounds.maxX - room.bounds.minX;
      const d = room.bounds.maxZ - room.bounds.minZ;
      const cx = (room.bounds.minX + room.bounds.maxX) / 2;
      const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;

      const tSet = getFloorTextureSet(room.floorType, w, d);
      const mat = new THREE.MeshStandardMaterial({
        map: tSet.map,
        bumpMap: tSet.bumpMap || null,
        bumpScale: tSet.bumpScale || 0,
        roughness: room.floorType.startsWith('marble') ? 0.24 : 0.44,
        metalness: room.floorType.startsWith('marble') ? 0.08 : 0.03,
      });
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, room.indoor ? 0.01 : 0.002, cz);
      slab.receiveShadow = true;
      this.scene.add(slab);
    }
  }

  _createTexturedCypressTree(barkMat, cypressMat, stoneMat, scale = 1.0) {
    const g = new THREE.Group();

    // Carved travertine tree-ring planter collar + dark soil
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.09, 10, 20), stoneMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);

    // Gnarled textured bark trunk with root flare
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 1.35, 14), barkMat);
    trunk.position.y = 0.65;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);

    // Multi-layered organic Italian Cypress spire (4 sculpted foliage clusters + textured needles!)
    const canopy = new THREE.Group();
    const tiers = [
      { y: 1.75, rx: 0.82, ry: 1.15, rz: 0.82 },
      { y: 2.75, rx: 0.74, ry: 1.22, rz: 0.74 },
      { y: 3.72, rx: 0.56, ry: 1.12, rz: 0.56 },
      { y: 4.55, rx: 0.32, ry: 0.88, rz: 0.32 },
    ];
    tiers.forEach((t, idx) => {
      const geo = new THREE.SphereGeometry(1, 18, 16);
      geo.scale(t.rx, t.ry, t.rz);
      const tuft = new THREE.Mesh(geo, cypressMat);
      tuft.position.y = t.y;
      tuft.rotation.y = idx * 0.9;
      tuft.castShadow = true;
      tuft.receiveShadow = true;
      canopy.add(tuft);
    });

    g.add(canopy);
    g.scale.setScalar(scale);
    return { root: g, canopy };
  }

  _createTexturedOliveTree(barkMat, oliveMat, stoneMat, scale = 1.0) {
    const g = new THREE.Group();

    // Stone planter ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.1, 10, 22), stoneMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);

    // Gnarled tilted Mediterranean trunk + 3 forked boughs
    const mainTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.45, 14), barkMat);
    mainTrunk.position.y = 0.7;
    mainTrunk.rotation.z = 0.08;
    mainTrunk.castShadow = true;
    g.add(mainTrunk);

    const canopy = new THREE.Group();
    const branches = [
      { bx: -0.35, bz: 0.18, rz: 0.48, rx: -0.22, cx: -0.72, cy: 2.35, cz: 0.32, r: 0.95 },
      { bx: 0.36, bz: -0.15, rz: -0.45, rx: 0.2, cx: 0.74, cy: 2.45, cz: -0.28, r: 1.02 },
      { bx: 0.04, bz: 0.32, rz: -0.1, rx: 0.42, cx: 0.08, cy: 2.68, cz: 0.55, r: 0.88 },
      { bx: 0, bz: 0, rz: 0, rx: 0, cx: 0.0, cy: 2.85, cz: -0.05, r: 1.08 },
    ];

    for (const b of branches) {
      if (b.bx !== 0 || b.bz !== 0) {
        const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.05, 10), barkMat);
        limb.position.set(b.bx, 1.65, b.bz);
        limb.rotation.set(b.rx, 0, b.rz);
        limb.castShadow = true;
        g.add(limb);
      }
      const crownGeo = new THREE.SphereGeometry(b.r, 18, 14);
      crownGeo.scale(1.18, 0.72, 1.12);
      const crown = new THREE.Mesh(crownGeo, oliveMat);
      crown.position.set(b.cx, b.cy, b.cz);
      crown.castShadow = true;
      crown.receiveShadow = true;
      canopy.add(crown);
    }

    g.add(canopy);
    g.scale.setScalar(scale);
    return { root: g, canopy };
  }

  _buildPerimeterFencePathsAndTrees() {
    // Travertine Stone Walkways with relief bump
    const paths = [
      { x: -7.0, z: 20.0, w: 4.2, d: 14.0 },
      { x: 5.5, z: 15.8, w: 3.0, d: 5.6 },
      { x: 0.0, z: 17.5, w: 34.0, d: 2.6 },
      { x: 27.2, z: -1.0, w: 3.0, d: 37.0 },
      { x: 4.0, z: -18.2, w: 46.0, d: 2.8 },
      { x: 4.0, z: -16.2, w: 4.4, d: 3.2 },
    ];
    for (const p of paths) {
      const travSet = getFloorTextureSet('travertine', p.w, p.d);
      const pathMat = new THREE.MeshStandardMaterial({
        map: travSet.map,
        bumpMap: travSet.bumpMap,
        bumpScale: travSet.bumpScale,
        roughness: 0.68,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), pathMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.006, p.z);
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // Carved Ashlar Stone Pillars + Alpha-Cutout Wrought-Iron Spear Fence!
    const pillarMat = getCarvedStoneMaterial(1, 2);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    const bx = ESTATE_BOUNDS.maxX;
    const bz = ESTATE_BOUNDS.maxZ;

    const rails = [
      { x: 0, z: -bz, len: bx * 2, horiz: true },
      { x: -20.5, z: bz, len: 26, horiz: true },
      { x: 14.0, z: bz, len: 39, horiz: true },
      { x: -bx, z: 0, len: bz * 2, horiz: false },
      { x: bx, z: 0, len: bz * 2, horiz: false },
    ];
    for (const r of rails) {
      const fenceMat = getWroughtIronFenceMaterial(r.len);
      const fence = new THREE.Mesh(new THREE.PlaneGeometry(r.len, 1.85), fenceMat);
      fence.position.set(r.x, 0.925, r.z);
      if (!r.horiz) fence.rotation.y = Math.PI / 2;
      this.scene.add(fence);
    }

    const pillarSpots = [
      [-9.2, bz], [-4.8, bz], [-bx, -bz], [bx, -bz], [-bx, bz], [bx, bz],
      [-bx, 0], [bx, 0], [0, -bz],
    ];
    for (const [px, pz] of pillarSpots) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.35, 0.8), pillarMat);
      pil.position.set(px, 1.175, pz);
      pil.castShadow = true;
      pil.receiveShadow = true;
      this.scene.add(pil);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.96), pillarMat);
      cap.position.set(px, 2.38, pz);
      this.scene.add(cap);

      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), lampMat);
      lantern.position.set(px, 2.62, pz);
      this.scene.add(lantern);
    }

    // Lush Textured Garden Trees: Multi-tier Tuscan Cypresses + Mediterranean Olive Trees!
    const barkMat = getTreeBarkMaterial();
    const cypressMat = getTreeFoliageMaterial('cypress');
    const oliveMat = getTreeFoliageMaterial('olive');

    const cypressCoords = [
      [-31.2, -23.2, 1.05],
      [-24.2, -24.2, 0.95],
      [-8.5, -24.5, 1.08],
      [9.5, -24.5, 1.0],
      [20.5, -24.0, 1.06],
      [31.0, -23.2, 0.96],
      [-31.2, 22.5, 1.04],
      [-14.2, 24.2, 1.0],
      [0.8, 24.2, 1.02],
      [22.5, 23.5, 1.08],
      [31.5, 18.2, 0.98],
      [31.5, -14.2, 1.02],
    ];

    cypressCoords.forEach(([tx, tz, sc], idx) => {
      const tree = this._createTexturedCypressTree(barkMat, cypressMat, pillarMat, sc);
      tree.root.position.set(tx, 0, tz);
      this.scene.add(tree.root);
      this.swayingTrees.push({ canopy: tree.canopy, phase: idx * 1.1 });
    });

    // Scenic Mediterranean Olive Trees in garden corners (strictly clear of walkways!)
    const oliveCoords = [
      [-29.5, 19.5, 0.95],
      [18.5, 22.0, 1.0],
      [31.2, 2.5, 0.92],
      [-29.8, -19.2, 0.92],
      [26.5, -22.5, 0.96],
    ];

    oliveCoords.forEach(([ox, oz, sc], idx) => {
      const olive = this._createTexturedOliveTree(barkMat, oliveMat, pillarMat, sc);
      olive.root.position.set(ox, 0, oz);
      olive.root.rotation.y = idx * 1.3;
      this.scene.add(olive.root);
      this.swayingTrees.push({ canopy: olive.canopy, phase: idx * 1.7 + 0.5 });
    });
  }

  _buildWallsDoorsAndPaintings() {
    const trimMat = getWoodMaterial('dark', 4, 1);
    const frameMat = getWoodMaterial('dark', 1, 2);
    const leafMat = getCofferedDoorMaterial();
    const goldFrameMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.28, metalness: 0.78 });

    for (const seg of WALL_SEGMENTS) {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      const isH = Math.abs(dz) < 0.01;
      const h = seg.exterior ? 2.75 : 2.45;
      const w = isH ? len : seg.thickness;
      const d = isH ? seg.thickness : len;
      const cx = (seg.x1 + seg.x2) / 2;
      const cz = (seg.z1 + seg.z2) / 2;

      const wallTex = getVillaWallTextures(len, seg.exterior);
      const mat = new THREE.MeshStandardMaterial({
        map: wallTex.map,
        bumpMap: wallTex.bumpMap,
        bumpScale: wallTex.bumpScale,
        roughness: seg.exterior ? 0.74 : 0.62,
        transparent: true,
        opacity: 1.0,
      });

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(cx, h / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Textured dark walnut top coping
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.1, d + 0.05), trimMat);
      cap.position.set(cx, h + 0.045, cz);
      this.scene.add(cap);

      this.wallMeshes.push({ mesh, cap, cx, cz, isH, h, len });
    }

    // Hang Classical Oil Paintings in gilded frames on key interior walls!
    const paintings = [
      { x: -13.5, y: 1.55, z: -4.82, rotY: 0, idx: 0 }, // West Gallery
      { x: -1.5, y: 1.55, z: -4.82, rotY: 0, idx: 1 }, // Central Gallery
      { x: 11.5, y: 1.55, z: -4.82, rotY: 0, idx: 2 }, // East Gallery
      { x: 5.5, y: 1.6, z: -14.74, rotY: 0, idx: 0 }, // Study North Wall
      { x: -18.0, y: 1.6, z: -14.74, rotY: 0, idx: 1 }, // Master Bedroom North Wall
      { x: 11.82, y: 1.6, z: 4.2, rotY: -Math.PI / 2, idx: 2 }, // Salon East Wall
    ];
    for (const pt of paintings) {
      const pg = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.05, 0.06), goldFrameMat);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.85), getVillaPaintingMaterial(pt.idx));
      art.position.z = 0.035;
      pg.add(frame, art);
      pg.position.set(pt.x, pt.y, pt.z);
      pg.rotation.y = pt.rotY;
      this.scene.add(pg);
    }

    // Build Animated Textured 3D Doors & Doorframes
    for (const door of DOORS) {
      const group = new THREE.Group();
      group.position.set(door.x, 0, door.z);
      if (door.orientation === 'v') {
        group.rotation.y = Math.PI / 2;
      }

      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.35, 0.38), frameMat);
        post.position.set(s * (door.width / 2), 1.175, 0);
        group.add(post);
      }

      const hinge = new THREE.Group();
      hinge.position.set(-door.width / 2 + 0.08, 0, 0);
      group.add(hinge);

      const leafW = door.width - 0.16;
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(leafW, door.arch ? 1.9 : 2.15, 0.09),
        door.arch
          ? new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.7, roughness: 0.28 })
          : leafMat
      );
      leaf.position.set(leafW / 2, door.arch ? 0.95 : 1.08, 0);
      leaf.castShadow = true;
      hinge.add(leaf);

      const lockLedMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const lockLed = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.16), lockLedMat);
      lockLed.position.set(0, 2.32, 0);
      group.add(lockLed);

      this.scene.add(group);
      this.doorObjects.set(door.id, { door, group, hinge, leaf, lockLedMat });
    }
  }

  _buildFurniture() {
    const woodDark = getWoodMaterial('dark', 1, 1);
    const woodWarm = getWoodMaterial('warm', 1, 1);
    const cofferedWood = getCofferedDoorMaterial();
    const marbleMat = getPolishedMarblePropMaterial();
    const carvedStone = getCarvedStoneMaterial(1, 1);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.24, metalness: 0.82 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.28, metalness: 0.74 });
    const bookSpinesMat = getBookSpinesMaterial();
    const cctvScreenMat = getCctvConsoleScreenMaterial();
    const silkScreenMat = getSilkScreenMaterial();
    const trunkMat = getAntiqueTrunkMaterial();
    const loungerMat = getLoungerStripeMaterial();
    const pianoKeysMat = getPianoKeyboardMaterial();

    for (const item of FURNITURE) {
      const g = new THREE.Group();
      g.position.set(item.x, 0, item.z);
      g.rotation.y = item.rot || 0;

      switch (item.type) {
        case 'rug': {
          const rugMat = getPersianRugMaterial(item.color || '#7f1d1d');
          const rug = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.022, item.d), rugMat);
          rug.position.y = 0.018;
          rug.receiveShadow = true;
          g.add(rug);
          const border = new THREE.Mesh(
            new THREE.BoxGeometry(item.w + 0.08, 0.014, item.d + 0.08),
            goldMat
          );
          border.position.y = 0.012;
          g.add(border);
          break;
        }

        case 'king_bed': {
          const frame = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.42, item.d), woodDark);
          frame.position.y = 0.21;
          const headboardMat = getTuftedUpholsteryMaterial(item.color || '#6b1d2f');
          const headboard = new THREE.Mesh(new THREE.BoxGeometry(item.w, 1.38, 0.24), headboardMat);
          headboard.position.set(0, 0.69, -item.d / 2 + 0.12);
          const mattress = new THREE.Mesh(
            new THREE.BoxGeometry(item.w - 0.16, 0.28, item.d - 0.24),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 })
          );
          mattress.position.set(0, 0.52, 0.06);
          const duvet = new THREE.Mesh(
            new THREE.BoxGeometry(item.w - 0.12, 0.30, item.d * 0.62),
            headboardMat
          );
          duvet.position.set(0, 0.53, item.d * 0.16);
          for (const s of [-0.7, 0.7]) {
            const pillow = new THREE.Mesh(
              new THREE.BoxGeometry(0.95, 0.16, 0.52),
              new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.68 })
            );
            pillow.position.set(s, 0.72, -item.d / 2 + 0.55);
            g.add(pillow);
          }
          frame.castShadow = true;
          g.add(frame, headboard, mattress, duvet);
          break;
        }

        case 'wardrobe':
        case 'cabinet': {
          const h = item.type === 'wardrobe' ? 2.15 : 1.75;
          const body = new THREE.Mesh(new THREE.BoxGeometry(item.w, h, item.d), cofferedWood);
          body.position.y = h / 2;
          body.castShadow = true;
          body.receiveShadow = true;
          const crown = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.1, 0.1, item.d + 0.1), woodDark);
          crown.position.y = h + 0.04;
          const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.05), goldMat);
          handleL.position.set(-0.08, h * 0.52, item.d / 2 + 0.025);
          const handleR = handleL.clone();
          handleR.position.x = 0.08;
          g.add(body, crown, handleL, handleR);
          break;
        }

        case 'nightstand':
        case 'pedestal': {
          const h = item.type === 'pedestal' ? 1.05 : 0.65;
          const stand = new THREE.Mesh(
            new THREE.BoxGeometry(item.w, h, item.d),
            item.type === 'pedestal' ? marbleMat : woodWarm
          );
          stand.position.y = h / 2;
          stand.castShadow = true;
          g.add(stand);
          break;
        }

        case 'vanity':
        case 'sink_vanity': {
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(item.w, 0.85, item.d),
            item.type === 'sink_vanity' ? marbleMat : woodWarm
          );
          base.position.y = 0.425;
          base.castShadow = true;
          const topSlab = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.06, 0.06, item.d + 0.06), marbleMat);
          topSlab.position.y = 0.86;
          const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.12, item.d * 0.86), goldMat);
          mirrorFrame.position.set(-item.w / 2 + 0.07, 1.42, 0);
          const mirror = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 1.02, item.d * 0.78),
            new THREE.MeshStandardMaterial({ color: 0xe0f2fe, metalness: 0.9, roughness: 0.08 })
          );
          mirror.position.set(-item.w / 2 + 0.08, 1.42, 0);
          g.add(base, topSlab, mirrorFrame, mirror);
          break;
        }

        case 'bathtub': {
          const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.58, 0.68, 28), marbleMat);
          outer.scale.set(item.w / 1.36, 1, item.d / 1.36);
          outer.position.y = 0.34;
          outer.castShadow = true;
          const water = new THREE.Mesh(
            new THREE.CylinderGeometry(0.60, 0.52, 0.06, 28),
            new THREE.MeshStandardMaterial({
              map: getPoolWaterTexture(),
              roughness: 0.12,
              metalness: 0.1,
            })
          );
          water.scale.set(item.w / 1.36, 1, item.d / 1.36);
          water.position.y = 0.65;
          const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.88, 10), goldMat);
          faucet.position.set(0, 0.44, -item.d / 2 - 0.08);
          g.add(outer, water, faucet);
          break;
        }

        case 'exec_desk': {
          const top = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.12, item.d), woodDark);
          top.position.y = 0.78;
          top.castShadow = true;
          // Green leather blotter pad on executive desk
          const blotter = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.02, 0.7),
            new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.55 })
          );
          blotter.position.set(0.15, 0.85, 0.05);
          for (const s of [-1, 1]) {
            const ped = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.74, item.d - 0.15), cofferedWood);
            ped.position.set(s * (item.w / 2 - 0.42), 0.37, 0);
            g.add(ped);
          }
          const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.28, 12), goldMat);
          lampStem.position.set(-0.9, 0.96, -0.3);
          const lamp = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 0.2, 14),
            new THREE.MeshStandardMaterial({ color: 0x15803d, emissive: 0x22c55e, emissiveIntensity: 0.6 })
          );
          lamp.position.set(-0.9, 1.12, -0.3);
          g.add(top, blotter, lampStem, lamp);
          break;
        }

        case 'bookshelf': {
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(item.w, 2.25, item.d), woodDark);
          shelf.position.y = 1.125;
          shelf.castShadow = true;
          g.add(shelf);
          for (let row = 0; row < 4; row++) {
            const books = new THREE.Mesh(
              new THREE.BoxGeometry(item.w * 0.9, 0.34, item.d + 0.05),
              bookSpinesMat
            );
            books.position.y = 0.42 + row * 0.48;
            g.add(books);
          }
          break;
        }

        case 'sofa': {
          const sofaMat = getTuftedUpholsteryMaterial(item.color || '#7c2d12');
          const seat = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.44, item.d), sofaMat);
          seat.position.y = 0.22;
          const back = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.88, 0.3), sofaMat);
          back.position.set(0, 0.44, -item.d / 2 + 0.15);
          for (const s of [-1, 1]) {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.66, item.d), sofaMat);
            arm.position.set(s * (item.w / 2 - 0.13), 0.33, 0);
            g.add(arm);
          }
          seat.castShadow = true;
          g.add(seat, back);
          break;
        }

        case 'cctv_desk': {
          const desk = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.82, item.d), woodDark);
          desk.position.y = 0.41;
          desk.castShadow = true;
          const consoleTop = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.06, 0.06, item.d + 0.06), metalMat);
          consoleTop.position.y = 0.84;
          g.add(desk, consoleTop);
          for (let i = -1; i <= 1; i++) {
            const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.84, 0.07), metalMat);
            bezel.position.set(i * 1.4, 1.3, -0.35);
            bezel.rotation.y = -i * 0.18;
            const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.74), cctvScreenMat);
            screen.position.set(i * 1.4 + Math.sin(-i * 0.18) * 0.04, 1.3, -0.31);
            screen.rotation.y = -i * 0.18;
            g.add(bezel, screen);
          }
          break;
        }

        case 'server_rack':
        case 'power_panel': {
          const isPwr = item.type === 'power_panel';
          const h = isPwr ? 1.75 : 2.1;
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(item.w, h, item.d),
            getTechCabinetMaterial(isPwr)
          );
          box.position.y = h / 2;
          box.castShadow = true;
          const led = new THREE.Mesh(
            new THREE.BoxGeometry(item.w + 0.03, 0.14, item.d * 0.68),
            new THREE.MeshBasicMaterial({ color: isPwr ? 0xf59e0b : 0x22d3ee })
          );
          led.position.y = h * 0.82;
          g.add(box, led);
          if (isPwr) {
            this.repairSparks.push(led);
          }
          break;
        }

        case 'emergency_pedestal': {
          const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, 0.92, 28), marbleMat);
          ped.position.y = 0.46;
          ped.castShadow = true;
          const goldTrim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.05, 12, 32), goldMat);
          goldTrim.rotation.x = Math.PI / 2;
          goldTrim.position.y = 0.92;
          const redBtn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32, 0.36, 0.22, 24),
            new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.85 })
          );
          redBtn.position.y = 1.02;
          const glassDome = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.08 })
          );
          glassDome.position.y = 0.92;
          g.add(ped, goldTrim, redBtn, glassDome);
          break;
        }

        case 'broken_diamond_case': {
          const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 1.1), marbleMat);
          base.position.y = 0.525;
          base.castShadow = true;
          const cushion = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.12, 0.65),
            getTuftedUpholsteryMaterial('#881337')
          );
          cushion.position.y = 1.08;
          const shardMat = new THREE.MeshStandardMaterial({
            color: 0xbae6fd,
            transparent: true,
            opacity: 0.58,
            roughness: 0.08,
          });
          for (let i = 0; i < 5; i++) {
            const shard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 4), shardMat);
            const ang = (i / 5) * Math.PI * 2;
            shard.position.set(Math.cos(ang) * 0.36, 1.22, Math.sin(ang) * 0.36);
            shard.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.35;
            g.add(shard);
          }
          g.add(base, cushion);
          break;
        }

        case 'grand_piano': {
          const pianoMat = new THREE.MeshStandardMaterial({
            map: woodDark.map,
            color: 0x1b1d24,
            roughness: 0.12,
            metalness: 0.25,
          });
          const body = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.38, item.d), pianoMat);
          body.position.y = 0.88;
          body.castShadow = true;
          const soundboard = new THREE.Mesh(new THREE.BoxGeometry(item.w - 0.24, 0.04, item.d - 0.3), goldMat);
          soundboard.position.y = 1.08;
          const keys = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.1, 0.3), pianoKeysMat);
          keys.position.set(0, 0.83, item.d / 2 - 0.1);
          for (const [lx, lz] of [[-0.9, -0.8], [0.9, -0.8], [0, 0.9]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.72, 12), pianoMat);
            leg.position.set(lx, 0.36, lz);
            g.add(leg);
          }
          g.add(body, soundboard, keys);
          break;
        }

        case 'antique_trunk': {
          const box = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.68, item.d), trunkMat);
          box.position.y = 0.34;
          box.castShadow = true;
          g.add(box);
          break;
        }

        case 'kitchen_island':
        case 'kitchen_counter': {
          const cab = new THREE.Mesh(new THREE.BoxGeometry(item.w - 0.08, 0.82, item.d - 0.08), cofferedWood);
          cab.position.y = 0.41;
          cab.castShadow = true;
          const counterTop = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.08, item.d), marbleMat);
          counterTop.position.y = 0.86;
          g.add(cab, counterTop);
          break;
        }

        case 'dining_table':
        case 'coffee_table': {
          const isDining = item.type === 'dining_table';
          const h = isDining ? 0.84 : 0.48;
          const top = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.1, item.d), woodWarm);
          top.position.y = h;
          top.castShadow = true;
          g.add(top);
          const legOffX = item.w / 2 - 0.22;
          const legOffZ = item.d / 2 - 0.22;
          for (const [lx, lz] of [[-legOffX, -legOffZ], [legOffX, -legOffZ], [-legOffX, legOffZ], [legOffX, legOffZ]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, h, 10), woodDark);
            leg.position.set(lx, h / 2, lz);
            g.add(leg);
          }
          if (isDining) {
            // Golden Candelabra centerpiece on dining table
            const cand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 0.42, 12), goldMat);
            cand.position.y = h + 0.25;
            g.add(cand);
          }
          break;
        }

        case 'pool_filter': {
          const box = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.92, item.d), getTechCabinetMaterial(false));
          box.position.y = 0.46;
          box.castShadow = true;
          g.add(box);
          break;
        }

        case 'folding_screen': {
          const screen = new THREE.Mesh(new THREE.BoxGeometry(item.w, 1.92, 0.12), silkScreenMat);
          screen.position.y = 0.96;
          screen.castShadow = true;
          g.add(screen);
          break;
        }

        case 'swimming_pool': {
          const rim = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.65, 0.18, item.d + 0.65), marbleMat);
          rim.position.y = 0.06;
          this.poolWaterTex = getPoolWaterTexture();
          const water = new THREE.Mesh(
            new THREE.PlaneGeometry(item.w, item.d),
            new THREE.MeshStandardMaterial({
              map: this.poolWaterTex,
              roughness: 0.1,
              metalness: 0.15,
              emissive: 0x0891b2,
              emissiveIntensity: 0.38,
            })
          );
          water.rotation.x = -Math.PI / 2;
          water.position.y = 0.16;
          g.add(rim, water);
          break;
        }

        case 'lounger': {
          const frame = new THREE.Mesh(new THREE.BoxGeometry(item.w + 0.06, 0.14, item.d + 0.06), woodWarm);
          frame.position.y = 0.12;
          const pad = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.14, item.d), loungerMat);
          pad.position.y = 0.25;
          const headrest = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.14, 0.55), loungerMat);
          headrest.position.set(0, 0.4, -item.d / 2 + 0.28);
          headrest.rotation.x = 0.42;
          frame.castShadow = true;
          g.add(frame, pad, headrest);
          break;
        }

        case 'gazebo': {
          const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.48, 0.24, 8), carvedStone);
          base.position.y = 0.12;
          base.receiveShadow = true;
          g.add(base);
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.55, 14), marbleMat);
            col.position.set(Math.cos(ang) * 1.95, 1.38, Math.sin(ang) * 1.95);
            col.castShadow = true;
            g.add(col);
          }
          // Ornate wrought-iron ring cornice on Gazebo
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.09, 10, 24), carvedStone);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 2.65;
          g.add(ring);

          // Textured iron & wood Secret Trapdoor
          const trapdoor = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.09, 1.18), cofferedWood);
          trapdoor.position.y = 0.25;
          const ironRim = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.06, 1.26), metalMat);
          ironRim.position.y = 0.24;
          g.add(ironRim, trapdoor);
          break;
        }

        case 'fountain': {
          const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.25, 0.58, 28), carvedStone);
          basin.position.y = 0.29;
          basin.castShadow = true;
          const water = new THREE.Mesh(
            new THREE.CylinderGeometry(1.92, 1.92, 0.08, 28),
            new THREE.MeshStandardMaterial({
              map: getPoolWaterTexture(),
              roughness: 0.1,
              emissive: 0x0284c7,
              emissiveIntensity: 0.35,
            })
          );
          water.position.y = 0.55;
          const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 1.85, 18), marbleMat);
          spire.position.y = 1.08;
          const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.32, 0.28, 20), marbleMat);
          upperBowl.position.y = 1.65;
          g.add(basin, water, spire, upperBowl);
          break;
        }

        case 'garden_statue': {
          const ped = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.12, 1.32), carvedStone);
          ped.position.y = 0.56;
          ped.castShadow = true;
          const fig = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.35, 16), goldMat);
          fig.position.y = 1.78;
          const bust = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), goldMat);
          bust.position.y = 2.6;
          g.add(ped, fig, bust);
          break;
        }

        case 'hedge':
        default: {
          // Rose hedges in East Rose Garden & Front Garden, lush boxwood in Backyard!
          const withRoses = item.x > 15 || item.z > 15;
          const hedgeMat = getHedgeMaterial(withRoses, Math.max(item.w, item.d));
          const hedge = new THREE.Mesh(new THREE.BoxGeometry(item.w, 1.58, item.d), hedgeMat);
          hedge.position.y = 0.79;
          hedge.castShadow = true;
          hedge.receiveShadow = true;
          g.add(hedge);
          break;
        }
      }

      this.scene.add(g);
    }
  }

  _buildInteractiveMarkers() {
    const pedMarble = getPolishedMarblePropMaterial();
    const cushionVelvet = getTuftedUpholsteryMaterial('#4c0519');

    JEWELS.forEach((j, idx) => {
      const group = new THREE.Group();
      group.position.set(j.x, 0, j.z);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.9, 18), pedMarble);
      stand.position.y = 0.45;
      stand.castShadow = true;
      const velvetPad = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 16), cushionVelvet);
      velvetPad.position.y = 0.93;
      group.add(stand, velvetPad);

      // Each treasure gets a distinct ornament, faceted material and metallic setting.
      const gem = createJewelOrnament(j.id, idx);
      gem.position.y = 1.20;
      group.add(gem);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.026, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xd9aa4f, metalness: 0.75, roughness: 0.26 }));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.96; group.add(rim);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.52, 24),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.03;
      group.add(halo);

      const clueRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.74, 28),
        new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      clueRing.rotation.x = -Math.PI / 2;
      clueRing.position.y = 0.04;
      clueRing.visible = false;
      group.add(clueRing);

      this.scene.add(group);
      this.jewelObjects.set(j.id, { jewel: j, group, gem, halo, clueRing });
    });

    for (const sp of SECRET_PASSAGES) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sp.x, 0.035, sp.z);
      ring.visible = false;
      this.scene.add(ring);
      this.secretMarkers.set(sp.id, ring);
    }

    for (const ds of DIAMOND_HIDING_SPOTS) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.48, 0.64, 24),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(ds.x, 0.035, ds.z);
      ring.visible = false;
      this.scene.add(ring);
      this.diamondStashMarkers.set(ds.id, ring);
    }
  }

  _buildCctvCameras() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.48, roughness: 0.32 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.1 });
    for (const camDef of CCTV_CAMERAS) {
      const cam = new THREE.PerspectiveCamera(camDef.fov, 16 / 9, 0.3, 45);
      cam.position.set(camDef.pos.x, camDef.pos.y, camDef.pos.z);
      cam.lookAt(camDef.lookAt.x, camDef.lookAt.y, camDef.lookAt.z);
      this.cctvCameras.set(camDef.id, cam);

      const mount = new THREE.Group();
      mount.position.set(camDef.pos.x, 2.55, camDef.pos.z);
      mount.lookAt(camDef.lookAt.x, 1.8, camDef.lookAt.z);

      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.42), bodyMat);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 12), lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.22;
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), ledMat);
      led.position.set(0.08, 0.06, 0.21);
      mount.add(housing, lens, led);
      this.scene.add(mount);
      this.cctvLedMeshes.set(camDef.id, ledMat);
    }
  }

  syncWorldState(simState, localPlayer, time) {
    // Animate pool water & gentle breeze sway on the textured garden trees!
    if (this.poolWaterTex) {
      this.poolWaterTex.offset.x = Math.sin(time * 0.25) * 0.06;
      this.poolWaterTex.offset.y = (time * 0.04) % 1;
    }
    for (const st of this.swayingTrees) {
      st.canopy.rotation.z = Math.sin(time * 1.15 + st.phase) * 0.022;
      st.canopy.rotation.x = Math.cos(time * 0.9 + st.phase) * 0.016;
    }

    if (!simState) return;

    const isThief = localPlayer && localPlayer.role === 'thief';
    const blackout = simState.sabotage.blackoutRemaining > 0;
    const cctvGlitch = simState.sabotage.cctvGlitchRemaining > 0;

    if (blackout) {
      this.ambientLight.intensity = isThief ? 0.54 : 0.15;
      this.dirLight.intensity = isThief ? 0.88 : 0.24;
      for (const il of this.indoorLights) {
        il.light.intensity = isThief ? il.baseIntensity * 0.55 : 1.6;
        il.light.color.setHex(0xef4444);
      }
    } else {
      this.ambientLight.intensity = 0.66;
      this.dirLight.intensity = 1.42;
      for (const il of this.indoorLights) {
        il.light.intensity = il.baseIntensity;
        il.light.color.copy(il.baseColor);
      }
    }

    for (const [, ledMat] of this.cctvLedMeshes.entries()) {
      if (cctvGlitch) {
        ledMat.color.setHex(Math.sin(time * 18) > 0 ? 0xf97316 : 0x1e293b);
      } else {
        ledMat.color.setHex(Math.sin(time * 4) > -0.4 ? 0xef4444 : 0x7f1d1d);
      }
    }

    for (const [, dObj] of this.doorObjects.entries()) {
      const locked = simState.sabotage.lockedWings[dObj.door.wing] > 0;
      const targetAngle = locked ? 0 : -Math.PI * 0.46;
      if (dObj.door.arch) {
        dObj.leaf.visible = locked;
      } else {
        dObj.hinge.rotation.y += (targetAngle - dObj.hinge.rotation.y) * 0.14;
      }
      dObj.lockLedMat.color.setHex(locked ? 0xef4444 : 0x10b981);
    }

    for (const [jId, jObj] of this.jewelObjects.entries()) {
      const jState = simState.jewels[jId];
      const stolen = jState?.stolen;
      jObj.gem.visible = !stolen;
      jObj.halo.visible = !stolen;
      if (!stolen) {
        jObj.gem.rotation.y = time * 1.4;
        jObj.gem.position.y = 1.20 + Math.sin(time * 2.5 + jObj.jewel.x) * 0.05;
      }
      const hasActiveClue = stolen && jState.clueRemaining > 0;
      jObj.clueRing.visible = hasActiveClue;
      if (hasActiveClue) {
        jObj.clueRing.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(time * 5));
      }
    }

    for (const [, ring] of this.secretMarkers.entries()) {
      ring.visible = Boolean(isThief);
      if (isThief) ring.material.opacity = 0.45 + 0.35 * Math.sin(time * 3.5);
    }

    for (const [dsId, ring] of this.diamondStashMarkers.entries()) {
      const holdsDiamond = simState.mainDiamond.stashedAt === dsId;
      ring.visible =
        Boolean(isThief) ||
        (localPlayer && Math.hypot(localPlayer.x - ring.position.x, localPlayer.z - ring.position.z) < 3.4);
      ring.material.color.setHex(isThief && holdsDiamond ? 0xfbbf24 : 0x38bdf8);
    }

    if (localPlayer) {
      for (const w of this.wallMeshes) {
        // Fade only the near-facing wall segments between the camera and the player.
        const dx = w.cx - localPlayer.x;
        const dz = w.cz - localPlayer.z;
        const along = dx * Math.sin(this.cameraYaw) + dz * Math.cos(this.cameraYaw);
        const across = dx * Math.cos(this.cameraYaw) - dz * Math.sin(this.cameraYaw);
        const blockingPlayer = along > 0.2 && along < 7.5 && Math.abs(across) < w.len * 0.5 + 1.8;
        const targetOp = blockingPlayer ? 0.25 : 1.0;
        w.mesh.material.opacity += (targetOp - w.mesh.material.opacity) * 0.18;
        w.cap.visible = !blockingPlayer;
      }
    }
  }

  _updateCameraFrustum() {
    const halfHeight = this.cameraZoom * 0.54;
    const halfWidth = halfHeight * window.innerWidth / window.innerHeight;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  updateCameraFollow(targetX, targetZ, dt) {
    this._updateCameraFrustum();
    this.cameraTarget.x += (targetX - this.cameraTarget.x) * Math.min(1, dt * 7.5);
    this.cameraTarget.z += (targetZ - this.cameraTarget.z) * Math.min(1, dt * 7.5);

    const distZ = this.cameraZoom * 0.86;
    const distY = this.cameraZoom * 1.05;
    const offsetX = Math.sin(this.cameraYaw) * distZ;
    const offsetZ = Math.cos(this.cameraYaw) * distZ;

    this.camera.position.set(
      this.cameraTarget.x + offsetX,
      distY,
      this.cameraTarget.z + offsetZ
    );
    this.camera.lookAt(this.cameraTarget.x, 0.65, this.cameraTarget.z);
  }

  renderMain() {
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  renderCctvFeedToCanvas(camId, outCanvas, simState, time) {
    const ctx = outCanvas.getContext('2d');
    const w = outCanvas.width;
    const h = outCanvas.height;
    const camDef = CCTV_CAMERAS.find((c) => c.id === camId) || CCTV_CAMERAS[0];
    const glitched = simState.sabotage.cctvGlitchRemaining > 0;

    if (glitched) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) {
        const v = Math.floor(Math.random() * 95);
        ctx.fillStyle = `rgb(${v}, ${v + 12}, ${v + 24})`;
        ctx.fillRect(0, y, w, 3);
      }
      ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
      ctx.fillRect(0, (time * 120) % h, w, 28);

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ SEGNALE CCTV MANOMESSO - SABOTAGGIO IN CORSO ⚠', w / 2, h / 2 - 8);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        `Ripristino automatico tra ${simState.sabotage.cctvGlitchRemaining.toFixed(0)}s o ripara Centralina`,
        w / 2,
        h / 2 + 20
      );
      return { glitched: true, visiblePlayers: [], suspiciousActivity: null };
    }

    const cam3d = this.cctvCameras.get(camDef.id);
    if (cam3d) {
      const baseLook = camDef.lookAt;
      const pan = Math.sin(time * 0.45) * 1.35;
      cam3d.lookAt(baseLook.x + pan, baseLook.y, baseLook.z);

      const prevFog = this.scene.fog;
      this.scene.fog = null;
      this.renderer.setRenderTarget(this.cctvRenderTarget);
      this.renderer.render(this.scene, cam3d);
      this.renderer.setRenderTarget(null);
      this.scene.fog = prevFog;

      const width = this.cctvRenderTarget.width;
      const height = this.cctvRenderTarget.height;
      if (!this._pixelBuf || this._pixelBuf.length !== width * height * 4) {
        this._pixelBuf = new Uint8Array(width * height * 4);
        this._offCanvas = document.createElement('canvas');
        this._offCanvas.width = width;
        this._offCanvas.height = height;
        this._offCtx = this._offCanvas.getContext('2d');
        this._imgData = this._offCtx.createImageData(width, height);
      }
      this.renderer.readRenderTargetPixels(this.cctvRenderTarget, 0, 0, width, height, this._pixelBuf);

      const dst = this._imgData.data;
      for (let row = 0; row < height; row++) {
        const srcRow = (height - 1 - row) * width * 4;
        const dstRow = row * width * 4;
        for (let col = 0; col < width * 4; col += 4) {
          const r = this._pixelBuf[srcRow + col];
          const g = this._pixelBuf[srcRow + col + 1];
          const b = this._pixelBuf[srcRow + col + 2];
          dst[dstRow + col] = Math.min(255, r * 0.92 + 8);
          dst[dstRow + col + 1] = Math.min(255, g * 1.05 + 12);
          dst[dstRow + col + 2] = Math.min(255, b * 0.98 + 10);
          dst[dstRow + col + 3] = 255;
        }
      }
      this._offCtx.putImageData(this._imgData, 0, 0);
      ctx.drawImage(this._offCanvas, 0, 0, w, h);
    }

    ctx.fillStyle = 'rgba(8, 24, 32, 0.14)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1.5);
    }

    const visiblePlayers = [];
    let suspiciousActivity = null;
    for (const p of simState.players) {
      if (p.eliminated || p.hidden) continue;
      const dist = Math.hypot(p.x - camDef.lookAt.x, p.z - camDef.lookAt.z);
      if (p.currentRoom === camDef.room || dist < camDef.detectRadius * 0.72) {
        visiblePlayers.push(p);
        if (p.activeCrime) {
          suspiciousActivity = {
            suspectId: p.id,
            suspectName: p.name,
            crimeLabel: p.activeCrime,
          };
        }
      }
    }

    ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(20, 17, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`REC  ${camDef.code} · ${camDef.name.toUpperCase()}`, 34, 21);

    const nowStr = new Date().toLocaleTimeString('it-IT');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`27/11/2026 ${nowStr}`, w - 14, 21);

    ctx.fillStyle = 'rgba(6, 10, 18, 0.78)';
    ctx.fillRect(0, h - 34, w, 34);
    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    if (suspiciousActivity) {
      ctx.fillStyle = '#f87171';
      ctx.fillText(
        `⚠ ALLERTA: ${suspiciousActivity.suspectName} — ${suspiciousActivity.crimeLabel}!`,
        14,
        h - 12
      );
    } else if (visiblePlayers.length > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(
        `Soggetti inquadrati: ${visiblePlayers.map((p) => p.name).join(', ')}`,
        14,
        h - 12
      );
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Nessun movimento rilevato nel settore', 14, h - 12);
    }

    return { glitched: false, visiblePlayers, suspiciousActivity, camDef };
  }

  /**
   * Renders an animated 3D CCTV "Caught Red-Handed" replay loop onto a 2D canvas
   * for the End-of-Match screen when the Thief is caught ("sgamato").
   */
  renderCaughtReplayToCanvas(canvas, moment, thiefPlayer, elapsedSec, avatarMeshes) {
    if (!canvas || !moment || !thiefPlayer || !avatarMeshes) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    if (!this.renderer) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    if (!this._replayCam) {
      this._replayCam = new THREE.PerspectiveCamera(58, 16 / 9, 0.2, 65);
    }

    const avatarMesh = avatarMeshes.get(thiefPlayer.id);
    // Save temporary states of all avatar meshes so we can stage the exact replay cleanly
    const savedStates = [];
    for (const [id, mesh] of avatarMeshes.entries()) {
      const nameplate = mesh.userData?.rig?.nameplate;
      savedStates.push({
        mesh,
        visible: mesh.visible,
        x: mesh.position.x,
        z: mesh.position.z,
        rotY: mesh.rotation.y,
        labelVis: nameplate ? nameplate.visible : true,
      });
      if (id !== thiefPlayer.id) {
        mesh.visible = false;
      }
    }

    // 4.6-second crime replay choreography
    const loopDuration = 4.6;
    const loopT = elapsedSec % loopDuration;

    // Determine security camera ceiling mount position
    const camDef = CCTV_CAMERAS.find((c) => c.id === moment.camId) || CCTV_CAMERAS[0];
    let camPosX = camDef.pos.x;
    let camPosY = camDef.pos.y;
    let camPosZ = camDef.pos.z;

    if ((moment.useRoomDirectCam || Math.hypot(camPosX - moment.x, camPosZ - moment.z) > 9.5) && moment.roomBounds) {
      const rb = moment.roomBounds;
      const roomCenterX = (rb.x1 + rb.x2) * 0.5;
      const roomCenterZ = (rb.z1 + rb.z2) * 0.5;
      // Step ~4.4m from the crime spot toward the open interior of that zone so no wall blocks it and culprit is close!
      const dirX = moment.x <= roomCenterX ? 1 : -1;
      const dirZ = moment.z <= roomCenterZ ? 1 : -1;
      camPosX = Math.max(rb.x1 + 0.85, Math.min(rb.x2 - 0.85, moment.x + dirX * 3.4));
      camPosZ = Math.max(rb.z1 + 0.85, Math.min(rb.z2 - 0.85, moment.z + dirZ * 3.4));
      camPosY = 2.95;
    }

    // Direction from crime spot toward camera
    const toCamX = camPosX - moment.x;
    const toCamZ = camPosZ - moment.z;
    const toCamLen = Math.hypot(toCamX, toCamZ) || 1;
    const perpX = -toCamZ / toCamLen;
    const perpZ = toCamX / toCamLen;
    const angleToCam = Math.atan2(toCamX, toCamZ);

    let culpritX = moment.x;
    let culpritZ = moment.z;
    let culpritRotY = moment.rotY || 0;
    let simSpeed = 0;
    let simInteracting = false;

    if (loopT < 1.35) {
      // Phase 1: Thief sneaks up to the target
      const u = loopT / 1.35;
      const offset = (1 - u) * 1.15;
      culpritX = moment.x - perpX * offset;
      culpritZ = moment.z - perpZ * offset;
      culpritRotY = Math.atan2(perpX, perpZ);
      simSpeed = 3.6;
    } else if (loopT < 3.15) {
      // Phase 2: Committing the heist / hiding the diamond
      culpritX = moment.x;
      culpritZ = moment.z;
      culpritRotY = angleToCam + Math.PI * 0.72;
      simInteracting = true;
    } else {
      // Phase 3: Startled! Turns directly toward the CCTV lens — caught red-handed!
      const turnU = Math.min(1, (loopT - 3.15) / 0.55);
      const startAng = angleToCam + Math.PI * 0.72;
      culpritX = moment.x;
      culpritZ = moment.z;
      culpritRotY = startAng + (angleToCam - startAng) * turnU;
    }

    if (avatarMesh) {
      avatarMesh.position.set(culpritX, 0, culpritZ);
      avatarMesh.rotation.y = culpritRotY;
      updateHumanoidAnimation(
        avatarMesh,
        {
          speed: simSpeed,
          interacting: simInteracting,
          usingCctv: false,
          hidden: false,
          eliminated: false,
        },
        0.033,
        elapsedSec,
        false
      );
      if (avatarMesh.userData?.rig?.nameplate) {
        avatarMesh.userData.rig.nameplate.visible = false;
      }
    }

    // Smooth PTZ zoom-in onto the culprit
    const zoomFactor = loopT < 1.2 ? 0 : Math.min(1, (loopT - 1.2) / 2.2);
    const fov = 58 - zoomFactor * 21; // Zooms from 58° to 37° (1.6x optical zoom)
    this._replayCam.fov = fov;
    this._replayCam.position.set(camPosX, camPosY, camPosZ);
    this._replayCam.lookAt(culpritX, 1.12, culpritZ);
    this._replayCam.updateProjectionMatrix();
    this._replayCam.updateMatrixWorld();

    // Ensure walls don't block ceiling lens if indoor lights were dimmed during sabotage
    const prevFog = this.scene.fog;
    this.scene.fog = null;
    this.renderer.setRenderTarget(this.cctvRenderTarget);
    this.renderer.render(this.scene, this._replayCam);
    this.renderer.setRenderTarget(null);
    this.scene.fog = prevFog;

    // Project culprit 3D chest/head to 2D canvas coordinates BEFORE restoring avatar
    const projHead = new THREE.Vector3(culpritX, 1.62, culpritZ).project(this._replayCam);
    const projFeet = new THREE.Vector3(culpritX, 0.12, culpritZ).project(this._replayCam);

    // Restore all avatars
    for (const s of savedStates) {
      s.mesh.visible = s.visible;
      s.mesh.position.x = s.x;
      s.mesh.position.z = s.z;
      s.mesh.rotation.y = s.rotY;
      if (s.mesh.userData?.rig?.nameplate) {
        s.mesh.userData.rig.nameplate.visible = s.labelVis;
      }
    }

    // Copy WebGL pixels to 2D canvas with crisp nocturnal CCTV grading
    const width = this.cctvRenderTarget.width;
    const height = this.cctvRenderTarget.height;
    if (!this._pixelBuf || this._pixelBuf.length !== width * height * 4) {
      this._pixelBuf = new Uint8Array(width * height * 4);
      this._offCanvas = document.createElement('canvas');
      this._offCanvas.width = width;
      this._offCanvas.height = height;
      this._offCtx = this._offCanvas.getContext('2d');
      this._imgData = this._offCtx.createImageData(width, height);
    }
    this.renderer.readRenderTargetPixels(this.cctvRenderTarget, 0, 0, width, height, this._pixelBuf);

    const dst = this._imgData.data;
    for (let row = 0; row < height; row++) {
      const srcRow = (height - 1 - row) * width * 4;
      const dstRow = row * width * 4;
      for (let col = 0; col < width * 4; col += 4) {
        const r = this._pixelBuf[srcRow + col];
        const g = this._pixelBuf[srcRow + col + 1];
        const b = this._pixelBuf[srcRow + col + 2];
        dst[dstRow + col] = Math.min(255, r * 0.96 + 10);
        dst[dstRow + col + 1] = Math.min(255, g * 1.06 + 14);
        dst[dstRow + col + 2] = Math.min(255, b * 1.04 + 16);
        dst[dstRow + col + 3] = 255;
      }
    }
    this._offCtx.putImageData(this._imgData, 0, 0);
    ctx.drawImage(this._offCanvas, 0, 0, w, h);

    // Subtle digital scanlines + vignette
    ctx.fillStyle = 'rgba(4, 12, 24, 0.15)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Draw AI Motion/Suspect Tracking Reticle around the Culprit!
    if (projHead.z < 1 && projFeet.z < 1) {
      const cx = (projHead.x * 0.5 + 0.5) * w;
      const topY = (-projHead.y * 0.5 + 0.5) * h - 14;
      const botY = (-projFeet.y * 0.5 + 0.5) * h + 8;
      const boxH = Math.max(70, Math.min(h * 0.72, botY - topY));
      const boxW = boxH * 0.56;
      const bx = cx - boxW / 2;
      const by = topY;

      const locked = loopT >= 1.35;
      const col = locked ? '#f43f5e' : '#38bdf8';

      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;

      // Corner brackets
      const brk = Math.min(18, boxW * 0.28);
      ctx.beginPath();
      ctx.moveTo(bx, by + brk); ctx.lineTo(bx, by); ctx.lineTo(bx + brk, by);
      ctx.moveTo(bx + boxW - brk, by); ctx.lineTo(bx + boxW, by); ctx.lineTo(bx + boxW, by + brk);
      ctx.moveTo(bx, by + boxH - brk); ctx.lineTo(bx, by + boxH); ctx.lineTo(bx + brk, by + boxH);
      ctx.moveTo(bx + boxW - brk, by + boxH); ctx.lineTo(bx + boxW, by + boxH); ctx.lineTo(bx + boxW, by + boxH - brk);
      ctx.stroke();

      // Scanning laser line inside reticle
      const scanY = by + ((elapsedSec * 90) % boxH);
      ctx.fillStyle = locked ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.3)';
      ctx.fillRect(bx + 2, scanY, boxW - 4, 2);

      // Pill tag above suspect's head
      const tagText = locked
        ? `● COLPEVOLE: ${thiefPlayer.name.toUpperCase()}`
        : `ANALISI VOLTO...`;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tagText).width + 16;
      const tx = Math.max(8, Math.min(w - tw - 8, cx - tw / 2));
      const ty = Math.max(40, by - 24);
      ctx.shadowBlur = 0;
      ctx.fillStyle = locked ? 'rgba(225, 29, 72, 0.92)' : 'rgba(14, 165, 233, 0.88)';
      ctx.fillRect(tx, ty, tw, 19);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(tagText, tx + 8, ty + 13.5);
      ctx.restore();
    }

    // DVR Rewind Glitch flash at the end of loop
    if (loopT > loopDuration - 0.16) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(0, (loopT * 900) % h, w, 26);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.fillRect(0, ((loopT * 500) + 80) % h, w, 12);
    }

    // Modern Top Telemetry Bar
    ctx.fillStyle = 'rgba(7, 11, 20, 0.82)';
    ctx.fillRect(0, 0, w, 34);
    if (Math.floor(elapsedSec * 2.5) % 2 === 0) {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(18, 17, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`REPLAY PROVA  ·  ${moment.camCode}`, 30, 21);

    const mins = String(Math.floor((moment.time || 0) / 60)).padStart(2, '0');
    const secs = String(Math.floor((moment.time || 0) % 60)).padStart(2, '0');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`ZOOM ${(58 / fov).toFixed(1)}x  ·  MIN ${mins}:${secs}`, w - 14, 21);

    // Modern Bottom Crime Alert Bar
    ctx.fillStyle = 'rgba(7, 11, 20, 0.88)';
    ctx.fillRect(0, h - 38, w, 38);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(0, h - 38, 4, 38);
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fda4af';
    ctx.fillText(`${moment.crimeTitle}: ${moment.detailLabel}`, 14, h - 14);
  }

  screenToWorldOnGround(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      return { x: hit.x, z: hit.z };
    }
    return null;
  }
}
