import { prisma } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function auditAndNormalizeUserStores() {
  console.log('--- Phase 1: User Store Assignment Audit & Normalization ---');

  const users = await prisma.userAccount.findMany({
    include: {
      storeAssignments: true,
    },
  });

  console.log(`Auditing ${users.length} users...`);
  const report: any[] = [];

  for (const user of users) {
    const isSuperAdmin = user.role === 'Super Admin' || user.securityLevel === 100;
    const assignments = user.storeAssignments;

    if (isSuperAdmin) {
      report.push({
        userId: user.id,
        email: user.email,
        role: user.role,
        securityLevel: user.securityLevel,
        status: 'SUPER_ADMIN_ENTERPRISE',
        storeScope: user.storeScope,
        assignmentCount: assignments.length,
        assignedStores: assignments.map((a) => a.storeCode),
      });
      continue;
    }

    // Non-Super-Admin: Must have EXACTLY ONE store.
    // Determine the primary/authoritative store
    let primaryStore = user.storeScope;
    if (!primaryStore || primaryStore === 'All Stores') {
      if (assignments.length > 0) {
        primaryStore = assignments[0].storeCode;
      } else {
        primaryStore = 'BLR'; // default fallback
      }
    }

    const assignedStores = assignments.map((a) => a.storeCode);
    const hasMultipleAssignments = assignments.length > 1;
    const missingAssignment = assignments.length === 0;
    const scopeMismatch = assignments.length === 1 && assignments[0].storeCode !== primaryStore;

    if (hasMultipleAssignments || missingAssignment || scopeMismatch || user.storeScope !== primaryStore) {
      console.log(`Normalizing user ${user.email} (${user.role}):`);
      console.log(`  Current storeScope: ${user.storeScope}`);
      console.log(`  Current assignments: [${assignedStores.join(', ')}]`);
      console.log(`  Normalized primaryStore: ${primaryStore}`);

      // 1. Update userAccount storeScope
      await prisma.userAccount.update({
        where: { id: user.id },
        data: { storeScope: primaryStore },
      });

      // 2. Remove non-primary assignments
      await prisma.userStoreAssignment.deleteMany({
        where: {
          userId: user.id,
          storeCode: { not: primaryStore },
        },
      });

      // 3. Ensure primary assignment exists
      const existingPrimary = await prisma.userStoreAssignment.findUnique({
        where: {
          userId_storeCode: {
            userId: user.id,
            storeCode: primaryStore,
          },
        },
      });

      if (!existingPrimary) {
        await prisma.userStoreAssignment.create({
          data: {
            userId: user.id,
            storeCode: primaryStore,
          },
        });
      }

      report.push({
        userId: user.id,
        email: user.email,
        role: user.role,
        securityLevel: user.securityLevel,
        status: 'NORMALIZED_TO_SINGLE_STORE',
        previousStoreScope: user.storeScope,
        previousAssignments: assignedStores,
        normalizedStore: primaryStore,
      });
    } else {
      report.push({
        userId: user.id,
        email: user.email,
        role: user.role,
        securityLevel: user.securityLevel,
        status: 'ALREADY_SINGLE_STORE_COMPLIANT',
        storeScope: user.storeScope,
        normalizedStore: primaryStore,
      });
    }
  }

  const reportsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `user_store_normalization_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Audit report written to: ${reportPath}`);
  console.log('--- User Store Normalization Completed ---');
}

auditAndNormalizeUserStores()
  .catch((e) => {
    console.error('Audit failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
