import { prisma } from '../src/lib/db';

async function main() {
  const vendors = await prisma.vendor.findMany({
    include: { purchases: true },
  });
  console.log('=== VENDORS COUNT:', vendors.length);
  for (const v of vendors) {
    console.log(`Vendor: [${v.id}] ${v.code} - ${v.name} (status: ${v.status})`);
    console.log(`  Purchases: ${v.purchases.length}`);
    for (const p of v.purchases) {
      console.log(`    PO: ${p.poNo}, store: ${p.storeCode}, status: ${p.status}, paymentStatus: ${p.paymentStatus}, totalCost: ${p.totalCost}, paidAmount: ${p.paidAmount}`);
    }
  }

  const allPOs = await prisma.purchaseOrder.findMany({
    include: { vendor: true },
  });
  console.log('\n=== ALL PURCHASE ORDERS COUNT:', allPOs.length);
  for (const p of allPOs) {
    console.log(`PO: [${p.id}] ${p.poNo}, store: ${p.storeCode}, vendorId: ${p.vendorId}, vendor: ${p.vendor?.name || 'ORPHANED/NULL'}, status: ${p.status}, paymentStatus: ${p.paymentStatus}, totalCost: ${p.totalCost}, paidAmount: ${p.paidAmount}, date: ${p.orderDate}`);
  }

  const sales = await prisma.salesOrder.findMany({
    include: { items: true },
  });
  console.log('\n=== SALES COUNT:', sales.length);
  let totalRev = 0;
  for (const s of sales) {
    totalRev += Number(s.grandTotal);
    console.log(`Sale: ${s.orderNo}, store: ${s.storeCode}, total: ${s.grandTotal}, profit: ${s.grossProfit}, items: ${s.items.length}, date: ${s.createdAt}`);
  }
  console.log('Total sales revenue in DB:', totalRev);

  const expenses = await prisma.expense.findMany();
  console.log('\n=== EXPENSES COUNT:', expenses.length);
  for (const e of expenses) {
    console.log(`Expense: ${e.expenseNo}, store: ${e.storeCode}, cat: ${e.category}, amount: ${e.amount}, date: ${e.date}`);
  }

  const customers = await prisma.customer.findMany();
  console.log('\n=== CUSTOMERS COUNT:', customers.length);
  for (const c of customers) {
    if (Number(c.creditBalance) > 0 || Number(c.totalSpent) > 0) {
      console.log(`Customer: ${c.name}, phone: ${c.phone}, creditBalance: ${c.creditBalance}, totalSpent: ${c.totalSpent}`);
    }
  }

  const inventory = await prisma.inventory.findMany({
    include: { product: true },
  });
  console.log('\n=== INVENTORY RECORDS COUNT:', inventory.length);
  let invAssetVal = 0;
  for (const i of inventory) {
    const val = Number(i.product.baseCostPrice) * i.qtyOnHand;
    invAssetVal += val;
  }
  console.log('Total inventory asset value in DB:', invAssetVal);
}

main().catch(console.error).finally(() => prisma.$disconnect());
