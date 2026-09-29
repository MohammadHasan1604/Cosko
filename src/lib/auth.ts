import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ─── SECURITY: No fallback secret. Production MUST set AUTH_SECRET. ───
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: AUTH_SECRET environment variable is required in production. Refusing to start with missing secret.'
    );
  }
  console.warn(
    '⚠️  WARNING: AUTH_SECRET is not set. Authentication will fail. Set AUTH_SECRET in your .env file.'
  );
}

// Reject the known insecure default even if set
const INSECURE_DEFAULT = 'cosko_insecure_dev_fallback_jwt_key_do_not_use';
function getSecret(): string {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not configured. Cannot sign or verify tokens.');
  }
  if (AUTH_SECRET === INSECURE_DEFAULT && process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: AUTH_SECRET is set to the insecure default value. Generate a strong random secret for production.'
    );
  }
  return AUTH_SECRET;
}

const BCRYPT_SALT_ROUNDS = 12;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Store Manager' | 'Sales Manager';
  securityLevel: number;
  store: string;
  allowedStores?: string[];
  avatar: string;
  shiftStatus?: 'On Shift' | 'On Leave';
  avatarUrl?: string;
  mustChangePassword?: boolean;
  sessionId?: string; // DB session ID for revocation checks
}

/**
 * Generates a salted hash for passwords using bcrypt with work factor 12
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plain-text password against a stored bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export const verifyPassword = comparePassword;

/**
 * Hash a token for database storage (non-reversible, for revocation lookup)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const hashSessionToken = hashToken;

/**
 * Signs a JWT session token for authenticated user.
 * The token includes a sessionId for DB-backed revocation.
 */
export function signSessionToken(user: SessionUser, sessionId?: string): string {
  const secret = getSecret();
  return jwt.sign({ user, sid: sessionId }, secret, { expiresIn: '30d' });
}

/**
 * Verifies and decodes a JWT session token cryptographically.
 * Returns null on any failure (expired, tampered, invalid signature).
 */
export function verifySessionToken(token: string): { user: SessionUser; sid?: string } | null {
  try {
    const secret = getSecret();
    const decoded = jwt.verify(token, secret) as { user: SessionUser; sid?: string };
    if (!decoded.user || !decoded.user.id) return null;
    return { user: decoded.user, sid: decoded.sid };
  } catch {
    return null;
  }
}

/**
 * Validates request Origin and Referer against allowed domains to mitigate CSRF attacks.
 */
export function isValidAuthOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  if (!origin && !referer) {
    // Non-browser or server-to-server request — allow (API clients, curl, etc.)
    return true;
  }

  const targetUrl = origin || referer;
  if (!targetUrl) return true;

  try {
    const parsed = new URL(targetUrl);
    if (host && parsed.host === host) {
      return true;
    }
    if (configuredAppUrl) {
      const parsedConfig = new URL(configuredAppUrl);
      if (parsed.host === parsedConfig.host) {
        return true;
      }
    }
    // Allow localhost during dev only
    if (
      process.env.NODE_ENV !== 'production' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Resolves session user from HTTP Request cookies or Authorization header.
 * Performs cryptographic JWT verification — not length checks.
 */
export function getAuthUserFromRequest(req: any): SessionUser | null {
  try {
    let token = req.cookies?.get?.('cosko_session')?.value;
    if (!token && req.headers?.get) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = req.headers.get('x-session-token');
      }
    }

    if (token) {
      const result = verifySessionToken(token);
      if (result && result.user) {
        return { ...result.user, sessionId: result.sid };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract raw token from request (for session DB lookups)
 */
export function getRawTokenFromRequest(req: any): string | null {
  try {
    let token = req.cookies?.get?.('cosko_session')?.value;
    if (!token && req.headers?.get) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = req.headers.get('x-session-token');
      }
    }
    return token || null;
  } catch {
    return null;
  }
}

export { checkRateLimit, recordFailedAttempt, clearRateLimit } from './rateLimit';
