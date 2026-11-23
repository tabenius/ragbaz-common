const formats = new Map<string, Intl.DateTimeFormat>();
function format(zone: string, weekday?: 'short' | 'long') {
  const key = `${zone}/${weekday ?? 'day'}`;
  let value = formats.get(key);
  if (!value) {
    value = new Intl.DateTimeFormat('en-GB', { timeZone: zone, calendar: 'gregory', ...(weekday ? { weekday } : { year: 'numeric', month: '2-digit', day: '2-digit' }) });
    formats.set(key, value);
  }
  return value;
}
/** Derived only at render time. Calendar-day boundaries respect the supplied zone. */
export function relativeDayLabel(date: Date, now: Date, zone = 'UTC', compact = false): string {
  const parts = (value: Date) => Object.fromEntries(format(zone).formatToParts(value).map(part => [part.type, part.value]));
  const target = parts(date);
  const current = parts(now);
  const ordinal = (value: Record<string, string>) => Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) / 86400000;
  const difference = ordinal(target) - ordinal(current);
  if (difference === 0) return 'today';
  if (difference === -1) return 'yesterday';
  if (difference === 1) return 'tomorrow';
  if (Math.abs(difference) < 7) return `${difference < 0 ? 'last ' : 'next '}${format(zone, compact ? 'short' : 'long').format(date)}`;
  return `${target.year}-${target.month}-${target.day}`;
}
