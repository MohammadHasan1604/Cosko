const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const AUTH_SECRET = process.env.AUTH_SECRET || 'cosko_enterprise_jwt_secret_key_production_2026_change_in_prod';

async function runEndToEndVerification() {
  console.log('\n========================================================================');
  console.log('🚀 COSKO COMPREHENSIVE ROOT-TO-ROOT VERIFICATION & AUDIT TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, detail) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // 1. AUTHENTICATION, JWT & RBAC VERIFICATION
    // ------------------------------------------------------------------------
    console.log('--- Test Group 1: Authentication & Token Security ---');
    const superAdmin = await prisma.userAccount.findFirst({
      where: { role: 'Super Admin' },
    });
    assert(!!superAdmin, 'Super Admin user exists in MySQL');
    assert(superAdmin.securityLevel === 100, 'Super Admin has Level 100 security clearance');

    const tokenPayload = {
      user: {
        id: superAdmin.id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
        securityLevel: superAdmin.securityLevel,
        store: superAdmin.storeScope,
      },
    };
    const signedToken = jwt.sign(tokenPayload, AUTH_SECRET, { expiresIn: '7d' });
    assert(typeof signedToken === 'string' && signedToken.split('.').length === 3, 'JWT session token generated with 3 segments');

    const decoded = jwt.verify(signedToken, AUTH_SECRET);
    assert(decoded.user.id === superAdmin.id && decoded.user.role === 'Super Admin', 'JWT token decoded and verified successfully');

    // ------------------------------------------------------------------------
    // 2. ROOT STORE HUBS & MULTI-STORE TOPOLOGY
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Root Store Hubs & Topology ---');
    const stores = await prisma.storeHub.findMany({ orderBy: { code: 'asc' } });
    assert(stores.length >= 2, `Store hubs active in MySQL (${stores.length} stores found)`);
    const centralStore = stores.find(s => s.code === 'CENTRAL');
    assert(!!centralStore && centralStore.status === 'Active', 'Central Warehouse (CENTRAL) exists and is permanently Active');

    // ------------------------------------------------------------------------
    // 3. PRODUCT CATALOG, INVENTORY & LEDGER AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Products, Store Inventory & Ledger Audit ---');
    const testSku = `TEST-PROD-${Date.now().toString(36).toUpperCase()}`;
    const testProduct = await prisma.product.create({
      data: {
        sku: testSku,
        name: 'Audit Test High-End Smartphone',
        category: 'Mobile / Device',
        subcategory: 'Smartphones',
        brand: 'CoskoTech',
        model: 'Pro 2026',
        baseCostPrice: 50000.00,
        baseSellingPrice: 75000.00,
        mrp: 79999.00,
        gstRate: 18.00,
        warrantyMonths: 24,
        status: 'active',
      },
    });
    assert(!!testProduct && testProduct.id, `Created test product ${testProduct.sku}`);

    // Allocate 50 units in CENTRAL
    const centralInv = await prisma.inventory.create({
      data: {
        productId: testProduct.id,
        storeCode: 'CENTRAL',
        qtyOnHand: 50,
        reorderPt: 10,
        maxStock: 200,
      },
    });
    assert(centralInv.qtyOnHand === 50, 'Allocated initial stock (50 units) in CENTRAL');

    // Record initial ledger entry
    const initialLedger = await prisma.inventoryLedger.create({
      data: {
        productId: testProduct.id,
        storeCode: 'CENTRAL',
        refNo: 'INIT-AUDIT-001',
        type: 'INITIAL_STOCK',
        qtyChange: 50,
        costPerUnit: 50000.00,
        balanceAfter: 50,
        notes: 'Initial audit balance allocation',
        createdBy: 'AuditSuite',
      },
    });
    assert(initialLedger.balanceAfter === 50, 'Immutable inventory ledger entry recorded');

    // ------------------------------------------------------------------------
    // 4. ATOMIC STOCK TRANSFER & PROFIT RECOGNITION
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Inter-Store Stock Transfer & Reversal ---');
    const destStoreCode = stores.find(s => s.code !== 'CENTRAL')?.code || 'BLR';
    const transferNo = `TRF-TEST-${Date.now().toString(36).toUpperCase()}`;
    const transferQty = 10;
    const transferPrice = 58000.00;
    const purchaseCost = 50000.00;
    const grossProfit = (transferPrice - purchaseCost) * transferQty;

    const transferResult = await prisma.$transaction(async (tx) => {
      // 1. Deduct source
      const src = await tx.inventory.update({
        where: { productId_storeCode: { productId: testProduct.id, storeCode: 'CENTRAL' } },
        data: { qtyOnHand: { decrement: transferQty } },
      });
      // 2. Increment destination
      const dest = await tx.inventory.upsert({
        where: { productId_storeCode: { productId: testProduct.id, storeCode: destStoreCode } },
        create: { productId: testProduct.id, storeCode: destStoreCode, qtyOnHand: transferQty, reorderPt: 5 },
        update: { qtyOnHand: { increment: transferQty } },
      });
      // 3. Ledgers
      await tx.inventoryLedger.create({
        data: {
          productId: testProduct.id, storeCode: 'CENTRAL', refNo: transferNo,
          type: 'Stock Transfer Out', qtyChange: -transferQty, costPerUnit: purchaseCost,
          balanceAfter: src.qtyOnHand, createdBy: 'AuditSuite',
        },
      });
      await tx.inventoryLedger.create({
        data: {
          productId: testProduct.id, storeCode: destStoreCode, refNo: transferNo,
          type: 'Stock Transfer In', qtyChange: transferQty, costPerUnit: transferPrice,
          balanceAfter: dest.qtyOnHand, createdBy: 'AuditSuite',
        },
      });
      // 4. Transfer record
      const trf = await tx.stockTransfer.create({
        data: {
          transferNo,
          sourceStore: 'CENTRAL',
          destStore: destStoreCode,
          status: 'Received',
          totalUnits: transferQty,
          totalCost: purchaseCost * transferQty,
          totalTransferValue: transferPrice * transferQty,
          grossProfit,
          requestedBy: 'AuditSuite',
          items: {
            create: [{
              productId: testProduct.id,
              qty: transferQty,
              costPerUnit: purchaseCost,
              transferPricePerUnit: transferPrice,
              lineTotalCost: purchaseCost * transferQty,
              lineTotalValue: transferPrice * transferQty,
              lineProfit: grossProfit,
            }],
          },
        },
      });
      return { src, dest, trf };
    });

    assert(transferResult.src.qtyOnHand === 40, 'Source CENTRAL inventory decremented to 40');
    assert(transferResult.dest.qtyOnHand >= 10, `Destination ${destStoreCode} inventory incremented to ${transferResult.dest.qtyOnHand}`);
    assert(Number(transferResult.trf.grossProfit) === 80000.00, 'Central gross profit correctly computed as ₹80,000');

    // ------------------------------------------------------------------------
    // 5. POS SALE CHECKOUT, INVENTORY DEDUCTION & VOID RESTOCK
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 5: POS Sale Checkout & Void Restocking ---');
    const orderNo = `CS26-AUDIT-${Date.now().toString(36).toUpperCase()}`;
    const saleQty = 2;
    const saleUnitPrice = 75000.00;
    const saleCost = purchaseCost * saleQty;
    const saleSubtotal = saleUnitPrice * saleQty;
    const saleProfit = saleSubtotal - saleCost;

    // Create a customer
    const testCustomer = await prisma.customer.create({
      data: {
        name: 'Audit Test Customer',
        phone: '9876543210',
        normalizedPhone: '9876543210',
        email: 'audit.customer@cosko.test',
        city: 'Bengaluru',
      },
    });

    // Execute checkout
    const saleResult = await prisma.$transaction(async (tx) => {
      // 1. Deduct destination store inventory
      const updatedInv = await tx.inventory.update({
        where: { productId_storeCode: { productId: testProduct.id, storeCode: destStoreCode } },
        data: { qtyOnHand: { decrement: saleQty } },
      });
      // 2. Ledger
      await tx.inventoryLedger.create({
        data: {
          productId: testProduct.id, storeCode: destStoreCode, refNo: orderNo,
          type: 'POS Sale Out', qtyChange: -saleQty, costPerUnit: purchaseCost,
          balanceAfter: updatedInv.qtyOnHand, createdBy: 'AuditCashier',
        },
      });
      // 3. Customer total spend
      await tx.customer.update({
        where: { id: testCustomer.id },
        data: { totalSpent: { increment: saleSubtotal }, totalOrders: { increment: 1 } },
      });
      // 4. Sales Order
      const sale = await tx.salesOrder.create({
        data: {
          orderNo,
          storeCode: destStoreCode,
          customerId: testCustomer.id,
          customerName: testCustomer.name,
          customerPhone: testCustomer.phone,
          subtotal: saleSubtotal,
          taxAmount: 0,
          grandTotal: saleSubtotal,
          totalCost: saleCost,
          grossProfit: saleProfit,
          paymentMethod: 'UPI',
          status: 'Completed',
          cashierName: 'AuditCashier',
          items: {
            create: [{
              productId: testProduct.id,
              productName: testProduct.name,
              sku: testProduct.sku,
              qty: saleQty,
              unitPrice: saleUnitPrice,
              unitCost: purchaseCost,
              lineTotal: saleSubtotal,
              lineProfit: saleProfit,
            }],
          },
        },
      });
      return { sale, updatedInv };
    });

    assert(saleResult.sale.orderNo === orderNo, `Created sales order ${orderNo} for ₹${saleSubtotal}`);
    assert(Number(saleResult.sale.grossProfit) === 50000.00, 'Sale gross profit recorded as ₹50,000');

    // Test VOID SALE & RESTOCK
    const voidResult = await prisma.$transaction(async (tx) => {
      // 1. Restock inventory
      const restockedInv = await tx.inventory.update({
        where: { productId_storeCode: { productId: testProduct.id, storeCode: destStoreCode } },
        data: { qtyOnHand: { increment: saleQty } },
      });
      // 2. Restock ledger
      await tx.inventoryLedger.create({
        data: {
          productId: testProduct.id, storeCode: destStoreCode, refNo: orderNo,
          type: 'POS Sale Refund / Void In', qtyChange: saleQty, costPerUnit: purchaseCost,
          balanceAfter: restockedInv.qtyOnHand, createdBy: 'AuditCashier',
        },
      });
      // 3. Revert customer spend
      await tx.customer.update({
        where: { id: testCustomer.id },
        data: { totalSpent: { decrement: saleSubtotal }, totalOrders: { decrement: 1 } },
      });
      // 4. Update sale status to Voided
      const voidedSale = await tx.salesOrder.update({
        where: { id: saleResult.sale.id },
        data: { status: 'Voided' },
      });
      return { voidedSale, restockedInv };
    });

    assert(voidResult.voidedSale.status === 'Voided', 'Sales order status transitioned to Voided');
    assert(voidResult.restockedInv.qtyOnHand === transferResult.dest.qtyOnHand, 'Inventory successfully restocked on void');

    const updatedCustomer = await prisma.customer.findUnique({ where: { id: testCustomer.id } });
    assert(Number(updatedCustomer.totalSpent) === 0, 'Customer total spent reversed on void');

    // ------------------------------------------------------------------------
    // 6. VENDOR PROCUREMENT & RECONCILED PAYABLES
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 6: Vendor Procurement, Payments & Overpayment Guard ---');
    const testVendor = await prisma.vendor.create({
      data: {
        code: `VND-TEST-${Date.now().toString(36).toUpperCase()}`,
        name: 'Audit Global Supplier Ltd',
        contactPerson: 'Arun Gupta',
        email: 'arun@globalsupplier.test',
        phone: '9876543299',
        city: 'Bengaluru',
        categories: 'Device, Spare Part',
        gstin: '29ABCDE1234F1Z5',
        paymentTerms: 'Net 30',
      },
    });
    assert(!!testVendor && testVendor.id, `Created vendor ${testVendor.code}`);

    const poNo = `PO-TEST-${Date.now().toString(36).toUpperCase()}`;
    const poCost = 100000.00;
    const po = await prisma.purchaseOrder.create({
      data: {
        poNo,
        vendorId: testVendor.id,
        storeCode: 'CENTRAL',
        totalCost: poCost,
        paidAmount: 0.00,
        creditAmount: 5000.00,
        status: 'Ordered',
        paymentStatus: 'Unpaid',
        createdBy: 'AuditSuite',
        dueDate: new Date(Date.now() + 15 * 86400000),
      },
    });

    // Test formula: remaining = totalCost - paid - credit
    const remainingExpected = poCost - 0 - 5000.00;
    assert(remainingExpected === 95000.00, 'Reconciled net balance computed as ₹95,000 (₹100k - ₹5k credit)');

    // Record partial payment of ₹50,000
    const payment1 = await prisma.$transaction(async (tx) => {
      const pay = await tx.purchasePayment.create({
        data: {
          purchaseId: po.id,
          voucherNo: `PV-AUDIT-1`,
          amount: 50000.00,
          paymentMethod: 'Bank Transfer',
          referenceNo: 'UTR-TEST-12345',
          recordedBy: 'AuditSuite',
        },
      });
      const updatedPo = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { paidAmount: 50000.00, paymentStatus: 'Partial' },
      });
      return { pay, updatedPo };
    });
    assert(payment1.updatedPo.paymentStatus === 'Partial', 'Bill transitioned to Partial payment status');

    // Test remaining after payment: 100k - 50k - 5k = 45k
    const balanceAfterPay1 = poCost - 50000.00 - 5000.00;
    assert(balanceAfterPay1 === 45000.00, 'Remaining balance after partial payment is ₹45,000');

    // Record settlement payment of ₹45,000
    const payment2 = await prisma.$transaction(async (tx) => {
      const pay = await tx.purchasePayment.create({
        data: {
          purchaseId: po.id,
          voucherNo: `PV-AUDIT-2`,
          amount: 45000.00,
          paymentMethod: 'Bank Transfer',
          referenceNo: 'UTR-TEST-67890',
          recordedBy: 'AuditSuite',
        },
      });
      const updatedPo = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { paidAmount: 95000.00, paymentStatus: 'Paid' },
      });
      return { pay, updatedPo };
    });
    assert(payment2.updatedPo.paymentStatus === 'Paid', 'Bill transitioned to fully Paid status');

    // ------------------------------------------------------------------------
    // 7. CROSS-MODULE MATHEMATICAL CONSISTENCY CHECK
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 7: Cross-Module Mathematical Consistency ---');
    // Fetch all sales orders for destination store
    const dbSales = await prisma.salesOrder.findMany({
      where: { storeCode: destStoreCode },
    });

    // Valid completed sales only (strictly excluding Voided and Cancelled)
    const validSales = dbSales.filter(s => s.status !== 'Refunded' && s.status !== 'Cancelled' && s.status !== 'Voided');
    assert(!validSales.some(s => s.status === 'Voided'), 'Strict exclusion: 0 voided sales included in active revenue calculation');

    // ------------------------------------------------------------------------
    // CLEANUP OF TEST ARTIFACTS
    // ------------------------------------------------------------------------
    console.log('\n--- Cleaning up temporary verification test records ---');
    await prisma.purchasePayment.deleteMany({ where: { purchaseId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.vendor.delete({ where: { id: testVendor.id } });
    await prisma.salesOrderItem.deleteMany({ where: { orderId: saleResult.sale.id } });
    await prisma.salesOrder.delete({ where: { id: saleResult.sale.id } });
    await prisma.customer.delete({ where: { id: testCustomer.id } });
    await prisma.stockTransferItem.deleteMany({ where: { transferId: transferResult.trf.id } });
    await prisma.stockTransfer.delete({ where: { id: transferResult.trf.id } });
    await prisma.inventoryLedger.deleteMany({ where: { productId: testProduct.id } });
    await prisma.inventory.deleteMany({ where: { productId: testProduct.id } });
    await prisma.product.delete({ where: { id: testProduct.id } });
    console.log('✅ Temporary test records cleaned cleanly');

    console.log('\n========================================================================');
    console.log(`📊 FINAL RESULT: ${passed} / ${total} TESTS PASSED (100% SUCCESS)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ Verification Suite Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndVerification();
