import { useState, useEffect } from "react";
import { PATCH_NOTES } from "~/lib/patch-notes";

const STORAGE_KEY = "patchNotesDismissed";

export function PatchNotesPanel() {
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [versionIndex, setVersionIndex] = useState(0);

  const notes = PATCH_NOTES.slice(0, 2);
  const latest = notes[0];
  const current = latest ? (notes[versionIndex] ?? latest) : undefined;

  useEffect(() => {
    if (!latest) return;
    const dismissedVersion = localStorage.getItem(STORAGE_KEY);
    if (dismissedVersion !== latest.version) {
      setDismissed(false);
    }
  }, [latest?.version]);

  if (!latest || !current) return null;
  if (dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, latest.version);
    setDismissed(true);
  };

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg mb-6">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 cursor-pointer text-left"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l.707.707.707-.707A1 1 0 0115.414 3l-.707.707.707.707a1 1 0 01-1.414 1.414L13.293 5.12l-.707.708a1 1 0 01-1.414-1.414l.707-.708-.707-.707A1 1 0 0112 2z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-medium text-purple-900 dark:text-purple-100 flex-1">
          What's New
        </span>
        {notes.length > 1 ? (
          <span className="flex flex-row-reverse gap-1" onClick={(e) => e.stopPropagation()}>
            {notes.map((note, i) => (
              <button
                key={note.version}
                onClick={() => setVersionIndex(i)}
                className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                  i === versionIndex
                    ? "bg-purple-600 text-white"
                    : "bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800"
                }`}
              >
                v{note.version}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300">
            v{latest.version}
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-purple-500 dark:text-purple-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        <button
          onClick={handleDismiss}
          className="text-purple-400 dark:text-purple-500 hover:text-purple-600 dark:hover:text-purple-300 cursor-pointer"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-6 pt-0">
          <div className="border-t border-purple-200 dark:border-purple-800 pt-4">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                {current.title}
              </h3>
              <span className="text-sm text-purple-600 dark:text-purple-400">
                {current.date}
              </span>
            </div>
            <ul className="space-y-1.5">
              {current.changes.map((change, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-purple-800 dark:text-purple-200"
                >
                  <span className="text-purple-400 dark:text-purple-500 mt-1 flex-shrink-0">
                    &bull;
                  </span>
                  {change}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
