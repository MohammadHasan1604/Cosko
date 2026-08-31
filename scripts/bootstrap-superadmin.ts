import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function bootstrapSuperAdmin() {
  console.log('\n===============================================================');
  console.log('🔒 COSKO ENTERPRISE — SECURE SUPER ADMIN BOOTSTRAP PROTOCOL');
  console.log('===============================================================\n');

  // Read bootstrap parameters securely from environment variables or command-line args
  const email = (
    process.env.BOOTSTRAP_SUPERADMIN_EMAIL ||
    process.argv[2] ||
    'cosko@gmail.com'
  ).toLowerCase().trim();

  const tempPassword =
    process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ||
    process.argv[3] ||
    'Cosko2026@InitialAdmin';

  if (!email || !email.includes('@')) {
    console.error('❌ Error: Valid Super Admin email address is required.');
    process.exit(1);
  }

  if (!tempPassword || tempPassword.length < 8) {
    console.error('❌ Error: Super Admin initial password must be at least 8 characters.');
    process.exit(1);
  }

  try {
    // 1. Check if user already exists
    const existing = await prisma.userAccount.findUnique({
      where: { email },
      include: { storeAssignments: true },
    });

    const hashedPassword = await hashPassword(tempPassword);

    // Get all available store hubs
    const allStores = await prisma.storeHub.findMany({ select: { code: true } });
    const storeCodes = allStores.length > 0 ? allStores.map((s) => s.code) : ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'];

    if (existing) {
      console.log(`ℹ️  Existing account found for: ${email}`);
      console.log('🔄 Re-provisioning and resetting credentials to initial Super Admin state...');

      await prisma.$transaction(async (tx) => {
        await tx.userAccount.update({
          where: { id: existing.id },
          data: {
            name: existing.name || 'Super Admin',
            role: 'Super Admin',
            securityLevel: 100,
            storeScope: 'All Stores',
            status: 'Active',
            shiftStatus: 'On Shift',
            passwordHash: hashedPassword,
            mustChangePassword: true, // Mandatory password update on first login
          },
        });

        // Ensure store assignments exist
        await tx.userStoreAssignment.deleteMany({ where: { userId: existing.id } });
        for (const code of storeCodes) {
          await tx.userStoreAssignment.create({
            data: {
              userId: existing.id,
              storeCode: code,
            },
          });
        }

        // Record audit log
        await tx.auditLog.create({
          data: {
            userEmail: email,
            userRole: 'Super Admin',
            storeCode: 'CENTRAL',
            module: 'Authentication',
            action: 'Bootstrap Super Admin',
            details: `Super Admin account initialized with mandatory first-login password rotation for ${email}`,
            ipAddress: '127.0.0.1',
          },
        });
      });

      console.log('✅ Super Admin account updated successfully.');
      console.log('🛡️  Role: Super Admin (Level 100)');
      console.log('🏢 Store Scope: All Stores');
      console.log('🔑 Force Password Change Flag: Active (Must change password on first login)');
    } else {
      console.log(`✨ Provisioning new authoritative Super Admin for: ${email}`);

      await prisma.$transaction(async (tx) => {
        const newUser = await tx.userAccount.create({
          data: {
            name: 'Super Admin',
            email,
            passwordHash: hashedPassword,
            role: 'Super Admin',
            securityLevel: 100,
            storeScope: 'All Stores',
            status: 'Active',
            shiftStatus: 'On Shift',
            mustChangePassword: true, // Mandatory password update on first login
          },
        });

        for (const code of storeCodes) {
          await tx.userStoreAssignment.create({
            data: {
              userId: newUser.id,
              storeCode: code,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userEmail: email,
            userRole: 'Super Admin',
            storeCode: 'CENTRAL',
            module: 'Authentication',
            action: 'Bootstrap Super Admin',
            details: `Initial Super Admin account provisioned for ${email}`,
            ipAddress: '127.0.0.1',
          },
        });
      });

      console.log('✅ Initial Super Admin created in MySQL database successfully.');
      console.log('🛡️  Role: Super Admin (Level 100)');
      console.log('🏢 Store Scope: All Stores');
      console.log('🔑 Force Password Change Flag: Active (Must change password on first login)');
    }

    console.log('\n===============================================================');
    console.log('🎉 Super Admin Bootstrap Completed Successfully!');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to bootstrap Super Admin:', error);
    process.exit(1);
  }
}

bootstrapSuperAdmin();
