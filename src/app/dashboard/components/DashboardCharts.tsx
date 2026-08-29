'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const RevenueChart = dynamic(() => import('./RevenueChart'), { ssr: false });
const SalesByStoreChart = dynamic(() => import('./SalesByStoreChart'), { ssr: false });
const PaymentMethodsChart = dynamic(() => import('./PaymentMethodsChart'), { ssr: false });

export default function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-6">
      {/* Revenue & Profit trend — spans 3 cols */}
      <div className="lg:col-span-3 card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="section-header text-base sm:text-lg">Revenue & Gross Profit</h2>
            <p className="text-xs text-muted-foreground mt-0.5">30-day rolling trend · All stores</p>
          </div>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: 'var(--primary)' }} />
              Revenue
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: 'var(--positive)' }} />
              Gross Profit
            </span>
          </div>
        </div>
        <RevenueChart />
      </div>

      {/* Right column: sales by store + payment methods */}
      <div className="lg:col-span-2 space-y-6">
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="section-header">Sales by Store</h2>
            <p className="text-xs text-muted-foreground mt-0.5">This month</p>
          </div>
          <SalesByStoreChart />
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h2 className="section-header">Payment Methods</h2>
            <p className="text-xs text-muted-foreground mt-0.5">This month · by volume</p>
          </div>
          <PaymentMethodsChart />
        </div>
      </div>
    </div>
  );
}