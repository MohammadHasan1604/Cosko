import { prisma } from '../src/lib/db';

async function migrateAndBackfillLedger() {
  console.log('========================================================================');
  console.log('🚀 FINANCIAL LEDGER MIGRATION & IDEMPOTENT BACKFILL');
  console.log('========================================================================\n');

  // 1. Create table if not exists using Prisma raw SQL or verify connection
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS financial_ledger (
        id VARCHAR(191) NOT NULL PRIMARY KEY,
        entry_no VARCHAR(64) NOT NULL UNIQUE,
        entry_date DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        store_code VARCHAR(16) NOT NULL,
        account_category VARCHAR(32) NOT NULL,
        account_name VARCHAR(64) NOT NULL,
        debit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        credit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        amount DECIMAL(15, 2) NOT NULL,
        ref_type VARCHAR(32) NOT NULL,
        ref_id VARCHAR(64) NULL,
        ref_no VARCHAR(64) NOT NULL,
        entity_name VARCHAR(128) NULL,
        description VARCHAR(255) NOT NULL,
        is_eliminated BOOLEAN NOT NULL DEFAULT FALSE,
        metadata_json TEXT NULL,
        created_by VARCHAR(128) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX financial_ledger_store_code_idx (store_code),
        INDEX financial_ledger_entry_date_idx (entry_date),
        INDEX financial_ledger_account_category_idx (account_category),
        INDEX financial_ledger_ref_type_idx (ref_type),
        INDEX financial_ledger_ref_no_idx (ref_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ financial_ledger table verified/created in MySQL.');
  } catch (err: any) {
    console.log('Note on table creation:', err.message);
  }

  let createdCount = 0;
  let skippedCount = 0;

  async function createEntryIfMissing(entry: {
    entryNo: string;
    entryDate: Date;
    storeCode: string;
    accountCategory: string;
    accountName: string;
    debit: number;
    credit: number;
    amount: number;
    refType: string;
    refId?: string | null;
    refNo: string;
    entityName?: string | null;
    description: string;
    isEliminated?: boolean;
    metadataJson?: string | null;
    createdBy: string;
  }) {
    const existing = await (prisma as any).financialLedgerEntry.findUnique({
      where: { entryNo: entry.entryNo },
    });
    if (existing) {
      skippedCount++;
      return;
    }
    await (prisma as any).financialLedgerEntry.create({
      data: {
        entryNo: entry.entryNo,
        entryDate: entry.entryDate,
        storeCode: entry.storeCode,
        accountCategory: entry.accountCategory,
        accountName: entry.accountName,
        debit: entry.debit,
        credit: entry.credit,
        amount: entry.amount,
        refType: entry.refType,
        refId: entry.refId || null,
        refNo: entry.refNo,
        entityName: entry.entityName || null,
        description: entry.description,
        isEliminated: entry.isEliminated || false,
        metadataJson: entry.metadataJson || null,
        createdBy: entry.createdBy,
        createdAt: entry.entryDate,
      },
    });
    createdCount++;
  }

  // --------------------------------------------------------------------------
  // 2. BACKFILL HISTORICAL SALES
  // --------------------------------------------------------------------------
  console.log('\n--- Processing Historical Sales Orders ---');
  const sales = await prisma.salesOrder.findMany({
    include: { items: true },
  });
  console.log(`Found ${sales.length} sales orders in database.`);

  for (const s of sales) {
    if (s.status === 'Cancelled' || s.status === 'Voided') continue;

    const netSalesRevenue = Number(s.subtotal) - Number(s.discountAmount || 0);
    const taxAmount = Number(s.taxAmount || 0);
    const grandTotal = Number(s.grandTotal);
    const cogs = Number(s.totalCost);

    // Sales Revenue Credit
    await createEntryIfMissing({
      entryNo: `JRN-REV-${s.orderNo}`,
      entryDate: s.createdAt,
      storeCode: s.storeCode,
      accountCategory: 'REVENUE',
      accountName: 'Gross Sales Revenue',
      debit: 0,
      credit: netSalesRevenue,
      amount: netSalesRevenue,
      refType: 'SALE',
      refId: s.id,
      refNo: s.orderNo,
      entityName: s.customerName || 'Customer',
      description: `POS Billed Sales Revenue for Invoice ${s.orderNo}`,
      createdBy: s.cashierName || 'Cashier',
    });

    // Tax Liability Credit
    if (taxAmount > 0) {
      await createEntryIfMissing({
        entryNo: `JRN-TAX-${s.orderNo}`,
        entryDate: s.createdAt,
        storeCode: s.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'GST Output Tax Liability',
        debit: 0,
        credit: taxAmount,
        amount: taxAmount,
        refType: 'SALE',
        refId: s.id,
        refNo: s.orderNo,
        entityName: s.customerName || 'Customer',
        description: `GST Collected on Invoice ${s.orderNo}`,
        createdBy: s.cashierName || 'Cashier',
      });
    }

    // Cash / Receivables Debit
    await createEntryIfMissing({
      entryNo: `JRN-ASST-${s.orderNo}`,
      entryDate: s.createdAt,
      storeCode: s.storeCode,
      accountCategory: 'ASSET',
      accountName: s.paymentMethod === 'Credit' ? 'Customer Accounts Receivable' : `Cash / Bank (${s.paymentMethod})`,
      debit: grandTotal,
      credit: 0,
      amount: grandTotal,
      refType: 'SALE',
      refId: s.id,
      refNo: s.orderNo,
      entityName: s.customerName || 'Customer',
      description: `Payment Receipt via ${s.paymentMethod} for Invoice ${s.orderNo}`,
      createdBy: s.cashierName || 'Cashier',
    });

    // COGS Debit
    if (cogs > 0) {
      await createEntryIfMissing({
        entryNo: `JRN-COGS-${s.orderNo}`,
        entryDate: s.createdAt,
        storeCode: s.storeCode,
        accountCategory: 'COGS',
        accountName: 'Cost of Goods Sold',
        debit: cogs,
        credit: 0,
        amount: cogs,
        refType: 'SALE',
        refId: s.id,
        refNo: s.orderNo,
        entityName: s.customerName || 'Customer',
        description: `Inventory Cost of Goods Sold for Invoice ${s.orderNo}`,
        createdBy: s.cashierName || 'Cashier',
      });

      // Inventory Asset Credit
      await createEntryIfMissing({
        entryNo: `JRN-INVD-${s.orderNo}`,
        entryDate: s.createdAt,
        storeCode: s.storeCode,
        accountCategory: 'ASSET',
        accountName: 'Inventory Asset (Depletion)',
        debit: 0,
        credit: cogs,
        amount: -cogs,
        refType: 'SALE',
        refId: s.id,
        refNo: s.orderNo,
        entityName: s.customerName || 'Customer',
        description: `Stock Depletion for POS Sale ${s.orderNo}`,
        createdBy: s.cashierName || 'Cashier',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. BACKFILL HISTORICAL PURCHASES (GRN)
  // --------------------------------------------------------------------------
  console.log('\n--- Processing Historical Purchase Orders & GRN ---');
  const purchases = await prisma.purchaseOrder.findMany({
    include: { vendor: true, payments: true },
  });
  console.log(`Found ${purchases.length} purchase orders in database.`);

  for (const po of purchases) {
    if (po.status === 'Cancelled' || po.status === 'Archived') continue;

    const totalCost = Number(po.totalCost);

    if (po.status === 'Received' || po.status === 'Completed') {
      // Inventory Asset Debit
      await createEntryIfMissing({
        entryNo: `JRN-GRN-INVA-${po.poNo}`,
        entryDate: po.receivedDate || po.createdAt,
        storeCode: po.storeCode,
        accountCategory: 'ASSET',
        accountName: 'Inventory Asset (Procurement)',
        debit: totalCost,
        credit: 0,
        amount: totalCost,
        refType: 'PURCHASE_GRN',
        refId: po.id,
        refNo: po.poNo,
        entityName: po.vendor?.name || 'Vendor',
        description: `Goods Received Note (GRN) from ${po.vendor?.name || 'Vendor'} against Bill #${po.invoiceNo || po.poNo}`,
        createdBy: po.createdBy || 'Inventory Staff',
      });

      // Accounts Payable Credit
      await createEntryIfMissing({
        entryNo: `JRN-GRN-AP-${po.poNo}`,
        entryDate: po.receivedDate || po.createdAt,
        storeCode: po.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'Vendor Accounts Payable',
        debit: 0,
        credit: totalCost,
        amount: totalCost,
        refType: 'PURCHASE_GRN',
        refId: po.id,
        refNo: po.poNo,
        entityName: po.vendor?.name || 'Vendor',
        description: `Payable obligation to ${po.vendor?.name || 'Vendor'} for Bill #${po.invoiceNo || po.poNo}`,
        createdBy: po.createdBy || 'Inventory Staff',
      });
    }

    // Process Payments for this PO
    for (const pay of po.payments) {
      const payAmount = Number(pay.amount);
      const voucherNo = pay.voucherNo || `PV-${pay.id.slice(0, 8)}`;

      // Accounts Payable Debit
      await createEntryIfMissing({
        entryNo: `JRN-PAY-AP-${voucherNo}`,
        entryDate: pay.paymentDate,
        storeCode: po.storeCode,
        accountCategory: 'LIABILITY',
        accountName: 'Vendor Accounts Payable (Settlement)',
        debit: payAmount,
        credit: 0,
        amount: -payAmount,
        refType: 'VENDOR_PAYMENT',
        refId: pay.id,
        refNo: voucherNo,
        entityName: po.vendor?.name || 'Vendor',
        description: `Vendor bill payment for Bill #${po.invoiceNo || po.poNo} via ${pay.paymentMethod}`,
        createdBy: pay.recordedBy || 'Finance Staff',
      });

      // Bank / Cash Credit
      await createEntryIfMissing({
        entryNo: `JRN-PAY-BANK-${voucherNo}`,
        entryDate: pay.paymentDate,
        storeCode: po.storeCode,
        accountCategory: 'ASSET',
        accountName: `Cash / Bank (${pay.paymentMethod})`,
        debit: 0,
        credit: payAmount,
        amount: -payAmount,
        refType: 'VENDOR_PAYMENT',
        refId: pay.id,
        refNo: voucherNo,
        entityName: po.vendor?.name || 'Vendor',
        description: `Bank disbursement for Vendor Bill #${po.invoiceNo || po.poNo} (Voucher ${voucherNo})`,
        createdBy: pay.recordedBy || 'Finance Staff',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. BACKFILL HISTORICAL EXPENSES
  // --------------------------------------------------------------------------
  console.log('\n--- Processing Historical Expenses ---');
  const expenses = await prisma.expense.findMany();
  console.log(`Found ${expenses.length} expenses in database.`);

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    const isCentral = exp.storeCode === 'CENTRAL' || exp.category.toLowerCase().includes('freight') || exp.description.toLowerCase().includes('central');

    // Expense Debit
    await createEntryIfMissing({
      entryNo: `JRN-EXP-${exp.expenseNo}`,
      entryDate: exp.date,
      storeCode: exp.storeCode,
      accountCategory: isCentral ? 'CENTRAL_EXPENSE' : 'OPERATING_EXPENSE',
      accountName: `Operating Expense: ${exp.category}`,
      debit: amount,
      credit: 0,
      amount: amount,
      refType: 'EXPENSE',
      refId: exp.id,
      refNo: exp.expenseNo,
      description: `${exp.category} Expense: ${exp.description || 'General Operational Expense'}`,
      createdBy: exp.approvedBy || 'Manager',
    });

    // Bank Credit
    await createEntryIfMissing({
      entryNo: `JRN-EXP-BANK-${exp.expenseNo}`,
      entryDate: exp.date,
      storeCode: exp.storeCode,
      accountCategory: 'ASSET',
      accountName: `Cash / Bank (${exp.paymentMethod})`,
      debit: 0,
      credit: amount,
      amount: -amount,
      refType: 'EXPENSE',
      refId: exp.id,
      refNo: exp.expenseNo,
      description: `Disbursement for ${exp.category} (${exp.expenseNo})`,
      createdBy: exp.approvedBy || 'Manager',
    });
  }

  // --------------------------------------------------------------------------
  // 5. BACKFILL HISTORICAL STOCK TRANSFERS
  // --------------------------------------------------------------------------
  console.log('\n--- Processing Historical Stock Transfers ---');
  const transfers = await prisma.stockTransfer.findMany({
    include: { items: true },
  });
  console.log(`Found ${transfers.length} stock transfers in database.`);

  for (const t of transfers) {
    if (t.status === 'Cancelled') continue;

    const totalCost = Number(t.totalCost);
    const totalValue = Number(t.totalTransferValue);
    const grossProfit = Number(t.grossProfit);

    // Central Transfer Markup Credit (Eliminated in Consolidated P&L)
    await createEntryIfMissing({
      entryNo: `JRN-TRF-MKP-${t.transferNo}`,
      entryDate: t.shipDate,
      storeCode: t.sourceStore,
      accountCategory: 'TRANSFER_MARKUP',
      accountName: 'Central Stock Transfer Markup',
      debit: 0,
      credit: grossProfit,
      amount: grossProfit,
      refType: 'STOCK_TRANSFER',
      refId: t.id,
      refNo: t.transferNo,
      description: `Internal Transfer Margin from ${t.sourceStore} to ${t.destStore} (${t.transferNo})`,
      isEliminated: true,
      createdBy: t.requestedBy || 'Central Logistics',
    });

    // Inter-Store Clearing Debit (Eliminated)
    await createEntryIfMissing({
      entryNo: `JRN-TRF-CLR-${t.transferNo}`,
      entryDate: t.shipDate,
      storeCode: t.sourceStore,
      accountCategory: 'ASSET',
      accountName: 'Inter-Store Clearing Account',
      debit: totalValue,
      credit: 0,
      amount: totalValue,
      refType: 'STOCK_TRANSFER',
      refId: t.id,
      refNo: t.transferNo,
      description: `Inter-store transfer charge to ${t.destStore} (${t.transferNo})`,
      isEliminated: true,
      createdBy: t.requestedBy || 'Central Logistics',
    });

    // Central Inventory Asset Credit (at purchase cost)
    await createEntryIfMissing({
      entryNo: `JRN-TRF-SRC-${t.transferNo}`,
      entryDate: t.shipDate,
      storeCode: t.sourceStore,
      accountCategory: 'ASSET',
      accountName: 'Inventory Asset (Inter-Store Dispatch)',
      debit: 0,
      credit: totalCost,
      amount: -totalCost,
      refType: 'STOCK_TRANSFER',
      refId: t.id,
      refNo: t.transferNo,
      description: `Stock dispatched from ${t.sourceStore} to ${t.destStore} (${t.transferNo})`,
      isEliminated: true,
      createdBy: t.requestedBy || 'Central Logistics',
    });

    // Store Inventory Asset Debit (at transfer price)
    await createEntryIfMissing({
      entryNo: `JRN-TRF-DST-${t.transferNo}`,
      entryDate: t.receiveDate || t.shipDate,
      storeCode: t.destStore,
      accountCategory: 'ASSET',
      accountName: 'Inventory Asset (Store Inbound Receipt)',
      debit: totalValue,
      credit: 0,
      amount: totalValue,
      refType: 'STOCK_TRANSFER',
      refId: t.id,
      refNo: t.transferNo,
      description: `Stock received at ${t.destStore} from ${t.sourceStore} at Transfer Price (${t.transferNo})`,
      isEliminated: true,
      createdBy: t.receivedBy || t.requestedBy || 'Store Manager',
    });

    // Inter-Store Payable Clearing Credit (Eliminated)
    await createEntryIfMissing({
      entryNo: `JRN-TRF-DST-CLR-${t.transferNo}`,
      entryDate: t.receiveDate || t.shipDate,
      storeCode: t.destStore,
      accountCategory: 'LIABILITY',
      accountName: 'Inter-Store Payable Clearing',
      debit: 0,
      credit: totalValue,
      amount: totalValue,
      refType: 'STOCK_TRANSFER',
      refId: t.id,
      refNo: t.transferNo,
      description: `Inter-store transfer payable clearing for receipt from ${t.sourceStore} (${t.transferNo})`,
      isEliminated: true,
      createdBy: t.receivedBy || t.requestedBy || 'Store Manager',
    });
  }

  // --------------------------------------------------------------------------
  // 6. BACKFILL INVENTORY ADJUSTMENTS
  // --------------------------------------------------------------------------
  console.log('\n--- Processing Historical Inventory Adjustments ---');
  const adjustments = await prisma.inventoryLedger.findMany({
    where: {
      type: { in: ['ADJUSTMENT', 'Stock Adjustment', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] },
    },
  });
  console.log(`Found ${adjustments.length} inventory adjustments.`);

  for (const adj of adjustments) {
    const cost = Number(adj.costPerUnit) || 0;
    const absQty = Math.abs(adj.qtyChange);
    const financialImpact = absQty * cost;

    if (financialImpact > 0) {
      if (adj.qtyChange < 0) {
        // Stock write-down / shrinkage
        await createEntryIfMissing({
          entryNo: `JRN-ADJ-LOSS-${adj.id.slice(0, 8)}`,
          entryDate: adj.createdAt,
          storeCode: adj.storeCode,
          accountCategory: 'OPERATING_EXPENSE',
          accountName: 'Inventory Shrinkage & Spoilage Expense',
          debit: financialImpact,
          credit: 0,
          amount: financialImpact,
          refType: 'INVENTORY_ADJUSTMENT',
          refId: adj.id,
          refNo: adj.refNo || `ADJ-${adj.id.slice(0, 6)}`,
          description: `Inventory reduction adjustment: ${adj.notes || 'Damage/Shrinkage'}`,
          createdBy: adj.createdBy || 'Inventory Auditor',
        });
      } else {
        // Stock write-up / surplus found
        await createEntryIfMissing({
          entryNo: `JRN-ADJ-GAIN-${adj.id.slice(0, 8)}`,
          entryDate: adj.createdAt,
          storeCode: adj.storeCode,
          accountCategory: 'REVENUE',
          accountName: 'Inventory Count Surplus & Gain',
          debit: 0,
          credit: financialImpact,
          amount: financialImpact,
          refType: 'INVENTORY_ADJUSTMENT',
          refId: adj.id,
          refNo: adj.refNo || `ADJ-${adj.id.slice(0, 6)}`,
          description: `Inventory surplus audit adjustment: ${adj.notes || 'Found stock'}`,
          createdBy: adj.createdBy || 'Inventory Auditor',
        });
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`🎉 COMPLETED: Created ${createdCount} new ledger entries, skipped ${skippedCount} existing.`);
  console.log('========================================================================\n');

  const totalEntries = await (prisma as any).financialLedgerEntry.count();
  console.log(`Total active Financial Ledger entries in MySQL: ${totalEntries}`);
}

migrateAndBackfillLedger()
  .catch((err) => {
    console.error('Fatal error during migration:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
