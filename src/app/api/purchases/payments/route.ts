import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * Helper to compute overdue days and status
 */
function computeBillOverdue(dueDateStr: string | Date | null | undefined, balance: number) {
  if (balance <= 0.005) {
    return { overdueDays: 0, overdueStatus: 'Settled' };
  }
  if (!dueDateStr) {
    return { overdueDays: 0, overdueStatus: 'Upcoming' };
  }

  const dueDate = new Date(dueDateStr);
  const now = new Date();
  // Normalize both dates to midnight UTC/Local for clean day diff
  const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const diffDays = Math.round((todayMidnight - dueMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { overdueDays: diffDays, overdueStatus: 'Overdue' };
  } else if (diffDays === 0) {
    return { overdueDays: 0, overdueStatus: 'Due Today' };
  } else {
    return { overdueDays: 0, overdueStatus: 'Upcoming' };
  }
}

/**
 * GET /api/purchases/payments
 * Query by ?purchaseId=... OR ?vendorId=...
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const purchaseId = searchParams.get('purchaseId');
    const vendorId = searchParams.get('vendorId');

    // Case 1: Fetch all bills & payments for a specific Vendor
    if (vendorId) {
      const vendor = await (prisma as any).vendor.findUnique({
        where: { id: vendorId },
        include: {
          purchases: {
            where: {
              status: { notIn: ['Cancelled', 'Archived'] },
            },
            include: {
              payments: {
                orderBy: { paymentDate: 'desc' },
              },
            },
            orderBy: { orderDate: 'desc' },
          },
        },
      });

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      let totalBilled = 0;
      let totalPaid = 0;
      let totalCredits = 0;
      let outstandingBalance = 0;
      let unpaidBillsCount = 0;
      let overdueBillsCount = 0;

      const bills = vendor.purchases.map((po: any) => {
        const totalCost = Number(po.totalCost) || 0;
        const creditAmount = Number(po.creditAmount) || 0;
        // Calculate sum of payments from real database payments relation
        const realPaid = po.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || Number(po.paidAmount) || 0;
        const balance = Math.max(0, totalCost - realPaid - creditAmount);

        totalBilled += totalCost;
        totalPaid += realPaid;
        totalCredits += creditAmount;
        outstandingBalance += balance;

        const effectiveDueDate = po.dueDate || po.expectedDate || null;
        const { overdueDays, overdueStatus } = computeBillOverdue(effectiveDueDate, balance);

        if (balance > 0.005) {
          unpaidBillsCount++;
          if (overdueStatus === 'Overdue') {
            overdueBillsCount++;
          }
        }

        return {
          id: po.id,
          poNo: po.poNo,
          invoiceNo: po.invoiceNo || po.poNo,
          storeCode: po.storeCode,
          orderDate: po.orderDate,
          expectedDate: po.expectedDate,
          dueDate: effectiveDueDate,
          totalCost,
          paidAmount: realPaid,
          creditAmount,
          balance,
          paymentStatus: po.paymentStatus,
          status: po.status,
          notes: po.notes,
          overdueDays,
          overdueStatus,
          payments: po.payments || [],
        };
      });

      return NextResponse.json({
        success: true,
        vendor: {
          id: vendor.id,
          code: vendor.code,
          name: vendor.name,
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          phone: vendor.phone,
          city: vendor.city,
          address: vendor.address,
          gstin: vendor.gstin,
          paymentTerms: vendor.paymentTerms,
          leadTimeDays: vendor.leadTimeDays,
          status: vendor.status,
        },
        summary: {
          totalBilled: Math.round(totalBilled * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalCredits: Math.round(totalCredits * 100) / 100,
          outstandingBalance: Math.round(outstandingBalance * 100) / 100,
          totalBillsCount: bills.length,
          unpaidBillsCount,
          overdueBillsCount,
        },
        bills,
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      });
    }

    // Case 2: Fetch payments & summary for a single Purchase Order
    if (purchaseId) {
      const purchase = await (prisma as any).purchaseOrder.findUnique({
        where: { id: purchaseId },
        include: {
          vendor: true,
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      if (!purchase) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }

      const totalCost = Number(purchase.totalCost) || 0;
      const creditAmount = Number(purchase.creditAmount) || 0;
      const realPaid = purchase.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || Number(purchase.paidAmount) || 0;
      const balance = Math.max(0, totalCost - realPaid - creditAmount);
      const effectiveDueDate = purchase.dueDate || purchase.expectedDate || null;
      const { overdueDays, overdueStatus } = computeBillOverdue(effectiveDueDate, balance);

      return NextResponse.json({
        success: true,
        payments: purchase.payments,
        summary: {
          totalCost,
          totalPaid: realPaid,
          creditAmount,
          remaining: balance,
          paymentStatus: purchase.paymentStatus,
          overdueDays,
          overdueStatus,
          vendorName: purchase.vendor?.name,
          invoiceNo: purchase.invoiceNo || purchase.poNo,
          poNo: purchase.poNo,
        },
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      });
    }

    return NextResponse.json({ error: 'Either purchaseId or vendorId is required' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/purchases/payments GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve payments' }, { status: 500 });
  }
}

/**
 * POST /api/purchases/payments - Record a payment against a purchase order atomically
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to record vendor payment' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.purchaseId) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const paymentAmount = Math.round(Number(body.amount) * 100) / 100;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be a positive number' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Lock & fetch PO with payments directly from DB
      const po = await tx.purchaseOrder.findUnique({
        where: { id: body.purchaseId },
        include: {
          payments: true,
          vendor: true,
        },
      });

      if (!po) {
        throw new Error('Purchase bill not found');
      }

      if (po.status === 'Cancelled' || po.status === 'Archived') {
        throw new Error(`Cannot record payment on a ${po.status.toLowerCase()} purchase bill (${po.poNo})`);
      }

      // 2. Authoritative calculation from DB source of truth
      const totalCost = Number(po.totalCost) || 0;
      const creditAmount = Number(po.creditAmount) || 0;
      const currentPaid = po.payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const remainingBeforePayment = Math.max(0, totalCost - currentPaid - creditAmount);

      // 3. Prevent overpayment & negative balance
      if (remainingBeforePayment <= 0.005) {
        throw new Error(`This bill (${po.invoiceNo || po.poNo}) is already fully settled.`);
      }

      if (paymentAmount > remainingBeforePayment + 0.01) {
        throw new Error(
          `Payment amount (₹${paymentAmount.toLocaleString('en-IN')}) exceeds the remaining balance (₹${remainingBeforePayment.toLocaleString('en-IN')})`
        );
      }

      // 4. Prevent accidental duplicate payment (same PO, same amount, same ref within 60 seconds)
      if (body.referenceNo && String(body.referenceNo).trim()) {
        const cleanRef = String(body.referenceNo).trim();
        const recentDuplicate = await tx.purchasePayment.findFirst({
          where: {
            purchaseId: body.purchaseId,
            referenceNo: cleanRef,
            amount: paymentAmount,
            createdAt: { gte: new Date(Date.now() - 60000) },
          },
        });
        if (recentDuplicate) {
          throw new Error(`A payment with reference "${cleanRef}" of ₹${paymentAmount} was already recorded within the last minute.`);
        }
      }

      // 5. Generate Payment Voucher Number
      const payCount = await tx.purchasePayment.count();
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const voucherNo = `PV-${datePart}-${String(payCount + 1).padStart(4, '0')}`;

      // 6. Record payment
      const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
      const payment = await tx.purchasePayment.create({
        data: {
          purchaseId: body.purchaseId,
          voucherNo,
          amount: paymentAmount,
          paymentDate,
          paymentMethod: body.paymentMethod || 'Bank Transfer',
          referenceNo: body.referenceNo ? String(body.referenceNo).trim() : null,
          receiptUrl: body.receiptUrl || null,
          notes: body.notes ? String(body.notes).trim() : null,
          recordedBy: user.name || user.email || 'Authorized Staff',
        },
      });

      // Record Double-Entry Financial Ledger Entries for Payment
      await tx.financialLedgerEntry.create({
        data: {
          entryNo: `JRN-PAY-AP-${voucherNo}`,
          entryDate: paymentDate,
          storeCode: po.storeCode || 'CENTRAL',
          accountCategory: 'LIABILITY',
          accountName: 'Vendor Accounts Payable (Settlement)',
          debit: paymentAmount,
          credit: 0,
          amount: -paymentAmount,
          refType: 'VENDOR_PAYMENT',
          refId: payment.id,
          refNo: voucherNo,
          entityName: po.vendor?.name || 'Vendor',
          description: `Vendor bill payment for Bill #${po.invoiceNo || po.poNo} via ${body.paymentMethod || 'Bank Transfer'}`,
          createdBy: user.name || user.email || 'Authorized Staff',
        },
      });

      await tx.financialLedgerEntry.create({
        data: {
          entryNo: `JRN-PAY-BANK-${voucherNo}`,
          entryDate: paymentDate,
          storeCode: po.storeCode || 'CENTRAL',
          accountCategory: 'ASSET',
          accountName: `Cash / Bank (${body.paymentMethod || 'Bank Transfer'})`,
          debit: 0,
          credit: paymentAmount,
          amount: -paymentAmount,
          refType: 'VENDOR_PAYMENT',
          refId: payment.id,
          refNo: voucherNo,
          entityName: po.vendor?.name || 'Vendor',
          description: `Bank disbursement for Vendor Bill #${po.invoiceNo || po.poNo} (Voucher ${voucherNo})`,
          createdBy: user.name || user.email || 'Authorized Staff',
        },
      });

      // 7. Update PO paidAmount and paymentStatus atomically
      const newTotalPaid = Math.round((currentPaid + paymentAmount) * 100) / 100;
      const remainingAfterPayment = Math.max(0, Math.round((totalCost - newTotalPaid - creditAmount) * 100) / 100);

      let newPaymentStatus: string;
      if (remainingAfterPayment <= 0.01) {
        newPaymentStatus = 'Paid';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'Partial';
      } else {
        newPaymentStatus = 'Unpaid';
      }

      const updatedPO = await tx.purchaseOrder.update({
        where: { id: body.purchaseId },
        data: {
          paidAmount: newTotalPaid,
          paymentStatus: newPaymentStatus,
        },
      });

      // 8. Create immutable AuditLog entry
      await tx.auditLog.create({
        data: {
          module: 'Vendors / Payables',
          action: 'Record Vendor Payment',
          details: `Recorded ₹${paymentAmount.toFixed(2)} payment via ${body.paymentMethod || 'Bank Transfer'} for Bill #${po.invoiceNo || po.poNo} (${po.vendor?.name || 'Vendor'}). Voucher: ${voucherNo}, Ref: ${body.referenceNo || 'N/A'}, Remaining: ₹${remainingAfterPayment.toFixed(2)}, Status: ${newPaymentStatus}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: po.storeCode || 'CENTRAL',
        },
      });

      return {
        payment,
        updatedPO,
        voucherNo,
        vendor: po.vendor,
        totalCost,
        creditAmount,
        totalPaid: newTotalPaid,
        remaining: remainingAfterPayment,
        newPaymentStatus,
      };
    });

    // Broadcast realtime event for multi-tab sync
    broadcastRealtimeEvent('purchases', 'PAYMENT_RECORDED', {
      purchaseId: body.purchaseId,
      paymentStatus: result.newPaymentStatus,
      vendorId: result.vendor?.id,
      amount: paymentAmount,
    });
    broadcastRealtimeEvent('vendors', 'VENDOR_UPDATED', {
      id: result.vendor?.id,
      code: result.vendor?.code,
      action: 'payment_recorded',
    });

    return NextResponse.json({
      success: true,
      payment: result.payment,
      purchaseOrder: result.updatedPO,
      receiptVoucher: {
        voucherNo: result.voucherNo,
        paymentDate: result.payment.paymentDate,
        amount: paymentAmount,
        paymentMethod: result.payment.paymentMethod,
        referenceNo: result.payment.referenceNo,
        receiptUrl: result.payment.receiptUrl,
        notes: result.payment.notes,
        recordedBy: result.payment.recordedBy,
        vendorName: result.vendor?.name,
        vendorGstin: result.vendor?.gstin,
        vendorPhone: result.vendor?.phone,
        vendorAddress: result.vendor?.address,
        billNo: result.updatedPO.invoiceNo || result.updatedPO.poNo,
        poNo: result.updatedPO.poNo,
        totalCost: result.totalCost,
        totalPaid: result.totalPaid,
        remainingBalance: result.remaining,
        paymentStatus: result.newPaymentStatus,
      },
      remaining: result.remaining,
      paymentStatus: result.newPaymentStatus,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/purchases/payments POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record payment' }, { status: 400 });
  }
}
