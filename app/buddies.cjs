// Clone Loopies: how each one moves and which motion it shows, one step at a time.
// follow  - lines up behind the main Loopy on the floor and trots after it
// copy    - stands in front of the main Loopy and repeats its motion half a second later
// wander  - strolls around on its own like the main Loopy's free walk
// nap     - dozes on the floor, now and then shuffling a little to a new spot
// auto    - takes one of the four by itself to suit the time of day, and changes now and then
// While a follow or wander clone rests, it now and then plays a motion: the ones picked for that
// clone, or else ones that fit the time of day (an auto clone: every regular motion). They come out
// of a shuffled bag, so each one shows up before any repeats. Its pace sets how often (for auto, also
// how often it changes pattern).
const {GRAVITY,MAX_FALL,MAX_STEP,floorY,bounds,clamp,createWalker,stepWalker}=require('./roam.cjs');
const {POOLS}=require('./idle.cjs');

const MOVES=['follow','wander','copy','nap'];
const PATTERNS=[...MOVES,'auto'];
const PATTERN_LABELS={follow:'따라다니기',wander:'제멋대로 산책',copy:'따라쟁이',nap:'낮잠꾸러기',auto:'자동 변신'};
const MAX_BUDDIES=5;
const WALK=0.07, RUN=0.22, RUN_FROM=120, COPY_DELAY=500;
const START_GAP=36, SETTLE_MS=300;           // start walking when this far behind, stop once the target rests
const TRAIL_DELAY=240, TRAIL_EASE=110, TRAIL_DRAG=30; // while the main Loopy is dragged, follow its path
const SEC=1000, MIN=60*SEC;
// the regular motions a clone plays while resting, and the rest it never picks on its own: standing
// and walking, being held or dropped, being touched, peek (half body), and leaving or overtime
const BUDDY_MOTIONS=['coffee','iced','water','lunch','stretch','typing','write','filing','stamp','todo',
  'plan','brief','look','sit','bored','doze','wave','celebrate','shh','dizzy'];
const SPECIAL_MOTIONS=['idle','walk','grab','held','drag','fall','land','aim','perch','poke','pat','peek',
  'clock','pack','suspicious','shock','overtime','freed'];
// by pace: wait between rest motions, chance that a wander stop gets one, wait between auto changes
const PACES={
  slow:{beat:[60*SEC,120*SEC],rest:0.45,swap:[12*MIN,20*MIN]},
  normal:{beat:[25*SEC,50*SEC],rest:0.7,swap:[5*MIN,9*MIN]},
  often:{beat:[10*SEC,20*SEC],rest:0.9,swap:[2*MIN,4*MIN]}
};
const PACE_LABELS={slow:'가끔',normal:'보통',often:'자주'};
const BEAT_HOLD=9*SEC;
// how likely an auto clone takes each pattern in each part of the day (idle.cjs periodFor)
const AUTO_MIX={
  morning:{follow:3,wander:2,copy:1},
  work:{follow:2,wander:2,copy:2,nap:1},
  afternoon:{wander:2,nap:2,copy:1,follow:1},
  lunch:{nap:3,wander:1},
  wrap:{follow:3,copy:1,wander:1},
  off:{nap:3,wander:1}
};

