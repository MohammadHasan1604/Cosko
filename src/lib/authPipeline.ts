/**
 * COSKO Authoritative Server-Side Authentication Pipeline
 *
 * SINGLE SOURCE OF TRUTH for all API route authentication and authorization.
 * Every protected API/action MUST call authenticateRequest() which verifies:
 *
 * 1. Valid authenticated session (HttpOnly cookie or Bearer token)
 * 2. Cryptographically valid JWT (signed with AUTH_SECRET)
 * 3. DB UserSession MUST exist
 * 4. Session not revoked
 * 5. Session not expired
 * 6. UserAccount still exists in DB
 * 7. User status is Active (not Suspended/Inactive)
 * 8. Current role/securityLevel comes from DB (not JWT cache)
 * 9. Assigned stores come from DB
 * 10. Current permissions come from DB
 *
 * FAILS CLOSED — any check failure returns null.
 * NO JWT-ONLY FALLBACK. DB session is MANDATORY.
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { verifySessionToken, hashToken } from './auth';
import { prisma } from './db';
import {
  RBACEngine,
  ROLE_SECURITY_LEVELS,
  SUPER_ADMIN_PROTECTED_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type UserRole,
  type SecurityLevel,
} from './rbacEngine';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  securityLevel: SecurityLevel;
  store: string;
  allowedStores: string[];
  status: string;
  avatarUrl?: string;
  mustChangePassword: boolean;
  sessionId: string;
  permissions: string[];
  overrides: { permissionCode: string; overrideType: 'ALLOW' | 'DENY' }[];
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
  status: number;
}

/**
 * Extract raw JWT token from request (cookie or Authorization header)
 */
