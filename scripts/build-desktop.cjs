// RP MotionStudio desktop additions — Rafael Posada, 2026. Apache-2.0.
const c=require('./update-common.cjs'),{execFileSync}=require('node:child_process');
async function main(){
  const source=c.path.resolve(__dirname,'..'),out=c.path.join(source,'dist-desktop'),runtime=c.path.join(out,'runtime'),stage=c.path.join(out,'shell');
  await c.fs.access(c.path.join(source,'.next','standalone','server.js'));
  await c.fs.mkdir(out,{recursive:true});
  const marker=c.path.join(out,'.rp-generated.json');
  const previous=await c.readJson(marker);
  if(previous?.generatedBy!=='rp-motionstudio-desktop'&&(await c.fs.readdir(out)).length)throw Error('A pasta de saída já contém arquivos não identificados.');
  await c.atomic(marker,{generatedBy:'rp-motionstudio-desktop'});
  for(const dir of [runtime,stage]){if(!c.contained(out,dir))throw Error('Destino inválido.');await c.fs.rm(dir,{recursive:true,force:true});}
  await c.copyApp(source,runtime);
  await c.fs.mkdir(stage,{recursive:true});
  await c.fs.cp(c.path.join(source,'desktop'),c.path.join(stage,'desktop'),{recursive:true});
  for(const name of ['LICENSE','NOTICE','licenses'])await c.fs.cp(c.path.join(source,name),c.path.join(stage,name),{recursive:true});
  const pkg=await c.readJson(c.path.join(source,'package.json'));
  await c.atomic(c.path.join(stage,'package.json'),{name:'rp-motionstudio-desktop',productName:'RP MotionStudio Desktop',version:pkg.version,main:'desktop/main.cjs',author:'Rafael Posada <contato@rafaelposada.com>',license:pkg.license});
  if(process.argv.includes('--prepare')){console.log('Runtime desktop preparado.');return;}
  let icon;
  if(process.platform==='darwin'){
    const iconset=c.path.join(out,'rp.iconset');await c.fs.mkdir(iconset,{recursive:true});
    for(const size of [16,32,128,256,512])for(const scale of [1,2])execFileSync('/usr/bin/sips',['-z',String(size*scale),String(size*scale),c.path.join(source,'public','apple-touch-icon.png'),'--out',c.path.join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`)],{stdio:'ignore'});
    icon=c.path.join(out,'rp.icns');execFileSync('/usr/bin/iconutil',['-c','icns',iconset,'-o',icon]);
  }
  const {packager}=await import('@electron/packager');
  const result=await packager({dir:stage,name:'RP MotionStudio Desktop',appBundleId:'com.rafaelposada.rpmotionstudio.desktop',appVersion:pkg.version,buildVersion:pkg.version,
    executableName:process.platform==='win32'?'RP-MotionStudio':'RP MotionStudio Desktop',platform:process.platform,arch:process.arch,out:c.path.join(out,'packages'),overwrite:true,asar:false,
    extraResource:[runtime],icon,prune:false,osxSign:false,osxNotarize:false,appCopyright:'Copyright © 2026 Rafael Posada and respective contributors',
    extendInfo:{NSHighResolutionCapable:true},
  });
  for(const directory of result){
    if(process.platform==='darwin'){
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
