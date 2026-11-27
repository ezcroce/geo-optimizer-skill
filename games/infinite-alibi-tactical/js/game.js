'use strict';
globalThis.TH = globalThis.TH || {};
TH.game = (() => {
  const W = TH.world, V = TH.vision;
  const ROLES = {
    infiltrato: { name: 'Infiltrato', color: '#6de5aa', icon: 'I', desc: 'Condotti, scasso e movimento silenzioso.' },
    hacker: { name: 'Hacker', color: '#65c9ff', icon: 'H', desc: 'Disattiva telecamere e sblocca porte elettroniche a distanza.' },
    trasformista: { name: 'Trasformista', color: '#f79bc1', icon: 'T', desc: 'Si mescola agli ospiti, distrae guardie e piazza esche.' },
    ricognitore: { name: 'Ricognitore', color: '#ffd073', icon: 'R', desc: 'Vista ampia, microspie e sbirciate attraverso le porte.' }
  };
  const EXEC_SECONDS = 5, SPEED = { walk: 2, sneak: 1.25, run: 3 };
  let G;
  const roomAt = (x,y) => W.roomAt(Math.floor(x),Math.floor(y))?.id || W.doorAt(Math.floor(x),Math.floor(y))?.a || 'corridoio';
  const roomName = id => W.roomById(id)?.name || id;
  const doorState = (x,y) => G.doorsState[x+','+y];
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const near = (th,x,y,r=1.6) => Math.hypot(th.x-(x+.5),th.y-(y+.5)) <= r;
  function event(type, th, extra={}) {
    const e = { id:G.events.length, type, turn:G.turn, second:Math.round(G.elapsed*100)/100,
      thiefId:th?.id ?? null, x:Math.floor(th?.x ?? extra.x ?? 0), y:Math.floor(th?.y ?? extra.y ?? 0),
      room:th ? roomAt(th.x, th.y) : null, ...extra };
    G.events.push(e); return e;
  }
  function message(s) { G.message=s; G.messages.unshift(`T${G.turn} · ${s}`); G.messages=G.messages.slice(0,30); }
  function newGame(opts={}) {
    let roles = opts.roles || ['infiltrato','hacker','trasformista','ricognitore'].slice(0,opts.teamSize || 4);
    if (roles.length < 2 || roles.length > 4 || new Set(roles).size !== roles.length || roles.some(r=>!ROLES[r])) throw Error('Scegli da 2 a 4 specialisti diversi');
    G={ phase:'planning', turn:1, elapsed:0, turnElapsed:0, alarm:0, selected:0, message:'Pianifica senza fretta. Conferma ogni specialista.', messages:[], events:[], evidence:[], spies:[], doorsState:{}, diamond:{takenBy:null,out:false}, outcome:null, investigation:null };
    for (const d of W.DOORS) G.doorsState[d.tx+','+d.ty]={locked:d.type==='ldoor'||d.type==='edoor'};
    const spawns=[[24,27],[26,27],[28,27],[30,27]];
    G.thieves=roles.map((role,id)=>({id, role, name:ROLES[role].name, color:ROLES[role].color, x:spawns[id][0]+.5,y:spawns[id][1]+.5,queue:[],ready:false,escaped:false,carrying:false, moveMode:'walk',revealed:new Set(), lastPrint:null}));
    // Pattuglie con tappe nella stessa stanza: nessun attraversamento dei muri.
    G.guards=[
      {x:34.5,y:9.5,wp:[[34,9],[39,9],[39,5],[34,5]],i:1},
      {x:9.5,y:16.5,wp:[[9,16],[22,16],[32,16],[22,16]],i:1},
      {x:8.5,y:24.5,wp:[[8,24],[17,24],[17,27],[8,27]],i:1}
    ].map((g,id)=>({...g,id,angle:0,det:{},distractedUntil:0,path:null}));
    G.guests=[{x:6.5,y:6.5,angle:0},{x:12.5,y:9.5,angle:1},{x:8.5,y:22.5,angle:2},{x:16.5,y:26.5,angle:3}].map((g,id)=>({...g,id,observed:{}}));
    G.cameras=[{x:40.5,y:3.5,base:2.65},{x:3.5,y:14.5,base:0},{x:18.5,y:20.5,base:2.8},{x:40.5,y:28.5,base:Math.PI}].map((c,id)=>({...c,id,angle:c.base,disabledUntil:0,det:{}}));
    for(const th of G.thieves) event('inizio',th);
    return G;
  }
  function queueAction(th,a) { if(G.phase!=='planning'||th.ready||th.escaped) return false; th.queue.push({...a}); return true; }
  function clearQueue(th) { if(G.phase==='planning'&&!th.ready) th.queue=[]; }
  function ready(th) { if(G.phase!=='planning'||th.escaped) return false; th.ready=!th.ready; if(G.thieves.every(t=>t.ready||t.escaped)) startExecution(); return true; }
  function startExecution() { if(G.phase!=='planning'||!G.thieves.every(t=>t.ready||t.escaped)) return false; G.phase='executing'; G.turnElapsed=0; message('Esecuzione simultanea · 5 secondi'); return true; }
  function trace(type,th,extra={}) { const e=event(type,th,extra); G.evidence.push(e); }
  function advance(th) { th.queue.shift(); }
  function failed(th,reason) { message(`${th.name}: ${reason}`); event('azione fallita',th,{detail:reason}); advance(th); }
  function timed(a,dt,seconds) { a.progress=(a.progress||0)+dt; return a.progress+1e-7>=seconds; }
  function move(th,a,dt) {
    if(!a.path){ const p=W.findPath(Math.floor(th.x),Math.floor(th.y),a.tx,a.ty,{...th,moveMode:a.mode||'walk'},G.doorsState); if(!p) return failed(th,'percorso non disponibile'); a.path=p.path; a.i=1; }
    if(a.i>=a.path.length) {advance(th);return;}
    const node=a.path[a.i], prev=a.path[a.i-1], d=W.doorAt(node.tx,node.ty);
    if(d && doorState(d.tx,d.ty)?.locked) {
      const allowed=(d.type==='ldoor'&&th.role==='infiltrato')||(d.type==='edoor'&&th.role==='hacker');
      if(!allowed) return failed(th,'porta chiusa');
      if(!timed(a,dt,1.5)) return;
      a.progress=0; doorState(d.tx,d.ty).locked=false;
      trace(d.type==='ldoor'?'effrazione':'accesso digitale',th,{x:d.tx,y:d.ty,room:roomAt(d.tx+.5,d.ty+.5)});
      message(`${th.name} sblocca una porta.`); return;
    }
    if(W.ventPair(prev.tx,prev.ty)?.tx===node.tx && W.ventPair(prev.tx,prev.ty)?.ty===node.ty) {
      if(!timed(a,dt,.5))return; a.progress=0; th.x=node.tx+.5;th.y=node.ty+.5; a.i++;trace('condotto',th); return;
    }
    const tx=node.tx+.5, ty=node.ty+.5, dx=tx-th.x,dy=ty-th.y, len=Math.hypot(dx,dy), amount=Math.min(len,SPEED[a.mode||'walk']*dt);
    if(len>0){th.x+=dx/len*amount;th.y+=dy/len*amount;}
    if(len<=amount+1e-7){th.x=tx;th.y=ty;a.i++; event('movimento',th,{mode:a.mode||'walk'});
      const tile=W.tileAt(node.tx,node.ty); if((tile===W.T.WET||tile===W.T.DUSTY) && (a.mode==='run')) trace('impronte',th,{shoe:36+th.id*2});
    }
    if(a.i>=a.path.length)advance(th);
  }
  function act(th,dt) {
    if(th.escaped||!th.queue.length)return;
    const a=th.queue[0]; if(a.type==='move')return move(th,a,dt);
    if(a.type==='wait') {if(timed(a,dt,a.seconds||1)){event('attesa',th);advance(th);}return;}
    if(!timed(a,dt,1)) return;
    switch(a.type){
      case 'grab':
        if(!near(th,35,4,1.6)||G.diamond.takenBy!==null) return failed(th,'avvicinati al diamante disponibile');
        G.diamond.takenBy=th.id;th.carrying=true;event('furto',th); message(`${th.name} ha il diamante!`);break;
      case 'escape':
        if(W.tileAt(Math.floor(th.x),Math.floor(th.y))!==W.T.EXIT) return failed(th,'raggiungi un tile uscita');
        th.escaped=true;if(th.carrying)G.diamond.out=true;event('fuga',th);message(`${th.name} è uscito.`);break;
      case 'drink':
        if(!near(th,4,21,2.4))return failed(th,'avvicinati al bar');
        trace('bicchiere',th);message(`${th.name} lascia un bicchiere al bar.`);break;
      case 'witness':
        if(!G.guests.some(g=>dist(th,g)<2.5 && V.los(th.x,th.y,g.x,g.y,G.doorsState)))return failed(th,'serve un ospite vicino e visibile');
        trace('testimone',th);message(`Un ospite ricorderà ${th.name}.`);break;
      case 'disableCam': {
        const c=G.cameras[a.id]; if(th.role!=='hacker'||!c||dist(th,c)>7||!V.los(th.x,th.y,c.x,c.y,G.doorsState))return failed(th,'telecamera fuori portata o non visibile');
        c.disabledUntil=G.elapsed+15;trace('telecamera spenta',th,{camera:c.id});message('Telecamera disattivata per 15 secondi di esecuzione.');break;}
      case 'unlock': {
        const d=W.doorAt(a.tx,a.ty); if(th.role!=='hacker'||!d||d.type!=='edoor'||!doorState(d.tx,d.ty).locked||!near(th,d.tx,d.ty,7)||!V.los(th.x,th.y,d.tx+.5,d.ty+.5))return failed(th,'porta elettronica non raggiungibile');
        doorState(d.tx,d.ty).locked=false;trace('accesso digitale',th,{x:d.tx,y:d.ty});message('Porta elettronica sbloccata.');break;}
      case 'falsify': {
        if(th.role!=='hacker')return failed(th,'serve l’Hacker');
        let n=0;for(const e of G.evidence) if((e.type==='accesso digitale'||e.type==='telecamera spenta')&&!e.erased){e.erased=true;n++;}
        event('log falsificati',th,{count:n});message(`Registri digitali falsificati: ${n} tracce rimosse dalla plancia.`);break;}
      case 'distract': {
        const g=G.guards[a.id];if(th.role!=='trasformista'||!g||dist(th,g)>3||!V.los(th.x,th.y,g.x,g.y,G.doorsState))return failed(th,'guardia fuori portata');
        g.distractedUntil=G.elapsed+7;event('distrazione',th,{guardia:g.id});message('Guardia distratta per 7 secondi.');break;}
      case 'fake':
        if(th.role!=='trasformista')return failed(th,'serve il Trasformista');
        if(G.evidence.filter(e=>e.type==='esca').length>=3)return failed(th,'massimo tre esche');
        trace('esca',th,{shoe:99});message('Esca piazzata: può distrarre gli investigatori.');break;
      case 'spy':
        if(th.role!=='ricognitore')return failed(th,'serve il Ricognitore');
        G.spies.push({x:th.x,y:th.y});event('microspia',th);message('Microspia attiva: traccia i PNG vicini attraverso i muri.');break;
      case 'peek': {
        const d=W.doorAt(a.tx,a.ty);if(th.role!=='ricognitore'||!d||!near(th,d.tx,d.ty,1.8))return failed(th,'avvicinati a una porta');
        const here=roomAt(th.x,th.y), other=d.a===here?d.b:d.a, r=W.roomById(other);if(r)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)th.revealed.add(y*W.W+x);
        event('sbirciata',th,{roomRevealed:other});message(`Sbirciata: ${roomName(other)} rivelata.`);break;}
      default:return failed(th,'azione sconosciuta');
    }
    advance(th);
  }
  function updateGuard(g,dt) {
    if(G.elapsed<g.distractedUntil)return;
    const wp=g.wp[g.i%g.wp.length];
    if(!g.path){let p=W.findPath(Math.floor(g.x),Math.floor(g.y),wp[0],wp[1],null,G.doorsState);g.path=p?.path||[];g.pi=1;}
    if(g.pi>=g.path.length){g.i++;g.path=null;return;}
    const n=g.path[g.pi],dx=n.tx+.5-g.x,dy=n.ty+.5-g.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*1.4);
    if(d){g.x+=dx/d*step;g.y+=dy/d*step;g.angle=Math.atan2(dy,dx);}if(d<=step+1e-7)g.pi++;
  }
  function detect(dt) {
    let max=0;
    const obs=[...G.guards.map(o=>({o,range:7,fov:1.2,kind:'guardia'})),...G.cameras.filter(c=>G.elapsed>=c.disabledUntil).map(o=>({o,range:9,fov:1,kind:'telecamera'}))];
    for(const {o,range,fov,kind} of obs){
      const poly=V.cone(o.x,o.y,o.angle,fov,range,24,G.doorsState);o._cone=poly;
      for(const th of G.thieves){if(th.escaped)continue;
        const d=dist(o,th), seen=(kind!=='guardia'||G.elapsed>=o.distractedUntil)&&d<range&&V.inCone(poly,th.x,th.y,o.x,o.y,G.doorsState);
        const blending=th.role==='trasformista'&&G.guests.some(g=>dist(th,g)<2.5);
        const mode=th.queue[0]?.type==='move'?th.queue[0].mode:'idle';
        const rate=V.spotRate(d,range,{state:mode,blending}) * 35;
        o.det[th.id]=Math.max(0,Math.min(100,(o.det[th.id]||0)+(seen?rate:-18)*dt));
        max=Math.max(max,o.det[th.id]);
        if(o.det[th.id]>=100){ trace('avvistamento',th,{observer:kind});message(`${th.name} avvistato: allarme generale!`);G.alarm=100;startInvestigation('alarm');return; }
      }
    }
    G.alarm=max;
  }
  function update(dt) {
    if(!G||G.phase!=='executing')return;
    // Nessuna simulazione fuori dalla finestra di cinque secondi.
    dt=Math.min(Math.max(dt,0),EXEC_SECONDS-G.turnElapsed);G.turnElapsed+=dt;G.elapsed+=dt;
    for(const c of G.cameras)c.angle=c.base+Math.sin(G.elapsed*.7+c.id)*.45;
    for(const th of G.thieves)act(th,dt);
    for(const g of G.guards)updateGuard(g,dt);
    for(const guest of G.guests){
      guest.angle+=dt*.18;
      const poly=V.cone(guest.x,guest.y,guest.angle,1,5,20,G.doorsState);
      for(const th of G.thieves){
        if(th.escaped || guest.observed[th.id]===G.turn)continue;
        if(Math.hypot(th.x-guest.x,th.y-guest.y)<5 && V.inCone(poly,th.x,th.y,guest.x,guest.y,G.doorsState)){
          guest.observed[th.id]=G.turn;trace('testimone',th,{guest:guest.id});
        }
      }
    }
    detect(dt);if(G.phase!=='executing')return;
    if(G.thieves.every(t=>t.escaped)){startInvestigation(G.diamond.out?'escape':'failed');return;}
    if(G.turnElapsed>=EXEC_SECONDS-1e-7){G.phase='planning';G.turn++;for(const th of G.thieves)th.ready=false;message('Pianificazione libera: conferma ogni specialista.');}
  }
  function startInvestigation(reason){
    G.phase='investigation'; const evidence=G.evidence.filter(e=>!e.erased);
    const distractions=Math.min(3,evidence.filter(e=>e.type==='esca').length);
    // Le esche occupano parte dell'attenzione limitata degli investigatori, senza cancellare il registro.
    const findings=evidence.filter(e=>['impronte','avvistamento','effrazione','testimone','bicchiere'].includes(e.type)).slice(0,8-distractions);
    // Always ask at least one question. A real logged position supplies the reference.
    if(!findings.length)findings.push(G.events.find(e=>e.type==='inizio'));
    G.investigation={reason,findings,index:0,answers:[],contradictions:0};message(reason==='alarm'?'Allarme generale: inizia l’indagine.':reason==='failed'?'La banda è fuggita senza il diamante.':'Fuga completata: inizia l’indagine.');
  }
  function answer(room){
    const I=G.investigation;if(G.phase!=='investigation'||I.index>=I.findings.length)return;
    const e=I.findings[I.index],th=G.thieves[e.thiefId];let ok=room===e.room;
    let text=ok?'La dichiarazione coincide con il reperto.':`Incongruenza: il reperto colloca ${th.name} in ${roomName(e.room)}.`;
    // Compare statements across turns using the fastest available grid route.
    const prev=[...I.answers].reverse().find(a=>a.thiefId===e.thiefId && a.turn<e.turn);
    if(prev && prev.room!==room){
      const from=W.roomById(prev.room),to=W.roomById(room);let best=Infinity;
      // Minimum grid distance from any tile of one room to the other (multi-source Dijkstra).
      if(from&&to){
        const bests=new Float64Array(W.W*W.H);bests.fill(Infinity);const open=[];
        for(let y=from.y;y<from.y+from.h;y++)for(let x=from.x;x<from.x+from.w;x++)if(W.passCost(x,y,th,G.doorsState)<Infinity){bests[y*W.W+x]=0;open.push({x,y,c:0});}
        while(open.length){open.sort((a,b)=>b.c-a.c);const n=open.pop();if(n.c!==bests[n.y*W.W+n.x])continue;
          if(n.x>=to.x&&n.x<to.x+to.w&&n.y>=to.y&&n.y<to.y+to.h){best=n.c;break;}
          const neighbors=[[n.x+1,n.y],[n.x-1,n.y],[n.x,n.y+1],[n.x,n.y-1]];
          if(th.role==='infiltrato'){const pair=W.ventPair(n.x,n.y);if(pair)neighbors.push([pair.tx,pair.ty]);}
          for(const [x,y] of neighbors){if(x<0||y<0||x>=W.W||y>=W.H)continue;const c=n.c+W.passCost(x,y,{...th,moveMode:'run'},G.doorsState),k=y*W.W+x;if(c<bests[k]){bests[k]=c;open.push({x,y,c});}}
        }
      }
      const budget=(e.turn-prev.turn)*EXEC_SECONDS*SPEED.run;
      if(best>budget){ok=false;text='Contraddizione geometrica: spostamento impossibile nel tempo dichiarato.';}
    }
    if(!ok)I.contradictions++;
    I.answers.push({thiefId:e.thiefId,turn:e.turn,room,ok,text});I.index++;
    if(I.index>=I.findings.length){G.phase='over';G.outcome=I.reason==='escape'&&I.contradictions===0?'fuga pulita':I.reason!=='escape'?'colpo interrotto':'smascherati';}
    return {ok,text};
  }
  function visibleNow(){const s=new Set();for(const th of G.thieves){if(th.escaped)continue;for(const k of V.visibleTiles(th.x,th.y,th.role==='ricognitore'?9:6,G.doorsState))s.add(k);for(const k of th.revealed)s.add(k);}return s;}
  return {ROLES,EXEC_SECONDS,SPEED,get G(){return G;},newGame,queueAction,clearQueue,ready,startExecution,update,visibleNow,roomName,answer,startInvestigation};
})();
