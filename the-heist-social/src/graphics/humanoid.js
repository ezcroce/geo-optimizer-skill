import * as THREE from 'three';
import { getSuitFabricBumpMap } from './textures.js';

// Builds an organic tapered limb segment from top (y=0) downward (y=-length)
// using smooth LatheGeometry + elliptical scaling so there are zero hard edges or gaps.
function createLimbGeometry(topRadius, midRadius, bottomRadius, length, scaleX = 1.0, scaleZ = 1.0) {
  const pts = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 at top joint, 1 at bottom joint
    let r;
    if (t < 0.45) {
      const k = t / 0.45;
      // Smooth cosine interpolation from topRadius to midRadius
      r = topRadius + (midRadius - topRadius) * (0.5 - 0.5 * Math.cos(k * Math.PI));
    } else {
      const k = (t - 0.45) / 0.55;
      r = midRadius + (bottomRadius - midRadius) * (0.5 - 0.5 * Math.cos(k * Math.PI));
    }
    pts.push(new THREE.Vector2(r, -t * length));
  }
  const geom = new THREE.LatheGeometry(pts, 20);
  geom.scale(scaleX, 1, scaleZ);
  geom.computeVertexNormals();
  return geom;
}

// Sculpted realistic human head geometry (ovoid cranium + tapered jawline, no abstract shapes)
function createSculptedHeadGeometry() {
  const geom = new THREE.SphereGeometry(0.105, 32, 24);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Human head is taller than wide (~1 : 1.24)
    y *= 1.16;
    x *= 0.90;
    z *= 0.98;

    // Gentle jaw & chin taper below cheekbones
    if (y < 0) {
      const jawFactor = 1.0 - Math.min(0.28, (-y / 0.12) * 0.26);
      x *= jawFactor;
      z *= 0.96;
      // Subtle chin forward projection
      if (z > 0 && y < -0.05) {
        z += 0.008 * (1 - Math.abs(x) / 0.08);
      }
    } else {
      // Slightly fuller back of cranium
      if (z < 0) z *= 1.05;
    }

    pos.setXYZ(i, x, y, z);
  }
  geom.computeVertexNormals();
  return geom;
}

// Continuous anatomical torso + blazer silhouette
function createTorsoGeometry(isFemale) {
  // Profile from pelvis bottom (y = 0.0) up to base of neck/collar (y = 0.56)
  const profile = isFemale
    ? [
        [0.00, 0.00],
        [0.125, 0.03],
        [0.142, 0.10], // Hips
        [0.112, 0.25], // Natural waist taper
        [0.136, 0.40], // Bust / chest
        [0.142, 0.50], // Tailored shoulders
        [0.095, 0.545],
        [0.052, 0.565], // Collar base
      ]
    : [
        [0.00, 0.00],
        [0.128, 0.03],
        [0.136, 0.11], // Pelvis
        [0.128, 0.25], // Tailored waist
        [0.148, 0.41], // Chest
        [0.162, 0.505], // Tailored blazer shoulders
        [0.108, 0.548],
        [0.056, 0.568], // Collar base
      ];

  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geom = new THREE.LatheGeometry(pts, 28);
  // Elliptical human ribcage/pelvis ratio (wider side-to-side than front-to-back)
  geom.scale(1.18, 1.0, 0.76);
  geom.computeVertexNormals();
  return geom;
}

