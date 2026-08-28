import React from 'react';
import Icon from '@/components/ui/AppIcon';

type KpiColor = 'primary' | 'positive' | 'warning' | 'danger' | 'info' | 'neutral';
type KpiTrend = 'up' | 'down' | 'neutral' | 'alert';
type KpiVariant = 'hero' | 'normal';

interface KpiCardProps {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: KpiTrend;
  subtext: string;
  icon: string;
  variant: KpiVariant;
  color: KpiColor;
}

const colorConfig: Record<KpiColor, { bg: string; iconBg: string; iconColor: string; valueTint: string }> = {
  primary: {
    bg: 'bg-primary',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    valueTint: 'text-white',
  },
  positive: {
    bg: 'bg-card',
    iconBg: 'bg-positive/10',
    iconColor: 'text-positive',
    valueTint: 'text-foreground',
  },
  warning: {
    bg: 'bg-card',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    valueTint: 'text-foreground',
  },
  danger: {
    bg: 'bg-card',
    iconBg: 'bg-danger/10',
    iconColor: 'text-danger',
    valueTint: 'text-foreground',
  },
  info: {
    bg: 'bg-card',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
    valueTint: 'text-foreground',
  },
  neutral: {
    bg: 'bg-card',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    valueTint: 'text-foreground',
  },
};

const trendConfig: Record<KpiTrend, { icon: string; colorClass: string; label: string }> = {
  up: { icon: 'ArrowTrendingUpIcon', colorClass: 'text-positive', label: '' },
  down: { icon: 'ArrowTrendingDownIcon', colorClass: 'text-danger', label: '' },
  neutral: { icon: 'MinusIcon', colorClass: 'text-muted-foreground', label: '' },
  alert: { icon: 'ExclamationTriangleIcon', colorClass: 'text-warning', label: '' },
};

export default function KpiCard({ label, value, change, trend, subtext, icon, variant, color }: KpiCardProps) {
  const cfg = colorConfig[color];
  const trendCfg = trendConfig[trend];
  const isHero = variant === 'hero';
  const isPrimary = color === 'primary';

  return (
    <div
      className={`rounded-xl border shadow-card h-full p-5 flex flex-col justify-between transition-shadow duration-200 hover:shadow-card-hover ${
        isPrimary ? 'bg-primary border-primary' : 'bg-card border-border'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${isPrimary ? 'text-blue-200' : 'text-muted-foreground'}`}>
            {label}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
          <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} className={cfg.iconColor} />
        </div>
      </div>

      {/* Value */}
      <div>
        <p className={`metric-value ${isHero ? 'text-3xl' : 'text-2xl'} ${isPrimary ? 'text-white' : 'text-foreground'}`}>
          {value}
        </p>

        {/* Change row */}
        <div className="flex items-center gap-1.5 mt-2">
          <Icon
            name={trendCfg.icon as Parameters<typeof Icon>[0]['name']}
            size={13}
            className={isPrimary ? 'text-blue-200' : trendCfg.colorClass}
          />
          <span className={`text-xs font-semibold ${isPrimary ? 'text-blue-200' : trendCfg.colorClass}`}>
            {change}
          </span>
          <span className={`text-xs ${isPrimary ? 'text-blue-300' : 'text-muted-foreground'}`}>
            {subtext}
          </span>
        </div>
      </div>
    </div>
  );
}