import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function reseedProductionFull() {
  console.log('\n========================================================================');
  console.log('🚀 COSKO ENTERPRISE — COMPLETE PRODUCTION DATABASE RESET & RE-UPLOAD');
  console.log('========================================================================\n');

  try {
    // ──────────────────────────────────────────────────────────────────
    // 1. STORE HUBS (Core 5 Hubs)
    // ──────────────────────────────────────────────────────────────────
    console.log('🏬 1. Provisioning Store Hubs...');
    const storeHubs = [
      {
        code: 'CENTRAL',
        name: 'COSKO Central Warehouse & Owner Stock',
        city: 'Bengaluru',
        address: 'Plot 42, Electronic City Phase 1, Bengaluru',
        timezone: 'Asia/Kolkata',
        ownerName: 'Abdul Wajid',
        status: 'Active',
      },
      {
        code: 'BLR',
        name: 'Bengaluru Flagship Store',
        city: 'Bengaluru',
        address: 'Indiranagar 100ft Road, Bengaluru',
        timezone: 'Asia/Kolkata',
        managerName: 'Ananya Sharma',
        status: 'Active',
      },
      {
        code: 'HYD',
        name: 'Hyderabad Tech Hub Store',
        city: 'Hyderabad',
        address: 'HITEC City Cyber Towers, Hyderabad',
        timezone: 'Asia/Kolkata',
        managerName: 'Priya Reddy',
        status: 'Active',
      },
      {
        code: 'DEL',
        name: 'Delhi NCR Experience Store',
        city: 'Delhi',
        address: 'Connaught Place Block A, New Delhi',
        timezone: 'Asia/Kolkata',
        managerName: 'Vikram Malhotra',
        status: 'Active',
      },
      {
        code: 'CHE',
        name: 'Chennai Retail Hub',
        city: 'Chennai',
        address: 'Anna Nagar 2nd Avenue, Chennai',
        timezone: 'Asia/Kolkata',
        managerName: 'Kumar Swamy',
        status: 'Active',
      },
    ];

    for (const hub of storeHubs) {
      await prisma.storeHub.upsert({
        where: { code: hub.code },
        update: hub,
        create: hub,
      });
    }
    console.log(`  ✅ ${storeHubs.length} Store Hubs created and verified (Active).`);

    // ──────────────────────────────────────────────────────────────────
    // 2. CATEGORY TYPES & TAXONOMY
    // ──────────────────────────────────────────────────────────────────
    console.log('\n🏷️  2. Seeding Taxonomy & Category Masters...');
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

    const rootCategories = [
      { id: 'cat-mobiles', name: 'Mobile / Device', slug: 'mobile-device', categoryType: 'Device', description: 'Smartphones, Tablets, Smartwatches, and Laptops', status: 'Active', sortOrder: 1 },
      { id: 'cat-mobile-parts', name: 'Mobile Parts / Repair-Related', slug: 'mobile-parts-repair', categoryType: 'Spare Part', description: 'Displays, Batteries, Cameras, Ports, Charging Accessories', status: 'Active', sortOrder: 10 },
      { id: 'cat-ev', name: 'EV / Electric Vehicle', slug: 'ev-electric-vehicle', categoryType: 'EV', description: 'EV Spare parts, batteries, general service components', status: 'Active', sortOrder: 30 },
      { id: 'cat-home-appliances', name: 'Home Appliances', slug: 'home-appliances', categoryType: 'Home Appliance', description: 'AC, TV, Washing Machine, Refrigerator and Spares', status: 'Active', sortOrder: 50 },
    ];

    for (const cat of rootCategories) {
      await prisma.category.upsert({
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

    for (const sub of subCategories) {
      await prisma.category.upsert({
        where: { id: sub.id },
        update: sub,
        create: sub,
      });
    }
    console.log('  ✅ Category hierarchy seeded successfully.');

    // ──────────────────────────────────────────────────────────────────
    // 3. BRANDS & UNITS
    // ──────────────────────────────────────────────────────────────────
    console.log('\n🏢 3. Seeding Brands & Measurement Units...');
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
    console.log('  ✅ Brands and Units masters seeded.');

    // ──────────────────────────────────────────────────────────────────
    // 4. PAYMENT METHODS — EXACTLY 3: Cash, UPI, Other
    // ──────────────────────────────────────────────────────────────────
    console.log('\n💳 4. Seeding Payment Methods (Cash, UPI, Other only)...');
    const paymentMethods = [
      { name: 'Cash', code: 'CASH', type: 'Cash', description: 'Physical cash transaction', isSystem: true, sortOrder: 1, status: 'Active' },
      { name: 'UPI', code: 'UPI', type: 'Digital', description: 'Instant UPI / QR payment', isSystem: true, sortOrder: 2, status: 'Active' },
      { name: 'Other', code: 'OTHER', type: 'Other', description: 'Other payment method (Bank/Card/Voucher)', isSystem: true, sortOrder: 3, status: 'Active' },
    ];

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
    console.log('  ✅ Exactly 3 payment methods active in DB.');

    // ──────────────────────────────────────────────────────────────────
    // 5. SYSTEM SETTINGS & BRANDING CONFIG
    // ──────────────────────────────────────────────────────────────────
    console.log('\n⚙️  5. Setting System Configuration & Branding...');
    await prisma.brandingSetting.upsert({
      where: { id: 'cosko_branding_config' },
      update: {
        appName: 'COSKO',
        tagline: 'Multi-Store Enterprise Retail & POS System',
        supportEmail: 'support@cosko.com',
        baseCurrency: 'INR (₹)',
      },
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
      update: {
        sessionTimeoutMins: 43200, // 30 days
        maxLoginAttempts: 5,
        defaultTaxRate: 18,
      },
      create: {
        id: 'cosko_system_config',
        sessionTimeoutMins: 43200, // 30 days
        maxLoginAttempts: 5,
        defaultTaxRate: 18,
      },
    });
    console.log('  ✅ System settings and Branding configurations set.');

    // ──────────────────────────────────────────────────────────────────
    // 6. USERS & ROLES — EXACTLY 1 SUPER ADMIN & 3 VALID ROLE TYPES
    // ──────────────────────────────────────────────────────────────────
    console.log('\n👥 6. Provisioning Enterprise Users & RBAC...');
    const superAdminPasswordHash = await hashPassword('CoskoMaster2026!#');
    const managerPasswordHash = await hashPassword('CoskoManager2026!#');
    const salesPasswordHash = await hashPassword('CoskoSales2026!#');

    // Exactly ONE Super Admin
    const superAdmin = await prisma.userAccount.upsert({
      where: { email: 'cosko@gmail.com' },
      update: {
        name: 'Abdul Wajid',
        role: 'Super Admin',
        securityLevel: 100,
        storeScope: 'All Stores',
        status: 'Active',
        passwordHash: superAdminPasswordHash,
        mustChangePassword: false,
      },
      create: {
        email: 'cosko@gmail.com',
        name: 'Abdul Wajid',
        role: 'Super Admin',
        securityLevel: 100,
        storeScope: 'All Stores',
        status: 'Active',
        passwordHash: superAdminPasswordHash,
        mustChangePassword: false,
      },
    });

    // Assign Super Admin to all stores
    for (const hub of storeHubs) {
      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: superAdmin.id, storeCode: hub.code } },
        update: {},
        create: { userId: superAdmin.id, storeCode: hub.code },
      });
    }

    // Provision Store Managers (Level 80)
    const storeManagers = [
      { email: 'ananya.blr@cosko.com', name: 'Ananya Sharma', store: 'BLR' },
      { email: 'vikram.del@cosko.com', name: 'Vikram Malhotra', store: 'DEL' },
      { email: 'priya.hyd@cosko.com', name: 'Priya Reddy', store: 'HYD' },
      { email: 'kumar.che@cosko.com', name: 'Kumar Swamy', store: 'CHE' },
    ];

    for (const sm of storeManagers) {
      const user = await prisma.userAccount.upsert({
        where: { email: sm.email },
        update: {
          name: sm.name,
          role: 'Store Manager',
          securityLevel: 80,
          storeScope: sm.store,
          status: 'Active',
          passwordHash: managerPasswordHash,
          mustChangePassword: false,
        },
        create: {
          email: sm.email,
          name: sm.name,
          role: 'Store Manager',
          securityLevel: 80,
          storeScope: sm.store,
          status: 'Active',
          passwordHash: managerPasswordHash,
          mustChangePassword: false,
        },
      });

      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: user.id, storeCode: sm.store } },
        update: {},
        create: { userId: user.id, storeCode: sm.store },
      });
    }

    // Provision Sales Managers (Level 40)
    const salesManagers = [
      { email: 'rahul.cashier@cosko.com', name: 'Rahul Verma', store: 'BLR' },
      { email: 'suresh.sales@cosko.com', name: 'Suresh Gupta', store: 'DEL' },
      { email: 'kavita.auditor@cosko.com', name: 'Kavita Rao', store: 'HYD' },
      { email: 'deepa.che@cosko.com', name: 'Deepa Natarajan', store: 'CHE' },
    ];

    for (const sm of salesManagers) {
      const user = await prisma.userAccount.upsert({
        where: { email: sm.email },
        update: {
          name: sm.name,
          role: 'Sales Manager',
          securityLevel: 40,
          storeScope: sm.store,
          status: 'Active',
          passwordHash: salesPasswordHash,
          mustChangePassword: false,
        },
        create: {
          email: sm.email,
          name: sm.name,
          role: 'Sales Manager',
          securityLevel: 40,
          storeScope: sm.store,
          status: 'Active',
          passwordHash: salesPasswordHash,
          mustChangePassword: false,
        },
      });

      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: user.id, storeCode: sm.store } },
        update: {},
        create: { userId: user.id, storeCode: sm.store },
      });
    }

    console.log('  ✅ 1 Super Admin, 4 Store Managers, and 4 Sales Managers created with store assignments.');

    // ──────────────────────────────────────────────────────────────────
    // 7. VENDORS & CUSTOMERS
    // ──────────────────────────────────────────────────────────────────
    console.log('\n🤝 7. Seeding Key Suppliers & Customers...');
    const vendors = [
      {
        code: 'VND-APPL-01',
        name: 'Apple Distribution India Pvt Ltd',
        storeCode: 'BLR',
        contactPerson: 'Arun Iyer',
        email: 'supply@apple-dist.in',
        phone: '9845012345',
        city: 'Bengaluru',
        address: 'UB City, Vittal Mallya Road',
        categories: 'Device,Accessory',
        gstin: '29AABCA1234F1Z5',
        paymentTerms: 'Net 30',
        status: 'Active',
      },
      {
        code: 'VND-SMSG-01',
        name: 'Samsung Electronics India Ltd',
        storeCode: 'DEL',
        contactPerson: 'Sunil Nair',
        email: 'dist@samsung-supply.in',
        phone: '9845023456',
        city: 'New Delhi',
        address: 'Two Horizon Center, Golf Course Rd',
        categories: 'Device,Spare Part',
        gstin: '07AABCS5678G1Z2',
        paymentTerms: 'Net 30',
        status: 'Active',
      },
      {
        code: 'VND-ANKR-01',
        name: 'Anker Innovations & Accessories Ltd',
        storeCode: 'HYD',
        contactPerson: 'Rohit Shenoy',
        email: 'b2b@anker-accessories.in',
        phone: '9845034567',
        city: 'Hyderabad',
        address: 'Madhapur Main Road',
        categories: 'Accessory',
        gstin: '36AABCA9012H1Z9',
        paymentTerms: 'Net 15',
        status: 'Active',
      },
    ];

    for (const v of vendors) {
      await prisma.vendor.upsert({
        where: { code: v.code },
        update: v,
        create: v,
      });
    }

    const customers = [
      {
        name: 'Vikas Sharma',
        phone: '9876543210',
        normalizedPhone: '9876543210',
        email: 'vikas.sharma@example.com',
        city: 'Bengaluru',
        address: 'Indiranagar 12th Main',
        storeScope: 'BLR',
      },
      {
        name: 'Neha Kapoor',
        phone: '9811223344',
        normalizedPhone: '9811223344',
        email: 'neha.kapoor@example.com',
        city: 'Delhi',
        address: 'Vasant Vihar',
        storeScope: 'DEL',
      },
      {
        name: 'Karthik Rao',
        phone: '9848012345',
        normalizedPhone: '9848012345',
        email: 'karthik.rao@example.com',
        city: 'Hyderabad',
        address: 'Banjara Hills Rd No 12',
        storeScope: 'HYD',
      },
      {
        name: 'Subramanian Iyer',
        phone: '9840056789',
        normalizedPhone: '9840056789',
        email: 'subbu.iyer@example.com',
        city: 'Chennai',
        address: 'T Nagar',
        storeScope: 'CHE',
      },
    ];

    for (const c of customers) {
      const createdCust = await prisma.customer.upsert({
        where: { id: `cust-${c.normalizedPhone}` },
        update: {
          name: c.name,
          phone: c.phone,
          normalizedPhone: c.normalizedPhone,
          email: c.email,
          city: c.city,
          address: c.address,
          status: 'Active',
        },
        create: {
          id: `cust-${c.normalizedPhone}`,
          name: c.name,
          phone: c.phone,
          normalizedPhone: c.normalizedPhone,
          email: c.email,
          city: c.city,
          address: c.address,
          status: 'Active',
        },
      });

      await prisma.customerStoreProfile.upsert({
        where: { id: `csp-${createdCust.id}-${c.storeScope}` },
        update: {},
        create: {
          id: `csp-${createdCust.id}-${c.storeScope}`,
          customerId: createdCust.id,
          storeCode: c.storeScope,
          creditBalance: 0,
          totalSpent: 0,
          totalOrders: 0,
        },
      });
    }
    console.log('  ✅ Vendors and Store-Scoped Customers configured.');

    // ──────────────────────────────────────────────────────────────────
    // 8. MASTER PRODUCTS & INVENTORY WITH MATCHING LEDGER
    // ──────────────────────────────────────────────────────────────────
    console.log('\n📦 8. Seeding Master Catalog Products & Reconciled Inventory...');
    const productsData = [
      {
        sku: 'IPH-15PRO-128-BLK',
        barcode: '195949012345',
        name: 'Apple iPhone 15 Pro 128GB Black Titanium',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
        category: 'cat-smartphones',
        subcategory: 'Smartphones',
        baseCostPrice: 110000.00,
        baseSellingPrice: 134900.00,
        mrp: 134900.00,
        gstRate: 18.00,
        warrantyMonths: 12,
        description: 'Titanium design with A17 Pro chip and customizable Action button.',
        status: 'active',
      },
      {
        sku: 'SAM-S24U-256-GRY',
        barcode: '880609512345',
        name: 'Samsung Galaxy S24 Ultra 256GB Titanium Gray',
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        category: 'cat-smartphones',
        subcategory: 'Smartphones',
        baseCostPrice: 105000.00,
        baseSellingPrice: 129999.00,
        mrp: 129999.00,
        gstRate: 18.00,
        warrantyMonths: 12,
        description: 'Galaxy AI powered flagship with built-in S Pen.',
        status: 'active',
      },
      {
        sku: 'APP-MAC-M3-256',
        barcode: '195949567890',
        name: 'Apple MacBook Air 13-inch M3 8GB 256GB Space Gray',
        brand: 'Apple',
        model: 'MacBook Air M3',
        category: 'cat-laptops',
        subcategory: 'Laptops',
        baseCostPrice: 92000.00,
        baseSellingPrice: 114900.00,
        mrp: 114900.00,
        gstRate: 18.00,
        warrantyMonths: 12,
        description: 'Super-portable design with lightning-fast M3 chip.',
        status: 'active',
      },
      {
        sku: 'ANK-65W-GAN-CHG',
        barcode: '194644012345',
        name: 'Anker 735 65W GaNPrime Fast Wall Charger',
        brand: 'Apple',
        model: '735 GaN 65W',
        category: 'cat-chargers',
        subcategory: 'Adapters / Chargers',
        baseCostPrice: 2800.00,
        baseSellingPrice: 4499.00,
        mrp: 4999.00,
        gstRate: 18.00,
        warrantyMonths: 24,
        description: 'Compact 3-port fast wall charger with GaN technology.',
        status: 'active',
      },
      {
        sku: 'ANK-CB-USBC-BRD',
        barcode: '194644567890',
        name: 'Anker PowerLine+ III USB-C to USB-C Braided Cable 6ft',
        brand: 'Apple',
        model: 'PowerLine+ III',
        category: 'cat-cables',
        subcategory: 'Cables',
        baseCostPrice: 850.00,
        baseSellingPrice: 1599.00,
        mrp: 1999.00,
        gstRate: 18.00,
        warrantyMonths: 12,
        description: 'Ultra-durable double-braided nylon charging cable.',
        status: 'active',
      },
    ];

    const activeStoreCodes = ['BLR', 'DEL', 'HYD', 'CHE'];
    let totalStockValue = 0;

    for (const p of productsData) {
      const product = await prisma.product.upsert({
        where: { sku: p.sku },
        update: p,
        create: p,
      });

      // Distribute initial genuine stock across stores
      for (const stCode of activeStoreCodes) {
        const initialQty = 10;
        await prisma.inventory.upsert({
          where: { productId_storeCode: { productId: product.id, storeCode: stCode } },
          update: { qtyOnHand: initialQty, reorderPt: 3, maxStock: 50 },
          create: {
            productId: product.id,
            storeCode: stCode,
            qtyOnHand: initialQty,
            reorderPt: 3,
            maxStock: 50,
          },
        });

        const refNo = `INIT-STK-${stCode}-${product.sku}`;
        // Create matching ledger entry
        await prisma.inventoryLedger.create({
          data: {
            productId: product.id,
            storeCode: stCode,
            refNo,
            type: 'OPENING_STOCK',
            qtyChange: initialQty,
            costPerUnit: product.baseCostPrice,
            sellingPricePerUnit: product.baseSellingPrice,
            balanceAfter: initialQty,
            notes: 'System Initialization Opening Stock',
            createdBy: 'Super Admin',
          },
        });

        totalStockValue += initialQty * Number(product.baseCostPrice);
      }
    }
    console.log(`  ✅ ${productsData.length} Products created across 4 stores with 100% reconciled InventoryLedgers.`);

    // ──────────────────────────────────────────────────────────────────
    // 9. GENERAL LEDGER DOUBLE-ENTRY BALANCING
    // ──────────────────────────────────────────────────────────────────
    console.log('\n⚖️  9. Seeding General Ledger Double-Entry Opening Balances...');
    // Asset: Inventory Debit
    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: 'JRN-OPEN-INV-001',
        storeCode: 'CENTRAL',
        accountCategory: 'ASSET',
        accountName: 'Inventory Asset',
        debit: totalStockValue,
        credit: 0,
        amount: totalStockValue,
        refType: 'OPENING_BALANCE',
        refNo: 'INIT-EQUITY-001',
        description: 'Opening Inventory Asset Valuation across Retail Stores',
        createdBy: 'Super Admin',
      },
    });

    // Equity: Owner's Equity Credit
    await prisma.financialLedgerEntry.create({
      data: {
        entryNo: 'JRN-OPEN-EQT-001',
        storeCode: 'CENTRAL',
        accountCategory: 'EQUITY',
        accountName: "Owner's Initial Capital / Equity",
        debit: 0,
        credit: totalStockValue,
        amount: totalStockValue,
        refType: 'OPENING_BALANCE',
        refNo: 'INIT-EQUITY-001',
        description: 'Opening Capital Allocation for Initial Store Inventory',
        createdBy: 'Super Admin',
      },
    });

    console.log(`  ✅ General Ledger double-entry balanced: Total Debits (₹${totalStockValue.toLocaleString('en-IN')}) === Total Credits (₹${totalStockValue.toLocaleString('en-IN')}).`);

    // ──────────────────────────────────────────────────────────────────
    // 10. FINAL INVENTORY & ACCOUNTING RECONCILIATION PROOF
    // ──────────────────────────────────────────────────────────────────
    console.log('\n🔍 10. Running Root-to-Root Integrity Verification...');
    const invCount = await prisma.inventory.count();
    const ledgerMovements = await prisma.inventoryLedger.aggregate({ _sum: { qtyChange: true } });
    const invTotal = await prisma.inventory.aggregate({ _sum: { qtyOnHand: true } });

    console.log(`  - Total Physical Inventory Qty: ${invTotal._sum.qtyOnHand}`);
    console.log(`  - Total Ledger Net Movements:   ${ledgerMovements._sum.qtyChange}`);
    if (invTotal._sum.qtyOnHand === ledgerMovements._sum.qtyChange) {
      console.log('  ✅ INVENTORY RECONCILIATION: 100% Perfect Match!');
    } else {
      throw new Error(`Inventory reconciliation failed! Qty=${invTotal._sum.qtyOnHand}, Ledger=${ledgerMovements._sum.qtyChange}`);
    }

    const glDebits = await prisma.financialLedgerEntry.aggregate({ _sum: { debit: true } });
    const glCredits = await prisma.financialLedgerEntry.aggregate({ _sum: { credit: true } });

    console.log(`  - Total Financial Debits:  ₹${glDebits._sum.debit}`);
    console.log(`  - Total Financial Credits: ₹${glCredits._sum.credit}`);
    if (Number(glDebits._sum.debit) === Number(glCredits._sum.credit)) {
      console.log('  ✅ GENERAL LEDGER RECONCILIATION: 100% Double-Entry Balance!');
    } else {
      throw new Error('General ledger debits do not match credits!');
    }

    console.log('\n========================================================================');
    console.log('🎉 COSKO ENTERPRISE DATABASE RE-UPLOAD & SETUP COMPLETED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('❌ Reseeding failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reseedProductionFull();
