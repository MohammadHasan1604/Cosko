'use client';
import React, { useState } from 'react';
import { useApp, InventoryItem } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import { toast } from 'sonner';

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  editItem?: InventoryItem | null;
}

export default function AddItemModal({ open, onClose, editItem }: AddItemModalProps) {
  const { addItem, updateItem, addAuditLog, storesList, categoriesList } = useApp();

  const [images, setImages] = useState<string[]>(editItem?.images || []);
  const [primaryImage, setPrimaryImage] = useState<string>(editItem?.primaryImage || editItem?.images?.[0] || '');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const activeCategories = categoriesList.filter((c) => c.status === 'Active');
  const defaultCategory = editItem ? editItem.category : (activeCategories[0]?.name || 'Screen / Display');

  const [formData, setFormData] = useState({
    sku: editItem ? editItem.sku : `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    barcode: editItem ? (editItem.barcode || '') : '',
    name: editItem ? editItem.name : '',
    brand: editItem ? editItem.brand : 'Cosko',
    model: editItem ? (editItem.model || '') : '',
    category: defaultCategory,
    subcategory: editItem ? editItem.subcategory : 'General',
    store: editItem ? editItem.store : 'CENTRAL',
    qtyOnHand: editItem ? editItem.qtyOnHand : 50,
    reorderPt: editItem ? editItem.reorderPt : 10,
    minStock: editItem ? (editItem.minStock || 10) : 10,
    costPrice: editItem ? editItem.costPrice : 100,
    transferPrice: editItem ? (editItem.transferPrice || 120) : 120,
    sellingPrice: editItem ? editItem.sellingPrice : 150,
    mrp: editItem ? editItem.mrp : 180,
    hsn: editItem ? (editItem.hsn || '') : '',
    taxRate: editItem ? editItem.taxRate : 18,
    warrantyMonths: editItem ? (editItem.warrantyMonths || 12) : 12,
    status: editItem ? editItem.status : ('active' as const),
  });

  if (!open) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid format (${file.name})! Upload PNG, JPG, WebP, or SVG.`);
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
    const payload = {
      ...formData,
      images,
      primaryImage: primaryImage || images[0] || undefined,
    };

    if (editItem) {
      updateItem(editItem.id, payload);
      addAuditLog('Inventory', 'Update Product Details', `Updated details for ${formData.sku}`);
    } else {
      addItem({
        ...payload,
        fifoLots: Math.ceil(formData.qtyOnHand / 10),
        lastMovement: 'Just now',
      });
      addAuditLog('Inventory', 'Add Product', `Created product ${formData.name} (${formData.sku})`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editItem ? 'Edit Product Details' : 'Add Product to Master Catalog'}
      subtitle={editItem ? `Modify catalog parameters for ${editItem.sku}` : 'Barcode & HSN are optional. Central Warehouse is the default owner hub.'}
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
              placeholder="e.g. Anchor Roma Switch 6A"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Brand Name</label>
            <input
              type="text"
              placeholder="e.g. Anchor, Philips, Havells"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="input-field py-2 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Model Number</label>
            <input
              type="text"
              placeholder="e.g. ROMA-6A"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="input-field py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">SKU Code *</label>
            <input
              required
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="input-field py-2 text-xs font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-foreground block">Barcode EAN-13 (Optional)</label>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="text-3xs text-primary font-bold hover:underline inline-flex items-center gap-1"
              >
                <Icon name="QrCodeIcon" size={12} />
                Scan Barcode
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

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">HSN Code (Optional)</label>
            <input
              type="text"
              placeholder="Optional HSN"
              value={formData.hsn}
              onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
              className="input-field py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input-field py-2 text-xs font-medium"
            >
              {activeCategories.length > 0 ? (
                activeCategories.map((cat) => (
                  <option key={`cat-select-${cat.id}`} value={cat.name}>
                    {cat.name} ({cat.categoryType})
                  </option>
                ))
              ) : (
                <option value="General">General</option>
              )}
            </select>
          </div>

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

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Purchase Cost (₹)</label>
            <input
              type="number"
              min="0"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Transfer Price (₹)</label>
            <input
              type="number"
              min="0"
              value={formData.transferPrice}
              onChange={(e) => setFormData({ ...formData, transferPrice: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Selling Price (₹)</label>
            <input
              type="number"
              min="0"
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Initial Qty on Hand</label>
            <input
              type="number"
              min="0"
              value={formData.qtyOnHand}
              onChange={(e) => setFormData({ ...formData, qtyOnHand: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Warranty (Months)</label>
            <input
              type="number"
              min="0"
              value={formData.warrantyMonths}
              onChange={(e) => setFormData({ ...formData, warrantyMonths: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Min Stock Threshold</label>
            <input
              type="number"
              min="1"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>
        </div>

        {/* Product Image Upload Section */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Product Image Gallery</h4>
            <label className="btn-secondary text-2xs cursor-pointer gap-1.5 inline-flex items-center">
              <Icon name="ArrowUpTrayIcon" size={13} />
              Upload Product Photo
              <input type="file" multiple accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((img, idx) => {
                const isPrimary = primaryImage === img || (!primaryImage && idx === 0);
                return (
                  <div key={`img-thumb-${idx}`} className={`relative rounded-xl border p-1 bg-card group ${isPrimary ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                    <img src={img} alt="Product Thumbnail" className="w-full h-20 object-cover rounded-lg" />
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleRemoveImage(img)} className="w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center text-3xs">
                        <Icon name="XMarkIcon" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button type="submit" className="btn-primary text-xs font-bold">{editItem ? 'Save Changes' : 'Create Product Record'}</button>
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
  );
}
