import { EventEmitter } from 'events';

export interface RealtimeMessage {
  channel: string;
  event: string;
  payload: any;
  timestamp: string;
}

class RealtimeHub extends EventEmitter {}

export const realtimeHub = new RealtimeHub();

/**
 * Broadcasts a realtime change event to all connected active SSE clients
 */
export function broadcastRealtimeEvent(channel: string, event: string, payload: any) {
  const message: RealtimeMessage = {
    channel,
    event,
    payload,
    timestamp: new Date().toISOString(),
  };
  realtimeHub.emit('event', message);
}