function createHairMesh(style, hairMat, isFemale) {
  const group = new THREE.Group();

  // Base smooth scalp cap covering top, sides & back of cranium seamlessly
  const capGeom = new THREE.SphereGeometry(0.106, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62);
  capGeom.scale(0.93, 1.16, 1.03);
  const cap = new THREE.Mesh(capGeom, hairMat);
  cap.position.set(0, 0.012, -0.008);
  cap.rotation.x = -0.22;
  group.add(cap);

  // Back nape hair blend
  const napeGeom = new THREE.SphereGeometry(0.088, 20, 16);
  napeGeom.scale(0.95, 0.95, 0.72);
  const nape = new THREE.Mesh(napeGeom, hairMat);
  nape.position.set(0, -0.025, -0.048);
  group.add(nape);

  if (style === 'swept' || style === 'parted') {
    const waveGeom = new THREE.SphereGeometry(0.075, 20, 14);
    waveGeom.scale(1.22, 0.42, 0.95);
    const wave = new THREE.Mesh(waveGeom, hairMat);
    wave.position.set(style === 'parted' ? 0.018 : 0, 0.108, 0.025);
    wave.rotation.z = style === 'parted' ? -0.14 : 0.05;
    group.add(wave);
  } else if (style === 'bun') {
    const bunGeom = new THREE.SphereGeometry(0.052, 20, 16);
    bunGeom.scale(1.05, 0.95, 1.05);
    const bun = new THREE.Mesh(bunGeom, hairMat);
    bun.position.set(0, 0.035, -0.118);
    group.add(bun);
  } else if (style === 'bob' || style === 'wavy') {
    const sideLen = style === 'wavy' ? 0.13 : 0.095;
    for (const side of [-1, 1]) {
      const lockGeom = new THREE.SphereGeometry(0.056, 18, 16);
      lockGeom.scale(0.58, sideLen / 0.056, 0.98);
      const lock = new THREE.Mesh(lockGeom, hairMat);
      lock.position.set(side * 0.082, -0.035, -0.01);
      lock.rotation.z = side * -0.08;
      group.add(lock);
    }
    if (style === 'wavy') {
      const backWaveGeom = new THREE.SphereGeometry(0.092, 20, 16);
      backWaveGeom.scale(1.02, 1.35, 0.62);
      const backWave = new THREE.Mesh(backWaveGeom, hairMat);
      backWave.position.set(0, -0.055, -0.068);
      group.add(backWave);
    }
  }

  if (isFemale) {
    // Soft side bangs framing forehead naturally
    const fringeGeom = new THREE.SphereGeometry(0.065, 18, 12);
    fringeGeom.scale(1.25, 0.34, 0.72);
    const fringe = new THREE.Mesh(fringeGeom, hairMat);
    fringe.position.set(0.015, 0.095, 0.052);
    fringe.rotation.z = -0.15;
    group.add(fringe);
  }

  return group;
}

