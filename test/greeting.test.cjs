const test=require('node:test');
const assert=require('node:assert/strict');
const {greetingFor,GREETING_KEYS}=require('../app/greeting.cjs');
const {defaults}=require('../app/routine.cjs');
const {say}=require('../app/voice.cjs');
const catalog=require('../assets/motions.json');

const at=(h,m,d=26)=>new Date(2026,10,d,h,m);          // 2026-11-26 is a Thursday, 28 a Saturday
const key=d=>`2026-11-${String(d).padStart(2,'0')}`;
function look(h,m,{d=26,settings={},todos=[],snoozeUntil=0}={}){
  return greetingFor({settings:{...defaults,...settings},todos,today:key(d),snoozeUntil},at(h,m,d));
}
const todo=(id,done,d=26)=>({id,title:id,day:key(d),done,doneDay:done?key(d):null});

test('같은 저녁이라도 오늘 한 일이 있으면 고생했다고, 없으면 내일 보자고',()=>{
  assert.equal(look(19,0,{todos:[todo('a',true)]}).key,'greetAfter');
  assert.equal(look(19,0).key,'greetAfterNone');
});

test('쉬는 날, 출근 전, 늦은 밤에는 그에 맞는 인사',()=>{
  assert.equal(look(15,0,{d:28}).key,'greetOff');
  assert.equal(look(8,30).key,'greetEarly');
  assert.equal(look(23,30,{todos:[todo('a',true)]}).key,'greetLate');
  assert.equal(look(2,0,{d:27}).key,'greetLate');
});

test('근무 중에는 할 일 진행에 따라 인사가 바뀜',()=>{
  assert.equal(look(10,30).key,'greetEmpty');
  assert.equal(look(9,40,{todos:[todo('a',false),todo('b',false)]}).key,'greetMorning');
  const working=look(15,0,{todos:[todo('a',true),todo('b',false),todo('c',false)]});
  assert.deepEqual([working.key,working.n],['greetWork',2]);
  assert.equal(look(15,0,{todos:[todo('a',true),todo('b',true)]}).key,'greetAllDone');
  const wrap=look(17,50,{todos:[todo('a',false)]});
  assert.deepEqual([wrap.key,wrap.n],['greetWrap',10]);
});

test('점심시간, 집중 시간, 알림 쉬는 중에는 그 상태를 알려 줌',()=>{
  const todos=[todo('a',false)];
  assert.equal(look(12,30,{settings:{lunch:true},todos}).key,'greetLunch');
  assert.equal(look(14,30,{settings:{focus:true,focusStart:'14:00',focusEnd:'16:00'},todos}).key,'greetFocus');
  assert.equal(look(11,0,{todos,snoozeUntil:+at(11,30)}).key,'greetSnooze');
});

test('상태마다 루피 그림도 달라지고, 그림은 모두 앱에 있는 모션',()=>{
  const sheets=new Set([look(19,0).sheet,look(10,30).sheet,look(15,0,{todos:[todo('a',true)]}).sheet,look(15,0,{d:28}).sheet]);
  assert.ok(sheets.size>=3);
  for(const k of GREETING_KEYS){
    const sample={greetOff:look(15,0,{d:28}),greetAfter:look(19,0,{todos:[todo('a',true)]}),greetEmpty:look(10,30)}[k];
    if(sample)assert.ok(catalog[sample.sheet],`${k}: ${sample.sheet}`);
  }
});

test('인사 문구는 세 말투 모두 이름을 부르고 뤂으로 끝남',()=>{
  for(const persona of ['janmang','dadeong','calm'])for(const k of GREETING_KEYS){
    const line=say(k,{persona,nickname:'말랑',call:'nim'},3);
    assert.match(line,/^말랑님, .*뤂[!?.]$/,`${persona}.${k}: ${line}`);
    assert.doesNotMatch(line,/\s뤂|[다요]뤂|룹/,`${persona}.${k}: ${line}`);
  }
});
