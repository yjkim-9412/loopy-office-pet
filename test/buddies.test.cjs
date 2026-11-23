const test=require('node:test');
const assert=require('node:assert/strict');
const {PATTERNS,PATTERN_LABELS,MAX_BUDDIES,spawnBuddy,stepBuddy,gapFor}=require('../app/buddies.cjs');
const {floorY}=require('../app/roam.cjs');
const {PW}=require('../app/edge.cjs');
const {say}=require('../app/voice.cjs');

const area={x:0,y:0,width:1600,height:1000};
const floor=floorY(area);
const seeded=(seed=9)=>()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
function run(b,main,from,to,{index=0,step=60,rand=seeded(),mainAt}={}){
  const seen=[];
  for(let t=from+step;t<=to;t+=step){
    const m=mainAt?mainAt(t):main;
    const out=stepBuddy(b,{now:t,area,main:m,index,rand});
    b=out.buddy;seen.push({...out,t});
  }
  return {b,seen,last:seen[seen.length-1]};
}

test('분신 패턴은 네 가지이고 한 번에 다섯 마리까지',()=>{
  assert.deepEqual(PATTERNS,['follow','wander','copy','nap']);
  for(const p of PATTERNS)assert.ok(PATTERN_LABELS[p]);
  assert.equal(MAX_BUDDIES,5);
});

test('따라다니기: 메인 루피 뒤쪽 바닥에 줄 서고, 멈추면 같은 쪽을 봄',()=>{
  const main={x:800,y:floor,facing:1,motion:'idle'};
  const {b,last}=run(spawnBuddy('follow',main,area,0,0,seeded()),main,0,10000);
  assert.equal(b.y,floor);
  assert.ok(Math.abs(b.x-(800-gapFor(0)))<=10,`x ${b.x}`);
  assert.deepEqual([last.motion,last.facing],['idle',1]);
});

test('따라다니기: 멀리 떨어지면 빨리 쫓아오고, 메인이 돌아서면 반대쪽으로 붙음',()=>{
  const right={x:200,y:floor,facing:1,motion:'idle'};
  const start={...spawnBuddy('follow',right,area,0,0,seeded()),x:1350,y:floor};
  const {b}=run(start,right,0,8000);
  assert.ok(Math.abs(b.x-(200-gapFor(0)))<=10,`8초 안에 따라옴: ${b.x}`);
  const left={...right,x:800,facing:-1};
  const turned=run(b,left,8000,20000).b;
  assert.ok(Math.abs(turned.x-(800+gapFor(0)))<=10,`x ${turned.x}`);
});

test('따라다니기: 뒤에 선 분신일수록 더 멀리 줄을 섬',()=>{
  assert.ok(gapFor(1)>gapFor(0)&&gapFor(2)>gapFor(1));
});

test('따라쟁이: 메인 앞에 서서 메인 동작을 조금 늦게 따라 함',()=>{
  const at=t=>({x:600,y:floor,facing:1,motion:t>=10000?'celebrate':'idle'});
  const settled=run(spawnBuddy('copy',at(0),area,0,0,seeded()),null,0,10000,{mainAt:at});
  assert.ok(Math.abs(settled.b.x-(600+gapFor(0)))<=10);
  const after=run(settled.b,null,10000,11500,{mainAt:at}).seen;
  assert.equal(after.find(s=>s.t<10400).motion,'idle');
  assert.equal(after.find(s=>s.t>=10600).motion,'celebrate');
});

test('제멋대로 산책: 혼자 쉬다 걷다 하며 화면 밖으로 나가지 않음',()=>{
  const main={x:800,y:floor,facing:1,motion:'idle'};
  const {seen}=run(spawnBuddy('wander',main,area,0,0,seeded()),main,0,120000,{rand:seeded(4)});
  assert.ok(seen.some(s=>s.motion==='walk'));
  assert.ok(seen.every(s=>s.buddy.x>=area.x&&s.buddy.x+PW<=area.x+area.width));
  const xs=seen.map(s=>s.buddy.x);
  assert.ok(Math.max(...xs)-Math.min(...xs)>200);
});

test('낮잠꾸러기: 대부분 졸고, 가끔 자리를 조금 옮김',()=>{
  const main={x:800,y:floor,facing:1,motion:'idle'};
  const {seen}=run(spawnBuddy('nap',main,area,0,0,seeded()),main,0,240000,{rand:seeded(6)});
  const dozing=seen.filter(s=>s.motion==='doze').length/seen.length;
  assert.ok(dozing>0.8,`조는 비율 ${dozing}`);
  assert.ok(seen.some(s=>s.motion==='walk'));
});

test('공중에 생긴 분신은 바닥으로 떨어지고, 콕 찌르면 잠깐 반응',()=>{
  const main={x:800,y:300,facing:1,motion:'idle'};
  const {b}=run(spawnBuddy('follow',main,area,0,0,seeded()),{...main,y:floor},0,3000);
  assert.equal(b.y,floor);
  const poked={...b,react:{motion:'poke',until:4000}};
  const out=stepBuddy(poked,{now:3100,area,main:{...main,y:floor},index:0,rand:seeded()});
  assert.equal(out.motion,'poke');
  assert.notEqual(stepBuddy(out.buddy,{now:4200,area,main:{...main,y:floor},index:0,rand:seeded()}).motion,'poke');
});

