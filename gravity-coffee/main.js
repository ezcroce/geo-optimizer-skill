import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ============ DATA ============ */
const INGREDIENTS = [
  { id:'stelle',  name:'Polvere di Stelle', emoji:'✨', color:0xffd166, css:'#ffd166' },
  { id:'nebula',  name:'Nebulosa Rosa',     emoji:'🌸', color:0xff6ec7, css:'#ff6ec7' },
  { id:'quantico',name:'Caffè Quantico',    emoji:'⚛️', color:0x8b5cf6, css:'#8b5cf6' },
  { id:'plasma',  name:'Plasma Blu',        emoji:'🔵', color:0x38bdf8, css:'#38bdf8' },
  { id:'lunare',  name:'Essenza Lunare',    emoji:'🌙', color:0xe2e8f0, css:'#e2e8f0' },
  { id:'spori',   name:'Spori Magici',      emoji:'🍄', color:0x4ade80, css:'#4ade80' },
];
const RECIPES = [
  { name:'Espresso Orbitale',   ing:['quantico','stelle'],            price:30, color:0x8b5cf6 },
  { name:'Latte Nebulosa',      ing:['nebula','lunare'],              price:35, color:0xff6ec7 },
  { name:'Mocha Supernova',     ing:['quantico','plasma','stelle'],   price:55, color:0x38bdf8 },
  { name:'Cappuccino Lunare',   ing:['quantico','lunare'],            price:40, color:0xe2e8f0 },
  { name:'Infuso Spori',        ing:['spori','nebula'],               price:45, color:0x4ade80 },
  { name:'Nebulosa Quantica',   ing:['nebula','quantico','plasma'],   price:60, color:0xc084fc },
  { name:'Stella Cadente',      ing:['stelle','lunare','spori'],      price:65, color:0xffd166 },
  { name:'Plasma Puro',         ing:['plasma'],                       price:25, color:0x38bdf8 },
];
const CUSTOMER_TYPES = [
  { name:'Gorgone',  color:0x34d399, shape:'blob' },
  { name:'Xenomorph',color:0xa78bfa, shape:'tall' },
  { name:'Blob',     color:0xfbbf24, shape:'blob' },
  { name:'Tentacoli',color:0xf472b6, shape:'tent' },
  { name:'Cristallo',color:0x67e8f9, shape:'crystal' },
  { name:'Drago',    color:0xfb923c, shape:'tall' },
];
const $ = id => document.getElementById(id);

/* ============ STATE ============ */
const S = {
  started:false, credits:0, rep:3.0, day:1, served:0, combo:0, bestCombo:0,
  barista:'alien', anchored:true, sound:true,
  selected:[], brewing:false, timing:null, readyDrink:null,
  orders:[], orderTimer:0, goal:5, goalDone:false,
  upgrades:{ patience:1, speed:1, tips:1 },
};
const BARISTA_STATS = {
  alien:     { label:'👽 Alieno',    timingWidth:0.30, tipMul:1.0,  speedMul:1.0 },
  astronaut: { label:'🧑‍🚀 Astronauta', timingWidth:0.20, tipMul:1.25, speedMul:1.15 },
};

/* ============ AUDIO (procedural) ============ */
let AC=null;
function beep(freq=660,dur=0.12,type='sine',vol=0.15){
  if(!S.sound) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(), g=AC.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol,AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+dur);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime+dur);
  }catch(e){}
}
const sfx = {
  click:()=>beep(880,.07,'sine',.1),
  add:()=>{beep(660,.08); setTimeout(()=>beep(990,.08),60);},
  brew:()=>{beep(440,.2,'sawtooth',.08); setTimeout(()=>beep(550,.2,'sawtooth',.08),150);},
  perfect:()=>{[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.15),i*70));},
  good:()=>{beep(784,.12); setTimeout(()=>beep(988,.12),80);},
  miss:()=>beep(220,.25,'sawtooth',.12),
  serve:()=>{[659,784,988].forEach((f,i)=>setTimeout(()=>beep(f,.12),i*60));},
  angry:()=>beep(180,.4,'sawtooth',.15),
  day:()=>{[523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,.18),i*90));},
};

/* ============ THREE SETUP ============ */
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x0a0a2a, 0.028);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.1, 300);
camera.position.set(0, 4.2, 11);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.6, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI*0.62;
controls.minDistance = 5; controls.maxDistance = 20;
controls.autoRotate = true; controls.autoRotateSpeed = 0.4;
let idleTimer=0;
controls.addEventListener('start',()=>{ controls.autoRotate=false; idleTimer=0; });

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.AmbientLight(0x8899ff, 0.5));
const sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
sun.position.set(8,12,6); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-12; sun.shadow.camera.right=12;
sun.shadow.camera.top=12; sun.shadow.camera.bottom=-12;
scene.add(sun);
const cyanLight = new THREE.PointLight(0x22d3ee, 30, 25); cyanLight.position.set(-5,4,3); scene.add(cyanLight);
const magentaLight = new THREE.PointLight(0xd946ef, 25, 25); magentaLight.position.set(5,3.5,2); scene.add(magentaLight);
const warmLight = new THREE.PointLight(0xffb86b, 18, 18); warmLight.position.set(0,3.2,-2); scene.add(warmLight);

