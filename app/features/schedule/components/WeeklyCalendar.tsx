import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { DAY_LABELS_SHORT, DAY_LABELS_SINGLE } from "../utils/date-utils";
import {
  getWeekDaysInTz,
  isSameDayInTz,
  getSlotInTz,
  slotToUtcDate,
  getDatePartsInTz,
} from "../utils/tz-utils";

export interface AvailabilityBlock {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
}

interface WeeklyCalendarProps {
  weekStart: Date;
  blocks: AvailabilityBlock[];
  currentUserId: string;
  memberColors: Map<string, string>;
  visibleMembers: Set<string>;
  groupId: string;
  onBlocksChange: () => void;
  isMobile: boolean;
  totalMembers: number;
  userTimezone: string;
}

const SLOT_HEIGHT = 28; // px per 30-min slot
const TOTAL_SLOTS = 48; // 24h * 2
const GUTTER_WIDTH_DESKTOP = 52;
const GUTTER_WIDTH_MOBILE = 28;
const HEADER_HEIGHT = 40; // px for day headers
const BODY_PAD_TOP = 10; // px top padding in gutter/day columns (Tailwind pt-2.5)
const DEFAULT_SCROLL_HOUR = 8; // scroll to 8 AM on mount
const TOUCH_HOLD_MS = 300; // ms hold before drag starts
const TOUCH_MOVE_THRESHOLD = 8; // px movement allowed during hold

