import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Cash', code: 'CASH', type: 'Cash', description: 'Cash on counter / cash disbursement', isSystem: true, sortOrder: 1, status: 'Active' },
  { name: 'UPI', code: 'UPI', type: 'Digital', description: 'Instant UPI / QR Code transfer (GPay, PhonePe, Paytm)', isSystem: true, sortOrder: 2, status: 'Active' },
  { name: 'Card', code: 'CARD', type: 'Card', description: 'Credit or Debit Card swipe / POS terminal', isSystem: true, sortOrder: 3, status: 'Active' },
  { name: 'Bank Transfer', code: 'BANK_TRANSFER', type: 'Bank', description: 'Direct Bank NEFT / RTGS / IMPS wire', isSystem: true, sortOrder: 4, status: 'Active' },
  { name: 'Corporate Card', code: 'CORP_CARD', type: 'Card', description: 'Company / Corporate Card payment', isSystem: true, sortOrder: 5, status: 'Active' },
  { name: 'Direct Debit', code: 'DIRECT_DEBIT', type: 'Bank', description: 'Automated bank ECS / ACH direct debit', isSystem: true, sortOrder: 6, status: 'Active' },
  { name: 'Cheque', code: 'CHEQUE', type: 'Bank', description: 'Physical bank cheque clearing', isSystem: true, sortOrder: 7, status: 'Active' },
  { name: 'Credit', code: 'CREDIT', type: 'Credit', description: 'Store credit / customer ledger credit balance', isSystem: true, sortOrder: 8, status: 'Active' },
];


let cachedPayload: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 30_000;

function invalidateCache() {
  cachedPayload = null;
  lastCacheTime = 0;
}

export async function GET(req: NextRequest) {
  try {
    const forceFresh = req?.nextUrl?.searchParams?.get('fresh') === 'true';
    if (!forceFresh && cachedPayload && Date.now() - lastCacheTime < CACHE_TTL) {
      return NextResponse.json(cachedPayload, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }

    let items = await prisma.paymentMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Auto-seed defaults if table is empty
    if (items.length === 0) {
      for (const def of DEFAULT_PAYMENT_METHODS) {
        await prisma.paymentMethod.upsert({
          where: { name: def.name },
          update: {},
          create: def,
        });
      }

      items = await prisma.paymentMethod.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    }

    cachedPayload = {
      success: true,
      paymentMethods: items,
      totalCount: items.length,
    };
    lastCacheTime = Date.now();

    return NextResponse.json(cachedPayload, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json();

    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Payment method name is required' },
        { status: 400 }
      );
    }

    const code =
      body?.code?.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_') ||
      name.toUpperCase().replace(/[^A-Z0-9_]+/g, '_').slice(0, 32);

    const type = body?.type?.trim() || 'Bank';
    const description = body?.description?.trim() || null;
    const status = body?.status === 'Inactive' ? 'Inactive' : 'Active';
    const sortOrder = Number(body?.sortOrder) || 10;

    // Check duplicate
    const existing = await prisma.paymentMethod.findFirst({
      where: {
        OR: [
          { name: { equals: name } },
          { code: { equals: code } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: true, paymentMethod: existing, message: 'Payment method already exists' },
        { status: 200 }
      );
    }

    const created = await prisma.paymentMethod.create({
      data: {
        name,
        code,
        type,
        description,
        status,
        sortOrder,
        isSystem: false,
      },
    });

    invalidateCache();
    broadcastRealtimeEvent('payment-methods', 'PAYMENT_METHOD_CREATED', created);

    return NextResponse.json(
      { success: true, paymentMethod: created, message: 'Payment method created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating payment method:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create payment method' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json();

    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Payment method not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (body.name?.trim()) updateData.name = body.name.trim();
    if (body.type?.trim()) updateData.type = body.type.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.status) updateData.status = body.status;
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder) || 0;

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: updateData,
    });

    invalidateCache();
    broadcastRealtimeEvent('payment-methods', 'PAYMENT_METHOD_UPDATED', updated);

    return NextResponse.json({
      success: true,
      paymentMethod: updated,
      message: 'Payment method updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating payment method:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update payment method' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.securityLevel < 80) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const reason = searchParams.get('reason') || '';

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Payment method not found' },
        { status: 404 }
      );
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { success: false, error: 'System payment methods cannot be deleted' },
        { status: 403 }
      );
    }

    // ─── NON-SUPER-ADMIN: Route through delete approval workflow ────────────
    if (authUser.securityLevel < 100) {
      if (!reason || reason.trim().length < 3) {
        return NextResponse.json({ success: false, error: 'A reason for deletion is required (minimum 3 characters)' }, { status: 400 });
      }
      const { createDeleteRequest } = await import('@/lib/services/deleteApprovalService');
      const result = await createDeleteRequest(authUser, {
        entityType: 'PAYMENT_METHOD',
        entityId: id,
        reason: reason.trim(),
      });
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        mode: 'pending_approval',
        deleteRequest: result.deleteRequest,
        message: `Delete request for payment method "${existing.name}" submitted for Super Admin approval.`,
      });
    }

    // ─── SUPER ADMIN: Direct delete ─────────────────────────────────────────
    await prisma.$transaction(async (tx: any) => {
      await tx.paymentMethod.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          module: 'PAYMENT_METHODS',
          action: `DELETED: Payment method "${existing.name}" (${existing.code})`,
          details: JSON.stringify({ paymentMethodId: id, beforeState: existing }),
          userEmail: authUser.email,
          userRole: authUser.role,
          storeCode: authUser.store || 'CENTRAL',
        },
      });
    });

    invalidateCache();
    broadcastRealtimeEvent('payment-methods', 'PAYMENT_METHOD_DELETED', { id });

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting payment method:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}

