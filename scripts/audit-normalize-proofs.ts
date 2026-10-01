import { prisma } from '../src/lib/db';
import { fileExistsInStorage, isObjectStorageConfigured } from '../src/lib/objectStorage';

function deriveObjectKey(url: string | null | undefined): string | null {
  if (!url) return null;
  // If it's /api/files/...
  if (url.startsWith('/api/files/')) {
    const raw = url.slice('/api/files/'.length);
    const decoded = decodeURIComponent(raw);
    const segments = decoded.split(/[/\\]+/).filter(Boolean);
    return segments.join('/');
  }
  // If it's a full R2 / S3 URL
  const proofIdx = url.indexOf('payment-proofs/');
  if (proofIdx !== -1) {
    const key = url.slice(proofIdx).split('?')[0];
    return key.split(/[/\\]+/).filter(Boolean).join('/');
  }
  const receiptIdx = url.indexOf('expense-receipts/');
  if (receiptIdx !== -1) {
    const key = url.slice(receiptIdx).split('?')[0];
    return key.split(/[/\\]+/).filter(Boolean).join('/');
  }
  return null;
}

function normalizeUrl(key: string): string {
  const segments = key.split('/').map(encodeURIComponent);
  return `/api/files/${segments.join('/')}`;
}

async function main() {
  console.log('=== LEGACY PROOF AUDIT & NORMALIZATION ===');
  console.log('Storage configured:', isObjectStorageConfigured());

  // 1. Audit Sales Orders
  const sales = await prisma.salesOrder.findMany({
    where: { paymentProofUrl: { not: null } },
  });
  console.log(`Found ${sales.length} sales orders with paymentProofUrl`);

  let salesNormalized = 0;
  let salesMissing = 0;

  for (const s of sales) {
    const key = deriveObjectKey(s.paymentProofUrl);
    if (!key) {
      console.log(`SalesOrder ${s.orderNo}: Unable to derive key from "${s.paymentProofUrl}"`);
      continue;
    }
    const exists = await fileExistsInStorage(key);
    console.log(`SalesOrder ${s.orderNo} | Key: ${key} | Exists in R2: ${exists}`);

    if (exists) {
      const canonicalUrl = normalizeUrl(key);
      if (s.paymentProofUrl !== canonicalUrl) {
        await prisma.salesOrder.update({
          where: { id: s.id },
          data: { paymentProofUrl: canonicalUrl },
        });
        console.log(`  -> Normalized to: ${canonicalUrl}`);
        salesNormalized++;
      }

      // Check/create FileAsset if missing
      const asset = await (prisma as any).fileAsset.findUnique({
        where: { objectKey: key },
      });
      if (!asset) {
        await (prisma as any).fileAsset.create({
          data: {
            objectKey: key,
            storageProvider: 's3',
            mimeType: key.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            byteSize: 1024,
            originalFilename: key.split('/').pop() || 'proof',
            storeCode: s.storeCode || 'BLR',
            privacyLevel: 'STORE_PRIVATE',
            relatedEntityType: 'Sale',
          },
        });
        console.log(`  -> Created missing FileAsset for: ${key}`);
      }
    } else {
      salesMissing++;
      console.warn(`  [ALERT] Physical object not found in R2 for SalesOrder ${s.orderNo}: ${key}`);
    }
  }

  // 2. Audit Purchase Payments
  const payments = await prisma.purchasePayment.findMany({
    where: { receiptUrl: { not: null } },
    include: { purchase: true },
  });
  console.log(`Found ${payments.length} purchase payments with receiptUrl`);

  for (const p of payments) {
    const key = deriveObjectKey(p.receiptUrl);
    if (!key) continue;
    const exists = await fileExistsInStorage(key);
    console.log(`PurchasePayment ${p.id} | Key: ${key} | Exists in R2: ${exists}`);
    if (exists) {
      const canonicalUrl = normalizeUrl(key);
      if (p.receiptUrl !== canonicalUrl) {
        await prisma.purchasePayment.update({
          where: { id: p.id },
          data: { receiptUrl: canonicalUrl },
        });
      }
    }
  }

  // 3. Audit Expenses
  const expenses = await prisma.expense.findMany({
    where: { receiptUrl: { not: null } },
  });
  console.log(`Found ${expenses.length} expenses with receiptUrl`);

  for (const exp of expenses) {
    const key = deriveObjectKey(exp.receiptUrl);
    if (!key) continue;
    const exists = await fileExistsInStorage(key);
    console.log(`Expense ${exp.id} | Key: ${key} | Exists in R2: ${exists}`);
    if (exists) {
      const canonicalUrl = normalizeUrl(key);
      if (exp.receiptUrl !== canonicalUrl) {
        await prisma.expense.update({
          where: { id: exp.id },
          data: { receiptUrl: canonicalUrl },
        });
      }
    }
  }

  console.log('=== AUDIT COMPLETE ===');
  console.log(`Normalized ${salesNormalized} sales orders. Missing: ${salesMissing}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
