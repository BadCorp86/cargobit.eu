const BERLIN_TIME_ZONE = 'Europe/Berlin';
const MS_PER_HOUR = 60 * 60 * 1000;

interface BerlinParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

export function calculatePayoutReleaseEligibleAt(deliveredAt: Date, businessHours = 24): Date {
  let current = normalizeReleaseStart(deliveredAt);
  let remainingMs = businessHours * MS_PER_HOUR;

  while (remainingMs > 0) {
    if (isWeekendInBerlin(current)) {
      current = nextMondayInBerlin(current, 0);
      continue;
    }

    const weekendStart = nextWeekendStartInBerlin(current);
    const availableMs = weekendStart.getTime() - current.getTime();

    if (remainingMs <= availableMs) {
      return new Date(current.getTime() + remainingMs);
    }

    remainingMs -= availableMs;
    current = nextMondayInBerlin(weekendStart, 0);
  }

  return current;
}

export function normalizeReleaseStart(deliveredAt: Date): Date {
  if (!isWeekendInBerlin(deliveredAt)) return deliveredAt;
  return nextMondayInBerlin(deliveredAt, 8);
}

export function isReleaseEligible(deliveredAt: Date, now = new Date()): boolean {
  return now.getTime() >= calculatePayoutReleaseEligibleAt(deliveredAt).getTime();
}

function nextWeekendStartInBerlin(date: Date): Date {
  const parts = getBerlinParts(date);
  const weekdayIndex = weekdayToIndex(parts.weekday);
  const daysUntilSaturday = 6 - weekdayIndex;

  return berlinLocalDate(parts.year, parts.month, parts.day + daysUntilSaturday, 0, 0, 0);
}

function nextMondayInBerlin(date: Date, hour: number): Date {
  const parts = getBerlinParts(date);
  const weekdayIndex = weekdayToIndex(parts.weekday);
  const daysUntilMonday = ((8 - weekdayIndex) % 7) || 7;

  return berlinLocalDate(parts.year, parts.month, parts.day + daysUntilMonday, hour, 0, 0);
}

function isWeekendInBerlin(date: Date): boolean {
  const weekday = getBerlinParts(date).weekday;
  return weekday === 'Sat' || weekday === 'Sun';
}

function weekdayToIndex(weekday: string) {
  const weekdays: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return weekdays[weekday] || 1;
}

function getBerlinParts(date: Date): BerlinParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BERLIN_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

function berlinLocalDate(year: number, month: number, day: number, hour: number, minute: number, second: number): Date {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  for (let index = 0; index < 2; index++) {
    const offset = getTimeZoneOffsetMs(utc);
    utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offset);
  }

  return utc;
}

function getTimeZoneOffsetMs(date: Date): number {
  const parts = getBerlinParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return asUtc - date.getTime();
}
