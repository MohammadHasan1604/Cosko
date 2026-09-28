'use client';

import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { StorageService } from '@/lib/storageService';
import { toast } from 'sonner';

export interface PaymentProofMeta {
  filename: string;
  size: number;
  mimeType: string;
  originalName?: string;
}

export interface PaymentProofUploadProps {
  value?: string | null;
  onChange: (url: string | null, meta?: PaymentProofMeta) => void;
  required?: boolean;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  error?: string;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

export default function PaymentProofUpload({
  value,
  onChange,
  required = true,
  label = 'Payment Proof *',
  helperText = 'Receipt, UPI screenshot, Cheque/Bank voucher, or payment slip (JPG, PNG, WebP, PDF up to 10MB)',
  disabled = false,
  error,
  onUploadStart,
  onUploadEnd,
}: PaymentProofUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileMeta, setFileMeta] = useState<PaymentProofMeta | null>(null);
  const [previewZoomOpen, setPreviewZoomOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const isPdf = value
    ? value.toLowerCase().endsWith('.pdf') ||
      (fileMeta?.mimeType && fileMeta.mimeType.includes('pdf'))
    : false;

  const handleFileProcess = async (file: File) => {
    // Validate format
    const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const mime = file.type?.toLowerCase() || '';
    const name = file.name.toLowerCase();
    const isAllowed =
      validFormats.includes(mime) ||
      name.endsWith('.pdf') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png') ||
      name.endsWith('.webp');

    if (!isAllowed) {
      toast.error('Invalid file format! Please upload JPG, PNG, WebP, or PDF.');
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB).`);
      return;
    }

    setIsUploading(true);
    onUploadStart?.();

    try {
      const res = await StorageService.uploadPaymentProof(file);
      if (res.success && res.url) {
        const meta: PaymentProofMeta = {
          filename: res.filename || file.name,
          size: res.size || file.size,
          mimeType: res.mimeType || file.type,
          originalName: file.name,
        };
        setFileMeta(meta);
        onChange(res.url, meta);
        toast.success(`Payment proof uploaded: ${file.name}`);
      } else {
        toast.error(res.error || 'Failed to upload payment proof');
      }
    } catch (err: any) {
      console.error('PaymentProofUpload upload error:', err);
      toast.error(err.message || 'Error processing payment proof file');
    } finally {
      setIsUploading(false);
      onUploadEnd?.();
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setFileMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5 w-full">
      {/* Hidden File Inputs for Gallery & Mobile Camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      {/* Label and mandatory indicator */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Icon name="DocumentTextIcon" size={14} className="text-primary" />
          <span>{label}</span>
          {required && (
            <>
              <span className="text-danger font-black">*</span>
              <span className="text-4xs font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded">
                Mandatory
              </span>
            </>
          )}
        </label>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-3xs text-danger hover:underline font-semibold flex items-center gap-0.5"
          >
            <Icon name="TrashIcon" size={11} /> Remove
          </button>
        )}
      </div>

      {/* Upload area or Preview */}
      {!value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-3.5 sm:p-4 text-center transition-all ${
            isDragging
              ? 'border-primary bg-primary/10 scale-[0.99]'
              : error
                ? 'border-danger/60 bg-danger/5'
                : 'border-border/80 hover:border-primary/50 bg-muted/20'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {isUploading ? (
            <div className="py-4 flex flex-col items-center justify-center gap-2">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-foreground">
                Uploading payment proof securely...
              </p>
              <p className="text-3xs text-muted-foreground">
                Validating file & generating permanent storage key
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon name="CloudArrowUpIcon" size={18} />
                </div>
              </div>

              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  Drag & drop receipt/screenshot here, or upload
                </p>
                <p className="text-3xs text-muted-foreground">{helperText}</p>
                <p className="text-4xs text-amber-600 dark:text-amber-400 font-semibold pt-0.5">
                  ⚠️ Payment proof is strictly mandatory before payment can be recorded or saved
                </p>
              </div>

              {/* Action buttons: Camera vs Gallery/File Upload */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn-secondary text-2xs py-1.5 px-3 h-8 gap-1.5 font-bold shadow-xs hover:border-primary"
                >
                  <Icon name="CameraIcon" size={14} className="text-primary" />
                  Take Photo (Mobile)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary text-2xs py-1.5 px-3 h-8 gap-1.5 font-bold shadow-xs"
                >
                  <Icon name="ArrowUpTrayIcon" size={14} />
                  Browse Receipt / PDF
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Preview Card */
        <div className="border border-border/80 bg-card rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Thumbnail or PDF icon */}
            {isPdf ? (
              <div className="w-12 h-12 rounded-lg bg-danger/10 border border-danger/20 flex flex-col items-center justify-center text-danger shrink-0">
                <Icon name="DocumentTextIcon" size={20} />
                <span className="text-4xs font-black uppercase">PDF</span>
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-lg border border-border overflow-hidden bg-muted/40 shrink-0 cursor-pointer relative group"
                onClick={() => setPreviewZoomOpen(true)}
                title="Click to zoom proof"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt="Payment Proof Preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Icon name="MagnifyingGlassPlusIcon" size={14} />
                </div>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="badge-success text-3xs font-bold px-1.5 py-0.5 rounded">
                  ✓ Proof Attached
                </span>
                <span className="text-3xs text-muted-foreground font-mono">
                  {fileMeta?.size ? `${(fileMeta.size / 1024).toFixed(0)} KB` : 'Attached'}
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground truncate mt-0.5 max-w-[240px]">
                {fileMeta?.filename || value.split('/').pop() || 'Payment_Proof_Record'}
              </p>
              <p className="text-3xs text-emerald-600 font-medium">
                Permanently stored & linked to database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {isPdf ? (
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-2xs py-1 px-2.5 h-7 gap-1 font-semibold"
              >
                <Icon name="ArrowTopRightOnSquareIcon" size={12} />
                View PDF
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setPreviewZoomOpen(true)}
                className="btn-secondary text-2xs py-1 px-2.5 h-7 gap-1 font-semibold"
              >
                <Icon name="EyeIcon" size={12} />
                Preview
              </button>
            )}

            {!disabled && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-2xs py-1 px-2.5 h-7 gap-1 font-semibold"
                title="Replace file"
              >
                <Icon name="ArrowPathIcon" size={12} />
                Replace
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <p className="text-2xs text-danger font-medium flex items-center gap-1">
          <Icon name="ExclamationCircleIcon" size={12} />
          {error}
        </p>
      )}

      {/* Lightbox / Zoom Dialog for Image Proofs */}
      {previewZoomOpen && value && !isPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewZoomOpen(false)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] bg-card rounded-2xl border border-border overflow-hidden shadow-2xl p-2 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-border">
              <span className="text-xs font-bold text-foreground">
                Attached Payment Proof Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoomOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
            <div className="overflow-auto max-h-[70vh] flex items-center justify-center p-2 bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Payment Proof"
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-2 border-t border-border flex justify-end gap-2">
              <a
                href={value}
                download={fileMeta?.filename || 'payment-proof'}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs py-1.5 px-3 gap-1.5"
              >
                <Icon name="ArrowDownTrayIcon" size={13} />
                Download Full Size
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
