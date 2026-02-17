import { useState, useEffect, useMemo } from "react";
import { useMapStore, useEditorStore } from "../../store";
import type { Token } from "../../types";
import type { SrdMonster } from "../../data/monster-types";
import { MONSTER_TYPES, CHALLENGE_RATINGS, formatCR } from "../../data/monster-types";
import {
  monsterToCharacterSheet,
  mapMonsterTokenSize,
  getMonsterColor,
  applyMonsterOverrides,
  parseSpeed,
} from "../../utils/monster-utils";
import type { MonsterOverrides } from "../../utils/monster-utils";
import { calculateModifier } from "../../utils/character-utils";
import { useUploadThing } from "~/utils/uploadthing";
import { ImageLibraryPicker } from "../ImageLibraryPicker";
import { UPLOAD_LIMITS, parseUploadError } from "~/lib/upload-limits";

/** Numeric input with blur validation for monster stat overrides */
function MonsterNumericInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));

  // Sync draft when value changes externally (e.g. monster selection change)
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < min) {
      onChange(min);
      setDraft(String(min));
    } else if (n > max) {
      onChange(max);
      setDraft(String(max));
    } else {
      onChange(n);
      setDraft(String(n));
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-center">
      <div className="text-gray-500 dark:text-gray-400 text-[10px]">{label}</div>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-full bg-transparent text-center font-bold text-gray-900 dark:text-white text-xs outline-none border-b border-transparent focus:border-blue-400"
      />
    </div>
  );
}

interface MonsterCompendiumProps {
  onTokenCreate?: (token: Token) => void;
  onMapChanged?: () => void;
}

