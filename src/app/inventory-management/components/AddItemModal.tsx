'use client';
import React, { useState } from 'react';
import { useApp, InventoryItem } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

interface AddItemModalProps {
  open: boolean;
  onClose: () => void;
  editItem?: InventoryItem | null;
}

export default function AddItemModal({ open, onClose, editItem }: AddItemModalProps) {
  const { addItem, updateItem, addAuditLog } = useApp();

  const [images, setImages] = useState<string[]>(editItem?.images || []);
  const [primaryImage, setPrimaryImage] = useState<string>(editItem?.primaryImage || editItem?.images?.[0] || '');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    sku: editItem ? editItem.sku : `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    barcode: editItem ? editItem.barcode : `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    name: editItem ? editItem.name : '',
    brand: editItem ? editItem.brand : '',
    category: editItem ? editItem.category : 'Electricals',
    subcategory: editItem ? editItem.subcategory : 'General',
    store: editItem ? editItem.store : 'BLR',
    qtyOnHand: editItem ? editItem.qtyOnHand : 10,
    reorderPt: editItem ? editItem.reorderPt : 5,
    costPrice: editItem ? editItem.costPrice : 100,
    sellingPrice: editItem ? editItem.sellingPrice : 150,
    mrp: editItem ? editItem.mrp : 180,
    hsn: editItem ? editItem.hsn : '85365000',
    taxRate: editItem ? editItem.taxRate : 18,
    status: editItem ? editItem.status : ('active' as const),
  });

  if (!open) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`Invalid format (${file.name})! Upload PNG, JPG, WebP, or SVG.`);
        return;
      }
      if (file.size > maxSize) {
        toast.error(`File too large (${file.name})! Max file size is 2MB.`);
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
      addAuditLog('Inventory', 'Update Product Images', `Updated details and ${images.length} images for ${formData.sku}`);
    } else {
      addItem({
        ...payload,
        fifoLots: Math.ceil(formData.qtyOnHand / 10),
        lastMovement: 'Just now',
      });
      addAuditLog('Inventory', 'Add Product with Images', `Created product ${formData.name} (${formData.sku}) with ${images.length} images`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editItem ? 'Edit Product & Image Details' : 'Add New Inventory Product & Images'}
      subtitle={editItem ? `Modify settings and photo gallery for ${editItem.sku}` : 'Fill in the catalog details, stock levels, store assignments, and product photos.'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-2">
        {/* Product Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
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
            <label className="text-xs font-bold text-foreground mb-1 block">Brand Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Anchor, Philips, Havells"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="input-field py-2 text-xs"
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
            <label className="text-xs font-bold text-foreground mb-1 block">Barcode EAN-13 *</label>
            <input
              required
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              className="input-field py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input-field py-2 text-xs"
            >
              {['Electricals', 'Lighting', 'Wiring', 'Power Tools', 'Hand Tools', 'Circuit Protection', 'Power Conditioning'].map((cat) => (
                <option key={`cat-select-${cat}`} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Target Store</label>
            <select
              value={formData.store}
              onChange={(e) => setFormData({ ...formData, store: e.target.value })}
              className="input-field py-2 text-xs"
            >
              {['BLR', 'HYD', 'DEL'].map((st) => (
                <option key={`st-select-${st}`} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">Cost Price (₹)</label>
            <input
              type="number"
              min="0"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
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
            <label className="text-xs font-bold text-foreground block mb-1">Initial Quantity on Hand</label>
            <input
              type="number"
              min="0"
              value={formData.qtyOnHand}
              onChange={(e) => setFormData({ ...formData, qtyOnHand: Number(e.target.value) })}
              className="input-field py-2 text-xs font-tabular"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Reorder Threshold Point</label>
            <input
              type="number"
              min="1"
              value={formData.reorderPt}
              onChange={(e) => setFormData({ ...formData, reorderPt: Number(e.target.value) })}
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

          {images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((img, idx) => {
                const isPrimary = primaryImage === img || (!primaryImage && idx === 0);
                return (
                  <div key={`img-thumb-${idx}`} className={`relative rounded-xl border p-1 bg-card group ${isPrimary ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                    <img
                      src={img}
                      alt={`Product photo ${idx + 1}`}
                      onClick={() => setPreviewImage(img)}
                      className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    <div className="mt-1 flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(img)}
                        className={`text-3xs px-1.5 py-0.5 rounded font-bold transition-all ${
                          isPrimary ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-border'
                        }`}
                      >
                        {isPrimary ? '★ Cover' : 'Set Cover'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img)}
                        className="text-muted-foreground hover:text-danger p-1"
                        title="Remove photo"
                      >
                        <Icon name="TrashIcon" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 border border-dashed border-border rounded-xl text-center space-y-2 bg-muted/20">
              <Icon name="PhotoIcon" size={28} className="text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">No custom product photos uploaded yet.</p>
              <p className="text-2xs text-muted-foreground">Upload PNG, JPG, WebP, or SVG product photos (max 2MB per file).</p>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button type="button" onClick={onClose} className="btn-ghost text-xs">
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs">
            {editItem ? 'Save Product Changes' : 'Create Product'}
          </button>
        </div>
      </form>

      {/* Image Preview Lightbox */}
      {previewImage && (
        <Modal open={!!previewImage} onClose={() => setPreviewImage(null)} title="Product Photo Preview" size="md">
          <div className="p-2 text-center space-y-4">
            <img src={previewImage} alt="Product Preview" className="max-h-96 w-auto mx-auto rounded-xl shadow-md border border-border object-contain" />
            <button type="button" onClick={() => setPreviewImage(null)} className="btn-secondary text-xs">
              Close Preview
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
