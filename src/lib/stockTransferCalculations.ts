/**
 * Centralized Stock Transfer Calculations Core
 * Single source of truth for stock transfer arithmetic, financial precision,
 * input validation, and Indian Rupee (₹) currency & sign formatting.
 *
 * Enforced Formulas:
 * 1. Inventory Cost = Base Purchase Cost × Transfer Qty
 * 2. Transfer Value = Transfer Price/Unit × Transfer Qty
 * 3. Gross Transfer Profit = Transfer Value − Inventory Cost
 * 4. Gross Margin % = (Gross Transfer Profit / Transfer Value) × 100 (when Transfer Value > 0)
 */

/**
 * Standard 2-decimal financial rounding safe against IEEE-754 precision issues.
 */
export function round2(value: number): number {
  if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
    return 0;
  }
  // Exponential notation rounding prevents binary floating-point drift (e.g. 1.005 -> 1.01)
  return Number(Math.round(Number(value + 'e2')) + 'e-2');
}

export interface TransferLineItemInput {
  productId?: string;
  qty: number;
  costPerUnit: number;
  transferPricePerUnit: number;
}

export interface TransferLineItemCalculation {
  qty: number;
  costPerUnit: number;
  transferPricePerUnit: number;
  unitProfit: number;
  lineTotalCost: number;
  lineTotalValue: number;
  lineProfit: number;
  profitMarginPercent: number;
}

