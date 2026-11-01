// Integration fixture: only the isolated local server and generated test media.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),sharp=require('sharp');
async function main(){
  const base=process.argv[2];if(base!=='http://127.0.0.1:3002')throw Error('Use isolated test server 3002.');
  const folder=fs.mkdtempSync(path.resolve('verification/audio-fade-')),wave=path.join(folder,'synthetic.wav');
  cp.execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-ar','44100',wave]);
  const post=async(body)=>{const r=await fetch(base+'/api/export',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,200,JSON.stringify(json));return json;};
  const destination=path.resolve('verification/saved-exports');
  const set=await fetch(base+'/api/destinations',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'set',kind:'exports',path:destination})});assert.equal(set.status,200);
  const jpeg=await sharp({create:{width:64,height:64,channels:3,background:'#20252f'}}).jpeg().toBuffer();
  const {sessionId}=await post({action:'begin'});
  for(let i=0;i<30;i+=4)await Promise.all(Array.from({length:Math.min(4,30-i)},(_,n)=>post({action:'frame',sessionId,index:i+n,dataUrl:'data:image/jpeg;base64,'+jpeg.toString('base64')})));
  const result=await post({action:'encode',sessionId,fps:15,format:'mp4',width:64,height:64,audio:fs.readFileSync(wave).toString('base64'),audioSettings:{volume:.5,fadeIn:.5,fadeOut:.5}});
  const output=path.join(result.directory,result.files[0]);assert.ok(output.startsWith(destination+path.sep)&&fs.existsSync(output));
  const raw=cp.execFileSync('ffmpeg',['-v','error','-i',output,'-vn','-ac','1','-ar','44100','-f','f32le','pipe:1']);
  const rms=(start,end)=>{let sum=0,count=0;for(let i=Math.floor(start*44100);i<Math.floor(end*44100)&&i*4<raw.length;i++){const v=raw.readFloatLE(i*4);sum+=v*v;count++;}return Math.sqrt(sum/count);};
  const start=rms(.005,.045),middle=rms(.9,1.1),end=rms(1.955,1.995);
  assert.ok(middle>.01);assert.ok(start<middle*.2,`Entrance ${start}/${middle}`);assert.ok(end<middle*.2,`Exit ${end}/${middle}`);
  console.log('MP4 audio integration passed: generated 2s soundtrack, 30 captured frames, disk output and decoded AAC fades.',{start,middle,end});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
