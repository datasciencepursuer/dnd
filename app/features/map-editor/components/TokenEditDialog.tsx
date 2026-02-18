import { useState, useEffect } from "react";
import { useMapStore, useEditorStore } from "../store";
import { TOKEN_COLORS } from "../constants";
import { ImageLibraryPicker } from "./ImageLibraryPicker";
import { useUploadThing } from "~/utils/uploadthing";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";
import type { Token, TokenLayer, CharacterSheet, MonsterGroup } from "../types";

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

  // Character library state
  const [availableCharacters, setAvailableCharacters] = useState<LibraryCharacter[]>([]);
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
    const fetchCharacters = async () => {
      try {
        const response = await fetch("/api/characters");
        if (response.ok) {
          const data = await response.json();
          setAvailableCharacters(data.characters || []);
        }
      } catch (error) {
        console.error("Failed to fetch characters:", error);
      }
    };

    fetchCharacters();
  }, []);

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
  }, [token]);

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
      fetch(`/api/characters/${character.id}`, {
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
    await fetch(`/api/characters/${importConflict.character.id}`, {
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
      const response = await fetch("/api/characters", {
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
        setAvailableCharacters((prev) => [data.character, ...prev]);
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Token
          </h2>
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
    </div>
  );
}
