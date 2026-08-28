'use client';
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Mock data — backend integration: GET /api/v1/reports/revenue-trend?days=30&storeId=all
const data = [
  { date: '14 Jul', revenue: 72400, profit: 24800 },
  { date: '15 Jul', revenue: 81200, profit: 27100 },
  { date: '16 Jul', revenue: 68900, profit: 22400 },
  { date: '17 Jul', revenue: 91500, profit: 31200 },
  { date: '18 Jul', revenue: 88300, profit: 29800 },
  { date: '19 Jul', revenue: 104200, profit: 35600 },
  { date: '20 Jul', revenue: 96800, profit: 32100 },
  { date: '21 Jul', revenue: 78400, profit: 25900 },
  { date: '22 Jul', revenue: 85600, profit: 28700 },
  { date: '23 Jul', revenue: 112400, profit: 38900 },
  { date: '24 Jul', revenue: 98700, profit: 33200 },
  { date: '25 Jul', revenue: 87300, profit: 29100 },
  { date: '26 Jul', revenue: 94100, profit: 31800 },
  { date: '27 Jul', revenue: 118600, profit: 41200 },
  { date: '28 Jul', revenue: 103400, profit: 34900 },
  { date: '29 Jul', revenue: 91800, profit: 30600 },
  { date: '30 Jul', revenue: 108200, profit: 36800 },
  { date: '31 Jul', revenue: 124600, profit: 43100 },
  { date: '01 Aug', revenue: 98300, profit: 32400 },
  { date: '02 Aug', revenue: 87400, profit: 28900 },
  { date: '03 Aug', revenue: 112800, profit: 38200 },
  { date: '04 Aug', revenue: 134200, profit: 46800 },
  { date: '05 Aug', revenue: 118400, profit: 40100 },
  { date: '06 Aug', revenue: 106700, profit: 35600 },
  { date: '07 Aug', revenue: 128900, profit: 44200 },
  { date: '08 Aug', revenue: 142300, profit: 49800 },
  { date: '09 Aug', revenue: 119600, profit: 40900 },
  { date: '10 Aug', revenue: 138400, profit: 47600 },
  { date: '11 Aug', revenue: 126800, profit: 43200 },
  { date: '12 Aug', revenue: 148200, profit: 51400 },
];

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
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
          interval={4}
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