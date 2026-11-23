const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validateSettings,routine,inFocus}=require('../app/routine.cjs');
const {validateRoutine,dueRoutines,routineLine,ROUTINE_MOTIONS}=require('../app/routines.cjs');
const {buildReport}=require('../app/report.cjs');
const {open,view,answer}=require('../app/talk.cjs');
const {home,PW,PH}=require('../app/edge.cjs');
const {say,lineKeys}=require('../app/voice.cjs');

const at=(h,m,d=23)=>new Date(2026,10,d,h,m);        // 2026-11-23 is a Monday
const state=(settings={})=>({settings:{...defaults,...settings},todos:[],seen:{},snoozeUntil:0});
const motions=['stretch','water','lunch','coffee','wave','write','stamp','typing','celebrate','shh','idle'];
const ctxOf=(settings={},todos=[])=>({settings:{...defaults,...settings},todos,today:'2026-11-23',snoozed:false});
const make=r=>({id:'r1',on:true,line:'',days:[],every:2,until:'18:00',date:'',motion:'stretch',...r});

test('근무일마다 루틴은 근무 요일의 그 시각 5분 안에만 한 번',()=>{
  const r=make({title:'스트레칭',time:'15:00',repeat:'workdays'});
  const due=dueRoutines(at(15,2),[r],defaults,{},{});
  assert.deepEqual(due.map(d=>d.id),['2026-11-23/routine-r1-15:00']);
  assert.deepEqual(dueRoutines(at(15,6),[r],defaults,{},{}),[]);
  assert.deepEqual(dueRoutines(at(15,2,28),[r],defaults,{},{}),[],'토요일');
  assert.deepEqual(dueRoutines(at(15,3),[r],defaults,{[due[0].id]:1},{}),[],'이미 챙김');
  assert.deepEqual(dueRoutines(at(15,2),[{...r,on:false}],defaults,{},{}),[],'꺼 둔 루틴');
});

test('요일·매일·한 번만·몇 시간마다 반복',()=>{
  const monday=make({title:'주간 회의',time:'10:00',repeat:'days',days:[1]});
  assert.equal(dueRoutines(at(10,1),[monday],defaults,{},{}).length,1);
  assert.equal(dueRoutines(at(10,1,24),[monday],defaults,{},{}).length,0);
  const daily=make({title:'비타민',time:'08:00',repeat:'daily'});
  assert.equal(dueRoutines(at(8,0,29),[daily],defaults,{},{}).length,1,'일요일에도');
  const once=make({title:'택배 받기',time:'14:00',repeat:'once',date:'2026-11-23'});
  assert.equal(dueRoutines(at(14,0),[once],defaults,{},{}).length,1);
  assert.equal(dueRoutines(at(14,0,24),[once],defaults,{},{}).length,0);
  const water=make({title:'물 마시기',time:'10:00',repeat:'interval',every:2,until:'17:00'});
  const slots=[];
  for(let h=8;h<=18;h++)for(const d of dueRoutines(at(h,1),[water],defaults,{},{}))slots.push(d.id.slice(-5));
  assert.deepEqual(slots,['10:00','12:00','14:00','16:00']);
});

test('10분 뒤에를 누르면 10분 뒤 한 번 더 부름',()=>{
  const r=make({title:'스트레칭',time:'15:00',repeat:'workdays'});
  const later={r1:{at:+at(15,12),slot:'2026-11-23/routine-r1-15:00'}};
  const seen={'2026-11-23/routine-r1-15:00':1};
  assert.deepEqual(dueRoutines(at(15,11),[r],defaults,seen,later),[]);
  assert.deepEqual(dueRoutines(at(15,12),[r],defaults,seen,later).map(d=>d.id),['2026-11-23/routine-r1-15:00/later']);
});

test('루틴 입력값을 검사하고 정리',()=>{
  const ok=validateRoutine({title:'  물 마시기 ',time:'10:00',repeat:'interval',every:2,until:'17:00',motion:'water',line:'',on:true},motions,'2026-11-23');
  assert.deepEqual({title:ok.title,every:ok.every,motion:ok.motion},{title:'물 마시기',every:2,motion:'water'});
  const base={title:'루틴',time:'10:00',repeat:'workdays',motion:'wave',line:'',on:true};
  assert.throws(()=>validateRoutine({...base,title:''},motions,'2026-11-23'));
  assert.throws(()=>validateRoutine({...base,title:'가'.repeat(31)},motions,'2026-11-23'));
  assert.throws(()=>validateRoutine({...base,time:'25:00'},motions,'2026-11-23'));
  assert.throws(()=>validateRoutine({...base,repeat:'days',days:[]},motions,'2026-11-23'));
  assert.throws(()=>validateRoutine({...base,repeat:'interval',every:9},motions,'2026-11-23'));
  assert.throws(()=>validateRoutine({...base,motion:'dance'},motions,'2026-11-23'));
  assert.throws(()=>validateRoutine({...base,line:'가'.repeat(61)},motions,'2026-11-23'));
  assert.equal(validateRoutine({...base,repeat:'once'},motions,'2026-11-23').date,'2026-11-23');
  assert.ok(ROUTINE_MOTIONS.includes('water')&&ROUTINE_MOTIONS.includes('stretch'));
});

