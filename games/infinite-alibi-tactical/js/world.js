'use strict';
/* ============================================================================
   INFINITE ALIBI: TACTICAL HEIST — world.js
   Mappa della villa (griglia), stanze, porte, condotti, pathfinding Dijkstra.
   Requisito tecnico n.1: griglia 2D + tempi di percorrenza precisi tra stanze.
   ============================================================================ */
globalThis.TH = globalThis.TH || {};

TH.world = (() => {
  const W = 44, H = 32, TS = 22;                 // larghezza/altezza in tile, px per tile
  const T = { WALL: 0, FLOOR: 1, DUSTY: 2, WET: 3, DOOR: 4, LDOOR: 5, EDOOR: 6, VENT: 7, SECRET: 8, EXIT: 9, FURN: 10 };

  // Stanze: rettangoli di pavimento circondati da muri. x,y = angolo in alto a sx.
  const ROOMS = [
    { id: 'cucina',    name: 'Cucina',            x: 2,  y: 2,  w: 13, h: 10, floor: T.WET },
    { id: 'biblioteca',name: 'Biblioteca',        x: 16, y: 2,  w: 12, h: 10, floor: T.DUSTY },
    { id: 'studio',    name: 'Studio Blindato',   x: 29, y: 2,  w: 13, h: 10, floor: T.FLOOR },
    { id: 'corridoio', name: 'Corridoio Servizio',x: 2,  y: 13, w: 40, h: 5,  floor: T.FLOOR },
    { id: 'salone',    name: 'Salone',            x: 2,  y: 19, w: 18, h: 11, floor: T.FLOOR },
    { id: 'ingresso',  name: 'Ingresso',          x: 21, y: 19, w: 21, h: 11, floor: T.FLOOR },
  ];
  const roomById = (id) => ROOMS.find((r) => r.id === id);

  // Porte: tipo 'door' aperta, 'ldoor' meccanica con serratura, 'edoor' elettronica.
  // (tx,ty) è il tile della porta (nel muro tra due stanze).
  const DOORS = [
    { tx: 15, ty: 6,  type: 'ldoor', a: 'cucina',    b: 'biblioteca' },
    { tx: 28, ty: 6,  type: 'secret', a: 'biblioteca', b: 'studio' },   // libreria segreta
    { tx: 8,  ty: 12, type: 'door',  a: 'cucina',    b: 'corridoio' },
    { tx: 22, ty: 12, type: 'door',  a: 'biblioteca', b: 'corridoio' },
    { tx: 35, ty: 12, type: 'edoor', a: 'studio',    b: 'corridoio' },
    { tx: 11, ty: 18, type: 'door',  a: 'salone',    b: 'corridoio' },
    { tx: 32, ty: 18, type: 'door',  a: 'ingresso',  b: 'corridoio' },
    { tx: 20, ty: 24, type: 'door',  a: 'salone',    b: 'ingresso' },
  ];

  // Condotti di aerazione: coppie di tile collegate (teletrasporto per l'Infiltrato).
  const VENTS = [
    { a: { tx: 14, ty: 3 },  b: { tx: 29, ty: 3 } },   // Cucina <-> Studio (lungo)
    { a: { tx: 3,  ty: 11 }, b: { tx: 3,  ty: 19 } },  // Cucina <-> Salone (verticale)
    { a: { tx: 27, ty: 11 }, b: { tx: 21, ty: 29 } },  // Biblioteca <-> Ingresso (fuga)
  ];

  // Arredi / oggetti interattivi (tile FURN, non attraversabili).
  const FURN = [
    { tx: 35, ty: 4,  kind: 'diamond', label: 'Il Diamante' },
    { tx: 4,  ty: 21, kind: 'bar',     label: 'Bar del Salone' },
    { tx: 4,  ty: 22, kind: 'bar',     label: 'Bar del Salone' },
    { tx: 10, ty: 23, kind: 'table',   label: 'Tavolo' },
    { tx: 14, ty: 25, kind: 'table',   label: 'Tavolo' },
    { tx: 7,  ty: 5,  kind: 'table',   label: 'Tavolo' },
    { tx: 10, ty: 8,  kind: 'table',   label: 'Tavolo' },
    { tx: 17, ty: 2,  kind: 'shelf',   label: 'Libreria' },
    { tx: 19, ty: 2,  kind: 'shelf',   label: 'Libreria' },
    { tx: 21, ty: 2,  kind: 'shelf',   label: 'Libreria' },
    { tx: 23, ty: 2,  kind: 'shelf',   label: 'Libreria' },
    { tx: 25, ty: 2,  kind: 'shelf',   label: 'Libreria' },
    { tx: 32, ty: 2,  kind: 'desk',    label: 'Scrivania' },
    { tx: 39, ty: 2,  kind: 'desk',    label: 'Scrivania' },
    { tx: 30, ty: 10, kind: 'plant',   label: 'Pianta' },
    { tx: 40, ty: 10, kind: 'plant',   label: 'Pianta' },
    { tx: 24, ty: 28, kind: 'plant',   label: 'Pianta' },
  ];

  const EXIT_TILES = [{ tx: 30, ty: 29 }, { tx: 31, ty: 29 }, { tx: 32, ty: 29 }, { tx: 33, ty: 29 }, { tx: 34, ty: 29 }];

  // --- costruzione della griglia -------------------------------------------------
  function buildGrid() {
    const g = new Uint8Array(W * H); // tutto WALL
    const at = (x, y) => y * W + x;
    for (const r of ROOMS)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) g[at(x, y)] = r.floor;
    for (const d of DOORS) g[at(d.tx, d.ty)] = d.type === 'ldoor' ? T.LDOOR : d.type === 'edoor' ? T.EDOOR : d.type === 'secret' ? T.SECRET : T.DOOR;
    for (const v of VENTS) { g[at(v.a.tx, v.a.ty)] = T.VENT; g[at(v.b.tx, v.b.ty)] = T.VENT; }
    for (const e of EXIT_TILES) g[at(e.tx, e.ty)] = T.EXIT;
    for (const f of FURN) g[at(f.tx, f.ty)] = T.FURN;
    return g;
  }
  const grid = buildGrid();
  const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H) ? T.WALL : grid[ty * W + tx];
  const furnAt = (tx, ty) => FURN.find((f) => f.tx === tx && f.ty === ty) || null;
  const doorAt = (tx, ty) => DOORS.find((d) => d.tx === tx && d.ty === ty) || null;
  const ventPair = (tx, ty) => {
    for (const v of VENTS) {
      if (v.a.tx === tx && v.a.ty === ty) return v.b;
      if (v.b.tx === tx && v.b.ty === ty) return v.a;
    }
    return null;
  };
  const roomAt = (tx, ty) => ROOMS.find((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || null;

  // --- passabilità ---------------------------------------------------------------
  // Un ladro può entrare in un tile se: non è muro/arredo, e per porte/condotti
  // ha la chiave giusta (o la porta è già aperta). Le porte chiuse ma apribili
  // costano di più (tempo di scassinamento incluso nel percorso).
  function passCost(tx, ty, thief, doorsState) {
    const t = tileAt(tx, ty);
    if (t === T.WALL || t === T.FURN) return Infinity;
    if (t === T.VENT) return 1;
    if (t === T.LDOOR || t === T.EDOOR || t === T.SECRET) {
      const d = doorAt(tx, ty);
      const st = doorsState ? doorsState[d.tx + ',' + d.ty] : null;
      const locked = st ? st.locked : (d.type !== 'door' && d.type !== 'secret');
      if (!locked) return 1;
      if (d.type === 'ldoor' && thief && thief.role === 'infiltrato') return 1 + 1.5 * ({walk:2, sneak:1.25, run:3}[thief.moveMode] || 2);  // scassinare
      if (d.type === 'edoor' && thief && thief.role === 'hacker') return 1 + 1.5 * ({walk:2, sneak:1.25, run:3}[thief.moveMode] || 2);      // sblocco remoto
      if (d.type === 'secret') return 1;
      if (thief && thief.allowLocked) return 1; // percorso condizionale: un compagno deve aprire
      return Infinity;
    }
    return 1;
  }

  // --- Dijkstra ------------------------------------------------------------------
  // Ritorna {path:[{tx,ty}...], cost} oppure null. I condotti sono scorciatoie:
  // da un tile VENT si può saltare al tile gemello (0,5 s per l’Infiltrato).
  function findPath(sx, sy, gx, gy, thief, doorsState) {
    sx |= 0; sy |= 0; gx |= 0; gy |= 0;
    if (sx === gx && sy === gy) return { path: [{ tx: gx, ty: gy }], cost: 0 };
    if (passCost(gx, gy, thief, doorsState) === Infinity) return null;
    const key = (x, y) => y * W + x;
    const open = [{ x: sx, y: sy, g: 0, f: 0, p: null }];
    const best = new Map([[key(sx, sy), 0]]);
    // Dijkstra: la distanza Manhattan non è ammissibile quando esistono condotti.
    const h = () => 0;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let guard = 0;
    while (open.length && guard++ < 20000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.x === gx && cur.y === gy) {
        const path = [];
        let n = cur;
        while (n) { path.push({ tx: n.x, ty: n.y }); n = n.p; }
        path.reverse();
        return { path, cost: cur.g };
      }
      const tryGo = (nx, ny, c) => {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
        const ng = cur.g + c;
        const k = key(nx, ny);
        if (best.has(k) && best.get(k) <= ng) return;
        best.set(k, ng);
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny), p: cur });
      };
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx, ny = cur.y + dy;
        const c = passCost(nx, ny, thief, doorsState);
        if (c !== Infinity) tryGo(nx, ny, c);
      }
      // salto nel condotto
      if (thief && thief.role === 'infiltrato' && tileAt(cur.x, cur.y) === T.VENT) {
        const pair = ventPair(cur.x, cur.y);
        if (pair) tryGo(pair.tx, pair.ty, 0.5 * ({walk:2, sneak:1.25, run:3}[thief.moveMode] || 2));
      }
    }
    return null;
  }

  // Distanza minima (in tile) tra due punti, per i controlli geometrici dell'interrogatorio.
  function distance(a, b, thief, doorsState) {
    const r = findPath(a.tx, a.ty, b.tx, b.ty, thief, doorsState);
    return r ? r.cost : Infinity;
  }

  // Tempo di percorrenza in secondi alla velocità data.
  const travelTime = (cost, speed) => cost / speed;

  function routeTime(path, speed, doorsState) {
    let seconds = 0;
    const unlocked = new Set();
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1], node = path[i], pair = ventPair(prev.tx, prev.ty);
      const door = doorAt(node.tx, node.ty), key = node.tx + ',' + node.ty;
      if (door && doorsState && doorsState[key]?.locked && !unlocked.has(key)) { seconds += 1.5; unlocked.add(key); }
      seconds += pair && pair.tx === node.tx && pair.ty === node.ty ? 0.5 : Math.ceil((1 / speed - 1e-9) / 0.05) * 0.05;
    }
    return Math.round(seconds * 100) / 100;
  }

  return { W, H, TS, T, ROOMS, DOORS, VENTS, FURN, EXIT_TILES, grid, tileAt, furnAt, doorAt, ventPair, roomAt, roomById, passCost, findPath, distance, travelTime, routeTime };
})();
