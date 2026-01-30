import { useState, useEffect } from "react";
import { useMapStore } from "../store";
import { TOKEN_COLORS } from "../constants";
import { ImageLibraryPicker } from "./ImageLibraryPicker";
import { useUploadThing } from "~/utils/uploadthing";
import type { Token, TokenLayer, CharacterSheet } from "../types";

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
  groupId: string | null;
}

interface TokenEditDialogProps {
  token: Token;
  onClose: () => void;
  groupMembers?: GroupMemberInfo[];
  canAssignOwner?: boolean;
  onSave?: () => void;
  onTokenUpdate?: (tokenId: string, updates: Record<string, unknown>) => void;
  mapId?: string;
  groupId?: string | null;
}

export function TokenEditDialog({
  token,
  onClose,
  groupMembers = [],
  canAssignOwner = false,
  onSave,
  onTokenUpdate,
  mapId,
  groupId,
}: TokenEditDialogProps) {
  const updateToken = useMapStore((s) => s.updateToken);

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

  // Fetch available characters from library
  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const url = groupId
          ? `/api/characters?groupId=${groupId}`
          : `/api/characters?groupId=personal`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setAvailableCharacters(data.characters || []);
        }
      } catch (error) {
        console.error("Failed to fetch characters:", error);
      }
    };

    fetchCharacters();
  }, [groupId]);

  const { startUpload } = useUploadThing("tokenImageUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setImageUrl(res[0].url);
      }
      setIsUploading(false);
      setUploadError(null);
    },
    onUploadError: (error) => {
      setUploadError(error.message);
      setIsUploading(false);
    },
  });

  // Update local state if token changes
  useEffect(() => {
    setName(token.name);
    setColor(token.color);
    setSize(token.size);
    setLayer(token.layer);
    setVisible(token.visible);
    setOwnerId(token.ownerId);
    setImageUrl(token.imageUrl);
    setCharacterId(token.characterId || null);
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
    };

    // Clear characterSheet when linking to avoid redundant data storage
    // The sheet is stored on the library character, not the token
    if (characterId) {
      updates.characterSheet = null;
    }

    // Update locally first for responsive UI
    updateToken(token.id, updates);

    // Then sync to server via callback
    onTokenUpdate?.(token.id, updates);

    onSave?.();
    onClose();
  };

  // Link to an existing character from the library
  const handleLinkCharacter = (character: LibraryCharacter) => {
    setCharacterId(character.id);
    // Optionally sync appearance from character
    setName(character.name);
    setImageUrl(character.imageUrl);
    setColor(character.color);
    setSize(character.size);
    setLayer(character.layer as TokenLayer);
    setShowCharacterPicker(false);
  };

  // Unlink from character
  const handleUnlinkCharacter = () => {
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
          groupId: groupId || null,
          characterSheet: token.characterSheet,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Link this token to the new character
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

  const linkedCharacter = characterId
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Token
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
          >
            <span className="text-2xl">&times;</span>
          </button>
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
                <span className="text-xs text-gray-600 dark:text-gray-400">Upload new image</span>
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
                  onClick={() => setLayer(l)}
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

          {/* Character Library Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Character Library
            </label>

            {linkedCharacter ? (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-3">
                  {linkedCharacter.imageUrl ? (
                    <img
                      src={linkedCharacter.imageUrl}
                      alt={linkedCharacter.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: linkedCharacter.color }}
                    >
                      {linkedCharacter.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {linkedCharacter.name}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">
                      Linked to library character
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkCharacter}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    Unlink
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Link to a shared character to sync data across maps, or save this token to the library.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCharacterPicker(!showCharacterPicker)}
                    className="flex-1 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 cursor-pointer"
                  >
                    {showCharacterPicker ? "Hide Characters" : "Link to Character"}
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
                          onClick={() => handleLinkCharacter(char)}
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
