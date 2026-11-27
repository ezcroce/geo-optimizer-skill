/* node games/infinite-alibi/tests/sim.test.js — test senza dipendenze */
'use strict';
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '../js/world.js'));
require(path.join(__dirname, '../js/footage.js'));
const IA = globalThis.IA;

let pass = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

const seeds = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);

test('generazione deterministica', () => {
  const a = IA.generateCase(42, 5, 2);
  const b = IA.generateCase(42, 5, 2);
  assert.deepStrictEqual(a.chars[3].keys, b.chars[3].keys);
  assert.strictEqual(a.Tc, b.Tc);
});

test('il colpevole è al piedistallo durante il crimine e Tc è nella finestra prevista', () => {
  for (const s of seeds) {
    const cs = IA.generateCase(s, 5, s % 5);
    assert.ok(cs.Tc > 8 && cs.Tc < 20, 'Tc=' + cs.Tc);
    const p = IA.charPos(cs, cs.culprit, cs.Tc + 1);
    assert.strictEqual(IA.roomAt(p.x, p.y), IA.STUDIO);
  }
});

test('nessun innocente nello Studio durante il furto', () => {
  for (const s of seeds) {
    const cs = IA.generateCase(s, 6, s % 6);
    for (const c of cs.chars) {
      if (c.idx === cs.culprit) continue;
      for (let t = cs.Tc - 2; t < cs.Tc + 4.5; t += 0.1) {
        const p = IA.samplePath(c.keys, t);
        assert.notStrictEqual(IA.roomAt(p.x, p.y), IA.STUDIO, `seed ${s} char ${c.idx} t ${t}`);
      }
    }
  }
});

test('filmato reale: zero indizi di manomissione, il furto è visibile', () => {
  const tamper = ['missing', 'duplicate', 'teleport', 'timestamp', 'glitch', 'jewel-alone', 'jewel-back', 'jewel-glitch'];
  for (const s of seeds) {
    const cs = IA.generateCase(s, 5, s % 5);
    const { clues } = IA.analyze(cs, IA.emptyEdits());
    const bad = clues.filter((c) => tamper.includes(c.type));
    assert.strictEqual(bad.length, 0, `seed ${s}: ` + bad.map((c) => c.text).join(' | '));
    const crime = clues.find((c) => c.type === 'crime');
    assert.ok(crime && crime.points[cs.culprit] > 0, 'seed ' + s);
  }
});

test('ogni manipolazione lascia almeno un micro-indizio', () => {
  for (const s of seeds) {
    const cs = IA.generateCase(s, 5, s % 5);
    const rng = IA.makeRng(s);
    const e = IA.aiEdits(cs, rng, 40);
    const any = e.splice || e.glitch || e.deepfake;
    if (!any) continue;
    const { clues } = IA.analyze(cs, e);
    const tamper = clues.filter((c) => c.type !== 'presence' && c.type !== 'crime');
    assert.ok(tamper.length > 0, 'seed ' + s + ' ' + JSON.stringify(e));
  }
});

test('il deepfake tradisce solo il dettaglio scelto (oggetto o ombra) e sfarfalla', () => {
  for (const weak of ['prop', 'shadow']) {
    for (const s of seeds) {
      const cs = IA.generateCase(s, 5, 0);
      const e = { splice: null, glitch: null, deepfake: { t: Math.round(cs.Tc * 10) / 10, victim: 3, weak } };
      const st = IA.feedState(cs, e, IA.STUDIO, cs.Tc + 0.1);
      const me = st.chars.find((c) => c.idx === 0);
      assert.strictEqual(me.look, 3);
      assert.ok(me.disguised);
      if (weak === 'prop') { assert.strictEqual(me.prop, 0); assert.strictEqual(me.shadow, 3); }
      else { assert.strictEqual(me.shadow, 0); assert.strictEqual(me.prop, 3); }
      const { clues } = IA.analyze(cs, e);
      const want = weak === 'prop' ? 'deepfake-prop' : 'deepfake-shadow';
      const other = weak === 'prop' ? 'deepfake-shadow' : 'deepfake-prop';
      assert.ok(clues.some((c) => c.type === want && c.points[0] > 0), `seed ${s} ${weak}`);
      assert.ok(!clues.some((c) => c.type === other), `seed ${s} ${weak}: c'è anche ${other}`);
      assert.ok(clues.some((c) => c.type === 'deepfake-flicker'), `seed ${s}: manca lo sfarfallio`);
    }
  }
});

