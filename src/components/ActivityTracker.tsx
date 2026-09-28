'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes of no input = idle
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Send heartbeat every 30 seconds

export default function ActivityTracker() {
  const { authStatus, currentUser } = useApp();
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const isIdleRef = useRef<boolean>(false);
  const isVisibleRef = useRef<boolean>(true);
  const tabIdRef = useRef<string>('');
  const isPrimaryTabRef = useRef<boolean>(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // 1. Initialize Tab ID and BroadcastChannel for multi-tab deduplication
  useEffect(() => {
    tabIdRef.current = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('cosko_activity_channel');
        channelRef.current = channel;

        channel.onmessage = (event) => {
          if (
            event.data?.type === 'ACTIVE_TAB_HEARTBEAT' &&
            event.data?.tabId !== tabIdRef.current
          ) {
            // Another tab is actively sending heartbeats and focused
            if (document.visibilityState === 'hidden') {
              isPrimaryTabRef.current = false;
            }
          }
        };
      } catch {}
    }

    return () => {
      channelRef.current?.close();
    };
  }, []);

  // 2. Start or restore work session when user is authenticated
  const startSession = useCallback(async () => {
    if (authStatus !== 'AUTHENTICATED' || !currentUser?.id) return;

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const res = await fetch('/api/activity/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          timezone: tz,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.sessionId) {
          sessionIdRef.current = data.sessionId;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('cosko_active_work_session_id', data.sessionId);
          }
        }
      }
    } catch (err) {
      console.warn('Could not start work activity session:', err);
    }
  }, [authStatus, currentUser?.id]);

  useEffect(() => {
    if (authStatus === 'AUTHENTICATED' && currentUser?.id) {
      // Check if existing session ID stored in sessionStorage
      if (typeof window !== 'undefined') {
        const existing = sessionStorage.getItem('cosko_active_work_session_id');
        if (existing) {
          sessionIdRef.current = existing;
        }
      }
      startSession();
    } else {
      sessionIdRef.current = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('cosko_active_work_session_id');
      }
    }
  }, [authStatus, currentUser?.id, startSession]);

  // 3. User activity listeners (mouse, keys, touch, scroll)
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') return;

    const handleUserInteraction = () => {
      lastActivityTimeRef.current = Date.now();
      isIdleRef.current = false;
      isPrimaryTabRef.current = true;

      // Broadcast active focus to other open tabs
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'ACTIVE_TAB_HEARTBEAT',
          tabId: tabIdRef.current,
        });
      }
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isVisibleRef.current = isVisible;
      if (isVisible) {
        handleUserInteraction();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authStatus]);

  // 4. Send Heartbeat Daemon
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;

      // Check idle status: > 2 minutes with no interaction
      const isIdle = timeSinceLastActivity > IDLE_TIMEOUT_MS;
      isIdleRef.current = isIdle;

      // If document is hidden and idle, or another tab is the primary sender, skip to avoid double counting
      if (!isVisibleRef.current && !isPrimaryTabRef.current) {
        return;
      }

      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const res = await fetch('/api/activity/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            isIdle: isIdle || !isVisibleRef.current,
            activeDeltaSeconds: 30,
            timezone: tz,
            path: window.location.pathname,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.sessionId && !sessionIdRef.current) {
            sessionIdRef.current = data.sessionId;
            sessionStorage.setItem('cosko_active_work_session_id', data.sessionId);
          }
        }
      } catch {}
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [authStatus]);

  // 5. Clean teardown on page close / unload
  useEffect(() => {
    const handleUnload = () => {
      if (sessionIdRef.current && navigator.sendBeacon) {
        const payload = JSON.stringify({
          action: 'close',
          sessionId: sessionIdRef.current,
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/activity/session', blob);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  return null; // Silent background tracking component
}
