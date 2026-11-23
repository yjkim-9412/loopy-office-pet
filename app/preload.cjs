const {contextBridge,ipcRenderer}=require('electron');
function subscribe(channel,listener){
  const handler=(_,data)=>listener(data);
  ipcRenderer.on(channel,handler);
  return ()=>ipcRenderer.removeListener(channel,handler);
}
contextBridge.exposeInMainWorld('office',{
  read:()=>ipcRenderer.invoke('office:read'),
  command:(action,value)=>ipcRenderer.invoke('office:command',action,value),
  subscribe:fn=>subscribe('office:state',fn),
  onPage:fn=>subscribe('office:page',fn),
  petCatalog:()=>ipcRenderer.invoke('pet:hello'),
  onPose:fn=>subscribe('pet:pose',fn),
  pointer:inside=>ipcRenderer.send('pet:pointer',inside),
  open:()=>ipcRenderer.send('pet:open'),
  buddyHello:()=>ipcRenderer.invoke('buddy:hello'),
  buddyPointer:inside=>ipcRenderer.send('buddy:pointer',inside),
  buddyPoke:()=>ipcRenderer.send('buddy:poke'),
  buddyMenu:()=>ipcRenderer.send('buddy:menu'),
  reply:message=>ipcRenderer.invoke('pet:reply',message),
  resize:(width,height)=>ipcRenderer.invoke('pet:size',width,height),
  drag:(phase,x,y)=>ipcRenderer.send('pet:drag',phase,x,y),
  poke:()=>ipcRenderer.send('pet:poke'),
  pat:()=>ipcRenderer.send('pet:pat'),
  menu:()=>ipcRenderer.send('pet:menu')
});
