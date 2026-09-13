import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/inventory - Retrieve inventory with store filtering (excludes deleted & archived products by default)
 * Also supports ?id=... or ?sku=... to retrieve a single authoritative product record with all store inventory items.
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const sku = searchParams.get('sku');

    // ─── SINGLE PRODUCT FETCH (For Edit Product Form & Details) ─────────────
    if (id || sku) {
      const product = await prisma.product.findFirst({
        where: id ? { OR: [{ id }, { sku: id }] } : { sku: sku! },
        include: {
          inventoryItems: true,
        },
      });

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json(
        { success: true, product },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      );
    }

    // ─── LIST QUERY WITH STORE FILTERING ────────────────────────────────────
    const store = searchParams.get('store');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const productWhere: any = {};
    if (!includeArchived) {
      productWhere.status = { notIn: ['deleted', 'archived'] };
    }

    const storeWhereClause: any = {};
    if (user.role !== 'Super Admin') {
      if (store && store !== user.store && !user.allowedStores?.includes(store)) {
        return NextResponse.json(
          { error: `Forbidden: You do not have permission to view inventory for store "${store}"` },
          { status: 403 }
        );
      }
      storeWhereClause.storeCode = user.store;
      productWhere.inventoryItems = { some: { storeCode: user.store } };
    } else if (store && store !== 'All Stores' && store !== 'ALL') {
      storeWhereClause.storeCode = store;
      productWhere.inventoryItems = { some: { storeCode: store } };
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        inventoryItems: {
          where: storeWhereClause,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      { success: true, products },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    console.error('API /api/inventory GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve inventory' }, { status: 500 });
  }
}

