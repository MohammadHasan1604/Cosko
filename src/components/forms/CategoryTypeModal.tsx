'use client';
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface CategoryTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (typeName: string) => void;
  zIndex?: number;
}

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Indigo / Primary', bg: 'bg-primary/15 text-primary border-primary/30' },
  { value: 'info', label: 'Sky / Info', bg: 'bg-info/15 text-info border-info/30' },
  { value: 'success', label: 'Emerald / Success', bg: 'bg-success/15 text-success border-success/30' },
  { value: 'warning', label: 'Amber / Warning', bg: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'purple', label: 'Purple / Violet', bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { value: 'rose', label: 'Rose / Coral', bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  { value: 'secondary', label: 'Slate / Neutral', bg: 'bg-muted text-muted-foreground border-border' },
];

export default function CategoryTypeModal({ open, onClose, onSuccess, zIndex = 120 }: CategoryTypeModalProps) {
  const { addCategoryType } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('primary');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category Type name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addCategoryType({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });

      if (res?.success && res.categoryType) {
        if (onSuccess) {
          onSuccess(res.categoryType.name);
        }
        onClose();
        setName('');
        setDescription('');
        setColor('primary');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category type');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Category Type"
      subtitle="Save a new dynamic classification type to root database"
      size="sm"
      zIndex={zIndex}
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Category Type Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Wearables, EV Chargers, Solar"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-xs"
          />
          <p className="text-3xs text-muted-foreground mt-1">
            This will be available across all forms, filters, and category taxonomy.
          </p>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground block mb-1.5">
            Badge Accent Color
          </label>
          <div className="grid grid-cols-2 gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColor(opt.value)}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                  color === opt.value
                    ? 'border-primary ring-1 ring-primary font-semibold'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <span className={`w-3 h-3 rounded-full border ${opt.bg}`} />
                <span className="truncate text-foreground text-2xs">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Description <span className="text-muted-foreground font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Brief purpose of this category type..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field text-xs resize-none"
          />
        </div>

        <div className="flex justify-end items-center gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary text-xs gap-1.5"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="PlusIcon" size={14} />
                Save & Select Type
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
