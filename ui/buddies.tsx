import {LoopyArt,Segmented} from './parts';

type Pattern='follow'|'wander'|'copy'|'nap'|'auto';
type Pace='slow'|'normal'|'often';
export type Buddy={id:string;pattern:Pattern;motions?:string[];pace?:Pace};
type Props={buddies:Buddy[];max:number;motions:Record<string,string>;buddyMotions:string[];now:Record<string,string>;
  run:(a:string,v?:unknown)=>Promise<boolean>};

const PATTERNS:[Pattern,string][]=[['auto','자동 변신'],['follow','따라다니기'],['wander','산책'],['copy','따라쟁이'],['nap','낮잠']];
const PACES:[Pace,string][]=[['slow','가끔'],['normal','보통'],['often','자주']];
const DOING:Record<string,string>={follow:'따라다니는 중',wander:'산책 중',copy:'따라 하는 중',nap:'낮잠 자는 중'};
// what a clone starts with when its rest motions are picked by hand
const STARTER=['coffee','stretch','water'];

export function Buddies({buddies,max,motions,buddyMotions,now,run}:Props){
  return <div className="card">
    <h2>분신 루피</h2>
    <small className="hint">메인 루피와 함께 지내는 분신이에요. 분신을 누르면 반응하고, 분신을 오른쪽 클릭해도 패턴과 행동 빈도를 바꿀 수 있어요.</small>
    {buddies.map((b,i)=><BuddyRow key={b.id} buddy={b} n={i+1} motions={motions} buddyMotions={buddyMotions} doing={now[b.id]} run={run}/>)}
    <button type="button" className="primary" disabled={buddies.length>=max} onClick={()=>run('buddyAdd','follow')}>
      {buddies.length>=max?'분신은 다섯 마리까지예요':'분신 부르기'}</button>
  </div>;
}

function BuddyRow({buddy:b,n,motions,buddyMotions,doing,run}:{buddy:Buddy;n:number;motions:Record<string,string>;buddyMotions:string[];
  doing?:string;run:Props['run']}){
  const pace=b.pace||'normal', picked=(b.motions||[]).filter(m=>buddyMotions.includes(m));
  const behave=(change:{motions?:string[];pace?:Pace})=>run('buddyBehavior',{id:b.id,motions:picked,pace,...change});
  const toggle=(m:string)=>behave({motions:picked.includes(m)?picked.filter(x=>x!==m):[...picked,m]});
  return <div className="buddy-card">
    <div className="buddy-head"><strong>분신 {n}</strong>
      <button type="button" className="secondary small" onClick={()=>run('buddyRemove',b.id)}>보내기</button></div>
    <Segmented label="움직임" value={b.pattern} options={PATTERNS} onChange={v=>run('buddyPattern',{id:b.id,pattern:v})}/>
    {b.pattern==='auto'&&<small className="hint">시간대에 맞춰 알아서 바꿔요. 점심엔 주로 낮잠, 퇴근 무렵엔 주로 따라다녀요.
      {doing&&DOING[doing]?` 지금은 ${DOING[doing]}이에요.`:''}</small>}
    {b.pattern==='copy'||b.pattern==='nap'
      ?<small className="hint">{b.pattern==='copy'?'메인 루피 앞에서 동작을 조금 늦게 따라 해요.':'거의 졸면서 가끔 자리만 조금 옮겨요.'}</small>
      :<details className="behave"><summary>행동 설정 · {PACES.find(([p])=>p===pace)?.[1]} · {picked.length?`고른 동작 ${picked.length}개`:'시간대에 맞는 동작'}</summary><div className="behave-body">
        <Segmented label={b.pattern==='auto'?'행동 빈도 (패턴 바꾸는 간격도 같이)':'행동 빈도'} value={pace} options={PACES} onChange={v=>behave({pace:v})}/>
        <Segmented label="쉴 때 하는 동작" value={picked.length?'pick':'time'} options={[['time','시간대에 맞게'],['pick','직접 고르기']]}
          onChange={v=>{if((v==='pick')!==picked.length>0)behave({motions:v==='pick'?STARTER.filter(m=>buddyMotions.includes(m)):[]});}}/>
        {picked.length>0&&<div className="motion-grid">{buddyMotions.map(m=>
          <button key={m} type="button" aria-pressed={picked.includes(m)} disabled={picked.length===1&&picked.includes(m)} onClick={()=>toggle(m)}>
            <LoopyArt art={[]} sheet={m} label="" className="thumb"/>{motions[m]}</button>)}</div>}
        <small className="hint">{picked.length?'고른 동작 가운데 하나를 골라 쉬는 틈에 해요. 하나는 남겨 둬야 해요.'
          :'아침엔 커피와 기지개, 점심엔 냠냠과 꾸벅처럼 메인 루피와 같은 시간대 동작을 해요.'}</small>
      </div></details>}
  </div>;
}
