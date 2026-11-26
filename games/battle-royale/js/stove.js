// ─────────────────────────────────────────────────────────────
//  Stufe a legna delle casette (v26)
//  E vicino alla stufa per accenderla: fiamme vive dietro il vetro, bagliore caldo nella stanza,
//  fumo che esce dal comignolo. Chi resta al calduccio dentro la casetta recupera salute
//  (+2 PS al secondo fino a 100). La legna brucia per un minuto, poi la stufa si spegne da sola.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const STOVE_BURN = 60;     // secondi di fuoco per ogni accensione
export const STOVE_HEAL = 2;      // PS al secondo
const SMOKE_N = 14;

function canvasTex(draw, w = 64, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// lingua di fuoco: nucleo quasi bianco, poi giallo, arancio e bordi rossi sfumati
const flameTex = canvasTex((g, w, h) => {
  for (let i = 0; i < 26; i++) {
    const k = i / 25, r = (1 - k) * w * 0.36 + 2;
    const y = h * (0.78 - k * 0.5);
    const gr = g.createRadialGradient(w / 2, y, 0, w / 2, y, r);
    const a = 0.16 + k * 0.1;
    gr.addColorStop(0, `rgba(255,${200 + 55 * k | 0},${120 + 120 * k | 0},${a})`);
    gr.addColorStop(0.5, `rgba(255,${110 + 80 * k | 0},20,${a * 0.7})`);
    gr.addColorStop(1, 'rgba(180,30,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}, 64, 128);
const glowTex = canvasTex((g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,170,80,0.9)'); gr.addColorStop(0.4, 'rgba(255,110,30,0.35)'); gr.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
// sbuffo di fumo: macchie morbide sovrapposte
const smokeTex = canvasTex((g, w, h) => {
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const x = w * (0.3 + r() * 0.4), y = h * (0.3 + r() * 0.4), rr = w * (0.18 + r() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(235,235,235,0.28)'); gr.addColorStop(1, 'rgba(235,235,235,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
});

export function createStoves(scene, world) {
  const flameMat = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: true });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: true });
  const smokeMats = [];
  // una sola luce, sempre nella scena (aggiungere/togliere luci ricompilerebbe tutti i materiali)
  const light = new THREE.PointLight('#ff9a48', 0, 9, 1.6);
  light.castShadow = false;
  scene.add(light);
  const fx = new Map();   // stufa → effetti visivi (solo per quelle accese e vicine)

  function makeFx(st) {
    const g = new THREE.Group();
    const flames = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(flameMat);
      s.center.set(0.5, 0.12);
      s.userData.ph = Math.random() * 10; s.userData.ox = (i - 1.5) * 0.06;
      g.add(s); flames.push(s);
    }
    const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(0.7); g.add(glow);
    g.position.set(st.x, st.y - 0.08, st.z);
    const smoke = [];
    for (let i = 0; i < SMOKE_N; i++) {
      const m = new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true, opacity: 0, color: '#8a8580', fog: true });
      smokeMats.push(m);
      const s = new THREE.Sprite(m);
      s.userData.t = i / SMOKE_N * 5; s.userData.dx = Math.random() - 0.5; s.userData.dz = Math.random() - 0.5;
      scene.add(s); smoke.push(s);
    }
    scene.add(g);
    return { g, flames, glow, smoke };
  }
  function dropFx(st) {
    const f = fx.get(st); if (!f) return;
    scene.remove(f.g);
    for (const s of f.smoke) { scene.remove(s); s.material.dispose(); }
    fx.delete(st);
  }

  /** accende/spegne (ritorna true se è cambiato qualcosa) */
  function setLit(st, lit) {
    if (st.lit === lit && !lit) return false;
    st.lit = lit; st.t = lit ? STOVE_BURN : 0;
    if (!lit) dropFx(st);
    return true;
  }
  /** la stufa davanti al personaggio (entro 1.7 m dallo sportello) */
  function nearest(p) {
    let best = null, bd = 1.7;
    for (const st of world.stoves) {
      if (Math.abs(st.x - p.pos.x) > 2 || Math.abs(st.z - p.pos.z) > 2 || Math.abs(st.floor - p.pos.y) > 1.2) continue;
      const d = Math.hypot(st.x - p.pos.x, st.z - p.pos.z);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }
  /** true se il personaggio è dentro la casetta di una stufa accesa */
  function warmAt(pos) {
    for (const st of world.stoves) {
      if (!st.lit) continue;
      const R = st.room;
      if (Math.abs(pos.x - R.x) > 3 || Math.abs(pos.z - R.z) > 3) continue;
      const c = Math.cos(R.rot), s = Math.sin(R.rot), dx = pos.x - R.x, dz = pos.z - R.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < R.w / 2 + 0.2 && Math.abs(lz) < R.d / 2 + 0.6 && Math.abs(pos.y - st.floor) < 1.4) return st;
    }
    return null;
  }

  let time = 0;
  /** chars: personaggi che si scaldano (giocatore e bot) */
  function update(dt, camera, chars) {
    time += dt;
    let bestL = null, bd = 45;
    for (const st of world.stoves) {
      if (!st.lit) continue;
      st.t -= dt;
      if (st.t <= 0) { setLit(st, false); continue; }
      const d = Math.hypot(st.x - camera.position.x, st.z - camera.position.z);
      if (d < bd) { bd = d; bestL = st; }
      if (d > 160) { dropFx(st); continue; }
      let f = fx.get(st);
      if (!f) { f = makeFx(st); fx.set(st, f); }
      // fiamme che guizzano (più basse negli ultimi secondi: la legna sta finendo)
      const fade = Math.min(1, st.t / 8);
      for (const s of f.flames) {
        const ph = s.userData.ph + time * 9;
        const h = (0.22 + 0.07 * Math.sin(ph) + 0.04 * Math.sin(ph * 2.3)) * (0.45 + 0.55 * fade);
        s.scale.set(0.13 + 0.03 * Math.sin(ph * 1.7), h, 1);
        s.position.set(s.userData.ox + 0.015 * Math.sin(ph * 1.3), 0, 0);
      }
      f.glow.material.opacity = (0.55 + 0.15 * Math.sin(time * 13)) * (0.5 + 0.5 * fade);
      // fumo dal comignolo: sale, si allarga, sbiadisce, piega col vento
      for (const s of f.smoke) {
        const u = s.userData;
        u.t += dt; if (u.t > 5) { u.t -= 5; u.dx = Math.random() - 0.5; u.dz = Math.random() - 0.5; }
        const k = u.t / 5;
        s.position.set(st.cx + u.dx * 0.3 + k * 1.6, st.top + k * 4.2, st.cz + u.dz * 0.3 + k * 0.7);
        s.scale.setScalar(0.35 + k * 1.9);
        s.material.opacity = Math.min(1, u.t * 2) * (1 - k) * 0.55 * fade;
        s.material.rotation = u.dx * 3 + k;
      }
    }
    // la luce va nella stufa accesa più vicina, appena davanti allo sportello
    if (bestL) {
      const R = bestL.room, s = Math.sin(R.rot), c = Math.cos(R.rot);
      light.position.set(bestL.x + s * 0.5, bestL.y + 0.25, bestL.z + c * 0.5);
      light.intensity = (5.5 + Math.sin(time * 11) * 0.8 + Math.sin(time * 23) * 0.5) * Math.min(1, bestL.t / 8 + 0.3);
    } else light.intensity = 0;
    // calduccio: cura chi è dentro
    let warmMe = null;
    for (const ch of chars) {
      if (!ch || !ch.alive) continue;
      const st = warmAt(ch.pos);
      if (!st) continue;
      if (ch.hp < 100) ch.hp = Math.min(100, ch.hp + STOVE_HEAL * dt);
      if (ch.isPlayer) warmMe = st;
    }
    return warmMe;
  }
  function reset() { for (const st of world.stoves) setLit(st, false); light.intensity = 0; }
  function dispose() { for (const st of [...fx.keys()]) dropFx(st); scene.remove(light); }
  return { update, nearest, setLit, warmAt, reset, dispose, light };
}