export function MonsterCompendium({ onTokenCreate, onMapChanged }: MonsterCompendiumProps) {
  const [monsters, setMonsters] = useState<SrdMonster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [crFilter, setCrFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Override state
  const [overrides, setOverrides] = useState<MonsterOverrides>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const map = useMapStore((s) => s.map);
  const addToken = useMapStore((s) => s.addToken);
  const createMonsterGroup = useMapStore((s) => s.createMonsterGroup);
  const userId = useEditorStore((s) => s.userId);
  const isDungeonMaster = useEditorStore((s) => s.isDungeonMaster);
  const getViewportCenterCell = useEditorStore((s) => s.getViewportCenterCell);

  // Lazy-load monster data
  useEffect(() => {
    import("../../data/srd-monsters.json").then((mod) => {
      setMonsters(mod.default as SrdMonster[]);
      setLoading(false);
    });
  }, []);

  // Filter monsters
  const filtered = useMemo(() => {
    let result = monsters;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }

    if (crFilter !== "all") {
      const cr = parseFloat(crFilter);
      result = result.filter((m) => m.challenge_rating === cr);
    }

    if (typeFilter !== "all") {
      result = result.filter((m) => m.type.toLowerCase() === typeFilter);
    }

    return result;
  }, [monsters, search, crFilter, typeFilter]);

  // Currently selected monster
  const selectedMonster = useMemo(
    () => (selectedIndex ? monsters.find((m) => m.index === selectedIndex) : null),
    [monsters, selectedIndex]
  );

  // Reset overrides when monster selection changes
  useEffect(() => {
    if (selectedMonster) {
      setOverrides({
        name: selectedMonster.name,
        ac: selectedMonster.armor_class?.[0]?.value ?? 10,
        hp: selectedMonster.hit_points,
        walkSpeed: parseSpeed(selectedMonster.speed?.walk),
        strength: selectedMonster.strength,
        dexterity: selectedMonster.dexterity,
        constitution: selectedMonster.constitution,
        intelligence: selectedMonster.intelligence,
        wisdom: selectedMonster.wisdom,
        charisma: selectedMonster.charisma,
      });
    }
    setImageUrl(null);
    setShowLibrary(false);
    setUploadError(null);
    setQuantity(1);
  }, [selectedMonster]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    await startUpload([file]);
    e.target.value = "";
  };

  const handleLibrarySelect = (url: string) => {
    setImageUrl(url);
    setShowLibrary(false);
  };

  const setOverride = <K extends keyof MonsterOverrides>(key: K, value: MonsterOverrides[K]) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddToMap = () => {
    if (!selectedMonster || !map) return;

    const baseSheet = monsterToCharacterSheet(selectedMonster);
    const sheet = applyMonsterOverrides(baseSheet, overrides);
    const size = mapMonsterTokenSize(selectedMonster.size);
    const color = getMonsterColor(selectedMonster.type);
    const baseName = overrides.name || selectedMonster.name;

    // Find existing tokens with same base name to continue numbering
    const existingCount = map.tokens.filter(
      (t) => t.name === baseName || t.name.match(new RegExp(`^${escapeRegex(baseName)} \\d+$`))
    ).length;

    const tokens: Token[] = [];
    const center = getViewportCenterCell(map.viewport, map.grid.cellSize);

    for (let i = 0; i < quantity; i++) {
      const num = existingCount + i;
      const name = num === 0 ? baseName : `${baseName} ${num + 1}`;

      const token: Token = {
        id: crypto.randomUUID(),
        name,
        imageUrl: imageUrl,
        color,
        size,
        position: {
          col: center.col + (i % 5) * size,
          row: center.row + Math.floor(i / 5) * size,
        },
        rotation: 0,
        flipped: false,
        visible: true,
        layer: "monster",
        ownerId: isDungeonMaster() ? null : userId,
        characterSheet: { ...sheet, lastModified: Date.now() },
        characterId: null,
        monsterGroupId: null,
      };
      tokens.push(token);
    }

    // Create monster group if multiple tokens
    let groupId: string | null = null;
    if (quantity > 1) {
      groupId = createMonsterGroup(
        `${baseName} Pack`,
        tokens.map((t) => t.id)
      );
    }

    // Add all tokens
    for (const token of tokens) {
      if (groupId) {
        token.monsterGroupId = groupId;
      }
      addToken(token);
      onTokenCreate?.(token);
    }

    // Trigger full map sync so monster groups persist
    if (groupId) {
      onMapChanged?.();
    }

    // Reset
    setQuantity(1);
    setImageUrl(null);
    setSelectedIndex(null);
  };

  const fmtMod = (score: number) => {
    const mod = calculateModifier(score);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading monsters...</div>
      </div>
    );
  }

  const displayName = overrides.name || selectedMonster?.name || "";

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelectedIndex(null);
        }}
        placeholder="Search monsters..."
        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      />

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={crFilter}
          onChange={(e) => {
            setCrFilter(e.target.value);
            setSelectedIndex(null);
          }}
          className="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
        >
          <option value="all">All CR</option>
          {CHALLENGE_RATINGS.map((cr) => (
            <option key={cr} value={cr}>
              CR {formatCR(cr)}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setSelectedIndex(null);
          }}
          className="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs capitalize"
        >
          <option value="all">All Types</option>
          {MONSTER_TYPES.map((type) => (
            <option key={type} value={type} className="capitalize">
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {filtered.length} monster{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* Monster list */}
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.map((monster) => (
          <button
            key={monster.index}
            onClick={() =>
              setSelectedIndex(selectedIndex === monster.index ? null : monster.index)
            }
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors cursor-pointer ${
              selectedIndex === monster.index
                ? "bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100"
                : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getMonsterColor(monster.type) }}
            />
            <span className="flex-1 truncate">{monster.name}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              CR {formatCR(monster.challenge_rating)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize flex-shrink-0 w-16 truncate">
              {monster.type}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            No monsters match your filters
          </div>
        )}
      </div>

      {/* Selected monster detail - editable */}
      {selectedMonster && (
        <div className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2">
          {/* Editable name */}
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: getMonsterColor(selectedMonster.type) }}
            />
            <input
              type="text"
              value={overrides.name ?? selectedMonster.name}
              onChange={(e) => setOverride("name", e.target.value)}
              className="flex-1 font-semibold text-gray-900 dark:text-white text-sm bg-transparent border-b border-transparent focus:border-blue-400 outline-none"
            />
          </div>

          {/* Type/size/alignment - read-only */}
          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {selectedMonster.size} {selectedMonster.type}
            {selectedMonster.subtype ? ` (${selectedMonster.subtype})` : ""}
            {", "}
            {selectedMonster.alignment}
          </div>

          {/* Editable AC / HP / Speed */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <MonsterNumericInput
              label="AC"
              value={overrides.ac ?? 10}
              onChange={(v) => setOverride("ac", v)}
              min={0}
              max={30}
            />
            <MonsterNumericInput
              label="HP"
              value={overrides.hp ?? 1}
              onChange={(v) => setOverride("hp", v)}
              min={1}
              max={9999}
            />
            <MonsterNumericInput
              label="Speed"
              value={overrides.walkSpeed ?? 0}
              onChange={(v) => setOverride("walkSpeed", v)}
              min={0}
              max={999}
            />
          </div>

          {/* Editable ability scores */}
          <div className="grid grid-cols-6 gap-1 text-xs text-center">
            {(
              [
                ["STR", "strength"],
                ["DEX", "dexterity"],
                ["CON", "constitution"],
                ["INT", "intelligence"],
                ["WIS", "wisdom"],
                ["CHA", "charisma"],
              ] as [string, keyof MonsterOverrides][]
            ).map(([label, key]) => {
              const score = (overrides[key] as number) ?? 10;
              return (
                <div key={label}>
                  <div className="text-gray-500 dark:text-gray-400 text-[10px]">{label}</div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={score}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n) && n >= 1 && n <= 30) {
                        setOverride(key, n);
                      } else if (e.target.value === "") {
                        setOverride(key, 1);
                      }
                    }}
                    className="w-full bg-transparent text-center font-bold text-gray-900 dark:text-white text-xs outline-none border-b border-transparent focus:border-blue-400"
                  />
                  <div className="text-gray-500 dark:text-gray-400 text-[10px]">
                    ({fmtMod(score)})
                  </div>
                </div>
              );
            })}
          </div>

          {/* Attacks summary - read-only */}
          {selectedMonster.actions?.some((a) => a.attack_bonus != null) && (
            <div className="text-xs space-y-0.5">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Attacks:</div>
              {selectedMonster.actions
                .filter((a) => a.attack_bonus != null)
                .slice(0, 4)
                .map((a) => (
                  <div key={a.name} className="text-gray-700 dark:text-gray-300 pl-2">
                    {a.name}{" "}
                    <span className="text-gray-500">
                      +{a.attack_bonus},{" "}
                      {a.damage
                        ?.map((d) => `${d.damage_dice} ${d.damage_type?.name ?? ""}`)
                        .join(" + ")}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Token Image */}
          <div className="space-y-1">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Token Image
              <span className="text-gray-400 dark:text-gray-500 ml-1 font-normal">
                (max {UPLOAD_LIMITS.TOKEN_MAX_SIZE})
              </span>
            </div>

            {imageUrl && (
              <div className="relative inline-block mb-1">
                <img
                  src={imageUrl}
                  alt="Token"
                  className="w-12 h-12 object-cover rounded border border-gray-300 dark:border-gray-600"
                />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 cursor-pointer"
                  title="Remove image"
                >
                  &times;
                </button>
              </div>
            )}

            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="block w-full text-xs text-gray-500 dark:text-gray-400
                  file:mr-2 file:py-1 file:px-2
                  file:rounded file:border-0
                  file:text-xs file:font-semibold
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

            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {showLibrary ? "Hide library" : "Choose from my uploads"}
            </button>

            {showLibrary && (
              <div className="p-2 border border-gray-200 dark:border-gray-700 rounded">
                <ImageLibraryPicker
                  type="token"
                  onSelect={handleLibrarySelect}
                  selectedUrl={imageUrl}
                />
              </div>
            )}
          </div>

          {/* Quantity selector */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Qty:</span>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-30 cursor-pointer text-sm"
            >
              -
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[1.5rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              disabled={quantity >= 10}
              className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-30 cursor-pointer text-sm"
            >
              +
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={handleAddToMap}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer text-sm font-medium"
          >
            Add {quantity > 1 ? `${quantity}x ` : ""}
            {displayName} to Map
          </button>
        </div>
      )}
    </div>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
