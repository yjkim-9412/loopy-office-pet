import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
type Settings={start:string;end:string;days:number[];hourly:boolean;reminders:boolean;systemNotifications:boolean;edgePlay:boolean};
type State={settings:Settings;todos:{id:string;title:string;day:string;done:boolean;doneDay:string|null}[];
  today:string;login:boolean;packaged:boolean;snoozeUntil:number;autoError:string;motions:Record<string,string>};
declare global { interface Window {office:{read():Promise<State>;subscribe(fn:(data:State)=>void):()=>void;command(a:string,v?:unknown):Promise<State>}}}
function SettingsForm({state,run}:{state:State;run:(a:string,v?:unknown)=>Promise<boolean>}){
  const [draft,setDraft]=useState<Settings>(state.settings);
  const [saved,setSaved]=useState(false);
  function change<K extends keyof Settings>(key:K,v:Settings[K]){setDraft({...draft,[key]:v});setSaved(false);}
  const flags=[['hourly','정각마다 모션 바꾸기'],['reminders','출근·업무 정리·퇴근 말풍선'],
    ['systemNotifications','말풍선과 함께 시스템 알림 받기'],['edgePlay','Finder·파일 탐색기 창에서 놀기']] as const;
  return <section><h2>근무 일정</h2><form onSubmit={async e=>{e.preventDefault();setSaved(await run('settings',draft));}}>
    <div className="times"><label>출근<input required type="time" value={draft.start} onChange={e=>change('start',e.target.value)}/></label>
    <label>퇴근<input required type="time" value={draft.end} onChange={e=>change('end',e.target.value)}/></label></div>
    <fieldset><legend>근무 요일</legend><div className="days">{[1,2,3,4,5,6,0].map(i=><button key={i} type="button" aria-pressed={draft.days.includes(i)} onClick={()=>change('days',draft.days.includes(i)?draft.days.filter(d=>d!==i):[...draft.days,i])}>{'일월화수목금토'[i]}</button>)}</div></fieldset>
    <h2>루피의 행동</h2>{flags.map(([key,label])=><label className="switch" key={key}>{label}<input type="checkbox" checked={draft[key]} onChange={e=>change(key,e.target.checked)}/></label>)}
    <button className="primary save" type="submit">{saved?'저장됨':'설정 저장'}</button></form>
    <h2>시작 프로그램</h2><label className="switch">로그인할 때 루피 실행<input type="checkbox" checked={state.login} disabled={!state.packaged} onChange={e=>run('login',e.target.checked)}/></label>
    {!state.packaged&&<small>설치한 앱에서 켤 수 있어요.</small>}{state.autoError&&<small>{state.autoError}</small>}</section>;
}
function Office(){
  const [state,setState]=useState<State|null>(null),[page,setPage]=useState('오늘'),[text,setText]=useState(''),[error,setError]=useState('');
  useEffect(()=>{const off=window.office.subscribe(setState);window.office.read().then(setState).catch(e=>setError(e.message));return off;},[]);
  async function run(a:string,v?:unknown){
    try{setError('');setState(await window.office.command(a,v));return true;}
    catch(e){setError(String(e instanceof Error?e.message:e).replace(/^Error invoking remote method '[^']+': (Error: )?/,''));return false;}
  }
  if(!state)return <p role="status">{error||'업무 수첩 여는 중…'}</p>;
  const todos=state.todos.filter(t=>!t.done||t.doneDay===state.today);
  const complete=todos.filter(t=>t.done).length,quiet=state.snoozeUntil>Date.now();
  const stamp=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date(state.today+'T12:00:00'));
  return <><header><div><p className="date">{stamp}</p><h1>루피의 업무 수첩</h1></div><img src="../assets/brand/icon.png" alt="손인사하는 루피"/></header>
    <nav aria-label="업무 수첩">{['오늘','모션','설정'].map(item=><button key={item} aria-current={page===item?'page':undefined} onClick={()=>{setPage(item);setError('');}}>{item}</button>)}</nav>
    {error&&<p className="error" role="alert">{error}</p>}
    {page==='오늘'&&<section><div className="section-heading"><h2>오늘의 TODO</h2><span>{complete} / {todos.length} 완료</span></div>
      <form className="add" onSubmit={async e=>{e.preventDefault();if(text.trim()&&await run('add',text))setText('');}}>
        <input aria-label="새 할 일" maxLength={160} placeholder="새로운 할 일" value={text} onChange={e=>setText(e.target.value)}/><button className="primary" disabled={!text.trim()}>추가</button></form>
      {!todos.length&&<div className="empty">오늘 TODO는 작성 했어 룹?</div>}
      <ul>{todos.map(t=><li key={t.id}><label><input type="checkbox" checked={t.done} onChange={()=>run('toggle',t.id)}/><span className={t.done?'done':''}>{t.title}</span>
        {t.day!==state.today&&!t.done&&<small>이월</small>}</label></li>)}</ul>
      <footer><span>{quiet?'알림 쉬는 중':'업무 알림'}</span><button onClick={()=>run(quiet?'unsnooze':'snooze')}>{quiet?'알림 다시 받기':'한 시간 쉬기'}</button></footer></section>}
    {page==='모션'&&<section><h2>루피 모션 재생</h2><div className="gallery">{Object.entries(state.motions).map(([id,label])=><button key={id} onClick={()=>run('preview',id)}><span className="thumb"><img alt="" src={'../assets/motions/'+id+'.png'}/></span>{label}</button>)}</div></section>}
    {page==='설정'&&<SettingsForm state={state} run={run}/>}</>;
}
createRoot(document.getElementById('root')!).render(<Office/>);
