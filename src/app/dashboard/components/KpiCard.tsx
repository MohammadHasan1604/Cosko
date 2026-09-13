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
  onClick?: () => void;
  clickable?: boolean;
  drillDownLabel?: string;
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

export default function KpiCard({
  label,
  value,
  change,
  trend,
  subtext,
  icon,
  variant,
  color,
  onClick,
  clickable,
  drillDownLabel,
}: KpiCardProps) {
  const cfg = colorConfig[color];
  const trendCfg = trendConfig[trend];
  const isHero = variant === 'hero';
  const isPrimary = color === 'primary';
  const isClickable = Boolean(onClick || clickable);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
      className={`rounded-xl border shadow-card h-full p-5 flex flex-col justify-between transition-all duration-200 select-none ${
        isPrimary ? 'bg-primary border-primary' : 'bg-card border-border'
      } ${
        isClickable
          ? 'cursor-pointer hover:border-primary/70 hover:shadow-card-hover hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/40'
          : 'hover:shadow-card-hover'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${isPrimary ? 'text-blue-200' : 'text-muted-foreground'}`}>
              {label}
            </p>
            {isClickable && (
              <span className="text-3xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                {drillDownLabel || 'Drill down'}
              </span>
            )}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg} ${isClickable ? 'group-hover:scale-110 transition-transform' : ''}`}>
          <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} className={cfg.iconColor} />
        </div>
      </div>

      {/* Value */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`metric-value ${isHero ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'} ${isPrimary ? 'text-white' : 'text-foreground'} truncate tracking-tight`}>
            {value}
          </p>
          {isClickable && (
            <span className="text-2xs text-muted-foreground hover:text-primary flex items-center gap-0.5 opacity-80">
              View bills <Icon name="ArrowRightIcon" size={11} />
            </span>
          )}
        </div>

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