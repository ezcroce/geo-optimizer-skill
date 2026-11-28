// ═════════ Arena Royale 3D — logica del sito (landing page) ═════════
import * as THREE from 'three';
import { SKINS, WEAPONS, RARITIES, WEAPON_POOL } from './config.js?v=51';
import { buildCharacter, buildWeaponMesh } from './character.js?v=51';
import { createCrosshair } from './crosshair.js?v=51';
// rarità più frequente di ogni arma (colore della scheda e dell'anteprima)
const WEAPON_RAR = { claws: 4, ...Object.fromEntries(WEAPON_POOL.map(e => [e.id, e.rar.indexOf(Math.max(...e.rar))])) };
import { resetPose, setLeg, setArm, legsLocomotion, legsAir, armsSwing, poseHold, poseClimb, poseMantle } from './anim.js?v=51';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutBack = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const smooth = (a, b, t) => clamp((t - a) / (b - a), 0, 1);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// impostazioni condivise con il gioco
const KEY = 'arenaRoyale';
const settings = Object.assign({ skin: 'recluta' }, JSON.parse(localStorage.getItem(KEY) || '{}'));
const saveSettings = () => localStorage.setItem(KEY, JSON.stringify(settings));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─────────────── Titolo lettera per lettera ───────────────
for (const el of $$('[data-split]')) {
  const txt = el.textContent;
  el.textContent = '';
  [...txt].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i);
    el.appendChild(s);
  });
}

// ─────────────── Nav, barra di scorrimento, sezione attiva ───────────────
const nav = $('#nav'), bar = $('#scrollBar');
const navLinks = $$('#nav nav a');
function onScroll() {
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  nav.classList.toggle('scrolled', y > 30);
  bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  let cur = null;
  for (const a of navLinks) {
    const sec = $(a.getAttribute('href'));
    if (sec && sec.getBoundingClientRect().top < innerHeight * 0.4) cur = a;
  }
  navLinks.forEach(a => a.classList.toggle('on', a === cur));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ─────────────── Reveal allo scroll + contatori ───────────────
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    io.unobserve(e.target);
  }
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
function observeReveal(root = document) { root.querySelectorAll('.reveal:not(.in), .timeline').forEach(el => io.observe(el)); }
observeReveal();

function countUp(el) {
  const to = +el.dataset.count, t0 = performance.now(), dur = 1400;
  (function step(now) {
    const k = clamp((now - t0) / dur, 0, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
setTimeout(() => $$('[data-count]').forEach(countUp), 900);

// ─────────────── Card con inclinazione 3D ───────────────
for (const c of $$('.tilt')) {
  c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--mx', x * 100 + '%');
    c.style.setProperty('--my', y * 100 + '%');
    if (!REDUCED) c.style.transform = `perspective(700px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg) translateY(-4px)`;
  });
  c.addEventListener('pointerleave', () => { c.style.transform = ''; });
}

// ─────────────── Ticker (finto feed eliminazioni) ───────────────
{
  const wn = Object.values(WEAPONS).map(w => w.name);
  const names = SKINS.map(s => s.name);
  const extra = ['💥 Nuovo: pareti, auto e rocce si rompono', '🏚️ Una casa è crollata! Materiali a terra', '👁️ Nuovo: modalità spettatore', '🌪️ La tempesta si sta restringendo!', '👑 Vittoria Reale!', '🔍 Nuovo: zoom sulla mappa'];
  const items = [];
  for (let i = 0; i < 14; i++) {
    if (i % 3 === 2) items.push(`<span>${extra[i % extra.length]}</span>`);
    else {
      const a = names[(i * 3) % names.length], b = names[(i * 7 + 2) % names.length];
      items.push(`<span>🎯 <b>${a}</b> ha eliminato ${b} · ${wn[i % wn.length]}</span>`);
    }
  }
  $('#ticker').innerHTML = items.join('') + items.join('');
}

// ─────────────── Utility Three.js ───────────────
function addLights(scene, rim = true) {
  scene.add(new THREE.HemisphereLight('#cfe4ff', '#2a2440', 1.4));
  const key = new THREE.DirectionalLight('#fff3dd', 2.4);
  key.position.set(3, 6, 5);
  scene.add(key);
  if (rim) {
    const r1 = new THREE.PointLight('#4fd3ff', 18, 12); r1.position.set(-3, 2.5, -2); scene.add(r1);
    const r2 = new THREE.PointLight('#ff3dbb', 14, 12); r2.position.set(3, 1.5, -2.5); scene.add(r2);
  }
  return key;
}
function makeRenderer(canvas, opts = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, ...opts });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}
// posa "in mano un'arma", come nel gioco
function holdPose(m, pitch = 0) { poseHold(m, pitch, 0, 0, 0); }
const SKIN_WEAPON = { recluta: 'ar', zombie: 'smg', agente: 'pistol', ninja: 'smg', pirata: 'shotgun', cyber: 'smg', astro: 'ar', banana: 'shotgun', cavaliere: 'sniper', drago: 'rocket' };

