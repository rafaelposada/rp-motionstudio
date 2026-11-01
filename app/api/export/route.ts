import { NextRequest, NextResponse } from 'next/server';
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { destinationFor, isLocalFileRequest } from '@/lib/localDestinations';
import { audioFilter } from '@/lib/audioEnvelope';
import { probeAudioDuration } from '@/lib/serverAudio';
import {updaterBusy} from '@/lib/updateServer';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Video proxies must remain browser-readable. Finished exports are written
// straight to the user's Movies folder and never depend on a browser download.
const PROXIES_DIR = path.join(process.cwd(), 'public', 'exports');

// sessionId/index/fps feed into filesystem paths and ffmpeg filter strings —
// accept only the exact shapes we generate ourselves.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const processState = globalThis as typeof globalThis & { motionExports?: Map<string, { child?: ChildProcess; cancelled: boolean; log: string; directory: string }> };
const sessions = processState.motionExports ??= new Map();

function sessionDir(id: string) {
  return path.join(os.tmpdir(), `motion-export-${id}`);
}

function run(cmd: string, args: string[], sessionId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (session?.cancelled) { reject(new Error('Exportação cancelada.')); return; }
    const p = spawn(cmd, args);
    if (session) session.child = p;
    let stderr = '';
    p.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-12000); if (session) session.log = stderr; });
    p.on('error', reject);
    p.on('close', (code) => {
      if (session) session.child = undefined;
      if (session?.cancelled) { reject(new Error('Exportação cancelada.')); return; }
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

// Build an all-intra (every-frame-keyframe) proxy of an uploaded video. Normal
// H.264 has keyframes seconds apart, so the per-frame seeks the export loop does
// force the browser to re-decode a whole GOP per captured frame — that's why
// exports crawl with video cards. An intra-only proxy makes every seek decode
// exactly one frame. Body: raw video bytes; response: { url } under /exports.
export async function PUT(req: NextRequest) {
  if (!isLocalFileRequest(req)) return NextResponse.json({ error: 'Acesso local necessário.' }, { status: 403 });
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) return NextResponse.json({ error: 'empty body' }, { status: 400 });
    if (buf.length > 512 * 1024 * 1024) return NextResponse.json({ error: 'too large' }, { status: 413 });
    const contentHash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24);
    await fs.mkdir(PROXIES_DIR, { recursive: true });
    const out = `proxy_${contentHash}.mp4`;
    const outPath = path.join(PROXIES_DIR, out);
    try {
      const existing = await fs.stat(outPath);
      if (existing.size > 0) return NextResponse.json({ url: `/exports/${out}` });
    } catch { /* build and cache it below */ }
    const id = crypto.randomUUID();
    const dir = sessionDir(id);
    await fs.mkdir(dir, { recursive: true });
    const input = path.join(dir, 'proxy-input');
    await fs.writeFile(input, buf);
    // -g 1: intra-only · -an: card videos render muted · veryfast keeps this a
    // few-seconds one-time cost, cached client-side per asset
    await run('ffmpeg', ['-y', '-i', input, '-an', '-c:v', 'libx264', '-preset', 'veryfast',
      '-tune', 'fastdecode', '-g', '1', '-bf', '0', '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', outPath]);
    await fs.rm(dir, { recursive: true, force: true });
    return NextResponse.json({ url: `/exports/${out}` });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalFileRequest(req)) return NextResponse.json({ error: 'Acesso local necessário.' }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const { action } = body;

  try {
    if (action === 'cancel') {
      if (!UUID_RE.test(String(body.sessionId))) return NextResponse.json({ error: 'bad session' }, { status: 400 });
      const session = sessions.get(body.sessionId);
      if (session) { session.cancelled = true; session.child?.kill('SIGTERM'); }
      if (!session?.child) await fs.rm(sessionDir(body.sessionId), { recursive: true, force: true });
      return NextResponse.json({ ok: true });
    }
    if (action === 'status') {
      if (!UUID_RE.test(String(body.sessionId))) return NextResponse.json({ error: 'bad session' }, { status: 400 });
      return NextResponse.json({ log: sessions.get(body.sessionId)?.log ?? '', cancelled: sessions.get(body.sessionId)?.cancelled ?? false });
    }
    if (action === 'begin') {
      if(await updaterBusy())return NextResponse.json({error:'Aguarde a atualização do aplicativo antes de exportar.'},{status:409});
      const id = crypto.randomUUID();
      await fs.mkdir(sessionDir(id), { recursive: true });
      const directory=await destinationFor('exports');
      if(await updaterBusy()){await fs.rm(sessionDir(id),{recursive:true,force:true});return NextResponse.json({error:'Aguarde a atualização do aplicativo antes de exportar.'},{status:409});}
      sessions.set(id, { cancelled: false, log: '', directory });
      setTimeout(() => sessions.delete(id), 3600000).unref();
      return NextResponse.json({ sessionId: id });
    }

    if (action === 'frame') {
      const { sessionId, index, dataUrl } = body;
      const idx = Number(index);
      if (!UUID_RE.test(String(sessionId)) || !Number.isInteger(idx) || idx < 0 || idx > 99999) {
        return NextResponse.json({ error: 'bad params' }, { status: 400 });
      }
      const dir = sessionDir(sessionId);
      if (!sessions.has(sessionId) || sessions.get(sessionId)?.cancelled) return NextResponse.json({ error: 'Sessão encerrada.' }, { status: 400 });
      const base64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
      const file = path.join(dir, `frame_${String(idx).padStart(5, '0')}.jpg`);
      await fs.writeFile(file, Buffer.from(base64, 'base64'));
      return NextResponse.json({ ok: true });
    }

    if (action === 'encode') {
      const { sessionId, format, audio, width, height } = body;
      const fps = Number(body.fps);
      if (!UUID_RE.test(String(sessionId)) || !Number.isFinite(fps) || fps <= 0 || fps > 120) {
        return NextResponse.json({ error: 'bad params' }, { status: 400 });
      }
      const dir = sessionDir(sessionId);
      const pattern = path.join(dir, 'frame_%05d.jpg');
      const session = sessions.get(sessionId);
      if (!session || session.cancelled) return NextResponse.json({ error: 'Sessão encerrada.' }, { status: 400 });
      const outputDirectory = session.directory;
      await fs.mkdir(outputDirectory, { recursive: true });

      // Exact output size when the client provides one (already even-rounded);
      // otherwise just force even dimensions, which yuv420p requires.
      const w = Number(width), h = Number(height);
      const sizeFilter =
        Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0
          ? `scale=${w - (w % 2)}:${h - (h % 2)}:flags=lanczos`
          : 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos';

      let audioFile: string | null = null;
      let sourceAudioDuration = 0;
      if (audio) {
        audioFile = path.join(dir, 'audio.input');
        await fs.writeFile(audioFile, Buffer.from(audio, 'base64'));
        sourceAudioDuration = await probeAudioDuration(audioFile);
      }

      const files: string[] = [];

      if (format === 'mp4' || format === 'both') {
        const out = `motion_${sessionId}.mp4`;
        const outPath = path.join(outputDirectory, out);
        const args = ['-y', '-start_number', '0', '-framerate', String(fps), '-i', pattern];
        if (audioFile) args.push('-i', audioFile);
        args.push('-vf', sizeFilter);
        // veryfast: 2–4× faster encode than the default 'medium' for a marginal
        // size increase. Server-side encoding lets us save directly to disk.
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-crf', '18');
        if (audioFile) {
          const frameCount = (await fs.readdir(dir)).filter(name => /^frame_\d{5}\.jpg$/.test(name)).length;
          args.push('-af', audioFilter(body.audioSettings, frameCount / fps, sourceAudioDuration), '-c:a', 'aac', '-shortest');
        }
        args.push(outPath);
        await run('ffmpeg', args, sessionId);
        files.push(out);
      }

      if (format === 'gif' || format === 'both') {
        const palette = path.join(dir, 'palette.png');
        const out = `motion_${sessionId}.gif`;
        const outPath = path.join(outputDirectory, out);
        await run('ffmpeg', ['-y', '-start_number', '0', '-framerate', String(fps), '-i', pattern,
          '-vf', `fps=${fps},${sizeFilter},palettegen`, palette], sessionId);
        await run('ffmpeg', ['-y', '-start_number', '0', '-framerate', String(fps), '-i', pattern, '-i', palette,
          '-filter_complex', `fps=${fps},${sizeFilter} [x]; [x][1:v] paletteuse`, outPath], sessionId);
        files.push(out);
      }

      // clean temp frames
      await fs.rm(dir, { recursive: true, force: true });

      sessions.delete(sessionId);
      return NextResponse.json({ files, directory: outputDirectory });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    const failed=sessions.get(body.sessionId);if(failed)failed.cancelled=true;
    if (UUID_RE.test(String(body.sessionId)) && sessions.get(body.sessionId)?.cancelled) {
      await fs.rm(sessionDir(body.sessionId), { recursive: true, force: true });
      const directory = sessions.get(body.sessionId)?.directory;
      if (directory) await Promise.all(['mp4', 'gif'].map((extension) => fs.rm(path.join(directory, `motion_${body.sessionId}.${extension}`), { force: true })));
    }
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
