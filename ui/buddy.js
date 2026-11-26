// A clone Loopy: draws the pose the main process sends and lets clicks through except on Loopy itself.
let mouse=null,inside=false;
const sprite=createSprite(document.getElementById('pet'),pointer);
function pointer(){
  const over=Boolean(mouse)&&sprite.hit(mouse.x,mouse.y);
  if(over!==inside){inside=over;window.office.buddyPointer(inside);}
}
window.office.onPose(next=>sprite.setPose(next));
window.office.buddyHello().then(value=>sprite.load(value));
window.addEventListener('mousemove',e=>{mouse={x:e.clientX,y:e.clientY};pointer();});
document.documentElement.addEventListener('mouseleave',()=>{mouse=null;pointer();});
window.addEventListener('click',()=>{if(inside)window.office.buddyPoke();});
window.addEventListener('contextmenu',e=>{e.preventDefault();if(inside)window.office.buddyMenu();});
