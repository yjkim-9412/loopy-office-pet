// Decides when Loopy grumbles about a work app: only after it has been in front for a while,
// never more often than the chattiness gap allows, at most hourly per app, and the last time
// survives restarts so opening the pet again never triggers an instant remark.
const MIN=60000, DWELL=3*MIN, PER_APP=60*MIN, LONG=50*MIN, LONG_GAP=10*MIN;
const WORK_APPS=['excel','sheets','docs','slides','word','powerpoint','mail'];

function gapFor(chattiness) {
  return chattiness==='quiet'?Infinity:chattiness==='normal'?45*MIN:20*MIN;
}

function createBoredom(memory={}) {
  let app=null, since=0, longSaid=false;
  let lastAt=Number.isFinite(memory.lastAt)?memory.lastAt:-Infinity;
  const byApp={...(memory.byApp||{})};
  return {
    update(next,now,gap) {
      if(next!==app){app=next;since=now;longSaid=false;return null;}
      if(!app||!Number.isFinite(gap))return null;
      const elapsed=now-since;
      if(elapsed>=LONG&&!longSaid&&now-lastAt>=LONG_GAP){
        longSaid=true;lastAt=now;
        return {kind:'long',app,minutes:Math.floor(elapsed/MIN)};
      }
      if(elapsed>=DWELL&&now-lastAt>=gap&&now-(byApp[app]??-Infinity)>=PER_APP){
        lastAt=now;byApp[app]=now;
        return {kind:'bored',app};
      }
      return null;
    },
    memory(){return {lastAt:Number.isFinite(lastAt)?lastAt:null,byApp:{...byApp}};}
  };
}

module.exports={WORK_APPS,gapFor,createBoredom};
