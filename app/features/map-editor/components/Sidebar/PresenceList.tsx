import { usePresenceStore } from "../../store/presence-store";

interface PresenceListProps {
  mapId: string | undefined;
}

export function PresenceList({ mapId }: PresenceListProps) {
  // Presence is now handled by usePartySync in MapEditor
  // This component just displays the presence store data

  const users = usePresenceStore((s) => s.users);
  const isConnected = usePresenceStore((s) => s.isConnected);
  const error = usePresenceStore((s) => s.error);

  if (!mapId) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Players Online
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {users.length}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          {error}
        </p>
      )}

      {/* User list */}
      <div className="space-y-1.5">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            {/* Avatar or initial */}
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Name */}
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
              {user.name}
            </span>

            {/* Online indicator */}
            <span className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        ))}

        {users.length === 0 && isConnected && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
            No other players online
          </p>
        )}
      </div>
    </div>
  );
}
