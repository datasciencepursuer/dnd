import { useState } from "react";
import { useMapStore, useEditorStore } from "../../store";
import { useUploadThing } from "~/utils/uploadthing";
import { ImageLibraryPicker } from "../ImageLibraryPicker";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";

interface BackgroundPanelProps {
  mapId?: string;
  onBackgroundChange?: () => void;
}

export function BackgroundPanel({ mapId, onBackgroundChange }: BackgroundPanelProps) {
  const map = useMapStore((s) => s.map);
  const setBackground = useMapStore((s) => s.setBackground);
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const { startUpload } = useUploadThing("mapBackgroundUploader", {
    headers: mapId ? { "x-map-id": mapId } : undefined,
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setBackground(res[0].url);
        onBackgroundChange?.();
      }
      setIsUploading(false);
      setUploadError(null);
    },
    onUploadError: (error) => {
      setUploadError(parseUploadError(error.message, UPLOAD_LIMITS.MAP_MAX_SIZE));
      setIsUploading(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapId) return;

    setIsUploading(true);
    setUploadError(null);

    await startUpload([file]);

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleRemoveBackground = () => {
    setBackground(null);
    onBackgroundChange?.();
  };

  const handleLibrarySelect = (url: string) => {
    setBackground(url);
    onBackgroundChange?.();
    setShowLibrary(false);
  };

  const currentBackground = map?.background?.imageUrl;
  const showUpload = canEditMap() && mapId;

  return (
    <div className="p-4 space-y-4 border-b border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white">Map Background</h3>

      {/* Current background preview */}
      {currentBackground && (
        <div className="space-y-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Current background</span>
          <div className="relative inline-block">
            <img
              src={currentBackground}
              alt="Current background"
              className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600"
            />
            <button
              onClick={handleRemoveBackground}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 cursor-pointer"
              title="Remove background"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Custom Upload */}
      {showUpload && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Upload background image
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                (max {UPLOAD_LIMITS.MAP_MAX_SIZE})
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                dark:file:bg-blue-900 dark:file:text-blue-300
                hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                file:cursor-pointer cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </label>
          {isUploading && (
            <p className="text-sm text-blue-600 dark:text-blue-400">Uploading...</p>
          )}
          {uploadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          )}

          {/* Library toggle */}
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {showLibrary ? "Hide my uploads" : "Choose from my uploads"}
          </button>

          {/* Image library picker */}
          {showLibrary && (
            <div className="p-2 border border-gray-200 dark:border-gray-700 rounded">
              <ImageLibraryPicker
                type="map"
                onSelect={handleLibrarySelect}
                selectedUrl={currentBackground}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
