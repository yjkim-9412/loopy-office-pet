const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {releaseFiles,findFiles}=require('../scripts/release.cjs');
const {RELEASES}=require('../app/update.cjs');
const pkg=require('../package.json');

test('릴리스에는 빌드 설정이 만드는 이름 그대로 설치본 네 개와 latest.yml이 들어감',()=>{
  assert.deepEqual(releaseFiles('0.3.0'),['LoopyOffice-Setup-0.3.0-x64.exe','LoopyOffice-Setup-0.3.0-x64.exe.blockmap','latest.yml',
    'LoopyOffice-Portable-0.3.0-x64.exe','LoopyOffice-0.3.0-mac-arm64.dmg','LoopyOffice-0.3.0-mac-x64.dmg']);
  assert.match(pkg.build.nsis.artifactName,/\$\{version\}/,'names follow the build settings');
});

test('내려받은 빌드 묶음은 폴더가 겹쳐 있어도 파일 이름으로 찾음',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'loopy-release-'));
  try{
    fs.mkdirSync(path.join(dir,'release'));
    fs.writeFileSync(path.join(dir,'release','latest.yml'),'version: 0.3.0\n');
    fs.writeFileSync(path.join(dir,'package-lock.json'),'{}');
    const found=findFiles(dir);
    assert.equal(found.get('latest.yml'),path.join(dir,'release','latest.yml'));
    assert.ok(found.has('package-lock.json'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('공유용 설치 도우미는 이 저장소의 최신 릴리스에서 받고, 체크섬을 확인하고, cmd가 읽을 수 있는 형식',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../share/LoopyOffice-설치.cmd'));
  const text=raw.toString('utf8');
  assert.notEqual(raw[0],0xef,'no UTF-8 BOM, or cmd misreads the first line');
  assert.ok(!/[^\r]\n/.test(text),'CRLF line endings only');
  assert.ok(text.startsWith('<# : batch part\r\n@echo off'),'batch and PowerShell in one file');
  assert.ok(text.includes(`'${RELEASES}'`),'downloads from the same releases the app updates from');
  assert.match(text,/latest\.yml/);
  assert.match(text,/SHA512/);
  assert.match(text,/WaitForExit\(\)/,'waits for the installer only, not for the Loopy it starts');
  assert.match(text,/비상업용 팬 제작/);
  assert.doesNotMatch(text,/공식/);
});
