import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent, getStoreChannel } from '@/lib/realtime';
import { generateSafeSequenceNo, generateDateSequenceNo } from '@/lib/sequenceUtils';
import { executeWithIdempotency } from '@/lib/idempotency';

/**
 * GET /api/purchases - Retrieve purchase orders with authoritative payment reconciliation
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const store = searchParams.get('store');
    const paymentStatus = searchParams.get('paymentStatus');

    const whereClause: any = {};
    if (!includeArchived) {
      whereClause.status = { notIn: ['Archived', 'Cancelled'] };
    }
    if (user.role !== 'Super Admin') {
      const allowed =
        user.allowedStores && user.allowedStores.length > 0 ? user.allowedStores : [user.store];
      if (store) {
        if (store === 'All Stores' || store === 'ALL') {
          return NextResponse.json(
            {
              error:
                'Forbidden: Consolidated view across all stores is restricted to Super Admin only',
            },
            { status: 403 }
          );
        }
        if (!allowed.includes(store)) {
          return NextResponse.json(
            {
              error: `Forbidden: Cross-store purchase queries are restricted to Super Admin accounts only`,
            },
            { status: 403 }
          );
        }
        whereClause.storeCode = store;
      } else {
        whereClause.storeCode = { in: allowed };
      }
    } else if (store && store !== 'All Stores' && store !== 'ALL') {
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
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                gstRate: true,
                baseCostPrice: true,
              },
            },
          },
        },
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
      const subtotal =
        po.subtotal !== null && po.subtotal !== undefined
          ? Number(po.subtotal)
          : Number(po.totalCost) || 0;
      const taxAmount =
        po.taxAmount !== null && po.taxAmount !== undefined ? Number(po.taxAmount) : 0;
      const discountAmount =
        po.discountAmount !== null && po.discountAmount !== undefined
          ? Number(po.discountAmount)
          : 0;
      const totalCost = Number(po.totalCost) || 0;
      const creditAmount = Number(po.creditAmount) || 0;
      const realPaid =
        po.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) ??
        (Number(po.paidAmount) || 0);
      const remainingAmount = Math.max(
        0,
        Math.round((totalCost - realPaid - creditAmount) * 100) / 100
      );
      const paymentStatus =
        remainingAmount <= 0.01 && totalCost > 0 ? 'Paid' : realPaid > 0.005 ? 'Partial' : 'Unpaid';

      const itemsWithProduct =
        po.items?.map((it: any) => ({
          ...it,
          productId: it.productId,
          productName: it.product?.name || 'Item',
          name: it.product?.name || 'Item',
          sku: it.product?.sku || '',
          qty: it.qtyOrdered,
          unitCost: Number(it.unitCost),
          taxRate:
            it.taxRate !== null && it.taxRate !== undefined
              ? Number(it.taxRate)
              : Number(it.product?.gstRate || 0),
          taxAmount: it.taxAmount !== null && it.taxAmount !== undefined ? Number(it.taxAmount) : 0,
          discount: it.discount !== null && it.discount !== undefined ? Number(it.discount) : 0,
          lineTotal: Number(it.lineTotal),
        })) || [];

      return {
        ...po,
        items: itemsWithProduct,
        subtotal,
        taxAmount,
        discountAmount,
        totalCost,
        totalAmount: totalCost,
        creditAmount,
        paidAmount: realPaid,
        remainingAmount,
        paymentStatus,
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
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    if (user.securityLevel < 60) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient security level for purchases' },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (!body.vendorName || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Vendor name and line items are required' },
        { status: 400 }
      );
    }

    if (user.role !== 'Super Admin' && body.storeCode && body.storeCode !== user.store) {
      return NextResponse.json(
        {
          error: `Forbidden: As ${user.role}, you are restricted to store "${user.store}". Cannot create purchase orders for store "${body.storeCode}".`,
        },
        { status: 403 }
      );
    }
    const effectiveStoreCode =
      user.role === 'Super Admin' ? body.storeCode || 'CENTRAL' : user.store;

    // Resolve real registered vendor only
    let vendor = null;
    if (body.vendorId) {
      vendor = await prisma.vendor.findUnique({
        where: { id: body.vendorId },
      });
    }
    if (!vendor && body.vendorName) {
      vendor = await prisma.vendor.findFirst({
        where: { name: body.vendorName.trim() },
      });
    }

    if (!vendor) {
      return NextResponse.json(
        {
          error:
            'Invalid vendor: Purchase orders can only be created for registered vendors in the system.',
        },
        { status: 400 }
      );
    }

    const customKey =
      body.idempotencyKey ||
      req.headers.get('x-idempotency-key') ||
      `po_${body.vendorName}_${effectiveStoreCode}_${Date.now()}`;

    return await executeWithIdempotency(
      req,
      {
        action: 'CREATE_PURCHASE',
        key: customKey,
        userId: user.id,
        storeCode: effectiveStoreCode,
        extractEntityId: (d) => d?.purchaseOrder?.id || d?.purchaseOrder?.poNo,
      },
      async () => {
        // Generate collision-proof PO and Invoice sequence numbers
        const poNo = await generateSafeSequenceNo('purchaseOrder', 'poNo', 'PO-2026-', 4);
        const invoiceNo = body.invoiceNo?.trim() || `INV-${poNo.replace('PO-', '')}`;

        // Auto-compute due date from vendor payment terms if omitted
        let effectiveDueDate = body.dueDate ? new Date(body.dueDate) : null;
        if (!effectiveDueDate) {
          const terms = (vendor.paymentTerms || '').toLowerCase();
          const days = terms.includes('15')
            ? 15
            : terms.includes('60')
              ? 60
              : terms.includes('immediate') || terms.includes('cash')
                ? 0
                : 30;
          const d = new Date(body.orderDate || Date.now());
          d.setDate(d.getDate() + days);
          effectiveDueDate = d;
        }

        // ─── 1. PRE-PROCESS ITEMS & PRODUCTS OUTSIDE $transaction ───────────
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        const preparedItems: any[] = [];

        for (const it of body.items) {
          const itemQty = Number(it.qty) || 1;
          const itemUnitCost = Number(
            it.unitCost !== undefined && it.unitCost !== null ? it.unitCost : it.costPrice || 0
          );
          const itemDiscount = Number(it.discount || 0);
          const itemSubtotal = itemQty * itemUnitCost;
          const discountedBase = Math.max(0, itemSubtotal - itemDiscount);
          const itemTaxRate = Number(it.taxRate || 0);
          const itemTax =
            it.taxAmount !== undefined && it.taxAmount !== null
              ? Number(it.taxAmount)
              : Math.round(((discountedBase * itemTaxRate) / 100) * 100) / 100;
          const itemLineTotal =
            it.lineTotal !== undefined && it.lineTotal !== null
              ? Number(it.lineTotal)
              : Math.round((discountedBase + itemTax) * 100) / 100;

          subtotal += itemSubtotal;
          totalDiscount += itemDiscount;
          totalTax += itemTax;

          // Pre-resolve product master record outside transaction to keep transaction lightning-fast
          let prodId = it.productId;
          if (!prodId) {
            const matchedProd = await prisma.product.findFirst({
              where: { OR: [{ sku: it.sku || '' }, { name: it.name || '' }] },
            });
            if (matchedProd) {
              prodId = matchedProd.id;
            } else {
              const newProd = await prisma.product.create({
                data: {
                  sku: it.sku || `SKU-${Date.now().toString().slice(-6)}`,
                  name: it.name || 'Purchased Item',
                  category: it.category || 'General',
                  baseCostPrice: itemUnitCost,
                  baseSellingPrice: 0,
                  gstRate: itemTaxRate,
                  status: 'active',
                },
              });
              prodId = newProd.id;
            }
          }

          preparedItems.push({
            productId: prodId,
            qtyOrdered: itemQty,
            qtyReceived: body.status === 'Received' ? itemQty : 0,
            unitCost: itemUnitCost,
            taxRate: itemTaxRate,
            taxAmount: itemTax,
            discount: itemDiscount,
            lineTotal: itemLineTotal,
          });
        }

        subtotal = Math.round(subtotal * 100) / 100;
        totalDiscount = Math.round(totalDiscount * 100) / 100;
        totalTax = Math.round(totalTax * 100) / 100;
        const calculatedGrandTotal = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;
        const totalCost = calculatedGrandTotal;
        const creditAmount = body.creditAmount ? Number(body.creditAmount) : 0;

        let paidAmount = 0;
        if (body.paymentStatus === 'Paid') {
          paidAmount = totalCost;
        } else if (body.paymentStatus === 'Partial' && body.paidAmount !== undefined) {
          paidAmount = Math.max(0, Number(body.paidAmount) || 0);
        } else if (body.paidAmount !== undefined && Number(body.paidAmount) > 0) {
          paidAmount = Math.max(0, Number(body.paidAmount) || 0);
        }

        // Enforce mandatory payment proof & UTR for initial PO payment
        const initProof = body.receiptUrl || body.proofUrl || body.paymentProofUrl;
        const initRef = body.referenceNo
          ? String(body.referenceNo).trim()
          : body.payRef
            ? String(body.payRef).trim()
            : '';
        if (paidAmount > 0) {
          if (!initProof || !String(initProof).trim()) {
            throw new Error(
              'Payment proof is mandatory when recording advance / initial payment for a Purchase Order!'
            );
          }
          if (!initRef) {
            throw new Error(
              'Payment Reference / UTR number is mandatory when recording advance payment for a Purchase Order.'
            );
          }
          const paymentMethodName = body.paymentMethod
            ? String(body.paymentMethod).trim()
            : 'Bank Transfer';
          const pmRecord = await prisma.paymentMethod.findFirst({
            where: { name: paymentMethodName },
          });
          if (pmRecord && pmRecord.status === 'Inactive') {
            throw new Error(
              `Payment method "${paymentMethodName}" is currently deactivated. Please select an active payment method.`
            );
          }
        }

        let actualPaymentStatus = 'Unpaid';
        if (paidAmount >= totalCost - creditAmount && totalCost > 0) {
          actualPaymentStatus = 'Paid';
        } else if (paidAmount > 0) {
          actualPaymentStatus = 'Partial';
        }

        const targetStore = effectiveStoreCode;

        // ─── 2. FAST ATOMIC TRANSACTION WITH BATCH WRITES ───────────────────
        const po = await prisma.$transaction(
          async (tx: any) => {
            const createdPO = await tx.purchaseOrder.create({
              data: {
                poNo,
                invoiceNo: invoiceNo,
                vendorId: vendor.id,
                storeCode: targetStore,
                orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
                status: body.status || 'Ordered',
                paymentStatus: actualPaymentStatus,
                subtotal: subtotal,
                taxAmount: totalTax,
                discountAmount: totalDiscount,
                totalCost: totalCost,
                paidAmount: paidAmount,
                creditAmount: creditAmount,
                dueDate: effectiveDueDate,
                expectedDate: body.expectedDate ? new Date(body.expectedDate) : effectiveDueDate,
                notes: body.notes || null,
                createdBy: user.name,
              },
            });

            // 2a. Record initial payment atomically if paidAmount > 0
            if (paidAmount > 0) {
              const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
              const voucherNo = await generateDateSequenceNo(
                'purchasePayment',
                'voucherNo',
                'PV',
                paymentDate,
                4,
                tx
              );
              const paymentMethod = body.paymentMethod || 'Bank Transfer';

              const payment = await tx.purchasePayment.create({
                data: {
                  purchaseId: createdPO.id,
                  voucherNo,
                  amount: paidAmount,
                  paymentDate,
                  paymentMethod,
                  referenceNo: initRef,
                  receiptUrl: initProof,
                  notes:
                    body.paymentNotes ||
                    (actualPaymentStatus === 'Paid'
                      ? `Full settlement upon PO creation (${poNo})`
                      : `Initial partial payment upon PO creation (${poNo})`),
                  recordedBy: user.name || user.email || 'Authorized Staff',
                },
              });

              const poLedgerMeta = JSON.stringify({
                proofUrl: initProof,
                referenceNo: initRef,
                paymentMethod,
                voucherNo,
                poNo,
                recordedBy: user.name,
                timestamp: new Date().toISOString(),
              });

              // Batch create double-entry ledger entries in 1 query
              await tx.financialLedgerEntry.createMany({
                data: [
                  {
                    entryNo: `JRN-PAY-AP-${voucherNo}`,
                    entryDate: paymentDate,
                    storeCode: targetStore,
                    accountCategory: 'LIABILITY',
                    accountName: 'Vendor Accounts Payable (Settlement)',
                    debit: paidAmount,
                    credit: 0,
                    amount: -paidAmount,
                    refType: 'VENDOR_PAYMENT',
                    refId: payment.id,
                    refNo: voucherNo,
                    entityName: vendor.name,
                    description: `Initial payment for PO ${poNo} (${vendor.name}) via ${paymentMethod} (Ref: ${initRef})`,
                    metadataJson: poLedgerMeta,
                    createdBy: user.name,
                  },
                  {
                    entryNo: `JRN-PAY-BANK-${voucherNo}`,
                    entryDate: paymentDate,
                    storeCode: targetStore,
                    accountCategory: 'ASSET',
                    accountName: `Cash / Bank (${paymentMethod})`,
                    debit: 0,
                    credit: paidAmount,
                    amount: -paidAmount,
                    refType: 'VENDOR_PAYMENT',
                    refId: payment.id,
                    refNo: voucherNo,
                    entityName: vendor.name,
                    description: `Bank disbursement for PO ${poNo} (Voucher ${voucherNo}, Ref: ${initRef})`,
                    metadataJson: poLedgerMeta,
                    createdBy: user.name,
                  },
                ],
              });
            }

            // 2b. Batch insert all PO line items in 1 single query
            await tx.purchaseOrderItem.createMany({
              data: preparedItems.map((it) => ({
                ...it,
                poId: createdPO.id,
              })),
            });

            // 2c. If created with status "Received", atomically receive stock & update ledgers
            if (body.status === 'Received') {
              const productIds = preparedItems.map((it) => it.productId);
              const existingInvs = await tx.inventory.findMany({
                where: {
                  storeCode: targetStore,
                  productId: { in: productIds },
                },
              });
              const invMap = new Map<string, any>(
                existingInvs.map((inv: any) => [inv.productId, inv])
              );

              // Parallel inventory upserts
              await Promise.all(
                preparedItems.map((it) => {
                  const prevQty = invMap.get(it.productId)?.qtyOnHand || 0;
                  const newQty = prevQty + it.qtyOrdered;
                  return tx.inventory.upsert({
                    where: {
                      productId_storeCode: { productId: it.productId, storeCode: targetStore },
                    },
                    create: {
                      productId: it.productId,
                      storeCode: targetStore,
                      qtyOnHand: newQty,
                      reorderPt: 5,
                    },
                    update: { qtyOnHand: newQty },
                  });
                })
              );

              // Batch insert inventory ledger entries
              const invLedgerData = preparedItems.map((it) => {
                const prevQty = invMap.get(it.productId)?.qtyOnHand || 0;
                return {
                  productId: it.productId,
                  storeCode: targetStore,
                  refNo: poNo,
                  type: 'PO GRN In',
                  qtyChange: it.qtyOrdered,
                  costPerUnit: it.unitCost,
                  balanceAfter: prevQty + it.qtyOrdered,
                  notes: `GRN Received from ${body.vendorName} (${poNo})`,
                  createdBy: user.name,
                };
              });
              await tx.inventoryLedger.createMany({ data: invLedgerData });

              // Auto-generate GRN
              const grnNo = await generateDateSequenceNo(
                'goodsReceivedNote',
                'grnNo',
                'GRN',
                new Date(),
                4,
                tx
              );
              await tx.goodsReceivedNote.create({
                data: {
                  grnNo,
                  purchaseId: createdPO.id,
                  storeCode: targetStore,
                  receivedBy: user.name || 'Store Manager',
                  notes: `Auto-generated GRN upon purchase order creation (${poNo})`,
                },
              });

              // Batch create Financial Ledger Entries for GRN Receiving in 1 query
              await tx.financialLedgerEntry.createMany({
                data: [
                  {
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
                  {
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
                ],
              });
            }

            // 2d. Audit log entry
            await tx.auditLog.create({
              data: {
                module: 'Purchases',
                action: 'Create Purchase Order',
                details: `Created Purchase Bill ${poNo} (Invoice #${invoiceNo}) from ${body.vendorName}. Total: ₹${totalCost.toFixed(2)}, Store: ${targetStore}`,
                userEmail: user.email || user.name,
                userRole: user.role,
                storeCode: targetStore,
              },
            });

            return await tx.purchaseOrder.findUnique({
              where: { id: createdPO.id },
              include: {
                vendor: true,
                items: {
                  include: {
                    product: true,
                  },
                },
                payments: true,
              },
            });
          },
          { maxWait: 15000, timeout: 45000 }
        );

        const poPayload = {
          id: po.id,
          poNo: po.poNo,
          status: po.status,
          storeCode: body.storeCode || 'CENTRAL',
        };
        broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', poPayload);
        if (body.storeCode) {
          broadcastRealtimeEvent(getStoreChannel(body.storeCode), 'PURCHASE_COMPLETED', poPayload);
        }
        if (body.status === 'Received') {
          const sc = body.storeCode || 'CENTRAL';
          const stockPayload = { storeCode: sc };
          broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', stockPayload);
          broadcastRealtimeEvent(getStoreChannel(sc), 'STOCK_UPDATED', stockPayload);
        }

        return {
          status: 201,
          data: { success: true, purchaseOrder: po },
        };
      }
    );
  } catch (error: any) {
    console.error('API /api/purchases POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/purchases - Update purchase order status & credit inventory on GRN receiving
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

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
    const targetStore = body.storeCode || existing.storeCode || 'CENTRAL';

    // Pre-resolve any missing products outside transaction if items are updated
    let preparedUpdateItems: any[] | null = null;
    let updatedSubtotal = Number(existing.subtotal) || 0;
    let updatedTaxAmount = Number(existing.taxAmount) || 0;
    let updatedDiscountAmount = Number(existing.discountAmount) || 0;
    let updatedTotalCost = Number(existing.totalCost) || 0;

    if (
      body.items &&
      Array.isArray(body.items) &&
      body.items.length > 0 &&
      existing.status !== 'Received'
    ) {
      let sub = 0;
      let tax = 0;
      let disc = 0;
      preparedUpdateItems = [];

      for (const it of body.items) {
        const itemQty = Number(it.qty) || 1;
        const itemUnitCost = Number(
          it.unitCost !== undefined && it.unitCost !== null ? it.unitCost : it.costPrice || 0
        );
        const itemDiscount = Number(it.discount || 0);
        const itemSubtotal = itemQty * itemUnitCost;
        const discountedBase = Math.max(0, itemSubtotal - itemDiscount);
        const itemTaxRate = Number(it.taxRate || 0);
        const itemTax =
          it.taxAmount !== undefined && it.taxAmount !== null
            ? Number(it.taxAmount)
            : Math.round(((discountedBase * itemTaxRate) / 100) * 100) / 100;
        const itemLineTotal =
          it.lineTotal !== undefined && it.lineTotal !== null
            ? Number(it.lineTotal)
            : Math.round((discountedBase + itemTax) * 100) / 100;

        sub += itemSubtotal;
        disc += itemDiscount;
        tax += itemTax;

        let prodId = it.productId;
        if (!prodId) {
          const matchedProd = await prisma.product.findFirst({
            where: { OR: [{ sku: it.sku || '' }, { name: it.name || '' }] },
          });
          if (matchedProd) {
            prodId = matchedProd.id;
          } else {
            const newProd = await prisma.product.create({
              data: {
                sku: it.sku || `SKU-${Date.now().toString().slice(-6)}`,
                name: it.name || 'Purchased Item',
                category: it.category || 'General',
                baseCostPrice: itemUnitCost,
                baseSellingPrice: 0,
                gstRate: itemTaxRate,
                status: 'active',
              },
            });
            prodId = newProd.id;
          }
        }

        preparedUpdateItems.push({
          poId: existing.id,
          productId: prodId,
          qtyOrdered: itemQty,
          qtyReceived: 0,
          unitCost: itemUnitCost,
          taxRate: itemTaxRate,
          taxAmount: itemTax,
          discount: itemDiscount,
          lineTotal: itemLineTotal,
        });
      }

      updatedSubtotal = Math.round(sub * 100) / 100;
      updatedDiscountAmount = Math.round(disc * 100) / 100;
      updatedTaxAmount = Math.round(tax * 100) / 100;
      updatedTotalCost =
        Math.round((updatedSubtotal - updatedDiscountAmount + updatedTaxAmount) * 100) / 100;
    }

    // Execute atomic update & stock credit if receiving
    const updatedPo = await prisma.$transaction(
      async (tx: any) => {
        // 1. If items were re-specified on an unreceived PO, replace them in 1 batch
        if (preparedUpdateItems && preparedUpdateItems.length > 0) {
          await tx.purchaseOrderItem.deleteMany({
            where: { poId: existing.id },
          });

          await tx.purchaseOrderItem.createMany({
            data: preparedUpdateItems,
          });
        }

        // 2. If transitioning to Received, execute batched stock credit & double-entry ledgers
        if (isTransitioningToReceived) {
          const currentItems = await tx.purchaseOrderItem.findMany({
            where: { poId: existing.id },
          });

          if (currentItems.length > 0) {
            const productIds = currentItems.map((it: any) => it.productId);
            const currentInvs = await tx.inventory.findMany({
              where: {
                storeCode: targetStore,
                productId: { in: productIds },
              },
            });
            const invMap = new Map<string, any>(
              currentInvs.map((inv: any) => [inv.productId, inv])
            );

            // Concurrently upsert all inventory records
            await Promise.all(
              currentItems.map((it: any) => {
                const prevQty = invMap.get(it.productId)?.qtyOnHand || 0;
                const newQty = prevQty + it.qtyOrdered;
                return tx.inventory.upsert({
                  where: {
                    productId_storeCode: { productId: it.productId, storeCode: targetStore },
                  },
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
              })
            );

            // Batch insert inventory ledger entries in 1 query
            const invLedgers = currentItems.map((it: any) => {
              const prevQty = invMap.get(it.productId)?.qtyOnHand || 0;
              return {
                productId: it.productId,
                storeCode: targetStore,
                refNo: existing.poNo,
                type: 'PO GRN In',
                qtyChange: it.qtyOrdered,
                costPerUnit: it.unitCost,
                balanceAfter: prevQty + it.qtyOrdered,
                notes: `GRN Received from ${existing.vendor?.name || 'Vendor'} (${existing.poNo})`,
                createdBy: user.name,
              };
            });
            await tx.inventoryLedger.createMany({ data: invLedgers });

            // Mark line items received
            await Promise.all(
              currentItems.map((it: any) =>
                tx.purchaseOrderItem.update({
                  where: { id: it.id },
                  data: { qtyReceived: it.qtyOrdered },
                })
              )
            );

            // Generate GRN
            const grnNo = await generateDateSequenceNo(
              'goodsReceivedNote',
              'grnNo',
              'GRN',
              new Date(),
              4,
              tx
            );
            await tx.goodsReceivedNote.create({
              data: {
                grnNo,
                purchaseId: existing.id,
                storeCode: targetStore,
                receivedBy: user.name || 'Store Manager',
                notes: body.grnNotes || `Goods received against PO ${existing.poNo}`,
              },
            });

            // Batch create Financial Ledger Entries for GRN Receiving in 1 query
            const poTotalCost = Number(updatedTotalCost ?? existing.totalCost) || 0;
            await tx.financialLedgerEntry.createMany({
              data: [
                {
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
                {
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
              ],
            });
          }
        }

        // Authoritatively derive paidAmount and paymentStatus from real payments relation
        const realPaid =
          existing.payments?.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) || 0;
        const finalCost =
          updatedTotalCost !== undefined ? Number(updatedTotalCost) : Number(existing.totalCost);
        const finalCredit =
          body.creditAmount !== undefined
            ? Number(body.creditAmount)
            : Number(existing.creditAmount) || 0;
        const remaining = Math.max(0, Math.round((finalCost - realPaid - finalCredit) * 100) / 100);

        let finalPaymentStatus: string;
        if (remaining <= 0.01 && finalCost > 0) {
          finalPaymentStatus = 'Paid';
        } else if (realPaid > 0.005) {
          finalPaymentStatus = 'Partial';
        } else {
          finalPaymentStatus = 'Unpaid';
        }

        // 3. Update Purchase Order Master record
        await tx.purchaseOrder.update({
          where: { id: body.id },
          data: {
            ...(body.status ? { status: body.status } : {}),
            ...(isTransitioningToReceived ? { receivedDate: new Date() } : {}),
            paymentStatus: finalPaymentStatus,
            paidAmount: realPaid,
            creditAmount: finalCredit,
            ...(body.invoiceNo !== undefined ? { invoiceNo: body.invoiceNo?.trim() || null } : {}),
            ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
            ...(body.expectedDate ? { expectedDate: new Date(body.expectedDate) } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
            ...(preparedUpdateItems
              ? {
                  subtotal: updatedSubtotal,
                  taxAmount: updatedTaxAmount,
                  discountAmount: updatedDiscountAmount,
                  totalCost: updatedTotalCost,
                }
              : {}),
          },
        });

        // 4. Audit log entry
        await tx.auditLog.create({
          data: {
            module: 'Purchases',
            action: 'Update Purchase Order',
            details: `Updated Purchase Bill ${existing.poNo} (${existing.vendor?.name}). Status: ${body.status || existing.status}, PayStatus: ${finalPaymentStatus}`,
            userEmail: user.email || user.name,
            userRole: user.role,
            storeCode: targetStore,
          },
        });

        return await tx.purchaseOrder.findUnique({
          where: { id: body.id },
          include: {
            vendor: true,
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
          },
        });
      },
      { maxWait: 15000, timeout: 45000 }
    );

    const updatePoPayload = {
      id: updatedPo.id,
      poNo: updatedPo.poNo,
      status: updatedPo.status,
      storeCode: targetStore,
    };
    broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', updatePoPayload);
    if (targetStore) {
      broadcastRealtimeEvent(getStoreChannel(targetStore), 'PURCHASE_COMPLETED', updatePoPayload);
    }
    if (isTransitioningToReceived) {
      const stockPayload = { storeCode: targetStore };
      broadcastRealtimeEvent('inventory', 'STOCK_UPDATED', stockPayload);
      if (targetStore) {
        broadcastRealtimeEvent(getStoreChannel(targetStore), 'STOCK_UPDATED', stockPayload);
      }
    }

    return NextResponse.json({ success: true, purchaseOrder: updatedPo });
  } catch (error: any) {
    console.error('API /api/purchases PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/purchases - Delete Approval Workflow
 * Draft POs: hard-delete. Received/Paid: cancel/archive. Non-Super-Admin: approval required.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    if (user.securityLevel < 80) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient security level' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const reason = searchParams.get('reason') || '';

    if (!id) {
      return NextResponse.json({ error: 'Purchase Order ID is required' }, { status: 400 });
    }

    const existing = await (prisma as any).purchaseOrder.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!existing) {
      return NextResponse.json({
        success: true,
        message: 'Purchase Order already deleted or non-existent',
      });
    }

    // NON-SUPER-ADMIN: delete approval workflow
    if (user.securityLevel < 100) {
      if (!reason || reason.trim().length < 3) {
        return NextResponse.json(
          { error: 'A reason for deletion is required (minimum 3 characters)' },
          { status: 400 }
        );
      }
      const { createDeleteRequest } = await import('@/lib/services/deleteApprovalService');
      const result = await createDeleteRequest(user as any, {
        entityType: 'PURCHASE',
        entityId: id,
        reason: reason.trim(),
      });
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 409 });
      return NextResponse.json({
        success: true,
        mode: 'pending_approval',
        deleteRequest: result.deleteRequest,
        message: `Delete request for purchase order "${existing.poNo}" submitted for Super Admin approval.`,
      });
    }

    // SUPER ADMIN: existing logic preserved
    const paymentCount = existing.payments?.length || 0;

    // Received or paid POs: cancel/archive
    if (existing.status === 'Received' || existing.status === 'Completed' || paymentCount > 0) {
      const archived = await prisma.$transaction(
        async (tx: any) => {
          const u = await tx.purchaseOrder.update({
            where: { id },
            data: { status: 'Cancelled' },
          });

          await tx.auditLog.create({
            data: {
              module: 'Purchases',
              action: 'Cancel Purchase Order',
              details: `Cancelled Purchase Bill ${existing.poNo}. Historical payments recorded: ${paymentCount}. Preserved in DB for ledger accuracy.`,
              userEmail: user.email || user.name,
              userRole: user.role,
              storeCode: existing.storeCode,
            },
          });
          return u;
        },
        { maxWait: 15000, timeout: 45000 }
      );

      broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', {
        id: existing.id,
        poNo: existing.poNo,
        action: 'cancelled',
      });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        purchaseOrder: archived,
        message: `Purchase Bill ${existing.poNo} had ${paymentCount} payment(s) or stock receipts and was safely Cancelled/Archived.`,
      });
    }

    // Hard-delete draft POs
    await prisma.$transaction(
      async (tx: any) => {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
        await tx.purchaseOrder.delete({ where: { id } });

        await tx.auditLog.create({
          data: {
            module: 'Purchases',
            action: 'Delete Purchase Order',
            details: `Permanently deleted draft Purchase Order ${existing.poNo}.`,
            userEmail: user.email || user.name,
            userRole: user.role,
            storeCode: existing.storeCode,
          },
        });
      },
      { maxWait: 15000, timeout: 45000 }
    );

    const poDelPayload = {
      id: existing.id,
      poNo: existing.poNo,
      action: 'deleted',
      storeCode: existing.storeCode,
    };
    broadcastRealtimeEvent('purchases', 'PURCHASE_COMPLETED', poDelPayload);
    if (existing.storeCode) {
      broadcastRealtimeEvent(
        getStoreChannel(existing.storeCode),
        'PURCHASE_COMPLETED',
        poDelPayload
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `Draft Purchase Order ${existing.poNo} permanently deleted.`,
    });
  } catch (error: any) {
    console.error('API /api/purchases DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
