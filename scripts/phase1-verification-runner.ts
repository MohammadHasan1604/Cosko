import { prisma } from '../src/lib/db';
import crypto from 'crypto';
import { signSessionToken, hashToken } from '../src/lib/auth';
import { executePOSCheckout } from '../src/lib/services/salesService';
import { validatePaymentMethod } from '../src/lib/paymentValidator';
import { getEffectivePermissions, isRouteAllowed } from '../src/lib/rbacEngine';
import { NextRequest } from 'next/server';
import { POST as purchasesPOST } from '../src/app/api/purchases/route';
import { POST as salesPOST, GET as salesGET } from '../src/app/api/sales/route';
import { POST as vendorsPOST, PUT as vendorsPUT, DELETE as vendorsDELETE } from '../src/app/api/vendors/route';
import { GET as customersGET } from '../src/app/api/customers/route';
import { POST as realtimeAuthPOST } from '../src/app/api/realtime/auth/route';
import { GET as reportsGET } from '../src/app/api/reports/route';

function assert(description: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description}${detail ? ` (${detail})` : ''}`);
    throw new Error(`Assertion failed: ${description}${detail ? ` [${detail}]` : ''}`);
  }
}

async function createAuthenticatedSession(user: { id: string; name: string; email: string; role: any; storeScope: string }): Promise<{ token: string; sessionId: string }> {
  const sessionId = `p1_sess_${crypto.randomUUID()}`;
  const dummyToken = `tok_${crypto.randomUUID()}_${Date.now()}`;
  const tokenHash = hashToken(dummyToken);

  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      userAgent: 'Phase1IntegrationRunner/1.0',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    securityLevel: user.role === 'Super Admin' ? 100 : user.role === 'Store Manager' ? 80 : 40,
    store: user.storeScope,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    sessionId,
  };

  const token = signSessionToken(sessionUser, sessionId);
  const finalHash = hashToken(token);

  await prisma.userSession.update({
    where: { id: sessionId },
    data: { tokenHash: finalHash },
  });

  return { token, sessionId };
}

function makeAuthedRequest(url: string, method: string, token: string, body?: any): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  if (body) {
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(fullUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runPhase1DirectTestMatrix() {
  console.log('\n======================================================');
  console.log(' COSKO PHASE 1 DIRECT TEST MATRIX EXECUTION');
  console.log('======================================================\n');

  // Load real DB users
  const superAdmin = await prisma.userAccount.findFirstOrThrow({ where: { role: 'Super Admin' } });
  const blrMgr = await prisma.userAccount.findFirstOrThrow({ where: { role: 'Store Manager', storeScope: 'BLR' } });
  const blrSales = await prisma.userAccount.findFirstOrThrow({ where: { role: 'Sales Manager', storeScope: 'BLR' } });
  const cheMgr = await prisma.userAccount.findFirstOrThrow({ where: { role: 'Store Manager', storeScope: 'CHE' } });
  const cheSales = await prisma.userAccount.findFirstOrThrow({ where: { role: 'Sales Manager', storeScope: 'CHE' } });

  console.log(`Accounts:`);
  console.log(`- Super Admin: ${superAdmin.email}`);
  console.log(`- BLR Store Manager: ${blrMgr.email}`);
  console.log(`- BLR Sales Manager: ${blrSales.email}`);
  console.log(`- CHE Store Manager: ${cheMgr.email}`);
  console.log(`- CHE Sales Manager: ${cheSales.email}\n`);

  // Create real DB sessions
  const saSess = await createAuthenticatedSession(superAdmin);
  const blrMgrSess = await createAuthenticatedSession(blrMgr);
  const blrSalesSess = await createAuthenticatedSession(blrSales);
  const cheMgrSess = await createAuthenticatedSession(cheMgr);
  const cheSalesSess = await createAuthenticatedSession(cheSales);

  const sessionsToClean = [
    saSess.sessionId,
    blrMgrSess.sessionId,
    blrSalesSess.sessionId,
    cheMgrSess.sessionId,
    cheSalesSess.sessionId,
  ];

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Permission override ALLOW / DENY / RESET
    // ─────────────────────────────────────────────────────────────
    console.log('--- Test 1: Permission override ALLOW / DENY / RESET ---');
    {
      // Clean up any test overrides for blrMgr first
      await (prisma as any).userPermissionOverride.deleteMany({
        where: { userId: blrMgr.id, permissionCode: 'dashboard.view' },
      });

      // Default: blrMgr base role allows dashboard.view
      const permsDefault = getEffectivePermissions({ role: blrMgr.role as any, overrides: [] });
      assert('Base role allows dashboard.view by default', permsDefault.includes('dashboard.view'));
      assert('isRouteAllowed(/dashboard) is true by default', isRouteAllowed('/dashboard', { role: blrMgr.role as any, overrides: [] }));

      // Apply DENY override in DB
      await (prisma as any).userPermissionOverride.upsert({
        where: { userId_permissionCode: { userId: blrMgr.id, permissionCode: 'dashboard.view' } },
        create: { userId: blrMgr.id, permissionCode: 'dashboard.view', overrideType: 'DENY' },
        update: { overrideType: 'DENY' },
      });
      const denyOverrides = await (prisma as any).userPermissionOverride.findMany({ where: { userId: blrMgr.id } });
      const permsDenied = getEffectivePermissions({ role: blrMgr.role as any, overrides: denyOverrides });
      assert('dashboard.view is revoked when DENY override present', !permsDenied.includes('dashboard.view'));
      assert('isRouteAllowed(/dashboard) returns false when DENY override present', !isRouteAllowed('/dashboard', { role: blrMgr.role as any, overrides: denyOverrides }));

      // Apply ALLOW override
      await (prisma as any).userPermissionOverride.update({
        where: { userId_permissionCode: { userId: blrMgr.id, permissionCode: 'dashboard.view' } },
        data: { overrideType: 'ALLOW' },
      });
      const allowOverrides = await (prisma as any).userPermissionOverride.findMany({ where: { userId: blrMgr.id } });
      const permsAllowed = getEffectivePermissions({ role: blrMgr.role as any, overrides: allowOverrides });
      assert('dashboard.view is allowed when ALLOW override present', permsAllowed.includes('dashboard.view'));

      // RESET override (delete row)
      await (prisma as any).userPermissionOverride.deleteMany({
        where: { userId: blrMgr.id, permissionCode: 'dashboard.view' },
      });
      const resetOverrides = await (prisma as any).userPermissionOverride.findMany({ where: { userId: blrMgr.id } });
      const permsReset = getEffectivePermissions({ role: blrMgr.role as any, overrides: resetOverrides });
      assert('dashboard.view returns to role default after RESET', permsReset.includes('dashboard.view'));
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Store Manager Dashboard allowed when dashboard.view enabled
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Store Manager Dashboard allowed when dashboard.view enabled ---');
    {
      const blrAllowed = isRouteAllowed('/dashboard', { role: blrMgr.role as any, overrides: [] });
      assert('BLR Store Manager can access /dashboard with default permissions', blrAllowed);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Store Manager protected module remains denied even with malicious override
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Protected modules remain denied even with malicious ALLOW override ---');
    {
      // Try to grant Store Manager a protected Super Admin module (e.g. settings.view or audit_logs.view)
      const maliciousOverrides = [{ permissionCode: 'settings.view', overrideType: 'ALLOW' as const }];
      const effective = getEffectivePermissions({ role: blrMgr.role as any, overrides: maliciousOverrides });
      assert('Malicious ALLOW for settings.view is rejected from effective permissions', !effective.includes('settings.view'));
      assert('isRouteAllowed(/settings) is strictly false for Store Manager despite malicious override', !isRouteAllowed('/settings', { role: blrMgr.role as any, overrides: maliciousOverrides }));
      assert('isRouteAllowed(/audit-logs) is false for Store Manager', !isRouteAllowed('/audit-logs', { role: blrMgr.role as any, overrides: [{ permissionCode: 'audit_logs.view', overrideType: 'ALLOW' }] }));
    }

    // ─────────────────────────────────────────────────────────────
    // 4 & 5. Purchase receiving: Store Manager defaults own store, CENTRAL rejected
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Tests 4 & 5: Purchase receiving store lock ---');
    {
      // First find an active vendor
      const vendor = await prisma.vendor.findFirst({ where: { status: 'Active' } });
      if (!vendor) throw new Error('No active vendor found in DB for PO test');

      // BLR Store Manager attempts to create PO with storeCode = 'CENTRAL' -> MUST FAIL 403
      const badReq = makeAuthedRequest('/api/purchases', 'POST', blrMgrSess.token, {
        vendorId: vendor.id,
        storeCode: 'CENTRAL',
        items: [{ sku: 'TEST-SKU', name: 'Test Product', quantity: 5, unitCost: 100 }],
      });
      const badRes = await purchasesPOST(badReq);
      assert('BLR Store Manager cannot create PO for CENTRAL (403 Forbidden)', badRes.status === 403, `got ${badRes.status}`);

      // BLR Store Manager attempts to create PO with storeCode = 'CHE' -> MUST FAIL 403
      const crossReq = makeAuthedRequest('/api/purchases', 'POST', blrMgrSess.token, {
        vendorId: vendor.id,
        storeCode: 'CHE',
        items: [{ sku: 'TEST-SKU', name: 'Test Product', quantity: 5, unitCost: 100 }],
      });
      const crossRes = await purchasesPOST(crossReq);
      assert('BLR Store Manager cannot create PO for CHE (403 Forbidden)', crossRes.status === 403, `got ${crossRes.status}`);

      // BLR Store Manager creates PO for BLR -> SUCCESS 201
      const goodReq = makeAuthedRequest('/api/purchases', 'POST', blrMgrSess.token, {
        vendorId: vendor.id,
        storeCode: 'BLR',
        items: [{ sku: 'TEST-SKU', name: 'Test Product', quantity: 2, unitCost: 50 }],
      });
      const goodRes = await purchasesPOST(goodReq);
      assert('BLR Store Manager successfully creates PO for BLR (201)', goodRes.status === 201, `got ${goodRes.status}`);
      const poJson = await goodRes.json();
      const createdPO = poJson?.purchaseOrder || poJson?.purchase;
      assert('Created PO is assigned to BLR', createdPO?.storeCode === 'BLR');
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Vendor CRUD persisted in database
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: Real Vendor CRUD Persisted in Database ---');
    {
      const uniqueVendorCode = `VND-T-${Date.now().toString().slice(-5)}`;
      const createReq = makeAuthedRequest('/api/vendors', 'POST', saSess.token, {
        name: `Test Vendor Matrix ${uniqueVendorCode}`,
        code: uniqueVendorCode,
        category: 'Electronics',
        phone: '9876543210',
        email: `${uniqueVendorCode.toLowerCase()}@example.com`,
        paymentTerms: 'Net 30',
        status: 'Active',
      });
      const createRes = await vendorsPOST(createReq);
      assert('Vendor CREATE succeeds with 201', createRes.status === 201, `got ${createRes.status}`);
      const createJson = await createRes.json();
      const vendorId = createJson?.vendor?.id;
      assert('Vendor returned valid ID', Boolean(vendorId));

      // Verify row in MySQL
      const dbVendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
      assert('Vendor row exists in MySQL', Boolean(dbVendor));
      assert('Vendor code matches in MySQL', dbVendor?.code === uniqueVendorCode);

      // Update Vendor
      const updateReq = makeAuthedRequest('/api/vendors', 'PUT', saSess.token, {
        id: vendorId,
        name: `Updated Vendor Matrix ${uniqueVendorCode}`,
        paymentTerms: 'Net 45',
      });
      const updateRes = await vendorsPUT(updateReq);
      assert('Vendor UPDATE succeeds with 200', updateRes.status === 200, `got ${updateRes.status}`);
      const dbUpdated = await prisma.vendor.findUnique({ where: { id: vendorId } });
      assert('Updated name persisted in MySQL', dbUpdated?.name === `Updated Vendor Matrix ${uniqueVendorCode}`);
      assert('Updated paymentTerms persisted in MySQL', dbUpdated?.paymentTerms === 'Net 45');

      // Archive Vendor
      const delReq = makeAuthedRequest(`/api/vendors?id=${vendorId}`, 'DELETE', saSess.token);
      const delRes = await vendorsDELETE(delReq);
      assert('Vendor DELETE succeeds with 200', delRes.status === 200, `got ${delRes.status}`);
      const dbArchived = await prisma.vendor.findUnique({ where: { id: vendorId } });
      assert('Vendor status in MySQL is Archived', dbArchived?.status === 'Archived');
    }

    // ─────────────────────────────────────────────────────────────
    // 7. POS Oversell Protection (409 Insufficient Stock)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: POS Oversell Protection (409) ---');
    {
      const testSku = `OVR-TEST-${Date.now().toString().slice(-4)}`;
      const product = await prisma.product.create({
        data: {
          sku: testSku,
          name: 'Oversell Test Product',
          baseCostPrice: 100,
          baseSellingPrice: 200,
          category: 'Electronics',
          status: 'active',
        },
      });

      try {
        await prisma.inventory.upsert({
          where: { productId_storeCode: { productId: product.id, storeCode: 'BLR' } },
          create: { productId: product.id, storeCode: 'BLR', qtyOnHand: 3 },
          update: { qtyOnHand: 3 },
        });
        await prisma.inventoryLedger.create({
          data: {
            productId: product.id,
            storeCode: 'BLR',
            qtyChange: 3,
            type: 'Stock Adjustment',
            refNo: `TEST-SETUP-${Date.now()}`,
            costPerUnit: 100,
            balanceAfter: 3,
          },
        });

        // Attempt checkout of 10 items (only 3 in stock)
        try {
          await executePOSCheckout({
            cashierName: blrSales.name,
            customerName: 'Test Customer',
            customerPhone: '9876543210',
            storeCode: 'BLR',
            paymentMethod: 'Cash',
            paymentProofUrl: 'payment-proofs/test-proof.jpg',
            items: [{ productId: product.id, qty: 10, unitPrice: 200, productName: product.name, sku: product.sku }],
          });
          assert('Oversell was rejected', false, 'Should have thrown 409 error');
        } catch (err: any) {
          assert('Oversell throws 409 error', err.statusCode === 409 || err.status === 409 || err.message?.includes('Insufficient stock'));
        }

        // Verify stock did NOT decrement to negative or clamp
        const invAfter = await prisma.inventory.findUnique({
          where: { productId_storeCode: { productId: product.id, storeCode: 'BLR' } },
        });
        assert('Stock remained exactly 3 (no deduction occurred)', invAfter?.qtyOnHand === 3, `got ${invAfter?.qtyOnHand}`);
      } finally {
        // Clean up test product
        await prisma.inventoryLedger.deleteMany({ where: { productId: product.id } });
        await prisma.inventory.deleteMany({ where: { productId: product.id } });
        await prisma.product.delete({ where: { id: product.id } });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Client Forged unitCost Ignored & POS Checkout Integrity
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: Client Forged unitCost Ignored ---');
    {
      const honestSku = `FORGE-TEST-${Date.now().toString().slice(-4)}`;
      const realCost = 150;
      const realPrice = 300;

      const product = await prisma.product.create({
        data: {
          sku: honestSku,
          name: 'Forge Test Product',
          baseCostPrice: realCost,
          baseSellingPrice: realPrice,
          category: 'Electronics',
          status: 'active',
        },
      });

      let saleId: string | undefined;
      let orderNo: string | undefined;

      try {
        await prisma.inventory.upsert({
          where: { productId_storeCode: { productId: product.id, storeCode: 'BLR' } },
          create: { productId: product.id, storeCode: 'BLR', qtyOnHand: 5 },
          update: { qtyOnHand: 5 },
        });
        await prisma.inventoryLedger.create({
          data: {
            productId: product.id,
            storeCode: 'BLR',
            qtyChange: 5,
            type: 'Stock Adjustment',
            refNo: `TEST-SETUP-${Date.now()}`,
            costPerUnit: realCost,
            balanceAfter: 5,
          },
        });

        // Client maliciously sends unitCost: 10
        const sale = await executePOSCheckout({
          cashierName: blrSales.name,
          customerName: 'Test Customer',
          customerPhone: '9876543210',
          storeCode: 'BLR',
          paymentMethod: 'UPI',
          paymentProofUrl: 'payment-proofs/test-proof.jpg',
          items: [{
            productId: product.id,
            qty: 2,
            unitPrice: realPrice,
            unitCost: 10, // FORGED CLIENT COST
            productName: product.name,
            sku: product.sku,
          }],
        });
        saleId = sale.id;
        orderNo = sale.orderNo;

        assert('Sale completed successfully', Boolean(sale?.id));

        // Verify DB item has authoritative cost (150)
        const saleItem = await prisma.salesOrderItem.findFirst({
          where: { orderId: sale.id, productId: product.id },
        });
        assert('Authoritative DB unitCost was used (150, not forged 10)', Number(saleItem?.unitCost) === realCost, `got ${saleItem?.unitCost}`);

        // Verify Financial Ledger entry
        const ledger = await prisma.financialLedgerEntry.findFirst({
          where: { refNo: sale.orderNo, accountCategory: 'COGS' },
        });
        assert('Financial ledger COGS recorded with real cost (300)', Number(ledger?.amount) === realCost * 2, `got ${ledger?.amount}`);
      } finally {
        // Clean up
        if (saleId) {
          await prisma.salesOrderItem.deleteMany({ where: { orderId: saleId } });
          await prisma.salesOrder.delete({ where: { id: saleId } });
        }
        if (orderNo) {
          await prisma.financialLedgerEntry.deleteMany({ where: { refNo: orderNo } });
        }
        await prisma.inventoryLedger.deleteMany({ where: { productId: product.id } });
        await prisma.inventory.deleteMany({ where: { productId: product.id } });
        await prisma.product.delete({ where: { id: product.id } });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 9. Payment Methods Exactly Cash / UPI / Other
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Canonical Payment Method Validator ---');
    {
      assert('Cash is valid', validatePaymentMethod('Cash').valid);
      assert('UPI is valid', validatePaymentMethod('UPI').valid);
      assert('Other is valid', validatePaymentMethod('Other').valid);
      assert('cash (lowercase) canonicalizes to Cash', validatePaymentMethod('cash').normalized === 'Cash');
      assert('upi (lowercase) canonicalizes to UPI', validatePaymentMethod('upi').normalized === 'UPI');
      assert('Crypto is rejected', !validatePaymentMethod('Crypto').valid);
      assert('Bitcoin is rejected', !validatePaymentMethod('Bitcoin').valid);
      assert('Cheque is rejected', !validatePaymentMethod('Cheque').valid);

      // Test API route rejection of 'Crypto'
      const badPayReq = makeAuthedRequest('/api/sales', 'POST', blrSalesSess.token, {
        storeCode: 'BLR',
        paymentMethod: 'Crypto',
        items: [{ productId: 'prod-dummy', qty: 1 }],
        cashierName: 'Cashier',
      });
      const badPayRes = await salesPOST(badPayReq);
      assert('API rejects invalid payment method Crypto with 400', badPayRes.status === 400, `got ${badPayRes.status}`);
    }

    // ─────────────────────────────────────────────────────────────
    // 10. Customer Store Isolation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: Customer Store Isolation ---');
    {
      const cheCustomerPhone = `91${Date.now().toString().slice(-8)}`;
      // Create customer belonging strictly to CHE
      const cheCust = await prisma.customer.create({
        data: {
          phone: cheCustomerPhone,
          normalizedPhone: cheCustomerPhone,
          name: 'Strictly Chennai Customer',
          city: 'Chennai',
        },
      });
      await (prisma as any).customerStoreProfile.create({
        data: {
          customerId: cheCust.id,
          storeCode: 'CHE',
          totalSpent: 1000,
        },
      });

      // BLR Store Manager queries by phone
      const blrPhoneReq = makeAuthedRequest(`/api/customers?phone=${cheCustomerPhone}`, 'GET', blrMgrSess.token);
      const blrPhoneRes = await customersGET(blrPhoneReq);
      const blrPhoneJson = await blrPhoneRes.json();
      assert('BLR Manager phone lookup returns null for CHE-only customer', blrPhoneJson?.customer === null);

      // BLR Sales Manager queries by query
      const blrQueryReq = makeAuthedRequest(`/api/customers?query=${cheCust.name}`, 'GET', blrSalesSess.token);
      const blrQueryRes = await customersGET(blrQueryReq);
      const blrQueryJson = await blrQueryRes.json();
      const foundInBLR = (blrQueryJson?.customers || []).some((c: any) => c.id === cheCust.id);
      assert('BLR Sales Manager search cannot find CHE-only customer', !foundInBLR);

      // Clean up
      await (prisma as any).customerStoreProfile.deleteMany({ where: { customerId: cheCust.id } });
      await prisma.customer.delete({ where: { id: cheCust.id } });
    }

    // ─────────────────────────────────────────────────────────────
    // 11. Super Admin "All Stores" Semantics
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 11: Super Admin All Stores Semantics ---');
    {
      // Super Admin queries reports for All Stores
      const saAllReq = makeAuthedRequest('/api/reports?store=All Stores', 'GET', saSess.token);
      const saAllRes = await reportsGET(saAllReq);
      assert('Super Admin GET reports for All Stores succeeds with 200', saAllRes.status === 200, `got ${saAllRes.status}`);
      const reportsJson = await saAllRes.json();
      assert('Reports response returns success', reportsJson?.success === true);

      // Super Admin queries sales for All Stores
      const saSalesReq = makeAuthedRequest('/api/sales?store=All Stores', 'GET', saSess.token);
      const saSalesRes = await salesGET(saSalesReq);
      assert('Super Admin GET sales for All Stores succeeds with 200', saSalesRes.status === 200, `got ${saSalesRes.status}`);
      const salesJson = await saSalesRes.json();
      assert('Sales response contains array without failing on storeCode="All Stores"', Array.isArray(salesJson?.sales));
    }

    // ─────────────────────────────────────────────────────────────
    // 12. Realtime Cross-Store Subscription Denied
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 12: Realtime Cross-Store Subscription Denied ---');
    {
      // BLR Store Manager attempts to authorize subscription to private-store-CHE
      const crossRealtimeReq = makeAuthedRequest('/api/realtime/auth', 'POST', blrMgrSess.token, {
        socket_id: '12345.67890',
        channel_name: 'private-store-CHE',
      });
      const crossRealtimeRes = await realtimeAuthPOST(crossRealtimeReq);
      assert('BLR Manager subscription to private-store-CHE is blocked with 403', crossRealtimeRes.status === 403, `got ${crossRealtimeRes.status}`);

      // BLR Store Manager authorizes own store private-store-BLR -> 200
      const ownRealtimeReq = makeAuthedRequest('/api/realtime/auth', 'POST', blrMgrSess.token, {
        socket_id: '12345.67890',
        channel_name: 'private-store-BLR',
      });
      const ownRealtimeRes = await realtimeAuthPOST(ownRealtimeReq);
      assert('BLR Manager subscription to private-store-BLR is approved with 200', ownRealtimeRes.status === 200, `got ${ownRealtimeRes.status}`);

      // BLR Store Manager attempts to authorize enterprise channel -> 403
      const entReq = makeAuthedRequest('/api/realtime/auth', 'POST', blrMgrSess.token, {
        socket_id: '12345.67890',
        channel_name: 'private-enterprise',
      });
      const entRes = await realtimeAuthPOST(entReq);
      assert('BLR Manager subscription to private-enterprise is blocked with 403', entRes.status === 403, `got ${entRes.status}`);
    }

    console.log('\n======================================================');
    console.log(' ALL PHASE 1 DIRECT TEST MATRIX CHECKS PASSED (12/12)');
    console.log('======================================================\n');
  } finally {
    // Clean up all sessions created for testing
    await prisma.userSession.deleteMany({
      where: { id: { in: sessionsToClean } },
    });
  }
}

runPhase1DirectTestMatrix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 1 test matrix failed:', err);
    process.exit(1);
  });
