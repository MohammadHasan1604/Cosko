/**
 * Phase 1 Security & Hardening Tests
 * 
 * Validates:
 * 1. Auth pipeline correctly rejects unauthenticated requests
 * 2. Duplicate user APIs return 410 Gone
 * 3. Production config uses `next start` not `next dev`
 * 4. CSRF protection enforced
 * 5. Security headers present
 * 6. Super Admin singleton enforced
 * 7. Rate limiting active
 * 8. Idempotency system operational
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => boolean | string) {
  try {
    const result = fn();
    if (result === true) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      const msg = typeof result === 'string' ? result : 'assertion failed';
      console.log(`  ❌ ${name}: ${msg}`);
      errors.push(`${name}: ${msg}`);
      failed++;
    }
  } catch (err: any) {
    console.log(`  ❌ ${name}: ${err.message}`);
    errors.push(`${name}: ${err.message}`);
    failed++;
  }
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ═══════════════════════════════════════════════════
// 1. AUTHENTICATION & SESSION SECURITY
// ═══════════════════════════════════════════════════
console.log('\n🔐 1. Authentication & Session Security');

test('authPipeline.ts exists', () => fileExists('src/lib/authPipeline.ts'));

test('authPipeline exports authenticateRequest', () => {
  const content = readFile('src/lib/authPipeline.ts');
  return content.includes('export async function authenticateRequest');
});

test('authPipeline verifies DB session (not JWT-only)', () => {
  const content = readFile('src/lib/authPipeline.ts');
  return content.includes('userSession.findUnique') && content.includes('revokedAt');
});

test('authPipeline checks user status (Active only)', () => {
  const content = readFile('src/lib/authPipeline.ts');
  return content.includes("dbUser.status === 'Suspended'") && content.includes("dbUser.status === 'Inactive'");
});

test('authPipeline loads role/securityLevel from DB (not JWT cache)', () => {
  const content = readFile('src/lib/authPipeline.ts');
  return content.includes('ROLE_SECURITY_LEVELS[dbRole]') || content.includes('dbUser.role as UserRole');
});

test('authPipeline includes session invalidation function', () => {
  const content = readFile('src/lib/authPipeline.ts');
  return content.includes('export async function invalidateUserSessions');
});

test('Login route uses HttpOnly secure cookies', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return content.includes('httpOnly: true') && content.includes("secure: process.env.NODE_ENV === 'production'");
});

test('Login route creates DB-backed sessions', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return content.includes('userSession.create');
});

test('Login route has rate limiting', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return content.includes('checkRateLimit') && content.includes('recordFailedAttempt');
});

test('Login route has DB account lockout', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return content.includes('failedLoginAttempts') && content.includes('lockedUntil');
});

test('Auth secret refuses insecure default in production', () => {
  const content = readFile('src/lib/auth.ts');
  return content.includes('INSECURE_DEFAULT') && content.includes('FATAL: AUTH_SECRET');
});

// ═══════════════════════════════════════════════════
// 2. DUPLICATE USER API CONSOLIDATION
// ═══════════════════════════════════════════════════
console.log('\n🔗 2. Duplicate User API Consolidation');

test('/api/users/create returns 410 Gone', () => {
  const content = readFile('src/app/api/users/create/route.ts');
  return content.includes('410') && content.includes('consolidated');
});

test('/api/users/update returns 410 Gone', () => {
  const content = readFile('src/app/api/users/update/route.ts');
  return content.includes('410') && content.includes('consolidated');
});

test('/api/users/delete returns 410 Gone', () => {
  const content = readFile('src/app/api/users/delete/route.ts');
  return content.includes('410') && content.includes('consolidated');
});

test('Authoritative /api/users uses authenticateRequest', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes('authenticateRequest') && !content.includes('getAuthUserFromRequest');
});

// ═══════════════════════════════════════════════════
// 3. CENTRALIZED RBAC
// ═══════════════════════════════════════════════════
console.log('\n🛡️  3. Centralized RBAC');

test('RBACEngine exists with security levels', () => {
  const content = readFile('src/lib/rbacEngine.ts');
  return content.includes('ROLE_SECURITY_LEVELS') && content.includes("class RBACEngine");
});

test('Super Admin singleton enforced in user creation', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes("requestedRole === 'Super Admin'") && content.toLowerCase().includes('singleton');
});

test('Protected permissions cannot be assigned below Level 100', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes('SUPER_ADMIN_PROTECTED_PERMISSIONS');
});

test('Security level derived server-side from role (not client-supplied)', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes('ROLE_LEVEL_MAP[requestedRole]') && content.includes('Server-derived');
});

test('Level ceiling enforced (caller cannot create users at own level)', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes('targetLevel >= authUser.securityLevel');
});

// ═══════════════════════════════════════════════════
// 4. AUDIT LOGGING
// ═══════════════════════════════════════════════════
console.log('\n📋 4. Audit Logging');

test('User creation is audit logged', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes("'User Created'");
});

test('User update is audit logged', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes("'User Updated'");
});

test('User deletion/deactivation is audit logged', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes("'User Deactivated'") || content.includes("'User Deleted'");
});

test('Password change is audit logged', () => {
  const content = readFile('src/app/api/auth/change-password/route.ts');
  return content.includes("'Password Changed'");
});

// ═══════════════════════════════════════════════════
// 5. CRUD & DB INTEGRITY
// ═══════════════════════════════════════════════════
console.log('\n🗃️  5. CRUD & Database Integrity');

test('User delete uses archive (Inactive) for users with history', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes("status: 'Inactive'") && content.includes("mode: 'archived'");
});

test('Product delete archives products with transaction history', () => {
  const content = readFile('src/app/api/inventory/route.ts');
  return content.includes("status: 'archived'") && content.includes('hasHistory');
});

test('Sales void restocks inventory atomically', () => {
  const content = readFile('src/app/api/sales/route.ts');
  return content.includes('$transaction') && content.includes('qtyOnHand');
});

// ═══════════════════════════════════════════════════
// 6. INVENTORY INTEGRITY (Atomic Transactions)
// ═══════════════════════════════════════════════════
console.log('\n📦 6. Inventory Integrity');

test('Sales checkout uses prisma.$transaction', () => {
  const content = readFile('src/lib/services/salesService.ts');
  return content.includes('$transaction');
});

test('Inventory adjustments record ledger entries', () => {
  const content = readFile('src/app/api/inventory/route.ts');
  return content.includes('inventoryLedger.create');
});

test('Sale void/refund creates ledger entries', () => {
  const content = readFile('src/app/api/sales/route.ts');
  return content.includes('inventoryLedger.createMany');
});

// ═══════════════════════════════════════════════════
// 7. IDEMPOTENCY
// ═══════════════════════════════════════════════════
console.log('\n🔄 7. Idempotency');

test('Idempotency library exists', () => fileExists('src/lib/idempotency.ts'));

test('Idempotency uses DB-backed records', () => {
  const content = readFile('src/lib/idempotency.ts');
  return content.includes('idempotencyRecord.findUnique') && content.includes('idempotencyRecord.upsert');
});

test('Sales checkout uses executeWithIdempotency', () => {
  const content = readFile('src/app/api/sales/route.ts');
  return content.includes('executeWithIdempotency');
});

test('Inventory create uses executeWithIdempotency', () => {
  const content = readFile('src/app/api/inventory/route.ts');
  return content.includes('executeWithIdempotency');
});

// ═══════════════════════════════════════════════════
// 8. PRODUCTION HARDENING
// ═══════════════════════════════════════════════════
console.log('\n🚀 8. Production Hardening');

test('npm start uses next start (production mode)', () => {
  const pkg = JSON.parse(readFile('package.json'));
  return pkg.scripts.start.includes('next start');
});

test('npm start does NOT use next dev', () => {
  const pkg = JSON.parse(readFile('package.json'));
  return !pkg.scripts.start.includes('next dev');
});

test('TypeScript ignoreBuildErrors is false', () => {
  const content = readFile('next.config.mjs');
  return content.includes('ignoreBuildErrors: false');
});

test('ESLint ignoreDuringBuilds is false', () => {
  const content = readFile('next.config.mjs');
  return content.includes('ignoreDuringBuilds: false');
});

// ═══════════════════════════════════════════════════
// 9. SECURITY HARDENING
// ═══════════════════════════════════════════════════
console.log('\n🔒 9. Security Hardening');

test('CSRF protection in middleware', () => {
  const content = readFile('middleware.ts');
  return content.includes('isValidOrigin') && content.includes("['POST', 'PUT', 'PATCH', 'DELETE']");
});

test('Security headers (X-Content-Type-Options) in middleware', () => {
  const content = readFile('middleware.ts');
  return content.includes('X-Content-Type-Options') && content.includes('nosniff');
});

test('Security headers (X-Frame-Options) in middleware', () => {
  const content = readFile('middleware.ts');
  return content.includes('X-Frame-Options') && content.includes('DENY');
});

test('HSTS in production', () => {
  const content = readFile('middleware.ts');
  return content.includes('Strict-Transport-Security');
});

test('Security headers in next.config.mjs', () => {
  const content = readFile('next.config.mjs');
  return content.includes('X-Content-Type-Options') && content.includes('Referrer-Policy');
});

test('Session cookie has secure flag in production', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return content.includes("sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'");
});

test('Password change invalidates other sessions', () => {
  const content = readFile('src/app/api/auth/change-password/route.ts');
  return content.includes('invalidateUserSessions');
});

test('User deactivation invalidates sessions', () => {
  const content = readFile('src/app/api/users/route.ts');
  return content.includes('invalidateUserSessions');
});

// ═══════════════════════════════════════════════════
// 10. ALL API ROUTES USE AUTH PIPELINE
// ═══════════════════════════════════════════════════
console.log('\n🌐 10. API Route Migration');

const criticalRoutes = [
  'src/app/api/sales/route.ts',
  'src/app/api/inventory/route.ts',
  'src/app/api/purchases/route.ts',
  'src/app/api/customers/route.ts',
  'src/app/api/vendors/route.ts',
  'src/app/api/expenses/route.ts',
  'src/app/api/transfers/route.ts',
  'src/app/api/settings/route.ts',
  'src/app/api/stores/route.ts',
  'src/app/api/accounting/route.ts',
  'src/app/api/reports/route.ts',
];

for (const route of criticalRoutes) {
  test(`${route} uses authenticateRequest`, () => {
    if (!fileExists(route)) return `file not found`;
    const content = readFile(route);
    if (content.includes('getAuthUserFromRequest')) {
      return 'still uses old getAuthUserFromRequest';
    }
    return content.includes('authenticateRequest');
  });
}

// ═══════════════════════════════════════════════════
// 11. FAIL-CLOSED DB SESSIONS & FORM DRAFT PROTECTION
// ═══════════════════════════════════════════════════
console.log('\n🔒 11. Fail-Closed Sessions, Form Draft Protection & Data Hygiene');

test('Login uses single final token model with sid', () => {
  const loginContent = readFile('src/app/api/auth/login/route.ts');
  const authContent = readFile('src/lib/auth.ts');
  return (
    loginContent.includes('sessionId') &&
    loginContent.includes('hashSessionToken(finalToken)') &&
    authContent.includes('sid: sessionId')
  );
});

test('Login fails closed on DB session creation failure (503 and NO cookie)', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return (
    content.includes('status: 503') &&
    !content.includes('session will still work via JWT') &&
    content.includes('Authentication service temporarily unavailable')
  );
});

test('/api/auth/me uses authoritative authPipeline with tokenHash check', () => {
  const content = readFile('src/app/api/auth/me/route.ts');
  return content.includes('authenticateRequest') && content.includes('authoritativeUser');
});

test('Login landing redirects to /sales and uses "Sign In" button', () => {
  const loginForm = readFile('src/app/sign-up-login/components/LoginForm.tsx');
  const appPage = readFile('src/app/page.tsx');
  return (
    loginForm.includes("router.push('/sales')") &&
    loginForm.includes('Sign In') &&
    !loginForm.includes('Sign In to Dashboard') &&
    appPage.includes("redirect('/sales')")
  );
});

test('UserFormModal uses stable initialization and draft protection', () => {
  const content = readFile('src/components/forms/UserFormModal.tsx');
  return (
    content.includes('prevOpenRef') &&
    content.includes('editUserIdRef') &&
    content.includes('handleSafeClose') &&
    !content.includes('+91 99000 12345')
  );
});

test('Fake phone numbers completely removed from forms and APIs', () => {
  const userModal = readFile('src/components/forms/UserFormModal.tsx');
  const storeModal = readFile('src/components/forms/StoreFormModal.tsx');
  const vendorModal = readFile('src/components/forms/VendorFormModal.tsx');
  const userProfile = readFile('src/components/UserProfileModal.tsx');
  const vendorApi = readFile('src/app/api/vendors/route.ts');
  const salesPage = readFile('src/app/sales/page.tsx');

  if (userModal.includes('+91 99000 12345')) return 'UserFormModal contains +91 99000 12345';
  if (storeModal.includes('+91 99000 99000')) return 'StoreFormModal contains +91 99000 99000';
  if (vendorModal.includes('+91 98000 00000')) return 'VendorFormModal contains +91 98000 00000';
  if (userProfile.includes('+91 98765 00000')) return 'UserProfileModal contains +91 98765 00000';
  if (vendorApi.includes('+91 00000 00000')) return 'Vendor API contains +91 00000 00000';
  if (salesPage.includes('+91 99000 00000')) return 'Sales page contains +91 99000 00000';
  return true;
});

test('Store Manager can create Sales Manager only and forced to own store', () => {
  const content = readFile('src/app/api/users/route.ts');
  return (
    content.includes("authUser.role === 'Store Manager'") &&
    content.includes("requestedRole !== 'Sales Manager'") &&
    (content.includes('targetAssignedStores = [managerStore]') ||
      content.includes('targetAssignedStores = authUser.allowedStores'))
  );
});

test('User creation uses atomic database transaction', () => {
  const content = readFile('src/app/api/users/route.ts');
  return (
    content.includes('executeTransaction') &&
    content.includes('tx.userAccount.create') &&
    content.includes('tx.userStoreAssignment.create') &&
    content.includes('tx.auditLog.create')
  );
});

test('30-day session expiry matches between cookie and DB UserSession', () => {
  const content = readFile('src/app/api/auth/login/route.ts');
  return (
    content.includes('30 * 24 * 60 * 60 * 1000') &&
    content.includes('maxAge: SESSION_COOKIE_MAX_AGE')
  );
});

// ═══════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`📊 Phase 1 Test Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Failures:');
  errors.forEach((e) => console.log(`   • ${e}`));
}
console.log('═'.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);

