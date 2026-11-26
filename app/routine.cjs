const {CALLS,PERSONAS,say}=require('./voice.cjs');
const {pendingTodos}=require('./todos.cjs');
const CHATTINESS=['quiet','normal','chatty'];
const defaults = {start:'09:00',end:'18:00',days:[1,2,3,4,5],reminders:true,
  systemNotifications:false,edgePlay:true,roam:true,workAware:true,nickname:'',call:'nim',persona:'janmang',chattiness:'chatty',
  lunch:false,lunchStart:'12:00',lunchEnd:'13:00',focus:false,focusStart:'14:00',focusEnd:'16:00',
  wrapMinutes:15,corner:'br',reportAuto:false,planTomorrow:true,leaveBadge:false};
const CORNERS=['br','bl','tr','tl'], WRAP_MINUTES=[10,15,30];
const pad = n => String(n).padStart(2,'0');
const TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
function dayKey(date) { return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-'); }
function nextWorkDay(key,days) {
  const [y,m,d]=key.split('-').map(Number);
  for(let i=1;i<=7;i++){
    const next=new Date(y,m-1,d+i,12);
    if(days.includes(next.getDay()))return dayKey(next);
  }
  return dayKey(new Date(y,m-1,d+1,12));
}
function validateSettings(s) {
  for (const k of ['start','end']) if (!TIME.test(s[k])) throw Error('출퇴근 시각을 확인해 주세요.');
  if (s.start===s.end) throw Error('출근과 퇴근 시각을 다르게 정해 주세요.');
  if (!Array.isArray(s.days)||!s.days.length||s.days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw Error('근무 요일을 선택해 주세요.');
  const out = {start:s.start,end:s.end,days:[...new Set(s.days)].sort()};
  for (const k of ['reminders','systemNotifications','edgePlay','roam','workAware','lunch','focus','reportAuto','planTomorrow','leaveBadge']) {
    if(typeof s[k]!=='boolean') throw Error('설정값을 확인해 주세요.');
    out[k]=s[k];
  }
  const nickname=String(s.nickname??'').trim();
  if(nickname.length>12 || /[\u0000-\u001f]/.test(nickname)) throw Error('이름은 12자까지 적어 주세요.');
  out.nickname=nickname;
  if(!CALLS.includes(s.call)) throw Error('부르는 방식을 골라 주세요.');
  if(!PERSONAS.includes(s.persona)) throw Error('루피 말투를 골라 주세요.');
  if(!CHATTINESS.includes(s.chattiness)) throw Error('수다 레벨을 골라 주세요.');
  Object.assign(out,{call:s.call,persona:s.persona,chattiness:s.chattiness});
  if(!TIME.test(s.lunchStart)||!TIME.test(s.lunchEnd)) throw Error('점심시간을 확인해 주세요.');
  if(s.lunch && s.lunchStart>=s.lunchEnd) throw Error('점심이 끝나는 시각을 시작보다 늦게 정해 주세요.');
  Object.assign(out,{lunchStart:s.lunchStart,lunchEnd:s.lunchEnd});
  if(!TIME.test(s.focusStart)||!TIME.test(s.focusEnd)) throw Error('집중 시간을 확인해 주세요.');
  if(s.focus && s.focusStart>=s.focusEnd) throw Error('집중 시간이 끝나는 시각을 시작보다 늦게 정해 주세요.');
  if(!WRAP_MINUTES.includes(s.wrapMinutes)) throw Error('마무리 알림 시점을 골라 주세요.');
  if(!CORNERS.includes(s.corner)) throw Error('루피 자리를 골라 주세요.');
  Object.assign(out,{focusStart:s.focusStart,focusEnd:s.focusEnd,wrapMinutes:s.wrapMinutes,corner:s.corner});
  return out;
}
function at(date, hhmm, offset) {
  const d=new Date(date);
  d.setDate(d.getDate()+offset);
  const [h,m]=hhmm.split(':').map(Number);
  d.setHours(h,m,0,0);
  return d;
}
const toMinutes=hhmm=>{const [h,m]=String(hhmm).split(':').map(Number);return h*60+m;};
// the shifts that started today or yesterday on a work day; a shift past midnight ends the next day
function* shifts(now,s) {
  for(const offset of [0,-1]) {
    const start=at(now,s.start,offset);
    if(s.days.includes(start.getDay()))yield {key:dayKey(start),start,end:at(now,s.end,offset+(s.end<s.start?1:0))};
  }
}
function shift(now,s) {
  for(const {key,start,end} of shifts(now,s))
    if(now>=start && now.getTime()<end.getTime()+15*60000)
      return {key,minutes:Math.floor((now-start)/60000),left:Math.ceil((end-now)/60000)};
  return null;
}
function timeWindow(now,on,from,to) {
  if(!on)return null;
  const start=at(now,from,0), end=at(now,to,0);
  if(now<start)return null;
  if(now<end)return now-start<5*60000?'start':'during';
  return now-end<5*60000?'end':null;
}
const lunchPhase=(now,s)=>timeWindow(now,s.lunch,s.lunchStart,s.lunchEnd);
const focusPhase=(now,s)=>timeWindow(now,s.focus,s.focusStart,s.focusEnd);
const active=phase=>phase==='start'||phase==='during';
const inFocus=(now,s)=>active(focusPhase(now,s));
const inLunch=(now,s)=>active(lunchPhase(now,s));
const hourMoods = ['typing','coffee','filing','write','typing','coffee'];
function routine(now, state) {
  const s=state.settings, work=shift(now,s);
  if (!work || +now<state.snoozeUntil) return null;
  const pending=pendingTodos(state.todos,work.key);
  const carry=pending.filter(t=>t.day&&t.day<work.key).length;
  const planned=state.todos.some(t=>t.day===work.key);
  const event=(id,motion,line,notify=true,extra={})=>({id:work.key+'/'+id,motion,line,notify,...extra});
  if(work.left<=0) return s.reminders ? event('leave','pack',say('leave',s),true,{talk:'leave'}) : null;
  if(work.left<=s.wrapMinutes && s.reminders) {
    if(!state.seen[work.key+'/wrap']) return pending.length
      ? event('wrap','filing',say('wrapLeft',s,pending.length),true,{talk:'wrap'})
      : event('wrap','clock',say('wrapDone',s));
    return s.planTomorrow&&!state.seen[work.key+'/plan'] ? event('plan','write',say('planAsk',s),true,{talk:'plan'}) : null;
  }
  if(work.minutes<30 && s.reminders) return planned
    ? (s.planTomorrow&&pending.length ? event('start','todo',say('startReady',s),true,{talk:'brief'}) : event('start','wave',say('startReady',s)))
    : event('start','write',say('startEmpty',s),true,{talk:'morning',carry});
  const focus=focusPhase(now,s);
  if(focus==='start') return event('focus-start','shh',say('focusStart',s),false);
  if(focus==='end') return event('focus-end','wave',say('focusEnd',s),false);
  if(focus) return null;
  const lunch=lunchPhase(now,s);
  if(lunch==='start') return s.reminders ? event('lunch-start','lunch',say('lunchStart',s),false) : null;
  if(lunch==='end') return s.reminders ? event('lunch-end','iced',say('afterLunch',s,now.getDate()),false,{fallback:'coffee'}) : null;
  if(lunch || now.getMinutes()>=5) return null;
  const h=now.getHours();
  if(s.reminders && !planned && !state.seen[work.key+'/todo-check'] && !state.seen[work.key+'/start'])
    return event('todo-check','write',say('startEmpty',s),true,{talk:'morning',carry});
  if(s.chattiness==='quiet' || (s.chattiness==='normal' && h%2)) return null;
  const motion=hourMoods[h%hourMoods.length];
  return event('hour-'+h,motion,s.reminders?say(motion,s):'',false);
}
module.exports={defaults,CHATTINESS,TIME,pad,at,toMinutes,dayKey,nextWorkDay,shifts,shift,validateSettings,routine,inFocus,inLunch};
