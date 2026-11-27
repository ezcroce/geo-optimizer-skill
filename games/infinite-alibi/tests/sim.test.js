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

test('il deepfake lascia oggetto e ombra del colpevole', () => {
  for (const s of seeds) {
    const cs = IA.generateCase(s, 5, 0);
    const p = IA.charPos(cs, 0, cs.Tc + 1);
    const e = { splice: null, glitch: null, deepfake: { t: Math.round(cs.Tc * 10) / 10, victim: 3 } };
    const st = IA.feedState(cs, e, IA.STUDIO, cs.Tc + 0.1);
    const me = st.chars.find((c) => c.idx === 0);
    assert.strictEqual(me.look, 3);
    const { clues } = IA.analyze(cs, e);
    assert.ok(clues.some((c) => c.type === 'deepfake-prop' && c.points[0] > 0), 'seed ' + s + ' ' + p.x);
  }
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
