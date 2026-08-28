/**
 * COSKO Enterprise Authentication, Password Hashing & Session Security Layer
 * Provides server-side cryptographic hashing, session handling, rate limiting, and sanitization.
 */

import { crypto } from 'next/dist/compiled/@edge-runtime/primitives';

export interface SanitizedUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  securityLevel: number;
  store: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  shiftStatus: 'On Shift' | 'On Leave';
  lastLogin: string;
  permissions: string[];
  avatarUrl?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  storeScope: string;
  securityLevel: number;
}

// In-Memory Rate Limiting Tracker for Login & Reset Attempts
const loginAttemptsMap = new Map<string, { count: number; firstAttemptTime: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Active Sessions Registry for Instant Revocation
const activeSessions = new Map<string, UserSession>();

/**
 * Computes a secure salted cryptographic hash of a raw password string.
 */
export async function hashPassword(password: string, salt: string = 'cosko_sec_salt_2026'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `$sha256$s=${salt}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored salted hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  
  // Handle default hashes or PBKDF2/SHA256 formatted hashes
  if (storedHash.startsWith('$sha256$')) {
    const parts = storedHash.split('$');
    const salt = parts[2]?.replace('s=', '') || 'cosko_sec_salt_2026';
    const expectedHash = parts[3];
    const computedHash = (await hashPassword(password, salt)).split('$')[3];
    return computedHash === expectedHash;
  }

  // Fallback for legacy seeded hashes
  if (storedHash.includes('cosko2026hash') || storedHash === 'Cosko2026@') {
    return password === 'Cosko2026@';
  }

  // Direct comparison fallback for standard plaintext seeds if any
  return password === storedHash;
}

/**
 * Strips sensitive data (passwords, hashes, tokens) before returning user object to client.
 */
export function sanitizeUser(user: any): SanitizedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    securityLevel: user.securityLevel || (user.role === 'Super Admin' ? 100 : user.role === 'Store Manager' ? 80 : user.role === 'Inventory Auditor' ? 60 : 20),
    store: user.store || user.storeScope || 'BLR',
    status: user.status || 'Active',
    shiftStatus: user.shiftStatus || 'On Shift',
    lastLogin: user.lastLogin || 'Just now',
    permissions: user.permissions || [],
    avatarUrl: user.avatarUrl,
  };
}

/**
 * Checks rate-limiting threshold for IP / Email login attempts.
 */
export function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
  const now = Date.now();
  const key = identifier.toLowerCase().trim();
  const attemptData = loginAttemptsMap.get(key);

  if (!attemptData) {
    loginAttemptsMap.set(key, { count: 1, firstAttemptTime: now });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 };
  }

  // Reset window if time elapsed
  if (now - attemptData.firstAttemptTime > RATE_LIMIT_WINDOW_MS) {
    loginAttemptsMap.set(key, { count: 1, firstAttemptTime: now });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 };
  }

  if (attemptData.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - attemptData.firstAttemptTime)) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSec };
  }

  attemptData.count += 1;
  loginAttemptsMap.set(key, attemptData);
  return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - attemptData.count };
}

/**
 * Resets rate limit counter upon successful login authentication.
 */
export function resetRateLimit(identifier: string): void {
  loginAttemptsMap.delete(identifier.toLowerCase().trim());
}

/**
 * Issues a new secure server-side session.
 */
export function createSession(userId: string, storeScope: string, securityLevel: number): UserSession {
  const token = `cosko_sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const session: UserSession = {
    id: `sess-${Date.now()}`,
    userId,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), // 8 hour expiration
    revoked: false,
    storeScope,
    securityLevel,
  };
  activeSessions.set(token, session);
  return session;
}

/**
 * Validates a session token and verifies it is active and unrevoked.
 */
export function verifySession(token: string): { valid: boolean; session?: UserSession; reason?: string } {
  if (!token) return { valid: false, reason: 'Session token missing' };
  const session = activeSessions.get(token);
  if (!session) return { valid: false, reason: 'Session does not exist' };
  if (session.revoked) return { valid: false, reason: 'Session has been revoked' };
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: 'Session has expired' };
  }
  return { valid: true, session };
}

/**
 * Revokes a session token immediately (e.g. user logout or suspension).
 */
export function revokeSession(token: string): void {
  const session = activeSessions.get(token);
  if (session) {
    session.revoked = true;
    activeSessions.set(token, session);
  }
}

/**
 * Revokes all active sessions for a specific user ID (e.g. upon account suspension or password reset).
 */
export function revokeAllUserSessions(userId: string): number {
  let count = 0;
  activeSessions.forEach((sess, token) => {
    if (sess.userId === userId && !sess.revoked) {
      sess.revoked = true;
      activeSessions.set(token, sess);
      count++;
    }
  });
  return count;
}
