// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Deterministic vector rasterization: the editable SVG is the source of truth.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('sharp');
async function main(){
  const root=path.resolve(__dirname,'..'),source=await fs.readFile(path.join(root,'public/rp-desktop-icon.svg'));
  for(const [file,size] of [['apple-touch-icon.png',1024],['rp-motionstudio.png',1024],['apple-touch-icon-180.png',180]]){
    await sharp(source).resize(size,size).png().toFile(path.join(root,'public',file));
  }
  const {data,info}=await sharp(path.join(root,'public/apple-touch-icon.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [x,y] of [[0,0],[512,0],[1023,1023],[0,512]])if(data[(y*info.width+x)*4+3]!==0)throw Error('As margens do ícone devem ser transparentes.');
  if(data[(512*info.width+512)*4+3]!==255)throw Error('O centro do ícone deve ser opaco.');
  console.log('Ícones RP gerados do SVG, sem TM, com margens transparentes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
