const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const native = path.join(root, 'build', 'native');
fs.mkdirSync(native, {recursive: true});
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
