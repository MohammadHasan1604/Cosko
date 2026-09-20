import { prisma } from '../src/lib/db';

async function backfillImages() {
  console.log('--- Backfilling Product Images in Database ---');

  const products = await prisma.product.findMany();
  console.log(`Found ${products.length} products in database.`);

  const imageMap: Record<string, string> = {
    'display': 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500',
    'screen': 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500',
    'charger': 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500',
    'adapter': 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500',
    'samsung': 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500',
    's24': 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500',
    's26': 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500',
    'iphone': 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500',
    'macbook': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500',
    'laptop': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500',
    'headphone': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    'battery': 'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?w=500',
  };

  let updatedCount = 0;
  for (const prod of products) {
    if (!prod.imageUrl) {
      const lowerName = prod.name.toLowerCase();
      let matchedUrl = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500'; // high-tech hardware fallback

      for (const [key, url] of Object.entries(imageMap)) {
        if (lowerName.includes(key)) {
          matchedUrl = url;
          break;
        }
      }

      await prisma.product.update({
        where: { id: prod.id },
        data: { imageUrl: matchedUrl },
      });
      console.log(`Updated "${prod.name}" (${prod.sku}) -> ${matchedUrl}`);
      updatedCount++;
    }
  }

  console.log(`✅ Backfilled images for ${updatedCount} products.`);
}

backfillImages()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
