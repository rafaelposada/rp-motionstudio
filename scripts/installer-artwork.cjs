// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
const fs=require('node:fs/promises'),path=require('node:path');
// Standard 24-bit BMP works with the native NSIS bitmap controls at any DPI.
function bitmap(data,width,height){
  const stride=(width*3+3)&~3,out=Buffer.alloc(54+stride*height);
  out.write('BM');out.writeUInt32LE(out.length,2);out.writeUInt32LE(54,10);out.writeUInt32LE(40,14);
  out.writeInt32LE(width,18);out.writeInt32LE(height,22);out.writeUInt16LE(1,26);out.writeUInt16LE(24,28);out.writeUInt32LE(stride*height,34);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*3,o=54+(height-1-y)*stride+x*3;out[o]=data[i+2];out[o+1]=data[i+1];out[o+2]=data[i];}
  return out;
}
async function artwork(directory){
  const sharp=require('sharp'),root=path.resolve(__dirname,'..');await fs.mkdir(directory,{recursive:true});
  const mark=(await fs.readFile(path.join(root,'public/rp-desktop-icon.svg'))).toString('base64');
  const rail=`<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314"><rect width="164" height="314" fill="#17181b"/><rect x="24" y="24" width="28" height="3" rx="1.5" fill="#3296ff"/><image x="17" y="45" width="130" height="130" href="data:image/svg+xml;base64,${mark}"/><g font-family="Arial, sans-serif" fill="#f5f5f7"><text x="25" y="201" font-size="19" font-weight="600">RP Motion</text><text x="25" y="226" font-size="19" font-weight="600">Studio</text><text x="25" y="261" font-size="10" fill="#b4bbc7">FFmpeg incluído</text><text x="25" y="291" font-size="9" fill="#b4bbc7">Rafael Posada</text></g></svg>`;
  const header=`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57"><rect width="150" height="57" fill="#ffffff"/><image x="97" y="3" width="51" height="51" href="data:image/svg+xml;base64,${mark}"/></svg>`;
  for(const [name,svg] of [['welcome',rail],['header',header]]){
    const {data,info}=await sharp(Buffer.from(svg)).flatten({background:'#ffffff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    await fs.writeFile(path.join(directory,name+'.bmp'),bitmap(data,info.width,info.height));
    await sharp(Buffer.from(svg),{density:144}).png().toFile(path.join(directory,name+'.png'));
  }
  const png=await sharp(path.join(root,'public/apple-touch-icon.png')).resize(256,256).png().toBuffer(),ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);await fs.writeFile(path.join(directory,'rp.ico'),Buffer.concat([ico,png]));
  return directory;
}
module.exports={artwork,bitmap};
