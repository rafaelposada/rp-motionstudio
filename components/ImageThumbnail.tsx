// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
'use client';
import { useEffect, useRef } from 'react';
import { loadPreviewImage } from '@/lib/textureLoad';

export default function ImageThumbnail({url,name,onClick,title}:{url:string;name:string;onClick:()=>void;title?:string}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    let active=true;
    void loadPreviewImage(url).then(image=>{
      const canvas=ref.current;if(!active||!canvas||!image)return;
      const ctx=canvas.getContext('2d');if(!ctx)return;
      const scale=Math.max(canvas.width/image.width,canvas.height/image.height);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,(canvas.width-image.width*scale)/2,(canvas.height-image.height*scale)/2,image.width*scale,image.height*scale);
    });
    return()=>{active=false;};
  },[url]);
  return <canvas ref={ref} className="asset-thumb" width={96} height={96} role="img" aria-label={name} title={title} onClick={onClick}/>;
}
