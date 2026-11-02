// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
// In-app updates for the desktop edition. The release, file name and checksum
// come only from rafaelposada/rp-motionstudio's latest GitHub release; the
// renderer can ask for an update but never chooses what is downloaded.
const fs = require('node:fs'), fsp = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const {spawn, execFile} = require('node:child_process');
const exec = require('node:util').promisify(execFile);
const REPO = 'rafaelposada/rp-motionstudio', VERSION = /^\d+\.\d+\.\d+$/;
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
const suffix = () => process.platform === 'darwin' && process.arch === 'arm64' ? 'macOS-Apple-Silicon.dmg' : process.platform === 'win32' && process.arch === 'x64' ? 'Windows-x64-Setup-Preview.exe' : null;

function createUpdater({net, app, root, onProgress}) {
  let staged = null, running = null;
  const json = async (url) => {
    const response = await net.fetch(url, {headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'RP-MotionStudio-Updater'}});
    if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? 'Limite temporário do GitHub. Tente mais tarde.' : 'Não foi possível consultar o GitHub.');
    return response.json();
  };
  async function release() {
    const data = await json(`https://api.github.com/repos/${REPO}/releases/latest`);
    const version = String(data.tag_name || '').replace(/^v/, ''), end = suffix();
    if (!VERSION.test(version) || data.draft || data.prerelease || !end) throw Error('Nenhum instalador compatível foi publicado para este sistema.');
    const name = `RP-MotionStudio-${version}-${end}`, prefix = `https://github.com/${REPO}/releases/download/v${version}/`;
    const asset = data.assets?.find((item) => item.name === name), sum = data.assets?.find((item) => item.name === `${name}.sha256`);
    if (!asset || !sum || asset.browser_download_url !== prefix + name || sum.browser_download_url !== prefix + name + '.sha256') throw Error('O instalador publicado ainda não está completo.');
    return {version, name, url: asset.browser_download_url, sumUrl: sum.browser_download_url, size: asset.size};
  }
  async function download(target) {
    const dir = path.join(root, 'download'); await fsp.rm(dir, {recursive: true, force: true}); await fsp.mkdir(dir, {recursive: true});
    const expected = (await (await net.fetch(target.sumUrl)).text()).trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{64}$/.test(expected)) throw Error('Soma de verificação inválida na Release.');
    const response = await net.fetch(target.url);
    if (!response.ok || !response.body) throw Error('Não foi possível baixar a atualização.');
    const file = path.join(dir, target.name), out = fs.createWriteStream(file, {flags: 'wx'}), hash = crypto.createHash('sha256');
    const total = Number(response.headers.get('content-length')) || target.size || 0;
    let received = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) break;
        hash.update(value); received += value.length; onProgress({phase: 'downloading', received, total});
        if (!out.write(value)) await new Promise((resolve) => out.once('drain', resolve));
      }
    } finally { await new Promise((resolve) => out.end(resolve)); }
    if (hash.digest('hex') !== expected) { await fsp.rm(file, {force: true}); throw Error('O arquivo baixado não confere com a Release. Nada foi instalado.'); }
    return file;
  }
  // macOS: copy the app out of the DMG into a staging folder and validate it.
  async function stageMac(file, version) {
    const mount = path.join(root, 'mount'), stagedApp = path.join(root, 'staged', 'RP MotionStudio Desktop.app');
    await fsp.rm(path.dirname(stagedApp), {recursive: true, force: true}); await fsp.mkdir(path.dirname(stagedApp), {recursive: true}); await fsp.mkdir(mount, {recursive: true});
    await exec('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mount, file]);
    try { await exec('/usr/bin/ditto', [path.join(mount, 'RP MotionStudio Desktop.app'), stagedApp]); }
    finally { await exec('/usr/bin/hdiutil', ['detach', mount, '-force']).catch(() => {}); }
    await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', stagedApp]);
    const {stdout} = await exec('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(stagedApp, 'Contents/Info.plist')]);
    if (stdout.trim() !== version) throw Error('A versão do pacote baixado não confere.');
    return stagedApp;
  }
  async function prepare() {
    if (running) return running;
    running = (async () => {
      const target = await release();
      if (!newer(target.version, app.getVersion())) throw Error('Você já está na versão mais recente.');
      if (staged?.version === target.version) return {version: target.version};
      const file = await download(target);
      onProgress({phase: 'installing'});
      staged = {version: target.version, file, app: process.platform === 'darwin' ? await stageMac(file, target.version) : null};
      onProgress({phase: 'ready', version: target.version});
      return {version: target.version};
    })().finally(() => { running = null; });
    return running;
  }
  // Swaps the bundle after this process exits, then reopens the new version.
  async function apply() {
    if (!staged) throw Error('Baixe a atualização antes de instalar.');
    const pid = String(process.pid);
    if (process.platform === 'darwin') {
      const bundle = path.resolve(process.execPath, '..', '..', '..');
      if (!bundle.endsWith('.app')) throw Error('Instalação do aplicativo não reconhecida.');
      await fsp.access(path.dirname(bundle), fs.constants.W_OK).catch(() => { throw Error('Sem permissão para substituir o aplicativo nesta pasta. Mova-o para Aplicativos do seu usuário ou instale pelo .dmg.'); });
      const script = `while /bin/kill -0 "$1" 2>/dev/null; do /bin/sleep 0.3; done
/bin/rm -rf "$2.previous"; /bin/mv "$2" "$2.previous" && /bin/mv "$3" "$2" && /bin/rm -rf "$2.previous" || { [ -d "$2" ] || /bin/mv "$2.previous" "$2"; }
/usr/bin/open "$2"`;
      spawn('/bin/sh', ['-c', script, 'rp-update', pid, bundle, staged.app], {detached: true, stdio: 'ignore'}).unref();
    } else if (process.platform === 'win32') {
      const cmd = path.join(root, 'apply-update.cmd');
      await fsp.writeFile(cmd, `@echo off\r\n:wait\r\ntasklist /FI "PID eq ${pid}" 2>NUL | find "${pid}" >NUL && (timeout /t 1 /nobreak >NUL & goto wait)\r\n"${staged.file}" /S\r\nstart "" "${process.execPath}"\r\n`);
      spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', cmd], {detached: true, stdio: 'ignore', windowsHide: true}).unref();
    } else throw Error('Sistema sem instalador automático.');
  }
  return {prepare, apply, staged: () => staged?.version ?? null};
}
module.exports = {createUpdater};
