'use client';

import React, { useState } from 'react';
import { useApp, InventoryItem } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import QuickCategoryModal from '@/components/ui/QuickCategoryModal';
import { toast } from 'sonner';

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  editItem?: InventoryItem | null;
}

export default function AddItemModal({ open, onClose, editItem }: AddItemModalProps) {
  const { addItem, updateItem, addAuditLog, storesList, categoriesList } = useApp();

  const [images, setImages] = useState<string[]>(editItem?.images || (editItem?.imageUrl ? [editItem.imageUrl] : []));
  const [primaryImage, setPrimaryImage] = useState<string>(editItem?.primaryImage || editItem?.imageUrl || '');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickCatOpen, setQuickCatOpen] = useState(false);

  const activeCategories = categoriesList.filter((c) => c.status === 'Active');

  // Form State - Truly clean with NO pre-filled sample/fake data (Requirements 20, 21, 22, 23, 26)
  const [formData, setFormData] = useState({
    sku: editItem ? editItem.sku : '',
    barcode: editItem ? (editItem.barcode || '') : '',
    name: editItem ? editItem.name : '',
    brand: editItem ? (editItem.brand || '') : '',
    model: editItem ? (editItem.model || '') : '',
    category: editItem ? editItem.category : '',
    subcategory: editItem ? (editItem.subcategory || '') : '',
    store: editItem ? editItem.store : 'CENTRAL',
    qtyOnHand: editItem ? editItem.qtyOnHand : ('' as unknown as number),
    reorderPt: editItem ? editItem.reorderPt : ('' as unknown as number),
    minStock: editItem ? (editItem.minStock || 10) : ('' as unknown as number),
    costPrice: editItem ? editItem.costPrice : ('' as unknown as number),
    sellingPrice: editItem ? editItem.sellingPrice : ('' as unknown as number),
    mrp: editItem ? (editItem.mrp || '') : ('' as unknown as number),
    hsn: editItem ? (editItem.hsn || '') : '',
    taxRate: editItem ? editItem.taxRate : 18,
    warrantyMonths: editItem ? (editItem.warrantyMonths || 12) : 12,
    status: editItem ? editItem.status : ('active' as const),
  });

  if (!open) return null;

  const handleGenerateSku = () => {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const prefix = formData.brand ? formData.brand.slice(0, 3).toUpperCase() : 'CSK';
    const genSku = `${prefix}-${randomCode}`;
    setFormData((prev) => ({ ...prev, sku: genSku }));
    toast.info(`Generated SKU: ${genSku}`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid image format (${file.name})! Upload PNG, JPG, or WebP.`);
        return;
      }
      if (file.size > maxSize) {
        toast.error(`File too large (${file.name})! Max file size is 5MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImages((prev) => {
          const updated = [...prev, result];
          if (!primaryImage) setPrimaryImage(result);
          return updated;
        });
        toast.success(`Uploaded product image: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (imgUrl: string) => {
    setImages((prev) => {
      const updated = prev.filter((img) => img !== imgUrl);
      if (primaryImage === imgUrl) {
        setPrimaryImage(updated[0] || '');
      }
      return updated;
    });
    toast.info('Product image removed.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Item name is required');
      return;
    }

    if (!formData.sku.trim()) {
      toast.error('SKU Code is required. Type a unique SKU or click "Generate SKU".');
      return;
    }

    if (!formData.category) {
      toast.error('Please select a product Category.');
      return;
    }

    // Mandatory Product Image for NEW product creation (Requirement 27)
    if (!editItem && images.length === 0) {
      toast.error('Product Image is mandatory for new products. Please upload at least one image.');
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      brand: formData.brand.trim() || 'General',
      model: formData.model.trim() || '',
      category: formData.category,
      qtyOnHand: Number(formData.qtyOnHand) || 0,
      costPrice: Number(formData.costPrice) || 0,
      transferPrice: Math.round(Number(formData.costPrice || formData.sellingPrice || 0) * 1.18),
      sellingPrice: Number(formData.sellingPrice) || 0,
      mrp: Number(formData.mrp) || Number(formData.sellingPrice) || 0,
      minStock: Number(formData.minStock) || 10,
      reorderPt: Number(formData.reorderPt) || 5,
      images,
      primaryImage: primaryImage || images[0] || undefined,
      imageUrl: primaryImage || images[0] || undefined,
    };

    if (editItem) {
      updateItem(editItem.id, payload);
      addAuditLog('Inventory', 'Update Product Details', `Updated details for ${formData.sku}`);
      toast.success(`Saved changes for ${formData.name}`);
    } else {
      addItem({
        ...payload,
        fifoLots: 1,
        lastMovement: 'Just now',
      });
      addAuditLog('Inventory', 'Add Product', `Created product "${formData.name}" (${formData.sku})`);
    }
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editItem ? 'Edit Product Details' : 'Add Product to Master Catalog'}
        subtitle={
          editItem
            ? `Modify catalog parameters for ${editItem.sku}`
            : 'At least one product image is mandatory. Category & SKU will persist permanently.'
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Product Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-foreground mb-1 block">Item Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. iPhone 15 Pro Max 256GB"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field py-2 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">Brand Name</label>
              <input
                type="text"
                placeholder="e.g. Apple, Samsung, Xiaomi"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="input-field py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">Model Number</label>
              <input
                type="text"
                placeholder="e.g. A2848"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="input-field py-2 text-xs font-mono"
              />
            </div>

            {/* SKU Input with explicit Generate SKU action (Requirement 22) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-foreground block">SKU Code *</label>
                {!editItem && (
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-3xs text-primary font-bold hover:underline"
                  >
                    Generate SKU
                  </button>
                )}
              </div>
              <input
                required
                type="text"
                placeholder="e.g. APL-IP15P-256"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="input-field py-2 text-xs font-mono uppercase"
              />
            </div>

            {/* Barcode */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-foreground block">Barcode EAN-13 (Optional)</label>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="text-3xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                >
                  <Icon name="QrCodeIcon" size={12} />
                  Scan
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Optional Barcode / Scan"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="input-field py-2 text-xs font-mono flex-1"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="btn-secondary py-1.5 px-2.5 text-xs text-foreground"
                  title="Open Camera Scanner"
                >
                  <Icon name="QrCodeIcon" size={15} />
                </button>
              </div>
            </div>

            {/* Category Dropdown with Quick Add (Requirement 23 & 24) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-foreground block">Category *</label>
                <button
                  type="button"
                  onClick={() => setQuickCatOpen(true)}
                  className="text-3xs text-primary font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  <Icon name="PlusIcon" size={11} />
                  Add New
                </button>
              </div>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input-field py-2 text-xs font-medium"
              >
                <option value="">-- Select Category --</option>
                {activeCategories.map((cat) => (
                  <option key={`cat-opt-${cat.id}`} value={cat.name}>
                    {cat.name} ({cat.categoryType})
                  </option>
                ))}
              </select>
            </div>

            {/* Inventory Location Hub */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">Inventory Location Hub</label>
              <select
                value={formData.store}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                className="input-field py-2 text-xs"
              >
                {[...storesList]
                  .sort((a, b) => (a.code === 'CENTRAL' ? -1 : b.code === 'CENTRAL' ? 1 : a.code.localeCompare(b.code)))
                  .map((st) => (
                    <option key={`st-opt-${st.code}`} value={st.code}>
                      {st.code === 'CENTRAL' ? 'COSKO Central Warehouse (CENTRAL)' : `${st.code} — ${st.name}`}
                    </option>
                  ))}
              </select>
            </div>

            {/* Purchase Cost (Requirement 21: No default zero) */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">Purchase Cost (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 1000"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                className="input-field py-2 text-xs font-tabular"
              />
            </div>

            {/* Selling Price (Requirement 21 & 26: Transfer price removed) */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Selling Price (₹) *</label>
              <input
                required
                type="number"
                min="0"
                placeholder="e.g. 1500"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                className="input-field py-2 text-xs font-tabular"
              />
            </div>

            {/* MRP */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">MRP (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 1800"
                value={formData.mrp}
                onChange={(e) => setFormData({ ...formData, mrp: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                className="input-field py-2 text-xs font-tabular"
              />
            </div>

            {/* Initial Qty on Hand (Requirement 21) */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Initial Qty on Hand</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 10"
                value={formData.qtyOnHand}
                onChange={(e) => setFormData({ ...formData, qtyOnHand: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                className="input-field py-2 text-xs font-tabular"
              />
            </div>

            {/* Warranty */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Warranty (Months)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 12"
                value={formData.warrantyMonths}
                onChange={(e) => setFormData({ ...formData, warrantyMonths: Number(e.target.value) })}
                className="input-field py-2 text-xs font-tabular"
              />
            </div>

            {/* Min Stock */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Min Stock Threshold</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                className="input-field py-2 text-xs font-tabular"
              />
            </div>
          </div>

          {/* Product Image Upload Section (Requirement 27: Mandatory for New Products) */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Product Image {!editItem && <span className="text-danger font-bold">* (Mandatory)</span>}
                </h4>
                <p className="text-3xs text-muted-foreground">PNG, JPG, or WebP up to 5MB.</p>
              </div>
              <label className="btn-secondary text-2xs cursor-pointer gap-1.5 inline-flex items-center">
                <Icon name="ArrowUpTrayIcon" size={13} />
                Upload Product Photo
                <input
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((img, idx) => {
                  const isPrimary = primaryImage === img || (!primaryImage && idx === 0);
                  return (
                    <div
                      key={`img-thumb-${idx}`}
                      className={`relative rounded-xl border p-1 bg-card group ${
                        isPrimary ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                      }`}
                    >
                      <img src={img} alt="Product Thumbnail" className="w-full h-20 object-cover rounded-lg" />
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img)}
                          className="w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center text-3xs"
                        >
                          <Icon name="XMarkIcon" size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-2xs text-muted-foreground">
                {!editItem ? (
                  <span className="text-danger font-semibold">No image uploaded yet. At least one image is required to save.</span>
                ) : (
                  <span>No image attached. Upload photo to update item thumbnail.</span>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs font-bold">
              {editItem ? 'Save Changes' : 'Create Product Record'}
            </button>
          </div>
        </form>

        {scannerOpen && (
          <BarcodeScannerModal
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={(scanned) => {
              setFormData((prev) => ({ ...prev, barcode: scanned }));
              toast.success(`Barcode ${scanned} assigned to item`);
            }}
            title="Scan Product Barcode"
            subtitle="Align the product packaging barcode with the camera viewport."
          />
        )}
      </Modal>

      {/* Inline Quick Category Add Modal (Requirement 24) */}
      <QuickCategoryModal
        open={quickCatOpen}
        onClose={() => setQuickCatOpen(false)}
        onSuccess={(newCatName: string) => {
          setFormData((prev) => ({ ...prev, category: newCatName }));
        }}
      />
    </>
  );
}
