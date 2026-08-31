import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeMobileNumber } from '@/lib/phoneUtils';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/customers - Search customer by normalized phone or query (excludes Archived by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const query = searchParams.get('query');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const whereClause: any = {};
    if (!includeArchived) {
      whereClause.status = { not: 'Archived' };
    }

    if (phone) {
      const normalized = normalizeMobileNumber(phone);
      const customer = await (prisma as any).customer.findFirst({
        where: {
          ...whereClause,
          normalizedPhone: {
            contains: normalized,
          },
        },
      });
      return NextResponse.json(
        { success: true, customer },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    if (query) {
      whereClause.OR = [
        { name: { contains: query } },
        { phone: { contains: query } },
        { email: { contains: query } },
      ];
    }

    const customers = await (prisma as any).customer.findMany({
      where: whereClause,
      orderBy: {
        totalSpent: 'desc',
      },
      take: 100,
    });

    return NextResponse.json(
      { success: true, customers },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/customers GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve customer records' }, { status: 500 });
  }
}

/**
 * POST /api/customers - Create or update Customer Master profile
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.name || !body.phone) {
      return NextResponse.json({ error: 'Customer Name and Phone are required' }, { status: 400 });
    }

    const normalizedPhone = normalizeMobileNumber(body.phone);

    const existingCustomer = await (prisma as any).customer.findFirst({
      where: { normalizedPhone },
    });

    let customer;
    if (existingCustomer) {
      customer = await (prisma as any).customer.update({
        where: { id: existingCustomer.id },
        data: {
          name: body.name,
          email: body.email || undefined,
          address: body.address || undefined,
          city: body.city || undefined,
          status: 'Active',
        },
      });
    } else {
      customer = await (prisma as any).customer.create({
        data: {
          name: body.name,
          phone: body.phone,
          normalizedPhone,
          email: body.email || null,
          address: body.address || null,
          city: body.city || user.store,
          totalSpent: body.totalSpend || 0,
          creditBalance: body.creditBalance || 0,
          status: 'Active',
        },
      });
    }

    broadcastRealtimeEvent('customers', 'CUSTOMER_UPDATED', { id: customer.id, name: customer.name, phone: customer.phone, action: 'saved' });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/customers POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save customer' }, { status: 500 });
  }
}

/**
 * PUT /api/customers - Update existing customer
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const customer = await (prisma as any).customer.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.phone ? { phone: body.phone, normalizedPhone: normalizeMobileNumber(body.phone) } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.city ? { city: body.city } : {}),
        ...(body.address !== undefined ? { address: body.address || null } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.creditBalance !== undefined ? { creditBalance: body.creditBalance } : {}),
      },
    });

    broadcastRealtimeEvent('customers', 'CUSTOMER_UPDATED', { id: customer.id, name: customer.name, phone: customer.phone, action: 'updated' });

    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    console.error('API /api/customers PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update customer' }, { status: 500 });
  }
}

/**
 * DELETE /api/customers - Safe Archive or Permanent Delete for unused customers
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const target = await (prisma as any).customer.findUnique({ where: { id } }).catch(() => null);
    if (!target) {
      return NextResponse.json({ success: true, message: 'Customer already deleted or non-existent' });
    }

    // Check historical dependencies
    const [salesCount, repairCount] = await Promise.all([
      (prisma as any).salesOrder.count({ where: { customerId: target.id } }),
      (prisma as any).repairEnquiry.count({ where: { customerId: target.id } }),
    ]);

    const hasHistory = salesCount > 0 || repairCount > 0 || Number(target.totalSpent) > 0 || Number(target.creditBalance) > 0;

    if (hasHistory || !permanent || user.role !== 'Super Admin') {
      const customer = await (prisma as any).customer.update({
        where: { id: target.id },
        data: { status: 'Archived' },
      });

      broadcastRealtimeEvent('customers', 'CUSTOMER_UPDATED', { id: target.id, name: target.name, action: 'archived' });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        customer,
        hasHistory,
        message: hasHistory
          ? `Customer "${target.name}" has business history (${salesCount} sales, ${repairCount} repairs, ₹${target.totalSpent} spend) and was archived safely.`
          : `Customer "${target.name}" archived successfully.`,
      });
    }

    // Hard-delete only for completely unused customers by Super Admin
    await (prisma as any).customerExternalLink.deleteMany({ where: { coskoCustomerId: target.id } });
    await (prisma as any).customer.delete({ where: { id: target.id } });

    broadcastRealtimeEvent('customers', 'CUSTOMER_UPDATED', { id: target.id, name: target.name, action: 'deleted' });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Customer "${target.name}" permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('API /api/customers DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to archive/delete customer' }, { status: 500 });
  }
}