test('분신을 부르고 보낼 때 메인 루피가 루피 말투로 말함',()=>{
  for(const persona of ['janmang','dadeong','calm'])
    for(const key of ['buddyAdd','buddyBye'])assert.match(say(key,{persona}),/뤂[!?.]$/);
});

test('메인 루피를 드래그하면 따라다니기 분신이 공중으로 끌려오며 지나간 길을 따라옴',()=>{
  const start={x:300,y:floor,facing:1,motion:'idle'};
  const settled=run(spawnBuddy('follow',start,area,0,0,seeded()),start,0,6000).b;
  const path=t=>({x:300+600*Math.min(1,(t-6000)/1500),y:floor-(t<6300?(t-6000):300),facing:1,motion:'drag',dragging:true});
  const {b,seen}=run(settled,null,6000,7600,{mainAt:path});
  assert.ok(b.y<floor-150,`공중으로 올라옴: y ${b.y}`);
  assert.ok(b.x<900&&b.x>300,`메인 뒤에서 따라옴: x ${b.x}`);
  assert.ok(seen.filter(s=>s.t>6400).every(s=>['drag','held'].includes(s.motion)));
  assert.ok(seen.some(s=>s.motion==='drag'));
  assert.equal(seen[seen.length-1].facing,1);
});

test('드래그 중 둘째 분신은 첫째보다 더 뒤에서 따라옴',()=>{
  const start={x:300,y:floor,facing:1,motion:'idle'};
  const path=t=>({x:300+600*Math.min(1,t/1500),y:floor-200,facing:1,motion:'drag',dragging:true});
  const first=run({...spawnBuddy('follow',start,area,0,0,seeded()),x:300,y:floor},null,0,1200,{index:0,mainAt:path}).b;
  const second=run({...spawnBuddy('follow',start,area,1,0,seeded()),x:300,y:floor},null,0,1200,{index:1,mainAt:path}).b;
  const main=path(1200);
  assert.ok(Math.hypot(main.x-second.x,main.y-second.y)>Math.hypot(main.x-first.x,main.y-first.y));
});

test('드래그를 놓으면 분신도 바닥으로 떨어져 착지하고 다시 메인 뒤에 줄 섬',()=>{
  const lifted={x:600,y:floor-250,facing:1,motion:'drag',dragging:true};
  const air=run({...spawnBuddy('follow',lifted,area,0,0,seeded()),x:500,y:floor-240},lifted,0,600).b;
  const dropped={x:600,y:floor,facing:1,motion:'land'};
  const {b,seen}=run(air,dropped,600,9000);
  assert.ok(seen.some(s=>s.motion==='held'),'떨어지는 동안 대롱대롱');
  assert.equal(seen.filter(s=>s.motion==='land').length>0,true,'착지 모션');
  assert.equal(b.y,floor);
  assert.ok(Math.abs(b.x-(600-gapFor(0)))<=10,`x ${b.x}`);
});

test('드래그 중에도 다른 패턴 분신은 원래대로 바닥에서 지냄',()=>{
  const main={x:800,y:floor-300,facing:1,motion:'drag',dragging:true};
  for(const pattern of ['wander','nap']){
    const {b}=run(spawnBuddy(pattern,{...main,y:floor},area,0,0,seeded()),main,0,5000);
    assert.equal(b.y,floor,pattern);
  }
});

test('메인이 천천히 걸어도 따라다니기 분신은 멈칫하며 정면을 보지 않고 계속 걸어서 따라감',()=>{
  const walkAt=t=>({x:300+0.055*t,y:floor,facing:1,motion:'walk'});
  const {seen}=run(spawnBuddy('follow',walkAt(0),area,0,0,seeded()),null,0,12000,{mainAt:walkAt});
  const later=seen.filter(s=>s.t>1500);
  assert.deepEqual([...new Set(later.map(s=>s.motion))],['walk']);
  assert.deepEqual([...new Set(later.map(s=>s.facing))],[1]);
  const lag=later.map(s=>walkAt(s.t).x-gapFor(0)-s.buddy.x);
  assert.ok(lag.every(d=>Math.abs(d)<=40),`줄 간격 유지: ${Math.max(...lag.map(Math.abs))}`);
});

test('메인이 멈추면 분신도 곧 멈춰 메인과 같은 쪽을 봄',()=>{
  const at=t=>({x:300+0.055*Math.min(t,6000),y:floor,facing:1,motion:t<6000?'walk':'idle'});
  const {seen}=run(spawnBuddy('follow',at(0),area,0,0,seeded()),null,0,9000,{mainAt:at});
  assert.ok(seen.filter(s=>s.t>7000).every(s=>s.motion==='idle'&&s.facing===1));
});
