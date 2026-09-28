import { NextRequest } from 'next/server';
import { realtimeHub, RealtimeMessage } from '@/lib/realtime';
import { verifySessionToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // SECURITY: Authenticate SSE connections — reject unauthenticated clients
  const cookieToken = req.cookies.get('cosko_session')?.value;
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Authentication required for realtime events' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const sessionResult = verifySessionToken(token);
  if (!sessionResult || !sessionResult.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = sessionResult.user;
  const userStores = user.allowedStores || [user.store];
  const isSuperAdmin = user.role === 'Super Admin';

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial SSE connection message
  writer.write(
    encoder.encode(
      `data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`
    )
  );

  const handleEvent = (message: RealtimeMessage) => {
    try {
      // Store-scoped event filtering: non-admins only receive events for their assigned stores
      if (!isSuperAdmin && message.payload?.storeCode) {
        if (!userStores.includes(message.payload.storeCode)) {
          return; // Skip events for stores the user doesn't have access to
        }
      }
      writer.write(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
    } catch {
      // client disconnected
      realtimeHub.off('event', handleEvent);
    }
  };

  realtimeHub.on('event', handleEvent);

  req.signal.addEventListener('abort', () => {
    realtimeHub.off('event', handleEvent);
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
