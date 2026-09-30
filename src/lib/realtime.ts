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

// ─── Channel Naming Helpers (Pusher & Store-Scoped Compliant) ────────────────

export function sanitizeChannelName(name: string): string {
  // Pusher channels allow [-a-zA-Z0-9_=@,.;]+
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getStoreChannel(storeCode?: string | null): string {
  if (!storeCode || storeCode === 'All Stores' || storeCode === 'all') {
    return 'store-global';
  }
  return `store-${sanitizeChannelName(storeCode)}`;
}

export function getGlobalChannel(): string {
  return 'store-global';
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
        console.log(`[COSKO Realtime] Pusher provider initialized (Cluster: ${cluster})`);
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
  payload: RealtimePayload,
  tx?: any
): Promise<string | null> {
  try {
    const db = tx || prisma;
    const storeCode =
      payload.storeCode ||
      (channel.startsWith('store-') && channel !== 'store-global'
        ? channel.replace('store-', '')
        : null);

    const record = await db.realtimeOutbox.create({
      data: {
        channel,
        event,
        payload: JSON.stringify(payload),
        storeCode,
      },
    });
    return record.id;
  } catch (err: any) {
    console.warn('[COSKO Realtime] Outbox persistence error:', err?.message || err);
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

  // Normalize minimal payload — DO NOT broadcast sensitive credentials or huge financial logs
  const normalizedPayload: RealtimePayload = {
    eventType: payload?.eventType || event,
    entityId: payload?.entityId || payload?.id,
    storeCode:
      payload?.storeCode ||
      options?.storeCode ||
      (channel.startsWith('store-') && channel !== 'store-global'
        ? channel.replace('store-', '')
        : undefined),
    timestamp: payload?.timestamp || now,
    version: payload?.version || Date.now(),
    ...(typeof payload === 'object' ? payload : {}),
  };

  // Remove sensitive keys
  delete (normalizedPayload as any).password;
  delete (normalizedPayload as any).passwordHash;
  delete (normalizedPayload as any).tokenHash;

  let outboxId: string | null = null;
  if (!options?.skipOutbox) {
    outboxId = await persistOutboxEvent(channel, event, normalizedPayload, options?.tx);
  }

  let broadcastSuccess = false;
  if (realtimeProvider.isConfigured) {
    broadcastSuccess = await realtimeProvider.publish(channel, event, normalizedPayload);
    // Also broadcast to global channel if this is a store-specific event so Super Admin can observe
    if (channel !== 'store-global' && channel.startsWith('store-')) {
      await realtimeProvider.publish('store-global', event, normalizedPayload).catch(() => {});
    }
  }

  return { outboxId, broadcastSuccess };
}
