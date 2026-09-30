import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/realtime/sync
 *
 * DB-Authoritative Event Outbox Sync.
 * Used for:
 * 1. Fallback sync when distributed realtime provider (Pusher) is not configured in env
 * 2. Reconnection recovery to catch up on missed events during offline state
 *
 * Strict Store Isolation:
 * - Super Admin: Receives all events or filtered store events
 * - Store Manager / Sales Manager: Strictly receives events for own store or global broadcasts
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;
    const isSuperAdmin = user.role === 'Super Admin' || user.securityLevel >= 100;

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor'); // ISO date string
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const where: any = {};

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = { gt: cursorDate };
      }
    }

    if (!isSuperAdmin) {
      const userStore = user.store && user.store !== 'All Stores' ? user.store : 'BLR';
      where.AND = [
        {
          OR: [
            { storeCode: userStore },
            { channel: `private-store-${userStore}` },
            { channel: `store-${userStore}` },
            { channel: `private-user-${user.id}` },
            { channel: `user-${user.id}` },
            {
              AND: [
                { storeCode: null },
                {
                  channel: {
                    in: [
                      'private-enterprise',
                      'store-global',
                      'settings',
                      'units',
                      'payment-methods',
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          OR: [{ storeCode: null }, { storeCode: userStore }],
        },
      ];
    }

    const events: any[] = await (prisma as any).realtimeOutbox.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        channel: true,
        event: true,
        payload: true,
        storeCode: true,
        createdAt: true,
      },
    });

    const parsedEvents = events.map((e: any) => {
      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(e.payload);
      } catch {
        parsedPayload = { raw: e.payload };
      }
      return {
        id: e.id,
        channel: e.channel,
        event: e.event,
        payload: parsedPayload,
        storeCode: e.storeCode,
        createdAt: e.createdAt.toISOString(),
      };
    });

    const latestCursor =
      events.length > 0 ? events[events.length - 1].createdAt.toISOString() : cursor;

    return NextResponse.json({
      success: true,
      count: parsedEvents.length,
      events: parsedEvents,
      cursor: latestCursor,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('API /api/realtime/sync error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to sync outbox events' },
      { status: 500 }
    );
  }
}
