'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';

export interface ProofViewerData {
  proofUrl?: string;
  url?: string;
  title?: string;
  amount?: number;
  paymentMethod?: string;
  referenceNo?: string;
  paymentDate?: string | Date;
  recordedBy?: string;
  entityName?: string;
  payeeOrPayer?: string;
  billNo?: string;
  notes?: string;
  timestamp?: string | Date;
}

export type PaymentProofData = ProofViewerData;

interface ProofViewerModalProps {
  open?: boolean;
  onClose: () => void;
  data?: ProofViewerData | null;
  proof?: ProofViewerData | null;
}

export default function ProofViewerModal({ open, onClose, data, proof }: ProofViewerModalProps) {
  const activeData = proof || data;
  const isModalOpen = open !== undefined ? open : Boolean(activeData);

  if (!isModalOpen || !activeData) return null;

  const url = activeData.proofUrl || activeData.url;
  if (!url) return null;
  const isPdf = url.toLowerCase().endsWith('.pdf') || url.includes('application/pdf');
  const filename = url.split('/').pop() || 'payment-proof';

  const formattedDate = activeData.paymentDate
    ? new Date(activeData.paymentDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : undefined;

  const formattedTimestamp = activeData.timestamp
    ? new Date(activeData.timestamp).toLocaleString('en-IN')
    : undefined;

  const displayName = activeData.entityName || activeData.payeeOrPayer;

  return (
    <Modal
      open={isModalOpen}
      onClose={onClose}
      title={activeData.title || 'Authoritative Payment Proof & Voucher'}
      subtitle={
        activeData.billNo
          ? `Transaction Ref: ${activeData.billNo}`
          : 'Verified Financial Transaction'
      }
      size="standard"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <span className="text-3xs text-muted-foreground font-mono truncate max-w-[200px] hidden sm:inline">
            File: {filename}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={url}
              download={filename}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-xs py-1.5 px-3 gap-1.5 font-bold flex-1 sm:flex-initial text-center justify-center inline-flex items-center"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              Download Proof
            </a>
            <button type="button" onClick={onClose} className="btn-secondary text-xs py-1.5 px-3 flex-1 sm:flex-initial">
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-xs">
        {/* Metadata summary header card */}
        <div className="p-3.5 bg-muted/40 border border-border rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activeData.amount !== undefined && (
            <div>
              <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold block">
                Amount Paid
              </span>
              <span className="text-base font-black text-emerald-600 font-tabular">
                ₹{Number(activeData.amount).toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {activeData.paymentMethod && (
            <div>
              <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold block">
                Payment Method
              </span>
              <span className="text-xs font-bold text-foreground block truncate">
                {activeData.paymentMethod}
              </span>
            </div>
          )}

          {activeData.referenceNo && (
            <div>
              <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold block">
                UTR / Reference
              </span>
              <span
                className="text-xs font-mono font-bold text-primary block truncate"
                title={activeData.referenceNo}
              >
                {activeData.referenceNo}
              </span>
            </div>
          )}

          {formattedDate && (
            <div>
              <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold block">
                Payment Date
              </span>
              <span className="text-xs font-semibold text-foreground block">{formattedDate}</span>
            </div>
          )}

          {displayName && (
            <div className="col-span-2 sm:col-span-2">
              <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold block">
                Payee / Customer
              </span>
              <span className="text-xs font-bold text-foreground block truncate">
                {displayName}
              </span>
            </div>
          )}

          {activeData.recordedBy && (
            <div className="col-span-2 sm:col-span-2">
              <span className="text-3xs uppercase tracking-wider text-muted-foreground font-bold block">
                Recorded By / Uploader
              </span>
              <span className="text-xs font-medium text-muted-foreground block truncate">
                {activeData.recordedBy} {formattedTimestamp ? `(${formattedTimestamp})` : ''}
              </span>
            </div>
          )}
        </div>

        {activeData.notes && (
          <div className="p-2.5 bg-muted/20 border border-border/60 rounded-lg text-3xs text-muted-foreground">
            <strong className="text-foreground">Remarks:</strong> {activeData.notes}
          </div>
        )}

        {/* Proof Document Viewer */}
        <div className="border border-border rounded-xl overflow-hidden bg-muted/20 flex flex-col items-center justify-center min-h-[260px] max-h-[460px]">
          {isPdf ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center p-4 bg-muted/10">
              <iframe
                src={`${url}#toolbar=1`}
                className="w-full h-full rounded-lg border border-border"
                title="PDF Payment Proof"
              />
            </div>
          ) : (
            <div className="p-3 w-full h-full flex items-center justify-center overflow-auto max-h-[420px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Payment Proof Document"
                className="max-w-full max-h-[400px] object-contain rounded-lg shadow-xs"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
