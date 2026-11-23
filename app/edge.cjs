const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path');
const PW=224, PH=202, FEET=195;
const clamp=(v,a,b)=>Math.min(Math.max(v,a),Math.max(a,b));
function home(area) {return {x:Math.round(area.x+area.width-PW-12),y:Math.round(area.y+area.height-PH-6)};}
function edgePosition(rect,area,elapsed) {
  const left=Math.max(rect.x,area.x)+10, right=Math.min(rect.x+rect.width,area.x+area.width)-10;
  if(right-left<120 || rect.height<100) return null;
  const first=left+52, last=Math.max(first,right-52);
  const distance=Math.max(1,last-first), phase=(elapsed*.055)%(2*distance);
  const forward=phase<=distance;
  const x=first+(forward?phase:2*distance-phase)-PW/2;
  const jumpPhase=elapsed%3500;
  const jump=jumpPhase<680 ? 30*Math.sin(Math.PI*jumpPhase/680) : 0;
  const topFits=rect.y-area.y>=PH+28;
  const surface=topFits ? rect.y : Math.min(rect.y+rect.height,area.y+area.height)-8;
  return {x:Math.round(clamp(x,area.x,area.x+area.width-PW)),
    y:Math.round(clamp(surface-FEET-jump,area.y,area.y+area.height-PH)),facing:forward?1:-1};
}
function watchEdge(folder,onRect,onError) {
  const name=process.platform==='win32'?'ExplorerEdge.exe':'FinderEdge';
  let child, retry, stopped=false;
  function launch() {
    child=spawn(path.join(folder,name),[],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    const lines=createInterface({input:child.stdout});
    lines.on('line',line=>{
      try {
        const r=JSON.parse(line);
        if(!r || ['x','y','width','height'].every(k=>Number.isFinite(r[k]))) onRect(r);
      } catch {}
    });
    child.on('error',e=>onError(e.message));
    child.on('close',()=>{lines.close();onRect(null);if(!stopped)retry=setTimeout(launch,30000);});
  }
  launch();
  return ()=>{stopped=true;clearTimeout(retry);child?.kill();};
}
module.exports={PW,PH,home,edgePosition,watchEdge};
