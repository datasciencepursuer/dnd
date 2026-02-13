import type { Route } from "./+types/g.$groupId.schedule";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { useIsMobile } from "~/features/map-editor/hooks/useIsMobile";
import { MiniMonthCalendar } from "~/features/schedule/components/MiniMonthCalendar";
import { MembersList } from "~/features/schedule/components/MembersList";
import {
  WeeklyCalendar,
  type AvailabilityBlock,
} from "~/features/schedule/components/WeeklyCalendar";
import {
  AllFreeSlots,
  type ScheduleVote,
} from "~/features/schedule/components/AllFreeSlots";
import {
  getWeekStart,
  getNextWeek,
  getPrevWeek,
  getMemberColor,
  toISODate,
  computeAllFreeSpans,
} from "~/features/schedule/utils/date-utils";
import { useScheduleSync } from "~/features/schedule/hooks/useScheduleSync";

interface Member {
  userId: string;
  userName: string;
}

interface LoaderData {
  groupId: string;
  groupName: string;
  members: Member[];
  availabilities: AvailabilityBlock[];
  votes: ScheduleVote[];
  currentUserId: string;
  initialWeek: string;
}

export function meta({ data }: Route.MetaArgs) {
  const loaderData = data as LoaderData | undefined;
  return [
    {
      title: loaderData?.groupName
        ? `Schedule - ${loaderData.groupName}`
        : "Schedule",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, and, gte, lte } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const {
    groups,
    groupMembers,
    groupAvailabilities,
    groupScheduleVotes,
    user,
  } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");
  const { requireGroupPermission } = await import(
    "~/.server/permissions/group-permissions"
  );

  const session = await requireAuth(request);
  const userId = session.user.id;
  const { groupId } = params;

  await requireGroupPermission(groupId, userId, "view");

  // Get group name
  const groupData = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupData.length === 0) {
    throw new Response("Group not found", { status: 404 });
  }

  // Get members
  const membersData = await db
    .select({
      userId: groupMembers.userId,
      userName: user.name,
    })
    .from(groupMembers)
    .innerJoin(user, eq(groupMembers.userId, user.id))
    .where(eq(groupMembers.groupId, groupId));

  // Parse week from search params
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  let weekStart: Date;
  if (weekParam) {
    weekStart = new Date(weekParam + "T00:00:00");
    if (isNaN(weekStart.getTime())) {
      weekStart = getWeekStart(new Date());
    }
  } else {
    weekStart = getWeekStart(new Date());
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Fetch availability blocks and votes in parallel
  const [blocks, votes] = await Promise.all([
    db
      .select({
        id: groupAvailabilities.id,
        userId: groupAvailabilities.userId,
        userName: user.name,
        startTime: groupAvailabilities.startTime,
        endTime: groupAvailabilities.endTime,
      })
      .from(groupAvailabilities)
      .innerJoin(user, eq(groupAvailabilities.userId, user.id))
      .where(
        and(
          eq(groupAvailabilities.groupId, groupId),
          gte(groupAvailabilities.startTime, weekStart),
          lte(groupAvailabilities.endTime, weekEnd)
        )
      ),
    db
      .select({
        id: groupScheduleVotes.id,
        userId: groupScheduleVotes.userId,
        userName: user.name,
        startTime: groupScheduleVotes.startTime,
        endTime: groupScheduleVotes.endTime,
        vote: groupScheduleVotes.vote,
      })
      .from(groupScheduleVotes)
      .innerJoin(user, eq(groupScheduleVotes.userId, user.id))
      .where(
        and(
          eq(groupScheduleVotes.groupId, groupId),
          gte(groupScheduleVotes.startTime, weekStart),
          lte(groupScheduleVotes.endTime, weekEnd)
        )
      ),
  ]);

  return {
    groupId,
    groupName: groupData[0].name,
    members: membersData,
    availabilities: blocks.map((b) => ({
      id: b.id,
      userId: b.userId,
      userName: b.userName,
      startTime: b.startTime.toISOString(),
      endTime: b.endTime.toISOString(),
    })),
    votes: votes.map((v) => ({
      id: v.id,
      userId: v.userId,
      userName: v.userName,
      startTime: v.startTime.toISOString(),
      endTime: v.endTime.toISOString(),
      vote: v.vote as "local" | "virtual",
    })),
    currentUserId: userId,
    initialWeek: toISODate(weekStart),
  };
}

export default function GroupSchedule() {
  const {
    groupId,
    groupName,
    members,
    availabilities: initialAvailabilities,
    votes: initialVotes,
    currentUserId,
    initialWeek,
  } = useLoaderData<LoaderData>();

  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Current week state
  const [weekStart, setWeekStart] = useState(() => {
    const wp = searchParams.get("week") || initialWeek;
    return new Date(wp + "T00:00:00");
  });

  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(initialAvailabilities);
  const [votes, setVotes] = useState<ScheduleVote[]>(initialVotes);
  const [visibleMembers, setVisibleMembers] = useState<Set<string>>(
    () => new Set(members.map((m) => m.userId))
  );

  // Ref tracks current week for stable WebSocket callback
  const weekStartRef = useRef(weekStart);
  useEffect(() => {
    weekStartRef.current = weekStart;
  }, [weekStart]);

  // Member color map (stable by member order)
  const memberColors = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m, i) => map.set(m.userId, getMemberColor(i)));
    return map;
  }, [members]);

  // Compute all-free spans from current blocks
  const allFreeSpans = useMemo(
    () =>
      computeAllFreeSpans(
        blocks,
        members.map((m) => m.userId),
        weekStart
      ),
    [blocks, members, weekStart]
  );

  // Fetch blocks for a given week
  const fetchBlocks = useCallback(
    async (week: Date) => {
      try {
        const res = await fetch(
          `/api/groups/${groupId}/availability?week=${toISODate(week)}`
        );
        if (res.ok) {
          const data = await res.json();
          setBlocks(data.availabilities);
        }
      } catch {
        // silently fail
      }
    },
    [groupId]
  );

  // Fetch votes for a given week
  const fetchVotes = useCallback(
    async (week: Date) => {
      try {
        const res = await fetch(
          `/api/groups/${groupId}/schedule-votes?week=${toISODate(week)}`
        );
        if (res.ok) {
          const data = await res.json();
          setVotes(data.votes);
        }
      } catch {
        // silently fail
      }
    },
    [groupId]
  );

  // WebSocket: broadcast updates and listen for remote changes
  const onRemoteAvailabilityUpdate = useCallback(() => {
    fetchBlocks(weekStartRef.current);
  }, [fetchBlocks]);

  const onRemoteVoteUpdate = useCallback(() => {
    fetchVotes(weekStartRef.current);
  }, [fetchVotes]);

  const { broadcastAvailabilityUpdate, broadcastVoteUpdate } = useScheduleSync({
    groupId,
    userId: currentUserId,
    onRemoteAvailabilityUpdate,
    onRemoteVoteUpdate,
  });

  // Navigate to a different week
  const navigateWeek = useCallback(
    (newWeek: Date) => {
      setWeekStart(newWeek);
      const weekStr = toISODate(newWeek);
      setSearchParams({ week: weekStr }, { replace: true });
      fetchBlocks(newWeek);
      fetchVotes(newWeek);
    },
    [setSearchParams, fetchBlocks, fetchVotes]
  );

  const handlePrevWeek = () => navigateWeek(getPrevWeek(weekStart));
  const handleNextWeek = () => navigateWeek(getNextWeek(weekStart));
  const handleWeekSelect = (ws: Date) => navigateWeek(ws);

  const handleBlocksChange = useCallback(() => {
    fetchBlocks(weekStart);
    broadcastAvailabilityUpdate();
  }, [fetchBlocks, weekStart, broadcastAvailabilityUpdate]);

  const handleVote = useCallback(
    async (startTime: string, endTime: string, vote: "local" | "virtual") => {
      try {
        const res = await fetch(`/api/groups/${groupId}/schedule-votes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime, endTime, vote }),
        });
        if (res.ok) {
          fetchVotes(weekStart);
          broadcastVoteUpdate();
        }
      } catch {
        // silently fail
      }
    },
    [groupId, weekStart, fetchVotes, broadcastVoteUpdate]
  );

  const toggleMember = (userId: string) => {
    setVisibleMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Week label
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="min-h-screen max-lg:h-full max-lg:overflow-hidden bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-3">
          <Link
            to={`/g/${groupId}`}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {groupName}
            </h1>
          </div>
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer"
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
              className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
              suppressHydrationWarning
            >
              {weekLabel}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer"
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
        </div>
      </div>

      {/* Main content */}
      {isMobile ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Mini calendar (collapsed on mobile) */}
          <div className="px-4 pt-3 pb-1">
            <MiniMonthCalendar
              currentWeekStart={weekStart}
              onWeekSelect={handleWeekSelect}
            />
          </div>
          {/* Members horizontal chips */}
          <div className="px-3">
            <MembersList
              members={members}
              memberColors={memberColors}
              visibleMembers={visibleMembers}
              onToggleMember={toggleMember}
              isMobile
            />
          </div>
          {/* All free slots */}
          {allFreeSpans.length > 0 && (
            <div className="px-3 flex-shrink-0">
              <AllFreeSlots
                spans={allFreeSpans}
                votes={votes}
                currentUserId={currentUserId}
                onVote={handleVote}
                isMobile
              />
            </div>
          )}
          {/* Calendar */}
          <div className="flex-1 min-h-0 px-2 pb-2">
            <WeeklyCalendar
              weekStart={weekStart}
              blocks={blocks}
              currentUserId={currentUserId}
              memberColors={memberColors}
              visibleMembers={visibleMembers}
              groupId={groupId}
              onBlocksChange={handleBlocksChange}
              isMobile
              totalMembers={members.length}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden max-w-screen-2xl mx-auto w-full">
          {/* Sidebar */}
          <div
            className="w-[260px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-6 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          >
            <MiniMonthCalendar
              currentWeekStart={weekStart}
              onWeekSelect={handleWeekSelect}
            />
            <MembersList
              members={members}
              memberColors={memberColors}
              visibleMembers={visibleMembers}
              onToggleMember={toggleMember}
              isMobile={false}
            />
            {allFreeSpans.length > 0 && (
              <AllFreeSlots
                spans={allFreeSpans}
                votes={votes}
                currentUserId={currentUserId}
                onVote={handleVote}
                isMobile={false}
              />
            )}
          </div>
          {/* Calendar area */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <WeeklyCalendar
              weekStart={weekStart}
              blocks={blocks}
              currentUserId={currentUserId}
              memberColors={memberColors}
              visibleMembers={visibleMembers}
              groupId={groupId}
              onBlocksChange={handleBlocksChange}
              isMobile={false}
              totalMembers={members.length}
            />
          </div>
        </div>
      )}
    </div>
  );
}
