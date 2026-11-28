// ─────────────────────────────────────────────────────────────
//  v38: il combattimento col Gargoyle (boss del Colosseo)
//   · compare solo in alcune partite (non nei duelli); dorme accanto alla statua finché qualcuno
//     scende sulla sabbia, poi ruggisce e caccia chi è nell'arena. Non esce mai dall'arena.
//   · offline e per l'host: simulazione completa; i client vedono la stessa scena dalle istantanee
//     ('boss') e mandano all'host i colpi che gli infliggono ('bhit').
//   · quando muore lascia gli Artigli (arma leggendaria) e un po' di bottino.
//   · effetti condivisi con gli Artigli del giocatore: scie delle artigliate e onde d'urto.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildGargoyle, warmGargoyle, animateGargoyle, hitSpheres, MOVES } from './boss.js?v=45';

export const BOSS_HP = 2200;
export const BOSS_CHANCE = 0.45;           // probabilità che una partita abbia il boss
const STATES = ['sleep', 'idle', 'walk', 'roar', 'swipeR', 'swipeL', 'double', 'pounce', 'spin', 'dead'];
const ROAR_T = 2.0;
const BOSS_R = 1.0;                         // ingombro (raggio) per le collisioni
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const r2 = (v) => Math.round(v * 100) / 100;
const angWrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** altezza del salto durante il balzo (uguale per host e client) */
function airY(st, t) {
  if (st !== 'pounce') return 0;
  const mv = MOVES.pounce, u = t / mv.dur, [a, b] = mv.air;
  if (u <= a || u >= b) return 0;
  return Math.sin(Math.PI * (u - a) / (b - a)) * 2.8;
}

