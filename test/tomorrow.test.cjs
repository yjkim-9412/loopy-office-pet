const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,validateSettings,routine}=require('../app/routine.cjs');
const {briefLine}=require('../app/plan.cjs');
const {open,view,answer}=require('../app/talk.cjs');
const {say,lineKeys}=require('../app/voice.cjs');

const at=(h,m,d=23)=>new Date(2026,10,d,h,m);           // Monday 2026-11-23
const state=(settings={},extra={})=>({settings:{...defaults,...settings},todos:[],seen:{},snoozeUntil:0,...extra});
const ctxOf=(todos=[],settings={})=>({settings:{...defaults,...settings},todos,today:'2026-11-23',snoozed:false});
const todo=(id,title,day='2026-11-23',done=false,extra={})=>({id,title,day,done,doneDay:done?day:null,...extra});

test('퇴근 정리 말풍선 다음에 내일 할 일을 물어봄',()=>{
  const s=state({},{todos:[todo('a','보고서')]});
  assert.equal(routine(at(17,50),s).talk,'wrap','먼저 남은 일 정리');
  s.seen={'2026-11-23/wrap':1};
  const ask=routine(at(17,51),s);
  assert.deepEqual([ask.id,ask.talk],['2026-11-23/plan','plan']);
  s.seen['2026-11-23/plan']=1;
  assert.equal(routine(at(17,52),s),null);
  assert.equal(routine(at(18,1),s).talk,'leave','퇴근 시각에는 퇴근 인사');
});

test('내일 할 일 묻기를 끄면 묻지 않음',()=>{
  const s=state({planTomorrow:false});
  s.seen={'2026-11-23/wrap':1};
  assert.equal(routine(at(17,51),s),null);
  assert.equal(defaults.planTomorrow,true);
  assert.throws(()=>validateSettings({...defaults,planTomorrow:'yes'}));
});

test('말풍선에서 내일 할 일을 한 줄씩 적음',()=>{
  const ctx=ctxOf();
  const t=open('plan',ctx);
  assert.equal(view(t,ctx).input.id,'todo');
  assert.match(view(t,ctx).line,/내일/);
  const r=answer(t,{id:'todo',value:' 주간 보고서 '},ctx);
  assert.deepEqual(r.effects,[{type:'addTomorrow',title:'주간 보고서'}]);
  assert.match(view(r.talk,ctx).line,/1개/);
  assert.deepEqual(answer(r.talk,{id:'todo',value:'  '},ctx).effects,[]);
  assert.match(answer(r.talk,{id:'finish'},ctx).line,/아침/);
  const skip=answer(t,{id:'skip'},ctx);
  assert.equal(skip.talk,null);
});

test('다음 날 출근하면 적어 둔 할 일을 브리핑',()=>{
  const s=state({},{todos:[todo('a','주간 보고서'),todo('b','회의록 정리')]});
  const start=routine(at(9,0),s);
  assert.equal(start.talk,'brief');
  const off=state({planTomorrow:false},{todos:[todo('a','주간 보고서')]});
  assert.equal(routine(at(9,0),off).talk,undefined);
  const allDone=state({},{todos:[todo('a','끝난 일','2026-11-23',true)]});
  assert.equal(routine(at(9,0),allDone).motion,'wave','다 끝낸 날은 그냥 인사');
});

test('브리핑은 오늘의 한 가지를 먼저, 많으면 외 몇 개로 줄여서 말함',()=>{
  const todos=[todo('a','메일'),todo('b','보고서',undefined,false,{focus:true}),todo('c','회의록'),todo('d','견적서'),
    todo('z','내일 일','2026-11-24'),todo('y','끝난 일','2026-11-23',true)];
  const line=briefLine(defaults,todos,'2026-11-23',2);
  assert.match(line,/^오늘 할 일은 보고서, 메일 외 2개/);
  assert.match(line,/루틴 2개/);
  assert.doesNotMatch(line,/내일 일|끝난 일/);
  assert.match(briefLine({...defaults,nickname:'말랑',call:'nim'},todos,'2026-11-23',0),/^말랑님, /);
});

test('브리핑 말풍선: 할 일 보기 또는 바로 시작',()=>{
  const ctx=ctxOf([todo('a','보고서')]);
  const t=open('brief',ctx,{routines:1});
  const v=view(t,ctx);
  assert.match(v.line,/보고서/);
  assert.deepEqual(v.choices.map(c=>c.id),['list','go']);
  assert.equal(answer(t,{id:'list'},ctx).talk.kind,'list');
  assert.equal(answer(t,{id:'go'},ctx).talk,null);
});

test('새 한마디도 세 가지 말투 모두 뤂으로 끝남',()=>{
  for(const key of ['planAsk','planMore','planDone','planSkip','brief','briefGo'])for(const persona of ['janmang','dadeong','calm']){
    assert.ok(lineKeys.includes(key),key);
    const line=say(key,{persona},2);
    assert.match(line,/뤂[!?.]$/,`${persona}.${key}: ${line}`);
    assert.doesNotMatch(line,/undefined|\s뤂|[다요]뤂/,`${persona}.${key}: ${line}`);
  }
});
