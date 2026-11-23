const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {defaults,validateSettings,routine,nextWorkDay}=require('../app/routine.cjs');
const {callName,say,lineKeys}=require('../app/voice.cjs');
const {open,view,answer,visibleTodos}=require('../app/talk.cjs');
const {openStore}=require('../app/store.cjs');
const at=(h,m,d=23)=>new Date(2026,10,d,h,m);
const state=(settings={})=>({settings:{...defaults,...settings},todos:[],seen:{},snoozeUntil:0});
const ctxOf=(settings={},todos=[])=>({settings:{...defaults,...settings},todos,today:'2026-11-23',snoozed:false});

test('호칭은 받침에 맞춰 님·씨·아/야로 부름',()=>{
  assert.equal(callName('말랑','nim'),'말랑님');
  assert.equal(callName('말랑','ssi'),'말랑 씨');
  assert.equal(callName('말랑','a'),'말랑아');
  assert.equal(callName('루피','a'),'루피야');
  assert.equal(callName('  ','nim'),'');
});

test('이름이 있으면 인사 문장 앞에서만 부르고 짧은 대답은 그대로',()=>{
  const me={nickname:'말랑',call:'nim',persona:'janmang'};
  assert.equal(say('startEmpty',{persona:'janmang'}),'오늘 TODO는 작성했어뤂?');
  assert.equal(say('startEmpty',me),'말랑님, 오늘 TODO는 작성했어뤂?');
  assert.equal(say('done',me),'해냈뤂!');
  assert.equal(say('wrapLeft',{},3),'남은 TODO 3개, 퇴근 전에 정리할까뤂?');
});

test('세 가지 말투 모두 모든 문장을 루피답게 끝맺음',()=>{
  for(const persona of ['janmang','dadeong','calm'])for(const key of lineKeys){
    assert.match(say(key,{persona},2),/뤂[!?.]$/,`${persona}.${key}`);
  }
  assert.notEqual(say('startEmpty',{persona:'dadeong'}),say('startEmpty',{persona:'janmang'}));
});

test('공식 말버릇처럼 뤂을 띄어 쓰지 않고 문장 끝에 바로 붙임',()=>{
  for(const persona of ['janmang','dadeong','calm'])for(const key of lineKeys){
    const line=say(key,{persona,nickname:'말랑',call:'nim'},2);
    assert.equal(line.includes('룹'),false,`${persona}.${key}: ${line}`);
    assert.doesNotMatch(line,/\s뤂/,`${persona}.${key}: ${line}`);
    assert.doesNotMatch(line,/[다요]뤂/,`${persona}.${key}: ${line}`);
  }
});

test('루틴 말풍선은 고른 말투와 호칭을 따름',()=>{
  const s=state({nickname:'말랑',persona:'dadeong'});
  assert.equal(routine(at(9,0),s).line,say('startEmpty',s.settings));
  assert.match(routine(at(9,0),s).line,/^말랑님, /);
});

test('수다 레벨에 따라 정각 알림 빈도가 바뀜',()=>{
  const seen={'2026-11-23/start':1};
  const quiet=state({chattiness:'quiet'}),normal=state({chattiness:'normal'}),chatty=state({chattiness:'chatty'});
  for(const s of [quiet,normal,chatty])s.seen=seen;
  assert.equal(routine(at(12,1),quiet),null);
  assert.equal(routine(at(12,1),normal).id,'2026-11-23/hour-12');
  assert.equal(routine(at(13,1),normal),null);
  assert.equal(routine(at(13,1),chatty).id,'2026-11-23/hour-13');
});

test('점심시간에는 정각 알림 대신 점심 인사, 점심 뒤에는 행복한 아아 한 잔',()=>{
  const s=state({lunch:true,lunchStart:'12:00',lunchEnd:'13:00'});
  s.seen={'2026-11-23/start':1};
  assert.equal(routine(at(12,1),s).id,'2026-11-23/lunch-start');
  assert.equal(routine(at(12,30),s),null);
  const after=routine(at(13,2),s);
  assert.equal(after.id,'2026-11-23/lunch-end');
  assert.equal(after.motion,'iced');
  assert.equal(after.fallback,'coffee');
  assert.match(after.line,/아아/);
});

