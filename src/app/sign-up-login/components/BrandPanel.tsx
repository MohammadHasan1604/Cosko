'use client';
import React from 'react';
import AppLogo from '@/components/ui/AppLogo';
import { useApp } from '@/context/AppContext';

export default function BrandPanel() {
  const { branding } = useApp();

  return (
    <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative overflow-hidden flex-col gradient-primary p-12">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 -left-16 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }}
        />
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3">
        <AppLogo size={36} />
        <span className="text-white font-bold text-xl tracking-tight">{branding.appName}</span>
      </div>
      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center mt-12">
        <h1 className="text-white font-bold leading-tight mb-4" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          One platform for your entire retail business
        </h1>
        <p className="text-blue-200 text-base leading-relaxed mb-10 max-w-sm">
          Manage inventory, sales, purchases, employees, and P&L across all your stores from a single command center.
        </p>

        {/* Feature highlights */}
        <div className="space-y-4">
          {[
            { icon: '📦', label: 'FIFO Inventory Tracking', desc: 'Real-time stock levels with lot-based COGS' },
            { icon: '🏪', label: 'Multi-Store Management', desc: 'Unlimited stores, centralized visibility' },
            { icon: '📊', label: 'Live P&L Reporting', desc: 'Revenue, gross profit, and expenses in one view' },
            { icon: '👥', label: 'Role-Based Access', desc: 'Granular permissions per module and store' },
          ]?.map((feat) => (
            <div key={`feat-${feat?.label}`} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{feat?.icon}</span>
              <div>
                <p className="text-white text-sm font-semibold">{feat?.label}</p>
                <p className="text-blue-200 text-xs mt-0.5">{feat?.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom stats */}
      <div className="relative z-10 grid grid-cols-3 gap-4 pt-8 border-t border-white/20">
        {[
          { value: '50+', label: 'Demo Products' },
          { value: '3', label: 'Store Locations' },
          { value: '5', label: 'User Roles' },
        ]?.map((stat) => (
          <div key={`stat-${stat?.label}`} className="text-center">
            <p className="text-white font-bold text-xl font-tabular">{stat?.value}</p>
            <p className="text-blue-200 text-xs mt-0.5">{stat?.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}