import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {callName,say} from '../app/voice.cjs';
import {visibleTodos} from '../app/talk.cjs';
import {LoopyArt,Check,Segmented,Switch} from './parts';
import {Routines,type Routine} from './routines';
import {Report} from './report';
import {greetingFor} from '../app/greeting.cjs';
type Persona='janmang'|'dadeong'|'calm';
type Chattiness='quiet'|'normal'|'chatty';
type Settings={start:string;end:string;days:number[];reminders:boolean;systemNotifications:boolean;edgePlay:boolean;roam:boolean;workAware:boolean;
  nickname:string;call:'nim'|'ssi'|'a';persona:Persona;chattiness:Chattiness;lunch:boolean;lunchStart:string;lunchEnd:string;
  focus:boolean;focusStart:string;focusEnd:string;wrapMinutes:number;corner:'br'|'bl'|'tr'|'tl';reportAuto:boolean;planTomorrow:boolean;leaveBadge:boolean};
type Todo={id:string;title:string;day:string;done:boolean;doneDay:string|null;focus?:boolean};
type Buddy={id:string;pattern:'follow'|'wander'|'copy'|'nap'};
type State={settings:Settings;todos:Todo[];today:string;login:boolean;packaged:boolean;snoozeUntil:number;autoError:string;buddies?:Buddy[];
  motions:Record<string,string>;art:string[];carryDismissed:string;routines?:Routine[];routineMotions?:string[]};
type Run=(a:string,v?:unknown)=>Promise<boolean>;
declare global { interface Window {office:{read():Promise<State>;subscribe(fn:(data:State)=>void):()=>void;onPage(fn:(page:string)=>void):()=>void;
  command(a:string,v?:unknown):Promise<State>}}}

function greeting(state:State){
  const g=greetingFor(state,new Date());
  const text=say(g.key,state.settings,g.n);
  const sheet=state.motions[g.sheet]?g.sheet:'wave';
  return {text:text.replace(', ',',\n'),sheet,frame:g.frame};
}

