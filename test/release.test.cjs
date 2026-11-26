const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {releaseFiles,findFiles}=require('../scripts/release.cjs');
const pkg=require('../package.json');

test('릴리스에는 빌드 설정이 만드는 이름 그대로 설치본 네 개와 latest.yml이 들어감',()=>{
  const v='0.3.0', name=(pattern,arch,ext)=>pattern.replace('${version}',v).replace('${arch}',arch).replace('${ext}',ext);
  const files=releaseFiles(v);
  assert.ok(files.includes(name(pkg.build.nsis.artifactName,'x64','exe')));
  assert.ok(files.includes(name(pkg.build.nsis.artifactName,'x64','exe')+'.blockmap'));
  assert.ok(files.includes(name(pkg.build.portable.artifactName,'x64','exe')));
  for(const arch of ['arm64','x64'])assert.ok(files.includes(name(pkg.build.mac.artifactName,arch,'dmg')));
  assert.ok(files.includes('latest.yml'));
  assert.equal(files.length,6);
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
