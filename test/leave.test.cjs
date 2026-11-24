const test=require('node:test');
const assert=require('node:assert/strict');
const talk=require('../app/talk.cjs');
const {say,duration,PERSONAS}=require('../app/voice.cjs');
const {defaults}=require('../app/routine.cjs');
const {createIdle,TELL_EVERY}=require('../app/idle.cjs');
const MIN=60000;

const settings=(over={})=>({...defaults,start:'10:00',end:'17:00',days:[1,2,3,4,5],...over});
const at=(d,h,m=0)=>new Date(2026,10,d,h,m); // 2026-11-24 is a Tuesday, 11-29 a Sunday
const ctx=(now,over)=>({settings:settings(over),todos:[],today:'2026-11-24',snoozed:false,now:+now});

test('남은 시간은 분, 시간, 시간과 분으로 말함',()=>{
  assert.equal(duration(45),'45분');
  assert.equal(duration(120),'2시간');
  assert.equal(duration(65),'1시간 5분');
  assert.equal(duration(0),'0분');
});

test('메뉴에서 퇴근까지 얼마나 남았는지 물어볼 수 있음',()=>{
  const c=ctx(at(24,10,30));
  const menu=talk.open('menu',c);
  assert.ok(talk.view(menu,c).choices.some(x=>x.id==='left'));
  const r=talk.answer(menu,{id:'left'},c);
  assert.equal(r.talk,null);
  assert.equal(r.line,'퇴근까지 6시간 30분 남았뤂! 오늘도 화이팅이뤂!');
  assert.equal(r.motion,'clock');
});

test('퇴근이 가까우면, 지났으면, 출근 전이면, 쉬는 날이면 다르게 답함',()=>{
  const line=(now,over)=>talk.leftAnswer(now,settings(over)).line;
  assert.equal(line(at(24,16,52)),'퇴근 8분 전이뤂! 가방 챙길 준비 됐어뤂?');
  assert.equal(line(at(24,16,20)),'퇴근까지 40분밖에 안 남았뤂! 조금만 더 버티자뤂!');
  assert.equal(line(at(24,17,5)),say('leftOver',settings()));
  assert.equal(line(at(24,20)),say('leftOver',settings()));
  assert.equal(line(at(24,9)),'아직 출근 전이뤂! 오늘은 17:00에 퇴근하뤂!');
  assert.equal(line(at(29,12)),say('leftOff',settings()));
  assert.equal(line(at(24,23),{start:'22:00',end:'06:00'}),'퇴근까지 7시간 남았뤂! 오늘도 화이팅이뤂!');
});

test('퇴근 대사는 세 말투 모두 뤂으로 끝남',()=>{
  for(const persona of PERSONAS){
    for(const m of [5,40,200])assert.match(say('leftNow',{persona},m),/뤂[!?.]$/,`${persona}.leftNow(${m})`);
    assert.match(say('leftBefore',{persona},'18:00'),/18:00.*뤂[!?.]$/);
    for(const key of ['leftOver','leftOff'])assert.match(say(key,{persona}),/뤂[!?.]$/,`${persona}.${key}`);
  }
});

// one routine check every 15 s, as in main.cjs
function run(chattiness,{canTalk=true,hours=3}={}){
  const s=settings({chattiness}), idle=createIdle(), out=[];
  let x=11;const rand=()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};
  for(let t=+at(24,10,30);t<=+at(24,10,30)+hours*60*MIN;t+=15000){
    const d=new Date(t), now=d.getHours()*60+d.getMinutes();
    const b=idle.tick(t,{work:{minutes:now-600,left:1020-now},settings:s,canTalk},rand);
    if(b?.left)out.push({t,left:b.left,motion:b.motion});
  }
  return out;
}

test('가만히 있어도 가끔 퇴근까지 남은 시간을 알려 줌',()=>{
  for(const chattiness of ['normal','chatty']){
    const tells=run(chattiness);
    assert.ok(tells.length>=3,`${chattiness}: ${tells.length}`);
    for(let i=1;i<tells.length;i++)assert.ok(tells[i].t-tells[i-1].t>=TELL_EVERY[chattiness]);
    for(const t of tells){
      assert.equal(t.motion,'clock');
      const d=new Date(t.t);
      assert.equal(t.left,1020-(d.getHours()*60+d.getMinutes()));
    }
  }
});

test('조용히 모드나 말 걸기를 끈 때는 남은 시간도 말하지 않음',()=>{
  assert.deepEqual(run('quiet'),[]);
  assert.deepEqual(run('chatty',{canTalk:false}),[]);
});
