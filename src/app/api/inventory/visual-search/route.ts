import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  VisualFeature,
  hammingDistance,
  cosineSimilarity,
  calculateMatchConfidence,
} from '@/lib/visualSearch';
import sharp from 'sharp';

// In-memory cache for product image features to ensure sub-20ms visual search
interface CachedFeature {
  feature: VisualFeature;
  updatedAt: number;
}
const productFeatureCache = new Map<string, CachedFeature>();

/**
 * Extract visual feature vector from an image Buffer using Sharp
 */
async function extractFeatureFromBuffer(buffer: Buffer): Promise<VisualFeature | null> {
  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width || 100;
    const height = meta.height || 100;
    const aspectRatio = height > 0 ? width / height : 1;

    // 1. dHash computation: 9 cols x 8 rows grayscale
    const grayBuffer = await sharp(buffer)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    let dHash = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = grayBuffer[y * 9 + x];
        const right = grayBuffer[y * 9 + (x + 1)];
        dHash += left > right ? '1' : '0';
      }
    }

    // 2. Color Histogram: 32x32 RGB
    const rgbBuffer = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();

    const bins = new Array(64).fill(0);
    const totalPixels = 32 * 32;

    for (let i = 0; i < rgbBuffer.length; i += 3) {
      const r = Math.min(3, Math.floor(rgbBuffer[i] / 64));
      const g = Math.min(3, Math.floor(rgbBuffer[i + 1] / 64));
      const b = Math.min(3, Math.floor(rgbBuffer[i + 2] / 64));
      const binIdx = r * 16 + g * 4 + b;
      bins[binIdx] += 1;
    }

    const normalizedColorHist = bins.map((v) => v / totalPixels);

    return {
      dHash,
      colorHist: normalizedColorHist,
      aspectRatio,
    };
  } catch (err) {
    console.warn('Sharp feature extraction failed:', err);
    return null;
  }
}

/**
 * Resolve an image URL (data URI or remote HTTP URL) to Buffer
 */
async function resolveImageToBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1] || imageUrl;
      return Buffer.from(base64Data, 'base64');
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * POST /api/inventory/visual-search
 * 
 * Body: {
 *   image: string; // Base64 data URL
 *   store?: string; // Current store code, e.g. 'BLR' or 'CENTRAL'
 *   barcode?: string; // Optional optical barcode detected in image
 *   limit?: number; // Max results to return, default 10
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { image, store = 'CENTRAL', barcode, limit = 10 } = body;

    if (!image && !barcode) {
      return NextResponse.json(
        { error: 'Please provide an image or detected barcode for visual search' },
        { status: 400 }
      );
    }

    // Step 1: Decode Query Image
    let queryFeature: VisualFeature | null = null;
    if (image) {
      const queryBuffer = await resolveImageToBuffer(image);
      if (queryBuffer) {
        queryFeature = await extractFeatureFromBuffer(queryBuffer);
      }
    }

    // Step 2: Fetch Active Database Products with Real Store Inventory
    const products = await prisma.product.findMany({
      where: {
        status: { notIn: ['deleted', 'archived'] },
      },
      include: {
        inventoryItems: true,
      },
    });

    if (!products.length) {
      return NextResponse.json({ success: true, count: 0, matches: [] });
    }

    const effectiveStore = store || 'CENTRAL';
    const candidateMatches: any[] = [];

    // Step 3: Match Against Actual Inventory Records
    for (const prod of products) {
      // Find stock in target store or across all stores
      const storeInv = prod.inventoryItems.find(
        (it) => it.storeCode.toUpperCase() === effectiveStore.toUpperCase()
      );
      const qtyOnHand = storeInv ? storeInv.qtyOnHand : 0;
      const locationStock: Record<string, number> = {};
      prod.inventoryItems.forEach((it) => {
        locationStock[it.storeCode] = it.qtyOnHand;
      });

      const productSellingPrice = Number(prod.baseSellingPrice) || 0;
      const productCostPrice = Number(prod.baseCostPrice) || 0;
      const productMrp = prod.mrp ? Number(prod.mrp) : productSellingPrice;

      // 3A. Optical Barcode / SKU Exact Match (Confidence: 99-100%)
      if (
        barcode &&
        ((prod.barcode && prod.barcode === barcode) || prod.sku === barcode)
      ) {
        candidateMatches.push({
          id: storeInv?.id || `${prod.id}-${effectiveStore}`,
          productId: prod.id,
          sku: prod.sku,
          barcode: prod.barcode || '',
          name: prod.name,
          brand: prod.brand || '',
          model: prod.model || '',
          category: prod.category,
          subcategory: prod.subcategory || '',
          description: prod.description || '',
          imageUrl: prod.imageUrl || undefined,
          sellingPrice: productSellingPrice,
          costPrice: productCostPrice,
          mrp: productMrp,
          warrantyMonths: prod.warrantyMonths || 12,
          qtyOnHand,
          store: effectiveStore,
          locationStock,
          confidence: 100,
          matchReason: 'barcode',
        });
        continue;
      }

      // 3B. Visual Perceptual Match (if product has an image and query feature was extracted)
      if (prod.imageUrl && queryFeature) {
        let cached = productFeatureCache.get(prod.id);

        if (!cached) {
          const prodBuf = await resolveImageToBuffer(prod.imageUrl);
          if (prodBuf) {
            const feat = await extractFeatureFromBuffer(prodBuf);
            if (feat) {
              cached = { feature: feat, updatedAt: Date.now() };
              productFeatureCache.set(prod.id, cached);
            }
          }
        }

        if (cached?.feature) {
          const confidence = calculateMatchConfidence(queryFeature, cached.feature);

          // Threshold: Include products with confidence >= 35%
          if (confidence >= 35) {
            candidateMatches.push({
              id: storeInv?.id || `${prod.id}-${effectiveStore}`,
              productId: prod.id,
              sku: prod.sku,
              barcode: prod.barcode || '',
              name: prod.name,
              brand: prod.brand || '',
              model: prod.model || '',
              category: prod.category,
              subcategory: prod.subcategory || '',
              description: prod.description || '',
              imageUrl: prod.imageUrl,
              sellingPrice: productSellingPrice,
              costPrice: productCostPrice,
              mrp: productMrp,
              warrantyMonths: prod.warrantyMonths || 12,
              qtyOnHand,
              store: effectiveStore,
              locationStock,
              confidence,
              matchReason: 'visual',
            });
          }
        }
      }
    }

    // Sort by confidence descending
    candidateMatches.sort((a, b) => b.confidence - a.confidence);

    const matches = candidateMatches.slice(0, limit);

    return NextResponse.json(
      {
        success: true,
        count: matches.length,
        store: effectiveStore,
        matches,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    console.error('Visual search API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform visual search', details: error.message },
      { status: 500 }
    );
  }
}
