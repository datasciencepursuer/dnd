import type { Route } from "./+types/characters";
import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import type { CharacterSheet } from "~/features/map-editor/types";
import { useUploadThing } from "~/utils/uploadthing";
import { ImageLibraryPicker } from "~/features/map-editor/components/ImageLibraryPicker";
import { CharacterSheetPanel } from "~/features/map-editor/components/CharacterSheet/CharacterSheetPanel";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";

interface CharacterData {
  id: string;
  userId: string;
  name: string;
  imageUrl: string | null;
  color: string;
  size: number;
  layer: string;
  characterSheet: CharacterSheet | null;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  characters: CharacterData[];
  userName: string;
  characterLibraryEnabled: boolean;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Characters - DnD" },
    { name: "description", content: "Manage your D&D characters" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { eq, desc } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { characters } = await import("~/.server/db/schema");
  const { requireAuth } = await import("~/.server/auth/session");

  const session = await requireAuth(request);
  const userId = session.user.id;

  const characterList = await db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(desc(characters.updatedAt));

  const { getUserTierLimits } = await import("~/.server/subscription");
  const limits = await getUserTierLimits(userId);

  return {
    characters: characterList,
    userName: session.user.name,
    characterLibraryEnabled: limits.characterLibrary,
  };
}

export default function Characters() {
  const { characters, userName, characterLibraryEnabled } = useLoaderData<LoaderData>();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null);
  const [editingSheetCharacter, setEditingSheetCharacter] = useState<CharacterData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingCharacter, setDeletingCharacter] = useState<CharacterData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState("#ef4444");
  const [formSize, setFormSize] = useState(1);
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload handler
  const { startUpload } = useUploadThing("tokenImageUploader", {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        setFormImageUrl(res[0].url);
      }
      setIsUploading(false);
      setUploadError(null);
    },
    onUploadError: (error) => {
      setUploadError(parseUploadError(error.message, UPLOAD_LIMITS.TOKEN_MAX_SIZE));
      setIsUploading(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    await startUpload([file]);
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    setFormImageUrl(null);
  };

  const handleLibrarySelect = (url: string) => {
    setFormImageUrl(url);
    setShowLibrary(false);
  };

  const openCreateModal = () => {
    setFormName("");
    setFormColor("#ef4444");
    setFormSize(1);
    setFormImageUrl(null);
    setShowLibrary(false);
    setUploadError(null);
    setEditingCharacter(null);
    setShowCreateModal(true);
  };

  const openEditModal = (character: CharacterData) => {
    setFormName(character.name);
    setFormColor(character.color);
    setFormSize(character.size);
    setFormImageUrl(character.imageUrl);
    setShowLibrary(false);
    setUploadError(null);
    setEditingCharacter(character);
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) return;

    setIsSubmitting(true);

    try {
      const url = editingCharacter
        ? `/api/characters/${editingCharacter.id}`
        : "/api/characters";

      const response = await fetch(url, {
        method: editingCharacter ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          color: formColor,
          size: formSize,
          imageUrl: formImageUrl || null,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        window.location.reload();
      } else {
        const result = await response.json();
        alert(result.error || "Failed to save character");
      }
    } catch {
      alert("Failed to save character");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCharacter) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/characters/${deletingCharacter.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const result = await response.json();
        alert(result.error || "Failed to delete character");
      }
    } catch {
      alert("Failed to delete character");
    } finally {
      setIsDeleting(false);
      setDeletingCharacter(null);
    }
  };

  const TOKEN_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
  ];

  const renderCharacterCard = (character: CharacterData) => {
    return (
      <div
        key={character.id}
        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4"
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          {character.imageUrl ? (
            <img
              src={character.imageUrl}
              alt={character.name}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2"
              style={{ borderColor: character.color }}
            />
          ) : (
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold"
              style={{ backgroundColor: character.color }}
            >
              {character.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {character.name}
            </h3>
            {character.characterSheet && (
              <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded flex-shrink-0">
                Sheet
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
            {character.characterSheet?.characterClass && (
              <p>
                {character.characterSheet.race && `${character.characterSheet.race} `}
                {character.characterSheet.characterClass}
                {character.characterSheet.level && ` Lv.${character.characterSheet.level}`}
              </p>
            )}
            <p className="text-xs">
              <span className="capitalize">{character.layer}</span>
              {" · "}
              Size {character.size}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setEditingSheetCharacter(character)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer flex-1 sm:flex-initial text-center"
          >
            {character.characterSheet ? "Character Sheet" : "Create Sheet"}
          </button>
          <button
            onClick={() => openEditModal(character)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer flex-1 sm:flex-initial text-center"
          >
            Edit
          </button>
          <button
            onClick={() => setDeletingCharacter(character)}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded cursor-pointer flex-1 sm:flex-initial text-center"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen max-lg:h-full max-lg:overflow-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Characters
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage characters shared across your maps
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              to="/"
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Back to Maps
            </Link>
            <button
              onClick={openCreateModal}
              disabled={!characterLibraryEnabled}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={!characterLibraryEnabled ? "Character sheet library requires a paid subscription" : undefined}
            >
              + New Character
            </button>
          </div>
        </div>

        {/* Character List */}
        {!characterLibraryEnabled ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sm:p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-3">
              Character sheet library requires a paid subscription.
            </p>
            <Link
              to="/pricing"
              className="inline-block px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              View Plans
            </Link>
          </div>
        ) : characters.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sm:p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No characters yet. Create your first character!
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              Create Character
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {characters.map(renderCharacterCard)}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingCharacter ? "Edit Character" : "Create Character"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOKEN_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-8 h-8 rounded-full border-2 cursor-pointer ${
                          formColor === color ? "border-blue-500" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Size (cells)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((size) => (
                      <button
                        key={size}
                        onClick={() => setFormSize(size)}
                        className={`px-4 py-2 rounded border cursor-pointer ${
                          formSize === size
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {size}x{size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Image
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 font-normal">
                      (max {UPLOAD_LIMITS.TOKEN_MAX_SIZE})
                    </span>
                  </label>

                  {/* Current image preview */}
                  {formImageUrl && (
                    <div className="relative inline-block mb-2">
                      <img
                        src={formImageUrl}
                        alt="Character"
                        className="w-16 h-16 object-cover rounded-full border-2"
                        style={{ borderColor: formColor }}
                      />
                      <button
                        type="button"
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
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="block w-full text-sm text-gray-500 dark:text-gray-400
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
                    type="button"
                    onClick={() => setShowLibrary(!showLibrary)}
                    className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {showLibrary ? "Hide library" : "Choose from my uploads"}
                  </button>

                  {/* Image library picker */}
                  {showLibrary && (
                    <div className="mt-2 p-2 border border-gray-200 dark:border-gray-700 rounded max-h-40 overflow-y-auto">
                      <ImageLibraryPicker
                        type="token"
                        onSelect={handleLibrarySelect}
                        selectedUrl={formImageUrl}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingCharacter ? "Save Changes" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingCharacter && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Delete Character
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">"{deletingCharacter.name}"</span>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingCharacter(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Character Sheet Editor Modal */}
        {editingSheetCharacter && (
          <CharacterSheetPanel
            character={{
              id: editingSheetCharacter.id,
              name: editingSheetCharacter.name,
              color: editingSheetCharacter.color,
              imageUrl: editingSheetCharacter.imageUrl,
              sheet: editingSheetCharacter.characterSheet,
            }}
            onClose={() => {
              setEditingSheetCharacter(null);
              // Refresh to update the "Sheet" badge if it was created
              window.location.reload();
            }}
          />
        )}
      </div>
    </div>
  );
}
