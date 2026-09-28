/**
 * GLOBAL ROOT RULE: Single Source of Truth Forms Registry
 *
 * Each business entity in COSKO has EXACTLY ONE master form component.
 * Any screen, route, page, modal, drawer, or nested "+ Add New" trigger
 * MUST import and render these master forms to guarantee 100% uniformity
 * in fields, order, dropdowns, validation, defaults, permissions, and DB logic.
 */

export { default as ProductFormModal } from './ProductFormModal';
export { default as CustomerFormModal } from './CustomerFormModal';
export { default as VendorFormModal } from './VendorFormModal';
export { default as CategoryFormModal } from './CategoryFormModal';
export { default as CategoryTypeModal } from './CategoryTypeModal';
export { default as CategoryTypeManagerModal } from './CategoryTypeManagerModal';
export { default as StoreFormModal } from './StoreFormModal';
export { default as PurchaseOrderFormModal } from './PurchaseOrderFormModal';
export { default as UserFormModal } from './UserFormModal';
export { default as SupplierPaymentModal } from './SupplierPaymentModal';
export { default as ExpenseFormModal } from './ExpenseFormModal';
export { default as StockTransferModal } from './StockTransferModal';
export { default as StockAdjustmentModal } from './StockAdjustmentModal';
export { default as PaymentMethodModal } from './PaymentMethodModal';
export { default as PaymentMethodSelect } from '@/components/ui/PaymentMethodSelect';
export { default as BrandModal } from './BrandModal';
export { default as UnitModal } from './UnitModal';