function createNameplateSprite(name, badgeHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  // Sleek dark glass pill
  ctx.fillStyle = 'rgba(10, 13, 20, 0.82)';
  ctx.beginPath();
  ctx.roundRect(36, 16, 440, 64, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Suspect badge dot
  ctx.fillStyle = badgeHex || '#d4af37';
  ctx.beginPath();
  ctx.arc(76, 48, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 28px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 272, 49);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.65, 0.31, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function createRealisticHumanoid(config, showLabel = true) {
  const isFemale = config.gender === 'female';
  const root = new THREE.Group();
  const bodyScale = isFemale ? 0.955 : 1.0;

  // PBR Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: config.skinColor || '#e6bc9c',
    roughness: 0.58,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: config.hairColor || '#241c18',
    roughness: 0.48,
    metalness: 0.08,
  });
  const suitBump = getSuitFabricBumpMap();
  const jacketMat = new THREE.MeshStandardMaterial({
    color: config.jacketColor || '#171c28',
    bumpMap: suitBump,
    bumpScale: 0.008,
    roughness: 0.44,
    metalness: 0.06,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: config.shirtColor || '#f8fafc',
    roughness: 0.5,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: config.trouserColor || '#121620',
    bumpMap: suitBump,
    bumpScale: 0.008,
    roughness: 0.5,
    metalness: 0.04,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: config.accentColor || '#b91c1c',
    roughness: 0.32,
    metalness: 0.18,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: config.shoeColor || '#111113',
    roughness: 0.25,
    metalness: 0.15,
  });

  const characterGroup = new THREE.Group();
  characterGroup.scale.setScalar(bodyScale);
  root.add(characterGroup);

  // Subtle ground contact shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.34, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
  groundShadow.position.y = 0.015;
  root.add(groundShadow);

  // Pelvis / Center-of-Mass Pivot at human hip height y = 0.89m
  const pelvisPivot = new THREE.Group();
  pelvisPivot.position.y = 0.89;
  characterGroup.add(pelvisPivot);

  // Continuous Torso + Jacket
  const torsoMesh = new THREE.Mesh(createTorsoGeometry(isFemale), jacketMat);
  torsoMesh.position.y = -0.02;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  pelvisPivot.add(torsoMesh);

  // Tailored Dress Shirt V-Front & Lapels
  const shirtFrontGeo = new THREE.ConeGeometry(0.072, 0.26, 16);
  shirtFrontGeo.rotateX(Math.PI);
  shirtFrontGeo.scale(1.1, 1.0, 0.32);
  const shirtFront = new THREE.Mesh(shirtFrontGeo, shirtMat);
  shirtFront.position.set(0, 0.41, 0.092);
  pelvisPivot.add(shirtFront);

  // Tie (male) or Gala Necklace/Brooch (female)
  if (isFemale) {
    const necklaceGeo = new THREE.TorusGeometry(0.058, 0.006, 10, 24, Math.PI * 1.1);
    const necklace = new THREE.Mesh(necklaceGeo, accentMat);
    necklace.position.set(0, 0.49, 0.068);
    necklace.rotation.set(Math.PI * 0.62, 0, -0.15);
    pelvisPivot.add(necklace);
  } else {
    const tieGeo = new THREE.BoxGeometry(0.026, 0.21, 0.012);
    const tie = new THREE.Mesh(tieGeo, accentMat);
    tie.position.set(0, 0.39, 0.112);
    pelvisPivot.add(tie);
  }

  // Tailored Lapels + Pocket Square
  for (const side of [-1, 1]) {
    const lapelGeo = new THREE.BoxGeometry(0.032, 0.23, 0.014);
    const lapel = new THREE.Mesh(lapelGeo, jacketMat);
    lapel.position.set(side * 0.052, 0.405, 0.108);
    lapel.rotation.z = side * -0.22;
    pelvisPivot.add(lapel);
  }
  const pocketSq = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.016, 0.012), accentMat);
  pocketSq.position.set(-0.088, 0.395, 0.106);
  pocketSq.rotation.y = -0.25;
  pelvisPivot.add(pocketSq);

  // Neck & Head Pivot at top of torso (y = 0.545 above pelvis -> 1.435m world)
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.545, 0);
  pelvisPivot.add(neckPivot);

  const neckGeo = new THREE.CylinderGeometry(0.046, 0.054, 0.095, 20);
  neckGeo.scale(0.96, 1, 0.92);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.y = 0.04;
  neckPivot.add(neckMesh);

  // Shirt Collar Ring
  const collarGeo = new THREE.TorusGeometry(0.055, 0.012, 10, 24);
  collarGeo.rotateX(Math.PI / 2);
  collarGeo.scale(1.02, 0.95, 1.0);
  const collar = new THREE.Mesh(collarGeo, shirtMat);
  collar.position.y = 0.012;
  neckPivot.add(collar);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.145;
  neckPivot.add(headPivot);

  const headMesh = new THREE.Mesh(createSculptedHeadGeometry(), skinMat);
  headMesh.castShadow = true;
  headPivot.add(headMesh);

  // Subtle realistic ears
  for (const side of [-1, 1]) {
    const earGeo = new THREE.SphereGeometry(0.021, 12, 12);
    earGeo.scale(0.45, 1.15, 0.72);
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * 0.093, -0.005, -0.006);
    headPivot.add(ear);
  }

  // Sculpted nose bridge
  const noseGeo = new THREE.ConeGeometry(0.013, 0.036, 12);
  noseGeo.scale(0.85, 1.0, 1.15);
  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, -0.008, 0.102);
  nose.rotation.x = 0.25;
  headPivot.add(nose);

  // Calm human eyes + eyebrows + natural lips
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xfafafa });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1b2028 });
  const lipMat = new THREE.MeshStandardMaterial({
    color: isFemale ? '#b56565' : '#bf8474',
    roughness: 0.45,
  });

  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), scleraMat);
    eyeWhite.scale.set(1.18, 0.78, 0.55);
    eyeWhite.position.set(side * 0.035, 0.016, 0.092);
    headPivot.add(eyeWhite);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 10), pupilMat);
    iris.scale.set(1.0, 1.0, 0.5);
    iris.position.set(side * 0.035, 0.016, 0.098);
    headPivot.add(iris);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.0055, 0.008), hairMat);
    brow.position.set(side * 0.036, 0.033, 0.094);
    brow.rotation.z = side * (isFemale ? 0.06 : -0.04);
    headPivot.add(brow);
  }

  const lips = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), lipMat);
  lips.scale.set(1.35, 0.36, 0.5);
  lips.position.set(0, -0.044, 0.094);
  headPivot.add(lips);

  // Styled Realistic Hair
  const hairGroup = createHairMesh(config.hairStyle || 'swept', hairMat, isFemale);
  headPivot.add(hairGroup);

  // Seamless Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Cuff -> Hand)
  const shoulderOffsetX = isFemale ? 0.168 : 0.192;
  const upperArmLen = 0.27;
  const forearmLen = 0.24;

  function buildArm(side) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * shoulderOffsetX, 0.475, 0);
    pelvisPivot.add(shoulderPivot);

    // Seamless spherical shoulder cap matching sleeve radius
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 14), jacketMat);
    shoulderCap.scale.set(0.96, 1.04, 0.96);
    shoulderPivot.add(shoulderCap);

    const upperArmGeo = createLimbGeometry(0.051, 0.046, 0.041, upperArmLen, 0.96, 0.96);
    const upperArm = new THREE.Mesh(upperArmGeo, jacketMat);
    upperArm.castShadow = true;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.y = -upperArmLen;
    shoulderPivot.add(elbowPivot);

    // Seamless spherical elbow cap
    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.0405, 14, 12), jacketMat);
    elbowPivot.add(elbowCap);

    const forearmGeo = createLimbGeometry(0.0405, 0.037, 0.031, forearmLen, 0.96, 0.95);
    const forearm = new THREE.Mesh(forearmGeo, jacketMat);
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    // Crisp shirt cuff at wrist
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.0315, 0.031, 0.024, 16), shirtMat);
    cuff.position.y = -forearmLen + 0.004;
    elbowPivot.add(cuff);

    // Proportioned human hand (palm + thumb contour, zero stretching)
    const handGroup = new THREE.Group();
    handGroup.position.y = -forearmLen - 0.01;
    elbowPivot.add(handGroup);

    const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), skinMat);
    handGroup.add(wristCap);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), skinMat);
    palm.scale.set(0.62, 1.38, 0.88);
    palm.position.set(0, -0.042, 0.004);
    handGroup.add(palm);

    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), skinMat);
    thumb.scale.set(0.7, 1.45, 0.8);
    thumb.position.set(side * -0.015, -0.032, 0.026);
    thumb.rotation.x = 0.35;
    handGroup.add(thumb);

    return { shoulderPivot, elbowPivot, handGroup };
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Optional Sleek Security Tablet attached to right hand (shown when using CCTV!)
  const tabletMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.012, 0.13),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.55,
      roughness: 0.2,
    })
  );
  tabletMesh.position.set(-0.04, -0.065, 0.07);
  tabletMesh.rotation.set(0.3, 0.2, 0);
  tabletMesh.visible = false;
  rightArm.handGroup.add(tabletMesh);

  // Seamless Articulated Legs (Hip -> Thigh -> Knee -> Calf -> Sculpted Dress Shoe)
  const hipOffsetX = isFemale ? 0.088 : 0.096;
  const thighLen = 0.41;
  const calfLen = 0.40;

  function buildLeg(side) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * hipOffsetX, 0.0, 0);
    pelvisPivot.add(hipPivot);

    // Seamless spherical hip joint inside pelvis seat
    const hipCap = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 14), trouserMat);
    hipPivot.add(hipCap);

    const thighGeo = createLimbGeometry(0.076, 0.068, 0.056, thighLen, 0.98, 1.02);
    const thigh = new THREE.Mesh(thighGeo, trouserMat);
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -thighLen;
    hipPivot.add(kneePivot);

    // Seamless spherical kneecap matching thigh bottom & calf top
    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.0555, 16, 14), trouserMat);
    kneePivot.add(kneeCap);

    const calfGeo = createLimbGeometry(0.0555, 0.053, 0.041, calfLen, 0.96, 1.0);
    const calf = new THREE.Mesh(calfGeo, trouserMat);
    calf.castShadow = true;
    kneePivot.add(calf);

    // Sculpted Leather Dress Shoe (ankle at -calfLen = -0.40 -> sole touches y=0 world!)
    const footGroup = new THREE.Group();
    footGroup.position.y = -calfLen;
    kneePivot.add(footGroup);

    const ankleSock = new THREE.Mesh(new THREE.SphereGeometry(0.039, 12, 10), shoeMat);
    ankleSock.position.y = -0.015;
    footGroup.add(ankleSock);

    const shoeBody = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 14), shoeMat);
    shoeBody.scale.set(0.86, 0.68, 2.05);
    shoeBody.position.set(0, -0.048, 0.042);
    shoeBody.castShadow = true;
    footGroup.add(shoeBody);

    return { hipPivot, kneePivot, footGroup };
  }

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  let nameplate = null;
  if (showLabel) {
    nameplate = createNameplateSprite(config.name, config.badgeHex);
    nameplate.position.y = 1.98 * bodyScale;
    root.add(nameplate);
  }

  // Selection / Local Player subtle golden floor ring
  const ringGeo = new THREE.RingGeometry(0.37, 0.43, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
  });
  const localRing = new THREE.Mesh(ringGeo, ringMat);
  localRing.position.y = 0.022;
  root.add(localRing);

  root.userData.rig = {
    characterGroup,
    pelvisPivot,
    neckPivot,
    headPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tabletMesh,
    nameplate,
    localRing,
    groundShadow,
    bodyScale,
    walkPhase: Math.random() * Math.PI * 2,
    walkBlend: 0,
    materials: [skinMat, hairMat, jacketMat, shirtMat, trouserMat, accentMat, shoeMat, scleraMat, pupilMat, lipMat],
  };

  return root;
}

