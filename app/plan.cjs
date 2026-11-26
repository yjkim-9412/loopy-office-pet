// "내일 할 일": the morning briefing line, read out from the to-dos planned for today.
const {say}=require('./voice.cjs');
const {pendingTodos}=require('./todos.cjs');

function briefLine(settings,todos,today,routines=0) {
  const pending=pendingTodos(todos,today);
  const left=[...pending.filter(t=>t.focus),...pending.filter(t=>!t.focus)];
  const names=left.slice(0,2).map(t=>t.title);
  const more=left.length-names.length;
  return say('brief',settings,{list:names.join(', ')+(more>0?` 외 ${more}개`:''),routines});
}

module.exports={briefLine};
