// The end-of-day report: what got done today, what is left, and this week's stamp board
// (a work day earns a stamp when at least one to-do was finished that day).
const {dayKey}=require('./routine.cjs');
const WEEK=[1,2,3,4,5,6,0], LABELS='일월화수목금토';

function buildReport({settings,todos,today}) {
  const done=todos.filter(t=>t.done&&t.doneDay===today);
  const left=todos.filter(t=>!t.done&&(t.day??today)<=today);
  const [y,m,d]=today.split('-').map(Number);
  const back=(new Date(y,m-1,d,12).getDay()+6)%7;
  const week=WEEK.map((weekday,i)=>({weekday,key:dayKey(new Date(y,m-1,d-back+i,12))}))
    .filter(day=>settings.days.includes(day.weekday))
    .map(({weekday,key})=>({key,label:LABELS[weekday],today:key===today,future:key>today,
      stamped:todos.some(t=>t.done&&t.doneDay===key)}));
  const brief=({id,title})=>({id,title});
  return {done:done.map(brief),left:left.map(brief),stamp:done.length>0,week,
    stampedDays:week.filter(day=>day.stamped).length};
}

module.exports={buildReport};
