const test=require('node:test');
const assert=require('node:assert/strict');
const {createWalker,stepWalker,floorY,SPEED}=require('../app/roam.cjs');
const {PW}=require('../app/edge.cjs');
const {defaults,validateSettings}=require('../app/routine.cjs');
const {say}=require('../app/voice.cjs');

const area={x:0,y:0,width:1600,height:1000};
const seeded=(seed=7)=>()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
function simulate(w,from,to,step=50,rand=seeded()){
  const seen=[];
  for(let t=from+step;t<=to;t+=step){w=stepWalker(w,t,area,rand);seen.push(w);}
  return {w,seen};
}

test('공중에 놓인 채 산책을 시작하면 바닥으로 떨어져 착지',()=>{
  const start=createWalker({x:500,y:200},area,0,seeded());
  assert.equal(start.mode,'fall');
  const {w,seen}=simulate(start,0,4000);
  assert.equal(w.y,floorY(area));
  assert.equal(seen.filter(s=>s.landed).length,1);
  assert.ok(seen.every(s=>s.y<=floorY(area)));
});

test('쉬다가 정한 곳으로 가는 방향을 보며 일정한 속도로 걸어감',()=>{
  let w=createWalker({x:300,y:floorY(area)},area,0,seeded());
  assert.equal(w.mode,'rest');
  while(w.mode==='rest')w=stepWalker(w,w.t+50,area,seeded(3));
  assert.equal(w.mode,'walk');
  assert.equal(w.facing,Math.sign(w.targetX-w.x));
  const before=w.x,t0=w.t;
  for(let i=0;i<20&&w.mode==='walk';i++)w=stepWalker(w,w.t+50,area,seeded());
  if(w.mode==='walk')assert.ok(Math.abs(Math.abs(w.x-before)-SPEED*(w.t-t0))<1);
});

test('도착하면 5~18초 쉬고, 화면 밖으로는 절대 나가지 않음',()=>{
  const {seen}=simulate(createWalker({x:-300,y:floorY(area)},area,0,seeded()),0,180000,50,seeded(11));
  const arrivals=seen.filter(s=>s.arrived);
  assert.ok(arrivals.length>=3,`도착 ${arrivals.length}번`);
  for(const a of arrivals){const rest=a.until-a.t;assert.ok(rest>=5000&&rest<=18000,`쉬는 시간 ${rest}`);}
  assert.ok(seen.every(s=>s.x>=area.x&&s.x+PW<=area.x+area.width));
});

test('한동안 멈춰 있다가 다시 움직여도 순간이동하지 않음',()=>{
  let w=createWalker({x:300,y:floorY(area)},area,0,seeded());
  while(w.mode!=='walk')w=stepWalker(w,w.t+50,area,seeded(5));
  const next=stepWalker(w,w.t+10000,area,seeded());
  assert.ok(Math.abs(next.x-w.x)<=SPEED*100+0.001);
});

test('산책은 켜고 끌 수 있는 설정이고 기본은 켜짐',()=>{
  assert.equal(defaults.roam,true);
  assert.equal(validateSettings({...defaults,roam:false}).roam,false);
  assert.throws(()=>validateSettings({...defaults,roam:'yes'}));
});

test('산책을 켜고 끌 때와 산책 중 한마디도 루피 말투',()=>{
  for(const persona of ['janmang','dadeong','calm']){
    for(const key of ['roamOn','roamOff'])assert.match(say(key,{persona}),/뤂[!?.]$/);
    const murmurs=new Set([0,1,2].map(n=>say('roam',{persona},n)));
    assert.ok(murmurs.size>=2);
  }
});
