// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import { NextRequest, NextResponse } from 'next/server';
import { chooseDestination, getDestinations, isDestinationKind, isLocalFileRequest, setDestination } from '@/lib/localDestinations';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  if (!isLocalFileRequest(request)) return NextResponse.json({ error: 'Acesso local necessário.' }, { status: 403 });
  try { return NextResponse.json(await getDestinations()); }
  catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  if (!isLocalFileRequest(request)) return NextResponse.json({ error: 'Acesso local necessário.' }, { status: 403 });
  try {
    const body = await request.json();
    if (!isDestinationKind(body.kind)) return NextResponse.json({ error: 'Destino inválido.' }, { status: 400 });
    if (body.action === 'choose') return NextResponse.json(await chooseDestination(body.kind));
    if (body.action === 'set' && typeof body.path === 'string') return NextResponse.json(await setDestination(body.kind, body.path));
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
