import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a cryptographically secure temporary password.
 */
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(16);
  let password = '';
  for (let i = 0; i < 14; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

async function main() {
  console.log('🌱 Starting COSKO Clean Database Seeding...');
  console.log('   Only genuine system master data — no fake business data.');

  // ──────────────────────────────────────────────────────────────────
  // 1. STORES / HUBS (system infrastructure)
  // ──────────────────────────────────────────────────────────────────
  const storesData = [
    { code: 'CENTRAL', name: 'Central Warehouse & Hub', city: 'Bengaluru', address: 'Plot 42, Electronic City Phase 1', timezone: 'Asia/Kolkata' },
    { code: 'BLR', name: 'Bengaluru Flagship Store', city: 'Bengaluru', address: 'Indiranagar 100ft Road', timezone: 'Asia/Kolkata' },
    { code: 'HYD', name: 'Hyderabad Tech Hub Store', city: 'Hyderabad', address: 'HITEC City Cyber Towers', timezone: 'Asia/Kolkata' },
    { code: 'DEL', name: 'Delhi NCR Experience Store', city: 'Delhi', address: 'Connaught Place Block A', timezone: 'Asia/Kolkata' },
    { code: 'MUM', name: 'Mumbai Retail Store', city: 'Mumbai', address: 'Linking Road, Bandra West', timezone: 'Asia/Kolkata' },
  ];

  for (const s of storesData) {
    await prisma.storeHub.upsert({
      where: { code: s.code },
      update: { name: s.name, city: s.city, address: s.address, timezone: s.timezone },
      create: s,
    });
  }
  console.log('✅ 5 Store Hubs created');

  // ──────────────────────────────────────────────────────────────────
  // 2. SUPER ADMIN ACCOUNT (ONE protected account)
  //    Password is generated securely and printed to console ONCE.
  // ──────────────────────────────────────────────────────────────────
  const superAdminEmail = 'cosko@gmail.com';
  const existingSuperAdmin = await prisma.userAccount.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const tempPassword = generateSecurePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const superAdmin = await prisma.userAccount.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        name: 'Abdul Wajid',
        role: 'Super Admin',
        securityLevel: 100,
        storeScope: 'All Stores',
        status: 'Active',
        mustChangePassword: true,
      },
    });

    // Assign Super Admin to all stores
    for (const s of storesData) {
      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: superAdmin.id, storeCode: s.code } },
        update: {},
        create: { userId: superAdmin.id, storeCode: s.code },
      });
    }

    console.log('✅ Super Admin created');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  SUPER ADMIN CREDENTIALS (save securely!)       ║');
    console.log(`║  Email:    ${superAdminEmail.padEnd(38)}║`);
    console.log(`║  Password: ${tempPassword.padEnd(38)}║`);
    console.log('║  MUST change password on first login.           ║');
    console.log('╚══════════════════════════════════════════════════╝');
  } else {
    console.log('ℹ️  Super Admin already exists, skipping creation');
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. CATEGORIES & TAXONOMY (system master data)
  // ──────────────────────────────────────────────────────────────────
  const rootCategories = [
    { id: 'cat-mobiles', name: 'Mobile / Device', slug: 'mobile-device', categoryType: 'Device', description: 'Smartphones, Tablets, Smartwatches, and Laptops', status: 'Active', sortOrder: 1 },
    { id: 'cat-mobile-parts', name: 'Mobile Parts / Repair-Related', slug: 'mobile-parts-repair', categoryType: 'Spare Part', description: 'Displays, Batteries, Cameras, Ports, Charging Accessories', status: 'Active', sortOrder: 10 },
    { id: 'cat-ev', name: 'EV / Electric Vehicle', slug: 'ev-electric-vehicle', categoryType: 'EV', description: 'EV Spare parts, batteries, general service components', status: 'Active', sortOrder: 30 },
    { id: 'cat-home-appliances', name: 'Home Appliances', slug: 'home-appliances', categoryType: 'Home Appliance', description: 'AC, TV, Washing Machine, Refrigerator and Spares', status: 'Active', sortOrder: 50 },
  ];

  for (const cat of rootCategories) {
    await (prisma as any).category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }

  const subCategories = [
    { id: 'cat-smartphones', name: 'Smartphones', slug: 'smartphones', parentCategoryId: 'cat-mobiles', categoryType: 'Device', description: 'Android & iOS Mobile Phones', status: 'Active', sortOrder: 2 },
    { id: 'cat-tablets', name: 'Tablets', slug: 'tablets', parentCategoryId: 'cat-mobiles', categoryType: 'Device', description: 'iPads and Android Tablets', status: 'Active', sortOrder: 3 },
    { id: 'cat-smartwatches', name: 'Apple Watch / Smart Watch', slug: 'smartwatches', parentCategoryId: 'cat-mobiles', categoryType: 'Device', description: 'Smartwatches & Wearables', status: 'Active', sortOrder: 4 },
    { id: 'cat-laptops', name: 'Laptops', slug: 'laptops', parentCategoryId: 'cat-mobiles', categoryType: 'Device', description: 'Laptops & MacBooks', status: 'Active', sortOrder: 5 },
    { id: 'cat-display', name: 'Screen / Display', slug: 'screen-display', parentCategoryId: 'cat-mobile-parts', categoryType: 'Spare Part', description: 'Touchscreen displays and LCD assemblies', status: 'Active', sortOrder: 11 },
    { id: 'cat-battery', name: 'Battery', slug: 'battery', parentCategoryId: 'cat-mobile-parts', categoryType: 'Spare Part', description: 'OEM & High-capacity lithium replacement batteries', status: 'Active', sortOrder: 13 },
    { id: 'cat-charging-port', name: 'Charging Port', slug: 'charging-port', parentCategoryId: 'cat-mobile-parts', categoryType: 'Spare Part', description: 'Type-C & Lightning charging flex cables', status: 'Active', sortOrder: 14 },
    { id: 'cat-camera', name: 'Camera', slug: 'camera', parentCategoryId: 'cat-mobile-parts', categoryType: 'Spare Part', description: 'Rear and front selfie camera modules', status: 'Active', sortOrder: 18 },
    { id: 'cat-chargers', name: 'Adapters / Chargers', slug: 'adapters-chargers', parentCategoryId: 'cat-mobile-parts', categoryType: 'Accessory', description: 'Fast chargers and power bricks', status: 'Active', sortOrder: 19 },
    { id: 'cat-cables', name: 'Cables', slug: 'cables', parentCategoryId: 'cat-mobile-parts', categoryType: 'Accessory', description: 'Braided Type-C, Lightning, USB cables', status: 'Active', sortOrder: 20 },
    { id: 'cat-ev-service', name: 'General Service', slug: 'ev-general-service', parentCategoryId: 'cat-ev', categoryType: 'Service', description: 'EV Periodic maintenance and servicing kits', status: 'Active', sortOrder: 31 },
    { id: 'cat-ev-brakes', name: 'Brake Parts', slug: 'ev-brake-parts', parentCategoryId: 'cat-ev', categoryType: 'Spare Part', description: 'Disc pads, brake shoes, calipers', status: 'Active', sortOrder: 32 },
    { id: 'cat-ev-battery', name: 'Battery / Electrical', slug: 'ev-battery-electrical', parentCategoryId: 'cat-ev', categoryType: 'EV', description: 'Lithium battery packs, BMS, and motor controllers', status: 'Active', sortOrder: 37 },
  ];

  for (const cat of subCategories) {
    await (prisma as any).category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }
  console.log('✅ Categories and subcategories taxonomy seeded');

  // ──────────────────────────────────────────────────────────────────
  // 4. CATEGORY TYPES (system master data)
  // ──────────────────────────────────────────────────────────────────
  const categoryTypes = [
    { name: 'Product', code: 'PRODUCT', description: 'General retail product', isSystem: true },
    { name: 'Device', code: 'DEVICE', description: 'Electronic device', isSystem: true },
    { name: 'Spare Part', code: 'SPARE_PART', description: 'Replacement component', isSystem: true },
    { name: 'Accessory', code: 'ACCESSORY', description: 'Device accessory', isSystem: true },
    { name: 'Service', code: 'SERVICE', description: 'Service item', isSystem: true },
    { name: 'EV', code: 'EV', description: 'Electric vehicle component', isSystem: true },
    { name: 'Home Appliance', code: 'HOME_APPLIANCE', description: 'Home appliance product', isSystem: true },
  ];

  for (const ct of categoryTypes) {
    await prisma.categoryType.upsert({
      where: { code: ct.code },
      update: ct,
      create: ct,
    });
  }
  console.log('✅ Category types seeded');

  // ──────────────────────────────────────────────────────────────────
  // 5. PAYMENT METHODS — Exactly 3: Cash, UPI, Other
  // ──────────────────────────────────────────────────────────────────
  const paymentMethods = [
    { name: 'Cash', code: 'CASH', type: 'Cash', description: 'Cash payment', isSystem: true, sortOrder: 1, status: 'Active' },
    { name: 'UPI', code: 'UPI', type: 'UPI', description: 'Instant UPI / QR Code payment', isSystem: true, sortOrder: 2, status: 'Active' },
    { name: 'Other', code: 'OTHER', type: 'Other', description: 'Other payment method', isSystem: true, sortOrder: 3, status: 'Active' },
  ];

  // Remove any non-system payment methods first
  await prisma.paymentMethod.deleteMany({
    where: { code: { notIn: ['CASH', 'UPI', 'OTHER'] } },
  });

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: pm,
      create: pm,
    });
  }
  console.log('✅ Payment methods seeded (Cash, UPI, Other only)');

  // ──────────────────────────────────────────────────────────────────
  // 6. BRANDS MASTER (system master data)
  // ──────────────────────────────────────────────────────────────────
  const brands = [
    { name: 'Apple', code: 'APPLE', description: 'Apple Inc.' },
    { name: 'Samsung', code: 'SAMSUNG', description: 'Samsung Electronics' },
    { name: 'Sony', code: 'SONY', description: 'Sony Corporation' },
    { name: 'Dell', code: 'DELL', description: 'Dell Technologies' },
    { name: 'Xiaomi', code: 'XIAOMI', description: 'Xiaomi Corporation' },
    { name: 'OnePlus', code: 'ONEPLUS', description: 'OnePlus Technology' },
    { name: 'Asus', code: 'ASUS', description: 'ASUSTeK Computer Inc.' },
    { name: 'Lenovo', code: 'LENOVO', description: 'Lenovo Group Limited' },
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { code: b.code },
      update: b,
      create: b,
    });
  }
  console.log('✅ Brand master data seeded');

  // ──────────────────────────────────────────────────────────────────
  // 7. UNITS OF MEASUREMENT (system master data)
  // ──────────────────────────────────────────────────────────────────
  const units = [
    { name: 'Piece', code: 'PCS', symbol: 'pcs', description: 'Individual piece/unit' },
    { name: 'Box', code: 'BOX', symbol: 'box', description: 'Box/carton unit' },
    { name: 'Set', code: 'SET', symbol: 'set', description: 'Set of items' },
    { name: 'Kilogram', code: 'KG', symbol: 'kg', description: 'Weight in kilograms' },
    { name: 'Meter', code: 'MTR', symbol: 'm', description: 'Length in meters' },
  ];

  for (const u of units) {
    await prisma.unit.upsert({
      where: { code: u.code },
      update: u,
      create: u,
    });
  }
  console.log('✅ Units of measurement seeded');

  // ──────────────────────────────────────────────────────────────────
  // 8. SYSTEM SETTINGS & BRANDING (single-row defaults)
  // ──────────────────────────────────────────────────────────────────
  await prisma.brandingSetting.upsert({
    where: { id: 'cosko_branding_config' },
    update: {},
    create: {
      id: 'cosko_branding_config',
      appName: 'COSKO',
      tagline: 'Multi-Store Enterprise Retail & POS System',
      supportEmail: 'support@cosko.com',
      baseCurrency: 'INR (₹)',
    },
  });

  await prisma.systemSettings.upsert({
    where: { id: 'cosko_system_config' },
    update: {},
    create: {
      id: 'cosko_system_config',
      sessionTimeoutMins: 43200, // 30 days
      maxLoginAttempts: 5,
    },
  });
  console.log('✅ System settings and branding defaults seeded');

  console.log('\n🎉 COSKO Clean Database Seeding Complete!');
  console.log('   No fake demo business data was created.');
  console.log('   Only system master data (stores, categories, brands, units, payment methods).');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
