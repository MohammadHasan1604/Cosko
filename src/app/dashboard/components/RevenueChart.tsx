'use client';
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApp } from '@/context/AppContext';

const formatINR = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
};

interface TooltipPayloadItem {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-modal px-4 py-3 text-sm">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={`tooltip-${p.name}`} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground font-tabular">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueChart() {
  const { sales, selectedStore } = useApp();

  const filteredSales = sales.filter((s) => selectedStore === 'All Stores' || s.store === selectedStore);

  // Group sales by date or create last 7 days chart
  const dateMap: Record<string, { revenue: number; profit: number }> = {};

  filteredSales.forEach((s) => {
    const d = s.createdAt || 'Today';
    if (!dateMap[d]) dateMap[d] = { revenue: 0, profit: 0 };
    dateMap[d].revenue += s.total || 0;
    dateMap[d].profit += (s.total || 0) * 0.30;
  });

  const chartData = Object.keys(dateMap).length > 0
    ? Object.keys(dateMap).map((date) => ({
        date,
        revenue: dateMap[date].revenue,
        profit: dateMap[date].profit,
      }))
    : [
        { date: 'Mon', revenue: 0, profit: 0 },
        { date: 'Tue', revenue: 0, profit: 0 },
        { date: 'Wed', revenue: 0, profit: 0 },
        { date: 'Thu', revenue: 0, profit: 0 },
        { date: 'Fri', revenue: 0, profit: 0 },
        { date: 'Sat', revenue: 0, profit: 0 },
        { date: 'Sun', revenue: 0, profit: 0 },
      ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--positive)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--positive)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={formatINR}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#gradRevenue)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="profit"
          name="Gross Profit"
          stroke="var(--positive)"
          strokeWidth={2}
          fill="url(#gradProfit)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}