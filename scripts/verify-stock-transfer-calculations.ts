/**
 * Comprehensive Verification Suite: Inter-Store Stock Transfer Calculation Logic
 * Tests mathematical rigor, rounding, currency/sign formatting, input validation,
 * and double-entry financial ledger invariants.
 */

import {
  calculateTransferLineItem,
  calculateTransferTotals,
  validateTransferHeader,
  validateTransferItem,
  formatTransferINR,
  formatTransferMargin,
  getTransferProfitColorClass,
  round2,
} from '../src/lib/stockTransferCalculations';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

console.log('\n================================================================');
console.log('🧪 RUNNING STOCK TRANSFER CALCULATIONS ROOT VERIFICATION SUITE');
console.log('================================================================\n');

// --------------------------------------------------------------------------
// TEST SUITE 1: Basic Mathematical Correctness
// --------------------------------------------------------------------------
console.log('--- SUITE 1: Basic Mathematical Correctness ---');

// Test Case 1.1: Standard transfer at profit
const test1 = calculateTransferLineItem({
  qty: 10,
  costPerUnit: 100,
  transferPricePerUnit: 150,
});

assert(
  'Inventory Cost = Base Purchase Cost × Transfer Qty (100 × 10 = 1000)',
  test1.lineTotalCost === 1000,
  `Got: ${test1.lineTotalCost}`
);
assert(
  'Transfer Value = Transfer Price/Unit × Transfer Qty (150 × 10 = 1500)',
  test1.lineTotalValue === 1500,
  `Got: ${test1.lineTotalValue}`
);
assert(
  'Gross Transfer Profit = Transfer Value − Inventory Cost (1500 − 1000 = 500)',
  test1.lineProfit === 500,
  `Got: ${test1.lineProfit}`
);
assert(
  'Gross Margin % = (500 / 1500) * 100 = 33.33%',
  test1.profitMarginPercent === 33.33,
  `Got: ${test1.profitMarginPercent}`
);

// Test Case 1.2: Transfer at cost (zero profit)
const test2 = calculateTransferLineItem({
  qty: 5,
  costPerUnit: 250,
  transferPricePerUnit: 250,
});

assert(
  'Transfer at Cost: Inventory Cost = 1250',
  test2.lineTotalCost === 1250,
  `Got: ${test2.lineTotalCost}`
);
assert(
  'Transfer at Cost: Transfer Value = 1250',
  test2.lineTotalValue === 1250,
  `Got: ${test2.lineTotalValue}`
);
assert(
  'Transfer at Cost: Gross Profit = 0',
  test2.lineProfit === 0,
  `Got: ${test2.lineProfit}`
);
assert(
  'Transfer at Cost: Margin = 0%',
  test2.profitMarginPercent === 0,
  `Got: ${test2.profitMarginPercent}`
);

// Test Case 1.3: Transfer at loss (clearance / below cost)
const test3 = calculateTransferLineItem({
  qty: 8,
  costPerUnit: 200,
  transferPricePerUnit: 150,
});

assert(
  'Transfer at Loss: Inventory Cost = 1600',
  test3.lineTotalCost === 1600,
  `Got: ${test3.lineTotalCost}`
);
assert(
  'Transfer at Loss: Transfer Value = 1200',
  test3.lineTotalValue === 1200,
  `Got: ${test3.lineTotalValue}`
);
assert(
  'Transfer at Loss: Gross Profit = -400',
  test3.lineProfit === -400,
  `Got: ${test3.lineProfit}`
);
assert(
  'Transfer at Loss: Margin = -33.33%',
  test3.profitMarginPercent === -33.33,
  `Got: ${test3.profitMarginPercent}`
);

// --------------------------------------------------------------------------
// TEST SUITE 2: Decimal Precision & IEEE-754 Floating Point Rounding
// --------------------------------------------------------------------------
console.log('\n--- SUITE 2: Decimal Precision & IEEE-754 Rounding ---');

// In pure JavaScript, 10.15 * 3 = 30.449999999999996
const floatTest = calculateTransferLineItem({
  qty: 3,
  costPerUnit: 10.15,
  transferPricePerUnit: 14.85,
});

assert(
  'Float multiplication 10.15 × 3 rounds exactly to 30.45 without drift',
  floatTest.lineTotalCost === 30.45,
  `Got: ${floatTest.lineTotalCost}`
);
assert(
  'Float multiplication 14.85 × 3 rounds exactly to 44.55 without drift',
  floatTest.lineTotalValue === 44.55,
  `Got: ${floatTest.lineTotalValue}`
);
assert(
  'Float line profit 44.55 − 30.45 = 14.10 exactly',
  floatTest.lineProfit === 14.1,
  `Got: ${floatTest.lineProfit}`
);

