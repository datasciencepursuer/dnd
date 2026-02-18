import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";

interface GroupSwitcherProps {
  currentGroupId: string | null;
  groups: { id: string; name: string }[];
}

export function GroupSwitcher({ currentGroupId, groups }: GroupSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentGroup = currentGroupId
    ? groups.find((g) => g.id === currentGroupId)
    : null;
  const buttonLabel = currentGroupId === null ? "Personal Maps" : (currentGroup?.name ?? "Switch Group");
  const hasDropdownItems = groups.length > 0 || currentGroupId !== null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => hasDropdownItems && setOpen(!open)}
        className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 cursor-pointer flex items-center gap-1"
      >
        <span className="truncate max-w-[120px]">{buttonLabel}</span>
        {hasDropdownItems && (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 sm:left-auto sm:right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[200px] max-w-[calc(100vw-2rem)]">
          <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Switch to
          </div>
          <Link
            to="/maps"
            onClick={() => setOpen(false)}
            className={`block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
              currentGroupId === null
                ? "text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30"
                : "text-gray-900 dark:text-white"
            }`}
          >
            Personal Maps
          </Link>
          {groups.length > 0 && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Groups
                </div>
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    to={`/g/${group.id}`}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      group.id === currentGroupId
                        ? "text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {group.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
