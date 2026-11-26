const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path');
const {WORK_APPS}=require('./boredom.cjs');
const PW=224, PH=202, FEET=195;
const clamp=(v,a,b)=>Math.min(Math.max(v,a),Math.max(a,b));
function home(area,corner='br') {
  const left=corner==='tl'||corner==='bl', top=corner==='tl'||corner==='tr';
  return {x:Math.round(left?area.x+12:area.x+area.width-PW-12),y:Math.round(top?area.y+6:area.y+area.height-PH-6)};
}
function edgePosition(rect,area,elapsed) {
  const left=Math.max(rect.x,area.x)+10, right=Math.min(rect.x+rect.width,area.x+area.width)-10;
  if(right-left<120 || rect.height<100) return null;
  const first=left+52, last=Math.max(first,right-52);
  const distance=Math.max(1,last-first), phase=(elapsed*.055)%(2*distance);
  const forward=phase<=distance;
  const x=first+(forward?phase:2*distance-phase)-PW/2;
  const jumpPhase=elapsed%3500;
  const jump=jumpPhase<680 ? 30*Math.sin(Math.PI*jumpPhase/680) : 0;
  const surface=surfaceOf(rect,area);
  return {x:Math.round(clamp(x,area.x,area.x+area.width-PW)),
    y:Math.round(clamp(surface-FEET-jump,area.y,area.y+area.height-PH)),facing:forward?1:-1};
}
function surfaceOf(rect,area) {
  return rect.y-area.y>=PH+28 ? rect.y : Math.min(rect.y+rect.height,area.y+area.height)-8;
}
function dropTarget(bounds,rect) {
  if(!rect)return null;
  const center=bounds.x+PW/2, feet=bounds.y+FEET;
  if(center<rect.x+20||center>rect.x+rect.width-20||Math.abs(feet-rect.y)>48)return null;
  return {offset:Math.round(center-rect.x)};
}
function perchPosition(rect,area,offset) {
  const x=clamp(rect.x+offset-PW/2,Math.max(rect.x,area.x),Math.min(rect.x+rect.width,area.x+area.width)-PW);
  return {x:Math.round(x),y:Math.round(clamp(surfaceOf(rect,area)-FEET,area.y,area.y+area.height-PH))};
}
function validSpot(spot,areas) {
  if(!spot||!Number.isFinite(spot.x)||!Number.isFinite(spot.y))return null;
  const inside=areas.some(a=>spot.x>=a.x&&spot.y>=a.y&&spot.x+PW<=a.x+a.width&&spot.y+PH<=a.y+a.height);
  return inside?{x:spot.x,y:spot.y}:null;
}
const isRect=r=>Boolean(r)&&['x','y','width','height'].every(k=>Number.isFinite(r[k]));
const rectOf=r=>isRect(r)?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
// `window` is the ridden window's handle (HWND on Windows, window number on macOS), only so Loopy can
// stand just above that window when it isn't kept on top.
function parseHelperLine(line) {
  let value;
  try{value=JSON.parse(line);}catch{return undefined;}
  if(value===null)return {edge:null,app:null,window:null};
  if(typeof value!=='object')return undefined;
  if('edge' in value){
    const edge=rectOf(value.edge);
    return {edge,app:WORK_APPS.includes(value.app)?value.app:null,
      window:edge&&Number.isSafeInteger(value.window)&&value.window>0?value.window:null};
  }
  return isRect(value)?{edge:rectOf(value),app:null,window:null}:undefined;
}
// ride: also report Office and Hangul document windows, not only Explorer / Finder.
function watchEdge(folder,onRect,onError,{apps=false,titles=false,ride=false,onApp=()=>{}}={}) {
  const name=process.platform==='win32'?'ExplorerEdge.exe':'FinderEdge';
  let child, retry, stopped=false;
  function launch() {
    const args=[...(apps?['--apps']:[]),...(titles?['--titles']:[]),...(ride?['--ride']:[])];
    child=spawn(path.join(folder,name),args,{windowsHide:true,stdio:['ignore','pipe','ignore']});
    const lines=createInterface({input:child.stdout});
    lines.on('line',line=>{
      const read=parseHelperLine(line);
      if(read){onRect(read.edge,read.window);onApp(read.app);}
    });
    child.on('error',e=>onError(e.message));
    child.on('close',()=>{lines.close();onRect(null);onApp(null);if(!stopped)retry=setTimeout(launch,30000);});
  }
  launch();
  return ()=>{stopped=true;clearTimeout(retry);child?.kill();};
}
module.exports={PW,PH,clamp,home,edgePosition,dropTarget,perchPosition,validSpot,parseHelperLine,watchEdge};