export function updateHumanoidAnimation(mesh, state, dt, time, isLocalPlayer = false) {
  const rig = mesh.userData.rig;
  if (!rig) return;

  const speed = state.speed || 0;
  const moving = speed > 0.15;
  rig.walkBlend += ((moving ? 1 : 0) - rig.walkBlend) * (1 - Math.exp(-9 * dt));
  const interacting = Boolean(state.interacting);
  const usingTablet = Boolean(state.usingCctv);
  const hidden = Boolean(state.hidden);

  // Local player ring visibility
  rig.localRing.material.opacity = isLocalPlayer && !hidden ? 0.65 + 0.2 * Math.sin(time * 3.0) : 0.0;

  // Brief expulsion animation before removing the avatar from the scene.
  if (state.eliminated) {
    rig.expelledElapsed = (rig.expelledElapsed || 0) + dt;
    const progress = Math.min(1, rig.expelledElapsed / 1.1);
    mesh.visible = progress < 1;
    rig.pelvisPivot.rotation.z = progress * 0.9;
    rig.leftArm.shoulderPivot.rotation.x = -progress * 0.6;
    rig.rightArm.shoulderPivot.rotation.x = -progress * 0.6;
    for (const material of rig.materials) {
      material.transparent = true;
      material.opacity = 1 - progress;
    }
    if (rig.nameplate) rig.nameplate.visible = false;
    rig.localRing.material.opacity = 0;
    return;
  }
  rig.expelledElapsed = 0;
  rig.pelvisPivot.rotation.z = 0;

  // Concealment in Hiding Spots
  if (hidden) {
    if (isLocalPlayer) {
      mesh.visible = true;
      for (const m of rig.materials) {
        m.transparent = true;
        m.opacity = 0.42;
      }
      if (rig.nameplate) rig.nameplate.visible = false;
    } else {
      mesh.visible = false;
      return;
    }
  } else {
    mesh.visible = !state.eliminated;
    for (const m of rig.materials) {
      if (m.opacity !== 1) {
        m.opacity = 1;
        m.transparent = false;
      }
    }
    if (rig.nameplate) rig.nameplate.visible = true;
  }

  rig.tabletMesh.visible = usingTablet;

  if (moving) {
    const cadence = Math.min(11.5, 4.8 + speed * 1.15);
    rig.walkPhase += dt * cadence;
    const p = rig.walkPhase;
    const stride = Math.min(0.70, 0.22 + speed * 0.065) * rig.walkBlend;

    // Smooth vertical pelvis bounce (2x per stride cycle) & natural counter-rotation
    rig.pelvisPivot.position.y = (hidden ? 0.68 : 0.89) + Math.abs(Math.sin(p)) * 0.026;
    rig.pelvisPivot.rotation.y = Math.sin(p) * 0.065;
    // Distinct furtive walk and stronger forward lean when sprinting.
    rig.pelvisPivot.rotation.x = speed > 5 ? 0.18 : 0.09;

    // Legs: hip swing + anatomically accurate backward-only knee flexion
    const lHip = Math.sin(p) * stride;
    const rHip = Math.sin(p + Math.PI) * stride;
    rig.leftLeg.hipPivot.rotation.x = -lHip;
    rig.rightLeg.hipPivot.rotation.x = -rHip;

    rig.leftLeg.kneePivot.rotation.x = Math.max(0, -Math.cos(p) * stride * 1.35 + 0.14);
    rig.rightLeg.kneePivot.rotation.x = Math.max(0, -Math.cos(p + Math.PI) * stride * 1.35 + 0.14);

    // Foot ankle compensation so soles stay level near ground
    rig.leftLeg.footGroup.rotation.x = lHip * 0.35 - rig.leftLeg.kneePivot.rotation.x * 0.45;
    rig.rightLeg.footGroup.rotation.x = rHip * 0.35 - rig.rightLeg.kneePivot.rotation.x * 0.45;

    // Natural opposite arm swing with relaxed human elbow bend
    rig.leftArm.shoulderPivot.rotation.x = lHip * 0.72;
    rig.leftArm.shoulderPivot.rotation.z = -0.05;
    rig.leftArm.elbowPivot.rotation.x = -0.22 - Math.max(0, lHip) * 0.32;

    if (usingTablet) {
      rig.rightArm.shoulderPivot.rotation.x = -0.62;
      rig.rightArm.shoulderPivot.rotation.z = -0.14;
      rig.rightArm.elbowPivot.rotation.x = -1.05;
    } else {
      rig.rightArm.shoulderPivot.rotation.x = rHip * 0.72;
      rig.rightArm.shoulderPivot.rotation.z = 0.05;
      rig.rightArm.elbowPivot.rotation.x = -0.22 - Math.max(0, rHip) * 0.32;
    }

    rig.headPivot.rotation.y *= 0.88;
    rig.headPivot.rotation.x = -0.02;
  } else {
    // Calm human idle breathing + subtle weight shift
    const breath = Math.sin(time * 2.1 + rig.walkPhase);
    rig.pelvisPivot.position.y = (hidden ? 0.65 : 0.89) + breath * 0.006;
    rig.pelvisPivot.rotation.y *= 0.88;
    rig.pelvisPivot.rotation.x = hidden ? 0.22 : 0.0;

    rig.leftLeg.hipPivot.rotation.x *= 0.82;
    rig.rightLeg.hipPivot.rotation.x *= 0.82;
    rig.leftLeg.kneePivot.rotation.x = hidden ? 0.45 : rig.leftLeg.kneePivot.rotation.x * 0.82;
    rig.rightLeg.kneePivot.rotation.x = hidden ? 0.45 : rig.rightLeg.kneePivot.rotation.x * 0.82;
    rig.leftLeg.footGroup.rotation.x *= 0.82;
    rig.rightLeg.footGroup.rotation.x *= 0.82;

    if (interacting) {
      // Natural working / inspecting / lockpicking gesture with both hands
      rig.rightArm.shoulderPivot.rotation.x = -0.75 + Math.sin(time * 8) * 0.08;
      rig.rightArm.elbowPivot.rotation.x = -0.85 + Math.cos(time * 8) * 0.12;
      rig.leftArm.shoulderPivot.rotation.x = -0.58;
      rig.leftArm.elbowPivot.rotation.x = -0.78;
      rig.headPivot.rotation.x = 0.18;
    } else if (usingTablet) {
      rig.rightArm.shoulderPivot.rotation.x = -0.65;
      rig.rightArm.shoulderPivot.rotation.z = -0.15;
      rig.rightArm.elbowPivot.rotation.x = -1.1;
      rig.leftArm.shoulderPivot.rotation.x = -0.52;
      rig.leftArm.shoulderPivot.rotation.z = 0.15;
      rig.leftArm.elbowPivot.rotation.x = -0.95;
      rig.headPivot.rotation.x = 0.24;
    } else {
      // Relaxed tailored posture
      rig.leftArm.shoulderPivot.rotation.x *= 0.85;
      rig.leftArm.shoulderPivot.rotation.z = -0.055 - breath * 0.01;
      rig.leftArm.elbowPivot.rotation.x = -0.14;

      rig.rightArm.shoulderPivot.rotation.x *= 0.85;
      rig.rightArm.shoulderPivot.rotation.z = 0.055 + breath * 0.01;
      rig.rightArm.elbowPivot.rotation.x = -0.14;

      rig.headPivot.rotation.y = Math.sin(time * 0.65 + rig.walkPhase) * 0.14;
      rig.headPivot.rotation.x = breath * 0.02;
    }
  }
}