// ─────────────── HERO: armadietto 3D rotante ───────────────
const hero = (() => {
  const canvas = $('#heroCanvas');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.55, 6.4);
  addLights(scene);

  // piedistallo esagonale con anello luminoso
  const ped = new THREE.Group();
  scene.add(ped);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.32, 6), new THREE.MeshStandardMaterial({ color: '#1b2552', roughness: 0.5, metalness: 0.4 }));
  base.position.y = -0.16; ped.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.04, 6), new THREE.MeshStandardMaterial({ color: '#26336e', roughness: 0.3, metalness: 0.6 }));
  top.position.y = 0.01; ped.add(top);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#b4b4b4', transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.035, 8, 6), ringMat);
  ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.y = 0.02; ped.add(ring);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#b4b4b4', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 3.2, 6, 1, true), glowMat);
  beam.position.y = 1.6; ped.add(beam);
  {
    // sfuma il "fascio" verso l'alto
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.55, '#222'); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    glowMat.alphaMap = new THREE.CanvasTexture(c);
  }

  // scintille che salgono
  const N = 70, sp = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) { seeds.push({ a: Math.random() * 6.28, r: 0.4 + Math.random() * 1.0, s: 0.3 + Math.random() * 0.7, o: Math.random() * 3.5 }); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.05, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(sg, sMat));

  // personaggio
  const holder = new THREE.Group();
  scene.add(holder);
  let cur = null, next = null, idx = Math.max(0, SKINS.findIndex(s => s.id === settings.skin));
  let tr = 1;          // avanzamento transizione (1 = ferma)
  const ringCol = new THREE.Color(RARITIES[SKINS[idx].rarity].color), ringTarget = ringCol.clone();
  const cache = new Map();
  function getChar(skin) {
    if (cache.has(skin.id)) return cache.get(skin.id);
    const m = buildCharacter(skin);
    m.gunPivot.add(buildWeaponMesh(SKIN_WEAPON[skin.id] || 'ar', skin.rarity));
    holdPose(m, -0.05);
    cache.set(skin.id, m);
    return m;
  }
  cur = getChar(SKINS[idx]); holder.add(cur.root);

  // etichetta + puntini
  const dotsEl = $('#heroDots'), labelEl = $('.skin-label');
  SKINS.forEach((s, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', s.name);
    b.onclick = () => { show(i); hold(); };
    dotsEl.appendChild(b);
  });
  function label() {
    const s = SKINS[idx], r = RARITIES[s.rarity];
    $('#heroName').textContent = s.name;
    $('#heroRar').textContent = r.name;
    labelEl.style.setProperty('--rc', r.color);
    labelEl.classList.remove('swap'); void labelEl.offsetWidth; labelEl.classList.add('swap');
    [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i === idx));
  }
  label();

  let burst = 0;
  function show(i) {
    i = (i + SKINS.length) % SKINS.length;
    if (i === idx && !next) return;
    idx = i;
    next = getChar(SKINS[idx]);
    tr = 0;
    ringTarget.set(RARITIES[SKINS[idx].rarity].color);
    label();
  }
  let autoT = 0, holdUntil = 0;
  const hold = () => { holdUntil = performance.now() + 9000; autoT = 0; };
  $('.arrow.prev').onclick = () => { show(idx - 1); hold(); };
  $('.arrow.next').onclick = () => { show(idx + 1); hold(); };

  // trascina per ruotare + parallasse col mouse
  let drag = null, spin = 0, spinV = 0, mx = 0, my = 0, smx = 0, smy = 0;
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); hold(); });
  canvas.addEventListener('pointermove', e => { if (drag !== null) { spinV = (e.clientX - drag) * 0.012; spin += spinV; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  function update(dt, t) {
    if (!visible) return;
    // rotazione: lenta in automatico + inerzia del trascinamento
    if (drag === null) { spinV *= Math.pow(0.04, dt); spin += spinV + dt * (REDUCED ? 0 : 0.45); }
    smx = lerp(smx, mx, dt * 3); smy = lerp(smy, my, dt * 3);
    holder.rotation.y = spin + smx * 0.6;
    camera.position.x = smx * 0.6; camera.position.y = 1.55 - smy * 0.4;
    camera.lookAt(0, 1.05, 0);

    // cambio skin automatico
    if (performance.now() > holdUntil && !REDUCED) { autoT += dt; if (autoT > 4.2) { autoT = 0; show(idx + 1); } }

    // transizione: la vecchia skin gira e sparisce, la nuova "rimbalza" dentro
    if (next) {
      tr = Math.min(1, tr + dt / 0.9);
      if (tr < 0.42) {
        const k = easeInOut(tr / 0.42);
        cur.root.scale.setScalar(1 - k);
        cur.root.rotation.y = k * Math.PI * 1.5;
        cur.root.position.y = k * 0.6;
      } else {
        if (cur !== next) { holder.remove(cur.root); cur.root.scale.setScalar(1); cur.root.rotation.y = 0; cur.root.position.y = 0; cur = next; holder.add(cur.root); burst = 1; }
        const k = (tr - 0.42) / 0.58;
        cur.root.scale.setScalar(Math.max(0.001, easeOutBack(k)));
        cur.root.rotation.y = (1 - easeInOut(k)) * -Math.PI;
        cur.root.position.y = 0;
      }
      if (tr >= 1) { next = null; cur.root.scale.setScalar(1); cur.root.rotation.y = 0; }
    }
    // colore anello
    ringCol.lerp(ringTarget, Math.min(1, dt * 4));
    ringMat.color.copy(ringCol); glowMat.color.copy(ringCol); sMat.color.copy(ringCol).lerp(new THREE.Color('#fff'), 0.5);
    burst = Math.max(0, burst - dt * 1.6);
    glowMat.opacity = 0.1 + burst * 0.35 + Math.sin(t * 2) * 0.02;
    beam.scale.set(1 + burst * 0.25, 1, 1 + burst * 0.25);
    ring.scale.setScalar(1 + burst * 0.3);

    // respiro / idle
    const m = cur;
    resetPose(m);
    holdPose(m, -0.05 + Math.sin(t * 2.2) * 0.02);
    m.body.position.y = Math.sin(t * 2.2) * 0.012;
    m.torso.rotation.y = Math.sin(t * 0.9) * 0.08;
    m.torso.rotation.x = (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.02;
    m.head.rotation.y = clamp(-smx * 0.6, -0.3, 0.3);
    m.head.rotation.x = smy * 0.3;
    if (m.cape) m.cape.rotation.x = 0.12 + Math.sin(t * 1.8) * 0.06;
    setLeg(m, 0, -0.04, 0.08, 0.04); setLeg(m, 1, 0.06, 0.12, -0.06);

    // scintille
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const y = ((t * s.s + s.o) % 3.5);
      const a = s.a + t * 0.3;
      sp[i * 3] = Math.cos(a) * s.r; sp[i * 3 + 1] = y; sp[i * 3 + 2] = Math.sin(a) * s.r;
    }
    sg.attributes.position.needsUpdate = true;
    sMat.opacity = 0.5 + burst * 0.5;
    renderer.render(scene, camera);
  }
  return { update, show: i => { show(i); hold(); }, get idx() { return idx; } };
})();

// ─────────────── DEMO: cammina → abbassati → arrampicati → scavalca → salta ───────────────
const demo = (() => {
  const canvas = $('#demoCanvas');
  const renderer = makeRenderer(canvas);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#1d3a78', 14, 30);
  const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 60);
  camera.position.set(0.6, 2.9, 9.4);
  camera.lookAt(0.6, 2.0, 0);
  const key = addLights(scene, false);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  key.position.set(4, 9, 6);

  // pavimento + muro di mattoni
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: '#4f9a3c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const WALL = { x0: 0, x1: 1.8, h: 2.6 };
  const brick = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#b9b2a4'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#d8d2c4';
    for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) g.fillRect(k * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 2); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL.x1 - WALL.x0, WALL.h, 3), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 }));
  wall.position.set((WALL.x0 + WALL.x1) / 2, WALL.h / 2, -0.3); wall.castShadow = wall.receiveShadow = true; scene.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(WALL.x1 - WALL.x0 + 0.2, 0.14, 3.2), new THREE.MeshStandardMaterial({ color: '#a33a2a' }));
  cap.position.set(wall.position.x, WALL.h + 0.07, -0.3); cap.castShadow = true; scene.add(cap);
  // qualche cespuglio e albero per profondità
  const bushM = new THREE.MeshStandardMaterial({ color: '#2f7a2a', flatShading: true });
  for (const [x, z, s] of [[-5, -3, 1], [4.5, -4, 1.3], [-2.5, -6, 1.6], [6.5, -2, 0.8]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 0), bushM); b.position.set(x, 0.5 * s, z); b.castShadow = true; scene.add(b);
  }

  // polvere d'atterraggio
  const dust = [];
  const dustM = new THREE.MeshBasicMaterial({ color: '#e8dcb8', transparent: true, depthWrite: false });
  for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), dustM.clone()); d.visible = false; scene.add(d); dust.push({ m: d, v: new THREE.Vector3(), life: 0 }); }
  function puff(x, y, z) {
    for (const d of dust) {
      const a = Math.random() * 6.28;
      d.m.position.set(x, y + 0.05, z); d.v.set(Math.cos(a) * 1.8, 0.6 + Math.random() * 0.8, Math.sin(a) * 1.2);
      d.life = 0.6; d.m.visible = true;
    }
  }

  const skinOf = () => SKINS.find(s => s.id === settings.skin) || SKINS[0];
  let skinId = null, m = null;
  function ensureChar() {
    const s = skinOf();
    if (s.id === skinId) return;
    if (m) scene.remove(m.root);
    skinId = s.id; m = buildCharacter(s);
    m.gunPivot.visible = false;
    m.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(m.root);
  }
  ensureChar();

  // linea temporale della scena (secondi)
  const R = 0.42;                   // raggio personaggio
  const X0 = -7, XC = WALL.x0 - R;  // partenza, punto di scalata
  const T = { walk: 2.0, crouch: 4.2, stand: 4.6, climb: 6.0, mantle: 6.5, idle: 7.3, jump: 8.0, out: 10.0 };
  const LOOP = T.out;
  const CAPS = [['walk', 'Cammina', 0], ['crouch', 'Abbassati', T.walk], ['climb', 'Arrampicati', T.stand], ['mantle', 'Scavalca', T.climb], ['jump', 'Salta giù!', T.idle], ['walk', 'Cammina', T.jump + 0.4]];
  const stepsEl = $$('#moveSteps li'), capEl = $('#demoCaption'), stEl = $('#demoStamina');
  let lastCap = -1, landed = false;

  function pose(t, dt) {
    const yawR = Math.PI / 2;   // guarda verso +x
    let x, y = 0, crouch = 0, walkSpeed = 0, mode = 'ground', ph = 0, mk = 0, stamina = 1;
    if (t < T.walk) { x = lerp(X0, -3.4, t / T.walk); walkSpeed = 1; }
    else if (t < T.crouch) { const k = (t - T.walk) / (T.crouch - T.walk); x = lerp(-3.4, XC - 0.2, k); walkSpeed = 0.55; crouch = smooth(0, 0.12, k) * (1 - smooth(0.9, 1, k)); }
    else if (t < T.stand) { x = lerp(XC - 0.2, XC, (t - T.crouch) / (T.stand - T.crouch)); walkSpeed = 0.4; }
    else if (t < T.climb) { const k = (t - T.stand) / (T.climb - T.stand); x = XC; y = easeInOut(k) * (WALL.h - 0.35); mode = 'climb'; ph = k * 14; stamina = 1 - k * 0.45; }
    else if (t < T.mantle) { const k = easeInOut((t - T.climb) / (T.mantle - T.climb)); mode = 'mantle'; mk = (t - T.climb) / (T.mantle - T.climb); x = lerp(XC, WALL.x0 + 0.55, k); y = lerp(WALL.h - 0.35, WALL.h + 0.14, Math.min(1, k * 1.6)) + Math.sin(k * Math.PI) * 0.2; stamina = 0.55; }
    else if (t < T.idle) { const k = (t - T.mantle) / (T.idle - T.mantle); x = lerp(WALL.x0 + 0.55, WALL.x1 - 0.25, k); y = WALL.h + 0.14; walkSpeed = 0.5; stamina = 0.55 + k * 0.1; }
    else if (t < T.jump) { const k = (t - T.idle) / (T.jump - T.idle); x = lerp(WALL.x1 - 0.25, WALL.x1 + 1.6, k); y = (WALL.h + 0.14) * (1 - k * k) + Math.sin(k * Math.PI) * 0.9; mode = 'air'; stamina = 0.65 + k * 0.1; }
    else { const k = (t - T.jump) / (T.out - T.jump); x = lerp(WALL.x1 + 1.6, 8.5, k); walkSpeed = k < 0.15 ? 0 : 1; stamina = Math.min(1, 0.75 + k); }

    // atterraggio: polvere + affondo
    const sinceLand = t - T.jump;
    if (t >= T.jump && !landed) { landed = true; puff(x, 0, 0); }
    if (t < T.jump) landed = false;
    const land = sinceLand > 0 && sinceLand < 0.35 ? Math.sin(sinceLand / 0.35 * Math.PI) * 0.3 : 0;

    m.root.position.set(x, y, 0);
    m.root.rotation.y = yawR;
    resetPose(m);
    if (mode === 'climb') poseClimb(m, ph);
    else if (mode === 'mantle') poseMantle(m, mk);
    else if (mode === 'air') { legsAir(m, 0.6); setArm(m, 0, -2.2, -0.5, -0.4); setArm(m, 1, -2.2, 0.5, -0.4); }
    else {
      demo.walkPhase = (demo.walkPhase || 0) + dt * (4 + walkSpeed * 8) * (walkSpeed > 0.05 ? 1 : 0);
      const ck = crouch;
      const bodyY = legsLocomotion(m, demo.walkPhase, walkSpeed, 0, ck);
      armsSwing(m, demo.walkPhase, walkSpeed, 0, ck);
      if (land > 0) for (let i = 0; i < 2; i++) { m.legs[i].rotation.x -= land * 1.6; m.knees[i].rotation.x += land * 3.2; m.feet[i].rotation.x -= land * 1.6; }
      m.body.position.y = bodyY - land * 0.45;
      m.torso.rotation.x = 0.3 * ck + land * 0.5;
    }
    if (m.cape) m.cape.rotation.x = mode === 'air' ? 0.9 : 0.1 + walkSpeed * 0.4;

    stEl.style.width = (stamina * 100).toFixed(1) + '%';
    stEl.parentElement.style.opacity = stamina < 0.999 ? 1 : 0.35;

    // didascalia + passo evidenziato
    let ci = 0;
    for (let i = 0; i < CAPS.length; i++) if (t >= CAPS[i][2]) ci = i;
    if (ci !== lastCap) {
      lastCap = ci;
      capEl.textContent = CAPS[ci][1];
      capEl.classList.remove('swap'); void capEl.offsetWidth; capEl.classList.add('swap');
      stepsEl.forEach(li => li.classList.toggle('on', li.dataset.step === CAPS[ci][0]));
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  let visible = false, t = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) resize(); }).observe(canvas);

  function update(dt) {
    if (!visible) return;
    ensureChar();
    t = (t + dt) % LOOP;
    pose(t, dt);
    for (const d of dust) {
      if (d.life <= 0) continue;
      d.life -= dt; d.v.y -= 2 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.material.opacity = Math.max(0, d.life / 0.6) * 0.8;
      d.m.scale.setScalar(1 + (0.6 - d.life) * 2.5);
      if (d.life <= 0) d.m.visible = false;
    }
    renderer.render(scene, camera);
  }
  const demo = { update, setTime: v => { t = v; } };
  return demo;
})();

