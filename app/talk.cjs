const {CALLS,PERSONAS,callName,say}=require('./voice.cjs');
const {CHATTINESS}=require('./routine.cjs');
const {routineLine}=require('./routines.cjs');
const {briefLine}=require('./plan.cjs');
const overtime=require('./overtime.cjs');
const TIME=/^([01]\d|2[0-3]):[0-5]\d$/;
const STEPS=['name','call','hours','days','lunch','persona','chat'];
const PERSONA_LABELS={janmang:'잔망루피',dadeong:'다정루피',calm:'차분루피'};
const CHAT_LABELS={quiet:'조용히',normal:'적당히',chatty:'수다쟁이'};

function visibleTodos(todos,today) {
  return todos.filter(t=>(t.day??today)<=today && (!t.done || t.doneDay===today));
}
const pendingOf=ctx=>visibleTodos(ctx.todos,ctx.today).filter(t=>!t.done);
const choice=(id,label,kind='secondary',value)=>value===undefined?{id,label,kind}:{id,label,kind,value};

function open(kind,ctx,extra={}) {
  if(overtime.KINDS.has(kind))return overtime.openOvertime(kind,extra);
  if(kind==='onboard')return {kind,step:'name',draft:{},error:''};
  if(kind==='write')return {kind,count:0};
  if(kind==='morning')return {kind,carry:extra.carry??0};
  if(kind==='routine')return {kind,routine:extra.routine,slot:extra.slot};
  if(kind==='plan')return {kind,count:0};
  if(kind==='brief')return {kind,routines:extra.routines??0};
  return {kind};
}

function voiceOf(talk,ctx) {
  return talk.kind==='onboard'?{...ctx.settings,...talk.draft}:ctx.settings;
}

function onboardView(talk,s) {
  const progress={step:STEPS.indexOf(talk.step)+1,total:STEPS.length};
  const line=key=>talk.error?say(talk.error,s):say(key,s);
  switch(talk.step) {
    case 'name': return {motion:'wave',progress,line:line('askName'),
      input:{id:'name',placeholder:'이름이나 별명',max:12,submit:'좋아'},choices:[choice('skip','나중에 할래','ghost')]};
    case 'call': return {motion:'wave',progress,line:line('askCall'),
      choices:CALLS.map(c=>choice('call',callName(s.nickname,c),'secondary',c))};
    case 'hours': return {motion:'clock',progress,line:line('askHours'),
      times:{id:'hours',start:s.start,end:s.end,labels:['출근','퇴근'],submit:'다음'}};
    case 'days': return {motion:'clock',progress,line:line('askDays'),days:{id:'days',selected:s.days,submit:'다음'}};
    case 'lunch': return {motion:'coffee',progress,line:line('askLunch'),
      times:{id:'lunch',start:s.lunchStart,end:s.lunchEnd,labels:['시작','끝'],submit:'알려 줘'},
      choices:[choice('nolunch','점심 알림은 괜찮아','ghost')]};
    case 'persona': return {motion:'wave',progress,line:line('askPersona'),
      choices:PERSONAS.map(p=>choice('persona',PERSONA_LABELS[p],'secondary',p))};
    default: return {motion:'idle',progress,line:line('askChat'),
      choices:CHATTINESS.map(c=>choice('chat',CHAT_LABELS[c],'secondary',c))};
  }
}

function view(talk,ctx) {
  const s=voiceOf(talk,ctx);
  if(overtime.KINDS.has(talk.kind))return overtime.viewOvertime(talk,s);
  switch(talk.kind) {
    case 'onboard': return onboardView(talk,s);
    case 'menu': {
      const n=pendingOf(ctx).length;
      const choices=[choice('write','할 일 적기','primary')];
      if(n)choices.push(choice('list',`오늘 할 일 ${n}개 보기`));
      choices.push(choice('panel','수첩 열기'),
        ctx.snoozed?choice('unsnooze','다시 말 걸어 줘'):choice('snooze','한 시간 조용히'),
        choice('close','괜찮아','ghost'));
      return {motion:'wave',line:say('menu',s),choices};
    }
    case 'write': return {motion:'write',line:talk.count?say('writeMore',s,talk.count):say('writePrompt',s),
      input:{id:'todo',placeholder:'할 일 한 줄',max:160,submit:'적기'},choices:[choice('finish','다 적었어')]};
    case 'list': return {motion:'todo',line:say('list',s),
      todos:visibleTodos(ctx.todos,ctx.today).slice(0,6).map(t=>({id:t.id,title:t.title,done:Boolean(t.done)})),
      choices:[choice('write','할 일 적기')]};
    case 'morning': {
      const choices=[choice('write','지금 쓸게','primary')];
      if(talk.carry)choices.push(choice('carry',`어제 남은 ${talk.carry}개 가져오기`));
      choices.push(choice('pass','오늘은 패스','ghost'));
      return {motion:'write',line:say('startEmpty',s),choices};
    }
    case 'wrap': {
      const left=pendingOf(ctx);
      return {motion:'filing',line:say('wrapLeft',s,left.length),preview:left.slice(0,3).map(t=>t.title),
        choices:[choice('tomorrow','내일로 넘기기','primary'),choice('panel','수첩 열기')]};
    }
    case 'routine': return {motion:talk.routine.motion,line:routineLine(talk.routine,s),
      choices:[choice('done','같이 했어!','primary'),choice('later','10분 뒤에')]};
    case 'leave': return {motion:'pack',line:say('leave',s),
      choices:[choice('report','오늘 리포트 보기','primary'),choice('bye','내일 봐!','ghost')]};
    case 'plan': return {motion:'write',line:talk.count?say('planMore',s,talk.count):say('planAsk',s),
      input:{id:'todo',placeholder:'내일 할 일 한 줄',max:160,submit:'적기'},
      choices:talk.count?[choice('finish','다 적었어')]:[choice('skip','내일 정할게','ghost')]};
    case 'brief': return {motion:'todo',line:briefLine(s,ctx.todos,ctx.today,talk.routines),
      choices:[choice('list','할 일 보기','primary'),choice('go','좋아, 시작!','ghost')]};
    default: return {motion:'idle',line:''};
  }
}

