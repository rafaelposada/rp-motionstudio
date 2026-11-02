// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
async function main(){
  const directory=process.argv[2];if(!directory||!path.isAbsolute(directory))throw Error('Informe o pacote de mídia local.');
  const ffmpeg=path.join(directory,'bin/ffmpeg'),ffprobe=path.join(directory,'bin/ffprobe');
  const env={...process.env,PATH:'/usr/bin:/bin'};
  const run=(tool,args,options={})=>cp.execFileSync(tool,['-v','error',...args],{env,maxBuffer:10*1024*1024,...options});
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rp-bundled-media-test-'));
  try{
    const frames=Buffer.alloc(64*64*3*30);for(let f=0;f<30;f++)for(let p=0;p<64*64;p++){const at=(f*64*64+p)*3;frames[at]=(f*8)%256;frames[at+1]=(p%64)*4;frames[at+2]=180;}
    const pcm=Buffer.alloc(44100*2*2);for(let i=0;i<88200;i++)pcm.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/44100)*12000),i*2);
    const video=path.join(folder,'video.rgb'),audio=path.join(folder,'audio.pcm'),mp4=path.join(folder,'test.mp4'),gif=path.join(folder,'test.gif'),palette=path.join(folder,'palette.png');
    fs.writeFileSync(video,frames);fs.writeFileSync(audio,pcm);
    run(ffmpeg,['-f','rawvideo','-pixel_format','rgb24','-video_size','64x64','-framerate','15','-i',video,'-f','s16le','-ar','44100','-ac','1','-i',audio,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-af','volume=0.5,afade=t=in:st=0:d=0.5,afade=t=out:st=1.5:d=0.5','-t','2',mp4]);
    const info=JSON.parse(run(ffprobe,['-show_streams','-show_format','-of','json',mp4],{encoding:'utf8'}));
    assert.equal(info.streams.find(s=>s.codec_type==='video').codec_name,'h264');assert.equal(info.streams.find(s=>s.codec_type==='audio').codec_name,'aac');assert.ok(Math.abs(Number(info.format.duration)-2)<.2);
    run(ffmpeg,['-i',mp4,'-vf','palettegen',palette]);run(ffmpeg,['-i',mp4,'-i',palette,'-lavfi','paletteuse',gif]);assert.ok(fs.statSync(gif).size>100);
    const raw=run(ffmpeg,['-i',mp4,'-vn','-ac','1','-ar','44100','-f','s16le','pipe:1']);
    const rms=(a,b)=>{let sum=0,n=0;for(let i=Math.floor(a*44100);i<Math.floor(b*44100)&&i*2<raw.length;i++){const v=raw.readInt16LE(i*2)/32768;sum+=v*v;n++;}return Math.sqrt(sum/n);};
    const middle=rms(.9,1.1);assert.ok(middle>.05);assert.ok(rms(.005,.045)<middle*.2);assert.ok(rms(1.955,1.995)<middle*.2);
    console.log('Bundled-only media passed with Homebrew absent from PATH: H.264 + AAC, FFprobe duration, MP4, GIF palette and audio fades.');
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