// ═════════════════════ effetti: scie e onde d'urto ═════════════════════
function arcGeo(L, seg = 28) {
  // arco nel piano xz centrato sull'asse +z (da −L/2 a +L/2), più spesso e luminoso verso la fine
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const k = i / seg, a = -L / 2 + L * k, w = 0.12 + 0.88 * Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 0.7;
    const r0 = 1 - 0.28 * w, r1 = 1;
    pos.push(Math.sin(a) * r0, 0, Math.cos(a) * r0, Math.sin(a) * r1, 0, Math.cos(a) * r1);
    const b = Math.pow(k, 1.4);
    col.push(b * 0.55, b * 0.55, b * 0.55, b, b, b);
    if (i < seg) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
export function createClawFX(scene) {
  const GEO = { swipe: arcGeo(2.4), spin: arcGeo(Math.PI * 2 - 0.2, 64), ring: new THREE.RingGeometry(0.82, 1, 48, 1).rotateX(-Math.PI / 2) };
  const pool = [];
  function get(kind) {
    let f = pool.find(p => !p.on && p.kind === kind);
    if (!f) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: kind !== 'ring', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(GEO[kind], mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
      const grp = new THREE.Group(); grp.add(mesh); scene.add(grp);
      f = { kind, grp, mesh, mat, on: false };
      pool.push(f);
    }
    f.on = true; f.grp.visible = true; f.t = 0;
    return f;
  }
  return {
    /** scia di un'artigliata: centro, direzione (yaw), lato (+1 da destra a sinistra), raggio, inclinazione, colore */
    slash(pos, yaw, side = 1, radius = 2, tilt = 0.3, color = '#ffe6b0', life = 0.26) {
      const f = get('swipe');
      f.grp.position.copy(pos); f.grp.rotation.set(0, yaw, 0);
      f.mesh.rotation.set(0, 0, 0); f.mesh.scale.set(side * radius, radius, radius);
      f.mesh.rotateZ(tilt * side); f.mat.color.set(color);
      f.life = life; f.grow = 0.12; f.r = radius;
      return f;
    },
    spin(pos, yaw, radius = 2.4, color = '#ffe6b0') {
      const f = get('spin');
      f.grp.position.copy(pos); f.grp.rotation.set(0, yaw, 0);
      f.mesh.rotation.set(0, 0, 0); f.mesh.scale.set(-radius, radius, radius); f.mat.color.set(color);
      f.life = 0.35; f.grow = 0.1; f.r = radius;
      return f;
    },
    ring(pos, radius = 3, color = '#ffd9a0') {
      const f = get('ring');
      f.grp.position.copy(pos); f.grp.position.y += 0.08; f.grp.rotation.set(0, 0, 0);
      f.mesh.scale.setScalar(radius * 0.3); f.mat.color.set(color);
      f.life = 0.5; f.grow = -1; f.r = radius;
      return f;
    },
    update(dt) {
      for (const f of pool) {
        if (!f.on) continue;
        f.t += dt;
        const k = f.t / f.life;
        if (k >= 1) { f.on = false; f.grp.visible = false; continue; }
        f.mat.opacity = (1 - k) * (1 - k);
        if (f.grow < 0) f.mesh.scale.setScalar(f.r * (0.3 + 0.7 * Math.sqrt(k)));
        else { const s = 1 + f.grow * k; f.grp.scale.setScalar(s); }
      }
    },
    reset() { for (const f of pool) { f.on = false; f.grp.visible = false; } },
  };
}

// ═════════════════════ il boss ═════════════════════
/**
 * ctx: { scene, G, camera, TOWNS, groundAt, damage, emit, spawnLoot, addFeed, showMsg, A, fx,
 *        net: () => ({ on, host, client }), send(m), onPlayerHit(amount, head, pos), shake(k) }
 */
export function createBossFight(ctx) {
  const { scene, G, camera, groundAt, damage, emit, spawnLoot, addFeed, A, fx } = ctx;
  let B = null;
  let R = null;                 // modello (riusato fra le partite)
  setTimeout(warmGargoyle, 1500);   // v39: la scultura si prepara a pezzi mentre si è nel menu
  const hud = document.createElement('div');
  hud.id = 'bossBar';
  hud.className = 'hidden';
  hud.innerHTML = '<div class="bn">🦇 GARGOYLE DEL COLOSSEO</div><div class="bb"><i></i><b></b></div>';
  document.body.appendChild(hud);
  const hudFill = hud.querySelector('i'), hudLag = hud.querySelector('b');
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();

  const net = () => ctx.net();
  const authority = () => { const n = net(); return !n.on || n.host; };

  function spawn() {
    clear();
    const town = ctx.TOWNS.find(t => t.arena);
    if (!town) return false;
    if (!R) R = buildGargoyle();
    R.root.visible = true;
    scene.add(R.root);
    R._st = null; R._cur = null;
    const a = Math.PI * 0.25;
    const cx = town.x, cz = town.z, rf = town.arenaR || 30;
    const x = cx + Math.cos(a) * 9, z = cz + Math.sin(a) * 9;
    const y = groundAt(x, z, town.h + 3);
    B = {
      town, cx, cz, rf, home: new THREE.Vector3(x, y, z), pos: new THREE.Vector3(x, y, z), yaw: Math.atan2(cx - x, cz - z) + Math.PI,
      hp: BOSS_HP, max: BOSS_HP, shownHp: BOSS_HP, st: 'sleep', t: 0, phase: 0, run: 0, target: null, lostT: 0, cd: 0, pounceCd: 3, roarCd: 0,
      hitDone: false, lastHurtT: -99, hurtK: 0, combo: 0, deadT: 0, lunge: 0, net: null, sendT: 0, unreach: 0, flapT: 0, growlT: 4, prevT: 0,
    };
    B.floorY = y;
    R.root.position.copy(B.pos); R.root.rotation.y = B.yaw;
    animateGargoyle(R, B, 0, 0);
    return true;
  }
  function clear() {
    if (R) { scene.remove(R.root); }
    B = null;
    hud.classList.add('hidden');
  }

  function setState(st) { B.st = st; B.t = 0; B.prevT = 0; B.hitDone = false; }

  // ── chi può essere attaccato: vivo, a terra, sulla sabbia dell'arena ──
  function onFloor(c) {
    if (!c.alive || c.mode === 'bus' || c.mode === 'fall' || c.mode === 'glide') return false;
    const d = Math.hypot(c.pos.x - B.cx, c.pos.z - B.cz);
    return d < B.rf + 0.3 && c.pos.y < B.floorY + 6;
  }
  const reachable = (c) => c.pos.y < B.floorY + 2.4;

  /** sposta il boss (con le colonne, la statua e il muro del podio) */
  function moveBy(dx, dz) {
    let x = B.pos.x + dx, z = B.pos.z + dz;
    // muro del podio
    let rx = x - B.cx, rz = z - B.cz, d = Math.hypot(rx, rz);
    const lim = B.rf - BOSS_R - 0.4;
    if (d > lim) { x = B.cx + rx / d * lim; z = B.cz + rz / d * lim; }
    // statua al centro (base 5×5 m) e colonne libere
    rx = x - B.cx; rz = z - B.cz; d = Math.hypot(rx, rz);
    const sr = 3.6 + BOSS_R * 0.5;
    if (d < sr) { const k = d > 1e-3 ? sr / d : 0; x = B.cx + (d > 1e-3 ? rx * k : sr); z = B.cz + (d > 1e-3 ? rz * k : 0); }
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3, px = B.cx + Math.cos(a) * 22, pz = B.cz + Math.sin(a) * 22;
      const ex = x - px, ez = z - pz, e = Math.hypot(ex, ez), mr = 1.05 + BOSS_R;
      if (e < mr && e > 1e-3) { x = px + ex / e * mr; z = pz + ez / e * mr; }
    }
    B.pos.x = x; B.pos.z = z;
    B.pos.y = groundAt(x, z, B.pos.y + 0.6);
  }
  function faceTo(tx, tz, rate, dt) {
    const want = Math.atan2(tx - B.pos.x, tz - B.pos.z);
    const d = angWrap(want - B.yaw);
    B.yaw = angWrap(B.yaw + clamp(d, -rate * dt, rate * dt));
    return Math.abs(d);
  }

  // ── danni del boss ──
  function hurtChar(c, amt) {
    const n = net();
    if (n.on && n.host && c.remote) { const prev = G.netForce; G.netForce = true; try { damage(c, amt, null, false, 'Gargoyle'); } finally { G.netForce = prev; } }
    else damage(c, amt, null, false, 'Gargoyle');
    // spinta all'indietro (solo per chi simuliamo qui: il giocatore e i bot)
    if (!c.remote && c.alive) {
      const dx = c.pos.x - B.pos.x, dz = c.pos.z - B.pos.z, d = Math.hypot(dx, dz) || 1;
      c.vel.x += dx / d * 7; c.vel.z += dz / d * 7;
      if (c.onGround) { c.vel.y = Math.max(c.vel.y, 3.2); c.onGround = false; }
    }
  }
  function strike(mv, id) {
    const fxz = Math.sin(B.yaw), fzz = Math.cos(B.yaw);
    const ix = B.pos.x + fxz * 2.1, iz = B.pos.z + fzz * 2.1;
    for (const c of G.chars) {
      if (!c.alive || c.mode === 'bus' || c.mode === 'fall') continue;
      const dx = c.pos.x - B.pos.x, dz = c.pos.z - B.pos.z, d = Math.hypot(dx, dz);
      const dy = c.pos.y - B.pos.y;
      if (dy < -1.5 || dy > (id === 'spin' || id === 'double' ? 3.6 : 3.0)) continue;
      const ang = Math.abs(angWrap(Math.atan2(dx, dz) - B.yaw));
      let hit = d <= mv.reach + 0.45 && ang <= mv.arc;
      if (!hit && mv.aoe) hit = Math.hypot(c.pos.x - ix, c.pos.z - iz) <= mv.aoe;
      if (hit) hurtChar(c, mv.dmg);
    }
  }
  /** il ruggito di chi è irraggiungibile (sulla statua, sulle colonne): onda d'urto che stordisce */
  function shout() {
    for (const c of G.chars) {
      if (!onFloor(c)) continue;
      const d = Math.hypot(c.pos.x - B.pos.x, c.pos.z - B.pos.z);
      if (d < 13) hurtChar(c, 18);
    }
  }

  // ── effetti visivi e sonori delle mosse (anche sui client) ──
  function moveFX(id) {
    const dist = B.pos.distanceTo(camera.position);
    const fwd = _v.set(Math.sin(B.yaw), 0, Math.cos(B.yaw));
    if (id === 'swipeR' || id === 'swipeL') {
      fx.slash(_w.copy(B.pos).addScaledVector(fwd, 0.4).setY(B.pos.y + 2.0), B.yaw, id === 'swipeR' ? 1 : -1, 3.4, 0.35, '#ffcf8a');
      A.playGun('clawHeavy', dist);
    } else if (id === 'spin') {
      fx.spin(_w.copy(B.pos).setY(B.pos.y + 1.7), B.yaw, 3.6, '#ffcf8a');
      A.playGun('clawHeavy', dist);
    } else if (id === 'double' || id === 'pounce') {
      const at = _w.copy(B.pos).addScaledVector(fwd, 2.1);
      at.y = groundAt(at.x, at.z, B.pos.y + 1);
      fx.ring(at, (MOVES[id].aoe || 3) * 1.3, '#ffd9a0');
      emit(at, '#d9c39a', 26, 6, 0.9, 0.3, 0.4);
      emit(at, '#8a7a5a', 12, 3, 1.2, 0.4, -0.2);
      A.playGun('slam', dist);
      if (ctx.shake) ctx.shake(clamp(1 - dist / 30, 0, 1) * 0.8);
    }
  }

  // ── simulazione (offline / host) ──
  function think(dt) {
    B.cd = Math.max(0, B.cd - dt); B.pounceCd = Math.max(0, B.pounceCd - dt); B.roarCd = Math.max(0, B.roarCd - dt);
    if (B.st === 'dead') return;
    // rigenerazione quando nessuno lo impegna
    if (G.time - B.lastHurtT > 6 && (!B.target || B.st === 'sleep')) B.hp = Math.min(B.max, B.hp + dt * 45);
    const mv = MOVES[B.st];
    if (B.st === 'sleep') {
      if (G.chars.some(c => onFloor(c) && reachable(c))) wake();
      return;
    }
    if (B.st === 'roar') {
      if (B.shouting && !B.hitDone && B.t > 0.55) { B.hitDone = true; shout(); }
      if (B.t >= ROAR_T) { B.shouting = false; setState('idle'); B.cd = 0.2; }
      return;
    }
    if (mv) {
      const u = B.t / mv.dur;
      const tgt = B.target;
      // carica: continua a girarsi verso il bersaglio, poi si impegna
      if (tgt && u < mv.hit - 0.12) faceTo(tgt.pos.x, tgt.pos.z, 3.2, dt);
      // scatto in avanti
      if (B.st === 'pounce') {
        const [a, b] = mv.air;
        if (u > a && u < b) { const sp = B.lunge / ((b - a) * mv.dur); moveBy(Math.sin(B.yaw) * sp * dt, Math.cos(B.yaw) * sp * dt); }
      } else {
        const a = mv.hit - 0.2, b = mv.hit + 0.02;
        if (u > a && u < b) { const sp = B.lunge / ((b - a) * mv.dur); moveBy(Math.sin(B.yaw) * sp * dt, Math.cos(B.yaw) * sp * dt); }
      }
      if (!B.hitDone && u >= mv.hit) { B.hitDone = true; strike(mv, B.st); }
      if (u >= 1) { setState('idle'); B.cd = 0.15 + Math.random() * 0.45; }
      return;
    }
    // ── a caccia ──
    let tgt = B.target;
    if (!tgt || !onFloor(tgt)) {
      tgt = null; let bd = Infinity;
      for (const c of G.chars) { if (!onFloor(c)) continue; const d = c.pos.distanceToSquared(B.pos); if (d < bd) { bd = d; tgt = c; } }
      B.target = tgt;
    }
    if (!tgt) {
      B.lostT += dt;
      const dh = Math.hypot(B.home.x - B.pos.x, B.home.z - B.pos.z);
      if (dh > 1.2) walkTo(B.home.x, B.home.z, 3.0, dt);
      else { B.st = 'idle'; B.run = 0; if (B.lostT > 14) setState('sleep'); }
      return;
    }
    B.lostT = 0;
    const dx = tgt.pos.x - B.pos.x, dz = tgt.pos.z - B.pos.z, d = Math.hypot(dx, dz);
    // irraggiungibile (in cima alla statua o a una colonna): gli sta sotto e ruggisce
    if (!reachable(tgt)) {
      B.unreach += dt;
      if (d < 11 && B.roarCd <= 0 && B.unreach > 1.5) { roar(true); return; }
      if (d > 4.5) walkTo(tgt.pos.x, tgt.pos.z, 4, dt); else { B.st = 'idle'; faceTo(tgt.pos.x, tgt.pos.z, 4, dt); }
      return;
    }
    B.unreach = 0;
    const off = faceTo(tgt.pos.x, tgt.pos.z, d < 6 ? 5.5 : 3.5, dt);
    if (d < 3.6 && B.cd <= 0 && off < 0.7) {
      const r = Math.random();
      const id = B.combo === 2 ? (r < 0.5 ? 'double' : 'spin') : r < 0.5 ? 'swipeR' : 'swipeL';
      B.combo = (B.combo + 1) % 3;
      attack(id, d);
      return;
    }
    if (d > 6 && d < 14 && B.pounceCd <= 0 && B.cd <= 0 && off < 0.35) { attack('pounce', d); B.pounceCd = 5 + Math.random() * 3; return; }
    if (d > 3.0) walkTo(tgt.pos.x, tgt.pos.z, d > 7 ? 7.4 : 3.6, dt, true);
    else { B.st = 'idle'; B.run = 0; }
  }
  function walkTo(tx, tz, speed, dt, faced = false) {
    if (!faced) faceTo(tx, tz, 3.5, dt);
    B.st = 'walk';
    B.run = lerp(B.run, speed > 5 ? 1 : 0, Math.min(1, dt * 4));
    const sp = speed * (0.35 + 0.65 * Math.cos(Math.min(1.2, Math.abs(angWrap(Math.atan2(tx - B.pos.x, tz - B.pos.z) - B.yaw)))));
    moveBy(Math.sin(B.yaw) * sp * dt, Math.cos(B.yaw) * sp * dt);
    B.phase += dt * sp * (B.run > 0.5 ? 1.25 : 1.9);
  }
  function attack(id, d) {
    setState(id);
    const mv = MOVES[id];
    B.lunge = id === 'pounce' ? clamp(d - 2.2, 3, 11) : clamp(d - 2.0, 0, mv.lunge);
    if (id === 'pounce') A.playGun('flap', B.pos.distanceTo(camera.position));
  }
  function wake() {
    roar(false);
    const p = G.player;
    if (p && p.alive && p.pos.distanceTo(B.pos) < 90) { ctx.showMsg && ctx.showMsg('🦇 IL GARGOYLE SI È SVEGLIATO!', 'Resta lontano dagli artigli… o sconfiggilo per prenderli', 3.5); }
  }
  function roar(shouting) {
    setState('roar');
    B.shouting = shouting; B.roarCd = 7;
    A.playGun('roar', B.pos.distanceTo(camera.position));
    if (ctx.shake) ctx.shake(clamp(1 - B.pos.distanceTo(camera.position) / 40, 0, 1) * 0.5);
  }

  // ── danni al boss ──
  function hurt(amount, attacker, head = false, at = null) {
    if (!B || B.st === 'dead' || amount <= 0) return;
    const n = net();
    let amt = amount * (head ? 1.4 : 1);
    if (attacker && !onFloor(attacker)) amt *= 0.4;                  // dagli spalti si fa poco male
    amt = Math.max(1, Math.round(amt));
    if (n.on && n.client) {
      // client: decide l'host; qui solo i miei colpi (inviati) e una stima della salute
      if (attacker !== G.player) return;
      ctx.send({ t: 'bhit', a: amt });
      B.hp = Math.max(1, B.hp - amt); B.hurtK = 1;
      if (ctx.onPlayerHit) ctx.onPlayerHit(amt, head, at || _v.copy(B.pos).setY(B.pos.y + 2.6));
      return;
    }
    if (n.on && n.host && attacker && attacker.remote) return;          // i colpi degli altri giocatori arrivano come 'bhit'
    if (attacker === G.player && ctx.onPlayerHit) ctx.onPlayerHit(amt, head, at || _v.copy(B.pos).setY(B.pos.y + 2.6));
    applyHurt(amt, attacker);
  }
  function applyHurt(amt, attacker) {
    if (!B || B.st === 'dead') return;
    B.hp -= amt; B.lastHurtT = G.time; B.hurtK = 1;
    if (Math.random() < 0.12) A.playGun('bossHurt', B.pos.distanceTo(camera.position));
    if (B.st === 'sleep') wake();
    if (attacker && attacker.alive && onFloor(attacker) && (!B.target || Math.random() < 0.25)) B.target = attacker;
    if (B.hp <= 0) die(attacker);
  }
  function die(attacker) {
    B.hp = 0; setState('dead'); B.deadT = 0;
    A.playGun('bossDie', B.pos.distanceTo(camera.position));
    // bottino: gli Artigli e qualcosa per curarsi
    const drop = (it, a, r) => {
      const x = B.pos.x + Math.cos(a) * r, z = B.pos.z + Math.sin(a) * r;
      spawnLoot(it, new THREE.Vector3(x, groundAt(x, z, B.pos.y + 1.5), z), true);
    };
    drop({ kind: 'weapon', id: 'claws', rarity: 4, mag: 0 }, B.yaw, 0.6);
    drop({ kind: 'cons', id: 'shield', count: 1 }, B.yaw + 2.1, 1.6);
    drop({ kind: 'cons', id: 'medkit', count: 1 }, B.yaw - 2.1, 1.6);
    deathFeed(attacker);
    if (net().on) ctx.send({ t: 'bdead', a: attacker ? attacker.idx : -1 });
  }
  function deathFeed(attacker) {
    addFeed(attacker ? `<b>${ctx.esc(attacker.name)}</b> ha sconfitto il Gargoyle! 🦇 Gli Artigli sono a terra` : 'Il Gargoyle è caduto! 🦇', attacker === G.player);
    if (attacker === G.player && ctx.showMsg) ctx.showMsg('🏆 GARGOYLE SCONFITTO!', 'Raccogli gli Artigli del Gargoyle', 4);
  }

  // ── rete ──
  function sendSnap() {
    const now = performance.now();
    if (now - B.sendT < 100) return;
    if (B.st === 'dead' && B.deadT > 4) return;
    if (B.st === 'sleep' && now - B.sendT < 1000) return;
    B.sendT = now;
    ctx.send({ t: 'boss', s: [r2(B.pos.x), r2(B.pos.y), r2(B.pos.z), r2(B.yaw), STATES.indexOf(B.st), r2(B.t), Math.round(B.hp), r2(B.phase), r2(B.run)] });
  }
  function onNet(m, sender) {
    if (m.t === 'boss') {
      if (!B) spawn();
      if (!B) return;
      const s = m.s;
      B.net = { x: s[0], y: s[1], z: s[2], yaw: s[3], st: STATES[s[4]] || 'idle', t: s[5], hp: s[6], phase: s[7], run: s[8] };
      return;
    }
    if (m.t === 'bhit') { if (B && authority() && sender) applyHurt(Math.min(400, +m.a || 0), sender); return; }
    if (m.t === 'bdead') {
      if (!B) return;
      if (B.st !== 'dead') { B.hp = 0; setState('dead'); A.playGun('bossDie', B.pos.distanceTo(camera.position)); }
      deathFeed(m.a >= 0 ? G.chars[m.a] : null);
    }
  }
  function follow(dt) {
    const n = B.net;
    if (!n) return;
    const k = Math.min(1, dt * 10);
    if (Math.hypot(n.x - B.pos.x, n.z - B.pos.z) > 8) B.pos.set(n.x, n.y, n.z);
    B.pos.x += (n.x - B.pos.x) * k; B.pos.y += (n.y - B.pos.y) * k; B.pos.z += (n.z - B.pos.z) * k;
    B.yaw = angWrap(B.yaw + angWrap(n.yaw - B.yaw) * k);
    if (n.st !== B.st) { if (B.st !== 'dead') { const prev = B.st; setState(n.st); B.t = n.t; B.prevT = n.t; if (n.st === 'roar' && prev !== 'roar') A.playGun('roar', B.pos.distanceTo(camera.position)); } }
    else if (Math.abs(B.t - n.t) > 0.3 && B.st !== 'dead') { B.t = n.t; B.prevT = n.t; }
    B.phase = B.st === 'walk' ? lerp(B.phase, n.phase, k) : n.phase;
    B.run = n.run;
    if (n.hp < B.hp - 0.5 || n.hp > B.hp + 40) B.hp = n.hp;
    n.t += dt;
  }

  // ── ciclo ──
  let animSkip = 0;
  function update(dt) {
    if (!B) return;
    const n = net();
    const sim = !n.on || n.host;
    const prevT = B.t;
    B.t += dt;
    if (sim) { think(dt); if (n.on) sendSnap(); }
    else follow(dt);
    if (B.st === 'dead') B.deadT += dt;
    // effetti all'istante del colpo (uguali per tutti)
    const mv = MOVES[B.st];
    if (mv && prevT / mv.dur < mv.hit && B.t / mv.dur >= mv.hit) moveFX(B.st);
    if (B.st === 'pounce' && mv && prevT / mv.dur < mv.air[0] && B.t / mv.dur >= mv.air[0]) emit(_w.copy(B.pos).setY(B.pos.y + 0.2), '#d9c39a', 14, 4, 0.6, 0.25, 0.3);
    // ali che sbattono e ringhi occasionali
    if (B.st === 'roar' || B.st === 'pounce') { B.flapT -= dt; if (B.flapT <= 0) { B.flapT = 0.32; A.playGun('flap', B.pos.distanceTo(camera.position)); } }
    if (B.st === 'walk' || B.st === 'idle') { B.growlT -= dt; if (B.growlT <= 0) { B.growlT = 4 + Math.random() * 5; A.playGun('growl', B.pos.distanceTo(camera.position)); } }
    B.hurtK = Math.max(0, B.hurtK - dt * 5);
    // nessuno gli passa attraverso: spinge via chi gli sta addosso
    if (B.st !== 'dead') for (const c of G.chars) {
      if (c.remote || !c.alive || c.mode !== 'ground') continue;
      const dx = c.pos.x - B.pos.x, dz = c.pos.z - B.pos.z, dy = c.pos.y - B.pos.y - airY(B.st, B.t);
      if (dy < -1 || dy > 3 || Math.abs(dx) > 1.6 || Math.abs(dz) > 1.6) continue;
      const d = Math.hypot(dx, dz), mr = BOSS_R + 0.35;
      if (d < mr) { const k = d > 1e-3 ? (mr - d) / d : 1; c.pos.x += (d > 1e-3 ? dx : 1) * k; c.pos.z += (d > 1e-3 ? dz : 0) * k; }
    }
    // modello
    const camD = B.pos.distanceTo(camera.position);
    R.root.visible = camD < 420 && !(B.st === 'dead' && B.deadT > 30);
    if (B.st === 'dead' && B.deadT > 22) R.root.position.y = B.pos.y - (B.deadT - 22) * 0.25;   // sprofonda nella sabbia
    else R.root.position.set(B.pos.x, B.pos.y + airY(B.st, B.t), B.pos.z);
    R.root.position.x = B.pos.x; R.root.position.z = B.pos.z;
    R.root.rotation.y = B.yaw;
    if (R.root.visible) {
      animSkip = (animSkip + 1) % (camD > 160 ? 4 : camD > 80 ? 2 : 1);
      if (animSkip === 0) animateGargoyle(R, B, dt * (camD > 160 ? 4 : camD > 80 ? 2 : 1), G.time, B.hurtK * (MOVES[B.st] ? 0.3 : 1));
    }
    // barra della salute
    const p = G.player;
    const show = B.st !== 'sleep' && (B.st !== 'dead' || B.deadT < 3) && p && (p.alive || G.spectate) && camD < 110;
    hud.classList.toggle('hidden', !show);
    if (show) {
      const k = clamp(B.hp / B.max, 0, 1);
      B.shownHp = lerp(B.shownHp, k, Math.min(1, dt * 2.5));
      hudFill.style.width = (k * 100).toFixed(1) + '%';
      hudLag.style.width = (Math.max(k, B.shownHp) * 100).toFixed(1) + '%';
    }
  }

  // ── colpi dei proiettili ──
  const _o = new THREE.Vector3();
  /** distanza lungo il raggio dove colpisce il boss (null se lo manca); { t, head } */
  function ray(o, d, maxDist) {
    if (!B || B.st === 'dead' || !R || !R.root.visible) return null;
    // controllo rapido: sfera che contiene tutto il corpo
    _o.copy(B.pos); _o.y += 1.8 + airY(B.st, B.t);
    const ox = _o.x - o.x, oy = _o.y - o.y, oz = _o.z - o.z;
    const tc = ox * d.x + oy * d.y + oz * d.z;
    if (tc < -4 || tc > maxDist + 4) return null;
    const cx = ox - d.x * tc, cy = oy - d.y * tc, cz = oz - d.z * tc;
    if (cx * cx + cy * cy + cz * cz > 16) return null;
    let best = Infinity, head = false;
    for (const [c, r, h] of hitSpheres(R)) {
      const lx = c.x - o.x, ly = c.y - o.y, lz = c.z - o.z;
      const t = lx * d.x + ly * d.y + lz * d.z;
      const q = lx * lx + ly * ly + lz * lz - t * t;
      if (q > r * r) continue;
      const th = t - Math.sqrt(r * r - q);
      if (th >= 0 && th < best && th <= maxDist) { best = th; head = h; }
    }
    return best < Infinity ? { t: best, head } : null;
  }
  /** centro del corpo (per esplosioni e artigli) */
  function center(out = new THREE.Vector3()) { return B ? out.copy(B.pos).setY(B.pos.y + 1.8 + airY(B.st, B.t)) : null; }

  return {
    spawn, clear, update, ray, hurt, onNet, center,
    get active() { return !!B && B.st !== 'dead'; },
    get boss() { return B; },
  };
}
