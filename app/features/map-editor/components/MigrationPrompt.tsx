import { useState } from "react";
import type { MapIndexEntry } from "../utils/storage-utils";
import { loadMap, deleteMap as deleteLocalMap } from "../utils/storage-utils";

interface MigrationPromptProps {
  localMaps: MapIndexEntry[];
  onMigrationComplete: () => void;
  onDismiss: () => void;
}

export function MigrationPrompt({
  localMaps,
  onMigrationComplete,
  onDismiss,
}: MigrationPromptProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setProgress(0);
    setErrors([]);

    const totalMaps = localMaps.length;
    const newErrors: string[] = [];

    for (let i = 0; i < localMaps.length; i++) {
      const mapEntry = localMaps[i];
      const map = loadMap(mapEntry.id);

      if (!map) {
        newErrors.push(`Failed to load "${mapEntry.name}"`);
        continue;
      }

      try {
        const response = await fetch("/api/maps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: map.name, data: map }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Successfully migrated, delete from localStorage
        deleteLocalMap(mapEntry.id);
      } catch (e) {
        newErrors.push(
          `Failed to migrate "${mapEntry.name}": ${
            e instanceof Error ? e.message : "Unknown error"
          }`
        );
      }

      setProgress(Math.round(((i + 1) / totalMaps) * 100));
    }

    setErrors(newErrors);
    setIsMigrating(false);

    if (newErrors.length === 0) {
      onMigrationComplete();
    }
  };

  const handleDeleteAll = () => {
    if (
      !confirm(
        "Are you sure you want to delete all local maps without migrating? This cannot be undone."
      )
    ) {
      return;
    }

    for (const map of localMaps) {
      deleteLocalMap(map.id);
    }

    onDismiss();
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="text-blue-600 dark:text-blue-400 text-2xl">
          <span>&#x1F4E6;</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Migrate Local Maps
          </h3>
          <p className="text-blue-800 dark:text-blue-200 mb-4">
            You have {localMaps.length} map{localMaps.length !== 1 ? "s" : ""}{" "}
            stored locally in your browser. Would you like to migrate them to
            your account? This will enable sharing and access from any device.
          </p>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded">
              <p className="font-medium mb-1">Some maps failed to migrate:</p>
              <ul className="list-disc list-inside text-sm">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {isMigrating ? (
            <div className="space-y-2">
              <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Migrating... {progress}%
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleMigrate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Migrate {localMaps.length} map{localMaps.length !== 1 ? "s" : ""}
              </button>
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 cursor-pointer"
              >
                Delete local copies
              </button>
            </div>
          )}

          <div className="mt-4">
            <details className="text-sm">
              <summary className="text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-900 dark:hover:text-blue-100">
                View local maps
              </summary>
              <ul className="mt-2 space-y-1 text-blue-800 dark:text-blue-200">
                {localMaps.map((map) => (
                  <li key={map.id} suppressHydrationWarning>
                    {map.name} - Updated{" "}
                    {new Date(map.updatedAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
