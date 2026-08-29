import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting COSKO MySQL Production Database Seeding...');

  // 1. STORES / HUBS
  const storesData = [
    { code: 'CENTRAL', name: 'Central Warehouse & Hub', city: 'Bengaluru', address: 'Plot 42, Electronic City Phase 1', managerName: 'Rohan Sharma', phone: '+91 9876543210', registersCount: 0, skusCount: 450, monthlyRevenue: 0.00 },
    { code: 'BLR', name: 'Bengaluru Flagship Store', city: 'Bengaluru', address: 'Indiranagar 100ft Road', managerName: 'Ananya Rao', phone: '+91 9876543211', registersCount: 4, skusCount: 380, monthlyRevenue: 1450000.00 },
    { code: 'HYD', name: 'Hyderabad Tech Hub Store', city: 'Hyderabad', address: 'HITEC City Cyber Towers', managerName: 'Priya Sharma', phone: '+91 9876543212', registersCount: 3, skusCount: 320, monthlyRevenue: 1200000.00 },
    { code: 'DEL', name: 'Delhi NCR Experience Store', city: 'Delhi', address: 'Connaught Place Block A', managerName: 'Vikram Singh', phone: '+91 9876543213', registersCount: 3, skusCount: 290, monthlyRevenue: 980000.00 },
    { code: 'MUM', name: 'Mumbai Retail Store', city: 'Mumbai', address: 'Linking Road, Bandra West', managerName: 'Rakesh Patel', phone: '+91 9876543214', registersCount: 2, skusCount: 240, monthlyRevenue: 850000.00 },
  ];

  for (const s of storesData) {
    await prisma.storeHub.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
  }
  console.log('✅ 5 Store Hubs created');

  // 2. USER ACCOUNTS & PROFILES (Salted Bcrypt Password Hashes)
  const defaultPasswordHash = await bcrypt.hash('Cosko2026@', 12);

  const usersData = [
    { email: 'cosko@gmail.com', name: 'Mohammad Hasan', role: 'Super Admin', securityLevel: 100, storeScope: 'All Stores', shiftStatus: 'On Shift' },
    { email: 'ananya.blr@cosko.com', name: 'Ananya Rao', role: 'Store Manager', securityLevel: 80, storeScope: 'BLR', shiftStatus: 'On Shift' },
    { email: 'priya.hyd@cosko.com', name: 'Priya Sharma', role: 'Store Manager', securityLevel: 80, storeScope: 'HYD', shiftStatus: 'On Shift' },
    { email: 'vikram.del@cosko.com', name: 'Vikram Singh', role: 'Store Manager', securityLevel: 80, storeScope: 'DEL', shiftStatus: 'On Shift' },
    { email: 'rakesh.mum@cosko.com', name: 'Rakesh Patel', role: 'Store Manager', securityLevel: 80, storeScope: 'MUM', shiftStatus: 'On Shift' },
    { email: 'kavita.auditor@cosko.com', name: 'Kavita Iyer', role: 'Inventory Auditor', securityLevel: 60, storeScope: 'BLR', shiftStatus: 'On Shift' },
    { email: 'suresh.sales@cosko.com', name: 'Suresh Kumar', role: 'Sales Executive', securityLevel: 40, storeScope: 'BLR', shiftStatus: 'On Shift' },
    { email: 'rahul.cashier@cosko.com', name: 'Rahul Verma', role: 'POS Cashier', securityLevel: 20, storeScope: 'BLR', shiftStatus: 'On Shift' },
  ];

  for (const u of usersData) {
    const userObj = await prisma.userAccount.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        securityLevel: u.securityLevel,
        storeScope: u.storeScope,
        shiftStatus: u.shiftStatus,
        status: 'Active',
      },
      create: {
        email: u.email,
        passwordHash: defaultPasswordHash,
        name: u.name,
        role: u.role,
        securityLevel: u.securityLevel,
        storeScope: u.storeScope,
        status: 'Active',
        shiftStatus: u.shiftStatus,
      },
    });

    if (u.storeScope && u.storeScope !== 'All Stores') {
      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: userObj.id, storeCode: u.storeScope } },
        update: {},
        create: { userId: userObj.id, storeCode: u.storeScope },
      });
    }
  }
  console.log('✅ 8 User Accounts seeded with salted bcrypt password hashes');

  // 3. PRODUCTS CATALOG
  const productsData = [
    { sku: 'CSK-APL-IP15P-128', barcode: '890123456701', name: 'iPhone 15 Pro 128GB Titanium', brand: 'Apple', category: 'Smartphones', baseCostPrice: 105000, baseSellingPrice: 134900, warrantyMonths: 12 },
    { sku: 'CSK-SAM-S24U-256', barcode: '890123456702', name: 'Samsung Galaxy S24 Ultra 256GB', brand: 'Samsung', category: 'Smartphones', baseCostPrice: 98000, baseSellingPrice: 129999, warrantyMonths: 12 },
    { sku: 'CSK-APL-MBA-M3', barcode: '890123456703', name: 'MacBook Air M3 8GB 512GB', brand: 'Apple', category: 'Laptops', baseCostPrice: 110000, baseSellingPrice: 134900, warrantyMonths: 12 },
    { sku: 'CSK-SNY-WH1000XM5', barcode: '890123456704', name: 'Sony WH-1000XM5 Wireless Headphones', brand: 'Sony', category: 'Audio', baseCostPrice: 22000, baseSellingPrice: 29990, warrantyMonths: 12 },
    { sku: 'CSK-DEL-XPS13-9320', barcode: '890123456705', name: 'Dell XPS 13 Plus Intel i7 16GB', brand: 'Dell', category: 'Laptops', baseCostPrice: 125000, baseSellingPrice: 159990, warrantyMonths: 24 },
  ];

  for (const p of productsData) {
    const productObj = await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: p,
    });

    // Seed Inventory across Central and BLR stores
    for (const storeCode of ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM']) {
      const qtyOnHand = storeCode === 'CENTRAL' ? 50 : 15;
      await prisma.inventory.upsert({
        where: { productId_storeCode: { productId: productObj.id, storeCode } },
        update: { qtyOnHand },
        create: { productId: productObj.id, storeCode, qtyOnHand, reorderPt: 5, maxStock: 50 },
      });
    }
  }
  console.log('✅ 5 Products and store inventory records seeded');

  // 4. CUSTOMERS & REPAIRS
  const customerObj = await prisma.customer.upsert({
    where: { id: 'cust_001_seed' },
    update: {},
    create: {
      id: 'cust_001_seed',
      name: 'Rajesh Sharma',
      phone: '+91 98765 43210',
      normalizedPhone: '9876543210',
      email: 'rajesh.sharma@gmail.com',
      city: 'Bengaluru',
      totalSpent: 45000,
      totalOrders: 3,
    },
  });

  await prisma.repairEnquiry.upsert({
    where: { ticketNo: 'REP-2026-0042' },
    update: {},
    create: {
      ticketNo: 'REP-2026-0042',
      customerId: customerObj.id,
      customerName: 'Rajesh Sharma',
      customerPhone: '+91 98765 43210',
      normalizedPhone: '9876543210',
      deviceName: 'iPhone 13 Pro',
      issueDescription: 'Screen flickering & glass replacement',
      estimatedCost: 12500,
      status: 'In Repair',
      assignedTech: 'Arun Kumar',
    },
  });
  console.log('✅ Customer master & repair enquiry seeded');

  // 5. WHITE-LABEL BRANDING
  await prisma.brandingSetting.upsert({
    where: { id: 'cosko_branding_config' },
    update: {
      appName: 'COSKO',
      logoUrl: null,
      tagline: 'Multi-Store Enterprise Retail & POS System',
      supportEmail: 'support@cosko.com',
    },
    create: {
      id: 'cosko_branding_config',
      appName: 'COSKO',
      logoUrl: null,
      tagline: 'Multi-Store Enterprise Retail & POS System',
      supportEmail: 'support@cosko.com',
    },
  });
  console.log('✅ White-label branding settings seeded');

  console.log('🎉 COSKO MySQL Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
