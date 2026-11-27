'use strict';
const assert=require('node:assert/strict');
require('../js/world.js');require('../js/vision.js');require('../js/game.js');
const W=TH.world,V=TH.vision,M=TH.game;
let count=0;function test(name,fn){try{fn();count++;console.log('✓',name);}catch(e){console.error('✗',name);throw e;}}
const make=roles=>M.newGame({roles});
const safe=G=>{G.guards=[];G.cameras=[];G.guests=[];};
function run(){for(let i=0;i<100&&M.G.phase==='executing';i++)M.update(.05);}
function execute(){for(const t of M.G.thieves)if(!t.escaped&&!t.ready)M.ready(t);run();}
test('griglia, percorso e scorciatoia dei condotti solo per Infiltrato',()=>{
  const a=W.findPath(21,29,27,11,{role:'infiltrato',moveMode:'walk'},{}),b=W.findPath(21,29,27,11,{role:'hacker',moveMode:'walk'},{});
  assert(a&&b);assert(a.path.some((p,i)=>i&&Math.abs(p.tx-a.path[i-1].tx)+Math.abs(p.ty-a.path[i-1].ty)>1));
  assert(!b.path.some((p,i)=>i&&Math.abs(p.tx-b.path[i-1].tx)+Math.abs(p.ty-b.path[i-1].ty)>1));assert(a.cost<b.cost);
});
test('tempo percorso misurato in secondi e porte chiuse bloccano la visuale',()=>{
  assert.equal(W.routeTime([{tx:24,ty:27},{tx:24,ty:26},{tx:24,ty:25}],2,{}),1);
  assert.equal(W.routeTime([{tx:24,ty:27},{tx:24,ty:26}],3,{}),.35);
  const ds={'35,12':{locked:true}};assert.equal(V.los(35.5,11.5,35.5,13.5,ds),false);ds['35,12'].locked=false;assert.equal(V.los(35.5,11.5,35.5,13.5,ds),true);
  assert.equal(V.los(30.5,11.5,30.5,13.5,ds),false);
});
test('planning libero, conferme sincronizzate, cinque secondi e pausa',()=>{
  const G=make(['infiltrato','hacker']);safe(G);M.queueAction(G.thieves[0],{type:'move',tx:24,ty:24,mode:'walk'});M.update(30);assert.equal(G.elapsed,0);
  M.ready(G.thieves[0]);assert.equal(G.phase,'planning');M.ready(G.thieves[0]);assert.equal(G.thieves[0].ready,false);M.ready(G.thieves[0]);M.ready(G.thieves[1]);assert.equal(G.phase,'executing');run();assert.equal(G.phase,'planning');assert.equal(G.turn,2);assert(Math.abs(G.elapsed-5)<1e-7);assert.equal(G.thieves[0].y,24.5);assert(G.events.some(e=>e.type==='movimento'&&e.turn===1&&e.second>0));M.update(5);assert(Math.abs(G.elapsed-5)<1e-7);
});
test('azione illegittima non ruba il diamante a distanza',()=>{
  const G=make(['infiltrato','hacker']);safe(G);M.queueAction(G.thieves[0],{type:'grab'});execute();assert.equal(G.diamond.takenBy,null);assert(G.events.some(e=>e.type==='azione fallita'));
});
test('impronte solo su pavimento bagnato/polveroso correndo; dati e ora registrati',()=>{
  const G=make(['infiltrato','hacker']);safe(G);const t=G.thieves[0];t.x=4.5;t.y=4.5;M.queueAction(t,{type:'move',tx:6,ty:4,mode:'run'});execute();const e=G.evidence.find(e=>e.type==='impronte');assert(e);assert.equal(e.room,'cucina');assert.equal(e.thiefId,0);assert.equal(e.turn,1);assert(e.second>0&&e.second<=5);assert.equal(typeof e.x,'number');
});
test('furto del giocatore zero non può essere ripetuto e vittoria richiede fuga di tutti',()=>{
  const G=make(['infiltrato','hacker']);safe(G);const [a,b]=G.thieves;a.x=34.5;a.y=4.5;b.x=36.5;b.y=4.5;M.queueAction(a,{type:'grab'});M.queueAction(b,{type:'grab'});execute();assert.equal(G.diamond.takenBy,0);assert(a.carrying);assert(!b.carrying);assert(G.events.some(e=>e.type==='furto'));assert(!G.evidence.some(e=>e.type==='furto'));
  a.x=30.5;a.y=29.5;b.x=31.5;b.y=29.5;M.queueAction(a,{type:'escape'});execute();assert(G.diamond.out);assert.equal(G.phase,'planning');M.queueAction(b,{type:'escape'});execute();assert.equal(G.phase,'investigation');assert.equal(G.investigation.reason,'escape');
  while(G.phase==='investigation'){const e=G.investigation.findings[G.investigation.index];M.answer(e.room);}assert.equal(G.outcome,'fuga pulita');
});
test('fuga di tutta la banda senza diamante conclude il colpo senza blocchi',()=>{
  const G=make(['infiltrato','hacker']);safe(G);G.thieves.forEach((t,i)=>{t.x=30.5+i;t.y=29.5;M.queueAction(t,{type:'escape'});});execute();assert.equal(G.phase,'investigation');assert.equal(G.investigation.reason,'failed');while(G.phase==='investigation'){const e=G.investigation.findings[G.investigation.index];M.answer(e.room);}assert.equal(G.outcome,'colpo interrotto');
});
test('avvistamento reale attiva indagine su allarme generale',()=>{
  const G=make(['infiltrato','hacker']);G.guards=[];G.guests=[];G.cameras=[{id:0,x:24.5,y:26.5,base:Math.PI/2,angle:Math.PI/2,disabledUntil:0,det:{}}];M.ready(G.thieves[0]);M.ready(G.thieves[1]);run();assert.equal(G.phase,'investigation');assert.equal(G.investigation.reason,'alarm');assert(G.evidence.some(e=>e.type==='avvistamento'));while(G.phase==='investigation'){let e=G.investigation.findings[G.investigation.index];M.answer(e.room);}assert.equal(G.outcome,'colpo interrotto');
});
test('alibi, falsificazione, esca e validazione delle azioni di classe',()=>{
  const G=make(['hacker','trasformista']);safe(G);const [h,t]=G.thieves;h.x=35.5;h.y=14.5;t.x=4.5;t.y=20.5;
  M.queueAction(h,{type:'unlock',tx:35,ty:12});M.queueAction(t,{type:'drink'});M.queueAction(t,{type:'fake'});execute();assert.equal(G.doorsState['35,12'].locked,false);assert(G.evidence.some(e=>e.type==='bicchiere'));assert(G.evidence.some(e=>e.type==='esca'));assert(G.evidence.some(e=>e.type==='accesso digitale'));
  M.queueAction(h,{type:'falsify'});execute();assert(G.evidence.find(e=>e.type==='accesso digitale').erased);assert(G.events.some(e=>e.type==='log falsificati'));
});
test('piani coordinati: sblocco remoto e attesa prima del passaggio',()=>{
  const G=make(['hacker','trasformista']);safe(G);const [h,t]=G.thieves;h.x=35.5;h.y=14.5;t.x=34.5;t.y=13.5;
  assert.equal(W.findPath(34,13,35,12,t,G.doorsState),null);
  assert(W.findPath(34,13,35,12,{...t,allowLocked:true},G.doorsState));
  M.queueAction(h,{type:'unlock',tx:35,ty:12});M.queueAction(t,{type:'wait',seconds:1});M.queueAction(t,{type:'move',tx:35,ty:11,mode:'walk'});execute();
  assert.equal(G.doorsState['35,12'].locked,false);assert.equal(t.x,35.5);assert.equal(t.y,11.5);
});
test('interrogatorio rileva spostamenti impossibili fra dichiarazioni',()=>{
  const G=make(['hacker','trasformista']);safe(G);G.evidence=[{type:'testimone',thiefId:0,room:'cucina',turn:1,second:1},{type:'testimone',thiefId:0,room:'studio',turn:2,second:6}];
  M.startInvestigation('escape');assert.equal(M.answer('cucina').ok,true);const result=M.answer('studio');assert.equal(result.ok,false);assert.match(result.text,/geometrica/);assert.equal(G.outcome,'smascherati');
});
test('training solitario registra tracce reali senza allarme e passa all’indagine',()=>{
  const G=M.newGame({training:true,roles:['infiltrato'],requireLockpick:true});const a=G.thieves[0];
  M.queueAction(a,{type:'move',tx:27,ty:6,mode:'run'});execute();assert(G.evidence.some(e=>e.type==='impronte'&&e.room==='biblioteca'));assert.equal(G.phase,'planning');
  M.queueAction(a,{type:'move',tx:34,ty:4,mode:'run'});M.queueAction(a,{type:'grab'});for(let i=0;i<3&&G.diamond.takenBy===null;i++)execute();assert.equal(G.diamond.takenBy,0);
  M.startInvestigation('training');assert(G.investigation.findings.some(e=>e.type==='impronte'));while(G.phase==='investigation'){const e=G.investigation.findings[G.investigation.index];M.answer(e.room);}assert.equal(G.outcome,'training completato');
});
test('serratura meccanica richiede scasso in modalità immersiva',()=>{
  const G=M.newGame({roles:['infiltrato','hacker'],requireLockpick:true});safe(G);const a=G.thieves[0];a.x=14.5;a.y=6.5;
  M.queueAction(a,{type:'move',tx:16,ty:6,mode:'walk'});execute();assert(G.doorsState['15,6'].locked);assert(G.events.some(e=>e.type==='azione fallita'));
  M.queueAction(a,{type:'lockpick',tx:15,ty:6});execute();assert.equal(G.doorsState['15,6'].locked,false);assert(G.evidence.some(e=>e.type==='effrazione'));
});
test('coperture bloccano la linea visiva e il terminale registra l’accesso',()=>{
  assert.equal(V.los(23.5,22.5,25.5,22.5),false);
  const G=make(['hacker','infiltrato']);safe(G);const h=G.thieves[0];h.x=33.5;h.y=16.5;M.queueAction(h,{type:'terminal'});execute();assert(G.evidence.some(e=>e.type==='accesso digitale'&&e.terminal));
});
test('colpo completo dalla posizione iniziale con pathfinding, condotto, furto e fuga',()=>{
  const G=make(['infiltrato','hacker']);safe(G);const [a,b]=G.thieves;
  for(const action of [{type:'move',tx:34,ty:4,mode:'sneak'},{type:'grab'},{type:'move',tx:30,ty:29,mode:'sneak'},{type:'escape'}])M.queueAction(a,action);
  M.queueAction(b,{type:'move',tx:31,ty:29,mode:'walk'});M.queueAction(b,{type:'escape'});
  for(let i=0;i<15&&G.phase==='planning';i++)execute();
  assert.equal(G.phase,'investigation');assert(G.diamond.out);assert(G.events.some(e=>e.type==='condotto'));assert(G.thieves.every(t=>t.escaped));
});
test('le dichiarazioni contrarie al reperto causano contraddizioni',()=>{
  const G=make(['infiltrato','hacker']);safe(G);M.startInvestigation('escape');const e=G.investigation.findings[0];const wrong=W.ROOMS.find(r=>r.id!==e.room).id;let answer=M.answer(wrong);assert.equal(answer.ok,false);assert.equal(G.outcome,'smascherati');
});
console.log(`\n${count} test superati.`);
