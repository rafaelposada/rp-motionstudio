// RP MotionStudio desktop additions — Rafael Posada, 2026. Apache-2.0.
const c=require('./update-common.cjs'),{execFileSync}=require('node:child_process');
async function main(){
  const target=process.argv.find(arg=>arg.startsWith('--target='))?.slice(9)||`${process.platform}-${process.arch}`;
  if(!['darwin-arm64','win32-x64'].includes(target))throw Error('Destino desktop ainda não preparado.');
  const [platform,arch]=target.split('-');
  const source=c.path.resolve(__dirname,'..'),out=c.path.join(source,'dist-desktop'),runtime=c.path.join(out,'runtime'),stage=c.path.join(out,'shell');
  await c.fs.access(c.path.join(source,'.next','standalone','server.js'));
  execFileSync(process.execPath,[c.path.join(source,'scripts','build-brand-icons.cjs')],{stdio:'inherit'});
  await c.fs.mkdir(out,{recursive:true});
  const marker=c.path.join(out,'.rp-generated.json');
  const previous=await c.readJson(marker);
  if(previous?.generatedBy!=='rp-motionstudio-desktop'&&(await c.fs.readdir(out)).length)throw Error('A pasta de saída já contém arquivos não identificados.');
  await c.atomic(marker,{generatedBy:'rp-motionstudio-desktop'});
  for(const dir of [runtime,stage]){if(!c.contained(out,dir))throw Error('Destino inválido.');await c.fs.rm(dir,{recursive:true,force:true});}
  await c.copyApp(source,runtime);
  if(platform==='win32'){
    const modules=process.env.RP_WINDOWS_MODULES;
    if(!modules||!c.path.isAbsolute(modules))throw Error('Prepare as dependências Windows com npm ci --os=win32 --cpu=x64 --ignore-scripts e informe RP_WINDOWS_MODULES.');
    for(const name of ['sharp','@img','@next']){
      const from=c.path.join(modules,name),to=c.path.join(runtime,'node_modules',name);
      try{await c.fs.access(from);}catch{if(name==='@next')continue;throw Error(`Dependência Windows ausente: ${name}`);}
      await c.fs.rm(to,{recursive:true,force:true});await c.fs.cp(from,to,{recursive:true,verbatimSymlinks:true});
    }
  }
  const mediaRoot=process.env.RP_MEDIA_ROOT||c.path.join(out,'media-builds'),media=c.path.join(out,'media');
  const prepared=c.path.join(mediaRoot,target),manifest=await c.readJson(c.path.join(prepared,'manifest.json'));
  if(manifest?.format!=='rp-media'||manifest.target!==target)throw Error('Prepare os binários de mídia específicos deste sistema antes de empacotar.');
  for(const tool of ['ffmpeg','ffprobe'])await c.fs.access(c.path.join(prepared,'bin',tool+(platform==='win32'?'.exe':'')));
  await c.fs.rm(media,{recursive:true,force:true});await c.fs.cp(prepared,media,{recursive:true,verbatimSymlinks:true});
  await c.fs.mkdir(stage,{recursive:true});
  await c.fs.cp(c.path.join(source,'desktop'),c.path.join(stage,'desktop'),{recursive:true});
  for(const name of ['LICENSE','NOTICE','licenses'])await c.fs.cp(c.path.join(source,name),c.path.join(stage,name),{recursive:true});
  const pkg=await c.readJson(c.path.join(source,'package.json'));
  await c.atomic(c.path.join(stage,'package.json'),{name:'rp-motionstudio-desktop',productName:'RP MotionStudio Desktop',version:pkg.version,main:'desktop/main.cjs',author:'Rafael Posada <contato@rafaelposada.com>',license:pkg.license});
  if(process.argv.includes('--prepare')){console.log('Runtime desktop preparado.');return;}
  let icon;
  if(platform==='darwin'){
    const iconset=c.path.join(out,'rp.iconset');await c.fs.mkdir(iconset,{recursive:true});
    for(const size of [16,32,128,256,512])for(const scale of [1,2])execFileSync('/usr/bin/sips',['-z',String(size*scale),String(size*scale),c.path.join(source,'public','apple-touch-icon.png'),'--out',c.path.join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`)],{stdio:'ignore'});
    icon=c.path.join(out,'rp.icns');execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',icon]);
  }
  if(platform==='win32'){
    const png=c.path.join(out,'rp-256.png');execFileSync('/usr/bin/sips',['-z','256','256',c.path.join(source,'public','apple-touch-icon.png'),'--out',png],{stdio:'ignore'});
    const data=await c.fs.readFile(png),header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(data.length,14);header.writeUInt32LE(22,18);
    icon=c.path.join(out,'rp.ico');await c.fs.writeFile(icon,Buffer.concat([header,data]));
  }
  const {packager}=await import('@electron/packager');
  const result=await packager({dir:stage,name:'RP MotionStudio Desktop',appBundleId:'com.rafaelposada.rpmotionstudio.desktop',appVersion:pkg.version,buildVersion:pkg.version,
    executableName:platform==='win32'?'RP-MotionStudio':'RP MotionStudio Desktop',platform,arch,out:c.path.join(out,'packages'),overwrite:true,asar:false,
    extraResource:[runtime,media],icon,prune:false,osxSign:false,osxNotarize:false,...(platform==='win32'?{windowsSign:false,win32metadata:{CompanyName:'Rafael Posada',FileDescription:'RP MotionStudio',ProductName:'RP MotionStudio'}}:{}),appCopyright:'Copyright © 2026 Rafael Posada and respective contributors',
    extendInfo:{NSHighResolutionCapable:true},
  });
  for(const directory of result){
    if(platform==='darwin'){
      const bundle=c.path.join(directory,'RP MotionStudio Desktop.app');
      // Local ad-hoc signature repairs the generated bundle's integrity; no
      // paid Developer ID, notarization or system security settings are used.
      execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',bundle],{stdio:'inherit'});
      execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});
    }
    console.log(directory);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
