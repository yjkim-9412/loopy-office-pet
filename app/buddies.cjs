// Clone Loopies: how each one moves and which motion it shows, one step at a time.
// follow  - lines up behind the main Loopy on the floor and trots after it
// copy    - stands in front of the main Loopy and repeats its motion half a second later
// wander  - strolls around on its own like the main Loopy's free walk
// nap     - dozes on the floor, now and then shuffling a little to a new spot
const {PW}=require('./edge.cjs');
const {floorY,createWalker,stepWalker}=require('./roam.cjs');

const PATTERNS=['follow','wander','copy','nap'];
const PATTERN_LABELS={follow:'따라다니기',wander:'제멋대로 산책',copy:'따라쟁이',nap:'낮잠꾸러기'};
const MAX_BUDDIES=5;
const WALK=0.07, RUN=0.22, RUN_FROM=120, GRAVITY=0.0025, MAX_FALL=1.6, MAX_STEP=100, COPY_DELAY=500;
const START_GAP=36, SETTLE_MS=300;           // start walking when this far behind, stop once the target rests
const TRAIL_DELAY=240, TRAIL_EASE=110, TRAIL_DRAG=30; // while the main Loopy is dragged, follow its path
const REST_MOTIONS=['idle','idle','coffee','stretch','water','wave'];

const clamp=(v,a,b)=>Math.min(Math.max(v,a),Math.max(a,b));
const bounds=area=>({min:area.x+4,max:area.x+area.width-PW-4});
const gapFor=index=>120+85*index;

function spawnBuddy(pattern,main,area,index,now,rand=Math.random) {
  const {min,max}=bounds(area), side=index%2?1:-1;
  const x=clamp(main.x+side*gapFor(index),min,max), y=main.y;
  const buddy={pattern,x,y,vy:0,facing:main.facing||1,t:now,moving:false,react:null,
    history:[{t:now,motion:main.motion||'idle'}]};
  if(pattern==='wander')buddy.walker=createWalker({x,y},area,now,rand);
  return buddy;
}

function delayedMotion(history,now) {
  let seen=history[0]?.motion||'idle';
  for(const h of history)if(h.t<=now-COPY_DELAY)seen=h.motion;
  return seen;
}

function walkToward(n,target,dt) {
  const dist=target-n.x, speed=Math.abs(dist)>RUN_FROM?RUN:WALK;
  n.x+=Math.sign(dist)*Math.min(Math.abs(dist),speed*dt);
  n.facing=Math.sign(dist)||n.facing;
  return Math.abs(target-n.x)<=1;
}

function stepBuddy(b,{now,area,main,index,rand=Math.random}) {
  const dt=clamp(now-b.t,0,MAX_STEP), floor=floorY(area), {min,max}=bounds(area);
  const n={...b,t:now,x:clamp(b.x,min,max)};
  const reacting=Boolean(b.react&&now<b.react.until);
  if(!reacting)n.react=null;
  if(b.pattern==='copy'){
    const last=b.history[b.history.length-1];
    n.history=b.history.filter(h=>now-h.t<3000);
    if(!n.history.length)n.history=[last];
    if(main.motion!==last?.motion)n.history.push({t:now,motion:main.motion});
  }
  if(b.pattern==='follow'&&main.dragging){
    const trail=[...(b.trail||[]).filter(p=>now-p.t<3000),{t:now,x:main.x,y:main.y,facing:main.facing||1}];
    let point=trail[0];
    for(const p of trail)if(p.t<=now-TRAIL_DELAY*(index+1))point=p;
    const tx=clamp(point.x-point.facing*55*(index+1),min,max), ty=clamp(point.y+14*(index+1),area.y,floor);
    const ease=Math.min(1,dt/TRAIL_EASE), nx=n.x+(tx-n.x)*ease;
    if(Math.abs(nx-n.x)>0.5)n.facing=Math.sign(nx-n.x);
    Object.assign(n,{trail,x:nx,y:n.y+(ty-n.y)*ease,vy:0,airborne:true,moving:false});
    return {buddy:n,motion:Math.hypot(tx-n.x,ty-n.y)>TRAIL_DRAG?'drag':'held',facing:n.facing};
  }
  n.trail=undefined;
  if(b.pattern==='wander'){
    const w=reacting?{...b.walker,t:now}:stepWalker(b.walker||createWalker(n,area,now,rand),now,area,rand);
    Object.assign(n,{walker:w,x:w.x,y:w.y,facing:w.facing});
    if(w.arrived||w.landed)n.rest=REST_MOTIONS[Math.floor(rand()*REST_MOTIONS.length)];
    const motion=reacting?b.react.motion:w.mode==='walk'?'walk':w.mode==='fall'?'held':(n.rest||'idle');
    return {buddy:n,motion,facing:n.facing};
  }
  if(n.y<floor-2){
    n.vy=Math.min(b.vy+GRAVITY*dt,MAX_FALL);
    n.y=Math.min(floor,b.y+n.vy*dt);
    if(n.y<floor)return {buddy:n,motion:'held',facing:n.facing};
    n.vy=0;
    if(b.airborne)Object.assign(n,{airborne:false,react:{motion:'land',until:now+900}});
    return {buddy:n,motion:b.airborne?'land':'held',facing:n.facing};
  }
  n.y=floor;
  if(reacting)return {buddy:n,motion:b.react.motion,facing:n.facing};
  if(b.pattern==='nap'){
    if(n.mode==='stroll'){
      if(walkToward(n,n.target,dt))Object.assign(n,{mode:'nap',napUntil:now+45000+rand()*45000});
      return {buddy:n,motion:n.mode==='stroll'?'walk':'doze',facing:n.facing};
    }
    n.napUntil??=now+45000+rand()*45000;
    if(now>=n.napUntil){
      const step=(60+rand()*80)*(rand()<0.5?-1:1);
      n.target=clamp(n.x+step,min,max);
      n.mode='stroll';
    }
    return {buddy:n,motion:'doze',facing:n.facing};
  }
  const side=b.pattern==='follow'?-(main.facing||1):(main.facing||1);
  const target=clamp(main.x+side*gapFor(index),min,max);
  if(Math.abs(target-(b.lastTarget??target))>0.5)n.targetMovedAt=now;
  n.lastTarget=target;
  const targetMoving=now-(n.targetMovedAt??-Infinity)<SETTLE_MS;
  if(b.moving?Math.abs(target-n.x)>1||targetMoving:Math.abs(target-n.x)>START_GAP){
    walkToward(n,target,dt);
    n.moving=Math.abs(target-n.x)>1||targetMoving;
    if(n.moving)return {buddy:n,motion:'walk',facing:n.facing};
  }
  n.moving=false;
  n.facing=main.facing||1;
  const copied=b.pattern==='copy'?delayedMotion(n.history,now):'idle';
  return {buddy:n,motion:copied==='walk'?'idle':copied,facing:n.facing};
}

module.exports={PATTERNS,PATTERN_LABELS,MAX_BUDDIES,gapFor,spawnBuddy,stepBuddy};