export interface TransferTotalsCalculation {
  totalUnits: number;
  totalCost: number;
  totalTransferValue: number;
  grossProfit: number;
  grossMarginPercent: number;
  items: TransferLineItemCalculation[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Calculate single transfer line item with exact 2-decimal financial precision.
 */
export function calculateTransferLineItem(input: {
  qty: number;
  costPerUnit: number;
  transferPricePerUnit: number;
}): TransferLineItemCalculation {
  const qty = Number(input.qty) || 0;
  const cost = round2(Number(input.costPerUnit) || 0);
  const transferPrice = round2(Number(input.transferPricePerUnit) || 0);

  // Formula 1: Inventory Cost = Base Purchase Cost × Transfer Qty
  const lineTotalCost = round2(cost * qty);

  // Formula 2: Transfer Value = Transfer Price/Unit × Transfer Qty
  const lineTotalValue = round2(transferPrice * qty);

  // Formula 3: Gross Transfer Profit = Transfer Value − Inventory Cost
  const lineProfit = round2(lineTotalValue - lineTotalCost);

  // Unit profit = Transfer Price/Unit − Base Purchase Cost
  const unitProfit = round2(transferPrice - cost);

  // Formula 4: Gross Margin % = (Gross Profit / Transfer Value) × 100
  const profitMarginPercent = lineTotalValue > 0 ? round2((lineProfit / lineTotalValue) * 100) : 0;

  return {
    qty,
    costPerUnit: cost,
    transferPricePerUnit: transferPrice,
    unitProfit,
    lineTotalCost,
    lineTotalValue,
    lineProfit,
    profitMarginPercent,
  };
}

/**
 * Calculate multi-item or single-item transfer totals with strict sum reconciliation.
 */
export function calculateTransferTotals(items: TransferLineItemInput[]): TransferTotalsCalculation {
  if (!items || items.length === 0) {
    return {
      totalUnits: 0,
      totalCost: 0,
      totalTransferValue: 0,
      grossProfit: 0,
      grossMarginPercent: 0,
      items: [],
    };
  }

  let totalUnits = 0;
  let totalCost = 0;
  let totalTransferValue = 0;
  const calculatedItems: TransferLineItemCalculation[] = [];

  for (const item of items) {
    const calc = calculateTransferLineItem(item);
    calculatedItems.push(calc);
    totalUnits += calc.qty;
    totalCost = round2(totalCost + calc.lineTotalCost);
    totalTransferValue = round2(totalTransferValue + calc.lineTotalValue);
  }

  // Authoritative Grand Total Gross Profit: Transfer Value - Inventory Cost
  const grossProfit = round2(totalTransferValue - totalCost);
  const grossMarginPercent = totalTransferValue > 0 ? round2((grossProfit / totalTransferValue) * 100) : 0;

  return {
    totalUnits,
    totalCost,
    totalTransferValue,
    grossProfit,
    grossMarginPercent,
    items: calculatedItems,
  };
}

/**
 * Validate header parameters for an inter-store transfer.
 */
export function validateTransferHeader(input: {
  sourceStore?: string | null;
  destStore?: string | null;
  itemsCount: number;
}): ValidationResult {
  const source = input.sourceStore ? input.sourceStore.trim().toUpperCase() : '';
  const dest = input.destStore ? input.destStore.trim().toUpperCase() : '';

  if (!source || !dest) {
    return { isValid: false, error: 'Both Source and Destination store locations are required.' };
  }

  if (source === 'ALL STORES' || source === 'ALL' || dest === 'ALL STORES' || dest === 'ALL') {
    return {
      isValid: false,
      error: '"All Stores" is a reporting scope only, not a physical store location.',
    };
  }

  if (source === dest) {
    return {
      isValid: false,
      error: `Source location and destination location cannot be identical (${source}).`,
    };
  }

  if (input.itemsCount <= 0) {
    return { isValid: false, error: 'Transfer must include at least one item.' };
  }

  return { isValid: true };
}

/**
 * Validate individual transfer item inputs for quantity, costs, and availability.
 */
export function validateTransferItem(input: {
  productId?: string;
  qty: any;
  costPerUnit: any;
  transferPricePerUnit: any;
  availableStock?: number;
}): ValidationResult {
  const numQty = Number(input.qty);

  if (isNaN(numQty) || !Number.isInteger(numQty) || numQty <= 0) {
    return {
      isValid: false,
      error: 'Transfer quantity must be a positive whole integer (minimum 1 unit).',
    };
  }

  if (input.availableStock !== undefined && input.availableStock !== null) {
    const avail = Number(input.availableStock) || 0;
    if (numQty > avail) {
      return {
        isValid: false,
        error: `Requested transfer quantity (${numQty}) exceeds available stock (${avail}).`,
      };
    }
  }

  const cost = Number(input.costPerUnit);
  if (isNaN(cost) || !isFinite(cost) || cost < 0) {
    return {
      isValid: false,
      error: 'Base purchase cost per unit cannot be negative or invalid.',
    };
  }

  const price = Number(input.transferPricePerUnit);
  if (isNaN(price) || !isFinite(price) || price < 0) {
    return {
      isValid: false,
      error: 'Transfer price per unit cannot be negative or invalid.',
    };
  }

  return { isValid: true };
}

/**
 * Format an amount in Indian Rupees (₹) with mathematically correct positive, negative, and zero signs.
 * - Negative amounts: `-₹1,234.56` (never `+₹-1,234` or `₹-1,234`)
 * - Positive amounts (with showPositiveSign): `+₹1,234.56`
 * - Positive amounts (without showPositiveSign): `₹1,234.56`
 * - Zero amounts: `₹0.00`
 */
export function formatTransferINR(
  amount: number | null | undefined,
  options: {
    showPositiveSign?: boolean;
    decimals?: number;
  } = {}
): string {
  const num = typeof amount === 'number' && isFinite(amount) ? round2(amount) : 0;
  const decimals = options.decimals !== undefined ? options.decimals : 2;

  // Handle zero cleanly (avoid -0.00 or +0.00)
  if (Math.abs(num) < 0.00001) {
    return decimals === 0 ? '₹0' : '₹0.00';
  }

  const absFormatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (num < 0) {
    return `-₹${absFormatted}`;
  }

  if (options.showPositiveSign) {
    return `+₹${absFormatted}`;
  }

  return `₹${absFormatted}`;
}

/**
 * Format profit margin percentage with correct sign and decimals.
 */
export function formatTransferMargin(percent: number | null | undefined): string {
  const num = typeof percent === 'number' && isFinite(percent) ? round2(percent) : 0;
  if (Math.abs(num) < 0.005) {
    return '0.00%';
  }
  const absFormatted = Math.abs(num).toFixed(2);
  if (num < 0) {
    return `-${absFormatted}%`;
  }
  return `+${absFormatted}%`;
}

/**
 * Returns consistent Tailwind CSS color classes based on profit value:
 * - Positive: green/emerald
 * - Negative: red/rose
 * - Zero: neutral muted
 */
export function getTransferProfitColorClass(profit: number | null | undefined): string {
  const num = typeof profit === 'number' && isFinite(profit) ? round2(profit) : 0;
  if (num > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (num < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-muted-foreground';
}
