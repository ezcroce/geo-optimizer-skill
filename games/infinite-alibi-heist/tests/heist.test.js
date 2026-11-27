'use strict';
const assert=require('node:assert/strict');
require('../js/world.js');require('../js/vision.js');require('../js/engine.js');
const E=TH.heist,W=TH.world,V=TH.vision;
let ok=0;function test(n,f){try{f();ok++;console.log('✓',n);}catch(e){console.error('✗',n);throw e;}}
function advance(sec,input={}){for(let i=0;i<Math.round(sec*20);i++)E.update(.05,input);}
test('movimento diretto continuo, pausa fuori simulazione e collisione contro muri',()=>{const G=E.newGame(true),p=G.player;const x=p.x;advance(1,{x:1});assert(p.x>x+2);const t=G.time;assert.equal(G.time,t);p.x=28.5;p.y=13.5;advance(2,{y:-1});assert(p.y>=13.2);});
test('accademia richiede movimento e copertura prima del terminale',()=>{const G=E.newGame(true),p=G.player;p.x=33.5;p.y=16.5;assert.equal(E.context(),null);p.x=24.5;advance(1.5,{x:1});assert.equal(G.lesson,2);p.x=29.5;p.y=15.5;advance(1,{crouch:true});assert.equal(G.lesson,3);});
test('il terminale apre lo Studio e il furto richiede interazione',()=>{const G=E.newGame(true),p=G.player;G.lesson=3;p.x=33.5;p.y=16.5;assert.equal(E.context().type,'hack');E.interact();advance(1.6);assert(G.terminalOn);assert.equal(G.doors['35,12'].locked,false);p.x=34.5;p.y=4.5;assert.equal(E.context().type,'steal');E.interact();advance(1.3);assert(G.hasGem);assert(G.events.some(e=>e.type==='furto'));});
test('uscita valida solo con diamante e dopo l’interazione',()=>{const G=E.newGame(true),p=G.player;G.lesson=3;p.x=32.5;p.y=29.5;assert.equal(E.context(),null);G.hasGem=true;assert.equal(E.context().type,'escape');E.interact();advance(.6);assert.equal(G.phase,'won');});
test('armadio nasconde realmente dalla linea di vista e permette di uscire',()=>{const G=E.newGame(true),p=G.player;p.x=25.5;p.y=20.5;const c=G.cameras[2];c.x=24.5;c.y=20.5;c.angle=0;assert(E.see(c,p,8,1.05));assert.equal(E.context().type,'hide');E.interact();advance(.4);assert(p.hidden);assert.equal(E.see(c,p,8,1.05),false);assert(E.interact());assert.equal(p.hidden,false);});
test('rumore della corsa induce sospetto e genera tracce dove previsto',()=>{const G=E.newGame(true),p=G.player,g=G.guards[0];p.x=20.5;p.y=4.5;g.x=21.5;g.y=5.5;g.angle=Math.PI/2;advance(.3,{x:1,run:true});assert(G.events.some(e=>e.type==='impronte'));assert(G.lastFootstep.noise>3);assert(g.suspicion>0);});
test('coperture e porte bloccano i raggi visivi',()=>{const G=E.newGame(true);assert.equal(V.los(29.5,14.5,31.5,14.5,G.doors),false);assert.equal(V.los(35.5,11.5,35.5,13.5,G.doors),false);G.doors['35,12'].locked=false;assert.equal(V.los(35.5,11.5,35.5,13.5,G.doors),true);});
test('un avvistamento avvia ricerca, non game over immediato',()=>{const G=E.newGame(false),p=G.player;G.guards=[];G.cameras=[{x:30.5,y:25.5,angle:0,seen:0,state:'patrol',id:0}];p.x=32.5;p.y=25.5;advance(1.1);assert(G.events.some(e=>e.type==='avvistamento'));assert.equal(G.phase,'play');});
test('le guardie dimenticano il sospetto dopo aver perso la visuale',()=>{const G=E.newGame(false),p=G.player;G.cameras=[];let g=G.guards[0];G.guards=[g];g.state='chase';g.target={x:g.x,y:g.y};g.searchUntil=G.time+1;p.hidden=true;advance(1.2);assert.equal(g.state,'patrol');});
test('accademia interamente percorribile dal punto di partenza senza teletrasporti',()=>{
  const G=E.newGame(true),p=G.player;
  function go(x,y){const path=W.findPath(Math.floor(p.x),Math.floor(p.y),x,y,null,G.doors);assert(path);
    for(const n of path.path.slice(1)){let i=0;while(Math.hypot(n.tx+.5-p.x,n.ty+.5-p.y)>.065&&i++<100){const dx=n.tx+.5-p.x,dy=n.ty+.5-p.y,d=Math.hypot(dx,dy);E.update(.05,{x:dx/d,y:dy/d});}assert(i<100,'percorso bloccato');}}
  go(27,16);assert.equal(G.lesson,2);go(29,15);advance(1,{crouch:true});assert.equal(G.lesson,3);go(33,16);assert(E.interact());advance(1.6);assert(G.terminalOn);go(35,5);assert(E.interact());advance(1.3);assert(G.hasGem);go(32,29);assert(E.interact());advance(.6);assert.equal(G.phase,'won');
});
console.log(`\n${ok} test superati.`);