export function WeeklyCalendar({
  weekStart,
  blocks,
  currentUserId,
  memberColors,
  visibleMembers,
  groupId,
  onBlocksChange,
  isMobile,
  totalMembers,
  userTimezone,
}: WeeklyCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    dayIndex: number;
    startSlot: number;
    currentSlot: number;
    previewEl: HTMLDivElement | null;
  }>({ active: false, dayIndex: -1, startSlot: -1, currentSlot: -1, previewEl: null });
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  // When drag is active, we lock every scrollable ancestor so nothing moves.
  const scrollLockCleanup = useRef<(() => void) | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const gutterWidth = isMobile ? GUTTER_WIDTH_MOBILE : GUTTER_WIDTH_DESKTOP;
  const days = useMemo(() => getWeekDaysInTz(weekStart, userTimezone), [weekStart, userTimezone]);
  const today = new Date();

  // Compute the "past" boundary using timezone-aware logic.
  const nowParts = useMemo(() => getDatePartsInTz(today, userTimezone), [today, userTimezone]);

  const isPastDay = useCallback(
    (dayIndex: number): boolean => {
      const day = days[dayIndex];
      if (!day) return false;
      const dayParts = getDatePartsInTz(day, userTimezone);
      // Compare calendar dates in user timezone
      if (dayParts.year < nowParts.year) return true;
      if (dayParts.year > nowParts.year) return false;
      if (dayParts.month < nowParts.month) return true;
      if (dayParts.month > nowParts.month) return false;
      return dayParts.day < nowParts.day;
    },
    [days, nowParts, userTimezone]
  );

  const isSlotInPast = useCallback(
    (dayIndex: number, slot: number): boolean => {
      const day = days[dayIndex];
      if (!day) return false;
      const dayParts = getDatePartsInTz(day, userTimezone);
      // Day before today -> all slots past
      if (dayParts.year < nowParts.year) return true;
      if (dayParts.year === nowParts.year && dayParts.month < nowParts.month) return true;
      if (dayParts.year === nowParts.year && dayParts.month === nowParts.month && dayParts.day < nowParts.day) return true;
      // Day after today -> no slots past
      if (dayParts.year > nowParts.year) return false;
      if (dayParts.month > nowParts.month) return false;
      if (dayParts.day > nowParts.day) return false;
      // Same day: slot's end must be <= now
      const slotEndHour = Math.floor((slot + 1) / 2);
      const slotEndMin = ((slot + 1) % 2) * 30;
      const nowMinutes = nowParts.hour * 60 + nowParts.minute;
      const slotEndMinutes = slotEndHour * 60 + slotEndMin;
      return slotEndMinutes <= nowMinutes;
    },
    [days, nowParts, userTimezone]
  );

  /**
   * Lock the calendar container's scroll position while drag is active.
   * The browser may have already started a scroll gesture before our hold
   * timer fires, so we forcefully snap scrollTop back on every scroll event.
   */
  const lockScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const savedScroll = container.scrollTop;

    const onScroll = () => {
      container.scrollTop = savedScroll;
    };
    container.addEventListener("scroll", onScroll);

    scrollLockCleanup.current = () => {
      container.removeEventListener("scroll", onScroll);
      scrollLockCleanup.current = null;
    };
  }, []);

  const unlockScroll = useCallback(() => {
    scrollLockCleanup.current?.();
  }, []);

  // Scroll to 8 AM on mount or week change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = DEFAULT_SCROLL_HOUR * 2 * SLOT_HEIGHT;
    }
  }, [weekStart]);

  // Clear selection when week changes
  useEffect(() => {
    setSelectedBlockId(null);
  }, [weekStart]);

  const getSlotFromY = useCallback((clientY: number): number => {
    if (!gridRef.current) return -1;
    const rect = gridRef.current.getBoundingClientRect();
    // rect.top already reflects scroll position (it's the visual position),
    // so clientY - rect.top gives the absolute position within the grid.
    const y = clientY - rect.top - HEADER_HEIGHT - BODY_PAD_TOP;
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)));
  }, []);

  const getDayFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return -1;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left - gutterWidth;
    if (x < 0) return -1;
    const dayWidth = (rect.width - gutterWidth) / 7;
    return Math.max(0, Math.min(6, Math.floor(x / dayWidth)));
  }, [gutterWidth]);

  const createPreviewEl = useCallback(() => {
    const el = document.createElement("div");
    el.className = "absolute rounded pointer-events-none z-10 border-2 border-blue-500";
    el.style.backgroundColor = "rgba(59, 130, 246, 0.3)";
    el.style.left = "0";
    el.style.right = "0";
    return el;
  }, []);

  const updatePreview = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active || !drag.previewEl) return;
    const minSlot = Math.min(drag.startSlot, drag.currentSlot);
    const maxSlot = Math.max(drag.startSlot, drag.currentSlot);
    drag.previewEl.style.top = `${minSlot * SLOT_HEIGHT + BODY_PAD_TOP}px`;
    drag.previewEl.style.height = `${(maxSlot - minSlot + 1) * SLOT_HEIGHT}px`;
  }, []);

  const finalizeDrag = useCallback(async () => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;

    if (drag.previewEl?.parentNode) {
      drag.previewEl.parentNode.removeChild(drag.previewEl);
    }
    drag.previewEl = null;

    const minSlot = Math.min(drag.startSlot, drag.currentSlot);
    const maxSlot = Math.max(drag.startSlot, drag.currentSlot);

    // Convert day+slot to UTC using timezone-aware function
    const startTime = slotToUtcDate(weekStart, drag.dayIndex, minSlot, userTimezone);
    const endTime = slotToUtcDate(weekStart, drag.dayIndex, maxSlot + 1, userTimezone);

    // Don't create availability that's entirely in the past
    if (endTime <= new Date()) return;

    // Server handles merge of overlapping blocks — single POST is enough
    try {
      const res = await fetch(`/api/groups/${groupId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });
      if (res.ok) {
        onBlocksChange();
      }
    } catch {
      // silently fail
    }
  }, [weekStart, groupId, onBlocksChange, userTimezone]);

  // Mouse handlers for desktop drag-to-create
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left click on grid area
      if (e.button !== 0) return;
      const dayIndex = getDayFromX(e.clientX);
      const slot = getSlotFromY(e.clientY);
      if (dayIndex < 0 || slot < 0) return;

      // Don't allow creating availability in the past
      if (isSlotInPast(dayIndex, slot)) return;

      // Check if clicking on an existing block (let that click through)
      const target = e.target as HTMLElement;
      if (target.closest("[data-block-id]")) return;

      setSelectedBlockId(null);

      const dayColumns = gridRef.current?.querySelectorAll("[data-day-column]");
      if (!dayColumns?.[dayIndex]) return;

      const previewEl = createPreviewEl();
      dayColumns[dayIndex].appendChild(previewEl);

      dragRef.current = {
        active: true,
        dayIndex,
        startSlot: slot,
        currentSlot: slot,
        previewEl,
      };
      updatePreview();
    },
    [getDayFromX, getSlotFromY, createPreviewEl, updatePreview, isSlotInPast]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current.active) return;
      const slot = getSlotFromY(e.clientY);
      if (slot >= 0 && slot !== dragRef.current.currentSlot) {
        dragRef.current.currentSlot = slot;
        updatePreview();
      }
    },
    [getSlotFromY, updatePreview]
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.active) {
      finalizeDrag();
    }
  }, [finalizeDrag]);

  // Touch handlers for mobile
  // Strategy: finger down starts a hold timer. If the finger moves more than
  // TOUCH_MOVE_THRESHOLD before the timer fires, we cancel (let the browser scroll).
  // Once the timer fires we enter drag mode and suppress scrolling.
  //
  // IMPORTANT: touchmove and touchend are attached as native listeners with
  // { passive: false } via useEffect. React's onTouchMove is passive by default,
  // which means preventDefault() is silently ignored and the browser scrolls anyway.
  const cancelTouchHold = useCallback(() => {
    if (touchHoldTimer.current) {
      clearTimeout(touchHoldTimer.current);
      touchHoldTimer.current = null;
    }
    touchOrigin.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const target = touch.target as HTMLElement;
      if (target.closest("[data-block-id]")) return;

      const dayIndex = getDayFromX(touch.clientX);
      const slot = getSlotFromY(touch.clientY);
      if (dayIndex < 0 || slot < 0) return;

      // Don't allow creating availability in the past
      if (isSlotInPast(dayIndex, slot)) return;

      // Record finger origin for movement threshold check
      touchOrigin.current = { x: touch.clientX, y: touch.clientY };

      touchHoldTimer.current = setTimeout(() => {
        touchHoldTimer.current = null;
        setSelectedBlockId(null);

        const dayColumns = gridRef.current?.querySelectorAll("[data-day-column]");
        if (!dayColumns?.[dayIndex]) return;

        const previewEl = createPreviewEl();
        dayColumns[dayIndex].appendChild(previewEl);

        dragRef.current = {
          active: true,
          dayIndex,
          startSlot: slot,
          currentSlot: slot,
          previewEl,
        };
        updatePreview();

        // Freeze everything — container, body, html
        lockScroll();
      }, TOUCH_HOLD_MS);
    },
    [getDayFromX, getSlotFromY, createPreviewEl, updatePreview, lockScroll, isSlotInPast]
  );

  // Native touchmove / touchend — must be { passive: false } so preventDefault works
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];

      if (!dragRef.current.active) {
        // Hold timer still pending — check if finger moved too far
        if (touchOrigin.current && touchHoldTimer.current) {
          const dx = touch.clientX - touchOrigin.current.x;
          const dy = touch.clientY - touchOrigin.current.y;
          if (Math.abs(dx) > TOUCH_MOVE_THRESHOLD || Math.abs(dy) > TOUCH_MOVE_THRESHOLD) {
            cancelTouchHold(); // finger swiped — let browser scroll
          }
        }
        return;
      }

      // In drag mode — kill the scroll
      e.preventDefault();
      e.stopPropagation();

      const slot = getSlotFromY(touch.clientY);
      if (slot >= 0 && slot !== dragRef.current.currentSlot) {
        dragRef.current.currentSlot = slot;
        updatePreview();
      }
    };

    const onTouchEnd = () => {
      cancelTouchHold();
      if (dragRef.current.active) {
        unlockScroll();
        finalizeDrag();
      }
    };

    grid.addEventListener("touchmove", onTouchMove, { passive: false });
    grid.addEventListener("touchend", onTouchEnd);
    grid.addEventListener("touchcancel", onTouchEnd);

    return () => {
      grid.removeEventListener("touchmove", onTouchMove);
      grid.removeEventListener("touchend", onTouchEnd);
      grid.removeEventListener("touchcancel", onTouchEnd);
      unlockScroll(); // clean up if unmounted mid-drag
    };
  }, [getSlotFromY, updatePreview, cancelTouchHold, finalizeDrag, unlockScroll]);

  // Delete handler
  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      try {
        const res = await fetch(
          `/api/groups/${groupId}/availability/${blockId}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setSelectedBlockId(null);
          onBlocksChange();
        }
      } catch {
        // silently fail
      }
    },
    [groupId, onBlocksChange]
  );

  // Keyboard delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBlockId) {
        const block = blocks.find((b) => b.id === selectedBlockId);
        if (block && block.userId === currentUserId) {
          handleDeleteBlock(selectedBlockId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBlockId, blocks, currentUserId, handleDeleteBlock]);

  // Render blocks for a specific day column
  const renderBlocks = (dayIndex: number) => {
    const day = days[dayIndex];
    const dayBlocks = blocks.filter((b) => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      // Block is on this day if start OR end falls on the day in user timezone
      return (isSameDayInTz(start, day, userTimezone) || isSameDayInTz(end, day, userTimezone)) && visibleMembers.has(b.userId);
    });

    return dayBlocks.map((block) => {
      const start = new Date(block.startTime);
      const end = new Date(block.endTime);
      const startSlot = isSameDayInTz(start, day, userTimezone) ? getSlotInTz(start, userTimezone) : 0;
      const endSlot = isSameDayInTz(end, day, userTimezone) ? getSlotInTz(end, userTimezone) : TOTAL_SLOTS;

      // Skip if block has no visible slots on this day (e.g., end time is exactly midnight)
      if (endSlot <= startSlot) return null;
      const slots = endSlot - startSlot;

      const color = memberColors.get(block.userId) || "#888";
      const isOwn = block.userId === currentUserId;
      const isSelected = selectedBlockId === block.id;

      return (
        <div
          key={block.id}
          data-block-id={block.id}
          onClick={(e) => {
            e.stopPropagation();
            if (isOwn) {
              setSelectedBlockId(isSelected ? null : block.id);
            }
          }}
          className={`absolute left-0 right-0 rounded text-xs overflow-hidden ${
            isOwn ? "cursor-pointer" : "pointer-events-none"
          }`}
          style={{
            top: `${startSlot * SLOT_HEIGHT + BODY_PAD_TOP}px`,
            height: `${slots * SLOT_HEIGHT}px`,
            backgroundColor: color,
            opacity: isOwn ? 0.7 : 0.3,
            border: isSelected ? "2px solid white" : "1px solid rgba(255,255,255,0.3)",
            boxShadow: isSelected ? `0 0 0 1px ${color}` : undefined,
            zIndex: isSelected ? 20 : isOwn ? 10 : 5,
          }}
        >
          {!isMobile && (
            <div className="px-1 py-0.5 truncate text-white font-medium">
              {block.userName}
            </div>
          )}
          {/* Delete button for selected own block */}
          {isSelected && isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteBlock(block.id);
              }}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs hover:bg-red-700 cursor-pointer"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      );
    });
  };

  // Compute per-slot overlap counts: overlapCounts[dayIndex][slot] = number of unique users
  // Only counts visible members so toggling a member hides their contribution.
  const overlapCounts = useMemo(() => {
    // Build sets first: sets[day][slot] = Set<userId>
    const sets: Set<string>[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: TOTAL_SLOTS }, () => new Set<string>())
    );

    for (const block of blocks) {
      if (!visibleMembers.has(block.userId)) continue;

      const start = new Date(block.startTime);
      const end = new Date(block.endTime);

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const day = days[dayIdx];
        if (!isSameDayInTz(start, day, userTimezone) && !isSameDayInTz(end, day, userTimezone)) continue;

        const startSlot = isSameDayInTz(start, day, userTimezone) ? getSlotInTz(start, userTimezone) : 0;
        const endSlot = isSameDayInTz(end, day, userTimezone) ? getSlotInTz(end, userTimezone) : TOTAL_SLOTS;

        for (let s = startSlot; s < endSlot && s < TOTAL_SLOTS; s++) {
          sets[dayIdx][s].add(block.userId);
        }
      }
    }

    // Flatten to counts
    return sets.map((day) => day.map((s) => s.size));
  }, [blocks, visibleMembers, days, userTimezone]);

  // Render overlap indicators for a day column
  const renderOverlaps = (dayIndex: number) => {
    const counts = overlapCounts[dayIndex];
    const spans: { startSlot: number; endSlot: number; count: number; allFree: boolean }[] = [];

    let i = 0;
    while (i < TOTAL_SLOTS) {
      const count = counts[i];
      if (count >= 2) {
        const allFree = count >= totalMembers && totalMembers >= 2;
        const start = i;
        while (i < TOTAL_SLOTS && counts[i] === count) i++;
        spans.push({ startSlot: start, endSlot: i, count, allFree });
      } else {
        i++;
      }
    }

    return spans.map((span) => (
      <div
        key={`overlap-${span.startSlot}`}
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-[15]"
        style={{
          top: `${span.startSlot * SLOT_HEIGHT + BODY_PAD_TOP}px`,
          height: `${(span.endSlot - span.startSlot) * SLOT_HEIGHT}px`,
        }}
      >
        <div
          className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${
            span.allFree
              ? "bg-amber-500 text-white"
              : "bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
          }`}
        >
          {span.allFree ? (
            <>
              {/* D20 dice icon */}
              <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current" aria-hidden="true">
                <path d="M10 1l8.66 5v8L10 19l-8.66-5V6L10 1zm0 2.31L3.93 7.1v5.8L10 16.69l6.07-3.79V7.1L10 3.31zM10 6l3.46 2v4L10 14l-3.46-2V8L10 6z" />
              </svg>
              <span>{isMobile ? "All" : "All free"}</span>
            </>
          ) : (
            <span>{span.count}</span>
          )}
        </div>
      </div>
    ));
  };

  // Hour labels
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      ref={containerRef}
      className="overflow-auto flex-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
      style={{ maxHeight: "calc(100vh - 180px)" }}
    >
      <div
        ref={gridRef}
        className="relative select-none"
        style={{
          display: "grid",
          gridTemplateColumns: `${gutterWidth}px repeat(7, 1fr)`,
          ...(!isMobile && { minWidth: "600px" }),
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
      >
        {/* Sticky header row */}
        <div
          className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: `${gutterWidth}px repeat(7, 1fr)`,
            height: `${HEADER_HEIGHT}px`,
          }}
        >
          {/* Empty corner */}
          <div className="border-r border-gray-200 dark:border-gray-700" />
          {/* Day headers */}
          {days.map((day, i) => {
            const isToday = isSameDayInTz(day, today, userTimezone);
            const dayPast = isPastDay(i);
            return (
              <div
                key={i}
                className={`flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                  isToday ? "bg-blue-50 dark:bg-blue-900/20" : ""
                } ${dayPast ? "opacity-50" : ""}`}
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isMobile ? DAY_LABELS_SINGLE[i] : DAY_LABELS_SHORT[i]}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-white"
                  }`}
                  suppressHydrationWarning
                >
                  {getDatePartsInTz(day, userTimezone).day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time gutter */}
        <div
          className="border-r border-gray-200 dark:border-gray-700 pt-2.5"
          style={{ gridRow: "2", gridColumn: "1" }}
        >
          {hours.map((h) => (
            <div
              key={h}
              className="relative"
              style={{ height: `${SLOT_HEIGHT * 2}px` }}
            >
              <span
                className={`absolute -top-2.5 text-gray-400 dark:text-gray-500 ${
                  isMobile ? "right-0.5 text-[10px]" : "right-2 text-xs"
                }`}
                suppressHydrationWarning
              >
                {isMobile
                  ? (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`)
                  : (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, dayIndex) => {
          const isToday = isSameDayInTz(day, today, userTimezone);
          const dayFullyPast = isPastDay(dayIndex);
          // For today, compute which slot the current time falls in (in user timezone)
          const nowSlot = isToday
            ? nowParts.hour * 2 + (nowParts.minute >= 30 ? 1 : 0)
            : 0;
          const pastSlotCount = dayFullyPast ? TOTAL_SLOTS : isToday ? nowSlot : 0;
          return (
            <div
              key={dayIndex}
              data-day-column
              className={`relative border-r border-gray-200 dark:border-gray-700 last:border-r-0 pt-2.5 ${
                isToday ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
              }`}
              style={{ gridRow: "2", gridColumn: dayIndex + 2 }}
            >
              {/* Slot grid lines */}
              {hours.map((h) => (
                <div key={h}>
                  <div
                    className="border-b border-gray-200 dark:border-gray-700"
                    style={{ height: `${SLOT_HEIGHT}px` }}
                  />
                  <div
                    className="border-b border-gray-100 dark:border-gray-750"
                    style={{ height: `${SLOT_HEIGHT}px`, borderStyle: "dashed" }}
                  />
                </div>
              ))}
              {/* Past-time overlay */}
              {pastSlotCount > 0 && (
                <div
                  className="absolute left-0 right-0 bg-gray-200/40 dark:bg-gray-700/40 pointer-events-none z-[2]"
                  style={{
                    top: `${BODY_PAD_TOP}px`,
                    height: `${pastSlotCount * SLOT_HEIGHT}px`,
                  }}
                />
              )}
              {/* Availability blocks */}
              {renderBlocks(dayIndex)}
              {/* Overlap indicators */}
              {renderOverlaps(dayIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
