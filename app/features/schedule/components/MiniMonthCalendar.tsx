import { useState, useMemo } from "react";
import {
  getMonthGrid,
  DAY_LABELS_SINGLE,
} from "../utils/date-utils";
import {
  getWeekStartInTz,
  isSameWeekInTz,
  isSameDayInTz,
  getDatePartsInTz,
} from "../utils/tz-utils";

interface MiniMonthCalendarProps {
  currentWeekStart: Date;
  onWeekSelect: (weekStart: Date) => void;
  userTimezone: string;
}

export function MiniMonthCalendar({
  currentWeekStart,
  onWeekSelect,
  userTimezone,
}: MiniMonthCalendarProps) {
  const currentParts = useMemo(() => getDatePartsInTz(currentWeekStart, userTimezone), [currentWeekStart, userTimezone]);
  const [viewYear, setViewYear] = useState(currentParts.year);
  const [viewMonth, setViewMonth] = useState(currentParts.month - 1); // getMonthGrid uses 0-based

  const today = new Date();
  const grid = getMonthGrid(viewYear, viewMonth);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    onWeekSelect(getWeekStartInTz(date, userTimezone));
  };

  return (
    <div className="select-none">
      {/* Month/year header with arrows */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <span
          className="text-sm font-medium text-gray-900 dark:text-white"
          suppressHydrationWarning
        >
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS_SINGLE.map((label, i) => (
          <div
            key={i}
            className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="space-y-0.5">
        {grid.map((week, rowIdx) => {
          const weekIsSelected = isSameWeekInTz(week[0].date, currentWeekStart, userTimezone);
          return (
            <div
              key={rowIdx}
              className={`grid grid-cols-7 rounded ${
                weekIsSelected
                  ? "bg-blue-100 dark:bg-blue-900/30"
                  : ""
              }`}
            >
              {week.map((cell, colIdx) => {
                const isToday = isSameDayInTz(cell.date, today, userTimezone);
                return (
                  <button
                    key={colIdx}
                    onClick={() => handleDayClick(cell.date)}
                    className={`
                      h-7 w-full text-xs text-center rounded cursor-pointer
                      ${
                        cell.isCurrentMonth
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-400 dark:text-gray-600"
                      }
                      ${
                        isToday
                          ? "font-bold bg-blue-600 text-white hover:bg-blue-700"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700"
                      }
                    `}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
