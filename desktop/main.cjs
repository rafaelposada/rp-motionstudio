// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
const {app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell, utilityProcess, nativeImage} = require('electron');
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto'), nodeNet = require('node:net');
const {APP_ORIGIN, trustedURL, externalURL, closeCoordinator} = require('./policy.cjs');
const {prepareRuntime}=require('./runtime.cjs');
const {execFile}=require('node:child_process');
const exec= require('node:util').promisify(execFile);
protocol.registerSchemesAsPrivileged([{scheme:'rp-motion',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,codeCache:true}}]);
const profile = process.env.RP_DESKTOP_PROFILE;
if (profile && !path.isAbsolute(profile)) throw Error('RP_DESKTOP_PROFILE must be absolute.');
app.setName('RP MotionStudio Desktop');
app.setPath('userData', profile || path.join(app.getPath('appData'), 'RP MotionStudio Desktop'));
app.setPath('sessionData', path.join(app.getPath('userData'), 'Browser'));
const bundledRuntime = app.isPackaged ? path.join(process.resourcesPath,'runtime') : path.join(__dirname,'..','dist-desktop','runtime');
let runtime=bundledRuntime;
const mediaBin=app.isPackaged?path.join(process.resourcesPath,'media','bin'):path.join(__dirname,'..','dist-desktop','media',`${process.platform}-${process.arch}`,'bin');
let win, server, serverOrigin, closing = false, exiting = false, ready = false;
const requests = new Map();
const validSender = event => !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && trustedURL(event.senderFrame?.url || '');
ipcMain.on('rp:ready',event=>{if(validSender(event))ready=true;});
function request(action, timeout = 120000) {
  if (!ready || !win || win.isDestroyed()) return Promise.reject(Error('O editor ainda está carregando. Tente fechar novamente quando abrir.'));
  const id = crypto.randomUUID();
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => {requests.delete(id);reject(Error('O editor não respondeu. A janela foi mantida para proteger seu trabalho.'));},timeout);
    requests.set(id,{resolve,reject,timer});win.webContents.send('rp:request',{id,action});
  });
}
ipcMain.on('rp:response',(event,message) => {
  if (!validSender(event) || typeof message?.id !== 'string') return;
  const waiting = requests.get(message.id); if (!waiting) return;
  clearTimeout(waiting.timer);requests.delete(message.id);
  if (message.result?.ok === true) waiting.resolve(message.result.value);
  else waiting.reject(Error(String(message.result?.error || 'Não foi possível concluir a operação.').slice(0,1000)));
});
ipcMain.on('rp:appearance',(event,theme) => {
  if (!validSender(event) || !['light','dark'].includes(theme)) return;
  win.setBackgroundColor(theme === 'dark' ? '#0c0d0f' : '#eef1f5');
  if (process.platform === 'win32') win.setTitleBarOverlay({color:theme === 'dark' ? '#0c0d0f' : '#eef1f5',symbolColor:theme === 'dark' ? '#ffffff' : '#141414',height:38});
});
ipcMain.handle('rp:choose-folder',async event => {
  if (!validSender(event)) throw Error('Origem inválida.');
  const result = await dialog.showOpenDialog(win,{title:'Escolher pasta',properties:['openDirectory','createDirectory']});
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('rp:open-project',async event => {
  if (!validSender(event)) throw Error('Origem inválida.');
  const result = await dialog.showOpenDialog(win,{title:'Abrir rascunho ou template',properties:['openFile'],filters:[{name:'RP MotionStudio (.motion.zip)',extensions:['zip']}]});
  if (result.canceled) return null;
  const file = result.filePaths[0], stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > 512*1024*1024) throw Error('Escolha um pacote de até 512 MB.');
  return {name:path.basename(file),bytes:new Uint8Array(await fs.readFile(file))};
});
async function freePort() {
  return new Promise((resolve,reject) => {const socket=nodeNet.createServer();socket.once('error',reject);socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(error=>error?reject(error):resolve(port));});});
}
async function startServer() {
  for(const tool of ['ffmpeg','ffprobe']){
    const executable=path.join(mediaBin,tool+(process.platform==='win32'?'.exe':''));
    const result=await exec(executable,['-version'],{timeout:15000,windowsHide:true});
    if(!result.stdout.startsWith(`${tool} version `))throw Error(`Componente de mídia inválido: ${tool}`);
  }
  runtime=await prepareRuntime(bundledRuntime,path.join(app.getPath('userData'),'Runtime'));
  const port = await freePort(), instance = crypto.randomUUID();serverOrigin=`http://127.0.0.1:${port}`;
  const safePath = [process.env.PATH || '', '/opt/homebrew/bin','/usr/local/bin','/usr/bin','/bin'].join(path.delimiter);
  server = utilityProcess.fork(path.join(runtime,'server.js'),[],{cwd:runtime,stdio:'pipe',serviceName:'RP MotionStudio · arquivos e exportação',env:{
    NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),PATH:safePath,
    ...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),...(process.env.WINDIR?{WINDIR:process.env.WINDIR}:{}),
    ...(process.env.HOME?{HOME:process.env.HOME}:{}),...(process.env.USERPROFILE?{USERPROFILE:process.env.USERPROFILE}:{}),
    ...(process.env.TEMP?{TEMP:process.env.TEMP}:{}),...(process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{}),
    RP_MOTION_CONFIG_DIR:path.join(app.getPath('userData'),'Config'),RP_MOTION_DESKTOP:'1',RP_MEDIA_BIN:mediaBin,RP_MOTION_INSTANCE:instance,NEXT_TELEMETRY_DISABLED:'1',
  }});
  let tail = '', exited = false;
  const log = data => {tail=(tail+data.toString()).slice(-3000);};server.stdout?.on('data',log);server.stderr?.on('data',log);
  server.once('exit',()=>{exited=true;if(ready&&!exiting)dialog.showErrorBox('RP MotionStudio','O serviço local foi encerrado. Mantenha esta janela aberta para preservar a edição.\n'+tail.slice(-500));});
  for(let i=0;i<100;i++){
    if(exited)throw Error('O serviço local não iniciou.\n'+tail);
    try{const response=await fetch(`${serverOrigin}/api/diagnostics`,{signal:AbortSignal.timeout(1000)});const data=await response.json();if(response.ok&&data.instance===instance)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('O serviço local demorou demais para iniciar.\n'+tail);
}
function menuCommand(action) { void request(action).catch(error=>dialog.showErrorBox('RP MotionStudio',error.message)); }
function setMenu() {
  const file={label:'Arquivo',submenu:[
    {label:'Abrir rascunho ou template…',accelerator:'CmdOrCtrl+O',click:()=>menuCommand('open-project')},
    {label:'Salvar composição',accelerator:'CmdOrCtrl+S',click:()=>menuCommand('save-local')},
    {label:'Salvar rascunho…',accelerator:'CmdOrCtrl+Shift+S',click:()=>menuCommand('save-draft-notify')},
    {type:'separator'}, {label:'Fechar janela',accelerator:'CmdOrCtrl+W',click:()=>win?.close()},
    ...(process.platform==='darwin'?[]:[{label:'Sair',accelerator:'Alt+F4',click:()=>app.quit()}]),
  ]};
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{label:'RP MotionStudio Desktop',submenu:[{role:'about'},{type:'separator'},{label:'Ajustes…',accelerator:'Cmd+,',click:()=>menuCommand('settings')},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit',label:'Sair do RP MotionStudio'}]}]:[]),
    file,{label:'Editar',submenu:[{label:'Desfazer',accelerator:'CmdOrCtrl+Z',click:()=>menuCommand('undo')},{label:'Refazer',accelerator:'CmdOrCtrl+Shift+Z',click:()=>menuCommand('redo')},...(process.platform==='win32'?[{label:'Refazer (alternativa)',accelerator:'Ctrl+Y',click:()=>menuCommand('redo')}]:[]),{type:'separator'},{role:'cut',label:'Recortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Colar'},{label:'Selecionar tudo',accelerator:'CmdOrCtrl+A',click:()=>menuCommand('select-all')}]},
    {label:'Camadas',submenu:[{label:'Levar seleção ao topo',accelerator:'CmdOrCtrl+Shift+]',click:()=>menuCommand('arrange-front')},{label:'Enviar seleção ao fundo',accelerator:'CmdOrCtrl+Shift+[',click:()=>menuCommand('arrange-back')}]},
    {label:'Visualizar',submenu:[{role:'togglefullscreen',label:'Tela cheia'}]},
    {label:'Ajuda',submenu:[{label:'Rafael Posada',click:()=>shell.openExternal('https://rafaelposada.com')},{label:'Reportar problema',click:()=>shell.openExternal('https://github.com/rafaelposada/rp-motionstudio/issues')}]},
  ]));
}
async function createWindow() {
  const icon=path.join(runtime,'public','apple-touch-icon.png');
  win=new BrowserWindow({title:'RP MotionStudio Desktop',width:1440,height:940,minWidth:960,minHeight:640,show:false,backgroundColor:'#0c0d0f',icon,
    titleBarStyle:'hidden',trafficLightPosition:{x:16,y:13},...(process.platform==='win32'?{titleBarOverlay:{color:'#0c0d0f',symbolColor:'#ffffff',height:38}}:{}),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,spellcheck:false},
  });
  if(process.platform==='darwin')app.dock?.setIcon(nativeImage.createFromPath(icon));
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.webContents.session.setPermissionCheckHandler(()=>false);
  win.webContents.setWindowOpenHandler(({url})=>{if(externalURL(url))void shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(!trustedURL(url)){event.preventDefault();if(externalURL(url))void shell.openExternal(url);}});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  const close=closeCoordinator({request,confirm:async copy=>(await dialog.showMessageBox(win,{type:'question',...copy,defaultId:0,cancelId:2,noLink:true})).response,
    showError:async message=>dialog.showMessageBox(win,{type:'error',title:'O aplicativo foi mantido aberto',message,buttons:['Voltar ao editor']}),
    finish:async()=>{await win.webContents.session.flushStorageData();closing=true;win.close();},
  });
  win.on('close',event=>{if(closing)return;event.preventDefault();void close();});
  win.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)ready=false;});
  win.once('ready-to-show',()=>win.show());
  setMenu();await win.loadURL(`${APP_ORIGIN}/`);
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{exiting=true;server?.kill();for(const waiting of requests.values()){clearTimeout(waiting.timer);waiting.reject(Error('Aplicativo encerrado.'));}requests.clear();});
  app.whenReady().then(async()=>{
    await startServer();
    protocol.handle('rp-motion',async request=>{
      if(!trustedURL(request.url))return new Response('Forbidden',{status:403});
      const u=new URL(request.url),headers=new Headers(request.headers);
      headers.delete('host');headers.delete('connection');headers.delete('referer');headers.set('origin',serverOrigin);headers.set('accept-encoding','identity');
      try{
        const response=await net.fetch(serverOrigin+u.pathname+u.search,{method:request.method,headers,redirect:'error',...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{}),bypassCustomProtocolHandlers:true});
        const resultHeaders=new Headers(response.headers);
        resultHeaders.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'");
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers:resultHeaders});
      }catch{return new Response('Serviço local indisponível',{status:503});}
    });
    await createWindow();
  }).catch(error=>{dialog.showErrorBox('Não foi possível abrir o RP MotionStudio',error.message);exiting=true;server?.kill();app.exit(1);});
}
