/**
 * In-Memory Sliding-Window Rate Limiter for Authentication Protection
 * Prevents brute-force and credential stuffing attacks on authentication endpoints.
 */

interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

// Periodic cleanup of stale records every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (
        (!record.blockedUntil || record.blockedUntil < now) &&
        now - record.firstAttemptTime > WINDOW_DURATION_MS
      ) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // Check if currently blocked
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Check if window has expired
  if (now - record.firstAttemptTime > WINDOW_DURATION_MS) {
    rateLimitStore.delete(key);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    const retryAfterSeconds = Math.ceil(BLOCK_DURATION_MS / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
  };
}

export function recordFailedAttempt(key: string): RateLimitResult {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record || now - record.firstAttemptTime > WINDOW_DURATION_MS) {
    record = {
      attempts: 1,
      firstAttemptTime: now,
    };
  } else {
    record.attempts += 1;
    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.blockedUntil = now + BLOCK_DURATION_MS;
    }
  }

  rateLimitStore.set(key, record);

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts),
  };
}

export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
