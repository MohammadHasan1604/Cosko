import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/inventory - Retrieve inventory with store filtering (excludes deleted & archived products by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const store = searchParams.get('store');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const storeWhereClause: any = {};
    if (user.role !== 'Super Admin') {
      storeWhereClause.storeCode = user.store;
    } else if (store && store !== 'All Stores') {
      storeWhereClause.storeCode = store;
    }

    const productWhere: any = {};
    if (!includeArchived) {
      productWhere.status = { notIn: ['deleted', 'archived'] };
    }

    const products = await (prisma as any).product.findMany({
      where: productWhere,
      include: {
        inventoryItems: {
          where: storeWhereClause,
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(
      { success: true, products },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
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
    const user = getAuthUserFromRequest(req);

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

    const storeCode = body.store || (user.store !== 'All Stores' ? user.store : 'CENTRAL');
    const qtyOnHand = typeof body.qtyOnHand === 'number' ? body.qtyOnHand : 0;

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
        status: body.status || 'active',
      },
    });

    if (storeCode) {
      await (prisma as any).inventory.upsert({
        where: {
          productId_storeCode: {
            productId: product.id,
            storeCode: storeCode,
          },
        },
        create: {
          productId: product.id,
          storeCode: storeCode,
          qtyOnHand: qtyOnHand,
          reorderPt: body.reorderPt || 5,
        },
        update: {
          qtyOnHand: qtyOnHand,
          ...(body.reorderPt !== undefined ? { reorderPt: body.reorderPt } : {}),
        },
      });
    }

    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode, productId: product.id, sku: product.sku });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/inventory POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save product' }, { status: 500 });
  }
}

/**
 * PUT /api/inventory - Update an existing product
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const product = await (prisma as any).product.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.barcode !== undefined ? { barcode: body.barcode || null } : {}),
        ...(body.brand ? { brand: body.brand } : {}),
        ...(body.category ? { category: body.category } : {}),
        ...(body.subcategory ? { subcategory: body.subcategory } : {}),
        ...(body.costPrice !== undefined ? { baseCostPrice: body.costPrice } : {}),
        ...(body.sellingPrice !== undefined ? { baseSellingPrice: body.sellingPrice } : {}),
        ...(body.taxRate !== undefined ? { gstRate: body.taxRate } : {}),
        ...(body.warrantyMonths !== undefined ? { warrantyMonths: body.warrantyMonths } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });

    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { productId: product.id, sku: product.sku });

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('API /api/inventory PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
  }
}

/**
 * DELETE /api/inventory - Safe Archive or Permanent Delete for unused products
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level to archive or delete products' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Product ID or SKU is required' }, { status: 400 });
    }

    // Try finding by id first, then by sku
    let target = await (prisma as any).product.findUnique({ where: { id } }).catch(() => null);
    if (!target) {
      target = await (prisma as any).product.findFirst({ where: { sku: id } });
    }

    if (!target) {
      return NextResponse.json({ success: true, message: 'Product already deleted or non-existent' });
    }

    // Check historical dependencies
    const [salesCount, poCount, transferCount, ledgerCount] = await Promise.all([
      (prisma as any).salesOrderItem.count({ where: { productId: target.id } }),
      (prisma as any).purchaseOrderItem.count({ where: { productId: target.id } }),
      (prisma as any).stockTransferItem.count({ where: { productId: target.id } }),
      (prisma as any).inventoryLedger.count({ where: { productId: target.id } }),
    ]);

    const hasHistory = (salesCount + poCount + transferCount + ledgerCount) > 0;

    // If product has historical records, NEVER hard-delete. Must ARCHIVE.
    if (hasHistory || !permanent || user.role !== 'Super Admin') {
      const product = await (prisma as any).product.update({
        where: { id: target.id },
        data: { status: 'archived' },
      });

      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { productId: target.id, sku: target.sku, action: 'archived' });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        product,
        hasHistory,
        message: hasHistory
          ? `Product "${target.name}" has transaction history (${salesCount} sales, ${poCount} purchases, ${transferCount} transfers, ${ledgerCount} ledger movements) and was archived safely.`
          : `Product "${target.name}" archived successfully.`,
      });
    }

    // Permanent hard-delete for unused products with 0 history by Super Admin
    await (prisma as any).inventory.deleteMany({ where: { productId: target.id } });
    await (prisma as any).product.delete({ where: { id: target.id } });

    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { productId: target.id, sku: target.sku, action: 'deleted' });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Product "${target.name}" (${target.sku}) permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('API /api/inventory DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to archive/delete product' }, { status: 500 });
  }
}


