const test=require('node:test');
const assert=require('node:assert/strict');
const {GAPS,POOLS,HOLD,createIdle,poolFor}=require('../app/idle.cjs');
const {idleLine,idleTalk,PERSONAS}=require('../app/voice.cjs');
const {defaults}=require('../app/routine.cjs');
const catalog=require('../assets/motions.json');
const SEC=1000, MIN=60*SEC;

// a deterministic stand-in for Math.random
function seq(seed=7){let x=seed;return ()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};}
const at=(h,m=0)=>new Date(2026,10,24,h,m).getTime();
const settings=(over={})=>({...defaults,start:'10:00',end:'17:00',lunch:true,lunchStart:'12:00',lunchEnd:'13:00',...over});
const workAt=(t,s=settings())=>{
  const d=new Date(t), [sh,sm]=s.start.split(':').map(Number), [eh,em]=s.end.split(':').map(Number);
  const now=d.getHours()*60+d.getMinutes();
  return {minutes:now-(sh*60+sm),left:eh*60+em-now};
};
// run the routine check every 15 s, the same as main.cjs, and collect what Loopy did
function run(idle,from,to,{s=settings(),canTalk=true,rand=seq(),free=()=>true}={}){
  const beats=[];
  for(let t=from;t<=to;t+=15*SEC){
    const b=idle.tick(t,{work:free(t)?workAt(t,s):null,settings:s,canTalk},rand);
    if(b)beats.push({...b,t});
  }
  return beats;
}
const starts=beats=>beats.filter((b,i)=>b.line||i===0||beats[i-1].motion!==b.motion||b.t-beats[i-1].t>15*SEC);

test('대기 중에는 수다 레벨에 맞는 간격으로 혼자 동작을 바꿈',()=>{
  for(const chattiness of ['normal','chatty']){
    const s=settings({chattiness}), beats=starts(run(createIdle(),at(10,30),at(11,30),{s}));
    const [lo,hi]=GAPS[chattiness];
    assert.ok(beats.length>=Math.floor(60*MIN/(hi+15*SEC)),`${chattiness}: ${beats.length}`);
    assert.ok(beats.length<=Math.ceil(60*MIN/lo),`${chattiness}: ${beats.length}`);
  }
  const quiet=starts(run(createIdle(),at(10,30),at(11,30),{s:settings({chattiness:'quiet'})}));
  assert.ok(quiet.length>=5&&quiet.length<=10,`quiet: ${quiet.length}`);
});

test('조용히 모드와 말 걸기를 끈 때는 동작만 하고 말은 하지 않음',()=>{
  assert.equal(run(createIdle(),at(10,30),at(12),{s:settings({chattiness:'quiet'})}).some(b=>b.line),false);
  assert.equal(run(createIdle(),at(10,30),at(12),{s:settings({chattiness:'chatty'}),canTalk:false}).some(b=>b.line),false);
  assert.ok(run(createIdle(),at(10,30),at(12),{s:settings({chattiness:'chatty'})}).some(b=>b.line));
});

test('같은 동작을 연달아 고르지 않고 여러 동작을 돌아가며 보여 줌',()=>{
  const beats=starts(run(createIdle(),at(10,30),at(16),{s:settings({chattiness:'chatty'})}));
  for(let i=1;i<beats.length;i++)if(beats[i].t-beats[i-1].t>HOLD)assert.notEqual(beats[i].motion,beats[i-1].motion);
  assert.ok(new Set(beats.map(b=>b.motion)).size>=8);
});

test('조용한 동작은 잠깐 이어지다가 다시 가만히 섬',()=>{
  const idle=createIdle({gaps:{normal:[MIN,MIN]}}), rand=()=>0.9, s=settings();
  const tick=t=>idle.tick(t,{work:workAt(t,s),settings:s,canTalk:false},rand);
  assert.equal(tick(at(10,30)),null);
  const first=tick(at(10,31));
  assert.ok(first&&!first.line);
  assert.deepEqual(tick(at(10,31)+15*SEC),{motion:first.motion});
  assert.equal(tick(at(10,31)+HOLD),null);
});

test('바쁘거나 근무 시간이 아니면 동작을 멈추고 기다림',()=>{
  assert.deepEqual(run(createIdle(),at(10,30),at(11),{free:()=>false}),[]);
  assert.deepEqual(run(createIdle(),at(18),at(19)),[]);
  const idle=createIdle({gaps:{normal:[MIN,MIN]}}), s=settings(), rand=()=>0.9;
  idle.tick(at(10,30),{work:workAt(at(10,30)),settings:s},rand);
  assert.ok(idle.tick(at(10,31),{work:workAt(at(10,31)),settings:s},rand));
  assert.equal(idle.tick(at(10,31)+15*SEC,{work:null,settings:s},rand),null);
});

test('수다 레벨을 바꾸면 다음 동작까지 기다리는 시간도 바로 바뀜',()=>{
  const idle=createIdle(), rand=()=>0.5;
  idle.tick(at(10,30),{work:workAt(at(10,30)),settings:settings({chattiness:'quiet'})},rand);
  assert.ok(idle.tick(at(10,31),{work:workAt(at(10,31)),settings:settings({chattiness:'chatty'})},rand));
});

test('시간대에 맞는 동작을 고름',()=>{
  const s=settings();
  assert.equal(poolFor(new Date(at(10,10)),workAt(at(10,10)),s),POOLS.morning);
  assert.equal(poolFor(new Date(at(12,20)),workAt(at(12,20)),s),POOLS.lunch);
  assert.equal(poolFor(new Date(at(13,30)),workAt(at(13,30)),s),POOLS.work);
  assert.equal(poolFor(new Date(at(15)),workAt(at(15)),s),POOLS.afternoon);
  assert.equal(poolFor(new Date(at(16,40)),workAt(at(16,40)),s),POOLS.wrap);
  assert.equal(poolFor(new Date(at(12,20)),workAt(at(12,20)),settings({lunch:false})),POOLS.work);
});

test('대기 동작은 모두 앱에 있는 전신 동작이고 세 말투 모두 혼잣말이 있음',()=>{
  for(const motion of new Set(Object.values(POOLS).flat())){
    assert.ok(Object.hasOwn(catalog,motion),motion);
    assert.notEqual(catalog[motion].partial,true,motion);
    for(const persona of PERSONAS)assert.ok(idleTalk[persona][motion]?.length>=2,`${persona}.${motion}`);
  }
});

test('혼잣말은 모두 뤂을 띄어 쓰지 않고 문장 끝에 붙임',()=>{
  for(const persona of PERSONAS)for(const [motion,lines] of Object.entries(idleTalk[persona]))lines.forEach((line,i)=>{
    const label=`${persona}.${motion}[${i}]: ${line}`;
    assert.match(line,/뤂[!?.]$/,label);
    assert.doesNotMatch(line,/\s뤂/,label);
    assert.doesNotMatch(line,/[다요]뤂/,label);
    assert.equal(line.includes('룹'),false,label);
  });
});

test('혼잣말은 가끔 이름을 불러 줌',()=>{
  const s={persona:'janmang',nickname:'김프로',call:'nim'};
  assert.match(idleLine('water',s,0,true),/^김프로님, /);
  assert.doesNotMatch(idleLine('water',s,0,false),/김프로/);
  assert.doesNotMatch(idleLine('water',{persona:'calm'},0,true),/^, /);
});
