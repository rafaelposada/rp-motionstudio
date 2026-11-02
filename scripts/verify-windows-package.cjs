// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
async function digest(file){const hash=crypto.createHash('sha256');for await(const data of fs.createReadStream(file))hash.update(data);return hash.digest('hex');}
async function main(){
  const [source,extracted]=process.argv.slice(2);if(![source,extracted].every(p=>p&&path.isAbsolute(p)))throw Error('Informe o pacote win32 e o conteúdo extraído do instalador.');
  let files=0;const privateFiles=[];
  async function walk(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const rel=path.join(relative,entry.name),file=path.join(dir,entry.name);
    if(entry.isDirectory()){await walk(file,rel);continue;}
    assert.ok(entry.isFile(),`Unsupported file: ${rel}`);
    if(/^\.env(?:\.|$)|\.motion\.zip$|\.mov$/i.test(entry.name))privateFiles.push(rel);
    assert.equal(await digest(file),await digest(path.join(extracted,rel)),`Installer payload mismatch: ${rel}`);files++;
  }}
  await walk(source);assert.deepEqual(privateFiles,[]);
  for(const name of ['RP-MotionStudio.exe','resources/media/bin/ffmpeg.exe','resources/media/bin/ffprobe.exe']){
    const file=path.join(extracted,name),handle=fs.openSync(file,'r'),header=Buffer.alloc(4096);fs.readSync(handle,header,0,header.length,0);fs.closeSync(handle);
    assert.equal(header.readUInt16LE(0),0x5a4d);const at=header.readUInt32LE(0x3c);assert.equal(header.readUInt32LE(at),0x4550);assert.equal(header.readUInt16LE(at+4),0x8664,`${name}: expected x64`);
  }
  const pkg=JSON.parse(fs.readFileSync(path.join(extracted,'resources/app/package.json'),'utf8'));
  assert.equal(pkg.version,JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version);assert.ok(fs.existsSync(path.join(extracted,'Desinstalar RP MotionStudio.exe')));
  for(const file of ['ffmpeg-9.0.2.tar.gz','x264-c24e06c.tar.gz','zlib-1.3.2.tar.gz','BUILD.json','build-media.cjs'])assert.ok(fs.existsSync(path.join(extracted,'resources/media/licenses/Corresponding-Source',file)),`Missing source: ${file}`);
  console.log(JSON.stringify({filesCompared:files,version:pkg.version,platform:'Windows x64',bundledTools:['ffmpeg','ffprobe'],installerPayload:'byte-for-byte match',correspondingSources:true,privateFiles:0,windowsExecutionTested:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
