export interface ConsolidatedPnLData {
  netExternalRevenue: number;
  grossRevenue: number;
  totalDiscounts: number;
  totalTax: number;
  vendorCOGS: number;
  consolidatedGrossProfit: number;
  grossMarginPercent: number;
  storeOperatingExpenses: number;
  centralExpenses: number;
  totalExpenses: number;
  consolidatedNetProfit: number;
  netMarginPercent: number;
  eliminatedTransferRevenue: number;
  eliminatedTransferMarkup: number;
  ordersCount: number;
  expensesCount: number;
  expenseCategoryBreakdown: Record<string, number>;
  storeContributions: Array<{
    storeCode: string;
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    ordersCount: number;
    grossMarginPercent: number;
  }>;
}

export interface StorePnLData {
  storeScope: string;
  storeSalesRevenue: number;
  storeCOGS: number;
  storeGrossProfit: number;
  storeGrossMarginPercent: number;
  storeOperatingExpenses: number;
  storeNetProfit: number;
  storeNetMarginPercent: number;
  ordersCount: number;
  expensesCount: number;
}

export interface CentralPnLData {
  centralTransferRevenue: number;
  centralInventoryCost: number;
  grossTransferProfit: number;
  centralMarkupMarginPercent: number;
  centralExpenses: number;
  netCentralProfit: number;
  totalUnitsTransferred: number;
  transfersCount: number;
  expensesCount: number;
  outletBreakdown: Array<{
    destStore: string;
    transferValue: number;
    inventoryCost: number;
    markupProfit: number;
    units: number;
    count: number;
  }>;
}

export interface LedgerEntry {
  id: string;
  entryNo: string;
  entryDate: string;
  storeCode: string;
  accountCategory: string;
  accountName: string;
  debit: number;
  credit: number;
  amount: number;
  refType: string;
  refId?: string;
  refNo: string;
  entityName?: string;
  description: string;
  isEliminated: boolean;
  createdBy: string;
  proofUrl?: string | null;
  referenceNo?: string | null;
  paymentMethod?: string | null;
}

export interface DrillDownRecord {
  id: string;
  refNo: string;
  date: string;
  storeCode: string;
  entity?: string;
  category?: string;
  description?: string;
  amount: number;
  netRevenue?: number;
  tax?: number;
  cost?: number;
  profit?: number;
  status?: string;
  paymentMethod?: string;
  items?: string;
}
