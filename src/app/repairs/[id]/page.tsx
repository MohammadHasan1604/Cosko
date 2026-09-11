'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

export default function RepairDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useApp();
  const ticketId = params.id as string;

  const [repair, setRepair] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/repairs/${encodeURIComponent(ticketId)}`);
        const data = await res.json();
        if (data.success) {
          setRepair(data.repair);
        } else {
          setError(data.error || 'Failed to load repair record');
        }
      } catch (err: any) {
        setError(err.message || 'Network error');
      } finally {
        setLoading(false);
      }
    };
    if (ticketId) fetchDetail();
  }, [ticketId]);

  const isManagerOrAdmin = ['Super Admin', 'Store Manager', 'Inventory Auditor'].includes(currentUser.role);

  return (
    <AppLayout activeRoute="/repairs">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Back and Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/repairs" className="hover:text-foreground flex items-center gap-1">
            <Icon name="ArrowLeftIcon" className="w-4 h-4" />
            <span>Back to Repairs</span>
          </Link>
          <span>/</span>
          <span className="text-foreground font-mono font-medium">{ticketId}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <span>Loading repair ticket...</span>
          </div>
        ) : error || !repair ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center text-destructive">
            <Icon name="ExclamationTriangleIcon" className="w-8 h-8 mx-auto mb-2" />
            <h3 className="font-semibold text-lg">Record Not Found</h3>
            <p className="text-sm mt-1">{error || 'The requested repair record does not exist in the legacy database.'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-primary/10 text-primary border border-primary/20">
                    {repair.ticketNo}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    Store: {repair.storeCode}
                  </span>
                  <span className="text-xs text-muted-foreground">Source: Legacy DB (Read-Only)</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground mt-2">{repair.deviceName}</h1>
                <p className="text-sm text-muted-foreground">Enquiry Date: {repair.enquiryDate}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Status: {repair.status}
                </span>
                <Link
                  href={`/customers?phone=${encodeURIComponent(repair.customerPhone)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Icon name="UserCircleIcon" className="w-4 h-4" />
                  <span>Open Customer 360</span>
                </Link>
              </div>
            </div>

            {/* Grid Detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info Card */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Icon name="UserIcon" className="w-5 h-5 text-primary" />
                  <span>Customer Information</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium text-foreground">{repair.customerName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Contact Phone:</span>
                    <span className="font-mono font-medium text-foreground">{repair.customerPhone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Normalized Key:</span>
                    <span className="font-mono text-xs text-muted-foreground">{repair.normalizedPhone}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Linked COSKO Sale:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {repair.linkedCoskoSaleNo || 'No retail purchase linked yet'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Device & Issue Card */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Icon name="DevicePhoneMobileIcon" className="w-5 h-5 text-primary" />
                  <span>Device & Symptom Details</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Device Category:</span>
                    <span className="font-medium text-foreground">{repair.deviceType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Model / Description:</span>
                    <span className="font-medium text-foreground">{repair.deviceName}</span>
                  </div>
                  <div className="py-1">
                    <span className="text-muted-foreground block mb-1">Customer Reported Issue:</span>
                    <div className="p-3 bg-secondary/50 rounded-xl text-foreground text-xs leading-relaxed">
                      {repair.issueDescription}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Role-Protected Technician Notes Section */}
            {isManagerOrAdmin ? (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Icon name="WrenchIcon" className="w-5 h-5 text-primary" />
                    <span>Technician Workbench & Diagnosis Notes (Protected)</span>
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                    Manager / Admin Only
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-secondary/40 rounded-xl space-y-1">
                    <span className="text-xs text-muted-foreground">Assigned Technician:</span>
                    <div className="font-semibold text-foreground">{repair.assignedTech || 'Senior Bench Tech'}</div>
                  </div>
                  <div className="p-4 bg-secondary/40 rounded-xl space-y-1">
                    <span className="text-xs text-muted-foreground">Estimated Service Cost:</span>
                    <div className="font-semibold text-foreground">₹{repair.estimatedCost?.toLocaleString('en-IN') || '3,500'}</div>
                  </div>
                </div>
                <div className="p-4 bg-secondary/40 rounded-xl">
                  <span className="text-xs text-muted-foreground block mb-1">Technician Internal Logs:</span>
                  <p className="text-xs text-foreground font-mono leading-relaxed">
                    {repair.technicianNotes || 'No internal technical notes recorded for this ticket.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-secondary/30 border border-border/60 rounded-2xl p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Icon name="LockClosedIcon" className="w-4 h-4 text-muted-foreground" />
                <span>Internal technician diagnosis notes and costing are protected and redacted for Sales Executive roles.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
