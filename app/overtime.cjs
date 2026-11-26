// "설마… 야근이뤂?": after the work day ends, notice that the computer is still in use, ask once,
// keep the user company while they work late, and check in every hour until they head home.
const {dayKey,shifts}=require('./routine.cjs');
const {say}=require('./voice.cjs');

const MIN=60000, HOUR=60*MIN;
const ASK_AFTER=30*MIN, WINDOW=6*HOUR, ACTIVE_IDLE=180, SOON_AGAIN=20*MIN, CHECK_EVERY=HOUR;
const KINDS=new Set(['overtime','overtimeCheck']);

function lastShiftEnd(now,s) {
  let best=null;
  for(const {key,end} of shifts(now,s))if(end<=now&&(!best||end>best.end))best={key,end};
  return best;
}

function tonight(now,state) {
  const last=lastShiftEnd(now,state.settings);
  if(!last||now-last.end<0||now-last.end>WINDOW)return null;
  return {last,record:state.overtime?.day===last.key?state.overtime:null};
}

function overtimeEvent(now,state,idleSeconds) {
  const s=state.settings;
  if(!s.reminders||+now<state.snoozeUntil||idleSeconds>ACTIVE_IDLE)return null;
  const night=tonight(now,state);
  if(!night||now-night.last.end<ASK_AFTER)return null;
  const {last,record}=night, id=part=>`${last.key}/overtime-${part}`;
  if(!record)return {id:id('ask'),talk:'overtime',motion:'suspicious'};
  if(record.answer==='soon')
    return now-record.at>=SOON_AGAIN?{id:id('again'),talk:'overtime',again:true,motion:'suspicious'}:null;
  if(record.answer==='yes'&&now-record.at>=CHECK_EVERY){
    const hours=Math.max(1,Math.round((now-last.end)/HOUR));
    return {id:id('check-'+Math.floor((now-record.started)/CHECK_EVERY)),talk:'overtimeCheck',hours,motion:'suspicious'};
  }
  return null;
}

function overtimeActive(now,state) {
  return tonight(now,state)?.record?.answer==='yes';
}

function recordOvertime(now,state,answer) {
  const last=lastShiftEnd(now,state.settings), day=last?.key??dayKey(now);
  const prev=state.overtime?.day===day?state.overtime:null;
  const started=answer==='yes'&&prev?.answer!=='yes'?+now:(prev?.started??+now);
  return {day,answer,at:+now,started};
}

const choice=(id,label,kind='secondary')=>({id,label,kind});
const openOvertime=(kind,extra={})=>kind==='overtime'?{kind,again:Boolean(extra.again)}:{kind,hours:extra.hours||1};

function viewOvertime(talk,s) {
  if(talk.kind==='overtime')return {motion:'suspicious',fallback:'clock',line:say(talk.again?'otAgain':'otAsk',s),
    choices:[choice('yes','응… 야근이야','primary'),choice('soon','금방 갈 거야'),choice('off','그냥 켜 둔 거야','ghost')]};
  return {motion:'suspicious',fallback:'clock',line:say('otCheck',s,talk.hours),choices:[choice('done','이제 퇴근할게','primary'),choice('more','조금만 더')]};
}

function answerOvertime(talk,id,s) {
  const end=(answer,key,motion,fallback)=>({talk:null,effects:[{type:'overtime',answer}],line:say(key,s),motion,fallback});
  if(talk.kind==='overtime'){
    if(id==='yes')return end('yes','otYes','shock','dizzy');
    if(id==='soon')return end('soon','otSoon','wave');
    if(id==='off')return end('off','otOff','doze');
  } else {
    if(id==='done')return end('done','otDone','freed','celebrate');
    if(id==='more')return end('yes','otMore','coffee');
  }
  return {talk,effects:[]};
}

module.exports={KINDS,lastShiftEnd,overtimeEvent,overtimeActive,recordOvertime,openOvertime,viewOvertime,answerOvertime};
