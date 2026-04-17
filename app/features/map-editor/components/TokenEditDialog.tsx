import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFetcher } from "react-router";
import { useMapStore, useEditorStore } from "../store";
import { TOKEN_COLORS } from "../constants";
import { ImageLibraryPicker } from "./ImageLibraryPicker";
import { apiUrl } from "~/lib/api-config";
import { useUploadThing } from "~/utils/uploadthing";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";
import type { Token, TokenLayer, CharacterSheet, MonsterGroup } from "../types";
import {
  PORTRAIT_STYLE_OPTIONS,
  DEFAULT_PORTRAIT_STYLE,
  type PortraitArtStyle,
} from "../portrait-styles";

interface GroupMemberInfo {
  id: string;
  name: string;
}

interface LibraryCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  layer: string;
  characterSheet: CharacterSheet | null;
}

interface TokenEditDialogProps {
  token: Token;
  onClose: () => void;
  groupMembers?: GroupMemberInfo[];
  onSave?: () => void;
  onTokenUpdate?: (tokenId: string, updates: Record<string, unknown>) => void;
  onDelete?: (tokenId: string) => void;
  onClone?: (tokenId: string) => void;
  mapId?: string;
  // Navigation between tokens
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  tokenIndex?: number;
  tokenCount?: number;
}

