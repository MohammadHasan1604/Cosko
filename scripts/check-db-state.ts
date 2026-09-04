import { prisma } from '../src/lib/db';

async function main() {
  const products = await prisma.product.findMany({
    include: {
      inventoryItems: true,
    },
  });

  const transfers = await prisma.stockTransfer.findMany({
    include: {
      items: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const stores = await prisma.storeHub.findMany();

  const ledger = await prisma.inventoryLedger.findMany({
    take: 20,
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log('=== STORES IN DB ===');
  console.log(stores.map((s) => `${s.code}: ${s.name} (${s.status})`));

  console.log('\n=== PRODUCTS & INVENTORY BALANCES IN DB ===');
  for (const p of products) {
    console.log(`\nProduct: ${p.name} (SKU: ${p.sku}, ID: ${p.id})`);
    if (p.inventoryItems.length === 0) {
      console.log('  -> No inventory items allocated in any store!');
    } else {
      for (const inv of p.inventoryItems) {
        console.log(`  -> Store: ${inv.storeCode}, Qty: ${inv.qtyOnHand}, Cost: ${p.baseCostPrice}`);
      }
    }
  }

  console.log('\n=== STOCK TRANSFERS IN DB ===');
  if (transfers.length === 0) {
    console.log('No stock transfers recorded in DB.');
  } else {
    for (const t of transfers) {
      console.log(`Transfer: ${t.transferNo} | From: ${t.sourceStore} -> To: ${t.destStore} | Total Units: ${t.totalUnits} | Status: ${t.status} | Profit: ${t.grossProfit}`);
    }
  }

  console.log('\n=== RECENT LEDGER ENTRIES IN DB ===');
  for (const l of ledger) {
    console.log(`Ledger: ${l.refNo} | Store: ${l.storeCode} | Type: ${l.type} | Qty: ${l.qtyChange} | BalAfter: ${l.balanceAfter}`);
  }

  await prisma.$disconnect();
}

main();
