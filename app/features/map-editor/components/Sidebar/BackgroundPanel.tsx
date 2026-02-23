import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMapStore, useEditorStore } from "../../store";
import { useUploadThing } from "~/utils/uploadthing";
import { ImageLibraryPicker } from "../ImageLibraryPicker";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";

type MapArtStyle = "realistic" | "classic-fantasy" | "hd2d";

const STYLE_OPTIONS: { value: MapArtStyle; label: string }[] = [
  { value: "realistic", label: "Realistic" },
  { value: "classic-fantasy", label: "Classic Fantasy" },
  { value: "hd2d", label: "HD-2D" },
];

// Must match the server-side SUPPORTED_RATIOS in image-generation.ts
const SUPPORTED_RATIOS = [
  { label: "1:1",  w: 1,  h: 1  },
  { label: "4:3",  w: 4,  h: 3  },
  { label: "3:4",  w: 3,  h: 4  },
  { label: "3:2",  w: 3,  h: 2  },
  { label: "2:3",  w: 2,  h: 3  },
  { label: "16:9", w: 16, h: 9  },
  { label: "9:16", w: 9,  h: 16 },
  { label: "21:9", w: 21, h: 9  },
] as const;

/** Maps grid W×H to the closest Gemini-supported aspect ratio. */
function gridToAspectRatio(gw: number, gh: number) {
  const gridAngle = Math.atan2(gh, gw);
  let best: (typeof SUPPORTED_RATIOS)[number] = SUPPORTED_RATIOS[0]!;
  let bestDist = Infinity;
  for (const r of SUPPORTED_RATIOS) {
    const dist = Math.abs(Math.atan2(r.h, r.w) - gridAngle);
    if (dist < bestDist) { bestDist = dist; best = r; }
  }
  return best;
}

interface BackgroundPanelProps {
  mapId?: string;
  onBackgroundChange?: () => void;
}

