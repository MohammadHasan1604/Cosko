/**
 * COSKO — FINAL 2-ISSUE CLOSURE TEST SUITE
 * 
 * ISSUE 1: Payment Proof Storage, Ownership & Access (Super Admin CHE vs BLR store isolation)
 * ISSUE 2: WhatsApp Invoice Message Formatting & Phone Validation (Clean text summary, zero internal URLs)
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../src/lib/db';
import { signSessionToken, hashToken } from '../src/lib/auth';
import { validatePhysicalStore } from '../src/lib/authPipeline';
import { fileExistsInStorage } from '../src/lib/objectStorage';
import {
  buildWhatsAppInvoiceMessage,
  buildWhatsAppInvoiceUrl,
  extract10DigitPhone,
} from '../src/lib/whatsappInvoice';

// Import route handlers
import { POST as uploadPOST } from '../src/app/api/upload/route';
import { GET as filesGET } from '../src/app/api/files/[...key]/route';
import { executePOSCheckout } from '../src/lib/services/salesService';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(description: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}${detail ? ` — ${detail}` : ''}`);
    errors.push(`${description}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function createAuthenticatedSession(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  storeScope: string;
}): Promise<{ token: string; sessionId: string }> {
  const sessionId = `test_sess_${crypto.randomUUID()}`;
  const dummyToken = `tok_${crypto.randomUUID()}_${Date.now()}`;
  const tokenHash = hashToken(dummyToken);

  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      userAgent: 'FinalClosureTestRunner/1.0',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as any,
    securityLevel: user.role === 'Super Admin' ? 100 : user.role === 'Store Manager' ? 80 : 40,
    store: user.storeScope,
    allowedStores: [user.storeScope],
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

function makeUploadRequest(
  token: string,
  formData: FormData
): NextRequest {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);

  return new NextRequest(new URL('http://localhost:3000/api/upload'), {
    method: 'POST',
    headers,
    body: formData,
  });
}

function makeFilesRequest(token: string | null, keyPath: string): NextRequest {
  const headers = new Headers();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  return new NextRequest(new URL(`http://localhost:3000/api/files/${keyPath}`), {
    method: 'GET',
    headers,
  });
}

// 1x1 100-byte valid JPEG buffer for real upload testing
const JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

async function runAllTests() {
  console.log('====================================================');
  console.log('COSKO — FINAL 2-ISSUE CLOSURE VERIFICATION SUITE');
  console.log('====================================================\n');

  // Ensure active physical stores exist
  await prisma.storeHub.upsert({
    where: { code: 'BLR' },
    update: { status: 'Active' },
    create: {
      code: 'BLR',
      name: 'Cosko Indiranagar',
      city: 'Bengaluru',
      address: '100 Feet Ring Road, Indiranagar',
      status: 'Active',
    },
  });
  await prisma.storeHub.upsert({
    where: { code: 'CHE' },
    update: { status: 'Active' },
    create: {
      code: 'CHE',
      name: 'Cosko Chennai Hub',
      city: 'Chennai',
      address: 'Mount Road, Chennai',
      status: 'Active',
    },
  });

  // Load or create test accounts from DB
  let superAdmin = await prisma.userAccount.findFirst({
    where: { role: 'Super Admin' },
  });
  if (!superAdmin) {
    superAdmin = await prisma.userAccount.create({
      data: {
        id: `superadmin_test_${Date.now()}`,
        name: 'Super Admin Test',
        email: `admin.test_${Date.now()}@cosko.com`,
        passwordHash: '$2a$12$dummyPasswordHashForFinalClosureTest1234567890',
        role: 'Super Admin',
        securityLevel: 100,
        storeScope: 'All Stores',
        status: 'Active',
      },
    });
  }

  let blrManager = await prisma.userAccount.findFirst({
    where: { role: 'Store Manager', storeScope: 'BLR' },
  });
  if (!blrManager) {
    blrManager = await prisma.userAccount.findFirst({
      where: { role: 'Store Manager' },
    });
  }
  if (!blrManager) {
    blrManager = await prisma.userAccount.create({
      data: {
        id: `blr_mgr_test_${Date.now()}`,
        name: 'Ananya Sharma',
        email: `ananya.blr.test_${Date.now()}@cosko.com`,
        passwordHash: '$2a$12$dummyPasswordHashForFinalClosureTest1234567890',
        role: 'Store Manager',
        securityLevel: 80,
        storeScope: 'BLR',
        status: 'Active',
      },
    });
    await prisma.userStoreAssignment.create({
      data: { userId: blrManager.id, storeCode: 'BLR' },
    });
  }

  let cheManager = await prisma.userAccount.findFirst({
    where: { role: 'Store Manager', storeScope: 'CHE' },
  });
  if (!cheManager) {
    cheManager = await prisma.userAccount.findFirst({
      where: {
        role: 'Store Manager',
        storeAssignments: { some: { storeCode: 'CHE' } },
      },
    });
  }
  if (!cheManager) {
    cheManager = await prisma.userAccount.create({
      data: {
        id: `che_mgr_test_${Date.now()}`,
        name: 'Kumar Swamy',
        email: `kumar.che.test_${Date.now()}@cosko.com`,
        passwordHash: '$2a$12$dummyPasswordHashForFinalClosureTest1234567890',
        role: 'Store Manager',
        securityLevel: 80,
        storeScope: 'CHE',
        status: 'Active',
      },
    });
    await prisma.userStoreAssignment.create({
      data: { userId: cheManager.id, storeCode: 'CHE' },
    });
  }

  const superAdminSession = await createAuthenticatedSession(superAdmin);
  const blrSession = await createAuthenticatedSession(blrManager);
  const cheSession = await createAuthenticatedSession(cheManager);

  // Track created FileAssets and Sales to clean up
  const cleanupFileAssetKeys: string[] = [];
  const cleanupSaleIds: string[] = [];

  try {
    // ─────────────────────────────────────────────────────────────
    // ISSUE 1: PAYMENT PROOF OWNERSHIP, STORAGE & ACCESS
    // ─────────────────────────────────────────────────────────────
    console.log('🔒 ISSUE 1 — Payment Proof Ownership & Access Control\n');

    // TEST A: Super Admin uploading for CHE must store FileAsset.storeCode = CHE
    console.log('--- TEST A: Super Admin CHE Proof Upload ---');
    const formSuperChe = new FormData();
    const testCheBlob = new Blob([JPEG_HEADER], { type: 'image/jpeg' });
    formSuperChe.append('file', testCheBlob, 'che-sale-proof.jpg');
    formSuperChe.append('category', 'payment-proofs');
    formSuperChe.append('storeCode', 'CHE');
    formSuperChe.append('relatedEntityType', 'Sale');

    const reqSuperChe = makeUploadRequest(superAdminSession.token, formSuperChe);
    const resSuperChe = await uploadPOST(reqSuperChe);
    const dataSuperChe = await resSuperChe.json();

    assert('POST /api/upload as Super Admin for CHE returns 200', resSuperChe.status === 200, `Got ${resSuperChe.status}`);
    assert('POST /api/upload returns success = true', dataSuperChe.success === true);
    assert('Upload response indicates storeCode = "CHE"', dataSuperChe.storeCode === 'CHE');

    if (dataSuperChe.key) {
      cleanupFileAssetKeys.push(dataSuperChe.key);
      const fileAssetChe = await (prisma as any).fileAsset.findUnique({
        where: { objectKey: dataSuperChe.key },
      });

      assert(
        'FileAsset record created in MySQL with storeCode = "CHE" (NOT "BLR")',
        fileAssetChe !== null && fileAssetChe.storeCode === 'CHE',
        `Actual: ${fileAssetChe?.storeCode}`
      );
      assert(
        'FileAsset.objectKey exactly matches R2 storage key',
        fileAssetChe !== null && fileAssetChe.objectKey === dataSuperChe.key
      );
      assert(
        'FileAsset.relatedEntityType recorded as "Sale"',
        fileAssetChe !== null && fileAssetChe.relatedEntityType === 'Sale'
      );
    }

    // TEST B: Super Admin private upload without physical store is rejected
    console.log('\n--- TEST B: Super Admin Proof Upload Rejections ---');
    const formSuperNoStore = new FormData();
    formSuperNoStore.append('file', new Blob([JPEG_HEADER], { type: 'image/jpeg' }), 'proof.jpg');
    formSuperNoStore.append('category', 'payment-proofs');
    // storeCode omitted

    const resSuperNoStore = await uploadPOST(makeUploadRequest(superAdminSession.token, formSuperNoStore));
    assert('Super Admin upload with missing storeCode rejected with 400', resSuperNoStore.status === 400);

    const formSuperAll = new FormData();
    formSuperAll.append('file', new Blob([JPEG_HEADER], { type: 'image/jpeg' }), 'proof.jpg');
    formSuperAll.append('category', 'payment-proofs');
    formSuperAll.append('storeCode', 'ALL');

    const resSuperAll = await uploadPOST(makeUploadRequest(superAdminSession.token, formSuperAll));
    assert('Super Admin upload with "ALL" rejected with 400', resSuperAll.status === 400);

    const formSuperHQ = new FormData();
    formSuperHQ.append('file', new Blob([JPEG_HEADER], { type: 'image/jpeg' }), 'proof.jpg');
    formSuperHQ.append('category', 'payment-proofs');
    formSuperHQ.append('storeCode', 'HQ');

    const resSuperHQ = await uploadPOST(makeUploadRequest(superAdminSession.token, formSuperHQ));
    assert('Super Admin upload with "HQ" rejected with 400', resSuperHQ.status === 400);

    // TEST C: Non-Super Admin cross-store forgery is rejected with 403
    console.log('\n--- TEST C: Store Manager Store Isolation & Forgery Prevention ---');
    const formBlrForged = new FormData();
    formBlrForged.append('file', new Blob([JPEG_HEADER], { type: 'image/jpeg' }), 'forged.jpg');
    formBlrForged.append('category', 'payment-proofs');
    formBlrForged.append('storeCode', 'CHE'); // BLR manager pretending to upload for CHE

    const resBlrForged = await uploadPOST(makeUploadRequest(blrSession.token, formBlrForged));
    assert('BLR Store Manager forged CHE upload rejected with 403', resBlrForged.status === 403);

    // BLR Store Manager valid upload locks to BLR
    const formBlrValid = new FormData();
    formBlrValid.append('file', new Blob([JPEG_HEADER], { type: 'image/jpeg' }), 'blr-proof.jpg');
    formBlrValid.append('category', 'payment-proofs');
    formBlrValid.append('storeCode', 'BLR');

    const resBlrValid = await uploadPOST(makeUploadRequest(blrSession.token, formBlrValid));
    const dataBlrValid = await resBlrValid.json();
    assert('BLR Store Manager valid upload succeeds (200)', resBlrValid.status === 200);

    if (dataBlrValid.key) {
      cleanupFileAssetKeys.push(dataBlrValid.key);
      const fileAssetBlr = await (prisma as any).fileAsset.findUnique({
        where: { objectKey: dataBlrValid.key },
      });
      assert(
        'BLR Store Manager upload creates FileAsset with storeCode = "BLR"',
        fileAssetBlr !== null && fileAssetBlr.storeCode === 'BLR'
      );
    }

    // TEST D: Cross-Store Access Control on CHE FileAsset
    console.log('\n--- TEST D: Cross-Store Access Control on GET /api/files/[...key] ---');
    if (dataSuperChe.key) {
      const cheProofKey = dataSuperChe.key;

      // 1. CHE Store Manager requesting CHE proof
      const resCheReq = await filesGET(
        makeFilesRequest(cheSession.token, cheProofKey),
        { params: Promise.resolve({ key: cheProofKey.split('/') }) }
      );
      assert(
        'CHE Store Manager accessing CHE proof is authorized (200 or 307 redirect)',
        resCheReq.status === 200 || resCheReq.status === 307,
        `Got ${resCheReq.status}`
      );

      // 2. BLR Store Manager requesting same CHE proof -> MUST BE 403
      const resBlrReq = await filesGET(
        makeFilesRequest(blrSession.token, cheProofKey),
        { params: Promise.resolve({ key: cheProofKey.split('/') }) }
      );
      assert(
        'BLR Store Manager requesting CHE proof is FORBIDDEN (403)',
        resBlrReq.status === 403,
        `Got ${resBlrReq.status}`
      );

      // 3. Super Admin requesting CHE proof -> Authorized
      const resAdminReq = await filesGET(
        makeFilesRequest(superAdminSession.token, cheProofKey),
        { params: Promise.resolve({ key: cheProofKey.split('/') }) }
      );
      assert(
        'Super Admin accessing CHE proof is authorized (200 or 307 redirect)',
        resAdminReq.status === 200 || resAdminReq.status === 307,
        `Got ${resAdminReq.status}`
      );

      // 4. Unauthenticated request -> 401
      const resUnauth = await filesGET(
        makeFilesRequest(null, cheProofKey),
        { params: Promise.resolve({ key: cheProofKey.split('/') }) }
      );
      assert(
        'Unauthenticated request to proof file returns 401',
        resUnauth.status === 401,
        `Got ${resUnauth.status}`
      );
    }

    // TEST E: Missing FileAsset / Storage Object returns 404
    console.log('\n--- TEST E: Missing Storage Object Handling ---');
    const fakeKey = 'payment-proofs/2026/10/01/non-existent-proof-uuid.jpg';
    const resMissing = await filesGET(
      makeFilesRequest(superAdminSession.token, fakeKey),
      { params: Promise.resolve({ key: fakeKey.split('/') }) }
    );
    const dataMissing = await resMissing.json().catch(() => ({}));
    assert(
      'Missing object in storage returns 404',
      resMissing.status === 404
    );
    assert(
      'Missing object returns error message "Payment proof file is missing from object storage"',
      dataMissing.error === 'Payment proof file is missing from object storage'
    );

    // ─────────────────────────────────────────────────────────────
    // ISSUE 2: WHATSAPP INVOICE MESSAGE SHARING
    // ─────────────────────────────────────────────────────────────
    console.log('\n📱 ISSUE 2 — WhatsApp Invoice Message Sharing & Validation\n');

    // TEST 1: Single item purchase formatting
    console.log('--- TEST 1: Single Item WhatsApp Message ---');
    const singleReceipt = {
      orderNo: 'CS260011',
      customerName: 'Mohammed Yunus',
      customerPhone: '9876543210',
      total: 90000,
      store: 'BLR · Cosko Indiranagar',
      paymentMethod: 'UPI',
      items: [
        { name: 'Galaxy S26 Ultra', qty: 1, unitPrice: 90000 },
      ],
    };

    const msg1 = buildWhatsAppInvoiceMessage(singleReceipt);
    console.log('Generated WhatsApp Text:\n--------------------\n' + msg1 + '\n--------------------');

    assert('WhatsApp message contains customer first name "Mohammed"', msg1.includes('Mohammed'));
    assert('WhatsApp message contains invoice number "CS260011"', msg1.includes('CS260011'));
    assert('WhatsApp message contains formatted amount "₹90,000"', msg1.includes('₹90,000'));
    assert('WhatsApp message contains store "BLR · Cosko Indiranagar"', msg1.includes('BLR · Cosko Indiranagar'));
    assert('WhatsApp message contains payment method "UPI"', msg1.includes('UPI'));
    assert('WhatsApp message contains item "Galaxy S26 Ultra ×1"', msg1.includes('Galaxy S26 Ultra ×1'));

    // Critical negative assertions
    assert('WhatsApp message does NOT contain "http://"', !msg1.includes('http://'));
    assert('WhatsApp message does NOT contain "https://"', !msg1.includes('https://'));
    assert('WhatsApp message does NOT contain "/sales"', !msg1.includes('/sales'));
    assert('WhatsApp message does NOT contain "invoice="', !msg1.includes('invoice='));
    assert('WhatsApp message does NOT contain "login"', !msg1.toLowerCase().includes('login'));
    assert('WhatsApp message does NOT contain "credential"', !msg1.toLowerCase().includes('credential'));

    // TEST 2: Multiple items purchase (compact summary)
    console.log('\n--- TEST 2: Multiple Items WhatsApp Message ---');
    const multiReceipt = {
      orderNo: 'CS260012',
      customerName: 'Fatima Zahra',
      customerPhone: '+91 99887 76655',
      total: 125000,
      store: 'CHE',
      paymentMethod: 'Credit Card',
      items: [
        { name: 'Galaxy S26 Ultra', qty: 1 },
        { name: 'iPhone Case', qty: 2 },
        { name: 'USB-C Cable', qty: 1 },
        { name: 'Screen Protector', qty: 2 },
      ],
    };

    const msg2 = buildWhatsAppInvoiceMessage(multiReceipt);
    assert('Multiple items message contains first item', msg2.includes('Galaxy S26 Ultra ×1'));
    assert('Multiple items message contains second item', msg2.includes('iPhone Case ×2'));
    assert('Multiple items message truncates additional items with compact "+2 more items"', msg2.includes('+2 more items'));
    assert('Multiple items message does NOT contain URLs', !msg2.includes('http') && !msg2.includes('/sales'));

    // TEST 3: Click-to-chat URL building with 10-digit phone normalization
    console.log('\n--- TEST 3: WhatsApp Click-to-Chat URL Generation ---');
    const urlResult = buildWhatsAppInvoiceUrl(singleReceipt);
    assert('buildWhatsAppInvoiceUrl succeeds for valid 10-digit number', urlResult.success === true);
    assert('WhatsApp URL uses 91 country code prefix', urlResult.url?.startsWith('https://wa.me/919876543210?text=') === true);
    assert('Encoded text contains invoice number', urlResult.url?.includes('CS260011') === true);

    // TEST 4: Missing or invalid phone numbers
    console.log('\n--- TEST 4: Phone Validation & Walk-in Customers ---');
    const invalidPhoneReceipt = {
      orderNo: 'CS260013',
      customerName: 'Walk-in Customer',
      customerPhone: '12345', // Too short
      total: 500,
      store: 'BLR',
      paymentMethod: 'Cash',
    };
    const invalidResult = buildWhatsAppInvoiceUrl(invalidPhoneReceipt);
    assert('Invalid phone number (< 10 digits) returns success = false', invalidResult.success === false);
    assert(
      'Invalid phone returns error "Customer phone number is required to send invoice on WhatsApp."',
      invalidResult.error === 'Customer phone number is required to send invoice on WhatsApp.'
    );

    const emptyPhoneReceipt = {
      orderNo: 'CS260014',
      customerName: 'Walk-in Customer',
      customerPhone: '',
      total: 500,
      store: 'BLR',
      paymentMethod: 'Cash',
    };
    const emptyResult = buildWhatsAppInvoiceUrl(emptyPhoneReceipt);
    assert('Missing phone number returns success = false', emptyResult.success === false);
    assert(
      'Missing phone returns error "Customer phone number is required to send invoice on WhatsApp."',
      emptyResult.error === 'Customer phone number is required to send invoice on WhatsApp.'
    );

    // Test extract10DigitPhone utility directly
    assert('extract10DigitPhone strips +91 and spaces', extract10DigitPhone('+91 98765 43210') === '9876543210');
    assert('extract10DigitPhone strips leading 0', extract10DigitPhone('09876543210') === '9876543210');
    assert('extract10DigitPhone handles pure 10 digits', extract10DigitPhone('9876543210') === '9876543210');
    assert('extract10DigitPhone returns empty for invalid input', extract10DigitPhone('123') === '');

  } finally {
    // Clean up created FileAssets
    if (cleanupFileAssetKeys.length > 0) {
      await (prisma as any).fileAsset.deleteMany({
        where: { objectKey: { in: cleanupFileAssetKeys } },
      }).catch(() => {});
    }

    // Clean up test sessions
    await prisma.userSession.deleteMany({
      where: {
        id: { in: [superAdminSession.sessionId, blrSession.sessionId, cheSession.sessionId] },
      },
    }).catch(() => {});

    await prisma.$disconnect().catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    console.error('\nFailures:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  process.exit(0);
}

runAllTests().catch(async (err) => {
  console.error('Test execution error:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
