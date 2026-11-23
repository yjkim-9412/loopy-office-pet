// Works out how Loopy should look while being held, from the stream of pointer positions.
// Pressing on Loopy lifts it straight into the dangling pose, and it stays there through
// ordinary carrying. Only a sustained fast swipe turns it into the side-on "being dragged"
// pose, and every change must be earned so the poses never flicker.
const FAST=0.6, FAST_MS=200;   // px/ms, and how long a swipe must stay that fast
const STOP_MS=700;             // how long the swipe must slow before Loopy dangles again
const DWELL_MS=400;            // any look stays at least this long (dizzy may cut in at once)
const TURN=0.25, TURN_MS=150, AIM_HOLD_MS=350;
const SHAKE_TURNS=4, SHAKE_MS=1000, DIZZY_MS=1200;

function createDrag(start) {
  let last={x:start.x,y:start.y,t:start.t}, vx=0, vy=0, facing=1;
  let fastSince=null, lastFast=-Infinity, turnTo=0, turnSince=0;
  let dir=0, turns=[], dizzyUntil=-Infinity, lastTarget=-Infinity;
  let state='held', since=start.t;
  return {
    update({x,y,t,target=false}) {
      const dt=Math.max(1,t-last.t), dx=x-last.x, dy=y-last.y;
      vx=vx*0.5+dx/dt*0.5;
      vy=vy*0.5+dy/dt*0.5;
      if(Math.hypot(vx,vy)>FAST){lastFast=t;fastSince??=t;} else fastSince=null;
      const want=Math.abs(vx)>TURN?Math.sign(vx):0;
      if(want&&want!==facing){
        if(turnTo!==want){turnTo=want;turnSince=t;}
        else if(t-turnSince>=TURN_MS){facing=want;turnTo=0;}
      } else turnTo=0;
      if(Math.abs(dx)>3){
        const d=Math.sign(dx);
        if(dir&&d!==dir)turns.push(t);
        dir=d;
      }
      turns=turns.filter(when=>t-when<SHAKE_MS);
      if(turns.length>=SHAKE_TURNS){dizzyUntil=t+DIZZY_MS;turns=[];}
      if(target)lastTarget=t;
      last={x,y,t};
      const swiping=state==='drag'?t-lastFast<STOP_MS:fastSince!==null&&t-fastSince>=FAST_MS;
      const wanted=t<dizzyUntil?'dizzy':t-lastTarget<AIM_HOLD_MS?'aim':swiping?'drag':'held';
      if(wanted!==state&&(wanted==='dizzy'||t-since>=DWELL_MS)){state=wanted;since=t;}
      return {state,facing};
    }
  };
}
module.exports={createDrag};
