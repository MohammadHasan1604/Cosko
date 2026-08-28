'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import DashboardFilters from './components/DashboardFilters';
import KpiBentoGrid from './components/KpiBentoGrid';
import LowStockAlerts from './components/LowStockAlerts';
import RecentActivityFeed from './components/RecentActivityFeed';

// Dynamically load heavy Recharts components to optimize initial page compilation & client bundle size
const DashboardCharts = dynamic(() => import('./components/DashboardCharts'), {
  ssr: false,
  loading: () => <div className="h-64 card animate-pulse bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Loading Analytics Charts...</div>,
});

export default function DashboardPage() {
  return (
    <AppLayout activeRoute="/">
      <div className="space-y-6 fade-in">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              COSKO Enterprise · Multi-Store Command & Analytics
            </p>
          </div>
          <DashboardFilters />
        </div>

        {/* KPI bento grid */}
        <KpiBentoGrid />

        {/* Dynamic Charts Row */}
        <DashboardCharts />

        {/* Bottom row: alerts + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <LowStockAlerts />
          </div>
          <div className="lg:col-span-3">
            <RecentActivityFeed />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}