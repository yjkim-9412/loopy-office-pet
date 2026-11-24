// Publishes the Windows installer to the update store (the R2 bucket behind update-server/worker.js).
// CI runs it on the Windows runner after electron-builder, only for pushes to main.
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (a token for this one bucket) and R2_BUCKET;
// without them it says so and does nothing. It publishes only a version newer than the one in the store,
// refuses to overwrite an installer that is already there, and writes latest.yml last so installed apps
// never see a version whose installer isn't uploaded yet.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { newer, latestVersion } = require('../app/update.cjs');

const env = process.env;
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter(k => !env[k]);
if (missing.length) {
  console.log(`Update store is not set up (missing ${missing.join(', ')}): nothing published.`);
  process.exit(0);
}
const root = path.resolve(__dirname, '..');
const release = path.join(root, 'release');
const yml = fs.readFileSync(path.join(release, 'latest.yml'), 'utf8');
const version = latestVersion(yml);
const file = /^path:\s*['"]?([^'"\s]+)/m.exec(yml)?.[1];
const pkg = require('../package.json').version;
if (version !== pkg) throw Error(`latest.yml says ${version} but package.json says ${pkg}`);
if (!file || !/^LoopyOffice-Setup-[\w.-]+\.exe$/.test(file) || !fs.existsSync(path.join(release, file)))
  throw Error(`latest.yml points at ${file}, which is not the Setup installer in release/`);

const bucket = `s3://${env.R2_BUCKET}/win/`;
function aws(args, quiet = false) {
  return execFileSync('aws', [...args, '--endpoint-url', `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, '--region', 'auto'], {
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'inherit'],
    env: {
      ...env,
      AWS_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
      // R2 doesn't take the extra checksums newer AWS CLIs send by default
      AWS_REQUEST_CHECKSUM_CALCULATION: 'WHEN_REQUIRED',
      AWS_RESPONSE_CHECKSUM_VALIDATION: 'WHEN_REQUIRED',
    },
  });
}
const exists = key => { try { aws(['s3api', 'head-object', '--bucket', env.R2_BUCKET, '--key', key], true); return true; } catch { return false; } };

let published = null;
try { published = latestVersion(aws(['s3', 'cp', bucket + 'latest.yml', '-'], true)); } catch {}
if (published && !newer(version, published)) {
  console.log(`The store already has ${published}; ${version} is not newer, so nothing was published. Bump the version to release.`);
  process.exit(0);
}
if (exists('win/' + file)) throw Error(`${file} is already in the store; bump the version instead of replacing it.`);

aws(['s3', 'cp', path.join(release, file), bucket + file, '--content-type', 'application/octet-stream', '--no-progress']);
if (fs.existsSync(path.join(release, file + '.blockmap')))
  aws(['s3', 'cp', path.join(release, file + '.blockmap'), bucket + file + '.blockmap', '--content-type', 'application/octet-stream', '--no-progress']);
aws(['s3', 'cp', path.join(release, 'latest.yml'), bucket + 'latest.yml', '--content-type', 'text/yaml; charset=utf-8', '--cache-control', 'no-store', '--no-progress']);
console.log(`Published ${version} (${file}) to the update store${published ? `, replacing ${published}` : ''}.`);
