const test=require('node:test');
const assert=require('node:assert/strict');
const {createBoredom,gapFor,WORK_APPS}=require('../app/boredom.cjs');
const {parseHelperLine}=require('../app/edge.cjs');
const {boredLine,longWorkLine}=require('../app/voice.cjs');
const {defaults,validateSettings}=require('../app/routine.cjs');
const MIN=60000;

function feed(b,app,from,to,gap=20*MIN,step=15000){
  const said=[];
  for(let t=from;t<=to;t+=step){const e=b.update(app,t,gap);if(e)said.push({...e,t});}
  return said;
}

test('엑셀을 막 열었을 때는 조용하고, 3분 넘게 붙잡고 있으면 그때 지루해함',()=>{
  const b=createBoredom();
  assert.deepEqual(feed(b,'excel',0,2.9*MIN),[]);
  const said=feed(b,'excel',3*MIN,3.5*MIN);
  assert.equal(said.length,1);
  assert.deepEqual([said[0].kind,said[0].app],['bored','excel']);
});

test('한 번 말하면 다른 업무 앱으로 옮겨도 정한 간격 동안은 조용함',()=>{
  const b=createBoredom();
  feed(b,'excel',0,4*MIN);
  assert.deepEqual(feed(b,'sheets',4.25*MIN,20*MIN),[]);
  assert.equal(feed(b,'sheets',20.25*MIN,26*MIN)[0]?.app,'sheets');
});

test('같은 앱은 한 시간에 한 번까지만',()=>{
  const b=createBoredom();
  feed(b,'excel',0,4*MIN);
  feed(b,null,4.25*MIN,5*MIN);
  assert.deepEqual(feed(b,'excel',5.25*MIN,40*MIN).filter(e=>e.kind==='bored'),[]);
});

test('앱을 다시 실행해도 지난번에 말한 시각을 기억해서 바로 또 말하지 않음',()=>{
  const first=createBoredom();
  feed(first,'excel',0,4*MIN);
  const again=createBoredom(first.memory());
  assert.deepEqual(feed(again,'excel',5*MIN,15*MIN),[]);
});

test('같은 업무 앱을 50분 넘게 쓰면 기지개 한마디를 한 번',()=>{
  const b=createBoredom();
  const said=feed(b,'excel',0,70*MIN);
  const long=said.filter(e=>e.kind==='long');
  assert.equal(long.length,1);
  assert.ok(long[0].minutes>=50&&long[0].t>=50*MIN);
});

test('업무 앱에서 벗어나면 다시 처음부터 3분을 셈',()=>{
  const b=createBoredom();
  feed(b,'excel',0,2.5*MIN);
  feed(b,null,2.75*MIN,3*MIN);
  assert.deepEqual(feed(b,'excel',3.25*MIN,5.5*MIN),[]);
});

test('수다 레벨에 따라 간격이 달라지고 조용히에서는 말하지 않음',()=>{
  assert.equal(gapFor('quiet'),Infinity);
  assert.ok(gapFor('normal')>gapFor('chatty'));
});

test('창 감지 도우미의 예전 출력과 새 출력을 모두 읽고 모르는 앱 이름은 버림',()=>{
  assert.deepEqual(parseHelperLine('null'),{edge:null,app:null});
  assert.deepEqual(parseHelperLine('{"x":1,"y":2,"width":300,"height":200}'),{edge:{x:1,y:2,width:300,height:200},app:null});
  assert.deepEqual(parseHelperLine('{"edge":null,"app":"excel"}'),{edge:null,app:'excel'});
  assert.deepEqual(parseHelperLine('{"edge":null,"app":"notepad"}'),{edge:null,app:null});
  assert.equal(parseHelperLine('not json'),undefined);
});

test('업무 앱마다 루피 말투로 지루함을 표현',()=>{
  for(const persona of ['janmang','dadeong','calm'])for(const app of WORK_APPS){
    const lines=new Set([0,1,2].map(n=>boredLine(app,{persona},n)));
    for(const line of lines){
      assert.match(line,/뤂[!?.]$/,`${persona}.${app}: ${line}`);
      assert.doesNotMatch(line,/\s뤂|[다요]뤂|룹/,`${persona}.${app}: ${line}`);
    }
    assert.match(longWorkLine(app,{persona},52),/52분/);
  }
  assert.ok(new Set([0,1,2].map(n=>boredLine('excel',{persona:'janmang'},n))).size>=2);
});

test('업무 앱 알아보기는 끌 수 있는 설정',()=>{
  assert.equal(typeof defaults.workAware,'boolean');
  assert.equal(validateSettings({...defaults,workAware:false}).workAware,false);
  assert.throws(()=>validateSettings({...defaults,workAware:1}));
});
