const {app,BrowserWindow,Menu,Tray,Notification,ipcMain,screen,powerMonitor,nativeImage,dialog}=require('electron');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {openStore}=require('./store.cjs');
const {validateSettings,shift,dayKey,routine}=require('./routine.cjs');
const {PW,PH,home,edgePosition,watchEdge}=require('./edge.cjs');
const catalog=require('../assets/motions.json');
const root=path.resolve(__dirname,'..');
const file=(...p)=>path.join(root,...p);
let store,pet,panel,tray,stopWatcher,edgeTimer,clockTimer,pulseTimer;
let edge=null,edgeSince=0,hidden=false,locked=false,quitting=false,face=1;
let current={motion:'idle',line:'',until:0}, idleMotion='idle', lastShown=0;
let latestSprite='',autoError='';
const liveNotifications=new Set();
const webPreferences={preload:file('app','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true};
function secure(w) {
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  w.webContents.on('will-navigate',e=>e.preventDefault());
  w.removeMenu();
}
function today() {const now=new Date();return shift(now,store.value.settings)?.key??dayKey(now);}
function snapshot(){
  const login=app.isPackaged ? app.getLoginItemSettings().openAtLogin : false;
  return {...store.value,today:today(),login,packaged:app.isPackaged,autoError,
    motions:Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.label]))};
}
function publish(){if(panel&&!panel.isDestroyed())panel.webContents.send('office:state',snapshot());}
function options(page,width,height) {
  return {width,height,show:false,webPreferences,icon:file('assets','brand','icon.png'),title:page};
}
function showPanel(){
  if(!panel || panel.isDestroyed()){
    panel=new BrowserWindow({...options('루피의 업무 수첩',510,680),minWidth:390,minHeight:490,backgroundColor:'#fffaf5'});
    secure(panel);
    panel.on('closed',()=>{panel=null;});
    panel.once('ready-to-show',()=>{panel.show();panel.focus();});
    panel.loadFile(file('ui','panel.html'));
  } else {if(panel.isMinimized())panel.restore();panel.show();panel.focus();publish();}
}
function homePosition(){
  if(!pet||pet.isDestroyed())return;
  const pos=home(screen.getDisplayMatching(pet.getBounds()).workArea);
  pet.setPosition(pos.x,pos.y,false);
}
function renderPet(){
  if(!pet||pet.isDestroyed()||hidden||locked)return;
  const busy=Date.now()<current.until;
  const payload={motion:busy?current.motion:(edge?'walk':idleMotion),line:busy?current.line:'',facing:busy?1:face};
  const key=JSON.stringify(payload);
  if(latestSprite!==key){pet.webContents.send('pet:pose',payload);latestSprite=key;}
}
function act(motion,line='',ttl=9500){
  current={motion,line,until:Date.now()+ttl};
  clearTimeout(pulseTimer);
  renderPet();
  pulseTimer=setTimeout(renderPet,ttl+20);
}
function setEdge(r){
  if(edge===null && r===null)return;
  if(r && process.platform==='win32')r=screen.screenToDipRect(null,r);
  if(!edge && r)edgeSince=Date.now();
  edge=r;
  clearInterval(edgeTimer);
  if(edge && !hidden && !locked){
    const step=()=>{
      if(!edge||!pet||pet.isDestroyed())return;
      const area=screen.getDisplayMatching(edge).workArea;
      const now=Date.now(), paused=now<current.until;
      if(paused)return;
      const p=edgePosition(edge,area,now-edgeSince);
      if(!p){setEdge(null);return;}
      face=p.facing;
      pet.setPosition(p.x,p.y,false);
      renderPet();
    };
    step();
    if(edge)edgeTimer=setInterval(step,60);
  } else {face=1;homePosition();}
  renderPet();
}
function syncWatcher(){
  if(stopWatcher){stopWatcher();stopWatcher=null;}
  setEdge(null);
  if(!locked && !hidden && store.value.settings.edgePlay && ['win32','darwin'].includes(process.platform)){
    const dir=app.isPackaged?path.join(process.resourcesPath,'native'):file('build','native');
    let active=true;
    const stop=watchEdge(dir,r=>{if(active)setEdge(r);},e=>console.warn('Window edge:',e));
    stopWatcher=()=>{active=false;stop();};
  }
}
function checkRoutine(){
  if(locked||hidden)return;
  const now=new Date(), state=store.value, work=shift(now,state.settings);
  idleMotion=!work||work.left<=0?'doze':work.left<=30?'clock':'idle';
  if(work && state.settings.hourly && now.getMinutes()<5 && work.left>15 && work.minutes>=30)
    idleMotion=['coffee','filing','typing','write'][now.getHours()%4];
  const event=routine(now,state);
  if(event && !state.seen[event.id] && +now-lastShown>60000){
    store.change(d=>{
      for(const [id,time] of Object.entries(d.seen))if(+now-time>8*86400000)delete d.seen[id];
      d.seen[event.id]=+now;
    });
    lastShown=+now;
    act(event.motion,event.line,12000);
    if(event.notify&&event.line&&state.settings.systemNotifications&&Notification.isSupported()){
      const n=new Notification({title:'잔망루피',body:event.line,icon:file('assets','brand','icon.png')});
      liveNotifications.add(n);
      n.on('click',()=>{liveNotifications.delete(n);showPanel();});
      n.on('close',()=>liveNotifications.delete(n));
      n.show();
    }
  }
  renderPet();
  publish();
}
function setHidden(value){
  hidden=value;
  if(hidden)pet.hide();else{pet.showInactive();latestSprite='';}
  syncWatcher();renderPet();updateMenu();
}
function snooze(){
  store.change(d=>{d.snoozeUntil=Date.now()+3600000;});
  act('wave','한 시간 뒤에 다시 말 걸게 룹!');publish();
}
function updateMenu(){
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'업무 수첩 열기',click:showPanel},{label:hidden?'루피 보여주기':'루피 숨기기',click:()=>setHidden(!hidden)},
    {label:'알림 한 시간 쉬기',click:snooze},{type:'separator'},{label:'종료',click:()=>app.quit()}]));
}
function connect(){
  const handle=(name,role,fn)=>ipcMain.handle(name,(e,...args)=>{
    if(e.sender!==role()?.webContents)throw Error('잘못된 요청입니다.');
    return fn(...args);
  });
  handle('pet:hello',()=>pet,()=>{
    latestSprite='';renderPet();
    return {catalog,masks:require('../assets/hit.json')};
  });
  ipcMain.on('pet:pointer',(e,inside)=>{
    if(e.sender===pet?.webContents&&typeof inside==='boolean')pet.setIgnoreMouseEvents(!inside,{forward:true});
  });
  ipcMain.on('pet:open',e=>{if(e.sender===pet?.webContents)showPanel();});
  handle('office:read',()=>panel,snapshot);
  handle('office:command',()=>panel,(action,value)=>{
    if(action==='add'){
      if(typeof value!=='string'||!value.trim()||value.trim().length>160)throw Error('할 일을 1~160자로 입력해 주세요.');
      store.change(d=>d.todos.push({id:randomUUID(),title:value.trim(),day:today(),done:false,doneDay:null}));
      act('write','수첩에 적어 뒀어 룹!');
    } else if(action==='toggle'){
      let done;
      store.change(d=>{
        const task=d.todos.find(t=>t.id===value);
        if(!task)throw Error('할 일을 찾을 수 없습니다.');
        done=task.done=!task.done;task.doneDay=done?today():null;
      });
      act(done?'celebrate':'todo',done?'해냈어 룹!':'다시 할 일에 넣었어 룹!');
    } else if(action==='settings'){
      const settings=validateSettings(value);
      const changed=settings.edgePlay!==store.value.settings.edgePlay;
      store.change(d=>{d.settings=settings;});
      if(changed)syncWatcher();
      checkRoutine();
    } else if(action==='login'){
      if(!app.isPackaged)throw Error('자동 실행은 설치된 앱에서 설정할 수 있어요.');
      if(typeof value!=='boolean')throw Error('자동 실행 값을 확인해 주세요.');
      app.setLoginItemSettings({openAtLogin:value});
      autoError=app.getLoginItemSettings().openAtLogin!==value?'시스템의 로그인 항목 설정을 확인해 주세요.':'';
    } else if(action==='snooze')snooze();
    else if(action==='unsnooze')store.change(d=>{d.snoozeUntil=0;});
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
  const area=screen.getPrimaryDisplay().workArea;
  pet=new BrowserWindow({...options('잔망루피',PW,PH),...home(area),frame:false,transparent:true,alwaysOnTop:true,
    focusable:false,skipTaskbar:true,hasShadow:false,resizable:false,backgroundColor:'#00000000'});
  secure(pet);pet.setIgnoreMouseEvents(true,{forward:true});connect();
  pet.once('ready-to-show',()=>{pet.showInactive();renderPet();});
  pet.loadFile(file('ui','pet.html'));
  const icon=nativeImage.createFromPath(file('assets','brand','tray.png')).resize({width:20,height:20});
  tray=new Tray(icon);tray.setToolTip('루피의 업무 수첩');tray.on('double-click',showPanel);updateMenu();
  screen.on('display-removed',homePosition);screen.on('display-metrics-changed',homePosition);
  const sleep=()=>{locked=true;syncWatcher();pet.hide();};
  const wake=()=>{locked=false;if(!hidden)pet.showInactive();syncWatcher();checkRoutine();};
  powerMonitor.on('suspend',sleep);powerMonitor.on('lock-screen',sleep);
  powerMonitor.on('resume',wake);powerMonitor.on('unlock-screen',wake);
  syncWatcher();checkRoutine();clockTimer=setInterval(checkRoutine,15000);
}
if(!app.requestSingleInstanceLock()){app.quit();} else {
  app.on('second-instance',()=>{if(store)showPanel();});
  app.whenReady().then(init).catch(err=>{dialog.showErrorBox('루피를 시작하지 못했어요',err.message);app.quit();});
  app.on('activate',()=>{if(store&&!quitting)showPanel();});
  app.on('window-all-closed',()=>{});
  app.on('before-quit',()=>{quitting=true;stopWatcher?.();clearInterval(edgeTimer);clearInterval(clockTimer);clearTimeout(pulseTimer);});
}
