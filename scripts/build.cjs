const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const native = path.join(root, 'build', 'native');
fs.mkdirSync(native, {recursive: true});
// where updates come from (app/update.cjs). Only builds that are given both values check for updates.
const updateConfig = path.join(root, 'app', 'update-config.json');
if (process.env.LOOPY_UPDATE_URL && process.env.LOOPY_UPDATE_KEY)
  fs.writeFileSync(updateConfig, JSON.stringify({url: process.env.LOOPY_UPDATE_URL, key: process.env.LOOPY_UPDATE_KEY}));
else fs.rmSync(updateConfig, {force: true});
if (process.platform === 'win32') {
  const compiler = ['Framework64','Framework'].map(folder =>
    path.join(process.env.SystemRoot, 'Microsoft.NET', folder, 'v4.0.30319', 'csc.exe')).find(fs.existsSync);
  if (!compiler) throw Error('Windows .NET Framework 4 C# compiler is required for the Explorer helper.');
  execFileSync(compiler, ['/nologo', '/optimize+', '/target:exe', '/platform:anycpu',
    '/out:' + path.join(native, 'ExplorerEdge.exe'), path.join(root, 'native', 'ExplorerEdge.cs')], {stdio:'inherit'});
} else if (process.platform === 'darwin') {
  const architecture = (process.env.LOOPY_ARCH || process.arch)==='x64'?'x86_64':'arm64';
  execFileSync('xcrun',['swiftc','-O','-target',architecture+'-apple-macos12.0',
    path.join(root,'native','FinderEdge.swift'),'-o',path.join(native,'FinderEdge')],{stdio:'inherit'});
}
esbuild.buildSync({entryPoints:[path.join(root,'ui','panel.tsx')],outfile:path.join(root,'ui','panel.bundle.js'),
  bundle:true,platform:'browser',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'},
  nodePaths:require.resolve.paths('react'),legalComments:'eof'});
esbuild.buildSync({entryPoints:[path.join(root,'ui','fonts.css')],outfile:path.join(root,'ui','fonts.bundle.css'),
  bundle:true,minify:true,loader:{'.woff2':'file','.woff':'file'},assetNames:'fonts/[name]-[hash]',
  nodePaths:require.resolve.paths('react'),legalComments:'eof'});
