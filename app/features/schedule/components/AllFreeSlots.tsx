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

  const allFreeSpans = spans.filter((s) => s.isAllFree);
  const popularSpans = spans.filter((s) => !s.isAllFree);

  if (isMobile) {
    return (
      <div className="px-1 py-2 space-y-3">
        {allFreeSpans.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                <path d="M10 1l8.66 5v8L10 19l-8.66-5V6L10 1zm0 2.31L3.93 7.1v5.8L10 16.69l6.07-3.79V7.1L10 3.31zM10 6l3.46 2v4L10 14l-3.46-2V8L10 6z" />
              </svg>
              All Free
            </h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
              {allFreeSpans.map((span) => (
                <SpanCard
                  key={getKey(span.startTime, span.endTime)}
                  span={span}
                  counts={voteCounts.get(getKey(span.startTime, span.endTime))!}
                  onVote={onVote}
                  showGroupTz={!!showGroupTz}
                  groupTzAbbr={groupTzAbbr}
                  compact
                />
              ))}
            </div>
          </div>
        )}
        {popularSpans.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 px-1">
              Popular Times
            </h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
              {popularSpans.map((span) => (
                <SpanCard
                  key={getKey(span.startTime, span.endTime)}
                  span={span}
                  counts={voteCounts.get(getKey(span.startTime, span.endTime))!}
                  onVote={onVote}
                  showGroupTz={!!showGroupTz}
                  groupTzAbbr={groupTzAbbr}
                  compact
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allFreeSpans.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M10 1l8.66 5v8L10 19l-8.66-5V6L10 1zm0 2.31L3.93 7.1v5.8L10 16.69l6.07-3.79V7.1L10 3.31zM10 6l3.46 2v4L10 14l-3.46-2V8L10 6z" />
            </svg>
            All Free
          </h3>
          {allFreeSpans.map((span) => (
            <SpanCard
              key={getKey(span.startTime, span.endTime)}
              span={span}
              counts={voteCounts.get(getKey(span.startTime, span.endTime))!}
              onVote={onVote}
              showGroupTz={!!showGroupTz}
              groupTzAbbr={groupTzAbbr}
            />
          ))}
        </div>
      )}
      {popularSpans.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
            Popular Times
          </h3>
          {popularSpans.map((span) => (
            <SpanCard
              key={getKey(span.startTime, span.endTime)}
              span={span}
              counts={voteCounts.get(getKey(span.startTime, span.endTime))!}
              onVote={onVote}
              showGroupTz={!!showGroupTz}
              groupTzAbbr={groupTzAbbr}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SpanCard({
  span,
  counts,
  onVote,
  showGroupTz,
  groupTzAbbr,
  compact,
}: {
  span: AllFreeSpan;
  counts: { local: number; virtual: number; userVote: "local" | "virtual" | null };
  onVote: (startTime: string, endTime: string, vote: "local" | "virtual") => void;
  showGroupTz: boolean;
  groupTzAbbr: string | null;
  compact?: boolean;
}) {
  const isAllFree = span.isAllFree;
  const total = span.totalMembers;
  const totalVotes = counts.local + counts.virtual;
  const allVoted = totalVotes === total;

  // All-free: amber/gold. Popular: blue/slate.
  const borderClass = isAllFree
    ? allVoted
      ? "border-emerald-400 dark:border-emerald-600"
      : "border-amber-300 dark:border-amber-700"
    : allVoted
      ? "border-emerald-400 dark:border-emerald-600"
      : "border-blue-200 dark:border-blue-800";
  const bgClass = isAllFree
    ? allVoted
      ? "bg-emerald-50 dark:bg-emerald-900/20"
      : "bg-amber-50 dark:bg-amber-900/20"
    : allVoted
      ? "bg-emerald-50 dark:bg-emerald-900/15"
      : "bg-blue-50 dark:bg-blue-900/15";
  const dayTextClass = isAllFree
    ? "text-amber-700 dark:text-amber-300"
    : "text-blue-700 dark:text-blue-300";
  const timeTextClass = isAllFree
    ? "text-amber-600 dark:text-amber-400"
    : "text-blue-600 dark:text-blue-400";
  const groupTzTextClass = isAllFree
    ? "text-amber-500/70 dark:text-amber-400/60"
    : "text-blue-500/70 dark:text-blue-400/60";

  const voteSummary = allVoted ? (
    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
      {totalVotes}/{total} voted
    </span>
  ) : totalVotes > 0 ? (
    <span className="text-gray-500 dark:text-gray-400">
      {totalVotes}/{total} voted
    </span>
  ) : null;

  if (compact) {
    return (
      <div className={`flex-shrink-0 rounded-lg border ${borderClass} ${bgClass} p-2 min-w-[140px]`}>
        <div className="flex items-center justify-between">
          <div className={`text-[11px] font-semibold ${dayTextClass}`} suppressHydrationWarning>
            {span.dayLabel}
          </div>
          {!isAllFree && (
            <span className={`text-[9px] font-medium ${timeTextClass} bg-white/60 dark:bg-gray-800/60 rounded px-1`}>
              {span.overlapCount}/{span.totalMembers}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className={`text-[10px] ${timeTextClass}`} suppressHydrationWarning>
            {span.timeLabel}
          </div>
          {voteSummary && (
            <span className="text-[9px]">{voteSummary}</span>
          )}
        </div>
        {showGroupTz && span.groupTimeLabel && (
          <div className={`text-[9px] ${groupTzTextClass}`} suppressHydrationWarning>
            {span.groupTimeLabel} ({groupTzAbbr})
          </div>
        )}
        <div className="flex gap-1 mt-1.5">
          <VoteButton
            label="Local"
            count={counts.local}
            total={total}
            active={counts.userVote === "local"}
            onClick={() => onVote(span.startTime, span.endTime, "local")}
            compact
          />
          <VoteButton
            label="Virtual"
            count={counts.virtual}
            total={total}
            active={counts.userVote === "virtual"}
            onClick={() => onVote(span.startTime, span.endTime, "virtual")}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${borderClass} ${bgClass} p-2.5`}>
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${dayTextClass}`} suppressHydrationWarning>
          {span.dayLabel}
        </div>
        <div className="flex items-center gap-1.5">
          {!isAllFree && (
            <span className={`text-[10px] font-medium ${timeTextClass} bg-white/60 dark:bg-gray-800/60 rounded px-1.5 py-0.5`}>
              {span.overlapCount} of {span.totalMembers} free
            </span>
          )}
          {voteSummary && (
            <span className="text-[10px]">{voteSummary}</span>
          )}
        </div>
      </div>
      <div className={`text-[11px] ${timeTextClass}`} suppressHydrationWarning>
        {span.timeLabel}
      </div>
      {showGroupTz && span.groupTimeLabel && (
        <div className={`text-[10px] ${groupTzTextClass}`} suppressHydrationWarning>
          {span.groupTimeLabel} ({groupTzAbbr})
        </div>
      )}
      <div className="flex gap-1.5 mt-2">
        <VoteButton
          label="Local"
          count={counts.local}
          total={total}
          active={counts.userVote === "local"}
          onClick={() => onVote(span.startTime, span.endTime, "local")}
        />
        <VoteButton
          label="Virtual"
          count={counts.virtual}
          total={total}
          active={counts.userVote === "virtual"}
          onClick={() => onVote(span.startTime, span.endTime, "virtual")}
        />
      </div>
    </div>
  );
}

function VoteButton({
  label,
  count,
  total,
  active,
  onClick,
  compact,
}: {
  label: string;
  count: number;
  total: number;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const icon = label === "Local" ? (
    <svg viewBox="0 0 20 20" className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="currentColor">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  ) : (
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
          {count}/{total}
        </span>
      )}
    </button>
  );
}
