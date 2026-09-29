'use client';

import React, { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // Heartbeat every 60 seconds

export default function ActivityTracker() {
  const { authStatus, currentUser } = useApp();
  const lastHeartbeatRef = useRef<number>(Date.now());

  // Background liveness heartbeat to verify active shift without automatically starting or closing shifts
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED' || !currentUser?.id) return;

    const interval = setInterval(async () => {
      // Don't send if tab is completely inactive or hidden for long periods
      if (document.visibilityState === 'hidden') return;

      try {
        await fetch('/api/activity/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientTimestamp: new Date().toISOString(),
          }),
        });
        lastHeartbeatRef.current = Date.now();
      } catch {
        // Ignore network drops
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [authStatus, currentUser?.id]);

  return null;
}
