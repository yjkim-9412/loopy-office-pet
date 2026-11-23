// Loopy's free walk: fall to the floor of the screen, rest a while, stroll to a random spot, repeat.
const {PW,PH}=require('./edge.cjs');
const SPEED=0.055, GRAVITY=0.0025, MAX_FALL=1.6, MAX_STEP=100, MIN_TRIP=120;

const floorY=area=>area.y+area.height-PH-6;
const bounds=area=>({min:area.x+4,max:area.x+area.width-PW-4});
const clamp=(v,a,b)=>Math.min(Math.max(v,a),Math.max(a,b));

function createWalker(pos,area,now,rand=Math.random) {
  const {min,max}=bounds(area), floor=floorY(area), x=clamp(pos.x,min,max);
  if(pos.y<floor-2)return {mode:'fall',x,y:pos.y,vy:0,facing:1,t:now};
  return {mode:'rest',x,y:floor,vy:0,facing:1,t:now,until:now+1500+rand()*2500};
}

function pickTarget(x,area,rand) {
  const {min,max}=bounds(area);
  for(let i=0;i<6;i++){
    const target=min+rand()*(max-min);
    if(Math.abs(target-x)>=MIN_TRIP)return target;
  }
  return x-min>max-x?min:max;
}

function stepWalker(w,now,area,rand=Math.random) {
  const dt=clamp(now-w.t,0,MAX_STEP), floor=floorY(area), {min,max}=bounds(area);
  const next={...w,t:now,x:clamp(w.x,min,max),landed:false,arrived:false};
  if(w.mode==='fall'){
    next.vy=Math.min(w.vy+GRAVITY*dt,MAX_FALL);
    next.y=w.y+next.vy*dt;
    if(next.y>=floor)Object.assign(next,{y:floor,vy:0,mode:'rest',landed:true,until:now+2000+rand()*3000});
    return next;
  }
  next.y=floor;
  if(w.mode==='rest'){
    if(now<w.until)return next;
    const targetX=pickTarget(next.x,area,rand);
    return {...next,mode:'walk',targetX,facing:Math.sign(targetX-next.x)||1};
  }
  const target=clamp(w.targetX,min,max), dir=Math.sign(target-next.x);
  next.x+=dir*SPEED*dt;
  if(dir===0||Math.sign(target-next.x)!==dir)
    Object.assign(next,{x:target,mode:'rest',arrived:true,until:now+5000+rand()*13000});
  return next;
}

module.exports={SPEED,floorY,createWalker,stepWalker};