test('점심 뒤 아아 한마디는 날마다 바뀌고 세 말투 모두 뤂으로 끝남',()=>{
  for(const persona of ['janmang','dadeong','calm']){
    const lines=new Set([0,1,2].map(n=>say('afterLunch',{persona},n)));
    assert.ok(lines.size>=2,persona);
    for(const line of lines){
      assert.match(line,/아아/,`${persona}: ${line}`);
      assert.match(line,/뤂[!?.]$/,`${persona}: ${line}`);
    }
  }
  assert.ok(say('afterLunch',{persona:'janmang'},0).includes('아아 아니면 안 된뤂'));
  const s=state({lunch:true,lunchStart:'12:00',lunchEnd:'13:00'});
  s.seen={'2026-11-23/start':1};
  const days=new Set([23,24,25].map(d=>routine(at(13,2,d),{...s,seen:{[`2026-11-${d}/start`]:1}})?.line));
  assert.ok(days.size>=2,'날마다 다른 한마디');
});

test('아침 확인과 퇴근 정리는 루피가 대답을 받는 말풍선으로 열림',()=>{
  const s=state();
  s.todos=[{day:'2026-11-20',done:false},{day:'2026-11-21',done:false}];
  const morning=routine(at(9,0),s);
  assert.equal(morning.talk,'morning');
  assert.equal(morning.carry,2);
  assert.equal(routine(at(17,50),s).talk,'wrap');
});

test('내일로 옮긴 일은 오늘 정리 대상에서 빠짐',()=>{
  const s=state();
  s.todos=[{day:'2026-11-24',done:false}];
  assert.equal(routine(at(17,50),s).motion,'clock');
});

test('다음 근무일은 근무 요일만 셈',()=>{
  assert.equal(nextWorkDay('2026-11-27',[1,2,3,4,5]),'2026-11-30');
  assert.equal(nextWorkDay('2026-11-23',[1,3]),'2026-11-25');
});

test('새 설정값을 검사하고 예전 정각 설정은 버림',()=>{
  const ok=validateSettings({...defaults,nickname:' 말랑 ',call:'a',persona:'calm',chattiness:'quiet',hourly:true});
  assert.equal(ok.nickname,'말랑');
  assert.equal(ok.persona,'calm');
  assert.equal('hourly' in ok,false);
  assert.throws(()=>validateSettings({...defaults,nickname:'열세글자가넘는아주긴별명이에요'}));
  assert.throws(()=>validateSettings({...defaults,persona:'grumpy'}));
  assert.throws(()=>validateSettings({...defaults,lunch:true,lunchStart:'13:00',lunchEnd:'12:00'}));
});

test('예전에 정각 모션을 끈 사람은 조용히 모드로 옮기고 첫 만남 전으로 시작',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'loopy-migrate-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const legacy={start:'09:00',end:'18:00',days:[1,2,3,4,5],hourly:false,reminders:true,systemNotifications:false,edgePlay:true};
  fs.writeFileSync(path.join(dir,'office.json'),JSON.stringify({settings:legacy,todos:[],seen:{}}));
  const s=openStore(dir).value;
  assert.equal(s.settings.chattiness,'quiet');
  assert.equal(s.onboarded,false);
});

test('첫 만남: 루피가 차례로 묻고 마지막에 한 번에 저장',()=>{
  const ctx=ctxOf();
  let t=open('onboard',ctx),r;
  assert.equal(view(t,ctx).input.id,'name');
  t=answer(t,{id:'name',value:'말랑'},ctx).talk;
  assert.deepEqual(view(t,ctx).choices.map(c=>c.label),['말랑님','말랑 씨','말랑아']);
  t=answer(t,{id:'call',value:'a'},ctx).talk;
  assert.match(view(t,ctx).line,/^말랑아, /);
  assert.ok(view(t,ctx).times);
  t=answer(t,{id:'hours',value:{start:'10:00',end:'19:00'}},ctx).talk;
  assert.ok(view(t,ctx).days);
  t=answer(t,{id:'days',value:[1,2,3,4]},ctx).talk;
  t=answer(t,{id:'lunch',value:{start:'12:30',end:'13:30'}},ctx).talk;
  t=answer(t,{id:'persona',value:'calm'},ctx).talk;
  r=answer(t,{id:'chat',value:'quiet'},ctx);
  assert.equal(r.talk,null);
  const saved=r.effects.find(e=>e.type==='onboard').settings;
  assert.deepEqual(saved,{nickname:'말랑',call:'a',start:'10:00',end:'19:00',days:[1,2,3,4],
    lunch:true,lunchStart:'12:30',lunchEnd:'13:30',persona:'calm',chattiness:'quiet'});
  assert.match(r.line,/^말랑아, .*뤂[!?.]$/);
});

