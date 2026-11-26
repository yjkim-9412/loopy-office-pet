import {useState} from 'react';
import {callName} from '../app/voice.cjs';
import {LoopyArt,Segmented,Days,DAY_NAMES} from './parts';

type Repeat='workdays'|'daily'|'days'|'interval'|'once';
export type Routine={id:string;title:string;time:string;repeat:Repeat;days:number[];every:number;until:string;
  motion:string;line:string;on:boolean;date:string};
type Draft=Omit<Routine,'id'|'on'|'date'>;
type Props={routines:Routine[];motions:Record<string,string>;routineMotions:string[];nickname:string;call:'nim'|'ssi'|'a';
  run:(a:string,v?:unknown)=>Promise<boolean>};

const REPEATS:[Repeat,string][]=[['workdays','근무일마다'],['daily','매일'],['days','요일 고르기'],['interval','몇 시간마다'],['once','오늘 한 번']];
const PRESETS:Draft[]=[
  {title:'물 마시기',time:'10:00',repeat:'interval',days:[],every:2,until:'17:00',motion:'water',line:''},
  {title:'스트레칭',time:'15:00',repeat:'workdays',days:[],every:2,until:'',motion:'stretch',line:''},
  {title:'점심 먹기',time:'12:00',repeat:'workdays',days:[],every:2,until:'',motion:'lunch',line:''}
];

function describe(r:Routine){
  if(r.repeat==='interval')return `${r.time}–${r.until} · ${r.every}시간마다`;
  if(r.repeat==='days')return `매주 ${r.days.map(d=>DAY_NAMES[d]).join('·')} ${r.time}`;
  return `${Object.fromEntries(REPEATS)[r.repeat]} ${r.time}`;
}

export function Routines({routines,motions,routineMotions,nickname,call,run}:Props){
  const blank:Draft={title:'',time:'11:00',repeat:'workdays',days:[1],every:2,until:'17:00',motion:routineMotions[0]||'wave',line:''};
  const [draft,setDraft]=useState<Draft>(blank);
  const [adding,setAdding]=useState(routines.length===0);
  const change=<K extends keyof Draft>(key:K,v:Draft[K])=>setDraft({...draft,[key]:v});
  const who=callName(nickname,call)||'호칭';
  return <section className="routines">
    <div className="section-head">
      <div><h2>내 루틴</h2><small className="hint">시간이 되면 루피가 말풍선으로 챙겨 줘요.</small></div>
      <button type="button" className="primary small" onClick={()=>setAdding(!adding)}>{adding?'닫기':'루틴 추가'}</button>
    </div>

    {routines.length===0&&<div className="card presets">
      <strong>이런 루틴은 어때뤂?</strong>
      <div className="row wrap">{PRESETS.filter(p=>motions[p.motion]).map(p=>
        <button key={p.title} type="button" className="secondary small" onClick={()=>run('routineAdd',{...p,on:true})}>{p.title} 추가</button>)}</div>
    </div>}

    <ul className="routine-list">{routines.map(r=><li className={'card routine'+(r.on?'':' off')} key={r.id}>
      <LoopyArt art={[]} sheet={motions[r.motion]?r.motion:'wave'} label="" className="routine-art"/>
      <div className="routine-text">
        <div><strong>{r.time}</strong> {r.title}</div>
        <small>{describe(r)} · {motions[r.motion]||r.motion}{r.line?` · “${r.line}”`:''}</small>
      </div>
      <button type="button" className="link" onClick={()=>run('routineTry',r.id)}>미리 보기</button>
      <label className="switch inline"><input type="checkbox" role="switch" aria-label={`${r.title} 루틴 켜기`} checked={r.on} onChange={()=>run('routineToggle',r.id)}/></label>
      <button type="button" className="icon" aria-label={`${r.title} 루틴 지우기`} onClick={()=>run('routineDelete',r.id)}>×</button>
    </li>)}</ul>

    {adding&&<form className="card routine-form" onSubmit={async e=>{e.preventDefault();
      if(await run('routineAdd',{...draft,on:true})){setDraft(blank);setAdding(false);}}}>
      <h2>새 루틴 만들기</h2>
      <div className="times">
        <label className="field">이름<input required maxLength={30} placeholder="예: 비타민 먹기" value={draft.title} onChange={e=>change('title',e.target.value)}/></label>
        <label className="field">{draft.repeat==='interval'?'시작 시각':'시각'}<input required type="time" value={draft.time} onChange={e=>change('time',e.target.value)}/></label>
      </div>
      <Segmented label="반복" value={draft.repeat} options={REPEATS} onChange={v=>change('repeat',v)}/>
      {draft.repeat==='days'&&<Days label="요일" value={draft.days} onChange={v=>change('days',v)}/>}
      {draft.repeat==='interval'&&<div className="times">
        <label className="field">간격<select value={draft.every} onChange={e=>change('every',Number(e.target.value))}>
          {[1,2,3,4].map(n=><option key={n} value={n}>{n}시간마다</option>)}</select></label>
        <label className="field">끝나는 시각<input required type="time" value={draft.until} onChange={e=>change('until',e.target.value)}/></label>
      </div>}
      <fieldset className="field"><legend>루피 동작</legend><div className="motion-grid">{routineMotions.map(m=>
        <button key={m} type="button" aria-pressed={draft.motion===m} onClick={()=>change('motion',m)}>
          <LoopyArt art={[]} sheet={m} label="" className="thumb"/>{motions[m]}</button>)}</div></fieldset>
      <label className="field">말풍선 한마디
        <input maxLength={60} placeholder={'{호칭}, 물 한 잔 마셔뤂!'} value={draft.line} onChange={e=>change('line',e.target.value)}/>
        <small className="hint">{'{호칭}'} 자리에는 ‘{who}’이 들어가요. 비워 두면 말투에 맞춰 루피가 골라요.</small>
      </label>
      <div className="row"><button type="button" className="secondary" onClick={()=>{setDraft(blank);setAdding(false);}}>취소</button>
        <button className="primary">루틴 저장</button></div>
    </form>}
  </section>;
}