// Generates a studio-lit 3D bust portrait PNG DataURL for Dossier / Meeting Cards
let portraitRenderer = null;
const portraitCache = new Map();

export function renderCharacterPortrait(config) {
  const key = `${config.id}_${config.jacketColor}_${config.hairColor}`;
  if (portraitCache.has(key)) return portraitCache.get(key);

  try {
    if (!portraitRenderer) {
      portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      portraitRenderer.setSize(180, 180);
      portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
      portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      portraitRenderer.toneMappingExposure = 1.15;
    }

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 10);
    const scale = config.gender === 'female' ? 0.955 : 1.0;
    cam.position.set(0.18, 1.50 * scale, 0.82);
    cam.lookAt(0, 1.46 * scale, 0);

    const amb = new THREE.AmbientLight(0xfff5eb, 1.15);
    const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.8);
    keyLight.position.set(1.2, 2.4, 1.8);
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.9);
    rim.position.set(-1.4, 1.8, -1.2);
    scene.add(amb, keyLight, rim);

    const avatar = createRealisticHumanoid(config, false);
    scene.add(avatar);

    portraitRenderer.render(scene, cam);
    const url = portraitRenderer.domElement.toDataURL('image/png');
    portraitCache.set(key, url);
    return url;
  } catch {
    return '';
  }
}
