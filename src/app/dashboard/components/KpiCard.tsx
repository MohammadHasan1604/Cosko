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

const colorConfig: Record<
  KpiColor,
  { bg: string; iconBg: string; iconColor: string; valueTint: string }
> = {
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
      aria-label={
        isClickable ? `${label}: ${value}. ${drillDownLabel || 'Click to drill down'}` : undefined
      }
      className={`rounded-xl border shadow-card h-full flex transition-all select-none ${
        isHero
          ? 'p-4 md:p-5 flex-col justify-between'
          : 'p-3 md:p-4 flex-row items-center gap-3 md:flex-col md:items-stretch md:gap-0'
      } ${isPrimary ? 'bg-primary border-primary' : 'bg-card border-border/80'} ${
        isClickable
          ? 'cursor-pointer hover:border-primary/60 hover:shadow-card-hover active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
          : ''
      }`}
    >
      {/* Compact mobile layout for non-hero cards: icon + value inline */}
      {!isHero ? (
        <>
          {/* Icon - visible on all sizes */}
          <div
            className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg} md:mb-3`}
          >
            <Icon
              name={icon as Parameters<typeof Icon>[0]['name']}
              size={18}
              className={cfg.iconColor}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-2xs md:text-xs font-semibold uppercase tracking-wider truncate ${isPrimary ? 'text-blue-200' : 'text-muted-foreground'}`}
            >
              {label}
            </p>
            <p
              className={`metric-value text-base md:text-xl ${isPrimary ? 'text-white' : 'text-foreground'} truncate tracking-tight mt-0.5 md:mt-1`}
            >
              {value}
            </p>
            {/* Trend + change - visible on tablet+ or as subtext on mobile */}
            <div className="flex items-center gap-1 mt-1">
              <Icon
                name={trendCfg.icon as Parameters<typeof Icon>[0]['name']}
                size={11}
                className={isPrimary ? 'text-blue-200' : trendCfg.colorClass}
              />
              <span
                className={`text-2xs font-semibold ${isPrimary ? 'text-blue-200' : trendCfg.colorClass}`}
              >
                {change}
              </span>
            </div>
          </div>

          {/* Drill-down affordance */}
          {isClickable && (
            <div className="flex-shrink-0 md:mt-2">
              <span className="text-2xs font-medium text-primary hidden md:inline-flex items-center gap-1">
                {drillDownLabel || 'Details'} <Icon name="ChevronRightIcon" size={10} />
              </span>
              <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground md:hidden" />
            </div>
          )}
        </>
      ) : (
        /* Hero card layout - unchanged for desktop, compact for mobile */
        <>
          <div className="flex items-start justify-between gap-3 mb-2 md:mb-3">
            <div className="min-w-0 flex-1">
              <p
                className={`text-2xs md:text-xs font-semibold uppercase tracking-wider mb-1 truncate ${isPrimary ? 'text-blue-200' : 'text-muted-foreground'}`}
              >
                {label}
              </p>
            </div>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}
            >
              <Icon
                name={icon as Parameters<typeof Icon>[0]['name']}
                size={18}
                className={cfg.iconColor}
              />
            </div>
          </div>

          <div className="min-w-0">
            <p
              className={`metric-value text-xl md:text-2xl lg:text-3xl ${isPrimary ? 'text-white' : 'text-foreground'} truncate tracking-tight`}
            >
              {value}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 md:mt-2">
              <Icon
                name={trendCfg.icon as Parameters<typeof Icon>[0]['name']}
                size={13}
                className={isPrimary ? 'text-blue-200' : trendCfg.colorClass}
              />
              <span
                className={`text-xs font-semibold ${isPrimary ? 'text-blue-200' : trendCfg.colorClass}`}
              >
                {change}
              </span>
              <span
                className={`text-xs hidden sm:inline ${isPrimary ? 'text-blue-300' : 'text-muted-foreground'}`}
              >
                {subtext}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
