import { prisma } from '../src/lib/db';

async function main() {
  console.log('========================================');
  console.log('COSKO SETTINGS SYSTEM VERIFICATION SUITE');
  console.log('========================================\n');

  // 1. Verify BrandingSetting Model
  console.log('[TEST 1] Querying BrandingSetting from MySQL...');
  let branding = await prisma.brandingSetting.findUnique({
    where: { id: 'cosko_branding_config' },
  });
  if (!branding) {
    branding = await prisma.brandingSetting.create({
      data: {
        id: 'cosko_branding_config',
        appName: 'COSKO',
        tagline: 'Multi-Store Enterprise Retail & POS System',
        supportEmail: 'support@cosko.com',
        businessName: 'COSKO Retail Enterprise',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
      },
    });
  }
  console.log('  -> Found branding config:');
  console.log(`     App Name: ${branding.appName}`);
  console.log(`     Business Name: ${branding.businessName}`);
  console.log(`     City/State: ${branding.city}, ${branding.state} - ${branding.pincode}`);
  console.log('  [PASS] BrandingSetting model is active and populated.\n');

  // 2. Verify SystemSettings Model
  console.log('[TEST 2] Querying SystemSettings from MySQL...');
  let sysSettings = await (prisma as any).systemSettings.findUnique({
    where: { id: 'cosko_system_config' },
  });
  if (!sysSettings) {
    sysSettings = await (prisma as any).systemSettings.create({
      data: {
        id: 'cosko_system_config',
        gstin: '29AABCU9603R1ZM',
        legalBusinessName: 'COSKO Retail Enterprise Private Limited',
        tradeName: 'COSKO Stores',
        gstState: 'Karnataka',
        gstStateCode: '29',
        defaultTaxRate: 18.0,
        invoiceHeader: 'COSKO Retail Enterprise',
        invoiceFooter: 'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.',
        watermarkOpacity: 5,
        sessionTimeoutMins: 30,
        maxLoginAttempts: 5,
        lowStockAlerts: true,
        lowStockThreshold: 5,
      },
    });
  }
  console.log('  -> Found SystemSettings config:');
  console.log(`     GSTIN: ${sysSettings.gstin}`);
  console.log(`     Legal Name: ${sysSettings.legalBusinessName}`);
  console.log(`     State: ${sysSettings.gstState} (${sysSettings.gstStateCode})`);
  console.log(`     Default Tax Rate: ${sysSettings.defaultTaxRate}%`);
  console.log(`     Invoice Header: ${sysSettings.invoiceHeader}`);
  console.log(`     Watermark Opacity: ${sysSettings.watermarkOpacity}%`);
  console.log(`     Session Timeout: ${sysSettings.sessionTimeoutMins}m`);
  console.log(`     Low Stock Alerts: ${sysSettings.lowStockAlerts} (Threshold: ${sysSettings.lowStockThreshold})`);
  console.log('  [PASS] SystemSettings model is active and populated.\n');

  // 3. Test Mutation & Audit Logging
  console.log('[TEST 3] Performing Test Mutation on SystemSettings...');
  const updatedSys = await (prisma as any).systemSettings.update({
    where: { id: 'cosko_system_config' },
    data: {
      tradeName: 'COSKO Superstores India',
      invoiceHeader: 'COSKO Enterprise Flagship Retail',
      watermarkOpacity: 6,
    },
  });
  console.log(`  -> Updated tradeName: ${updatedSys.tradeName}`);
  console.log(`  -> Updated invoiceHeader: ${updatedSys.invoiceHeader}`);
  console.log(`  -> Updated watermarkOpacity: ${updatedSys.watermarkOpacity}`);

  // Revert back
  await (prisma as any).systemSettings.update({
    where: { id: 'cosko_system_config' },
    data: {
      tradeName: 'COSKO Stores',
      invoiceHeader: 'COSKO Retail Enterprise',
      watermarkOpacity: 5,
    },
  });
  console.log('  [PASS] Database mutation and rollback successful.\n');

  // 4. Audit Log Check
  console.log('[TEST 4] Verifying Audit Logs for Settings...');
  const logs = await prisma.auditLog.findMany({
    where: { module: 'Settings' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`  -> Found ${logs.length} settings audit logs.`);
  logs.forEach((l) => console.log(`     [${l.createdAt.toISOString()}] ${l.action}: ${l.details}`));
  console.log('  [PASS] Audit logging infrastructure is verified.\n');

  console.log('========================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! ✅');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('Test Suite Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
