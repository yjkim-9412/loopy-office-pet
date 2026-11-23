// Owns the clone Loopy windows: opens and closes them to match the saved list, moves them
// every frame with buddies.cjs, and answers their clicks and right-click menus.
const {ipcMain,screen,Menu}=require('electron');
const {randomUUID}=require('node:crypto');
const {PW,PH}=require('./edge.cjs');
const {createWalker}=require('./roam.cjs');
const {PATTERNS,PATTERN_LABELS,MAX_BUDDIES,spawnBuddy,stepBuddy}=require('./buddies.cjs');

const REACTIONS=['poke','pat','celebrate','wave'];

function createBuddyHost({store,catalog,masks,html,makeWindow,getMain,isHidden,announce}) {
  const live=new Map();
  let timer=null, reactions=0;
  const motion=m=>Object.hasOwn(catalog,m)?m:'idle';
  const list=()=>(store.value.buddies||[])
    .filter(b=>b&&typeof b.id==='string'&&PATTERNS.includes(b.pattern)).slice(0,MAX_BUDDIES);
  const displayOf=r=>screen.getDisplayMatching({x:Math.round(r.x),y:Math.round(r.y),width:PW,height:PH}).workArea;
  const slotOf=sender=>[...live.entries()].find(([,s])=>!s.win.isDestroyed()&&s.win.webContents===sender);

  function open(entry,index) {
    const main=getMain(), state=spawnBuddy(entry.pattern,main,displayOf(main),index,Date.now());
    const win=makeWindow(Math.round(state.x),Math.round(state.y));
    const slot={win,state,pose:'',ready:false,shown:false};
    win.setIgnoreMouseEvents(true,{forward:true});
    win.once('ready-to-show',()=>{slot.ready=true;});
    win.on('closed',()=>{if(live.get(entry.id)===slot)live.delete(entry.id);});
    win.loadFile(html);
    live.set(entry.id,slot);
  }

  function repattern(slot,pattern) {
    const cur=slot.state, area=displayOf(cur);
    const next={...spawnBuddy(pattern,{x:cur.x,y:cur.y,facing:cur.facing,motion:'idle'},area,0,Date.now()),x:cur.x,y:cur.y};
    if(pattern==='wander')next.walker=createWalker({x:cur.x,y:cur.y},area,Date.now());
    slot.state=next;
  }

  function sync() {
    const wanted=list(), ids=new Set(wanted.map(b=>b.id));
    for(const [id,slot] of live)if(!ids.has(id)){live.delete(id);if(!slot.win.isDestroyed())slot.win.destroy();}
    wanted.forEach((b,i)=>{
      const slot=live.get(b.id);
      if(!slot)open(b,i);
      else if(slot.state.pattern!==b.pattern)repattern(slot,b.pattern);
    });
  }

  function tick() {
    if(!live.size)return;
    const hide=isHidden(), main=hide?null:getMain(), mainArea=main&&displayOf(main), now=Date.now();
    const seen={};
    for(const slot of live.values()){
      if(slot.win.isDestroyed())continue;
      if(hide){if(slot.shown){slot.win.hide();slot.shown=false;}continue;}
      if(!slot.ready)continue;
      if(!slot.shown){slot.win.showInactive();slot.shown=true;slot.pose='';}
      const pattern=slot.state.pattern, index=seen[pattern]=(seen[pattern]??-1)+1;
      const area=pattern==='follow'||pattern==='copy'?mainArea:displayOf(slot.state);
      const out=stepBuddy(slot.state,{now,area,main,index});
      slot.state=out.buddy;
      const x=Math.round(out.buddy.x), y=Math.round(out.buddy.y), b=slot.win.getBounds();
      if(b.x!==x||b.y!==y)slot.win.setPosition(x,y,false);
      const pose={motion:motion(out.motion),line:'',facing:out.facing,bubble:null}, key=JSON.stringify(pose);
      if(key!==slot.pose){slot.pose=key;slot.win.webContents.send('pet:pose',pose);}
    }
  }

  function add(pattern='follow') {
    if(!PATTERNS.includes(pattern)||list().length>=MAX_BUDDIES)return false;
    store.change(d=>{d.buddies=[...(d.buddies||[]),{id:randomUUID(),pattern}];});
    sync();announce('add');
    return true;
  }
  function remove(id) {
    store.change(d=>{d.buddies=(d.buddies||[]).filter(b=>b.id!==id);});
    sync();
    if(!list().length)announce('bye');
  }
  function clear() {
    if(!list().length)return;
    store.change(d=>{d.buddies=[];});
    sync();announce('bye');
  }
  function setPattern(id,pattern) {
    if(!PATTERNS.includes(pattern))throw Error('분신 패턴을 확인해 주세요.');
    store.change(d=>{d.buddies=(d.buddies||[]).map(b=>b.id===id?{...b,pattern}:b);});
    sync();
  }
  function menuItems() {
    const n=list().length;
    return [{label:n?`분신 루피 (${n})`:'분신 루피',submenu:[
      ...PATTERNS.map(p=>({label:`${PATTERN_LABELS[p]} 분신 부르기`,enabled:n<MAX_BUDDIES,click:()=>add(p)})),
      {type:'separator'},
      {label:'분신 모두 돌려보내기',enabled:n>0,click:clear}
    ]}];
  }

  ipcMain.handle('buddy:hello',e=>{
    if(!slotOf(e.sender))throw Error('잘못된 요청입니다.');
    return {catalog,masks};
  });
  ipcMain.on('buddy:pointer',(e,inside)=>{
    const found=slotOf(e.sender);
    if(found&&typeof inside==='boolean')found[1].win.setIgnoreMouseEvents(!inside,{forward:true});
  });
  ipcMain.on('buddy:poke',e=>{
    const found=slotOf(e.sender);
    if(!found)return;
    reactions=(reactions+1)%REACTIONS.length;
    found[1].state={...found[1].state,react:{motion:REACTIONS[reactions],until:Date.now()+1600}};
  });
  ipcMain.on('buddy:menu',e=>{
    const found=slotOf(e.sender);
    if(!found)return;
    const [id,slot]=found;
    Menu.buildFromTemplate([
      ...PATTERNS.map(p=>({label:PATTERN_LABELS[p],type:'radio',checked:slot.state.pattern===p,click:()=>setPattern(id,p)})),
      {type:'separator'},
      {label:'이 분신 돌려보내기',click:()=>remove(id)}
    ]).popup({window:slot.win});
  });

  return {
    start(){sync();clearInterval(timer);timer=setInterval(tick,60);},
    stop(){clearInterval(timer);for(const slot of live.values())if(!slot.win.isDestroyed())slot.win.destroy();live.clear();},
    add,remove,clear,setPattern,menuItems
  };
}

module.exports={createBuddyHost};
