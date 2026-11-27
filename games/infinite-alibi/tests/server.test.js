/* node games/infinite-alibi/tests/server.test.js — partita online completa con 3 client simulati */
'use strict';
process.env.REVEAL_PAUSE = '0.2';
const assert = require('assert');
const path = require('path');
const WebSocket = require('ws');
const { createServer } = require(path.join(__dirname, '../server/server.js'));
const IA = globalThis.IA;

function client(url) {
  const ws = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    inbox.push(m);
    for (const w of waiters.slice()) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
  });
  return {
    ws,
    inbox,
    open: () => new Promise((r) => ws.on('open', r)),
    send: (type, data) => ws.send(JSON.stringify(Object.assign({ type }, data || {}))),
    wait(pred, ms) {
      const f = typeof pred === 'string' ? (m) => m.type === pred : pred;
      const found = inbox.find(f);
      if (found) { inbox.splice(inbox.indexOf(found), 1); return Promise.resolve(found); }
      return new Promise((res, rej) => {
        const w = { pred: (m) => { if (f(m)) { inbox.splice(inbox.indexOf(m), 1); return true; } return false; }, res };
        waiters.push(w);
        setTimeout(() => rej(new Error('timeout in attesa di ' + (typeof pred === 'string' ? pred : 'messaggio'))), ms || 4000);
      });
    },
  };
}

