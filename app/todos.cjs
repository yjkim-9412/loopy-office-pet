// Which to-dos count for a day. A to-do without a day belongs to whatever day it is looked at;
// one with a day shows from that day on until it is done, so unfinished ones carry over.
// today's list: due by today, and either still open or finished today
const visibleTodos=(todos,today)=>todos.filter(t=>(t.day??today)<=today&&(!t.done||t.doneDay===today));
// still to do today, carried-over ones included
const pendingTodos=(todos,today)=>todos.filter(t=>!t.done&&(t.day??today)<=today);
// finished on that day
const doneOn=(todos,day)=>todos.filter(t=>t.done&&t.doneDay===day);
// written down ahead for that day and not done yet
const plannedFor=(todos,day)=>todos.filter(t=>!t.done&&t.day===day);
module.exports={visibleTodos,pendingTodos,doneOn,plannedFor};
