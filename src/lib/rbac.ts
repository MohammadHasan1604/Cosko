import { SessionUser } from './auth';

export interface RBACCheckParams {
  user: SessionUser | null;
  requiredMinLevel?: number;
  requiredPermission?: string;
  targetStoreCode?: string;
  superAdminOnly?: boolean;
  userOverrides?: { permissionCode: string; overrideType: 'ALLOW' | 'DENY' }[];
}

export interface RBACResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Server-Side RBAC & Store Scope Authorization Evaluator
 * Replaces Supabase RLS policies with trusted server-side authorization.
 */
export function evaluateAuthorization({
  user,
  requiredMinLevel = 10,
  requiredPermission,
  targetStoreCode,
  superAdminOnly = false,
  userOverrides = [],
}: RBACCheckParams): RBACResult {
  // 1. Session Verification
  if (!user || !user.id) {
    return { authorized: false, reason: 'Unauthenticated Session: Access Denied' };
  }

  // 2. Super Admin Access Bypass
  if (user.role === 'Super Admin' || user.securityLevel === 100) {
    return { authorized: true };
  }

  // 3. Super Admin Only Block
  if (superAdminOnly) {
    return { authorized: false, reason: '403 Forbidden: Resource is classified as SUPER_ADMIN_ONLY' };
  }

  // 4. Custom User Permission Overrides (Explicit DENY / ALLOW)
  if (requiredPermission && userOverrides.length > 0) {
    const override = userOverrides.find((o) => o.permissionCode === requiredPermission);
    if (override) {
      if (override.overrideType === 'DENY') {
        return { authorized: false, reason: `Deny Access: Custom DENY override for "${requiredPermission}"` };
      }
      if (override.overrideType === 'ALLOW') {
        return { authorized: true };
      }
    }
  }

  // 5. Minimum Security Level Check
  if (user.securityLevel < requiredMinLevel) {
    return { authorized: false, reason: `Deny Access: User Security Level (${user.securityLevel}) is below required Level (${requiredMinLevel})` };
  }

  // 6. Store Scope Lock Check
  if (targetStoreCode && targetStoreCode !== 'All Stores' && targetStoreCode !== 'CENTRAL') {
    const userAllowedStores = user.allowedStores || [user.store];
    if (user.store !== 'All Stores' && !userAllowedStores.includes(targetStoreCode)) {
      return { authorized: false, reason: `Deny Access: Store Scope Lock prevents access to ${targetStoreCode}` };
    }
  }

  return { authorized: true };
}
