import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { executeWithIdempotency } from '@/lib/idempotency';

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

      // Fetch active stores dynamically to provide complete store stock breakdown (Super Admin gets all stores, others get only their assigned stores)
      const allowedStoresList = user.allowedStores && user.allowedStores.length > 0 ? user.allowedStores : [user.store];
      const storesWhere = user.role === 'Super Admin'
        ? { status: 'Active' }
        : { status: 'Active', code: { in: allowedStoresList } };
      const activeStores = await prisma.storeHub.findMany({
        where: storesWhere,
      });
      activeStores.sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)));

      const storeStock = activeStores.map((s) => {
        const inv = product.inventoryItems.find((it) => it.storeCode.toUpperCase() === s.code.toUpperCase());
        return {
          storeCode: s.code,
          storeName: s.name,
          city: s.city,
          qtyOnHand: inv ? inv.qtyOnHand : 0,
          qtyReserved: inv ? inv.qtyReserved : 0,
          reorderPt: inv ? inv.reorderPt : 5,
        };
      });

      return NextResponse.json(
        { success: true, product, storeStock },
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
      const allowed = user.allowedStores && user.allowedStores.length > 0 ? user.allowedStores : [user.store];
      if (store) {
        if (store === 'All Stores' || store === 'ALL') {
          return NextResponse.json(
            { error: 'Forbidden: Consolidated view across all stores is restricted to Super Admin only' },
            { status: 403 }
          );
        }
        if (!allowed.includes(store)) {
          return NextResponse.json(
            { error: `Forbidden: Cross-store inventory queries are restricted to Super Admin accounts only` },
            { status: 403 }
          );
        }
        storeWhereClause.storeCode = store;
        productWhere.inventoryItems = { some: { storeCode: store } };
      } else {
        storeWhereClause.storeCode = { in: allowed };
        productWhere.inventoryItems = { some: { storeCode: { in: allowed } } };
      }
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

    const customKey =
      body.idempotencyKey ||
      req.headers.get('x-idempotency-key') ||
      `prod_${cleanSku}_${Date.now()}`;

    return await executeWithIdempotency<any>(
      req,
      {
        action: 'CREATE_PRODUCT',
        key: customKey,
        userId: user.id,
        extractEntityId: (d) => d?.product?.id || d?.product?.sku,
      },
      async () => {
        // Check duplicate barcode if provided
        if (cleanBarcode) {
          const duplicateBarcode = await prisma.product.findFirst({
            where: { barcode: cleanBarcode, sku: { not: cleanSku } },
          });
          if (duplicateBarcode) {
            throw new Error(`Duplicate barcode: Already assigned to "${duplicateBarcode.name}"`);
          }
        }

        if (body.store === 'All Stores' || body.store === 'ALL') {
          return {
            status: 400,
            data: { error: '"All Stores" is a reporting/aggregation scope only. Physical inventory must be assigned to a specific store location or Central Warehouse (e.g., CENTRAL, BLR, MUM).' }
          };
        }

        if (user.role !== 'Super Admin' && body.store && body.store !== user.store) {
          return {
            status: 403,
            data: { error: `Forbidden: As ${user.role}, you are restricted to store "${user.store}". Cannot modify inventory for store "${body.store}".` }
          };
        }
        const storeCode = user.role === 'Super Admin' ? (body.store || 'CENTRAL') : user.store;
        const qtyOnHand = typeof body.qtyOnHand === 'number' ? body.qtyOnHand : (body.qtyOnHand !== undefined && body.qtyOnHand !== null && body.qtyOnHand !== '' ? Number(body.qtyOnHand) : 0);
        const reorderPt = typeof body.reorderPt === 'number' ? body.reorderPt : (body.reorderPt !== undefined && body.reorderPt !== null && body.reorderPt !== '' ? Number(body.reorderPt) : 5);

        if (body.costPrice === undefined || body.costPrice === null || body.costPrice === '') {
          return { status: 400, data: { error: 'Cost price is required' } };
        }
        if (body.sellingPrice === undefined || body.sellingPrice === null || body.sellingPrice === '') {
          return { status: 400, data: { error: 'Selling price is required' } };
        }
        const costPrice = Number(body.costPrice);
        const sellingPrice = Number(body.sellingPrice);
        if (isNaN(costPrice) || isNaN(sellingPrice)) {
          return { status: 400, data: { error: 'Cost price and selling price must be valid numbers' } };
        }

        const mrp = body.mrp !== undefined && body.mrp !== null && body.mrp !== '' ? Number(body.mrp) : null;
        const taxRate = body.taxRate !== undefined && body.taxRate !== null && body.taxRate !== '' ? Number(body.taxRate) : 0;
        const warrantyMonths = body.warrantyMonths !== undefined && body.warrantyMonths !== null && body.warrantyMonths !== '' ? Number(body.warrantyMonths) : 0;
        const imageUrl = body.imageUrl || body.primaryImage || (Array.isArray(body.images) && body.images[0]) || null;
        const description = body.description?.trim() || null;

        const savedProduct = await prisma.$transaction(async (tx: any) => {
          const product = await tx.product.upsert({
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
            await tx.inventory.upsert({
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
              await tx.inventoryLedger.create({
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
              });
            }
          }

          return tx.product.findUnique({
            where: { id: product.id },
            include: {
              inventoryItems: true,
            },
          });
        });

        broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode, productId: savedProduct?.id, sku: savedProduct?.sku });

        return {
          status: 201,
          data: { success: true, product: savedProduct },
        };
      }
    );
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
    if (body.costPrice !== undefined && body.costPrice !== null && body.costPrice !== '') productUpdate.baseCostPrice = Number(body.costPrice);
    if (body.sellingPrice !== undefined && body.sellingPrice !== null && body.sellingPrice !== '') productUpdate.baseSellingPrice = Number(body.sellingPrice);
    if (body.mrp !== undefined) productUpdate.mrp = (body.mrp !== null && body.mrp !== '') ? Number(body.mrp) : null;
    if (body.taxRate !== undefined) productUpdate.gstRate = (body.taxRate !== null && body.taxRate !== '') ? Number(body.taxRate) : null;
    if (body.warrantyMonths !== undefined) productUpdate.warrantyMonths = (body.warrantyMonths !== null && body.warrantyMonths !== '') ? Number(body.warrantyMonths) : null;
    if (body.imageUrl !== undefined || body.primaryImage !== undefined || body.images !== undefined) {
      const img = body.imageUrl || body.primaryImage || (Array.isArray(body.images) ? body.images[0] : null);
      if (img !== undefined) productUpdate.imageUrl = img || null;
    }
    if (body.status !== undefined) productUpdate.status = body.status;

    const updatedProduct = await prisma.$transaction(async (tx: any) => {
      if (Object.keys(productUpdate).length > 0) {
        await tx.product.update({
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

        const existingInv = await tx.inventory.findUnique({ where: invWhere }).catch(() => null);
        const invUpdate: any = {};
        if (body.qtyOnHand !== undefined) invUpdate.qtyOnHand = Number(body.qtyOnHand);
        if (body.reorderPt !== undefined) invUpdate.reorderPt = Number(body.reorderPt);

        if (existingInv) {
          if (Object.keys(invUpdate).length > 0) {
            await tx.inventory.update({
              where: invWhere,
              data: invUpdate,
            });

            // If quantity was modified, record an adjustment entry
            if (body.qtyOnHand !== undefined && body.qtyOnHand !== existingInv.qtyOnHand) {
              const diff = Number(body.qtyOnHand) - existingInv.qtyOnHand;
              await tx.inventoryLedger.create({
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
              });
            }
          }
        } else if (body.qtyOnHand !== undefined) {
          await tx.inventory.create({
            data: {
              productId: product.id,
              storeCode: storeCode,
              qtyOnHand: Number(body.qtyOnHand) || 0,
              reorderPt: Number(body.reorderPt) || 5,
            },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          inventoryItems: true,
        },
      });
    }, { maxWait: 15000, timeout: 45000 });

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

    // Permanent hard-delete for unused products with 0 history by Super Admin wrapped in atomic transaction
    await prisma.$transaction(async (tx: any) => {
      await tx.inventory.deleteMany({ where: { productId: target.id } });
      await tx.product.delete({ where: { id: target.id } });
    }, { maxWait: 15000, timeout: 45000 });

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
