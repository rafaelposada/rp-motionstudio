import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { destinationFor, isLocalFileRequest } from '@/lib/localDestinations';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!isLocalFileRequest(request)) return NextResponse.json({ error: 'Acesso local necessário.' }, { status: 403 });
  try {
    const data = Buffer.from(await request.arrayBuffer());
    if (!data.length || data.length > 512 * 1024 * 1024) return NextResponse.json({ error: 'Limite de 512 MB.' }, { status: 413 });
    const name = decodeURIComponent(request.headers.get('X-Project-Name') ?? 'Projeto').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 70) || 'Projeto';
    const kind = request.headers.get('X-Package-Kind') === 'template' ? 'templates' : 'drafts';
    const directory = await destinationFor(kind);
    const output = path.join(directory, `${name}${kind === 'templates' ? '_template' : ''}_${crypto.randomUUID().slice(0, 8)}.motion.zip`);
    await fs.writeFile(output, data, { flag: 'wx' });
    return NextResponse.json({ path: output });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
