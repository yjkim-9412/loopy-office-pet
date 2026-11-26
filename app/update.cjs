// New versions come from this repository's public GitHub Releases. CI makes a release (vX.Y.Z) when a
// newer package.json version lands on main (scripts/release.cjs). The installed Windows app downloads
// and installs it with electron-updater. The portable build and the Mac app can't replace themselves,
// so they only read the latest release's latest.yml and say a newer version is out.
const OWNER='yjkim-9412', REPO='loopy-office-pet';
const RELEASES=`https://github.com/${OWNER}/${REPO}/releases/latest`;
const LATEST_YML=`${RELEASES}/download/latest.yml`;
const FIRST_CHECK=60*1000, CHECK_EVERY=6*60*60*1000;

// 'auto': download and install (installed Windows app). 'notice': only tell (portable, Mac). 'off'.
function updateMode({packaged,platform,portable}){
  if(!packaged)return 'off';
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
// mode, current version and the side effects come in from main.cjs:
//   loadUpdater()  -> electron-updater's autoUpdater (required only in 'auto' mode)
//   fetchText(url) -> body text, for the notice check
//   onReady(version)  a new version is downloaded and waits to be installed
//   onNotice(version) a newer version exists but this build can't install it
function createUpdates({mode,version,loadUpdater,fetchText,onReady,onNotice,log=()=>{}}){
  let updater=null, ready=null;
  if(mode==='auto'){
    updater=loadUpdater();
    Object.assign(updater,{autoDownload:true,autoInstallOnAppQuit:true,allowDowngrade:false,
      allowPrerelease:false,disableDifferentialDownload:true,logger:null});
    updater.setFeedURL({provider:'github',owner:OWNER,repo:REPO});
    updater.on('update-downloaded',info=>{ready=info?.version||null;if(ready)onReady(ready);});
    updater.on('error',err=>log('update: '+(err?.message||err)));
  }
  async function check(){
    try{
      if(mode==='auto'){await updater.checkForUpdates();return;}
      if(mode!=='notice')return;
      const latest=latestVersion(await fetchText(LATEST_YML));
      if(latest&&newer(latest,version))onNotice(latest);
    }catch(err){log('update: '+(err?.message||err));}
  }
  return {
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
module.exports={OWNER,REPO,RELEASES,LATEST_YML,FIRST_CHECK,CHECK_EVERY,updateMode,newer,latestVersion,createUpdates};
