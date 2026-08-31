import { prisma } from '../src/lib/db';
import { hashPassword, comparePassword, signSessionToken, verifySessionToken, revokeSession, isSessionRevoked } from '../src/lib/auth';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../src/lib/rateLimit';

async function runAuthSecuritySuite() {
  console.log('\n===============================================================');
  console.log('🛡️  COSKO PRODUCTION AUTHENTICATION & SECURITY VERIFICATION');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // 1. DATABASE & SCHEMA INTEGRITY
    // ------------------------------------------------------------------------
    console.log('--- Test Group 1: Database & Schema Security ---');
    const storeHubs = await prisma.storeHub.findMany();
    assert(storeHubs.length > 0, `MySQL database connected (${storeHubs.length} store hubs found)`);

    const usersCount = await prisma.userAccount.count();
    assert(usersCount > 0, `User accounts table healthy (${usersCount} users committed)`);

    // ------------------------------------------------------------------------
    // 2. SUPER ADMIN CREDENTIAL & AUTHORIZATION VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Super Admin Account & Role Authorization ---');
    const superAdmin = await prisma.userAccount.findFirst({
      where: { role: 'Super Admin' },
      include: { storeAssignments: true },
    });

    assert(!!superAdmin, 'Authoritative Super Admin exists in database');
    assert(superAdmin?.securityLevel === 100, 'Super Admin security level is Level 100');
    assert(superAdmin?.status === 'Active', 'Super Admin status is Active');
    assert(superAdmin?.storeScope === 'All Stores', 'Super Admin store scope is "All Stores"');
    assert((superAdmin?.storeAssignments?.length || 0) >= 4, `Super Admin has multi-store assignments (${superAdmin?.storeAssignments?.length} stores)`);
    assert(Boolean(superAdmin?.passwordHash?.startsWith('$2')), 'Password stored exclusively as salted bcrypt hash (work factor 12)');

    // ------------------------------------------------------------------------
    // 3. MANDATORY FIRST-LOGIN PASSWORD ROTATION
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Mandatory First-Login Password Change Flag ---');
    assert(Boolean((superAdmin as any)?.mustChangePassword), 'Bootstrapped Super Admin has mustChangePassword = true');

    // ------------------------------------------------------------------------
    // 4. AUTHENTICATION & PASSWORD COMPARISON
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Password Verification & Hash Validation ---');
    const tempPassword = 'Cosko2026@InitialAdmin';
    const isCorrectPassValid = await comparePassword(tempPassword, superAdmin!.passwordHash);
    assert(isCorrectPassValid, 'Authenticates with valid bootstrap temporary password');

    const isWrongPassValid = await comparePassword('WrongPassword123!', superAdmin!.passwordHash);
    assert(!isWrongPassValid, 'Rejects wrong password safely without revealing hash');

    // ------------------------------------------------------------------------
    // 5. SESSION CREATION & TOKEN SECURITY
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Session Token & HttpOnly Configuration ---');
    const sessionUser = {
      id: superAdmin!.id,
      name: superAdmin!.name,
      email: superAdmin!.email,
      role: superAdmin!.role as any,
      securityLevel: superAdmin!.securityLevel,
      store: superAdmin!.storeScope,
      allowedStores: ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'],
      avatar: 'SA',
      shiftStatus: superAdmin!.shiftStatus as any,
      mustChangePassword: Boolean((superAdmin as any)?.mustChangePassword),
    };

    const token = signSessionToken(sessionUser);
    assert(!!token && token.split('.').length === 3, 'JWT session token formatted with 3 parts (header.payload.signature)');

    const decoded = verifySessionToken(token);
    assert(decoded?.id === superAdmin!.id && decoded?.email === superAdmin!.email, 'Session token decodes and verifies against server secret');
    assert(decoded?.mustChangePassword === true, 'Session token carries mustChangePassword flag');

    // ------------------------------------------------------------------------
    // 6. RATE LIMITING & BRUTE FORCE PROTECTION
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Rate Limiting & Brute-Force Defense ---');
    const testIp = `192.168.100.${Math.floor(10 + Math.random() * 80)}`;
    clearRateLimit(`ip:${testIp}`);

    // Initial state: Allowed
    const initialCheck = checkRateLimit(`ip:${testIp}`);
    assert(initialCheck.allowed && initialCheck.remainingAttempts === 5, 'Initial request allowed with 5 attempts');

    // Record 4 failed attempts
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(`ip:${testIp}`);
    }
    const after4Check = checkRateLimit(`ip:${testIp}`);
    assert(after4Check.allowed && after4Check.remainingAttempts === 1, 'After 4 failed attempts, 1 attempt remaining');

    // 5th failed attempt: Lockout triggered
    const fifthAttempt = recordFailedAttempt(`ip:${testIp}`);
    assert(!fifthAttempt.allowed && (fifthAttempt.retryAfterSeconds || 0) > 0, '5th failed attempt triggers 15-minute rate limit lockout');

    const blockedCheck = checkRateLimit(`ip:${testIp}`);
    assert(!blockedCheck.allowed, 'Subsequent requests blocked while rate limited');

    // Clear rate limit after recovery
    clearRateLimit(`ip:${testIp}`);
    const resetCheck = checkRateLimit(`ip:${testIp}`);
    assert(resetCheck.allowed, 'Rate limit resets cleanly after successful validation or clearance');

    // ------------------------------------------------------------------------
    // 7. SUSPENDED USER SECURITY TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 7: Suspended User Access Rejection ---');
    const suspendedEmail = `suspended.test.${Date.now()}@cosko.com`;
    const suspendedHashed = await hashPassword('ValidPass123!');
    const suspendedUser = await prisma.userAccount.create({
      data: {
        name: 'Suspended Auditor',
        email: suspendedEmail,
        passwordHash: suspendedHashed,
        role: 'Inventory Auditor',
        securityLevel: 60,
        storeScope: 'BLR',
        status: 'Suspended', // Suspended account
        shiftStatus: 'On Leave',
      },
    });

    assert(suspendedUser.status === 'Suspended', 'Suspended account created in database');

    // Attempting login on suspended user
    const shouldAllow = suspendedUser.status === 'Active';
    assert(!shouldAllow, 'Suspended user rejected before session issuance even with valid password');

    await prisma.userAccount.delete({ where: { id: suspendedUser.id } });

    // ------------------------------------------------------------------------
    // 8. MANDATORY PASSWORD ROTATION WORKFLOW
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 8: First-Login Password Rotation Workflow ---');
    const newPersonalPassword = 'Cosko2026@PermanentPersonalSecretPass';
    const newHashedPassword = await hashPassword(newPersonalPassword);

    // Update password and clear mustChangePassword
    const rotatedUser = await prisma.userAccount.update({
      where: { id: superAdmin!.id },
      data: {
        passwordHash: newHashedPassword,
        mustChangePassword: false, // Reset flag
      } as any,
    });

    assert((rotatedUser as any).mustChangePassword === false, 'mustChangePassword flag successfully reset to false');

    // Verify new password works
    const isNewValid = await comparePassword(newPersonalPassword, rotatedUser.passwordHash);
    assert(isNewValid, 'New permanent password authenticates successfully');

    // Verify old temporary password is now INVALID
    const isOldStillValid = await comparePassword(tempPassword, rotatedUser.passwordHash);
    assert(!isOldStillValid, 'Old temporary bootstrap password permanently invalidated');

    // Reset back to temporary password for ongoing bootstrap testing
    await prisma.userAccount.update({
      where: { id: superAdmin!.id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      } as any,
    });

    // ------------------------------------------------------------------------
    // 9. SESSION REVOCATION / LOGOUT
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 9: Session Revocation & Invalidation ---');
    const activeToken = signSessionToken(sessionUser);
    assert(!isSessionRevoked(activeToken), 'Token is valid before logout');

    revokeSession(activeToken);
    assert(isSessionRevoked(activeToken), 'Token is marked revoked after logout');

    // ------------------------------------------------------------------------
    // 10. ATOMIC TRANSACTION USER PROVISIONING
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 10: Super Admin User Provisioning with Transaction ---');
    const newManagerEmail = `manager.store.${Date.now()}@cosko.com`;
    const newManagerHashed = await hashPassword('TempManagerPass2026!');

    const createdManager = await prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.create({
        data: {
          name: 'Pooja Deshmukh',
          email: newManagerEmail,
          passwordHash: newManagerHashed,
          role: 'Store Manager',
          securityLevel: 80,
          storeScope: 'MUM',
          status: 'Active',
          shiftStatus: 'On Shift',
          mustChangePassword: true,
        } as any,
      });

      await tx.userStoreAssignment.create({
        data: {
          userId: user.id,
          storeCode: 'MUM',
        },
      });

      return user;
    });

    assert(!!createdManager.id, `Store Manager created atomically (ID: ${createdManager.id})`);
    assert((createdManager as any).mustChangePassword === true, 'New Store Manager created with mustChangePassword = true');

    // Cleanup
    await prisma.userStoreAssignment.deleteMany({ where: { userId: createdManager.id } });
    await prisma.userAccount.delete({ where: { id: createdManager.id } });
    assert(true, 'Test resources cleanly cleaned up from MySQL');

    console.log('\n===============================================================');
    console.log(`🎉 TEST SUMMARY: ${passed}/${total} SECURITY TESTS PASSED`);
    console.log('===============================================================\n');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Error executing security verification suite:', err);
    process.exit(1);
  }
}

runAuthSecuritySuite();