(async () => {
  const { server } = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  const http = require('http');
  const getStatus = (p) => new Promise((r) => http.get(`http://127.0.0.1:${server.address().port}${p}`, (res) => { res.resume(); r(res.statusCode); }));
  let ok = 0;
  const step = (name) => { ok++; console.log('  ok  ' + name); };
  try {
    assert.strictEqual(await getStatus('/'), 200);
    assert.strictEqual(await getStatus('/js/world.js'), 200);
    assert.strictEqual(await getStatus('/infinite-alibi/index.html'), 200);
    assert.strictEqual(await getStatus('/infinite-alibi/js/world.js'), 200);
    assert.strictEqual(await getStatus('/infinite-alibi-tactical/index.html'), 200);
    assert.strictEqual(await getStatus('/infinite-alibi-tactical/js/game.js'), 200);
    assert.strictEqual(await getStatus('/infinite-alibi-tactical/tests/tactical.test.js'), 404);
    assert.strictEqual(await getStatus('/infinite-alibi/server/server.js'), 404);
    assert.strictEqual(await getStatus('/infinite-alibi-tactical/%2e%2e/infinite-alibi/server/server.js'), 404);
    assert.strictEqual(await getStatus('/%zz'), 400);
    assert.strictEqual(await getStatus('/server/server.js'), 404);
    assert.strictEqual(await getStatus('/../../etc/passwd'), 404);
    step('file statici serviti, sorgenti del server e path traversal bloccati');

    const A = client(url); const B = client(url); const C = client(url);
    await Promise.all([A.open(), B.open(), C.open()]);
    A.send('create', { name: 'Alice' });
    const { code } = await A.wait('joined');
    B.send('join', { code, name: 'Bob' });
    C.send('join', { code, name: 'Carla' });
    await B.wait('joined'); await C.wait('joined');
    A.send('settings', { settings: { timerMul: 0, difficulty: 'esperto', aids: true } });
    B.send('start');
    await B.wait((m) => m.type === 'error' && /almeno|host/i.test(m.message), 600).catch(() => null); // solo l'host può avviare
    A.send('start');
    const roles = await Promise.all([A, B, C].map((c) => c.wait('role')));
    const secretHolders = roles.filter((r) => r.secret);
    assert.strictEqual(secretHolders.length, 1, 'solo il colpevole riceve il segreto');
    for (const r of roles) if (!r.culprit) assert.strictEqual(r.secret, undefined);
    step('ruoli privati: solo il Colpevole riceve seed e indice');

    const clients = [A, B, C];
    const culIdx = secretHolders[0].index;
    const cul = clients[roles.findIndex((r) => r.culprit)];
    const inv = clients.filter((c) => c !== cul);
    // un investigatore che prova a inviare modifiche viene ignorato
    inv[0].send('edits', { edits: { glitch: { cam: 0, t0: 1, len: 3 } }, final: true });
    // il colpevole rigenera il caso localmente e monta
    IA.setDifficulty(secretHolders[0].difficulty);
    const cs = IA.generateCase(secretHolders[0].secret.seed, 3, culIdx);
    cul.send('edits', { edits: { splice: { cam: 2, t0: 1, len: 9, src0: 5 } } });
    await cul.wait((m) => m.type === 'error' && /taglio/i.test(m.message));
    const victim = (culIdx + 1) % 3;
    const edits = { glitch: { cam: IA.STUDIO, t0: Math.round(cs.Tc * 10) / 10, len: 3 }, deepfake: { t: Math.round((cs.Tc - 1) * 10) / 10, victim, weak: 'shadow' } };
    cul.send('edits', { edits, final: true });
    const foots = await Promise.all(clients.map((c) => c.wait('footage')));
    const raw = JSON.stringify(foots[0]);
    assert.ok(!/"seed"|"culprit"|"keys"|"Tc"/.test(raw), 'il filmato non contiene segreti');
    assert.strictEqual(foots[0].baked.frames.length, 6);
    assert.ok(foots[0].hints && foots[0].hints.glow.length > 0, 'aiuti per principianti presenti');
    console.log(`       filmato precotto: ${(raw.length / 1024).toFixed(0)} KB`);
    // il glitch sullo Studio è visibile nel filmato precotto
    const fr = foots[0].baked.frames[IA.STUDIO][Math.round((cs.Tc + 1) * 10)];
    assert.strictEqual(fr.g, 1);
    // e deve coincidere con ciò che il colpevole vede localmente
    const local = IA.bakedFeedState(foots[0].baked, 0, 5);
    const truth = IA.feedState(cs, Object.assign(IA.emptyEdits(), edits), 0, 5);
    assert.strictEqual(local.chars.length, truth.chars.filter((c) => true).length);
    step('filmato precotto: niente segreti, glitch applicato, coerente col client');

    await Promise.all(clients.map((c) => c.wait((m) => m.type === 'phase' && m.phase === 'evidence')));
    inv[1].send('lens');
    const lens = await inv[1].wait('lens');
    assert.ok(lens.target && typeof lens.target.cam === 'number');
    step('lente d\'ingrandimento: il server indica dove guardare');

    A.send('next');
    await Promise.all(clients.map((c) => c.wait((m) => m.type === 'phase' && m.phase === 'trial')));
    B.send('laser', { cam: 2, lx: 100, ly: 80, t: 12.3, start: true });
    const las = await A.wait('laser');
    assert.strictEqual(las.from, roles[1].index);
    C.send('say', { text: 'Guardate la CAM 3!' });
    assert.strictEqual((await A.wait('chat')).text, 'Guardate la CAM 3!');
    step('processo: laser e chat inoltrati agli altri giocatori');

    A.send('next');
    await Promise.all(clients.map((c) => c.wait((m) => m.type === 'phase' && m.phase === 'vote')));
    // pareggio a tre: ognuno vota il successivo
    clients.forEach((c, i) => c.send('vote', { target: (roles[i].index + 1) % 3 }));
    const tally = await A.wait('tally');
    assert.strictEqual(tally.result, 'overtime');
    assert.strictEqual(tally.candidates.length, 3);
    const ot = await A.wait((m) => m.type === 'phase' && m.phase === 'overtime');
    assert.deepStrictEqual(ot.candidates, tally.candidates);
    step('pareggio → tempi supplementari con i sospettati più votati');

    A.send('next');
    await Promise.all(clients.map((c) => c.wait((m) => m.type === 'phase' && m.phase === 'runoff')));
    clients.forEach((c, i) => {
      const me = roles[i].index;
      c.send('vote', { target: me === culIdx ? (culIdx + 1) % 3 : culIdx });
    });
    const t2 = await A.wait('tally');
    assert.strictEqual(t2.result, 'caught');
    const rev = await B.wait('reveal');
    assert.strictEqual(rev.culprit, culIdx);
    assert.strictEqual(rev.seed, secretHolders[0].secret.seed);
    assert.strictEqual(rev.verdict.runoff, true);
    assert.strictEqual(rev.edits.deepfake.weak, 'shadow');
    assert.ok(rev.scores[roles[inv.length ? clients.indexOf(inv[0]) : 0].index === culIdx ? 'x' : (['Alice', 'Bob', 'Carla'][clients.indexOf(inv[0])])] >= 1);
    step('ballottaggio → verdetto, verità rivelata solo alla fine, classifica aggiornata');

    A.send('start');
    const again = await Promise.all(clients.map((c) => c.wait('role')));
    assert.strictEqual(again.filter((r) => r.secret).length, 1);
    step('rivincita nella stessa stanza');
    [A, B, C].forEach((c) => c.ws.close());
  } catch (e) {
    console.error('  FAIL ' + e.message);
    process.exitCode = 1;
  } finally {
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
  console.log(`\n${ok} passi superati`);
})();
