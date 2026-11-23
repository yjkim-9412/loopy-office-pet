const defaults = {start:'09:00',end:'18:00',days:[1,2,3,4,5],hourly:true,reminders:true,
  systemNotifications:false,edgePlay:true};
const pad = n => String(n).padStart(2,'0');
function dayKey(date) { return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-'); }
function validateSettings(s) {
  for (const k of ['start','end']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k])) throw Error('출퇴근 시각을 확인해 주세요.');
  if (s.start===s.end) throw Error('출근과 퇴근 시각을 다르게 정해 주세요.');
  if (!Array.isArray(s.days)||!s.days.length||s.days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw Error('근무 요일을 선택해 주세요.');
  const out = {start:s.start,end:s.end,days:[...new Set(s.days)].sort()};
  for (const k of ['hourly','reminders','systemNotifications','edgePlay']) {
    if(typeof s[k]!=='boolean') throw Error('설정값을 확인해 주세요.');
    out[k]=s[k];
  }
  return out;
}
function at(date, hhmm, offset) {
  const d=new Date(date);
  d.setDate(d.getDate()+offset);
  const [h,m]=hhmm.split(':').map(Number);
  d.setHours(h,m,0,0);
  return d;
}
function shift(now,s) {
  for(const offset of [0,-1]) {
    const start=at(now,s.start,offset);
    const end=at(now,s.end,offset+(s.end<s.start?1:0));
    if(s.days.includes(start.getDay()) && now>=start && now.getTime()<end.getTime()+15*60000)
      return {key:dayKey(start),minutes:Math.floor((now-start)/60000),left:Math.ceil((end-now)/60000)};
  }
  return null;
}
const hourMoods = ['typing','coffee','filing','write','typing','coffee'];
function routine(now, state) {
  const s=state.settings, work=shift(now,s);
  if (!work || +now<state.snoozeUntil) return null;
  const pending=state.todos.filter(t=>!t.done);
  const planned=state.todos.some(t=>t.day===work.key);
  const event=(id,motion,line,notify=true)=>({id:work.key+'/'+id,motion,line,notify});
  if(work.left<=0) return s.reminders ? event('leave','pack','오늘도 고생했어 룹! 가방 챙겼어 룹?') : null;
  if(work.left<=15 && s.reminders) return pending.length
    ? event('wrap','filing',`남은 TODO ${pending.length}개, 퇴근 전에 정리할까 룹?`)
    : event('wrap','clock','할 일 다 끝났어 룹! 퇴근까지 조금만 기다릴까 룹?');
  if(work.minutes<30 && s.reminders) return planned
    ? event('start','wave','오늘 할 일이 준비됐어 룹!')
    : event('start','write','오늘 TODO는 작성 했어 룹?');
  if(now.getMinutes()>=5) return null;
  const h=now.getHours();
  if(s.reminders && !planned && !state.seen[work.key+'/todo-check'] && !state.seen[work.key+'/start'])
    return event('todo-check','write','오늘 TODO는 작성 했어 룹?');
  if(!s.hourly) return null;
  const motion=hourMoods[h%hourMoods.length];
  const hourlyLines={coffee:'잠깐 커피 한 모금 할까 룹?',typing:'다음 할 일에 집중해 볼까 룹?',
    filing:'끝낸 일 하나 정리해 볼까 룹?',write:'새로 떠오른 할 일이 있어 룹?'};
  return event('hour-'+h,motion,s.reminders?hourlyLines[motion]:'',false);
}
module.exports={defaults,dayKey,shift,validateSettings,routine};
