// "내일 할 일": the morning briefing line, read out from the to-dos planned for today.
const {say}=require('./voice.cjs');

function briefTodos(todos,today) {
  const left=todos.filter(t=>!t.done&&(t.day??today)<=today);
  return [...left.filter(t=>t.focus),...left.filter(t=>!t.focus)];
}

function briefLine(settings,todos,today,routines=0) {
  const left=briefTodos(todos,today);
  const names=left.slice(0,2).map(t=>t.title);
  const more=left.length-names.length;
  return say('brief',settings,{list:names.join(', ')+(more>0?` 외 ${more}개`:''),count:left.length,routines});
}

module.exports={briefTodos,briefLine};
