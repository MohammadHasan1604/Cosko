'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import CoskoLogo from '@/components/ui/CoskoLogo';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

interface InvoiceTabProps {
  invoiceHeader: string;
  setInvoiceHeader: (val: string) => void;
  invoiceFooter: string;
  setInvoiceFooter: (val: string) => void;
  invoiceTerms: string;
  setInvoiceTerms: (val: string) => void;
  invoiceAccentColor: string;
  setInvoiceAccentColor: (val: string) => void;
  watermarkOpacity: number;
  setWatermarkOpacity: (val: number) => void;
  showStoreAddress: boolean;
  setShowStoreAddress: (val: boolean) => void;
  invoiceTemplateUrl: string | null;
  setInvoiceTemplateUrl: (val: string | null) => void;
  showPaymentQr: boolean;
  setShowPaymentQr: (val: boolean) => void;
  paymentUpiId: string;
  setPaymentUpiId: (val: string) => void;
  paymentBankDetails: string;
  setPaymentBankDetails: (val: string) => void;
  handleInvoiceTemplateUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  logoUrl: string | null;
  businessAddress: string;
  city: string;
  supportPhone: string;
  gstin: string;
  defaultTaxRate: number;
  isSuperAdmin: boolean;
}

export const InvoiceTab: React.FC<InvoiceTabProps> = ({
  invoiceHeader,
  setInvoiceHeader,
  invoiceFooter,
  setInvoiceFooter,
  invoiceTerms,
  setInvoiceTerms,
  invoiceAccentColor,
  setInvoiceAccentColor,
  watermarkOpacity,
  setWatermarkOpacity,
  showStoreAddress,
  setShowStoreAddress,
  invoiceTemplateUrl,
  setInvoiceTemplateUrl,
  showPaymentQr,
  setShowPaymentQr,
  paymentUpiId,
  setPaymentUpiId,
  paymentBankDetails,
  setPaymentBankDetails,
  handleInvoiceTemplateUpload,
  logoUrl,
  businessAddress,
  city,
  supportPhone,
  gstin,
  defaultTaxRate,
  isSuperAdmin,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h3 className="text-base font-bold text-foreground">
          Digital & Print Invoice Template Designer
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure custom invoice headers, Canva template upload, watermark overlay, UPI payment
          QR, and warranty terms.
        </p>
      </div>

      {/* LIVE INVOICE PREVIEW */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            Interactive Print / PDF Preview
          </span>
          <span className="text-3xs font-mono text-muted-foreground">
            Watermark: {watermarkOpacity}% opacity
          </span>
        </div>

        {/* Printable Invoice Card */}
        <div className="p-5 bg-card rounded-xl border border-border shadow-md max-w-lg mx-auto relative overflow-hidden text-xs">
          {/* Canva / Custom Template Background if provided */}
          {invoiceTemplateUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none z-0"
              style={{ backgroundImage: `url(${invoiceTemplateUrl})` }}
            />
          )}

          {/* COSKO Watermark */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
            style={{ opacity: watermarkOpacity / 100 }}
          >
            <svg
              width="180"
              height="180"
              viewBox="0 0 100 100"
              fill="currentColor"
              className="text-foreground"
            >
              <rect x="15" y="15" width="70" height="70" rx="18" />
              <circle cx="50" cy="50" r="22" fill="white" />
            </svg>
          </div>

          <div className="relative z-10 space-y-4">
            {/* Header */}
            <div className="text-center border-b border-border/80 pb-3">
              <div className="flex justify-center mb-1">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <CoskoLogo size={26} showText />
                )}
              </div>
              <h4 className="font-extrabold text-foreground text-sm">{invoiceHeader}</h4>
              {showStoreAddress && (
                <p className="text-3xs text-muted-foreground mt-0.5">
                  {businessAddress || '100 Feet Ring Road, Indiranagar'}, {city || 'Bengaluru'} ·
                  Phone: {supportPhone || '+91 80 4000 8800'}
                </p>
              )}
              <p className="text-3xs font-mono text-primary font-bold mt-1">
                GSTIN: {gstin || '29AABCU9603R1ZM'}
              </p>
            </div>

            {/* Invoice Meta */}
            <div className="flex justify-between text-3xs text-muted-foreground border-b border-border/60 pb-2">
              <div>
                <p>
                  <strong className="text-foreground">Invoice #:</strong> INV-2026-0891
                </p>
                <p>
                  <strong className="text-foreground">Date:</strong> 13 Sep 2026
                </p>
                <p>
                  <strong className="text-foreground">Billed To:</strong> Rajesh Sharma
                </p>
              </div>
              <div className="text-right">
                <p>
                  <strong className="text-foreground">Store:</strong> Indiranagar (BLR)
                </p>
                <p>
                  <strong className="text-foreground">POS Terminal:</strong> REG-01
                </p>
                <p>
                  <strong className="text-foreground">Payment:</strong> UPI / QR
                </p>
              </div>
            </div>

            {/* Sample Table */}
            <div className="space-y-1 text-3xs font-mono">
              <div className="flex justify-between font-bold text-foreground border-b border-border/40 pb-1">
                <span>Item Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between">
                <span>Samsung Galaxy S24 256GB x 1</span>
                <span>₹74,999.00</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST ({defaultTaxRate}%):</span>
                <span>₹13,499.82</span>
              </div>
              <div className="flex justify-between font-bold text-foreground border-t border-border/60 pt-1 text-xs">
                <span>Total Paid:</span>
                <span>₹88,498.82</span>
              </div>
            </div>

            {/* QR Code / Bank info if enabled */}
            {showPaymentQr && (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-3">
                <div className="w-12 h-12 bg-white p-1 rounded border border-border flex items-center justify-center">
                  <Icon name="QrCodeIcon" size={32} className="text-slate-900" />
                </div>
                <div className="text-3xs space-y-0.5">
                  <p className="font-bold text-foreground">Scan & Pay via UPI</p>
                  <p className="font-mono text-primary font-bold">{paymentUpiId}</p>
                  <p className="text-muted-foreground">{paymentBankDetails}</p>
                </div>
              </div>
            )}

            {/* Terms & Footer */}
            <div className="text-3xs space-y-1 pt-2 border-t border-border/60 text-muted-foreground">
              <p className="font-semibold text-foreground">Terms & Conditions:</p>
              <p className="whitespace-pre-line leading-relaxed">{invoiceTerms}</p>
              <p className="italic text-center pt-2 text-foreground font-medium border-t border-border/40">
                {invoiceFooter}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4 text-xs">
        {/* Upload Custom Canva / Graphic Background */}
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
          <label className="font-bold text-foreground block">
            Upload Custom Invoice Design / Background (Canva Export)
          </label>
          <p className="text-3xs text-muted-foreground">
            Super Admins can upload custom template designs exported from Canva (PNG, JPG, WebP,
            SVG). The layout fields will overlay crisply.
          </p>
          <div className="flex items-center gap-3 pt-1">
            {isSuperAdmin && (
              <label className="btn-secondary text-xs cursor-pointer gap-2 inline-flex items-center">
                <Icon name="ArrowUpTrayIcon" size={14} />
                Choose Canva Template Image
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={handleInvoiceTemplateUpload}
                  className="hidden"
                />
              </label>
            )}
            {invoiceTemplateUrl && isSuperAdmin && (
              <button
                type="button"
                onClick={() => setInvoiceTemplateUrl(null)}
                className="btn-ghost text-xs text-danger hover:bg-danger/10"
              >
                Remove Custom Template
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">Invoice Business Header *</label>
          <input
            type="text"
            required
            disabled={!isSuperAdmin}
            value={invoiceHeader}
            onChange={(e) => setInvoiceHeader(e.target.value)}
            className="input-field text-xs font-bold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-foreground block mb-1">
              Watermark Opacity ({watermarkOpacity}%)
            </label>
            <input
              type="range"
              min="0"
              max="25"
              disabled={!isSuperAdmin}
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-3xs text-muted-foreground mt-0.5">
              Renders official COSKO branding emblem strictly as watermark.
            </p>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1">Accent Styling</label>
            <select
              disabled={!isSuperAdmin}
              value={invoiceAccentColor}
              onChange={(e) => setInvoiceAccentColor(e.target.value)}
              className="input-field text-xs"
            >
              <option value="primary">COSKO Indigo (Default)</option>
              <option value="emerald">Emerald Retail</option>
              <option value="navy">Classic Navy</option>
              <option value="amber">Warm Amber</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/60">
          <div>
            <span className="font-bold text-foreground block text-xs">
              Store Address on Invoices
            </span>
            <span className="text-3xs text-muted-foreground block">
              Automatically include registered store outlet address and manager contact on invoices.
            </span>
          </div>
          <ToggleSwitch
            id="showStore"
            disabled={!isSuperAdmin}
            checked={showStoreAddress}
            onChange={setShowStoreAddress}
            size="sm"
            onText="ON"
            offText="OFF"
          />
        </div>

        {/* UPI QR Settings */}
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-foreground block text-xs">
                Instant UPI Payment QR Code
              </span>
              <span className="text-3xs text-muted-foreground block">
                Print instant UPI QR code on generated invoices and checkout thermal receipts.
              </span>
            </div>
            <ToggleSwitch
              id="showQr"
              disabled={!isSuperAdmin}
              checked={showPaymentQr}
              onChange={setShowPaymentQr}
              size="sm"
              onText="ON"
              offText="OFF"
            />
          </div>

          {showPaymentQr && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="font-bold text-foreground block mb-1">UPI VPA / ID</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={paymentUpiId}
                  onChange={(e) => setPaymentUpiId(e.target.value)}
                  placeholder="cosko@icici"
                  className="input-field text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-foreground block mb-1">
                  Bank Account Settlement Details
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={paymentBankDetails}
                  onChange={(e) => setPaymentBankDetails(e.target.value)}
                  placeholder="HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234"
                  className="input-field text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">
            Standard Terms & Conditions
          </label>
          <textarea
            rows={3}
            disabled={!isSuperAdmin}
            value={invoiceTerms}
            onChange={(e) => setInvoiceTerms(e.target.value)}
            className="input-field text-xs font-mono"
          />
        </div>

        <div>
          <label className="font-bold text-foreground block mb-1">Invoice Footer Note</label>
          <input
            type="text"
            disabled={!isSuperAdmin}
            value={invoiceFooter}
            onChange={(e) => setInvoiceFooter(e.target.value)}
            className="input-field text-xs"
          />
        </div>
      </div>
    </div>
  );
};
