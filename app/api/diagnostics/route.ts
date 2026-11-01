import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {APP_VERSION} from '@/lib/appVersion';
import { destinationFor, isLocalFileRequest } from '@/lib/localDestinations';
const exec = promisify(execFile);
export const runtime = 'nodejs';
const folders = { exports: path.join(os.homedir(), 'Movies', 'Motion Studio Exports'), projects: path.join(os.homedir(), 'Documents', 'Motion Studio Projects') };
export async function GET() {
  let ffmpeg = '';
  try { ffmpeg = (await exec('ffmpeg', ['-version'], { timeout: 5000 })).stdout.split('\n')[0]; } catch { /* report unavailable */ }
  return NextResponse.json({ version: `${APP_VERSION}-local`,instance:process.env.RP_MOTION_INSTANCE??null, ffmpeg: ffmpeg || 'Indisponível', freeMemoryMB: Math.round(os.freemem() / 1048576), localOnly: true });
}
export async function POST(request: NextRequest) {
  if (!isLocalFileRequest(request)) return NextResponse.json({ error: 'Acesso local necessário.' }, { status: 403 });
  try {
    const { folder } = await request.json();
    if (folder !== 'exports' && folder !== 'projects') return NextResponse.json({ error: 'Pasta inválida.' }, { status: 400 });
    const directory = await destinationFor(folder === 'exports' ? 'exports' : 'drafts');
    await fs.mkdir(directory, { recursive: true });
    await exec('/usr/bin/open', [directory], { timeout: 5000 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Não foi possível abrir a pasta.' }, { status: 500 }); }
}
