// ─────────────────────────────────────────────────────────────
//  Eventi della mappa: rifornimenti, pioggia di meteoriti, nebbia, bufera,
//  bottino d'oro e gravità ridotta. Li decide l'host (o il gioco offline) e
//  arrivano a tutti con un messaggio { t: 'evt' } → stesso spettacolo per tutti.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const EVENT_DEFS = {
  drop: { icon: '📦', name: 'Rifornimento aereo', dur: 60, w: 3, color: '#4ab8ff', sub: 'Una cassa leggendaria sta scendendo col paracadute: segui il raggio azzurro!' },
  meteor: { icon: '☄️', name: 'Pioggia di meteoriti', dur: 28, w: 2, color: '#ff7a2a', sub: 'Meteoriti in arrivo! Allontanati dai cerchi rossi' },
  fog: { icon: '🌫️', name: 'Nebbia fitta', dur: 60, w: 1.5, color: '#cfd8e0', sub: "La visibilità crolla: ottimo per gli agguati" },
  blizzard: { icon: '❄️', name: 'Bufera di neve', dur: 50, w: 1, color: '#e6f2ff', sub: "Neve e vento su tutta l'isola" },
  gold: { icon: '✨', name: "Bottino d'oro", dur: 60, w: 1.5, color: '#ffd24a', sub: 'I forzieri contengono armi di rarità superiore!' },
  lowgrav: { icon: '🪐', name: 'Gravità ridotta', dur: 35, w: 1.5, color: '#b58cff', sub: 'Salti altissimi per 35 secondi' },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEvents(api) {
  const { scene, G } = api;
  const E = { active: [], next: 80, last: '', drops: [], meteors: [], craters: [] };

  // ── materiali e geometrie condivise ──
  const meteorGeo = new THREE.IcosahedronGeometry(1.1, 0);
  const meteorMat = new THREE.MeshStandardMaterial({ color: '#4a2a1a', emissive: '#ff5a10', emissiveIntensity: 2.2, flatShading: true, roughness: 0.8 });
  const glowGeo = new THREE.SphereGeometry(1.9, 10, 8);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ringGeo = new THREE.RingGeometry(5.2, 6, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const craterGeo = new THREE.CircleGeometry(4.2, 14).rotateX(-Math.PI / 2);
  const craterMat = new THREE.MeshBasicMaterial({ color: '#1a1410', transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 260, 10, 1, true).translate(0, 130, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#4ab8ff', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const crateMat = new THREE.MeshStandardMaterial({ color: '#3a6ad8', roughness: 0.5, metalness: 0.3 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: 0.4, metalness: 0.6, emissive: '#6a4a00', emissiveIntensity: 0.6 });
  const chuteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 });
  const lineMat = new THREE.LineBasicMaterial({ color: '#333333' });

  function makeChute() {
    const g = new THREE.SphereGeometry(3.4, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2.4).toNonIndexed();
    const P = g.attributes.position, C = [];
    for (let i = 0; i < P.count; i += 3) {
      const a = Math.atan2(P.getZ(i) + P.getZ(i + 1) + P.getZ(i + 2), P.getX(i) + P.getX(i + 1) + P.getX(i + 2));
      const c = new THREE.Color(Math.floor((a + Math.PI) / (Math.PI / 6)) % 2 ? '#e8463a' : '#ffffff');
      for (let k = 0; k < 3; k++) C.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.computeVertexNormals();
    return g;
  }
  const chuteGeo = makeChute();
  const lineGeo = (() => {
    const pts = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pts.push(0, 0.6, 0, Math.cos(a) * 3.1, 4.6, Math.sin(a) * 3.1); }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  })();

  function makeCrate() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.5), crateMat);
    box.position.y = 0.6; box.castShadow = true; g.add(box);
    for (const y of [0.08, 1.12]) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.14, 1.58), trimMat); t.position.y = y; g.add(t); }
    for (const [x, z] of [[0.72, 0.72], [-0.72, 0.72], [0.72, -0.72], [-0.72, -0.72]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), trimMat); t.position.set(x, 0.6, z); g.add(t); }
    const chute = new THREE.Group();
    const dome = new THREE.Mesh(chuteGeo, chuteMat); dome.position.y = 4.4; chute.add(dome);
    chute.add(new THREE.LineSegments(lineGeo, lineMat));
    g.add(chute);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.renderOrder = 3;
    g.add(beam);
    g.userData = { chute, beam };
    return g;
  }

  const isAuth = () => api.isAuthority();
  const landAt = (x, z) => api.terrainHeight(x, z) > api.WATER_LEVEL + 0.6;

  /** sceglie e lancia un nuovo evento (solo host / offline) */
  function schedule() {
    const keys = Object.keys(EVENT_DEFS).filter(k => k !== E.last && !E.active.some(a => a.k === k));
    let tot = 0; for (const k of keys) tot += EVENT_DEFS[k].w;
    let r = Math.random() * tot, k = keys[0];
    for (const kk of keys) { r -= EVENT_DEFS[kk].w; if (r <= 0) { k = kk; break; } }
    const s = G.storm, msg = { t: 'evt', k, seed: Math.floor(Math.random() * 1e9), dur: EVENT_DEFS[k].dur };
    const cx = s ? s.tx : 0, cz = s ? s.tz : 0, cr = s ? Math.max(40, s.tr * 0.8) : 300;
    if (k === 'drop') {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * cr, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (Math.abs(x) < api.HALF - 40 && Math.abs(z) < api.HALF - 40 && landAt(x, z)) { msg.x = Math.round(x); msg.z = Math.round(z); break; }
      }
      if (msg.x === undefined) return;
    } else if (k === 'meteor') {
      // vicino a qualcuno di vivo dentro la zona sicura (offline: spesso vicino a te)
      const alive = G.chars.filter(c => c.alive && c.mode === 'ground' && (!s || Math.hypot(c.pos.x - s.cx, c.pos.z - s.cz) < s.r));
      if (!alive.length) return;
      const tgt = (!G.net && G.player && G.player.alive && Math.random() < 0.45) ? G.player : alive[Math.floor(Math.random() * alive.length)];
      msg.x = Math.round(tgt.pos.x + (Math.random() - 0.5) * 40); msg.z = Math.round(tgt.pos.z + (Math.random() - 0.5) * 40);
    }
    E.last = k;
    if (G.net) api.send(msg);
    start(msg);
  }

  function nearestTown(x, z) {
    let best = null, bd = Infinity;
    for (const t of api.TOWNS) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } }
    return best ? (bd < best.r + 40 ? best.name : 'vicino a ' + best.name) : '';
  }

  /** avvia un evento (locale o ricevuto dall'host) */
  function start(msg) {
    const def = EVENT_DEFS[msg.k];
    if (!def) return;
    const ev = { k: msg.k, t: 0, dur: msg.dur || def.dur, x: msg.x, z: msg.z, rnd: mulberry32(msg.seed || 1) };
    E.active.push(ev);
    const where = msg.x !== undefined ? ' · ' + nearestTown(msg.x, msg.z) : '';
    api.showMsg(def.icon + ' ' + def.name.toUpperCase(), def.sub + where, 4);
    api.addFeed(`<span style="color:${def.color}">${def.icon} <b>${def.name}</b></span>${where}`);
    api.playAlert && api.playAlert();
    if (ev.k === 'drop') {
      const g = makeCrate(), gy = api.terrainHeight(ev.x, ev.z);
      g.position.set(ev.x, gy + 150, ev.z);
      scene.add(g);
      E.drops.push({ g, x: ev.x, z: ev.z, gy, landed: false, life: 0, smokeT: 0 });
    } else if (ev.k === 'meteor') {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = ev.rnd() * 6.283, d = Math.sqrt(ev.rnd()) * 85;
        const x = ev.x + Math.cos(a) * d, z = ev.z + Math.sin(a) * d;
        const T = 3 + ev.rnd() * (ev.dur - 5);
        const dir = new THREE.Vector3(ev.rnd() - 0.5, 0, ev.rnd() - 0.5).normalize().multiplyScalar(70);
        E.meteors.push({ x, z, T, dir, ring: null, mesh: null, done: false });
      }
    }
  }

  function impact(m, gy) {
    const at = new THREE.Vector3(m.x, gy + 0.6, m.z);
    api.explode(at, null, 55, 7.5, 'Meteorite');
    api.emit(at, '#ffcf6a', 30, 12, 0.9, 0.3, 0.8);
    api.emit(at, '#5a4a40', 22, 6, 1.6, 0.6, -0.2);
    const c = new THREE.Mesh(craterGeo, craterMat.clone());
    c.position.set(m.x, gy + 0.08, m.z);
    c.rotation.y = Math.random() * 6;
    scene.add(c);
    E.craters.push({ mesh: c, life: 25, smokeT: 0 });
  }

  function update(dt) {
    if (G.state !== 'play') return;
    // programmazione (host / offline): il primo evento dopo ~80 s, poi ogni 70–110 s
    if (isAuth() && G.time > E.next) {
      E.next = G.time + 70 + Math.random() * 40;
      schedule();
    }
    // effetti continui
    let fogT = 1, blizT = 0;
    G.gravK = 1; G.goldT = 0;
    for (const ev of E.active) {
      ev.t += dt;
      const fade = Math.min(1, ev.t / 4, (ev.dur - ev.t) / 4);
      if (ev.k === 'fog') fogT = Math.min(fogT, 1 - 0.7 * fade);
      if (ev.k === 'blizzard') { blizT = Math.max(blizT, fade); fogT = Math.min(fogT, 1 - 0.5 * fade); }
      if (ev.k === 'lowgrav') G.gravK = 0.4;
      if (ev.k === 'gold') G.goldT = ev.dur - ev.t;
    }
    for (let i = E.active.length - 1; i >= 0; i--) {
      const ev = E.active[i];
      if (ev.t >= ev.dur) { E.active.splice(i, 1); if (ev.k === 'lowgrav' || ev.k === 'gold') api.addFeed(`${EVENT_DEFS[ev.k].icon} ${EVENT_DEFS[ev.k].name}: finito`); }
    }
    const W = api.weather;
    W.fogMul += (fogT - W.fogMul) * Math.min(1, dt * 0.6);
    W.blizzard += (blizT - W.blizzard) * Math.min(1, dt * 0.5);
    // sole dorato durante il bottino d'oro
    if (api.sun) { const k = G.goldT > 0 ? Math.min(1, G.goldT / 3) : 0; api.sun.color.lerpColors(api.sunBase, api.sunGold, k * 0.8); }

    // rifornimenti
    for (let i = E.drops.length - 1; i >= 0; i--) {
      const d = E.drops[i];
      d.g.userData.beam.material.opacity = 0.22 + 0.08 * Math.sin(G.time * 4);
      if (!d.landed) {
        d.g.position.y -= 8 * dt;
        d.g.rotation.y += dt * 0.4;
        d.g.userData.chute.rotation.z = Math.sin(G.time * 1.3) * 0.08;
        if (d.g.position.y <= d.gy) {
          d.g.position.y = d.gy; d.landed = true;
          d.g.userData.chute.visible = false;
          api.emit(new THREE.Vector3(d.x, d.gy + 0.5, d.z), '#d8c8a0', 20, 5, 1, 0.4, -0.1);
          if (isAuth()) {
            const items = [api.randomWeapon(3), null, { kind: 'cons', id: 'shield', count: 1, rarity: 3 }, { kind: 'mats', count: 60 }, api.randomWeapon(2)];
            items[1] = api.ammoFor(items[0].id);
            items.forEach((it, k) => {
              const a = k / items.length * 6.283, x = d.x + Math.cos(a) * 1.7, z = d.z + Math.sin(a) * 1.7;
              api.spawnLoot(it, new THREE.Vector3(x, api.groundAt(x, z, d.gy + 1), z), true);
            });
          }
        }
      } else {
        d.life += dt; d.smokeT -= dt;
        if (d.smokeT <= 0 && d.life < 20) { d.smokeT = 0.18; api.emit(new THREE.Vector3(d.x + 0.9, d.gy + 1.3, d.z), '#ff5040', 2, 1.2, 2.2, 0.5, -0.6); }
        if (d.life > 30) { scene.remove(d.g); E.drops.splice(i, 1); }
      }
    }
    // meteoriti
    const evM = E.active.find(e => e.k === 'meteor');
    const mt = evM ? evM.t : Infinity;
    for (let i = E.meteors.length - 1; i >= 0; i--) {
      const m = E.meteors[i];
      if (!evM) { if (m.mesh) scene.remove(m.mesh); if (m.ring) scene.remove(m.ring); E.meteors.splice(i, 1); continue; }
      const gy = api.terrainHeight(m.x, m.z);
      const toImpact = m.T - mt;
      if (toImpact < 3 && !m.ring) { m.ring = new THREE.Mesh(ringGeo, ringMat); m.ring.position.set(m.x, gy + 0.15, m.z); scene.add(m.ring); }
      if (m.ring) m.ring.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(mt * 6)));
      if (toImpact < 2.4 && !m.mesh) {
        m.mesh = new THREE.Group();
        m.mesh.add(new THREE.Mesh(meteorGeo, meteorMat), new THREE.Mesh(glowGeo, glowMat));
        scene.add(m.mesh);
      }
      if (m.mesh) {
        const k = Math.max(0, toImpact / 2.4);
        m.mesh.position.set(m.x + m.dir.x * k, gy + 0.6 + 140 * k, m.z + m.dir.z * k);
        m.mesh.rotation.x += dt * 5; m.mesh.rotation.z += dt * 3;
        api.emit(m.mesh.position, k > 0.5 ? '#ffd080' : '#ff8030', 2, 1.5, 0.6, 0.5, -0.2);
      }
      if (toImpact <= 0) {
        impact(m, gy);
        if (m.mesh) scene.remove(m.mesh);
        if (m.ring) scene.remove(m.ring);
        E.meteors.splice(i, 1);
      }
    }
    for (let i = E.craters.length - 1; i >= 0; i--) {
      const c = E.craters[i];
      c.life -= dt; c.smokeT -= dt;
      if (c.smokeT <= 0 && c.life > 12) { c.smokeT = 0.35; api.emit(c.mesh.position.clone().setY(c.mesh.position.y + 0.3), '#4a4440', 1, 0.8, 1.8, 0.6, -0.5); }
      c.mesh.material.opacity = Math.min(0.75, c.life / 5);
      if (c.life <= 0) { scene.remove(c.mesh); c.mesh.material.dispose(); E.craters.splice(i, 1); }
    }
  }

  /** testo per la barra degli eventi nell'HUD */
  function hudText() {
    if (!E.active.length) return '';
    return E.active.map(ev => `${EVENT_DEFS[ev.k].icon} ${EVENT_DEFS[ev.k].name} · ${Math.max(0, Math.ceil(ev.dur - ev.t))}s`).join('   ');
  }

  /** segnalini sulla minimappa e sulla mappa grande */
  function drawMarkers(ctx, S, cx, cz, view, w2m) {
    for (const d of E.drops) {
      const x = w2m(d.x, cx, view, S), y = w2m(d.z, cz, view, S);
      ctx.fillStyle = '#4ab8ff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10);
    }
    const evM = E.active.find(e => e.k === 'meteor');
    if (evM) {
      ctx.strokeStyle = 'rgba(255,70,30,0.9)'; ctx.fillStyle = 'rgba(255,70,30,0.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w2m(evM.x, cx, view, S), w2m(evM.z, cz, view, S), 90 / view * S, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function reset() {
    for (const d of E.drops) scene.remove(d.g);
    for (const m of E.meteors) { if (m.mesh) scene.remove(m.mesh); if (m.ring) scene.remove(m.ring); }
    for (const c of E.craters) { scene.remove(c.mesh); c.mesh.material.dispose(); }
    E.active.length = 0; E.drops.length = 0; E.meteors.length = 0; E.craters.length = 0;
    E.next = 80; E.last = '';
    G.gravK = 1; G.goldT = 0;
    if (api.weather) { api.weather.fogMul = 1; api.weather.blizzard = 0; }
    if (api.sun) api.sun.color.copy(api.sunBase);
  }

  return { start, update, reset, hudText, drawMarkers, state: E };
}
