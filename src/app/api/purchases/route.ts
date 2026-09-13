import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

/**
 * GET /api/purchases - Retrieve purchase orders with authoritative payment reconciliation
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const store = searchParams.get('store');
    const paymentStatus = searchParams.get('paymentStatus');

    const whereClause: any = {};
    if (!includeArchived) {
      whereClause.status = { notIn: ['Archived', 'Cancelled'] };
    }
    if (store && store !== 'All Stores' && store !== 'ALL') {
      whereClause.storeCode = store;
    }
    if (paymentStatus) {
      if (paymentStatus.toLowerCase() === 'pending') {
        whereClause.paymentStatus = { not: 'Paid' };
      } else {
        whereClause.paymentStatus = paymentStatus;
      }
    }

    const purchases = await (prisma as any).purchaseOrder.findMany({
      where: whereClause,
      include: {
        vendor: true,
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const purchasesWithFinances = purchases.map((po: any) => {
      const totalCost = Number(po.totalCost) || 0;
      const creditAmount = Number(po.creditAmount) || 0;
      const realPaid = po.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) ?? (Number(po.paidAmount) || 0);
      const remainingAmount = Math.max(0, Math.round((totalCost - realPaid - creditAmount) * 100) / 100);

      return {
        ...po,
        totalCost,
        creditAmount,
        paidAmount: realPaid,
        remainingAmount,
        invoiceNo: po.invoiceNo || po.poNo,
      };
    });

    return NextResponse.json(
      { success: true, purchases: purchasesWithFinances },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/purchases GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve purchase orders' }, { status: 500 });
  }
}

/**
 * POST /api/purchases - Create purchase order & handle GRN receiving
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 60) {
      return NextResponse.json({ error: 'Forbidden: Insufficient security level for purchases' }, { status: 403 });
    }

    const body = await req.json();

    if (!body.vendorName || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Vendor name and line items are required' }, { status: 400 });
    }

    const count = await (prisma as any).purchaseOrder.count();
    const poNo = `PO-2026-${String(count + 1).padStart(4, '0')}`;
    const invoiceNo = body.invoiceNo?.trim() || `INV-${String(count + 1).padStart(4, '0')}`;

    // Resolve or upsert vendor
    let vendor = await (prisma as any).vendor.findFirst({
      where: { name: body.vendorName },
    });

    if (!vendor) {
      const vCount = await (prisma as any).vendor.count();
      vendor = await (prisma as any).vendor.create({
        data: {
          code: `VEN-${String(vCount + 1).padStart(3, '0')}`,
          name: body.vendorName,
          contactPerson: body.vendorContact || 'Account Manager',
          email: `${body.vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}@supplier.com`,
          phone: body.vendorPhone || '+91 98000 00000',
          city: 'Central',
          address: 'Vendor Hub',
          categories: 'General Hardware',
        },
      });
    }

    // Auto-compute due date from vendor payment terms if omitted
    let effectiveDueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (!effectiveDueDate) {
      const terms = (vendor.paymentTerms || '').toLowerCase();
      const days = terms.includes('15') ? 15 : terms.includes('60') ? 60 : terms.includes('immediate') || terms.includes('cash') ? 0 : 30;
      const d = new Date(body.orderDate || Date.now());
      d.setDate(d.getDate() + days);
      effectiveDueDate = d;
    }

    const po = await (prisma as any).$transaction(async (tx: any) => {
      let subtotal = 0;
      for (const it of body.items) {
        subtotal += it.qty * (it.unitCost || it.costPrice || 0);
      }
      const taxAmount = body.taxAmount || 0;
      const totalCost = subtotal + taxAmount;
      const creditAmount = body.creditAmount ? Number(body.creditAmount) : 0;

      let poNotes = body.notes || '';

      const createdPO = await tx.purchaseOrder.create({
        data: {
          poNo,
          invoiceNo,
          vendorId: vendor.id,
          storeCode: body.storeCode || 'CENTRAL',
          status: body.status || 'Pending',
          paymentStatus: body.paymentStatus || 'Unpaid',
          totalCost: totalCost,
          creditAmount: creditAmount,
          dueDate: effectiveDueDate,
          expectedDate: body.expectedDate ? new Date(body.expectedDate) : effectiveDueDate,
          notes: poNotes || null,
          createdBy: user.name,
        },
      });

      for (const it of body.items) {
        const itemUnitCost = it.unitCost || it.costPrice || 0;
        const itemLineTotal = it.qty * itemUnitCost;

        // Ensure product exists
        let prodId = it.productId;
        if (!prodId) {
          const matchedProd = await tx.product.findFirst({
            where: { OR: [{ sku: it.sku || '' }, { name: it.name || '' }] },
          });
          if (matchedProd) {
            prodId = matchedProd.id;
          } else {
            const newProd = await tx.product.create({
              data: {
                sku: it.sku || `SKU-${Date.now().toString().slice(-6)}`,
                name: it.name || 'Purchased Item',
                category: it.category || 'General',
                baseCostPrice: itemUnitCost,
                baseSellingPrice: 0,
                gstRate: 0,
                status: 'active',
              },
            });
            prodId = newProd.id;
          }
        }

        await tx.purchaseOrderItem.create({
          data: {
            poId: createdPO.id,
            productId: prodId,
            qtyOrdered: it.qty,
            qtyReceived: body.status === 'Received' ? it.qty : 0,
            unitCost: itemUnitCost,
            lineTotal: itemLineTotal,
          },
        });

        // If created with status "Received", automatically credit inventory
        if (body.status === 'Received') {
          const targetStore = body.storeCode || 'CENTRAL';
          const centralInv = await tx.inventory.findUnique({
            where: { productId_storeCode: { productId: prodId, storeCode: targetStore } },
          });
          const prevQty = centralInv ? centralInv.qtyOnHand : 0;
          const newQty = prevQty + it.qty;

          await tx.inventory.upsert({
            where: { productId_storeCode: { productId: prodId, storeCode: targetStore } },
            create: { productId: prodId, storeCode: targetStore, qtyOnHand: newQty },
            update: { qtyOnHand: newQty },
          });

          await tx.inventoryLedger.create({
            data: {
              productId: prodId,
              storeCode: targetStore,
              refNo: poNo,
              type: 'PO GRN In',
              qtyChange: it.qty,
              costPerUnit: itemUnitCost,
              balanceAfter: newQty,
              notes: `GRN Received from ${body.vendorName} (${poNo})`,
              createdBy: user.name,
            },
          });
        }
      }

      if (body.status === 'Received') {
        const targetStore = body.storeCode || 'CENTRAL';
        const grnCount = await (tx as any).goodsReceivedNote.count();
        const grnNo = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(grnCount + 1).padStart(4, '0')}`;
        await (tx as any).goodsReceivedNote.create({
          data: {
            grnNo,
            purchaseId: createdPO.id,
            storeCode: targetStore,
            receivedBy: user.name || 'Inventory Manager',
            notes: `Auto-generated GRN upon purchase order creation (${poNo})`,
          },
        });

        // Record Financial Ledger Entries for GRN Receiving
        await tx.financialLedgerEntry.create({
          data: {
            entryNo: `JRN-GRN-INVA-${poNo}`,
            entryDate: new Date(),
            storeCode: targetStore,
            accountCategory: 'ASSET',
            accountName: 'Inventory Asset (Procurement)',
            debit: totalCost,
            credit: 0,
            amount: totalCost,
            refType: 'PURCHASE_GRN',
            refId: createdPO.id,
            refNo: poNo,
            entityName: body.vendorName,
            description: `Goods Received Note (${grnNo}) against PO ${poNo}`,
            createdBy: user.name,
          },
        });

        await tx.financialLedgerEntry.create({
          data: {
            entryNo: `JRN-GRN-AP-${poNo}`,
            entryDate: new Date(),
            storeCode: targetStore,
            accountCategory: 'LIABILITY',
            accountName: 'Vendor Accounts Payable',
            debit: 0,
            credit: totalCost,
            amount: totalCost,
            refType: 'PURCHASE_GRN',
            refId: createdPO.id,
            refNo: poNo,
            entityName: body.vendorName,
            description: `Accounts Payable liability for PO ${poNo} (${body.vendorName})`,
            createdBy: user.name,
          },
        });
      }

      // Record audit log
      await tx.auditLog.create({
        data: {
          module: 'Purchases',
          action: 'Create Purchase Order',
          details: `Created Purchase Bill ${poNo} (Invoice #${invoiceNo}) from ${body.vendorName}. Total: ₹${totalCost.toFixed(2)}, Store: ${body.storeCode || 'CENTRAL'}`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: body.storeCode || 'CENTRAL',
        },
      });

      return createdPO;
    });

    broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', { id: po.id, poNo: po.poNo, status: po.status });
    if (body.status === 'Received') {
      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: body.storeCode || 'CENTRAL' });
    }

    return NextResponse.json({ success: true, purchaseOrder: po }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/purchases POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create purchase order' }, { status: 500 });
  }
}

/**
 * PUT /api/purchases - Update purchase order status & credit inventory on GRN receiving
 */
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const existing = await (prisma as any).purchaseOrder.findUnique({
      where: { id: body.id },
      include: { items: true, vendor: true, payments: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const isTransitioningToReceived = body.status === 'Received' && existing.status !== 'Received';
    const targetStore = existing.storeCode || 'CENTRAL';

    // Execute atomic update & stock credit if receiving
    const updatedPo = await prisma.$transaction(
      async (tx: any) => {
        if (isTransitioningToReceived && existing.items && existing.items.length > 0) {
          for (const it of existing.items) {
            const currentInv = await tx.inventory.findUnique({
              where: { productId_storeCode: { productId: it.productId, storeCode: targetStore } },
            });
            const prevQty = currentInv ? currentInv.qtyOnHand : 0;
            const newQty = prevQty + it.qtyOrdered;

            await tx.inventory.upsert({
              where: { productId_storeCode: { productId: it.productId, storeCode: targetStore } },
              create: {
                productId: it.productId,
                storeCode: targetStore,
                qtyOnHand: newQty,
                reorderPt: 5,
              },
              update: {
                qtyOnHand: newQty,
              },
            });

            await tx.inventoryLedger.create({
              data: {
                productId: it.productId,
                storeCode: targetStore,
                refNo: existing.poNo,
                type: 'PO GRN In',
                qtyChange: it.qtyOrdered,
                costPerUnit: it.unitCost,
                balanceAfter: newQty,
                notes: `GRN Received from ${existing.vendor?.name || 'Vendor'} (${existing.poNo})`,
                createdBy: user.name,
              },
            });

            await tx.purchaseOrderItem.update({
              where: { id: it.id },
              data: { qtyReceived: it.qtyOrdered },
            });
          }

          const grnCount = await (tx as any).goodsReceivedNote.count();
          const grnNo = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(grnCount + 1).padStart(4, '0')}`;
          await (tx as any).goodsReceivedNote.create({
            data: {
              grnNo,
              purchaseId: existing.id,
              storeCode: targetStore,
              receivedBy: user.name || 'Inventory Manager',
              notes: body.grnNotes || `Goods received against PO ${existing.poNo}`,
            },
          });

          // Record Financial Ledger Entries for GRN Receiving
          const poTotalCost = Number(existing.totalCost) || 0;
          await tx.financialLedgerEntry.create({
            data: {
              entryNo: `JRN-GRN-INVA-${existing.poNo}`,
              entryDate: new Date(),
              storeCode: targetStore,
              accountCategory: 'ASSET',
              accountName: 'Inventory Asset (Procurement)',
              debit: poTotalCost,
              credit: 0,
              amount: poTotalCost,
              refType: 'PURCHASE_GRN',
              refId: existing.id,
              refNo: existing.poNo,
              entityName: existing.vendor?.name || 'Vendor',
              description: `Goods Received Note (${grnNo}) against PO ${existing.poNo}`,
              createdBy: user.name,
            },
          });

          await tx.financialLedgerEntry.create({
            data: {
              entryNo: `JRN-GRN-AP-${existing.poNo}`,
              entryDate: new Date(),
              storeCode: targetStore,
              accountCategory: 'LIABILITY',
              accountName: 'Vendor Accounts Payable',
              debit: 0,
              credit: poTotalCost,
              amount: poTotalCost,
              refType: 'PURCHASE_GRN',
              refId: existing.id,
              refNo: existing.poNo,
              entityName: existing.vendor?.name || 'Vendor',
              description: `Accounts Payable liability for PO ${existing.poNo}`,
              createdBy: user.name,
            },
          });
        }

        const po = await tx.purchaseOrder.update({
          where: { id: body.id },
          data: {
            ...(body.status ? { status: body.status } : {}),
            ...(isTransitioningToReceived ? { receivedDate: new Date() } : {}),
            ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}),
            ...(body.invoiceNo !== undefined ? { invoiceNo: body.invoiceNo?.trim() || null } : {}),
            ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
            ...(body.creditAmount !== undefined ? { creditAmount: Number(body.creditAmount) } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            module: 'Purchases',
            action: 'Update Purchase Order',
            details: `Updated Purchase Bill ${existing.poNo} (${existing.vendor?.name}). Status: ${po.status}, PayStatus: ${po.paymentStatus}`,
            userEmail: user.email || user.name,
            userRole: user.role,
            storeCode: targetStore,
          },
        });

        return po;
      },
      { maxWait: 10000, timeout: 15000 }
    );

    broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', { id: updatedPo.id, poNo: updatedPo.poNo, status: updatedPo.status });
    if (isTransitioningToReceived) {
      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', { storeCode: targetStore });
    }

    return NextResponse.json({ success: true, purchaseOrder: updatedPo });
  } catch (error: any) {
    console.error('API /api/purchases PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update purchase order' }, { status: 500 });
  }
}

/**
 * DELETE /api/purchases - Delete a draft purchase order or cancel/archive received/paid PO
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

    if (!id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const existing = await (prisma as any).purchaseOrder.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!existing) {
      return NextResponse.json({ success: true, message: 'Purchase Order already deleted or non-existent' });
    }

    const paymentCount = existing.payments?.length || 0;

    // Received or paid POs have impacted inventory and financial ledgers; cancel/archive safely instead of destructive delete
    if (existing.status === 'Received' || existing.status === 'Completed' || paymentCount > 0) {
      const archived = await (prisma as any).purchaseOrder.update({
        where: { id },
        data: { status: 'Cancelled' },
      });

      await (prisma as any).auditLog.create({
        data: {
          module: 'Purchases',
          action: 'Cancel Purchase Order',
          details: `Cancelled Purchase Bill ${existing.poNo}. Historical payments recorded: ${paymentCount}. Preserved in DB for ledger accuracy.`,
          userEmail: user.email || user.name,
          userRole: user.role,
          storeCode: existing.storeCode,
        },
      });

      broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', { id: existing.id, poNo: existing.poNo, action: 'cancelled' });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        purchaseOrder: archived,
        message: `Purchase Bill ${existing.poNo} had ${paymentCount} payment(s) or stock receipts and was safely Cancelled/Archived to preserve accounting ledgers.`,
      });
    }

    // Hard-delete draft / pending POs with zero payments and zero stock receipts
    await (prisma as any).purchaseOrderItem.deleteMany({ where: { poId: id } });
    await (prisma as any).purchaseOrder.delete({ where: { id } });

    await (prisma as any).auditLog.create({
      data: {
        module: 'Purchases',
        action: 'Delete Purchase Order',
        details: `Permanently deleted draft Purchase Order ${existing.poNo}.`,
        userEmail: user.email || user.name,
        userRole: user.role,
        storeCode: existing.storeCode,
      },
    });

    broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', { id: existing.id, poNo: existing.poNo, action: 'deleted' });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Draft Purchase Order ${existing.poNo} permanently deleted.`,
    });
  } catch (error: any) {
    console.error('API /api/purchases DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete purchase order' }, { status: 500 });
  }
}
