// Idle play: while Loopy has nothing to say during work hours, it now and then picks up a small
// motion on its own (coffee, stretch, water...) and, when chattiness allows, says a short line.
// Time and randomness are passed in so the schedule can be tested.
const SEC=1000, MIN=60*SEC;
// wait between idle beats, [shortest, longest], by chattiness
const GAPS={quiet:[6*MIN,10*MIN],normal:[50*SEC,100*SEC],chatty:[25*SEC,50*SEC]};
// share of beats that come with a line
const LINE_CHANCE={quiet:0,normal:0.35,chatty:0.6};
const NAME_CHANCE=0.3;
// at most this often, a line beat says how long until the end of the shift instead
const TELL_EVERY={normal:30*MIN,chatty:20*MIN};
// how long a silent motion stays before Loopy goes back to standing
const HOLD=20*SEC;
// only full-body motions that read well with no context (no peek, grab, pack, overtime...)
const POOLS={
  morning:['coffee','stretch','water','write','typing','look'],
  work:['typing','filing','write','water','coffee','look','shh','stretch','sit'],
  afternoon:['iced','stretch','bored','doze','water','typing','look','sit','filing'],
  lunch:['lunch','iced','sit','doze'],
  wrap:['clock','filing','stretch','water']
};
const minutesOf=hhmm=>{const [h,m]=String(hhmm).split(':').map(Number);return h*60+m;};
function inLunch(date,s){
  if(!s.lunch)return false;
  const t=date.getHours()*60+date.getMinutes();
  return t>=minutesOf(s.lunchStart)&&t<minutesOf(s.lunchEnd);
}
function poolFor(date,work,s){
  if(work.left<=30)return POOLS.wrap;
  if(inLunch(date,s))return POOLS.lunch;
  if(work.minutes<90)return POOLS.morning;
  return date.getHours()>=14?POOLS.afternoon:POOLS.work;
}
function gapFor(chattiness,roll,gaps=GAPS){
  const [lo,hi]=gaps[chattiness]||gaps.normal;
  return lo+(hi-lo)*roll;
}
// tick(now, {work, settings, canTalk}) runs on every routine check. It returns
//   null                      nothing to do (Loopy stands as usual)
//   {motion}                  show this motion quietly instead of standing
//   {motion, line, n, named}  play the motion with an idle line (line index n, name in front if named)
//   {motion:'clock', line, left} say how many minutes are left until the end of the shift
// Pass work=null whenever Loopy is busy, off shift or should stay still: the current motion ends and
// the next beat waits until Loopy is free again.
function createIdle({gaps=GAPS,has=()=>true}={}){
  let at=0, roll=0.5, play=null, last='', told=0;
  return {
    tick(now,{work,settings={},canTalk=false},rand=Math.random){
      if(!work||work.left<=0){play=null;return null;}
      if(play&&now<play.until)return {motion:play.motion};
      play=null;
      if(!at){at=now;roll=rand();return null;}
      const chattiness=settings.chattiness||'normal';
      if(now-at<gapFor(chattiness,roll,gaps))return null;
      at=now;roll=rand();
      const date=new Date(now);
      const pool=poolFor(date,work,settings).filter(m=>m!==last&&has(m));
      if(!pool.length)return null;
      const motion=pool[Math.floor(rand()*pool.length)%pool.length];
      last=motion;
      if(canTalk&&rand()<(LINE_CHANCE[chattiness]??0)){
        if(TELL_EVERY[chattiness]&&now-told>=TELL_EVERY[chattiness]&&has('clock')){told=now;last='clock';return {motion:'clock',line:true,left:work.left};}
        return {motion,line:true,n:Math.floor(rand()*1000),named:rand()<NAME_CHANCE};
      }
      play={motion,until:now+HOLD};
      return {motion};
    }
  };
}
module.exports={GAPS,LINE_CHANCE,TELL_EVERY,POOLS,HOLD,gapFor,poolFor,createIdle};
