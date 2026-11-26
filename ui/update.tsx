// The update button in the panel header, and the guide it opens. The installed Windows app
// downloads new versions by itself, so its guide is one button; the portable build and the Mac
// app can't replace themselves, so theirs walks through downloading the new file.
export type Update={mode:'auto'|'notice'|'off';version:string;platform:string;
  state:'idle'|'checking'|'downloading'|'ready'|'notice'|'latest'|'error';latest?:string|null;percent?:number};
type Run=(a:string,v?:unknown)=>Promise<boolean>;

// shown only while there is something new; a click opens the guide
export function UpdateButton({update,onOpen}:{update?:Update;onOpen:()=>void}){
  const text={ready:`새 버전 ${update?.latest} 업데이트하기`,notice:`새 버전 ${update?.latest} 나왔어요`,
    downloading:`새 버전 받는 중 ${update?.percent??0}%`}[update?.state as string];
  if(!text)return null;
  return <button type="button" className={'update-pill '+update?.state} onClick={onOpen}>
    <span className="update-dot" aria-hidden="true"/>{text}</button>;
}

const TITLES:Record<Update['state'],string>={idle:'앱 업데이트',checking:'앱 업데이트',latest:'앱 업데이트',error:'앱 업데이트',
  downloading:'새 버전 받는 중',ready:'업데이트 준비 완료',notice:'새 버전이 나왔어요'};

export function UpdateGuide({update,run,onClose}:{update?:Update;run:Run;onClose?:()=>void}){
  if(!update)return null;
  const {state,latest,version,mode,platform}=update, mac=platform==='darwin';
  const later=onClose&&<button type="button" className="secondary" onClick={onClose}>나중에</button>;
  return <div className="card update-guide">
    <div className="update-head"><h2>{TITLES[state]}</h2>
      {onClose&&<button type="button" className="secondary small" aria-label="업데이트 안내 닫기" onClick={onClose}>닫기</button>}</div>
    <small className="hint">지금 쓰는 버전 {version}{latest&&latest!==version?` · 새 버전 ${latest}`:''}</small>
    {state==='ready'&&<>
      <ol className="steps">
        <li><b>지금 업데이트하기</b>를 누르면 루피가 잠깐 사라져요.</li>
        <li>몇 초 뒤 새 버전으로 다시 나타나요.</li>
        <li>할 일, 루틴, 설정, 분신은 그대로 남아요.</li>
      </ol>
      <div className="row"><button type="button" className="primary" onClick={()=>run('updateInstall')}>지금 업데이트하기</button>{later}</div>
      <small className="hint">나중에 하면, 루피를 종료할 때 알아서 설치돼요.</small>
    </>}
    {state==='downloading'&&<>
      <div className="progress" role="progressbar" aria-valuenow={update.percent??0} aria-valuemin={0} aria-valuemax={100}>
        <span style={{width:(update.percent??0)+'%'}}/></div>
      <small className="hint">다 받으면 여기에 <b>지금 업데이트하기</b> 버튼이 생겨요. 그동안 루피를 계속 써도 괜찮아요.</small>
    </>}
    {state==='notice'&&<>
      <ol className="steps">
        <li><b>다운로드 페이지 열기</b>를 눌러요. 새 버전 {latest} 페이지가 열려요.</li>
        {mac?<li>Apple 칩 Mac은 <code>mac-arm64.dmg</code>, 인텔 Mac은 <code>mac-x64.dmg</code>를 받아요.</li>
          :<li><code>Portable</code> 파일을 받아요. <code>Setup</code> 파일로 설치하면 다음부터는 알아서 업데이트돼요.</li>}
        {mac?<li>루피를 종료하고 dmg를 열어 Loopy Office를 응용 프로그램 폴더로 끌어 넣은 뒤 ‘대치’를 눌러요.</li>
          :<li>루피를 종료하고 새로 받은 파일을 실행해요. 예전 파일은 지워도 돼요.</li>}
        <li>할 일, 루틴, 설정, 분신은 그대로 남아요.</li>
      </ol>
      <div className="row"><button type="button" className="primary" onClick={()=>run('updateOpen')}>다운로드 페이지 열기</button>{later}</div>
    </>}
    {(state==='idle'||state==='checking'||state==='latest'||state==='error')&&<>
      <p className="update-note">{mode==='off'?'개발 중 실행이라 업데이트는 확인하지 않아요.'
        :state==='checking'?'새 버전이 있는지 보고 있어요…'
        :state==='latest'?`지금 쓰는 버전(${version})이 최신이에요.`
        :state==='error'?'업데이트를 확인하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'
        :'새 버전은 루피가 하루에 몇 번 알아서 확인해요.'}</p>
      {mode!=='off'&&<button type="button" className="secondary" disabled={state==='checking'} onClick={()=>run('updateCheck')}>지금 업데이트 확인</button>}
    </>}
  </div>;
}
