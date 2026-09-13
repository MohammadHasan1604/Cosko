'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'product-sales' | 'supplier-purchases' | 'employee-sales' | 'overview-sales';
  id: string;
  store: string;
  period: string;
  startDate?: string;
  endDate?: string;
}

export default function DrilldownModal({ isOpen, onClose, title, type, id, store, period, startDate, endDate }: DrilldownModalProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        id,
        store,
        period,
        page: String(p),
        limit: '50',
      });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      let token = '';
      try {
        const saved = localStorage.getItem('cosko_active_session');
        if (saved) token = JSON.parse(saved).token || '';
      } catch {}

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/reports/drilldown?${params.toString()}`, {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotalPages(data.totalPages || 1);
        setTotalRecords(data.totalRecords || 0);
      }
    } catch (err) {
      console.error('Drilldown fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [type, id, store, period, startDate, endDate]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchData(1);
    }
  }, [isOpen, fetchData]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchData(newPage);
    }
  };

  const fmt = (v: number) => v?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {totalRecords} record{totalRecords !== 1 ? 's' : ''} found · Page {page} of {totalPages}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No records found for this drill-down.
            </div>
          ) : type === 'product-sales' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="px-3 py-2.5">Order No</th>
                  <th className="px-3 py-2.5">Store</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Cashier</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 text-right">Unit Cost</th>
                  <th className="px-3 py-2.5 text-right">Line Total</th>
                  <th className="px-3 py-2.5 text-right">Line Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {records.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-2xs font-bold text-primary">{r.orderNo}</td>
                    <td className="px-3 py-2.5"><span className="badge-info text-3xs">{r.store}</span></td>
                    <td className="px-3 py-2.5">{r.customer}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.cashier}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-2xs">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold">{r.qty}</td>
                    <td className="px-3 py-2.5 text-right font-tabular">₹{fmt(r.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right font-tabular text-muted-foreground">₹{fmt(r.unitCost)}</td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold">₹{fmt(r.lineTotal)}</td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold text-success">₹{fmt(r.lineProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : type === 'supplier-purchases' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="px-3 py-2.5">PO No</th>
                  <th className="px-3 py-2.5">Invoice</th>
                  <th className="px-3 py-2.5">Store</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Units</th>
                  <th className="px-3 py-2.5 text-right">Total Cost</th>
                  <th className="px-3 py-2.5 text-right">Paid</th>
                  <th className="px-3 py-2.5 text-right">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {records.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-2xs font-bold text-primary">{r.poNo}</td>
                    <td className="px-3 py-2.5 font-mono text-2xs">{r.invoiceNo || '—'}</td>
                    <td className="px-3 py-2.5"><span className="badge-info text-3xs">{r.store}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-2xs">{new Date(r.orderDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2.5"><span className={`text-3xs font-bold px-2 py-0.5 rounded-full ${r.status === 'Received' || r.status === 'Completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{r.status}</span></td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold">{r.totalUnits}</td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold">₹{fmt(r.totalCost)}</td>
                    <td className="px-3 py-2.5 text-right font-tabular text-success font-semibold">₹{fmt(r.paidAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-tabular text-danger font-semibold">₹{fmt(Math.max(0, r.totalCost - r.paidAmount - (r.creditAmount || 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* employee-sales and overview-sales */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="px-3 py-2.5">Order No</th>
                  <th className="px-3 py-2.5">Store</th>
                  <th className="px-3 py-2.5">Customer</th>
                  {type === 'overview-sales' && <th className="px-3 py-2.5">Cashier</th>}
                  <th className="px-3 py-2.5">Payment</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5 text-right">Grand Total</th>
                  <th className="px-3 py-2.5 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {records.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-2xs font-bold text-primary">{r.orderNo}</td>
                    <td className="px-3 py-2.5"><span className="badge-info text-3xs">{r.store}</span></td>
                    <td className="px-3 py-2.5">{r.customer}</td>
                    {type === 'overview-sales' && <td className="px-3 py-2.5 text-muted-foreground">{r.cashier}</td>}
                    <td className="px-3 py-2.5"><span className="badge-secondary text-3xs">{r.paymentMethod}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-2xs">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold">₹{fmt(r.grandTotal)}</td>
                    <td className="px-3 py-2.5 text-right font-tabular font-bold text-success">₹{fmt(r.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="btn-secondary text-xs gap-1 py-1.5 disabled:opacity-40"
            >
              <Icon name="ChevronLeftIcon" size={14} /> Previous
            </button>
            <span className="text-2xs text-muted-foreground">
              Page {page} of {totalPages} · {totalRecords} total records
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn-secondary text-xs gap-1 py-1.5 disabled:opacity-40"
            >
              Next <Icon name="ChevronRightIcon" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