function Today({state,run,onReport}:{state:State;run:Run;onReport:()=>void}){
  const [text,setText]=useState('');
  const list=visibleTodos(state.todos,state.today) as Todo[];
  const focus=list.find(t=>t.focus);
  const rows=list.filter(t=>t!==focus);
  const done=list.filter(t=>t.done).length,left=list.length-done;
  const carry=state.todos.filter(t=>!t.done&&t.day<state.today);
  const quiet=state.snoozeUntil>Date.now();
  const stampArt=state.art.includes('stamp-loopy');
  const chat={quiet:'조용히',normal:'적당히',chatty:'수다쟁이'}[state.settings.chattiness];
  return <section className="today">
    {carry.length>0&&state.carryDismissed!==state.today&&<div className="card carry">
      <div className="card-head"><strong>어제 남은 일 {carry.length}개가 있뤂</strong>
        <span>{carry.slice(0,2).map(t=>t.title).join(' · ')}{carry.length>2?' 외':''}</span></div>
      <div className="row"><button className="primary" onClick={()=>run('carry')}>오늘로 가져오기</button>
        <button className="secondary" onClick={()=>run('keepCarry')}>그대로 둘게</button></div></div>}

    {list.length>0&&<div className="card stamps">
      <div className="card-head"><strong>오늘의 도장판</strong><span className="count">{done} / {list.length}</span></div>
      <div className="stamp-row" aria-hidden="true">{list.slice(0,12).map((t,i)=><span key={t.id} className={i<done?'stamp on':'stamp'}>
        {i<done&&(stampArt?<img src="../assets/ui/stamp-loopy.png" alt=""/>:'뤂')}</span>)}
        {list.length>12&&<span className="more">+{list.length-12}</span>}</div>
      <p>{left?`${left}개만 더 하면 오늘 도장판 완성이뤂!`:'도장판 완성! 오늘 정말 잘했뤂!'}</p></div>}

    {focus&&<div className="card focus">
      <svg className="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>
      <div className="focus-text"><small>오늘의 한 가지</small><strong className={focus.done?'done':''}>{focus.title}</strong></div>
      <Check done={focus.done} label={focus.done?focus.title+' 완료 취소':focus.title+' 완료'} onClick={()=>run('toggle',focus.id)}/></div>}

    <form className="add" onSubmit={async e=>{e.preventDefault();if(text.trim()&&await run('add',text))setText('');}}>
      <input aria-label="새 할 일" maxLength={160} placeholder="새로운 할 일을 적어 줘뤂" value={text} onChange={e=>setText(e.target.value)}/>
      <button className="primary" disabled={!text.trim()}>적기</button></form>

    {!list.length&&<div className="empty">
      <LoopyArt art={state.art} name="empty-notebook" sheet="todo" frame={0} label="수첩을 든 루피" className="empty-art"/>
      <p className="say">{say('startEmpty',state.settings)}</p>
      <small>화면의 루피를 눌러서 말풍선으로 적어도 돼요.</small></div>}

    <ul className="todos">{rows.map(t=><li key={t.id}>
      <Check done={t.done} label={t.done?t.title+' 완료 취소':t.title+' 완료'} onClick={()=>run('toggle',t.id)}/>
      <span className={t.done?'title done':'title'}>{t.title}</span>
      {t.day<state.today&&!t.done&&<span className="tag">이월</span>}
      {!t.done&&<button type="button" className="pin" aria-pressed={false} aria-label={t.title+'을 오늘의 한 가지로 정하기'} onClick={()=>run('focus',t.id)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg></button>}
    </li>)}</ul>
    {focus&&<button type="button" className="link" onClick={()=>run('focus',focus.id)}>오늘의 한 가지 해제</button>}

    <footer><span>{quiet?'알림 쉬는 중':`업무 알림 켜짐 · 수다 레벨 ${chat}`}</span>
      <div className="row"><button className="secondary small" onClick={onReport}>오늘 리포트</button>
        <button className="secondary small" onClick={()=>run(quiet?'unsnooze':'snooze')}>{quiet?'알림 다시 받기':'한 시간 쉬기'}</button></div></footer>
  </section>;
}

function SettingsForm({state,run}:{state:State;run:Run}){
  const [draft,setDraft]=useState<Settings>(state.settings);
  useEffect(()=>{setDraft(d=>({...d,roam:state.settings.roam}));},[state.settings.roam]);
  const [saved,setSaved]=useState(false);
  function change<K extends keyof Settings>(key:K,v:Settings[K]){setDraft({...draft,[key]:v});setSaved(false);}
  const name=draft.nickname.trim()||'말랑';
  const calls:[Settings['call'],string][]=[['nim',callName(name,'nim')],['ssi',callName(name,'ssi')],['a',callName(name,'a')]];
  return <section className="settings"><form onSubmit={async e=>{e.preventDefault();setSaved(await run('settings',draft));}}>
    <div className="card">
      <h2>루피와 나</h2>
      <label className="field">부르는 이름<input maxLength={12} placeholder="이름이나 별명" value={draft.nickname} onChange={e=>change('nickname',e.target.value)}/></label>
      <Segmented label="부르는 방식" value={draft.call} options={calls} onChange={v=>change('call',v)}/>
      <Segmented label="말투" value={draft.persona} options={[['janmang','잔망'],['dadeong','다정'],['calm','차분']]} onChange={v=>change('persona',v)}/>
      <p className="preview-bubble">{say('menu',draft)}</p>
      <Segmented label="수다 레벨" value={draft.chattiness} options={[['quiet','조용히'],['normal','적당히'],['chatty','수다쟁이']]} onChange={v=>change('chattiness',v)}/>
      <small className="hint">{{quiet:'출퇴근 인사와 아침·퇴근 확인만 해요.',normal:'두 시간에 한 번 모션을 바꾸고 한마디 해요.',chatty:'매 정각마다 한마디 해요.'}[draft.chattiness]}</small>
    </div>
    <div className="card">
      <h2>근무 일정</h2>
      <div className="times"><label className="field">출근<input required type="time" value={draft.start} onChange={e=>change('start',e.target.value)}/></label>
        <label className="field">퇴근<input required type="time" value={draft.end} onChange={e=>change('end',e.target.value)}/></label></div>
      <fieldset className="field"><legend>근무 요일</legend><div className="days">{[1,2,3,4,5,6,0].map(i=><button key={i} type="button" aria-pressed={draft.days.includes(i)}
        onClick={()=>change('days',draft.days.includes(i)?draft.days.filter(d=>d!==i):[...draft.days,i])}>{'일월화수목금토'[i]}</button>)}</div></fieldset>
      <Switch label="점심시간 알려 주기" hint="점심엔 조용히, 끝나면 꾸벅" checked={draft.lunch} onChange={v=>change('lunch',v)}/>
      {draft.lunch&&<div className="times"><label className="field">점심 시작<input required type="time" value={draft.lunchStart} onChange={e=>change('lunchStart',e.target.value)}/></label>
        <label className="field">점심 끝<input required type="time" value={draft.lunchEnd} onChange={e=>change('lunchEnd',e.target.value)}/></label></div>}
      <Segmented label="퇴근 전 마무리 알림" value={String(draft.wrapMinutes)} options={[['10','10분 전'],['15','15분 전'],['30','30분 전']]}
        onChange={v=>change('wrapMinutes',Number(v))}/>
      <Switch label="집중 시간" hint="이 시간에는 정각 한마디와 지루함 표현을 쉬어요. 시작할 때 쉿 하고 알려 줘요" checked={draft.focus} onChange={v=>change('focus',v)}/>
      {draft.focus&&<div className="times"><label className="field">집중 시작<input required type="time" value={draft.focusStart} onChange={e=>change('focusStart',e.target.value)}/></label>
        <label className="field">집중 끝<input required type="time" value={draft.focusEnd} onChange={e=>change('focusEnd',e.target.value)}/></label></div>}
    </div>
    <div className="card">
      <h2>루피의 행동</h2>
      <Switch label="출근 · 업무 정리 · 퇴근 말풍선" checked={draft.reminders} onChange={v=>change('reminders',v)}/>
      <Switch label="말풍선과 함께 시스템 알림 받기" checked={draft.systemNotifications} onChange={v=>change('systemNotifications',v)}/>
      <Switch label="화면을 자유롭게 산책하기" hint="쉬다가 걷다가, 공중에 두면 바닥으로 폴짝 내려와요" checked={draft.roam} onChange={v=>change('roam',v)}/>
      <Switch label="파일 탐색기 · Finder 창 위에서 놀기" checked={draft.edgePlay} onChange={v=>change('edgePlay',v)}/>
      <Switch label="퇴근 전에 내일 할 일 묻고 아침에 브리핑" hint="마무리 알림 뒤에 내일 할 일을 묻고, 다음 날 출근하면 오늘 할 일을 알려 줘요" checked={draft.planTomorrow} onChange={v=>change('planTomorrow',v)}/>
      <Switch label="퇴근까지 남은 시간 항상 보기" hint="근무 시간에 루피 머리 위에 '퇴근까지 2시간 15분'처럼 작게 띄워 둬요" checked={draft.leaveBadge} onChange={v=>change('leaveBadge',v)}/>
      <Switch label="퇴근할 때 리포트 자동으로 열기" hint="오늘 해낸 일과 이번 주 도장판을 보여 줘요" checked={draft.reportAuto} onChange={v=>change('reportAuto',v)}/>
      <fieldset className="field"><legend>루피 기본 자리</legend><div className="corners">
        {([['tl','왼쪽 위'],['tr','오른쪽 위'],['bl','왼쪽 아래'],['br','오른쪽 아래']] as [Settings['corner'],string][]).map(([v,text])=>
          <button key={v} type="button" aria-pressed={draft.corner===v} onClick={()=>change('corner',v)}><span className={'corner-dot '+v} aria-hidden="true"/>{text}</button>)}
      </div><small className="hint">바꾸면 루피가 그 자리로 가요. 산책을 끄면 그 자리에 머물러요.</small></fieldset>
      <Switch label="엑셀 · 구글 문서 같은 업무 앱 알아보기" hint="오래 붙잡고 있으면 가끔 지루함을 표현해요. 창 제목은 키워드만 확인하고 저장하지 않아요" checked={draft.workAware} onChange={v=>change('workAware',v)}/>
    </div>
    <button className="primary save" type="submit">{saved?'저장했뤂!':'설정 저장'}</button></form>
    <div className="card">
      <h2>분신 루피</h2>
      <small className="hint">메인 루피와 함께 지내는 분신이에요. 분신을 누르면 반응하고, 분신을 오른쪽 클릭해도 패턴을 바꿀 수 있어요.</small>
      {(state.buddies||[]).map((b,i)=><div className="buddy" key={b.id}>
        <Segmented label={`분신 ${i+1}`} value={b.pattern} options={[['follow','따라다니기'],['wander','산책'],['copy','따라쟁이'],['nap','낮잠']]}
          onChange={v=>run('buddyPattern',{id:b.id,pattern:v})}/>
        <button type="button" className="secondary small" onClick={()=>run('buddyRemove',b.id)}>보내기</button></div>)}
      <button type="button" className="primary" disabled={(state.buddies||[]).length>=5} onClick={()=>run('buddyAdd','follow')}>
        {(state.buddies||[]).length>=5?'분신은 다섯 마리까지예요':'분신 부르기'}</button>
    </div>
    <div className="card">
      <h2>시작 프로그램</h2>
      <Switch label="로그인할 때 루피 실행" checked={state.login} disabled={!state.packaged} onChange={v=>run('login',v)}/>
      {!state.packaged&&<small className="hint">설치한 앱에서 켤 수 있어요.</small>}{state.autoError&&<small className="hint">{state.autoError}</small>}
      <button type="button" className="secondary intro" onClick={()=>run('intro')}>루피에게 다시 소개하기</button>
    </div>
    <div className="card">
      <h2>저작권</h2>
      <small className="hint">© 2026 yjkim-9412. All rights reserved.</small>
      <small className="hint">루피·잔망루피 캐릭터의 저작권과 상표권은 권리자(아이코닉스 등)에게 있어요. 이 앱은 개인이 비상업적으로 쓰는 팬 제작물이라 공개 배포나 상업적 이용을 하지 않아요.</small>
    </div></section>;
}

function Profile({state}:{state:State}){
  const s=state.settings, who=callName(s.nickname,s.call);
  const name={janmang:'잔망루피',dadeong:'다정루피',calm:'차분루피'}[s.persona];
  return <div className="card profile">
    <LoopyArt art={state.art} name={'persona-'+s.persona} sheet="wave" label={name} className="profile-art"/>
    <div><h2>{who?`${who}의 ${name}`:name}</h2><p className="preview-bubble">{say('menu',s)}</p></div>
  </div>;
}

function Office(){
  const [state,setState]=useState<State|null>(null),[page,setPage]=useState('오늘'),[error,setError]=useState('');
  useEffect(()=>{const off=window.office.subscribe(setState);window.office.read().then(setState).catch(e=>setError(e.message));return off;},[]);
  useEffect(()=>window.office.onPage?.(next=>{setPage(next==='report'?'리포트':next);setError('');}),[]);
  async function run(a:string,v?:unknown){
    try{setError('');setState(await window.office.command(a,v));return true;}
    catch(e){setError(String(e instanceof Error?e.message:e).replace(/^Error invoking remote method '[^']+': (Error: )?/,''));return false;}
  }
  if(!state)return <p role="status">{error||'업무 수첩 여는 중…'}</p>;
  const stamp=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date(state.today+'T12:00:00'));
  const hello=greeting(state);
  return <><header><div><p className="date">{stamp}</p><h1>{hello.text}</h1></div>
    <LoopyArt art={state.art} sheet={hello.sheet} frame={hello.frame} label="루피" className="hello"/></header>
    <nav aria-label="업무 수첩">{['오늘','내 루틴','나만의 루피'].map(item=><button key={item} aria-current={page===item?'page':undefined} onClick={()=>{setPage(item);setError('');}}>{item}</button>)}</nav>
    {error&&<p className="error" role="alert">{error}</p>}
    {page==='오늘'&&<Today state={state} run={run} onReport={()=>setPage('리포트')}/>}
    {page==='리포트'&&<Report state={state} run={run} onClose={()=>setPage('오늘')}/>}
    {page==='내 루틴'&&<Routines routines={state.routines||[]} motions={state.motions} routineMotions={state.routineMotions||[]}
      nickname={state.settings.nickname} call={state.settings.call} run={run}/>}
    {page==='나만의 루피'&&<section className="my-loopy">
      <Profile state={state}/>
      <SettingsForm state={state} run={run}/>
      <details className="card motions"><summary>모션 미리보기</summary><div className="gallery">{Object.entries(state.motions).map(([id,label])=>
        <button key={id} onClick={()=>run('preview',id)}><LoopyArt art={[]} sheet={id} label="" className="thumb"/>{label}</button>)}</div></details>
    </section>}</>;
}
createRoot(document.getElementById('root')!).render(<Office/>);
