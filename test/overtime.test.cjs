const test=require('node:test');
const assert=require('node:assert/strict');
const {overtimeEvent,overtimeActive,recordOvertime,lastShiftEnd}=require('../app/overtime.cjs');
const {open,view,answer}=require('../app/talk.cjs');
const {defaults}=require('../app/routine.cjs');
const {say}=require('../app/voice.cjs');
const at=(h,m,d=23)=>new Date(2026,10,d,h,m);
const state=(extra={})=>({settings:{...defaults},todos:[],seen:{},snoozeUntil:0,...extra});
const busy=10, away=900;

test('퇴근 30분 뒤에도 컴퓨터를 쓰고 있으면 설마 야근인지 물음',()=>{
  const s=state();
  assert.equal(overtimeEvent(at(18,20),s,busy),null);
  const ask=overtimeEvent(at(18,31),s,busy);
  assert.deepEqual([ask.id,ask.talk,ask.motion],['2026-11-23/overtime-ask','overtime','suspicious']);
});

test('켜만 두고 자리를 비웠으면 묻지 않음',()=>{
  assert.equal(overtimeEvent(at(19,0),state(),away),null);
});

test('쉬는 날, 업무 알림을 끈 날, 알림을 쉬는 중에는 묻지 않음',()=>{
  assert.equal(overtimeEvent(at(19,0,22),state(),busy),null);
  assert.equal(overtimeEvent(at(19,0),state({settings:{...defaults,reminders:false}}),busy),null);
  assert.equal(overtimeEvent(at(19,0),state({snoozeUntil:+at(20,0)}),busy),null);
});

test('야근이라고 하면 한 시간마다 몇 시간째인지 말하며 그만 가자고 물음',()=>{
  const s=state({overtime:recordOvertime(at(18,40),state(),'yes')});
  assert.ok(overtimeActive(at(19,0),s));
  assert.equal(overtimeEvent(at(19,20),s,busy),null);
  const check=overtimeEvent(at(19,41),s,busy);
  assert.deepEqual([check.id,check.talk,check.hours],['2026-11-23/overtime-check-1','overtimeCheck',2]);
  assert.equal(overtimeEvent(at(20,41),s,busy).id,'2026-11-23/overtime-check-2');
});

test('금방 간다고 하면 20분 뒤 한 번 더 묻고, 켜 둔 거라고 하면 그날은 끝',()=>{
  const soon=state({overtime:recordOvertime(at(18,40),state(),'soon')});
  assert.equal(overtimeEvent(at(18,55),soon,busy),null);
  const again=overtimeEvent(at(19,1),soon,busy);
  assert.deepEqual([again.id,again.again],['2026-11-23/overtime-again',true]);
  const off=state({overtime:recordOvertime(at(18,40),state(),'off')});
  assert.equal(overtimeEvent(at(21,0),off,busy),null);
  assert.equal(overtimeActive(at(19,0),off),false);
});

test('다음 날이 되면 지난밤 대답은 잊음',()=>{
  const s=state({overtime:recordOvertime(at(18,40),state(),'off')});
  assert.equal(overtimeEvent(at(18,31,24),s,busy).id,'2026-11-24/overtime-ask');
});

test('밤샘 근무는 출근한 날 기준으로 퇴근 뒤를 셈',()=>{
  const s=state({settings:{...defaults,days:[1],start:'22:00',end:'06:00'}});
  assert.equal(lastShiftEnd(at(7,0,24),s.settings).key,'2026-11-23');
  assert.equal(overtimeEvent(at(6,31,24),s,busy).id,'2026-11-23/overtime-ask');
});

test('야근 말풍선: 야근이라니, 금방 갈게, 켜 둔 거야',()=>{
  const ctx={settings:{...defaults},todos:[],today:'2026-11-23',snoozed:false};
  const ask=open('overtime',ctx,{});
  const v=view(ask,ctx);
  assert.equal(v.line,say('otAsk',ctx.settings));
  assert.deepEqual(v.choices.map(c=>c.id),['yes','soon','off']);
  const yes=answer(ask,{id:'yes'},ctx);
  assert.deepEqual(yes.effects,[{type:'overtime',answer:'yes'}]);
  assert.match(yes.line,/야근이라니/);
  assert.deepEqual([yes.motion,yes.fallback],['shock','dizzy']);
  assert.deepEqual([v.motion,v.fallback],['suspicious','clock']);
  assert.deepEqual(answer(ask,{id:'soon'},ctx).effects,[{type:'overtime',answer:'soon'}]);
  assert.deepEqual(answer(ask,{id:'off'},ctx).effects,[{type:'overtime',answer:'off'}]);
  assert.equal(view(open('overtime',ctx,{again:true}),ctx).line,say('otAgain',ctx.settings));
});

test('야근 중 확인 말풍선: 이제 퇴근하거나 한 시간 더',()=>{
  const ctx={settings:{...defaults},todos:[],today:'2026-11-23',snoozed:false};
  const check=open('overtimeCheck',ctx,{hours:2});
  const v=view(check,ctx);
  assert.match(v.line,/2시간/);
  assert.deepEqual(v.choices.map(c=>c.id),['done','more']);
  const done=answer(check,{id:'done'},ctx);
  assert.deepEqual(done.effects,[{type:'overtime',answer:'done'}]);
  assert.deepEqual([done.motion,done.fallback],['freed','celebrate']);
  assert.deepEqual(answer(check,{id:'more'},ctx).effects,[{type:'overtime',answer:'yes'}]);
});

test('야근 대사도 세 말투 모두 뤂으로 끝남',()=>{
  for(const persona of ['janmang','dadeong','calm'])
    for(const key of ['otAsk','otAgain','otYes','otSoon','otOff','otDone','otMore'])
      assert.match(say(key,{persona},2),/뤂[!?.]$/,`${persona}.${key}`);
  assert.match(say('otCheck',{persona:'calm'},3),/3시간/);
});
