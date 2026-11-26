// Makes the GitHub Release (vX.Y.Z) for a new version from the installers CI just built.
// CI runs it once every build on a push to main has passed: node scripts/release.cjs <artifacts folder>.
// It does nothing when package.json's version is already released or isn't newer than the latest release,
// so merges that don't bump the version ship nothing. Installed apps read the latest release's latest.yml
// (app/update.cjs); gh uploads every file before it publishes the release, so they never see a half-made one.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { newer, latestVersion } = require('../app/update.cjs');

const NOTES = `설치한 Windows 앱(0.2.1 이상)은 루피가 알아서 이 버전으로 바꿔요. 처음 설치하거나 포터블·Mac을 쓰면 아래에서 내 컴퓨터에 맞는 파일을 받아요. 설치 방법은 저장소의 docs/INSTALL.md에 있어요.

- Windows: LoopyOffice-Setup-…-x64.exe (설치) 또는 LoopyOffice-Portable-…-x64.exe (설치 없이)
- Mac: …-mac-arm64.dmg (애플 칩) 또는 …-mac-x64.dmg (인텔)

비상업용 팬 제작물입니다. 루피(「뽀롱뽀롱 뽀로로」)와 잔망루피에 관한 권리는 권리자(아이코닉스 등)에게 있으며, 이 앱은 권리자와 관계가 없습니다.`;

// every file a release carries, named by package.json's artifactName patterns; latest.yml is what installed apps read
function releaseFiles(version, build = require('../package.json').build) {
  const name = (pattern, arch, ext) => pattern.replace('${version}', version).replace('${arch}', arch).replace('${ext}', ext);
  const setup = name(build.nsis.artifactName, 'x64', 'exe');
  return [setup, setup + '.blockmap', 'latest.yml', name(build.portable.artifactName, 'x64', 'exe'),
    name(build.mac.artifactName, 'arm64', 'dmg'), name(build.mac.artifactName, 'x64', 'dmg')];
}
// name -> path for every file under dir (downloaded artifacts keep their release/ folder)
function findFiles(dir, found = new Map()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, found);
    else found.set(entry.name, full);
  }
  return found;
}

function main(dir) {
  const version = require('../package.json').version;
  const tag = 'v' + version;
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const tagOf = (...args) => { try { return gh('release', 'view', ...args, '--json', 'tagName', '--jq', '.tagName'); } catch { return null; } };
  if (tagOf(tag)) return console.log(`${tag} is already released. Bump package.json's version to release.`);
  const latest = tagOf();
  if (latest && !newer(version, latest)) return console.log(`${version} is not newer than ${latest}: nothing released.`);

  const files = findFiles(dir), names = releaseFiles(version);
  const missing = names.filter(name => !files.has(name));
  if (missing.length) throw Error(`missing from the builds: ${missing.join(', ')}`);
  const yml = latestVersion(fs.readFileSync(files.get('latest.yml'), 'utf8'));
  if (yml !== version) throw Error(`latest.yml says ${yml} but package.json says ${version}`);
  gh('release', 'create', tag, ...names.map(name => files.get(name)),
    '--title', `Loopy Office ${version}`, '--notes', NOTES, '--target', process.env.GITHUB_SHA ?? 'main');
  console.log(`Released ${tag}${latest ? ` after ${latest}` : ''}.`);
}

if (require.main === module) main(process.argv[2] ?? 'dist');
module.exports = { releaseFiles, findFiles };
