const canvas=document.getElementById('pet'), ctx=canvas.getContext('2d');
const bubble=document.getElementById('line'), images=new Map();
let catalog,masks,activeMask,paintedFacing=1,pose={motion:'idle',facing:1,line:''},step=0,timer,mouse=null,inside=false,revision=0;
function pointer(){
  let over=false;
  if(mouse){
    const r=canvas.getBoundingClientRect(),x=Math.floor(mouse.x-r.x),y=Math.floor(mouse.y-r.y);
    if(activeMask&&x>=0&&x<128&&y>=0&&y<128){
      const bit=y*128+(paintedFacing<0?127-x:x);
      over=Boolean(activeMask.charCodeAt(bit>>3) & (128>>(bit%8)));
    }
    const b=bubble.getBoundingClientRect();
    if(!bubble.hidden && mouse.x>=b.left&&mouse.x<=b.right&&mouse.y>=b.top&&mouse.y<=b.bottom)over=true;
  }
  if(over!==inside){inside=over;window.office.pointer(inside);}
}
async function paint(token){
  clearTimeout(timer);
  const motion=catalog?.[pose.motion];
  if(!motion||document.hidden)return;
  if(!images.has(pose.motion)){
    const img=new Image();img.src=motion.sheet;images.set(pose.motion,img.decode().then(()=>img));
  }
  const img=await images.get(pose.motion);
  if(token!==revision||document.hidden)return;
  const key=motion.playback[step];
  ctx.clearRect(0,0,128,128);ctx.save();
  if(pose.facing<0){ctx.translate(128,0);ctx.scale(-1,1);}
  ctx.drawImage(img,key.frame*256,0,256,256,0,0,128,128);
  ctx.restore();activeMask=masks[pose.motion][key.frame];paintedFacing=pose.facing;pointer();
  step=(step+1)%motion.playback.length;
  timer=setTimeout(()=>paint(token),key.durationMs);
}
window.office.onPose(next=>{
  const changed=next.motion!==pose.motion;
  pose=next;bubble.textContent=pose.line;bubble.hidden=!pose.line;
  if(changed)step=0;
  paint(++revision);
});
window.office.petCatalog().then(value=>{
  catalog=value.catalog;
  masks=Object.fromEntries(Object.entries(value.masks).map(([id,frames])=>[id,frames.map(s=>atob(s))]));
  paint(++revision);
});
window.addEventListener('mousemove',e=>{mouse={x:e.clientX,y:e.clientY};pointer();});
document.documentElement.addEventListener('mouseleave',()=>{mouse=null;pointer();});
window.addEventListener('click',()=>{if(inside)window.office.open();});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)paint(++revision);});