export function TokenEditDialog({
  token,
  onClose,
  groupMembers = [],
  onSave,
  onTokenUpdate,
  onDelete,
  onClone,
  mapId,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
  tokenIndex,
  tokenCount,
}: TokenEditDialogProps) {
  const updateToken = useMapStore((s) => s.updateToken);
  const map = useMapStore((s) => s.map);
  const createMonsterGroup = useMapStore((s) => s.createMonsterGroup);
  const addToMonsterGroup = useMapStore((s) => s.addToMonsterGroup);
  const removeFromMonsterGroup = useMapStore((s) => s.removeFromMonsterGroup);

  // Permission checks from editor store
  const canChangeTokenOwner = useEditorStore((s) => s.canChangeTokenOwner);
  const canLinkOrSaveToken = useEditorStore((s) => s.canLinkOrSaveToken);

  // Check if current user can link/save this specific token
  const canLinkOrSave = canLinkOrSaveToken(token.ownerId);
  const canAssignOwner = canChangeTokenOwner(token.ownerId);

  const [name, setName] = useState(token.name);
  const [color, setColor] = useState(token.color);
  const [size, setSize] = useState(token.size);
  const [layer, setLayer] = useState<TokenLayer>(token.layer);
  const [visible, setVisible] = useState(token.visible);
  const [ownerId, setOwnerId] = useState<string | null>(token.ownerId);
  const [imageUrl, setImageUrl] = useState<string | null>(token.imageUrl);
  const [characterId, setCharacterId] = useState<string | null>(token.characterId || null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // AI portrait generation state
  const aiRemaining = useEditorStore((s) => s.aiImageRemaining);
  const aiLimit = useEditorStore((s) => s.aiImageLimit);
  const aiWindow = useEditorStore((s) => s.aiImageWindow);
  const aiEnabled = useEditorStore((s) => s.aiImageEnabled);
  const updateAiImageUsage = useEditorStore((s) => s.updateAiImageUsage);
  const [showAiPortrait, setShowAiPortrait] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState<PortraitArtStyle>(DEFAULT_PORTRAIT_STYLE);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ base64: string; mimeType: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // Reference image for AI editing (from current token image or previous AI result)
  const [aiReferenceUrl, setAiReferenceUrl] = useState<string | null>(null);
  const [aiReferenceBase64, setAiReferenceBase64] = useState<{ base64: string; mimeType: string } | null>(null);
  const [showAiRefLibrary, setShowAiRefLibrary] = useState(false);
  const [showAiPreviewModal, setShowAiPreviewModal] = useState(false);

  // Character library state
  const characterFetcher = useFetcher<{ characters: LibraryCharacter[] }>();
  const availableCharacters = characterFetcher.data?.characters ?? [];
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [saveToLibraryError, setSaveToLibraryError] = useState<string | null>(null);

  // Import conflict state - when token has a sheet and we're importing a character
  const [importConflict, setImportConflict] = useState<{
    character: LibraryCharacter;
    tokenHasSheet: boolean;
    libraryHasSheet: boolean;
  } | null>(null);

  // Pending character sheet to save (from imported character or conflict resolution)
  // undefined = no import happened, null = imported character has no sheet, CharacterSheet = imported sheet
  const [pendingCharacterSheet, setPendingCharacterSheet] = useState<CharacterSheet | null | undefined>(undefined);

  // Monster group state (for monster layer tokens)
  const [monsterGroupId, setMonsterGroupId] = useState<string | null>(token.monsterGroupId || null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const isDM = useEditorStore((s) => s.isDungeonMaster)();

  // Get available monster groups from the map
  const monsterGroups: MonsterGroup[] = map?.monsterGroups || [];

  // Fetch available characters from library
  useEffect(() => {
    characterFetcher.load("/api/characters");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { startUpload } = useUploadThing("tokenImageUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setImageUrl(res[0].url);
      }
      setIsUploading(false);
      setUploadError(null);
    },
    onUploadError: (error) => {
      setUploadError(parseUploadError(error.message, UPLOAD_LIMITS.TOKEN_MAX_SIZE));
      setIsUploading(false);
    },
  });

  // Update local state if token changes (e.g., when navigating between tokens)
  useEffect(() => {
    setName(token.name);
    setColor(token.color);
    setSize(token.size);
    setLayer(token.layer);
    setVisible(token.visible);
    setOwnerId(token.ownerId);
    setImageUrl(token.imageUrl);
    setCharacterId(token.characterId || null);
    setMonsterGroupId(token.monsterGroupId || null);
    setPendingCharacterSheet(undefined);
    setImportConflict(null);
    setShowCharacterPicker(false);
    setShowLibrary(false);
    setShowCreateGroup(false);
    setShowAiPortrait(false);
    setAiPreview(null);
    setAiPrompt("");
    setAiError(null);
    setAiReferenceUrl(null);
    setAiReferenceBase64(null);
  }, [token]);

  // AI portrait generation
  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);
    setAiError(null);
    setAiPreview(null);

    try {
      const bodyPayload: Record<string, unknown> = {
        prompt: aiPrompt.trim(),
        tokenSize: size,
        artStyle: aiStyle,
      };

      if (aiReferenceBase64) {
        bodyPayload.referenceImageBase64 = aiReferenceBase64.base64;
        bodyPayload.referenceImageMimeType = aiReferenceBase64.mimeType;
      } else if (aiReferenceUrl) {
        bodyPayload.referenceImageUrl = aiReferenceUrl;
      }

      const res = await fetch(apiUrl("/api/generate-portrait"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Failed to generate portrait");
        return;
      }

      // Apply chroma key removal for white background transparency
      let finalBase64 = data.imageBase64;
      try {
        const { removeChromaKey } = await import("../utils/chroma-key");
        finalBase64 = await removeChromaKey(data.imageBase64, data.mimeType ?? "image/png");
      } catch (chromaErr) {
        console.error("Chroma key removal failed, using raw image:", chromaErr);
      }
      setAiPreview({ base64: finalBase64, mimeType: "image/png" });
      updateAiImageUsage(data.remaining ?? null, data.window ?? null);
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setIsAiGenerating(false);
    }
  }, [aiPrompt, size, aiStyle, aiReferenceBase64, aiReferenceUrl, updateAiImageUsage]);

  const handleAiAccept = async () => {
    if (!aiPreview) return;
    setIsUploading(true);
    setUploadError(null);

    // Convert base64 to File and upload
    const byteString = atob(aiPreview.base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const ext = aiPreview.mimeType === "image/jpeg" ? "jpg" : "png";
    const file = new File([ab], `ai-portrait.${ext}`, { type: aiPreview.mimeType });

    await startUpload([file]);

    // Clear AI state after upload completes (imageUrl is set via onClientUploadComplete)
    setAiPreview(null);
    setAiPrompt("");
    setShowAiPortrait(false);
    setAiReferenceUrl(null);
    setAiReferenceBase64(null);
  };

  const handleAiEditPreview = () => {
    // Use the current AI preview as reference for further iteration
    if (aiPreview) {
      setAiReferenceBase64({ base64: aiPreview.base64, mimeType: aiPreview.mimeType });
      setAiReferenceUrl(null);
      setAiPreview(null);
      setAiPrompt("");
    }
  };

  const handleSave = () => {
    const updates: Record<string, unknown> = {
      name: name.trim() || "Unnamed Token",
      color,
      size,
      layer,
      visible,
      ownerId,
      imageUrl,
      characterId,
      monsterGroupId: layer === "monster" ? monsterGroupId : null, // Only monsters can have groups
    };

    // If we imported a character, use the pending sheet for display (HP bar, AC icon)
    // The library is the source of truth for editing, but token keeps cached copy for rendering
    if (pendingCharacterSheet !== undefined) {
      updates.characterSheet = pendingCharacterSheet;
    }

    // Update locally first for responsive UI
    updateToken(token.id, updates);

    // Then sync to server via callback
    onTokenUpdate?.(token.id, updates);

    onSave?.();
    onClose();
  };

  // Handle creating a new monster group
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const groupId = createMonsterGroup(newGroupName.trim(), [token.id]);
    setMonsterGroupId(groupId);
    setNewGroupName("");
    setShowCreateGroup(false);
  };

  // Handle monster group selection
  const handleGroupChange = (value: string) => {
    if (value === "none") {
      setMonsterGroupId(null);
    } else if (value === "new") {
      setShowCreateGroup(true);
    } else {
      setMonsterGroupId(value);
    }
  };

  // Import an existing character from the library
  const handleImportCharacter = (character: LibraryCharacter) => {
    const tokenHasSheet = !!token.characterSheet;
    const libraryHasSheet = !!character.characterSheet;

    // If both have sheets, show conflict dialog
    if (tokenHasSheet && libraryHasSheet) {
      setImportConflict({ character, tokenHasSheet, libraryHasSheet });
      return;
    }

    // If only token has sheet, sync it to library then import
    if (tokenHasSheet && !libraryHasSheet) {
      // Sync token's sheet to library character
      fetch(apiUrl(`/api/characters/${character.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterSheet: { ...token.characterSheet, lastModified: Date.now() }
        }),
      }).catch(console.error);
    }

    // Complete the import
    completeImport(character);
  };

  // Complete the import process (used after conflict resolution)
  const completeImport = (character: LibraryCharacter, useSheet?: CharacterSheet | null) => {
    setCharacterId(character.id);
    // Sync appearance from character
    setName(character.name);
    setImageUrl(character.imageUrl);
    setColor(character.color);
    setSize(character.size);
    setLayer(character.layer as TokenLayer);
    // Set character sheet for display (HP bar, AC icon)
    setPendingCharacterSheet(useSheet !== undefined ? useSheet : character.characterSheet);
    setShowCharacterPicker(false);
    setImportConflict(null);
  };

  // Resolve import conflict - use token's sheet
  const handleUseTokenSheet = async () => {
    if (!importConflict) return;
    const sheetToUse = token.characterSheet ? { ...token.characterSheet, lastModified: Date.now() } : null;
    // Sync token's sheet to library
    await fetch(apiUrl(`/api/characters/${importConflict.character.id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterSheet: sheetToUse }),
    });
    completeImport(importConflict.character, sheetToUse);
  };

  // Resolve import conflict - use library's sheet
  const handleUseLibrarySheet = () => {
    if (!importConflict) return;
    // Use library's sheet for display
    completeImport(importConflict.character, importConflict.character.characterSheet);
  };

  // Remove imported character
  const handleRemoveImport = () => {
    setCharacterId(null);
  };

  // Save token as a new character in the library
  const handleSaveToLibrary = async () => {
    setIsSavingToLibrary(true);
    setSaveToLibraryError(null);

    try {
      const response = await fetch(apiUrl("/api/characters"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Unnamed Character",
          imageUrl,
          color,
          size,
          layer,
          characterSheet: token.characterSheet,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Import this token from the new library character
        setCharacterId(data.character.id);
        // Refresh available characters
        characterFetcher.load("/api/characters");
        setSaveToLibraryError(null);
      } else {
        const result = await response.json();
        setSaveToLibraryError(result.error || "Failed to save to library");
      }
    } catch {
      setSaveToLibraryError("Failed to save to library");
    } finally {
      setIsSavingToLibrary(false);
    }
  };

  const importedCharacter = characterId
    ? availableCharacters.find((c) => c.id === characterId)
    : null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    await startUpload([file]);

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
  };

  const handleLibrarySelect = (url: string) => {
    setImageUrl(url);
    setShowLibrary(false);
  };

  // Save current edits without closing the dialog
  const saveCurrentEdits = () => {
    const updates: Record<string, unknown> = {
      name: name.trim() || "Unnamed Token",
      color,
      size,
      layer,
      visible,
      ownerId,
      imageUrl,
      characterId,
      monsterGroupId: layer === "monster" ? monsterGroupId : null,
    };

    if (pendingCharacterSheet !== undefined) {
      updates.characterSheet = pendingCharacterSheet;
    }

    updateToken(token.id, updates);
    onTokenUpdate?.(token.id, updates);
    onSave?.();
  };

  const handleNavigateNext = () => {
    if (!onNext || !hasNext) return;
    saveCurrentEdits();
    onNext();
  };

  const handleNavigatePrev = () => {
    if (!onPrev || !hasPrev) return;
    saveCurrentEdits();
    onPrev();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Import Conflict Dialog */}
      {importConflict && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Character Sheet Conflict
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Both this token and <strong>{importConflict.character.name}</strong> have character sheets. Which one should be kept?
            </p>
            <div className="space-y-2">
              <button
                onClick={handleUseTokenSheet}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer text-sm"
              >
                Use Token's Sheet (sync to library)
              </button>
              <button
                onClick={handleUseLibrarySheet}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer text-sm"
              >
                Use Library's Sheet (discard token's)
              </button>
              <button
                onClick={() => setImportConflict(null)}
                className="w-full px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-[200px]">
              {token.name || "Token"}
            </h2>
            {/* Quick action buttons */}
            {onClone && (
              <button
                onClick={() => { onClone(token.id); onClose(); }}
                className="p-1.5 text-gray-400 hover:text-purple-500 dark:text-gray-500 dark:hover:text-purple-400 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Clone token"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                  <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { onDelete(token.id); onClose(); }}
                className="p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Remove token"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Token navigation */}
            {(onNext || onPrev) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNavigatePrev}
                  disabled={!hasPrev}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous token"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                {tokenIndex !== undefined && tokenCount !== undefined && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-center">
                    {tokenIndex + 1}/{tokenCount}
                  </span>
                )}
                <button
                  onClick={handleNavigateNext}
                  disabled={!hasNext}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next token"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
            >
              <span className="text-2xl">&times;</span>
            </button>
          </div>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image
            </label>

            {/* Current image preview */}
            {imageUrl && (
              <div className="relative inline-block mb-2">
                <img
                  src={imageUrl}
                  alt="Token"
                  className="w-16 h-16 object-cover rounded border border-gray-300 dark:border-gray-600"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 cursor-pointer"
                  title="Remove image"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Upload */}
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Upload new image
                  <span className="text-gray-400 dark:text-gray-500 ml-1">
                    (max {UPLOAD_LIMITS.TOKEN_MAX_SIZE})
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-1.5 file:px-3
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
                <p className="text-xs text-blue-600 dark:text-blue-400">Uploading...</p>
              )}
              {uploadError && (
                <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
              )}
            </div>

            {/* Library toggle */}
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {showLibrary ? "Hide library" : "Choose from my uploads"}
            </button>

            {/* Image library picker */}
            {showLibrary && (
              <div className="mt-2 p-2 border border-gray-200 dark:border-gray-700 rounded">
                <ImageLibraryPicker
                  type="token"
                  onSelect={handleLibrarySelect}
                  selectedUrl={imageUrl}
                />
              </div>
            )}

            {/* AI Portrait toggle */}
            {aiEnabled !== false && (
              <div className="mt-2">
                <button
                  onClick={() => {
                    const next = !showAiPortrait;
                    setShowAiPortrait(next);
                    if (!next) { setAiReferenceUrl(null); setAiReferenceBase64(null); }
                  }}
                  className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                  </svg>
                  {showAiPortrait ? "Hide AI Portrait" : "AI Portrait"}
                </button>
              </div>
            )}

            {/* AI Portrait Generator Panel */}
            {showAiPortrait && (
              <div className="mt-2 space-y-2.5 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                {/* Reference image */}
                {(aiReferenceUrl || aiReferenceBase64) ? (
                  <div className="flex items-center gap-2 p-2 bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 rounded text-xs">
                    <img
                      src={aiReferenceBase64
                        ? `data:${aiReferenceBase64.mimeType};base64,${aiReferenceBase64.base64}`
                        : aiReferenceUrl!}
                      alt="Reference"
                      className="w-8 h-8 object-cover rounded border border-purple-300 dark:border-purple-600"
                    />
                    <span className="flex-1 text-purple-700 dark:text-purple-300 font-medium">Reference image</span>
                    <button
                      onClick={() => { setAiReferenceUrl(null); setAiReferenceBase64(null); }}
                      className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 cursor-pointer"
                      title="Remove reference"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {imageUrl && (
                      <button
                        onClick={() => setAiReferenceUrl(imageUrl)}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer underline"
                      >
                        Use current image as reference
                      </button>
                    )}
                    <button
                      onClick={() => setShowAiRefLibrary(!showAiRefLibrary)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer underline"
                    >
                      {showAiRefLibrary ? "Hide library" : "Pick from library"}
                    </button>
                  </div>
                )}
                {showAiRefLibrary && !aiReferenceUrl && !aiReferenceBase64 && (
                  <div className="p-2 border border-purple-200 dark:border-purple-700 rounded">
                    <ImageLibraryPicker
                      type="token"
                      onSelect={(url) => { setAiReferenceUrl(url); setShowAiRefLibrary(false); }}
                    />
                  </div>
                )}

                {/* Style pills */}
                <div className="flex gap-1.5">
                  {PORTRAIT_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAiStyle(opt.value)}
                      title={opt.tooltip}
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

                {/* Prompt */}
                <div className="space-y-1">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value.slice(0, 1000))}
                    placeholder={aiReferenceUrl || aiReferenceBase64
                      ? "Describe what to change... e.g. Add a glowing sword, change armor to plate mail"
                      : "Describe your character... e.g. Elven ranger with a longbow, green cloak"}
                    rows={2}
                    disabled={isAiGenerating}
                    className="w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 resize-none placeholder:text-gray-400 disabled:opacity-50"
                  />
                  <div className="text-xs text-gray-400 text-right">{aiPrompt.length}/1000</div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleAiGenerate}
                  disabled={isAiGenerating || !aiPrompt.trim() || aiRemaining === 0}
                  className="w-full py-2 px-3 text-sm font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isAiGenerating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      {aiReferenceUrl || aiReferenceBase64 ? "Edit Portrait" : "Generate Portrait"}
                      {aiRemaining != null && aiLimit != null && (
                        <span className={`text-xs font-normal ml-1 ${aiRemaining === 0 ? "text-red-300" : "text-purple-300"}`}>
                          ({aiRemaining}/{aiLimit})
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Error */}
                {aiError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
                )}

                {/* Preview */}
                {aiPreview && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowAiPreviewModal(true)}
                      className="block mx-auto cursor-pointer rounded border border-gray-300 dark:border-gray-600 overflow-hidden hover:border-purple-400 dark:hover:border-purple-500 transition-colors group relative"
                      title="Click to preview full size"
                    >
                      <img
                        src={`data:${aiPreview.mimeType};base64,${aiPreview.base64}`}
                        alt="AI generated portrait"
                        className="w-full max-w-[200px] rounded"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      </span>
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAiAccept}
                        disabled={isUploading}
                        className="flex-1 py-1.5 px-2 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                      >
                        {isUploading ? "Uploading..." : "Use This"}
                      </button>
                      <button
                        onClick={handleAiEditPreview}
                        className="py-1.5 px-2 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                        title="Use this result as reference for further edits"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleAiGenerate}
                        disabled={isAiGenerating}
                        className="py-1.5 px-2 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 cursor-pointer"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => { setAiPreview(null); setAiError(null); }}
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

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color
              {imageUrl && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  (used for travel lines & drawing)
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-1">
              {TOKEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 cursor-pointer ${
                    color === c ? "border-blue-500" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Size
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`px-2 py-1.5 text-sm rounded border cursor-pointer ${
                    size === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {s}x{s}
                </button>
              ))}
            </div>
          </div>

          {/* Layer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Layer
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(["character", "monster", "object"] as TokenLayer[]).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLayer(l);
                    // Clear monster group if changing away from monster layer
                    if (l !== "monster") {
                      setMonsterGroupId(null);
                    }
                  }}
                  className={`px-2 py-1.5 text-sm rounded border cursor-pointer capitalize ${
                    layer === l
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Monster Group - only shown for monster layer tokens and DM */}
          {layer === "monster" && isDM && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Monster Group
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  (share initiative in combat)
                </span>
              </label>
              {showCreateGroup ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name (e.g., Goblin Pack)"
                    className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateGroup();
                      if (e.key === "Escape") setShowCreateGroup(false);
                    }}
                  />
                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim()}
                    className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 cursor-pointer text-sm"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateGroup(false)}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={monsterGroupId || "none"}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="none">No group (individual initiative)</option>
                  {monsterGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                  <option value="new">+ Create new group...</option>
                </select>
              )}
            </div>
          )}

          {/* Visibility */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="visible"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="visible"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Visible on map
            </label>
          </div>

          {/* Owner - only shown if canAssignOwner and there are group members */}
          {canAssignOwner && groupMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Owner
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  (can move this token)
                </span>
              </label>
              <select
                value={ownerId || ""}
                onChange={(e) => setOwnerId(e.target.value || null)}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No owner (DM only)</option>
                {groupMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Character Sheet Library Section - only shown if user can link/save this token */}
          {canLinkOrSave && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Character Sheet Library
              </label>

              {importedCharacter ? (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-3">
                    {importedCharacter.imageUrl ? (
                      <img
                        src={importedCharacter.imageUrl}
                        alt={importedCharacter.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: importedCharacter.color }}
                      >
                        {importedCharacter.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {importedCharacter.name}
                      </p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Imported from library
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImport}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Import a character to sync data across maps, or save this token to the library.
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCharacterPicker(!showCharacterPicker)}
                      className="flex-1 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 cursor-pointer"
                    >
                      {showCharacterPicker ? "Hide Characters" : "Import Character"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToLibrary}
                      disabled={isSavingToLibrary}
                      className="flex-1 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingToLibrary ? "Saving..." : "Save to Library"}
                    </button>
                  </div>

                  {saveToLibraryError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{saveToLibraryError}</p>
                  )}

                  {showCharacterPicker && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                      {availableCharacters.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No characters in library yet
                        </p>
                      ) : (
                        availableCharacters.map((char) => (
                          <button
                            key={char.id}
                            type="button"
                            onClick={() => handleImportCharacter(char)}
                            className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-left"
                          >
                            {char.imageUrl ? (
                              <img
                                src={char.imageUrl}
                                alt={char.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                style={{ backgroundColor: char.color }}
                              >
                                {char.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                              {char.name}
                            </span>
                            {char.characterSheet && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                                Sheet
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      {/* AI preview full-size modal */}
      {showAiPreviewModal && aiPreview && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowAiPreviewModal(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={`data:${aiPreview.mimeType};base64,${aiPreview.base64}`}
              alt="AI generated portrait full preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setShowAiPreviewModal(false)}
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