function answerOnboard(talk,id,value,ctx) {
  const d=talk.draft;
  const next=(step,patch)=>({talk:{kind:'onboard',step,draft:{...d,...patch},error:''},effects:[]});
  const retry=(error='')=>({talk:{...talk,error},effects:[]});
  if(id==='skip')return {talk:null,effects:[{type:'onboard',settings:null}],line:say('skip',ctx.settings),motion:'wave'};
  const times=v=>v&&TIME.test(v.start)&&TIME.test(v.end)?v:null;
  switch(talk.step) {
    case 'name': {
      if(id!=='name')return retry();
      const nickname=String(value??'').trim().slice(0,12);
      return nickname?next('call',{nickname}):next('hours',{nickname:''});
    }
    case 'call': return id==='call'&&CALLS.includes(value)?next('hours',{call:value}):retry();
    case 'hours': {
      const v=id==='hours'&&times(value);
      if(!v||v.start===v.end)return retry('badHours');
      return next('days',{start:v.start,end:v.end});
    }
    case 'days': {
      const days=id==='days'&&Array.isArray(value)
        ?[...new Set(value.filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].sort():[];
      return days.length?next('lunch',{days}):retry('badDays');
    }
    case 'lunch': {
      if(id==='nolunch')return next('persona',{lunch:false});
      const v=id==='lunch'&&times(value);
      if(!v||v.start>=v.end)return retry('badLunch');
      return next('persona',{lunch:true,lunchStart:v.start,lunchEnd:v.end});
    }
    case 'persona': return id==='persona'&&PERSONAS.includes(value)?next('chat',{persona:value}):retry();
    default: {
      if(id!=='chat'||!CHATTINESS.includes(value))return retry();
      const settings={...d,chattiness:value};
      return {talk:null,effects:[{type:'onboard',settings}],line:say('greet',{...ctx.settings,...settings}),motion:'celebrate'};
    }
  }
}

function answer(talk,msg,ctx) {
  const id=msg?.id, value=msg?.value, s=voiceOf(talk,ctx);
  const stay=(t=talk)=>({talk:t,effects:[]});
  const end=(line,effects=[],motion='wave')=>({talk:null,effects,line,motion});
  if(id==='close')return {talk:null,effects:[]};
  if(overtime.KINDS.has(talk.kind))return overtime.answerOvertime(talk,id,s);
  switch(talk.kind) {
    case 'onboard': return answerOnboard(talk,id,value,ctx);
    case 'menu':
      if(id==='write')return stay(open('write',ctx));
      if(id==='list'&&pendingOf(ctx).length)return stay(open('list',ctx));
      if(id==='panel')return {talk:null,effects:[{type:'panel'}]};
      if(id==='snooze')return end(say('snooze',s),[{type:'snooze'}]);
      if(id==='unsnooze')return end(say('unsnooze',s),[{type:'unsnooze'}]);
      return stay();
    case 'write': {
      if(id==='finish')return end(talk.count?say('writeDone',s):say('bye',s),[],talk.count?'celebrate':'wave');
      const title=id==='todo'?String(value??'').trim():'';
      if(!title||title.length>160)return stay();
      return {talk:{...talk,count:talk.count+1},effects:[{type:'add',title}]};
    }
    case 'list': {
      if(id==='write')return stay(open('write',ctx));
      const task=id==='toggle'&&visibleTodos(ctx.todos,ctx.today).find(t=>t.id===value);
      if(!task)return stay();
      return {talk,effects:[{type:'toggle',id:task.id}],motion:task.done?'todo':'celebrate'};
    }
    case 'morning':
      if(id==='write')return stay(open('write',ctx));
      if(id==='carry'&&talk.carry)return end(say('carried',s,talk.carry),[{type:'carry'}],'write');
      if(id==='pass')return end(say('pass',s));
      return stay();
    case 'routine':
      if(id==='done')return end(say('routineDone',s),[{type:'routineDone',id:talk.routine.id}],'celebrate');
      if(id==='later')return end(say('routineLater',s),[{type:'routineLater',id:talk.routine.id,slot:talk.slot}]);
      return stay();
    case 'plan': {
      if(id==='finish')return end(say('planDone',s,talk.count),[],talk.count?'celebrate':'wave');
      if(id==='skip')return end(say('planSkip',s));
      const title=id==='todo'?String(value??'').trim():'';
      if(!title||title.length>160)return stay();
      return {talk:{...talk,count:talk.count+1},effects:[{type:'addTomorrow',title}]};
    }
    case 'brief':
      if(id==='list')return stay(open('list',ctx));
      if(id==='go')return end(say('briefGo',s),[],'celebrate');
      return stay();
    case 'leave':
      if(id==='report')return {talk:null,effects:[{type:'panel',page:'report'}]};
      if(id==='bye')return end(say('bye',s),[],'pack');
      return stay();
    case 'wrap':
      if(id==='tomorrow')return end(say('tomorrow',s,pendingOf(ctx).length),[{type:'tomorrow'}]);
      if(id==='panel')return {talk:null,effects:[{type:'panel'}]};
      return stay();
    default: return {talk:null,effects:[]};
  }
}

module.exports={open,view,answer,visibleTodos};
