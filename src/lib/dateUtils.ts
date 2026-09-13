/**
 * Centralized Date & Analytics Calculation Engine for COSKO Enterprise
 * Provides unified, authoritative date parsing, scoping, and bucket generation.
 */

export type DatePeriod =
  | 'Today'
  | 'Yesterday'
  | 'Last 7 Days'
  | 'Last 30 Days'
  | 'This Week'
  | 'This Month'
  | 'Last Month'
  | 'This Quarter'
  | 'This Year'
  | 'Custom Range';

export interface CustomDateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Robust date parser supporting ISO strings, timestamps, Indian formats (DD/MM/YYYY), etc.
 */
export function parseDate(d: string | Date | number | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) {
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof d === 'number') {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const str = String(d).trim();
  // Check if standard ISO format can parse directly
  const parsed = Date.parse(str);
  if (!isNaN(parsed) && !str.includes('/')) {
    return new Date(parsed);
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY format (common Indian business format)
  const datePart = str.split(/[,\sT]+/)[0];
  const parts = datePart.split(/[\/-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    // If first part is 4 digits -> YYYY-MM-DD
    if (p1 > 1000) {
      const dt = new Date(p1, p2 - 1, p3);
      if (!isNaN(dt.getTime())) return dt;
    }
    // If third part is 4 digits -> DD-MM-YYYY
    if (p3 > 1000) {
      // Check for optional time in original string
      const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
      const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;
      const seconds = timeMatch && timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const dt = new Date(p3, p2 - 1, p1, hours, minutes, seconds);
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  // Fallback to standard Date constructor
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Get exact start and end date boundary for a given period.
 */
export function getDateRange(
  period: DatePeriod | string,
  customRange?: CustomDateRange,
  refDate = new Date()
): { start: Date; end: Date } {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const d = refDate.getDate();

  switch (period) {
    case 'Today': {
      const start = new Date(y, m, d, 0, 0, 0, 0);
      const end = new Date(y, m, d, 23, 59, 59, 999);
      return { start, end };
    }
    case 'Yesterday': {
      const start = new Date(y, m, d - 1, 0, 0, 0, 0);
      const end = new Date(y, m, d - 1, 23, 59, 59, 999);
      return { start, end };
    }
    case 'Last 7 Days': {
      const start = new Date(y, m, d - 6, 0, 0, 0, 0);
      const end = new Date(y, m, d, 23, 59, 59, 999);
      return { start, end };
    }
    case 'Last 30 Days': {
      const start = new Date(y, m, d - 29, 0, 0, 0, 0);
      const end = new Date(y, m, d, 23, 59, 59, 999);
      return { start, end };
    }
    case 'This Week': {
      // Monday as first day of week
      const day = refDate.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const start = new Date(y, m, d + diffToMonday, 0, 0, 0, 0);
      const end = new Date(y, m, d + diffToMonday + 6, 23, 59, 59, 999);
      return { start, end };
    }
    case 'This Month': {
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'Last Month': {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'This Quarter': {
      const quarterIndex = Math.floor(m / 3); // 0, 1, 2, 3
      const start = new Date(y, quarterIndex * 3, 1, 0, 0, 0, 0);
      const end = new Date(y, quarterIndex * 3 + 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'This Year': {
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    case 'Custom Range': {
      if (customRange?.start && customRange?.end) {
        const sParts = customRange.start.split('-');
        const eParts = customRange.end.split('-');
        const start = new Date(
          parseInt(sParts[0], 10),
          parseInt(sParts[1], 10) - 1,
          parseInt(sParts[2], 10),
          0, 0, 0, 0
        );
        const end = new Date(
          parseInt(eParts[0], 10),
          parseInt(eParts[1], 10) - 1,
          parseInt(eParts[2], 10),
          23, 59, 59, 999
        );
        return { start, end };
      }
      // Fallback to this month
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    default: {
      // Default to This Month
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
  }
}

/**
 * Get preceding period date range for percentage trend comparisons.
 */
export function getPreviousDateRange(
  period: DatePeriod | string,
  customRange?: CustomDateRange,
  refDate = new Date()
): { start: Date; end: Date } {
  const current = getDateRange(period, customRange, refDate);
  const durationMs = current.end.getTime() - current.start.getTime();

  switch (period) {
    case 'Today': {
      return getDateRange('Yesterday', undefined, refDate);
    }
    case 'Yesterday': {
      const dayBefore = new Date(refDate.getTime() - 2 * 86400 * 1000);
      return getDateRange('Today', undefined, dayBefore);
    }
    case 'Last 7 Days': {
      const end = new Date(current.start.getTime() - 1);
      const start = new Date(end.getTime() - 7 * 86400 * 1000 + 1);
      return { start, end };
    }
    case 'Last 30 Days': {
      const end = new Date(current.start.getTime() - 1);
      const start = new Date(end.getTime() - 30 * 86400 * 1000 + 1);
      return { start, end };
    }
    case 'This Week': {
      const end = new Date(current.start.getTime() - 1);
      const start = new Date(end.getTime() - 7 * 86400 * 1000 + 1);
      return { start, end };
    }
    case 'This Month': {
      return getDateRange('Last Month', undefined, refDate);
    }
    case 'Last Month': {
      const y = refDate.getFullYear();
      const m = refDate.getMonth();
      const start = new Date(y, m - 2, 1, 0, 0, 0, 0);
      const end = new Date(y, m - 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'This Quarter': {
      const y = refDate.getFullYear();
      const m = refDate.getMonth();
      const quarterIndex = Math.floor(m / 3);
      const start = new Date(y, (quarterIndex - 1) * 3, 1, 0, 0, 0, 0);
      const end = new Date(y, quarterIndex * 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'This Year': {
      const y = refDate.getFullYear() - 1;
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return { start, end };
    }
    default: {
      const end = new Date(current.start.getTime() - 1);
      const start = new Date(end.getTime() - durationMs);
      return { start, end };
    }
  }
}

/**
 * Returns true if the given date falls within the designated period.
 */
export function isWithinDatePeriod(
  d: string | Date | number | null | undefined,
  period: DatePeriod | string,
  customRange?: CustomDateRange,
  refDate = new Date()
): boolean {
  const dt = parseDate(d);
  if (!dt) return false;
  const { start, end } = getDateRange(period, customRange, refDate);
  const time = dt.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export interface ChartTimeBucket {
  label: string;
  start: Date;
  end: Date;
}

/**
 * Generates continuous time buckets for charts matching the active date filter.
 */
export function generateChartBuckets(
  period: DatePeriod | string,
  customRange?: CustomDateRange,
  refDate = new Date()
): ChartTimeBucket[] {
  const { start, end } = getDateRange(period, customRange, refDate);
  const buckets: ChartTimeBucket[] = [];

  if (period === 'Today' || period === 'Yesterday') {
    // 6 4-hour slots: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
    const dayStart = new Date(start);
    for (let h = 0; h < 24; h += 4) {
      const bStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), h, 0, 0);
      const bEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), h + 3, 59, 59, 999);
      const label = `${String(h).padStart(2, '0')}:00`;
      buckets.push({ label, start: bStart, end: bEnd });
    }
    return buckets;
  }

  if (period === 'Last 7 Days' || period === 'This Week') {
    // Daily buckets (7 days)
    const cur = new Date(start);
    while (cur <= end) {
      const bStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0);
      const bEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
      const weekday = cur.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = cur.getDate();
      buckets.push({ label: `${weekday} ${dayNum}`, start: bStart, end: bEnd });
      cur.setDate(cur.getDate() + 1);
    }
    return buckets;
  }

  if (period === 'This Month' || period === 'Last Month') {
    // 4 weekly blocks or 5-day intervals
    const cur = new Date(start);
    while (cur <= end) {
      const next = new Date(cur);
      next.setDate(next.getDate() + 4);
      const bEnd = next > end ? new Date(end) : new Date(next.getFullYear(), next.getMonth(), next.getDate(), 23, 59, 59, 999);
      const label = `${cur.getDate()} - ${bEnd.getDate()} ${cur.toLocaleDateString('en-US', { month: 'short' })}`;
      buckets.push({ label, start: new Date(cur), end: bEnd });
      cur.setDate(cur.getDate() + 5);
    }
    return buckets;
  }

  if (period === 'This Quarter') {
    // 3 Monthly buckets
    const cur = new Date(start);
    while (cur <= end) {
      const bStart = new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0);
      const bEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = cur.toLocaleDateString('en-US', { month: 'short' });
      buckets.push({ label, start: bStart, end: bEnd });
      cur.setMonth(cur.getMonth() + 1);
    }
    return buckets;
  }

  if (period === 'This Year') {
    // 12 Monthly buckets
    for (let m = 0; m < 12; m++) {
      const bStart = new Date(start.getFullYear(), m, 1, 0, 0, 0);
      const bEnd = new Date(start.getFullYear(), m + 1, 0, 23, 59, 59, 999);
      const label = bStart.toLocaleDateString('en-US', { month: 'short' });
      buckets.push({ label, start: bStart, end: bEnd });
    }
    return buckets;
  }

  // Custom Range
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
  if (diffDays <= 14) {
    const cur = new Date(start);
    while (cur <= end) {
      const bStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0);
      const bEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
      const label = `${cur.getDate()} ${cur.toLocaleDateString('en-US', { month: 'short' })}`;
      buckets.push({ label, start: bStart, end: bEnd });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    // 6-8 interval slices
    const step = Math.ceil(diffDays / 6);
    const cur = new Date(start);
    while (cur <= end) {
      const next = new Date(cur);
      next.setDate(next.getDate() + step - 1);
      const bEnd = next > end ? new Date(end) : new Date(next.getFullYear(), next.getMonth(), next.getDate(), 23, 59, 59, 999);
      const label = `${cur.getDate()} ${cur.toLocaleDateString('en-US', { month: 'short' })}`;
      buckets.push({ label, start: new Date(cur), end: bEnd });
      cur.setDate(cur.getDate() + step);
    }
  }

  return buckets;
}
