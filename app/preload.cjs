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
  petCatalog:()=>ipcRenderer.invoke('pet:hello'),
  onPose:fn=>subscribe('pet:pose',fn),
  pointer:inside=>ipcRenderer.send('pet:pointer',inside),
  open:()=>ipcRenderer.send('pet:open')
});
