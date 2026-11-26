const CALLS=['nim','ssi','a'];
const PERSONAS=['janmang','dadeong','calm'];
function hasFinal(word){
  const c=word.charCodeAt(word.length-1);
  return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28!==0;
}
// '~이뤂' after a final consonant (or non-Hangul), plain '~뤂' after a vowel: 회의록이뤂, 정리뤂.
function ida(word){
  const c=word.charCodeAt(word.length-1);
  return word+(c>=0xAC00&&c<=0xD7A3&&!hasFinal(word)?'':'이');
}
// 남은 시간을 말로: 45분, 2시간, 1시간 5분
function duration(minutes){
  const m=Math.max(0,Math.round(minutes)), h=Math.floor(m/60), r=m%60;
  return h?(r?`${h}시간 ${r}분`:`${h}시간`):`${r}분`;
}
function callName(nickname,call){
  const name=String(nickname??'').trim();
  if(!name)return '';
  if(call==='ssi')return name+' 씨';
  if(call==='a')return name+(hasFinal(name)?'아':'야');
  return name+'님';
}
// 잔망루피는 말끝마다 '뤂'을 띄어 쓰지 않고 붙인다: "어때뤂?", "있겠냐뤂~!", "공개되었뤂-!".
// 반말 어미(-어/-야/-까/-자/-게)에는 그대로 붙이고, 평서형 '-다'는 '다' 자리에 뤂이 들어간다.
const janmang={
  startEmpty:'오늘 TODO는 작성했어뤂?',
  startReady:'오늘 할 일이 준비됐뤂!',
  wrapLeft:n=>`남은 TODO ${n}개, 퇴근 전에 정리할까뤂?`,
  wrapDone:'할 일 다 끝났뤂! 퇴근까지 조금만 버티자뤂!',
  leave:'오늘도 고생했뤂! 가방 챙겼어뤂?',
  coffee:'잠깐 커피 한 모금 할까뤂?',
  typing:'다음 할 일에 집중해 볼까뤂?',
  filing:'끝낸 일 하나 정리해 볼까뤂?',
  write:'새로 떠오른 할 일 있어뤂?',
  lunchStart:'점심시간이뤂! 맛있는 거 먹고 와뤂!',
  lunchEnd:'배불러서 졸리뤂… 다시 힘내 볼까뤂?',
  afterLunch:['밥 먹었으면 아아뤂! 아아 아니면 안 된뤂!','얼음 동동 아아 한 잔, 이게 행복이뤂!','식후엔 무조건 아아뤂! 쭉쭉 마시자뤂!'],
  otAsk:'설마… 야근이뤂?',
  otAgain:'아직 있뤂? 설마 진짜 야근이뤂?',
  otYes:'야근이라니… 루피 눈물 나뤂! 그래도 옆에 있을게뤂!',
  otSoon:'얼른 마무리하고 가뤂! 이따 다시 볼게뤂!',
  otOff:'켜 두기만 한 거뤂? 그럼 루피는 먼저 잘게뤂!',
  otCheck:h=>`야근 ${h}시간째뤂… 이제 그만 갈까뤂?`,
  otDone:'드디어 퇴근이뤂! 오늘 진짜 고생했뤂!',
  otMore:'조금만 더 하고 가자뤂… 한 시간 뒤에 또 물어볼게뤂!',
  added:'수첩에 적어 뒀뤂!',
  writePrompt:'한 줄씩 불러 줘뤂! 루피가 적을게뤂!',
  writeMore:n=>`${n}개 적었뤂! 또 있어뤂?`,
  writeDone:'다 적었뤂! 오늘도 화이팅이뤂!',
  done:'해냈뤂!',
  undone:'다시 할 일에 넣었뤂!',
  snooze:'한 시간 뒤에 다시 말 걸게뤂!',
  unsnooze:'다시 수다 떨 준비 됐뤂!',
  carried:n=>`어제 남은 ${n}개 가져왔뤂!`,
  pass:'알겠뤂! 오늘은 루피가 조용히 응원할게뤂!',
  tomorrow:n=>`${n}개는 내일 할 일로 옮겼뤂!`,
  menu:'뭐 도와줄까뤂?',
  list:'오늘 할 일이뤂! 끝낸 건 눌러 줘뤂!',
  bye:'필요하면 또 불러 줘뤂!',
  askName:'안녕뤂! 루피가 뭐라고 부를까뤂?',
  askCall:'어떻게 불러 줄까뤂?',
  askHours:'몇 시에 출근하고 퇴근해뤂?',
  badHours:'출근이랑 퇴근 시각은 다르게 알려 줘뤂!',
  askDays:'무슨 요일에 일해뤂?',
  badDays:'하루는 골라 줘뤂!',
  askLunch:'점심시간도 알려 줄까뤂?',
  badLunch:'점심 끝나는 시각이 더 늦어야 해뤂!',
  askPersona:'루피 말투는 어떤 게 좋아뤂?',
  askChat:'얼마나 자주 말 걸까뤂?',
  greet:'잘 부탁해뤂! 루피를 누르면 언제든 도와줄게뤂!',
  skip:'알겠뤂! 궁금하면 루피를 눌러 줘뤂!',
  greetEarly:'좋은 아침이뤂! 출근 준비됐어뤂?',
  greetMorning:'좋은 아침이뤂! 오늘도 하나씩 해 보자뤂!',
  greetWork:n=>`${n}개 남았뤂! 차근차근 가 보자뤂!`,
  greetEmpty:'오늘 할 일부터 적어 볼까뤂?',
  greetAllDone:'오늘 할 일 다 해냈뤂! 최고뤂!',
  greetWrap:n=>`퇴근 ${n}분 전이뤂! 마무리해 볼까뤂?`,
  greetLunch:'점심시간이뤂! 맛있게 먹고 와뤂!',
  greetFocus:'쉿, 집중 시간이뤂. 루피도 조용히 있을게뤂.',
  greetSnooze:'잠깐 쉬는 중이뤂. 조용히 기다릴게뤂.',
  greetAfter:'오늘도 고생했뤂! 푹 쉬어뤂!',
  greetAfterNone:'퇴근 시간이뤂! 내일 또 같이 해 보자뤂!',
  greetOff:'오늘은 쉬는 날이뤂! 푹 쉬어뤂!',
  greetLate:'늦은 시간이뤂… 이제 그만 쉬자뤂.',
  reportAllDone:'다 해낸 하루였뤂!',
  reportSome:'오늘도 고생했뤂!',
  reportNone:'내일은 하나만 해 보자뤂!',
  planAsk:'퇴근 전에 내일 할 일 미리 적어 둘까뤂?',
  planMore:n=>`내일 할 일 ${n}개 적었뤂! 또 있어뤂?`,
  planDone:n=>n?`내일 아침에 ${n}개 브리핑해 줄게뤂!`:'내일 아침에 같이 정하자뤂!',
  planSkip:'알겠뤂! 내일 아침에 같이 정하자뤂!',
  brief:o=>{const {list='',routines=0}=o&&typeof o==='object'?o:{};
    return (list?`오늘 할 일은 ${ida(list)}뤂!`:'오늘 할 일을 같이 보자뤂!')+(routines?` 루틴 ${routines}개도 루피가 챙길게뤂!`:' 하나씩 해치우자뤂!');},
  briefGo:'좋아, 오늘도 시작이뤂!',
  routineDefault:title=>`${title} 시간이뤂!`,
  routineDone:'같이 해서 좋뤂!',
  routineLater:'10분 뒤에 다시 부를게뤂!',
  focusStart:'쉿, 집중 시간이뤂. 조용히 있을게뤂!',
  focusEnd:'집중 끝! 정말 잘했뤂!',
  stampDone:'도장판 완성이뤂! 오늘 최고뤂!',
  poke:['간지럽뤂!','왜 찔러뤂?','한 번 더 찌르면 삐질 거뤂!'],
  pat:'헤헤, 기분 좋뤂!',
  dropped:'여기 좋뤂! 여기 있을게뤂!',
  perched:'창 위 전망 최고뤂!',
  goHome:'원래 자리로 돌아왔뤂!',
  grab:'어? 어디 가뤂?',
  dizzy:'어지러워뤂!',
  aim:'여기 앉을래뤂!',
  roamOn:'산책 다녀올게뤂!',
  roamOff:'여기 가만히 있을게뤂!',
  roam:['여기 구경 중이뤂!','바닥이 따뜻하뤂!','어디 재밌는 거 없어뤂?'],
  buddyAdd:'분신술이뤂! 루피가 하나 더 늘었뤂!',
  buddyBye:'분신들아 돌아가뤂! 수고했뤂!',
  updateReady:v=>`새 버전 ${v} 도착이뤂! 지금 바꿔 볼까뤂?`,
  updateInstall:'금방 새 루피로 돌아올게뤂!',
  updateLater:'알겠뤂! 다음에 끌 때 바꿔 둘게뤂!',
  updateNotice:v=>`새 버전 ${v} 나왔뤂! 트레이 메뉴에서 받으러 가 줘뤂!`,
  leftNow:m=>m<=10?`퇴근 ${duration(m)} 전이뤂! 가방 챙길 준비 됐어뤂?`:m<=60?`퇴근까지 ${duration(m)}밖에 안 남았뤂! 조금만 더 버티자뤂!`:`퇴근까지 ${duration(m)} 남았뤂! 오늘도 화이팅이뤂!`,
  leftBefore:end=>`아직 출근 전이뤂! 오늘은 ${end}에 퇴근하뤂!`,
  leftOver:'퇴근 시간 지났뤂! 얼른 가자뤂!',
  leftOff:'오늘은 쉬는 날이뤂! 푹 쉬어뤂!'
};
const dadeong={
  startEmpty:'오늘 할 일 같이 정리해 볼까뤂?',
  startReady:'오늘 할 일 준비 완료! 천천히 해 보자뤂!',
  wrapLeft:n=>`남은 일이 ${n}개 있어. 같이 정리해 볼까뤂?`,
  wrapDone:'오늘 할 일 다 했뤂! 정말 잘했뤂!',
  leave:'오늘도 정말 고생 많았뤂! 푹 쉬어뤂!',
  coffee:'잠깐 쉬어 가도 괜찮아뤂!',
  typing:'지금 하는 일, 잘하고 있뤂!',
  filing:'끝낸 일 하나씩 정리해 볼까뤂?',
  write:'새로 생각난 일 있으면 적어 둘까뤂?',
  lunchStart:'점심 맛있게 먹고 와뤂!',
  lunchEnd:'든든하게 먹었어뤂? 오후도 같이 힘내자뤂!',
  afterLunch:['든든하게 먹었으니 시원한 아아 한 잔 어때뤂?','아아 마시고 오후도 같이 힘내자뤂!','얼음 가득 아아로 기분 전환하자뤂!'],
  otAsk:'아직 퇴근 안 했어뤂? 설마 야근이뤂?',
  otAgain:'아직도 일하는 중이뤂? 설마 진짜 야근이뤂?',
  otYes:'야근이라니 너무 고생 많뤂… 루피가 끝까지 같이 있을게뤂!',
  otSoon:'조금만 더 힘내자뤂! 이따 다시 올게뤂!',
  otOff:'알겠뤂! 오늘은 푹 쉬어뤂!',
  otCheck:h=>`벌써 ${h}시간이나 더 했뤂! 오늘은 여기까지 할까뤂?`,
  otDone:'정말 수고 많았뤂! 집에 가서 푹 쉬어뤂!',
  otMore:'무리하지 말고, 한 시간 뒤에 또 보자뤂!',
  added:'잘 적어 뒀뤂!',
  writePrompt:'천천히 하나씩 말해 줘뤂!',
  writeMore:n=>`벌써 ${n}개나 적었뤂! 더 있어뤂?`,
  writeDone:'좋아, 오늘도 같이 해 보자뤂!',
  done:'정말 잘했뤂!',
  undone:'괜찮아, 다시 해 보자뤂!',
  snooze:'한 시간 푹 집중해뤂! 그때 다시 올게뤂!',
  unsnooze:'다시 옆에 있을게뤂!',
  carried:n=>`어제 일 ${n}개, 오늘 같이 해 보자뤂!`,
  pass:'그런 날도 있지뤂! 조용히 응원할게뤂!',
  tomorrow:n=>`${n}개는 내일 하자뤂! 오늘은 충분해뤂!`,
  menu:'뭐 도와줄까뤂?',
  list:'오늘 할 일이뤂! 끝낸 건 살짝 눌러 줘뤂!',
  bye:'언제든 불러 줘뤂!',
  askChat:'얼마나 자주 말 걸면 좋을까뤂?',
  greet:'만나서 반가워뤂! 루피를 누르면 언제든 달려올게뤂!',
  greetEarly:'좋은 아침이뤂! 오늘도 옆에 있을게뤂!',
  greetMorning:'좋은 아침이뤂! 천천히 시작해 보자뤂!',
  greetWork:n=>`${n}개만 더 하면 돼뤂! 잘하고 있뤂!`,
  greetEmpty:'오늘 할 일 같이 적어 볼까뤂?',
  greetAllDone:'다 해냈뤂! 정말 대단해뤂!',
  greetWrap:n=>`퇴근까지 ${n}분 남았뤂! 조금만 힘내뤂!`,
  greetLunch:'점심 든든하게 먹고 와뤂!',
  greetFocus:'집중 시간이뤂. 옆에서 조용히 응원할게뤂.',
  greetSnooze:'잠깐 쉬어도 괜찮아뤂. 기다릴게뤂.',
  greetAfter:'오늘도 정말 고생 많았뤂! 푹 쉬어뤂!',
  greetAfterNone:'오늘은 이만 쉬어도 괜찮아뤂! 내일 보자뤂!',
  greetOff:'쉬는 날이뤂! 마음껏 쉬어뤂!',
  greetLate:'많이 늦었뤂. 따뜻하게 쉬어뤂.',
  planAsk:'내일 할 일 미리 같이 적어 둘까뤂?',
  planMore:n=>`벌써 ${n}개나 적었뤂! 더 있어뤂?`,
  planDone:n=>n?`내일 아침에 ${n}개 차근차근 알려 줄게뤂!`:'내일 아침에 같이 정하자뤂!',
  planSkip:'괜찮아뤂! 내일 아침에 같이 정하자뤂!',
  brief:o=>{const {list='',routines=0}=o&&typeof o==='object'?o:{};
    return (list?`오늘 할 일은 ${ida(list)}뤂!`:'오늘 할 일을 같이 보자뤂!')+(routines?` 루틴 ${routines}개도 같이 챙기자뤂!`:' 천천히 해 보자뤂!');},
  briefGo:'좋아, 오늘도 같이 힘내자뤂!',
  routineDefault:title=>`${title} 시간이야. 같이 챙기자뤂!`,
  routineDone:'같이 해서 기뻐뤂!',
  routineLater:'10분 뒤에 꼭 다시 올게뤂!',
  focusStart:'집중 시간이뤂. 옆에서 조용히 응원할게뤂!',
  focusEnd:'집중 끝! 고생 많았뤂!',
  stampDone:'도장판을 다 채웠뤂! 정말 잘했뤂!',
  poke:['어? 불렀어뤂?','헤헤, 나 여기 있뤂!','루피도 반가워뤂!'],
  pat:'따뜻해서 좋뤂!',
  dropped:'여기서 지켜볼게뤂!',
  perched:'여기서 같이 일하자뤂!',
  goHome:'제자리로 왔뤂!',
  grab:'같이 가는 거뤂?',
  dizzy:'살살 해 줘뤂!',
  aim:'여기 좋아 보여뤂!',
  roamOn:'살살 산책하고 올게뤂!',
  roamOff:'옆에 가만히 있을게뤂!',
  roam:['천천히 걷는 중이뤂!','같이 쉬엄쉬엄 하자뤂!','여기도 좋아 보여뤂!'],
  buddyAdd:'친구가 하나 더 왔뤂! 같이 일하자뤂!',
  buddyBye:'친구들은 이제 쉬러 갔뤂!',
  updateReady:v=>`새 버전 ${v} 준비됐뤂! 지금 바꿔 줄까뤂?`,
  updateInstall:'잠깐만 기다려 줘, 금방 올게뤂!',
  updateLater:'괜찮아뤂! 끌 때 살짝 바꿔 둘게뤂!',
  updateNotice:v=>`새 버전 ${v} 나왔뤂! 트레이 메뉴에서 새 파일을 받아 봐뤂!`,
  leftNow:m=>m<=10?`퇴근 ${duration(m)} 전이뤂! 오늘도 정말 고생했뤂!`:m<=60?`퇴근까지 ${duration(m)} 남았뤂! 거의 다 왔뤂!`:`퇴근까지 ${duration(m)} 남았뤂! 천천히 같이 가자뤂!`,
  leftBefore:end=>`아직 출근 전이야. 오늘은 ${end}에 퇴근하뤂!`,
  leftOver:'퇴근 시간 지났뤂! 이제 푹 쉬러 가자뤂!',
  leftOff:'오늘은 쉬는 날이뤂! 편히 쉬어뤂!'
};
const calm={
  startEmpty:'오늘 할 일, 적어 둘까뤂?',
  startReady:'오늘 할 일이 준비됐뤂.',
  wrapLeft:n=>`남은 할 일 ${n}개. 정리할 시간이뤂.`,
  wrapDone:'오늘 할 일을 모두 마쳤뤂.',
  leave:'수고했뤂. 내일 만나뤂.',
  coffee:'잠깐 쉬어 갈 시간이뤂.',
  typing:'다음 할 일에 집중하자뤂.',
  filing:'끝낸 일을 정리해 보자뤂.',
  write:'떠오른 할 일 있어뤂?',
  lunchStart:'점심시간이뤂.',
  lunchEnd:'오후 일정을 시작하자뤂.',
  afterLunch:['식후에는 아아 한 잔이뤂.','시원한 아아로 정신을 깨우자뤂.','아아 마시고 오후를 시작하자뤂.'],
  otAsk:'퇴근 시간이 지났뤂. 야근이뤂?',
  otAgain:'아직 있뤂. 야근이뤂?',
  otYes:'야근이뤂. 무리하지 말자뤂.',
  otSoon:'알겠뤂. 이따 다시 물어볼게뤂.',
  otOff:'알겠뤂. 먼저 쉴게뤂.',
  otCheck:h=>`야근 ${h}시간째뤂. 정리할 시간이뤂.`,
  otDone:'수고했뤂. 푹 쉬자뤂.',
  otMore:'한 시간 뒤에 다시 알려 줄게뤂.',
  added:'적어 뒀뤂.',
  writePrompt:'할 일을 한 줄씩 적어 줘뤂.',
  writeMore:n=>`${n}개 적었뤂. 더 있어뤂?`,
  writeDone:'정리됐뤂.',
  done:'완료했뤂.',
  undone:'다시 할 일에 넣었뤂.',
  snooze:'한 시간 동안 조용히 있을게뤂.',
  unsnooze:'다시 알려 줄게뤂.',
  carried:n=>`어제 남은 ${n}개를 옮겼뤂.`,
  pass:'알겠뤂.',
  tomorrow:n=>`${n}개를 내일로 옮겼뤂.`,
  menu:'무엇을 도와줄까뤂?',
  list:'오늘 할 일이뤂. 끝낸 일을 눌러 줘뤂.',
  bye:'필요하면 불러 줘뤂.',
  askChat:'얼마나 자주 말을 걸까뤂?',
  greet:'잘 부탁해뤂. 루피를 누르면 도와줄게뤂.',
  greetEarly:'좋은 아침이뤂. 곧 출근 시간이뤂.',
  greetMorning:'좋은 아침이뤂. 하나씩 해 보자뤂.',
  greetWork:n=>`남은 할 일 ${n}개뤂.`,
  greetEmpty:'오늘 할 일을 적어 보자뤂.',
  greetAllDone:'오늘 할 일을 모두 마쳤뤂.',
  greetWrap:n=>`퇴근 ${n}분 전이뤂.`,
  greetLunch:'점심시간이뤂.',
  greetFocus:'집중 시간이뤂.',
  greetSnooze:'알림을 쉬는 중이뤂.',
  greetAfter:'오늘도 수고했뤂.',
  greetAfterNone:'퇴근 시간이뤂. 내일 보자뤂.',
  greetOff:'쉬는 날이뤂.',
  greetLate:'늦은 시간이뤂. 쉬자뤂.',
  planAsk:'내일 할 일을 미리 적어 둘까뤂?',
  planMore:n=>`${n}개 적었뤂. 더 있어뤂?`,
  planDone:n=>n?`내일 아침에 ${n}개를 알려 줄게뤂.`:'내일 아침에 정하자뤂.',
  planSkip:'알겠뤂. 내일 아침에 정하자뤂.',
  brief:o=>{const {list='',routines=0}=o&&typeof o==='object'?o:{};
    return (list?`오늘 할 일은 ${ida(list)}뤂.`:'오늘 할 일을 확인하자뤂.')+(routines?` 루틴 ${routines}개도 있뤂.`:'');},
  briefGo:'시작하자뤂.',
  routineDefault:title=>`${title} 시간이뤂.`,
  routineDone:'잘했뤂.',
  routineLater:'10분 뒤에 다시 알려 줄게뤂.',
  focusStart:'집중 시간이뤂. 조용히 있을게뤂.',
  focusEnd:'집중 시간이 끝났뤂.',
  stampDone:'도장판을 다 채웠뤂.',
  poke:['응, 여기 있뤂.','부르셨뤂?','무슨 일 있어뤂?'],
  pat:'고마워뤂.',
  dropped:'여기 있을게뤂.',
  perched:'창 위에 앉았뤂.',
  goHome:'원래 자리로 왔뤂.',
  grab:'옮기는 거뤂?',
  dizzy:'조금 어지럽뤂.',
  aim:'여기 앉을게뤂.',
  roamOn:'조금 걸을게뤂.',
  roamOff:'여기 있을게뤂.',
  roam:['잠깐 걷는 중이뤂.','둘러보는 중이뤂.','쉬어 가는 중이뤂.'],
  buddyAdd:'분신을 불렀뤂.',
  buddyBye:'분신을 돌려보냈뤂.',
  updateReady:v=>`새 버전 ${v}, 준비가 끝났뤂. 지금 바꿀까뤂?`,
  updateInstall:'바꾸고 다시 올게뤂.',
  updateLater:'다음에 끌 때 바꿔 둘게뤂.',
  updateNotice:v=>`새 버전 ${v}, 나왔뤂. 트레이 메뉴에서 받아 줘뤂.`,
  leftNow:m=>`퇴근까지 ${duration(m)} 남았뤂.`,
  leftBefore:end=>`출근 전이뤂. ${end}에 퇴근하뤂.`,
  leftOver:'퇴근 시간이 지났뤂.',
  leftOff:'오늘은 쉬는 날이뤂.'
};
const sets={janmang,dadeong,calm};
const APP_NAMES={excel:'엑셀',sheets:'스프레드시트',docs:'문서',slides:'슬라이드',word:'워드',powerpoint:'파워포인트',mail:'메일'};
const boredom={
  janmang:{
    excel:['엑셀 칸이 끝이 없뤂… 지루하뤂!','숫자만 보니까 눈이 빙글빙글이뤂!','셀 하나 채울 때마다 루피가 박수 쳐 줄게뤂!'],
    sheets:['스프레드시트 또 열었뤂? 루피는 벌써 지루하뤂!','칸 칸 칸… 칸이 너무 많뤂!','숫자랑 눈싸움 중이뤂? 루피가 응원할게뤂!'],
    docs:['글자가 꼬물꼬물이뤂… 졸리뤂!','문서 쓰는 중이뤂? 한 줄만 더 힘내자뤂!'],
    slides:['슬라이드 또 만들어뤂? 루피 사진도 넣어 줘뤂!','도형 줄 맞추기 지루하지뤂?'],
    word:['워드 화면이 하얗뤂… 루피 눈부시뤂!','글자 수 세는 중이뤂? 루피도 같이 셀게뤂!'],
    powerpoint:['발표 자료 만드는 중이뤂? 루피가 박수 연습할게뤂!','애니메이션은 루피 하나면 충분해뤂!'],
    mail:['메일이 또 왔뤂? 메일함이 배고프다고 하뤂!','답장 쓰다 지루하면 루피 한 번 봐 줘뤂!']
  },
  dadeong:name=>[`${name} 붙잡고 있느라 고생 많뤂!`,`${name} 오래 보면 지루하지뤂? 루피가 옆에 있뤂!`,`${name} 잘하고 있뤂! 조금만 더 힘내자뤂!`],
  calm:name=>[`${name} 작업이 길어지고 있뤂.`,`${name}, 잠깐 눈을 쉬자뤂.`,`${name} 중이뤂. 천천히 하자뤂.`]
};
const longWork={
  janmang:(name,m)=>`${name} ${m}분째뤂… 기지개 한 번 켜자뤂!`,
  dadeong:(name,m)=>`${name} ${m}분이나 했뤂! 물 한 잔 마시자뤂!`,
  calm:(name,m)=>`${name} ${m}분째뤂. 잠깐 쉬자뤂.`
};
// 대기 중 혼잣말: idle.cjs가 고른 동작마다 말투별로 고른다.
const idleTalk={
  janmang:{
    coffee:['커피 한 모금, 루피 충전 중이뤂!','커피 향이 솔솔 나뤂!','같이 한 모금 할래뤂?'],
    stretch:['으아아~ 기지개 쭉이뤂!','어깨 뭉쳤으면 같이 쭉 펴자뤂!','쭉쭉 늘어나는 중이뤂!'],
    water:['물 한 잔 꿀꺽이뤂!','물 마셨어뤂? 루피는 벌써 두 잔째뤂!','목마르면 집중 안 된뤂!'],
    typing:['타닥타닥, 루피도 일하는 척하는 중이뤂!','루피 타자 실력 어때뤂?','오늘 루피 손가락에 불난뤂!'],
    filing:['서류 정리는 루피 담당이뤂!','착착 정리하는 중이뤂!','이건 여기, 저건 저기뤂!'],
    write:['생각난 거 적어 두는 중이뤂!','루피 수첩에 비밀 메모 생겼뤂!','할 일 생기면 루피 불러 줘뤂!'],
    look:['두리번두리번, 뭐 재밌는 거 없어뤂?','오늘 화면 깔끔하뤂!','여기저기 구경 중이뤂!'],
    shh:['쉿, 집중하는 거 다 보여뤂!','조용히 응원 중이뤂!','쉿! 루피 비밀 작전 중이뤂!'],
    iced:['아아 한 모금, 정신이 번쩍이뤂!','얼음 소리 들려뤂? 짤랑짤랑이뤂!','아아는 언제나 옳뤂!'],
    bored:['심심하뤂… 루피랑 놀아 줘뤂!','하품 나뤂… 아니 안 졸았뤂!','쓰다듬어 주면 기운 날 것 같뤂!'],
    sit:['잠깐 털썩 앉았뤂!','다리 아파서 쉬는 중이뤂!','여기 앉아서 지켜볼게뤂!'],
    doze:['꾸벅꾸벅… 안 졸았뤂!','눈꺼풀이 너무 무겁뤂!','1분만 눈 감고 있을게뤂.'],
    lunch:['냠냠, 점심은 역시 맛있뤂!','오늘 메뉴 뭐 먹었어뤂?','루피는 한 숟갈 더 먹을래뤂!'],
    clock:['퇴근까지 얼마 안 남았뤂!','시계만 자꾸 보게 되뤂!','조금만 더 버티자뤂!']
  },
  dadeong:{
    coffee:['따뜻한 커피 한 잔 같이 마시자뤂!','잠깐 쉬어 가도 괜찮아뤂!','커피 마시면서 숨 좀 돌리자뤂!'],
    stretch:['하나, 둘, 같이 기지개 켜자뤂!','오래 앉아 있었지뤂? 쭉 펴 보자뤂!','어깨 살살 풀어 주자뤂!'],
    water:['물 한 잔 챙겨 마셨어뤂?','물 마시는 거 잊지 마뤂!','같이 한 잔 마시자뤂!'],
    typing:['옆에서 같이 일하는 중이뤂!','천천히 해도 잘하고 있뤂!','루피도 열심히 돕는 중이뤂!'],
    filing:['끝낸 일은 루피가 정리해 둘게뤂!','하나씩 차근차근 정리 중이뤂!','정리하니까 마음이 편하뤂!'],
    write:['생각난 일 있으면 언제든 말해 줘뤂!','루피가 잊지 않게 적어 둘게뤂!','오늘도 메모 열심히 하는 중이뤂!'],
    look:['오늘도 잘 지내는지 보는 중이뤂!','여기서 지켜보고 있을게뤂!','주변이 평화롭뤂!'],
    shh:['조용히 옆에 있을게뤂!','집중하는 모습 멋지뤂!','쉿, 방해 안 할게뤂!'],
    iced:['시원한 아아로 기분 전환하자뤂!','아아 한 모금 같이 할래뤂?','얼음 동동, 시원하뤂!'],
    bored:['조금 심심하지만 옆에 있을게뤂!','힘들면 루피 한 번 쓰다듬어 줘뤂!','같이 있으니까 괜찮뤂!'],
    sit:['잠깐 앉아서 쉬는 중이뤂!','같이 앉아서 쉬자뤂!','여기서 응원하고 있을게뤂!'],
    doze:['살짝 졸렸뤂… 금방 일어날게뤂!','눈 잠깐만 감을게뤂.','꾸벅, 괜찮아 안 잤뤂!'],
    lunch:['맛있게 먹고 있어뤂?','든든하게 먹어야 오후도 힘나뤂!','루피도 같이 냠냠 중이뤂!'],
    clock:['퇴근까지 조금만 더 힘내자뤂!','오늘도 거의 다 왔뤂!','마무리 같이 해 보자뤂!']
  },
  calm:{
    coffee:['커피 한 모금 마시는 중이뤂.','잠깐 쉬어 가자뤂.'],
    stretch:['기지개를 켜는 중이뤂.','어깨를 한 번 펴 보자뤂.'],
    water:['물 한 잔 마실 시간이뤂.','물을 마시는 중이뤂.'],
    typing:['조용히 일하는 중이뤂.','하나씩 처리하는 중이뤂.'],
    filing:['서류를 정리하는 중이뤂.','끝낸 일을 정리했뤂.'],
    write:['메모를 남기는 중이뤂.','떠오른 일을 적어 두자뤂.'],
    look:['주변을 둘러보는 중이뤂.','오늘도 조용하뤂.'],
    shh:['조용히 있을게뤂.','집중하는 중이뤂.'],
    iced:['아아 한 모금이뤂.','시원하게 마시는 중이뤂.'],
    bored:['조금 심심하뤂.','잠깐 쉬어도 괜찮뤂.'],
    sit:['잠깐 앉아서 쉬는 중이뤂.','여기 앉아 있을게뤂.'],
    doze:['잠깐 눈을 감았뤂.','조금 졸리뤂.'],
    lunch:['점심을 먹는 중이뤂.','천천히 먹자뤂.'],
    clock:['퇴근이 가까워졌뤂.','마무리할 시간이뤂.']
  }
};
function idleLine(motion,settings={},n=0,named=false){
  const set=idleTalk[settings.persona]||idleTalk.janmang;
  const list=set[motion]||idleTalk.janmang[motion]||set.look;
  const text=list[Math.abs(n)%list.length];
  const who=named?callName(settings.nickname,settings.call):'';
  return who?`${who}, ${text}`:text;
}
function boredLine(app,settings={},n=0){
  const set=boredom[settings.persona]||boredom.janmang;
  const list=typeof set==='function'?set(APP_NAMES[app]):(set[app]||boredom.janmang[app]);
  return list[Math.abs(n)%list.length];
}
function longWorkLine(app,settings={},minutes){
  return (longWork[settings.persona]||longWork.janmang)(APP_NAMES[app],minutes);
}
const named=new Set(['planAsk','brief','otAsk','otDone','startEmpty','startReady','wrapLeft','wrapDone','leave','lunchStart','menu','askHours','greet',
  'greetEarly','greetMorning','greetWork','greetEmpty','greetAllDone','greetWrap','greetLunch','greetFocus','greetSnooze',
  'greetAfter','greetAfterNone','greetOff','greetLate','reportAllDone','reportSome','reportNone']);
const lineKeys=Object.keys(janmang);
function say(key,settings={},n){
  const raw=(sets[settings.persona]||janmang)[key]??janmang[key];
  if(raw===undefined)throw Error('Unknown line: '+key);
  const text=typeof raw==='function'?raw(n):Array.isArray(raw)?raw[Math.abs(n??0)%raw.length]:raw;
  const who=named.has(key)?callName(settings.nickname,settings.call):'';
  return who?`${who}, ${text}`:text;
}
module.exports={CALLS,PERSONAS,callName,duration,say,lineKeys,boredLine,longWorkLine,idleLine,idleTalk};
