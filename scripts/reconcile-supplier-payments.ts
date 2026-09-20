import { prisma } from '../src/lib/db';

export async function reconcileSupplierPayments() {
  console.log('🔄 Starting Authoritative Supplier Payments & PO Reconciliation...');

  const pos = await prisma.purchaseOrder.findMany({
    include: {
      payments: true,
      vendor: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let rectifiedCount = 0;

  for (const po of pos) {
    const totalCost = Number(po.totalCost) || 0;
    const creditAmount = Number(po.creditAmount) || 0;
    const sumPayments = po.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    let updatedPaidAmount = sumPayments;
    let correctPaymentStatus: string;

    // Handle case where payments exist
    if (sumPayments > 0) {
      const remaining = Math.max(0, Math.round((totalCost - sumPayments - creditAmount) * 100) / 100);
      if (remaining <= 0.01 && totalCost > 0) {
        correctPaymentStatus = 'Paid';
      } else {
        correctPaymentStatus = 'Partial';
      }
    } else {
      // 0 payments recorded in DB
      correctPaymentStatus = 'Unpaid';
      updatedPaidAmount = 0;
    }

    // Check if voucher numbers or notes are missing on existing payments
    for (let i = 0; i < po.payments.length; i++) {
      const pay = po.payments[i];
      if (!pay.voucherNo || !pay.notes) {
        const datePart = pay.paymentDate.toISOString().slice(0, 10).replace(/-/g, '');
        const voucherNo = pay.voucherNo || `PV-${datePart}-${String(i + 1).padStart(4, '0')}`;
        const notes = pay.notes || `Authoritative supplier payment for Bill #${po.invoiceNo || po.poNo}`;
        await prisma.purchasePayment.update({
          where: { id: pay.id },
          data: { voucherNo, notes },
        });
        console.log(`  -> Fixed payment voucher/notes on payment ${pay.id} (${voucherNo})`);
      }
    }

    // Check if PO needs update
    const needsStatusUpdate = po.paymentStatus !== correctPaymentStatus;
    const needsPaidUpdate = Math.abs(Number(po.paidAmount) - updatedPaidAmount) > 0.01;

    if (needsStatusUpdate || needsPaidUpdate) {
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          paidAmount: updatedPaidAmount,
          paymentStatus: correctPaymentStatus,
        },
      });
      rectifiedCount++;
      console.log(
        `  ✅ Rectified PO ${po.poNo}: paidAmount (${po.paidAmount} -> ${updatedPaidAmount}), paymentStatus (${po.paymentStatus} -> ${correctPaymentStatus})`
      );
    }
  }

  console.log(`✨ Supplier Payments Reconciliation completed! Rectified ${rectifiedCount} purchase orders.`);
}

if (require.main === module) {
  reconcileSupplierPayments()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('Error during reconciliation:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
