const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {layerPlan}=require('../app/layer.cjs');
const {defaults,validateSettings}=require('../app/routine.cjs');
const {parseHelperLine}=require('../app/edge.cjs');
const {openStore}=require('../app/store.cjs');

test('기본은 다른 창 위에 항상 띄우고, 창 위에서 노는 것도 켜져 있음',()=>{
  assert.equal(defaults.onTop,true);
  assert.equal(defaults.edgePlay,true);
  assert.equal(validateSettings({...defaults,onTop:false}).onTop,false);
  assert.throws(()=>validateSettings({...defaults,onTop:'yes'}));
});

test('예전 설정 파일에는 항상 위 설정이 켜진 채로 더해짐',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'loopy-ontop-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {onTop,...old}=defaults;
  fs.writeFileSync(path.join(dir,'office.json'),JSON.stringify({settings:{...old,edgePlay:false},todos:[],seen:{}}));
  const s=openStore(dir).value.settings;
  assert.equal(s.onTop,true);
  assert.equal(s.edgePlay,false,'끈 사람의 선택은 그대로 둠');
});

test('Windows에서 항상 위면 ERP 같은 다른 최상위 창보다 위로 주기적으로 다시 올라옴',()=>{
  const plan=layerPlan({onTop:true,platform:'win32',tick:true});
  assert.deepEqual(plan,{top:true,level:'screen-saver',raise:true,above:null});
  assert.equal(layerPlan({onTop:true,platform:'win32'}).raise,false,'주기 호출일 때만 다시 올림');
  assert.equal(layerPlan({onTop:true,platform:'win32',tick:true,menuOpen:true}).raise,false,'루피 메뉴가 열려 있으면 메뉴를 덮지 않음');
});

test('Mac에서는 원래처럼 floating 레벨로만 위에 둠',()=>{
  assert.deepEqual(layerPlan({onTop:true,platform:'darwin',tick:true}),{top:true,level:'floating',raise:false,above:null});
});

test('항상 위를 끄면 보통 창이 되고, 올라탄 창 바로 위에만 섬',()=>{
  assert.deepEqual(layerPlan({onTop:false,platform:'win32',tick:true}),{top:false,level:null,raise:false,above:null});
  assert.equal(layerPlan({onTop:false,platform:'win32',riding:4242}).above,'window:4242:0');
  assert.equal(layerPlan({onTop:false,platform:'darwin',riding:77}).above,'window:77:0');
});

test('항상 위를 꺼도 대답을 기다리는 말풍선이 떠 있는 동안은 앞으로 나옴',()=>{
  const plan=layerPlan({onTop:false,talking:true,platform:'win32',riding:4242,tick:true});
  assert.equal(plan.top,true);
  assert.equal(plan.above,null,'이미 맨 위라 올라탄 창 기준으로 옮기지 않음');
});

test('창 감지 도우미가 올라탈 창의 핸들을 함께 알려 줌',()=>{
  assert.deepEqual(parseHelperLine('{"edge":{"x":1,"y":2,"width":300,"height":200},"app":"excel","window":132456}'),
    {edge:{x:1,y:2,width:300,height:200},app:'excel',window:132456});
  assert.equal(parseHelperLine('{"edge":null,"app":"excel","window":132456}').window,null,'올라탈 창이 없으면 핸들도 버림');
  for(const bad of ['"132456"','-1','0','1.5','null'])
    assert.equal(parseHelperLine(`{"edge":{"x":1,"y":2,"width":300,"height":200},"app":null,"window":${bad}}`).window,null,bad);
});
