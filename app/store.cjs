const fs=require('node:fs');
const path=require('node:path');
const {defaults,validateSettings}=require('./routine.cjs');
function openStore(dir) {
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'office.json');
  let state={settings:{...defaults},todos:[],seen:{},snoozeUntil:0};
  if(fs.existsSync(file)) {
    const saved=JSON.parse(fs.readFileSync(file,'utf8'));
    state={...state,...saved,settings:validateSettings({...defaults,...saved.settings})};
    if(!Array.isArray(state.todos) || !state.seen || typeof state.seen!=='object') throw Error('업무 데이터 형식을 확인해 주세요.');
  }
  return { get value(){return state;}, change(update) {
    const draft=structuredClone(state);
    update(draft);
    fs.writeFileSync(file+'.tmp',JSON.stringify(draft),'utf8');
    fs.renameSync(file+'.tmp',file);
    state=draft;
  }};
}
module.exports={openStore};
