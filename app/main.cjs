const {app,BrowserWindow,Menu,Tray,Notification,ipcMain,screen,powerMonitor,nativeImage,dialog,net,shell}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {openStore}=require('./store.cjs');
const {loginOptions,needsDefaultLogin}=require('./autostart.cjs');
const {validateSettings,shift,dayKey,nextWorkDay,routine,inFocus}=require('./routine.cjs');
const {validateRoutine,dueRoutines,slotsFor,ROUTINE_MOTIONS}=require('./routines.cjs');
const {visibleTodos,pendingTodos,carriedTodos,plannedFor}=require('./todos.cjs');
const {say,boredLine,longWorkLine,idleLine}=require('./voice.cjs');
const {createBoredom,gapFor}=require('./boredom.cjs');
const {createIdle,periodFor}=require('./idle.cjs');
const {RELEASES,updateMode,createUpdates}=require('./update.cjs');
const talk=require('./talk.cjs');
const {overtimeEvent,overtimeActive,recordOvertime}=require('./overtime.cjs');
const {createDrag}=require('./drag.cjs');
const {createWalker,stepWalker,floorY}=require('./roam.cjs');
const {PW,PH,home,edgePosition,dropTarget,perchPosition,validSpot,watchEdge}=require('./edge.cjs');
const {createBuddyHost}=require('./buddy-host.cjs');
const {MAX_BUDDIES}=require('./buddies.cjs');
const {RAISE_MS,MENU_MS,layerPlan}=require('./layer.cjs');
const catalog=require('../assets/motions.json'), masks=require('../assets/hit.json');
const idle=createIdle({has:m=>Object.hasOwn(catalog,m)&&!catalog[m].partial});
const root=path.resolve(__dirname,'..');
const file=(...p)=>path.join(root,...p);
let store,pet,panel,tray,stopWatcher,edgeTimer,clockTimer,pulseTimer;
let edge=null,edgeSince=0,hidden=false,locked=false,quitting=false,face=1,typing=false,compact=null,homeLater=false;
let dragging=null,dragTimer,edgeMuted='',walking=false,patAt=0,pokes=0,walker=null,roamTimer,boredom,workApp=null,dropLine=false;
let current={motion:'idle',line:'',until:0,talk:null,bubble:null}, idleMotion='idle', lastShown=0;
let latestSprite='',autoError='',buddies=null,updates=null,updateNotice=null;
let edgeWindow=null,menuAt=0,layerTimer,layerTalk=false;
const liveNotifications=new Set();
const webPreferences={preload:file('app','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true};
function secure(w) {
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  w.webContents.on('will-navigate',e=>e.preventDefault());
  w.removeMenu();
}
function today() {const now=new Date();return shift(now,store.value.settings)?.key??dayKey(now);}
function uiArt(){
  try{return fs.readdirSync(file('assets','ui')).filter(n=>n.endsWith('.png')).map(n=>n.slice(0,-4));}
  catch{return [];}
}
function snapshot(){
  const login=app.isPackaged ? app.getLoginItemSettings(loginOptions()).openAtLogin : false;
  return {...store.value,today:today(),login,packaged:app.isPackaged,autoError,art:uiArt(),maxBuddies:MAX_BUDDIES,
    routineMotions:ROUTINE_MOTIONS.filter(m=>Object.hasOwn(catalog,m)),
    buddyMotions:buddies?.motions()||[],buddyNow:buddies?.current()||{},
    motions:Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.label]))};
}
function publish(){if(panel&&!panel.isDestroyed())panel.webContents.send('office:state',snapshot());}
function options(page,width,height) {
  return {width,height,show:false,webPreferences,icon:file('assets','brand','icon.png'),title:page};
}
function showPanel(page){
  if(!panel || panel.isDestroyed()){
    panel=new BrowserWindow({...options('루피의 업무 수첩',510,680),minWidth:390,minHeight:490,backgroundColor:'#fff8f3'});
    secure(panel);
    panel.on('closed',()=>{panel=null;});
    panel.once('ready-to-show',()=>{panel.show();panel.focus();});
    panel.loadFile(file('ui','panel.html'));
  } else {if(panel.isMinimized())panel.restore();panel.show();panel.focus();publish();}
  if(typeof page==='string'){
    const send=()=>{if(panel&&!panel.isDestroyed())panel.webContents.send('office:page',page);};
    if(panel.webContents.isLoading())panel.webContents.once('did-finish-load',send);else send();
  }
}
function place(x,y){
  if(compact){compact=null;pet.setBounds({x,y,width:PW,height:PH},false);return;}
  const b=pet.getBounds();
  if(b.x!==x||b.y!==y)pet.setPosition(x,y,false);
}
const workAreas=()=>screen.getAllDisplays().map(d=>d.workArea);
const edgeKey=r=>r?[r.x,r.y,r.width,r.height].join(','):'';
const motionFor=(id,fallback)=>Object.hasOwn(catalog,id)?id:fallback;
function homePosition(){
  if(!pet||pet.isDestroyed())return;
  const pos=validSpot(store.value.spot,workAreas())||home(screen.getDisplayMatching(compact||pet.getBounds()).workArea,store.value.settings.corner);
  place(pos.x,pos.y);
}
function rememberSpot(p){
  const spot=store.value.spot;
  if(!spot||spot.x!==p.x||spot.y!==p.y)store.change(d=>{d.spot={x:p.x,y:p.y};});
}
function fitPet(width,height){
  const w=Math.min(Math.max(Math.round(width),PW),380), h=Math.min(Math.max(Math.round(height),PH),620);
  if(w===PW&&h===PH){
    if(compact){pet.setBounds(compact,false);compact=null;}
    return 'right';
  }
  const base=compact||pet.getBounds();
  const area=screen.getDisplayMatching(base).workArea;
  const right=base.x+base.width;
  const anchor=right-w>=area.x?'right':'left';
  compact=base;
  pet.setBounds({x:anchor==='right'?right-w:base.x,y:Math.max(area.y,base.y+base.height-h),width:w,height:h},false);
  return anchor;
}
function busy(){return Date.now()<current.until;}
const QUIET_MS=60000, SNOOZE_MS=3600000, SEEN_MS=8*86400000;
const snoozed=(now=Date.now())=>+now<store.value.snoozeUntil;
// Loopy said something within the last minute
const spokeLately=now=>+now-lastShown<QUIET_MS;
// a notice that hasn't been said yet, with nothing else said in the last minute
const fresh=(id,now)=>!store.value.seen[id]&&!spokeLately(now);
// Marks a notice as said (marks older than 8 days are dropped, so an ignored update notice comes
// back about weekly) and starts the one-minute quiet gap. `also` changes the store in the same write.
function claim(id,now,also){
  store.change(d=>{
    for(const [k,t] of Object.entries(d.seen))if(+now-t>SEEN_MS)delete d.seen[k];
    d.seen[id]=+now;also?.(d);
  });
  lastShown=+now;
}
function setSnooze(on){store.change(d=>{d.snoozeUntil=on?Date.now()+SNOOZE_MS:0;});}
function setTyping(on){
  if(typing===on||!pet||pet.isDestroyed())return;
  typing=on;
  pet.setFocusable(on);
  if(on)pet.focus();
}
function renderPet(){
  if(!pet||pet.isDestroyed()||hidden||locked)return;
  const on=busy();
  if(!on&&current.talk){current={...current,talk:null,bubble:null};setTyping(false);}
  if(!on&&homeLater&&!edge){homeLater=false;homePosition();}
  const stroll=walker?.mode==='walk'?'walk':walker?.mode==='fall'?motionFor('fall',motionFor('held','celebrate'))
    :walker?.mode==='rest'&&idleMotion==='idle'&&Object.hasOwn(catalog,'sit')?'sit'
    :store.value.perch&&following()&&!walking&&Object.hasOwn(catalog,'perch')?'perch':null;
  const payload={motion:on?current.motion:(walking?'walk':stroll||idleMotion),line:on?current.line:'',
    facing:on?(current.facing??1):(walker?.mode==='walk'?walker.facing:face),bubble:on?current.bubble:null,
    badge:talk.leftBadge(new Date(),store.value.settings)};
  const key=JSON.stringify(payload);
  if(latestSprite!==key){pet.webContents.send('pet:pose',payload);latestSprite=key;}
  const talking=Boolean(current.talk&&on);
  if(talking!==layerTalk){layerTalk=talking;applyLayer();}
}
// tick: the periodic call, the only one that re-raises Loopy over other programs' topmost windows.
function applyLayer(tick=false){
  if(!pet||pet.isDestroyed()||hidden||locked)return;
  const plan=layerPlan({onTop:store.value.settings.onTop,talking:layerTalk,platform:process.platform,
    riding:following()?edgeWindow:null,menuOpen:Date.now()-menuAt<MENU_MS,tick});
  for(const w of [pet,...(buddies?.windows()||[])]){
    if(w.isDestroyed()||!w.isVisible())continue;
    if(plan.raise||w.isAlwaysOnTop()!==plan.top){if(plan.top)w.setAlwaysOnTop(true,plan.level);else w.setAlwaysOnTop(false);}
    if(plan.above)try{w.moveAbove(plan.above);}catch{}
  }
}
function trackMenu(menu){
  menu.on('menu-will-show',()=>{menuAt=Date.now();});
  menu.on('menu-will-close',()=>{menuAt=0;});
  return menu;
}
function topWindow(title,x,y){
  const plan=layerPlan({onTop:store.value.settings.onTop,platform:process.platform});
  const w=new BrowserWindow({...options(title,PW,PH),x,y,frame:false,transparent:true,alwaysOnTop:plan.top,
    focusable:false,skipTaskbar:true,hasShadow:false,resizable:false,backgroundColor:'#00000000'});
  if(plan.top)w.setAlwaysOnTop(true,plan.level);
  secure(w);return w;
}
function hold(ttl){clearTimeout(pulseTimer);pulseTimer=setTimeout(renderPet,ttl+20);}
function act(motion,line='',ttl=9500){
  current={motion,line,until:Date.now()+ttl,talk:null,bubble:null};
  setTyping(false);hold(ttl);renderPet();
}
function talkContext(){
  const s=store.value;
  return {settings:s.settings,todos:s.todos,today:today(),snoozed:snoozed(),now:Date.now()};
}
function showTalk(next,motion){
  if(hidden)setHidden(false);
  const bubble=talk.view(next,talkContext());
  const typed=Boolean(bubble.input||bubble.times);
  const ttl=typed||bubble.days?180000:60000;
  current={motion:motionFor(motion||bubble.motion,bubble.fallback||'idle'),line:bubble.line,until:Date.now()+ttl,talk:next,bubble};
  setTyping(typed);hold(ttl);renderPet();
}
function summon(){
  if(current.talk&&busy())return;
  showTalk(talk.open(store.value.onboarded?'menu':'onboard',talkContext()));
}
function addTodo(value,day=today()){
  if(typeof value!=='string'||!value.trim()||value.trim().length>160)throw Error('할 일을 1~160자로 입력해 주세요.');
  store.change(d=>d.todos.push({id:randomUUID(),title:value.trim(),day,done:false,doneDay:null}));
}
const tomorrow=()=>nextWorkDay(today(),store.value.settings.days);
function routinesToday(now){
  const key=dayKey(now);
  return (store.value.routines||[]).filter(r=>slotsFor(r,store.value.settings,now,key).length).length;
}
function toggleTodo(id){
  let done;
  store.change(d=>{
    const task=d.todos.find(t=>t.id===id);
    if(!task)throw Error('할 일을 찾을 수 없습니다.');
    done=task.done=!task.done;task.doneDay=done?today():null;
  });
  return done;
}
function carryTodos(){
  const day=today();let n=0;
  store.change(d=>{for(const t of carriedTodos(d.todos,day)){t.day=day;n++;}});
  return n;
}
function deferTodos(){
  const day=today(),next=nextWorkDay(day,store.value.settings.days);
  store.change(d=>{for(const t of pendingTodos(d.todos,day)){t.day=next;t.focus=false;}});
}
// what each effect from talk.answer() does
const EFFECTS={
  onboard:e=>store.change(d=>{
    if(e.settings)d.settings=validateSettings({...d.settings,...e.settings});
    d.onboarded=true;
  }),
  add:e=>addTodo(e.title),
  toggle:e=>toggleTodo(e.id),
  carry:()=>carryTodos(),
  tomorrow:()=>deferTodos(),
  addTomorrow:e=>addTodo(e.title,tomorrow()),
  panel:e=>showPanel(e.page),
  routineLater:e=>store.change(d=>{d.routineLater={...(d.routineLater||{}),[e.id]:{at:Date.now()+600000,slot:e.slot}};}),
  snooze:()=>setSnooze(true),
  unsnooze:()=>setSnooze(false),
  overtime:e=>store.change(d=>{d.overtime=recordOvertime(new Date(),d,e.answer);}),
  installUpdate:()=>setTimeout(()=>updates?.install(),400)
};
function applyEffect(effect){if(Object.hasOwn(EFFECTS,effect.type))EFFECTS[effect.type](effect);}
function following(){
  const s=store.value;
  return Boolean(edge&&!hidden&&!locked&&!dragging&&edgeKey(edge)!==edgeMuted&&(s.settings.edgePlay||s.perch));
}
function setEdge(r,id=null){
  if(r && process.platform==='win32')r=screen.screenToDipRect(null,r);
  const win=r&&id?id:null, moved=edgeKey(r)!==edgeKey(edge);
  if(!moved&&win===edgeWindow)return;
  edgeWindow=win;
  if(moved){
    if(!edge && r)edgeSince=Date.now();
    edge=r;
    if(edgeMuted&&edgeKey(r)!==edgeMuted)edgeMuted='';
    followEdge();
  }
  applyLayer();
}
function followEdge(){
  clearInterval(edgeTimer);
  walking=following()&&store.value.settings.edgePlay;
  if(following()){
    const step=()=>{
      if(!following()||!pet||pet.isDestroyed())return;
      if(Date.now()<current.until)return;
      const area=screen.getDisplayMatching(edge).workArea;
      if(walking){
        const p=edgePosition(edge,area,Date.now()-edgeSince);
        if(!p)return;
        face=p.facing;place(p.x,p.y);
      } else {
        const p=perchPosition(edge,area,store.value.perch.offset);
        face=1;place(p.x,p.y);rememberSpot(p);
      }
      renderPet();
    };
    step();
    edgeTimer=setInterval(step,60);
  } else if(!dragging){face=1;if(busy())homeLater=true;else homePosition();}
  renderPet();
}
const needsWatcher=()=>Boolean(store.value.settings.edgePlay||store.value.settings.workAware||store.value.perch||dragging);
function syncWatcher(){
  if(stopWatcher){stopWatcher();stopWatcher=null;}
  setEdge(null);workApp=null;
  if(!locked && !hidden && needsWatcher() && ['win32','darwin'].includes(process.platform)){
    const dir=app.isPackaged?path.join(process.resourcesPath,'native'):file('build','native');
    let active=true;
    const aware=store.value.settings.workAware;
    const stop=watchEdge(dir,(r,id)=>{if(active)setEdge(r,id);},e=>console.warn('Window edge:',e),
      {apps:aware,titles:aware,ride:store.value.settings.edgePlay,onApp:app=>{if(active)workApp=aware?app:null;}});
    stopWatcher=()=>{active=false;stop();};
  }
}
function keepWatcher(){if(Boolean(stopWatcher)!==needsWatcher())syncWatcher();}
function roaming(){
  const s=store.value;
  return Boolean(s.settings.roam&&pet&&!pet.isDestroyed()&&!hidden&&!locked&&!dragging&&!busy()
    &&!s.perch&&!following());
}
function roamTick(){
  if(!roaming()){if(walker){walker=null;renderPet();}return;}
  const b=pet.getBounds(), area=screen.getDisplayMatching(b).workArea, now=Date.now();
  if(!walker)walker=createWalker({x:b.x,y:b.y},area,now);
  walker=stepWalker(walker,now,area);
  const x=Math.round(walker.x), y=Math.round(walker.y);
  if(x!==b.x||y!==b.y)place(x,y);
  if(walker.landed){
    rememberSpot({x,y});
    act(motionFor('land','celebrate'),dropLine?say('dropped',store.value.settings):'',dropLine?3000:1200);
    dropLine=false;return;
  }
  if(walker.arrived){
    rememberSpot({x,y});
    const s=store.value.settings;
    if(s.chattiness==='chatty'&&s.reminders&&!inFocus(new Date(),s)&&Math.random()<0.25){act(motionFor('look',idleMotion),say('roam',s,Math.floor(Math.random()*3)),3500);return;}
  }
  renderPet();
}
function setRoam(on){
  if(store.value.settings.roam===on)return;
  store.change(d=>{d.settings.roam=on;});
  if(!on&&pet&&!pet.isDestroyed()){const b=pet.getBounds();walker=null;rememberSpot({x:b.x,y:b.y});}
  act('wave',say(on?'roamOn':'roamOff',store.value.settings),3500);
  updateMenu();publish();
}
function setLeaveBadge(on){
  if(store.value.settings.leaveBadge===on)return;
  store.change(d=>{d.settings.leaveBadge=on;});
  renderPet();updateMenu();publish();
}
function setOnTop(on){
  if(store.value.settings.onTop===on)return;
  store.change(d=>{d.settings.onTop=on;});
  applyLayer();
  act('wave',say(on?'topOn':'topOff',store.value.settings),3500);
  updateMenu();publish();
}
function goHome(){
  store.change(d=>{d.spot=null;d.perch=null;});
  edgeMuted='';homePosition();keepWatcher();
  act('wave',say('goHome',store.value.settings),3500);
}
// drag.cjs states: each is also the motion id, with a fallback when the sheet is missing
const DRAG_FALLBACK={held:'celebrate',drag:'walk',dizzy:'clock',aim:'wave'};
// the drag states Loopy says something on (the 'grab' line comes from moveDrag)
const DRAG_TALK=['dizzy','aim'];
function sayDrag(state,now){dragging.said=state;dragging.line=say(state,store.value.settings);dragging.lineUntil=now+1500;}
function showDrag(state,facing){
  const now=Date.now();
  if(!DRAG_TALK.includes(state))dragging.said='';
  else if(dragging.said!==state)sayDrag(state,now);
  const line=now<(dragging.lineUntil??0)?dragging.line:'';
  const next={motion:motionFor(state,DRAG_FALLBACK[state]),line,facing:state==='drag'?facing:1};
  if(next.motion!==current.motion||next.line!==current.line||next.facing!==current.facing){
    current={...current,...next};renderPet();
  }
}
function liftOff(){
  if(compact){pet.setBounds(compact,false);compact=null;}
  clearInterval(edgeTimer);walking=false;
  current={motion:'',line:'',until:Date.now()+600000,talk:null,bubble:null,facing:1};
  setTyping(false);clearTimeout(pulseTimer);
  dragging.lifted=true;
  showDrag('held',1);
  clearInterval(dragTimer);
  dragTimer=setInterval(()=>{if(dragging?.lifted)trackDrag(dragging.x,dragging.y);},120);
}
function moveDrag(x,y){
  if(!dragging.lifted)liftOff();
  if(!dragging.moved){
    dragging.moved=true;
    sayDrag('grab',Date.now());
    if(!stopWatcher)syncWatcher();
  }
  place(Math.round(x+dragging.dx),Math.round(y+dragging.dy));
  trackDrag(x,y);
}
function cancelDrag(){
  const wasLifted=dragging.lifted;
  dragging=null;clearInterval(dragTimer);
  if(!wasLifted)return;
  current={motion:'',line:'',until:0,talk:null,bubble:null};
  if(following())followEdge();
  renderPet();
}
function trackDrag(x,y){
  dragging.x=x;dragging.y=y;
  const target=dropTarget(pet.getBounds(),edge);
  const {state,facing}=dragging.state.update({x,y,t:Date.now(),target:Boolean(target)});
  showDrag(state,facing);
}
function startDrag(x,y){
  const b=compact||pet.getBounds();
  dragging={dx:b.x-x,dy:b.y-y,x,y,state:createDrag({x,y,t:Date.now()}),lifted:false,moved:false};
  // Pressing lifts Loopy at once, unless a talk bubble is open: then it waits for a real drag.
  if(!(current.talk&&busy()))liftOff();
}
function endDrag(){
  dragging=null;clearInterval(dragTimer);
  const b=pet.getBounds(), area=screen.getDisplayMatching(b).workArea;
  let x=Math.min(Math.max(b.x,area.x),area.x+area.width-PW), y=Math.min(Math.max(b.y,area.y),area.y+area.height-PH);
  const target=dropTarget({x,y},edge);
  if(target){({x,y}=perchPosition(edge,area,target.offset));edgeMuted='';}
  else edgeMuted=edgeKey(edge);
  store.change(d=>{d.perch=target;d.spot={x,y};});
  place(x,y);
  if(!target&&store.value.settings.roam&&y<floorY(area)-2){
    current={motion:'',line:'',until:0,talk:null,bubble:null};dropLine=true;renderPet();
  } else act(motionFor('land','celebrate'),say(target?'perched':'dropped',store.value.settings),3500);
  keepWatcher();
  followEdge();
}
function noticeOvertime(now,talking){
  if(talking)return false;
  const ot=overtimeEvent(now,store.value,powerMonitor.getSystemIdleTime());
  if(!ot||!fresh(ot.id,now))return false;
  claim(ot.id,now);
  showTalk(talk.open(ot.talk,talkContext(),ot),motionFor(ot.motion,'clock'));
  return true;
}
// Every 15 s (and on wake or a settings save): pick the idle look, then say the first notice in the
// chain that has something to say.
function checkRoutine(){
  if(locked||hidden)return;
  const now=new Date(), state=store.value, work=shift(now,state.settings);
  idleMotion=!work||work.left<=0?'doze':work.left<=30?'clock':'idle';
  if(work && state.settings.chattiness!=='quiet' && now.getMinutes()<5 && work.left>15 && work.minutes>=30)
    idleMotion=['coffee','filing','typing','write'][now.getHours()%4];
  if(overtimeActive(now,state))idleMotion=motionFor('overtime',motionFor('typing','idle'));
  const talking=current.talk&&busy();
  noticeRoutine(now,talking)||noticeRoutines(now)||noticeOvertime(now,talking)||noticeUpdate(now)||noticeWork(now,work)||noticeIdle(now,work);
  renderPet();
  publish();
}
// the workday's own beats from routine.cjs: arriving, lunch, focus time, wrap-up, leaving, the hourly line
function noticeRoutine(now,talking){
  const state=store.value, event=routine(now,state);
  if(!event||talking||!fresh(event.id,now))return false;
  claim(event.id,now);
  if(event.talk)showTalk(talk.open(event.talk,talkContext(),{carry:event.carry,routines:routinesToday(now)}),motionFor(event.talk,event.motion));
  else act(motionFor(event.motion,event.fallback||'idle'),event.line,12000);
  if(event.id.endsWith('/leave')&&state.settings.reportAuto)showPanel('report');
  if(event.notify&&event.line&&state.settings.systemNotifications&&Notification.isSupported()){
    const n=new Notification({title:'잔망루피',body:event.line,icon:file('assets','brand','icon.png')});
    liveNotifications.add(n);
    n.on('click',()=>{liveNotifications.delete(n);showPanel();});
    n.on('close',()=>liveNotifications.delete(n));
    n.show();
  }
  return true;
}
function noticeRoutines(now){
  const state=store.value, s=state.settings;
  if(busy()||snoozed(now)||inFocus(now,s)||spokeLately(now))return false;
  const [due]=dueRoutines(now,state.routines||[],s,state.seen,state.routineLater||{});
  if(!due)return false;
  claim(due.id,now,d=>{if(due.later&&d.routineLater)delete d.routineLater[due.routine.id];});
  showTalk(talk.open('routine',talkContext(),{routine:due.routine,slot:due.id}),motionFor(due.routine.motion,'wave'));
  return true;
}
function noticeWork(now,work){
  const s=store.value.settings;
  const app=work&&s.workAware&&s.reminders&&!inFocus(now,s)&&!snoozed(now)?workApp:null;
  if(busy())return false;
  const said=boredom.update(app,+now,gapFor(s.chattiness));
  if(!said)return false;
  store.change(d=>{d.boredom=boredom.memory();});
  lastShown=+now;
  if(said.kind==='long')act(motionFor('stretch','coffee'),longWorkLine(said.app,s,said.minutes),8000);
  else act(motionFor('bored','clock'),boredLine(said.app,s,Math.floor(Math.random()*3)),8000);
  return true;
}
// A downloaded update asks whether to restart now; a version this build can't install is only mentioned.
// Each is said once (seen entries expire after 8 days, so an ignored one comes back about weekly).
function noticeUpdate(now){
  const n=updateNotice, state=store.value;
  if(!n||busy()||!state.onboarded||snoozed(now))return false;
  const id='update/'+n.kind+'/'+n.version;
  if(!fresh(id,now))return false;
  claim(id,now);
  if(n.kind==='ready')showTalk(talk.open('update',talkContext(),{version:n.version}));
  else act('wave',say('updateNotice',state.settings,n.version),9000);
  return true;
}
function startUpdates(){
  const mode=updateMode({packaged:app.isPackaged,platform:process.platform,
    portable:Boolean(process.env.PORTABLE_EXECUTABLE_FILE)});
  updates=createUpdates({mode,version:app.getVersion(),
    loadUpdater:()=>require('electron-updater').autoUpdater,
    fetchText:async url=>{
      const r=await net.fetch(url,{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      return r.text();
    },
    onReady:version=>{updateNotice={kind:'ready',version};updateMenu();},
    onNotice:version=>{updateNotice={kind:'notice',version};updateMenu();},
    log:msg=>console.warn(msg)});
  updates.start();
}
// Last in the chain: with nothing else to say, Loopy plays a small motion on its own and sometimes talks.
// It stays still while busy, walking, perched, off shift, in overtime or focus time, or within a minute
// of anything else it said.
function noticeIdle(now,work){
  const state=store.value, s=state.settings;
  const free=state.onboarded&&!busy()&&!dragging&&!walking&&walker?.mode!=='walk'&&walker?.mode!=='fall'
    &&!(state.perch&&following())&&!inFocus(now,s)&&!overtimeActive(now,state)&&!spokeLately(now);
  const beat=idle.tick(+now,{work:free?work:null,settings:s,canTalk:s.reminders&&!snoozed(now)});
  if(!beat)return false;
  if(beat.line){
    lastShown=+now;
    act(motionFor(beat.motion,'idle'),beat.left?say('leftNow',s,beat.left):idleLine(beat.motion,s,beat.n,beat.named),5500);
  } else idleMotion=motionFor(beat.motion,idleMotion);
  return true;
}
function setHidden(value){
  hidden=value;
  if(hidden)pet.hide();else{pet.showInactive();latestSprite='';}
  syncWatcher();renderPet();updateMenu();applyLayer();
}
// snooze or wake the reminders from a menu, and have Loopy say so
function snooze(on=true){
  setSnooze(on);
  act('wave',say(on?'snooze':'unsnooze',store.value.settings));publish();
}
function updateMenu(){
  tray.setContextMenu(trackMenu(Menu.buildFromTemplate([
    ...(updateNotice?.kind==='ready'?[{label:'새 버전으로 다시 시작',click:()=>updates.install()},{type:'separator'}]:[]),
    ...(updateNotice?.kind==='notice'?[{label:`새 버전 ${updateNotice.version} 받으러 가기`,click:()=>shell.openExternal(RELEASES)},{type:'separator'}]:[]),
    {label:'루피 부르기',click:summon},{label:'업무 수첩 열기',click:()=>showPanel()},{label:'오늘 리포트 보기',click:()=>showPanel('report')},
    {label:hidden?'루피 보여주기':'루피 숨기기',click:()=>setHidden(!hidden)},
    {label:'산책하기',type:'checkbox',checked:Boolean(store?.value.settings.roam),click:item=>setRoam(item.checked)},
    {label:'퇴근 시간 항상 보기',type:'checkbox',checked:Boolean(store?.value.settings.leaveBadge),click:item=>setLeaveBadge(item.checked)},
    {label:'다른 창 위에 항상 띄우기',type:'checkbox',checked:Boolean(store?.value.settings.onTop),click:item=>setOnTop(item.checked)},
    {label:'원래 자리로 보내기',click:goHome},...(buddies?buddies.menuItems():[]),
    {label:'알림 한 시간 쉬기',click:()=>snooze()},{type:'separator'},{label:'종료',click:()=>app.quit()}])));
}
function connect(){
  const handle=(name,role,fn)=>ipcMain.handle(name,(e,...args)=>{
    if(e.sender!==role()?.webContents)throw Error('잘못된 요청입니다.');
    return fn(...args);
  });
  handle('pet:hello',()=>pet,()=>{
    latestSprite='';renderPet();
    return {catalog,masks};
  });
  ipcMain.on('pet:pointer',(e,inside)=>{
    if(e.sender===pet?.webContents&&typeof inside==='boolean')pet.setIgnoreMouseEvents(!inside,{forward:true});
  });
  const fromPet=e=>e.sender===pet?.webContents;
  ipcMain.on('pet:open',e=>{if(fromPet(e)&&!dragging)summon();});
  ipcMain.on('pet:drag',(e,phase,x,y)=>{
    if(!fromPet(e)||!Number.isFinite(x)||!Number.isFinite(y))return;
    if(phase==='start'&&!dragging)startDrag(x,y);
    else if(phase==='move'&&dragging)moveDrag(x,y);
    else if(phase==='end'&&dragging)(dragging.moved?endDrag():cancelDrag());
    else if(phase==='cancel'&&dragging)cancelDrag();
  });
  ipcMain.on('pet:poke',e=>{
    if(!fromPet(e)||dragging||(current.talk&&busy()))return;
    pokes=(pokes+1)%3;
    act(motionFor('poke','celebrate'),say('poke',store.value.settings,pokes),3500);
  });
  ipcMain.on('pet:pat',e=>{
    if(!fromPet(e)||dragging||busy()||Date.now()-patAt<15000)return;
    patAt=Date.now();
    act(motionFor('pat','wave'),say('pat',store.value.settings),3500);
  });
  ipcMain.on('pet:menu',e=>{
    if(!fromPet(e)||dragging)return;
    const s=store.value, quiet=snoozed(), left=pendingTodos(s.todos,today()).length;
    trackMenu(Menu.buildFromTemplate([
      {label:'루피랑 이야기하기',click:summon},
      {label:'할 일 적기',click:()=>showTalk(talk.open('write',talkContext()))},
      {label:left?`오늘 할 일 ${left}개 보기`:'오늘 할 일 없음',enabled:left>0,click:()=>showTalk(talk.open('list',talkContext()))},
      {label:'업무 수첩 열기',click:showPanel},
      {type:'separator'},
      {label:s.settings.roam?'산책 그만하기':'산책하기',click:()=>setRoam(!store.value.settings.roam)},
      {label:s.settings.leaveBadge?'퇴근 시간 숨기기':'퇴근 시간 항상 보기',click:()=>setLeaveBadge(!store.value.settings.leaveBadge)},
      {label:s.settings.onTop?'다른 창 위에 그만 띄우기':'다른 창 위에 항상 띄우기',click:()=>setOnTop(!store.value.settings.onTop)},
      ...(buddies?buddies.menuItems():[]),
      {label:'원래 자리로 보내기',enabled:Boolean(s.spot||s.perch),click:goHome},
      {label:quiet?'다시 말 걸어 줘':'한 시간 조용히',click:()=>snooze(!quiet)},
      {label:'루피 숨기기',click:()=>setHidden(true)}
    ])).popup({window:pet});
  });
  handle('pet:size',()=>pet,(w,h)=>{
    if(!Number.isFinite(w)||!Number.isFinite(h))throw Error('창 크기를 확인해 주세요.');
    return fitPet(w,h);
  });
  handle('pet:reply',()=>pet,msg=>{
    if(!msg||typeof msg.id!=='string')throw Error('대답을 확인해 주세요.');
    if(!current.talk||!busy())return false;
    const result=talk.answer(current.talk,msg,talkContext());
    for(const effect of result.effects)applyEffect(effect);
    if(result.talk)showTalk(result.talk,result.motion);
    else if(result.line)act(motionFor(result.motion||'wave',result.fallback||'wave'),result.line);
    else act(idleMotion,'',0);
    publish();
    return true;
  });
  handle('office:read',()=>panel,snapshot);
  handle('office:command',()=>panel,(action,value)=>{
    const s=()=>store.value.settings;
    if(action==='add'){
      addTodo(value);
      act('write',say('added',s()));
    } else if(action==='toggle'){
      const done=toggleTodo(value);
      const list=visibleTodos(store.value.todos,today());
      const full=done&&list.length>0&&list.every(t=>t.done);
      act(full?motionFor('stamp','celebrate'):done?'celebrate':'todo',say(full?'stampDone':done?'done':'undone',s()));
    } else if(action==='focus'){
      store.change(d=>{
        const task=d.todos.find(t=>t.id===value);
        if(!task)throw Error('할 일을 찾을 수 없습니다.');
        const on=!task.focus;
        for(const t of d.todos)t.focus=false;
        task.focus=on;
      });
    } else if(action==='carry'){
      const n=carryTodos();
      if(n)act('write',say('carried',s(),n));
    } else if(action==='keepCarry'){
      store.change(d=>{d.carryDismissed=today();});
    } else if(action==='settings'){
      const settings=validateSettings(value);
      const changed=settings.edgePlay!==store.value.settings.edgePlay||settings.workAware!==store.value.settings.workAware;
      const roam=settings.roam, moved=settings.corner!==store.value.settings.corner, layered=settings.onTop!==store.value.settings.onTop;
      store.change(d=>{d.settings={...settings,roam:d.settings.roam};});
      if(moved){store.change(d=>{d.spot=null;d.perch=null;});homePosition();}
      if(changed)syncWatcher();
      if(layered){applyLayer();updateMenu();}
      setRoam(roam);
      checkRoutine();
    } else if(action==='buddyAdd'){
      if(!buddies.add(value??'follow'))throw Error('분신은 다섯 마리까지 부를 수 있어요.');
    } else if(action==='buddyRemove'){
      buddies.remove(value);
    } else if(action==='buddyPattern'){
      buddies.setPattern(value?.id,value?.pattern);
    } else if(action==='buddyBehavior'){
      buddies.setBehavior(value?.id,value);
    } else if(action==='routineAdd'){
      const r=validateRoutine(value,Object.keys(catalog),today());
      store.change(d=>{d.routines=[...(d.routines||[]),{...r,id:randomUUID()}];});
    } else if(action==='routineToggle'||action==='routineDelete'){
      store.change(d=>{
        const r=(d.routines||[]).find(x=>x.id===value);
        if(!r)throw Error('루틴을 찾을 수 없습니다.');
        if(action==='routineToggle')r.on=!r.on;else d.routines=d.routines.filter(x=>x!==r);
      });
    } else if(action==='routineTry'){
      const r=(store.value.routines||[]).find(x=>x.id===value);
      if(!r)throw Error('루틴을 찾을 수 없습니다.');
      showTalk(talk.open('routine',talkContext(),{routine:r,slot:'try-'+Date.now()}),motionFor(r.motion,'wave'));
    } else if(action==='addTomorrow'){
      addTodo(value,tomorrow());
      act('write',say('planMore',s(),plannedFor(store.value.todos,tomorrow()).length));
    } else if(action==='tomorrow'){
      const left=pendingTodos(store.value.todos,today()).length;
      if(left){deferTodos();act('wave',say('tomorrow',s(),left));}
    } else if(action==='intro'){
      showTalk(talk.open('onboard',talkContext()));
    } else if(action==='login'){
      if(!app.isPackaged)throw Error('자동 실행은 설치된 앱에서 설정할 수 있어요.');
      if(typeof value!=='boolean')throw Error('자동 실행 값을 확인해 주세요.');
      app.setLoginItemSettings({openAtLogin:value,...loginOptions()});
      autoError=app.getLoginItemSettings(loginOptions()).openAtLogin!==value?'시스템의 로그인 항목 설정을 확인해 주세요.':'';
    } else if(action==='snooze')snooze();
    else if(action==='unsnooze')setSnooze(false);
    else if(action==='preview' && Object.hasOwn(catalog,value)){
      if(hidden)setHidden(false);
      act(value,'',6000);
    } else throw Error('알 수 없는 동작입니다.');
    publish();return snapshot();
  });
}
function init(){
  app.setAppUserModelId('com.kyjground.loopyoffice');
  store=openStore(app.getPath('userData'));
  if(needsDefaultLogin(store.value,app.isPackaged)){
    try{app.setLoginItemSettings({openAtLogin:true,...loginOptions()});}catch(err){console.warn('Login item:',err.message);}
    store.change(d=>{d.loginDefaultApplied=true;});
  }
  boredom=createBoredom(store.value.boredom||{});
  const area=screen.getPrimaryDisplay().workArea;
  const start=validSpot(store.value.spot,workAreas())||home(area,store.value.settings.corner);
  pet=topWindow('잔망루피',start.x,start.y);
  pet.setIgnoreMouseEvents(true,{forward:true});connect();
  pet.once('ready-to-show',()=>{
    pet.showInactive();renderPet();
    if(!store.value.onboarded)setTimeout(()=>showTalk(talk.open('onboard',talkContext())),1500);
  });
  pet.loadFile(file('ui','pet.html'));
  buddies=createBuddyHost({store,catalog,masks,html:file('ui','buddy.html'),
    makeWindow:(x,y)=>topWindow('분신 루피',x,y),trackMenu,
    getMain:()=>{
      const b=compact||pet.getBounds();let p={};
      try{p=JSON.parse(latestSprite||'{}');}catch{}
      return {x:b.x,y:b.y,facing:p.facing||1,motion:p.motion||'idle',dragging:Boolean(dragging?.lifted)};
    },
    isHidden:()=>hidden||locked||!pet||pet.isDestroyed(),
    getPeriod:()=>{const now=new Date(),s=store.value.settings;return periodFor(now,shift(now,s),s);},
    onChange:publish,
    announce:kind=>{act('celebrate',say(kind==='add'?'buddyAdd':'buddyBye',store.value.settings),3500);publish();updateMenu();}
  });
  buddies.start();
  const icon=nativeImage.createFromPath(file('assets','brand','tray.png')).resize({width:20,height:20});
  tray=new Tray(icon);tray.setToolTip('루피의 업무 수첩');tray.on('double-click',showPanel);updateMenu();
  screen.on('display-removed',homePosition);screen.on('display-metrics-changed',homePosition);
  const sleep=()=>{locked=true;setTyping(false);syncWatcher();pet.hide();};
  const wake=()=>{locked=false;if(!hidden)pet.showInactive();syncWatcher();checkRoutine();applyLayer();};
  powerMonitor.on('suspend',sleep);powerMonitor.on('lock-screen',sleep);
  powerMonitor.on('resume',wake);powerMonitor.on('unlock-screen',wake);
  syncWatcher();checkRoutine();clockTimer=setInterval(checkRoutine,15000);roamTimer=setInterval(roamTick,60);
  layerTimer=setInterval(()=>applyLayer(true),RAISE_MS);
  startUpdates();
}
if(!app.requestSingleInstanceLock()){app.quit();} else {
  app.on('second-instance',()=>{if(store)showPanel();});
  app.whenReady().then(init).catch(err=>{dialog.showErrorBox('루피를 시작하지 못했어요',err.message);app.quit();});
  app.on('activate',()=>{if(store&&!quitting)showPanel();});
  app.on('window-all-closed',()=>{});
  app.on('before-quit',()=>{quitting=true;buddies?.stop();stopWatcher?.();clearInterval(edgeTimer);clearInterval(dragTimer);clearInterval(roamTimer);clearInterval(clockTimer);clearInterval(layerTimer);clearTimeout(pulseTimer);});
}
