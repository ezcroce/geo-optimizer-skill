/* Infinite Alibi — mondo, personaggi e generazione deterministica del filmato reale.
 * Script classico (niente moduli) così il gioco si apre anche con doppio clic su index.html,
 * ed è caricabile in Node per i test (scrive su globalThis.IA).
 */
(function (root) {
  'use strict';
  const IA = (root.IA = root.IA || {});

  // ---------------------------------------------------------------------------
  // Manopole di bilanciamento (documentate in DESIGN.md)
  // ---------------------------------------------------------------------------
  const CONFIG = {
    duration: 30, // secondi di filmato di sorveglianza
    speed: 70, // unità/secondo di camminata (una stanza ≈ 3,4 s)
    roomW: 240,
    roomH: 180,
    cols: 3,
    rows: 2,
    clockStart: 23 * 3600 + 14 * 60, // 23:14:00
    crimeLen: 3, // secondi passati al piedistallo
    jewelTakenAfter: 2, // il gioiello sparisce a Tc + 2 s
    splice: { minLen: 0.5, maxLen: 3, uses: 1 },
    deepfake: { len: 1.2, uses: 1 },
    glitch: { minLen: 0.5, maxLen: 3, uses: 1 },
    phases: { edit: 45, evidence: 60, trial: 60, overtime: 20 },
    difficulty: 'normale',
    // Intensità dei micro-indizi visivi. Si sceglie nel menu (o nella stanza online).
    //  deepfakeLen: durata del deepfake · flicker: forza dello sfarfallio del deepfake (0..1)
    //  spliceLag: durata del micro-scatto ai bordi di un taglio · noticeMul: acume dei bot
    DIFFICULTY: {
      facile: { label: 'Facile', deepfakeLen: 1.5, flicker: 1.0, spliceLag: 0.25, noticeMul: 1.2 },
      normale: { label: 'Normale', deepfakeLen: 1.3, flicker: 0.6, spliceLag: 0.15, noticeMul: 1.0 },
      esperto: { label: 'Esperto', deepfakeLen: 1.2, flicker: 0.3, spliceLag: 0.08, noticeMul: 0.85 },
    },
    fx: null,
  };
  function setDifficulty(name) {
    const d = CONFIG.DIFFICULTY[name] || CONFIG.DIFFICULTY.normale;
    CONFIG.difficulty = CONFIG.DIFFICULTY[name] ? name : 'normale';
    CONFIG.deepfake.len = d.deepfakeLen;
    CONFIG.fx = d;
    return d;
  }
  setDifficulty('normale');
  const W = CONFIG.roomW;
  const H = CONFIG.roomH;

  // id = riga * 3 + colonna
  const ROOMS = [
    { id: 0, name: 'Cucina', c: 0, r: 0 },
    { id: 1, name: 'Sala da Pranzo', c: 1, r: 0 },
    { id: 2, name: 'Studio', c: 2, r: 0 },
    { id: 3, name: 'Biblioteca', c: 0, r: 1 },
    { id: 4, name: 'Salone', c: 1, r: 1 },
    { id: 5, name: 'Giardino', c: 2, r: 1 },
  ];
  const STUDIO = 2;

  // Punti di sosta (coordinate locali della stanza) lontani dai mobili.
  const SPOTS = {
    0: [[60, 62], [72, 132], [150, 58], [172, 130], [118, 96]],
    1: [[50, 112], [120, 124], [190, 112], [120, 84], [196, 150]],
    2: [[60, 74], [62, 136], [196, 100], [160, 128], [168, 104]],
    3: [[64, 60], [70, 122], [150, 60], [150, 120], [110, 90]],
    4: [[50, 60], [190, 60], [60, 112], [186, 112], [120, 62]],
    5: [[60, 50], [60, 132], [118, 142], [204, 42], [110, 90]],
  };
  // Il piedistallo col gioiello e il punto dove il colpevole agisce.
  const PEDESTAL = { x: 152, y: 58, r: 11 };
  const CRIME_SPOT = [136, 82];

  const AVATARS = [
    { key: 'A', name: 'Contessa Ada', r: 9, h: 4.5, lum: 232, pattern: 'solid', prop: 'hat', color: '#ff4d6d' },
    { key: 'B', name: 'Barone Bruno', r: 13, h: 8, lum: 156, pattern: 'stripes', prop: 'cup', color: '#4dabf7' },
    { key: 'C', name: 'Colonnello Carlo', r: 11, h: 6.5, lum: 196, pattern: 'dots', prop: 'cane', color: '#ffd43b' },
    { key: 'D', name: 'Dottoressa Dora', r: 8.5, h: 4, lum: 112, pattern: 'half', prop: 'book', color: '#69db7c' },
    { key: 'E', name: 'Maggiordomo Ennio', r: 12, h: 7.5, lum: 74, pattern: 'ring', prop: 'umbrella', color: '#da77f2' },
    { key: 'F', name: 'Fiora la Pittrice', r: 10, h: 5.5, lum: 250, pattern: 'cross', prop: 'scarf', color: '#ff922b' },
  ];
  const PROP_NAMES = {
    hat: 'il cappello',
    cup: 'la tazza',
    cane: 'il bastone',
    book: 'il libro',
    umbrella: "l'ombrello",
    scarf: 'la sciarpa',
  };

  // ---------------------------------------------------------------------------
  // RNG deterministico (mulberry32) — lo stesso seme rigenera lo stesso caso
  // ---------------------------------------------------------------------------
  function makeRng(seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (lo, hi) => lo + (hi - lo) * next(),
      int: (n) => Math.floor(next() * n),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle: (arr) => {
        const a2 = arr.slice();
        for (let i = a2.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a2[i], a2[j]] = [a2[j], a2[i]];
        }
        return a2;
      },
      gauss: () => {
        const u = Math.max(1e-9, next());
        const v = next();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Geometria della villa
  // ---------------------------------------------------------------------------
  function roomRect(id) {
    const r = ROOMS[id];
    return { x: r.c * W, y: r.r * H, w: W, h: H };
  }
  function roomAt(x, y) {
    const c = Math.min(CONFIG.cols - 1, Math.max(0, Math.floor(x / W)));
    const r = Math.min(CONFIG.rows - 1, Math.max(0, Math.floor(y / H)));
    return r * CONFIG.cols + c;
  }
  function neighbors(id) {
    const r = ROOMS[id];
    return ROOMS.filter((o) => Math.abs(o.c - r.c) + Math.abs(o.r - r.r) === 1).map((o) => o.id);
  }
  function doorBetween(a, b) {
    const A = ROOMS[a];
    const B = ROOMS[b];
    const inset = 18;
    if (A.r === B.r) {
      const x = Math.max(A.c, B.c) * W;
      const y = A.r * H + H / 2;
      const dir = B.c > A.c ? 1 : -1;
      return { x, y, vertical: true, pa: { x: x - dir * inset, y }, pb: { x: x + dir * inset, y } };
    }
    const x = A.c * W + W / 2;
    const y = Math.max(A.r, B.r) * H;
    const dir = B.r > A.r ? 1 : -1;
    return { x, y, vertical: false, pa: { x, y: y - dir * inset }, pb: { x, y: y + dir * inset } };
  }
  function allDoors() {
    const out = [];
    for (let a = 0; a < ROOMS.length; a++) for (const b of neighbors(a)) if (a < b) out.push(doorBetween(a, b));
    return out;
  }
  function toGlobal(room, p) {
    const r = ROOMS[room];
    return { x: r.c * W + p[0], y: r.r * H + p[1] };
  }
  function shortestRoute(rng, from, to) {
    const prev = { [from]: -1 };
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur === to) break;
      for (const n of rng.shuffle(neighbors(cur))) if (!(n in prev)) { prev[n] = cur; q.push(n); }
    }
    const path = [];
    for (let c = to; c !== -1; c = prev[c]) path.unshift(c);
    return path;
  }
  // Tempo minimo (in linea d'aria) per passare da un punto all'altro: base del controllo
  // di "continuità spaziale" usato da investigatori umani e bot.
  function minTravel(p, q) {
    return Math.hypot(p.x - q.x, p.y - q.y) / CONFIG.speed;
  }

  // ---------------------------------------------------------------------------
  // Percorsi a keyframe
  // ---------------------------------------------------------------------------
  function PathBuilder(p, t) {
    this.k = [{ t: t, x: p.x, y: p.y }];
  }
  PathBuilder.prototype.last = function () { return this.k[this.k.length - 1]; };
  Object.defineProperty(PathBuilder.prototype, 't', { get: function () { return this.last().t; } });
  PathBuilder.prototype.moveTo = function (p) {
    const l = this.last();
    const d = Math.hypot(p.x - l.x, p.y - l.y);
    if (d < 0.01) return;
    this.k.push({ t: l.t + d / CONFIG.speed, x: p.x, y: p.y });
  };
  PathBuilder.prototype.wait = function (dt) {
    const l = this.last();
    if (dt > 0) this.k.push({ t: l.t + dt, x: l.x, y: l.y });
  };

  function randomSpot(rng, room, avoid) {
    const spots = SPOTS[room].map((s) => toGlobal(room, s));
    const ok = avoid ? spots.filter((s) => Math.hypot(s.x - avoid.x, s.y - avoid.y) > 12) : spots;
    const s = rng.pick(ok.length ? ok : spots);
    // piccola variazione così due personaggi non si sovrappongono perfettamente
    return { x: s.x + rng.range(-8, 8), y: s.y + rng.range(-6, 6) };
  }

  function walkRoute(b, route) {
    for (let i = 0; i < route.length - 1; i++) {
      const d = doorBetween(route[i], route[i + 1]);
      b.moveTo(d.pa);
      b.moveTo(d.pb);
    }
  }

  function wander(rng, b, room, tEnd, forbid) {
    let guard = 0;
    while (b.t < tEnd && guard++ < 60) {
      b.wait(rng.range(1.0, 3.2));
      const nbs = neighbors(room).filter((n) => !(forbid && forbid(n)));
      if (nbs.length && rng.next() < 0.58) {
        const n = rng.pick(nbs);
        walkRoute(b, [room, n]);
        room = n;
        b.moveTo(randomSpot(rng, n));
      } else {
        b.moveTo(randomSpot(rng, room, b.last()));
      }
    }
    return room;
  }

  function finalizeKeys(keys) {
    let ang = Math.PI / 2;
    for (let i = 0; i < keys.length; i++) {
      const n = keys[i + 1];
      if (n && (n.x !== keys[i].x || n.y !== keys[i].y)) ang = Math.atan2(n.y - keys[i].y, n.x - keys[i].x);
      keys[i].ang = ang;
    }
    return keys;
  }

  function samplePath(keys, t) {
    if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, ang: keys[0].ang, moving: false };
    const last = keys[keys.length - 1];
    if (t >= last.t) return { x: last.x, y: last.y, ang: last.ang, moving: false };
    let lo = 0;
    let hi = keys.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (keys[mid].t <= t) lo = mid; else hi = mid;
    }
    const a = keys[lo];
    const b = keys[hi];
    const f = (t - a.t) / (b.t - a.t || 1);
    const moving = a.x !== b.x || a.y !== b.y;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: a.ang, moving };
  }

  // ---------------------------------------------------------------------------
  // Il colpevole: alibi iniziale in una stanza lontana, crimine nello Studio, fuga.
  // ---------------------------------------------------------------------------
  function planCulprit(rng) {
    const start = rng.pick([0, 3, 4]); // almeno due stanze di distanza dallo Studio
    const route = shortestRoute(rng, start, STUDIO);
    const crime = toGlobal(STUDIO, CRIME_SPOT);
    const dep = randomSpot(rng, start);
    let travel = 0;
    let p = dep;
    for (let i = 0; i < route.length - 1; i++) {
      const d = doorBetween(route[i], route[i + 1]);
      travel += minTravel(p, d.pa) + minTravel(d.pa, d.pb);
      p = d.pb;
    }
    travel += minTravel(p, crime);
    const targetTc = rng.range(11.5, 16.5);
    const depart = targetTc - travel;
    if (depart < 5.5) return null;

    const b = new PathBuilder(randomSpot(rng, start), 0);
    for (let guard = 0; guard < 20; guard++) {
      const dwell = rng.range(1.0, 2.6);
      const nxt = randomSpot(rng, start, b.last());
      const tNext = b.t + dwell + minTravel(b.last(), nxt);
      if (tNext + minTravel(nxt, dep) > depart) break;
      b.wait(dwell);
      b.moveTo(nxt);
    }
    b.moveTo(dep);
    if (b.t < depart) b.wait(depart - b.t);
    walkRoute(b, route);
    b.moveTo(crime);
    const Tc = b.t;
    b.wait(CONFIG.crimeLen);
    const dest = rng.pick([0, 1, 3, 4, 5]);
    walkRoute(b, shortestRoute(rng, STUDIO, dest));
    b.moveTo(randomSpot(rng, dest));
    wander(rng, b, dest, CONFIG.duration + 1, (n) => n === STUDIO);
    return { keys: finalizeKeys(b.k), Tc, start };
  }

  function inRoomDuring(keys, room, t0, t1) {
    for (let t = Math.max(0, t0); t <= t1; t += 0.1) {
      const p = samplePath(keys, t);
      if (roomAt(p.x, p.y) === room) return true;
    }
    return false;
  }

  /**
   * Genera un caso completo e deterministico.
   * @param {number} seed
   * @param {number} n numero di personaggi (3–6)
   * @param {number} culprit indice del colpevole
   */
  function generateCase(seed, n, culprit) {
    const rng = makeRng(seed);
    let cul = null;
    for (let i = 0; i < 200 && !cul; i++) cul = planCulprit(rng);
    if (!cul) throw new Error('impossibile pianificare il colpevole');
    const Tc = cul.Tc;
    const chars = [];
    let herring = false;
    for (let i = 0; i < n; i++) {
      if (i === culprit) { chars.push({ idx: i, keys: cul.keys }); continue; }
      let best = null;
      for (let attempt = 0; attempt < 120; attempt++) {
        const start = rng.pick([0, 1, 3, 4, 5]);
        const b = new PathBuilder(randomSpot(rng, start), 0);
        wander(rng, b, start, CONFIG.duration + 1);
        const keys = finalizeKeys(b.k);
        if (inRoomDuring(keys, STUDIO, Tc - 2.5, Tc + 5)) continue; // nessun testimone
        const visits = inRoomDuring(keys, STUDIO, 0, CONFIG.duration);
        best = keys;
        if (herring || visits || attempt > 60) { herring = herring || visits; break; }
      }
      if (!best) {
        // ripiego sicuro: resta nella stanza di partenza
        const start = rng.pick([0, 3, 4]);
        const b = new PathBuilder(randomSpot(rng, start), 0);
        wander(rng, b, start, CONFIG.duration + 1, () => true);
        best = finalizeKeys(b.k);
      }
      chars.push({ idx: i, keys: best });
    }
    return {
      seed,
      n,
      culprit,
      Tc,
      jewelGone: Tc + CONFIG.jewelTakenAfter,
      culpritStart: cul.start,
      chars,
    };
  }

  /** Iniziali univoche (1–2 lettere) a partire dai nomi dei giocatori. */
  function makeInitials(names) {
    const used = {};
    return names.map((nm, i) => {
      const clean = String(nm || '').trim() || 'G' + (i + 1);
      let ini = clean.charAt(0).toUpperCase();
      if (used[ini]) ini = (clean.charAt(0) + (clean.charAt(1) || String(used[ini] + 1))).toUpperCase().slice(0, 2);
      used[ini.charAt(0)] = (used[ini.charAt(0)] || 0) + 1;
      return ini;
    });
  }

  function charPos(cs, idx, t) {
    return samplePath(cs.chars[idx].keys, t);
  }

  function clockText(t, withDate) {
    const s = CONFIG.clockStart + Math.max(0, Math.floor(t + 1e-6));
    const hh = String(Math.floor(s / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return (withDate ? '27/11/2026 ' : '') + hh + ':' + mm + ':' + ss;
  }

  Object.assign(IA, {
    CONFIG,
    setDifficulty,
    makeInitials,
    ROOMS,
    STUDIO,
    SPOTS,
    PEDESTAL,
    CRIME_SPOT,
    AVATARS,
    PROP_NAMES,
    makeRng,
    roomRect,
    roomAt,
    neighbors,
    doorBetween,
    allDoors,
    toGlobal,
    minTravel,
    samplePath,
    generateCase,
    charPos,
    clockText,
  });
})(typeof window !== 'undefined' ? window : globalThis);
