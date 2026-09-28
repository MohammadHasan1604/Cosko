/**
 * Visual Search & Perceptual Image Fingerprinting Engine
 *
 * Provides client and server visual feature extraction:
 * 1. Perceptual Difference Hashing (dHash) - Grayscale structural gradient matrix
 * 2. Color Histogram Vector (RGB/HSV distribution) - Dominant color & palette matching
 * 3. Optical Barcode Detection - Hardware/browser native BarcodeDetector
 * 4. Composite Confidence Score Calculation (0 - 100%)
 */

export interface VisualFeature {
  dHash: string; // 64-character binary string
  colorHist: number[]; // Normalized color bin vector (64 bins: 4x4x4 RGB)
  aspectRatio: number;
}

export interface VisualMatchResult {
  productId: string;
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  sellingPrice: number;
  qtyOnHand: number;
  store: string;
  barcode?: string;
  confidence: number; // 0 to 100
  matchReason: 'visual' | 'barcode' | 'exact';
}

/**
 * Compute Hamming distance between two binary hash strings.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

/**
 * Compute cosine similarity between two normalized numeric vectors.
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normA += vec1[i] * vec1[i];
    normB += vec2[i] * vec2[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Client-side: Extract visual feature vector from an HTML Image or Canvas element.
 */
export function extractClientVisualFeature(
  imgOrCanvas: HTMLImageElement | HTMLCanvasElement
): VisualFeature | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // 1. dHash computation: 9 columns x 8 rows grayscale
    canvas.width = 9;
    canvas.height = 8;
    ctx.drawImage(imgOrCanvas, 0, 0, 9, 8);
    const imgData = ctx.getImageData(0, 0, 9, 8).data;

    let dHash = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idxLeft = (y * 9 + x) * 4;
        const idxRight = (y * 9 + (x + 1)) * 4;

        // Luminance = 0.299R + 0.587G + 0.114B
        const lumLeft =
          0.299 * imgData[idxLeft] + 0.587 * imgData[idxLeft + 1] + 0.114 * imgData[idxLeft + 2];
        const lumRight =
          0.299 * imgData[idxRight] + 0.587 * imgData[idxRight + 1] + 0.114 * imgData[idxRight + 2];

        dHash += lumLeft > lumRight ? '1' : '0';
      }
    }

    // 2. Color Histogram: 4x4x4 RGB bins (64 bins)
    canvas.width = 32;
    canvas.height = 32;
    ctx.drawImage(imgOrCanvas, 0, 0, 32, 32);
    const colorData = ctx.getImageData(0, 0, 32, 32).data;
    const bins = new Array(64).fill(0);
    const totalPixels = 32 * 32;

    for (let i = 0; i < colorData.length; i += 4) {
      const r = Math.min(3, Math.floor(colorData[i] / 64));
      const g = Math.min(3, Math.floor(colorData[i + 1] / 64));
      const b = Math.min(3, Math.floor(colorData[i + 2] / 64));
      const binIdx = r * 16 + g * 4 + b;
      bins[binIdx] += 1;
    }

    // Normalize color bins
    const normalizedColorHist = bins.map((val) => val / totalPixels);

    const origWidth = 'naturalWidth' in imgOrCanvas ? imgOrCanvas.naturalWidth : imgOrCanvas.width;
    const origHeight =
      'naturalHeight' in imgOrCanvas ? imgOrCanvas.naturalHeight : imgOrCanvas.height;
    const aspectRatio = origHeight > 0 ? origWidth / origHeight : 1;

    return {
      dHash,
      colorHist: normalizedColorHist,
      aspectRatio,
    };
  } catch (err) {
    console.warn('Could not extract client visual feature:', err);
    return null;
  }
}

/**
 * Calculate composite match confidence between two visual feature vectors.
 * Returns score between 0 and 100.
 */
export function calculateMatchConfidence(query: VisualFeature, target: VisualFeature): number {
  if (!query || !target) return 0;

  // 1. dHash similarity (Hamming distance out of 64 bits)
  const dist = hammingDistance(query.dHash, target.dHash);
  const dHashSim = Math.max(0, (64 - dist) / 64); // 0.0 to 1.0

  // 2. Color histogram similarity (Cosine similarity)
  const colorSim = Math.max(0, cosineSimilarity(query.colorHist, target.colorHist));

  // 3. Aspect ratio similarity
  const arDiff = Math.abs(query.aspectRatio - target.aspectRatio);
  const arSim = Math.max(0, 1 - arDiff / 2);

  // Weighted composite score
  // dHash carries 60% weight (shape & structural gradient)
  // Color carries 35% weight (dominant color matching)
  // Aspect ratio carries 5% weight
  const composite = 0.6 * dHashSim + 0.35 * colorSim + 0.05 * arSim;

  return Math.round(composite * 100);
}

/**
 * Detect barcode in an image/canvas if BarcodeDetector is available.
 */
export async function detectBarcodeInImage(
  imgOrCanvas: HTMLImageElement | HTMLCanvasElement
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const hasDetector = 'BarcodeDetector' in window;
  if (!hasDetector) return null;

  try {
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
    const detector = new (window as any).BarcodeDetector({ formats });
    const barcodes = await detector.detect(imgOrCanvas);
    if (barcodes && barcodes.length > 0) {
      return barcodes[0].rawValue || null;
    }
  } catch (e) {
    console.warn('BarcodeDetector error:', e);
  }
  return null;
}
