import { NextRequest } from 'next/server';
import { realtimeHub, RealtimeMessage } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial SSE connection message
  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`));

  const handleEvent = (message: RealtimeMessage) => {
    try {
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
      'Connection': 'keep-alive',
    },
  });
}
