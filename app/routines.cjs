// "내 루틴": reminders the user makes for their own day, each with a time, a repeat rule,
// a Loopy motion and an optional line ("{호칭}" becomes how Loopy calls the user).
const {callName,say}=require('./voice.cjs');
const {TIME,pad,toMinutes,dayKey}=require('./routine.cjs');

const REPEATS=['workdays','daily','days','interval','once'];
const ROUTINE_MOTIONS=['stretch','water','lunch','coffee','wave','write','stamp','typing','celebrate','shh'];
const DUE_MINUTES=5, LATER_WINDOW=30*60000;
const toTime=minutes=>pad(Math.floor(minutes/60))+':'+pad(minutes%60);

function validateRoutine(r,motions,today) {
  const title=String(r?.title??'').trim();
  if(!title||title.length>30)throw Error('루틴 이름은 1~30자로 적어 주세요.');
  if(!TIME.test(r.time))throw Error('루틴 시각을 확인해 주세요.');
  if(!REPEATS.includes(r.repeat))throw Error('반복 방식을 골라 주세요.');
  const days=r.repeat==='days'?[...new Set((r.days||[]).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].sort():[];
  if(r.repeat==='days'&&!days.length)throw Error('요일을 하나 이상 골라 주세요.');
  const every=r.repeat==='interval'?Number(r.every):2;
  if(!Number.isInteger(every)||every<1||every>4)throw Error('1~4시간마다 중에서 골라 주세요.');
  const until=r.repeat==='interval'?(TIME.test(r.until)?r.until:'18:00'):'';
  if(r.repeat==='interval'&&until<=r.time)throw Error('끝나는 시각을 시작보다 늦게 정해 주세요.');
  if(!motions.includes(r.motion))throw Error('루피 동작을 골라 주세요.');
  const line=String(r.line??'').trim();
  if(line.length>60)throw Error('한마디는 60자까지 적어 주세요.');
  return {title,time:r.time,repeat:r.repeat,days,every,until,motion:r.motion,line,on:r.on!==false,
    date:r.repeat==='once'?(r.date||today):''};
}

function applies(r,settings,date,key) {
  if(!r.on)return false;
  const weekday=date.getDay();
  if(r.repeat==='daily')return true;
  if(r.repeat==='days')return r.days.includes(weekday);
  if(r.repeat==='once')return r.date===key;
  return settings.days.includes(weekday);
}

function slotsFor(r,settings,date,key) {
  if(!applies(r,settings,date,key))return [];
  if(r.repeat!=='interval')return [r.time];
  const slots=[];
  for(let m=toMinutes(r.time);m<=toMinutes(r.until||'18:00');m+=r.every*60)slots.push(toTime(m));
  return slots;
}

function dueRoutines(now,routines,settings,seen={},later={}) {
  const key=dayKey(now), minute=now.getHours()*60+now.getMinutes(), due=[];
  for(const r of routines){
    const again=later[r.id];
    if(again&&+now>=again.at&&+now-again.at<LATER_WINDOW&&!seen[again.slot+'/later']){
      due.push({routine:r,id:again.slot+'/later',later:true});
      continue;
    }
    for(const slot of slotsFor(r,settings,now,key)){
      const id=`${key}/routine-${r.id}-${slot}`, diff=minute-toMinutes(slot);
      if(diff>=0&&diff<DUE_MINUTES&&!seen[id])due.push({routine:r,id});
    }
  }
  return due;
}

function routineLine(r,settings) {
  if(!r.line)return say('routineDefault',settings,r.title);
  const who=callName(settings.nickname,settings.call);
  return who?r.line.replaceAll('{호칭}',who):r.line.replace(/\{호칭\}\s*,?\s*/g,'').trim();
}

module.exports={REPEATS,ROUTINE_MOTIONS,validateRoutine,slotsFor,dueRoutines,routineLine};
