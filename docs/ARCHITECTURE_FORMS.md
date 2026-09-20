# Architecture Standard: Single Source of Truth Forms (SSTF)

## 1. Global Architectural Mandate

**Every business entity across COSKO StoreCommand MUST have exactly ONE master reusable form component.**

Wherever an entity is created or edited across the application—regardless of route, page, drawer, modal, dropdown action, or nested `+ Add New` trigger—the system MUST open and reuse that entity's exact master form component.

### Strict Architectural Invariants:
1. **Identical Field Surfaces**: No simplified, mini, cut-down, or page-specific variations are permitted anywhere.
2. **Zero `quickMode`**: All master forms render full fields unconditionally (slugs, addresses, tax IDs, credit limits, categories, payment terms, attachments).
3. **Automatic Schema Propagation**: Any future field, dropdown option, validation rule, or default added to a master form automatically propagates everywhere that form is consumed.
4. **Nested "+ Add New" Auto-Select**: When a form contains a relation (e.g., selecting a Vendor on a Purchase Order, selecting a Customer on a Repair or Sale, selecting a Store on a Transfer or Expense), clicking `+ Add New [Entity]` MUST open that entity's master form with an elevated `zIndex` (e.g., 110) and automatically select the newly created record upon completion.
5. **Backend & DB Parity**: Validation schemas in UI forms, Next.js API routes (`/api/...`), and Prisma/MySQL schemas remain in lockstep.

---

## 2. Master Forms Registry

All master form components reside under `@/components/forms/` and are centralized in the barrel export:
```typescript
import {
  CategoryFormModal,
  CustomerFormModal,
  VendorFormModal,
  StoreFormModal,
  PurchaseOrderFormModal,
  SupplierPaymentModal,
  ExpenseFormModal,
  RepairFormModal,
  StockTransferModal,
  StockAdjustmentModal,
} from '@/components/forms';
```

| Entity | Master Form Component Path | Primary Roles & Features |
|---|---|---|
| **Category** | `src/components/forms/CategoryFormModal.tsx` | Name, Slug (auto-derived), Category Type with `+ Add New Type`, Parent Category, Description, Status. |
| **Customer** | `src/components/forms/CustomerFormModal.tsx` | Name, Phone, Email, GSTIN (auto-validated), Customer Tier, Opening Credit Balance, Full Billing/Shipping Address. |
| **Vendor** | `src/components/forms/VendorFormModal.tsx` | Company Name, Contact Person, Phone, Email, GSTIN, Category, Payment Terms, Office/Warehouse Address. |
| **Store** | `src/components/forms/StoreFormModal.tsx` | Store Code, Store Name, Address, City, Phone, Store Owner, Status. |
| **Purchase Order** | `src/components/forms/PurchaseOrderFormModal.tsx` | Vendor Selection (with `+ Add New Vendor`), Store Selection (with `+ Add New Store`), Multi-item Dynamic Grid, Tax Rates, HSN, Total Cost, Status. |
| **Supplier Payment** | `src/components/forms/SupplierPaymentModal.tsx` | Unifies payments across `/purchases`, `/vendors`, and Dashboard pending bills with remaining balance check, quick percentage buttons, UTR input, and mandatory payment proof upload. |
| **Expense** | `src/components/forms/ExpenseFormModal.tsx` | Title, Amount, Category (with `+ Add New Category`), Store (with `+ Add New Store`), Payment Method, Date, Notes, Mandatory Receipt Proof. |
| **Repair Ticket** | `src/components/forms/RepairFormModal.tsx` | Customer Selection (with `+ Add New Customer`), Device Type, Model, Store Hub (with `+ Add New Store`), Issue Description, Cost, Tech Notes. |
| **Stock Transfer** | `src/components/forms/StockTransferModal.tsx` | Source Location, Destination Location (with `+ Add New Store`), Product Lot Selection, Live Financial & Margin Calculation, Dispatched Qty. |
| **Stock Adjustment** | `src/components/forms/StockAdjustmentModal.tsx` | Product Context, Adjustment Type (`add`, `remove`, `set`), Reason Codes, Quantity, Notes, Audit Trail. |

---

## 3. Standard Reusable Implementation Pattern

When building any new view or trigger that creates or edits an entity, follow this standard pattern:

```tsx
import React, { useState } from 'react';
import { CustomerFormModal } from '@/components/forms';
import { Customer } from '@/context/AppContext';

export default function ExamplePage() {
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  return (
    <div>
      <button onClick={() => setCustomerModalOpen(true)}>
        + Add New Customer
      </button>

      {/* Reusable Master Component */}
      <CustomerFormModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSuccess={(newCustomer: Customer) => {
          setSelectedCustomerId(newCustomer.id);
          setCustomerModalOpen(false);
        }}
      />
    </div>
  );
}
```

### Layered Nested Invocations (`zIndex`):
Parent modals render with default `zIndex = 100`. Child nested modals triggered via `onAddNew` MUST be rendered with `zIndex = 110` to guarantee correct viewport stacking and focus retention.

---

## 4. Anti-Patterns (STRICTLY PROHIBITED)
- ❌ **Creating inline `<form>` or `<Modal>` blocks** for entities directly within a route or page file.
- ❌ **Adding a `quickMode={true}` prop** to hide or bypass fields.
- ❌ **Creating duplicate "mini" modals** (e.g. `MiniVendorModal`, `QuickCustomerModal`).
- ❌ **Calling write APIs (`POST /api/...`) with partial schemas** that skip standard entity validation.
