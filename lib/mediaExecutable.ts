// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
import path from 'node:path';
export function mediaExecutable(tool:'ffmpeg'|'ffprobe',platform:NodeJS.Platform=process.platform,env:NodeJS.ProcessEnv=process.env){
  if(env.RP_MOTION_DESKTOP!=='1')return tool;
  const directory=env.RP_MEDIA_BIN;
  if(!directory||!path.isAbsolute(directory))throw Error('Componentes de mídia ausentes. Reinstale o pacote completo do RP MotionStudio.');
  return path.join(directory,tool+(platform==='win32'?'.exe':''));
}
