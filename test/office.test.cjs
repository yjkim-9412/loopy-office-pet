const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {defaults,validateSettings,routine,shift}=require('../app/routine.cjs');
const {openStore}=require('../app/store.cjs');
const {edgePosition}=require('../app/edge.cjs');
const catalog=require('../assets/motions.json');
const at=(h,m,d=23)=>new Date(2026,10,d,h,m);
const state=(settings={})=>({settings:{...defaults,...settings},todos:[],seen:{},snoozeUntil:0});
test('출근 인사와 투두 작성 확인, 작성한 날에는 인사',()=>{
  const s=state();
  assert.equal(routine(at(9,0),s).line,'오늘 TODO는 작성했어뤂?');
  s.todos=[{day:'2026-11-23',done:true}];
  assert.equal(routine(at(9,20),s).motion,'wave');
  assert.equal(routine(at(9,25),s).id,routine(at(9,20),s).id);
});
test('절전 후 지난 정각 알림을 몰아서 재생하지 않음',()=>{
  const s=state();
  assert.equal(routine(at(11,15),s),null);
  s.seen['2026-11-23/start']=1;
  assert.equal(routine(at(12,1),s).id,'2026-11-23/hour-12');
  assert.equal(routine(at(12,0,22),s),null);
});
test('이월한 일까지 퇴근 정리에 반영',()=>{
  const s=state();s.todos=[{day:'2026-11-20',done:false}];
  assert.match(routine(at(17,50),s).line,/1개/);
  assert.equal(routine(at(18,1),s).motion,'pack');
  assert.equal(routine(at(18,15),s),null);
});
test('야간 근무는 출근일 기준, 다음날 퇴근',()=>{
  const s=state({days:[1],start:'22:30',end:'06:00'});
  assert.equal(shift(at(2,0,24),s.settings).key,'2026-11-23');
  assert.equal(routine(at(5,55,24),s).motion,'clock');
  assert.equal(routine(at(6,3,24),s).motion,'pack');
});
test('음소거와 업무 알림 설정',()=>{
  const s=state({reminders:false});
  assert.equal(routine(at(9,1),s).line,'');
  s.snoozeUntil=+at(13,0);
  assert.equal(routine(at(12,0),s),null);
  assert.throws(()=>validateSettings({...defaults,start:'24:10'}));
  assert.throws(()=>validateSettings({...defaults,days:[]}));
});
test('말풍선 문장과 시트 프레임을 확인',()=>{
  for(const h of [9,10,12,14,17,18])for(const m of [0,1,48,58]){
    const e=routine(at(h,m),state());
    if(e){assert.ok(catalog[e.motion]);assert.match(e.line,/뤂[!?]$/);}
  }
  for(const item of Object.values(catalog)){
    const png=fs.readFileSync(path.join(__dirname,'../ui',item.sheet));
    const frames=item.frames??4;
    assert.equal(png.readUInt32BE(16),256*frames);assert.equal(png.readUInt32BE(20),256);
    assert.ok(item.playback.every(k=>k.frame>=0&&k.frame<frames&&k.durationMs>0));
  }
});
test('창 윗변, 최대화된 창 아랫변, 보조 화면과 점프',()=>{
  const a={x:-1600,y:0,width:1600,height:1000},r={x:-1400,y:320,width:720,height:540};
  const on=edgePosition(r,a,0),hop=edgePosition(r,a,340),reverse=edgePosition(r,a,15000);
  assert.equal(on.y+195,r.y);assert.ok(hop.y<on.y-20);assert.equal(reverse.facing,-1);
  assert.ok(on.x<0);
  const bottom=edgePosition({...r,y:0,height:1000},a,0);
  assert.ok(bottom.y>700&&bottom.y+202<=1000);
  assert.equal(edgePosition({...r,width:50},a,0),null);
});
test('각 프레임의 클릭 영역은 몸통과 빈 배경을 구분',()=>{
  const masks=require('../assets/hit.json');
  for(const id of Object.keys(catalog)){
    assert.equal(masks[id].length,catalog[id].frames??4);
    for(const encoded of masks[id]){
      const bits=Buffer.from(encoded,'base64');
      assert.equal(bits.length,128*128/8);
      assert.equal(bits[0],0);
      if(catalog[id].partial)assert.ok(bits.some(v=>v>0));
      else assert.ok(bits.some(v=>v===255));
    }
  }
});
test('재시작해도 TODO와 이미 보낸 알림을 유지',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'loopy-store-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const a=openStore(dir);
  a.change(d=>{d.todos.push({title:'일정 정리'});d.seen['2026-11-23/start']=1;});
  assert.deepEqual(openStore(dir).value,a.value);
  assert.throws(()=>a.change(d=>{d.todos=[];throw Error('cancel');}));
  assert.equal(a.value.todos.length,1);
});