test('la durata del deepfake segue la difficoltà (1.2–1.5 s)', () => {
  for (const k of Object.keys(IA.CONFIG.DIFFICULTY)) {
    IA.setDifficulty(k);
    assert.ok(IA.CONFIG.deepfake.len >= 1.2 && IA.CONFIG.deepfake.len <= 1.5, k + ' ' + IA.CONFIG.deepfake.len);
  }
  IA.setDifficulty('normale');
});

test('lo splice lascia anche lo scatto ambientale (luce / micro-lag) alla giunzione', () => {
  let n = 0;
  for (const s of seeds) {
    const cs = IA.generateCase(s, 5, s % 5);
    const e = { splice: { cam: 1, t0: 10, len: 2.5, src0: 3 }, glitch: null, deepfake: null };
    assert.ok(IA.feedState(cs, e, 1, 10.02).lag, 'nessun lag all\'inizio del taglio');
    assert.ok(!IA.feedState(cs, e, 1, 11.2).lag, 'lag in mezzo al taglio');
    assert.ok(!IA.feedState(cs, e, 2, 10.02).lag, 'lag su un\'altra camera');
    if (IA.analyze(cs, e).clues.some((c) => c.type === 'splice-lag' && c.cam === 1)) n++;
  }
  assert.strictEqual(n, seeds.length);
});

test('tallyResult: maggioranza, pareggio, nessun voto', () => {
  assert.deepStrictEqual(IA.tallyResult([0, 3, 1, 0]).convicted, 1);
  const t = IA.tallyResult([2, 0, 2, 1]);
  assert.ok(t.tied);
  assert.deepStrictEqual(t.top, [0, 2]);
  assert.strictEqual(t.convicted, -1);
  assert.strictEqual(IA.tallyResult([0, 0, 0]).convicted, -1);
  assert.ok(!IA.tallyResult([0, 0, 0]).tied);
});

test('ballottaggio: i bot votano solo fra i candidati', () => {
  for (const s of seeds.slice(0, 10)) {
    const cs = IA.generateCase(s, 5, s % 5);
    const { clues } = IA.analyze(cs, IA.emptyEdits());
    const rng = IA.makeRng(s);
    const cands = [(cs.culprit + 1) % 5, (cs.culprit + 2) % 5];
    for (let i = 0; i < 5; i++) {
      const bot = IA.makeBot(i, rng);
      IA.botObserve(bot, clues, rng);
      const v = IA.botVote(cs, clues, bot, rng, i === cs.culprit, null, cands);
      if (cands.includes(i)) assert.ok(cands.includes(v) && v !== i, `bot ${i} → ${v}`);
      else assert.ok(cands.includes(v), `bot ${i} → ${v}`);
    }
  }
});

