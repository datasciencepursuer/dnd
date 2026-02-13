import {
  getWeekDaysInTz,
  isSameDayInTz,
  getSlotInTz,
  slotToUtcDate,
  formatTimeInTz,
  formatDayInTz,
} from "./tz-utils";

/**
 * Get the Monday of the week containing the given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Sunday = 0, Monday = 1, etc. Shift so Monday = 0
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Get an array of 7 dates (Mon–Sun) starting from weekStart.
 */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/**
 * Get the next week's Monday.
 */
export function getNextWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Get the previous week's Monday.
 */
export function getPrevWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() - 7);
  return d;
}

/**
 * Check if two dates are in the same week (same Monday).
 */
export function isSameWeek(a: Date, b: Date): boolean {
  const wa = getWeekStart(a);
  const wb = getWeekStart(b);
  return wa.getTime() === wb.getTime();
}

/**
 * Check if two dates are the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Snap a time to the nearest 30-minute slot (floor).
 */
export function snapToSlot(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(Math.floor(d.getMinutes() / 30) * 30, 0, 0);
  return d;
}

/**
 * Get month grid for mini calendar.
 * Returns rows of 7 days, filling in days from adjacent months.
 */
export function getMonthGrid(
  year: number,
  month: number
): { date: Date; isCurrentMonth: boolean }[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Day of week of the 1st (0=Sun, shift to Mon=0)
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const grid: { date: Date; isCurrentMonth: boolean }[][] = [];
  let current = new Date(firstDay);
  current.setDate(current.getDate() - startDow);

  // Build 6 rows max
  for (let row = 0; row < 6; row++) {
    const week: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let col = 0; col < 7; col++) {
      week.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
      });
      current.setDate(current.getDate() + 1);
    }
    grid.push(week);
    // Stop if we've passed the end of the month and completed the row
    if (current > lastDay && row >= 3) break;
  }

  return grid;
}

/**
 * Format a date as ISO date string (YYYY-MM-DD) for API queries.
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fixed color palette for group members. */
export const MEMBER_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
] as const;

/**
 * Get a stable color for a member based on their index in the members list.
 */
export function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

/**
 * A time span where 2+ members overlap. Includes count and whether ALL members are free.
 */
export interface AllFreeSpan {
  startTime: string; // ISO string
  endTime: string;   // ISO string
  dayLabel: string;  // e.g. "Wed Feb 12" (in user timezone)
  timeLabel: string; // e.g. "2:00 PM – 5:00 PM" (in user timezone)
  overlapCount: number;   // how many members are free in this span
  totalMembers: number;   // total group members
  isAllFree: boolean;     // true when overlapCount === totalMembers
  groupDayLabel?: string;  // e.g. "Wed Feb 12" (in group timezone, if different)
  groupTimeLabel?: string; // e.g. "5:00 PM – 8:00 PM" (in group timezone, if different)
}

/**
 * Compute contiguous spans where 2+ members overlap.
 * Each span tracks how many members are free and whether it's all members.
 * Spans are sorted: all-free first, then by overlap count descending.
 */
export function computeAllFreeSpans(
  blocks: { userId: string; startTime: string; endTime: string }[],
  memberIds: string[],
  weekStart: Date,
  userTimeZone?: string,
  groupTimeZone?: string
): AllFreeSpan[] {
  if (memberIds.length < 2) return [];

  const tz = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const totalMembers = memberIds.length;
  const memberSet = new Set(memberIds);
  const days = getWeekDaysInTz(weekStart, tz);
  const SLOTS = 48;
  const spans: AllFreeSpan[] = [];

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const day = days[dayIdx];

    // Build per-slot user sets for this day
    const slotUsers: Set<string>[] = Array.from({ length: SLOTS }, () => new Set());

    for (const block of blocks) {
      if (!memberSet.has(block.userId)) continue;
      const start = new Date(block.startTime);
      const end = new Date(block.endTime);

      // Check if block overlaps this day in user timezone
      if (!isSameDayInTz(start, day, tz)) {
        if (!isSameDayInTz(end, day, tz) && end.getTime() !== day.getTime()) continue;
      }

      const startSlot = isSameDayInTz(start, day, tz) ? getSlotInTz(start, tz) : 0;
      const endSlot = isSameDayInTz(end, day, tz) ? getSlotInTz(end, tz) : SLOTS;

      for (let s = startSlot; s < endSlot && s < SLOTS; s++) {
        slotUsers[s].add(block.userId);
      }
    }

    // Find contiguous runs where 2+ members overlap with the same count
    let spanStart = -1;
    let spanCount = 0;
    for (let s = 0; s <= SLOTS; s++) {
      const count = s < SLOTS ? slotUsers[s].size : 0;
      const overlapping = count >= 2;

      if (overlapping && spanStart === -1) {
        // Start new span
        spanStart = s;
        spanCount = count;
      } else if (overlapping && count !== spanCount) {
        // Count changed — close current span, start new one
        pushSpan(spans, weekStart, dayIdx, spanStart, s, spanCount, totalMembers, tz, groupTimeZone);
        spanStart = s;
        spanCount = count;
      } else if (!overlapping && spanStart !== -1) {
        // Span ended
        pushSpan(spans, weekStart, dayIdx, spanStart, s, spanCount, totalMembers, tz, groupTimeZone);
        spanStart = -1;
        spanCount = 0;
      }
    }
  }

  // Sort: all-free first, then by overlap count descending, then chronologically
  spans.sort((a, b) => {
    if (a.isAllFree !== b.isAllFree) return a.isAllFree ? -1 : 1;
    if (a.overlapCount !== b.overlapCount) return b.overlapCount - a.overlapCount;
    return a.startTime.localeCompare(b.startTime);
  });

  return spans;
}

function pushSpan(
  spans: AllFreeSpan[],
  weekStart: Date,
  dayIdx: number,
  startSlot: number,
  endSlot: number,
  count: number,
  totalMembers: number,
  tz: string,
  groupTimeZone?: string
) {
  const startDate = slotToUtcDate(weekStart, dayIdx, startSlot, tz);
  const endDate = slotToUtcDate(weekStart, dayIdx, endSlot, tz);

  const span: AllFreeSpan = {
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    dayLabel: formatDayInTz(startDate, tz),
    timeLabel: `${formatTimeInTz(startDate, tz)} – ${formatTimeInTz(endDate, tz)}`,
    overlapCount: count,
    totalMembers,
    isAllFree: count >= totalMembers,
  };

  if (groupTimeZone && groupTimeZone !== tz) {
    span.groupDayLabel = formatDayInTz(startDate, groupTimeZone);
    span.groupTimeLabel = `${formatTimeInTz(startDate, groupTimeZone)} – ${formatTimeInTz(endDate, groupTimeZone)}`;
  }

  spans.push(span);
}

function formatSlotTime(slot: number): string {
  const h = Math.floor(slot / 2);
  const m = (slot % 2) * 30;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:30 ${period}`;
}

/** Day labels for the weekly calendar header. */
export const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_LABELS_SINGLE = ["M", "T", "W", "T", "F", "S", "S"] as const;
