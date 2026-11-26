// Draws Loopy's current pose on a 128×128 canvas from the motion sheets, and tells whether a point is on
// Loopy itself (each frame has a 128×128 one-bit hit mask). Shared by the main pet (pet.js) and the clones
// (buddy.js). Masks arrive base64-encoded and are decoded per motion the first time it is shown.
function createSprite(canvas,onPainted=()=>{}){
  const ctx=canvas.getContext('2d'), images=new Map(), decoded={};
  let catalog=null,raw={},mask=null,facing=1,pose={motion:'idle',facing:1},step=0,timer,revision=0;
  const masksOf=id=>decoded[id]??=raw[id]?.map(s=>atob(s));
  async function paint(token){
    clearTimeout(timer);
    const motion=catalog?.[pose.motion];
    if(!motion||document.hidden)return;
    if(!images.has(pose.motion)){
      const img=new Image();img.src=motion.sheet;images.set(pose.motion,img.decode().then(()=>img));
    }
    const img=await images.get(pose.motion);
    if(token!==revision||document.hidden)return;
    const key=motion.playback[step%motion.playback.length];
    ctx.clearRect(0,0,128,128);ctx.save();
    if(pose.facing<0){ctx.translate(128,0);ctx.scale(-1,1);}
    ctx.drawImage(img,key.frame*256,0,256,256,0,0,128,128);
    ctx.restore();mask=masksOf(pose.motion)?.[key.frame];facing=pose.facing;onPainted();
    step=(step+1)%motion.playback.length;
    timer=setTimeout(()=>paint(token),key.durationMs);
  }
  const repaint=()=>paint(++revision);
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)repaint();});
  return {
    load(value){catalog=value.catalog;raw=value.masks;repaint();},
    setPose(next){if(next.motion!==pose.motion)step=0;pose=next;repaint();},
    // is this window point on the pixels Loopy was last painted with?
    hit(x,y){
      if(!mask)return false;
      const r=canvas.getBoundingClientRect(), px=Math.floor(x-r.x), py=Math.floor(y-r.y);
      if(px<0||px>=128||py<0||py>=128)return false;
      const bit=py*128+(facing<0?127-px:px);
      return Boolean(mask.charCodeAt(bit>>3)&(128>>(bit%8)));
    }
  };
}