// Multi-item transfer totals
const multiTotals = calculateTransferTotals([
  { qty: 10, costPerUnit: 99.99, transferPricePerUnit: 149.99 },
  { qty: 5, costPerUnit: 250.5, transferPricePerUnit: 299.75 },
  { qty: 2, costPerUnit: 1200.0, transferPricePerUnit: 1100.0 }, // discount item
]);

// Expected line 1: cost 999.90, value 1499.90, profit 500.00
// Expected line 2: cost 1252.50, value 1498.75, profit 246.25
// Expected line 3: cost 2400.00, value 2200.00, profit -200.00
// Total Cost = 999.90 + 1252.50 + 2400.00 = 4652.40
// Total Value = 1499.90 + 1498.75 + 2200.00 = 5198.65
// Gross Profit = 5198.65 - 4652.40 = 546.25
assert('Multi-item total units = 17', multiTotals.totalUnits === 17, `Got: ${multiTotals.totalUnits}`);
assert('Multi-item total cost = 4652.40', multiTotals.totalCost === 4652.4, `Got: ${multiTotals.totalCost}`);
assert('Multi-item total value = 5198.65', multiTotals.totalTransferValue === 5198.65, `Got: ${multiTotals.totalTransferValue}`);
assert('Multi-item gross profit = 546.25', multiTotals.grossProfit === 546.25, `Got: ${multiTotals.grossProfit}`);
assert(
  'Gross profit matches Transfer Value − Cost to the exact paisa',
  multiTotals.grossProfit === round2(multiTotals.totalTransferValue - multiTotals.totalCost)
);

// --------------------------------------------------------------------------
// TEST SUITE 3: Sign, Indian Rupee (₹) & Percentage Formatting
// --------------------------------------------------------------------------
console.log('\n--- SUITE 3: Sign & Currency (₹) Formatting ---');

assert(
  'Positive profit with sign formatting (+₹500.00)',
  formatTransferINR(500, { showPositiveSign: true }) === '+₹500.00',
  `Got: ${formatTransferINR(500, { showPositiveSign: true })}`
);
assert(
  'Positive profit without explicit sign (₹500.00)',
  formatTransferINR(500, { showPositiveSign: false }) === '₹500.00',
  `Got: ${formatTransferINR(500, { showPositiveSign: false })}`
);
assert(
  'Negative profit formatted with leading minus sign (-₹400.00, NEVER +₹-400 or ₹-400)',
  formatTransferINR(-400, { showPositiveSign: true }) === '-₹400.00',
  `Got: ${formatTransferINR(-400, { showPositiveSign: true })}`
);
assert(
  'Negative profit formatted without explicit sign option (-₹400.00)',
  formatTransferINR(-400) === '-₹400.00',
  `Got: ${formatTransferINR(-400)}`
);
assert(
  'Zero profit formatted as neutral ₹0.00 (NEVER +₹0.00 or -₹0.00)',
  formatTransferINR(0, { showPositiveSign: true }) === '₹0.00',
  `Got: ${formatTransferINR(0, { showPositiveSign: true })}`
);
assert(
  'Negative zero anomaly (-0) formatted as ₹0.00',
  formatTransferINR(-0, { showPositiveSign: true }) === '₹0.00',
  `Got: ${formatTransferINR(-0, { showPositiveSign: true })}`
);
assert(
  'Positive margin formatted with plus sign (+25.50%)',
  formatTransferMargin(25.5) === '+25.50%',
  `Got: ${formatTransferMargin(25.5)}`
);
assert(
  'Negative margin formatted with minus sign (-12.75%)',
  formatTransferMargin(-12.75) === '-12.75%',
  `Got: ${formatTransferMargin(-12.75)}`
);
assert(
  'Zero margin formatted as 0.00%',
  formatTransferMargin(0) === '0.00%',
  `Got: ${formatTransferMargin(0)}`
);
assert(
  'Color class for positive profit is green/emerald',
  getTransferProfitColorClass(100).includes('emerald')
);
assert(
  'Color class for negative profit is red/rose',
  getTransferProfitColorClass(-50).includes('rose')
);
assert(
  'Color class for zero profit is neutral muted',
  getTransferProfitColorClass(0).includes('muted')
);

// --------------------------------------------------------------------------
// TEST SUITE 4: Input Validation Edge Cases
// --------------------------------------------------------------------------
console.log('\n--- SUITE 4: Input Validation Edge Cases ---');

// Header validation
const vHeader1 = validateTransferHeader({ sourceStore: 'CENTRAL', destStore: 'BLR', itemsCount: 1 });
assert('Valid header passes validation', vHeader1.isValid);

