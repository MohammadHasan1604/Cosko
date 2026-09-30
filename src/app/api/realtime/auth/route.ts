import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import PusherServer from 'pusher';
import { authenticateRequest } from '@/lib/authPipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/realtime/auth
 *
 * Secure server authorization endpoint for private & presence Pusher channels.
 *
 * Rules:
 * 1. Authenticates caller via HttpOnly session (never trusts client headers/body for role/store).
 * 2. Checks active DB user status.
 * 3. Enforces strict RBAC channel ownership:
 *    - private-enterprise / private-global: Super Admin ONLY.
 *    - private-work-activity / presence-work-activity: Super Admin ONLY.
 *    - private-attendance: Super Admin ONLY.
 *    - private-store-<storeCode>: Super Admin can access all authorized stores.
 *      Store Manager and Sales Manager can ONLY access their own assigned store.
 *      Cross-store subscription attempts are strictly rejected with 403 Forbidden.
 *    - private-user-<userId>: Super Admin or own userId.
 * 4. Signs Pusher authorization response.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    if (user.status?.toUpperCase() !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Forbidden: Account is inactive or suspended.' },
        { status: 403 }
      );
    }

    // Parse socket_id and channel_name from request body
    // Pusher client can send application/x-www-form-urlencoded or application/json
    let socketId = '';
    let channelName = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      socketId = body.socket_id || '';
      channelName = body.channel_name || '';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      socketId = params.get('socket_id') || '';
      channelName = params.get('channel_name') || '';
    } else {
      try {
        const formData = await req.formData();
        socketId = (formData.get('socket_id') as string) || '';
        channelName = (formData.get('channel_name') as string) || '';
      } catch {
        const body = await req.json().catch(() => ({}));
        socketId = body.socket_id || '';
        channelName = body.channel_name || '';
      }
    }

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'socket_id and channel_name parameters are required' },
        { status: 400 }
      );
    }

    const isSuperAdmin = user.role === 'Super Admin' || user.securityLevel >= 100;
    const userStore = (user.store && user.store !== 'All Stores' ? user.store : 'BLR').toUpperCase();

    // 🔒 Channel Authorization Matrix
    let isAuthorized = false;
    let denialMessage = '';

    if (
      channelName === 'private-enterprise' ||
      channelName === 'private-global' ||
      channelName === 'store-global'
    ) {
      if (isSuperAdmin) {
        isAuthorized = true;
      } else {
        denialMessage = 'Forbidden: Enterprise channel is restricted to Super Admin.';
      }
    } else if (
      channelName === 'private-work-activity' ||
      channelName === 'presence-work-activity' ||
      channelName === 'work-activity'
    ) {
      if (isSuperAdmin) {
        isAuthorized = true;
      } else {
        denialMessage = 'Forbidden: Work Activity channel is restricted to Super Admin.';
      }
    } else if (channelName === 'private-attendance' || channelName === 'attendance') {
      if (isSuperAdmin) {
        isAuthorized = true;
      } else {
        denialMessage = 'Forbidden: Attendance management channel is restricted to Super Admin.';
      }
    } else if (
      channelName.startsWith('private-store-') ||
      channelName.startsWith('store-')
    ) {
      const requestedStore = channelName
        .replace(/^private-store-/, '')
        .replace(/^store-/, '')
        .toUpperCase();

      if (isSuperAdmin) {
        // Super Admin may access any store channel
        isAuthorized = true;
      } else {
        // Store Manager & Sales Manager are strictly locked to own store
        if (requestedStore === userStore) {
          isAuthorized = true;
        } else {
          denialMessage = `Forbidden: Cross-store subscription not permitted. You are assigned to ${userStore}, cannot subscribe to ${requestedStore}.`;
        }
      }
    } else if (
      channelName.startsWith('private-user-') ||
      channelName.startsWith('user-')
    ) {
      const requestedUserId = channelName
        .replace(/^private-user-/, '')
        .replace(/^user-/, '');

      if (isSuperAdmin || requestedUserId === user.id) {
        isAuthorized = true;
      } else {
        denialMessage = 'Forbidden: Cannot subscribe to another user channel.';
      }
    } else {
      denialMessage = `Forbidden: Channel '${channelName}' is not recognized or permitted.`;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: denialMessage || 'Forbidden' }, { status: 403 });
    }

    // ─── Sign Pusher Authorization ─────────────────────────────────────────────
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2';

    if (appId && key && secret) {
      try {
        const pusher = new PusherServer({
          appId,
          key,
          secret,
          cluster,
          useTLS: true,
        });

        if (channelName.startsWith('presence-')) {
          const authResponse = pusher.authorizeChannel(socketId, channelName, {
            user_id: user.id,
            user_info: {
              name: user.name,
              role: user.role,
              store: userStore,
            },
          });
          return NextResponse.json(authResponse);
        } else {
          const authResponse = pusher.authorizeChannel(socketId, channelName);
          return NextResponse.json(authResponse);
        }
      } catch (pusherErr: any) {
        console.error('[Pusher Auth] authorizeChannel error:', pusherErr);
        return NextResponse.json(
          { error: 'Pusher authorization signature failed' },
          { status: 500 }
        );
      }
    } else {
      // Offline / Test / Fallback HMAC signature generation
      const signSecret = secret || process.env.AUTH_SECRET || 'cosko_fallback_realtime_secret';
      const signKey = key || 'cosko_dev_key';

      if (channelName.startsWith('presence-')) {
        const channelData = JSON.stringify({
          user_id: user.id,
          user_info: { name: user.name, role: user.role, store: userStore },
        });
        const hmac = crypto.createHmac('sha256', signSecret);
        hmac.update(`${socketId}:${channelName}:${channelData}`);
        const auth = `${signKey}:${hmac.digest('hex')}`;
        return NextResponse.json({ auth, channel_data: channelData });
      } else {
        const hmac = crypto.createHmac('sha256', signSecret);
        hmac.update(`${socketId}:${channelName}`);
        const auth = `${signKey}:${hmac.digest('hex')}`;
        return NextResponse.json({ auth });
      }
    }
  } catch (err: any) {
    console.error('API /api/realtime/auth error:', err);
    return NextResponse.json(
      { error: err?.message || 'Realtime authorization failed' },
      { status: 500 }
    );
  }
}
