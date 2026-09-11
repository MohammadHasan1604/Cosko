import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/purchases/payments - List payments for a purchase order
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const purchaseId = searchParams.get('purchaseId');

    if (!purchaseId) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const payments = await (prisma as any).purchasePayment.findMany({
      where: { purchaseId },
      orderBy: { paymentDate: 'desc' },
    });

    const purchase = await (prisma as any).purchaseOrder.findUnique({
      where: { id: purchaseId },
      select: { totalCost: true, paidAmount: true, paymentStatus: true },
    });

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        totalCost: Number(purchase?.totalCost) || 0,
        totalPaid: Number(purchase?.paidAmount) || 0,
        remaining: Math.max(0, (Number(purchase?.totalCost) || 0) - (Number(purchase?.paidAmount) || 0)),
        paymentStatus: purchase?.paymentStatus || 'Unpaid',
      },
    });
  } catch (error: any) {
    console.error('API /api/purchases/payments GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve payments' }, { status: 500 });
  }
}

/**
 * POST /api/purchases/payments - Record a payment against a purchase order
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.purchaseId || !body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'Purchase ID and positive payment amount are required' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Get current purchase order
      const po = await tx.purchaseOrder.findUnique({
        where: { id: body.purchaseId },
      });

      if (!po) {
        throw new Error('Purchase order not found');
      }

      const totalCost = Number(po.totalCost);
      const currentPaid = Number(po.paidAmount) || 0;
      const paymentAmount = Number(body.amount);
      const newTotalPaid = currentPaid + paymentAmount;
      const remaining = Math.max(0, totalCost - newTotalPaid);

      // Determine new payment status
      let newPaymentStatus: string;
      if (remaining <= 0 || newTotalPaid >= totalCost) {
        newPaymentStatus = 'Paid';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'Partial';
      } else {
        newPaymentStatus = 'Unpaid';
      }

      // Create payment record
      const payment = await tx.purchasePayment.create({
        data: {
          purchaseId: body.purchaseId,
          amount: paymentAmount,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          paymentMethod: body.paymentMethod || 'Bank Transfer',
          referenceNo: body.referenceNo || null,
          notes: body.notes || null,
          recordedBy: user.name,
        },
      });

      // Update purchase order paid amount and status
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: body.purchaseId },
        data: {
          paidAmount: newTotalPaid,
          paymentStatus: newPaymentStatus,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          module: 'Purchases',
          action: 'Record Payment',
          details: `Recorded ₹${paymentAmount.toFixed(2)} payment for ${po.poNo}. Total Paid: ₹${newTotalPaid.toFixed(2)}, Remaining: ₹${remaining.toFixed(2)}, Status: ${newPaymentStatus}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: po.storeCode,
        },
      });

      return { payment, updatedPO, remaining, newPaymentStatus };
    });

    broadcastRealtimeEvent('purchases', 'PAYMENT_RECORDED', {
      purchaseId: body.purchaseId,
      paymentStatus: result.newPaymentStatus,
    });

    return NextResponse.json({
      success: true,
      payment: result.payment,
      purchaseOrder: result.updatedPO,
      remaining: result.remaining,
      paymentStatus: result.newPaymentStatus,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/purchases/payments POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to record payment' }, { status: 500 });
  }
}
