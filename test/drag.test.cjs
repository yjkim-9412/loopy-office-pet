const test=require('node:test');
const assert=require('node:assert/strict');
const {createDrag}=require('../app/drag.cjs');
const {say,lineKeys}=require('../app/voice.cjs');

function run(drag,steps){
  let last;
  for(const s of steps)last=drag.update(s);
  return last;
}
const path=(from,to,t0,t1,y=100,target=false)=>{
  const out=[];
  for(let t=t0;t<=t1;t+=20)out.push({x:from+(to-from)*(t-t0)/(t1-t0),y,t,target});
  return out;
};

test('누르자마자 대롱대롱 들린 자세이고, 가만히 있어도 그대로',()=>{
  const drag=createDrag({x:100,y:100,t:0});
  assert.equal(drag.update({x:100,y:100,t:16}).state,'held');
  assert.equal(drag.update({x:100,y:100,t:600}).state,'held');
});

test('휙 빠르게 끌면 가는 방향을 보며 끌려가고, 멈추면 다시 대롱대롱',()=>{
  const drag=createDrag({x:100,y:100,t:0});
  const right=run(drag,path(100,700,400,1000));
  assert.deepEqual([right.state,right.facing],['drag',1]);
  const left=run(drag,path(700,100,1020,1600));
  assert.deepEqual([left.state,left.facing],['drag',-1]);
  const still=run(drag,[{x:100,y:100,t:1700},{x:100,y:100,t:2500}]);
  assert.deepEqual([still.state,still.facing],['held',-1]);
});

test('좌우로 마구 흔들면 어지러워하고, 잠깐 지나면 진정',()=>{
  const drag=createDrag({x:100,y:100,t:0});
  const steps=[];
  for(let i=0;i<8;i++)steps.push({x:i%2?160:100,y:100,t:400+i*90});
  assert.equal(run(drag,steps).state,'dizzy');
  assert.equal(drag.update({x:100,y:100,t:1300}).state,'dizzy');
  assert.equal(drag.update({x:100,y:100,t:2700}).state,'held');
});

test('파일 탐색기에 앉을 수 있는 자리 위에서는 내려다보며 설렘',()=>{
  const drag=createDrag({x:100,y:100,t:0});
  assert.equal(run(drag,path(100,300,400,800,100,true)).state,'aim');
  assert.equal(drag.update({x:300,y:100,t:1600,target:false}).state,'held');
});

test('드래그 중 한마디도 루피 말투를 따름',()=>{
  for(const key of ['grab','dizzy','aim'])for(const persona of ['janmang','dadeong','calm']){
    assert.ok(lineKeys.includes(key));
    assert.match(say(key,{persona}),/뤂[!?.]$/);
    assert.ok(say(key,{persona}).length<=14,`${persona}.${key}는 말풍선 한 줄에 들어가야 함`);
  }
});

function handDrag(drag,{until=4000,target=()=>false,wiggle=0}={}){
  let seed=3,x=0,y=0;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const seen=[];
  for(let t=16;t<=until;t+=16){
    const moving=t%450<150;
    x+=moving?8:(rand()-0.5)*3+wiggle*(t%900<450?-1:1);y+=(rand()-0.5)*2;
    seen.push({t,...drag.update({x,y,t,target:target(t)})});
  }
  return seen;
}
const changes=seen=>seen.filter((s,i)=>i&&s.state!==seen[i-1].state).length;

test('손으로 끌다 잠깐씩 멈춰도 자세가 왔다 갔다 하지 않음',()=>{
  const seen=handDrag(createDrag({x:0,y:0,t:0}));
  assert.equal(changes(seen),0,`상태가 ${changes(seen)}번 바뀜`);
  assert.ok(seen.every(s=>s.state==='held'));
});

test('들고 보통 속도로 옮기다 멈춰도 자세는 대롱대롱 하나',()=>{
  const drag=createDrag({x:0,y:0,t:0});
  const states=new Set();
  let x=0;
  for(let t=16;t<=1000;t+=16){x+=6;states.add(drag.update({x,y:0,t}).state);}
  for(let t=1120;t<=2500;t+=120)states.add(drag.update({x,y:0,t}).state);
  assert.deepEqual([...states],['held']);
});

test('잠깐 뒤로 흔들린 정도로는 보는 방향이 바뀌지 않음',()=>{
  const drag=createDrag({x:0,y:0,t:0});
  let x=0,t=0,last;
  for(;t<1000;t+=20){x+=10;last=drag.update({x,y:0,t});}
  for(let i=0;i<5;i++){t+=20;x-=4;last=drag.update({x,y:0,t});}
  assert.equal(last.facing,1);
  for(let i=0;i<20;i++){t+=20;x-=10;last=drag.update({x,y:0,t});}
  assert.equal(last.facing,-1);
});

test('앉을 자리 경계에서 왔다 갔다 해도 내려다보는 자세를 유지',()=>{
  const seen=handDrag(createDrag({x:0,y:0,t:0}),{until:3000,target:t=>t>1000&&t%200<120});
  const after=seen.filter(s=>s.t>1300);
  assert.ok(after.every(s=>s.state==='aim'),after.map(s=>s.state).filter((v,i,a)=>a.indexOf(v)===i).join(','));
});
