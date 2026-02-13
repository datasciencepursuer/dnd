import type { AllFreeSpan } from "../utils/date-utils";
import { getTimezoneAbbr } from "../utils/tz-utils";

export interface ScheduleVote {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
  vote: "local" | "virtual";
}

interface AllFreeSlotsProps {
  spans: AllFreeSpan[];
  votes: ScheduleVote[];
  currentUserId: string;
  onVote: (startTime: string, endTime: string, vote: "local" | "virtual") => void;
  isMobile: boolean;
  userTimezone: string;
  groupTimezone?: string;
}

export function AllFreeSlots({
  spans,
  votes,
  currentUserId,
  onVote,
  isMobile,
  userTimezone,
  groupTimezone,
}: AllFreeSlotsProps) {
  const showGroupTz = groupTimezone && groupTimezone !== userTimezone;
  const groupTzAbbr = showGroupTz ? getTimezoneAbbr(groupTimezone!) : null;
  if (spans.length === 0) return null;

  // Group votes by time range key
  const getKey = (start: string, end: string) => `${start}|${end}`;

  const voteCounts = new Map<
    string,
    { local: number; virtual: number; userVote: "local" | "virtual" | null }
  >();

  for (const span of spans) {
    const key = getKey(span.startTime, span.endTime);
    voteCounts.set(key, { local: 0, virtual: 0, userVote: null });
  }

  for (const v of votes) {
    const key = getKey(v.startTime, v.endTime);
    const entry = voteCounts.get(key);
    if (!entry) continue;
    if (v.vote === "local") entry.local++;
    else entry.virtual++;
    if (v.userId === currentUserId) entry.userVote = v.vote;
  }

  if (isMobile) {
    return (
      <div className="px-1 py-2">
        <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5 px-1">
          All Free
        </h3>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {spans.map((span) => {
            const key = getKey(span.startTime, span.endTime);
            const counts = voteCounts.get(key)!;
            return (
              <div
                key={key}
                className="flex-shrink-0 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2 min-w-[140px]"
              >
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300" suppressHydrationWarning>
                  {span.dayLabel}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400" suppressHydrationWarning>
                  {span.timeLabel}
                </div>
                {showGroupTz && span.groupTimeLabel && (
                  <div className="text-[9px] text-amber-500/70 dark:text-amber-400/60" suppressHydrationWarning>
                    {span.groupTimeLabel} ({groupTzAbbr})
                  </div>
                )}
                <div className="flex gap-1 mt-1.5">
                  <VoteButton
                    label="Local"
                    count={counts.local}
                    active={counts.userVote === "local"}
                    onClick={() => onVote(span.startTime, span.endTime, "local")}
                    compact
                  />
                  <VoteButton
                    label="Virtual"
                    count={counts.virtual}
                    active={counts.userVote === "virtual"}
                    onClick={() => onVote(span.startTime, span.endTime, "virtual")}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
        All Free
      </h3>
      {spans.map((span) => {
        const key = getKey(span.startTime, span.endTime);
        const counts = voteCounts.get(key)!;
        return (
          <div
            key={key}
            className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2.5"
          >
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300" suppressHydrationWarning>
              {span.dayLabel}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400" suppressHydrationWarning>
              {span.timeLabel}
            </div>
            {showGroupTz && span.groupTimeLabel && (
              <div className="text-[10px] text-amber-500/70 dark:text-amber-400/60" suppressHydrationWarning>
                {span.groupTimeLabel} ({groupTzAbbr})
              </div>
            )}
            <div className="mb-2" />
            <div className="flex gap-1.5">
              <VoteButton
                label="Local"
                count={counts.local}
                active={counts.userVote === "local"}
                onClick={() => onVote(span.startTime, span.endTime, "local")}
              />
              <VoteButton
                label="Virtual"
                count={counts.virtual}
                active={counts.userVote === "virtual"}
                onClick={() => onVote(span.startTime, span.endTime, "virtual")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VoteButton({
  label,
  count,
  active,
  onClick,
  compact,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const icon = label === "Local" ? (
    // Map pin icon
    <svg viewBox="0 0 20 20" className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="currentColor">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  ) : (
    // Monitor/screen icon
    <svg viewBox="0 0 20 20" className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="currentColor">
      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v4h8V6zM7 16a1 1 0 100-2 1 1 0 000 2zm6-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
    </svg>
  );

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
        active
          ? label === "Local"
            ? "bg-emerald-500 text-white"
            : "bg-blue-500 text-white"
          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      }`}
    >
      {icon}
      {!compact && <span>{label}</span>}
      {count > 0 && (
        <span
          className={`text-[10px] rounded-full px-1 min-w-[16px] text-center ${
            active
              ? "bg-white/20"
              : "bg-gray-100 dark:bg-gray-700"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