test('첫 만남: 잘못된 대답은 같은 질문을 다시 하고, 건너뛰면 기본값으로 시작',()=>{
  const ctx=ctxOf();
  let t=answer(open('onboard',ctx),{id:'name',value:''},ctx).talk;
  assert.ok(view(t,ctx).times,'이름 없이 넘어가면 호칭 질문을 건너뜀');
  const same=answer(t,{id:'hours',value:{start:'09:00',end:'09:00'}},ctx);
  assert.equal(same.talk.step,t.step);
  assert.match(view(same.talk,ctx).line,/다르게/);
  const skip=answer(open('onboard',ctx),{id:'skip'},ctx);
  assert.equal(skip.talk,null);
  assert.deepEqual(skip.effects,[{type:'onboard',settings:null}]);
});

test('루피를 누르면 할 수 있는 일을 루피가 알려 줌',()=>{
  const todos=[{id:'a',title:'보고서',day:'2026-11-23',done:false}];
  const ctx=ctxOf({},todos);
  const menu=open('menu',ctx);
  assert.deepEqual(view(menu,ctx).choices.map(c=>c.id),['write','list','panel','snooze','close']);
  assert.match(view(menu,ctx).choices[1].label,/1개/);
  assert.equal(answer(menu,{id:'write'},ctx).talk.kind,'write');
  assert.equal(answer(menu,{id:'list'},ctx).talk.kind,'list');
  assert.deepEqual(answer(menu,{id:'panel'},ctx).effects,[{type:'panel'}]);
  assert.deepEqual(answer(menu,{id:'snooze'},ctx).effects,[{type:'snooze'}]);
  const empty=ctxOf();
  assert.equal(view(open('menu',empty),empty).choices.some(c=>c.id==='list'),false);
  const quiet={...ctx,snoozed:true};
  assert.ok(view(open('menu',quiet),quiet).choices.some(c=>c.id==='unsnooze'));
});

test('말풍선에서 할 일을 한 줄씩 적고 끝낼 수 있음',()=>{
  const ctx=ctxOf();
  let r=answer(open('write',ctx),{id:'todo',value:'  메일 답장  '},ctx);
  assert.deepEqual(r.effects,[{type:'add',title:'메일 답장'}]);
  assert.match(view(r.talk,ctx).line,/1개/);
  assert.equal(view(r.talk,ctx).input.id,'todo');
  assert.deepEqual(answer(r.talk,{id:'todo',value:'   '},ctx).effects,[]);
  const done=answer(r.talk,{id:'finish'},ctx);
  assert.equal(done.talk,null);
  assert.match(done.line,/뤂[!?.]$/);
});

test('말풍선에서 오늘 할 일을 보고 바로 체크',()=>{
  const todos=[
    {id:'a',title:'보고서',day:'2026-11-23',done:false},
    {id:'b',title:'회의록',day:'2026-11-20',done:false},
    {id:'c',title:'내일 일',day:'2026-11-24',done:false},
    {id:'d',title:'어제 끝낸 일',day:'2026-11-20',done:true,doneDay:'2026-11-20'}
  ];
  const ctx=ctxOf({},todos);
  assert.deepEqual(visibleTodos(todos,'2026-11-23').map(t=>t.id),['a','b']);
  const list=open('list',ctx);
  assert.deepEqual(view(list,ctx).todos.map(t=>t.id),['a','b']);
  const r=answer(list,{id:'toggle',value:'a'},ctx);
  assert.deepEqual(r.effects,[{type:'toggle',id:'a'}]);
  assert.equal(r.talk.kind,'list');
  assert.equal(r.motion,'celebrate');
  assert.deepEqual(answer(list,{id:'toggle',value:'c'},ctx).effects,[]);
});

