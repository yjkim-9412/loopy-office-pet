const test=require('node:test');
const assert=require('node:assert/strict');
const {OWNER,REPO,RELEASES,LATEST_YML,FIRST_CHECK,CHECK_EVERY,updateMode,newer,latestVersion,createUpdates}=require('../app/update.cjs');
const pkg=require('../package.json');
const talk=require('../app/talk.cjs');
const {say}=require('../app/voice.cjs');
const {defaults}=require('../app/routine.cjs');

const yml=v=>`version: ${v}\nfiles:\n  - url: LoopyOffice-Setup-${v}-x64.exe\n    sha512: abc\n    size: 1\npath: LoopyOffice-Setup-${v}-x64.exe\nsha512: abc\nreleaseDate: '2026-11-24T00:00:00.000Z'\n`;
function fakeUpdater(){
  const handlers={}, calls=[];
  return {calls,handlers,
    on(name,fn){handlers[name]=fn;return this;},
    setFeedURL(o){calls.push(['feed',o]);},
    async checkForUpdates(){calls.push(['check']);},
    quitAndInstall(...a){calls.push(['install',...a]);}};
}

test('업데이트는 이 저장소의 공개 GitHub Releases에서 받고, 빌드 설정과 같은 곳을 봄',()=>{
  assert.deepEqual(pkg.build.publish,[{provider:'github',owner:OWNER,repo:REPO}]);
  assert.equal(RELEASES,'https://github.com/yjkim-9412/loopy-office-pet/releases/latest');
  assert.equal(LATEST_YML,RELEASES+'/download/latest.yml');
});

test('설치한 Windows 앱만 스스로 업데이트하고, 포터블과 맥은 알려 주기만 함',()=>{
  const base={packaged:true};
  assert.equal(updateMode({...base,platform:'win32',portable:false}),'auto');
  assert.equal(updateMode({...base,platform:'win32',portable:true}),'notice');
  assert.equal(updateMode({...base,platform:'darwin',portable:false}),'notice');
  assert.equal(updateMode({...base,platform:'linux',portable:false}),'off');
  assert.equal(updateMode({...base,packaged:false,platform:'win32'}),'off');
});

test('버전 비교와 latest.yml 읽기',()=>{
  assert.equal(newer('0.2.1','0.2.0'),true);
  assert.equal(newer('0.10.0','0.9.9'),true);
  assert.equal(newer('0.2.0','0.2.0'),false);
  assert.equal(newer('0.1.9','0.2.0'),false);
  assert.equal(latestVersion(yml('0.3.0')),'0.3.0');
  assert.equal(latestVersion("version: '1.2.3'\n"),'1.2.3');
  assert.equal(latestVersion('nothing here'),null);
});

test('자동 업데이트는 GitHub Releases에서 받고, 받은 뒤에 알려 줌',async()=>{
  const u=fakeUpdater(), ready=[];
  const updates=createUpdates({mode:'auto',version:'0.2.0',loadUpdater:()=>u,onReady:v=>ready.push(v)});
  assert.equal(u.requestHeaders,undefined,'a public repo needs no key or token');
  assert.deepEqual(u.calls[0],['feed',{provider:'github',owner:OWNER,repo:REPO}]);
  assert.equal(u.autoDownload,true);
  assert.equal(u.autoInstallOnAppQuit,true);
  assert.equal(u.allowDowngrade,false);
  assert.equal(updates.install(),false,'nothing to install before a download');
  await updates.check();
  assert.deepEqual(u.calls.at(-1),['check']);
  u.handlers['update-downloaded']({version:'0.2.1'});
  assert.deepEqual(ready,['0.2.1']);
  assert.equal(updates.ready,'0.2.1');
  assert.equal(updates.install(),true);
  assert.deepEqual(u.calls.at(-1),['install',true,true]);
});

test('알림 모드는 latest.yml만 읽고 더 새 버전일 때만 알려 줌',async()=>{
  const seen=[], asked=[];
  const make=latest=>createUpdates({mode:'notice',version:'0.2.0',
    loadUpdater:()=>{throw Error('must not load electron-updater');},
    fetchText:async(...args)=>{asked.push(args);return yml(latest);},onNotice:v=>seen.push(v)});
  await make('0.2.0').check();
  await make('0.3.0').check();
  assert.deepEqual(seen,['0.3.0']);
  assert.deepEqual(asked[0],[LATEST_YML]);
  assert.equal(make('0.3.0').install(),false);
});

test('업데이트 확인이 실패해도 앱은 조용히 넘어감',async()=>{
  const logs=[];
  const updates=createUpdates({mode:'notice',version:'0.2.0',fetchText:async()=>{throw Error('offline');},onNotice:()=>assert.fail(),log:m=>logs.push(m)});
  await updates.check();
  assert.match(logs[0],/offline/);
});

test('시작 1분 뒤 처음 확인하고 그 뒤로 6시간마다 확인함, 꺼져 있으면 예약도 안 함',()=>{
  const timers=[];
  const later=(_fn,ms)=>timers.push(['later',ms]), every=(_fn,ms)=>timers.push(['every',ms]);
  createUpdates({mode:'notice',version:'0.2.0',fetchText:async()=>''}).start(later,every);
  assert.deepEqual(timers,[['later',FIRST_CHECK],['every',CHECK_EVERY]]);
  timers.length=0;
  createUpdates({mode:'off',version:'0.2.0'}).start(later,every);
  assert.deepEqual(timers,[]);
});

test('업데이트 말풍선: 지금 바꾸기 또는 나중에',()=>{
  const ctx={settings:{...defaults},todos:[],today:'2026-11-24',snoozed:false};
  const t=talk.open('update',ctx,{version:'0.2.1'});
  const v=talk.view(t,ctx);
  assert.equal(v.line,say('updateReady',ctx.settings,'0.2.1'));
  assert.match(v.line,/0\.2\.1/);
  assert.deepEqual(v.choices.map(c=>c.id),['install','later']);
  assert.deepEqual(talk.answer(t,{id:'install'},ctx).effects,[{type:'installUpdate'}]);
  const later=talk.answer(t,{id:'later'},ctx);
  assert.deepEqual([later.talk,later.effects,later.line],[null,[],say('updateLater',ctx.settings)]);
});

test('업데이트 대사도 세 말투 모두 뤂으로 끝나고 버전을 말함',()=>{
  for(const persona of ['janmang','dadeong','calm']){
    for(const key of ['updateReady','updateNotice'])assert.match(say(key,{persona},'0.3.0'),/0\.3\.0.*뤂[!?.]$/,`${persona}.${key}`);
    for(const key of ['updateInstall','updateLater'])assert.match(say(key,{persona}),/뤂[!?.]$/,`${persona}.${key}`);
  }
});