test('filmato precotto (online): niente identità reale, coerente con feedState', () => {
  const cs = IA.generateCase(4242, 5, 3);
  const e = { splice: { cam: 0, t0: 5, len: 2, src0: 20 }, glitch: { cam: IA.STUDIO, t0: Math.round(cs.Tc * 10) / 10, len: 2 }, deepfake: { t: Math.round((cs.Tc + 3) * 10) / 10, victim: 1, weak: 'shadow' } };
  const baked = IA.bakeFootage(cs, e);
  const raw = JSON.stringify(baked);
  for (const k of ['"culprit"', '"seed"', '"idx"', '"keys"', '"Tc"', '"disguised"']) assert.ok(!raw.includes(k), 'contiene ' + k);
  for (const cam of [0, 1, IA.STUDIO, 4]) {
    for (const t of [1, 5.05, 12.3, 19.9, 27]) {
      const a = IA.feedState(cs, e, cam, t);
      const b = IA.bakedFeedState(baked, cam, t);
      assert.strictEqual(!!b.glitch, !!a.glitch, `glitch cam ${cam} t ${t}`);
      if (a.glitch) continue;
      assert.ok(Math.abs(a.s - b.s) < 0.15, `timestamp cam ${cam} t ${t}: ${a.s} vs ${b.s}`);
      assert.strictEqual(b.chars.length, a.chars.length, `persone cam ${cam} t ${t}`);
    }
  }
});

test('i complici danno consigli narrativi e citano il punto debole', () => {
  const cs = IA.generateCase(777, 5, 2);
  const glitchStudio = { splice: null, deepfake: null, glitch: { cam: IA.STUDIO, t0: Math.round(cs.Tc * 10) / 10, len: 3 } };
  const tips = IA.culpritAdvice(cs, IA.analyze(cs, glitchStudio).clues, IA.makeRng(1));
  assert.ok(tips.length > 0 && tips.every((t) => typeof t.text === 'string' && t.who));
  assert.ok(tips.some((t) => /glitch/i.test(t.text) && /Studio/.test(t.text)), tips.map((t) => t.text).join(' | '));
  const none = IA.culpritAdvice(cs, IA.analyze(cs, IA.emptyEdits()).clues, IA.makeRng(1));
  assert.ok(none.some((t) => /gioiello|Studio/.test(t.text)));
  assert.strictEqual(IA.moodLabel(0.1).label, 'tranquillo');
  assert.strictEqual(IA.moodLabel(0.9).label, 'nel panico');
});

test('aiuti per principianti: il filtro si accende sull\'anomalia, non sul furto', () => {
  const cs = IA.generateCase(31337, 5, 1);
  const e = { splice: { cam: 4, t0: 12, len: 2, src0: 2 }, glitch: null, deepfake: null };
  const h = IA.anomalyHints(cs, IA.analyze(cs, e).clues);
  assert.ok(IA.glowAt(h.glow, 4, 12.1) > 0.9);
  assert.strictEqual(IA.glowAt(h.glow, 4, 25), 0);
  assert.ok(h.lens.length > 0 && h.lens.every((l) => l.type !== 'crime' && l.type !== 'presence'));
  assert.strictEqual(IA.anomalyHints(cs, IA.analyze(cs, IA.emptyEdits()).clues).lens.length, 0);
});

test('lo splice mostra il timestamp della sorgente', () => {
  const cs = IA.generateCase(7, 4, 1);
  const e = { splice: { cam: 0, t0: 14, len: 3, src0: 6 }, glitch: null, deepfake: null };
  assert.strictEqual(IA.feedState(cs, e, 0, 15).s, 7);
  assert.strictEqual(IA.feedState(cs, e, 1, 15).s, 15);
  const { clues } = IA.analyze(cs, e);
  const ts = clues.find((c) => c.type === 'timestamp');
  assert.ok(ts && /salta da :13 a :06/.test(ts.text), ts && ts.text);
});

test('il colpevole IA batte "nessuna manipolazione" in media', () => {
  let better = 0;
  for (const s of seeds) {
    const cs = IA.generateCase(s, 5, s % 5);
    const none = IA.danger(cs, IA.analyze(cs, IA.emptyEdits()).clues);
    const ai = IA.danger(cs, IA.analyze(cs, IA.aiEdits(cs, IA.makeRng(s), 40)).clues);
    if (ai <= none) better++;
  }
  assert.ok(better >= seeds.length * 0.8, `solo ${better}/${seeds.length}`);
});

console.log(`\n${pass} test superati`);
