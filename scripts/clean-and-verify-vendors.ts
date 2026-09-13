import { prisma } from '../src/lib/db';

async function main() {
  // Clean up any cancelled POs that were left with Unpaid or Partial paymentStatus
  const updated = await prisma.purchaseOrder.updateMany({
    where: {
      status: 'Cancelled',
      paymentStatus: { not: 'Paid' },
    },
    data: {
      paymentStatus: 'Paid',
    },
  });
  console.log('Cleaned cancelled POs count:', updated.count);

  const vendors = await prisma.vendor.findMany({
    where: { status: { not: 'Archived' } },
    include: {
      purchases: {
        select: { totalCost: true, paidAmount: true, paymentStatus: true, status: true },
        where: {
          status: { notIn: ['Cancelled', 'Archived'] },
          paymentStatus: { not: 'Paid' },
        },
      },
    },
  });

  console.log('\n=== ACTIVE VENDORS & PAYABLES ===');
  for (const v of vendors) {
    const payable = v.purchases.reduce((sum, p) => sum + Math.max(0, Number(p.totalCost) - Number(p.paidAmount || 0)), 0);
    console.log(`Vendor: ${v.code} - ${v.name}: pending POs = ${v.purchases.length}, total payable = ₹${payable}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
