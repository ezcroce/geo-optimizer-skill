'use strict';
globalThis.TH = globalThis.TH || {};
TH.heist = (() => {
  const W=TH.world,V=TH.vision;
  const SPEED={walk:2.4,run:4.1,sneak:1.45};
  const TERMINAL={x:33.5,y:16.5}, DIAMOND={x:35.5,y:4.5}, EXIT={x:32.5,y:29.5};
  const CABINETS=W.FURN.filter(f=>f.kind==='cabinet');
  let G;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const room=(x,y)=>{const tx=Math.floor(x),ty=Math.floor(y);return W.roomAt(tx,ty)?.name||W.roomById(W.doorAt(tx,ty)?.a)?.name||W.roomById('corridoio').name;};
  function log(type,extra={}){const p=G.player;const e={type,time:Math.round(G.time*10)/10,x:Math.floor(p.x),y:Math.floor(p.y),room:room(p.x,p.y),...extra};G.events.push(e);if(G.events.length>500)G.events.shift();
    // I reperti rimangono disponibili anche quando i segni visivi svaniscono.
    if(['impronte','effrazione','accesso digitale','avvistamento','testimone','cattura'].includes(type) && !G.evidence.some(old=>old.type===e.type&&old.room===e.room))G.evidence.push({...e});
  }
  function notice(s){G.message=s;G.messageTime=G.time;}
  function makeGuard(x,y,wp,id){return {id,x,y,wp,index:1,angle:0,state:'patrol',suspicion:0,target:null,searchUntil:0,path:[],pi:0,repath:0,seen:0,capture:0};}
  function newGame(training=true){
    const doors={};for(const d of W.DOORS)doors[d.tx+','+d.ty]={locked:d.type==='ldoor'||d.type==='edoor'};
    G={training,lesson:training?1:0,phase:'play',time:0,doors,events:[],evidence:[],particles:[],usedSecretAfterHeist:false,secretTime:null,investigation:null,message:'',messageTime:0,noiseTimer:0,hasGem:false,terminalOn:false,won:false,
      player:{x:training?24.5:31.5,y:training?16.5:26.5,angle:0,moveAngle:0,speed:0,moving:false,crouched:false,hidden:false,interaction:null,step:0,walkDistance:0},
      guards:training?[makeGuard(35.5,16.5,[[35,16],[27,16]],0),makeGuard(34.5,9.5,[[34,9],[39,9],[39,5],[34,5]],1)]:[
        makeGuard(35.5,16.5,[[35,16],[25,16],[25,14],[35,14]],0),makeGuard(34.5,9.5,[[34,9],[39,9],[39,5],[34,5]],1),makeGuard(8.5,24.5,[[8,24],[17,24],[17,27],[8,27]],2)],
      guests:[{id:0,x:7.5,y:6.5,base:0,angle:0,seen:0,lastReport:-30,state:'patrol'}, {id:1,x:14.5,y:22.5,base:Math.PI,angle:Math.PI,seen:0,lastReport:-30,state:'patrol'}],
      cameras:[{id:0,x:30.5,y:13.5,angle:Math.PI/2,seen:0,state:'patrol'}, {id:1,x:40.5,y:3.5,angle:2.65,seen:0,state:'patrol'}, {id:2,x:19.5,y:19.5,angle:2.65,seen:0,state:'patrol'}]};
    log('inizio');return G;
  }
  function walkable(x,y){const tx=Math.floor(x),ty=Math.floor(y),tile=W.tileAt(tx,ty),d=W.doorAt(tx,ty);return tile!==W.T.WALL&&tile!==W.T.FURN&&!(d&&G.doors[tx+','+ty]?.locked);}
  function fits(x,y){const r=.22;return walkable(x-r,y-r)&&walkable(x+r,y-r)&&walkable(x-r,y+r)&&walkable(x+r,y+r);}
  function move(p,dx,dy){if(fits(p.x+dx,p.y))p.x+=dx;if(fits(p.x,p.y+dy))p.y+=dy;}
  function ground(p){const r=W.roomAt(Math.floor(p.x),Math.floor(p.y))?.id;return r==='biblioteca'?'polvere':r==='cucina'?'bagnato':r==='salone'?'tappeto':r==='studio'?'marmo':'parquet';}
  function emitFootstep(){const p=G.player,material=ground(p),mult=material==='marmo'?1.25:material==='tappeto'?.45:1,noise=(p.crouched?1.6:p.speed>3.3?7:3.4)*mult;
    if(material==='polvere'||material==='bagnato')log('impronte',{material});
    G.particles.push({x:p.x,y:p.y,age:0,kind:material==='polvere'||material==='bagnato'?'print':'step',angle:p.moveAngle});if(G.particles.length>80)G.particles.shift();
    G.lastFootstep={time:G.time,material,noise};
    for(const g of G.guards)if(distance(g,p)<noise){g.suspicion=Math.max(g.suspicion,35);if(g.state!=='chase')g.state='suspicious';g.target={x:p.x,y:p.y};g.searchUntil=G.time+4;g.repath=0;}
  }
  function nearestCabinet(){let p=G.player;return CABINETS.find(c=>Math.hypot(p.x-c.tx-.5,p.y-c.ty-.5)<1.6);}
  function context(){const p=G.player;if(G.phase!=='play')return null;if(p.hidden)return {type:'leave',label:'Esci dal nascondiglio'};
    if((!G.training||G.lesson===3)&&!G.hasGem&&distance(p,DIAMOND)<1.55)return {type:'steal',label:'Ruba il diamante'};
    if((!G.training||G.lesson===3)&&!G.terminalOn&&distance(p,TERMINAL)<1.5)return {type:'hack',label:'Hackera il terminale'};
    const c=nearestCabinet();if(c)return {type:'hide',label:'Nasconditi nell’armadio',cabinet:c};
    const lockedDoor=W.DOORS.find(d=>d.type==='ldoor'&&G.doors[d.tx+','+d.ty].locked&&Math.hypot(p.x-d.tx-.5,p.y-d.ty-.5)<1.5);
    if(lockedDoor)return {type:'force',label:'Forza la serratura',door:lockedDoor};
    if(G.hasGem&&(!G.training||G.usedSecretAfterHeist)&&W.tileAt(Math.floor(p.x),Math.floor(p.y))===W.T.EXIT)return {type:'escape',label:'Fuggi dalla villa'};
    return null;}
  function interact(){const p=G.player;if(p.interaction||G.phase!=='play')return false;const a=context();if(!a)return false;
    if(a.type==='leave'){p.hidden=false;log('esce dal nascondiglio');notice('Sei uscito dal nascondiglio.');return true;}
    p.interaction={...a,elapsed:0,duration:a.type==='steal'?1.2:a.type==='hack'?1.5:a.type==='force'?1.8:a.type==='hide'?.3:.5};return true;}
  function complete(a){const p=G.player;
    if(a.type==='steal'){G.hasGem=true;log('furto');notice('Diamante recuperato. Raggiungi l’uscita.');}
    if(a.type==='hack'){G.terminalOn=true;G.doors['35,12'].locked=false;log('accesso digitale');notice('Porta dello Studio sbloccata.');}
    if(a.type==='force'){G.doors[a.door.tx+','+a.door.ty].locked=false;log('effrazione',{doorX:a.door.tx,doorY:a.door.ty});notice('Serratura forzata: hai lasciato una traccia.');}
    if(a.type==='hide'){p.hidden=true;log('nascondiglio');notice('Sei nascosto. Premi E per uscire.');}
    if(a.type==='escape'){log('fuga');p.interaction=null;startInvestigation('escape');return;}
    p.interaction=null;
  }
  function planGuard(g,tx,ty){const p=W.findPath(Math.floor(g.x),Math.floor(g.y),Math.floor(tx),Math.floor(ty),null,G.doors);g.path=p?.path||[];g.pi=1;}
  function moveGuard(g,dt,tx,ty,speed){g.repath-=dt;if(g.repath<=0||!g.path.length){planGuard(g,tx,ty);g.repath=.7;}
    if(g.pi>=g.path.length)return;
    const n=g.path[g.pi],dx=n.tx+.5-g.x,dy=n.ty+.5-g.y,d=Math.hypot(dx,dy),step=Math.min(d,speed*dt);if(d){g.x+=dx/d*step;g.y+=dy/d*step;g.angle=Math.atan2(dy,dx);}if(d<=step+.001)g.pi++;
  }
  function see(o,p,range,fov){if(p.hidden)return false;const dx=p.x-o.x,dy=p.y-o.y,dist=Math.hypot(dx,dy);if(dist>=range||dist<.01)return false;const diff=Math.atan2(Math.sin(Math.atan2(dy,dx)-o.angle),Math.cos(Math.atan2(dy,dx)-o.angle));return Math.abs(diff)<=fov/2&&V.los(o.x,o.y,p.x,p.y,G.doors);}
  function alertAt(x,y){for(const g of G.guards){if(Math.hypot(g.x-x,g.y-y)>12)continue;g.state='chase';g.suspicion=100;g.target={x,y};g.searchUntil=G.time+7;g.repath=0;}notice('Ti hanno visto: rompi la visuale o nasconditi.');}
  function updateGuard(g,dt){const p=G.player,visible=see(g,p,7,1.15);g.seen=Math.max(0,Math.min(1.3,g.seen+(visible?(p.crouched?.42:1):-1.4)*dt));
    if(visible){g.suspicion=Math.min(100,g.suspicion+dt*45);if(g.seen>=1&&g.state!=='chase'){log('avvistamento',{observer:'guardia'});alertAt(p.x,p.y);}}
    if(g.state==='chase'&&visible){g.target={x:p.x,y:p.y};g.searchUntil=G.time+7;}
    if(g.state!=='patrol'&&G.time>g.searchUntil){g.state='patrol';g.suspicion=0;g.target=null;g.path=[];g.repath=0;}
    if(g.state!=='patrol'&&g.target)moveGuard(g,dt,g.target.x,g.target.y,g.state==='chase'?2.9:1.6);
    else{g.suspicion=Math.max(0,g.suspicion-10*dt);const wp=g.wp[g.index%g.wp.length];moveGuard(g,dt,wp[0]+.5,wp[1]+.5,1.35);if(Math.hypot(g.x-wp[0]-.5,g.y-wp[1]-.5)<.15){g.index++;g.path=[];g.repath=0;}}
    if(!p.hidden&&g.state==='chase'&&distance(g,p)<.6){g.capture+=dt;if(g.capture>1&&!G.training){log('cattura');startInvestigation('caught');}}else g.capture=0;
  }
  function update(dt,input={}){if(!G||G.phase!=='play')return;dt=Math.max(0,Math.min(dt,.05));G.time+=dt;const p=G.player;
    let dx=input.x||0,dy=input.y||0,len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;len=1;}
    p.crouched=!!input.crouch&&!p.hidden;p.speed=p.crouched?SPEED.sneak:input.run?SPEED.run:SPEED.walk;
    p.moving=false;if(!p.hidden&&!p.interaction&&len>.1){const ox=p.x,oy=p.y;p.moveAngle=Math.atan2(dy,dx);move(p,dx*p.speed*dt,dy*p.speed*dt);const travelled=Math.hypot(p.x-ox,p.y-oy);if(G.hasGem&&Math.floor(p.x)===28&&Math.floor(p.y)===6&&Math.floor(ox)===29&&Math.floor(oy)===6){G.usedSecretAfterHeist=true;G.secretTime=Math.round(G.time*10)/10;log('passaggio segreto');notice('Passaggio segreto attraversato: ora raggiungi l’uscita.');}p.moving=travelled>.001;p.walkDistance+=travelled;p.step+=travelled*5;if(p.walkDistance>.72){p.walkDistance=0;emitFootstep();}}
    if(Number.isFinite(input.aim))p.angle=input.aim;else if(p.moving)p.angle=p.moveAngle;
    if(p.interaction){p.interaction.elapsed+=dt;if(p.interaction.elapsed>=p.interaction.duration)complete(p.interaction);}
    if(G.phase!=='play')return;
    for(const c of G.cameras){const visible=see(c,p,8,1.05);c.seen=Math.max(0,Math.min(1.3,c.seen+(visible?(p.crouched?.45:1):-1.4)*dt));c.state=c.seen>=1?'chase':c.seen>.2?'suspicious':'patrol';if(c.seen>=1&&G.time>(c.lastAlert||-10)+5){c.lastAlert=G.time;log('avvistamento',{observer:'telecamera'});alertAt(p.x,p.y);}}
    for(const guest of G.guests){
      guest.angle=guest.base+Math.sin(G.time*.35+guest.id)*.6;
      const visible=see(guest,p,5,.9);guest.seen=Math.max(0,Math.min(1,guest.seen+(visible?(p.crouched?.4:1):-1.2)*dt));
      guest.state=guest.seen>=1?'chase':guest.seen>.2?'suspicious':'patrol';
      if(guest.seen>=1&&G.time>guest.lastReport+8){guest.lastReport=G.time;log('testimone',{observer:'ospite'});alertAt(p.x,p.y);}
    }
    for(const g of G.guards){if(G.phase!=='play')break;updateGuard(g,dt);}
    if(G.phase!=='play')return;
    for(const q of G.particles)q.age+=dt;G.particles=G.particles.filter(q=>q.age<8);
    if(G.training&&G.lesson===1&&p.x>=27.3&&p.y>=14&&p.y<=17.8){G.lesson=2;notice('Bene. Adesso usa la colonna come copertura.');}
    if(G.training&&G.lesson===2&&p.crouched&&Math.hypot(p.x-30.5,p.y-14.5)<2.3){G.coverTime=(G.coverTime||0)+dt;if(G.coverTime>=.8){G.lesson=3;notice('Copertura riuscita. Ora ruba il diamante e fuggi.');}}else G.coverTime=0;
  }
  // Ricostruzione limitata ai reperti osservabili. La prova geometrica è un
  // limite inferiore ottimistico: non prova che il sospettato fosse altrove.
  function geometryQuestion(e){
    const unlocked={};for(const d of W.DOORS)unlocked[d.tx+','+d.ty]={locked:false};
    const origins=[{x:3,y:3,room:'Cucina'},{x:40,y:28,room:'Giardino d’Inverno'},{x:40,y:3,room:'Studio Blindato'}];
    let best=null;
    for(const a of origins){const route=W.findPath(a.x,a.y,e.x,e.y,null,unlocked);if(!route)continue;
      // Movimento diagonale e posizioni frazionarie: margine conservativo di due tile.
      const min=Math.max(0,route.cost-2)/Math.SQRT2/SPEED.run;
      if(!best||min>best.min)best={...a,min};}
    if(!best||best.min<=1)return null;
    return {kind:'geometry',evidence:e,origin:best,seconds:1,expected:'impossibile'};
  }
  function startInvestigation(reason){
    if(G.phase!=='play')return;
    G.phase='investigation';G.player.interaction=null;
    const rank={'avvistamento':0,'testimone':1,'effrazione':2,'accesso digitale':3,'impronte':4,'cattura':5};
    const findings=G.evidence.slice().sort((a,b)=>(rank[a.type]??9)-(rank[b.type]??9)||a.time-b.time).slice(0,4);
    const questions=findings.map(e=>({kind:'evidence',evidence:e,expected:e.room}));
    const geo=findings.length&&geometryQuestion(findings[0]);if(geo)questions.push(geo);
    G.investigation={reason,findings,questions,index:0,answers:[],contradictions:0,finished:false};
    notice('Gli investigatori confrontano i reperti con la tua versione.');
  }
  function answer(value){
    const I=G.investigation;if(G.phase!=='investigation'||!I||I.finished)return null;
    const q=I.questions[I.index];if(!q)return null;
    const allowed=q.kind==='geometry'?['impossibile','non-escluso']:W.ROOMS.map(r=>r.name);
    if(!allowed.includes(value))return null;
    const ok=value===q.expected;if(!ok)I.contradictions++;
    const explanation=q.kind==='geometry'?
      `Anche concedendo porte aperte, il percorso più favorevole richiede almeno ${q.origin.min.toFixed(2)} s: in 1 s non basta. È un controllo di fattibilità, non una prova che fossi davvero in ${q.origin.room}.`:
      `Il reperto ${q.evidence.type} è registrato in ${q.evidence.room} a ${q.evidence.time.toFixed(1)} s. Una dichiarazione coerente non dimostra da sola l'innocenza.`;
    const result={ok,value,explanation};I.answers.push(result);I.index++;I.finished=I.index>=I.questions.length;return result;
  }
  function finishInvestigation(){const I=G.investigation;if(G.phase!=='investigation'||!I||(!I.finished&&I.questions.length))return false;
    G.won=I.reason==='escape'&&(G.training||I.contradictions===0);G.phase=G.won?'won':I.reason==='caught'?'caught':'exposed';return true;}
  return {get G(){return G},SPEED,TERMINAL,DIAMOND,EXIT,CABINETS,newGame,update,interact,context,walkable,fits,see,startInvestigation,answer,finishInvestigation};
})();
