import { useState, useEffect } from "react";
import { ConfirmModal } from "./ConfirmModal";

interface Upload {
  id: string;
  url: string;
  type: "token" | "map";
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface ImageLibraryPickerProps {
  type: "token" | "map";
  onSelect: (url: string) => void;
  selectedUrl?: string | null;
}

export function ImageLibraryPicker({
  type,
  onSelect,
  selectedUrl,
}: ImageLibraryPickerProps) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Upload | null>(null);
  const [search, setSearch] = useState("");

  const fetchUploads = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/uploads?type=${type}`);
      if (!response.ok) {
        throw new Error("Failed to fetch uploads");
      }
      const data = await response.json();
      setUploads(data.uploads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load images");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [type]);

  const handleDeleteClick = (e: React.MouseEvent, upload: Upload) => {
    e.stopPropagation(); // Prevent selecting the image when clicking delete
    setDeleteConfirm(upload);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const upload = deleteConfirm;
    setDeletingId(upload.id);

    try {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: upload.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      // Remove from local state
      setUploads((prev) => prev.filter((u) => u.id !== upload.id));

      // If the deleted image was selected, clear selection
      if (selectedUrl === upload.url) {
        onSelect("");
      }

      setDeleteConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        Loading images...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400 py-4 text-center">
        {error}
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No {type === "token" ? "token" : "map background"} images uploaded yet.
      </div>
    );
  }

  const filtered = search
    ? uploads.filter((u) =>
        u.fileName.toLowerCase().includes(search.toLowerCase())
      )
    : uploads;

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search images..."
          className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {filtered.length === uploads.length
            ? `${uploads.length} images`
            : `${filtered.length} of ${uploads.length}`}
        </span>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        <div className="grid grid-cols-4 gap-2">
        {filtered.map((upload) => (
          <div
            key={upload.id}
            className="group"
          >
            <button
              onClick={() => onSelect(upload.url)}
              disabled={deletingId === upload.id}
              className={`relative aspect-square w-full rounded-t border-2 border-b-0 overflow-hidden cursor-pointer transition-all ${
                selectedUrl === upload.url
                  ? "border-blue-500 ring-2 ring-blue-300 ring-offset-0"
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              } ${deletingId === upload.id ? "opacity-50" : ""}`}
              title={`${upload.fileName} (${formatFileSize(upload.fileSize)})`}
            >
              <img
                src={upload.url}
                alt={upload.fileName}
                className="w-full h-full object-cover"
              />
            </button>

            {/* Action bar below image */}
            <div className={`flex items-center justify-between px-1.5 py-1 rounded-b border-2 border-t-0 text-xs ${
              selectedUrl === upload.url
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
            }`}>
              <span className="truncate text-gray-600 dark:text-gray-400 flex-1 mr-1" title={upload.fileName}>
                {upload.fileName.length > 8 ? upload.fileName.slice(0, 6) + "..." : upload.fileName}
              </span>
              <button
                onClick={(e) => handleDeleteClick(e, upload)}
                disabled={deletingId === upload.id}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Delete image"
              >
                {deletingId === upload.id ? (
                  <span className="animate-spin">...</span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Delete Image"
        message={`Are you sure you want to delete "${deleteConfirm?.fileName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={deletingId !== null}
      />
    </>
  );
}
