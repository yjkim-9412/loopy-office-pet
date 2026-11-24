// New versions. The installed Windows app downloads and installs them with electron-updater from a
// private update store (an R2 bucket behind a Worker that wants the read key below). The portable
// build and the Mac app can't replace themselves, so they only notice a newer version and say so.
// The store's address and read key are written into update-config.json at build time
// (scripts/build.cjs, from LOOPY_UPDATE_URL and LOOPY_UPDATE_KEY); without them updates are off.
const KEY_HEADER='X-Loopy-Key';
const FIRST_CHECK=60*1000, CHECK_EVERY=6*60*60*1000;

function readConfig(load){
  try{
    const c=load();
    if(c&&typeof c.url==='string'&&/^https?:\/\//.test(c.url)&&typeof c.key==='string'&&c.key.length>=16)
      return {url:c.url.endsWith('/')?c.url:c.url+'/',key:c.key};
  }catch{}
  return null;
}
// 'auto': download and install (installed Windows app). 'notice': only tell (portable, Mac). 'off'.
function updateMode({packaged,platform,portable,config}){
  if(!packaged||!config)return 'off';
  if(platform==='win32'&&!portable)return 'auto';
  if(platform==='win32'||platform==='darwin')return 'notice';
  return 'off';
}
const parts=v=>String(v).trim().replace(/^v/,'').split(/[.+-]/).slice(0,3).map(n=>parseInt(n,10)||0);
function newer(a,b){
  const x=parts(a), y=parts(b);
  for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];
  return false;
}
// the version line of electron-builder's latest.yml
function latestVersion(yml){
  const m=/^version:\s*['"]?([0-9][^'"\s]*)/m.exec(String(yml??''));
  return m?m[1]:null;
}
// mode, config, current version and the side effects come in from main.cjs:
//   loadUpdater()  -> electron-updater's autoUpdater (required only in 'auto' mode)
//   fetchText(url, headers) -> body text, for the notice check
//   onReady(version)  a new version is downloaded and waits to be installed
//   onNotice(version) a newer version exists but this build can't install it
function createUpdates({mode,config,version,loadUpdater,fetchText,onReady,onNotice,log=()=>{}}){
  let updater=null, ready=null;
  if(mode==='auto'){
    updater=loadUpdater();
    Object.assign(updater,{autoDownload:true,autoInstallOnAppQuit:true,allowDowngrade:false,
      allowPrerelease:false,disableDifferentialDownload:true,logger:null});
    updater.requestHeaders={[KEY_HEADER]:config.key};
    updater.setFeedURL({provider:'generic',url:config.url,useMultipleRangeRequest:false});
    updater.on('update-downloaded',info=>{ready=info?.version||null;if(ready)onReady(ready);});
    updater.on('error',err=>log('update: '+(err?.message||err)));
  }
  async function check(){
    try{
      if(mode==='auto'){await updater.checkForUpdates();return;}
      if(mode!=='notice')return;
      const latest=latestVersion(await fetchText(config.url+'latest.yml',{[KEY_HEADER]:config.key}));
      if(latest&&newer(latest,version))onNotice(latest);
    }catch(err){log('update: '+(err?.message||err));}
  }
  return {
    mode,
    get ready(){return ready;},
    check,
    // schedule(setTimer, setRepeat) so tests can drive time
    start(later=setTimeout,every=setInterval){
      if(mode==='off')return;
      later(check,FIRST_CHECK);
      every(check,CHECK_EVERY);
    },
    // quit now and install the downloaded version silently, then reopen
    install(){if(mode==='auto'&&ready){updater.quitAndInstall(true,true);return true;}return false;}
  };
}
module.exports={KEY_HEADER,FIRST_CHECK,CHECK_EVERY,readConfig,updateMode,newer,latestVersion,createUpdates};
