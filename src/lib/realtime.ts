/**
 * COSKO Enterprise Realtime Architecture
 *
 * Distributed, multi-instance production-safe realtime provider.
 * Single source of truth: MySQL Database.
 * Realtime is transport/notification ONLY.
 *
 * Architecture:
 * Client mutation -> Authenticated API -> DB transaction -> Commit
 * -> Durable Outbox Event (MySQL) -> Distributed Transport (Pusher)
 * -> Subscribed clients receive notification -> Invalidate/refetch authoritative MySQL data.
 *
 * If Pusher credentials are not configured, gracefully falls back to
 * reliable DB-authoritative sync (outbox cursor polling) without claiming fake realtime.
 */

import PusherServer from 'pusher';
import { prisma } from './db';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface RealtimePayload {
  eventType: string;
  entityId?: string;
  storeCode?: string;
  timestamp: string;
  version?: string | number;
  [key: string]: any;
}

export interface RealtimeMessage {
  channel: string;
  event: string;
  payload: RealtimePayload;
  timestamp: string;
}

export interface IRealtimeProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  publish(channel: string, event: string, payload: RealtimePayload): Promise<boolean>;
}

// ─── Channel Naming Helpers (Private Authenticated Pusher Channels) ──────────

export function sanitizeChannelName(name: string): string {
  // Pusher channels allow [-a-zA-Z0-9_=@,.;]+
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getStoreChannel(storeCode?: string | null): string {
  if (!storeCode || storeCode === 'All Stores' || storeCode === 'all') {
    return 'private-enterprise';
  }
  return `private-store-${sanitizeChannelName(storeCode)}`;
}

export function getGlobalChannel(): string {
  return 'private-enterprise';
}

export function getUserChannel(userId: string): string {
  return `private-user-${sanitizeChannelName(userId)}`;
}

export function getWorkActivityChannel(): string {
  return 'private-work-activity';
}

export function getAttendanceChannel(): string {
  return 'private-attendance';
}

// Named aliases for explicit private channel ergonomics
export const getPrivateStoreChannel = getStoreChannel;
export const getPrivateGlobalChannel = getGlobalChannel;
export const getPrivateUserChannel = getUserChannel;
export const getPrivateWorkActivityChannel = getWorkActivityChannel;
export const getPrivateAttendanceChannel = getAttendanceChannel;

/**
 * Authoritative Channel Authorization Guard
 * Reused across Pusher WebSocket auth, outbox sync fallback, and reconnect recovery.
 */
export function canUserAccessChannel(
  user: { id: string; role: string; store?: string | null; securityLevel?: number },
  channelName: string
): boolean {
  const isSuperAdmin =
    user.role === 'Super Admin' || (user.securityLevel !== undefined && user.securityLevel >= 100);
  const userStore = (
    user.store && user.store !== 'All Stores' && user.store !== 'ALL' ? user.store : ''
  ).toUpperCase();

  // Enterprise & Management Channels: Super Admin ONLY
  if (
    channelName === 'private-enterprise' ||
    channelName === 'private-global' ||
    channelName === 'store-global'
  ) {
    return isSuperAdmin;
  }

  if (
    channelName === 'private-work-activity' ||
    channelName === 'presence-work-activity' ||
    channelName === 'work-activity'
  ) {
    return isSuperAdmin;
  }

  if (channelName === 'private-attendance' || channelName === 'attendance') {
    return isSuperAdmin;
  }

  // Store Channels: Super Admin gets all stores; Store/Sales Manager strictly get their own store
  if (channelName.startsWith('private-store-') || channelName.startsWith('store-')) {
    const requestedStore = channelName
      .replace(/^private-store-/, '')
      .replace(/^store-/, '')
      .toUpperCase();
    return isSuperAdmin || (Boolean(userStore) && requestedStore === userStore);
  }

  // User Channels: Super Admin or targeted user only
  if (channelName.startsWith('private-user-') || channelName.startsWith('user-')) {
    const requestedUserId = channelName.replace(/^private-user-/, '').replace(/^user-/, '');
    return isSuperAdmin || requestedUserId === user.id;
  }

  // Public business channels are strictly forbidden — all channels must be private or presence
  if (!channelName.startsWith('private-') && !channelName.startsWith('presence-')) {
    return false;
  }

  return false;
}

// ─── Distributed Pusher Provider ─────────────────────────────────────────────

export class PusherRealtimeProvider implements IRealtimeProvider {
  readonly name = 'pusher';
  private client: PusherServer | null = null;
  readonly isConfigured: boolean;

  constructor() {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2';

    if (appId && key && secret) {
      try {
        this.client = new PusherServer({
          appId,
          key,
          secret,
          cluster,
          useTLS: true,
        });
        this.isConfigured = true;
        console.info(`[COSKO Realtime] Pusher provider initialized (Cluster: ${cluster})`);
      } catch (err) {
        console.warn('[COSKO Realtime] Failed to initialize Pusher provider:', err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  async publish(channel: string, event: string, payload: RealtimePayload): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const sanitizedChannel = sanitizeChannelName(channel);
      await this.client.trigger(sanitizedChannel, event, payload);
      return true;
    } catch (err: any) {
      console.warn(
        `[COSKO Realtime] Pusher trigger failed on ${channel}:${event}:`,
        err?.message || err
      );
      return false;
    }
  }
}

// ─── Fallback Polling Provider (When Pusher Not Configured) ───────────────────

export class FallbackPollingProvider implements IRealtimeProvider {
  readonly name = 'fallback-polling';
  readonly isConfigured = false;

  async publish(_channel: string, _event: string, _payload: RealtimePayload): Promise<boolean> {
    // Durable outbox persistence in MySQL handles message availability for polling fallback
    return false;
  }
}

// Singleton Provider Initialization
export const realtimeProvider: IRealtimeProvider = (() => {
  const pusher = new PusherRealtimeProvider();
  if (pusher.isConfigured) {
    return pusher;
  }
  return new FallbackPollingProvider();
})();

// ─── Realtime Status & Configuration Inspection ──────────────────────────────

export function getRealtimeStatus() {
  const isPusherConfigured = realtimeProvider.name === 'pusher' && realtimeProvider.isConfigured;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || null;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER || 'ap2';

  return {
    provider: isPusherConfigured ? 'pusher' : 'fallback-polling',
    isDistributed: isPusherConfigured,
    mode: isPusherConfigured
      ? 'Distributed WebSocket (Pusher Channels)'
      : 'DB-Authoritative Fallback Sync',
    key: isPusherConfigured ? key : null,
    cluster: isPusherConfigured ? cluster : null,
  };
}

// ─── Durable Outbox Persistence ──────────────────────────────────────────────

export async function persistOutboxEvent(
  channel: string,
  event: string,
  payload: Partial<RealtimePayload> | Record<string, any>,
  tx?: any
): Promise<string | null> {
  try {
    const db = tx || prisma;
    const storeCode =
      payload.storeCode ||
      (channel.startsWith('private-store-')
        ? channel.replace('private-store-', '')
        : channel.startsWith('store-') && channel !== 'store-global'
          ? channel.replace('store-', '')
          : null);

    const safePayload = {
      eventType: payload.eventType || event,
      entityId: payload.entityId || payload.id,
      storeCode: storeCode || undefined,
      timestamp: payload.timestamp || new Date().toISOString(),
      version: payload.version || Date.now(),
    };

    const record = await db.realtimeOutbox.create({
      data: {
        channel,
        event,
        payload: JSON.stringify(safePayload),
        storeCode,
      },
    });
    return record.id;
  } catch (err: any) {
    console.warn('[COSKO Realtime] Outbox persistence error:', err?.message || err);
    // 🔒 Section 16: If inside a transaction, DO NOT swallow durable outbox insertion failure!
    if (tx) {
      throw err;
    }
    return null;
  }
}

// ─── Unified Event Broadcast API ─────────────────────────────────────────────

export interface BroadcastOptions {
  tx?: any;
  skipOutbox?: boolean;
  storeCode?: string;
}

/**
 * Broadcasts a mutation event across the distributed system.
 * 1. Atomically persists event into durable MySQL RealtimeOutbox
 * 2. Broadcasts via distributed provider (Pusher) if configured
 * 3. Never throws fatal errors that could roll back successful business mutations
 */
export async function broadcastRealtimeEvent(
  channel: string,
  event: string,
  payload: any,
  options?: BroadcastOptions
): Promise<{ outboxId: string | null; broadcastSuccess: boolean }> {
  const now = new Date().toISOString();

  // Determine storeCode first
  const storeCode =
    payload?.storeCode ||
    options?.storeCode ||
    (channel.startsWith('private-store-')
      ? channel.replace('private-store-', '')
      : channel.startsWith('store-') && channel !== 'store-global'
        ? channel.replace('store-', '')
        : undefined);

  // Normalize channel: Map all business-domain channels to private authenticated channels (Requirement 15)
  let targetChannel = channel;
  if (channel === 'store-global' || channel === 'global' || channel === 'enterprise') {
    targetChannel = 'private-enterprise';
  } else if (channel === 'work-activity') {
    targetChannel = 'private-work-activity';
  } else if (channel === 'attendance') {
    targetChannel = 'private-attendance';
  } else if (channel.startsWith('store-') && !channel.startsWith('private-store-')) {
    targetChannel = `private-${channel}`;
  } else if (channel.startsWith('user-') && !channel.startsWith('private-user-')) {
    targetChannel = `private-${channel}`;
  } else if (
    [
      'sales',
      'inventory',
      'expenses',
      'customers',
      'vendors',
      'purchases',
      'transfers',
      'notifications',
      'settings',
      'units',
      'payment-methods',
      'categories',
      'users',
    ].includes(channel)
  ) {
    // Business-domain mutation: Route to private-store if store-scoped, otherwise private-enterprise
    if (storeCode && storeCode !== 'All Stores' && storeCode !== 'CENTRAL' && storeCode !== 'all') {
      targetChannel = getStoreChannel(storeCode);
    } else {
      targetChannel = 'private-enterprise';
    }
  } else if (!targetChannel.startsWith('private-') && !targetChannel.startsWith('presence-')) {
    targetChannel = `private-${targetChannel}`;
  }

  // Minimal Invalidation Payload (Requirement 15):
  // Client receives minimal invalidation event and refetches authoritative protected API.
  const normalizedPayload: RealtimePayload = {
    eventType: payload?.eventType || event,
    entityId: payload?.entityId || payload?.id,
    storeCode,
    timestamp: payload?.timestamp || now,
    version: payload?.version || Date.now(),
  };

  let outboxId: string | null = null;
  if (!options?.skipOutbox) {
    outboxId = await persistOutboxEvent(targetChannel, event, normalizedPayload, options?.tx);
  }

  let broadcastSuccess = false;
  if (realtimeProvider.isConfigured) {
    broadcastSuccess = await realtimeProvider.publish(targetChannel, event, normalizedPayload);
  }

  return { outboxId, broadcastSuccess };
}
