'use client';
import React, { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { useApp, CategoryItem } from '@/context/AppContext';
import { toast } from 'sonner';

interface QuickCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (categoryName: string) => void;
}

export default function QuickCategoryModal({ open, onClose, onSuccess }: QuickCategoryModalProps) {
  const { categoriesList, addCategory, currentUser } = useApp();
  const [name, setName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [categoryType, setCategoryType] = useState<CategoryItem['categoryType']>('Product');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topLevelCategories = useMemo(() => {
    return categoriesList.filter((c) => !c.parentCategoryId && c.status === 'Active');
  }, [categoriesList]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }

    const cleanName = name.trim();
    const existing = categoriesList.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      toast.info(`Category "${cleanName}" already exists. Selecting it.`);
      if (onSuccess) onSuccess(existing.name);
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const slug = `${baseSlug}-${Date.now().toString(36).substring(0, 4)}`;

      await addCategory({
        name: cleanName,
        slug,
        parentCategoryId: parentCategoryId || null,
        categoryType,
        description: description.trim() || undefined,
        sortOrder: categoriesList.length + 1,
        status: 'Active',
        createdBy: currentUser.email || currentUser.name,
      });

      toast.success(`Category "${cleanName}" created successfully!`);
      if (onSuccess) onSuccess(cleanName);
      onClose();
      setName('');
      setParentCategoryId('');
      setCategoryType('Product');
      setDescription('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Product Category"
      subtitle="Add category to catalog taxonomy and select immediately"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">Category Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Mobile Accessories, Display Panels"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Parent Category (Optional)</label>
            <select
              value={parentCategoryId}
              onChange={(e) => setParentCategoryId(e.target.value)}
              className="input-field text-xs font-medium"
            >
              <option value="">None (Top-Level)</option>
              {topLevelCategories.map((cat) => (
                <option key={`quick-p-${cat.id}`} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">Category Type</label>
            <select
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value as any)}
              className="input-field text-xs font-medium"
            >
              <option value="Product">Product</option>
              <option value="Spare Part">Spare Part</option>
              <option value="Accessory">Accessory</option>
              <option value="Device">Device</option>
              <option value="Service">Service</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground block mb-1">Description (Optional)</label>
          <input
            type="text"
            placeholder="Short category description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-xs" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-xs" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save & Select Category'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
