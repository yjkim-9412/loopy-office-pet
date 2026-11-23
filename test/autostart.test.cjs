const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loginOptions,needsDefaultLogin}=require('../app/autostart.cjs');
const {openStore}=require('../app/store.cjs');

test('설치한 앱을 처음 실행하면 컴퓨터를 켤 때 루피가 실행되도록 한 번 켬',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'loopy-autostart-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=openStore(dir);
  assert.equal(store.value.loginDefaultApplied,false);
  assert.equal(needsDefaultLogin(store.value,true),true);
});

test('한 번 켠 뒤에는 사용자가 끈 설정을 다시 켜지 않음',()=>{
  assert.equal(needsDefaultLogin({loginDefaultApplied:true},true),false);
});

test('개발 중 실행에서는 자동 실행을 건드리지 않음',()=>{
  assert.equal(needsDefaultLogin({loginDefaultApplied:false},false),false);
});

test('포터블 실행 파일은 임시 폴더가 아니라 원래 파일 위치로 등록',()=>{
  const exe='C:\\Users\\me\\Desktop\\LoopyOffice-Portable-0.1.0-x64.exe';
  assert.deepEqual(loginOptions({PORTABLE_EXECUTABLE_FILE:exe}),{path:exe});
  assert.deepEqual(loginOptions({}),{});
});
