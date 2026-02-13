interface Member {
  userId: string;
  userName: string;
}

interface MembersListProps {
  members: Member[];
  memberColors: Map<string, string>;
  visibleMembers: Set<string>;
  onToggleMember: (userId: string) => void;
  isMobile: boolean;
}

export function MembersList({
  members,
  memberColors,
  visibleMembers,
  onToggleMember,
  isMobile,
}: MembersListProps) {
  if (isMobile) {
    return (
      <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin">
        {members.map((member) => {
          const color = memberColors.get(member.userId) || "#888";
          const visible = visibleMembers.has(member.userId);
          return (
            <button
              key={member.userId}
              onClick={() => onToggleMember(member.userId)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer select-none border transition-opacity ${
                visible
                  ? "border-transparent"
                  : "border-gray-300 dark:border-gray-600 opacity-40"
              }`}
              style={{
                backgroundColor: visible ? color + "20" : undefined,
                color: visible ? color : undefined,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {member.userName}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        Members
      </h3>
      {members.map((member) => {
        const color = memberColors.get(member.userId) || "#888";
        const visible = visibleMembers.has(member.userId);
        return (
          <button
            key={member.userId}
            onClick={() => onToggleMember(member.userId)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm cursor-pointer select-none transition-opacity ${
              visible
                ? "hover:bg-gray-100 dark:hover:bg-gray-700"
                : "opacity-40 hover:opacity-60"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-900 dark:text-white truncate">
              {member.userName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