function readRGBA(file){
  const zlib=require('node:zlib'),buf=fs.readFileSync(file);
  const width=buf.readUInt32BE(16),height=buf.readUInt32BE(20),idat=[];
  for(let at=8;at<buf.length;){
    const len=buf.readUInt32BE(at),type=buf.toString('ascii',at+4,at+8);
    if(type==='IDAT')idat.push(buf.subarray(at+8,at+8+len));
    at+=12+len;
  }
  const raw=zlib.inflateSync(Buffer.concat(idat)),stride=width*4,out=Buffer.alloc(stride*height);
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
    for(let x=0;x<stride;x++){
      const a=x>=4?out[y*stride+x-4]:0,b=y?out[(y-1)*stride+x]:0,c=x>=4&&y?out[(y-1)*stride+x-4]:0;
      const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
      const pred=[0,a,b,(a+b)>>1,pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter];
      out[y*stride+x]=(line[x]+pred)&255;
    }
  }
  return {width,height,px:out};
}
function headWidth({width,px},frame){
  const fur=(x,y)=>{const i=(y*width+frame*256+x)*4,[r,g,b,a]=px.subarray(i,i+4);
    return a>128&&r>200&&g>100&&g<200&&b>110&&b<210&&r-g>40;};
  let top=-1;
  for(let y=0;y<256&&top<0;y++){let n=0;for(let x=0;x<256;x++)if(fur(x,y))n++;if(n>=8)top=y;}
  let best=0;
  for(let y=top+30;y<Math.min(top+71,256);y++){
    let lo=-1,hi=-1;for(let x=0;x<256;x++)if(fur(x,y)){if(lo<0)lo=x;hi=x;}
    if(lo>=0)best=Math.max(best,hi-lo);
  }
  return best;
}
test('모든 모션에서 루피 머리 크기가 기준 루피와 크게 다르지 않고 발이 같은 선에 있음',()=>{
  const sheetHead=id=>{const img=readRGBA(path.join(__dirname,'../assets/motions',id+'.png'));
    const w=Array.from({length:img.width/256},(_,i)=>headWidth(img,i)).sort((a,b)=>a-b);
    return w[Math.floor(w.length/2)];};
  const ref=sheetHead('idle');
  for(const id of Object.keys(catalog)){
    if(!catalog[id].partial){
      const ratio=sheetHead(id)/ref;
      assert.ok(ratio>0.9&&ratio<1.1,`${id} 머리 크기 ${ratio.toFixed(2)}배`);
    }
    const img=readRGBA(path.join(__dirname,'../assets/motions',id+'.png'));
    let feet=0;
    for(let y=0;y<256;y++)for(let x=0;x<img.width;x++)if(img.px[(y*img.width+x)*4+3]>40)feet=y;
    if(catalog[id].airborne)assert.ok(feet>=200&&feet<236,`${id}는 공중에 떠 있어야 함 (바닥 ${feet})`);
    else if(catalog[id].hangs)assert.ok(feet>=236&&feet<=255,`${id}는 다리를 바닥선 아래로 늘어뜨림 (바닥 ${feet})`);
    else assert.ok(feet>=236&&feet<=246,`${id} 바닥선 ${feet}`);
  }
});