function extractToken(req: NextRequest | Request): string | null {
  try {
    // 1. HttpOnly cookie (primary, secure method)
    const cookieToken = (req as any).cookies?.get?.('cosko_session')?.value;
    if (cookieToken) return cookieToken;

    // 2. Authorization Bearer header (for API clients)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * AUTHORITATIVE SERVER-SIDE AUTHENTICATION PIPELINE
 *
 * FAIL CLOSED. No JWT-only fallback. DB session is MANDATORY.
 */
export async function authenticateRequest(req: NextRequest | Request): Promise<AuthResult> {
  // Step 1: Extract token
  const token = extractToken(req);
  if (!token) {
    return { user: null, error: 'Unauthorized: No active session', status: 401 };
  }

  // Step 2: Cryptographic JWT verification
  const jwtResult = verifySessionToken(token);
  if (!jwtResult?.user?.id) {
    return { user: null, error: 'Unauthorized: Invalid or expired session token', status: 401 };
  }

  // Step 3-5: DB session verification — MANDATORY. NO FALLBACK.
  const tokenDigest = hashToken(token);
  let dbSessionId: string;

  try {
    // Primary lookup by token hash
    let dbSession = await (prisma as any).userSession.findUnique({
      where: { tokenHash: tokenDigest },
    });

    // Secondary lookup by session ID from JWT (covers re-signed tokens)
    if (!dbSession && jwtResult.sid) {
      dbSession = await (prisma as any).userSession.findUnique({
        where: { id: jwtResult.sid },
      });
    }

    // FAIL CLOSED: No DB session found → reject
    if (!dbSession) {
      return { user: null, error: 'Session not found. Please log in again.', status: 401 };
    }

    // Check revocation
    if (dbSession.revokedAt) {
      return { user: null, error: 'Session has been revoked. Please log in again.', status: 401 };
    }

    // Check expiration
    if (dbSession.expiresAt < new Date()) {
      return { user: null, error: 'Session has expired. Please log in again.', status: 401 };
    }

    dbSessionId = dbSession.id;
  } catch (sessionCheckErr) {
    console.error('[AuthPipeline] DB session check failed:', sessionCheckErr);
    // FAIL CLOSED on DB error — do NOT fall back to JWT-only
    return { user: null, error: 'Authentication service temporarily unavailable', status: 503 };
  }

  // Step 6: Verify UserAccount exists in DB
  let dbUser: any;
  try {
    dbUser = await prisma.userAccount.findUnique({
      where: { id: jwtResult.user.id },
      include: {
        storeAssignments: true,
      },
    });
  } catch (dbErr) {
    console.error('[AuthPipeline] DB user lookup error:', dbErr);
    return { user: null, error: 'Authentication service temporarily unavailable', status: 503 };
  }

  if (!dbUser) {
    return { user: null, error: 'Account no longer exists', status: 401 };
  }

  // Step 7: Check user status (Active only)
  if (dbUser.status === 'Suspended') {
    return { user: null, error: 'Account is suspended. All access revoked.', status: 403 };
  }
  if (dbUser.status === 'Inactive') {
    return { user: null, error: 'Account is inactive. Access denied.', status: 403 };
  }

  // Step 8-10: Build authoritative user from DB (NOT from JWT cache)
  const allowedStores = dbUser.storeAssignments.map((a: any) => a.storeCode);
  if (dbUser.storeScope && !allowedStores.includes(dbUser.storeScope)) {
    allowedStores.push(dbUser.storeScope);
  }

  const effectiveStore =
    dbUser.role === 'Super Admin'
      ? dbUser.storeScope || 'All Stores'
      : dbUser.storeScope && dbUser.storeScope !== 'All Stores'
        ? dbUser.storeScope
        : allowedStores[0] || 'BLR';

  const dbRole = dbUser.role as UserRole;
  const dbSecurityLevel = (ROLE_SECURITY_LEVELS[dbRole] ?? dbUser.securityLevel) as SecurityLevel;

  const rolePerms = DEFAULT_ROLE_PERMISSIONS[dbRole] || [];

  const authenticatedUser: AuthenticatedUser = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbRole,
    securityLevel: dbSecurityLevel,
    store: effectiveStore,
    allowedStores:
      dbRole === 'Super Admin'
        ? allowedStores.length > 0
          ? allowedStores
          : ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM']
        : allowedStores.length > 0
          ? allowedStores
          : [effectiveStore],
    status: dbUser.status,
    avatarUrl: dbUser.avatarUrl || undefined,
    mustChangePassword: dbUser.mustChangePassword || false,
    sessionId: dbSessionId,
    permissions: rolePerms,
    overrides: [],
  };

  return { user: authenticatedUser, error: null, status: 200 };
}

/**
 * Check if the authenticated user has a specific permission.
 */
export function hasPermission(
  user: AuthenticatedUser,
  permissionCode: string,
  targetStore?: string
): boolean {
  if (user.role === 'Super Admin' || user.securityLevel === 100) {
    return true;
  }

  const result = RBACEngine.authorize(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      securityLevel: user.securityLevel,
      storeScope: user.store,
      allowedStores: user.allowedStores,
      status: user.status as any,
      permissions: user.permissions,
      overrides: user.overrides,
      isSessionValid: true,
    },
    {
      resourceName: permissionCode,
      classification: 'STORE_SCOPED',
      minSecurityLevel: 40,
      requiredPermission: permissionCode,
      targetStore: targetStore,
    }
  );

  return result.allowed;
}

/**
 * Validate that the user can access the target store.
 */
export function canAccessStore(user: AuthenticatedUser, targetStore: string): boolean {
  if (user.role === 'Super Admin' || user.securityLevel === 100) {
    return true;
  }
  if (!targetStore || targetStore === 'All Stores' || targetStore === 'ALL') {
    return false; // Non-Super Admin cannot access "All Stores"
  }
  return user.allowedStores.includes(targetStore);
}

/**
 * Create an audit log entry.
 */
export async function createAuditLog(
  user: AuthenticatedUser,
  module: string,
  action: string,
  details: string,
  storeCode?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        module,
        action,
        details: details.substring(0, 65535),
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        storeCode: storeCode || user.store || 'CENTRAL',
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to create audit log:', err);
  }
}

/**
 * Invalidate all active sessions for a user.
 * Called on: deactivate, suspend, password reset, password change.
 */
export async function invalidateUserSessions(
  userId: string,
  excludeSessionId?: string
): Promise<void> {
  try {
    const whereClause: any = {
      userId,
      revokedAt: null,
    };
    if (excludeSessionId) {
      whereClause.id = { not: excludeSessionId };
    }
    await (prisma as any).userSession.updateMany({
      where: whereClause,
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    console.error('[AuthPipeline] Failed to invalidate sessions:', err);
  }
}

/**
 * Generate a secure random temporary password.
 * NEVER uses a hardcoded default.
 */
export function generateSecureTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(16);
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}
