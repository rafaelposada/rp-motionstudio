// RP MotionStudio — Rafael Posada, 2026. Apache-2.0 (build tooling only).
// FFmpeg and x264 retain GPL-2.0-or-later, distributed as separate executables.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const sources=[
  {name:'ffmpeg-9.0.2.tar.gz',url:'https://codeload.github.com/FFmpeg/FFmpeg/tar.gz/946fcce07b6dcd0331c8cc609192aeff5e1924f8',sha256:'0aa2b1de2a5698b20a23e93d539a9a8e82ca0117496c5bdf05d198805f42bb3b'},
  {name:'x264-c24e06c.tar.gz',url:'https://codeload.github.com/mirror/x264/tar.gz/c24e06c2e184345ceb33eb20a15d1024d9fd3497',sha256:'090d730e867fc63631782a1287974635d1237d0fa7c6fd1d09fd543620a56689'},
  {name:'zlib-1.3.2.tar.gz',url:'https://codeload.github.com/madler/zlib/tar.gz/refs/tags/v1.3.2',sha256:'b99a0b86c0ba9360ec7e78c4f1e43b1cbdf1e6936c8fa0f6835c0cd694a495a1'},
];
const cross={name:'llvm-mingw.tar.xz',url:'https://github.com/mstorsjo/llvm-mingw/releases/download/20261020/llvm-mingw-20261020-ucrt-macos-universal.tar.xz',sha256:'e9c13e4ede38e715003ffc674d4d00a1088df8235439d1f0c16188ff0704c17e'};
async function hash(file){return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');}
async function download(item,directory){
  const file=path.join(directory,item.name);try{await fs.access(file);}catch{execFileSync('/usr/bin/curl',['-fsSL','--retry','2','--max-time','240',item.url,'-o',file],{stdio:'inherit'});}
  if(await hash(file)!==item.sha256)throw Error(`SHA-256 inválido: ${item.name}`);return file;
}
async function main(){
  const [target,workArg,outputArg]=process.argv.slice(2);
  if(process.platform!=='darwin'||!['darwin-arm64','win32-x64'].includes(target)||![workArg,outputArg].every(p=>p&&path.isAbsolute(p)))throw Error('Uso no Mac: node scripts/build-media.cjs darwin-arm64|win32-x64 /pasta/temporaria /pasta/saida');
  const workRoot=await fs.realpath(workArg),work=path.join(workRoot,target),output=path.join(outputArg,target),downloads=path.join(workRoot,'downloads');
  await fs.mkdir(work,{recursive:true});await fs.mkdir(downloads,{recursive:true});
  const record=[];
  const run=(bin,args,cwd=work,env={})=>new Promise((resolve,reject)=>{
    record.push({bin,args});const log=path.join(work,'build.log'),stream=require('node:fs').createWriteStream(log,{flags:'a'});
    const child=spawn(bin,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
    child.once('error',e=>{stream.end();reject(e);});child.once('exit',async code=>{stream.end();code===0?resolve():reject(Error(`${target}: ${bin} (${code})\n${(await fs.readFile(log,'utf8')).slice(-4500)}`));});
  });
  const ffSource=path.join(work,'ffmpeg-source'),xSource=path.join(work,'x264-source');
  for(const [i,dir]of [ffSource,xSource].entries()){
    const archive=await download(sources[i],downloads);
    await fs.mkdir(dir,{recursive:true});execFileSync('/usr/bin/tar',['-xf',archive,'-C',dir,'--strip-components=1']);
  }
  const prefix=path.join(work,'prefix'),win=target==='win32-x64';let crossPrefix='';
  if(win){
    await download(cross,downloads);const toolchain=path.join(workRoot,'llvm-mingw-20261020-ucrt-macos-universal');
    try{await fs.access(toolchain);}catch{execFileSync('/usr/bin/tar',['-xf',path.join(downloads,cross.name),'-C',workRoot]);}
    crossPrefix=path.join(toolchain,'bin/x86_64-w64-mingw32-');
  }
  const pkgConfig=process.env.RP_PKG_CONFIG||'pkg-config',nasm=process.env.RP_NASM||'nasm';
  const env={PATH:`${path.dirname(nasm)}:${process.env.PATH}`,PKG_CONFIG_LIBDIR:path.join(prefix,'lib/pkgconfig'),PKG_CONFIG_PATH:path.join(prefix,'lib/pkgconfig'),MACOSX_DEPLOYMENT_TARGET:'13.0'};
  const zSource=path.join(work,'zlib-source');await fs.mkdir(zSource,{recursive:true});execFileSync('/usr/bin/tar',['-xf',await download(sources[2],downloads),'-C',zSource,'--strip-components=1']);
  console.log(`${target}: compiling static zlib for PNG/GIF`);
  if(win){
    await run('make',['-f','win32/Makefile.gcc','-j4',`PREFIX=${crossPrefix}`,'libz.a'],zSource,env);
    await fs.mkdir(path.join(prefix,'lib'),{recursive:true});await fs.mkdir(path.join(prefix,'include'),{recursive:true});
    await fs.copyFile(path.join(zSource,'libz.a'),path.join(prefix,'lib/libz.a'));for(const header of ['zlib.h','zconf.h'])await fs.copyFile(path.join(zSource,header),path.join(prefix,'include',header));
  }else{
    await run(path.join(zSource,'configure'),['--static',`--prefix=${prefix}`],zSource,env);await run('make',['-j4'],zSource,env);await run('make',['install'],zSource,env);
  }
  const xArgs=[`--prefix=${prefix}`,'--enable-static','--disable-cli','--disable-opencl',...(win?['--host=x86_64-w64-mingw32',`--cross-prefix=${crossPrefix}`,'--extra-ldflags=-static'] : ['--host=aarch64-apple-darwin','--extra-cflags=-mmacosx-version-min=13.0','--extra-ldflags=-mmacosx-version-min=13.0'])];
  console.log(`${target}: compiling x264`);await run(path.join(xSource,'configure'),xArgs,xSource,env);await run('make',['-j4'],xSource,env);await run('make',['install-lib-static'],xSource,env);
  const fArgs=[`--prefix=${prefix}`,'--disable-autodetect','--disable-shared','--enable-static','--enable-gpl','--enable-libx264','--enable-zlib','--disable-doc','--disable-debug','--disable-ffplay','--disable-avdevice','--disable-network','--disable-encoders','--enable-encoder=libx264,aac,gif,png,mjpeg,pcm_s16le',`--pkg-config=${pkgConfig}`,'--pkg-config-flags=--static',`--extra-cflags=-I${prefix}/include${win?'':' -mmacosx-version-min=13.0'}`,`--extra-ldflags=-L${prefix}/lib${win?' -static':' -mmacosx-version-min=13.0'}`,...(win?['--target-os=mingw32','--arch=x86_64','--enable-cross-compile',`--cross-prefix=${crossPrefix}`]:['--arch=aarch64','--cc=clang'])];
  console.log(`${target}: compiling FFmpeg + FFprobe`);await run(path.join(ffSource,'configure'),fArgs,ffSource,env);await run('make',['-j4','ffmpeg'+(win?'.exe':''),'ffprobe'+(win?'.exe':'')],ffSource,env);
  const bin=path.join(output,'bin'),licenses=path.join(output,'licenses'),sourceDir=path.join(licenses,'Corresponding-Source');await fs.mkdir(bin,{recursive:true});await fs.mkdir(sourceDir,{recursive:true});
  for(const tool of ['ffmpeg','ffprobe']){const name=tool+(win?'.exe':'');await fs.copyFile(path.join(ffSource,name),path.join(bin,name));await fs.chmod(path.join(bin,name),0o755);if(!win)execFileSync('/usr/bin/codesign',['--force','--sign','-',path.join(bin,name)],{stdio:'ignore'});}
  for(const item of sources)await fs.copyFile(path.join(downloads,item.name),path.join(sourceDir,item.name));
  await fs.copyFile(__filename,path.join(sourceDir,'build-media.cjs'));
  await fs.copyFile(path.join(ffSource,'COPYING.GPLv2'),path.join(licenses,'FFmpeg-GPL-2.0.txt'));await fs.copyFile(path.join(xSource,'COPYING'),path.join(licenses,'x264-GPL-2.0.txt'));
  await fs.copyFile(path.join(zSource,'zlib.h'),path.join(licenses,'zlib-LICENSE-and-header.txt'));
  if(win){const compiler=path.join(workArg,'llvm-mingw-20261020-ucrt-macos-universal');await fs.copyFile(path.join(compiler,'LICENSE.TXT'),path.join(licenses,'LLVM-MinGW-NOTICE.txt'));await fs.copyFile(path.join(compiler,'x86_64-w64-mingw32/share/mingw32/COPYING.MinGW-w64-runtime.txt'),path.join(licenses,'MinGW-w64-runtime.txt'));}
  await fs.writeFile(path.join(sourceDir,'BUILD.json'),JSON.stringify({target,sources,compiler:win?cross:{name:'Apple Command Line Tools',deploymentTarget:'13.0'},commands:record,nasm:execFileSync(nasm,['-v'],{encoding:'utf8'}).trim()},null,2));
  await fs.writeFile(path.join(licenses,'README.txt'),'FFmpeg 9.0.2 and x264 are unmodified, separately executed programs under GPL version 2 or later. Copyright belongs to the respective FFmpeg and x264 authors. Complete corresponding source archives and the exact build script/options are included in Corresponding-Source. A system C compiler, make, pkg-config and NASM are general-purpose build prerequisites; LLVM-MinGW is needed to cross-compile Windows from macOS. These media programs are aggregated with RP MotionStudio and do not replace its Apache-2.0 license.\nhttps://ffmpeg.org/\nhttps://www.videolan.org/developers/x264.html\n');
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({format:'rp-media',version:1,target,ffmpeg:'9.0.2',x264:sources[1].url,license:'GPL-2.0-or-later',correspondingSource:'licenses/Corresponding-Source'},null,2));
  console.log(`${target}: media package ready at ${output}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