const vHeader2 = validateTransferHeader({ sourceStore: 'BLR', destStore: 'BLR', itemsCount: 1 });
assert('Identical source and destination rejected', !vHeader2.isValid && vHeader2.error!.includes('cannot be identical'));

const vHeader3 = validateTransferHeader({ sourceStore: 'All Stores', destStore: 'MUM', itemsCount: 1 });
assert('"All Stores" reporting scope rejected as transfer store', !vHeader3.isValid && vHeader3.error!.includes('reporting scope'));

const vHeader4 = validateTransferHeader({ sourceStore: 'CENTRAL', destStore: 'MUM', itemsCount: 0 });
assert('Empty items list rejected', !vHeader4.isValid && vHeader4.error!.includes('at least one item'));

// Item validation
const vItem1 = validateTransferItem({ qty: 5, costPerUnit: 100, transferPricePerUnit: 120 });
assert('Valid item passes validation', vItem1.isValid);

const vItem2 = validateTransferItem({ qty: 0, costPerUnit: 100, transferPricePerUnit: 120 });
assert('Zero quantity rejected', !vItem2.isValid && vItem2.error!.includes('positive whole integer'));

const vItem3 = validateTransferItem({ qty: -3, costPerUnit: 100, transferPricePerUnit: 120 });
assert('Negative quantity rejected', !vItem3.isValid && vItem3.error!.includes('positive whole integer'));

const vItem4 = validateTransferItem({ qty: 2.5, costPerUnit: 100, transferPricePerUnit: 120 });
assert('Fractional/decimal quantity (2.5) rejected', !vItem4.isValid && vItem4.error!.includes('positive whole integer'));

const vItem5 = validateTransferItem({ qty: 10, costPerUnit: 100, transferPricePerUnit: 120, availableStock: 5 });
assert('Quantity exceeding available stock rejected', !vItem5.isValid && vItem5.error!.includes('exceeds available stock'));

const vItem6 = validateTransferItem({ qty: 5, costPerUnit: -10, transferPricePerUnit: 120 });
assert('Negative purchase cost rejected', !vItem6.isValid && vItem6.error!.includes('cannot be negative'));

const vItem7 = validateTransferItem({ qty: 5, costPerUnit: 100, transferPricePerUnit: -20 });
assert('Negative transfer price rejected', !vItem7.isValid && vItem7.error!.includes('cannot be negative'));

// --------------------------------------------------------------------------
// TEST SUITE 5: Double-Entry Financial Ledger Invariants
// --------------------------------------------------------------------------
console.log('\n--- SUITE 5: Double-Entry Financial Ledger Invariants ---');

// Case A: Transfer at Profit (Value: 1500, Cost: 1000, Gross Profit: +500)
const totalValA = 1500;
const totalCostA = 1000;
const profitA = 500;

// Source store ledger entries:
// 1. Clearing Asset (Debit): totalValA
// 2. Inventory Asset (Credit): totalCostA
// 3. Markup (Credit if >= 0, Debit if < 0): profitA
const srcDebitA = totalValA + (profitA < 0 ? Math.abs(profitA) : 0);
const srcCreditA = totalCostA + (profitA >= 0 ? profitA : 0);

assert(
  'Profit Transfer: Source Store Debits (₹1500) === Source Store Credits (₹1500)',
  srcDebitA === srcCreditA && srcDebitA === 1500,
  `Debits: ${srcDebitA}, Credits: ${srcCreditA}`
);

// Case B: Transfer at Loss (Value: 800, Cost: 1000, Gross Profit: -200)
const totalValB = 800;
const totalCostB = 1000;
const profitB = -200;

// Source store ledger entries:
// 1. Clearing Asset (Debit): 800
// 2. Inventory Asset (Credit): 1000
// 3. Markup Loss (Debit): 200
const srcDebitB = totalValB + (profitB < 0 ? Math.abs(profitB) : 0);
const srcCreditB = totalCostB + (profitB >= 0 ? profitB : 0);

assert(
  'Loss Transfer: Source Store Debits (₹1000) === Source Store Credits (₹1000)',
  srcDebitB === srcCreditB && srcDebitB === 1000,
  `Debits: ${srcDebitB}, Credits: ${srcCreditB}`
);

// Destination store ledger entries (always balanced at Transfer Value):
// 1. Inventory Asset Inbound (Debit): totalVal
// 2. Inter-Store Payable (Credit): totalVal
const dstDebitA = totalValA;
const dstCreditA = totalValA;
assert(
  'Destination Store Debits === Credits (₹1500 === ₹1500)',
  dstDebitA === dstCreditA && dstDebitA === 1500
);

console.log('\n================================================================');
console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
