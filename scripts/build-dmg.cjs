// RP MotionStudio desktop — Copyright 2026 Rafael Posada. Apache-2.0.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
async function main(){
  if(process.platform!=='darwin')throw Error('Gere o DMG em um Mac.');
  const root=path.resolve(__dirname,'..');
  const source=process.argv[2]&&path.resolve(process.argv[2]);
  const output=process.argv[3]&&path.resolve(process.argv[3]);
  if(!source?.endsWith('.app')||!output?.endsWith('.dmg'))throw Error('Uso: node scripts/build-dmg.cjs /caminho/app.app /caminho/arquivo.dmg');
  try{await fs.access(output);throw Error('O destino já existe; nenhum arquivo foi substituído.');}catch(error){if(error.code!=='ENOENT')throw error;}
  execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',source],{stdio:'inherit'});
  const plist=path.join(source,'Contents/Info.plist');
  const version=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',plist],{encoding:'utf8'}).trim();
  if(version!=='1.4.14')throw Error('Atualize o guia de instalação para a versão deste aplicativo.');
  const executable=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleExecutable',plist],{encoding:'utf8'}).trim();
  const architectures=execFileSync('/usr/bin/lipo',['-archs',path.join(source,'Contents/MacOS',executable)],{encoding:'utf8'}).trim();
  if(architectures!=='arm64')throw Error('Este guia corresponde somente ao pacote Apple Silicon.');
  const python=process.env.RP_DMG_PYTHON||'python3';
  try{execFileSync(python,['-c','import dmgbuild'],{stdio:'ignore'});}catch{throw Error('Para gerar o DMG, prepare Python com dmgbuild==1.6.7 e informe RP_DMG_PYTHON. Essa ferramenta não é necessária para instalar ou usar o app.');}
  const stage=await fs.mkdtemp(path.join(os.tmpdir(),'rp-dmg-stage-'));
  try{
    const sharp=require('sharp'),vector=await fs.readFile(path.join(root,'desktop/installer/mac-background.svg'));
    const background=path.join(stage,'background.tiff');
    for(const scale of [1,2])await sharp(vector,{density:72*scale}).resize(760*scale,480*scale).withMetadata({density:72*scale}).tiff({compression:'lzw'}).toFile(path.join(stage,`background${scale===2?'@2x':''}.tiff`));
    await fs.mkdir(path.dirname(output),{recursive:true});
    execFileSync(python,['-m','dmgbuild','-s',path.join(root,'scripts/dmg-settings.py'),'-D',`application=${source}`,'-D',`guide=${path.join(root,'docs/INSTALAR-macOS.md')}`,'-D',`background=${background}`,`RP MotionStudio ${version}`,output],{stdio:'inherit'});
    execFileSync('/usr/bin/hdiutil',['verify',output],{stdio:'inherit'});
    const hash=crypto.createHash('sha256');
    for await(const chunk of require('node:fs').createReadStream(output))hash.update(chunk);
    const digest=hash.digest('hex');
    await fs.writeFile(output+'.sha256',`${digest}  ${path.basename(output)}\n`,{flag:'wx'});
    console.log(JSON.stringify({output,bytes:(await fs.stat(output)).size,sha256:digest,architectures,version}));
  }finally{await fs.rm(stage,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