/* ============ MATERIALS (PBR) ============ */
const M = {
  hull:   new THREE.MeshStandardMaterial({ color:0x9aa7c7, metalness:0.85, roughness:0.32 }),
  hullDark:new THREE.MeshStandardMaterial({ color:0x3a4266, metalness:0.8, roughness:0.45 }),
  floor:  new THREE.MeshStandardMaterial({ color:0x232946, metalness:0.6, roughness:0.5 }),
  counter:new THREE.MeshPhysicalMaterial({ color:0x1e2a5a, metalness:0.3, roughness:0.25, clearcoat:0.8, clearcoatRoughness:0.2 }),
  glass:  new THREE.MeshPhysicalMaterial({ color:0xbfefff, metalness:0, roughness:0.05, transmission:0.6, transparent:true, opacity:0.35 }),
  emissiveCyan: new THREE.MeshStandardMaterial({ color:0x0b2a3a, emissive:0x22d3ee, emissiveIntensity:2.2 }),
  emissivePink: new THREE.MeshStandardMaterial({ color:0x2a0b2a, emissive:0xd946ef, emissiveIntensity:2.0 }),
  emissiveGold: new THREE.MeshStandardMaterial({ color:0x2a1f05, emissive:0xffb86b, emissiveIntensity:1.8 }),
  whiteSuit: new THREE.MeshStandardMaterial({ color:0xf1f5f9, metalness:0.15, roughness:0.45 }),
  suitAccent:new THREE.MeshStandardMaterial({ color:0xef4444, metalness:0.3, roughness:0.4 }),
  visor:  new THREE.MeshPhysicalMaterial({ color:0x111827, metalness:1, roughness:0.06, envMapIntensity:2.5 }),
  rubber: new THREE.MeshStandardMaterial({ color:0x1f2937, metalness:0.1, roughness:0.85 }),
  metal:  new THREE.MeshStandardMaterial({ color:0xd1d5db, metalness:0.95, roughness:0.22 }),
  cup:    new THREE.MeshPhysicalMaterial({ color:0xf8fafc, metalness:0.1, roughness:0.2, clearcoat:1 }),
};
function alienSkin(color){
  const m = new THREE.MeshPhysicalMaterial({
    color, metalness:0.05, roughness:0.32, clearcoat:0.6, clearcoatRoughness:0.35,
    emissive:color, emissiveIntensity:0.12, sheen:0.6, sheenColor:new THREE.Color(0xffffff),
  });
  // Subsurface-scattering fake: wrap lighting + fresnel rim
  m.onBeforeCompile = sh=>{
    sh.uniforms.uRimColor = { value:new THREE.Color(0x9ff5ff) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vNrm; varying vec3 vView;\n')
      .replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvNrm = normalize(normalMatrix * normal);\nvView = normalize(-mvPosition.xyz);\n');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vNrm; varying vec3 vView; uniform vec3 uRimColor;\n')
      .replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rim = pow(1.0 - abs(dot(normalize(vNrm), normalize(vView))), 2.5);
       totalEmissiveRadiance += uRimColor * rim * 0.55;
       float wrap = clamp(dot(normalize(vNrm), vec3(0.4,0.8,0.3))*0.5+0.5, 0.0, 1.0);
       totalEmissiveRadiance += diffuseColor.rgb * wrap * 0.10;`);
  };
  return m;
}

/* ============ BUILD: STATION ============ */
const floaters = []; // {obj, baseY, amp, speed, phase}
function addFloat(obj, amp=0.15, speed=1){
  floaters.push({ obj, baseY:obj.position.y, amp, speed, phase:Math.random()*Math.PI*2 });
}
function buildStation(){
  const g = new THREE.Group();
  // Floor disc
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(11,11,0.5,64), M.floor);
  floor.position.y=-0.25; floor.receiveShadow=true; g.add(floor);
  // Floor emissive rings
  for(let i=0;i<3;i++){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2+i*2.4, 0.05, 8, 80), i%2?M.emissivePink:M.emissiveCyan);
    ring.rotation.x=Math.PI/2; ring.position.y=0.02; g.add(ring);
  }
  // Back wall arc + pillars
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(10.5,10.5,7,48,1,true,Math.PI*0.15,Math.PI*0.7), M.hullDark);
  wall.position.y=3.5; wall.material.side=THREE.DoubleSide; g.add(wall);
  for(let i=0;i<6;i++){
    const a = Math.PI*0.2 + i*(Math.PI*0.6/5);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,7,16), M.hull);
    p.position.set(Math.cos(a)*10.2, 3.5, Math.sin(a)*10.2); p.castShadow=true; g.add(p);
  }
  // Big window (glass) + planet + stars outside
  const win = new THREE.Mesh(new THREE.CylinderGeometry(10.4,10.4,3.2,48,1,true,Math.PI*0.55,Math.PI*0.5), M.glass);
  win.position.y=4.2; win.material.side=THREE.DoubleSide; g.add(win);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(6,48,48),
    new THREE.MeshStandardMaterial({ color:0x7c3aed, roughness:0.7, emissive:0x2e1065, emissiveIntensity:0.5 }));
  planet.position.set(-16,6,-22); g.add(planet);
  const planetRing = new THREE.Mesh(new THREE.TorusGeometry(8.5,0.35,8,80),
    new THREE.MeshStandardMaterial({ color:0x67e8f9, emissive:0x155e75, emissiveIntensity:0.8, transparent:true, opacity:0.7 }));
  planetRing.position.copy(planet.position); planetRing.rotation.x=Math.PI/2.4; g.add(planetRing);
  // Stars (Points)
  const starGeo = new THREE.BufferGeometry();
  const sp=[]; for(let i=0;i<900;i++){ const r=60+Math.random()*60, th=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
    sp.push(r*Math.sin(ph)*Math.cos(th), Math.abs(r*Math.cos(ph))*0.6-5, r*Math.sin(ph)*Math.sin(th)); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color:0xffffff, size:0.35, sizeAttenuation:true }));
  g.add(stars);
  // Ceiling ring + hanging lights
  const ceil = new THREE.Mesh(new THREE.TorusGeometry(6,0.3,12,60), M.hull);
  ceil.rotation.x=Math.PI/2; ceil.position.y=6.5; g.add(ceil);
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22,20,20), i%2?M.emissivePink:M.emissiveCyan);
    lamp.position.set(Math.cos(a)*6, 6.2, Math.sin(a)*6); g.add(lamp);
  }
  scene.add(g);
  return { planet, planetRing, stars };
}
const sky = buildStation();

/* Counter + machine + shelves */
const counterGroup = new THREE.Group(); scene.add(counterGroup);
let machineGroup, cupGroup, liquidMesh, steamPoints;
function buildCounter(){
  const c = new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.7,1.1,48), M.counter);
  c.position.y=0.55; c.castShadow=true; c.receiveShadow=true; counterGroup.add(c);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(3.55,3.55,0.14,48), M.metal);
  top.position.y=1.17; top.castShadow=true; counterGroup.add(top);
  // emissive strip
  const strip = new THREE.Mesh(new THREE.TorusGeometry(3.45,0.06,8,64), M.emissiveCyan);
  strip.rotation.x=Math.PI/2; strip.position.y=1.05; counterGroup.add(strip);
  // Back shelf with jars
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.4,0.12,0.7), M.hullDark);
  shelf.position.set(0,2.6,-2.6); shelf.castShadow=true; counterGroup.add(shelf);
  const shelf2 = shelf.clone(); shelf2.position.y=3.4; counterGroup.add(shelf2);
  // Coffee machine (futuristic)
  machineGroup = new THREE.Group(); machineGroup.position.set(-1.6,1.24,-1.2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,0.9), M.hull);
  body.position.y=0.55; body.castShadow=true; machineGroup.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55,32,24,0,Math.PI*2,0,Math.PI/2), M.glass);
  dome.position.set(0,1.1,0); machineGroup.add(dome);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.13,0.5,16), M.metal);
  nozzle.position.set(0,0.55,0.55); machineGroup.add(nozzle);
  const bean = new THREE.Mesh(new THREE.SphereGeometry(0.32,24,24),
    new THREE.MeshStandardMaterial({ color:0x3b2314, roughness:0.4, emissive:0x1a0d05, emissiveIntensity:0.6 }));
  bean.position.set(0,1.35,0); machineGroup.add(bean);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09,16,16), M.emissiveGold);
  eye.position.set(0,0.85,0.46); machineGroup.add(eye);
  counterGroup.add(machineGroup);
  // Cup on counter
  cupGroup = new THREE.Group(); cupGroup.position.set(0.9,1.24,0.4);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.26,0.42,32,1,true), M.cup);
  cup.position.y=0.21; cup.castShadow=true; cupGroup.add(cup);
  const cupBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,0.05,32), M.cup);
  cupBottom.position.y=0.03; cupGroup.add(cupBottom);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.045,10,24,Math.PI), M.cup);
  handle.position.set(0.36,0.22,0); handle.rotation.z=-Math.PI/2; cupGroup.add(handle);
  liquidMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3,24,24),
    new THREE.MeshPhysicalMaterial({ color:0x3b2314, roughness:0.15, clearcoat:1, emissive:0x1a0d05, emissiveIntensity:0.4 }));
  liquidMesh.scale.set(1,0.35,1); liquidMesh.position.y=0.36; liquidMesh.visible=false; cupGroup.add(liquidMesh);
  counterGroup.add(cupGroup);
  addFloat(cupGroup, 0.06, 0.8);
  // Steam / magic particles above cup
  const sg = new THREE.BufferGeometry(); const sp=[];
  for(let i=0;i<60;i++) sp.push((Math.random()-0.5)*0.5, Math.random()*1.2, (Math.random()-0.5)*0.5);
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  steamPoints = new THREE.Points(sg, new THREE.PointsMaterial({ color:0x9ff5ff, size:0.07, transparent:true, opacity:0.7 }));
  steamPoints.position.set(0.9,1.7,0.4); counterGroup.add(steamPoints);
}
buildCounter();

/* Ingredient jars (3D clickable) */
const jarMeshes = {};
function buildJars(){
  INGREDIENTS.forEach((ing,i)=>{
    const j = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.55,24,1,true), M.glass);
    glass.position.y=0.28; j.add(glass);
    const powder = new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.4,24),
      new THREE.MeshStandardMaterial({ color:ing.color, emissive:ing.color, emissiveIntensity:0.55, roughness:0.5 }));
    powder.position.y=0.2; j.add(powder);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.1,24), M.metal);
    lid.position.y=0.6; j.add(lid);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12,20,20),
      new THREE.MeshStandardMaterial({ color:ing.color, emissive:ing.color, emissiveIntensity:2.5 }));
    orb.position.y=0.85; j.add(orb);
    const x = -2.2 + (i%3)*1.1, y = i<3 ? 2.66 : 3.46;
    j.position.set(x, y, -2.6);
    j.userData.ingredient = ing.id;
    j.traverse(o=>o.userData.jarRoot=j);
    scene.add(j); jarMeshes[ing.id]=j;
    addFloat(j, 0.08, 1.1);
  });
}
buildJars();

/* Cosmic runes / holograms */
const runes = [];
function buildRunes(){
  const runeChars = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ'];
  runeChars.forEach((ch,i)=>{
    const c = document.createElement('canvas'); c.width=c.height=128;
    const ctx = c.getContext('2d');
    ctx.font='90px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='#22d3ee'; ctx.shadowBlur=18; ctx.fillStyle='#a5f3fc';
    ctx.fillText(ch,64,70);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:0.85, depthWrite:false }));
    const a = i/runeChars.length*Math.PI*2;
    spr.position.set(Math.cos(a)*4.6, 2.2+Math.sin(i*2.3)*0.7, Math.sin(a)*4.6);
    spr.scale.set(0.55,0.55,1);
    scene.add(spr); runes.push({ spr, a, r:4.6, y:spr.position.y, speed:0.12+Math.random()*0.1 });
  });
  // Hologram menu board
  const c = document.createElement('canvas'); c.width=512; c.height=256;
  const ctx = c.getContext('2d');
  ctx.fillStyle='rgba(6,20,50,0.85)'; ctx.fillRect(0,0,512,256);
  ctx.strokeStyle='#22d3ee'; ctx.lineWidth=4; ctx.strokeRect(6,6,500,244);
  ctx.fillStyle='#a5f3fc'; ctx.font='bold 34px sans-serif'; ctx.textAlign='center';
  ctx.fillText('☕ GRAVITY COFFEE ☕',256,55);
  ctx.font='24px sans-serif'; ctx.fillStyle='#e0f2fe';
  ctx.fillText('Espresso Orbitale · Latte Nebulosa',256,105);
  ctx.fillText('Mocha Supernova · Infuso Spori',256,145);
  ctx.fillText('★ Zero-G · Magia · Caffè ★',256,195);
  const tex = new THREE.CanvasTexture(c);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:0.92, side:THREE.DoubleSide }));
  board.position.set(0,4.6,-4.5); scene.add(board);
  runes.push({ spr:board, a:0, r:0, y:4.6, speed:0, isBoard:true });
}
buildRunes();

/* Floating coffee spheres + sparks */
let coffeeSpheres, sparks;
function buildParticles(){
  // Coffee spheres floating (zero-G liquid)
  const cg = new THREE.BufferGeometry(); const cp=[];
  for(let i=0;i<40;i++) cp.push((Math.random()-0.5)*10, 1+Math.random()*4, (Math.random()-0.5)*8);
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp,3));
  coffeeSpheres = new THREE.Points(cg, new THREE.PointsMaterial({ color:0xffb86b, size:0.14, transparent:true, opacity:0.85 }));
  scene.add(coffeeSpheres);
  // Iridescent sparks
  const sg = new THREE.BufferGeometry(); const sp=[];
  for(let i=0;i<250;i++) sp.push((Math.random()-0.5)*14, Math.random()*6, (Math.random()-0.5)*14);
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color:0xc084fc, size:0.08, transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false }));
  scene.add(sparks);
}
buildParticles();

/* ============ BARISTAS ============ */
function buildAlien(){
  const g = new THREE.Group();
  const skin = alienSkin(0x2dd4bf);
  // Body: lathe for organic curves
  const pts=[]; for(let i=0;i<=20;i++){ const t=i/20; pts.push(new THREE.Vector2(0.42*Math.sin(t*Math.PI*0.85)+0.08, t*1.15)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), skin);
  body.castShadow=true; g.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42,48,48), skin);
  head.scale.set(1,1.15,0.95); head.position.y=1.55; head.castShadow=true; g.add(head);
  // Eyes (big, expressive)
  const eyeMat = new THREE.MeshPhysicalMaterial({ color:0x0f172a, roughness:0.05, metalness:0.2, clearcoat:1, emissive:0x0ea5e9, emissiveIntensity:0.35 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.13,24,24), eyeMat); eL.position.set(-0.16,1.62,0.34); g.add(eL);
  const eR = eL.clone(); eR.position.x=0.16; g.add(eR);
  const hL = new THREE.Mesh(new THREE.SphereGeometry(0.05,16,16), new THREE.MeshBasicMaterial({ color:0xffffff }));
  hL.position.set(-0.13,1.66,0.44); g.add(hL);
  const hR = hL.clone(); hR.position.x=0.19; g.add(hR);
  // Antennae
  const antMat = new THREE.MeshStandardMaterial({ color:0x2dd4bf, emissive:0x0d9488, emissiveIntensity:0.5, roughness:0.4 });
  [-0.18,0.18].forEach(x=>{
    const curve = new THREE.CatmullRomCurve3([ new THREE.Vector3(x,1.9,0), new THREE.Vector3(x*1.6,2.25,0), new THREE.Vector3(x*2.2,2.4,0.1) ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve,12,0.035,8), antMat); g.add(tube);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07,16,16), M.emissivePink); tip.position.set(x*2.2,2.4,0.1); g.add(tip);
  });
  // Arms (tentacle tubes)
  const armL = new THREE.Group(), armR = new THREE.Group();
  function makeArm(side){
    const grp = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,0,0), new THREE.Vector3(side*0.45,-0.15,0.1), new THREE.Vector3(side*0.6,-0.45,0.35) ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve,16,0.09,12), skin);
    tube.castShadow=true; grp.add(tube);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13,20,20), skin);
    hand.position.set(side*0.6,-0.45,0.35); grp.add(hand);
    grp.position.set(side*0.38,1.15,0);
    return grp;
  }
  const aL = makeArm(-1), aR = makeArm(1);
  g.add(aL); g.add(aR);
  // Floating tail (no legs — zero-G)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.7,20), skin);
  tail.position.y=-0.3; tail.rotation.x=Math.PI; g.add(tail);
  g.userData = { armL:aL, armR:aR, head, tail, kind:'alien' };
  return g;
}
function buildAstronaut(){
  const g = new THREE.Group();
  // Torso capsule
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42,0.55,12,24), M.whiteSuit);
  torso.position.y=1.05; torso.castShadow=true; g.add(torso);
  // Chest panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.4,0.18), M.hullDark);
  panel.position.set(0,1.2,0.38); g.add(panel);
  const btn1 = new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12), M.emissiveCyan); btn1.position.set(-0.12,1.25,0.48); g.add(btn1);
  const btn2 = new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12), M.emissivePink); btn2.position.set(0.12,1.25,0.48); g.add(btn2);
  const btn3 = new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12), M.emissiveGold); btn3.position.set(0,1.05,0.48); g.add(btn3);
  // Helmet + visor
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.4,40,40), M.whiteSuit);
  helmet.position.y=1.85; helmet.castShadow=true; g.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.33,40,40, Math.PI/2-0.65, 1.3, 0.9, 1.4), M.visor);
  visor.position.set(0,1.85,0.08); g.add(visor);
  // Helmet ring + light
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4,0.05,10,32), M.metal);
  ring.rotation.x=Math.PI/2; ring.position.y=1.55; g.add(ring);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08,14,14), M.emissiveGold);
  lamp.position.set(0,2.22,0.15); g.add(lamp);
  // Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.7,0.3), M.hull);
  pack.position.set(0,1.15,-0.48); pack.castShadow=true; g.add(pack);
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.1,0.4,8,16), M.metal);
  tank.position.set(-0.18,1.15,-0.66); g.add(tank);
  const tank2 = tank.clone(); tank2.position.x=0.18; g.add(tank2);
  // Hoses (tubes)
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.25,1.5,-0.3), new THREE.Vector3(-0.5,1.3,-0.5), new THREE.Vector3(-0.35,0.9,-0.55) ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve,20,0.05,10), M.rubber); g.add(hose);
  const hoseCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.25,1.5,-0.3), new THREE.Vector3(0.5,1.3,-0.5), new THREE.Vector3(0.35,0.9,-0.55) ]);
  const hose2 = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve2,20,0.05,10), M.rubber); g.add(hose2);
  // Arms
  function makeArm(side){
    const grp = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.11,0.4,8,16), M.whiteSuit);
    upper.position.set(side*0.2,-0.25,0); upper.rotation.z=side*0.5; grp.add(upper);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.14,18,18), M.rubber);
    glove.position.set(side*0.42,-0.5,0.1); grp.add(glove);
    grp.position.set(side*0.45,1.35,0);
    return grp;
  }
  const aL = makeArm(-1), aR = makeArm(1);
  g.add(aL); g.add(aR);
  // Legs + boots
  [-0.2,0.2].forEach(x=>{
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14,0.4,8,16), M.whiteSuit);
    leg.position.set(x,0.35,0); g.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.34), M.rubber);
    boot.position.set(x,0.05,0.05); g.add(boot);
  });
  g.userData = { armL:aL, armR:aR, head:helmet, kind:'astro' };
  return g;
}
const alienBarista = buildAlien();
alienBarista.position.set(-1.1, 1.24, -0.4);
scene.add(alienBarista);
const astroBarista = buildAstronaut();
astroBarista.position.set(3.2, 1.24, -0.4);
scene.add(astroBarista);
let activeBaristaObj = alienBarista;
let baristaAnim = { pour:0, wave:0, switchT:0 };

/* ============ CUSTOMERS ============ */
const customerSlots = [ new THREE.Vector3(-2.6,1.24,1.6), new THREE.Vector3(-0.9,1.24,1.9),
                        new THREE.Vector3(0.9,1.24,1.9), new THREE.Vector3(2.6,1.24,1.6) ];
function makeOrderBubble(recipe){
  const c = document.createElement('canvas'); c.width=256; c.height=160;
  const ctx = c.getContext('2d');
  if(!ctx.roundRect){ CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){ this.rect(x,y,w,h); }; }
  ctx.fillStyle='rgba(255,255,255,0.96)';
  ctx.beginPath(); ctx.roundRect(8,8,240,120,22); ctx.fill();
  ctx.beginPath(); ctx.moveTo(110,128); ctx.lineTo(146,128); ctx.lineTo(128,152); ctx.fill();
  ctx.fillStyle='#1e293b'; ctx.font='bold 26px sans-serif'; ctx.textAlign='center';
  ctx.fillText('☕ '+recipe.name,128,52);
  ctx.font='22px sans-serif';
  ctx.fillText(recipe.ing.map(id=>INGREDIENTS.find(i=>i.id===id).emoji).join(' '),128,90);
  ctx.fillStyle='#64748b'; ctx.font='18px sans-serif';
  ctx.fillText(recipe.price+' Cr',128,116);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false }));
  spr.scale.set(1.5,0.94,1);
  return spr;
}
function buildCustomerMesh(type){
  const g = new THREE.Group();
  const skin = alienSkin(type.color);
  if(type.shape==='blob'){
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5,36,36), skin);
    b.scale.set(1,0.9,1); b.position.y=0.55; b.castShadow=true; g.add(b);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1,16,16), new THREE.MeshBasicMaterial({ color:0x111827 }));
    eye.position.set(0,0.65,0.42); g.add(eye);
  } else if(type.shape==='tall'){
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.7,10,24), skin);
    b.position.y=0.7; b.castShadow=true; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.3,28,28), skin);
    h.position.y=1.35; g.add(h);
    [-0.11,0.11].forEach(x=>{
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07,14,14), new THREE.MeshBasicMaterial({ color:0x111827 }));
      e.position.set(x,1.4,0.24); g.add(e);
    });
  } else if(type.shape==='tent'){
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45,32,32), skin);
    b.position.y=0.8; b.castShadow=true; g.add(b);
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a)*0.3,0.5,Math.sin(a)*0.3),
        new THREE.Vector3(Math.cos(a)*0.55,0.25,Math.sin(a)*0.55),
        new THREE.Vector3(Math.cos(a)*0.7,0.05,Math.sin(a)*0.7) ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,10,0.06,8), skin));
    }
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.09,14,14), new THREE.MeshBasicMaterial({ color:0x111827 }));
    e.position.set(0,0.9,0.38); g.add(e);
  } else { // crystal
    const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.55,1), new THREE.MeshPhysicalMaterial({
      color:type.color, metalness:0.1, roughness:0.1, transmission:0.4, transparent:true, opacity:0.85,
      emissive:type.color, emissiveIntensity:0.25 }));
    b.position.y=0.75; b.castShadow=true; g.add(b);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.08,14,14), new THREE.MeshBasicMaterial({ color:0x111827 }));
    e.position.set(0,0.8,0.45); g.add(e);
  }
  return g;
}
const customers = []; // {mesh, order, patience, maxPatience, slot, state, bobPhase}
function spawnCustomer(){
  const freeSlots = customerSlots.map((s,i)=>i).filter(i=>!customers.some(c=>c.slot===i));
  if(!freeSlots.length) return;
  const slot = freeSlots[Math.floor(Math.random()*freeSlots.length)];
  const type = CUSTOMER_TYPES[Math.floor(Math.random()*CUSTOMER_TYPES.length)];
  const recipe = RECIPES[Math.floor(Math.random()*RECIPES.length)];
  const mesh = buildCustomerMesh(type);
  mesh.position.copy(customerSlots[slot]).add(new THREE.Vector3(0,2.5,3));
  mesh.userData.isCustomer = true;
  scene.add(mesh);
  const bubble = makeOrderBubble(recipe);
  bubble.position.set(0,1.9,0); mesh.add(bubble);
  const maxP = (42 + Math.random()*14) * S.upgrades.patience * Math.max(0.55, 1 - S.day*0.05);
  const cust = { mesh, bubble, order:recipe, patience:maxP, maxPatience:maxP, slot, state:'arriving', bobPhase:Math.random()*10, type };
  mesh.userData.custRef = cust;
  customers.push(cust);
  renderOrders();
}

/* ============ UI ============ */
function toast(msg, ms=2200){
  const t=$('toast'); t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.add('hidden'),ms);
}
function updateHUD(){
  $('hud-credits').querySelector('span').textContent = S.credits;
  $('hud-rep').querySelector('span').textContent = S.rep.toFixed(1);
  $('hud-day').querySelector('span').textContent = S.day;
  $('hud-served').querySelector('span').textContent = S.served;
  $('hud-combo').querySelector('span').textContent = S.combo;
  $('hud-barista').textContent = BARISTA_STATS[S.barista].label;
  $('goal-progress').textContent = Math.min(S.served,S.goal)+'/'+S.goal;
}
function renderOrders(){
  const list = $('orders-list'); list.innerHTML='';
  customers.filter(c=>c.state==='waiting'||c.state==='arriving').forEach((c,i)=>{
    const d=document.createElement('div');
    d.className='order-card'+(c.patience/c.maxPatience<0.3?' urgent':'');
    const em = c.order.ing.map(id=>INGREDIENTS.find(x=>x.id===id).emoji).join(' ');
    d.innerHTML=`<div class="o-drink">☕ ${c.order.name}</div><div class="o-ing">${em} · ${c.order.price} Cr</div>
      <div class="patience-bar"><div class="patience-fill" style="width:${Math.max(0,c.patience/c.maxPatience*100)}%"></div></div>`;
    d.title='Clicca il cliente in 3D per servire';
    d.onclick=()=>serveCustomer(c);
    list.appendChild(d);
  });
  if(!customers.length) list.innerHTML='<div style="font-size:12px;color:#8a97c9">Nessun ordine… i clienti stanno arrivando 🚀</div>';
}
function buildIngredientBar(){
  const bar=$('ingredients-bar'); bar.innerHTML='';
  INGREDIENTS.forEach(ing=>{
    const b=document.createElement('button');
    b.className='ing-btn'+(S.selected.includes(ing.id)?' selected':'');
    b.innerHTML=`<span class="ing-emoji">${ing.emoji}</span>${ing.name.split(' ')[0]}<br><small style="font-weight:400;color:#9db4ff">${ing.name}</small>`;
    b.onclick=()=>toggleIngredient(ing.id);
    bar.appendChild(b);
  });
}
function toggleIngredient(id){
  if(S.brewing||S.readyDrink) return;
  const i=S.selected.indexOf(id);
  if(i>=0) S.selected.splice(i,1);
  else { if(S.selected.length>=3){ toast('⚠️ Max 3 ingredienti!'); return; } S.selected.push(id); sfx.add(); }
  buildIngredientBar(); updateDrinkLabel();
}
function updateDrinkLabel(){
  const el=$('current-drink');
  if(S.readyDrink){ el.textContent=`✅ Pronto: ${S.readyDrink.name} — clicca il cliente per servire!`; return; }
  if(!S.selected.length){ el.textContent='Tazza vuota — seleziona ingredienti e premi Prepara'; return; }
  const em=S.selected.map(id=>INGREDIENTS.find(i=>i.id===id).emoji).join(' ');
  el.textContent=`${em} · ${S.selected.length}/3 ingredienti — premi Prepara`;
}
function matchRecipe(ingIds){
  const key=[...ingIds].sort().join('+');
  return RECIPES.find(r=>[...r.ing].sort().join('+')===key) || null;
}

/* ============ BREWING / TIMING ============ */
$('btn-brew').onclick = startBrew;
function startBrew(){
  if(!S.started||S.brewing||S.readyDrink) return;
  if(!S.selected.length){ toast('Seleziona almeno 1 ingrediente!'); return; }
  S.brewing=true; sfx.brew(); baristaAnim.pour=1;
  const stats=BARISTA_STATS[S.barista];
  const w=stats.timingWidth;
  const center=0.35+Math.random()*0.3;
  S.timing={ pos:0, dir:1, speed:1.1*S.upgrades.speed, center, half:w/2, perfectHalf:w*0.22 };
  $('timing-game').classList.remove('hidden');
  $('btn-brew').disabled=true;
  const track=$('timing-track');
  $('timing-zone').style.left=((center-w/2)*100)+'%';
  $('timing-zone').style.width=(w*100)+'%';
  $('timing-perfect').style.left=((center-w*0.22)*100)+'%';
  $('timing-perfect').style.width=(w*0.44*100)+'%';
  toast('⏱️ Ferma l\'ago nella zona verde!');
}
function stopTiming(){
  if(!S.timing) return;
  const t=S.timing, pos=t.pos;
  const dist=Math.abs(pos-t.center);
  let quality, label;
  if(dist<=t.perfectHalf){ quality='perfect'; label='✨ PERFETTO!'; sfx.perfect(); }
  else if(dist<=t.half){ quality='good'; label='👍 Buono!'; sfx.good(); }
  else { quality='miss'; label='💨 Riuscito male…'; sfx.miss(); }
  const recipe = matchRecipe(S.selected);
  const name = recipe? recipe.name : 'Miscuglio Alieno';
  const color = recipe? recipe.color : 0x9ca3af;
  S.readyDrink = { name, ing:[...S.selected], quality, recipe, color };
  liquidMesh.visible=true;
  liquidMesh.material.color.setHex(color);
  liquidMesh.material.emissive.setHex(color);
  liquidMesh.scale.set(1,0.35,1);
  S.brewing=false; S.timing=null;
  $('timing-game').classList.add('hidden');
  $('btn-brew').disabled=false;
  toast(label+' '+name);
  updateDrinkLabel();
}
$('timing-track').addEventListener('pointerdown', stopTiming);
addEventListener('keydown', e=>{
  if(e.code==='Space'){ e.preventDefault(); if(S.timing) stopTiming(); }
  if(e.code==='Tab'){ e.preventDefault(); switchBarista(); }
});

/* ============ SERVE ============ */
function serveCustomer(cust){
  if(!S.started||cust.state==='leaving') return;
  if(!S.readyDrink){ toast('☕ Prepara prima una bevanda!'); sfx.click(); return; }
  const drink=S.readyDrink;
  const match = drink.recipe && drink.recipe.name===cust.order.name;
  const speedBonus = cust.patience/cust.maxPatience; // 0..1
  let earned=0, repDelta=0;
  if(match){
    const stats=BARISTA_STATS[S.barista];
    const qMul = drink.quality==='perfect'?1.5 : drink.quality==='good'?1.1 : 0.6;
    earned = Math.round(cust.order.price * qMul * (0.6+0.8*speedBonus) * stats.tipMul * S.upgrades.tips * (S.anchored?1:1.1));
    repDelta = drink.quality==='perfect'?0.3 : drink.quality==='good'?0.15 : 0.05;
    S.combo++; S.bestCombo=Math.max(S.bestCombo,S.combo);
    if(S.combo>=3) earned+=S.combo*2;
    toast(`✅ +${earned} Cr · ${drink.name} servito!`);
    sfx.serve();
  } else {
    earned = Math.round(cust.order.price*0.25);
    repDelta = -0.1; S.combo=0;
    toast(`❌ Ordine sbagliato! +${earned} Cr (poco)`);
    sfx.miss();
  }
  S.credits+=earned; S.rep=Math.min(5,Math.max(0.5,S.rep+repDelta));
  S.served++;
  // reset cup
  S.readyDrink=null; S.selected=[]; liquidMesh.visible=false;
  buildIngredientBar(); updateDrinkLabel();
  // customer leaves happy/angry
  cust.state = match? 'leavingHappy':'leavingAngry';
  baristaAnim.wave=1;
  updateHUD(); renderOrders();
  if(S.served>=S.goal && !S.goalDone){ S.goalDone=true; setTimeout(endDay,1200); }
}
function customerLeaves(cust, angry){
  if(angry){ S.rep=Math.max(0.5,S.rep-0.2); S.combo=0; toast('😤 Cliente andato via! Reputazione -0.2'); sfx.angry(); }
  cust.state='leaving';
  updateHUD();
}

/* ============ BARISTA SWITCH ============ */
$('btn-switch').onclick = switchBarista;
function switchBarista(){
  if(!S.started) return;
  S.barista = S.barista==='alien' ? 'astronaut' : 'alien';
  baristaAnim.switchT=1; sfx.click();
  toast(S.barista==='alien' ? '👽 Alieno al bancone: timing più facile' : '🧑‍🚀 Astronauta al bancone: +25% mance');
  updateHUD();
}
$('btn-anchor').onclick = ()=>{
  S.anchored=!S.anchored;
  $('btn-anchor').textContent = S.anchored? '🧲 Ancora: ON':'🧲 Ancora: OFF';
  toast(S.anchored? '🧲 Campi magnetici attivi — oggetti stabili' : '🌀 Ancora OFF — fluttuazione libera (+10% Cr)');
  sfx.click();
};
$('btn-recipes').onclick = ()=>{ $('recipe-panel').classList.toggle('hidden'); renderRecipes(); };
$('recipe-close').onclick = ()=>$('recipe-panel').classList.add('hidden');
$('btn-help').onclick = ()=>$('help-modal').classList.remove('hidden');
$('btn-help-close').onclick = ()=>$('help-modal').classList.add('hidden');
$('btn-sound').onclick = ()=>{ S.sound=!S.sound; $('btn-sound').textContent=S.sound?'🔊':'🔇'; };
function renderRecipes(){
  const list=$('recipe-list'); list.innerHTML='';
  RECIPES.forEach(r=>{
    const d=document.createElement('div'); d.className='recipe-item';
    d.innerHTML=`<b>☕ ${r.name}</b> · ${r.price} Cr<br>${r.ing.map(id=>{const i=INGREDIENTS.find(x=>x.id===id);return i.emoji+' '+i.name;}).join(' + ')}`;
    list.appendChild(d);
  });
}

/* ============ DAY CYCLE ============ */
function endDay(){
  sfx.day();
  const body=$('summary-body');
  const upg = [
    { id:'patience', name:'⏳ Pazienza clienti +15%', cost:60 },
    { id:'speed',    name:'⚡ Macchina veloce +15%', cost:60 },
    { id:'tips',     name:'💰 Mance +15%', cost:80 },
  ];
  body.innerHTML=`<p>☕ Serviti: <b>${S.served}</b> · 💰 Crediti: <b>${S.credits}</b></p>
    <p>⭐ Reputazione: <b>${S.rep.toFixed(1)}</b> · 🔥 Miglior combo: <b>x${S.bestCombo}</b></p>
    <p>🎯 Obiettivo raggiunto! Prossimo giorno: <b>${S.goal+3} clienti</b>, pazienza minore.</p>
    <p style="margin-top:10px"><b>🛠️ Potenziamenti (spendi crediti):</b></p>`+
    upg.map(u=>`<button class="action-btn" style="margin:4px" onclick="buyUpgrade('${u.id}',${u.cost})">${u.name} — ${u.cost} Cr</button>`).join('');
  $('summary-modal').classList.remove('hidden');
}
window.buyUpgrade = (id,cost)=>{
  if(S.credits<cost){ toast('Crediti insufficienti!'); return; }
  S.credits-=cost;
  if(id==='patience') S.upgrades.patience*=1.15;
  if(id==='speed') S.upgrades.speed*=1.15;
  if(id==='tips') S.upgrades.tips*=1.15;
  toast('✅ Potenziamento acquistato!'); sfx.perfect(); updateHUD();
};
$('btn-next-day').onclick = ()=>{
  $('summary-modal').classList.add('hidden');
  S.day++; S.served=0; S.combo=0; S.goal+=3; S.goalDone=false;
  $('goal-text').textContent = `Servi ${S.goal} clienti`;
  customers.forEach(c=>{ scene.remove(c.mesh); }); customers.length=0;
  S.selected=[]; S.readyDrink=null; liquidMesh.visible=false;
  buildIngredientBar(); updateDrinkLabel(); renderOrders(); updateHUD();
  toast(`☀️ Giorno ${S.day} — Servi ${S.goal} clienti!`);
};

/* ============ START ============ */
$('btn-start').onclick = ()=>{
  $('start-screen').classList.add('hidden');
  ['hud','orders-panel','bottom-bar'].forEach(id=>$(id).classList.remove('hidden'));
  S.started=true; S.goal=5;
  buildIngredientBar(); updateDrinkLabel(); renderRecipes(); updateHUD(); renderOrders();
  spawnCustomer(); setTimeout(spawnCustomer,2500);
  toast('🚀 Benvenuto a Gravity Coffee! Prepara il primo ordine.');
  sfx.day();
};

/* ============ 3D PICKING ============ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos=null;
canvas.addEventListener('pointerdown', e=>{ downPos={x:e.clientX,y:e.clientY}; });
canvas.addEventListener('pointerup', e=>{
  if(!S.started) return;
  if(downPos && Math.hypot(e.clientX-downPos.x, e.clientY-downPos.y)>6) return; // was a drag
  pointer.x=(e.clientX/innerWidth)*2-1; pointer.y=-(e.clientY/innerHeight)*2+1;
  raycaster.setFromCamera(pointer,camera);
  // customers first
  const custMeshes = customers.map(c=>c.mesh);
  const hitC = raycaster.intersectObjects(custMeshes,true)[0];
  if(hitC){
    let o=hitC.object; while(o && !o.userData.custRef) o=o.parent;
    if(o) serveCustomer(o.userData.custRef);
    return;
  }
  // jars
  const jarObjs = Object.values(jarMeshes);
  const hitJ = raycaster.intersectObjects(jarObjs,true)[0];
  if(hitJ){
    let o=hitJ.object; while(o && !o.userData.jarRoot) o=o.parent;
    if(o) toggleIngredient(o.userData.jarRoot.userData.ingredient);
    return;
  }
  // cup
  const hitCup = raycaster.intersectObject(cupGroup,true)[0];
  if(hitCup && S.readyDrink){
    // serve to first waiting customer
    const c = customers.find(x=>x.state==='waiting');
    if(c) serveCustomer(c); else toast('Nessun cliente in attesa!');
  }
});

/* ============ ANIMATE ============ */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  controls.update();
  idleTimer+=dt; if(idleTimer>8 && S.started) controls.autoRotate=true;

  // Floating physics (zero-G)
  const ampMul = S.anchored? 0.5 : 1.6;
  floaters.forEach(f=>{
    f.obj.position.y = f.baseY + Math.sin(t*f.speed+f.phase)*f.amp*ampMul;
    f.obj.rotation.y += dt*0.15*f.speed*(S.anchored?0.4:1);
    f.obj.rotation.x = Math.sin(t*0.5+f.phase)*0.08*ampMul;
  });
  // Particles drift
  coffeeSpheres.rotation.y += dt*0.05;
  coffeeSpheres.position.y = Math.sin(t*0.4)*0.3;
  sparks.rotation.y -= dt*0.03;
  sparks.position.y = Math.sin(t*0.3)*0.4;
  steamPoints.position.y = 1.7 + Math.sin(t*2)*0.08;
  steamPoints.material.opacity = S.readyDrink? 0.9 : 0.4;
  sky.planet.rotation.y += dt*0.02;
  sky.planetRing.rotation.z += dt*0.05;
  // Runes orbit
  runes.forEach(r=>{
    if(r.isBoard){ r.spr.position.y = r.y + Math.sin(t*0.8)*0.15; return; }
    r.a += dt*r.speed;
    r.spr.position.set(Math.cos(r.a)*r.r, r.y+Math.sin(t*1.2+r.a*3)*0.25, Math.sin(r.a)*r.r);
  });
  // Machine bob + eye pulse
  machineGroup.position.y = 1.24 + Math.sin(t*1.3)*0.04*ampMul;
  // Baristas animation
  const active = S.barista==='alien'? alienBarista : astroBarista;
  const inactive = S.barista==='alien'? astroBarista : alienBarista;
  activeBaristaObj = active;
  [alienBarista, astroBarista].forEach(b=>{
    const isActive = b===active;
    const targetX = isActive? -1.1 : 3.2;
    b.position.x += (targetX - b.position.x)*Math.min(1,dt*3);
    b.position.y = 1.24 + Math.sin(t*1.6 + (b===alienBarista?0:2))*0.08*ampMul;
    b.rotation.y = Math.sin(t*0.5)*0.15;
    const u=b.userData;
    // idle arm sway
    u.armL.rotation.z = Math.sin(t*1.8)*0.15;
    u.armR.rotation.z = -Math.sin(t*1.8+1)*0.15;
    if(isActive){
      // pouring pose
      if(baristaAnim.pour>0){
        baristaAnim.pour=Math.max(0,baristaAnim.pour-dt*0.5);
        u.armR.rotation.x = -0.9*Math.sin(baristaAnim.pour*Math.PI);
        u.armR.rotation.z = -0.6*Math.sin(baristaAnim.pour*Math.PI);
      } else { u.armR.rotation.x*=0.9; }
      // welcome wave
      if(baristaAnim.wave>0){
        baristaAnim.wave=Math.max(0,baristaAnim.wave-dt*0.6);
        u.armL.rotation.z = 2.4 + Math.sin(t*14)*0.5*baristaAnim.wave;
      }
      // head look
      u.head.rotation.y = Math.sin(t*0.7)*0.25;
    }
  });
  // Customers
  for(let i=customers.length-1;i>=0;i--){
    const c=customers[i];
    c.mesh.position.y += Math.sin(t*2+c.bobPhase)*dt*0.25;
    c.mesh.rotation.y = Math.sin(t*0.8+c.bobPhase)*0.2;
    if(c.state==='arriving'){
      const target=customerSlots[c.slot];
      c.mesh.position.lerp(new THREE.Vector3(target.x,target.y,target.z), dt*2);
      if(c.mesh.position.distanceTo(target)<0.15){ c.state='waiting'; }
    } else if(c.state==='waiting'){
      c.patience-=dt;
      if(c.patience<=0){ customerLeaves(c,true); }
      if(Math.floor(t*4)!==Math.floor((t-dt)*4)) renderOrders();
    } else if(c.state==='leaving'||c.state==='leavingHappy'||c.state==='leavingAngry'){
      c.mesh.position.y += dt*1.2;
      c.mesh.position.z += dt*1.5;
      c.mesh.rotation.y += dt*2;
      c.bubble.material.opacity = Math.max(0, c.bubble.material.opacity - dt*1.5);
      if(c.mesh.position.y>7){ scene.remove(c.mesh); customers.splice(i,1); renderOrders(); }
    }
  }
  // Order spawn timer
  if(S.started && !S.goalDone){
    S.orderTimer+=dt;
    const interval = Math.max(4.5, 9 - S.day*0.7);
    if(S.orderTimer>interval && customers.filter(c=>c.state!=='leaving'&&c.state!=='leavingHappy'&&c.state!=='leavingAngry').length<4){
      S.orderTimer=0; spawnCustomer();
    }
  }
  // Timing needle
  if(S.timing){
    S.timing.pos += S.timing.dir*S.timing.speed*dt;
    if(S.timing.pos>1){ S.timing.pos=1; S.timing.dir=-1; }
    if(S.timing.pos<0){ S.timing.pos=0; S.timing.dir=1; }
    $('timing-needle').style.left = (S.timing.pos*100)+'%';
  }
  renderer.render(scene,camera);
}
animate();

addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
updateHUD();
