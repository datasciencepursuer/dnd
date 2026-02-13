/**
 * Timezone utility functions using native Intl API (no external libraries).
 */

/** Detect the browser's IANA timezone string. */
export function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Check if a timezone string is valid IANA. */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface DateParts {
  year: number;
  month: number; // 1-based
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
}

/** Extract calendar parts from a UTC Date as seen in the given timezone. */
export function getDatePartsInTz(date: Date, tz: string): DateParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });

  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const dayOfWeekMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  // hour12:false can output "24" for midnight in some locales — normalize to 0
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour,
    minute: parseInt(get("minute"), 10),
    dayOfWeek: dayOfWeekMap[get("weekday")] ?? 0,
  };
}

/**
 * Create a UTC Date from wall-clock parts in a given timezone.
 * Uses iterative offset correction (at most 2 rounds).
 */
export function createDateInTz(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  // Start with a naive UTC guess
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  for (let i = 0; i < 2; i++) {
    const parts = getDatePartsInTz(guess, tz);
    const diffMs =
      (parts.hour - hour) * 3600000 +
      (parts.minute - minute) * 60000 +
      (parts.day - day) * 86400000;

    if (diffMs === 0) break;
    guess = new Date(guess.getTime() - diffMs);
  }

  return guess;
}

/** Get Monday midnight in `tz` as a UTC Date for the week containing `date`. */
export function getWeekStartInTz(date: Date, tz: string): Date {
  const parts = getDatePartsInTz(date, tz);
  // dayOfWeek: 0=Sun..6=Sat → shift so Mon=0
  const dow = parts.dayOfWeek === 0 ? 6 : parts.dayOfWeek - 1;
  return createDateInTz(parts.year, parts.month, parts.day - dow, 0, 0, tz);
}

/** Get 7 UTC Dates for Mon–Sun midnight in `tz`, starting from `weekStart`. */
export function getWeekDaysInTz(weekStart: Date, tz: string): Date[] {
  const parts = getDatePartsInTz(weekStart, tz);
  return Array.from({ length: 7 }, (_, i) =>
    createDateInTz(parts.year, parts.month, parts.day + i, 0, 0, tz)
  );
}

/** Check whether two UTC instants fall on the same calendar day in `tz`. */
export function isSameDayInTz(a: Date, b: Date, tz: string): boolean {
  const pa = getDatePartsInTz(a, tz);
  const pb = getDatePartsInTz(b, tz);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/** Convert a UTC instant to its half-hour slot index (0–47) in `tz`. */
export function getSlotInTz(date: Date, tz: string): number {
  const parts = getDatePartsInTz(date, tz);
  return parts.hour * 2 + Math.floor(parts.minute / 30);
}

/** Convert a day index + slot to a UTC Date within a week, in `tz`. */
export function slotToUtcDate(
  weekStart: Date,
  dayIndex: number,
  slot: number,
  tz: string
): Date {
  const parts = getDatePartsInTz(weekStart, tz);
  const hour = Math.floor(slot / 2);
  const minute = (slot % 2) * 30;
  return createDateInTz(parts.year, parts.month, parts.day + dayIndex, hour, minute, tz);
}

/** Format a UTC Date as e.g. "3:30 PM" in `tz`. */
export function formatTimeInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Format a UTC Date as e.g. "Wed Feb 12" in `tz`. */
export function formatDayInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Format a UTC Date as "YYYY-MM-DD" in `tz` (for URL ?week= param). */
export function toISODateInTz(date: Date, tz: string): string {
  const parts = getDatePartsInTz(date, tz);
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${parts.year}-${m}-${d}`;
}

/** Get timezone abbreviation, e.g. "EST", "PST". */
export function getTimezoneAbbr(tz: string, date?: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  });
  const parts = fmt.formatToParts(date ?? new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** Check if two UTC instants are in the same week (same Monday) in `tz`. */
export function isSameWeekInTz(a: Date, b: Date, tz: string): boolean {
  const wa = getWeekStartInTz(a, tz);
  const wb = getWeekStartInTz(b, tz);
  return Math.abs(wa.getTime() - wb.getTime()) < 1000; // within 1 second
}
