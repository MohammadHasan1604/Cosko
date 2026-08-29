import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/inventory - Retrieve inventory with store filtering
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');

    const whereClause: any = {};
    if (user.role !== 'Super Admin') {
      whereClause.storeCode = user.store;
    } else if (store && store !== 'All Stores') {
      whereClause.storeCode = store;
    }

    const products = await (prisma as any).product.findMany({
      include: {
        inventoryItems: {
          where: whereClause,
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('API /api/inventory GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve inventory' }, { status: 500 });
  }
}

/**
 * POST /api/inventory - Create or update inventory product
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('cosko_session')?.value;
    const user = token ? verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to modify product inventory' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.name || !body.sku) {
      return NextResponse.json({ error: 'Product name and SKU are required' }, { status: 400 });
    }

    // Check duplicate barcode if provided
    if (body.barcode) {
      const duplicateBarcode = await (prisma as any).product.findFirst({
        where: { barcode: body.barcode, id: { not: body.id || '' } },
      });
      if (duplicateBarcode) {
        return NextResponse.json({ error: `Duplicate barcode: Already assigned to "${duplicateBarcode.name}"` }, { status: 409 });
      }
    }

    const product = await (prisma as any).product.upsert({
      where: { sku: body.sku },
      create: {
        sku: body.sku,
        barcode: body.barcode || null,
        name: body.name,
        brand: body.brand || 'COSKO',
        model: body.model || null,
        category: body.category || 'General',
        subcategory: body.subcategory || 'General',
        baseCostPrice: body.costPrice || 0,
        baseSellingPrice: body.sellingPrice || 0,
        gstRate: body.taxRate || 18.0,
        warrantyMonths: body.warrantyMonths || 12,
        status: body.status || 'active',
      },
      update: {
        name: body.name,
        barcode: body.barcode || null,
        brand: body.brand || 'COSKO',
        category: body.category || 'General',
        subcategory: body.subcategory || 'General',
        baseCostPrice: body.costPrice,
        baseSellingPrice: body.sellingPrice,
        gstRate: body.taxRate,
        warrantyMonths: body.warrantyMonths,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/inventory POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save product' }, { status: 500 });
  }
}