export function BackgroundPanel({ mapId, onBackgroundChange }: BackgroundPanelProps) {
  const map = useMapStore((s) => s.map);
  const gridWidth = useMapStore((s) => s.map?.grid?.width ?? 30);
  const gridHeight = useMapStore((s) => s.map?.grid?.height ?? 20);
  const setBackground = useMapStore((s) => s.setBackground);
  const updateGrid = useMapStore((s) => s.updateGrid);
  const canEditMap = useEditorStore((s) => s.canEditMap);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // AI generation state
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState<MapArtStyle>("realistic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ base64: string; mimeType: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiLimit, setAiLimit] = useState<number | null>(null);
  const [aiWindow, setAiWindow] = useState<string | null>(null);
  const [isUploadingAi, setIsUploadingAi] = useState(false);

  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Close modal on ESC
  const handleModalKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowPreviewModal(false);
  }, []);

  useEffect(() => {
    if (showPreviewModal) {
      document.addEventListener("keydown", handleModalKeyDown);
      return () => document.removeEventListener("keydown", handleModalKeyDown);
    }
  }, [showPreviewModal, handleModalKeyDown]);

  // Fetch usage stats when AI generator is opened
  useEffect(() => {
    if (!showAiGenerator) return;
    let cancelled = false;
    fetch("/api/generate-map")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.remaining != null) setAiRemaining(data.remaining);
        if (data.limit != null) setAiLimit(data.limit);
        if (data.window) setAiWindow(data.window);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showAiGenerator]);

  // Local editable grid dimensions for AI generation
  const [aiGridW, setAiGridW] = useState(gridWidth);
  const [aiGridH, setAiGridH] = useState(gridHeight);

  // Sync local AI grid dims when store grid changes (and no preview is active)
  useEffect(() => {
    if (!aiPreview) {
      setAiGridW(gridWidth);
      setAiGridH(gridHeight);
    }
  }, [gridWidth, gridHeight, aiPreview]);

  const { startUpload } = useUploadThing("mapBackgroundUploader", {
    headers: mapId ? { "x-map-id": mapId } : undefined,
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setBackground(res[0].url);
        onBackgroundChange?.();
      }
      setIsUploading(false);
      setIsUploadingAi(false);
      setUploadError(null);
      // Clear AI preview after successful upload
      setAiPreview(null);
      setAiPrompt("");
    },
    onUploadError: (error) => {
      setUploadError(parseUploadError(error.message, UPLOAD_LIMITS.MAP_MAX_SIZE));
      setIsUploading(false);
      setIsUploadingAi(false);
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

  const handleGenerate = async () => {
    if (!aiPrompt.trim() || aiGridW < 1 || aiGridH < 1) return;

    setIsGenerating(true);
    setAiError(null);
    setAiPreview(null);

    try {
      const res = await fetch("/api/generate-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          gridWidth: aiGridW,
          gridHeight: aiGridH,
          cellSizeFt: 5,
          artStyle: aiStyle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Failed to generate map");
        return;
      }

      setAiPreview({ base64: data.imageBase64, mimeType: data.mimeType });
      if (data.remaining != null) setAiRemaining(data.remaining);
      if (data.window) setAiWindow(data.window);
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptAi = async () => {
    if (!aiPreview || !mapId) return;

    setIsUploadingAi(true);
    setUploadError(null);

    // Update grid dimensions to match what was generated
    if (aiGridW !== gridWidth || aiGridH !== gridHeight) {
      updateGrid({ width: aiGridW, height: aiGridH });
    }

    // Convert base64 to File
    const byteString = atob(aiPreview.base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const ext = aiPreview.mimeType === "image/jpeg" ? "jpg" : "png";
    const file = new File([ab], `ai-battlemap.${ext}`, { type: aiPreview.mimeType });

    await startUpload([file]);
  };

  const handleDiscardAi = () => {
    setAiPreview(null);
    setAiError(null);
  };

  const parseGridDim = (val: string, fallback: number) => {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? fallback : Math.max(1, Math.min(200, n));
  };

  const currentBackground = map?.background?.imageUrl;
  const showUpload = canEditMap() && mapId;

  const cellFt = 5;
  const totalW = aiGridW * cellFt;
  const totalH = aiGridH * cellFt;
  const gridChanged = aiGridW !== gridWidth || aiGridH !== gridHeight;
  const mappedRatio = gridToAspectRatio(aiGridW, aiGridH);

  const windowLabel =
    aiWindow === "monthly" ? "/mo" : aiWindow === "weekly" ? "/wk" : "/day";

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
          {isUploading && !isUploadingAi && (
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

          {/* AI Map Generator toggle */}
          <button
            onClick={() => setShowAiGenerator(!showAiGenerator)}
            className="flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
            </svg>
            {showAiGenerator ? "Hide AI Map Generator" : "AI Map"}
          </button>

          {/* AI Map Generator */}
          {showAiGenerator && (
            <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
              {/* Grid dimension inputs */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  Grid size
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={aiGridW}
                    onChange={(e) => setAiGridW(parseGridDim(e.target.value, aiGridW))}
                    disabled={isGenerating}
                    className="w-16 text-sm text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-1 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">&times;</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={aiGridH}
                    onChange={(e) => setAiGridH(parseGridDim(e.target.value, aiGridH))}
                    disabled={isGenerating}
                    className="w-16 text-sm text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-1 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({totalW}&times;{totalH}ft)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    Image ratio: {mappedRatio.label}
                  </span>
                  <span
                    className="inline-block border border-purple-400 dark:border-purple-600 rounded-sm bg-purple-100 dark:bg-purple-900/40"
                    style={{ width: `${mappedRatio.w * 4}px`, height: `${mappedRatio.h * 4}px` }}
                    title={`${mappedRatio.label} aspect ratio`}
                  />
                </div>
                {gridChanged && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Grid will resize to {aiGridW}&times;{aiGridH} when applied
                  </p>
                )}
              </div>

              {/* Style pills */}
              <div className="flex gap-1.5">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAiStyle(opt.value)}
                    className={`px-2.5 py-1 text-xs rounded-full cursor-pointer transition-colors ${
                      aiStyle === opt.value
                        ? "bg-purple-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Prompt textarea */}
              <div className="space-y-1">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value.slice(0, 500))}
                  placeholder="Describe your battlemap... e.g. Stone dungeon with a central chamber, torchlit corridors, and a pit trap"
                  rows={3}
                  disabled={isGenerating}
                  className="w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 resize-none placeholder:text-gray-400 disabled:opacity-50"
                />
                <div className="text-xs text-gray-400 text-right">
                  {aiPrompt.length}/500
                </div>
              </div>

              {/* Generate button with usage stats */}
              <div className="space-y-1">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !aiPrompt.trim() || aiRemaining === 0}
                  className="w-full py-2 px-3 text-sm font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      Generate Map
                      {aiRemaining != null && (
                        <span className={`text-xs font-normal ml-1 ${aiRemaining === 0 ? "text-red-300" : "text-purple-300"}`}>
                          ({aiRemaining}{aiLimit != null ? `/${aiLimit}` : ""}{aiWindow ? ` ${windowLabel}` : ""})
                        </span>
                      )}
                    </>
                  )}
                </button>
                {aiRemaining === 0 && (
                  <p className="text-xs text-red-500 dark:text-red-400 text-center">
                    No generations remaining{aiWindow ? ` ${windowLabel}` : ""}
                  </p>
                )}
              </div>

              {/* Error */}
              {aiError && (
                <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
              )}

              {/* Preview */}
              {aiPreview && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="w-full cursor-pointer rounded border border-gray-300 dark:border-gray-600 overflow-hidden hover:border-purple-400 dark:hover:border-purple-500 transition-colors group relative"
                  >
                    <img
                      src={`data:${aiPreview.mimeType};base64,${aiPreview.base64}`}
                      alt="AI generated battlemap preview"
                      className="w-full"
                      style={{ aspectRatio: `${mappedRatio.w} / ${mappedRatio.h}` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                      <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </span>
                  </button>
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Click to preview full size</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptAi}
                      disabled={isUploadingAi}
                      className="flex-1 py-1.5 px-2 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isUploadingAi ? "Uploading..." : gridChanged ? "Apply & Resize Grid" : "Use as Background"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="py-1.5 px-2 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 cursor-pointer"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleDiscardAi}
                      className="py-1.5 px-2 text-xs font-medium rounded bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-pointer"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Full-size preview modal (portaled to body) */}
      {showPreviewModal && aiPreview && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`data:${aiPreview.mimeType};base64,${aiPreview.base64}`}
              alt="AI generated battlemap full preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setShowPreviewModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-700 cursor-pointer shadow-lg text-lg"
            >
              &times;
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
