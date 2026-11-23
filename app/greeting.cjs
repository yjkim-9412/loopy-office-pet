// Picks the notebook's greeting from what is actually going on: day off, before work, lunch,
// focus time, how far today's to-dos have come, the wrap-up window, after work or late at night.
const {shift,inFocus}=require('./routine.cjs');

const GREETING_KEYS=['greetEarly','greetMorning','greetWork','greetEmpty','greetAllDone','greetWrap','greetLunch',
  'greetFocus','greetSnooze','greetAfter','greetAfterNone','greetOff','greetLate'];
const SHEET={greetEarly:'wave',greetMorning:'wave',greetWork:'typing',greetEmpty:'write',greetAllDone:'celebrate',
  greetWrap:'clock',greetLunch:'lunch',greetFocus:'shh',greetSnooze:'sit',greetAfter:'pack',greetAfterNone:'pack',
  greetOff:'sit',greetLate:'doze'};

function clock(now,hhmm) {
  const d=new Date(now), [h,m]=hhmm.split(':').map(Number);
  d.setHours(h,m,0,0);
  return d;
}

function greetingFor({settings:s,todos,today,snoozeUntil=0},now) {
  const out=(key,n)=>({key,n,sheet:SHEET[key],frame:0});
  const hour=now.getHours();
  const doneToday=todos.filter(t=>t.done&&t.doneDay===today).length;
  if(+now<snoozeUntil)return out('greetSnooze');
  const work=shift(now,s);
  if(!work||work.left<=0){
    if(hour>=22||hour<5)return out('greetLate');
    if(!s.days.includes(now.getDay()))return out('greetOff');
    if(now<clock(now,s.start))return out('greetEarly');
    return out(doneToday?'greetAfter':'greetAfterNone');
  }
  if(inFocus(now,s))return out('greetFocus');
  if(s.lunch&&now>=clock(now,s.lunchStart)&&now<clock(now,s.lunchEnd))return out('greetLunch');
  const list=todos.filter(t=>(t.day??today)<=today&&(!t.done||t.doneDay===today));
  const left=list.filter(t=>!t.done).length;
  if(!list.length)return out('greetEmpty');
  if(!left)return out('greetAllDone');
  if(work.left<=s.wrapMinutes)return out('greetWrap',work.left);
  if(!doneToday&&work.minutes<120)return out('greetMorning');
  return {...out('greetWork',left),sheet:hour>=14?'coffee':'typing'};
}

module.exports={GREETING_KEYS,greetingFor};
