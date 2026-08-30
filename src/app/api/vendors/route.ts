import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/vendors - Retrieve all vendors (excludes Archived by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const whereClause: any = {};
    if (!includeArchived) {
      whereClause.status = { not: 'Archived' };
    }

    const vendors = await (prisma as any).vendor.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      { success: true, vendors },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/vendors GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve vendors' }, { status: 500 });
  }
}

/**
 * POST /api/vendors - Create a new vendor
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

    if (!body.name) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    const count = await (prisma as any).vendor.count();
    const code = body.code || `VND-${String(count + 1).padStart(4, '0')}`;

    const vendor = await (prisma as any).vendor.upsert({
      where: { code },
      create: {
        code,
        name: body.name,
        contactPerson: body.contactPerson || 'Account Manager',
        email: body.email || `${body.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@vendor.com`,
        phone: body.phone || '+91 00000 00000',
        city: body.city || 'Central',
        address: body.address || null,
        categories: body.categories || 'General',
        gstin: body.gstin || null,
        paymentTerms: body.paymentTerms || 'Net 30',
        status: body.status || 'Active',
      },
      update: {
        name: body.name,
        ...(body.contactPerson ? { contactPerson: body.contactPerson } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.city ? { city: body.city } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.categories ? { categories: body.categories } : {}),
        ...(body.gstin !== undefined ? { gstin: body.gstin } : {}),
        ...(body.paymentTerms ? { paymentTerms: body.paymentTerms } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });

    return NextResponse.json({ success: true, vendor }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/vendors POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save vendor' }, { status: 500 });
  }
}

/**
 * PUT /api/vendors - Update existing vendor
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    const vendor = await (prisma as any).vendor.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.contactPerson ? { contactPerson: body.contactPerson } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.city ? { city: body.city } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });

    return NextResponse.json({ success: true, vendor });
  } catch (error: any) {
    console.error('API /api/vendors PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update vendor' }, { status: 500 });
  }
}

/**
 * DELETE /api/vendors - Safe Archive or Permanent Delete for unused vendors
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
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    let target = await (prisma as any).vendor.findUnique({ where: { id } }).catch(() => null);
    if (!target) {
      target = await (prisma as any).vendor.findFirst({ where: { code: id } });
    }

    if (!target) {
      return NextResponse.json({ success: true, message: 'Vendor already deleted or non-existent' });
    }

    // Check linked purchase orders
    const poCount = await (prisma as any).purchaseOrder.count({ where: { vendorId: target.id } });

    if (poCount > 0 || !permanent || user.role !== 'Super Admin') {
      const vendor = await (prisma as any).vendor.update({
        where: { id: target.id },
        data: { status: 'Archived' },
      });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        vendor,
        hasHistory: poCount > 0,
        message: poCount > 0
          ? `Vendor "${target.name}" has ${poCount} historical purchase orders and was archived safely.`
          : `Vendor "${target.name}" archived successfully.`,
      });
    }

    // Hard delete unused vendor
    await (prisma as any).vendor.delete({ where: { id: target.id } });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Vendor "${target.name}" permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('API /api/vendors DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to archive/delete vendor' }, { status: 500 });
  }
}