test('루틴 한마디는 호칭을 넣어 주고, 비우면 말투에 맞춰 루피가 고름',()=>{
  const r=make({title:'비타민',line:'{호칭}, 비타민 먹을 시간이야뤂!'});
  assert.equal(routineLine(r,{...defaults,nickname:'말랑',call:'nim'}),'말랑님, 비타민 먹을 시간이야뤂!');
  assert.equal(routineLine(r,defaults),'비타민 먹을 시간이야뤂!');
  for(const persona of ['janmang','dadeong','calm'])
    assert.match(routineLine(make({title:'물 마시기'}),{...defaults,persona}),/^물 마시기.*뤂[!?.]$/);
});

test('루틴 말풍선: 같이 했어, 10분 뒤에',()=>{
  const ctx=ctxOf();
  const t=open('routine',ctx,{routine:make({title:'스트레칭',motion:'stretch'}),slot:'s1'});
  const v=view(t,ctx);
  assert.equal(v.motion,'stretch');
  assert.deepEqual(v.choices.map(c=>c.id),['done','later']);
  assert.match(answer(t,{id:'done'},ctx).line,/뤂[!?.]$/);
  assert.deepEqual(answer(t,{id:'later'},ctx).effects,[{type:'routineLater',id:'r1',slot:'s1'}]);
});

test('퇴근 인사 말풍선에서 바로 오늘 리포트를 열 수 있음',()=>{
  const s=state();
  assert.equal(routine(at(18,1),s).talk,'leave');
  const ctx=ctxOf();
  const t=open('leave',ctx);
  assert.deepEqual(view(t,ctx).choices.map(c=>c.id),['report','bye']);
  assert.deepEqual(answer(t,{id:'report'},ctx).effects,[{type:'panel',page:'report'}]);
  assert.equal(answer(t,{id:'bye'},ctx).talk,null);
});

test('퇴근 리포트: 해낸 일, 남은 일, 이번 주 도장판',()=>{
  const todos=[
    {id:'a',title:'보고서',day:'2026-11-25',done:true,doneDay:'2026-11-26'},
    {id:'b',title:'메일',day:'2026-11-26',done:true,doneDay:'2026-11-26'},
    {id:'c',title:'회의록',day:'2026-11-26',done:false},
    {id:'d',title:'내일 일',day:'2026-11-27',done:false},
    {id:'e',title:'월요일 일',day:'2026-11-23',done:true,doneDay:'2026-11-23'}
  ];
  const r=buildReport({settings:defaults,todos,today:'2026-11-26'});
  assert.deepEqual(r.done.map(t=>t.id),['a','b']);
  assert.deepEqual(r.left.map(t=>t.id),['c']);
  assert.equal(r.stamp,true);
  assert.deepEqual(r.week.map(d=>d.label),['월','화','수','목','금']);
  assert.deepEqual(r.week.map(d=>d.stamped),[true,false,false,true,false]);
  assert.deepEqual(r.week.map(d=>d.today),[false,false,false,true,false]);
  assert.equal(r.stampedDays,2);
});

test('집중 시간에는 정각 알림을 쉬고, 시작할 때 쉿 하고 끝나면 알려 줌',()=>{
  const s=state({focus:true,focusStart:'14:00',focusEnd:'16:00'});
  s.seen={'2026-11-23/start':1};
  const start=routine(at(14,1),s);
  assert.deepEqual([start.id,start.motion],['2026-11-23/focus-start','shh']);
  assert.equal(routine(at(15,1),s),null);
  assert.equal(routine(at(16,2),s).id,'2026-11-23/focus-end');
  assert.equal(inFocus(at(15,0),s.settings),true);
  assert.equal(inFocus(at(16,30),s.settings),false);
  assert.throws(()=>validateSettings({...defaults,focus:true,focusStart:'16:00',focusEnd:'14:00'}));
});

test('마무리 알림 시점을 10·15·30분 전 중에서 고름',()=>{
  const s=state({wrapMinutes:30});
  s.todos=[{day:'2026-11-23',done:false}];
  assert.equal(routine(at(17,31),s).talk,'wrap');
  assert.equal(routine(at(17,29),state({wrapMinutes:30})),null);
  assert.equal(routine(at(17,46),state({wrapMinutes:10})),null);
  assert.throws(()=>validateSettings({...defaults,wrapMinutes:20}));
});

test('점심 시작에는 냠냠 모션',()=>{
  const s=state({lunch:true});
  s.seen={'2026-11-23/start':1};
  assert.equal(routine(at(12,1),s).motion,'lunch');
});

test('기본 자리를 네 모서리 중에서 고름',()=>{
  const area={x:0,y:0,width:1600,height:1000};
  assert.deepEqual(home(area),home(area,'br'));
  const tl=home(area,'tl'),br=home(area,'br');
  assert.ok(tl.x<100&&tl.y<100);
  assert.ok(br.x+PW>1500&&br.y+PH>900);
  assert.ok(home(area,'bl').x<100&&home(area,'tr').y<100);
  assert.throws(()=>validateSettings({...defaults,corner:'middle'}));
  assert.equal(validateSettings({...defaults,corner:'tl'}).corner,'tl');
});

test('퇴근할 때 리포트 자동으로 열기는 끌 수 있는 설정',()=>{
  assert.equal(defaults.reportAuto,false);
  assert.equal(validateSettings({...defaults,reportAuto:true}).reportAuto,true);
});

test('새 한마디도 세 가지 말투 모두 뤂으로 끝남',()=>{
  for(const key of ['routineDone','routineLater','focusStart','focusEnd','stampDone'])for(const persona of ['janmang','dadeong','calm']){
    assert.ok(lineKeys.includes(key),key);
    assert.match(say(key,{persona}),/뤂[!?.]$/,`${persona}.${key}`);
  }
});
