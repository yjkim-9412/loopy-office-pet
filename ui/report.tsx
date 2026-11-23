import {useState} from 'react';
import {buildReport} from '../app/report.cjs';
import {nextWorkDay} from '../app/routine.cjs';
import {say} from '../app/voice.cjs';
import {LoopyArt} from './parts';

type Todo={id:string;title:string;day:string;done:boolean;doneDay:string|null};
type Props={state:{settings:{start:string;end:string;days:number[];nickname:string;call:'nim'|'ssi'|'a';persona:string};todos:Todo[];today:string;art:string[]};
  run:(a:string,v?:unknown)=>Promise<boolean>;onClose:()=>void};

export function Report({state,run,onClose}:Props){
  const r=buildReport(state);
  const s=state.settings;
  const stampArt=state.art.includes('stamp-loopy');
  const mark=(on:boolean)=>on&&(stampArt?<img src="../assets/ui/stamp-loopy.png" alt=""/>:'뤂');
  const date=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date(state.today+'T12:00:00'));
  const full=r.week.length>0&&r.stampedDays===r.week.length;
  const [text,setText]=useState('');
  const next=nextWorkDay(state.today,s.days);
  const planned=state.todos.filter(t=>!t.done&&t.day===next);
  const nextLabel=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(next+'T12:00:00'));
  return <section className="report">
    <div className="report-head">
      <LoopyArt art={state.art} name="report-bye" sheet="pack" label="가방 메고 손 흔드는 루피" className="report-art"/>
      <h2>{say(r.done.length?(r.left.length?'reportSome':'reportAllDone'):'reportNone',s)}</h2>
      <small className="hint">{date} · {s.start}–{s.end}</small>
    </div>

    <div className="tiles">
      <div className="tile"><strong>{r.done.length}</strong><span>해낸 일</span></div>
      <div className="tile"><strong>{r.left.length}</strong><span>남은 일</span></div>
      <div className={'tile'+(r.stamp?' on':'')}><span className={'stamp'+(r.stamp?' on':'')}>{mark(r.stamp)}</span><span>{r.stamp?'칭찬 도장':'도장 기다리는 중'}</span></div>
    </div>

    {r.done.length>0&&<div className="card"><h3>오늘 해낸 일</h3><ul className="report-list">
      {r.done.slice(0,5).map(t=><li key={t.id}><span className="dot" aria-hidden="true"/>{t.title}</li>)}
      {r.done.length>5&&<li className="more">외 {r.done.length-5}개</li>}</ul></div>}

    {r.left.length>0&&<div className="card carry">
      <div className="card-head"><strong>남은 일 {r.left.length}개</strong>
        <span>{r.left.slice(0,2).map(t=>t.title).join(' · ')}{r.left.length>2?' 외':''}</span></div>
      <button type="button" className="primary" onClick={()=>run('tomorrow')}>내일 할 일로 옮기기</button></div>}

    <div className="card plan">
      <div className="card-head"><strong>내일 할 일</strong><span>{nextLabel}</span></div>
      {planned.length>0
        ?<ul className="report-list">{planned.map(t=><li key={t.id}><span className="dot plan-dot" aria-hidden="true"/>{t.title}</li>)}</ul>
        :<p className="hint">적어 두면 내일 아침 출근할 때 루피가 브리핑해 줘요.</p>}
      <form className="add" onSubmit={async e=>{e.preventDefault();if(text.trim()&&await run('addTomorrow',text))setText('');}}>
        <input aria-label="내일 할 일" maxLength={160} placeholder="내일 할 일을 적어 줘뤂" value={text} onChange={e=>setText(e.target.value)}/>
        <button className="primary" disabled={!text.trim()}>적기</button></form>
    </div>

    <div className="card">
      <div className="card-head"><strong>이번 주 도장판</strong><span className="count">{r.stampedDays} / {r.week.length}</span></div>
      <div className="week">{r.week.map(d=><div key={d.key} className={'day'+(d.today?' today':'')}>
        <span className={'stamp'+(d.stamped?' on':'')}>{mark(d.stamped)}</span><small>{d.today?'오늘':d.label}</small></div>)}</div>
      <p className="hint">{full?'이번 주 도장판 완성이뤂!':'할 일을 하나라도 끝낸 날마다 도장 한 칸이뤂.'}</p>
    </div>

    <footer><span className="say">내일 {s.start}에 만나뤂</span>
      <button type="button" className="secondary small" onClick={onClose}>수첩으로</button></footer>
  </section>;
}
