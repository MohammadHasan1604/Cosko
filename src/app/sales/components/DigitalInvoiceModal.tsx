'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';
import CoskoLogo from '@/components/ui/CoskoLogo';

interface DigitalInvoiceModalProps {
  receiptModal: any | null;
  onClose: () => void;
  branding: any;
  systemSettings: any;
  onSendWhatsApp: (sale: any) => void;
  onViewProof: (proof: any) => void;
}

export const DigitalInvoiceModal: React.FC<DigitalInvoiceModalProps> = ({
  receiptModal,
  onClose,
  branding,
  systemSettings,
  onSendWhatsApp,
  onViewProof,
}) => {
  if (!receiptModal) return null;

  return (
    <Modal
      open={!!receiptModal}
      onClose={onClose}
      title="COSKO Digital Tax Invoice"
      subtitle={`${receiptModal.orderNo} · ${receiptModal.createdAt || 'Today'}`}
      size="standard"
      footer={
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
          >
            <Icon name="PrinterIcon" size={14} />
            <span>Print / PDF</span>
          </button>
          <button
            type="button"
            onClick={() => onSendWhatsApp(receiptModal)}
            className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1.5 font-bold"
            title="Send WhatsApp Invoice"
            aria-label="Send WhatsApp Invoice"
          >
            <Icon name="WhatsApp" size={14} />
            <span>Send WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs flex-1 sm:flex-initial"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="relative space-y-4 py-2 text-xs overflow-hidden">
        {/* Canva / Custom Template Background if configured */}
        {systemSettings?.invoiceTemplateUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none z-0"
            style={{ backgroundImage: `url(${systemSettings.invoiceTemplateUrl})` }}
          />
        )}

        {/* SVG Watermark Overlay: COSKO LOGO ONLY (Strictly configured opacity) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ opacity: (systemSettings?.watermarkOpacity ?? 5) / 100 }}
        >
          <svg
            width="220"
            height="220"
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
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-8 object-contain" />
              ) : (
                <CoskoLogo size={28} showText variant="default" />
              )}
            </div>
            <h4 className="font-extrabold text-foreground text-sm">
              {systemSettings?.invoiceHeader || branding.appName || 'COSKO Retail Enterprise'}
            </h4>
            <p className="text-2xs text-muted-foreground">
              Invoice #:{' '}
              <strong className="font-mono text-foreground">{receiptModal.orderNo}</strong> · Store:{' '}
              {receiptModal.store}
            </p>
            {systemSettings?.showStoreAddress && (
              <p className="text-3xs text-muted-foreground mt-0.5">
                {branding.businessAddress || '100 Feet Ring Road, Indiranagar'},{' '}
                {branding.city || 'Bengaluru'} · Phone:{' '}
                {branding.supportPhone || '+91 80 4000 8800'}
              </p>
            )}
            <p className="text-3xs font-mono text-muted-foreground mt-0.5">
              COSKO GSTIN:{' '}
              <strong>
                {receiptModal.coskoGstin ||
                  systemSettings?.gstin ||
                  branding.taxNumber ||
                  '29AABCU9603R1ZM'}
              </strong>
            </p>
          </div>

          {/* Billed To */}
          <div className="flex justify-between border-b border-border pb-2">
            <div>
              <p className="font-bold text-foreground">Billed To: {receiptModal.customerName}</p>
              <p className="text-2xs text-muted-foreground">Phone: {receiptModal.customerPhone}</p>
              {receiptModal.customerGstin && (
                <p className="text-2xs font-mono text-primary font-bold">
                  GSTIN: {receiptModal.customerGstin}
                </p>
              )}
              {receiptModal.customerBillingAddress && (
                <p className="text-3xs text-muted-foreground">
                  {receiptModal.customerBillingAddress}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xs font-semibold text-muted-foreground">Warranty Valid Until:</p>
              <p className="font-bold text-foreground">
                {receiptModal.warrantyExpiryDate || '12 Months'}
              </p>
            </div>
          </div>

          {/* Items List */}
          <div className="border-b border-border py-2 space-y-1.5 font-tabular">
            {receiptModal.items?.map((item: any, idx: number) => (
              <div key={`rcpt-line-${idx}`} className="flex justify-between">
                <div>
                  <span className="font-semibold">
                    {item.name} x {item.qty}
                  </span>
                  {item.warrantyMonths && (
                    <span className="text-3xs text-muted-foreground block">
                      {item.warrantyMonths} Months Warranty
                    </span>
                  )}
                </div>
                <span className="font-bold">
                  ₹{(item.unitPrice * item.qty).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-1 font-tabular text-right text-muted-foreground pt-1">
            <p>Taxable Subtotal: ₹{receiptModal.subtotal.toLocaleString('en-IN')}</p>
            {receiptModal.taxEnabled ? (
              <p>
                GST Tax ({systemSettings?.defaultTaxRate ?? 18}%): ₹
                {receiptModal.taxTotal.toLocaleString('en-IN')}
              </p>
            ) : (
              <p>GST Tax: ₹0 (Non-GST)</p>
            )}
            <p className="text-base font-extrabold text-foreground pt-1">
              Total Paid ({receiptModal.paymentMethod}): ₹
              {receiptModal.total.toLocaleString('en-IN')}
            </p>
            {receiptModal.referenceNo && (
              <p className="text-xs font-mono text-muted-foreground">
                Ref / UTR:{' '}
                <span className="font-semibold text-foreground">{receiptModal.referenceNo}</span>
              </p>
            )}
            {receiptModal.paymentProofUrl && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    onViewProof({
                      url: receiptModal.paymentProofUrl!,
                      referenceNo: receiptModal.referenceNo || receiptModal.orderNo,
                      amount: receiptModal.total,
                      paymentMethod: receiptModal.paymentMethod,
                      paymentDate: receiptModal.createdAt,
                      payeeOrPayer: receiptModal.customerName,
                      recordedBy: receiptModal.cashierName || 'POS Terminal',
                      timestamp: receiptModal.createdAt,
                      notes: `Digital Invoice Proof for ${receiptModal.orderNo}`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors shadow-2xs"
                >
                  <Icon name="DocumentCheckIcon" size={14} />
                  View / Download Attached Payment Proof
                </button>
              </div>
            )}
          </div>

          {/* UPI Payment QR if enabled */}
          {systemSettings?.showPaymentQr && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
              <div className="w-12 h-12 bg-white p-1 rounded-lg border border-border flex items-center justify-center shrink-0">
                <Icon name="QrCodeIcon" size={36} className="text-slate-900" />
              </div>
              <div className="text-3xs space-y-0.5">
                <p className="font-bold text-foreground">Scan to Pay / Verify UPI</p>
                <p className="font-mono text-primary font-bold">
                  {systemSettings.paymentUpiId || 'cosko@icici'}
                </p>
                {systemSettings.paymentBankDetails && (
                  <p className="text-muted-foreground">{systemSettings.paymentBankDetails}</p>
                )}
              </div>
            </div>
          )}

          {/* Terms & Footer Note */}
          <div className="text-3xs space-y-1 pt-2 border-t border-border/60 text-muted-foreground">
            {systemSettings?.invoiceTerms && (
              <>
                <p className="font-semibold text-foreground">Terms & Conditions:</p>
                <p className="whitespace-pre-line leading-relaxed">{systemSettings.invoiceTerms}</p>
              </>
            )}
            <p className="italic text-center pt-2 text-foreground font-medium border-t border-border/40">
              {systemSettings?.invoiceFooter ||
                'Thank you for shopping with us! Goods once sold cannot be returned without original receipt.'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
