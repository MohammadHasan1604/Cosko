import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { executePOSCheckout, CreateSaleInput } from '@/lib/services/salesService';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/sales - Retrieve sales orders with store isolation
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedStore = searchParams.get('store');

    // Store isolation check
    let storeFilter: string | undefined = undefined;
    if (user.role !== 'Super Admin') {
      storeFilter = user.store;
    } else if (requestedStore && requestedStore !== 'All Stores' && requestedStore !== 'ALL') {
      storeFilter = requestedStore;
    }

    const whereClause: any = {};
    if (storeFilter) {
      whereClause.storeCode = storeFilter;
    }

    const sales = await prisma.salesOrder.findMany({
      where: whereClause,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(
      { success: true, sales },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/sales GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve sales records' }, { status: 500 });
  }
}

/**
 * POST /api/sales - Execute POS Checkout atomically
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateSaleInput = await req.json();

    if (body.storeCode === 'All Stores' || body.storeCode === 'ALL') {
      return NextResponse.json(
        { error: '"All Stores" is a reporting scope only. Sales must be processed under a real store outlet or Central Warehouse.' },
        { status: 400 }
      );
    }

    // Verify cashier store authorization
    if (user.role !== 'Super Admin' && user.store !== body.storeCode) {
      return NextResponse.json({ error: 'Store Scope Lock: Cashier cannot execute sales for unauthorized store' }, { status: 403 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Cart cannot be empty' }, { status: 400 });
    }

    const sale = await executePOSCheckout({
      ...body,
      cashierName: user.name,
    });

    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/sales POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process checkout transaction' }, { status: 500 });
  }
}

/**
 * PUT /api/sales - Update sales order status (e.g. Void/Refund) and restock inventory
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to modify sales orders' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, notes, paymentMethod } = body;

    if (!id) {
      return NextResponse.json({ error: 'Sales Order ID is required' }, { status: 400 });
    }

    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    // Check store scope
    if (user.role !== 'Super Admin' && user.store !== existing.storeCode) {
      return NextResponse.json({ error: 'Store Scope Lock: You cannot modify orders from another store' }, { status: 403 });
    }

    const isVoidingOrRefunding =
      existing.status === 'Completed' &&
      (status === 'Cancelled' || status === 'Refunded' || status === 'Voided');

    const updatedSale = await prisma.$transaction(async (tx: any) => {
      // If voiding or refunding a completed sale, restock inventory and revert customer totals
      if (isVoidingOrRefunding && existing.items && existing.items.length > 0) {
        for (const item of existing.items) {
          const inv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: item.productId, storeCode: existing.storeCode } },
          });
          const prevQty = inv ? inv.qtyOnHand : 0;
          const newQty = prevQty + item.qty;

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: item.productId, storeCode: existing.storeCode } },
            create: { productId: item.productId, storeCode: existing.storeCode, qtyOnHand: newQty, reorderPt: 5 },
            update: { qtyOnHand: newQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: item.productId,
              storeCode: existing.storeCode,
              refNo: existing.orderNo,
              type: 'POS Sale Refund / Void In',
              qtyChange: item.qty,
              costPerUnit: item.unitCost,
              sellingPricePerUnit: item.unitPrice,
              balanceAfter: newQty,
              notes: `Order ${existing.orderNo} ${status} by ${user.name}`,
              createdBy: user.name,
            },
          });
        }

        // Decrement customer total spend if linked
        if (existing.customerId) {
          const cust = await tx.customer.findUnique({ where: { id: existing.customerId } });
          if (cust) {
            await tx.customer.update({
              where: { id: cust.id },
              data: {
                totalSpent: Math.max(0, Number(cust.totalSpent) - Number(existing.grandTotal)),
                totalOrders: Math.max(0, (cust.totalOrders || 1) - 1),
              },
            });
          }
        }

        // Record Financial Ledger Reversal Entries
        const netRev = Number(existing.subtotal) - Number(existing.discountAmount || 0);
        const taxAmt = Number(existing.taxAmount || 0);
        const gTotal = Number(existing.grandTotal);
        const cogsAmt = Number(existing.totalCost);

        await tx.financialLedgerEntry.create({
          data: {
            entryNo: `JRN-VOID-REV-${existing.orderNo}-${Date.now().toString().slice(-4)}`,
            entryDate: new Date(),
            storeCode: existing.storeCode,
            accountCategory: 'REVENUE',
            accountName: 'Sales Returns & Refunds',
            debit: netRev,
            credit: 0,
            amount: -netRev,
            refType: 'SALE',
            refId: existing.id,
            refNo: existing.orderNo,
            entityName: existing.customerName || 'Customer',
            description: `Order ${existing.orderNo} ${status} reversal by ${user.name}`,
            createdBy: user.name,
          },
        });

        if (taxAmt > 0) {
          await tx.financialLedgerEntry.create({
            data: {
              entryNo: `JRN-VOID-TAX-${existing.orderNo}-${Date.now().toString().slice(-4)}`,
              entryDate: new Date(),
              storeCode: existing.storeCode,
              accountCategory: 'LIABILITY',
              accountName: 'GST Output Tax Liability (Reversal)',
              debit: taxAmt,
              credit: 0,
              amount: -taxAmt,
              refType: 'SALE',
              refId: existing.id,
              refNo: existing.orderNo,
              entityName: existing.customerName || 'Customer',
              description: `GST Reversal on Order ${existing.orderNo} ${status}`,
              createdBy: user.name,
            },
          });
        }

        await tx.financialLedgerEntry.create({
          data: {
            entryNo: `JRN-VOID-ASST-${existing.orderNo}-${Date.now().toString().slice(-4)}`,
            entryDate: new Date(),
            storeCode: existing.storeCode,
            accountCategory: 'ASSET',
            accountName: `Cash / Bank Refund (${existing.paymentMethod})`,
            debit: 0,
            credit: gTotal,
            amount: -gTotal,
            refType: 'SALE',
            refId: existing.id,
            refNo: existing.orderNo,
            entityName: existing.customerName || 'Customer',
            description: `Refund payout for Order ${existing.orderNo}`,
            createdBy: user.name,
          },
        });

        if (cogsAmt > 0) {
          await tx.financialLedgerEntry.create({
            data: {
              entryNo: `JRN-VOID-COGS-${existing.orderNo}-${Date.now().toString().slice(-4)}`,
              entryDate: new Date(),
              storeCode: existing.storeCode,
              accountCategory: 'COGS',
              accountName: 'Cost of Goods Sold (Reversal)',
              debit: 0,
              credit: cogsAmt,
              amount: -cogsAmt,
              refType: 'SALE',
              refId: existing.id,
              refNo: existing.orderNo,
              entityName: existing.customerName || 'Customer',
              description: `COGS Reversal on Order ${existing.orderNo} ${status}`,
              createdBy: user.name,
            },
          });

          await tx.financialLedgerEntry.create({
            data: {
              entryNo: `JRN-VOID-INVR-${existing.orderNo}-${Date.now().toString().slice(-4)}`,
              entryDate: new Date(),
              storeCode: existing.storeCode,
              accountCategory: 'ASSET',
              accountName: 'Inventory Asset (Restocked)',
              debit: cogsAmt,
              credit: 0,
              amount: cogsAmt,
              refType: 'SALE',
              refId: existing.id,
              refNo: existing.orderNo,
              entityName: existing.customerName || 'Customer',
              description: `Stock Restocked for Voided/Refunded Order ${existing.orderNo}`,
              createdBy: user.name,
            },
          });
        }

        // Log to Audit Log
        await tx.auditLog.create({
          data: {
            module: 'Sales',
            action: `Order ${status}`,
            details: `Voided/refunded invoice ${existing.orderNo} (₹${Number(existing.grandTotal).toFixed(2)}) and restocked ${existing.items.length} item line(s) into ${existing.storeCode}`,
            userEmail: user.email || user.name,
            userRole: user.role,
            storeCode: existing.storeCode,
          },
        });
      }

      const sale = await tx.salesOrder.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
        },
        include: { items: true },
      });

      return sale;
    });

    broadcastRealtimeEvent('sales', 'SALE_UPDATED', { id: updatedSale.id, orderNo: updatedSale.orderNo, status: updatedSale.status });
    if (isVoidingOrRefunding) {
      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: existing.storeCode });
    }

    return NextResponse.json({
      success: true,
      sale: updatedSale,
      message: `Invoice ${existing.orderNo} updated to ${status}. ${isVoidingOrRefunding ? 'Inventory items successfully restocked.' : ''}`,
    });
  } catch (error: any) {
    console.error('API /api/sales PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update sales order' }, { status: 500 });
  }
}

/**
 * DELETE /api/sales - Void/Cancel a sales order safely or delete
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Only Store Managers and Super Admins can void or delete sales orders' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sales Order ID is required' }, { status: 400 });
    }

    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ success: true, message: 'Sales order already removed or non-existent' });
    }

    // Check store scope
    if (user.role !== 'Super Admin' && user.store !== existing.storeCode) {
      return NextResponse.json({ error: 'Store Scope Lock: You cannot delete orders from another store' }, { status: 403 });
    }

    // Always safe-cancel completed sales orders rather than erasing historical financial records
    const cancelled = await prisma.$transaction(async (tx: any) => {
      if (existing.status === 'Completed' && existing.items && existing.items.length > 0) {
        for (const item of existing.items) {
          const inv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: item.productId, storeCode: existing.storeCode } },
          });
          const prevQty = inv ? inv.qtyOnHand : 0;
          const newQty = prevQty + item.qty;

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: item.productId, storeCode: existing.storeCode } },
            create: { productId: item.productId, storeCode: existing.storeCode, qtyOnHand: newQty, reorderPt: 5 },
            update: { qtyOnHand: newQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: item.productId,
              storeCode: existing.storeCode,
              refNo: existing.orderNo,
              type: 'POS Sale Refund / Void In',
              qtyChange: item.qty,
              costPerUnit: item.unitCost,
              sellingPricePerUnit: item.unitPrice,
              balanceAfter: newQty,
              notes: `Order ${existing.orderNo} Voided by ${user.name}`,
              createdBy: user.name,
            },
          });
        }

        if (existing.customerId) {
          const cust = await tx.customer.findUnique({ where: { id: existing.customerId } });
          if (cust) {
            await tx.customer.update({
              where: { id: cust.id },
              data: {
                totalSpent: Math.max(0, Number(cust.totalSpent) - Number(existing.grandTotal)),
                totalOrders: Math.max(0, (cust.totalOrders || 1) - 1),
              },
            });
          }
        }
      }

      const updated = await tx.salesOrder.update({
        where: { id },
        data: { status: 'Cancelled' },
      });

      await tx.auditLog.create({
        data: {
          module: 'Sales',
          action: 'Void Sales Order',
          details: `Voided and cancelled sales order ${existing.orderNo} (Total: ₹${Number(existing.grandTotal).toFixed(2)}) and restocked inventory items`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: existing.storeCode,
        },
      });

      return updated;
    });

    broadcastRealtimeEvent('sales', 'SALE_UPDATED', { id: existing.id, orderNo: existing.orderNo, status: 'Cancelled' });
    broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: existing.storeCode });

    return NextResponse.json({
      success: true,
      mode: 'archived',
      sale: cancelled,
      message: `Invoice ${existing.orderNo} successfully voided and stock restored to ${existing.storeCode}.`,
    });
  } catch (error: any) {
    console.error('API /api/sales DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to void sales order' }, { status: 500 });
  }
}
