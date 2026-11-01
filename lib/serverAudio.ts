import { execFile } from 'node:child_process';
export function probeAudioDuration(file: string): Promise<number> {
  return new Promise((resolve,reject)=>execFile('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{timeout:10000,maxBuffer:16384},(error,stdout)=>{
    const duration=Number(stdout.trim());
    if(error || !Number.isFinite(duration) || duration<=0)reject(new Error('Não foi possível ler a duração do áudio.'));
    else resolve(duration);
  }));
}