/**
 * POST /api/inventory - Create or update inventory product
 * Full field persistence: sku, name, brand, model, category, subcategory,
 * costPrice, sellingPrice, mrp, taxRate, warrantyMonths, imageUrl, description,
 * status, barcode, store, qtyOnHand, reorderPt.
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

    const cleanSku = body.sku.trim().toUpperCase();
    const cleanBarcode = body.barcode?.trim() || null;

    // Check duplicate barcode if provided
    if (cleanBarcode) {
      const duplicateBarcode = await prisma.product.findFirst({
        where: { barcode: cleanBarcode, sku: { not: cleanSku } },
      });
      if (duplicateBarcode) {
        return NextResponse.json({ error: `Duplicate barcode: Already assigned to "${duplicateBarcode.name}"` }, { status: 409 });
      }
    }

    if (body.store === 'All Stores' || body.store === 'ALL') {
      return NextResponse.json(
        { error: '"All Stores" is a reporting/aggregation scope only. Physical inventory must be assigned to a specific store location or Central Warehouse (e.g., CENTRAL, BLR, MUM).' },
        { status: 400 }
      );
    }

    const storeCode = body.store || (user.store && user.store !== 'All Stores' && user.store !== 'ALL' ? user.store : 'CENTRAL');
    const qtyOnHand = typeof body.qtyOnHand === 'number' ? body.qtyOnHand : (Number(body.qtyOnHand) || 0);
    const reorderPt = typeof body.reorderPt === 'number' ? body.reorderPt : (Number(body.reorderPt) || 5);
    const costPrice = body.costPrice !== undefined ? Number(body.costPrice) : 0;
    const sellingPrice = body.sellingPrice !== undefined ? Number(body.sellingPrice) : 0;
    const mrp = body.mrp !== undefined && body.mrp !== null && body.mrp !== '' ? Number(body.mrp) : null;
    const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : 0;
    const warrantyMonths = body.warrantyMonths !== undefined ? Number(body.warrantyMonths) : 0;
    const imageUrl = body.imageUrl || body.primaryImage || (Array.isArray(body.images) && body.images[0]) || null;
    const description = body.description?.trim() || null;

    const product = await prisma.product.upsert({
      where: { sku: cleanSku },
      create: {
        sku: cleanSku,
        barcode: cleanBarcode,
        name: body.name.trim(),
        brand: body.brand?.trim() || null,
        model: body.model?.trim() || null,
        category: body.category || 'General',
        subcategory: body.subcategory?.trim() || null,
        description: description,
        baseCostPrice: costPrice,
        baseSellingPrice: sellingPrice,
        mrp: mrp,
        gstRate: taxRate,
        warrantyMonths: warrantyMonths,
        imageUrl: imageUrl,
        status: body.status || 'active',
      },
      update: {
        name: body.name.trim(),
        barcode: cleanBarcode,
        brand: body.brand?.trim() || null,
        model: body.model?.trim() || null,
        category: body.category || 'General',
        subcategory: body.subcategory?.trim() || null,
        description: description,
        baseCostPrice: costPrice,
        baseSellingPrice: sellingPrice,
        mrp: mrp,
        gstRate: taxRate,
        warrantyMonths: warrantyMonths,
        imageUrl: imageUrl,
        status: body.status || 'active',
      },
    });

    if (storeCode) {
      await prisma.inventory.upsert({
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
          reorderPt: reorderPt,
        },
        update: {
          qtyOnHand: qtyOnHand,
          reorderPt: reorderPt,
        },
      });

      if (qtyOnHand > 0) {
        await prisma.inventoryLedger.create({
          data: {
            productId: product.id,
            storeCode: storeCode,
            refNo: `INIT-${product.sku}-${Date.now().toString().slice(-6)}`,
            type: 'PURCHASE',
            qtyChange: qtyOnHand,
            costPerUnit: product.baseCostPrice,
            sellingPricePerUnit: product.baseSellingPrice,
            balanceAfter: qtyOnHand,
            notes: `Initial catalog registration for ${product.name} (${product.sku}) at ${storeCode}`,
            createdBy: user.name || user.email,
          },
        }).catch((err) => console.warn('Ledger init logging warning:', err));
      }
    }

    const savedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        inventoryItems: true,
      },
    });

    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode, productId: product.id, sku: product.sku });

    return NextResponse.json({ success: true, product: savedProduct }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/inventory POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save product' }, { status: 500 });
  }
}

/**
 * PUT /api/inventory - Update an existing product and its inventory record
 * Resolves product by ID, inventory ID, or SKU.
 * Updates ONLY provided fields without wiping untouched existing data.
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
    const targetId = body.productId || body.id;

    if (!targetId && !body.sku) {
      return NextResponse.json({ error: 'Product ID or SKU is required for update' }, { status: 400 });
    }

    // Resolve product reliably (whether body.id is product.id or inventory.id or sku)
    let product: any = null;
    if (targetId) {
      product = await prisma.product.findUnique({ where: { id: targetId } }).catch(() => null);
      if (!product) {
        // Check if targetId is an inventory record ID
        const inv = await prisma.inventory.findUnique({ where: { id: targetId } }).catch(() => null);
        if (inv) {
          product = await prisma.product.findUnique({ where: { id: inv.productId } }).catch(() => null);
        }
      }
    }

    if (!product && body.sku) {
      product = await prisma.product.findUnique({ where: { sku: body.sku } }).catch(() => null);
    }

    if (!product) {
      return NextResponse.json({ error: 'Product record not found in database' }, { status: 404 });
    }

    // Check duplicate barcode if barcode is being updated
    if (body.barcode !== undefined && body.barcode !== null && body.barcode.trim() !== '') {
      const cleanBarcode = body.barcode.trim();
      const duplicateBarcode = await prisma.product.findFirst({
        where: { barcode: cleanBarcode, id: { not: product.id } },
      });
      if (duplicateBarcode) {
        return NextResponse.json({ error: `Duplicate barcode: Already assigned to "${duplicateBarcode.name}"` }, { status: 409 });
      }
    }

    // Build update payload dynamically so UNTOUCHED fields are preserved
    const productUpdate: any = {};
    if (body.name !== undefined && body.name.trim() !== '') productUpdate.name = body.name.trim();
    if (body.barcode !== undefined) productUpdate.barcode = body.barcode ? body.barcode.trim() : null;
    if (body.brand !== undefined) productUpdate.brand = body.brand ? body.brand.trim() : null;
    if (body.model !== undefined) productUpdate.model = body.model ? body.model.trim() : null;
    if (body.category !== undefined && body.category.trim() !== '') productUpdate.category = body.category.trim();
    if (body.subcategory !== undefined) productUpdate.subcategory = body.subcategory ? body.subcategory.trim() : null;
    if (body.description !== undefined) productUpdate.description = body.description ? body.description.trim() : null;
    if (body.costPrice !== undefined) productUpdate.baseCostPrice = Number(body.costPrice);
    if (body.sellingPrice !== undefined) productUpdate.baseSellingPrice = Number(body.sellingPrice);
    if (body.mrp !== undefined) productUpdate.mrp = (body.mrp !== null && body.mrp !== '') ? Number(body.mrp) : null;
    if (body.taxRate !== undefined) productUpdate.gstRate = Number(body.taxRate);
    if (body.warrantyMonths !== undefined) productUpdate.warrantyMonths = Number(body.warrantyMonths);
    if (body.imageUrl !== undefined || body.primaryImage !== undefined || body.images !== undefined) {
      const img = body.imageUrl || body.primaryImage || (Array.isArray(body.images) ? body.images[0] : null);
      if (img !== undefined) productUpdate.imageUrl = img || null;
    }
    if (body.status !== undefined) productUpdate.status = body.status;

    if (Object.keys(productUpdate).length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: productUpdate,
      });
    }

    // Update store inventory if store, quantity, or reorder point was provided
    const storeCode = body.store || body.storeCode;
    if (storeCode && storeCode !== 'All Stores' && storeCode !== 'ALL') {
      const invWhere = {
        productId_storeCode: {
          productId: product.id,
          storeCode: storeCode,
        },
      };

      const existingInv = await prisma.inventory.findUnique({ where: invWhere }).catch(() => null);
      const invUpdate: any = {};
      if (body.qtyOnHand !== undefined) invUpdate.qtyOnHand = Number(body.qtyOnHand);
      if (body.reorderPt !== undefined) invUpdate.reorderPt = Number(body.reorderPt);

      if (existingInv) {
        if (Object.keys(invUpdate).length > 0) {
          await prisma.inventory.update({
            where: invWhere,
            data: invUpdate,
          });

          // If quantity was modified, record an adjustment entry
          if (body.qtyOnHand !== undefined && body.qtyOnHand !== existingInv.qtyOnHand) {
            const diff = Number(body.qtyOnHand) - existingInv.qtyOnHand;
            await prisma.inventoryLedger.create({
              data: {
                productId: product.id,
                storeCode: storeCode,
                refNo: `ADJ-${product.sku}-${Date.now().toString().slice(-6)}`,
                type: 'ADJUSTMENT',
                qtyChange: diff,
                costPerUnit: productUpdate.baseCostPrice || product.baseCostPrice,
                sellingPricePerUnit: productUpdate.baseSellingPrice || product.baseSellingPrice,
                balanceAfter: Number(body.qtyOnHand),
                notes: `Stock quantity edited via Edit Product (${diff > 0 ? `+${diff}` : diff} units)`,
                createdBy: user.name || user.email,
              },
            }).catch((err) => console.warn('Ledger adjustment logging warning:', err));
          }
        }
      } else if (body.qtyOnHand !== undefined) {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            storeCode: storeCode,
            qtyOnHand: Number(body.qtyOnHand) || 0,
            reorderPt: Number(body.reorderPt) || 5,
          },
        });
      }
    }

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        inventoryItems: true,
      },
    });

    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { productId: product.id, sku: product.sku });

    return NextResponse.json({ success: true, product: updatedProduct });
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
    let target = await prisma.product.findUnique({ where: { id } }).catch(() => null);
    if (!target) {
      target = await prisma.product.findFirst({ where: { sku: id } });
    }
    if (!target) {
      // Check if id is an inventory id
      const inv = await prisma.inventory.findUnique({ where: { id } }).catch(() => null);
      if (inv) {
        target = await prisma.product.findUnique({ where: { id: inv.productId } });
      }
    }
    if (!target && id.includes('-')) {
      const parts = id.split('-');
      // Standard UUID is 5 segments: 8-4-4-4-12. If store or UNASSIGNED was appended, parts.length > 5
      if (parts.length > 5) {
        const candidateUuid = parts.slice(0, 5).join('-');
        target = await prisma.product.findUnique({ where: { id: candidateUuid } }).catch(() => null);
      }
      if (!target) {
        target = await prisma.product.findUnique({ where: { id: parts[0] } }).catch(() => null);
      }
    }

    if (!target) {
      return NextResponse.json({ success: true, message: 'Product already deleted or non-existent' });
    }

    // Check historical dependencies
    const [salesCount, poCount, transferCount, ledgerCount] = await Promise.all([
      prisma.salesOrderItem.count({ where: { productId: target.id } }),
      prisma.purchaseOrderItem.count({ where: { productId: target.id } }),
      prisma.stockTransferItem.count({ where: { productId: target.id } }),
      prisma.inventoryLedger.count({ where: { productId: target.id } }),
    ]);

    const hasHistory = (salesCount + poCount + transferCount + ledgerCount) > 0;

    // If product has historical records, NEVER hard-delete. Must ARCHIVE.
    if (hasHistory || !permanent || user.role !== 'Super Admin') {
      const product = await prisma.product.update({
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
    await prisma.inventory.deleteMany({ where: { productId: target.id } });
    await prisma.product.delete({ where: { id: target.id } });

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
