import { prisma } from '../src/lib/db';

async function activateStores() {
  const stores = [
    { code: 'CENTRAL', name: 'COSKO Central Warehouse & Owner Stock', city: 'Bengaluru', address: 'Central Hub, Bengaluru', status: 'Active' },
    { code: 'BLR', name: 'Bengaluru Central Hub', city: 'Bengaluru', address: 'Indiranagar 100ft Rd, Bengaluru', status: 'Active' },
    { code: 'HYD', name: 'Hyderabad Warehouse & Outlet', city: 'Hyderabad', address: 'Hitech City Phase 2, Hyderabad', status: 'Active' },
    { code: 'DEL', name: 'Delhi NCR Fulfillment Center', city: 'Delhi', address: 'Okhla Industrial Area Ph-III, New Delhi', status: 'Active' },
    { code: 'MUM', name: 'Mumbai Commercial Hub', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai', status: 'Active' },
  ];

  for (const s of stores) {
    await prisma.storeHub.upsert({
      where: { code: s.code },
      create: s,
      update: {
        status: 'Active',
        name: s.name,
        city: s.city,
        address: s.address,
      },
    });
  }

  console.log('✅ All 5 core stores (CENTRAL, BLR, HYD, DEL, MUM) are active in MySQL.');
  await prisma.$disconnect();
}

activateStores();
