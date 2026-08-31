import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/stores - Retrieve all store hubs (excludes Inactive by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: any = {};
    if (!includeInactive) {
      where.status = { not: 'Inactive' };
    }

    const stores = await prisma.storeHub.findMany({
      where,
      orderBy: {
        code: 'asc',
      },
    });

    return NextResponse.json(
      { success: true, stores },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/stores GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve store hubs' }, { status: 500 });
  }
}

/**
 * POST /api/stores - Create or update store hub (Super Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.code || !body.name || !body.city) {
      return NextResponse.json({ error: 'Store Code, Name, and City are required' }, { status: 400 });
    }

    const store = await prisma.storeHub.upsert({
      where: { code: body.code.toUpperCase() },
      create: {
        code: body.code.toUpperCase(),
        name: body.name,
        city: body.city,
        address: body.address || 'COSKO Retail Hub',
        managerName: body.managerName || null,
        phone: body.phone || null,
        registersCount: body.registersCount || 2,
        status: body.status || 'Active',
      },
      update: {
        name: body.name,
        city: body.city,
        address: body.address || undefined,
        managerName: body.managerName || undefined,
        phone: body.phone || undefined,
        registersCount: body.registersCount || undefined,
        status: body.status || undefined,
      },
    });

    broadcastRealtimeEvent('stores', 'STORE_UPDATED', { code: store.code, name: store.name, action: 'saved' });

    return NextResponse.json({ success: true, store }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/stores POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save store hub' }, { status: 500 });
  }
}

/**
 * DELETE /api/stores - Safe Deactivate or Permanent Delete for unused store hubs
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'Super Admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Store ID or Code is required' }, { status: 400 });
    }

    let target = await prisma.storeHub.findUnique({ where: { id } }).catch(() => null);
    if (!target) {
      target = await prisma.storeHub.findFirst({
        where: {
          OR: [
            { id },
            { code: id },
            { code: id.toUpperCase() },
          ],
        },
      });
    }

    if (!target) {
      return NextResponse.json({ success: true, message: 'Store already removed or non-existent' });
    }

    // Check store transaction & inventory history
    const [invCount, salesCount, poCount, transferCount] = await Promise.all([
      prisma.inventory.count({ where: { storeCode: target.code } }),
      prisma.salesOrder.count({ where: { storeCode: target.code } }),
      prisma.purchaseOrder.count({ where: { storeCode: target.code } }),
      prisma.stockTransfer.count({ where: { OR: [{ sourceStore: target.code }, { destStore: target.code }] } }),
    ]);

    const hasHistory = invCount > 0 || salesCount > 0 || poCount > 0 || transferCount > 0;

    if (hasHistory || !permanent) {
      const store = await prisma.storeHub.update({
        where: { id: target.id },
        data: { status: 'Inactive' },
      });

      broadcastRealtimeEvent('stores', 'STORE_UPDATED', { code: target.code, name: target.name, action: 'deactivated' });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        store,
        hasHistory,
        message: hasHistory
          ? `Store Hub "${target.name}" (${target.code}) has active business records (${invCount} inventory items, ${salesCount} sales) and was deactivated safely.`
          : `Store Hub "${target.name}" deactivated.`,
      });
    }

    // Hard-delete if 0 history
    await prisma.userStoreAssignment.deleteMany({ where: { storeCode: target.code } });
    await prisma.storeHub.delete({ where: { id: target.id } });

    broadcastRealtimeEvent('stores', 'STORE_UPDATED', { code: target.code, name: target.name, action: 'deleted' });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Store Hub "${target.name}" (${target.code}) permanently deleted.`,
    });
  } catch (error: any) {
    console.error('API /api/stores DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to deactivate/delete store' }, { status: 500 });
  }
}