const gapFor=index=>120+85*index;
const between=([lo,hi],rand)=>lo+(hi-lo)*rand();
// the next rest motion from a shuffled bag of the pool; a new bag never starts with the last motion
function nextMotion(n,pool,rand) {
  let bag=(n.bag||[]).filter(m=>pool.includes(m));
  if(!bag.length){
    bag=[...pool];
    for(let i=bag.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
    if(bag.length>1&&bag[0]===n.lastMotion)bag.push(bag.shift());
  }
  n.lastMotion=bag.shift();n.bag=bag;
  return n.lastMotion;
}

// a clone's saved settings, cleaned up: the rest motions it was given (none: by time of day) and its pace
function buddyPrefs(entry,allowed=BUDDY_MOTIONS) {
  const motions=Array.isArray(entry?.motions)?[...new Set(entry.motions.filter(m=>allowed.includes(m)))]:[];
  return {motions,pace:Object.hasOwn(PACES,entry?.pace)?entry.pace:'normal'};
}

function pickPattern(period,rand=Math.random) {
  const mix=Object.entries(AUTO_MIX[period]||AUTO_MIX.work);
  let roll=rand()*mix.reduce((sum,[,w])=>sum+w,0);
  for(const [pattern,w] of mix)if((roll-=w)<0)return pattern;
  return mix[mix.length-1][0];
}

// the clone takes up a saved pattern where it stands ('auto' picks one for the time of day)
function changePattern(b,saved,area,now,period='work',rand=Math.random) {
  const auto=saved==='auto', pattern=auto?pickPattern(period,rand):saved;
  const n={pattern,x:b.x,y:b.y,vy:0,facing:b.facing||1,t:now,moving:false,react:null,history:[{t:now,motion:'idle'}],
    bag:b.bag,lastMotion:b.lastMotion};
  if(pattern==='wander')n.walker=createWalker(n,area,now,rand);
  if(auto)n.auto={period,until:null};
  return n;
}

function spawnBuddy(pattern,main,area,index,now,rand=Math.random,period='work') {
  const {min,max}=bounds(area), side=index%2?1:-1;
  const at={x:clamp(main.x+side*gapFor(index),min,max),y:main.y,facing:main.facing};
  return changePattern(at,pattern,area,now,period,rand);
}

// an auto clone changes when its time is up or the part of the day changes, if it stands free
function autoSwitch(b,{now,area,main,period,rand},pace) {
  if(!b.auto||main.dragging||(b.react&&now<b.react.until)||b.y<floorY(area)-2)return b;
  const due=b.auto.period!==period||(b.auto.until!==null&&now>=b.auto.until);
  const auto={period,until:due||b.auto.until===null?now+between(pace.swap,rand):b.auto.until};
  if(!due)return auto.until===b.auto.until?b:{...b,auto};
  const next=pickPattern(period,rand);
  return next===b.pattern?{...b,auto}:{...changePattern(b,next,area,now,period,rand),auto};
}

// now and then a rest motion while the clone stands, held a few seconds
function restBeat(n,now,pool,pace,rand) {
  if(n.beat&&now<n.beat.until)return n.beat.motion;
  n.beat=null;
  n.nextBeat??=now+between(pace.beat,rand);
  if(now<n.nextBeat||!pool.length)return 'idle';
  n.beat={motion:nextMotion(n,pool,rand),until:now+BEAT_HOLD};
  n.nextBeat=n.beat.until+between(pace.beat,rand);
  return n.beat.motion;
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

// prefs: buddyPrefs of the clone's saved entry. period: idle.cjs periodFor, for auto and rest motions
function stepBuddy(buddy,{now,area,main,index,rand=Math.random,period='work',prefs}) {
  const pace=PACES[prefs?.pace]||PACES.normal;
  const pool=prefs?.motions?.length?prefs.motions:buddy.auto?BUDDY_MOTIONS:(POOLS[period]||POOLS.work);
  const b=autoSwitch(buddy,{now,area,main,period,rand},pace);
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
    Object.assign(n,{trail,x:nx,y:n.y+(ty-n.y)*ease,vy:0,airborne:true,moving:false,beat:null});
    return {buddy:n,motion:Math.hypot(tx-n.x,ty-n.y)>TRAIL_DRAG?'drag':'held',facing:n.facing};
  }
  n.trail=undefined;
  if(b.pattern==='wander'){
    const w=reacting?{...b.walker,t:now}:stepWalker(b.walker||createWalker(n,area,now,rand),now,area,rand);
    Object.assign(n,{walker:w,x:w.x,y:w.y,facing:w.facing});
    if(w.arrived||w.landed)n.rest=rand()<pace.rest?nextMotion(n,pool,rand):'idle';
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
    if(n.moving){n.beat=null;return {buddy:n,motion:'walk',facing:n.facing};}
  }
  n.moving=false;
  n.facing=main.facing||1;
  if(b.pattern==='copy'){
    const copied=delayedMotion(n.history,now);
    return {buddy:n,motion:copied==='walk'?'idle':copied,facing:n.facing};
  }
  return {buddy:n,motion:restBeat(n,now,pool,pace,rand),facing:n.facing};
}

module.exports={MOVES,PATTERNS,PATTERN_LABELS,PACES,PACE_LABELS,BUDDY_MOTIONS,SPECIAL_MOTIONS,AUTO_MIX,MAX_BUDDIES,
  gapFor,buddyPrefs,pickPattern,changePattern,spawnBuddy,stepBuddy};
