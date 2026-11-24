const canvas=document.getElementById('pet'), ctx=canvas.getContext('2d');
const bubble=document.getElementById('line'), leave=document.getElementById('leave'), images=new Map();
const PW=224, PH=202, PET_TOP=126, DAYS=[1,2,3,4,5,6,0], DAY_NAMES='일월화수목금토';
let catalog,masks,activeMask,paintedFacing=1,pose={motion:'idle',facing:1,line:'',bubble:null},step=0,timer;
let mouse=null,inside=false,overPet=false,revision=0,bubbleKey='',sizeKey='';
let press=null,dragging=false,suppressClick=false,clickTimer=null;
const pat={dir:0,x:null,turns:[]};
function pointer(){
  let over=false;
  overPet=false;
  if(mouse){
    const r=canvas.getBoundingClientRect(),x=Math.floor(mouse.x-r.x),y=Math.floor(mouse.y-r.y);
    if(activeMask&&x>=0&&x<128&&y>=0&&y<128){
      const bit=y*128+(paintedFacing<0?127-x:x);
      over=overPet=Boolean(activeMask.charCodeAt(bit>>3) & (128>>(bit%8)));
    }
    const b=bubble.getBoundingClientRect();
    if(!bubble.hidden && mouse.x>=b.left&&mouse.x<=b.right&&mouse.y>=b.top&&mouse.y<=b.bottom)over=true;
  }
  if(dragging)over=true;
  if(over!==inside){inside=over;window.office.pointer(inside);}
}
function trackPat(e){
  if(e.buttons||dragging||!overPet){pat.x=null;pat.dir=0;return;}
  if(pat.x===null){pat.x=e.clientX;return;}
  const dx=e.clientX-pat.x;
  if(Math.abs(dx)<6)return;
  const dir=Math.sign(dx), now=performance.now();
  if(pat.dir&&dir!==pat.dir)pat.turns.push(now);
  pat.dir=dir;pat.x=e.clientX;
  pat.turns=pat.turns.filter(t=>now-t<1400);
  if(pat.turns.length>=4){pat.turns=[];window.office.pat();}
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
function el(tag,props={},...children){
  const node=document.createElement(tag);
  for(const [k,v] of Object.entries(props)){
    if(k==='class')node.className=v;
    else if(k.startsWith('on'))node.addEventListener(k.slice(2),v);
    else if(v!==undefined&&v!==null&&v!==false)node.setAttribute(k,v===true?'':String(v));
  }
  for(const child of children.flat())if(child!==null&&child!==undefined&&child!==false)node.append(child);
  return node;
}
let replying=false;
async function reply(id,value){
  if(replying)return;
  replying=true;
  try{await window.office.reply({id,value});}finally{replying=false;}
}
function timesForm(spec){
  const start=el('input',{type:'time',value:spec.start,required:true});
  const end=el('input',{type:'time',value:spec.end,required:true});
  return el('form',{class:'times',onsubmit:e=>{e.preventDefault();reply(spec.id,{start:start.value,end:end.value});}},
    el('label',{},spec.labels[0],start),el('span',{class:'dash','aria-hidden':'true'},'~'),el('label',{},spec.labels[1],end),
    el('button',{class:'primary',type:'submit'},spec.submit));
}
function daysForm(spec){
  const picked=new Set(spec.selected);
  const buttons=DAYS.map(d=>el('button',{type:'button','aria-pressed':String(picked.has(d)),onclick:e=>{
    if(picked.has(d))picked.delete(d);else picked.add(d);
    e.currentTarget.setAttribute('aria-pressed',String(picked.has(d)));
  }},DAY_NAMES[d]));
  return el('form',{class:'days',onsubmit:e=>{e.preventDefault();reply(spec.id,[...picked]);}},
    el('div',{class:'day-row'},buttons),el('button',{class:'primary',type:'submit'},spec.submit));
}
function talkBubble(b){
  let focus=null;
  const parts=[el('button',{class:'close',type:'button','aria-label':'말풍선 닫기',onclick:()=>reply('close')},'×')];
  if(b.progress)parts.push(el('div',{class:'progress','aria-label':`${b.progress.total}단계 중 ${b.progress.step}단계`},
    Array.from({length:b.progress.total},(_,i)=>el('span',{class:i<b.progress.step?'on':''}))));
  parts.push(el('p',{class:'say'},b.line));
  if(b.preview?.length)parts.push(el('ul',{class:'preview'},b.preview.map(t=>el('li',{},t))));
  if(b.todos?.length)parts.push(el('ul',{class:'todos'},b.todos.map(t=>el('li',{},
    el('button',{type:'button',class:'todo','aria-pressed':String(t.done),onclick:()=>reply('toggle',t.id)},
      el('span',{class:'stamp','aria-hidden':'true'},t.done?'뤂':''),el('span',{class:'title'},t.title))))));
  if(b.input){
    const input=el('input',{type:'text',maxlength:b.input.max,placeholder:b.input.placeholder,'aria-label':b.input.placeholder,autocomplete:'off'});
    parts.push(el('form',{class:'ask',onsubmit:e=>{e.preventDefault();reply(b.input.id,input.value);}},
      input,el('button',{class:'primary',type:'submit'},b.input.submit)));
    focus=input;
  }
  if(b.times){const form=timesForm(b.times);parts.push(form);focus=form.querySelector('input');}
  if(b.days)parts.push(daysForm(b.days));
  if(b.choices?.length)parts.push(el('div',{class:'choices'},b.choices.map(c=>
    el('button',{type:'button',class:c.kind,onclick:()=>reply(c.id,c.value)},c.label))));
  bubble.replaceChildren(...parts);
  if(focus)setTimeout(()=>focus.focus(),60);
}
function renderBubble(){
  const key=JSON.stringify([pose.line,pose.bubble]);
  if(key===bubbleKey)return;
  bubbleKey=key;
  const b=pose.bubble;
  bubble.className=b?'talk':'';
  bubble.setAttribute('role',b?'group':'status');
  if(b)bubble.setAttribute('aria-label','루피 말풍선');else bubble.removeAttribute('aria-label');
  bubble.hidden=!b&&!pose.line;
  if(b)talkBubble(b);else bubble.textContent=pose.line;
  fit();
}
function fit(){
  requestAnimationFrame(()=>{
    let w=PW,h=PH;
    if(!bubble.hidden){
      const r=bubble.getBoundingClientRect();
      w=Math.max(PW,Math.ceil(r.width)+16);h=Math.max(PH,Math.ceil(r.height)+PET_TOP+10);
    }
    const key=w+'x'+h;
    if(key===sizeKey)return;
    sizeKey=key;
    window.office.resize(w,h).then(anchor=>{document.body.dataset.anchor=anchor;pointer();});
  });
}
window.office.onPose(next=>{
  const changed=next.motion!==pose.motion;
  pose=next;
  renderBubble();
  leave.textContent=pose.badge||'';
  leave.hidden=!pose.badge||!bubble.hidden;
  if(changed)step=0;
  paint(++revision);
});
window.office.petCatalog().then(value=>{
  catalog=value.catalog;
  masks=Object.fromEntries(Object.entries(value.masks).map(([id,frames])=>[id,frames.map(s=>atob(s))]));
  paint(++revision);
});
window.addEventListener('mousemove',e=>{mouse={x:e.clientX,y:e.clientY};pointer();trackPat(e);});
let moved=false;
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!overPet)return;
  press={x:e.screenX,y:e.screenY};moved=false;
  canvas.setPointerCapture(e.pointerId);
  dragging=true;document.body.classList.add('dragging');
  window.office.drag('start',press.x,press.y);
});
canvas.addEventListener('pointermove',e=>{
  if(!press)return;
  if(!moved&&Math.hypot(e.screenX-press.x,e.screenY-press.y)>4){moved=true;clearTimeout(clickTimer);clickTimer=null;}
  if(moved)window.office.drag('move',e.screenX,e.screenY);
});
function release(e){
  if(press){
    if(moved){window.office.drag('end',e.screenX,e.screenY);suppressClick=true;}
    else window.office.drag('cancel',e.screenX,e.screenY);
  }
  dragging=false;press=null;moved=false;document.body.classList.remove('dragging');
  pointer();
}
canvas.addEventListener('pointerup',release);
canvas.addEventListener('pointercancel',release);
document.documentElement.addEventListener('mouseleave',()=>{mouse=null;pointer();});
window.addEventListener('click',e=>{
  if(suppressClick){suppressClick=false;return;}
  if(e.target.closest('#line.talk')||!inside)return;
  if(e.detail>=2){clearTimeout(clickTimer);clickTimer=null;window.office.poke();return;}
  clearTimeout(clickTimer);
  clickTimer=setTimeout(()=>{clickTimer=null;window.office.open();},240);
});
window.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(inside&&!e.target.closest('#line.talk'))window.office.menu();
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&pose.bubble)reply('close');});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)paint(++revision);});
