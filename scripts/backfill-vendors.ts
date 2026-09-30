import { prisma } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function backfillVendors() {
  console.log('--- Phase 1: Safe Vendor Store Ownership Backfill ---');
  
  const vendors = await (prisma as any).vendor.findMany({
    include: {
      purchases: {
        select: {
          storeCode: true,
        },
      },
    },
  });

  console.log(`Found ${vendors.length} total vendors.`);

  const auditReport: any[] = [];

  for (const v of vendors) {
    if (v.storeCode && v.storeCode.trim() !== '') {
      console.log(`Vendor ${v.code} (${v.name}) already has storeCode: ${v.storeCode}. Preserving.`);
      auditReport.push({
        id: v.id,
        code: v.code,
        name: v.name,
        action: 'PRESERVED',
        assignedStore: v.storeCode,
        reason: 'Existing valid storeCode',
      });
      continue;
    }

    // Missing storeCode - inspect purchase orders
    const poStores = Array.from(new Set(v.purchases.map((p: any) => p.storeCode).filter(Boolean)));

    let assignedStore = 'CENTRAL';
    let reason = 'Legacy CENTRAL record (no purchase history)';

    if (poStores.length === 1) {
      assignedStore = poStores[0] as string;
      reason = `Derived from single store in purchase history (${assignedStore})`;
    } else if (poStores.length > 1) {
      // Ambiguous
      assignedStore = 'CENTRAL';
      reason = `Ambiguous PO history across [${poStores.join(', ')}]; defaulted to CENTRAL per migration policy`;
    }

    console.log(`Updating Vendor ${v.code} (${v.name}): storeCode -> ${assignedStore} (${reason})`);

    await (prisma as any).vendor.update({
      where: { id: v.id },
      data: { storeCode: assignedStore },
    });

    auditReport.push({
      id: v.id,
      code: v.code,
      name: v.name,
      action: 'MIGRATED',
      assignedStore,
      reason,
      poCount: v.purchases.length,
      poStores,
    });
  }

  const reportsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `vendor_migration_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log(`Migration report written to: ${reportPath}`);
  console.log('--- Vendor Backfill Completed Successfully ---');
}

backfillVendors()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