// ─────────────── Miniature (rendering off-screen) ───────────────
function renderThumbs() {
  const W = 300, H = 400;
  const canvas = document.createElement('canvas');
  const r = makeRenderer(canvas, { preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false);
  const scene = new THREE.Scene();
  addLights(scene);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  const out = { skins: {}, weapons: {} };

  // skin: ritratto a 3/4
  cam.position.set(1.2, 1.55, 5.0); cam.lookAt(0, 1.08, 0);
  for (const s of SKINS) {
    const m = buildCharacter(s);
    m.gunPivot.add(buildWeaponMesh(SKIN_WEAPON[s.id] || 'ar', s.rarity));
    holdPose(m, -0.05);
    m.root.rotation.y = 0.75;
    m.head.rotation.y = -0.35;
    scene.add(m.root);
    r.render(scene, cam);
    out.skins[s.id] = canvas.toDataURL('image/png');
    scene.remove(m.root);
  }
  // armi: vista laterale, inquadrata con il bounding box
  const WW = 360, WH = 200;
  r.setSize(WW, WH, false);
  cam.aspect = WW / WH; cam.fov = 22; cam.updateProjectionMatrix();
  for (const id of Object.keys(WEAPONS)) {
    const g = buildWeaponMesh(id, WEAPON_RAR[id] ?? 2);
    const piv = new THREE.Group(); piv.add(g); scene.add(piv);
    piv.rotation.set(0.1, -Math.PI / 2 + 0.35, 0);
    const box = new THREE.Box3().setFromObject(piv), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    piv.position.sub(c);
    const span = Math.max(size.x, size.z, size.y * 1.8);
    cam.position.set(0, 0.25 * span, span * 2.9); cam.lookAt(0, 0, 0);
    r.render(scene, cam);
    out.weapons[id] = canvas.toDataURL('image/png');
    scene.remove(piv);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}

const thumbs = renderThumbs();

// armi
{
  // DPS effettivo: la raffica conta i colpi con la loro pausa
  const dpsOf = w => w.burst ? w.dmg * w.pellets * w.burst / (w.rate + w.burstGap * (w.burst - 1)) : w.dmg * w.pellets / w.rate;
  const maxDps = Math.max(...Object.values(WEAPONS).map(dpsOf));
  // colore: la rarità più frequente per quell'arma
  const rarOf = WEAPON_RAR;
  const html = Object.entries(WEAPONS).map(([id, w], i) => {
    const rc = RARITIES[rarOf[id] ?? 0].color;
    const dps = dpsOf(w);
    const stats = [
      ['Danno', w.dmg * w.pellets, Math.min(1, w.dmg * w.pellets / 110)],
      ['DPS', Math.round(dps), dps / maxDps],
      w.melee ? ['Munizioni', '∞', 1] : ['Caricatore', w.mag, Math.min(1, w.mag / 30)],
      ['Gittata', w.range + 'm', Math.min(1, Math.sqrt(w.range / 600))],
    ];
    return `<article class="weapon reveal" style="--rc:${rc};--d:${(i % 3) * 0.08}s">
      <div class="pic"><img src="${thumbs.weapons[id]}" alt="${w.name}" loading="lazy" /></div>
      <h3>${w.name}<small>${w.melee ? 'Corpo a corpo · bottino del boss' : w.spin ? 'Rotante' : w.auto ? 'Automatica' : w.projectile ? 'Esplosiva' : w.burst ? `Raffica ×${w.burst}` : 'Semi-auto'}</small></h3>
      ${w.desc ? `<p class="wdesc">${w.desc}</p>` : ''}
      ${stats.map(([n, v, k], j) => `<div class="stat"><span>${n}</span><div class="bar"><i style="--v:${(k * 100).toFixed(0)}%;--k:${j}"></i></div><b>${v}</b></div>`).join('')}
    </article>`;
  }).join('');
  $('#weapons').innerHTML = html;
}

// skin
{
  const el = $('#skins');
  el.innerHTML = SKINS.map((s, i) => {
    const r = RARITIES[s.rarity];
    return `<button class="skin reveal${s.id === settings.skin ? ' equipped' : ''}" data-id="${s.id}" style="--rc:${r.color};--d:${(i % 5) * 0.06}s" aria-label="Equipaggia ${s.name}">
      <img src="${thumbs.skins[s.id]}" alt="" />
      <span class="eq">IN USO</span>${s.lock ? `<span class="lk">${s.lock === 'pass' ? '🎟️ Pass' : '🛒 Negozio'}</span>` : ''}
      <span class="info"><b>${s.name}</b><span>${r.name}</span></span>
    </button>`;
  }).join('');
  el.addEventListener('click', e => {
    const b = e.target.closest('.skin');
    if (!b) return;
    const s = SKINS.find(x => x.id === b.dataset.id);
    // v40: le skin del pass e del negozio si sbloccano nel gioco
    if (s.lock) { hero.show(SKINS.indexOf(s)); toast(`🔒 ${s.name} si sblocca ${s.lock === 'pass' ? 'nel pass battaglia della Stagione 2' : 'nel negozio del gioco'}`); return; }
    settings.skin = s.id; saveSettings();
    el.querySelectorAll('.skin').forEach(x => x.classList.toggle('equipped', x === b));
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    hero.show(SKINS.indexOf(s));
    toast(`✅ ${s.name} equipaggiata! La troverai in partita.`);
  });
}
observeReveal();

// ─────────────── Loop ───────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  hero.update(dt, t);
  demo.update(dt);
}
requestAnimationFrame(frame);

window.__site = { hero, demo, thumbs };

// ═════════ v33: anteprima animata dei nuovi mirini dei pompa ═════════
{
  const row = $('#xhDemos');
  if (row) {
    const list = [['pump', 'Fucile a pompa', '4 archi'], ['tactical', 'Pompa tattico', 'archi e pallini'], ['drum', 'Pompa a tamburo', 'archi che ruotano'], ['double', 'Doppietta', 'canne cariche'], ['ar', 'Fucile d’assalto', 'anello e tacche'], ['heavy', 'Assalto pesante', 'anello spesso'], ['burst', 'A raffica', 'paletti e croce'], ['lmg', 'Mitragliatrice', 'anello e croce']];
    const demos = list.map(([style, name, sub]) => {
      const card = document.createElement('div'); card.className = 'xh-card';
      card.innerHTML = `<div class="xh"></div><b>${name}</b><span>${sub}</span>`;
      row.appendChild(card);
      return { style, xh: createCrosshair(card.querySelector('.xh')), t: Math.random() * 2, mag: 1, shot: 0 };
    });
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (const d of demos) {
        d.t += dt; d.shot -= dt;
        if (d.shot <= 0) { d.shot = d.style === 'drum' ? 0.45 : 1.3; d.xh.fire(1); d.mag = d.style === 'double' ? (d.mag <= 0 ? 1 : d.mag - 0.5) : 1; }
        const rate = d.style === 'drum' ? 0.45 : 1.3, ready = d.style === 'pump' ? clamp(1 - d.shot / rate * 1.4 + 0.4, 0, 1) : -1;
        d.xh.update(dt, { show: true, style: d.style, spreadPx: 14 + 10 * (0.5 + 0.5 * Math.sin(d.t * 0.9)), color: '#ffffff', size: 2.1, enemy: Math.sin(d.t * 0.6) > 0.75, outRange: false, sprint: false, reload: -1, ready, mag: d.style === 'double' ? d.mag : 1, use: -1 });
      }
    };
    requestAnimationFrame(loop);
  }
}
