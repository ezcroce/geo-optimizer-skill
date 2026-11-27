/* Infinite Alibi — manipolazione del filmato, micro-indizi, giuria di bot e colpevole IA.
 *
 * Il filmato "reale" è deterministico (world.js). Le manipolazioni sono una piccola struttura:
 *   edits = {
 *     splice:   { cam, t0, len, src0 } | null   // Taglia e Cuci: stessa camera, altro momento
 *     deepfake: { t, victim, weak }    | null   // Sostituzione avatar per CONFIG.deepfake.len s
 *                                              // weak = 'prop' (l'oggetto resta il tuo) | 'shadow' (l'ombra resta la tua)
 *     glitch:   { cam, t0, len }       | null   // Disturbo segnale
 *   }
 * Ogni manipolazione lascia micro-indizi che analyze() trova guardando SOLO ciò che vede
 * lo spettatore (timestamp mostrato, chi appare dove, ombre e oggetti), come farebbe un umano.
 */
(function (root) {
  'use strict';
  const IA = (root.IA = root.IA || {});
  const { CONFIG, STUDIO, PEDESTAL, ROOMS, AVATARS, PROP_NAMES } = IA;
  const D = CONFIG.duration;
  const PED = IA.toGlobal(STUDIO, [PEDESTAL.x, PEDESTAL.y]); // piedistallo in coordinate globali

  function emptyEdits() {
    return { splice: null, deepfake: null, glitch: null };
  }

  function sourceTime(edits, cam, t) {
    const s = edits && edits.splice;
    if (s && s.cam === cam && t >= s.t0 && t < s.t0 + s.len) return s.src0 + (t - s.t0);
    return t;
  }
  function isGlitched(edits, cam, t) {
    const g = edits && edits.glitch;
    return !!(g && g.cam === cam && t >= g.t0 && t < g.t0 + g.len);
  }
  function disguiseAt(edits, t) {
    const d = edits && edits.deepfake;
    if (d && t >= d.t && t < d.t + CONFIG.deepfake.len) return d.victim;
    return -1;
  }
  function deepfakeWeak(edits) {
    return (edits && edits.deepfake && edits.deepfake.weak) === 'shadow' ? 'shadow' : 'prop';
  }
  /** Micro-scatto (fps drop) ai bordi di un taglio: entro CONFIG.fx.spliceLag s dal salto. */
  function spliceLagAt(edits, cam, t) {
    const sp = edits && edits.splice;
    if (!sp || sp.cam !== cam) return false;
    const L = CONFIG.fx.spliceLag;
    return (t >= sp.t0 && t < sp.t0 + L) || (t >= sp.t0 + sp.len && t < sp.t0 + sp.len + L);
  }
  function jewelPresent(cs, s) {
    return s < cs.jewelGone;
  }

  /** Cosa mostra una camera all'istante reale t (dopo le manipolazioni). */
  function feedState(cs, edits, cam, t) {
    const s = sourceTime(edits, cam, t);
    const rect = IA.roomRect(cam);
    const chars = [];
    const victim = disguiseAt(edits, t);
    const weak = deepfakeWeak(edits);
    for (const c of cs.chars) {
      const p = IA.samplePath(c.keys, s);
      const av = AVATARS[c.idx];
      const pad = av.r + 22; // margine per ombra e oggetti che sporgono
      if (p.x < rect.x - pad || p.x > rect.x + rect.w + pad || p.y < rect.y - pad || p.y > rect.y + rect.h + pad) continue;
      const disguised = c.idx === cs.culprit && victim >= 0;
      const look = disguised ? victim : c.idx;
      chars.push({
        idx: c.idx,
        look,
        // ombra e oggetto: nel deepfake uno dei due "fallisce" e resta quello del vero colpevole
        shadow: disguised && weak === 'prop' ? look : c.idx,
        prop: disguised && weak === 'shadow' ? look : c.idx,
        disguised,
        x: p.x,
        y: p.y,
        ang: p.ang,
        moving: p.moving,
        inRoom: IA.roomAt(p.x, p.y) === cam,
        crime: c.idx === cs.culprit && s >= cs.Tc && s < cs.Tc + CONFIG.crimeLen,
      });
    }
    return {
      cam,
      t,
      s,
      glitch: isGlitched(edits, cam, t),
      spliced: s !== t,
      lag: spliceLagAt(edits, cam, t),
      jewel: cam === STUDIO ? jewelPresent(cs, s) : null,
      chars,
    };
  }

  function validateEdits(cs, edits) {
    const errs = [];
    const s = edits.splice;
    if (s) {
      if (s.len < CONFIG.splice.minLen - 1e-6 || s.len > CONFIG.splice.maxLen + 1e-6) errs.push('Durata del taglio non valida');
      if (s.t0 < 0 || s.t0 + s.len > D + 1e-6) errs.push('Il taglio esce dal filmato');
      if (s.src0 < 0 || s.src0 + s.len > D + 1e-6) errs.push('La sorgente esce dal filmato');
      if (Math.abs(s.src0 - s.t0) < 0.5) errs.push('La sorgente deve essere un momento diverso');
    }
    const g = edits.glitch;
    if (g) {
      if (g.len < CONFIG.glitch.minLen - 1e-6 || g.len > CONFIG.glitch.maxLen + 1e-6) errs.push('Durata del disturbo non valida');
      if (g.t0 < 0 || g.t0 + g.len > D + 1e-6) errs.push('Il disturbo esce dal filmato');
    }
    const d = edits.deepfake;
    if (d) {
      if (d.victim === cs.culprit || d.victim < 0 || d.victim >= cs.n) errs.push('Vittima del deepfake non valida');
      if (d.t < 0 || d.t + CONFIG.deepfake.len > D + 1e-6) errs.push('Deepfake fuori dal filmato');
      if (d.weak != null && d.weak !== 'prop' && d.weak !== 'shadow') errs.push('Punto debole del deepfake non valido');
    }
    return errs;
  }

  // ---------------------------------------------------------------------------
  // Analisi: cosa si può notare guardando il filmato manipolato
  // ---------------------------------------------------------------------------
  const DT = 0.1;

  function sampleApparent(cs, edits) {
    const N = Math.round(D / DT);
    const samples = [];
    for (let i = 0; i <= N; i++) {
      const t = Math.min(D, i * DT);
      const byLook = [];
      for (let k = 0; k < cs.n; k++) byLook.push([]);
      let jewel = null;
      const victim = disguiseAt(edits, t);
      for (let cam = 0; cam < ROOMS.length; cam++) {
        if (isGlitched(edits, cam, t)) continue;
        const s = sourceTime(edits, cam, t);
        if (cam === STUDIO) jewel = jewelPresent(cs, s);
        for (const c of cs.chars) {
          const p = IA.samplePath(c.keys, s);
          if (IA.roomAt(p.x, p.y) !== cam) continue;
          const look = c.idx === cs.culprit && victim >= 0 ? victim : c.idx;
          byLook[look].push({ cam, x: p.x, y: p.y, real: c.idx, spliced: s !== t });
        }
      }
      samples.push({ t, byLook, jewel });
    }
    return samples;
  }

  function local(cam, x, y) {
    const r = IA.roomRect(cam);
    return { lx: x - r.x, ly: y - r.y };
  }
  function nm(cs, i) {
    return cs.names ? cs.names[i] : AVATARS[i].name;
  }
  function sec(t) {
    return String((Math.floor(t + 1e-6) % 60)).padStart(2, '0');
  }
  function add(points, k, v) {
    points[k] = (points[k] || 0) + v;
  }

  function analyze(cs, edits) {
    edits = edits || emptyEdits();
    const S = sampleApparent(cs, edits);
    const clues = [];
    let uid = 0;
    const push = (c) => { c.id = 'c' + uid++; clues.push(c); return c; };
    const C = CONFIG;

    // --- Gioiello: quando sparisce nel filmato visibile? (serve a stimare l'ora del crimine)
    let crimeEst = null;
    let lastJ = null;
    let lastJIdx = -1;
    for (let i = 0; i < S.length; i++) {
      const j = S[i].jewel;
      if (j === null) continue;
      if (lastJ !== null && lastJ !== j) {
        const t = S[i].t;
        const gap = t - S[lastJIdx].t;
        if (lastJ && !j) {
          // se il momento del furto è nascosto (glitch), la stima è subito dopo l'ultima volta che il gioiello si vede
          if (crimeEst === null) crimeEst = gap > 0.35 ? Math.min(t, S[lastJIdx].t + 1.5) : t;
          if (gap > 0.35) {
            push({
              type: 'jewel-glitch', cam: STUDIO, t: S[lastJIdx].t, t2: t, lx: PEDESTAL.x, ly: PEDESTAL.y,
              text: 'Il gioiello sparisce mentre la CAM 3 è disturbata: il furto è avvenuto lì dentro, in quel momento.',
              say: 'Il gioiello sparisce proprio durante il disturbo! Coincidenza? No.',
              notice: 0.9, points: {},
            });
          } else {
            const near = S[i].byLook
              .map((copies, look) => ({ look, c: copies.find((c) => c.cam === STUDIO && Math.hypot(c.x - PED.x, c.y - PED.y) < 50) }))
              .filter((o) => o.c);
            if (near.length) {
              const points = {};
              near.forEach((o) => add(points, o.look, 6));
              const who = near.map((o) => nm(cs, o.look)).join(' e ');
              push({
                type: 'crime', cam: STUDIO, t, lx: PEDESTAL.x, ly: PEDESTAL.y,
                text: `Il gioiello sparisce alle ${IA.clockText(t)} mentre ${who} è accanto al piedistallo.`,
                say: `Alle ${IA.clockText(t)} il gioiello sparisce e accanto c'è ${who}!`,
                notice: 0.85, points,
              });
            } else {
              push({
                type: 'jewel-alone', cam: STUDIO, t, lx: PEDESTAL.x, ly: PEDESTAL.y,
                text: `Alle ${IA.clockText(t)} il gioiello svanisce da solo, senza nessuno vicino: quel pezzo di video è stato manomesso.`,
                say: 'Il gioiello svanisce da solo! Nessuno lo tocca! Questo video è truccato.',
                notice: 0.6, points: {},
              });
            }
          }
        } else if (!lastJ && j) {
          push({
            type: 'jewel-back', cam: STUDIO, t, lx: PEDESTAL.x, ly: PEDESTAL.y,
            text: `Alle ${IA.clockText(t)} il gioiello, già sparito, ricompare sul piedistallo.`,
            say: 'Il gioiello ricompare! Quel pezzo di Studio viene da prima del furto!',
            notice: 0.65, points: {},
          });
        }
      }
      lastJ = j;
      lastJIdx = i;
    }
    if (crimeEst === null) crimeEst = cs.jewelGone; // ripiego: il furto risulta comunque scoperto a fine filmato
    const w0 = crimeEst - 5;
    const w1 = crimeEst + 1.5;
    const nearCrime = (t) => t >= w0 - 1 && t <= w1 + 1;

    // --- Presenza nello Studio intorno all'ora del furto
    for (let look = 0; look < cs.n; look++) {
      let first = null;
      for (const smp of S) {
        if (smp.t < w0 || smp.t > w1) continue;
        const c = smp.byLook[look].find((c) => c.cam === STUDIO);
        if (c) { first = { t: smp.t, c }; break; }
      }
      if (first) {
        push({
          type: 'presence', cam: STUDIO, t: first.t, ...local(STUDIO, first.c.x, first.c.y), who: look,
          text: `${nm(cs, look)} compare nello Studio alle ${IA.clockText(first.t)}, poco prima o durante il furto.`,
          say: `${nm(cs, look)} era nello Studio alle ${IA.clockText(first.t)}! Che ci faceva lì?`,
          notice: 0.85, points: { [look]: 2 },
        });
      }
    }

    // --- False piste: chi è passato nello Studio in altri momenti o gironzolava lì vicino
    const studioNb = IA.neighbors(STUDIO);
    for (let look = 0; look < cs.n; look++) {
      if (clues.some((c) => c.type === 'presence' && c.who === look)) continue;
      let visit = null;
      let lurk = null;
      for (const smp of S) {
        const c = smp.byLook[look][0];
        if (!c) continue;
        if (!visit && c.cam === STUDIO) visit = { t: smp.t, c };
        if (!lurk && studioNb.includes(c.cam) && smp.t >= w0 && smp.t <= w1) lurk = { t: smp.t, c };
      }
      if (visit) {
        push({
          type: 'visit', cam: STUDIO, t: visit.t, ...local(STUDIO, visit.c.x, visit.c.y), who: look,
          text: `${nm(cs, look)} passa nello Studio alle ${IA.clockText(visit.t)}, ma non nei momenti decisivi del furto. Sopralluogo?`,
          say: `${nm(cs, look)} è passato nello Studio alle ${IA.clockText(visit.t)}... a fare un sopralluogo?`,
          notice: 0.6, points: { [look]: 1 },
        });
      } else if (lurk) {
        push({
          type: 'lurk', cam: lurk.c.cam, t: lurk.t, ...local(lurk.c.cam, lurk.c.x, lurk.c.y), who: look,
          text: `${nm(cs, look)} è in ${ROOMS[lurk.c.cam].name}, accanto allo Studio, alle ${IA.clockText(lurk.t)}.`,
          say: `${nm(cs, look)} gironzolava vicino allo Studio alle ${IA.clockText(lurk.t)}!`,
          notice: 0.5, points: { [look]: 0.75 },
        });
      }
    }

    // --- Persone sparite / duplicate / teletrasportate (continuità spaziale)
    for (let look = 0; look < cs.n; look++) {
      let runStart = null;
      let lastSeen = null;
      let dupStart = null;
      let dupInfo = null;
      let track = null;
      let lastTele = -10;
      for (let i = 0; i < S.length; i++) {
        const smp = S[i];
        const copies = smp.byLook[look];
        // sparizioni
        if (copies.length === 0) {
          if (runStart === null) runStart = smp.t;
        }
        if ((copies.length > 0 || i === S.length - 1) && runStart !== null) {
          const end = copies.length > 0 ? smp.t : D;
          const len = end - runStart;
          if (len >= 0.45) {
            const at = lastSeen || (copies[0] ? { cam: copies[0].cam, x: copies[0].x, y: copies[0].y } : { cam: STUDIO, x: PED.x, y: PED.y });
            const points = { [look]: nearCrime(runStart) || nearCrime(end) ? 2.5 : 1.2 };
            const g = edits.glitch;
            if (g && g.cam === STUDIO && runStart < g.t0 + g.len && end > g.t0) add(points, look, 1);
            push({
              type: 'missing', cam: at.cam, t: runStart, t2: end, ...local(at.cam, at.x, at.y), who: look,
              text: `${nm(cs, look)} non compare in nessuna telecamera tra le ${IA.clockText(runStart)} e le ${IA.clockText(end)} (${len.toFixed(1)} s). Dov'era?`,
              say: `${nm(cs, look)} sparisce da tutte le telecamere per ${len.toFixed(1)} secondi! Dov'eri?`,
              notice: Math.min(0.5, 0.15 + 0.06 * len), points,
            });
          }
          runStart = null;
        }
        if (copies.length === 1) lastSeen = { cam: copies[0].cam, x: copies[0].x, y: copies[0].y };

        // duplicati
        const cams = new Set(copies.map((c) => c.cam));
        if (cams.size >= 2) {
          if (dupStart === null) { dupStart = smp.t; dupInfo = copies.slice(); }
        } else if (dupStart !== null) {
          const len = smp.t - dupStart;
          if (len >= 0.2) {
            const fakeDisguise = dupInfo.find((c) => c.real !== look);
            const fakeSplice = dupInfo.find((c) => c.spliced);
            const realCopy = dupInfo.find((c) => c.real === look && !c.spliced) || dupInfo[0];
            const points = {};
            if (fakeDisguise) { add(points, cs.culprit, 3); add(points, look, -2); }
            else if (fakeSplice && realCopy && (realCopy.cam === STUDIO || IA.neighbors(STUDIO).includes(realCopy.cam)) && nearCrime(dupStart)) add(points, look, 3);
            else add(points, look, 0.5);
            const camNames = dupInfo.map((c) => 'CAM ' + (c.cam + 1)).filter((v, k, a) => a.indexOf(v) === k).join(' e ');
            const at = fakeDisguise || fakeSplice || dupInfo[0];
            push({
              type: 'duplicate', cam: at.cam, t: dupStart, t2: smp.t, ...local(at.cam, at.x, at.y), who: look,
              text: `${nm(cs, look)} appare contemporaneamente su ${camNames} alle ${IA.clockText(dupStart)}: una delle due immagini è falsa.`,
              say: `Aspettate! ${nm(cs, look)} è in due stanze nello stesso momento!`,
              notice: 0.55, points,
            });
          }
          dupStart = null;
        }

        // teletrasporti
        if (copies.length === 1) {
          const c = copies[0];
          if (track) {
            const gap = smp.t - track.t;
            const d = Math.hypot(c.x - track.x, c.y - track.y);
            if (d > CONFIG.speed * gap * 1.25 + 22 && smp.t - lastTele > 1) {
              lastTele = smp.t;
              const points = {};
              if (track.real !== look || c.real !== look) { add(points, cs.culprit, 2); add(points, look, -1); }
              else add(points, look, nearCrime(smp.t) ? 3 : 2);
              const need = (d / CONFIG.speed).toFixed(1);
              push({
                type: 'teleport', cam: c.cam, t: smp.t, ...local(c.cam, c.x, c.y), who: look,
                text: `${nm(cs, look)} passa da ${ROOMS[track.cam].name} (${IA.clockText(track.t)}) a ${ROOMS[c.cam].name} (${IA.clockText(smp.t)}) in ${gap.toFixed(1)} s: ne servirebbero almeno ${need}.`,
                say: `${nm(cs, look)} va da ${ROOMS[track.cam].name} a ${ROOMS[c.cam].name} in ${gap.toFixed(1)} secondi? Impossibile!`,
                notice: 0.4, points,
              });
            }
          }
          track = { x: c.x, y: c.y, t: smp.t, cam: c.cam, real: c.real };
        }
      }
    }

    // --- Timestamp incoerente (Taglia e Cuci)
    const sp = edits.splice;
    if (sp) {
      const points = {};
      for (const smp of S) {
        if (smp.t < sp.t0 || smp.t >= sp.t0 + sp.len) continue;
        smp.byLook.forEach((copies, look) => { if (copies.some((c) => c.cam === sp.cam && c.spliced)) points[look] = 1.5; });
      }
      if (sp.cam === STUDIO) {
        for (const smp of S) {
          const before = smp.t >= sp.t0 - 1.5 && smp.t < sp.t0;
          const after = smp.t >= sp.t0 + sp.len && smp.t < sp.t0 + sp.len + 1.5;
          if (!before && !after) continue;
          smp.byLook.forEach((copies, look) => { if (copies.some((c) => c.cam === STUDIO)) points[look] = Math.max(points[look] || 0, 2); });
        }
      }
      const off = Math.abs(sp.src0 - sp.t0);
      const a = sec(sp.t0 - DT);
      const b = sec(sp.src0);
      push({
        type: 'timestamp', cam: sp.cam, t: sp.t0, t2: sp.t0 + sp.len, lx: 196, ly: 168,
        text: `Il timestamp della CAM ${sp.cam + 1} (${ROOMS[sp.cam].name}) salta da :${a} a :${b} e poi da :${sec(sp.src0 + sp.len - DT)} a :${sec(sp.t0 + sp.len)}: quei ${sp.len.toFixed(1)} s sono incollati da un altro momento.`,
        say: `Guardate l'orologio della CAM ${sp.cam + 1}! Salta da ${a} a ${b}!`,
        notice: off >= 2 ? 0.45 : 0.22, points,
      });
      // il micro-scatto è un secondo indizio, visivo: non serve leggere l'orologio
      const lagPoints = {};
      for (const k in points) lagPoints[k] = points[k] * 0.4;
      push({
        type: 'splice-lag', cam: sp.cam, t: sp.t0, t2: sp.t0 + sp.len, lx: 120, ly: 90,
        text: `La CAM ${sp.cam + 1} (${ROOMS[sp.cam].name}) fa un micro-scatto alle ${IA.clockText(sp.t0)} e alle ${IA.clockText(sp.t0 + sp.len)}: l'immagine trema e la luce sfarfalla, come se mancassero dei fotogrammi.`,
        say: `Avete visto lo scatto sulla CAM ${sp.cam + 1}? L'immagine trema proprio lì: è un taglio!`,
        notice: Math.min(0.6, 0.35 * (CONFIG.fx.spliceLag / 0.15)), points: lagPoints,
      });
    }

    // --- Disturbo segnale (Glitch): nessuno crede che sia casuale
    const g = edits.glitch;
    if (g) {
      const points = {};
      for (const smp of S) {
        const edge = (smp.t >= g.t0 - 0.6 && smp.t < g.t0) || (smp.t >= g.t0 + g.len && smp.t < g.t0 + g.len + 0.6);
        if (!edge) continue;
        smp.byLook.forEach((copies, look) => { if (copies.some((c) => c.cam === g.cam)) points[look] = 1; });
      }
      push({
        type: 'glitch', cam: g.cam, t: g.t0, t2: g.t0 + g.len, lx: 120, ly: 90,
        text: `Disturbo di segnale sulla CAM ${g.cam + 1} (${ROOMS[g.cam].name}) dalle ${IA.clockText(g.t0)} alle ${IA.clockText(g.t0 + g.len)}. I glitch non sono mai casuali: chi non si vede altrove era lì.`,
        say: `Il segnale della CAM ${g.cam + 1} salta proprio adesso? Qualcuno nasconde qualcosa!`,
        notice: 0.95, points,
      });
    }

    // --- Deepfake: ombra e oggetti restano quelli del vero colpevole
    const df = edits.deepfake;
    if (df) {
      for (const smp of S) {
        if (smp.t < df.t || smp.t >= df.t + CONFIG.deepfake.len) continue;
        const copy = smp.byLook[df.victim].find((c) => c.real === cs.culprit);
        if (!copy) continue;
        const cul = AVATARS[cs.culprit];
        const vic = AVATARS[df.victim];
        const weak = deepfakeWeak(edits);
        const fl = CONFIG.fx.flicker;
        if (weak === 'prop') {
          const big = cul.prop === 'hat' || cul.prop === 'umbrella';
          push({
            type: 'deepfake-prop', cam: copy.cam, t: smp.t, ...local(copy.cam, copy.x, copy.y), who: df.victim,
            text: `Alle ${IA.clockText(smp.t)} "${nm(cs, df.victim)}" in ${ROOMS[copy.cam].name} ha ${PROP_NAMES[cul.prop]}... ma quello è di ${nm(cs, cs.culprit)}!`,
            say: `Quella non è ${nm(cs, df.victim)}! Guardate cosa tiene: ${PROP_NAMES[cul.prop]} di ${nm(cs, cs.culprit)}!`,
            notice: big ? 0.52 : 0.42, points: { [cs.culprit]: 5, [df.victim]: -3 },
          });
        } else {
          const diff = Math.abs(cul.r - vic.r) >= 2;
          push({
            type: 'deepfake-shadow', cam: copy.cam, t: smp.t, ...local(copy.cam, copy.x + cul.h * 2, copy.y + cul.h * 1.5), who: df.victim,
            text: `L'ombra di "${nm(cs, df.victim)}" alle ${IA.clockText(smp.t)} non corrisponde alla sua sagoma: ${diff ? (cul.r > vic.r ? 'è troppo grande' : 'è troppo piccola') : 'ha una forma diversa'}${cul.prop === 'hat' || cul.prop === 'umbrella' ? ` e ha la forma del${cul.prop === 'hat' ? ' cappello' : "l'ombrello"} di ${nm(cs, cs.culprit)}` : ''}.`,
            say: `L'ombra non torna! Quella sagoma non è di ${nm(cs, df.victim)}!`,
            notice: diff ? 0.36 : 0.26, points: { [df.victim]: -3, [cs.culprit]: 3 },
          });
        }
        // sfarfallio costante: per un istante si intravede la sagoma vera
        push({
          type: 'deepfake-flicker', cam: copy.cam, t: smp.t, t2: df.t + CONFIG.deepfake.len, ...local(copy.cam, copy.x, copy.y), who: df.victim,
          text: `"${nm(cs, df.victim)}" sfarfalla alle ${IA.clockText(smp.t)}: per un attimo, sotto, si intravede la sagoma di ${nm(cs, cs.culprit)}.`,
          say: `"${nm(cs, df.victim)}" sfarfalla! Sotto c'è qualcun altro!`,
          notice: Math.min(0.7, (weak === 'shadow' ? 0.45 : 0.3) * (fl / 0.6)), points: { [df.victim]: -1.5, [cs.culprit]: 1.5 },
        });
        break;
      }
    }

    clues.sort((a, b) => a.t - b.t);
    return { clues, crimeEst, samples: S };
  }

  // ---------------------------------------------------------------------------
  // Giuria di bot
  // ---------------------------------------------------------------------------
  function expectedScores(cs, clues) {
    const out = new Array(cs.n).fill(0);
    for (const c of clues) for (const k in c.points) out[k] += c.notice * c.points[k];
    return out;
  }
  /** Rischio per il colpevole: quanto spicca rispetto all'innocente più sospettato. */
  function danger(cs, clues) {
    const e = expectedScores(cs, clues);
    let maxInn = -Infinity;
    for (let i = 0; i < cs.n; i++) if (i !== cs.culprit) maxInn = Math.max(maxInn, e[i]);
    return e[cs.culprit] - maxInn;
  }
  /** Probabilità che una giuria di bot condanni il colpevole (Monte Carlo, pareggio = assolto). */
  function convictionProb(cs, clues, trials, seed) {
    trials = trials || 60;
    const rng = IA.makeRng(seed == null ? 777 : seed);
    let convicted = 0;
    for (let k = 0; k < trials; k++) {
      const bots = [];
      for (let i = 0; i < cs.n; i++) if (i !== cs.culprit) bots.push(makeBot(i, rng));
      const cons = new Array(cs.n).fill(0);
      for (const b of bots) {
        botObserve(b, clues, rng);
        for (let i = 0; i < cs.n; i++) b.bias[i] = rng.gauss() * BIAS;
        botScores(cs, clues, b).forEach((v, i) => (cons[i] += v));
      }
      const cbot = { idx: cs.culprit, bias: [], noticed: new Set() };
      const round = (cands) => {
        const votes = new Array(cs.n).fill(0);
        for (const b of bots) { const v = botVote(cs, clues, b, rng, false, null, cands); if (v >= 0) votes[v]++; }
        const cv = botVote(cs, clues, cbot, rng, true, cons, cands);
        if (cv >= 0) votes[cv]++;
        return tallyResult(votes);
      };
      let r = round(null);
      if (r.tied) r = round(r.top); // tempi supplementari: ballottaggio fra i più votati
      if (r.convicted === cs.culprit) convicted++;
    }
    return convicted / trials;
  }
  /** Maggioranza relativa. Pareggio → tied (si va ai tempi supplementari). */
  function tallyResult(votes) {
    const max = Math.max.apply(null, votes);
    const top = [];
    votes.forEach((v, i) => { if (v === max && max > 0) top.push(i); });
    return { votes, top, tied: top.length > 1, convicted: top.length === 1 ? top[0] : -1 };
  }
  const BIAS = 1.8; // "istinto" personale di ogni bot

  function dangerLabel(p) {
    if (p >= 0.65) return { label: 'ALTO', level: 2 };
    if (p >= 0.35) return { label: 'MEDIO', level: 1 };
    return { label: 'BASSO', level: 0 };
  }

  function makeBot(idx, rng) {
    return { idx, skill: 0.75 + rng.next() * 0.4, noticed: new Set(), bias: new Array(8).fill(0) };
  }
  function botObserve(bot, clues, rng) {
    const mul = (CONFIG.fx && CONFIG.fx.noticeMul) || 1;
    for (const c of clues) if (rng.next() < Math.min(0.98, c.notice * bot.skill * mul)) bot.noticed.add(c.id);
  }
  function botScores(cs, clues, bot) {
    const s = new Array(cs.n).fill(0);
    for (const c of clues) if (bot.noticed.has(c.id)) for (const k in c.points) s[k] += c.points[k];
    for (let i = 0; i < cs.n; i++) s[i] += bot.bias[i] || 0;
    return s;
  }
  /** candidates (opzionale): ballottaggio dei tempi supplementari, si vota solo fra loro. */
  function botVote(cs, clues, bot, rng, isCulpritBot, consensus, candidates) {
    let best = -1;
    let bestV = -Infinity;
    const s = isCulpritBot && consensus ? consensus : botScores(cs, clues, bot);
    for (let i = 0; i < cs.n; i++) {
      if (candidates && !candidates.includes(i)) continue;
      if (i === bot.idx) continue;
      if (isCulpritBot && i === cs.culprit && !(candidates && candidates.length === 2 && candidates.includes(bot.idx))) continue;
      const v = s[i] + rng.gauss() * 0.8;
      if (v > bestV) { bestV = v; best = i; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Colpevole IA: prova molte combinazioni e sceglie fra le meno rischiose
  // ---------------------------------------------------------------------------
  function culpritWindow(cs) {
    let tin = null;
    let tout = null;
    for (let t = 0; t <= D; t += DT) {
      const p = IA.charPos(cs, cs.culprit, t);
      if (IA.roomAt(p.x, p.y) === STUDIO) { if (tin === null) tin = t; tout = t; }
    }
    return { tin, tout };
  }
  function roomEmpty(cs, room, t0, t1) {
    for (let t = t0; t <= t1; t += 0.2) {
      for (const c of cs.chars) {
        const p = IA.samplePath(c.keys, t);
        if (IA.roomAt(p.x, p.y) === room) return false;
      }
    }
    return true;
  }
  function charInRoom(cs, idx, room, t0, t1) {
    for (let t = t0; t <= t1; t += 0.2) {
      const p = IA.charPos(cs, idx, t);
      if (IA.roomAt(p.x, p.y) !== room) return false;
    }
    return true;
  }
  const r1 = (v) => Math.round(v * 10) / 10;

  function aiEdits(cs, rng, tries) {
    tries = tries || 90;
    const { tin, tout } = culpritWindow(cs);
    const L = CONFIG.splice.maxLen;
    const innocents = [];
    for (let i = 0; i < cs.n; i++) if (i !== cs.culprit) innocents.push(i);

    const eraseSrc = [];
    for (let s0 = 0; s0 + L <= cs.jewelGone - 0.2; s0 += 0.5) if (roomEmpty(cs, STUDIO, s0, s0 + L)) eraseSrc.push(s0);
    const alibiSrc = [];
    for (let s0 = 0; s0 + L <= cs.Tc - 1; s0 += 0.5) if (charInRoom(cs, cs.culprit, cs.culpritStart, s0, s0 + L)) alibiSrc.push(s0);

    const spliceOpts = [() => null];
    if (eraseSrc.length) {
      spliceOpts.push(() => ({ cam: STUDIO, t0: r1(Math.max(0, tin + rng.range(-0.2, 1.5))), len: L, src0: rng.pick(eraseSrc) }));
      spliceOpts.push(() => ({ cam: STUDIO, t0: r1(Math.max(0, tout - L + rng.range(-1, 0.3))), len: L, src0: rng.pick(eraseSrc) }));
      spliceOpts.push(() => ({ cam: STUDIO, t0: r1(cs.Tc + rng.range(-0.5, 0.5)), len: L, src0: rng.pick(eraseSrc) }));
    }
    if (alibiSrc.length) spliceOpts.push(() => ({ cam: cs.culpritStart, t0: r1(cs.Tc + rng.range(-1, 0.5)), len: L, src0: rng.pick(alibiSrc) }));

    const G = CONFIG.glitch.maxLen;
    const glitchOpts = [
      () => null,
      () => ({ cam: STUDIO, t0: r1(Math.max(0, tin - 0.2)), len: G }),
      () => ({ cam: STUDIO, t0: r1(cs.Tc + rng.range(-0.5, 0.5)), len: G }),
      () => ({ cam: STUDIO, t0: r1(Math.min(D - G, tout - G + 0.3)), len: G }),
    ];
    const dfOpts = [() => null];
    for (let k = 0; k < 4; k++) {
      dfOpts.push(() => {
        const t = r1(rng.range(Math.max(0, tin - 2), Math.min(D - 1, tout + 1)));
        return { t, victim: rng.pick(innocents), weak: rng.next() < 0.5 ? 'prop' : 'shadow' };
      });
    }

    const scored = [];
    for (let i = 0; i < tries; i++) {
      const edits = { splice: rng.pick(spliceOpts)(), glitch: rng.pick(glitchOpts)(), deepfake: rng.pick(dfOpts)() };
      for (const k of ['splice', 'glitch']) {
        const e = edits[k];
        if (e) { e.t0 = Math.min(Math.max(0, e.t0), D - e.len); }
      }
      if (validateEdits(cs, edits).length) continue;
      const { clues } = analyze(cs, edits);
      scored.push({ edits, d: convictionProb(cs, clues, 30) + rng.next() * 0.08 });
    }
    scored.sort((a, b) => a.d - b.d);
    const top = scored.slice(0, 3);
    return top.length ? rng.pick(top).edits : emptyEdits();
  }

  // ---------------------------------------------------------------------------
  // Filmato "precotto" per l'online: il server manda ai client SOLO ciò che si vede,
  // mai i percorsi reali né l'identità del colpevole (anti-cheat).
  // frames[cam][i] = { s, g, l, j, c: [[look, shadow, prop, x, y, ang, moving, crime], ...] }  (niente identità reale)
  // ---------------------------------------------------------------------------
  const r2 = (v) => Math.round(v * 100) / 100;
  function bakeFootage(cs, edits, dt) {
    dt = dt || 0.1;
    const N = Math.round(D / dt);
    const frames = [];
    for (let cam = 0; cam < ROOMS.length; cam++) {
      const arr = [];
      for (let i = 0; i <= N; i++) {
        const t = Math.min(D, i * dt);
        const st = feedState(cs, edits, cam, t);
        arr.push({
          s: r2(st.s),
          g: st.glitch ? 1 : 0,
          l: st.lag ? 1 : 0,
          j: st.jewel ? 1 : 0,
          // niente identità reale né flag "travestito": solo ciò che si vede (aspetto, ombra, oggetto)
          c: st.glitch ? [] : st.chars.map((ch) => [ch.look, ch.shadow, ch.prop, r1(ch.x), r1(ch.y), r2(ch.ang), ch.moving ? 1 : 0, ch.crime ? 1 : 0]),
        });
      }
      frames.push(arr);
    }
    return { v: 1, dt, duration: D, deepfakeLen: CONFIG.deepfake.len, frames };
  }
  function unpackChar(a) {
    return { look: a[0], shadow: a[1], prop: a[2], x: a[3], y: a[4], ang: a[5], moving: !!a[6], crime: !!a[7], disguised: a[1] !== a[0] || a[2] !== a[0], inRoom: true };
  }
  function bakedFeedState(baked, cam, t) {
    const fr = baked.frames[cam];
    const pos = Math.max(0, Math.min(fr.length - 1, Math.round((t / baked.dt) * 1e4) / 1e4));
    const i = Math.floor(pos);
    const f = pos - i;
    const A = fr[i];
    const B = fr[Math.min(fr.length - 1, i + 1)];
    const cont = Math.abs(B.s - A.s - baked.dt) < 0.02;
    const chars = A.c.map((a) => {
      const ch = unpackChar(a);
      if (cont && f > 0) {
        const b = B.c.find((x) => x[0] === a[0] && x[2] === a[2]);
        if (b && Math.hypot(b[3] - a[3], b[4] - a[4]) < 30) { ch.x = a[3] + (b[3] - a[3]) * f; ch.y = a[4] + (b[4] - a[4]) * f; }
      }
      return ch;
    });
    return { cam, t, s: cont ? A.s + f * baked.dt : A.s, glitch: !!A.g, spliced: false, lag: !!A.l, jewel: cam === STUDIO ? !!A.j : null, chars };
  }

  // ---------------------------------------------------------------------------
  // Consigli narrativi dei complici (sostituiscono la barra di rischio numerica)
  // ---------------------------------------------------------------------------
  const ACCOMPLICES = ['il Socio', 'la Talpa', 'Zio Montatore'];
  function culpritAdvice(cs, clues, rng) {
    const cul = cs.culprit;
    const R = (cam) => `CAM 0${cam + 1} (${ROOMS[cam].name})`;
    const T = (t) => IA.clockText(t).slice(3);
    const lines = [];
    const add = (risk, text) => lines.push({ risk, text });
    for (const c of clues) {
      const p = c.points[cul] || 0;
      const risk = c.notice * (p > 0 ? p : 0.6);
      switch (c.type) {
        case 'crime': if (p > 0) add(risk, `Ti si vede allungare la mano sul gioiello alle ${T(c.t)}! Copri quel momento con un taglio o un glitch.`); break;
        case 'presence': if (c.who === cul) add(risk, `Sei inquadrato nello Studio alle ${T(c.t)}. Cancellati con un taglio, o mettici la faccia di qualcun altro.`); break;
        case 'missing': if (c.who === cul) add(risk, `Sparisci da tutte le camere per ${(c.t2 - c.t).toFixed(1)} s (${T(c.t)}–${T(c.t2)}). Chi conta le teste se ne accorge: fatti vedere altrove, magari con un alibi incollato.`); break;
        case 'timestamp': add(risk, `L'orologio della ${R(c.cam)} salta. Una sorgente più vicina nel tempo farebbe meno rumore, ma nasconderebbe meno.`); break;
        case 'splice-lag': add(risk * 0.8, `Il taglio fa uno scatto visibile sulla ${R(c.cam)}. Se cade quando la stanza è vuota, quasi nessuno lo guarda.`); break;
        case 'glitch': add(risk * 0.7, c.cam === STUDIO ? 'I bot odiano i glitch nello Studio: tutti guarderanno lì. Prova a tagliare una stanza vicina, invece.' : `Un glitch sulla ${R(c.cam)} attira tutti gli sguardi. E chi non si vede altrove... era lì.`); break;
        case 'teleport': if (c.who === cul || p > 0) add(risk, `Attento: passi da una stanza all'altra in un lampo (${T(c.t)}). Nessuno corre così veloce.`); break;
        case 'duplicate': if (p > 0) add(risk, `Alle ${T(c.t)} compari in due stanze insieme: una copia è di troppo.`); break;
        case 'deepfake-prop': add(risk, `Nel deepfake hai ancora in mano ${PROP_NAMES[AVATARS[cul].prop]}. Qualcuno lo noterà... oppure fai fallire l'ombra al posto dell'oggetto.`); break;
        case 'deepfake-shadow': add(risk, "L'ombra del deepfake resta la tua: è sottile, ma così l'avatar sfarfalla di più."); break;
        case 'deepfake-flicker': add(risk * 0.8, `Il deepfake sfarfalla alle ${T(c.t)}. Fallo cadere quando sei in movimento e lontano dal centro della scena.`); break;
        case 'jewel-alone': add(risk, `Il gioiello svanisce da solo alle ${T(c.t)}: firma evidente di un montaggio. Sposta il taglio.`); break;
        case 'jewel-back': add(risk, `Il gioiello ricompare dopo il furto alle ${T(c.t)}. Ops.`); break;
        case 'jewel-glitch': add(risk * 0.6, "Il gioiello sparisce durante il disturbo: tutti capiranno quando è successo. Almeno non si vede chi."); break;
      }
    }
    lines.sort((a, b) => b.risk - a.risk);
    const off = rng ? rng.int(ACCOMPLICES.length) : 0;
    const out = lines.slice(0, 3).map((l, k) => ({ who: ACCOMPLICES[(off + k) % ACCOMPLICES.length], text: l.text, risk: l.risk }));
    // buona notizia: l'innocente su cui ricadono i sospetti
    const e = expectedScores(cs, clues);
    let best = -1;
    e.forEach((v, i) => { if (i !== cul && v > 0.8 && (best < 0 || v > e[best])) best = i; });
    if (best >= 0) out.push({ who: ACCOMPLICES[(off + out.length) % ACCOMPLICES.length], text: `Ottimo: i sospetti cadono su ${nm(cs, best)}. Al processo spingi su di lui/lei.`, risk: -1 });
    if (!out.length) out.push({ who: ACCOMPLICES[0], text: 'Hai cancellato le tue tracce? Pulito. Forse troppo pulito... ma per ora nessuno ti punta il dito.', risk: 0 });
    return out;
  }
  // Aiuti per principianti (Detective / online): finestre di anomalia per il "filtro di movimento"
  // e bersagli ordinati per le lenti d'ingrandimento automatiche. Indica DOVE guardare, non CHI.
  const HINT_TYPES = ['timestamp', 'splice-lag', 'teleport', 'duplicate', 'missing', 'deepfake-prop', 'deepfake-shadow', 'deepfake-flicker', 'jewel-alone', 'jewel-back', 'jewel-glitch'];
  function anomalyHints(cs, clues) {
    const glow = [];
    for (const c of clues) {
      if (!HINT_TYPES.includes(c.type)) continue;
      if (c.type === 'missing') continue; // un'assenza non "si illumina" su una camera precisa
      glow.push({ cam: c.cam, t0: Math.max(0, c.t - 0.3), t1: c.t + 0.7 });
      if (c.t2 != null && (c.type === 'timestamp' || c.type === 'splice-lag')) glow.push({ cam: c.cam, t0: Math.max(0, c.t2 - 0.3), t1: c.t2 + 0.7 });
    }
    const lens = clues.filter((c) => HINT_TYPES.includes(c.type) && c.type !== 'missing')
      .sort((a, b) => b.notice - a.notice)
      .map((c) => ({ cam: c.cam, t: c.t, lx: c.lx, ly: c.ly, type: c.type }));
    return { glow, lens };
  }
  function glowAt(glow, cam, t) {
    let v = 0;
    for (const w of glow || []) {
      if (w.cam !== cam || t < w.t0 - 0.4 || t > w.t1 + 0.4) continue;
      v = Math.max(v, t < w.t0 ? 1 - (w.t0 - t) / 0.4 : t > w.t1 ? 1 - (t - w.t1) / 0.4 : 1);
    }
    return v;
  }

  function moodLabel(p) {
    if (p >= 0.65) return { label: 'nel panico', icon: '😱', level: 2 };
    if (p >= 0.35) return { label: 'nervoso', icon: '😬', level: 1 };
    return { label: 'tranquillo', icon: '😎', level: 0 };
  }

  Object.assign(IA, {
    anomalyHints,
    glowAt,
    bakeFootage,
    bakedFeedState,
    culpritAdvice,
    moodLabel,
    tallyResult,
    spliceLagAt,
    deepfakeWeak,
    emptyEdits,
    sourceTime,
    isGlitched,
    disguiseAt,
    jewelPresent,
    feedState,
    validateEdits,
    analyze,
    expectedScores,
    danger,
    convictionProb,
    BIAS,
    dangerLabel,
    makeBot,
    botObserve,
    botScores,
    botVote,
    aiEdits,
    culpritWindow,
  });
})(typeof window !== 'undefined' ? window : globalThis);