test('아침 확인 말풍선: 지금 쓰기, 어제 일 가져오기, 오늘은 패스',()=>{
  const ctx=ctxOf();
  const morning=open('morning',ctx,{carry:2});
  const v=view(morning,ctx);
  assert.equal(v.line,'오늘 TODO는 작성했어뤂?');
  assert.deepEqual(v.choices.map(c=>c.id),['write','carry','pass']);
  assert.match(v.choices[1].label,/2개/);
  assert.equal(answer(morning,{id:'write'},ctx).talk.kind,'write');
  const carry=answer(morning,{id:'carry'},ctx);
  assert.deepEqual(carry.effects,[{type:'carry'}]);
  assert.match(carry.line,/2개/);
  assert.equal(view(open('morning',ctx,{carry:0}),ctx).choices.some(c=>c.id==='carry'),false);
});

test('퇴근 정리 말풍선: 남은 일을 내일로 넘기거나 수첩 열기',()=>{
  const todos=[{id:'a',title:'회의록',day:'2026-11-23',done:false}];
  const ctx=ctxOf({},todos);
  const wrap=open('wrap',ctx);
  assert.match(view(wrap,ctx).line,/1개/);
  assert.deepEqual(view(wrap,ctx).choices.map(c=>c.id),['tomorrow','panel']);
  const r=answer(wrap,{id:'tomorrow'},ctx);
  assert.deepEqual(r.effects,[{type:'tomorrow'}]);
  assert.match(r.line,/내일/);
});

test('어느 말풍선이든 닫기를 누르면 조용히 닫힘',()=>{
  const ctx=ctxOf();
  for(const kind of ['onboard','menu','write','list','morning','wrap']){
    const r=answer(open(kind,ctx),{id:'close'},ctx);
    assert.equal(r.talk,null);
    assert.deepEqual(r.effects,[]);
  }
});

const {PW,PH,dropTarget,perchPosition,validSpot}=require('../app/edge.cjs');
test('파일 탐색기 윗변 근처에 내려놓으면 그 창 위에 앉고, 멀면 그 자리에 둠',()=>{
  const win={x:300,y:400,width:800,height:500};
  const near={x:500,y:400-195+20,width:PW,height:PH};
  assert.deepEqual(dropTarget(near,win),{offset:500+PW/2-300});
  assert.equal(dropTarget({...near,y:100},win),null);
  assert.equal(dropTarget({...near,x:1300},win),null);
  assert.equal(dropTarget(near,null),null);
});
test('창 위에 앉은 루피는 창이 움직여도 발이 윗변에 붙고 창 밖으로 나가지 않음',()=>{
  const area={x:0,y:0,width:1600,height:1000};
  const p=perchPosition({x:300,y:400,width:800,height:500},area,312);
  assert.equal(p.y+195,400);
  assert.equal(p.x+PW/2,612);
  const clamped=perchPosition({x:300,y:400,width:300,height:500},area,900);
  assert.ok(clamped.x+PW<=600);
});
test('저장한 자리가 모든 화면 밖이면 버리고 기본 자리로',()=>{
  const areas=[{x:0,y:0,width:1600,height:1000},{x:-1600,y:0,width:1600,height:900}];
  assert.deepEqual(validSpot({x:-900,y:500},areas),{x:-900,y:500});
  assert.equal(validSpot({x:5000,y:500},areas),null);
  assert.equal(validSpot(null,areas),null);
});
test('콕 찌르기·쓰다듬기·옮기기에 루피가 여러 가지로 반응',()=>{
  for(const persona of ['janmang','dadeong','calm']){
    const pokes=new Set([0,1,2].map(n=>say('poke',{persona},n)));
    assert.ok(pokes.size>=2,persona);
    for(const key of ['pat','dropped','perched','goHome'])assert.match(say(key,{persona},0),/뤂[!?.~]$/,`${persona}.${key}`);
  }
});
