import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const data = Buffer.from(await request.arrayBuffer());
    if (!data.length || data.length > 512 * 1024 * 1024) return NextResponse.json({ error: 'Limite de 512 MB.' }, { status: 413 });
    const name = decodeURIComponent(request.headers.get('X-Project-Name') ?? 'Projeto').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 70) || 'Projeto';
    const directory = path.join(os.homedir(), 'Documents', 'Motion Studio Projects');
    await fs.mkdir(directory, { recursive: true });
    const output = path.join(directory, `${name}_${crypto.randomUUID().slice(0, 8)}.motion.zip`);
    await fs.writeFile(output, data, { flag: 'wx' });
    return NextResponse.json({ path: output });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
