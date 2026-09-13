import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/vendors - Retrieve all vendors with authoritative, reconciled financial payables
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const vendorId = searchParams.get('id');

    const whereClause: any = {};
    if (vendorId) {
      whereClause.id = vendorId;
    } else if (!includeArchived) {
      whereClause.status = { not: 'Archived' };
    }

    const vendors = await (prisma as any).vendor.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        purchases: {
          where: {
            status: { notIn: ['Cancelled', 'Archived'] },
          },
          select: {
            id: true,
            poNo: true,
            invoiceNo: true,
            totalCost: true,
            paidAmount: true,
            creditAmount: true,
            paymentStatus: true,
            status: true,
            orderDate: true,
            expectedDate: true,
            dueDate: true,
          },
        },
      },
    });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Reconcile financial figures exactly: Total Bill - Valid Payments - Credits = Outstanding Balance
    const vendorsWithPayable = vendors.map((v: any) => {
      let totalBilledAmount = 0;
      let totalPaidAmount = 0;
      let totalCreditsAmount = 0;
      let outstandingPayable = 0;
      let unpaidBillsCount = 0;
      let overdueBillsCount = 0;

      v.purchases?.forEach((po: any) => {
        const cost = Number(po.totalCost) || 0;
        const paid = Number(po.paidAmount) || 0;
        const credit = Number(po.creditAmount) || 0;
        const remaining = Math.max(0, cost - paid - credit);

        totalBilledAmount += cost;
        totalPaidAmount += paid;
        totalCreditsAmount += credit;
        outstandingPayable += remaining;

        if (remaining > 0.005) {
          unpaidBillsCount++;
          const effDue = po.dueDate || po.expectedDate;
          if (effDue) {
            const dueD = new Date(effDue);
            const dueMidnight = new Date(dueD.getFullYear(), dueD.getMonth(), dueD.getDate()).getTime();
            if (todayMidnight > dueMidnight) {
              overdueBillsCount++;
            }
          }
        }
      });

      const { purchases: _, ...vendorData } = v;
      return {
        ...vendorData,
        totalBilledAmount: Math.round(totalBilledAmount * 100) / 100,
        totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
        totalCreditsAmount: Math.round(totalCreditsAmount * 100) / 100,
        outstandingPayable: Math.round(outstandingPayable * 100) / 100,
        totalBillsCount: v.purchases?.length || 0,
        unpaidBillsCount,
        overdueBillsCount,
      };
    });

    return NextResponse.json(
      { success: true, vendors: vendorsWithPayable },
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
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to create vendor' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const cleanGstin = (body.gstin || '').trim().toUpperCase();
    if (cleanGstin && cleanGstin !== 'PENDING' && !gstinRegex.test(cleanGstin)) {
      return NextResponse.json({ 
        error: 'Invalid Indian GSTIN format. If provided, it must be 15 alphanumeric characters (e.g. 29ABCDE1234F1Z5)' 
      }, { status: 400 });
    }

    const count = await (prisma as any).vendor.count();
    const code = body.code || `VND-${String(count + 1).padStart(4, '0')}`;

    const vendor = await (prisma as any).vendor.upsert({
      where: { code },
      create: {
        code,
        name: body.name.trim(),
        contactPerson: body.contactPerson?.trim() || 'Account Manager',
        email: body.email?.trim() || `${body.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@vendor.com`,
        phone: body.phone?.trim() || '+91 00000 00000',
        city: body.city?.trim() || 'Central',
        address: body.address?.trim() || null,
        categories: body.categories?.trim() || body.category?.trim() || 'General',
        gstin: cleanGstin,
        leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : 3,
        rating: body.rating ? Number(body.rating) : 5.0,
        paymentTerms: body.paymentTerms?.trim() || 'Net 30',
        status: body.status || 'Active',
      },
      update: {
        name: body.name.trim(),
        ...(body.contactPerson ? { contactPerson: body.contactPerson.trim() } : {}),
        ...(body.email ? { email: body.email.trim() } : {}),
        ...(body.phone ? { phone: body.phone.trim() } : {}),
        ...(body.city ? { city: body.city.trim() } : {}),
        ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
        ...(body.categories || body.category ? { categories: (body.categories || body.category).trim() } : {}),
        gstin: cleanGstin,
        ...(body.leadTimeDays !== undefined ? { leadTimeDays: Number(body.leadTimeDays) } : {}),
        ...(body.rating !== undefined ? { rating: Number(body.rating) } : {}),
        ...(body.paymentTerms ? { paymentTerms: body.paymentTerms.trim() } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });

    // Write audit log
    await (prisma as any).auditLog.create({
      data: {
        module: 'Vendors',
        action: 'Onboard Vendor',
        details: `Onboarded vendor "${vendor.name}" (${vendor.code}). GSTIN: ${cleanGstin || 'None'}, Terms: ${vendor.paymentTerms}`,
        userEmail: user.email || user.name,
        userRole: user.role,
        storeCode: 'CENTRAL',
      },
    });

    broadcastRealtimeEvent('vendors', 'VENDOR_UPDATED', { id: vendor.id, code: vendor.code, name: vendor.name, action: 'saved' });

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

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to update vendor' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (body.gstin !== undefined && body.gstin !== null) {
      const cleanGstin = String(body.gstin).trim().toUpperCase();
      if (cleanGstin && cleanGstin !== 'PENDING' && !gstinRegex.test(cleanGstin)) {
        return NextResponse.json({ 
          error: 'Invalid Indian GSTIN format. If provided, it must be 15 alphanumeric characters (e.g. 29ABCDE1234F1Z5)' 
        }, { status: 400 });
      }
      body.gstin = cleanGstin;
    }

    const vendor = await (prisma as any).vendor.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.contactPerson ? { contactPerson: body.contactPerson.trim() } : {}),
        ...(body.email ? { email: body.email.trim() } : {}),
        ...(body.phone ? { phone: body.phone.trim() } : {}),
        ...(body.city ? { city: body.city.trim() } : {}),
        ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
        ...(body.categories || body.category ? { categories: (body.categories || body.category).trim() } : {}),
        ...(body.gstin !== undefined ? { gstin: body.gstin } : {}),
        ...(body.leadTimeDays !== undefined ? { leadTimeDays: Number(body.leadTimeDays) } : {}),
        ...(body.rating !== undefined ? { rating: Number(body.rating) } : {}),
        ...(body.paymentTerms ? { paymentTerms: body.paymentTerms.trim() } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });

    // Write audit log
    await (prisma as any).auditLog.create({
      data: {
        module: 'Vendors',
        action: 'Update Vendor',
        details: `Updated vendor details for "${vendor.name}" (${vendor.code}).`,
        userEmail: user.email || user.name,
        userRole: user.role,
        storeCode: 'CENTRAL',
      },
    });

    broadcastRealtimeEvent('vendors', 'VENDOR_UPDATED', { id: vendor.id, code: vendor.code, name: vendor.name, action: 'updated' });

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
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to archive/delete vendor' }, { status: 403 });
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

    // Check linked purchase orders and financial records
    const poCount = await (prisma as any).purchaseOrder.count({ where: { vendorId: target.id } });

    if (poCount > 0 || !permanent || user.role !== 'Super Admin') {
      const vendor = await (prisma as any).vendor.update({
        where: { id: target.id },
        data: { status: 'Archived' },
      });

      await (prisma as any).auditLog.create({
        data: {
          module: 'Vendors',
          action: 'Archive Vendor',
          details: `Archived vendor "${target.name}" (${target.code}). Historical purchase orders linked: ${poCount}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: 'CENTRAL',
        },
      });

      broadcastRealtimeEvent('vendors', 'VENDOR_UPDATED', { id: target.id, code: target.code, name: target.name, action: 'archived' });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        vendor,
        hasHistory: poCount > 0,
        message: poCount > 0
          ? `Vendor "${target.name}" has ${poCount} linked purchase orders and was safely Archived to protect financial records.`
          : `Vendor "${target.name}" archived successfully.`,
      });
    }

    // Hard delete unused vendor (Super Admin only, zero POs)
    await (prisma as any).vendor.delete({ where: { id: target.id } });

    await (prisma as any).auditLog.create({
      data: {
        module: 'Vendors',
        action: 'Permanent Delete Vendor',
        details: `Permanently removed unused vendor "${target.name}" (${target.code}).`,
        userEmail: user.email || user.name,
        userRole: user.role,
        storeCode: 'CENTRAL',
      },
    });

    broadcastRealtimeEvent('vendors', 'VENDOR_UPDATED', { id: target.id, code: target.code, name: target.name, action: 'deleted' });

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
